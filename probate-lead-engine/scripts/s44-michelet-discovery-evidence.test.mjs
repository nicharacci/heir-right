import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createSanitizedMicheletDiscoveryEvidence,
  verifySanitizedMicheletDiscoveryEvidence,
} from "./s44-michelet-discovery-evidence.mjs";

const estateBindingSha256 = "d47039ac8ea9898fc4cc803e4bbf0085e3300ef68e5ef5387a5b03368eb21e1a";
const sourceCiphertextSha256 = "da839c6484b0836215dc4bdadc801ca3c50568d1638667425447156f8d8661d7";
const sourceHoldId = "9c77a70589bdc9a57d914b29ac92dc1e";

test("S44 creates a sanitized PDF evidence artifact once and never overwrites it", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-evidence-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "source-with-private-name.pdf");
  const outputPath = join(directory, "evidence", "michelet-discovery.json");
  const privateMarker = "synthetic-private-contact@example.invalid";
  await writeFile(inputPath, Buffer.from(`%PDF-1.7\n${privateMarker}\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF\n`), { mode: 0o600 });

  const result = await createSanitizedMicheletDiscoveryEvidence({
    inputPath,
    outputPath,
    sourceHoldId,
    sourceCiphertextSha256,
    estateBindingSha256,
    now: "2026-08-07T04:50:09.444Z",
  });
  const artifact = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(artifact.evidenceClass, "michelet_discovery");
  assert.equal(artifact.source.mediaType, "application/pdf");
  assert.deepEqual(artifact.source.pdfStructure, { headerVerified: true, uncompressedPageObjectCount: 1 });
  assert.equal(artifact.source.holdId, sourceHoldId);
  assert.equal(artifact.provenance, "sandbox_encrypted_hold");
  assert.equal(artifact.estateBindingSha256, estateBindingSha256);
  assert.equal(artifact.duplicateGuard, "create-only-output-path");
  assert.equal(result.sourceSha256, artifact.source.plaintextSha256);
  assert.match(result.outputSha256, /^[0-9a-f]{64}$/);
  assert.equal((await stat(outputPath)).mode & 0o777, 0o600);
  assert.equal(JSON.stringify(artifact).includes(privateMarker), false);
  assert.equal(JSON.stringify(artifact).includes("source-with-private-name.pdf"), false);
  const verified = await verifySanitizedMicheletDiscoveryEvidence({
    artifactPath: outputPath,
    estateBindingSha256,
    sourceHoldId,
    sourceCiphertextSha256,
    sourcePlaintextSha256: result.sourceSha256,
  });
  assert.equal(verified.sourceSha256, result.sourceSha256);
  assert.equal(verified.artifactSha256, result.outputSha256);
  await assert.rejects(
    createSanitizedMicheletDiscoveryEvidence({ inputPath, outputPath, sourceHoldId: artifact.source.holdId, sourceCiphertextSha256: artifact.source.ciphertextSha256, estateBindingSha256 }),
    /EEXIST/,
  );
});

test("S44 fails closed for malformed, wrong-estate, missing, interrupted, and tampered evidence", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-falsification-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "synthetic.pdf");
  const outputPath = join(directory, "evidence.json");
  await writeFile(inputPath, "%PDF-1.7\n%%EOF\n", { mode: 0o600 });

  await assert.rejects(
    createSanitizedMicheletDiscoveryEvidence({ inputPath, outputPath, sourceHoldId, sourceCiphertextSha256, estateBindingSha256: "not-a-digest" }),
    /estate binding digest/,
  );
  const result = await createSanitizedMicheletDiscoveryEvidence({ inputPath, outputPath, sourceHoldId, sourceCiphertextSha256, estateBindingSha256 });
  await assert.rejects(
    verifySanitizedMicheletDiscoveryEvidence({ artifactPath: outputPath, estateBindingSha256: "a".repeat(64) }),
    /estate binding does not match/,
  );
  await assert.rejects(
    verifySanitizedMicheletDiscoveryEvidence({ artifactPath: join(directory, "missing.json"), estateBindingSha256 }),
    /ENOENT/,
  );
  await writeFile(join(directory, "partial.json"), "{", { mode: 0o600 });
  await assert.rejects(
    verifySanitizedMicheletDiscoveryEvidence({ artifactPath: join(directory, "partial.json"), estateBindingSha256 }),
    /valid JSON/,
  );
  await assert.rejects(
    createSanitizedMicheletDiscoveryEvidence({ inputPath, outputPath: join(directory, "partial.json"), sourceHoldId, sourceCiphertextSha256, estateBindingSha256 }),
    /EEXIST/,
  );
  assert.equal(await readFile(join(directory, "partial.json"), "utf8"), "{");
  const artifact = JSON.parse(await readFile(outputPath, "utf8"));
  artifact.source.plaintextSha256 = "b".repeat(64);
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`, { mode: 0o600 });
  await assert.rejects(
    verifySanitizedMicheletDiscoveryEvidence({ artifactPath: outputPath, estateBindingSha256, sourcePlaintextSha256: result.sourceSha256 }),
    /source plaintext digest does not match/,
  );
});

test("S44 rejects malformed source bytes and artifact fields that could carry unredacted data", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-redaction-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const malformedInputPath = join(directory, "malformed-input.bin");
  const outputPath = join(directory, "evidence.json");
  await writeFile(malformedInputPath, "not a PDF", { mode: 0o600 });
  await assert.rejects(
    createSanitizedMicheletDiscoveryEvidence({ inputPath: malformedInputPath, outputPath, sourceHoldId, sourceCiphertextSha256, estateBindingSha256 }),
    /must be a PDF/,
  );
  const inputPath = join(directory, "synthetic.pdf");
  await writeFile(inputPath, "%PDF-1.7\n%%EOF\n", { mode: 0o600 });
  await createSanitizedMicheletDiscoveryEvidence({ inputPath, outputPath, sourceHoldId, sourceCiphertextSha256, estateBindingSha256 });
  const artifact = JSON.parse(await readFile(outputPath, "utf8"));
  artifact.source.inputPath = "/private/input.pdf";
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`, { mode: 0o600 });
  await assert.rejects(
    verifySanitizedMicheletDiscoveryEvidence({ artifactPath: outputPath, estateBindingSha256 }),
    /unsupported fields/,
  );
});
