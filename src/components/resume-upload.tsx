"use client";

import { useState } from "react";
import { FileIcon, InfoIcon, TextIcon, UploadIcon, XIcon } from "@/components/icons";
import { StepTitle } from "@/components/step-title";
import type { Rejection, ResumeFile } from "@/lib/use-resume-files";
import { MAX_RESUME_TEXT_CHARS, MAX_RESUMES } from "@/lib/limits";
import { IMAGES_NOTICE } from "@/lib/notices";

export type InputMethod = "pdf" | "text";
export type PasteDraft = { label: string; text: string };

type Props = {
  files: ResumeFile[];
  rejections: Rejection[];
  onAdd: (files: FileList) => void;
  onAddText: (label: string, text: string) => string | null;
  onRemove: (id: number) => void;
  onDismissRejections: () => void;
  // Kept by the workspace so switching tabs or modes never loses a draft.
  method: InputMethod;
  onMethodChange: (method: InputMethod) => void;
  draft: PasteDraft;
  onDraftChange: (draft: PasteDraft) => void;
};

export function ResumeUpload({ files, rejections, onAdd, onAddText, onRemove, onDismissRejections, method, onMethodChange, draft, onDraftChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const draftLength = draft.text.trim().length;
  const draftTooLong = draftLength > MAX_RESUME_TEXT_CHARS;

  const addPasted = () => {
    const error = onAddText(draft.label, draft.text);
    setPasteError(error);
    if (!error) onDraftChange({ label: "", text: "" });
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <StepTitle step={2} title="Resumes" id="resumes-label" />
        <span className="text-xs text-stone-600" aria-live="polite">
          {files.length > 0 ? `${files.length} of ${MAX_RESUMES}` : ""}
        </span>
      </div>

      <div role="group" aria-label="How to add resumes" className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 text-sm font-medium">
        {(
          [
            ["pdf", "Upload files"],
            ["text", "Paste text"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={method === value}
            onClick={() => onMethodChange(value)}
            className={`rounded-md px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-700 ${
              method === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {method === "pdf" ? (
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
            accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
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
            Drop PDF or Word files here or <span className="text-teal-800 underline underline-offset-4">choose files</span>
          </span>
          <span id="resume-limits" className="mt-1 text-xs text-stone-600">
            PDF or DOCX · 5 MB each · up to {MAX_RESUMES} resumes in total
          </span>
        </label>
      ) : (
        <div className="mt-2.5 space-y-2">
          <label htmlFor="paste-label" className="sr-only">
            Candidate label (optional)
          </label>
          <input
            id="paste-label"
            value={draft.label}
            onChange={(event) => onDraftChange({ ...draft, label: event.target.value })}
            placeholder="Label, e.g. the candidate's name (optional)"
            className="block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-2 focus:outline-offset-1 focus:outline-teal-700"
          />
          <label htmlFor="paste-text" className="sr-only">
            Resume text
          </label>
          <textarea
            id="paste-text"
            value={draft.text}
            onChange={(event) => {
              onDraftChange({ ...draft, text: event.target.value });
              setPasteError(null);
            }}
            rows={6}
            placeholder="Paste one candidate's full resume text."
            aria-describedby="paste-count paste-error"
            aria-invalid={draftTooLong}
            className={`block w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm leading-relaxed text-stone-900 placeholder:text-stone-500 focus:outline-2 focus:outline-offset-1 focus:outline-teal-700 ${
              draftTooLong ? "border-red-600" : "border-stone-300"
            }`}
          />
          <div className="flex items-center justify-between gap-3">
            <p id="paste-count" className={`text-xs tabular-nums ${draftTooLong ? "font-medium text-red-700" : "text-stone-600"}`}>
              {draftLength.toLocaleString("en-US")} / {MAX_RESUME_TEXT_CHARS.toLocaleString("en-US")}
            </p>
            <button
              type="button"
              onClick={addPasted}
              disabled={draftLength === 0}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:text-stone-500"
            >
              Add resume
            </button>
          </div>
          <p id="paste-error" role={pasteError ? "alert" : undefined} className="text-xs text-red-700">
            {pasteError ?? (draftTooLong ? `Over the ${MAX_RESUME_TEXT_CHARS.toLocaleString("en-US")}-character limit. Shorten the text to add it.` : "")}
          </p>
        </div>
      )}

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
        <ul className="mt-3 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white" aria-label="Added resumes">
          {files.map((file) => (
            <li key={file.id} className="flex items-start gap-2.5 px-3 py-2.5">
              {file.source === "text" ? (
                <TextIcon className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" />
              ) : (
                <FileIcon className={`mt-0.5 h-4 w-4 shrink-0 ${file.status === "error" ? "text-red-700" : "text-stone-500"}`} />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-stone-800" title={file.name}>
                  {file.name}
                </p>
                <FileStatus file={file} onPasteInstead={() => onMethodChange("text")} />
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

function FileStatus({ file, onPasteInstead }: { file: ResumeFile; onPasteInstead: () => void }) {
  if (file.status === "parsing") {
    return <p className="mt-0.5 text-xs text-stone-600">Reading {file.source === "docx" ? "DOCX" : "PDF"}…</p>;
  }
  if (file.status === "error") {
    return <p className="mt-0.5 text-xs text-red-700">{file.error}</p>;
  }
  if (file.source === "text") {
    return <p className="mt-0.5 text-xs text-stone-600">Ready · Pasted text, {file.text.length.toLocaleString("en-US")} characters</p>;
  }
  return (
    <>
      <p className="mt-0.5 text-xs text-stone-600">Ready</p>
      {file.hasImages && (
        <div className="mt-1.5 flex gap-1.5 rounded-md bg-stone-100 px-2 py-1.5 text-xs leading-snug text-stone-700">
          <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0 text-stone-500" />
          <p>
            {IMAGES_NOTICE}{" "}
            <button type="button" onClick={onPasteInstead} className="font-medium text-teal-800 underline underline-offset-2 hover:text-teal-900">
              Paste text instead
            </button>
          </p>
        </div>
      )}
    </>
  );
}
