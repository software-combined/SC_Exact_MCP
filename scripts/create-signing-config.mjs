import { generateKeyPair, exportJWK } from "jose";
import { randomBytes } from "node:crypto";
import { realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const requested = process.argv[2] ? resolve(process.argv[2]) : undefined;
if (!requested) throw new Error("Choose a new private output file outside this repository.");
const root = await realpath(fileURLToPath(new URL("..", import.meta.url)));
const output = join(await realpath(dirname(requested)), basename(requested));
if (output === root || output.startsWith(root + sep)) throw new Error("Choose a new private output file outside this repository.");
const { privateKey } = await generateKeyPair("RS256", { modulusLength: 3072, extractable: true });
const key = { ...await exportJWK(privateKey), kid: randomBytes(16).toString("hex"), alg: "RS256", use: "sig" };
const value = { exact: { appId: "REPLACE_DEDICATED_MCP_APP_ID", appSecret: "REPLACE_IN_PRIVATE_EDITOR", region: "nl" },
  clients: ["Claude", "ChatGPT", "Microsoft 365 Copilot"].map((name) => ({
    client_id: randomBytes(24).toString("base64url"), client_name: name,
    client_secret: randomBytes(32).toString("base64url"), token_endpoint_auth_method: "client_secret_post",
    redirect_uris: ["https://replace-with-exact-client-callback.invalid/callback"] })),
  jwks: { keys: [key] }, cookieKeys: [randomBytes(48).toString("base64url"), randomBytes(48).toString("base64url")] };
await writeFile(output, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
process.stdout.write("Created a private draft. Replace every placeholder securely before service launch. No secret values were printed.\n");
