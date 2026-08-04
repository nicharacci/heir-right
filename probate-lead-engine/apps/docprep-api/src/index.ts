import { serve } from "@hono/node-server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import { PostgresProcessRepository } from "@ple/docprep-core";
import { createApp } from "./app.js";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; };
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 10, idleTimeoutMillis: 15_000, connectionTimeoutMillis: 5_000 });
const r2Bucket = required("R2_BUCKET_NAME");
const r2 = new S3Client({
  endpoint: required("R2_ENDPOINT"),
  region: "auto",
  credentials: { accessKeyId: required("R2_ACCESS_KEY_ID"), secretAccessKey: required("R2_SECRET_ACCESS_KEY") },
});
const app = createApp({
  serviceToken: required("HEIRRIGHT_PROCESS_API_TOKEN"),
  repository: new PostgresProcessRepository(pool),
  artifactStore: {
    async get(objectKey) {
      const response = await r2.send(new GetObjectCommand({ Bucket: r2Bucket, Key: objectKey }));
      if (!response.Body) throw new Error("R2 returned an empty PDF object.");
      return new Uint8Array(await response.Body.transformToByteArray());
    },
  },
  googleDrive: { accessToken: process.env.GOOGLE_WORKSPACE_ACCESS_TOKEN, parentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID },
});
const server = serve({ fetch: app.fetch, port });
const shutdown = async () => { server.close(); await pool.end(); process.exit(0); };
process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
