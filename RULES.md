# Behavior and qualification rules

Owner: Software Combined IT. Status: source implementation; production deployment requires current verification.

Hosted tools discover companies, list or search customers and sales items, list
or look up sales invoices, and read receivables. Reads need only the company.
A customer or item name can replace its ID. A name that matches no record or
several records stops the tool and lists the candidates; no change is sent.
A change needs the full name or the code. A partial name is offered back, not changed. Three change tools create a customer, update
customer details, and create an unprocessed sales invoice. No tool deletes,
books, sends, or pays. Exact's own permission decides each change; each AI
client's tool-permission settings decide whether it asks first. A change request
is sent once and never retried. Personal Exact consent and
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

The only resource scope is `exact.read`; its name is kept so existing client
registrations keep working. It covers every tool. The optional `openid` identity
scope returns the canonical subject without profile or email claims.
Use authorization code with S256 proof key for code
exchange (PKCE), exact registered callback URLs, and three static registrations.
Public dynamic registration, password grants, implicit grants, and source-token
passthrough are forbidden. Check the active grant and connection generation on
every protected request. Disconnect invalidates all existing grants and cursors.

Refresh and authorization-code exchanges can invalidate prior Exact refresh
tokens. Shared conditional state serializes exchanges. A failed exchange affects
only its own person: a failed first sign-in is retried, and a failed refresh
requires that person to sign in again. Recovery never needs an operator.

Each tool reads one bounded page, with explicit source time, company, currency,
and complete/partial coverage. A page is not a snapshot or a complete financial
total. No financial response cache is permitted. Malformed source data, invalid
amounts, untrusted continuation URLs, and failed permission checks fail closed.

Run local mocked qualification before review. Real Exact permissions, the three
staff clients, deployment health, and owner acceptance are separate gates.

This repository is public. Never commit credentials, real customer or business
records, private contacts, or live deployment identifiers. Keep deployment
configuration outside Git. Clearly fictional fixtures and fixed protocol,
schema, and security constants are permitted. Review current files, reachable
history, and commit metadata before publication.
