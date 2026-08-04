import { escapeFor } from "./document-row.js";
import { createCommunityGrid, destroyCommunityGrid } from "../data-grid/community-grid.js";
import { estateWorkflowStateLabels } from "../estate-export/workflow-model.js";

const stageLabels = Object.freeze({
  "source-review": "Checking source records",
  "packet-render": "Building the Discovery packet",
  "pdf-readback": "Checking the finished PDF",
  "export-handoff": "Preparing the export",
});

const discoveryFetchLabel = "";
const discoveryFetchingLabel = "Gathering report data...";
const discoveryRetryLabel = "Report needs review";
const discoveryMissingLabel = "";

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
  return row?.idiReportReady === true
    && (state === "queued" || (state === "blocked" && row.workflowBlockerStage !== "export-handoff"));
}

function workflowLabel(row) {
  const label = row?.workflowLabel || estateWorkflowStateLabels[workflowState(row)] || "";
  return label === "Queued for Doc Prep" ? "" : label;
}

function discoveryPreviewFallback(preview, completed = discoveryMissingLabel) {
  const state = String(preview?.workflowState || "queued");
  if (state === "processing") return discoveryFetchingLabel;
  if (state === "blocked") return discoveryRetryLabel;
  if (state === "completed-awaiting-export" || state === "exported") return completed;
  return discoveryFetchLabel;
}

function cleanDiscoveryPreviewText(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^(?:needs review|needs source review|needs approved enrichment|address needs review|dates need review|obituary needs review|folio needs review|county needs review)(?:[.:]|$)/i.test(text)) return "";
  return text;
}

function discoveryPreviewValue(bridge, value, fallback = discoveryFetchLabel) {
  const text = cleanDiscoveryPreviewText(value);
  const shown = text || fallback;
  return "<span class=\"s40-discovery-value" + (text ? "" : " s40-discovery-pending") + "\">"
    + escape(bridge, shown)
    + "</span>";
}

function discoveryPreviewParagraphs(bridge, value, fallback) {
  const lines = String(value || "").split(/\n+/).map(cleanDiscoveryPreviewText).filter(Boolean);
  return (lines.length ? lines : [fallback]).map((line) => "<p>" + escape(bridge, line) + "</p>").join("");
}

function discoveryPreviewLink(bridge, label, url, fallback = discoveryFetchLabel) {
  const candidate = cleanDiscoveryPreviewText(url);
  if (!candidate) return discoveryPreviewValue(bridge, "", fallback);
  return "<a class=\"s40-discovery-source-link\" href=\"" + escape(bridge, candidate) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + escape(bridge, label) + "</a>";
}

function renderPossibleHeirsTable(preview, bridge) {
  const contacts = Array.isArray(preview.contacts) ? preview.contacts : [];
  const rowCount = Math.max(3, contacts.length);
  const missing = discoveryPreviewFallback(preview);
  return "<section class=\"s40-discovery-heirs\"><h2>Possible Heirs</h2><table class=\"s40-discovery-heirs-table\"><thead><tr><th>Name</th><th>Relationship</th><th>Age</th><th>Likely current address</th></tr></thead><tbody>"
    + Array.from({ length: rowCount }, (_, index) => {
      const contact = contacts[index] || {};
      return "<tr><td>" + discoveryPreviewValue(bridge, contact.name, missing) + "</td><td>"
        + discoveryPreviewValue(bridge, contact.relationship, missing) + "</td><td>"
        + discoveryPreviewValue(bridge, contact.age, missing) + "</td><td>"
        + discoveryPreviewValue(bridge, contact.likelyCurrentAddress, missing) + "</td></tr>";
    }).join("")
    + "</tbody></table></section>";
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
  return "<table class=\"s40-discovery-offer\" aria-label=\"Offer and profit calculations\" aria-colcount=\"3\">"
    + "<colgroup><col class=\"s40-discovery-offer-description\"><col class=\"s40-discovery-offer-percentage\"><col class=\"s40-discovery-offer-total\"></colgroup>"
    + "<thead><tr class=\"s40-discovery-offer-bar\"><th colspan=\"3\">Offer/Profit</th></tr>"
    + "<tr><th scope=\"col\">Description</th><th scope=\"col\">Percentage</th><th scope=\"col\">Total</th></tr></thead><tbody>"
    + rows.map((row) => {
      const tone = ["blue", "yellow"].includes(row.tone) ? " " + row.tone : "";
      const strong = ["As-Is Value", "Post Equity Value", "Profit", "Min Profit"].includes(row.label) ? " s40-discovery-strong" : "";
      const missing = row.label ? discoveryPreviewFallback(preview) : "";
      return "<tr class=\"s40-discovery-offer-row" + tone + "\"><td class=\"" + strong.trim() + "\">"
        + discoveryPreviewValue(bridge, row.label, "")
        + "</td><td>" + discoveryPreviewValue(bridge, row.percentage, missing) + "</td><td>"
        + discoveryPreviewValue(bridge, row.total, missing)
        + "</td></tr>";
    }).join("")
    + "</tbody></table>";
}

