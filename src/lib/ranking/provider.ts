import type { Scorer } from "@/lib/ranking/score";

// Which model scores resumes is configuration, not code:
//   SCORING_PROVIDER=anthropic|openai
//   SCORING_MODEL=<model id>
// No provider adapter exists yet, so getScorer() returns null and the API
// answers "not configured". Adding one means writing an adapter below that
// calls the provider's SDK with structured JSON output.

export const PROVIDERS = ["anthropic", "openai"] as const;
export type Provider = (typeof PROVIDERS)[number];

// Brief: temperature 0–0.2 so the same input gives near-identical scores.
export const SCORING_TEMPERATURE = 0;

export type ScoringConfig = { provider: Provider; model: string; temperature: number };

type Env = Record<string, string | undefined>;

export function readScoringConfig(env: Env): ScoringConfig | null {
  const provider = PROVIDERS.find((name) => name === env.SCORING_PROVIDER);
  const model = env.SCORING_MODEL?.trim();
  if (!provider || !model) return null;
  return { provider, model, temperature: SCORING_TEMPERATURE };
}

// One adapter per provider, added with the paid integration.
const adapters: Partial<Record<Provider, (config: ScoringConfig) => Scorer>> = {};

export function getScorer(env: Env): Scorer | null {
  const config = readScoringConfig(env);
  if (!config) return null;
  return adapters[config.provider]?.(config) ?? null;
}

// Real runs are off unless the server env says exactly "true".
export function realRunsEnabled(env: Env): boolean {
  return env.ENABLE_REAL_RUNS === "true";
}
