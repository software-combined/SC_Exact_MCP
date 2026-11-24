import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { environment, configuration } from "./runtime/config.js";
import { DynamoStore } from "./storage/dynamo.js";
import { KmsCipher } from "./storage/kms.js";
import { awsClientOptions, awsRequest } from "./storage/aws.js";
import { AzureTableStore } from "./storage/azure-table.js";
import { KeyVaultCipher, readSecret } from "./storage/azure-keyvault.js";
import type { CredentialCipher, StateStore } from "./domain/identity.js";
import { ExactSource } from "./exact/source.js";
import { Budgets } from "./runtime/budgets.js";
import { SourceSlot } from "./runtime/source-slot.js";
import { installShutdown } from "./runtime/shutdown.js";
import { Connections } from "./runtime/connections.js";
import { Cursors } from "./runtime/cursors.js";
import { Accounting } from "./runtime/accounting.js";
import { Changes } from "./runtime/changes.js";
import { CatalogueChanges } from "./runtime/catalogue-changes.js";
import { Broker } from "./oauth/broker.js";
import { hostedApp } from "./transport/app.js";

type Environment = ReturnType<typeof environment>;
/** The cloud adapters: private configuration, shared state and the credential cipher. */
async function cloud(env: Environment): Promise<{ secret?: string; store: StateStore; cipher: CredentialCipher }> {
  if (env.SCG_CLOUD === "azure") {
    return { secret: await readSecret(env.SCG_CONFIG_SECRET_URL, env.AZURE_CLIENT_ID),
      store: new AzureTableStore(env.SCG_TABLE_ENDPOINT, env.SCG_TABLE_NAME, env.AZURE_CLIENT_ID),
      cipher: new KeyVaultCipher(env.SCG_KEY_ID, env.SCG_EXACT_APP_ID, env.AZURE_CLIENT_ID) };
  }
  const secrets = new SecretsManagerClient({ region: env.AWS_REGION, ...awsClientOptions });
  const { SecretString } = await awsRequest((signal) => secrets.send(new GetSecretValueCommand({
    SecretId: env.SCG_CONFIG_SECRET_ARN }), { abortSignal: signal }));
  return { secret: SecretString, store: new DynamoStore(env.SCG_STATE_TABLE, env.AWS_REGION),
    cipher: new KmsCipher(env.SCG_KMS_KEY_ARN, env.SCG_EXACT_APP_ID, env.AWS_REGION) };
}

async function main() {
  const env = environment(process.env);
  const { secret, store, cipher } = await cloud(env);
  if (!secret) throw new Error("Missing runtime configuration.");
  // configuration() refuses a secret whose Exact app differs from SCG_EXACT_APP_ID, which keys the cipher.
  const config = configuration(env, JSON.parse(secret));
  const budgets = new Budgets(store, config.source.appId, config.limits);
  const slot = new SourceSlot(store, config.source.appId);
  const source = new ExactSource(config.source, budgets.fetcher(), undefined, (read, signal) => slot.run(read, signal),
    () => budgets.exchangeFetcher());
  const connections = new Connections(store, cipher, source);
  const accounting = new Accounting(connections, budgets, new Cursors(store, config.source.appId, config.source.region));
  const broker = new Broker(config.broker, store, connections, budgets.signIns());
  const changes = new Changes(connections, budgets);
  const catalogue = config.broker.catalogueClientId ? new CatalogueChanges(connections, budgets, store) : undefined;
  const server = hostedApp(broker, accounting, changes, store, (record) => process.stdout.write(`${JSON.stringify(record)}\n`), catalogue);
  server.listen(env.PORT, "0.0.0.0", () => process.stdout.write('{"event":"listening"}\n'));
  installShutdown(server);
}
main().catch(() => { process.stderr.write('{"event":"startup_failed"}\n'); process.exit(1); });
