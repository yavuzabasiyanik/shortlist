# Shortlist — Product Brief

Oct 7, 2026 · Yavuz Abasiyanik

## How to use this brief

This is the source of truth for Shortlist, an AI resume ranker. The product owner (PO) uses it to write tickets, decide scope, and say no to anything outside the MVP.

- Scope questions are answered by the MVP section. Anything not listed there is out.
- Every ticket the PO writes maps to one user story below and carries its acceptance criteria.
- The PO optimizes for one outcome: a polished, deployed demo shipped in about a week, not a full product.

## Problem, user, and goal

A recruiter with one job opening and 20+ resumes spends hours screening by hand. Shortlist takes a job description and a stack of resumes and returns a ranked shortlist, with the reasons for each rank, in under a minute.

**User:** a recruiter or hiring manager at a small company with no applicant tracking system.

**Real goal:** this is a portfolio project for my startup job search. It must be live at a public URL, look professional, and show I can ship an AI product end to end: file handling, LLM prompting with structured output, streaming UI, and deployment. Success = a reviewer opens the link, tries it with the sample data, and understands it in 30 seconds.

## MVP scope

The MVP is one page, one flow: paste a job description, upload resumes, get a ranked list. No accounts, no database.

| In the MVP | Out of the MVP (say no) |
| --- | --- |
| Paste or type a job description | User accounts, login, saved history |
| Upload 1–20 PDF resumes (drag and drop) | DOCX, images, OCR of scanned PDFs |
| Score each resume 0–100 against the job | Emailing candidates, ATS integrations |
| Ranked results table with strengths and gaps per candidate | Bias audits, multi-job comparison |
| Results stream in as each resume finishes | Payments, teams, admin panel |
| "Try with sample data" button (fake job + 5 fake resumes) | Mobile app |
| Export results as CSV | Storing resumes after the request ends |

## User stories and acceptance criteria

Each story is one ticket. A ticket is done only when every criterion under it passes.

1. **Enter a job description.** As a recruiter, I paste a job description so resumes are judged against it.
   - Text box accepts up to 10,000 characters and shows a character count.
   - "Rank" stays disabled until the job description has at least 100 characters.
2. **Upload resumes.** As a recruiter, I drag and drop PDF resumes.
   - Accepts 1–20 PDFs, max 5 MB each; anything else shows a clear error naming the file.
   - Each file appears in a list with its name and a remove button.
3. **Get ranked results.** As a recruiter, I click Rank and see candidates sorted by fit.
   - Each row shows rank, candidate name (from the resume, or the file name if none is found), score 0–100, top 3 strengths, top 2 gaps.
   - Rows appear as each resume finishes (streaming); the table re-sorts by score.
   - A failed resume shows an error row; the rest still finish.
4. **Try it instantly.** As a first-time visitor, I click "Try with sample data" and see results without uploading anything.
   - Loads a fake job description and 5 fake resumes bundled with the app.
5. **Export.** As a recruiter, I download the results as a CSV.
   - CSV has the same columns as the table, in rank order.
6. **Trust the result.** As a recruiter, I expand a row and see why it scored that way.
   - A 2–3 sentence explanation that cites specific skills or experience from the resume.

## Tech stack and architecture

One Next.js app on Vercel, no separate backend and no database. The PO must not add services beyond this table.

| Layer | Choice | Why |
| --- | --- | --- |
| Front end | Next.js (App Router), React, TypeScript, Tailwind | Matches my stack; fast to ship |
| API | Next.js route handler (Node runtime) | One deploy, no extra infra |
| PDF parsing | `pdfjs-dist`, in the browser | Text extraction only; no OCR. Raw PDFs never leave the browser |
| LLM | OpenAI or Anthropic API via an SDK with structured (JSON schema) output | Reliable, typed scores |
| Validation | Zod schema for the LLM response | Rejects malformed output |
| Streaming | Server streams one result per resume as it finishes | Shows real-time UI skill |
| Rate limiting | Upstash Redis (Vercel Marketplace, free tier) with `@upstash/ratelimit` | 3 real ranking runs per IP per day. Used only for rate limiting; no resume data is stored |
| Hosting | Vercel, API key in environment variables | Free tier, public URL |

