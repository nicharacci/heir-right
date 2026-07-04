import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const externalSourceRun = require("../api/discovery/external-source-run.js");
const { discoverTaxCollectorReceipt } = require("../api/_shared.js");

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

const previousWorkerUrl = process.env.HEIRRIGHT_WORKER_URL;
const previousWorkerApiUrl = process.env.WORKER_API_URL;
const previousWorkerBaseUrl = process.env.WORKER_BASE_URL;
delete process.env.HEIRRIGHT_WORKER_URL;
delete process.env.WORKER_API_URL;
delete process.env.WORKER_BASE_URL;

try {
  const result = await callHandler(externalSourceRun, {
    assetKey: "source-run-contract-proof",
    estateName: "Estate of Contract Proof",
    ownerName: "Estate of Contract Proof",
    propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    parcelId: "34-1133-036-0010",
    county: "miami-dade",
    capture: {
      taxReceipt: {
        listingUrl: "https://miamidade.county-taxes.test/listing/3411330360010",
        receiptLink: "https://miamidade.county-taxes.test/receipt/2025-paid.pdf",
      },
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.mode, "external_source_run");
  assert.equal(result.json.ok, false);
  assert.equal(result.json.sourceRunProof.completionStandard, "proof_or_explicit_blocker");
  assert.equal(result.json.sourceRunProof.allRequiredSourcesAccountedFor, true);
  assert.equal(result.json.sourceRunProof.readyForDiscoveryCompletion, false);
  assert.equal(result.json.sourceRunProof.legalTemplateAutofillAllowed, false);
  assert.ok(result.json.sourceRunProof.blockedCount > 0 || result.json.sourceRunProof.evidenceRequiredCount > 0);
  assert.ok(Array.isArray(result.json.blockers) && result.json.blockers.length > 0);
  assert.doesNotMatch(
    result.json.message,
    /source APIs/i,
    "Source-run response must not imply every Discovery source is an API."
  );

  const requiredSources = [
    "property_appraiser",
    "tax_collector",
    "official_records",
    "probate_court",
    "clerk_of_courts",
    "idi",
    "skip_trace",
    "source_governance",
  ];
  const proofBySource = new Map(result.json.sourceRunProof.sources.map((item) => [item.source, item]));
  for (const source of requiredSources) {
    assert.ok(proofBySource.has(source), `${source} proof row missing`);
    assert.equal(proofBySource.get(source).legalTemplateAutofillAllowed, false, `${source} must not allow legal autofill`);
  }

  assert.equal(proofBySource.get("tax_collector").proofState, "facts_returned_review_required");
  assert.ok(
    proofBySource.get("tax_collector").detailChecks.some((check) => check.code === "bottom_right_receipt" && check.blocksUntilCaptured === true),
    "Tax Collector proof must expose the bottom-right receipt checklist step"
  );
  assert.ok(
    proofBySource.get("tax_collector").extractedFactTypes.includes("tax_receipt_link"),
    "Tax Collector proof must preserve the bottom-right receipt link fact"
  );
  assert.match(
    proofBySource.get("official_records").credentialGate,
    /MIAMI_DADE_CLERK_AUTH_KEY/,
    "Official Records proof must expose the credential gate for audit metadata"
  );
  assert.equal(proofBySource.get("idi").proofState, "evidence_required");
  const idiDetails = proofBySource.get("idi").detailChecks || [];
  const idiCodes = new Set(idiDetails.map((check) => check.code));
  for (const code of [
    "idi_access_mode",
    "idi_paid_run_approval",
    "idi_duplicate_guard",
    "idi_report_import",
    "idi_contact_review",
  ]) {
    assert.ok(idiCodes.has(code), `IDI proof detail ${code} missing`);
  }
  assert.ok(
    idiDetails.every((check) => check.legalTemplateAutofillAllowed === false && check.automationAllowed === false),
    "IDI source detail checks must stay approval-gated and never allow legal autofill"
  );
  const skipTraceDetails = proofBySource.get("skip_trace").detailChecks || [];
  const skipTraceCodes = new Set(skipTraceDetails.map((check) => check.code));
  assert.ok(skipTraceCodes.has("skiptrace_provider_access"), "Skip-trace provider access detail missing");
  assert.ok(skipTraceCodes.has("skiptrace_contact_review"), "Skip-trace contact review detail missing");
  const governanceDetails = proofBySource.get("source_governance").detailChecks || [];
  const governanceCodes = new Set(governanceDetails.map((check) => check.code));
  for (const code of [
    "idi",
    "intelius",
    "ancestry",
    "voter_records",
    "professional_licenses",
    "business_address_associations",
    "social_profiles",
    "deceased_indicator_crosscheck",
    "DOOR_KNOCK",
    "NEIGHBOR_RESEARCH",
    "CODE_ENFORCEMENT",
  ]) {
    assert.ok(governanceCodes.has(code), `Governed source proof detail ${code} missing`);
  }
  assert.ok(
    governanceDetails.every((check) => check.legalTemplateAutofillAllowed === false),
    "Governed source detail checks must never allow legal autofill"
  );

  const sourceFacts = result.json.sourceFacts || [];
  assert.ok(
    sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_receipt_link"),
    "source facts must include the Tax Collector receipt link"
  );
  const artifactReceipt = discoverTaxCollectorReceipt({
    listingUrl: "https://miamidade.county-taxes.test/listing/3411330360010",
    listingHtml: `
      <main>
        <a href="/payments/history">Payment history</a>
        <aside style="float:right">
          <a class="receipt-link" href="/receipts/2025-artifact.pdf">Print receipt</a>
        </aside>
      </main>
      <footer><a href="/payments/history?footer=1">Payment history</a></footer>
    `,
  });
  assert.equal(artifactReceipt?.mode, "listing_page_bottom_right");
  assert.equal(
    artifactReceipt?.receiptUrl,
    "https://miamidade.county-taxes.test/receipts/2025-artifact.pdf",
    "artifact source-capture helper must prefer the listing-card receipt over footer payment links"
  );

  const bundle = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  assert.ok(bundle.includes("What this run proved"));
  assert.ok(bundle.includes("bottom-right receipt link"));
  assert.ok(bundle.includes("source-proof-detail-list"));
  assert.ok(bundle.includes("Review owner name, folio"));
  assert.ok(bundle.includes("Attach the latest deed"));
  assert.ok(!/Live packet preview/i.test(bundle));
  assert.ok(bundle.includes("grid-template-rows: auto auto minmax(220px, var(--artifact-preview-height)) auto"));
  assert.ok(bundle.includes("max-height: var(--artifact-preview-height)"));

  const turbo = JSON.parse(readFileSync(new URL("../../../turbo.json", import.meta.url), "utf8"));
  const trackedEnv = new Set(turbo.globalEnv || []);
  const sourceAcquisitionEnv = [
    "WORKER_API_URL",
    "WORKER_BASE_URL",
    "IDI_CORE_API_URL",
    "IDI_CORE_API_KEY",
    "IDI_CORE_LIVE_RUN_APPROVED",
    "IDI_CORE_LOGIN_URL",
    "IDI_CORE_PORTAL_URL",
    "IDI_CORE_SEARCH_URL",
    "IDI_CORE_ACCOUNT_ID",
    "IDI_CORE_ACCOUNT_COMPANY",
    "IDI_CORE_OPERATOR_EMAIL",
    "BROWSERBASE_API_KEY",
    "BROWSERBASE_PROJECT_ID",
    "BROWSERBASE_API_BASE",
    "TAX_COLLECTOR_LISTING_URL",
    "TAX_COLLECTOR_LISTING_URL_TEMPLATE",
    "TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED",
    "TAX_COLLECTOR_SEARCH_URL",
    "TAX_COLLECTOR_BROWSER_WORKFLOW_URL",
    "TAX_COLLECTOR_BROWSER_WORKFLOW_TOKEN",
    "TAX_COLLECTOR_BROWSER_WORKFLOW_ENABLED",
    "TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID",
    "BROWSERBASE_TAX_COLLECTOR_FUNCTION_ID",
    "MIAMI_DADE_CLERK_AUTH_KEY",
    "MIAMI_DADE_COMMERCIAL_AUTH_KEY",
    "CLERK_COMMERCIAL_AUTH_KEY",
    "MIAMI_DADE_CLERK_API_BASE",
    "OBITUARY_VITAL_WORKFLOW_URL",
    "OBITUARY_VITAL_WORKFLOW_TOKEN",
    "VITAL_OBITUARY_WORKFLOW_URL",
    "MARRIAGE_DEATH_WORKFLOW_URL",
    "OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID",
    "VITAL_OBITUARY_BROWSERBASE_FUNCTION_ID",
    "MARRIAGE_DEATH_BROWSERBASE_FUNCTION_ID",
    "BROWSERBASE_VITAL_OBITUARY_FUNCTION_ID",
  ];
  const missingEnv = sourceAcquisitionEnv.filter((key) => !trackedEnv.has(key));
  assert.deepEqual(missingEnv, [], "Turbo must track source-acquisition env vars so proof does not reuse stale cached output.");

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "all_required_source_buckets",
      "no_discovery_completion_without_blockers_cleared",
      "no_legal_template_autofill",
      "tax_receipt_link_preserved",
      "source_proof_detail_checks",
      "idi_core_guardrail_detail_checks",
      "governed_manual_and_paid_sources_visible",
      "operator_visible_source_proof_copy",
      "preview_fit_css",
      "source_acquisition_env_cache_key",
    ],
  }, null, 2));
} finally {
  if (previousWorkerUrl === undefined) delete process.env.HEIRRIGHT_WORKER_URL;
  else process.env.HEIRRIGHT_WORKER_URL = previousWorkerUrl;
  if (previousWorkerApiUrl === undefined) delete process.env.WORKER_API_URL;
  else process.env.WORKER_API_URL = previousWorkerApiUrl;
  if (previousWorkerBaseUrl === undefined) delete process.env.WORKER_BASE_URL;
  else process.env.WORKER_BASE_URL = previousWorkerBaseUrl;
}
