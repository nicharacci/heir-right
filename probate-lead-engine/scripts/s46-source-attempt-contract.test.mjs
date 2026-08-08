import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const core = await readFile(new URL("../apps/worker/src/s46-core.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../apps/worker/src/s46-discovery-worker.ts", import.meta.url), "utf8");
for (const source of ["idi_core", "idi_contacts", "property_appraiser", "tax_collector", "official_records", "direct_obituary"]) assert.match(core, new RegExp(`"${source}"`));
for (const outcome of ["found", "checked_not_found", "unattempted", "unconfigured", "blocked", "provider_failed", "identity_mismatch", "conflict", "retry_exhausted"]) assert.match(core, new RegExp(`"${outcome}"`));
assert.match(worker, /identity_mismatch:property_appraiser/);
assert.match(worker, /search results cannot prove/i);
console.log("s46 source attempt contract: pass");
