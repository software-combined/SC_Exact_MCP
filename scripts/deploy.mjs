import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// Deploys one self-hosted copy: foundation stack, configuration secret, container image and service stack.
const root = fileURLToPath(new URL("..", import.meta.url));

/** Validates the settings file and fills safe defaults. */
export function readSettings(text) {
  const s = JSON.parse(text);
  const need = (cond, message) => { if (!cond) throw new Error(`Settings: ${message}`); };
  need(/^[a-z]{2}(-[a-z]+)+-\d+$/.test(s.region ?? ""), "region must be an AWS region code, such as eu-central-1 or ap-southeast-2.");
  need(/^[a-z0-9.-]+$/.test(s.hostname ?? ""), "hostname must be a bare host name, such as exact-mcp.example.com.");
  need(/^Z[A-Z0-9]+$/.test(s.hostedZoneId ?? ""), "hostedZoneId must be the Route 53 hosted zone ID for that host name.");
  need(typeof s.exactAppId === "string" && s.exactAppId.length > 0, "exactAppId is required.");
  need(typeof s.configFile === "string" && isAbsolute(s.configFile), "configFile must be an absolute path to the private configuration.");
  need(!resolve(s.configFile).startsWith(resolve(root) + sep), "configFile must be outside this repository, so it can never be committed.");
  const budgets = { appPerMinute: 30, divisionPerMinute: 10, appPerDay: 500, divisionPerDay: 200, ...s.budgets };
  need(budgets.appPerMinute >= 8 && budgets.appPerDay >= 8, "app budgets must be at least 8.");
  // One AWS account can hold several copies, so each host name gets its own stacks by default.
  // The readable part can repeat ("a-b.c" and "a.b-c"), so a short host fingerprint keeps names unique.
  const fingerprint = createHash("sha256").update(s.hostname).digest("hex").slice(0, 8);
  const stackPrefix = s.stackPrefix ?? `exact-mcp-${s.hostname.replaceAll(".", "-").slice(0, 60)}-${fingerprint}`;
  need(/^[a-z][a-z0-9-]{0,99}$/.test(stackPrefix), "stackPrefix must start with a lowercase letter and use only lowercase letters, digits and hyphens.");
  return { ...s, stackPrefix, tags: s.tags ?? {}, budgets };
}

/** Stops a deploy that would take over another copy's stacks. */
export function checkOwner(existingHostname, s) {
  if (existingHostname !== undefined && existingHostname !== s.hostname) {
    throw new Error(`The stacks named ${s.stackPrefix} belong to ${existingHostname}. Use another stackPrefix for ${s.hostname}.`);
  }
}

/** Checks the private configuration without printing it. */
export function checkConfig(text, exactAppId) {
  let config;
  // The parser's own message can quote part of the file, so a fixed message keeps secrets off the screen.
  try { config = JSON.parse(text); } catch { throw new Error("The private configuration is not valid JSON. Fix it in a private editor."); }
  if (config.exact?.appId !== exactAppId) throw new Error("The configuration's Exact app ID does not match settings.exactAppId.");
  if (!config.exact.appSecret || /REPLACE/.test(config.exact.appSecret)) throw new Error("The configuration has no Exact app secret.");
  if (config.clients?.length !== 3) throw new Error("The configuration must contain the three AI clients.");
}

/**
 * A different file replaces live keys and client secrets and signs everyone out, so it needs an explicit flag.
 * A stored value without a matching fingerprint (filled by hand, or an interrupted run) counts as different.
 */
export function checkConfigChange(secret, hash, replace) {
  const deployedHash = secret.Tags?.find((tag) => tag.Key === "ConfigSha256")?.Value;
  if (Object.keys(secret.VersionIdsToStages ?? {}).length > 0 && deployedHash !== hash && !replace) {
    throw new Error("This configuration file differs from the deployed one. Deploying it signs everyone out. If that is intended, run again with --replace-config.");
  }
}

export function stackTags(s) {
  return ["--tags", "Project=exact-mcp", "System=exact-mcp", "Environment=production", "ManagedBy=exact-mcp-self-host",
    ...Object.entries(s.tags).map(([key, value]) => `${key}=${value}`)];
}

/** Service stack parameters, built from the foundation outputs and the settings. */
export function serviceParameters(s, out, imageUri) {
  return { VpcId: out.VpcId, VpcCidr: out.VpcCidr, PublicSubnets: out.PublicSubnets, PrivateSubnets: out.PrivateSubnets,
    CertificateArn: out.CertificateArn, Hostname: s.hostname, HostedZoneId: s.hostedZoneId, ImageUri: imageUri,
    ImageRepositoryArn: out.ImageRepositoryArn, ConfigSecretArn: out.ConfigSecretArn, ConfigKeyArn: out.ConfigKeyArn,
    ExactAppId: s.exactAppId, AppCallsPerMinute: String(s.budgets.appPerMinute),
    DivisionCallsPerMinute: String(s.budgets.divisionPerMinute), AppCallsPerDay: String(s.budgets.appPerDay),
    DivisionCallsPerDay: String(s.budgets.divisionPerDay), TagOwner: s.tags.Owner ?? "not-set",
    TagDataClass: s.tags.DataClass ?? "not-set", TagRetentionClass: s.tags.RetentionClass ?? "not-set", TagReviewBy: s.tags.ReviewBy ?? "not-set" };
}

