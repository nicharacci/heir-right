import { runtime } from "../../core/feature-registry.js";
import { resolveDisposition } from "../case-journey/case-journey.js";
import { timelineState } from "./automation-timeline.js";
import { escapeFor, mountDocumentRows, renderDocumentRow } from "./document-row.js";
import { mountIdiUploadControl, renderIdiControlState, uiStateFor } from "./idi-upload-control.js";

let activeDocPrepMount = null;

function docPrepFlowMeta(snapshot = {}) {
  const source = snapshot.docPrep?.flow;
  const id = String((source && typeof source === "object" ? source.id : source) || "discovery");
  const isDiscovery = id === "discovery";
  return {
    id,
    isDiscovery,
    label: isDiscovery ? "Discovery" : String(source?.label || source?.title || "Closing Prep"),
    tabId: isDiscovery ? "hrDocPrepFlowDiscovery" : "hrDocPrepFlowClosing",
  };
}

function nextDocPrepFlowIndex(currentIndex, key, count) {
  if (!Number.isInteger(currentIndex) || currentIndex < 0 || count < 1) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight") return (currentIndex + 1) % count;
  if (key === "ArrowLeft") return (currentIndex - 1 + count) % count;
  return null;
}

function icon(bridge, name, size = 18) {
  try {
    return bridge.icon(name, size);
  } catch {
    return "";
  }
}

function buttonStartIcon(bridge, name, size = 18) {
  return `<span slot="start" class="hr-button-start-icon">${icon(bridge, name, size)}</span>`;
}

function currentStageLabel(snapshot, state) {
  const flow = docPrepFlowMeta(snapshot);
  if (!flow.isDiscovery) {
    const sections = Array.isArray(snapshot.docPrep?.automation?.sections) ? snapshot.docPrep.automation.sections : [];
    const failed = sections.find((section) => /blocked|paused|failed|review/i.test(section.status || ""));
    const active = sections.find((section) => /writing|active|running/i.test(section.status || ""));
    const complete = [...sections].reverse().find((section) => /complete|exported/i.test(section.status || ""));
    return failed?.title || active?.title || complete?.title || snapshot.docPrep?.currentPhase?.label || "Waiting to start";
  }
  const stages = timelineState(snapshot, state);
  return stages.find((stage) => stage.state === "failed")?.label
    || stages.find((stage) => stage.state === "active")?.label
    || [...stages].reverse().find((stage) => stage.state === "complete")?.label
    || "Waiting to start";
}

function displayedProgress(snapshot, state) {
  const flow = docPrepFlowMeta(snapshot);
  const hasCurrentAttempt = Boolean(
    state.file
    || state.busy
    || state.runBusy
    || state.runStarted
    || state.failedStage
    || state.status === "selected"
    || state.status === "uploading",
  );
  if (!hasCurrentAttempt) return Math.max(0, Math.min(100, Math.round(Number(snapshot.docPrep?.progress || 0))));
  if (!flow.isDiscovery) {
    const automationStatus = String(snapshot.docPrep?.automation?.status || "").toLowerCase();
    if (state.runStarted && automationStatus !== "writing" && automationStatus !== "blocked") return 0;
    const sections = Array.isArray(snapshot.docPrep?.automation?.sections) ? snapshot.docPrep.automation.sections : [];
    if (!sections.length) return Math.max(0, Math.min(100, Math.round(Number(snapshot.docPrep?.progress || 0))));
    const completed = sections.filter((section) => /complete|exported/i.test(section.status || "")).length;
    return Math.round((completed / sections.length) * 100);
  }
  const stages = timelineState(snapshot, state);
  const completed = stages.filter((stage) => stage.state === "complete").length;
  return Math.round((completed / Math.max(1, stages.length)) * 100);
}

function estateOptions(snapshot, bridge) {
  const escape = (value) => escapeFor(bridge, value);
  return (snapshot.estates || []).map((estate) => `
    <option value="${escape(estate.id)}" ${estate.id === snapshot.selectedEstateId ? "selected" : ""}>
      ${escape(estate.title)} - ${escape(estate.address)}
    </option>
  `).join("");
}

function emptyDocPrepView(bridge) {
  return `
    <section class="hr-docprep hr-docprep-empty" data-feature="doc-prep">
      <h1>Select an estate to begin</h1>
      <p>Open Estates, choose the property file, then return here to run Discovery or upload an approved IDI report.</p>
      <wa-button variant="brand" appearance="filled" data-open-estates>${buttonStartIcon(bridge, "search-estate", 17)}<span>Open Estates</span></wa-button>
    </section>
  `;
}

