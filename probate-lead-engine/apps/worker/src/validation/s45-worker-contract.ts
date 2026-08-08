import { strict as assert } from "node:assert";
import worker from "../s45-discovery-worker";

type Job = { id: string; case_id: string; idempotency_key: string; status: string; source_version_id: string; artifact_id: string | null; error_code: string | null; created_at: string; updated_at: string };
type Artifact = { object_key: string; sha256: string; mime_type: string; byte_count: number };
type Event = { id: number; job_id: string; status: string; detail_json: string; created_at: string };
type Statement = { bind: (...values: unknown[]) => Statement; first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };

function createDatabase() {
  const jobs = new Map<string, Job>();
  const sources = new Map<string, Record<string, unknown>>();
  const artifacts = new Map<string, Artifact>();
  const events: Event[] = [];
  let nextEventId = 1;

  const execute = async (sql: string, values: unknown[]): Promise<void> => {
    if (sql.startsWith("CREATE TABLE") || sql.startsWith("INSERT INTO s45_cases")) return;
    if (sql.startsWith("INSERT INTO s45_source_versions")) {
      const [id, caseId, objectKey, sha256, byteCount, createdAt] = values.map(String);
      sources.set(id, { id, case_id: caseId, object_key: objectKey, sha256, byte_count: Number(byteCount), created_at: createdAt });
      return;
    }
    if (sql.startsWith("INSERT INTO s45_jobs")) {
      const [id, caseId, idempotencyKey, status, sourceVersionId, createdAt, updatedAt] = values.map(String);
      jobs.set(id, { id, case_id: caseId, idempotency_key: idempotencyKey, status, source_version_id: sourceVersionId, artifact_id: null, error_code: null, created_at: createdAt, updated_at: updatedAt });
      return;
    }
    if (sql.startsWith("INSERT INTO s45_events")) {
      const [jobId, status, detailJson, createdAt] = values.map(String);
      events.push({ id: nextEventId++, job_id: jobId, status, detail_json: detailJson, created_at: createdAt });
      return;
    }
    if (sql.startsWith("UPDATE s45_jobs SET status")) {
      const [status, updatedAt, jobId] = values.map(String);
      const job = jobs.get(jobId);
      if (job) Object.assign(job, { status, updated_at: updatedAt });
      return;
    }
    if (sql.startsWith("UPDATE s45_jobs SET artifact_id")) {
      const [artifactId, jobId] = values.map(String);
      const job = jobs.get(jobId);
      if (job) job.artifact_id = artifactId;
      return;
    }
    if (sql.startsWith("UPDATE s45_jobs SET error_code")) {
      const [errorCode, updatedAt, jobId] = values.map(String);
      const job = jobs.get(jobId);
      if (job) Object.assign(job, { error_code: errorCode, updated_at: updatedAt });
    }
  };

  const first = async <T>(sql: string, values: unknown[]): Promise<T | null> => {
    const key = String(values[0] || "");
    if (sql.includes("FROM s45_jobs WHERE idempotency_key")) {
      const job = [...jobs.values()].find((candidate) => candidate.idempotency_key === key);
      return (job ? { id: job.id, status: job.status } : null) as T | null;
    }
    if (sql.includes("FROM s45_jobs WHERE id=?")) return (jobs.get(key) || null) as T | null;
    if (sql.includes("FROM s45_source_versions WHERE id=?")) return (sources.get(key) || null) as T | null;
    if (sql.includes("FROM s45_artifacts WHERE job_id=?")) return (artifacts.get(key) || null) as T | null;
    return null;
  };

  const database = {
    prepare(sql: string): Statement {
      let values: unknown[] = [];
      const statement: Statement = {
        bind: (...next) => { values = next; return statement; },
        first: <T>() => first<T>(sql, values),
        all: async <T>() => {
          if (!sql.includes("FROM s45_events WHERE job_id=?")) return { results: [] as T[] };
          const jobId = String(values[0] || "");
          const last = Number(values[1] || 0);
          return { results: events.filter((event) => event.job_id === jobId && event.id > last).map((event) => ({ ...event })) as T[] };
        },
        run: () => execute(sql, values),
      };
      return statement;
    },
    async batch(items: Statement[]): Promise<unknown> {
      for (const item of items) await item.run();
      return {};
    },
  };

  return { database, jobs, artifacts };
}

