import { z } from "zod";
import type { BrokerConfig } from "../oauth/broker.js";
import { regionSchema } from "../domain/identity.js";
import type { SourceConfig } from "../exact/source.js";
import type { Limits } from "./budgets.js";

const https = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.hash && !url.username && !url.password;
});
const positive = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().safe().positive());
// AWS region code, such as eu-central-1. Also used by reconcile.ts.
export const awsRegion = z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d+$/);
const envSchema = z.object({ SCG_ENVIRONMENT: z.literal("production"), AWS_REGION: awsRegion,
  SCG_ORIGIN: https.refine((value) => new URL(value).origin === value),
  SCG_STATE_TABLE: z.string().regex(/^[A-Za-z0-9_.-]{3,255}$/), SCG_KMS_KEY_ARN: z.string().min(20),
  SCG_EXACT_APP_ID: z.string().min(1).max(200),
  SCG_CONFIG_SECRET_ARN: z.string().min(20), PORT: positive.default(8080),
  SCG_APP_CALLS_PER_MINUTE: positive, SCG_DIVISION_CALLS_PER_MINUTE: positive,
  SCG_APP_CALLS_PER_DAY: positive, SCG_DIVISION_CALLS_PER_DAY: positive })
  .refine((env) => env.SCG_APP_CALLS_PER_MINUTE >= 8 && env.SCG_APP_CALLS_PER_DAY >= 8,
    "App budgets must permit the bounded public sign-in pool.");
const client = z.object({ client_id: z.string().min(1).max(200), client_name: z.enum(["Claude", "ChatGPT", "Microsoft 365 Copilot"]),
  client_secret: z.string().min(24).max(256).optional(), redirect_uris: z.array(https).min(1).max(3),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]) })
  .refine((value) => value.token_endpoint_auth_method === "none" || Boolean(value.client_secret), "Client secret is required.");
const secretSchema = z.strictObject({ exact: z.strictObject({ appId: z.string().min(1).max(200),
  appSecret: z.string().min(1).max(2000), region: regionSchema }),
  clients: z.array(client).length(3).refine((clients) => new Set(clients.map((v) => v.client_id)).size === 3 &&
    new Set(clients.map((v) => v.client_name)).size === 3),
  jwks: z.object({ keys: z.array(z.object({ kty: z.literal("RSA"), kid: z.string().min(1),
    n: z.string().min(1), e: z.string().min(1), d: z.string().min(1), p: z.string(), q: z.string(),
    dp: z.string(), dq: z.string(), qi: z.string(), alg: z.literal("RS256"), use: z.literal("sig") })).min(1).max(3) }),
  cookieKeys: z.array(z.string().min(32).max(256)).min(2).max(3) });

export function environment(values: NodeJS.ProcessEnv) { return envSchema.parse(values); }
export function configuration(env: ReturnType<typeof environment>, secret: unknown): {
  broker: BrokerConfig; source: SourceConfig; limits: Limits } {
  const parsed = secretSchema.parse(secret);
  if (parsed.exact.appId !== env.SCG_EXACT_APP_ID) throw new Error("Runtime secret does not match the dedicated Exact application.");
  return { source: { ...parsed.exact, callback: `${env.SCG_ORIGIN}/exact/callback` },
    broker: { origin: env.SCG_ORIGIN, clients: parsed.clients.map((value) => ({ ...value,
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: "openid exact.read" })),
    jwks: parsed.jwks, cookieKeys: parsed.cookieKeys },
    limits: { appCallsPerMinute: env.SCG_APP_CALLS_PER_MINUTE, divisionCallsPerMinute: env.SCG_DIVISION_CALLS_PER_MINUTE,
      appCallsPerDay: env.SCG_APP_CALLS_PER_DAY, divisionCallsPerDay: env.SCG_DIVISION_CALLS_PER_DAY } };
}
