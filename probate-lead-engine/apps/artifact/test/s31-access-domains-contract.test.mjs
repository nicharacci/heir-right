import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { readArtifactSource } from "./helpers/artifact-source.mjs";

process.env.AUTH_REQUIRED = "false";

const require = createRequire(import.meta.url);
const adminAccess = require("../api/admin/access.js");
const accessConfig = require("../api/admin/access-config.js");
const { emailAllowed } = require("../api/auth/_shared.js");

function callHandler(handler, { method = "GET", body, headers = {}, url = "/api/admin/access" } = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      method,
      body,
      headers,
      url,
      on() {},
      destroy() {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) {
        this.headers[key.toLowerCase()] = value;
      },
      end(payload = "") {
        try {
          resolve({
            statusCode: this.statusCode,
            headers: this.headers,
            text: String(payload || ""),
            json: JSON.parse(String(payload || "{}")),
          });
        } catch (error) {
          reject(error);
        }
      },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

const savedEnv = {
  AUTH_ALLOWED_DOMAINS: process.env.AUTH_ALLOWED_DOMAINS,
  AUTH_ALLOWED_EMAILS: process.env.AUTH_ALLOWED_EMAILS,
  HEIRRIGHT_ADMIN_EMAILS: process.env.HEIRRIGHT_ADMIN_EMAILS,
  SOLVYS_ADMIN_EMAILS: process.env.SOLVYS_ADMIN_EMAILS,
  HEIRRIGHT_ACCESS_CONFIG_FILE: process.env.HEIRRIGHT_ACCESS_CONFIG_FILE,
  HEIRRIGHT_ACCESS_WEBHOOK_URL: process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL,
  HEIRRIGHT_LINEAR_API_KEY: process.env.HEIRRIGHT_LINEAR_API_KEY,
  LINEAR_API_KEY: process.env.LINEAR_API_KEY,
  AUTH_REQUIRED: process.env.AUTH_REQUIRED,
  HEIRRIGHT_API_TOKEN: process.env.HEIRRIGHT_API_TOKEN,
};

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const tmp = mkdtempSync(join(tmpdir(), "heirright-access-"));

try {
  process.env.HEIRRIGHT_ACCESS_CONFIG_FILE = join(tmp, "access.json");
  process.env.AUTH_ALLOWED_DOMAINS = "heirright.com,solvys.io,texasequitypros.com";
  process.env.AUTH_ALLOWED_EMAILS = "operator@heirright.com";
  process.env.HEIRRIGHT_ADMIN_EMAILS = "admin@solvys.io";
  delete process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL;
  delete process.env.HEIRRIGHT_LINEAR_API_KEY;
  delete process.env.LINEAR_API_KEY;
  accessConfig.resetAccessConfigForTests();

  const initial = await callHandler(adminAccess, { method: "GET" });
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.json.allowedDomains, ["heirright.com", "solvys.io", "texasequitypros.com"]);
  assert.deepEqual(initial.json.allowedEmails, ["operator@heirright.com", "admin@solvys.io"]);
  assert.deepEqual(accessConfig.adminEmails({ SOLVYS_ADMIN_EMAILS: "legacy@solvys.io" }), ["legacy@solvys.io"], "the legacy admin variable remains a fallback");
  assert.deepEqual(accessConfig.adminEmails({ HEIRRIGHT_ADMIN_EMAILS: "new@heirright.com", SOLVYS_ADMIN_EMAILS: "legacy@solvys.io" }), ["new@heirright.com"], "the HeirRight admin allowlist takes precedence over the legacy alias");

  const exactEmailAdded = await callHandler(adminAccess, {
    method: "POST",
    body: { action: "add", value: "Approved.User@gmail.com", actor: "admin@solvys.io" },
  });
  assert.equal(exactEmailAdded.statusCode, 200);
  assert.equal(exactEmailAdded.json.payload.type, "email");
  assert.ok(exactEmailAdded.json.allowedEmails.includes("approved.user@gmail.com"));
  assert.ok(!exactEmailAdded.json.allowedDomains.includes("gmail.com"), "an exact email mutation must never widen access to its whole domain");
  assert.equal(emailAllowed("approved.user@gmail.com"), true, "the exact approved email must pass the sign-in gate");
  assert.equal(emailAllowed("attacker@gmail.com"), false, "another account on the same public email domain must remain denied");

  const exactEmailRemoved = await callHandler(adminAccess, {
    method: "POST",
    body: { action: "remove", value: "approved.user@gmail.com", actor: "admin@solvys.io" },
  });
  assert.equal(exactEmailRemoved.statusCode, 200);
  assert.ok(!exactEmailRemoved.json.allowedEmails.includes("approved.user@gmail.com"));
  assert.equal(emailAllowed("approved.user@gmail.com"), false);

  const added = await callHandler(adminAccess, {
    method: "POST",
    body: { action: "add", value: "Ops.Example.com", actor: "admin@solvys.io" },
  });
  assert.equal(added.statusCode, 200);
  assert.equal(added.json.status, "access_added");
  assert.ok(added.json.allowedDomains.includes("ops.example.com"));
  assert.ok(added.json.allowedDomains.includes("solvys.io"));

  accessConfig.resetAccessConfigForTests();
  const readback = accessConfig.accessConfig(process.env);
  assert.ok(readback.allowedDomains.includes("ops.example.com"));
  assert.ok(readback.allowedDomains.includes("solvys.io"));
  assert.equal(readback.source, "local_admin_file");

  const removed = await callHandler(adminAccess, {
    method: "POST",
    body: { action: "remove", value: "@ops.example.com", actor: "admin@solvys.io" },
  });
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.json.status, "access_removed");
  assert.ok(!removed.json.allowedDomains.includes("ops.example.com"));

  const previousFetch = globalThis.fetch;
  let routedPayload;
  process.env.AUTH_REQUIRED = "true";
  process.env.HEIRRIGHT_API_TOKEN = "s31-internal-token";
  process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL = "https://access-routing.test/request";
  globalThis.fetch = async (_url, options) => {
    routedPayload = JSON.parse(String(options?.body || "{}"));
    return { ok: true, status: 202 };
  };
  const productionRequest = await callHandler(adminAccess, {
    method: "POST",
    body: { action: "add", value: "pending.example.com", actor: "admin@solvys.io" },
    headers: { authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` },
  });
  globalThis.fetch = previousFetch;
  delete process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL;
  assert.equal(productionRequest.statusCode, 202);
  assert.equal(productionRequest.json.status, "access_change_requested");
  assert.equal(productionRequest.json.applied, false, "a deployed function must not claim its bundle-local file changed production access");
  assert.equal(productionRequest.json.routing.status, "webhook_queued");
  assert.equal(routedPayload.value, "pending.example.com");
  assert.ok(!productionRequest.json.allowedDomains.includes("pending.example.com"));
  accessConfig.resetAccessConfigForTests();
  assert.ok(!accessConfig.allowedDomains(process.env).includes("pending.example.com"), "production approval routing must leave the local allowlist unchanged");

  const unroutedProductionRequest = await callHandler(adminAccess, {
    method: "POST",
    body: { action: "add", value: "unrecorded.example.com", actor: "admin@solvys.io" },
    headers: { authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` },
  });
  assert.equal(unroutedProductionRequest.statusCode, 503);
  assert.equal(unroutedProductionRequest.json.applied, false);
  assert.equal(unroutedProductionRequest.json.status, "access_change_not_recorded");
  assert.ok(!unroutedProductionRequest.json.allowedDomains.includes("unrecorded.example.com"));
  process.env.AUTH_REQUIRED = "false";

  accessConfig.resetAccessConfigForTests();
  const blockedParent = join(tmp, "blocked-parent");
  writeFileSync(blockedParent, "this path is intentionally a file");
  process.env.HEIRRIGHT_ACCESS_CONFIG_FILE = join(blockedParent, "access.json");
  assert.throws(
    () => accessConfig.applyAccessChange("add", "unwritten.example.com", process.env),
    /EEXIST|ENOTDIR/,
    "a failed durable write must surface instead of reporting a successful mutation",
  );
  process.env.HEIRRIGHT_ACCESS_CONFIG_FILE = join(tmp, "fresh", "access.json");
  assert.deepEqual(
    accessConfig.allowedDomains(process.env),
    ["heirright.com", "solvys.io", "texasequitypros.com"],
    "a failed durable write must not expand the warm runtime allowlist",
  );

  const bundle = readArtifactSource();
  const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../../worker/src/cloudflare.ts", import.meta.url), "utf8");
  assert.ok(bundle.includes("solvys.io"), "Admin default list must include solvys.io.");
  assert.ok(server.includes("access-config"), "Auth session must read the Admin access config helper.");
  assert.ok(worker.includes("solvys.io"), "Worker auth fallback must include solvys.io.");
  assert.doesNotMatch(`${bundle}\n${server}\n${worker}`, /solvys\.ai/i, "Allowed-domain code must not reference solvys.ai.");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "admin_access_get_uses_shared_default_domains",
      "admin_access_post_persists_auth_allowlist",
      "exact_email_mutation_does_not_whitelist_public_domain",
      "production_access_change_is_approval_request_not_ephemeral_mutation",
      "unrouted_production_access_change_fails_without_mutation",
      "admin_email_union_and_legacy_fallback",
      "failed_access_write_does_not_mutate_runtime",
      "auth_session_reads_access_config_helper",
      "worker_auth_default_includes_solvys_io",
      "no_solvys_ai_allowed_domain",
    ],
  }, null, 2));
} finally {
  restoreEnv();
  accessConfig.resetAccessConfigForTests();
  rmSync(tmp, { recursive: true, force: true });
}
