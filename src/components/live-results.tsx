import { ResultsTable } from "@/components/results-table";
import { rankOutcomes } from "@/lib/ranking/rank-rows";
import type { RunState } from "@/lib/use-live-ranking";

export function LiveResults({ state }: { state: RunState }) {
  if (state.status === "idle") return null;

  const { submitted, outcomes } = state;
  const { ranked, failed } = rankOutcomes(outcomes, submitted.map((r) => r.id));
  const received = new Set(outcomes.map((o) => o.id));
  const missing = state.status === "running" ? [] : submitted.filter((r) => !received.has(r.id));
  const total = submitted.length;

  return (
    <section aria-labelledby="live-results-heading" className="space-y-4 border-t border-stone-200 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="live-results-heading" className="text-lg font-semibold">
          Ranked shortlist
        </h3>
        <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-900">Live results</span>
      </div>
      <p className="text-sm text-stone-500">
        Scores are a screening aid, not a hiring decision. Review every candidate yourself.
      </p>

      {state.status === "failed" ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      ) : (
        <div aria-live="polite">
          <p className="text-sm text-stone-700">
            {state.status === "running" ? "Scoring… " : ""}
            {outcomes.length} of {total} {total === 1 ? "resume" : "resumes"} finished
            {failed.length ? `, ${failed.length} with errors` : ""}.
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-stone-200" role="presentation">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${total ? (outcomes.length / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {state.providerStopped && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          The AI provider stopped accepting requests, so the remaining resumes were not scored. Try again later or use the sample data.
        </p>
      )}
      {(state.status === "interrupted" || state.status === "cancelled") && (
        <p className="rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
          {state.status === "cancelled" ? "Ranking cancelled." : state.error}
        </p>
      )}

      {ranked.length > 0 && (
        <ResultsTable rows={ranked.map((row) => ({ ...row, key: row.id }))} />
      )}

      {(failed.length > 0 || missing.length > 0) && (
        <div>
          <h4 className="text-sm font-medium">Not scored</h4>
          <ul className="mt-2 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white text-sm">
            {[...failed, ...missing.map((r) => ({ ...r, message: "No result received." }))].map((row) => (
              <li key={row.id} className="px-3 py-2.5">
                <p className="truncate font-mono text-xs text-stone-800" title={row.fileName}>
                  {row.fileName}
                </p>
                <p className="mt-0.5 text-xs text-red-700">{row.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.runsLeftToday !== null && (
        <p className="text-xs text-stone-500">
          {state.runsLeftToday} live {state.runsLeftToday === 1 ? "ranking" : "rankings"} left today from your network. Resets at 00:00 UTC.
        </p>
      )}
    </section>
  );
}
