import { iconMarkup } from "../../ui/icon-facade.js";
import { runtime } from "../../core/feature-registry.js";
import {
  buildJourneyTimeline,
  buildLifecycle,
  resolveDisposition,
} from "./case-journey.js";

function safe(bridge, value) {
  return bridge.escapeHtml(String(value ?? ""));
}

function timeLabel(value) {
  const timestamp = Number(value || 0);
  if (!timestamp) return "Awaiting an update";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.max(1, Math.round(elapsed / 60_000))} min ago`;
  if (elapsed < 86_400_000) return `${Math.max(1, Math.round(elapsed / 3_600_000))} hr ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function emptyEstateMarkup(bridge) {
  return `
    <div class="journey-rail-empty">
      <span class="journey-rail-empty-icon">${iconMarkup("estates", { size: 21 })}</span>
      <h3>Choose an estate file</h3>
      <p>The Case Journey will show owner, property, probate, Discovery, and handoff work here.</p>
      <button class="journey-action journey-action-primary" type="button" data-rail-action-id="choose-estate">
        ${iconMarkup("estates", { size: 17 })}
        <span>Choose an Estate</span>
      </button>
    </div>
  `;
}

function moveOnStopMarkup({ state, bridge }) {
  const disposition = resolveDisposition(state);
  return `
    <div class="journey-rail-empty" role="status" data-move-on-stop>
      <span class="journey-rail-empty-icon">${iconMarkup("review", { size: 21 })}</span>
      <h3>${safe(bridge, disposition.label)}</h3>
      <p>${safe(bridge, disposition.reason)}</p>
      <button class="journey-action journey-action-primary" type="button" data-rail-action-id="review-next-estate">
        ${iconMarkup("estates", { size: 17 })}
        <span>${safe(bridge, disposition.next.label)}</span>
      </button>
    </div>
  `;
}

function overviewMarkup({ state, bridge }) {
  const estate = state.selectedEstate;
  if (!estate) return emptyEstateMarkup(bridge);
  const disposition = resolveDisposition(state);
  const currentStage = buildLifecycle(state).find((stage) => ["current", "blocked"].includes(stage.status))
    || buildLifecycle(state).at(-1);
  return `
    <div class="journey-rail-stack">
      <section class="journey-rail-disposition" data-disposition="${safe(bridge, disposition.tone)}">
        <span class="journey-rail-kicker">Disposition</span>
        <div class="journey-rail-disposition-line">
          <span aria-hidden="true">${iconMarkup(disposition.label === "Move Forward" ? "complete" : "review", { size: 20 })}</span>
          <h3>${safe(bridge, disposition.label)}</h3>
        </div>
        <p>${safe(bridge, disposition.reason)}</p>
        <button class="journey-action journey-action-primary" type="button" data-rail-action-id="next" data-next-view="${safe(bridge, disposition.next.view)}">
          <span>${safe(bridge, disposition.next.label)}</span>
          ${iconMarkup("discovery", { size: 16 })}
        </button>
      </section>

      <dl class="journey-estate-facts">
        <div><dt>Estate</dt><dd>${safe(bridge, estate.title)}</dd></div>
        <div><dt>Property</dt><dd>${safe(bridge, estate.address)}</dd></div>
        <div><dt>Owner</dt><dd>${safe(bridge, estate.owner)}</dd></div>
        <div><dt>Current stage</dt><dd>${safe(bridge, currentStage?.label || "Intake")}</dd></div>
        <div><dt>Source</dt><dd>${safe(bridge, estate.source)}</dd></div>
      </dl>
    </div>
  `;
}

