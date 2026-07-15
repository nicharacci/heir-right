const { requireApiAdmin, requireApiAuth, readJsonBody, sendJson } = require("../../_shared");
const { effectiveSession } = require("../../auth/_shared");
const mammoth = require("mammoth");
const { parse: parseCsv } = require("csv-parse/sync");
const { dirname, sep } = require("node:path");

const MAX_EXTRACTED_CHARACTERS = 250_000;
const MAX_LOCATOR_CHARACTERS = 20_000;
const MAX_LOCATOR_CHARACTERS_TOTAL = 250_000;
const MAX_SOURCE_LOCATORS = 256;
const MAX_PDF_PAGES = 200;
const MAX_DOCX_ENTRIES = 256;
const MAX_DOCX_UNCOMPRESSED_BYTES = 16_000_000;
const MAX_DOCX_COMPRESSION_RATIO = 100;
const PDFJS_STANDARD_FONT_DATA_URL = `${dirname(require.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"))}${sep}`;

function workerApiBase() {
  return String(process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "").replace(/\/+$/, "");
}

function workerHeaders(request, extra = {}) {
  const headers = { ...extra };
  if (process.env.HEIRRIGHT_API_TOKEN) headers.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
  if (request.headers.cookie) headers.cookie = request.headers.cookie;
  return headers;
}

async function workerJson(request, pathname, options = {}) {
  const base = workerApiBase();
  if (!base) throw new Error("The secure document service is unavailable.");
  const response = await fetch(`${base}${pathname}`, {
    method: options.method || "POST",
    headers: workerHeaders(request, options.headers || {}),
    body: options.body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.blockers?.[0] || data.error || `Document service returned ${response.status}.`);
    error.statusCode = response.status;
    error.code = data.error || "worker_request_failed";
    throw error;
  }
  return data;
}

async function removeUncommittedAttachment(request, attachmentId) {
  const base = workerApiBase();
  if (!base || !attachmentId) return false;
  try {
    const result = await fetch(`${base}/api/documents/attachments?attachmentId=${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
      headers: workerHeaders(request),
    });
    if (!result.ok) return false;
    const data = await result.json().catch(() => ({}));
    return data.deleted === true || data.readbackStatus === "not_found";
  } catch {
    return false;
  }
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uploadedImportPayload(body, session, attachment, extraction) {
  const estateId = String(body.estateId || body.assetKey || "").trim();
  const payload = {
    assetKey: estateId,
    estateId,
    leadId: estateId,
    ownerName: String(body.ownerName || body.owner || body.estateName || "").trim() || undefined,
    propertyAddress: String(body.propertyAddress || body.address || "").trim() || undefined,
    parcelId: String(body.parcelId || body.folio || "").trim() || undefined,
    lastSaleDate: String(body.lastSaleDate || "").trim() || undefined,
    mode: "uploaded_file",
    provider: "idi",
    importedBy: session.email,
    attachment,
    extraction,
  };
  const adminOverrideReason = String(body.adminOverrideReason || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (adminOverrideReason) payload.adminOverrideReason = adminOverrideReason;
  return payload;
}

function sourceLocatorsFromParagraphs(paragraphs, kind, label) {
  const output = [];
  let characterCount = 0;
  for (let index = 0; index < paragraphs.length && output.length < MAX_SOURCE_LOCATORS; index += 1) {
    const remaining = MAX_LOCATOR_CHARACTERS_TOTAL - characterCount;
    if (remaining <= 0) break;
    const text = String(paragraphs[index] || "").slice(0, Math.min(MAX_LOCATOR_CHARACTERS, remaining));
    if (!text.trim()) continue;
    output.push({ kind, index: index + 1, label: `${label} ${index + 1}`, text });
    characterCount += text.length;
  }
  return output;
}

function reportComplexityError(kind) {
  const error = new Error(`${kind} exceeds HeirRight's safe report complexity limits. Choose a smaller searchable report.`);
  error.code = "idi_report_complexity_limit";
  return error;
}

function preflightDocxArchive(bytes) {
  const archive = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const earliestEocd = Math.max(0, archive.length - 65_557);
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= earliestEocd; offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0 || archive.readUInt16LE(eocd + 4) !== 0 || archive.readUInt16LE(eocd + 6) !== 0) {
    throw reportComplexityError("DOCX archive");
  }
  const entriesOnDisk = archive.readUInt16LE(eocd + 8);
  const entryCount = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (!entryCount || entriesOnDisk !== entryCount || entryCount > MAX_DOCX_ENTRIES
    || centralOffset + centralSize > eocd || centralOffset >= archive.length) {
    throw reportComplexityError("DOCX archive");
  }
  let cursor = centralOffset;
  let compressedTotal = 0;
  let uncompressedTotal = 0;
  const names = new Set();
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > archive.length || archive.readUInt32LE(cursor) !== 0x02014b50) throw reportComplexityError("DOCX archive");
    const flags = archive.readUInt16LE(cursor + 8);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if ((flags & 0x1) || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || next > archive.length) {
      throw reportComplexityError("DOCX archive");
    }
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8").replaceAll("\\", "/");
    if (!name || name.startsWith("/") || name.split("/").includes("..")) throw reportComplexityError("DOCX archive");
    names.add(name);
    compressedTotal += compressedSize;
    uncompressedTotal += uncompressedSize;
    if (uncompressedSize > MAX_DOCX_UNCOMPRESSED_BYTES
      || uncompressedSize / Math.max(1, compressedSize) > MAX_DOCX_COMPRESSION_RATIO) {
      throw reportComplexityError("DOCX archive");
    }
    cursor = next;
  }
  if (cursor !== centralOffset + centralSize
    || uncompressedTotal > MAX_DOCX_UNCOMPRESSED_BYTES
    || uncompressedTotal / Math.max(1, compressedTotal) > MAX_DOCX_COMPRESSION_RATIO
    || !names.has("[Content_Types].xml")
    || !names.has("word/document.xml")) {
    throw reportComplexityError("DOCX archive");
  }
}

