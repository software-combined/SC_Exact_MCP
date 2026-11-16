import { afterEach, expect, it, vi } from "vitest";
import { MemoryStore } from "../../src/hosted/storage/memory.js";
import { take } from "../../src/hosted/storage/state.js";
import type { StateStore } from "../../src/hosted/domain/identity.js";

afterEach(() => vi.restoreAllMocks());
it("fences stale writes and deletes after an expired record is replaced", async () => {
  let now = Date.now(); vi.spyOn(Date, "now").mockImplementation(() => now);
  const store = new MemoryStore();
  const old = (await store.write("replace", { payload: "old" }, undefined, now + 1000))!;
  now += 1001;
  const replacement = await store.write("replace", { payload: "new" }, undefined, now + 10_000);
  expect(replacement).not.toBe(old);
  expect(await store.write("replace", { payload: "stale" }, old, now + 10_000)).toBeUndefined();
  expect(await store.remove("replace", old)).toBe(false);
  expect((await store.read("replace"))?.value).toEqual({ payload: "new" });
});
it("does not release a one-use payload when expiry passes during a successful remote write", async () => {
  let now = Date.now(); vi.spyOn(Date, "now").mockImplementation(() => now);
  const store = new MemoryStore();
  await store.write("one-use", { payload: "fictional-consent" }, undefined, now + 1000);
  const slow: StateStore = { read: store.read.bind(store), remove: store.remove.bind(store),
    write: async (...args) => { const written = await store.write(...args); now += 1001; return written; } };
  await expect(take(slow, "one-use")).rejects.toMatchObject({ code: "denied" });
  await expect(take(store, "one-use")).rejects.toMatchObject({ code: "denied" });
});
