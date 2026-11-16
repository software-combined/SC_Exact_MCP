import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ServiceError, type StateStore } from "../domain/identity.js";
import type { Broker } from "../oauth/broker.js";
import { Interactions } from "../oauth/interactions.js";
import type { Accounting } from "../runtime/accounting.js";
import { body, json } from "./http.js";
import { hostedMcp } from "./mcp.js";
import { SHUTDOWN_EVENT } from "../runtime/shutdown.js";

export interface RequestLog { requestId: string; outcome: string; status: number; durationMs: number }

export function hostedApp(broker: Broker, accounting: Accounting, store: StateStore,
  log: (record: RequestLog) => void = () => {}) {
  const interactions = new Interactions(broker, store);
  const provider = broker.provider.callback();
  const draining = new AbortController();
  const expected = new URL(broker.config.origin);
  const allowedOrigins = new Set([expected.origin, ...broker.config.clients.flatMap((client) =>
    client.redirect_uris?.map((uri) => new URL(uri).origin) ?? [])]);
  async function route(req: IncomingMessage, res: ServerResponse) {
    const requestId = randomUUID(); const started = Date.now();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
    let outcome = "completed";
    const deadline = new AbortController();
    const requestSignal = AbortSignal.any([deadline.signal, draining.signal]);
    const timer = setTimeout(() => { outcome = "deadline"; deadline.abort(); res.destroy(); }, 25_000);
    res.once("close", () => {
      clearTimeout(timer);
      if (!res.writableEnded) { deadline.abort(); if (outcome === "completed") outcome = "cancelled"; }
      log({ requestId, outcome, status: res.statusCode, durationMs: Date.now() - started });
    });
    try {
      const url = new URL(req.url ?? "/", expected);
      if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { status: "ready" });
      if (req.headers.host !== expected.host || url.origin !== expected.origin) throw new ServiceError("denied", "Invalid service host.", 400);
      if (expected.protocol === "https:" && req.headers["x-forwarded-proto"] !== "https") {
        throw new ServiceError("denied", "HTTPS is required.", 400);
      }
      if (url.pathname === "/.well-known/oauth-protected-resource/mcp" || url.pathname === "/.well-known/oauth-protected-resource") {
        if (req.method !== "GET") throw new ServiceError("invalid_input", "Use GET for metadata.", 405);
        res.setHeader("Access-Control-Allow-Origin", "*");
        return json(res, 200, { resource: broker.resource, authorization_servers: [expected.origin],
          scopes_supported: ["exact.read"], bearer_methods_supported: ["header"] });
      }
      if (url.pathname === "/exact/callback" && req.method === "GET") return await interactions.callback(req, res, url, requestSignal);
      const interaction = /^\/interaction\/([A-Za-z0-9_-]+)(?:\/(connect|confirm|consent))?$/.exec(url.pathname);
      if (interaction) return await interactions.handle(req, res, interaction[1], interaction[2]);
      if (url.pathname === "/mcp" || url.pathname === "/connection/disconnect") {
        if (req.headers.origin && !allowedOrigins.has(req.headers.origin)) throw new ServiceError("denied", "This Origin is not registered.", 403);
        const authorization = req.headers.authorization;
        if (!authorization || !/^Bearer [A-Za-z0-9_.-]+$/.test(authorization)) throw new ServiceError("denied", "A personal SCG bearer token is required.", 401);
        const principal = await broker.authenticate(authorization.slice(7));
        requestSignal.throwIfAborted();
        if (url.pathname === "/connection/disconnect") {
          if (req.method !== "POST") throw new ServiceError("invalid_input", "Use POST to disconnect.", 405);
          await broker.connections.disconnect(principal);
          return json(res, 200, { disconnected: true, nextAction: "Authorize again to reconnect." });
        }
        if (req.method === "GET" || req.method === "DELETE") return json(res, 405, { error: "Stateless MCP has no listening stream or session to delete." });
        if (req.method !== "POST") throw new ServiceError("invalid_input", "Use POST for MCP.", 405);
        let transport: StreamableHTTPServerTransport | undefined;
        let server: ReturnType<typeof hostedMcp> | undefined;
        try {
          const request = JSON.parse(await body(req));
          if (Array.isArray(request)) throw new ServiceError("invalid_input", "Batch requests are not supported.", 400);
          transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
          server = hostedMcp(accounting, principal, requestSignal);
          await server.connect(transport);
          await transport.handleRequest(req, res, request);
        } finally {
          await transport?.close(); await server?.close();
        }
        return;
      }
      // oidc-provider owns protocol parsing, PKCE, redirect checks, and token endpoint errors.
      return provider(req, res);
    } catch (error) {
      outcome = error instanceof ServiceError ? error.code : "unavailable";
      const status = error instanceof ServiceError ? error.status : error instanceof SyntaxError ? 400 : 503;
      if (status === 401) res.setHeader("WWW-Authenticate",
        `Bearer resource_metadata="${expected.origin}/.well-known/oauth-protected-resource/mcp", scope="exact.read"`);
      if (!res.headersSent) json(res, status, { error: outcome,
        message: error instanceof ServiceError ? error.message : "The request could not be completed. Start again or contact IT.", requestId });
      else if (!res.writableEnded) res.end();
    }
  }
  const server = createServer((req, res) => { void route(req, res); });
  server.once(SHUTDOWN_EVENT, () => draining.abort());
  server.requestTimeout = 25_000; server.headersTimeout = 10_000; server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  return server;
}
