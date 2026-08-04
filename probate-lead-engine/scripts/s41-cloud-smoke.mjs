const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const apiBase = required("PROCESS_API_URL").replace(/\/+$/, "");
const readJson = async (response) => response.json().catch(() => ({}));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = async (bytes) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const serviceHeaders = (token, actor) => ({ authorization: `Bearer ${token}`, "x-heirright-actor-email": actor, accept: "application/json" });

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
    headers: { ...serviceHeaders(token, actor), "content-type": "application/json", "idempotency-key": `s41-smoke-${estate.estateId}` },
    body: JSON.stringify({ estates: [{ ...estate, actor: { email: actor } }] }),
  });
  const intakeBody = await readJson(intake);
  assert([200, 201].includes(intake.status) && intakeBody.ok, "Approved controlled-estate intake failed.");
  const processCase = intakeBody.cases?.[0]?.case;
  assert(processCase?.id, "Approved controlled-estate intake returned no durable case.");

  const timeoutMs = Number(process.env.S41_SMOKE_TIMEOUT_MS || 120_000);
  const pollMs = Number(process.env.S41_SMOKE_POLL_MS || 2_000);
  const deadline = Date.now() + timeoutMs;
  let latest = processCase;
  while (!['packet_ready', 'blocked', 'failed', 'cancelled', 'review_required'].includes(latest?.state) && Date.now() < deadline) {
    await sleep(pollMs);
    const status = await fetch(`${apiBase}/v1/doc-prep/cases/${encodeURIComponent(processCase.id)}`, { headers: serviceHeaders(token, actor) });
    const statusBody = await readJson(status);
    assert(status.ok && statusBody.ok && statusBody.case, "Controlled-estate status readback failed.");
    latest = statusBody.case;
  }
  assert(latest?.state === "packet_ready", `Controlled-estate preparation did not reach verified PDF readiness: ${latest?.state || "unknown"}.`);
  const artifact = latest.artifact;
  assert(artifact?.contentType === "application/pdf" && artifact.readbackStatus === "verified" && artifact.url && /^[a-f0-9]{64}$/i.test(artifact.sha256 || ""), "Controlled-estate process returned an unverified artifact.");
  const artifactResponse = await fetch(artifact.url, { headers: { accept: "application/pdf" } });
  const artifactBytes = await artifactResponse.arrayBuffer();
  assert(artifactResponse.ok && artifactResponse.headers.get("content-type")?.toLowerCase().startsWith("application/pdf") && new Uint8Array(artifactBytes).slice(0, 5).every((byte, index) => byte === [0x25, 0x50, 0x44, 0x46, 0x2d][index]) && await sha256(artifactBytes) === artifact.sha256, "Controlled-estate artifact byte readback failed.");

  if (process.env.S41_VERIFY_GOOGLE_DRIVE === "approved") {
    const drive = await fetch(`${apiBase}/v1/doc-prep/exports/google-drive`, {
      method: "POST",
      headers: { ...serviceHeaders(token, actor), "content-type": "application/json" },
      body: JSON.stringify({ caseIds: [processCase.id], operatorIntent: "export_verified_pdfs_to_google_drive" }),
    });
    const driveBody = await readJson(drive);
    assert(drive.ok && driveBody.ok && driveBody.readbackStatus === "verified" && driveBody.exports?.length === 1, "Controlled-estate Google Drive PDF readback failed.");
  }
}

console.log(JSON.stringify({ ok: true, checks: ["health", "readiness", "unauthenticated-intake-denied", ...(process.env.S41_CONTROLLED_ESTATE_APPROVED === "approved" ? ["controlled-case-terminal-state", "controlled-pdf-byte-readback"] : []), ...(process.env.S41_VERIFY_GOOGLE_DRIVE === "approved" ? ["controlled-drive-readback"] : [])], controlledEstate: process.env.S41_CONTROLLED_ESTATE_APPROVED === "approved" }, null, 2));
