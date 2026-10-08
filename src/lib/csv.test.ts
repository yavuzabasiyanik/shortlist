import { describe, expect, it } from "vitest";
import { csvCell, resultsToCsv } from "@/lib/csv";

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

  it("lists failed resumes after ranked ones, with no score", () => {
    const rows = parse(resultsToCsv([row(1)], [{ fileName: "broken.pdf", message: "Scoring timed out." }]));
    expect(rows[2]).toEqual(["Not scored: Scoring timed out.", "broken.pdf", "", "", ""]);
  });
});
