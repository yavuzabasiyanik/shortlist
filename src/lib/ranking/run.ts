import type { Logger } from "@/lib/ranking/log";
import type { RankRequest, ResumeOutcome } from "@/lib/ranking/schema";
import { failedOutcome, ScoringError, scoreResume, type Scorer } from "@/lib/ranking/score";

export const MAX_CONCURRENT_SCORING = 5;
// No new call starts after this. A call started just before it still ends
// within its 30 s timeout, inside the route's 300 s maxDuration. A typical
// 50-resume run takes about a minute; this only matters if calls stall.
export const RUN_DEADLINE_MS = 240_000;

export type RunSummary = {
  scored: number;
  failed: number;
  // Set when the provider rejected the account and the run stopped early.
  stopped: boolean;
  cancelled: boolean;
  // Set when the deadline passed before every resume was scheduled.
  timedOut: boolean;
};

// Scores every resume, at most `concurrency` at a time, and calls `emit`
// with each outcome as soon as it is ready. Stops scheduling new calls when
// `signal` aborts (browser cancelled), the provider rejects the account, or
// `deadlineMs` passes. Resumes that never ran are emitted as "not scored" at
// the end.
export async function runRanking({
  request,
  scorer,
  signal,
  emit,
  log,
  concurrency = MAX_CONCURRENT_SCORING,
  deadlineMs = RUN_DEADLINE_MS,
}: {
  request: RankRequest;
  scorer: Scorer;
  signal: AbortSignal;
  emit: (outcome: ResumeOutcome) => void;
  log?: Logger;
  concurrency?: number;
  deadlineMs?: number;
}): Promise<RunSummary> {
  const { resumes, jobDescription } = request;
  // One date for the whole run, from the server clock.
  const today = new Date().toISOString().slice(0, 10);
  const deadline = Date.now() + deadlineMs;
  const run = new AbortController();
  const stopRun = () => run.abort();
  signal.addEventListener("abort", stopRun, { once: true });

  const done = new Set<string>();
  let next = 0;
  let stopped = false;
  let timedOut = false;
  let scored = 0;
  let failed = 0;

  const finish = (outcome: ResumeOutcome) => {
    done.add(outcome.id);
    if (outcome.ok) scored++;
    else failed++;
    emit(outcome);
  };

  async function worker() {
    while (!run.signal.aborted && next < resumes.length) {
      if (Date.now() >= deadline) {
        timedOut = true;
        return;
      }
      const resume = resumes[next++];
      try {
        finish(await scoreResume(scorer, jobDescription, resume, run.signal, today, log));
      } catch (error) {
        if (error instanceof ScoringError && error.kind === "run_stop") {
          stopped = true;
          run.abort(); // cancels in-flight calls and stops scheduling
        }
        // "cancelled": reported below with the other unfinished resumes.
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, resumes.length) }, worker));
  signal.removeEventListener("abort", stopRun);

  for (const resume of resumes) {
    if (done.has(resume.id)) continue;
    finish(
      stopped
        ? failedOutcome(resume, "run_stopped", "Not scored: the AI provider stopped accepting requests (spending limit or account issue).")
        : signal.aborted
          ? failedOutcome(resume, "cancelled", "Not scored: the run was cancelled.")
          : failedOutcome(resume, "time_limit", "Not scored: the run reached its time limit. Rank this resume again in a smaller batch."),
    );
  }

  return { scored, failed, stopped, cancelled: signal.aborted && !stopped, timedOut };
}
