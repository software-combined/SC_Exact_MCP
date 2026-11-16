import type { StateStore, Versioned } from "../domain/identity.js";
import { randomUUID } from "node:crypto";

/** Tests share this instance across replicas; production composition never imports it. */
export class MemoryStore implements StateStore {
  private records = new Map<string, Versioned<unknown>>();
  constructor(private now = () => Date.now()) {}
  async read<T>(key: string): Promise<Versioned<T> | undefined> {
    const row = this.records.get(key);
    if (!row || (row.expiresAt !== undefined && row.expiresAt <= this.now())) return undefined;
    return structuredClone(row) as Versioned<T>;
  }
  async write<T>(key: string, value: T, expected: string | undefined, expiresAt?: number): Promise<string | undefined> {
    const row = this.records.get(key);
    const current = row && (row.expiresAt === undefined || row.expiresAt > this.now()) ? row : undefined;
    if (current?.version !== expected) return undefined;
    const version = randomUUID();
    this.records.set(key, structuredClone({ value, version, expiresAt }));
    return version;
  }
  async remove(key: string, expected: string): Promise<boolean> {
    if (this.records.get(key)?.version !== expected) return false;
    return this.records.delete(key);
  }
}
