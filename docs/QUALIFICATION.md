# Qualification and live acceptance

Owner: Software Combined IT. Source review date: 17/11/2026.
Status: deployed to production; Microsoft 365 Copilot pilot passing for one person; second-person check, other AI clients and staff acceptance remain pending.

## Local evidence

Run `npm run verify` for the source contract, import boundaries, line limits,
TypeScript checks, local tests, build, and production dependency audit.
Run `npm run verify:infra` for all CloudFormation templates and their guards.

The tests use the actual Model Context Protocol (MCP) SDK and `oidc-provider` over local HTTP.
A fictional Exact server handles consent, code exchange, identity, fixed reads and fixed changes.
Tests cover all read and change operations and the actual legacy ESM stdio entry point.
They also cover changed permissions, malformed fields, scoped cursors, replay,
client isolation, shared state, cancellation, refresh races, and uncertain persistence.

Shared OAuth proof includes code exchange after HTTP replica replacement.
Independent brokers then authenticate the same persisted grant.
Source-refresh tests use two connection managers sharing conditional state.
These checks do not prove Amazon Web Services (AWS) runtime behaviour or support in staff AI clients.

The official MCP SDK is pinned at 1.32.2.
It replaces the inherited Aikido URL dependency so the hosted service uses the official package and current transport.
Actual SDK transport tests and the dependency audit cover this change.
`oidc-provider` is pinned at 9.15.0 for protocol and interaction handling.
The repository does not implement OAuth security through a custom token shell.

## Agent 57 build analysis

The outcome is bounded staff lookup through personal Exact permissions.
Software Combined IT owns the service and credential effects.
The hosted path coexists with the legacy CLI because existing local callers need it.
It never imports the legacy broad catalogue.

The service is deterministic and has no model, paid model call, or autonomous loop.
Compatibility tier: T1 for business reads; the three change tools are bounded writes with the controls below.
Applicable tool profiles are R, external untrusted content, and L, bounded result size.
Credential rotation also has harmful replay and interruption risks.
Shared conditional exchange state handles those internal maintenance effects.

K1 to K10 map to the typed schemas, fixed adapter, authenticated broker,
safe errors, bounded pages, shared budgets, generation checks, metadata logs, and contract version.
The named hosted tests verify their local enforcement.
The [operations guide](OPERATIONS.md) owns numeric call, time, payload, and concurrency limits.

Three business write tools exist: create customer, update customer, and create an unprocessed sales invoice.
Their controls are fixed resources and fields, non-read-only tool markers for client permission settings,
Exact's own permissions, and no automatic retry.
Local tests cover the exact requests sent, Exact refusals, and an unknown outcome.
They also prove that an unclear customer or item name sends no change.
No send, book, pay, or delete operation exists. Reassess before adding one.
Delegated-agent and broad-autonomy controls are inapplicable because the service contains neither capability.
Reassess them before introducing a model or dynamic orchestration.
Paid-operation allowance is zero because no paid AI (artificial intelligence), enrichment, or reveal call exists.

The shared table is needed for two replicas and rotating credentials.
Process-local state cannot serialise independent tasks or survive a restart.
The app-wide gate protects code exchanges before source identity is known.
Software Combined IT owns recovery and its app-wide reauthentication effect.
Reassess the design if Exact provides a trustworthy identity before token exchange.

Source-qualified, model-qualified, runtime-verified, and owner-accepted are separate states.
Scripted local tests cannot establish model judgement or human acceptance.
No blanket Agent 57 compliance claim is made for a deployed service.

## Live qualification runbook

Use the approved production rollout and the dedicated SCG Exact MCP app.
Keep all other integration apps and their credentials unchanged.
Do not change an existing user's roles or company permissions for this test.
That user can serve another integration, even when the MCP app has separate credentials.
Test permission removal only through this new app's company consent, or a separate approved test identity.
Record sanitised request IDs and outcomes in private operational evidence.
Never record financial rows, source tokens, authorization codes, or raw error payloads.

1. Verify the AWS target, operator identity, region, and approved production scope.
2. Verify the deployed revision and immutable image digest.
3. Read back HTTPS health, issuer metadata, resource metadata, and the eight tools.
4. Confirm S256, exact callbacks, fixed audience, and disabled public registration.
5. Sign in with the approved first test user through the dedicated MCP app.
6. Confirm the displayed Exact user before client consent.
7. Find a known company, customer, invoice, and outstanding item, by name and with no filter.
8. Compare their values in Exact without copying financial rows into evidence.
9. Check a real next page and its explicit coverage.
10. Confirm that a company outside this app's approved consent is denied.
11. If approved, change only this app's company consent and confirm the matching access change.
12. Repeat with a second person who has a different approved permission set.
13. Confirm each person receives only their own current source access.
14. Qualify personal sign-in and read results in Claude.
15. Qualify personal sign-in and read results in ChatGPT.
16. For Copilot Studio, confirm **End-user credentials** for the SCG Exact tools.
17. Qualify the published Copilot channel with another person's own Exact sign-in and grant.
18. Check refresh after the real minimum interval.
19. Restart the service and confirm the persisted connection still works.
20. Run the approved two-replica refresh and cancellation checks.
21. Revoke a client grant and disconnect the shared connection in the approved test.
22. Confirm old grants and cursors fail.
23. Record the named owner's acceptance of the matching deployed revision.

