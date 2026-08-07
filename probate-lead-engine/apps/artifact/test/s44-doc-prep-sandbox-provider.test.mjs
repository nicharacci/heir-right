import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { access, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  PDF_ARTIFACT_MIME_TYPE,
  S44_ARTIFACT_RETENTION_SECONDS,
  S44_SANDBOX_CREDENTIAL_NAMES,
  S44SandboxBoundaryError,
  runS44MicheletSandboxProvider,
  verifyOpenedPdf,
} from "../../worker/dist/doc-prep/sandbox-provider.js";
import { purgeExpiredHold, restoreArtifact, sealArtifact } from "../../../scripts/s44-artifact-hold.mjs";

const CREATED_AT = new Date("2026-08-07T12:00:00.000Z");
const EXPIRES_AT = new Date("2026-08-14T12:00:00.000Z");
const EXPECTED_ARTIFACT_BYTES = 1508;
const EXPECTED_ARTIFACT_SHA256 = "84c370abdeeb289fe41de9ad8c6c04cdd6ed9ba60bfaa35b8db8c6e80f6ab0e0";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function deterministicPdf(title, text) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setSubject("S44 synthetic sandbox contract proof");
  pdf.setAuthor("HeirRight S44 validation");
  pdf.setProducer("HeirRight S44 validation");
  pdf.setCreator("HeirRight S44 validation");
  pdf.setCreationDate(CREATED_AT);
  pdf.setModificationDate(CREATED_AT);
  const page = pdf.addPage([300, 240]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText(text, { x: 28, y: 180, size: 11, font });
  return pdf.save({ useObjectStreams: false, addDefaultPage: false, objectsPerTick: Number.POSITIVE_INFINITY });
}

function evidence(bytes) {
  return {
    schema: "heirright.s44.idi-input/v1",
    inputLabel: "michelet-idi",
    mimeType: PDF_ARTIFACT_MIME_TYPE,
    byteCount: bytes.byteLength,
    sha256: sha256(bytes),
    bytes,
  };
}

function authorization() {
  return {
    schema: "heirright.s44.sandbox-authorization/v1",
    evidenceId: "s44_auth_00112233445566778899aabbccddeeff",
    providerMode: "sandbox",
    scope: "s44:michelet-idi:doc-prep",
    authorizedAt: "2026-08-07T11:59:00.000Z",
    expiresAt: "2026-08-07T13:00:00.000Z",
    credentialNames: [...S44_SANDBOX_CREDENTIAL_NAMES],
  };
}

