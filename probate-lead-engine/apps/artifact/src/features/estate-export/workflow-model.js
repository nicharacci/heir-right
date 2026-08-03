const estateWorkflowStates = Object.freeze([
  "active",
  "queued",
  "processing",
  "completed-awaiting-export",
  "exported",
  "blocked",
]);

const estateWorkflowTransitions = Object.freeze({
  active: Object.freeze(["queued", "blocked"]),
  queued: Object.freeze(["active", "processing", "blocked"]),
  processing: Object.freeze(["queued", "completed-awaiting-export", "blocked"]),
  "completed-awaiting-export": Object.freeze(["exported", "blocked", "processing"]),
  exported: Object.freeze([]),
  blocked: Object.freeze(["queued", "processing", "completed-awaiting-export", "exported"]),
});

const estateWorkflowStateLabels = Object.freeze({
  active: "Active in Estates",
  queued: "Queued for Doc Prep",
  processing: "Doc Prep in progress",
  "completed-awaiting-export": "Ready for export",
  exported: "Exported",
  blocked: "Blocked - review needed",
});

const estateWorkflowDocPrepStates = Object.freeze([
  "queued",
  "processing",
  "completed-awaiting-export",
  "blocked",
]);

const estateWorkflowExportQueueStates = Object.freeze([
  "completed-awaiting-export",
  "blocked",
]);

function estateWorkflowTransitionAllowed(previousState, nextState) {
  if (!estateWorkflowStates.includes(String(nextState))) return false;
  if (String(previousState) === String(nextState)) return true;
  return estateWorkflowTransitions[String(previousState)]?.includes(String(nextState)) === true;
}

function guardEstateWorkflowTransition(previousState, nextState) {
  if (!estateWorkflowStates.includes(String(nextState))) {
    throw new Error("Estate workflow state is unavailable.");
  }
  if (!estateWorkflowTransitionAllowed(previousState, nextState)) {
    throw new Error("That estate is already in a later workflow stage. Refresh the workspace before retrying.");
  }
  return true;
}

export {
  estateWorkflowDocPrepStates,
  estateWorkflowExportQueueStates,
  estateWorkflowStateLabels,
  estateWorkflowStates,
  estateWorkflowTransitionAllowed,
  estateWorkflowTransitions,
  guardEstateWorkflowTransition,
};
