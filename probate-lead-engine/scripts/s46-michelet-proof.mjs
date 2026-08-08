import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const base = process.env.S46_SANDBOX_URL;
const token = process.env.S46_INTERNAL_API_TOKEN;
const sourcePath = process.env.S46_MICHELET_PDF_PATH;
if (!base || !token || !sourcePath) throw new Error("S46_SANDBOX_URL, S46_INTERNAL_API_TOKEN, and S46_MICHELET_PDF_PATH are required");
const form = new FormData();
const bytes = await readFile(sourcePath);
form.append("file", new Blob([bytes], { type: "application/pdf" }), basename(sourcePath));
const idempotencyKey = process.env.S46_MICHELET_IDEMPOTENCY_KEY || `s46-michelet-${Date.now()}`;
const response = await fetch(`${base}/s46/discovery/runs`, { method: "POST", headers: { authorization: `Bearer ${token}`, "Idempotency-Key": idempotencyKey }, body: form });
const created = await response.json();
if (!response.ok) throw new Error(`intake_failed:${response.status}:${created.error || "unknown"}`);
let state;
for (let attempt = 0; attempt < 120; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const statusResponse = await fetch(`${base}/s46/discovery/runs/${created.jobId}`, { headers: { authorization: `Bearer ${token}` } });
  state = await statusResponse.json();
  if (["completed", "failed"].includes(state.job?.status)) break;
}
console.log(JSON.stringify({ caseId: created.caseId, jobId: created.jobId, status: state?.job?.status, errorCode: state?.job?.error_code || null, sourceChecks: state?.sourceChecks?.map((check) => ({ source: check.source_name, outcome: check.outcome, attempts: check.attempt_count })) || [], artifact: state?.artifact || null }));
if (state?.job?.status !== "completed") process.exitCode = 2;
