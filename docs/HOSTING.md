# Hosting and operator setup

Owner: Software Combined IT. Environment: production in an approved EU region.
Frankfurt, `eu-central-1`, is the selected target. Ireland, `eu-west-1`, is the supported alternative.
Status: source implementation and deployment procedure; staff qualification remains separate.
Examples use `https://exact-mcp.example.com`.
Keep the actual approved origin in private deployment parameters.

## Prerequisites

Use a dedicated SCG MCP Exact application.
Do not reuse another integration's app credentials or refresh tokens.
The same approved Exact user can test a distinct app.
That test does not prove access isolation between two people.

Verify the AWS account, effective role, explicit region, and approved scope before any platform change.
Pass the approved region explicitly in deployment commands and private parameters.
The runtime and workload templates reject all regions outside these two EU options.
The intended target is a dedicated SCG Europe account under the main billing account.
Its account binding, name, ownership tags, and billing relationship require current owner confirmation.
Do not assume an existing shared account is the target.
An account name does not establish service health or staff acceptance.
Keep its real account ID and root contact in the private deployment record.
Verify CloudTrail coverage and the available deployment permissions.
Confirm the proposed network range does not conflict with connected networks.

Confirm organization audit coverage and log delivery with the platform owner.
An empty child-account listing can reflect propagation or permissions. It does not prove that audit coverage is absent.
If coverage is unknown, stop deployment.
If the owner confirms that no suitable trail exists, review `infra/audit.yaml` before financial access.
It creates a dedicated-account, multi-region management trail with log validation.
Its private S3 bucket is encrypted, versioned, and retained.
The template adds no financial data events, organization trail, or automatic retention expiry.
Its account rule requires the verified child account and excludes the management account.
After deployment, read back logging status and confirm actual log delivery.
If inherited audit is active, verify its delivery and do not create a duplicate trail.
The optional trail name follows its immutable stack name.
Use a stack name with at least three characters.

EU runtime hosting does not establish all-EU data residency.
Review organization audit destinations, Exact processing, and AI-provider processing separately.
An inherited organization trail can use a different home region or storage location.

The service template requires private subnets with HTTPS egress, public load-balancer subnets,
a validated certificate, an image repository, and a populated configuration secret.
The default VPC alone does not establish those prerequisites.
Verify two distinct private availability zones and each subnet's same-zone NAT route before service deployment.
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
2. Use the description **Read-only access to Exact Online through AI apps.**
3. Set the callback to `https://<approved-host>/exact/callback`.
4. Confirm the app ID, Exact region, and approved company consent.
5. Keep the app secret in private runtime configuration.

Exact requires an exact callback URI match.
The service validates identity through the fixed `current/Me` endpoint.
The immutable user ID and region define the personal subject.
The current registration form does not prove an Exact-enforced read-only scope.
Review available source scopes and permissions at registration and consent.
The hosted tool contract permits business GET requests only.
Source access still depends on the Exact user and app permissions.

## Register three AI clients

Create one static SCG OAuth registration for each target client.
Use authorization code with S256 proof key for code exchange (PKCE).
The only resource scope is `exact.read`.
The advertised `openid` identity scope returns the canonical subject without profile or email claims.
Public dynamic client registration is disabled.

| Client | Operator action |
| --- | --- |
| Claude | Use the approved connector and static client. Its documented callback is `https://claude.ai/api/mcp/auth_callback`. |
| ChatGPT | Use the approved custom connection and static client. Copy its exact management-page callback. |
| Microsoft 365 Copilot | Choose the approved declarative plugin or Copilot Studio route. Configure its distinct callback, then publish the agent. |

Do not guess a callback URI or use a wildcard.
Use the supported client authentication method recorded in private configuration.
The staff guide links the current provider instructions.
Actual use in all three clients remains a qualification gate.

ChatGPT supports `https://chatgpt.com/connector_platform_oauth_redirect` when issuer identification meets RFC 9207.
Issuer metadata and protected-resource metadata must match exactly.
Success and error authorization responses must return that same `iss` value.
The management page remains the authority for the actual connection callback.
See the [OpenAI authentication guide](https://developers.openai.com/plugins/build/auth).

The [Microsoft declarative plugin route](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-authentication-oauth)
uses `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`.
[Copilot Studio manual OAuth](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent)
instead generates a callback for its connection.
Do not substitute the Teams callback for the Studio callback.

For Copilot Studio, select **End-user credentials** for the SCG Exact tools.
Do not use **Maker-provided credentials** or a shared author connection.
A shared connection can expose the author's Exact access to other people.
See [Microsoft's credential guidance](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-no-maker-authentication).
Qualify the published channel with another person who signs in through their own Exact grant.
The maker's test pane alone does not prove personal access.
This requirement applies to these tools; it does not authorize a platform-wide policy change.

The canonical issuer is the approved production origin.
The sole resource and access-token audience is `https://<approved-host>/mcp`.
Metadata is available at `/.well-known/oauth-authorization-server`
and `/.well-known/oauth-protected-resource/mcp`.
A missing resource parameter can resolve only to that canonical audience.
An explicit different resource is rejected.

## Prepare private configuration

Generate a private draft outside the repository:

```sh
npm run config:generate -- /absolute/private/path/scg-exact-config.json
```

The script refuses an existing file and uses owner-only file permissions.
It generates signing keys, cookie keys, and client secrets without printing their values.
It does not contact Exact or AWS.
Replace every placeholder in a private editor before upload.

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
The running task reads it with its IAM role.

Use `.env.example` for nonsecret setting names.
The service compares `SCG_EXACT_APP_ID` with the private configuration before contacting Exact.
Missing quotas or inconsistent settings stop startup.

Set explicit minute and daily budgets for the app and each division.
App budgets must allow at least eight calls in each window for the bounded public sign-in pool.
Verify the actual Exact allowances first.
The code supplies no quota defaults.
Exact documents 60 calls per app/company/minute and 5,000 per app/company/day for standard access.
License-wide usage and observed response headers can impose further limits.
Use conservative approved budgets and confirm actual headroom before increasing them.
Daily safety counters use UTC calendar windows.
They do not claim to reproduce an Exact billing or reset window.
Observed `Retry-After` values create a shared cooldown.
One shared app slot keeps REST requests sequential through complete response consumption or cancellation.
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
ECS managed tags are enabled.
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
