import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { readArtifactSource } from "./helpers/artifact-source.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const assetRoot = path.resolve(here, "../../worker/src/documents/assets");
const pdfPath = path.join(assetRoot, "heirright-closing-templates-v1.pdf");
const mapPath = path.join(assetRoot, "heirright-closing-field-map-v1.json");
const bytes = fs.readFileSync(pdfPath);
const fieldMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const artifactHtml = readArtifactSource();
const pdf = await PDFDocument.load(bytes);

assert.equal(fieldMap.templateId, "heirright-closing-templates-v1");
assert.equal(fieldMap.forms.length, 14);
assert.equal(fieldMap.pageCount, 36);
assert.equal(pdf.getPageCount(), fieldMap.pageCount);
assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), fieldMap.templateHash);

const pageIndexes = fieldMap.forms.flatMap((form) => form.pages);
assert.equal(new Set(pageIndexes).size, fieldMap.pageCount);
assert.deepEqual([...pageIndexes].sort((a, b) => a - b), Array.from({ length: fieldMap.pageCount }, (_, index) => index));

for (const form of fieldMap.forms) {
  assert.ok(form.id && form.title);
  assert.ok(form.pages.length > 0);
  assert.ok(form.requiredFields.length > 0);
  for (const field of form.requiredFields) {
    assert.ok(fieldMap.fields[field]?.length, `${form.id} requires unmapped field ${field}`);
  }
}

const familyLiteralMatch = artifactHtml.match(/const closingTemplateFamilies = (\[[\s\S]*?\])\.map\(\(template\) =>/);
assert.ok(familyLiteralMatch, "Closing form definitions are missing from the artifact UI");
const uiFamilies = Function(`"use strict"; return (${familyLiteralMatch[1]});`)();
assert.deepEqual(
  uiFamilies.map(({ id, title, required }) => ({ id, title, required })),
  fieldMap.forms.map(({ id, title, requiredFields }) => ({ id, title, required: requiredFields })),
  "UI Closing form definitions drifted from the immutable backend field map",
);

const requiredFieldIds = [...new Set(fieldMap.forms.flatMap((form) => form.requiredFields))];
for (const fieldId of requiredFieldIds) {
  assert.match(
    artifactHtml,
    new RegExp(`closingRegistryEntry\\(\\"${fieldId}\\"`),
    `UI Closing field registry is missing ${fieldId}`,
  );
}

const extracted = fs.readFileSync(mapPath, "utf8");
for (const forbidden of ["Betty", "Antrinika", "Gwendolyn", "Nathan Robinson", "Thelma Hutto", "3400 WILLIAM", "01-4121-007-4830"]) {
  assert.equal(extracted.includes(forbidden), false, `field map leaked historical value ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "fourteen_form_families",
    "template_hash_matches_asset",
    "required_fields_have_coordinates",
    "ui_form_contract_matches_backend_map",
    "ui_registry_covers_every_required_field",
    "form_pages_are_complete_and_unique",
    "field_map_contains_no_historical_values",
  ],
}, null, 2));
