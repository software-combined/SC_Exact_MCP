import { generateKeyPair, exportJWK } from "jose";
import { randomBytes } from "node:crypto";
import { realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Fixed sign-in callbacks published by each AI client.
const CLIENTS = [
  ["Claude", "https://claude.ai/api/mcp/auth_callback"],
  ["ChatGPT", "https://chatgpt.com/connector_platform_oauth_redirect"],
  ["Microsoft 365 Copilot", "https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect"],
];
const REGIONS = ["nl", "be", "de", "fr", "uk", "es", "com"];

const { values, positionals } = parseArgs({ allowPositionals: true,
  options: { "exact-app-id": { type: "string" }, "exact-region": { type: "string", default: "nl" } } });
const appId = values["exact-app-id"];
if (!positionals[0] || !appId) {
  throw new Error("Usage: npm run config:generate -- /private/path/config.json --exact-app-id <Exact app ID> [--exact-region nl]");
}
if (!REGIONS.includes(values["exact-region"])) throw new Error(`Exact region must be one of: ${REGIONS.join(", ")}.`);
const requested = resolve(positionals[0]);
const root = await realpath(fileURLToPath(new URL("..", import.meta.url)));
const output = join(await realpath(dirname(requested)), basename(requested));
if (output === root || output.startsWith(root + sep)) throw new Error("Choose a new private output file outside this repository.");

/** Reads the Exact app secret from a pipe, or asks for it without echoing it to the screen. */
async function readSecret() {
  if (!process.stdin.isTTY) {
    let data = "";
    for await (const chunk of process.stdin) data += chunk;
    return data.trim();
  }
  process.stdout.write("Exact app secret (typing is hidden): ");
  const stdin = process.stdin;
  stdin.setRawMode(true); stdin.setEncoding("utf8"); stdin.resume();
  return new Promise((done, fail) => {
    let value = "";
    const onData = (text) => {
      // Bracketed-paste markers are harmless. Any other escape or control key means cursor editing, which this
      // simple prompt cannot follow, so it stops instead of saving a wrong secret.
      for (const ch of text.replace(/\x1b\[20[01]~/g, "")) {
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n");
          return done(value.trim());
        }
        if (ch === "\u0003") { stdin.setRawMode(false); stdin.pause(); return fail(new Error("Cancelled.")); }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
        else {
          stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stdout.write("\n");
          return fail(new Error("Editing keys are not supported here. Run again and paste the secret, or type it without arrow keys."));
        }
      }
    };
    stdin.on("data", onData);
  });
}

const appSecret = await readSecret();
if (!appSecret) throw new Error("The Exact app secret is empty.");
const { privateKey } = await generateKeyPair("RS256", { modulusLength: 3072, extractable: true });
const key = { ...await exportJWK(privateKey), kid: randomBytes(16).toString("hex"), alg: "RS256", use: "sig" };
const value = { exact: { appId, appSecret, region: values["exact-region"] },
  clients: CLIENTS.map(([name, callback]) => ({
    client_id: randomBytes(24).toString("base64url"), client_name: name,
    client_secret: randomBytes(32).toString("base64url"), token_endpoint_auth_method: "client_secret_post",
    redirect_uris: [callback] })),
  jwks: { keys: [key] }, cookieKeys: [randomBytes(48).toString("base64url"), randomBytes(48).toString("base64url")] };
await writeFile(output, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
process.stdout.write("Created the private configuration. No secret values were printed.\n");
