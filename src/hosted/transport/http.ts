import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ServiceError } from "../domain/identity.js";

export async function body(req: IncomingMessage, max = 32_000): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > max) throw new ServiceError("invalid_input", "The request is too large.", 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
/**
 * A log-safe rendering of a header value. Only letters, digits, and the characters . : , - and space are kept;
 * any other character (including a line break) becomes "?". The result is capped at 80 characters.
 */
const headerLabel = (value: string | string[] | undefined) =>
  value === undefined ? "missing" : String(value).replace(/[^a-z0-9.:,\- ]/gi, "?").slice(0, 80);

/**
 * Returns why a request is not for this service over HTTPS, or undefined when it is. A Host with the default port
 * and a forwarded-protocol list from a proxy chain are accepted; the host name and HTTPS itself are still required.
 */
export function targetProblem(headers: IncomingMessage["headers"], url: URL, expected: URL): string | undefined {
  if (url.origin !== expected.origin) return `target:${headerLabel(url.origin)}`;
  const host = (headers.host ?? "").toLowerCase();
  // The default port may be spelled out, but only when the service itself runs on the default port.
  const defaultPort = expected.port ? undefined : expected.protocol === "https:" ? ":443" : ":80";
  if (host !== expected.host && host !== `${expected.host}${defaultPort ?? ""}`) return `host:${headerLabel(headers.host)}`;
  const forwardedProto = headers["x-forwarded-proto"];
  const proto = String(forwardedProto ?? "").split(",")[0].trim().toLowerCase();
  if (expected.protocol === "https:" && proto !== "https") return `proto:${headerLabel(forwardedProto)}`;
  return undefined;
}

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}

// Brand files ship beside the compiled module (see the build script) and are inlined, so pages need no asset route.
const asset = (name: string, type: string) =>
  `data:${type};base64,${readFileSync(new URL(`./brand/${name}`, import.meta.url)).toString("base64")}`;
const scgLogo = asset("scg-logo.png", "image/png");
const exactLogo = asset("exact-logo.svg", "image/svg+xml");
const style = `*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;
background:#f4f5f7;color:#1d1d1f;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{width:100%;max-width:440px;background:#fff;border-radius:16px;border-top:4px solid #ff2178;
box-shadow:0 8px 32px rgba(29,29,31,.08);padding:32px}
.brands{display:flex;align-items:center;gap:16px;margin-bottom:28px}.brands img{display:block;height:36px;width:auto}
.brands .exact{height:20px}.brands span{width:1px;height:28px;background:#d9dbe0}
h1{font-size:22px;line-height:1.3;margin:0 0 12px}p{margin:0 0 16px;color:#4a4b50}strong{color:#1d1d1f}
button{width:100%;margin-top:8px;padding:12px 16px;border:0;border-radius:10px;background:#1d1d1f;color:#fff;
font-family:inherit;font-size:16px;font-weight:600;line-height:1.2;cursor:pointer}button:hover{background:#3a3b40}button:focus-visible{outline:3px solid #ff2178;outline-offset:2px}
.note{font-size:14px;color:#6b6c72}`;
const styleHash = createHash("sha256").update(style).digest("base64");

/** Renders a sign-in page. Callers must escape any dynamic text they place in `content`. */
export function html(res: ServerResponse, title: string, content: string, formOrigins: readonly string[], status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": `default-src 'none'; img-src data:; style-src 'sha256-${styleHash}'; form-action 'self' ${formOrigins.map((value) => new URL(value).origin).join(" ")}; base-uri 'none'; frame-ancestors 'none'` });
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${style}</style></head><body><main><div class="brands"><img src="${scgLogo}" alt="Software Combined"><span aria-hidden="true"></span><img class="exact" src="${exactLogo}" alt="Exact"></div><h1>${escapeHtml(title)}</h1>${content}</main></body></html>`);
}
