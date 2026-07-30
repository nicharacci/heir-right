import { iconMarkup } from "../../ui/icon-facade.js";
import { buildLifecycle, resolveDisposition } from "../case-journey/case-journey.js";
import { timeLabel } from "../case-journey/case-journey-rail.js";

function safe(bridge, value) {
  return bridge.escapeHtml(String(value ?? ""));
}

function progressValue(state) {
  return Math.max(0, Math.min(100, Number(state.docPrep?.progress || 0)));
}

function attentionRows(state) {
  const estate = state.selectedEstate;
  if (!estate) {
    return [{
      id: "choose-estate",
      title: "Choose the next estate file",
      copy: "Start with owner, property, deed, recent-sale, and tax evidence.",
      action: "Open Estates",
      view: "find-estates",
      tone: "blocked",
    }];
  }
  const disposition = resolveDisposition(state);
  const documents = state.docPrep?.documents || [];
  const missingDocuments = documents.filter((document) => !document.hasVerifiedFile).length;
  const packetVerified = Boolean(state.docPrep?.packetVerified);
  const packetApproved = packetVerified && Boolean(state.docPrep?.packetApproved);
  const rows = [];
  if (disposition.label === "Move On") {
    return [{
      id: "disposition",
      title: "Stop before more research",
      copy: disposition.reason,
      action: disposition.next.label,
      view: disposition.next.view,
      tone: disposition.tone,
    }];
  }
  if (disposition.label === "Blocked") {
    rows.push({
      id: "disposition",
      title: "Clear the current blocker",
      copy: disposition.reason,
      action: disposition.next.label,
      view: disposition.next.view,
      tone: disposition.tone,
    });
  }
  if (missingDocuments > 0) {
    rows.push({
      id: "documents",
      title: `${missingDocuments} source document${missingDocuments === 1 ? "" : "s"} still need verification`,
      copy: "Keep missing sources visible until HeirRight verifies each saved document.",
      action: "Review Documents",
      view: "dossiers",
      tone: "review",
    });
  }
  if (!packetVerified) {
    rows.push({
      id: "packet",
      title: progressValue(state) >= 100 ? "Review the completed local packet" : "Continue estate Discovery",
      copy: progressValue(state) >= 100
        ? "Clear visible source flags before an external handoff."
        : `${progressValue(state)}% complete · ${state.docPrep?.currentPhase?.label || "Next Discovery step is ready"}`,
      action: progressValue(state) >= 100 ? "Review Packet" : "Continue Discovery",
      view: "dossiers",
      tone: "review",
    });
  } else if (!packetApproved) {
    rows.push({
      id: "packet-approval",
      title: "Approve the current verified packet",
      copy: "The local PDF was verified. Review this exact revision in Document Prep before any handoff.",
      action: "Approve Current Packet",
      view: "dossiers",
      context: "actions",
      tone: "review",
    });
  }
  if (!rows.length) {
    rows.push({
      id: "handoff",
      title: "Packet review is complete",
      copy: "Choose the next approved handoff and keep outreach behind its review gate.",
      action: "Open Queue",
      view: "queue",
      tone: "ready",
    });
  }
  return rows.slice(0, 3);
}

function lifecycleMarkup(state, bridge) {
  return `
    <ol class="case-lifecycle" aria-label="Estate lifecycle">
      ${buildLifecycle(state).map((stage, index) => `
        <li class="case-lifecycle-stage" data-stage-status="${safe(bridge, stage.status)}">
          <button type="button" data-case-stage="${safe(bridge, stage.id)}" aria-label="${safe(bridge, `${stage.label}: ${stage.status}. ${stage.reason}`)}" ${stage.status === "current" ? 'aria-current="step"' : ""}>
            <span class="case-stage-index" aria-hidden="true">${stage.status === "completed" ? iconMarkup("complete", { size: 15 }) : index + 1}</span>
            <span class="case-stage-label">${safe(bridge, stage.label)}</span>
            <span class="case-stage-state">${safe(bridge, {
              completed: "Complete",
              current: "Current",
              blocked: "Needs attention",
              upcoming: "Upcoming",
            }[stage.status])}</span>
          </button>
        </li>
      `).join("")}
    </ol>
  `;
}

