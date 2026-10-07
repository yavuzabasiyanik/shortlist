"use client";

import { useState } from "react";
import { JobDescriptionInput } from "@/components/job-description-input";
import { LiveResults } from "@/components/live-results";
import { ResumeUpload } from "@/components/resume-upload";
import { JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MIN_CHARS, MAX_RESUMES } from "@/lib/limits";
import { useLiveRanking } from "@/lib/use-live-ranking";
import { useResumeFiles } from "@/lib/use-resume-files";

// `liveEnabled` comes from the server: true only when ENABLE_REAL_RUNS, the
// provider, and the rate limiter are all configured. No settings reach here.
export function RankForm({ liveEnabled }: { liveEnabled: boolean }) {
  const [jobDescription, setJobDescription] = useState("");
  const { files, rejections, addFiles, removeFile, dismissRejections } = useResumeFiles();
  const { state: run, start, cancel } = useLiveRanking();
  const running = run.status === "running";

  const jobReady =
    jobDescription.length >= JOB_DESCRIPTION_MIN_CHARS &&
    jobDescription.length <= JOB_DESCRIPTION_MAX_CHARS;
  const parsing = files.filter((file) => file.status === "parsing").length;
  const failed = files.filter((file) => file.status === "error").length;
  const resumesReady =
    files.length >= 1 && files.length <= MAX_RESUMES && parsing === 0 && failed === 0;
  const inputsReady = jobReady && resumesReady;
  const canRank = inputsReady && liveEnabled && !running;

  const rank = () => {
    if (!canRank) return;
    const resumes = files.flatMap((file) =>
      file.status === "ready" ? [{ id: `f${file.id}`, fileName: file.name, text: file.text }] : [],
    );
    void start(jobDescription, resumes);
  };

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
            onClick={rank}
            disabled={!canRank}
            className="rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none"
          >
            {running ? "Ranking…" : "Rank"}
          </button>
          {running && (
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
            >
              Cancel
            </button>
          )}
          {!liveEnabled && (
            <p className="text-sm text-stone-600">Live ranking isn&apos;t enabled on this deployment. Try the sample data above.</p>
          )}
        </div>
        {liveEnabled && (
          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            Demo limits: 3 live rankings per network per day (resets 00:00 UTC), using a rate-limited, spending-capped
            API key. Clicking Rank sends the extracted text, never the PDF files, to Anthropic for scoring. Nothing is
            stored after the request ends.
          </p>
        )}
      </div>

      <LiveResults state={run} />
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
