const { discoverTaxCollectorReceipt, extractTaxCollectorDetails, receiptId } = require("../../_shared");

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function compactObject(input = {}) {
  const output = Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }));
  return Object.keys(output).length ? output : undefined;
}

const BROWSERBASE_BATCH_APPROVAL_MARKER = "approved_paid_browserbase_batch_run";

function truthyEnv(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function positiveIntegerEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function browserbaseBatchEstateCount(body = {}) {
  if (Array.isArray(body.estates)) return body.estates.length;
  if (Array.isArray(body.rows)) return body.rows.length;
  if (Array.isArray(body.items)) return body.items.length;
  if (Number(body.estateCount) > 0) return Math.floor(Number(body.estateCount));
  if (Number(body.count) > 0) return Math.floor(Number(body.count));
  return 1;
}

function browserbaseBatchRequested(body = {}) {
  return body.batch === true
    || body.isBatch === true
    || body.batchRun === true
    || String(body.mode || "").toLowerCase() === "batch"
    || browserbaseBatchEstateCount(body) > 1;
}

function browserbaseBatchApproved(body = {}, env = process.env) {
  return truthyEnv(env.BROWSERBASE_BATCH_RUN_APPROVED)
    || body.browserbaseUsageApproval === BROWSERBASE_BATCH_APPROVAL_MARKER
    || body.browserbaseBatchApproval === BROWSERBASE_BATCH_APPROVAL_MARKER
    || body.approvalMarker === BROWSERBASE_BATCH_APPROVAL_MARKER;
}

function browserbaseBatchGuard(body = {}, env = process.env) {
  if (!browserbaseBatchRequested(body)) return null;
  const maxBatchSessions = positiveIntegerEnv(env.BROWSERBASE_BATCH_MAX_SESSIONS, 10);
  const batchCount = browserbaseBatchEstateCount(body);
  if (batchCount > maxBatchSessions) {
    return {
      code: "BROWSERBASE_BATCH_LIMIT_EXCEEDED",
      batchCount,
      maxBatchSessions,
      message: `Browserbase batch source runs are capped at ${maxBatchSessions} estates per approval. Split this batch before running paid browser capture.`,
    };
  }
  const approvalRequired = env.BROWSERBASE_BATCH_APPROVAL_REQUIRED !== "false";
  if (approvalRequired && !browserbaseBatchApproved(body, env)) {
    return {
      code: "BROWSERBASE_BATCH_APPROVAL_REQUIRED",
      batchCount,
      maxBatchSessions,
      message: "Browserbase paid batch source runs need explicit batch approval before Tax Collector or vital-source browser capture starts.",
    };
  }
  return null;
}

function safeBodySnippet(value) {
  return stringValue(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|token|secret|authorization)["']?\s*[:=]\s*["']?[^"',\s}]+/gi, "$1:[redacted]")
    .slice(0, 500);
}

function workerTaxAdapter() {
  try {
    return require("../../../../worker/dist/adapters/tax-collector-receipt");
  } catch {
    return null;
  }
}

function taxCollectorInputFromBody(body = {}) {
  const seed = objectValue(body.seed);
  const capture = objectValue(body.capture);
  const taxReceipt = objectValue(body.taxReceipt || capture.taxReceipt);
  const propertyAppraiser = objectValue(body.propertyAppraiser || capture.propertyAppraiser || seed.propertyAppraiserEvidence);
  return {
    listingHtml: taxReceipt.listingHtml || body.listingHtml,
    receiptHtml: taxReceipt.receiptHtml || body.receiptHtml,
    listingText: taxReceipt.listingText || body.listingText,
    receiptText: taxReceipt.receiptText || body.receiptText,
    detailsText: taxReceipt.detailsText || body.detailsText,
    listingUrl: taxReceipt.listingUrl || taxReceipt.sourceUrl || seed.taxCollectorListingUrl || body.listingUrl || body.sourceUrl,
    receiptUrl: taxReceipt.receiptUrl || taxReceipt.receiptLink || taxReceipt.sourceUrl || seed.taxCollectorReceiptUrl || body.receiptUrl || body.receiptLink,
    receiptLink: taxReceipt.receiptLink || seed.taxCollectorReceiptUrl || body.receiptLink,
    sourceUrl: taxReceipt.sourceUrl || body.sourceUrl,
    paidBy: taxReceipt.paidBy || body.paidBy,
    payerIdentity: taxReceipt.payerIdentity || body.payerIdentity,
    paidDate: taxReceipt.paidDate || body.paidDate,
    amountDue: taxReceipt.amountDue || body.amountDue,
    unpaidYears: taxReceipt.unpaidYears || body.unpaidYears,
    reassessment: taxReceipt.reassessment || body.reassessment,
    status: taxReceipt.status || body.status,
    parcelId: seed.parcelId || seed.folio || propertyAppraiser.folio || propertyAppraiser.parcelId || body.parcelId || body.folio,
    propertyAddress: seed.propertyAddress || body.propertyAddress || body.address,
    ownerName: seed.ownerName || seed.estateName || body.ownerName || body.owner || body.estateName,
  };
}

