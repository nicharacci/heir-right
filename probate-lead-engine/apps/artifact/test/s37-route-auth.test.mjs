import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const adminAccess = require("../api/admin/access.js");
const connectionStatus = require("../api/connections/status.js");
const exportsHandler = require("../api/exports.js");
const reportPdf = require("../api/reports/pdf.js");
const sourceRun = require("../api/discovery/external-source-run.js");
const discoveryFile = require("../api/discovery/file.js");
const taxReceiptRun = require("../api/discovery/tax-collector/receipt-run.js");
const podioDiagnostics = require("../api/podio/diagnostics.js");
const podioOAuthStart = require("../api/podio/oauth/start.js");
const productionPodioDiagnostics = require("../../../api/podio/diagnostics.js");
const productionDiscoveryFile = require("../../../api/discovery/file.js");
const { createSessionToken } = require("../api/auth/_shared.js");

function call(handler, { method = "GET", body, headers = {}, url = "/" } = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      method,
      body,
      url,
      headers: { host: "surface.heirright.com", "x-forwarded-proto": "https", ...headers },
      on() {},
      destroy() {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
      writeHead(status, values = {}) { this.statusCode = status; for (const [key, value] of Object.entries(values)) this.setHeader(key, value); },
      end(payload = "") { resolve({ statusCode: this.statusCode, headers: this.headers, text: String(payload || "") }); },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

process.env.AUTH_REQUIRED = "true";
process.env.AUTH_ALLOWED_DOMAINS = "heirright.com";
process.env.AUTH_SESSION_SECRET = "s37-session-secret";
process.env.HEIRRIGHT_API_TOKEN = "s37-internal-route-token";

for (const [name, handler, request] of [
  ["admin access", adminAccess, { method: "GET", url: "/api/admin/access" }],
  ["connection status", connectionStatus, { method: "GET", url: "/api/connections/status" }],
  ["exports", exportsHandler, { method: "POST", body: {}, url: "/api/exports" }],
  ["report PDF", reportPdf, { method: "GET", url: "/api/reports/pdf" }],
  ["source run", sourceRun, { method: "POST", body: {}, url: "/api/discovery/external-source-run" }],
  ["Discovery File", discoveryFile, { method: "GET", url: "/api/discovery/file?estateId=estate-test" }],
  ["tax receipt", taxReceiptRun, { method: "POST", body: {}, url: "/api/discovery/tax-collector/receipt-run" }],
  ["Podio diagnostics", podioDiagnostics, { method: "GET", url: "/api/podio/diagnostics" }],
  ["Podio OAuth start", podioOAuthStart, { method: "GET", url: "/api/podio/oauth/start" }],
  ["production Podio diagnostics wrapper", productionPodioDiagnostics, { method: "GET", url: "/api/podio/diagnostics" }],
  ["production Discovery File wrapper", productionDiscoveryFile, { method: "GET", url: "/api/discovery/file?estateId=estate-test" }],
]) {
  const blocked = await call(handler, request);
  assert.equal(blocked.statusCode, 401, `${name} must reject anonymous requests before work begins`);
  assert.equal(JSON.parse(blocked.text).error, "auth_required");
}

const tokenResponse = await call(connectionStatus, {
  method: "GET",
  url: "/api/connections/status",
  headers: { authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` },
});
assert.equal(tokenResponse.statusCode, 200, "internal bearer must preserve server-to-server access");

const sessionToken = createSessionToken({ email: "operator@heirright.com", name: "Operator" });
const sessionResponse = await call(adminAccess, {
  method: "GET",
  url: "/api/admin/access",
  headers: { cookie: `hr_session=${encodeURIComponent(sessionToken)}` },
});
assert.equal(sessionResponse.statusCode, 200, "approved signed session must access protected APIs");

const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
assert.match(html, /<body[^>]*data-auth-gated="true"/, "workspace must begin auth-gated before session hydration");
assert.match(html, /id="authGate"[\s\S]*Checking HeirRight access/, "initial auth gate must contain visible access-check state");

const protectedHandlers = [
  "api/admin/access.js",
  "api/connections/status.js",
  "api/discovery/external-source-run.js",
  "api/discovery/file.js",
  "api/discovery/source-capture.js",
  "api/discovery/tax-collector/receipt-run.js",
  "api/exports.js",
  "api/leads/fresh-batch.js",
  "api/outreach/activepieces.js",
  "api/podio/diagnostics.js",
  "api/podio/oauth/start.js",
  "api/podio/oauth/callback.js",
  "api/reports/pdf.js",
  "api/support/linear.js",
];
for (const path of protectedHandlers) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(source, /requireApiAuth\(request, response\)/, `${path} must use the shared route guard`);
}

console.log(JSON.stringify({ ok: true, checks: [
  "anonymous_operational_routes_rejected",
  "internal_bearer_preserved",
  "approved_session_preserved",
  "initial_workspace_auth_gated",
  "protected_handler_inventory",
] }, null, 2));
