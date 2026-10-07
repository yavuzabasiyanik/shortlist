import { MAX_RESUME_BYTES } from "@/lib/limits";

// Checks a picked or dropped file before it is read. Returns the reason it
// can't be added, or null if it's fine. The PDF's contents are checked later.
export function checkResumeFile(file: { name: string; type: string; size: number }): string | null {
  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) return "Only PDF files are accepted.";
  if (file.size === 0) return "The file is empty.";
  if (file.size > MAX_RESUME_BYTES) {
    return `The file is ${file.size.toLocaleString("en-US")} bytes. The limit is 5 MB (${MAX_RESUME_BYTES.toLocaleString("en-US")} bytes) per PDF.`;
  }
  return null;
}
