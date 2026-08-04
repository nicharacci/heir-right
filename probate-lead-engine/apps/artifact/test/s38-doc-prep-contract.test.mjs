import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { build as esbuildBuild } from "esbuild";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const sourceRoot = path.join(artifactRoot, "src");
const repoRoot = path.resolve(artifactRoot, "../..");
const require = createRequire(import.meta.url);
const { buildConnectionStatuses } = require("../api/connections/status.js");

function read(relativePath) {
  return fs.readFileSync(path.join(artifactRoot, relativePath), "utf8");
}

function readTree(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return readTree(target);
    return /\.(?:css|js|json|mjs)$/.test(entry.name) ? fs.readFileSync(target, "utf8") : "";
  }).join("\n");
}

async function importBundled(relativePath) {
  const result = await esbuildBuild({
    entryPoints: [path.join(sourceRoot, relativePath)],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
    logLevel: "silent",
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Date.now()}-${Math.random()}`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function snapshotFor(estateId = "estate-contract") {
  const now = Date.now();
  return {
    activeView: "dossiers",
    selectedEstateId: estateId,
    selectedEstate: {
      id: estateId,
      title: "Estate of Morgan Reyes",
      address: "121 Probate Way",
      county: "Broward",
    },
    estates: [
      {
        id: estateId,
        title: "Estate of Morgan Reyes",
        address: "121 Probate Way",
        county: "Broward",
        status: "Review",
        source: "Probate filing",
        nextAction: "Prepare Discovery",
        evidence: 4,
        evidenceTotal: 6,
      },
      {
        id: "estate-second",
        title: "Estate of Lee Rivera",
        address: "34 Palm Avenue",
        county: "Miami-Dade",
        status: "Move Forward",
        source: "County record",
        nextAction: "Review packet",
        evidence: 6,
        evidenceTotal: 6,
      },
    ],
    queueIds: [estateId],
    session: { canAdminister: true, authenticated: true, user: { email: "admin@example.test" } },
    connections: [{ id: "google-workspace", label: "Google Workspace", mode: "connected" }],
    activity: [{ title: "Estate selected", copy: "Discovery is ready.", tone: "ready", updatedAt: now - 5_000 }],
    docPrep: {
      flow: "discovery",
      progress: 100,
      currentPhase: "Ready for review",
      complete: true,
      packetVerified: true,
      packetApproved: true,
      packetRevision: 1,
      packetHistory: [{
        packetRevision: 1,
        artifactId: "packet-contract-1",
        generatedAt: new Date(now - 30_000).toISOString(),
        generatedBy: "admin@example.test",
        correctionNote: "Corrected the probate filing date.",
        readbackStatus: "verified",
      }],
      googleDelivered: false,
      googleDestination: "",
      googleHandoffReady: true,
      googleHandoffDestination: "Discovery Packets / Estate of Morgan Reyes",
      sourceCapture: {
        propertyAppraiser: {
          owner: "Morgan Reyes",
          folio: "01-0000-000-0000",
          address: "121 Probate Way",
          mailingAddress: "PO Box 121",
          sourceUrl: "https://county.example.test/property/01-0000-000-0000",
        },
        taxReceipt: {
          status: "browser_workflow_required",
          sourceBlockedReason: "The county receipt needs an interactive browser review.",
        },
        sourceApiRun: {
          generatedAt: new Date(now - 45_000).toISOString(),
          blockers: ["The county receipt needs an interactive browser review."],
          persistence: { stored: true, readbackStatus: "verified" },
        },
      },
      packet: {
        artifactId: "packet-contract-1",
        artifactUrl: "/api/reports/pdf?artifactId=packet-contract-1",
        contentHash: "parent-hash",
        fileName: "Discovery Packet - Morgan Reyes.pdf",
      },
      attachments: [{
        id: "obituary-evidence",
        label: "Obituary",
        source: "Public obituary",
        step: "Back Story",
        href: "https://example.test/morgan-reyes-obituary",
        fileName: "",
        fileKind: "link",
        capturedAt: new Date(now - 90_000).toISOString(),
        reviewFlags: [],
        downloadable: false,
      }],
      automation: { status: "exported" },
      documents: [
        {
          id: "idi-asset-search",
          title: "IDI Core Report",
          description: "Operator-approved source report.",
          status: "Verified",
          source: "IDI Core upload",
          updatedAt: now - 60_000,
          hasVerifiedFile: true,
          artifactId: "idi-contract-1",
          artifactUrl: "/api/documents/attachments?artifactId=idi-contract-1",
          contentHash: "idi-hash",
          fileName: "Morgan Reyes IDI Report.pdf",
          selected: true,
          fileSource: "",
          workflowStatus: "complete",
        },
        {
          id: "supporting-affidavit",
          title: "Supporting affidavit",
          description: "Estate supporting document.",
          status: "Verified",
          source: "Operator upload",
          updatedAt: now - 120_000,
          hasVerifiedFile: true,
          artifactId: "support-contract-1",
          artifactUrl: "/api/documents/attachments?artifactId=support-contract-1",
          contentHash: "support-hash",
          fileName: "Supporting affidavit.pdf",
          selected: false,
          fileSource: "supporting_document",
          workflowStatus: "complete",
        },
      ],
    },
  };
}

function bridgeFor(snapshot, overrides = {}) {
  return {
    readState: () => snapshot,
    selectedEstateId: () => snapshot.selectedEstateId,
    escapeHtml,
    icon: () => "",
    navigate: () => {},
    emit: () => {},
    dispatch: async () => snapshot,
    ...overrides,
  };
}

function railActionNames(html) {
  return [...html.matchAll(/data-rail-action="([^"]+)"/g)].map((match) => match[1]);
}

function addShellEventCalls(source) {
  const calls = [];
  const marker = "addShellEvent(";
  let cursor = 0;
  while ((cursor = source.indexOf(marker, cursor)) >= 0) {
    const start = cursor;
    let depth = 0;
    let quote = "";
    let escaped = false;
    for (let index = cursor + marker.length - 1; index < source.length; index += 1) {
      const character = source[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
        continue;
      }
      if (character === '"' || character === "'" || character === "`") {
        quote = character;
        continue;
      }
      if (character === "(") depth += 1;
      if (character !== ")") continue;
      depth -= 1;
      if (depth === 0) {
        calls.push(source.slice(start, index + 1));
        cursor = index + 1;
        break;
      }
    }
  }
  return calls;
}

const [viewModule, railModule, uploadModule, timelineModule, rowModule, estatesModule, queueModule, adminModule, focusModule, connectionModule] = await Promise.all([
  importBundled("features/doc-prep/doc-prep-view.js"),
  importBundled("features/doc-prep/doc-prep-rail.js"),
  importBundled("features/doc-prep/idi-upload-control.js"),
  importBundled("features/doc-prep/automation-timeline.js"),
  importBundled("features/doc-prep/document-row.js"),
  importBundled("features/data-grid/estates-grid.js"),
  importBundled("features/data-grid/queue-grid.js"),
  importBundled("features/data-grid/admin-audit-grid.js"),
  importBundled("ui/focus-containment.js"),
  importBundled("core/public-connection.js"),
]);

{
  const realGoogleStatus = buildConnectionStatuses({}, { freshBatchExists: false, latestRunExists: false })
    .find((connection) => connection.name === "Google");
  const publicGoogle = connectionModule.normalizePublicConnection(realGoogleStatus);
  assert.deepEqual(publicGoogle, { id: "google", label: "Google", mode: "blocked" });
}

