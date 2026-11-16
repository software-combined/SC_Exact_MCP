import Provider, { errors, interactionPolicy, type Configuration, type JWKS, type ClientMetadata } from "oidc-provider";
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from "jose";
import { z } from "zod";
import { ServiceError, type Principal, type StateStore } from "../domain/identity.js";
import type { Connections } from "../runtime/connections.js";
import type { Budgets } from "../runtime/budgets.js";
import { providerAdapter } from "./adapter.js";

export interface BrokerConfig { origin: string; clients: ClientMetadata[]; jwks: JWKS; cookieKeys: string[] }
export interface GrantBinding { subject: string; clientId: string; generation: number }
const claims = z.object({ sub: z.string(), client_id: z.string(), grant_id: z.string(),
  connection_generation: z.number().int().positive(), scope: z.literal("exact.read") });

export class Broker {
  readonly provider: Provider;
  readonly resource: string;
  private verifyKeys;
  constructor(readonly config: BrokerConfig, private store: StateStore, readonly connections: Connections, readonly signIns: Budgets) {
    this.resource = `${config.origin}/mcp`;
    const publicKeys = config.jwks.keys.map(({ kty, n, e, kid, use, alg }) => ({ kty, n, e, kid, use, alg }));
    this.verifyKeys = createLocalJWKSet({ keys: publicKeys } as JSONWebKeySet);
    const policy = interactionPolicy.base();
    policy.get("login")!.checks.add(new interactionPolicy.Check("active_connection",
      "A current personal Exact connection is required", "login_required", (ctx) => !ctx.oidc.account), 0);
    const configuration: Configuration = {
      adapter: providerAdapter(store), clients: config.clients, jwks: config.jwks,
      cookies: { keys: config.cookieKeys, short: { sameSite: "lax" }, long: { sameSite: "lax" } },
      scopes: ["exact.read"], responseTypes: ["code"],
      pkce: { required: () => true },
      ttl: { AccessToken: 300, AuthorizationCode: 60, Interaction: 600, Session: 28_800,
        Grant: 2_592_000, RefreshToken: 2_592_000 },
      issueRefreshToken: () => true,
      rotateRefreshToken: true,
      expiresWithSession: () => false,
      interactions: { policy, url: (_ctx, interaction) => `${config.origin}/interaction/${interaction.uid}` },
      features: { devInteractions: { enabled: false }, registration: { enabled: false },
        userinfo: { enabled: false }, revocation: { enabled: true },
        resourceIndicators: { enabled: true, defaultResource: () => this.resource, useGrantedResource: () => true,
          getResourceServerInfo: (_ctx, resource) => {
            if (resource !== this.resource) throw new errors.InvalidTarget();
            return { scope: "exact.read", audience: this.resource, accessTokenTTL: 300,
              accessTokenFormat: "jwt", jwt: { sign: { alg: "RS256" } } };
          } } },
      findAccount: async (_ctx, accountId) => {
        try {
          const connection = await connections.active(accountId);
          return { accountId: connection.subject, claims: () => ({ sub: connection.subject }) };
        } catch { return undefined; }
      },
      loadExistingGrant: async (ctx) => {
        const clientId = ctx.oidc.client?.clientId; const accountId = ctx.oidc.account?.accountId;
        const grantId = ctx.oidc.result?.consent?.grantId ?? (clientId ? ctx.oidc.session?.grantIdFor(clientId) : undefined);
        if (!clientId || !accountId || !grantId) return undefined;
        try {
          const grant = await ctx.oidc.provider.Grant.find(grantId);
          const binding = await this.binding(grantId);
          if (!grant || grant.isExpired || grant.accountId !== accountId || grant.clientId !== clientId ||
            binding.subject !== accountId || binding.clientId !== clientId) return undefined;
          await connections.authorize({ ...binding, grantId });
          return grant;
        } catch { return undefined; }
      },
      extraTokenClaims: async (_ctx, token) => {
        if (!("grantId" in token) || !token.grantId || !("accountId" in token) || !token.accountId) {
          throw new errors.InvalidGrant("A personal grant is required.");
        }
        const binding = await this.binding(token.grantId);
        if (binding.subject !== token.accountId || binding.clientId !== token.clientId) throw new errors.InvalidGrant();
        await connections.authorize({ ...binding, grantId: token.grantId });
        return { grant_id: token.grantId, connection_generation: binding.generation };
      },
      renderError: (ctx) => { ctx.type = "text/plain"; ctx.body = "Authorization failed. Check the client registration or sign in again."; },
    };
    this.provider = new Provider(config.origin, configuration);
    this.provider.proxy = true;
    // Library events carry sensitive objects. Log only the outer request outcome.
    this.provider.on("server_error", () => {});
  }
  async binding(grantId: string): Promise<GrantBinding> {
    const binding = await this.store.read<GrantBinding>(`grant-binding:${grantId}`);
    if (!binding || await this.store.read(`oidc-revoked:${grantId}`)) {
      throw new ServiceError("denied", "This client grant is expired or revoked. Authorize again.", 401);
    }
    return binding.value;
  }
  async authenticate(raw: string): Promise<Principal> {
    try {
      const { payload, protectedHeader } = await jwtVerify(raw, this.verifyKeys, {
        issuer: this.config.origin, audience: this.resource, algorithms: ["RS256"], typ: "at+jwt", maxTokenAge: "5m" });
      if (protectedHeader.typ !== "at+jwt" || payload.aud !== this.resource) throw new Error("Invalid audience.");
      const parsed = claims.parse(payload);
      if (!this.config.clients.some((client) => client.client_id === parsed.client_id)) throw new Error("Unknown client.");
      const binding = await this.binding(parsed.grant_id);
      const grant = await this.provider.Grant.find(parsed.grant_id);
      if (!grant || grant.isExpired || grant.accountId !== parsed.sub || grant.clientId !== parsed.client_id ||
        binding.subject !== parsed.sub || binding.clientId !== parsed.client_id || binding.generation !== parsed.connection_generation) {
        throw new Error("Inactive grant.");
      }
      const principal: Principal = { subject: parsed.sub, clientId: parsed.client_id,
        grantId: parsed.grant_id, generation: parsed.connection_generation };
      await this.connections.authorize(principal);
      return principal;
    } catch { throw new ServiceError("denied", "A current SCG personal access token is required. Authorize this client again.", 401); }
  }
  async consent(accountId: string, clientId: string): Promise<string> {
    const connection = await this.connections.active(accountId);
    const grant = new this.provider.Grant({ accountId, clientId });
    grant.addOIDCScope("openid exact.read");
    grant.addResourceScope(this.resource, "exact.read");
    const id = await grant.save();
    const binding: GrantBinding = { subject: accountId, clientId, generation: connection.generation };
    if (!await this.store.write(`grant-binding:${id}`, binding, undefined, Date.now() + 2_592_000_000)) {
      throw new ServiceError("unavailable", "Could not persist consent.");
    }
    await this.connections.authorize({ ...binding, grantId: id });
    return id;
  }
}
