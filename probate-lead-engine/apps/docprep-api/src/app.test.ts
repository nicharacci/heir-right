import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { InMemoryProcessRepository } from "@ple/docprep-core";
import { createApp } from "./app.js";

const repository = new InMemoryProcessRepository();
const app = createApp({ serviceToken: "test-service-token", repository, now: () => 1 });
const headers = { authorization: "Bearer test-service-token", "x-heirright-actor-email": "operator@heirright.com", "idempotency-key": "api-idempotency-000001", "content-type": "application/json" };
const body = { estates: [{ estateId: "estate-api-1", name: "Estate of Morgan Bell", address: "9 Palm Rd, Miami, FL", county: "Miami-Dade", actor: { email: "operator@heirright.com" } }] };
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
test("readiness checks the repository connection instead of treating a missing case as healthy", async () => {
  assert.equal((await app.request("http://api/readyz")).status, 200);
  class OfflineRepository extends InMemoryProcessRepository { override async ready() { throw new Error("database unavailable"); } }
  const offlineApp = createApp({ serviceToken: "test-service-token", repository: new OfflineRepository() });
  assert.equal((await offlineApp.request("http://api/readyz")).status, 503);
});
test("downloads and Google Drive exports only use a byte-verified PDF", async () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\nverified\n");
  const hash = createHash("sha256").update(pdf).digest("hex");
  const md5 = createHash("md5").update(pdf).digest("hex");
  const exportRepository = new InMemoryProcessRepository();
  const [intake] = await exportRepository.intake({ estates: [{ estateId: "estate-api-export", name: "Estate of Morgan Bell", address: "9 Palm Rd, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }] }, "api-export-idempotency-001");
  const sourcing = await exportRepository.transition(intake.case.id, intake.case.revision, "sourcing", "source");
  const rendering = await exportRepository.transition(sourcing.id, sourcing.revision, "rendering", "render");
  const ready = await exportRepository.recordArtifact(rendering.id, rendering.revision, { objectKey: "docprep/export.pdf", contentType: "application/pdf", bytes: pdf.byteLength, sha256: hash, readbackStatus: "verified", verifiedAt: new Date().toISOString(), url: "https://public.example.test/docprep/export.pdf" });
  const requests: Array<{ url: string; method: string; authorization: string }> = [];
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
    requests.push({ url, method: init?.method || "GET", authorization });
    if (authorization === "Bearer expired-drive-token") return Response.json({ error: "expired" }, { status: 401 });
    if (url.includes("drive/v3/files?q=")) return Response.json({ files: [] });
    if (url.includes("upload/drive/v3/files")) return Response.json({ id: "drive-pdf-1", name: "EST of Morgan Bell.pdf 08-04-2026", mimeType: "application/pdf", md5Checksum: md5, webViewLink: "https://drive.example/drive-pdf-1" });
    return Response.json({ id: "drive-pdf-1", name: "EST of Morgan Bell.pdf 08-04-2026", mimeType: "application/pdf", md5Checksum: md5, appProperties: { heirrightDocprepCaseId: ready.id, heirrightPdfSha256: hash }, webViewLink: "https://drive.example/drive-pdf-1" });
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
        return { accessToken: forceRefresh ? "refreshed-drive-token" : "expired-drive-token" };
      },
    },
  });
  const visibleCase = await exportApp.request(`http://api/v1/doc-prep/cases/${ready.id}`, { headers });
  assert.equal((await visibleCase.json() as any).case.artifact.url, undefined, "the case JSON must not expose the R2 artifact URL");
  const download = await exportApp.request(`http://api/v1/doc-prep/cases/${ready.id}/download`, { headers });
  assert.equal(download.status, 200); assert.equal(download.headers.get("content-type"), "application/pdf"); assert.match(download.headers.get("content-disposition") || "", /EST of Morgan Bell\.pdf/);
  const view = await exportApp.request(`http://api/v1/doc-prep/cases/${ready.id}/view`, { headers });
  assert.equal(view.status, 200); assert.match(view.headers.get("content-disposition") || "", /^inline;/, "opening a verified PDF must remain an inline authenticated response");
  const exported = await exportApp.request("http://api/v1/doc-prep/exports/google-drive", { method: "POST", headers, body: JSON.stringify({ caseIds: [ready.id], operatorIntent: "export_verified_pdfs_to_google_drive" }) });
  assert.equal(exported.status, 200); const exportedBody = await exported.json() as any;
  assert.equal(exportedBody.readbackStatus, "verified"); assert.equal(exportedBody.exports[0].name, "EST of Morgan Bell.pdf 08-04-2026");
  const repeatExport = await exportApp.request("http://api/v1/doc-prep/exports/google-drive", { method: "POST", headers, body: JSON.stringify({ caseIds: [ready.id], operatorIntent: "export_verified_pdfs_to_google_drive" }) });
  assert.equal(repeatExport.status, 200);
  assert.equal((await repeatExport.json() as any).exports[0].idempotent, true, "the durable export ledger must reuse a completed Drive export");
  assert.deepEqual(artifactStoreReads, ["docprep/export.pdf", "docprep/export.pdf", "docprep/export.pdf", "docprep/export.pdf"]);
  assert.deepEqual(credentialRefreshes, [false, true], "a Drive 401 must force one broker refresh before retrying");
  assert.deepEqual(requests.map((request) => request.method), ["GET", "GET", "POST", "GET"]);
  assert.equal(requests[0].authorization, "Bearer expired-drive-token");
  assert.equal(requests[1].authorization, "Bearer refreshed-drive-token");
});
