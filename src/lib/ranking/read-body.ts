// Reads a request body as UTF-8 text, giving up as soon as it passes
// `maxBytes`. An oversized body is never fully buffered or parsed.

export type BodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "invalid_encoding" };

export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<BodyResult> {
  // Fast path: trust a declared length only to reject early. Chunked or
  // mislabelled bodies are still counted below.
  const declared = Number(request.headers.get("content-length"));
  if (declared > maxBytes) return { ok: false, reason: "too_large" };
  if (!request.body) return { ok: true, text: "" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { ok: false, reason: "invalid_encoding" };
  }
}
