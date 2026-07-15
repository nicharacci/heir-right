import { runtime } from "../../core/feature-registry.js";
import { reportIsLinked } from "./automation-timeline.js";
import { escapeFor } from "./document-row.js";

const maxIdiReportBytes = 3_000_000;
const uiByEstate = new Map();
const importedStageIds = Object.freeze([
  "upload-received",
  "secure-readback",
  "report-extracted",
  "idi-facts-linked",
]);

function freshUiState(estateId, flowId = "discovery", flowLabel = "Discovery") {
  return {
    estateId,
    flowId,
    flowLabel,
    file: null,
    status: "idle",
    busy: false,
    runBusy: false,
    runStarted: false,
    runSeenWriting: false,
    rerunOpen: false,
    rerunNote: "",
    replacementReason: "",
    activeStage: null,
    failedStage: null,
    completedStages: [],
    baselinePacketRevision: null,
    error: "",
    requiresGoogle: false,
    focusError: false,
    focusReplacement: false,
  };
}

function uiStateFor(estateId, snapshot = null) {
  const flowId = String(snapshot?.docPrep?.flow?.id || "discovery");
  const flowLabel = String(snapshot?.docPrep?.flow?.label || snapshot?.docPrep?.flow?.title || (flowId === "closing-docs" ? "Closing Prep" : "Discovery"));
  const estateKey = String(estateId || "");
  const key = `${estateKey}:${flowId}`;
  if (!uiByEstate.has(key)) uiByEstate.set(key, freshUiState(estateKey, flowId, flowLabel));
  const state = uiByEstate.get(key);
  if (snapshot) synchronizeUiState(state, snapshot);
  return state;
}

function synchronizeUiState(state, snapshot) {
  const isDiscovery = state.flowId === "discovery";
  const automationStatus = String(snapshot.docPrep?.automation?.status || "").toLowerCase();
  const packetRevision = Math.max(0, Number(snapshot.docPrep?.packetRevision || 0));
  const newReportPending = Boolean(state.file || state.busy || state.status === "selected" || state.status === "uploading");
  const hasRunBaseline = Number.isFinite(state.baselinePacketRevision);
  const packetAdvanced = hasRunBaseline && packetRevision > state.baselinePacketRevision;
  if (isDiscovery && reportIsLinked(snapshot)) {
    state.completedStages = [...new Set([...state.completedStages, ...importedStageIds])];
    if (state.status === "idle") state.status = "success";
  }
  if (state.runStarted && automationStatus === "writing") state.runSeenWriting = true;
  if (state.runStarted && automationStatus === "blocked") {
    state.runStarted = false;
    state.runBusy = false;
    state.activeStage = null;
    state.failedStage = "discovery-running";
    state.error ||= "Discovery needs an operator review before the packet can continue.";
  }
  if (state.runStarted && snapshot.docPrep?.packetVerified && packetAdvanced) {
    state.runStarted = false;
    state.runBusy = false;
    state.runSeenWriting = false;
    state.activeStage = null;
    state.failedStage = null;
    state.error = "";
  }
  if (snapshot.docPrep?.packetVerified && !state.runStarted && !newReportPending && (!state.failedStage || packetAdvanced)) {
    state.completedStages = [
      ...importedStageIds,
      "discovery-running",
      "packet-verified",
      "ready-for-review",
    ];
    state.activeStage = null;
    if (state.failedStage === "discovery-running") {
      state.failedStage = null;
      state.error = "";
    }
  }
  return state;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function reportKind(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".docx")) return "DOCX";
  return "";
}

function validateIdiReport(file) {
  if (!file) return "Choose an IDI report PDF or DOCX file.";
  if (!reportKind(file)) return "Choose a PDF or DOCX report. Legacy DOC and CSV files are not accepted here.";
  if (Number(file.size || 0) > maxIdiReportBytes) return "Choose a report that is 3 MB or smaller.";
  return "";
}

