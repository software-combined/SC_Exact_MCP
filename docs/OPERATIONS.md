# Operations

Owner: Software Combined IT. Scope: the dedicated SCG MCP app.
The service has no business write path.
Credential maintenance and internal state still require careful recovery.

## Normal operation

Each request has a 25-second deadline.
Each Exact call has a 15-second timeout.
One shared app slot keeps REST requests sequential across people and replicas.
It remains held until the response body finishes or the client request is cancelled.
A 30-second lease bounds recovery after a process crash.
An abandoned read does not create permanent credential uncertainty.
The slot controls client requests, not Exact's internal work after a socket closes.
A person can run at most two tool calls across all AI clients and replicas.
Each tool reads one page and at most 100 rows.
Source JSON is limited to 512,000 bytes.
Model-visible structured output is limited to 64,000 bytes.

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

Cursor handles expire after ten minutes and are consumed once.
They bind the person, region, company, operation, filters, projection version, and connection generation.
They store continuation metadata, not financial rows.
They reject changed, repeated, or unsafe source continuations.
A failed continuation requires a fresh query.

Logs contain request ID, route label, outcome, status, and duration.
A failed request can add a fixed detail label, such as `connect:identity:reauth_required`.
The label names the failed step and error class. It never contains source data or error text.
Do not enable request-body, authorization-header, token-endpoint, or financial-response logging.
Use request IDs to investigate failures. Staff see the request ID as the reference on sign-in error pages.

## Refresh behavior

Exact refresh tokens rotate.
A new authorization-code exchange can also invalidate a previous refresh chain for the same app and person.
Different integrations must use different Exact apps.

The app-wide exchange gate serializes first-time sign-in and refresh.
It reserves 30 seconds for preflight, then renews the same attempt to 60 seconds before issuance.
The service rereads ownership, epoch, and remaining lease time before contacting Exact.
Identity is unknown until a new sign-in reaches `current/Me`.
The connection is then updated under its canonical app, region, and Exact user ID.
New consent for the same active person preserves other active clients' connection generation.
Disconnected, invalid, or prior-epoch connections require fresh client grants.
Replicas reread credentials after acquiring the gate.
They never replay an older refresh token automatically.

Refresh cannot start before 570 seconds have elapsed since token issue.
The comparison retains millisecond precision.
The normal access-token safety margin is 30 seconds.
Early source expiry can require waiting or reauthentication.

Credential exchange and identity validation have an independent 15-second bound.
Each AWS call has an independent 3-second limit through credential resolution and response processing.
It runs once. A timeout aborts its unfinished request; uncertain credential persistence still requires reconciliation.
Request cancellation does not interrupt started credential persistence.
Shutdown closes incoming HTTP connections to cancel work that has not issued credentials.
Already-started credential work can drain for up to 35 seconds.
Forced shutdown can leave credentials uncertain; follow recovery before retrying.
The new access token is returned only after encrypted persistence and readback succeed.

Known non-issuing OAuth rejections release the gate.
An invalid refresh grant marks only that person's connection for reauthentication.
Quota rejection creates a shared cooldown and preserves usable connections.
Unknown transport outcomes, malformed success, and failed persistence retain uncertain state.

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

## Uncertain exchange recovery

If an exchange is uncertain, stop retrying sign-in and refresh.
Do not restore or replay a saved refresh token.
The app-wide hold protects an unknown person's possibly invalidated chain.

1. Confirm the exact app, region, environment, and AWS operator identity.
2. Confirm the failing request and metadata without reading secret values.
3. Obtain authority to stop all service writers and require app-wide reauthentication.
4. Pause automatic scaling and deployments.
5. Set the ECS service desired count to zero through the approved recovery procedure.
6. Stop other writers, including separate operator or one-off tasks.
7. Read back zero desired, running, and pending service tasks, with no other writers.
8. Keep service replacement and other writers stopped through reconciliation.
9. Confirm the uncertain source attempt has settled with the platform owner.
10. Wait until the stored exchange lease has expired after stopping those writers.
11. Set the nonsecret values required by `src/hosted/reconcile.ts` in an isolated operator process.
12. Set `SCG_CONFIRM_REAUTH_ALL=yes` and `SCG_CONFIRM_WRITERS_STOPPED=yes` for the verified recovery.
13. Recheck the zero-writer condition immediately before reconciliation.
14. Run `node dist/hosted/reconcile.js` in the verified production context.
15. Restore the reviewed service tasks and approved scaling and deployment settings.
16. Ask each affected person to reconnect through their own Exact sign-in.
17. Check a permitted read and client authorization again.

The recovery increments the app epoch with a conditional write.
Every older credential chain becomes unusable.
The command does not fetch or print secrets.
It refuses an unexpired exchange.
The confirmation flags do not stop tasks or prove their status.
Exact cannot enforce the service's lease fence.
An expired lease alone is not sufficient authority to reconcile.

## Rollback and retained state

Rollback can replace the application image with a compatible reviewed image.
A compatible image accepts every Exact GUID that the current image accepts.
Images built before generic GUID support accept only RFC-format GUIDs.
After any person connects, do not roll back to such an image, and do not run it beside the current image.
Its token refresh rejects other Exact user IDs and puts the app into an uncertain exchange. Roll forward instead.
Keep the current shared table and encryption keys.
Never roll credentials back to an older snapshot.
An old refresh token may already be invalid.
Use reauthentication when state integrity cannot be established.

Keep old signing verification keys until issued tokens expire.
Coordinate signing-key and cookie-key changes across replicas.
Configuration is loaded at process startup.
A secret change needs a separately authorized task replacement.