function createBucket() {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    objects,
    bucket: {
      async put(key: string, bytes: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<void> {
        objects.set(key, { bytes: new Uint8Array(bytes), contentType: options?.httpMetadata?.contentType || "" });
      },
      async get(key: string): Promise<{ arrayBuffer: () => Promise<ArrayBuffer>; body: ReadableStream; httpMetadata: { contentType: string } } | null> {
        const object = objects.get(key);
        if (!object) return null;
        const bytes = new Uint8Array(object.bytes);
        return {
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          body: new Blob([bytes]).stream(),
          httpMetadata: { contentType: object.contentType },
        };
      },
    },
  };
}

function request(url: string, init: RequestInit = {}): Request {
  return new Request(url, { ...init, headers: { authorization: "Bearer test-token", ...(init.headers || {}) } });
}

async function main(): Promise<void> {
  const state = createDatabase();
  const r2 = createBucket();
  const queue: { sent: unknown[]; send: (value: unknown) => Promise<void> } = { sent: [], async send(value) { this.sent.push(value); } };
  const env = { S45_DB: state.database, S45_ARTIFACTS: r2.bucket, S45_DISCOVERY_QUEUE: queue, S45_INTERNAL_API_TOKEN: "test-token", S45_SANDBOX_LABEL: "s45-sandbox" };
  const sourcePdfBase64 = Buffer.from("%PDF-1.4\n").toString("base64");

  const malformed = await worker.fetch(request("https://s45.test/s45/discovery/runs", { method: "POST", body: JSON.stringify({ idempotencyKey: "short", sourcePdfBase64 }) }), env as never);
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json() as { error: string }).error, "malformed_input");

  const body = JSON.stringify({ idempotencyKey: "s45-worker-contract-0001", sourcePdfBase64, sourceName: "controlled.pdf" });
  const start = await worker.fetch(request("https://s45.test/s45/discovery/runs", { method: "POST", body }), env as never);
  assert.equal(start.status, 202);
  const created = await start.json() as { jobId: string; status: string };
  assert.equal(created.status, "queued");
  assert.equal(queue.sent.length, 1);

  const duplicate = await worker.fetch(request("https://s45.test/s45/discovery/runs", { method: "POST", body }), env as never);
  assert.equal(duplicate.status, 200);
  assert.equal((await duplicate.json() as { duplicate: boolean }).duplicate, true);
  assert.equal(queue.sent.length, 1);

  const hydrated = await worker.fetch(request("https://s45.test/s45/discovery/runs/" + created.jobId), env as never);
  assert.equal(hydrated.status, 200);
  assert.equal(((await hydrated.json() as { job: { status: string } }).job.status), "queued");

  const events = await worker.fetch(request("https://s45.test/s45/discovery/runs/" + created.jobId + "/events"), env as never);
  assert.match(await events.text(), /id: 1\nevent: status\ndata:/);

  const retry = await worker.fetch(request("https://s45.test/s45/discovery/runs/" + created.jobId + "/retry", { method: "POST" }), env as never);
  assert.equal(retry.status, 202);
  assert.equal(queue.sent.length, 2);

  const replay = await worker.fetch(request("https://s45.test/s45/discovery/runs/" + created.jobId + "/events", { headers: { "Last-Event-ID": "1" } }), env as never);
  const replayText = await replay.text();
  assert.match(replayText, /id: 2\nevent: status\ndata:/);
  assert.doesNotMatch(replayText, /id: 1\n/);

  const artifactKey = "s45-sandbox/artifacts/" + created.jobId + ".pdf";
  await r2.bucket.put(artifactKey, new TextEncoder().encode("%PDF-tampered"), { httpMetadata: { contentType: "application/pdf" } });
  state.artifacts.set(created.jobId, { object_key: artifactKey, mime_type: "application/pdf", byte_count: 999, sha256: "0".repeat(64) });
  const altered = await worker.fetch(request("https://s45.test/s45/discovery/runs/" + created.jobId + "/artifact-check"), env as never);
  assert.equal(altered.status, 409);
  assert.equal((await altered.json() as { error: string }).error, "artifact_altered");

  const unauthorized = await worker.fetch(new Request("https://s45.test/s45/discovery/runs/" + created.jobId), env as never);
  assert.equal(unauthorized.status, 401);
  console.log(JSON.stringify({ ok: true, suite: "s45-worker-contract", checks: ["malformed", "idempotency", "reload", "event-replay", "retry", "artifact-altered", "auth"] }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
