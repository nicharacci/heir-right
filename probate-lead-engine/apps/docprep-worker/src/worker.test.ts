import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryProcessRepository } from "@ple/docprep-core";
import { DocumentPrepWorker, ObjectStore } from "./worker.js";

class MemoryStore implements ObjectStore { values = new Map<string, Uint8Array>(); async put(key: string, bytes: Uint8Array) { this.values.set(key, bytes); } async get(key: string) { const value = this.values.get(key); if (!value) throw new Error("missing"); return value; } publicUrl(key: string) { return `/artifacts/${key}`; } }
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