function searchInputFromBody(body = {}, input = taxCollectorInputFromBody(body)) {
  const seed = objectValue(body.seed);
  return {
    estateId: body.assetKey || body.estateId || body.leadId || seed.estateName || seed.propertyAddress || receiptId("tax-receipt-run"),
    county: seed.county || body.county || "miami-dade",
    folio: input.parcelId || "",
    propertyAddress: input.propertyAddress || "",
    ownerName: input.ownerName || "",
    searchUrl: process.env.TAX_COLLECTOR_SEARCH_URL || "https://county-taxes.net/fl-miamidade/property-tax",
  };
}

function hasSearchTarget(input = {}) {
  return Boolean(
    stringValue(input.parcelId)
      || stringValue(input.propertyAddress)
      || stringValue(input.ownerName)
      || stringValue(input.listingUrl)
      || stringValue(input.receiptUrl)
      || stringValue(input.receiptLink)
      || stringValue(input.listingHtml)
  );
}

async function acquire(input, env, fetchImpl) {
  const adapter = workerTaxAdapter();
  if (adapter?.acquireTaxCollectorReceipt) {
    return adapter.acquireTaxCollectorReceipt(input, { env, fetchImpl });
  }
  const discovery = discoverTaxCollectorReceipt(input);
  return discovery
    ? {
      ok: true,
      mode: discovery.mode,
      listingUrl: discovery.listingUrl,
      searchUrl: env.TAX_COLLECTOR_SEARCH_URL || "https://county-taxes.net/fl-miamidade/property-tax",
      finalUrl: discovery.listingUrl,
      discovery,
      reviewFlags: discovery.reviewFlags,
    }
    : {
      ok: false,
      mode: "not_configured",
      listingUrl: "",
      searchUrl: env.TAX_COLLECTOR_SEARCH_URL || "https://county-taxes.net/fl-miamidade/property-tax",
      blocker: "Tax Collector search needs the worker adapter build before it can run.",
      reviewFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    };
}

function receiptFromDiscovery(discovery, input = {}) {
  const details = {
    ...extractTaxCollectorDetails(input),
    ...(discovery?.details || {}),
  };
  return compactObject({
    receiptUrl: discovery?.receiptUrl,
    artifactUrl: discovery?.receiptUrl,
    contentType: /\.pdf($|\?)/i.test(String(discovery?.receiptUrl || "")) ? "application/pdf" : "text/html",
    paidBy: details.paidBy,
    payerIdentity: details.payerIdentity,
    paidDate: details.paidDate,
    amountDue: details.amountDue,
    unpaidYears: details.unpaidYears,
    reassessment: details.reassessment,
    receiptStatus: details.receiptStatus || (discovery ? "receipt_link_captured" : undefined),
    receiptLinkPosition: discovery?.mode === "listing_page_bottom_right" ? "listing_page_bottom_right" : discovery?.mode,
  });
}

