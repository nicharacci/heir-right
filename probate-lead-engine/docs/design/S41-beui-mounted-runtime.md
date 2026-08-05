# S41 BeUI rail runtime map

## Boundary and ownership

This checkpoint mounts narrow BeUI rails inside the existing S40 Doc Prep workbench. Public BeUI is the accepted installed foundation already present under `apps/artifact/src/beui-foundation`; BeUI Pro is unavailable and no new dependency or registry access is introduced here. The legacy shell and S40 presentation remain the visible owner.

Protected zones remain unchanged: `main`, the S40 surface worktree, `/Volumes/Ext./Codebases/heir-right`, `test-results/`, provider/API/worker/deploy configuration except for the required worker build proof, package manifests, lockfiles, and the TP design session.

## Mount lifecycle

`apps/artifact/src/features/beui-runtime/register.js` is registered through the existing feature lifecycle. On `bridgeReady` or `afterRender` it:

1. finds the Doc Prep queue and active-batch rail slots inside the S40 renderer;
2. creates or reuses one React root per live slot;
3. reads and dispatches only through the authorized legacy bridge; and
4. unmounts removed slots on rerender, bridge loss, or feature unmount.

The runtime does not replace a route owner, shell, or preview surface. `#dossiersView` remains owned by the S40 Doc Prep renderer. The prior full-page BeUI chassis and `docprep-beui-surface` have been removed.

## Route and component map

| S40 slot | BeUI surface | Source of truth |
| --- | --- | --- |
| `data-s40-beui-queue` | selectable queue table | sanitized `docPrepEstates` snapshot and `select-estate` command |
| `data-s40-beui-batch-progress` | per-estate batch-progress table | persisted `workflowState` and `workflowStages`; `s40-stop-docprep` remains guarded by the legacy action |

The S40 renderer controls whether the artifact rail or the batch-progress rail appears. A running selected estate replaces only the right artifact rail, so the left queue remains present and the normal artifact preview returns when the batch is no longer active.

## Doc Prep data and action seams

The S40 artifact rail consumes the hydrated case, ordered events, evidence, and artifact fields from `cloud-process.js`. The BeUI batch rail reads the persisted workflow rows. Timers and local progress are not sources of truth. The six persisted stage labels and descriptions remain serial in `sequence-model.js`; the removed full-page presentation no longer renders a second Doc Prep route.

The selected public estate exposes `sourceFileReferences` only when `idiImportForRow(row).attachment.artifactId` is a verified, durable IDI import artifact. `processSnapshot()` carries that sanitized artifact ID into `POST /api/doc-prep/cases`; a missing verified PDF fails closed and cannot dispatch `beui-docprep-start`. IDI intake remains PDF-only and uses the existing durable import/readback path.

| Action | Bridge command | Durable guard |
| --- | --- | --- |
| Queue selection | `select-estate` | current estate remains a real persisted row |
| Run Doc Prep | `s40-run-docprep` | verified IDI artifact required; duplicate starts rejected |
| Stop active batch | `s40-stop-docprep` | only persisted `processing` rows are sent |
| IDI review upload | `s40-upload-idi-report` | PDF-only; existing verified import/readback |
| Preview/download/export | existing S40 packet and handoff actions | verified artifact and content type/readback |

The estate selection command and queue command receive the same local selected ID array. Optional controls are disabled or wired to a real bridge action; no visible dead callback is used. The Help flow navigates first, waits for the real `[data-beui-control]` target, then scrolls, focuses, and applies a quiet outline without clicking or dispatching a side effect. Reduced-motion rules are preserved.

## Proof receipt

Focused proof covers narrow root lifecycle, state subscription/unsubscription, real selection and stop dispatch, the retained preview/Dynamic Island/table anchors, PDF-only intake, and the P0 verified-artifact guard.

The full artifact suite, artifact lint, production build, worker build, T4/T5 contracts, relevant T1/T2 contracts, estate import, and `git diff --check` are run from this checkpoint. No development server or preview is started. Generated `dist/` output remains repository-native and ignored.