function operatorError(error, operationLabel = "") {
  const raw = String(error?.message || error || "").replace(/\s+/g, " ").trim();
  if (/3\s*MB|too large|size limit/i.test(raw)) return "Choose a report that is 3 MB or smaller.";
  if (/Sample estates stay isolated|production source runs|production packet export/i.test(raw)) {
    return "Sample estates cannot run production Discovery. Open an imported estate to build and verify its packet.";
  }
  if (/packet|generated PDF|PDF verification/i.test(raw)) return "Discovery finished its research steps, but the new packet could not be verified. Review the blocker and retry the run.";
  if (/PDF|DOCX|content type|unsupported|legacy DOC|CSV/i.test(raw)) return "Choose a searchable PDF or DOCX report.";
  if (/scanned|image[- ]only|OCR|no readable|no text|searchable text/i.test(raw)) {
    return "This report appears to be scanned or image-only. Connect Google Workspace for OCR, or choose a searchable PDF or DOCX.";
  }
  if (/duplicate|already has|first import/i.test(raw)) return "This estate already has an imported IDI report. Review the current report before replacing it.";
  if (/administrator|admin override|replacement reason|why .*replac/i.test(raw)) return "A configured administrator must explain why the verified IDI report is being replaced.";
  if (/Owner Details|Property Appraiser/i.test(raw)) return "The IDI report is linked. Owner Details still needs verified Property Appraiser evidence before Discovery can continue.";
  if (/Tax receipt|Tax Collector/i.test(raw)) return "The IDI report is linked. Tax receipt evidence still needs operator review before Discovery can continue.";
  if (/Latest deed|Official Records/i.test(raw)) return "The IDI report is linked. Deed evidence still needs operator review before Discovery can continue.";
  if (/Obituary review|obituary/i.test(raw)) return "The IDI report is linked. Obituary evidence still needs operator review before Discovery can continue.";
  if (/Contact review/i.test(raw)) return "The IDI report is linked. At least one eligible contact still needs an accepted or promoted decision before Discovery can continue.";
  if (/source search|Discovery source|public source/i.test(raw)) return "The IDI report is linked, but Discovery needs a source review before it can continue.";
  if (/readback|stored file|artifact verification/i.test(raw)) return "HeirRight could not confirm the saved report. Retry the same file or choose another copy.";
  if (/estate is unavailable|select an available estate|estate changed/i.test(raw)) return "The selected estate changed before the report finished. Return to that estate and retry.";
  if (/network|fetch|connection|offline/i.test(raw)) return "The report could not reach HeirRight. Check the connection and retry the same file.";
  return operationLabel
    ? `${operationLabel} could not be completed. Review the current step and retry the run.`
    : "The IDI report could not be completed. Retry the same file or choose another copy.";
}

function failedStageFor(message) {
  if (/readback|stored file/i.test(message)) return "secure-readback";
  if (/scanned|image-only|OCR|searchable|extract|read/i.test(message)) return "report-extracted";
  if (/facts|linked|provenance|import/i.test(message)) return "idi-facts-linked";
  if (/Discovery|source review/i.test(message)) return "discovery-running";
  if (/packet|verification/i.test(message)) return "packet-verified";
  return "upload-received";
}

function completedBefore(stageId) {
  const ordered = [
    "upload-received",
    "secure-readback",
    "report-extracted",
    "idi-facts-linked",
    "discovery-running",
    "packet-verified",
    "ready-for-review",
  ];
  return ordered.slice(0, Math.max(0, ordered.indexOf(stageId)));
}

function selectIdiReportFile(state, file, { focusReplacement = false } = {}) {
  const validation = validateIdiReport(file);
  if (validation) {
    state.file = null;
    state.focusReplacement = false;
    markFailure(state, validation, "upload-received");
    return validation;
  }
  state.file = file;
  state.status = "selected";
  state.error = "";
  state.failedStage = null;
  state.activeStage = null;
  state.completedStages = [];
  state.baselinePacketRevision = null;
  state.runStarted = false;
  state.runSeenWriting = false;
  state.requiresGoogle = false;
  state.focusReplacement = focusReplacement;
  return "";
}

