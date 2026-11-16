# Hosted service boundaries

The hosted service is a modular Node.js monolith. A single deployment avoids
duplicated identity and budget boundaries. Shared DynamoDB state permits more
than one replica without relying on process memory or load-balancer affinity.

`domain` owns canonical schemas, accounting query meanings, and personal
connection identity. It has no HTTP, MCP, AWS, or filesystem dependency.
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
Every source request uses that person's current token; Exact remains the final
permission authority, including after roles or division access change.

The state port provides consistent reads and conditional version writes.
OAuth records, budgets, cursor handles, and source exchange leases use it.
The production adapter uses DynamoDB; tests share an atomic in-memory adapter.
Source credentials use KMS encryption with principal-bound context. Static app
credentials, signing keys, and cookie keys come from Secrets Manager at runtime.

SCG OAuth tokens have one canonical MCP audience. A missing resource parameter
can resolve only to that audience; another resource is rejected. Static client
IDs are administrative configuration, not personal identity. Source tokens
are never accepted as SCG tokens.

One shared app exchange gate also covers first-time code exchanges: identity is
unknown until `current/Me` succeeds. A crash at that boundary can require an
operator recovery affecting the app. This deliberately favors credential
integrity over silently replaying an invalidated rotation chain.

Infrastructure targets production with an HTTPS load balancer and ECS Fargate.
Frankfurt (`eu-central-1`) is selected; Ireland (`eu-west-1`) is the supported
alternative. At least two replicas must run across two availability zones.
Each zone requires its own private route and NAT gateway for independent egress.
Shared state remains mandatory. Deployed health, permission checks, client
qualification and owner acceptance are separate gates.
The local legacy stdio catalogue remains independent and potentially writable.
