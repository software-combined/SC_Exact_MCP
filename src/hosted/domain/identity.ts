import { z } from "zod";

export const regionSchema = z.enum(["nl", "be", "de", "fr", "uk", "es", "com"]);
export type Region = z.infer<typeof regionSchema>;
export const exactUserSchema = z.string().uuid().transform((id) => id.toLowerCase());

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

export interface Versioned<T> { value: T; version: number; expiresAt?: number }
export interface StateStore {
  read<T>(key: string): Promise<Versioned<T> | undefined>;
  write<T>(key: string, value: T, expectedVersion: number | undefined, expiresAt?: number): Promise<boolean>;
  remove(key: string, expectedVersion: number): Promise<boolean>;
}

export interface CredentialCipher {
  seal(value: SourceTokens, context: string): Promise<string>;
  open(value: string, context: string): Promise<SourceTokens>;
}

export class ServiceError extends Error {
  constructor(public code: "denied" | "unavailable" | "invalid_input" | "conflict" | "reauth_required" | "limited",
    message: string, public status = 503) { super(message); }
}

export function connectionKey(app: string, principal: string): string {
  return `connection:${app}:${principal}`;
}
