import { describe, expect, it, vi } from "vitest";
import { COUNT_TIMEOUT_MS, createAnthropicScorer, MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS } from "@/lib/ranking/anthropic-scorer";
import type { Logger } from "@/lib/ranking/log";

// The SDK runs against a fake fetch: no network, no API key, no cost.
const json = (status: number, body: object, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const message = (overrides: object = {}) =>
  json(200, {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text: '{"ok":true}' }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 180 },
    ...overrides,
  });

const apiError = (status: number, type: string, msg: string, extra: object = {}) =>
  json(status, { type: "error", error: { type, message: msg, ...extra } });

// `fetch` sees only scoring calls (POST /v1/messages); `count` sees the
// token count that precedes each one (POST /v1/messages/count_tokens).
function setup(
  respond: (init: RequestInit) => Response | Promise<Response>,
  timeoutMs?: number,
  countRespond: (init: RequestInit) => Response | Promise<Response> = () => json(200, { input_tokens: 1200 }),
) {
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => respond(init ?? {}));
  const count = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => countRespond(init ?? {}));
  const route = (url: string | URL | Request, init?: RequestInit) => (String(url).includes("/count_tokens") ? count(url, init) : fetch(url, init));
  const log = vi.fn<Logger>();
  const scorer = createAnthropicScorer({ apiKey: "test-key", model: "claude-haiku-5-5", log, fetch: route as typeof globalThis.fetch, timeoutMs });
  const call = (signal = new AbortController().signal) => scorer({ system: "system", user: "user" }, signal);
  return { fetch, count, log, call };
}

describe("createAnthropicScorer", () => {
  it("sends a bounded, structured-output request without temperature", async () => {
    const { fetch, call } = setup(() => message());
    expect(await call()).toBe('{"ok":true}');

    const sent = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(sent).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: MAX_OUTPUT_TOKENS,
      system: "system",
      messages: [{ role: "user", content: "user" }],
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
    expect(sent.output_config.format.schema.required).toEqual(["candidateName", "score", "reason", "strengths", "gaps", "explanation"]);
    expect(sent).not.toHaveProperty("temperature");
    expect(sent).not.toHaveProperty("top_p");
  });

  it("logs token usage and nothing from the prompt or response", async () => {
    const { log, call } = setup(() => message({ content: [{ type: "text", text: '{"name":"MARKER7731"}' }] }));
    await call();
    expect(log).toHaveBeenCalledWith("rank.model_call", expect.objectContaining({ input_tokens: 1200, output_tokens: 180, stop_reason: "end_turn" }));
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/MARKER7731|system|user/);
  });

  it.each([
    ["refusal", "refusal"],
    ["max_tokens", "truncated"],
  ])("maps stop_reason %s to %s", async (stopReason, kind) => {
    const { call } = setup(() => message({ stop_reason: stopReason }));
    await expect(call()).rejects.toMatchObject({ kind });
  });

  it.each([
    [400, "invalid_request_error", "You have reached your specified workspace API usage limits.", {}],
    [429, "rate_limit_error", "You have reached your API usage limits.", { details: { error_code: "enforced_spend_limit_reached" } }],
    [402, "billing_error", "Billing problem.", {}],
    [401, "authentication_error", "Invalid key.", {}],
  ])("stops the run on HTTP %i (spend limit, billing, auth) after exactly one request", async (status, type, msg, extra) => {
    const { fetch, call } = setup(() => apiError(status, type, msg, extra));
    await expect(call()).rejects.toMatchObject({ kind: "run_stop" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("counts the exact request first and sends it only when within the input-token limit", async () => {
    const { fetch, count, call } = setup(() => message());
    await call();
    expect(count).toHaveBeenCalledTimes(1);
    const counted = JSON.parse(String(count.mock.calls[0][1]?.body));
    const sent = JSON.parse(String(fetch.mock.calls[0][1]?.body));
    expect(counted).toEqual({ model: sent.model, system: sent.system, messages: sent.messages, output_config: sent.output_config });
  });

  it.each([
    [MAX_INPUT_TOKENS, 1],
    [MAX_INPUT_TOKENS + 1, 0],
  ])("with %i counted input tokens, makes %i scoring calls", async (tokens, calls) => {
    const { fetch, log, call } = setup(() => message(), undefined, () => json(200, { input_tokens: tokens }));
    if (calls) await call();
    else {
      await expect(call()).rejects.toMatchObject({ kind: "too_long" });
      expect(log).toHaveBeenCalledWith("rank.input_too_long", expect.objectContaining({ input_tokens: tokens }));
    }
    expect(fetch).toHaveBeenCalledTimes(calls);
  });

  it("bounds the worst case per call at $0.006 (under 100K tokens: $0.10 in, $0.50 out per MTok)", () => {
    expect(MAX_INPUT_TOKENS).toBeLessThan(100_000);
    expect((MAX_INPUT_TOKENS * 0.1 + MAX_OUTPUT_TOKENS * 0.5) / 1e6).toBeCloseTo(0.006, 6);
    expect(COUNT_TIMEOUT_MS).toBe(10_000);
  });

  it.each([
    [401, "authentication_error", "run_stop"],
    [429, "rate_limit_error", "run_stop"],
    [500, "api_error", "provider_error"],
  ])("treats a %i from the token count like one from scoring, and never scores", async (status, type, kind) => {
    const { fetch, count, call } = setup(() => message(), undefined, () => apiError(status, type, "x"));
    await expect(call()).rejects.toMatchObject({ kind });
    expect(count).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  // A per-minute rate limit sends retry-after. There is no retry, so the
  // header is never ignored and no time is spent waiting inside the run's
  // deadline; the run stops and the rest are reported as not scored.
  it("stops the run on a rate-limit 429 with retry-after, without waiting or retrying", async () => {
    const { fetch, call } = setup(() =>
      json(429, { type: "error", error: { type: "rate_limit_error", message: "Rate limited." } }, { "retry-after": "30" }),
    );
    const started = Date.now();
    await expect(call()).rejects.toMatchObject({ kind: "run_stop" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it.each([500, 529])("fails only this resume on HTTP %i, with no retries", async (status) => {
    const { fetch, call } = setup(() => apiError(status, "api_error", "Server error."));
    await expect(call()).rejects.toMatchObject({ kind: "provider_error" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("times out a slow call once, with no retries", async () => {
    const { fetch, call } = setup(
      (init) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
      50,
    );
    await expect(call()).rejects.toMatchObject({ kind: "timeout" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports cancellation when the run's signal aborts", async () => {
    const controller = new AbortController();
    const { call } = setup(
      (init) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
    );
    const pending = call(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "cancelled" });
  });
});
