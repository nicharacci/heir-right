import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createSanitizedMicheletDiscoveryEvidence } from "./s44-michelet-discovery-evidence.mjs";

test("S44 creates a sanitized PDF evidence artifact once and never overwrites it", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-evidence-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "synthetic.pdf");
  const outputPath = join(directory, "evidence", "michelet-discovery.json");
  await writeFile(inputPath, Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Page >>\nendobj\n%%EOF\n"), { mode: 0o600 });

  const result = await createSanitizedMicheletDiscoveryEvidence({
    inputPath,
    outputPath,
    sourceHoldId: "9c77a70589bdc9a57d914b29ac92dc1e",
    sourceCiphertextSha256: "da839c6484b0836215dc4bdadc801ca3c50568d1638667425447156f8d8661d7",
    now: "2026-08-07T04:50:09.444Z",
  });
  const artifact = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(artifact.evidenceClass, "michelet_discovery");
  assert.equal(artifact.source.mediaType, "application/pdf");
  assert.deepEqual(artifact.source.pdfStructure, { headerVerified: true, uncompressedPageObjectCount: 1 });
  assert.equal(artifact.source.holdId, "9c77a70589bdc9a57d914b29ac92dc1e");
  assert.equal(artifact.duplicateGuard, "create-only-output-path");
  assert.equal(result.sourceSha256, artifact.source.plaintextSha256);
  assert.match(result.outputSha256, /^[0-9a-f]{64}$/);
  await assert.rejects(
    createSanitizedMicheletDiscoveryEvidence({ inputPath, outputPath, sourceHoldId: artifact.source.holdId, sourceCiphertextSha256: artifact.source.ciphertextSha256 }),
    /EEXIST/,
  );
});
