import { MAX_REQUEST_BODY_BYTES } from "@/lib/limits";
import type { RankEvent } from "@/lib/ranking/events";
import type { Logger } from "@/lib/ranking/log";
import type { RunLimiter } from "@/lib/ranking/rate-limit";
import { readBodyWithLimit } from "@/lib/ranking/read-body";
import { runRanking } from "@/lib/ranking/run";
import { RankRequestSchema } from "@/lib/ranking/schema";
import type { Scorer } from "@/lib/ranking/score";

export type RankHandlerDeps = {
  isEnabled: () => boolean;
  getScorer: () => Scorer | null;
  getLimiter: () => RunLimiter | null;
  clientId: (request: Request) => string;
  log: Logger;
};

function errorResponse(status: number, code: string, message: string, extra?: object, headers?: HeadersInit) {
  return Response.json(
    { error: { code, message, ...extra } },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

// Built as a factory so tests can pass fakes. The public route
// (app/api/rank/route.ts) wires in the real gate, provider, and limiter only.
export function createRankHandler({ isEnabled, getScorer, getLimiter, clientId, log }: RankHandlerDeps) {
  return async function POST(request: Request): Promise<Response> {
    const reject = (status: number, code: string, message: string, extra?: object, headers?: HeadersInit) => {
      log("rank.rejected", { status, code });
      return errorResponse(status, code, message, extra, headers);
    };

    // Gate first: a disabled deployment reads nothing and calls nothing.
    if (!isEnabled()) {
      return reject(503, "live_ranking_disabled", "Live ranking is not enabled on this deployment. Try the sample data instead.");
    }
    const scorer = getScorer();
    if (!scorer) {
      return reject(503, "scoring_not_configured", "No scoring provider is configured on this deployment.");
    }
    // No rate limiter means no protection: refuse rather than run unmetered.
    const limiter = getLimiter();
    if (!limiter) {
      return reject(503, "rate_limit_unavailable", "Live ranking is temporarily unavailable.");
    }

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return reject(415, "unsupported_media_type", "Send the request as application/json.");
    }

    const body = await readBodyWithLimit(request, MAX_REQUEST_BODY_BYTES);
    if (!body.ok) {
      return body.reason === "too_large"
        ? reject(413, "body_too_large", `The request body is over the ${MAX_REQUEST_BODY_BYTES.toLocaleString("en-US")}-byte limit.`)
        : reject(400, "invalid_encoding", "The request body is not valid UTF-8.");
    }

    let json: unknown;
    try {
      json = JSON.parse(body.text);
    } catch {
      return reject(400, "invalid_json", "The request body is not valid JSON.");
    }

    const parsed = RankRequestSchema.safeParse(json);
    if (!parsed.success) {
      // Paths and messages only; Zod messages don't include the input values.
      const issues = parsed.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return reject(400, "invalid_request", "The request didn't pass validation.", { issues });
    }

    // One unit of the daily allowance per valid run, before any model call.
    let decision;
    try {
      decision = await limiter.consume(clientId(request));
    } catch {
      return reject(503, "rate_limit_unavailable", "Live ranking is temporarily unavailable.");
    }
    if (!decision.allowed) {
      const retryAfter = Math.max(1, Math.ceil((decision.reset - Date.now()) / 1000));
      return reject(
        429,
        "rate_limited",
        `This demo allows ${decision.limit} live rankings per day. Try again after 00:00 UTC, or use the sample data.`,
        { resetsAt: decision.reset },
        { "Retry-After": String(retryAfter) },
      );
    }

    // Stops scheduling model calls when the browser disconnects or cancels.
    const run = new AbortController();
    request.signal?.addEventListener("abort", () => run.abort(), { once: true });
    const encoder = new TextEncoder();
    const started = Date.now();
    const { resumes } = parsed.data;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: RankEvent) => {
          if (run.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            run.abort(); // the reader is gone
          }
        };

        send({ type: "start", total: resumes.length, runsLeftToday: decision.remaining, resetsAt: decision.reset });
        const summary = await runRanking({
          request: parsed.data,
          scorer,
          signal: run.signal,
          emit: (outcome) => send({ type: "result", outcome }),
          log,
        });
        if (summary.stopped) send({ type: "stopped", reason: "provider_rejected" });
        send({ type: "done", scored: summary.scored, failed: summary.failed });

        log("rank.completed", {
          resumes: resumes.length,
          scored: summary.scored,
          failed: summary.failed,
          stopped: summary.stopped,
          cancelled: summary.cancelled,
          ms: Date.now() - started,
        });
        try {
          controller.close();
        } catch {
          // already closed by a cancelled reader
        }
      },
      cancel() {
        run.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
