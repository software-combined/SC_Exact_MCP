# Exact Online connection: security questions

Owner: Software Combined IT  
Status: running in production; guided pilot only  
Last updated: 16/11/2026  
Status source: [Qualification record](QUALIFICATION.md)

These answers explain how the connection handles your information, in plain words.
The service runs in production, but only for a guided pilot. Wider staff use waits for more live checks.

## What is this connection?

The connection lets an approved artificial intelligence (AI) assistant request information from Exact Online. Software Combined Group (SCG) provides the connection service.

Model Context Protocol (MCP) is a standard for connecting AI assistants to information. A request follows this path:

```text
You ask a question -> AI assistant
AI assistant sends a structured lookup -> SCG service -> Exact Online
Exact returns records -> SCG service -> AI assistant -> Your answer
```

The AI assistant converts your question into a limited lookup, such as a company and invoice number.
The service checks access and returns permitted records. The AI assistant prepares the answer.

## What can it read?

The service can find companies, search customers, look up sales invoices and read current receivables. Receivables are amounts customers still owe.

Each request returns a limited page and says whether more results are available. Records can change between pages. The service does not calculate complete totals or historical receivables balances. Check the company, currency, retrieval time and whether the results are complete.

## Can it change my accounts?

It can make three kinds of change: create a customer, change a customer's details, and create a draft sales invoice.
It cannot delete records, book entries, send invoices or make payments. The service enforces this list; no other change is possible through it.

Exact checks that your own account may make each change. Whether your AI assistant asks before a change depends on its tool-permission settings, as for any connected tool.
The service sends each change once and never retries it on its own. If the connection drops during a change, you may get no answer at all. Check Exact before you ask again.

A draft sales invoice is not booked or sent. A person checks and processes it in Exact.

## Who can see my information?

Sign in with your own Exact account and approve the connection. Access depends on your Exact permissions and the companies approved for the app. Exact makes the final access decision when the service requests records.

The service binds each connection to the Exact user who signed in. Another user cannot select your connection by name or by asking the AI. If people share an Exact login, they share that login's permissions. Use separate accounts for individual access.

IT must configure personal connections in the AI assistant. A shared agent connection can reuse its owner's access.

The service stops a request when it cannot verify access. Live tests of permission changes and two separate users remain required.
Anyone you share an answer with can read its information, regardless of their Exact permissions.

## Does the service know my password?

You enter your password on Exact's sign-in page. The service does not ask for or store it. Never paste passwords or tokens into an AI chat.

After approval, Exact gives the service two tokens (digital credentials). An access token requests records. A refresh token renews access. The service stores both encrypted.

## What does the service store and log?

The service does not cache returned financial records. The AI assistant receives those records and applies its own retention rules.

The service stores connection identity, authorisations and usage limits. It also keeps temporary information for additional pages. This can include record identifiers and search filters. Expired information may remain in storage or backups for longer.

Application logs contain a request ID, the type of request, the result, and how long it took. A failed request can also record which step failed. Logs never contain request bodies, tokens, passwords or financial records. Infrastructure and provider logs have separate controls.
The hosting configuration sets application log retention to 30 days.

## How is information protected?

The design encrypts stored connection and usage information. It separately encrypts the Exact access and refresh tokens. It encrypts connections from the AI assistant to the service and from the service to Exact.

Traffic between the service's entry point and its application is not separately encrypted. Network controls restrict that private path. Authorised operators manage the service and its keys. People with enough administrative access could view data during processing or in storage. Deployment checks remain required.

## Where does information go?

The selected hosting region is Frankfurt, Germany. Not every copy or process necessarily stays in the European Union.

Exact, the AI provider and organisation audit systems can use other locations. Your organisation should confirm those locations and its agreements before use.

## Does an AI provider keep or train on the information?

The AI assistant may retain your question, the returned records and the answer. Training and retention depend on the provider, product, workspace settings and contract.

Ask your administrator which AI assistants and settings are approved. See [OpenAI](https://openai.com/business-data/), [Anthropic](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training), and [Microsoft](https://learn.microsoft.com/en-us/copilot/plan/microsoft-365-copilot-privacy).

## How do I stop access?

Tell IT straight away. Your Exact administrator can block or remove your Exact access. Reads through the service stop once the current Exact access token ends, which can take up to about ten minutes.
IT can also reset all service connections. That stops reads at the next request, but everyone must sign in again. Revoking the app in Exact affects every user of the app.

Removing an AI assistant's connector alone does not guarantee that all service grants are revoked. Resetting connections does not erase all identity, usage or temporary query information. It does not erase backups, audit records or past chats. Ask IT about removal and retention.

## What happens when a connection fails?

If access expires or Exact denies a request, the service stops the read. It does not guess or use another person's access.
If sign-in does not finish, close the window and try again. If your assistant asks you to sign in again, do so.
A failed sign-in or refresh usually affects only you, and IT does not need to reset anything. Some limits are shared, so if several people see the same error at the same time, tell IT.
Every error page shows a reference number. If a problem keeps happening, send that number to IT.

## Can I rely on every answer?

No. AI assistants can misunderstand questions or give incorrect answers. Record text can also contain misleading instructions aimed at the AI assistant. The service treats this as data, but cannot guarantee that the AI assistant ignores it.

For important decisions, compare the answer with Exact and the approved finance report. Check the time, company, currency and whether the result is complete.

## Is the source code public?

The [public code repository](https://github.com/software-combined/SC_Exact_MCP) contains software and tests. The new service tests use fictional data. Customer records, passwords and keys must not be published. The hosted service is separate from the older local server.

## Can another company use the same Exact app?

An Exact customer app serves its own subscription. Another company may need its own app and deployment, or an Exact-approved app for multiple customers. Confirm this with Exact and IT. See [Exact's developer guidance](https://support.exactonline.com/community/s/article/All-All-DNO-Content-developerssubscriptiont?language=en_GB).

## Is the service ISO 27001 certified?

Amazon Web Services (AWS) has ISO/IEC 27001 certification (an international information security standard) for applicable services. That does not certify this connection service. Software Combined remains responsible for its controls. See [AWS's certification information](https://aws.amazon.com/compliance/iso-27001-faqs/).

## When will it be available?

The service runs now for a guided pilot with Microsoft 365 Copilot.
Wider staff use follows when a second person with different Exact access is checked and the owner accepts the results.
Claude and ChatGPT each need their own check before staff use them. IT will tell you when your assistant is ready.

