import assert from "node:assert/strict";
import { acquireTaxCollectorReceipt } from "../../worker/dist/adapters/tax-collector-receipt.js";

const calls = [];
const success = await acquireTaxCollectorReceipt({
  parcelId: "3031030000010",
  propertyAddress: "2325 NW 88th St, Miami, FL 33147",
  ownerName: "Reviewed Estate Owner",
}, {
  env: {
    BROWSERBASE_API_KEY: "test-browserbase-key",
    TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID: "tax-receipt-function",
    BROWSERBASE_API_BASE: "https://browserbase.test",
    BROWSERBASE_PROXY_ENABLED: "true",
  },
  fetchImpl: async (input, init = {}) => {
    calls.push({ input: String(input), init });
    return new Response(JSON.stringify({
      id: "invocation-tax-receipt",
      sessionId: "session-tax-receipt",
      status: "COMPLETED",
      results: {
        listingUrl: "https://miamidade.county-taxes.test/property/3031030000010",
        listingHtml: '<main><a href="/history">History</a><aside><a class="receipt" href="/receipts/2025-paid.pdf">Print payment receipt</a></aside></main>',
      },
    }), { status: 202, headers: { "content-type": "application/json" } });
  },
});

assert.equal(calls.length, 1);
assert.equal(calls[0].input, "https://browserbase.test/v1/functions/tax-receipt-function/invoke");
assert.equal(calls[0].init.headers["x-bb-api-key"], "test-browserbase-key");
const invocationBody = JSON.parse(calls[0].init.body);
assert.equal(invocationBody.params.parcelId, "3031030000010");
assert.equal(invocationBody.params.propertyAddress, "2325 NW 88th St, Miami, FL 33147");
assert.equal(invocationBody.params.ownerName, "Reviewed Estate Owner");
assert.equal(invocationBody.params.searchUrl, "https://county-taxes.net/fl-miamidade/property-tax");
assert.equal(invocationBody.sessionCreateParams.proxies[0].domainPattern, "county-taxes.net");
assert.equal(success.mode, "listing_page_bottom_right");
assert.equal(success.paidRun, true);
assert.equal(success.discovery.receiptUrl, "https://miamidade.county-taxes.test/receipts/2025-paid.pdf");
assert.equal(success.listingUrl, "https://miamidade.county-taxes.test/property/3031030000010");

const billing = await acquireTaxCollectorReceipt({
  parcelId: "3031030000010",
  propertyAddress: "2325 NW 88th St, Miami, FL 33147",
}, {
  env: {
    BROWSERBASE_API_KEY: "test-browserbase-key",
    TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID: "tax-receipt-function",
  },
  fetchImpl: async () => new Response(JSON.stringify({ error: "payment_required" }), {
    status: 402,
    headers: { "content-type": "application/json" },
  }),
});

assert.equal(billing.mode, "browserbase_billing_required");
assert.equal(billing.paidRun, true);
assert.match(billing.blocker, /billing|credit/i);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "estate_facts_drive_public_search",
    "browserbase_function_auth_and_proxy",
    "listing_page_receipt_capture",
    "paid_run_provenance",
    "billing_failure_classification",
  ],
}, null, 2));
