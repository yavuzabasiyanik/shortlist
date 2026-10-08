"use client";

import { useState } from "react";
import { ChevronIcon, FileIcon, InfoIcon } from "@/components/icons";
import { StepTitle } from "@/components/step-title";
import { sampleJob, sampleResumes } from "@/data/sample";

// Read-only inputs for the bundled example. Nothing here can be submitted.
export function SampleInputs({ onUseOwn }: { onUseOwn: () => void }) {
  const [showJob, setShowJob] = useState(false);

  return (
    <div className="space-y-6">
      <p className="flex gap-2 rounded-lg bg-teal-50 px-3 py-2.5 text-sm text-teal-950">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-teal-800" />
        <span>A fictional example. Results were prepared in advance, so nothing is uploaded and no AI model is called.</span>
      </p>

      <div>
        <StepTitle step={1} title="Job description" />
        <div className="mt-2.5 rounded-lg border border-stone-200 bg-white p-3">
          <p className="text-sm font-medium text-stone-900">{sampleJob.title}</p>
          <p className="text-xs text-stone-600">{sampleJob.company}</p>
          <button
            type="button"
            onClick={() => setShowJob((value) => !value)}
            aria-expanded={showJob}
            aria-controls="sample-job-text"
            className="mt-2 inline-flex items-center gap-1 rounded-md text-sm font-medium text-teal-800 hover:text-teal-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            <ChevronIcon className={`h-4 w-4 motion-safe:transition-transform ${showJob ? "rotate-90" : ""}`} />
            {showJob ? "Hide job description" : "View job description"}
          </button>
          <pre
            id="sample-job-text"
            hidden={!showJob}
            className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap border-t border-stone-200 pt-2 font-sans text-sm leading-relaxed text-stone-700"
          >
            {sampleJob.description}
          </pre>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <StepTitle step={2} title="Resumes" />
          <span className="text-xs text-stone-600">{sampleResumes.length} fictional</span>
        </div>
        <ul className="mt-2.5 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white" aria-label="Sample resumes">
          {sampleResumes.map((resume) => (
            <li key={resume.fileName} className="flex items-center gap-2.5 px-3 py-2 text-sm text-stone-800">
              <FileIcon className="h-4 w-4 shrink-0 text-stone-500" />
              {resume.fileName}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3 border-t border-stone-200 pt-5">
        <button
          type="button"
          onClick={onUseOwn}
          className="w-full rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm motion-safe:transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Use your own resumes
        </button>
        <p className="text-xs text-stone-600">Anything you already entered is kept.</p>
      </div>
    </div>
  );
}