async function extractPdf(bytes) {
  const { DOMMatrix } = require("@napi-rs/canvas/geometry");
  globalThis.DOMMatrix ??= DOMMatrix;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    stopAtErrors: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
  });
  const document = await task.promise;
  if (document.numPages > MAX_PDF_PAGES) {
    await document.destroy();
    throw reportComplexityError("PDF");
  }
  const pages = [];
  let characterCount = 0;
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map((item) => compact(item.str)).filter(Boolean).join(" ");
      if (text) {
        characterCount += text.length;
        if (characterCount > MAX_EXTRACTED_CHARACTERS) throw reportComplexityError("PDF");
        pages.push(text);
      }
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  const text = pages.join("\n\n").slice(0, MAX_EXTRACTED_CHARACTERS);
  if (!text) {
    const error = new Error("This PDF has no readable text. Connect Google Workspace so HeirRight can scan it without changing the original file.");
    error.code = "needs_google_ocr";
    throw error;
  }
  return {
    status: "extracted",
    method: "pdf_text",
    fileKind: "pdf",
    text,
    sourceLocators: sourceLocatorsFromParagraphs(pages, "page", "PDF page"),
    extractedAt: new Date().toISOString(),
  };
}

async function extractDocx(bytes) {
  preflightDocxArchive(bytes);
  const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const paragraphs = String(result.value || "").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const text = paragraphs.join("\n\n").slice(0, MAX_EXTRACTED_CHARACTERS);
  if (!text) throw new Error("This DOCX has no readable text. Keep Discovery blocked and review the original report.");
  return {
    status: "extracted",
    method: "docx_text",
    fileKind: "docx",
    text,
    sourceLocators: sourceLocatorsFromParagraphs(paragraphs, "paragraph", "DOCX paragraph"),
    extractedAt: new Date().toISOString(),
  };
}

function extractCsv(bytes) {
  const rows = parseCsv(Buffer.from(bytes).toString("utf8"), {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    max_record_size: 100_000,
  }).slice(0, 10_000);
  const lineRows = rows.map((row) => row.map((cell) => compact(cell)).filter(Boolean).join(" | ")).filter(Boolean);
  const text = lineRows.join("\n").slice(0, MAX_EXTRACTED_CHARACTERS);
  if (!text) throw new Error("This CSV has no readable rows. Keep Discovery blocked and review the original report.");
  return {
    status: "extracted",
    method: "csv_rows",
    fileKind: "csv",
    text,
    sourceLocators: sourceLocatorsFromParagraphs(lineRows, "row", "CSV row"),
    extractedAt: new Date().toISOString(),
  };
}

async function extractWithGoogleWorkspace(request, session, attachmentId) {
  const result = await workerJson(request, "/api/discovery/idi-asset-search/ocr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: session.email, attachmentId }),
  });
  if (!result.extraction?.text) throw new Error("Google Workspace did not return readable report text.");
  return result.extraction;
}

