import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { environment, configuration } from "./runtime/config.js";
import { DynamoStore } from "./storage/dynamo.js";
import { KmsCipher } from "./storage/kms.js";
import { awsClientOptions, awsRequest } from "./storage/aws.js";
import { ExactSource } from "./exact/source.js";
import { Budgets } from "./runtime/budgets.js";
import { SourceSlot } from "./runtime/source-slot.js";
import { installShutdown } from "./runtime/shutdown.js";
import { Connections } from "./runtime/connections.js";
import { Cursors } from "./runtime/cursors.js";
import { Accounting } from "./runtime/accounting.js";
import { Broker } from "./oauth/broker.js";
import { hostedApp } from "./transport/app.js";

async function main() {
  const env = environment(process.env);
  const secrets = new SecretsManagerClient({ region: env.AWS_REGION, ...awsClientOptions });
  const { SecretString } = await awsRequest((signal) => secrets.send(new GetSecretValueCommand({
    SecretId: env.SCG_CONFIG_SECRET_ARN }), { abortSignal: signal }));
  if (!SecretString) throw new Error("Missing runtime configuration.");
  const config = configuration(env, JSON.parse(SecretString));
  const store = new DynamoStore(env.SCG_STATE_TABLE, env.AWS_REGION);
  const budgets = new Budgets(store, config.source.appId, config.limits);
  const slot = new SourceSlot(store, config.source.appId);
  const source = new ExactSource(config.source, budgets.fetcher(), undefined, (read, signal) => slot.run(read, signal),
    () => budgets.exchangeFetcher());
  const connections = new Connections(store, new KmsCipher(env.SCG_KMS_KEY_ARN, config.source.appId, env.AWS_REGION), source);
  const accounting = new Accounting(connections, budgets, new Cursors(store, config.source.appId, config.source.region));
  const broker = new Broker(config.broker, store, connections, budgets.signIns());
  const server = hostedApp(broker, accounting, store, (record) => process.stdout.write(`${JSON.stringify(record)}\n`));
  server.listen(env.PORT, "0.0.0.0", () => process.stdout.write('{"event":"listening"}\n'));
  installShutdown(server);
}
main().catch(() => { process.stderr.write('{"event":"startup_failed"}\n'); process.exit(1); });
