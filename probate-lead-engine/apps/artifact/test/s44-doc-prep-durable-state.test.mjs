import assert from "node:assert/strict";
import test from "node:test";

import workerModule, { WorkspaceState } from "../../worker/dist/cloudflare.js";

const worker = workerModule.default || workerModule;

class MemoryStorage {
  values = new Map();
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async transaction(closure) { return closure(this); }
}

test("S44 persists case and job authority with replay and reload hydration", async () => {
  const storage = new MemoryStorage();
  let durable = new WorkspaceState({ storage });
  const env = {
    AUTH_REQUIRED: "false",
    WORKSPACE_STATE: {
      idFromName(name) { return name; },
      get() { return { fetch: (request) => durable.fetch(request) }; },
    },
  };

  async function request(path, init = {}) {
    return worker.fetch(new Request(`https://worker.test${path}`, init), env);
  }

  const createdCaseResponse = await request("/api/doc-prep/cases", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const createdCase = await createdCaseResponse.json();
  assert.equal(createdCaseResponse.status, 201);
  assert.match(createdCase.case.caseId, /^case_[0-9a-f]{32}$/);
  assert.equal(createdCase.readbackStatus, "verified");
  assert.deepEqual(createdCase.case.jobIds, []);

  const caseId = createdCase.case.caseId;
  const createdJobResponse = await request(`/api/doc-prep/cases/${caseId}/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flow: "discovery" }),
  });
  const createdJob = await createdJobResponse.json();
  assert.equal(createdJobResponse.status, 201);
  assert.match(createdJob.job.jobId, /^job_[0-9a-f]{32}$/);
  assert.equal(createdJob.job.caseId, caseId);
  assert.equal(createdJob.job.status, "queued");
  assert.deepEqual(createdJob.job.events.map((event) => [event.id, event.type, event.to]), [
    [1, "job.created", "queued"],
  ]);

  const jobId = createdJob.job.jobId;
  const runningResponse = await request(`/api/doc-prep/jobs/${jobId}/transitions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "running" }),
  });
  const running = await runningResponse.json();
  assert.equal(runningResponse.status, 200);
  assert.equal(running.event.id, 2);
  assert.equal(running.event.from, "queued");
  assert.equal(running.event.to, "running");

  const succeededResponse = await request(`/api/doc-prep/jobs/${jobId}/transitions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "succeeded" }),
  });
  const succeeded = await succeededResponse.json();
  assert.equal(succeededResponse.status, 200);
  assert.equal(succeeded.event.id, 3);
  assert.equal(succeeded.job.status, "succeeded");

  const invalidTransition = await request(`/api/doc-prep/jobs/${jobId}/transitions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: "running" }),
  });
  assert.equal(invalidTransition.status, 409);
  assert.equal((await invalidTransition.json()).error, "doc_prep_transition_invalid");

  const replay = await request(`/api/doc-prep/jobs/${jobId}/events`, {
    headers: { "Last-Event-ID": "1" },
  });
  const replayText = await replay.text();
  assert.equal(replay.status, 200);
  assert.match(replay.headers.get("content-type"), /^text\/event-stream/);
  assert.doesNotMatch(replayText, /^id: 1$/m);
  assert.match(replayText, /^id: 2$/m);
  assert.match(replayText, /^id: 3$/m);
  assert.match(replayText, /"from":"queued","to":"running"/);
  assert.match(replayText, /"from":"running","to":"succeeded"/);

  const caughtUp = await request(`/api/doc-prep/jobs/${jobId}/events`, {
    headers: { "Last-Event-ID": "3" },
  });
  assert.equal(caughtUp.status, 200);
  assert.equal(await caughtUp.text(), "");

  const invalidCursor = await request(`/api/doc-prep/jobs/${jobId}/events`, {
    headers: { "Last-Event-ID": "bad-cursor" },
  });
  assert.equal(invalidCursor.status, 400);

  const aheadCursor = await request(`/api/doc-prep/jobs/${jobId}/events`, {
    headers: { "Last-Event-ID": "4" },
  });
  assert.equal(aheadCursor.status, 409);
  assert.deepEqual(await aheadCursor.json(), {
    ok: false,
    error: "last_event_id_ahead",
    latestEventId: 3,
  });

  durable = new WorkspaceState({ storage });
  const hydrationResponse = await request(`/api/doc-prep/cases/${caseId}`);
  const hydration = await hydrationResponse.json();
  assert.equal(hydrationResponse.status, 200);
  assert.equal(hydration.case.caseId, caseId);
  assert.deepEqual(hydration.case.jobIds, [jobId]);
  assert.equal(hydration.jobs[0].jobId, jobId);
  assert.equal(hydration.jobs[0].status, "succeeded");
  assert.deepEqual(hydration.jobs[0].events.map((event) => event.id), [1, 2, 3]);
  assert.equal(hydration.readbackStatus, "verified");
});
