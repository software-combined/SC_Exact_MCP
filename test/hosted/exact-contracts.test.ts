import { describe, expect, it, vi } from "vitest";
import { normalize } from "../../src/hosted/exact/normalize.js";
import { inputs, type Query } from "../../src/hosted/domain/contracts.js";
import { rowsEnvelope } from "../../src/hosted/exact/http.js";
import { tokenResponse } from "../../src/hosted/exact/token-response.js";
import { ExactSource } from "../../src/hosted/exact/source.js";
import { MemoryStore } from "../../src/hosted/storage/memory.js";
import { Budgets } from "../../src/hosted/runtime/budgets.js";
import { SourceSlot } from "../../src/hosted/runtime/source-slot.js";
import { invoiceRow, receivableRow, companyRow, customerRow, INVOICE, USER_A, USER_B } from "./records.js";

describe("canonical Exact contracts", () => {
  it("uses one reserved fixed token-and-Me pair and retains the shared REST slot", async () => {
    const store = new MemoryStore(); const slot = new SourceSlot(store, "fictional-app");
    const run = vi.spyOn(slot, "run");
    const budgets = new Budgets(store, "fictional-app", { appCallsPerMinute: 2, appCallsPerDay: 2,
      divisionCallsPerMinute: 2, divisionCallsPerDay: 2 });
    const ordinary = vi.fn<typeof fetch>().mockRejectedValue(new Error("Ordinary fetch must not run."));
    const reserved = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "fictional-access",
        refresh_token: "fictional-refresh", token_type: "Bearer", expires_in: 600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ d: [{ UserID: USER_A, CurrentDivision: 123456, FullName: "Fictional user" }] })));
    const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret", region: "nl",
      callback: "https://fixture.invalid/exact/callback" }, ordinary, undefined,
      (read, signal) => slot.run(read, signal), () => budgets.exchangeFetcher(reserved));
    const pair = await source.prepareExchange(); const signal = AbortSignal.timeout(1000);
    const tokens = await pair.exchange("code", "fictional-code", signal);
    expect((await pair.me(tokens.accessToken, signal)).UserID).toBe(USER_A);
    expect(reserved.mock.calls.map(([url, init]) => [new URL(url.toString()).pathname, init?.method]))
      .toEqual([["/api/oauth2/token", "POST"], ["/api/v1/current/Me", "GET"]]);
    expect(ordinary).not.toHaveBeenCalled(); expect(run).toHaveBeenCalledTimes(1);
    await expect(budgets.call()).rejects.toMatchObject({ code: "limited" });
  });
  it.each([
    { name: "companies", query: { operation: "company_discovery", input: {} }, row: companyRow,
      resource: "system/Divisions", filter: null, select: "Code,Description,Currency",
      expected: { division: 123456, name: "Fictional company", currency: "EUR" } },
    { name: "customer name", query: { operation: "customer_search", input: { division: 123456, name: "Fictional" } },
      row: customerRow, resource: "crm/Accounts", filter: "IsSales eq true and substringof('Fictional',Name)",
      select: "ID,Code,Name", expected: { id: USER_B, code: "C001", name: "Fictional customer" } },
    { name: "customer code", query: { operation: "customer_search", input: { division: 123456, code: "C001" } },
      row: customerRow, resource: "crm/Accounts", filter: "IsSales eq true and substringof('C001',Code)",
      select: "ID,Code,Name", expected: { id: USER_B, code: "C001", name: "Fictional customer" } },
    ...[{ invoiceId: INVOICE }, { invoiceNumber: 20260001 }].map((selector) => ({
      name: "invoice " + ("invoiceId" in selector ? "ID" : "number"),
      query: { operation: "invoice_lookup", input: { division: 123456, ...selector } },
      row: { ...invoiceRow, Currency: "USD", AmountDC: 987.65 },
      resource: "salesinvoice/SalesInvoices" + ("invoiceId" in selector ? `(guid'${INVOICE}')` : ""),
      filter: "invoiceId" in selector ? null : "InvoiceNumber eq 20260001",
      select: "InvoiceID,InvoiceNumber,InvoiceToName,InvoiceDate,DueDate,Currency,AmountFC,Status",
      expected: { id: INVOICE, invoiceNumber: 20260001, amount: 125.25, currency: "USD" },
    })),
  ])("reads a valid $name result with its fixed source contract", async (example) => {
    const query = example.query as Query;
    const keyed = "invoiceId" in query.input;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ d: keyed ? example.row : [example.row] })));
    const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret",
      region: "nl", callback: "https://fixture.invalid/exact/callback" }, fetcher);
    const result = await source.read(query, 123456, "fictional-token", AbortSignal.timeout(1000));
    const [target, options] = fetcher.mock.calls[0]; const url = new URL(target.toString());
    expect(url.pathname).toBe(`/api/v1/123456/${example.resource}`);
    expect(url.searchParams.get("$filter")).toBe(example.filter);
    expect(url.searchParams.get("$select")).toBe(example.select);
    expect(options).toMatchObject({ method: "GET", redirect: "error" });
    expect(normalize(query.operation, result.rows[0])).toMatchObject(example.expected);
    expect(result.next).toBeUndefined(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("uses fixed identity and company metadata reads", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ d: [{ UserID: USER_A, CurrentDivision: 123456, FullName: "Fictional user" }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ d: [companyRow] })));
    const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret",
      region: "nl", callback: "https://fixture.invalid/exact/callback" }, fetcher);
    expect(await source.me("fictional-token")).toEqual({ UserID: USER_A, CurrentDivision: 123456, FullName: "Fictional user" });
    expect(await source.company(123456, "fictional-token", AbortSignal.timeout(1000))).toEqual(companyRow);
    const identity = new URL(fetcher.mock.calls[0][0].toString());
    expect(identity.pathname).toBe("/api/v1/current/Me");
    expect(identity.searchParams.get("$select")).toBe("UserID,CurrentDivision,FullName");
    expect(new URL(fetcher.mock.calls[1][0].toString()).searchParams.get("$filter")).toBe("Code eq 123456");
  });
  it.each(["code", "refresh"] as const)("uses the fixed %s token exchange", async (kind) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      access_token: "fictional-access", refresh_token: "fictional-refresh", token_type: "Bearer", expires_in: 600,
    })));
    const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret",
      region: "nl", callback: "https://fixture.invalid/exact/callback" }, fetcher);
    expect(await source.exchange(kind, "fictional-input")).toMatchObject({ accessToken: "fictional-access", refreshToken: "fictional-refresh" });
    const [target, options] = fetcher.mock.calls[0];
    expect(target).toBe("https://start.exactonline.nl/api/oauth2/token");
    expect(options).toMatchObject({ method: "POST", redirect: "error" });
    const form = options!.body as URLSearchParams;
    expect(form.get("grant_type")).toBe(kind === "code" ? "authorization_code" : "refresh_token");
    expect(form.get(kind === "code" ? "code" : "refresh_token")).toBe("fictional-input");
    expect(form.get("redirect_uri")).toBe(kind === "code" ? "https://fixture.invalid/exact/callback" : null);
  });
  it("reads a filtered receivables page and preserves its source amount and row currency", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      d: [{ ...receivableRow, CurrencyCode: "USD" }],
    })));
    const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret",
      region: "nl", callback: "https://fixture.invalid/exact/callback" }, fetcher);
    const result = await source.read({ operation: "receivables", input: { division: 123456,
      customerId: USER_B, overdueBefore: "2026-01-31" } }, 123456, "fictional-token", AbortSignal.timeout(1000));
    const [target, options] = fetcher.mock.calls[0];
    const url = new URL(target.toString());
    expect(url.pathname).toBe("/api/v1/123456/read/financial/ReceivablesList");
    expect(options).toMatchObject({ method: "GET", redirect: "error" });
    expect(url.searchParams.get("$filter")).toBe(`DueDate lt datetime'2026-01-31T00:00:00' and AccountId eq guid'${USER_B}'`);
    expect(url.searchParams.get("$select")).toContain("Amount,CurrencyCode");
    expect(normalize("receivables", result.rows[0])).toMatchObject({ id: "123", customerId: USER_B,
      invoiceNumber: 20260001, currency: "USD", openAmount: 125.25 });
    expect(result.next).toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("continues a financial query with its fixed filters and projection and returns the distinct final page", async () => {
    const next = "https://start.exactonline.nl/api/v1/123456/read/financial/ReceivablesList?$skiptoken=second-page";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ d: { results: [receivableRow], __next: next } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ d: { results: [{ ...receivableRow,
        HID: 124, InvoiceNumber: 20260002, Amount: 42.50, CurrencyCode: "GBP" }] } })));
    const source = new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret",
      region: "nl", callback: "https://fixture.invalid/exact/callback" }, fetcher);
    const query: Query = { operation: "receivables", input: { division: 123456,
      customerId: USER_B, overdueBefore: "2026-01-31" } };
    const first = await source.read(query, 123456, "fictional-token", AbortSignal.timeout(1000));
    expect(first.next).toBeTruthy();
    const second = await source.read(query, 123456, "fictional-token", AbortSignal.timeout(1000), first.next);
    const original = new URL(fetcher.mock.calls[0][0].toString());
    const continued = new URL(fetcher.mock.calls[1][0].toString());
    expect(continued.pathname).toBe(original.pathname);
    for (const key of ["$select", "$filter", "$orderby"]) expect(continued.searchParams.get(key)).toBe(original.searchParams.get(key));
    expect(original.searchParams.get("$skiptoken")).toBeNull();
    expect(continued.searchParams.get("$skiptoken")).toBe("second-page");
    expect(normalize("receivables", first.rows[0])).toMatchObject({ id: "123", openAmount: 125.25, currency: "EUR" });
    expect(normalize("receivables", second.rows[0])).toMatchObject({ id: "124", invoiceNumber: 20260002, openAmount: 42.50, currency: "GBP" });
    expect(second.next).toBeUndefined(); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([{}, { d: {} }, { d: null }, { d: { results: null } }, { d: { results: [], __next: 2 } }, { d: { results: [], __next: "" } }])(
    "never converts a malformed collection into empty success: %j", (value) => {
      expect(() => rowsEnvelope(value)).toThrow(/malformed/);
    });
  it.each(["125.25", "NaN", null, undefined, Infinity])("rejects nonnumeric financial fields: %s", (amount) => {
    expect(() => normalize("invoice_lookup", { ...invoiceRow, AmountFC: amount })).toThrow(/invalid source fields/);
    expect(() => normalize("receivables", { ...receivableRow, Amount: amount })).toThrow(/invalid source fields/);
  });
  it("rejects impossible dates and keyed read cursors", () => {
    expect(inputs.receivables.safeParse({ division: 123456, overdueBefore: "2026-02-30" }).success).toBe(false);
    expect(inputs.invoice_lookup.safeParse({ division: 123456, invoiceId: INVOICE, cursor: "x".repeat(43) }).success).toBe(false);
  });
  it.each([600, "600"])("accepts a validated Exact expiry %j", async (expiry) => {
    const value = await tokenResponse(new Response(JSON.stringify({ access_token: "fixture-a", refresh_token: "fixture-r", token_type: "bEaReR", expires_in: expiry })));
    expect(value.expiresAt - value.issuedAt).toBe(600_000);
  });
  it("accepts Exact token characters such as ! and rejects whitespace or control characters", async () => {
    const tokens = (access: string) => new Response(JSON.stringify({ access_token: access, refresh_token: "Gcp!IAAAAfixture", token_type: "bearer", expires_in: "600" }));
    expect((await tokenResponse(tokens("AAEA!fixture*access"))).refreshToken).toBe("Gcp!IAAAAfixture");
    for (const bad of ["fixture access", "fixture\r\naccess", "fixture\taccess"]) {
      await expect(tokenResponse(tokens(bad))).rejects.toMatchObject({ code: "reauth_required" });
    }
  });
  it.each([true, "600.0", " 600", "6e2", 0, 3601, "Infinity"])("rejects a malformed expiry %j", async (expiry) => {
    await expect(tokenResponse(new Response(JSON.stringify({ access_token: "fixture-a", refresh_token: "fixture-r", token_type: "Bearer", expires_in: expiry })))).rejects.toMatchObject({ code: "reauth_required" });
  });
});
