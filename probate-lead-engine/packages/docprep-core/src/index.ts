import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
export * from "./schema.js";

export const CaseState = z.enum(["queued", "sourcing", "review_required", "rendering", "packet_ready", "blocked", "failed", "cancelled"]);
export const StepState = z.enum(["pending", "running", "succeeded", "review_required", "blocked", "failed", "cancelled"]);
export type CaseState = z.infer<typeof CaseState>;
export type StepState = z.infer<typeof StepState>;

export const DOC_PREP_STAGES = [
  { id: "skip_trace_parse", name: "Parsing Skip Trace Report", detail: "Filling out Potential Heirs, Contact information…" },
  { id: "obituary_search", name: "Searching Obituary", detail: "Gathering vital obituary, marriage &amp; related records…" },
  { id: "deed_title_search", name: "Searching for Deeds or Titles", detail: "Checking official records…." },
  { id: "tax_receipt_fetch", name: "Fetching Tax Receipt", detail: "Pulling from public Tax Collector’s Office records…." },
  { id: "court_records_search", name: "Searching Court Records", detail: "Probate, Civil, Family Courts….." },
  { id: "backstory_generate", name: "Generating Back Story", detail: "Using Solvys systems…." },
] as const;
export const DocPrepStageId = z.enum(["skip_trace_parse", "obituary_search", "deed_title_search", "tax_receipt_fetch", "court_records_search", "backstory_generate"]);
export type DocPrepStageId = z.infer<typeof DocPrepStageId>;
export const StageOutcomeStatus = z.enum(["succeeded", "review_required", "blocked", "failed"]);
export type StageOutcomeStatus = z.infer<typeof StageOutcomeStatus>;

const text = (max: number) => z.string().trim().min(1).max(max);
const MAX_EVIDENCE_JSON_DEPTH = 8;
const MAX_EVIDENCE_JSON_KEYS = 64;
const MAX_EVIDENCE_JSON_ITEMS = 128;
const MAX_EVIDENCE_JSON_STRING = 4_000;
const MAX_EVIDENCE_JSON_BYTES = 32_000;

const isBoundedJsonValue = (value: unknown, depth = 0, seen = new WeakSet<object>()): boolean => {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return value.length <= MAX_EVIDENCE_JSON_STRING;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || depth >= MAX_EVIDENCE_JSON_DEPTH || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    const valid = value.length <= MAX_EVIDENCE_JSON_ITEMS && value.every((item) => isBoundedJsonValue(item, depth + 1, seen));
    seen.delete(value);
    return valid;
  }
  const keys = Object.keys(value);
  const valid = keys.length <= MAX_EVIDENCE_JSON_KEYS
    && keys.every((key) => key.length <= 160 && isBoundedJsonValue((value as Record<string, unknown>)[key], depth + 1, seen));
  seen.delete(value);
  return valid;
};

const boundedJsonValue = z.unknown().superRefine((value, context) => {
  if (!isBoundedJsonValue(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Value must be bounded JSON." });
    return;
  }
  try {
    if (JSON.stringify(value).length > MAX_EVIDENCE_JSON_BYTES) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Value exceeds the durable JSON size limit." });
    }
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Value must be serializable JSON." });
  }
});
const boundedJsonRecord = z.custom<Record<string, unknown>>(
  (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value) || !isBoundedJsonValue(value)) return false;
    try { return JSON.stringify(value).length <= MAX_EVIDENCE_JSON_BYTES; } catch { return false; }
  },
  { message: "Value must be a bounded JSON object." },
);
const evidenceReference = z.string().trim().min(1).max(1_000);
export const DocPrepEvidenceReferenceRecord = z.object({
  id: text(300),
  stageId: DocPrepStageId,
  source: text(120),
  rawId: text(500),
  fetchedAt: text(80),
  factType: text(160),
  value: boundedJsonValue,
  sourceUrl: z.string().trim().max(2_000).optional(),
  attachment: boundedJsonRecord.optional(),
  sourceLocator: boundedJsonRecord.optional(),
}).strict();
export const DocPrepEvidenceReference = z.union([evidenceReference, DocPrepEvidenceReferenceRecord]);
export type DocPrepEvidenceReference = z.infer<typeof DocPrepEvidenceReference>;

export const DocPrepStageFact = z.object({
  source: text(120),
  rawId: text(500),
  fetchedAt: text(80),
  factType: text(160),
  value: boundedJsonValue,
  confidence: z.number().finite().min(0).max(1),
  reviewFlags: z.array(text(160)).max(32),
  sourceUrl: z.string().trim().max(2_000).optional(),
  attachment: boundedJsonRecord.optional(),
  evidenceReferenceIds: z.array(evidenceReference).max(256).optional(),
}).strict();
export type DocPrepStageFact = z.infer<typeof DocPrepStageFact>;
const legacyFacts = boundedJsonRecord;
export const DocPrepFacts = z.union([
  z.object({ records: z.array(DocPrepStageFact).max(256) }).strict(),
  legacyFacts,
]);
export type DocPrepFacts = z.infer<typeof DocPrepFacts>;

