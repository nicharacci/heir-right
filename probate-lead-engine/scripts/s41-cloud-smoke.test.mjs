import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { spawnSync, spawn } from "node:child_process";

const missingTarget = spawnSync(process.execPath, ["scripts/s41-cloud-smoke.mjs"], { encoding: "utf8", env: { ...process.env, PROCESS_API_URL: "" } });
assert.notEqual(missingTarget.status, 0);
assert.match(missingTarget.stderr, /PROCESS_API_URL is required/);

const pdf = Buffer.from("%PDF-1.7\ncontrolled smoke\n%%EOF\n");
const pdfHash = createHash("sha256").update(pdf).digest("hex");
const received = [];
const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  received.push({ method: request.method, path: url.pathname, authorization: request.headers.authorization || "" });
  const json = (status, body) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(body)); };
  if (url.pathname === "/healthz") return json(200, { ok: true, status: "live" });
  if (url.pathname === "/readyz") return json(200, { ok: true, status: "ready" });
  if (url.pathname === "/v1/doc-prep/cases" && request.method === "POST" && !request.headers.authorization) return json(401, { ok: false, error: "unauthorized" });
  if (url.pathname === "/v1/doc-prep/cases" && request.method === "POST") return json(201, { ok: true, cases: [{ case: { id: "11111111-1111-4111-8111-111111111111", state: "queued" } }] });
  if (url.pathname === "/v1/doc-prep/cases/11111111-1111-4111-8111-111111111111") return json(200, { ok: true, case: { id: "11111111-1111-4111-8111-111111111111", state: "packet_ready", artifact: { contentType: "application/pdf", readbackStatus: "verified", url: `http://127.0.0.1:${server.address().port}/artifact.pdf`, sha256: pdfHash } } });
  if (url.pathname === "/artifact.pdf") { response.writeHead(200, { "content-type": "application/pdf" }); response.end(pdf); return; }
  if (url.pathname === "/v1/doc-prep/exports/google-drive" && request.method === "POST") return json(200, { ok: true, readbackStatus: "verified", exports: [{ id: "drive-file-1" }] });
  return json(404, { ok: false });
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const child = spawn(process.execPath, ["scripts/s41-cloud-smoke.mjs"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PROCESS_API_URL: baseUrl,
    HEIRRIGHT_PROCESS_API_TOKEN: "controlled-test-token",
    S41_CONTROLLED_ESTATE_APPROVED: "approved",
    S41_VERIFY_GOOGLE_DRIVE: "approved",
    S41_SMOKE_ACTOR_EMAIL: "operator@heirright.com",
    S41_SMOKE_ESTATE_JSON: JSON.stringify({ estateId: "controlled-estate", name: "Estate of Test Operator", address: "1 Test Ave, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }),
    S41_SMOKE_POLL_MS: "1",
  },
});
let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => { stdout += String(chunk); });
child.stderr.on("data", (chunk) => { stderr += String(chunk); });
const exitCode = await new Promise((resolve) => child.on("close", resolve));
await new Promise((resolve) => server.close(resolve));

assert.equal(exitCode, 0, stderr);
const result = JSON.parse(stdout);
assert.deepEqual(result.checks, ["health", "readiness", "unauthenticated-intake-denied", "controlled-case-terminal-state", "controlled-pdf-byte-readback", "controlled-drive-readback"]);
assert.deepEqual(received.map((entry) => entry.path), ["/healthz", "/readyz", "/v1/doc-prep/cases", "/v1/doc-prep/cases", "/v1/doc-prep/cases/11111111-1111-4111-8111-111111111111", "/artifact.pdf", "/v1/doc-prep/exports/google-drive"]);
assert.equal(received[2].authorization, "");
assert.equal(received[3].authorization, "Bearer controlled-test-token");

console.log(JSON.stringify({ ok: true, checks: ["cloud-smoke-refuses-without-explicit-target", "approved-smoke-requires-terminal-pdf-and-drive-readback"] }));
