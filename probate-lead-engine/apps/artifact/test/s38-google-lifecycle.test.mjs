import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import workerModule, { WorkspaceState } from "../../worker/dist/cloudflare.js";

const worker = workerModule.default || workerModule;
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const sourceRun = JSON.parse(fs.readFileSync(
  path.join(repoRoot, "docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-source-run.json"),
  "utf8",
));
const API_TOKEN = "s38-google-lifecycle-token";
const EMAIL = "operator@heirright.com";
const DESTINATION_ID = "folder-discovery-packets";
const ESTATE_ID = "crm:podio:estate-s38-google";
const APPROVED_AT = "2026-07-15T14:00:00.000Z";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

class MemoryKv {
  values = new Map();
  options = new Map();
  failDeliveryReadback = false;
  deliveryPutSeen = false;

  async get(key) {
    if (this.failDeliveryReadback && this.deliveryPutSeen && String(key).startsWith("google-workspace-delivery:")) return null;
    return this.values.get(key) ?? null;
  }

  async put(key, value, options = {}) {
    this.values.set(key, value);
    this.options.set(key, options);
    if (String(key).startsWith("google-workspace-delivery:")) this.deliveryPutSeen = true;
  }

  async delete(key) {
    this.values.delete(key);
  }
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
    try {
      return await closure(this);
    } finally {
      release();
    }
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function multipartParts(bodyValue, contentType) {
  const boundary = String(contentType || "").match(/boundary=([^;]+)/i)?.[1] || "";
  const body = Buffer.from(bodyValue);
  const metadataStart = body.indexOf(Buffer.from("{"));
  const metadataEnd = body.indexOf(Buffer.from(`\r\n--${boundary}`), metadataStart);
  const metadata = JSON.parse(body.subarray(metadataStart, metadataEnd).toString("utf8"));
  const secondHeader = body.indexOf(Buffer.from("\r\n\r\n"), metadataEnd) + 4;
  const closing = body.lastIndexOf(Buffer.from(`\r\n--${boundary}--`));
  return { metadata, bytes: body.subarray(secondHeader, closing) };
}

class DriveMock {
  files = new Map();
  createdRecords = [];
  createCount = 0;
  deleteCount = 0;
  wrongReadback = "";
  deleteFails = false;
  createThrowsAfterStoreOnce = false;
  ocrText = "Spouse: Verified OCR Fixture\nPhone: 305-555-0110";

