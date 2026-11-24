<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/sc-logo-wide-dark.png">
    <img src="docs/assets/sc-logo-wide.png" alt="Software Combined" width="380">
  </picture>
</p>

<h1 align="center">SCG Exact MCP</h1>

<p align="center">Ask Exact Online questions from your AI assistant, with your own Exact sign-in.</p>

This service connects AI (artificial intelligence) assistants, such as Microsoft 365 Copilot, Claude and ChatGPT, to Exact Online.
You ask a question in plain words. For example: "Which invoices are overdue for this customer?"
The assistant looks up the answer in Exact through this service.

Two rules never change:

- You see and change only what your own Exact account allows. There is no shared login.
- The service makes only three kinds of change: create a customer, update a customer's details, and create a draft sales invoice. It never deletes, books, sends or pays.

Software Combined Group (SCG) IT runs the service. The connection uses the Model Context Protocol (MCP). MCP is an open standard for linking AI assistants to other systems.

## Get started

| You are... | Read this | Time |
| --- | --- | --- |
| A staff member who wants to use it | [Staff guide](docs/USER-GUIDE.md) | About 5 minutes. Nothing to install. |
| Asking whether it is safe | [Security questions](docs/FAQ.md) | About 10 minutes |
| IT, connecting an AI assistant | [Hosting guide: connect an AI assistant](docs/HOSTING.md#register-three-ai-clients) | About 30 minutes per assistant |
| IT at another company, running your own copy on AWS or Azure | [Deploy your own copy](docs/SELF-HOST.md) | About 2 hours |
| IT, running or recovering the service | [Hosting guide](docs/HOSTING.md) and [operations guide](docs/OPERATIONS.md) | |
| A developer | [Developers](#developers) below | |

## What you can ask

Finance reads require an updated server and Copilot package. Check the
[qualification record](docs/QUALIFICATION.md) for live coverage.

| You can look up | Example question |
| --- | --- |
| Companies | "Which Exact companies can I open?" |
| Customers | "List the first 5 customers in company 123456." or "Find Fictional Trading in company 123456." |
| Sales invoices | "Show the latest invoices for Fictional Trading in company 123456." |
| Receivables (money customers still owe) | "Which receivables in company 123456 are more than 30 days overdue?" |
| Sales items | "List the sales items in company 123456." |
| Suppliers and bank details | "Find Fictional Supply and show its registered bank account ending and BIC." |
| Open payables and payment status | "Which supplier invoices are due this week? Which payments are selected?" |
| Invoices, ledger and period close | "Show the lines for purchase invoice 42. Which journals are open for period 3?" |
| Bank statement entries and assets | "Show the bank statement closing balances for period 3 and list active assets." |

| You can change | Example request |
| --- | --- |
| Create a customer | "Create a customer named Fictional Trading in company 123456." |
| Update a customer | "Change the phone number of Fictional Trading in company 123456." |
| Draft a sales invoice | "Draft an invoice for Fictional Trading in company 123456: 2 consulting hours." |

Start with the company. Some tools also need a date, period or record ID. The assistant can look up IDs from names or codes.
Each answer names the company, the currency and the time of the lookup.
Long lists come back one page at a time. Each page shows its coverage. Receivables and payables show current outstanding items.

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

The container starts the hosted service. It needs the cloud resources and private configuration that the [hosting guide](docs/HOSTING.md) (AWS) or the [self-host guide](docs/SELF-HOST.md) (AWS or Azure) describes.
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
