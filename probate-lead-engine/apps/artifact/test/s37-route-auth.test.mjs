import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { readArtifactSource } from "./helpers/artifact-source.mjs";

const require = createRequire(import.meta.url);
const adminAccess = require("../api/admin/access.js");
const connectionStatus = require("../api/connections/status.js");
const exportsHandler = require("../api/exports.js");
const reportPdf = require("../api/reports/pdf.js");
const documentAttachments = require("../api/documents/attachments.js");
const workspaceState = require("../api/workspace/state.js");
const sourceRun = require("../api/discovery/external-source-run.js");
const discoveryFile = require("../api/discovery/file.js");
const taxReceiptRun = require("../api/discovery/tax-collector/receipt-run.js");
const podioDiagnostics = require("../api/podio/diagnostics.js");
const podioOAuthStart = require("../api/podio/oauth/start.js");
const productionPodioDiagnostics = require("../../../api/podio/diagnostics.js");
const productionDiscoveryFile = require("../../../api/discovery/file.js");
const productionDocumentAttachments = require("../../../api/documents/attachments.js");
const productionWorkspaceState = require("../../../api/workspace/state.js");
const productionAuth = require("../../../api/auth/[...path].js");
const productionIdiExtract = require("../../../api/discovery/idi-asset-search/extract.js");
const { createSessionToken, loginPage, sessionBody } = require("../api/auth/_shared.js");
const { secretMatches } = require("../api/security/secret-compare.js");

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
process.env.AUTH_ALLOWED_EMAILS = "operator@heirright.com";
process.env.AUTH_SESSION_SECRET = "s37-session-secret";
process.env.HEIRRIGHT_API_TOKEN = "s37-internal-route-token";
process.env.HEIRRIGHT_ADMIN_EMAILS = "admin@outside.example";

const anonymousSession = sessionBody({ headers: { host: "surface.heirright.com", "x-forwarded-proto": "https" } });
assert.deepEqual(anonymousSession.auth.allowedEmails, [], "anonymous session metadata must not disclose exact approved or administrator emails");
assert.doesNotMatch(JSON.stringify(anonymousSession), /operator@heirright\.com|admin@outside\.example/);
const anonymousLogin = loginPage({ headers: { host: "surface.heirright.com", "x-forwarded-proto": "https" } });
assert.doesNotMatch(anonymousLogin, /operator@heirright\.com|admin@outside\.example/, "the anonymous login page must not disclose exact privileged addresses");
const anonymousProductionSession = await call(productionAuth, {
  method: "GET",
  url: "/api/auth/session",
});
assert.equal(anonymousProductionSession.statusCode, 200);
assert.deepEqual(JSON.parse(anonymousProductionSession.text).auth.allowedEmails, [], "the production auth router must preserve a private anonymous session shape");
assert.doesNotMatch(anonymousProductionSession.text, /operator@heirright\.com|admin@outside\.example/);
assert.equal(secretMatches("same-secret", "same-secret"), true);
assert.equal(secretMatches("same-secret", "same-secreu"), false);
assert.equal(secretMatches("same-secret", "same-secret-extra"), false);
assert.equal(secretMatches("", ""), false);

