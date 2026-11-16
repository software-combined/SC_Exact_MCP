# Releasing

The public GitHub repository distributes source.
The package is marked private.
Automatic npm and MCP Registry publication are disabled.

Normal pull requests target `development`.
Run the required staged reviews and repository checks before integration.

```sh
npm run verify
npm run verify:infra
```

Use [HOSTING.md](docs/HOSTING.md) for the approved production rollout.
Record the reviewed revision and immutable container image digest.
Read back the running task, TLS endpoint, metadata, and actual staff result.

Use [QUALIFICATION.md](docs/QUALIFICATION.md) before staff acceptance.
Source tests, deployment health, staff client checks, and owner acceptance are separate gates.

Production deployment requires the reviewed two-zone templates and verified runtime configuration.
A source release or Git tag must not deploy or publish credentials.