function markFailure(state, error, forcedStage = "", operationLabel = "") {
  const message = operatorError(error, operationLabel);
  const stage = forcedStage || failedStageFor(message);
  state.status = "failed";
  state.busy = false;
  state.runBusy = false;
  state.runStarted = false;
  state.runSeenWriting = false;
  state.activeStage = null;
  state.failedStage = stage;
  state.completedStages = [...new Set([...state.completedStages, ...completedBefore(stage)])];
  state.error = message;
  state.requiresGoogle = state.flowId === "discovery" && /scanned|image-only|OCR/i.test(message);
  state.focusError = true;
  return state;
}

function activitySignature(event) {
  return event ? `${event.title}|${event.copy}|${event.updatedAt}` : "";
}

function activityCursor(snapshot = {}) {
  const activity = Array.isArray(snapshot.activity) ? snapshot.activity : [];
  return {
    newestAt: Math.max(0, ...activity.map((event) => Number(event.updatedAt || 0)).filter(Number.isFinite)),
    signatures: new Set(activity.map(activitySignature)),
  };
}

function latestFailure(snapshot, cursor = { newestAt: 0, signatures: new Set() }) {
  return (snapshot.activity || []).find((event) => (
    (
      Number(event.updatedAt || 0) > Number(cursor.newestAt || 0)
      || !cursor.signatures.has(activitySignature(event))
    )
    && /blocked|failed|needs review|could not/i.test(`${event.title} ${event.copy}`)
  )) || null;
}

function safelyActivateRail(tab = "automation") {
  try {
    runtime.rails.activate("doc-prep-context", { tab, open: true });
  } catch {
    // The main workflow remains usable while the shell rail is mounting.
  }
}

async function uploadSelectedReport({ bridge, snapshot, state, refresh }) {
  if (state.busy) return;
  const validation = validateIdiReport(state.file);
  if (validation) {
    markFailure(state, validation, "upload-received");
    refresh();
    return;
  }
  const estateId = state.estateId;
  if (!estateId || bridge.selectedEstateId() !== estateId) {
    markFailure(state, "The estate changed before upload.", "upload-received");
    refresh();
    return;
  }
  const beforeLinked = reportIsLinked(snapshot);
  const replacementReason = String(state.replacementReason || "").replace(/\s+/g, " ").trim();
  if (beforeLinked && !snapshot.session?.canAdminister) {
    markFailure(state, "A configured administrator must approve this IDI report replacement.", "upload-received");
    refresh();
    return;
  }
  if (beforeLinked && replacementReason.length < 12) {
    markFailure(state, "Add a specific replacement reason before changing the verified IDI report.", "upload-received");
    refresh();
    return;
  }
  const beforeActivity = activityCursor(snapshot);
  state.baselinePacketRevision = Math.max(0, Number(snapshot.docPrep?.packetRevision || 0));
  state.busy = true;
  state.status = "uploading";
  state.error = "";
  state.failedStage = null;
  state.activeStage = "upload-received";
  state.completedStages = [];
  state.requiresGoogle = false;
  safelyActivateRail("automation");
  refresh();
  try {
    const result = await bridge.dispatch("upload-idi-report", {
      estateId,
      file: state.file,
      ...(beforeLinked ? { adminOverrideReason: replacementReason } : {}),
    });
    const failure = latestFailure(result, beforeActivity);
    const resultMatchesEstate = String(result.selectedEstateId || "") === estateId;
    const linked = resultMatchesEstate ? reportIsLinked(result) : !failure;
    if (failure && (!linked || beforeLinked || /Discovery|source/i.test(`${failure.title} ${failure.copy}`))) {
      if (linked && /Discovery|source/i.test(`${failure.title} ${failure.copy}`)) {
        state.file = null;
        state.status = "success";
        state.completedStages = [...importedStageIds];
        markFailure(state, `${failure.title}. ${failure.copy}`, "discovery-running");
        state.status = "success";
      } else {
        markFailure(state, `${failure.title}. ${failure.copy}`);
      }
      return;
    }
    if (!linked) {
      markFailure(state, "The report did not finish extraction.", "report-extracted");
      return;
    }
    state.status = "success";
    state.file = null;
    state.replacementReason = "";
    state.completedStages = [...importedStageIds];
    const packetAdvanced = resultMatchesEstate && Number(result.docPrep?.packetRevision || 0) > state.baselinePacketRevision;
    const runComplete = Boolean(resultMatchesEstate && result.docPrep?.packetVerified && packetAdvanced);
    state.activeStage = runComplete ? null : "discovery-running";
    state.failedStage = null;
    state.error = "";
    state.runStarted = !runComplete;
    state.runSeenWriting = String(result.docPrep?.automation?.status || "").toLowerCase() === "writing";
    if (runComplete) {
      state.completedStages = [
        ...importedStageIds,
        "discovery-running",
        "packet-verified",
        "ready-for-review",
      ];
    }
  } catch (error) {
    markFailure(state, error);
  } finally {
    state.busy = false;
    refresh();
  }
}

