import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Copies one AI client's ID or secret to the clipboard so it can be pasted into a portal. Never prints it.
const NAMES = { claude: "Claude", chatgpt: "ChatGPT", copilot: "Microsoft 365 Copilot" };
const [file, client, field] = process.argv.slice(2);
if (!file || !NAMES[client] || !["id", "secret"].includes(field)) {
  throw new Error("Usage: npm run copy:credential -- /private/path/config.json <claude|chatgpt|copilot> <id|secret>");
}
let config;
// The parser's own message can quote part of the file, so a fixed message keeps secrets off the screen.
try { config = JSON.parse(readFileSync(file, "utf8")); } catch { throw new Error("The configuration is not valid JSON."); }
const entry = config.clients?.find((item) => item.client_name === NAMES[client]);
if (!entry) throw new Error(`The configuration has no ${NAMES[client]} client.`);
const text = field === "id" ? entry.client_id : entry.client_secret;

const tools = { darwin: [["pbcopy", []]], win32: [["clip", []]],
  linux: [["wl-copy", []], ["xclip", ["-selection", "clipboard"]], ["xsel", ["--clipboard", "--input"]]] };
for (const [command, args] of tools[process.platform] ?? []) {
  try {
    execFileSync(command, args, { input: text, stdio: ["pipe", "ignore", "ignore"] });
    process.stdout.write(`Copied the ${NAMES[client]} client ${field}. Paste it once, then copy something else.\n`);
    process.exit(0);
  } catch { /* Try the next clipboard tool. */ }
}
throw new Error("No clipboard tool found. Install pbcopy, clip, wl-copy, xclip or xsel.");
