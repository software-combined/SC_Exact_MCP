import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ExactClient } from "../../src/api/client.js";
import { createServer } from "../../src/server.js";
import { hostedMcp } from "../../src/hosted/transport/mcp.js";
import { authorization, exchange, harness, USER_A, USER_B } from "./helpers.js";

const active: Awaited<ReturnType<typeof harness>>[] = [];
afterEach(async () => { await Promise.all(active.splice(0).map((h) => h.close())); });

async function list(server: ReturnType<typeof hostedMcp>) {
  const [serverSide, clientSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "catalogue-inventory", version: "1" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  try { return (await client.listTools()).tools; }
  finally { await client.close(); await server.close(); }
}

it("carries the 73 named BoostU reads and only the documented changes", async () => {
  const legacy = {} as ExactClient;
  const reads = await list(createServer(legacy, { readOnly: true }));
  const all = await list(createServer(legacy, { readOnly: false }));
  const readNames = reads.map((tool) => tool.name).filter((name) => name !== "exact_request");
  const omittedWrites = ["exact_purchase_invoice_lines_create", "exact_purchase_invoice_lines_update",
    "exact_purchase_order_lines_create", "exact_general_journal_entries_update", "exact_general_journal_entry_lines_update",
    "exact_item_groups_create", "exact_item_groups_update", "exact_sales_price_lists_create", "exact_sales_price_lists_update",
    "exact_units_create", "exact_units_update"];
  const expected = all.map((tool) => tool.name).filter((name) => name !== "exact_request" && !omittedWrites.includes(name));
  const hosted = await list(hostedMcp(undefined!, undefined!, undefined!, AbortSignal.timeout(1000), () => {}, 0, { inventory: true }));
  expect(readNames).toHaveLength(73);
  expect(expected).toHaveLength(135);
  expect(hosted.filter((tool) => tool.name.startsWith("exact_")).map((tool) => tool.name).sort()).toEqual(expected.sort());
  expect(hosted.filter((tool) => readNames.includes(tool.name)).every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  expect(hosted.find((tool) => tool.name === "exact_record_delete")?.annotations).toMatchObject({
    readOnlyHint: false, destructiveHint: true, idempotentHint: false,
  });
});

async function connect(h: Awaited<ReturnType<typeof harness>>, clientId: string) {
  const { token } = await exchange(h, await authorization(h, clientId));
  const client = new Client({ name: `catalogue-${clientId}`, version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${h.origin}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } },
  }));
  return client;
}

const id = "11111111-2222-3333-4444-555555555552";
const division = 123456;

it("requires fresh Copilot consent when catalogue changes are enabled", async () => {
  const h = await harness(); active.push(h);
  const original = await authorization(h, "copilot");
  const previous = await exchange(h, original);
  const other = await exchange(h, await authorization(h, "claude"));
  const broker = await h.restart(true);
  await expect(broker.authenticate(previous.token.access_token)).rejects.toThrow();
  await expect(broker.authenticate(other.token.access_token)).resolves.toMatchObject({ clientId: "claude" });
  const readConsent = original.browser.submit.bind(original.browser);
  const pages: string[] = [];
  original.browser.submit = async (page, raw) => {
    pages.push(await page.clone().text());
    return readConsent(page, raw);
  };
  const fresh = await exchange(h, await authorization(h, "copilot", original.browser));
  expect(pages.some((page) => page.includes("create, update, book, send or delete Exact records"))).toBe(true);
  await expect(broker.authenticate(fresh.token.access_token)).resolves.toMatchObject({ clientId: "copilot" });
});