export const DocPrepStageResponse = z.object({
  ok: z.literal(true),
  stageId: DocPrepStageId,
  status: StageOutcomeStatus,
  detail: z.string().trim().min(1).max(4_000),
  nextAction: z.string().trim().min(1).max(2_000).optional(),
  evidenceReferences: z.array(DocPrepEvidenceReference).max(256),
  facts: DocPrepFacts,
}).strict();
export type DocPrepStageResponse = z.infer<typeof DocPrepStageResponse>;
export type StageOutcome = Omit<DocPrepStageResponse, "ok" | "stageId">;
export type DocPrepPriorStageOutput = { stageId: DocPrepStageId; evidenceReferences: DocPrepEvidenceReference[] };
export const EstateSnapshot = z.object({
  estateId: text(160),
  name: text(300),
  owner: z.string().trim().max(300).optional(),
  address: text(500),
  county: text(120),
  parcelId: z.string().trim().max(160).optional(),
  caseReference: z.string().trim().max(160).optional(),
  sourceFileReferences: z.array(text(500)).max(50).default([]),
  actor: z.object({ email: text(320), name: z.string().trim().max(300).optional() }),
}).strict();
export type EstateSnapshot = z.infer<typeof EstateSnapshot>;

export const IntakeCommand = z.object({ estates: z.array(EstateSnapshot).min(1).max(50) }).strict();
export type IntakeCommand = z.infer<typeof IntakeCommand>;

export type ProcessStep = { id: string; name: string; description?: string; state: StepState; blocker?: string; nextAction?: string; detail?: string; evidenceReferences: DocPrepEvidenceReference[]; facts: DocPrepFacts; startedAt?: string; finishedAt?: string; updatedAt: string };
export type ProcessArtifact = { id: string; caseId: string; objectKey: string; objectVersion?: string; contentType: "application/pdf"; bytes: number; sha256: string; readbackStatus: "pending" | "verified" | "failed"; verifiedAt?: string; url?: string };
export type ProcessEvent = { id: number; caseId: string; type: string; state: CaseState; stageId?: DocPrepStageId; occurredAt: string; detail: string; actorEmail?: string };
export type ProcessCase = { id: string; estate: EstateSnapshot; state: CaseState; revision: number; createdAt: string; updatedAt: string; blocker?: string; nextAction?: string; steps: ProcessStep[]; artifact?: ProcessArtifact; events: ProcessEvent[] };
export type CommandResult = { created: boolean; idempotent: boolean; case: ProcessCase };
export type DriveExport = { caseId: string; estateId: string; name: string; url: string; readbackStatus: "verified"; idempotent: boolean };
export type DriveExportClaim = { status: "claimed" } | { status: "in_progress" } | { status: "completed"; export: DriveExport };

const terminalStates = new Set<CaseState>(["packet_ready", "cancelled"]);
const legalTransitions: Record<CaseState, ReadonlySet<CaseState>> = {
  queued: new Set(["sourcing", "blocked", "cancelled", "failed"]),
  sourcing: new Set(["review_required", "rendering", "blocked", "failed", "cancelled"]),
  review_required: new Set(["sourcing", "rendering", "blocked", "cancelled"]),
  rendering: new Set(["packet_ready", "review_required", "blocked", "failed", "cancelled"]),
  packet_ready: new Set(), blocked: new Set(["sourcing", "cancelled"]), failed: new Set(["sourcing", "cancelled"]), cancelled: new Set(),
};

const stageDefinition = (stageId: string) => DOC_PREP_STAGES.find((stage) => stage.id === stageId);
const docPrepStageIds = DOC_PREP_STAGES.map((stage) => stage.id);
const sourceStage = (step: ProcessStep) => DocPrepStageId.safeParse(step.id).success;
const firstNonSucceededStep = (processCase: ProcessCase) => processCase.steps.find((step) => step.state !== "succeeded");

const stepStatesFor = (target: CaseState): Array<{ id: string; state: StepState }> => {
  if (target === "rendering") return [{ id: "packet-render", state: "running" }];
  if (target === "packet_ready") return [{ id: "packet-render", state: "succeeded" }, { id: "artifact-readback", state: "succeeded" }];
  return [];
};

const applySteps = (processCase: ProcessCase, target: CaseState, blocker?: string, nextAction?: string) => {
  const updates = stepStatesFor(target);
  if (target === "cancelled") {
    processCase.steps.forEach((step) => { if (["pending", "running", "review_required", "blocked", "failed"].includes(step.state)) { step.state = "cancelled"; step.updatedAt = now(); } });
    return;
  }
  if (["review_required", "blocked", "failed"].includes(target)) {
    const active = processCase.steps.find((step) => step.state === "running") || processCase.steps.find((step) => step.state === "pending");
    if (active) updates.push({ id: active.id, state: target as StepState });
  }
  updates.forEach((update) => {
    const step = processCase.steps.find((candidate) => candidate.id === update.id);
    if (!step) return;
    step.state = update.state; step.updatedAt = now();
    step.blocker = ["blocked", "failed", "review_required"].includes(update.state) ? blocker : undefined;
    step.nextAction = ["blocked", "failed", "review_required"].includes(update.state) ? nextAction : undefined;
  });
};

