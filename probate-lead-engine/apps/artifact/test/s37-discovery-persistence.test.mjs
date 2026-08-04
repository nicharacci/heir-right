import assert from "node:assert/strict";
import workerModule, { WorkspaceState } from "../../worker/dist/cloudflare.js";

const worker = workerModule.default || workerModule;

class MemoryKv {
  values = new Map();
  options = new Map();
  failNextRevisionReadback = false;
  failedRevisionKey = "";
  revisionPutGate = null;
  revisionPutStarted = null;
  revisionPutStartedResolve = null;
  async get(key) { return this.values.get(key) || null; }
  async put(key, value, options = {}) {
    if (this.revisionPutGate && key.includes(":revision:")) {
      const gate = this.revisionPutGate;
      this.revisionPutGate = null;
      this.revisionPutStartedResolve?.();
      await gate;
    }
    this.values.set(key, value);
    this.options.set(key, options);
    if (this.failNextRevisionReadback && key.includes(":revision:")) {
      this.failNextRevisionReadback = false;
      this.failedRevisionKey = key;
    }
  }
  async delete(key) { this.values.delete(key); }
}

const originalGet = MemoryKv.prototype.get;
MemoryKv.prototype.get = async function get(key) {
  if (key === this.failedRevisionKey) {
    this.failedRevisionKey = "";
    return null;
  }
  return originalGet.call(this, key);
};

class MemoryDurableStorage {
  values = new Map();
  transactionTail = Promise.resolve();
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async transaction(closure) {
    const previous = this.transactionTail;
    let release;
    this.transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await closure(this); }
    finally { release(); }
  }
}

const kv = new MemoryKv();
const workspace = new WorkspaceState({ storage: new MemoryDurableStorage() });
const env = {
  AUTH_REQUIRED: "false",
  PACKET_ARTIFACTS: kv,
  WORKSPACE_STATE: {
    idFromName: (name) => name,
    get: () => ({ fetch: (request) => workspace.fetch(request) }),
  },
  BROWSERBASE_BATCH_APPROVAL_REQUIRED: "true",
  BROWSERBASE_BATCH_RUN_APPROVED: "false",
};
const estateId = "20611-nw-33rd-pl:fresh-public-source-validation-lead";
const sourceResponse = await worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: estateId,
    seed: {
      estateName: "Estate of Fresh Public-Source Validation Lead",
      ownerName: "Fresh Public-Source Validation Lead",
      propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
      parcelId: "34-1133-001-0470",
      county: "miami-dade",
    },
    capture: {},
    includeSkipTrace: false,
  }),
}), env);
assert.equal(sourceResponse.status, 200);
const sourceRun = await sourceResponse.json();
assert.equal(sourceRun.persistence.stored, true);
assert.equal(sourceRun.persistence.readbackStatus, "verified");
assert.equal(sourceRun.estateId, estateId);
assert.ok(sourceRun.dossier);
assert.ok(Array.isArray(sourceRun.sourceFacts));

const readbackResponse = await worker.fetch(new Request(`https://worker.test/api/discovery/file?estateId=${encodeURIComponent(estateId)}`), env);
assert.equal(readbackResponse.status, 200);
const readback = await readbackResponse.json();
assert.equal(readback.ok, true);
assert.equal(readback.readbackStatus, "verified");
assert.equal(readback.estateId, estateId);
assert.equal(readback.revision, sourceRun.runId);
assert.deepEqual(readback.dossier, sourceRun.dossier);
assert.deepEqual(readback.sourceFacts, sourceRun.sourceFacts);

kv.failNextRevisionReadback = true;
const failedReplacementResponse = await worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: estateId,
    seed: {
      estateName: "Estate of Fresh Public-Source Validation Lead",
      ownerName: "Fresh Public-Source Validation Lead",
      propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
      parcelId: "34-1133-001-0470",
      county: "miami-dade",
    },
    capture: {},
  }),
}), env);
assert.equal(failedReplacementResponse.status, 503, "a staged revision with failed readback must fail closed");
const failedReplacement = await failedReplacementResponse.json();
assert.equal(failedReplacement.error, "discovery_file_persistence_failed");
assert.equal("dossier" in failedReplacement, false, "an unverified Discovery run must not be returned for client application");
assert.equal(failedReplacement.persistence.readbackStatus, "stage_readback_failed");
const retainedResponse = await worker.fetch(new Request(`https://worker.test/api/discovery/file?estateId=${encodeURIComponent(estateId)}`), env);
const retained = await retainedResponse.json();
assert.equal(retained.revision, sourceRun.runId, "the prior verified Discovery File must remain canonical after failed staging");