function journeyMarkup({ state, bridge }) {
  if (!state.selectedEstate) return emptyEstateMarkup(bridge);
  const timeline = buildJourneyTimeline(state);
  if (!timeline.length) {
    return `
      <div class="journey-rail-empty">
        <span class="journey-rail-empty-icon">${iconMarkup("timeline", { size: 21 })}</span>
        <h3>No Case Journey updates yet</h3>
        <p>Source reviews and Discovery activity for this estate will appear here as they happen.</p>
      </div>
    `;
  }
  return `
    <ol class="journey-vertical-timeline" aria-label="Live Case Journey activity timeline">
      ${timeline.map((event) => `
        <li class="journey-timeline-item" data-stage-status="${safe(bridge, event.tone)}">
          <span class="journey-timeline-marker" aria-hidden="true">${iconMarkup(event.tone === "completed" ? "complete" : event.tone === "blocked" ? "review" : "timeline", { size: 16 })}</span>
          <div class="journey-timeline-copy">
            <div class="journey-timeline-title"><strong>${safe(bridge, event.title)}</strong><span>${safe(bridge, event.status)}</span></div>
            <p>${safe(bridge, event.copy)}</p>
            <span class="journey-timeline-meta">${safe(bridge, event.actor)} · ${safe(bridge, event.source)} · ${safe(bridge, timeLabel(event.updatedAt))}</span>
          </div>
        </li>
      `).join("")}
    </ol>
  `;
}

