#!/usr/bin/env node

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const HOLD_KEY_VARIABLE = "S44_ARTIFACT_HOLD_KEY";
export const HOLD_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const HOLD_MAX_BYTES = 100 * 1024 * 1024;

const SCHEMA = "heirright.s44.encrypted-artifact-hold/v1";
const ALGORITHM = "aes-256-gcm";
const KDF = "scrypt";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function requireSecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error(`${HOLD_KEY_VARIABLE} must be a sandbox-only secret of at least 32 bytes`);
  }
  return secret;
}

function requireDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid timestamp`);
  return date;
}

async function requireRegularFile(filePath, label) {
  const stat = await lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file and cannot be a symbolic link`);
  }
  return stat;
}

function requireAbsolutePath(filePath, label) {
  if (typeof filePath !== "string" || !isAbsolute(filePath)) {
    throw new Error(`${label} must be an explicit absolute path`);
  }
  return resolve(filePath);
}

function authenticatedFields(manifest) {
  return {
    schema: manifest.schema,
    holdId: manifest.holdId,
    createdAt: manifest.createdAt,
    expiresAt: manifest.expiresAt,
    retentionSeconds: manifest.retentionSeconds,
    algorithm: manifest.algorithm,
    kdf: manifest.kdf,
    ciphertextFile: manifest.ciphertextFile,
    plaintextBytes: manifest.plaintextBytes,
    plaintextSha256: manifest.plaintextSha256,
  };
}

function aadFor(manifest) {
  return Buffer.from(JSON.stringify(authenticatedFields(manifest)), "utf8");
}

function assertManifest(manifest) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new Error("hold manifest must be a JSON object");
  }
  if (manifest.schema !== SCHEMA) throw new Error("unsupported hold manifest schema");
  if (!/^[0-9a-f]{32}$/.test(manifest.holdId || "")) throw new Error("invalid hold ID");
  if (manifest.retentionSeconds !== HOLD_RETENTION_SECONDS) throw new Error("hold retention must be exactly seven days");
  if (manifest.algorithm !== ALGORITHM || manifest.kdf !== KDF) throw new Error("unsupported hold cryptography");
  if (manifest.ciphertextFile !== `${manifest.holdId}.s44hold`) throw new Error("invalid ciphertext filename");
  for (const key of ["salt", "iv", "authTag"]) {
    if (!/^[0-9a-f]+$/.test(manifest[key] || "")) throw new Error(`invalid ${key}`);
  }
  for (const key of ["plaintextSha256", "ciphertextSha256"]) {
    if (!/^[0-9a-f]{64}$/.test(manifest[key] || "")) throw new Error(`invalid ${key}`);
  }
  if (!Number.isSafeInteger(manifest.plaintextBytes) || manifest.plaintextBytes < 0) {
    throw new Error("invalid plaintext byte count");
  }
  if (!Number.isSafeInteger(manifest.ciphertextBytes) || manifest.ciphertextBytes < 0) {
    throw new Error("invalid ciphertext byte count");
  }
  const createdAt = requireDate(manifest.createdAt, "createdAt");
  const expiresAt = requireDate(manifest.expiresAt, "expiresAt");
  if (expiresAt.getTime() - createdAt.getTime() !== HOLD_RETENTION_SECONDS * 1000) {
    throw new Error("hold expiry must be exactly seven days after creation");
  }
  return { createdAt, expiresAt };
}

async function readManifest(manifestPath) {
  const resolvedManifestPath = requireAbsolutePath(manifestPath, "manifest path");
  await requireRegularFile(resolvedManifestPath, "manifest");
  const manifest = JSON.parse(await readFile(resolvedManifestPath, "utf8"));
  const dates = assertManifest(manifest);
  const ciphertextPath = join(dirname(resolvedManifestPath), manifest.ciphertextFile);
  if (basename(ciphertextPath) !== manifest.ciphertextFile) throw new Error("ciphertext path escaped its hold directory");
  return { manifest, manifestPath: resolvedManifestPath, ciphertextPath, ...dates };
}

