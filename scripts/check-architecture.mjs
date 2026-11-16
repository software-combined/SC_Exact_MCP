import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
function files(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? files(resolve(path, entry.name)) : [resolve(path, entry.name)]);
}
const errors = [];
for (const file of files(resolve(root, "src/hosted")).filter((path) => path.endsWith(".ts"))) {
  const layer = file.split("/hosted/")[1].split("/")[0];
  const imports = [...readFileSync(file, "utf8").matchAll(/(?:from\s*|import\s*\()(["'])([^"']+)\1/g)].map((match) => match[2]);
  for (const specifier of imports) {
    const target = specifier.startsWith(".") ? resolve(dirname(file), specifier) : specifier;
    if (specifier.startsWith(".") && !target.startsWith(resolve(root, "src/hosted") + "/")) {
      errors.push(`${file}: hosted imports legacy code: ${specifier}`);
    }
    if (layer === "domain" && (specifier !== "zod" && !target.startsWith(resolve(root, "src/hosted/domain") + "/"))) {
      errors.push(`${file}: domain imports an adapter: ${specifier}`);
    }
    if (["exact", "storage"].includes(layer) && /\/hosted\/(oauth|transport|runtime)\//.test(target)) {
      errors.push(`${file}: adapter imports an outer layer: ${specifier}`);
    }
    if (layer === "runtime" && /\/hosted\/(oauth|transport)\//.test(target) && !file.endsWith("/config.ts")) {
      errors.push(`${file}: application service imports an outer layer: ${specifier}`);
    }
    if (layer !== "transport" && specifier.startsWith("@modelcontextprotocol/")) errors.push(`${file}: MCP outside transport`);
    if (layer !== "storage" && specifier.startsWith("@aws-sdk/") && !file.endsWith("/main.ts")) errors.push(`${file}: AWS outside adapter`);
  }
}
if (errors.length) { process.stderr.write(errors.join("\n") + "\n"); process.exit(1); }
process.stdout.write("Hosted import boundaries pass.\n");