function renderDiscoveryContact(contact, bridge, index, preview) {
  const missing = discoveryPreviewFallback(preview);
  const history = Array.isArray(contact.addressHistory) && contact.addressHistory.length
    ? contact.addressHistory.map((item) => "<p>" + discoveryPreviewValue(bridge, item.address, missing)
      + "<br><span>" + discoveryPreviewValue(bridge, item.dates, missing) + "</span></p>").join("")
    : "<p>" + discoveryPreviewValue(bridge, contact.likelyCurrentAddress, missing) + "</p>";
  const phones = Array.isArray(contact.phones) && contact.phones.length
    ? contact.phones.map((phone) => "<p>" + discoveryPreviewValue(bridge, phone, missing) + "</p>").join("")
    : "<p>" + discoveryPreviewValue(bridge, "", missing) + "</p>";
  const emails = Array.isArray(contact.emails) && contact.emails.length
    ? contact.emails.map((email) => "<p>" + discoveryPreviewValue(bridge, email, missing) + "</p>").join("")
    : "<p>" + discoveryPreviewValue(bridge, "", missing) + "</p>";
  return "<section class=\"s40-discovery-person\"><h3>" + (index + 1) + ". "
    + discoveryPreviewValue(bridge, contact.name, missing)
    + (contact.relationship ? " (" + discoveryPreviewValue(bridge, contact.relationship, missing) + ")" : "")
    + "</h3>"
    + (contact.age ? "<p>" + discoveryPreviewValue(bridge, contact.age, missing) + "</p>" : "")
    + "<p>Likely Current Address: " + discoveryPreviewValue(bridge, contact.likelyCurrentAddress, missing) + "</p>"
    + "<h4>Address (County/Parish/Borough) History:</h4>" + history
    + "<h4>Phone number:</h4>" + phones
    + "<h4>Email Address:</h4>" + emails
    + "</section>";
}

