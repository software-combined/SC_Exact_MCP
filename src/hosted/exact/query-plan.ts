import { invoiceStatuses, type Query } from "../domain/contracts.js";
import { assetStatuses, paymentStatuses } from "../domain/finance-contracts.js";
import type { Region } from "../domain/identity.js";

export interface ReadPlan {
  resource: string;
  select: string;
  filter?: string;
  orderBy?: string;
  key?: string;
  /** Only for lookups that never page: Exact's $top switches off __next paging. */
  top?: number;
}
export type MatchKind = "customer" | "item";
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const contains = (value: string, field: string) => `substringof(${literal(value)},${field})`;
const guidFilter = (field: string, id: string) => `${field} eq guid'${id.toLowerCase()}'`;
const all = (filters: (string | false | undefined)[]) => {
  const filter = filters.filter(Boolean).join(" and ");
  return filter ? { filter } : {};
};
const dateWindow = (field: string, input: { fromDate?: string; toDate?: string }) => [
  input.fromDate && `${field} ge datetime'${input.fromDate}T00:00:00'`,
  input.toDate && `${field} le datetime'${input.toDate}T23:59:59.999'`,
];
const dueWindow = (input: { dueFrom?: string; dueThrough?: string }) =>
  dateWindow("DueDate", { fromDate: input.dueFrom, toDate: input.dueThrough });
const ledgerStatuses = { open: 20, processed: 50 } as const;
const purchaseStatuses = { rejected: 5, ...ledgerStatuses } as const;
const accountTypes = { bank: 12, cash: 10, receivable: 20, payable: 22 } as const;
/** A name must be resolved to customerId first; listing without the filter would show other customers' records. */
function customerId(input: { customer?: string; customerId?: string }) {
  if (input.customer && !input.customerId) throw new Error("Resolve the customer name before planning the read.");
  return input.customerId;
}
// Assumption, not verified live: Exact due dates are company dates.
// The European regions count days in their own time zone.
// "com" has no single zone, so it counts UTC days.
const zones: Record<Region, string> = { nl: "Europe/Amsterdam", be: "Europe/Brussels", de: "Europe/Berlin",
  fr: "Europe/Paris", es: "Europe/Madrid", uk: "Europe/London", com: "UTC" };
