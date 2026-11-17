import { z } from "zod";
import type { Change } from "../domain/changes.js";
import { ServiceError } from "../domain/identity.js";

export interface ChangeRequest {
  method: "POST" | "PUT";
  resource: "crm/Accounts" | "salesinvoice/SalesInvoices";
  key?: string;
  body: Record<string, unknown>;
}

interface AccountInput { name?: string; email?: string; phone?: string; vatNumber?: string; addressLine1?: string;
  postcode?: string; city?: string; country?: string }
const accountFields = (input: AccountInput) => Object.fromEntries(Object.entries({
  Name: input.name, Email: input.email, Phone: input.phone, VATNumber: input.vatNumber,
  AddressLine1: input.addressLine1, Postcode: input.postcode, City: input.city, Country: input.country,
}).filter(([, value]) => value !== undefined));

/** Maps a validated change to one fixed Exact request. Clients never choose the resource, method or field names. */
export function changeRequest(change: Change, journal?: string): ChangeRequest {
  switch (change.operation) {
    case "create_customer": return { method: "POST", resource: "crm/Accounts",
      body: { ...accountFields(change.input), Status: "C", ...(change.input.code ? { Code: change.input.code } : {}) } };
    case "update_customer": return { method: "PUT", resource: "crm/Accounts", key: change.input.customerId.toLowerCase(),
      body: accountFields(change.input) };
    case "create_draft_sales_invoice": {
      const input = change.input;
      if (!journal) throw new Error("A sales journal is required.");
      return { method: "POST", resource: "salesinvoice/SalesInvoices", body: { Journal: journal,
        OrderedBy: input.customerId.toLowerCase(),
        ...(input.invoiceDate ? { InvoiceDate: input.invoiceDate } : {}),
        ...(input.description ? { Description: input.description } : {}),
        ...(input.yourRef ? { YourRef: input.yourRef } : {}),
        SalesInvoiceLines: input.lines.map((line) => ({ Item: line.itemId.toLowerCase(), Quantity: line.quantity,
          ...(line.unitPrice === undefined ? {} : { UnitPrice: line.unitPrice }),
          ...(line.description ? { Description: line.description } : {}) })) } };
    }
  }
}

const journalRow = z.object({ Code: z.string().min(1).max(20), Description: z.string().max(200).nullable().optional(),
  IsBlocked: z.boolean().optional() });

/** Picks the only open sales journal, or asks the person to choose. */
export function salesJournal(rows: unknown[]): string {
  const parsed = rows.map((row) => journalRow.safeParse(row));
  if (parsed.some((row) => !row.success)) {
    throw new ServiceError("invalid_input", "Exact returned a journal this service cannot read. Supply the journal as journalCode.", 400);
  }
  const open = parsed.flatMap((row) => row.success && !row.data.IsBlocked ? [row.data] : []);
  if (open.length === 1) return open[0].Code.trim();
  if (open.length === 0) throw new ServiceError("invalid_input", "This company has no open sales journal. Set one up in Exact first.", 400);
  const choices = open.slice(0, 20).map((row) => `${row.Code.trim()} (${(row.Description ?? "no name").replace(/[\x00-\x1F\x7F]/g, " ")})`).join(", ");
  throw new ServiceError("invalid_input", `Choose a sales journal and supply it as journalCode: ${choices}.`, 400);
}

const created = z.object({ ID: z.guid().optional(), InvoiceID: z.guid().optional(), Code: z.string().max(40).nullable().optional(),
  InvoiceNumber: z.number().int().nullable().optional() });

/** Reads the identifiers from Exact's answer to a create. */
export function createdRecord(value: unknown) {
  const d = value && typeof value === "object" && "d" in value ? value.d : undefined;
  const parsed = created.safeParse(d);
  const id = parsed.success ? parsed.data.InvoiceID ?? parsed.data.ID : undefined;
  if (!parsed.success || !id) {
    throw new ServiceError("unavailable", "Exact accepted the change but returned no record ID. Check Exact before trying again.");
  }
  return { id: id.toLowerCase(), code: parsed.data.Code?.trim() || undefined, invoiceNumber: parsed.data.InvoiceNumber ?? undefined };
}
