import { escapeFor } from "./document-row.js";
import { createCommunityGrid, destroyCommunityGrid } from "../data-grid/community-grid.js";
import { estateWorkflowStateLabels } from "../estate-export/workflow-model.js";

const stageLabels = Object.freeze({
  "source-review": "Source evidence",
  "packet-render": "Packet render",
  "pdf-readback": "PDF readback",
  "export-handoff": "Export handoff",
});

let activeMount = null;
const selectedEstateIds = new Set();

function escape(bridge, value) {
  return escapeFor(bridge, value);
}

function docPrepRows(snapshot) {
  return Array.isArray(snapshot.docPrepEstates) ? snapshot.docPrepEstates : [];
}

function currentEstate(snapshot, rows) {
  return rows.find((row) => String(row.id) === String(snapshot.selectedEstateId || "")) || rows[0] || null;
}

function workflowState(row) {
  return String(row?.workflowState || "queued");
}

function selectedRows(rows) {
  const available = new Set(rows.map((row) => String(row.id)));
  [...selectedEstateIds].forEach((id) => {
    if (!available.has(id)) selectedEstateIds.delete(id);
  });
  if (!selectedEstateIds.size && rows[0]?.id) selectedEstateIds.add(String(rows[0].id));
  return rows.filter((row) => selectedEstateIds.has(String(row.id)));
}

function runEligible(row) {
  const state = workflowState(row);
  return state === "queued" || (state === "blocked" && row.workflowBlockerStage !== "export-handoff");
}

function workflowLabel(row) {
  return row?.workflowLabel || estateWorkflowStateLabels[workflowState(row)] || "Queued for Doc Prep";
}

function stageStatusLabel(status) {
  if (status === "complete") return "Complete";
  if (status === "active") return "In progress";
  if (status === "blocked") return "Blocked";
  return "Waiting";
}

function discoveryPreviewValue(bridge, value, fallback = "Needs review") {
  const text = String(value ?? "").trim();
  const shown = text || fallback;
  return "<span class=\"s40-discovery-value" + (text ? "" : " s40-discovery-pending") + "\">"
    + escape(bridge, shown)
    + "</span>";
}

