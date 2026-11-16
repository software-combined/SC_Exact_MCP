# Staff guide

The service is not ready for wider staff use.
IT can approve a guided pilot through one checked AI app and workspace.
IT will provide that connection or published agent after its required checks pass.
Read the [security questions](FAQ.md) before you connect.

## Guided pilot handover

IT confirms the approved AI app, workspace, company scope, and support contact.
The pilot uses personal Exact sign-in and the read-only operations below.
It can help verify access for a second person before wider release.

1. Use only the connection and company scope that IT approves.
2. Complete the personal sign-in steps below.
3. Ask which Exact companies you can open.
4. Check that the returned companies match your expected access.
5. Try one approved customer or invoice lookup.
6. Send IT the request ID and outcome if a check fails.

Do not send financial rows, passwords, tokens, or screenshots with private data in public reports.
An approved pilot in one AI app does not qualify another app.

## Before you connect

You need an approved AI workspace and your own Exact account.
You do not need Node.js, Docker, AWS access, or a local software installation.
IT configures the connection and application settings.
Never copy a password, token, or application secret into an AI chat.

The service reads companies, customers, sales invoices, and current receivables.
Receivables are unpaid customer amounts.
It cannot create, update, send, book, or delete business records.
Your current Exact permissions determine what you can read.

## Claude

After IT enables the approved connector:

1. Open Claude in the approved workspace.
2. Open **Customize**, then **Connectors**.
3. Select the approved SCG Exact connector.
4. Select **Connect**.
5. Complete the personal sign-in steps below.
6. Enable the connector in the conversation.

Workspace controls can change which options appear.
IT follows the [Claude connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

## ChatGPT

After IT enables the approved connection:

1. Open ChatGPT in the approved workspace.
2. Open the approved SCG Exact plugin or connector.
3. Select its connection option.
4. Complete the personal sign-in steps below.
5. Select SCG Exact in a new conversation.

The labels and available connection options depend on workspace settings.
IT follows the [official OpenAI connection guide](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt).
Staff should not create another custom server or enter application credentials.

## Microsoft 365 Copilot

After IT publishes the approved agent:

1. Open the SCG Exact agent shared by IT.
2. Start a conversation with that agent.
3. Select the personal connection when prompted.
4. Complete the personal sign-in steps below.
5. Continue in the same agent.

IT selects the approved setup route in the [hosting guide](HOSTING.md#register-three-ai-clients).
Staff do not paste a server URL into ordinary Copilot chat.

## Personal sign-in

1. Select **Connect personal Exact account**.
2. Sign in to Exact with your own account.
3. Review the Exact consent request.
4. Check the Exact user shown on the SCG confirmation page.
5. If the user is correct, confirm that user and the named AI client.

If the user is wrong, cancel the connection and ask IT to help you switch accounts.
Do not confirm another person's Exact account.

Each AI client asks for its own consent.
Your clients share your personal Exact connection and request limits.
Another person's connection is never a fallback.

## Ask a question

Start with a company question:

> Which companies can I open in Exact?

Then use the company name in a specific request:

> Find customer C001 in the company I selected.
>
> Show sales invoice 20260001 in that company.
>
> Show its current overdue receivables due before 31 January 2026.

Check the returned company, currency, and source time.
If the result is partial, ask for the next page with the same filters.
Pages can change while you read them.
A page is not a complete financial total or a historical balance.

## If something fails

| Message or symptom | Next step |
| --- | --- |
| Connection is missing | Ask IT whether the service and your workspace are approved. |
| Exact denies access | Check your company and Exact permissions with IT. |
| Sign-in expired | Start the connection again. |
| Two requests are running | Wait for them to finish, then retry. |
| Source-call budget or cooldown | Wait for the stated window, then narrow the request. |
| Cursor expired or query changed | Start the query again with the intended company and filters. |
| Credential exchange is uncertain | Stop reconnect attempts and give IT the request ID. |

To remove one AI client, use its disconnect option.
To disconnect the shared Exact connection, ask IT for the approved connection reset.
That reset requires all AI clients to authorize again.
