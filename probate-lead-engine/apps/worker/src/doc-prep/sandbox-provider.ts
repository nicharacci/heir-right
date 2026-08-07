import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";

export const S44_SANDBOX_CREDENTIAL_NAMES = [
  "S44_IDI_SANDBOX_API_URL",
  "S44_IDI_SANDBOX_API_TOKEN",
  "S44_IDI_SANDBOX_RUN_AUTHORIZATION",
  "S44_ARTIFACT_HOLD_KEY",
] as const;
export const S44_ARTIFACT_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const PDF_ARTIFACT_MIME_TYPE = "application/pdf";
export type S44SandboxCredentialName = typeof S44_SANDBOX_CREDENTIAL_NAMES[number];

export interface S44IdiInputEvidence {
  schema: "heirright.s44.idi-input/v1";
  inputLabel: "michelet-idi";
  mimeType: "application/pdf";
  byteCount: number;
  sha256: string;
  bytes: Uint8Array;
}

export interface S44SandboxAuthorizationEvidence {
  schema: "heirright.s44.sandbox-authorization/v1";
  evidenceId: string;
  providerMode: "sandbox";
  scope: "s44:michelet-idi:doc-prep";
  authorizedAt: string;
  expiresAt: string;
  credentialNames: readonly S44SandboxCredentialName[];
}

export interface S44SandboxProviderRequest {
  schema: "heirright.s44.sandbox-provider-request/v1";
  inputLabel: "michelet-idi";
  inputMimeType: "application/pdf";
  inputByteCount: number;
  inputSha256: string;
  inputBytes: Uint8Array;
  authorizationEvidenceId: string;
}

export interface S44SandboxProviderResponse {
  providerMode: "sandbox";
  requestId: string;
  artifact: { mimeType: string; bytes: Uint8Array };
}

export interface S44SandboxProviderPort {
  run(request: S44SandboxProviderRequest): Promise<S44SandboxProviderResponse>;
}

export interface OpenedPdfReceipt {
  schema: "heirright.s44.opened-pdf/v1";
  opened: true;
  pageCount: number;
  verifier: "pdf-lib";
}

export interface PdfArtifactEvidence {
  schema: "heirright.s44.pdf-artifact/v1";
  mimeType: "application/pdf";
  byteCount: number;
  sha256: string;
}

export interface EncryptedArtifactHoldReceipt {
  schema: "heirright.s44.encrypted-artifact-hold-receipt/v1";
  holdId: string;
  encrypted: true;
  algorithm: "aes-256-gcm";
  createdAt: string;
  expiresAt: string;
  retentionSeconds: number;
  plaintextBytes: number;
  plaintextSha256: string;
}

export interface EncryptedArtifactHoldPort {
  seal(input: {
    artifactBytes: Uint8Array;
    artifact: PdfArtifactEvidence;
    retentionSeconds: typeof S44_ARTIFACT_RETENTION_SECONDS;
  }): Promise<EncryptedArtifactHoldReceipt>;
}

export interface S44SandboxRunReceipt {
  schema: "heirright.s44.sandbox-run-receipt/v1";
  providerMode: "sandbox";
  providerRequestId: string;
  authorizationEvidenceId: string;
  input: Omit<S44IdiInputEvidence, "bytes">;
  artifact: PdfArtifactEvidence;
  openedPdf: OpenedPdfReceipt;
  encryptedHold: EncryptedArtifactHoldReceipt;
  verifiedAt: string;
}

export class S44SandboxBoundaryError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "S44SandboxBoundaryError";
  }
}

function fail(code: string, message: string): never {
  throw new S44SandboxBoundaryError(code, message);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function validTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) fail(`${label}_invalid`, `${label} must be a valid timestamp`);
  return timestamp;
}

function exactCredentialManifest(names: readonly S44SandboxCredentialName[]): boolean {
  return names.length === S44_SANDBOX_CREDENTIAL_NAMES.length
    && S44_SANDBOX_CREDENTIAL_NAMES.every((name) => names.includes(name));
}

function verifyAuthorization(authorization: S44SandboxAuthorizationEvidence | undefined, now: Date): S44SandboxAuthorizationEvidence {
  if (!authorization) fail("sandbox_authorization_required", "Sandbox provider authorization evidence is required before any provider call.");
  if (authorization.schema !== "heirright.s44.sandbox-authorization/v1"
    || authorization.providerMode !== "sandbox"
    || authorization.scope !== "s44:michelet-idi:doc-prep") {
    fail("sandbox_authorization_invalid", "Sandbox provider authorization has the wrong scope or mode.");
  }
  if (!/^s44_auth_[0-9a-f]{32}$/.test(authorization.evidenceId)) {
    fail("sandbox_authorization_invalid", "Sandbox provider authorization evidence ID is invalid.");
  }
  if (!exactCredentialManifest(authorization.credentialNames)) {
    fail("sandbox_credential_manifest_invalid", "Sandbox authorization must name the complete sandbox-only credential manifest.");
  }
  const authorizedAt = validTimestamp(authorization.authorizedAt, "authorized_at");
  const expiresAt = validTimestamp(authorization.expiresAt, "authorization_expiry");
  const currentTime = now.getTime();
  if (expiresAt <= authorizedAt || currentTime < authorizedAt || currentTime >= expiresAt) {
    fail("sandbox_authorization_inactive", "Sandbox provider authorization is not active at the time of the run.");
  }
  return authorization;
}

function isPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const header = new TextDecoder().decode(bytes.subarray(0, 5));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.byteLength - 1024)));
  return header === "%PDF-" && tail.includes("%%EOF");
}

export function pdfArtifactEvidence(bytes: Uint8Array, mimeType: string): PdfArtifactEvidence {
  if (mimeType !== PDF_ARTIFACT_MIME_TYPE) fail("artifact_mime_invalid", "The sandbox provider artifact must be application/pdf.");
  if (!isPdf(bytes)) fail("artifact_pdf_signature_invalid", "The sandbox provider artifact is not a complete PDF.");
  return {
    schema: "heirright.s44.pdf-artifact/v1",
    mimeType: PDF_ARTIFACT_MIME_TYPE,
    byteCount: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

function verifyInput(input: S44IdiInputEvidence): void {
  if (input.schema !== "heirright.s44.idi-input/v1" || input.inputLabel !== "michelet-idi") {
    fail("idi_input_identity_invalid", "The S44 sandbox accepts only the designated Michelet IDI input contract.");
  }
  const evidence = pdfArtifactEvidence(input.bytes, input.mimeType);
  if (input.byteCount !== evidence.byteCount || input.sha256 !== evidence.sha256) {
    fail("idi_input_evidence_mismatch", "The Michelet IDI input bytes do not match their byte-count and SHA-256 evidence.");
  }
}

export async function verifyOpenedPdf(bytes: Uint8Array): Promise<OpenedPdfReceipt> {
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch {
    fail("artifact_pdf_open_failed", "The sandbox provider artifact could not be opened as a PDF.");
  }
  const pageCount = document.getPageCount();
  if (pageCount < 1) fail("artifact_pdf_page_count_invalid", "The opened PDF contains no pages.");
  return { schema: "heirright.s44.opened-pdf/v1", opened: true, pageCount, verifier: "pdf-lib" };
}

function verifyHoldReceipt(receipt: EncryptedArtifactHoldReceipt, artifact: PdfArtifactEvidence): void {
  if (receipt.schema !== "heirright.s44.encrypted-artifact-hold-receipt/v1"
    || receipt.encrypted !== true
    || receipt.algorithm !== "aes-256-gcm"
    || !/^[0-9a-f]{32}$/.test(receipt.holdId)
    || receipt.retentionSeconds !== S44_ARTIFACT_RETENTION_SECONDS
    || receipt.plaintextBytes !== artifact.byteCount
    || receipt.plaintextSha256 !== artifact.sha256) {
    fail("encrypted_hold_evidence_mismatch", "The encrypted hold receipt does not match the verified PDF artifact.");
  }
  const createdAt = validTimestamp(receipt.createdAt, "hold_created_at");
  const expiresAt = validTimestamp(receipt.expiresAt, "hold_expires_at");
  if (expiresAt - createdAt !== S44_ARTIFACT_RETENTION_SECONDS * 1000) {
    fail("encrypted_hold_retention_invalid", "The encrypted artifact hold must expire exactly seven days after creation.");
  }
}

export async function runS44MicheletSandboxProvider(input: {
  idiInput: S44IdiInputEvidence;
  authorization?: S44SandboxAuthorizationEvidence;
  provider: S44SandboxProviderPort;
  hold: EncryptedArtifactHoldPort;
  openPdf?: (bytes: Uint8Array) => Promise<OpenedPdfReceipt>;
  now?: () => Date;
}): Promise<S44SandboxRunReceipt> {
  const now = input.now?.() ?? new Date();
  const authorization = verifyAuthorization(input.authorization, now);
  verifyInput(input.idiInput);
  const providerResult = await input.provider.run({
    schema: "heirright.s44.sandbox-provider-request/v1",
    inputLabel: input.idiInput.inputLabel,
    inputMimeType: input.idiInput.mimeType,
    inputByteCount: input.idiInput.byteCount,
    inputSha256: input.idiInput.sha256,
    inputBytes: input.idiInput.bytes,
    authorizationEvidenceId: authorization.evidenceId,
  });
  if (providerResult.providerMode !== "sandbox") fail("provider_mode_invalid", "The provider response did not come from the sandbox boundary.");
  if (!/^[a-zA-Z0-9._:-]{1,200}$/.test(providerResult.requestId)) fail("provider_request_id_invalid", "The sandbox provider request ID is invalid.");
  const artifact = pdfArtifactEvidence(providerResult.artifact.bytes, providerResult.artifact.mimeType);
  const openedPdf = await (input.openPdf ?? verifyOpenedPdf)(providerResult.artifact.bytes);
  if (openedPdf.opened !== true || openedPdf.pageCount < 1) fail("artifact_pdf_open_failed", "The opened-PDF verification hook did not verify the artifact.");
  const encryptedHold = await input.hold.seal({ artifactBytes: providerResult.artifact.bytes, artifact, retentionSeconds: S44_ARTIFACT_RETENTION_SECONDS });
  verifyHoldReceipt(encryptedHold, artifact);
  return {
    schema: "heirright.s44.sandbox-run-receipt/v1",
    providerMode: "sandbox",
    providerRequestId: providerResult.requestId,
    authorizationEvidenceId: authorization.evidenceId,
    input: {
      schema: input.idiInput.schema,
      inputLabel: input.idiInput.inputLabel,
      mimeType: input.idiInput.mimeType,
      byteCount: input.idiInput.byteCount,
      sha256: input.idiInput.sha256,
    },
    artifact,
    openedPdf,
    encryptedHold,
    verifiedAt: now.toISOString(),
  };
}
