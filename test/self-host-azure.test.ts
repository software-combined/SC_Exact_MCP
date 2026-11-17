import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { environment } from "../src/hosted/runtime/config.js";
// @ts-expect-error Plain ESM scripts without type declarations.
import { readSettings, templateParameters } from "../scripts/deploy-azure.mjs";

const bicep = readFileSync(join(import.meta.dirname, "../infra/azure/main.bicep"), "utf8");
const base = { resourceGroup: "exact-mcp", location: "australiaeast", hostname: "exact-mcp.example.com",
  exactAppId: "fictional-app", configFile: "/private/config.json" };

describe("Azure self-host kit", () => {
  it("validates settings and fills safe defaults", () => {
    const s = readSettings(JSON.stringify(base));
    expect(s).toMatchObject({ prefix: "exact-mcp", tags: {},
      budgets: { appPerMinute: 30, divisionPerMinute: 10, appPerDay: 500, divisionPerDay: 200 } });
    expect(readSettings(JSON.stringify({ ...base, location: "westeurope", subscription: "Fictional Subscription" })).location).toBe("westeurope");
    for (const [change, message] of [[{ location: "Australia East" }, /location/], [{ resourceGroup: "bad/group" }, /resourceGroup/],
      [{ hostname: "example.com" }, /sub-domain/], [{ hostname: "https://exact-mcp.example.com" }, /bare host/],
      [{ prefix: "Exact" }, /prefix/], [{ prefix: "exact--mcp" }, /prefix/], [{ prefix: "a".repeat(21) }, /prefix/],
      [{ configFile: "config.json" }, /configFile/], [{ budgets: { appPerDay: 7 } }, /budgets/],
      [{ subscription: "--query" }, /subscription/]] as const) {
      expect(() => readSettings(JSON.stringify({ ...base, ...change }))).toThrow(message);
    }
  });

  it("maps every required template parameter from the settings", () => {
    const s = readSettings(JSON.stringify({ ...base, tags: { Owner: "it@example.com" } }));
    const params = templateParameters(s, { operatorObjectId: "00000000-0000-4000-8000-000000000000" });
    const declared = [...bicep.matchAll(/^param (\w+) [^=\n]+$/gm)].map((m) => m[1]);
    expect(Object.keys(params).sort()).toEqual(declared.sort());
    expect(params).toMatchObject({ image: "", certificateId: "", appCallsPerMinute: 30, divisionCallsPerDay: 200,
      tags: { Project: "exact-mcp", ManagedBy: "exact-mcp-self-host", Owner: "it@example.com" } });
    expect(templateParameters(s, { operatorObjectId: "x", image: "fictional@sha256:0", certificateId: "c" }))
      .toMatchObject({ image: "fictional@sha256:0", certificateId: "c" });
  });

  it("gives the container exactly the environment the Azure runtime reads", () => {
    const names = [...bicep.matchAll(/\{ name: '([A-Z_]+)', value: /g)].map((m) => m[1]);
    const env = environment({ SCG_CLOUD: "azure", SCG_ENVIRONMENT: "production", SCG_ORIGIN: "https://exact-mcp.example.com",
      AZURE_CLIENT_ID: "00000000-0000-4000-8000-000000000000", SCG_TABLE_ENDPOINT: "https://fictional.table.core.windows.net",
      SCG_TABLE_NAME: "state", SCG_KEY_ID: `https://fictional.vault.azure.net/keys/credentials/${"0".repeat(32)}`,
      SCG_CONFIG_SECRET_URL: "https://fictional.vault.azure.net/secrets/runtime-config", SCG_EXACT_APP_ID: "fictional-app",
      SCG_APP_CALLS_PER_MINUTE: "30", SCG_DIVISION_CALLS_PER_MINUTE: "10", SCG_APP_CALLS_PER_DAY: "500", SCG_DIVISION_CALLS_PER_DAY: "200" });
    expect(names.filter((name) => name !== "NODE_ENV").sort()).toEqual(Object.keys(env).sort());
    expect(bicep).toMatch(/minReplicas: replicas/);
    expect(bicep).toMatch(/allowSharedKeyAccess: false/);
    expect(bicep).toMatch(/enablePurgeProtection: true/);
    expect(bicep).toMatch(/adminUserEnabled: false/);
  });

  /** Runs the real Azure deploy against fake az and returns its calls; the fake stops at the secret upload. */
  function fakeDeploy(secretShow: string, extra: string[] = [], groupExists = "false", appShow = "exit 1", groupLocation = "australiaeast") {
    const dir = mkdtempSync(join(tmpdir(), "scg-azure-"));
    const log = join(dir, "az.log"); const config = join(dir, "config.json"); const settings = join(dir, "settings.json");
    writeFileSync(config, JSON.stringify({ exact: { appId: "fictional-app", appSecret: "fictional" }, clients: [{}, {}, {}] }));
    writeFileSync(settings, JSON.stringify({ ...base, configFile: config }));
    writeFileSync(join(dir, "az"), `#!/bin/sh
echo "$*" >> "${log}"
case "$*" in
  "account show"*) echo '{"user":{"name":"fictional","type":"user"},"name":"Fictional","id":"0"}' ;;
  "ad signed-in-user"*) echo "fictional-object" ;;
  "group exists"*) echo "${groupExists}" ;;
  "containerapp show"*) ${appShow} ;;
  "group show"*) echo "${groupLocation}" ;;
  "group create"*) ;;
  *"--name exact-mcp-app"*) exit 1 ;;
  "deployment group create"*) echo '{"vaultName":{"value":"fictional-vault"},"registryName":{"value":"fictionalacr"},"registryServer":{"value":"fictionalacr.azurecr.io"}}' ;;
  "keyvault secret show"*) ${secretShow} ;;
  "keyvault secret set"*) ;;
  "acr build"*) ;;
  "acr repository show"*) echo "sha256:${"a".repeat(64)}" ;;
  *) exit 1 ;;
esac
`);
    chmodSync(join(dir, "az"), 0o755);
    const run = spawnSync(process.execPath, [join(import.meta.dirname, "../scripts/deploy-azure.mjs"), "--settings", settings, ...extra],
      { encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
    expect(run.status).not.toBe(0);
    return readFileSync(log, "utf8").trim().split("\n");
  }

  it.each([["a failed read of the existing app", "echo 'Internal server error' >&2; exit 1", false],
    ["an app that serves another host name", `echo '{"image":"x","fqdn":"f","verificationId":"v","certificateId":null,"hosts":["other.example.com"]}'`, false],
    ["an app with a second, hand-added domain", `echo '{"image":"x","fqdn":"f","verificationId":"v","certificateId":"c","hosts":["exact-mcp.example.com","extra.example.com"]}'`, false],
    ["an app that is confirmed missing", "echo 'ResourceNotFound' >&2; exit 3", true]] as const)(
    "on an existing resource group, deploys only after a clear read of the app: %s", (_, appShow, deploys) => {
      const calls = fakeDeploy("echo 'SecretNotFound' >&2; exit 1", [], "true", appShow);
      expect(calls.some((call) => call.startsWith("deployment group create"))).toBe(deploys);
    });

  it("stops before any change when an existing resource group is in another region", () => {
    const calls = fakeDeploy("echo 'SecretNotFound' >&2; exit 1", [], "true", "echo 'ResourceNotFound' >&2; exit 3", "westeurope");
    expect(calls.some((call) => call.startsWith("deployment group create"))).toBe(false);
  });

  it("keeps a live custom domain and leaves an existing group's tags alone on a redeploy", () => {
    const cert = "/subscriptions/fictional/resourceGroups/exact-mcp/providers/Microsoft.App/managedEnvironments/env/managedCertificates/fictional-cert";
    const app = JSON.stringify({ image: "fictionalacr.azurecr.io/exact-mcp@sha256:old", fqdn: "fictional.azurecontainerapps.io",
      verificationId: "fictional", hosts: ["exact-mcp.example.com"], certificateId: cert });
    const calls = fakeDeploy(`echo '{"ConfigSha256":"x"}'`, ["--replace-config"], "true", `echo '${app}'`);
    const appDeploy = calls.find((call) => call.includes("--name exact-mcp-app"));
    expect(appDeploy).toContain(`"certificateId": {"value": "${cert}"}`.replace(/ /g, ""));
    expect(calls.some((call) => call.startsWith("group create"))).toBe(false);
  });

  it.each([["an untagged stored value", "echo null", [], false], ["a different fingerprint", `echo '{"ConfigSha256":"other"}'`, [], false],
    ["a different fingerprint with --replace-config", `echo '{"ConfigSha256":"other"}'`, ["--replace-config"], true],
    ["a first upload", "echo 'SecretNotFound' >&2; exit 1", [], true], ["an access error", "echo 'Unauthorized' >&2; exit 1", [], false]] as const)(
    "guards the configuration upload against %s", (_, secretShow, extra, uploads) => {
      const set = fakeDeploy(secretShow, [...extra]).find((call) => call.startsWith("keyvault secret set"));
      expect(Boolean(set)).toBe(uploads);
      if (set) expect(set).toMatch(/--tags ConfigSha256=[0-9a-f]{64}/);
    });
});
