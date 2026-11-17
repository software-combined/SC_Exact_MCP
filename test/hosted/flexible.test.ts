import { afterEach, describe, expect, it } from "vitest";
import { exactFixture, USER_A, USER_B, ITEM, CUSTOMER_TWO, customerRow, customerTwoRow, customerThreeRow, itemRow } from "./exact-fixture.js";
import type { Principal } from "../../src/hosted/domain/identity.js";
import { serviceTools } from "../../scripts/build-copilot-package.mjs";

const active: Awaited<ReturnType<typeof exactFixture>>[] = [];
afterEach(async () => { await Promise.all(active.splice(0).map((h) => h.close())); });
async function setup() {
  const h = await exactFixture(); active.push(h); h.codes.set("fixture-code", USER_A);
  const connection = await h.connections.connect("fixture-code");
  const principal: Principal = { subject: connection.subject, generation: connection.generation, grantId: "fixture", clientId: "claude" };
  const read = (operation: Parameters<typeof h.accounting.read>[0], input: unknown) =>
    h.accounting.read(operation, input, principal, AbortSignal.timeout(5000));
  const change = (operation: Parameters<typeof h.changes.change>[0], input: unknown) =>
    h.changes.change(operation, input, principal, AbortSignal.timeout(5000), Date.now() + 7000);
  const sent = () => h.calls.filter((call) => call.method === "POST" || call.method === "PUT")
    .filter((call) => call.path.startsWith("/api/v1/"));
  const last = (resource: string) => h.calls.filter((call) => call.path.includes(resource)).at(-1)!;
  return { ...h, principal, read, change, sent, last };
}

