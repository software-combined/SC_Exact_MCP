import type { StateStore, Versioned } from "../domain/identity.js";
import { ServiceError } from "../domain/identity.js";

export async function update<T>(store: StateStore, key: string, change: (row: T | undefined) => T,
  expiresAt?: number): Promise<Versioned<T>> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const old = await store.read<T>(key);
    const value = change(old?.value);
    const version = await store.write(key, value, old?.version, expiresAt);
    if (version) {
      return { value, version, expiresAt };
    }
  }
  throw new ServiceError("conflict", "Shared state changed. Retry the request.", 409);
}

export async function take<T>(store: StateStore, key: string): Promise<T> {
  const row = await store.read<{ payload?: T; used?: boolean }>(key);
  if (!row?.value.payload || row.value.used || !await store.write(key, { used: true }, row.version, row.expiresAt) ||
    (row.expiresAt !== undefined && row.expiresAt <= Date.now())) {
    throw new ServiceError("denied", "This request expired or was already used.", 400);
  }
  return row.value.payload;
}
