import { afterEach, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { authorization, exchange, harness, USER_A, USER_B } from "./helpers.js";

const active: Awaited<ReturnType<typeof harness>>[] = [];
afterEach(async () => { await Promise.all(active.splice(0).map((h) => h.close())); });

async function connect(h: Awaited<ReturnType<typeof harness>>, user = USER_A) {
  h.fake.user = user;
  const { token } = await exchange(h, await authorization(h));
  const client = new Client({ name: "finance-fixture", version: "1" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${h.origin}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token.access_token}` } },
  }));
  return client;
}

const lineID = "11111111-2222-3333-4444-555555555551";
const entryID = "11111111-2222-3333-4444-555555555552";
const ledgerRow = { ID: lineID, EntryID: entryID, EntryNumber: 42, LineNumber: 1, Date: "/Date(1772323200000)/",
  FinancialYear: 2026, FinancialPeriod: 3, JournalCode: "70", GLAccountCode: "8000", Type: 20, Status: 50,
  AmountDC: -112.5, AmountFC: -125, Currency: "USD", Notes: "ignored", Division: 123456 };

it("reads bounded ledger pages with the signed-in person's token", async () => {
  const h = await harness(); active.push(h);
  h.fake.readOverride = (url, user) => {
    if (!url.pathname.endsWith("/financialtransaction/TransactionLines")) return;
    expect(user).toBe(USER_A);
    const final = url.searchParams.has("$skiptoken");
    return { body: { d: { results: [final ? { ...ledgerRow, ID: entryID, LineNumber: 2 } : ledgerRow],
      ...(!final ? { __next: `${url.pathname}?$skiptoken=fictional-part-two` } : {}) } } };
  };
  const client = await connect(h);
  try {
    const tools = await client.listTools();
    expect(tools.tools.find((tool) => tool.name === "transaction_lines")?.annotations?.readOnlyHint).toBe(true);
    const args = { division: 123456, year: 2026, period: 3, status: "processed" };
    const first = await client.callTool({ name: "transaction_lines", arguments: args });
    expect(first.isError).not.toBe(true);
    expect(first.structuredContent).toMatchObject({ company: { division: 123456, currency: "EUR" },
      source: { system: "Exact Online" }, coverage: { state: "partial", returned: 1, nextCursor: expect.any(String) },
      rows: [{ id: lineID, date: "2026-03-01", amountCompanyCurrency: -112.5, amountTransactionCurrency: -125,
        transactionCurrency: "USD" }] });
    const { coverage } = first.structuredContent as { coverage: { nextCursor: string } };
    const second = await client.callTool({ name: "transaction_lines", arguments: { ...args, cursor: coverage.nextCursor } });
    expect(second.structuredContent).toMatchObject({ coverage: { state: "complete", returned: 1 },
      rows: [{ id: entryID, lineNumber: 2 }] });
    const reads = h.calls.filter((call) => call.path.endsWith("/TransactionLines"));
    expect(reads.map((call) => [call.method, call.query.get("$filter")])).toEqual([
      ["GET", "FinancialYear eq 2026 and FinancialPeriod eq 3 and Status eq 50"],
      ["GET", "FinancialYear eq 2026 and FinancialPeriod eq 3 and Status eq 50"],
    ]);
    expect(JSON.stringify(first.structuredContent)).not.toContain("ignored");
  } finally { await client.close(); }
});

it("requires supplier membership and masks bank numbers, and respects a second user's Exact denial", async () => {
  const h = await harness(); active.push(h);
  const supplierId = entryID;
  const rawBankNumber = "ZZ00 TEST 0000 9876";
  let supplier = true;
  let bankAccount = supplierId;
  h.fake.readOverride = (url, user) => {
    if (url.pathname.includes("/crm/Accounts(")) return { body: { d: { ID: supplierId, IsSupplier: supplier } } };
    if (!url.pathname.endsWith("/crm/BankAccounts")) return;
    if (user === USER_B) return { status: 403, body: { error: "fictional confidential response" } };
    return { body: { d: [{ ID: lineID, Account: bankAccount, Type: "A", BankAccount: rawBankNumber,
      AccountName: "Fictional Supply", BICCode: "FRSTZZ00", Blocked: false, Main: true }] } };
  };
  const first = await connect(h);
  const second = await connect(h, USER_B);
  const request = { name: "supplier_bank_info", arguments: { division: 123456, supplierId } };
  try {
    const allowed = await first.callTool(request);
    expect(allowed.structuredContent).toMatchObject({ rows: [{ supplierId, accountLastFour: "9876", blocked: false, main: true }] });
    expect(JSON.stringify(allowed)).not.toContain(rawBankNumber);
    const providerDenied = await second.callTool(request);
    expect(providerDenied).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('"outcome":"denied"') }] });
    expect(JSON.stringify(providerDenied)).not.toContain("fictional confidential response");
    const bankCalls = h.calls.filter((call) => call.path.endsWith("/crm/BankAccounts"));
    expect(bankCalls).toHaveLength(2);
    expect(bankCalls[0].authorization).not.toEqual(bankCalls[1].authorization);
    expect(bankCalls[0].query.get("$filter")).toBe(`Account eq guid'${supplierId}' and Type eq 'A'`);
    bankAccount = lineID;
    expect(await first.callTool(request)).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('"outcome":"unavailable"') }] });
    supplier = false;
    expect(await first.callTool(request)).toMatchObject({ isError: true, content: [{ text: expect.stringContaining('"outcome":"denied"') }] });
    expect(h.calls.filter((call) => call.path.endsWith("/crm/BankAccounts"))).toHaveLength(3);
    expect(JSON.stringify(h.logs)).not.toContain(rawBankNumber);
  } finally { await first.close(); await second.close(); }
});

const invoiceLine = { ID: lineID, LineNumber: 1, AmountDC: 90, AmountFC: 100, VATAmountFC: 21 };
const cases = [
  ["supplier_search", "crm/Accounts", { name: "O'Brien" },
    "IsSupplier eq true and substringof('O''Brien',Name)",
    { ID: entryID, Name: "O'Brien Supply", Code: "100", Blocked: false }, { id: entryID, blocked: false }],
  ["assets", "assets/Assets", { status: "active" }, "Status eq 1",
    { ID: lineID, Code: "AS001", Status: 1, InvestmentAmountDC: 500, InvestmentCurrency: "" },
    { id: lineID, investmentCompanyCurrency: 500, investmentCurrency: null }],
  ["open_payables", "read/financial/PayablesList", { supplierId: entryID }, `AccountId eq guid'${entryID}'`,
    { HID: "9007199254740994", AccountId: entryID, InvoiceNumber: 43, Amount: 105, AmountInTransit: 40, CurrencyCode: "GBP", ApprovalStatus: 2 },
    { id: "9007199254740994", supplierId: entryID, invoiceEntryNumber: 43, currency: "GBP", openAmount: 105, amountInTransit: 40, approvalStatus: 2 }],
  ["payment_status", "cashflow/Payments", { batchNumber: 8, status: "processed" }, "PaymentBatchNumber eq 8 and Status eq 40",
    { ID: lineID, PaymentBatchNumber: 8, AmountDC: 90, AmountFC: 100, Currency: "USD", Status: 40, EntryDate: "2026-03-01",
      AccountBankAccountNumber: "discard-bank-value" },
    { status: 40, statusLabel: "processed", amount: 100, currency: "USD", processingDate: "2026-03-01" }],
  ["bank_entries", "financialtransaction/BankEntries", { year: 2026, period: 3, journalCode: "20" },
    "FinancialYear eq 2026 and FinancialPeriod eq 3 and JournalCode eq '20'",
    { EntryID: entryID, EntryNumber: 42, FinancialYear: 2026, FinancialPeriod: 3, JournalCode: "20", Currency: "EUR",
      OpeningBalanceFC: 34.95, ClosingBalanceFC: -10.1, Status: 50 }, { openingBalance: 34.95, closingBalance: -10.1 }],
  ["purchase_entries", "purchaseentry/PurchaseEntries", { entryNumber: 43, supplierReference: "Supplier'42", status: "processed" },
    "EntryNumber eq 43 and YourRef eq 'Supplier''42' and Status eq 50",
    { EntryID: entryID, EntryNumber: 43, InvoiceNumber: 42, Supplier: lineID, EntryDate: "2026-03-01", Currency: "EUR",
      AmountFC: -30, AmountDC: -30, Status: 50, Type: 31 }, { entryId: entryID, entryNumber: 43, invoiceNumber: 42, type: 31, amount: -30 }],
  ["invoice_lines", "salesinvoice/SalesInvoiceLines", { kind: "sales", invoiceId: entryID }, `InvoiceID eq guid'${entryID}'`,
    { ...invoiceLine, InvoiceID: entryID, ItemCode: "F001" }, { invoiceId: entryID, itemCode: "F001", vatAmount: 21, invoiceCurrency: "USD" }],
  ["invoice_lines", "purchaseentry/PurchaseEntryLines", { kind: "purchase", invoiceId: entryID }, `EntryID eq guid'${entryID}'`,
    { ...invoiceLine, EntryID: entryID, GLAccountCode: "4000" },
    { invoiceId: entryID, glAccountCode: "4000", amount: 100, amountCompanyCurrency: 90, vatAmount: 21, invoiceCurrency: "USD" }],
  ["reporting_balances", "financial/ReportingBalance", { year: 2026, period: 0 }, "ReportingYear eq 2026 and ReportingPeriod eq 0",
    { ID: 42, ReportingYear: 2026, ReportingPeriod: 0, GLAccountCode: "1000", Type: 10, Status: 50,
      Amount: 12, AmountDebit: 12, AmountCredit: 0, Count: 1 }, { period: 0, glAccountCode: "1000", amount: 12 }],
  ["journal_status", "read/financial/JournalStatusList", { year: 2026, period: 3 }, "Year eq 2026 and Period eq 3",
    { Year: 2026, Period: 3, Journal: "10", JournalType: 10, Status: 0, StatusDescription: "Open" }, { status: 0, statusLabel: "Open" }],
  ["gl_accounts", "financial/GLAccounts", { type: "bank" }, "Type eq 12",
    { ID: lineID, Code: "1000", Type: 12, IsBlocked: false }, { code: "1000", type: 12 }],
] as const;

it("reads the documented finance resources and preserves their financial meanings", async () => {
  const h = await harness(); active.push(h);
  const client = await connect(h);
  try {
    for (const [name, resource, args, expectedFilter, record, expected] of cases) {
      const path = `/api/v1/123456/${resource}`;
      h.fake.readOverride = (url) => {
        if (url.pathname === path) return { body: { d: { results: [record] } } };
        if (name !== "invoice_lines") return;
        const [header, key] = args.kind === "sales" ? ["salesinvoice/SalesInvoices", "InvoiceID"] : ["purchaseentry/PurchaseEntries", "EntryID"];
        if (url.pathname === `/api/v1/123456/${header}(guid'${entryID}')`) return { body: { d: { [key]: entryID, Currency: "USD" } } };
      };
      const response = await client.callTool({ name, arguments: { division: 123456, ...args } });
      expect(response.isError, resource).not.toBe(true);
      expect(response.structuredContent, resource).toMatchObject({ rows: [expected], coverage: { state: "complete" } });
      if (name === "invoice_lines") expect(response.structuredContent).toMatchObject({ company: { currency: "EUR" } });
      expect(JSON.stringify(response)).not.toContain("discard-bank-value");
      const upstream = h.calls.at(-1);
      expect(upstream?.path).toBe(path);
      expect(upstream?.method).toBe("GET");
      expect(upstream?.query.get("$filter")).toBe(expectedFilter);
      expect(upstream?.query.get("$select")).not.toMatch(/AccountBankAccountNumber|^\*$/);
    }
  } finally { await client.close(); }
});
