# Hosting and operator setup

Owner: Software Combined IT. Environment: production in an approved EU region.
Frankfurt, `eu-central-1`, is SCG's target. A self-hosted copy can use any AWS region; see [Deploy your own copy](SELF-HOST.md).
Status: source implementation and deployment procedure; staff qualification remains separate.
Examples use `https://exact-mcp.example.com`.
Keep the actual approved origin in private deployment parameters.

## Prerequisites

Use a dedicated SCG Exact MCP (Model Context Protocol) application.
Do not reuse another integration's app credentials or refresh tokens.
The same approved Exact user can test a distinct app.
That test does not prove access isolation between two people.

Verify the Amazon Web Services (AWS) account, effective role, explicit region, and approved scope before any platform change.
Pass the approved region explicitly in deployment commands and private parameters.
No template enforces a region; the approved region is the operator's recorded decision.
The intended target is a dedicated SCG Europe account under the main billing account.
Its account binding, name, ownership tags, and billing relationship require current owner confirmation.
Do not assume an existing shared account is the target.
An account name does not establish service health or staff acceptance.
Keep its real account ID and root contact in the private deployment record.
Verify CloudTrail coverage and the available deployment permissions.
Confirm the proposed network range does not conflict with connected networks.

Confirm organisation audit coverage and log delivery with the platform owner.
An empty child-account listing can reflect propagation or permissions. It does not prove that audit coverage is absent.
If coverage is unknown, stop deployment.
If the owner confirms that no suitable trail exists, review `infra/audit.yaml` before financial access.
The template creates a dedicated-account, multi-region management trail with log validation.
Its private S3 bucket is encrypted, versioned, and retained.
The template adds no financial data events, organization trail, or automatic retention expiry.
Its account rule requires the verified child account and excludes the management account.
After deployment, read back logging status and confirm actual log delivery.
If inherited audit is active, verify its delivery and do not create a duplicate trail.
The optional trail name follows its immutable stack name.
Use a stack name with at least three characters.

EU runtime hosting does not establish all-EU data residency.
Review organisation audit destinations, Exact processing, and processing by the AI (artificial intelligence) provider separately.
An inherited organization trail can use a different home region or storage location.

The service template requires private subnets with HTTPS egress, public load-balancer subnets,
a validated certificate, an image repository, and a populated configuration secret.
The default VPC (virtual private cloud) alone does not establish those prerequisites.
Verify two distinct private availability zones and each subnet's same-zone NAT (network address translation) route before service deployment.
If either zone or egress path is unknown, stop deployment.

`infra/foundation.yaml` creates isolated production prerequisites after approval.
It creates billable networking, including one NAT gateway in each of two availability zones.
Each private subnet has its own route table and same-zone NAT gateway.
This avoids a shared NAT failure point.

The foundation also creates a scanned image repository, DNS-validated certificate,
and an empty Secrets Manager configuration container.
It does not create Exact credentials or complete client registrations.
The selected DNS hosted zone must belong to the deployment account.
If another account owns the parent zone, first delegate only the approved service subdomain.
The repository does not create that cross-account delegation.

## Validate source and templates

Use Node.js 22 or newer.
The local infrastructure checks use `cfn-lint` 1.57.1 and `cfn-guard` 3.2.1.

```sh
npm ci
npm run verify
npm run verify:infra
```

All three templates must pass syntax, schema, and guard checks.
Before deployment, also inspect CloudFormation change-set validation with the real target parameters.
Local checks do not prove AWS permissions or resource availability.

## Register the source app

For an internal customer app, open the company menu in Exact.
Select **Import/Export > Other > App registrations > New**.
This customer registration serves that subscription.
Cross-customer use requires a separately qualified developer registration.

1. Name the dedicated app **SCG Exact MCP**.
2. Use the description **Access to Exact Online through AI apps.**
3. Set the callback to `https://<approved-host>/exact/callback`.
4. Confirm the app ID, Exact region, and approved company consent.
5. Keep the app secret in private runtime configuration.

Exact requires the callback URI to match exactly.
The service validates identity through the fixed `current/Me` endpoint.
The immutable user ID and region define the personal subject.
The app needs read access, plus write access to customers and sales invoices for the change tools.
The service itself limits changes to its three fixed change tools.
Source access still depends on the Exact user and app permissions.

## Register three AI clients

Each AI assistant connects to the service as an OAuth client. OAuth is an open standard for granting access without sharing passwords.
Create one static SCG OAuth registration for each target client.
Use authorization code with S256 proof key for code exchange (PKCE).
The only resource scope is `exact.read`. The name is kept so existing registrations keep working; it covers every tool.
The advertised `openid` identity scope returns the canonical subject without profile or email claims.
Public dynamic client registration is disabled.