describe("reads with only a company", () => {
  it("lists the first customers and items without a filter, and applies each optional filter", async () => {
    const h = await setup();
    expect((await h.read("customer_search", { division: 123456 })).rows).toHaveLength(1);
    expect(h.last("/crm/Accounts").query.get("$filter")).toBe("IsSales eq true");
    expect((await h.read("item_search", { division: 123456 })).rows).toHaveLength(1);
    expect(h.last("/logistics/Items").query.get("$filter")).toBe("IsSalesItem eq true");
    await h.read("customer_search", { division: 123456, name: "Fict", code: "C0", city: "Amster", email: "@example", vatNumber: "B01" });
    expect(h.last("/crm/Accounts").query.get("$filter")).toBe("IsSales eq true and substringof('Fict',Name) and " +
      "substringof('C0',Code) and substringof('Amster',City) and substringof('@example',Email) and substringof('B01',VATNumber)");
    await h.read("item_search", { division: 123456, description: "hour", code: "CONSULT" });
    expect(h.last("/logistics/Items").query.get("$filter")).toBe("IsSalesItem eq true and Code eq 'CONSULT' and substringof('hour',Description)");
    expect(h.calls.some((call) => call.query.has("$top"))).toBe(false);
  });

  it("returns at most limit rows and continues from the next row of the same page, then the next Exact page", async () => {
    const h = await setup(); h.fake.customers = [customerRow, customerTwoRow, customerThreeRow];
    h.fake.next = `${h.exactOrigin}/api/v1/123456/crm/Accounts?$skiptoken=page-two`;
    const query = { division: 123456, limit: 2 };
    const first = await h.read("customer_search", query);
    expect(first.rows).toMatchObject([{ id: USER_B }, { id: CUSTOMER_TWO }]);
    expect(first.coverage).toMatchObject({ state: "partial", returned: 2 });
    const second = await h.read("customer_search", { ...query, cursor: first.coverage.nextCursor });
    expect(second.rows).toHaveLength(1);
    expect(h.last("/crm/Accounts").query.get("$skiptoken")).toBeNull();
    h.fake.next = undefined; h.fake.customers = [customerThreeRow];
    const third = await h.read("customer_search", { ...query, cursor: second.coverage.nextCursor });
    expect(h.last("/crm/Accounts").query.get("$skiptoken")).toBe("page-two");
    expect(third.coverage.state).toBe("complete");
    h.fake.customers = [customerRow, customerTwoRow, customerThreeRow];
    for (const changed of [{ division: 123456, limit: 3 }, { division: 123456, limit: 2, city: "Utrecht" }]) {
      const page = await h.read("customer_search", query);
      await expect(h.read("customer_search", { ...changed, cursor: page.coverage.nextCursor })).rejects.toMatchObject({ code: "denied" });
    }
  });

  it("lists invoices newest first, by customer name, dates and status, with a readable status", async () => {
    const h = await setup();
    const recent = await h.read("invoice_lookup", { division: 123456 });
    expect(recent.rows[0]).toMatchObject({ status: 50, statusLabel: "processed" });
    expect(h.last("/salesinvoice/").query.get("$filter")).toBeNull();
    expect(h.last("/salesinvoice/").query.get("$orderby")).toBe("InvoiceDate desc,InvoiceID");
    await h.read("invoice_lookup", { division: 123456, customer: "Fictional", fromDate: "2026-01-01", toDate: "2026-01-31", status: "open" });
    const lookup = h.last("/crm/Accounts").query;
    expect([lookup.get("$filter"), lookup.get("$top")])
      .toEqual(["IsSales eq true and (substringof('Fictional',Code) or substringof('Fictional',Name))", "11"]);
    expect(h.last("/salesinvoice/").query.get("$filter")).toBe(`InvoiceTo eq guid'${USER_B}' and ` +
      "InvoiceDate ge datetime'2026-01-01T00:00:00' and InvoiceDate le datetime'2026-01-31T23:59:59' and Status eq 20");
  });

  it("reads receivables by customer name and by days overdue", async () => {
    const h = await setup();
    await h.read("receivables", { division: 123456, customer: "Fictional", overdueDays: 30 });
    const before = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
    expect(h.last("ReceivablesList").query.get("$filter")).toBe(`DueDate lt datetime'${before}T00:00:00' and AccountId eq guid'${USER_B}'`);
  });

  it("stops a read when a customer name matches no one or several customers, and picks a unique exact name", async () => {
    const h = await setup(); h.fake.customers = [];
    await expect(h.read("receivables", { division: 123456, customer: "Nobody" }))
      .rejects.toThrow("No customer matches 'Nobody' in company 123456.");
    h.fake.customers = [customerTwoRow, customerThreeRow];
    await expect(h.read("invoice_lookup", { division: 123456, customer: "fict" })).rejects.toThrow(
      "Several customers match 'fict' in company 123456: Fictional customer two (C002), Other fictional client (C003). Ask which one is meant");
    expect(h.calls.some((call) => call.path.includes("/salesinvoice/") || call.path.endsWith("ReceivablesList"))).toBe(false);
    h.fake.customers = [customerRow, customerTwoRow];
    await h.read("invoice_lookup", { division: 123456, customer: "fictional CUSTOMER" });
    expect(h.last("/salesinvoice/").query.get("$filter")).toBe(`InvoiceTo eq guid'${USER_B}'`);
  });

  it("names the field and the fix in validation errors", async () => {
    const h = await setup();
    await expect(h.read("invoice_lookup", { division: 123456, customerId: USER_B, customer: "Fictional" }))
      .rejects.toThrow("Give at most one of customerId or customer.");
    await expect(h.read("receivables", { division: 123456, overdueDays: 5, overdueBefore: "2026-01-01" }))
      .rejects.toThrow("Give at most one of overdueBefore or overdueDays.");
    await expect(h.read("customer_search", { division: "123456" })).rejects.toThrow(/^division: /);
    await expect(h.read("customer_search", { division: 123456, limit: 500 })).rejects.toThrow(/^limit: /);
    await expect(h.change("update_customer", { division: 123456, phone: "0101234567" })).rejects.toThrow("customerId or customer");
    await expect(h.change("create_draft_sales_invoice", { division: 123456, customerId: USER_B, lines: [{ quantity: 1 }] }))
      .rejects.toThrow(/^lines\.0: Give exactly one of itemId or item/);
    expect(h.sent()).toHaveLength(0);
  });

  it("tells the AI what it can list without filters and that names work instead of IDs", async () => {
    const tools = Object.fromEntries((await serviceTools(() => import("../../src/hosted/transport/mcp.js")))
      .map((tool: { name: string; description: string }) => [tool.name, tool.description]));
    for (const name of ["customer_search", "invoice_lookup", "item_search"]) expect(tools[name]).toContain("With no other filter");
    for (const name of ["customer_search", "invoice_lookup", "receivables"]) expect(tools[name]).toContain("not a total");
    expect(tools.update_customer).toContain("by name (customer)");
    expect(tools.create_draft_sales_invoice).toContain("item (the item code or description)");
  });
});

