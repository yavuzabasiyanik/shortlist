import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Policy: 3 real ranking runs per IP per UTC calendar day. The counter is a
// fixed window aligned to 00:00 UTC (Upstash's 1-day fixed window), not a
// rolling 24 hours. Redis stores only "<prefix>:<hashed ip>:<day>" -> count,
// which expires with the window. No resume, job, file name, or result data.
export const RUNS_PER_DAY = 3;
const REDIS_TIMEOUT_MS = 3_000;

export type LimitDecision = { allowed: boolean; limit: number; remaining: number; reset: number };

// Consumes one run for `identifier`. Throws if the limit can't be checked;
// callers must then refuse the run (fail closed).
export type RunLimiter = { consume: (identifier: string) => Promise<LimitDecision> };

type Env = Record<string, string | undefined>;

function redisConfig(env: Env) {
  // The Vercel Marketplace integration may use either naming scheme.
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export function rateLimitConfigured(env: Env) {
  return redisConfig(env) !== null;
}

export function createRateLimiter(env: Env): RunLimiter | null {
  const config = redisConfig(env);
  if (!config) return null;

  const ratelimit = new Ratelimit({
    redis: new Redis({ ...config, retry: false }),
    // INCR + expiry in one Lua script: concurrent requests can't both take
    // the last run.
    limiter: Ratelimit.fixedWindow(RUNS_PER_DAY, "1 d"),
    prefix: `shortlist:rank:${env.VERCEL_ENV ?? "local"}`,
    analytics: false,
    ephemeralCache: false,
    timeout: 0, // the library's timeout lets requests through; ours below refuses them
  });

  return {
    async consume(identifier) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("rate limit timeout")), REDIS_TIMEOUT_MS);
      });
      try {
        const result = await Promise.race([ratelimit.limit(identifier), timeout]);
        if (result.reason === "timeout") throw new Error("rate limit timeout");
        return { allowed: result.success, limit: result.limit, remaining: result.remaining, reset: result.reset };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// The rate-limit identity for a request. On Vercel, x-vercel-forwarded-for is
// set by the platform and client-supplied values are not forwarded, so it
// can't be spoofed. Elsewhere there is no trusted source, so every request
// shares one bucket. The IP is hashed before it reaches Redis.
export function clientIdentifier(request: Request, env: Env) {
  const ip =
    env.VERCEL === "1"
      ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown"
      : "not-on-vercel";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
