import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { existsSync, readFileSync } from "node:fs";

process.env.AUTH_REQUIRED = "false";

const require = createRequire(import.meta.url);
const { handleRequest } = require("../server.js");
const authSession = require("../api/auth/session.js");
const podioDiagnostics = require("../api/podio/diagnostics.js");
const podioOAuthStart = require("../api/podio/oauth/start.js");
const podioOAuthCallback = require("../api/podio/oauth/callback.js");

function callServer(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const request = new Readable({
      read() {
        if (payload) this.push(payload);
        this.push(null);
      },
    });
    request.method = method;
    request.url = path;
    request.headers = {
      host: "app.heirright.com",
      "x-forwarded-host": "app.heirright.com",
      "x-forwarded-proto": "https",
    };

    const response = {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        this.headers = { ...this.headers, ...headers };
      },
      end(raw = "") {
        const text = String(raw || "");
        try {
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            text,
            json: text ? JSON.parse(text) : null,
          });
        } catch (error) {
          reject(error);
        }
      },
    };

    try {
      handleRequest(request, response);
    } catch (error) {
      reject(error);
    }
  });
}

for (const path of ["/api/discovery/external-source-run", "/api/exports", "/api/leads/fresh-batch"]) {
  const response = await callServer("GET", path);
  assert.equal(response.statusCode, 405, `${path} must reject GET.`);
  assert.equal(response.json.error, "method_not_allowed");
  assert.equal(response.headers.allow, "POST");
}

const missingIntent = await callServer("POST", "/api/discovery/external-source-run", {
  seed: {
    ownerName: "Estate of Guard Proof",
    propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    county: "miami-dade",
  },
});
assert.equal(missingIntent.statusCode, 400);
assert.equal(missingIntent.json.error, "source_run_intent_required");

const sourceHtml = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
assert.ok(sourceHtml.includes('operatorIntent: "run_external_source_search"'), "Doc Prep source-search button must send explicit operator intent.");

const workerSource = readFileSync(new URL("../../worker/src/cloudflare.ts", import.meta.url), "utf8");
assert.ok(workerSource.includes("function methodNotAllowed"), "Worker must expose method guard helper.");
assert.ok(workerSource.includes("request.method !== \"POST\""), "Worker mutation routes must reject non-POST requests.");
assert.ok(workerSource.includes("source_run_intent_required"), "Worker external source runs must require explicit operator intent.");
assert.ok(workerSource.includes('"/api/discovery/tax-collector/receipt-run"'), "Worker must expose the direct Tax Collector receipt-run route.");
assert.ok(workerSource.includes("taxCollectorReceiptRunResponse"), "Worker Tax Collector route must use the Browserbase-capable receipt acquisition path.");

const sharedApi = readFileSync(new URL("../api/_shared.js", import.meta.url), "utf8");
assert.ok(sharedApi.includes("proxyWorkerHttp"), "Vercel API routes must support redirect/cookie-preserving Worker proxying.");
for (const [name, handler] of [
  ["podio_diagnostics", podioDiagnostics],
  ["podio_oauth_start", podioOAuthStart],
  ["podio_oauth_callback", podioOAuthCallback],
]) {
  const response = await new Promise((resolve) => {
    handler({
      method: "POST",
      url: "/api/podio/oauth/start",
      headers: { host: "app.heirright.com", "x-forwarded-host": "app.heirright.com", "x-forwarded-proto": "https" },
    }, {
      statusCode: 200,
      headers: {},
      setHeader(key, value) {
        this.headers[key.toLowerCase()] = value;
      },
      end(payload = "") {
        resolve({ statusCode: this.statusCode, headers: this.headers, json: JSON.parse(String(payload || "{}")) });
      },
    });
  });
  assert.equal(response.statusCode, 405, `${name} must reject mutation methods.`);
  assert.equal(response.json.error, "method_not_allowed");
}
process.env.AUTH_REQUIRED = "true";
delete process.env.AUTH_SESSION_SECRET;
const unauthenticatedPodioStart = await new Promise((resolve) => {
  podioOAuthStart({
    method: "GET",
    url: "/api/podio/oauth/start",
    headers: { host: "app.heirright.com", "x-forwarded-host": "app.heirright.com", "x-forwarded-proto": "https" },
  }, {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(payload = "") {
      resolve({ statusCode: this.statusCode, headers: this.headers, text: String(payload || "") });
    },
  });
});
assert.equal(unauthenticatedPodioStart.statusCode, 401, "Podio OAuth start must require a signed-in app user.");
assert.match(unauthenticatedPodioStart.text, /Sign in before connecting Podio/);

const vercelConfig = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
assert.ok(vercelConfig.includes('"source": "/auth/:path*"'), "Vercel must rewrite /auth routes to dynamic auth functions.");
assert.equal(existsSync(new URL("../dist/auth/session", import.meta.url)), false, "Build output must not ship a static /auth/session fallback.");

process.env.AUTH_REQUIRED = "true";
process.env.GOOGLE_OAUTH_CLIENT_ID = "google-client";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "google-secret";
process.env.AUTH_SESSION_SECRET = "session-secret";
process.env.AUTH_ALLOWED_DOMAINS = "heirright.com,solvys.io,texasequitypros.com";
const authRoute = await new Promise((resolve, reject) => {
  const request = {
    method: "GET",
    url: "/auth/session",
    headers: {
      host: "app.heirright.com",
      "x-forwarded-host": "app.heirright.com",
      "x-forwarded-proto": "https",
    },
  };
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(payload = "") {
      try {
        resolve({ statusCode: this.statusCode, json: JSON.parse(String(payload || "{}")) });
      } catch (error) {
        reject(error);
      }
    },
  };
  authSession(request, response);
});
assert.equal(authRoute.statusCode, 200);
assert.equal(authRoute.json.auth.required, true);
assert.equal(authRoute.json.auth.configured, true);
assert.ok(authRoute.json.auth.allowedDomains.includes("solvys.io"));

console.log(JSON.stringify({
  ok: true,
  checks: [
    "artifact_server_get_source_run_rejects",
    "artifact_server_get_export_rejects",
    "artifact_server_get_fresh_batch_rejects",
    "external_source_post_requires_operator_intent",
    "docprep_sends_operator_intent",
    "worker_route_guards_present",
    "worker_tax_collector_receipt_route_present",
    "podio_oauth_routes_proxy_worker",
    "podio_oauth_requires_signed_in_user",
    "vercel_auth_rewrite_configured",
    "static_auth_session_removed",
    "dynamic_auth_session_configured",
  ],
}, null, 2));