describe("changes by name", () => {
  it("updates and invoices a customer named by text, with items named by code", async () => {
    const h = await setup();
    await h.change("update_customer", { division: 123456, customer: "Fictional customer", phone: "0101234567" });
    expect(h.sent()[0]).toMatchObject({ method: "PUT", path: `/api/v1/123456/crm/Accounts(guid'${USER_B}')`, body: { Phone: "0101234567" } });
    await h.change("create_draft_sales_invoice", { division: 123456, customer: "c001",
      lines: [{ item: "CONSULT", quantity: 2 }, { item: "consult", quantity: 1 }, { itemId: ITEM, quantity: 1 }] });
    expect(h.sent()[1].body).toMatchObject({ OrderedBy: USER_B, SalesInvoiceLines: [{ Item: ITEM, Quantity: 2 },
      { Item: ITEM, Quantity: 1 }, { Item: ITEM, Quantity: 1 }] });
    const lookups = h.calls.filter((call) => call.path.endsWith("/logistics/Items"));
    expect(lookups).toHaveLength(1);
    expect(lookups[0].query.get("$filter")).toBe("IsSalesItem eq true and (Code eq 'CONSULT' or substringof('CONSULT',Description))");
  });

  it.each(["update_customer", "create_draft_sales_invoice"] as const)("%s sends nothing when the customer name is unclear", async (tool) => {
    const h = await setup();
    const input = tool === "update_customer" ? { phone: "0101234567" } : { lines: [{ itemId: ITEM, quantity: 1 }] };
    h.fake.customers = [];
    await expect(h.change(tool, { division: 123456, customer: "Nobody", ...input }))
      .rejects.toThrow("No customer matches 'Nobody' in company 123456. Nothing was changed.");
    h.fake.customers = [customerTwoRow, customerThreeRow];
    await expect(h.change(tool, { division: 123456, customer: "fict", ...input }))
      .rejects.toThrow(/Fictional customer two \(C002\), Other fictional client \(C003\).*Nothing was changed\.$/);
    expect(h.sent()).toHaveLength(0);
  });

  it("offers a single partial match back instead of changing it, and refuses an incomplete lookup", async () => {
    const h = await setup();
    await expect(h.change("update_customer", { division: 123456, customer: "Fictional", phone: "0101234567" }))
      .rejects.toThrow("Did you mean Fictional customer (C001)? Give its exact name or code. Nothing was changed.");
    h.fake.next = `${h.exactOrigin}/api/v1/123456/crm/Accounts?$skiptoken=more`;
    await expect(h.change("update_customer", { division: 123456, customer: "Fictional customer", phone: "0101234567" }))
      .rejects.toThrow("Too many records match that text. Give the exact name or code. Nothing was changed.");
    expect(h.sent()).toHaveLength(0);
  });

  it("refuses when more than 10 records match, even if one of the first 10 has the exact name", async () => {
    const h = await setup();
    const many = Array.from({ length: 10 }, (_, n) => ({ ID: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`,
      Code: `C01${n}`, Name: `Acme ${n}` }));
    h.fake.customers = [{ ...customerRow, Name: "Acme" }, ...many, { ...customerTwoRow, Name: "Acme" }];
    for (const tool of ["update_customer", "create_draft_sales_invoice"] as const) {
      const input = tool === "update_customer" ? { phone: "0101234567" } : { lines: [{ itemId: ITEM, quantity: 1 }] };
      await expect(h.change(tool, { division: 123456, customer: "Acme", ...input }))
        .rejects.toThrow("Too many records match that text. Give the exact name or code. Nothing was changed.");
    }
    await expect(h.read("receivables", { division: 123456, customer: "Acme" })).rejects.toThrow("Too many records match that text.");
    expect(h.last("/crm/Accounts").query.get("$top")).toBe("11");
    h.fake.items = Array.from({ length: 11 }, (_, n) => ({ ...itemRow, ID: `bbbbbbbb-bbbb-4bbb-8bbb-${String(n).padStart(12, "0")}`,
      Code: `HOUR${n}`, Description: "Fictional hour" }));
    await expect(h.change("create_draft_sales_invoice", { division: 123456, customerId: USER_B, lines: [{ item: "HOUR0", quantity: 1 }] }))
      .rejects.toThrow("Too many records match that text.");
    expect(h.sent()).toHaveLength(0);
  });

  it("refuses two exact same-name records for a change, and picks the exact name among partial matches", async () => {
    const h = await setup();
    h.fake.customers = [{ ...customerRow, Name: "Acme" }, { ...customerTwoRow, Name: "Acme" }];
    for (const tool of ["update_customer", "create_draft_sales_invoice"] as const) {
      const input = tool === "update_customer" ? { phone: "0101234567" } : { lines: [{ itemId: ITEM, quantity: 1 }] };
      await expect(h.change(tool, { division: 123456, customer: "Acme", ...input }))
        .rejects.toThrow(/^Several customers match 'Acme' in company 123456: .*Nothing was changed\.$/);
    }
    h.fake.items = [itemRow, { ...itemRow, ID: CUSTOMER_TWO, Code: "CONSULT2" }];
    await expect(h.change("create_draft_sales_invoice", { division: 123456, customerId: USER_B,
      lines: [{ item: itemRow.Description, quantity: 1 }] })).rejects.toThrow(/^Several sales items match/);
    expect(h.sent()).toHaveLength(0);
    h.fake.customers = [{ ...customerRow, Name: "Acme" }, { ...customerTwoRow, Name: "Acme Ltd" }];
    await h.change("update_customer", { division: 123456, customer: "acme", phone: "0101234567" });
    expect(h.sent()).toMatchObject([{ method: "PUT", path: `/api/v1/123456/crm/Accounts(guid'${USER_B}')` }]);
  });

  it("refuses a later page when the customer name now matches a different record", async () => {
    const h = await setup(); h.fake.invoicesNext = true;
    const input = { division: 123456, customer: "Fictional customer" };
    const first = await h.read("invoice_lookup", input);
    expect(first.coverage.nextCursor).toBeTruthy();
    h.fake.customers = [{ ...customerTwoRow, Name: "Fictional customer" }];
    await expect(h.read("invoice_lookup", { ...input, cursor: first.coverage.nextCursor })).rejects.toMatchObject({
      code: "denied", message: "The customer name now matches a different record. Ask the question again." });
  });

  it("sends no invoice when an item name matches no item or several items", async () => {
    const h = await setup(); h.fake.items = [];
    const draft = { division: 123456, customerId: USER_B, lines: [{ item: "Training", quantity: 1 }] };
    await expect(h.change("create_draft_sales_invoice", draft)).rejects.toThrow("No sales item matches 'Training' in company 123456.");
    h.fake.items = [itemRow, { ...itemRow, ID: CUSTOMER_TWO, Code: "TRAIN", Description: "Fictional training hour" }];
    await expect(h.change("create_draft_sales_invoice", { ...draft, lines: [{ item: "hour", quantity: 1 }] }))
      .rejects.toThrow("Several sales items match 'hour' in company 123456: Fictional consulting hour (CONSULT), " +
        "Fictional training hour (TRAIN). Ask which one is meant, then give its exact item code. Nothing was changed.");
    expect(h.sent()).toHaveLength(0);
  });
});
