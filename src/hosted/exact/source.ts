import { z } from "zod";
import type { Query } from "../domain/contracts.js";
import { plan, type ReadPlan } from "./query-plan.js";
import { exactUserSchema, ServiceError, type Region, type SourceTokens } from "../domain/identity.js";
import { jsonResponse, rowsEnvelope } from "./http.js";
import { tokenResponse } from "./token-response.js";

const origins: Record<Region, string> = { nl: "https://start.exactonline.nl", be: "https://start.exactonline.be",
  de: "https://start.exactonline.de", fr: "https://start.exactonline.fr", uk: "https://start.exactonline.co.uk",
  es: "https://start.exactonline.es", com: "https://start.exactonline.com" };
const meSchema = z.object({ UserID: exactUserSchema, CurrentDivision: z.number().int().positive(),
  FullName: z.string().max(200) });

export interface SourceConfig { region: Region; appId: string; appSecret: string; callback: string }
export type SourceRequest = <T>(read: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal) => Promise<T>;
const boundedRequest: SourceRequest = (read, signal) => read(signal ?
  AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000));
export class ExactSource {
  readonly origin: string;
  constructor(readonly config: SourceConfig, private fetcher: typeof fetch = fetch, localTestOrigin?: string,
    private request: SourceRequest = boundedRequest, private reserveExchange = async () => fetcher) {
    if (localTestOrigin && !/^http:\/\/127\.0\.0\.1:\d+$/.test(localTestOrigin)) throw new Error("Only a loopback test origin is allowed.");
    this.origin = localTestOrigin ?? origins[config.region];
  }
  authorizeUrl(state: string): string {
    const url = new URL("/api/oauth2/auth", this.origin);
    url.search = new URLSearchParams({ client_id: this.config.appId, redirect_uri: this.config.callback,
      response_type: "code", state }).toString();
    return url.href;
  }
  async prepareExchange() {
    const fetcher = await this.reserveExchange();
    return { exchange: (kind: "code" | "refresh", value: string, signal: AbortSignal) => this.exchange(kind, value, signal, fetcher),
      me: (token: string, signal: AbortSignal) => this.me(token, signal, fetcher) };
  }
  async exchange(kind: "code" | "refresh", value: string, independent?: AbortSignal, fetcher = this.fetcher): Promise<SourceTokens> {
    const body = new URLSearchParams({ client_id: this.config.appId, client_secret: this.config.appSecret,
      grant_type: kind === "code" ? "authorization_code" : "refresh_token",
      ...(kind === "code" ? { code: value, redirect_uri: this.config.callback } : { refresh_token: value }) });
    const response = await fetcher(`${this.origin}/api/oauth2/token`, { method: "POST", body,
      redirect: "error", signal: independent ?? AbortSignal.timeout(15_000) });
    return tokenResponse(response);
  }
  private async get(url: URL, token: string, signal?: AbortSignal, fetcher = this.fetcher): Promise<unknown> {
    return this.request(async (active) => {
      const response = await fetcher(url, { method: "GET", redirect: "error", signal: active,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      return jsonResponse(response);
    }, signal);
  }
  async me(token: string, independent?: AbortSignal, fetcher = this.fetcher) {
    const url = new URL("/api/v1/current/Me", this.origin);
    url.searchParams.set("$select", "UserID,CurrentDivision,FullName");
    const result = rowsEnvelope(await this.get(url, token, independent, fetcher));
    const parsed = meSchema.safeParse(result.rows[0]);
    if (!parsed.success || result.rows.length !== 1 || result.next) {
      throw new ServiceError("reauth_required", "Exact identity could not be established. Reconnect.", 401);
    }
    return parsed.data;
  }
  private url(division: number, read: ReadPlan): URL {
    const key = read.key ? `(guid'${z.guid().parse(read.key)}')` : "";
    const url = new URL(`/api/v1/${division}/${read.resource}${key}`, this.origin);
    url.searchParams.set("$select", read.select);
    if (read.filter) url.searchParams.set("$filter", read.filter);
    if (read.orderBy) url.searchParams.set("$orderby", read.orderBy);
    return url;
  }
  private continuation(base: URL, next: string): URL {
    const url = new URL(next, this.origin);
    if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || url.hash) {
      throw new ServiceError("unavailable", "Exact returned an unsafe continuation.");
    }
    const allowed = new Set([...base.searchParams.keys(), "$skiptoken"]);
    for (const [key, value] of url.searchParams) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1 ||
        (key !== "$skiptoken" && value !== base.searchParams.get(key))) {
        throw new ServiceError("unavailable", "Exact changed the query in its continuation.");
      }
    }
    for (const [key, value] of base.searchParams) {
      // Exact may omit unchanged query options; restore the fixed originals.
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    if (!url.searchParams.get("$skiptoken")) throw new ServiceError("unavailable", "Exact returned no usable continuation.");
    return url;
  }
  async company(division: number, token: string, signal: AbortSignal) {
    const url = this.url(division, { resource: "system/Divisions", select: "Code,Description,Currency",
      filter: `Code eq ${division}` });
    const result = rowsEnvelope(await this.get(url, token, signal));
    if (result.rows.length !== 1 || result.next) throw new ServiceError("denied", "This company is not available to this personal Exact connection.", 403);
    return result.rows[0];
  }
  async read(query: Query, division: number, token: string, signal: AbortSignal, continuation?: string) {
    const read = plan(query);
    const base = this.url(division, read);
    const url = continuation ? this.continuation(base, continuation) : base;
    const raw = await this.get(url, token, signal);
    if (read.key) {
      const d = raw && typeof raw === "object" && "d" in raw ? raw.d : undefined;
      if (!d || typeof d !== "object" || Array.isArray(d)) throw new ServiceError("unavailable", "Exact returned an invalid invoice.");
      return { rows: [d] };
    }
    const result = rowsEnvelope(raw);
    if (result.rows.length > 100) throw new ServiceError("unavailable", "Exact page exceeds the safe row bound. Narrow the query.");
    return { rows: result.rows, next: result.next ? this.continuation(base, result.next).href : undefined };
  }
}
