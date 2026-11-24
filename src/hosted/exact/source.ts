import { z } from "zod";
import type { Query } from "../domain/contracts.js";
import { currency } from "../domain/read-fields.js";
import type { CatalogWriteRequest } from "../domain/catalogue/mutations.js";
import { matchPlan, plan, type MatchKind, type ReadPlan } from "./query-plan.js";
import { pickMatch } from "./resolve.js";
import { exactUserSchema, ServiceError, type Region, type SourceTokens } from "../domain/identity.js";
import { changeResponse, jsonResponse, rowsEnvelope } from "./http.js";
import type { ChangeRequest } from "./changes.js";
import { tokenResponse } from "./token-response.js";

const origins: Record<Region, string> = { nl: "https://start.exactonline.nl", be: "https://start.exactonline.be",
  de: "https://start.exactonline.de", fr: "https://start.exactonline.fr", uk: "https://start.exactonline.co.uk",
  es: "https://start.exactonline.es", com: "https://start.exactonline.com" };
const meSchema = z.object({ UserID: exactUserSchema, CurrentDivision: z.number().int().positive(),
  FullName: z.string().max(200) });
const supplierProof = z.object({ d: z.object({ ID: z.guid(), IsSupplier: z.literal(true) }) });
const relationBank = z.object({ Account: z.guid(), Type: z.literal("A") });
type MutationTarget = NonNullable<CatalogWriteRequest["target"]>;

