import { generateKeyPairSync, privateDecrypt, publicEncrypt, constants } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { KeyVaultCipher, type KeyWrapper } from "../../src/hosted/storage/azure-keyvault.js";
import { environment } from "../../src/hosted/runtime/config.js";

const vault = "https://fictional-vault.vault.azure.net/keys/credentials/";
const v1 = `${vault}${"1".repeat(32)}`; const v2 = `${vault}${"2".repeat(32)}`;
const context = "connection:fixture-app:nl:user-a";
const tokens = { accessToken: "AAEA!fixture*access", refreshToken: "Gcp!IAAAAfixture", issuedAt: Date.now(), expiresAt: Date.now() + 600_000 };

/** A local RSA-OAEP-256 stand-in for one Key Vault key version per key ID. */
function fakeVault() {
  const pairs = new Map<string, ReturnType<typeof generateKeyPairSync<"pem", "pem">>>();
  const pair = (id: string) => pairs.get(id) ?? pairs.set(id, generateKeyPairSync("rsa", { modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } })).get(id)!;
  const oaep = (key: string) => ({ key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" });
  const wrapped: Uint8Array[] = []; const unwrapped: Uint8Array[] = [];
  const connect = vi.fn((id: string): KeyWrapper => ({
    wrapKey: (async (algorithm: string, key: Uint8Array) => {
      expect(algorithm).toBe("RSA-OAEP-256"); wrapped.push(key);
      return { result: publicEncrypt(oaep(pair(id).publicKey), key), algorithm, keyID: id };
    }) as KeyWrapper["wrapKey"],
    unwrapKey: (async (algorithm: string, key: Uint8Array) => {
      const result = privateDecrypt(oaep(pair(id).privateKey), key); unwrapped.push(result);
      return { result, algorithm, keyID: id };
    }) as KeyWrapper["unwrapKey"],
  }));
  return { connect, wrapped, unwrapped };
}

describe("Key Vault credential envelope", () => {
  it("round-trips tokens, clears data keys, and binds the ciphertext to the app and principal", async () => {
    const fake = fakeVault(); const cipher = new KeyVaultCipher(v1, "fixture-app", "", fake.connect);
    const envelope = await cipher.seal(tokens, context);
    expect(envelope).not.toContain(tokens.refreshToken);
    expect(JSON.parse(envelope).kid).toBe(v1);
    expect(await cipher.open(envelope, context)).toEqual(tokens);
    expect([...fake.wrapped, ...fake.unwrapped].every((key) => key.every((byte) => byte === 0))).toBe(true);
    await expect(cipher.open(envelope, "connection:fixture-app:nl:user-b")).rejects.toThrow();
    expect(fake.connect).toHaveBeenCalledTimes(1);
    await expect(new KeyVaultCipher(v1, "other-app", "", fake.connect).open(envelope, context)).rejects.toThrow();
    const changed = JSON.parse(envelope); changed.tag = Buffer.alloc(16).toString("base64");
    await expect(cipher.open(JSON.stringify(changed), context)).rejects.toThrow();
  });

  it("opens envelopes from an older key version after rotation, and refuses another key", async () => {
    const fake = fakeVault();
    const old = await new KeyVaultCipher(v1, "fixture-app", "", fake.connect).seal(tokens, context);
    const rotated = new KeyVaultCipher(v2, "fixture-app", "", fake.connect);
    expect(await rotated.open(old, context)).toEqual(tokens);
    expect(JSON.parse(await rotated.seal(tokens, context)).kid).toBe(v2);
    for (const kid of [`https://fictional-vault.vault.azure.net/keys/other/${"1".repeat(32)}`, `${vault}${"1".repeat(32)}/x`, vault]) {
      await expect(rotated.open(JSON.stringify({ ...JSON.parse(old), kid }), context)).rejects.toThrow(/this service's key/);
    }
  });

  it("refuses whitespace in tokens before calling Key Vault", async () => {
    const fake = fakeVault(); const cipher = new KeyVaultCipher(v1, "fixture-app", "", fake.connect);
    await expect(cipher.seal({ ...tokens, refreshToken: "Gcp fixture\r\n" }, context)).rejects.toThrow();
    expect(fake.connect).not.toHaveBeenCalled();
  });
});

describe("Azure runtime environment", () => {
  const values = { SCG_CLOUD: "azure", SCG_ENVIRONMENT: "production", SCG_ORIGIN: "https://exact-mcp.example.com",
    AZURE_CLIENT_ID: "00000000-0000-4000-8000-000000000000", SCG_TABLE_ENDPOINT: "https://fictional.table.core.windows.net",
    SCG_TABLE_NAME: "state", SCG_KEY_ID: v1, SCG_CONFIG_SECRET_URL: "https://fictional-vault.vault.azure.net/secrets/runtime-config",
    SCG_EXACT_APP_ID: "fictional-app", SCG_APP_CALLS_PER_MINUTE: "30", SCG_DIVISION_CALLS_PER_MINUTE: "10",
    SCG_APP_CALLS_PER_DAY: "500", SCG_DIVISION_CALLS_PER_DAY: "200" };
  it("requires the Azure settings only when SCG_CLOUD is azure", () => {
    const env = environment(values);
    expect(env).toMatchObject({ SCG_CLOUD: "azure", SCG_TABLE_NAME: "state", PORT: 8080, SCG_APP_CALLS_PER_MINUTE: 30 });
    expect(() => environment({ ...values, SCG_KEY_ID: `${vault}` })).toThrow();
    expect(() => environment({ ...values, SCG_KEY_ID: `${v1}?x=1` })).toThrow();
    expect(() => environment({ ...values, SCG_CONFIG_SECRET_URL: "https://fictional-vault.vault.azure.net/secrets/runtime-config?x=1" })).toThrow();
    expect(() => environment({ ...values, SCG_TABLE_ENDPOINT: "http://fictional.table.core.windows.net" })).toThrow();
    expect(() => environment({ ...values, AZURE_CLIENT_ID: "not-a-guid" })).toThrow();
    expect(() => environment({ ...values, SCG_APP_CALLS_PER_DAY: "7" })).toThrow();
    expect(() => environment({ ...values, SCG_CLOUD: "gcp" })).toThrow();
    expect(() => environment({ ...values, SCG_CLOUD: undefined })).toThrow(); // AWS is the default and needs its own settings.
  });
});
