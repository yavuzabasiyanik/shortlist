import { consoleLogger, createRankHandler } from "@/lib/ranking/handler";
import { getScorer, realRunsEnabled } from "@/lib/ranking/provider";

// POST /api/rank. Off unless ENABLE_REAL_RUNS=true and a provider is
// configured; there is no other way to reach scoring from outside.
// Runs on Node.js: Cache Components requires it, and Next.js rejects an
// explicit `runtime` export when Cache Components is on.
export const POST = createRankHandler({
  isEnabled: () => realRunsEnabled(process.env),
  getScorer: () => getScorer(process.env),
  log: consoleLogger,
});
