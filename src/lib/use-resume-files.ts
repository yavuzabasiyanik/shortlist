"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractPdfText } from "@/lib/extract-pdf-text";
import { MAX_RESUME_BYTES, MAX_RESUMES } from "@/lib/limits";

// Files and extracted text live only in this React state (browser memory).
export type ResumeFile = { id: number; name: string; size: number } & (
  | { status: "parsing" }
  | { status: "ready"; text: string; pageCount: number }
  | { status: "error"; error: string }
);

// A file that was never added to the list, and why.
export type Rejection = { name: string; reason: string };

function formatMB(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function whenAborted(signal: AbortSignal) {
  return new Promise<{ ok: false; error: string }>((resolve) =>
    signal.addEventListener("abort", () => resolve({ ok: false, error: "Cancelled." }), { once: true }),
  );
}

function isPdfName(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export function useResumeFiles() {
  const [files, setFiles] = useState<ResumeFile[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);

  const nextId = useRef(1);
  const controllers = useRef(new Map<number, AbortController>());
  // Parse one PDF at a time so 20 large files don't compete for the CPU.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    const pending = controllers.current;
    return () => pending.forEach((controller) => controller.abort());
  }, []);

  const parse = useCallback((id: number, file: File, signal: AbortSignal) => {
    queue.current = queue.current.then(async () => {
      if (signal.aborted) return;
      let result: Awaited<ReturnType<typeof extractPdfText>>;
      try {
        // Stop waiting as soon as the file is removed, so the queue moves on
        // even if pdfjs never settles after being cancelled.
        result = await Promise.race([extractPdfText(file, signal), whenAborted(signal)]);
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
            ? { id, name, size, status: "ready", text: result.text, pageCount: result.pageCount }
            : { id, name, size, status: "error", error: result.error };
        }),
      );
    });
  }, []);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const rejected: Rejection[] = [];
      const added: ResumeFile[] = [];

      for (const file of Array.from(incoming)) {
        const isDuplicate = files.some(
          (entry) => entry.name === file.name && entry.size === file.size,
        ) || added.some((entry) => entry.name === file.name && entry.size === file.size);

        let reason: string | null = null;
        if (!isPdfName(file)) reason = "Only PDF files are accepted.";
        else if (file.size === 0) reason = "The file is empty.";
        else if (file.size > MAX_RESUME_BYTES)
          reason = `The file is ${formatMB(file.size)}. The limit is 5 MB per PDF.`;
        else if (isDuplicate) reason = "This file is already in the list.";
        else if (files.length + added.length >= MAX_RESUMES)
          reason = `The limit is ${MAX_RESUMES} resumes per ranking.`;

        if (reason) {
          rejected.push({ name: file.name, reason });
          continue;
        }

        const id = nextId.current++;
        const controller = new AbortController();
        controllers.current.set(id, controller);
        added.push({ id, name: file.name, size: file.size, status: "parsing" });
        parse(id, file, controller.signal);
      }

      setRejections(rejected);
      if (added.length) setFiles((current) => [...current, ...added]);
    },
    [files, parse],
  );

  const removeFile = useCallback((id: number) => {
    controllers.current.get(id)?.abort();
    controllers.current.delete(id);
    setFiles((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const dismissRejections = useCallback(() => setRejections([]), []);

  return { files, rejections, addFiles, removeFile, dismissRejections };
}
