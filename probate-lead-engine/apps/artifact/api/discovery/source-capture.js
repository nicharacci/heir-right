const { discoverTaxCollectorReceipt, extractTaxCollectorDetails, methodGuard, proxyWorkerJson, readJsonBody, requireApiAuth, sendJson, sendProxied } = require("../_shared");

function localSourceFactsFromCapture(body) {
  const facts = [];
  const capturedAt = new Date().toISOString();
  const seed = body.seed || {};
  const taxReceipt = body.taxReceipt || {};
  const deed = body.deed || {};
  const propertyAppraiser = body.propertyAppraiser || {};
  const probate = body.probate || {};
  const obituary = body.obituary || {};
  const county = seed.county || body.county || "miami-dade";
  const subject = {
    ownerName: seed.ownerName || body.ownerName,
    propertyAddress: seed.propertyAddress || body.propertyAddress || body.address,
    parcelId: seed.parcelId || body.parcelId || body.folio,
    caseNumber: seed.caseNumber || body.caseNumber,
    estateName: seed.estateName || body.estateName,
    county,
  };
  const compactObject = (input) => {
    const output = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""));
    return Object.keys(output).length ? output : undefined;
  };
  const stringValue = (value) => typeof value === "string" ? value.trim() : "";
  const sourceAttachment = (label, sourceUrl, fileName, fileKind = "link") => {
    if (!sourceUrl && !fileName) return undefined;
    return {
      label,
      sourceUrl,
      fileName,
      fileKind,
      capturedAt,
      capturedBy: "source-capture",
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
    };
  };
  const receiptDiscovery = discoverTaxCollectorReceipt(taxReceipt);
  const taxDetails = {
    ...extractTaxCollectorDetails(taxReceipt),
    ...(receiptDiscovery?.details || {}),
  };
  const receiptUrl = receiptDiscovery?.receiptUrl || stringValue(taxReceipt.receiptUrl) || stringValue(taxReceipt.receiptLink);
  const listingUrl = receiptDiscovery?.listingUrl || stringValue(taxReceipt.listingUrl) || stringValue(taxReceipt.sourceUrl);
  const taxReceiptStatus = stringValue(taxReceipt.status);
  const browserWorkflowRequired = taxReceipt.browserWorkflowRequired === true || taxReceiptStatus === "browser_workflow_required";
  const taxSourceBlockedReason = stringValue(taxReceipt.sourceBlockedReason) || stringValue(taxReceipt.blocker) || stringValue(taxReceipt.browserWorkflowReason);
  const taxSourceStatus = compactObject({
    mode: browserWorkflowRequired
      ? "browser_workflow_required"
      : receiptUrl
        ? receiptDiscovery?.mode || "receipt_link_captured"
        : taxReceiptStatus === "unavailable_after_listing_check"
          ? "listing_page_no_receipt"
          : listingUrl
            ? "listing_page_review"
            : undefined,
    ok: Boolean(receiptUrl),
    listingUrl,
    receiptUrl,
    note: browserWorkflowRequired
      ? taxSourceBlockedReason || "Tax Collector public search needs a browser workflow before the listing-page receipt link can be captured."
      : taxReceiptStatus === "unavailable_after_listing_check"
        ? taxSourceBlockedReason || "Tax Collector listing page was checked and no bottom-right receipt link was available."
        : undefined,
  });
  const taxSourceStatusFlags = browserWorkflowRequired
    ? ["SOURCE_BLOCKED", "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED", "TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"]
    : receiptUrl
      ? receiptDiscovery?.reviewFlags || ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"]
      : ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"];
  const attachment = receiptUrl ? {
    label: "Tax Collector receipt",
    sourceUrl: receiptUrl,
    fileKind: "link",
    capturedAt,
    capturedBy: "source-capture",
    reviewFlags: receiptDiscovery?.reviewFlags || ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
  } : undefined;
  const addFact = (source, factType, value, sourceUrl, factAttachment = undefined, reviewFlags = undefined) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    if (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length) return;
    facts.push({
      id: `${body.runId || "artifact-source-capture"}:${source}:${factType}:${facts.length + 1}`,
      runId: body.runId || "artifact-source-capture",
      source,
      rawId: `operator-source:${factType}:${facts.length + 1}`,
      fetchedAt: capturedAt,
      county,
      subject,
      factType,
      value,
      confidence: 0.85,
      sourceUrl,
      attachment: factAttachment,
      reviewFlags: reviewFlags || (sourceUrl || factAttachment ? ["HUMAN_REVIEW_REQUIRED"] : ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"]),
    });
  };
  addFact("tax_collector", "source_status", taxSourceStatus, listingUrl || receiptUrl, undefined, taxSourceStatusFlags);
  addFact("tax_collector", "tax_last_paid_by", taxReceipt.paidBy || taxDetails.paidBy, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_payer_identity", taxReceipt.paidBy || taxReceipt.payerIdentity || taxDetails.payerIdentity, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_paid_date", taxReceipt.paidDate || taxDetails.paidDate, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_status", taxReceipt.status || taxDetails.receiptStatus || (receiptUrl ? "receipt_link_captured" : undefined), listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_link", receiptUrl, receiptUrl, attachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_receipt_attachment", attachment, receiptUrl, attachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_amount_due", taxDetails.amountDue || taxReceipt.amountDue, listingUrl || receiptUrl);
  addFact("tax_collector", "unpaid_tax_years", taxDetails.unpaidYears || taxReceipt.unpaidYears, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_reassessment_signal", taxReceipt.reassessment || taxDetails.reassessment, listingUrl || receiptUrl);
  const deedSourceUrl = deed.documentUrl || deed.sourceUrl || deed.fileName;
  const orBookPage = compactObject({
    book: deed.book,
    page: deed.page,
    instrumentNumber: deed.instrument || deed.instrumentNumber,
  });
  const latestDeed = compactObject({
    recordingDate: deed.recordingDate,
    documentType: deed.documentType || deed.status,
    orBookPage,
    grantor: deed.grantor,
    grantee: deed.grantee,
  });
  const deedAttachment = sourceAttachment("Official Records deed", deed.documentUrl || deed.sourceUrl, deed.fileName, deedSourceUrl && /\.pdf($|\?)/i.test(String(deedSourceUrl)) ? "pdf" : "link");
  addFact("official_records", "official_records_status", deed.status || (deedSourceUrl ? "official_records_evidence_captured" : undefined), deedSourceUrl);
  addFact("official_records", "deed_history_status", deed.status || (deedSourceUrl ? "latest_deed_captured" : undefined), deedSourceUrl);
  addFact("official_records", "or_book_page", orBookPage || deed.instrument, deedSourceUrl);
  addFact("official_records", "latest_deed", latestDeed || deed.status || deed.instrument, deedSourceUrl);
  addFact("official_records", "deed_attachment", deedAttachment, deedSourceUrl, deedAttachment);
  addFact("official_records", "last_sale_date", deed.lastSaleDate, deedSourceUrl);
  addFact("official_records", "ownership_activity_note", deed.ownershipActivity || deed.note, deedSourceUrl);
  addFact("official_records", "mortgage_signal", deed.mortgageSignal, deedSourceUrl);
  addFact("official_records", "lien_signal", deed.lienSignal, deedSourceUrl);
  addFact("official_records", "lis_pendens_signal", deed.lisPendensSignal, deedSourceUrl);
  addFact("official_records", "foreclosure_signal", deed.foreclosureSignal, deedSourceUrl);
  addFact("official_records", "adverse_possession_signal", deed.adversePossessionSignal, deedSourceUrl);
  addFact("official_records", "title_signal", deed.titleSignal || deed.note, deedSourceUrl);
  const propertySourceUrl = stringValue(propertyAppraiser.sourceUrl);
  addFact("property_appraiser", "property_owner", propertyAppraiser.owner || propertyAppraiser.ownerName, propertySourceUrl);
  addFact("property_appraiser", "property_address", propertyAppraiser.address || propertyAppraiser.propertyAddress, propertySourceUrl);
  addFact("property_appraiser", "property_folio", propertyAppraiser.folio || propertyAppraiser.parcelId, propertySourceUrl);
  addFact("property_appraiser", "mailing_address_signal", propertyAppraiser.mailingAddressSignal || propertyAppraiser.mailingAddress, propertySourceUrl);
  const probateSourceUrl = probate.docketUrl || probate.sourceUrl || probate.searchUrl;
  const civilFamilyDocket = compactObject({
    court: probate.court,
    division: probate.division,
    docketNumber: probate.relatedDocketNumber || probate.docketNumber,
    caseType: probate.caseType,
  });
  const officialRecordCrossLink = compactObject({
    label: probate.officialRecordLabel || "Official Records cross-link",
    url: probate.officialRecordUrl,
    orBookPage,
    note: probate.officialRecordNote,
  });
  addFact("probate_court", "probate_docket_status", probate.status || (probateSourceUrl ? "probate_docket_reviewed" : undefined), probateSourceUrl);
  addFact("probate_court", "case_number", probate.caseNumber, probateSourceUrl);
  addFact("probate_court", "probate_case_status", probate.caseStatus, probateSourceUrl);
  addFact("probate_court", "civil_family_docket_ref", civilFamilyDocket, probateSourceUrl);
  addFact("probate_court", "affidavit_of_heirs_status", probate.affidavitOfHeirsStatus, probateSourceUrl);
  addFact("probate_court", "probate_document_availability", probate.documentAvailability, probateSourceUrl);
  addFact("official_records", "official_record_cross_link", officialRecordCrossLink ? [officialRecordCrossLink] : undefined, probate.officialRecordUrl || deedSourceUrl);
  const obituarySourceUrl = obituary.sourceUrl || obituary.fileName;
  const obituaryAttachment = sourceAttachment("Obituary snapshot/link", obituary.sourceUrl, obituary.fileName, obituarySourceUrl && /\.(png|jpe?g|webp)($|\?)/i.test(String(obituarySourceUrl)) ? "image" : "link");
  addFact("clerk_of_courts", "marriage_death_status", obituary.status || (obituarySourceUrl ? "obituary_reviewed" : undefined), obituarySourceUrl);
  addFact("clerk_of_courts", "marriage_license_signal", obituary.marriageLicenseSignal, obituarySourceUrl);
  addFact("clerk_of_courts", "date_of_birth", obituary.dateOfBirth, obituarySourceUrl);
  addFact("clerk_of_courts", "date_of_death", obituary.dateOfDeath, obituarySourceUrl);
  addFact("clerk_of_courts", "obituary_link", obituary.sourceUrl || (obituary.status === "reviewed-not-found" ? "reviewed_not_found" : undefined), obituary.sourceUrl);
  addFact("clerk_of_courts", "obituary_snapshot", obituaryAttachment, obituary.sourceUrl, obituaryAttachment);
  addFact("clerk_of_courts", "memorial_search_tasks", [
    compactObject({ provider: "findagrave", url: obituary.findagraveUrl, note: obituary.findagraveNote }),
    compactObject({ provider: "legacy", url: obituary.legacyUrl, note: obituary.legacyNote }),
    compactObject({ provider: "google", url: obituary.googleUrl, note: obituary.googleNote }),
  ].filter(Boolean), obituarySourceUrl);
  addFact("clerk_of_courts", "death_certificate_status", obituary.deathCertificateStatus, obituarySourceUrl);
  addFact("clerk_of_courts", "incarceration_status_signal", obituary.incarcerationStatus, obituarySourceUrl);
  return facts;
}

async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/discovery/source-capture", body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }
    sendJson(response, 503, {
      ok: false,
      error: "source_capture_store_unavailable",
      message: "The canonical Discovery File store is unavailable, so the source capture was not saved.",
    });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "Source capture failed before any external write.",
    });
  }
}

module.exports = handler;
module.exports.localSourceFactsFromCapture = localSourceFactsFromCapture;
