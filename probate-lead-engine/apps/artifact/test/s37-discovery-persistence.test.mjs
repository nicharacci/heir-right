import assert from "node:assert/strict";
import workerModule from "../../worker/dist/cloudflare.js";

const worker = workerModule.default || workerModule;

class MemoryKv {
  values = new Map();
  async get(key) { return this.values.get(key) || null; }
  async put(key, value) { this.values.set(key, value); }
}

const kv = new MemoryKv();
const env = {
  AUTH_REQUIRED: "false",
  PACKET_ARTIFACTS: kv,
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
assert.equal(kv.values.size, 3, "distinct long estate identities must never share a Discovery File key");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "source_run_persists_shared_discovery_file",
    "discovery_file_readback_is_verified",
    "source_facts_and_dossier_survive_readback",
    "missing_discovery_file_is_truthful",
    "long_estate_identities_do_not_collide",
  ],
}, null, 2));
