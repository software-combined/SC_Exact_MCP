import { z } from "zod";
import { catalogReadDefinitions, type CatalogReadQuery } from "../domain/catalogue/contracts.js";
import { ServiceError } from "../domain/identity.js";
import { literal, type ReadPlan } from "./query-plan.js";
import { bankLastFour } from "./normalize.js";

export function catalogPlan(query: CatalogReadQuery): ReadPlan {
  const { definition } = catalogReadDefinitions[query.operation];
  const { resource, fields, key } = definition;
  const { id, criteria, as_of, min_amount } = query.input;
  const select = Object.keys(fields).join(",");
  if (id !== undefined) {
    if (criteria || query.input.cursor || !key) {
      throw new ServiceError("invalid_input", "Use either an ID or list criteria and a cursor.", 400);
    }
    const kind = fields[key];
    if (kind === "guid") return { resource, select, key: z.guid().parse(id).toLowerCase() };
    return { resource, select, key: String(id), keyKind: kind === "text" ? "currency" : "integer" };
  }
  if (as_of) return { resource, select,
    filter: `DueDate lt datetime'${as_of}T00:00:00'${min_amount === undefined ? "" : ` and Amount ge ${min_amount}`}` };
  if (resource === "financialtransaction/TransactionLines" && criteria &&
    ("FinancialYear" in criteria) !== ("FinancialPeriod" in criteria)) {
    throw new ServiceError("invalid_input", "Give FinancialYear and FinancialPeriod together.", 400);
  }
  const filters = Object.entries(criteria ?? {}).flatMap(([name, value]) => {
    if (value === undefined) return [];
    const kind = fields[name];
    if (kind === "date") {
      const start = `${value}T00:00:00`;
      const end = new Date(Date.parse(`${start}Z`) + 86_400_000).toISOString().slice(0, 19);
      return [`${name} ge datetime'${start}'`, `${name} lt datetime'${end}'`];
    }
    const operand = kind === "guid" ? `guid'${String(value).toLowerCase()}'`
      : typeof value === "string" ? literal(value) : String(value);
    return [`${name} eq ${operand}`];
  });
  return { resource, select, filter: filters.length ? filters.join(" and ") : undefined };
}

export function catalogRow(query: CatalogReadQuery, value: unknown) {
  const { definition, row } = catalogReadDefinitions[query.operation];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ServiceError("unavailable", "Exact returned an invalid catalogue record.");
  }
  const raw = value as Record<string, unknown>;
  const selected = Object.fromEntries(Object.entries(definition.fields).flatMap(([name, kind]) =>
    raw[name] === undefined ? [] : [[name, kind === "masked" ? bankLastFour(raw[name]) : raw[name]]]));
  const parsed = row.safeParse(selected);
  const key = definition.key ? selected[definition.key] : undefined;
  if (!parsed.success || Object.keys(selected).length === 0 || (definition.key && key == null) ||
    (query.input.id !== undefined && String(key).toLowerCase() !== String(query.input.id).toLowerCase())) {
    throw new ServiceError("unavailable", "Exact did not return a valid result for the requested catalogue record.");
  }
  return parsed.data;
}
