// Builds the results CSV in the browser. Same columns as the table, in rank
// order; failed resumes follow with no score.

export type CsvRankedRow = {
  rank: number;
  candidateName: string;
  score: number;
  strengths: string[];
  gaps: string[];
};
export type CsvFailedRow = { fileName: string; message: string };

export const CSV_COLUMNS = ["Rank", "Candidate", "Score", "Strengths", "Gaps"] as const;

// A cell starting with one of these can run as a formula in Excel, Sheets,
// or LibreOffice. Prefixing an apostrophe makes it plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  // RFC 4180: quote cells with commas, quotes, or line breaks; double quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function resultsToCsv(ranked: CsvRankedRow[], failed: CsvFailedRow[] = []): string {
  const sorted = [...ranked].sort((a, b) => a.rank - b.rank);
  const lines = [
    CSV_COLUMNS.join(","),
    ...sorted.map((row) =>
      [row.rank, row.candidateName, row.score, row.strengths.join("\n"), row.gaps.join("\n")].map(csvCell).join(","),
    ),
    ...failed.map((row) => [`Not scored: ${row.message}`, row.fileName, "", "", ""].map(csvCell).join(",")),
  ];
  // BOM so Excel reads UTF-8 (accents, CJK) correctly; CRLF per RFC 4180.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
