// Input limits from the product brief, shared by the browser and the
// ranking API so both enforce the same numbers.

export const JOB_DESCRIPTION_MIN_CHARS = 100;
export const JOB_DESCRIPTION_MAX_CHARS = 10_000;

export const MAX_RESUMES = 20;
// "5 MB" means 5 × 1024 × 1024 = 5,242,880 bytes. A file of exactly this
// size is accepted; one byte more is rejected.
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_TEXT_CHARS = 30_000; // extracted text per resume

export const MAX_FILE_NAME_CHARS = 255;
export const MAX_RESUME_ID_CHARS = 64;

// Whole ranking request body, checked while it is read. Vercel rejects
// bodies over 4.5 MB; the largest valid input is about 1.85 MB (see README).
export const MAX_REQUEST_BODY_BYTES = 2_000_000;
