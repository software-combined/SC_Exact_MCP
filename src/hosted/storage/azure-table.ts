import { TableClient } from "@azure/data-tables";
import { ManagedIdentityCredential } from "@azure/identity";
import type { StateStore, Versioned } from "../domain/identity.js";
import { awsRequest as bounded } from "./aws.js";

/** The TableClient calls this adapter makes; tests supply a fake. */
export type TableEntities = Pick<TableClient, "getEntity" | "createEntity" | "updateEntity" | "deleteEntity">;
type Row = Record<string, unknown> & { etag: string; expiresAt?: number };

// A string property holds at most 32K UTF-16 characters, so long values span v0, v1, ... in one entity (1 MiB).
const chunk = 30_000;
// A 404 can also mean the whole table is missing; that is a storage fault, never "no row" or a lost race.
const status = (error: unknown) => {
  const e = error as { statusCode?: number; code?: string } | undefined;
  if (e?.code === "TableNotFound") throw error;
  return e?.statusCode;
};
// Table keys forbid "/", "\", "#", "?" and control characters, so each state key is its own base64url partition.
const partition = (key: string) => Buffer.from(key).toString("base64url");
const expired = (row: Row) => row.expiresAt !== undefined && row.expiresAt <= Date.now();

/**
 * Azure Table Storage state. The entity ETag is the opaque version: the service changes it on every write,
 * and every write is conditional on it (If-Match), or on absence (insert), so a stale version never succeeds.
 * ponytail: Table Storage has no TTL, so expired rows stay until the same key is written again;
 * add a scheduled sweep when table size or cost becomes noticeable.
 */
export class AzureTableStore implements StateStore {
  private client: TableEntities;
  constructor(endpoint: string, table: string, clientId: string, client?: TableEntities) {
    // No SDK retries: every call is bounded to 3 seconds, as on AWS.
    this.client = client ?? new TableClient(endpoint, table, new ManagedIdentityCredential({ clientId }),
      { retryOptions: { maxRetries: 0 } });
  }
  private async row(key: string): Promise<Row | undefined> {
    try {
      return await bounded((signal) => this.client.getEntity(partition(key), "", { abortSignal: signal })) as Row;
    } catch (error) {
      if (status(error) === 404) return undefined;
      throw error;
    }
  }
  async read<T>(key: string): Promise<Versioned<T> | undefined> {
    const row = await this.row(key);
    if (!row || expired(row)) return undefined;
    let text = "";
    for (let i = 0; typeof row[`v${i}`] === "string"; i++) text += row[`v${i}`];
    return { value: JSON.parse(text) as T, version: row.etag, expiresAt: row.expiresAt };
  }
  async write<T>(key: string, value: T, expected: string | undefined, expiresAt?: number): Promise<string | undefined> {
    // Same rule as DynamoDB: no expectation needs an absent or expired row; an expectation needs that live version.
    // The conditional write below fails if the row changed after this read, so its expiry is the one checked here.
    const row = await this.row(key);
    const live = row && !expired(row) ? row : undefined;
    if (live?.etag !== expected) return undefined;
    // ASCII-only JSON, so a chunk boundary never splits a UTF-16 surrogate pair.
    const text = JSON.stringify(value).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
    const entity: Record<string, unknown> & { partitionKey: string; rowKey: string } = { partitionKey: partition(key), rowKey: "",
      ...(expiresAt === undefined ? {} : { expiresAt }) };
    for (let i = 0; i === 0 || i * chunk < text.length; i++) entity[`v${i}`] = text.slice(i * chunk, (i + 1) * chunk);
    try {
      const { etag } = await bounded((signal) => row
        ? this.client.updateEntity(entity, "Replace", { etag: row.etag, abortSignal: signal })
        : this.client.createEntity(entity, { abortSignal: signal }));
      if (!etag) throw new Error("Table Storage returned no ETag.");
      return etag;
    } catch (error) {
      if ([404, 409, 412].includes(status(error) ?? 0)) return undefined;
      throw error;
    }
  }
  async remove(key: string, expected: string): Promise<boolean> {
    if (!expected) return false; // The SDK treats a missing ETag as "*", an unconditional delete.
    try {
      await bounded((signal) => this.client.deleteEntity(partition(key), "", { etag: expected, abortSignal: signal }));
      return true;
    } catch (error) {
      if ([404, 412].includes(status(error) ?? 0)) return false;
      throw error;
    }
  }
}