function attentionMarkup(state, bridge) {
  return `
    <section class="dashboard-section dashboard-attention" aria-labelledby="dashboardAttentionTitle">
      <div class="dashboard-section-heading">
        <h3 id="dashboardAttentionTitle">Needs attention</h3>
        <button class="dashboard-bare-action" type="button" data-shell-open-context="activity">Recent Activity</button>
      </div>
      <div class="dashboard-editorial-list">
        ${attentionRows(state).map((item) => `
          <div class="dashboard-attention-row" data-attention-tone="${safe(bridge, item.tone)}">
            <span class="dashboard-row-icon" aria-hidden="true">${iconMarkup(item.tone === "ready" ? "complete" : "review", { size: 18 })}</span>
            <span class="dashboard-row-copy"><strong>${safe(bridge, item.title)}</strong><span>${safe(bridge, item.copy)}</span></span>
            <button type="button" data-dashboard-view="${safe(bridge, item.view)}" ${item.context ? `data-dashboard-context="${safe(bridge, item.context)}"` : ""}>${safe(bridge, item.action)}</button>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function estateRowsMarkup(state, bridge) {
  const rows = [...(state.estates || [])]
    .sort((left, right) => Number(right.selected) - Number(left.selected) || Number(right.score || 0) - Number(left.score || 0))
    .slice(0, 6);
  return `
    <section class="dashboard-section dashboard-active-work" aria-labelledby="dashboardActiveTitle">
      <div class="dashboard-section-heading">
        <h3 id="dashboardActiveTitle">Active files</h3>
        <button class="dashboard-bare-action" type="button" data-dashboard-view="find-estates">All Estates</button>
      </div>
      <div class="dashboard-estate-list">
        ${rows.length ? rows.map((estate) => `
          <button class="dashboard-estate-row" type="button" data-dashboard-estate-id="${safe(bridge, estate.id)}" data-dashboard-estate-open="dossiers" ${estate.selected ? 'aria-current="true"' : ""}>
            <span class="dashboard-estate-lead"><strong>${safe(bridge, estate.title)}</strong><span>${safe(bridge, estate.address)}</span></span>
            <span class="dashboard-estate-state"><strong>${safe(bridge, estate.classification)}</strong><span>${safe(bridge, estate.nextAction)}</span></span>
            <span class="dashboard-estate-score"><strong>${safe(bridge, estate.score)}</strong><span>score</span></span>
          </button>
        `).join("") : `
          <div class="dashboard-empty-row"><strong>No estate files loaded</strong><span>Open Estates to import or review a controlled public-source lead.</span></div>
        `}
      </div>
    </section>
  `;
}

function activityMarkup(state, bridge) {
  const activity = (state.activity || []).slice(0, 6);
  return `
    <section class="dashboard-section dashboard-recent" aria-labelledby="dashboardRecentTitle">
      <div class="dashboard-section-heading">
        <h3 id="dashboardRecentTitle">Recent updates</h3>
      </div>
      <ol class="dashboard-activity-list">
        ${activity.length ? activity.map((event) => `
          <li>
            <span aria-hidden="true">${iconMarkup(event.tone === "ready" ? "complete" : event.tone === "blocked" ? "review" : "timeline", { size: 16 })}</span>
            <span><strong>${safe(bridge, event.title)}</strong><span>${safe(bridge, event.copy)}</span></span>
            <time>${safe(bridge, timeLabel(event.updatedAt))}</time>
          </li>
        `).join("") : `
          <li class="dashboard-empty-row"><span aria-hidden="true">${iconMarkup("timeline", { size: 16 })}</span><span><strong>No updates yet</strong><span>Estate activity will appear here as work advances.</span></span></li>
        `}
      </ol>
    </section>
  `;
}

function renderDashboardView({ bridge }) {
  const state = bridge.readState();
  const estate = state.selectedEstate;
  const disposition = resolveDisposition(state);
  const documents = state.docPrep?.documents || [];
  const verifiedDocuments = documents.filter((document) => document.hasVerifiedFile).length;
  return `
    <div class="case-dashboard" aria-label="HeirRight Case Journey Dashboard">
      <header class="dashboard-decision-band">
        <div class="dashboard-estate-context">
          <h2>${safe(bridge, estate?.title || "Choose an estate file")}</h2>
          <p>${safe(bridge, estate?.address || "Start with owner and property evidence, then follow the Case Journey.")}</p>
        </div>
        <div class="dashboard-disposition" data-disposition="${safe(bridge, disposition.tone)}">
          <span>Disposition</span>
          <strong>${safe(bridge, disposition.label)}</strong>
          <p>${safe(bridge, disposition.reason)}</p>
          <button class="dashboard-primary-action" type="button" data-journey-next-view="${safe(bridge, disposition.next.view)}">
            <span>${safe(bridge, disposition.next.label)}</span>
            ${iconMarkup("discovery", { size: 17 })}
          </button>
        </div>
      </header>

      <section class="dashboard-journey" aria-labelledby="dashboardJourneyTitle">
        <div class="dashboard-section-heading">
          <h3 id="dashboardJourneyTitle">Case Journey</h3>
          <button class="dashboard-bare-action" type="button" data-shell-open-context="journey">Open Timeline</button>
        </div>
        ${lifecycleMarkup(state, bridge)}
      </section>

      <div class="dashboard-work-grid">
        ${attentionMarkup(state, bridge)}
        ${estateRowsMarkup(state, bridge)}
      </div>

      <div class="dashboard-awareness-row">
        ${activityMarkup(state, bridge)}
        <aside class="dashboard-kpis" aria-label="Selected estate progress">
          <dl>
            <div><dt>Discovery</dt><dd>${safe(bridge, progressValue(state))}%</dd></div>
            <div><dt>Verified documents</dt><dd>${safe(bridge, `${verifiedDocuments}/${documents.length}`)}</dd></div>
            <div><dt>Evidence</dt><dd>${safe(bridge, `${estate?.evidence || 0}/${estate?.evidenceTotal || 0}`)}</dd></div>
          </dl>
          <button class="dashboard-bare-action" type="button" data-shell-open-context="overview">Estate Summary</button>
        </aside>
      </div>
    </div>
  `;
}

export { attentionRows, renderDashboardView };
