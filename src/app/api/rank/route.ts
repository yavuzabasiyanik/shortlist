import { createRankHandler } from "@/lib/ranking/handler";
import { consoleLogger } from "@/lib/ranking/log";
import { getScorer, realRunsEnabled } from "@/lib/ranking/provider";
import { clientIdentifier, createRateLimiter } from "@/lib/ranking/rate-limit";

// POST /api/rank. Off unless ENABLE_REAL_RUNS=true, a provider is
// configured, and the rate limiter is reachable; there is no other way to
// reach scoring from outside.
// Runs on Node.js: Cache Components requires it, and Next.js rejects an
// explicit `runtime` export when Cache Components is on.
export const POST = createRankHandler({
  isEnabled: () => realRunsEnabled(process.env),
  getScorer: () => getScorer(process.env),
  getLimiter: () => createRateLimiter(process.env),
  clientId: (request) => clientIdentifier(request, process.env),
  log: consoleLogger,
});
