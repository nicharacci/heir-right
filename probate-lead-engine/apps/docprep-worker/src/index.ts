import { Pool } from "pg";
import PgBoss from "pg-boss";
import { S3Client } from "@aws-sdk/client-s3";
import { PostgresProcessRepository } from "@ple/docprep-core";
import { DocumentPrepWorker, R2ObjectStore, SourceRunner, claimOutbox, finishOutbox } from "./worker.js";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; };
const databaseUrl = required("DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5_000 });
const workerUrl = required("HEIRRIGHT_WORKER_URL").replace(/\/+$/, "");
const apiToken = required("HEIRRIGHT_API_TOKEN");
const sourceRunner: SourceRunner = async (processCase) => {
  const response = await fetch(`${workerUrl}/api/discovery/file?estateId=${encodeURIComponent(processCase.estate.estateId)}`, { headers: { authorization: `Bearer ${apiToken}` } });
  if (!response.ok) return { kind: "blocked", detail: "The source packet is not available for document preparation.", nextAction: "Review the estate’s source packet before retrying." };
  return { kind: "review_required", detail: "Source evidence must be reviewed before packet rendering.", nextAction: "Review the source packet and clear the estate for document preparation." };
};
const storage = new R2ObjectStore(new S3Client({ endpoint: required("R2_ENDPOINT"), region: "auto", credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") } }), required("R2_BUCKET_NAME"), required("R2_PUBLIC_BASE_URL"));
const processWorker = new DocumentPrepWorker({ repository: new PostgresProcessRepository(pool), sourceRunner, objectStore: storage });
const boss = new PgBoss({ connectionString: databaseUrl, schema: "docprep_pgboss", retryLimit: 8, retryDelay: 30, retryBackoff: true, pollingIntervalSeconds: 1 });
let stopping = false;
let dispatchTimer: NodeJS.Timeout | undefined;

const dispatchOutbox = async () => {
  if (stopping) return;
  for (const job of await claimOutbox(pool)) {
    try {
      await boss.send(job.topic, { caseId: job.caseId }, { id: job.id, retryLimit: 8, retryDelay: 30, retryBackoff: true });
      await finishOutbox(pool, job.id);
    } catch (error) {
      console.error("docprep_outbox_dispatch_failed", { id: job.id, message: error instanceof Error ? error.message : "unknown" });
    }
  }
};

const main = async () => {
  boss.on("error", (error) => console.error("docprep_pgboss_failed", { message: error.message }));
  await boss.start();
  await boss.createQueue("docprep.case.queued", { name: "docprep.case.queued", policy: "standard", retryLimit: 8, retryDelay: 30, retryBackoff: true });
  await boss.work<{ caseId: string }>("docprep.case.queued", { batchSize: 1, pollingIntervalSeconds: 1 }, async ([job]) => {
    await processWorker.process(job.data.caseId);
  });
  dispatchTimer = setInterval(() => { void dispatchOutbox(); }, 1_000);
  await dispatchOutbox();
};

const shutdown = async () => { stopping = true; if (dispatchTimer) clearInterval(dispatchTimer); await boss.stop({ graceful: true, timeout: 30_000 }); await pool.end(); process.exit(0); };
process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
main().catch(async (error) => { console.error("docprep_worker_start_failed", { message: error instanceof Error ? error.message : "unknown" }); await pool.end(); process.exit(1); });
