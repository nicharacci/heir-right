import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/s41-cloud-smoke.mjs"], { encoding: "utf8", env: { ...process.env, PROCESS_API_URL: "" } });
assert.notEqual(result.status, 0);
assert.match(result.stderr, /PROCESS_API_URL is required/);
console.log(JSON.stringify({ ok: true, checks: ["cloud-smoke-refuses-without-explicit-target"] }));
