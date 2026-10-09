"use client";

import { useState } from "react";
import { CheckIcon, ChevronIcon, InfoIcon, MinusCircleIcon } from "@/components/icons";
import { IMAGES_NOTICE } from "@/lib/notices";

// One ranked candidate, as shown for both sample and live results. The
// explanation is already in the result, so expanding it makes no request.
export type CandidateRow = {
  key: string;
  rank: number;
  candidateName: string;
  fileName?: string;
  score: number;
  // One-line main reason for the score, from the same model response.
  reason: string;
  strengths: string[];
  gaps: string[];
  explanation: string;
  // The PDF or DOCX contained images whose text wasn't scored.
  textOnly?: boolean;
};

export function CandidateList({ rows }: { rows: CandidateRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Set<string>>(new Set());
  const toggleNote = (key: string) =>
    setNotes((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      {/* One shared column label; each score also carries its own accessible label. */}
      <div aria-hidden className="mb-1.5 flex justify-between px-4 text-xs font-medium text-stone-600">
        <span>Rank · Candidate</span>
        <span>Match score /100</span>
      </div>
      <ol className="space-y-2.5" aria-label="Ranked candidates">
        {rows.map((row) => {
          const expanded = open.has(row.key);
          const panelId = `why-${row.key}`;
          return (
            <li key={row.key} className="row-in">
              <article
                aria-labelledby={`name-${row.key}`}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
              >
                <header className="flex items-center gap-3">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold tabular-nums text-stone-700"
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
                    {row.textOnly && (
                      <button
                        type="button"
                        onClick={() => toggleNote(row.key)}
                        aria-expanded={notes.has(row.key)}
                        aria-controls={`note-${row.key}`}
                        className="mt-1 inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700"
                      >
                        <InfoIcon className="h-3 w-3" />
                        Text-only extraction
                      </button>
                    )}
                  </div>
                  <MatchScore value={row.score} />
                </header>

                {row.textOnly && (
                  <p id={`note-${row.key}`} hidden={!notes.has(row.key)} className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-700">
                    {IMAGES_NOTICE}
                  </p>
                )}

                <p className="mt-2 text-sm leading-snug text-stone-800">
                  <span className="sr-only">Main reason: </span>
                  {row.reason}
                </p>

                <div className="mt-2.5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                  <Evidence title="Strengths" items={row.strengths} icon={<CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-600" />} />
                  <Evidence title="Gaps" items={row.gaps} icon={<MinusCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />} />
                </div>

                <button
                  type="button"
                  onClick={() => toggle(row.key)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={`${expanded ? "Hide" : "Show"} why ${row.candidateName} got this score`}
                  className="mt-2.5 inline-flex items-center gap-1 rounded-md text-sm font-medium text-teal-800 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
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
    </>
  );
}

function MatchScore({ value }: { value: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <div className="hidden h-1.5 w-16 rounded-full bg-stone-200 sm:block" role="presentation">
        <div className="h-full rounded-full bg-teal-600" style={{ width: `${value}%` }} />
      </div>
      <p className="text-lg font-semibold leading-none tabular-nums text-stone-900">
        <span className="sr-only">Match score </span>
        {value}
        <span className="text-sm font-normal text-stone-500">
          <span aria-hidden>/100</span>
          <span className="sr-only"> out of 100</span>
        </span>
      </p>
    </div>
  );
}

function Evidence({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h4>
      <ul className="mt-1.5 space-y-1">
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
