import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import { sourceTokenText } from "../domain/identity.js";

// AES-256-GCM token envelope shared by every cloud's data-key wrapper.
export const sourceTokens = z.strictObject({ accessToken: sourceTokenText,
  refreshToken: sourceTokenText, expiresAt: z.number().finite().positive(), issuedAt: z.number().finite().positive() });
export const sealedFields = { iv: z.string().max(24), tag: z.string().max(24), ciphertext: z.string().max(50_000) };

export function sealWithKey(key: Uint8Array, aad: Buffer, plaintext: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: encrypted.toString("base64") };
}

export function openWithKey(key: Uint8Array, aad: Buffer, sealed: { iv: string; tag: string; ciphertext: string }): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]);
}