for (const [name, handler, request] of [
  ["admin access", adminAccess, { method: "GET", url: "/api/admin/access" }],
  ["connection status", connectionStatus, { method: "GET", url: "/api/connections/status" }],
  ["exports", exportsHandler, { method: "POST", body: {}, url: "/api/exports" }],
  ["report PDF", reportPdf, { method: "GET", url: "/api/reports/pdf" }],
  ["supporting documents", documentAttachments, { method: "GET", url: "/api/documents/attachments?estateId=estate-test" }],
  ["workspace state", workspaceState, { method: "GET", url: "/api/workspace/state?key=heirright%3Acrm-imported-estates" }],
  ["source run", sourceRun, { method: "POST", body: {}, url: "/api/discovery/external-source-run" }],
  ["Discovery File", discoveryFile, { method: "GET", url: "/api/discovery/file?estateId=estate-test" }],
  ["tax receipt", taxReceiptRun, { method: "POST", body: {}, url: "/api/discovery/tax-collector/receipt-run" }],
  ["Podio diagnostics", podioDiagnostics, { method: "GET", url: "/api/podio/diagnostics" }],
  ["Podio OAuth start", podioOAuthStart, { method: "GET", url: "/api/podio/oauth/start" }],
  ["production Podio diagnostics wrapper", productionPodioDiagnostics, { method: "GET", url: "/api/podio/diagnostics" }],
  ["production Discovery File wrapper", productionDiscoveryFile, { method: "GET", url: "/api/discovery/file?estateId=estate-test" }],
  ["production supporting documents wrapper", productionDocumentAttachments, { method: "GET", url: "/api/documents/attachments?estateId=estate-test" }],
  ["production workspace state wrapper", productionWorkspaceState, { method: "GET", url: "/api/workspace/state?key=heirright%3Acrm-imported-estates" }],
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

for (const nearMiss of [
  `${process.env.HEIRRIGHT_API_TOKEN.slice(0, -1)}x`,
  process.env.HEIRRIGHT_API_TOKEN.slice(1),
  `${process.env.HEIRRIGHT_API_TOKEN}x`,
]) {
  const rejectedBearer = await call(connectionStatus, {
    method: "GET",
    url: "/api/connections/status",
    headers: { authorization: `Bearer ${nearMiss}` },
  });
  assert.equal(rejectedBearer.statusCode, 401, "same-length, truncated, and extended bearer near-misses must fail closed");
}

const productionTokenResponse = await call(productionDiscoveryFile, {
  method: "GET",
  url: "/api/discovery/file?estateId=estate-test",
  headers: { authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` },
});
assert.equal(productionTokenResponse.statusCode, 503, "production wrappers must preserve internal bearer access while failing closed without canonical Worker storage");
assert.equal(JSON.parse(productionTokenResponse.text).error, "discovery_file_store_unavailable");

const sessionToken = createSessionToken({ email: "operator@heirright.com", name: "Operator" });
const [sessionPayload, sessionSignature] = sessionToken.split(".");
const tamperedSignature = `${sessionSignature.startsWith("a") ? "b" : "a"}${sessionSignature.slice(1)}`;
assert.equal(sessionBody({ headers: { cookie: `hr_session=${encodeURIComponent(`${sessionPayload}.${tamperedSignature}`)}` } }).authenticated, false, "a same-length tampered session signature must fail closed");
assert.equal(sessionBody({ headers: { cookie: `hr_session=${encodeURIComponent(`${sessionPayload}.${sessionSignature.slice(1)}`)}` } }).authenticated, false, "a different-length tampered session signature must fail closed");
assert.equal(sessionBody({ headers: { cookie: `hr_session=${encodeURIComponent(`${sessionPayload}.${sessionSignature}x`)}` } }).authenticated, false, "an extended session signature must fail closed");
const sessionResponse = await call(adminAccess, {
  method: "GET",
  url: "/api/admin/access",
  headers: { cookie: `hr_session=${encodeURIComponent(sessionToken)}` },
});
assert.equal(sessionResponse.statusCode, 200, "approved signed session must access protected APIs");
assert.deepEqual(JSON.parse(sessionResponse.text).allowedEmails, [], "an ordinary operator must not receive exact approved or administrator emails from the access bootstrap");
assert.doesNotMatch(sessionResponse.text, /operator@heirright\.com|admin@outside\.example/, "the ordinary access bootstrap must not serialize privileged exact emails");

const ordinaryOperatorMutation = await call(adminAccess, {
  method: "POST",
  body: {},
  url: "/api/admin/access",
  headers: { cookie: `hr_session=${encodeURIComponent(sessionToken)}` },
});
assert.equal(ordinaryOperatorMutation.statusCode, 403, "an approved ordinary operator must not mutate the access allowlist");
assert.equal(JSON.parse(ordinaryOperatorMutation.text).error, "admin_required");

const adminSessionToken = createSessionToken({ email: "admin@outside.example", name: "HeirRight Admin" });
const adminBrowserSession = await call(productionAuth, {
  method: "GET",
  url: "/api/auth/session",
  headers: { cookie: `hr_session=${encodeURIComponent(adminSessionToken)}` },
});
assert.equal(adminBrowserSession.statusCode, 200);
assert.equal(JSON.parse(adminBrowserSession.text).canAdminister, true, "the production auth router must expose exact Google admin capability to replacement controls");
assert.equal(JSON.parse(adminBrowserSession.text).user.mode, "google");
assert.ok(JSON.parse(adminBrowserSession.text).auth.allowedEmails.includes("admin@outside.example"), "the administrator session response may retain the exact-email access list needed by access management");
const adminAccessResponse = await call(adminAccess, {
  method: "GET",
  url: "/api/admin/access",
  headers: { cookie: `hr_session=${encodeURIComponent(adminSessionToken)}` },
});
assert.equal(adminAccessResponse.statusCode, 200);
assert.ok(JSON.parse(adminAccessResponse.text).allowedEmails.includes("admin@outside.example"), "an exact Google administrator must retain the full access list needed by Admin");
assert.ok(JSON.parse(adminAccessResponse.text).allowedEmails.includes("operator@heirright.com"));
const ordinaryBrowserSession = await call(productionAuth, {
  method: "GET",
  url: "/api/auth/session",
  headers: { cookie: `hr_session=${encodeURIComponent(sessionToken)}` },
});
assert.equal(JSON.parse(ordinaryBrowserSession.text).canAdminister, false);
assert.deepEqual(JSON.parse(ordinaryBrowserSession.text).auth.allowedEmails, [], "an ordinary authenticated operator must not receive privileged exact emails");
const adminMutation = await call(adminAccess, {
  method: "POST",
  body: {},
  url: "/api/admin/access",
  headers: { cookie: `hr_session=${encodeURIComponent(adminSessionToken)}` },
});
assert.equal(adminMutation.statusCode, 400, "an exact configured Google admin must pass the mutation gate and reach validation");
assert.equal(JSON.parse(adminMutation.text).error, "invalid_access_value");

const adminReplacementGate = await call(productionIdiExtract, {
  method: "POST",
  url: "/api/discovery/idi-asset-search/extract",
  body: {
    assetKey: "estate:admin-replacement-gate",
    adminOverrideReason: "replace",
    attachment: { id: "supporting-1700000000000-abcdef1234567890", artifactId: "supporting-1700000000000-abcdef1234567890" },
  },
  headers: { cookie: `hr_session=${encodeURIComponent(adminSessionToken)}` },
});
assert.equal(adminReplacementGate.statusCode, 422, "an exact Google admin must clear the production replacement gate and reach reason validation");
assert.equal(JSON.parse(adminReplacementGate.text).error, "idi_replacement_reason_required");

const internalMutation = await call(adminAccess, {
  method: "POST",
  body: {},
  url: "/api/admin/access",
  headers: { authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` },
});
assert.equal(internalMutation.statusCode, 400, "the private server bearer must preserve admin automation access");
const internalAccessResponse = await call(adminAccess, {
  method: "GET",
  url: "/api/admin/access",
  headers: { authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` },
});
assert.ok(JSON.parse(internalAccessResponse.text).allowedEmails.includes("admin@outside.example"), "the private server bearer must retain full access-management readback");

const savedTrustedIpConfig = {
  VERCEL: process.env.VERCEL,
  AUTH_TRUSTED_IPS: process.env.AUTH_TRUSTED_IPS,
  AUTH_TRUSTED_IP_BYPASS_ENABLED: process.env.AUTH_TRUSTED_IP_BYPASS_ENABLED,
  AUTH_TRUSTED_IP_BYPASS_UNTIL: process.env.AUTH_TRUSTED_IP_BYPASS_UNTIL,
};
process.env.VERCEL = "1";
process.env.AUTH_TRUSTED_IPS = "203.0.113.24";
process.env.AUTH_TRUSTED_IP_BYPASS_ENABLED = "true";
process.env.AUTH_TRUSTED_IP_BYPASS_UNTIL = "2099-01-01T00:00:00.000Z";

const trustedIpResponse = await call(adminAccess, {
  method: "GET",
  url: "/api/admin/access",
  headers: { "x-forwarded-for": "203.0.113.25", "x-vercel-forwarded-for": "203.0.113.24, 10.0.0.1" },
});
assert.equal(trustedIpResponse.statusCode, 200, "an exact trusted Vercel client IP must access protected APIs, even when a proxy changes the generic forwarding header");
assert.deepEqual(JSON.parse(trustedIpResponse.text).allowedEmails, [], "temporary exact-IP access must not disclose privileged exact emails");
assert.doesNotMatch(trustedIpResponse.text, /operator@heirright\.com|admin@outside\.example/);
assert.equal(sessionBody({ headers: { "x-forwarded-for": "203.0.113.25", "x-vercel-forwarded-for": "203.0.113.24" } }).user.mode, "trusted_ip");
const trustedIpMutation = await call(adminAccess, {
  method: "POST",
  body: {},
  url: "/api/admin/access",
  headers: { "x-vercel-forwarded-for": "203.0.113.24" },
});
assert.equal(trustedIpMutation.statusCode, 403, "the temporary trusted-IP session must never inherit administrator mutation rights");
assert.equal(JSON.parse(trustedIpMutation.text).error, "admin_required");
const trustedIpBrowserGate = await call(productionAuth, {
  method: "GET",
  url: "/api/auth/session",
  headers: { "x-vercel-forwarded-for": "203.0.113.24" },
});
assert.equal(trustedIpBrowserGate.statusCode, 200, "the Vercel auth router must unlock the browser gate for the exact trusted IP");
assert.equal(JSON.parse(trustedIpBrowserGate.text).user.mode, "trusted_ip");
assert.equal(JSON.parse(trustedIpBrowserGate.text).canAdminister, false, "temporary exact-IP access must never unlock admin replacement controls");
const trustedIpReplacement = await call(productionIdiExtract, {
  method: "POST",
  url: "/api/discovery/idi-asset-search/extract",
  body: {
    assetKey: "estate:trusted-ip-replacement",
    adminOverrideReason: "Verified corrected report supplied by IDI Core",
    attachment: { id: "supporting-1700000000000-fedcba0987654321", artifactId: "supporting-1700000000000-fedcba0987654321" },
  },
  headers: { "x-vercel-forwarded-for": "203.0.113.24" },
});
assert.equal(trustedIpReplacement.statusCode, 403);
assert.equal(JSON.parse(trustedIpReplacement.text).error, "admin_required");
assert.equal(sessionBody({ headers: { "x-forwarded-for": "203.0.113.24" } }).authenticated, true, "the standard Vercel forwarding header remains a direct-host fallback");
assert.equal(sessionBody({ headers: { "x-forwarded-for": "203.0.113.25" } }).authenticated, false, "nearby addresses must not bypass auth");
process.env.VERCEL = "0";
assert.equal(sessionBody({ headers: { "x-forwarded-for": "203.0.113.24" } }).authenticated, false, "the bypass must reject spoofable headers outside Vercel");
for (const [key, value] of Object.entries(savedTrustedIpConfig)) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

const html = readArtifactSource();
assert.match(html, /<body[^>]*data-auth-gated="true"/, "workspace must begin auth-gated before session hydration");
assert.match(html, /id="authGate"[\s\S]*Checking HeirRight access/, "initial auth gate must contain visible access-check state");

const protectedHandlers = [
  "api/admin/access.js",
  "api/connections/status.js",
  "api/discovery/external-source-run.js",
  "api/discovery/file.js",
  "api/discovery/source-capture.js",
  "api/discovery/tax-collector/receipt-run.js",
  "api/documents/attachments.js",
  "api/workspace/state.js",
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
assert.match(readFileSync(new URL("../api/admin/access.js", import.meta.url), "utf8"), /requireApiAdmin\(request, response\)/, "admin access mutations must use the exact-email admin guard");
const secretCompareSource = readFileSync(new URL("../api/security/secret-compare.js", import.meta.url), "utf8");
const authSharedSource = readFileSync(new URL("../api/auth/_shared.js", import.meta.url), "utf8");
const sharedApiSource = readFileSync(new URL("../api/_shared.js", import.meta.url), "utf8");
const authCallbackSource = readFileSync(new URL("../api/auth/callback.js", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../../worker/src/cloudflare.ts", import.meta.url), "utf8");
assert.match(secretCompareSource, /createHash\("sha256"\)[\s\S]*timingSafeEqual\(digest\(actualValue\), digest\(expectedValue\)\)/, "Vercel secrets must compare fixed-size digests through timingSafeEqual");
assert.match(authSharedSource, /secretMatches\(signature, sign\(encoded\)\)/, "the Vercel session signature must use the shared timing-safe comparator");
assert.match(sharedApiSource, /secretMatches\(supplied, expected\)/, "the Vercel internal bearer must use the shared timing-safe comparator");
assert.match(authCallbackSource, /secretMatches\(state, expectedState\)/, "the Vercel OAuth state must use the shared timing-safe comparator");
assert.match(serverSource, /secretMatches\(signature, sign\(payload\)\)/, "the production auth router must use the shared timing-safe comparator");
assert.match(serverSource, /secretMatches\(state, expectedState\)/, "the local production router OAuth state must use the shared timing-safe comparator");
assert.match(workerSource, /createHash\("sha256"\)[\s\S]*timingSafeEqual\(actualDigest, expectedDigest\)/, "Worker bearer and HMAC checks must compare fixed-size digests through timingSafeEqual");
assert.doesNotMatch(workerSource, /bearer\s*===\s*env\.HEIRRIGHT_API_TOKEN|expected\s*!==\s*signature|cookieSignature\s*!==\s*expectedSignature/, "Worker secrets must not regress to short-circuit string equality");
assert.doesNotMatch(`${authSharedSource}\n${sharedApiSource}\n${authCallbackSource}\n${serverSource}`, /sign\([^)]*\)\s*!==|bearer\s*===|state\s*!==\s*expectedState/, "Node and Vercel secrets must not regress to short-circuit string equality");

console.log(JSON.stringify({ ok: true, checks: [
  "anonymous_operational_routes_rejected",
  "internal_bearer_preserved",
  "production_wrapper_bearer_preserved",
  "approved_session_preserved",
  "ordinary_operator_admin_mutation_rejected",
  "exact_google_admin_mutation_allowed",
  "internal_bearer_admin_mutation_allowed",
  "temporary_exact_trusted_ip_bypass",
  "temporary_trusted_ip_admin_mutation_rejected",
  "temporary_exact_trusted_ip_browser_gate",
  "initial_workspace_auth_gated",
  "protected_handler_inventory",
] }, null, 2));
