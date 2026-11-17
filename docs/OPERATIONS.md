# Operations

Owner: Software Combined IT. Scope: the dedicated SCG Exact MCP app.
The service can create customers, update customer details and create unprocessed sales invoices, nothing else.
Credential maintenance and internal state still require careful recovery.

## Normal operation

Each request has a 25-second deadline.
Each Exact call has a 15-second timeout.
A change is sent only within the first 7 seconds of its request, which leaves room for Exact's answer before the deadline. Later, it is refused and nothing is changed. If the answer is still lost, the person is told the result is unknown.
One shared app slot keeps REST requests sequential across people and replicas.
The slot stays in use until the response body finishes or the client request is cancelled.
A 30-second lease bounds recovery after a process crash.
An abandoned read does not create permanent credential uncertainty.
The slot controls client requests, not Exact's internal work after a socket closes.
A person can run at most two tool calls across all AI (artificial intelligence) clients and replicas.
Each tool reads one page and at most 100 rows.
Source JSON is limited to 512,000 bytes.
Structured output that the AI model can see is limited to 64,000 bytes.

A normal company discovery makes one source read.
A customer, invoice, or receivables query makes two source reads.
The first read confirms the company and its source metadata.
A required refresh can add one token exchange and one identity check.
The service reserves both identity calls against minute and daily limits before token issuance.
Unused reserved calls remain spent after cancellation or rejection.
Public sign-ins also spend a separate pool capped at one quarter of each app budget.
Repeated invalid callbacks can exhaust that pool and deny new sign-ins.
Existing grants use the normal budget for reads and refreshes.
Later source reservations can conservatively charge different windows from earlier sign-in admission.
The separate pool does not guarantee a fixed remaining share of the normal budget.
This protects configured service capacity; it does not guarantee vendor availability or prevent all denial-of-service attacks.
No tool loops over all pages.

Cursors (markers that fetch the next page) expire after ten minutes and can be used only once.
They bind the person, region, company, operation, filters, projection version, and connection generation.
They store continuation metadata, not financial rows.
They reject changed, repeated, or unsafe source continuations.
A failed continuation requires a fresh query.

Logs contain request ID, route label, outcome, status, and duration.
A failed request can add a fixed detail label, such as `connect:identity:reauth_required`.
The label names the failed step and error class. It never contains source data or error text.
A request refused by the first host and HTTPS check is labelled `host:`, `proto:` or `target:` with the cleaned-up value received, for example `host:other.example.com`.
A request for an address that does not exist is labelled `path:` with its method and path, never its query, for example `path:GET /missing`.
Do not enable request-body, authorization-header, token-endpoint, or financial-response logging.
Use request IDs to investigate failures. Staff see the request ID as the reference on sign-in error pages.

## Refresh behaviour

Exact refresh tokens rotate.
A new authorization-code exchange can also invalidate a previous refresh chain for the same app and person.
Different integrations must use different Exact apps.

The app-wide exchange gate runs first-time sign-in and refresh one at a time.
It reserves 30 seconds for preflight, then renews the same attempt to 60 seconds before issuance.
The service rereads ownership, epoch, and remaining lease time before contacting Exact.
Identity is unknown until a new sign-in reaches `current/Me`.
The connection is then updated under its canonical app, region, and Exact user ID.
New consent for the same active person preserves other active clients' connection generation.
Disconnected, invalid, or prior-epoch connections require fresh client grants.
Replicas reread credentials after acquiring the gate.
If saving a rotated token fails, the older saved token can be sent once more. Exact refuses it, and that person signs in again.

Refresh cannot start before 570 seconds have elapsed since token issue.
The comparison retains millisecond precision.
The normal access-token safety margin is 30 seconds.
Early source expiry can require waiting or reauthentication.

