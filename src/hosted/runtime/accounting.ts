import { inputs, outputs, parseInput, projectionVersion, type Operation, type Page, type Query } from "../domain/contracts.js";
import { ServiceError, type Principal } from "../domain/identity.js";
import { company, normalize } from "../exact/normalize.js";
import type { Connections } from "./connections.js";
import type { Budgets } from "./budgets.js";
import type { Cursors } from "./cursors.js";

export class Accounting {
  constructor(private connections: Connections, private budgets: Budgets, private cursors: Cursors) {}
  async read(operation: Operation, value: unknown, principal: Principal, signal: AbortSignal): Promise<Page> {
    const query = { operation, input: parseInput(inputs[operation], value) } as Query;
    signal.throwIfAborted();
    const release = await this.budgets.person(principal.subject);
    try {
      let connection = await this.connections.authorize(principal);
      const continuation = await this.cursors.open(principal, query);
      signal.throwIfAborted();
      const token = await this.connections.access(principal, signal);
      if (operation === "company_discovery") connection = await this.connections.authorize(principal);
      signal.throwIfAborted();
      const division = "division" in query.input ? query.input.division : connection.currentDivision;
      const selectedCompany = operation === "company_discovery" ? null :
        company(await this.connections.source.company(division, token, signal));
      if (selectedCompany && selectedCompany.division !== division) {
        throw new ServiceError("unavailable", "Exact returned the wrong company.");
      }
      // A customer name costs one bounded lookup read on every page. The cursor binds the name and keeps the record
      // that it matched, so a later page for a different record is refused instead of joined to the first.
      const customer = "customer" in query.input ? query.input.customer : undefined;
      const record = customer ? await this.connections.source.resolve("customer", customer, division, token, signal) : undefined;
      if (continuation?.record && continuation.record !== record) {
        throw new ServiceError("denied", "The customer name now matches a different record. Ask the question again.", 409);
      }
      const planned = record ? { ...query, input: { ...query.input, customerId: record } } as Query : query;
      const result = await this.connections.source.read(planned, division, token, signal, continuation?.next);
      // Exact's $top would switch off its paging, so a limit trims the normal page and the cursor keeps the position.
      // ponytail: a record added or removed ahead of the offset shifts one row; store the last row ID when that matters.
      const limit = "limit" in query.input ? query.input.limit : undefined;
      const start = continuation?.offset ?? 0;
      const end = limit ? start + limit : result.rows.length;
      const rows = result.rows.slice(start, end).map((row) => normalize(operation, row));
      const nextCursor = end < result.rows.length ? await this.cursors.create(principal, query, continuation?.next, continuation, end, record) :
        result.next ? await this.cursors.create(principal, query, result.next, continuation, 0, record) : undefined;
      const page = outputs[operation].parse({ company: selectedCompany, rows,
        source: { system: "Exact Online", region: connection.region, readAt: new Date().toISOString(),
          projectionVersion, contentTrust: "untrusted source data" },
        coverage: { state: nextCursor ? "partial" : "complete", returned: rows.length, nextCursor,
          scope: "one live query; pages are not a snapshot or financial total" } });
      if (Buffer.byteLength(JSON.stringify(page)) > 64_000) {
        throw new ServiceError("unavailable", "The bounded output is too large. Narrow the query.");
      }
      await this.connections.authorize(principal);
      signal.throwIfAborted();
      return page;
    } finally { await release(); }
  }
}