const defaultSteps = (): ProcessStep[] => [
  ...DOC_PREP_STAGES.map((stage) => ({ id: stage.id, name: stage.name, description: stage.detail, state: "pending" as const, evidenceReferences: [], facts: {}, updatedAt: now() })),
  { id: "packet-render", name: "Packet rendering", state: "pending", evidenceReferences: [], facts: {}, updatedAt: now() },
  { id: "artifact-readback", name: "PDF readback", state: "pending", evidenceReferences: [], facts: {}, updatedAt: now() },
];
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
export const requestFingerprint = (command: IntakeCommand) => createHash("sha256").update(JSON.stringify(command.estates.map((estate) => ({ ...estate, sourceFileReferences: [...estate.sourceFileReferences].sort() })))).digest("hex");

export class ProcessConflictError extends Error { constructor(message: string) { super(message); this.name = "ProcessConflictError"; } }
export class ProcessTransitionError extends Error { constructor(message: string) { super(message); this.name = "ProcessTransitionError"; } }

export interface ProcessRepository {
  ready(): Promise<void>;
  intake(command: IntakeCommand, idempotencyKey: string): Promise<CommandResult[]>;
  get(caseId: string): Promise<ProcessCase | null>;
  findByEstate(estateId: string): Promise<ProcessCase | null>;
  events(caseId: string, afterId?: number): Promise<ProcessEvent[]>;
  startStage(caseId: string, expectedRevision: number, stageId: DocPrepStageId, actorEmail?: string): Promise<ProcessCase>;
  finishStage(caseId: string, expectedRevision: number, stageId: DocPrepStageId, outcome: StageOutcome, actorEmail?: string): Promise<ProcessCase>;
  transition(caseId: string, expectedRevision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string): Promise<ProcessCase>;
  retry(caseId: string, expectedRevision: number, actorEmail?: string): Promise<ProcessCase>;
  cancel(caseId: string, expectedRevision: number, actorEmail?: string): Promise<ProcessCase>;
  recordArtifact(caseId: string, expectedRevision: number, artifact: Omit<ProcessArtifact, "id" | "caseId">): Promise<ProcessCase>;
  claimDriveExport(caseId: string, sha256: string): Promise<DriveExportClaim>;
  completeDriveExport(caseId: string, sha256: string, result: DriveExport): Promise<void>;
  releaseDriveExport(caseId: string, sha256: string): Promise<void>;
}

/** In-memory conformance adapter. Production supplies the Postgres adapter in the process API. */
export class InMemoryProcessRepository implements ProcessRepository {
  private readonly cases = new Map<string, ProcessCase>();
  private readonly estateIndex = new Map<string, string>();
  private readonly idempotency = new Map<string, { fingerprint: string; results: CommandResult[] }>();
  private readonly driveExports = new Map<string, { state: "pending" | "completed"; result?: DriveExport }>();
  private eventSequence = 0;

  async ready() {}

  async intake(raw: IntakeCommand, idempotencyKey: string): Promise<CommandResult[]> {
    const command = IntakeCommand.parse(raw);
    if (!/^[A-Za-z0-9._:-]{12,200}$/.test(idempotencyKey)) throw new ProcessConflictError("A valid idempotency key is required.");
    const fingerprint = requestFingerprint(command);
    const prior = this.idempotency.get(idempotencyKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new ProcessConflictError("This idempotency key was already used for different estates.");
      return prior.results.map((result) => ({ ...result, idempotent: true, case: clone(this.requireCase(result.case.id)) }));
    }
    const results = command.estates.map((estate) => {
      const active = this.estateIndex.get(estate.estateId);
      if (active) return { created: false, idempotent: true, case: clone(this.requireCase(active)) };
      const at = now();
      const processCase: ProcessCase = { id: randomUUID(), estate, state: "queued", revision: 1, createdAt: at, updatedAt: at, steps: defaultSteps(), events: [] };
      this.append(processCase, "case_queued", "Estate was added to cloud document preparation.", estate.actor.email);
      this.cases.set(processCase.id, processCase);
      this.estateIndex.set(estate.estateId, processCase.id);
      return { created: true, idempotent: false, case: clone(processCase) };
    });
    this.idempotency.set(idempotencyKey, { fingerprint, results: clone(results) });
    return results;
  }

