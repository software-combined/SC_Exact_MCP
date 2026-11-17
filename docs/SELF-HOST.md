# Deploy your own copy

This guide is for a company's IT team. It sets up your own copy of SCG Exact MCP in your own Amazon Web Services (AWS) account.
Your Exact data then flows only between Exact, your AWS account and your AI assistant. Nothing passes through Software Combined.

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

2. In the [Teams Developer Portal](https://dev.teams.microsoft.com/tools), open **OAuth client registration** and select **Register client**. Fill in:
   - **Base URL**: `https://<your-host>/mcp`
   - **Restrict usage by organization**: **My organization only**
   - **Restrict usage by Teams app**: **Existing Teams app**, with the ID from step 1
   - Set both restrictions now: changing them after you save did not stick in our tests.
   - **Authorization endpoint**: `https://<your-host>/auth`
   - **Token endpoint** and **Refresh endpoint**: `https://<your-host>/token`
   - **Scope**: `exact.read`, with **PKCE** switched on and **Request body parameters** selected
3. Copy the client ID, paste it into **Client ID**, then do the same for the secret. Neither value is shown on screen. Copy something else afterwards, so the secret does not stay on the clipboard:

   ```sh
   npm run copy:credential -- /secure/path/exact-mcp-config.json copilot id
   npm run copy:credential -- /secure/path/exact-mcp-config.json copilot secret
   ```

4. Select **Save** and copy the **OAuth client registration ID**.
5. Build the package:

   ```sh
   npm run copilot:package -- --host <your-host> --app-id <ID from step 1> --registration-id <registration ID> --out scg-exact-copilot.zip
   ```

   To show your own company as the publisher, add `--developer-name`, `--website-url`, `--privacy-url` and `--terms-url`.

6. In the [Teams admin center](https://admin.teams.microsoft.com/policies/manage-apps), select **Upload new app** and upload the zip.
   Make **SCG Exact** available to a few people first.
7. Test it: in Copilot, open **Agents**, add **SCG Exact**, ask "Which Exact companies can I open?" and sign in to Exact.

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

The service replaces its containers one at a time. Copilot reads the tools from your service, so you do not upload the package again.
Build a new package only when you change its name, icons, starters or instructions, or your registration ID.
Give it a higher version each time, such as `--version 1.0.1`, then upload it in the Teams admin center.
Never move back to a version older than the one you run; read [rollback and retained state](OPERATIONS.md#rollback-and-retained-state).
If you upgrade from a read-only version to one with change tools, sign everyone in again once ([revoking all connections](OPERATIONS.md#abandoned-exchanges-and-revoking-all-connections)). Then everyone approves under the new wording, which includes changes.

## If something goes wrong

- The deploy command stops with a message: fix the cause, then run it again. If the very first deploy failed, first delete the failed stack in the CloudFormation console. Its settings secret, key and table stay behind on purpose; delete them too if you start over.
- You changed the host name: the deploy creates a new copy. Delete the old copy's two stacks in the CloudFormation console.
- The service is not healthy: open the ECS service events in the AWS console.
- A sign-in fails: the error page shows a reference. Search for it in the service's CloudWatch logs.

[OPERATIONS.md](OPERATIONS.md) covers recovery, and [FAQ.md](FAQ.md) answers security questions.
