import { createHash, randomBytes } from "node:crypto";
import { generateKeyPair, exportJWK } from "jose";
import type { BrokerConfig } from "../../src/hosted/oauth/broker.js";
import { Broker } from "../../src/hosted/oauth/broker.js";
import { Connections } from "../../src/hosted/runtime/connections.js";
import { Cursors } from "../../src/hosted/runtime/cursors.js";
import { Accounting } from "../../src/hosted/runtime/accounting.js";
import { Changes } from "../../src/hosted/runtime/changes.js";
import type { Limits } from "../../src/hosted/runtime/budgets.js";
import { hostedApp, type RequestLog } from "../../src/hosted/transport/app.js";
import { exactFixture, listen, close, reservePort } from "./exact-fixture.js";
export * from "./exact-fixture.js";

export async function harness(limits?: Limits) {
  const port = await reservePort();
  const origin = `http://127.0.0.1:${port}`;
  const base = await exactFixture(`${origin}/exact/callback`, limits);
  const { store, cipher, source, connections, budgets, accounting, changes } = base;
  const { privateKey } = await generateKeyPair("RS256", { extractable: true });
  const key = await exportJWK(privateKey);
  const config: BrokerConfig = { origin, jwks: { keys: [{ ...key, kid: "fixture-key", alg: "RS256", use: "sig" }] },
    cookieKeys: ["fictional-cookie-key-11111111111111111", "fictional-cookie-key-22222222222222222"],
    clients: ["claude", "chatgpt", "copilot"].map((client_id) => ({ client_id, client_name: client_id,
      redirect_uris: [`http://127.0.0.1:9999/${client_id}/callback`], token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: "openid exact.read" })) };
  const signIns = budgets.signIns();
  const broker = new Broker(config, store, connections, signIns);
  const logs: RequestLog[] = [];
  let server = hostedApp(broker, accounting, changes, store, (record) => logs.push(record));
  await listen(server, port);
  return { ...base, origin, server, broker, config, logs,
    restart: async () => {
      await close(server);
      const nextConnections = new Connections(store, cipher, source);
      const nextAccounting = new Accounting(nextConnections, budgets, new Cursors(store, source.config.appId, "nl"));
      const nextBroker = new Broker(config, store, nextConnections, signIns);
      const nextChanges = new Changes(nextConnections, budgets);
      server = hostedApp(nextBroker, nextAccounting, nextChanges, store, (record) => logs.push(record));
      await listen(server, port);
      return nextBroker;
    },
    close: async () => { await close(server); await base.close(); } };
}

export class Browser {
  private cookies = new Map<string, string>();
  constructor(private origin: string) {}
  async request(url: string, init: RequestInit = {}) {
    const target = new URL(url, this.origin);
    const response = await fetch(target, { ...init, redirect: "manual", headers: { Connection: "close", ...init.headers,
      ...(target.origin === this.origin ? { Cookie: [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ") } : {}) } });
    if (target.origin === this.origin) for (const cookie of response.headers.getSetCookie()) {
      const [name, ...value] = cookie.split(";")[0].split("="); this.cookies.set(name, value.join("="));
    }
    return response;
  }
  async follow(response: Response): Promise<Response> {
    let current = response;
    for (let i = 0; i < 8 && current.status >= 300 && current.status < 400; i++) {
      if (current.headers.get("location")?.startsWith("http://127.0.0.1:9999/")) return current;
      current = await this.request(current.headers.get("location")!);
    }
    return current;
  }
  /** Posts the page's form. Like a browser, it treats a page that opens another URL at once as a redirect to it. */
  async submit(response: Response, raw = false): Promise<Response> {
    const markup = await response.text();
    const action = /action="([^"]+)"/.exec(markup)?.[1];
    const nonce = /name="nonce" value="([^"]+)"/.exec(markup)?.[1];
    if (!action || !nonce) throw new Error(`No consent form: ${markup}`);
    const result = await this.request(action, { method: "POST", body: new URLSearchParams({ nonce }),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: this.origin } });
    if (raw || result.status !== 200) return result;
    const refresh = /http-equiv="refresh" content="0;url=([^"]+)"/.exec(await result.clone().text())?.[1];
    return refresh ? new Response(null, { status: 303, headers: { Location: refresh.replaceAll("&amp;", "&") } }) : result;
  }
}

export async function authorization(h: Awaited<ReturnType<typeof harness>>, client = "claude", browser = new Browser(h.origin),
  resource: string | undefined = `${h.origin}/mcp`) {
  const verifier = randomBytes(32).toString("base64url");
  const params = new URLSearchParams({ client_id: client, response_type: "code", scope: "exact.read",
    redirect_uri: `http://127.0.0.1:9999/${client}/callback`, state: "fictional-state",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    ...(resource ? { resource } : {}) });
  let response = await browser.follow(await browser.request(`/auth?${params}`));
  for (let step = 0; step < 6 && response.status === 200; step++) {
    response = await browser.follow(await browser.submit(response));
  }
  const target = new URL(response.headers.get("location")!);
  if (!target.searchParams.get("code")) throw new Error(`Authorization failed: ${target.searchParams.get("error")}`);
  return { code: target.searchParams.get("code")!, verifier, browser, client };
}
export async function exchange(h: Awaited<ReturnType<typeof harness>>, authorization: Awaited<ReturnType<typeof authorization>>,
  overrides: Record<string, string> = {}, includeResource = true) {
  const response = await fetch(`${h.origin}/token`, { method: "POST", headers: { Connection: "close" }, body: new URLSearchParams({
    grant_type: "authorization_code", code: authorization.code, client_id: authorization.client,
    redirect_uri: `http://127.0.0.1:9999/${authorization.client}/callback`, code_verifier: authorization.verifier,
    ...(includeResource ? { resource: `${h.origin}/mcp` } : {}), ...overrides }) });
  return { response, token: await response.json() as { access_token: string; refresh_token: string; error?: string } };
}
