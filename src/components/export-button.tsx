"use client";

import { DownloadIcon } from "@/components/icons";
import { downloadCsv } from "@/lib/csv";

// Builds and downloads a CSV in the browser; nothing is sent anywhere.
export function ExportButton({
  build,
  fileName,
  label,
  shortLabel,
  disabled = false,
}: {
  build: () => string;
  fileName: string;
  label: string;
  // Shown on phones so the status badge and the buttons share one row.
  shortLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => downloadCsv(fileName, build())}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:text-stone-500 disabled:hover:bg-white"
    >
      <DownloadIcon className="h-4 w-4" />
      <span className="sm:hidden">{shortLabel}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
