import { describe, expect, it } from "vitest";
import { checkResumeFile } from "@/lib/check-resume-file";
import { MAX_RESUME_BYTES } from "@/lib/limits";

const pdf = (size: number, name = "cv.pdf", type = "application/pdf") => ({ name, type, size });

describe("checkResumeFile", () => {
  it("defines 5 MB as 5,242,880 bytes", () => {
    expect(MAX_RESUME_BYTES).toBe(5_242_880);
  });

  it("accepts a PDF of exactly 5,242,880 bytes", () => {
    expect(checkResumeFile(pdf(5_242_880))).toBeNull();
  });

  it("rejects a PDF of 5,242,881 bytes and states both sizes", () => {
    expect(checkResumeFile(pdf(5_242_881))).toBe(
      "The file is 5,242,881 bytes. The limit is 5 MB (5,242,880 bytes) per PDF.",
    );
  });

  it("rejects empty files and non-PDFs", () => {
    expect(checkResumeFile(pdf(0))).toBe("The file is empty.");
    expect(checkResumeFile(pdf(10, "cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBe("Only PDF files are accepted.");
  });

  it("accepts a .pdf name with a missing MIME type, and a PDF MIME type with another name", () => {
    expect(checkResumeFile(pdf(10, "CV.PDF", ""))).toBeNull();
    expect(checkResumeFile(pdf(10, "cv", "application/pdf"))).toBeNull();
  });
});
