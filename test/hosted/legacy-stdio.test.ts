import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, it } from "vitest";

it.each([["false", 147], ["true", 74]] as const)("retains the actual legacy ESM stdio entry point in readOnly=%s", async (readOnly, count) => {
  const directory = await mkdtemp(resolve(tmpdir(), "scg-exact-legacy-"));
  const client = new Client({ name: "legacy-fixture", version: "1" });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: ["--import", import.meta.resolve("tsx"), resolve("src/index.ts")], cwd: directory,
    env: { PATH: process.env.PATH ?? "", EXACT_READ_ONLY: readOnly }, stderr: "pipe" });
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    expect(listed.tools).toHaveLength(count);
    expect(listed.tools.some((tool) => tool.name === "exact_request")).toBe(true);
    expect(listed.tools.some((tool) => tool.name === "company_discovery")).toBe(false);
  } finally { await client.close(); await rm(directory, { recursive: true, force: true }); }
});