async function startDiscovery({ bridge, snapshot, state, refresh, correctionNote = "" }) {
  if (state.runBusy || state.busy) return;
  const estateId = state.estateId;
  const flowId = String(state.flowId || snapshot.docPrep?.flow?.id || "discovery");
  const flowLabel = String(state.flowLabel || snapshot.docPrep?.flow?.label || (flowId === "closing-docs" ? "Closing Prep" : "Discovery"));
  if (!estateId || bridge.selectedEstateId() !== estateId) {
    markFailure(state, `The estate changed before ${flowLabel} started.`, "discovery-running", flowLabel);
    refresh();
    return;
  }
  const note = String(correctionNote || "").trim();
  if (snapshot.docPrep?.complete && note.length < 8) {
    state.rerunOpen = true;
    state.error = "Add a short correction note before replacing the active packet.";
    state.failedStage = null;
    state.focusError = true;
    refresh();
    return;
  }
  const beforeActivity = activityCursor(snapshot);
  state.baselinePacketRevision = Math.max(0, Number(snapshot.docPrep?.packetRevision || 0));
  state.runBusy = true;
  state.runStarted = true;
  state.runSeenWriting = false;
  state.rerunOpen = false;
  state.rerunNote = "";
  state.error = "";
  state.failedStage = null;
  state.activeStage = "discovery-running";
  state.completedStages = flowId === "discovery" && reportIsLinked(snapshot) ? [...importedStageIds] : [];
  if (note) bridge.emit(`${flowLabel} rerun requested`, `Correction for ${snapshot.selectedEstate?.title || "this estate"}: ${note}`, "review");
  safelyActivateRail("automation");
  refresh();
  try {
    const result = await bridge.dispatch("run-discovery", {
      estateId,
      flowId,
      ...(note ? { correctionNote: note } : {}),
    });
    const failure = latestFailure(result, beforeActivity);
    if (failure) {
      markFailure(state, `${failure.title}. ${failure.copy}`, "discovery-running", flowLabel);
      return;
    }
    if (String(result.selectedEstateId || "") === estateId) {
      state.runSeenWriting = String(result.docPrep?.automation?.status || "").toLowerCase() === "writing";
      synchronizeUiState(state, result);
    }
  } catch (error) {
    markFailure(state, error, "discovery-running", flowLabel);
  } finally {
    state.runBusy = false;
    refresh();
  }
}

