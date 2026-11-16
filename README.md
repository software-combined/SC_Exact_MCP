<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/sc-logo-wide-dark.png">
    <img src="docs/assets/sc-logo-wide.png" alt="Software Combined" width="380">
  </picture>
</p>

<h1 align="center">SCG Exact MCP</h1>

<p align="center">Ask Exact Online questions from your AI assistant, with your own Exact sign-in. Read-only.</p>

This service connects AI (artificial intelligence) assistants, such as Microsoft 365 Copilot, Claude and ChatGPT, to Exact Online.
You ask a question in plain words. For example: "Which invoices are overdue for this customer?"
The assistant looks up the answer in Exact through this service.

Two rules never change:

- You see only what your own Exact account can see. There is no shared login.
- The service can only read. It cannot create, change, send, book or delete anything in Exact.

Software Combined Group (SCG) IT runs the service. The connection uses the Model Context Protocol (MCP). MCP is an open standard for linking AI assistants to other systems.

## Get started

| You are... | Read this | Time |
| --- | --- | --- |
| A staff member who wants to use it | [Staff guide](docs/USER-GUIDE.md) | About 5 minutes. Nothing to install. |
| Asking whether it is safe | [Security questions](docs/FAQ.md) | About 10 minutes |
| IT, connecting an AI assistant | [Hosting guide: connect an AI assistant](docs/HOSTING.md#register-three-ai-clients) | About 30 minutes per assistant |
| IT, running or recovering the service | [Hosting guide](docs/HOSTING.md) and [operations guide](docs/OPERATIONS.md) | |
| A developer | [Developers](#developers) below | |

## What you can ask

| You can look up | Example question |
| --- | --- |
| Companies | "Which Exact companies can I open?" |
| Customers | "Find the customer named Fictional Trading in company 123456." |
| Sales invoices | "Show sales invoice 20260001 in company 123456." |
| Receivables (money customers still owe) | "Which receivables in company 123456 are overdue?" |

Each answer names the company, the currency and the time of the lookup.
Long lists come back one page at a time. A page is not a complete total. Receivables are current balances, not past ones.

## Current status

| Item | Status |
| --- | --- |
| Service | Running in production in Frankfurt, Germany, in the Amazon Web Services (AWS) region `eu-central-1` |
| Microsoft 365 Copilot | Being tested by IT with one person |
| Claude and ChatGPT | Not yet tested |
| Wider staff use | After a second person with different Exact access is checked and the owner accepts the results |

The [qualification record](docs/QUALIFICATION.md) shows each check and its evidence.

## How it works

```text
You ask a question  ->  AI assistant  ->  SCG service  ->  Exact Online
Your answer         <-  AI assistant  <-  SCG service  <-  Exact returns records
```

The first time, the assistant opens an SCG sign-in page. You continue to Exact and sign in with your own account.
SCG never sees your password. The service keeps your Exact connection encrypted and gives each AI assistant its own access.
If you connect a second assistant, it uses the same Exact connection, but it asks for your approval separately.

## Developers

You need Node.js 22 or newer.

```sh
git clone https://github.com/software-combined/SC_Exact_MCP.git
cd SC_Exact_MCP
npm ci
npm run verify
```

`npm run verify` checks architecture rules, types, tests, the build and dependencies.
The tests use fictional data and local services. They never connect to a real Exact company.

The container starts the hosted service. It needs the AWS resources and private configuration that the [hosting guide](docs/HOSTING.md) describes.
The [documentation index](docs/README.md) lists every guide.

## Legacy command line

This fork also keeps the original BoostU command-line server. It has a broad tool set that can write to Exact.
It is a separate developer tool, not the staff service. Read the [legacy CLI guide](docs/LEGACY-CLI.md) before you use `npm run start:legacy`.

## Contributing and provenance

Send normal pull requests to the `development` branch. Read [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md).
Report security issues through [private vulnerability reporting](https://github.com/software-combined/SC_Exact_MCP/security/advisories/new).

This fork builds on [BoostU Exact Online MCP](https://github.com/boostuagency/boostu-exactonline-mcp).
The original MIT licence and attribution remain in [LICENSE](LICENSE) and [NOTICE](NOTICE).
This project is not affiliated with Exact.
