# Shortlist

Paste a job description, add a stack of PDF resumes, and get a ranked shortlist with each candidate's strengths and gaps.

> Scores are a screening aid, not a hiring decision. A person should review every candidate.

**Live demo:** _URL added after first deploy_

Shortlist is a portfolio project. It is aimed at a recruiter or hiring manager at a small company with no applicant tracking system. See [Shortlist-Product-Brief.md](Shortlist-Product-Brief.md) for the full scope.

## Status

This is the initial skeleton (build step 1 in the brief):

- One-page, responsive shell with the product pitch and the screening-aid notice.
- **Try with sample data**: shows a fictional job description, five fictional resume fixtures, and a ranked table of **precomputed** results. Sample mode makes no API calls.
- Uploads and live ranking are shown as unavailable. No ranking endpoint exists yet.

Not built yet: job description input, PDF upload and parsing, live ranking, streaming, expandable explanations, CSV export.

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
src/app/page.tsx                The single page: pitch, sample demo, "not available yet" section
src/app/icon.svg                Favicon
src/app/globals.css             Tailwind import and base colors
src/components/sample-demo.tsx  Client component: sample button, job, ranked table
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
