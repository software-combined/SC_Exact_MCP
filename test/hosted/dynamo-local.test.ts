import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CreateTableCommand, DeleteTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoStore } from "../../src/hosted/storage/dynamo.js";
import { take } from "../../src/hosted/storage/state.js";
import type { StateStore } from "../../src/hosted/domain/identity.js";

const endpoint = process.env.SCG_DYNAMO_LOCAL_ENDPOINT;
if (endpoint && !/^http:\/\/127\.0\.0\.1:\d+$/.test(endpoint)) throw new Error("Only explicit localhost DynamoDB is allowed.");
afterEach(() => vi.restoreAllMocks());

describe.runIf(Boolean(endpoint))("actual DynamoDB-local conditional expiry", () => {
  it("rejects an expired version and consumes a one-use record at most once across two adapters", async () => {
    const options = { endpoint, region: "eu-central-1", maxAttempts: 1,
      credentials: { accessKeyId: "FictionalLocalKey", secretAccessKey: "FictionalLocalSecret" } };
    const client = new DynamoDBClient(options);
    const firstClient = DynamoDBDocumentClient.from(new DynamoDBClient(options));
    const secondClient = DynamoDBDocumentClient.from(new DynamoDBClient(options));
    const table = `scg-local-expiry-${randomBytes(8).toString("hex")}`;
    await client.send(new CreateTableCommand({ TableName: table, BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [{ AttributeName: "pk", AttributeType: "S" }], KeySchema: [{ AttributeName: "pk", KeyType: "HASH" }] }));
    try {
      const a = new DynamoStore(table, "eu-central-1", firstClient); const b = new DynamoStore(table, "eu-central-1", secondClient);
      let now = Date.now(); vi.spyOn(Date, "now").mockImplementation(() => now);
      await a.write("expiring", { payload: "fictional-code" }, undefined, now + 1000);
      const row = (await b.read("expiring"))!; now += 1001;
      expect(await b.write("expiring", { used: true }, row.version, row.expiresAt)).toBeUndefined();
      const replaced = await a.write("expiring", { payload: "replacement" }, undefined, now + 10_000);
      expect(replaced).not.toBe(row.version);
      expect(await b.write("expiring", { payload: "stale" }, row.version, now + 10_000)).toBeUndefined();
      expect(await b.remove("expiring", row.version)).toBe(false);
      expect((await a.read("expiring"))?.value).toEqual({ payload: "replacement" });
      await a.write("take-expiring", { payload: "fictional-consent" }, undefined, now + 1000);
      const slow: StateStore = { read: b.read.bind(b), remove: b.remove.bind(b),
        write: async (...args) => { now += 1001; return b.write(...args); } };
      await expect(take(slow, "take-expiring")).rejects.toMatchObject({ code: "denied" });
      await a.write("one-use", { payload: "fictional-cursor" }, undefined, now + 10_000);
      const outcomes = await Promise.allSettled([take(a, "one-use"), take(b, "one-use")]);
      expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    } finally {
      vi.restoreAllMocks(); await client.send(new DeleteTableCommand({ TableName: table }));
      firstClient.destroy(); secondClient.destroy(); client.destroy();
    }
  });
});
