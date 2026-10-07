// Extracts text from a PDF entirely in the browser with pdfjs-dist.
// The file's bytes and text stay in memory; nothing is uploaded or logged.

import { MAX_RESUME_TEXT_CHARS } from "@/lib/limits";

export type ExtractResult =
  | { ok: true; text: string; pageCount: number }
  | { ok: false; error: string };

// pdfjs touches browser-only APIs when imported, so load it on first use.
async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs;
}

// Drawing operators that mean a page contains an image (e.g. a scan).
const IMAGE_OPS = ["paintImageXObject", "paintInlineImageXObject", "paintImageMaskXObject"] as const;

export async function extractPdfText(
  file: File,
  signal: AbortSignal,
): Promise<ExtractResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal.aborted) return { ok: false, error: "Cancelled." };

  // A real PDF starts with "%PDF-", whatever its name or MIME type says.
  if (new TextDecoder().decode(bytes.subarray(0, 1024)).indexOf("%PDF-") === -1) {
    return { ok: false, error: "This file is not a valid PDF." };
  }

  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({
    data: bytes,
    useWasm: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });
  const cancel = () => void task.destroy();
  signal.addEventListener("abort", cancel);

  try {
    const pdf = await task.promise;
    const pages: string[] = [];
    let hasImages = false;

    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
        .join("");
      pages.push(pageText);

      if (!hasImages && !pageText.trim()) {
        const ops = await page.getOperatorList();
        const imageOps = IMAGE_OPS.map((name) => pdfjs.OPS[name]);
        hasImages = ops.fnArray.some((fn) => imageOps.includes(fn));
      }
    }

    const text = pages
      .join("\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      return {
        ok: false,
        error: hasImages
          ? "No selectable text found. This looks like a scanned or image-only PDF, and OCR isn't supported."
          : "This PDF has no text. It appears to be empty.",
      };
    }
    if (text.length > MAX_RESUME_TEXT_CHARS) {
      return {
        ok: false,
        error: `Extracted text is ${text.length.toLocaleString("en-US")} characters, over the ${MAX_RESUME_TEXT_CHARS.toLocaleString("en-US")}-character limit per resume.`,
      };
    }
    return { ok: true, text, pageCount: pdf.numPages };
  } catch (error) {
    if (signal.aborted) return { ok: false, error: "Cancelled." };
    if (error instanceof pdfjs.PasswordException) {
      return { ok: false, error: "This PDF is password-protected. Remove the password and try again." };
    }
    return { ok: false, error: "This PDF couldn't be read. It may be damaged." };
  } finally {
    signal.removeEventListener("abort", cancel);
    void task.destroy();
  }
}