function renderDiscoveryTemplatePreview(row, bridge) {
  const preview = row.discoveryPreview || {};
  const live = preview.state === "live";
  const missing = discoveryPreviewFallback(preview);
  const missingLink = discoveryPreviewFallback(preview, "Source link not returned");
  const title = cleanDiscoveryPreviewText(preview.title || row.title) || "Estate file";
  const contacts = Array.isArray(preview.contacts) ? preview.contacts : [];
  const contactMarkup = contacts.length
    ? contacts.map((contact, index) => renderDiscoveryContact(contact, bridge, index, preview)).join("")
    : "";
  const firstPageContent = "<h1 class=\"s40-discovery-title\">" + discoveryPreviewValue(bridge, title, "Estate file") + "</h1>"
    + "<p class=\"s40-discovery-subtitle\">Family Tree</p>"
    + "<p class=\"s40-discovery-date\">Date added: " + discoveryPreviewValue(bridge, preview.dateAdded, missing) + "</p>"
    + "<p class=\"s40-discovery-property\">Property Address: " + discoveryPreviewValue(bridge, preview.propertyAddress, missing) + "</p>"
    + renderDiscoveryOfferTable(preview, bridge)
    + "<section class=\"s40-discovery-summary\"><p><strong>Owner:</strong></p><p><strong>"
    + discoveryPreviewValue(bridge, preview.owner, missing)
    + "</strong></p><p>DOB: " + discoveryPreviewValue(bridge, preview.dateOfBirth, missing)
    + "</p><p>DOD: " + discoveryPreviewValue(bridge, preview.dateOfDeath, missing)
    + "</p><p>" + discoveryPreviewValue(bridge, preview.obituary, missing) + "</p>"
    + "<p>Folio: " + discoveryPreviewValue(bridge, preview.folio, missing) + "</p>"
    + "</section>";
  const continuationContent = "<section class=\"s40-discovery-story\"><p><strong>Back Story:</strong></p>"
    + discoveryPreviewParagraphs(bridge, preview.backStory, missing)
    + "<p class=\"s40-discovery-evidence\"><strong>Property tax website:</strong> " + discoveryPreviewLink(bridge, "Open source", preview.propertyTaxUrl || preview.sourceLink, missingLink) + "</p>"
    + "<p class=\"s40-discovery-evidence\"><strong>Tax receipt copy:</strong> " + discoveryPreviewLink(bridge, "Open source", preview.taxReceiptUrl, missingLink) + "</p>"
    + "<p class=\"s40-discovery-evidence\"><strong>Obituary:</strong> " + discoveryPreviewLink(bridge, "Open source", preview.obituaryUrl, missingLink) + "</p></section>"
    + renderPossibleHeirsTable(preview, bridge);
  const pages = [firstPageContent, continuationContent];
  const pageSections = ["Family Tree", "Back Story and Heirs"];
  if (contactMarkup) {
    pages.push("<section class=\"s40-discovery-contact-detail\"><h2>Heir detail review</h2>" + contactMarkup + "</section>");
    pageSections.push("Heir detail review");
  }
  const pageMarkup = pages.map((content, index) => {
    const continuation = index > 0;
    const breadcrumb = continuation
      ? "<div class=\"s40-discovery-page-header\"><span>" + escape(bridge, title) + "</span><span> / " + escape(bridge, pageSections[index]) + " / Continued</span></div>"
      : "<div class=\"s40-discovery-page-header\"><span>HeirRight Discovery packet</span><span>" + escape(bridge, pageSections[index]) + "</span></div>";
    return "<main class=\"s40-discovery-template-page\" data-page-number=\"" + (index + 1) + "\">"
      + breadcrumb
      + "<div class=\"s40-discovery-page-content\">" + content + "</div>"
      + "<footer class=\"s40-discovery-page-footer\"><span>HeirRight Discovery</span><span>" + (index + 1) + " of " + pages.length + "</span></footer>"
      + "</main>";
  }).join("");
  return "<div class=\"s40-preview-viewport\" data-preview-state=\"" + (live ? "live" : "template") + "\" aria-label=\"" + escape(bridge, live ? "Live Discovery packet preview" : "Discovery packet template") + "\">"
    + "<div class=\"s40-discovery-paper\">" + pageMarkup + "</div></div>";
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

function verifiedArtifactDownloadName(row) {
  const sourceName = String(row?.workflowArtifact?.fileName || "").trim();
  if (sourceName) return sourceName.toLowerCase().endsWith(".pdf") ? sourceName : `${sourceName}.pdf`;
  const title = String(row?.title || "estate-file")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "estate-file";
  return `${title}-discovery-packet.pdf`;
}

function dynamicIslandStep(row) {
  const stages = Array.isArray(row?.workflowStages) ? row.workflowStages : [];
  const active = stages.find((stage) => stage.status === "active");
  const blocked = stages.find((stage) => stage.status === "blocked");
  const pending = stages.find((stage) => stage.status === "pending");
  const stage = active || blocked || pending || stages[stages.length - 1];
  if (!stage) {
    return row
      ? { state: "pending", label: stageLabels["source-review"], detail: "Waiting to start" }
      : { state: "pending", label: "Waiting for an estate", detail: "Select a queued file to begin" };
  }
  const label = stageLabels[stage.id] || stage.label || "Doc Prep stage";
  if (active) return { state: "active", label, detail: "Working through the estate file" };
  if (blocked) return { state: "blocked", label, detail: "Review required before continuing" };
  if (pending && workflowState(row) === "completed-awaiting-export" && stage.id === "export-handoff") {
    return { state: "pending", label, detail: "Waiting for approval" };
  }
  if (pending && workflowState(row) === "processing") return { state: "active", label, detail: "Working through the estate file" };
  if (pending) return { state: "pending", label, detail: workflowState(row) === "queued" ? "Waiting to start" : "Waiting" };
  return { state: "complete", label, detail: "Finished" };
}

function recentManualUpload(snapshot, estateId) {
  const selectedEstateId = String(estateId || "").trim();
  if (!selectedEstateId) return false;
  const event = (Array.isArray(snapshot?.activity) ? snapshot.activity : []).find((candidate) => (
    String(candidate?.estateId || "").trim() === selectedEstateId
    && candidate?.source === "IDI report upload"
    && candidate?.title === "IDI report ready"
    && candidate?.tone !== "blocked"
  ));
  if (!event) return false;
  const updatedAt = Number(event.updatedAt || event.at || 0);
  return updatedAt > 0 && Date.now() - updatedAt < 8_000;
}

function renderDynamicIsland(row, snapshot, bridge) {
  const uploadConfirmed = Boolean(row && recentManualUpload(snapshot, row.id) && workflowState(row) !== "blocked");
  const step = uploadConfirmed
    ? { state: "success", label: "IDI report uploaded", detail: "Verified and ready for Discovery" }
    : dynamicIslandStep(row);
  const ariaLabel = `Doc Prep current step: ${step.label}. ${step.detail}.`;
  const processing = workflowState(row) === "processing";
  const action = processing
    ? `<button type="button" class="s40-secondary-button s40-island-action" data-s40-stop data-stop-docprep="${escape(bridge, row?.id || "")}">Stop</button>`
    : row
      ? `<button type="button" class="s40-primary-button s40-island-action" data-s40-run data-run-docprep data-estate-id="${escape(bridge, row.id)}" ${runEligible(row) ? "" : "disabled title=\"Upload a verified IDI report before running Doc Prep.\""}>Run Doc Prep</button>`
      : "";
  return `<div class="s40-dynamic-island" data-state="${escape(bridge, step.state)}" role="status" aria-live="polite" aria-atomic="true" aria-label="${escape(bridge, ariaLabel)}">
    <span class="s40-island-loader" aria-hidden="true"><span></span></span>
    <span class="s40-island-copy"><strong>${escape(bridge, step.label)}</strong><span>${escape(bridge, step.detail)}</span></span>
    ${action ? `<span class="s40-island-controls">${action}</span>` : ""}
  </div>`;
}

function streamStatusLabel(row) {
  const state = workflowState(row);
  if (state === "processing") {
    const activeStage = (Array.isArray(row?.workflowStages) ? row.workflowStages : [])
      .find((stage) => stage.status === "active");
    const label = stageLabels[activeStage?.id] || activeStage?.label || "Packet stream";
    return "Live - " + label;
  }
  if (state === "completed-awaiting-export") return "Ready for export";
  if (state === "blocked") return "Blocked - retry available";
  if (state === "exported") return "Exported";
  return "Queued";
}

function renderArtifactStreamSwitcher(rows, current, bridge) {
  if (!Array.isArray(rows) || rows.length < 2) return "";
  return "<nav class=\"s40-stream-switcher\" aria-label=\"Live report streams\">"
    + "<span class=\"s40-stream-switcher-label\">Live report streams</span>"
    + "<div class=\"s40-stream-switcher-list\">"
    + rows.map((row) => {
      const active = String(row.id) === String(current?.id || "");
      const title = row.title || "Estate file";
      const status = streamStatusLabel(row);
      return "<button type=\"button\" class=\"s40-stream-switch\" data-s40-stream-estate=\""
        + escape(bridge, row.id)
        + "\" data-s40-stream-action=\"select-estate"
        + "\" aria-pressed=\"" + (active ? "true" : "false")
        + "\" aria-label=\"Switch to " + escape(bridge, title) + " report stream\">"
        + "<strong>" + escape(bridge, title) + "</strong>"
        + "<span>" + escape(bridge, status) + "</span></button>";
    }).join("")
    + "</div></nav>";
}

function renderEstateSelector(rows) {
  return rows.length
    ? `<div class="s40-selector-grid hr-community-grid" data-community-grid="docprep" data-grid-label="Queued estates" aria-label="Queued estates"></div>`
    : `<div class="s40-empty-selector"><strong>No estates are queued.</strong><span>Return to Estates to choose the next files for Doc Prep.</span><button type="button" class="s40-link-button" data-open-estates>Open Estates</button></div>`;
}

function renderArtifactRail(row, bridge, rows = [], snapshot = {}) {
  if (!row) {
    return `<div class="s40-rail-empty"><strong>Select a queued estate</strong><span>The selected packet and its stage evidence will appear here.</span></div>`;
  }
  const artifactHref = verifiedArtifactHref(row.workflowArtifact);
  const workflow = workflowState(row);
  const blocker = String(row.workflowBlocker || "").trim();
  const packetApproved = row.packetApproved === true;
  const hasVerifiedArtifact = Boolean(artifactHref && row.workflowArtifact?.artifactId);
  const preview = row.discoveryPreview || { title: row.title, propertyAddress: row.address, state: "template" };
  const idiReady = row.idiReportReady === true;
  const idiStatus = idiReady ? "IDI report ready" : row.idiReportStatus || "IDI report required";
  const idiStatusCopy = idiReady
    ? row.idiReportStatusCopy || "The report passed storage and readback verification."
    : row.idiReportStatusCopy || "Upload the approved IDI report PDF before running Doc Prep.";
  const previewStateLabel = hasVerifiedArtifact ? "Verified internal PDF" : preview.state === "live" ? "Live Discovery packet" : "Discovery packet template";
  const packet = hasVerifiedArtifact
    ? `<div class="s40-pdf-frame"><iframe src="${escape(bridge, artifactHref)}" title="Verified internal PDF for ${escape(bridge, row.title)}" loading="lazy"></iframe></div>
       <div class="s40-artifact-meta"><span>Verified internal PDF</span><span class="s40-artifact-actions"><a href="${escape(bridge, artifactHref)}" target="_blank" rel="noopener noreferrer">Open PDF</a><a href="${escape(bridge, artifactHref)}" download="${escape(bridge, verifiedArtifactDownloadName(row))}" data-s40-download>Download PDF</a></span></div>`
    : renderDiscoveryTemplatePreview({ ...row, discoveryPreview: preview }, bridge);
  const approvalControl = hasVerifiedArtifact && workflow !== "exported"
    ? `<div class="s40-approval-bar" data-state="${packetApproved ? "approved" : "pending"}">
        <span>${packetApproved ? "Approved for controlled export." : "Verified readback passed. Approve this packet before export handoff."}</span>
        ${packetApproved ? "" : `<button type="button" class="s40-primary-button" data-s40-approve data-approve-packet data-estate-id="${escape(bridge, row.id)}">Approve packet for export</button>`}
      </div>`
    : "";
  return renderArtifactStreamSwitcher(rows, row, bridge) + `
    <header class="s40-rail-head">
      <div><p class="s40-rail-kicker">Current</p><h2>${escape(bridge, row.title || "Estate file")}</h2><p>${escape(bridge, row.address || "Address unavailable")}</p></div>
      <div class="s40-rail-head-commands">
        <span class="s40-idi-status" data-state="${idiReady ? "ready" : "required"}"><strong>${escape(bridge, idiStatus)}</strong><span>${escape(bridge, idiStatusCopy)}</span></span>
        <button type="button" class="s40-secondary-button" data-s40-idi-upload aria-label="Upload IDI Report PDF for ${escape(bridge, row.title || "this estate")}">Upload IDI Report PDF</button>
        <input type="file" hidden data-s40-idi-file accept=".pdf,application/pdf" aria-label="Choose an IDI Report PDF">
        ${workflow !== "processing" && workflowLabel(row) ? `<span class="s40-state-label" data-state="${escape(bridge, workflow)}">${escape(bridge, workflowLabel(row))}</span>` : ""}
      </div>
    </header>
    ${blocker ? `<p class="s40-blocker" role="alert">${escape(bridge, blocker)}</p>` : ""}
    ${renderDynamicIsland(row, snapshot, bridge)}
    <section class="s40-artifact-surface" data-s40-stream-window="${escape(bridge, row.id)}" data-preview-state="${escape(bridge, hasVerifiedArtifact ? "verified" : preview.state || "template")}" aria-live="polite" aria-label="${escape(bridge, hasVerifiedArtifact ? "Verified packet preview" : previewStateLabel)}">
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

function emptyDocPrepView(bridge) {
  return [
    "<section class=\"s40-docprep s40-docprep-empty\" data-feature=\"s40-doc-prep\">",
    "  <div class=\"s40-workbench\">",
    "    <aside class=\"s40-selector\" aria-label=\"Doc Prep estate selector\">",
    "      <header><div><span class=\"s40-column-kicker\">Queued estates</span><h2>Select files</h2></div><span>0</span></header>",
    "      <div class=\"s40-empty-selector\"><strong>Nothing is queued</strong><span>Queue an eligible estate from Estates to start Doc Prep.</span><button type=\"button\" class=\"s40-link-button\" data-open-estates>Open Estates</button></div>",
    "    </aside>",
    "    <article class=\"s40-artifact-rail s40-artifact-rail-empty\" aria-label=\"Doc Prep artifact and status rail\">",
    "      <header class=\"s40-empty-rail-head\"><div><p class=\"s40-rail-kicker\">Per-file and batch status</p><h2>Doc Prep status</h2><p>Select queued files to inspect each packet and phase.</p></div><div class=\"s40-docprep-type-strip\" aria-label=\"Doc Prep types\"><span aria-current=\"true\">Discovery</span><span>Closing Prep</span></div></header>",
    `      ${renderDynamicIsland(null, {}, bridge)}`,
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
    <section class="s40-docprep" data-feature="s40-doc-prep" data-estate-id="${escape(bridge, current?.id || "")}">
      <header class="s40-docprep-head">
        <div><p class="s40-rail-kicker">Doc Prep workbench</p><h1>Review packets, then hand off</h1></div>
        <div class="s40-docprep-command"><span aria-live="polite" data-s40-selected-count>${escape(bridge, countLabel)}</span></div>
      </header>
      <div class="s40-workbench">
        <aside class="s40-selector" aria-label="Doc Prep estate selector">
          <header><div><span class="s40-column-kicker">Queued estates</span><h2>Select files</h2></div><span>${rows.length}</span></header>
          ${renderEstateSelector(rows)}
        </aside>
        <article class="s40-artifact-rail" aria-label="Doc Prep artifact rail">
          ${renderArtifactRail(current, bridge, rows, snapshot)}
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
  const stopControl = root?.querySelector?.("[data-s40-stop], [data-stop-docprep]");
  const updateRunControl = (nextRows = rows) => {
    const selected = nextRows.filter((row) => selectedEstateIds.has(String(row.id)));
    const runnable = selected.filter(runEligible);
    if (selectedCount) selectedCount.textContent = selected.length === 1 ? "1 estate selected" : `${selected.length} estates selected`;
    if (runControl) {
      runControl.disabled = runnable.length === 0;
      runControl.textContent = runnable.length > 1 ? `Run Doc Prep for ${runnable.length}` : "Run Doc Prep";
    }
    if (stopControl) stopControl.disabled = !nextRows.some((row) => workflowState(row) === "processing");
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
      pagination: false,
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
  const idiUpload = root?.querySelector?.("[data-s40-idi-upload]");
  const idiFile = root?.querySelector?.("[data-s40-idi-file]");
  idiUpload?.addEventListener("click", () => idiFile?.click());
  idiFile?.addEventListener("change", () => {
    const file = idiFile.files?.[0] || null;
    if (!file) return;
    if (file.type !== "application/pdf" && !String(file.name || "").toLowerCase().endsWith(".pdf")) {
      bridge.emit("IDI Report upload blocked", "Choose a PDF exported from the approved IDI report workflow.", "blocked");
      idiFile.value = "";
      return;
    }
    void dispatchAction(bridge, "s40-upload-idi-report", { estateId: root.dataset.estateId, file }, idiUpload)
      .finally(() => {
        if (idiFile.isConnected) idiFile.value = "";
      });
  });
  root?.querySelectorAll?.("[data-open-estates]").forEach((control) => {
    control.addEventListener("click", () => bridge.navigate("find-estates"));
  });
  root?.querySelectorAll?.("[data-s40-stream-action]").forEach((control) => {
    control.addEventListener("click", (event) => {
      void dispatchAction(bridge, "select-estate", { estateId: control.dataset.s40StreamEstate }, event.currentTarget);
    });
  });
  root?.querySelector("[data-s40-run], [data-run-docprep]")?.addEventListener("click", (event) => {
    void dispatchAction(bridge, "s40-run-docprep", { estateIds: [...selectedEstateIds] }, event.currentTarget);
  });
  root?.querySelector("[data-s40-stop], [data-stop-docprep]")?.addEventListener("click", (event) => {
    const estateId = event.currentTarget.dataset.stopDocprep || root.dataset.estateId;
    void dispatchAction(bridge, "s40-stop-docprep", { estateIds: estateId ? [estateId] : [...selectedEstateIds] }, event.currentTarget);
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
