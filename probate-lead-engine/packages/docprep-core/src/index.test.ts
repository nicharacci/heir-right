import assert from "node:assert/strict";
import test from "node:test";
import { DOC_PREP_STAGES, InMemoryProcessRepository, ProcessCase, ProcessConflictError, ProcessTransitionError } from "./index.js";

const intake = { estates: [{ estateId: "estate-1", name: "Estate of Jordan Lee", owner: "Jordan Lee", address: "100 Main St, Miami, FL", county: "Miami-Dade", sourceFileReferences: ["idi-report-upload-1"], actor: { email: "operator@heirright.com" } }] };
const succeeded = (stageId: string) => ({ status: "succeeded" as const, detail: `${stageId} completed.`, evidenceReferences: [`evidence:${stageId}`], facts: { stageId } });

async function completeStages(repository: InMemoryProcessRepository, processCase: ProcessCase) {
  let current = processCase.state === "queued"
    ? await repository.transition(processCase.id, processCase.revision, "sourcing", "stages")
    : processCase;
  for (const stage of DOC_PREP_STAGES) {
    const running = await repository.startStage(current.id, current.revision, stage.id, current.estate.actor.email);
    current = await repository.finishStage(running.id, running.revision, stage.id, succeeded(stage.id), current.estate.actor.email);
  }
  return current;
}

test("intake is idempotent and rejects a reused key with a changed payload", async () => {
  const repository = new InMemoryProcessRepository();
  const first = await repository.intake(intake, "idem-key-000001");
  const retry = await repository.intake(intake, "idem-key-000001");
  assert.equal(first[0].case.id, retry[0].case.id); assert.equal(retry[0].idempotent, true);
  await assert.rejects(() => repository.intake({ estates: [{ ...intake.estates[0], address: "101 Main St, Miami, FL" }] }, "idem-key-000001"), ProcessConflictError);
});

test("the six durable stages keep the accepted labels and append ordered start and finish events", async () => {
  const repository = new InMemoryProcessRepository();
  const processCase = (await repository.intake(intake, "idem-key-000002"))[0].case;
  assert.deepEqual(processCase.steps.slice(0, 6).map(({ id, name, description, state }) => ({ id, name, description, state })), DOC_PREP_STAGES.map((stage) => ({ id: stage.id, name: stage.name, description: stage.detail, state: "pending" })));
  const completed = await completeStages(repository, processCase);
  assert.deepEqual(completed.steps.slice(0, 6).map((step) => step.state), Array(6).fill("succeeded"));
  assert.deepEqual(completed.events.filter((event) => event.stageId).map((event) => `${event.type}:${event.stageId}`), DOC_PREP_STAGES.flatMap((stage) => [`stage_started:${stage.id}`, `stage_finished:${stage.id}`]));
});

test("only the first non-succeeded stage may run and a second stage cannot start in parallel", async () => {
  const repository = new InMemoryProcessRepository();
  const queued = (await repository.intake(intake, "idem-key-000003"))[0].case;
  const sourcing = await repository.transition(queued.id, queued.revision, "sourcing", "stages");
  await assert.rejects(() => repository.startStage(sourcing.id, sourcing.revision, "obituary_search"), ProcessTransitionError);
  const running = await repository.startStage(sourcing.id, sourcing.revision, "skip_trace_parse");
  await assert.rejects(() => repository.startStage(running.id, running.revision, "obituary_search"), ProcessTransitionError);
});

test("retry resumes at the first non-succeeded stage and preserves succeeded provider evidence", async () => {
  const repository = new InMemoryProcessRepository();
  const queued = (await repository.intake(intake, "idem-key-000004"))[0].case;
  const sourcing = await repository.transition(queued.id, queued.revision, "sourcing", "stages");
  const firstRunning = await repository.startStage(sourcing.id, sourcing.revision, "skip_trace_parse");
  const firstDone = await repository.finishStage(firstRunning.id, firstRunning.revision, "skip_trace_parse", succeeded("skip_trace_parse"));
  const secondRunning = await repository.startStage(firstDone.id, firstDone.revision, "obituary_search");
  const review = await repository.finishStage(secondRunning.id, secondRunning.revision, "obituary_search", { status: "review_required", detail: "Review the obituary match.", nextAction: "Confirm the matching record.", evidenceReferences: ["candidate:obituary"], facts: { candidates: 1 } });
  const retried = await repository.retry(review.id, review.revision, "operator@heirright.com");
  assert.equal(retried.state, "sourcing");
  assert.equal(retried.steps.find((step) => step.id === "skip_trace_parse")?.state, "succeeded");
  assert.deepEqual(retried.steps.find((step) => step.id === "skip_trace_parse")?.evidenceReferences, ["evidence:skip_trace_parse"]);
  assert.equal(retried.steps.find((step) => step.id === "obituary_search")?.state, "pending");
});

test("a verified PDF is the only packet-ready transition after all six stages", async () => {
  const repository = new InMemoryProcessRepository(); const result = (await repository.intake(intake, "idem-key-000005"))[0].case;
  const sourcing = await repository.transition(result.id, result.revision, "sourcing", "stages");
  await assert.rejects(() => repository.transition(sourcing.id, sourcing.revision, "rendering", "render"), ProcessTransitionError);
  const completed = await completeStages(repository, sourcing);
  const rendering = await repository.transition(completed.id, completed.revision, "rendering", "Packet rendering started");
  await assert.rejects(() => repository.recordArtifact(rendering.id, rendering.revision, { objectKey: "packets/a.pdf", contentType: "application/pdf", bytes: 4, sha256: "a".repeat(64), readbackStatus: "pending" }), ProcessTransitionError);
  const done = await repository.recordArtifact(rendering.id, rendering.revision, { objectKey: "packets/a.pdf", contentType: "application/pdf", bytes: 4, sha256: "a".repeat(64), readbackStatus: "verified", verifiedAt: new Date().toISOString(), url: "/v1/doc-prep/artifacts/a" });
  assert.equal(done.state, "packet_ready");
  assert.equal(done.steps.find((step) => step.id === "packet-render")?.state, "succeeded");
  assert.equal(done.steps.find((step) => step.id === "artifact-readback")?.state, "succeeded");
});

test("the durable Drive export claim prevents concurrent duplicate uploads", async () => {
  const repository = new InMemoryProcessRepository();
  const processCase = (await repository.intake(intake, "idem-key-000006"))[0].case;
  const sha256 = "b".repeat(64);
  assert.equal((await repository.claimDriveExport(processCase.id, sha256)).status, "claimed");
  assert.equal((await repository.claimDriveExport(processCase.id, sha256)).status, "in_progress");
  await repository.completeDriveExport(processCase.id, sha256, { caseId: processCase.id, estateId: processCase.estate.estateId, name: "EST of Jordan Lee (08-04-2026).pdf", url: "https://drive.example/file", readbackStatus: "verified", idempotent: false });
  const completed = await repository.claimDriveExport(processCase.id, sha256);
  assert.equal(completed.status, "completed");
  if (completed.status === "completed") assert.equal(completed.export.idempotent, true);
});