async function extractReport(request, session, attachment, bytes) {
  if (attachment.contentType === "application/pdf") {
    try {
      return await extractPdf(bytes);
    } catch (error) {
      if (error.code !== "needs_google_ocr") throw error;
      return extractWithGoogleWorkspace(request, session, attachment.id);
    }
  }
  if (attachment.contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return extractDocx(bytes);
  if (attachment.contentType === "text/csv") return extractCsv(bytes);
  if (["image/jpeg", "image/png", "image/webp", "application/msword"].includes(attachment.contentType)) {
    return extractWithGoogleWorkspace(request, session, attachment.id);
  }
  throw new Error("This report type is not supported for Discovery extraction.");
}

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  let attachmentId = "";
  let importCommitted = false;
  try {
    const body = await readJsonBody(request);
    const session = effectiveSession(request) || (process.env.AUTH_REQUIRED === "false" ? { email: "local-review@heirright.com" } : null);
    const attachment = body.attachment && typeof body.attachment === "object" ? body.attachment : {};
    attachmentId = String(attachment.artifactId || attachment.id || "").trim();
    const adminOverrideReason = compact(body.adminOverrideReason).slice(0, 500);
    if (adminOverrideReason) {
      if (requireApiAdmin(request, response)) {
        await removeUncommittedAttachment(request, attachmentId);
        return;
      }
      if (adminOverrideReason.length < 12) {
        await removeUncommittedAttachment(request, attachmentId);
        sendJson(response, 422, {
          ok: false,
          error: "idi_replacement_reason_required",
          message: "Describe why this estate's verified IDI report is being replaced.",
        });
        return;
      }
      body.adminOverrideReason = adminOverrideReason;
    }
    const assetKey = String(body.assetKey || body.estateId || "").trim();
    const estateId = String(body.estateId || assetKey).trim();
    const leadId = String(body.leadId || estateId).trim();
    if (!session?.email || !assetKey || assetKey !== estateId || leadId !== estateId || !attachmentId) {
      if (attachmentId) await removeUncommittedAttachment(request, attachmentId);
      sendJson(response, 400, { ok: false, error: "idi_estate_identity_mismatch", message: "Choose one current estate before starting IDI extraction. The report cannot be attached across estate records." });
      return;
    }
    body.assetKey = estateId;
    body.estateId = estateId;
    body.leadId = estateId;
    const base = workerApiBase();
    if (!base) {
      sendJson(response, 503, { ok: false, error: "worker_unavailable", message: "The secure document service is unavailable." });
      return;
    }
    const artifactResponse = await fetch(`${base}/api/documents/attachments?attachmentId=${encodeURIComponent(attachmentId)}`, {
      headers: workerHeaders(request),
    });
    const bytes = new Uint8Array(await artifactResponse.arrayBuffer());
    const artifactId = artifactResponse.headers.get("x-heirright-artifact-id");
    const contentHash = artifactResponse.headers.get("x-heirright-content-hash");
    const contentType = artifactResponse.headers.get("content-type") || "";
    if (!artifactResponse.ok || artifactId !== attachmentId || !contentHash || !contentType || bytes.byteLength > 3_000_000) {
      await removeUncommittedAttachment(request, attachmentId);
      sendJson(response, 409, { ok: false, error: "idi_attachment_readback_failed", message: "The uploaded IDI report did not pass secure artifact readback." });
      return;
    }
    const verifiedAttachment = {
      id: artifactId,
      artifactId,
      sourceUrl: `/api/documents/attachments?attachmentId=${encodeURIComponent(artifactId)}`,
      fileName: String(attachment.fileName || "IDI report").slice(0, 180),
      contentType,
      contentHash,
      size: bytes.byteLength,
    };
    const extraction = await extractReport(request, session, verifiedAttachment, bytes);
    const imported = await workerJson(request, "/api/discovery/idi-asset-search/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(uploadedImportPayload(body, session, verifiedAttachment, extraction)),
    });
    importCommitted = true;
    sendJson(response, 200, imported);
  } catch (error) {
    if (attachmentId && !importCommitted) await removeUncommittedAttachment(request, attachmentId);
    sendJson(response, error.statusCode || 422, {
      ok: false,
      error: error.code || "idi_extraction_failed",
      message: error.message || "The IDI report could not be extracted safely.",
    });
  }
};
