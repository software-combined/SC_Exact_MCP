import { randomBytes } from "node:crypto";
import { ManagedIdentityCredential } from "@azure/identity";
import { CryptographyClient } from "@azure/keyvault-keys";
import { SecretClient, parseKeyVaultSecretIdentifier } from "@azure/keyvault-secrets";
import { z } from "zod";
import type { CredentialCipher, SourceTokens } from "../domain/identity.js";
import { awsRequest as bounded } from "./aws.js";
import { openWithKey, sealWithKey, sealedFields, sourceTokens } from "./envelope.js";

// No SDK retries: every call is bounded to 3 seconds, as on AWS.
const options = { retryOptions: { maxRetries: 0 } };
/** The Key Vault key operations this adapter uses; tests supply a fake. */
export type KeyWrapper = Pick<CryptographyClient, "wrapKey" | "unwrapKey">;

/** Reads the private runtime configuration from a Key Vault secret. */
export async function readSecret(url: string, clientId: string): Promise<string | undefined> {
  const { vaultUrl, name, version } = parseKeyVaultSecretIdentifier(url);
  const client = new SecretClient(vaultUrl, new ManagedIdentityCredential({ clientId }), options);
  return (await bounded((signal) => client.getSecret(name, { version, abortSignal: signal }))).value;
}

/**
 * Envelope encryption: a fresh local AES-256 data key per seal, wrapped by a Key Vault RSA key (RSA-OAEP-256).
 * The AES-GCM additional data binds the ciphertext to the app and the principal context.
 * Each envelope records the versioned key ID that wrapped it, so key rotation never strands saved tokens.
 */
export class KeyVaultCipher implements CredentialCipher {
  private clients = new Map<string, KeyWrapper>();
  private connect: (keyId: string) => KeyWrapper;
  private base: string;
  constructor(private keyId: string, private app: string, clientId: string, connect?: (keyId: string) => KeyWrapper) {
    this.base = keyId.slice(0, keyId.lastIndexOf("/") + 1);
    if (connect) this.connect = connect;
    else {
      const credential = new ManagedIdentityCredential({ clientId });
      this.connect = (id) => new CryptographyClient(id, credential, options);
    }
  }
  private wrapper(keyId: string): KeyWrapper {
    let client = this.clients.get(keyId);
    if (!client) this.clients.set(keyId, client = this.connect(keyId));
    return client;
  }
  private aad(context: string) { return Buffer.from(JSON.stringify([this.app, context])); }
  async seal(value: SourceTokens, context: string): Promise<string> {
    const validated = sourceTokens.parse(value);
    const dataKey = randomBytes(32);
    let plaintext: Buffer | undefined;
    try {
      const { result } = await bounded((signal) => this.wrapper(this.keyId).wrapKey("RSA-OAEP-256", dataKey, { abortSignal: signal }));
      plaintext = Buffer.from(JSON.stringify(validated));
      return JSON.stringify({ kid: this.keyId, key: Buffer.from(result).toString("base64"),
        ...sealWithKey(dataKey, this.aad(context), plaintext) });
    } finally { plaintext?.fill(0); dataKey.fill(0); }
  }
  async open(value: string, context: string): Promise<SourceTokens> {
    const envelope = z.strictObject({ kid: z.string().max(512), key: z.string().max(2048), ...sealedFields }).parse(JSON.parse(value));
    if (!envelope.kid.startsWith(this.base) || !/^[0-9a-f]{32}$/.test(envelope.kid.slice(this.base.length))) {
      throw new Error("The envelope was not sealed with this service's key.");
    }
    const { result } = await bounded((signal) => this.wrapper(envelope.kid).unwrapKey("RSA-OAEP-256",
      Buffer.from(envelope.key, "base64"), { abortSignal: signal }));
    let decoded: Buffer | undefined;
    try {
      decoded = openWithKey(result, this.aad(context), envelope);
      return sourceTokens.parse(JSON.parse(decoded.toString("utf8")));
    } finally { result.fill(0); decoded?.fill(0); }
  }
}
