import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it.each(["connect", "refresh"])("SIGTERM during %s preflight cancels the actual HTTP caller before issuance", async (operation) => {
  const shutdown = new URL("../../src/hosted/runtime/shutdown.ts", import.meta.url).href;
  const helpers = new URL("./helpers.ts", import.meta.url).href;
  const script = `
    import { Client } from "@modelcontextprotocol/sdk/client/index.js";
    import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
    import { installShutdown } from ${JSON.stringify(shutdown)};
    import { authorization, exchange, harness } from ${JSON.stringify(helpers)};
    const h = await harness();
    const client = new Client({ name: "shutdown-fixture", version: "1" });
    if (${JSON.stringify(operation)} === "refresh") {
      const { token } = await exchange(h, await authorization(h));
      const principal = await h.broker.authenticate(token.access_token);
      const connection = await h.connections.authorize(principal);
      const key = h.connections.key(principal.subject); const old = await h.store.read(key);
      const sourceTokens = await h.cipher.open(connection.credentials, key);
      sourceTokens.issuedAt = Date.now() - 570000; sourceTokens.expiresAt = Date.now() + 20000;
      await h.store.write(key, { ...connection, expiresAt: sourceTokens.expiresAt,
        credentials: await h.cipher.seal(sourceTokens, key) }, old.version);
      await client.connect(new StreamableHTTPClientTransport(new URL(h.origin + "/mcp"), {
        requestInit: { headers: { Authorization: "Bearer " + token.access_token } } }));
    }
    let entered, resume;
    const paused = new Promise(resolve => { entered = resolve; });
    const continued = new Promise(resolve => { resume = resolve; });
    const write = h.store.write.bind(h.store); let blocked = false;
    h.store.write = async (key, ...args) => {
      const result = await write(key, ...args);
      if (!blocked && key === h.connections.gate.key) { blocked = true; entered(); await continued; }
      return result;
    };
    installShutdown(h.server);
    const before = h.calls.filter(call => call.path === "/api/oauth2/token").length;
    const pending = (${JSON.stringify(operation)} === "connect" ? authorization(h) :
      client.callTool({ name: "company_discovery", arguments: {} })).catch(() => undefined);
    await paused;
    const closed = new Promise(resolve => h.server.once("close", resolve));
    process.kill(process.pid, "SIGTERM"); await closed; resume(); await pending;
    for (let i = 0; i < 100 && (await h.connections.gate.status()).attempt; i++) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    const issued = h.calls.filter(call => call.path === "/api/oauth2/token").length !== before;
    if (issued || (await h.connections.gate.status()).attempt) throw new Error(JSON.stringify({
      issued, gateRetained: Boolean((await h.connections.gate.status()).attempt), outcomes: h.logs.map(record => record.outcome) }));
    await client.close(); h.exactServer.closeAllConnections();
    await new Promise(resolve => h.exactServer.close(resolve));
    process.stdout.write(JSON.stringify({ issued: false, gateReleased: true }) + "\\n");
  `;
  const { stdout } = await promisify(execFile)(process.execPath,
    ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", script], {
      env: { PATH: process.env.PATH ?? "" }, timeout: 5000 });
  expect(JSON.parse(stdout)).toEqual({ issued: false, gateReleased: true });
});

it("lets the actual SIGTERM handler drain outbound persistence after the HTTP caller closes", async () => {
  const shutdown = new URL("../../src/hosted/runtime/shutdown.ts", import.meta.url).href;
  const script = `
    import { createServer, get } from "node:http";
    import { installShutdown } from ${JSON.stringify(shutdown)};
    const listen = async (server) => {
      await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
      return "http://127.0.0.1:" + server.address().port;
    };
    let began;
    const started = new Promise(resolve => { began = resolve; });
    const source = createServer((_req, res) => {
      began(); setTimeout(() => res.end("fictional persistence confirmed"), 150);
    });
    const sourceOrigin = await listen(source);
    const server = createServer(() => {
      void fetch(sourceOrigin).then(response => response.text()).then(() => {
        process.stdout.write(JSON.stringify({ persisted: true }) + "\\n");
        source.closeAllConnections(); source.close();
      }).catch(() => process.exit(1));
    });
    installShutdown(server);
    const caller = get(await listen(server)); caller.on("error", () => {});
    await started; caller.destroy();
    await new Promise(resolve => setTimeout(resolve, 10));
    process.kill(process.pid, "SIGTERM");
  `;
  const { stdout } = await promisify(execFile)(process.execPath,
    ["--import", import.meta.resolve("tsx"), "--input-type=module", "-e", script], {
      env: { PATH: process.env.PATH ?? "" }, timeout: 5000 });
  expect(JSON.parse(stdout)).toEqual({ persisted: true });
});
