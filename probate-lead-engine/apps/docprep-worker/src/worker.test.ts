import assert from "node:assert/strict";
import test from "node:test";
import { DOC_PREP_STAGES, InMemoryProcessRepository } from "@ple/docprep-core";
import { claimOutbox, DocumentPrepWorker, ObjectStore, StageRunner } from "./worker.js";

class MemoryStore implements ObjectStore {
  values = new Map<string, Uint8Array>();
  constructor(private readonly corruptReadback = false, private readonly contentType = "application/pdf") {}
  async put(key: string, bytes: Uint8Array) { this.values.set(key, bytes); }
  async get(key: string) { const value = this.values.get(key); if (!value) throw new Error("missing"); return { bytes: this.corruptReadback ? new TextEncoder().encode("corrupt") : value, contentType: this.contentType }; }
}

const estate = (estateId: string) => ({ estates: [{ estateId, name: "Estate of Dana Fox", address: "6 Bay St, Miami, FL", county: "Miami-Dade", sourceFileReferences: ["idi-report-upload-1"], actor: { email: "operator@heirright.com" } }] });
const success = (stageId: string) => ({ status: "succeeded" as const, detail: `${stageId} complete.`, evidenceReferences: [`evidence:${stageId}`], facts: { stageId } });
const packetRenderer = async () => ({ kind: "ready" as const, pdf: new TextEncoder().encode("%PDF-1.7\nverified\n") });

test("the worker runs all six stages in exact order with no parallel start and verifies the PDF readback", async () => {
  const repository = new InMemoryProcessRepository();
  const intake = await repository.intake(estate("estate-worker-1"), "worker-idempotency-0001");
  const calls: string[] = [];
  let inFlight = 0; let maximumInFlight = 0;
  const stageRunner: StageRunner = async (stageId, request) => {
    inFlight += 1; maximumInFlight = Math.max(maximumInFlight, inFlight); calls.push(stageId);
    assert.deepEqual(request.priorStageOutputs.map((output) => output.stageId), calls.slice(0, -1));
    await Promise.resolve();
    inFlight -= 1;
    return success(stageId);
  };
  const worker = new DocumentPrepWorker({ repository, objectStore: new MemoryStore(), stageRunner, packetRenderer });
  const done = await worker.process(intake[0].case.id);
  assert.equal(done.state, "packet_ready"); assert.equal(done.artifact?.readbackStatus, "verified");
  assert.deepEqual(calls, DOC_PREP_STAGES.map((stage) => stage.id));
  assert.equal(maximumInFlight, 1);
  assert.deepEqual(done.events.filter((event) => event.stageId).map((event) => `${event.type}:${event.stageId}`), DOC_PREP_STAGES.flatMap((stage) => [`stage_started:${stage.id}`, `stage_finished:${stage.id}`]));
});

test("a blocking stage prevents every later stage and packet render from starting", async () => {
  const repository = new InMemoryProcessRepository();
  const intake = await repository.intake(estate("estate-worker-2"), "worker-idempotency-0002");
  const calls: string[] = [];
  const stageRunner: StageRunner = async (stageId) => {
    calls.push(stageId);
    return stageId === "deed_title_search"
      ? { status: "blocked", detail: "Official records are unavailable.", nextAction: "Retry when official records recover.", evidenceReferences: [], facts: {} }
      : success(stageId);
  };
  const worker = new DocumentPrepWorker({ repository, objectStore: new MemoryStore(), stageRunner, packetRenderer: async () => { throw new Error("packet renderer must not start"); } });
  const blocked = await worker.process(intake[0].case.id);
  assert.equal(blocked.state, "blocked"); assert.equal(blocked.artifact, undefined);
  assert.deepEqual(calls, ["skip_trace_parse", "obituary_search", "deed_title_search"]);
  assert.equal(blocked.steps.find((step) => step.id === "tax_receipt_fetch")?.state, "pending");
});

