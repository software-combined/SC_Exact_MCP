# Exact tool catalogue

The hosted service has 73 named BoostU reads and 62 documented BoostU change
tools. It keeps each person's Exact permissions and uses the hosted service's
company checks, typed inputs, fixed fields and bounded pages.

## Finance reads

| Work | Use |
| --- | --- |
| Payment list | Open payables, payment status, suppliers and masked bank details. Check the amount in transit and Exact's approval status. |
| Liquidity planning | Receivables, payables, proposed payment dates and imported bank statement balances. Add forecast cash movements from your approved forecast. |
| Invoice checks | Sales invoice lookup, purchase entry lookup and invoice lines. Check supplier references, amounts and VAT in the invoice currency. |
| Month-end | Ledger lines, account lookup, reporting balances, journal status and the asset register. |

An imported statement balance is the balance in the imported Exact entry.
Compare payments with the bank statement before marking them settled.
Check all pages or the original report before using totals. The asset register
includes investment values and depreciation start dates. Exact's total
depreciation and last depreciation date require its XML API.

## BoostU differences

The named reads use typed equality criteria and server cursors. The general
purpose `exact_request` tool is available in the legacy command-line client.

Exact's current API reference omits these legacy operations:

- Update purchase invoice lines, general journal entries or general journal entry lines.
- Create or update item groups, sales price lists or units.

Create purchase invoice lines as part of the purchase invoice. Create purchase
order lines as part of the purchase order. The hosted delete tool accepts the
23 legacy entity types with documented delete support.

## Copilot changes

Use the supported Exact operation and native Copilot confirmation. The person
confirms through their own Exact connection. Apply your organisation's existing
approvals for invoices, banking and other sensitive actions.

1. Start with a test deployment and an approved test company.
2. Set `copilotCatalogueChanges` to `true` in the deployment settings file and deploy it. The private OAuth configuration does not need to change.
3. Build the package with `--with-changes`. Use the existing Copilot app ID and OAuth registration ID, and a higher version.
4. Give the package to the pilot audience only. Reconnect Copilot as the test user to accept the expanded consent.
5. Ask for a change on a fictional record. Check that Copilot shows the company, record and proposed change.
6. Cancel the confirmation. Verify that Exact received no write.
7. Repeat with an authorized test change. Verify the result in Exact and check that a user without that Exact permission is refused.

An acknowledged result reports Exact's response. If readback is unverified,
check the result in Exact. Check nested lines, invoice sending and quotation
actions there directly.

The package builder can export the full catalogue for local checks. Its live
Copilot qualification is pending. Microsoft reports that a large tool list
can reduce selection quality. Use the finance package for the finance pilot.

[Exact REST reference](https://start.exactonline.nl/docs/HlpRestAPIResources.aspx) ·
[Copilot tool confirmation](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-confirmation-prompts) ·
[Copilot plugin limits](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-plugins#limitations)