export async function sealArtifact({ inputPath, outputDirectory, secret, now = new Date() }) {
  requireSecret(secret);
  const createdAt = requireDate(now, "now");
  const resolvedInputPath = requireAbsolutePath(inputPath, "artifact input path");
  const resolvedOutputDirectory = requireAbsolutePath(outputDirectory, "hold output directory");
  const inputStat = await requireRegularFile(resolvedInputPath, "artifact input");
  if (inputStat.size > HOLD_MAX_BYTES) throw new Error(`artifact exceeds the ${HOLD_MAX_BYTES}-byte sandbox hold ceiling`);
  await mkdir(resolvedOutputDirectory, { recursive: true, mode: 0o700 });
  await chmod(resolvedOutputDirectory, 0o700);

  const plaintext = await readFile(resolvedInputPath);
  const holdId = randomBytes(16).toString("hex");
  const ciphertextFile = `${holdId}.s44hold`;
  const ciphertextPath = join(resolvedOutputDirectory, ciphertextFile);
  const manifestPath = join(resolvedOutputDirectory, `${holdId}.manifest.json`);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(secret, salt, 32);
  const manifest = {
    schema: SCHEMA,
    holdId,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + HOLD_RETENTION_SECONDS * 1000).toISOString(),
    retentionSeconds: HOLD_RETENTION_SECONDS,
    algorithm: ALGORITHM,
    kdf: KDF,
    ciphertextFile,
    plaintextBytes: plaintext.byteLength,
    plaintextSha256: sha256(plaintext),
    salt: salt.toString("hex"),
    iv: iv.toString("hex"),
  };

  try {
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(aadFor(manifest));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    Object.assign(manifest, {
      authTag: cipher.getAuthTag().toString("hex"),
      ciphertextBytes: ciphertext.byteLength,
      ciphertextSha256: sha256(ciphertext),
    });
    await writeFile(ciphertextPath, ciphertext, { flag: "wx", mode: 0o600 });
    try {
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    } catch (error) {
      await rm(ciphertextPath, { force: true });
      throw error;
    }
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }

  return {
    holdId,
    createdAt: manifest.createdAt,
    expiresAt: manifest.expiresAt,
    retentionSeconds: manifest.retentionSeconds,
    ciphertextPath,
    manifestPath,
  };
}

export async function inspectHold({ manifestPath, now = new Date() }) {
  const currentTime = requireDate(now, "now");
  const hold = await readManifest(manifestPath);
  await requireRegularFile(hold.ciphertextPath, "ciphertext");
  const ciphertext = await readFile(hold.ciphertextPath);
  if (ciphertext.byteLength !== hold.manifest.ciphertextBytes || sha256(ciphertext) !== hold.manifest.ciphertextSha256) {
    throw new Error("ciphertext integrity check failed");
  }
  return {
    holdId: hold.manifest.holdId,
    createdAt: hold.manifest.createdAt,
    expiresAt: hold.manifest.expiresAt,
    retentionSeconds: hold.manifest.retentionSeconds,
    ciphertextBytes: hold.manifest.ciphertextBytes,
    status: currentTime.getTime() >= hold.expiresAt.getTime() ? "expired" : "active",
  };
}

export async function restoreArtifact({ manifestPath, outputPath, secret, now = new Date() }) {
  requireSecret(secret);
  const currentTime = requireDate(now, "now");
  const hold = await readManifest(manifestPath);
  if (currentTime.getTime() >= hold.expiresAt.getTime()) throw new Error("artifact hold has expired and cannot be restored");
  await requireRegularFile(hold.ciphertextPath, "ciphertext");
  const ciphertext = await readFile(hold.ciphertextPath);
  if (ciphertext.byteLength !== hold.manifest.ciphertextBytes || sha256(ciphertext) !== hold.manifest.ciphertextSha256) {
    throw new Error("ciphertext integrity check failed");
  }

  const key = scryptSync(secret, Buffer.from(hold.manifest.salt, "hex"), 32);
  let plaintext;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(hold.manifest.iv, "hex"));
    decipher.setAAD(aadFor(hold.manifest));
    decipher.setAuthTag(Buffer.from(hold.manifest.authTag, "hex"));
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (plaintext.byteLength !== hold.manifest.plaintextBytes || sha256(plaintext) !== hold.manifest.plaintextSha256) {
      throw new Error("restored artifact integrity check failed");
    }
    const resolvedOutputPath = requireAbsolutePath(outputPath, "restore output path");
    await mkdir(dirname(resolvedOutputPath), { recursive: true, mode: 0o700 });
    await writeFile(resolvedOutputPath, plaintext, { flag: "wx", mode: 0o600 });
    return { holdId: hold.manifest.holdId, outputPath: resolvedOutputPath, plaintextBytes: plaintext.byteLength };
  } finally {
    key.fill(0);
    plaintext?.fill(0);
  }
}

export async function purgeExpiredHold({ manifestPath, now = new Date() }) {
  const currentTime = requireDate(now, "now");
  const hold = await readManifest(manifestPath);
  if (currentTime.getTime() < hold.expiresAt.getTime()) throw new Error("active artifact hold cannot be purged");
  await rm(hold.ciphertextPath, { force: true });
  await rm(hold.manifestPath, { force: true });
  return { holdId: hold.manifest.holdId, purgedAt: currentTime.toISOString() };
}

function parseArguments(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`invalid argument near ${flag || "end of command"}`);
    options[flag.slice(2)] = value;
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2));
  const secret = process.env[HOLD_KEY_VARIABLE];
  let result;
  if (command === "seal") {
    result = await sealArtifact({ inputPath: options.input, outputDirectory: options["output-dir"], secret });
  } else if (command === "inspect") {
    result = await inspectHold({ manifestPath: options.manifest });
  } else if (command === "restore") {
    result = await restoreArtifact({ manifestPath: options.manifest, outputPath: options.output, secret });
  } else if (command === "purge-expired") {
    result = await purgeExpiredHold({ manifestPath: options.manifest });
  } else {
    throw new Error("usage: s44-artifact-hold.mjs seal|inspect|restore|purge-expired [options]");
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
