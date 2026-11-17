import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ExactSource } from "../../src/hosted/exact/source.js";
import { authorization, exchange, harness, ITEM, NEW_RECORD, USER_B } from "./helpers.js";

type H = Awaited<ReturnType<typeof harness>>;
const active: { h: H; client?: Client }[] = [];
afterEach(async () => {
  for (const { h, client } of active.splice(0)) { await client?.close(); await h.close(); }
});

async function connected() {
  const h = await harness();
  const { token } = await exchange(h, await authorization(h));
  const client = new Client({ name: "fixture-changes", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${h.origin}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } } }));
  active.push({ h, client });
  return { h, client, token: token.access_token };
}
const text = (result: Awaited<ReturnType<Client["callTool"]>>) => (result.content as { text: string }[])[0].text;
const changesSent = (h: H) => h.calls.filter((call) => (call.method === "POST" && call.path.startsWith("/api/v1/")) ||
  call.method === "PUT");

describe("Exact changes", () => {
  it("creates a customer with exactly the supplied fields", async () => {
    const { h, client } = await connected();
    const created = await client.callTool({ name: "create_customer",
      arguments: { division: 123456, name: "New fictional customer", email: "fictional@example.com" } });
    expect(created.isError).not.toBe(true);
    expect(created.structuredContent).toMatchObject({ company: { division: 123456 },
      result: { action: "created", record: "customer", id: NEW_RECORD, code: "C0002" } });
    expect(changesSent(h)).toHaveLength(1);
    expect(changesSent(h)[0]).toMatchObject({ method: "POST", path: "/api/v1/123456/crm/Accounts",
      body: { Name: "New fictional customer", Email: "fictional@example.com", Status: "C" } });
  });

  it("updates only the supplied customer fields and creates an unprocessed sales invoice with the only sales journal", async () => {
    const { h, client } = await connected();
    const updated = await client.callTool({ name: "update_customer", arguments: { division: 123456, customerId: USER_B, phone: "0101234567" } });
    expect(updated.structuredContent).toMatchObject({ result: { action: "updated", record: "customer", id: USER_B } });
    expect(changesSent(h)[0]).toMatchObject({ method: "PUT", path: `/api/v1/123456/crm/Accounts(guid'${USER_B}')`, body: { Phone: "0101234567" } });
    const invoice = await client.callTool({ name: "create_draft_sales_invoice", arguments: { division: 123456, customerId: USER_B,
      lines: [{ itemId: ITEM, quantity: 2, unitPrice: 95 }] } });
    expect(invoice.structuredContent).toMatchObject({ result: { action: "created", record: "sales invoice", id: NEW_RECORD, invoiceNumber: 20260002 } });
    expect(changesSent(h)[1].body).toEqual({ Journal: "70", OrderedBy: USER_B, SalesInvoiceLines: [{ Item: ITEM, Quantity: 2, UnitPrice: 95 }] });
  });

  it("asks which sales journal to use, reports Exact's refusal, and sends nothing for invalid input", async () => {
    const { h, client } = await connected();
    h.fake.journals = [{ Code: "70", Description: "Sales", IsBlocked: false }, { Code: "71", Description: "Export", IsBlocked: false },
      { Code: "79", Description: "Old", IsBlocked: true }];
    const ask = await client.callTool({ name: "create_draft_sales_invoice", arguments: { division: 123456, customerId: USER_B,
      lines: [{ itemId: ITEM, quantity: 1 }] } });
    expect(text(ask)).toContain("70 (Sales), 71 (Export).");
    const invalid = await client.callTool({ name: "update_customer", arguments: { division: 123456, customerId: USER_B } });
    expect(invalid.isError).toBe(true);
    expect(changesSent(h)).toHaveLength(0);
    h.fake.refuseChange = "Code already exists";
    const refused = await client.callTool({ name: "create_customer", arguments: { division: 123456, name: "Duplicate", code: "C001" } });
    expect(text(refused)).toContain("Exact refused the change: Code already exists Nothing was changed.");
  });

  it("marks only change tools as not read-only and finds sales items", async () => {
    const { h, client } = await connected();
    const tools = (await client.listTools()).tools;
    const hints = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations?.readOnlyHint]));
    expect(hints).toMatchObject({ company_discovery: true, item_search: true, create_customer: false,
      update_customer: false, create_draft_sales_invoice: false });
    const items = await client.callTool({ name: "item_search", arguments: { division: 123456, code: "CONSULT" } });
    expect(items.structuredContent).toMatchObject({ rows: [{ id: ITEM, code: "CONSULT", standardSalesPrice: 95 }] });
    expect(h.calls.at(-1)?.query.get("$filter")).toBe("IsSalesItem eq true and Code eq 'CONSULT'");
  });

  it("sends a change exactly once and reports an unknown outcome when Exact fails after receiving it", async () => {
    const { h, client } = await connected();
    h.fake.failChange = true;
    const failed = await client.callTool({ name: "create_customer", arguments: { division: 123456, name: "Outage probe" } });
    expect(failed.isError).toBe(true);
    expect(text(failed)).toContain("may or may not have been made");
    expect(changesSent(h)).toHaveLength(1);
    await vi.waitFor(() => expect(h.logs.some((log) => log.route === "mcp" && log.detail === "change:unknown")).toBe(true));
  });

  it("stops a change when the person disconnects during its lookups, and refuses to send too close to the deadline", async () => {
    const { h, client, token } = await connected();
    let release!: () => void;
    h.fake.readBarrier = new Promise<void>((resolve) => { release = resolve; });
    const pending = client.callTool({ name: "create_customer", arguments: { division: 123456, name: "Disconnect probe" } });
    await vi.waitFor(() => expect(h.calls.some((call) => call.path.endsWith("/system/Divisions"))).toBe(true));
    expect((await fetch(`${h.origin}/connection/disconnect`, { method: "POST",
      headers: { Authorization: `Bearer ${token}`, Connection: "close" } })).status).toBe(200);
    release(); h.fake.readBarrier = undefined;
    expect((await pending).isError).toBe(true);
    expect(changesSent(h)).toHaveLength(0);
    let sends = 0;
    const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret", region: "nl",
      callback: "http://127.0.0.1:1/exact/callback" }, async () => { sends++; return new Response("{}"); }, "http://127.0.0.1:1");
    await expect(source.change(123456, { method: "POST", resource: "crm/Accounts", body: { Name: "x" } }, "fictional-token",
      AbortSignal.timeout(1000), Date.now() - 1, async () => {})).rejects.toThrow(/Nothing was changed/);
    expect(sends).toBe(0);
  });

  it("stops a change that waits for the shared Exact slot when the person disconnects meanwhile", async () => {
    const { h, client, token } = await connected();
    const slot = `rest-slot:${h.source.config.appId}`;
    const held = await h.store.read<{ owner: string; until: number }>(slot);
    await h.store.write(slot, { owner: "fictional-other-request", until: Date.now() + 4_000 }, held?.version);
    const pending = client.callTool({ name: "create_customer", arguments: { division: 123456, name: "Slot probe" } });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect((await fetch(`${h.origin}/connection/disconnect`, { method: "POST",
      headers: { Authorization: `Bearer ${token}`, Connection: "close" } })).status).toBe(200);
    const result = await pending;
    expect(result.isError).toBe(true);
    expect(text(result)).toContain("Nothing was changed");
    expect(changesSent(h)).toHaveLength(0);
  });

  it("sends the journal the person chose", async () => {
    const { h, client } = await connected();
    await client.callTool({ name: "create_draft_sales_invoice", arguments: { division: 123456, customerId: USER_B, journalCode: "71",
      lines: [{ itemId: ITEM, quantity: 1 }] } });
    expect(changesSent(h)[0].body).toMatchObject({ Journal: "71" });
    expect(h.calls.some((call) => call.path.endsWith("/financial/Journals"))).toBe(false);
  });

  it("refuses a change that would start after the send cut-off of its HTTP request", async () => {
    const { h, client } = await connected();
    let release!: () => void;
    h.fake.readBarrier = new Promise<void>((resolve) => { release = resolve; });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    try {
      const pending = client.callTool({ name: "create_customer", arguments: { division: 123456, name: "Late probe" } });
      await vi.waitFor(() => expect(h.calls.some((call) => call.path.endsWith("/system/Divisions"))).toBe(true));
      await vi.advanceTimersByTimeAsync(7_500);
      release(); h.fake.readBarrier = undefined;
      const late = await pending;
      expect(late.isError).toBe(true);
      expect(text(late)).toContain("Nothing was changed");
      expect(changesSent(h)).toHaveLength(0);
    } finally { vi.useRealTimers(); }
  });

  it("asks for journalCode instead of choosing from a partial or unreadable journal list", async () => {
    const { h, client } = await connected();
    const draft = { division: 123456, customerId: USER_B, lines: [{ itemId: ITEM, quantity: 1 }] };
    h.fake.journalsNext = true;
    expect(text(await client.callTool({ name: "create_draft_sales_invoice", arguments: draft }))).toContain("journalCode");
    h.fake.journalsNext = false; h.fake.journals = [{ Code: "70", Description: "Sales", IsBlocked: false }, { Code: 70 }];
    expect(text(await client.callTool({ name: "create_draft_sales_invoice", arguments: draft }))).toContain("journalCode");
    expect(changesSent(h)).toHaveLength(0);
  });

  it.each([["the answer is lost", () => { throw new TypeError("socket closed"); }],
    ["Exact answers with a timeout", () => new Response("", { status: 408 })],
    ["Exact's answer is not JSON", () => new Response("<html>", { status: 200 })]] as const)(
    "sends once and reports an unknown outcome when %s", async (_, answer) => {
      let sends = 0;
      const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret", region: "nl",
        callback: "http://127.0.0.1:1/exact/callback" }, async () => { sends++; return answer(); }, "http://127.0.0.1:1");
      await expect(source.change(123456, { method: "POST", resource: "crm/Accounts", body: { Name: "x" } }, "fictional-token",
        AbortSignal.timeout(1000), Infinity, async () => {})).rejects.toThrow(/may or may not have been made/);
      expect(sends).toBe(1);
    });
});
