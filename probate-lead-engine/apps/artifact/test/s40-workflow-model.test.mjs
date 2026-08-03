import assert from "node:assert/strict";
import {
  estateWorkflowDocPrepStates,
  estateWorkflowExportQueueStates,
  estateWorkflowStateLabels,
  estateWorkflowStates,
  estateWorkflowTransitionAllowed,
  guardEstateWorkflowTransition,
} from "../src/features/estate-export/workflow-model.js";

const records = new Map([
  ["estate-a", { state: "active", exportEligible: false }],
  ["estate-b", { state: "active", exportEligible: false }],
  ["estate-c", { state: "active", exportEligible: false }],
]);

function move(estateId, nextState, patch = {}) {
  const previous = records.get(estateId);
  assert.ok(previous, `missing test estate: ${estateId}`);
  guardEstateWorkflowTransition(previous.state, nextState);
  const next = { ...previous, ...patch, state: nextState };
  records.set(estateId, next);
  return next;
}

function uniqueIds(ids) {
  return [...new Set(ids.map(String))];
}

function docPrepIds() {
  return [...records.entries()]
    .filter(([, record]) => estateWorkflowDocPrepStates.includes(record.state))
    .map(([estateId]) => estateId);
}

function exportQueueIds() {
  return [...records.entries()]
    .filter(([, record]) => record.exportEligible && estateWorkflowExportQueueStates.includes(record.state))
    .map(([estateId]) => estateId);
}

assert.deepEqual(estateWorkflowStates, [
  "active",
  "queued",
  "processing",
  "completed-awaiting-export",
  "exported",
  "blocked",
]);
assert.deepEqual(Object.values(estateWorkflowStateLabels), [
  "Active in Estates",
  "Queued for Doc Prep",
  "Doc Prep in progress",
  "Ready for export",
  "Exported",
  "Blocked - review needed",
]);
assert.equal(estateWorkflowTransitionAllowed("active", "queued"), true);
assert.equal(estateWorkflowTransitionAllowed("exported", "processing"), false);
assert.equal(estateWorkflowTransitionAllowed("queued", "queued"), true);

const selectedBatch = uniqueIds(["estate-a", "estate-a", "estate-b"]);
assert.deepEqual(selectedBatch, ["estate-a", "estate-b"]);
selectedBatch.forEach((estateId) => move(estateId, "queued"));
assert.deepEqual(docPrepIds(), ["estate-a", "estate-b"]);
assert.deepEqual(exportQueueIds(), []);

move("estate-a", "processing");
move("estate-a", "completed-awaiting-export", { exportEligible: true });
move("estate-b", "processing");
move("estate-b", "blocked", { exportEligible: false });
assert.deepEqual(docPrepIds(), ["estate-a", "estate-b"]);
assert.deepEqual(exportQueueIds(), ["estate-a"]);

move("estate-b", "processing");
move("estate-b", "completed-awaiting-export", { exportEligible: true });
move("estate-a", "exported", { exportEligible: false });
assert.deepEqual(docPrepIds(), ["estate-b"]);
assert.deepEqual(exportQueueIds(), ["estate-b"]);
assert.deepEqual([...records.entries()].filter(([, record]) => record.state === "exported").map(([estateId]) => estateId), ["estate-a"]);

move("estate-b", "blocked", { exportEligible: true });
assert.deepEqual(exportQueueIds(), ["estate-b"], "a failed export handoff remains retryable in the lower queue");
move("estate-b", "exported", { exportEligible: false });
assert.deepEqual(docPrepIds(), []);
assert.deepEqual(exportQueueIds(), []);

assert.throws(
  () => move("estate-a", "processing"),
  /already in a later workflow stage/,
  "an exported estate cannot re-enter processing",
);
assert.throws(
  () => guardEstateWorkflowTransition("queued", "unknown"),
  /state is unavailable/,
);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "all_persisted_lifecycle_states",
    "guarded_forward_transitions",
    "idempotent_same_state_transition",
    "duplicate_safe_batch_selection",
    "queued_estates_leave_active_visibility",
    "completed_reports_enter_export_queue",
    "blocked_batch_item_can_retry",
    "failed_export_remains_retryable",
    "exported_estates_leave_docprep_and_export_queue",
    "exported_estates_cannot_reenter_processing",
  ],
}, null, 2));
