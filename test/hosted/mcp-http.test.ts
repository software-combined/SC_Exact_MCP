import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { authorization, Browser, exchange, harness, INVOICE } from "./helpers.js";

const active: Awaited<ReturnType<typeof harness>>[] = [];
afterEach(async () => { await Promise.all(active.splice(0).map((h) => h.close())); });

describe("official MCP SDK over real local HTTP", () => {
  it("bounds invalid public callbacks while an existing person's HTTP reads and refresh retain capacity", async () => {
    const h = await harness({ appCallsPerMinute: 16, appCallsPerDay: 16,
      divisionCallsPerMinute: 16, divisionCallsPerDay: 16 }); active.push(h);
    const { token } = await exchange(h, await authorization(h));
    const principal = await h.broker.authenticate(token.access_token); const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const browser = new Browser(h.origin);
      const params = new URLSearchParams({ client_id: "chatgpt", response_type: "code", scope: "exact.read",
        redirect_uri: "http://127.0.0.1:9999/chatgpt/callback", code_challenge: "a".repeat(43), code_challenge_method: "S256" });
      const page = await browser.follow(await browser.request(`/auth?${params}`));
      const target = new URL((await browser.submit(page)).headers.get("location")!);
      statuses.push((await browser.request(`/exact/callback?state=${target.searchParams.get("state")}&code=invalid-fictional-code`)).status);
    }
    expect(statuses).toEqual([401, 429, 429]);
    expect(h.calls.filter((call) => call.path === "/api/oauth2/token")).toHaveLength(2);
    const client = new Client({ name: "fixture-protected-capacity", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${h.origin}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } } }));
    try {
      expect((await client.callTool({ name: "company_discovery", arguments: {} })).isError).not.toBe(true);
      const key = h.connections.key(principal.subject); const connection = await h.connections.authorize(principal);
      const old = (await h.store.read(key))!; const tokens = await h.cipher.open(connection.credentials, key);
      tokens.issuedAt = Date.now() - 570_000; tokens.expiresAt = Date.now() + 20_000;
      await h.store.write(key, { ...connection, expiresAt: tokens.expiresAt,
        credentials: await h.cipher.seal(tokens, key) }, old.version);
      expect((await client.callTool({ name: "company_discovery", arguments: {} })).isError).not.toBe(true);
      expect(h.calls.filter((call) => call.path === "/api/oauth2/token")).toHaveLength(3);
    } finally { await client.close(); }
  });
  it("discovers exactly four tools and reads typed Exact data with a personal token", async () => {
    const h = await harness(); active.push(h);
    const { token, response } = await exchange(h, await authorization(h));
    expect(response.status).toBe(200);
    const client = new Client({ name: "fixture-client", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${h.origin}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } } }));
    const tools = await client.listTools();
    expect(tools.tools.map((v) => v.name).sort()).toEqual(["company_discovery", "customer_search", "invoice_lookup", "receivables"]);
    for (const [name, args] of [["company_discovery", {}], ["customer_search", { division: 123456, name: "Fictional" }],
      ["invoice_lookup", { division: 123456, invoiceId: INVOICE }], ["receivables", { division: 123456 }]] as const) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError, JSON.stringify(result)).not.toBe(true);
      expect(result.structuredContent).toMatchObject({ source: { system: "Exact Online", region: "nl" },
        coverage: { state: "complete", returned: 1 } });
    }
    const before = h.calls.length;
    const injected = await client.callTool({ name: "customer_search", arguments: {
      division: 123456, name: "Fictional", resource: "hrm/Employees", method: "POST" } });
    expect(injected.isError).toBe(true);
    expect((await client.callTool({ name: "exact_request", arguments: { resource: "crm/Accounts", method: "POST" } })).isError).toBe(true);
    expect(h.calls.length).toBe(before);
    expect(h.calls.filter((v) => v.method !== "GET").every((v) => v.path === "/api/oauth2/token")).toBe(true);
    const financial = h.calls.filter((v) => v.path.includes("/salesinvoice/"));
    expect(financial[0].path).toContain(`SalesInvoices(guid'${INVOICE}')`);
    expect(financial[0].query.get("$select")).not.toContain("Remarks");
    expect(JSON.stringify(h.logs)).not.toContain("Fictional");
    expect(JSON.stringify(h.logs)).not.toContain(token.access_token);
    await client.close();
  });

  it("publishes issuer/resource metadata and challenges missing, source, or bad tokens", async () => {
    const h = await harness(); active.push(h);
    const metadata = await fetch(`${h.origin}/.well-known/oauth-protected-resource/mcp`).then((r) => r.json());
    expect(metadata).toMatchObject({ resource: `${h.origin}/mcp`, authorization_servers: [h.origin] });
    const auth = await fetch(`${h.origin}/.well-known/oauth-authorization-server`).then((r) => r.json()) as Record<string, unknown>;
    expect(auth.issuer).toBe(h.origin);
    expect(auth.code_challenge_methods_supported).toEqual(["S256"]);
    expect(auth.registration_endpoint).toBeUndefined();
    for (const raw of ["", "fictional-exact-source-token", "bad.jwt.token"]) {
      const response = await fetch(`${h.origin}/mcp`, { method: "POST", headers: raw ? { Authorization: `Bearer ${raw}` } : {} });
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toContain("oauth-protected-resource/mcp");
    }
    expect(h.calls).toEqual([]);
  });
});
