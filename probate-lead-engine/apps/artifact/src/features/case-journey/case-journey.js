const DISPOSITIONS = Object.freeze([
  "Move Forward",
  "Review",
  "Blocked",
  "Move On",
]);

const LIFECYCLE_STAGES = Object.freeze([
  Object.freeze({ id: "intake", label: "Intake", owner: "Estate intake" }),
  Object.freeze({ id: "property", label: "Property", owner: "Ownership review" }),
  Object.freeze({ id: "title-tax", label: "Title & Tax", owner: "Title and tax review" }),
  Object.freeze({ id: "probate-heirs", label: "Probate & Heirs", owner: "Probate research" }),
  Object.freeze({ id: "discovery", label: "Discovery", owner: "Discovery automation" }),
  Object.freeze({ id: "packet-review", label: "Packet Review", owner: "HeirRight review" }),
  Object.freeze({ id: "handoff", label: "Handoff", owner: "HeirRight operations" }),
]);

// Keep this browser fallback aligned with the Worker entity-owner detector. The
// server reason code is authoritative; this vocabulary prevents stale rows that
// predate COMPANY_OWNER from presenting a conflicting lifecycle disposition.
const ENTITY_OWNER_PATTERN = /\b(llc|l\.l\.c\.|inc\.?|corp\.?|corporation|company|co\.|ltd|lp|llp|bank|association|assoc|foundation|enterprises?|holdings?|investments?|realty|properties|church|iglesia|ministries|condo|cooperative)(?![a-z0-9_])/i;

