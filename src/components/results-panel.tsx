"use client";

import { CandidateList, type CandidateRow } from "@/components/candidate-list";
import { ExportButton } from "@/components/export-button";
import { AlertIcon, FileIcon, InfoIcon, SpinnerIcon } from "@/components/icons";
import { sampleResults } from "@/data/sample";
import { rankOutcomes } from "@/lib/ranking/rank-rows";
import type { RunState } from "@/lib/use-live-ranking";

// Sample rows: highest score first; rank comes from position.
const sampleRows: CandidateRow[] = [...sampleResults]
  .sort((a, b) => b.score - a.score)
  .map((result, index) => ({ ...result, key: result.fileName, rank: index + 1 }));

type Props = { mode: "own" | "sample"; run: RunState; onTrySample: () => void };

export function ResultsPanel({ mode, run, onTrySample }: Props) {
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
        <EmptyState onTrySample={onTrySample} />
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
  const exportable = !running && ranked.length + notScored.length > 0;

  const count = running
    ? `${outcomes.length} of ${total} scored`
    : `${ranked.length} ${ranked.length === 1 ? "candidate" : "candidates"}${notScored.length ? ` · ${notScored.length} not scored` : ""}`;

  return (
    <Frame
      count={status === "failed" ? undefined : count}
      badge={<Badge tone="live" pulsing={running}>{running ? "Scoring" : "Live results"}</Badge>}
      action={status === "failed" ? undefined : <ExportButton ranked={ranked} failed={notScored} fileName="shortlist-results.csv" disabled={!exportable} />}
    >
      {status === "failed" ? (
        <Message tone="error" role="alert">{run.error}</Message>
      ) : (
        <div className="mb-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200" role="presentation">
            <div
              className="h-full rounded-full bg-teal-600 motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${total ? (outcomes.length / total) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-stone-700" aria-live="polite">
            {outcomes.length} of {total} {total === 1 ? "resume" : "resumes"} finished
            {failed.length ? `, ${failed.length} with errors` : ""}.
            {running && outcomes.length === 0 && " Each resume usually takes a few seconds."}
          </p>
          {running && !exportable && <p className="mt-1 text-xs text-stone-600">CSV export is available when ranking finishes.</p>}
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

      {ranked.length > 0 && <CandidateList rows={ranked.map((row) => ({ ...row, key: row.id }))} />}

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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="results-heading" className="text-lg font-semibold text-stone-900">
          Ranked candidates
        </h2>
        {count && <span className="text-sm text-stone-600">{count}</span>}
        {badge}
        {action && <div className="ml-auto">{action}</div>}
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        tone === "sample" ? "bg-stone-100 text-stone-800 ring-1 ring-stone-300" : "bg-teal-50 text-teal-900 ring-1 ring-teal-200"
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

function EmptyState({ onTrySample }: { onTrySample: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 bg-stone-50/70 px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <FileIcon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-base font-medium text-stone-900">Your ranked candidates will appear here</p>
      <p className="mt-1 max-w-md text-sm text-stone-600">
        Add a job description and PDF resumes, then click Rank. Each candidate gets a match score, strengths, gaps, and the reasons behind the score.
      </p>
      <button
        type="button"
        onClick={onTrySample}
        className="mt-5 rounded-lg border border-teal-700 bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        Try with sample data
      </button>
    </div>
  );
}
