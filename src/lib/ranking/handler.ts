import { MAX_REQUEST_BODY_BYTES } from "@/lib/limits";
import { readBodyWithLimit } from "@/lib/ranking/read-body";
import { RankRequestSchema } from "@/lib/ranking/schema";
import { rankResumes, type Scorer } from "@/lib/ranking/score";

// Logs carry only counts and codes, never job descriptions, resume text,
// file names, or error messages that could echo them.
export type Logger = (event: string, fields: Record<string, number | string | boolean>) => void;

export const consoleLogger: Logger = (event, fields) => {
  console.info(JSON.stringify({ event, ...fields }));
};

export type RankHandlerDeps = {
  isEnabled: () => boolean;
  getScorer: () => Scorer | null;
  log: Logger;
};

function errorResponse(status: number, code: string, message: string, extra?: object) {
  return Response.json(
    { error: { code, message, ...extra } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

// Built as a factory so tests can pass a fake scorer and gate. The public
// route (app/api/rank/route.ts) wires in the real ones only.
export function createRankHandler({ isEnabled, getScorer, log }: RankHandlerDeps) {
  return async function POST(request: Request): Promise<Response> {
    const reject = (status: number, code: string, message: string, extra?: object) => {
      log("rank.rejected", { status, code });
      return errorResponse(status, code, message, extra);
    };

    // Gate first: a disabled deployment reads nothing and calls nothing.
    if (!isEnabled()) {
      return reject(503, "live_ranking_disabled", "Live ranking is not enabled on this deployment. Try the sample data instead.");
    }
    const scorer = getScorer();
    if (!scorer) {
      return reject(503, "scoring_not_configured", "No scoring provider is configured on this deployment.");
    }

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return reject(415, "unsupported_media_type", "Send the request as application/json.");
    }

    const body = await readBodyWithLimit(request, MAX_REQUEST_BODY_BYTES);
    if (!body.ok) {
      return body.reason === "too_large"
        ? reject(413, "body_too_large", `The request body is over the ${MAX_REQUEST_BODY_BYTES.toLocaleString("en-US")}-byte limit.`)
        : reject(400, "invalid_encoding", "The request body is not valid UTF-8.");
    }

    let json: unknown;
    try {
      json = JSON.parse(body.text);
    } catch {
      return reject(400, "invalid_json", "The request body is not valid JSON.");
    }

    const parsed = RankRequestSchema.safeParse(json);
    if (!parsed.success) {
      // Paths and messages only; Zod messages don't include the input values.
      const issues = parsed.error.issues.slice(0, 20).map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return reject(400, "invalid_request", "The request didn't pass validation.", { issues });
    }

    const started = Date.now();
    const results = await rankResumes(parsed.data, scorer);
    log("rank.completed", {
      resumes: results.length,
      failed: results.filter((outcome) => !outcome.ok).length,
      ms: Date.now() - started,
    });
    return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
  };
}
