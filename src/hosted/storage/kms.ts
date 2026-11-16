import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import type { CredentialCipher, SourceTokens } from "../domain/identity.js";
import { awsClientOptions, awsRequest } from "./aws.js";

const opaque = z.string().min(1).max(16_384).regex(/^[A-Za-z0-9._~+\/=\-]+$/);
const tokens = z.strictObject({ accessToken: opaque,
  refreshToken: opaque, expiresAt: z.number().finite().positive(), issuedAt: z.number().finite().positive() });

export class KmsCipher implements CredentialCipher {
  private client: KMSClient;
  constructor(private keyId: string, private app: string, region: string) {
    this.client = new KMSClient({ region, ...awsClientOptions });
  }
  async seal(value: SourceTokens, context: string): Promise<string> {
    const validated = tokens.parse(value);
    const { Plaintext, CiphertextBlob } = await awsRequest((signal) => this.client.send(new GenerateDataKeyCommand({ KeyId: this.keyId,
      KeySpec: "AES_256", EncryptionContext: { app: this.app, principal: context } }), { abortSignal: signal }));
    let plaintext: Buffer | undefined;
    try {
      if (!Plaintext || !CiphertextBlob) throw new Error("KMS returned no encryption key.");
      plaintext = Buffer.from(JSON.stringify(validated));
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", Plaintext, iv);
      cipher.setAAD(Buffer.from(context));
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      return JSON.stringify({ key: Buffer.from(CiphertextBlob).toString("base64"), iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"), ciphertext: encrypted.toString("base64") });
    } finally { plaintext?.fill(0); Plaintext?.fill(0); }
  }
  async open(value: string, context: string): Promise<SourceTokens> {
    const envelope = z.strictObject({ key: z.string().max(8192), iv: z.string().max(24),
      tag: z.string().max(24), ciphertext: z.string().max(50_000) }).parse(JSON.parse(value));
    const { Plaintext } = await awsRequest((signal) => this.client.send(new DecryptCommand({ KeyId: this.keyId,
      CiphertextBlob: Buffer.from(envelope.key, "base64"), EncryptionContext: { app: this.app, principal: context } }), { abortSignal: signal }));
    if (!Plaintext) throw new Error("KMS returned no plaintext.");
    let decoded: Buffer | undefined;
    try {
      const decipher = createDecipheriv("aes-256-gcm", Plaintext, Buffer.from(envelope.iv, "base64"));
      decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
      decoded = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
      return tokens.parse(JSON.parse(decoded.toString("utf8")));
    } finally { Plaintext.fill(0); decoded?.fill(0); }
  }
}
