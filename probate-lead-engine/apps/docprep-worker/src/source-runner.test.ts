import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryProcessRepository } from "@ple/docprep-core";
import { createCloudflareSourceRunner, createCloudflareStageRunner } from "./source-runner.js";

const processCase = async () => {
  const repository = new InMemoryProcessRepository();
  const [intake] = await repository.intake({ estates: [{ estateId: "estate-source-1", name: "Estate of Casey Fox", address: "8 Bay St, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }] }, "source-idempotency-0001");
  return intake.case;
};

test("stage one requires a persisted IDI upload and never calls a live IDI or stage endpoint when it is missing", async () => {
  let fetchCalls = 0;
  const runner = createCloudflareStageRunner({ workerUrl: "https://source.example", apiToken: "test-token", fetcher: (async () => { fetchCalls += 1; throw new Error("must not fetch"); }) as typeof fetch });
  const current = await processCase();
  const result = await runner("skip_trace_parse", { caseId: current.id, estate: current.estate, priorStageOutputs: [], actor: current.estate.actor });
  assert.equal(result.status, "review_required");
  assert.match(result.detail, /persisted uploaded IDI report/);
  assert.equal(fetchCalls, 0);
});

test("the stage runner posts the exact ordered-stage contract and validates the response", async () => {
  const current = await processCase();
  const estate = { ...current.estate, sourceFileReferences: ["idi-report-upload-1"] };
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = async (input: string | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return Response.json({ ok: true, stageId: "obituary_search", status: "succeeded", detail: "Obituary evidence gathered.", evidenceReferences: ["obituary:1"], facts: { matches: 1 } });
  };
  const result = await createCloudflareStageRunner({ workerUrl: "https://source.example/", apiToken: "test-token", fetcher: fetcher as typeof fetch })("obituary_search", {
    caseId: current.id,
    estate,
    priorStageOutputs: [{ stageId: "skip_trace_parse", evidenceReferences: ["idi:parsed"] }],
    actor: estate.actor,
  });
  assert.equal(result.status, "succeeded");
  assert.equal(requests[0].url, "https://source.example/api/doc-prep/stages/obituary_search");
  assert.equal(requests[0].init?.method, "POST");
  assert.equal((requests[0].init?.headers as Record<string, string>)["idempotency-key"], `docprep:${current.id}:obituary_search`);
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { caseId: current.id, estate, priorStageOutputs: [{ stageId: "skip_trace_parse", evidenceReferences: ["idi:parsed"] }], actor: estate.actor });
});

test("the Cloudflare source runner accepts only a verified existing Discovery PDF", async () => {
  const calls: string[] = [];
  const fetcher = async (input: string | URL) => {
    const url = String(input); calls.push(url);
    if (url.includes("/api/discovery/file")) return Response.json({ ok: true, exists: true, packetArtifacts: [{ flow: "discovery", contentType: "application/pdf", readbackStatus: "verified", artifactUrl: "/api/reports/pdf?artifactId=packet-1" }] });
    return new Response(new TextEncoder().encode("%PDF-1.7\n"), { headers: { "content-type": "application/pdf" } });
  };
  const result = await createCloudflareSourceRunner({ workerUrl: "https://source.example", apiToken: "test-token", fetcher: fetcher as typeof fetch })(await processCase());
  assert.equal(result.kind, "ready");
  assert.equal(calls.length, 2);
});

test("the Cloudflare source runner renders a stored reviewed dossier and verifies its PDF", async () => {
  const calls: string[] = [];
  const fetcher = async (input: string | URL) => {
    const url = String(input); calls.push(url);
    if (url.includes("/api/discovery/file")) return Response.json({ ok: true, exists: true, dossier: { id: "dossier-1" } });
    if (url.endsWith("/api/exports")) return Response.json({ ok: true, artifactUrl: "/api/reports/pdf?artifactId=packet-2" });
    return new Response(new TextEncoder().encode("%PDF-1.7\n"), { headers: { "content-type": "application/pdf" } });
  };
  const result = await createCloudflareSourceRunner({ workerUrl: "https://source.example", apiToken: "test-token", fetcher: fetcher as typeof fetch })(await processCase());
  assert.equal(result.kind, "ready");
  assert.deepEqual(calls.map((url) => new URL(url).pathname), ["/api/discovery/file", "/api/exports", "/api/reports/pdf"]);
});

test("the Cloudflare source runner preserves manual review when Discovery is not persisted", async () => {
  const fetcher = async () => Response.json({ ok: true, exists: false });
  const result = await createCloudflareSourceRunner({ workerUrl: "https://source.example", apiToken: "test-token", fetcher: fetcher as typeof fetch })(await processCase());
  assert.equal(result.kind, "review_required");
});
