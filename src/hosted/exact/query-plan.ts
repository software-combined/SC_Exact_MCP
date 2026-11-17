import { invoiceStatuses, type Query } from "../domain/contracts.js";
import type { Region } from "../domain/identity.js";

export interface ReadPlan {
  resource: "system/Divisions" | "crm/Accounts" | "salesinvoice/SalesInvoices" | "read/financial/ReceivablesList" |
    "logistics/Items" | "financial/Journals";
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
