import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryProcessRepository } from "@ple/docprep-core";
import { createApp } from "./app.js";

const app = createApp({ serviceToken: "test-service-token", repository: new InMemoryProcessRepository(), now: () => 1 });
const headers = { authorization: "Bearer test-service-token", "x-heirright-actor-email": "operator@heirright.com", "idempotency-key": "api-idempotency-000001", "content-type": "application/json" };
const body = { estates: [{ estateId: "estate-api-1", name: "Estate of Morgan Bell", address: "9 Palm Rd, Miami, FL", county: "Miami-Dade", actor: { email: "operator@heirright.com" } }] };
test("the API authenticates durable intake and returns the same case for a duplicate click", async () => {
  const first = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers, body: JSON.stringify(body) }); assert.equal(first.status, 201); const firstBody = await first.json() as any;
  const repeat = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers, body: JSON.stringify(body) }); assert.equal(repeat.status, 200); const repeatBody = await repeat.json() as any;
  assert.equal(firstBody.cases[0].case.id, repeatBody.cases[0].case.id);
});
test("the API denies unauthenticated process commands", async () => { const response = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); assert.equal(response.status, 401); });
