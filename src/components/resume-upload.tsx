"use client";

import { useState } from "react";
import { FileIcon, UploadIcon, XIcon } from "@/components/icons";
import { StepTitle } from "@/components/step-title";
import type { Rejection, ResumeFile } from "@/lib/use-resume-files";
import { MAX_RESUMES } from "@/lib/limits";

type Props = {
  files: ResumeFile[];
  rejections: Rejection[];
  onAdd: (files: FileList) => void;
  onRemove: (id: number) => void;
  onDismissRejections: () => void;
};

export function ResumeUpload({ files, rejections, onAdd, onRemove, onDismissRejections }: Props) {
  const [dragging, setDragging] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <StepTitle step={2} title="Resumes" id="resumes-label" />
        <span className="text-xs text-stone-600" aria-live="polite">
          {files.length > 0 ? `${files.length} of ${MAX_RESUMES}` : ""}
        </span>
      </div>
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onAdd(event.dataTransfer.files);
        }}
        className={`mt-2.5 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center motion-safe:transition-colors focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-teal-700 ${
          dragging ? "border-teal-600 bg-teal-50" : "border-stone-300 bg-stone-50 hover:border-teal-600 hover:bg-teal-50/50"
        }`}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          aria-labelledby="resumes-label"
          aria-describedby="resume-limits"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) onAdd(event.target.files);
            event.target.value = ""; // allow re-adding the same file after removing it
          }}
        />
        <UploadIcon className="h-5 w-5 text-stone-500" />
        <span className="mt-1.5 text-sm font-medium text-stone-800">
          Drop PDFs here or <span className="text-teal-800 underline underline-offset-4">choose files</span>
        </span>
        <span id="resume-limits" className="mt-1 text-xs text-stone-600">
          PDF only · 1–{MAX_RESUMES} files · 5 MB each
        </span>
      </label>

      {rejections.length > 0 && (
        <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">
              {rejections.length === 1 ? "1 file wasn't added:" : `${rejections.length} files weren't added:`}
            </p>
            <button
              type="button"
              onClick={onDismissRejections}
              className="text-xs font-medium underline underline-offset-4"
            >
              Dismiss
            </button>
          </div>
          <ul className="mt-1 space-y-0.5">
            {rejections.map((rejection, index) => (
              <li key={`${rejection.name}-${index}`} className="break-words">
                <span className="font-mono text-xs">{rejection.name}</span>: {rejection.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {files.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
          {files.map((file) => (
            <li key={file.id} className="flex items-start gap-2.5 px-3 py-2.5">
              <FileIcon className={`mt-0.5 h-4 w-4 shrink-0 ${file.status === "error" ? "text-red-700" : "text-stone-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-stone-800" title={file.name}>
                  {file.name}
                </p>
                <FileStatus file={file} />
              </div>
              <button
                type="button"
                onClick={() => onRemove(file.id)}
                aria-label={`Remove ${file.name}`}
                title="Remove"
                className="shrink-0 rounded-md p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-teal-700"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FileStatus({ file }: { file: ResumeFile }) {
  if (file.status === "parsing") {
    return <p className="mt-0.5 text-xs text-stone-600">Reading PDF…</p>;
  }
  if (file.status === "error") {
    return <p className="mt-0.5 text-xs text-red-700">{file.error}</p>;
  }
  return (
    <p className="mt-0.5 text-xs text-stone-600">
      Ready
      {file.hasImages && <span> · Has images; text inside them isn&apos;t read</span>}
    </p>
  );
}
