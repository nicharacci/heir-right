const { discoverTaxCollectorReceipt, methodGuard, proxyWorkerJson, readJsonBody, receiptId, sendJson, sendProxied } = require("../_shared");

function localTaxSourceFacts(body) {
  const facts = [];
  const capturedAt = new Date().toISOString();
  const seed = body.seed || {};
  const taxReceipt = body.taxReceipt || {};
  const county = seed.county || body.county || "miami-dade";
  const subject = {
    ownerName: seed.ownerName || body.ownerName,
    propertyAddress: seed.propertyAddress || body.propertyAddress || body.address,
    parcelId: seed.parcelId || body.parcelId || body.folio,
    estateName: seed.estateName || body.estateName,
    county,
  };
  const receiptDiscovery = discoverTaxCollectorReceipt(taxReceipt);
  const receiptUrl = receiptDiscovery?.receiptUrl || taxReceipt.receiptUrl || taxReceipt.receiptLink;
  const listingUrl = receiptDiscovery?.listingUrl || taxReceipt.listingUrl || taxReceipt.sourceUrl;
  const attachment = receiptUrl ? {
    label: "Tax Collector receipt",
    sourceUrl: receiptUrl,
    fileKind: "link",
    capturedAt,
    capturedBy: "source-capture",
    reviewFlags: receiptDiscovery?.reviewFlags || ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
  } : undefined;
  const addFact = (factType, value, sourceUrl = listingUrl || receiptUrl, factAttachment = undefined, reviewFlags = undefined) => {
    if (value === undefined || value === null || value === "") return;
    facts.push({
      id: `${body.runId || "artifact-source-capture"}:tax_collector:${factType}:${facts.length + 1}`,
      runId: body.runId || "artifact-source-capture",
      source: "tax_collector",
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
  addFact("tax_last_paid_by", taxReceipt.paidBy);
  addFact("tax_payer_identity", taxReceipt.paidBy || taxReceipt.payerIdentity);
  addFact("tax_paid_date", taxReceipt.paidDate);
  addFact("tax_receipt_status", taxReceipt.status || (receiptUrl ? "receipt_link_captured" : undefined));
  addFact("tax_receipt_link", receiptUrl, receiptUrl, attachment, receiptDiscovery?.reviewFlags);
  addFact("tax_receipt_attachment", attachment, receiptUrl, attachment, receiptDiscovery?.reviewFlags);
  addFact("tax_amount_due", taxReceipt.amountDue);
  addFact("unpaid_tax_years", taxReceipt.unpaidYears);
  addFact("tax_reassessment_signal", taxReceipt.reassessment);
  return facts;
}

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/discovery/source-capture", body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }

    const sourceFacts = localTaxSourceFacts(body);
    sendJson(response, 200, {
      ok: true,
      mode: "review_receipt",
      id: body.assetKey || body.id || receiptId("source-capture"),
      capturedAt: new Date().toISOString(),
      artifact: body,
      sourceFacts,
      reviewFlags: [...new Set(sourceFacts.flatMap((fact) => fact.reviewFlags || []))],
      message: "Source capture was accepted by the production artifact app. Tax Collector receipt evidence was parsed when a listing page or receipt link was supplied. No external write was attempted.",
    });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "Source capture failed before any external write.",
    });
  }
};
