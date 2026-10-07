import type { RankRequest, ResumeOutcome } from "@/lib/ranking/schema";
import { failedOutcome, ScoringError, scoreResume, type Scorer } from "@/lib/ranking/score";

export const MAX_CONCURRENT_SCORING = 5;

export type RunSummary = {
  scored: number;
  failed: number;
  // Set when the provider rejected the account and the run stopped early.
  stopped: boolean;
  cancelled: boolean;
};

// Scores every resume, at most `concurrency` at a time, and calls `emit`
// with each outcome as soon as it is ready. Stops scheduling new calls when
// `signal` aborts (browser cancelled) or the provider rejects the account.
// Resumes that never ran are emitted as "not scored" at the end.
export async function runRanking({
  request,
  scorer,
  signal,
  emit,
  concurrency = MAX_CONCURRENT_SCORING,
}: {
  request: RankRequest;
  scorer: Scorer;
  signal: AbortSignal;
  emit: (outcome: ResumeOutcome) => void;
  concurrency?: number;
}): Promise<RunSummary> {
  const { resumes, jobDescription } = request;
  const run = new AbortController();
  const stopRun = () => run.abort();
  signal.addEventListener("abort", stopRun, { once: true });

  const done = new Set<string>();
  let next = 0;
  let stopped = false;
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
      const resume = resumes[next++];
      try {
        finish(await scoreResume(scorer, jobDescription, resume, run.signal));
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
        : failedOutcome(resume, "cancelled", "Not scored: the run was cancelled."),
    );
  }

  return { scored, failed, stopped, cancelled: signal.aborted && !stopped };
}
