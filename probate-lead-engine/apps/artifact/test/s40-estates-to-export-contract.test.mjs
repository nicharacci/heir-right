import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const read = (relativePath) => fs.readFileSync(path.join(artifactRoot, relativePath), "utf8");

const html = read("src/index.html");
const legacy = read("src/legacy/app.js");
const estates = read("src/features/data-grid/estates-grid.js");
const docPrepRegister = read("src/features/doc-prep/register.js");
const docPrepView = read("src/features/doc-prep/s40-doc-prep-view.js");
const docPrepCss = read("src/features/doc-prep/s40-doc-prep.css");
const shellCss = read("src/features/shell/shell.css");
const legacyCss = read("src/styles/legacy.css");
const exportView = read("src/features/estate-export/export-view.js");
const exportRegister = read("src/features/estate-export/register.js");
const shellView = read("src/features/shell/shell-view.js");
const shellController = read("src/features/shell/shell-controller.js");

const nav = [...html.matchAll(/data-shell-nav="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(nav.slice(0, 4), ["find-estates", "dossiers", "export", "drips"]);
assert.doesNotMatch(nav.join(" "), /home|queue/i, "the primary loop must not expose Home or a duplicate Queue tab");
assert.equal(nav[0], "find-estates");
assert.equal(nav.filter((view) => view === "dashboard").length, 1, "Manage Estates must retain one legacy dashboard route");
assert.match(html, /data-hover-label="Manage Estates"/);
assert.match(html, /<span class="nav-label">Manage Estates<\/span>/);
assert.doesNotMatch(html, /data-hover-label="Dashboard"/);
assert.match(html, /<section class="app" data-active-view="find-estates"/);
assert.match(html, /data-view-panel="export"/);
assert.match(html, /data-drawer-mode="activity"/);
assert.match(shellCss, /agent-drawer\[data-drawer-mode="activity"\]/);
assert.match(shellCss, /agent-drawer\[data-drawer-mode="admin"\]/);
assert.ok(legacyCss.includes("grid-template-columns: minmax(0, 7fr) minmax(18rem, 3fr)"));
assert.ok(legacyCss.includes("#adminView .admin-tall-grid > .loop-panel:nth-child(1) { display: none; }"));

for (const state of ["active", "queued", "processing", "completed-awaiting-export", "exported", "blocked"]) {
  assert.match(legacy, new RegExp(`"${state}"`), `missing persisted lifecycle state: ${state}`);
}
assert.match(legacy, /heirright:estate-workflow-state/);
assert.match(legacy, /function setEstateWorkflowState/);
assert.match(legacy, /estateWorkflowTransitions/);
assert.match(legacy, /function queueEstatesForDocPrep/);
assert.match(legacy, /function ensureS40WorkflowStateReady/);
assert.match(legacy, /await ensureS40WorkflowStateReady\(\)/);
assert.match(legacy, /requestedIds\s*\.map\(\(estateId\) => \[estateId, rowById\(estateId\)\]\)/);
assert.match(legacy, /function runS40DocPrep/);
assert.match(legacy, /function exportS40Handoff/);
assert.match(legacy, /s40-queue-estates/);
assert.match(legacy, /s40-run-docprep/);
assert.match(legacy, /s40-approve-packet/);
assert.match(legacy, /s40-export-handoff/);
assert.match(legacy, /exportEligible/);
assert.match(legacy, /readbackStatus === "verified"/);
assert.match(legacy, /linkGeneratedDocPrepPackets\(row, "discovery"/);
assert.match(legacy, /verifyGeneratedPacketAuditReadback\(row, "discovery"\)/);
const s40RunBody = legacy.slice(legacy.indexOf("async function runS40DocPrep"), legacy.indexOf("async function exportS40Handoff"));
assert.doesNotMatch(s40RunBody, /runAutonomousDiscoverySources|external-source-run|live_idi_core/i, "the S40 run must consume persisted evidence and avoid new provider runs");

assert.match(estates, /function activeEstateRows/);
assert.match(estates, /workflowState === "active"/);
assert.match(estates, /s40-queue-estates/);
assert.doesNotMatch(estates, /bridge\.dispatch\("export", \{ route: "queue"/);

assert.match(docPrepRegister, /s40-doc-prep/);
assert.match(docPrepRegister, /s40-doc-prep-view/);
assert.doesNotMatch(docPrepRegister, /docPrepRail|renderDocPrepView/);
assert.match(docPrepView, /s40-workbench/);
assert.match(docPrepView, /data-community-grid="docprep"/);
assert.match(docPrepView, /selectionMode: "multi"/);
assert.match(docPrepView, /data-s40-run/);
assert.match(docPrepView, /data-s40-export/);
assert.match(docPrepView, /iframe/);
assert.match(docPrepView, /Verified internal PDF/);
assert.match(docPrepView, /s40-stage-issue/);
assert.match(docPrepCss, /grid-template-columns: minmax\(0, 30%\) minmax\(0, 70%\)/);
assert.match(docPrepCss, /\.s40-docprep-empty > \.s40-workbench/);
assert.match(docPrepCss, /max-width: none/);
assert.match(docPrepCss, /@media \(max-width: 700px\)/);
assert.match(docPrepCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(docPrepCss, /#researchRail/);
assert.match(docPrepView, /data-s40-approve/);
assert.match(docPrepView, /data-approve-packet/);
assert.match(docPrepView, /packetApproved/);

assert.match(exportRegister, /id: "s40-estate-export"/);
assert.match(exportRegister, /id: "export"/);
assert.match(exportView, /createCommunityGrid/);
assert.match(exportView, /workflowState === "exported"/);
assert.match(exportView, /Verified readback/);
assert.match(shellView, /dashboard: "Manage Estates"/);
assert.match(shellView, /Go to Manage Estates/);
assert.match(shellController, /Manage Estates opened/);

for (const source of [legacy, estates, docPrepView, exportView]) {
  assert.doesNotMatch(source, /BEUI_PRO_TOKEN|process\.env\.[A-Z0-9_]*TOKEN|client secret|access token/i);
}

console.log("S40 Estates-to-Export contract passed.");
