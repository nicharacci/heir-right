import assert from "node:assert/strict";
import workerModule, { WorkspaceState } from "../../worker/dist/cloudflare.js";

const worker = workerModule.default || workerModule;

class MemoryStorage {
  values = new Map();
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
}

const storage = new MemoryStorage();
let instance = new WorkspaceState({ storage });
const env = {
  AUTH_REQUIRED: "false",
  WORKSPACE_STATE: {
    idFromName(name) { return name; },
    get() { return { fetch: (request) => instance.fetch(request) }; },
  },
};
const key = "heirright:crm-imported-estates";

async function request(path, init) {
  return worker.fetch(new Request(`https://worker.test${path}`, init), env);
}

const invalid = await request("/api/workspace/state?key=unapproved:key");
assert.equal(invalid.status, 400);

const firstValue = JSON.stringify([{ id: "crm-estate-1", estateName: "Estate of Verified Workspace" }]);
const firstWrite = await request("/api/workspace/state", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key, value: firstValue }),
});
const firstResult = await firstWrite.json();
assert.equal(firstWrite.status, 200);
assert.equal(firstResult.revision, 1);
assert.equal(firstResult.readbackStatus, "verified");

const firstRead = await request(`/api/workspace/state?key=${encodeURIComponent(key)}`);
const firstRecord = await firstRead.json();
assert.equal(firstRecord.value, firstValue);
assert.equal(firstRecord.revision, 1);

const secondValue = JSON.stringify([{ id: "crm-estate-1" }, { id: "crm-estate-2" }]);
const secondWrite = await request("/api/workspace/state", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ key, value: secondValue }),
});
assert.equal((await secondWrite.json()).revision, 2);

instance = new WorkspaceState({ storage });
const reloadRead = await request(`/api/workspace/state?key=${encodeURIComponent(key)}`);
const reloadRecord = await reloadRead.json();
assert.equal(reloadRecord.value, secondValue);
assert.equal(reloadRecord.revision, 2);

console.log(JSON.stringify({ ok: true, checks: [
  "approved_state_keys_only",
  "serialized_revision_updates",
  "write_readback_verified",
  "state_survives_worker_instance_reload",
] }, null, 2));
