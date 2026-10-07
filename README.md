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
| SHORT-03 | Live ranking and streaming | **Code complete; not yet enabled.** Provider adapter, rate limiting, parallel scoring, streaming, and live results UI are built and tested with mocks. Paid verification on a protected preview is waiting on the spending cap and Upstash setup below. |
| SHORT-04 | Complete sample-data experience | Partial: precomputed sample table only |
| SHORT-05 | CSV export | Not started |
| SHORT-06 | Expandable explanations | Not started (explanations exist in the sample data but are hidden) |

**Production has live ranking off.** `ENABLE_REAL_RUNS` is unset, so the Rank button stays disabled and `POST /api/rank` answers `503 live_ranking_disabled` before reading the request.

**Privacy.** PDFs are read with `pdfjs-dist` in the browser; the files never leave it. When live ranking is on, clicking Rank sends only the extracted text and file names to `/api/rank`, which forwards each resume to Anthropic for scoring and keeps nothing after the request. Logs hold only counts, codes, timings, and token usage. Redis holds only a hashed IP counter per day.

**Sample results** in `src/data/sample.ts` were written by hand to match the scoring rules and are labeled as precomputed. Replacing them with model output later is optional.

### How live ranking works

1. The browser sends `{ jobDescription, resumes: [{ id, fileName, text }] }`.
2. The server checks, in order: `ENABLE_REAL_RUNS`, provider config, rate limiter config, content type, body size (while reading), JSON, and Zod validation.
3. It uses up one of the caller's 3 daily runs. A blocked run gets `429` and no model call is made.
4. It scores up to 5 resumes at a time with Claude Haiku 5.5 and streams each result (or a file-specific error) as one NDJSON line as soon as it finishes.
5. The browser inserts each row and re-sorts by score. Ties keep upload order, so ranks are stable.

### Scoring model and cost controls

| Setting | Value | Why |
| --- | --- | --- |
| Provider / model | Anthropic, `claude-haiku-5-5` | $0.10 / MTok input, $0.50 / MTok output (prompts up to 100K tokens), with structured JSON output |
| Output format | `output_config.format` JSON schema, then the Zod schema | The API constrains the shape; Zod enforces 3 strengths, 2 gaps, integer 0–100, 2–3 sentences |
| Temperature | Not sent | Claude Haiku 5.5 rejects any non-default temperature with a 400. Structured output and `effort: "low"` keep scores consistent instead. |
| `max_tokens` | 2,000 per resume | Bounds output cost and covers the model's thinking plus the JSON |
| Timeout | 30 s per call | Bounds call duration |
| SDK retries | 0 (SDK default is 2) | A failed call becomes a failed row, so billed calls can never exceed resumes |
| Concurrency | 5 per run | Brief |
| Run-wide stop | HTTP 400/401/402/403/404/429 from the provider | Covers spend limits (400), the tier spend cap and rate limits (429), billing (402), and key problems. No more calls are scheduled, in-flight calls are cancelled, and the rest are reported as not scored. |
| Cancellation | Browser cancel or disconnect aborts in-flight calls and stops scheduling | |

Worst case per resume: about 13K input tokens (a 10,000-character job plus a 30,000-character resume) and 2,000 output tokens, about $0.0023. Worst case per run (20 resumes): about $0.05. Worst case per IP per day (3 runs): about $0.14. The Anthropic workspace spend limit is the hard backstop.

### Rate limit policy

- 3 real ranking runs per IP per **UTC calendar day**: a fixed window that resets at 00:00 UTC, not a rolling 24 hours.
- Counted once per valid run, after validation and before any model call. Invalid requests and sample mode never count.
- The IP comes from `x-vercel-forwarded-for`, which Vercel sets and doesn't let clients spoof. Client-supplied `x-forwarded-for` / `x-real-ip` are ignored. Off Vercel, every request shares one bucket.
- Upstash `@upstash/ratelimit` fixed window: one atomic Lua script per check, so simultaneous requests can't share the last run.
- Redis stores only `shortlist:rank:<env>:<sha256(ip)>:<day> → count`, which expires with the window.
- Fails closed. Missing Redis config, a Redis error, or a 3-second timeout all mean `503`, never an unmetered run. The library's own fail-open timeout is turned off.

### Remaining before enabling production

1. **Anthropic spending cap.** In the Claude Console, create a workspace named "Shortlist" (Settings > Workspaces). On its **Spend limits** tab, set a monthly limit (for example $10). Create an API key in that workspace.
2. **Vercel env (Preview only first).** Set `ANTHROPIC_API_KEY` (sensitive), `SCORING_PROVIDER=anthropic`, `SCORING_MODEL=claude-haiku-5-5`, and `ENABLE_REAL_RUNS=true` for the **Preview** environment.
3. **Upstash.** Accept the Upstash terms (Vercel Marketplace), then run `vercel integration add upstash/upstash-kv --name shortlist-ratelimit --plan free`.
4. **Protected preview verification.** Deploy a preview; Vercel Authentication protects it. Run 3 one-resume fictional runs and a 4th, and confirm the 4th is `429` with no model call in the logs.
5. **Then** set `ENABLE_REAL_RUNS=true`, the key, and the model for Production and redeploy.

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

