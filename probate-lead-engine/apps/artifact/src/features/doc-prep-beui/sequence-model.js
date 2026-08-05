const STAGE_STATES = new Set([
  "pending",
  "running",
  "succeeded",
  "review_required",
  "blocked",
  "failed",
  "cancelled",
]);

const CASE_STATES = new Set([
  "queued",
  "sourcing",
  "review_required",
  "rendering",
  "packet_ready",
  "blocked",
  "failed",
  "cancelled",
]);

export const DOC_PREP_SEQUENCE = Object.freeze([
  Object.freeze({
    id: "skip_trace_parse",
    title: "Parsing Skip Trace Report",
    detail: "Filling out Potential Heirs, Contact information…",
  }),
  Object.freeze({
    id: "obituary_search",
    title: "Searching Obituary",
    detail: "Gathering vital obituary, marriage &amp; related records…",
  }),
  Object.freeze({
    id: "deed_title_search",
    title: "Searching for Deeds or Titles",
    detail: "Checking official records….",
  }),
  Object.freeze({
    id: "tax_receipt_fetch",
    title: "Fetching Tax Receipt",
    detail: "Pulling from public Tax Collector’s Office records….",
  }),
  Object.freeze({
    id: "court_records_search",
    title: "Searching Court Records",
    detail: "Probate, Civil, Family Courts…..",
  }),
  Object.freeze({
    id: "backstory_generate",
    title: "Generating Back Story",
    detail: "Using Solvys systems….",
  }),
]);

const SAFE_ACTIONS = new Set([
  "Select the uploaded IDI report for this estate and retry this stage.",
  "Retry after the configured obituary provider is healthy.",
  "Retry after the Clerk provider is healthy.",
  "Retry after the Tax Collector source is healthy.",
  "Retry after the configured source is healthy.",
  "Review the returned records before continuing.",
  "Retry the stage.",
]);

const SAFE_OPERATOR_TEXT = new Set([
  "A selected persisted IDI report is required before skip-trace parsing.",
  "The obituary and vital-record workflow failed.",
  "The Clerk provider request failed.",
  "The Tax Collector provider request failed.",
  "The process needs operator review before it can continue.",
]);

const CASE_STATE_LABELS = {
  queued: "Queued",
  sourcing: "In progress",
  review_required: "Review required",
  rendering: "Rendering packet",
  packet_ready: "Complete",
  blocked: "Blocked",
  failed: "Failed",
  cancelled: "Stopped",
};

const STAGE_STATE_LABELS = {
  pending: "Pending",
  running: "In progress",
  succeeded: "Complete",
  review_required: "Review required",
  blocked: "Blocked",
  failed: "Failed",
  cancelled: "Stopped",
};

function isRecord(value) {
  return value !== null && typeof value === "object";
}

function knownStageId(value) {
  return DOC_PREP_SEQUENCE.some((stage) => stage.id === value) ? value : null;
}

function knownStageState(value) {
  return STAGE_STATES.has(value) ? value : null;
}

function knownCaseState(value) {
  return CASE_STATES.has(value) ? value : null;
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

export function displayStageCopy(value) {
  return stringValue(value).replaceAll("&amp;", "&");
}

export function normalizeProcessEvents(processCase, events = []) {
  const persistedEvents = isRecord(processCase) && Array.isArray(processCase.events)
    ? processCase.events
    : [];
  const suppliedEvents = Array.isArray(events) ? events : [];

  return [...persistedEvents, ...suppliedEvents]
    .filter(isRecord)
    .map((event, index) => {
      const occurredAt = stringValue(event.occurredAt);
      return {
        id: stringValue(event.id) || `event-${index + 1}`,
        stageId: knownStageId(event.stageId),
        state: knownStageState(event.state),
        occurredAt: Number.isNaN(Date.parse(occurredAt)) ? "" : occurredAt,
      };
    })
    .filter((event) => event.stageId && event.state)
    .sort((left, right) => {
      const leftTime = left.occurredAt ? Date.parse(left.occurredAt) : 0;
      const rightTime = right.occurredAt ? Date.parse(right.occurredAt) : 0;
      return leftTime - rightTime || left.id.localeCompare(right.id);
    });
}

function stepFor(processCase, stageId) {
  if (!isRecord(processCase) || !Array.isArray(processCase.steps)) return null;
  return processCase.steps.find(
    (step) => isRecord(step) && step.id === stageId,
  ) ?? null;
}

function latestEventFor(events, stageId) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].stageId === stageId) return events[index];
  }
  return null;
}

