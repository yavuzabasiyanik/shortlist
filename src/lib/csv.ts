// Builds the results CSVs in the browser. The full export has the table's
// columns in rank order, with failed resumes after it and no score. The
// top-10 export lists only scored candidates, with their one-line reason.

export type CsvRankedRow = {
  rank: number;
  candidateName: string;
  score: number;
  strengths: string[];
  gaps: string[];
  // A PDF or DOCX with images whose text wasn't scored; marked in the Candidate cell.
  textOnly?: boolean;
};
export type CsvFailedRow = { fileName: string; message: string };
export type CsvTopRow = Pick<CsvRankedRow, "rank" | "candidateName" | "score" | "textOnly"> & { reason: string };

export const CSV_COLUMNS = ["Rank", "Candidate", "Score", "Strengths", "Gaps"] as const;
export const TOP_CSV_COLUMNS = ["Rank", "Candidate", "Score", "Reason"] as const;
export const TOP_COUNT = 10;

// A cell starting with one of these can run as a formula in Excel, Sheets,
// or LibreOffice. Prefixing an apostrophe makes it plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  // RFC 4180: quote cells with commas, quotes, or line breaks; double quotes.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const candidateCell = (row: { candidateName: string; textOnly?: boolean }) =>
  row.textOnly ? `${row.candidateName} [Text-only extraction]` : row.candidateName;

const byRank = <T extends { rank: number }>(rows: T[]) => [...rows].sort((a, b) => a.rank - b.rank);

// BOM so Excel reads UTF-8 (accents, CJK) correctly; CRLF per RFC 4180.
const toFile = (lines: string[]) => "\uFEFF" + lines.join("\r\n") + "\r\n";

export function resultsToCsv(ranked: CsvRankedRow[], failed: CsvFailedRow[] = []): string {
  const lines = [
    CSV_COLUMNS.join(","),
    ...byRank(ranked).map((row) =>
      [
        row.rank,
        candidateCell(row),
        row.score,
        row.strengths.join("\n"),
        row.gaps.join("\n"),
      ]
        .map(csvCell)
        .join(","),
    ),
    ...failed.map((row) => [`Not scored: ${row.message}`, row.fileName, "", "", ""].map(csvCell).join(",")),
  ];
  return toFile(lines);
}

// The best `count` scored candidates in rank order, or all of them if fewer
// were scored. Failed resumes have no rank, so they never appear here.
export function topCandidatesToCsv(ranked: CsvTopRow[], count = TOP_COUNT): string {
  return toFile([
    TOP_CSV_COLUMNS.join(","),
    ...byRank(ranked)
      .slice(0, count)
      .map((row) => [row.rank, candidateCell(row), row.score, row.reason].map(csvCell).join(",")),
  ]);
}

export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
