import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { MemoryStore } from "../../src/hosted/storage/memory.js";
import { ExactSource } from "../../src/hosted/exact/source.js";
import type { CredentialCipher, SourceTokens } from "../../src/hosted/domain/identity.js";
import { Connections } from "../../src/hosted/runtime/connections.js";
import { Budgets, type Limits } from "../../src/hosted/runtime/budgets.js";
import { Cursors } from "../../src/hosted/runtime/cursors.js";
import { Accounting } from "../../src/hosted/runtime/accounting.js";
import { SourceSlot } from "../../src/hosted/runtime/source-slot.js";
import { Changes } from "../../src/hosted/runtime/changes.js";


import { USER_A, NEW_RECORD, companyRow, customerRow, invoiceRow, itemRow, receivableRow } from "./records.js";
export * from "./records.js";

export class TestCipher implements CredentialCipher {
  async seal(value: SourceTokens, context: string) { return JSON.stringify({ context, value }); }
  async open(value: string, context: string) {
    const parsed = JSON.parse(value); if (parsed.context !== context) throw new Error("Wrong principal.");
    return parsed.value as SourceTokens;
  }
}
export async function listen(server: Server, port = 0): Promise<string> {
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
export async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
export async function reservePort() { const server = createServer(); const origin = await listen(server); await close(server); return Number(new URL(origin).port); }


export async function exactFixture(callback = "http://127.0.0.1:9999/exact/callback", limits: Limits = {
  appCallsPerMinute: 1000, divisionCallsPerMinute: 1000, appCallsPerDay: 10_000, divisionCallsPerDay: 10_000 }) {
  const store = new MemoryStore();
  const cipher = new TestCipher();
  const calls: { method: string; path: string; query: URLSearchParams; authorization?: string; body?: unknown }[] = [];
  const access = new Map<string, string>(); const refresh = new Map<string, string>();
  const codes = new Map<string, string>();
  const fake = { user: USER_A, currentDivision: 123456, denyDivision: false, tokenStatus: 200, tokenError: "invalid_grant",
    tokenDelay: 0, responseOverride: undefined as unknown, next: undefined as string | undefined, rowId: undefined as string | undefined,
    readOverride: undefined as ((url: URL, user: string) => { body: unknown; status?: number } | undefined) | undefined,
    writeOverride: undefined as ((url: URL, method: string, user: string, body: unknown) =>
      { body: unknown; status: number } | undefined) | undefined,
    readBarrier: undefined as Promise<void> | undefined, journals: [{ Code: "70", Description: "Sales", IsBlocked: false }] as unknown[],
    refuseChange: undefined as string | undefined, failChange: false, journalsNext: false, invoicesNext: false,
    customers: undefined as unknown[] | undefined, items: undefined as unknown[] | undefined };
  const exactServer = createServer((req, res) => { void (async () => {
    const url = new URL(req.url!, "http://localhost");
    calls.push({ method: req.method!, path: url.pathname, query: url.searchParams, authorization: req.headers.authorization });
    const send = (value: unknown, status = 200) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(value)); };
    if (url.pathname === "/api/oauth2/auth") {
      const code = randomBytes(16).toString("hex"); codes.set(code, fake.user);
      const target = new URL(callback); target.search = new URLSearchParams({ code, state: url.searchParams.get("state")! }).toString();
      res.writeHead(303, { Location: target.href }); return res.end();
    }
    if (url.pathname === "/api/oauth2/token") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const input = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
      if (fake.tokenDelay) await new Promise((resolve) => setTimeout(resolve, fake.tokenDelay));
      if (fake.tokenStatus !== 200) return send({ error: fake.tokenError }, fake.tokenStatus);
      const isCode = input.get("grant_type") === "authorization_code";
      const key = input.get(isCode ? "code" : "refresh_token")!;
      const user = (isCode ? codes : refresh).get(key);
      if (!user) return send({ error: "invalid_grant" }, 400);
      (isCode ? codes : refresh).delete(key);
      for (const [previous, owner] of refresh) if (owner === user) refresh.delete(previous);
      const a = `fictional-a-${randomBytes(8).toString("hex")}`; const r = `fictional-r-${randomBytes(8).toString("hex")}`;
      access.set(a, user); refresh.set(r, user);
      return send({ access_token: a, refresh_token: r, token_type: "Bearer", expires_in: "600" });
    }
    const user = access.get((req.headers.authorization ?? "").slice(7));
    if (!user) return send({ error: "unauthorized" }, 401);
    if (url.pathname === "/api/v1/current/Me") return send({ d: [{ UserID: user, CurrentDivision: fake.currentDivision, FullName: "Fictional user" }] });
    if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      const body = raw ? JSON.parse(raw) : undefined;
      calls[calls.length - 1].body = body;
      const overridden = fake.writeOverride?.(url, req.method, user, body);
      if (overridden?.status === 204) { res.writeHead(204); return res.end(); }
      if (overridden) return send(overridden.body, overridden.status);
      if (fake.failChange) return send({ error: "fictional outage" }, 500);
      if (fake.refuseChange) return send({ error: { code: "", message: { lang: "", value: fake.refuseChange } } }, 400);
      if (req.method === "PUT") { res.writeHead(204); return res.end(); }
      return send({ d: url.pathname.endsWith("/SalesInvoices") ? { InvoiceID: NEW_RECORD, InvoiceNumber: 20260002 } :
        { ID: NEW_RECORD, Code: "             C0002" } }, 201);
    }
    if (url.pathname.endsWith("/financial/Journals")) return send({ d: { results: fake.journals, ...(fake.journalsNext ? { __next: `${url.href}&$skiptoken=1` } : {}) } });
    // Like Exact, $top returns at most that many rows as a plain array.
    const top = Number(url.searchParams.get("$top")) || undefined;
    if (url.pathname.endsWith("/logistics/Items")) return send({ d: (fake.items ?? [itemRow]).slice(0, top) });
    if (fake.readBarrier) await fake.readBarrier;
    if (fake.denyDivision && url.pathname.includes("/123456/")) return send({ error: "forbidden" }, 403);
    if (fake.responseOverride !== undefined) return send(fake.responseOverride);
    if (url.pathname.endsWith("/system/Divisions")) return send({ d: [companyRow] });
    const overridden = fake.readOverride?.(url, user);
    if (overridden) return send(overridden.body, overridden.status);
    const id = fake.rowId; const customer = id ? { ...customerRow, ID: id } : customerRow;
    const invoice = id ? { ...invoiceRow, InvoiceID: id } : invoiceRow; const receivable = id ? { ...receivableRow, AccountId: id } : receivableRow;
    if (url.pathname.endsWith("/crm/Accounts") && top) return send({ d: { results: (fake.customers ?? [customer]).slice(0, top),
      ...(fake.next ? { __next: fake.next } : {}) } });
    if (url.pathname.endsWith("/crm/Accounts")) return send({ d: { results: fake.customers ?? [customer], ...(fake.next ? { __next: fake.next } : {}) } });
    if (url.pathname.includes("/salesinvoice/SalesInvoices") && fake.invoicesNext) {
      return send({ d: { results: [invoice], __next: `${url.pathname}${url.search}&$skiptoken=2` } });
    }
    if (url.pathname.includes("/salesinvoice/SalesInvoices")) return send({ d: url.pathname.includes("guid'") ? invoice : [invoice] });
    if (url.pathname.endsWith("/read/financial/ReceivablesList")) return send({ d: [receivable] });
    return send({ error: "unknown" }, 404);
  })().catch(() => { res.writeHead(500); res.end(); }); });
  const exactOrigin = await listen(exactServer);
  const budgets = new Budgets(store, "fictional-mcp-app", limits);
  const slot = new SourceSlot(store, "fictional-mcp-app");
  const source = new ExactSource({ appId: "fictional-mcp-app", appSecret: "fictional-secret", region: "nl", callback },
    budgets.fetcher(), exactOrigin, (read, signal) => slot.run(read, signal), () => budgets.exchangeFetcher());
  const connections = new Connections(store, cipher, source);
  const accounting = new Accounting(connections, budgets, new Cursors(store, source.config.appId, "nl"));
  const changes = new Changes(connections, budgets);
  return { exactOrigin, exactServer, calls, fake, store, cipher, source, connections, budgets,
    accounting, changes, codes, refresh, access, close: async () => close(exactServer) };
}
