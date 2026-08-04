import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryProcessRepository, ProcessConflictError, ProcessTransitionError } from "./index.js";

const intake = { estates: [{ estateId: "estate-1", name: "Estate of Jordan Lee", owner: "Jordan Lee", address: "100 Main St, Miami, FL", county: "Miami-Dade", sourceFileReferences: ["source-file-1"], actor: { email: "operator@heirright.com" } }] };
test("intake is idempotent and rejects a reused key with a changed payload", async () => {
  const repository = new InMemoryProcessRepository();
  const first = await repository.intake(intake, "idem-key-000001");
  const retry = await repository.intake(intake, "idem-key-000001");
  assert.equal(first[0].case.id, retry[0].case.id); assert.equal(retry[0].idempotent, true);
  await assert.rejects(() => repository.intake({ estates: [{ ...intake.estates[0], address: "101 Main St, Miami, FL" }] }, "idem-key-000001"), ProcessConflictError);
});
test("a verified PDF is the only packet-ready transition", async () => {
  const repository = new InMemoryProcessRepository(); const result = (await repository.intake(intake, "idem-key-000002"))[0].case;
  const sourcing = await repository.transition(result.id, result.revision, "sourcing", "Source review started");
  const rendering = await repository.transition(sourcing.id, sourcing.revision, "rendering", "Packet rendering started");
  await assert.rejects(() => repository.recordArtifact(rendering.id, rendering.revision, { objectKey: "packets/a.pdf", contentType: "application/pdf", bytes: 4, sha256: "a".repeat(64), readbackStatus: "pending" }), ProcessTransitionError);
  const done = await repository.recordArtifact(rendering.id, rendering.revision, { objectKey: "packets/a.pdf", contentType: "application/pdf", bytes: 4, sha256: "a".repeat(64), readbackStatus: "verified", verifiedAt: new Date().toISOString(), url: "/v1/doc-prep/artifacts/a" });
  assert.equal(done.state, "packet_ready");
});