function stateFromDurableSources(processCase, stageId, events) {
  const step = stepFor(processCase, stageId);
  const stepState = knownStageState(step?.state);
  if (stepState) return stepState;
  return latestEventFor(events, stageId)?.state ?? "pending";
}

export function processState(processCase) {
  return knownCaseState(isRecord(processCase) ? processCase.state : null);
}

export function safeNextAction(value, state = "pending") {
  const candidate = stringValue(value);
  if (SAFE_ACTIONS.has(candidate)) return candidate;
  if (state === "review_required") return "Review the returned records before continuing.";
  if (state === "blocked" || state === "failed") return "Retry the stage.";
  return "";
}

export function safeOperatorText(value, state = "pending") {
  const candidate = stringValue(value);
  if (SAFE_OPERATOR_TEXT.has(candidate)) return candidate;
  if (state === "review_required") {
    return "The process needs operator review before it can continue.";
  }
  if (state === "blocked") {
    return "The process is blocked by a provider or system condition.";
  }
  if (state === "failed") return "The process could not complete this stage.";
  if (state === "cancelled") return "The durable process was stopped.";
  return "";
}

function safeIdentifier(value) {
  return typeof value === "string" && /^[A-Z]{2,10}-\d{1,8}$/.test(value)
    ? value
    : null;
}

function safeLinearUrl(value) {
  if (typeof value !== "string" || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.search || url.hash) return null;
    if (url.hostname !== "linear.app") return null;
    if (!url.pathname || url.pathname === "/") return null;
    return url.href;
  } catch {
    return null;
  }
}

function repairReferenceFromCandidate(candidate) {
  if (typeof candidate === "string") {
    const href = safeLinearUrl(candidate);
    if (href) return { label: "Open Linear repair issue", href };
    const identifier = safeIdentifier(candidate);
    return identifier ? { label: identifier, href: null } : null;
  }
  if (!isRecord(candidate)) return null;

  const href = safeLinearUrl(candidate.url) ?? safeLinearUrl(candidate.href);
  if (href) return { label: "Open Linear repair issue", href };

  const identifier = safeIdentifier(candidate.identifier);
  return identifier ? { label: identifier, href: null } : null;
}

export function repairReference(processCase, step) {
  const candidates = [];
  const addCandidate = (value) => {
    if (value !== undefined && value !== null) candidates.push(value);
  };

  if (isRecord(step)) {
    addCandidate(step.repairReference);
    addCandidate(step.repair);
    addCandidate(step.linearIssue);
    if (isRecord(step.facts)) {
      addCandidate(step.facts.repairReference);
      addCandidate(step.facts.linearIssue);
    }
  }
  if (isRecord(processCase)) {
    addCandidate(processCase.repairReference);
    addCandidate(processCase.repair);
    addCandidate(processCase.linearIssue);
    if (isRecord(processCase.facts)) {
      addCandidate(processCase.facts.repairReference);
      addCandidate(processCase.facts.linearIssue);
    }
  }

  for (const candidate of candidates) {
    const reference = repairReferenceFromCandidate(candidate);
    if (reference) return reference;
  }
  return null;
}

export function stageState(processCase, stage, events = []) {
  const durableEvents = normalizeProcessEvents(processCase, events);
  const caseState = processState(processCase);
  const sourceState = stateFromDurableSources(processCase, stage.id, durableEvents);

  if (caseState === "packet_ready") return "complete";
  if (sourceState === "succeeded") return "complete";
  if (caseState === "cancelled") return "stopped";
  if (sourceState === "running") return "active";
  if (sourceState === "review_required") return "review";
  if (sourceState === "blocked") return "blocked";
  if (sourceState === "failed") return "failed";
  if (sourceState === "cancelled") return "stopped";
  return "pending";
}

function stageStatusLabel(state) {
  return {
    active: "In progress",
    review: "Review required",
    complete: "Complete",
    blocked: "Blocked",
    failed: "Failed",
    stopped: "Stopped",
    pending: "Pending",
  }[state];
}

