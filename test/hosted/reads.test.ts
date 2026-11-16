import { afterEach, describe, expect, it, vi } from "vitest";
import { exactFixture as harness, USER_A, USER_B, INVOICE, customerRow } from "./exact-fixture.js";
import type { Connection, Principal } from "../../src/hosted/domain/identity.js";

const active: Awaited<ReturnType<typeof harness>>[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(active.splice(0).map((h) => h.close())); });
async function setup() {
  const h = await harness(); active.push(h); h.codes.set("fixture-code", USER_A);
  const connection = await h.connections.connect("fixture-code");
  const principal: Principal = { subject: connection.subject, generation: connection.generation, grantId: "fixture", clientId: "claude" };
  return { ...h, principal, signal: AbortSignal.timeout(5000) };
}
describe("fixed reads and source integrity", () => {
  it("escapes string values without exposing OData syntax or expanding projection", async () => {
    const h = await setup();
    await h.accounting.read("customer_search", { division: 123456, name: "O'Brien') or IsSales eq false" }, h.principal, h.signal);
    const call = h.calls.find((v) => v.path.endsWith("/crm/Accounts"))!;
    expect(call.query.get("$filter")).toBe("IsSales eq true and substringof('O''Brien'') or IsSales eq false',Name)");
    expect([...call.query.keys()].sort()).toEqual(["$filter", "$orderby", "$select"]);
    expect(call.query.get("$select")).toBe("ID,Code,Name");
  });
  it("checks current source division permission on every call", async () => {
    const h = await setup();
    expect((await h.accounting.read("invoice_lookup", { division: 123456, invoiceId: INVOICE }, h.principal, h.signal)).rows).toHaveLength(1);
    h.fake.denyDivision = true;
    await expect(h.accounting.read("invoice_lookup", { division: 123456, invoiceId: INVOICE }, h.principal, h.signal)).rejects.toMatchObject({ code: "denied" });
    expect(h.calls.filter((v) => v.path.includes("/salesinvoice/"))).toHaveLength(1);
  });
  it("reads and filters Exact record GUIDs without RFC version or variant bits", async () => {
    const h = await setup(); const id = "a2e51d82-3b8d-e611-80c2-00155d010a07"; h.fake.rowId = id;
    expect((await h.accounting.read("invoice_lookup", { division: 123456, invoiceId: id }, h.principal, h.signal)).rows[0])
      .toMatchObject({ id });
    expect(h.calls.at(-1)?.path).toContain(`guid'${id}'`);
    expect((await h.accounting.read("customer_search", { division: 123456, code: "C001" }, h.principal, h.signal)).rows[0])
      .toMatchObject({ id });
    expect((await h.accounting.read("receivables", { division: 123456, customerId: id }, h.principal, h.signal)).rows[0])
      .toMatchObject({ customerId: id });
  });
  it("uses current balances and row currency without inventing a total or a historical balance", async () => {
    const h = await setup();
    const result = await h.accounting.read("receivables", { division: 123456, overdueBefore: "2026-01-31" }, h.principal, h.signal);
    expect(result.rows[0]).toMatchObject({ openAmount: 125.25, currency: "EUR" });
    expect(result.company?.currency).toBe("EUR");
    expect(result).not.toHaveProperty("total");
    expect(h.calls.find((v) => v.path.endsWith("ReceivablesList"))?.query.get("$filter")).toBe("DueDate lt datetime'2026-01-31T00:00:00'");
  });
  it.each([{ division: -1, name: "ok" }, { division: 123456 }, { division: 123456, name: "ok", code: "C001" },
    { division: 123456, name: "ok", select: "*" }, { division: 123456, name: "ok", cursor: "provider-skiptoken" }])(
    "rejects invalid arguments before protected reads: %j", async (input) => {
      const h = await setup(); const before = h.calls.length;
      await expect(h.accounting.read("customer_search", input, h.principal, h.signal)).rejects.toMatchObject({ code: "invalid_input" });
      expect(h.calls.length).toBe(before);
    });
  it("bounds the source response size before exposing it", async () => {
    const h = await setup(); h.fake.responseOverride = { d: [{ ...customerRow, Name: "x".repeat(600_000) }] };
    await expect(h.accounting.read("customer_search", { division: 123456, name: "ok" }, h.principal, h.signal)).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("opaque, scoped continuation", () => {
  it("returns a handle, supports one continuation, and rejects replay", async () => {
    const h = await setup(); h.fake.next = `${h.exactOrigin}/api/v1/123456/crm/Accounts?$skiptoken=provider-private-value`;
    const query = { division: 123456, name: "Fictional" };
    const first = await h.accounting.read("customer_search", query, h.principal, h.signal);
    expect(first.coverage.state).toBe("partial"); expect(first.coverage.nextCursor).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(first)).not.toContain("provider-private-value"); expect(JSON.stringify(first)).not.toContain(h.exactOrigin);
    h.fake.next = undefined;
    const second = await h.accounting.read("customer_search", { ...query, cursor: first.coverage.nextCursor }, h.principal, h.signal);
    expect(second.coverage.state).toBe("complete");
    await expect(h.accounting.read("customer_search", { ...query, cursor: first.coverage.nextCursor }, h.principal, h.signal)).rejects.toMatchObject({ code: "denied" });
  });
  it("binds query, division, user, and connection generation", async () => {
    const h = await setup(); h.fake.next = `${h.exactOrigin}/api/v1/123456/crm/Accounts?$skiptoken=one`;
    const first = await h.accounting.read("customer_search", { division: 123456, name: "Fictional" }, h.principal, h.signal);
    const cursor = first.coverage.nextCursor;
    for (const input of [{ division: 123456, name: "Other", cursor }, { division: 654321, name: "Fictional", cursor }]) {
      await expect(h.accounting.read("customer_search", input, h.principal, h.signal)).rejects.toMatchObject({ code: "denied" });
    }
    h.codes.set("other-person", USER_B); const other = await h.connections.connect("other-person");
    await expect(h.accounting.read("customer_search", { division: 123456, name: "Fictional", cursor }, {
      ...h.principal, subject: other.subject, generation: other.generation }, h.signal)).rejects.toMatchObject({ code: "denied" });
    const key = h.connections.key(h.principal.subject); const old = (await h.store.read<Connection>(key))!;
    await h.store.write(key, { ...old.value, generation: old.value.generation + 1 }, old.version);
    await expect(h.accounting.read("customer_search", { division: 123456, name: "Fictional", cursor }, {
      ...h.principal, generation: old.value.generation + 1 }, h.signal)).rejects.toMatchObject({ code: "denied" });
  });
  it("rejects an expired cursor with otherwise matching person, query and generation before source calls", async () => {
    const h = await setup(); h.fake.next = `${h.exactOrigin}/api/v1/123456/crm/Accounts?$skiptoken=expiring`;
    const query = { division: 123456, name: "Fictional" };
    const first = await h.accounting.read("customer_search", query, h.principal, h.signal);
    const before = h.calls.length;
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 600_001);
    await expect(h.accounting.read("customer_search", { ...query, cursor: first.coverage.nextCursor },
      h.principal, h.signal)).rejects.toMatchObject({ code: "denied" });
    expect(h.calls.length).toBe(before);
  });
  it.each(["https://evil.invalid/api/v1/123456/crm/Accounts?$skiptoken=x", "/api/v1/654321/crm/Accounts?$skiptoken=x",
    "/api/v1/123456/crm/Accounts?$skiptoken=x&$expand=Contacts", "/api/v1/123456/crm/Accounts?$skiptoken=x&$filter=1%20eq%201",
    "/api/v1/123456/crm/Accounts?$skiptoken=x&$skiptoken=y", "/api/v1/123456/crm/Accounts"])("rejects a changed source continuation: %s", async (next) => {
      const h = await setup(); h.fake.next = next;
      await expect(h.accounting.read("customer_search", { division: 123456, name: "Fictional" }, h.principal, h.signal)).rejects.toMatchObject({ code: "unavailable" });
    });
  it("detects repeated source next links instead of looping", async () => {
    const h = await setup(); h.fake.next = `${h.exactOrigin}/api/v1/123456/crm/Accounts?$skiptoken=repeat`;
    const query = { division: 123456, name: "Fictional" };
    const first = await h.accounting.read("customer_search", query, h.principal, h.signal);
    await expect(h.accounting.read("customer_search", { ...query, cursor: first.coverage.nextCursor }, h.principal, h.signal)).rejects.toThrow(/repeated/);
  });
});
