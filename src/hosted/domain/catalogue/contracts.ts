import { z } from "zod";
import { amount, cursor, date, division, guid, page } from "../read-fields.js";
import { system } from "./system.js";
import { relations } from "./relations.js";
import { sales } from "./sales.js";
import { purchase } from "./purchase.js";
import { financial } from "./financial.js";
import { reports } from "./reports.js";
import { banking } from "./banking.js";
import { items } from "./items.js";
import { vat } from "./vat.js";
import { documents } from "./documents.js";
import type { CatalogField, CatalogResource } from "./shape.js";

export const catalogResources = { ...system, ...relations, ...sales, ...purchase,
  ...financial, ...reports, ...banking, ...items, ...vat, ...documents };

export const catalogGroups: Readonly<Record<string, readonly string[]>> = {
  system: [...Object.keys(system), "me", "rate_limit_status"],
  relations: Object.keys(relations), sales: Object.keys(sales), purchase: Object.keys(purchase),
  financial: Object.keys(financial), reports: [...Object.keys(reports), "overdue_receivables"],
  banking: Object.keys(banking), items: Object.keys(items), vat: Object.keys(vat), documents: Object.keys(documents),
};

const minorInteger = z.number().int().min(-2_147_483_648).max(2_147_483_647);
const sourceDate = z.string().max(40).regex(/^\/Date\(-?\d+(?:[+-]\d{4})?\)\/$|^\d{4}-\d\d-\d\d(?:T[\d:.+Z-]+)?$/);
export const catalogueField = {
  guid, text: z.string().max(500), date: sourceDate, long: z.union([z.string().regex(/^-?\d{1,20}$/), z.int()]),
  int: minorInteger, number: amount, boolean: z.boolean(), masked: z.string().regex(/^[A-Z0-9]{4}$/),
} satisfies Record<CatalogField, z.ZodType>;
const fieldFilter = { ...catalogueField, text: z.string().min(1).max(100), date };

const aliases = {
  exact_overdue_receivables: reports.receivables,
} as const;

export type CatalogReadOperation = `exact_${keyof typeof catalogResources}_list` | keyof typeof aliases;

function readDefinition(definition: CatalogResource, operation: string) {
  const keyType = definition.key && definition.fields[definition.key];
  const row = z.strictObject(Object.fromEntries(Object.entries(definition.fields)
    .map(([name, type]) => [name, catalogueField[type].nullable().optional()])));
  const criteria = z.strictObject(Object.fromEntries(definition.filters
    .map((field) => [field, fieldFilter[definition.fields[field]].optional()])));
  const input = operation === "exact_overdue_receivables"
    ? z.strictObject({ division, cursor, as_of: date, min_amount: amount.nonnegative().optional() })
    : z.strictObject({ division, cursor, criteria: criteria.optional(),
      ...(keyType ? { id: (keyType === "text" ? z.string().regex(/^[A-Za-z]{3}$/) : catalogueField[keyType]).optional() } : {}) });
  return {
    definition, input, row, output: page(row),
    description: operation === "exact_overdue_receivables" ?
      "Read current receivables with a due date before as_of. Optionally set a minimum amount. This is not a historical balance." :
      `Read ${definition.label} for one company. ${keyType ? "Supply id for one record or criteria for a list. " : ""}` +
      "Criteria are exact matches. Dates match the full calendar day. Use the same inputs and nextCursor as cursor for more.",
  };
}

const entries = Object.entries(catalogResources).map(([name, definition]) => [`exact_${name}_list`, definition] as const);
export const catalogReadDefinitions = Object.fromEntries([...entries, ...Object.entries(aliases)]
  .map(([operation, definition]) => [operation, readDefinition(definition, operation)])) as
  Record<CatalogReadOperation, ReturnType<typeof readDefinition>>;

export type CatalogReadInput = { division: number; cursor?: string; id?: string | number;
  criteria?: Record<string, string | number | boolean | undefined>; as_of?: string; min_amount?: number };
export interface CatalogReadQuery { operation: CatalogReadOperation; input: CatalogReadInput; catalogue: true }
