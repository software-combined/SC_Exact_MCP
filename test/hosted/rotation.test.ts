import { afterEach, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import { exactFixture as harness, USER_A, USER_B } from "./exact-fixture.js";
import { Connections } from "../../src/hosted/runtime/connections.js";
import type { Connection, Principal } from "../../src/hosted/domain/identity.js";
import type { Limits } from "../../src/hosted/runtime/budgets.js";

const active: Awaited<ReturnType<typeof harness>>[] = [];
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(active.splice(0).map((h) => h.close())); });
async function setup(limits?: Limits) {
  const h = await harness(undefined, limits); active.push(h); h.codes.set("fixture-code", USER_A);
  const connection = await h.connections.connect("fixture-code");
  const principal: Principal = { subject: connection.subject, generation: connection.generation, grantId: "fixture-grant", clientId: "claude" };
  async function expire(age = 570_000) {
    const key = h.connections.key(principal.subject); const old = (await h.store.read<Connection>(key))!;
    const tokens = await h.cipher.open(old.value.credentials, key);
    tokens.issuedAt = Date.now() - age; tokens.expiresAt = Date.now() + 20_000;
    await h.store.write(key, { ...old.value, expiresAt: tokens.expiresAt, credentials: await h.cipher.seal(tokens, key) }, old.version);
  }
  return { ...h, principal, expire };
}

