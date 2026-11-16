import { describe, expect, it, vi } from "vitest";
import type { Region, StateStore } from "../../src/hosted/domain/identity.js";
import { ExactSource } from "../../src/hosted/exact/source.js";
import { SourceSlot } from "../../src/hosted/runtime/source-slot.js";
import { MemoryStore } from "../../src/hosted/storage/memory.js";
import { companyRow } from "./records.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function port(store: MemoryStore, reading = () => {}) : StateStore {
  return { read: (key) => { reading(); return store.read(key); },
    write: store.write.bind(store), remove: store.remove.bind(store) };
}
function source(store: StateStore, fetcher: typeof fetch, now?: () => number, region: Region = "nl") {
  const slot = new SourceSlot(store, "fictional-app", now);
  return new ExactSource({ appId: "fictional-app", appSecret: "fictional-secret", region,
    callback: "https://fixture.invalid/exact/callback" }, fetcher, undefined, (read, signal) => slot.run(read, signal));
}
const query = { operation: "company_discovery" as const, input: {} };
const body = JSON.stringify({ d: [companyRow] });

describe("shared sequential Exact REST requests", () => {
  it("holds the app slot after headers until the response body finishes across two stores, sources, and regions", async () => {
    const store = new MemoryStore();
    const started = deferred(); const contended = deferred();
    let finish!: () => void; let active = 0; let maximum = 0;
    const fetcher = vi.fn<typeof fetch>(async () => new Response(new ReadableStream({
      start(controller) {
        active++; maximum = Math.max(maximum, active);
        const complete = () => { controller.enqueue(new TextEncoder().encode(body)); controller.close(); active--; };
        if (fetcher.mock.calls.length === 1) { finish = complete; started.resolve(); } else complete();
      },
    })));
    const firstSource = source(port(store), fetcher);
    const secondSource = source(port(store, contended.resolve), fetcher, undefined, "be");
    const first = firstSource.read(query, 123456, "fictional-token", AbortSignal.timeout(1000));
    await started.promise;
    const second = secondSource.read(query, 123456, "fictional-token", AbortSignal.timeout(1000));
    await contended.promise;
    expect(fetcher).toHaveBeenCalledTimes(1); expect(active).toBe(1);
    finish();
    const pages = await Promise.all([first, second]);
    expect(pages.map((page) => page.rows)).toEqual([[companyRow], [companyRow]]);
    expect(fetcher).toHaveBeenCalledTimes(2); expect(maximum).toBe(1);
    expect(fetcher.mock.calls.map(([url]) => new URL(url.toString()).hostname)).toEqual(["start.exactonline.nl", "start.exactonline.be"]);
  });

  it("waits behind a crashed holder until cancellation, then recovers only after the longer lease expires", async () => {
    let now = 1000; const store = new MemoryStore(() => now); const contended = deferred();
    const key = "rest-slot:fictional-app";
    const crashed = (await store.write(key, { owner: "crashed-holder", until: now + 30_000 }, undefined))!;
    const fetcher = vi.fn<typeof fetch>(async () => new Response(body));
    const next = source(port(store, contended.resolve), fetcher, () => now);
    const cancel = new AbortController();
    const waiting = next.read(query, 123456, "fictional-token", cancel.signal);
    const rejected = expect(waiting).rejects.toThrow();
    await contended.promise; cancel.abort(); await rejected;
    expect(fetcher).not.toHaveBeenCalled();
    now += 30_001;
    expect((await next.read(query, 123456, "fictional-token", AbortSignal.timeout(1000))).rows).toEqual([companyRow]);
    const released = await store.read<{ until: number }>(key);
    expect(released?.value.until).toBe(0); expect(released?.version).not.toBe(crashed);
    expect(await store.write(key, { owner: "", until: 0 }, crashed)).toBeUndefined();
  });

  it("cancels an active response body before releasing the shared lease", async () => {
    const store = new MemoryStore(); const started = deferred(); let closed = false;
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => new Response(new ReadableStream({
      start(controller) {
        init!.signal!.addEventListener("abort", () => { closed = true; controller.error(init!.signal!.reason); }, { once: true });
        started.resolve();
      },
    })));
    const cancel = new AbortController();
    const request = source(port(store), fetcher).read(query, 123456, "fictional-token", cancel.signal);
    const rejected = expect(request).rejects.toThrow();
    await started.promise;
    expect((await store.read<{ until: number }>("rest-slot:fictional-app"))!.value.until).toBeGreaterThan(Date.now());
    cancel.abort(); await rejected;
    expect(closed).toBe(true);
    expect((await store.read<{ until: number }>("rest-slot:fictional-app"))?.value.until).toBe(0);
  });
});