function renderDocPrepView({ bridge }) {
  const snapshot = bridge.readState();
  if (!snapshot.selectedEstateId || !snapshot.selectedEstate) return emptyDocPrepView(bridge);
  const escape = (value) => escapeFor(bridge, value);
  const estate = snapshot.selectedEstate;
  const disposition = resolveDisposition(snapshot);
  const moveOn = disposition.label === "Move On";
  const flow = docPrepFlowMeta(snapshot);
  const state = uiStateFor(snapshot.selectedEstateId, snapshot);
  const automationStatus = String(snapshot.docPrep?.automation?.status || "").toLowerCase();
  const running = Boolean(state.busy || state.runBusy || state.runStarted || automationStatus === "writing");
  const reportLinked = flow.isDiscovery && Boolean(snapshot.docPrep?.documents?.some((document) => (
    document.id === "idi-asset-search" || /\bIDI\b/i.test(document.title || "")
  ) && document.hasVerifiedFile));
  const runLabel = running
    ? `${flow.label} running`
    : snapshot.docPrep?.complete
      ? `Run ${flow.label} again`
      : `Run ${flow.label}`;
  const documents = snapshot.docPrep?.documents || [];
  const packetComplete = Boolean(snapshot.docPrep?.packetVerified && !state.runStarted);
  const canReplaceIdi = Boolean(snapshot.session?.canAdminister);
  const uploadLabel = reportLinked
    ? canReplaceIdi ? "Replace IDI Report" : "IDI Report linked"
    : state.file ? "Change IDI Report" : "Upload IDI Report";
  const progress = displayedProgress(snapshot, state);
  return `
    <section class="hr-docprep" data-feature="doc-prep" data-estate-id="${escape(snapshot.selectedEstateId)}">
      <header class="hr-docprep-header">
        <div class="hr-docprep-title">
          <h1>${escape(estate.title)}</h1>
          <p>${escape(estate.address)} - ${escape(estate.county)}</p>
        </div>
        <div class="hr-docprep-header-controls">
          <div class="hr-docprep-flow-switch beui-tabs" role="tablist" aria-label="Document Prep workflow" aria-orientation="horizontal">
            <button id="hrDocPrepFlowDiscovery" class="beui-tabs-trigger" type="button" role="tab" tabindex="${flow.isDiscovery ? "0" : "-1"}" aria-controls="hrDocPrepFlowPanel" aria-selected="${flow.isDiscovery ? "true" : "false"}" data-docprep-flow="discovery">Discovery</button>
            <button id="hrDocPrepFlowClosing" class="beui-tabs-trigger" type="button" role="tab" tabindex="${flow.id === "closing-docs" ? "0" : "-1"}" aria-controls="hrDocPrepFlowPanel" aria-selected="${flow.id === "closing-docs" ? "true" : "false"}" data-docprep-flow="closing-docs">Closing Prep</button>
          </div>
          <label class="hr-estate-picker">
            <span>Selected estate</span>
            <select data-docprep-estate-select aria-label="Selected estate">
              ${estateOptions(snapshot, bridge)}
            </select>
          </label>
          <p class="hr-document-open-status hr-estate-picker-status" data-docprep-estate-status role="status" aria-live="polite" hidden></p>
        </div>
      </header>

      <section id="hrDocPrepFlowPanel" class="hr-discovery-command" role="tabpanel" aria-labelledby="${flow.tabId}">
        <div class="hr-discovery-command-copy">
          <h2>${moveOn ? "Move On" : flow.isDiscovery ? "Build the Discovery packet" : "Prepare the Closing packet"}</h2>
          <p>${moveOn
            ? escape(disposition.reason)
            : flow.isDiscovery
            ? "Run the source review now, or attach the operator-pulled IDI Core report. A valid report is linked to this estate and starts Discovery automatically."
            : "Use the reviewed Discovery file to prepare title clearance, seller approval, underwriting, and the combined Closing Prep PDF. IDI report uploads remain in Discovery."}</p>
        </div>
        <div class="hr-discovery-actions">
          ${moveOn ? `
          <wa-button variant="brand" appearance="filled" data-open-estates>
            ${buttonStartIcon(bridge, "estates", 17)}<span>${escape(disposition.next.label)}</span>
          </wa-button>
          ` : `${flow.isDiscovery ? `<button
            class="hr-upload-command hr-public-sources-command"
            type="button"
            data-run-public-sources
            data-beui-component="button"
            aria-label="Run configured public sources for ${escape(estate.title)}"
          >${icon(bridge, "search-estate", 17)}<span>Run Public Sources</span></button>
          <button
            class="hr-upload-command hr-idi-report-command"
            type="button"
            data-idi-picker
            data-beui-component="button"
            ${state.busy || (reportLinked && !canReplaceIdi) ? "disabled" : ""}
            aria-label="${reportLinked ? "Replace" : "Upload"} IDI Report for ${escape(estate.title)}"
            title="${reportLinked && !canReplaceIdi ? "A configured administrator must replace verified reports" : uploadLabel}"
          >${icon(bridge, "batch-tray", 17)}<span>${escape(uploadLabel)}</span></button>
          <input
            type="file"
            hidden
            data-idi-file-input
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            aria-label="Choose an IDI report PDF or DOCX file"
          >` : ""}
          <wa-button class="beui-button" variant="brand" appearance="filled" data-run-discovery ${running ? "disabled loading" : ""}>
            ${buttonStartIcon(bridge, "magnifier-route", 17)}<span>${escape(runLabel)}</span>
          </wa-button>`}
        </div>
        <div class="hr-discovery-progress">
          <span><strong>${escape(currentStageLabel(snapshot, state))}</strong><span>${escape(`${progress}% complete`)}</span></span>
          <wa-progress-bar class="beui-progress" value="${escape(progress)}" aria-label="${escape(flow.label)} progress"></wa-progress-bar>
        </div>
        ${moveOn ? "" : renderIdiControlState(snapshot, state, bridge)}
        ${packetComplete && !moveOn ? `
          <div class="hr-local-completion" data-local-packet-complete>
            <span>${icon(bridge, "check-circle", 18)}</span>
            <span><strong>${escape(flow.label)} packet verified</strong><span>The active local packet is ready here. Google Workspace is an optional handoff and can be set up afterward.</span></span>
            <button type="button" class="hr-text-command" data-open-completion-actions>Open completion actions</button>
          </div>
        ` : ""}
      </section>

      <section class="hr-documents" aria-labelledby="hrDocumentsTitle">
        <header class="hr-section-heading">
          <div>
            <h2 id="hrDocumentsTitle">Documents</h2>
          </div>
          <span>${escape(`${documents.length} document${documents.length === 1 ? "" : "s"}`)}</span>
        </header>
        <div class="hr-document-list" aria-label="Estate documents">
          ${documents.map((document) => renderDocumentRow(document, bridge)).join("") || `
            <div class="hr-documents-empty"><strong>No documents are staged yet.</strong><span>Run Discovery to build the first reviewed packet.</span></div>
          `}
        </div>
        <p class="hr-document-open-status" data-document-open-status role="status" aria-live="polite" hidden></p>
      </section>
    </section>
  `;
}