function discoveryPreviewParagraphs(bridge, value, fallback) {
  const lines = String(value || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return (lines.length ? lines : [fallback]).map((line) => "<p>" + escape(bridge, line) + "</p>").join("");
}

function renderDiscoveryOfferTable(preview, bridge) {
  const rows = (Array.isArray(preview.offerRows) && preview.offerRows.length
    ? preview.offerRows
    : [
      "As-Is Value", "Taxes Due", "Liens", "Mortgages", "Selling Costs", "Probate Costs",
      "Partition Costs", "Post Equity Value", "Amount per heir $$", "# of heirs on board",
      "Profit", "Offer per heir", "", "", "", "Min Profit", "$100,000 Net", "", "",
    ].map((label) => ({ label, percentage: "", total: "", tone: "normal" }))
  ).map((row, index) => index === 15
    ? { ...row, label: "Min Profit", tone: "blue" }
    : index === 16
      ? { ...row, label: "$100,000 Net", tone: "yellow" }
      : index >= 17 && index <= 18
        ? { ...row, tone: "yellow" }
        : row);
  return "<table class=\"s40-discovery-offer\">"
    + "<tbody><tr class=\"s40-discovery-offer-bar\"><th colspan=\"3\">Offer/Profit</th></tr>"
    + "<tr><th>Description</th><th>Percentage</th><th>Total</th></tr>"
    + rows.map((row) => {
      const tone = ["blue", "yellow"].includes(row.tone) ? " " + row.tone : "";
      const strong = ["As-Is Value", "Post Equity Value", "Profit", "Min Profit"].includes(row.label) ? " s40-discovery-strong" : "";
      return "<tr class=\"s40-discovery-offer-row" + tone + "\"><td class=\"" + strong.trim() + "\">"
        + discoveryPreviewValue(bridge, row.label, "")
        + "</td><td>" + discoveryPreviewValue(bridge, row.percentage, "") + "</td><td>"
        + discoveryPreviewValue(bridge, row.total, "")
        + "</td></tr>";
    }).join("")
    + "</tbody></table>";
}

function renderDiscoveryContact(contact, bridge, index) {
  const history = Array.isArray(contact.addressHistory) && contact.addressHistory.length
    ? contact.addressHistory.map((item) => "<p>" + discoveryPreviewValue(bridge, item.address, "Address needs review")
      + "<br><span>" + discoveryPreviewValue(bridge, item.dates, "Dates need review") + "</span></p>").join("")
    : "<p>" + discoveryPreviewValue(bridge, contact.likelyCurrentAddress, "Needs approved enrichment") + "</p>";
  const phones = Array.isArray(contact.phones) && contact.phones.length
    ? contact.phones.map((phone) => "<p>" + discoveryPreviewValue(bridge, phone, "Needs approved enrichment") + "</p>").join("")
    : "<p>" + discoveryPreviewValue(bridge, "", "Needs approved enrichment") + "</p>";
  const emails = Array.isArray(contact.emails) && contact.emails.length
    ? contact.emails.map((email) => "<p>" + discoveryPreviewValue(bridge, email, "Needs approved enrichment") + "</p>").join("")
    : "<p>" + discoveryPreviewValue(bridge, "", "Needs approved enrichment") + "</p>";
  return "<section class=\"s40-discovery-person\"><h3>" + (index + 1) + ". "
    + discoveryPreviewValue(bridge, contact.name, "Possible heir")
    + (contact.relationship ? " (" + discoveryPreviewValue(bridge, contact.relationship, "Heir/contact review") + ")" : "")
    + "</h3>"
    + (contact.age ? "<p>" + discoveryPreviewValue(bridge, contact.age, "Age needs review") + "</p>" : "")
    + "<p>Likely Current Address: " + discoveryPreviewValue(bridge, contact.likelyCurrentAddress, "Needs approved enrichment") + "</p>"
    + "<h4>Address (County/Parish/Borough) History:</h4>" + history
    + "<h4>Phone number:</h4>" + phones
    + "<h4>Email Address:</h4>" + emails
    + "</section>";
}

function renderDiscoveryTemplatePreview(row, bridge) {
  const preview = row.discoveryPreview || {};
  const live = preview.state === "live";
  const title = preview.title || row.title || "Estate file";
  const contacts = Array.isArray(preview.contacts) ? preview.contacts : [];
  const contactMarkup = contacts.length
    ? contacts.map((contact, index) => renderDiscoveryContact(contact, bridge, index)).join("")
    : "<section class=\"s40-discovery-person s40-discovery-placeholder-person\"><h3>1. "
      + discoveryPreviewValue(bridge, "", "Possible heir")
      + "</h3><p>Family-tree contact review will appear here after Discovery evidence is accepted.</p></section>";
  return "<div class=\"s40-preview-viewport\" data-preview-state=\"" + (live ? "live" : "template") + "\" aria-label=\"" + escape(bridge, live ? "Live Discovery packet preview" : "Discovery packet template") + "\">"
    + "<div class=\"s40-discovery-paper\">"
    + "<main class=\"s40-discovery-template-page\">"
    + "<h1 class=\"s40-discovery-title\">" + discoveryPreviewValue(bridge, title, "Estate file") + "</h1>"
    + "<p class=\"s40-discovery-subtitle\">Family Tree</p>"
    + "<p class=\"s40-discovery-date\">Date added: " + discoveryPreviewValue(bridge, preview.dateAdded, "Needs review") + "</p>"
    + "<p class=\"s40-discovery-property\">Property Address: " + discoveryPreviewValue(bridge, preview.propertyAddress, "Needs review") + "</p>"
    + renderDiscoveryOfferTable(preview, bridge)
    + "<section class=\"s40-discovery-summary\"><p><strong>Owner:</strong></p><p><strong>"
    + discoveryPreviewValue(bridge, preview.owner, "Needs review")
    + "</strong></p><p>DOB: " + discoveryPreviewValue(bridge, preview.dateOfBirth, "Needs review")
    + "</p><p>DOD: " + discoveryPreviewValue(bridge, preview.dateOfDeath, "Needs review")
    + "</p><p>" + discoveryPreviewValue(bridge, preview.obituary, "Obituary - Needs review") + "</p>"
    + "<p>Folio: " + discoveryPreviewValue(bridge, preview.folio, "Needs review") + "</p>"
    + "</section>"
    + "<section class=\"s40-discovery-story\"><p><strong>Back Story:</strong></p>"
    + discoveryPreviewParagraphs(bridge, preview.backStory, live ? "Back Story is filling from reviewed evidence." : "Back Story will fill after Discovery starts.")
    + "<p class=\"s40-discovery-evidence\"><strong>Source evidence:</strong> " + discoveryPreviewValue(bridge, preview.sourceLink, "Needs review") + "</p></section>"
    + "<section class=\"s40-discovery-heirs\"><h2>Heirs:</h2>" + contactMarkup + "</section>"
    + "</main></div></div>";
}
function stageMaterial(row) {
  const stages = Array.isArray(row?.workflowStages) ? row.workflowStages : [];
  return workflowState(row) !== "queued"
    || Boolean(row?.workflowArtifact)
    || Boolean(row?.workflowBlocker)
    || stages.some((stage) => stage.status !== "pending");
}

function verifiedArtifactHref(artifact) {
  const candidate = String(artifact?.artifactUrl || "").trim();
  if (!candidate) return "";
  try {
    const origin = globalThis.location?.origin || "";
    const url = new URL(candidate, origin);
    return origin && url.origin === origin ? url.href : "";
  } catch {
    return "";
  }
}

function renderStageStrip(row, bridge) {
  if (!stageMaterial(row)) return "";
  const stages = Array.isArray(row?.workflowStages) ? row.workflowStages : [];
  return `
    <ol class="s40-stage-strip" aria-label="Doc Prep stages">
      ${stages.map((stage) => {
        const blocked = stage.status === "blocked";
        const label = stageLabels[stage.id] || stage.label || "Doc Prep stage";
        const issue = blocked ? `<span class="s40-stage-issue" role="img" aria-label="Blocked: ${escape(bridge, stage.blocker || label)}">!</span>` : "";
        return `<li class="s40-stage" data-state="${escape(bridge, stage.status)}">
          <span class="s40-stage-marker" aria-hidden="true">${blocked ? "!" : stage.status === "complete" ? "✓" : ""}</span>
          <span class="s40-stage-copy"><strong>${escape(bridge, label)}</strong><span>${escape(bridge, stageStatusLabel(stage.status))}</span></span>
          ${issue}
        </li>`;
      }).join("")}
    </ol>
  `;
}

function renderEstateSelector(rows) {
  return rows.length
    ? `<div class="s40-selector-grid hr-community-grid" data-community-grid="docprep" data-grid-label="Queued estates" aria-label="Queued estates"></div>`
    : `<div class="s40-empty-selector"><strong>No estates are queued.</strong><span>Return to Estates to choose the next files for Doc Prep.</span><button type="button" class="s40-link-button" data-open-estates>Open Estates</button></div>`;
}

function renderArtifactRail(row, bridge) {
  if (!row) {
    return `<div class="s40-rail-empty"><strong>Select a queued estate</strong><span>The selected packet and its stage evidence will appear here.</span></div>`;
  }
  const artifactHref = verifiedArtifactHref(row.workflowArtifact);
  const workflow = workflowState(row);
  const blocker = String(row.workflowBlocker || "").trim();
  const packetApproved = row.packetApproved === true;
  const hasVerifiedArtifact = Boolean(artifactHref && row.workflowArtifact?.artifactId);
  const preview = row.discoveryPreview || { title: row.title, propertyAddress: row.address, state: "template" };
  const previewStateLabel = hasVerifiedArtifact ? "Verified internal PDF" : preview.state === "live" ? "Live Discovery packet" : "Discovery packet template";
  const packet = hasVerifiedArtifact
    ? `<div class="s40-pdf-frame"><iframe src="${escape(bridge, artifactHref)}" title="Verified internal PDF for ${escape(bridge, row.title)}" loading="lazy"></iframe></div>
       <div class="s40-artifact-meta"><span>Verified internal PDF</span><a href="${escape(bridge, artifactHref)}" target="_blank" rel="noopener noreferrer">Open PDF</a></div>`
    : renderDiscoveryTemplatePreview({ ...row, discoveryPreview: preview }, bridge);
  const approvalControl = hasVerifiedArtifact && workflow !== "exported"
    ? `<div class="s40-approval-bar" data-state="${packetApproved ? "approved" : "pending"}">
        <span>${packetApproved ? "Approved for controlled export." : "Verified readback passed. Approve this packet before export handoff."}</span>
        ${packetApproved ? "" : `<button type="button" class="s40-primary-button" data-s40-approve data-approve-packet data-estate-id="${escape(bridge, row.id)}">Approve packet for export</button>`}
      </div>`
    : "";
  return `
    <header class="s40-rail-head">
      <div><p class="s40-rail-kicker">Current estate</p><h2>${escape(bridge, row.title || "Estate file")}</h2><p>${escape(bridge, row.address || "Address unavailable")}</p></div>
      <span class="s40-state-label" data-state="${escape(bridge, workflow)}">${escape(bridge, workflowLabel(row))}</span>
    </header>
    ${blocker ? `<p class="s40-blocker" role="alert">${escape(bridge, blocker)}</p>` : ""}
    ${renderStageStrip(row, bridge)}
    <section class="s40-artifact-surface" data-preview-state="${escape(bridge, hasVerifiedArtifact ? "verified" : preview.state || "template")}" aria-label="${escape(bridge, hasVerifiedArtifact ? "Verified packet preview" : previewStateLabel)}">
      <div class="s40-artifact-topline"><span>Artifact rail</span><span>${escape(bridge, hasVerifiedArtifact ? row.workflowArtifact?.fileName || "Internal packet" : previewStateLabel)}</span></div>
      ${packet}
      ${hasVerifiedArtifact ? "" : `<div class="s40-artifact-meta"><span>${escape(bridge, previewStateLabel)}</span><span>Review-only until verified PDF readback</span></div>`}
    </section>
    ${approvalControl}
  `;
}

function renderExportQueue(snapshot, bridge) {
  const queue = Array.isArray(snapshot.exportQueue) ? snapshot.exportQueue : [];
  if (!queue.length) return "";
  return `
    <section class="s40-export-queue" aria-labelledby="s40ExportQueueTitle">
      <header><div><p class="s40-rail-kicker">Approval boundary</p><h2 id="s40ExportQueueTitle">Completed reports awaiting export</h2></div><span>${queue.length} ready</span></header>
      <ul>
        ${queue.map((row) => {
          const blocked = workflowState(row) === "blocked";
          const approved = row.packetApproved === true;
          const stateLabel = blocked
            ? row.workflowBlocker || "Export handoff needs review."
            : approved
              ? "Verified report - approved"
              : "Verified report - approval required";
          const actionLabel = blocked ? "Retry export" : approved ? "Send to Export" : "Approve packet above";
          const disabled = !blocked && !approved ? "disabled aria-disabled=\"true\" title=\"Approve the packet in the artifact rail before export handoff.\"" : "";
          return `<li class="s40-export-row" data-state="${blocked ? "blocked" : "ready"}">
            <span><strong>${escape(bridge, row.title)}</strong><span>${escape(bridge, row.address)}</span></span>
            <span class="s40-export-row-state">${escape(bridge, stateLabel)}</span>
            <button type="button" class="s40-secondary-button" data-s40-export="${escape(bridge, row.id)}" data-export-handoff="${escape(bridge, row.id)}" ${disabled}>${actionLabel}</button>
          </li>`;
        }).join("")}
      </ul>
    </section>
  `;
}

function emptyDocPrepView() {
  return [
    "<section class=\"s40-docprep s40-docprep-empty\" data-feature=\"s40-doc-prep\">",
    "  <div class=\"s40-workbench\">",
    "    <aside class=\"s40-selector\" aria-label=\"Doc Prep estate selector\">",
    "      <header><div><span class=\"s40-column-kicker\">Queued estates</span><h2>Select files</h2></div><span>0</span></header>",
    "      <div class=\"s40-empty-selector\"><strong>Nothing is queued</strong><span>Queue an eligible estate from Estates to start Doc Prep.</span><button type=\"button\" class=\"s40-link-button\" data-open-estates>Open Estates</button></div>",
    "    </aside>",
    "    <article class=\"s40-artifact-rail s40-artifact-rail-empty\" aria-label=\"Doc Prep artifact and status rail\">",
    "      <header class=\"s40-empty-rail-head\"><div><p class=\"s40-rail-kicker\">Per-file and batch status</p><h2>Doc Prep status</h2><p>Select queued files to inspect each packet and phase.</p></div><div class=\"s40-docprep-type-strip\" aria-label=\"Doc Prep types\"><span aria-current=\"true\">Discovery</span><span>Closing Prep</span></div></header>",
    "      <ol class=\"s40-empty-stage-list\" aria-label=\"Doc Prep phases waiting for a queued estate\"><li><strong>Selected files</strong><span>Waiting for an estate or batch selection</span></li><li><strong>Source evidence</strong><span>Waiting for a selected file</span></li><li><strong>Packet render</strong><span>Waiting for a Doc Prep run</span></li><li><strong>PDF readback</strong><span>Waiting for a rendered packet</span></li></ol>",
    "    </article>",
    "  </div>",
    "</section>",
  ].join("");
}


function renderS40DocPrepView({ bridge }) {
  const snapshot = bridge.readState();
  const rows = docPrepRows(snapshot);
  if (!rows.length) return emptyDocPrepView(bridge);
  const current = currentEstate(snapshot, rows);
  const selected = selectedRows(rows);
  const runnable = selected.filter(runEligible);
  const countLabel = selected.length === 1 ? "1 estate selected" : `${selected.length} estates selected`;
  return `
    <section class="s40-docprep" data-feature="s40-doc-prep">
      <header class="s40-docprep-head">
        <div><p class="s40-rail-kicker">Doc Prep workbench</p><h1>Review packets, then hand off</h1><p>${escape(bridge, `${rows.length} estate${rows.length === 1 ? "" : "s"} in the shared workflow.`)}</p></div>
        <div class="s40-docprep-command"><span aria-live="polite" data-s40-selected-count>${escape(bridge, countLabel)}</span><button type="button" class="s40-primary-button" data-s40-run data-run-docprep ${runnable.length ? "" : "disabled"}>${runnable.length > 1 ? `Run Doc Prep for ${runnable.length}` : "Run Doc Prep"}</button></div>
      </header>
      <div class="s40-workbench">
        <aside class="s40-selector" aria-label="Doc Prep estate selector">
          <header><div><span class="s40-column-kicker">Queued estates</span><h2>Select files</h2></div><span>${rows.length}</span></header>
          ${renderEstateSelector(rows)}
        </aside>
        <article class="s40-artifact-rail" aria-label="Doc Prep artifact rail">
          ${renderArtifactRail(current, bridge)}
        </article>
      </div>
      ${renderExportQueue(snapshot, bridge)}
    </section>
  `;
}

function safeActionError(error) {
  const raw = String(error?.message || error || "");
  if (/source|evidence|discovery/i.test(raw)) return "Source evidence needs verified readback before Doc Prep can continue.";
  if (/export|approval|destination|handoff|google|drive/i.test(raw)) return "Export approval and readback are required before the file can leave Doc Prep.";
  if (/save|workspace|reload/i.test(raw)) return "The shared workflow state could not be saved. Reload the workspace, then retry.";
  return "The workflow action could not complete. Review the estate state, then retry.";
}

async function dispatchAction(bridge, command, payload, control) {
  if (control?.disabled || control?.dataset.busy === "true") return;
  if (control) {
    control.dataset.busy = "true";
    control.setAttribute("aria-busy", "true");
    control.disabled = true;
  }
  try {
    await bridge.dispatch(command, payload);
  } catch (error) {
    bridge.emit("Workflow action blocked", safeActionError(error), "blocked");
  } finally {
    if (control?.isConnected) {
      control.dataset.busy = "false";
      control.removeAttribute("aria-busy");
      control.disabled = false;
    }
  }
}

function mountS40DocPrepView(root, bridge) {
  activeMount = root;
  const snapshot = bridge.readState();
  const rows = docPrepRows(snapshot);
  const selector = root?.querySelector?.('[data-community-grid="docprep"]');
  const selectedCount = root?.querySelector?.("[data-s40-selected-count]");
  const runControl = root?.querySelector?.("[data-s40-run], [data-run-docprep]");
  const updateRunControl = (nextRows = rows) => {
    const selected = nextRows.filter((row) => selectedEstateIds.has(String(row.id)));
    const runnable = selected.filter(runEligible);
    if (selectedCount) selectedCount.textContent = selected.length === 1 ? "1 estate selected" : `${selected.length} estates selected`;
    if (runControl) {
      runControl.disabled = runnable.length === 0;
      runControl.textContent = runnable.length > 1 ? `Run Doc Prep for ${runnable.length}` : "Run Doc Prep";
    }
  };
  if (selector) {
    createCommunityGrid(selector, {
      key: "docprep",
      rows,
      columns: [
        { field: "title", headerName: "Estate", minWidth: 150, flex: 1.1, filter: "agTextColumnFilter" },
        { field: "address", headerName: "Address", minWidth: 170, flex: 1.3, filter: "agTextColumnFilter" },
      ],
      selectionMode: "multi",
      selectedIds: [...selectedEstateIds],
      pageSize: 8,
      emptyMessage: "No queued estates.",
      onSelect: async (row) => {
        try {
          await bridge.dispatch("select-estate", { estateId: row.id });
        } catch {
          bridge.emit("Estate selection blocked", "That estate is no longer available.", "blocked");
        }
      },
      onSelectionChange: (nextRows) => {
        selectedEstateIds.clear();
        nextRows.forEach((row) => selectedEstateIds.add(String(row.id)));
        updateRunControl(rows);
      },
    });
  }
  updateRunControl(rows);
  root?.querySelectorAll?.("[data-open-estates]").forEach((control) => {
    control.addEventListener("click", () => bridge.navigate("find-estates"));
  });
  root?.querySelector("[data-s40-run], [data-run-docprep]")?.addEventListener("click", (event) => {
    void dispatchAction(bridge, "s40-run-docprep", { estateIds: [...selectedEstateIds] }, event.currentTarget);
  });
  root?.querySelectorAll?.("[data-s40-approve], [data-approve-packet]").forEach((control) => {
    control.addEventListener("click", (event) => {
      void dispatchAction(bridge, "s40-approve-packet", { estateId: control.dataset.estateId }, event.currentTarget);
    });
  });
  root?.querySelectorAll?.("[data-s40-export], [data-export-handoff]").forEach((control) => {
    control.addEventListener("click", (event) => {
      void dispatchAction(bridge, "s40-export-handoff", { estateIds: [control.dataset.s40Export] }, event.currentTarget);
    });
  });
  return root;
}

function unmountS40DocPrepView(root) {
  destroyCommunityGrid("docprep");
  if (!root || root === activeMount) activeMount = null;
}

export { mountS40DocPrepView, renderS40DocPrepView, unmountS40DocPrepView };
