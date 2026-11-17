import { z } from "zod";
import { companySchema, customerName, division, guid } from "./contracts.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const customerFields = { name: text(100), email: z.email().max(100), phone: text(30), vatNumber: text(30),
  addressLine1: text(100), postcode: text(20), city: text(50), country: z.string().regex(/^[A-Z]{2}$/) };
const optionalFields = z.strictObject(customerFields).partial().shape;
const line = z.strictObject({ itemId: guid.optional(), item: text(60).optional(), quantity: z.number().positive().max(1_000_000_000),
  unitPrice: z.number().finite().optional(), description: text(100).optional() })
  .refine((v) => (v.itemId === undefined) !== (v.item === undefined), "Give exactly one of itemId or item (the item code or description).");
const customer = { customerId: guid.optional(), customer: customerName.optional() };
const oneCustomer = (v: { customerId?: string; customer?: string }) => (v.customerId === undefined) !== (v.customer === undefined);
const customerRule = "Give exactly one of customerId or customer (the customer's name).";

// ponytail: each named item costs one lookup read before the 7-second send cut-off; raise when lookups get faster.
export const maxNamedItems = 5;
export const changeInputs = {
  create_customer: z.strictObject({ division, ...optionalFields, name: customerFields.name, code: text(18).optional() }),
  update_customer: z.strictObject({ division, ...customer, ...optionalFields }).refine(oneCustomer, customerRule)
    .refine((v) => Object.keys(v).some((key) => key in customerFields), "Give at least one field to change, for example phone."),
  create_draft_sales_invoice: z.strictObject({ division, ...customer, journalCode: text(20).optional(),
    invoiceDate: z.iso.date().optional(), description: text(100).optional(), yourRef: text(50).optional(),
    lines: z.array(line).min(1).max(50) }).refine(oneCustomer, customerRule)
    .refine((v) => new Set(v.lines.flatMap((l) => l.item ? [l.item.toLowerCase()] : [])).size <= maxNamedItems,
      `Give at most ${maxNamedItems} different item names; use itemId for the other lines.`),
} as const;
export type ChangeOperation = keyof typeof changeInputs;
export type Change = { [K in ChangeOperation]: { operation: K; input: z.infer<typeof changeInputs[K]> } }[ChangeOperation];

export const changeOutput = z.strictObject({ company: companySchema,
  result: z.strictObject({ action: z.enum(["created", "updated"]), record: z.enum(["customer", "sales invoice"]),
    id: guid, code: z.string().max(40).optional(), invoiceNumber: z.number().int().optional() }),
  source: z.strictObject({ system: z.literal("Exact Online"), region: z.string(), changedAt: z.iso.datetime() }) });
export type ChangeResult = z.infer<typeof changeOutput>;

export const changeDescriptions: Record<ChangeOperation, string> = {
  create_customer: "Create a customer in one company with the supplied fields.",
  update_customer: "Change details of one existing customer. Name the customer by customerId or by name (customer). " +
    "If several customers match the name, the tool lists them and changes nothing. Only the supplied fields change.",
  create_draft_sales_invoice: "Create a sales invoice that is not processed, booked or sent; a person processes it in Exact. " +
    "Name the customer by customerId or by name (customer). For each line, give itemId or item (the item code or description). " +
    "If a name matches several records, the tool lists them and changes nothing. " +
    "If the company has several sales journals, the tool asks for journalCode.",
};

/** Standard MCP hints; each AI app's tool-permission settings decide whether it asks first. */
export const changeHints: Record<ChangeOperation, { destructiveHint: boolean; idempotentHint: boolean }> = {
  create_customer: { destructiveHint: false, idempotentHint: false },
  update_customer: { destructiveHint: true, idempotentHint: true },
  create_draft_sales_invoice: { destructiveHint: false, idempotentHint: false },
};