function refreshDocPrepView(bridge) {
  const mount = activeDocPrepMount;
  if (!mount?.isConnected || bridge.readState().activeView !== "dossiers") return;
  mount.innerHTML = renderDocPrepView({ bridge });
  mountDocPrepView(mount, bridge);
}

async function openDocumentContext({ bridge, estateId, documentId }) {
  if (!estateId || bridge.selectedEstateId() !== estateId) {
    throw new Error("The estate changed. Return to the estate whose document you want to open and try again.");
  }
  await bridge.dispatch("document-action", { estateId, documentId, action: "select" });
  runtime.rails.activate("doc-prep-context", { tab: "document", open: true });
}

async function startPublicSourceSearch({ bridge, snapshot, refresh }) {
  const estateId = snapshot?.selectedEstateId;
  if (!estateId) throw new Error("Select an estate before running the public sources.");
  try {
    const result = await bridge.dispatch("run-source-search", { estateId });
    bridge.emit(
      "Public source review finished",
      "The current estate now shows the returned evidence and any truthful source blockers.",
      "ready",
    );
    return result;
  } catch (error) {
    bridge.emit(
      "Public source review needs attention",
      error instanceof Error ? error.message : "The configured public sources could not run.",
      "blocked",
    );
    throw error;
  } finally {
    refresh?.();
  }
}

