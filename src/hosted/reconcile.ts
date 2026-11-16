import { z } from "zod";
import { DynamoStore } from "./storage/dynamo.js";
import { ExchangeGate } from "./runtime/exchanges.js";
import { regionSchema } from "./domain/identity.js";

async function reconcile() {
  const env = z.object({ AWS_REGION: z.enum(["eu-central-1", "eu-west-1"]), SCG_STATE_TABLE: z.string().min(3),
    SCG_EXACT_APP_ID: z.string().min(1), SCG_EXACT_REGION: regionSchema,
    SCG_CONFIRM_REAUTH_ALL: z.literal("yes"), SCG_CONFIRM_WRITERS_STOPPED: z.literal("yes") }).parse(process.env);
  const store = new DynamoStore(env.SCG_STATE_TABLE, env.AWS_REGION);
  await new ExchangeGate(store, `${env.SCG_EXACT_APP_ID}:${env.SCG_EXACT_REGION}`).reconcileExpired();
  process.stdout.write('{"event":"app_reconciled","nextAction":"Every person must reconnect"}\n');
}
reconcile().catch(() => { process.stderr.write('{"event":"reconciliation_failed"}\n'); process.exit(1); });
