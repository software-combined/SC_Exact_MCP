import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { baseTags, checkConfig, guardConfigChange, need, sharedSettings } from "./deploy.mjs";

// Deploys one self-hosted copy to Azure: infrastructure, configuration secret, container image, app and custom domain.
const root = fileURLToPath(new URL("..", import.meta.url));
const template = resolve(root, "infra/azure/main.bicep");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Validates the Azure settings file and fills safe defaults. */
export function readSettings(text) {
  const s = sharedSettings(JSON.parse(text));
  need(s.subscription === undefined || /^\w[\w .()-]{0,99}$/.test(s.subscription), "subscription must be a subscription name or ID.");
  need(/^[\w.()-]{0,89}[\w()-]$/.test(s.resourceGroup ?? ""), "resourceGroup must be a resource group name, such as exact-mcp.");
  need(/^[a-z][a-z0-9]+$/.test(s.location ?? ""), "location must be an Azure region name, such as australiaeast or westeurope.");
  need(s.hostname.split(".").length >= 3, "hostname must be a sub-domain, such as exact-mcp.example.com, because it needs a CNAME record.");
  const prefix = s.prefix ?? "exact-mcp";
  need(/^[a-z](-?[a-z0-9])+$/.test(prefix) && prefix.length >= 3 && prefix.length <= 20,
    "prefix must be 3 to 20 lowercase letters or digits, with single hyphens, starting with a letter.");
  return { ...s, prefix };
}

/** Parameters for infra/azure/main.bicep, built from the settings and this run's values. */
export function templateParameters(s, { operatorObjectId, image = "", certificateId = "" }) {
  return { prefix: s.prefix, hostname: s.hostname, exactAppId: s.exactAppId,
    appCallsPerMinute: s.budgets.appPerMinute, divisionCallsPerMinute: s.budgets.divisionPerMinute,
    appCallsPerDay: s.budgets.appPerDay, divisionCallsPerDay: s.budgets.divisionPerDay,
    tags: { ...baseTags, ...s.tags }, operatorObjectId, image, certificateId };
}

/**
 * Stops a deploy that would move an existing copy to a different host name, or silently drop a domain someone added
 * by hand: the template sets the app's whole domain list.
 */
export function checkAzureHost(hosts, hostname) {
  const others = (hosts ?? []).filter((host) => host !== hostname);
  if (others.length) {
    throw new Error(`This container app also serves ${others.join(", ")}. Use another prefix or resource group for ${hostname}, or remove that domain first.`);
  }
}