function mountDocPrepView(mount, bridge) {
  if (!mount || !bridge) return;
  activeDocPrepMount = mount;
  mount.classList.add("hr-docprep-mount");
  const snapshot = bridge.readState();
  mount.querySelector("[data-open-estates]")?.addEventListener("click", () => bridge.navigate("find-estates"));
  mount.querySelector("[data-docprep-estate-select]")?.addEventListener("change", (event) => {
    const select = event.currentTarget;
    const estateId = select.value;
    const status = mount.querySelector("[data-docprep-estate-status]");
    if (status) {
      status.hidden = true;
      status.textContent = "";
    }
    select.disabled = true;
    select.setAttribute("aria-busy", "true");
    const restoreSelectFocus = (message = "") => {
      const currentMount = activeDocPrepMount;
      const currentSelect = currentMount?.querySelector?.("[data-docprep-estate-select]");
      const currentStatus = currentMount?.querySelector?.("[data-docprep-estate-status]");
      if (message && currentStatus) {
        currentStatus.textContent = message;
        currentStatus.hidden = false;
      }
      if (currentSelect) {
        currentSelect.disabled = false;
        currentSelect.removeAttribute?.("aria-busy");
      }
      currentSelect?.focus?.({ preventScroll: true });
    };
    void Promise.resolve()
      .then(() => bridge.dispatch("select-estate", { estateId }))
      .then(() => {
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => restoreSelectFocus());
        else restoreSelectFocus();
      })
      .catch(() => {
        const message = "The selected estate could not be opened. Review the estate list and try again.";
        select.value = snapshot.selectedEstateId;
        select.disabled = false;
        select.removeAttribute("aria-busy");
        restoreSelectFocus(message);
        bridge.emit("Estate selection needs attention", message, "blocked");
      });
  });
  const flowButtons = [...mount.querySelectorAll("[data-docprep-flow]")];
  const activateFlow = (button, { restoreFocus = false } = {}) => {
    const flowId = button.dataset.docprepFlow;
    return Promise.resolve(bridge.dispatch("set-doc-prep-flow", {
      estateId: snapshot.selectedEstateId,
      flowId,
    })).then(() => {
      if (!restoreFocus) return;
      const focusSelectedFlow = () => activeDocPrepMount
        ?.querySelector?.(`[data-docprep-flow="${flowId}"]`)
        ?.focus?.({ preventScroll: true });
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(focusSelectedFlow);
      else focusSelectedFlow();
    }).catch((error) => {
      bridge.emit(
        "Document Prep workflow did not switch",
        error instanceof Error ? error.message : "Review the selected estate and try again.",
        "blocked",
      );
      button.focus?.({ preventScroll: true });
    });
  };
  flowButtons.forEach((button, index) => {
    button.addEventListener("click", () => void activateFlow(button, { restoreFocus: true }));
    button.addEventListener("keydown", (event) => {
      const nextIndex = nextDocPrepFlowIndex(index, event.key, flowButtons.length);
      if (nextIndex === null) return;
      event.preventDefault();
      const nextButton = flowButtons[nextIndex];
      nextButton?.focus?.({ preventScroll: true });
      if (nextButton && nextButton !== button) void activateFlow(nextButton, { restoreFocus: true });
    });
  });
  mountDocumentRows(
    mount,
    (documentId) => openDocumentContext({
      bridge,
      estateId: snapshot.selectedEstateId,
      documentId,
    }),
    {
      onStart: () => {
        const status = mount.querySelector("[data-document-open-status]");
        if (status) {
          status.hidden = true;
          status.textContent = "";
        }
      },
      onError: (error) => {
        const message = error instanceof Error && error.message.startsWith("The estate changed.")
          ? "The estate changed. Return to that estate file and try again."
          : "This document could not be opened. Return to the selected estate file and try again.";
        const status = mount.querySelector("[data-document-open-status]");
        if (status) {
          status.textContent = message;
          status.hidden = false;
        }
        bridge.emit("Document could not open", message, "blocked");
      },
    },
  );
  mount.querySelector("[data-run-public-sources]")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    void startPublicSourceSearch({
      bridge,
      snapshot,
      refresh: () => refreshDocPrepView(bridge),
    }).catch(() => {
      // The shared runner and the bridge event retain the blocker. The refreshed
      // view restores a usable control without losing the prior verified capture.
    });
  });
  mountIdiUploadControl(mount, {
    bridge,
    snapshot,
    refresh: () => refreshDocPrepView(bridge),
  });
}

function unmountDocPrepView(mount) {
  mount?.classList?.remove("hr-docprep-mount");
  if (activeDocPrepMount === mount) activeDocPrepMount = null;
}

export { displayedProgress, docPrepFlowMeta, mountDocPrepView, nextDocPrepFlowIndex, refreshDocPrepView, renderDocPrepView, startPublicSourceSearch, unmountDocPrepView };
