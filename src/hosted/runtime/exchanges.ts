import { randomBytes } from "node:crypto";
import { ServiceError, type StateStore } from "../domain/identity.js";

interface Gate { epoch: number; attempt?: string; until?: number; uncertain?: boolean }
interface Lease { attempt: string; epoch: number; version: string; until: number }

/** Never expires by TTL: an abandoned exchange must remain visible after restart. */
export class ExchangeGate {
  readonly key: string;
  constructor(private store: StateStore, app: string, private now = () => Date.now()) { this.key = `exchange:${app}`; }
  async status(): Promise<Gate> { return (await this.store.read<Gate>(this.key))?.value ?? { epoch: 1 }; }
  async assertReadable(): Promise<number> {
    const gate = await this.status();
    if (gate.uncertain || (gate.attempt && gate.until! <= this.now())) {
      throw new ServiceError("reauth_required", "An Exact credential exchange is uncertain. IT must reconcile the app before reconnecting.", 401);
    }
    return gate.epoch;
  }
  async acquire(): Promise<Lease> {
    const old = await this.store.read<Gate>(this.key);
    await this.assertReadable();
    if (old?.value.attempt) throw new ServiceError("conflict", "Another credential exchange is running. Retry shortly.", 409);
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
  async complete(lease: Lease) {
    const current = await this.store.read<Gate>(this.key);
    if (current?.value.attempt !== lease.attempt || current.version !== lease.version || current.value.epoch !== lease.epoch || current.value.until! <= this.now() ||
      !await this.store.write(this.key, { epoch: lease.epoch }, current.version)) {
      throw new ServiceError("reauth_required", "Credential persistence is uncertain. IT must reconcile the app.", 401);
    }
  }
  async uncertain(lease: Lease) {
    // Preserve pending state if even this best-effort write fails.
    const current = await this.store.read<Gate>(this.key).catch(() => undefined);
    if (current?.value.attempt === lease.attempt && current.version === lease.version) {
      await this.store.write(this.key, { ...current.value, uncertain: true }, lease.version).catch(() => false);
    }
  }
  async reconcileExpired() {
    const old = await this.store.read<Gate>(this.key);
    if (!old?.value.attempt || old.value.until! > this.now()) {
      throw new ServiceError("conflict", "There is no expired uncertain exchange to reconcile.", 409);
    }
    // Every prior credential chain becomes unusable; each person must reconnect.
    if (!await this.store.write(this.key, { epoch: old.value.epoch + 1 }, old.version)) {
      throw new ServiceError("conflict", "Exchange state changed. Re-read before reconciliation.", 409);
    }
  }
}
