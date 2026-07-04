import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const taxReceiptRun = require("../api/discovery/tax-collector/receipt-run.js");
const externalSourceRun = require("../api/discovery/external-source-run.js");
const idiImport = require("../api/discovery/idi-asset-search/import.js");
const { buildIdiCoreStatus } = require("../api/connections/status.js");

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

const envKeys = [
  "HEIRRIGHT_WORKER_URL",
  "WORKER_API_URL",
  "WORKER_BASE_URL",
  "BROWSERBASE_API_KEY",
  "BROWSERBASE_API_BASE",
  "TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID",
  "IDI_CORE_API_URL",
  "IDI_CORE_API_TOKEN",
  "HEIRRIGHT_IDI_CORE_API_TOKEN",
  "IDI_CORE_API_KEY",
  "IDI_CORE_LIVE_RUN_APPROVED",
];
const savedEnv = saveEnv(envKeys);
const savedFetch = globalThis.fetch;

try {
  delete process.env.HEIRRIGHT_WORKER_URL;
  delete process.env.WORKER_API_URL;
  delete process.env.WORKER_BASE_URL;
  delete process.env.IDI_CORE_API_KEY;
  delete process.env.HEIRRIGHT_IDI_CORE_API_TOKEN;
  process.env.BROWSERBASE_API_KEY = "s33-browserbase-secret";
  process.env.BROWSERBASE_API_BASE = "https://browserbase-s33.test";
  process.env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID = "tax-s33-function";
  process.env.IDI_CORE_API_URL = "https://idi-s33.test/asset-search";
  process.env.IDI_CORE_API_TOKEN = "s33-shared-team-token";
  process.env.IDI_CORE_LIVE_RUN_APPROVED = "true";

  const fetchCalls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    fetchCalls.push({ url, init });
    if (url.includes("/v1/functions/tax-s33-function/invoke")) {
      const payload = JSON.parse(String(init.body || "{}"));
      assert.equal(payload.params.parcelId, "34-1133-036-0010");
      assert.equal(payload.params.propertyAddress, "20611 NW 33rd Pl, Miami Gardens, FL 33056");
      assert.equal(payload.params.ownerName, "Estate of S33 Proof");
      return Response.json({
        id: "inv-s33-tax",
        sessionId: "sess-s33-tax",
        status: "COMPLETED",
        results: {
          listingUrl: "https://miamidade.county-taxes.test/accounts/34-1133-036-0010",
          listingHtml: `
            <main>
              <dl>
                <dt>Paid By</dt><dd>Estate of S33 Proof</dd>
                <dt>Paid Date</dt><dd>05/02/2025</dd>
                <dt>Amount Due</dt><dd>$3,210.40</dd>
                <dt>Unpaid Years</dt><dd>2023, 2024</dd>
                <dt>Reassessment</dt><dd>Reassessment review required after owner death</dd>
              </dl>
              <footer><a href="/payments/history">Payment history</a></footer>
              <aside style="float:right"><a class="receipt-link" href="/receipts/2025-s33.pdf">Print receipt</a></aside>
            </main>
          `,
        },
      }, { status: 202 });
    }
    if (url === "https://idi-s33.test/asset-search") {
      assert.equal(init.headers.authorization, "Bearer s33-shared-team-token");
      return Response.json({
        ok: true,
        status: "provider_completed",
        readbackStatus: "readback_confirmed",
        sourceEvidence: { reportId: "idi-s33-proof", authorization: "should-not-survive" },
        candidates: [{
          id: "idi-s33-1",
          name: "Jordan S33",
          relationship: "child",
          phones: ["305-555-0133"],
          currentAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
        }],
      });
    }
    throw new Error(`Unexpected fetch ${url}`);
  };

  const taxResult = await callHandler(taxReceiptRun, {
    estateId: "s33-tax-proof",
    seed: {
      estateName: "Estate of S33 Proof",
      ownerName: "Estate of S33 Proof",
      propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
      parcelId: "34-1133-036-0010",
      county: "miami-dade",
    },
  });
  assert.equal(taxResult.statusCode, 200);
  assert.equal(taxResult.json.ok, true);
  assert.equal(taxResult.json.mode, "listing_page_bottom_right");
  assert.equal(taxResult.json.searchInput.folio, "34-1133-036-0010");
  assert.equal(taxResult.json.receipt.receiptUrl, "https://miamidade.county-taxes.test/receipts/2025-s33.pdf");
  assert.equal(taxResult.json.receipt.paidBy, "Estate of S33 Proof");
  assert.equal(taxResult.json.receipt.paidDate, "05/02/2025");
  assert.equal(taxResult.json.receipt.amountDue.amount, 3210.4);
  assert.ok(taxResult.json.receipt.unpaidYears.includes(2023));
  assert.ok(taxResult.json.sourceFacts.some((fact) => fact.factType === "tax_receipt_link" && /2025-s33\.pdf/.test(fact.value)));
  assert.doesNotMatch(taxResult.text, /s33-browserbase-secret|s33-shared-team-token/);

  const sourceResult = await callHandler(externalSourceRun, {
    assetKey: "s33-external-proof",
    estateName: "Estate of S33 Proof",
    ownerName: "Estate of S33 Proof",
    propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    parcelId: "34-1133-036-0010",
    county: "miami-dade",
  });
  assert.equal(sourceResult.statusCode, 200);
  assert.equal(sourceResult.json.taxCollectorReceiptRun.ok, true);
  assert.equal(sourceResult.json.taxCollectorReceiptRun.receipt.receiptUrl, "https://miamidade.county-taxes.test/receipts/2025-s33.pdf");
  assert.ok(sourceResult.json.sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_receipt_link" && /2025-s33\.pdf/.test(fact.value)));
  assert.ok(sourceResult.json.sourceRunProof.sources.find((source) => source.source === "tax_collector")?.detailChecks.some((check) => check.code === "bottom_right_receipt" && check.status === "evidence_returned_review_required"));
  assert.doesNotMatch(sourceResult.text, /s33-browserbase-secret|s33-shared-team-token/);

  const idiStatus = buildIdiCoreStatus(process.env, "2026-07-04T00:00:00.000Z");
  assert.equal(idiStatus.api.sharedDefaultConfigured, true);
  assert.equal(idiStatus.api.accessConfigured, true);
  assert.equal(idiStatus.configuredMode, "api");

  const idiResult = await callHandler(idiImport, {
    assetKey: "s33-idi-proof",
    provider: "idi",
    runMode: "live_idi_core",
    paidRun: true,
    liveRunApproved: true,
    propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    ownerName: "Estate of S33 Proof",
    county: "miami-dade",
  });
  assert.equal(idiResult.statusCode, 200);
  assert.equal(idiResult.json.ok, true);
  assert.equal(idiResult.json.mode, "live_idi_core");
  assert.equal(idiResult.json.apiKeySource, "shared_default");
  assert.equal(idiResult.json.paidRun, true);
  assert.equal(idiResult.json.lockKey, "idi:20611 nw 33rd pl miami gardens fl 33056:proof");
  assert.equal(idiResult.json.readbackStatus, "readback_confirmed");
  assert.equal(idiResult.json.candidates.length, 1);
  assert.doesNotMatch(idiResult.text, /s33-shared-team-token|Bearer|should-not-survive/);

  const duplicate = await callHandler(idiImport, {
    assetKey: "s33-idi-proof",
    provider: "idi",
    runMode: "live_idi_core",
    paidRun: true,
    liveRunApproved: true,
    propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    ownerName: "Estate of S33 Proof",
  });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json.error, "duplicate_idi_asset_search");

  assert.ok(fetchCalls.some((call) => call.url.includes("/v1/functions/tax-s33-function/invoke")), "Tax Collector run must invoke Browserbase from estate facts.");
  assert.ok(fetchCalls.some((call) => call.url === "https://idi-s33.test/asset-search"), "IDI live run must call configured backend endpoint.");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "tax_collector_receipt_run_starts_from_estate_facts",
      "external_source_run_merges_tax_receipt_without_manual_listing",
      "idi_shared_backend_token_alias",
      "idi_duplicate_guard",
      "token_redaction",
    ],
  }, null, 2));
} finally {
  globalThis.fetch = savedFetch;
  restoreEnv(savedEnv);
}
