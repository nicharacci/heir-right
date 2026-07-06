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
  const baseSourceRunPayload = {
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
        listingHtml: `
          <main>
            <dl>
              <dt>Paid By</dt><dd>Estate representative</dd>
              <dt>Paid Date</dt><dd>03/14/2025</dd>
              <dt>Amount Due</dt><dd>$1,234.56</dd>
              <dt>Unpaid Years</dt><dd>2024, 2025</dd>
              <dt>Reassessment</dt><dd>No reassessment change shown</dd>
            </dl>
            <aside style="float:right">
              <a class="receipt-link" href="/receipt/2025-paid.pdf">Print receipt</a>
            </aside>
          </main>
        `,
      },
      propertyAppraiser: {
        sourceUrl: "https://www.miamidade.gov/Apps/PA/property/3411330360010",
        mailingAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
      },
      deed: {
        sourceUrl: "https://onlineservices.miamidadeclerk.gov/officialrecords/deed-proof",
        documentUrl: "https://onlineservices.miamidadeclerk.gov/officialrecords/deed-proof.pdf",
        instrument: "2025-0012345",
        book: "34113",
        page: "360",
        recordingDate: "2020-05-11",
        documentType: "Warranty deed",
        grantor: "Prior owner",
        grantee: "Estate of Contract Proof",
        lastSaleDate: "2020-05-11",
        mortgageSignal: "No open mortgage signal in reviewed deed search.",
        lienSignal: "No lien signal in reviewed deed search.",
        lisPendensSignal: "No Lis Pendens signal in reviewed deed search.",
        foreclosureSignal: "No foreclosure signal in reviewed deed search.",
      },
      probate: {
        docketUrl: "https://www2.miamidadeclerk.gov/ocs/case-proof",
        caseNumber: "2025-CP-001234",
        caseStatus: "Open",
        affidavitOfHeirsStatus: "Available for review",
        documentAvailability: "Docket images available",
        docketNumber: "2025-CP-001234",
        caseType: "Probate",
        officialRecordUrl: "https://onlineservices.miamidadeclerk.gov/officialrecords/deed-proof",
      },
      obituary: {
        status: "found",
        sourceUrl: "https://legacy.test/contract-proof-obituary",
        dateOfBirth: "1942-04-10",
        dateOfDeath: "2024-01-02",
        marriageLicenseSignal: "Possible spouse listed in obituary.",
        deathCertificateStatus: "Requested",
      },
    },
    idiAssetImport: {
      provider: "idi",
      importedText: [
        "Spouse: Marie Contract Proof",
        "Phone: 305-555-0199",
        "Address: 20611 NW 33rd Pl, Miami Gardens, FL 33056",
      ].join("\n"),
      attachment: {
        label: "IDI expanded asset search",
        sourceUrl: "idi-report://contract-proof.pdf",
        fileKind: "pdf",
        capturedAt: "2026-07-03T12:00:00.000Z",
        capturedBy: "contract-test",
        reviewFlags: ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"],
      },
      candidates: [{
        id: "idi-candidate-1",
        name: "Marie Contract Proof",
        relationship: "spouse",
        group: "primary",
        phones: ["305-555-0199"],
        emails: [],
        currentAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
        addressHistory: ["20611 NW 33rd Pl, Miami Gardens, FL 33056"],
        ownerLastNameMatch: true,
        confidence: 0.86,
        reviewStatus: "imported",
      }],
      contactReviews: {},
    },
  };

  const result = await callHandler(externalSourceRun, baseSourceRunPayload);

  assert.equal(result.statusCode, 200);
  assert.equal(result.json.mode, "external_source_run");
  assert.equal(result.json.ok, false);
  assert.equal(result.json.sourceRunProof.completionStandard, "proof_or_explicit_blocker");
  assert.equal(result.json.sourceRunProof.allRequiredSourcesAccountedFor, true);
  assert.ok(result.json.sourceRunProof.detailCheckCount >= 20);
  assert.ok(result.json.sourceRunProof.blockingDetailCheckCount > 0);
  assert.equal(result.json.sourceRunProof.unresolvedDetailCheckCount, result.json.sourceRunProof.blockingDetailCheckCount);
  assert.equal(result.json.sourceRunProof.readyForDiscoveryCompletion, false);
  assert.equal(result.json.sourceRunProof.readyForOperatorReview, false);
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
    proofBySource.get("tax_collector").detailChecks.some((check) =>
      check.code === "bottom_right_receipt"
        && check.status === "evidence_returned_review_required"
        && check.satisfiedFactTypes.includes("tax_receipt_link")
    ),
    "Tax Collector bottom-right receipt checklist step must resolve from the captured receipt fact"
  );
  assert.ok(
    proofBySource.get("tax_collector").extractedFactTypes.includes("tax_receipt_link"),
    "Tax Collector proof must preserve the bottom-right receipt link fact"
  );
  assert.equal(proofBySource.get("official_records").proofState, "facts_returned_review_required");
  assert.ok(
    proofBySource.get("official_records").detailChecks.some((check) => check.code === "latest_deed" && check.status === "evidence_returned_review_required"),
    "Official Records latest deed checklist step must resolve from captured deed evidence"
  );
  assert.equal(proofBySource.get("probate_court").proofState, "facts_returned_review_required");
  assert.ok(
    proofBySource.get("probate_court").detailChecks.some((check) => check.code === "case_lookup" && check.status === "evidence_returned_review_required"),
    "Probate case lookup checklist step must resolve from captured docket evidence"
  );
  assert.equal(proofBySource.get("clerk_of_courts").proofState, "facts_returned_review_required");
  assert.ok(
    proofBySource.get("clerk_of_courts").detailChecks.some((check) => check.code === "vital_indicators" && check.status === "evidence_returned_review_required"),
    "Vital indicator checklist step must resolve from captured obituary/vital evidence"
  );
  assert.ok(
    result.json.sourceRunProof.unresolvedDetailCheckCount < result.json.sourceRunProof.detailCheckCount,
    "Captured source evidence must reduce unresolved checklist items without clearing the remaining blockers"
  );
  assert.match(
    proofBySource.get("official_records").credentialGate,
    /Commercial Data Services access/,
    "Official Records proof must expose the operator credential gate for audit metadata"
  );
  for (const source of result.json.sourceRunProof.sources) {
    assert.doesNotMatch(
      String(source.credentialGate || ""),
      /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/,
      "Source proof credential gates must not expose raw environment names"
    );
  }
  assert.equal(proofBySource.get("idi").proofState, "facts_returned_review_required");
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
  assert.ok(
    idiDetails.some((check) =>
      check.code === "idi_report_import"
        && check.status === "evidence_returned_review_required"
        && check.satisfiedFactTypes.includes("idi_asset_search_status")
    ),
    "IDI report import checklist step must resolve from approved imported report evidence"
  );
  assert.ok(
    idiDetails.some((check) =>
      check.code === "idi_paid_run_approval"
        && check.status === "approval_required"
        && !check.resolved
    ),
    "Imported IDI report evidence must not pretend that paid-run approval was separately proven"
  );
  assert.ok(
    idiDetails.some((check) =>
      check.code === "idi_contact_review"
        && check.status === "manual_review_required"
        && !check.resolved
    ),
    "Imported IDI contact candidates must not clear the contact-review gate until accepted or promoted"
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
  assert.ok(
    sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_last_paid_by" && fact.value === "Estate representative"),
    "source facts must parse the Tax Collector paid-by party from listing/receipt page text"
  );
  assert.ok(
    sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_paid_date" && fact.value === "03/14/2025"),
    "source facts must parse the Tax Collector paid date from listing/receipt page text"
  );
  assert.ok(
    sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_amount_due" && fact.value?.amount === 1234.56 && fact.value?.currency === "USD"),
    "source facts must parse the Tax Collector amount due from listing/receipt page text"
  );
  assert.ok(
    sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "unpaid_tax_years" && fact.value?.includes?.(2024) && fact.value?.includes?.(2025)),
    "source facts must parse unpaid Tax Collector years from listing/receipt page text"
  );
  assert.ok(
    sourceFacts.some((fact) => fact.source === "idi" && fact.factType === "idi_asset_report_attachment"),
    "source facts must include the approved IDI report attachment when imported into source-run"
  );
  assert.ok(
    sourceFacts.some((fact) => fact.source === "idi" && fact.factType === "primary_contact_profile" && fact.value?.reviewStatus === "imported"),
    "source facts must include imported IDI contact candidates without pretending they are accepted"
  );

  const acceptedIdiResult = await callHandler(externalSourceRun, {
    ...baseSourceRunPayload,
    idiAssetImport: {
      ...baseSourceRunPayload.idiAssetImport,
      contactReviews: {
        "idi-candidate-1": { status: "accepted" },
      },
    },
  });
  const acceptedIdiProof = new Map(acceptedIdiResult.json.sourceRunProof.sources.map((item) => [item.source, item])).get("idi");
  assert.ok(
    acceptedIdiProof.detailChecks.some((check) =>
      check.code === "idi_contact_review"
        && check.status === "evidence_returned_review_required"
        && check.satisfiedFactTypes.includes("primary_contact_profile")
    ),
    "Accepted IDI contacts must resolve the contact-review detail check without legal-template autofill"
  );
  assert.ok(
    acceptedIdiResult.json.sourceFacts.some((fact) => fact.source === "idi" && fact.factType === "primary_contact_profile" && fact.value?.reviewStatus === "accepted"),
    "Accepted contact-review state must be preserved in source-run facts"
  );

  const previousClerkAuthKey = process.env.MIAMI_DADE_CLERK_AUTH_KEY;
  const previousClerkApiBase = process.env.MIAMI_DADE_CLERK_API_BASE;
  const previousFetch = globalThis.fetch;
  try {
    process.env.MIAMI_DADE_CLERK_AUTH_KEY = "contract-clerk-key";
    process.env.MIAMI_DADE_CLERK_API_BASE = "https://clerk-contract.test/api";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/OfficialRecords")) {
        return Response.json({
          Status: "Success",
          StatusDesc: "OK",
          UnitsBalance: 42,
          OfficialRecordList: {
            OfficialRecords: [{
              DOC_TYPE: "WD",
              REC_DATE: "2025-04-14",
              DOC_DATE: "2025-04-11",
              REC_BOOK: "34113",
              REC_PAGE: "360",
              CFN_YEAR: 2025,
              CFN_SEQ: 12345,
              FIRST_PARTY: "Prior Owner",
              SECOND_PARTY: "Estate of Contract Proof",
              CASE_NUM: "2025-CP-001234",
            }],
          },
        });
      }
      if (url.includes("/Civil") && url.includes("caseNumber=")) {
        return Response.json({
          Status: "Success",
          CaseInfo: {
            caseNumber: "2025-CP-001234",
            caseStatus: "Open",
            caseType: "Probate",
            filingDate: "2025-02-03",
          },
          UnitsBalance: 41,
        });
      }
      if (url.includes("/Civil") && url.includes("civilCaseNumber=")) {
        return Response.json({
          Status: "Success",
          DocketsList: {
            DocketInfo: [{
              eventDate: "2025-03-01",
              docketNumber: "12",
              docketDescrition: "Affidavit of Heirs filed",
              comments: "Image available",
              numberOfDocuments: 1,
            }],
          },
          UnitsBalance: 40,
        });
      }
      return previousFetch(input);
    };
    const clerkResult = await callHandler(externalSourceRun, {
      assetKey: "clerk-commercial-contract-proof",
      estateName: "Estate of Clerk Contract Proof",
      ownerName: "Estate of Clerk Contract Proof",
      propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
      parcelId: "34-1133-036-0010",
      caseNumber: "2025-CP-001234",
      county: "miami-dade",
    });
    const clerkProofBySource = new Map(clerkResult.json.sourceRunProof.sources.map((item) => [item.source, item]));
    assert.equal(clerkProofBySource.get("official_records").proofState, "facts_returned_review_required");
    assert.equal(clerkProofBySource.get("probate_court").proofState, "facts_returned_review_required");
    assert.ok(
      clerkProofBySource.get("official_records").detailChecks.some((check) => check.code === "latest_deed" && check.status === "evidence_returned_review_required"),
      "Configured Clerk Official Records API must resolve latest deed detail from route-level source-run facts"
    );
    assert.ok(
      clerkProofBySource.get("probate_court").detailChecks.some((check) => check.code === "case_lookup" && check.status === "evidence_returned_review_required"),
      "Configured Clerk Civil/Family/Probate API must resolve case lookup detail from route-level source-run facts"
    );
    assert.ok(
      clerkResult.json.sourceFacts.some((fact) => fact.source === "official_records" && fact.factType === "latest_deed" && fact.value?.book === "34113"),
      "Clerk Official Records API route proof must return latest deed details"
    );
    assert.ok(
      clerkResult.json.sourceFacts.some((fact) => fact.source === "probate_court" && fact.factType === "affidavit_of_heirs_status" && /Affidavit/i.test(String(fact.value))),
      "Clerk probate API route proof must return affidavit-of-heirs evidence"
    );
    assert.ok(
      clerkResult.json.sourceFacts
        .filter((fact) => fact.source === "official_records" || fact.source === "probate_court")
        .every((fact) => !String(fact.sourceUrl || "").includes("contract-clerk-key")),
      "Clerk AuthKey must be redacted from stored source URLs"
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousClerkAuthKey === undefined) delete process.env.MIAMI_DADE_CLERK_AUTH_KEY;
    else process.env.MIAMI_DADE_CLERK_AUTH_KEY = previousClerkAuthKey;
    if (previousClerkApiBase === undefined) delete process.env.MIAMI_DADE_CLERK_API_BASE;
    else process.env.MIAMI_DADE_CLERK_API_BASE = previousClerkApiBase;
  }

  const previousBrowserbaseApiKey = process.env.BROWSERBASE_API_KEY;
  const previousTaxBrowserbaseFunction = process.env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID;
  const previousVitalBrowserbaseFunction = process.env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID;
  const previousBrowserbaseApiBase = process.env.BROWSERBASE_API_BASE;
  const previousBrowserbaseFetch = globalThis.fetch;
  try {
    process.env.BROWSERBASE_API_KEY = "contract-browserbase-key";
    process.env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID = "tax-contract-function";
    process.env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID = "vital-contract-function";
    process.env.BROWSERBASE_API_BASE = "https://browserbase-contract.test";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("/v1/functions/tax-contract-function/invoke")) {
        return Response.json({
          id: "inv-tax-contract",
          sessionId: "sess-tax-contract",
          status: "COMPLETED",
          results: {
            listingUrl: "https://miamidade.county-taxes.test/listing/browserbase-contract",
            listingHtml: `
              <dl>
                <dt>Paid By</dt><dd>Maria Browserbase</dd>
                <dt>Paid Date</dt><dd>04/15/2025</dd>
                <dt>Amount Due</dt><dd>$2,345.67</dd>
                <dt>Unpaid Years</dt><dd>2023, 2024</dd>
                <dt>Reassessment</dt><dd>Review reassessment from browser run</dd>
              </dl>
              <aside><a class="receipt-link" href="/receipt/browserbase-paid.pdf">Print receipt</a></aside>
            `,
          },
        }, { status: 202 });
      }
      if (url.includes("/v1/functions/vital-contract-function/invoke")) {
        return Response.json({
          id: "inv-vital-contract",
          sessionId: "sess-vital-contract",
          status: "COMPLETED",
          results: {
            ok: true,
            status: "reviewed-with-source",
            dateOfBirth: "1942-04-10",
            dateOfDeath: "2024-01-02",
            obituaryLink: "https://legacy.test/browserbase-contract-obituary",
            obituarySnapshot: "Obituary names surviving spouse and children for review.",
            marriageLicenseSignal: "Possible spouse signal found.",
            deathCertificateStatus: "Requested, not attached",
          },
        }, { status: 202 });
      }
      return previousBrowserbaseFetch(input);
    };
    const browserbaseResult = await callHandler(externalSourceRun, {
      assetKey: "browserbase-route-contract-proof",
      estateName: "Estate of Browserbase Contract Proof",
      ownerName: "Estate of Browserbase Contract Proof",
      propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
      parcelId: "34-1133-036-0010",
      county: "miami-dade",
    });
    const browserbaseProofBySource = new Map(browserbaseResult.json.sourceRunProof.sources.map((item) => [item.source, item]));
    assert.equal(browserbaseProofBySource.get("tax_collector").proofState, "facts_returned_review_required");
    assert.equal(browserbaseProofBySource.get("clerk_of_courts").proofState, "facts_returned_review_required");
    assert.ok(
      browserbaseProofBySource.get("tax_collector").detailChecks.some((check) => check.code === "bottom_right_receipt" && check.status === "evidence_returned_review_required"),
      "Browserbase Tax Collector route proof must resolve bottom-right receipt detail"
    );
    assert.ok(
      browserbaseProofBySource.get("clerk_of_courts").detailChecks.some((check) => check.code === "vital_indicators" && check.status === "evidence_returned_review_required"),
      "Browserbase vital/obituary route proof must resolve vital-indicator detail"
    );
    assert.ok(
      browserbaseResult.json.sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_receipt_link" && /browserbase-paid/.test(String(fact.value))),
      "Browserbase Tax Collector route proof must return the receipt link fact"
    );
    assert.ok(
      browserbaseResult.json.sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_last_paid_by" && fact.value === "Maria Browserbase"),
      "Browserbase Tax Collector route proof must parse payer detail from returned listing HTML"
    );
    assert.ok(
      browserbaseResult.json.sourceFacts.some((fact) => fact.source === "clerk_of_courts" && fact.factType === "date_of_death" && fact.value === "2024-01-02"),
      "Browserbase vital/obituary route proof must return date-of-death facts"
    );
    assert.ok(
      browserbaseResult.json.sourceFacts
        .filter((fact) => fact.source === "tax_collector" || fact.source === "clerk_of_courts")
        .every((fact) => !String(fact.sourceUrl || "").includes("contract-browserbase-key")),
      "Browserbase API key must not be stored in source URLs"
    );
  } finally {
    globalThis.fetch = previousBrowserbaseFetch;
    if (previousBrowserbaseApiKey === undefined) delete process.env.BROWSERBASE_API_KEY;
    else process.env.BROWSERBASE_API_KEY = previousBrowserbaseApiKey;
    if (previousTaxBrowserbaseFunction === undefined) delete process.env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID;
    else process.env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID = previousTaxBrowserbaseFunction;
    if (previousVitalBrowserbaseFunction === undefined) delete process.env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID;
    else process.env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID = previousVitalBrowserbaseFunction;
    if (previousBrowserbaseApiBase === undefined) delete process.env.BROWSERBASE_API_BASE;
    else process.env.BROWSERBASE_API_BASE = previousBrowserbaseApiBase;
  }

  const artifactReceipt = discoverTaxCollectorReceipt({
    listingUrl: "https://miamidade.county-taxes.test/listing/3411330360010",
    listingHtml: `
      <dl>
        <dt>Paid By</dt><dd>Estate representative</dd>
        <dt>Paid Date</dt><dd>03/14/2025</dd>
        <dt>Amount Due</dt><dd>$1,234.56</dd>
        <dt>Unpaid Years</dt><dd>2024, 2025</dd>
      </dl>
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
  assert.equal(artifactReceipt?.details?.paidBy, "Estate representative");
  assert.equal(artifactReceipt?.details?.paidDate, "03/14/2025");
  assert.equal(artifactReceipt?.details?.amountDue?.amount, 1234.56);
  assert.deepEqual(artifactReceipt?.details?.unpaidYears, [2024, 2025]);

  const bundle = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  assert.ok(bundle.includes("What this run proved"));
  assert.ok(bundle.includes("source checklist item"));
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
    "IDI_CORE_API_TOKEN",
    "HEIRRIGHT_IDI_CORE_API_TOKEN",
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
      "tax_collector_listing_detail_parser",
      "captured_source_facts_reduce_detail_blockers",
      "source_proof_detail_checks",
      "blocking_detail_checks_gate_readiness",
      "idi_core_guardrail_detail_checks",
      "idi_import_and_contact_review_split",
      "clerk_commercial_api_route_fact_mapping",
      "browserbase_source_run_route_fact_mapping",
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
