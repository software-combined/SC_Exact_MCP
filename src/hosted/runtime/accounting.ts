import { inputs, outputs, type Operation, type Page, type Query } from "../domain/contracts.js";
import { ServiceError, type Principal } from "../domain/identity.js";
import { company, normalize } from "../exact/normalize.js";
import type { Connections } from "./connections.js";
import type { Budgets } from "./budgets.js";
import type { Cursors } from "./cursors.js";

export class Accounting {
  constructor(private connections: Connections, private budgets: Budgets, private cursors: Cursors) {}
  async read(operation: Operation, value: unknown, principal: Principal, signal: AbortSignal): Promise<Page> {
    const parsed = inputs[operation].safeParse(value);
    if (!parsed.success) throw new ServiceError("invalid_input", "Supply the advertised fields and one valid query selector.", 400);
    const query = { operation, input: parsed.data } as Query;
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
      const result = await this.connections.source.read(query, division, token, signal, continuation?.next);
      const rows = result.rows.map((row) => normalize(operation, row));
      const nextCursor = result.next ? await this.cursors.create(principal, query, result.next, continuation) : undefined;
      const page = outputs[operation].parse({ company: selectedCompany, rows,
        source: { system: "Exact Online", region: connection.region, readAt: new Date().toISOString(),
          projectionVersion: 1, contentTrust: "untrusted source data" },
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
