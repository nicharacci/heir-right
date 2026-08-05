import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import worker, { normalizeDocPrepStageResponse } from "./cloudflare";
import { DOC_PREP_STAGE_IDS, type DocPrepStageId } from "./adapters/doc-prep-stages";
import { resetServerNousCredentialCache } from "./agentic/nous-free-model";

const API_TOKEN = "test-api-token";
const CASE_ID = "11111111-1111-4111-8111-111111111111";
const FETCHED_AT = "2026-08-05T12:00:00.000Z";

class MemoryKv {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function evidence(stageId: DocPrepStageId, suffix: string = stageId) {
  return {
    id: `ref-${suffix}`,
    stageId,
    source: "fixture_source",
    rawId: `fixture-${suffix}`,
    fetchedAt: FETCHED_AT,
    factType: "fixture_fact",
    value: `Verified evidence ${suffix}`,
  };
}

function stageInput(stageId: DocPrepStageId, overrides: Record<string, unknown> = {}) {
  const index = DOC_PREP_STAGE_IDS.indexOf(stageId);
  const actor = { email: "operator@heirright.com", name: "Operator" };
  return {
    caseId: CASE_ID,
    estate: {
      estateId: "estate-doc-prep-1",
      name: "Estate of Casey Fox",
      owner: "Casey Fox",
      address: "8 Bay St, Miami, FL 33101",
      county: "Miami-Dade",
      parcelId: "0123456789000",
      caseReference: "2026-000001-CP-02",
      sourceFileReferences: ["idi-report-1"],
      actor,
    },
    priorStageOutputs: DOC_PREP_STAGE_IDS.slice(0, index).map((priorStageId) => ({
      stageId: priorStageId,
      evidenceReferences: [evidence(priorStageId)],
    })),
    actor,
    ...overrides,
  };
}

function environment(overrides: Record<string, unknown> = {}) {
  return {
    AUTH_REQUIRED: "true",
    HEIRRIGHT_API_TOKEN: API_TOKEN,
    DEPLOYMENT_KEY: "s41-doc-prep-test",
    ...overrides,
  };
}

async function callStage(stageId: DocPrepStageId, body: unknown, env: Record<string, unknown>) {
  const response = await worker.fetch(new Request(`https://worker.example/api/doc-prep/stages/${stageId}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }), env as never);
  return { response, body: await response.json() as Record<string, unknown> };
}

async function withFetch<T>(fetcher: typeof fetch, work: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    return await work();
  } finally {
    globalThis.fetch = original;
  }
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function persistedIdiRecord() {
  return {
    version: 1,
    revision: "idi-revision-1",
    assetKey: "estate-doc-prep-1",
    provider: "idi",
    mode: "uploaded_file",
    lockKey: "idi:estate-doc-prep-1",
    importedAt: FETCHED_AT,
    importedBy: "operator@heirright.com",
    attachment: {
      id: "idi-report-1",
      estateId: "estate-doc-prep-1",
      documentId: "idi-asset-search",
      fileName: "IDI report.pdf",
      contentType: "application/pdf",
      size: 900,
      contentHash: "a".repeat(64),
      createdAt: FETCHED_AT,
      artifactUrl: "/api/discovery/idi-asset-search/import?assetKey=estate-doc-prep-1",
      readbackStatus: "verified",
    },
    extraction: {
      status: "extracted",
      method: "pdf_text",
      fileKind: "pdf",
      extractedAt: FETCHED_AT,
      characterCount: 2_000,
      sourceLocators: [{ kind: "page", index: 2, label: "Possible relative" }],
    },
    subjectMatch: { matched: true, signals: ["owner", "address"], reviewedAt: FETCHED_AT },
    candidates: [{
      id: "estate-doc-prep-1:idi:1",
      name: "Jordan Fox",
      relationship: "sibling",
      group: "primary",
      phones: ["305-555-0101"],
      emails: [],
      addressHistory: [],
      ownerLastNameMatch: true,
      confidence: 88,
      confidenceReason: "Exact report extraction",
      reviewStatus: "needs_review",
      sourceLocator: { kind: "page", index: 2, label: "Possible relative" },
    }],
    contactPreviewCount: 1,
    importVerification: "verified",
    paidRun: false,
    paidRunVerification: "not_applicable",
    duplicateGuard: "first_import_only",
    adminOverrideReason: null,
  };
}

test("all six authenticated stage routes execute sequentially through existing providers", { concurrency: false }, async () => {
  const kv = new MemoryKv();
  kv.values.set(`idi-import:${createHash("sha256").update("estate-doc-prep-1").digest("hex")}`, JSON.stringify(persistedIdiRecord()));

  const skip = await callStage("skip_trace_parse", stageInput("skip_trace_parse"), environment({ PACKET_ARTIFACTS: kv }));
  assert.equal(skip.response.status, 200);
  assert.equal(skip.body.status, "succeeded");
  assert.deepEqual(Object.keys(skip.body).sort(), ["detail", "evidenceReferences", "facts", "ok", "stageId", "status"]);

  await withFetch(async (input) => {
    assert.equal(String(input), "https://workflow.example/obituary");
    return jsonResponse({
      ok: true,
      status: "reviewed",
      obituaryLink: "https://legacy.example/casey-fox",
      dateOfDeath: "05/01/2025",
      obituarySnapshot: "Casey Fox obituary reviewed.",
    });
  }, async () => {
    const result = await callStage("obituary_search", stageInput("obituary_search"), environment({
      OBITUARY_VITAL_WORKFLOW_URL: "https://workflow.example/obituary",
    }));
    assert.equal(result.body.status, "succeeded");
  });

  await withFetch(async () => jsonResponse({
    Status: "OK",
    OfficialRecordList: {
      OfficialRecords: [{
        REC_DATE: "05/02/2025",
        DOC_DATE: "05/01/2025",
        REC_BOOK: "12345",
        REC_PAGE: "678",
        DOC_TYPE: "DEED",
        FIRST_PARTY: "CASEY FOX",
      }],
    },
  }), async () => {
    const result = await callStage("deed_title_search", stageInput("deed_title_search"), environment({ MIAMI_DADE_CLERK_AUTH_KEY: "configured-test-key" }));
    assert.equal(result.body.status, "succeeded");
  });

  let taxCalls = 0;
  await withFetch(async (input) => {
    taxCalls += 1;
    const url = String(input);
    if (url.endsWith("/account/1")) {
      return new Response('<html><a class="receipt pull-right" href="/receipt/1">Print property tax receipt</a></html>', {
        headers: { "content-type": "text/html" },
      });
    }
    assert.equal(url, "https://county-taxes.net/receipt/1");
    return new Response("<html>Paid By: Jordan Fox  Paid Date: 05/03/2025  Amount Due: $120.00</html>", {
      headers: { "content-type": "text/html" },
    });
  }, async () => {
    const result = await callStage("tax_receipt_fetch", stageInput("tax_receipt_fetch"), environment({
      TAX_COLLECTOR_LISTING_URL: "https://county-taxes.net/account/1",
    }));
    assert.equal(result.body.status, "succeeded");
    assert.equal(taxCalls, 2);
  });

  let activeClerkCalls = 0;
  let maxActiveClerkCalls = 0;
  let courtCalls = 0;
  await withFetch(async (_input) => {
    courtCalls += 1;
    activeClerkCalls += 1;
    maxActiveClerkCalls = Math.max(maxActiveClerkCalls, activeClerkCalls);
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    activeClerkCalls -= 1;
    return courtCalls === 1
      ? jsonResponse({ Status: "OK", CaseInfo: { caseNumber: "2026-000001-CP-02", caseStatus: "OPEN", caseType: "PROBATE" } })
      : jsonResponse({ Status: "OK", DocketsList: { DocketInfo: [{ eventDate: "05/04/2025", docketNumber: 1, docketDescrition: "Petition", numberOfDocuments: 1 }] } });
  }, async () => {
    const result = await callStage("court_records_search", stageInput("court_records_search"), environment({ MIAMI_DADE_CLERK_AUTH_KEY: "configured-test-key" }));
    assert.equal(result.body.status, "succeeded");
    assert.equal(courtCalls, 2);
    assert.equal(maxActiveClerkCalls, 1);
  });

  resetServerNousCredentialCache();
  await withFetch(async (input) => {
    const url = String(input);
    if (url.endsWith("/models")) {
      return jsonResponse({ data: [{ id: "nous-free", pricing: { prompt: 0, completion: 0 }, architecture: { output_modalities: ["text"] } }] });
    }
    assert.ok(url.endsWith("/chat/completions"));
    return jsonResponse({ choices: [{ message: { content: JSON.stringify({
      summary: "Verified evidence remains under human review.",
      reviewBoundary: "Relationships and legal status require human review.",
      evidenceReferenceIds: ["ref-skip_trace_parse"],
    }) } }] });
  }, async () => {
    const result = await callStage("backstory_generate", stageInput("backstory_generate"), environment({ NOUS_API_KEY: "configured-test-key" }));
    assert.equal(result.body.status, "succeeded");
    assert.deepEqual((result.body.evidenceReferences as Array<Record<string, unknown>>).map((item) => item.id), ["ref-skip_trace_parse"]);
  });
});

test("the Cloudflare boundary normalizes real fact arrays and rejects unbounded evidence", () => {
  const fact = {
    source: "idi",
    rawId: "idi-record-1",
    fetchedAt: FETCHED_AT,
    factType: "potential_heir",
    value: { name: "Jordan Fox" },
    confidence: 0.88,
    reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
  };
  const evidenceReference = { ...evidence("skip_trace_parse", "record-1"), value: { name: "Jordan Fox" } };
  const normalized = normalizeDocPrepStageResponse({ ok: true, stageId: "skip_trace_parse", status: "succeeded", detail: "facts", evidenceReferences: [evidenceReference], facts: [fact] });
  assert.deepEqual(normalized.facts, { records: [fact] });
  assert.deepEqual(normalized.evidenceReferences, [evidenceReference]);
  assert.throws(() => normalizeDocPrepStageResponse({ ok: true, stageId: "skip_trace_parse", status: "succeeded", detail: "facts", evidenceReferences: [{ ...evidenceReference, value: "x".repeat(4_001) }], facts: [fact] }));
});

test("the internal failure reporter accepts the existing source token and deduplicates through Linear", { concurrency: false }, async () => {
  let linearCalls = 0;
  await withFetch(async () => {
    linearCalls += 1;
    return jsonResponse({ data: { issueCreate: { success: true, issue: { id: "issue-transport-1", identifier: "HR-TRANSPORT-1", url: "https://linear.example/HR-TRANSPORT-1" } } } });
  }, async () => {
    const env = environment({
      HEIRRIGHT_API_TOKEN: "different-api-token",
      HEIRRIGHT_DOC_PREP_SOURCE_TOKEN: "source-token",
      HEIRRIGHT_LINEAR_API_KEY: "linear-secret-value",
      HEIRRIGHT_LINEAR_TEAM_ID: "team-1",
      PACKET_ARTIFACTS: new MemoryKv(),
      DEPLOYMENT_KEY: "reporter-route-test",
    });
    const request = () => worker.fetch(new Request("https://worker.example/api/doc-prep/system-failure", {
      method: "POST",
      headers: { authorization: "Bearer source-token", "content-type": "application/json" },
      body: JSON.stringify({ stageId: "packet-render", code: "packet_renderer_transport_failed", provider: "source", deploymentKey: "docprep-worker" }),
    }), env as never);
    const first = await request();
    const second = await request();
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(linearCalls, 1);
    const unauthorized = await worker.fetch(new Request("https://worker.example/api/doc-prep/system-failure", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ stageId: "packet-render", code: "packet_renderer_transport_failed", provider: "source", deploymentKey: "docprep-worker" }) }), env as never);
    assert.equal(unauthorized.status, 401);
  });
});

test("strict input preserves IDI source facts and leaves unknown fields blank", { concurrency: false }, async () => {
  const kv = new MemoryKv();
  kv.values.set(`idi-import:${createHash("sha256").update("estate-doc-prep-1").digest("hex")}`, JSON.stringify(persistedIdiRecord()));
  const result = await callStage("skip_trace_parse", stageInput("skip_trace_parse"), environment({ PACKET_ARTIFACTS: kv }));
  const facts = (result.body.facts as { records: Array<Record<string, unknown>> }).records;
  const value = facts[0].value as Record<string, unknown>;
  assert.equal(value.age, "");
  assert.equal(value.interest, "");
  assert.equal(value.currentAddress, "");
  assert.deepEqual(value.emails, []);
  const references = result.body.evidenceReferences as Array<Record<string, unknown>>;
  assert.equal(references[0].sourceUrl, "/api/discovery/idi-asset-search/import?assetKey=estate-doc-prep-1");
  assert.deepEqual(references[0].sourceLocator, { kind: "page", index: 2, label: "Possible relative" });

  let externalCalls = 0;
  await withFetch(async () => { externalCalls += 1; return jsonResponse({}); }, async () => {
    const invalid = stageInput("skip_trace_parse") as Record<string, unknown>;
    invalid.unexpected = true;
    const rejected = await callStage("skip_trace_parse", invalid, environment({ PACKET_ARTIFACTS: kv, HEIRRIGHT_LINEAR_API_KEY: "linear-secret", HEIRRIGHT_LINEAR_TEAM_ID: "team-1" }));
    assert.equal(rejected.response.status, 400);
    assert.equal(rejected.body.error, "invalid_doc_prep_stage_input");
    assert.equal(externalCalls, 0);
  });
});

test("stage routes deny unauthenticated requests", async () => {
  const response = await worker.fetch(new Request("https://worker.example/api/doc-prep/stages/skip_trace_parse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(stageInput("skip_trace_parse")),
  }), environment() as never);
  assert.equal(response.status, 401);
  assert.equal((await response.json() as Record<string, unknown>).error, "auth_required");
});

test("missing or stale selected IDI files remain review-required and never file Linear issues", { concurrency: false }, async () => {
  const kv = new MemoryKv();
  kv.values.set(`idi-import:${createHash("sha256").update("estate-doc-prep-1").digest("hex")}`, JSON.stringify(persistedIdiRecord()));
  let linearCalls = 0;
  await withFetch(async () => { linearCalls += 1; return jsonResponse({}); }, async () => {
    const missing = stageInput("skip_trace_parse") as Record<string, unknown>;
    missing.estate = { ...(missing.estate as Record<string, unknown>), sourceFileReferences: [] };
    const missingResult = await callStage("skip_trace_parse", missing, environment({ PACKET_ARTIFACTS: kv, HEIRRIGHT_LINEAR_API_KEY: "linear-secret", HEIRRIGHT_LINEAR_TEAM_ID: "team-1" }));
    assert.equal(missingResult.body.status, "review_required");

    const stale = stageInput("skip_trace_parse") as Record<string, unknown>;
    stale.estate = { ...(stale.estate as Record<string, unknown>), sourceFileReferences: ["old-report.pdf"] };
    const staleResult = await callStage("skip_trace_parse", stale, environment({ PACKET_ARTIFACTS: kv, HEIRRIGHT_LINEAR_API_KEY: "linear-secret", HEIRRIGHT_LINEAR_TEAM_ID: "team-1" }));
    assert.equal(staleResult.body.status, "review_required");

    const cancelled = { ...stageInput("skip_trace_parse"), cancelled: true };
    const cancelledResult = await callStage("skip_trace_parse", cancelled, environment({ PACKET_ARTIFACTS: kv, HEIRRIGHT_LINEAR_API_KEY: "linear-secret", HEIRRIGHT_LINEAR_TEAM_ID: "team-1" }));
    assert.equal(cancelledResult.response.status, 400);
    assert.equal(linearCalls, 0);
  });
});

test("unsafe Tax Collector attachments stop at review without filing a Linear issue", { concurrency: false }, async () => {
  let calls = 0;
  await withFetch(async (input) => {
    calls += 1;
    if (String(input).endsWith("/account/unsafe")) {
      return new Response('<html><a class="receipt pull-right" href="/receipt/unsafe">Print property tax receipt</a></html>', {
        headers: { "content-type": "text/html" },
      });
    }
    return new Response("unsafe attachment", { headers: { "content-type": "application/octet-stream" } });
  }, async () => {
    const result = await callStage("tax_receipt_fetch", stageInput("tax_receipt_fetch"), environment({
      TAX_COLLECTOR_LISTING_URL: "https://county-taxes.net/account/unsafe",
      HEIRRIGHT_LINEAR_API_KEY: "linear-secret-value",
      HEIRRIGHT_LINEAR_TEAM_ID: "team-1",
    }));
    assert.equal(result.body.status, "review_required");
    assert.equal(calls, 2);
  });
});

test("Nous fails closed on paid catalogs, unverified configured models, and malformed strict JSON", { concurrency: false }, async () => {
  const missingCredential = await callStage("backstory_generate", stageInput("backstory_generate"), environment({ DEPLOYMENT_KEY: "nous-missing-credential" }));
  assert.equal(missingCredential.body.status, "blocked");
  assert.ok(((missingCredential.body.facts as { records: Array<Record<string, unknown>> }).records).some((fact) => (fact.value as Record<string, unknown>).code === "nous_credential_missing"));

  resetServerNousCredentialCache();
  await withFetch(async (input) => {
    if (String(input).endsWith("/models")) return jsonResponse({ data: [{ id: "paid-model", pricing: { prompt: 1, completion: 1 } }] });
    throw new Error("chat should not run");
  }, async () => {
    const result = await callStage("backstory_generate", stageInput("backstory_generate"), environment({ NOUS_API_KEY: "configured-test-key", DEPLOYMENT_KEY: "nous-paid-catalog" }));
    assert.equal(result.body.status, "failed");
    assert.ok(((result.body.facts as { records: Array<Record<string, unknown>> }).records).some((fact) => (fact.value as Record<string, unknown>).code === "nous_catalog_unavailable"));
  });

  resetServerNousCredentialCache();
  await withFetch(async (input) => {
    if (String(input).endsWith("/models")) return jsonResponse({ data: [{ id: "nous-free", pricing: { prompt: 0, completion: 0 } }] });
    throw new Error("chat should not run");
  }, async () => {
    const result = await callStage("backstory_generate", stageInput("backstory_generate"), environment({ NOUS_API_KEY: "configured-test-key", NOUS_MODEL: "paid-model", DEPLOYMENT_KEY: "nous-unverified-model" }));
    assert.equal(result.body.status, "failed");
    assert.ok(((result.body.facts as { records: Array<Record<string, unknown>> }).records).some((fact) => (fact.value as Record<string, unknown>).code === "nous_model_not_verified_free"));
  });

  resetServerNousCredentialCache();
  await withFetch(async (input) => {
    if (String(input).endsWith("/models")) return jsonResponse({ data: [{ id: "nous-free", pricing: { prompt: 0, completion: 0 } }] });
    return jsonResponse({ choices: [{ message: { content: "not-json" } }] });
  }, async () => {
    const result = await callStage("backstory_generate", stageInput("backstory_generate"), environment({ NOUS_API_KEY: "configured-test-key", DEPLOYMENT_KEY: "nous-malformed-json" }));
    assert.equal(result.body.status, "failed");
    assert.ok(((result.body.facts as { records: Array<Record<string, unknown>> }).records).some((fact) => (fact.value as Record<string, unknown>).code === "nous_strict_json_failed"));
  });

  resetServerNousCredentialCache();
  await withFetch(async (input) => {
    if (String(input).endsWith("/models")) return jsonResponse({ data: [{ id: "nous-free", pricing: { prompt: 0, completion: 0 } }] });
    return jsonResponse({ choices: [{ message: { content: JSON.stringify({
      summary: "Alex Morgan is the heir.",
      reviewBoundary: "Legal status requires human review.",
      evidenceReferenceIds: ["ref-skip_trace_parse"],
    }) } }] });
  }, async () => {
    const result = await callStage("backstory_generate", stageInput("backstory_generate"), environment({ NOUS_API_KEY: "configured-test-key", DEPLOYMENT_KEY: "nous-inferred-value" }));
    assert.equal(result.body.status, "failed");
    assert.ok(((result.body.facts as { records: Array<Record<string, unknown>> }).records).some((fact) => (fact.value as Record<string, unknown>).code === "nous_grounding_validation_failed"));
  });
});

test("Linear failure reports are sanitized, deduplicated, and preserve fallback errors", { concurrency: false }, async () => {
  const kv = new MemoryKv();
  const requestBodies: string[] = [];
  await withFetch(async (_input, init) => {
    requestBodies.push(String(init?.body || ""));
    return jsonResponse({ data: { issueCreate: { success: true, issue: { id: "issue-1", identifier: "HR-1", url: "https://linear.example/HR-1" } } } });
  }, async () => {
    const env = environment({
      PACKET_ARTIFACTS: kv,
      DEPLOYMENT_KEY: "linear-dedupe-case",
      HEIRRIGHT_LINEAR_API_KEY: "linear-secret-value",
      HEIRRIGHT_LINEAR_TEAM_ID: "team-1",
    });
    const first = await callStage("deed_title_search", stageInput("deed_title_search"), env);
    const second = await callStage("deed_title_search", stageInput("deed_title_search"), env);
    assert.equal(first.body.status, "blocked");
    assert.equal(second.body.status, "blocked");
    assert.equal(requestBodies.length, 1);
  });
  const serialized = requestBodies.join("\n");
  for (const forbidden of ["Casey Fox", "8 Bay St", "operator@heirright.com", "linear-secret-value", "configured-test-key", "idi-report-1"]) {
    assert.equal(serialized.includes(forbidden), false, `Linear payload leaked ${forbidden}`);
  }
  assert.match(serialized, /deed_title_search_credential_missing/);

  await withFetch(async () => jsonResponse({ errors: [{ message: "unavailable" }] }, 503), async () => {
    const result = await callStage("deed_title_search", stageInput("deed_title_search"), environment({
      DEPLOYMENT_KEY: "linear-fallback-case",
      HEIRRIGHT_LINEAR_API_KEY: "linear-secret-value",
      HEIRRIGHT_LINEAR_TEAM_ID: "team-1",
    }));
    const codes = ((result.body.facts as { records: Array<Record<string, unknown>> }).records).map((fact) => (fact.value as Record<string, unknown>).code).filter(Boolean);
    assert.ok(codes.includes("deed_title_search_credential_missing"));
    assert.ok(codes.includes("linear_log_failed"));
  });
});

test("the stage execution seam contains no Promise.all concurrency", async () => {
  const source = await readFile(join(__dirname, "../src/adapters/doc-prep-stages.ts"), "utf8");
  assert.equal(source.includes("Promise.all("), false);
});
