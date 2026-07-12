import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import workerModule from "../../worker/dist/cloudflare.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const worker = workerModule.default || workerModule;
const repoRoot = path.resolve(here, "../../../..");
const sourceRun = JSON.parse(fs.readFileSync(path.join(repoRoot, "docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-source-run.json"), "utf8"));

class MemoryKv {
  values = new Map();
  async get(key) { return this.values.get(key) || null; }
  async put(key, value) { this.values.set(key, value); }
}

const kv = new MemoryKv();
const env = {
  AUTH_REQUIRED: "false",
  PACKET_ARTIFACTS: kv,
};

const reviewedDossier = structuredClone(sourceRun.dossier);
reviewedDossier.completedLeadReport.contactPlaceholders = [{
  role: "child",
  name: "Sandra Hawkins",
  age: 58,
  likelyCurrentAddress: "Miami, FL",
  phones: ["305-555-0101"],
  emails: ["sandra.hawkins@example.com"],
  addresses: ["Miami, FL"],
  addressHistory: [],
  note: "Reviewed contact fixture for deterministic packet validation.",
  reviewFlags: [],
}];

async function generate(dossiers, flow = "discovery") {
  const response = await worker.fetch(new Request("https://worker.test/api/exports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      routes: [],
      dryRun: true,
      flow,
      dossiers,
      operatorIntent: "generate_packet",
    }),
  }), env);
  return { response, body: await response.json() };
}

const genericContactAttempt = await generate([sourceRun.dossier]);
assert.equal(genericContactAttempt.response.status, 422);
assert.match(genericContactAttempt.body.blockers.join(" "), /generic family\/contact/i);

const single = await generate([reviewedDossier]);
assert.equal(single.response.status, 200);
assert.equal(single.body.ok, true);
assert.equal(single.body.contentType, "application/pdf");
assert.match(single.body.artifactUrl, /^\/api\/reports\/pdf\?artifactId=packet-/);
assert.equal(single.body.estateIds.length, 1);
assert.ok(single.body.sections.length >= 10);

const artifactId = single.body.artifact.artifactId;
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
assert.ok(singlePdf.getPageCount() > 10);
assert.equal(singlePdf.getTitle(), single.body.artifact.flow === "discovery" ? stored.model.title : undefined);

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
}

const oldQuery = await worker.fetch(new Request("https://worker.test/api/reports/pdf?title=Fake+Packet"), env);
assert.equal(oldQuery.status, 400);

const closing = await generate([reviewedDossier], "closing-docs");
assert.equal(closing.response.status, 422);
assert.equal(closing.body.ok, false);
assert.match(closing.body.blockers.join(" "), /legal template files/i);

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
    "closing_blocks_without_immutable_templates",
    "artifact_integrity_hash",
  ],
  singlePages: singlePdf.getPageCount(),
  batchPages: batchPdf.getPageCount(),
}, null, 2));
