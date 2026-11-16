import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const excluded = new Set([".git", "node_modules", "dist"]);
// Lockfiles are generated; this fixture is pure upstream property-name data.
const exempt = new Set(["package-lock.json", "test/fixtures/exact-properties.json"]);
function files(dir, prefix = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = prefix + entry.name;
    return entry.isDirectory() ? excluded.has(entry.name) ? [] : files(resolve(dir, entry.name), name + "/") : [name];
  });
}
let failed = false;
for (const path of files(process.cwd())) {
  if (exempt.has(path) || !(/\.(?:ts|mts|mjs|js|json|ya?ml|md|guard)$/.test(path) || path === "Dockerfile")) continue;
  const contents = readFileSync(path, "utf8");
  const count = contents ? contents.split("\n").length - (contents.endsWith("\n") ? 1 : 0) : 0;
  const [soft, hard] = path.endsWith("AGENTS.md") ? [200, 300] : path.endsWith(".md") ? [200, 400] :
    path.startsWith("test/") ? [300, 500] : [250, 400];
  if (count > hard) { failed = true; process.stderr.write(`${path}: ${count} lines exceeds hard limit ${hard}.\n`); }
  else if (count > soft) process.stdout.write(`${path}: ${count} lines; soft limit ${soft}.\n`);
}
if (failed) process.exit(1);
process.stdout.write("Physical line limits pass.\n");
