import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Pool, PoolClient } from "pg";

const migrationLock = "heirright-docprep-schema-v1";
const migrationTable = "docprep_schema_migrations";
const defaultMigrationDirectory = join(__dirname, "../../../packages/docprep-core/migrations");

type MigrationClient = Pick<PoolClient, "query" | "release">;
type MigrationPool = Pick<Pool, "connect">;

export const runDocPrepMigrations = async (pool: MigrationPool, migrationDirectory = defaultMigrationDirectory) => {
  const files = (await readdir(migrationDirectory)).filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file)).sort();
  if (!files.length) throw new Error("No Doc Prep SQL migrations were found.");

  const client: MigrationClient = await pool.connect();
  let lockHeld = false;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [migrationLock]);
    lockHeld = true;
    await client.query(`CREATE TABLE IF NOT EXISTS ${migrationTable} (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);

    for (const file of files) {
      const sql = await readFile(join(migrationDirectory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await client.query(`SELECT checksum FROM ${migrationTable} WHERE name = $1`, [file]);
      const previous = applied.rows[0] as { checksum?: string } | undefined;
      if (previous) {
        if (previous.checksum !== checksum) throw new Error(`Migration checksum mismatch for ${file}.`);
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO ${migrationTable} (name, checksum) VALUES ($1, $2)`, [file, checksum]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
    }
  } finally {
    if (lockHeld) await client.query("SELECT pg_advisory_unlock(hashtext($1))", [migrationLock]).catch(() => undefined);
    client.release();
  }
};
