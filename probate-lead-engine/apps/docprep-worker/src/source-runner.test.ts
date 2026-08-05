import assert from "node:assert/strict";
import test from "node:test";
import { DOC_PREP_STAGES, InMemoryProcessRepository } from "@ple/docprep-core";
import { createCloudflareSourceRunner, createCloudflareStageRunner } from "./source-runner.js";

const processCase = async () => {
  const repository = new InMemoryProcessRepository();
  const [intake] = await repository.intake({ estates: [{ estateId: "estate-source-1", name: "Estate of Casey Fox", address: "8 Bay St, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }] }, "source-idempotency-0001");
  return intake.case;
};

const structuredEvidence = (stageId: string) => ({
  id: `evidence-${stageId}`,
  stageId,
  source: "fixture_source",
  rawId: `fixture-${stageId}`,
  fetchedAt: "2026-08-05T12:00:00.000Z",
  factType: "fixture_fact",
  value: { stageId, verified: true },
});

test("source-runner output persists in memory and reaches each next stage, including backstory", async () => {
  const repository = new InMemoryProcessRepository();
  const [created] = await repository.intake({ estates: [{ estateId: "estate-cross-boundary", name: "Estate of Casey Fox", address: "8 Bay St, Miami, FL", county: "Miami-Dade", sourceFileReferences: ["idi-report-1"], actor: { email: "operator@heirright.com" } }] }, "cross-boundary-idempotency-01");
  const requests: Array<{ stageId: string; priorStageOutputs: unknown }> = [];
  const runner = createCloudflareStageRunner({
    workerUrl: "https://source.example",
    apiToken: "test-token",
    fetcher: (async (input, init) => {
      const request = JSON.parse(String(init?.body)) as { priorStageOutputs: unknown[] };
      const stageId = String(new URL(String(input)).pathname.split("/").at(-1));
      requests.push({ stageId, priorStageOutputs: request.priorStageOutputs });
      const record = structuredEvidence(stageId);
      return Response.json({
        ok: true,
        stageId,
        status: "succeeded",
        detail: `${stageId} returned.`,
        evidenceReferences: [record],
        facts: { records: [{ source: "fixture_source", rawId: `fact-${stageId}`, fetchedAt: "2026-08-05T12:00:00.000Z", factType: "fixture_fact", value: { stageId }, confidence: 1, reviewFlags: [], evidenceReferenceIds: [record.id] }] },
      });
    }) as typeof fetch,
  });
  let current = await repository.transition(created.case.id, created.case.revision, "sourcing", "stages");
  for (const stage of DOC_PREP_STAGES) {
    const running = await repository.startStage(current.id, current.revision, stage.id);
    const priorStageOutputs = running.steps
      .filter((step) => step.state === "succeeded" && DOC_PREP_STAGES.some((candidate) => candidate.id === step.id))
      .map((step) => ({ stageId: step.id as (typeof DOC_PREP_STAGES)[number]["id"], evidenceReferences: step.evidenceReferences }));
    const outcome = await runner(stage.id, { caseId: running.id, estate: running.estate, priorStageOutputs, actor: running.estate.actor });
    current = await repository.finishStage(running.id, running.revision, stage.id, outcome);
  }
  const backstoryRequest = requests.find((request) => request.stageId === "backstory_generate");
  assert.ok(backstoryRequest);
  const prior = backstoryRequest.priorStageOutputs as Array<{ stageId: string; evidenceReferences: Array<Record<string, unknown>> }>;
  assert.equal(prior.length, 5);
  assert.equal(prior[0].evidenceReferences[0].id, "evidence-skip_trace_parse");
  assert.deepEqual(prior[0].evidenceReferences[0].value, { stageId: "skip_trace_parse", verified: true });
  assert.deepEqual(current.steps.find((step) => step.id === "skip_trace_parse")?.facts, { records: [{ source: "fixture_source", rawId: "fact-skip_trace_parse", fetchedAt: "2026-08-05T12:00:00.000Z", factType: "fixture_fact", value: { stageId: "skip_trace_parse" }, confidence: 1, reviewFlags: [], evidenceReferenceIds: ["evidence-skip_trace_parse"] }] });
});

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

test("source transport reports only server failures and invalid responses", async () => {
  const failures: Array<Record<string, string>> = [];
  const runner = createCloudflareStageRunner({
    workerUrl: "https://source.example",
    apiToken: "test-token",
    reportSystemFailure: async (failure) => { failures.push(failure); },
    fetcher: (async () => new Response("upstream", { status: 503 })) as typeof fetch,
  });
  const current = await processCase();
  const estate = { ...current.estate, sourceFileReferences: ["idi-report-upload-1"] };
  const blocked = await runner("obituary_search", { caseId: current.id, estate, priorStageOutputs: [{ stageId: "skip_trace_parse", evidenceReferences: ["idi:parsed"] }], actor: estate.actor });
  assert.equal(blocked.status, "blocked");
  assert.equal(failures[0].code, "source_transport_failed");

  failures.length = 0;
  const invalidRunner = createCloudflareStageRunner({
    workerUrl: "https://source.example",
    apiToken: "test-token",
    reportSystemFailure: async (failure) => { failures.push(failure); },
    fetcher: (async () => Response.json({ ok: true, stageId: "obituary_search", status: "succeeded", detail: "invalid evidence", evidenceReferences: [{ id: "bad" }], facts: {} })) as typeof fetch,
  });
  const invalid = await invalidRunner("obituary_search", { caseId: current.id, estate, priorStageOutputs: [{ stageId: "skip_trace_parse", evidenceReferences: ["idi:parsed"] }], actor: estate.actor });
  assert.equal(invalid.status, "failed");
  assert.equal(failures[0].code, "source_invalid_response");

  failures.length = 0;
  const inputRunner = createCloudflareStageRunner({
    workerUrl: "https://source.example",
    apiToken: "test-token",
    reportSystemFailure: async (failure) => { failures.push(failure); },
    fetcher: (async () => new Response("input", { status: 422 })) as typeof fetch,
  });
  const review = await inputRunner("obituary_search", { caseId: current.id, estate, priorStageOutputs: [{ stageId: "skip_trace_parse", evidenceReferences: ["idi:parsed"] }], actor: estate.actor });
  assert.equal(review.status, "blocked");
  assert.equal(failures.length, 0);
});

test("packet renderer reports server transport failures and keeps review responses unlogged", async () => {
  const failures: Array<Record<string, string>> = [];
  const current = await processCase();
  const renderer = createCloudflareSourceRunner({
    workerUrl: "https://source.example",
    apiToken: "test-token",
    reportSystemFailure: async (failure) => { failures.push(failure); },
    fetcher: (async () => new Response("upstream", { status: 503 })) as typeof fetch,
  });
  const blocked = await renderer(current);
  assert.equal(blocked.kind, "blocked");
  assert.equal(failures[0].code, "packet_renderer_transport_failed");

  failures.length = 0;
  const reviewRenderer = createCloudflareSourceRunner({
    workerUrl: "https://source.example",
    apiToken: "test-token",
    reportSystemFailure: async (failure) => { failures.push(failure); },
    fetcher: (async () => new Response("missing", { status: 404 })) as typeof fetch,
  });
  const review = await reviewRenderer(current);
  assert.equal(review.kind, "blocked");
  assert.equal(failures.length, 0);
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
