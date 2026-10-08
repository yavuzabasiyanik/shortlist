"use client";

import { ArrowDownIcon, LockIcon } from "@/components/icons";
import { JobDescriptionInput } from "@/components/job-description-input";
import { ResumeUpload } from "@/components/resume-upload";
import { JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MIN_CHARS, MAX_RESUMES } from "@/lib/limits";
import type { RunState } from "@/lib/use-live-ranking";
import type { useResumeFiles } from "@/lib/use-resume-files";

type Props = {
  liveEnabled: boolean;
  jobDescription: string;
  onJobDescriptionChange: (value: string) => void;
  resumes: ReturnType<typeof useResumeFiles>;
  run: RunState;
  onRank: () => void;
  onCancel: () => void;
  onJumpToResults: () => void;
};

export function LiveInputs({ liveEnabled, jobDescription, onJobDescriptionChange, resumes, run, onRank, onCancel, onJumpToResults }: Props) {
  const { files, rejections, addFiles, removeFile, dismissRejections } = resumes;
  const running = run.status === "running";

  const jobReady = jobDescription.length >= JOB_DESCRIPTION_MIN_CHARS && jobDescription.length <= JOB_DESCRIPTION_MAX_CHARS;
  const parsing = files.filter((file) => file.status === "parsing").length;
  const failed = files.filter((file) => file.status === "error").length;
  const resumesReady = files.length >= 1 && files.length <= MAX_RESUMES && parsing === 0 && failed === 0;
  const canRank = jobReady && resumesReady && liveEnabled && !running;

  let resumeStatus = "Add at least one PDF resume.";
  if (parsing) resumeStatus = `Reading ${parsing} ${parsing === 1 ? "PDF" : "PDFs"}…`;
  else if (failed) resumeStatus = `Remove ${failed} ${failed === 1 ? "file" : "files"} that couldn't be read.`;
  else if (files.length) resumeStatus = `${files.length} ${files.length === 1 ? "resume" : "resumes"} ready.`;

  return (
    <div className="space-y-6">
      <JobDescriptionInput value={jobDescription} onChange={onJobDescriptionChange} />
      <ResumeUpload files={files} rejections={rejections} onAdd={addFiles} onRemove={removeFile} onDismissRejections={dismissRejections} />

      <div className="space-y-3 border-t border-stone-200 pt-5">
        <ul className="space-y-1 text-sm" aria-label="Ranking checklist">
          <ChecklistItem done={jobReady}>
            Job description: {jobReady ? "ready." : `${JOB_DESCRIPTION_MIN_CHARS}–${JOB_DESCRIPTION_MAX_CHARS.toLocaleString("en-US")} characters needed.`}
          </ChecklistItem>
          <ChecklistItem done={resumesReady}>Resumes: {resumeStatus}</ChecklistItem>
        </ul>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRank}
            disabled={!canRank}
            className="flex-1 rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-600 disabled:shadow-none"
          >
            {running ? "Ranking…" : "Rank"}
          </button>
          {running && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Cancel
            </button>
          )}
        </div>

        {liveEnabled ? (
          <p className="text-xs text-stone-600">
            {run.runsLeftToday === null
              ? "Up to 3 live rankings per day from your network."
              : `${run.runsLeftToday} live ${run.runsLeftToday === 1 ? "ranking" : "rankings"} left today from your network.`}{" "}
            Resets at 00:00 UTC.
          </p>
        ) : (
          <p className="text-sm text-stone-700">Live ranking isn&apos;t enabled on this deployment. Try the sample data to see how results look.</p>
        )}

        <p className="flex gap-2 text-xs leading-relaxed text-stone-600">
          <LockIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            PDFs stay in your browser. When you rank, the extracted text is sent for AI scoring and isn&apos;t stored.
          </span>
        </p>

        {run.status !== "idle" && (
          <button
            type="button"
            onClick={onJumpToResults}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-teal-700 px-4 py-2 text-sm font-medium text-teal-800 lg:hidden"
          >
            View results
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        )}
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
          done ? "bg-teal-700 text-white" : "border border-stone-400 text-transparent"
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
