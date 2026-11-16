import { z } from "zod";

const division = z.number().int().positive().max(2_147_483_647);
const cursor = z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional();
const guid = z.guid();
const date = z.iso.date();
const amount = z.number().finite();
const currency = z.string().regex(/^[A-Z]{3}$/);
const label = z.string().max(200);

export const inputs = {
  company_discovery: z.strictObject({ cursor }),
  customer_search: z.strictObject({ division, name: z.string().min(2).max(80).optional(),
    code: z.string().min(1).max(40).optional(), cursor }).refine((v) => Boolean(v.name) !== Boolean(v.code),
    "Supply exactly one of name or code."),
  invoice_lookup: z.strictObject({ division, invoiceId: guid.optional(),
    invoiceNumber: z.number().int().positive().max(2_147_483_647).optional(), cursor })
    .refine((v) => Boolean(v.invoiceId) !== Boolean(v.invoiceNumber), "Supply exactly one invoice identifier.")
    .refine((v) => !v.invoiceId || !v.cursor, "A keyed invoice read cannot use a cursor."),
  receivables: z.strictObject({ division, overdueBefore: date.optional(), customerId: guid.optional(), cursor }),
} as const;
export type Operation = keyof typeof inputs;
export type Query = { [K in Operation]: { operation: K; input: z.infer<typeof inputs[K]> } }[Operation];

export const companySchema = z.strictObject({ division, name: label, currency });
export const customerSchema = z.strictObject({ id: guid, code: z.string().max(40), name: label });
export const invoiceSchema = z.strictObject({ id: guid, invoiceNumber: z.number().int(), customer: label,
  invoiceDate: date, dueDate: date.nullable(), currency, amount: amount, status: z.number().int() });
export const receivableSchema = z.strictObject({ id: z.string().regex(/^\d+$/), customerId: guid, customerCode: z.string().max(40),
  customer: label, invoiceNumber: z.number().int(), invoiceDate: date, dueDate: date.nullable(),
  currency, openAmount: amount });

const coverage = z.strictObject({ state: z.enum(["complete", "partial"]),
  scope: z.literal("one live query; pages are not a snapshot or financial total"),
  returned: z.number().int().min(0).max(100), nextCursor: cursor });
const provenance = z.strictObject({ system: z.literal("Exact Online"), region: z.string(),
  readAt: z.iso.datetime(), projectionVersion: z.literal(1), contentTrust: z.literal("untrusted source data") });
function page<T extends z.ZodType>(item: T) {
  return z.strictObject({ company: companySchema.nullable(), source: provenance, coverage,
    rows: z.array(item).max(100) });
}
export const outputs = { company_discovery: page(companySchema), customer_search: page(customerSchema),
  invoice_lookup: page(invoiceSchema), receivables: page(receivableSchema) } as const;
export type Page = z.infer<(typeof outputs)[Operation]>;

export const descriptions: Record<Operation, string> = {
  company_discovery: "List companies this personal Exact login can currently open. Call first to choose a division. Bounded live page; use only its opaque cursor to continue.",
  customer_search: "Find customers in one selected company by name text or exact customer code. Returns a bounded live page, never all customers implicitly.",
  invoice_lookup: "Look up sales invoices in one company by invoice ID or invoice number. Empty means absent only for the completed query. Amount includes VAT in invoice currency.",
  receivables: "Read outstanding receivables in one company, optionally by customer or due before a date. Amounts retain row currency; no total is calculated. Current outstanding balances, not historical as-of balances.",
};