function documentsMarkup({ state, bridge }) {
  if (!state.selectedEstate) return emptyEstateMarkup(bridge);
  if (resolveDisposition(state).label === "Move On") return moveOnStopMarkup({ state, bridge });
  const documents = state.docPrep?.documents || [];
  if (!documents.length) {
    return `
      <div class="journey-rail-empty">
        <span class="journey-rail-empty-icon">${iconMarkup("documents", { size: 21 })}</span>
        <h3>No source documents yet</h3>
        <p>Open Document Prep to add the first verified source for this estate.</p>
        <button class="journey-action journey-action-primary" type="button" data-rail-action-id="open-doc-prep">Open Document Prep</button>
      </div>
    `;
  }
  return `
    <div class="journey-document-list" aria-label="Estate source documents">
      ${documents.map((document) => `
        <button class="journey-document-row" type="button" data-rail-action-id="open-document" data-document-id="${safe(bridge, document.id)}">
          <span class="journey-document-icon" aria-hidden="true">${iconMarkup("documents", { size: 18 })}</span>
          <span class="journey-document-copy">
            <strong>${safe(bridge, document.title)}</strong>
            <span>${safe(bridge, document.source)} · ${safe(bridge, document.status)}</span>
          </span>
          <span class="journey-document-updated">${safe(bridge, timeLabel(document.updatedAt))}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function activityMarkup({ state, bridge }) {
  const events = state.activity || [];
  if (!events.length) {
    return `
      <div class="journey-rail-empty">
        <span class="journey-rail-empty-icon">${iconMarkup("timeline", { size: 21 })}</span>
        <h3>No activity recorded yet</h3>
        <p>Estate review and automation updates will appear here as the team works.</p>
      </div>
    `;
  }
  return `
    <ol class="journey-activity-list" aria-label="Recent estate activity">
      ${events.slice(0, 16).map((event) => `
        <li>
          <span aria-hidden="true">${iconMarkup(event.tone === "ready" ? "complete" : event.tone === "blocked" ? "review" : "timeline", { size: 16 })}</span>
          <span><strong>${safe(bridge, event.title)}</strong><span>${safe(bridge, event.copy)}</span></span>
          <time>${safe(bridge, timeLabel(event.updatedAt))}</time>
        </li>
      `).join("")}
    </ol>
  `;
}

function actionsMarkup({ state, bridge }) {
  const estate = state.selectedEstate;
  if (!estate) return emptyEstateMarkup(bridge);
  if (resolveDisposition(state).label === "Move On") return moveOnStopMarkup({ state, bridge });
  const packetReady = Boolean(state.docPrep?.packetVerified);
  const packetApproved = Boolean(state.docPrep?.packetApproved);
  return `
    <div class="journey-actions-list">
      <button class="journey-action-row" type="button" data-rail-action-id="open-doc-prep">
        <span aria-hidden="true">${iconMarkup("documents", { size: 18 })}</span>
        <span><strong>Open Document Prep</strong><span>Review sources, Discovery, and the local packet.</span></span>
      </button>
      <button class="journey-action-row" type="button" data-rail-action-id="open-estates">
        <span aria-hidden="true">${iconMarkup("estates", { size: 18 })}</span>
        <span><strong>Review Estate Evidence</strong><span>Check owner, folio, deed, sale, and tax facts.</span></span>
      </button>
      ${packetReady && !packetApproved ? `
        <button class="journey-action-row journey-action-row-completion" type="button" data-rail-action-id="approve-packet">
          <span aria-hidden="true">${iconMarkup("review", { size: 18 })}</span>
          <span><strong>Approve Current Packet</strong><span>Record that you reviewed this exact verified revision and unlock controlled handoff.</span></span>
        </button>
      ` : ""}
      ${packetApproved ? `
        <div class="journey-action-row journey-action-row-completion" role="status">
          <span aria-hidden="true">${iconMarkup("complete", { size: 18 })}</span>
          <span><strong>Current Packet Approved</strong><span>This exact verified revision is cleared for controlled handoff.</span></span>
        </div>
      ` : ""}
      <button class="journey-action-row" type="button" data-rail-action-id="open-queue">
        <span aria-hidden="true">${iconMarkup("queue", { size: 18 })}</span>
        <span><strong>Open Handoff Queue</strong><span>Stage reviewed packets for an approved destination.</span></span>
      </button>
      ${packetReady ? `
        <button class="journey-action-row journey-action-row-completion" type="button" data-rail-action-id="open-chatgpt-work">
          <span aria-hidden="true">${iconMarkup("complete", { size: 18 })}</span>
          <span><strong>Continue in ChatGPT Work</strong><span>Copy the sanitized review brief and continue to ChatGPT in this browser.</span></span>
        </button>
      ` : ""}
    </div>
  `;
}

async function navigate(payload, view) {
  if (!payload?.bridge) throw new Error("The estate workspace is not ready.");
  return payload.bridge.navigate(view);
}

function caseJourneyRailDefinition() {
  return {
    id: "case-journey",
    label: "Case Journey",
    minWidth: 480,
    maxWidth: 552,
    defaultWidth: 480,
    defaultTab: "overview",
    mobileSheet: true,
    tabs: [
      {
        id: "overview",
        label: "Overview",
        render: overviewMarkup,
        actions: {
          "choose-estate": (payload) => navigate(payload, "find-estates"),
          next: (payload) => navigate(payload, payload?.view || "dossiers"),
        },
      },
      { id: "journey", label: "Journey", render: journeyMarkup },
      {
        id: "documents",
        label: "Documents",
        render: documentsMarkup,
        actions: {
          "open-doc-prep": (payload) => navigate(payload, "dossiers"),
          "review-next-estate": (payload) => navigate(payload, "find-estates"),
          "open-document": async (payload) => {
            const estateId = payload.state?.selectedEstateId;
            await payload.bridge.navigate("dossiers");
            const result = await payload.bridge.dispatch("document-action", {
              estateId,
              documentId: payload.documentId,
              action: "select",
            });
            runtime.rails.activate("doc-prep-context", { tab: "document", open: true });
            return result;
          },
        },
      },
      { id: "activity", label: "Activity", render: activityMarkup },
      {
        id: "actions",
        label: "Actions",
        render: actionsMarkup,
        actions: {
          "open-doc-prep": (payload) => navigate(payload, "dossiers"),
          "open-estates": (payload) => navigate(payload, "find-estates"),
          "review-next-estate": (payload) => navigate(payload, "find-estates"),
          "open-queue": (payload) => navigate(payload, "queue"),
          "approve-packet": (payload) => payload.bridge.dispatch("approve-packet", {
            estateId: payload.state?.selectedEstateId,
            flowId: payload.state?.docPrep?.flow?.id || "discovery",
          }),
          "open-chatgpt-work": (payload) => payload.bridge.dispatch("open-chatgpt-work", {
            estateId: payload.state?.selectedEstateId,
            flowId: payload.state?.docPrep?.flow?.id || "discovery",
          }),
        },
      },
    ],
  };
}

export { caseJourneyRailDefinition, timeLabel };
