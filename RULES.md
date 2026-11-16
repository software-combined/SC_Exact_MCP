# Behavior and qualification rules

Owner: Software Combined IT. Status: source implementation; production deployment requires current verification.

Hosted tools discover companies, search customers, look up sales invoices, and
read receivables. They never mutate business records. Personal Exact consent and
current source permissions are the authority for every read. Pilot access follows
approved source consent; the service never invents a tenant entitlement.
Other integrations' app credentials and
refresh tokens are excluded. Staff never receive a shared credential fallback.
An approved first-test identity can use the dedicated MCP app; two-person
permission qualification is still required before broad staff access.

The canonical person is the fixed Exact region plus `current/Me.UserID`.
Email addresses, AI client IDs, tool arguments, and browser claims cannot select
another person's connection. Each AI client has a separate OAuth grant and
audience-bound SCG access token. Source tokens stay encrypted on the server.

Only `exact.read` is granted. Use authorization code with S256 proof key for code
exchange (PKCE), exact registered callback URLs, and three static registrations.
Public dynamic registration, password grants, implicit grants, and source-token
passthrough are forbidden. Check the active grant and connection generation on
every protected request. Disconnect invalidates all existing grants and cursors.

Refresh and authorization-code exchanges can invalidate prior Exact refresh
tokens. Shared conditional state serializes exchanges. An expired unfinished
attempt means uncertain credentials, never permission to replay an old token.
Reauthentication or explicit operator reconciliation is the recovery path.

Each tool reads one bounded page, with explicit source time, company, currency,
and complete/partial coverage. A page is not a snapshot or a complete financial
total. No financial response cache is permitted. Malformed source data, invalid
amounts, untrusted continuation URLs, and failed permission checks fail closed.

Run local mocked qualification before review. Real Exact permissions, the three
staff clients, deployment health, and owner acceptance are separate gates.
