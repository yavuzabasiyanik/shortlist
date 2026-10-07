import { describe, expect, it, vi } from "vitest";
import { runRanking } from "@/lib/ranking/run";
import type { ResumeOutcome } from "@/lib/ranking/schema";
import { ScoringError, type Scorer } from "@/lib/ranking/score";

const output = (score: number) =>
  JSON.stringify({
    candidateName: "",
    score,
    strengths: ["a", "b", "c"],
    gaps: ["d", "e"],
    explanation: "One sentence. Two sentences.",
  });

const request = (count: number) => ({
  jobDescription: "J".repeat(150),
  resumes: Array.from({ length: count }, (_, i) => ({ id: `r${i}`, fileName: `r${i}.pdf`, text: "text" })),
});

// A scorer whose calls stay open until the test settles them.
function controlledScorer() {
  const calls: { id: string; resolve: (text: string) => void; reject: (e: unknown) => void }[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const scorer = vi.fn<Scorer>(
    ({ user }, signal) =>
      new Promise<string>((resolve, reject) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const id = user.match(/<file_name>(r\d+)\.pdf/)![1];
        const done = () => inFlight--;
        calls.push({ id, resolve: (t) => (done(), resolve(t)), reject: (e) => (done(), reject(e)) });
        signal.addEventListener("abort", () => (done(), reject(new ScoringError("cancelled"))));
      }),
  );
  return { scorer, calls, maxInFlight: () => maxInFlight };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("runRanking", () => {
  it("runs at most five scoring calls at once and starts the next as one finishes", async () => {
    const { scorer, calls, maxInFlight } = controlledScorer();
    const emitted: ResumeOutcome[] = [];
    const run = runRanking({ request: request(12), scorer, signal: new AbortController().signal, emit: (o) => emitted.push(o) });

    await tick();
    expect(scorer).toHaveBeenCalledTimes(5);
    calls[0].resolve(output(50));
    await tick();
    expect(scorer).toHaveBeenCalledTimes(6);

    while (calls.some((c) => !emitted.some((o) => o.id === c.id))) {
      calls.filter((c) => !emitted.some((o) => o.id === c.id)).forEach((c) => c.resolve(output(60)));
      await tick();
    }
    const summary = await run;
    expect(maxInFlight()).toBe(5);
    expect(summary).toEqual({ scored: 12, failed: 0, stopped: false, cancelled: false });
  });

  it("emits each result as soon as it finishes, in finishing order", async () => {
    const { scorer, calls } = controlledScorer();
    const emitted: string[] = [];
    const run = runRanking({ request: request(3), scorer, signal: new AbortController().signal, emit: (o) => emitted.push(o.id) });
    await tick();

    calls[2].resolve(output(10));
    await tick();
    expect(emitted).toEqual(["r2"]);
    calls[0].resolve(output(90));
    calls[1].resolve(output(50));
    await run;
    expect(emitted).toEqual(["r2", "r0", "r1"]);
  });

  it("keeps going when one resume fails", async () => {
    const { scorer, calls } = controlledScorer();
    const emitted: ResumeOutcome[] = [];
    const run = runRanking({ request: request(3), scorer, signal: new AbortController().signal, emit: (o) => emitted.push(o) });
    await tick();
    calls[0].reject(new ScoringError("timeout"));
    calls[1].resolve("not json");
    calls[2].resolve(output(70));
    expect(await run).toMatchObject({ scored: 1, failed: 2, stopped: false });
    expect(emitted.map((o) => (o.ok ? "ok" : o.error.code))).toEqual(["timeout", "invalid_model_output", "ok"]);
  });

  it("stops scheduling after a run-wide provider rejection and reports the rest as not scored", async () => {
    const { scorer, calls } = controlledScorer();
    const emitted: ResumeOutcome[] = [];
    const run = runRanking({ request: request(12), scorer, signal: new AbortController().signal, emit: (o) => emitted.push(o) });
    await tick();
    calls[0].resolve(output(80));
    await tick(); // r5 starts
    calls[1].reject(new ScoringError("run_stop"));

    const summary = await run;
    expect(scorer).toHaveBeenCalledTimes(6); // no calls after the rejection
    expect(summary).toMatchObject({ scored: 1, failed: 11, stopped: true });
    expect(emitted.filter((o) => !o.ok && o.error.code === "run_stopped")).toHaveLength(11);
  });

  it("stops scheduling when cancelled and aborts in-flight calls", async () => {
    const { scorer, calls } = controlledScorer();
    const controller = new AbortController();
    const emitted: ResumeOutcome[] = [];
    const run = runRanking({ request: request(12), scorer, signal: controller.signal, emit: (o) => emitted.push(o) });
    await tick();
    calls[0].resolve(output(80));
    await tick();
    controller.abort();

    const summary = await run;
    expect(scorer).toHaveBeenCalledTimes(6);
    expect(summary).toMatchObject({ scored: 1, cancelled: true, stopped: false });
    expect(emitted.filter((o) => !o.ok && o.error.code === "cancelled")).toHaveLength(11);
  });
});
