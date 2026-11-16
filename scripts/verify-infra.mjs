import { spawnSync } from "node:child_process";

for (const [command, args] of [["cfn-lint", ["--regions", "eu-central-1", "eu-west-1", "--format", "json", "-t", "infra/production.yaml", "infra/foundation.yaml", "infra/audit.yaml"]],
  ["cfn-guard", ["validate", "--rules", "infra/guards.guard", "--data", "infra/production.yaml", "--data", "infra/foundation.yaml", "--data", "infra/audit.yaml"]]]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) process.stderr.write(`${command} is required for infrastructure validation. Install it before release.\n`);
  if (result.error || result.status !== 0) process.exit(result.status ?? 1);
}
