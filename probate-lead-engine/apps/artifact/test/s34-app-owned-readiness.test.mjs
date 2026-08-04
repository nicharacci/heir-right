import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { readArtifactSource } from "./helpers/artifact-source.mjs";

const require = createRequire(import.meta.url);
const taxReceiptRun = require("../api/discovery/tax-collector/receipt-run.js");
const { buildConnectionStatuses } = require("../api/connections/status.js");

function byName(statuses, name) {
  const row = statuses.find((status) => status.name === name);
  assert.ok(row, `${name} status row missing`);
  return row;
}

function callHandler(handler, body) {
  return new Promise((resolve, reject) => {
    const request = {
      method: "POST",
      body,
      headers: {},
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

function saveEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const podioBase = {
  PODIO_CLIENT_ID: "client",
  PODIO_CLIENT_SECRET: "secret",
  PODIO_APP_ID: "24265877",
  PODIO_CSV_BACKUP_CONFIRMED: "true",
  PODIO_LIVE_WRITE_APPROVED: "true",
  PODIO_TEST_PHONE: "3055550100",
  PODIO_TEST_EMAIL: "review@heirright.test",
  PODIO_LEAD_POINT_PROFILE_ID: "12345",
};

const browserOnlyPodio = byName(buildConnectionStatuses({
  ...podioBase,
  PODIO_BROWSER_REFRESH_TOKEN: "browser-session-refresh",
  PODIO_PER_USER_AUTH_REQUIRED: "true",
  PODIO_USER_SCOPED_REFRESH: "true",
}), "Podio");
assert.equal(browserOnlyPodio.ok, true);
assert.equal(browserOnlyPodio.mode, "live");
assert.equal(browserOnlyPodio.auth.mode, "browser_refresh");
assert.equal(browserOnlyPodio.auth.durableTeamAuth, false);
assert.equal(browserOnlyPodio.auth.reconnectRequired, false);
assert.equal(browserOnlyPodio.auth.userScopedRefresh, true);
assert.match(browserOnlyPodio.message, /Your Podio handoff access/i);

const defaultPolicyPodio = byName(buildConnectionStatuses({
  ...podioBase,
  PODIO_APP_TOKEN: "durable-app-token",
}), "Podio");
assert.equal(defaultPolicyPodio.ok, false);
assert.equal(defaultPolicyPodio.mode, "review");
assert.equal(defaultPolicyPodio.auth.perUserRequired, true);
assert.equal(defaultPolicyPodio.auth.durableRequired, false);
assert.equal(defaultPolicyPodio.auth.reconnectRequired, true);

const durablePodio = byName(buildConnectionStatuses({
  ...podioBase,
  PODIO_APP_TOKEN: "durable-app-token",
  PODIO_PER_USER_AUTH_REQUIRED: "true",
}), "Podio");
assert.equal(durablePodio.ok, false);
assert.equal(durablePodio.mode, "review");
assert.equal(durablePodio.auth.mode, "app_auth");
assert.equal(durablePodio.auth.durableTeamAuth, true);
assert.equal(durablePodio.auth.reconnectRequired, true);

const explicitSharedPodio = byName(buildConnectionStatuses({
  ...podioBase,
  PODIO_APP_TOKEN: "durable-app-token",
  PODIO_PER_USER_AUTH_REQUIRED: "false",
  PODIO_DURABLE_AUTH_REQUIRED: "true",
}), "Podio");
assert.equal(explicitSharedPodio.ok, true);
assert.equal(explicitSharedPodio.auth.perUserRequired, false);
assert.equal(explicitSharedPodio.auth.durableRequired, true);
assert.equal(explicitSharedPodio.auth.reconnectRequired, false);

const browserbaseMissing = byName(buildConnectionStatuses({}), "Browserbase Usage");
assert.equal(browserbaseMissing.ok, false);
assert.equal(browserbaseMissing.mode, "blocked");
assert.match(browserbaseMissing.message, /not connected/i);

const browserbaseProjectOnly = byName(buildConnectionStatuses({
  BROWSERBASE_PROJECT_ID: "project-without-api-key",
}), "Browserbase Usage");
assert.equal(browserbaseProjectOnly.ok, false);
assert.equal(browserbaseProjectOnly.mode, "blocked");

const browserbaseApiOnly = byName(buildConnectionStatuses({
  BROWSERBASE_API_KEY: "api-key-without-project-or-functions",
}), "Browserbase Usage");
assert.equal(browserbaseApiOnly.ok, false);
assert.equal(browserbaseApiOnly.mode, "blocked");

const browserbaseConfigured = byName(buildConnectionStatuses({
  BROWSERBASE_API_KEY: "bb-test",
  TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID: "tax-function",
  OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID: "vital-function",
  BROWSERBASE_BATCH_MAX_SESSIONS: "12",
  BROWSERBASE_BATCH_CONCURRENCY: "3",
}), "Browserbase Usage");
assert.equal(browserbaseConfigured.ok, true);
assert.equal(browserbaseConfigured.mode, "review");
assert.equal(browserbaseConfigured.configuredMode, "usage_policy");
assert.equal(browserbaseConfigured.usagePolicy.taxCollectorFunctionConfigured, true);
assert.equal(browserbaseConfigured.usagePolicy.vitalObituaryFunctionConfigured, true);
assert.equal(browserbaseConfigured.usagePolicy.maxBatchSessions, 12);
assert.equal(browserbaseConfigured.usagePolicy.maxConcurrency, 3);
assert.match(browserbaseConfigured.message, /Paid batch source runs are capped at 12 estates/i);

const bundle = readArtifactSource();
const workerSource = readFileSync(new URL("../../worker/src/cloudflare.ts", import.meta.url), "utf8");
const wranglerConfig = readFileSync(new URL("../../worker/wrangler.toml", import.meta.url), "utf8");
assert.ok(bundle.includes('integrationOnboardingCardHtml("browserbase")'), "Settings must expose Browserbase usage onboarding.");
assert.ok(bundle.includes('"Browserbase Usage"'), "Connection rows must include Browserbase Usage.");
assert.ok(bundle.includes("Browserbase source usage"), "Source settings must show Browserbase usage controls.");
assert.ok(bundle.includes("Paid batch capture cap"), "Source settings must explain the Browserbase batch cap.");
assert.ok(bundle.includes("Billing blocked"), "Settings must surface Browserbase billing as blocked until a disposable session is verified.");
assert.ok(bundle.includes('connectionReadyState("Browserbase Usage") === "ready"'), "Settings must use live readiness instead of inferring Browserbase availability from saved credentials alone.");
assert.ok(bundle.includes("Recent disposable sessions return HTTP 402"), "Settings must report the current Browserbase billing failure without masking it as ready.");
assert.ok(!bundle.includes('browserbase?.ok ? "Single-estate capture ready"'), "Settings must not label review-only Browserbase configuration as ready.");
assert.ok(bundle.includes('name === "Browserbase Usage" && connection?.ok && connection?.mode !== "live"'), "The current Browserbase billing incident must apply only to configured, non-live status rows.");
assert.ok(bundle.includes('browserbaseSetupRequired = kind === "browserbase" && !connection?.ok'), "Integrations must distinguish missing Browserbase setup from the current billing incident.");
assert.ok(bundle.includes('statusLabel: browserbaseReady ? "Live" : browserbaseConfigured ? "Blocked" : "Setup required"'), "Sources must expose distinct live, billing-blocked, and setup-required Browserbase states.");
assert.ok(bundle.includes('if (!configured) return missingCopy'), "Missing source workflows must not inherit ready or billing-incident copy.");
assert.ok(bundle.includes("browserWorkflowState(tax, tax?.sourceAutomation?.browserWorkflowConfigured)"), "Tax Collector must not label a review-only Browserbase function ready.");
assert.ok(bundle.includes("browserWorkflowState(vital, vital?.sourceAutomation?.workflowConfigured)"), "Vital sources must not label a review-only Browserbase function ready.");
assert.doesNotMatch(bundle, /Embed Builder|activepieces\.com\/docs|cdn\.activepieces\.com\/sdk|<iframe[^>]+activepieces/i);
assert.ok(workerSource.includes("PODIO_TOKEN_STORE"), "Worker must bind durable Podio token storage.");
assert.ok(workerSource.includes("storePodioRefreshToken"), "Podio OAuth callback must persist each user's refresh token.");
assert.ok(workerSource.includes("user_scoped_durable_refresh"), "Stored Podio refresh must remain user-scoped.");
assert.ok(workerSource.includes("Your Podio Account Is Connected"), "OAuth success copy must explain user-scoped access.");
assert.ok(wranglerConfig.includes('PODIO_PER_USER_AUTH_REQUIRED = "true"'), "Production must require per-user Podio OAuth.");
assert.ok(wranglerConfig.includes('binding = "PODIO_TOKEN_STORE"'), "Worker config must bind Podio KV token storage.");

const envKeys = [
  "AUTH_REQUIRED",
  "HEIRRIGHT_WORKER_URL",
  "WORKER_API_URL",
  "WORKER_BASE_URL",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_API_BASE",
  "TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID",
  "TAX_COLLECTOR_ALLOWED_ORIGINS",
  "BROWSERBASE_BATCH_APPROVAL_REQUIRED",
  "BROWSERBASE_BATCH_RUN_APPROVED",
  "BROWSERBASE_BATCH_MAX_SESSIONS",
];
const savedEnv = saveEnv(envKeys);
const savedFetch = globalThis.fetch;

try {
  process.env.AUTH_REQUIRED = "false";
  delete process.env.HEIRRIGHT_WORKER_URL;
  delete process.env.WORKER_API_URL;
  delete process.env.WORKER_BASE_URL;
  process.env.BROWSERBASE_API_KEY = "bb-s34-secret";
  process.env.BROWSERBASE_API_BASE = "https://browserbase-s34.test";
  process.env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID = "tax-s34-function";
  process.env.TAX_COLLECTOR_ALLOWED_ORIGINS = "https://miamidade.county-taxes.test";
  process.env.BROWSERBASE_BATCH_APPROVAL_REQUIRED = "true";
  process.env.BROWSERBASE_BATCH_MAX_SESSIONS = "3";

  const fetchCalls = [];
  globalThis.fetch = async (input, init = {}) => {
    fetchCalls.push({ url: String(input), init });
    if (String(input).includes("/v1/functions/tax-s34-function/invoke")) {
      return Response.json({
        id: "inv-s34-tax",
        sessionId: "sess-s34-tax",
        status: "COMPLETED",
        results: {
          listingUrl: "https://miamidade.county-taxes.test/accounts/30-3111-001-0010",
          listingHtml: `
            <main>
              <dl><dt>Paid By</dt><dd>S34 Estate</dd><dt>Paid Date</dt><dd>06/01/2025</dd></dl>
              <aside style="float:right"><a class="receipt-link" href="/receipts/s34.pdf">Print receipt</a></aside>
            </main>
          `,
        },
      }, { status: 202 });
    }
    throw new Error(`Unexpected fetch ${input}`);
  };

  const blocked = await callHandler(taxReceiptRun, {
    batch: true,
    estateCount: 2,
    seed: {
      estateName: "Estate of S34 Blocked",
      ownerName: "S34 Estate",
      propertyAddress: "100 NW 1st Ave, Miami, FL",
      parcelId: "30-3111-001-0010",
      county: "miami-dade",
    },
  });
  assert.equal(blocked.statusCode, 200);
  assert.equal(blocked.json.ok, false);
  assert.equal(blocked.json.mode, "browserbase_batch_blocked");
  assert.equal(blocked.json.paidRun, true);
  assert.match(blocked.json.blockers.join(" "), /explicit batch approval/i);
  assert.equal(fetchCalls.length, 0, "Unapproved batch must not call Browserbase.");

  const approved = await callHandler(taxReceiptRun, {
    batch: true,
    estateCount: 2,
    browserbaseUsageApproval: "approved_paid_browserbase_batch_run",
    seed: {
      estateName: "Estate of S34 Approved",
      ownerName: "S34 Estate",
      propertyAddress: "100 NW 1st Ave, Miami, FL",
      parcelId: "30-3111-001-0010",
      county: "miami-dade",
    },
  });
  assert.equal(approved.statusCode, 200);
  assert.equal(approved.json.ok, true);
  assert.equal(approved.json.receipt.receiptUrl, "https://miamidade.county-taxes.test/receipts/s34.pdf");
  assert.ok(fetchCalls.some((call) => call.url.includes("/v1/functions/tax-s34-function/invoke")), "Approved batch should call Browserbase.");
  assert.doesNotMatch(approved.text, /bb-s34-secret/);
} finally {
  globalThis.fetch = savedFetch;
  restoreEnv(savedEnv);
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "podio_user_scoped_refresh_is_ready",
    "podio_shared_app_token_rejected_for_per_user_mode",
    "podio_oauth_kv_user_storage",
    "browserbase_usage_status_and_settings",
    "browserbase_batch_guard_blocks_unapproved_paid_capture",
    "browserbase_batch_approval_allows_capture_without_secret_leak",
  ],
}, null, 2));
