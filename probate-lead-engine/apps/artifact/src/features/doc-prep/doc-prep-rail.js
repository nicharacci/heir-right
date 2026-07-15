import { getLegacyBridge } from "../../core/feature-registry.js";
import { resolveDisposition } from "../case-journey/case-journey.js";
import { renderAutomationTimeline } from "./automation-timeline.js";
import { escapeFor, relativeUpdate } from "./document-row.js";
import { uiStateFor } from "./idi-upload-control.js";

function railContext(context = {}) {
  const bridge = context.bridge || getLegacyBridge();
  const snapshot = context.snapshot || context.state || bridge?.readState?.() || {};
  return { bridge, snapshot, escape: (value) => escapeFor(bridge, value) };
}

function selectedDocument(snapshot = {}) {
  return snapshot.docPrep?.documents?.find((document) => document.selected)
    || snapshot.docPrep?.documents?.[0]
    || null;
}

function activeFlowMeta(snapshot = {}) {
  const source = snapshot.docPrep?.flow;
  const id = String((source && typeof source === "object" ? source.id : source) || "discovery");
  return {
    id,
    isDiscovery: id === "discovery",
    label: id === "discovery" ? "Discovery" : String(source?.label || source?.title || "Closing Prep"),
  };
}

function sectionState(status = "pending") {
  const value = String(status || "pending").toLowerCase();
  if (/complete|exported/.test(value)) return "complete";
  if (/writing|running|active/.test(value)) return "active";
  if (/blocked|paused|failed|review/.test(value)) return "failed";
  return "pending";
}

function moveOnRailMarkup(snapshot = {}, escape = String) {
  const disposition = resolveDisposition(snapshot);
  if (disposition.label !== "Move On") return "";
  return `
    <section class="hr-docprep-rail-panel" data-docprep-move-on-stop>
      <header><p class="hr-eyebrow">Disposition</p><h2>Move On</h2><p>${escape(disposition.reason)}</p></header>
      <div class="hr-rail-actions">
        <button type="button" class="hr-text-command" data-rail-action="review-next-estate">${escape(disposition.next.label)}</button>
      </div>
    </section>
  `;
}

function renderActiveFlowTimeline(snapshot = {}, uiState = {}, escape = String) {
  const flow = activeFlowMeta(snapshot);
  const automationStatus = String(snapshot.docPrep?.automation?.status || "pending");
  const supplied = Array.isArray(snapshot.docPrep?.automation?.sections) ? snapshot.docPrep.automation.sections : [];
  const sections = supplied.length ? supplied : [{
    id: snapshot.docPrep?.currentPhase?.id || `${flow.id}-waiting`,
    title: snapshot.docPrep?.currentPhase?.label || `${flow.label} packet`,
    status: automationStatus,
  }];
  const normalized = sections.map((section, index) => {
    let state = sectionState(section.status);
    if (uiState.failedStage && state === "active") state = "failed";
    if (uiState.runStarted && !supplied.length && state === "pending") state = "active";
    return {
      id: String(section.id || `${flow.id}-${index + 1}`),
      label: String(section.title || section.label || `Section ${index + 1}`),
      state,
    };
  });
  return `
    <ol class="hr-automation-timeline" aria-label="${escape(flow.label)} automation progress" data-automation-timeline>
      ${normalized.map((section) => `
        <li class="hr-automation-stage" data-stage="${escape(section.id)}" data-state="${escape(section.state)}"${section.state === "active" ? ' aria-current="step"' : ""}>
          <span class="hr-automation-marker" aria-hidden="true"></span>
          <span class="hr-automation-stage-copy">
            <strong>${escape(section.label)}</strong>
            <span>${escape(section.state === "failed" && uiState.error
              ? uiState.error
              : ({ complete: "Written from the reviewed estate file.", active: "HeirRight is building this section now.", failed: "This section needs operator review.", pending: "Waiting for the prior section." }[section.state]))}</span>
          </span>
          <span class="hr-automation-state">${escape({ complete: "Complete", active: "In progress", failed: "Needs review", pending: "Waiting" }[section.state])}</span>
        </li>
      `).join("")}
    </ol>
  `;
}

