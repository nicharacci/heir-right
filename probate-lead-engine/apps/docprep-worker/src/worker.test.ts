import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryProcessRepository } from "@ple/docprep-core";
import { claimOutbox, DocumentPrepWorker, ObjectStore } from "./worker.js";

class MemoryStore implements ObjectStore { values = new Map<string, Uint8Array>(); async put(key: string, bytes: Uint8Array) { this.values.set(key, bytes); } async get(key: string) { const value = this.values.get(key); if (!value) throw new Error("missing"); return value; } }
test("the worker only marks a case packet-ready after PDF storage readback", async () => {
  const repository = new InMemoryProcessRepository(); const intake = await repository.intake({ estates: [{ estateId: "estate-worker-1", name: "Estate of Dana Fox", address: "6 Bay St, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }] }, "worker-idempotency-0001");
  const worker = new DocumentPrepWorker({ repository, objectStore: new MemoryStore(), sourceRunner: async () => ({ kind: "ready", pdf: new TextEncoder().encode("%PDF-1.7\n") }) });
  const done = await worker.process(intake[0].case.id); assert.equal(done.state, "packet_ready"); assert.equal(done.artifact?.readbackStatus, "verified");
});
test("a source blocker stays a blocker instead of becoming a fake PDF", async () => {
  const repository = new InMemoryProcessRepository(); const intake = await repository.intake({ estates: [{ estateId: "estate-worker-2", name: "Estate of Drew Fox", address: "7 Bay St, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }] }, "worker-idempotency-0002");
  const worker = new DocumentPrepWorker({ repository, objectStore: new MemoryStore(), sourceRunner: async () => ({ kind: "blocked", detail: "Missing deed evidence.", nextAction: "Review the deed." }) });
  const blocked = await worker.process(intake[0].case.id); assert.equal(blocked.state, "blocked"); assert.equal(blocked.artifact, undefined);
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