describe("shared rotating source credentials", () => {
  it.each([false, true])("honors provider cooldown with issuance already completed=%s and never replays", async (issued) => {
    const h = await setup(); await h.expire();
    const observeCooldown = () => h.budgets.fetcher(async () => new Response("", { status: 429,
      headers: { "Retry-After": "120" } }))(`${h.exactOrigin}/api/v1/123456/crm/Accounts`);
    if (issued) {
      const exchange = h.source.exchange.bind(h.source);
      vi.spyOn(h.source, "exchange").mockImplementation(async (...args) => {
        const tokens = await exchange(...args); await observeCooldown(); return tokens;
      });
    } else await observeCooldown();
    const before = h.calls.length;
    await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: issued ? "reauth_required" : "limited" });
    const gate = await h.connections.gate.status();
    expect(Boolean(gate.uncertain)).toBe(issued); expect(Boolean(gate.attempt)).toBe(issued);
    if (issued) await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: "reauth_required" });
    else expect((await h.connections.authorize(h.principal)).status).toBe("active");
    expect(h.calls.length - before).toBe(issued ? 1 : 0);
  });
  it.each(["minute", "day"])("reserves the whole identity pair before code or refresh issuance at the last %s call", async (window) => {
    const h = await setup({ appCallsPerMinute: window === "minute" ? 3 : 1000, divisionCallsPerMinute: 1000,
      appCallsPerDay: window === "day" ? 3 : 1000, divisionCallsPerDay: 1000 });
    await h.expire(); h.codes.set("budget-code", USER_A);
    const before = h.calls.length;
    await expect(h.connections.connect("budget-code")).rejects.toMatchObject({ code: "limited" });
    await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: "limited" });
    expect(h.calls.length).toBe(before);
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
    expect((await h.connections.authorize(h.principal)).status).toBe("active");
    expect(h.refresh.size).toBe(1);
    await h.budgets.call(); // Rejected pairs did not consume the one remaining call.
    await expect(h.budgets.call()).rejects.toMatchObject({ code: "limited" });
  });
  it("discovers companies through the current division persisted by refresh", async () => {
    const h = await setup(); await h.expire();
    h.fake.currentDivision = 654321; h.fake.denyDivision = true;
    h.fake.responseOverride = { d: [{ Code: 654321, Description: "Fictional second company", Currency: "EUR" }] };
    const page = await h.accounting.read("company_discovery", {}, h.principal, new AbortController().signal);
    expect(page.rows).toEqual([{ division: 654321, name: "Fictional second company", currency: "EUR" }]);
    expect(h.calls.at(-1)?.path).toBe("/api/v1/654321/system/Divisions");
  });
  it("makes disconnect retry during refresh without fencing another person, then disconnects safely", async () => {
    const h = await setup(); h.codes.set("other-person", USER_B);
    const other = await h.connections.connect("other-person");
    const otherPrincipal = { ...h.principal, subject: other.subject, generation: other.generation };
    await h.expire(); h.fake.tokenDelay = 30;
    const started = once(h.exactServer, "request");
    const refresh = h.connections.access(h.principal);
    await started;
    const disconnect = await h.connections.disconnect(h.principal).then(() => "completed", (error) => error.code);
    await refresh;
    expect(disconnect).toBe("conflict");
    expect((await h.connections.gate.status()).uncertain).toBeUndefined();
    expect((await h.connections.authorize(otherPrincipal)).status).toBe("active");
    await h.connections.disconnect(h.principal);
    await expect(h.connections.active(h.principal.subject)).rejects.toMatchObject({ code: "reauth_required" });
    expect((await h.connections.authorize(otherPrincipal)).status).toBe("active");
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
  });
  it("replaces credentials for the same active canonical person without invalidating other client grants", async () => {
    const h = await setup(); const before = await h.connections.access(h.principal);
    h.codes.set("new-client-consent", USER_A);
    const replacement = await h.connections.connect("new-client-consent");
    expect(replacement.generation).toBe(h.principal.generation);
    expect((await h.connections.authorize(h.principal)).subject).toBe(replacement.subject);
    expect(await h.connections.access(h.principal)).not.toBe(before);
    expect(h.refresh.size).toBe(1);
  });
  it.each(["disconnect", "reauth"])("advances generation after %s instead of restoring old authority", async (reset) => {
    const h = await setup();
    if (reset === "disconnect") await h.connections.disconnect(h.principal);
    else {
      await h.expire(); h.fake.tokenStatus = 400;
      await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: "reauth_required" });
      h.fake.tokenStatus = 200;
    }
    const old = (await h.store.read<Connection>(h.connections.key(h.principal.subject)))!;
    h.codes.set("fresh-consent", USER_A);
    const fresh = await h.connections.connect("fresh-consent");
    expect(fresh.generation).toBe(old.value.generation + 1);
    await expect(h.connections.authorize(h.principal)).rejects.toMatchObject({ code: "denied" });
  });
  it.each(["connect", "refresh"])("renews and fences %s after slow preflight before allowing any issuance", async (operation) => {
    const h = await setup(); await h.expire(); h.codes.set("lease-code", USER_A); h.fake.tokenDelay = 30;
    const initial = Date.now(); vi.spyOn(Date, "now").mockReturnValue(initial);
    const write = h.store.write.bind(h.store);
    vi.spyOn(h.store, "write").mockImplementation(async (key, value, expected, expiry) => {
      const revision = await write(key, value, expected, expiry);
      if (key === h.connections.gate.key && value && typeof value === "object" && "until" in value && value.until === initial + 30_000) {
        vi.mocked(Date.now).mockReturnValue(initial + 20_000);
      }
      return revision;
    });
    const sourceStarted = once(h.exactServer, "request");
    const pending = operation === "connect" ? h.connections.connect("lease-code") : h.connections.access(h.principal);
    await sourceStarted;
    expect((await h.connections.gate.status()).until).toBe(initial + 80_000);
    vi.mocked(Date.now).mockReturnValue(initial + 31_000);
    await expect(h.connections.gate.reconcileExpired()).rejects.toMatchObject({ code: "conflict" });
    await pending;
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
  });
  it.each(["connect", "refresh"])("cancellation during delayed shared-state preflight prevents a new %s exchange", async (operation) => {
    const h = await setup(); await h.expire(); h.codes.set("cancelled-code", USER_A);
    let entered!: () => void; let resume!: () => void;
    const paused = new Promise<void>((resolve) => { entered = resolve; });
    const continued = new Promise<void>((resolve) => { resume = resolve; });
    const write = h.store.write.bind(h.store);
    vi.spyOn(h.store, "write").mockImplementation(async (key, value, expected, expiry) => {
      const version = await write(key, value, expected, expiry);
      if (key === h.connections.gate.key && value && typeof value === "object" && "attempt" in value) {
        entered(); await continued;
      }
      return version;
    });
    const before = h.calls.length; const caller = new AbortController();
    const pending = operation === "connect" ? h.connections.connect("cancelled-code", caller.signal) :
      h.connections.access(h.principal, caller.signal);
    const rejected = expect(pending).rejects.toThrow();
    await paused; caller.abort(); resume(); await rejected;
    expect(h.calls.length).toBe(before);
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
    await expect(h.connections.access(h.principal)).resolves.toMatch(/^fictional-a-/);
  });
  it("does not replay an ambiguous authorization-code exchange", async () => {
    const h = await setup();
    vi.spyOn(h.source, "exchange").mockRejectedValue(new Error("Fictional transport timeout"));
    await expect(h.connections.connect("unknown-code")).rejects.toMatchObject({ code: "reauth_required" });
    await expect(h.connections.connect("unknown-code")).rejects.toMatchObject({ code: "reauth_required" });
    expect(h.source.exchange).toHaveBeenCalledTimes(1);
  });
  it("serializes two replica refreshes and re-reads the persisted chain after the lease", async () => {
    const h = await setup(); await h.expire(); h.fake.tokenDelay = 30;
    const replica = new Connections(h.store, h.cipher, h.source);
    const before = h.calls.length;
    const results = await Promise.allSettled([h.connections.access(h.principal), replica.access(h.principal)]);
    expect(results.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((v) => v.status === "rejected")).toHaveLength(1);
    const first = results.find((v) => v.status === "fulfilled") as PromiseFulfilledResult<string>;
    expect(await replica.access(h.principal)).toBe(first.value);
    expect(h.calls.slice(before).filter((v) => v.path === "/api/oauth2/token")).toHaveLength(1);
    const restarted = new Connections(h.store, h.cipher, h.source);
    expect(await restarted.access(h.principal)).toBe(first.value);
  });

  it("holds before 570 seconds without rounding and allows the exact boundary", async () => {
    const h = await setup(); const now = Date.now(); vi.spyOn(Date, "now").mockReturnValue(now);
    await h.expire(569_999);
    const before = h.calls.length;
    await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: "limited" });
    expect(h.calls.length).toBe(before);
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
    vi.mocked(Date.now).mockReturnValue(now + 1);
    await expect(h.connections.access(h.principal)).resolves.toMatch(/^fictional-a-/);
  });

  it.each([400, 429])("a known code rejection %s does not break an existing person", async (status) => {
    const h = await setup(); const old = await h.connections.access(h.principal);
    h.fake.tokenStatus = status;
    await expect(h.connections.connect("expired-code")).rejects.toMatchObject({ code: status === 429 ? "limited" : "reauth_required" });
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
    expect(await h.connections.access(h.principal)).toBe(old);
  });

  it("releases the gate after a refresh quota rejection and permits a later request", async () => {
    const h = await setup(); await h.expire(); h.fake.tokenStatus = 429;
    const now = Date.now(); vi.spyOn(Date, "now").mockReturnValue(now);
    await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: "limited" });
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
    h.fake.tokenStatus = 200; vi.mocked(Date.now).mockReturnValue(now + 60_001);
    await expect(h.connections.access(h.principal)).resolves.toMatch(/^fictional-a-/);
  });

  it("invalid_grant affects only that person's connection", async () => {
    const h = await setup(); h.codes.set("other", USER_B);
    const other = await h.connections.connect("other");
    await h.expire(); h.fake.tokenStatus = 400;
    await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: "reauth_required" });
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
    expect((await h.connections.active(other.subject)).status).toBe("active");
    await expect(h.connections.active(h.principal.subject)).rejects.toMatchObject({ code: "reauth_required" });
  });

  it("persists rotation after the caller cancels and returns only the confirmed access token", async () => {
    const h = await setup(); await h.expire(); h.fake.tokenDelay = 30;
    const controller = new AbortController();
    const pending = h.accounting.read("customer_search", { division: 123456, name: "Fictional" }, h.principal, controller.signal);
    setTimeout(() => controller.abort(), 10);
    await expect(pending).rejects.toThrow();
    expect((await h.connections.gate.status()).attempt).toBeUndefined();
    const before = h.calls.length;
    expect(await new Connections(h.store, h.cipher, h.source).access(h.principal)).toMatch(/^fictional-a-/);
    expect(h.calls.length).toBe(before);
  });

  it("fails closed across restart when rotation persistence is uncertain and never replays the old refresh token", async () => {
    const h = await setup(); await h.expire();
    const write = h.store.write.bind(h.store);
    vi.spyOn(h.store, "write").mockImplementation(async (key, value, version, expiry) => {
      if (key === h.connections.key(h.principal.subject)) throw new Error("Fictional persistence outage");
      return write(key, value, version, expiry);
    });
    await expect(h.connections.access(h.principal)).rejects.toMatchObject({ code: "reauth_required" });
    const count = h.calls.filter((v) => v.path === "/api/oauth2/token").length;
    await expect(new Connections(h.store, h.cipher, h.source).access(h.principal)).rejects.toMatchObject({ code: "reauth_required" });
    expect(h.calls.filter((v) => v.path === "/api/oauth2/token")).toHaveLength(count);
  });

  it("keeps a crashed exchange visible and recovery fences every older credential chain", async () => {
    const h = await setup(); const now = Date.now(); vi.spyOn(Date, "now").mockReturnValue(now);
    await h.connections.gate.acquire(); vi.mocked(Date.now).mockReturnValue(now + 30_001);
    const restarted = new Connections(h.store, h.cipher, h.source);
    await expect(restarted.access(h.principal)).rejects.toMatchObject({ code: "reauth_required" });
    await restarted.gate.reconcileExpired();
    await expect(restarted.access(h.principal)).rejects.toMatchObject({ code: "reauth_required" });
    h.codes.set("reconnect", USER_A);
    const fresh = await restarted.connect("reconnect");
    expect(fresh.generation).toBe(h.principal.generation + 1);
    expect((await restarted.active(fresh.subject)).status).toBe("active");
  });
});
