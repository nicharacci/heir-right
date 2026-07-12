const { methodGuard, proxyWorkerJson, readJsonBody, receiptId, requireApiAuth, sendJson, sendProxied } = require("../_shared");
const { localSourceFactsFromCapture } = require("./source-capture");
const {
  runTaxCollectorReceiptSearch,
  taxCollectorCaptureFromRun,
  withoutTaxCollectorAcquisitionEnv,
} = require("./tax-collector/service");

const discoverySourceLabels = [
  { source: "property_appraiser", label: "Property Appraiser", mode: "public_api" },
  { source: "tax_collector", label: "Tax Collector", mode: "script_or_browser_required" },
  { source: "official_records", label: "Official Records", mode: "commercial_api_or_browser_capture" },
  { source: "probate_court", label: "Probate/Civil/Family Court", mode: "commercial_api_or_browser_capture" },
  { source: "clerk_of_courts", label: "Marriage, death, obituary, and vital review", mode: "browser_workflow_or_source_capture" },
  { source: "idi", label: "IDI Core Asset Search", mode: "paid_api_or_operator_import" },
  { source: "skip_trace", label: "Skip trace/contact enrichment", mode: "paid_manual_approval" },
  { source: "source_governance", label: "Governed manual and paid research", mode: "approval_gated_source_governance" },
];

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sourceRunSeedFromBody(body = {}) {
  const seed = body.seed && typeof body.seed === "object" ? body.seed : {};
  const capture = body.capture && typeof body.capture === "object" ? body.capture : body;
  const taxReceipt = capture.taxReceipt && typeof capture.taxReceipt === "object" ? capture.taxReceipt : {};
  const confirmedSourceFacts = Array.isArray(seed.confirmedSourceFacts)
    ? seed.confirmedSourceFacts
    : Array.isArray(body.confirmedSourceFacts) ? body.confirmedSourceFacts : undefined;
  return {
    ownerName: stringValue(seed.ownerName) || stringValue(body.ownerName) || stringValue(body.owner) || "Fresh public-source lead",
    estateName: stringValue(seed.estateName) || stringValue(body.estateName) || undefined,
    propertyAddress: stringValue(seed.propertyAddress) || stringValue(body.propertyAddress) || stringValue(body.address) || "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    caseNumber: stringValue(seed.caseNumber) || stringValue(body.caseNumber) || undefined,
    county: stringValue(seed.county) || stringValue(body.county) || "miami-dade",
    parcelId: stringValue(seed.parcelId) || stringValue(body.parcelId) || stringValue(body.folio) || undefined,
    taxCollectorListingUrl: stringValue(seed.taxCollectorListingUrl) || stringValue(taxReceipt.listingUrl) || undefined,
    taxCollectorReceiptUrl: stringValue(seed.taxCollectorReceiptUrl) || stringValue(taxReceipt.receiptLink) || stringValue(taxReceipt.receiptUrl) || undefined,
    source: "operator_cli",
    includeDealMath: false,
    includeSkipTrace: body.includeSkipTrace === true,
    ...(confirmedSourceFacts ? { confirmedSourceFacts } : {}),
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function idiAssetImportInputFromBody(body = {}) {
  const capture = objectValue(body.capture);
  const input = objectValue(body.idiAssetImport || body.idiImport || capture.idiAssetImport || capture.idiImport);
  const importedText = stringValue(input.importedText || body.idiImportedText);
  const attachment = objectValue(input.attachment);
  const sourceUrl = stringValue(attachment.sourceUrl || input.sourceUrl || input.reportSourceUrl);
  if (!importedText && !sourceUrl && !Array.isArray(input.candidates)) return null;
  return {
    provider: stringValue(input.provider) || "idi",
    mode: stringValue(input.mode) || undefined,
    paidRun: input.paidRun === true,
    paidRunApproved: input.paidRunApproved === true,
    approvalRecord: input.approvalRecord || undefined,
    readbackStatus: stringValue(input.readbackStatus) || undefined,
    apiKeySource: stringValue(input.apiKeySource) || undefined,
    importedText,
    candidates: Array.isArray(input.candidates) ? input.candidates : undefined,
    contactReviews: objectValue(input.contactReviews || body.contactReviews),
    capturedBy: stringValue(input.capturedBy || body.capturedBy) || undefined,
    adminOverrideReason: stringValue(input.adminOverrideReason) || undefined,
    attachment: {
      label: stringValue(attachment.label || input.label) || "IDI expanded asset search",
      sourceUrl: sourceUrl || undefined,
      fileKind: stringValue(attachment.fileKind || input.fileKind) || (sourceUrl ? "link" : "text"),
      fileName: stringValue(attachment.fileName || input.fileName) || undefined,
      capturedAt: stringValue(attachment.capturedAt) || new Date().toISOString(),
      capturedBy: stringValue(attachment.capturedBy || input.capturedBy || body.capturedBy) || undefined,
      reviewFlags: Array.isArray(attachment.reviewFlags) ? attachment.reviewFlags : ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"],
    },
  };
}

function idiAssetImportFactsFromBody(runId, seed, body = {}) {
  const input = idiAssetImportInputFromBody(body);
  if (!input) return [];
  const { buildIdiAssetSearchFacts } = require("../../../worker/dist/enrichment/idi-asset-search");
  return buildIdiAssetSearchFacts(runId, seed, input);
}

function factValuePresent(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function summarizeFacts(sourceFacts) {
  return discoverySourceLabels.map((item) => {
    const facts = sourceFacts.filter((fact) => fact.source === item.source);
    const flags = [...new Set(facts.flatMap((fact) => fact.reviewFlags || []))];
    const sourceStatusFact = facts.find((fact) => fact.factType === "source_status")
      || facts.find((fact) => String(fact.factType || "").endsWith("_status"));
    const extractedFacts = sourceEvidenceFacts(facts);
    const blocked = flags.includes("SOURCE_BLOCKED")
      || flags.includes("TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED")
      || flags.includes("PAID_SOURCE_APPROVAL_REQUIRED")
      || flags.includes("MISSING_SKIPTRACE_CONFIG");
    const status = blocked && !extractedFacts.length ? "blocked" : extractedFacts.length ? "partial" : "needs_review";
    return {
      source: item.source,
      label: item.label,
      mode: item.mode,
      status,
      factCount: facts.length,
      extractedFactTypes: [...new Set(extractedFacts.map((fact) => fact.factType))],
      reviewFlags: flags,
      nextAction: sourceStatusFact?.value && typeof sourceStatusFact.value === "object" && "note" in sourceStatusFact.value
        ? String(sourceStatusFact.value.note || "")
        : blocked
          ? `${item.label} needs source access or browser/operator review before Discovery can treat it as complete.`
          : extractedFacts.length
            ? `${item.label} returned structured facts; review and keep source evidence attached.`
            : `${item.label} still needs source evidence before Discovery can treat it as complete.`,
    };
  });
}

function sourceFactHasBlockingFlag(fact) {
  return (fact.reviewFlags || []).some((flag) =>
    flag === "SOURCE_HEALTH_ONLY"
      || flag === "SOURCE_BLOCKED"
      || flag === "PAID_SOURCE_APPROVAL_REQUIRED"
      || flag === "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED"
      || flag === "MISSING_SKIPTRACE_CONFIG"
      || String(flag).startsWith("MISSING_")
  );
}

function sourceEvidenceFacts(facts = []) {
  return facts.filter((fact) =>
    factValuePresent(fact.value)
      && fact.factType !== "source_status"
      && fact.factType !== "source_search_url"
      && !sourceFactHasBlockingFlag(fact)
  );
}

function sourceRunCredentialGate(source) {
  if (source === "property_appraiser") return "Public county property search";
  if (source === "tax_collector") return "Direct Tax Collector listing, approved Browserbase capture, or saved browser workflow";
  if (source === "official_records" || source === "probate_court") return "Miami-Dade Clerk Commercial Data Services access with prepaid units";
  if (source === "clerk_of_courts") return "Approved Browserbase vital-source capture or saved vital-source workflow";
  if (source === "idi") return "IDI Core vendor API access with shared team approval, personal approved key, or approved operator report import";
  if (source === "skip_trace") return "Approved skip-trace provider plus operator approval";
  if (source === "source_governance") return "Operator approval for manual, paid, voter, social, license, business/address, and field research";
  return "Source-specific evidence or operator review";
}

function sourceProofState(status) {
  if (status === "blocked") return "blocked";
  if (status === "needs_review") return "evidence_required";
  if (status === "partial") return "facts_returned_review_required";
  return "not_checked";
}

function governanceCatalogFromFacts(sourceFacts = []) {
  const fact = sourceFacts.find((item) =>
    item.source === "source_governance"
      && item.factType === "source_governance_catalog"
      && item.value
      && typeof item.value === "object"
  );
  return fact?.value && typeof fact.value === "object" ? fact.value : null;
}

function sourceDetailChecks(source, sourceFacts = []) {
  const catalog = governanceCatalogFromFacts(sourceFacts);
  if (!catalog) return [];
  const publicContracts = Array.isArray(catalog.publicSourceContracts) ? catalog.publicSourceContracts : [];
  const governedSources = Array.isArray(catalog.governedSources) ? catalog.governedSources : [];
  const manualTasks = Array.isArray(catalog.manualTasks) ? catalog.manualTasks : [];
  const contract = publicContracts.find((item) => item && item.source === source);
  const checks = [];
  if (contract && Array.isArray(contract.stages)) {
    checks.push(...contract.stages.map((stage) => ({
      code: stage.code,
      label: stage.title,
      type: "source_evidence_step",
      accessClass: contract.accessClass,
      status: stage.blocksUntilCaptured ? "evidence_required" : "review_required",
      operatorAction: stage.operatorAction,
      requiredEvidence: Array.isArray(stage.requiredEvidence) ? stage.requiredEvidence : [],
      blocksUntilCaptured: Boolean(stage.blocksUntilCaptured),
      automationAllowed: Boolean(contract.automationAllowed),
      legalTemplateAutofillAllowed: false,
    })));
  }
  if (source === "idi") {
    checks.push(
      {
        code: "idi_access_mode",
        label: "Confirm IDI access mode",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Use team backend access when configured, paste a personal approved key for one run, or open idiCORE and import the approved report.",
        requiredEvidence: ["approved IDI access mode", "review-owner approval"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_paid_run_approval",
        label: "Approve paid asset search",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Run one paid asset search by property address only after the review owner approves the lookup.",
        requiredEvidence: ["approval record", "property address search target"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_duplicate_guard",
        label: "Confirm first-run lock",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Do not rerun the paid search unless an admin override reason is recorded.",
        requiredEvidence: ["lock/readback status", "override reason if rerun"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_report_import",
        label: "Import approved report evidence",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "evidence_required",
        operatorAction: "Import the approved report text or attachment metadata when backend live access is not ready.",
        requiredEvidence: ["IDI report PDF/source note", "import timestamp/readback"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_contact_review",
        label: "Review IDI contact candidates",
        type: "contact_review_gate",
        accessClass: "paid_approval_gated",
        status: "manual_review_required",
        operatorAction: "Accept spouse, children, relatives, and associates before Discovery or Closing Prep can use contact facts.",
        requiredEvidence: ["accepted contact candidates", "reviewer attribution"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
    );
  }
  if (source === "skip_trace") {
    checks.push(
      {
        code: "skiptrace_provider_access",
        label: "Confirm skip-trace provider access",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Connect an approved provider or leave skip trace blocked; do not substitute unreviewed contact data.",
        requiredEvidence: ["provider access approval", "source terms/storage approval"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "skiptrace_contact_review",
        label: "Review skip-trace contacts",
        type: "contact_review_gate",
        accessClass: "paid_approval_gated",
        status: "manual_review_required",
        operatorAction: "Review phones, emails, and addresses before they can influence outreach or Discovery completion.",
        requiredEvidence: ["accepted contact candidates", "reviewer attribution"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
    );
  }
  if (source === "source_governance") {
    checks.push(...governedSources.map((item) => ({
      code: item.code,
      label: item.label,
      type: "governed_source",
      accessClass: item.accessClass,
      status: item.accessClass === "paid_approval_gated" ? "approval_required" : "manual_review_required",
      operatorAction: item.reason,
      requiredEvidence: ["source link, reviewed-not-found note, or approval record"],
      blocksUntilCaptured: false,
      automationAllowed: Boolean(item.automationAllowed),
      storageApproved: Boolean(item.storageApproved),
      legalTemplateAutofillAllowed: false,
    })));
    checks.push(...manualTasks.map((task) => ({
      code: task.code,
      label: task.title,
      type: "manual_task",
      accessClass: task.accessClass,
      status: "manual_review_required",
      operatorAction: task.description,
      requiredEvidence: ["operator note, source link, photo, or reviewed-not-found note"],
      blocksUntilCaptured: false,
      automationAllowed: false,
      storageApproved: false,
      legalTemplateAutofillAllowed: false,
    })));
  }
  return checks;
}

const detailEvidenceFactTypes = {
  owner_type: ["owner_type", "property_owner", "property_folio"],
  mailing_address: ["mailing_address", "mailing_address_signal"],
  tax_search: ["tax_history_status", "tax_receipt_status", "tax_receipt_link"],
  listing_page: ["tax_receipt_status", "tax_receipt_link"],
  bottom_right_receipt: ["tax_receipt_link", "tax_receipt_attachment"],
  payer_review: ["tax_last_paid_by", "tax_payer_identity", "tax_paid_date", "tax_amount_due", "unpaid_tax_years", "tax_reassessment_signal"],
  latest_deed: ["latest_deed", "deed_attachment", "or_book_page"],
  title_friction: ["title_signal", "ownership_activity_note", "mortgage_signal", "lien_signal", "lis_pendens_signal", "foreclosure_signal", "adverse_possession_signal"],
  recent_sale_stop: ["last_sale_date"],
  case_lookup: ["case_number", "probate_case_status", "civil_family_docket_ref", "probate_docket_status"],
  affidavit_documents: ["affidavit_of_heirs_status", "probate_document_availability"],
  or_cross_link: ["official_record_cross_link"],
  obituary_search: ["obituary_link", "obituary_snapshot", "marriage_death_status", "memorial_search_tasks"],
  vital_indicators: ["date_of_birth", "date_of_death", "marriage_license_signal", "death_certificate_status", "incarceration_status_signal"],
  idi_access_mode: ["idi_asset_search_status", "idi_asset_report_attachment"],
  idi_paid_run_approval: ["idi_asset_search_status"],
  idi_duplicate_guard: ["idi_asset_search_status"],
  idi_report_import: ["idi_asset_search_status", "idi_asset_report_attachment"],
  idi_contact_review: ["primary_contact_profile", "alternative_contact_profile"],
  skiptrace_provider_access: ["skip_trace_status"],
  skiptrace_contact_review: ["enriched_contact_profile"],
};

function sourceStatusEvidence(source, code, facts = []) {
  const statuses = facts.filter((fact) => fact.source === source && fact.factType === "source_status" && factValuePresent(fact.value));
  return statuses.filter((fact) => {
    if (sourceFactHasBlockingFlag(fact)) return false;
    const value = fact.value && typeof fact.value === "object" ? fact.value : {};
    if (code === "tax_search" || code === "listing_page") return Boolean(value.listingUrl || value.receiptUrl || value.ok);
    if (code === "case_lookup") return Boolean(value.caseStatus || value.caseType || value.docketCount || value.ok);
    return Boolean(value.ok);
  });
}

function satisfiedEvidenceForCheck(source, check, sourceFacts = []) {
  const codes = detailEvidenceFactTypes[check.code] || [];
  const facts = sourceFacts.filter((fact) => fact.source === source);
  const checkCode = String(check.code || "");
  const byFactType = facts.filter((fact) =>
    codes.includes(fact.factType)
      && factValuePresent(fact.value)
      && !sourceFactHasBlockingFlag(fact)
      && (checkCode !== "idi_contact_review" || ["accepted", "promoted"].includes(String(fact.value?.reviewStatus || "")))
      && (checkCode !== "idi_paid_run_approval" || Boolean(fact.value?.paidRunApproved || fact.value?.approvalRecord || fact.value?.paidRun === true))
  );
  const statusFacts = sourceStatusEvidence(source, check.code, facts);
  return [...byFactType, ...statusFacts].map((fact) => ({
    factType: fact.factType,
    sourceUrl: fact.sourceUrl || fact.attachment?.sourceUrl || undefined,
    rawId: fact.rawId,
  }));
}

function applySourceDetailEvidence(source, check, sourceFacts = []) {
  const satisfiedBy = satisfiedEvidenceForCheck(source, check, sourceFacts);
  if (!satisfiedBy.length) return check;
  return {
    ...check,
    status: "evidence_returned_review_required",
    resolved: true,
    satisfiedFactTypes: [...new Set(satisfiedBy.map((fact) => fact.factType))],
    satisfiedBy,
    legalTemplateAutofillAllowed: false,
  };
}

function detailCheckBlocks(check) {
  const status = String(check?.status || "");
  return Boolean(check?.blocksUntilCaptured)
    && !["evidence_returned_review_required", "ready_for_review", "complete", "completed"].includes(status);
}

function sourceRunProofLedger(sourceSummaries, sourceFacts = []) {
  const sources = sourceSummaries.map((summary) => {
    const source = String(summary.source || "");
    const status = String(summary.status || "not_checked");
    const proofState = sourceProofState(status);
    const factCount = Number(summary.factCount || 0);
    return {
      source,
      label: summary.label,
      mode: summary.mode,
      status,
      proofState,
      completionGate: proofState === "facts_returned_review_required" ? "operator_review_required" : "blocked",
      credentialGate: sourceRunCredentialGate(source),
      factCount,
      extractedFactTypes: summary.extractedFactTypes,
      reviewFlags: summary.reviewFlags,
      nextAction: summary.nextAction,
      detailChecks: sourceDetailChecks(source, sourceFacts).map((check) => applySourceDetailEvidence(source, check, sourceFacts)),
      legalTemplateAutofillAllowed: false,
    };
  });
  const blockedCount = sources.filter((item) => item.proofState === "blocked").length;
  const evidenceRequiredCount = sources.filter((item) => item.proofState === "evidence_required").length;
  const detailCheckCount = sources.reduce((total, item) => total + (Array.isArray(item.detailChecks) ? item.detailChecks.length : 0), 0);
  const blockingDetailCheckCount = sources.reduce((total, item) =>
    total + (Array.isArray(item.detailChecks) ? item.detailChecks.filter(detailCheckBlocks).length : 0), 0);
  return {
    completionStandard: "proof_or_explicit_blocker",
    allRequiredSourcesAccountedFor: discoverySourceLabels.every((item) => sources.some((source) => source.source === item.source)),
    readyForOperatorReview: blockedCount === 0 && evidenceRequiredCount === 0 && blockingDetailCheckCount === 0,
    readyForDiscoveryCompletion: false,
    legalTemplateAutofillAllowed: false,
    blockedCount,
    evidenceRequiredCount,
    detailCheckCount,
    blockingDetailCheckCount,
    unresolvedDetailCheckCount: blockingDetailCheckCount,
    factsReturnedCount: sources.filter((item) => item.factCount > 0).length,
    sources,
  };
}

function fallbackSummaries() {
  return discoverySourceLabels.map((item) => ({
    source: item.source,
    label: item.label,
    mode: item.mode,
    status: "blocked",
    factCount: 0,
    extractedFactTypes: [],
    reviewFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    nextAction: `${item.label} source-run worker is not configured in this runtime. Keep Discovery blocked until the source run is executed or the operator captures source evidence.`,
  }));
}

function mergeTaxCollectorCapture(capture = {}, taxReceiptRun = null) {
  if (!taxReceiptRun) return capture;
  const runCapture = taxCollectorCaptureFromRun(taxReceiptRun);
  return {
    ...capture,
    taxReceipt: {
      ...(capture.taxReceipt || {}),
      ...runCapture,
    },
  };
}

async function maybeRunTaxCollectorReceipt(body, seed) {
  const capture = body.capture && typeof body.capture === "object" ? body.capture : body;
  const existingReceipt = capture?.taxReceipt?.receiptLink || capture?.taxReceipt?.receiptUrl || capture?.taxReceipt?.sourceUrl;
  const existingListingHtml = capture?.taxReceipt?.listingHtml;
  const hasPriorFacts = seed.parcelId || seed.propertyAddress || seed.ownerName || existingListingHtml || existingReceipt;
  if (!hasPriorFacts) return null;
  return runTaxCollectorReceiptSearch({
    ...body,
    capture,
    seed,
  });
}

function mergeConfirmedFacts(seed, facts = []) {
  if (!facts.length) return seed;
  return {
    ...seed,
    confirmedSourceFacts: [
      ...(Array.isArray(seed.confirmedSourceFacts) ? seed.confirmedSourceFacts : []),
      ...facts,
    ],
  };
}

async function localWorkerRun(body) {
  const { runDryPipeline } = require("../../../worker/dist/index");
  const baseSeed = sourceRunSeedFromBody(body);
  const taxCollectorReceiptRun = await maybeRunTaxCollectorReceipt(body, baseSeed);
  const seed = mergeConfirmedFacts(baseSeed, taxCollectorReceiptRun?.sourceFacts || []);
  const workerEnv = taxCollectorReceiptRun ? withoutTaxCollectorAcquisitionEnv(process.env) : process.env;
  const pipeline = await runDryPipeline(seed, { env: workerEnv });
  const baseCapture = body.capture && typeof body.capture === "object" ? body.capture : body;
  const capture = mergeTaxCollectorCapture(baseCapture, taxCollectorReceiptRun);
  const capturedSourceFacts = typeof localSourceFactsFromCapture === "function"
    ? localSourceFactsFromCapture({ ...capture, seed, runId: pipeline.runId })
    : [];
  const sourceFacts = [
    ...pipeline.facts,
    ...capturedSourceFacts,
    ...idiAssetImportFactsFromBody(pipeline.runId, seed, body),
  ].filter((fact) => discoverySourceLabels.some((item) => item.source === fact.source));
  const sourceSummaries = summarizeFacts(sourceFacts);
  const sourceRunProof = sourceRunProofLedger(sourceSummaries, sourceFacts);
  const blockers = [...new Set([
    ...sourceSummaries
      .filter((summary) => summary.status === "blocked" || summary.status === "needs_review")
      .map((summary) => summary.nextAction),
    ...(pipeline.dossier.audit.reviewFlags.includes("SOURCE_BLOCKED")
      ? ["One or more Discovery sources are blocked; keep the packet in review."]
      : []),
  ])];
  return {
    ok: blockers.length === 0,
    mode: "external_source_run",
    runId: pipeline.runId,
    estateId: body.assetKey || seed.estateName || seed.propertyAddress || seed.parcelId || receiptId("source-run"),
    generatedAt: new Date().toISOString(),
    seed,
    sourceSummaries,
    sourceRunProof,
    sourceFacts,
    taxCollectorReceiptRun,
    dossier: pipeline.dossier,
    blockers,
    message: blockers.length
      ? "Discovery source checks ran and returned review blockers. The app did not assume missing public or paid-source facts."
      : "Discovery source checks returned structured source facts for review.",
  };
}

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/discovery/external-source-run", body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }

    try {
      sendJson(response, 200, await localWorkerRun(body));
      return;
    } catch (error) {
      const sourceSummaries = fallbackSummaries();
      const sourceRunProof = sourceRunProofLedger(sourceSummaries);
      sendJson(response, 200, {
        ok: false,
        mode: "external_source_run_unavailable",
        runId: receiptId("source-run"),
        generatedAt: new Date().toISOString(),
        seed: sourceRunSeedFromBody(body),
        sourceSummaries,
        sourceRunProof,
        sourceFacts: [],
        blockers: sourceSummaries.map((summary) => summary.nextAction),
        message: "Discovery source-run worker is not available in this runtime. The app returned blockers instead of treating external source data as complete.",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "External source run failed before any source could be checked.",
    });
  }
};
