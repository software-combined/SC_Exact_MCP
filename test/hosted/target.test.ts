import { expect, it } from "vitest";
import { targetProblem } from "../../src/hosted/transport/http.js";

const expected = new URL("https://exact-mcp.example.com");
const check = (headers: Record<string, string>, path = "/mcp") => targetProblem(headers, new URL(path, expected), expected);

it("accepts this host over HTTPS, including the default port and a proxy protocol list, and labels every refusal", () => {
  expect(check({ host: "exact-mcp.example.com", "x-forwarded-proto": "https" })).toBeUndefined();
  expect(check({ host: "exact-mcp.example.com:443", "x-forwarded-proto": "https" })).toBeUndefined();
  expect(check({ host: "EXACT-MCP.example.com", "x-forwarded-proto": "https, http" })).toBeUndefined();
  expect(check({ host: "other.example.com", "x-forwarded-proto": "https" })).toBe("host:other.example.com");
  expect(check({ host: "exact-mcp.example.com:8443", "x-forwarded-proto": "https" })).toBe("host:exact-mcp.example.com:8443");
  expect(check({ "x-forwarded-proto": "https" })).toBe("host:missing");
  expect(check({ host: "exact-mcp.example.com", "x-forwarded-proto": "http" })).toBe("proto:http");
  expect(check({ host: "exact-mcp.example.com" })).toBe("proto:missing");
  expect(check({ host: "exact-mcp.example.com", "x-forwarded-proto": "https" }, "https://evil.example/mcp")).toBe("target:https:??evil.example");
  expect(check({ host: "<script>.example", "x-forwarded-proto": "https" })).toBe("host:?script?.example");
  const custom = new URL("https://exact-mcp.example.com:8443");
  expect(targetProblem({ host: "exact-mcp.example.com:8443:443", "x-forwarded-proto": "https" }, new URL("/mcp", custom), custom))
    .toBe("host:exact-mcp.example.com:8443:443");
});
