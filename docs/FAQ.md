# Exact Online connection: security questions

Owner: Software Combined IT  
Status: source design; staff acceptance remains pending  
Last updated: 16/11/2026  
Status source: [Qualification record](QUALIFICATION.md)

The service is not yet approved for wider staff use. IT can approve a guided pilot through one checked AI app.
Live permission and client checks remain outstanding. These answers describe the implemented design.

## What is this connection?

The connection lets an approved artificial intelligence (AI) app request information from Exact Online. Software Combined Group (SCG) provides the connection service.

Model Context Protocol (MCP) is a standard for connecting AI apps to information. A request follows this path:

```text
You ask a question -> AI app
AI app sends a structured lookup -> SCG service -> Exact Online
Exact returns records -> SCG service -> AI app -> Your answer
```

The AI app converts your question into a limited lookup, such as a company and invoice number.
The service checks access and returns permitted records. The AI app prepares the answer.

## What can it read?

The service can find companies, search customers, look up sales invoices and read current receivables. Receivables are amounts customers still owe.

Each request returns a limited page and says whether more results are available. Records can change between pages. The service does not calculate complete totals or historical receivables balances. Check the company, currency, retrieval time and whether the results are complete.

## Can it change my accounts?

The service is designed to read business records only. It cannot create, change, send, book or delete them.

The service enforces this restriction. Exact may grant the app and your account broader rights. Exact's own read-only restriction is unconfirmed.

## Who can see my information?

Sign in with your own Exact account and approve the connection. Access depends on your Exact permissions and the companies approved for the app. Exact makes the final access decision when the service requests records.

The service binds each connection to the Exact user who signed in. Another user cannot select your connection by name or by asking the AI. If people share an Exact login, they share that login's permissions. Use separate accounts for individual access.

IT must configure personal connections in the AI app. A shared agent connection can reuse its owner's access.

The service stops a request when it cannot verify access. Live tests of permission changes and two separate users remain required.
Anyone you share an answer with can read its information, regardless of their Exact permissions.

## Does the service know my password?

You enter your password on Exact's sign-in page. The service does not ask for or store it. Never paste passwords or tokens into an AI chat.

After approval, Exact provides access and refresh tokens. These digital credentials request records and renew access. The service stores them encrypted.

## What does the service store and log?

The service does not cache returned financial records. The AI app receives those records and applies its own retention rules.

The service stores connection identity, authorisations and usage limits. It also keeps temporary information for additional pages. This can include record identifiers and search filters. Expired information may remain in storage or backups for longer.

Application logs are designed to contain a request ID, result status and duration. They exclude request bodies, tokens and financial records. Infrastructure and provider logs have separate controls.
The hosting configuration sets application log retention to 30 days.

## How is information protected?

The design encrypts stored connection and usage information. It separately encrypts the Exact access and refresh tokens. It encrypts connections from the AI app to the service and from the service to Exact.

Traffic between the service's entry point and its application is not separately encrypted. Network controls restrict that private path. Authorised operators manage the service and its keys. People with enough administrative access could view data during processing or in storage. Deployment checks remain required.

## Where does information go?

The selected hosting region is Frankfurt, Germany. Not every copy or process necessarily stays in the European Union.

Exact, the AI provider and organisation audit systems can use other locations. Your organisation should confirm those locations and its agreements before use.

## Does an AI provider keep or train on the information?

The AI app may retain your question, the returned records and the answer. Training and retention depend on the provider, product, workspace settings and contract.

Ask your administrator which apps and settings are approved. See [OpenAI](https://openai.com/business-data/), [Anthropic](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training), and [Microsoft](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy).

## How do I stop access?

Ask IT to disable your service connection. The service clears the credentials from the active connection and invalidates its grants.
Your Exact administrator can also revoke the app's access. Revoking the app may affect other users.

Removing an AI connector alone does not guarantee that all service grants are revoked. Disabling the service connection does not erase all identity, usage or temporary query information. It does not erase backups, audit records or past chats. Ask IT about removal and retention.

## What happens when a connection fails?

If access expires or Exact denies a request, the service stops the read. Reconnect or ask IT to check access. If a credential exchange is uncertain, stop retrying and contact IT.

## Can I rely on every answer?

No. AI apps can misunderstand questions or give incorrect answers. Record text can also contain misleading instructions aimed at the AI app. The service treats this as data, but cannot guarantee that the AI app ignores it.

For important decisions, compare the answer with Exact and the approved finance report. Check the time, company, currency and result completeness.

## Is the source code public?

The [public code repository](https://github.com/software-combined/SC_Exact_MCP) contains software and tests. The new service tests use fictional data. Customer records, passwords and keys must not be published. The hosted service is separate from the older local server.

## Can another company use the same Exact app?

An Exact customer app serves its own subscription. Another customer may need its own app and deployment, or an Exact-approved app for multiple customers. Confirm this with Exact and IT. See [Exact's developer guidance](https://support.exactonline.com/community/s/article/All-All-DNO-Content-developerssubscriptiont?language=en_GB).

## Is the service ISO 27001 certified?

Amazon Web Services (AWS) has ISO/IEC 27001 certification for applicable services. That does not certify this connection service. Software Combined remains responsible for its controls. See [AWS's certification information](https://aws.amazon.com/compliance/iso-27001-faqs/).

## When will it be available?

IT can offer a guided pilot after it checks deployment, personal Exact consent, and the selected AI app and workspace.
The pilot can supply the second-person access check. IT will provide its approved connection details.
Wider release still requires two-person access proof and owner acceptance. Each AI app needs its own check before use.

