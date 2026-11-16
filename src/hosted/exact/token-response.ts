import { z } from "zod";
import { ServiceError, type SourceTokens } from "../domain/identity.js";
import { jsonResponse } from "./http.js";

export class ExchangeRejected extends ServiceError {
  constructor(code: "reauth_required" | "denied" | "limited", message: string, status: number,
    readonly credentialsInvalid = false) { super(code, message, status); }
}
const opaque = z.string().min(1).max(16_384).regex(/^[A-Za-z0-9._~+\/=\-]+$/);
const schema = z.object({ access_token: opaque,
  refresh_token: opaque, token_type: z.string().refine((v) => v.toLowerCase() === "bearer"),
  expires_in: z.union([z.number().int().positive().max(3600), z.string().regex(/^[0-9]+$/)
    .transform(Number).pipe(z.number().int().positive().max(3600))]) });

export async function tokenResponse(response: Response): Promise<SourceTokens> {
  if (response.status === 429) {
    await response.body?.cancel();
    throw new ExchangeRejected("limited", "Exact limited the credential request. Retry after its cooldown.", 429);
  }
  if ([400, 401, 403].includes(response.status)) {
    const raw = await jsonResponse(new Response(response.body, { status: 200 }), 40_000);
    const error = z.object({ error: z.enum(["invalid_request", "invalid_client", "invalid_grant", "unauthorized_client",
      "unsupported_grant_type", "invalid_scope", "access_denied"]) }).safeParse(raw);
    if (error.success) throw new ExchangeRejected("reauth_required", "Exact rejected the sign-in or refresh grant. Reconnect.", 401,
      error.data.error === "invalid_grant");
    throw new ServiceError("reauth_required", "Exact returned an unrecognized credential outcome. IT must reconcile.", 401);
  }
  const parsed = schema.safeParse(await jsonResponse(response, 40_000));
  if (!parsed.success) throw new ServiceError("reauth_required", "Exact returned invalid credentials. IT must reconcile.", 401);
  const issuedAt = Date.now();
  return { accessToken: parsed.data.access_token, refreshToken: parsed.data.refresh_token,
    issuedAt, expiresAt: issuedAt + parsed.data.expires_in * 1000 };
}