Negative write tests use only the local fake source.
Never probe a live business write to prove read-only behaviour.
Keep live negative probes below Exact's documented error limits.
Do not revoke another app or change the existing test user's roles and company access.

## Remaining gates

One checked AI client can support an approved guided pilot while other clients remain unqualified.
The pilot can provide the second-person permission proof.
Wider staff release requires that proof and owner acceptance.

| Gate | Current status |
| --- | --- |
| Source checks and local simulated outcome | Implemented; rerun on the exact reviewed candidate. |
| Foundation change set, network, certificate, and image repository | Owner verified. |
| Runtime change set and task-role IAM (identity and access management) | Passed: two healthy tasks in two zones; task-role probe passed with fictional data. |
| Deployed HTTPS service and current health | Passed: health, issuer metadata, S256 only, no public registration. |
| Dedicated Exact app registration | Registered by the owner; consent and permission checks remain pending. |
| Two distinct personal permission sets | Pending. |
| Claude use | Pending. |
| ChatGPT use | Pending. |
| Microsoft 365 Copilot use | One pilot user: sign-in, company discovery, customer search, receivables and token refresh passed. Invoice lookup was denied by Exact for that login. On 17/11/2026, after a full reset, sign-in and company discovery passed again. The test used a package that lists the eight tools and a registration bound to the App ID that the Teams admin center assigned. On 17/11/2026, with package 1.0.16 and service commit `a489633` deployed, these reads returned live results for the same pilot user: a customer list with only the company and a row limit; a customer search by city; and receivables by a partial customer name and by days overdue. Their values were not compared in Exact. An invoice list was denied by Exact for that login. Change tools and a second person remain pending. |
| Owner acceptance of the deployed revision | Pending; production target does not establish acceptance. |

## Source basis

The implementation uses the official [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
and [oidc-provider documentation](https://github.com/panva/node-oidc-provider/tree/v9.15.0/docs).
The hosting guide links staff-client documentation through the staff guide.

Exact references include [OAuth troubleshooting](https://support.exactonline.com/community/s/article/All-All-DNO-Content-oauth-eol-oauth-devtrblshtng?language=en_GB),
[code exchange](https://support.exactonline.com/community/s/article/All-All-DNO-Content-oauth-eol-oauth-devstep2?language=en_GB),
and the [REST reference](https://support.exactonline.com/community/s/article/All-All-DNO-Content-restrefdocs?language=en_GB).
Fixed projections follow the official resources for
[companies](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=SystemSystemDivisions),
[identity](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=SystemSystemMe),
[customers](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=CRMAccounts),
[sales invoices](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=SalesInvoiceSalesInvoices),
[receivables](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=ReadFinancialReceivablesList),
[sales items](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=LogisticsItems) (`IsSalesItem`, `StandardSalesPrice`),
[journals](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=FinancialJournals) (type 20 is sales; `IsBlocked`),
and [sales invoice lines](https://start.exactonline.nl/docs/HlpRestAPIResourcesDetails.aspx?name=SalesInvoiceSalesInvoiceLines).
Change bodies follow the same customer and sales invoice pages: a new invoice is Open (not processed) until printed or processed in Exact.

The optional filters use `City`, `Email`, `VATNumber`, `InvoiceTo`, `InvoiceDate` and `Status`.
These names come from the Exact documentation and the property list in `test/fixtures/exact-properties.json`.
On 17/11/2026, live Exact accepted the `City` filter, a customer name lookup, the `DueDate` cut-off for days overdue and a customer list with no filter.
The other filters (`Email`, `VATNumber`, `InvoiceTo`, `InvoiceDate`, `Status`) are verified only against documentation and the local fake source.
The newest-first invoice order is verified only against documentation and the local fake source.
The invoice status labels (5 draft, 20 open, 50 processed) come from [the legacy reference](exact-endpoints.md) and are not verified live.
Live results did not show whether `DueDate` is a company-local date. The days-overdue cut-off assumes it is.

Shared-table permissions also account for
[DynamoDB encryption context](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/encryption.usagenotes.html).
Source budgets and sequential calls follow the official
[Exact API restrictions](https://support.exactonline.com/community/s/knowledge-base#All-All-DNO-Content-rest-restrictions).
