import { describe, expect, it, vi } from "vitest";
import { runRanking } from "@/lib/ranking/run";
import type { ResumeOutcome } from "@/lib/ranking/schema";
import { ScoringError, type Scorer } from "@/lib/ranking/score";

const output = (score: number) =>
  JSON.stringify({
    candidateName: "",
    score,
    reason: "r",
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
  it("gives every scoring call the server's current UTC date", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T03:30:00Z")); // still Oct 7 in the Americas
    const scorer = vi.fn<Scorer>(async () => output(50));
    await runRanking({ request: request(2), scorer, signal: new AbortController().signal, emit: () => {} });
    vi.useRealTimers();
    for (const [prompt] of scorer.mock.calls) expect(prompt.user).toMatch(/^Today's date \(UTC\): 2026-10-08\n/);
  });

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
    expect(summary).toEqual({ scored: 12, failed: 0, stopped: false, cancelled: false, timedOut: false });
  });

  it("scores a 50-resume run with one failure and keeps the other 49", async () => {
    const scorer = vi.fn<Scorer>(async ({ user }) => {
      if (user.includes("<file_name>r17.pdf")) throw new ScoringError("timeout");
      return output(50);
    });
    const emitted: ResumeOutcome[] = [];
    const summary = await runRanking({ request: request(50), scorer, signal: new AbortController().signal, emit: (o) => emitted.push(o) });
    expect(scorer).toHaveBeenCalledTimes(50);
    expect(summary).toMatchObject({ scored: 49, failed: 1, stopped: false, timedOut: false });
    expect(emitted.find((o) => o.id === "r17")).toMatchObject({ ok: false, error: { code: "timeout" } });
  });

  it("starts no new calls after the deadline, lets started ones finish, and reports the rest", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { scorer, calls } = controlledScorer();
    const emitted: ResumeOutcome[] = [];
    const run = runRanking({ request: request(8), scorer, signal: new AbortController().signal, emit: (o) => emitted.push(o), deadlineMs: 1_000 });
    await tick();
    expect(scorer).toHaveBeenCalledTimes(5);
    vi.setSystemTime(Date.now() + 1_001);
    calls.forEach((c) => c.resolve(output(70)));
    const summary = await run;
    vi.useRealTimers();
    expect(scorer).toHaveBeenCalledTimes(5);
    expect(summary).toEqual({ scored: 5, failed: 3, stopped: false, cancelled: false, timedOut: true });
    expect(emitted.filter((o) => !o.ok).map((o) => o.id)).toEqual(["r5", "r6", "r7"]);
    expect(emitted.find((o) => o.id === "r5")).toMatchObject({ error: { code: "time_limit" } });
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
