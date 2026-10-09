// Extracts text from a Word .docx entirely in the browser. A .docx is a ZIP
// archive of XML parts; this reads the ZIP directory, inflates the parts it
// needs with the built-in DecompressionStream, and pulls out the text runs.
// No dependencies. The file's bytes and text stay in memory; nothing is
// uploaded or logged.

import type { ExtractResult } from "@/lib/extract-pdf-text";
import { MAX_RESUME_TEXT_CHARS } from "@/lib/limits";

// Inflated size allowed for one XML part. A 5 MB .docx with this much text
// would be far over the per-resume character limit anyway; this stops a
// small file from inflating into gigabytes ("zip bomb").
const MAX_PART_BYTES = 20 * 1024 * 1024;

class DocxError extends Error {}

type Entry = { name: string; method: number; compressedSize: number; size: number; localOffset: number };

// Reads the ZIP central directory (the authoritative list of entries).
function readEntries(bytes: Uint8Array<ArrayBuffer>): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end-of-central-directory record is in the last 22 + 65,535 bytes.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new DocxError("damaged");

  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: Entry[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) throw new DocxError("damaged");
    const nameLength = view.getUint16(offset + 28, true);
    entries.push({
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      size: view.getUint32(offset + 24, true),
      localOffset: view.getUint32(offset + 42, true),
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
    });
    offset += 46 + nameLength + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  return entries;
}

async function readPart(bytes: Uint8Array<ArrayBuffer>, entry: Entry): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localOffset;
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) throw new DocxError("damaged");
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.size > MAX_PART_BYTES) throw new DocxError("too_large");

  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new DocxError("damaged");

  // Count while inflating: the declared size can't be trusted.
  const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PART_BYTES) {
      await reader.cancel();
      throw new DocxError("too_large");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
}

const ENTITIES: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (match, name: string) => {
    if (name[0] !== "#") return ENTITIES[name.toLowerCase()] ?? match;
    const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    try {
      return String.fromCodePoint(code);
    } catch {
      return "";
    }
  });
}

// Turns WordprocessingML into plain text: text runs (<w:t>), tabs, line
// breaks, and paragraph ends. Deleted text (<w:delText>) and field codes
// (<w:instrText>) aren't <w:t>, so they're skipped. Text boxes are stored
// twice (a modern copy and an <mc:Fallback> copy); the fallback is skipped.
export function documentXmlToText(xml: string): string {
  let out = "";
  let inText = false;
  let fallbackDepth = 0;
  for (const [, slash, tag, selfClosing, text] of xml.matchAll(/<(\/?)([A-Za-z][\w.:-]*)\b[^>]*?(\/?)>|([^<]+)/g)) {
    if (text !== undefined) {
      if (inText && fallbackDepth === 0) out += decodeEntities(text);
      continue;
    }
    if (tag === "mc:Fallback") {
      if (slash) fallbackDepth = Math.max(0, fallbackDepth - 1);
      else if (!selfClosing) fallbackDepth++;
      continue;
    }
    if (fallbackDepth > 0) continue;
    if (tag === "w:t") inText = !slash && !selfClosing;
    else if (tag === "w:tab" && !slash) out += "\t";
    else if ((tag === "w:br" || tag === "w:cr") && !slash) out += "\n";
    else if (tag === "w:noBreakHyphen" && !slash) out += "-";
    else if (tag === "w:p" && (slash || selfClosing)) out += "\n";
  }
  return out;
}

export async function extractDocxText(file: File, signal: AbortSignal): Promise<ExtractResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (signal.aborted) return { ok: false, error: "Cancelled." };

  // Password-protected .docx files and old .doc files are both OLE
  // compound files, not ZIPs.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return {
      ok: false,
      error: "This file is password-protected or in the older Word (.doc) format. Save it as a .docx without a password and try again.",
    };
  }
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
    return { ok: false, error: "This file is not a valid DOCX." };
  }

  try {
    const entries = readEntries(bytes);
    const body = entries.find((entry) => entry.name === "word/document.xml");
    if (!body) return { ok: false, error: "This file is not a Word document. Only PDF and .docx resumes are accepted." };

    // Headers often hold the candidate's name and contact line. Pages can
    // repeat the same header, so identical ones are kept once.
    const headerEntries = entries
      .filter((entry) => /^word\/header\d*\.xml$/.test(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
    const headers = new Set<string>();
    for (const entry of headerEntries) {
      const text = documentXmlToText(await readPart(bytes, entry)).trim();
      if (text) headers.add(text);
      if (signal.aborted) return { ok: false, error: "Cancelled." };
    }
    const bodyText = documentXmlToText(await readPart(bytes, body));
    if (signal.aborted) return { ok: false, error: "Cancelled." };

    const hasImages = entries.some((entry) => entry.name.startsWith("word/media/"));
    const text = [...headers, bodyText]
      .join("\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text) {
      return {
        ok: false,
        error: hasImages
          ? "No text found. This DOCX seems to contain only images, and OCR isn't supported."
          : "This DOCX has no text. It appears to be empty.",
      };
    }
    if (text.length > MAX_RESUME_TEXT_CHARS) {
      return {
        ok: false,
        error: `Extracted text is ${text.length.toLocaleString("en-US")} characters, over the ${MAX_RESUME_TEXT_CHARS.toLocaleString("en-US")}-character limit per resume.`,
      };
    }
    return { ok: true, text, pageCount: 0, hasImages };
  } catch (error) {
    if (signal.aborted) return { ok: false, error: "Cancelled." };
    if (error instanceof DocxError && error.message === "too_large") {
      return { ok: false, error: "This DOCX couldn't be read: its contents are too large." };
    }
    return { ok: false, error: "This DOCX couldn't be read. It may be damaged." };
  }
}
