import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { access, lstat, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  HOLD_MAX_BYTES,
  HOLD_RETENTION_SECONDS,
  closeExpiredHold,
  inspectHold,
  purgeExpiredHold,
  restoreArtifact,
  sealArtifact,
} from "./s44-artifact-hold.mjs";

async function missing(filePath) {
  try {
    await access(filePath);
    return false;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

test("S44 seals, authenticates, expires, and removes a sandbox-only artifact hold", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-hold-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));

  const inputPath = join(directory, "synthetic-proof.txt");
  const restorePath = join(directory, "restored", "proof.txt");
  const wrongKeyOutput = join(directory, "wrong-key.txt");
  const payload = Buffer.from("synthetic S44 sandbox artifact; no estate, provider, or production data", "utf8");
  const secret = randomBytes(48).toString("base64url");
  const createdAt = new Date("2026-08-07T12:00:00.000Z");
  const expiresAt = new Date(createdAt.getTime() + HOLD_RETENTION_SECONDS * 1000);
  await writeFile(inputPath, payload, { mode: 0o600 });

  const sealed = await sealArtifact({ inputPath, outputDirectory: join(directory, "holds"), secret, now: createdAt });
  assert.match(sealed.holdId, /^[0-9a-f]{32}$/);
  assert.equal(sealed.retentionSeconds, 604800);
  assert.equal(HOLD_MAX_BYTES, 104857600);
  assert.equal(sealed.expiresAt, "2026-08-14T12:00:00.000Z");

  const ciphertext = await readFile(sealed.ciphertextPath);
  const manifest = JSON.parse(await readFile(sealed.manifestPath, "utf8"));
  assert.equal(ciphertext.includes(payload), false);
  assert.equal(JSON.stringify(manifest).includes("synthetic-proof.txt"), false);
  assert.equal(JSON.stringify(manifest).includes(payload.toString("utf8")), false);

  const active = await inspectHold({ manifestPath: sealed.manifestPath, now: new Date(createdAt.getTime() + 1000) });
  assert.equal(active.status, "active");
  assert.equal(active.expiresAt, expiresAt.toISOString());

  await assert.rejects(
    restoreArtifact({ manifestPath: sealed.manifestPath, outputPath: wrongKeyOutput, secret: randomBytes(48).toString("base64url"), now: createdAt }),
  );
  assert.equal(await missing(wrongKeyOutput), true);

  const restored = await restoreArtifact({ manifestPath: sealed.manifestPath, outputPath: restorePath, secret, now: createdAt });
  assert.equal(restored.plaintextBytes, payload.byteLength);
  assert.deepEqual(await readFile(restorePath), payload);

  await assert.rejects(
    restoreArtifact({ manifestPath: sealed.manifestPath, outputPath: join(directory, "expired.txt"), secret, now: expiresAt }),
    /expired/,
  );

  await assert.rejects(purgeExpiredHold({ manifestPath: sealed.manifestPath, now: createdAt }), /active/);
  const purged = await purgeExpiredHold({ manifestPath: sealed.manifestPath, now: expiresAt });
  assert.equal(purged.holdId, sealed.holdId);
  assert.equal(await missing(sealed.ciphertextPath), true);
  assert.equal(await missing(sealed.manifestPath), true);
});

test("S44 binds expiry metadata to the authenticated ciphertext", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-tamper-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "input.txt");
  const secret = randomBytes(48).toString("base64url");
  const createdAt = new Date("2026-08-07T12:00:00.000Z");
  await writeFile(inputPath, "synthetic", { mode: 0o600 });
  const sealed = await sealArtifact({ inputPath, outputDirectory: join(directory, "holds"), secret, now: createdAt });
  const manifest = JSON.parse(await readFile(sealed.manifestPath, "utf8"));
  manifest.createdAt = "2026-08-08T12:00:00.000Z";
  manifest.expiresAt = "2026-08-15T12:00:00.000Z";
  await writeFile(sealed.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  await assert.rejects(
    restoreArtifact({ manifestPath: sealed.manifestPath, outputPath: join(directory, "tampered.txt"), secret, now: createdAt }),
  );
});

test("S44 closes only the approved synthetic hold at exact expiry and records an idempotent receipt", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "heirright-s44-closure-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "synthetic.txt");
  const secret = randomBytes(48).toString("base64url");
  const createdAt = new Date("2026-08-07T04:50:09.444Z");
  const expiresAt = new Date(createdAt.getTime() + HOLD_RETENTION_SECONDS * 1000);
  await writeFile(inputPath, "synthetic closure protocol only", { mode: 0o600 });
  const sealed = await sealArtifact({ inputPath, outputDirectory: join(directory, "holds"), secret, now: createdAt });
  const manifest = JSON.parse(await readFile(sealed.manifestPath, "utf8"));
  const holdDirectoryMode = (await lstat(join(directory, "holds"))).mode & 0o777;
  const manifestMode = (await lstat(sealed.manifestPath)).mode & 0o777;
  const ciphertextMode = (await lstat(sealed.ciphertextPath)).mode & 0o777;
  assert.equal(holdDirectoryMode, 0o700);
  assert.equal(manifestMode, 0o600);
  assert.equal(ciphertextMode, 0o600);
  assert.equal(sealed.expiresAt, "2026-08-14T04:50:09.444Z");

  await assert.rejects(
    closeExpiredHold({
      manifestPath: sealed.manifestPath,
      expectedHoldId: sealed.holdId,
      expectedCiphertextSha256: manifest.ciphertextSha256,
      now: new Date(expiresAt.getTime() - 1),
    }),
    /active/,
  );
  assert.equal(await missing(sealed.manifestPath), false);
  assert.equal(await missing(sealed.ciphertextPath), false);

  await assert.rejects(
    closeExpiredHold({
      manifestPath: sealed.manifestPath,
      expectedHoldId: sealed.holdId,
      expectedCiphertextSha256: "0".repeat(64),
      now: expiresAt,
    }),
    /digest/,
  );
  assert.equal(await missing(sealed.manifestPath), false);
  assert.equal(await missing(sealed.ciphertextPath), false);

  const closed = await closeExpiredHold({
    manifestPath: sealed.manifestPath,
    expectedHoldId: sealed.holdId,
    expectedCiphertextSha256: manifest.ciphertextSha256,
    now: expiresAt,
  });
  assert.equal(closed.holdId, sealed.holdId);
  assert.equal(closed.expiresAt, expiresAt.toISOString());
  assert.equal(await missing(sealed.manifestPath), true);
  assert.equal(await missing(sealed.ciphertextPath), true);
  const receipt = JSON.parse(await readFile(closed.receiptPath, "utf8"));
  assert.equal(receipt.ciphertextSha256, manifest.ciphertextSha256);
  const retried = await closeExpiredHold({
    manifestPath: sealed.manifestPath,
    expectedHoldId: sealed.holdId,
    expectedCiphertextSha256: manifest.ciphertextSha256,
    now: new Date(expiresAt.getTime() + 1),
  });
  assert.deepEqual(retried, closed);
});
