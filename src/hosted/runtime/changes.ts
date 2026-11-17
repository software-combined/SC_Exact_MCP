import { changeInputs, changeOutput, type Change, type ChangeOperation, type ChangeResult } from "../domain/changes.js";
import { ServiceError, type Principal } from "../domain/identity.js";
import { changeRequest, createdRecord, salesJournal } from "../exact/changes.js";
import { company } from "../exact/normalize.js";
import type { Budgets } from "./budgets.js";
import type { Connections } from "./connections.js";

/**
 * Makes the few supported Exact changes with the person's own Exact permissions. Whether the AI app asks
 * before each call is the app's own tool-permission setting, as for any MCP tool.
 */
export class Changes {
  constructor(private connections: Connections, private budgets: Budgets) {}

  async change(operation: ChangeOperation, value: unknown, principal: Principal, signal: AbortSignal, sendBy: number): Promise<ChangeResult> {
    const parsed = changeInputs[operation].safeParse(value);
    if (!parsed.success) throw new ServiceError("invalid_input", parsed.error.issues[0]?.message ?? "Supply the advertised fields.", 400);
    const change = { operation, input: parsed.data } as Change;
    signal.throwIfAborted();
    const release = await this.budgets.person(principal.subject);
    try {
      const connection = await this.connections.authorize(principal);
      const token = await this.connections.access(principal, signal);
      const division = change.input.division;
      const selected = company(await this.connections.source.company(division, token, signal));
      if (selected.division !== division) throw new ServiceError("unavailable", "Exact returned the wrong company.");
      const journal = change.operation === "create_draft_sales_invoice" ? change.input.journalCode ??
        salesJournal(await this.connections.source.salesJournals(division, token, signal)) : undefined;
      signal.throwIfAborted();
      const request = changeRequest(change, journal);
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
}
