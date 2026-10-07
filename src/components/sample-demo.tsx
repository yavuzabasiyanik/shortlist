"use client";

import { useState } from "react";
import { ResultsTable, type TableRow } from "@/components/results-table";
import { sampleJob, sampleResults, sampleResumes } from "@/data/sample";

// Highest score first; rank is derived from position, not stored.
const rankedRows: TableRow[] = [...sampleResults]
  .sort((a, b) => b.score - a.score)
  .map((result, index) => ({ ...result, key: result.fileName, rank: index + 1 }));

export function SampleDemo() {
  const [showSample, setShowSample] = useState(false);

  if (!showSample) {
    return (
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setShowSample(true)}
          className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Try with sample data
        </button>
        <p className="text-sm text-stone-500">
          A fictional job and five fictional resumes. No upload needed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="sample-job-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sample-job-heading" className="text-lg font-semibold">
            Sample job: {sampleJob.title}
          </h2>
          <span className="text-sm text-stone-500">{sampleJob.company}</span>
        </div>
        <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-4 font-sans text-sm leading-relaxed text-stone-700">
          {sampleJob.description}
        </pre>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Sample resumes">
          {sampleResumes.map((resume) => (
            <li
              key={resume.fileName}
              className="rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs text-stone-600"
            >
              {resume.fileName}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sample-results-heading">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="sample-results-heading" className="text-lg font-semibold">
            Ranked shortlist
          </h2>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">
            Precomputed sample results
          </span>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          These scores were prepared in advance and bundled with the app. No AI
          model was called.
        </p>

        <div className="mt-4">
          <ResultsTable rows={rankedRows} />
        </div>

        <button
          type="button"
          onClick={() => setShowSample(false)}
          className="mt-4 text-sm font-medium text-teal-800 underline-offset-4 hover:underline"
        >
          Hide sample
        </button>
      </section>
    </div>
  );
}
