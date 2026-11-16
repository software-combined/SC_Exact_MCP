import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { StateStore, Versioned } from "../domain/identity.js";
import { randomUUID } from "node:crypto";

export class DynamoStore implements StateStore {
  private client: DynamoDBDocumentClient;
  constructor(private table: string, region: string, client?: DynamoDBDocumentClient) {
    this.client = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({ region, maxAttempts: 1,
      requestHandler: { requestTimeout: 3000, connectionTimeout: 1000 } }),
    { marshallOptions: { removeUndefinedValues: true } });
  }
  async read<T>(key: string): Promise<Versioned<T> | undefined> {
    const { Item } = await this.client.send(new GetCommand({ TableName: this.table, Key: { pk: key }, ConsistentRead: true }));
    if (!Item || (Item.expiresAt !== undefined && Item.expiresAt <= Date.now())) return undefined;
    return { value: Item.value as T, version: Item.version as string, expiresAt: Item.expiresAt as number | undefined };
  }
  async write<T>(key: string, value: T, expected: string | undefined, expiresAt?: number): Promise<string | undefined> {
    const version = randomUUID();
    try {
      await this.client.send(new PutCommand({ TableName: this.table,
        Item: { pk: key, value, version, expiresAt,
          ...(expiresAt === undefined ? {} : { ttl: Math.ceil(expiresAt / 1000) }) },
        ConditionExpression: expected === undefined ? "attribute_not_exists(pk) OR expiresAt <= :now" :
          "#version = :version AND (attribute_not_exists(expiresAt) OR expiresAt > :now)",
        ExpressionAttributeNames: expected === undefined ? undefined : { "#version": "version" },
        ExpressionAttributeValues: { ":now": Date.now(), ...(expected === undefined ? {} : { ":version": expected }) } }));
      return version;
    } catch (error) {
      if ((error as Error).name === "ConditionalCheckFailedException") return undefined;
      throw error;
    }
  }
  async remove(key: string, expected: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteCommand({ TableName: this.table, Key: { pk: key },
        ConditionExpression: "#version = :version", ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: { ":version": expected } }));
      return true;
    } catch (error) {
      if ((error as Error).name === "ConditionalCheckFailedException") return false;
      throw error;
    }
  }
}
