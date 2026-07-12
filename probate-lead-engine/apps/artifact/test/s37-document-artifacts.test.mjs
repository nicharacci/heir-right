import assert from "node:assert/strict";
import workerModule from "../../worker/dist/cloudflare.js";

const worker = workerModule.default || workerModule;

class MemoryKv {
  values = new Map();
  async get(key) { return this.values.get(key) || null; }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
}

const env = { AUTH_REQUIRED: "false", PACKET_ARTIFACTS: new MemoryKv() };
const estateId = "estate:document-artifact-proof";
const pdfBytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
const dataBase64 = Buffer.from(pdfBytes).toString("base64");

async function upload(body) {
  const response = await worker.fetch(new Request("https://worker.test/api/documents/attachments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }), env);
  return { response, body: await response.json() };
}

const mismatched = await upload({
  estateId,
  documentId: "tax-receipt",
  fileName: "renamed.pdf",
  contentType: "application/pdf",
  dataBase64: Buffer.from("this is not a PDF").toString("base64"),
});
assert.equal(mismatched.response.status, 415);
assert.equal(mismatched.body.error, "supporting_document_type_mismatch");

const stored = await upload({
  estateId,
  documentId: "tax-receipt",
  fileName: "tax-receipt.pdf",
  contentType: "application/pdf",
  dataBase64,
  uploadedBy: "operator@heirright.com",
});
assert.equal(stored.response.status, 200);
assert.equal(stored.body.ok, true);
assert.equal(stored.body.attachment.readbackStatus, "verified");
assert.equal(stored.body.attachment.size, pdfBytes.byteLength);
assert.equal("dataBase64" in stored.body.attachment, false);

const attachmentResponse = await worker.fetch(new Request(`https://worker.test${stored.body.attachment.artifactUrl}`), env);
assert.equal(attachmentResponse.status, 200);
assert.equal(attachmentResponse.headers.get("content-type"), "application/pdf");
assert.equal(attachmentResponse.headers.get("x-heirright-artifact-id"), stored.body.attachment.id);
assert.deepEqual(new Uint8Array(await attachmentResponse.arrayBuffer()), pdfBytes);

const listResponse = await worker.fetch(new Request(`https://worker.test/api/documents/attachments?estateId=${encodeURIComponent(estateId)}`), env);
const list = await listResponse.json();
assert.equal(listResponse.status, 200);
assert.equal(list.attachments.length, 1);
assert.equal(list.attachments[0].documentId, "tax-receipt");
assert.equal("dataBase64" in list.attachments[0], false);

const deleteResponse = await worker.fetch(new Request(`https://worker.test${stored.body.attachment.artifactUrl}`, { method: "DELETE" }), env);
const deleted = await deleteResponse.json();
assert.equal(deleteResponse.status, 200);
assert.equal(deleted.deleted, true);
assert.equal(deleted.readbackStatus, "verified");
const deletedReadback = await worker.fetch(new Request(`https://worker.test${stored.body.attachment.artifactUrl}`), env);
assert.equal(deletedReadback.status, 404);

console.log(JSON.stringify({ ok: true, checks: [
  "content_signature_required",
  "backend_storage_readback",
  "byte_exact_attachment_retrieval",
  "team_attachment_index",
  "attachment_payload_not_returned_in_metadata",
  "attachment_delete_readback",
] }, null, 2));
