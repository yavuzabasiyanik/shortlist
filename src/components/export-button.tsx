"use client";

import { downloadCsv, resultsToCsv, type CsvFailedRow, type CsvRankedRow } from "@/lib/csv";

// Builds and downloads the CSV in the browser; nothing is sent anywhere.
export function ExportButton({
  ranked,
  failed = [],
  fileName,
  disabled = false,
}: {
  ranked: CsvRankedRow[];
  failed?: CsvFailedRow[];
  fileName: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => downloadCsv(fileName, resultsToCsv(ranked, failed))}
      className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 disabled:cursor-not-allowed disabled:text-stone-400 disabled:hover:bg-white"
    >
      Download CSV
    </button>
  );
}