function contactReviewStatusLabel(status = "needs_review") {
  return ({
    accepted: "Accepted",
    promoted: "Promoted",
    rejected: "Rejected",
    auto_accepted_high_confidence: "Auto accepted",
    needs_review: "Needs review",
    imported: "Needs review",
  })[String(status || "needs_review").toLowerCase()] || "Needs review";
}

function contactReviewActionLabel(status) {
  return ({ accepted: "Accept", promoted: "Promote", rejected: "Reject" })[status] || "Review";
}

function renderContactReview(snapshot = {}, escape = String) {
  const review = snapshot.docPrep?.contactReview;
  const candidates = Array.isArray(review?.candidates) ? review.candidates : [];
  if (!review?.reportRevision || !candidates.length) return "";
  const estateId = String(review.estateId || snapshot.selectedEstateId || "");
  const estateLabel = String(snapshot.selectedEstate?.title || "Selected estate");
  const needsReview = candidates.filter((candidate) => ["needs_review", "imported"].includes(String(candidate.status))).length;
  return `
    <section class="hr-contact-review" aria-labelledby="hrContactReviewTitle" data-contact-review-estate="${escape(estateId)}" data-contact-review-revision="${escape(review.reportRevision)}">
      <header>
        <span><strong id="hrContactReviewTitle">Contact review</strong><small>${escape(needsReview ? `${needsReview} need${needsReview === 1 ? "s" : ""} a decision` : "Decisions saved")}</small></span>
        <p>These contacts belong to ${escape(estateLabel)}. Accept, promote, or reject each candidate before Discovery continues.</p>
      </header>
      <div class="hr-contact-review-list">
        ${candidates.map((candidate) => {
          const candidateId = String(candidate.id || "");
          const name = String(candidate.name || "Unnamed contact");
          const status = String(candidate.status || "needs_review");
          const signals = [
            candidate.relationship || "Relationship needs review",
            candidate.ownerLastNameMatch ? "Family-name match" : "Family name unchecked",
            `${Number(candidate.phoneCount || 0)} phone${Number(candidate.phoneCount || 0) === 1 ? "" : "s"}`,
            `${Number(candidate.emailCount || 0)} email${Number(candidate.emailCount || 0) === 1 ? "" : "s"}`,
            candidate.sourceLabel || "IDI report",
          ].filter(Boolean).join(" · ");
          return `
            <article class="hr-contact-review-row" data-contact-candidate="${escape(candidateId)}" data-state="${escape(status)}">
              <div class="hr-contact-review-summary">
                <span><strong>${escape(name)}</strong><small>${escape(contactReviewStatusLabel(status))}</small></span>
                <p>${escape(signals)}</p>
              </div>
              <div class="hr-contact-review-actions" aria-label="Review ${escape(name)} for ${escape(estateLabel)}">
                ${["accepted", "promoted", "rejected"].map((nextStatus) => `
                  <button type="button" class="hr-text-command${nextStatus === "rejected" ? " hr-danger-command" : ""}" data-rail-action="review-contact-candidate" data-estate-id="${escape(estateId)}" data-candidate-id="${escape(candidateId)}" data-contact-status="${escape(nextStatus)}" data-report-revision="${escape(review.reportRevision)}" aria-label="${escape(`${contactReviewActionLabel(nextStatus)} ${name} for ${estateLabel}`)}">${escape(contactReviewActionLabel(nextStatus))}</button>
                `).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderAutomationRail(context) {
  const { bridge, snapshot, escape } = railContext(context);
  if (!bridge || !snapshot.selectedEstateId) return "<p>Select an estate to view Document Prep progress.</p>";
  const stopped = moveOnRailMarkup(snapshot, escape);
  if (stopped) return stopped;
  const flow = activeFlowMeta(snapshot);
  const state = uiStateFor(snapshot.selectedEstateId, snapshot);
  return `
    <section class="hr-docprep-rail-panel" data-docprep-rail-panel="automation">
      <header><p class="hr-eyebrow">Live automation</p><h2>${escape(flow.label)} timeline</h2><p>${escape(snapshot.selectedEstate?.title || "Selected estate")}</p></header>
      ${flow.isDiscovery ? renderAutomationTimeline(snapshot, state, escape) : renderActiveFlowTimeline(snapshot, state, escape)}
      ${flow.isDiscovery ? renderContactReview(snapshot, escape) : ""}
      ${flow.isDiscovery && state.requiresGoogle ? `
        <div class="hr-rail-guidance">
          <strong>Searchable text is needed</strong>
          <span>Connect Google Workspace for OCR, or return to Document Prep and choose a searchable PDF or DOCX.</span>
          <button type="button" class="hr-text-command" data-rail-action="google-settings">Review Google setup</button>
        </div>
      ` : ""}
    </section>
  `;
}

function renderDocumentRail(context) {
  const { snapshot, escape } = railContext(context);
  const stopped = moveOnRailMarkup(snapshot, escape);
  if (stopped) return stopped;
  const document = selectedDocument(snapshot);
  if (!document) return `
    <section class="hr-docprep-rail-panel" data-docprep-rail-panel="document">
      <header><p class="hr-eyebrow">Document</p><h2>Choose a document</h2><p>Open a document row to see its context and actions here.</p></header>
    </section>
  `;
  const isIdiReport = document.id === "idi-asset-search";
  const canReplaceIdi = Boolean(snapshot.session?.canAdminister);
  const canRemove = !isIdiReport && document.fileSource === "supporting_document";
  return `
    <section class="hr-docprep-rail-panel" data-docprep-rail-panel="document" data-document-id="${escape(document.id)}">
      <header><p class="hr-eyebrow">Selected document</p><h2>${escape(document.title)}</h2><p>${escape(document.description || "Estate packet document")}</p></header>
      <dl class="hr-document-facts">
        <div><dt>Status</dt><dd>${escape(document.hasVerifiedFile ? "Verified" : document.status || "Needs review")}</dd></div>
        <div><dt>Source</dt><dd>${escape(document.source || "Estate file")}</dd></div>
        <div><dt>Update</dt><dd>${escape(relativeUpdate(document.updatedAt))}</dd></div>
        <div><dt>Estate</dt><dd>${escape(snapshot.selectedEstate?.title || "Selected estate")}</dd></div>
      </dl>
      <section class="hr-document-overview" data-document-preview aria-labelledby="hrDocumentPreviewTitle">
        <h3 id="hrDocumentPreviewTitle">Document preview</h3>
        <p>${escape(document.description || "Review this document in the selected estate file.")}</p>
      </section>
      <div class="hr-rail-actions" aria-label="Document actions">
        ${document.hasVerifiedFile ? '<button type="button" class="hr-text-command" data-rail-action="open-document">Open verified file</button>' : ""}
        ${document.hasVerifiedFile ? '<button type="button" class="hr-text-command" data-rail-action="download-document">Download verified file</button>' : ""}
        ${isIdiReport
          ? `<button type="button" class="hr-text-command" data-rail-action="replace-document" ${canReplaceIdi ? "" : 'disabled title="A configured administrator must replace verified IDI reports"'}>Replace IDI report</button>`
          : '<button type="button" class="hr-text-command" data-rail-action="replace-document">Save new version</button>'}
        <button type="button" class="hr-text-command" data-rail-action="queue-document">Stage for export</button>
        ${canRemove ? '<button type="button" class="hr-text-command hr-danger-command" data-rail-action="remove-document">Remove supporting file</button>' : ""}
      </div>
    </section>
  `;
}

function renderCompletionRail(context) {
  const { snapshot, escape } = railContext(context);
  const stopped = moveOnRailMarkup(snapshot, escape);
  if (stopped) return stopped;
  const flow = activeFlowMeta(snapshot);
  const ready = Boolean(snapshot.docPrep?.packetVerified);
  const expired = Boolean(snapshot.docPrep?.packetExpired);
  const approved = Boolean(snapshot.docPrep?.packetApproved);
  const googleDelivered = Boolean(snapshot.docPrep?.googleDelivered);
  const googleDestination = String(snapshot.docPrep?.googleDestination || "").trim();
  const googleReady = Boolean(snapshot.docPrep?.googleHandoffReady);
  const googleHandoffDestination = String(snapshot.docPrep?.googleHandoffDestination || "").trim();
  const packetHistory = Array.isArray(snapshot.docPrep?.packetHistory) ? snapshot.docPrep.packetHistory.slice(0, 5) : [];
  return `
    <section class="hr-docprep-rail-panel" data-docprep-rail-panel="completion">
      <header><p class="hr-eyebrow">Completion</p><h2>${ready ? `${escape(flow.label)} packet ready` : `Finish ${escape(flow.label)} first`}</h2><p>${escape(ready ? "The local packet is verified and remains available without Google." : "Completion actions unlock after the active packet passes verification.")}</p></header>
      <div class="hr-completion-status" data-state="${ready ? "complete" : "pending"}">
        <strong>${ready ? "Local packet verified" : expired ? "Packet link expired" : "Packet verification pending"}</strong>
        <span>${ready ? "Reruns replace this active output and keep prior versions in the audit trail." : expired ? `Run ${escape(flow.label)} again to create a new verified packet before opening or downloading it.` : `${escape(flow.label)} must finish without a failed stage.`}</span>
      </div>
      <div class="hr-rail-actions" aria-label="Completion actions">
        ${ready ? '<button type="button" class="hr-text-command" data-rail-action="open-packet">Open current packet</button>' : ""}
        ${ready ? '<button type="button" class="hr-text-command" data-rail-action="download-packet">Download current packet</button>' : ""}
        ${flow.isDiscovery ? `<wa-button variant="brand" appearance="filled" data-rail-action="chatgpt-work" ${ready ? "" : "disabled"}>Continue in ChatGPT Work</wa-button>` : ""}
        ${googleDelivered
          ? `<div class="hr-google-delivery" data-google-delivery="verified"><strong>Saved to Google Workspace</strong><span>${escape(googleDestination || "Verified in the selected Drive folder")}</span></div>`
          : googleReady
          ? `<button type="button" class="hr-text-command" data-rail-action="deliver-google-packet" ${ready && approved ? "" : "disabled"}>Send approved packet to ${escape(googleHandoffDestination || "Google Workspace")}</button>`
          : '<button type="button" class="hr-text-command" data-rail-action="google-settings">Review optional Google setup</button>'}
      </div>
      ${ready && googleReady && !approved ? '<p class="hr-rail-footnote">Approve Current Packet in Case Journey before sending this revision to Google Workspace.</p>' : ""}
      ${packetHistory.length ? `
        <section class="hr-completion-status" aria-label="Packet revision history">
          <strong>Packet history</strong>
          ${packetHistory.map((packet) => `
            <span data-packet-revision="${escape(packet.packetRevision)}">
              Revision ${escape(packet.packetRevision)} · ${escape(packet.readbackStatus === "verified" ? "Verified" : "Needs review")}
              ${packet.correctionNote ? ` — ${escape(packet.correctionNote)}` : " — Initial packet"}
            </span>
          `).join("")}
        </section>
      ` : ""}
      ${ready && flow.isDiscovery ? '<p class="hr-rail-footnote">The copied ChatGPT Work brief includes the estate summary and verified packet link. The uploaded report text stays in HeirRight.</p>' : ""}
    </section>
  `;
}

function currentPayload(payload = {}) {
  const bridge = payload.bridge || getLegacyBridge();
  const snapshot = bridge?.readState?.() || {};
  const document = selectedDocument(snapshot);
  return {
    bridge,
    snapshot,
    estateId: String(payload.estateId || snapshot.selectedEstateId || ""),
    documentId: String(payload.documentId || document?.id || ""),
    flowId: String(payload.flowId || snapshot.docPrep?.flow?.id || snapshot.docPrep?.flow || "discovery"),
  };
}

async function runDocumentAction(action, payload) {
  const { bridge, estateId, documentId } = currentPayload(payload);
  if (!bridge || !estateId || !documentId) throw new Error("Select an estate document first.");
  return bridge.dispatch("document-action", { estateId, documentId, action });
}

async function runPacketAction(action, payload) {
  const { bridge, estateId, flowId } = currentPayload(payload);
  if (!bridge || !estateId || !flowId) throw new Error("Select an estate packet first.");
  return bridge.dispatch("packet-action", { estateId, flowId, action });
}

async function runContactReviewAction(payload = {}) {
  const { bridge, snapshot, estateId } = currentPayload(payload);
  const review = snapshot.docPrep?.contactReview;
  const candidateId = String(payload.candidateId || "");
  const status = String(payload.contactStatus || "");
  const requestedEstateId = String(payload.estateId || "");
  const requestedRevision = String(payload.reportRevision || "");
  const currentCandidates = Array.isArray(review?.candidates) ? review.candidates : [];
  if (!bridge || !estateId || !candidateId) throw new Error("Select an IDI contact candidate first.");
  if (!requestedEstateId || requestedEstateId !== estateId || String(review?.estateId || "") !== estateId) {
    throw new Error("The selected estate changed before this contact decision could be saved.");
  }
  if (!requestedRevision || requestedRevision !== String(review?.reportRevision || "")) {
    throw new Error("The IDI report changed before this contact decision could be saved.");
  }
  if (!currentCandidates.some((candidate) => String(candidate.id || "") === candidateId)) {
    throw new Error("This contact candidate is no longer part of the current IDI report.");
  }
  if (!["accepted", "promoted", "rejected"].includes(status)) throw new Error("Choose a valid contact decision.");
  return bridge.dispatch("review-contact-candidate", {
    estateId,
    candidateId,
    status,
    reportRevision: requestedRevision,
  });
}

const docPrepRail = Object.freeze({
  id: "doc-prep-context",
  label: "Document Prep",
  defaultTab: "automation",
  minWidth: 340,
  defaultWidth: 392,
  maxWidth: 480,
  mobileSheet: true,
  actions: Object.freeze({
    "review-next-estate": (payload = {}) => (payload.bridge || getLegacyBridge())?.navigate("find-estates"),
  }),
  tabs: Object.freeze([
    Object.freeze({
      id: "automation",
      label: "Automation",
      render: renderAutomationRail,
      actions: Object.freeze({
        "google-settings": () => getLegacyBridge()?.navigate("settings"),
        "review-contact-candidate": runContactReviewAction,
      }),
    }),
    Object.freeze({
      id: "document",
      label: "Document",
      render: renderDocumentRail,
      actions: Object.freeze({
        "open-document": (payload) => runDocumentAction("preview", payload),
        "replace-document": (payload) => runDocumentAction("replace", payload),
        "remove-document": (payload) => runDocumentAction("remove", payload),
        "queue-document": (payload) => runDocumentAction("queue", payload),
        "download-document": (payload) => runDocumentAction("download", payload),
      }),
    }),
    Object.freeze({
      id: "completion",
      label: "Completion",
      render: renderCompletionRail,
      actions: Object.freeze({
        "open-packet": (payload) => runPacketAction("open", payload),
        "download-packet": (payload) => runPacketAction("download", payload),
        "chatgpt-work": (payload = {}) => {
          const { bridge, estateId, flowId } = currentPayload(payload);
          return bridge.dispatch("open-chatgpt-work", { estateId, flowId });
        },
        "deliver-google-packet": (payload = {}) => {
          const { bridge, estateId, flowId } = currentPayload(payload);
          return bridge.dispatch("deliver-google-packet", { estateId, flowId });
        },
        "google-settings": () => getLegacyBridge()?.navigate("settings"),
      }),
    }),
  ]),
});

export {
  activeFlowMeta,
  docPrepRail,
  moveOnRailMarkup,
  renderAutomationRail,
  renderActiveFlowTimeline,
  renderContactReview,
  renderCompletionRail,
  renderDocumentRail,
  runPacketAction,
  runContactReviewAction,
  selectedDocument,
};
