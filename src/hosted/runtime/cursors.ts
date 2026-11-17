import { createHash, randomBytes } from "node:crypto";
import { ServiceError, type Principal, type StateStore } from "../domain/identity.js";
import { projectionVersion, type Query } from "../domain/contracts.js";
import { take } from "../storage/state.js";

/**
 * next is the Exact page to read (none means the first page). offset is the first row to return from that page:
 * a limit shorter than the page leaves the rest of that page for the next cursor. record is the customer that a name
 * matched on the first page; a later page must match the same record.
 */
export interface Continuation { binding: string; next?: string; offset?: number; record?: string; seen: string[] }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export class Cursors {
  constructor(private store: StateStore, private app: string, private region: string) {}
  private binding(principal: Principal, query: Query): string {
    const { cursor: _cursor, ...input } = query.input;
    const sorted = Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
    return hash(JSON.stringify({ app: this.app, subject: principal.subject, generation: principal.generation,
      region: this.region, operation: query.operation, input: sorted, projectionVersion }));
  }
  async open(principal: Principal, query: Query): Promise<Continuation | undefined> {
    if (!query.input.cursor) return undefined;
    const key = `cursor:${this.app}:${query.input.cursor}`;
    const row = await this.store.read<{ payload: Continuation }>(key);
    if (row?.value.payload?.binding !== this.binding(principal, query)) {
      throw new ServiceError("denied", "The cursor expired or belongs to another person, company, query, or connection.", 403);
    }
    return take<Continuation>(this.store, key);
  }
  async create(principal: Principal, query: Query, next: string | undefined, previous?: Continuation, offset = 0,
    record?: string): Promise<string> {
    const digest = hash(`${next ?? ""}#${offset}`);
    const seen = previous?.seen ?? [];
    if (seen.includes(digest)) throw new ServiceError("unavailable", "Exact repeated a page. Ask the question again.");
    if (seen.length >= 100) throw new ServiceError("invalid_input", "This query reached its limit of 100 pages. Narrow the query.", 400);
    const id = randomBytes(32).toString("base64url");
    const value: Continuation = { binding: this.binding(principal, query), next, offset, record, seen: [...seen, digest] };
    if (!await this.store.write(`cursor:${this.app}:${id}`, { payload: value }, undefined, Date.now() + 600_000)) {
      throw new ServiceError("unavailable", "Could not create a safe continuation.");
    }
    return id;
  }
}
