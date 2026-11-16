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
    const epoch = await this.gate.epoch();
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
    let started = false; let stage = "prepare";
    try {
      caller?.throwIfAborted();
      const exchange = await this.source.prepareExchange();
      caller?.throwIfAborted();
      lease = await this.gate.renewForIssuance(lease);
      await this.gate.assertIssuing(lease);
      caller?.throwIfAborted();
      const independent = AbortSignal.timeout(15_000);
      started = true; stage = "exchange";
      const tokens = await exchange.exchange("code", code, independent);
      stage = "identity";
      const me = await exchange.me(tokens.accessToken, independent);
      stage = "persist";
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
      return value;
    } catch (error) {
      // A failed new sign-in leaves no saved credential at risk, so the person can simply try again.
      if (!started || error instanceof ExchangeRejected || (error instanceof ServiceError && error.code === "limited")) throw error;
      throw new ServiceError("unavailable", "Exact sign-in did not finish. Close this window and try again.", 503,
        `connect:${stage}:${causeOf(error)}`);
    } finally { await this.gate.complete(lease); }
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
    let started = false; let exchanged = false; let stage = "prepare";
    try {
      // Re-read after the shared lock: another replica may have rotated first.
      const current = await this.store.read<Connection>(this.key(principal.subject));
      const connection = await this.authorize(principal);
      if (!current || current.value.credentials !== connection.credentials) throw new Error("Connection conflict.");
      if (connection.expiresAt > Date.now() + 30_000) {
        const tokens = await this.cipher.open(connection.credentials, this.key(principal.subject));
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
      started = true; stage = "exchange";
      const tokens = await exchange.exchange("refresh", previous.refreshToken, independent);
      exchanged = true; stage = "persist";
      const me = await exchange.me(tokens.accessToken, independent);
      if (subject(connection.region, me.UserID) !== connection.subject) throw new Error("Exact identity changed.");
      const value: Connection = { ...connection, currentDivision: me.CurrentDivision, displayName: me.FullName,
        credentials: await this.cipher.seal(tokens, this.key(principal.subject)), expiresAt: tokens.expiresAt };
      if (!await this.store.write(this.key(principal.subject), value, current.version)) throw new Error("Connection changed during rotation.");
      await this.readback(value);
      return tokens.accessToken;
    } catch (error) {
      const retryable = !started || (!exchanged && (error instanceof ExchangeRejected ? !error.credentialsInvalid :
        error instanceof ServiceError && error.code === "limited"));
      // Only this person is affected: their saved token may be stale, so they sign in again. Nobody else waits on IT.
      if (!retryable) await this.requireSignIn(principal.subject);
      if (retryable || error instanceof ExchangeRejected) throw error;
      throw new ServiceError("reauth_required", "Your Exact access needs a fresh sign-in. Sign in again from your AI app.", 401,
        `refresh:${stage}:${causeOf(error)}`);
    } finally { await this.gate.complete(lease); }
  }
  /** Best effort: if this write fails, Exact refuses the stale token on the next refresh and this runs again. */
  private async requireSignIn(id: string) {
    const old = await this.store.read<Connection>(this.key(id)).catch(() => undefined);
    if (old?.value.status !== "active") return;
    await this.store.write(this.key(id), { ...old.value, status: "reauth_required", generation: old.value.generation + 1,
      credentials: "" }, old.version).catch(() => undefined);
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

const causeOf = (error: unknown) => error instanceof ServiceError ? error.code : (error as Error)?.name ?? "unknown";
