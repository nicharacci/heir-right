import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
export * from "./schema.js";

export const CaseState = z.enum(["queued", "sourcing", "review_required", "rendering", "packet_ready", "blocked", "failed", "cancelled"]);
export const StepState = z.enum(["pending", "running", "succeeded", "review_required", "blocked", "failed", "cancelled"]);
export type CaseState = z.infer<typeof CaseState>;
export type StepState = z.infer<typeof StepState>;

const text = (max: number) => z.string().trim().min(1).max(max);
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

export type ProcessStep = { id: string; name: string; state: StepState; blocker?: string; nextAction?: string; updatedAt: string };
export type ProcessArtifact = { id: string; caseId: string; objectKey: string; objectVersion?: string; contentType: "application/pdf"; bytes: number; sha256: string; readbackStatus: "pending" | "verified" | "failed"; verifiedAt?: string; url?: string };
export type ProcessEvent = { id: number; caseId: string; type: string; state: CaseState; occurredAt: string; detail: string; actorEmail?: string };
export type ProcessCase = { id: string; estate: EstateSnapshot; state: CaseState; revision: number; createdAt: string; updatedAt: string; blocker?: string; nextAction?: string; steps: ProcessStep[]; artifact?: ProcessArtifact; events: ProcessEvent[] };
export type CommandResult = { created: boolean; idempotent: boolean; case: ProcessCase };

const terminalStates = new Set<CaseState>(["packet_ready", "blocked", "failed", "cancelled"]);
const legalTransitions: Record<CaseState, ReadonlySet<CaseState>> = {
  queued: new Set(["sourcing", "blocked", "cancelled", "failed"]),
  sourcing: new Set(["review_required", "rendering", "blocked", "failed", "cancelled"]),
  review_required: new Set(["sourcing", "rendering", "blocked", "cancelled"]),
  rendering: new Set(["packet_ready", "review_required", "blocked", "failed", "cancelled"]),
  packet_ready: new Set(), blocked: new Set(["sourcing", "cancelled"]), failed: new Set(["sourcing", "cancelled"]), cancelled: new Set(),
};

const defaultSteps = (): ProcessStep[] => [
  { id: "source-review", name: "Source review", state: "pending", updatedAt: now() },
  { id: "legal-review", name: "Review required evidence", state: "pending", updatedAt: now() },
  { id: "packet-render", name: "Packet rendering", state: "pending", updatedAt: now() },
  { id: "artifact-readback", name: "PDF readback", state: "pending", updatedAt: now() },
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
  transition(caseId: string, expectedRevision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string): Promise<ProcessCase>;
  retry(caseId: string, expectedRevision: number, actorEmail?: string): Promise<ProcessCase>;
  cancel(caseId: string, expectedRevision: number, actorEmail?: string): Promise<ProcessCase>;
  recordArtifact(caseId: string, expectedRevision: number, artifact: Omit<ProcessArtifact, "id" | "caseId">): Promise<ProcessCase>;
}

/** In-memory conformance adapter. Production supplies the Postgres adapter in the process API. */
export class InMemoryProcessRepository implements ProcessRepository {
  private readonly cases = new Map<string, ProcessCase>();
  private readonly estateIndex = new Map<string, string>();
  private readonly idempotency = new Map<string, { fingerprint: string; results: CommandResult[] }>();
  private eventSequence = 0;

  async ready() {}

