import { randomBytes } from "node:crypto";
import { ServiceError, type StateStore } from "../domain/identity.js";
import { update } from "../storage/state.js";

export interface Limits { appCallsPerMinute: number; divisionCallsPerMinute: number;
  appCallsPerDay: number; divisionCallsPerDay: number }
interface Window { period: number; app: number; divisions: Record<string, number> }
interface Usage { minute: Window[]; day: Window[] }
export class Budgets {
  constructor(private store: StateStore, private app: string, private limits: Limits, private now = () => Date.now()) {}
  signIns(): Budgets {
    if (this.limits.appCallsPerMinute < 8 || this.limits.appCallsPerDay < 8) {
      throw new Error("App budgets must allow at least eight calls for bounded public sign-in admission.");
    }
    return new Budgets(this.store, `${this.app}:sign-in`, { ...this.limits,
      appCallsPerMinute: Math.floor(this.limits.appCallsPerMinute / 4),
      appCallsPerDay: Math.floor(this.limits.appCallsPerDay / 4) }, this.now);
  }
  /** Caller enforces the 25-second request deadline; the 30-second lease also recovers crashed callers. */
  async person(subject: string): Promise<() => Promise<void>> {
    const key = `budget:person:${this.app}:${subject}`;
    const id = randomBytes(24).toString("base64url");
    await update<Record<string, number>>(this.store, key, (old = {}) => {
      const active = Object.fromEntries(Object.entries(old).filter(([, until]) => until > this.now()));
      if (Object.keys(active).length >= 2) throw new ServiceError("limited", "Two requests are already running for this person. Retry after they finish.", 429);
      return { ...active, [id]: this.now() + 30_000 };
    }, this.now() + 60_000);
    return async () => { await update<Record<string, number>>(this.store, key, (old = {}) => {
      const result = { ...old }; delete result[id]; return result;
    }, this.now() + 60_000); };
  }
  private async cooldown(division?: string) {
    for (const scope of ["app", ...(division ? [`division:${division}`] : [])]) {
      const hold = await this.store.read<number>(`cooldown:${this.app}:${scope}`);
      if (hold && hold.value > this.now()) throw new ServiceError("limited", "Exact's shared retry cooldown is active. Retry later.", 429);
    }
  }
  async available(division: number) {
    const usage = (await this.store.read<Usage>(`budget:source:${this.app}`))?.value;
    const now = this.now();
    const remaining = (windows: Window[] | undefined, span: number, appLimit: number, divisionLimit: number) => {
      const current = Math.floor(now / span);
      const window = windows?.find((entry) => entry.period === current);
      return { appRemaining: Math.max(0, appLimit - (window?.app ?? 0)),
        divisionRemaining: Math.max(0, divisionLimit - (window?.divisions[division] ?? 0)),
        resetsAt: new Date((current + 1) * span).toISOString() };
    };
    return { source: "Configured MCP budget" as const,
      minute: remaining(usage?.minute, 60_000, this.limits.appCallsPerMinute, this.limits.divisionCallsPerMinute),
      day: remaining(usage?.day, 86_400_000, this.limits.appCallsPerDay, this.limits.divisionCallsPerDay) };
  }
  async call(division?: string, count = 1, through = this.now()) {
    await this.cooldown(division);
    // Admit every applicable limit in one CAS: a rejected division must not spend app allowance.
    await update<Usage>(this.store, `budget:source:${this.app}`, (old) => {
      const admit = (previous: Window[] = [], ms: number, appMax: number, divisionMax: number) => {
        const current = Math.floor(this.now() / ms);
        const windows = new Map(previous.filter((window) => window.period >= current).map((window) => [window.period, window]));
        for (let period = current; period <= Math.max(current, Math.floor(through / ms)); period++) {
          const usage = windows.get(period) ?? { period, app: 0, divisions: {} };
          if (usage.app + count > appMax || (division && (usage.divisions[division] ?? 0) + count > divisionMax)) {
            throw new ServiceError("limited", "The configured shared source-call budget is exhausted. Retry after its window resets.", 429);
          }
          windows.set(period, { ...usage, app: usage.app + count,
            divisions: division ? { ...usage.divisions, [division]: (usage.divisions[division] ?? 0) + count } : usage.divisions });
        }
        return [...windows.values()];
      };
      return { minute: admit(old?.minute, 60_000, this.limits.appCallsPerMinute, this.limits.divisionCallsPerMinute),
        day: admit(old?.day, 86_400_000, this.limits.appCallsPerDay, this.limits.divisionCallsPerDay) };
    });
  }
  fetcher(fetcher: typeof fetch = fetch): typeof fetch {
    return this.tracked(fetcher, (division) => this.call(division));
  }
  async exchangeFetcher(fetcher: typeof fetch = fetch): Promise<typeof fetch> {
    const through = this.now() + 45_000;
    await this.call(undefined, 2, through);
    let remaining = 2;
    // Unused identity-pair reservations stay spent after cancellation or rejection.
    return this.tracked(fetcher, async () => {
      if (remaining <= 0) throw new ServiceError("unavailable", "The reserved Exact identity pair was already used.");
      const first = remaining-- === 2;
      await this.cooldown();
      if (first && this.now() + 15_000 > through) throw new ServiceError("limited", "The Exact identity reservation expired before issuance. Retry.", 429);
    });
  }
  private tracked(fetcher: typeof fetch, admit: (division?: string) => Promise<void>): typeof fetch {
    return async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const division = /^\/api\/v1\/(\d+)\//.exec(url.pathname)?.[1];
      await admit(division);
      const response = await fetcher(input, init);
      if (response.status === 429) {
        const retry = response.headers.get("Retry-After");
        const until = retry && /^[0-9]+$/.test(retry) ? this.now() + Number(retry) * 1000 :
          retry && Number.isFinite(Date.parse(retry)) ? Date.parse(retry) : this.now() + 60_000;
        const expiresAt = Math.max(this.now() + 1000, until);
        for (const scope of ["app", ...(division ? [`division:${division}`] : [])]) {
          // Keep the largest observed hold; a shorter concurrent response must not expire it.
          await update<number>(this.store, `cooldown:${this.app}:${scope}`, (old = 0) => Math.max(old, expiresAt));
        }
      }
      return response;
    };
  }
}