it("reads a fixed named resource with typed criteria and rejects raw requests", async () => {
  const h = await harness(); active.push(h);
  h.fake.readOverride = (url) => url.pathname.endsWith("/financial/GLAccounts") ?
    { body: { d: { results: [{ ID: id, Code: "ABC", Description: "Fictional item", Unselected: "discard" }] } } } : undefined;
  const client = await connect(h, "claude");
  try {
    const query = { division, criteria: { Code: "a'bc" } };
    const result = await client.callTool({ name: "exact_gl_accounts_list", arguments: query });
    expect(result.structuredContent).toMatchObject({ rows: [{ ID: id, Code: "ABC" }], coverage: { state: "complete" } });
    expect(JSON.stringify(result)).not.toContain("discard");
    expect(h.calls.at(-1)?.query.get("$filter")).toBe("Code eq 'a''bc'");
    const calls = h.calls.length;
    expect((await client.callTool({ name: "exact_gl_accounts_list", arguments: { division, filter: "1 eq 1" } })).isError).toBe(true);
    expect((await client.callTool({ name: "exact_request", arguments: { division, method: "DELETE" } })).isError).toBe(true);
    expect(h.calls).toHaveLength(calls);
  } finally { await client.close(); }
});

it("matches the full date and preserves the currency for foreign ledger amounts", async () => {
  const h = await harness(); active.push(h);
  h.fake.readOverride = (url) => {
    if (!url.pathname.endsWith("/financialtransaction/TransactionLines")) return;
    const projection = (url.searchParams.get("$select") ?? "").split(",");
    const record = { ID: id, AmountDC: 90, AmountFC: 100, Currency: "USD", Modified: "2026-11-25T14:30:00Z" };
    return { body: { d: { results: [Object.fromEntries(Object.entries(record).filter(([field]) => projection.includes(field)))] } } };
  };
  const client = await connect(h, "claude");
  try {
    const result = await client.callTool({ name: "exact_transaction_lines_list",
      arguments: { division, criteria: { Modified: "2026-11-25" } } });
    expect(result.structuredContent).toMatchObject({ rows: [{ AmountDC: 90, AmountFC: 100, Currency: "USD" }] });
    expect(h.calls.at(-1)?.query.get("$filter")).toBe(
      "Modified ge datetime'2026-11-25T00:00:00' and Modified lt datetime'2026-11-26T00:00:00'");
  } finally { await client.close(); }
});

it("limits catalogue changes to the configured Copilot client and confirms a single deletion in Exact", async () => {
  const h = await harness(undefined, true); active.push(h);
  let exists = true;
  h.fake.readOverride = (url) => url.pathname.includes("/crm/Contacts(") ?
    exists ? { body: { d: { ID: id, FirstName: "Fictional", LastName: "Contact" } } } :
      { body: { error: "missing" }, status: 404 } : undefined;
  h.fake.writeOverride = (url, method) => {
    if (!url.pathname.includes("/crm/Contacts(") || method !== "DELETE") return;
    exists = false; return { body: null, status: 204 };
  };
  const copilot = await connect(h, "copilot"); const other = await connect(h, "claude");
  const call = { name: "exact_record_delete", arguments: { division, entity: "contacts", id } };
  try {
    expect((await other.listTools()).tools.some((tool) => tool.name === call.name)).toBe(false);
    expect((await other.callTool(call)).isError).toBe(true);
    expect((await copilot.callTool({ ...call, arguments: { ...call.arguments, entity: "system/Divisions" } })).isError).toBe(true);
    expect(h.calls.filter((entry) => entry.method === "DELETE")).toHaveLength(0);
    const result = await copilot.callTool(call);
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ outcome: "acknowledged", recordId: id, readback: "verified" });
    expect(h.logs).toContainEqual(expect.objectContaining({
      requestId: result.structuredContent?.requestId, detail: "catalogue-change:acknowledged",
    }));
    expect((await copilot.callTool(call)).isError).toBe(true);
    expect(h.calls.filter((entry) => entry.method === "DELETE")).toHaveLength(1);
  } finally { await copilot.close(); await other.close(); }
});

