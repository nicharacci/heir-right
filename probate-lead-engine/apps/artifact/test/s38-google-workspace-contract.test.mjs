import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const login = require("../api/auth/login.js");
const callback = require("../api/auth/callback.js");
const workspaceStatus = require("../api/google-workspace/status.js");
const workspaceDestinations = require("../api/google-workspace/destinations.js");
const workspaceExport = require("../api/google-workspace/export.js");
const packetApproval = require("../api/doc-prep/packet-approval.js");
const legacyExports = require("../api/exports.js");
const rootAuth = require("../../../api/auth/[...path].js");
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

function fakeFetchResponse(payload, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

process.env.AUTH_REQUIRED = "true";
process.env.AUTH_ALLOWED_DOMAINS = "heirright.com";
process.env.AUTH_SESSION_SECRET = "s38-google-session-secret";
process.env.GOOGLE_OAUTH_CLIENT_ID = "s38-google-client";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "s38-google-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "https://surface.heirright.com/auth/callback";
process.env.HEIRRIGHT_WORKER_URL = "https://worker.example.test";
process.env.HEIRRIGHT_API_TOKEN = "s38-worker-token";

const loginResponse = await call(login, { url: "/auth/login?integration=google-workspace" });
assert.equal(loginResponse.statusCode, 302, "Workspace connect must begin at Google OAuth");
const loginUrl = new URL(loginResponse.headers.location);
assert.equal(loginUrl.searchParams.get("access_type"), "offline", "Workspace OAuth must request a refreshable session");
assert.equal(loginUrl.searchParams.get("prompt"), "select_account consent", "Workspace OAuth must force account selection while requesting consent for the expanded scope");
assert.match(loginUrl.searchParams.get("scope") || "", /drive\.file/, "Workspace OAuth must request Drive write scope");
assert.match(loginUrl.searchParams.get("scope") || "", /drive\.metadata\.readonly/, "Workspace OAuth must request folder metadata scope");
assert.ok(Array.isArray(loginResponse.headers["set-cookie"]), "Workspace OAuth intent must be kept in an HttpOnly cookie");

const rootLoginResponse = await call(rootAuth, { url: "/api/auth/login?integration=google-workspace" });
assert.equal(rootLoginResponse.statusCode, 302, "The production auth router must preserve Workspace OAuth");
assert.equal(new URL(rootLoginResponse.headers.location).searchParams.get("access_type"), "offline");

const originalFetch = globalThis.fetch;
let storedConnection = null;
globalThis.fetch = async (url, options = {}) => {
  const address = String(url);
  if (address === "https://oauth2.googleapis.com/token") {
    return fakeFetchResponse({ access_token: "access-token-never-returned-to-browser", refresh_token: "refresh-token-never-returned-to-browser", expires_in: 3600, scope: "openid email profile https://www.googleapis.com/auth/drive.file" });
  }
  if (address === "https://www.googleapis.com/oauth2/v3/userinfo") {
    return fakeFetchResponse({ email: "operator@heirright.com", name: "Operator" });
  }
  if (address === "https://worker.example.test/api/google-workspace/connection") {
    storedConnection = JSON.parse(options.body);
    return fakeFetchResponse({ ok: true, connected: true, destinationId: null, destinationName: null, readbackStatus: "verified" });
  }
  throw new Error(`Unexpected fetch ${address}`);
};

const callbackResponse = await call(callback, {
  url: "/auth/callback?code=approved-code&state=state-1",
  headers: { cookie: "hr_oauth_state=state-1; hr_google_workspace_intent=google-workspace" },
});
assert.equal(callbackResponse.statusCode, 302, "Workspace callback must complete after storage readback");
assert.equal(callbackResponse.headers.location, "/?googleWorkspace=connected");
assert.equal(storedConnection.email, "operator@heirright.com");
assert.equal(storedConnection.accessToken, "access-token-never-returned-to-browser", "Only the server-to-worker request receives the access token");
assert.doesNotMatch(callbackResponse.text, /access-token|refresh-token/, "OAuth tokens must not be returned to the browser");

const signedSession = createSessionToken({ email: "operator@heirright.com", name: "Operator" });
let workspaceRequest = null;
globalThis.fetch = async (url, options = {}) => {
  workspaceRequest = { url: String(url), options };
  if (String(url).includes("/destinations")) return fakeFetchResponse({ ok: true, folders: [{ id: "folder-1", name: "Discovery Packets" }] });
  if (String(url).includes("/doc-prep/packet-approval")) return fakeFetchResponse({
    ok: true,
    approval: {
      ...JSON.parse(options.body),
      approvedAt: "2026-07-15T15:00:00.000Z",
      approvedBy: "operator@heirright.com",
    },
    readbackStatus: "verified",
  });
  if (String(url).includes("/export")) return fakeFetchResponse({ ok: true, route: "google", mode: "live", fileId: "drive-file-1", destination: "Discovery Packets", readbackStatus: "verified", readbackOk: true });
  if (String(url).includes("/connection?")) return fakeFetchResponse({ ok: true, connected: true, destinationId: "folder-1", destinationName: "Discovery Packets" });
  if (String(url).endsWith("/connection")) return fakeFetchResponse({ ok: true, connected: true, destinationId: "folder-1", destinationName: "Discovery Packets", readbackStatus: "verified" });
  throw new Error(`Unexpected workspace fetch ${url}`);
};
const authHeaders = { cookie: `hr_session=${encodeURIComponent(signedSession)}` };
const statusResponse = await call(workspaceStatus, { headers: authHeaders, url: "/api/google-workspace/status" });
assert.equal(statusResponse.statusCode, 200, "Signed users can read only their Workspace connection status");
assert.match(workspaceRequest.url, /email=operator%40heirright.com/);
const foldersResponse = await call(workspaceDestinations, { headers: authHeaders, url: "/api/google-workspace/destinations" });
assert.equal(foldersResponse.statusCode, 200, "Signed users can load Drive folders");
const selectResponse = await call(workspaceDestinations, { method: "POST", body: { destinationId: "folder-1", destinationName: "Discovery Packets" }, headers: authHeaders });
assert.equal(selectResponse.statusCode, 200, "Drive destination selection must require a verified server write");
const packetId = "packet-1710000000000-0123456789abcdef";
const approval = {
  artifactId: packetId,
  estateId: "crm:podio:estate-38",
  flow: "discovery",
  packetRevision: 3,
};
const malformedApprovalAction = await call(packetApproval, {
  method: "POST",
  body: { ...approval, action: ["status"] },
  headers: authHeaders,
});
assert.equal(malformedApprovalAction.statusCode, 400, "Array-valued approval actions must fail at the signed facade before Worker proxying");
assert.equal(JSON.parse(malformedApprovalAction.text).error, "packet_approval_binding_required");
const approvalResponse = await call(packetApproval, {
  method: "POST",
  body: {
    ...approval,
    actorEmail: "attacker@example.test",
    approvedBy: "attacker@example.test",
    approvedAt: "forged-time",
    artifactContentHash: "forged-hash",
  },
  headers: authHeaders,
});
assert.equal(approvalResponse.statusCode, 200, "The signed packet approval facade must reach the server-attested Worker route");
assert.match(workspaceRequest.url, /\/api\/doc-prep\/packet-approval$/);
assert.deepEqual(JSON.parse(workspaceRequest.options.body), {
  action: "approve",
  ...approval,
  actorEmail: "operator@heirright.com",
}, "The approval facade must derive the actor and omit browser-supplied approval metadata");
const statusResponseForPacket = await call(packetApproval, {
  method: "POST",
  body: { action: "status", ...approval, actorEmail: "attacker@example.test", approvedBy: "attacker@example.test" },
  headers: authHeaders,
});
assert.equal(statusResponseForPacket.statusCode, 200, "The signed operator can hydrate current packet approval status");
assert.deepEqual(JSON.parse(workspaceRequest.options.body), {
  action: "status",
  ...approval,
  actorEmail: "operator@heirright.com",
}, "Approval status hydration must be actor-bound and omit browser-supplied approval metadata");
process.env.HEIRRIGHT_ADMIN_EMAILS = "admin@heirright.com";
const controlledExportDenied = await call(legacyExports, {
  method: "POST",
  body: { controlledTest: true, routes: ["podio"], dryRun: false },
  headers: authHeaders,
});
assert.equal(controlledExportDenied.statusCode, 403, "A signed non-admin must not smuggle the controlled live-export flag through the legacy facade");
assert.equal(JSON.parse(controlledExportDenied.text).error, "admin_required");
const malformedControlledExportDenied = await call(legacyExports, {
  method: "POST",
  body: { controlledTest: "true", routes: ["podio"], dryRun: false },
  headers: authHeaders,
});
assert.equal(malformedControlledExportDenied.statusCode, 400, "Truthy non-boolean controlled-export flags must fail closed before proxying");
assert.equal(JSON.parse(malformedControlledExportDenied.text).error, "export_request_invalid");
const bypassResponse = await call(workspaceExport, { method: "POST", body: { artifactId: packetId }, headers: authHeaders });
assert.equal(bypassResponse.statusCode, 400, "An artifact ID alone must never bypass exact packet approval");
const exportResponse = await call(workspaceExport, {
  method: "POST",
  body: {
    ...approval,
    deliveryDocumentId: "completed-report",
    actorEmail: "other@heirright.com",
    approvedBy: "other@heirright.com",
  },
  headers: authHeaders,
});
assert.equal(exportResponse.statusCode, 200, "Verified packet delivery must reach the server-side Drive route");
assert.equal(JSON.parse(exportResponse.text).readbackStatus, "verified");
assert.match(workspaceRequest.url, /\/api\/google-workspace\/export$/);
assert.equal(JSON.parse(workspaceRequest.options.body).email, "operator@heirright.com", "The browser must never choose a different delivery identity");
assert.deepEqual(JSON.parse(workspaceRequest.options.body), {
  email: "operator@heirright.com",
  actorEmail: "operator@heirright.com",
  ...approval,
  deliveryDocumentId: "completed-report",
}, "The server must derive the approving actor from the signed session and forward the exact estate, flow, revision, parent artifact, and client-report binding");

globalThis.fetch = originalFetch;
console.log(JSON.stringify({ ok: true, checks: [
  "workspace_oauth_offline_consent",
  "production_auth_router_workspace_scope",
  "server_side_token_storage_readback",
  "per_user_destination_picker",
  "verified_packet_drive_delivery",
  "packet_approval_actor_and_time_derived_server_side",
  "packet_approval_status_actor_bound_to_session",
  "controlled_export_flag_admin_only",
  "artifact_id_only_bypass_rejected",
  "browser_actor_forgery_ignored_and_actor_bound_to_session",
] }, null, 2));