async function main() {
  const { values } = parseArgs({ options: { settings: { type: "string" }, review: { type: "boolean" },
    "replace-config": { type: "boolean" } } });
  if (!values.settings) throw new Error("Usage: npm run deploy -- --settings /private/path/deploy-settings.json [--review] [--replace-config]");
  const s = readSettings(readFileSync(values.settings, "utf8"));
  const configText = readFileSync(s.configFile, "utf8");
  checkConfig(configText, s.exactAppId);
  const configHash = createHash("sha256").update(configText).digest("hex");
  const awsTarget = ["--region", s.region, ...(s.profile ? ["--profile", s.profile] : [])];
  const aws = (args, { quiet } = {}) => execFileSync("aws", [...args, ...awsTarget],
    { encoding: "utf8", stdio: quiet ? ["ignore", "ignore", "inherit"] : ["ignore", "pipe", "inherit"] });
  const step = (text) => process.stdout.write(`\n== ${text}\n`);
  const deploy = (name, template, params) => {
    step(`${values.review ? "Preparing a change set for" : "Deploying"} ${name} (this can take 5 to 15 minutes)`);
    execFileSync("aws", ["cloudformation", "deploy", ...awsTarget,
      "--stack-name", name, "--template-file", resolve(root, template), "--capabilities", "CAPABILITY_IAM",
      "--no-fail-on-empty-changeset", ...(values.review ? ["--no-execute-changeset"] : []),
      "--parameter-overrides", ...Object.entries(params).map(([k, v]) => `${k}=${v}`), ...stackTags(s)], { stdio: "inherit" });
  };

  step("Checking the AWS account you are signed in to");
  process.stdout.write(aws(["sts", "get-caller-identity", "--query", "Arn", "--output", "text"]));
  let existing;
  try {
    existing = execFileSync("aws", ["cloudformation", "describe-stacks", "--stack-name", `${s.stackPrefix}-foundation`,
      "--query", "Stacks[0].Parameters[?ParameterKey=='Hostname'].ParameterValue | [0]", "--output", "text", ...awsTarget],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    // A new copy has no stacks yet; any other failure stops the deploy.
    if (!/does not exist/.test(String(error.stderr))) throw error;
  }
  checkOwner(existing, s);
  deploy(`${s.stackPrefix}-foundation`, "infra/foundation.yaml", { Hostname: s.hostname, HostedZoneId: s.hostedZoneId });
  if (values.review) return process.stdout.write("\nReview the change set in the CloudFormation console, then run again without --review.\n");
  const out = Object.fromEntries(JSON.parse(aws(["cloudformation", "describe-stacks", "--stack-name", `${s.stackPrefix}-foundation`,
    "--query", "Stacks[0].Outputs", "--output", "json"])).map((o) => [o.OutputKey, o.OutputValue]));

  step("Storing the private configuration in AWS Secrets Manager (not printed)");
  checkConfigChange(JSON.parse(aws(["secretsmanager", "describe-secret", "--secret-id", out.ConfigSecretArn, "--output", "json"])),
    configHash, values["replace-config"]);
  // Fingerprint first: if the upload then fails, the next run with another file is refused, never let through.
  aws(["secretsmanager", "tag-resource", "--secret-id", out.ConfigSecretArn, "--tags", `Key=ConfigSha256,Value=${configHash}`], { quiet: true });
  // The CLI reads the file again, so stop if it changed since it was checked and fingerprinted.
  if (createHash("sha256").update(readFileSync(s.configFile, "utf8")).digest("hex") !== configHash) {
    throw new Error("The configuration file changed during the deploy. Run the deploy again.");
  }
  aws(["secretsmanager", "put-secret-value", "--secret-id", out.ConfigSecretArn, "--secret-string", `file://${s.configFile}`], { quiet: true });

  step("Building and uploading the container image");
  const tag = `build-${Date.now()}`; const registry = out.ImageRepositoryUri.split("/")[0];
  execFileSync("docker", ["login", "--username", "AWS", "--password-stdin", registry],
    { input: aws(["ecr", "get-login-password"]), stdio: ["pipe", "inherit", "inherit"] });
  execFileSync("docker", ["buildx", "build", "--platform", "linux/amd64", "--provenance=false", "--sbom=false",
    "-t", `${out.ImageRepositoryUri}:${tag}`, "--push", root], { stdio: "inherit" });
  const digest = aws(["ecr", "describe-images", "--repository-name", out.ImageRepositoryUri.split("/").slice(1).join("/"),
    "--image-ids", `imageTag=${tag}`, "--query", "imageDetails[0].imageDigest", "--output", "text"]).trim();

  deploy(`${s.stackPrefix}-service`, "infra/production.yaml", serviceParameters(s, out, `${out.ImageRepositoryUri}@${digest}`));

  step(`Checking https://${s.hostname}/health`);
  for (let attempt = 1; attempt <= 30; attempt++) {
    const status = await fetch(`https://${s.hostname}/health`).then((r) => r.status, () => 0);
    if (status === 200) return process.stdout.write(`The service is up at https://${s.hostname}/mcp\n`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error("The service did not report healthy within 5 minutes. Check the ECS service events in the AWS console.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
