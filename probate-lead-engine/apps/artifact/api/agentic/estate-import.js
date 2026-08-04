const { createHash } = require("node:crypto");
const { readJsonBody, requireApiAuth, sendJson, proxyWorkerHttp } = require("../_shared");
const { extractEstateUpload, decodeCsvText } = require("../../runtime-functions/idi-extract.cjs");

const MAX_ESTATE_FILE_BYTES = 3_000_000;
const MAX_BASE64_CHARACTERS = 4_100_000;

function intakeError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function supportedFile(body) {
  const rawName = String(body.fileName || "").trim();
  const fileName = rawName.split(/[\\/]/).at(-1)?.slice(0, 180) || "";
  const suppliedType = String(body.contentType || "").trim().toLowerCase();
  const isPdf = /\.pdf$/i.test(fileName);
  const isCsv = /\.csv$/i.test(fileName);
  if (!fileName || (!isPdf && !isCsv)) {
    throw intakeError("Choose a PDF or CSV file to continue.", "estate_upload_type_unsupported", 415);
  }
  if (isPdf && suppliedType && suppliedType !== "application/pdf") {
    throw intakeError("The selected PDF has an unexpected file type.", "estate_upload_type_mismatch", 415);
  }
  if (isCsv && suppliedType && !["text/csv", "application/csv", "text/plain"].includes(suppliedType)) {
    throw intakeError("The selected CSV has an unexpected file type.", "estate_upload_type_mismatch", 415);
  }
  return { fileName, contentType: isPdf ? "application/pdf" : "text/csv" };
}

function uploadedBytes(value) {
  const encoded = String(value || "");
  if (!encoded || encoded.length > MAX_BASE64_CHARACTERS || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw intakeError("The uploaded file could not be read safely.", "estate_upload_invalid_base64", 422);
  }
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length) throw intakeError("Choose a non-empty PDF or CSV.", "estate_upload_empty", 422);
  if (bytes.length > MAX_ESTATE_FILE_BYTES) {
    throw intakeError("Choose a PDF or CSV no larger than 3 MB.", "estate_upload_too_large", 413);
  }
  if (bytes.toString("base64") !== encoded) {
    throw intakeError("The uploaded file could not be read safely.", "estate_upload_invalid_base64", 422);
  }
  return bytes;
}

function validateFileBytes(contentType, bytes) {
  if (contentType === "application/pdf") {
    if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw intakeError("The selected file is not a valid PDF.", "estate_upload_invalid_pdf", 422);
    }
    return;
  }
  if (bytes.includes(0)) {
    throw intakeError("The selected CSV contains binary data.", "estate_upload_invalid_csv", 422);
  }
  try {
    decodeCsvText(bytes);
  } catch (error) {
    throw intakeError(error.message || "The selected CSV could not be decoded safely.", "estate_upload_invalid_csv", 422);
  }
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (requireApiAuth(request, response)) return;
  try {
    const body = await readJsonBody(request);
    const file = supportedFile(body);
    const bytes = uploadedBytes(body.contentBase64);
    validateFileBytes(file.contentType, bytes);
    const extraction = await extractEstateUpload(file.contentType, bytes);
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    const workerBody = JSON.stringify({
      fileName: file.fileName,
      fileKind: extraction.fileKind,
      sourceHash,
      sourceMethod: extraction.method,
      sourceLocators: extraction.sourceLocators,
      text: extraction.text,
      model: String(body.model || "").trim().slice(0, 180),
    });
    if (await proxyWorkerHttp(request, response, "/api/agentic/estate-import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: workerBody,
    })) return;
    sendJson(response, 503, {
      ok: false,
      error: "agentic_unavailable",
      message: "A verified free Nous model is not available for estate file parsing.",
    });
  } catch (error) {
    sendJson(response, error.statusCode || 422, {
      ok: false,
      error: error.code || "estate_upload_failed",
      message: error.message || "The estate file could not be parsed safely.",
    });
  }
};
