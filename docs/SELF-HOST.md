# Deploy your own copy

This guide is for a company's IT team. It sets up your own copy of SCG Exact MCP in your own Amazon Web Services (AWS) account
or your own Microsoft Azure subscription.
Your Exact data then flows only between Exact, your cloud account and your AI assistant. Nothing passes through Software Combined.

Steps 1 to 5 below use AWS. If you use Azure, read [On Azure](#on-azure) first: it replaces the AWS parts.

Allow about two hours the first time. Most of it is waiting for AWS.

## What you need

- An AWS account. Pick any region that suits you, for example the one closest to your Exact data. Newer regions must be enabled in the account first; China regions are not supported.
- A host name for the service, such as `exact-mcp.example.com`. The deploy script manages its DNS (domain name system) record and certificate, so the domain needs a Route 53 hosted zone in that AWS account.
- A computer with the AWS command line (signed in to that account), Docker with `buildx`, Node.js 22 or newer, and Git.
- Someone who can register an app in Exact Online.
- For Copilot: someone who can upload apps in the Teams admin center.

Running costs are your own AWS bill. The main items are two network gateways, a load balancer and two small containers.
Use the [AWS pricing calculator](https://calculator.aws/) with your region before you start.

## 1. Get the code

```sh
git clone https://github.com/software-combined/SC_Exact_MCP.git
cd SC_Exact_MCP
npm ci
```

## 2. Register your Exact app

Follow [Register the source app](HOSTING.md#register-the-source-app) in your own Exact.
Use the callback `https://<your-host>/exact/callback`, with your real host name.
Keep the app ID and app secret for the next step.

## 3. Create your private configuration

Run this, with a path outside the code folder:

```sh
npm run config:generate -- /secure/path/exact-mcp-config.json --exact-app-id <your Exact app ID>
```

Paste the Exact app secret when asked. Typing is hidden.
Add `--exact-region be`, `de`, `fr`, `uk`, `es` or `com` if your Exact is not in the Netherlands.

The file holds every secret of your deployment. Keep it private and back it up securely, and not in a synced folder such as OneDrive, iCloud or Dropbox.
Do not create it again later: new client secrets would break existing sign-ins. The deploy command refuses a changed file unless you add `--replace-config`.

## 4. Write your deployment settings

Create `/secure/path/deploy-settings.json`, outside the code folder:

```json
{
  "region": "eu-central-1",
  "hostname": "exact-mcp.example.com",
  "hostedZoneId": "Z0123456789EXAMPLE",
  "exactAppId": "<your Exact app ID>",
  "configFile": "/secure/path/exact-mcp-config.json"
}
```

Use your own region code. Optional extras:

- `"profile": "<name>"` if your AWS command line uses a named profile.
- `"stackPrefix"` to name the AWS stacks. By default it comes from the host name, so several copies can share one AWS account.
- `"budgets"` to change how often the service may call Exact. The default is `{ "appPerMinute": 30, "divisionPerMinute": 10, "appPerDay": 500, "divisionPerDay": 200 }`. Keep it below your Exact allowance.
- `"tags"` to label the AWS resources, for example `{ "Owner": "it@example.com" }`.

## 5. Deploy

```sh
npm run deploy -- --settings /secure/path/deploy-settings.json
```

The command creates the network and storage, stores your configuration in AWS Secrets Manager, builds the container,
deploys the service and checks that it answers. It ends with `The service is up at https://<your-host>/mcp`.
To preview the network and storage changes first, add `--review`. It stops after that preview; the service itself updates in the normal run.

## 6. Connect Microsoft 365 Copilot

1. Create an ID for your agent and keep it:

   ```sh
   npm run copilot:package -- --new-app-id
   ```

2. Build the service and a first package. The registration does not exist yet, so use `pending` as its ID. The package lists the tools, so that Copilot can ask people to sign in:

   ```sh
   npm run build
   npm run copilot:package -- --host <your-host> --app-id <ID from step 1> --registration-id pending --version 1.0.0 --out scg-exact-copilot.zip
   ```

   To show your own company as the publisher, add `--developer-name`, `--website-url`, `--privacy-url` and `--terms-url`. Add them to every build, including step 8.

3. In the [Teams admin center](https://admin.teams.microsoft.com/policies/manage-apps), select **Upload new app** and upload the zip. Do not make it available to people yet.
4. Open **SCG Exact** in **Manage apps** and copy its **App ID**. The admin center sets this ID. It is not the ID from step 1.
5. In the [Teams Developer Portal](https://dev.teams.microsoft.com/tools), open **OAuth client registration** and select **Register client**. Fill in:
   - **Base URL**: `https://<your-host>/mcp`
   - **Restrict usage by organization**: **My organization only**
   - **Restrict usage by Teams app**: **Existing Teams app**, with the App ID from step 4. With the ID from step 1, Copilot refuses every tool call.
     Do not select **Any Teams app**. Other apps in your organisation could then use this registration.
   - Set both restrictions now. You cannot change them after you save.
   - **Authorization endpoint**: `https://<your-host>/auth`
   - **Token endpoint** and **Refresh endpoint**: `https://<your-host>/token`
   - **Scope**: `exact.read`, with **PKCE** switched on and **Request body parameters** selected
6. Copy the client ID, paste it into **Client ID**, then do the same for the secret. Neither value is shown on screen. Copy something else afterwards, so the secret does not stay on the clipboard:

   ```sh
   npm run copy:credential -- /secure/path/exact-mcp-config.json copilot id
   npm run copy:credential -- /secure/path/exact-mcp-config.json copilot secret
   ```

7. Select **Save** and copy the **OAuth client registration ID**.
8. Build the package again with that registration ID and a higher version:

   ```sh
   npm run copilot:package -- --host <your-host> --app-id <ID from step 1> --registration-id <registration ID> --version 1.0.1 --out scg-exact-copilot.zip <publisher flags from step 2>
   ```

9. In the admin center, open **SCG Exact** and upload the zip with **Upload file** under **New version**.
   Make **SCG Exact** available to a few people first.
10. Test it: in Copilot, open **Agents**, add **SCG Exact**, ask "Which Exact companies can I open?" and sign in to Exact.

Staff steps are in the [staff guide](USER-GUIDE.md). It is written for Software Combined's copy: where it says Software Combined IT, your staff contact your own IT team.

## 7. Connect Claude or ChatGPT (optional)

These steps are not yet tested live. Check them with one person before you roll out.

- **Claude**: an organisation owner adds a custom connector with the URL `https://<your-host>/mcp`.
  Under the advanced OAuth settings, paste the `claude` client ID and secret with `npm run copy:credential`.
- **ChatGPT**: a workspace admin adds a custom connector with the same URL.
  Paste the `chatgpt` client ID and secret the same way.

## Updating

```sh
git pull
npm ci
npm run deploy -- --settings /secure/path/deploy-settings.json
```

The service replaces its containers one at a time. Most updates need no new package.
Build and upload a new package when an update adds, removes or renames a tool, or changes a tool's description, inputs or read-only marker.
Also build one when you change the name, icons, starters, instructions or registration ID.
If you are not sure, build the package and compare its `plugin.json` with the one you uploaded last.
Give it a higher version each time, such as `--version 1.0.1`, then upload it in the Teams admin center.
Never move back to a version older than the one you run; read [rollback and retained state](OPERATIONS.md#rollback-and-retained-state).
If you upgrade from a read-only version to one with change tools, sign everyone in again once ([revoking all connections](OPERATIONS.md#abandoned-exchanges-and-revoking-all-connections)). Then everyone approves under the new wording, which includes changes.
The finance release asks each person to approve the expanded reads when they reconnect.
Keep your existing app ID and OAuth registration. Complete the
[finance checks](QUALIFICATION.md#finance-reads) before wider rollout.

For a smaller finance package, add `--finance` to the package command. The
default package adds the named BoostU reads. To pilot the wider write catalogue,
see [Copilot changes](CATALOGUE.md#copilot-changes).

## If something goes wrong

- The deploy command stops with a message: fix the cause, then run it again. If the very first deploy failed, first delete the failed stack in the CloudFormation console. Its settings secret, key and table stay behind on purpose; delete them too if you start over.
- You changed the host name: the deploy creates a new copy. Delete the old copy's two stacks in the CloudFormation console.
- The service is not healthy: open the ECS service events in the AWS console.
- A sign-in fails: the error page shows a reference. Search for it in the service's CloudWatch logs.

[OPERATIONS.md](OPERATIONS.md) covers recovery, and [FAQ.md](FAQ.md) answers security questions.

## On Azure

Use this route if your company uses Microsoft Azure instead of AWS.
Steps 1 to 3, 6 and 7 stay the same. Replace "What you need" and steps 4 and 5 with the parts below.

### What you need on Azure

- An Azure subscription. Any Azure region works.
- Permission to create resources and role assignments in that subscription, for example the Owner role.
- A host name for the service that is a sub-domain, such as `exact-mcp.example.com`.
  You add two DNS records for it at your DNS provider during the deploy.
- A Mac or Linux computer with the Azure command line (`az`), Node.js 22 or newer, and Git.
  On Windows, use Windows Subsystem for Linux. You do not need Docker: Azure builds the container for you.
- Sign in first with `az login`, as a person rather than a service principal.

Running costs are your own Azure bill. The main items are two small containers in Azure Container Apps,
a container registry, a key vault, a storage account and a log workspace.
Use the [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator/) with your region before you start.

### 4. Write your Azure settings

Create `/secure/path/azure-settings.json`, outside the code folder:

```json
{
  "resourceGroup": "exact-mcp",
  "location": "australiaeast",
  "hostname": "exact-mcp.example.com",
  "exactAppId": "<your Exact app ID>",
  "configFile": "/secure/path/exact-mcp-config.json"
}
```

Use your own region name, such as `westeurope` or `uksouth`. `az account list-locations -o table` lists them.
The resource group is created if it does not exist. An existing group must already be in the same region, and keeps its own tags. Optional extras:

- `"subscription": "<name or ID>"` if you have more than one subscription.
- `"budgets"` and `"tags"`, as in the AWS settings.
- `"prefix"` to name the resources, 3 to 20 lowercase letters, digits and hyphens. The default is `exact-mcp`.

### 5. Deploy on Azure

```sh
npm run deploy:azure -- --settings /secure/path/azure-settings.json
```

The command shows the Azure account you are signed in to. It creates the resource group, a managed identity,
a key vault with an encryption key, a storage table, a container registry and a Container Apps environment.
It stores your private configuration in the key vault without printing it. New permissions can take a few minutes to work, so it may wait here.
It then builds the container in your registry and starts two copies of the service.

The first time, it prints two DNS records: a `CNAME` for your host name and a `TXT` record for `asuid.<your-host>`.
Add both at your DNS provider, then press Enter. Azure then issues a free certificate for your host name.
The command ends with `The service is up at https://<your-host>/mcp`. To see the planned Azure changes first, add `--review`.

How the Azure copy works:

- Azure Container Apps handles HTTPS. It passes your host name and `X-Forwarded-Proto: https` to the service, which the service requires.
- Two copies run. Shared sign-in state is in Azure Table Storage, so either copy can answer.
- Exact tokens are encrypted with a new random key each time. That key is itself locked by a key in Azure Key Vault, which never leaves the vault. The private configuration is a Key Vault secret.
- The service signs in to Azure with its managed identity, so it stores no Azure passwords or storage keys. (The template gives the log workspace key to Azure Container Apps for logging only.)
- Each person who runs the deploy gets permission to store the private configuration in Key Vault. Remove that role from people who no longer deploy.
- Expired one-time records stay in the table until they are reused. They are small and hold no Exact tokens; Exact tokens are only in the encrypted connection records.

To update, run the [Updating](#updating) commands with `npm run deploy:azure` and your Azure settings.
The DNS records and certificate stay in place, so the command does not ask for them again.

### If something goes wrong on Azure

- The deploy command stops with a message: fix the cause, then run it again.
- You deleted a copy and deploy again with the same resource group: Azure keeps the deleted Key Vault name for up to 90 days. Recover it with `az keyvault recover`, or choose another `prefix`.
- The service is not healthy: in the Azure portal, open the container app, then **Revisions** and **Log stream**.
- A sign-in fails: search for the error reference in the log workspace (`<prefix>-logs`).
