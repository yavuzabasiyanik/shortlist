import { describe, expect, it } from "vitest";
import { checkResumeFile, resumeFileKind } from "@/lib/check-resume-file";
import { MAX_RESUME_BYTES } from "@/lib/limits";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const pdf = (size: number, name = "cv.pdf", type = "application/pdf") => ({ name, type, size });

describe("checkResumeFile", () => {
  it("defines 5 MB as 5,242,880 bytes", () => {
    expect(MAX_RESUME_BYTES).toBe(5_242_880);
  });

  it("accepts a PDF or DOCX of exactly 5,242,880 bytes", () => {
    expect(checkResumeFile(pdf(5_242_880))).toBeNull();
    expect(checkResumeFile(pdf(5_242_880, "cv.docx", DOCX))).toBeNull();
  });

  it("rejects a file of 5,242,881 bytes and states both sizes", () => {
    const message = "The file is 5,242,881 bytes. The limit is 5 MB (5,242,880 bytes) per file.";
    expect(checkResumeFile(pdf(5_242_881))).toBe(message);
    expect(checkResumeFile(pdf(5_242_881, "cv.docx", DOCX))).toBe(message);
  });

  it("rejects empty files and unsupported types", () => {
    expect(checkResumeFile(pdf(0))).toBe("The file is empty.");
    expect(checkResumeFile(pdf(0, "cv.docx", DOCX))).toBe("The file is empty.");
    expect(checkResumeFile(pdf(10, "cv.txt", "text/plain"))).toBe("Unsupported file type. Only PDF and Word (.docx) files are accepted.");
    expect(checkResumeFile(pdf(10, "photo.png", "image/png"))).toBe("Unsupported file type. Only PDF and Word (.docx) files are accepted.");
    expect(checkResumeFile(pdf(10, "cv.doc", "application/msword"))).toBe(
      "Older Word (.doc) files aren't supported. Save it as .docx or PDF, or paste the text.",
    );
  });

  it("accepts a known extension with a missing MIME type, and a known MIME type with another name", () => {
    expect(checkResumeFile(pdf(10, "CV.PDF", ""))).toBeNull();
    expect(checkResumeFile(pdf(10, "cv", "application/pdf"))).toBeNull();
    expect(checkResumeFile(pdf(10, "CV.DOCX", ""))).toBeNull();
    expect(checkResumeFile(pdf(10, "cv", DOCX))).toBeNull();
  });

  it("picks the reader from the name or MIME type", () => {
    expect(resumeFileKind({ name: "a.pdf", type: "" })).toBe("pdf");
    expect(resumeFileKind({ name: "a.docx", type: "" })).toBe("docx");
    expect(resumeFileKind({ name: "a.doc", type: "" })).toBeNull();
  });
});
