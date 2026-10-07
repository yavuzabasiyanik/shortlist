// Input limits from the product brief. The future ranking API (SHORT-03)
// must enforce the same numbers on the server.

export const JOB_DESCRIPTION_MIN_CHARS = 100;
export const JOB_DESCRIPTION_MAX_CHARS = 10_000;

export const MAX_RESUMES = 20;
export const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5 MB per PDF
export const MAX_RESUME_TEXT_CHARS = 30_000; // extracted text per resume
