import type { ResumeOutcome, ScoreResult } from "@/lib/ranking/schema";

export type RankedRow = ScoreResult & { id: string; fileName: string; rank: number };
export type FailedRow = { id: string; fileName: string; message: string };

// Successful rows sorted by score (highest first); ties keep upload order,
// so the same results always get the same ranks. Failures are listed
// separately, in upload order.
export function rankOutcomes(outcomes: ResumeOutcome[], uploadOrder: string[]) {
  const position = new Map(uploadOrder.map((id, index) => [id, index]));
  const byUpload = (a: { id: string }, b: { id: string }) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0);

  const ranked: RankedRow[] = outcomes
    .flatMap((o) => (o.ok ? [{ id: o.id, fileName: o.fileName, ...o.result }] : []))
    .sort((a, b) => b.score - a.score || byUpload(a, b))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const failed: FailedRow[] = outcomes
    .flatMap((o) => (o.ok ? [] : [{ id: o.id, fileName: o.fileName, message: o.error.message }]))
    .sort(byUpload);

  return { ranked, failed };
}
