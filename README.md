<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/sc-logo-wide-dark.png">
    <img src="docs/assets/sc-logo-wide.png" alt="Software Combined" width="380">
  </picture>
</p>

<h1 align="center">SCG Exact MCP</h1>

<p align="center">Bounded, read-only Exact Online access for AI assistants.</p>

Software Combined Group (SCG) IT maintains this service.
Staff use their own Exact sign-in and current permissions.
The service exposes four operations through the standard Model Context Protocol (MCP).

This is a public source repository. The service is not available for wider staff use yet.
Production deployment is approved. IT can offer a guided pilot through one checked AI app.
Deployment health, permission checks, and each staff client remain separate qualification gates.

## What staff can ask

| Operation | Purpose |
| --- | --- |
| Company discovery | Find companies the signed-in person can currently open. |
| Customer search | Find customers by name or customer code. |
| Invoice lookup | Find sales invoices by invoice number or invoice ID. |
| Receivables | Read current outstanding items, with optional customer and due-date filters. |

Results identify the company, currency, source time, and page coverage.
Receivables are current balances, not historical balances.
The service never presents a page subtotal as a complete total.

## How access works

Claude, ChatGPT, and Microsoft 365 Copilot are the target staff clients.
They use the same remote MCP service and OAuth sign-in.
Actual client qualification is still pending.

Each person has one source connection across their AI clients.
Each client receives a separate SCG grant and access token.
Exact credentials stay encrypted on the server.
Current Exact permissions control every source read.
There is no shared staff credential fallback or generic request tool.

The selected production target is Amazon Web Services in Frankfurt, `eu-central-1`.
Ireland, `eu-west-1`, is the supported alternative.
This hosting choice does not define where organization audit logs, Exact, or an AI provider processes data.

## Start here

Staff: read the [staff guide](docs/USER-GUIDE.md). No local software installation is required.
Read the [security questions](docs/FAQ.md) to understand the data flow and access limits.

Developers: use Node.js 22 or newer.

```sh
git clone https://github.com/software-combined/SC_Exact_MCP.git
cd SC_Exact_MCP
npm ci
npm run verify
```

These checks use fictional data and local services.
They do not connect to a live ledger.
The [documentation index](docs/README.md) links setup, architecture, operations, and qualification.

The container starts the hosted service.
It requires the approved AWS resources and private runtime configuration.
Follow the [hosting guide](docs/HOSTING.md) before running `npm start`.

## Legacy command line

The retained BoostU stdio server has a broad catalogue and can expose write tools.
It is a separate developer path.
Read the [legacy CLI guide](docs/LEGACY-CLI.md) before using `npm run start:legacy`.
It is not the staff service.

## Contributing and provenance

Submit normal pull requests to `development`.
Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).
Report security issues through [private vulnerability reporting](https://github.com/software-combined/SC_Exact_MCP/security/advisories/new).

This fork builds on [BoostU Exact Online MCP](https://github.com/boostuagency/boostu-exactonline-mcp).
The original MIT licence and attribution remain in [LICENSE](LICENSE) and [NOTICE](NOTICE).
This project is not affiliated with Exact.
