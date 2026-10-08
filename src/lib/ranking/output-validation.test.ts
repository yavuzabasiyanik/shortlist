import { describe, expect, it, vi } from "vitest";
import type { Logger } from "@/lib/ranking/log";
import { ModelOutputSchema } from "@/lib/ranking/schema";
import { scoreResume, type Scorer } from "@/lib/ranking/score";

const output = (explanation: string, overrides: object = {}) => ({
  candidateName: "Jordan Example",
  score: 48,
  strengths: ["React and Node.js projects", "Cut load times from 4.2 to 1.8 seconds", "Teaching assistant since 2025"],
  gaps: ["4+ years of React is not evidenced in the resume", "Data visualization is not evidenced in the resume"],
  explanation,
  ...overrides,
});
const valid = (explanation: string) => ModelOutputSchema.safeParse(output(explanation)).success;

describe("explanation sentence count", () => {
  it.each([
    ["e.g.", "Jordan shows several relevant skills, e.g. React and Node.js. The dated roles start in 2025. Missing must-haves cap the score at 60."],
    ["B.S.", "Jordan is pursuing a B.S. in Computer Science. React work is documented since 2025. Missing must-haves cap the score at 60."],
    ["etc.", "Projects use React, Node.js, SQLite, etc. across three apps. The dated roles start in 2025. Missing must-haves cap the score at 60."],
    ["vs.", "The resume shows internship vs. senior-level scope. React work is documented since 2025. Missing must-haves cap the score at 60."],
    ["U.S.", "The roles are U.S. based. React work is documented since 2025. Missing must-haves cap the score at 60."],
    ["Jan.", "The internship began in Jan. 2026 at ThreadLine. React work is documented since 2025. Missing must-haves cap the score at 60."],
    ["approx.", "Jordan has approx. one year of React. Node.js appears in two projects. Missing must-haves cap the score at 60."],
  ])("accepts three real sentences containing %s", (_, explanation) => {
    expect(valid(explanation)).toBe(true);
  });

  it.each([
    ["Node.js", "Jordan built React and Node.js apps. Testing is evidenced."],
    ["decimals", "Load times fell from 4.2 to 1.8 seconds. Testing is evidenced."],
    ["a GPA", "The GPA is 3.7/4.0 in 2030. Testing is evidenced."],
    ["an abbreviation ending the text", "React work is documented since 2025. The roles are in the U.S."],
  ])("counts sentences with %s correctly (2)", (_, explanation) => {
    expect(valid(explanation)).toBe(true);
  });

  it.each([
    ["one sentence", "Jordan is a reasonable fit for the role."],
    ["one sentence with an abbreviation", "Jordan has skills, e.g. React."],
    ["four sentences", "One. Two. Three. Four."],
    ["four sentences with an abbreviation", "Jordan has a B.S. degree. Two. Three. Four."],
  ])("still rejects %s", (_, explanation) => {
    expect(valid(explanation)).toBe(false);
  });
});

describe("invalid-output diagnostics", () => {
  const MARK = "SECRETMARKER4417";
  const run = async (raw: string) => {
    const log = vi.fn<Logger>();
    const scorer: Scorer = async () => raw;
    const outcome = await scoreResume(scorer, "Job ".repeat(30), { id: "r1", fileName: `${MARK}.pdf`, text: `${MARK} text` }, new AbortController().signal, "2026-10-08", log);
    return { outcome, log };
  };

  it("logs the failing field, rule, and lengths only", async () => {
    const bad = output(`${MARK} one. ${MARK} two.`, {
      strengths: [`${MARK} a`, "b", "c", "d"],
      gaps: [`${MARK} g`],
      score: 140,
    });
    const { outcome, log } = await run(JSON.stringify(bad));
    expect(outcome.ok).toBe(false);
    expect(log).toHaveBeenCalledWith("rank.output_invalid", {
      stage: "schema",
      issues: "score:too_big;strengths:too_big(len=4);gaps:too_small(len=1)",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(MARK);
  });

  it("reports the counted sentences for an explanation failure", async () => {
    const { log } = await run(JSON.stringify(output(`${MARK} One. Two. Three. Four.`)));
    expect(log).toHaveBeenCalledWith("rank.output_invalid", { stage: "schema", issues: "explanation:custom(sentences=4)" });
  });

  it("reports unrecognized keys by count, not by name", async () => {
    const { log } = await run(JSON.stringify({ ...output("One. Two."), [MARK]: "x" }));
    expect(log).toHaveBeenCalledWith("rank.output_invalid", { stage: "schema", issues: "(root):unrecognized_keys(count=1)" });
    expect(JSON.stringify(log.mock.calls)).not.toContain(MARK);
  });

  it("logs the JSON stage when the response isn't JSON", async () => {
    const { log } = await run(`not json ${MARK}`);
    expect(log).toHaveBeenCalledWith("rank.output_invalid", { stage: "json", issues: "parse_error" });
    expect(JSON.stringify(log.mock.calls)).not.toContain(MARK);
  });
});
