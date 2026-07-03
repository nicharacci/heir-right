const { methodGuard, proxyWorkerJson, readJsonBody, receiptId, sendJson, sendProxied } = require("../_shared");

const discoverySourceLabels = [
  { source: "property_appraiser", label: "Property Appraiser", mode: "public_api" },
  { source: "tax_collector", label: "Tax Collector", mode: "script_or_browser_required" },
  { source: "official_records", label: "Official Records", mode: "commercial_api_or_browser_capture" },
  { source: "probate_court", label: "Probate/Civil/Family Court", mode: "commercial_api_or_browser_capture" },
  { source: "clerk_of_courts", label: "Marriage, death, obituary, and vital review", mode: "browser_workflow_or_source_capture" },
  { source: "idi", label: "IDI Core Asset Search", mode: "paid_api_or_operator_import" },
  { source: "skip_trace", label: "Skip trace/contact enrichment", mode: "paid_manual_approval" },
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

function fallbackSummaries() {
  return discoverySourceLabels.map((item) => ({
    source: item.source,
    label: item.label,
    mode: item.mode,
    status: "blocked",
    factCount: 0,
    extractedFactTypes: [],
    reviewFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    nextAction: `${item.label} source API worker is not configured in this runtime. Keep Discovery blocked until the source run is executed or the operator captures source evidence.`,
  }));
}

async function localWorkerRun(body) {
  const { runDryPipeline } = require("../../../worker/dist/index");
  const seed = sourceRunSeedFromBody(body);
  const pipeline = await runDryPipeline(seed, { env: process.env });
  const sourceFacts = pipeline.facts.filter((fact) => discoverySourceLabels.some((item) => item.source === fact.source));
  const sourceSummaries = summarizeFacts(sourceFacts);
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
    sourceFacts,
    dossier: pipeline.dossier,
    blockers,
    message: blockers.length
      ? "Discovery source APIs ran and returned review blockers. The app did not assume missing public or paid-source facts."
      : "Discovery source APIs returned structured source facts for review.",
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
      sendJson(response, 200, {
        ok: false,
        mode: "external_source_run_unavailable",
        runId: receiptId("source-run"),
        generatedAt: new Date().toISOString(),
        seed: sourceRunSeedFromBody(body),
        sourceSummaries,
        sourceFacts: [],
        blockers: sourceSummaries.map((summary) => summary.nextAction),
        message: "Discovery source API worker is not available in this runtime. The app returned blockers instead of treating external source data as complete.",
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
