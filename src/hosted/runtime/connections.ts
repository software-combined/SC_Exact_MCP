import { connectionKey, ServiceError, subject, type Connection, type CredentialCipher,
  type Principal, type StateStore } from "../domain/identity.js";
import type { ExactSource } from "../exact/source.js";
import { ExchangeGate } from "./exchanges.js";
import { ExchangeRejected } from "../exact/token-response.js";

export class Connections {
  readonly gate: ExchangeGate;
  constructor(readonly store: StateStore, private cipher: CredentialCipher, readonly source: ExactSource) {
    this.gate = new ExchangeGate(store, `${source.config.appId}:${source.config.region}`);
  }
  key(id: string) { return connectionKey(this.source.config.appId, id); }
  async active(id: string): Promise<Connection> {
    const epoch = await this.gate.assertReadable();
    const row = await this.store.read<Connection>(this.key(id));
    if (!row || row.value.status !== "active" || row.value.appEpoch !== epoch || row.value.subject !== id) {
      throw new ServiceError("reauth_required", "This personal Exact connection needs to reconnect.", 401);
    }
    return row.value;
  }
  async authorize(principal: Principal) {
    const connection = await this.active(principal.subject);
    if (connection.generation !== principal.generation) throw new ServiceError("denied", "The connection changed. Authorize this client again.", 401);
    return connection;
  }
  async connect(code: string, caller?: AbortSignal): Promise<Connection> {
    let lease = await this.gate.acquire();
    let started = false; let exchanged = false;
    try {
      caller?.throwIfAborted();
      const exchange = await this.source.prepareExchange();
      caller?.throwIfAborted();
      lease = await this.gate.renewForIssuance(lease);
      await this.gate.assertIssuing(lease);
      caller?.throwIfAborted();
      const independent = AbortSignal.timeout(15_000);
      started = true;
      const tokens = await exchange.exchange("code", code, independent);
      exchanged = true;
      const me = await exchange.me(tokens.accessToken, independent);
      const id = subject(this.source.config.region, me.UserID);
      const old = await this.store.read<Connection>(this.key(id));
      const sameActive = old?.value.status === "active" && old.value.appEpoch === lease.epoch &&
        old.value.subject === id && old.value.userId === me.UserID && old.value.region === this.source.config.region;
      const value: Connection = { subject: id, userId: me.UserID, displayName: me.FullName,
        region: this.source.config.region, currentDivision: me.CurrentDivision,
        generation: sameActive ? old!.value.generation : (old?.value.generation ?? 0) + 1, status: "active", appEpoch: lease.epoch,
        credentials: await this.cipher.seal(tokens, this.key(id)), expiresAt: tokens.expiresAt };
      if (!await this.store.write(this.key(id), value, old?.version)) throw new Error("Connection changed during exchange.");
      await this.readback(value);
      await this.gate.complete(lease);
      return value;
    } catch (error) {
      if (!started || (!exchanged && (error instanceof ExchangeRejected || (error instanceof ServiceError && error.code === "limited")))) {
        await this.gate.complete(lease);
        throw error;
      }
      await this.gate.uncertain(lease);
      throw new ServiceError("reauth_required", "Exact sign-in could not be safely persisted. IT must reconcile before retrying.", 401);
    }
  }
  private async readback(value: Connection) {
    const stored = await this.store.read<Connection>(this.key(value.subject));
    if (stored?.value.credentials !== value.credentials || stored.value.generation !== value.generation ||
      stored.value.status !== "active") throw new Error("Credentials were not durably confirmed.");
  }
  async access(principal: Principal, caller?: AbortSignal): Promise<string> {
    const initial = await this.authorize(principal);
    caller?.throwIfAborted();
    if (initial.expiresAt > Date.now() + 30_000) {
      return (await this.cipher.open(initial.credentials, this.key(principal.subject))).accessToken;
    }
    let lease = await this.gate.acquire();
    let started = false; let exchanged = false;
    try {
      // Re-read after the shared lock: another replica may have rotated first.
      const current = await this.store.read<Connection>(this.key(principal.subject));
      const connection = await this.authorize(principal);
      if (!current || current.value.credentials !== connection.credentials) throw new Error("Connection conflict.");
      if (connection.expiresAt > Date.now() + 30_000) {
        const tokens = await this.cipher.open(connection.credentials, this.key(principal.subject));
        await this.gate.complete(lease);
        return tokens.accessToken;
      }
      const previous = await this.cipher.open(connection.credentials, this.key(principal.subject));
      if (Date.now() < previous.issuedAt + 570_000) {
        throw new ServiceError("limited", "Exact refresh is not due yet. Retry after the minimum refresh interval.", 429);
      }
      // Request cancellation cannot abort an already-started bounded rotation/persistence.
      caller?.throwIfAborted();
      const exchange = await this.source.prepareExchange();
      caller?.throwIfAborted();
      lease = await this.gate.renewForIssuance(lease);
      await this.gate.assertIssuing(lease);
      caller?.throwIfAborted();
      const independent = AbortSignal.timeout(15_000);
      started = true;
      const tokens = await exchange.exchange("refresh", previous.refreshToken, independent);
      exchanged = true;
      const me = await exchange.me(tokens.accessToken, independent);
      if (subject(connection.region, me.UserID) !== connection.subject) throw new Error("Exact identity changed.");
      const value: Connection = { ...connection, currentDivision: me.CurrentDivision, displayName: me.FullName,
        credentials: await this.cipher.seal(tokens, this.key(principal.subject)), expiresAt: tokens.expiresAt };
      if (!await this.store.write(this.key(principal.subject), value, current.version)) throw new Error("Connection changed during rotation.");
      await this.readback(value);
      await this.gate.complete(lease);
      return tokens.accessToken;
    } catch (error) {
      if (!started || (!exchanged && (error instanceof ExchangeRejected || (error instanceof ServiceError && error.code === "limited")))) {
        if (error instanceof ExchangeRejected && error.credentialsInvalid) {
          const old = await this.store.read<Connection>(this.key(principal.subject));
          if (!old || !await this.store.write(this.key(principal.subject), { ...old.value, status: "reauth_required",
            generation: old.value.generation + 1, credentials: "" }, old.version)) {
            await this.gate.uncertain(lease);
            throw new ServiceError("reauth_required", "Credential rejection could not be persisted. IT must reconcile.", 401);
          }
        }
        await this.gate.complete(lease);
        throw error;
      }
      await this.gate.uncertain(lease);
      throw new ServiceError("reauth_required", "Exact token rotation is uncertain. IT must reconcile before reconnecting.", 401);
    }
  }
  async disconnect(principal: Principal) {
    const lease = await this.gate.acquire();
    try {
      const old = await this.store.read<Connection>(this.key(principal.subject));
      await this.authorize(principal);
      if (!old || !await this.store.write(this.key(principal.subject), { ...old.value, status: "disconnected",
        credentials: "", generation: old.value.generation + 1 }, old.version)) {
        throw new ServiceError("conflict", "The connection changed. Retry disconnect.", 409);
      }
    } finally { await this.gate.complete(lease); }
  }
}
