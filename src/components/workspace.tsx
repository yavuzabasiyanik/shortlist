"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownIcon } from "@/components/icons";
import { LiveInputs } from "@/components/live-inputs";
import { ResultsPanel } from "@/components/results-panel";
import type { InputMethod, PasteDraft } from "@/components/resume-upload";
import { SampleInputs } from "@/components/sample-inputs";
import { inputReadiness } from "@/lib/input-readiness";
import { useLiveRanking } from "@/lib/use-live-ranking";
import { useResumeFiles } from "@/lib/use-resume-files";

// The whole workspace. Your own inputs and the live run are held here, so
// switching to the sample and back never erases them. Sample data is static
// and never reaches the live run.
export function Workspace({ liveEnabled }: { liveEnabled: boolean }) {
  const [mode, setMode] = useState<"own" | "sample">("own");
  const [jobDescription, setJobDescription] = useState("");
  const resumes = useResumeFiles();
  const [method, setMethod] = useState<InputMethod>("pdf");
  const [draft, setDraft] = useState<PasteDraft>({ label: "", text: "" });
  const { state: run, start, cancel } = useLiveRanking();
  const results = useRef<HTMLElement>(null);
  // Set by an explicit "Try with sample data" click; handled after render.
  const revealResults = useRef(false);
  // Once your inputs can be ranked, Rank becomes the main action.
  const rankIsPrimary = liveEnabled && inputReadiness(jobDescription, resumes.files).ready;

  // A file dropped outside the drop zone would replace the page; block that.
  useEffect(() => {
    const block = (event: DragEvent) => event.preventDefault();
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  // Brings the results heading into view and moves focus to it.
  // `onlyIfHidden` leaves the page alone when the heading is already on screen.
  const jumpToResults = (onlyIfHidden = false) => {
    const heading = document.getElementById("results-heading");
    if (!heading) return;
    const { top } = heading.getBoundingClientRect();
    const visible = top >= 0 && top < window.innerHeight * 0.75;
    if (!onlyIfHidden || !visible) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      results.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
    heading.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (mode === "sample" && revealResults.current) {
      revealResults.current = false;
      jumpToResults(true);
    }
  }, [mode]);

  const trySample = () => {
    revealResults.current = true;
    setMode("sample");
  };
  const showJump = mode === "sample" || run.status !== "idle";

  const rank = () => {
    if (mode !== "own") return;
    const ready = resumes.files.flatMap((file) =>
      file.status === "ready" ? [{ id: `f${file.id}`, fileName: file.name, text: file.text, hasImages: file.hasImages }] : [],
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {mode === "own" && (
            <button
              type="button"
              onClick={trySample}
              className={`rounded-lg px-4 py-2 text-sm font-semibold shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${
                rankIsPrimary
                  ? "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100"
                  : "bg-teal-700 text-white hover:bg-teal-800"
              }`}
            >
              Try with sample data
            </button>
          )}
          {/* Results sit below the inputs on small screens. */}
          {showJump && (
            <button
              type="button"
              onClick={() => jumpToResults()}
              className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 lg:hidden"
            >
              {mode === "sample" ? "View sample results" : "View results"}
              <ArrowDownIcon className="h-4 w-4" />
            </button>
          )}
        </div>
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
              onJumpToResults={() => jumpToResults()}
              method={method}
              onMethodChange={setMethod}
              draft={draft}
              onDraftChange={setDraft}
            />
          )}
        </section>

        <section
          ref={results}
          tabIndex={-1}
          aria-labelledby="results-heading"
          className="scroll-mt-4 rounded-2xl border border-stone-200 bg-white/70 p-5 shadow-[0_1px_3px_rgba(28,25,23,0.05)] focus:outline-none sm:p-6"
        >
          <ResultsPanel mode={mode} run={run} />
        </section>
      </div>
    </>
  );
}
