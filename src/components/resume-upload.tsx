"use client";

import { useEffect, useState } from "react";
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

  // A PDF dropped outside the drop zone would replace the page; block that.
  useEffect(() => {
    const block = (event: DragEvent) => event.preventDefault();
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  return (
    <div>
      <p className="text-sm font-medium" id="resumes-label">
        Resumes
      </p>
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
        className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-teal-700 ${
          dragging ? "border-teal-600 bg-teal-50" : "border-stone-300 bg-stone-50 hover:bg-stone-100"
        }`}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          aria-labelledby="resumes-label"
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) onAdd(event.target.files);
            event.target.value = ""; // allow re-adding the same file after removing it
          }}
        />
        <span className="text-sm font-medium text-stone-800">
          Drop PDFs here or <span className="text-teal-800 underline underline-offset-4">choose files</span>
        </span>
        <span className="mt-1 text-xs text-stone-500">
          1–{MAX_RESUMES} PDFs, up to 5 MB each. Text is read in your browser; files are never uploaded.
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
        <>
          <p className="mt-4 text-xs text-stone-500" aria-live="polite">
            {files.length} of {MAX_RESUMES} resumes
          </p>
          <ul className="mt-2 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {files.map((file) => (
              <li key={file.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-stone-800" title={file.name}>
                    {file.name}
                  </p>
                  <FileStatus file={file} />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  aria-label={`Remove ${file.name}`}
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function FileStatus({ file }: { file: ResumeFile }) {
  if (file.status === "parsing") {
    return <p className="mt-0.5 text-xs text-stone-500">Reading PDF…</p>;
  }
  if (file.status === "error") {
    return <p className="mt-0.5 text-xs text-red-700">{file.error}</p>;
  }
  return (
    <p className="mt-0.5 text-xs text-teal-800">
      Text extracted: {file.pageCount} {file.pageCount === 1 ? "page" : "pages"},{" "}
      {file.text.length.toLocaleString("en-US")} characters
    </p>
  );
}
