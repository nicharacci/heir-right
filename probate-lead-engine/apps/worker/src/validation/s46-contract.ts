import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { applyVerifiedValue, assertPdfEnvelope, identitiesMatch, inspectPdf, mapIdiPages, obituaryIdentityMatches, publicMappingReceipt, safeFilename, sha256 } from "../s46-core";
import { renderS46DiscoveryPdf } from "../s46-packet-pdf";
import { S46_CLOSING_ENABLED, S46_CLOSING_INPUT_SCHEMA } from "../s46-closing-contract";

async function sourcePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage();
  first.drawText("Subject Name: Michelet Eugene", { x: 50, y: 750, font, size: 12 });
  first.drawText("Date of Birth: 01/02/1940", { x: 50, y: 730, font, size: 12 });
  first.drawText("County: Miami-Dade", { x: 50, y: 710, font, size: 12 });
  first.drawText("Property Address: 123 Proof Street Miami FL 33101", { x: 50, y: 690, font, size: 12 });
  const second = pdf.addPage();
  second.drawText("Potential Heir: Jean Eugene", { x: 50, y: 750, font, size: 12 });
  second.drawText("Age: 51 Phone: 305-555-0101 Email: jean@example.com", { x: 50, y: 730, font, size: 12 });
  second.drawText("100 First Street Miami FL 33101", { x: 50, y: 710, font, size: 12 });
  return pdf.save({ useObjectStreams: false });
}

async function main(): Promise<void> {
  const bytes = await sourcePdf();
  assertPdfEnvelope(bytes, "application/pdf");
  assert.throws(() => assertPdfEnvelope(bytes, "text/plain"), /wrong_mime_type/);
  assert.equal(safeFilename("../Michelet private.pdf"), "Michelet-private.pdf");
  const inspection = await inspectPdf(bytes);
  assert.equal(inspection.pageCount, 2);
  const sourceHash = await sha256(bytes);
  const mapped = await mapIdiPages(inspection.pages, sourceHash, new Date(0).toISOString());
  assert.equal(mapped.owner, "Michelet Eugene");
  assert.equal(mapped.heirs.length, 1);
  assert.equal(mapped.heirs[0].name, "Jean Eugene");
  assert.equal(mapped.heirs[0].email, "jean@example.com");
  assert.equal(mapped.heirs[0].addresses.length, 1);
  assert.equal(mapped.heirs[0].evidence.phone?.page, 2);
  const collapsedIdi = await mapIdiPages([
    "Subject: MICHELET EUGENE\nLikely Current Address: 401 NW 77TH ST, MIAMI, FL, 33150 (MIAMI-DADE)\nAddress (County/Parish/Borough) History:\nLikely relatives and associates\nSpouse\n1 found\nChild\n3 found",
  ], sourceHash, new Date(0).toISOString());
  assert.equal(collapsedIdi.county, "Miami-Dade");
  assert.equal(collapsedIdi.heirs.length, 0);
  assert.ok(identitiesMatch("Estate of Michelet Eugene", "MICHELET EUGENE"));
  assert.equal(obituaryIdentityMatches("MICHELET EUGENE", "Eugene Michelet obituary, Miami, Florida"), true);
  assert.equal(obituaryIdentityMatches("MICHELET EUGENE", "Eugene chapel serves families. Michelet family memorial."), false);
  applyVerifiedValue(mapped, "owner", "Estate of Michelet Eugene", { source: "property_appraiser", retrievedAt: new Date(0).toISOString(), sha256: sourceHash, excerpt: "direct record" });
  assert.throws(() => applyVerifiedValue(mapped, "dateOfBirth", "12/31/1900", { source: "direct_obituary", retrievedAt: new Date(0).toISOString(), sha256: sourceHash, excerpt: "direct page" }), /conflict:dateOfBirth/);
  const receipt = publicMappingReceipt(mapped);
  assert.equal(receipt.automatic, true);
  assert.ok(!JSON.stringify(receipt).includes("direct record"));
  mapped.dateOfDeath = "02/03/2020";
  mapped.obituaryUrl = "https://example.com/michelet-eugene-obituary";
  mapped.backStory = "Michelet Eugene lived in Miami-Dade and maintained a family home there.";
  const output = await renderS46DiscoveryPdf(mapped, "2026-08-08T12:00:00.000Z");
  const rendered = await inspectPdf(output);
  const text = rendered.pages.join("\n");
  assert.match(text, /Owner:\s*MICHELET EUGENE/i);
  assert.match(text, /DOB:\s*01\/02\/1940/i);
  assert.match(text, /Offer\/Profit/i);
  assert.doesNotMatch(text, /\$100,000 Net/);
  assert.doesNotMatch(text, /Needs review|Discovery subject|internal status/i);
  assert.equal(S46_CLOSING_ENABLED, false);
  assert.equal(S46_CLOSING_INPUT_SCHEMA.properties.version.const, 1);
  const outputHash = await sha256(output);
  assert.notEqual(outputHash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  console.log(JSON.stringify({ ok: true, pageCount: rendered.pageCount, sha256: outputHash, closingEnabled: S46_CLOSING_ENABLED }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
