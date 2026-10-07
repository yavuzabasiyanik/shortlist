# Shortlist

Paste a job description, add a stack of PDF resumes, and get a ranked shortlist with each candidate's strengths and gaps.

> Scores are a screening aid, not a hiring decision. A person should review every candidate.

**Live demo:** https://shortlist-ten-sigma.vercel.app

Shortlist is a portfolio project. It is aimed at a recruiter or hiring manager at a small company with no applicant tracking system. See [Shortlist-Product-Brief.md](Shortlist-Product-Brief.md) for the full scope.

## Status

| Ticket | Scope | Status |
| --- | --- | --- |
| Milestone 1 | Skeleton and first deployment | Done |
| SHORT-01 | Job description input (10,000-character limit, live count, 100-character minimum) | Done |
| SHORT-02 | PDF upload: drag and drop or file picker, 1–20 PDFs, 5 MB each, text extracted in the browser | Done |
| SHORT-03 | Live ranking and streaming | Not started |
| SHORT-04 | Complete sample-data experience | Partial: precomputed sample table only |
| SHORT-05 | CSV export | Not started |
| SHORT-06 | Expandable explanations | Not started (explanations exist in the sample data but are hidden) |

**Rank is always disabled.** The page shows when the job description and resumes are valid, but live ranking is not enabled yet and no ranking endpoint exists.

**Privacy.** PDFs are read with `pdfjs-dist` in the browser. Files and extracted text stay in React state for the current tab only. They are never uploaded, saved, or logged.

### TODO

- [ ] Regenerate sample results with the real model once SHORT-03 ships. (The current results in `src/data/sample.ts` are hand-written placeholders.)

## Stack

| Layer | Choice |
| --- | --- |
| Front end | Next.js (App Router), React, TypeScript, Tailwind CSS |
| Hosting | Vercel |
| Planned: PDF text extraction | `pdfjs-dist`, in the browser. Raw PDFs never leave the browser. |
| Planned: API | Next.js route handler that receives extracted text and file names, validates them on the server, and caps each resume at 30,000 characters |
| Planned: LLM output | Structured JSON output, validated with Zod |
| Planned: rate limiting | Upstash Redis (Vercel Marketplace) with `@upstash/ratelimit`: 3 real ranking runs per IP per day. Redis stores rate-limit counters only, never resume data. |

## Project layout

```
src/app/layout.tsx              Root layout: fonts, page title, description
src/app/page.tsx                The single page: pitch, sample demo, "rank your own resumes" form
src/app/icon.svg                Favicon
src/app/globals.css             Tailwind import and base colors
src/components/sample-demo.tsx  Client component: sample button, job, ranked table
src/components/rank-form.tsx    Job description + uploads + readiness checklist + (disabled) Rank button
src/components/job-description-input.tsx  Text box with character count and limits
src/components/resume-upload.tsx          Drop zone, file picker, file list with statuses and Remove
src/lib/use-resume-files.ts     File list state, intake validation, one-at-a-time parsing queue
src/lib/extract-pdf-text.ts     Browser-side PDF text extraction and error classification
src/lib/limits.ts               Input limits shared with the future API
src/data/sample.ts              Fictional job, five resume fixtures, precomputed results
.env.example                    Documents ENABLE_REAL_RUNS (no secrets)
```

## Run locally

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No API keys or Redis credentials are needed. The sample experience works out of the box.

Other checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Environment variables

See [.env.example](.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENABLE_REAL_RUNS` | `false` | Server-only. Turns on real (paid) ranking runs. Off by default. Nothing reads it yet; the future ranking endpoint will refuse to run unless it is `true`. |

## Deploy

Deployed with the Vercel CLI to the Vercel project `shortlist`:

```bash
npm i -g vercel
vercel login
vercel link --project shortlist
vercel --prod
```

When live ranking ships, set `ENABLE_REAL_RUNS` and the AI provider key in the Vercel project's environment variables.

## Privacy and guardrails

- All sample people and companies are fictional.
- Uploaded resumes will never be stored or logged.
- The demo will use a rate-limited API key, capped at 20 resumes per request.
