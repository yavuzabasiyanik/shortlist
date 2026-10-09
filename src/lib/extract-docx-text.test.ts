import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { documentXmlToText, extractDocxText } from "@/lib/extract-docx-text";

// Builds a ZIP the way Word does: local headers, data, central directory.
// `size` overrides the declared uncompressed size (to test lying headers).
type Part = { name: string; content: string | Buffer; stored?: boolean; size?: number };

function zip(parts: Part[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const part of parts) {
    const raw = typeof part.content === "string" ? Buffer.from(part.content) : part.content;
    const data = part.stored ? raw : deflateRawSync(raw);
    const name = Buffer.from(part.name);
    const method = part.stored ? 0 : 8;
    const size = part.size ?? raw.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const doc = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${W}><w:body>${body}</w:body></w:document>`;
const p = (...runs: string[]) => `<w:p>${runs.map((t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`).join("")}</w:p>`;
const header = (text: string) => `<w:hdr ${W}>${p(text)}</w:hdr>`;

const file = (bytes: Buffer, name = "cv.docx") => new File([new Uint8Array(bytes)], name);
const extract = (bytes: Buffer) => extractDocxText(file(bytes), new AbortController().signal);
const docx = (body: string, extra: Part[] = []) => zip([{ name: "[Content_Types].xml", content: "<Types/>" }, { name: "word/document.xml", content: doc(body) }, ...extra]);

describe("documentXmlToText", () => {
  it("keeps paragraphs, tabs, and line breaks, and decodes entities", () => {
    const xml = doc(
      `${p("Ada Lovelace")}<w:p><w:r><w:t>React</w:t><w:tab/><w:t>2019</w:t><w:br/><w:t>A &amp; B &lt;C&gt; &quot;D&quot; &#233; &#x4E16;</w:t></w:r></w:p>`,
    );
    expect(documentXmlToText(xml)).toBe('Ada Lovelace\nReact\t2019\nA & B <C> "D" é 世\n');
  });

  it("joins runs split mid-word and reads table cells", () => {
    const xml = doc(`<w:p><w:r><w:t>Type</w:t></w:r><w:r><w:t>Script</w:t></w:r></w:p><w:tbl><w:tr><w:tc>${p("Skills")}</w:tc><w:tc>${p("Jest")}</w:tc></w:tr></w:tbl>`);
    expect(documentXmlToText(xml)).toBe("TypeScript\nSkills\nJest\n");
  });

  it("skips deleted text, field codes, and the duplicate fallback copy of text boxes", () => {
    const xml = doc(
      `<w:p><w:r><w:delText>removed</w:delText></w:r><w:r><w:instrText>HYPERLINK "x"</w:instrText></w:r><w:r><w:t>kept</w:t></w:r></w:p>` +
        `<mc:AlternateContent><mc:Choice Requires="wps">${p("Box text")}</mc:Choice><mc:Fallback>${p("Box text")}</mc:Fallback></mc:AlternateContent>`,
    );
    expect(documentXmlToText(xml)).toBe("kept\nBox text\n");
  });
});

describe("extractDocxText", () => {
  it("extracts text from a valid DOCX, with the header first and repeated headers once", async () => {
    const bytes = docx(p("Experience") + p("Senior Engineer, 2021–present"), [
      { name: "word/header1.xml", content: header("Ada Lovelace · ada@example.com") },
      { name: "word/header2.xml", content: header("Ada Lovelace · ada@example.com") },
      { name: "word/footer1.xml", content: header("Page 1") },
    ]);
    expect(await extract(bytes)).toEqual({
      ok: true,
      text: "Ada Lovelace · ada@example.com\n\nExperience\nSenior Engineer, 2021–present",
      pageCount: 0,
      hasImages: false,
    });
  });

  it("reads stored (uncompressed) parts", async () => {
    const bytes = zip([{ name: "word/document.xml", content: doc(p("Stored text")), stored: true }]);
    expect(await extract(bytes)).toMatchObject({ ok: true, text: "Stored text" });
  });

  it("flags images, since their text isn't read (no OCR)", async () => {
    const bytes = docx(p("Ada"), [{ name: "word/media/image1.png", content: Buffer.from([137, 80, 78, 71]) }]);
    expect(await extract(bytes)).toMatchObject({ ok: true, text: "Ada", hasImages: true });
  });

  it.each([
    ["an empty document", docx(""), "This DOCX has no text. It appears to be empty."],
    ["only whitespace", docx(p("   ") + p("\t")), "This DOCX has no text. It appears to be empty."],
    [
      "only images",
      docx("<w:p><w:r><w:drawing/></w:r></w:p>", [{ name: "word/media/image1.png", content: Buffer.from([1]) }]),
      "No text found. This DOCX seems to contain only images, and OCR isn't supported.",
    ],
    ["a renamed text file", Buffer.from("Ada Lovelace, engineer"), "This file is not a valid DOCX."],
    ["a renamed PDF", Buffer.from("%PDF-1.7\n..."), "This file is not a valid DOCX."],
    [
      "a password-protected DOCX or old .doc (OLE file)",
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]),
      "This file is password-protected or in the older Word (.doc) format. Save it as a .docx without a password and try again.",
    ],
    [
      "a ZIP that isn't a Word document (e.g. a renamed .xlsx)",
      zip([{ name: "xl/workbook.xml", content: "<workbook/>" }]),
      "This file is not a Word document. Only PDF and .docx resumes are accepted.",
    ],
    ["a truncated DOCX", docx(p("Ada")).subarray(0, 40), "This DOCX couldn't be read. It may be damaged."],
  ])("explains %s", async (_, bytes, error) => {
    expect(await extract(bytes)).toEqual({ ok: false, error });
  });

  it("rejects a corrupted compressed part", async () => {
    const bytes = docx(p("Ada Lovelace ".repeat(50)));
    const at = bytes.indexOf("word/document.xml") + "word/document.xml".length;
    bytes.fill(0xff, at, at + 20);
    expect(await extract(bytes)).toEqual({ ok: false, error: "This DOCX couldn't be read. It may be damaged." });
  });

  it("rejects text over the 30,000-character limit instead of truncating it", async () => {
    expect(await extract(docx(p("a".repeat(30_001))))).toEqual({
      ok: false,
      error: "Extracted text is 30,001 characters, over the 30,000-character limit per resume.",
    });
    expect(await extract(docx(p("a".repeat(30_000))))).toMatchObject({ ok: true });
  });

  it("stops inflating a part that expands past 20 MB, even when its header claims less", async () => {
    const bomb = Buffer.alloc(21 * 1024 * 1024, 0x20); // compresses to ~20 KB
    const message = "This DOCX couldn't be read: its contents are too large.";
    expect(await extract(zip([{ name: "word/document.xml", content: bomb, size: 100 }]))).toEqual({ ok: false, error: message });
    expect(await extract(zip([{ name: "word/document.xml", content: bomb }]))).toEqual({ ok: false, error: message });
  });

  it("returns Cancelled when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await extractDocxText(file(docx(p("Ada"))), controller.signal)).toEqual({ ok: false, error: "Cancelled." });
  });
});
