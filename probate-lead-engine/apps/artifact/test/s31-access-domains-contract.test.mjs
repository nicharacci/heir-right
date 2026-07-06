import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const adminAccess = require("../api/admin/access.js");
const accessConfig = require("../api/admin/access-config.js");

function callHandler(handler, { method = "GET", body } = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      method,
      body,
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
  SOLVYS_ADMIN_EMAILS: process.env.SOLVYS_ADMIN_EMAILS,
  HEIRRIGHT_ACCESS_CONFIG_FILE: process.env.HEIRRIGHT_ACCESS_CONFIG_FILE,
  HEIRRIGHT_ACCESS_WEBHOOK_URL: process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL,
  HEIRRIGHT_LINEAR_API_KEY: process.env.HEIRRIGHT_LINEAR_API_KEY,
  LINEAR_API_KEY: process.env.LINEAR_API_KEY,
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
  process.env.AUTH_ALLOWED_EMAILS = "admin@solvys.io";
  delete process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL;
  delete process.env.HEIRRIGHT_LINEAR_API_KEY;
  delete process.env.LINEAR_API_KEY;
  accessConfig.resetAccessConfigForTests();

  const initial = await callHandler(adminAccess, { method: "GET" });
  assert.equal(initial.statusCode, 200);
  assert.deepEqual(initial.json.allowedDomains, ["heirright.com", "solvys.io", "texasequitypros.com"]);
  assert.deepEqual(initial.json.allowedEmails, ["admin@solvys.io"]);

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
  assert.equal(readback.source, "admin");

  const removed = await callHandler(adminAccess, {
    method: "POST",
    body: { action: "remove", value: "@ops.example.com", actor: "admin@solvys.io" },
  });
  assert.equal(removed.statusCode, 200);
  assert.equal(removed.json.status, "access_removed");
  assert.ok(!removed.json.allowedDomains.includes("ops.example.com"));

  const bundle = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
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
