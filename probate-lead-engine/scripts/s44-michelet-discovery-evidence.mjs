#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MICHELET_DISCOVERY_EVIDENCE_SCHEMA = "heirright.s44.michelet-discovery-evidence/v1";

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

  const bytes = inputBytes ?? await readFile(requireAbsolutePath(inputPath, "discovery input path"));
  try {
    const sourceSha256 = sha256(bytes);
    const pdfStructure = inspectPdfStructure(bytes);
    const evidence = {
      schema: MICHELET_DISCOVERY_EVIDENCE_SCHEMA,
      evidenceClass: "michelet_discovery",
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
    const canonical = `${JSON.stringify(evidence)}\n`;
    const artifact = `${JSON.stringify({ ...evidence, evidencePayloadSha256: sha256(canonical) }, null, 2)}\n`;
    await mkdir(dirname(resolvedOutputPath), { recursive: true, mode: 0o700 });
    await writeFile(resolvedOutputPath, artifact, { flag: "wx", mode: 0o600 });
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
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