Credential exchange and identity validation have an independent 15-second bound.
Each cloud storage, key or secret call (AWS or Azure) has an independent 3-second limit through credential resolution and response processing.
It runs once. A timeout stops its unfinished request. If Exact already rotated the token, that person signs in again.
Request cancellation does not interrupt started credential persistence.
Shutdown closes incoming HTTP connections to cancel work that has not issued credentials.
Already-started credential work can keep running for up to 35 seconds.
Forced shutdown can leave one saved token stale; that person signs in again.
The new access token is returned only after encrypted persistence and readback succeed.

Known OAuth rejections that issue no token release the gate.
An invalid refresh grant marks only that person's connection for reauthentication.
Quota rejection creates a shared cooldown and preserves usable connections.
Unknown transport outcomes, malformed success, and failed persistence mark only that person's connection for a new sign-in.
A failed first sign-in does not block anyone; the person tries again.

## Disconnect and reconnect

Shared disconnect returns a retryable conflict while a credential exchange is running.
Retry after that exchange finishes. The service does not interrupt it.

Client-grant revocation removes that client's authority.
The shared Exact connection remains available to other current grants.
The standard revocation endpoint supports revoking the client's refresh token.

An authenticated `POST /connection/disconnect` disconnects the shared personal connection.
It increments the connection generation and removes its stored credential envelope.
All older grants and cursors then fail.
This endpoint is an operator or client integration route, not an MCP tool.
It does not revoke another app in Exact.

Reconnection requires fresh Exact consent and confirmation of the displayed user.
The generation changes again.
Old client grants cannot regain authority through a model retry.

## Abandoned exchanges and revoking all connections

The exchange lock lasts at most 60 seconds. If a task stops during an exchange, the next exchange takes over after the lock expires.
No operator action is needed. If Exact rotated a token that was not saved, Exact refuses the stale token and that person signs in again.

To make every person sign in again, for example after a suspected compromise of the service:

1. Confirm the app, region, environment and cloud operator identity.
2. Run `node dist/hosted/reconcile.js` with `SCG_EXACT_REGION=<region>` and `SCG_CONFIRM_REAUTH_ALL=yes`.
   - On AWS, run it from a checkout of the deployed commit (`npm ci && npm run build`), signed in as the operator.
     Also set `AWS_REGION`, `SCG_STATE_TABLE` (the service stack's `State` table) and `SCG_EXACT_APP_ID`.
     Do not use a copied ECS task: the image's fixed entry point ignores a command override and starts another server.
   - On Azure, open a shell in one replica: `az containerapp exec --resource-group <group> --name <prefix> --command sh`.
     The replica already has the Azure settings and identity. Run the command there.
3. Expect the `all_connections_revoked` event. The command refuses while an exchange is running; retry after a minute.
4. Ask people to sign in again.

This makes SCG stop using every saved Exact token. It does not revoke tokens at Exact.
If tokens may have leaked, also revoke this app's access in Exact, as `SECURITY.md` describes.

The command increments the app epoch. Every saved connection, client grant and cursor stops working.
It does not read or print secrets.

## Rollback and retained state

Rollback can replace the application image with a compatible reviewed image.
A compatible image accepts every Exact GUID (globally unique identifier) that the current image accepts.
Images built before generic GUID support accept only RFC-format GUIDs.
After any person connects, do not roll back to such an image, and do not run it beside the current image.
Its token refresh rejects other Exact user IDs. Images before self-service recovery also lock sign-in for everyone after one failed exchange.
Images built before commit `c3e65f5` cannot read saved Exact tokens that contain characters such as `!`. Lookups then fail for every person whose saved token contains one.
Roll forward instead.
Keep the current shared table and encryption keys.
Never roll credentials back to an older snapshot.
An old refresh token may already be invalid.
Ask people to sign in again when you cannot confirm that the saved state is intact.

Keep old signing verification keys until issued tokens expire.
Coordinate signing-key and cookie-key changes across replicas.
Configuration is loaded at process startup.
A secret change needs a separately authorised task replacement.