  async intake(raw: IntakeCommand, idempotencyKey: string): Promise<CommandResult[]> {
    const command = IntakeCommand.parse(raw);
    if (!/^[A-Za-z0-9._:-]{12,200}$/.test(idempotencyKey)) throw new ProcessConflictError("A valid idempotency key is required.");
    const fingerprint = requestFingerprint(command);
    const prior = this.idempotency.get(idempotencyKey);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw new ProcessConflictError("This idempotency key was already used for different estates.");
      return prior.results.map((result) => ({ ...result, idempotent: true, case: clone(result.case) }));
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
  async transition(caseId: string, expectedRevision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (!legalTransitions[processCase.state].has(target)) throw new ProcessTransitionError(`Cannot move ${processCase.state} to ${target}.`);
    processCase.state = target; processCase.revision += 1; processCase.updatedAt = now(); processCase.blocker = blocker; processCase.nextAction = nextAction;
    this.append(processCase, `case_${target}`, detail, actorEmail);
    return clone(processCase);
  }
  async retry(caseId: string, expectedRevision: number, actorEmail?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (!["blocked", "failed", "review_required"].includes(processCase.state)) throw new ProcessTransitionError("Only blocked, failed, or review-required cases may be retried.");
    if (processCase.state === "review_required" && processCase.blocker) throw new ProcessTransitionError("Resolve the review blocker before retrying this case.");
    processCase.state = "sourcing"; processCase.blocker = undefined; processCase.nextAction = undefined; processCase.revision += 1; processCase.updatedAt = now();
    this.append(processCase, "case_retried", "Document preparation was restarted.", actorEmail);
    return clone(processCase);
  }
  async cancel(caseId: string, expectedRevision: number, actorEmail?: string) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (terminalStates.has(processCase.state)) throw new ProcessTransitionError("This completed or stopped case cannot be cancelled.");
    processCase.state = "cancelled"; processCase.revision += 1; processCase.updatedAt = now(); processCase.nextAction = "Review the estate before starting a new document-prep case.";
    this.append(processCase, "case_cancelled", "Document preparation was stopped by the operator.", actorEmail);
    return clone(processCase);
  }
  async recordArtifact(caseId: string, expectedRevision: number, artifact: Omit<ProcessArtifact, "id" | "caseId">) {
    const processCase = this.requireRevision(caseId, expectedRevision);
    if (processCase.state !== "rendering") throw new ProcessTransitionError("A PDF can only be recorded while the packet is rendering.");
    if (artifact.contentType !== "application/pdf" || artifact.bytes < 1 || !/^[a-f0-9]{64}$/i.test(artifact.sha256) || artifact.readbackStatus !== "verified") throw new ProcessTransitionError("Only a verified PDF with SHA-256 readback may complete a case.");
    processCase.artifact = { ...artifact, id: randomUUID(), caseId }; processCase.state = "packet_ready"; processCase.revision += 1; processCase.updatedAt = now();
    this.append(processCase, "packet_verified", "Verified PDF is ready to open.");
    return clone(processCase);
  }
  private append(processCase: ProcessCase, type: string, detail: string, actorEmail?: string) { processCase.events.push({ id: ++this.eventSequence, caseId: processCase.id, type, state: processCase.state, detail, actorEmail, occurredAt: now() }); }
  private requireCase(caseId: string) { const processCase = this.cases.get(caseId); if (!processCase) throw new ProcessConflictError("Document-prep case was not found."); return processCase; }
  private requireRevision(caseId: string, expectedRevision: number) { const processCase = this.requireCase(caseId); if (processCase.revision !== expectedRevision) throw new ProcessConflictError("This case changed in another session. Refresh before trying again."); return processCase; }
}

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;
const toCase = async (db: Queryable, caseId: string): Promise<ProcessCase | null> => {
  const caseResult = await db.query("SELECT c.*, e.snapshot FROM docprep_cases c JOIN docprep_estates e ON e.estate_id = c.estate_id WHERE c.id = $1", [caseId]);
  if (!caseResult.rowCount) return null;
  const row = caseResult.rows[0];
  const [steps, events, artifact] = await Promise.all([
    db.query("SELECT id, name, state, blocker, next_action, updated_at FROM docprep_steps WHERE case_id = $1 ORDER BY position", [caseId]),
    db.query("SELECT id, case_id, event_type, state, detail, actor_email, occurred_at FROM docprep_events WHERE case_id = $1 ORDER BY id", [caseId]),
    db.query("SELECT id, case_id, object_key, object_version, content_type, bytes, sha256, readback_status, verified_at, artifact_url FROM docprep_artifacts WHERE case_id = $1 ORDER BY verified_at DESC NULLS LAST LIMIT 1", [caseId]),
  ]);
  const sourceArtifact = artifact.rows[0];
  return {
    id: row.id, estate: EstateSnapshot.parse(row.snapshot), state: CaseState.parse(row.state), revision: row.revision,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), blocker: row.blocker || undefined, nextAction: row.next_action || undefined,
    steps: steps.rows.map((step) => ({ id: step.id, name: step.name, state: StepState.parse(step.state), blocker: step.blocker || undefined, nextAction: step.next_action || undefined, updatedAt: step.updated_at.toISOString() })),
    events: events.rows.map((event) => ({ id: Number(event.id), caseId: event.case_id, type: event.event_type, state: CaseState.parse(event.state), detail: event.detail, actorEmail: event.actor_email || undefined, occurredAt: event.occurred_at.toISOString() })),
    artifact: sourceArtifact ? { id: sourceArtifact.id, caseId: sourceArtifact.case_id, objectKey: sourceArtifact.object_key, objectVersion: sourceArtifact.object_version || undefined, contentType: "application/pdf", bytes: Number(sourceArtifact.bytes), sha256: sourceArtifact.sha256, readbackStatus: sourceArtifact.readback_status, verifiedAt: sourceArtifact.verified_at?.toISOString(), url: sourceArtifact.artifact_url || undefined } : undefined,
  };
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
        await client.query("COMMIT");
        return (previous.rows[0].response as CommandResult[]).map((value) => ({ ...value, idempotent: true }));
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
  async transition(caseId: string, expectedRevision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string) { return this.mutate(caseId, expectedRevision, target, detail, actorEmail, blocker, nextAction); }
  async retry(caseId: string, expectedRevision: number, actorEmail?: string) { const current = await this.requireCurrent(caseId, expectedRevision); if (!["blocked", "failed", "review_required"].includes(current.state) || (current.state === "review_required" && current.blocker)) throw new ProcessTransitionError("Resolve the review blocker before retrying this case."); return this.mutate(caseId, expectedRevision, "sourcing", "Document preparation was restarted.", actorEmail); }
  async cancel(caseId: string, expectedRevision: number, actorEmail?: string) { const current = await this.requireCurrent(caseId, expectedRevision); if (terminalStates.has(current.state)) throw new ProcessTransitionError("This completed or stopped case cannot be cancelled."); return this.mutate(caseId, expectedRevision, "cancelled", "Document preparation was stopped by the operator.", actorEmail, undefined, "Review the estate before starting a new document-prep case."); }
  async recordArtifact(caseId: string, expectedRevision: number, artifact: Omit<ProcessArtifact, "id" | "caseId">) {
    if (artifact.contentType !== "application/pdf" || artifact.bytes < 1 || !/^[a-f0-9]{64}$/i.test(artifact.sha256) || artifact.readbackStatus !== "verified") throw new ProcessTransitionError("Only a verified PDF with SHA-256 readback may complete a case.");
    const client = await this.pool.connect(); try { await client.query("BEGIN"); const current = await this.lock(client, caseId, expectedRevision); if (current.state !== "rendering") throw new ProcessTransitionError("A PDF can only be recorded while the packet is rendering.");
      await client.query("INSERT INTO docprep_artifacts (id, case_id, object_key, object_version, content_type, bytes, sha256, readback_status, verified_at, artifact_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [randomUUID(), caseId, artifact.objectKey, artifact.objectVersion || null, artifact.contentType, artifact.bytes, artifact.sha256, artifact.readbackStatus, artifact.verifiedAt || now(), artifact.url || null]);
      await client.query("UPDATE docprep_cases SET state = 'packet_ready', revision = revision + 1, updated_at = now() WHERE id = $1", [caseId]); await client.query("INSERT INTO docprep_events (case_id, event_type, state, detail) VALUES ($1, 'packet_verified', 'packet_ready', 'Verified PDF is ready to open.')", [caseId]); const done = await toCase(client, caseId); await client.query("COMMIT"); if (!done) throw new ProcessConflictError("Document-prep case was not found."); return done;
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
  private async requireCurrent(caseId: string, revision: number) { const current = await this.get(caseId); if (!current) throw new ProcessConflictError("Document-prep case was not found."); if (current.revision !== revision) throw new ProcessConflictError("This case changed in another session. Refresh before trying again."); return current; }
  private async lock(client: PoolClient, caseId: string, revision: number) { const result = await client.query("SELECT state, revision FROM docprep_cases WHERE id = $1 FOR UPDATE", [caseId]); if (!result.rowCount) throw new ProcessConflictError("Document-prep case was not found."); if (result.rows[0].revision !== revision) throw new ProcessConflictError("This case changed in another session. Refresh before trying again."); return { state: CaseState.parse(result.rows[0].state) }; }
  private async mutate(caseId: string, revision: number, target: CaseState, detail: string, actorEmail?: string, blocker?: string, nextAction?: string) { const client = await this.pool.connect(); try { await client.query("BEGIN"); const current = await this.lock(client, caseId, revision); if (!legalTransitions[current.state].has(target) && !(target === "sourcing" && ["blocked", "failed", "review_required"].includes(current.state))) throw new ProcessTransitionError(`Cannot move ${current.state} to ${target}.`); await client.query("UPDATE docprep_cases SET state = $2, blocker = $3, next_action = $4, revision = revision + 1, updated_at = now() WHERE id = $1", [caseId, target, blocker || null, nextAction || null]); await client.query("INSERT INTO docprep_events (case_id, event_type, state, detail, actor_email) VALUES ($1, $2, $3, $4, $5)", [caseId, `case_${target}`, target, detail, actorEmail || null]); const result = await toCase(client, caseId); await client.query("COMMIT"); if (!result) throw new ProcessConflictError("Document-prep case was not found."); return result; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
}
