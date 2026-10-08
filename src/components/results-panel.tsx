"use client";

import { CandidateList, type CandidateRow } from "@/components/candidate-list";
import { ExportButton } from "@/components/export-button";
import { AlertIcon, FileIcon, InfoIcon, SpinnerIcon } from "@/components/icons";
import { sampleResults } from "@/data/sample";
import { rankOutcomes } from "@/lib/ranking/rank-rows";
import type { RunState } from "@/lib/use-live-ranking";

// Sample rows: highest score first; rank comes from position. File names are
// left off the cards because the sample input list already shows them.
const sampleRows: CandidateRow[] = [...sampleResults]
  .sort((a, b) => b.score - a.score)
  .map(({ fileName, ...result }, index) => ({ ...result, key: fileName, rank: index + 1 }));

type Props = { mode: "own" | "sample"; run: RunState };

export function ResultsPanel({ mode, run }: Props) {
  if (mode === "sample") {
    return (
      <Frame
        count={`${sampleRows.length} candidates`}
        badge={<Badge tone="sample">Sample data · Precomputed</Badge>}
        action={<ExportButton ranked={sampleRows} fileName="shortlist-sample-precomputed.csv" />}
      >
        <CandidateList rows={sampleRows} />
      </Frame>
    );
  }
  if (run.status === "idle") {
    return (
      <Frame>
        <EmptyState />
      </Frame>
    );
  }
  return <LiveResults run={run} />;
}

function LiveResults({ run }: { run: RunState }) {
  const { submitted, outcomes, status } = run;
  const running = status === "running";
  const { ranked, failed } = rankOutcomes(outcomes, submitted.map((r) => r.id));
  const received = new Set(outcomes.map((o) => o.id));
  const pending = running ? submitted.filter((r) => !received.has(r.id)) : [];
  // A request that failed outright (e.g. rate limited) scored nothing, so there
  // is no per-file result to report.
  const missing = running || status === "failed" ? [] : submitted.filter((r) => !received.has(r.id));
  const notScored = [...failed, ...missing.map((r) => ({ ...r, message: "No result received." }))];
  const total = submitted.length;
  const imageIds = new Set(submitted.filter((r) => r.hasImages).map((r) => r.id));
  const rows = ranked.map((row) => ({ ...row, key: row.id, textOnly: imageIds.has(row.id) }));
  const exportable = !running && ranked.length + notScored.length > 0;

  const count = running
    ? `${outcomes.length} of ${total} scored`
    : `${ranked.length} ${ranked.length === 1 ? "candidate" : "candidates"}${notScored.length ? ` · ${notScored.length} not scored` : ""}`;

  return (
    <Frame
      count={status === "failed" ? undefined : count}
      badge={<Badge tone="live" pulsing={running}>{running ? "Scoring" : "Live results"}</Badge>}
      action={status === "failed" ? undefined : <ExportButton ranked={rows} failed={notScored} fileName="shortlist-results.csv" disabled={!exportable} />}
    >
      {status === "failed" && <Message tone="error" role="alert">{run.error}</Message>}
      {/* Progress only while running; once finished, the header totals say it. */}
      <p className="sr-only" aria-live="polite">
        {running
          ? `${outcomes.length} of ${total} ${total === 1 ? "resume" : "resumes"} finished${failed.length ? `, ${failed.length} with errors` : ""}.`
          : status === "failed"
            ? ""
            : `Ranking finished: ${count}.`}
      </p>
      {running && (
        <div className="mb-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200" role="presentation">
            <div
              className="h-full rounded-full bg-teal-600 motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${total ? (outcomes.length / total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-stone-700" aria-hidden>
            {outcomes.length} of {total} {total === 1 ? "resume" : "resumes"} finished
            {failed.length ? `, ${failed.length} with errors` : ""}.
            {outcomes.length === 0 && " Each resume usually takes a few seconds."}
          </p>
          <p className="mt-1 text-xs text-stone-600" aria-hidden>CSV export is available when ranking finishes.</p>
        </div>
      )}

      {run.providerStopped && (
        <Message tone="warning" role="alert">
          The AI provider stopped accepting requests, so the remaining resumes were not scored. Try again later or use the sample data.
        </Message>
      )}
      {(status === "interrupted" || status === "cancelled") && (
        <Message tone="neutral">{status === "cancelled" ? "Ranking cancelled." : run.error}</Message>
      )}

      {rows.length > 0 && <CandidateList rows={rows} />}

      {pending.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Still scoring">
          {pending.map((r) => (
            <li key={r.id} className="flex items-center gap-2.5 rounded-xl border border-dashed border-stone-300 bg-white/60 px-4 py-3 text-sm text-stone-600">
              <SpinnerIcon className="h-4 w-4 shrink-0 text-teal-700 motion-safe:animate-spin" />
              <span className="truncate">Scoring {r.fileName}…</span>
            </li>
          ))}
        </ul>
      )}

      {notScored.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-stone-900">Not scored</h3>
          <ul className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {notScored.map((row) => (
              <li key={row.id} className="flex items-start gap-2.5 px-4 py-3">
                <FileIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                <div className="min-w-0">
                  <p className="truncate text-sm text-stone-800" title={row.fileName}>
                    {row.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-red-700">{row.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Frame>
  );
}

function Frame({ count, badge, action, children }: { count?: string; badge?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {/* Row 1: heading and totals. Row 2 (or right side on wider screens): status and CSV. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <h2 id="results-heading" tabIndex={-1} className="text-lg font-semibold text-stone-900 focus:outline-none">
            Ranked candidates
          </h2>
          {count && <span className="text-sm text-stone-600">{count}</span>}
        </div>
        {(badge || action) && (
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            {badge}
            {action}
          </div>
        )}
      </div>
      <p className="mt-1.5 mb-4 flex items-center gap-1.5 text-xs text-stone-600">
        <InfoIcon className="h-3.5 w-3.5 shrink-0" />
        AI-generated matches. Review the evidence before making hiring decisions.
      </p>
      {children}
    </>
  );
}

function Badge({ tone, pulsing = false, children }: { tone: "sample" | "live"; pulsing?: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        "bg-stone-100 text-stone-800 ring-1 ring-stone-300"
      }`}
    >
      {tone === "live" && <span aria-hidden className={`h-1.5 w-1.5 rounded-full bg-teal-600 ${pulsing ? "motion-safe:animate-pulse" : ""}`} />}
      {children}
    </span>
  );
}

function Message({ tone, role, children }: { tone: "error" | "warning" | "neutral"; role?: "alert"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    neutral: "border-stone-200 bg-stone-50 text-stone-700",
  }[tone];
  return (
    <p role={role} className={`mb-4 flex gap-2 rounded-lg border p-3 text-sm ${styles}`}>
      {tone !== "neutral" && <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 bg-stone-50/70 px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 text-stone-600">
        <FileIcon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-base font-medium text-stone-900">Your ranked candidates will appear here</p>
      <p className="mt-1 max-w-md text-sm text-stone-600">
        Add a job description and resumes (PDFs or pasted text), then click Rank. Each candidate gets a match score, strengths, gaps, and the reasons behind the score.
      </p>
    </div>
  );
}
