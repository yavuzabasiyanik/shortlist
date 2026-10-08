"use client";

import { DownloadIcon } from "@/components/icons";
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:text-stone-500 disabled:hover:bg-white"
    >
      <DownloadIcon className="h-4 w-4" />
      Download CSV
    </button>
  );
}
