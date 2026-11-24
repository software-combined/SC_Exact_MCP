import { z } from "zod";
import { date, division, guid } from "../read-fields.js";
import { catalogueField, catalogResources } from "./contracts.js";
import { bankingChanges } from "./banking-changes.js";
import { documentsChanges } from "./documents-changes.js";
import { financialChanges } from "./financial-changes.js";
import { itemsChanges } from "./items-changes.js";
import { purchaseChanges } from "./purchase-changes.js";
import { relationsChanges } from "./relations-changes.js";
import { salesChanges } from "./sales-changes.js";
import { vatChanges } from "./vat-changes.js";
import { deleteTargets } from "./delete-targets.js";
import type { CatalogMutation, MutationFields } from "./shape.js";

const definitions = { ...relationsChanges, ...salesChanges, ...purchaseChanges, ...financialChanges,
  ...bankingChanges, ...itemsChanges, ...vatChanges, ...documentsChanges };
const binary = z.base64().min(4).max(32_768);
const writeGuid = guid.transform((value) => value.toLowerCase());
const fieldTypes = { ...catalogueField, guid: writeGuid, text: z.string().max(2000), date: z.union([date, z.iso.datetime()]), binary };

function fieldShape(definition: MutationFields) {
  return Object.fromEntries(Object.entries(definition.fields).map(([name, kind]) => {
    const value = fieldTypes[kind];
    return [name, definition.required.includes(name) ? value : value.optional()];
  }));
}

function inputSchema(definition: CatalogMutation) {
  const nested = Object.fromEntries(Object.entries(definition.children ?? {}).map(([name, child]) => {
    const lines = z.array(z.strictObject(fieldShape(child))).min(1).max(25);
    return [name, definition.required.includes(name) ? lines : lines.optional()];
  }));
  const fields = z.strictObject({ ...fieldShape(definition), ...nested })
    .refine((value) => Object.values(value).some((part) => part !== undefined), "Give at least one field.");
  return z.strictObject({ division, fields, ...(definition.method === "PUT" ? { id: writeGuid } : {}) });
}

type MutationTool = { input: z.ZodType; description: string };
const registered: Record<string, MutationTool> = Object.fromEntries(Object.entries(definitions).map(([name, definition]) => [name, {
  input: inputSchema(definition),
  description: `${definition.method === "POST" ? "Create" : "Update"} ${catalogResources[definition.entity as keyof typeof catalogResources].label}.`,
}]));

const special = {
  exact_record_delete: { input: z.strictObject({ division, entity: z.enum(deleteTargets), id: writeGuid }),
    description: "Permanently delete one identified record. Copilot shows the exact request for confirmation." },
  exact_sales_invoice_print: { input: z.strictObject({ division, invoice_id: writeGuid,
    document_layout: writeGuid.optional(), email_to_customer: z.boolean().optional() }),
  description: "Book and print a sales invoice and optionally email it. Copilot shows the exact request for confirmation." },
  exact_quotation_accept: { input: z.strictObject({ division, quotation_id: writeGuid }),
    description: "Accept one identified quotation on the customer's behalf." },
  exact_quotation_reject: { input: z.strictObject({ division, quotation_id: writeGuid, reason_code: writeGuid.optional() }),
    description: "Reject one identified quotation, with an optional reason code." },
  exact_document_attachment_add: { input: z.strictObject({ division, document_id: writeGuid,
    file_name: z.string().min(1).max(150), content_base64: binary }),
  description: "Attach a small file to one identified Exact document." },
} as const;
export type CatalogMutationName = keyof typeof definitions | keyof typeof special;
export const catalogueMutations: Readonly<Record<string, MutationTool>> = { ...registered, ...special };

export interface CatalogWriteRequest {
  method: "POST" | "PUT" | "DELETE";
  resource: string;
  key?: string;
  body?: Record<string, unknown>;
  readbackFields?: MutationFields["fields"];
  target?: { resource: string; key: string; keyField: string; select: string };
  resultKey?: string;
}

type MutationArgs = { division: number } & Record<string, unknown>;

function target(entity: keyof typeof catalogResources, id: unknown, extraFields: string[] = []) {
  const definition = catalogResources[entity];
  if (!definition.key) throw new Error("A mutable entity requires an addressable key.");
  return { resource: definition.resource, key: guid.parse(id).toLowerCase(), keyField: definition.key,
    select: [...new Set([...Object.keys(definition.fields), ...extraFields])].join(",") };
}

export function catalogWriteRequest(name: CatalogMutationName, value: unknown) {
  const { division, ...args } = catalogueMutations[name].input.parse(value) as MutationArgs;
  let request: CatalogWriteRequest;
  switch (name) {
    case "exact_record_delete": {
      const selected = target(args.entity as keyof typeof catalogResources, args.id);
      request = { method: "DELETE", resource: selected.resource, key: selected.key, target: selected };
      break;
    }
    case "exact_sales_invoice_print":
      request = { method: "POST", resource: "salesinvoice/PrintedSalesInvoices", target: target("sales_invoices", args.invoice_id),
        body: { InvoiceID: args.invoice_id, SendEmailToCustomer: args.email_to_customer ?? false,
          ...(args.document_layout ? { DocumentLayout: args.document_layout } : {}) } };
      break;
    case "exact_quotation_accept":
    case "exact_quotation_reject": {
      const accepted = name === "exact_quotation_accept";
      request = { method: "POST", resource: accepted ? "crm/AcceptQuotation" : "crm/RejectQuotation",
        target: target("quotations", args.quotation_id),
        body: { QuotationID: args.quotation_id, ...(!accepted && args.reason_code ? { ReasonCode: args.reason_code } : {}) } };
      break;
    }
    case "exact_document_attachment_add":
      request = { method: "POST", resource: "documents/DocumentAttachments", target: target("documents", args.document_id),
        body: { Document: args.document_id, FileName: args.file_name, Attachment: args.content_base64 }, resultKey: "ID" };
      break;
    default: {
      const { method, entity, fields } = definitions[name];
      const resourceName = entity as keyof typeof catalogResources;
      const body = args.fields as Record<string, unknown>;
      const fieldTypes = fields as MutationFields["fields"];
      const readbackFields = Object.fromEntries(Object.keys(body)
        .filter((field) => Object.hasOwn(fieldTypes, field) && fieldTypes[field] !== "binary")
        .map((field) => [field, fieldTypes[field]]));
      const selected = method === "PUT" ? target(resourceName, args.id, Object.keys(readbackFields)) : undefined;
      const { resource, key } = catalogResources[resourceName];
      request = { method, resource, body, ...(selected ? { key: selected.key, target: selected, readbackFields } :
          { resultKey: key ?? undefined }) };
    }
  }
  return { division, request };
}
