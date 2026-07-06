import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

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
}), "Podio");
assert.equal(browserOnlyPodio.ok, false);
assert.equal(browserOnlyPodio.mode, "review");
assert.equal(browserOnlyPodio.auth.mode, "browser_refresh");
assert.equal(browserOnlyPodio.auth.durableTeamAuth, false);
assert.equal(browserOnlyPodio.auth.reconnectRequired, true);
assert.match(browserOnlyPodio.message, /browser session only/i);

const durablePodio = byName(buildConnectionStatuses({
  ...podioBase,
  PODIO_APP_TOKEN: "durable-app-token",
}), "Podio");
assert.equal(durablePodio.ok, true);
assert.equal(durablePodio.mode, "live");
assert.equal(durablePodio.auth.mode, "app_auth");
assert.equal(durablePodio.auth.durableTeamAuth, true);

const browserbaseMissing = byName(buildConnectionStatuses({}), "Browserbase Usage");
assert.equal(browserbaseMissing.ok, false);
assert.equal(browserbaseMissing.mode, "blocked");
assert.match(browserbaseMissing.message, /not connected/i);

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

const bundle = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("../../worker/src/cloudflare.ts", import.meta.url), "utf8");
const wranglerConfig = readFileSync(new URL("../../worker/wrangler.toml", import.meta.url), "utf8");
assert.ok(bundle.includes('integrationOnboardingCardHtml("browserbase")'), "Settings must expose Browserbase usage onboarding.");
assert.ok(bundle.includes('"Browserbase Usage"'), "Connection rows must include Browserbase Usage.");
assert.ok(bundle.includes("Browserbase source usage"), "Source settings must show Browserbase usage controls.");
assert.ok(bundle.includes("Paid batch capture cap"), "Source settings must explain the Browserbase batch cap.");
assert.doesNotMatch(bundle, /Embed Builder|activepieces\.com\/docs|cdn\.activepieces\.com\/sdk|<iframe[^>]+activepieces/i);
assert.ok(workerSource.includes("PODIO_TOKEN_STORE"), "Worker must bind durable Podio token storage.");
assert.ok(workerSource.includes("storePodioRefreshToken"), "Podio OAuth callback must persist the team refresh token.");
assert.ok(workerSource.includes("PODIO_DURABLE_REFRESH_TOKEN"), "Stored Podio refresh must feed durable team auth.");
assert.ok(workerSource.includes("Podio Team Access Connected"), "OAuth success copy must distinguish durable team access.");
assert.ok(wranglerConfig.includes('binding = "PODIO_TOKEN_STORE"'), "Worker config must bind Podio KV token storage.");

const envKeys = [
  "HEIRRIGHT_WORKER_URL",
  "WORKER_API_URL",
  "WORKER_BASE_URL",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_API_BASE",
  "TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID",
  "BROWSERBASE_BATCH_APPROVAL_REQUIRED",
  "BROWSERBASE_BATCH_RUN_APPROVED",
  "BROWSERBASE_BATCH_MAX_SESSIONS",
];
const savedEnv = saveEnv(envKeys);
const savedFetch = globalThis.fetch;

try {
  delete process.env.HEIRRIGHT_WORKER_URL;
  delete process.env.WORKER_API_URL;
  delete process.env.WORKER_BASE_URL;
  process.env.BROWSERBASE_API_KEY = "bb-s34-secret";
  process.env.BROWSERBASE_API_BASE = "https://browserbase-s34.test";
  process.env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID = "tax-s34-function";
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
    "podio_browser_session_not_durable",
    "podio_app_token_durable",
    "podio_oauth_kv_team_storage",
    "browserbase_usage_status_and_settings",
    "browserbase_batch_guard_blocks_unapproved_paid_capture",
    "browserbase_batch_approval_allows_capture_without_secret_leak",
  ],
}, null, 2));
