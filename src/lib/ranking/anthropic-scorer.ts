import Anthropic from "@anthropic-ai/sdk";
import { ScoringError, type Scorer } from "@/lib/ranking/score";
import type { Logger } from "@/lib/ranking/log";

// Cost and time bounds for one scoring call.
// Worst case per call on claude-haiku-5-5 ($0.10 in / $0.50 out per MTok,
// prompts under 100K tokens): ~13K input tokens + 2,000 output tokens ≈ $0.0023.
export const MAX_OUTPUT_TOKENS = 2_000;
export const CALL_TIMEOUT_MS = 30_000;
// The SDK retries 408/409/429/5xx twice by default. A failed call is
// reported as a failed resume instead, so the number of billed calls can
// never exceed the number of resumes.
export const MAX_RETRIES = 0;

// Structured output: the API constrains the response to this JSON shape.
// Counts and ranges aren't expressible here (the API doesn't support them),
// so the Zod schema in schema.ts enforces them after the call.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    candidateName: { type: "string", description: 'The name as written in the resume, or "" if none appears.' },
    score: { type: "integer", description: "Whole number from 0 to 100." },
    strengths: { type: "array", items: { type: "string" }, description: "Exactly 3 items." },
    gaps: { type: "array", items: { type: "string" }, description: "Exactly 2 items." },
    explanation: { type: "string", description: "2-3 sentences." },
  },
  required: ["candidateName", "score", "strengths", "gaps", "explanation"],
  additionalProperties: false,
};

type Options = {
  apiKey: string;
  model: string;
  log: Logger;
  timeoutMs?: number;
  fetch?: typeof fetch; // tests only
};

export function createAnthropicScorer({ apiKey, model, log, timeoutMs = CALL_TIMEOUT_MS, fetch }: Options): Scorer {
  const client = new Anthropic({ apiKey, maxRetries: MAX_RETRIES, timeout: timeoutMs, fetch });

  return async ({ system, user }, signal) => {
    const started = Date.now();
    let message: Anthropic.Message;
    try {
      message = await client.messages.create(
        {
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: [{ role: "user", content: user }],
          // No `temperature`: claude-haiku-5-5 rejects any non-default value
          // with a 400. Structured output and low effort keep scores steady.
          output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        },
        { signal },
      );
    } catch (error) {
      const kind = classify(error);
      log("rank.model_error", {
        kind,
        status: error instanceof Anthropic.APIError ? (error.status ?? 0) : 0,
        ms: Date.now() - started,
      });
      throw new ScoringError(kind);
    }

    log("rank.model_call", {
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      stop_reason: message.stop_reason ?? "none",
      ms: Date.now() - started,
    });

    if (message.stop_reason === "refusal") throw new ScoringError("refusal");
    if (message.stop_reason === "max_tokens") throw new ScoringError("truncated");
    return message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  };
}

function classify(error: unknown) {
  if (error instanceof Anthropic.APIUserAbortError) return "cancelled" as const;
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout" as const;
  if (error instanceof Anthropic.APIError && error.status !== undefined) {
    // 400: our requests are well-formed, and a spend limit you set returns
    //      400 ("You have reached your specified ... API usage limits").
    // 401/403: key problem. 402: billing. 404: model unavailable.
    // 429: rate limit, or the tier's monthly spend cap.
    // All of these would fail for every remaining resume, so stop the run.
    if ([400, 401, 402, 403, 404, 429].includes(error.status)) return "run_stop" as const;
    if (error.status === 408 || error.status === 504) return "timeout" as const;
    return "provider_error" as const; // 5xx, 529 overloaded
  }
  return "provider_error" as const; // connection errors
}
