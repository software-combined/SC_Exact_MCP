import { changeInputs, changeOutput, type Change, type ChangeOperation, type ChangeResult } from "../domain/changes.js";
import { parseInput } from "../domain/contracts.js";
import { ServiceError, type Principal } from "../domain/identity.js";
import { changeRequest, createdRecord, salesJournal } from "../exact/changes.js";
import { company } from "../exact/normalize.js";
import type { MatchKind } from "../exact/query-plan.js";
import type { Budgets } from "./budgets.js";
import type { Connections } from "./connections.js";

/**
 * Makes the few supported Exact changes with the person's own Exact permissions. Whether the AI app asks
 * before each call is the app's own tool-permission setting, as for any MCP tool.
 */
export class Changes {
  constructor(private connections: Connections, private budgets: Budgets) {}

  async change(operation: ChangeOperation, value: unknown, principal: Principal, signal: AbortSignal, sendBy: number): Promise<ChangeResult> {
    const change = { operation, input: parseInput(changeInputs[operation], value) } as Change;
    signal.throwIfAborted();
    const release = await this.budgets.person(principal.subject);
    try {
      const connection = await this.connections.authorize(principal);
      const token = await this.connections.access(principal, signal);
      const division = change.input.division;
      const selected = company(await this.connections.source.company(division, token, signal));
      if (selected.division !== division) throw new ServiceError("unavailable", "Exact returned the wrong company.");
      const resolved = await this.resolve(change, division, token, signal);
      const journal = resolved.operation === "create_draft_sales_invoice" ? resolved.input.journalCode ??
        salesJournal(await this.connections.source.salesJournals(division, token, signal)) : undefined;
      signal.throwIfAborted();
      const request = changeRequest(resolved, journal);
      // The connection is checked again inside the send step, after any wait for the shared slot, so a disconnect or reset
      // before that check stops the change.
      const answer = await this.connections.source.change(division, request, token, signal, sendBy,
        () => this.connections.authorize(principal));
      const updated = request.method === "PUT";
      const record = updated ? { id: request.key! } : createdRecord(answer);
      return changeOutput.parse({ company: selected,
        result: { action: updated ? "updated" : "created",
          record: request.resource === "crm/Accounts" ? "customer" : "sales invoice", ...record },
        source: { system: "Exact Online", region: connection.region, changedAt: new Date().toISOString() } });
    } finally {
      // After a send, a failed release must not turn a made change into an error; the person lease expires anyway.
      await release().catch(() => undefined);
    }
  }

  /**
   * Replaces a customer name and line item texts with record IDs, one bounded lookup read each, before anything is sent.
   * An unclear name stops the change with the candidates, so nothing is guessed or changed.
   */
  private async resolve(change: Change, division: number, token: string, signal: AbortSignal): Promise<Change> {
    if (change.operation === "create_customer") return change;
    const find = async (kind: MatchKind, text: string) => {
      try { return await this.connections.source.resolve(kind, text, division, token, signal, true); } catch (error) {
        if (error instanceof ServiceError && error.code === "invalid_input") {
          throw new ServiceError(error.code, `${error.message} Nothing was changed.`, error.status);
        }
        throw error;
      }
    };
    const customerId = change.input.customer ? await find("customer", change.input.customer) : change.input.customerId;
    if (change.operation === "update_customer") return { ...change, input: { ...change.input, customerId } };
    const items = new Map<string, string>();
    for (const { item } of change.input.lines) {
      if (item && !items.has(item.toLowerCase())) items.set(item.toLowerCase(), await find("item", item));
    }
    const lines = change.input.lines.map((line) => line.item ? { ...line, itemId: items.get(line.item.toLowerCase()) } : line);
    return { ...change, input: { ...change.input, customerId, lines } };
  }
}
