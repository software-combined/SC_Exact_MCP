import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TableClient } from "@azure/data-tables";
import { AzureTableStore, type TableEntities } from "../../src/hosted/storage/azure-table.js";
import { take, update } from "../../src/hosted/storage/state.js";
import type { StateStore } from "../../src/hosted/domain/identity.js";

afterEach(() => vi.restoreAllMocks());
const failure = (statusCode: number) => Object.assign(new Error(`fictional ${statusCode}`), { statusCode });

/** In-memory Table Storage: insert conflicts, If-Match updates and deletes, and a new ETag on every write. */
function fakeTable() {
  const rows = new Map<string, Record<string, unknown>>(); let next = 0; const tick = () => new Promise((r) => setImmediate(r));
  const id = (pk: string, rk: string) => `${pk}|${rk}`;
  const entity = (value: Record<string, unknown>) => {
    if (Object.values(value).some((v) => typeof v === "string" && (v.length > 32_768 || /[\ud800-\udfff]/.test(v)))) throw failure(400);
    return { ...value, etag: `W/"fictional-${++next}"` };
  };
  const client = {
    async getEntity(pk: string, rk: string) { await tick(); const row = rows.get(id(pk, rk)); if (!row) throw failure(404); return { ...row }; },
    async createEntity(value: { partitionKey: string; rowKey: string }) {
      await tick(); const key = id(value.partitionKey, value.rowKey); if (rows.has(key)) throw failure(409);
      const row = entity(value); rows.set(key, row); return { etag: row.etag };
    },
    async updateEntity(value: { partitionKey: string; rowKey: string }, mode: string, options: { etag?: string }) {
      await tick(); const key = id(value.partitionKey, value.rowKey); const old = rows.get(key);
      if (mode !== "Replace" || !options.etag) throw new Error("Only conditional replace is expected.");
      if (!old) throw failure(404); if (old.etag !== options.etag) throw failure(412);
      const row = entity(value); rows.set(key, row); return { etag: row.etag };
    },
    async deleteEntity(pk: string, rk: string, options: { etag?: string }) {
      await tick(); const old = rows.get(id(pk, rk)); if (!options.etag) throw new Error("Only conditional delete is expected.");
      if (!old) throw failure(404); if (old.etag !== options.etag) throw failure(412);
      rows.delete(id(pk, rk)); return {};
    },
  };
  return { rows, client: client as unknown as TableEntities };
}

/** The DynamoStore conditional-expiry contract, run against two adapters sharing one table. */
async function contract(a: StateStore, b: StateStore, advance: (ms: number) => number) {
  let now = advance(0);
  const first = (await a.write("expiring", { payload: "fictional-code" }, undefined, now + 1000))!;
  expect(await b.write("expiring", { payload: "duplicate" }, undefined, now + 1000)).toBeUndefined();
  const row = (await b.read<{ payload: string }>("expiring"))!;
  expect(row).toEqual({ value: { payload: "fictional-code" }, version: first, expiresAt: now + 1000 });
  now = advance(1001);
  expect(await b.read("expiring")).toBeUndefined();
  expect(await b.write("expiring", { used: true }, row.version, row.expiresAt)).toBeUndefined();
  const replaced = (await a.write("expiring", { payload: "replacement" }, undefined, now + 10_000))!;
  expect(replaced).not.toBe(row.version);
  expect(await b.write("expiring", { payload: "stale" }, row.version, now + 10_000)).toBeUndefined();
  expect(await b.remove("expiring", row.version)).toBe(false);
  expect((await a.read("expiring"))?.value).toEqual({ payload: "replacement" });
  const permanent = (await a.write("expiring", { payload: "kept" }, replaced))!;
  expect(await a.read("expiring")).toEqual({ value: { payload: "kept" }, version: permanent, expiresAt: undefined });
  expect(await a.write("expiring", { payload: "lost" }, replaced)).toBeUndefined();
  expect(await b.remove("expiring", permanent)).toBe(true);
  expect(await a.read("expiring")).toBeUndefined();
  expect(await a.remove("expiring", permanent)).toBe(false);
  expect(await a.write("expiring", { payload: "again" }, undefined)).not.toBe(permanent);

  await a.write("take-expiring", { payload: "fictional-consent" }, undefined, now + 1000);
  const slow: StateStore = { read: b.read.bind(b), remove: b.remove.bind(b),
    write: async (...args) => { now = advance(1001); return b.write(...args); } };
  await expect(take(slow, "take-expiring")).rejects.toMatchObject({ code: "denied" });
  await a.write("one-use", { payload: "fictional-cursor" }, undefined, now + 10_000);
  const outcomes = await Promise.allSettled([take(a, "one-use"), take(b, "one-use")]);
  expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  await Promise.all(Array.from({ length: 6 }, (_, i) => update<number>(i % 2 ? a : b, "counter", (n) => (n ?? 0) + 1)));
  expect((await a.read("counter"))?.value).toBe(6);
}

