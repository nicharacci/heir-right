import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuildBuild } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(here);

async function importBundled(relativePath) {
  const result = await esbuildBuild({
    entryPoints: [path.join(artifactRoot, "src", relativePath)],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
    logLevel: "silent",
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${Date.now()}-${Math.random()}`);
}

const client = await importBundled("features/doc-prep/cloud-process.js");
const snapshot = {
  selectedEstateId: "estate-cloud",
  selectedEstate: {
    id: "estate-cloud",
    title: "Estate of Morgan Reyes",
    owner: "Morgan Reyes",
    address: "121 Probate Way",
    county: "Broward",
    parcel: "01-0000-000-0000",
    sourceFileReferences: ["idi-artifact-s41"],
    caseReference: "2025-CP-001234",
  },
  session: { user: { email: "operator@heirright.example", name: "Morgan Operator" } },
};

assert.deepEqual(client.processSnapshot(snapshot), {
  estateId: "estate-cloud",
  name: "Estate of Morgan Reyes",
  owner: "Morgan Reyes",
  address: "121 Probate Way",
  county: "Broward",
  parcelId: "01-0000-000-0000",
  sourceFileReferences: ["idi-artifact-s41"],
  caseReference: "2025-CP-001234",
  actor: { email: "operator@heirright.example", name: "Morgan Operator" },
});
assert.throws(() => client.processSnapshot({ ...snapshot, session: { user: null } }), /Sign in with an approved HeirRight account/);
assert.throws(
  () => client.processSnapshot({ ...snapshot, selectedEstate: { ...snapshot.selectedEstate, sourceFileReferences: [] } }),
  /Attach a verified IDI report/,
  "a cloud case cannot start without a verified persisted IDI artifact reference",
);
const missingCaseReference = client.processSnapshot({
  ...snapshot,
  selectedEstate: { ...snapshot.selectedEstate, caseReference: "" },
});
assert.equal(
  Object.hasOwn(missingCaseReference, "caseReference"),
  false,
  "missing reviewed probate references stay absent so the court stage remains review-required",
);
assert.equal(client.idempotencyKey("estate / 2"), "docprep-estate-2", "intake keys must use only the process API's accepted header characters");

const readyCase = {
  id: "case-cloud",
  estate: { estateId: "estate-cloud" },
  state: "packet_ready",
  revision: 3,
  artifact: {
    contentType: "application/pdf",
    readbackStatus: "verified",
    sha256: "a".repeat(64),
  },
  events: [{ detail: "Verified PDF stored after R2 readback." }],
};
const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  requests.push({ url: String(url), init });
  if (String(url) === "/api/doc-prep/exports/google-drive") {
    return Response.json({
      ok: true,
      readbackStatus: "verified",
      exports: [{
        caseId: readyCase.id,
        name: "EST of Morgan Reyes (08-04-2026).pdf",
        readbackStatus: "verified",
        idempotent: false,
      }],
    });
  }
  if (String(url).includes("/actions/retry")) return Response.json({ ok: true, case: readyCase });
  if (String(url).startsWith("/api/doc-prep/cases?")) return Response.json({ ok: true, case: readyCase });
  return Response.json({ ok: true, cases: [{ created: true, case: readyCase }] }, { status: 201 });
};

try {
  const started = await client.startProcessCase(snapshot);
  assert.equal(started.id, "case-cloud");
  assert.equal(requests[0].url, "/api/doc-prep/cases");
  assert.equal(requests[0].init.method, "POST");
  assert.equal(requests[0].init.headers["idempotency-key"], "docprep-estate-cloud");
  assert.deepEqual(JSON.parse(requests[0].init.body).estates[0], {
    estateId: "estate-cloud",
    name: "Estate of Morgan Reyes",
    owner: "Morgan Reyes",
    address: "121 Probate Way",
    county: "Broward",
    parcelId: "01-0000-000-0000",
    sourceFileReferences: ["idi-artifact-s41"],
    caseReference: "2025-CP-001234",
    actor: { email: "operator@heirright.example", name: "Morgan Operator" },
  });

  const hydrated = await client.hydrateProcessCase("estate-cloud", { force: true });
  assert.equal(hydrated.id, "case-cloud");
  assert.match(requests[1].url, /^\/api\/doc-prep\/cases\?estateId=estate-cloud$/);

  const retried = await client.requestCaseAction(started, "retry");
  assert.equal(retried.id, "case-cloud");
  assert.equal(JSON.parse(requests[2].init.body).revision, 3);
  assert.equal(client.caseForEstate("estate-cloud")?.id, "case-cloud");
  assert.equal(client.processStateLabel(readyCase), "Verified PDF ready");
  assert.equal(client.processStateTone(readyCase), "ready");
  assert.equal(client.processDetail(readyCase), "Verified PDF stored after R2 readback.");
  assert.equal(client.verifiedPdf(readyCase), true);
  assert.equal(client.verifiedPdf({ ...readyCase, artifact: { ...readyCase.artifact, readbackStatus: "pending" } }), false);

  await assert.rejects(
    client.exportVerifiedPdfToGoogleDrive({ ...readyCase, state: "rendering" }),
    /Wait for the cloud packet's verified PDF/,
    "the client must refuse Google delivery before the packet is byte-verified",
  );
  const delivered = await client.exportVerifiedPdfToGoogleDrive(readyCase);
  assert.equal(delivered.readbackStatus, "verified");
  assert.equal(requests[3].url, "/api/doc-prep/exports/google-drive");
  assert.deepEqual(JSON.parse(requests[3].init.body), {
    caseIds: ["case-cloud"],
    operatorIntent: "export_verified_pdfs_to_google_drive",
  });
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "cloud_intake_uses_stable_idempotency",
    "cloud_case_hydrates_after_reload",
    "cloud_actions_carry_durable_revision",
    "cloud_pdf_requires_verified_readback",
    "cloud_drive_export_requires_verified_pdf",
  ],
}));
