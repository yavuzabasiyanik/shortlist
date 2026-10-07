import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as publicPost } from "@/app/api/rank/route";
import { MAX_REQUEST_BODY_BYTES } from "@/lib/limits";
import type { RankEvent } from "@/lib/ranking/events";
import { createRankHandler } from "@/lib/ranking/handler";
import { consoleLogger, type Logger } from "@/lib/ranking/log";
import { clientIdentifier, type LimitDecision, type RunLimiter } from "@/lib/ranking/rate-limit";
import { ScoringError, type Scorer } from "@/lib/ranking/score";

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

// An in-memory limiter with the same contract as the Upstash one.
function fakeLimiter(limit = 3) {
  const counts = new Map<string, number>();
  return {
    consume: vi.fn(async (id: string): Promise<LimitDecision> => {
      const used = (counts.get(id) ?? 0) + 1;
      counts.set(id, used);
      return { allowed: used <= limit, limit, remaining: Math.max(0, limit - used), reset: Date.now() + 3_600_000 };
    }),
  };
}

function setup({
  enabled = true,
  scorer = fakeScorer() as Scorer | null,
  limiter = fakeLimiter() as RunLimiter | null,
  log = vi.fn<Logger>(),
} = {}) {
  const getScorer = vi.fn(() => scorer);
  const POST = createRankHandler({ isEnabled: () => enabled, getScorer, getLimiter: () => limiter, clientId: () => "client-a", log });
  return { POST, getScorer, limiter, log };
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

async function events(response: Response): Promise<RankEvent[]> {
  return (await response.text()).trim().split("\n").map((line) => JSON.parse(line));
}

async function outcomes(response: Response) {
  return (await events(response)).flatMap((event) => (event.type === "result" ? [event.outcome] : []));
}

describe("environment gate", () => {
  it("a disabled deployment answers 503 without reading the body, rate limiting, or scoring", async () => {
    const scorer = fakeScorer();
    const limiter = fakeLimiter();
    const { POST, getScorer } = setup({ enabled: false, scorer, limiter });
    const { request, pulls } = countingStream(new TextEncoder().encode(JSON.stringify(body())), 1);

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("live_ranking_disabled");
    expect(pulls()).toBe(0);
    expect(getScorer).not.toHaveBeenCalled();
    expect(scorer).not.toHaveBeenCalled();
    expect(limiter.consume).not.toHaveBeenCalled();
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

    it("has no scorer when enabled without an API key", async () => {
      vi.stubEnv("ENABLE_REAL_RUNS", "true");
      vi.stubEnv("SCORING_PROVIDER", "anthropic");
      vi.stubEnv("SCORING_MODEL", "claude-haiku-5-5");
      vi.stubEnv("ANTHROPIC_API_KEY", "");
      const response = await publicPost(post(body()));
      expect(await errorCode(response)).toBe("scoring_not_configured");
    });

    it("fails closed when enabled and configured but Redis isn't", async () => {
      vi.stubEnv("ENABLE_REAL_RUNS", "true");
      vi.stubEnv("SCORING_PROVIDER", "anthropic");
      vi.stubEnv("SCORING_MODEL", "claude-haiku-5-5");
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key-not-used");
      for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) vi.stubEnv(key, "");
      const response = await publicPost(post(body()));
      expect(response.status).toBe(503);
      expect(await errorCode(response)).toBe("rate_limit_unavailable");
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
  ])("rejects %s with 400 before rate limiting or scoring", async (_, payload) => {
    const scorer = fakeScorer();
    const limiter = fakeLimiter();
    const { POST } = setup({ scorer, limiter });
    const response = await POST(post(payload));
    expect(response.status).toBe(400);
    expect(await errorCode(response)).toBe("invalid_request");
    expect(scorer).not.toHaveBeenCalled();
    expect(limiter.consume).not.toHaveBeenCalled();
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
  const padded = (size: number) => {
    const json = JSON.stringify(body());
    return json + " ".repeat(size - Buffer.byteLength(json));
  };

  it("accepts a body of exactly the limit", async () => {
    const { POST } = setup();
    expect((await POST(post(padded(MAX_REQUEST_BODY_BYTES)))).status).toBe(200);
  });

  it("rejects a body one byte over the limit with 413 before parsing, rate limiting, or scoring", async () => {
    const scorer = fakeScorer();
    const limiter = fakeLimiter();
    const { POST } = setup({ scorer, limiter });
    const response = await POST(post(padded(MAX_REQUEST_BODY_BYTES + 1)));
    expect(response.status).toBe(413);
    expect(scorer).not.toHaveBeenCalled();
    expect(limiter.consume).not.toHaveBeenCalled();
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
    const wide = "界";
    const largest = {
      jobDescription: wide.repeat(10_000),
      resumes: Array.from({ length: 20 }, (_, i) => ({
        id: `r${i}`.padEnd(64, "x"),
        fileName: `${wide.repeat(251)}${i}.pdf`.slice(0, 255),
        text: wide.repeat(30_000),
      })),
    };
    expect(Buffer.byteLength(JSON.stringify(largest))).toBeLessThan(MAX_REQUEST_BODY_BYTES);
    const { POST } = setup();
    expect(await outcomes(await POST(post(largest)))).toHaveLength(20);
  });
});

describe("rate limiting", () => {
  it("allows three runs per client and blocks the fourth with 429 and zero model calls", async () => {
    const scorer = fakeScorer();
    const { POST } = setup({ scorer, limiter: fakeLimiter(3) });
    const payload = body({ resumes: [resume("r1")] });

    for (let run = 1; run <= 3; run++) {
      const response = await POST(post(payload));
      expect(response.status).toBe(200);
      const start = (await events(response))[0];
      expect(start).toMatchObject({ type: "start", runsLeftToday: 3 - run });
    }
    expect(scorer).toHaveBeenCalledTimes(3);

    const fourth = await POST(post(payload));
    expect(fourth.status).toBe(429);
    expect(fourth.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await errorCode(fourth)).toBe("rate_limited");
    expect(scorer).toHaveBeenCalledTimes(3);
  });

  it("counts one run per request, not one per resume", async () => {
    const limiter = fakeLimiter();
    const { POST } = setup({ limiter });
    await (await POST(post(body({ resumes: Array.from({ length: 7 }, (_, i) => resume(`r${i}`)) })))).text();
    expect(limiter.consume).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the limiter throws, without scoring", async () => {
    const scorer = fakeScorer();
    const limiter = { consume: vi.fn(async () => Promise.reject(new Error("redis down"))) };
    const { POST } = setup({ scorer, limiter });
    const response = await POST(post(body()));
    expect(response.status).toBe(503);
    expect(await errorCode(response)).toBe("rate_limit_unavailable");
    expect(scorer).not.toHaveBeenCalled();
  });

  it("fails closed when no limiter is configured", async () => {
    const { POST } = setup({ limiter: null });
    expect(await errorCode(await POST(post(body())))).toBe("rate_limit_unavailable");
  });

  describe("client identity", () => {
    const request = (headers: Record<string, string>) => new Request(URL_, { headers });

    it("uses Vercel's x-vercel-forwarded-for and ignores client-supplied x-forwarded-for / x-real-ip", () => {
      const env = { VERCEL: "1" };
      const real = clientIdentifier(request({ "x-vercel-forwarded-for": "203.0.113.7" }), env);
      const spoofed = clientIdentifier(
        request({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2" }),
        env,
      );
      expect(spoofed).toBe(real);
      expect(clientIdentifier(request({ "x-vercel-forwarded-for": "203.0.113.8" }), env)).not.toBe(real);
    });

    it("stores a hash, not the IP", () => {
      const id = clientIdentifier(request({ "x-vercel-forwarded-for": "203.0.113.7" }), { VERCEL: "1" });
      expect(id).toMatch(/^[0-9a-f]{32}$/);
      expect(id).not.toContain("203");
    });

    it("off Vercel, puts every request in one shared bucket regardless of headers", () => {
      const a = clientIdentifier(request({ "x-forwarded-for": "198.51.100.1" }), {});
      const b = clientIdentifier(request({ "x-vercel-forwarded-for": "198.51.100.2" }), {});
      expect(a).toBe(b);
    });
  });
});

describe("streamed scoring (mocked scorer)", () => {
  it("streams start, one result per resume, and done as NDJSON", async () => {
    const scorer = fakeScorer();
    const { POST } = setup({ scorer });
    const response = await POST(post(body()));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");
    const all = await events(response);
    expect(all.map((event) => event.type)).toEqual(["start", "result", "result", "done"]);
    expect(all.at(-1)).toEqual({ type: "done", scored: 2, failed: 0 });

    const [first] = scorer.mock.calls[0];
    expect(first.system).toContain("not evidenced in the resume");
    expect(first.user).toContain("<file_name>r1.pdf</file_name>");
  });

  it.each([
    ["not JSON", "Sure! Here is the score: 80"],
    ["two strengths", goodOutput({ strengths: ["a", "b"] })],
    ["one gap", goodOutput({ gaps: ["a"] })],
    ["score 140", goodOutput({ score: 140 })],
    ["fractional score", goodOutput({ score: 55.5 })],
    ["one-sentence explanation", goodOutput({ explanation: "Strong fit." })],
    ["an extra key", goodOutput({ verdict: "hire" })],
  ])("turns a malformed response (%s) into an error row; other resumes still finish", async (_, bad) => {
    const { POST } = setup({ scorer: fakeScorer({ "r1.pdf": bad }) });
    const results = await outcomes(await POST(post(body())));
    expect(results.find((r) => r.id === "r1")).toMatchObject({ ok: false, error: { code: "invalid_model_output" } });
    expect(results.find((r) => r.id === "r2")).toMatchObject({ ok: true });
  });

  it.each([
    ["refusal", "refusal"],
    ["timeout", "timeout"],
    ["truncated", "truncated"],
    ["provider_error", "provider_error"],
  ] as const)("reports a %s for one resume and finishes the others", async (kind, code) => {
    const { POST } = setup({ scorer: fakeScorer({ "r2.pdf": new ScoringError(kind) }) });
    const results = await outcomes(await POST(post(body())));
    expect(results.find((r) => r.id === "r2")).toMatchObject({ ok: false, error: { code } });
    expect(results.find((r) => r.id === "r1")).toMatchObject({ ok: true });
  });

  it("emits a stopped event and not-scored rows when the provider rejects the account", async () => {
    const { POST } = setup({ scorer: fakeScorer({ "r1.pdf": new ScoringError("run_stop") }) });
    const all = await events(await POST(post(body({ resumes: [resume("r1")] }))));
    expect(all.map((event) => event.type)).toEqual(["start", "result", "stopped", "done"]);
    expect(all[1]).toMatchObject({ type: "result", outcome: { id: "r1", ok: false, error: { code: "run_stopped" } } });
  });

  it.each([
    ["empty", { candidateName: "" }],
    ["blank", { candidateName: "   " }],
    ["null", { candidateName: null }],
    ["missing", { candidateName: undefined }],
  ])("falls back to the file name when the candidate name is %s", async (_, overrides) => {
    const { POST } = setup({ scorer: fakeScorer({ "Jane_Resume_2026.pdf": goodOutput(overrides) }) });
    const payload = body({ resumes: [resume("r1", { fileName: "Jane_Resume_2026.pdf" })] });
    const [result] = await outcomes(await POST(post(payload)));
    expect(result.ok && result.result.candidateName).toBe("Jane_Resume_2026.pdf");
  });

  it("keeps ids distinct for resumes with the same file name", async () => {
    const { POST } = setup();
    const twins = body({ resumes: [resume("a", { fileName: "cv.pdf" }), resume("b", { fileName: "cv.pdf" })] });
    const results = await outcomes(await POST(post(twins)));
    expect(results.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("stops scheduling model calls when the browser cancels the stream", async () => {
    const release: (() => void)[] = [];
    const scorer = vi.fn<Scorer>(
      (_, signal) =>
        new Promise((resolve, reject) => {
          release.push(() => resolve(goodOutput()));
          signal.addEventListener("abort", () => reject(new ScoringError("cancelled")));
        }),
    );
    const { POST, log } = setup({ scorer });
    const response = await POST(post(body({ resumes: Array.from({ length: 12 }, (_, i) => resume(`r${i}`)) })));
    const reader = response.body!.getReader();
    await reader.read(); // start event
    await vi.waitFor(() => expect(scorer).toHaveBeenCalledTimes(5));

    await reader.cancel();
    release.forEach((resolve) => resolve());
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith("rank.completed", expect.objectContaining({ cancelled: true })));
    expect(scorer).toHaveBeenCalledTimes(5);
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
    const handlers = [true, false].map((enabled) =>
      createRankHandler({ isEnabled: () => enabled, getScorer: () => scorer, getLimiter: () => fakeLimiter(100), clientId: () => "c", log: consoleLogger }),
    );

    for (const POST of handlers) {
      await (await POST(post({ jobDescription: job, resumes }))).text();
      await (await POST(post({ jobDescription: MARK, resumes }))).text();
      await (await POST(post(`{"jobDescription": "${MARK}`))).text();
      await (await POST(post(`${JSON.stringify({ jobDescription: job, resumes })}${" ".repeat(MAX_REQUEST_BODY_BYTES)}`))).text();
    }

    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.join("\n")).not.toContain(MARK);
  });
});