function renderIdiControlState(snapshot, state, bridge) {
  const escape = (value) => escapeFor(bridge, value);
  const file = state.file;
  const isDiscovery = state.flowId === "discovery";
  const flowLabel = state.flowLabel || (isDiscovery ? "Discovery" : "Closing Prep");
  const replacing = isDiscovery && reportIsLinked(snapshot);
  const replacementGuard = replacing && !snapshot.session?.canAdminister ? `
    <div class="hr-inline-recovery" data-idi-replacement-guard>
      <strong>Verified report linked</strong>
      <span>A configured administrator can replace this report with a new PDF or DOCX and must record the reason.</span>
    </div>
  ` : "";
  const review = isDiscovery && file ? `
    <div class="hr-idi-file-review" data-idi-file-review>
      <span class="hr-idi-file-copy">
        <strong>${escape(file.name)}</strong>
        <span>${escape(reportKind(file) || "Report")} - ${escape(formatBytes(file.size))}</span>
      </span>
      <span class="hr-idi-file-actions">
        <button type="button" class="hr-text-command" data-idi-choose-another ${state.busy ? "disabled" : ""}>Choose another</button>
        <button type="button" class="hr-text-command" data-idi-remove ${state.busy ? "disabled" : ""}>Remove</button>
        <wa-button variant="brand" appearance="filled" data-idi-submit ${state.busy ? "disabled loading" : ""}>${state.busy ? "Uploading report" : replacing ? "Replace and rerun Discovery" : "Upload and run Discovery"}</wa-button>
      </span>
      ${replacing ? `
        <label class="hr-idi-replacement-reason" for="hrIdiReplacementReason">
          <span>Why is this verified report being replaced?</span>
          <textarea id="hrIdiReplacementReason" rows="2" minlength="12" required data-idi-replacement-reason placeholder="Describe the corrected or updated report.">${escape(state.replacementReason)}</textarea>
        </label>
      ` : ""}
    </div>
  ` : "";
  const error = state.error ? `
    <div class="hr-inline-recovery" role="alert" tabindex="-1" data-idi-error>
      <strong>${escape(state.failedStage === "discovery-running" ? `${flowLabel} needs review` : "Report needs attention")}</strong>
      <span>${escape(state.error)}</span>
      <span class="hr-inline-actions">
        ${state.file && state.failedStage !== "discovery-running"
          ? `<button type="button" class="hr-text-command" data-idi-retry ${state.busy ? "disabled" : ""}>Retry</button>`
          : ""}
        ${state.failedStage === "discovery-running"
          ? `<button type="button" class="hr-text-command" data-idi-retry ${state.runBusy ? "disabled" : ""}>Retry ${escape(flowLabel)}</button>`
          : isDiscovery
            ? `<button type="button" class="hr-text-command" data-idi-choose-another ${state.busy ? "disabled" : ""}>Choose another file</button>`
            : `<button type="button" class="hr-text-command" data-idi-retry ${state.runBusy ? "disabled" : ""}>Retry ${escape(flowLabel)}</button>`}
        ${state.requiresGoogle ? '<button type="button" class="hr-text-command" data-open-google-settings>Review Google setup</button>' : ""}
      </span>
    </div>
  ` : "";
  const rerun = state.rerunOpen ? `
    <form class="hr-rerun-form" data-docprep-rerun-form>
      <label for="hrPacketCorrection">What changed?</label>
      <textarea id="hrPacketCorrection" name="correction" rows="3" required minlength="8" placeholder="Describe the corrected source or estate fact.">${escape(state.rerunNote)}</textarea>
      <span class="hr-inline-actions">
        <button type="button" class="hr-text-command" data-rerun-cancel>Cancel</button>
        <wa-button type="submit" variant="brand" appearance="filled" data-rerun-submit>Replace active packet</wa-button>
      </span>
    </form>
  ` : "";
  return `${replacementGuard}${review}${error}${rerun}`;
}

