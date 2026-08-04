import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";

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