  async get(caseId: string) { const value = this.cases.get(caseId); return value ? clone(value) : null; }
  async findByEstate(estateId: string) { const id = this.estateIndex.get(estateId); return id ? this.get(id) : null; }
  async events(caseId: string, afterId = 0) { const processCase = this.requireCase(caseId); return clone(processCase.events.filter((event) => event.id > afterId)); }
  async startStage(caseId: string, expectedRevision: number, stageId: DocPrepStageId, actorEmail?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (processCase.state !== "sourcing") throw new ProcessTransitionError("A Doc Prep stage can only start while the case is sourcing.");
    const firstStage = processCase.steps.find((step) => sourceStage(step) && step.state !== "succeeded");
    if (!firstStage || firstStage.id !== stageId) throw new ProcessTransitionError(`Stage ${stageId} is not the first non-succeeded Doc Prep stage.`);
    if (processCase.steps.some((step) => step.state === "running")) throw new ProcessTransitionError("Another Doc Prep stage is already running.");
    const at = now();
    firstStage.state = "running"; firstStage.blocker = undefined; firstStage.nextAction = undefined; firstStage.startedAt = at; firstStage.finishedAt = undefined; firstStage.updatedAt = at;
    processCase.revision += 1; processCase.updatedAt = at; processCase.blocker = undefined; processCase.nextAction = undefined;
    this.append(processCase, "stage_started", stageDefinition(stageId)?.detail || `Stage ${stageId} started.`, actorEmail, stageId);
    return clone(processCase);
  }
  async finishStage(caseId: string, expectedRevision: number, stageId: DocPrepStageId, rawOutcome: StageOutcome, actorEmail?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    const outcome = DocPrepStageResponse.parse({ ok: true, stageId, ...rawOutcome });
    const step = processCase.steps.find((candidate) => candidate.id === stageId);
    if (!step || step.state !== "running") throw new ProcessTransitionError(`Stage ${stageId} is not running.`);
    const at = now();
    step.state = outcome.status; step.detail = outcome.detail; step.evidenceReferences = [...outcome.evidenceReferences]; step.facts = clone(outcome.facts); step.finishedAt = at; step.updatedAt = at;
    step.blocker = outcome.status === "succeeded" ? undefined : outcome.detail; step.nextAction = outcome.status === "succeeded" ? undefined : outcome.nextAction;
    processCase.state = outcome.status === "succeeded" ? "sourcing" : outcome.status;
    processCase.blocker = outcome.status === "succeeded" ? undefined : outcome.detail; processCase.nextAction = outcome.status === "succeeded" ? undefined : outcome.nextAction;
    processCase.revision += 1; processCase.updatedAt = at;
    this.append(processCase, "stage_finished", outcome.detail, actorEmail, stageId);
    return clone(processCase);
  }
  async transition(caseId: string, expectedRevision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (!legalTransitions[processCase.state].has(target)) throw new ProcessTransitionError(`Cannot move ${processCase.state} to ${target}.`);
    if (target === "rendering" && processCase.steps.some((step) => sourceStage(step) && step.state !== "succeeded")) throw new ProcessTransitionError("All six Doc Prep stages must succeed before packet rendering.");
    processCase.state = target; processCase.revision += 1; processCase.updatedAt = now(); processCase.blocker = blocker; processCase.nextAction = nextAction;
    applySteps(processCase, target, blocker, nextAction);
    this.append(processCase, `case_${target}`, detail, actorEmail);
    return clone(processCase);
  }
  async retry(caseId: string, expectedRevision: number, actorEmail?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (!["blocked", "failed", "review_required"].includes(processCase.state)) throw new ProcessTransitionError("Only blocked, failed, or review-required cases may be retried.");
    const restart = firstNonSucceededStep(processCase);
    if (!restart) throw new ProcessTransitionError("Every Doc Prep step has already succeeded.");
    restart.state = "pending"; restart.blocker = undefined; restart.nextAction = undefined; restart.detail = undefined; restart.evidenceReferences = []; restart.facts = {}; restart.startedAt = undefined; restart.finishedAt = undefined; restart.updatedAt = now();
    processCase.state = "sourcing"; processCase.blocker = undefined; processCase.nextAction = undefined; processCase.revision += 1; processCase.updatedAt = now();
    this.append(processCase, "case_retried", "Document preparation was restarted.", actorEmail);
    return clone(processCase);
  }
  async cancel(caseId: string, expectedRevision: number, actorEmail?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (terminalStates.has(processCase.state)) throw new ProcessTransitionError("This completed or stopped case cannot be cancelled.");
    processCase.state = "cancelled"; processCase.revision += 1; processCase.updatedAt = now(); processCase.nextAction = "Review the estate before starting a new document-prep case."; applySteps(processCase, "cancelled");
    this.append(processCase, "case_cancelled", "Document preparation was stopped by the operator.", actorEmail);
    return clone(processCase);
  }
  async recordArtifact(caseId: string, expectedRevision: number, artifact: Omit<ProcessArtifact, "id" | "caseId">) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (processCase.state !== "rendering") throw new ProcessTransitionError("A PDF can only be recorded while the packet is rendering.");
    if (artifact.contentType !== "application/pdf" || artifact.bytes < 1 || !/^[a-f0-9]{64}$/i.test(artifact.sha256) || artifact.readbackStatus !== "verified") throw new ProcessTransitionError("Only a verified PDF with SHA-256 readback may complete a case.");
    processCase.artifact = { ...artifact, id: randomUUID(), caseId }; processCase.state = "packet_ready"; processCase.revision += 1; processCase.updatedAt = now(); applySteps(processCase, "packet_ready");
    this.append(processCase, "packet_verified", "Verified PDF is ready to open.");
    return clone(processCase);
  }
  async claimDriveExport(caseId: string, sha256: string): Promise<DriveExportClaim> {
    const key = `${caseId}:${sha256}`; const existing = this.driveExports.get(key);
    if (!existing) { this.driveExports.set(key, { state: "pending" }); return { status: "claimed" }; }
    if (existing.state === "completed" && existing.result) return { status: "completed", export: { ...clone(existing.result), idempotent: true } };
    return { status: "in_progress" };
  }
  async completeDriveExport(caseId: string, sha256: string, result: DriveExport) { this.driveExports.set(`${caseId}:${sha256}`, { state: "completed", result: clone(result) }); }
  async releaseDriveExport(caseId: string, sha256: string) { const key = `${caseId}:${sha256}`; if (this.driveExports.get(key)?.state === "pending") this.driveExports.delete(key); }
  private append(processCase: ProcessCase, type: string, detail: string, actorEmail?: string, stageId?: DocPrepStageId) { processCase.events.push({ id: ++this.eventSequence, caseId: processCase.id, type, state: processCase.state, stageId, detail, actorEmail, occurredAt: now() }); }
  private requireCase(caseId: string) { const processCase = this.cases.get(caseId); if (!processCase) throw new ProcessConflictError("Document-prep case was not found."); return processCase; }
  private requireRevision(caseId: string, expectedRevision: number) { const processCase = this.requireCase(caseId); if (processCase.revision !== expectedRevision) throw new ProcessConflictError("This case changed in another session. Refresh before trying again."); return processCase; }
}

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;
const toCase = async (db: Queryable, caseId: string): Promise<ProcessCase | null> => {
  const caseResult = await db.query("SELECT c.*, e.snapshot FROM docprep_cases c JOIN docprep_estates e ON e.estate_id = c.estate_id WHERE c.id = $1", [caseId]);
  if (!caseResult.rowCount) return null;
  const row = caseResult.rows[0];
  const [steps, events, artifact] = await Promise.all([
    db.query("SELECT id, name, state, blocker, next_action, detail, evidence_references, facts, started_at, finished_at, updated_at FROM docprep_steps WHERE case_id = $1 ORDER BY position", [caseId]),
    db.query("SELECT id, case_id, event_type, state, stage_id, detail, actor_email, occurred_at FROM docprep_events WHERE case_id = $1 ORDER BY id", [caseId]),
    db.query("SELECT id, case_id, object_key, object_version, content_type, bytes, sha256, readback_status, verified_at, artifact_url FROM docprep_artifacts WHERE case_id = $1 ORDER BY verified_at DESC NULLS LAST LIMIT 1", [caseId]),
  ]);
  const sourceArtifact = artifact.rows[0];
  return {
    id: row.id, estate: EstateSnapshot.parse(row.snapshot), state: CaseState.parse(row.state), revision: row.revision,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), blocker: row.blocker || undefined, nextAction: row.next_action || undefined,
    steps: steps.rows.map((step) => ({ id: step.id, name: step.name, description: stageDefinition(step.id)?.detail, state: StepState.parse(step.state), blocker: step.blocker || undefined, nextAction: step.next_action || undefined, detail: step.detail || undefined, evidenceReferences: DocPrepEvidenceReference.array().max(256).parse(step.evidence_references), facts: DocPrepFacts.parse(step.facts), startedAt: step.started_at?.toISOString(), finishedAt: step.finished_at?.toISOString(), updatedAt: step.updated_at.toISOString() })),
    events: events.rows.map((event) => ({ id: Number(event.id), caseId: event.case_id, type: event.event_type, state: CaseState.parse(event.state), stageId: event.stage_id ? DocPrepStageId.parse(event.stage_id) : undefined, detail: event.detail, actorEmail: event.actor_email || undefined, occurredAt: event.occurred_at.toISOString() })),
    artifact: sourceArtifact ? { id: sourceArtifact.id, caseId: sourceArtifact.case_id, objectKey: sourceArtifact.object_key, objectVersion: sourceArtifact.object_version || undefined, contentType: "application/pdf", bytes: Number(sourceArtifact.bytes), sha256: sourceArtifact.sha256, readbackStatus: sourceArtifact.readback_status, verifiedAt: sourceArtifact.verified_at?.toISOString(), url: sourceArtifact.artifact_url || undefined } : undefined,
  };
};

