import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerModule, { WorkspaceState } from "../../worker/dist/cloudflare.js";
import {
  buildContactPlaceholders,
  generateCompletedLeadReport,
} from "../../worker/dist/documents/completed-lead-report.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const worker = workerModule.default || workerModule;
const repoRoot = path.resolve(here, "../../../..");
const appRoot = path.resolve(here, "../../..");
const sourceRun = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-source-run.json"), "utf8"));
const closingFieldMap = JSON.parse(fs.readFileSync(path.join(appRoot, "apps/worker/src/documents/assets/heirright-closing-field-map-v1.json"), "utf8"));

class MemoryKv {
  values = new Map();
  options = new Map();
  async get(key) { return this.values.get(key) || null; }
  async put(key, value, options = {}) {
    this.values.set(key, value);
    this.options.set(key, options);
  }
  async delete(key) { this.values.delete(key); }
}

class MemoryDurableStorage {
  values = new Map();
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async transaction(closure) { return closure(this); }
}

const kv = new MemoryKv();
const workspace = new WorkspaceState({ storage: new MemoryDurableStorage() });
const env = {
  AUTH_REQUIRED: "false",
  PACKET_ARTIFACTS: kv,
  WORKSPACE_STATE: {
    idFromName: (name) => name,
    get: () => ({ fetch: (request) => workspace.fetch(request) }),
  },
};

