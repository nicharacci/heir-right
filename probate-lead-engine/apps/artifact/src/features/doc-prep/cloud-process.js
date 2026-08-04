const casesByEstate = new Map();
const hydratedEstates = new Set();

function asDisplayText(value, fallback = "") {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function processSnapshot(snapshot = {}) {
  const estate = snapshot.selectedEstate;
  const actor = snapshot.session?.user;
  if (!estate?.id) throw new Error("Select an estate before starting cloud document preparation.");
  if (!actor?.email) throw new Error("Sign in with an approved HeirRight account before starting cloud document preparation.");
  return {
    estateId: asDisplayText(estate.id),
    name: asDisplayText(estate.title, "Estate file"),
    ...(asDisplayText(estate.owner) ? { owner: asDisplayText(estate.owner) } : {}),
    address: asDisplayText(estate.address, "Address needs review"),
    county: asDisplayText(estate.county, "County needs review"),
    ...(asDisplayText(estate.parcel) ? { parcelId: asDisplayText(estate.parcel) } : {}),
    actor: {
      email: asDisplayText(actor.email),
      ...(asDisplayText(actor.name) ? { name: asDisplayText(actor.name) } : {}),
    },
  };
}

function idempotencyKey(estateId) {
  return `docprep-${encodeURIComponent(asDisplayText(estateId))}`;
}

function caseForEstate(estateId) {
  return casesByEstate.get(asDisplayText(estateId)) || null;
}

function processStateLabel(processCase) {
  return {
    queued: "Queued in cloud",
    sourcing: "Checking source evidence",
    review_required: "Needs evidence review",
    rendering: "Rendering packet",
    packet_ready: "Verified PDF ready",
    blocked: "Blocked",
    failed: "Needs retry",
    cancelled: "Stopped",
  }[processCase?.state] || "Not started";
}

function processStateTone(processCase) {
  if (processCase?.state === "packet_ready") return "ready";
  if (["blocked", "failed", "cancelled"].includes(processCase?.state)) return "blocked";
  return "review";
}

function processDetail(processCase) {
  const events = Array.isArray(processCase?.events) ? processCase.events : [];
  const latest = events.at(-1);
  return asDisplayText(latest?.detail || processCase?.blocker || processCase?.nextAction, "The cloud process will record the next document-preparation update here.");
}

function verifiedPdf(processCase) {
  const artifact = processCase?.artifact;
  return Boolean(
    processCase?.state === "packet_ready"
      && artifact?.contentType === "application/pdf"
      && artifact?.readbackStatus === "verified"
      && /^[a-f0-9]{64}$/i.test(String(artifact?.sha256 || "")),
  );
}

async function parseProcessResponse(response, fallback) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true) {
    throw new Error(asDisplayText(body?.error, fallback));
  }
  return body;
}

function storeCase(processCase) {
  const estateId = asDisplayText(processCase?.estate?.estateId);
  if (!estateId || !processCase?.id) throw new Error("The cloud process returned an invalid estate case.");
  casesByEstate.set(estateId, processCase);
  hydratedEstates.add(estateId);
  return processCase;
}

async function hydrateProcessCase(estateId, { force = false } = {}) {
  const key = asDisplayText(estateId);
  if (!key) return null;
  if (!force && hydratedEstates.has(key)) return caseForEstate(key);
  const response = await fetch(`/api/doc-prep/cases?estateId=${encodeURIComponent(key)}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (response.status === 404) {
    hydratedEstates.add(key);
    casesByEstate.delete(key);
    return null;
  }
  const body = await parseProcessResponse(response, "Document preparation status is unavailable.");
  return storeCase(body.case);
}

async function startProcessCase(snapshot = {}) {
  const estate = processSnapshot(snapshot);
  const response = await fetch("/api/doc-prep/cases", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey(estate.estateId),
    },
    body: JSON.stringify({ estates: [estate] }),
  });
  const body = await parseProcessResponse(response, "Cloud document preparation could not start.");
  const processCase = body?.cases?.[0]?.case;
  return storeCase(processCase);
}

async function requestCaseAction(processCase, action) {
  const caseId = asDisplayText(processCase?.id);
  const revision = Number(processCase?.revision);
  if (!caseId || !Number.isInteger(revision) || revision < 1) {
    throw new Error("Refresh the cloud document-preparation case before trying that action.");
  }
  const response = await fetch(`/api/doc-prep/cases/${encodeURIComponent(caseId)}/actions/${encodeURIComponent(action)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ revision }),
  });
  const body = await parseProcessResponse(response, `Cloud document preparation could not ${action}.`);
  return storeCase(body.case);
}

function clearProcessCase(estateId) {
  const key = asDisplayText(estateId);
  if (!key) return;
  hydratedEstates.delete(key);
  casesByEstate.delete(key);
}

export {
  caseForEstate,
  clearProcessCase,
  hydrateProcessCase,
  idempotencyKey,
  processDetail,
  processSnapshot,
  processStateLabel,
  processStateTone,
  requestCaseAction,
  startProcessCase,
  verifiedPdf,
};