function writtenFieldMatches(kind: string | undefined, actual: unknown, expected: unknown) {
  if (!kind) return false; // Binary and nested values have no scalar readback.
  if (actual === expected) return true;
  if (kind === "long" && (typeof actual === "string" || typeof actual === "number")) {
    return String(actual) === String(expected);
  }
  if (typeof actual !== "string" || typeof expected !== "string") return false;
  if (kind === "guid") return actual.toLowerCase() === expected;
  if (kind !== "date") return false;
  const exactDate = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(actual);
  const actualTime = exactDate ? Number(exactDate[1]) :
    Date.parse(/^\d{4}-\d\d-\d\dT[\d:.]+$/.test(actual) ? `${actual}Z` : actual);
  return actualTime === Date.parse(expected);
}

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
  /** Only fixed resource paths and validated key literals can reach this adapter. */
  private resourceUrl(division: number, resource: string, key?: string, kind?: ReadPlan["keyKind"]): URL {
    const literal = key === undefined ? "" : kind === "integer" ? `(${z.string().regex(/^-?\d{1,10}$/).parse(key)})` :
      kind === "currency" ? `('${z.string().regex(/^[A-Za-z]{3}$/).parse(key).toUpperCase()}')` : `(guid'${z.guid().parse(key)}')`;
    return new URL(`/api/v1/${division}/${resource}${literal}`, this.origin);
  }
  private url(division: number, read: ReadPlan): URL {
    const url = this.resourceUrl(division, read.resource, read.key, read.keyKind);
    url.searchParams.set("$select", read.select);
    if (read.filter) url.searchParams.set("$filter", read.filter);
    if (read.orderBy) url.searchParams.set("$orderby", read.orderBy);
    if (read.top) url.searchParams.set("$top", String(read.top));
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
  async salesJournals(division: number, token: string, signal: AbortSignal): Promise<unknown[]> {
    const url = this.url(division, { resource: "financial/Journals", select: "Code,Description,IsBlocked", filter: "Type eq 20" });
    const page = rowsEnvelope(await this.get(url, token, signal));
    // Choosing from a partial list could pick the wrong journal, so a long list asks the person instead.
    if (page.next) throw new ServiceError("invalid_input", "This company has many sales journals. Supply the journal as journalCode.", 400);
    return page.rows;
  }
  /**
   * Sends one change. sendBy is the latest start time that still leaves room for Exact's answer within the request,
   * so a change is never cut off by the request deadline after Exact may have acted. beforeSend runs last, after
   * any wait for the shared slot, so a disconnect during that wait still stops the change.
   */
  async change(division: number, request: ChangeRequest, token: string, signal: AbortSignal, sendBy: number,
    beforeSend: () => Promise<unknown>): Promise<unknown> {
    const url = this.resourceUrl(division, request.resource, request.key);
    // Track how far the send got, so no failure after Exact may have acted is reported as safe to retry.
    let sent = false; let answered = false; let result: unknown; let refusal: ServiceError | undefined;
    try {
      await this.request(async (active) => {
        if (Date.now() > sendBy) throw new ServiceError("limited", "Not enough time was left to send this change safely. Ask again.", 429);
        await beforeSend();
        let response: Response;
        try {
          response = await this.fetcher(url, { method: request.method, redirect: "error", signal: active,
            body: JSON.stringify(request.body), headers: { Authorization: `Bearer ${token}`, Accept: "application/json",
              "Content-Type": "application/json" } });
        } catch (error) {
          // Budget and cooldown checks refuse before anything is sent; any other failure may follow a send.
          if (!(error instanceof ServiceError && error.code !== "unavailable")) sent = true;
          throw error;
        }
        sent = true;
        try { result = await changeResponse(response); answered = true; } catch (error) {
          if (error instanceof ServiceError && error.code !== "unavailable") refusal = error;
          throw error;
        }
      }, signal);
      return result;
    } catch (error) {
      if (answered) return result; // Exact acted; only shared bookkeeping failed afterwards.
      if (refusal) throw refusal; // Exact refused, so nothing changed.
      if (!sent) { // Nothing reached Exact, so say so: the assistant may then safely ask again.
        if (error instanceof ServiceError) throw new ServiceError(error.code, `${error.message} Nothing was changed.`, error.status, error.detail);
        throw new ServiceError("unavailable", "The change could not be sent. Nothing was changed.");
      }
      throw new ServiceError("unavailable", "The change may or may not have been made in Exact. Check Exact before trying again.", 503, "change:unknown");
    }
  }
  /** Resolves a customer name or item text to one record ID with one bounded read, or asks the person to choose. */
  async resolve(kind: MatchKind, text: string, division: number, token: string, signal: AbortSignal, strict = false): Promise<string> {
    const page = rowsEnvelope(await this.get(this.url(division, matchPlan(kind, text)), token, signal));
    // The lookup asks for 11 rows and shows at most 10. More than 10 rows, or a further page, means the candidate list
    // is incomplete: a same-named record could be missing, so the lookup never picks one.
    if (page.next || page.rows.length > 10) {
      throw new ServiceError("invalid_input", "Too many records match that text. Give the exact name or code.", 400);
    }
    return pickMatch(kind, text, division, page.rows, strict);
  }
  async read(query: Query, division: number, token: string, signal: AbortSignal, continuation?: string) {
    if (query.operation === "invoice_lines") return this.invoiceLines(query, division, token, signal, continuation);
    const supplierId = query.operation === "supplier_bank_info" ? query.input.supplierId.toLowerCase() : undefined;
    if (supplierId !== undefined) {
      const accountUrl = this.url(division, { resource: "crm/Accounts", select: "ID,IsSupplier", key: supplierId });
      const account = supplierProof.safeParse(await this.get(accountUrl, token, signal));
      if (!account.success || account.data.d.ID.toLowerCase() !== supplierId) {
        throw new ServiceError("denied", "The account could not be confirmed as a supplier in this company.", 403);
      }
    }
    const result = await this.readPlan(plan(query, this.config.region), division, token, signal, continuation);
    if (supplierId !== undefined) {
      for (const row of result.rows) {
        const bank = relationBank.safeParse(row);
        if (!bank.success || bank.data.Account.toLowerCase() !== supplierId) {
          throw new ServiceError("unavailable", "Exact returned bank details outside the supplier lookup.");
        }
      }
    }
    return result;
  }
  private async invoiceLines(query: Extract<Query, { operation: "invoice_lines" }>, division: number,
    token: string, signal: AbortSignal, continuation?: string) {
    const id = query.input.invoiceId.toLowerCase();
    const sales = query.input.kind === "sales";
    const key = sales ? "InvoiceID" : "EntryID";
    const { rows } = await this.readPlan({ resource: sales ? "salesinvoice/SalesInvoices" : "purchaseentry/PurchaseEntries",
      select: `${key},Currency`, key: id }, division, token, signal);
    const header = z.object({ [key]: z.guid(), Currency: currency }).safeParse(rows[0]);
    if (!header.success || header.data[key].toLowerCase() !== id) {
      throw new ServiceError("unavailable", "Exact did not confirm this invoice's currency.");
    }
    const result = await this.readPlan(plan(query, this.config.region), division, token, signal, continuation);
    const lineSchema = z.looseObject({ [key]: z.guid() });
    return { ...result, rows: result.rows.map((row) => {
      const line = lineSchema.safeParse(row);
      if (!line.success || line.data[key].toLowerCase() !== id) {
        throw new ServiceError("unavailable", "Exact returned a line outside the requested invoice.");
      }
      return { ...line.data, InvoiceCurrency: header.data.Currency };
    }) };
  }
  async readPlan(read: ReadPlan, division: number, token: string, signal: AbortSignal, continuation?: string) {
    const base = this.url(division, read);
    const url = continuation ? this.continuation(base, continuation) : base;
    const raw = await this.get(url, token, signal);
    if (read.key) {
      const d = raw && typeof raw === "object" && "d" in raw ? raw.d : undefined;
      if (!d || typeof d !== "object" || Array.isArray(d)) throw new ServiceError("unavailable", "Exact returned an invalid record.");
      return { rows: [d], next: undefined };
    }
    const result = rowsEnvelope(raw);
    if (result.rows.length > 100) throw new ServiceError("unavailable", "Exact page exceeds the safe row bound. Narrow the query.");
    return { rows: result.rows, next: result.next ? this.continuation(base, result.next).href : undefined };
  }

  private async mutationTarget(division: number, target: MutationTarget, token: string, signal: AbortSignal, allowMissing = false) {
    const response = await this.fetcher(this.url(division, target), { method: "GET", redirect: "error", signal,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (allowMissing && response.status === 404) { await response.body?.cancel(); return null; }
    const payload = await jsonResponse(response);
    const row = payload && typeof payload === "object" && "d" in payload ? payload.d : undefined;
    const current = row && typeof row === "object" && !Array.isArray(row) ? row as Record<string, unknown> : undefined;
    if (!current || String(current[target.keyField]).toLowerCase() !== target.key) {
      throw new ServiceError("unavailable", "Could not verify the exact record.");
    }
    const selected = Object.fromEntries(target.select.split(",").filter((key) => Object.hasOwn(current, key))
      .map((key) => [key, current[key]]));
    const etag = response.headers.get("etag");
    return { selected, etag: etag && /^(W\/)?".{1,160}"$/.test(etag) ? etag : null };
  }

  readMutationTarget(division: number, target: MutationTarget, token: string, signal: AbortSignal) {
    return this.request((active) => this.mutationTarget(division, target, token, active), signal);
  }

  async applyCatalogueChange(division: number, request: CatalogWriteRequest, token: string, signal: AbortSignal,
    sendBy: number, beforeSend: (target: Awaited<ReturnType<ExactSource["mutationTarget"]>>) => Promise<void>) {
    const url = this.resourceUrl(division, request.resource, request.key);
    let dispatched = false;
    let refused: ServiceError | undefined;
    let receipt: { recordId?: string; readback: "verified" | "unverified" } | undefined;
    try {
      await this.request(async (active) => {
        const target = request.target ? await this.mutationTarget(division, request.target, token, active) : null;
        if (Date.now() > sendBy) throw new ServiceError("limited", "Too little time to send this request safely.", 429);
        await beforeSend(target);
        active.throwIfAborted();
        if (Date.now() > sendBy) throw new ServiceError("limited", "Too little time to send this request safely.", 429);
        let response: Response;
        try {
          response = await this.fetcher(url, { method: request.method, redirect: "error", signal: active,
            body: request.body ? JSON.stringify(request.body) : undefined,
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json",
              ...(request.body ? { "Content-Type": "application/json" } : {}),
              ...(target?.etag && request.key ? { "If-Match": target.etag } : {}) } });
        } catch (error) {
          // Shared call-budget and cooldown refusals happen before the fetcher sends anything.
          dispatched = !(error instanceof ServiceError && error.code === "limited");
          throw error;
        }
        dispatched = true;
        if (!response.ok && response.status >= 400 && response.status < 500 && response.status !== 408) {
          refused = new ServiceError(response.status === 401 || response.status === 403 ? "denied" :
            response.status === 429 ? "limited" : "conflict", "Exact refused this request. Nothing was changed.",
          response.status, "catalogue-change:refused");
          await response.body?.cancel();
          throw refused;
        }
        const payload = response.status === 204 ? null : await jsonResponse(response);
        const row = payload && typeof payload === "object" && "d" in payload ? payload.d : undefined;
        const data = row && typeof row === "object" ? row as Record<string, unknown> : {};
        if (["ErrorMessage", "DocumentCreationError", "EmailCreationError", "PeppolCreationError", "PostboxMessageCreationError"]
          .some((field) => typeof data[field] === "string" && data[field].trim())) throw new Error("Exact reported an action error.");
        const created = request.resultKey ? z.guid().safeParse(data[request.resultKey]) : undefined;
        const recordId = request.key ?? (created?.success ? created.data.toLowerCase() : undefined);
        receipt = { recordId, readback: "unverified" };
        if (request.method === "DELETE" && request.target) {
          if (await this.mutationTarget(division, request.target, token, active, true) === null) receipt.readback = "verified";
        } else if (request.method === "PUT" && request.target) {
          const after = await this.mutationTarget(division, request.target, token, active);
          if (after && Object.entries(request.body ?? {}).every(([field, value]) =>
            writtenFieldMatches(request.readbackFields?.[field], after.selected[field], value))) {
            receipt.readback = "verified";
          }
        } else if (recordId && request.resultKey) {
          const observed = await this.mutationTarget(division, { key: recordId, keyField: request.resultKey,
            resource: request.resource, select: request.resultKey }, token, active);
          if (observed) receipt.readback = "verified";
        }
      }, signal);
    } catch (error) {
      if (receipt) return receipt;
      if (refused) throw refused;
      if (!dispatched) {
        if (error instanceof ServiceError) {
          throw new ServiceError(error.code, `${error.message} This request sent no change.`, error.status, "catalogue-change:unsent");
        }
        throw new ServiceError("unavailable", "This request sent no change.", 503, "catalogue-change:unsent");
      }
      throw new ServiceError("unavailable", "The change may have reached Exact. Check Exact before retrying.", 503,
        "catalogue-change:unknown");
    }
    if (!receipt) throw new ServiceError("unavailable", "No Exact change result was established.");
    return receipt;
  }
}
