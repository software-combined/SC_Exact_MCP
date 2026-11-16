import { createHash, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ServiceError, type StateStore } from "../domain/identity.js";
import { take, update } from "../storage/state.js";
import { body, escapeHtml, html } from "../transport/http.js";
import type { Broker } from "./broker.js";

interface Flow { uid: string; nonce: string }
interface Candidate { subject: string; generation: number }
const random = () => randomBytes(32).toString("base64url");
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

export class Interactions {
  constructor(private broker: Broker, private store: StateStore) {}
  private cookie(req: IncomingMessage) {
    const values = (req.headers.cookie ?? "").split(";").map((v) => v.trim()).filter((v) => v.startsWith("scg-exact="));
    return values.length === 1 ? values[0].slice("scg-exact=".length) : "";
  }
  private async form(res: ServerResponse, uid: string, action: string, title: string, content: string, label: string, origins: string[]) {
    const nonce = random();
    await this.store.write(`form:${nonce}`, { payload: { uid, action } }, undefined, Date.now() + 600_000);
    html(res, title, `${content}<form method="post" action="/interaction/${encodeURIComponent(uid)}/${action}"><input type="hidden" name="nonce" value="${nonce}"><button>${escapeHtml(label)}</button></form>`, origins);
  }
  async callback(req: IncomingMessage, res: ServerResponse, url: URL, signal?: AbortSignal) {
    const state = url.searchParams.get("state");
    if (!state || !/^[A-Za-z0-9_-]{43}$/.test(state) || url.searchParams.getAll("state").length !== 1) {
      throw new ServiceError("denied", "Exact sign-in state is invalid.", 400);
    }
    const row = await this.store.read<{ payload: Flow }>(`flow:${state}`);
    if (!row?.value.payload || digest(this.cookie(req)) !== row.value.payload.nonce) {
      throw new ServiceError("denied", "Exact sign-in does not belong to this browser.", 400);
    }
    const flow = await take<Flow>(this.store, `flow:${state}`);
    const code = url.searchParams.get("code");
    if (!code || code.length > 2048 || url.searchParams.getAll("code").length !== 1 || url.searchParams.has("error")) {
      throw new ServiceError("denied", "Exact consent was declined or expired. Start again.", 400);
    }
    await this.broker.signIns.call(undefined, 2, Date.now() + 45_000);
    signal?.throwIfAborted();
    const connection = await this.broker.connections.connect(code, signal);
    await update<Candidate>(this.store, `candidate:${flow.uid}`, () => ({ subject: connection.subject,
      generation: connection.generation }), Date.now() + 600_000);
    res.writeHead(303, { Location: `/interaction/${encodeURIComponent(flow.uid)}`,
      "Set-Cookie": "scg-exact=; HttpOnly; SameSite=Lax; Path=/exact/callback; Max-Age=0" });
    res.end();
  }
  async handle(req: IncomingMessage, res: ServerResponse, uid: string, action?: string) {
    const details = await this.broker.provider.interactionDetails(req, res);
    if (details.uid !== uid) throw new ServiceError("denied", "Interaction does not belong to this browser.", 400);
    const candidate = await this.store.read<Candidate>(`candidate:${uid}`);
    const accountId = details.prompt.name === "login" ? candidate?.value.subject : details.session?.accountId;
    const clientId = String(details.params.client_id);
    const client = this.broker.config.clients.find((item) => item.client_id === clientId);
    if (!client) throw new ServiceError("denied", "Unknown client.", 400);
    const origins = [this.broker.connections.source.origin, ...(client.redirect_uris?.map((uri) => new URL(uri).origin) ?? [])];
    if (req.method === "GET" && !action) {
      if (!accountId) return this.form(res, uid, "connect", "Connect Exact Online", "<p>Sign in with your own Exact account. You see only the companies and data that account can open.</p>", "Continue to Exact", origins);
      const connection = await this.broker.connections.active(accountId);
      if (candidate && candidate.value.generation !== connection.generation) throw new ServiceError("denied", "The connection changed. Start sign-in again.", 400);
      const prompt = details.prompt.name === "login" ? "confirm" : "consent";
      return this.form(res, uid, prompt, "Allow read-only access",
        `<p>Signed in to Exact as <strong>${escapeHtml(connection.displayName)}</strong>.</p><p>Allow ${escapeHtml(String(client.client_name ?? clientId))} to read companies, customers, sales invoices and receivables? This service only reads; it cannot change anything in Exact.</p><p class="note">Not you? Close this window and contact Software Combined IT.</p>`,
        "Allow read-only access", origins);
    }
    if (req.method !== "POST" || !action || !["connect", "confirm", "consent"].includes(action)) {
      throw new ServiceError("invalid_input", "Unsupported interaction action.", 400);
    }
    const origin = req.headers.origin;
    if (origin && origin !== this.broker.config.origin) throw new ServiceError("denied", "Cross-origin consent is not allowed.", 403);
    const params = new URLSearchParams(await body(req, 2000));
    const form = await take<{ uid: string; action: string }>(this.store, `form:${params.get("nonce") ?? ""}`);
    if (form.uid !== uid || form.action !== action) throw new ServiceError("denied", "Consent request changed.", 400);
    if (action === "connect" && details.prompt.name === "login" && !accountId) {
      const state = random(); const nonce = random();
      await this.store.write(`flow:${state}`, { payload: { uid, nonce: digest(nonce) } }, undefined, Date.now() + 180_000);
      const secure = this.broker.config.origin.startsWith("https:") ? "; Secure" : "";
      res.writeHead(303, { Location: this.broker.connections.source.authorizeUrl(state),
        "Set-Cookie": `scg-exact=${nonce}; HttpOnly; SameSite=Lax; Path=/exact/callback; Max-Age=180${secure}` });
      return res.end();
    }
    if (!accountId) throw new ServiceError("denied", "Connect a personal Exact account first.", 400);
    const connection = await this.broker.connections.active(accountId);
    if (action === "confirm" && details.prompt.name === "login" && candidate?.value.generation === connection.generation) {
      return this.broker.provider.interactionFinished(req, res, { login: { accountId } }, { mergeWithLastSubmission: false });
    }
    if (action === "consent" && details.prompt.name === "consent") {
      const grantId = await this.broker.consent(accountId, clientId);
      return this.broker.provider.interactionFinished(req, res, { consent: { grantId } }, { mergeWithLastSubmission: true });
    }
    throw new ServiceError("denied", "The consent step changed. Start again.", 400);
  }
}
