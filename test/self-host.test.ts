import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { configuration, environment } from "../src/hosted/runtime/config.js";
// @ts-expect-error Plain ESM scripts without type declarations.
import { copilotPackage, serviceTools, zip } from "../scripts/build-copilot-package.mjs";
// @ts-expect-error Plain ESM scripts without type declarations.
import { checkConfig, checkConfigChange, checkOwner, readSettings, serviceParameters } from "../scripts/deploy.mjs";

const generator = join(import.meta.dirname, "../scripts/create-signing-config.mjs");
const env = environment({ SCG_ENVIRONMENT: "production", AWS_REGION: "eu-central-1", SCG_ORIGIN: "https://exact-mcp.example.com",
  SCG_STATE_TABLE: "fictional-table", SCG_KMS_KEY_ARN: "arn:aws:kms:eu-central-1:000000000000:key/fictional",
  SCG_CONFIG_SECRET_ARN: "arn:aws:secretsmanager:eu-central-1:000000000000:secret:fictional", SCG_EXACT_APP_ID: "fictional-app",
  SCG_APP_CALLS_PER_MINUTE: "30", SCG_DIVISION_CALLS_PER_MINUTE: "10", SCG_APP_CALLS_PER_DAY: "500", SCG_DIVISION_CALLS_PER_DAY: "200" });

/** Reads a zip produced by zip() back into { name: Buffer }. */
function unzip(archive: Buffer) {
  const end = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const files: Record<string, Buffer> = {};
  let at = archive.readUInt32LE(end + 16);
  for (let i = 0; i < archive.readUInt16LE(end + 10); i++) {
    const size = archive.readUInt32LE(at + 20); const nameLength = archive.readUInt16LE(at + 28);
    const local = archive.readUInt32LE(at + 42); const name = archive.subarray(at + 46, at + 46 + nameLength).toString();
    const start = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
    files[name] = inflateRawSync(archive.subarray(start, start + size));
    at += 46 + nameLength;
  }
  return files;
}