async function missing(path) {
  try {
    await access(path);
    return false;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

test("S44 blocks every sandbox provider side effect without authorization evidence", async () => {
  const inputPdf = await deterministicPdf("Input fixture", "Synthetic IDI input. No provider or estate data.");
  let providerCalls = 0;
  let holdCalls = 0;
  let openCalls = 0;
  await assert.rejects(
    runS44MicheletSandboxProvider({
      idiInput: evidence(inputPdf),
      provider: { async run() { providerCalls += 1; throw new Error("provider must stay closed"); } },
      hold: { async seal() { holdCalls += 1; throw new Error("hold must stay closed"); } },
      openPdf: async (bytes) => { openCalls += 1; return verifyOpenedPdf(bytes); },
      now: () => CREATED_AT,
    }),
    (error) => error instanceof S44SandboxBoundaryError && error.code === "sandbox_authorization_required",
  );
  assert.equal(providerCalls, 0);
  assert.equal(holdCalls, 0);
  assert.equal(openCalls, 0);
});

test("S44 records deterministic PDF evidence, opens the PDF, and seals the exact bytes for seven days", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-provider-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPdf = await deterministicPdf("Input fixture", "Synthetic IDI input. No provider or estate data.");
  const artifactPdf = await deterministicPdf("Output fixture", "Synthetic Doc Prep output. Sandbox contract proof only.");
  const secret = randomBytes(48).toString("base64url");
  let providerCalls = 0;
  let openCalls = 0;
  let sealed;

  const receipt = await runS44MicheletSandboxProvider({
    idiInput: evidence(inputPdf),
    authorization: authorization(),
    provider: {
      async run(request) {
        providerCalls += 1;
        assert.equal(request.inputLabel, "michelet-idi");
        assert.equal(request.inputMimeType, PDF_ARTIFACT_MIME_TYPE);
        assert.equal(request.inputByteCount, inputPdf.byteLength);
        assert.equal(request.inputSha256, sha256(inputPdf));
        assert.deepEqual(request.inputBytes, inputPdf);
        return { providerMode: "sandbox", requestId: "sandbox_request_001", artifact: { mimeType: PDF_ARTIFACT_MIME_TYPE, bytes: artifactPdf } };
      },
    },
    openPdf: async (bytes) => { openCalls += 1; return verifyOpenedPdf(bytes); },
    hold: {
      async seal({ artifactBytes, artifact, retentionSeconds }) {
        assert.equal(retentionSeconds, S44_ARTIFACT_RETENTION_SECONDS);
        assert.equal(artifact.byteCount, artifactBytes.byteLength);
        assert.equal(artifact.sha256, sha256(artifactBytes));
        const inputPath = join(directory, "transient-artifact.pdf");
        await writeFile(inputPath, artifactBytes, { mode: 0o600 });
        try {
          sealed = await sealArtifact({ inputPath, outputDirectory: join(directory, "holds"), secret, now: CREATED_AT });
        } finally {
          await unlink(inputPath);
        }
        const manifest = JSON.parse(await readFile(sealed.manifestPath, "utf8"));
        return {
          schema: "heirright.s44.encrypted-artifact-hold-receipt/v1",
          holdId: manifest.holdId,
          encrypted: true,
          algorithm: manifest.algorithm,
          createdAt: manifest.createdAt,
          expiresAt: manifest.expiresAt,
          retentionSeconds: manifest.retentionSeconds,
          plaintextBytes: manifest.plaintextBytes,
          plaintextSha256: manifest.plaintextSha256,
        };
      },
    },
    now: () => CREATED_AT,
  });

  assert.equal(providerCalls, 1);
  assert.equal(openCalls, 1);
  assert.equal(receipt.providerMode, "sandbox");
  assert.equal(receipt.artifact.mimeType, PDF_ARTIFACT_MIME_TYPE);
  assert.equal(receipt.artifact.byteCount, EXPECTED_ARTIFACT_BYTES);
  assert.equal(receipt.artifact.sha256, EXPECTED_ARTIFACT_SHA256);
  assert.equal(receipt.artifact.byteCount, artifactPdf.byteLength);
  assert.equal(receipt.artifact.sha256, sha256(artifactPdf));
  assert.equal(receipt.openedPdf.opened, true);
  assert.equal(receipt.openedPdf.pageCount, 1);
  assert.equal(receipt.encryptedHold.encrypted, true);
  assert.equal(receipt.encryptedHold.algorithm, "aes-256-gcm");
  assert.equal(receipt.encryptedHold.retentionSeconds, 604800);
  assert.equal(receipt.encryptedHold.createdAt, CREATED_AT.toISOString());
  assert.equal(receipt.encryptedHold.expiresAt, EXPIRES_AT.toISOString());
  assert.equal(receipt.encryptedHold.plaintextBytes, receipt.artifact.byteCount);
  assert.equal(receipt.encryptedHold.plaintextSha256, receipt.artifact.sha256);

  const restoredPath = join(directory, "restored.pdf");
  await restoreArtifact({ manifestPath: sealed.manifestPath, outputPath: restoredPath, secret, now: CREATED_AT });
  const restored = await readFile(restoredPath);
  assert.equal(restored.equals(Buffer.from(artifactPdf)), true);
  assert.equal((await verifyOpenedPdf(restored)).pageCount, 1);
  await unlink(restoredPath);
  await purgeExpiredHold({ manifestPath: sealed.manifestPath, now: EXPIRES_AT });
  assert.equal(await missing(sealed.manifestPath), true);
  assert.equal(await missing(sealed.ciphertextPath), true);
});

test("S44 rejects a non-PDF provider artifact before open or encrypted hold", async () => {
  const inputPdf = await deterministicPdf("Input fixture", "Synthetic IDI input. No provider or estate data.");
  let holdCalls = 0;
  let openCalls = 0;
  await assert.rejects(
    runS44MicheletSandboxProvider({
      idiInput: evidence(inputPdf),
      authorization: authorization(),
      provider: { async run() { return { providerMode: "sandbox", requestId: "sandbox_request_bad_artifact", artifact: { mimeType: "application/octet-stream", bytes: new TextEncoder().encode("not a pdf") } }; } },
      openPdf: async (bytes) => { openCalls += 1; return verifyOpenedPdf(bytes); },
      hold: { async seal() { holdCalls += 1; throw new Error("hold must stay closed"); } },
      now: () => CREATED_AT,
    }),
    (error) => error instanceof S44SandboxBoundaryError && error.code === "artifact_mime_invalid",
  );
  assert.equal(openCalls, 0);
  assert.equal(holdCalls, 0);
});
