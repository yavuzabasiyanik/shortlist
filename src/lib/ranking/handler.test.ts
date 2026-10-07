import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as publicPost } from "@/app/api/rank/route";
import { MAX_REQUEST_BODY_BYTES } from "@/lib/limits";
import { consoleLogger, createRankHandler, type Logger } from "@/lib/ranking/handler";
import type { Scorer } from "@/lib/ranking/score";

const URL_ = "http://localhost/api/rank";
const JOB = "Senior Frontend Engineer. Must have: React, TypeScript, testing. ".repeat(3);

const goodOutput = (overrides: object = {}) =>
  JSON.stringify({
    candidateName: "Ada Example",
    score: 81,
    strengths: ["React since 2019", "TypeScript in production", "Writes Playwright tests"],
    gaps: ["Next.js is not evidenced in the resume", "Mentoring is not evidenced in the resume"],
    explanation: "Ada meets the React and TypeScript requirements. Next.js is not evidenced in the resume.",
    ...overrides,
  });

// A fake scorer that answers per file name, read back out of the prompt.
function fakeScorer(byFile: Record<string, string | Error> = {}) {
  return vi.fn<Scorer>(async ({ user }) => {
    const fileName = user.match(/<file_name>(.*)<\/file_name>/)?.[1] ?? "";
    const answer = byFile[fileName] ?? goodOutput();
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

function setup({ enabled = true, scorer = fakeScorer() as Scorer | null, log = vi.fn<Logger>() } = {}) {
  const getScorer = vi.fn(() => scorer);
  const POST = createRankHandler({ isEnabled: () => enabled, getScorer, log });
  return { POST, getScorer, log };
}

const resume = (id: string, overrides: object = {}) => ({ id, fileName: `${id}.pdf`, text: "React, TypeScript, Playwright since 2019.", ...overrides });
const body = (overrides: object = {}) => ({ jobDescription: JOB, resumes: [resume("r1"), resume("r2")], ...overrides });

function post(payload: unknown, headers: Record<string, string> = {}) {
  return new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

// A body stream that counts how often it is read from.
function countingStream(chunk: Uint8Array, maxChunks = Infinity) {
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls++;
        if (pulls > maxChunks) controller.close();
        else controller.enqueue(chunk);
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request(URL_, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit);
  return { request, pulls: () => pulls };
}

async function errorCode(response: Response) {
  return ((await response.json()) as { error: { code: string } }).error.code;
}

describe("environment gate", () => {
  it("a disabled deployment answers 503 without reading the body or reaching scoring", async () => {
    const scorer = fakeScorer();
    const { POST, getScorer } = setup({ enabled: false, scorer });
    const { request, pulls } = countingStream(new TextEncoder().encode(JSON.stringify(body())), 1);

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("live_ranking_disabled");
    expect(pulls()).toBe(0);
    expect(getScorer).not.toHaveBeenCalled();
    expect(scorer).not.toHaveBeenCalled();
  });

  it("an enabled deployment with no provider configured answers 503", async () => {
    const { POST } = setup({ scorer: null });
    const response = await POST(post(body()));
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("scoring_not_configured");
  });

  describe("the public route", () => {
    afterEach(() => vi.unstubAllEnvs());

    it.each([
      ["unset", {}],
      ["false", { ENABLE_REAL_RUNS: "false" }],
      ["TRUE", { ENABLE_REAL_RUNS: "TRUE" }],
    ])("is disabled when ENABLE_REAL_RUNS is %s", async (_, env) => {
      vi.stubEnv("ENABLE_REAL_RUNS", undefined);
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value as string);
      const response = await publicPost(post(body()));
      expect(response.status).toBe(503);
      expect(await errorCode(response)).toBe("live_ranking_disabled");
    });

    it("has no scorer even when enabled and configured, because no provider adapter exists yet", async () => {
      vi.stubEnv("ENABLE_REAL_RUNS", "true");
      vi.stubEnv("SCORING_PROVIDER", "anthropic");
      vi.stubEnv("SCORING_MODEL", "any-model");
      const response = await publicPost(post(body()));
      expect(response.status).toBe(503);
      expect(await errorCode(response)).toBe("scoring_not_configured");
    });
  });
});

describe("request validation", () => {
  it.each([
    ["no resumes", body({ resumes: [] })],
    ["21 resumes", body({ resumes: Array.from({ length: 21 }, (_, i) => resume(`r${i}`)) })],
    ["duplicate ids", body({ resumes: [resume("same"), resume("same")] })],
    ["a 99-character job description", body({ jobDescription: "a".repeat(99) })],
    ["a 10,001-character job description", body({ jobDescription: "a".repeat(10_001) })],
    ["empty resume text", body({ resumes: [resume("r1", { text: "  " })] })],
    ["resume text over 30,000 characters", body({ resumes: [resume("r1", { text: "x".repeat(30_001) })] })],
    ["a 256-character file name", body({ resumes: [resume("r1", { fileName: "f".repeat(256) })] })],
    ["a 65-character id", body({ resumes: [resume("i".repeat(65))] })],
  ])("rejects %s with 400 before scoring", async (_, payload) => {
    const scorer = fakeScorer();
    const { POST } = setup({ scorer });
    const response = await POST(post(payload));
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
    expect(scorer).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content types, invalid JSON, and invalid UTF-8", async () => {
    const { POST } = setup();
    expect((await POST(post(body(), { "content-type": "text/plain" }))).status).toBe(415);
    expect(await errorCode(await POST(post("{not json")))).toBe("invalid_json");
    const badUtf8 = new Request(URL_, { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([0x7b, 0xff, 0x7d]) });
    expect(await errorCode(await POST(badUtf8))).toBe("invalid_encoding");
  });
});

describe(`request body limit (${MAX_REQUEST_BODY_BYTES.toLocaleString("en-US")} bytes)`, () => {
  // Pads valid JSON with trailing spaces to an exact byte size.
  const padded = (size: number) => {
    const json = JSON.stringify(body());
    return json + " ".repeat(size - Buffer.byteLength(json));
  };

  it("accepts a body of exactly the limit", async () => {
    const { POST } = setup();
    const text = padded(MAX_REQUEST_BODY_BYTES);
    expect(Buffer.byteLength(text)).toBe(MAX_REQUEST_BODY_BYTES);
    expect((await POST(post(text))).status).toBe(200);
  });

  it("rejects a body one byte over the limit with 413 before parsing or scoring", async () => {
    const scorer = fakeScorer();
    const { POST } = setup({ scorer });
    const response = await POST(post(padded(MAX_REQUEST_BODY_BYTES + 1)));
    expect(response.status).toBe(413);
    expect(await errorCode(response)).toBe("body_too_large");
    expect(scorer).not.toHaveBeenCalled();
  });

  it("rejects early on a declared Content-Length over the limit, without reading", async () => {
    const { POST } = setup();
    const { request, pulls } = countingStream(new Uint8Array(10), 1);
    request.headers.set("content-length", String(MAX_REQUEST_BODY_BYTES + 1));
    expect((await POST(request)).status).toBe(413);
    expect(pulls()).toBe(0);
  });

  it("stops reading an endless body as soon as it passes the limit", async () => {
    const { POST } = setup();
    const chunkSize = 64 * 1024;
    const { request, pulls } = countingStream(new Uint8Array(chunkSize).fill(32));
    expect((await POST(request)).status).toBe(413);
    expect(pulls()).toBe(Math.floor(MAX_REQUEST_BODY_BYTES / chunkSize) + 1);
  });

  it("fits the largest valid input, even with 3-byte UTF-8 characters everywhere", async () => {
    const wide = "界"; // 3 bytes in UTF-8, the most a single UTF-16 unit can take
    const largest = {
      jobDescription: wide.repeat(10_000),
      resumes: Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`.padEnd(64, "x"),
        fileName: `${wide.repeat(251)}${i}.pdf`.slice(0, 255),
        text: wide.repeat(30_000),
      })),
    };
    const bytes = Buffer.byteLength(JSON.stringify(largest));
    expect(bytes).toBeGreaterThan(1_800_000);
    expect(bytes).toBeLessThan(MAX_REQUEST_BODY_BYTES);

    const { POST } = setup();
    const response = await POST(post(largest));
    expect(response.status).toBe(200);
    expect(((await response.json()) as { results: unknown[] }).results).toHaveLength(20);
  });
});

describe("scoring pipeline (mocked scorer)", () => {
  it("scores each valid resume with the system prompt and its own data", async () => {
    const scorer = fakeScorer();
    const { POST } = setup({ scorer });
    const response = await POST(post(body()));

    expect(response.status).toBe(200);
    expect(scorer).toHaveBeenCalledTimes(2);
    const [first] = scorer.mock.calls[0];
    expect(first.system).toContain("not evidenced in the resume");
    expect(first.user).toContain("<file_name>r1.pdf</file_name>");
    expect(first.user).toContain(JOB.trim().slice(0, 40));

    const { results } = (await response.json()) as { results: { id: string; ok: boolean; result: { score: number } }[] };
    expect(results.map((r) => [r.id, r.ok, r.result.score])).toEqual([
      ["r1", true, 81],
      ["r2", true, 81],
    ]);
  });

  it.each([
    ["not JSON", "Sure! Here is the score: 80"],
    ["two strengths", goodOutput({ strengths: ["a", "b"] })],
    ["one gap", goodOutput({ gaps: ["a"] })],
    ["score 140", goodOutput({ score: 140 })],
    ["fractional score", goodOutput({ score: 55.5 })],
    ["one-sentence explanation", goodOutput({ explanation: "Strong fit." })],
    ["missing explanation", goodOutput({ explanation: undefined })],
    ["an extra key", goodOutput({ verdict: "hire" })],
  ])("turns a malformed response (%s) into an error row; other resumes still finish", async (_, bad) => {
    const { POST } = setup({ scorer: fakeScorer({ "r1.pdf": bad }) });
    const { results } = (await (await POST(post(body()))).json()) as {
      results: { id: string; ok: boolean; error?: { code: string } }[];
    };
    expect(results[0]).toMatchObject({ id: "r1", ok: false, error: { code: "invalid_model_output" } });
    expect(results[1]).toMatchObject({ id: "r2", ok: true });
  });

  it("turns a scorer exception into an error row", async () => {
    const { POST } = setup({ scorer: fakeScorer({ "r2.pdf": new Error("provider down") }) });
    const { results } = (await (await POST(post(body()))).json()) as { results: { ok: boolean; error?: { code: string } }[] };
    expect(results[0].ok).toBe(true);
    expect(results[1]).toMatchObject({ ok: false, error: { code: "scoring_failed" } });
  });

  it.each([
    ["empty", { candidateName: "" }],
    ["blank", { candidateName: "   " }],
    ["null", { candidateName: null }],
    ["missing", { candidateName: undefined }],
  ])("falls back to the file name when the candidate name is %s", async (_, overrides) => {
    const { POST } = setup({ scorer: fakeScorer({ "Jane_Resume_2026.pdf": goodOutput(overrides) }) });
    const payload = body({ resumes: [resume("r1", { fileName: "Jane_Resume_2026.pdf" })] });
    const { results } = (await (await POST(post(payload))).json()) as { results: { result: { candidateName: string } }[] };
    expect(results[0].result.candidateName).toBe("Jane_Resume_2026.pdf");
  });
});

describe("logging", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never writes job, resume, or file-name contents to the logs", async () => {
    const MARK = "SECRETMARKER9921";
    const lines: string[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args) => void lines.push(args.map(String).join(" ")));
    }
    const job = `${MARK} job. `.repeat(10);
    const resumes = [
      resume("ok", { fileName: `${MARK}-a.pdf`, text: `${MARK} resume text` }),
      resume("bad", { fileName: `${MARK}-b.pdf`, text: `${MARK} resume text` }),
      resume("boom", { fileName: `${MARK}-c.pdf`, text: `${MARK} resume text` }),
    ];
    const scorer = fakeScorer({
      [`${MARK}-b.pdf`]: `not json ${MARK}`,
      [`${MARK}-c.pdf`]: new Error(`provider echoed ${MARK}`),
    });
    const handlers = [
      createRankHandler({ isEnabled: () => true, getScorer: () => scorer, log: consoleLogger }),
      createRankHandler({ isEnabled: () => false, getScorer: () => scorer, log: consoleLogger }),
    ];

    for (const POST of handlers) {
      await POST(post({ jobDescription: job, resumes }));
      await POST(post({ jobDescription: MARK, resumes }));
      await POST(post(`{"jobDescription": "${MARK}`));
      await POST(post(`${JSON.stringify({ jobDescription: job, resumes })}${" ".repeat(MAX_REQUEST_BODY_BYTES)}`));
    }

    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.join("\n")).not.toContain(MARK);
  });
});
