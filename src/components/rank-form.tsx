"use client";

import { useState } from "react";
import { JobDescriptionInput } from "@/components/job-description-input";
import { ResumeUpload } from "@/components/resume-upload";
import { JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MIN_CHARS, MAX_RESUMES } from "@/lib/limits";
import { useResumeFiles } from "@/lib/use-resume-files";

// Live ranking ships in SHORT-03 and stays off until the server allows it.
const LIVE_RANKING_ENABLED = false;

export function RankForm() {
  const [jobDescription, setJobDescription] = useState("");
  const { files, rejections, addFiles, removeFile, dismissRejections } = useResumeFiles();

  const jobReady =
    jobDescription.length >= JOB_DESCRIPTION_MIN_CHARS &&
    jobDescription.length <= JOB_DESCRIPTION_MAX_CHARS;
  const parsing = files.filter((file) => file.status === "parsing").length;
  const failed = files.filter((file) => file.status === "error").length;
  const resumesReady =
    files.length >= 1 && files.length <= MAX_RESUMES && parsing === 0 && failed === 0;
  const inputsReady = jobReady && resumesReady;
  const canRank = inputsReady && LIVE_RANKING_ENABLED;

  let resumeStatus = "Add at least one PDF resume.";
  if (parsing) resumeStatus = `Reading ${parsing} ${parsing === 1 ? "PDF" : "PDFs"}…`;
  else if (failed) resumeStatus = `Remove ${failed} ${failed === 1 ? "file" : "files"} that couldn't be read.`;
  else if (files.length) resumeStatus = `${files.length} ${files.length === 1 ? "resume" : "resumes"} ready.`;

  return (
    <div className="space-y-6">
      <JobDescriptionInput value={jobDescription} onChange={setJobDescription} />
      <ResumeUpload
        files={files}
        rejections={rejections}
        onAdd={addFiles}
        onRemove={removeFile}
        onDismissRejections={dismissRejections}
      />

      <div className="border-t border-stone-200 pt-5">
        <ul className="space-y-1 text-sm" aria-label="Ranking checklist">
          <ChecklistItem done={jobReady}>
            Job description: {jobReady ? "ready." : `${JOB_DESCRIPTION_MIN_CHARS}–${JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-US")} characters needed.`}
          </ChecklistItem>
          <ChecklistItem done={resumesReady}>Resumes: {resumeStatus}</ChecklistItem>
        </ul>

        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled={!canRank}
            className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none"
          >
            Rank
          </button>
          <p className="text-sm text-stone-600" aria-live="polite">
            {inputsReady
              ? "Inputs are ready, but live ranking isn't enabled in this demo yet."
              : "Live ranking isn't enabled in this demo yet."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          done ? "bg-teal-700 text-white" : "border border-stone-300 text-transparent"
        }`}
      >
        ✓
      </span>
      <span className={done ? "text-stone-800" : "text-stone-600"}>
        <span className="sr-only">{done ? "Done: " : "Not done: "}</span>
        {children}
      </span>
    </li>
  );
}
