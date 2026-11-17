import { ServiceError } from "../domain/identity.js";

export async function jsonResponse(response: Response, maxBytes = 512_000): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 401 || response.status === 403) {
      throw new ServiceError("denied", "Exact denied this personal connection or resource. Check permissions or reconnect.", 403);
    }
    throw new ServiceError(response.status === 429 ? "limited" : "unavailable",
      "Exact is unavailable or limited. No complete result was established.", response.status === 429 ? 429 : 503);
  }
  return readJson(response, maxBytes);
}

async function readJson(response: Response, maxBytes: number): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ServiceError("unavailable", "Exact returned no readable response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ServiceError("unavailable", "Exact returned more data than this bounded query accepts. Narrow the query.");
    }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ServiceError("unavailable", "Exact returned malformed JSON. No complete result was established."); }
}

/** Exact refused a change (validation, missing record or conflict): report its reason; nothing was changed. */
export async function changeResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    throw new ServiceError("denied", "Exact refused this change for your account. Check your Exact permissions or reconnect. Nothing was changed.", 403);
  }
  if (response.status === 429) {
    await response.body?.cancel();
    throw new ServiceError("limited", "Exact is busy and refused the change. Nothing was changed. Try again shortly.", 429);
  }
  if (response.status >= 400 && response.status < 500 && response.status !== 408) {
    const raw = await readJson(response, 16_000).catch(() => undefined) as { error?: { message?: { value?: unknown } } } | undefined;
    const reason = typeof raw?.error?.message?.value === "string" ?
      raw.error.message.value.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, 300) : "";
    throw new ServiceError("invalid_input", `Exact refused the change${reason ? `: ${reason}` : "."} Nothing was changed.`, 400);
  }
  return jsonResponse(response);
}

export function rowsEnvelope(value: unknown): { rows: unknown[]; next?: string } {
  const d = value && typeof value === "object" && "d" in value ? value.d : undefined;
  if (Array.isArray(d)) return { rows: d };
  if (d && typeof d === "object" && "results" in d && Array.isArray(d.results)) {
    const next = "__next" in d ? d.__next : undefined;
    if (next !== undefined && (typeof next !== "string" || next.length === 0 || next.length > 8192)) {
      throw new ServiceError("unavailable", "Exact returned malformed paging metadata.");
    }
    return { rows: d.results, next: next as string | undefined };
  }
  throw new ServiceError("unavailable", "Exact returned a malformed collection. No complete result was established.");
}
