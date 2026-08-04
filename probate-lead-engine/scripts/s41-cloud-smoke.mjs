const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const apiBase = required("PROCESS_API_URL").replace(/\/+$/, "");
const readJson = async (response) => response.json().catch(() => ({}));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const health = await fetch(`${apiBase}/healthz`);
const healthBody = await readJson(health);
assert(health.status === 200 && healthBody.ok && healthBody.status === "live", "Process API health check failed.");

const readiness = await fetch(`${apiBase}/readyz`);
const readinessBody = await readJson(readiness);
assert(readiness.status === 200 && readinessBody.ok && readinessBody.status === "ready", "Process API readiness check failed.");

const denied = await fetch(`${apiBase}/v1/doc-prep/cases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ estates: [] }) });
assert(denied.status === 401, "Process API accepted an unauthenticated intake request.");

if (process.env.S41_CONTROLLED_ESTATE_APPROVED === "approved") {
  const token = required("HEIRRIGHT_PROCESS_API_TOKEN");
  const actor = required("S41_SMOKE_ACTOR_EMAIL");
  const estate = JSON.parse(required("S41_SMOKE_ESTATE_JSON"));
  const intake = await fetch(`${apiBase}/v1/doc-prep/cases`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "x-heirright-actor-email": actor, "content-type": "application/json", "idempotency-key": `s41-smoke-${estate.estateId}` },
    body: JSON.stringify({ estates: [{ ...estate, actor: { email: actor } }] }),
  });
  const intakeBody = await readJson(intake);
  assert([200, 201].includes(intake.status) && intakeBody.ok, "Approved controlled-estate intake failed.");
}

console.log(JSON.stringify({ ok: true, checks: ["health", "readiness", "unauthenticated-intake-denied"], controlledEstate: process.env.S41_CONTROLLED_ESTATE_APPROVED === "approved" }, null, 2));
