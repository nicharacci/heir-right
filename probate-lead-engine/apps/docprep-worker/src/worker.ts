import { createHash, randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Pool } from "pg";
import { ProcessCase, ProcessRepository } from "@ple/docprep-core";

export type SourceResult = { kind: "ready"; pdf: Uint8Array } | { kind: "review_required"; detail: string; nextAction: string } | { kind: "blocked"; detail: string; nextAction: string };
export type SourceRunner = (processCase: ProcessCase) => Promise<SourceResult>;
export interface ObjectStore { put(key: string, bytes: Uint8Array): Promise<void>; get(key: string): Promise<Uint8Array>; publicUrl(key: string): string; }
export type WorkerDependencies = { repository: ProcessRepository; sourceRunner: SourceRunner; objectStore: ObjectStore };
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export class DocumentPrepWorker {
  constructor(private readonly dependencies: WorkerDependencies) {}
  async process(caseId: string): Promise<ProcessCase> {
    const existing = await this.dependencies.repository.get(caseId);
    if (!existing) throw new Error("Document-prep case was not found.");
    if (["packet_ready", "blocked", "cancelled"].includes(existing.state)) return existing;
    const sourcing = existing.state === "queued" ? await this.dependencies.repository.transition(existing.id, existing.revision, "sourcing", "Cloud source review started.") : existing;
    const result = await this.dependencies.sourceRunner(sourcing);
    if (result.kind === "blocked") return this.dependencies.repository.transition(sourcing.id, sourcing.revision, "blocked", result.detail, undefined, result.detail, result.nextAction);
    if (result.kind === "review_required") return this.dependencies.repository.transition(sourcing.id, sourcing.revision, "review_required", result.detail, undefined, result.detail, result.nextAction);
    const rendering = await this.dependencies.repository.transition(sourcing.id, sourcing.revision, "rendering", "Verified source evidence is ready for packet rendering.");
    const key = `docprep/${rendering.id}/${randomUUID()}.pdf`;
    await this.dependencies.objectStore.put(key, result.pdf);
    const readback = await this.dependencies.objectStore.get(key);
    const expectedHash = sha256(result.pdf); const readbackHash = sha256(readback);
    if (expectedHash !== readbackHash || readback.byteLength !== result.pdf.byteLength) return this.dependencies.repository.transition(rendering.id, rendering.revision, "failed", "Stored PDF did not pass readback verification.", undefined, "Stored PDF did not pass readback verification.", "Retry document preparation after storage is available.");
    return this.dependencies.repository.recordArtifact(rendering.id, rendering.revision, { objectKey: key, contentType: "application/pdf", bytes: readback.byteLength, sha256: readbackHash, readbackStatus: "verified", verifiedAt: new Date().toISOString(), url: this.dependencies.objectStore.publicUrl(key) });
  }
}

export class R2ObjectStore implements ObjectStore {
  constructor(private readonly client: S3Client, private readonly bucket: string, private readonly baseUrl: string) {}
  async put(key: string, bytes: Uint8Array) { await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes, ContentType: "application/pdf" })); }
  async get(key: string) { const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key })); if (!response.Body) throw new Error("R2 returned an empty PDF object."); return new Uint8Array(await response.Body.transformToByteArray()); }
  publicUrl(key: string) { return `${this.baseUrl.replace(/\/+$/, "")}/${encodeURIComponent(key)}`; }
}

/** Claims the transactional outbox without a browser or request process owning the sequence. */
export const claimOutbox = async (pool: Pool, limit = 25): Promise<Array<{ id: string; caseId: string }>> => {
  const client = await pool.connect(); try { await client.query("BEGIN"); const claimed = await client.query("WITH candidates AS (SELECT id FROM docprep_outbox WHERE completed_at IS NULL AND claimed_at IS NULL AND available_at <= now() ORDER BY available_at LIMIT $1 FOR UPDATE SKIP LOCKED) UPDATE docprep_outbox o SET claimed_at = now(), attempts = attempts + 1 FROM candidates WHERE o.id = candidates.id RETURNING o.id, o.case_id", [limit]); await client.query("COMMIT"); return claimed.rows.map((row) => ({ id: row.id, caseId: row.case_id })); } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } };
export const finishOutbox = (pool: Pool, id: string) => pool.query("UPDATE docprep_outbox SET completed_at = now() WHERE id = $1", [id]);
