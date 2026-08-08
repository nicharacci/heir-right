import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/worker/src/s46-discovery-worker.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../apps/worker/migrations/s46/0001_s46.sql", import.meta.url), "utf8");
assert.match(source, /request\.formData\(\)/);
assert.match(source, /assertPdfEnvelope/);
assert.match(source, /source_custody_verification_failed/);
assert.doesNotMatch(source, /CREATE TABLE/i);
for (const table of ["s46_cases", "s46_batches", "s46_jobs", "s46_source_versions", "s46_source_checks", "s46_source_observations", "s46_field_receipts", "s46_artifacts", "s46_events"]) assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
console.log("s46 manual intake contract: pass");
