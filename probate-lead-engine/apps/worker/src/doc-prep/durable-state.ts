export type DocPrepJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type DocPrepFlow = "discovery" | "closing-docs";

type DurableStorageTransaction = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};

export type DocPrepDurableStorage = DurableStorageTransaction & {
  transaction?<T>(closure: (transaction: DurableStorageTransaction) => Promise<T>): Promise<T>;
};

export interface DocPrepJobEvent {
  id: number;
  type: "job.created" | "job.transitioned";
  caseId: string;
  jobId: string;
  from: DocPrepJobStatus | null;
  to: DocPrepJobStatus;
  occurredAt: string;
}

export interface DocPrepJobRecord {
  schema: "heirright.doc-prep.job/v1";
  jobId: string;
  caseId: string;
  flow: DocPrepFlow;
  status: DocPrepJobStatus;
  createdAt: string;
  updatedAt: string;
  events: DocPrepJobEvent[];
}

export interface DocPrepCaseRecord {
  schema: "heirright.doc-prep.case/v1";
  caseId: string;
  createdAt: string;
  updatedAt: string;
  jobIds: string[];
}

const CASE_ID = /^case_[0-9a-f]{32}$/;
const JOB_ID = /^job_[0-9a-f]{32}$/;
const transitions: Record<DocPrepJobStatus, readonly DocPrepJobStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...init.headers,
    },
  });
}

function methodNotAllowed(allow: string): Response {
  return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow } });
}

function durableId(prefix: "case" | "job"): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function caseKey(caseId: string): string {
  return `doc-prep:case:${caseId}`;
}

function jobKey(jobId: string): string {
  return `doc-prep:job:${jobId}`;
}

function validStatus(value: unknown): value is DocPrepJobStatus {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(transitions, value);
}

