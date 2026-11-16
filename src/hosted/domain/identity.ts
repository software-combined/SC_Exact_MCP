import { z } from "zod";

export const regionSchema = z.enum(["nl", "be", "de", "fr", "uk", "es", "com"]);
export type Region = z.infer<typeof regionSchema>;
// Exact Edm.Guid values need not carry RFC version or variant bits, so use the generic 8-4-4-4-12 form.
export const exactUserSchema = z.guid().transform((id) => id.toLowerCase());

export function subject(region: Region, userId: string): string {
  return `${region}:${exactUserSchema.parse(userId)}`;
}

export interface Connection {
  subject: string;
  userId: string;
  region: Region;
  displayName: string;
  currentDivision: number;
  generation: number;
  status: "active" | "disconnected" | "reauth_required";
  credentials: string;
  expiresAt: number;
  appEpoch: number;
}

export interface Principal {
  subject: string;
  grantId: string;
  clientId: string;
  generation: number;
}

export interface SourceTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  issuedAt: number;
}

export interface Versioned<T> { value: T; version: string; expiresAt?: number }
export interface StateStore {
  read<T>(key: string): Promise<Versioned<T> | undefined>;
  /** Return a unique opaque revision, or undefined on conflict; never reuse a revision after expiry. */
  write<T>(key: string, value: T, expectedVersion: string | undefined, expiresAt?: number): Promise<string | undefined>;
  remove(key: string, expectedVersion: string): Promise<boolean>;
}

export interface CredentialCipher {
  seal(value: SourceTokens, context: string): Promise<string>;
  open(value: string, context: string): Promise<SourceTokens>;
}

export class ServiceError extends Error {
  constructor(public code: "denied" | "unavailable" | "invalid_input" | "conflict" | "reauth_required" | "limited",
    message: string, public status = 503, /** Fixed diagnostic label for logs; never source data. */ readonly detail?: string) { super(message); }
}

export function connectionKey(app: string, principal: string): string {
  return `connection:${app}:${principal}`;
}
