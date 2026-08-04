import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const handler = require("../api/discovery/idi-asset-search/import.js");
const { handleRequest } = require("../server.js");
const legacySource = readFileSync(new URL("../src/legacy/app.js", import.meta.url), "utf8");

function callHandler(request) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
      writeHead(status, headers = {}) {
        this.statusCode = status;
        Object.entries(headers).forEach(([name, value]) => this.setHeader(name, value));
      },
      end(body = "") {
        resolve({ status: this.statusCode, headers: this.headers, body: String(body || "") });
      },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

const originalFetch = globalThis.fetch;
const originalAuthRequired = process.env.AUTH_REQUIRED;
const originalWorkerUrl = process.env.HEIRRIGHT_WORKER_URL;
const originalToken = process.env.HEIRRIGHT_API_TOKEN;
try {
  process.env.AUTH_REQUIRED = "false";
  process.env.HEIRRIGHT_WORKER_URL = "https://worker.reload.test";
  process.env.HEIRRIGHT_API_TOKEN = "reload-internal-token";
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ url: String(input), method: init.method, authorization: init.headers?.authorization });
    return new Response(JSON.stringify({
      ok: true,
      mode: "uploaded_file",
      provider: "idi",
      lockKey: "idi:estate-reload",
      importedAt: "2026-07-14T18:00:00.000Z",
      importedBy: "approved@heirright.com",
      duplicateGuard: "first_import_only",
      adminOverrideReason: null,
      attachment: { id: "supporting-1234567890123-abcdef1234567890", fileName: "IDI Report.pdf", readbackStatus: "verified" },
      extraction: { status: "extracted", method: "pdf_text", fileKind: "pdf", characterCount: 88, sourceLocators: [{ kind: "page", index: 1, label: "PDF page 1" }] },
      candidates: [{ id: "candidate-1", name: "Jordan Reload", reviewStatus: "auto_accepted_high_confidence" }],
      contactPreviewCount: 1,
      paidRun: false,
      readbackStatus: "verified",
    }), { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  };

  const result = await callHandler({
    method: "GET",
    url: "/api/discovery/idi-asset-search/import?assetKey=estate%3Areload",
    headers: { host: "localhost:4173" },
  });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).candidates[0].name, "Jordan Reload");
  assert.deepEqual(calls, [{
    url: "https://worker.reload.test/api/discovery/idi-asset-search/import?assetKey=estate%3Areload",
    method: "GET",
    authorization: "Bearer reload-internal-token",
  }]);

  const localServerResult = await new Promise((resolve, reject) => {
    const request = {
      method: "GET",
      url: "/api/discovery/idi-asset-search/import?assetKey=estate%3Areload",
      headers: { host: "localhost:4173" },
    };
    const response = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers = {}) {
        this.statusCode = status;
        Object.assign(this.headers, headers);
      },
      end(body = "") { resolve({ status: this.statusCode, body: String(body || "") }); },
    };
    try { handleRequest(request, response); } catch (error) { reject(error); }
  });
  assert.equal(localServerResult.status, 200);
  assert.equal(JSON.parse(localServerResult.body).candidates[0].name, "Jordan Reload");
  assert.deepEqual(calls[1], {
    url: "https://worker.reload.test/api/discovery/idi-asset-search/import?assetKey=estate%3Areload",
    method: "GET",
    authorization: "Bearer reload-internal-token",
  });

  const missingKey = await callHandler({ method: "GET", url: "/api/discovery/idi-asset-search/import", headers: {} });
  assert.equal(missingKey.status, 400);
  assert.equal(JSON.parse(missingKey.body).error, "asset_key_required");
} finally {
  globalThis.fetch = originalFetch;
  if (originalAuthRequired === undefined) delete process.env.AUTH_REQUIRED;
  else process.env.AUTH_REQUIRED = originalAuthRequired;
  if (originalWorkerUrl === undefined) delete process.env.HEIRRIGHT_WORKER_URL;
  else process.env.HEIRRIGHT_WORKER_URL = originalWorkerUrl;
  if (originalToken === undefined) delete process.env.HEIRRIGHT_API_TOKEN;
  else process.env.HEIRRIGHT_API_TOKEN = originalToken;
}

assert.match(legacySource, /async function hydrateCanonicalIdiImport[\s\S]*\/api\/discovery\/idi-asset-search\/import\?assetKey=/);
assert.match(legacySource, /record\?\.readbackStatus !== "verified"/);
assert.match(legacySource, /state\.idiImports\[key\] = \{[\s\S]*candidates: Array\.isArray\(record\.candidates\)/);
assert.match(legacySource, /await Promise\.all\(\[hydrateCanonicalIdiImport\(row\), hydrateSupportingDocuments\(row\)\]\)/);
assert.doesNotMatch(legacySource.match(/async function hydrateCanonicalIdiImport[\s\S]*?\n\}/)?.[0] || "", /storageSetItem|persistServerState|localStorage|sessionStorage/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "authenticated_get_proxies_canonical_idi_import",
    "local_server_get_forwards_asset_key_to_canonical_worker",
    "missing_asset_key_fails_closed",
    "selected_estate_hydrates_idi_in_memory",
    "idi_reload_never_writes_browser_storage",
  ],
}, null, 2));