function evidenceGate(state) {
  return {
    active: "Persisted event in progress",
    review: "Operator review required",
    complete: "Persisted evidence recorded",
    blocked: "Provider or system blocked",
    failed: "Safe failure recorded",
    stopped: "Process stopped",
    pending: "Waiting for durable event",
  }[state];
}

export function verifiedArtifact(processCase) {
  if (!isRecord(processCase) || processState(processCase) !== "packet_ready") {
    return false;
  }
  const artifact = isRecord(processCase.artifact) ? processCase.artifact : null;
  return (
    artifact?.contentType === "application/pdf" &&
    artifact.readbackStatus === "verified" &&
    typeof artifact.sha256 === "string" &&
    /^[a-f0-9]{64}$/i.test(artifact.sha256)
  );
}

export function artifactLinks(processCase) {
  if (!verifiedArtifact(processCase)) return null;
  const caseId = isRecord(processCase) ? stringValue(processCase.id) : "";
  if (!caseId) return null;
  const encodedId = encodeURIComponent(caseId);
  return {
    previewUrl: `/api/doc-prep/cases/${encodedId}/view`,
    downloadUrl: `/api/doc-prep/cases/${encodedId}/download`,
  };
}

export function deriveSequence(processCase, events = []) {
  const durableEvents = normalizeProcessEvents(processCase, events);
  const stages = DOC_PREP_SEQUENCE.map((stage) => {
    const durableStep = stepFor(processCase, stage.id);
    const state = stageState(processCase, stage, durableEvents);
    return {
      id: stage.id,
      title: stage.title,
      detail: stage.detail,
      displayDetail: displayStageCopy(stage.detail),
      state,
      statusLabel: stageStatusLabel(state),
      evidenceGate: evidenceGate(state),
      operatorText: safeOperatorText(durableStep?.detail, state),
      nextAction: safeNextAction(durableStep?.nextAction, state),
      repairReference: repairReference(processCase, durableStep),
    };
  });

  const currentIndex = stages.findIndex((stage) => stage.state !== "complete");
  const currentTask = currentIndex === -1 ? null : stages[currentIndex];
  const completedPredecessors =
    currentIndex === -1
      ? stages.filter((stage) => stage.state === "complete")
      : stages.slice(0, currentIndex).filter((stage) => stage.state === "complete");
  const caseState = processState(processCase);
  const islandState = currentTask
    ? currentTask.state
    : caseState === "packet_ready"
      ? "complete"
      : caseState === "cancelled"
        ? "stopped"
        : "idle";

  return {
    stages,
    caseState: caseState ?? "idle",
    currentTask,
    completedPredecessors,
    island: {
      state: islandState,
      label:
        islandState === "idle"
          ? "Ready"
          : islandState === "active"
            ? "In progress"
            : islandState === "review"
              ? "Review required"
              : islandState === "complete"
                ? "Complete"
                : islandState === "stopped"
                  ? "Stopped"
                  : stageStatusLabel(islandState),
      eventCount: durableEvents.length,
    },
    artifact: {
      verified: verifiedArtifact(processCase),
      links: artifactLinks(processCase),
    },
  };
}

export function actionAvailability(processCase, options = {}) {
  const pendingAction = stringValue(options.pendingAction);
  const sequence = deriveSequence(processCase, options.events);
  const hasCase = isRecord(processCase) && Boolean(stringValue(processCase.id));
  const caseState = sequence.caseState;
  const firstIncompleteStageId = sequence.currentTask?.id ?? null;
  const reviewStage = sequence.stages[0];
  const canRetryState = ["review_required", "blocked", "failed"].includes(caseState);
  const canRetryStage = sequence.stages.some((stage) =>
    ["review", "blocked", "failed"].includes(stage.state),
  );

  return {
    canStart: !hasCase && pendingAction !== "start",
    canRetry:
      hasCase &&
      pendingAction !== "retry" &&
      (canRetryState || canRetryStage),
    canStop:
      hasCase &&
      pendingAction !== "stop" &&
      ["queued", "sourcing", "review_required", "rendering"].includes(caseState),
    requiresIdiReview: reviewStage?.state === "review",
    firstIncompleteStageId,
    canPreview: sequence.artifact.verified,
    canDownload: sequence.artifact.verified,
  };
}

export const CASE_STATE_LABEL = Object.freeze({ ...CASE_STATE_LABELS });
export const STAGE_STATE_LABEL = Object.freeze({ ...STAGE_STATE_LABELS });
