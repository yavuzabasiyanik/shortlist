"use client";

import { useState } from "react";
import { sampleJob, sampleResults, sampleResumes } from "@/data/sample";

// Highest score first; rank is derived from position, not stored.
const rankedResults = [...sampleResults].sort((a, b) => b.score - a.score);

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

        {/* Desktop: table */}
        <div className="mt-4 hidden overflow-hidden rounded-lg border border-stone-200 md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Rank</th>
                <th scope="col" className="px-4 py-3 font-medium">Candidate</th>
                <th scope="col" className="px-4 py-3 font-medium">Score</th>
                <th scope="col" className="px-4 py-3 font-medium">Strengths</th>
                <th scope="col" className="px-4 py-3 font-medium">Gaps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 align-top">
              {rankedResults.map((result, index) => (
                <tr key={result.fileName}>
                  <td className="px-4 py-4 font-semibold text-stone-500">
                    {index + 1}
                  </td>
                  <td className="px-4 py-4 font-medium">{result.candidateName}</td>
                  <td className="px-4 py-4">
                    <Score value={result.score} />
                  </td>
                  <td className="px-4 py-4">
                    <BulletList items={result.strengths} />
                  </td>
                  <td className="px-4 py-4">
                    <BulletList items={result.gaps} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile: one card per candidate */}
        <ol className="mt-4 space-y-3 md:hidden">
          {rankedResults.map((result, index) => (
            <li
              key={result.fileName}
              className="rounded-lg border border-stone-200 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  <span className="mr-2 text-stone-500">#{index + 1}</span>
                  {result.candidateName}
                </p>
                <Score value={result.score} />
              </div>
              <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">
                Strengths
              </h3>
              <BulletList items={result.strengths} />
              <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">
                Gaps
              </h3>
              <BulletList items={result.gaps} />
            </li>
          ))}
        </ol>

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

function Score({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 font-semibold tabular-nums">
        {value}
        <span className="sr-only"> out of 100</span>
      </span>
      <div
        className="h-1.5 w-16 rounded-full bg-stone-200"
        role="presentation"
      >
        <div
          className="h-full rounded-full bg-teal-600"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-4 text-stone-700 marker:text-stone-400">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
