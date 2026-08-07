#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { link, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MICHELET_DISCOVERY_EVIDENCE_SCHEMA = "heirright.s44.michelet-discovery-evidence/v2";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireAbsolutePath(filePath, label) {
  if (typeof filePath !== "string" || !isAbsolute(filePath)) {
    throw new Error(`${label} must be an explicit absolute path`);
  }
  return resolve(filePath);
}

async function requireRegularFile(filePath, label) {
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file and cannot be a symbolic link`);
  }
  return stat;
}

function requireSourceHash(value, label) {
  if (!/^[0-9a-f]{64}$/.test(value || "")) throw new Error(`${label} must be a SHA-256 hex digest`);
  return value;
}

function requireEstateBinding(value) {
  return requireSourceHash(value, "estate binding digest");
}

function canonicalEvidencePayload(evidence) {
  return `${JSON.stringify(evidence)}\n`;
}

function assertExactKeys(value, expectedKeys, label) {
  const actualKeys = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actualKeys.length !== expected.length || actualKeys.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unsupported fields`);
  }
}

function assertArtifactShape(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) throw new Error("evidence artifact must be a JSON object");
  assertExactKeys(artifact, ["schema", "evidenceClass", "provenance", "estateBindingSha256", "source", "generatedAt", "duplicateGuard", "evidencePayloadSha256"], "evidence artifact");
  if (artifact.schema !== MICHELET_DISCOVERY_EVIDENCE_SCHEMA) throw new Error("unsupported evidence artifact schema");
  if (artifact.evidenceClass !== "michelet_discovery") throw new Error("unsupported evidence class");
  if (artifact.provenance !== "sandbox_encrypted_hold") throw new Error("unsupported evidence provenance");
  requireEstateBinding(artifact.estateBindingSha256);
  if (!artifact.source || typeof artifact.source !== "object" || Array.isArray(artifact.source)) throw new Error("evidence source is invalid");
  assertExactKeys(artifact.source, ["holdId", "ciphertextSha256", "plaintextSha256", "plaintextBytes", "mediaType", "pdfStructure"], "evidence source");
  if (!/^[0-9a-f]{32}$/.test(artifact.source.holdId || "")) throw new Error("source hold ID is invalid");
  requireSourceHash(artifact.source.ciphertextSha256, "source ciphertext digest");
  requireSourceHash(artifact.source.plaintextSha256, "source plaintext digest");
  if (!Number.isSafeInteger(artifact.source.plaintextBytes) || artifact.source.plaintextBytes < 0) throw new Error("source byte count is invalid");
  if (!artifact.source.pdfStructure || typeof artifact.source.pdfStructure !== "object" || Array.isArray(artifact.source.pdfStructure)) throw new Error("source PDF structure is invalid");
  assertExactKeys(artifact.source.pdfStructure, ["headerVerified", "uncompressedPageObjectCount"], "source PDF structure");
  if (artifact.source.mediaType !== "application/pdf" || artifact.source.pdfStructure.headerVerified !== true
    || !Number.isSafeInteger(artifact.source.pdfStructure?.uncompressedPageObjectCount)
    || artifact.source.pdfStructure.uncompressedPageObjectCount < 0) throw new Error("source PDF structure is invalid");
  if (artifact.duplicateGuard !== "create-only-output-path") throw new Error("unsupported duplicate guard");
  if (typeof artifact.generatedAt !== "string" || Number.isNaN(new Date(artifact.generatedAt).getTime())) throw new Error("generated timestamp is invalid");
  requireSourceHash(artifact.evidencePayloadSha256, "evidence payload digest");
}

function inspectPdfStructure(bytes) {
  if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
    throw new Error("discovery source must be a PDF");
  }
  return {
    headerVerified: true,
    uncompressedPageObjectCount: (bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length,
  };
}