it("stops a changed target and blocks repeat sends after an uncertain Exact result", async () => {
  const h = await harness(undefined, true); active.push(h);
  let targetReads = 0;
  h.fake.readOverride = (url) => url.pathname.includes("/crm/Contacts(") ?
    { body: { d: { ID: id, FirstName: String(++targetReads), LastName: "Contact" } } } : undefined;
  h.fake.writeOverride = (url, method) => url.pathname.endsWith("/crm/Contacts") && method === "POST" ?
    { body: { error: "fictional private error" }, status: 500 } : undefined;
  const client = await connect(h, "copilot");
  try {
    const update = await client.callTool({ name: "exact_contacts_update", arguments: { division, id, fields: { FirstName: "New" } } });
    expect(update).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('"outcome":"conflict"') }] });
    expect(h.calls.filter((entry) => entry.method === "PUT")).toHaveLength(0);
    const create = { name: "exact_contacts_create", arguments: { division,
      fields: { Account: "11111111-2222-3333-4444-555555555abc", FirstName: "Fictional", LastName: "Contact" } } };
    const uncertain = await client.callTool(create);
    expect(uncertain).toMatchObject({ isError: true, content: [{ text: expect.stringContaining("may have reached Exact") }] });
    expect(JSON.stringify(uncertain)).not.toContain("fictional private error");
    expect((await client.callTool({ ...create, arguments: { division, fields: {
      ...create.arguments.fields, Account: create.arguments.fields.Account.toUpperCase(),
    } } })).isError).toBe(true);
    expect(h.calls.filter((entry) => entry.method === "POST" && entry.path.endsWith("/crm/Contacts"))).toHaveLength(1);
  } finally { await client.close(); }
});

it("checks Exact write permission and verifies a field omitted by the ordinary list", async () => {
  const h = await harness(undefined, true); active.push(h);
  const bank = "NL00FAKE0000001111";
  const otherBank = "NL00FAKE0000002222";
  let phone = "555-0100";
  h.fake.readOverride = (url) => {
    if (url.pathname.includes("/crm/BankAccounts(")) return { body: { d: { ID: id, BankAccount: bank } } };
    if (!url.pathname.includes("/crm/Accounts(")) return;
    const projection = (url.searchParams.get("$select") ?? "").split(",");
    return { body: { d: { ID: id, ...(projection.includes("Phone") ? { Phone: phone } : {}) } } };
  };
  h.fake.writeOverride = (url, method, user, body) => {
    if (method !== "PUT") return;
    if (user === USER_A) return { body: { error: "permission denied" }, status: 403 };
    if (url.pathname.includes("/crm/Accounts(")) phone = (body as { Phone: string }).Phone;
    return { body: null, status: 204 };
  };
  const denied = await connect(h, "copilot");
  h.fake.user = USER_B;
  const allowed = await connect(h, "copilot");
  const phoneChange = { name: "exact_accounts_update", arguments: { division, id, fields: { Phone: "555-0101" } } };
  try {
    const rejected = [];
    for (const account of [bank, otherBank]) {
      rejected.push(await denied.callTool({ name: "exact_bank_accounts_update",
        arguments: { division, id, fields: { BankAccount: account } } }));
    }
    expect(rejected[0]).toMatchObject({ isError: true });
    expect(rejected[0]).toEqual(rejected[1]);
    expect(h.calls.filter((call) => call.method === "PUT" && call.path.includes("/crm/BankAccounts("))).toHaveLength(2);
    expect((await denied.callTool(phoneChange)).isError).toBe(true);
    const result = await allowed.callTool(phoneChange);
    expect(result.structuredContent).toMatchObject({ outcome: "acknowledged", recordId: id, readback: "verified" });
    expect(h.calls.at(-1)?.query.get("$select")?.split(",")).toContain("Phone");
  } finally { await denied.close(); await allowed.close(); }
});

it("identifies a local budget refusal as unsent", async () => {
  const h = await harness({ appCallsPerMinute: 100, appCallsPerDay: 1000,
    divisionCallsPerMinute: 1, divisionCallsPerDay: 100 }, true); active.push(h);
  const client = await connect(h, "copilot");
  try {
    const result = await client.callTool({ name: "exact_contacts_create",
      arguments: { division, fields: { Account: id, FirstName: "Fictional", LastName: "Contact" } } });
    expect(result).toMatchObject({ isError: true, content: [{ text: expect.stringContaining("sent no change") }] });
    expect(h.calls.some((call) => call.method === "POST" && call.path.endsWith("/crm/Contacts"))).toBe(false);
  } finally { await client.close(); }
});