| Client | Operator action |
| --- | --- |
| Claude | Use the approved connector and static client. Its documented callback is `https://claude.ai/api/mcp/auth_callback`. |
| ChatGPT | Use the approved custom connection and static client. Copy its exact management-page callback. |
| Microsoft 365 Copilot | Use the [declarative agent route](#microsoft-365-copilot-declarative-agent-route) below. Copilot Studio is an alternative with its own callback. |

Do not guess a callback URI or use a wildcard.
Use the supported client authentication method recorded in private configuration.
The staff guide links the current provider instructions.
Actual use in all three clients remains a qualification gate.

ChatGPT supports `https://chatgpt.com/connector_platform_oauth_redirect` when issuer identification meets RFC 9207.
Issuer metadata and protected-resource metadata must match exactly.
Success and error authorization responses must return that same `iss` value.
The management page remains the authority for the actual connection callback.
See the [OpenAI authentication guide](https://developers.openai.com/plugins/build/auth).

### Microsoft 365 Copilot: declarative agent route

IT used this route for the first pilot. It needs a Microsoft 365 admin, but no Copilot Studio licence.
Users on the basic Copilot Chat plan can add the agent.

Before you start, choose a new GUID as the agent's Teams app ID. It becomes the `id` in `manifest.json` (see the package table below).

1. Allow the callback `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect` on the Copilot client in private configuration.
2. In the [Teams Developer Portal](https://dev.teams.microsoft.com/tools), open **Tools**, then **OAuth client registration**, then **Register client**.
3. Set **Base URL** to `https://<approved-host>/mcp`.
4. Select **My organization only** and **Existing Teams app**, and enter the agent's Teams app ID. Then only your own organisation's copy of the agent can use this registration. Set both choices when you create the registration; changing them later did not persist. Microsoft's guide warned that binding breaks MCP tool calls, but binding worked in the live test on 16/11/2026.
5. Set the authorization endpoint to `/auth`, and the token and refresh endpoints to `/token`, on the approved host.
6. Set **Scope** to `exact.read`, switch on **PKCE**, and keep **Request body parameters**.
7. Paste the Copilot client ID and secret from private configuration. Do not show them in chat, screenshots or tickets.
8. Save, and copy the **OAuth client registration ID**. It is a reference, not a secret.

Then build the app package. It has five files:

| File | Content |
| --- | --- |
| `manifest.json` | App manifest version 1.29, with `copilotAgents.declarativeAgents` pointing to the agent file |
| `declarativeAgent.json` | Agent manifest v1.9: name, instructions, conversation starters, and one action that points to the plugin file |
| `plugin.json` | Plugin manifest v2.4 with one `RemoteMCPServer` runtime, `auth.type` `OAuthPluginVault`, and `reference_id` set to the registration ID |
| `color.png`, `outline.png` | 192 by 192 colour icon and 32 by 32 white outline icon |

In `plugin.json`, set `spec.url` to the MCP URL, set `run_for_functions` to `["*"]` and `functions` to `[]`, and leave out `mcp_tool_description`.
Copilot then reads the tools, their descriptions and their read-only or change markers live from the service's `tools/list` response.
Keep the agent instructions general and name no tools, so new tools need no package change.
Validate each file against the schema URL in its `$schema` field before upload.

Upload the zip in the [Teams admin center](https://admin.teams.microsoft.com/policies/manage-apps) with **Upload new app**.
Make it available only to the pilot users at first. Staff then add **SCG Exact** from **Agents** in Copilot.
Each company runs its own deployment, with its own Exact app, registration and package.
If one deployment must serve staff in another Microsoft 365 organisation on the same Exact subscription, choose **Any Microsoft 365 organization** in step 4 instead, with the owner's written approval.
Any organisation that holds the zip could then upload an altered copy with the same app ID. That copy reaches only that organisation's own people and their own Exact access.
Tool changes come from the service, so nobody re-uploads the package for them.
Rebuild with a higher `version` and upload again when the name, icons, starters, instructions or OAuth client registration ID change.

See Microsoft's [MCP plugin guide](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/build-mcp-plugins)
and [OAuth guide](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-authentication-oauth).

### Copilot Studio route
With [Copilot Studio manual OAuth](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent), Copilot Studio generates its own callback for the connection.
Do not use the Teams callback in its place.

For Copilot Studio, select **End-user credentials** for the SCG Exact tools.
Do not use **Maker-provided credentials** or a shared author connection.
A shared connection can expose the author's Exact access to other people.
See [Microsoft's credential guidance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-no-maker-authentication).
Qualify the published channel with another person who signs in through their own Exact grant.
The maker's test pane alone does not prove personal access.
This requirement applies to these tools; it does not authorise a platform-wide policy change.

The canonical issuer is the approved production origin.
The sole resource and access-token audience is `https://<approved-host>/mcp`.
Metadata is available at `/.well-known/oauth-authorization-server`
and `/.well-known/oauth-protected-resource/mcp`.
A missing resource parameter can resolve only to that canonical audience.
An explicit different resource is rejected.

## Prepare private configuration

Generate the configuration outside the repository:

```sh
npm run config:generate -- /absolute/private/path/scg-exact-config.json --exact-app-id <Exact app ID> [--exact-region nl]
```

The script asks for the Exact app secret with hidden input, or reads it from a pipe.
It refuses an existing file or a path inside the repository, and uses owner-only file permissions.
It generates signing keys, cookie keys, and client secrets without printing their values.
It fills the fixed Claude, ChatGPT and Microsoft 365 Copilot callbacks, so the file is complete.
It does not contact Exact or AWS.
To paste a client ID or secret into a portal, use `npm run copy:credential -- <config> <claude|chatgpt|copilot> <id|secret>`. It copies the value to the clipboard and never prints it.

The configuration object has four sections:

| Section | Required content |
| --- | --- |
| `exact` | Dedicated app ID, app secret, and fixed region. |
| `clients` | Exactly three distinct IDs, names, exact HTTPS callbacks, and authentication methods. |
| `jwks` | One to three private RSA signing keys using RS256. |
| `cookieKeys` | Two or three strong cookie keys, shared by every replica. |

The required client names are `Claude`, `ChatGPT`, and `Microsoft 365 Copilot`.
Populate the approved secret through a secure owner-controlled process.
Never print the configuration or include it in a public issue.
The running task reads it with its IAM (identity and access management) role.

Use `.env.example` for non-secret setting names.
The service compares `SCG_EXACT_APP_ID` with the private configuration before contacting Exact.
Missing quotas or inconsistent settings stop startup.

Set explicit minute and daily budgets for the app and each division.
App budgets must allow at least eight calls in each window for the bounded public sign-in pool.
Verify the actual Exact allowances first.
The service has no quota defaults. The self-host deploy script fills cautious defaults when its settings leave them out.
Exact documents 60 calls per app/company/minute and 5,000 per app/company/day for standard access.
Licence-wide usage and observed response headers can impose further limits.
Use conservative approved budgets and confirm actual headroom before increasing them.
Daily safety counters use UTC (Coordinated Universal Time) calendar windows.
They do not claim to reproduce an Exact billing or reset window.
Observed `Retry-After` values create a shared cooldown.
One shared app slot keeps REST requests one at a time until each response is fully read or the request is cancelled.
Read the [operations guide](OPERATIONS.md) for timeout and crash limits.

## Build and deploy after approval

1. Deploy or select the approved production prerequisites.
2. Record their outputs in private deployment parameters.
3. Populate and validate the private configuration secret.
4. Build the container for Linux AMD64 in the selected deployment region.
5. Scan the image and record its immutable digest.
6. Set the service parameters from the approved outputs and verified budgets.
7. Review the CloudFormation change set and validation results.
8. Deploy `infra/production.yaml` with at least two replicas across two availability zones.
9. Read back both tasks, their zones, NAT routes, image digest, TLS endpoint, and metadata.
10. Follow the live qualification runbook before staff use.

Pass the approved standard `--tags` values to each CloudFormation stack:
`Project`, `System`, `Environment`, `Owner`, `ManagedBy`, `DataClass`,
`RetentionClass`, `ReviewBy`, and `Company`.
Use `Environment=production` for this service.
Set the service's owner, classification, retention, and review parameters from the same approved values.
Amazon Elastic Container Service (ECS) managed tags are enabled.
The service propagates task-definition tags to running tasks.

The task role can access only the named table, configuration secret, and encryption keys.
The execution role can pull the named image and write metadata logs.
Credential-envelope permissions require app and principal context.
DynamoDB decryption has a separate service, table, and account context restriction.

State, keys, configuration, and logs are retained during stack replacement or deletion.
Do not restore an old credential state as a rollback.
Use [OPERATIONS.md](OPERATIONS.md) for rotation and recovery.
Image expiry is disabled to preserve running and rollback digests.
Remove an image only after proving that no running task or approved rollback references it.
