import { z } from "zod";
import { companySchema, customerSchema, invoiceSchema, itemSchema, receivableSchema, type Operation } from "../domain/contracts.js";
import { ServiceError } from "../domain/identity.js";

function sourceDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("Invalid date");
  const match = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
  if (match) {
    const date = new Date(Number(match[1]));
    if (!Number.isFinite(date.getTime())) throw new Error("Invalid date");
    return date.toISOString().slice(0, 10);
  }
  if (z.iso.date().safeParse(value).success) return value;
  if (z.iso.datetime({ local: true }).safeParse(value).success) return value.slice(0, 10);
  throw new Error("Invalid date");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid record");
  return value as Record<string, unknown>;
}

export function company(value: unknown) {
  try {
    const r = record(value);
    return companySchema.parse({ division: r.Code, name: r.Description, currency: r.Currency });
  } catch { throw new ServiceError("unavailable", "Exact returned invalid company data."); }
}

export function normalize(operation: Operation, value: unknown) {
  try {
    const r = record(value);
    switch (operation) {
      case "company_discovery": return company(r);
      case "customer_search": return customerSchema.parse({ id: r.ID, code: r.Code, name: r.Name });
      case "invoice_lookup": return invoiceSchema.parse({ id: r.InvoiceID, invoiceNumber: r.InvoiceNumber,
        customer: r.InvoiceToName, invoiceDate: sourceDate(r.InvoiceDate), dueDate: sourceDate(r.DueDate),
        currency: r.Currency, amount: r.AmountFC, status: r.Status });
      case "item_search": return itemSchema.parse({ id: r.ID, code: r.Code, description: r.Description,
        standardSalesPrice: r.StandardSalesPrice ?? null });
      case "receivables": {
        const hid = z.union([z.number().int().safe().nonnegative(), z.string().regex(/^\d+$/)]).parse(r.HID);
        return receivableSchema.parse({ id: String(hid), customerId: r.AccountId, customerCode: r.AccountCode,
          customer: r.AccountName, invoiceNumber: r.InvoiceNumber, invoiceDate: sourceDate(r.InvoiceDate),
          dueDate: sourceDate(r.DueDate), currency: r.CurrencyCode, openAmount: r.Amount });
      }
    }
  } catch { throw new ServiceError("unavailable", "Exact returned invalid source fields. No complete financial result was established."); }
}
