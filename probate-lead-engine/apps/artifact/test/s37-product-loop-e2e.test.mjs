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
assert.match(source, /const seenEstates = new Set\(\)/, "Fresh provider reruns must be deduplicated before the Estates table and Queue render.");
assert.match(source, /`parcel:\$\{parcel\}`[\s\S]*`address:\$\{address\}`/, "Estate dedupe must prefer folio and fall back to property address.");

const latestRunRows = source.slice(
  source.indexOf("function buildRows(data, dossier)"),
  source.indexOf("function selectedRow()"),
);
assert.match(latestRunRows, /id: "estate"/);
assert.doesNotMatch(latestRunRows, /id: "lead-report"|id: "property-title"|id: "outreach-prep"/, "Internal artifacts must remain inside one estate workflow instead of rendering as duplicate estate rows.");

const fullDiscoveryRun = source.slice(
  source.indexOf("async function runAutonomousDiscoverySources"),
  source.indexOf("function toggleFullDiscoveryRun"),
);
assert.match(fullDiscoveryRun, /postJson\("\/api\/discovery\/external-source-run", externalSourceRunPayload\(row, capture, key\)\)/, "Run Full Discovery must invoke the source orchestrator from the selected estate facts.");
assert.match(fullDiscoveryRun, /await runAutonomousDiscoverySources\(row\)/, "Packet streaming must wait for the source run result.");
assert.match(fullDiscoveryRun, /Sample estates stay isolated from production source runs and packet export/, "Sample estates must not invoke production source runs.");

const closingRoute = fs.readFileSync(path.resolve(here, "../../worker/src/cloudflare.ts"), "utf8");
assert.match(closingRoute, /approved legal template files and designated fill-field map are not installed/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "queue_requires_deliberate_user_selection",
    "queue_generates_combined_pdf",
    "queued_estate_can_be_removed",
    "fresh_estate_reruns_are_deduplicated",
    "latest_run_renders_one_estate_row",
    "full_discovery_invokes_source_orchestrator",
    "sample_estates_cannot_run_sources",
    "single_and_batch_download_actions",
    "single_pdf_api_contract",
    "closing_requires_immutable_legal_templates",
  ],
}, null, 2));