const applyDbSteps = async (db: Queryable, caseId: string, target: CaseState, blocker?: string, nextAction?: string) => {
  if (target === "cancelled") {
    await db.query("UPDATE docprep_steps SET state = 'cancelled', updated_at = now() WHERE case_id = $1 AND state IN ('pending', 'running', 'review_required', 'blocked', 'failed')", [caseId]);
    return;
  }
  const updates = stepStatesFor(target);
  if (["review_required", "blocked", "failed"].includes(target)) {
    await db.query("UPDATE docprep_steps SET state = $2, blocker = $3, next_action = $4, updated_at = now() WHERE case_id = $1 AND id = COALESCE((SELECT id FROM docprep_steps WHERE case_id = $1 AND state = 'running' ORDER BY position LIMIT 1), (SELECT id FROM docprep_steps WHERE case_id = $1 AND state = 'pending' ORDER BY position LIMIT 1))", [caseId, target, blocker || null, nextAction || null]);
  }
  for (const update of updates) {
    await db.query("UPDATE docprep_steps SET state = $3, blocker = $4, next_action = $5, updated_at = now() WHERE case_id = $1 AND id = $2", [caseId, update.id, update.state, ["blocked", "failed", "review_required"].includes(update.state) ? blocker || null : null, ["blocked", "failed", "review_required"].includes(update.state) ? nextAction || null : null]);
  }
};

