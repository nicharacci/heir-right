import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readArtifactDist, readArtifactSource } from "./helpers/artifact-source.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readArtifactSource();
const dist = readArtifactDist();

for (const html of [source, dist]) {
  assert.match(html, /data-queue-export[^>]*>[\s\S]*Export combined PDF/);
  assert.match(html, /chooseExportRoute\("pdf", event\.currentTarget, actionRows\)/);
  assert.match(html, /if \(route === "pdf"\) return \[\]/);
  assert.match(html, /expectedArtifact: "single_pdf"/);
  assert.match(html, /data-queue-remove=/);
  assert.match(html, /Download PDF/);
  assert.match(html, /Download latest PDF/);
  assert.doesNotMatch(html, /demoRows\.slice\(0, 2\)\.forEach\(\(row\) => state\.queueIds\.add\(row\.id\)\)/);
  assert.match(html, /async function verifyPacketArtifact/);
  assert.match(html, /The stored packet did not pass artifact identity, hash, and content readback/);
  assert.match(html, /\/api\/documents\/attachments/);
  assert.match(html, /Remove supporting file/);
  assert.match(html, /method: "DELETE"/);
  assert.match(html, /data-upload-idi-report/);
  assert.match(html, /data-idi-report-file/);
  assert.match(html, />Upload IDI Report</);
  assert.match(html, /data-document-preview-card/);
  assert.match(html, /function safeDossierPreviewSrcdoc/);
  assert.match(html, /async function importIdiReportFile/);
  assert.match(html, /documentId: "idi-asset-search"/);
  assert.match(html, /\/api\/discovery\/idi-asset-search\/extract/);
  assert.match(html, /await runFullDiscovery\(row, null, "discovery", \{ correctionNote: replacementReason \}\)/);
  assert.match(html, /high-confidence contact/);
  assert.match(html, /\/api\/workspace\/state/);
  assert.match(html, /let safeValue = workspaceSafeStateText\(key, payload\.value\)/);
  assert.match(html, /storageSetItem\(key, safeValue, \{ sync: false \}\)/);
  assert.match(html, /ChatGPT Work/);
  assert.match(html, /data-prepare-chatgpt-work/);
  assert.match(html, /data-open-chatgpt-work/);
  assert.match(html, /async function copyPlainTextToClipboard/);
  assert.doesNotMatch(html, /saveDocumentFile\(doc\.id, null, "generated"\)/);
  assert.doesNotMatch(html, /source:\s*"s28-product-loop-proof"|source:\s*"s29-generated-docprep-packet"/);
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
assert.match(fullDiscoveryRun, /const savedSourceResult = verifiedSourceCaptureResult\(row\)/, "Packet streaming must inspect the current estate for a verified saved source capture.");
assert.match(fullDiscoveryRun, /savedSourceResult[\s\S]*\? \{ ok: true, result: savedSourceResult, reused: true \}[\s\S]*: await runAutonomousDiscoverySources\(row\)/, "Packet streaming must reuse verified saved source evidence instead of running the public sources twice.");
assert.match(source, /function verifiedSourceCaptureResult\(row = selectedRow\(\)\)[\s\S]*!capture\.dossier[\s\S]*configuredSourceRunVerified !== true[\s\S]*sourceRun\.persistence\?\.stored !== true[\s\S]*sourceRun\.persistence\?\.readbackStatus !== "verified"[\s\S]*!Array\.isArray\(capture\.sourceFacts\)/, "Only a dossier refreshed from a verified configured run and shared readback may bypass another public-source search.");
assert.match(fullDiscoveryRun, /Verified Discovery sources reused[\s\S]*saved public-source capture passed shared Discovery File readback/, "The operator audit stream must disclose source reuse.");
assert.match(fullDiscoveryRun, /Sample estates stay isolated from production source runs and packet export/, "Sample estates must not invoke production source runs.");
assert.match(fullDiscoveryRun, /result\.persistence\?\.readbackStatus !== "verified"/, "Discovery must stop when shared storage readback is not verified.");
assert.match(fullDiscoveryRun, /fetch\(`\/api\/discovery\/file\?estateId=/, "Opening Doc Prep must hydrate the team-persisted Discovery File.");
assert.match(source, /browserbase\\b\.\*\\b\(\?:billing\|payment\|402\)/, "A Browserbase billing response must remain visible to the operator instead of being masked by a generic tax-receipt instruction.");

assert.match(source, /if \(!state\.selectedId && preferredCrmRow\)/, "Background workspace hydration must preserve an estate the operator has already opened.");

const chatgptWorkBrief = source.slice(
  source.indexOf("function chatgptWorkBrief"),
  source.indexOf("function chatgptWorkHandoffHtml"),
);
assert.match(chatgptWorkBrief, /verified PDF as the source of truth/);
assert.match(chatgptWorkBrief, /Do not contact anyone, spend money, alter a CRM, create a legal document, or make any external change/);
assert.doesNotMatch(chatgptWorkBrief, /importedText|candidates|accessToken|refreshToken/, "ChatGPT Work handoff must use the verified packet reference, never raw IDI content or credentials.");
const chatgptWorkContinuation = source.slice(
  source.indexOf("async function openChatgptWorkHandoff"),
  source.indexOf("let documentActionModalInvoker"),
);
assert.match(chatgptWorkContinuation, /window\.location\.assign\("https:\/\/chatgpt\.com\/"\)/, "The Work handoff must continue to ChatGPT in the current browser tab after the verified brief is copied.");
assert.doesNotMatch(chatgptWorkContinuation, /window\.open|_blank/, "The Work handoff must not depend on an unobservable popup or new browser tab.");
const safePreview = source.slice(
  source.indexOf("function safeDossierPreviewSrcdoc"),
  source.indexOf("function assetStepStatusHtml"),
);
assert.match(safePreview, /new DOMParser\(\)\.parseFromString/);
assert.match(safePreview, /script, noscript, iframe, object, embed, base, form/);
assert.match(safePreview, /name\.startsWith\("on"\)/);
assert.match(safePreview, /javascript\|vbscript/);

const closingRoute = fs.readFileSync(path.resolve(here, "../../worker/src/cloudflare.ts"), "utf8");
const idiExtractRoute = fs.readFileSync(path.resolve(here, "../server/idi-extract-handler.js"), "utf8");
assert.match(idiExtractRoute, /mode: "uploaded_file"/);
assert.match(idiExtractRoute, /extractPdf/);
assert.match(idiExtractRoute, /mammoth\.extractRawText/);
assert.match(idiExtractRoute, /parseCsv/);
assert.match(closingRoute, /buildClosingPacketModel\(packetDossiers, closingPacketOptions\)/);
assert.match(closingRoute, /await renderPacketPdf\(model\)/, "Closing packet must pass immutable-template layout preflight before storage or delivery.");
assert.doesNotMatch(closingRoute, /\[NEEDS REVIEW\]|Draft - Review Required|approved legal template files and designated fill-field map are not installed/);
assert.match(source, /selectedClosingTemplateIdsByEstate/);
assert.match(source, /closingFieldValuesByEstate/);
assert.match(source, /data-closing-template/);
assert.match(source, /Generate Closing PDF/);
assert.doesNotMatch(source, /data-export-closing-google|Export to Google Workspace/);

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
    "discovery_requires_shared_storage_readback",
    "docprep_hydrates_team_discovery_file",
    "browserbase_billing_blocker_is_operator_visible",
    "single_and_batch_download_actions",
    "single_pdf_api_contract",
    "closing_uses_immutable_legal_templates",
    "closing_forms_are_selected_per_estate",
    "closing_batch_carries_per_estate_fields",
    "generated_documents_require_verified_artifact_readback",
    "supporting_documents_use_backend_storage",
    "idi_report_upload_is_extracted_and_starts_discovery",
    "idi_upload_is_labeled_and_right_action_ready",
    "document_cards_open_the_dossier_preview",
    "chatgpt_work_handoff_uses_verified_packet_only",
    "legacy_fake_document_seeds_removed",
    "production_workspace_state_is_team_shared",
  ],
}, null, 2));
