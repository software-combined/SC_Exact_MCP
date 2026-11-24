import { inputs, outputs, parseInput, projectionVersion, type Operation, type Page, type Query } from "../domain/contracts.js";
import { ServiceError, type Principal } from "../domain/identity.js";
import { company, normalize } from "../exact/normalize.js";
import type { Connections } from "./connections.js";
import type { Budgets } from "./budgets.js";
import type { Cursors } from "./cursors.js";
import { catalogReadDefinitions, type CatalogReadInput, type CatalogReadOperation, type CatalogReadQuery } from "../domain/catalogue/contracts.js";
import { catalogPlan, catalogRow } from "../exact/catalogue-reads.js";
import type { ReadPlan } from "../exact/query-plan.js";

/** Customer and item rows, the only lists with a limit, are sorted by Code and carry their Exact ID. */
const rowKey = (row: unknown) => JSON.stringify([(row as { ID?: unknown }).ID, (row as { Code?: unknown }).Code]);

export class Accounting {
  constructor(private connections: Connections, private budgets: Budgets, private cursors: Cursors) {}
  async read(operation: Operation, value: unknown, principal: Principal, signal: AbortSignal): Promise<Page> {
    const query = { operation, input: parseInput(inputs[operation], value) } as Query;
    return this.readPage(query, principal, signal) as Promise<Page>;
  }
  readCatalogue(operation: CatalogReadOperation, value: unknown, principal: Principal, signal: AbortSignal) {
    const input = parseInput(catalogReadDefinitions[operation].input, value) as CatalogReadInput;
    const query = { operation, input, catalogue: true } as const;
    return this.readPage(query, principal, signal, catalogPlan(query));
  }
  private async readPage(query: Query | CatalogReadQuery, principal: Principal, signal: AbortSignal, plannedCatalogue?: ReadPlan) {
    signal.throwIfAborted();
    const { operation } = query;
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
      const result = plannedCatalogue ? await this.connections.source.readPlan(plannedCatalogue, division, token, signal, continuation?.next) :
        await this.connections.source.read(planned as Query, division, token, signal, continuation?.next);
      // Exact's $top would switch off its paging, so a limit trims the normal page. Within that page, the cursor keeps
      // the ID and Code (the sort key) of the last record returned. If that record is gone or moved, the call is refused.
      const limit = "limit" in query.input ? query.input.limit : undefined;
      const after = continuation?.after;
      const at = after ? result.rows.findIndex((row) => rowKey(row) === after) : -1;
      if (after && at < 0) {
        throw new ServiceError("denied", "The list changed while you were paging. Ask again from the start.", 409);
      }
      const start = at + 1;
      const end = limit ? start + limit : result.rows.length;
      const rows = result.rows.slice(start, end).map((row) => "catalogue" in query ? catalogRow(query, row) : normalize(query.operation, row));
      const nextCursor = end < result.rows.length ?
        await this.cursors.create(principal, query, continuation?.next, continuation, rowKey(result.rows[end - 1]), record) :
        result.next ? await this.cursors.create(principal, query, result.next, continuation, undefined, record) : undefined;
      const output = "catalogue" in query ? catalogReadDefinitions[query.operation].output : outputs[query.operation];
      const page = output.parse({ company: selectedCompany, rows,
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
  async identity(principal: Principal, signal: AbortSignal) {
    const release = await this.budgets.person(principal.subject);
    try {
      const connection = await this.connections.authorize(principal);
      const token = await this.connections.access(principal, signal);
      const me = await this.connections.source.me(token, signal);
      if (me.UserID !== connection.userId) throw new ServiceError("denied", "Exact returned a different identity.", 403);
      await this.connections.authorize(principal);
      return { userId: me.UserID, name: me.FullName, currentDivision: me.CurrentDivision, region: connection.region };
    } finally { await release(); }
  }
  async availableBudget(principal: Principal) {
    const connection = await this.connections.authorize(principal);
    return { division: connection.currentDivision, ...await this.budgets.available(connection.currentDivision) };
  }
}