async function main() {
  const { values } = parseArgs({ options: { settings: { type: "string" }, review: { type: "boolean" },
    "replace-config": { type: "boolean" } } });
  if (!values.settings) throw new Error("Usage: npm run deploy:azure -- --settings /private/path/azure-settings.json [--review] [--replace-config]");
  const s = readSettings(readFileSync(values.settings, "utf8"));
  const configText = readFileSync(s.configFile, "utf8");
  checkConfig(configText, s.exactAppId);
  const configHash = createHash("sha256").update(configText).digest("hex");
  const subscription = s.subscription ? ["--subscription", s.subscription] : [];
  const az = (args, stdio = ["ignore", "pipe", "inherit"]) => execFileSync("az", [...args, ...subscription, "--only-show-errors"],
    { encoding: "utf8", stdio });
  const json = (args, stdio) => JSON.parse(az([...args, "--output", "json"], stdio));
  const step = (text) => process.stdout.write(`\n== ${text}\n`);
  const group = ["--resource-group", s.resourceGroup];
  const parameters = (run) => JSON.stringify(Object.fromEntries(Object.entries(templateParameters(s, run)).map(([k, v]) => [k, { value: v }])));
  const currentApp = () => {
    try {
      return json(["containerapp", "show", ...group, "--name", s.prefix, "--query", "{image: properties.template.containers[0].image, " +
        "fqdn: properties.configuration.ingress.fqdn, verificationId: properties.customDomainVerificationId, " +
        "hosts: properties.configuration.ingress.customDomains[].name, " +
        `certificateId: properties.configuration.ingress.customDomains[?name=='${s.hostname}'].certificateId | [0]}`], ["ignore", "pipe", "pipe"]);
    } catch (error) {
      // Only a confirmed "not found" means a new app. Any other failure stops the deploy, because treating a live app
      // as new would redeploy it without its custom domain.
      if (/ResourceNotFound|was not found|could not be found/i.test(String(error.stderr))) return undefined;
      process.stderr.write(String(error.stderr ?? "")); throw error;
    }
  };
  const deploy = (name, run) => {
    step(`Deploying ${name} (this can take 5 to 15 minutes)`);
    const outputs = json(["deployment", "group", "create", ...group, "--name", name, "--template-file", template,
      "--parameters", parameters(run), "--query", "properties.outputs"]);
    return Object.fromEntries(Object.entries(outputs).map(([key, output]) => [key, output.value]));
  };

  step("Checking the Azure account you are signed in to");
  const account = json(["account", "show"]);
  process.stdout.write(`${account.user.name} in subscription ${account.name} (${account.id})\n`);
  if (account.user.type !== "user") throw new Error("Sign in as a person with `az login`. The deploy gives that person access to store the configuration.");
  const operatorObjectId = execFileSync("az", ["ad", "signed-in-user", "show", "--query", "id", "--output", "tsv"], { encoding: "utf8" }).trim();
  const exists = az(["group", "exists", "--name", s.resourceGroup]).trim() === "true";
  const current = exists ? currentApp() : undefined;
  checkAzureHost(current?.hosts, s.hostname);
  // Azure puts every resource in the group's region, so an existing group must be in the region the settings chose.
  if (exists) {
    const groupLocation = az(["group", "show", "--name", s.resourceGroup, "--query", "location", "--output", "tsv"]).trim();
    if (groupLocation.toLowerCase().replace(/\s/g, "") !== s.location) {
      throw new Error(`Resource group ${s.resourceGroup} is in ${groupLocation}, not ${s.location}. Use another resource group, or set location to ${groupLocation}.`);
    }
  }

  if (values.review) {
    if (!exists) return process.stdout.write(`\nResource group ${s.resourceGroup} does not exist yet. The first deploy creates everything in infra/azure/main.bicep.\n`);
    step("Previewing the Azure changes");
    execFileSync("az", ["deployment", "group", "what-if", ...group, "--template-file", template, "--parameters",
      parameters({ operatorObjectId, image: current?.image, certificateId: current?.certificateId ?? "" }), ...subscription], { stdio: "inherit" });
    return process.stdout.write("\nReview the changes above, then run again without --review.\n");
  }

  if (!exists) {
    // Only a new group gets tags here: on an existing group, --tags would replace the company's own tags.
    step(`Creating resource group ${s.resourceGroup} in ${s.location}`);
    az(["group", "create", "--name", s.resourceGroup, "--location", s.location, "--output", "none",
      "--tags", ...Object.entries({ ...baseTags, ...s.tags }).map(([key, value]) => `${key}=${value}`)]);
  }
  const out = deploy(`${s.prefix}-infrastructure`, { operatorObjectId });

  step("Storing the private configuration in Azure Key Vault (not printed)");
  const secret = ["--vault-name", out.vaultName, "--name", "runtime-config"];
  // The stored tags, or undefined when the configuration secret does not exist yet.
  const storedTags = () => {
    try { return JSON.parse(az(["keyvault", "secret", "show", ...secret, "--query", "tags", "--output", "json"], ["ignore", "pipe", "pipe"])); }
    catch (error) { if (/SecretNotFound/.test(String(error.stderr))) return undefined; throw error; }
  };
  for (let attempt = 1; ; attempt++) {
    try {
      // Same guard as AWS: a different file replaces live keys and signs everyone out, so it needs --replace-config.
      const tags = storedTags();
      guardConfigChange(tags?.ConfigSha256, tags !== undefined, configHash, values["replace-config"]);
      if (createHash("sha256").update(readFileSync(s.configFile, "utf8")).digest("hex") !== configHash) {
        throw new Error("The configuration file changed during the deploy. Run the deploy again.");
      }
      // The value and its fingerprint are stored together in one new secret version.
      az(["keyvault", "secret", "set", ...secret, "--file", s.configFile, "--tags", `ConfigSha256=${configHash}`, "--output", "none"],
        ["ignore", "ignore", "pipe"]);
      break;
    } catch (error) {
      if (attempt >= 20 || !/Forbidden/i.test(String(error.stderr))) { process.stderr.write(String(error.stderr ?? "")); throw error; }
      process.stdout.write("Waiting for your new Key Vault access to take effect...\n");
      await sleep(15_000);
    }
  }

  step("Building the container image in Azure Container Registry");
  const tag = `build-${Date.now()}`;
  execFileSync("az", ["acr", "build", "--registry", out.registryName, "--image", `exact-mcp:${tag}`, "--platform", "linux/amd64",
    ...subscription, root], { stdio: "inherit" });
  const digest = az(["acr", "repository", "show", "--name", out.registryName, "--image", `exact-mcp:${tag}`,
    "--query", "digest", "--output", "tsv"]).trim();

  deploy(`${s.prefix}-app`, { operatorObjectId, image: `${out.registryServer}/exact-mcp@${digest}`, certificateId: current?.certificateId ?? "" });

  if (!current?.certificateId) {
    const app = currentApp();
    if (!app?.fqdn) throw new Error("The container app was not found after the deployment.");
    step("Connecting your host name");
    process.stdout.write(`Add these two DNS records at your DNS provider:\n\n  CNAME  ${s.hostname}  ->  ${app.fqdn}\n` +
      `  TXT    asuid.${s.hostname}  ->  ${app.verificationId}\n\n`);
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    await prompt.question("Press Enter when both records are in place. ");
    prompt.close();
    az(["containerapp", "hostname", "add", ...group, "--name", s.prefix, "--hostname", s.hostname, "--output", "none"]);
    step("Issuing a free Azure-managed certificate (this can take 5 to 20 minutes)");
    az(["containerapp", "hostname", "bind", ...group, "--name", s.prefix, "--hostname", s.hostname,
      "--environment", out.environmentName, "--validation-method", "CNAME", "--output", "none"]);
  }

  step(`Checking https://${s.hostname}/health`);
  for (let attempt = 1; attempt <= 30; attempt++) {
    const status = await fetch(`https://${s.hostname}/health`).then((r) => r.status, () => 0);
    if (status === 200) return process.stdout.write(`The service is up at https://${s.hostname}/mcp\n`);
    await sleep(10_000);
  }
  throw new Error("The service did not report healthy within 5 minutes. Check the container app's revisions and log stream in the Azure portal.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
