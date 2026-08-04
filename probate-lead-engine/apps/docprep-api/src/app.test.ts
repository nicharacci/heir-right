import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryProcessRepository } from "@ple/docprep-core";
import { createApp } from "./app.js";

const repository = new InMemoryProcessRepository();
const app = createApp({ serviceToken: "test-service-token", repository, now: () => 1 });
const headers = { authorization: "Bearer test-service-token", "x-heirright-actor-email": "operator@heirright.com", "idempotency-key": "api-idempotency-000001", "content-type": "application/json" };
const body = { estates: [{ estateId: "estate-api-1", name: "Estate of Morgan Bell", address: "9 Palm Rd, Miami, FL", county: "Miami-Dade", actor: { email: "operator@heirright.com" } }] };
test("the API authenticates durable intake and returns the same case for a duplicate click", async () => {
  const first = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers, body: JSON.stringify(body) }); assert.equal(first.status, 201); const firstBody = await first.json() as any;
  const repeat = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers, body: JSON.stringify(body) }); assert.equal(repeat.status, 200); const repeatBody = await repeat.json() as any;
  assert.equal(firstBody.cases[0].case.id, repeatBody.cases[0].case.id);
  assert.equal(firstBody.cases[0].case.estate.actor.email, "operator@heirright.com", "the trusted service actor replaces browser payload actor data");
});
test("the API denies unauthenticated process commands", async () => { const response = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); assert.equal(response.status, 401); });
test("the API cancels with the durable revision guard", async () => {
  const processCase = await repository.findByEstate("estate-api-1");
  assert.ok(processCase);
  const cancelled = await app.request(`http://api/v1/doc-prep/cases/${processCase.id}/actions/cancel`, { method: "POST", headers, body: JSON.stringify({ revision: processCase.revision }) });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json() as any).case.state, "cancelled");
});
test("readiness checks the repository connection instead of treating a missing case as healthy", async () => {
  assert.equal((await app.request("http://api/readyz")).status, 200);
  class OfflineRepository extends InMemoryProcessRepository { override async ready() { throw new Error("database unavailable"); } }
  const offlineApp = createApp({ serviceToken: "test-service-token", repository: new OfflineRepository() });
  assert.equal((await offlineApp.request("http://api/readyz")).status, 503);
});
