import { Pool } from "pg";
import { runDocPrepMigrations } from "./migrations.js";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const main = async () => {
  const pool = new Pool({ connectionString: required("DATABASE_URL"), max: 1, connectionTimeoutMillis: 10_000 });
  try {
    await runDocPrepMigrations(pool);
    console.info("docprep_migrations_complete");
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error("docprep_migrations_failed", { message: error instanceof Error ? error.message : "unknown" });
  process.exitCode = 1;
});
