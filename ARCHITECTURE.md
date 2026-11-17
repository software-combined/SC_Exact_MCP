# Hosted service boundaries

The hosted service is a modular Node.js monolith. A single deployment avoids
duplicated identity and budget boundaries. Shared state (DynamoDB or Table Storage) permits more
than one replica without relying on process memory or load-balancer affinity.

`domain` owns canonical schemas, accounting query meanings, and personal
connection identity. It has no HTTP, MCP, cloud (AWS or Azure), or filesystem dependency.
Adapters translate fixed Exact requests and shared encrypted storage.
The OAuth broker owns client grants and interactive personal consent.
The runtime composes these parts; MCP only advertises and executes contracts.
`npm run check:architecture` enforces inward imports and legacy separation.

The canonical schemas are the tool contract. The Exact adapter alone owns fixed
routes and projections. There is no generic provider framework or generic HTTP
escape hatch. Keyed invoice reads use a validated GUID and fixed resource.

Connection state is keyed by Exact application, region, and immutable Exact
user ID. Client-specific grants point at that shared connection. Generation
changes fence old access tokens, refresh tokens, consent results, and cursors.
Replacing credentials for the same active canonical person preserves generation,
so another AI client's consent cannot silently revoke existing client grants.
Disconnect, reauthentication-required state, and app-epoch changes advance it.
Every source request uses that person's current token; Exact remains the final
permission authority, including after roles or division access change.

The state port provides consistent reads and conditional version writes.
Revisions are unique opaque values, including after expiry and replacement.
OAuth records, budgets, cursor handles, and source exchange leases use it.
The production adapter uses DynamoDB on AWS and Table Storage ETags on Azure; tests share an atomic in-memory adapter.
One shared app slot serializes Exact REST requests through full body consumption
or cancellation. Requests have a 15-second bound and a longer 30-second lease.
A crashed holder delays the next request until lease expiry. This controls
client requests; it does not prove when Exact finishes work after socket closure.
The HTTP transport owns each request's 25-second deadline.
Person reservations last 30 seconds to cover that deadline and recover crashed requests.
Already-started credential persistence uses its independent bound after caller cancellation.
Source credentials use KMS encryption with principal-bound context, or on Azure a Key Vault-wrapped data key
with the same binding. Static app credentials, signing keys, and cookie keys come from Secrets Manager or Key Vault at runtime.

SCG OAuth tokens have one canonical MCP audience. A missing resource parameter
can resolve only to that audience; another resource is rejected. Static client
IDs are administrative configuration, not personal identity. Source tokens
are never accepted as SCG tokens.

One shared app exchange gate also covers first-time code exchanges: identity is
unknown until `current/Me` succeeds. Recovery is self-service, as in any OAuth
connector. A failed first sign-in blocks nobody and the person retries. A failed
refresh marks only that person's connection for a new sign-in. If a stale token
remains saved, Exact refuses it on the next refresh and the same marking happens.
The same attempt receives a fresh 60-second issuance lease after preflight.
Ownership, epoch, and remaining time are checked before a source exchange starts.
The fixed token-and-identity pair reserves both calls in every minute and day its bounded admission can reach.
An upstream cooldown still blocks identity validation; the person retries after the cooldown.
Unused reserved calls remain spent after cancellation or rejection.
The public sign-in pool permits at most one quarter of each app budget.
It protects configured capacity for existing grants; it cannot guarantee provider availability or new sign-in access.
An abandoned lease expires within 60 seconds and the next exchange takes it over.
A stalled writer that resumes later can only fail a conditional write or leave a token that Exact refuses.

Infrastructure targets production with an HTTPS load balancer and ECS Fargate.
SCG's copy runs in Frankfurt (`eu-central-1`). A self-hosted copy chooses any
region enabled in its AWS account, except the China regions. At least two replicas must run across two availability zones.
Each zone requires its own private route and NAT gateway for independent egress.
`SCG_CLOUD=azure` selects the Azure adapters instead. `infra/azure/main.bicep` runs at least two
Azure Container Apps replicas behind its HTTPS ingress, in any Azure region.
Shared state remains mandatory. Deployed health, permission checks, client
qualification and owner acceptance are separate gates.
The local legacy stdio catalogue remains independent and potentially writable.
