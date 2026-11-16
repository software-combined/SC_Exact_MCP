import type { Adapter, AdapterPayload, AdapterConstructor } from "oidc-provider";
import type { StateStore } from "../domain/identity.js";
import { update } from "../storage/state.js";

export function providerAdapter(store: StateStore): AdapterConstructor {
  return class SharedAdapter implements Adapter {
    constructor(private model: string) {}
    private key(id: string) { return `oidc:${this.model}:${id}`; }
    async upsert(id: string, payload: AdapterPayload, expiresIn?: number) {
      const expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : undefined;
      await update<AdapterPayload>(store, this.key(id), (old) => ({ ...payload,
        ...(old?.consumed ? { consumed: old.consumed } : {}) }), expiresAt);
      for (const field of ["uid", "userCode"] as const) {
        if (payload[field]) await update(store, `oidc-index:${this.model}:${field}:${payload[field]}`, () => id, expiresAt);
      }
    }
    async find(id: string) {
      const row = await store.read<AdapterPayload>(this.key(id));
      if (row?.value.grantId && await store.read(`oidc-revoked:${row.value.grantId}`)) return undefined;
      if (this.model === "Grant" && await store.read(`oidc-revoked:${id}`)) return undefined;
      return row?.value;
    }
    private async by(field: string, value: string) {
      const index = await store.read<string>(`oidc-index:${this.model}:${field}:${value}`);
      return index ? this.find(index.value) : undefined;
    }
    findByUid(uid: string) { return this.by("uid", uid); }
    findByUserCode(code: string) { return this.by("userCode", code); }
    async consume(id: string) {
      const row = await store.read<AdapterPayload>(this.key(id));
      if (!row || row.value.consumed || !await store.write(this.key(id), {
        ...row.value, consumed: Math.floor(Date.now() / 1000) }, row.version, row.expiresAt)) {
        throw new Error("OAuth artifact was already consumed or expired.");
      }
    }
    async destroy(id: string) {
      const row = await store.read(this.key(id));
      if (row) await store.remove(this.key(id), row.version);
    }
    async revokeByGrantId(id: string) {
      await update(store, `oidc-revoked:${id}`, () => true, Date.now() + 31 * 86_400_000);
    }
  };
}
