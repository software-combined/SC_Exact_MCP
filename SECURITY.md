# Security policy

Report vulnerabilities through [GitHub private vulnerability reporting](https://github.com/software-combined/SC_Exact_MCP/security/advisories/new).
Do not publish an exploit or private evidence in a public issue.
Include the affected revision, impact, and sanitized reproduction steps.

## Hosted service boundary

The service has four fixed read operations.
The hosted tool contract permits business GET requests only.
An Exact-enforced read-only app scope has not been established.
Review source scopes and consent separately; Exact user and app permissions remain authoritative.
The service cannot accept an arbitrary URL, resource, HTTP method, field list, or OData filter.
Source tokens are not valid MCP access tokens.
Each protected request checks the SCG token, active grant, and personal connection.

Credentials use principal-bound envelope encryption with AWS Key Management Service.
Shared state uses consistent reads and conditional writes.
An uncertain Exact rotation blocks further credential use until reconciliation.
Logs contain request metadata, not source tokens or financial rows.

The public source is not a deployed security certification.
Read [qualification](docs/QUALIFICATION.md) for the remaining runtime and staff checks.

## Credential handling

Keep runtime configuration in Secrets Manager.
Never commit local credential files or paste secret values into a report.
Use separate apps, keys, tables, and origins for each environment.
Do not reuse another integration's app credentials or refresh tokens.

If a credential is exposed, stop the affected SCG app through the incident process.
Preserve sanitized metadata for investigation.
Revoke only the affected app with the owner's authority.
Do not revoke an unrelated integration.

## Legacy limitation

The local stdio server can expose writes and generic requests.
Its read-only setting does not provide the hosted service's fixed contract.
Do not deploy it as the staff endpoint.
Only the current reviewed source is maintained for the SCG hosted mandate.
