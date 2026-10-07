import { createAnthropicScorer } from "@/lib/ranking/anthropic-scorer";
import { consoleLogger } from "@/lib/ranking/log";
import { rateLimitConfigured } from "@/lib/ranking/rate-limit";
import type { Scorer } from "@/lib/ranking/score";

// Which model scores resumes is configuration, not code:
//   SCORING_PROVIDER=anthropic
//   SCORING_MODEL=claude-haiku-5-5
//   ANTHROPIC_API_KEY=<key from a workspace with a spend limit>
// Only an Anthropic adapter exists.

export const PROVIDERS = ["anthropic"] as const;
export type Provider = (typeof PROVIDERS)[number];

export type ScoringConfig = { provider: Provider; model: string; apiKey: string };

type Env = Record<string, string | undefined>;

export function readScoringConfig(env: Env): ScoringConfig | null {
  const provider = PROVIDERS.find((name) => name === env.SCORING_PROVIDER);
  const model = env.SCORING_MODEL?.trim();
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!provider || !model || !apiKey) return null;
  return { provider, model, apiKey };
}

export function getScorer(env: Env): Scorer | null {
  const config = readScoringConfig(env);
  if (!config) return null;
  return createAnthropicScorer({ apiKey: config.apiKey, model: config.model, log: consoleLogger });
}

// Real runs are off unless the server env says exactly "true".
export function realRunsEnabled(env: Env): boolean {
  return env.ENABLE_REAL_RUNS === "true";
}

// What the page tells the browser: one boolean, never any configuration.
export function liveRankingAvailable(env: Env): boolean {
  return realRunsEnabled(env) && readScoringConfig(env) !== null && rateLimitConfigured(env);
}
