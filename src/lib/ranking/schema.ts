import { z } from "zod";
import {
  JOB_DESCRIPTION_MAX_CHARS,
  JOB_DESCRIPTION_MIN_CHARS,
  MAX_FILE_NAME_CHARS,
  MAX_RESUME_ID_CHARS,
  MAX_RESUME_TEXT_CHARS,
  MAX_RESUMES,
} from "@/lib/limits";

// ---------- Request: what the browser sends ----------

const ResumeInputSchema = z.strictObject({
  id: z
    .string()
    .min(1)
    .max(MAX_RESUME_ID_CHARS)
    .regex(/^[A-Za-z0-9_-]+$/, "Use only letters, digits, '-' and '_'."),
  fileName: z
    .string()
    .min(1)
    .max(MAX_FILE_NAME_CHARS)
    .refine(
      (name) => ![...name].some((char) => char < " " || char === "\x7f"),
      "File name contains control characters.",
    ),
  text: z
    .string()
    .max(MAX_RESUME_TEXT_CHARS)
    .refine((text) => text.trim().length > 0, "Resume text is empty."),
});

export const RankRequestSchema = z.strictObject({
  jobDescription: z.string().min(JOB_DESCRIPTION_MIN_CHARS).max(JOB_DESCRIPTION_MAX_CHARS),
  resumes: z
    .array(ResumeInputSchema)
    .min(1)
    .max(MAX_RESUMES)
    .superRefine((resumes, ctx) => {
      const seen = new Set<string>();
      resumes.forEach((resume, index) => {
        if (seen.has(resume.id)) {
          ctx.addIssue({ code: "custom", message: "Duplicate resume id.", path: [index, "id"] });
        }
        seen.add(resume.id);
      });
    }),
});

export type RankRequest = z.infer<typeof RankRequestSchema>;
export type ResumeInput = RankRequest["resumes"][number];

// ---------- Result: the brief's LLM output schema ----------

// Periods that don't end a sentence: initialisms ("B.S.", "U.S.", "e.g.")
// and common abbreviations ("etc.", "vs.", "Jan.").
const INITIALISMS = /\b(?:[A-Za-z]\.){2,}/g;
const ABBREVIATIONS = /\b(?:etc|vs|approx|incl|esp|dept|govt|jr|sr|dr|mr|mrs|ms|prof|inc|ltd|corp|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\./gi;

// Counts sentence endings: ".", "!" or "?" followed by a space or the end.
// "Node.js" and "4.2" don't count. A rough check, not a grammar parser.
export function sentenceCount(text: string) {
  const trimmed = text.trim();
  const stripped = trimmed
    .replace(INITIALISMS, (match) => match.replace(/\./g, ""))
    .replace(ABBREVIATIONS, (match) => match.slice(0, -1));
  const count = stripped.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;
  // An abbreviation that ends the text still ends the last sentence.
  return /[.!?]$/.test(trimmed) && !/[.!?]$/.test(stripped) ? count + 1 : count;
}

const bullet = z.string().trim().min(1).max(300);

const resultFields = {
  score: z.number().int().min(0).max(100),
  // One short line shown beside the candidate and in the top-10 export.
  reason: bullet,
  strengths: z.array(bullet).length(3),
  gaps: z.array(bullet).length(2),
  explanation: z
    .string()
    .trim()
    .min(1)
    .max(1_200)
    .refine((text) => {
      const n = sentenceCount(text);
      return n >= 2 && n <= 3;
    }, "Explanation must be 2–3 sentences."),
};

// What the model must return. It may leave candidateName empty (or omit it)
// when the resume has no name; the server then falls back to the file name.
export const ModelOutputSchema = z.strictObject({
  candidateName: z.string().trim().max(200).nullish(),
  ...resultFields,
});

// A validated result as shown in the table.
export const ScoreResultSchema = z.strictObject({
  candidateName: z.string().trim().min(1).max(MAX_FILE_NAME_CHARS),
  ...resultFields,
});

export type ScoreResult = z.infer<typeof ScoreResultSchema>;

// One entry per resume in the API response. A failed resume doesn't stop
// the others; it becomes an error row.
export type ResumeOutcome =
  | { id: string; fileName: string; ok: true; result: ScoreResult }
  | { id: string; fileName: string; ok: false; error: { code: string; message: string } };