describe("Azure Table Storage state", () => {
  it("matches the DynamoDB conditional-expiry contract", async () => {
    let now = 1_800_000_000_000; vi.spyOn(Date, "now").mockImplementation(() => now);
    const table = fakeTable();
    const a = new AzureTableStore("https://fictional.invalid", "state", "", table.client);
    const b = new AzureTableStore("https://fictional.invalid", "state", "", table.client);
    await contract(a, b, (ms) => (now += ms));
  });

  it("stores keys as safe partition keys and splits long values within the property limit", async () => {
    const table = fakeTable(); const store = new AzureTableStore("https://fictional.invalid", "state", "", table.client);
    const key = "oidc:Grant/fictional#id?x\\y"; const value = { blob: "x".repeat(29_999) + "😀".repeat(20_000), text: "é ü \u0000" };
    const version = (await store.write(key, value, undefined))!;
    expect([...table.rows.keys()]).toEqual([`${Buffer.from(key).toString("base64url")}|`]);
    expect((await store.read(key))?.value).toEqual(value);
    await store.write(key, { short: true }, version);
    const row = [...table.rows.values()][0];
    expect(Object.keys(row).filter((name) => /^v\d+$/.test(name))).toEqual(["v0"]);
    expect((await store.read(key))?.value).toEqual({ short: true });
  });

  it("surfaces a missing table as an error, not as an absent row or a lost race", async () => {
    const gone = Object.assign(new Error("fictional table missing"), { statusCode: 404, code: "TableNotFound" });
    const client = { getEntity: async () => { throw gone; }, createEntity: async () => { throw gone; },
      updateEntity: async () => { throw gone; }, deleteEntity: async () => { throw gone; } } as unknown as TableEntities;
    const store = new AzureTableStore("https://fictional.invalid", "state", "", client);
    await expect(store.read("k")).rejects.toThrow(/table missing/);
    await expect(store.write("k", { v: 1 }, undefined)).rejects.toThrow(/table missing/);
    await expect(store.remove("k", "W/\"x\"")).rejects.toThrow(/table missing/);
  });

  it("never sends an unconditional delete and surfaces unexpected service errors", async () => {
    const table = fakeTable(); const store = new AzureTableStore("https://fictional.invalid", "state", "", table.client);
    await store.write("k", { v: 1 }, undefined);
    expect(await store.remove("k", "")).toBe(false);
    expect(table.rows.size).toBe(1);
    vi.spyOn(table.client, "getEntity").mockRejectedValue(failure(403));
    await expect(store.read("k")).rejects.toMatchObject({ statusCode: 403 });
  });
});

const azurite = process.env.SCG_AZURITE_ENDPOINT;
if (azurite && azurite !== "http://127.0.0.1:10002/devstoreaccount1") throw new Error("Only the default local Azurite endpoint is allowed.");

describe.runIf(Boolean(azurite))("actual Azurite conditional expiry", () => {
  it("matches the DynamoDB conditional-expiry contract", async () => {
    const name = `scgexpiry${randomBytes(6).toString("hex")}`;
    const local = () => TableClient.fromConnectionString("UseDevelopmentStorage=true", name, { retryOptions: { maxRetries: 0 } });
    const admin = local(); await admin.createTable();
    try {
      let now = Date.now(); vi.spyOn(Date, "now").mockImplementation(() => now);
      const a = new AzureTableStore("", name, "", local()); const b = new AzureTableStore("", name, "", local());
      await contract(a, b, (ms) => (now += ms));
    } finally { vi.restoreAllMocks(); await admin.deleteTable(); }
  });
});
