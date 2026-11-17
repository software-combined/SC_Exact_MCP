import type { Query } from "../domain/contracts.js";

export interface ReadPlan {
  resource: "system/Divisions" | "crm/Accounts" | "salesinvoice/SalesInvoices" | "read/financial/ReceivablesList" |
    "logistics/Items" | "financial/Journals";
  select: string;
  filter?: string;
  orderBy?: string;
  key?: string;
}
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

export function plan(query: Query): ReadPlan {
  switch (query.operation) {
    case "company_discovery": return { resource: "system/Divisions", select: "Code,Description,Currency", orderBy: "Code" };
    case "customer_search": return { resource: "crm/Accounts", select: "ID,Code,Name", orderBy: "Code,ID",
      filter: `IsSales eq true and ${query.input.code ? `Code eq ${literal(query.input.code)}` :
        `substringof(${literal(query.input.name!)},Name)`}` };
    case "invoice_lookup": return { resource: "salesinvoice/SalesInvoices",
      select: "InvoiceID,InvoiceNumber,InvoiceToName,InvoiceDate,DueDate,Currency,AmountFC,Status",
      ...(query.input.invoiceId ? { key: query.input.invoiceId.toLowerCase() } : {
        filter: `InvoiceNumber eq ${query.input.invoiceNumber}`, orderBy: "InvoiceID" }) };
    case "item_search": return { resource: "logistics/Items", select: "ID,Code,Description,StandardSalesPrice",
      orderBy: "Code,ID", filter: `IsSalesItem eq true and ${query.input.code ? `Code eq ${literal(query.input.code)}` :
        `substringof(${literal(query.input.description!)},Description)`}` };
    case "receivables": {
      const filters = [];
      if (query.input.overdueBefore) filters.push(`DueDate lt datetime'${query.input.overdueBefore}T00:00:00'`);
      if (query.input.customerId) filters.push(`AccountId eq guid'${query.input.customerId.toLowerCase()}'`);
      return { resource: "read/financial/ReceivablesList",
        select: "HID,AccountId,AccountCode,AccountName,InvoiceNumber,InvoiceDate,DueDate,Amount,CurrencyCode",
        orderBy: "DueDate,HID", ...(filters.length ? { filter: filters.join(" and ") } : {}) };
    }
  }
}
