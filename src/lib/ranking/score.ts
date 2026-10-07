import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/ranking/prompt";
import {
  ModelOutputSchema,
  ScoreResultSchema,
  type ResumeInput,
  type ResumeOutcome,
} from "@/lib/ranking/schema";

// Why one scoring call failed.
// - "run_stop": the provider rejected the account (spend limit, billing,
//   auth, rate limit). Every later call would fail too, so the run stops.
// - "cancelled": the run was cancelled (browser left or run stopped).
// - everything else affects only this resume.
export type ScoringErrorKind =
  | "refusal"
  | "timeout"
  | "truncated"
  | "provider_error"
  | "run_stop"
  | "cancelled";

export class ScoringError extends Error {
  constructor(readonly kind: ScoringErrorKind) {
    super(kind);
    this.name = "ScoringError";
  }
}

// The scoring boundary: given the prompts, return the model's raw text, or
// throw a ScoringError. A provider adapter implements it; tests pass fakes.
export type Scorer = (prompt: { system: string; user: string }, signal: AbortSignal) => Promise<string>;

const MESSAGES: Record<Exclude<ScoringErrorKind, "run_stop" | "cancelled">, string> = {
  refusal: "The model declined to score this resume.",
  timeout: "Scoring timed out.",
  truncated: "The scoring response was cut off.",
  provider_error: "The AI provider returned an error for this resume.",
};

export function failedOutcome(resume: ResumeInput, code: string, message: string): ResumeOutcome {
  return { id: resume.id, fileName: resume.fileName, ok: false, error: { code, message } };
}

// Scores one resume. Throws only for run-wide stops and cancellation; every
// other failure becomes an error outcome for this resume.
export async function scoreResume(
  scorer: Scorer,
  jobDescription: string,
  resume: ResumeInput,
  signal: AbortSignal,
  today: string,
): Promise<ResumeOutcome> {
  const { id, fileName } = resume;

  let raw: string;
  try {
    raw = await scorer(
      { system: SYSTEM_PROMPT, user: buildUserPrompt(jobDescription, fileName, resume.text, today) },
      signal,
    );
  } catch (error) {
    if (error instanceof ScoringError) {
      if (error.kind === "run_stop" || error.kind === "cancelled") throw error;
      return failedOutcome(resume, error.kind, MESSAGES[error.kind]);
    }
    if (signal.aborted) throw new ScoringError("cancelled");
    return failedOutcome(resume, "scoring_failed", "This resume couldn't be scored.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return failedOutcome(resume, "invalid_model_output", "The scoring response was not valid JSON.");
  }

  const output = ModelOutputSchema.safeParse(json);
  if (!output.success) {
    return failedOutcome(resume, "invalid_model_output", "The scoring response didn't match the expected format.");
  }

  // Brief: use the name from the resume, or the file name if none is found.
  const { candidateName, ...rest } = output.data;
  const result = ScoreResultSchema.parse({ candidateName: candidateName || fileName, ...rest });
  return { id, fileName, ok: true, result };
}
