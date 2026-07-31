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
    || null;
}

function verifiedArtifactHref(candidate, artifactId) {
  const id = String(artifactId || "").trim();
  if (!id || !candidate) return "";
  try {
    const origin = globalThis.location?.origin || "http://localhost";
    const url = new URL(String(candidate), origin);
    if (url.origin !== origin || url.searchParams.get("artifactId") !== id) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

function documentPreviewMarkup(input = {}, escape = String) {
  const href = verifiedArtifactHref(input.artifactUrl, input.artifactId);
  if (!href) return `
    <section class="hr-document-overview" data-document-preview>
      <h3>PDF preview</h3>
      <p>${escape(input.emptyCopy || "Generate and verify this document to preview it here.")}</p>
    </section>
  `;
  return `
    <section class="hr-document-pdf-preview" data-document-preview>
      <iframe src="${escape(href)}" title="${escape(input.title || "Estate document PDF")}" loading="lazy"></iframe>
    </section>
  `;
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

const SOURCE_EVIDENCE_GROUPS = Object.freeze([
  Object.freeze({
    id: "property-appraiser",
    title: "Property Appraiser",
    copy: "Record the owner, folio, site address, mailing address, and exact official parcel URL.",
    fields: Object.freeze([
      { path: "propertyAppraiser.owner", label: "Owner", placeholder: "Owner exactly as shown" },
      { path: "propertyAppraiser.folio", label: "Folio", placeholder: "Folio or parcel number" },
      { path: "propertyAppraiser.address", label: "Property address", placeholder: "Property address exactly as shown", full: true },
      { path: "propertyAppraiser.mailingAddress", label: "Mailing address", placeholder: "Mailing address or mismatch note", full: true },
      { path: "propertyAppraiser.sourceUrl", label: "Official parcel URL", placeholder: "https://…", full: true },
    ]),
  }),
  Object.freeze({
    id: "tax",
    title: "Tax Collector",
    copy: "Preserve the listing, receipt, payment facts, and any truthful browser blocker.",
    fields: Object.freeze([
      { path: "taxReceipt.listingUrl", label: "Listing page", placeholder: "Tax Collector parcel or listing URL", full: true },
      { path: "taxReceipt.receiptLink", label: "Receipt link", placeholder: "Receipt link from the listing page", full: true },
      { path: "taxReceipt.paidBy", label: "Tax paid by", placeholder: "Name on last paid receipt" },
      { path: "taxReceipt.paidDate", label: "Paid date", placeholder: "Date shown on receipt" },
      { path: "taxReceipt.amountDue", label: "Amount due", placeholder: "$0.00 or amount from record" },
      { path: "taxReceipt.unpaidYears", label: "Unpaid years", placeholder: "Example: 2024, 2025" },
      { path: "taxReceipt.reassessment", label: "Reassessment", placeholder: "Reassessment note from tax record" },
      {
        path: "taxReceipt.status",
        label: "Receipt status",
        type: "select",
        options: Object.freeze([
          ["", "Needs review"],
          ["receipt_link_captured", "Receipt link captured"],
          ["paid_receipt_reviewed", "Paid receipt reviewed"],
          ["browser_workflow_required", "Browser workflow blocked"],
          ["unavailable_after_listing_check", "Unavailable after listing check"],
        ]),
      },
      { path: "taxReceipt.sourceBlockedReason", label: "Source blocker note", placeholder: "Record the exact truthful blocker.", type: "textarea", full: true },
      { path: "taxReceipt.listingHtml", label: "Listing page source note", placeholder: "Optional source excerpt needed to locate the receipt link.", type: "textarea", full: true },
    ]),
  }),
  Object.freeze({
    id: "deed",
    title: "Deed and title",
    copy: "Capture only facts supported by the official records result.",
    fields: Object.freeze([
      { path: "deed.sourceUrl", label: "Official Records page", placeholder: "Official Records search or result URL", full: true },
      { path: "deed.instrument", label: "OR or instrument", placeholder: "OR book/page or instrument" },
      { path: "deed.documentUrl", label: "Recorded deed file", placeholder: "PDF or record link" },
      { path: "deed.book", label: "Book", placeholder: "OR book" },
      { path: "deed.page", label: "Page", placeholder: "OR page" },
      { path: "deed.recordingDate", label: "Recording date", placeholder: "Date recorded" },
      { path: "deed.documentType", label: "Document type", placeholder: "Warranty deed, quit claim, etc." },
      { path: "deed.grantor", label: "Grantor", placeholder: "Seller or grantor shown" },
      { path: "deed.grantee", label: "Grantee", placeholder: "Buyer or grantee shown" },
      { path: "deed.lastSaleDate", label: "Last sale date", placeholder: "Last sale or transfer date" },
      { path: "deed.mortgageSignal", label: "Mortgage signal", placeholder: "Present, absent, or needs review" },
      { path: "deed.lienSignal", label: "Lien signal", placeholder: "Present, absent, or needs review" },
      { path: "deed.lisPendensSignal", label: "Lis Pendens", placeholder: "Present, absent, or needs review" },
      { path: "deed.foreclosureSignal", label: "Foreclosure signal", placeholder: "Present, absent, or needs review" },
      { path: "deed.adversePossessionSignal", label: "Adverse possession", placeholder: "Present, absent, or needs review" },
      { path: "deed.note", label: "Official Records notes", placeholder: "Owner-chain, title, mortgage, lien, or filing notes.", type: "textarea", full: true },
    ]),
  }),
  Object.freeze({
    id: "probate",
    title: "Probate",
    copy: "Keep missing records and unavailable documents explicit; do not infer a probate case.",
    fields: Object.freeze([
      { path: "probate.docketUrl", label: "Docket page", placeholder: "Clerk or probate docket URL", full: true },
      { path: "probate.caseNumber", label: "Case number", placeholder: "Case number from docket" },
      { path: "probate.caseStatus", label: "Case status", placeholder: "Open, closed, pending, etc." },
      { path: "probate.affidavitOfHeirsStatus", label: "Affidavit of heirs", placeholder: "Available, missing, requested" },
      { path: "probate.documentAvailability", label: "Probate documents", placeholder: "Available documents or request needed" },
      { path: "probate.docketNumber", label: "Related docket", placeholder: "Civil or family docket if found" },
      { path: "probate.caseType", label: "Related case type", placeholder: "Civil, family, probate" },
    ]),
  }),
  Object.freeze({
    id: "obituary",
    title: "Obituary and vital records",
    copy: "Record the reviewed result and preserve uncertainty when a source is unavailable.",
    fields: Object.freeze([
      {
        path: "obituary.status",
        label: "Obituary status",
        type: "select",
        options: Object.freeze([
          ["", "Needs review"],
          ["found", "Found"],
          ["reviewed-not-found", "Reviewed not found"],
        ]),
      },
      { path: "obituary.sourceUrl", label: "Link or snapshot", placeholder: "Obituary URL or screenshot file" },
      { path: "obituary.dateOfBirth", label: "Date of birth", placeholder: "DOB from obituary or vital source" },
      { path: "obituary.dateOfDeath", label: "Date of death", placeholder: "DOD from obituary or vital source" },
      { path: "obituary.marriageLicenseSignal", label: "Marriage or license signal", placeholder: "Spouse or marriage signal, or absent" },
      { path: "obituary.deathCertificateStatus", label: "Death certificate", placeholder: "Requested, obtained, missing" },
      { path: "obituary.googleNote", label: "Obituary or vital notes", placeholder: "Record the reviewed source result.", type: "textarea", full: true },
    ]),
  }),
]);

const SOURCE_EVIDENCE_PATHS = new Set(
  SOURCE_EVIDENCE_GROUPS.flatMap((group) => group.fields.map((field) => field.path)),
);

function nestedSourceValue(source, path) {
  return String(path || "").split(".").reduce((value, part) => value?.[part], source) ?? "";
}

function renderSourceEvidenceField(field, capture, escape) {
  const value = String(nestedSourceValue(capture, field.path));
  const className = field.full ? "hr-source-field hr-source-field-full" : "hr-source-field";
  const control = field.type === "select"
    ? `<select name="${escape(field.path)}">${field.options.map(([optionValue, label]) => (
        `<option value="${escape(optionValue)}"${value === optionValue ? " selected" : ""}>${escape(label)}</option>`
      )).join("")}</select>`
    : field.type === "textarea"
      ? `<textarea name="${escape(field.path)}" placeholder="${escape(field.placeholder || "")}">${escape(value)}</textarea>`
      : `<input name="${escape(field.path)}" value="${escape(value)}" placeholder="${escape(field.placeholder || "")}">`;
  return `<label class="${className}"><span>${escape(field.label)}</span>${control}</label>`;
}

function renderSourceEvidenceRail(context) {
  const { bridge, snapshot, escape } = railContext(context);
  if (!bridge || !snapshot.selectedEstateId) return "<p>Select an estate to review its source evidence.</p>";
  const capture = snapshot.docPrep?.sourceCapture || {};
  const run = capture.sourceApiRun || {};
  const verified = run.persistence?.stored === true && run.persistence?.readbackStatus === "verified";
  const blockers = Array.isArray(run.blockers) ? run.blockers.filter(Boolean) : [];
  return `
    <section class="hr-docprep-rail-panel hr-source-evidence" data-docprep-rail-panel="evidence">
      <header>
        <h2>Source evidence</h2>
        <p>Save reviewed facts to the canonical Discovery File. Blank fields remain unresolved.</p>
      </header>
      <div class="hr-source-readback" data-state="${verified ? "verified" : "review"}">
        <strong>${verified ? "Shared source run verified" : "Source review needs attention"}</strong>
        <span>${verified ? "This editor preserves the existing source run and updates reviewed facts without starting another run." : "Run Public Sources once from Document Prep, then save any reviewed fallback facts here."}</span>
        ${blockers.length ? `<ul>${blockers.map((blocker) => `<li>${escape(blocker)}</li>`).join("")}</ul>` : ""}
      </div>
      <form class="hr-source-evidence-form" data-source-evidence-form>
        ${SOURCE_EVIDENCE_GROUPS.map((group) => `
          <fieldset data-source-group="${escape(group.id)}">
            <legend>${escape(group.title)}</legend>
            <p>${escape(group.copy)}</p>
            <div class="hr-source-field-grid">
              ${group.fields.map((field) => renderSourceEvidenceField(field, capture, escape)).join("")}
            </div>
          </fieldset>
        `).join("")}
        <div class="hr-rail-actions">
          <button type="button" class="hr-text-command" data-rail-action="save-source-capture" data-estate-id="${escape(snapshot.selectedEstateId)}">Save source evidence</button>
        </div>
      </form>
    </section>
  `;
}

function setNestedSourceValue(target, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return;
  const leaf = parts.pop();
  const parent = parts.reduce((current, part) => {
    current[part] = current[part] && typeof current[part] === "object" ? current[part] : {};
    return current[part];
  }, target);
  parent[leaf] = String(value ?? "").trim();
}

function sourceCaptureFromFormData(formData = {}) {
  const capture = {};
  Object.entries(formData).forEach(([path, value]) => {
    if (SOURCE_EVIDENCE_PATHS.has(path)) setNestedSourceValue(capture, path, value);
  });
  return capture;
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
  const packet = snapshot.docPrep?.packet;
  if (!document) return `
    <section class="hr-docprep-rail-panel" data-docprep-rail-panel="document" data-document-view="full-packet">
      <header><p class="hr-eyebrow">Full estate file</p><h2>${escape(snapshot.selectedEstate?.title || "Discovery packet")}</h2><p>All generated estate sections in one document.</p></header>
      ${documentPreviewMarkup({
        artifactUrl: packet?.artifactUrl,
        artifactId: packet?.artifactId,
        title: `${snapshot.selectedEstate?.title || "Estate"} full packet`,
        emptyCopy: "Run and verify Document Prep to show the full estate packet here.",
      }, escape)}
      <div class="hr-rail-actions" aria-label="Full packet actions">
        ${packet ? '<button type="button" class="hr-text-command" data-rail-action="open-packet">Open full packet</button>' : ""}
        ${packet ? '<button type="button" class="hr-text-command" data-rail-action="download-packet">Download full packet</button>' : ""}
      </div>
    </section>
  `;
  const isIdiReport = document.id === "idi-asset-search";
  const canReplaceIdi = Boolean(snapshot.session?.canAdminister);
  const canRemove = !isIdiReport && document.fileSource === "supporting_document";
  return `
    <section class="hr-docprep-rail-panel" data-docprep-rail-panel="document" data-document-id="${escape(document.id)}">
      <header><p class="hr-eyebrow">Selected document</p><h2>${escape(document.title)}</h2><p>${escape(document.description || "Estate packet document")}</p></header>
      <button type="button" class="hr-text-command hr-full-packet-command" data-rail-action="show-full-packet">Show full packet</button>
      <dl class="hr-document-facts">
        <div><dt>Status</dt><dd>${escape(document.hasVerifiedFile ? "Verified" : document.status || "Needs review")}</dd></div>
        <div><dt>Source</dt><dd>${escape(document.source || "Estate file")}</dd></div>
        <div><dt>Update</dt><dd>${escape(relativeUpdate(document.updatedAt))}</dd></div>
        <div><dt>Estate</dt><dd>${escape(snapshot.selectedEstate?.title || "Selected estate")}</dd></div>
      </dl>
      ${documentPreviewMarkup({
        artifactUrl: document.hasVerifiedFile ? document.artifactUrl : "",
        artifactId: document.hasVerifiedFile ? document.artifactId : "",
        title: `${document.title} PDF`,
        emptyCopy: document.description || "Review this document in the selected estate file.",
      }, escape)}
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

function renderAttachmentsRail(context) {
  const { snapshot, escape } = railContext(context);
  const stopped = moveOnRailMarkup(snapshot, escape);
  if (stopped) return stopped;
  const attachments = Array.isArray(snapshot.docPrep?.attachments) ? snapshot.docPrep.attachments : [];
  return `
    <section class="hr-docprep-rail-panel" data-docprep-rail-panel="attachments">
      <header><p class="hr-eyebrow">Discovery evidence</p><h2>Attachments</h2><p>${escape(snapshot.selectedEstate?.title || "Selected estate")}</p></header>
      ${attachments.length ? `
        <div class="hr-attachment-list" aria-label="Back Story evidence">
          ${attachments.map((attachment) => `
            <article class="hr-attachment-row" data-attachment-id="${escape(attachment.id)}">
              <div>
                <strong>${escape(attachment.label)}</strong>
                <span>${escape(`${attachment.step} · ${attachment.source}`)}</span>
                ${attachment.fileName ? `<small>${escape(attachment.fileName)}</small>` : ""}
              </div>
              <div class="hr-attachment-actions">
                ${attachment.href ? `<button type="button" class="hr-text-command" data-rail-action="open-attachment" data-attachment-id="${escape(attachment.id)}">Open</button>` : '<span class="hr-attachment-review">Link needs review</span>'}
                ${attachment.href && attachment.downloadable ? `<button type="button" class="hr-text-command" data-rail-action="download-attachment" data-attachment-id="${escape(attachment.id)}">Download</button>` : ""}
              </div>
            </article>
          `).join("")}
        </div>
      ` : `
        <div class="hr-rail-guidance">
          <strong>No Back Story evidence is linked yet</strong>
          <span>Run Discovery or attach the source files needed for this estate.</span>
        </div>
      `}
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
        ${flow.isDiscovery ? `<wa-button class="beui-button" variant="brand" appearance="filled" data-rail-action="chatgpt-work" ${ready ? "" : "disabled"}>Continue in ChatGPT Work</wa-button>` : ""}
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

async function showFullPacket(payload = {}) {
  const { bridge, estateId } = currentPayload(payload);
  if (!bridge || !estateId) throw new Error("Select an estate first.");
  return bridge.dispatch("clear-document-selection", { estateId });
}

async function runAttachmentAction(action, payload = {}) {
  const { snapshot } = currentPayload(payload);
  const attachmentId = String(payload.attachmentId || "");
  const attachment = (snapshot.docPrep?.attachments || []).find((item) => String(item.id || "") === attachmentId);
  if (!attachment?.href) throw new Error("This evidence item does not have a verified source link.");
  let href;
  try {
    href = new URL(String(attachment.href), globalThis.location?.origin || "http://localhost");
  } catch {
    throw new Error("This evidence link is invalid.");
  }
  if (!["http:", "https:"].includes(href.protocol)) throw new Error("This evidence link uses an unsupported protocol.");
  const link = document.createElement("a");
  link.href = href.href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  if (action === "download" && href.origin === (globalThis.location?.origin || "http://localhost")) {
    link.download = String(attachment.fileName || attachment.label || "HeirRight evidence");
  }
  document.body.append(link);
  link.click();
  link.remove();
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

async function runSourceCaptureAction(payload = {}) {
  const { bridge, snapshot, estateId } = currentPayload(payload);
  if (!bridge || !estateId) throw new Error("Select an estate before saving source evidence.");
  if (String(snapshot.selectedEstateId || "") !== estateId) {
    throw new Error("The selected estate changed before this source evidence could be saved.");
  }
  return bridge.dispatch("save-source-capture", {
    estateId,
    capture: sourceCaptureFromFormData(payload.formData),
  });
}

const docPrepRail = Object.freeze({
  id: "doc-prep-context",
  label: "Document Prep",
  defaultTab: "automation",
  minWidth: 392,
  defaultWidth: 392,
  maxWidth: 552,
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
      id: "evidence",
      label: "Evidence",
      render: renderSourceEvidenceRail,
      actions: Object.freeze({
        "save-source-capture": runSourceCaptureAction,
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
        "show-full-packet": showFullPacket,
        "open-packet": (payload) => runPacketAction("open", payload),
        "download-packet": (payload) => runPacketAction("download", payload),
      }),
    }),
    Object.freeze({
      id: "attachments",
      label: "Attachments",
      render: renderAttachmentsRail,
      actions: Object.freeze({
        "open-attachment": (payload) => runAttachmentAction("open", payload),
        "download-attachment": (payload) => runAttachmentAction("download", payload),
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
  renderAttachmentsRail,
  renderContactReview,
  renderCompletionRail,
  renderDocumentRail,
  renderSourceEvidenceRail,
  runSourceCaptureAction,
  runPacketAction,
  runContactReviewAction,
  selectedDocument,
  sourceCaptureFromFormData,
};