test("review resume starts at the first non-succeeded stage and never repeats a succeeded provider action", async () => {
  const repository = new InMemoryProcessRepository();
  const intake = await repository.intake(estate("estate-worker-3"), "worker-idempotency-0003");
  const counts = new Map<string, number>();
  const stageRunner: StageRunner = async (stageId) => {
    const attempt = (counts.get(stageId) || 0) + 1; counts.set(stageId, attempt);
    if (stageId === "obituary_search" && attempt === 1) return { status: "review_required", detail: "Confirm the obituary match.", nextAction: "Review the candidate obituary.", evidenceReferences: ["candidate:obituary"], facts: { candidates: 1 } };
    return success(stageId);
  };
  const worker = new DocumentPrepWorker({ repository, objectStore: new MemoryStore(), stageRunner, packetRenderer });
  const review = await worker.process(intake[0].case.id);
  assert.equal(review.state, "review_required");
  const retried = await repository.retry(review.id, review.revision, "operator@heirright.com");
  const done = await worker.process(retried.id);
  assert.equal(done.state, "packet_ready");
  assert.equal(counts.get("skip_trace_parse"), 1);
  assert.equal(counts.get("obituary_search"), 2);
  for (const stage of DOC_PREP_STAGES.slice(2)) assert.equal(counts.get(stage.id), 1);
});

test("a PDF byte or SHA mismatch fails before packet_ready", async () => {
  const repository = new InMemoryProcessRepository();
  const intake = await repository.intake(estate("estate-worker-4"), "worker-idempotency-0004");
  const failures: Array<{ code: string }> = [];
  const worker = new DocumentPrepWorker({ repository, objectStore: new MemoryStore(true), stageRunner: async (stageId) => success(stageId), packetRenderer, reportSystemFailure: async (failure) => { failures.push(failure); } });
  const failed = await worker.process(intake[0].case.id);
  assert.equal(failed.state, "failed"); assert.equal(failed.artifact, undefined);
  assert.equal(failed.steps.find((step) => step.id === "packet-render")?.state, "failed");
  assert.deepEqual(failures.map((failure) => failure.code), ["r2_readback_mismatch"]);
});

test("an R2 content-type mismatch fails before packet_ready", async () => {
  const repository = new InMemoryProcessRepository();
  const intake = await repository.intake(estate("estate-worker-5"), "worker-idempotency-0005");
  const failures: Array<{ code: string }> = [];
  const worker = new DocumentPrepWorker({ repository, objectStore: new MemoryStore(false, "application/octet-stream"), stageRunner: async (stageId) => success(stageId), packetRenderer, reportSystemFailure: async (failure) => { failures.push(failure); } });
  const failed = await worker.process(intake[0].case.id);
  assert.equal(failed.state, "failed"); assert.equal(failed.artifact, undefined);
  assert.deepEqual(failures.map((failure) => failure.code), ["r2_readback_mismatch"]);
});

test("the outbox dispatcher reclaims stale claims and preserves the queue topic", async () => {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql === "BEGIN" || sql === "COMMIT") return { rows: [] };
      return { rows: [{ id: "job-1", case_id: "case-1", topic: "docprep.case.queued" }] };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client };
  const jobs = await claimOutbox(pool as never);
  assert.deepEqual(jobs, [{ id: "job-1", caseId: "case-1", topic: "docprep.case.queued" }]);
  assert.match(calls[1], /claimed_at < now\(\) - interval '5 minutes'/);
  assert.match(calls[1], /RETURNING o\.id, o\.case_id, o\.topic/);
});

test("outbox claim failures report sanitized system transport without changing the thrown error", async () => {
  const calls: string[] = [];
  const client = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql === "BEGIN") return { rows: [] };
      if (sql === "ROLLBACK") return { rows: [] };
      throw new Error("database value must not be reported");
    },
    release: () => undefined,
  };
  const failures: Array<{ stageId: string; code: string; provider: string; deploymentKey: string }> = [];
  const pool = { connect: async () => client };
  await assert.rejects(
    () => claimOutbox(pool as never, 25, async (failure) => { failures.push(failure); }),
    /database value must not be reported/,
  );
  assert.equal(calls[0], "BEGIN");
  assert.match(calls[1], /UPDATE docprep_outbox/);
  assert.equal(calls[2], "ROLLBACK");
  assert.deepEqual(failures, [{ stageId: "outbox", code: "outbox_claim_failed", provider: "postgres", deploymentKey: "docprep-worker" }]);
});
