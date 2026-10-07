import { RankForm } from "@/components/rank-form";
import { liveRankingAvailable } from "@/lib/ranking/provider";
import { SampleDemo } from "@/components/sample-demo";

export default function Home() {
  const liveEnabled = liveRankingAvailable(process.env);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
      <header className="flex items-center gap-2 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={24} height={24} />
        <span className="font-semibold tracking-tight">Shortlist</span>
      </header>

      <main className="flex-1 space-y-10 pb-16">
        <section className="max-w-2xl pt-6 sm:pt-10">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Rank a stack of resumes against one job, with reasons.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-600">
            Shortlist reads a job description and a set of PDF resumes, scores
            each candidate from 0 to 100, and lists their top strengths and
            gaps, so a recruiter can decide who to look at first.
          </p>
          <p className="mt-4 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Scores are a screening aid, not a hiring decision.</strong>{" "}
            A person should review every candidate before any decision is made.
          </p>
        </section>

        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
          <SampleDemo />
        </section>

        <section
          aria-labelledby="live-heading"
          className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="live-heading" className="text-lg font-semibold">
              Rank your own resumes
            </h2>
            {!liveEnabled && (
              <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-xs font-medium text-stone-700">
                Live ranking not enabled
              </span>
            )}
          </div>
          <p className="mt-2 mb-6 max-w-2xl text-sm leading-relaxed text-stone-600">
            Paste a job description and add PDF resumes. Text is extracted in
            your browser; the PDF files never leave it.{" "}
            {liveEnabled
              ? "Clicking Rank sends only the extracted text for scoring, and nothing is saved."
              : "On this deployment nothing is sent anywhere."}
          </p>
          <RankForm liveEnabled={liveEnabled} />
        </section>
      </main>

      <footer className="border-t border-stone-200 py-6 text-sm text-stone-500">
        A portfolio project. All sample people and companies are fictional.
      </footer>
    </div>
  );
}
