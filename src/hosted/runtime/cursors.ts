import { createHash, randomBytes } from "node:crypto";
import { ServiceError, type Principal, type StateStore } from "../domain/identity.js";
import type { Query } from "../domain/contracts.js";
import { take } from "../storage/state.js";

interface Continuation { binding: string; next: string; seen: string[] }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export class Cursors {
  constructor(private store: StateStore, private app: string, private region: string) {}
  private binding(principal: Principal, query: Query): string {
    const { cursor: _cursor, ...input } = query.input;
    const sorted = Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
    return hash(JSON.stringify({ app: this.app, subject: principal.subject, generation: principal.generation,
      region: this.region, operation: query.operation, input: sorted, projectionVersion: 1 }));
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
  async create(principal: Principal, query: Query, next: string, previous?: Continuation): Promise<string> {
    const digest = hash(next);
    const seen = previous?.seen ?? [];
    if (seen.includes(digest) || seen.length >= 100) {
      throw new ServiceError("unavailable", "Exact repeated a page or the query exceeded its paging bound. Narrow the query.");
    }
    const id = randomBytes(32).toString("base64url");
    const value: Continuation = { binding: this.binding(principal, query), next, seen: [...seen, digest] };
    if (!await this.store.write(`cursor:${this.app}:${id}`, { payload: value }, undefined, Date.now() + 600_000)) {
      throw new ServiceError("unavailable", "Could not create a safe continuation.");
    }
    return id;
  }
}