Request flow:

1. Browser extracts text from each PDF with `pdfjs-dist`. The PDF file itself is never uploaded.
2. Browser sends the job description, extracted text, and file names to the route handler. The server validates the request: at most 20 resumes, at most 30,000 characters per resume, and an aggregate request-size limit.
3. Server calls the LLM once per resume, in parallel (max 5 at a time).
4. Each validated result streams back to the browser as soon as it is ready.
5. Browser inserts the row and re-sorts the table. Nothing is stored after the request ends.

## Approved amendments

These were approved after the original brief and override it where they conflict.

- **PDF parsing in the browser.** Text is extracted client-side with `pdfjs-dist`. Raw PDFs never leave the browser.
- **API input.** The future API receives extracted text and file names, not files. It validates a maximum of 20 resumes, caps each resume at 30,000 characters, and enforces an aggregate request-size limit.
- **Rate limiting.** Upstash Redis through the Vercel Marketplace, free tier, is permitted only for per-IP rate limiting with `@upstash/ratelimit`: three real ranking runs per IP per day. No resume data is stored in Redis.
- **Real runs off by default.** The server-only flag `ENABLE_REAL_RUNS=false` keeps real runs disabled until the spending cap and the deployed rate limit are verified.
- **Sample mode is free.** Sample results are bundled and precomputed, with zero model calls.

## Tickets

| Ticket | Scope |
| --- | --- |
| Milestone 1 | Skeleton and first deployment (done) |
| SHORT-01 | Job description input (story 1) |
| SHORT-02 | PDF upload (story 2) |
| SHORT-03 | Live ranking and streaming (story 3) |
| SHORT-04 | Complete sample-data experience (story 4) |
| SHORT-05 | CSV export (story 5) |
| SHORT-06 | Expandable explanations (story 6) |

## LLM output schema and prompt rules

Every LLM call returns exactly this JSON, validated with Zod before it reaches the UI:

```json
{
  "candidateName": "string",
  "score": 0,
  "strengths": ["string", "string", "string"],
  "gaps": ["string", "string"],
  "explanation": "string (2-3 sentences)"
}
```

Prompt rules:

- Score only on job-relevant skills, experience, and requirements stated in the job description.
- Ignore name, gender, age, photo, nationality, and school prestige; say so in the system prompt.
- Every strength and gap must point to something actually in the resume or the job description. No invented facts.
- Missing must-have requirements cap the score at 60.
- Temperature low (0–0.2) so the same input gives near-identical scores.

## Build order and definition of done

Ship in this order. Deploy to Vercel after step 1 and keep it deployed, so there is always a working public link.

- [ ] 1. Skeleton: Next.js app, layout, deployed to Vercel
- [ ] 2. Job description input + PDF upload with validation (stories 1–2)
- [ ] 3. Route handler: PDF text extraction + one LLM call + Zod validation, non-streaming
- [ ] 4. Parallel calls + streaming results into the table (story 3)
- [ ] 5. Sample data button (story 4)
- [ ] 6. Expandable explanation + CSV export (stories 5–6)
- [ ] 7. Polish: empty/loading/error states, responsive layout, favicon, page title
- [ ] 8. README: one-line pitch, screenshot or GIF, live link, stack, how to run locally

**Done means:** live public URL, sample data works with zero setup, no console errors, README complete, and I can explain every file in an interview.

## Guardrails

- **Clean-room build.** Written from scratch in my own repo. No code, prompts, or data from any previous company.
- **No real personal data.** Sample resumes are fictional. Uploaded resumes are never stored or logged.
- **Cost control.** Cap at 20 resumes per request; show a notice that the demo uses a rate-limited API key.
- **Honest framing.** The UI and README say scores are a screening aid, not a hiring decision.