/** PostgreSQL adapter. Every mutation is transactional and guards the optimistic revision. */
export class PostgresProcessRepository implements ProcessRepository {
  constructor(private readonly pool: Pool) {}
  async ready() { await this.pool.query("SELECT 1"); }
  async intake(raw: IntakeCommand, idempotencyKey: string): Promise<CommandResult[]> {
    const command = IntakeCommand.parse(raw); const fingerprint = requestFingerprint(command);
    if (!/^[A-Za-z0-9._:-]{12,200}$/.test(idempotencyKey)) throw new ProcessConflictError("A valid idempotency key is required.");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const previous = await client.query("SELECT fingerprint, response FROM docprep_idempotency_keys WHERE idempotency_key = $1 FOR UPDATE", [idempotencyKey]);
      if (previous.rowCount) {
        if (previous.rows[0].fingerprint !== fingerprint) throw new ProcessConflictError("This idempotency key was already used for different estates.");
        const stored = previous.rows[0].response as CommandResult[];
        const hydrated: CommandResult[] = [];
        for (const value of stored) {
          const processCase = await toCase(client, value.case.id);
          if (!processCase) throw new ProcessConflictError("Document-prep case was not found.");
          hydrated.push({ ...value, idempotent: true, case: processCase });
        }
        await client.query("COMMIT");
        return hydrated;
      }
      const intakeRows: Array<{ id: string; created: boolean }> = [];
      for (const estate of command.estates) {
        await client.query("INSERT INTO docprep_estates (estate_id, snapshot) VALUES ($1, $2::jsonb) ON CONFLICT (estate_id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()", [estate.estateId, JSON.stringify(estate)]);
        const active = await client.query("SELECT id FROM docprep_cases WHERE estate_id = $1 AND state NOT IN ('packet_ready','blocked','failed','cancelled') FOR UPDATE", [estate.estateId]);
        if (active.rowCount) { intakeRows.push({ id: active.rows[0].id, created: false }); continue; }
        const caseId = randomUUID(); intakeRows.push({ id: caseId, created: true });
        await client.query("INSERT INTO docprep_cases (id, estate_id, state) VALUES ($1, $2, 'queued')", [caseId, estate.estateId]);
        for (const [position, step] of defaultSteps().entries()) await client.query("INSERT INTO docprep_steps (id, case_id, name, state, position) VALUES ($1, $2, $3, $4, $5)", [step.id, caseId, step.name, step.state, position]);
        await client.query("INSERT INTO docprep_events (case_id, event_type, state, detail, actor_email) VALUES ($1, 'case_queued', 'queued', 'Estate was added to cloud document preparation.', $2)", [caseId, estate.actor.email]);
        await client.query("INSERT INTO docprep_outbox (id, case_id, topic, payload) VALUES ($1, $2, 'docprep.case.queued', $3::jsonb)", [randomUUID(), caseId, JSON.stringify({ caseId })]);
      }
      const result = await Promise.all(intakeRows.map(async ({ id, created }) => { const processCase = await toCase(client, id); if (!processCase) throw new ProcessConflictError("Document-prep case was not found."); return { created, idempotent: !created, case: processCase }; }));
      await client.query("INSERT INTO docprep_idempotency_keys (idempotency_key, fingerprint, response) VALUES ($1, $2, $3::jsonb)", [idempotencyKey, fingerprint, JSON.stringify(result)]);
      await client.query("COMMIT"); return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async get(caseId: string) { return toCase(this.pool, caseId); }
  async findByEstate(estateId: string) { const result = await this.pool.query("SELECT id FROM docprep_cases WHERE estate_id = $1 ORDER BY created_at DESC LIMIT 1", [estateId]); return result.rowCount ? this.get(result.rows[0].id) : null; }
  async events(caseId: string, afterId = 0) { const processCase = await this.get(caseId); if (!processCase) throw new ProcessConflictError("Document-prep case was not found."); return processCase.events.filter((event) => event.id > afterId); }
  async startStage(caseId: string, expectedRevision: number, stageId: DocPrepStageId, actorEmail?: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await this.lock(client, caseId, expectedRevision);
      if (current.state !== "sourcing") throw new ProcessTransitionError("A Doc Prep stage can only start while the case is sourcing.");
      const stages = await client.query("SELECT id, state FROM docprep_steps WHERE case_id = $1 AND id = ANY($2::text[]) ORDER BY position FOR UPDATE", [caseId, docPrepStageIds]);
      const firstStage = stages.rows.find((step) => step.state !== "succeeded");
      if (!firstStage || firstStage.id !== stageId) throw new ProcessTransitionError(`Stage ${stageId} is not the first non-succeeded Doc Prep stage.`);
      if (stages.rows.some((step) => step.state === "running")) throw new ProcessTransitionError("Another Doc Prep stage is already running.");
      await client.query("UPDATE docprep_steps SET state = 'running', blocker = NULL, next_action = NULL, started_at = now(), finished_at = NULL, updated_at = now() WHERE case_id = $1 AND id = $2", [caseId, stageId]);
      await client.query("UPDATE docprep_cases SET blocker = NULL, next_action = NULL, revision = revision + 1, updated_at = now() WHERE id = $1", [caseId]);
      await client.query("INSERT INTO docprep_events (case_id, event_type, state, stage_id, detail, actor_email) VALUES ($1, 'stage_started', 'sourcing', $2, $3, $4)", [caseId, stageId, stageDefinition(stageId)?.detail || `Stage ${stageId} started.`, actorEmail || null]);
      const result = await toCase(client, caseId); await client.query("COMMIT");
      if (!result) throw new ProcessConflictError("Document-prep case was not found.");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async finishStage(caseId: string, expectedRevision: number, stageId: DocPrepStageId, rawOutcome: StageOutcome, actorEmail?: string) {
    const outcome = DocPrepStageResponse.parse({ ok: true, stageId, ...rawOutcome });
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN"); await this.lock(client, caseId, expectedRevision);
      const stage = await client.query("SELECT state FROM docprep_steps WHERE case_id = $1 AND id = $2 FOR UPDATE", [caseId, stageId]);
      if (!stage.rowCount || stage.rows[0].state !== "running") throw new ProcessTransitionError(`Stage ${stageId} is not running.`);
      const target: CaseState = outcome.status === "succeeded" ? "sourcing" : outcome.status;
      await client.query("UPDATE docprep_steps SET state = $3, blocker = $4, next_action = $5, detail = $6, evidence_references = $7::jsonb, facts = $8::jsonb, finished_at = now(), updated_at = now() WHERE case_id = $1 AND id = $2", [caseId, stageId, outcome.status, outcome.status === "succeeded" ? null : outcome.detail, outcome.status === "succeeded" ? null : outcome.nextAction || null, outcome.detail, JSON.stringify(outcome.evidenceReferences), JSON.stringify(outcome.facts)]);
      await client.query("UPDATE docprep_cases SET state = $2, blocker = $3, next_action = $4, revision = revision + 1, updated_at = now() WHERE id = $1", [caseId, target, outcome.status === "succeeded" ? null : outcome.detail, outcome.status === "succeeded" ? null : outcome.nextAction || null]);
      await client.query("INSERT INTO docprep_events (case_id, event_type, state, stage_id, detail, actor_email) VALUES ($1, 'stage_finished', $2, $3, $4, $5)", [caseId, target, stageId, outcome.detail, actorEmail || null]);
      const result = await toCase(client, caseId); await client.query("COMMIT");
      if (!result) throw new ProcessConflictError("Document-prep case was not found.");
      return result;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
  async transition(caseId: string, expectedRevision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string) { return this.mutate(caseId, expectedRevision, target, detail, actorEmail, blocker, nextAction); }
  async retry(caseId: string, expectedRevision: number, actorEmail?: string) { const current = await this.requireCurrent(caseId, expectedRevision); if (!["blocked", "failed", "review_required"].includes(current.state)) throw new ProcessTransitionError("Only blocked, failed, or review-required cases may be retried."); return this.mutate(caseId, expectedRevision, "sourcing", "Document preparation was restarted.", actorEmail, undefined, undefined, { enqueue: true, eventType: "case_retried", resetFirstNonSucceeded: true }); }
  async cancel(caseId: string, expectedRevision: number, actorEmail?: string) { const current = await this.requireCurrent(caseId, expectedRevision); if (terminalStates.has(current.state)) throw new ProcessTransitionError("This completed or stopped case cannot be cancelled."); return this.mutate(caseId, expectedRevision, "cancelled", "Document preparation was stopped by the operator.", actorEmail, undefined, "Review the estate before starting a new document-prep case."); }
  async recordArtifact(caseId: string, expectedRevision: number, artifact: Omit<ProcessArtifact, "id" | "caseId">) {
    if (artifact.contentType !== "application/pdf" || artifact.bytes < 1 || !/^[a-f0-9]{64}$/i.test(artifact.sha256) || artifact.readbackStatus !== "verified") throw new ProcessTransitionError("Only a verified PDF with SHA-256 readback may complete a case.");
    const client = await this.pool.connect(); try { await client.query("BEGIN"); const current = await this.lock(client, caseId, expectedRevision); if (current.state !== "rendering") throw new ProcessTransitionError("A PDF can only be recorded while the packet is rendering.");
      await client.query("INSERT INTO docprep_artifacts (id, case_id, object_key, object_version, content_type, bytes, sha256, readback_status, verified_at, artifact_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [randomUUID(), caseId, artifact.objectKey, artifact.objectVersion || null, artifact.contentType, artifact.bytes, artifact.sha256, artifact.readbackStatus, artifact.verifiedAt || now(), artifact.url || null]);
      await client.query("UPDATE docprep_cases SET state = 'packet_ready', revision = revision + 1, updated_at = now() WHERE id = $1", [caseId]); await applyDbSteps(client, caseId, "packet_ready"); await client.query("INSERT INTO docprep_events (case_id, event_type, state, detail) VALUES ($1, 'packet_verified', 'packet_ready', 'Verified PDF is ready to open.')", [caseId]); const done = await toCase(client, caseId); await client.query("COMMIT"); if (!done) throw new ProcessConflictError("Document-prep case was not found."); return done;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
  async claimDriveExport(caseId: string, sha256: string): Promise<DriveExportClaim> {
    const inserted = await this.pool.query("INSERT INTO docprep_drive_exports (case_id, artifact_sha256, state, claimed_at) VALUES ($1, $2, 'pending', now()) ON CONFLICT (case_id, artifact_sha256) DO NOTHING RETURNING case_id", [caseId, sha256]);
    if (inserted.rowCount) return { status: "claimed" };
    const existing = await this.pool.query("SELECT state, name, web_view_link FROM docprep_drive_exports WHERE case_id = $1 AND artifact_sha256 = $2", [caseId, sha256]);
    if (!existing.rowCount) return this.claimDriveExport(caseId, sha256);
    const row = existing.rows[0];
    if (row.state === "completed" && row.name !== null) {
      const processCase = await this.get(caseId);
      if (!processCase) throw new ProcessConflictError("Document-prep case was not found.");
      return { status: "completed", export: { caseId, estateId: processCase.estate.estateId, name: row.name, url: row.web_view_link || "", readbackStatus: "verified", idempotent: true } };
    }
    const reclaimed = await this.pool.query("UPDATE docprep_drive_exports SET claimed_at = now(), attempts = attempts + 1 WHERE case_id = $1 AND artifact_sha256 = $2 AND state = 'pending' AND claimed_at < now() - interval '5 minutes' RETURNING case_id", [caseId, sha256]);
    return reclaimed.rowCount ? { status: "claimed" } : { status: "in_progress" };
  }
  async completeDriveExport(caseId: string, sha256: string, result: DriveExport) {
    const completed = await this.pool.query("UPDATE docprep_drive_exports SET state = 'completed', name = $3, web_view_link = $4, completed_at = now() WHERE case_id = $1 AND artifact_sha256 = $2 AND state = 'pending'", [caseId, sha256, result.name, result.url || null]);
    if (!completed.rowCount) throw new ProcessConflictError("Google Drive export ownership was lost before completion.");
  }
  async releaseDriveExport(caseId: string, sha256: string) { await this.pool.query("DELETE FROM docprep_drive_exports WHERE case_id = $1 AND artifact_sha256 = $2 AND state = 'pending'", [caseId, sha256]); }
  private async requireCurrent(caseId: string, revision: number) { const current = await this.get(caseId); if (!current) throw new ProcessConflictError("Document-prep case was not found."); if (current.revision !== revision) throw new ProcessConflictError("This case changed in another session. Refresh before trying again."); return current; }
  private async lock(client: PoolClient, caseId: string, revision: number) { const result = await client.query("SELECT state, revision FROM docprep_cases WHERE id = $1 FOR UPDATE", [caseId]); if (!result.rowCount) throw new ProcessConflictError("Document-prep case was not found."); if (result.rows[0].revision !== revision) throw new ProcessConflictError("This case changed in another session. Refresh before trying again."); return { state: CaseState.parse(result.rows[0].state) }; }
  private async mutate(caseId: string, revision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string, options: { enqueue?: boolean; eventType?: string; resetFirstNonSucceeded?: boolean } = {}) { const client = await this.pool.connect(); try { await client.query("BEGIN"); const current = await this.lock(client, caseId, revision); if (!legalTransitions[current.state].has(target) && !(target === "sourcing" && ["blocked", "failed", "review_required"].includes(current.state))) throw new ProcessTransitionError(`Cannot move ${current.state} to ${target}.`); if (target === "rendering") { const incomplete = await client.query("SELECT id FROM docprep_steps WHERE case_id = $1 AND id = ANY($2::text[]) AND state <> 'succeeded' LIMIT 1", [caseId, docPrepStageIds]); if (incomplete.rowCount) throw new ProcessTransitionError("All six Doc Prep stages must succeed before packet rendering."); } if (options.resetFirstNonSucceeded) { const reset = await client.query("UPDATE docprep_steps SET state = 'pending', blocker = NULL, next_action = NULL, detail = NULL, evidence_references = '[]'::jsonb, facts = '{}'::jsonb, started_at = NULL, finished_at = NULL, updated_at = now() WHERE case_id = $1 AND id = (SELECT id FROM docprep_steps WHERE case_id = $1 AND state <> 'succeeded' ORDER BY position LIMIT 1) RETURNING id", [caseId]); if (!reset.rowCount) throw new ProcessTransitionError("Every Doc Prep step has already succeeded."); } await client.query("UPDATE docprep_cases SET state = $2, blocker = $3, next_action = $4, revision = revision + 1, updated_at = now() WHERE id = $1", [caseId, target, blocker || null, nextAction || null]); await applyDbSteps(client, caseId, target, blocker, nextAction); await client.query("INSERT INTO docprep_events (case_id, event_type, state, detail, actor_email) VALUES ($1, $2, $3, $4, $5)", [caseId, options.eventType || `case_${target}`, target, detail, actorEmail || null]); if (options.enqueue) await client.query("INSERT INTO docprep_outbox (id, case_id, topic, payload) VALUES ($1, $2, 'docprep.case.queued', $3::jsonb)", [randomUUID(), caseId, JSON.stringify({ caseId })]); const result = await toCase(client, caseId); await client.query("COMMIT"); if (!result) throw new ProcessConflictError("Document-prep case was not found."); return result; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
}