function normalizeAcquisitionResult(result = {}, body = {}, input = taxCollectorInputFromBody(body)) {
  const searchInput = searchInputFromBody(body, input);
  const discovery = result.discovery || null;
  const receipt = receiptFromDiscovery(discovery, input);
  const matchedListing = compactObject({
    listingUrl: discovery?.listingUrl || result.finalUrl || result.listingUrl,
    sourcePage: result.finalUrl || result.listingUrl || discovery?.listingUrl,
    status: result.status,
    matchReason: discovery
      ? "Matched from folio/address search result and captured the bottom-right receipt link."
      : result.mode === "browser_workflow_required"
        ? "Public search requires the controlled browser workflow before listing review can complete."
        : "No matching Tax Collector listing was confirmed.",
  });
  const blocker = result.ok
    ? ""
    : result.blocker
      || (result.mode === "not_configured"
        ? "Tax Collector public search needs Browserbase/controlled Chrome, a workflow URL, or a listing URL template before it can reach the receipt from estate facts."
        : "Tax Collector receipt run did not return the bottom-right receipt link.");
  const blockers = blocker ? [blocker] : [];
  return {
    ok: Boolean(result.ok && receipt?.receiptUrl),
    mode: result.mode || (result.ok ? "listing_page_bottom_right" : "blocked"),
    flow: "tax_collector_receipt",
    estateId: searchInput.estateId,
    paidRun: Boolean(result.paidRun),
    searchInput,
    matchedListing,
    receipt,
    sourceEvidence: compactObject({
      source: "tax_collector",
      sourcePage: matchedListing?.sourcePage,
      searchUrl: result.searchUrl || searchInput.searchUrl,
      finalUrl: result.finalUrl,
      status: result.status,
      fetchedAt: new Date().toISOString(),
      bodySnippet: safeBodySnippet(result.bodySnippet),
      reviewFlags: result.reviewFlags || [],
    }),
    blockers,
    reviewRequired: true,
    reviewFlags: result.reviewFlags || (result.ok ? ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"] : ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"]),
    message: result.ok && receipt?.receiptUrl
      ? "Tax Collector listing was reached from estate facts and the bottom-right receipt link was captured for review."
      : blocker,
  };
}

function taxCollectorCaptureFromRun(run = {}) {
  const receipt = objectValue(run.receipt);
  const matchedListing = objectValue(run.matchedListing);
  const sourceEvidence = objectValue(run.sourceEvidence);
  const status = run.ok
    ? "receipt_link_captured"
    : run.mode === "listing_page_no_receipt"
      ? "unavailable_after_listing_check"
      : "browser_workflow_required";
  return compactObject({
    listingUrl: matchedListing.listingUrl || sourceEvidence.finalUrl || sourceEvidence.sourcePage,
    receiptLink: receipt.receiptUrl,
    receiptUrl: receipt.receiptUrl,
    sourceUrl: receipt.receiptUrl || matchedListing.listingUrl,
    paidBy: receipt.paidBy,
    payerIdentity: receipt.payerIdentity,
    paidDate: receipt.paidDate,
    amountDue: receipt.amountDue,
    unpaidYears: receipt.unpaidYears,
    reassessment: receipt.reassessment,
    status,
    sourceBlockedReason: run.ok ? "" : (run.blockers || []).join(" "),
    browserWorkflowRequired: !run.ok && status === "browser_workflow_required",
  }) || {};
}

