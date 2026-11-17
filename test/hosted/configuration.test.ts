import { expect, it } from "vitest";
import { environment, configuration } from "../../src/hosted/runtime/config.js";
import { harness } from "./helpers.js";

it("requires explicit quotas and pins production, a valid region, and the dedicated app", async () => {
  const values = { SCG_ENVIRONMENT: "production", AWS_REGION: "eu-west-1", SCG_ORIGIN: "https://fixture.invalid",
    SCG_STATE_TABLE: "fixture-table", SCG_KMS_KEY_ARN: "fictional-key-reference-long", SCG_CONFIG_SECRET_ARN: "fictional-secret-reference",
    SCG_EXACT_APP_ID: "dedicated-fixture-app", SCG_APP_CALLS_PER_MINUTE: "10", SCG_DIVISION_CALLS_PER_MINUTE: "5",
    SCG_APP_CALLS_PER_DAY: "20", SCG_DIVISION_CALLS_PER_DAY: "10" };
  expect(() => environment({ ...values, SCG_APP_CALLS_PER_MINUTE: undefined })).toThrow();
  expect(() => environment({ ...values, SCG_APP_CALLS_PER_MINUTE: "0" })).toThrow();
  expect(() => environment({ ...values, SCG_APP_CALLS_PER_MINUTE: "7" })).toThrow();
  expect(() => environment({ ...values, SCG_APP_CALLS_PER_DAY: "7" })).toThrow();
  expect(() => environment({ ...values, SCG_ENVIRONMENT: "staging" })).toThrow();
  expect(environment({ ...values, AWS_REGION: "eu-central-1" }).AWS_REGION).toBe("eu-central-1");
  expect(environment({ ...values, AWS_REGION: "ap-southeast-2" }).AWS_REGION).toBe("ap-southeast-2");
  expect(() => environment({ ...values, AWS_REGION: "Frankfurt" })).toThrow();
  const h = await harness();
  try {
    const secret = { exact: { appId: "wrong-app", appSecret: "fixture", region: "nl" },
      clients: h.config.clients.map((client, i) => ({ ...client, client_name: ["Claude", "ChatGPT", "Microsoft 365 Copilot"][i],
        redirect_uris: ["https://fixture.invalid/callback"] })), jwks: h.config.jwks, cookieKeys: h.config.cookieKeys };
    expect(() => configuration(environment(values), secret)).toThrow(/dedicated Exact application/);
    const accepted = configuration(environment(values), { ...secret, exact: { ...secret.exact, appId: values.SCG_EXACT_APP_ID } });
    expect(accepted.source.callback).toBe("https://fixture.invalid/exact/callback");
    expect(accepted.broker.clients.map((client) => client.scope)).toEqual(["openid exact.read", "openid exact.read", "openid exact.read"]);
    expect(accepted.limits).toEqual({ appCallsPerMinute: 10, divisionCallsPerMinute: 5, appCallsPerDay: 20, divisionCallsPerDay: 10 });
  } finally { await h.close(); }
});
