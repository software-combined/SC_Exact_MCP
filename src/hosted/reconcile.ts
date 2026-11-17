import { z } from "zod";
import { DynamoStore } from "./storage/dynamo.js";
import { AzureTableStore } from "./storage/azure-table.js";
import { ExchangeGate } from "./runtime/exchanges.js";
import { regionSchema } from "./domain/identity.js";
import { awsRegion, azureTable } from "./runtime/config.js";

// Emergency operator tool: invalidates every saved connection so each person signs in again.
async function reconcile() {
  const common = { SCG_EXACT_APP_ID: z.string().min(1), SCG_EXACT_REGION: regionSchema, SCG_CONFIRM_REAUTH_ALL: z.literal("yes") };
  const env = z.discriminatedUnion("SCG_CLOUD", [
    z.object({ SCG_CLOUD: z.literal("aws"), AWS_REGION: awsRegion, SCG_STATE_TABLE: z.string().min(3), ...common }),
    z.object({ SCG_CLOUD: z.literal("azure"), ...azureTable, ...common }),
  ]).parse({ ...process.env, SCG_CLOUD: process.env.SCG_CLOUD ?? "aws" });
  const store = env.SCG_CLOUD === "azure" ? new AzureTableStore(env.SCG_TABLE_ENDPOINT, env.SCG_TABLE_NAME, env.AZURE_CLIENT_ID)
    : new DynamoStore(env.SCG_STATE_TABLE, env.AWS_REGION);
  await new ExchangeGate(store, `${env.SCG_EXACT_APP_ID}:${env.SCG_EXACT_REGION}`).revokeAll();
  process.stdout.write('{"event":"all_connections_revoked","nextAction":"Every person must reconnect"}\n');
}
reconcile().catch(() => { process.stderr.write('{"event":"reconciliation_failed"}\n'); process.exit(1); });
