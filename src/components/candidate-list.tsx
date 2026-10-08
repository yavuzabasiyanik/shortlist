"use client";

import { useState } from "react";
import { CheckIcon, ChevronIcon, MinusCircleIcon } from "@/components/icons";

// One ranked candidate, as shown for both sample and live results. The
// explanation is already in the result, so expanding it makes no request.
export type CandidateRow = {
  key: string;
  rank: number;
  candidateName: string;
  fileName?: string;
  score: number;
  strengths: string[];
  gaps: string[];
  explanation: string;
};

export function CandidateList({ rows }: { rows: CandidateRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ol className="space-y-3" aria-label="Ranked candidates">
      {rows.map((row) => {
        const expanded = open.has(row.key);
        const panelId = `why-${row.key}`;
        return (
          <li key={row.key} className="row-in">
            <article
              aria-labelledby={`name-${row.key}`}
              className="rounded-xl border border-stone-200 bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5"
            >
              <header className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold tabular-nums text-stone-700"
                  aria-label={`Rank ${row.rank}`}
                >
                  {row.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 id={`name-${row.key}`} className="truncate text-base font-semibold text-stone-900">
                    {row.candidateName}
                  </h3>
                  {row.fileName && row.fileName !== row.candidateName && (
                    <p className="truncate text-xs text-stone-500" title={row.fileName}>
                      {row.fileName}
                    </p>
                  )}
                </div>
                <MatchScore value={row.score} />
              </header>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Evidence title="Strengths" items={row.strengths} icon={<CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />} />
                <Evidence title="Gaps" items={row.gaps} icon={<MinusCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />} />
              </div>

              <button
                type="button"
                onClick={() => toggle(row.key)}
                aria-expanded={expanded}
                aria-controls={panelId}
                aria-label={`${expanded ? "Hide" : "Show"} why ${row.candidateName} got this score`}
                className="mt-4 inline-flex items-center gap-1 rounded-md text-sm font-medium text-teal-800 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                <ChevronIcon className={`h-4 w-4 motion-safe:transition-transform ${expanded ? "rotate-90" : ""}`} />
                {expanded ? "Hide explanation" : "Why this score?"}
              </button>
              <p
                id={panelId}
                hidden={!expanded}
                className="mt-2 rounded-lg bg-stone-50 px-3 py-2.5 text-sm leading-relaxed text-stone-700"
              >
                {row.explanation}
              </p>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

function MatchScore({ value }: { value: number }) {
  return (
    <div className="shrink-0 text-right">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">Match score</p>
      <p className="text-lg font-semibold leading-tight tabular-nums text-stone-900">
        {value}
        <span className="text-sm font-normal text-stone-500">/100</span>
      </p>
      <div className="mt-1 ml-auto h-1.5 w-20 rounded-full bg-stone-200" role="presentation">
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Evidence({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="flex gap-2 text-sm leading-snug text-stone-700">
            {icon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