function factValuePresent(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function addConfirmedFact(facts, factType, value, sourceUrl, reviewFlags, confidence = 0.85) {
  if (!factValuePresent(value)) return;
  facts.push({
    source: "tax_collector",
    factType,
    value,
    confidence,
    sourceUrl,
    reviewFlags,
  });
}

function taxCollectorConfirmedFactsFromRun(run = {}) {
  const receipt = objectValue(run.receipt);
  const matchedListing = objectValue(run.matchedListing);
  const sourceEvidence = objectValue(run.sourceEvidence);
  const flags = run.reviewFlags || [];
  const sourceUrl = receipt.receiptUrl || matchedListing.listingUrl || sourceEvidence.sourcePage || sourceEvidence.searchUrl;
  const facts = [];
  addConfirmedFact(facts, "source_status", compactObject({
    mode: run.mode,
    ok: Boolean(run.ok),
    listingUrl: matchedListing.listingUrl,
    receiptUrl: receipt.receiptUrl,
    searchUrl: sourceEvidence.searchUrl || run.searchInput?.searchUrl,
    note: run.message,
    status: sourceEvidence.status,
  }), sourceUrl, flags, run.ok ? 0.86 : 0.35);
  addConfirmedFact(facts, "tax_receipt_status", receipt.receiptStatus || (run.ok ? "receipt_link_captured" : run.mode), sourceUrl, flags, run.ok ? 0.86 : 0.35);
  addConfirmedFact(facts, "tax_receipt_link", receipt.receiptUrl, receipt.receiptUrl, flags, 0.9);
  addConfirmedFact(facts, "tax_receipt_attachment", receipt.receiptUrl ? {
    label: "Tax Collector receipt",
    sourceUrl: receipt.receiptUrl,
    fileKind: receipt.contentType === "application/pdf" ? "pdf" : "link",
    capturedAt: sourceEvidence.fetchedAt || new Date().toISOString(),
    capturedBy: "tax-collector-receipt-run",
    reviewFlags: flags,
  } : null, receipt.receiptUrl, flags, 0.9);
  addConfirmedFact(facts, "tax_last_paid_by", receipt.paidBy, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addConfirmedFact(facts, "tax_payer_identity", receipt.payerIdentity || receipt.paidBy, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addConfirmedFact(facts, "tax_paid_date", receipt.paidDate, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addConfirmedFact(facts, "tax_amount_due", receipt.amountDue, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addConfirmedFact(facts, "unpaid_tax_years", receipt.unpaidYears, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addConfirmedFact(facts, "tax_reassessment_signal", receipt.reassessment, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.7);
  return facts;
}

async function runTaxCollectorReceiptSearch(body = {}, options = {}) {
  const input = taxCollectorInputFromBody(body);
  if (!hasSearchTarget(input)) {
    const result = normalizeAcquisitionResult({
      ok: false,
      mode: "not_configured",
      listingUrl: "",
      searchUrl: process.env.TAX_COLLECTOR_SEARCH_URL || "https://county-taxes.net/fl-miamidade/property-tax",
      blocker: "Tax Collector receipt search needs a folio, property address, owner, or existing Property Appraiser fact before it can run.",
      reviewFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }, body, input);
    result.sourceFacts = taxCollectorConfirmedFactsFromRun(result);
    return result;
  }
  const batchGuard = browserbaseBatchGuard(body, options.env || process.env);
  if (batchGuard) {
    const result = normalizeAcquisitionResult({
      ok: false,
      mode: "browser_workflow_required",
      listingUrl: "",
      searchUrl: process.env.TAX_COLLECTOR_SEARCH_URL || "https://county-taxes.net/fl-miamidade/property-tax",
      blocker: batchGuard.message,
      reviewFlags: [batchGuard.code, "SOURCE_BLOCKED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }, body, input);
    result.mode = "browserbase_batch_blocked";
    result.paidRun = true;
    result.batchGuard = batchGuard;
    result.sourceFacts = taxCollectorConfirmedFactsFromRun(result);
    return result;
  }
  const acquisition = await acquire(input, options.env || process.env, options.fetchImpl || fetch);
  const result = normalizeAcquisitionResult(acquisition, body, input);
  result.sourceFacts = taxCollectorConfirmedFactsFromRun(result);
  return result;
}

function withoutTaxCollectorAcquisitionEnv(env = process.env) {
  const copy = { ...env };
  for (const key of [
    "TAX_COLLECTOR_LISTING_URL",
    "TAX_COLLECTOR_LISTING_URL_TEMPLATE",
    "TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED",
    "TAX_COLLECTOR_BROWSER_WORKFLOW_URL",
    "TAX_COLLECTOR_BROWSER_WORKFLOW_TOKEN",
    "TAX_COLLECTOR_BROWSER_WORKFLOW_ENABLED",
    "TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID",
    "BROWSERBASE_TAX_COLLECTOR_FUNCTION_ID",
  ]) {
    delete copy[key];
  }
  return copy;
}

module.exports = {
  runTaxCollectorReceiptSearch,
  taxCollectorCaptureFromRun,
  taxCollectorConfirmedFactsFromRun,
  taxCollectorInputFromBody,
  browserbaseBatchGuard,
  withoutTaxCollectorAcquisitionEnv,
};
