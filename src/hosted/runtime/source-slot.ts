import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { ServiceError, type StateStore } from "../domain/identity.js";

interface Slot { owner: string; until: number }

/** Exact requires sequential REST requests, including response-body consumption. */
export class SourceSlot {
  private key: string;
  constructor(private store: StateStore, app: string, private now = () => Date.now()) {
    this.key = `rest-slot:${app}`;
  }
  async run<T>(read: (signal: AbortSignal) => Promise<T>, caller = AbortSignal.timeout(25_000)): Promise<T> {
    const owner = randomBytes(24).toString("base64url");
    let version: string;
    let until: number;
    while (true) {
      caller.throwIfAborted();
      const old = await this.store.read<Slot>(this.key);
      if (old && old.value.until > this.now()) {
        await delay(Math.min(100, old.value.until - this.now()), undefined, { signal: caller });
        continue;
      }
      // The client request ends after 15s; the longer lease also fences a crashed holder.
      until = this.now() + 30_000;
      const acquired = await this.store.write(this.key, { owner, until }, old?.version);
      if (!acquired) continue;
      version = acquired;
      break;
    }
    const stop = new AbortController();
    try {
      caller.throwIfAborted();
      if (this.now() + 16_000 > until) throw new ServiceError("unavailable", "The shared source slot could not be acquired in time. Retry.");
      return await read(AbortSignal.any([caller, stop.signal, AbortSignal.timeout(15_000)]));
    } finally {
      stop.abort();
      // Release only this revision; an expired holder cannot clear a replacement.
      await this.store.write(this.key, { owner: "", until: 0 }, version);
    }
  }
}