function focusRecovery(state, root) {
  if (!state.focusError && !state.focusReplacement) return;
  const selectors = state.focusReplacement
    ? ["#hrIdiReplacementReason", "[data-idi-submit]"]
    : ["[data-idi-error]", "#hrPacketCorrection"];
  state.focusError = false;
  state.focusReplacement = false;
  const focus = () => {
    const target = selectors.map((selector) => root?.querySelector?.(selector)).find(Boolean);
    target?.scrollIntoView?.({ block: "center", inline: "nearest" });
    target?.focus?.({ preventScroll: true });
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(focus);
  else focus();
}

function mountIdiUploadControl(root, { bridge, snapshot, refresh }) {
  if (!root || !bridge || !snapshot?.selectedEstateId) return;
  const state = uiStateFor(snapshot.selectedEstateId, snapshot);
  const fileInput = root.querySelector("[data-idi-file-input]");
  root.querySelectorAll("[data-idi-picker], [data-idi-choose-another]").forEach((button) => {
    button.addEventListener("click", () => fileInput?.click());
  });
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0] || null;
    selectIdiReportFile(state, file, { focusReplacement: reportIsLinked(snapshot) });
    refresh();
  });
  root.querySelector("[data-idi-replacement-reason]")?.addEventListener("input", (event) => {
    state.replacementReason = String(event.currentTarget.value || "");
  });
  root.querySelector("[data-idi-remove]")?.addEventListener("click", () => {
    state.file = null;
    state.status = "idle";
    state.error = "";
    state.failedStage = null;
    state.activeStage = null;
    state.completedStages = [];
    state.baselinePacketRevision = null;
    state.runStarted = false;
    state.runSeenWriting = false;
    state.requiresGoogle = false;
    state.replacementReason = "";
    state.focusReplacement = false;
    refresh();
  });
  root.querySelector("[data-idi-submit]")?.addEventListener("click", () => uploadSelectedReport({ bridge, snapshot, state, refresh }));
  root.querySelector("[data-idi-retry]")?.addEventListener("click", () => {
    if (state.failedStage === "discovery-running") startDiscovery({ bridge, snapshot, state, refresh });
    else uploadSelectedReport({ bridge, snapshot, state, refresh });
  });
  root.querySelector("[data-run-discovery]")?.addEventListener("click", () => {
    if (snapshot.docPrep?.complete) {
      state.rerunOpen = true;
      state.error = "";
      refresh();
      return;
    }
    startDiscovery({ bridge, snapshot, state, refresh });
  });
  root.querySelector("[data-rerun-cancel]")?.addEventListener("click", () => {
    state.rerunOpen = false;
    state.rerunNote = "";
    state.error = "";
    refresh();
  });
  const rerunForm = root.querySelector("[data-docprep-rerun-form]");
  const submitRerun = (event) => {
    event.preventDefault();
    const note = rerunForm?.querySelector?.("#hrPacketCorrection")?.value
      ?? new FormData(rerunForm).get("correction");
    state.rerunNote = String(note || "");
    startDiscovery({ bridge, snapshot, state, refresh, correctionNote: note });
  };
  rerunForm?.addEventListener("submit", submitRerun);
  rerunForm?.querySelector?.("[data-rerun-submit]")?.addEventListener("click", submitRerun);
  root.querySelector("[data-open-google-settings]")?.addEventListener("click", () => bridge.navigate("settings"));
  root.querySelector("[data-open-completion-actions]")?.addEventListener("click", () => safelyActivateRail("completion"));
  focusRecovery(state, root);
}

export {
  activityCursor,
  formatBytes,
  importedStageIds,
  latestFailure,
  maxIdiReportBytes,
  mountIdiUploadControl,
  operatorError,
  renderIdiControlState,
  reportKind,
  selectIdiReportFile,
  startDiscovery,
  uiStateFor,
  uploadSelectedReport,
  validateIdiReport,
};
