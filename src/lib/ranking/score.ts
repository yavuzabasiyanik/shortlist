import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/ranking/prompt";
import {
  ModelOutputSchema,
  ScoreResultSchema,
  type RankRequest,
  type ResumeInput,
  type ResumeOutcome,
} from "@/lib/ranking/schema";

// The scoring boundary: given the prompts, return the model's raw text.
// A provider adapter implements it for real runs; tests pass a fake.
export type Scorer = (prompt: { system: string; user: string }) => Promise<string>;

export async function scoreResume(
  scorer: Scorer,
  jobDescription: string,
  resume: ResumeInput,
): Promise<ResumeOutcome> {
  const { id, fileName } = resume;
  const fail = (code: string, message: string): ResumeOutcome => ({
    id,
    fileName,
    ok: false,
    error: { code, message },
  });

  let raw: string;
  try {
    raw = await scorer({ system: SYSTEM_PROMPT, user: buildUserPrompt(jobDescription, fileName, resume.text) });
  } catch {
    return fail("scoring_failed", "This resume couldn't be scored.");
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("invalid_model_output", "The scoring response was not valid JSON.");
  }

  const output = ModelOutputSchema.safeParse(json);
  if (!output.success) {
    return fail("invalid_model_output", "The scoring response didn't match the expected format.");
  }

  // Brief: use the name from the resume, or the file name if none is found.
  const { candidateName, ...rest } = output.data;
  const result = ScoreResultSchema.parse({ candidateName: candidateName || fileName, ...rest });
  return { id, fileName, ok: true, result };
}

// Scores each resume in turn. Parallel calls (max 5) and streaming come
// later in SHORT-03.
export async function rankResumes(request: RankRequest, scorer: Scorer): Promise<ResumeOutcome[]> {
  const outcomes: ResumeOutcome[] = [];
  for (const resume of request.resumes) {
    outcomes.push(await scoreResume(scorer, request.jobDescription, resume));
  }
  return outcomes;
}
