import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { KMSClient, GenerateDataKeyCommand } from "@aws-sdk/client-kms";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { expect, it } from "vitest";
import { awsClientOptions, awsRequest } from "../../src/hosted/storage/aws.js";

const credentials = { accessKeyId: "FictionalLocalKey", secretAccessKey: "fictional-local-secret" };
type Service = "DynamoDB" | "KMS" | "SecretsManager";
function attempt(service: Service, endpoint: string, headers: boolean) {
  const options = { ...awsClientOptions, region: "eu-central-1", endpoint, credentials,
    requestHandler: { ...awsClientOptions.requestHandler, requestTimeout: headers ? 100 : 3000 } };
  if (service === "DynamoDB") {
    const client = new DynamoDBClient(options);
    return { request: (signal: AbortSignal): Promise<unknown> => client.send(new GetItemCommand({
      TableName: "fictional-table", Key: { pk: { S: "fictional" } } }), { abortSignal: signal }), destroy: () => client.destroy() };
  }
  if (service === "KMS") {
    const client = new KMSClient(options);
    return { request: (signal: AbortSignal): Promise<unknown> => client.send(new GenerateDataKeyCommand({
      KeyId: "fictional-key", KeySpec: "AES_256" }), { abortSignal: signal }), destroy: () => client.destroy() };
  }
  const client = new SecretsManagerClient(options);
  return { request: (signal: AbortSignal): Promise<unknown> => client.send(new GetSecretValueCommand({
    SecretId: "fictional-config" }), { abortSignal: signal }), destroy: () => client.destroy() };
}

for (const service of ["DynamoDB", "KMS", "SecretsManager"] as const) {
  it.concurrent.each(["headers", "dripping body"])(`bounds ${service} with delayed %s without retrying`, async (mode) => {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests++;
      if (mode !== "headers") { res.writeHead(200, { "Content-Type": "application/json" }); res.write(" "); }
      const drip = mode === "headers" ? undefined : setInterval(() => res.write(" "), 50);
      const finish = setTimeout(() => { clearInterval(drip); res.end("{}"); }, 6000);
      res.once("close", () => { clearInterval(drip); clearTimeout(finish); });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const call = attempt(service, endpoint, mode === "headers");
    try {
      const started = performance.now();
      await expect(awsRequest(call.request)).rejects.toMatchObject({ name: "TimeoutError" });
      expect(performance.now() - started).toBeLessThan(mode === "headers" ? 2500 : 5000);
      expect(requests).toBe(1);
    } finally {
      call.destroy(); server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 8000);
}

it.concurrent("bounds delayed credentials before dispatch and handles the late SDK rejection without a request", async () => {
  let release!: (value: typeof credentials) => void;
  const ready = new Promise<typeof credentials>((resolve) => { release = resolve; });
  let requests = 0;
  const server = createServer((_req, res) => { requests++; res.end("{}"); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const client = new DynamoDBClient({ ...awsClientOptions, region: "eu-central-1",
    endpoint: `http://127.0.0.1:${(server.address() as { port: number }).port}`, credentials: () => ready });
  let underlying: Promise<unknown> | undefined;
  try {
    await expect(awsRequest((signal) => {
      underlying = client.send(new GetItemCommand({ TableName: "fictional-table", Key: { pk: { S: "fictional" } } }),
        { abortSignal: signal });
      return underlying;
    })).rejects.toMatchObject({ name: "TimeoutError" });
    release(credentials);
    await expect(underlying).rejects.toMatchObject({ name: "AbortError" });
    expect(requests).toBe(0);
  } finally {
    release(credentials); client.destroy(); server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 8000);