function daysAgo(days: number, region: Region): string {
  // en-CA formats the date as YYYY-MM-DD, the form that Date.parse reads below.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: zones[region] }).format(new Date());
  return new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

export function plan(query: Query, region: Region): ReadPlan {
  switch (query.operation) {
    case "company_discovery": return { resource: "system/Divisions", select: "Code,Description,Currency", orderBy: "Code" };
    case "customer_search": {
      const { name, code, city, email, vatNumber } = query.input;
      return { resource: "crm/Accounts", select: "ID,Code,Name", orderBy: "Code,ID", ...all(["IsSales eq true",
        name && contains(name, "Name"), code && contains(code, "Code"), city && contains(city, "City"),
        email && contains(email, "Email"), vatNumber && contains(vatNumber, "VATNumber")]) };
    }
    case "invoice_lookup": {
      const input = query.input;
      const read = { resource: "salesinvoice/SalesInvoices",
        select: "InvoiceID,InvoiceNumber,InvoiceToName,InvoiceDate,DueDate,Currency,AmountFC,Status" } as const;
      if (input.invoiceId) return { ...read, key: input.invoiceId.toLowerCase() };
      if (input.invoiceNumber) return { ...read, filter: `InvoiceNumber eq ${input.invoiceNumber}`, orderBy: "InvoiceID" };
      const id = customerId(input);
      return { ...read, orderBy: "InvoiceDate desc,InvoiceID", ...all([id && guidFilter("InvoiceTo", id),
        input.fromDate && `InvoiceDate ge datetime'${input.fromDate}T00:00:00'`,
        input.toDate && `InvoiceDate le datetime'${input.toDate}T23:59:59'`,
        input.status && `Status eq ${invoiceStatuses[input.status]}`]) };
    }
    case "item_search": return { resource: "logistics/Items", select: "ID,Code,Description,StandardSalesPrice",
      orderBy: "Code,ID", ...all(["IsSalesItem eq true", query.input.code && `Code eq ${literal(query.input.code)}`,
        query.input.description && contains(query.input.description, "Description")]) };
    case "receivables": {
      const input = query.input; const id = customerId(input);
      // overdueDays N means at least N days past due: due before today minus N-1 days, in the region's time zone.
      const before = input.overdueBefore ?? (input.overdueDays ? daysAgo(input.overdueDays - 1, region) : undefined);
      return { resource: "read/financial/ReceivablesList",
        select: "HID,AccountId,AccountCode,AccountName,InvoiceNumber,InvoiceDate,DueDate,Amount,CurrencyCode",
        orderBy: "DueDate,HID", ...all([before && `DueDate lt datetime'${before}T00:00:00'`, id && guidFilter("AccountId", id)]) };
    }
    case "transaction_lines": {
      const input = query.input;
      return { resource: "financialtransaction/TransactionLines",
        select: "ID,EntryID,EntryNumber,LineNumber,Date,FinancialYear,FinancialPeriod,JournalCode,GLAccountCode,GLAccountDescription," +
          "Description,Account,AccountName,InvoiceNumber,Type,Status,AmountDC,AmountFC,Currency,CostCenter,CostUnit",
        ...all([...dateWindow("Date", input), input.year !== undefined && `FinancialYear eq ${input.year}`,
          input.period !== undefined && `FinancialPeriod eq ${input.period}`, input.entryId && guidFilter("EntryID", input.entryId),
          input.invoiceNumber !== undefined && `InvoiceNumber eq ${input.invoiceNumber}`,
          input.journalCode && `JournalCode eq ${literal(input.journalCode)}`,
          input.glAccountCode && `GLAccountCode eq ${literal(input.glAccountCode)}`,
          input.accountId && guidFilter("Account", input.accountId),
          input.status && `Status eq ${ledgerStatuses[input.status]}`]) };
    }
    case "supplier_search": {
      const { name, code } = query.input;
      return { resource: "crm/Accounts", select: "ID,Code,Name,Blocked,PaymentConditionPurchaseDescription",
        orderBy: "Code,ID", ...all(["IsSupplier eq true", name && contains(name, "Name"), code && contains(code, "Code")]) };
    }
    case "supplier_bank_info": return { resource: "crm/BankAccounts",
      select: "ID,Account,AccountName,BankAccount,BankAccountHolderName,BICCode,Main,Blocked,Type",
      filter: `${guidFilter("Account", query.input.supplierId)} and Type eq 'A'` };
    case "assets": {
      const { code, groupCode, status } = query.input;
      return { resource: "assets/Assets",
        select: "ID,Code,Description,AssetGroupCode,PrimaryMethodDescription,InvestmentDate,StartDate,EndDate," +
          "Status,InvestmentAmountDC,InvestmentAmountFC,InvestmentCurrency,ResidualValue",
        ...all([code && `Code eq ${literal(code)}`, groupCode && `AssetGroupCode eq ${literal(groupCode)}`,
          status && `Status eq ${assetStatuses[status]}`]) };
    }
    case "open_payables": {
      const input = query.input;
      return { resource: "read/financial/PayablesList",
        select: "HID,AccountId,AccountCode,AccountName,InvoiceNumber,YourRef,InvoiceDate,DueDate,CurrencyCode,Amount,AmountInTransit,ApprovalStatus",
        ...all([input.supplierId && guidFilter("AccountId", input.supplierId), ...dueWindow(input)]) };
    }
    case "payment_status": {
      const input = query.input;
      return { resource: "cashflow/Payments",
        select: "ID,Account,AccountCode,AccountName,InvoiceNumber,TransactionID,AmountDC,AmountFC,Currency,DueDate," +
          "PaymentDateProposal,EntryDate,PaymentBatchNumber,Status,PaymentMethod,PaymentReference,AccountBankAccountID",
        ...all([input.supplierId && guidFilter("Account", input.supplierId), ...dueWindow(input),
          input.invoiceNumber !== undefined && `InvoiceNumber eq ${input.invoiceNumber}`,
          input.batchNumber !== undefined && `PaymentBatchNumber eq ${input.batchNumber}`,
          input.status && `Status eq ${paymentStatuses[input.status]}`]) };
    }
    case "bank_entries": {
      const { year, period, journalCode, status } = query.input;
      return { resource: "financialtransaction/BankEntries",
        select: "EntryID,EntryNumber,FinancialYear,FinancialPeriod,JournalCode,JournalDescription,Currency,OpeningBalanceFC,ClosingBalanceFC,Status",
        ...all([`FinancialYear eq ${year}`, `FinancialPeriod eq ${period}`,
          journalCode && `JournalCode eq ${literal(journalCode)}`, status && `Status eq ${ledgerStatuses[status]}`]) };
    }
    case "purchase_entries": {
      const input = query.input;
      return { resource: "purchaseentry/PurchaseEntries",
        select: "EntryID,EntryNumber,InvoiceNumber,Description,Supplier,SupplierName,YourRef,Journal,EntryDate,DueDate," +
          "Currency,AmountFC,AmountDC,VATAmountFC,Status,Type",
        ...all([input.supplierId && guidFilter("Supplier", input.supplierId), ...dateWindow("EntryDate", input),
          input.invoiceNumber !== undefined && `InvoiceNumber eq ${input.invoiceNumber}`,
          input.entryNumber !== undefined && `EntryNumber eq ${input.entryNumber}`,
          input.supplierReference && `YourRef eq ${literal(input.supplierReference)}`,
          input.status && `Status eq ${purchaseStatuses[input.status]}`]) };
    }
    case "invoice_lines": {
      const { kind, invoiceId } = query.input;
      const fields = "ID,LineNumber,Description,Quantity,AmountFC,AmountDC,VATAmountFC";
      return kind === "sales"
        ? { resource: "salesinvoice/SalesInvoiceLines", select: `${fields},InvoiceID,ItemCode`, filter: guidFilter("InvoiceID", invoiceId) }
        : { resource: "purchaseentry/PurchaseEntryLines", select: `${fields},EntryID,GLAccountCode`, filter: guidFilter("EntryID", invoiceId) };
    }
    case "reporting_balances": {
      const { year, period, glAccountCode, status } = query.input;
      return { resource: "financial/ReportingBalance",
        select: "ID,ReportingYear,ReportingPeriod,GLAccountCode,GLAccountDescription,BalanceType," +
          "CostCenterCode,CostUnitCode,Type,Status,Amount,AmountDebit,AmountCredit,Count",
        ...all([`ReportingYear eq ${year}`, period !== undefined && `ReportingPeriod eq ${period}`,
          glAccountCode && `GLAccountCode eq ${literal(glAccountCode)}`, status && `Status eq ${ledgerStatuses[status]}`]) };
    }
    case "journal_status": {
      const { year, period, journalCode } = query.input;
      return { resource: "read/financial/JournalStatusList", select: "Year,Period,Journal,JournalDescription,JournalType,Status,StatusDescription",
        ...all([`Year eq ${year}`, `Period eq ${period}`, journalCode && `Journal eq ${literal(journalCode)}`]) };
    }
    case "gl_accounts": {
      const { code, description, type } = query.input;
      return { resource: "financial/GLAccounts", select: "ID,Code,Description,Type,TypeDescription,BalanceType,IsBlocked",
        ...all([code && contains(code, "Code"), description && contains(description, "Description"),
          type && `Type eq ${accountTypes[type]}`]) };
    }
  }
}

/** Looks up a customer or sales item by the text a person gave, for name resolution. */
export function matchPlan(kind: MatchKind, text: string): ReadPlan {
  return kind === "customer" ?
    { resource: "crm/Accounts", select: "ID,Code,Name", orderBy: "Code,ID", top: 11,
      filter: `IsSales eq true and (${contains(text, "Code")} or ${contains(text, "Name")})` } :
    { resource: "logistics/Items", select: "ID,Code,Description", orderBy: "Code,ID", top: 11,
      filter: `IsSalesItem eq true and (Code eq ${literal(text)} or ${contains(text, "Description")})` };
}
