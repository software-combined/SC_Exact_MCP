import { z } from "zod";
import { ServiceError } from "../domain/identity.js";
import type { MatchKind } from "./query-plan.js";

const text = z.string().max(200).nullable().optional();
const row = z.object({ ID: z.guid(), Code: text, Name: text, Description: text });
const clean = (value: string | null | undefined) => (value ?? "").replace(/[\x00-\x1F\x7F]/g, " ").trim();

/**
 * Picks the one record that a person's text names, from one bounded lookup page (at most 10 rows).
 * A row whose full name or code equals the text wins, so a name that is also part of longer names can still be chosen.
 * For a read, one partial match is also the answer. For a change (`strict`), a partial match is only offered back,
 * so a change never lands on a record the person did not name. Otherwise the person chooses; nothing is guessed.
 */
export function pickMatch(kind: MatchKind, wanted: string, division: number, rows: unknown[], strict = false): string {
  const matches = rows.map((value) => {
    const parsed = row.safeParse(value);
    if (!parsed.success) throw new ServiceError("unavailable", "Exact returned a record this service cannot read.");
    return { id: parsed.data.ID.toLowerCase(), code: clean(parsed.data.Code),
      name: clean(kind === "customer" ? parsed.data.Name : parsed.data.Description) };
  });
  const key = wanted.trim().toLowerCase();
  const exact = matches.filter((match) => match.name.toLowerCase() === key || match.code.toLowerCase() === key);
  if (exact.length === 1) return exact[0].id;
  if (matches.length === 1 && !strict) return matches[0].id;
  const noun = kind === "customer" ? "customer" : "sales item";
  const asked = clean(wanted);
  if (!matches.length) throw new ServiceError("invalid_input", `No ${noun} matches '${asked}' in company ${division}.`, 400);
  if (matches.length === 1) {
    throw new ServiceError("invalid_input", `Did you mean ${matches[0].name || "no name"} (${matches[0].code || "no code"})? ` +
      "Give its exact name or code.", 400);
  }
  const choices = matches.slice(0, 10).map((match) => `${match.name || "no name"} (${match.code || "no code"})`).join(", ");
  const how = kind === "customer" ? "give its exact name or code" : "give its exact item code";
  throw new ServiceError("invalid_input", `${matches.length >= 10 ? "At least 10" : "Several"} ${noun}s match '${asked}' in ` +
    `company ${division}: ${choices}. Ask which one is meant, then ${how}.`, 400);
}
