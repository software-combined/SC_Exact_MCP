import { z } from "zod";
import type { BrokerConfig } from "../oauth/broker.js";
import { regionSchema } from "../domain/identity.js";
import type { SourceConfig } from "../exact/source.js";
import type { Limits } from "./budgets.js";

const https = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.hash && !url.username && !url.password;
});
const httpsOrigin = https.refine((value) => new URL(value).origin === value);
const positive = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().safe().positive());
// AWS region code, such as eu-central-1. Also used by reconcile.ts.
export const awsRegion = z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d+$/);
const common = z.object({ SCG_ENVIRONMENT: z.literal("production"),
  SCG_ORIGIN: httpsOrigin,
  SCG_EXACT_APP_ID: z.string().min(1).max(200), PORT: positive.default(8080),
  SCG_COPILOT_CATALOGUE_CHANGES: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  SCG_APP_CALLS_PER_MINUTE: positive, SCG_DIVISION_CALLS_PER_MINUTE: positive,
  SCG_APP_CALLS_PER_DAY: positive, SCG_DIVISION_CALLS_PER_DAY: positive });
const aws = common.extend({ SCG_CLOUD: z.literal("aws"), AWS_REGION: awsRegion,
  SCG_STATE_TABLE: z.string().regex(/^[A-Za-z0-9_.-]{3,255}$/), SCG_KMS_KEY_ARN: z.string().min(20),
  SCG_CONFIG_SECRET_ARN: z.string().min(20) });
// Azure Table Storage settings. Also used by reconcile.ts.
export const azureTable = { AZURE_CLIENT_ID: z.guid(), SCG_TABLE_ENDPOINT: httpsOrigin,
  SCG_TABLE_NAME: z.string().regex(/^[A-Za-z][A-Za-z0-9]{2,62}$/) };
// Key Vault identifiers carry no query string, so the recorded key version is exactly the one that wrapped a token.
const vaultPath = (pattern: RegExp) => https.refine((value) => !new URL(value).search && pattern.test(new URL(value).pathname));
const azure = common.extend({ SCG_CLOUD: z.literal("azure"), ...azureTable,
  // A versioned key ID, so each envelope records exactly which key version wrapped it.
  SCG_KEY_ID: vaultPath(/^\/keys\/[A-Za-z0-9-]{1,127}\/[0-9a-f]{32}$/),
  SCG_CONFIG_SECRET_URL: vaultPath(/^\/secrets\/[A-Za-z0-9-]{1,127}\/?$/) });
const envSchema = z.discriminatedUnion("SCG_CLOUD", [aws, azure])
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

/** SCG_CLOUD selects the cloud adapters; it defaults to "aws". */
export function environment(values: NodeJS.ProcessEnv) { return envSchema.parse({ ...values, SCG_CLOUD: values.SCG_CLOUD ?? "aws" }); }
export function configuration(env: ReturnType<typeof environment>, secret: unknown): {
  broker: BrokerConfig; source: SourceConfig; limits: Limits } {
  const parsed = secretSchema.parse(secret);
  if (parsed.exact.appId !== env.SCG_EXACT_APP_ID) throw new Error("Runtime secret does not match the dedicated Exact application.");
  const catalogueClientId = env.SCG_COPILOT_CATALOGUE_CHANGES ?
    parsed.clients.find((value) => value.client_name === "Microsoft 365 Copilot")?.client_id : undefined;
  return { source: { ...parsed.exact, callback: `${env.SCG_ORIGIN}/exact/callback` },
    broker: { origin: env.SCG_ORIGIN, clients: parsed.clients.map((value) => ({ ...value,
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], scope: "openid exact.read" })),
    jwks: parsed.jwks, cookieKeys: parsed.cookieKeys, catalogueClientId },
    limits: { appCallsPerMinute: env.SCG_APP_CALLS_PER_MINUTE, divisionCallsPerMinute: env.SCG_DIVISION_CALLS_PER_MINUTE,
      appCallsPerDay: env.SCG_APP_CALLS_PER_DAY, divisionCallsPerDay: env.SCG_DIVISION_CALLS_PER_DAY } };
}
