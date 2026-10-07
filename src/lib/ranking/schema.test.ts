import { describe, expect, it } from "vitest";
import { sampleResults } from "@/data/sample";
import { ModelOutputSchema, RankRequestSchema, ScoreResultSchema } from "@/lib/ranking/schema";

const job = "J".repeat(150);
const resume = (id: string, overrides = {}) => ({ id, fileName: `${id}.pdf`, text: "React and TypeScript.", ...overrides });
const request = (overrides = {}) => ({ jobDescription: job, resumes: [resume("r1")], ...overrides });
const valid = (body: unknown) => RankRequestSchema.safeParse(body).success;

describe("RankRequestSchema", () => {
  it("accepts a normal request", () => {
    expect(valid(request())).toBe(true);
  });

  it.each([
    [99, false],
    [100, true],
    [10_000, true],
    [10_001, false],
  ])("job description of %i characters → valid=%s", (length, expected) => {
    expect(valid(request({ jobDescription: "a".repeat(length) }))).toBe(expected);
  });

  it.each([
    [0, false],
    [1, true],
    [20, true],
    [21, false],
  ])("%i resumes → valid=%s", (count, expected) => {
    const resumes = Array.from({ length: count }, (_, i) => resume(`r${i}`));
    expect(valid(request({ resumes }))).toBe(expected);
  });

  it("rejects duplicate ids and points at the second one", () => {
    const result = RankRequestSchema.safeParse(request({ resumes: [resume("same"), resume("same")] }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["resumes", 1, "id"], message: "Duplicate resume id." });
  });

  it("allows identical file names and text when ids differ", () => {
    const twin = { fileName: "resume.pdf", text: "Same text." };
    expect(valid(request({ resumes: [resume("a", twin), resume("b", twin)] }))).toBe(true);
  });

  it.each([
    ["empty text", { text: "" }],
    ["whitespace-only text", { text: " \n\t " }],
    ["text over 30,000 characters", { text: "x".repeat(30_001) }],
    ["empty file name", { fileName: "" }],
    ["file name over 255 characters", { fileName: "f".repeat(256) }],
    ["file name with a control character", { fileName: "a\u0000b.pdf" }],
    ["empty id", { id: "" }],
    ["id over 64 characters", { id: "i".repeat(65) }],
    ["id with other characters", { id: "../etc" }],
    ["extra field", { extra: true }],
  ])("rejects %s", (_, overrides) => {
    expect(valid(request({ resumes: [resume("r1", overrides)] }))).toBe(false);
  });

  it("accepts text of exactly 30,000 characters, a 255-character name, and a 64-character id", () => {
    expect(valid(request({ resumes: [resume("i".repeat(64), { text: "x".repeat(30_000), fileName: "f".repeat(255) })] }))).toBe(true);
  });

  it("rejects a client-supplied date (the server sets it)", () => {
    expect(valid({ ...request(), today: "1999-01-01" })).toBe(false);
  });

  it("rejects missing fields and wrong types", () => {
    expect(valid({ resumes: [resume("r1")] })).toBe(false);
    expect(valid(request({ resumes: "nope" }))).toBe(false);
    expect(valid(request({ jobDescription: 12345 }))).toBe(false);
  });
});

describe("result schemas", () => {
  const output = {
    candidateName: "Ada",
    score: 80,
    strengths: ["a", "b", "c"],
    gaps: ["d", "e"],
    explanation: "First sentence. Second sentence.",
  };

  it("accepts a well-formed model output", () => {
    expect(ModelOutputSchema.safeParse(output).success).toBe(true);
  });

  it.each([
    ["two strengths", { strengths: ["a", "b"] }],
    ["four strengths", { strengths: ["a", "b", "c", "d"] }],
    ["one gap", { gaps: ["d"] }],
    ["three gaps", { gaps: ["d", "e", "f"] }],
    ["an empty strength", { strengths: ["a", " ", "c"] }],
    ["score 101", { score: 101 }],
    ["score -1", { score: -1 }],
    ["score 72.5", { score: 72.5 }],
    ["score as a string", { score: "80" }],
    ["one-sentence explanation", { explanation: "Only one sentence." }],
    ["four-sentence explanation", { explanation: "One. Two. Three. Four." }],
    ["missing explanation", { explanation: undefined }],
    ["an extra key", { notes: "x" }],
  ])("rejects %s", (_, overrides) => {
    expect(ModelOutputSchema.safeParse({ ...output, ...overrides }).success).toBe(false);
  });

  it("every bundled sample result matches the schema", () => {
    for (const { fileName, ...result } of sampleResults) {
      expect(fileName).toMatch(/\.pdf$/);
      expect(ScoreResultSchema.safeParse(result).success).toBe(true);
    }
  });
});
