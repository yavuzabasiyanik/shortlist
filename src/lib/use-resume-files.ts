"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractDocxText } from "@/lib/extract-docx-text";
import { extractPdfText, type ExtractResult } from "@/lib/extract-pdf-text";
import { checkResumeFile, resumeFileKind, type ResumeFileKind } from "@/lib/check-resume-file";
import { MAX_FILE_NAME_CHARS, MAX_RESUME_TEXT_CHARS, MAX_RESUMES } from "@/lib/limits";

// Uploaded files (PDF, DOCX) and pasted resumes share one list (and the
// 50-resume limit). Files and text live only in this React state (browser memory).
export type ResumeFile = { id: number; name: string; size: number; source: ResumeFileKind | "text" } & (
  | { status: "parsing" }
  | { status: "ready"; text: string; pageCount: number; hasImages: boolean }
  | { status: "error"; error: string }
);

// A file that was never added to the list, and why.
export type Rejection = { name: string; reason: string };

function whenAborted(signal: AbortSignal) {
  return new Promise<{ ok: false; error: string }>((resolve) =>
    signal.addEventListener("abort", () => resolve({ ok: false, error: "Cancelled." }), { once: true }),
  );
}

export function useResumeFiles() {
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);

  const nextId = useRef(1);
  const controllers = useRef(new Map<number, AbortController>());
  // Read one file at a time so 50 large files don't compete for the CPU.
  // Each file gets its own result, so one bad file never stops the rest.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const pending = controllers.current;
    return () => pending.forEach((controller) => controller.abort());
  }, []);

  const parse = useCallback((id: number, file: File, source: ResumeFileKind, signal: AbortSignal) => {
    const extract = source === "docx" ? extractDocxText : extractPdfText;
    queue.current = queue.current.then(async () => {
      if (signal.aborted) return;
      let result: ExtractResult;
      try {
        // Stop waiting as soon as the file is removed, so the queue moves on
        // even if pdfjs never settles after being cancelled.
        result = await Promise.race([extract(file, signal), whenAborted(signal)]);
      } catch {
        result = { ok: false, error: "This file couldn't be read." };
      }
      controllers.current.delete(id);
      // If the file was removed while parsing, drop the late result.
      if (signal.aborted) return;
      setFiles((current) =>
        current.map((entry) => {
          if (entry.id !== id) return entry;
          const { name, size } = entry;
          return result.ok
            ? { id, name, size, source, status: "ready", text: result.text, pageCount: result.pageCount, hasImages: result.hasImages }
            : { id, name, size, source, status: "error", error: result.error };
        }),
      );
    });
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const rejected: Rejection[] = [];
      const added: ResumeFile[] = [];

      // Every accepted file gets its own id, even if another file has the
      // same name and size: they may be different resumes.
      for (const file of Array.from(incoming)) {
        let reason = checkResumeFile(file);
        if (!reason && files.length + added.length >= MAX_RESUMES)
          reason = `The limit is ${MAX_RESUMES} resumes per ranking.`;

        if (reason) {
          rejected.push({ name: file.name, reason });
          continue;
        }

        const source = resumeFileKind(file) ?? "pdf"; // checkResumeFile accepted it
        const id = nextId.current++;
        const controller = new AbortController();
        controllers.current.set(id, controller);
        added.push({ id, name: file.name, size: file.size, source, status: "parsing" });
        parse(id, file, source, controller.signal);
      }

      setRejections(rejected);
      if (added.length) setFiles((current) => [...current, ...added]);
    },
    [files, parse],
  );

  const pastedCount = useRef(0);

  // Adds pasted resume text. Returns why it can't be added, or null.
  const addText = useCallback(
    (label: string, text: string): string | null => {
      const body = text.trim();
      if (!body) return "Paste the resume text first.";
      if (body.length > MAX_RESUME_TEXT_CHARS) {
        return `This text is ${body.length.toLocaleString("en-US")} characters. The limit is ${MAX_RESUME_TEXT_CHARS.toLocaleString("en-US")} per resume.`;
      }
      if (files.length >= MAX_RESUMES) return `The limit is ${MAX_RESUMES} resumes per ranking.`;
      // The label is sent as the file name: no control characters, at most 255 characters.
      const cleaned = [...label]
        .map((char) => (char < " " || char === "\x7f" ? " " : char))
        .join("")
        .trim()
        .slice(0, MAX_FILE_NAME_CHARS);
      pastedCount.current += 1;
      const name = cleaned || `Pasted resume ${pastedCount.current}`;
      const id = nextId.current++;
      setFiles((current) => [
        ...current,
        { id, name, size: body.length, source: "text", status: "ready", text: body, pageCount: 0, hasImages: false },
      ]);
      return null;
    },
    [files.length],
  );

  const removeFile = useCallback((id: number) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }, []);

  // With up to 50 files, removing unreadable ones one by one is tedious.
  const removeFailed = useCallback(() => {
    setFiles((current) => current.filter((entry) => entry.status !== "error"));
  }, []);

  const dismissRejections = useCallback(() => setRejections([]), []);

  return { files, rejections, addFiles, addText, removeFile, removeFailed, dismissRejections };
}
