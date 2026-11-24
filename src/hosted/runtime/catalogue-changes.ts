import { createHash } from "node:crypto";
import { catalogWriteRequest, type CatalogMutationName } from "../domain/catalogue/mutations.js";
import { ServiceError, type Principal, type StateStore } from "../domain/identity.js";
import { company } from "../exact/normalize.js";
import type { Budgets } from "./budgets.js";
import type { Connections } from "./connections.js";

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : Number(a > b))
      .map(([key, field]) => [key, ordered(field)]));
  }
  return value;
}

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(ordered(value))).digest("hex");

export class CatalogueChanges {
  constructor(private connections: Connections, private budgets: Budgets, private store: StateStore) {}

  async change(name: CatalogMutationName, value: unknown, principal: Principal, signal: AbortSignal, sendBy: number, requestId: string) {
    let input;
    try { input = catalogWriteRequest(name, value); }
    catch { throw new ServiceError("invalid_input", "Check the change arguments. Nothing was changed.", 400); }
    const { division, request } = input;
    const release = await this.budgets.person(principal.subject);
    let reservation: { key: string; version: string } | undefined;
    try {
      const token = await this.connections.access(principal, signal);
      const source = this.connections.source;
      const selected = company(await source.company(division, token, signal));
      if (selected.division !== division) throw new ServiceError("denied", "Exact returned a different company.", 403);
      const before = request.target ? await source.readMutationTarget(division, request.target, token, signal) : null;
      const recordId = request.target?.key ?? null;
      const result = await source.applyCatalogueChange(division, request, token, signal, sendBy, async (record) => {
        if (digest(record) !== digest(before)) {
          throw new ServiceError("conflict", "The Exact target changed during this request. Read it again.", 409);
        }
        const key = `catalogue-change:${source.config.appId}:${digest({ subject: principal.subject, division, method: request.method,
          resource: request.resource, key: request.key, body: request.body })}`;
        const version = await this.store.write(key, { requestId }, undefined, Date.now() + 600_000);
        if (!version) {
          throw new ServiceError("conflict", "An identical change was attempted recently. Check Exact before trying again.", 409);
        }
        reservation = { key, version };
        await this.connections.authorize(principal);
      });
      return { outcome: "acknowledged", company: selected, action: name, requestId,
        recordId: result.recordId ?? recordId, readback: result.readback };
    } catch (error) {
      if (reservation && error instanceof ServiceError &&
        (error.detail === "catalogue-change:unsent" || error.detail === "catalogue-change:refused")) {
        await this.store.remove(reservation.key, reservation.version).catch(() => undefined);
      }
      throw error;
    } finally { await release().catch(() => undefined); }
  }
}
