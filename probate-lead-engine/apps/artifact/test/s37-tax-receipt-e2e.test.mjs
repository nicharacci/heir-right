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
    TAX_COLLECTOR_ALLOWED_ORIGINS: "https://miamidade.county-taxes.test",
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

const countyEnv = {
  TAX_COLLECTOR_ALLOWED_ORIGINS: "https://county-approved.test",
  TAX_COLLECTOR_FETCH_TIMEOUT_MS: "20",
  TAX_COLLECTOR_FETCH_MAX_BYTES: "1024",
};
const directCalls = [];
const directSuccess = await acquireTaxCollectorReceipt({
  listingUrl: "https://county-approved.test/start",
}, {
  env: countyEnv,
  fetchImpl: async (input, init = {}) => {
    directCalls.push({ input: String(input), init });
    if (directCalls.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "/listing/folio-1", "content-type": "text/html" },
      });
    }
    return new Response('<main><aside><a class="receipt" href="/receipts/folio-1.pdf">Print payment receipt</a></aside></main>', {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
});
assert.equal(directSuccess.ok, true);
assert.equal(directSuccess.discovery.receiptUrl, "https://county-approved.test/receipts/folio-1.pdf");
assert.equal(directCalls.length, 2);
assert.ok(directCalls.every((call) => call.init.redirect === "manual"), "every county redirect hop must stay under application validation");

let rejectedOriginFetches = 0;
const rejectedOrigin = await acquireTaxCollectorReceipt({ listingUrl: "https://attacker.test/internal" }, {
  env: countyEnv,
  fetchImpl: async () => {
    rejectedOriginFetches += 1;
    throw new Error("must not fetch");
  },
});
assert.equal(rejectedOrigin.ok, false);
assert.equal(rejectedOriginFetches, 0, "an unapproved origin must be rejected before fetch");
assert.equal(rejectedOrigin.listingUrl, "", "an attacker-controlled URL must not be reflected in the error result");
assert.equal("bodySnippet" in rejectedOrigin, false);

let redirectFetches = 0;
const rejectedRedirect = await acquireTaxCollectorReceipt({ listingUrl: "https://county-approved.test/start" }, {
  env: countyEnv,
  fetchImpl: async () => {
    redirectFetches += 1;
    return new Response("redirect body must not escape", {
      status: 302,
      headers: { location: "https://attacker.test/redirect", "content-type": "text/html" },
    });
  },
});
assert.equal(rejectedRedirect.ok, false);
assert.equal(redirectFetches, 1, "an unapproved redirect target must never be requested");
assert.equal("bodySnippet" in rejectedRedirect, false);
assert.doesNotMatch(JSON.stringify(rejectedRedirect), /redirect body must not escape/);

const unsafeType = await acquireTaxCollectorReceipt({ listingUrl: "https://county-approved.test/json" }, {
  env: countyEnv,
  fetchImpl: async () => new Response(JSON.stringify({ secret: "COUNTY_BODY_SECRET" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }),
});
assert.equal(unsafeType.ok, false);
assert.match(unsafeType.blocker, /content type/i);
assert.equal("bodySnippet" in unsafeType, false);
assert.doesNotMatch(JSON.stringify(unsafeType), /COUNTY_BODY_SECRET/);

const oversizedStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new Uint8Array(800));
    controller.enqueue(new Uint8Array(800));
    controller.close();
  },
});
const oversized = await acquireTaxCollectorReceipt({ listingUrl: "https://county-approved.test/large" }, {
  env: countyEnv,
  fetchImpl: async () => new Response(oversizedStream, {
    status: 200,
    headers: { "content-type": "text/html" },
  }),
});
assert.equal(oversized.ok, false);
assert.match(oversized.blocker, /size limit/i);
assert.equal("bodySnippet" in oversized, false);

const upstreamError = await acquireTaxCollectorReceipt({ listingUrl: "https://county-approved.test/error" }, {
  env: countyEnv,
  fetchImpl: async () => new Response("UPSTREAM_PRIVATE_ERROR_BODY", {
    status: 500,
    headers: { "content-type": "text/html" },
  }),
});
assert.equal(upstreamError.ok, false);
assert.equal(upstreamError.status, 500);
assert.equal("bodySnippet" in upstreamError, false);
assert.doesNotMatch(JSON.stringify(upstreamError), /UPSTREAM_PRIVATE_ERROR_BODY/);

const timedOut = await acquireTaxCollectorReceipt({ listingUrl: "https://county-approved.test/slow" }, {
  env: countyEnv,
  fetchImpl: async (_input, init = {}) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }),
});
assert.equal(timedOut.ok, false);
assert.match(timedOut.blocker, /timed out/i);
assert.equal("bodySnippet" in timedOut, false);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "estate_facts_drive_public_search",
    "browserbase_function_auth_and_proxy",
    "listing_page_receipt_capture",
    "paid_run_provenance",
    "billing_failure_classification",
    "exact_https_origin_allowlist",
    "manual_redirect_revalidation",
    "unsafe_content_type_rejected",
    "bounded_streaming_body",
    "upstream_error_body_not_exposed",
    "server_fetch_timeout",
  ],
}, null, 2));
