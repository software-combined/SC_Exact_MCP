import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { z } from "zod";
import type { CredentialCipher, SourceTokens } from "../domain/identity.js";
import { awsClientOptions, awsRequest } from "./aws.js";
import { openWithKey, sealWithKey, sealedFields, sourceTokens } from "./envelope.js";

export class KmsCipher implements CredentialCipher {
  private client: KMSClient;
  constructor(private keyId: string, private app: string, region: string) {
    this.client = new KMSClient({ region, ...awsClientOptions });
  }
  async seal(value: SourceTokens, context: string): Promise<string> {
    const validated = sourceTokens.parse(value);
    const { Plaintext, CiphertextBlob } = await awsRequest((signal) => this.client.send(new GenerateDataKeyCommand({ KeyId: this.keyId,
      KeySpec: "AES_256", EncryptionContext: { app: this.app, principal: context } }), { abortSignal: signal }));
    let plaintext: Buffer | undefined;
    try {
      if (!Plaintext || !CiphertextBlob) throw new Error("KMS returned no encryption key.");
      plaintext = Buffer.from(JSON.stringify(validated));
      return JSON.stringify({ key: Buffer.from(CiphertextBlob).toString("base64"),
        ...sealWithKey(Plaintext, Buffer.from(context), plaintext) });
    } finally { plaintext?.fill(0); Plaintext?.fill(0); }
  }
  async open(value: string, context: string): Promise<SourceTokens> {
    const envelope = z.strictObject({ key: z.string().max(8192), ...sealedFields }).parse(JSON.parse(value));
    const { Plaintext } = await awsRequest((signal) => this.client.send(new DecryptCommand({ KeyId: this.keyId,
      CiphertextBlob: Buffer.from(envelope.key, "base64"), EncryptionContext: { app: this.app, principal: context } }), { abortSignal: signal }));
    if (!Plaintext) throw new Error("KMS returned no plaintext.");
    let decoded: Buffer | undefined;
    try {
      decoded = openWithKey(Plaintext, Buffer.from(context), envelope);
      return sourceTokens.parse(JSON.parse(decoded.toString("utf8")));
    } finally { Plaintext.fill(0); decoded?.fill(0); }
  }
}
