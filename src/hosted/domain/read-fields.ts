import { z } from "zod";

export const division = z.number().int().positive().max(2_147_483_647);
export const cursor = z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional();
export const guid = z.guid();
export const date = z.iso.date();
export const amount = z.number().finite();
export const currency = z.string().regex(/^[A-Z]{3}$/);
export const label = z.string().max(200);
export const companySchema = z.strictObject({ division, name: label, currency });

/** Cursors bind the projection version. Adding independent tools leaves prior projections valid. */
export const projectionVersion = 3;
const coverage = z.strictObject({ state: z.enum(["complete", "partial"]),
  scope: z.literal("one live query; pages are not a snapshot or financial total"),
  returned: z.number().int().min(0).max(100), nextCursor: cursor });
const provenance = z.strictObject({ system: z.literal("Exact Online"), region: z.string(),
  readAt: z.iso.datetime(), projectionVersion: z.literal(projectionVersion), contentTrust: z.literal("untrusted source data") });

export function page<T extends z.ZodType>(item: T) {
  return z.strictObject({ company: companySchema.nullable(), source: provenance, coverage, rows: z.array(item).max(100) });
}
