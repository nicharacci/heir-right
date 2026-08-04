import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { handleRequest } = require("../server.js");
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
let upstreamRequest = null;
const upstream = createServer((request, response) => {
  let body = ""; request.on("data", (chunk) => { body += chunk; }); request.on("end", () => {
    upstreamRequest = { url: request.url, method: request.method, headers: request.headers, body: JSON.parse(body) };
    response.writeHead(201, { "content-type": "application/json" }); response.end(JSON.stringify({ ok: true, cases: [{ created: true, case: { id: "case-s41", estate: { estateId: "estate-s41" } } }] }));
  });
});
const upstreamPort = await listen(upstream);
process.env.AUTH_REQUIRED = "false";
process.env.HEIRRIGHT_PROCESS_API_URL = `http://127.0.0.1:${upstreamPort}`;
process.env.HEIRRIGHT_PROCESS_API_TOKEN = "test-process-token";
const artifact = createServer(handleRequest);
const artifactPort = await listen(artifact);
try {
  const response = await fetch(`http://127.0.0.1:${artifactPort}/api/doc-prep/cases`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "artifact-idempotency-0001" }, body: JSON.stringify({ estates: [{ estateId: "estate-s41", name: "Estate of S41", address: "1 Test St", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "forged@outside.example" } }] }) });
  assert.equal(response.status, 201);
  assert.equal(upstreamRequest.url, "/v1/doc-prep/cases");
  assert.equal(upstreamRequest.headers.authorization, "Bearer test-process-token");
  assert.equal(upstreamRequest.headers["x-heirright-actor-email"], "local-dev@heirright.com");
  assert.equal(upstreamRequest.headers["idempotency-key"], "artifact-idempotency-0001");
  assert.equal(upstreamRequest.body.estates[0].actor.email, "local-dev@heirright.com", "the artifact server replaces browser-supplied actor data with its authenticated session");
} finally { await close(artifact); await close(upstream); }
console.log(JSON.stringify({ ok: true, checks: ["artifact_process_proxy_hides_service_token", "artifact_process_proxy_sets_trusted_actor", "artifact_process_proxy_preserves_idempotency"] }));
