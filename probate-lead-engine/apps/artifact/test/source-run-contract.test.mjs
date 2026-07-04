import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const externalSourceRun = require("../api/discovery/external-source-run.js");

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
    proofBySource.get("tax_collector").extractedFactTypes.includes("tax_receipt_link"),
    "Tax Collector proof must preserve the bottom-right receipt link fact"
  );
  assert.match(
    proofBySource.get("official_records").credentialGate,
    /MIAMI_DADE_CLERK_AUTH_KEY/,
    "Official Records proof must expose the credential gate for audit metadata"
  );
  assert.equal(proofBySource.get("idi").proofState, "evidence_required");

  const sourceFacts = result.json.sourceFacts || [];
  assert.ok(
    sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_receipt_link"),
    "source facts must include the Tax Collector receipt link"
  );

  const bundle = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  assert.ok(bundle.includes("What this run proved"));
  assert.ok(bundle.includes("bottom-right receipt link"));
  assert.ok(bundle.includes("Review owner name, folio"));
  assert.ok(bundle.includes("Attach the latest deed"));
  assert.ok(!/Live packet preview/i.test(bundle));
  assert.ok(bundle.includes("grid-template-rows: auto auto minmax(220px, var(--artifact-preview-height)) auto"));
  assert.ok(bundle.includes("max-height: var(--artifact-preview-height)"));

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "all_required_source_buckets",
      "no_discovery_completion_without_blockers_cleared",
      "no_legal_template_autofill",
      "tax_receipt_link_preserved",
      "operator_visible_source_proof_copy",
      "preview_fit_css",
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