function compactText(...values) {
  return values
    .flat()
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

function contains(text, pattern) {
  return pattern.test(String(text || ""));
}

function companyOwnerStop(state = {}) {
  const estate = state.selectedEstate || {};
  const stopReasonCodes = new Set(
    (Array.isArray(estate.stopReasonCodes) ? estate.stopReasonCodes : [])
      .map((code) => String(code).trim().toUpperCase()),
  );
  if (stopReasonCodes.has("COMPANY_OWNER")) return true;
  return contains(compactText(estate.owner, estate.ownerType), ENTITY_OWNER_PATTERN);
}

function reviewedEvidenceGroups(state = {}) {
  const groups = state.selectedEstate?.evidenceGroups;
  if (!groups || typeof groups !== "object" || Array.isArray(groups)) {
    return Object.freeze({ property: false, deed: false, tax: false, probate: false, heirs: false });
  }
  return Object.freeze({
    property: groups.property === true,
    deed: groups.deed === true,
    tax: groups.tax === true,
    probate: groups.probate === true,
    heirs: groups.heirs === true,
  });
}

function hasHandoffEvidence(state = {}) {
  const estateId = String(state.selectedEstate?.id || state.selectedEstateId || "");
  return Boolean(
    state.selectedEstate?.queued === true
    || (estateId && Array.from(state.queueIds || [], String).includes(estateId))
    || state.docPrep?.googleDelivered === true
  );
}

function resolveDisposition(state = {}) {
  const estate = state.selectedEstate || null;
  if (!estate) {
    return Object.freeze({
      label: "Blocked",
      tone: "blocked",
      reason: "Choose an estate file before the team starts property or probate review.",
      next: Object.freeze({ id: "choose-estate", label: "Choose an Estate", view: "find-estates" }),
    });
  }

  const estateSignals = compactText(
    estate.owner,
    estate.status,
    estate.tone,
    estate.classification,
    estate.nextAction,
    state.dealStatus?.label,
  ).toLowerCase();
  const stopReasonCodes = new Set(
    (Array.isArray(estate.stopReasonCodes) ? estate.stopReasonCodes : [])
      .map((code) => String(code).trim().toUpperCase()),
  );
  const automationSignals = compactText(
    state.docPrep?.automation?.status,
    ...(state.docPrep?.automation?.sections || []).map((section) => section.status),
  ).toLowerCase();

  const companyStop = companyOwnerStop(state);
  const recentSaleStop = estate.recentSaleWithinFiveYears === true
    || stopReasonCodes.has("RECENT_SALE_WITHIN_5_YEARS");
  const explicitMoveOn = String(estate.disposition || "").trim().toLowerCase() === "move on";
  if (companyStop || recentSaleStop || explicitMoveOn) {
    const reason = companyStop
      ? "The owner appears to be a company, so the workflow stops before paid or manual research."
      : recentSaleStop
        ? "A recent sale needs the operator to stop this prospect before paid or manual research."
        : "The estate is marked to stop before more research or outreach.";
    return Object.freeze({
      label: "Move On",
      tone: "move-on",
      reason,
      next: Object.freeze({ id: "review-next-estate", label: "Review Next Estate", view: "find-estates" }),
    });
  }

  const blocked = contains(estateSignals, /\b(blocked|source unavailable|access required)\b/)
    || contains(automationSignals, /\b(blocked|failed|failure|stopped)\b/);
  if (blocked) {
    return Object.freeze({
      label: "Blocked",
      tone: "blocked",
      reason: "A required source or review step is unavailable, so the packet cannot advance yet.",
      next: Object.freeze({ id: "review-blocker", label: "Review the Blocker", view: "dossiers" }),
    });
  }

  const packetVerified = Boolean(state.docPrep?.packetVerified);
  const packetApproved = packetVerified && Boolean(state.docPrep?.packetApproved);
  if (packetApproved) {
    return Object.freeze({
      label: "Move Forward",
      tone: "forward",
      reason: "An operator approved the current verified packet, so it is ready for the next controlled handoff.",
      next: Object.freeze({
        id: "prepare-handoff",
        label: "Prepare Handoff",
        view: "queue",
      }),
    });
  }

  const discoveryComplete = Boolean(state.docPrep?.complete)
    || Number(state.docPrep?.progress || 0) >= 100;

  const operatorNext = compactText(estate.nextAction);
  return Object.freeze({
    label: "Review",
    tone: "review",
    reason: packetVerified
      ? "The local PDF was verified and is waiting for an operator to review and approve this exact revision."
      : discoveryComplete
        ? "Discovery is complete, but the local packet still needs file verification before operator review."
        : operatorNext
      ? `${operatorNext.replace(/[.!?]+$/, "")}. Confirm the source evidence before advancing.`
      : "Property, title, tax, probate, or heir evidence still needs operator review.",
    next: Object.freeze({ id: "continue-review", label: "Continue Review", view: "dossiers" }),
  });
}

function stageCompletionIndex(state = {}) {
  if (!state.selectedEstate) return -1;
  const evidence = reviewedEvidenceGroups(state);
  const progress = Math.max(0, Math.min(100, Number(state.docPrep?.progress || 0)));
  let completed = 0;

  if (!evidence.property) return completed;
  completed = 1;
  if (!evidence.deed || !evidence.tax) return completed;
  completed = 2;
  if (!evidence.probate || !evidence.heirs) return completed;
  completed = 3;
  if (!Boolean(state.docPrep?.complete) && progress < 100) return completed;
  completed = 4;
  if (!Boolean(state.docPrep?.packetVerified)) return completed;
  if (!Boolean(state.docPrep?.packetApproved)) return completed;
  completed = 5;
  if (hasHandoffEvidence(state)) completed = 6;
  return completed;
}

function stageReason(stage, state, disposition) {
  if (!state.selectedEstate) return "Choose an estate to start.";
  const progress = Math.max(0, Math.min(100, Number(state.docPrep?.progress || 0)));
  const phase = state.docPrep?.currentPhase?.label;
  const reasons = {
    intake: "Estate identity and source are attached to this file.",
    property: "Confirm the owner, address, folio, and mailing-address evidence.",
    "title-tax": "Confirm deed, OR book/page, recent sale, tax receipts, and payer evidence.",
    "probate-heirs": "Confirm probate records, heirs, family links, and required documents.",
    discovery: phase
      ? `${phase} is the current Discovery step at ${progress}%.`
      : `Discovery is ${progress}% complete.`,
    "packet-review": state.docPrep?.packetApproved
      ? "An operator approved this exact verified packet revision."
      : state.docPrep?.packetVerified
        ? "The saved PDF was verified and is waiting for explicit operator approval."
        : "Review the completed packet and clear visible source flags.",
    handoff: state.docPrep?.googleDelivered
      ? "Google Workspace confirmed the approved packet was saved."
      : hasHandoffEvidence(state)
        ? "The estate is staged in Queue for an approved handoff."
        : "Prepare the reviewed packet for the next approved destination.",
  };
  if (disposition.label === "Move On" && stage.id !== "intake") return disposition.reason;
  return reasons[stage.id] || "Review this lifecycle step.";
}

function buildLifecycle(state = {}) {
  const disposition = resolveDisposition(state);
  const completedIndex = stageCompletionIndex(state);
  const stopIndex = disposition.label === "Move On"
    ? companyOwnerStop(state) ? 1 : 2
    : null;
  const currentIndex = completedIndex >= LIFECYCLE_STAGES.length - 1
    ? LIFECYCLE_STAGES.length - 1
    : Math.max(0, completedIndex + 1);

  return Object.freeze(LIFECYCLE_STAGES.map((stage, index) => {
    let status = index <= completedIndex ? "completed" : index === currentIndex ? "current" : "upcoming";
    if (stopIndex !== null) {
      status = index < stopIndex ? "completed" : index === stopIndex ? "blocked" : "upcoming";
    } else if (disposition.label === "Blocked" && state.selectedEstate && index === currentIndex) {
      status = "blocked";
    }
    return Object.freeze({
      ...stage,
      status,
      reason: stageReason(stage, state, disposition),
    });
  }));
}

function activityTimelineState(tone) {
  if (tone === "ready") return Object.freeze({ status: "Completed", tone: "completed" });
  if (tone === "blocked") return Object.freeze({ status: "Needs attention", tone: "blocked" });
  return Object.freeze({ status: "Update", tone: "current" });
}

function buildJourneyTimeline(state = {}) {
  const seen = new Set();
  const activity = (Array.isArray(state.activity) ? state.activity : [])
    .map((event, index) => ({ event: event || {}, index }))
    .sort((left, right) => (
      Number(right.event.updatedAt || 0) - Number(left.event.updatedAt || 0)
      || left.index - right.index
    ))
    .map(({ event, index }) => {
      const title = compactText(event.title) || "Estate update";
      const copy = compactText(event.copy) || "The estate file was updated.";
      const updatedAt = Number(event.updatedAt || 0);
      const timelineState = activityTimelineState(String(event.tone || "review").toLowerCase());
      return {
        id: `event-${updatedAt}-${index}`,
        estateId: compactText(event.estateId),
        title,
        copy,
        status: timelineState.status,
        tone: timelineState.tone,
        actor: compactText(event.actor, event.owner) || "HeirRight team",
        source: compactText(event.source) || "HeirRight workspace",
        updatedAt,
        dedupeKey: `${updatedAt}|${title}|${copy}`,
      };
    })
    .filter((event) => {
      if (seen.has(event.dedupeKey)) return false;
      seen.add(event.dedupeKey);
      return true;
    })
    .slice(0, 16)
    .map(({ dedupeKey: _dedupeKey, ...event }) => Object.freeze(event));
  return Object.freeze(activity);
}

export {
  DISPOSITIONS,
  LIFECYCLE_STAGES,
  buildJourneyTimeline,
  buildLifecycle,
  companyOwnerStop,
  hasHandoffEvidence,
  reviewedEvidenceGroups,
  resolveDisposition,
};
