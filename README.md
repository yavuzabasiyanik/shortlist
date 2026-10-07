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
| SHORT-03 | Live ranking and streaming | **In progress.** Checkpoint 1 done: API contract, validation, gate, prompt, result schema, mocked scoring tests. No provider is connected. |
| SHORT-04 | Complete sample-data experience | Partial: precomputed sample table only |
| SHORT-05 | CSV export | Not started |
| SHORT-06 | Expandable explanations | Not started (explanations exist in the sample data but are hidden) |

**Live ranking is unavailable.** The Rank button is always disabled. `POST /api/rank` exists, but on this deployment it answers `503 live_ranking_disabled` before reading the request. Even with `ENABLE_REAL_RUNS=true` it would answer `503 scoring_not_configured`, because no AI provider adapter exists yet.

**Privacy.** PDFs are read with `pdfjs-dist` in the browser. Files and extracted text stay in React state for the current tab only. They are never uploaded or saved. The API logs only counts and error codes, never job descriptions, resume text, or file names.

**Sample results** in `src/data/sample.ts` were written by hand to match the scoring rules. They are labeled as precomputed in the UI. Replacing them with model output later is optional.

### Done in SHORT-03 checkpoint 1

- `POST /api/rank` route handler (Node.js runtime) that accepts `{ jobDescription, resumes: [{ id, fileName, text }] }`.
- Server-side validation with Zod (limits below), including unique ids.
- A request-body limit enforced while the body streams in.
- The `ENABLE_REAL_RUNS` gate, checked before anything else.
- The brief's result schema: name, score 0–100 (integer), exactly 3 strengths, exactly 2 gaps, and a 2–3 sentence explanation.
- A scoring prompt covering every rule in the brief. It treats all user content as untrusted data and asks for "not evidenced in the resume" instead of guesses.
- A small scoring boundary (`Scorer`). Tests drive it with fake responses. It is not reachable from the public route.
- If a resume has no name, the file name is used.

### Remaining for SHORT-03

1. **Provider integration:** add one adapter in `src/lib/ranking/provider.ts` that calls the chosen provider's SDK with structured JSON output and `SCORING_TEMPERATURE`, and add the API key to Vercel.
2. **Spending cap:** set and confirm a hard monthly limit in the provider's billing console.
3. **Rate limiting:** provision Upstash Redis (Vercel Marketplace, free tier) and add `@upstash/ratelimit` for 3 real runs per IP per day. Store counters only.
4. **Deployed verification** of the spending cap and the rate limit, and only then set `ENABLE_REAL_RUNS=true`.
5. **Parallel processing:** up to 5 scoring calls at a time (currently one by one).
6. **Streaming:** send each result as it finishes.
7. **Live-result UI:** enable Rank, send extracted text, insert and re-sort rows as they arrive, show error rows, and show the rate-limited-key notice.

## Limits

| Limit | Value | Where |
| --- | --- | --- |
| Job description | 100–10,000 characters (UTF-16 code units, JavaScript `.length`) | Browser and server |
| Resumes per request | 1–20 | Browser and server |
| PDF file size | 5 MB = 5,242,880 bytes. Exactly 5,242,880 is accepted; 5,242,881 is rejected. | Browser |
| Extracted text per resume | 1–30,000 characters, after trimming whitespace for the empty check. Over the limit is an error, not truncated. | Browser and server |
| File name | 1–255 characters, no control characters | Server |
| Resume id | 1–64 characters: letters, digits, `-`, `_`; unique per request | Server |
| Request body | 2,000,000 bytes, counted while reading; larger bodies get `413` | Server |

The largest valid request is about 617 KB with plain ASCII text, and 1,847,133 bytes if every character is a 3-byte UTF-8 character (the most one UTF-16 unit can take). Both fit under 2,000,000 bytes, which is below Vercel's 4.5 MB request limit.

## API

`POST /api/rank` with `Content-Type: application/json`:

