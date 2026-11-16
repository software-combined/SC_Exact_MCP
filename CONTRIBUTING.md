# Contributing

Normal pull requests target `development`.
Use Node.js 22 or newer.
Start with the [documentation index](docs/README.md), [AGENTS.md](AGENTS.md), and [RULES.md](RULES.md).

## Local work

```sh
npm ci
npm run verify
npm run verify:infra
```

The last command requires CloudFormation validators.
The [hosting guide](docs/HOSTING.md) lists their pinned versions.
Continuous integration runs the same checks.
A passing check does not approve a live deployment.

Keep tests local and use fictional records.
Never test a business write against Exact.
Do not run the retained live helper scripts as routine verification.

## Change boundaries

The hosted contract has four typed operations.
Do not import the legacy generic client or catalogue into the hosted service.
The [architecture](ARCHITECTURE.md) explains ownership and import direction.

Change schemas, handlers, descriptions, and meaningful tests together.
Update the owning guide when behavior or setup changes.
Keep documentation in simple technical English.
Use one idea per sentence and expand unfamiliar terms.

Run the installed pre-commit review before every commit.
Use a short subject such as `feat: add bounded invoice lookup`.
Keep each commit coherent and within the applicable review limits.

Use sanitized reproduction steps in public issues.
Send security reports through [private vulnerability reporting](https://github.com/software-combined/SC_Exact_MCP/security/advisories/new).
Never attach tokens, callback URLs containing codes, financial rows, or private logs.
