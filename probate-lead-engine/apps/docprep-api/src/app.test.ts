import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { DOC_PREP_STAGES, InMemoryProcessRepository, ProcessCase } from "@ple/docprep-core";
import { createApp, estatePdfFileName } from "./app.js";

const repository = new InMemoryProcessRepository();
const app = createApp({ serviceToken: "test-service-token", repository, now: () => 1 });
const headers = { authorization: "Bearer test-service-token", "x-heirright-actor-email": "operator@heirright.com", "x-heirright-actor-name": "Sam Frederique", "idempotency-key": "api-idempotency-000001", "content-type": "application/json" };
const body = { estates: [{ estateId: "estate-api-1", name: "Estate of Morgan Bell", address: "9 Palm Rd, Miami, FL", county: "Miami-Dade", actor: { email: "operator@heirright.com" } }] };
async function completeStages(target: InMemoryProcessRepository, processCase: ProcessCase) {
  let current = processCase.state === "queued" ? await target.transition(processCase.id, processCase.revision, "sourcing", "stages") : processCase;
  for (const stage of DOC_PREP_STAGES) {
    const running = await target.startStage(current.id, current.revision, stage.id);
    current = await target.finishStage(running.id, running.revision, stage.id, { status: "succeeded", detail: `${stage.id} complete.`, evidenceReferences: [`evidence:${stage.id}`], facts: { stageId: stage.id } });
  }
  return current;
}
test("the API authenticates durable intake and returns the same case for a duplicate click", async () => {
  const first = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers, body: JSON.stringify(body) }); assert.equal(first.status, 201); const firstBody = await first.json() as any;
  const repeat = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers, body: JSON.stringify(body) }); assert.equal(repeat.status, 200); const repeatBody = await repeat.json() as any;
  assert.equal(firstBody.cases[0].case.id, repeatBody.cases[0].case.id);
  assert.equal(firstBody.cases[0].case.estate.actor.email, "operator@heirright.com", "the trusted service actor replaces browser payload actor data");
});
test("the API denies unauthenticated process commands", async () => { const response = await app.request("http://api/v1/doc-prep/cases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); assert.equal(response.status, 401); });
test("the API cancels with the durable revision guard", async () => {
  const processCase = await repository.findByEstate("estate-api-1");
  assert.ok(processCase);
  const cancelled = await app.request(`http://api/v1/doc-prep/cases/${processCase.id}/actions/cancel`, { method: "POST", headers, body: JSON.stringify({ revision: processCase.revision }) });
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json() as any).case.state, "cancelled");
});
test("the durable event stream preserves all six phase updates in order", async () => {
  const streamRepository = new InMemoryProcessRepository();
  const [intake] = await streamRepository.intake({ estates: [{ estateId: "estate-api-stream", name: "Estate of Stream", address: "4 Stream St, Miami, FL", county: "Miami-Dade", sourceFileReferences: ["idi-stream-1"], actor: { email: "operator@heirright.com" } }] }, "api-stream-idempotency-001");
  const stagesDone = await completeStages(streamRepository, intake.case);
  const rendering = await streamRepository.transition(stagesDone.id, stagesDone.revision, "rendering", "Packet rendering started.");
  const ready = await streamRepository.recordArtifact(rendering.id, rendering.revision, { objectKey: "docprep/stream.pdf", contentType: "application/pdf", bytes: 16, sha256: "a".repeat(64), readbackStatus: "verified", verifiedAt: new Date().toISOString(), url: "https://public.example.test/docprep/stream.pdf" });
  const streamApp = createApp({ serviceToken: "test-service-token", repository: streamRepository, now: () => 1 });
  const response = await streamApp.request(`http://api/v1/doc-prep/cases/${ready.id}/events`, { headers });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
  const body = await response.text();
  const events = body.split("\n\n").flatMap((block) => {
    if (!block.includes("event: case")) return [];
    const data = block.split("\n").find((line) => line.startsWith("data: "));
    return data ? [JSON.parse(data.slice("data: ".length))] : [];
  });
  const stageEvents = events.filter((event) => event.stageId);
  assert.deepEqual(stageEvents.map((event) => `${event.type}:${event.stageId}`), DOC_PREP_STAGES.flatMap((stage) => [`stage_started:${stage.id}`, `stage_finished:${stage.id}`]));
  assert.match(stageEvents[1].detail, /skip_trace_parse complete/);
  assert.match(stageEvents.at(-1).detail, /backstory_generate complete/);
});
test("readiness checks the repository connection instead of treating a missing case as healthy", async () => {
  assert.equal((await app.request("http://api/readyz")).status, 200);
  class OfflineRepository extends InMemoryProcessRepository { override async ready() { throw new Error("database unavailable"); } }
  const offlineApp = createApp({ serviceToken: "test-service-token", repository: new OfflineRepository() });
  assert.equal((await offlineApp.request("http://api/readyz")).status, 503);
});
test("the retry API resumes the first review-required stage while preserving succeeded evidence", async () => {
  const retryRepository = new InMemoryProcessRepository();
  const [intake] = await retryRepository.intake({ estates: [{ estateId: "estate-api-retry", name: "Estate of Morgan Bell", address: "9 Palm Rd, Miami, FL", county: "Miami-Dade", sourceFileReferences: ["idi-report-upload-1"], actor: { email: "operator@heirright.com" } }] }, "api-retry-idempotency-001");
  const sourcing = await retryRepository.transition(intake.case.id, intake.case.revision, "sourcing", "stages");
  const firstRunning = await retryRepository.startStage(sourcing.id, sourcing.revision, "skip_trace_parse");
  const firstDone = await retryRepository.finishStage(firstRunning.id, firstRunning.revision, "skip_trace_parse", { status: "succeeded", detail: "IDI parsed.", evidenceReferences: ["idi:parsed"], facts: { heirs: 2 } });
  const secondRunning = await retryRepository.startStage(firstDone.id, firstDone.revision, "obituary_search");
  const review = await retryRepository.finishStage(secondRunning.id, secondRunning.revision, "obituary_search", { status: "review_required", detail: "Confirm obituary.", nextAction: "Review the candidate.", evidenceReferences: ["obituary:candidate"], facts: { candidates: 1 } });
  const retryApp = createApp({ serviceToken: "test-service-token", repository: retryRepository });
  const response = await retryApp.request(`http://api/v1/doc-prep/cases/${review.id}/actions/retry`, { method: "POST", headers, body: JSON.stringify({ revision: review.revision }) });
  assert.equal(response.status, 200);
  const retried = (await response.json() as any).case;
  assert.equal(retried.steps.find((step: any) => step.id === "skip_trace_parse").state, "succeeded");
  assert.equal(retried.steps.find((step: any) => step.id === "obituary_search").state, "pending");
});
test("downloads and Google Drive exports only use a byte-verified PDF", async () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\nverified\n");
  const expectedPdfName = estatePdfFileName("Estate of Morgan Bell");
  const hash = createHash("sha256").update(pdf).digest("hex");
  const md5 = createHash("md5").update(pdf).digest("hex");
  const exportRepository = new InMemoryProcessRepository();
  const [intake] = await exportRepository.intake({ estates: [{ estateId: "estate-api-export", name: "Estate of Morgan Bell", address: "9 Palm Rd, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }] }, "api-export-idempotency-001");
  const stagesDone = await completeStages(exportRepository, intake.case);
  const rendering = await exportRepository.transition(stagesDone.id, stagesDone.revision, "rendering", "render");
  const ready = await exportRepository.recordArtifact(rendering.id, rendering.revision, { objectKey: "docprep/export.pdf", contentType: "application/pdf", bytes: pdf.byteLength, sha256: hash, readbackStatus: "verified", verifiedAt: new Date().toISOString(), url: "https://public.example.test/docprep/export.pdf" });
  const requests: Array<{ url: string; method: string; authorization: string; body?: string }> = [];
  const credentialRefreshes: boolean[] = [];
  const artifactStoreReads: string[] = [];
  const artifactStore = {
    async get(objectKey: string) {
      artifactStoreReads.push(objectKey);
      if (objectKey !== "docprep/export.pdf") throw new Error("unexpected object key");
      return pdf;
    },
  };
  const fetcher = async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const authorization = String((init?.headers as Record<string, string> | undefined)?.authorization || "");
    requests.push({ url, method: init?.method || "GET", authorization, body: typeof init?.body === "string" ? init.body : undefined });
    if (authorization === "Bearer expired-drive-token") return Response.json({ error: "expired" }, { status: 401 });
    if (url.includes("drive/v3/files?q=")) return Response.json({ files: [] });
    if (url.includes("drive/v3/files?fields=id,name,mimeType,parents")) return Response.json({ id: "drive-team-folder-1", name: "S Frederique", mimeType: "application/vnd.google-apps.folder", parents: ["shared-root"] });
    if (url.includes("drive/v3/files/drive-team-folder-1")) return Response.json({ id: "drive-team-folder-1", name: "S Frederique", mimeType: "application/vnd.google-apps.folder", parents: ["shared-root"] });
    if (url.includes("upload/drive/v3/files")) return Response.json({ id: "drive-pdf-1", name: expectedPdfName, mimeType: "application/pdf", md5Checksum: md5, webViewLink: "https://drive.example/drive-pdf-1" });
    return Response.json({ id: "drive-pdf-1", name: expectedPdfName, mimeType: "application/pdf", md5Checksum: md5, appProperties: { heirrightDocprepCaseId: ready.id, heirrightPdfSha256: hash }, webViewLink: "https://drive.example/drive-pdf-1" });
  };
  const publicOnlyApp = createApp({ serviceToken: "test-service-token", repository: exportRepository, fetcher: fetcher as typeof fetch });
  const deniedPublicFallback = await publicOnlyApp.request(`http://api/v1/doc-prep/cases/${ready.id}/download`, { headers });
  assert.equal(deniedPublicFallback.status, 409, "the API must not retrieve a packet through a public storage URL");
  const exportApp = createApp({
    serviceToken: "test-service-token",
    repository: exportRepository,
    artifactStore,
    fetcher: fetcher as typeof fetch,
    googleDrive: {
      getCredentials: async ({ forceRefresh = false } = {}) => {
        credentialRefreshes.push(forceRefresh);
        return { accessToken: forceRefresh ? "refreshed-drive-token" : "expired-drive-token", parentFolderId: "shared-root" };
      },
    },
  });
  const visibleCase = await exportApp.request(`http://api/v1/doc-prep/cases/${ready.id}`, { headers });
  assert.equal((await visibleCase.json() as any).case.artifact.url, undefined, "the case JSON must not expose the R2 artifact URL");
  const download = await exportApp.request(`http://api/v1/doc-prep/cases/${ready.id}/download`, { headers });
  assert.equal(download.status, 200); assert.equal(download.headers.get("content-type"), "application/pdf"); assert.match(download.headers.get("content-disposition") || "", new RegExp(expectedPdfName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const view = await exportApp.request(`http://api/v1/doc-prep/cases/${ready.id}/view`, { headers });
  assert.equal(view.status, 200); assert.match(view.headers.get("content-disposition") || "", /^inline;/, "opening a verified PDF must remain an inline authenticated response");
  const exported = await exportApp.request("http://api/v1/doc-prep/exports/google-drive", { method: "POST", headers, body: JSON.stringify({ caseIds: [ready.id], operatorIntent: "export_verified_pdfs_to_google_drive" }) });
  assert.equal(exported.status, 200); const exportedBody = await exported.json() as any;
  assert.equal(exportedBody.readbackStatus, "verified"); assert.equal(exportedBody.exports[0].name, expectedPdfName);
  const repeatExport = await exportApp.request("http://api/v1/doc-prep/exports/google-drive", { method: "POST", headers, body: JSON.stringify({ caseIds: [ready.id], operatorIntent: "export_verified_pdfs_to_google_drive" }) });
  assert.equal(repeatExport.status, 200);
  assert.equal((await repeatExport.json() as any).exports[0].idempotent, true, "the durable export ledger must reuse a completed Drive export");
  assert.deepEqual(artifactStoreReads, ["docprep/export.pdf", "docprep/export.pdf", "docprep/export.pdf", "docprep/export.pdf"]);
  assert.deepEqual(credentialRefreshes, [false, true], "a Drive 401 must force one broker refresh before retrying");
  assert.deepEqual(requests.map((request) => request.method), ["GET", "GET", "POST", "GET", "GET", "POST", "GET"]);
  assert.equal(requests[0].authorization, "Bearer expired-drive-token");
  assert.equal(requests[1].authorization, "Bearer refreshed-drive-token");
  assert.deepEqual(JSON.parse(requests[2].body || "{}"), { name: "S Frederique", mimeType: "application/vnd.google-apps.folder", parents: ["shared-root"], appProperties: { heirrightDocprepOperatorFolder: "S Frederique" } });
});
