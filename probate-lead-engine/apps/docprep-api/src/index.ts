import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { PostgresProcessRepository } from "@ple/docprep-core";
import { createApp } from "./app.js";

const required = (name: string) => { const value = process.env[name]; if (!value) throw new Error(`${name} is required.`); return value; };
const port = Number(process.env.PORT || 3000);
const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 10, idleTimeoutMillis: 15_000, connectionTimeoutMillis: 5_000 });
const app = createApp({ serviceToken: required("HEIRRIGHT_PROCESS_API_TOKEN"), repository: new PostgresProcessRepository(pool) });
const server = serve({ fetch: app.fetch, port });
const shutdown = async () => { server.close(); await pool.end(); process.exit(0); };
process.once("SIGTERM", shutdown); process.once("SIGINT", shutdown);
