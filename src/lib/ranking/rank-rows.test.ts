import { describe, expect, it } from "vitest";
import { rankOutcomes } from "@/lib/ranking/rank-rows";
import type { ResumeOutcome } from "@/lib/ranking/schema";

const ok = (id: string, score: number): ResumeOutcome => ({
  id,
  fileName: "cv.pdf",
  ok: true,
  result: { candidateName: id, score, reason: "r", strengths: ["a", "b", "c"], gaps: ["d", "e"], explanation: "One. Two." },
});
const bad = (id: string): ResumeOutcome => ({ id, fileName: "cv.pdf", ok: false, error: { code: "timeout", message: "Scoring timed out." } });

describe("rankOutcomes", () => {
  it("sorts by score, breaks ties by upload order, and numbers ranks from 1", () => {
    const order = ["a", "b", "c", "d"];
    // Arrival order differs from upload order, as it does when streaming.
    const { ranked } = rankOutcomes([ok("c", 70), ok("a", 70), ok("d", 95), ok("b", 40)], order);
    expect(ranked.map((r) => [r.rank, r.id])).toEqual([[1, "d"], [2, "a"], [3, "c"], [4, "b"]]);
  });

  it("gives the same ranks whatever order results arrive in", () => {
    const order = ["a", "b", "c"];
    const first = rankOutcomes([ok("a", 50), ok("b", 50), ok("c", 80)], order).ranked.map((r) => r.id);
    const second = rankOutcomes([ok("c", 80), ok("b", 50), ok("a", 50)], order).ranked.map((r) => r.id);
    expect(first).toEqual(second);
  });

  it("keeps failures out of the ranking, in upload order, with distinct ids for identical file names", () => {
    const { ranked, failed } = rankOutcomes([bad("c"), ok("b", 60), bad("a")], ["a", "b", "c"]);
    expect(ranked.map((r) => r.id)).toEqual(["b"]);
    expect(failed.map((f) => f.id)).toEqual(["a", "c"]);
  });
});
