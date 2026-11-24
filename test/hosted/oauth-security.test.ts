import { afterEach, describe, expect, it, vi } from "vitest";
import { importJWK, SignJWT } from "jose";
import { authorization, Browser, exchange, harness, USER_A, USER_B } from "./helpers.js";
import { providerAdapter } from "../../src/hosted/oauth/adapter.js";

const active: Awaited<ReturnType<typeof harness>>[] = [];
afterEach(async () => { await Promise.all(active.splice(0).map((h) => h.close())); });

describe("OAuth isolation and revocation", () => {
  it("requires new consent before a grant or OAuth form from the previous release can authorize finance reads", async () => {
    const h = await harness(); active.push(h);
    const first = await authorization(h);
    const old = (await exchange(h, first)).token;
    const principal = await h.broker.authenticate(old.access_token);
    const key = `grant-binding:${principal.grantId}`;
    const binding = (await h.store.read<{ consentRevision?: number }>(key))!;
    const { consentRevision: _oldRevision, ...previousBinding } = binding.value;
    await h.store.write(key, previousBinding, binding.version, binding.expiresAt);
    const calls = h.calls.length;
    const refused = await fetch(`${h.origin}/mcp`, { method: "POST", headers: { Authorization: `Bearer ${old.access_token}` } });
    expect(refused.status).toBe(401);
    expect(h.calls).toHaveLength(calls);
    const refresh = await fetch(`${h.origin}/token`, { method: "POST", headers: { Accept: "application/json" }, body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: old.refresh_token, client_id: "claude", resource: `${h.origin}/mcp`,
    }) });
    expect(refresh.status).toBe(400);
    expect(await refresh.json()).toMatchObject({ error: "invalid_grant" });

    const send = first.browser.request.bind(first.browser);
    let formStatus: number | undefined;
    const previousForm = vi.spyOn(first.browser, "request").mockImplementation(async (url, init) => {
      if (!url.endsWith("/consent") || !(init?.body instanceof URLSearchParams)) return send(url, init);
      const formKey = `form:${init.body.get("nonce")}`;
      const form = (await h.store.read<{ payload: { uid: string; action: string } }>(formKey))!;
      const { uid, action } = form.value.payload;
      await h.store.write(formKey, { payload: { uid, action } }, form.version, form.expiresAt);
      const result = await send(url, init);
      formStatus = result.status;
      return result;
    });
    try { await expect(authorization(h, "claude", first.browser)).rejects.toThrow(); }
    finally { previousForm.mockRestore(); }
    expect(formStatus).toBe(400);
    const fresh = await exchange(h, await authorization(h, "claude", first.browser));
    const confirmed = await h.broker.authenticate(fresh.token.access_token);
    expect(confirmed).toMatchObject({ subject: principal.subject, generation: principal.generation });
    expect(confirmed.grantId).not.toBe(principal.grantId);
    await expect(h.broker.authenticate(old.access_token)).rejects.toThrow();
  });
  it("keeps same-person clients usable across independent browser consent and isolates a different person", async () => {
    const h = await harness(); active.push(h);
    const first = await authorization(h, "claude", new Browser(h.origin));
    const a = (await exchange(h, first)).token;
    const original = await h.broker.authenticate(a.access_token);
    const b = (await exchange(h, await authorization(h, "chatgpt", new Browser(h.origin)))).token;
    expect(await h.broker.authenticate(a.access_token)).toEqual(original);
    expect((await h.broker.authenticate(b.access_token)).subject).toBe(original.subject);
    expect((await exchange(h, await authorization(h, "claude", first.browser))).response.status).toBe(200);
    h.fake.user = USER_B;
    const c = (await exchange(h, await authorization(h, "copilot", new Browser(h.origin)))).token;
    expect((await h.broker.authenticate(c.access_token)).subject).toBe(`nl:${USER_B}`);
    expect(await h.broker.authenticate(a.access_token)).toEqual(original);
  });
  it.each(["disconnect", "epoch"])("requires fresh same-browser consent after %s without restoring old grants or cursors", async (reset) => {
    const h = await harness(); active.push(h);
    const first = await authorization(h); const a = (await exchange(h, first)).token;
    const b = (await exchange(h, await authorization(h, "chatgpt", new Browser(h.origin)))).token;
    const principal = await h.broker.authenticate(a.access_token);
    h.fake.next = `${h.exactOrigin}/api/v1/123456/crm/Accounts?$skiptoken=old-generation`;
    const query = { division: 123456, name: "Fictional" };
    const page = await h.accounting.read("customer_search", query, principal, AbortSignal.timeout(1000));
    h.fake.next = undefined;
    if (reset === "disconnect") await h.connections.disconnect(principal);
    else await h.connections.gate.revokeAll();
    await expect(h.broker.authenticate(a.access_token)).rejects.toThrow();
    await expect(h.broker.authenticate(b.access_token)).rejects.toThrow();
    const reconnected = await exchange(h, await authorization(h, "claude", first.browser));
    expect(reconnected.response.status).toBe(200);
    const fresh = await h.broker.authenticate(reconnected.token.access_token);
    expect(fresh.generation).toBeGreaterThan(principal.generation);
    await expect(h.accounting.read("customer_search", { ...query, cursor: page.coverage.nextCursor },
      fresh, AbortSignal.timeout(1000))).rejects.toMatchObject({ code: "denied" });
    await expect(h.broker.authenticate(a.access_token)).rejects.toThrow();
    await expect(h.broker.authenticate(b.access_token)).rejects.toThrow();
  });
  it("exchanges a code after HTTP replica replacement and authenticates through both independent brokers", async () => {
    const h = await harness(); active.push(h);
    const code = await authorization(h);
    const second = await h.restart();
    const { response, token } = await exchange(h, code);
    expect(response.status).toBe(200);
    const firstPrincipal = await h.broker.authenticate(token.access_token);
    expect(await second.authenticate(token.access_token)).toEqual(firstPrincipal);
    const renewed = await fetch(`${h.origin}/token`, { method: "POST", body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: token.refresh_token, client_id: "claude", resource: `${h.origin}/mcp` }) });
    expect(renewed.status).toBe(200);
    const renewedToken = await renewed.json() as { access_token: string };
    expect(await h.broker.authenticate(renewedToken.access_token)).toEqual(firstPrincipal);
  });
  it("checks PKCE, exact callbacks, unsupported clients/resources, and code replay at HTTP endpoints", async () => {
    const h = await harness(); active.push(h);
    const grant = await authorization(h);
    expect((await exchange(h, grant, { code_verifier: "wrong-verifier-111111111111111111111111111111111" })).response.status).toBe(400);
    const fresh = await authorization(h, "chatgpt", grant.browser);
    expect((await exchange(h, fresh)).response.status).toBe(200);
    expect((await exchange(h, fresh)).response.status).toBe(400);
    const browser = new Browser(h.origin);
    const bad = await browser.request("/auth?client_id=unregistered&response_type=code&redirect_uri=https%3A%2F%2Fevil.invalid%2Fcallback&scope=exact.read");
    expect(bad.status).toBe(400);
    expect(bad.headers.get("location")).toBeNull();
    const before = h.calls.length;
    const wrong = await browser.request(`/auth?client_id=claude&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A9999%2Fclaude%2Fcallback.evil&scope=exact.read`);
    expect(wrong.status).toBe(400);
    await expect(authorization(h, "copilot", grant.browser, "https://other.invalid/mcp")).rejects.toThrow();
    expect(h.calls.length).toBe(before);
    const registration = await fetch(`${h.origin}/reg`, { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    expect(registration.status).toBe(404);
  });

  it("uses only the canonical MCP audience when clients omit resource", async () => {
    const h = await harness(); active.push(h);
    const grant = await authorization(h, "claude", undefined, "");
    const { token, response } = await exchange(h, grant, {}, false);
    expect(response.status).toBe(200);
    const principal = await h.broker.authenticate(token.access_token);
    const key = await importJWK(h.config.jwks.keys[0], "RS256");
    const jwt = (overrides: Record<string, unknown>, exp = "5m") => new SignJWT({
      sub: principal.subject, client_id: principal.clientId, grant_id: principal.grantId,
      connection_generation: principal.generation, scope: "exact.read", ...overrides,
    }).setProtectedHeader({ alg: "RS256", typ: "at+jwt", kid: "fixture-key" }).setIssuer(h.origin)
      .setAudience(typeof overrides.aud === "string" ? overrides.aud : `${h.origin}/mcp`).setIssuedAt().setExpirationTime(exp).sign(key);
    await expect(h.broker.authenticate(await jwt({ aud: "https://wrong.invalid/mcp" }))).rejects.toThrow(/current SCG/);
    await expect(h.broker.authenticate(await jwt({ sub: `nl:${USER_B}` }))).rejects.toThrow(/current SCG/);
    await expect(h.broker.authenticate(await jwt({ client_id: "chatgpt" }))).rejects.toThrow(/current SCG/);
    await expect(h.broker.authenticate(await jwt({}, "-1s"))).rejects.toThrow(/current SCG/);
    const adapter = new (providerAdapter(h.store))("Grant");
    await adapter.destroy(principal.grantId);
    await expect(h.broker.authenticate(token.access_token)).rejects.toThrow(/current SCG/);
  });

  it("shares one personal connection across client grants, isolates another user, and disconnects all old grants", async () => {
    const h = await harness(); active.push(h);
    const first = await authorization(h);
    const a = (await exchange(h, first)).token;
    const second = await authorization(h, "chatgpt", first.browser);
    const b = (await exchange(h, second)).token;
    const pa = await h.broker.authenticate(a.access_token); const pb = await h.broker.authenticate(b.access_token);
    expect(pa.subject).toBe(`nl:${USER_A}`); expect(pb.subject).toBe(pa.subject);
    expect(pa.grantId).not.toBe(pb.grantId);
    expect(h.calls.filter((v) => v.path === "/api/oauth2/token")).toHaveLength(1);
    h.fake.user = USER_B;
    const other = (await exchange(h, await authorization(h, "copilot"))).token;
    expect((await h.broker.authenticate(other.access_token)).subject).toBe(`nl:${USER_B}`);
    const disconnect = await fetch(`${h.origin}/connection/disconnect`, { method: "POST", headers: { Authorization: `Bearer ${a.access_token}` } });
    expect(disconnect.status).toBe(200);
    await expect(h.broker.authenticate(a.access_token)).rejects.toThrow();
    await expect(h.broker.authenticate(b.access_token)).rejects.toThrow();
    expect((await h.broker.authenticate(other.access_token)).subject).toBe(`nl:${USER_B}`);
    const refresh = await fetch(`${h.origin}/token`, { method: "POST", body: new URLSearchParams({
      grant_type: "refresh_token", refresh_token: b.refresh_token, client_id: "chatgpt", resource: `${h.origin}/mcp` }) });
    expect(refresh.status).toBeGreaterThanOrEqual(400);
  });

  it("accepts Exact user GUIDs without RFC version or variant bits", async () => {
    const h = await harness(); active.push(h);
    h.fake.user = "A2E51D82-3B8D-E611-80C2-00155D010A07";
    const { token } = await exchange(h, await authorization(h));
    expect((await h.broker.authenticate(token.access_token)).subject).toBe("nl:a2e51d82-3b8d-e611-80c2-00155d010a07");
  });

  it("explains a failed sign-in in the browser and logs only the failing step", async () => {
    const h = await harness(); active.push(h);
    h.fake.user = "not-an-exact-guid";
    const browser = new Browser(h.origin);
    const page = await browser.follow(await browser.request("/auth?client_id=claude&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A9999%2Fclaude%2Fcallback&scope=exact.read&code_challenge=1111111111111111111111111111111111111111111&code_challenge_method=S256"));
    const exactRedirect = await browser.request((await browser.submit(page)).headers.get("location")!);
    const failed = await browser.request(exactRedirect.headers.get("location")!);
    expect(failed.status).toBe(503);
    expect(failed.headers.get("Content-Type")).toContain("text/html");
    const markup = await failed.text();
    expect(markup).toContain("Sign-in could not finish");
    expect(markup).not.toContain("not-an-exact-guid");
    await vi.waitFor(() => expect(h.logs.at(-1)).toMatchObject({ route: "callback", outcome: "unavailable",
      detail: "connect:identity:reauth_required" }));
  });

  it("opens Exact from a page, not a form redirect, so Exact's own login redirects are not blocked", async () => {
    const h = await harness(); active.push(h);
    const browser = new Browser(h.origin);
    const page = await browser.follow(await browser.request("/auth?client_id=claude&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A9999%2Fclaude%2Fcallback&scope=exact.read&code_challenge=1111111111111111111111111111111111111111111&code_challenge_method=S256"));
    const opening = await browser.submit(page, true);
    expect(opening.status).toBe(200);
    expect(opening.headers.get("location")).toBeNull();
    expect(opening.headers.get("Set-Cookie")).toMatch(/^scg-exact=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Lax; Path=\/exact\/callback; Max-Age=180$/);
    expect(opening.headers.get("Content-Security-Policy")).toContain("form-action 'self' ;");
    const markup = await opening.text();
    const refresh = /http-equiv="refresh" content="0;url=([^"]+)"/.exec(markup)![1];
    const target = new URL(refresh.replaceAll("&amp;", "&"));
    expect(`${target.origin}${target.pathname}`).toBe(`${h.exactOrigin}/api/oauth2/auth`);
    expect(target.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(markup).toContain(`<a href="${refresh}">open Exact Online</a>`);
  });

  it("binds Exact state to the initiating browser and consumes it exactly once", async () => {
    const h = await harness(); active.push(h);
    const browser = new Browser(h.origin);
    const page = await browser.follow(await browser.request("/auth?client_id=claude&response_type=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A9999%2Fclaude%2Fcallback&scope=exact.read&code_challenge=1111111111111111111111111111111111111111111&code_challenge_method=S256"));
    const sourceRedirect = await browser.submit(page);
    const exactRedirect = await browser.request(sourceRedirect.headers.get("location")!);
    const callback = exactRedirect.headers.get("location")!;
    expect((await new Browser(h.origin).request(callback)).status).toBe(400);
    expect(h.calls.filter((v) => v.path === "/api/oauth2/token")).toHaveLength(0);
    expect((await browser.request(callback)).status).toBe(303);
    expect((await browser.request(callback)).status).toBe(400);
    expect(h.calls.filter((v) => v.path === "/api/oauth2/token")).toHaveLength(1);
  });

  it("revokes a client grant through the standard refresh-token revocation endpoint", async () => {
    const h = await harness(); active.push(h);
    const { token } = await exchange(h, await authorization(h));
    const response = await fetch(`${h.origin}/token/revocation`, { method: "POST", body: new URLSearchParams({
      client_id: "claude", token: token.refresh_token, token_type_hint: "refresh_token" }) });
    expect(response.status).toBe(200);
    await expect(h.broker.authenticate(token.access_token)).rejects.toThrow();
  });
});
