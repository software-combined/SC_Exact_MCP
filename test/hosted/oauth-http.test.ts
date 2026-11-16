import { afterEach, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { decodeJwt } from "jose";
import { Browser, harness } from "./helpers.js";

const active: Awaited<ReturnType<typeof harness>>[] = [];
afterEach(async () => { await Promise.all(active.splice(0).map((h) => h.close())); });

describe("real OAuth provider HTTP flow", () => {
  it.each([["claude", "exact.read"], ["chatgpt", "exact.read openid"]])(
    "issues a personal resource token for %s with advertised scopes %s", async (client, scope) => {
    const h = await harness(); active.push(h);
    const metadata = await (await fetch(`${h.origin}/.well-known/oauth-authorization-server`)).json();
    const resource = await (await fetch(`${h.origin}/.well-known/oauth-protected-resource/mcp`)).json();
    expect(metadata.issuer).toBe(h.origin);
    expect(metadata.authorization_response_iss_parameter_supported).toBe(true);
    expect(metadata.scopes_supported).toContain("openid");
    expect(resource.authorization_servers).toEqual([h.origin]);
    const browser = new Browser(h.origin);
    const verifier = randomBytes(32).toString("base64url");
    const params = new URLSearchParams({ client_id: client, response_type: "code", scope,
      redirect_uri: `http://127.0.0.1:9999/${client}/callback`, state: "fixture-client-state",
      resource: `${h.origin}/mcp`, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
    let response = await browser.follow(await browser.request(`/auth?${params}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain(`form-action 'self' ${h.exactOrigin} http://127.0.0.1:9999`);
    expect(response.headers.get("Content-Security-Policy")).not.toContain("*");
    expect(response.headers.get("Referrer-Policy")).toBe("same-origin");
    response = await browser.follow(await browser.submit(response));
    expect(response.status).toBe(200);
    response = await browser.follow(await browser.submit(response));
    expect(response.status).toBe(200);
    response = await browser.submit(response);
    // Provider resume redirects to the registered client, which is deliberately not running.
    response = await browser.request(response.headers.get("location")!);
    const redirect = new URL(response.headers.get("location")!);
    expect(redirect.href).toContain(`http://127.0.0.1:9999/${client}/callback`);
    expect(redirect.searchParams.get("state")).toBe("fixture-client-state");
    expect(redirect.searchParams.get("iss")).toBe(h.origin);
    expect(redirect.searchParams.get("error")).toBeNull();
    const token = await fetch(`${h.origin}/token`, { method: "POST", body: new URLSearchParams({
      grant_type: "authorization_code", code: redirect.searchParams.get("code")!, client_id: client,
      redirect_uri: `http://127.0.0.1:9999/${client}/callback`, code_verifier: verifier, resource: `${h.origin}/mcp` }) });
    const value = await token.json() as { access_token: string; refresh_token: string; id_token?: string };
    expect(token.status).toBe(200);
    const principal = await h.broker.authenticate(value.access_token);
    expect(principal.subject).toMatch(/^nl:/);
    expect(decodeJwt(value.access_token)).toMatchObject({ scope: "exact.read", aud: `${h.origin}/mcp`, iss: h.origin });
    if (scope.includes("openid")) {
      const identity = decodeJwt(value.id_token!);
      expect(identity).toMatchObject({ sub: principal.subject, aud: client, iss: h.origin });
      expect(identity.email).toBeUndefined(); expect(identity.name).toBeUndefined();
    }
    expect(value.refresh_token).toBeTruthy();
  });
  it("returns the canonical issuer on authorization error redirects", async () => {
    const h = await harness(); active.push(h);
    const params = new URLSearchParams({ client_id: "chatgpt", response_type: "code", scope: "exact.read",
      redirect_uri: "http://127.0.0.1:9999/chatgpt/callback", state: "fixture-error-state",
      code_challenge: "a".repeat(43), code_challenge_method: "plain", resource: `${h.origin}/mcp` });
    const response = await fetch(`${h.origin}/auth?${params}`, { redirect: "manual" });
    const target = new URL(response.headers.get("location")!);
    expect(target.searchParams.get("error")).toBe("invalid_request");
    expect(target.searchParams.get("iss")).toBe(h.origin);
    expect(target.searchParams.get("state")).toBe("fixture-error-state");
  });
});
