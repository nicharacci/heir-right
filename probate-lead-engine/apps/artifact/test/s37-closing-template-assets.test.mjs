import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";

const here = path.dirname(fileURLToPath(import.meta.url));
const assetRoot = path.resolve(here, "../../worker/src/documents/assets");
const pdfPath = path.join(assetRoot, "heirright-closing-templates-v1.pdf");
const mapPath = path.join(assetRoot, "heirright-closing-field-map-v1.json");
const bytes = fs.readFileSync(pdfPath);
const fieldMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
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
    "form_pages_are_complete_and_unique",
    "field_map_contains_no_historical_values",
  ],
}, null, 2));
