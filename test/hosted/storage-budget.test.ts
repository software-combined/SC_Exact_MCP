import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { KmsCipher } from "../../src/hosted/storage/kms.js";
import { MemoryStore } from "../../src/hosted/storage/memory.js";
import { Budgets } from "../../src/hosted/runtime/budgets.js";

afterEach(() => vi.restoreAllMocks());
const limits = { appCallsPerMinute: 10, divisionCallsPerMinute: 5, appCallsPerDay: 20, divisionCallsPerDay: 10 };

describe("state and call controls", () => {
  it("keeps the quarter-sized daily sign-in cap after the minute window resets", async () => {
    let now = 1_000_000; const store = new MemoryStore(() => now);
    const caps = { ...limits, appCallsPerMinute: 64, appCallsPerDay: 16 };
    const a = new Budgets(store, "fixture-app", caps, () => now).signIns();
    const b = new Budgets(store, "fixture-app", caps, () => now).signIns();
    await a.call(undefined, 2, now + 45_000); await b.call(undefined, 2, now + 45_000);
    now += 60_001;
    await expect(b.call(undefined, 2, now + 45_000)).rejects.toMatchObject({ code: "limited" });
  });
  it("bounds shared public sign-ins to a quarter pool while preserving the normal source budget", async () => {
    const store = new MemoryStore(); const caps = { ...limits, appCallsPerMinute: 16, appCallsPerDay: 16 };
    const a = new Budgets(store, "fixture-app", caps); const b = new Budgets(store, "fixture-app", caps);
    await a.signIns().call(undefined, 2, Date.now() + 45_000);
    await b.signIns().call(undefined, 2, Date.now() + 45_000);
    await expect(a.signIns().call(undefined, 2, Date.now() + 45_000)).rejects.toMatchObject({ code: "limited" });
    await expect(b.call(undefined, 12)).resolves.toBeUndefined();
    expect(() => new Budgets(store, "fixture-app", { ...caps, appCallsPerMinute: 7 }).signIns()).toThrow(/at least eight/);
    expect(() => new Budgets(store, "fixture-app", { ...caps, appCallsPerDay: 7 }).signIns()).toThrow(/at least eight/);
  });
  it.each([60_000, 86_400_000])("reserves reachable windows across a %i-ms boundary without counting twice", async (window) => {
    let now = window - 10_000; const store = new MemoryStore(() => now);
    const caps = { ...limits, appCallsPerMinute: 3, appCallsPerDay: 3 };
    const a = new Budgets(store, "fixture-app", caps, () => now); const b = new Budgets(store, "fixture-app", caps, () => now);
    const upstream = vi.fn<typeof fetch>(async () => new Response(""));
    const pair = await a.exchangeFetcher(upstream); now = window + 1;
    await b.call(); await expect(b.call()).rejects.toMatchObject({ code: "limited" });
    const results = await Promise.allSettled([pair("https://fixture.invalid/api/oauth2/token"),
      pair("https://fixture.invalid/api/v1/current/Me"), pair("https://fixture.invalid/api/v1/current/Me")]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled", "rejected"]);
    expect((results[2] as PromiseRejectedResult).reason).toMatchObject({ code: "unavailable" });
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it("expires unused pair admission before issuance and honors a later provider cooldown", async () => {
    let now = 1_000_000; const store = new MemoryStore(() => now);
    const a = new Budgets(store, "fixture-app", limits, () => now); const b = new Budgets(store, "fixture-app", limits, () => now);
    const upstream = vi.fn<typeof fetch>(async () => new Response("")); const expired = await a.exchangeFetcher(upstream);
    now += 30_001; await expect(expired("https://fixture.invalid/api/oauth2/token")).rejects.toMatchObject({ code: "limited" });
    expect(upstream).not.toHaveBeenCalled();
    const pair = await a.exchangeFetcher(upstream); await pair("https://fixture.invalid/api/oauth2/token");
    await b.fetcher(async () => new Response("", { status: 429, headers: { "Retry-After": "120" } }))("https://fixture.invalid/api/v1/123456/crm/Accounts");
    await expect(pair("https://fixture.invalid/api/v1/current/Me")).rejects.toMatchObject({ code: "limited" });
    expect(upstream).toHaveBeenCalledTimes(1); await expect(b.call()).rejects.toMatchObject({ code: "limited" });
  });
  it("keeps the two-request person limit shared across clients and replicas", async () => {
    const store = new MemoryStore(); const a = new Budgets(store, "fixture-app", limits); const b = new Budgets(store, "fixture-app", limits);
    const releaseA = await a.person("nl:fixture-user"); const releaseB = await b.person("nl:fixture-user");
    await expect(a.person("nl:fixture-user")).rejects.toMatchObject({ code: "limited" });
    const other = await a.person("nl:other-user");
    await releaseA(); const again = await b.person("nl:fixture-user");
    await Promise.all([releaseB(), other(), again()]);
  });
  it("retains daily division counts across minute windows and replicas", async () => {
    let now = 1_000_000; const store = new MemoryStore(() => now);
    const a = new Budgets(store, "fixture-app", { ...limits, divisionCallsPerDay: 1 }, () => now);
    const b = new Budgets(store, "fixture-app", { ...limits, divisionCallsPerDay: 1 }, () => now);
    await a.call("123456"); now += 60_001;
    await expect(b.call("123456")).rejects.toMatchObject({ code: "limited" });
    await expect(b.call("654321")).resolves.toBeUndefined();
  });
  it("does not spend other divisions' app allowance on rejected reservations, including concurrent attempts", async () => {
    const store = new MemoryStore();
    const maximum = { appCallsPerMinute: 2, divisionCallsPerMinute: 1, appCallsPerDay: 2, divisionCallsPerDay: 1 };
    const a = new Budgets(store, "fixture-app", maximum); const b = new Budgets(store, "fixture-app", maximum);
    await a.call("123456");
    const rejected = await Promise.allSettled([a.call("123456"), b.call("123456"), a.call("123456")]);
    expect(rejected.every((result) => result.status === "rejected")).toBe(true);
    await expect(b.call("654321")).resolves.toBeUndefined();
    await expect(a.call("111111")).rejects.toMatchObject({ code: "limited" });
  });
  it("honors shared Retry-After and does not call the source during cooldown", async () => {
    let now = 1_000_000; const store = new MemoryStore(() => now);
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 429, headers: { "Retry-After": "120" } }));
    const a = new Budgets(store, "fixture-app", limits, () => now).fetcher(upstream);
    const b = new Budgets(store, "fixture-app", limits, () => now).fetcher(upstream);
    await a("https://start.exactonline.nl/api/v1/123456/crm/Accounts"); now += 60_001;
    await expect(b("https://start.exactonline.nl/api/v1/123456/crm/Accounts")).rejects.toMatchObject({ code: "limited" });
    expect(upstream).toHaveBeenCalledTimes(1); now += 60_000;
    await b("https://start.exactonline.nl/api/v1/123456/crm/Accounts"); expect(upstream).toHaveBeenCalledTimes(2);
  });
  it("cannot shorten a longer cooldown when two in-flight responses arrive with different Retry-After values", async () => {
    let now = 1_000_000; const store = new MemoryStore(() => now);
    const replies: ((response: Response) => void)[] = []; let started!: () => void;
    const bothStarted = new Promise<void>((resolve) => { started = resolve; });
    const upstream = vi.fn<typeof fetch>(() => new Promise<Response>((resolve) => {
      replies.push(resolve); if (replies.length === 2) started();
    }));
    const a = new Budgets(store, "fixture-app", limits, () => now);
    const b = new Budgets(store, "fixture-app", limits, () => now);
    const first = a.fetcher(upstream)("https://start.exactonline.nl/api/v1/123456/crm/Accounts");
    const second = b.fetcher(upstream)("https://start.exactonline.nl/api/v1/123456/crm/Accounts");
    await bothStarted;
    replies[0](new Response("", { status: 429, headers: { "Retry-After": "120" } })); await first;
    replies[1](new Response("", { status: 429, headers: { "Retry-After": "1" } })); await second;
    now += 60_001;
    await expect(b.call("123456")).rejects.toMatchObject({ code: "limited" });
    now += 60_000; await expect(b.call("123456")).resolves.toBeUndefined();
  });
});

