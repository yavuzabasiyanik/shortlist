import { JOB_DESCRIPTION_MAX_CHARS, JOB_DESCRIPTION_MIN_CHARS, MAX_RESUMES } from "@/lib/limits";
import type { ResumeFile } from "@/lib/use-resume-files";

// Whether your own inputs are ready to rank. Shared by the inputs panel and
// the workspace, which promotes Rank over the sample action once ready.
export function inputReadiness(jobDescription: string, files: ResumeFile[]) {
  const jobReady = jobDescription.length >= JOB_DESCRIPTION_MIN_CHARS && jobDescription.length <= JOB_DESCRIPTION_MAX_CHARS;
  const parsing = files.filter((file) => file.status === "parsing").length;
  const failed = files.filter((file) => file.status === "error").length;
  const resumesReady = files.length >= 1 && files.length <= MAX_RESUMES && parsing === 0 && failed === 0;
  return { jobReady, parsing, failed, resumesReady, ready: jobReady && resumesReady };
}