{
  const snapshot = snapshotFor();
  const html = viewModule.renderDocPrepView({ bridge: bridgeFor(snapshot) });
  const runIndex = html.indexOf("data-run-discovery");
  const sourceIndex = html.indexOf("data-run-public-sources");
  const uploadIndex = html.indexOf("data-idi-picker");
  assert.ok(sourceIndex > -1 && uploadIndex > sourceIndex, "Public source review must be available before the optional IDI upload");
  assert.ok(uploadIndex > -1 && runIndex > uploadIndex, "Replace IDI Report must precede the Discovery rerun action");
  assert.match(html, /data-feature="doc-prep" data-estate-id="estate-contract"/);
  assert.match(html, /aria-label="Run configured public sources for Estate of Morgan Reyes"/);
  assert.match(html, />Run Public Sources<\/span>/);
  assert.match(html, /class="hr-upload-command hr-idi-report-command"/);
  assert.match(html, /aria-label="Replace IDI Report for Estate of Morgan Reyes"/);
  assert.match(html, /Replace IDI Report/);
  assert.match(html, /accept="\.pdf,\.docx,application\/pdf,application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document"/);
  assert.doesNotMatch(html, /\.csv|\.doc(?:[,"])/i);
  assert.match(html, /data-local-packet-complete/);
  assert.match(html, /Google Workspace is an optional handoff and can be set up afterward/);
  assert.match(html, /data-start-cloud-docprep/);
  assert.doesNotMatch(html, /data-export-cloud-docprep/, "Google Drive delivery must stay unavailable until the cloud PDF is verified");
  assert.match(html, /Cloud packet not started/);
  assert.match(html, /Browser controls never own its progress/);
  assert.equal((html.match(/class="hr-document-row"/g) || []).length, 2);
  assert.match(html, /class="hr-document-row"[\s\S]*role="button"[\s\S]*tabindex="0"/);
  assert.doesNotMatch(html, /class="hr-document-list"[^>]*role="list"/);
  assert.match(html, /Verified[\s\S]*IDI Core upload[\s\S]*Updated 1 min ago/);
  assert.match(html, /<button id="hrDocPrepFlowDiscovery"[^>]*tabindex="0"[^>]*aria-selected="true"/);
  assert.match(html, /<button id="hrDocPrepFlowClosing"[^>]*tabindex="-1"[^>]*aria-selected="false"/);
  assert.match(html, /role="tablist"[^>]*aria-orientation="horizontal"/);

  const productionSnapshot = structuredClone(snapshot);
  productionSnapshot.estates.unshift({
    id: "estate",
    title: "Bundled dry-run fixture",
    address: "Fixture address",
  });
  const productionHtml = viewModule.renderDocPrepView({ bridge: bridgeFor(productionSnapshot) });
  assert.doesNotMatch(productionHtml, /<option value="estate"/, "the bundled dry-run fixture must not leak into Document Prep when imported estates exist");
  assert.match(productionHtml, /<option value="estate-contract" selected>/, "the selected imported estate must remain available after fixture filtering");

  const dryRunSnapshot = structuredClone(snapshot);
  dryRunSnapshot.selectedEstateId = "estate";
  dryRunSnapshot.selectedEstate = { ...dryRunSnapshot.selectedEstate, id: "estate" };
  dryRunSnapshot.estates = [{
    id: "estate",
    title: "Bundled dry-run fixture",
    address: "Fixture address",
  }];
  const dryRunHtml = viewModule.renderDocPrepView({ bridge: bridgeFor(dryRunSnapshot) });
  assert.match(dryRunHtml, /<option value="estate" selected>/, "the bundled estate must remain available as the sole dry-run fallback");

  const firstImportSnapshot = structuredClone(snapshot);
  firstImportSnapshot.docPrep.documents = firstImportSnapshot.docPrep.documents.filter((document) => document.id !== "idi-asset-search");
  const firstImportHtml = viewModule.renderDocPrepView({ bridge: bridgeFor(firstImportSnapshot) });
  assert.match(firstImportHtml, /aria-label="Upload IDI Report for Estate of Morgan Reyes"/);
  assert.match(firstImportHtml, />Upload IDI Report<\/span>/);

  const moveOnSnapshot = structuredClone(snapshot);
  moveOnSnapshot.selectedEstate.owner = "Sample Property Holdings LLC";
  moveOnSnapshot.selectedEstate.stopReasonCodes = ["COMPANY_OWNER"];
  const moveOnHtml = viewModule.renderDocPrepView({ bridge: bridgeFor(moveOnSnapshot) });
  assert.match(moveOnHtml, /Move On[\s\S]*data-open-estates[\s\S]*Review Next Estate/);
  assert.doesNotMatch(moveOnHtml, />Disposition</, "the retired Document Prep eyebrow header must not return");
  assert.doesNotMatch(moveOnHtml, /data-run-public-sources|data-run-discovery|data-idi-picker|data-idi-file-input|data-open-completion-actions/, "Move On must hide source review, Discovery, IDI upload, and completion work controls");
  assert.match(moveOnHtml, /class="hr-document-row"[\s\S]*role="button"[\s\S]*tabindex="0"/, "stopped estate documents must remain keyboard-selectable for truthful context");

  const stoppedRailMarkup = [
    railModule.renderAutomationRail({ bridge: bridgeFor(moveOnSnapshot), snapshot: moveOnSnapshot }),
    railModule.renderDocumentRail({ bridge: bridgeFor(moveOnSnapshot), snapshot: moveOnSnapshot }),
    railModule.renderCompletionRail({ bridge: bridgeFor(moveOnSnapshot), snapshot: moveOnSnapshot }),
  ];
  for (const markup of stoppedRailMarkup) {
    assert.match(markup, /data-docprep-move-on-stop[\s\S]*Disposition[\s\S]*Move On[\s\S]*data-rail-action="review-next-estate"[\s\S]*Review Next Estate/);
    assert.doesNotMatch(markup, /open-document|download-document|replace-document|queue-document|open-packet|download-packet|chatgpt-work|deliver-google-packet|google-settings/, "a row-selected Move On estate must not regain document, packet, or handoff commands through another rail tab");
  }
  let stoppedNavigation = "";
  await railModule.docPrepRail.actions["review-next-estate"]({
    bridge: bridgeFor(moveOnSnapshot, { navigate: (view) => { stoppedNavigation = view; } }),
  });
  assert.equal(stoppedNavigation, "find-estates", "the stopped rail must retain one safe route to the next estate");
}

{
  const estateId = `estate-source-run-${Date.now()}`;
  const snapshot = snapshotFor(estateId);
  const calls = [];
  const events = [];
  let refreshes = 0;
  const result = await viewModule.startPublicSourceSearch({
    bridge: bridgeFor(snapshot, {
      dispatch: async (command, payload) => {
        calls.push({ command, payload });
        return { persistence: { readbackStatus: "verified" } };
      },
      emit: (...args) => events.push(args),
    }),
    snapshot,
    refresh: () => { refreshes += 1; },
  });
  assert.deepEqual(calls, [{
    command: "run-source-search",
    payload: { estateId },
  }]);
  assert.equal(result.persistence.readbackStatus, "verified");
  assert.equal(events[0][0], "Public source review finished");
  assert.equal(refreshes, 1);

  await assert.rejects(
    viewModule.startPublicSourceSearch({
      bridge: bridgeFor(snapshot, {
        dispatch: async () => { throw new Error("County source unavailable."); },
        emit: (...args) => events.push(args),
      }),
      snapshot,
      refresh: () => { refreshes += 1; },
    }),
    /County source unavailable/,
  );
  assert.equal(events.at(-1)[0], "Public source review needs attention");
  assert.equal(events.at(-1)[2], "blocked");
  assert.equal(refreshes, 2, "the source control must refresh after success and failure");
}

{
  const estateId = `estate-closing-${Date.now()}`;
  const snapshot = snapshotFor(estateId);
  snapshot.docPrep.flow = { id: "closing-docs", label: "Closing Prep", title: "Closing Prep" };
  snapshot.docPrep.complete = false;
  snapshot.docPrep.packetVerified = false;
  snapshot.docPrep.progress = 25;
  snapshot.docPrep.currentPhase = { id: "title-clearance", label: "Title clearance", source: "Reviewed Discovery file" };
  snapshot.docPrep.automation = {
    status: "writing",
    sections: [
      { id: "closing-intake", title: "Closing intake", status: "complete" },
      { id: "title-clearance", title: "Title clearance", status: "writing" },
      { id: "seller-approval", title: "Seller approval", status: "pending" },
    ],
  };
  snapshot.docPrep.documents = snapshot.docPrep.documents.filter((document) => document.id !== "idi-asset-search");
  const bridge = bridgeFor(snapshot);
  const html = viewModule.renderDocPrepView({ bridge });
  assert.match(html, /data-docprep-flow="discovery"/);
  assert.match(html, /data-docprep-flow="closing-docs"/);
  assert.match(html, /id="hrDocPrepFlowClosing"[\s\S]*aria-selected="true"/);
  assert.match(html, /<button id="hrDocPrepFlowDiscovery"[^>]*tabindex="-1"/);
  assert.match(html, /<button id="hrDocPrepFlowClosing"[^>]*tabindex="0"/);
  assert.match(html, /Prepare the Closing packet/);
  assert.match(html, /Closing Prep running/);
  assert.doesNotMatch(html, /data-idi-picker|data-idi-file-input|Upload IDI Report/);

  const state = uploadModule.uiStateFor(estateId, snapshot);
  let runPayload = null;
  await uploadModule.startDiscovery({
    bridge: bridgeFor(snapshot, {
      dispatch: async (command, payload) => {
        assert.equal(command, "run-discovery");
        runPayload = payload;
        return snapshot;
      },
    }),
    snapshot,
    state,
    refresh: () => {},
  });
  assert.deepEqual(runPayload, { estateId, flowId: "closing-docs" });

  const automationRail = railModule.renderAutomationRail({ bridge, snapshot });
  assert.match(automationRail, /Closing Prep timeline/);
  assert.match(automationRail, /Closing intake[\s\S]*Title clearance[\s\S]*Seller approval/);
  assert.doesNotMatch(automationRail, /Upload received|IDI facts linked/);
  const completionRail = railModule.renderCompletionRail({ bridge, snapshot });
  assert.match(completionRail, /Finish Closing Prep first/);
  assert.doesNotMatch(completionRail, /Continue in ChatGPT Work/);
  assert.doesNotMatch(completionRail, /open-packet|download-packet/, "packet controls must stay hidden until the current revision is verified");

  assert.equal(viewModule.nextDocPrepFlowIndex(0, "ArrowRight", 2), 1);
  assert.equal(viewModule.nextDocPrepFlowIndex(1, "ArrowRight", 2), 0);
  assert.equal(viewModule.nextDocPrepFlowIndex(0, "ArrowLeft", 2), 1);
  assert.equal(viewModule.nextDocPrepFlowIndex(1, "Home", 2), 0);
  assert.equal(viewModule.nextDocPrepFlowIndex(0, "End", 2), 1);
  assert.equal(viewModule.nextDocPrepFlowIndex(0, "Enter", 2), null);
}

{
  assert.deepEqual(
    timelineModule.automationStages.map((stage) => stage.label),
    [
      "Upload received",
      "Saved report verified",
      "Report extracted",
      "IDI facts linked",
      "Discovery running",
      "Packet verified",
      "Ready for review",
    ],
  );
  assert.ok(timelineModule.automationStages.every((stage) => !/server-side|provenance|artifact|storage readback/i.test(stage.copy)), "timeline guidance must use operator language");
  const failed = timelineModule.timelineState(snapshotFor(), {
    completedStages: ["upload-received", "secure-readback"],
    failedStage: "report-extracted",
    runStarted: true,
  });
  assert.equal(failed.find((stage) => stage.id === "report-extracted").state, "failed");
  assert.equal(failed.find((stage) => stage.id === "packet-verified").state, "pending");
  assert.equal(failed.find((stage) => stage.id === "ready-for-review").state, "pending");
}

{
  const snapshot = snapshotFor("crm:csv:S38-ALICIA-001");
  snapshot.docPrep.progress = 57;
  snapshot.docPrep.complete = false;
  snapshot.docPrep.packetVerified = false;
  snapshot.docPrep.automation = {
    status: "writing",
    sections: [{ id: "contact-review", title: "Contact review", status: "review" }],
  };
  snapshot.docPrep.contactReview = {
    estateId: snapshot.selectedEstateId,
    reportRevision: "sha256-current-idi-report",
    candidates: [{
      id: "crm:csv:S38-ALICIA-001:idi:1",
      name: "Mateo Rivera",
      relationship: "relative",
      group: "alternative",
      phoneCount: 1,
      emailCount: 0,
      ownerLastNameMatch: true,
      sourceLabel: "PDF page 2",
      status: "needs_review",
    }],
  };
  const markup = railModule.renderAutomationRail({ bridge: bridgeFor(snapshot), snapshot });
  assert.match(markup, /data-docprep-rail-panel="automation"[\s\S]*Contact review[\s\S]*Mateo Rivera/);
  assert.match(markup, /These contacts belong to Estate of Morgan Reyes/);
  assert.equal((markup.match(/data-rail-action="review-contact-candidate"/g) || []).length, 3, "Accept, Promote, and Reject must be visible in the unified Automation rail");
  assert.match(markup, /data-contact-status="accepted"[\s\S]*data-contact-status="promoted"[\s\S]*data-contact-status="rejected"/);
  assert.match(markup, /aria-label="Accept Mateo Rivera for Estate of Morgan Reyes"/);
  assert.doesNotMatch(markup, /researchRail/, "contact review must not rely on the hidden legacy research rail");

  const dispatches = [];
  const bridge = bridgeFor(snapshot, {
    dispatch: async (command, payload) => {
      dispatches.push({ command, payload });
      return snapshot;
    },
  });
  await railModule.runContactReviewAction({
    bridge,
    estateId: snapshot.selectedEstateId,
    candidateId: snapshot.docPrep.contactReview.candidates[0].id,
    contactStatus: "accepted",
    reportRevision: snapshot.docPrep.contactReview.reportRevision,
  });
  assert.deepEqual(dispatches, [{
    command: "review-contact-candidate",
    payload: {
      estateId: snapshot.selectedEstateId,
      candidateId: snapshot.docPrep.contactReview.candidates[0].id,
      status: "accepted",
      reportRevision: snapshot.docPrep.contactReview.reportRevision,
    },
  }]);

  await assert.rejects(
    railModule.runContactReviewAction({
      bridge,
      estateId: "crm:csv:OTHER-ESTATE",
      candidateId: snapshot.docPrep.contactReview.candidates[0].id,
      contactStatus: "rejected",
      reportRevision: snapshot.docPrep.contactReview.reportRevision,
    }),
    /selected estate changed/i,
  );
  await assert.rejects(
    railModule.runContactReviewAction({
      bridge,
      estateId: snapshot.selectedEstateId,
      candidateId: snapshot.docPrep.contactReview.candidates[0].id,
      contactStatus: "rejected",
      reportRevision: "stale-report-revision",
    }),
    /IDI report changed/i,
  );
  assert.equal(dispatches.length, 1, "stale estate or report actions must fail before dispatch");
}

{
  const row = rowModule.renderDocumentRow(snapshotFor().docPrep.documents[0], bridgeFor(snapshotFor()));
  assert.match(row, /role="button"/);
  assert.match(row, /tabindex="0"/);
  assert.match(row, /data-document-open="idi-asset-search"/);
  assert.doesNotMatch(row, /<button|eye|data-document-preview|data-row-menu|data-row-run/i);
}

{
  const listeners = new Map();
  let focusCount = 0;
  let announcedError = null;
  const row = {
    dataset: { documentOpen: "idi-asset-search" },
    addEventListener: (type, listener) => listeners.set(type, listener),
    focus: () => { focusCount += 1; },
    setAttribute: (name, value) => { row[name] = value; },
    removeAttribute: (name) => { delete row[name]; },
  };
  rowModule.mountDocumentRows(
    { querySelectorAll: () => [row] },
    async () => { throw new Error("The IDI report has not passed verified file readback."); },
    { onError: (error) => { announcedError = error.message; } },
  );
  listeners.get("click")({ target: { closest: () => null } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(announcedError, "The IDI report has not passed verified file readback.");
  assert.equal(focusCount, 1, "a failed whole-row open must return focus to its recovery control");
  assert.equal(row["aria-busy"], undefined, "the row must leave its busy state after recovery");
}

{
  const rows = ["first", "second"].map((id) => {
    const listeners = new Map();
    return {
      dataset: { documentOpen: id },
      listeners,
      addEventListener: (type, listener) => listeners.set(type, listener),
      setAttribute(name, value) { this[name] = value; },
      removeAttribute(name) { delete this[name]; },
    };
  });
  rowModule.mountDocumentRows({ querySelectorAll: () => rows }, async () => {});
  rows[1].listeners.get("click")({ target: { closest: () => null } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rows[0]["aria-current"], "false");
  assert.equal(rows[1]["aria-current"], "true", "a successful whole-row open must expose the rail's selected document in the main list");
}

{
  const snapshot = snapshotFor();
  const actionHandlers = new Set(railModule.docPrepRail.tabs.flatMap((tab) => Object.keys(tab.actions || {})));
  const idiRail = railModule.renderDocumentRail({ bridge: bridgeFor(snapshot), snapshot });
  assert.deepEqual(railActionNames(idiRail), ["show-full-packet", "open-document", "download-document", "replace-document", "queue-document"]);
  assert.match(idiRail, /data-document-preview[\s\S]*iframe[\s\S]*idi-contract-1/);
  assert.match(idiRail, /data-rail-action="show-full-packet"[^>]*>Show full packet/);
  assert.match(idiRail, /data-rail-action="open-document"[^>]*>Open verified file/);
  assert.match(idiRail, /data-rail-action="download-document"[^>]*>Download verified file/);
  assert.match(idiRail, /data-rail-action="replace-document"[^>]*>Replace IDI report/);
  assert.doesNotMatch(idiRail, /remove-document/);

  const nonAdminSnapshot = structuredClone(snapshot);
  nonAdminSnapshot.session.canAdminister = false;
  const nonAdminIdiRail = railModule.renderDocumentRail({ bridge: bridgeFor(nonAdminSnapshot), snapshot: nonAdminSnapshot });
  assert.match(nonAdminIdiRail, /data-rail-action="replace-document"[^>]*disabled/);

  const supportingSnapshot = structuredClone(snapshot);
  supportingSnapshot.docPrep.documents[0].selected = false;
  supportingSnapshot.docPrep.documents[1].selected = true;
  const supportingRail = railModule.renderDocumentRail({ bridge: bridgeFor(supportingSnapshot), snapshot: supportingSnapshot });
  assert.match(supportingRail, /data-rail-action="replace-document"/);
  assert.match(supportingRail, /data-rail-action="remove-document"/);

  const generatedSnapshot = structuredClone(snapshot);
  generatedSnapshot.docPrep.documents = [{
    ...generatedSnapshot.docPrep.documents[1],
    id: "discovery-dossier",
    title: "Discovery packet",
    selected: true,
    fileSource: "verified_packet_artifact",
  }];
  const generatedRail = railModule.renderDocumentRail({ bridge: bridgeFor(generatedSnapshot), snapshot: generatedSnapshot });
  assert.match(generatedRail, /replace-document/);
  assert.doesNotMatch(generatedRail, /remove-document/);

  const unverifiedSnapshot = structuredClone(snapshot);
  unverifiedSnapshot.docPrep.documents[0].hasVerifiedFile = false;
  const unverifiedRail = railModule.renderDocumentRail({ bridge: bridgeFor(unverifiedSnapshot), snapshot: unverifiedSnapshot });
  assert.doesNotMatch(unverifiedRail, /open-document|download-document/, "file actions must stay hidden until verified readback");

  for (const html of [idiRail, supportingRail, generatedRail]) {
    railActionNames(html).forEach((action) => assert.ok(actionHandlers.has(action), `missing rail action handler: ${action}`));
  }

  const fullPacketSnapshot = structuredClone(snapshot);
  fullPacketSnapshot.docPrep.documents.forEach((document) => { document.selected = false; });
  const fullPacketRail = railModule.renderDocumentRail({ bridge: bridgeFor(fullPacketSnapshot), snapshot: fullPacketSnapshot });
  assert.match(fullPacketRail, /data-document-view="full-packet"[\s\S]*All generated estate sections in one document/);
  assert.match(fullPacketRail, /iframe[\s\S]*packet-contract-1/);
  assert.deepEqual(railActionNames(fullPacketRail), ["open-packet", "download-packet"]);

  assert.deepEqual(railModule.docPrepRail.tabs.map((tab) => tab.id), ["automation", "evidence", "document", "attachments", "completion"]);
  const evidenceRail = railModule.renderSourceEvidenceRail({ bridge: bridgeFor(snapshot), snapshot });
  assert.match(evidenceRail, /data-docprep-rail-panel="evidence"[\s\S]*Shared source run verified/);
  assert.match(evidenceRail, /name="propertyAppraiser\.owner" value="Morgan Reyes"/);
  assert.match(evidenceRail, /name="propertyAppraiser\.sourceUrl" value="https:\/\/county\.example\.test\/property\/01-0000-000-0000"/);
  assert.match(evidenceRail, /name="taxReceipt\.status"[\s\S]*value="browser_workflow_required" selected/);
  assert.match(evidenceRail, /data-rail-action="save-source-capture"/);
  assert.doesNotMatch(evidenceRail, /researchRail/, "source evidence must be editable in the unified rail");
  assert.ok(actionHandlers.has("save-source-capture"));

  const capture = railModule.sourceCaptureFromFormData({
    "propertyAppraiser.owner": " Morgan Reyes ",
    "propertyAppraiser.folio": " 01-0000-000-0000 ",
    "unknown.private": "must be dropped",
  });
  assert.deepEqual(capture, {
    propertyAppraiser: {
      owner: "Morgan Reyes",
      folio: "01-0000-000-0000",
    },
  });

  const evidenceDispatches = [];
  const evidenceBridge = bridgeFor(snapshot, {
    dispatch: async (command, payload) => {
      evidenceDispatches.push({ command, payload });
      return snapshot;
    },
  });
  await railModule.runSourceCaptureAction({
    bridge: evidenceBridge,
    estateId: snapshot.selectedEstateId,
    formData: {
      "propertyAppraiser.owner": "Morgan Reyes",
      "propertyAppraiser.folio": "01-0000-000-0000",
    },
  });
  assert.deepEqual(evidenceDispatches, [{
    command: "save-source-capture",
    payload: {
      estateId: snapshot.selectedEstateId,
      capture: {
        propertyAppraiser: {
          owner: "Morgan Reyes",
          folio: "01-0000-000-0000",
        },
      },
    },
  }]);

  const attachmentsRail = railModule.renderAttachmentsRail({ bridge: bridgeFor(snapshot), snapshot });
  assert.match(attachmentsRail, /data-docprep-rail-panel="attachments"[\s\S]*Obituary[\s\S]*Back Story · Public obituary/);
  assert.match(attachmentsRail, /data-rail-action="open-attachment"/);
  assert.doesNotMatch(attachmentsRail, /download-attachment/, "a remote link is openable but must not claim a local download");

  const completion = railModule.renderCompletionRail({ bridge: bridgeFor(snapshot), snapshot });
  assert.match(completion, /data-rail-action="open-packet"[^>]*>Open current packet/);
  assert.match(completion, /data-rail-action="download-packet"[^>]*>Download current packet/);
  assert.match(completion, /Continue in ChatGPT Work/);
  assert.match(completion, /data-rail-action="deliver-google-packet"/);
  assert.match(completion, /Send approved packet to Discovery Packets \/ Estate of Morgan Reyes/);
  assert.doesNotMatch(completion, /data-rail-action="deliver-google-packet"[^>]*disabled/);
  assert.match(completion, /local packet is verified and remains available without Google/i);
  assert.match(completion, /Packet history/);
  assert.match(completion, /Revision 1 · Verified/);
  assert.match(completion, /Corrected the probate filing date/);
  assert.doesNotMatch(completion.replace(/<[^>]+>/g, " "), /sanitized|content hash|server-side|provenance|artifact|storage readback/i);
  assert.ok(actionHandlers.has("deliver-google-packet"));
  assert.ok(actionHandlers.has("open-packet"));
  assert.ok(actionHandlers.has("download-packet"));

  const expiredSnapshot = structuredClone(snapshot);
  expiredSnapshot.docPrep.packetVerified = false;
  expiredSnapshot.docPrep.packetExpired = true;
  const expiredCompletion = railModule.renderCompletionRail({ bridge: bridgeFor(expiredSnapshot), snapshot: expiredSnapshot });
  assert.match(expiredCompletion, /Packet link expired/);
  assert.match(expiredCompletion, /Run Discovery again to create a new verified packet/);
  assert.doesNotMatch(expiredCompletion, /open-packet|download-packet/, "expired packet links must not remain actionable");

  const dispatches = [];
  const actionBridge = bridgeFor(snapshot, {
    dispatch: async (command, payload) => {
      dispatches.push({ command, payload });
      return snapshot;
    },
  });
  const documentActions = railModule.docPrepRail.tabs.find((tab) => tab.id === "document").actions;
  await documentActions["open-document"]({ bridge: actionBridge, state: snapshot, documentId: "idi-asset-search" });
  await documentActions["download-document"]({ bridge: actionBridge, state: snapshot, documentId: "idi-asset-search" });
  const completionActions = railModule.docPrepRail.tabs.find((tab) => tab.id === "completion").actions;
  await completionActions["open-packet"]({ bridge: actionBridge, state: snapshot });
  await completionActions["download-packet"]({ bridge: actionBridge, state: snapshot });
  assert.deepEqual(dispatches, [
    { command: "document-action", payload: { estateId: snapshot.selectedEstateId, documentId: "idi-asset-search", action: "preview" } },
    { command: "document-action", payload: { estateId: snapshot.selectedEstateId, documentId: "idi-asset-search", action: "download" } },
    { command: "packet-action", payload: { estateId: snapshot.selectedEstateId, flowId: "discovery", action: "open" } },
    { command: "packet-action", payload: { estateId: snapshot.selectedEstateId, flowId: "discovery", action: "download" } },
  ], "rail controls must dispatch explicit open/download commands for the selected verified file and exact current packet");

  const unapprovedSnapshot = structuredClone(snapshot);
  unapprovedSnapshot.docPrep.packetApproved = false;
  const unapproved = railModule.renderCompletionRail({ bridge: bridgeFor(unapprovedSnapshot), snapshot: unapprovedSnapshot });
  assert.match(unapproved, /open-packet[\s\S]*download-packet/, "packet review actions must remain available before optional handoff approval");
  assert.match(unapproved, /data-rail-action="deliver-google-packet"[^>]*disabled/);
  assert.match(unapproved, /Approve Current Packet in Case Journey/);

  const googleSetupSnapshot = structuredClone(snapshot);
  googleSetupSnapshot.docPrep.googleHandoffReady = false;
  googleSetupSnapshot.docPrep.googleHandoffDestination = "";
  const googleSetup = railModule.renderCompletionRail({ bridge: bridgeFor(googleSetupSnapshot), snapshot: googleSetupSnapshot });
  assert.match(googleSetup, /Review optional Google setup/);
  assert.doesNotMatch(googleSetup, /data-rail-action="deliver-google-packet"/);

  const deliveredSnapshot = structuredClone(snapshot);
  deliveredSnapshot.docPrep.googleDelivered = true;
  deliveredSnapshot.docPrep.googleDestination = "Discovery Packets / Estate of Morgan Reyes";
  const delivered = railModule.renderCompletionRail({ bridge: bridgeFor(deliveredSnapshot), snapshot: deliveredSnapshot });
  assert.match(delivered, /data-google-delivery="verified"/);
  assert.match(delivered, /Saved to Google Workspace/);
  assert.match(delivered, /Discovery Packets \/ Estate of Morgan Reyes/);
  assert.doesNotMatch(delivered, /data-rail-action="deliver-google-packet"/);
}

{
  let firstFocused = 0;
  let lastFocused = 0;
  let escaped = 0;
  const first = { hidden: false, getAttribute: () => null, focus: () => { firstFocused += 1; } };
  const last = { hidden: false, getAttribute: () => null, focus: () => { lastFocused += 1; } };
  const dialog = {
    querySelectorAll: () => [first, last],
    contains: (element) => element === first || element === last,
  };
  const event = (key, shiftKey = false) => ({
    key,
    shiftKey,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  });
  const forward = event("Tab");
  assert.equal(focusModule.containModalKeydown(forward, dialog, { activeElement: last }), true);
  assert.equal(forward.prevented, true);
  assert.equal(firstFocused, 1);
  const backward = event("Tab", true);
  assert.equal(focusModule.containModalKeydown(backward, dialog, { activeElement: first }), true);
  assert.equal(lastFocused, 1);
  const escape = event("Escape");
  assert.equal(focusModule.containModalKeydown(escape, dialog, { onEscape: () => { escaped += 1; } }), true);
  assert.equal(escaped, 1);
  assert.equal(escape.stopped, true);
}

{
  assert.equal(uploadModule.validateIdiReport({ name: "report.pdf", size: 10, type: "application/pdf" }), "");
  assert.equal(uploadModule.validateIdiReport({ name: "report.docx", size: 10, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), "");
  assert.match(uploadModule.validateIdiReport({ name: "report.doc", size: 10 }), /Legacy DOC and CSV/);
  assert.match(uploadModule.validateIdiReport({ name: "report.csv", size: 10 }), /Legacy DOC and CSV/);
  assert.match(uploadModule.validateIdiReport({ name: "report.pdf", size: 3_000_001 }), /3 MB or smaller/);
  assert.match(uploadModule.operatorError("The generated PDF did not pass packet verification."), /new packet could not be verified/i);
  assert.doesNotMatch(uploadModule.operatorError("The generated PDF did not pass packet verification."), /choose a searchable/i);
  const placeholderEstateBlocker = uploadModule.operatorError("A legacy placeholder estate stays isolated until it is removed from the shared workspace.");
  assert.match(placeholderEstateBlocker, /legacy placeholder estate cannot run production Discovery/i);
  assert.doesNotMatch(placeholderEstateBlocker, /new packet could not be verified/i, "legacy placeholder isolation must not be misreported as a packet-verification failure");
  const ownerEvidenceBlocker = uploadModule.operatorError("Owner Details needs review. Owner Details needs verified Property Appraiser readback with the source URL, owner, property address, folio, and mailing address before Discovery can continue.");
  assert.match(ownerEvidenceBlocker, /Owner Details still needs verified Property Appraiser evidence/i);
  assert.doesNotMatch(ownerEvidenceBlocker, /could not confirm the saved report/i, "a source-evidence blocker must not blame an already verified IDI upload");

  const blockedRecoverySnapshot = snapshotFor(`blocked-recovery-${Date.now()}`);
  const blockedRecoveryHtml = uploadModule.renderIdiControlState(blockedRecoverySnapshot, {
    ...uploadModule.uiStateFor(blockedRecoverySnapshot.selectedEstateId, blockedRecoverySnapshot),
    file: null,
    error: ownerEvidenceBlocker,
    failedStage: "discovery-running",
  }, bridgeFor(blockedRecoverySnapshot));
  assert.match(blockedRecoveryHtml, /data-idi-retry[\s\S]*Retry Discovery/);
  assert.equal((blockedRecoveryHtml.match(/data-idi-retry/g) || []).length, 1, "a Discovery blocker must expose exactly one wired retry action");
  assert.doesNotMatch(blockedRecoveryHtml, /data-idi-choose-another/, "a source-evidence failure must retry Discovery instead of asking for another verified report");

  const replacementEstateId = `replacement-${Date.now()}`;
  const replacementState = uploadModule.uiStateFor(replacementEstateId, snapshotFor(replacementEstateId));
  uploadModule.selectIdiReportFile(
    replacementState,
    { name: "replacement.pdf", size: 2_048, type: "application/pdf" },
    { focusReplacement: true },
  );
  assert.equal(replacementState.focusReplacement, true, "a rail replacement must focus the required reason after the file chooser closes");
  assert.deepEqual(replacementState.completedStages, [], "a newly selected report must clear the prior packet timeline");
  assert.equal(replacementState.baselinePacketRevision, null);
  const priorPacket = snapshotFor(replacementEstateId);
  priorPacket.docPrep.documents = priorPacket.docPrep.documents.filter((document) => document.id !== "idi-asset-search");
  uploadModule.uiStateFor(replacementEstateId, priorPacket);
  assert.deepEqual(replacementState.completedStages, [], "an old verified packet must not refill a selected report's timeline during refresh");
  assert.equal(viewModule.displayedProgress(priorPacket, replacementState), 0, "the prior packet must not leave a new upload at 100 percent");

  const replacementRunId = `replacement-run-${Date.now()}`;
  const replacementSnapshot = snapshotFor(replacementRunId);
  const replacementRunState = uploadModule.uiStateFor(replacementRunId, replacementSnapshot);
  uploadModule.selectIdiReportFile(replacementRunState, { name: "corrected-report.pdf", size: 2_048, type: "application/pdf" });
  replacementRunState.replacementReason = "Corrected report from IDI Core";
  let replacementPayload = null;
  await uploadModule.uploadSelectedReport({
    bridge: bridgeFor(replacementSnapshot, {
      dispatch: async (command, payload) => {
        assert.equal(command, "upload-idi-report");
        replacementPayload = payload;
        return replacementSnapshot;
      },
    }),
    snapshot: replacementSnapshot,
    state: replacementRunState,
    refresh: () => {},
  });
  assert.equal(replacementPayload.adminOverrideReason, "Corrected report from IDI Core");
  assert.equal(replacementPayload.file.name, "corrected-report.pdf");

  const blockedReplacementId = `replacement-blocked-${Date.now()}`;
  const blockedReplacementSnapshot = snapshotFor(blockedReplacementId);
  blockedReplacementSnapshot.session.canAdminister = false;
  const blockedReplacementState = uploadModule.uiStateFor(blockedReplacementId, blockedReplacementSnapshot);
  uploadModule.selectIdiReportFile(blockedReplacementState, { name: "blocked.pdf", size: 1_024, type: "application/pdf" });
  let blockedDispatchCount = 0;
  await uploadModule.uploadSelectedReport({
    bridge: bridgeFor(blockedReplacementSnapshot, { dispatch: async () => { blockedDispatchCount += 1; } }),
    snapshot: blockedReplacementSnapshot,
    state: blockedReplacementState,
    refresh: () => {},
  });
  assert.equal(blockedDispatchCount, 0);
  assert.match(blockedReplacementState.error, /configured administrator/i);

  const before = snapshotFor("estate-activity");
  before.activity = [{ title: "Discovery failed", copy: "Old failure", updatedAt: 100 }];
  const cursor = uploadModule.activityCursor(before);
  assert.equal(uploadModule.latestFailure(before, cursor), null, "stale failures must not fail a new upload");
  const after = structuredClone(before);
  after.activity.unshift({ title: "Extraction blocked", copy: "New failure", updatedAt: 101 });
  assert.equal(uploadModule.latestFailure(after, cursor).copy, "New failure");
}

{
  const rows = snapshotFor().estates.map((row, index) => ({
    ...row,
    score: index ? 82 : 64,
    tone: index ? "ready" : "review",
    missingTypes: index ? ["tax"] : ["heirs", "phones"],
  }));
  assert.equal(estatesModule.filteredEstateRows(rows, { county: "Broward", status: "all", minimumEvidence: 0, missing: "all", priorityOnly: false }).length, 1);
  assert.equal(estatesModule.filteredEstateRows(rows, { county: "all", status: "ready", minimumEvidence: 6, missing: "tax", priorityOnly: true }).length, 1);
  assert.equal(estatesModule.filteredEstateRows(rows, { county: "all", status: "all", minimumEvidence: 0, missing: "phones", priorityOnly: true }).length, 0);
  assert.equal(estatesModule.activeEstateFilterCount({ county: "Broward", status: "ready", minimumEvidence: 3, missing: "tax", priorityOnly: true }), 5);

  assert.deepEqual(
    queueModule.selectedQueueEstateIds([{ id: "still-queued" }], new Set(["removed", "still-queued"])),
    ["still-queued"],
    "Queue export must prune a selected estate after removal",
  );
  assert.deepEqual(queueModule.selectedQueueEstateIds([{ id: "one" }, { id: "two" }], new Set()), []);
  const queueHtml = queueModule.renderQueueGrid({ bridge: bridgeFor(snapshotFor()) });
  assert.match(queueHtml, /data-queue-export disabled/, "Queue export must remain unavailable until at least one row is selected");

  const adminSource = read("src/features/data-grid/admin-audit-grid.js");
  assert.match(adminSource, /adminAuditApi\.setGridOption\("rowData", adminAuditRows\(snapshot\)\)/, "Admin audit rows must refresh on live bridge updates");
}

{
  const estateId = `estate-upload-${Date.now()}`;
  const before = snapshotFor(estateId);
  before.docPrep.complete = false;
  before.docPrep.packetVerified = false;
  before.docPrep.progress = 0;
  before.docPrep.automation.status = "idle";
  before.docPrep.documents = before.docPrep.documents.filter((document) => document.id !== "idi-asset-search");
  const after = structuredClone(before);
  after.docPrep.progress = 100;
  after.docPrep.packetVerified = true;
  after.docPrep.complete = true;
  after.docPrep.packetRevision = before.docPrep.packetRevision + 1;
  after.docPrep.automation.status = "exported";
  after.docPrep.documents.unshift(snapshotFor(estateId).docPrep.documents[0]);
  after.activity.unshift({ title: "Packet ready", copy: "Verified local packet.", tone: "ready", updatedAt: Date.now() + 1 });

  const calls = [];
  const bridge = bridgeFor(before, {
    dispatch: async (command, payload) => {
      calls.push({ command, payload });
      return after;
    },
  });
  const state = uploadModule.uiStateFor(estateId);
  state.file = { name: "operator-report.pdf", size: 4096, type: "application/pdf" };
  await uploadModule.uploadSelectedReport({ bridge, snapshot: before, state, refresh: () => {} });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "upload-idi-report");
  assert.equal(calls[0].payload.estateId, estateId);
  assert.equal(calls[0].payload.file.name, "operator-report.pdf");
  assert.equal(state.file, null, "a successful upload must clear the selected file and prevent duplicate submission");
  assert.equal(state.status, "success");
  assert.deepEqual(state.completedStages, timelineModule.automationStages.map((stage) => stage.id));

  const changedState = uploadModule.uiStateFor(`${estateId}-changed`);
  changedState.file = { name: "wrong-estate.pdf", size: 4096, type: "application/pdf" };
  let changedDispatches = 0;
  await uploadModule.uploadSelectedReport({
    bridge: bridgeFor(before, {
      selectedEstateId: () => estateId,
      dispatch: async () => { changedDispatches += 1; },
    }),
    snapshot: before,
    state: changedState,
    refresh: () => {},
  });
  assert.equal(changedDispatches, 0, "an upload must never cross the selected estate boundary");
  assert.match(changedState.error, /selected estate changed/i);
}

{
  const estateId = `estate-revision-${Date.now()}`;
  const before = snapshotFor(estateId);
  before.docPrep.packetRevision = 7;
  const blocked = structuredClone(before);
  blocked.docPrep.automation.status = "blocked";
  blocked.activity.unshift({
    title: "Discovery source search blocked",
    copy: "The corrected filing needs operator review.",
    tone: "blocked",
    updatedAt: Date.now() + 1,
  });
  const state = uploadModule.uiStateFor(estateId, before);
  await uploadModule.startDiscovery({
    bridge: bridgeFor(before, { dispatch: async () => blocked }),
    snapshot: before,
    state,
    refresh: () => {},
    correctionNote: "Corrected the filing date from the reviewed court docket.",
  });
  uploadModule.uiStateFor(estateId, blocked);
  assert.equal(state.baselinePacketRevision, 7);
  assert.equal(state.failedStage, "discovery-running", "the prior verified packet must not erase a blocked rerun");
  assert.match(state.error, /source review/i);
  const blockedTimeline = timelineModule.timelineState(blocked, state);
  assert.equal(blockedTimeline.find((stage) => stage.id === "discovery-running").state, "failed");
  assert.equal(blockedTimeline.find((stage) => stage.id === "packet-verified").state, "pending");
  assert.equal(blockedTimeline.find((stage) => stage.id === "ready-for-review").state, "pending");

  const advanced = structuredClone(before);
  advanced.docPrep.packetRevision = 8;
  advanced.docPrep.automation.status = "exported";
  uploadModule.uiStateFor(estateId, advanced);
  assert.equal(state.failedStage, null, "only a newer verified packet may clear the rerun failure");
  assert.equal(state.error, "");
  assert.equal(timelineModule.timelineState(advanced, state).at(-1).state, "complete");
}

{
  const estateId = `estate-switch-${Date.now()}`;
  const before = snapshotFor(estateId);
  before.docPrep.complete = false;
  before.docPrep.packetVerified = false;
  before.docPrep.packetRevision = 3;
  before.docPrep.automation.status = "idle";
  before.docPrep.documents = before.docPrep.documents.filter((document) => document.id !== "idi-asset-search");
  const displayedElsewhere = snapshotFor("estate-selected-elsewhere");
  displayedElsewhere.activity = structuredClone(before.activity);
  const state = uploadModule.uiStateFor(estateId);
  state.file = { name: "estate-bound.pdf", size: 4096, type: "application/pdf" };
  const calls = [];
  await uploadModule.uploadSelectedReport({
    bridge: bridgeFor(before, {
      dispatch: async (command, payload) => {
        calls.push({ command, payload });
        return displayedElsewhere;
      },
    }),
    snapshot: before,
    state,
    refresh: () => {},
  });
  assert.equal(calls[0].payload.estateId, estateId);
  assert.equal(state.error, "", "the currently displayed estate must not invalidate the captured estate command");
  assert.equal(state.status, "success");
  assert.equal(state.runStarted, true);
  assert.equal(state.file, null);

  const completedForTarget = structuredClone(before);
  completedForTarget.docPrep.documents.unshift(snapshotFor(estateId).docPrep.documents[0]);
  completedForTarget.docPrep.complete = true;
  completedForTarget.docPrep.packetVerified = true;
  completedForTarget.docPrep.packetRevision = 4;
  completedForTarget.docPrep.automation.status = "exported";
  uploadModule.uiStateFor(estateId, completedForTarget);
  assert.equal(state.runStarted, false);
  assert.equal(timelineModule.timelineState(completedForTarget, state).at(-1).state, "complete");
}

{
  const estateId = `estate-rerun-${Date.now()}`;
  const snapshot = snapshotFor(estateId);
  const state = uploadModule.uiStateFor(estateId, snapshot);
  let dispatches = 0;
  await uploadModule.startDiscovery({
    bridge: bridgeFor(snapshot, { dispatch: async () => { dispatches += 1; return snapshot; } }),
    snapshot,
    state,
    refresh: () => {},
    correctionNote: "short",
  });
  assert.equal(dispatches, 0);
  assert.match(state.error, /correction note/);

  const emitted = [];
  await uploadModule.startDiscovery({
    bridge: bridgeFor(snapshot, {
      emit: (...args) => emitted.push(args),
      dispatch: async (command, payload) => {
        dispatches += 1;
        assert.equal(command, "run-discovery");
        assert.deepEqual(payload, {
          estateId,
          flowId: "discovery",
          correctionNote: "Corrected the probate filing date.",
        });
        return snapshot;
      },
    }),
    snapshot,
    state,
    refresh: () => {},
    correctionNote: "Corrected the probate filing date.",
  });
  assert.equal(dispatches, 1);
  assert.match(emitted[0][0], /rerun requested/);
  const rerunHtml = uploadModule.renderIdiControlState(snapshot, { ...state, rerunOpen: true }, bridgeFor(snapshot));
  assert.match(rerunHtml, /What changed\?/);
  assert.match(rerunHtml, /data-rerun-submit[^>]*>Replace active packet/, "the packet replacement control must expose an explicit runtime binding in addition to native form association");
  const uploadControlSource = read("src/features/doc-prep/idi-upload-control.js");
  assert.match(uploadControlSource, /rerunForm\?\.addEventListener\("submit", submitRerun\)[\s\S]*rerunForm\?\.querySelector\?\.\("\[data-rerun-submit\]"\)\?\.addEventListener\("click", submitRerun\)/, "Web Awesome packet replacement must retain both native submit and direct click paths");
}

{
  const docPrepTree = readTree(path.join(sourceRoot, "features", "doc-prep"));
  const gridTree = readTree(path.join(sourceRoot, "features", "data-grid"));
  const gridCommunity = read("src/features/data-grid/community-grid.js");
  const gridRegister = read("src/features/data-grid/register.js");
  const estatesGrid = read("src/features/data-grid/estates-grid.js");
  const gridsCss = read("src/features/data-grid/grids.css");
  const docPrepCss = read("src/features/doc-prep/doc-prep.css");
  const dividerCss = read("src/styles/dividers.css");
  const tokensCss = read("src/styles/tokens.css");
  const compatCss = read("src/styles/compat.css");
  const entrySource = read("src/entry.js");
  const legacy = read("src/legacy/app.js");
  const docPrepRailSource = read("src/features/doc-prep/doc-prep-rail.js");
  const unifiedRailHost = read("src/features/shell/unified-rail-host.js");
  const packageJson = JSON.parse(read("package.json"));
  const lock = fs.readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");

  const estateBoundEventSites = [
    ["Source capture saved", "Discovery source review", 1],
    ["Source capture not saved", "Discovery source review", 1],
    ["Source search ran", "Discovery source review", 1],
    ["Source search blocked", "Discovery source review", 1],
    ["IDI asset search imported", "IDI asset search", 1],
    ["IDI import blocked", "IDI asset search", 1],
    ["Live IDI Core completed", "IDI Core", 1],
    ["Live IDI Core blocked", "IDI Core", 1],
    ["Contact review updated", "IDI contact review", 1],
    ["Contact review not saved", "IDI contact review", 1],
    ["Closing PDF blocked", "Closing Prep", 2],
    ["Closing PDF ready", "Closing Prep", 1],
    ["ChatGPT Work handoff blocked", "ChatGPT Work", 2],
    ["Supporting document removal blocked", "Document Prep", 2],
    ["Discovery PDF saved", "Google Workspace", 1],
    ["Packet generation blocked by stop rule", "flow.title", 1],
    ["Packet preview ready", "flow.title", 1],
  ];
  const shellEventCalls = addShellEventCalls(legacy);
  for (const [title, source, expectedCount] of estateBoundEventSites) {
    const calls = shellEventCalls.filter((call) => call.includes(`"${title}"`));
    assert.equal(calls.length, expectedCount, `${title} must keep its exact estate-attributed event coverage`);
    for (const call of calls) {
      assert.match(call, /\{\s*row,\s*source:/, `${title} must stay bound to the estate captured before its async work started`);
      assert.ok(call.includes(`source: ${source === "flow.title" ? source : `"${source}"`}`), `${title} must keep a stable operator-facing source`);
    }
  }

  assert.doesNotMatch(docPrepTree, /ag-grid/i, "Document Prep rows must remain editorial, not a data grid");
  assert.doesNotMatch(docPrepRailSource, /researchRail|querySelector\([^)]*data-contact-review/, "the unified contact review must use its own snapshot/action contract, not the hidden legacy rail DOM");
  assert.match(legacy, /contactReview:\s*publicContactReview\(row\)/, "the unified rail snapshot must carry the current estate's sanitized contact review state");
  assert.match(legacy, /sourceCapture:\s*row[\s\S]*sourceCapturePersistenceSnapshot/, "the unified rail snapshot must carry a privacy-filtered source capture");
  assert.match(legacy, /id === "review-contact-candidate"[\s\S]*saveContactCandidateReview\(row, payload\.candidateId, payload\.status, payload\.reportRevision\)/, "the unified action must reuse the verified canonical review write");
  assert.match(legacy, /id === "save-source-capture"[\s\S]*saveSourceCaptureForRow\(row, payload\.capture\)/, "the unified evidence action must reuse canonical Discovery File readback");
  assert.match(unifiedRailHost, /"review-contact-candidate":\s*"The IDI contact decision could not be saved[\s\S]*data-unified-rail-retry/, "contact review failures must stay visible and retryable in the unified rail");
  assert.match(unifiedRailHost, /"save-source-capture":\s*"The source evidence could not be saved[\s\S]*new FormData\(button\.form\)/, "source evidence failures must stay visible and form values must flow through the unified rail action");
  assert.match(gridCommunity, /from "ag-grid-community"/);
  assert.match(gridCommunity, /ClientSideRowModelModule/);
  assert.match(gridCommunity, /PaginationModule/);
  assert.match(gridCommunity, /QuickFilterModule/);
  assert.match(gridCommunity, /RowApiModule/, "the registered Community bundle must include the API used to restore selected rows");
  assert.match(gridCommunity, /RowSelectionModule/);
  assert.match(gridCommunity, /themeQuartz\.withParams/);
  assert.doesNotMatch(gridCommunity, /NumberFilterModule|DateFilterModule/, "unused Community modules must stay out of the grid bundle");
  assert.match(gridCommunity, /animateRows:\s*!reduceMotion/, "row motion must respect the operator's reduced-motion preference");
  assert.match(gridCommunity, /function interactiveGridTarget[\s\S]*button, a, input, select, textarea/);
  assert.match(gridCommunity, /event\.key !== " " \|\| !node\?\.data \|\| interactiveGridTarget\(event\)/, "Space on a nested row control must reach that control");
  assert.match(gridCommunity, /event\.key !== "Enter" \|\| !data \|\| interactiveGridTarget\(event\)/, "Enter on a nested row control must reach that control");
  assert.match(gridsCss, /\.hr-estates-grid-view\s*\{[\s\S]*grid-template-areas:\s*"estate-header"\s*"estate-filters"\s*"estate-grid"[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)/, "Estates must keep explicit header, optional-filter, and flexible grid areas without an idle metadata row");
  for (const [selector, area] of [
    ["hr-grid-header", "estate-header"],
    ["hr-estate-filters", "estate-filters"],
    ["hr-community-grid", "estate-grid"],
  ]) {
    assert.match(gridsCss, new RegExp(`\\.hr-estates-grid-view > \\.${selector}\\s*\\{[^}]*grid-area:\\s*${area}`), `${selector} must stay bound to the ${area} layout area`);
  }
  assert.match(gridsCss, /\.hr-estates-grid-view > \.hr-community-grid\[data-community-grid="estates"\][\s\S]*\.ag-root-wrapper\s*\{[^}]*height:\s*100%/, "the Estates AG Grid wrapper must stretch through its flexible layout area");
  assert.match(gridsCss, /\.hr-community-grid\[data-community-grid="estates"\] \.ag-paging-panel\s*\{[^}]*justify-content:\s*center[^}]*transform:\s*translateY\(calc\(-1 \* var\(--hr-space-8\)\)\)/, "the Estates paging controls must float above the command hover zone at the bottom center on desktop");
  assert.doesNotMatch(gridsCss, /hr-estates-command-clearance|padding-block-end:\s*calc\([^;]*command-clearance/, "Estates must not reserve a second command-row gutter that strands pagination above the workbench bottom");
  assert.match(gridsCss, /@media \(max-width: 620px\)[\s\S]*\.hr-community-grid\[data-community-grid="estates"\] \.ag-paging-panel\s*\{[^}]*transform:\s*none/, "mobile paging must stay centered without a desktop translation");
  assert.match(gridsCss, /@media \(max-width: 620px\)[\s\S]*\.ag-paging-row-summary-panel\s*\{[^}]*display:\s*none[\s\S]*\.ag-paging-page-size, \.ag-paging-page-summary-panel[^}]*white-space:\s*nowrap[\s\S]*data-ref="btFirst"[\s\S]*data-ref="btLast"[\s\S]*display:\s*none/, "mobile paging must remove duplicate and edge controls so Page Size plus previous/next stay on one readable line");
  assert.match(gridsCss, /@media \(max-width: 620px\)[\s\S]*\.app\[data-active-view="find-estates"\] \.workbench\s*\{[^}]*grid-template-rows:\s*auto\s*!important[^}]*align-content:\s*start/, "the mobile Estates workbench must size to its content instead of clipping the grid into a fixed row");
  assert.match(gridsCss, /@media \(max-width: 620px\)[\s\S]*\.app\[data-active-view="find-estates"\] \.workbench-head\[data-view-panel="find-estates"\]\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible/, "the mobile Estates owner must expose grid overflow to the workbench scroll container");
  assert.match(gridsCss, /@media \(max-width: 620px\)[\s\S]*\.hr-estates-grid-view\s*\{[^}]*height:\s*auto[^}]*overflow:\s*visible[^}]*grid-template-rows:\s*auto auto minmax\(520px, 1fr\)/, "the mobile Estates layout must preserve a complete grid row in vertical flow without restoring the idle metadata strip");
  assert.match(gridsCss, /@media \(max-width: 620px\)[\s\S]*\.hr-estates-grid-view > \.hr-community-grid\[data-community-grid="estates"\]\s*\{[^}]*height:\s*520px/, "the mobile AG Grid host must have a definite, unclipped viewport");
  assert.match(gridsCss, /\.hr-community-grid :is\([^)]+ag-body-viewport[^)]+ag-center-cols-viewport[^)]+ag-body-horizontal-scroll-viewport[^)]+ag-body-vertical-scroll-viewport[^)]+\)\s*\{[^}]*scrollbar-width:\s*none/, "AG Grid scroll viewports must suppress native scrollbar tracks without changing overflow");
  assert.match(gridsCss, /::-webkit-scrollbar\s*\{[^}]*width:\s*0[^}]*height:\s*0/, "WebKit scrollbar tracks must be visually hidden");
  assert.doesNotMatch(gridsCss, /\.ag-body-(?:horizontal|vertical)-scroll\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden)/, "AG Grid synchronization nodes must remain in layout and available to its runtime");
  assert.doesNotMatch(gridsCss, /@keyframes hr-grid-enter[\s\S]*?from\s*\{[^}]*opacity:\s*0/, "grid content must remain visible if its entrance motion never runs");
  assert.doesNotMatch(gridsCss, /\.hr-grid-primary-action:hover[^}]*\{[^}]*transform:/, "primary grid actions must not jump on hover");
  assert.doesNotMatch(gridTree, /AllCommunityModule|AllEnterpriseModule|ag-grid-enterprise/i);
  assert.match(docPrepCss, /\.hr-upload-command\.hr-public-sources-command,[\s\S]*\.hr-upload-command\.hr-idi-report-command\s*\{[^}]*background:\s*transparent[^}]*border-color:\s*transparent[^}]*box-shadow:\s*none/, "source review and IDI replacement must remain bare secondary controls");
  assert.match(docPrepCss, /@media \(max-width:\s*620px\)[\s\S]*\.hr-discovery-actions\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, "mobile Discovery actions must stack so their labels remain fully readable");
  assert.match(tokensCss, /--hr-divider-line:\s*linear-gradient\([\s\S]*transparent 0%[\s\S]*var\(--hr-ruler\) 10%[\s\S]*var\(--hr-ruler\) 90%[\s\S]*transparent 100%/, "horizontal divider edges must share one theme-aware fade token");
  assert.match(tokensCss, /--hr-divider-line-vertical:\s*linear-gradient\([\s\S]*180deg/, "vertical divider edges must share the matching fade token");
  assert.match(compatCss, /--divider-line:\s*var\(--hr-divider-line\)/, "legacy semantic dividers must consume the shared fade token");
  assert.match(entrySource, /virtual:heirright-features";[\s\S]*styles\/dividers\.css/, "the divider authority layer must load after all feature styles");
  assert.match(dividerCss, /\.hr-docprep-header[\s\S]*\.dashboard-decision-band[\s\S]*\.shell-rail-header/, "the divider authority must cover Document Prep, Dashboard, and the unified rail");
  assert.match(dividerCss, /border-image-source:\s*var\(--hr-divider-line\)[\s\S]*border-image-slice:\s*1/, "semantic horizontal borders must paint the shared fade without changing layout");
  assert.match(dividerCss, /\.dashboard-estate-row,[\s\S]*\.journey-document-row,[\s\S]*\.journey-action-row,[\s\S]*\.template-attachment-option,[\s\S]*\{[\s\S]*border-image-source:\s*var\(--hr-divider-line\)/, "semantic rows and panels must outrank their native border reset without changing grid internals");
  assert.match(dividerCss, /border-image-source:\s*var\(--hr-divider-line-vertical\)/, "semantic vertical borders must fade at both ends");
  const dividerRules = dividerCss.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(dividerRules, /ag-(?:cell|row|root)|input|textarea|focus-visible|wa-progress|progress-bar/, "grid structure, fields, focus rings, and progress tracks must stay outside the divider override");
  assert.doesNotMatch(dividerRules, /settings-status-list/, "card and status-panel outlines must not be repainted as divider gradients");
  assert.deepEqual(
    [...new Set([...gridTree.matchAll(/data-community-grid="([^"]+)"/g)].map((match) => match[1]))].sort(),
    ["admin-audit", "estates", "queue"],
  );
  assert.match(gridRegister, /id: "find-estates"/);
  assert.match(gridRegister, /id: "queue"/);
  assert.doesNotMatch(gridRegister, /\{ id: "admin", render:/, "the Admin forms must remain owned by the legacy view");
  assert.match(gridRegister, /\.team-activity-layout|mountAdminAuditGrid/);
  assert.match(estatesGrid, /const estateIds = \[\.\.\.estateSelection\]/);
  assert.doesNotMatch(estatesGrid, /class="hr-grid-meta"/, "the Estates view must not render an idle result and selection strip");
  assert.match(estatesGrid, /data-estates-selection-assist \$\{selectedCount \? "" : "hidden"\}/, "the existing Queue action must stay absent until a real estate selection exists");
  assert.match(estatesGrid, /assist\.hidden = selectedCount === 0/, "selection changes must reveal and dismiss the contextual Queue action");
  assert.match(estatesGrid, /data-estates-archive/, "the Estates grid must expose archive for a selected imported estate");
  assert.match(estatesGrid, /data-estates-delete/, "the Estates grid must expose delete for a selected imported estate");
  assert.match(estatesGrid, /bridge\.dispatch\("estate-lifecycle"/, "estate lifecycle actions must cross the authorized bridge");
  assert.match(legacy, /id === "estate-lifecycle"[\s\S]*payload\.confirmed !== true[\s\S]*runEstateLifecycleForRows/, "delete must require explicit confirmation before the lifecycle mutation");
  assert.match(estatesGrid, /selectedCount === 1 \? "Add estate to Queue" : `Add \$\{selectedCount\} estates to Queue`/, "the contextual action must describe the exact selected-estate scope");
  assert.match(estatesGrid, /bridge\.dispatch\("export", \{ route: "queue", estateIds \}\)/);
  assert.match(estatesGrid, /data-estate-filter="county"[\s\S]*data-estate-filter="status"[\s\S]*data-estate-filter="minimumEvidence"[\s\S]*data-estate-filter="missing"[\s\S]*data-estate-filter="priorityOnly"/, "approved operational filters must remain visible in the Estates migration");
  assert.match(gridTree, /queueSelection\.delete\(String\(row\.id\)\)/, "Queue removal must prune the export selection immediately");
  assert.match(gridTree, /if \(exportButton\) exportButton\.disabled = queueSelection\.size === 0/, "Queue export must track explicit selection state");
  assert.match(legacy, /if \(!estateIds\.length\) throw new Error\("Select at least one estate before exporting or adding it to Queue\."\)/, "the bridge must reject empty Queue exports instead of falling back to the active estate");
  assert.match(legacy, /const queueRows = Array\.isArray\(rowsOverride\) && rowsOverride\.length \? rowsOverride : rowsForBatchAction\(\)/);
  const idiImport = legacy.slice(legacy.indexOf("async function importIdiReportFile"), legacy.indexOf("function wireIdiReportUploadControls"));
  const acceptedContacts = legacy.slice(legacy.indexOf("function acceptedContactCandidates"), legacy.indexOf("function primaryContactCandidates"));
  const sourceHydration = legacy.slice(legacy.indexOf("function applyExternalSourceRunResult"), legacy.indexOf("function idiCoreCredentialStatus"));
  const estateIdentityBoundary = legacy.slice(legacy.indexOf("function normalizedAssetAddress"), legacy.indexOf("const entityOwnerPattern"));
  const estateMigrationBoundary = legacy.slice(legacy.indexOf("function migrateUnambiguousLegacyEstateState"), legacy.indexOf("function syncLegacyPlaceholderEstateState"));
  const migrationState = {
    crmImports: [],
    sourceCaptures: {}, idiImports: {}, contactReviews: {}, dealStatuses: {}, docPrepEstateState: {},
    closingFieldValues: {}, closingTemplateSelections: {}, closingExportState: {}, documentFiles: {},
  };
  const migrationApi = vm.runInNewContext(`${estateIdentityBoundary}\n${estateMigrationBoundary}\n({ assetDiscoveryKey, legacyEstateStateFingerprint, migrateUnambiguousLegacyEstateState });`, {
    state: migrationState,
    selectedRow: () => null,
    crmImportRow: (row) => row,
    storageSetItem: () => Promise.resolve(true),
    sourceCapturePersistenceSnapshot: (value) => value,
    normalizeDealStatusState: (value) => value,
    documentFilesPersistenceSnapshot: (value) => value,
    sourceCaptureStateKey: "source-captures",
    dealStatusStateKey: "deal-status",
    docPrepEstateStateKey: "docprep",
    documentFilesStateKey: "documents",
    closingFieldValuesStateKey: "closing-fields",
    closingTemplateSelectionsStateKey: "closing-templates",
    closingExportStateKey: "closing-export",
  });
  const uniqueLegacyRow = { id: "crm:podio:row-100", address: "100 Stable Estate Ave", owner: "Estate of Stable Owner" };
  const uniqueLegacyKey = migrationApi.legacyEstateStateFingerprint(uniqueLegacyRow);
  migrationState.sourceCaptures[uniqueLegacyKey] = { marker: "legacy-capture" };
  migrationState.documentFiles[`${uniqueLegacyKey}:deed`] = { marker: "legacy-document" };
  assert.equal(migrationApi.migrateUnambiguousLegacyEstateState([uniqueLegacyRow]), 2);
  assert.equal(migrationState.sourceCaptures[uniqueLegacyRow.id].marker, "legacy-capture", "one unambiguous legacy record may migrate to the exact CRM estate ID");
  assert.equal(migrationState.documentFiles[`${uniqueLegacyRow.id}:deed`].marker, "legacy-document");
  assert.equal(uniqueLegacyKey in migrationState.sourceCaptures, false);
  const renamedRow = { ...uniqueLegacyRow, address: "100 Renamed Display Avenue", owner: "Estate of Updated Display Owner" };
  migrationApi.migrateUnambiguousLegacyEstateState([renamedRow]);
  assert.equal(migrationState.sourceCaptures[uniqueLegacyRow.id].marker, "legacy-capture", "display metadata changes must not move exact-ID state");
  const ambiguousRows = [
    { id: "crm:podio:collision-a", address: "200 Shared Address St", owner: "Estate of Same Owner" },
    { id: "crm:podio:collision-b", address: "200 Shared Address St", owner: "Estate of Same Owner" },
  ];
  const ambiguousLegacyKey = migrationApi.legacyEstateStateFingerprint(ambiguousRows[0]);
  migrationState.sourceCaptures[ambiguousLegacyKey] = { marker: "ambiguous-legacy-capture" };
  assert.equal(migrationApi.migrateUnambiguousLegacyEstateState(ambiguousRows), 0, "ambiguous legacy address-owner keys must never be copied to either estate");
  assert.equal(migrationState.sourceCaptures[ambiguousLegacyKey].marker, "ambiguous-legacy-capture");
  assert.equal(migrationState.sourceCaptures[ambiguousRows[0].id], undefined);
  assert.equal(migrationState.sourceCaptures[ambiguousRows[1].id], undefined);
  assert.equal(migrationApi.assetDiscoveryKey({ id: "crm:podio:stable-id", address: "changed" }), "crm:podio:stable-id");
  assert.equal(migrationApi.assetDiscoveryKey({ address: "200 Shared Address St" }), "", "missing CRM identity must fail closed instead of inventing a shared key");
  const crmIdentityBoundary = legacy.slice(legacy.indexOf("function generatedCrmEstateId"), legacy.indexOf("function minimalImportedDossier"));
  const crmIdentityApi = vm.runInNewContext(`${crmIdentityBoundary}\n({ normalizeCrmImport, canonicalCrmImportStateText });`, {
    isoNow: () => "2026-07-15T12:00:00.000Z",
    currentActorEmail: () => "operator@example.test",
  });
  const canonicalLegacyImports = crmIdentityApi.canonicalCrmImportStateText(JSON.stringify([{
    provider: "podio",
    estateName: "Estate of Stable Owner",
    ownerName: "Stable Owner",
    propertyAddress: "100 Stable Estate Ave",
  }]));
  const canonicalLegacyImport = JSON.parse(canonicalLegacyImports)[0];
  assert.match(canonicalLegacyImport.id, /^crm-/, "a CRM row without an upstream record ID must receive a unique internal estate ID");
  assert.equal(crmIdentityApi.canonicalCrmImportStateText(canonicalLegacyImports), canonicalLegacyImports, "the one-time generated estate ID must remain stable after canonical persistence");
  assert.notEqual(canonicalLegacyImport.id, canonicalLegacyImport.propertyAddress, "display address must never become the storage identity");
  assert.match(legacy, /const canonicalValue = canonicalCrmImportStateText\(storedValue \|\| "\[\]"\);[\s\S]*storageSetItem\(crmImportStateKey, canonicalValue, \{ sync: false \}\)/, "local legacy CRM IDs must be persisted after one-time normalization");
  assert.match(legacy, /if \(key === crmImportStateKey\) safeValue = canonicalCrmImportStateText\(safeValue\);[\s\S]*if \(safeValue !== payload\.value\) await persistServerState\(key, safeValue\);/, "shared legacy CRM IDs must be written back under optimistic concurrency after hydration");
  const ownerEvidenceBoundary = legacy.slice(legacy.indexOf("function propertyAppraiserEvidenceComplete"), legacy.indexOf("function initials"));
  const reviewedEvidenceBoundary = legacy.slice(legacy.indexOf("function hasReviewedEvidenceValue"), legacy.indexOf("function publicEstateEvidenceGroups"));
  const publicEvidenceBoundary = legacy.slice(legacy.indexOf("function publicEstateEvidenceGroups"), legacy.indexOf("function publicEstateRow"));
  const ownerEvidenceState = { sourceCaptures: {} };
  const ownerEvidenceApi = vm.runInNewContext(`${reviewedEvidenceBoundary}\n${ownerEvidenceBoundary}\n({ propertyAppraiserEvidenceComplete, assetPhaseComplete });`, {
    state: ownerEvidenceState,
    selectedRow: () => ({ id: "crm:podio:owner-evidence", owner: "Estate of Seed Owner", address: "100 Seed Row Ave", parcel: "01-2345-678-9000" }),
    assetDiscoveryKey: (row) => row.id,
    sourceCaptureForRow: (row) => ownerEvidenceState.sourceCaptures[row.id] || {},
    dossierForRow: () => ({ property: { ownerName: { value: "Estate of Seed Owner" }, address: { value: "100 Seed Row Ave" }, parcelId: { value: "01-2345-678-9000" } } }),
    window: { location: { origin: "https://app.heirright.com", hostname: "app.heirright.com" } },
    URL,
  });
  const ownerEvidenceRow = { id: "crm:podio:owner-evidence", owner: "Estate of Seed Owner", address: "100 Seed Row Ave", parcel: "01-2345-678-9000" };
  const publicEvidenceApi = vm.runInNewContext(`${reviewedEvidenceBoundary}\n${publicEvidenceBoundary}\n({ publicEstateEvidenceGroups });`, {
    sourceCaptureForRow: (row) => ownerEvidenceState.sourceCaptures[row.id] || {},
    acceptedContactCandidates: () => [],
    propertyAppraiserEvidenceComplete: (row) => ownerEvidenceApi.propertyAppraiserEvidenceComplete(row),
  });
  assert.equal(ownerEvidenceApi.assetPhaseComplete(ownerEvidenceRow, "owner-details"), false, "Owner Details must not complete from row seed or dossier values");
  assert.equal(publicEvidenceApi.publicEstateEvidenceGroups(ownerEvidenceRow).property, false, "Case Journey Property must not complete from row seed values");
  ownerEvidenceState.sourceCaptures[ownerEvidenceRow.id] = {
    propertyAppraiser: {
      sourceUrl: "https://www.miamidade.gov/property/0123456789000",
      owner: "Estate of Seed Owner",
      address: "100 Seed Row Ave",
      folio: "01-2345-678-9000",
      mailingAddress: "Same as property address",
    },
  };
  assert.equal(ownerEvidenceApi.assetPhaseComplete(ownerEvidenceRow, "owner-details"), false, "Property fields without verified canonical persistence must remain incomplete");
  assert.equal(publicEvidenceApi.publicEstateEvidenceGroups(ownerEvidenceRow).property, false, "Case Journey Property must wait for verified canonical persistence");
  ownerEvidenceState.sourceCaptures[ownerEvidenceRow.id].sourceApiRun = { persistence: { stored: true, readbackStatus: "verified" } };
  assert.equal(ownerEvidenceApi.assetPhaseComplete(ownerEvidenceRow, "owner-details"), true, "verified Property Appraiser owner, property, folio, mailing, source URL, and readback must complete Owner Details");
  assert.equal(publicEvidenceApi.publicEstateEvidenceGroups(ownerEvidenceRow).property, true, "Case Journey Property must advance from the same verified Property Appraiser evidence as automation");
  delete ownerEvidenceState.sourceCaptures[ownerEvidenceRow.id].propertyAppraiser.mailingAddress;
  assert.equal(ownerEvidenceApi.assetPhaseComplete(ownerEvidenceRow, "owner-details"), false, "missing mailing evidence or explicit equivalent must keep Owner Details incomplete");
  assert.equal(publicEvidenceApi.publicEstateEvidenceGroups(ownerEvidenceRow).property, false, "Case Journey Property must return to incomplete when required verified evidence is absent");
  assert.match(acceptedContacts, /auto_accepted_high_confidence/, "server-approved high-confidence IDI contacts must clear contact review");
  assert.match(sourceHydration, /canonicalPropertyFact[\s\S]*property_owner[\s\S]*property_address[\s\S]*property_folio[\s\S]*mailing_address_signal/, "only canonical Property Appraiser facts may hydrate the owner phase fields");
  assert.match(sourceHydration, /latestDeedFact[\s\S]*deed\.sourceUrl[\s\S]*deed\.instrument/, "verified Official Records facts must hydrate the deed phase fields");
  assert.match(sourceHydration, /obituaryLinkFact[\s\S]*obituary\.sourceUrl/, "verified obituary facts must hydrate the obituary phase fields");
  assert.match(idiImport, /if \(docPrepMainRunActive\(row, "discovery"\)\) stopFullDiscoveryRun\(row, "discovery", \{ silent: true \}\);[\s\S]*await runFullDiscovery\(row, null, "discovery", \{ correctionNote: replacementReason \}\)/, "a replacement report must stop the old run and start a fresh Discovery run with its reviewed reason");
  assert.doesNotMatch(idiImport, /docPrepFlowIsComplete/, "a first valid IDI report must start replacement Discovery even when the prior flow was complete");
  assert.match(legacy, /const boundPacketRevision = Number\(packet\?\.artifact\?\.packetRevision \|\| packet\?\.packetRevision\);[\s\S]*const expectedPacketRevision = currentPacketRevision\(row, flow\.id\) \+ 1;[\s\S]*boundPacketRevision !== expectedPacketRevision/, "a generated artifact must carry the estate's exact next server-bound revision");
  assert.match(legacy, /flowState\.packetRevision = boundPacketRevision;/, "the active workflow revision must advance only from the verified stored artifact");
  assert.match(legacy, /packetRevision: Math\.max\([\s\S]*packetRevision[\s\S]*generatedPackets\?\.length/, "the public packet revision must migrate older history-backed state");
  const packetGeneration = legacy.slice(legacy.indexOf("async function generatePacketPreview"), legacy.indexOf("async function deliverPacketToGoogle"));
  assert.match(packetGeneration, /const packetRevision = currentPacketRevision\(row, flowId\) \+ 1;[\s\S]*postJson\("\/api\/exports", \{[\s\S]*packetRevision,/, "Generate Preview must bind the stored artifact to the estate's exact next workflow revision");
  const batchGeneration = legacy.slice(legacy.indexOf("async function chooseExportRoute"), legacy.indexOf("function reportStatusDetail"));
  assert.match(batchGeneration, /nextPacketRevisions = [\s\S]*currentPacketRevision\(row, state\.activeDocPrepFlow\) \+ 1/);
  assert.match(batchGeneration, /isBatch && new Set\(nextPacketRevisions\)\.size !== 1[\s\S]*Generate them separately, or bring their packet histories into alignment/, "a combined packet must stop instead of mis-binding estates on different revisions");
  assert.match(batchGeneration, /isControlledTest \? \{\} : \{ packetRevision \}/, "every non-test export request must send the verified shared next revision");
  assert.match(legacy, /id === "deliver-google-packet"/);
  const finishRun = legacy.slice(legacy.indexOf("async function finishFullDiscoveryRun"), legacy.indexOf("async function advanceFullDiscoveryFromResults"));
  const googleCommand = legacy.slice(legacy.indexOf('id === "deliver-google-packet"'), legacy.indexOf('id === "export"'));
  assert.doesNotMatch(finishRun, /deliverPacketToGoogle/, "Discovery completion must keep Google delivery behind the explicit rail command");
  assert.match(finishRun, /remains local until an operator explicitly sends it from the Completion rail/);
  assert.ok(finishRun.indexOf("snapshotFullDiscoveryOutput(row, flowId)") < finishRun.indexOf("generatePacketPreview(row"), "the prior active output must be captured before packet generation mutates runtime state");
  assert.match(finishRun, /catch \(error\) \{[\s\S]*restoreFullDiscoveryOutput\(previousOutput\)[\s\S]*setDocPrepRunState\(row, flowId, ""\)[\s\S]*setDocPrepStreamPhase[\s\S]*renderDocPrepRunSurfaces\(\)/, "thrown packet generation must restore output and expose inline retry state");
  assert.match(finishRun, /state\.exportResult\?\.blockers[\s\S]*state\.exportResult\.blockers\.join\(" "\)[\s\S]*packet verification blocked\. \$\{message\}/, "packet verification must preserve the exact operator-safe blocker after restoring the prior active output");
  assert.match(finishRun, /catch \(error\) \{[\s\S]*canonicalStateAdvanced[\s\S]*if \(!canonicalStateAdvanced\) docPrepEstateRecord\(row\)\[flowId\] = previousFlowState;[\s\S]*state\.discoveryCompleted = previousDiscoveryCompleted;[\s\S]*restoreFullDiscoveryOutput\(previousOutput\)[\s\S]*renderDocPrepRunSurfaces\(\)/, "failed packet-audit readback must restore both the prior revision and active output without overwriting a newer canonical teammate revision");
  const outputRollback = legacy.slice(legacy.indexOf("function snapshotFullDiscoveryOutput"), legacy.indexOf("function stopFullDiscoveryRun"));
  assert.match(outputRollback, /packetArtifacts[\s\S]*documentRecords[\s\S]*exportResult/);
  assert.match(outputRollback, /function restoreFullDiscoveryOutput[\s\S]*delete state\.packetArtifacts[\s\S]*delete state\.documentFiles[\s\S]*documentFilesStateKey[\s\S]*sync: false/);
  assert.match(legacy, /approval\.artifactId !== String\(packet\.artifact\?\.artifactId \|\| ""\)/, "approval must remain bound to the restored active artifact");
  assert.match(googleCommand, /await deliverPacketToGoogle\(row, packet\)/);
  assert.match(googleCommand, /if \(!currentPacketApproval\(row, flowId\)\)[\s\S]*Approve Current Packet in Case Journey/);
  assert.match(googleCommand, /if \(!googleWorkspaceDeliveryReady\(\)\)/);
  const chatgptHandoff = legacy.slice(legacy.indexOf("async function prepareChatgptWorkHandoff"), legacy.indexOf("async function openChatgptWorkHandoff"));
  assert.doesNotMatch(chatgptHandoff, /deliverPacketToGoogle/, "ChatGPT Work must not silently perform the separate Google handoff");
  const clipboardCopy = legacy.slice(legacy.indexOf("async function copyPlainTextToClipboard"), legacy.indexOf("async function prepareChatgptWorkHandoff"));
  assert.match(clipboardCopy, /try \{[\s\S]*navigator\.clipboard\.writeText[\s\S]*\} catch \{[\s\S]*document\.execCommand/, "a denied modern Clipboard write must fall through to the selected-text copy path");
  assert.match(clipboardCopy, /ClipboardUnavailableError/, "a browser with no clipboard path must enter the bounded manual-copy recovery instead of misreporting a packet failure");
  const openChatgptHandoff = legacy.slice(legacy.indexOf("async function openChatgptWorkHandoff"), legacy.indexOf("let documentActionModalInvoker"));
  assert.match(openChatgptHandoff, /canonicalStopBlocker[\s\S]*requireCurrentUnexpiredPacket/, "the ChatGPT Work continuation must preserve the estate stop and exact verified-packet gates");
  assert.match(openChatgptHandoff, /ClipboardUnavailableError[\s\S]*openManualChatgptWorkHandoff/, "a browser that blocks clipboard writes must expose the same sanitized brief for explicit keyboard copy");
  assert.ok(openChatgptHandoff.indexOf("copyPlainTextToClipboard") < openChatgptHandoff.indexOf('window.location.assign("https://chatgpt.com/")'), "the sanitized brief must reach the clipboard before same-tab navigation leaves HeirRight");
  assert.match(openChatgptHandoff, /window\.location\.assign\("https:\/\/chatgpt\.com\/"\)/, "the Codex browser must observe ChatGPT in the current tab so browser Back can restore HeirRight");
  assert.doesNotMatch(openChatgptHandoff, /window\.open|_blank|ChatGPT Work opened|opened with the review brief/, "the handoff must not claim or depend on an unobservable popup or new tab");
  const manualChatgptModal = legacy.slice(legacy.indexOf('if (modal.action === "chatgpt-work")'), legacy.indexOf("const row = selectedRow();", legacy.indexOf('if (modal.action === "chatgpt-work")')));
  assert.match(manualChatgptModal, /chatgptWorkBriefCopy[\s\S]*readonly[\s\S]*data-continue-chatgpt-work/, "manual recovery must select a read-only sanitized brief before exposing the same-tab continuation");
  assert.match(manualChatgptModal, /const row = rowById\(modal\.estateId\);/, "manual recovery must render against the estate that created the brief");
  assert.doesNotMatch(manualChatgptModal, /rowById\(modal\.estateId\) \|\| selectedRow\(\)/, "manual recovery must never silently retarget a stored brief to the newly selected estate");
  assert.match(manualChatgptModal, /data-chatgpt-work-error[\s\S]*disabled/, "a missing source estate must expose an inline error and disable continuation");
  assert.match(legacy, /event\.target === event\.currentTarget && state\.documentActionModal\.action !== "chatgpt-work"/, "a rapid second click must not retarget the manual-copy backdrop and dismiss the recovery dialog");
  assert.match(legacy, /ChatGPT Work handoff canceled\. The verified local packet remains ready\./, "an explicit manual-copy cancellation must replace the selected-brief guidance with truthful local-packet status");
  const manualChatgptOpen = legacy.slice(legacy.indexOf("function openManualChatgptWorkHandoff"), legacy.indexOf("function restoreDocumentActionModalFocus"));
  assert.match(manualChatgptOpen, /documentActionModalReturnAction = "chatgpt-work"/, "manual-copy recovery must restore focus to the completion action even when the custom-element button does not become document.activeElement");
  assert.match(manualChatgptOpen, /packetArtifactId:[\s\S]*packetRevision:/, "manual-copy recovery must bind the selected brief to the exact active packet artifact and revision");
  const modalFocusRestore = legacy.slice(legacy.indexOf("function restoreDocumentActionModalFocus"), legacy.indexOf("function closeDocumentActionModal"));
  assert.match(modalFocusRestore, /s38OpenRail[\s\S]*getClientRects/, "modal close must not strand focus on a hidden rail action when the rail closes during recovery");
  assert.match(modalFocusRestore, /aria-expanded[\s\S]*railIsOpen && currentAction/, "a rail action still visible during its close transition must not receive restored focus");
  assert.match(modalFocusRestore, /invokerInRail[\s\S]*\(!invokerInRail \|\| railIsOpen\)/, "a rail-contained invoker must only receive restored focus while the rail is actually open");
  const documentActionWiring = legacy.slice(legacy.indexOf("function wireDocumentActionModal"), legacy.indexOf("function openCrmImportModal"));
  assert.match(documentActionWiring, /querySelectorAll\("\[data-close-document-modal\]"\)\.forEach/, "every close affordance, including the footer Cancel button, must be wired");
  assert.doesNotMatch(documentActionWiring, /rowById\(modal\.estateId\) \|\| selectedRow\(\)/, "continuation must not fall back to the currently selected estate");
  assert.match(documentActionWiring, /canonicalStopBlocker[\s\S]*requireCurrentUnexpiredPacket[\s\S]*packetArtifactId[\s\S]*packetRevision/, "continuation must freshly recheck the exact estate, current packet, artifact identity, and revision");
  assert.match(documentActionWiring, /catch \(error\)[\s\S]*errorMessage\.hidden = false[\s\S]*ChatGPT Work handoff blocked/, "a changed or expired packet must recover inline without dismissing the manual-copy modal");
  const resultDrivenRun = legacy.slice(legacy.indexOf("async function advanceFullDiscoveryFromResults"), legacy.indexOf("async function runAutonomousDiscoverySources"));
  assert.doesNotMatch(resultDrivenRun, /setTimeout|\b680\b|scheduleNextFullDiscoveryPhase/, "Discovery stages must not complete from elapsed time");
  assert.match(resultDrivenRun, /assetPhaseComplete\(row, phase\.id\)/);
  assert.match(resultDrivenRun, /await finishFullDiscoveryRun\(row, flowId, phase, options\)/);
  const packetAudit = legacy.slice(legacy.indexOf("function linkGeneratedDocPrepPackets"), legacy.indexOf("function currentPacketRevision"));
  const docsResolutionIndex = packetAudit.indexOf("const docs = docsForFlow(row, dossierForRow(row), flow.id);");
  const mutableFlowStateIndex = packetAudit.indexOf("const flowState = docPrepFlowState(row, flow.id);");
  assert.ok(docsResolutionIndex > -1 && docsResolutionIndex < mutableFlowStateIndex, "packet linking must finish docsForFlow normalization before acquiring the mutable canonical flow-state record");
  assert.equal((packetAudit.match(/docsForFlow\(/g) || []).length, 1, "packet linking must not normalize or replace the estate record after acquiring its mutable flow state");
  assert.match(packetAudit, /docs\.forEach\(\(doc\) =>/);
  assert.match(packetAudit, /documents: docs\.length/);
  assert.match(packetAudit, /packetRevision: flowState\.packetRevision/);
  assert.match(packetAudit, /correctionNote/);
  assert.match(packetAudit, /verifyGeneratedPacketAuditReadback[\s\S]*persistServerState\(docPrepEstateStateKey, text\)/, "packet history must pass shared-workspace readback");
  assert.match(legacy, /const auditedPacketIds = new Set[\s\S]*generatedPackets[\s\S]*auditedPacketIds\.has\(String\(item\?\.artifactId \|\| ""\)\)/, "reload must not activate a packet reference that lacks durable packet-history readback");
  assert.match(legacy, /googleHandoffReady: googleWorkspaceDeliveryReady\(\)/);
  assert.match(legacy, /connections: state\.connections\.map\(normalizePublicConnection\)/, "real name-based connection status records must survive the public bridge");
  assert.match(legacy, /id === "remove-from-queue"/);
  assert.match(legacy, /id === "set-doc-prep-flow"/);
  assert.match(read("src/features/doc-prep/doc-prep-view.js"), /bridge\.dispatch\("set-doc-prep-flow"/);
  assert.match(read("src/features/doc-prep/doc-prep-view.js"), /nextDocPrepFlowIndex[\s\S]*ArrowRight[\s\S]*ArrowLeft/);
  assert.match(read("src/features/doc-prep/doc-prep-view.js"), /button\.addEventListener\("click", \(\) => void activateFlow\(button, \{ restoreFocus: true \}\)\)/, "click and Enter workflow activation must restore focus after the view rerenders");
  assert.match(read("src/features/doc-prep/doc-prep-view.js"), /Promise\.resolve\(\)[\s\S]*bridge\.dispatch\("select-estate", \{ estateId \}\)[\s\S]*restoreSelectFocus[\s\S]*\.catch\(\(\) =>[\s\S]*Estate selection needs attention/, "estate changes must restore keyboard focus and recover with operator-safe feedback");
  const docPrepViewSource = read("src/features/doc-prep/doc-prep-view.js");
  const documentOpenRecovery = docPrepViewSource.slice(docPrepViewSource.indexOf("onError: (error)"), docPrepViewSource.lastIndexOf("mountIdiUploadControl"));
  assert.match(documentOpenRecovery, /This document could not be opened\. Return to the selected estate file and try again\./);
  assert.doesNotMatch(documentOpenRecovery, /\? error\.message\s*:/, "document-row recovery must not expose internal command identifiers");
  assert.match(legacy, /id === "document-action"/);
  assert.match(legacy, /const allowedDocumentActions = new Set\(\["select", "preview", "replace", "remove", "queue", "download"\]\)/);
  assert.match(legacy, /state\.selectedDossierDocId = documentId;\s*if \(action === "select"\) return;/);
  assert.match(read("src/features/doc-prep/doc-prep-view.js"), /action: "select"/);
  assert.doesNotMatch(read("src/features/doc-prep/doc-prep-view.js"), /openDocumentContext[\s\S]*action: "preview"/);
  assert.match(railModule.docPrepRail.tabs.find((tab) => tab.id === "completion").actions["deliver-google-packet"].toString(), /deliver-google-packet/);
  assert.match(legacy, /documentActionModalInvoker = document\.activeElement/);
  assert.match(legacy, /s38OpenRail[\s\S]*visibleInvoker[\s\S]*visibleAction/, "file-control and handoff dialogs must restore focus to a visible invoker, action, or Case Journey trigger");
  const modalInert = legacy.slice(legacy.indexOf("function setDocumentActionModalBackgroundInert"), legacy.indexOf("function openDocumentActionModal"));
  assert.match(modalInert, /element\.inert = true/);
  assert.match(modalInert, /element\.inert = wasInert/, "the Save-new-version dialog must inert and exactly restore its background");
  assert.match(legacy, /containModalKeydown\(event, dialog, \{ onEscape: closeDocumentActionModal \}\)/);
  assert.match(legacy, /data-close-document-modal[^\n]*nucleoIcon\("close", 16\)/);
  assert.match(legacy, /runtime\.rails\.setOpen\(false\);\s*picker\.click\(\);/, "IDI replacement must expose the main-view continuation before the chooser returns");
  assert.match(read("src/features/doc-prep/idi-upload-control.js"), /#hrIdiReplacementReason[\s\S]*\[data-idi-submit\][\s\S]*scrollIntoView/, "mobile IDI replacement must reveal and focus its required main-view continuation");
  assert.equal(packageJson.dependencies["ag-grid-community"], "36.0.0");
  assert.equal(packageJson.dependencies["ag-grid-enterprise"], undefined);
  assert.doesNotMatch(lock, /ag-grid-enterprise/i);

  const allOwnedSource = `${docPrepTree}\n${gridTree}`;
  assert.doesNotMatch(allOwnedSource, /https?:\/\/(?:cdn|unpkg|fonts\.|ka-[fp]\.)/i);
  assert.doesNotMatch(allOwnedSource, /rawReportText|extraction\.text|accessToken|refreshToken/i);
  assert.doesNotMatch(allOwnedSource, /<wa-(?:file-input|combobox|date-picker|toast|data-viz)/i);
  assert.doesNotMatch(allOwnedSource, /#[0-9a-f]{3,8}\b|linear-gradient|radial-gradient|transition:\s*all|solvys-liquid-glass/i);
  const filterToggleCss = gridsCss.match(/\.hr-grid-filter-toggle \{([\s\S]*?)\}/)?.[1] || "";
  assert.match(filterToggleCss, /background:\s*transparent/);
  assert.match(filterToggleCss, /border:\s*0/);
  assert.doesNotMatch(filterToggleCss, /surface-raised|1px solid/, "the collapsed Filters disclosure must remain bare");
  assert.match(gridsCss, /\.hr-grid-filter-toggle\[aria-expanded="true"\][\s\S]*background:\s*var\(--hr-surface-selected\)/);
  assert.match(read("src/features/doc-prep/doc-prep.css"), /@media \(max-width: 900px\)/);
  assert.match(read("src/features/data-grid/grids.css"), /@media \(max-width: 900px\)/);
}

console.log(JSON.stringify({
  ok: true,
  contract: "s38-doc-prep",
  checks: [
    "selected_estate_idi_upload",
    "seven_stage_live_timeline",
    "unified_estate_bound_contact_review_actions",
    "inline_recovery_and_rerun_replacement",
    "clickable_keyboard_document_rows",
    "executable_context_rail_actions",
    "verified_google_delivery_state",
    "owner_details_requires_verified_property_appraiser_evidence",
    "exact_estate_identity_and_safe_legacy_migration",
    "discovery_and_closing_prep_flow_switch",
    "community_only_operational_grids",
    "selected_grid_rows_reach_queue",
    "admin_forms_preserved",
    "design_and_sensitive_data_boundaries",
  ],
}, null, 2));
