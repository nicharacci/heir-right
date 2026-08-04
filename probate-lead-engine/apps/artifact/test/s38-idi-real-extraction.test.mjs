import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { overComplexIdiDocx, searchableIdiDocx, searchableIdiPdf } from "./helpers/idi-report-fixtures.mjs";
import workerModule, { WorkspaceState } from "../../worker/dist/cloudflare.js";
import { buildIdiUploadCandidates, matchIdiReportSubject } from "../../worker/dist/enrichment/idi-upload.js";

const require = createRequire(import.meta.url);
const extractIdiReport = require("../api/discovery/idi-asset-search/extract.js");
const worker = workerModule.default || workerModule;

class MemoryKv {
  values = new Map();
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
}

class MemoryDurableStorage {
  values = new Map();
  tail = Promise.resolve();
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async transaction(closure) {
    const prior = this.tail;
    let release;
    this.tail = new Promise((resolve) => { release = resolve; });
    await prior;
    try { return await closure(this); }
    finally { release(); }
  }
}

function callHandler(body) {
  return new Promise((resolve, reject) => {
    const request = {
      method: "POST",
      body,
      headers: {},
      on() {},
      destroy() {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
      end(payload = "") {
        try {
          resolve({ statusCode: this.statusCode, headers: this.headers, json: JSON.parse(String(payload || "{}")) });
        } catch (error) {
          reject(error);
        }
      },
    };
    Promise.resolve(extractIdiReport(request, response)).catch(reject);
  });
}

const savedEnv = {
  AUTH_REQUIRED: process.env.AUTH_REQUIRED,
  HEIRRIGHT_WORKER_URL: process.env.HEIRRIGHT_WORKER_URL,
  WORKER_API_URL: process.env.WORKER_API_URL,
  WORKER_BASE_URL: process.env.WORKER_BASE_URL,
  HEIRRIGHT_API_TOKEN: process.env.HEIRRIGHT_API_TOKEN,
};
const originalFetch = globalThis.fetch;

function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const attachments = new Map();
const importRequests = [];
const deletedAttachments = [];
const transportCalls = [];

try {
  process.env.AUTH_REQUIRED = "false";
  process.env.HEIRRIGHT_WORKER_URL = "https://worker.test";
  delete process.env.WORKER_API_URL;
  delete process.env.WORKER_BASE_URL;
  process.env.HEIRRIGHT_API_TOKEN = "real-extraction-transport-token";

  const detailedContactText = [
    "Relative: Mara Rivera - Relationship: cousin - Interest: 1/9th Interest",
    "Age: 63",
    "Likely Current Address: 123 Palm Avenue, Miami, FL 33101",
    "Address History:",
    "456 Bay Street, Miami, FL 33102 (Miami-Dade County)",
    "(05/1990 - 09/2017)",
    "Phone: 305-555-0199",
    "Email: mara.rivera@example.test",
  ].join("\n");
  const detailedCandidates = buildIdiUploadCandidates({
    assetKey: "estate:detailed-contact",
    ownerName: "Estate of Rivera",
    extraction: {
      status: "extracted",
      method: "pdf_text",
      fileKind: "pdf",
      text: detailedContactText,
      sourceLocators: [{ kind: "page", index: 1, label: "PDF page 1", text: detailedContactText }],
      extractedAt: "2026-07-30T12:00:00.000Z",
    },
  });
  assert.equal(detailedCandidates.length, 1);
  assert.equal(detailedCandidates[0].age, 63);
  assert.equal(detailedCandidates[0].interest, "1/9th Interest");
  assert.equal(detailedCandidates[0].currentAddress, "123 Palm Avenue, Miami, FL 33101");
  assert.deepEqual(detailedCandidates[0].addressHistoryDetails[1], {
    address: "456 Bay Street, Miami, FL 33102",
    county: "Miami-Dade County",
    dates: "05/1990 - 09/2017",
  });
  const flattenedCandidates = buildIdiUploadCandidates({
    assetKey: "estate:flattened-contact",
    ownerName: "Estate of Rivera",
    extraction: {
      status: "extracted",
      method: "pdf_text",
      fileKind: "pdf",
      text: detailedContactText.replace(/\n/g, " "),
      sourceLocators: [{
        kind: "page",
        index: 1,
        label: "PDF page 1",
        text: detailedContactText.replace(/\n/g, " "),
      }],
      extractedAt: "2026-07-30T12:00:00.000Z",
    },
  });
  assert.equal(flattenedCandidates[0].interest, "1/9th Interest");
  assert.equal(flattenedCandidates[0].age, 63);

  const pdfBytes = await searchableIdiPdf();
  const docxBytes = searchableIdiDocx();
  const overComplexDocxBytes = overComplexIdiDocx();
  attachments.set("attachment-real-pdf", {
    bytes: pdfBytes,
    contentType: "application/pdf",
    contentHash: "sha256-real-pdf",
  });
  attachments.set("attachment-real-docx", {
    bytes: docxBytes,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    contentHash: "sha256-real-docx",
  });
  attachments.set("attachment-complex-docx", {
    bytes: overComplexDocxBytes,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    contentHash: "sha256-complex-docx",
  });

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = String(init.method || "GET").toUpperCase();
    transportCalls.push({ method, pathname: url.pathname, attachmentId: url.searchParams.get("attachmentId") || "" });

    if (url.pathname === "/api/documents/attachments" && method === "GET") {
      const attachmentId = url.searchParams.get("attachmentId");
      const attachment = attachments.get(attachmentId);
      if (!attachment) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
      return new Response(attachment.bytes, {
        status: 200,
        headers: {
          "content-type": attachment.contentType,
          "x-heirright-artifact-id": attachmentId,
          "x-heirright-content-hash": attachment.contentHash,
        },
      });
    }

    if (url.pathname === "/api/documents/attachments" && method === "DELETE") {
      const attachmentId = url.searchParams.get("attachmentId");
      deletedAttachments.push(attachmentId);
      attachments.delete(attachmentId);
      return Response.json({ ok: true, deleted: true, attachmentId });
    }

    if (url.pathname === "/api/discovery/idi-asset-search/import" && method === "POST") {
      const payload = JSON.parse(String(init.body || "{}"));
      importRequests.push(payload);
      return Response.json({
        ok: true,
        readbackStatus: "verified",
        assetKey: payload.assetKey,
        extractionMethod: payload.extraction?.method,
      });
    }

    throw new Error(`Unexpected extraction transport: ${method} ${url}`);
  };

  const pdfResult = await callHandler({
    assetKey: "estate:real-pdf",
    ownerName: "Estate of Alicia Rivera",
    attachment: { artifactId: "attachment-real-pdf", fileName: "idi-core-rivera.pdf" },
  });
  assert.equal(pdfResult.statusCode, 200);
  assert.equal(pdfResult.json.ok, true);
  const pdfImport = importRequests.at(-1);
  assert.equal(pdfImport.extraction.method, "pdf_text");
  assert.equal(pdfImport.extraction.fileKind, "pdf");
  assert.match(pdfImport.extraction.text, /Estate of Alicia Rivera/);
  assert.match(pdfImport.extraction.text, /Mateo Rivera/);
  assert.match(pdfImport.extraction.text, /305-555-0142/);
  assert.equal(pdfImport.extraction.sourceLocators.length, 2);
  assert.deepEqual(pdfImport.extraction.sourceLocators.map((locator) => locator.kind), ["page", "page"]);
  assert.deepEqual(pdfImport.extraction.sourceLocators.map((locator) => locator.label), ["PDF page 1", "PDF page 2"]);
  assert.equal(pdfImport.attachment.artifactId, "attachment-real-pdf");
  assert.equal(pdfImport.attachment.contentHash, "sha256-real-pdf");

  const docxResult = await callHandler({
    assetKey: "estate:real-docx",
    ownerName: "Estate of Alicia Rivera",
    attachment: { artifactId: "attachment-real-docx", fileName: "idi-core-rivera.docx" },
  });
  assert.equal(docxResult.statusCode, 200);
  assert.equal(docxResult.json.ok, true);
  const docxImport = importRequests.at(-1);
  assert.equal(docxImport.extraction.method, "docx_text");
  assert.equal(docxImport.extraction.fileKind, "docx");
  assert.match(docxImport.extraction.text, /Estate of Alicia Rivera/);
  assert.match(docxImport.extraction.text, /4410 Palm Avenue/);
  assert.match(docxImport.extraction.text, /305-555-0142/);
  assert.equal(docxImport.extraction.sourceLocators.length, 3);
  assert.ok(docxImport.extraction.sourceLocators.every((locator) => locator.kind === "paragraph"));
  assert.deepEqual(
    docxImport.extraction.sourceLocators.map((locator) => locator.label),
    ["DOCX paragraph 1", "DOCX paragraph 2", "DOCX paragraph 3"],
  );
  assert.equal(docxImport.attachment.artifactId, "attachment-real-docx");
  assert.equal(docxImport.attachment.contentHash, "sha256-real-docx");

  const importCountBeforeComplexityCheck = importRequests.length;
  const complexResult = await callHandler({
    assetKey: "estate:complex-docx",
    ownerName: "Estate of Archive Bomb",
    attachment: { artifactId: "attachment-complex-docx", fileName: "idi-core-complex.docx" },
  });
  assert.equal(complexResult.statusCode, 422);
  assert.equal(complexResult.json.error, "idi_report_complexity_limit");
  assert.match(complexResult.json.message, /safe report complexity limits/i);
  assert.equal(importRequests.length, importCountBeforeComplexityCheck, "an over-complex DOCX must be rejected before Worker import");
  assert.deepEqual(deletedAttachments, ["attachment-complex-docx"], "a rejected uncommitted DOCX must be deleted from attachment storage");
  assert.ok(
    transportCalls.some((call) => call.method === "DELETE" && call.attachmentId === "attachment-complex-docx"),
    "complexity rejection must perform attachment delete readback transport",
  );
  assert.equal(
    transportCalls.filter((call) => call.pathname === "/api/discovery/idi-asset-search/ocr").length,
    0,
    "searchable PDF and DOCX fixtures must exercise local pdfjs and Mammoth extraction without OCR",
  );

  const e2eKv = new MemoryKv();
  const e2eWorkspace = new WorkspaceState({ storage: new MemoryDurableStorage() });
  const e2eEnv = {
    AUTH_REQUIRED: "false",
    HEIRRIGHT_API_TOKEN: process.env.HEIRRIGHT_API_TOKEN,
    PACKET_ARTIFACTS: e2eKv,
    WORKSPACE_STATE: {
      idFromName(name) { return name; },
      get() { return { fetch: (request) => e2eWorkspace.fetch(request) }; },
    },
  };
  async function uploadRealFixture(estateId, fileName, contentType, bytes) {
    const response = await worker.fetch(new Request("https://worker.test/api/documents/attachments", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` },
      body: JSON.stringify({
        estateId,
        documentId: "idi-asset-search",
        fileName,
        contentType,
        dataBase64: Buffer.from(bytes).toString("base64"),
      }),
    }), e2eEnv);
    const payload = await response.json();
    assert.equal(response.status, 200, JSON.stringify(payload));
    return payload.attachment;
  }
  const realWorkerFixtures = [
    {
      estateId: "estate:real-worker-pdf",
      fileName: "idi-core-rivera.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes,
    },
    {
      estateId: "estate:real-worker-docx",
      fileName: "idi-core-rivera.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: docxBytes,
    },
  ];
  const realWorkerImportPayloads = [];
  globalThis.fetch = (input, init = {}) => {
    if (new URL(String(input)).pathname === "/api/discovery/idi-asset-search/import" && init.body) {
      realWorkerImportPayloads.push(JSON.parse(String(init.body)));
    }
    return worker.fetch(new Request(String(input), init), e2eEnv);
  };
  for (const fixture of realWorkerFixtures) {
    const attachment = await uploadRealFixture(fixture.estateId, fixture.fileName, fixture.contentType, fixture.bytes);
    const imported = await callHandler({
      assetKey: fixture.estateId,
      estateId: fixture.estateId,
      leadId: fixture.estateId,
      ownerName: "Estate of Alicia Rivera",
      propertyAddress: "4410 Palm Avenue, Miami, FL 33101",
      attachment: { artifactId: attachment.artifactId || attachment.id, contentHash: attachment.contentHash, fileName: fixture.fileName },
    });
    const forwarded = realWorkerImportPayloads.at(-1);
    const forwardedSubjectMatch = matchIdiReportSubject({
      extraction: forwarded.extraction,
      ownerName: forwarded.ownerName,
      propertyAddress: forwarded.propertyAddress,
      parcelId: forwarded.parcelId,
    });
    assert.equal(imported.statusCode, 200, JSON.stringify({ response: imported.json, forwardedSubjectMatch }));
    assert.equal(imported.json.readbackStatus, "verified");
    assert.equal(imported.json.subjectMatch.matched, true, `${fixture.fileName} must bind to the exact estate inside the real Worker import`);
    const reloadedResponse = await worker.fetch(new Request(
      `https://worker.test/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(fixture.estateId)}`,
      { headers: { authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}` } },
    ), e2eEnv);
    const reloaded = await reloadedResponse.json();
    assert.equal(reloadedResponse.status, 200, JSON.stringify(reloaded));
    assert.equal(reloaded.readbackStatus, "verified");
    assert.equal(reloaded.subjectMatch.matched, true);
    assert.equal(reloaded.candidates.length, 1, `${fixture.fileName} must produce one source-located contact candidate`);
    assert.equal(reloaded.candidates[0].name, "Mateo Rivera", `${fixture.fileName} must stop the labeled name before the following Phone field`);
    assert.doesNotMatch(reloaded.candidates[0].name, /\b(?:phone|email|address|relationship|status)\b/i);
  }

  console.log(JSON.stringify({
    ok: true,
    checks: [
      "real_pdfjs_searchable_pdf_extraction",
      "real_mammoth_minimal_docx_extraction",
      "extracted_text_and_source_locators_forwarded_to_worker_import",
      "docx_archive_complexity_rejected_before_import",
      "rejected_docx_attachment_cleaned_up",
      "real_pdf_and_docx_extraction_bind_through_worker_import_readback",
      "pdf_and_docx_candidate_names_stop_before_following_field_labels",
      "age_interest_county_and_dated_address_history_preserved",
    ],
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  restoreEnv();
}
