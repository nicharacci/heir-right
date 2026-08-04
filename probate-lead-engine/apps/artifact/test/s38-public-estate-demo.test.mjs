import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { runDryPipeline } from "../../worker/dist/index.js";
import {
  buildDiscoveryDocumentModels,
  buildDiscoveryPacketModel,
  validatePacketModel,
} from "../../worker/dist/documents/packet-model.js";
import { renderPacketPdf } from "../../worker/dist/documents/packet-pdf.js";
import {
  emilioAlvarezRecioSeed,
  emilioAlvarezRecioSources,
} from "./fixtures/emilio-alvarez-recio-public-estate.mjs";

const pipeline = await runDryPipeline(emilioAlvarezRecioSeed, { env: {} });
const { dossier } = pipeline;

assert.equal(dossier.property.address.value, emilioAlvarezRecioSeed.propertyAddress);
assert.equal(dossier.property.ownerName.value, emilioAlvarezRecioSeed.ownerName);
assert.equal(dossier.property.parcelId.value, emilioAlvarezRecioSeed.parcelId);
assert.equal(dossier.probateDocket.caseNumber.value, emilioAlvarezRecioSeed.caseNumber);
assert.equal(dossier.marriageDeathIndicators.dateOfBirth.value, "2/12/1938");
assert.equal(dossier.marriageDeathIndicators.dateOfDeath.value, "9/11/2025");
assert.equal(dossier.marriageDeathIndicators.obituaryLink.value, emilioAlvarezRecioSources.obituaryUrl);
assert.equal(dossier.completedLeadReport.contactPlaceholders.length, 4);
assert.ok(
  dossier.completedLeadReport.contactPlaceholders.every((contact) => (
    contact.phones.length === 0
    && contact.emails.length === 0
    && contact.addresses.length === 0
    && (contact.addressHistory?.length ?? 0) === 0
  )),
  "the public family hypotheses must keep all IDI-derived contact fields blank",
);
assert.equal(
  dossier.audit.facts.some((fact) => fact.source === "idi" || fact.factType.startsWith("idi_")),
  false,
  "the public-estate demonstration must not fabricate an IDI import",
);
assert.deepEqual(
  dossier.familyTree.hypothesis.value.nodes.map((node) => node.name),
  ["Lolita De Sosa", "Silvia Alvarez-Recio", "Emilio Alvarez-Recio III", "Carlos Alvarez-Recio"],
);

const packet = buildDiscoveryPacketModel([dossier], "2026-07-28T12:00:00.000Z");
assert.deepEqual(validatePacketModel(packet), []);
const documents = buildDiscoveryDocumentModels(packet);
assert.equal(documents.length, 9);
const completedReport = documents.find((document) => document.documentId === "completed-report");
assert.ok(completedReport);
assert.deepEqual(completedReport.sectionIds, [
  "estate-summary",
  "offer-profit",
  "vital-records",
  "backstory",
  "family-contacts",
]);

const combinedBytes = await renderPacketPdf(packet);
const completedReportBytes = await renderPacketPdf(completedReport.model);
const combinedPdf = await PDFDocument.load(combinedBytes);
const completedReportPdf = await PDFDocument.load(completedReportBytes);
assert.ok(combinedPdf.getPageCount() >= completedReportPdf.getPageCount());
assert.ok(completedReportPdf.getPageCount() >= 2);
assert.ok(
  completedReportPdf.getPages().some((page) => (page.node.Annots()?.size() || 0) >= 3),
  "the family-tree report must carry clickable property, obituary, probate, and backstory evidence",
);

const rendered = await getDocument({ data: completedReportBytes.slice(), disableWorker: true }).promise;
const pageText = [];
for (let pageNumber = 1; pageNumber <= rendered.numPages; pageNumber += 1) {
  const content = await (await rendered.getPage(pageNumber)).getTextContent();
  pageText.push(...content.items.map((item) => item.str).filter(Boolean));
}
const copy = pageText.join(" ");
for (const required of [
  "ESTATE OF EMILIO ALVAREZ-RECIO",
  "Family Tree",
  "600 GRAPETREE DR 3AN, Key Biscayne, FL 33149",
  "EMILIO ALVAREZ-RECIO &W LOLITA",
  "DOB: 2/12/1938",
  "DOD: 9/11/2025",
  "Obituary",
  "Back Story:",
  "Back Story evidence:",
  "Heirs:",
  "LOLITA DE SOSA",
  "SILVIA ALVAREZ-RECIO",
  "EMILIO ALVAREZ-RECIO III",
  "CARLOS ALVAREZ-RECIO",
  "Not confirmed",
  "relationship and inheritance notes remain research hypotheses",
]) assert.match(copy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

assert.equal(copy.includes("600 GRAPETREE DR 3AN, Key Biscayne, FL 33149-0000"), false, "Rendered addresses must use the display-address normalization applied by the production packet model.");

for (const forbidden of [
  "305-555",
  "@example.com",
  "IDI report imported",
  "IDI report pending",
  "Public-source relationship hypothesis only",
  "legal heir confirmed",
]) {
  assert.equal(copy.includes(forbidden), false);
}

const outputDir = process.env.S38_PUBLIC_ESTATE_OUTPUT_DIR;
if (outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "emilio-alvarez-recio-discovery-packet.pdf"), combinedBytes);
  fs.writeFileSync(path.join(outputDir, "emilio-alvarez-recio-family-tree.pdf"), completedReportBytes);
  fs.writeFileSync(
    path.join(outputDir, "emilio-alvarez-recio-source-run.json"),
    `${JSON.stringify({ seed: emilioAlvarezRecioSeed, facts: pipeline.facts, dossier }, null, 2)}\n`,
  );
}

console.log(JSON.stringify({
  ok: true,
  estate: dossier.summary.displayName,
  idi: "blank",
  publicFamilyHypotheses: dossier.familyTree.hypothesis.value.nodes.length,
  combinedPages: combinedPdf.getPageCount(),
  familyTreePages: completedReportPdf.getPageCount(),
  sourceLinks: dossier.completedLeadReport.sourceLinks.length,
}, null, 2));