const reviewedDossier = structuredClone(sourceRun.dossier);
const obituaryUrl = "https://source.example.test/annie-hawkins-obituary";
const obituaryRawId = `${reviewedDossier.runId}:obituary:reviewed`;
reviewedDossier.audit.facts.push({
  id: obituaryRawId,
  runId: reviewedDossier.runId,
  source: "clerk_of_courts",
  rawId: obituaryRawId,
  fetchedAt: reviewedDossier.generatedAt,
  county: "miami-dade",
  subject: { estateName: reviewedDossier.summary.estateName, propertyAddress: reviewedDossier.property.address.value },
  factType: "obituary_link",
  value: obituaryUrl,
  confidence: 0.9,
  sourceUrl: obituaryUrl,
  attachment: {
    label: "Annie Hawkins obituary",
    sourceUrl: obituaryUrl,
    fileKind: "html",
    capturedAt: reviewedDossier.generatedAt,
    capturedBy: "test",
    reviewFlags: [],
  },
  reviewFlags: [],
});
reviewedDossier.marriageDeathIndicators.obituaryLink = {
  value: obituaryUrl,
  confidence: 0.9,
  sourceRefs: [{ source: "clerk_of_courts", rawId: obituaryRawId, fetchedAt: reviewedDossier.generatedAt }],
  reviewFlags: [],
};
reviewedDossier.audit.facts.push({
  id: `${reviewedDossier.runId}:idi:reviewed-contact`,
  runId: reviewedDossier.runId,
  source: "idi",
  rawId: `${reviewedDossier.runId}:idi:reviewed-contact`,
  fetchedAt: reviewedDossier.generatedAt,
  county: "miami-dade",
  subject: { estateName: reviewedDossier.summary.estateName, propertyAddress: reviewedDossier.property.address.value },
  factType: "alternative_contact_profile",
  value: {
    id: `${reviewedDossier.runId}:idi:reviewed-contact`,
    name: "Sandra Hawkins",
    relationship: "child",
    age: 58,
    interest: "1/9th Interest",
    group: "alternative",
    phones: ["305-555-0101"],
    emails: ["sandra.hawkins@example.com"],
    currentAddress: "Miami, FL",
    addressHistory: ["Miami, FL", "Orlando, FL"],
    addressHistoryDetails: [
      { address: "Miami, FL", county: "Miami-Dade County", dates: "2018 - Present" },
      { address: "Orlando, FL", county: "Orange County", dates: "2012 - 2018" },
    ],
    ownerLastNameMatch: true,
    confidence: 0.86,
    sourceRefs: [],
    reviewStatus: "accepted",
    reviewFlags: [],
  },
  confidence: 0.86,
  sourceUrl: "https://source.example.test/reviewed-idi-report",
  attachment: {
    label: "idi-report-02-production.pdf",
    sourceUrl: "https://source.example.test/reviewed-idi-report",
    fileKind: "pdf",
    capturedAt: reviewedDossier.generatedAt,
    reviewFlags: [],
  },
  reviewFlags: [],
});
reviewedDossier.completedLeadReport = await generateCompletedLeadReport(reviewedDossier);
reviewedDossier.completedLeadReport.contactPlaceholders = buildContactPlaceholders(reviewedDossier);
Object.assign(reviewedDossier.completedLeadReport.offerMath.asIsValue, { value: 300000 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.taxesDue, { value: 5000 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.liens, { value: 1000 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.mortgages, { value: 50000 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.sellingCosts, { value: 10000 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.probateCosts, { value: 5000 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.partitionCosts, { value: 0 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.postEquityValue, { value: 229000 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.heirCount, { value: 8 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.equityPerHeir, { value: 28625 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.buyPercentage, { value: 50 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.offerAmount, { value: 14312.5 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.profit, { value: 14312.5 });
Object.assign(reviewedDossier.completedLeadReport.offerMath.minimumNetProfit, { value: 15000 });
reviewedDossier.completedLeadReport.backstory = "receipt_link_captured: https://source.example.test/private-tax-receipt";
reviewedDossier.completedLeadReport.formats.familyTreeHtml = "<p>stale client report receipt_link_captured https://source.example.test/private-tax-receipt idi-report-02-production.pdf</p>";
assert.deepEqual(
  reviewedDossier.completedLeadReport.contactPlaceholders.map((contact) => ({ name: contact.name, role: contact.role, reviewFlags: contact.reviewFlags })),
  [{ name: "Sandra Hawkins", role: "child", reviewFlags: [] }],
  "an accepted IDI contact must replace generic family rows in the generated Discovery packet",
);

async function generate(dossiers, flow = "discovery", estateId = "", payload = {}) {
  const response = await worker.fetch(new Request("https://worker.test/api/exports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      routes: [],
      dryRun: true,
      controlledTest: !estateId,
      flow,
      dossiers,
      ...(estateId ? { estateId } : {}),
      ...(estateId ? { packetRevision: 1 } : {}),
      operatorIntent: "generate_packet",
      ...payload,
    }),
  }), env);
  return { response, body: await response.json() };
}

const genericContactAttempt = await generate([sourceRun.dossier]);
assert.equal(genericContactAttempt.response.status, 422);
assert.match(genericContactAttempt.body.blockers.join(" "), /generic family\/contact/i);

const persistedEstateId = "estate:annie-hawkins:reviewed";
const discoveryFileKey = `discovery-file:${createHash("sha256").update(persistedEstateId).digest("hex")}`;
await kv.put(discoveryFileKey, JSON.stringify({ estateId: persistedEstateId, revision: "reviewed-source-revision", packetArtifacts: [] }));
const single = await generate([reviewedDossier], "discovery", persistedEstateId);
assert.equal(single.response.status, 200);
assert.equal(single.body.ok, true);
assert.equal(single.body.contentType, "application/pdf");
assert.equal(single.body.estateId, persistedEstateId);
assert.equal(single.body.packetPersistence[0].readbackStatus, "verified");
assert.match(single.body.artifactUrl, /^\/api\/reports\/pdf\?artifactId=packet-/);
assert.equal(single.body.estateIds.length, 1);
assert.ok(single.body.sections.length >= 10);
assert.equal(single.body.documentArtifacts.length, 9);
assert.deepEqual(
  single.body.documentArtifacts.map((document) => document.documentId).sort(),
  [
    "completed-report",
    "crm-handoff",
    "deed-title-notes",
    "drip-schedule",
    "heir-contact-matrix",
    "outreach-drafts",
    "probate-request",
    "source-notes",
    "tax-history",
  ],
);
assert.ok(single.body.documentArtifacts.every((document) => document.artifactId !== single.body.artifact.artifactId));

const artifactId = single.body.artifact.artifactId;
const persistedDiscoveryResponse = await worker.fetch(new Request(`https://worker.test/api/discovery/file?estateId=${encodeURIComponent(persistedEstateId)}`), env);
const persistedDiscoveryFile = await persistedDiscoveryResponse.json();
assert.equal(persistedDiscoveryFile.packetArtifacts[0].artifactId, artifactId);
assert.equal(persistedDiscoveryFile.packetArtifacts[0].readbackStatus, "verified");
assert.equal(persistedDiscoveryFile.packetArtifacts[0].documentArtifacts.length, 9);
const persistedDiscoveryRevisionKey = [...kv.values.keys()].find((key) => key.startsWith(`${discoveryFileKey}:revision:`));
assert.ok(persistedDiscoveryRevisionKey, "packet references must be staged as an immutable Discovery File revision");
assert.equal(
  kv.options.get(persistedDiscoveryRevisionKey)?.expirationTtl,
  30 * 24 * 60 * 60,
  "packet-reference rewrites must retain the bounded Discovery-file privacy TTL"
);
const stored = JSON.parse(await kv.get(`packet:${artifactId}`));
const storedText = JSON.stringify(stored.model);
for (const heading of [
  "Estate Summary",
  "Qualification And Stop Rules",
  "Offer And Profit Review",
  "Tax History And Receipt",
  "Deed, Title And Ownership",
  "Probate And Court Records",
  "Owner, Marriage And Vital Records",
  "Back Story",
  "Family Tree And Contact Review",
  "Source Evidence And Research Checklist",
  "Blockers And Next Action",
]) assert.match(storedText, new RegExp(heading));
for (const forbidden of ["Selected estate", "Owner review", "[NEEDS REVIEW]"]) assert.equal(storedText.includes(forbidden), false);

const pdfResponse = await worker.fetch(new Request(`https://worker.test/api/reports/pdf?artifactId=${artifactId}`), env);
assert.equal(pdfResponse.status, 200);
assert.equal(pdfResponse.headers.get("content-type"), "application/pdf");
const singlePdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
assert.ok(singlePdfBytes.byteLength > 10_000);
const singlePdf = await PDFDocument.load(singlePdfBytes);
assert.ok(singlePdf.getPageCount() >= 8);
assert.equal(singlePdf.getTitle(), single.body.artifact.flow === "discovery" ? stored.model.title : undefined);
assert.ok(
  singlePdf.getPages().some((page) => (page.node.Annots()?.size() || 0) > 0),
  "the exact-format Discovery PDF must contain clickable evidence annotations",
);
const renderedDiscovery = await getDocument({ data: singlePdfBytes.slice(), disableWorker: true }).promise;
const firstPageText = (await (await renderedDiscovery.getPage(1)).getTextContent()).items.filter((item) => item.str?.trim());
const firstPageItem = (text) => firstPageText.find((item) => item.str === text);
assert.ok(Math.abs(firstPageItem("Property Address:")?.transform?.[4] - 72) < 0.2, "the property row must retain the approved 72-point left edge");
assert.ok(Math.abs(firstPageItem("Offer/Profit")?.transform?.[4] - 208.7) < 1, "the 332-point offer table heading must stay centered like the approved HeirRight example");
assert.ok(Math.abs(firstPageItem("Description")?.transform?.[4] - 94.6) < 1, "the approved first offer-table column geometry must not drift");
assert.equal(firstPageItem("Owner:")?.transform?.[4], 72, "the owner block must align with the approved HeirRight example");
assert.equal(firstPageItem("Obituary")?.transform?.[4], 72, "the source-linked obituary must remain present in the approved first-page position");
for (const value of ["$300,000.00", "8", "50%", "$14,312.50", "$15,000.00"]) {
  assert.ok(firstPageItem(value), `the client-format Offer/Profit table must render ${value} from the report model`);
}
const familyTreeText = [];
for (let pageNumber = 2; pageNumber <= Math.min(3, renderedDiscovery.numPages); pageNumber += 1) {
  const textContent = await (await renderedDiscovery.getPage(pageNumber)).getTextContent();
  familyTreeText.push(...textContent.items.map((item) => item.str).filter(Boolean));
}
const familyTreeCopy = familyTreeText.join(" ");
for (const required of [
  "Back Story:",
  "Back Story evidence:",
  "Heirs: None confirmed by the reviewed evidence.",
  "Possible Heirs:",
  "Associates: None reviewed.",
  "Address (County/Parish/Borough) History:",
  "Miami, FL",
  "1/9th Interest",
  "(58)",
  "Miami-Dade County",
  "2018 - Present",
  "Orlando, FL",
  "Phone number:",
  "305-555-0101",
  "Email Address:",
  "sandra.hawkins@example.com",
]) assert.match(familyTreeCopy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

let completedReportPdfBytes;
for (const document of single.body.documentArtifacts) {
  const documentResponse = await worker.fetch(new Request(`https://worker.test${document.artifactUrl}`), env);
  assert.equal(documentResponse.status, 200);
  assert.equal(documentResponse.headers.get("x-heirright-artifact-id"), document.artifactId);
  assert.equal(documentResponse.headers.get("x-heirright-content-hash"), document.contentHash);
  const documentBytes = new Uint8Array(await documentResponse.arrayBuffer());
  if (document.documentId === "completed-report") completedReportPdfBytes = documentBytes;
  assert.ok(documentBytes.byteLength > 700);
  const documentPdf = await PDFDocument.load(documentBytes);
  assert.ok(documentPdf.getPageCount() >= 1);
  assert.match(documentPdf.getTitle() || "", new RegExp(document.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
const completedReportPdf = await PDFDocument.load(completedReportPdfBytes);
assert.ok(
  completedReportPdf.getPageCount() >= 2 && completedReportPdf.getPageCount() <= 12,
  "the client-facing completed report must stay within the reviewed family-tree packet range",
);
const completedReportRender = await getDocument({ data: completedReportPdfBytes.slice(), disableWorker: true }).promise;
const completedReportPages = [];
for (let pageNumber = 1; pageNumber <= completedReportRender.numPages; pageNumber += 1) {
  const textContent = await (await completedReportRender.getPage(pageNumber)).getTextContent();
  const pageCopy = textContent.items.map((item) => item.str).filter(Boolean).join(" ");
  assert.ok(
    pageCopy.length > 200,
    `completed report page ${pageNumber} must contain substantial client-facing content; received: ${pageCopy}`,
  );
  completedReportPages.push(pageCopy);
}
const completedReportCopy = completedReportPages.join(" ");
for (const internalTerm of [
  "Raw no-enrichment",
  "approval-gated",
  "CRM",
  "outreach action",
  "skip-traced",
  "human review",
  "browser extraction",
  "operator contact review",
  "manual_review_required",
  "Review gate:",
  "receipt_link_captured",
  "https://source.example.test/private-tax-receipt",
  "idi-report-02-production.pdf",
]) {
  assert.doesNotMatch(
    completedReportCopy,
    new RegExp(internalTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    `the client-facing completed report must not expose internal term: ${internalTerm}`,
  );
}
assert.match(completedReportCopy, /Reviewed IDI evidence/, "the client PDF must replace a private IDI filename with a stable evidence label");

const secondDossier = structuredClone(reviewedDossier);
secondDossier.id = `${secondDossier.id}-second`;
secondDossier.summary.displayName = "Estate of Annie Hawkins - Second Reviewed Property";
secondDossier.property.address.value = "225 NW 68th Street, Miami, FL 33150";
const batch = await generate([reviewedDossier, secondDossier]);
assert.equal(batch.response.status, 200);
assert.equal(batch.body.ok, true);
assert.equal(batch.body.estateIds.length, 2);
const batchStored = JSON.parse(await kv.get(`packet:${batch.body.artifact.artifactId}`));
assert.equal(batchStored.model.estates.length, 2);
assert.equal(batchStored.model.estates.filter((estate) => estate.dossierId === reviewedDossier.id).length, 1);
assert.equal(batchStored.model.estates.filter((estate) => estate.dossierId === secondDossier.id).length, 1);
const batchPdfResponse = await worker.fetch(new Request(`https://worker.test${batch.body.artifactUrl}`), env);
const batchPdfBytes = new Uint8Array(await batchPdfResponse.arrayBuffer());
const batchPdf = await PDFDocument.load(batchPdfBytes);
assert.ok(batchPdf.getPageCount() > singlePdf.getPageCount());

if (process.env.S37_PDF_OUTPUT_DIR) {
  fs.mkdirSync(process.env.S37_PDF_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(process.env.S37_PDF_OUTPUT_DIR, "discovery-single.pdf"), singlePdfBytes);
  fs.writeFileSync(path.join(process.env.S37_PDF_OUTPUT_DIR, "discovery-batch.pdf"), batchPdfBytes);
  fs.writeFileSync(path.join(process.env.S37_PDF_OUTPUT_DIR, "discovery-completed-report.pdf"), completedReportPdfBytes);
}

const oldQuery = await worker.fetch(new Request("https://worker.test/api/reports/pdf?title=Fake+Packet"), env);
assert.equal(oldQuery.status, 400);

const closingWithoutSelection = await generate([reviewedDossier], "closing-docs");
assert.equal(closingWithoutSelection.response.status, 422);
assert.equal(closingWithoutSelection.body.ok, false);
assert.match(closingWithoutSelection.body.blockers.join(" "), /choose at least one Closing form/i);

const closingMissingFields = await generate([reviewedDossier], "closing-docs", "", {
  selectedClosingTemplateIds: ["quit-claim-deed"],
});
assert.equal(closingMissingFields.response.status, 422);
assert.equal(closingMissingFields.body.ok, false);
assert.match(closingMissingFields.body.blockers.join(" "), /needs buyer entity/i);
assert.match(closingMissingFields.body.blockers.join(" "), /needs legal description/i);

const closingFields = {
  seller_heirs: "Sandra Hawkins",
  buyer_entity: "HeirRight, LLC",
  property_address: "1275 NW 73rd Street, Miami, FL 33147",
  folio: "30-3110-009-0710",
  legal_description: "Lot 7, Block 4, Example Estates, according to the plat thereof",
  seller_mailing_address: "1275 NW 73rd Street, Miami, FL 33147",
  seller_marital_status: "Unmarried",
};
const closingOverflow = await generate([reviewedDossier], "closing-docs", "", {
  selectedClosingTemplateIds: ["quit-claim-deed"],
  closingFieldValues: {
    ...closingFields,
    legal_description: "A deliberately overlong legal description ".repeat(80),
  },
});
assert.equal(closingOverflow.response.status, 422);
assert.equal(closingOverflow.body.ok, false);
assert.match(closingOverflow.body.blockers.join(" "), /does not fit its approved template blank/i);

const closingSingle = await generate([reviewedDossier], "closing-docs", "", {
  selectedClosingTemplateIds: ["quit-claim-deed"],
  closingFieldValues: closingFields,
});
assert.equal(closingSingle.response.status, 200);
assert.equal(closingSingle.body.ok, true);
assert.equal(closingSingle.body.contentType, "application/pdf");
assert.equal(closingSingle.body.artifact.kind, "single_pdf");
assert.deepEqual(closingSingle.body.sections.map((section) => section.title), ["Quit Claim Deed"]);
const closingStored = JSON.parse(await kv.get(`packet:${closingSingle.body.artifact.artifactId}`));
assert.equal(closingStored.model.closingTemplate.templateHash, closingFieldMap.templateHash);
assert.deepEqual(closingStored.model.estates[0].closing.templateIds, ["quit-claim-deed"]);
assert.equal(closingStored.model.estates[0].closing.fields.legal_description, closingFields.legal_description);
const closingPdfResponse = await worker.fetch(new Request(`https://worker.test${closingSingle.body.artifactUrl}`), env);
assert.equal(closingPdfResponse.status, 200);
assert.equal(closingPdfResponse.headers.get("content-type"), "application/pdf");
const closingSinglePdfBytes = new Uint8Array(await closingPdfResponse.arrayBuffer());
const closingSinglePdf = await PDFDocument.load(closingSinglePdfBytes);
assert.equal(closingSinglePdf.getPageCount(), 3);
assert.equal(closingSinglePdf.getForm().getFields().length, 0);

const closingBatch = await generate([reviewedDossier, secondDossier], "closing-docs", "", {
  selectedClosingTemplateIdsByEstate: {
    [reviewedDossier.id]: ["quit-claim-deed"],
    [secondDossier.id]: ["quit-claim-deed"],
  },
  closingFieldValuesByEstate: {
    [reviewedDossier.id]: closingFields,
    [secondDossier.id]: {
      ...closingFields,
      seller_heirs: "Jordan Hawkins",
      property_address: secondDossier.property.address.value,
      seller_mailing_address: secondDossier.property.address.value,
    },
  },
});
assert.equal(closingBatch.response.status, 200);
assert.equal(closingBatch.body.ok, true);
assert.equal(closingBatch.body.estateIds.length, 2);
const closingBatchStored = JSON.parse(await kv.get(`packet:${closingBatch.body.artifact.artifactId}`));
assert.equal(closingBatchStored.model.estates[0].closing.fields.seller_heirs, "Sandra Hawkins");
assert.equal(closingBatchStored.model.estates[1].closing.fields.seller_heirs, "Jordan Hawkins");
const closingBatchPdfResponse = await worker.fetch(new Request(`https://worker.test${closingBatch.body.artifactUrl}`), env);
const closingBatchPdfBytes = new Uint8Array(await closingBatchPdfResponse.arrayBuffer());
const closingBatchPdf = await PDFDocument.load(closingBatchPdfBytes);
assert.equal(closingBatchPdf.getPageCount(), 7);

const largeClosingDossiers = Array.from({ length: 20 }, (_, index) => {
  const dossier = structuredClone(reviewedDossier);
  dossier.id = `${reviewedDossier.id}-closing-${index + 1}`;
  dossier.summary.displayName = `Closing pagination estate ${index + 1}`;
  return dossier;
});
const largeClosingSelection = Object.fromEntries(largeClosingDossiers.map((dossier) => [dossier.id, ["quit-claim-deed"]]));
const largeClosingFields = Object.fromEntries(largeClosingDossiers.map((dossier, index) => [dossier.id, {
  ...closingFields,
  seller_heirs: `Reviewed Seller ${index + 1}`,
} ]));
const closingLargeBatch = await generate(largeClosingDossiers, "closing-docs", "", {
  selectedClosingTemplateIdsByEstate: largeClosingSelection,
  closingFieldValuesByEstate: largeClosingFields,
});
assert.equal(closingLargeBatch.response.status, 200);
const closingLargeBatchPdfResponse = await worker.fetch(new Request(`https://worker.test${closingLargeBatch.body.artifactUrl}`), env);
const closingLargeBatchPdf = await PDFDocument.load(new Uint8Array(await closingLargeBatchPdfResponse.arrayBuffer()));
assert.ok(closingLargeBatchPdf.getPageCount() > 61);
if (process.env.S37_PDF_OUTPUT_DIR) {
  fs.writeFileSync(path.join(process.env.S37_PDF_OUTPUT_DIR, "closing-single.pdf"), closingSinglePdfBytes);
  fs.writeFileSync(path.join(process.env.S37_PDF_OUTPUT_DIR, "closing-batch.pdf"), closingBatchPdfBytes);
}

const tampered = JSON.parse(await kv.get(`packet:${artifactId}`));
tampered.model.title = "Tampered title";
await kv.put(`packet:${artifactId}`, JSON.stringify(tampered));
const tamperedResponse = await worker.fetch(new Request(`https://worker.test/api/reports/pdf?artifactId=${artifactId}`), env);
assert.equal(tamperedResponse.status, 409);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "real_discovery_sections",
    "generic_contacts_block_export",
    "artifact_id_only_retrieval",
    "single_pdf_over_ten_pages",
    "batch_contains_each_estate_once",
    "query_string_cover_sheet_removed",
    "closing_requires_explicit_form_selection",
    "closing_blocks_missing_required_fields",
    "closing_fills_immutable_template",
    "closing_rejects_field_overflow",
    "closing_batch_is_one_pdf",
    "closing_batch_keeps_estate_fields_separate",
    "closing_contents_paginate_for_large_batch",
    "artifact_integrity_hash",
    "shared_discovery_file_packet_reference",
    "packet_reference_rewrite_preserves_discovery_file_ttl",
  ],
  singlePages: singlePdf.getPageCount(),
  batchPages: batchPdf.getPageCount(),
  closingSinglePages: closingSinglePdf.getPageCount(),
  closingBatchPages: closingBatchPdf.getPageCount(),
}, null, 2));
