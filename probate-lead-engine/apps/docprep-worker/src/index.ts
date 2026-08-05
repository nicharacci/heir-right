import { Pool } from "pg";
import PgBoss from "pg-boss";
import { S3Client } from "@aws-sdk/client-s3";
import { PostgresProcessRepository } from "@ple/docprep-core";
import { DocumentPrepWorker, R2ObjectStore, claimOutbox, finishOutbox } from "./worker.js";
import { createCloudflarePacketRenderer, createCloudflareStageRunner, createCloudflareSystemFailureReporter } from "./source-runner.js";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; };
const databaseUrl = required("DATABASE_URL");
const pool = new Pool({ connectionString: databaseUrl, max: 5, connectionTimeoutMillis: 5_000 });
const workerUrl = required("HEIRRIGHT_WORKER_URL").replace(/\/+$/, "");
const sourceToken = required("HEIRRIGHT_DOC_PREP_SOURCE_TOKEN");
const reportSystemFailure = createCloudflareSystemFailureReporter({ workerUrl, apiToken: sourceToken });
const stageRunner = createCloudflareStageRunner({ workerUrl, apiToken: sourceToken, reportSystemFailure });
const packetRenderer = createCloudflarePacketRenderer({ workerUrl, apiToken: sourceToken, reportSystemFailure });
const storage = new R2ObjectStore(new S3Client({ endpoint: required("R2_ENDPOINT"), region: "auto", credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") } }), required("R2_BUCKET_NAME"));
const processWorker = new DocumentPrepWorker({ repository: new PostgresProcessRepository(pool), stageRunner, packetRenderer, objectStore: storage, reportSystemFailure });
const boss = new PgBoss({ connectionString: databaseUrl, schema: "docprep_pgboss", retryLimit: 8, retryDelay: 30, retryBackoff: true, pollingIntervalSeconds: 1 });
let stopping = false;
let dispatchTimer: NodeJS.Timeout | undefined;

const dispatchOutbox = async () => {
  if (stopping) return;
  let jobs: Array<{ id: string; caseId: string; topic: string }>;
  try {
    jobs = await claimOutbox(pool, 25, reportSystemFailure);
  } catch {
    return;
  }
  for (const job of jobs) {
    try {
      await boss.send(job.topic, { caseId: job.caseId }, { id: job.id, retryLimit: 8, retryDelay: 30, retryBackoff: true });
      await finishOutbox(pool, job.id);
    } catch {
      console.error("docprep_outbox_dispatch_failed");
      await reportSystemFailure({ stageId: "outbox", code: "outbox_dispatch_failed", provider: "pg-boss", deploymentKey: "docprep-worker" }).catch(() => undefined);
    }
  }
};

const main = async () => {
  boss.on("error", () => {
    console.error("docprep_pgboss_failed");
    void reportSystemFailure({ stageId: "pg-boss", code: "pg_boss_failed", provider: "pg-boss", deploymentKey: "docprep-worker" }).catch(() => undefined);
  });
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
main().catch(async () => {
  console.error("docprep_worker_start_failed");
  await reportSystemFailure({ stageId: "pg-boss", code: "pg_boss_start_failed", provider: "pg-boss", deploymentKey: "docprep-worker" }).catch(() => undefined);
  await pool.end();
  process.exit(1);
});
