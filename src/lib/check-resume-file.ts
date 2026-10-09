import { MAX_RESUME_BYTES } from "@/lib/limits";

export type ResumeFileKind = "pdf" | "docx";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Which reader to use, from the name or MIME type. The contents are checked
// when the file is read, whatever the name says.
export function resumeFileKind(file: { name: string; type: string }): ResumeFileKind | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
  return null;
}

// Checks a picked or dropped file before it is read. Returns the reason it
// can't be added, or null if it's fine.
export function checkResumeFile(file: { name: string; type: string; size: number }): string | null {
  if (!resumeFileKind(file)) {
    return file.name.toLowerCase().endsWith(".doc")
      ? "Older Word (.doc) files aren't supported. Save it as .docx or PDF, or paste the text."
      : "Unsupported file type. Only PDF and Word (.docx) files are accepted.";
  }
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_RESUME_BYTES) {
    return `The file is ${file.size.toLocaleString("en-US")} bytes. The limit is 5 MB (${MAX_RESUME_BYTES.toLocaleString("en-US")} bytes) per file.`;
  }
  return null;
}
