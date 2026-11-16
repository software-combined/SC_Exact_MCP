import { randomBytes } from "node:crypto";
import { ServiceError, type StateStore } from "../domain/identity.js";

interface Gate { epoch: number; attempt?: string; until?: number }
interface Lease { attempt: string; epoch: number; version: string; until: number }

/**
 * Serializes Exact token exchanges for one app. A lease that expires was abandoned (crash or overrun);
 * the next exchange takes it over. An unsaved or rotated token then only makes that person sign in again,
 * because Exact refuses the stale refresh token and the refresh path marks the connection for sign-in.
 */
export class ExchangeGate {
  readonly key: string;
  constructor(private store: StateStore, app: string, private now = () => Date.now()) { this.key = `exchange:${app}`; }
  async status(): Promise<Gate> { return (await this.store.read<Gate>(this.key))?.value ?? { epoch: 1 }; }
  async epoch(): Promise<number> { return (await this.status()).epoch; }
  async acquire(): Promise<Lease> {
    const old = await this.store.read<Gate>(this.key);
    if (old?.value.attempt && old.value.until! > this.now()) {
      throw new ServiceError("conflict", "Another credential exchange is running. Retry shortly.", 409);
    }
    const attempt = randomBytes(24).toString("base64url");
    const value: Gate = { epoch: old?.value.epoch ?? 1, attempt, until: this.now() + 30_000 };
    const version = await this.store.write(this.key, value, old?.version);
    if (!version) throw new ServiceError("conflict", "Another credential exchange started. Retry shortly.", 409);
    return { attempt, epoch: value.epoch, version, until: value.until! };
  }
  async renewForIssuance(lease: Lease): Promise<Lease> {
    const current = await this.store.read<Gate>(this.key);
    if (current?.version !== lease.version || current.value.attempt !== lease.attempt ||
      current.value.epoch !== lease.epoch || current.value.until! <= this.now()) {
      throw new ServiceError("conflict", "The exchange lease changed before issuance. Start again.", 409);
    }
    // Source I/O is 15s; up to six bounded AWS persistence calls need another 18s.
    const until = this.now() + 60_000;
    const version = await this.store.write(this.key, { ...current.value, until }, current.version);
    if (!version) throw new ServiceError("conflict", "The exchange lease changed before issuance. Start again.", 409);
    return { ...lease, version, until };
  }
  async assertIssuing(lease: Lease) {
    const current = await this.store.read<Gate>(this.key);
    if (current?.version !== lease.version || current.value.attempt !== lease.attempt || current.value.epoch !== lease.epoch ||
      current.value.until !== lease.until || lease.until - this.now() < 45_000) {
      throw new ServiceError("conflict", "The exchange has insufficient lease time. Start again.", 409);
    }
  }
  /** Best effort: if the release fails, the lease expires within 60 seconds and the next exchange takes it over. */
  async complete(lease: Lease) {
    const current = await this.store.read<Gate>(this.key).catch(() => undefined);
    if (current?.value.attempt === lease.attempt && current.version === lease.version) {
      await this.store.write(this.key, { epoch: lease.epoch }, current.version).catch(() => undefined);
    }
  }
  /** Operator tool: every saved connection stops working and each person signs in again. */
  async revokeAll() {
    const old = await this.store.read<Gate>(this.key);
    // A missing row means a wrong app, region or table: refuse so the operator never sees a false success.
    if (!old) throw new ServiceError("conflict", "No exchange state exists for this app and region. Nothing was changed.", 409);
    if (old.value.attempt && old.value.until! > this.now()) {
      throw new ServiceError("conflict", "A credential exchange is running. Retry after it finishes.", 409);
    }
    if (!await this.store.write(this.key, { epoch: old.value.epoch + 1 }, old.version)) {
      throw new ServiceError("conflict", "Exchange state changed. Retry.", 409);
    }
  }
}