export async function createSanitizedMicheletDiscoveryEvidence({
  inputPath,
  inputBytes,
  outputPath,
  sourceHoldId,
  sourceCiphertextSha256,
  estateBindingSha256,
  now = new Date(),
}) {
  const resolvedOutputPath = requireAbsolutePath(outputPath, "evidence output path");
  if (inputBytes !== undefined && !Buffer.isBuffer(inputBytes)) throw new Error("discovery input bytes must be a Buffer");
  if (inputBytes === undefined) {
    const resolvedInputPath = requireAbsolutePath(inputPath, "discovery input path");
    await requireRegularFile(resolvedInputPath, "discovery input");
  }
  if (!/^[0-9a-f]{32}$/.test(sourceHoldId || "")) throw new Error("source hold ID is invalid");
  requireSourceHash(sourceCiphertextSha256, "source ciphertext digest");
  requireEstateBinding(estateBindingSha256);

  const bytes = inputBytes ?? await readFile(requireAbsolutePath(inputPath, "discovery input path"));
  try {
    const sourceSha256 = sha256(bytes);
    const pdfStructure = inspectPdfStructure(bytes);
    const evidence = {
      schema: MICHELET_DISCOVERY_EVIDENCE_SCHEMA,
      evidenceClass: "michelet_discovery",
      provenance: "sandbox_encrypted_hold",
      estateBindingSha256,
      source: {
        holdId: sourceHoldId,
        ciphertextSha256: sourceCiphertextSha256,
        plaintextSha256: sourceSha256,
        plaintextBytes: bytes.byteLength,
        mediaType: "application/pdf",
        pdfStructure,
      },
      generatedAt: new Date(now).toISOString(),
      duplicateGuard: "create-only-output-path",
    };
    const canonical = canonicalEvidencePayload(evidence);
    const artifact = `${JSON.stringify({ ...evidence, evidencePayloadSha256: sha256(canonical) }, null, 2)}\n`;
    await mkdir(dirname(resolvedOutputPath), { recursive: true, mode: 0o700 });
    const outputDirectory = dirname(resolvedOutputPath);
    const outputDirectoryStat = await lstat(outputDirectory);
    if (!outputDirectoryStat.isDirectory() || outputDirectoryStat.isSymbolicLink()) throw new Error("evidence output directory must be a real directory");
    const temporaryPath = `${resolvedOutputPath}.${randomBytes(12).toString("hex")}.partial`;
    try {
      await writeFile(temporaryPath, artifact, { flag: "wx", mode: 0o600 });
      await link(temporaryPath, resolvedOutputPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
    return {
      outputPath: resolvedOutputPath,
      sourceSha256,
      sourceBytes: bytes.byteLength,
      outputSha256: sha256(artifact),
      outputBytes: Buffer.byteLength(artifact),
      uncompressedPageObjectCount: evidence.source.pdfStructure.uncompressedPageObjectCount,
      duplicateGuard: evidence.duplicateGuard,
    };
  } finally {
    bytes.fill(0);
  }
}

export async function verifySanitizedMicheletDiscoveryEvidence({
  artifactPath,
  estateBindingSha256,
  sourceHoldId,
  sourceCiphertextSha256,
  sourcePlaintextSha256,
}) {
  const resolvedArtifactPath = requireAbsolutePath(artifactPath, "evidence artifact path");
  await requireRegularFile(resolvedArtifactPath, "evidence artifact");
  let artifact;
  try {
    artifact = JSON.parse(await readFile(resolvedArtifactPath, "utf8"));
  } catch {
    throw new Error("evidence artifact must be valid JSON");
  }
  assertArtifactShape(artifact);
  requireEstateBinding(estateBindingSha256);
  if (artifact.estateBindingSha256 !== estateBindingSha256) throw new Error("evidence estate binding does not match");
  if (sourceHoldId !== undefined && artifact.source.holdId !== sourceHoldId) throw new Error("evidence source hold does not match");
  if (sourceCiphertextSha256 !== undefined && artifact.source.ciphertextSha256 !== sourceCiphertextSha256) throw new Error("evidence source ciphertext digest does not match");
  if (sourcePlaintextSha256 !== undefined && artifact.source.plaintextSha256 !== sourcePlaintextSha256) throw new Error("evidence source plaintext digest does not match");
  const { evidencePayloadSha256, ...evidence } = artifact;
  if (sha256(canonicalEvidencePayload(evidence)) !== evidencePayloadSha256) throw new Error("evidence payload integrity check failed");
  return {
    artifactPath: resolvedArtifactPath,
    artifactSha256: sha256(await readFile(resolvedArtifactPath)),
    sourceSha256: artifact.source.plaintextSha256,
    sourceBytes: artifact.source.plaintextBytes,
    estateBindingSha256: artifact.estateBindingSha256,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${flag || "end of command"}`);
    options[flag.slice(2)] = value;
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await createSanitizedMicheletDiscoveryEvidence({
    inputPath: options.input,
    outputPath: options.output,
    sourceHoldId: options["source-hold-id"],
    sourceCiphertextSha256: options["source-ciphertext-sha256"],
    estateBindingSha256: options["estate-binding-sha256"],
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
