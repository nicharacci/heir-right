import { strict as assert } from "node:assert";
import { PDFDocument } from "pdf-lib";
import { getDocumentProxy } from "unpdf";
import { renderPacketPdf } from "../documents/packet-pdf";
import type { PacketModel } from "../documents/packet-model";

async function textFromPdf(bytes: Uint8Array): Promise<string> {
  const document = await getDocumentProxy(bytes);
  const pages: string[] = [];
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await (await document.getPage(page)).getTextContent();
    pages.push(content.items.map((item) => "str" in item ? item.str : "").join(" "));
  }
  return pages.join("\n");
}

async function main(): Promise<void> {
  const model: PacketModel = {
    version: 1, flow: "discovery", title: "HeirRight Discovery Dossier", generatedAt: "2026-08-07T12:00:00.000Z", estateIds: ["case-test"], blockers: [],
    estates: [{
      dossierId: "case-test", displayName: "TEST OWNER", propertyAddress: "100 TEST STREET, MIAMI, FL 33101",
      sections: [
        { id: "estate-summary", title: "Estate Summary", lines: [{ label: "Owner of record", value: "TEST OWNER" }], sourceUrls: [], attachments: [] },
        { id: "offer-profit", title: "Offer & Profit", lines: [], sourceUrls: [], attachments: [] },
        { id: "vital-records", title: "Vital Records", lines: [{ label: "Date of birth", value: "01/01/1940" }, { label: "Date of death", value: "01/01/2020" }], sourceUrls: [], attachments: [{ id: "obituary", label: "Obituary", url: "https://example.test/obituary", source: "idi", fileKind: "link", reviewFlags: [] }] },
        { id: "backstory", title: "Back Story", lines: [{ value: "A concise factual background drawn from the verified obituary source." }], sourceUrls: [], attachments: [] },
        { id: "family-contacts", title: "Family Contacts", lines: [{ label: "Contact 1", value: "TEST HEIR | Age 45" }, { label: "Likely Current Address", value: "101 TEST STREET, MIAMI, FL 33101" }, { label: "Address (County/Parish/Borough) History", value: "101 TEST STREET, MIAMI, FL 33101\n102 TEST STREET, MIAMI, FL 33101\n103 TEST STREET, MIAMI, FL 33101\n104 TEST STREET, MIAMI, FL 33101\n105 TEST STREET, MIAMI, FL 33101" }, { label: "Phone number", value: "305-555-0100" }, { label: "Email Address", value: "test.heir@example.test" }], sourceUrls: [], attachments: [] },
      ],
    }],
    sections: ["estate-summary", "offer-profit", "vital-records", "backstory", "family-contacts"].map((id) => ({ id, title: id, estateId: "case-test" })),
  };
  const bytes = await renderPacketPdf(model);
  const byteCount = bytes.byteLength;
  assert.ok(byteCount > 0);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const opened = await PDFDocument.load(bytes);
  assert.ok(opened.getPageCount() >= 2);
  const text = await textFromPdf(bytes);
  assert.match(text, /Owner:\s*TEST OWNER/);
  assert.match(text, /DOB:\s*01\/01\/1940/);
  assert.match(text, /DOD:\s*01\/01\/2020/);
  assert.match(text, /Back Story:/);
  assert.match(text, /Heirs:/);
  assert.doesNotMatch(text, /Discovery subject|Report result|Needs review/i);
  assert.doesNotMatch(text, /Offer per heir\s+\$/i);
  console.log(JSON.stringify({ ok: true, suite: "s45-packet-contract", pages: opened.getPageCount(), bytes: byteCount }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