  async fetch(input, options = {}) {
    const url = new URL(String(input));
    const method = String(options.method || "GET").toUpperCase();
    if (url.hostname === "www.googleapis.com" && url.pathname === "/upload/drive/v3/files" && method === "POST") {
      const { metadata, bytes } = multipartParts(options.body, options.headers?.["content-type"]);
      const id = `drive-file-${++this.createCount}`;
      const file = {
        id,
        name: metadata.name,
        mimeType: metadata.mimeType,
        size: String(bytes.byteLength),
        parents: metadata.parents || [],
        appProperties: metadata.appProperties || {},
        sha256Checksum: sha256(bytes),
        webViewLink: `https://drive.google.test/file/${id}`,
        createdTime: new Date(Date.now() + this.createCount).toISOString(),
        bytes: Buffer.from(bytes),
      };
      this.files.set(id, file);
      this.createdRecords.push(structuredClone({ ...file, bytes: undefined }));
      if (this.createThrowsAfterStoreOnce) {
        this.createThrowsAfterStoreOnce = false;
        throw new Error("simulated response loss after Drive accepted upload");
      }
      return jsonResponse(file);
    }
    if (url.hostname === "www.googleapis.com" && url.pathname === "/drive/v3/files" && method === "GET") {
      const marker = String(url.searchParams.get("q") || "").match(/value='([a-f0-9]{64})'/)?.[1] || "";
      return jsonResponse({
        incompleteSearch: false,
        files: [...this.files.values()].filter((file) => file.appProperties?.heirrightMarker === marker),
      });
    }
    if (url.hostname === "docs.googleapis.com" && /^\/v1\/documents\//.test(url.pathname) && method === "GET") {
      return jsonResponse({ body: { content: [{ paragraph: { elements: [{ textRun: { content: this.ocrText } }] } }] } });
    }
    const fileMatch = url.hostname === "www.googleapis.com" && url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (fileMatch) {
      const id = decodeURIComponent(fileMatch[1]);
      if (method === "DELETE") {
        this.deleteCount += 1;
        if (!this.deleteFails) this.files.delete(id);
        return this.deleteFails ? jsonResponse({ error: "delete_failed" }, 503) : new Response(null, { status: 204 });
      }
      if (method === "PATCH") {
        const file = this.files.get(id);
        if (!file) return jsonResponse({ error: "not_found" }, 404);
        const body = JSON.parse(String(options.body || "{}"));
        file.appProperties = { ...file.appProperties, ...(body.appProperties || {}) };
        return jsonResponse(file);
      }
      const file = this.files.get(id);
      if (!file) return jsonResponse({ error: "not_found" }, 404);
      if (url.searchParams.get("alt") === "media") return new Response(file.bytes);
      if (url.searchParams.get("fields") === "id") return jsonResponse({ id });
      const readback = { ...file };
      delete readback.bytes;
      if (file.appProperties?.heirrightPurpose === "packet_export") {
        if (this.wrongReadback === "folder") readback.parents = ["wrong-folder"];
        if (this.wrongReadback === "size") readback.size = String(Number(readback.size) + 7);
      }
      return jsonResponse(readback);
    }
    throw new Error(`Unexpected external fetch: ${method} ${url}`);
  }
}

function makeEnv(kv = new MemoryKv(), storage = new MemoryDurableStorage()) {
  const workspaceState = new WorkspaceState({ storage });
  return {
    kv,
    storage,
    env: {
      AUTH_REQUIRED: "false",
      AUTH_ALLOWED_DOMAINS: "heirright.com",
      HEIRRIGHT_API_TOKEN: API_TOKEN,
      GOOGLE_OAUTH_CLIENT_ID: "google-client",
      GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
      PACKET_ARTIFACTS: kv,
      WORKSPACE_STATE: {
        idFromName(name) { return name; },
        get() { return { fetch: (request) => workspaceState.fetch(request) }; },
      },
    },
  };
}

async function call(env, pathname, body) {
  const response = await worker.fetch(new Request(`https://worker.test${pathname}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }), env);
  return { response, body: await response.json() };
}

const reviewedDossier = structuredClone(sourceRun.dossier);
reviewedDossier.id = ESTATE_ID;
const obituaryUrl = "https://source.example.test/annie-hawkins-obituary";
const obituaryRawId = `${reviewedDossier.runId}:obituary:google-lifecycle`;
reviewedDossier.audit.facts.push({
  id: obituaryRawId,
  runId: reviewedDossier.runId,
  source: "clerk_of_courts",
  rawId: obituaryRawId,
  fetchedAt: reviewedDossier.generatedAt,
  county: "miami-dade",
  subject: { estateName: reviewedDossier.summary.estateName, propertyAddress: reviewedDossier.property.address.value },
  factType: "obituary_link",
  value: obituaryUrl,
  confidence: 0.9,
  sourceUrl: obituaryUrl,
  attachment: {
    label: "Annie Hawkins obituary",
    sourceUrl: obituaryUrl,
    fileKind: "html",
    capturedAt: reviewedDossier.generatedAt,
    capturedBy: "test",
    reviewFlags: [],
  },
  reviewFlags: [],
});
reviewedDossier.marriageDeathIndicators.obituaryLink = {
  value: obituaryUrl,
  confidence: 0.9,
  sourceRefs: [{ source: "clerk_of_courts", rawId: obituaryRawId, fetchedAt: reviewedDossier.generatedAt }],
  reviewFlags: [],
};
reviewedDossier.completedLeadReport.sourceLinks.push({
  label: "Annie Hawkins obituary",
  url: obituaryUrl,
  source: "clerk_of_courts",
});
reviewedDossier.audit.facts.push({
  id: `${reviewedDossier.runId}:idi:reviewed-contact`,
  runId: reviewedDossier.runId,
  source: "idi",
  rawId: `${reviewedDossier.runId}:idi:reviewed-contact`,
  fetchedAt: reviewedDossier.generatedAt,
  county: "miami-dade",
  subject: { estateName: reviewedDossier.summary.estateName, propertyAddress: reviewedDossier.property.address.value },
  factType: "alternative_contact_profile",
  value: {
    id: `${reviewedDossier.runId}:idi:reviewed-contact`,
    name: "Sandra Hawkins",
    relationship: "child",
    age: 58,
    group: "alternative",
    phones: ["305-555-0101"],
    emails: ["sandra.hawkins@example.com"],
    currentAddress: "Miami, FL",
    addressHistory: ["Miami, FL"],
    sourceRefs: [],
    reviewStatus: "accepted",
    reviewFlags: [],
  },
  confidence: 0.86,
  sourceUrl: "https://source.example.test/reviewed-idi-report",
  reviewFlags: [],
});

const templateHarness = makeEnv();
const canonicalKey = `discovery-file:${sha256(ESTATE_ID)}`;
await templateHarness.kv.put(canonicalKey, JSON.stringify({
  estateId: ESTATE_ID,
  revision: "s38-google-canonical-1",
  dossier: reviewedDossier,
}));
const generated = await call(templateHarness.env, "/api/exports", {
  routes: [],
  dryRun: true,
  flow: "discovery",
  packetRevision: 1,
  estateId: ESTATE_ID,
  estateIds: [ESTATE_ID],
  dossiers: [reviewedDossier],
  operatorIntent: "generate_packet",
});
assert.equal(generated.response.status, 200, JSON.stringify(generated.body));
const artifactId = generated.body.artifact.artifactId;
const packetValue = await templateHarness.kv.get(`packet:${artifactId}`);
assert.ok(packetValue);
const completedReportReference = generated.body.documentArtifacts.find((document) => document.documentId === "completed-report");
assert.ok(completedReportReference, "Discovery generation must return a separated client-facing completed report");
const completedReportArtifactId = completedReportReference.artifactId;
const completedReportPacketValue = await templateHarness.kv.get(`packet:${completedReportArtifactId}`);
assert.ok(completedReportPacketValue, "The client-facing completed report must pass durable packet storage");
const canonicalValue = [...templateHarness.kv.values.entries()]
  .filter(([key]) => String(key).startsWith(canonicalKey))
  .map(([, value]) => value)
  .find((value) => JSON.parse(value).packetArtifacts?.[0]?.artifactId === artifactId);
assert.ok(canonicalValue, "Packet generation must attach the artifact to the exact canonical estate record");

{
  const packetCount = [...templateHarness.kv.values.keys()].filter((key) => String(key).startsWith("packet:")).length;
  const legacyLiveGoogle = await call(templateHarness.env, "/api/exports", {
    routes: ["google"],
    dryRun: false,
    flow: "discovery",
    packetRevision: 2,
    estateId: ESTATE_ID,
    estateIds: [ESTATE_ID],
    dossiers: [reviewedDossier],
    operatorIntent: "generate_packet",
  });
  assert.equal(legacyLiveGoogle.response.status, 409);
  assert.equal(legacyLiveGoogle.body.error, "google_handoff_requires_packet_approval", "legacy export must not bypass current-packet approval");
  const numericDryRunBypass = await call(templateHarness.env, "/api/exports", {
    routes: ["google"],
    dryRun: 0,
    controlledTest: false,
    operatorIntent: "generate_packet",
  });
  assert.equal(numericDryRunBypass.response.status, 400);
  assert.equal(numericDryRunBypass.body.error, "export_request_invalid", "non-boolean live-write flags must fail closed before route evaluation");
  const stringControlledTestBypass = await call(templateHarness.env, "/api/exports", {
    routes: ["podio"],
    dryRun: false,
    controlledTest: "true",
  });
  assert.equal(stringControlledTestBypass.response.status, 400);
  assert.equal(stringControlledTestBypass.body.error, "export_request_invalid", "truthy controlled-test strings must not unlock live writes");
  const legacyClosingGoogle = await call(templateHarness.env, "/api/closing-docs/export-google", { dryRun: false });
  assert.equal(legacyClosingGoogle.response.status, 409);
  assert.equal(legacyClosingGoogle.body.error, "google_handoff_requires_packet_approval", "legacy Closing export must use the dedicated approved-packet handoff");
  const readOnlyEvidenceResponse = await worker.fetch(new Request("https://worker.test/readback-evidence.json?dry-run=false", {
    headers: { authorization: `Bearer ${API_TOKEN}` },
  }), templateHarness.env);
  const readOnlyEvidenceBody = await readOnlyEvidenceResponse.json();
  assert.equal(readOnlyEvidenceResponse.status, 409);
  assert.equal(readOnlyEvidenceBody.error, "readback_evidence_live_write_forbidden", "read-only evidence routes must never perform live Google or Podio writes");
  assert.equal(
    [...templateHarness.kv.values.keys()].filter((key) => String(key).startsWith("packet:")).length,
    packetCount,
    "blocked legacy Google routes must stop before creating another packet artifact",
  );
}

function exportApprovalBody(overrides = {}) {
  return {
    email: EMAIL,
    actorEmail: EMAIL,
    artifactId,
    estateId: ESTATE_ID,
    flow: "discovery",
    packetRevision: 1,
    deliveryDocumentId: "completed-report",
    approvedAt: APPROVED_AT,
    approvedBy: EMAIL,
    ...overrides,
  };
}

{
  const harness = makeEnv();
  const stub = harness.env.WORKSPACE_STATE.get("heirright-team-workspace");
  const write = await stub.fetch(new Request("https://workspace-state.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key: "heirright:docprep-estate-state",
      expectedRevision: 0,
      value: JSON.stringify({
        [ESTATE_ID]: {
          discovery: {
            packetRevision: 1,
            packetApproval: exportApprovalBody({ approvedBy: "forged@attacker.test" }),
            generatedPackets: [{ packetRevision: 1, artifactId, readbackStatus: "verified" }],
          },
        },
      }),
    }),
  }));
  const writeBody = await write.json();
  assert.equal(write.status, 200);
  assert.equal(writeBody.strippedPacketApprovals, true, "generic workspace writes must strip forgeable packet approval objects");
  const read = await stub.fetch(new Request("https://workspace-state.internal/?key=heirright%3Adocprep-estate-state"));
  const readBody = await read.json();
  assert.equal(JSON.stringify(JSON.parse(readBody.value)).includes("packetApproval"), false);
}

async function prepareHarness({ attestApproval = true } = {}) {
  const harness = makeEnv();
  await harness.kv.put(`packet:${artifactId}`, packetValue);
  await harness.kv.put(`packet:${completedReportArtifactId}`, completedReportPacketValue);
  await harness.kv.put(canonicalKey, canonicalValue);
  await harness.storage.put("state:heirright:docprep-estate-state", {
    value: JSON.stringify({
      [ESTATE_ID]: {
        discovery: {
          packetRevision: 1,
          packetApproval: exportApprovalBody(),
          generatedPackets: [{
            packetRevision: 1,
            artifactId,
            readbackStatus: "verified",
          }],
        },
      },
    }),
    revision: 1,
    updatedAt: APPROVED_AT,
  });
  const connected = await call(harness.env, "/api/google-workspace/connection", {
    email: EMAIL,
    accessToken: "access-token-must-never-leak",
    refreshToken: "refresh-token-must-never-leak",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  assert.equal(connected.response.status, 200);
  const selected = await call(harness.env, "/api/google-workspace/connection", {
    action: "select_destination",
    email: EMAIL,
    destinationId: DESTINATION_ID,
    destinationName: "Discovery Packets",
  });
  assert.equal(selected.response.status, 200);
  if (attestApproval) {
    const approved = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody({
      approvedAt: "forged-client-time",
      approvedBy: "forged-client-actor@attacker.test",
      artifactContentHash: "forged-client-content-hash",
    }));
    assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
    assert.equal(approved.body.readbackStatus, "verified");
    assert.equal(approved.body.approval.approvedBy, EMAIL, "the server-attested approval actor must come from the internal signed-session binding");
    assert.notEqual(approved.body.approval.approvedAt, "forged-client-time", "the approval time must come from the durable server operation");
    assert.equal("artifactContentHash" in approved.body.approval, false, "internal approval binding hashes must not be exposed to the browser");
  }
  return harness;
}

async function storeOcrSource(harness, suffix) {
  const id = `supporting-${Date.now()}-${sha256(suffix).slice(0, 16)}`;
  const bytes = Buffer.from(`fake-pdf-${suffix}`);
  await harness.kv.put(`supporting-document:${id}`, JSON.stringify({
    id,
    estateId: `estate:${suffix}`,
    documentId: "idi-asset-search",
    fileName: "private-report-name.pdf",
    contentType: "application/pdf",
    size: bytes.byteLength,
    contentHash: sha256(bytes),
    createdAt: new Date().toISOString(),
    dataBase64: bytes.toString("base64url"),
    uploadedBy: EMAIL,
  }));
  return id;
}

async function withDriveMock(mock, closure) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock.fetch.bind(mock);
  try {
    return await closure();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

{
  const harness = await prepareHarness({ attestApproval: false });
  const beforeApproval = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody({ action: "status" }));
  assert.equal(beforeApproval.response.status, 200);
  assert.equal(beforeApproval.body.approved, false, "status hydration must report an exact unapproved current packet without failing reload");
  assert.equal(beforeApproval.body.approval, null);
  const malformedAction = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody({ action: 0 }));
  assert.equal(malformedAction.response.status, 400);
  assert.equal(malformedAction.body.error, "packet_approval_action_invalid", "non-string actions must not silently become approvals");

  const approved = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody({ action: "approve" }));
  assert.equal(approved.response.status, 200, JSON.stringify(approved.body));
  const sameActorReload = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody({ action: "status" }));
  assert.equal(sameActorReload.response.status, 200);
  assert.equal(sameActorReload.body.approved, true, "the approving operator must recover the durable attestation after reload");
  assert.deepEqual(sameActorReload.body.approval, approved.body.approval);

  const teammateReload = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody({
    action: "status",
    email: "teammate@heirright.com",
    actorEmail: "teammate@heirright.com",
  }));
  assert.equal(teammateReload.response.status, 200);
  assert.equal(teammateReload.body.approved, false, "another operator must not inherit the approving operator's handoff authority");
  assert.equal(teammateReload.body.approval, null, "actor-bound status must not expose another operator's attestation");

  const replacement = await call(harness.env, "/api/exports", {
    routes: [],
    dryRun: true,
    flow: "discovery",
    packetRevision: 2,
    estateId: ESTATE_ID,
    estateIds: [ESTATE_ID],
    dossiers: [reviewedDossier],
    operatorIntent: "generate_packet",
  });
  assert.equal(replacement.response.status, 200, JSON.stringify(replacement.body));
  const replacementStatus = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody({
    action: "status",
    artifactId: replacement.body.artifact.artifactId,
    packetRevision: 2,
  }));
  assert.equal(replacementStatus.response.status, 200);
  assert.equal(replacementStatus.body.approved, false, "a replacement packet revision must invalidate the prior display approval");
}

{
  const harness = await prepareHarness();
  const attachmentId = await storeOcrSource(harness, "ocr-success");
  const drive = new DriveMock();
  const result = await withDriveMock(drive, () => call(harness.env, "/api/discovery/idi-asset-search/ocr", { email: EMAIL, attachmentId }));
  assert.equal(result.response.status, 200);
  assert.equal(result.body.temporaryConversionDeleted, true);
  assert.equal(result.body.cleanup.deleteReadbackStatus, "verified");
  assert.match(result.body.extraction.text, /Verified OCR Fixture/);
  assert.equal(drive.files.size, 0);
  assert.equal(drive.createCount, 1);
  assert.doesNotMatch(JSON.stringify(drive.createdRecords), /private-report-name|operator@heirright\.com|Verified OCR Fixture|access-token/);
}

{
  const harness = await prepareHarness();
  const attachmentId = await storeOcrSource(harness, "ocr-delete-fail");
  const drive = new DriveMock();
  drive.deleteFails = true;
  const first = await withDriveMock(drive, () => call(harness.env, "/api/discovery/idi-asset-search/ocr", { email: EMAIL, attachmentId }));
  assert.equal(first.response.status, 503);
  assert.equal(first.body.cleanupRequired, true);
  assert.equal(first.body.temporaryConversionDeleted, false);
  assert.equal("extraction" in first.body, false);
  assert.doesNotMatch(JSON.stringify(first.body), /Verified OCR Fixture|access-token|refresh-token|drive-file-/);
  const second = await withDriveMock(drive, () => call(harness.env, "/api/discovery/idi-asset-search/ocr", { email: EMAIL, attachmentId }));
  assert.equal(second.response.status, 409);
  assert.equal(drive.createCount, 1);
}

{
  const harness = await prepareHarness({ attestApproval: false });
  const drive = new DriveMock();
  const forgedGenericState = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(forgedGenericState.response.status, 409);
  assert.equal(forgedGenericState.body.error, "packet_approval_required", "forgeable generic workspace state must never authorize Google delivery");
  assert.equal(drive.createCount, 0);
  assert.equal(drive.files.size, 0);
}

{
  const harness = await prepareHarness({ attestApproval: false });
  const [first, second] = await Promise.all([
    call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody()),
    call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody()),
  ]);
  assert.equal(first.response.status, 200, JSON.stringify(first.body));
  assert.equal(second.response.status, 200, JSON.stringify(second.body));
  assert.equal(first.body.approval.approvedAt, second.body.approval.approvedAt, "concurrent identical approvals must resolve to one durable attestation");
  assert.equal([first.body.idempotent, second.body.idempotent].filter(Boolean).length, 1);
}

{
  const harness = await prepareHarness({ attestApproval: false });
  const expiredPacket = JSON.parse(await harness.kv.get(`packet:${artifactId}`));
  expiredPacket.expiresAt = new Date(Date.now() - 1_000).toISOString();
  await harness.kv.put(`packet:${artifactId}`, JSON.stringify(expiredPacket));
  const expiredApproval = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody());
  assert.equal(expiredApproval.response.status, 410);
  assert.equal(expiredApproval.body.error, "packet_artifact_expired");
}

{
  const harness = await prepareHarness({ attestApproval: false });
  const stoppedCanonical = JSON.parse(await harness.kv.get(canonicalKey));
  stoppedCanonical.capture = { propertyAppraiser: { ownerName: "Rivera Holdings L.L.C." } };
  await harness.kv.put(canonicalKey, JSON.stringify(stoppedCanonical));
  const stoppedApproval = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody());
  assert.equal(stoppedApproval.response.status, 409);
  assert.equal(stoppedApproval.body.error, "canonical_stop_rule");
  assert.ok(stoppedApproval.body.reasonCodes.includes("COMPANY_OWNER"));
}

{
  const harness = await prepareHarness({ attestApproval: false });
  const namespace = harness.env.WORKSPACE_STATE;
  harness.env.WORKSPACE_STATE = {
    idFromName(name) { return namespace.idFromName(name); },
    get(id) {
      const stub = namespace.get(id);
      return {
        fetch(request) {
          if (new URL(request.url).pathname === "/packet-approval-operation") {
            return jsonResponse({ ok: false, error: "packet_approval_readback_failed" }, 503);
          }
          return stub.fetch(request);
        },
      };
    },
  };
  const failedApproval = await call(harness.env, "/api/doc-prep/packet-approval", exportApprovalBody());
  assert.equal(failedApproval.response.status, 503);
  assert.equal(failedApproval.body.error, "packet_approval_readback_failed");
}

{
  const harness = await prepareHarness();
  const expiredPacket = JSON.parse(await harness.kv.get(`packet:${artifactId}`));
  expiredPacket.expiresAt = new Date(Date.now() - 1_000).toISOString();
  await harness.kv.put(`packet:${artifactId}`, JSON.stringify(expiredPacket));
  const drive = new DriveMock();
  const expiredExport = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(expiredExport.response.status, 410);
  assert.equal(expiredExport.body.error, "packet_artifact_expired");
  assert.equal(drive.createCount, 0);
}

{
  const harness = await prepareHarness();
  const drive = new DriveMock();
  const bypass = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", { email: EMAIL, artifactId }));
  assert.equal(bypass.response.status, 403);
  assert.equal(bypass.body.error, "packet_approval_actor_mismatch");
  const otherActor = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody({ actorEmail: "other@heirright.com" })));
  assert.equal(otherActor.response.status, 403);
  const otherEstate = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody({ estateId: "crm:podio:other-estate" })));
  assert.equal(otherEstate.response.status, 409);
  assert.equal(otherEstate.body.error, "packet_approval_binding_mismatch");
  const staleCanonical = JSON.parse(await harness.kv.get(canonicalKey));
  staleCanonical.packetArtifacts[0].artifactId = "packet-1700000000000-fedcba9876543210";
  await harness.kv.put(canonicalKey, JSON.stringify(staleCanonical));
  const stale = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.error, "packet_approval_stale");
  assert.equal(drive.createCount, 0, "Approval bypasses and mismatches must fail before any Drive write");
  assert.equal(drive.files.size, 0);
}

for (const wrongReadback of ["folder", "size"]) {
  const harness = await prepareHarness();
  const drive = new DriveMock();
  drive.wrongReadback = wrongReadback;
  const result = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(result.response.status, 502);
  assert.equal(result.body.error, "google_workspace_readback_failed");
  assert.equal(result.body.cleanup.deleteReadbackStatus, "verified");
  assert.equal(drive.files.size, 0);
  assert.equal([...harness.kv.values.keys()].some((key) => key.startsWith("google-workspace-delivery:")), false);
}

{
  const harness = await prepareHarness();
  const drive = new DriveMock();
  drive.wrongReadback = "folder";
  drive.deleteFails = true;
  const first = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(first.response.status, 503);
  assert.equal(first.body.cleanupRequired, true);
  assert.equal(first.body.cleanup.deleteReadbackStatus, "unverified");
  assert.doesNotMatch(JSON.stringify(first.body), /drive-file-|access-token|refresh-token|%PDF/);
  const second = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(second.response.status, 409);
  assert.equal(drive.createCount, 1);
}

{
  const harness = await prepareHarness();
  const drive = new DriveMock();
  const result = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.artifactId, artifactId, "Drive delivery must remain approval-bound to the parent packet");
  assert.equal(result.body.deliveryArtifactId, completedReportArtifactId, "Drive delivery must use the separated client-facing report");
  assert.equal(result.body.deliveryDocumentId, "completed-report");
  assert.equal(drive.createdRecords[0].name, "Estate of Annie Hawkins Family Tree.pdf");
  assert.doesNotMatch(drive.createdRecords[0].name, /131 NW 67 ST|33150-0000/);
  const uploaded = [...drive.files.values()][0];
  const completedReportResponse = await worker.fetch(new Request(
    `https://worker.test/api/reports/pdf?artifactId=${completedReportArtifactId}`,
    { headers: { authorization: `Bearer ${API_TOKEN}` } },
  ), harness.env);
  assert.equal(completedReportResponse.status, 200);
  assert.deepEqual(
    uploaded.bytes,
    Buffer.from(await completedReportResponse.arrayBuffer()),
    "The bytes read back from Drive must be the exact completed-report artifact, not the internal Discovery packet",
  );
}

{
  const harness = await prepareHarness();
  harness.kv.failDeliveryReadback = true;
  const drive = new DriveMock();
  const result = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(result.response.status, 503);
  assert.equal(result.body.error, "google_workspace_delivery_readback_failed");
  assert.equal(result.body.cleanup.deleteReadbackStatus, "verified");
  assert.equal(drive.files.size, 0);
  assert.doesNotMatch(JSON.stringify(result.body), /access-token|refresh-token|%PDF|drive-file-/);
}

{
  const harness = await prepareHarness();
  const drive = new DriveMock();
  drive.createThrowsAfterStoreOnce = true;
  const first = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(first.response.status, 503);
  assert.equal(first.body.error, "google_workspace_upload_uncertain");
  assert.equal(drive.createCount, 1);
  const lockKey = [...harness.storage.values.keys()].find((key) => key.startsWith("google-drive-operation:"));
  assert.ok(lockKey);
  const stale = harness.storage.values.get(lockKey);
  stale.updatedAt = new Date(Date.now() - 16 * 60 * 1000).toISOString();
  stale.reservedAt = stale.updatedAt;
  harness.storage.values.set(lockKey, stale);
  const second = await withDriveMock(drive, () => call(harness.env, "/api/google-workspace/export", exportApprovalBody()));
  assert.equal(second.response.status, 200);
  assert.equal(second.body.reconciled, true);
  assert.equal(drive.createCount, 1);
  assert.equal(drive.files.size, 1);
}

{
  const harness = await prepareHarness();
  const drive = new DriveMock();
  const [first, second] = await withDriveMock(drive, () => Promise.all([
    call(harness.env, "/api/google-workspace/export", exportApprovalBody()),
    call(harness.env, "/api/google-workspace/export", exportApprovalBody()),
  ]));
  assert.ok([200, 409].includes(first.response.status));
  assert.ok([200, 409].includes(second.response.status));
  assert.ok(first.response.status === 200 || second.response.status === 200);
  assert.equal(drive.createCount, 1);
  assert.equal(drive.files.size, 1);
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "ocr_temp_deleted_with_get_readback_before_text_release",
    "ocr_delete_failure_withholds_text_and_blocks_second_create",
    "exact_durable_packet_approval_required_before_drive_access",
    "generic_workspace_packet_approval_forgery_stripped_and_rejected",
    "approval_actor_time_and_content_binding_attested_server_side",
    "approval_status_recovers_on_reload_and_remains_actor_bound",
    "replacement_packet_invalidates_visible_approval",
    "legacy_live_google_routes_blocked_before_packet_write",
    "concurrent_identical_approvals_are_atomic_and_idempotent",
    "expired_stopped_and_failed_readback_approvals_fail_closed",
    "expired_packet_export_stops_before_google_access",
    "stale_revision_other_actor_and_other_estate_rejected",
    "wrong_folder_and_size_cleanup_verified",
    "drive_upload_is_exact_client_facing_completed_report_artifact",
    "export_cleanup_failure_blocks_second_upload",
    "internal_receipt_failure_rolls_back_drive_file",
    "stale_reservation_recovers_attempt_marker_without_duplicate_create",
    "concurrent_export_creates_one_drive_file",
    "no_google_token_or_pdf_leakage_in_failures",
  ],
}, null, 2));