async function requestBody(request: Request): Promise<Record<string, unknown> | null> {
  const value = await request.json().catch(() => null);
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function storageUnavailable(): Response {
  return json({
    ok: false,
    error: "doc_prep_durable_storage_unavailable",
    message: "Atomic Doc Prep sandbox storage is unavailable.",
  }, { status: 503 });
}

function serverError(): Response {
  return json({
    ok: false,
    error: "doc_prep_durable_readback_failed",
    message: "Doc Prep sandbox state did not pass atomic storage readback.",
  }, { status: 503 });
}

function sse(events: DocPrepJobEvent[]): Response {
  const body = events.map((event) => [
    `id: ${event.id}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    "",
  ].join("\n")).join("\n");
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

export function isDocPrepDurablePath(pathname: string): boolean {
  return pathname === "/api/doc-prep/cases"
    || pathname.startsWith("/api/doc-prep/cases/")
    || pathname.startsWith("/api/doc-prep/jobs/");
}

export class DocPrepDurableState {
  constructor(private readonly storage: DocPrepDurableStorage) {}

  private async createCase(): Promise<Response> {
    if (!this.storage.transaction) return storageUnavailable();
    const caseId = durableId("case");
    const timestamp = new Date().toISOString();
    const record: DocPrepCaseRecord = {
      schema: "heirright.doc-prep.case/v1",
      caseId,
      createdAt: timestamp,
      updatedAt: timestamp,
      jobIds: [],
    };
    try {
      return await this.storage.transaction(async (storage) => {
        if (await storage.get(caseKey(caseId))) {
          return json({ ok: false, error: "doc_prep_case_id_conflict" }, { status: 409 });
        }
        await storage.put(caseKey(caseId), record);
        const readback = await storage.get<DocPrepCaseRecord>(caseKey(caseId));
        if (readback?.caseId !== caseId || readback.schema !== record.schema) throw new Error("case_readback_failed");
        return json({ ok: true, case: readback, readbackStatus: "verified" }, { status: 201 });
      });
    } catch {
      return serverError();
    }
  }

  private async hydrateCase(caseId: string): Promise<Response> {
    const record = await this.storage.get<DocPrepCaseRecord>(caseKey(caseId));
    if (!record) return json({ ok: false, error: "doc_prep_case_not_found" }, { status: 404 });
    const jobs = await Promise.all(record.jobIds.map((jobId) => this.storage.get<DocPrepJobRecord>(jobKey(jobId))));
    if (jobs.some((job) => !job)) return serverError();
    return json({ ok: true, case: record, jobs, readbackStatus: "verified" });
  }

  private async createJob(caseId: string, request: Request): Promise<Response> {
    if (!this.storage.transaction) return storageUnavailable();
    const body = await requestBody(request);
    const flow = body?.flow;
    if (flow !== "discovery" && flow !== "closing-docs") {
      return json({ ok: false, error: "doc_prep_flow_invalid", message: "Choose discovery or closing-docs." }, { status: 400 });
    }
    const jobId = durableId("job");
    const timestamp = new Date().toISOString();
    const event: DocPrepJobEvent = {
      id: 1,
      type: "job.created",
      caseId,
      jobId,
      from: null,
      to: "queued",
      occurredAt: timestamp,
    };
    const job: DocPrepJobRecord = {
      schema: "heirright.doc-prep.job/v1",
      jobId,
      caseId,
      flow,
      status: "queued",
      createdAt: timestamp,
      updatedAt: timestamp,
      events: [event],
    };
    try {
      return await this.storage.transaction(async (storage) => {
        const currentCase = await storage.get<DocPrepCaseRecord>(caseKey(caseId));
        if (!currentCase) return json({ ok: false, error: "doc_prep_case_not_found" }, { status: 404 });
        if (await storage.get(jobKey(jobId))) return json({ ok: false, error: "doc_prep_job_id_conflict" }, { status: 409 });
        const nextCase = { ...currentCase, updatedAt: timestamp, jobIds: [...currentCase.jobIds, jobId] };
        await storage.put(jobKey(jobId), job);
        await storage.put(caseKey(caseId), nextCase);
        const jobReadback = await storage.get<DocPrepJobRecord>(jobKey(jobId));
        const caseReadback = await storage.get<DocPrepCaseRecord>(caseKey(caseId));
        if (jobReadback?.jobId !== jobId || !caseReadback?.jobIds.includes(jobId)) throw new Error("job_readback_failed");
        return json({ ok: true, job: jobReadback, readbackStatus: "verified" }, { status: 201 });
      });
    } catch {
      return serverError();
    }
  }

  private async hydrateJob(jobId: string): Promise<Response> {
    const job = await this.storage.get<DocPrepJobRecord>(jobKey(jobId));
    if (!job) return json({ ok: false, error: "doc_prep_job_not_found" }, { status: 404 });
    return json({ ok: true, job, readbackStatus: "verified" });
  }

  private async transitionJob(jobId: string, request: Request): Promise<Response> {
    if (!this.storage.transaction) return storageUnavailable();
    const body = await requestBody(request);
    const status = body?.status;
    if (!validStatus(status)) return json({ ok: false, error: "doc_prep_status_invalid" }, { status: 400 });
    try {
      return await this.storage.transaction(async (storage) => {
        const current = await storage.get<DocPrepJobRecord>(jobKey(jobId));
        if (!current) return json({ ok: false, error: "doc_prep_job_not_found" }, { status: 404 });
        if (current.status === status) {
          return json({ ok: true, job: current, idempotent: true, readbackStatus: "verified" });
        }
        if (!transitions[current.status].includes(status)) {
          return json({
            ok: false,
            error: "doc_prep_transition_invalid",
            currentStatus: current.status,
            requestedStatus: status,
          }, { status: 409 });
        }
        const currentCase = await storage.get<DocPrepCaseRecord>(caseKey(current.caseId));
        if (!currentCase) throw new Error("job_case_missing");
        const timestamp = new Date().toISOString();
        const event: DocPrepJobEvent = {
          id: current.events.length + 1,
          type: "job.transitioned",
          caseId: current.caseId,
          jobId,
          from: current.status,
          to: status,
          occurredAt: timestamp,
        };
        const next: DocPrepJobRecord = {
          ...current,
          status,
          updatedAt: timestamp,
          events: [...current.events, event],
        };
        await storage.put(jobKey(jobId), next);
        await storage.put(caseKey(current.caseId), { ...currentCase, updatedAt: timestamp });
        const readback = await storage.get<DocPrepJobRecord>(jobKey(jobId));
        if (readback?.status !== status || readback.events.at(-1)?.id !== event.id) throw new Error("transition_readback_failed");
        return json({ ok: true, job: readback, event, readbackStatus: "verified" });
      });
    } catch {
      return serverError();
    }
  }

  private async replayEvents(jobId: string, request: Request): Promise<Response> {
    const job = await this.storage.get<DocPrepJobRecord>(jobKey(jobId));
    if (!job) return json({ ok: false, error: "doc_prep_job_not_found" }, { status: 404 });
    const header = request.headers.get("last-event-id");
    if (header !== null && !/^(0|[1-9][0-9]*)$/.test(header)) {
      return json({ ok: false, error: "last_event_id_invalid" }, { status: 400 });
    }
    const lastEventId = header === null ? 0 : Number(header);
    if (!Number.isSafeInteger(lastEventId)) return json({ ok: false, error: "last_event_id_invalid" }, { status: 400 });
    const latestEventId = job.events.at(-1)?.id ?? 0;
    if (lastEventId > latestEventId) {
      return json({ ok: false, error: "last_event_id_ahead", latestEventId }, { status: 409 });
    }
    return sse(job.events.filter((event) => event.id > lastEventId));
  }

  async fetch(request: Request): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/doc-prep/cases") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      return this.createCase();
    }
    const caseJobs = pathname.match(/^\/api\/doc-prep\/cases\/(case_[0-9a-f]{32})\/jobs$/);
    if (caseJobs) {
      if (request.method !== "POST") return methodNotAllowed("POST");
      return this.createJob(caseJobs[1], request);
    }
    const caseHydration = pathname.match(/^\/api\/doc-prep\/cases\/(case_[0-9a-f]{32})$/);
    if (caseHydration) {
      if (request.method !== "GET") return methodNotAllowed("GET");
      return this.hydrateCase(caseHydration[1]);
    }
    const jobRoute = pathname.match(/^\/api\/doc-prep\/jobs\/(job_[0-9a-f]{32})(?:\/(transitions|events))?$/);
    if (jobRoute) {
      const [, jobId, action] = jobRoute;
      if (!action) {
        if (request.method !== "GET") return methodNotAllowed("GET");
        return this.hydrateJob(jobId);
      }
      if (action === "transitions") {
        if (request.method !== "POST") return methodNotAllowed("POST");
        return this.transitionJob(jobId, request);
      }
      if (request.method !== "GET") return methodNotAllowed("GET");
      return this.replayEvents(jobId, request);
    }
    if (pathname.includes("/case_") && !CASE_ID.test(pathname.split("/").at(-1) || "")) {
      return json({ ok: false, error: "doc_prep_case_id_invalid" }, { status: 400 });
    }
    if (pathname.includes("/job_") && !JOB_ID.test(pathname.split("/")[4] || "")) {
      return json({ ok: false, error: "doc_prep_job_id_invalid" }, { status: 400 });
    }
    return json({ ok: false, error: "not_found" }, { status: 404 });
  }
}
