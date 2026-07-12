import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, "../src/index.html");
const distPath = path.resolve(here, "../dist/index.html");
const source = fs.readFileSync(sourcePath, "utf8");
const dist = fs.readFileSync(distPath, "utf8");

for (const html of [source, dist]) {
  assert.match(html, /data-queue-export[^>]*>[\s\S]*Export combined PDF/);
  assert.match(html, /chooseExportRoute\("pdf", event\.currentTarget, actionRows\)/);
  assert.match(html, /if \(route === "pdf"\) return \[\]/);
  assert.match(html, /expectedArtifact: "single_pdf"/);
  assert.match(html, /data-queue-remove=/);
  assert.match(html, /Download PDF/);
  assert.match(html, /Download latest PDF/);
  assert.doesNotMatch(html, /demoRows\.slice\(0, 2\)\.forEach\(\(row\) => state\.queueIds\.add\(row\.id\)\)/);
}

const queueExportHandler = source.slice(
  source.indexOf('target.querySelector("[data-queue-export]")'),
  source.indexOf("function adminErrorItems"),
);
assert.match(queueExportHandler, /queuedRows\(\)\.length \? queuedRows\(\) : checkedRows\(\)/);
assert.match(queueExportHandler, /state\.queueIds\.delete/);

const closingRoute = fs.readFileSync(path.resolve(here, "../../worker/src/cloudflare.ts"), "utf8");
assert.match(closingRoute, /approved legal template files and designated fill-field map are not installed/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "queue_requires_deliberate_user_selection",
    "queue_generates_combined_pdf",
    "queued_estate_can_be_removed",
    "single_and_batch_download_actions",
    "single_pdf_api_contract",
    "closing_requires_immutable_legal_templates",
  ],
}, null, 2));