Error responses are JSON: `503` (`live_ranking_disabled`, `scoring_not_configured`, `rate_limit_unavailable`), `415`, `413` (`body_too_large`), `400` (`invalid_json`, `invalid_encoding`, `invalid_request` with issue paths), `429` (`rate_limited`, with `Retry-After`).

A successful run is `200` with `Content-Type: application/x-ndjson`, one event per line, in finishing order:

```json
{"type":"start","total":2,"runsLeftToday":2,"resetsAt":1791504000000}
{"type":"result","outcome":{"id":"r2","fileName":"x.pdf","ok":false,"error":{"code":"timeout","message":"Scoring timed out."}}}
{"type":"result","outcome":{"id":"r1","fileName":"jane.pdf","ok":true,"result":{"candidateName":"Jane","score":82,"strengths":["…","…","…"],"gaps":["…","…"],"explanation":"…"}}}
{"type":"done","scored":1,"failed":1}
```

A `{"type":"stopped","reason":"provider_rejected"}` line appears before `done` when the provider stopped accepting requests.

## Stack

| Layer | Choice |
| --- | --- |
| Front end | Next.js (App Router), React, TypeScript, Tailwind CSS |
| PDF text extraction | `pdfjs-dist`, in the browser. Raw PDFs never leave the browser. |
| API | Next.js route handler (Node.js runtime) |
| Validation | Zod, for requests and model output |
| Tests | Vitest |
| Hosting | Vercel |
| LLM | Anthropic `@anthropic-ai/sdk`, `claude-haiku-5-5`, structured JSON output |
| Rate limiting | Upstash Redis (Vercel Marketplace, free tier) with `@upstash/ratelimit`: 3 real runs per IP per UTC day. Counters only. |

## Project layout

```
src/app/layout.tsx              Root layout: fonts, page title, description
src/app/page.tsx                The single page: pitch, sample demo, "rank your own resumes" form
src/app/api/rank/route.ts       POST /api/rank: wires the handler to the real gate, provider, limiter, and logger
src/app/icon.svg                Favicon
src/app/globals.css             Tailwind import and base colors
src/components/sample-demo.tsx  Client component: sample button, job, ranked table
src/components/results-table.tsx Ranked table (desktop) / cards (mobile), shared by sample and live results
src/components/live-results.tsx  Progress, ranked live rows, error rows, rate-limit notice
src/components/rank-form.tsx    Job description + uploads + checklist + Rank / Cancel
src/components/job-description-input.tsx  Text box with character count and limits
src/components/resume-upload.tsx          Drop zone, file picker, file list with statuses and Remove
src/lib/limits.ts               Every input limit, shared by browser and server
src/lib/check-resume-file.ts    Type and size check for a picked or dropped file
src/lib/use-resume-files.ts     File list state, one-at-a-time parsing queue, removal
src/lib/extract-pdf-text.ts     Browser-side PDF text extraction and error classification
src/lib/ranking/schema.ts       Zod schemas: request, model output, result
src/lib/ranking/prompt.ts       System prompt and user prompt builder
src/lib/ranking/score.ts        Scorer boundary, typed scoring errors, per-resume validation, name fallback
src/lib/ranking/run.ts          Runs up to 5 scoring calls at a time; stops on cancel or provider rejection
src/lib/ranking/anthropic-scorer.ts  Claude Haiku 5.5 adapter: bounded tokens, timeout, no retries, error mapping
src/lib/ranking/rate-limit.ts   Upstash fixed-window limiter (fails closed) and trusted client identity
src/lib/ranking/rank-rows.ts    Sorts live results and assigns ranks
src/lib/ranking/events.ts       NDJSON stream event types shared by server and browser
src/lib/ranking/log.ts          Metadata-only logger
src/lib/ranking/read-body.ts    Reads the request body with a byte limit
src/lib/ranking/handler.ts      The route logic: gate, limits, validation, rate limit, streamed scoring
src/lib/ranking/provider.ts     ENABLE_REAL_RUNS gate, provider config, and the one boolean the page shows
src/lib/use-live-ranking.ts     Browser: sends a run, reads the stream, cancel, one run at a time
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
| `SCORING_PROVIDER` | unset | `anthropic` (the only adapter). |
| `SCORING_MODEL` | unset | `claude-haiku-5-5`. |
| `ANTHROPIC_API_KEY` | unset | Key from a workspace with a spend limit. Server only. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | unset | Set by the Upstash integration (`UPSTASH_REDIS_REST_*` also accepted). Without them live ranking refuses every run. |

The page tells the browser only whether live ranking is available (one boolean, computed on the server at build time). Changing env vars requires a redeploy.

## Deploy

Deployed with the Vercel CLI to the Vercel project `shortlist`. Pushing to GitHub does not deploy.

```bash
vercel link --project shortlist
vercel deploy --prod
```

## Privacy and guardrails

- All sample people and companies are fictional.
- PDF files never leave the browser. Extracted text is sent only when you click Rank, is scored, and is not stored or logged.
- Scores are a screening aid, not a hiring decision.