describe("self-host kit", () => {
  it("generates a complete private configuration that the service accepts, reading the secret from a pipe", () => {
    const out = join(mkdtempSync(join(tmpdir(), "scg-config-")), "config.json");
    const run = spawnSync(process.execPath, [generator, out, "--exact-app-id", "fictional-app"], { input: "fictional-exact-secret\n", encoding: "utf8" });
    expect(run.status).toBe(0);
    expect(run.stdout).not.toContain("fictional-exact-secret");
    expect(statSync(out).mode & 0o777).toBe(0o600);
    const parsed = configuration(env, JSON.parse(readFileSync(out, "utf8")));
    expect(parsed.source).toMatchObject({ appId: "fictional-app", appSecret: "fictional-exact-secret", region: "nl" });
    expect(parsed.broker.clients.map((c) => c.redirect_uris[0])).toEqual(["https://claude.ai/api/mcp/auth_callback",
      "https://chatgpt.com/connector_platform_oauth_redirect", "https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect"]);
  });

  it("refuses to write configuration without an app ID or inside the repository", () => {
    expect(spawnSync(process.execPath, [generator, join(tmpdir(), "x.json")], { input: "s" }).status).not.toBe(0);
    const inside = spawnSync(process.execPath, [generator, join(import.meta.dirname, "leak.json"), "--exact-app-id", "a"], { input: "s" });
    expect(inside.status).not.toBe(0);
  });

  it("builds a Copilot package that lists the service's own tools, so Copilot can ask people to sign in", async () => {
    const appId = "11111111-2222-4333-8444-555555555555";
    const tools = await serviceTools(() => import("../src/hosted/transport/mcp.js"));
    const names = tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["company_discovery", "create_draft_sales_invoice"]));
    const files = unzip(zip(copilotPackage({ host: "exact-mcp.example.com", appId, registrationId: "fictional-registration", tools })));
    expect(Object.keys(files).sort()).toEqual(["color.png", "declarativeAgent.json", "manifest.json", "outline.png", "plugin.json"]);
    const manifest = JSON.parse(files["manifest.json"].toString()); const plugin = JSON.parse(files["plugin.json"].toString());
    expect(manifest).toMatchObject({ manifestVersion: "1.29", id: appId, validDomains: ["exact-mcp.example.com"] });
    expect(plugin.functions.map((fn: { name: string }) => fn.name)).toEqual(names);
    expect(plugin.runtimes[0]).toMatchObject({ type: "RemoteMCPServer", auth: { type: "OAuthPluginVault", reference_id: "fictional-registration" },
      run_for_functions: names, spec: { url: "https://exact-mcp.example.com/mcp" } });
    expect(plugin.runtimes[0].spec.mcp_tool_description.tools).toEqual(tools.map(({ name, description, inputSchema, annotations }) =>
      ({ name, description, inputSchema, annotations })));
    const packaged = Object.fromEntries(plugin.runtimes[0].spec.mcp_tool_description.tools.map((tool: { name: string; annotations: { readOnlyHint: boolean } }) =>
      [tool.name, tool.annotations.readOnlyHint]));
    expect(packaged).toMatchObject({ company_discovery: true, create_customer: false, update_customer: false, create_draft_sales_invoice: false });
    expect(JSON.parse(files["declarativeAgent.json"].toString()).instructions).not.toMatch(/read-only/i);
    expect(() => copilotPackage({ host: "https://bad", appId, registrationId: "r", tools })).toThrow(/bare host/);
    expect(() => copilotPackage({ appId, registrationId: "r", tools })).toThrow(/bare host/);
    expect(() => copilotPackage({ host: "a.example", appId: "nope", registrationId: "r", tools })).toThrow(/GUID/);
    expect(() => copilotPackage({ host: "a.example", appId, registrationId: "r", tools: [] })).toThrow(/tool list is empty/);
  });

  it("maps every required service template parameter from the foundation outputs and settings", () => {
    const settings = readSettings(JSON.stringify({ region: "eu-central-1", hostname: "exact-mcp.example.com", hostedZoneId: "ZFICTIONAL1",
      exactAppId: "fictional-app", configFile: "/private/config.json" }));
    const outputs = Object.fromEntries(["VpcId", "VpcCidr", "PublicSubnets", "PrivateSubnets", "CertificateArn",
      "ImageRepositoryArn", "ConfigSecretArn", "ConfigKeyArn"].map((key) => [key, `fictional-${key}`]));
    const params = serviceParameters(settings, outputs, "fictional-image");
    const template = readFileSync(join(import.meta.dirname, "../infra/production.yaml"), "utf8");
    const declared = [...template.split("\nResources:")[0].matchAll(/^ {2}([A-Za-z]+):/gm)].map((m) => m[1]);
    expect(Object.keys(params).sort()).toEqual(declared.filter((name) => name !== "DesiredCount").sort());
    expect(Object.values(params).every((value) => typeof value === "string" && value.length > 0)).toBe(true);
    expect(readSettings(JSON.stringify({ ...settings, region: "ap-southeast-2" })).region).toBe("ap-southeast-2");
    expect(() => readSettings(JSON.stringify({ ...settings, region: "Sydney" }))).toThrow(/region/);
    expect(settings.stackPrefix).toMatch(/^exact-mcp-exact-mcp-example-com-[0-9a-f]{8}$/);
    const prefix = (hostname: string) => readSettings(JSON.stringify({ ...settings, stackPrefix: undefined, hostname })).stackPrefix;
    expect(prefix("exact.mcp.example.com")).not.toBe(prefix("exact-mcp.example.com"));
    expect(readSettings(JSON.stringify({ ...settings, stackPrefix: "kept" })).stackPrefix).toBe("kept");
    expect(prefix("x.example")).toBe(readSettings(JSON.stringify({ ...settings, stackPrefix: null, hostname: "x.example" })).stackPrefix);
    expect(() => readSettings(JSON.stringify({ ...settings, stackPrefix: "1-bad_name" }))).toThrow(/stackPrefix/);
    expect(() => readSettings(JSON.stringify({ ...settings, configFile: join(import.meta.dirname, "x.json") }))).toThrow(/outside this repository/);
    expect(() => checkOwner(undefined, settings)).not.toThrow();
    expect(() => checkOwner("exact-mcp.example.com", settings)).not.toThrow();
    expect(() => checkOwner("other.example.com", settings)).toThrow(/belong to other.example.com/);
  });

  it("refuses a configuration that does not match the settings", () => {
    const config = JSON.stringify({ exact: { appId: "other", appSecret: "s" }, clients: [{}, {}, {}] });
    expect(() => checkConfig(config, "fictional-app")).toThrow(/does not match/);
    expect(() => checkConfig(JSON.stringify({ exact: { appId: "a", appSecret: "REPLACE" }, clients: [] }), "a")).toThrow(/secret/);
    let message = "";
    try { checkConfig('{"exact":{"appId":"a","appSecret": FICTIONAL-SECRET-VALUE}}', "a"); } catch (error) { message = String(error); }
    expect(message).toMatch(/not valid JSON/);
    expect(message).not.toContain("FICTIONAL");
    const secret = (tag: string | null, stored: boolean) => ({ ARN: "fictional", Name: "fictional",
      ...(tag ? { Tags: [{ Key: "Other", Value: "x" }, { Key: "ConfigSha256", Value: tag }] } : {}),
      ...(stored ? { VersionIdsToStages: { "fictional-version": ["AWSCURRENT"] } } : {}) });
    expect(() => checkConfigChange(secret(null, false), "b", false)).not.toThrow();
    expect(() => checkConfigChange(secret("a", true), "a", false)).not.toThrow();
    expect(() => checkConfigChange(secret("a", true), "b", false)).toThrow(/--replace-config/);
    expect(() => checkConfigChange(secret(null, true), "b", false)).toThrow(/--replace-config/);
    expect(() => checkConfigChange(secret("a", true), "b", true)).not.toThrow();
  });

  /** Runs the real deploy script against fake aws and docker commands and returns the aws calls it made. */
  function fakeDeploy(owner: string, secret: string, extra: string[] = []) {
    const dir = mkdtempSync(join(tmpdir(), "scg-deploy-"));
    const log = join(dir, "aws.log"); const config = join(dir, "config.json"); const settings = join(dir, "settings.json");
    writeFileSync(config, JSON.stringify({ exact: { appId: "fictional-app", appSecret: "fictional" }, clients: [{}, {}, {}] }));
    writeFileSync(settings, JSON.stringify({ region: "eu-central-1", hostname: "exact-mcp.example.com", hostedZoneId: "ZFICTIONAL1",
      exactAppId: "fictional-app", configFile: config }));
    writeFileSync(join(dir, "aws"), `#!/bin/sh
echo "$*" >> "${log}"
case "$*" in
  *get-caller-identity*) echo "arn:aws:sts::000000000000:assumed-role/fictional" ;;
  *describe-stacks*Parameters*) case "${owner}" in other) echo "other.example.com" ;; denied) echo "AccessDenied" >&2; exit 254 ;;
    *) echo "Stack with id x does not exist" >&2; exit 254 ;; esac ;;
  "cloudformation deploy"*) ;;
  *describe-stacks*Outputs*) echo '[{"OutputKey":"ConfigSecretArn","OutputValue":"fictional-secret"}]' ;;
  *describe-secret*) echo '${secret}' ;;
  *tag-resource*) ;;
  *) exit 1 ;;
esac
`);
    writeFileSync(join(dir, "docker"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(dir, "aws"), 0o755); chmodSync(join(dir, "docker"), 0o755);
    const run = spawnSync(process.execPath, [join(import.meta.dirname, "../scripts/deploy.mjs"), "--settings", settings, ...extra],
      { encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
    expect(run.status).not.toBe(0);
    return readFileSync(log, "utf8").trim().split("\n").map((call) => call.split(" ").slice(0, 2).join(" "));
  }

  it.each([["another host", "other", false], ["an access error", "denied", false], ["a new copy", "missing", true]] as const)(
    "checks stack ownership before any AWS change when describe-stacks reports %s", (_, owner, deploys) => {
      const calls = fakeDeploy(owner, "{}");
      expect(calls[1]).toBe("cloudformation describe-stacks");
      expect(calls.slice(2).includes("cloudformation deploy")).toBe(deploys);
      if (deploys) expect(calls[2]).toBe("cloudformation deploy");
    });

  // Shaped like real DescribeSecret output, so a misspelt field name in the deploy script fails these cases.
  const stored = '"VersionIdsToStages":{"fictional-version":["AWSCURRENT"]}';
  const tagged = '"Tags":[{"Key":"ConfigSha256","Value":"other"}]';
  it.each([["an untagged stored value", `{${stored}}`, [], false], ["a different fingerprint", `{${tagged},${stored}}`, [], false],
    ["a different fingerprint with --replace-config", `{${tagged},${stored}}`, ["--replace-config"], true],
    ["a first upload", '{"Name":"fictional"}', [], true]] as const)(
    "guards the configuration upload against %s", (_, secret, extra, uploads) => {
      const calls = fakeDeploy("missing", secret, [...extra]);
      const tag = calls.indexOf("secretsmanager tag-resource"); const put = calls.indexOf("secretsmanager put-secret-value");
      expect(put >= 0).toBe(uploads);
      if (uploads) expect(tag).toBeGreaterThan(0);
      if (uploads) expect(tag).toBeLessThan(put);
      if (!uploads) expect(tag).toBe(-1);
    });
});
