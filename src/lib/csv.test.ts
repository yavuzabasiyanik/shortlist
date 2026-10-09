import { describe, expect, it } from "vitest";
import { csvCell, resultsToCsv, topCandidatesToCsv } from "@/lib/csv";
import { rankOutcomes } from "@/lib/ranking/rank-rows";
import type { ResumeOutcome } from "@/lib/ranking/schema";

// Minimal RFC 4180 parser, used only to check the output round-trips.
function parse(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const text = csv.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r" && text[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  return rows;
}

const row = (rank: number, overrides = {}) => ({
  rank,
  candidateName: `Person ${rank}`,
  score: 90 - rank,
  strengths: ["a", "b", "c"],
  gaps: ["d", "e"],
  reason: `Reason ${rank}.`,
  ...overrides,
});

describe("resultsToCsv", () => {
  it("uses the table's columns and rank order, whatever order rows are given in", () => {
    const rows = parse(resultsToCsv([row(3), row(1), row(2)]));
    expect(rows[0]).toEqual(["Rank", "Candidate", "Score", "Strengths", "Gaps"]);
    expect(rows.slice(1).map((r) => r[0])).toEqual(["1", "2", "3"]);
  });

  it("round-trips quotes, commas, line breaks, and Unicode", () => {
    const tricky = row(1, {
      candidateName: 'Zoë "Zee" Ångström, Jr. 李雷',
      strengths: ["Led React, TypeScript", 'Said "ship it"', "Line one\nline two"],
      gaps: ["Niño", "😀 emoji"],
    });
    const [, data] = parse(resultsToCsv([tricky]));
    expect(data).toEqual([
      "1",
      'Zoë "Zee" Ångström, Jr. 李雷',
      "89",
      'Led React, TypeScript\nSaid "ship it"\nLine one\nline two',
      "Niño\n😀 emoji",
    ]);
  });

  it("starts with a UTF-8 BOM and uses CRLF line endings", () => {
    const csv = resultsToCsv([row(1)]);
    expect(csv.startsWith("﻿Rank,")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it.each(["=HYPERLINK(\"http://x\")", "+SUM(A1)", "-2+3", "@cmd", "\tTAB"])(
    "neutralises a cell that would run as a formula: %s",
    (value) => {
      const [, data] = parse(resultsToCsv([row(1, { candidateName: value, strengths: [value, "b", "c"] })]));
      expect(data[1]).toBe(`'${value}`);
      expect(data[3].startsWith(`'${value}`)).toBe(true);
    },
  );

  it("keeps numeric rank and score as plain numbers", () => {
    expect(csvCell(1)).toBe("1");
    expect(csvCell(87)).toBe("87");
  });

  it("marks flagged PDF candidates in the Candidate cell only, keeping order and the formula guard", () => {
    const rows = parse(
      resultsToCsv([
        row(2, { candidateName: "Pasted Person" }),
        row(1, { candidateName: "Image PDF Person", textOnly: true }),
        row(3, { candidateName: "=Formula Name", textOnly: true }),
        row(4, { candidateName: "Plain PDF Person", textOnly: false }),
      ]),
    );
    expect(rows[0]).toEqual(["Rank", "Candidate", "Score", "Strengths", "Gaps"]);
    expect(rows.slice(1).map((r) => r[1])).toEqual([
      "Image PDF Person [Text-only extraction]",
      "Pasted Person",
      "'=Formula Name [Text-only extraction]",
      "Plain PDF Person",
    ]);
    expect(rows.slice(1).map((r) => r[0])).toEqual(["1", "2", "3", "4"]);
  });

  it("lists failed resumes after ranked ones, with no score", () => {
    const rows = parse(resultsToCsv([row(1)], [{ fileName: "broken.pdf", message: "Scoring timed out." }]));
    expect(rows[2]).toEqual(["Not scored: Scoring timed out.", "broken.pdf", "", "", ""]);
  });
});

describe("topCandidatesToCsv", () => {
  it("has Rank, Candidate, Score, Reason and the best 10 in rank order", () => {
    const shuffled = Array.from({ length: 23 }, (_, i) => row(((i * 7) % 23) + 1));
    const rows = parse(topCandidatesToCsv(shuffled));
    expect(rows[0]).toEqual(["Rank", "Candidate", "Score", "Reason"]);
    expect(rows.slice(1)).toHaveLength(10);
    expect(rows.slice(1).map((r) => r[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    expect(rows[1]).toEqual(["1", "Person 1", "89", "Reason 1."]);
  });

  it("exports every candidate when fewer than 10 were scored, and only the header when none were", () => {
    expect(parse(topCandidatesToCsv([row(2), row(1), row(3)])).slice(1).map((r) => r[1])).toEqual(["Person 1", "Person 2", "Person 3"]);
    expect(parse(topCandidatesToCsv([]))).toEqual([["Rank", "Candidate", "Score", "Reason"]]);
  });

  it("quotes commas, quotes, and line breaks, and neutralises formulas in names and reasons", () => {
    const rows = parse(
      topCandidatesToCsv([
        row(1, { candidateName: 'Zoë "Zee", Jr.', reason: "React, TypeScript;\nsaid \"ship it\"" }),
        row(2, { candidateName: "=cmd|' /C calc'!A0", reason: "+SUM(A1)" }),
        row(3, { candidateName: "Image PDF Person", reason: "@import", textOnly: true }),
        row(4, { reason: "-2+3 years" }),
      ]),
    );
    expect(rows[1]).toEqual(["1", 'Zoë "Zee", Jr.', "89", 'React, TypeScript;\nsaid "ship it"']);
    expect(rows[2]).toEqual(["2", "'=cmd|' /C calc'!A0", "88", "'+SUM(A1)"]);
    expect(rows[3]).toEqual(["3", "Image PDF Person [Text-only extraction]", "87", "'@import"]);
    expect(rows[4][3]).toBe("'-2+3 years");
  });

  it("starts with a UTF-8 BOM and uses CRLF line endings, like the full export", () => {
    const csv = topCandidatesToCsv([row(1)]);
    expect(csv.startsWith("\uFEFFRank,")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("matches the displayed ranking: score order, ties in upload order, failures left out", () => {
    const ok = (id: string, score: number): ResumeOutcome => ({
      id,
      fileName: `${id}.pdf`,
      ok: true,
      result: { candidateName: id, score, reason: `${id} reason.`, strengths: ["a", "b", "c"], gaps: ["d", "e"], explanation: "One. Two." },
    });
    const bad = (id: string): ResumeOutcome => ({ id, fileName: `${id}.docx`, ok: false, error: { code: "timeout", message: "Scoring timed out." } });
    const upload = Array.from({ length: 14 }, (_, i) => `r${i}`);
    // Arrival order differs from upload order, as in a streamed run.
    const outcomes = [ok("r13", 70), bad("r0"), ok("r2", 90), ok("r1", 70), ok("r3", 55), bad("r4"), ...[5, 6, 7, 8, 9, 10, 11, 12].map((n) => ok(`r${n}`, 40 + n))];
    const { ranked } = rankOutcomes(outcomes, upload);
    const rows = parse(topCandidatesToCsv(ranked)).slice(1);
    expect(rows.map((r) => r[1])).toEqual(ranked.slice(0, 10).map((r) => r.candidateName));
    expect(rows.map((r) => r[1])).toEqual(["r2", "r1", "r13", "r3", "r12", "r11", "r10", "r9", "r8", "r7"]);
    expect(rows.map((r) => r[0])).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });
});
