import { randomBytes } from "node:crypto";
import { ServiceError, type StateStore } from "../domain/identity.js";
import { update } from "../storage/state.js";

export interface Limits { appCallsPerMinute: number; divisionCallsPerMinute: number;
  appCallsPerDay: number; divisionCallsPerDay: number }
interface Window { period: number; app: number; divisions: Record<string, number> }
interface Usage { minute: Window; day: Window }
export class Budgets {
  constructor(private store: StateStore, private app: string, private limits: Limits, private now = () => Date.now()) {}
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
  async call(division?: string) {
    for (const scope of ["app", ...(division ? [`division:${division}`] : [])]) {
      const hold = await this.store.read<number>(`cooldown:${this.app}:${scope}`);
      if (hold && hold.value > this.now()) throw new ServiceError("limited", "Exact's shared retry cooldown is active. Retry later.", 429);
    }
    // Admit every applicable limit in one CAS: a rejected division must not spend app allowance.
    await update<Usage>(this.store, `budget:source:${this.app}`, (old) => {
      const window = (previous: Window | undefined, ms: number): Window => {
        const period = Math.floor(this.now() / ms);
        return previous?.period === period ? previous : { period, app: 0, divisions: {} };
      };
      const minute = window(old?.minute, 60_000); const day = window(old?.day, 86_400_000);
      for (const [usage, appMax, divisionMax] of [[minute, this.limits.appCallsPerMinute, this.limits.divisionCallsPerMinute],
        [day, this.limits.appCallsPerDay, this.limits.divisionCallsPerDay]] as const) {
        if (usage.app >= appMax || (division && (usage.divisions[division] ?? 0) >= divisionMax)) {
          throw new ServiceError("limited", "The configured shared source-call budget is exhausted. Retry after its window resets.", 429);
        }
      }
      const increment = (usage: Window): Window => ({ ...usage, app: usage.app + 1,
        divisions: division ? { ...usage.divisions, [division]: (usage.divisions[division] ?? 0) + 1 } : usage.divisions });
      return { minute: increment(minute), day: increment(day) };
    });
  }
  fetcher(fetcher: typeof fetch = fetch): typeof fetch {
    return async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const division = /^\/api\/v1\/(\d+)\//.exec(url.pathname)?.[1];
      await this.call(division);
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
