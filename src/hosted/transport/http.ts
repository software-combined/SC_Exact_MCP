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
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);

export function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}
export function html(res: ServerResponse, title: string, content: string, formOrigins: readonly string[]) {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": `default-src 'none'; form-action 'self' ${formOrigins.map((value) => new URL(value).origin).join(" ")}; base-uri 'none'; frame-ancestors 'none'` });
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><main><h1>${escapeHtml(title)}</h1>${content}</main></html>`);
}