const committedReplacementResponse = await worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: estateId,
    seed: {
      estateName: "Estate of Fresh Public-Source Validation Lead",
      ownerName: "Fresh Public-Source Validation Lead",
      propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
      parcelId: "34-1133-001-0470",
      county: "miami-dade",
    },
    capture: {},
  }),
}), env);
assert.equal(committedReplacementResponse.status, 200);
const committedReplacement = await committedReplacementResponse.json();
const committedReplacementEntry = [...kv.values.entries()].find(([key, value]) => {
  if (!key.includes(":revision:")) return false;
  try { return JSON.parse(value).revision === committedReplacement.runId; }
  catch { return false; }
});
assert.ok(committedReplacementEntry, "the replacement must exist only as its immutable staged revision");
kv.values.set(committedReplacementEntry[0], JSON.stringify({ estateId, revision: "corrupted-active-revision" }));
const recoveredResponse = await worker.fetch(new Request(`https://worker.test/api/discovery/file?estateId=${encodeURIComponent(estateId)}`), env);
assert.equal(recoveredResponse.status, 200);
const recovered = await recoveredResponse.json();
assert.equal(recovered.revision, sourceRun.runId, "a corrupted active revision must roll back to the prior verified canonical file");

const concurrentEstateId = "estate:concurrent-discovery-file-writes";
let releaseRevisionPut;
kv.revisionPutGate = new Promise((resolve) => { releaseRevisionPut = resolve; });
kv.revisionPutStarted = new Promise((resolve) => { kv.revisionPutStartedResolve = resolve; });
const concurrentRequest = (suffix) => worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: concurrentEstateId,
    seed: { estateName: `Estate ${suffix}`, propertyAddress: `${suffix} concurrency address`, county: "miami-dade" },
    capture: {},
  }),
}), env);
const firstConcurrentResponse = concurrentRequest("alpha");
await kv.revisionPutStarted;
const secondConcurrentResponse = await concurrentRequest("beta");
releaseRevisionPut();
const concurrentResponses = [await firstConcurrentResponse, secondConcurrentResponse];
assert.deepEqual(concurrentResponses.map((response) => response.status).sort(), [200, 503], "concurrent writes for one estate must have one canonical winner");
const concurrentBodies = await Promise.all(concurrentResponses.map((response) => response.json()));
const concurrentWinner = concurrentBodies.find((body) => body.persistence?.readbackStatus === "verified");
const concurrentLoser = concurrentBodies.find((body) => body.error === "discovery_file_persistence_failed");
assert.ok(concurrentWinner && concurrentLoser);
const concurrentReadbackResponse = await worker.fetch(new Request(`https://worker.test/api/discovery/file?estateId=${encodeURIComponent(concurrentEstateId)}`), env);
const concurrentReadback = await concurrentReadbackResponse.json();
assert.equal(concurrentReadback.revision, concurrentWinner.runId);

const missingResponse = await worker.fetch(new Request("https://worker.test/api/discovery/file?estateId=missing-estate"), env);
assert.equal(missingResponse.status, 200);
const missing = await missingResponse.json();
assert.equal(missing.ok, true);
assert.equal(missing.exists, false);

const longEstatePrefix = `estate-${"a".repeat(90)}`;
for (const suffix of ["first", "second"]) {
  const response = await worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operatorIntent: "run_external_source_search",
      assetKey: `${longEstatePrefix}-${suffix}`,
      seed: { estateName: `Estate ${suffix}`, propertyAddress: `${suffix} test address`, county: "miami-dade" },
      capture: {},
      includeSkipTrace: false,
    }),
  }), env);
  assert.equal(response.status, 200);
}
const longEstateRecords = [...kv.values.values()].flatMap((value) => {
  try {
    const record = JSON.parse(value);
    return String(record.estateId || "").startsWith(longEstatePrefix) ? [record.estateId] : [];
  } catch {
    return [];
  }
});
assert.equal(new Set(longEstateRecords).size, 2, "distinct long estate identities must never share a Discovery File revision key");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "source_run_persists_shared_discovery_file",
    "discovery_file_readback_is_verified",
    "source_facts_and_dossier_survive_readback",
    "failed_revision_readback_keeps_prior_canonical_file",
    "external_source_run_fails_closed_without_unverified_body",
    "corrupted_active_revision_recovers_previous_canonical_file",
    "concurrent_writes_have_one_atomic_canonical_winner",
    "missing_discovery_file_is_truthful",
    "long_estate_identities_do_not_collide",
  ],
}, null, 2));