describe("KMS credential envelope", () => {
  it("clears a returned data key when KMS omits its wrapped counterpart", async () => {
    const plaintextKey = randomBytes(32);
    vi.spyOn(KMSClient.prototype, "send").mockResolvedValue({ Plaintext: plaintextKey });
    const cipher = new KmsCipher("fictional-key-reference", "fixture-app", "eu-west-1");
    await expect(cipher.seal({ accessToken: "fictional-a", refreshToken: "fictional-r",
      issuedAt: Date.now(), expiresAt: Date.now() + 600_000 }, "connection:fixture-app:nl:user-a")).rejects.toThrow(/no encryption key/);
    expect(plaintextKey).toEqual(Buffer.alloc(32));
  });
  it("encrypts long tokens beyond KMS direct-encryption size and binds the data key and ciphertext to the principal", async () => {
    const key = randomBytes(32); const contexts: unknown[] = [];
    vi.spyOn(KMSClient.prototype, "send").mockImplementation(async (command: unknown) => {
      if (command instanceof GenerateDataKeyCommand) {
        contexts.push(command.input.EncryptionContext);
        return { Plaintext: Buffer.from(key), CiphertextBlob: Buffer.from("fictional-kms-wrapped-key") };
      }
      if (command instanceof DecryptCommand) {
        contexts.push(command.input.EncryptionContext);
        if (command.input.EncryptionContext?.principal !== "connection:fixture-app:nl:user-a") throw new Error("KMS context denied.");
        return { Plaintext: Buffer.from(key) };
      }
      throw new Error("Unexpected KMS operation.");
    });
    const cipher = new KmsCipher("fictional-key-reference", "fixture-app", "eu-west-1");
    const tokens = { accessToken: "a".repeat(16_384), refreshToken: "r".repeat(16_384), expiresAt: Date.now() + 600_000, issuedAt: Date.now() };
    const context = "connection:fixture-app:nl:user-a";
    const envelope = await cipher.seal(tokens, context);
    expect(envelope).not.toContain(tokens.refreshToken);
    expect(await cipher.open(envelope, context)).toEqual(tokens);
    await expect(cipher.open(envelope, "connection:fixture-app:nl:user-b")).rejects.toThrow(/context denied/);
    expect(contexts[0]).toEqual({ app: "fixture-app", principal: context });
    const changed = JSON.parse(envelope); changed.tag = Buffer.alloc(16).toString("base64");
    await expect(cipher.open(JSON.stringify(changed), context)).rejects.toThrow();
  });
});

