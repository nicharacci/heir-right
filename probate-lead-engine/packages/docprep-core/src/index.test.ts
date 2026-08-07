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
  assert.equal(done.steps.find((step) => step.id === "packet-render")?.state, "succeeded");
  assert.equal(done.steps.find((step) => step.id === "artifact-readback")?.state, "succeeded");
});
test("a retry moves the durable source-review step back to running without bypassing review blockers", async () => {
  const repository = new InMemoryProcessRepository(); const result = (await repository.intake(intake, "idem-key-000003"))[0].case;
  const blocked = await repository.transition(result.id, result.revision, "blocked", "Source service unavailable", undefined, "Source service unavailable", "Retry after the source service recovers.");
  const retried = await repository.retry(blocked.id, blocked.revision, "operator@heirright.com");
  assert.equal(retried.state, "sourcing");
  assert.equal(retried.steps.find((step) => step.id === "source-review")?.state, "running");
  const review = await repository.transition(retried.id, retried.revision, "review_required", "Human evidence review is required", undefined, "Human evidence review is required", "Complete evidence review.");
  await assert.rejects(() => repository.retry(review.id, review.revision), ProcessTransitionError);
});
test("the durable Drive export claim prevents concurrent duplicate uploads", async () => {
  const repository = new InMemoryProcessRepository();
  const processCase = (await repository.intake(intake, "idem-key-000004"))[0].case;
  const sha256 = "b".repeat(64);
  assert.equal((await repository.claimDriveExport(processCase.id, sha256)).status, "claimed");
  assert.equal((await repository.claimDriveExport(processCase.id, sha256)).status, "in_progress");
  await repository.completeDriveExport(processCase.id, sha256, { caseId: processCase.id, estateId: processCase.estate.estateId, name: "EST of Jordan Lee.pdf 08-04-2026", url: "https://drive.example/file", readbackStatus: "verified", idempotent: false });
  const completed = await repository.claimDriveExport(processCase.id, sha256);
  assert.equal(completed.status, "completed");
  if (completed.status === "completed") assert.equal(completed.export.idempotent, true);
});
