"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownIcon } from "@/components/icons";
import { LiveInputs } from "@/components/live-inputs";
import { ResultsPanel } from "@/components/results-panel";
import { SampleInputs } from "@/components/sample-inputs";
import { useLiveRanking } from "@/lib/use-live-ranking";
import { useResumeFiles } from "@/lib/use-resume-files";

// The whole workspace. Your own inputs and the live run are held here, so
// switching to the sample and back never erases them. Sample data is static
// and never reaches the live run.
export function Workspace({ liveEnabled }: { liveEnabled: boolean }) {
  const [mode, setMode] = useState<"own" | "sample">("own");
  const [jobDescription, setJobDescription] = useState("");
  const resumes = useResumeFiles();
  const { state: run, start, cancel } = useLiveRanking();
  const results = useRef<HTMLElement>(null);

  // A PDF dropped outside the drop zone would replace the page; block that.
  useEffect(() => {
    const block = (event: DragEvent) => event.preventDefault();
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const jumpToResults = () => {
    results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    results.current?.focus({ preventScroll: true });
  };

  const rank = () => {
    if (mode !== "own") return;
    const ready = resumes.files.flatMap((file) =>
      file.status === "ready" ? [{ id: `f${file.id}`, fileName: file.name, text: file.text }] : [],
    );
    void start(jobDescription, ready);
  };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl">Find your strongest matches.</h1>
          <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-stone-600">
            Compare resumes against your role, with clear strengths, gaps, and reasons for every score.
          </p>
        </div>
        {mode === "own" ? (
          <button
            type="button"
            onClick={() => setMode("sample")}
            className="shrink-0 self-start rounded-lg border border-teal-700 bg-white px-4 py-2 text-sm font-semibold text-teal-800 shadow-sm hover:bg-teal-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:self-auto"
          >
            Try with sample data
          </button>
        ) : (
          // Sample results sit below the inputs on small screens.
          <button
            type="button"
            onClick={jumpToResults}
            className="flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-teal-700 bg-white px-4 py-2 text-sm font-semibold text-teal-800 lg:hidden"
          >
            View sample results
            <ArrowDownIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
        <section aria-label={mode === "sample" ? "Sample inputs" : "Your inputs"} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_3px_rgba(28,25,23,0.05)]">
          {mode === "sample" ? (
            <SampleInputs onUseOwn={() => setMode("own")} />
          ) : (
            <LiveInputs
              liveEnabled={liveEnabled}
              jobDescription={jobDescription}
              onJobDescriptionChange={setJobDescription}
              resumes={resumes}
              run={run}
              onRank={rank}
              onCancel={cancel}
              onJumpToResults={jumpToResults}
            />
          )}
        </section>

        <section
          ref={results}
          tabIndex={-1}
          aria-labelledby="results-heading"
          className="scroll-mt-4 rounded-2xl border border-stone-200 bg-white/70 p-5 shadow-[0_1px_3px_rgba(28,25,23,0.05)] focus:outline-none sm:p-6"
        >
          <ResultsPanel mode={mode} run={run} onTrySample={() => setMode("sample")} />
        </section>
      </div>
    </>
  );
}
