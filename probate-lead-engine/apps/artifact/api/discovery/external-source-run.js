const { methodGuard, proxyWorkerJson, readJsonBody, receiptId, sendJson, sendProxied } = require("../_shared");

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
  };
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
    const extractedFacts = facts.filter((fact) =>
      factValuePresent(fact.value)
      && !(fact.reviewFlags || []).includes("SOURCE_HEALTH_ONLY")
      && !(fact.reviewFlags || []).some((flag) => String(flag).startsWith("MISSING_"))
    );
    const blocked = flags.includes("SOURCE_BLOCKED")
      || flags.includes("TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED")
      || flags.includes("PAID_SOURCE_APPROVAL_REQUIRED")
      || flags.includes("MISSING_SKIPTRACE_CONFIG");
    const status = blocked ? "blocked" : extractedFacts.length ? "partial" : "needs_review";
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

function sourceRunCredentialGate(source) {
  if (source === "property_appraiser") return "Public county property search";
  if (source === "tax_collector") return "Direct Tax Collector listing URL, TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID, or TAX_COLLECTOR_BROWSER_WORKFLOW_URL";
  if (source === "official_records" || source === "probate_court") return "MIAMI_DADE_CLERK_AUTH_KEY with Clerk Commercial Data Services units";
  if (source === "clerk_of_courts") return "OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID or OBITUARY_VITAL_WORKFLOW_URL";
  if (source === "idi") return "IDI_CORE_API_URL plus shared IDI_CORE_API_KEY and IDI_CORE_LIVE_RUN_APPROVED=true, or approved operator report import";
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
      detailChecks: sourceDetailChecks(source, sourceFacts),
      legalTemplateAutofillAllowed: false,
    };
  });
  const blockedCount = sources.filter((item) => item.proofState === "blocked").length;
  const evidenceRequiredCount = sources.filter((item) => item.proofState === "evidence_required").length;
  return {
    completionStandard: "proof_or_explicit_blocker",
    allRequiredSourcesAccountedFor: discoverySourceLabels.every((item) => sources.some((source) => source.source === item.source)),
    readyForOperatorReview: blockedCount === 0 && evidenceRequiredCount === 0,
    readyForDiscoveryCompletion: false,
    legalTemplateAutofillAllowed: false,
    blockedCount,
    evidenceRequiredCount,
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

async function localWorkerRun(body) {
  const { runDryPipeline } = require("../../../worker/dist/index");
  const seed = sourceRunSeedFromBody(body);
  const pipeline = await runDryPipeline(seed, { env: process.env });
  const sourceFacts = pipeline.facts.filter((fact) => discoverySourceLabels.some((item) => item.source === fact.source));
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
    dossier: pipeline.dossier,
    blockers,
    message: blockers.length
      ? "Discovery source checks ran and returned review blockers. The app did not assume missing public or paid-source facts."
      : "Discovery source checks returned structured source facts for review.",
  };
}

module.exports = async function handler(request, response) {
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