```json
{
  "jobDescription": "string, 100–10,000 characters",
  "resumes": [{ "id": "r1", "fileName": "jane.pdf", "text": "extracted resume text" }]
}
```

Responses: `503` (`live_ranking_disabled` or `scoring_not_configured`), `415`, `413` (`body_too_large`), `400` (`invalid_json`, `invalid_encoding`, `invalid_request` with issue paths), or `200` with one entry per resume:

```json
{ "results": [
  { "id": "r1", "fileName": "jane.pdf", "ok": true,
    "result": { "candidateName": "Jane", "score": 82, "strengths": ["", "", ""], "gaps": ["", ""], "explanation": "" } },
  { "id": "r2", "fileName": "x.pdf", "ok": false, "error": { "code": "invalid_model_output", "message": "" } }
] }
```

## Stack

| Layer | Choice |
| --- | --- |
| Front end | Next.js (App Router), React, TypeScript, Tailwind CSS |
| PDF text extraction | `pdfjs-dist`, in the browser. Raw PDFs never leave the browser. |
| API | Next.js route handler (Node.js runtime) |
| Validation | Zod, for requests and model output |
| Tests | Vitest |
| Hosting | Vercel |
| Planned: LLM | Anthropic or OpenAI, chosen with `SCORING_PROVIDER` / `SCORING_MODEL` |
| Planned: rate limiting | Upstash Redis (Vercel Marketplace) with `@upstash/ratelimit`: 3 real ranking runs per IP per day. Counters only, never resume data. |

## Project layout

```
src/app/layout.tsx              Root layout: fonts, page title, description
src/app/page.tsx                The single page: pitch, sample demo, "rank your own resumes" form
src/app/api/rank/route.ts       POST /api/rank: wires the handler to the real gate, provider, and logger
src/app/icon.svg                Favicon
src/app/globals.css             Tailwind import and base colors
src/components/sample-demo.tsx  Client component: sample button, job, ranked table
src/components/rank-form.tsx    Job description + uploads + readiness checklist + (disabled) Rank button
src/components/job-description-input.tsx  Text box with character count and limits
src/components/resume-upload.tsx          Drop zone, file picker, file list with statuses and Remove
src/lib/limits.ts               Every input limit, shared by browser and server
src/lib/check-resume-file.ts    Type and size check for a picked or dropped file
src/lib/use-resume-files.ts     File list state, one-at-a-time parsing queue, removal
src/lib/extract-pdf-text.ts     Browser-side PDF text extraction and error classification
src/lib/ranking/schema.ts       Zod schemas: request, model output, result
src/lib/ranking/prompt.ts       System prompt and user prompt builder
src/lib/ranking/score.ts        Scorer boundary, per-resume validation, name fallback
src/lib/ranking/read-body.ts    Reads the request body with a byte limit
src/lib/ranking/handler.ts      The route logic: gate, limits, validation, scoring, safe logging
src/lib/ranking/provider.ts     ENABLE_REAL_RUNS gate and provider/model config
src/lib/**/*.test.ts            Vitest tests
src/data/sample.ts              Fictional job, five resume fixtures, precomputed results
```

## Run locally

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No API keys or Redis credentials are needed. The sample experience works out of the box.

Checks:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Environment variables

See [.env.example](.env.example). All are server-only.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENABLE_REAL_RUNS` | unset (off) | Real runs are allowed only when this is exactly `true`. Keep it off until the spending cap and the deployed rate limit are verified. |
| `SCORING_PROVIDER` | unset | `anthropic` or `openai`. |
| `SCORING_MODEL` | unset | Model id for the chosen provider. |

## Deploy

Deployed with the Vercel CLI to the Vercel project `shortlist`. Pushing to GitHub does not deploy.

```bash
vercel link --project shortlist
vercel deploy --prod
```

## Privacy and guardrails

- All sample people and companies are fictional.
- Uploaded resumes are never stored. The API never logs their contents.
- Scores are a screening aid, not a hiring decision.
