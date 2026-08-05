import { createHash, randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Pool, PoolClient } from "pg";
import { DOC_PREP_STAGES, DocPrepStageId, EstateSnapshot, ProcessCase, ProcessRepository, StageOutcome } from "@ple/docprep-core";
import type { DocPrepEvidenceReference } from "@ple/docprep-core";

export type SourceResult = { kind: "ready"; pdf: Uint8Array } | { kind: "review_required"; detail: string; nextAction: string } | { kind: "blocked"; detail: string; nextAction: string };
export type StageRunnerRequest = {
  caseId: string;
  estate: EstateSnapshot;
  priorStageOutputs: Array<{ stageId: DocPrepStageId; evidenceReferences: DocPrepEvidenceReference[] }>;
  actor: { email: string; name?: string };
};
export type StageRunner = (stageId: DocPrepStageId, request: StageRunnerRequest) => Promise<StageOutcome>;
export type PacketRenderer = (processCase: ProcessCase) => Promise<SourceResult>;
export interface ObjectStore { put(key: string, bytes: Uint8Array): Promise<void>; get(key: string): Promise<{ bytes: Uint8Array; contentType: string }>; }
export type WorkerSystemFailure = { stageId: string; code: string; provider: string; deploymentKey: string };
export type WorkerDependencies = { repository: ProcessRepository; stageRunner: StageRunner; packetRenderer: PacketRenderer; objectStore: ObjectStore; reportSystemFailure?: (failure: WorkerSystemFailure) => Promise<void> };
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const stoppedStates = new Set(["packet_ready", "review_required", "blocked", "failed", "cancelled"]);

const priorStageOutputs = (processCase: ProcessCase): StageRunnerRequest["priorStageOutputs"] => DOC_PREP_STAGES.flatMap((stage) => {
  const step = processCase.steps.find((candidate) => candidate.id === stage.id);
  return step?.state === "succeeded" ? [{ stageId: stage.id, evidenceReferences: [...step.evidenceReferences] }] : [];
});

