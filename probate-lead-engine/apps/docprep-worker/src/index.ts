import { Pool } from "pg";
import { S3Client } from "@aws-sdk/client-s3";
import { PostgresProcessRepository } from "@ple/docprep-core";
import { DocumentPrepWorker, R2ObjectStore, SourceRunner, claimOutbox, finishOutbox } from "./worker.js";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; };
const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 5, connectionTimeoutMillis: 5_000 });
const workerUrl = required("HEIRRIGHT_WORKER_URL").replace(/\/+$/, "");
const apiToken = required("HEIRRIGHT_API_TOKEN");
const sourceRunner: SourceRunner = async (processCase) => {
  const response = await fetch(`${workerUrl}/api/discovery/file?estateId=${encodeURIComponent(processCase.estate.estateId)}`, { headers: { authorization: `Bearer ${apiToken}` } });
  if (!response.ok) return { kind: "blocked", detail: "The source packet is not available for document preparation.", nextAction: "Review the estate’s source packet before retrying." };
  return { kind: "review_required", detail: "Source evidence must be reviewed before packet rendering.", nextAction: "Review the source packet and clear the estate for document preparation." };
};
const storage = new R2ObjectStore(new S3Client({ endpoint: required("R2_ENDPOINT"), region: "auto", credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") } }), required("R2_BUCKET_NAME"), required("R2_PUBLIC_BASE_URL"));
const processWorker = new DocumentPrepWorker({ repository: new PostgresProcessRepository(pool), sourceRunner, objectStore: storage });
let stopping = false;
const tick = async () => { for (const job of await claimOutbox(pool)) { try { await processWorker.process(job.caseId); await finishOutbox(pool, job.id); } catch (error) { console.error("docprep_outbox_failed", { id: job.id, message: error instanceof Error ? error.message : "unknown" }); } } };
const interval = setInterval(() => { if (!stopping) void tick(); }, 1_000); void tick();
const shutdown = async () => { stopping = true; clearInterval(interval); await pool.end(); process.exit(0); }; process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