export class DocumentPrepWorker {
  constructor(private readonly dependencies: WorkerDependencies) {}
  async process(caseId: string): Promise<ProcessCase> {
    const report = async (failure: WorkerSystemFailure) => { try { await this.dependencies.reportSystemFailure?.(failure); } catch { /* system reporting must not change process truth */ } };
    let current = await this.dependencies.repository.get(caseId);
    if (!current) throw new Error("Document-prep case was not found.");
    if (stoppedStates.has(current.state)) return current;
    if (current.state === "queued") current = await this.dependencies.repository.transition(current.id, current.revision, "sourcing", "Ordered Doc Prep stages started.");

    if (current.state === "sourcing") {
      for (const stage of DOC_PREP_STAGES) {
        const step = current.steps.find((candidate) => candidate.id === stage.id);
        if (!step) throw new Error(`Document-prep stage ${stage.id} was not persisted.`);
        if (step.state === "succeeded") continue;
        if (step.state === "running") return current;

        const running = await this.dependencies.repository.startStage(current.id, current.revision, stage.id, current.estate.actor.email);
        let outcome: StageOutcome;
        try {
          outcome = await this.dependencies.stageRunner(stage.id, {
            caseId: running.id,
            estate: running.estate,
            priorStageOutputs: priorStageOutputs(running),
            actor: running.estate.actor,
          });
        } catch (error) {
          await report({ stageId: stage.id, code: "source_runner_failed", provider: "source", deploymentKey: "docprep-worker" });
          outcome = {
            status: "failed",
            detail: error instanceof Error ? error.message : `Stage ${stage.id} failed without a readable error.`,
            nextAction: "Review the stage failure and retry document preparation.",
            evidenceReferences: [],
            facts: {},
          };
        }
        current = await this.dependencies.repository.finishStage(running.id, running.revision, stage.id, outcome, running.estate.actor.email);
        if (outcome.status !== "succeeded") return current;
      }
      current = await this.dependencies.repository.transition(current.id, current.revision, "rendering", "All six Doc Prep stages succeeded. Rendering the verified Discovery packet.");
    }

    if (current.state !== "rendering") return current;
    const rendering = current;
    let result: SourceResult;
    try {
      result = await this.dependencies.packetRenderer(rendering);
    } catch {
      await report({ stageId: "packet-render", code: "packet_renderer_transport_failed", provider: "source", deploymentKey: "docprep-worker" });
      return this.dependencies.repository.transition(rendering.id, rendering.revision, "failed", "The verified Discovery packet renderer failed to respond.", undefined, "The verified Discovery packet renderer failed to respond.", "Retry document preparation after the source service is available.");
    }
    if (result.kind === "blocked") return this.dependencies.repository.transition(rendering.id, rendering.revision, "blocked", result.detail, undefined, result.detail, result.nextAction);
    if (result.kind === "review_required") return this.dependencies.repository.transition(rendering.id, rendering.revision, "review_required", result.detail, undefined, result.detail, result.nextAction);
    const key = `docprep/${rendering.id}/${randomUUID()}.pdf`;
    let readback: { bytes: Uint8Array; contentType: string };
    try {
      await this.dependencies.objectStore.put(key, result.pdf);
      readback = await this.dependencies.objectStore.get(key);
    } catch {
      await report({ stageId: "artifact-readback", code: "r2_readback_failed", provider: "r2", deploymentKey: "docprep-worker" });
      return this.dependencies.repository.transition(rendering.id, rendering.revision, "failed", "Stored PDF could not be read back from R2.", undefined, "Stored PDF could not be read back from R2.", "Retry document preparation after storage is available.");
    }
    const expectedHash = sha256(result.pdf); const readbackHash = sha256(readback.bytes);
    if (readback.contentType !== "application/pdf" || expectedHash !== readbackHash || readback.bytes.byteLength !== result.pdf.byteLength) {
      await report({ stageId: "artifact-readback", code: "r2_readback_mismatch", provider: "r2", deploymentKey: "docprep-worker" });
      return this.dependencies.repository.transition(rendering.id, rendering.revision, "failed", "Stored PDF did not pass readback verification.", undefined, "Stored PDF did not pass readback verification.", "Retry document preparation after storage is available.");
    }
    return this.dependencies.repository.recordArtifact(rendering.id, rendering.revision, { objectKey: key, contentType: readback.contentType, bytes: readback.bytes.byteLength, sha256: readbackHash, readbackStatus: "verified", verifiedAt: new Date().toISOString() });
  }
}

export class R2ObjectStore implements ObjectStore {
  constructor(private readonly client: S3Client, private readonly bucket: string) {}
  async put(key: string, bytes: Uint8Array) { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: "application/pdf" })); }
  async get(key: string) { const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })); if (!response.Body) throw new Error("R2 returned an empty PDF object."); return { bytes: new Uint8Array(await response.Body.transformToByteArray()), contentType: response.ContentType || "" }; }
}

/** Claims the transactional outbox without a browser or request process owning the sequence. */
export const claimOutbox = async (
  pool: Pool,
  limit = 25,
  reportSystemFailure?: (failure: WorkerSystemFailure) => Promise<void>,
): Promise<Array<{ id: string; caseId: string; topic: string }>> => {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const claimed = await client.query("WITH candidates AS (SELECT id FROM docprep_outbox WHERE completed_at IS NULL AND (claimed_at IS NULL OR claimed_at < now() - interval '5 minutes') AND available_at <= now() ORDER BY available_at LIMIT $1 FOR UPDATE SKIP LOCKED) UPDATE docprep_outbox o SET claimed_at = now(), attempts = attempts + 1 FROM candidates WHERE o.id = candidates.id RETURNING o.id, o.case_id, o.topic", [limit]);
    await client.query("COMMIT");
    return claimed.rows.map((row) => ({ id: row.id, caseId: row.case_id, topic: row.topic }));
  } catch (error) {
    await client?.query("ROLLBACK").catch(() => undefined);
    try {
      await reportSystemFailure?.({ stageId: "outbox", code: "outbox_claim_failed", provider: "postgres", deploymentKey: "docprep-worker" });
    } catch { /* system reporting must not change queue truth */ }
    throw error;
  } finally {
    client?.release();
  }
};
export const finishOutbox = (pool: Pool, id: string) => pool.query("UPDATE docprep_outbox SET completed_at = now() WHERE id = $1", [id]);
