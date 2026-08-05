# S41 T6R BeUI mounted runtime map

## Boundary and ownership

This checkpoint mounts the functional BeUI runtime in the artifact app. Public BeUI is the accepted installed foundation already present under `apps/artifact/src/beui-foundation`; BeUI Pro is unavailable and no new dependency or registry access is introduced here. TP owns the later Builder/frontend finish. This file records the runtime seams only.

Protected zones remain unchanged: `main`, the S40 surface worktree, `/Volumes/Ext./Codebases/heir-right`, `test-results/`, provider/API/worker/deploy configuration except for the required worker build proof, package manifests, lockfiles, and the TP design session.

## Mount lifecycle

`apps/artifact/src/features/beui-runtime/register.js` is registered through the existing feature lifecycle. On `bridgeReady` it:

1. creates one `div[data-beui-runtime-root]` under `#workspace`;
2. hides the legacy presentation children while retaining the authorized boot and migration bridge;
3. creates or reuses exactly one React root for that element; and
4. restores the legacy presentation and unmounts the root on bridge loss or feature unmount.

The runtime does not register duplicate view owners. Existing T4 route owners continue to own `find-estates`, `queue`, and `export`; the mounted chassis presents those routes once. The T6 runtime adds the `dossiers` slice for the T5 Doc Prep surface. There is one visible shell, with the rounded outer shell rule scoped to the mounted runtime.

## Route and component map

| Route | Mounted surface | Source of truth |
| --- | --- | --- |
| `dashboard` (`home`, `manage`) | BeUI dashboard | sanitized legacy snapshot |
| `find-estates` (`estates`, `estate-search`) | existing estate search owner | snapshot plus real selection commands |
| `dossiers` (`dossier`, `doc-prep`, `docprep`) | T5 `DocPrepSequence` | hydrated T1 `ProcessCase` and persisted events |
| `export` | existing export owner | snapshot and real queue/download commands |
| `drips` (`outreach`, `scheduled-drips`) | outreach surface | sanitized campaign/template snapshot and real dispatch |
| `queue` | existing queue owner | local selected IDs plus durable queue command |
| `admin` | admin surface | bridge-backed admin action |
| `settings` | settings surface | durable preferences and access domains |
| `help-demos` (`help`, `demos`) | help surface | route navigation and asynchronous target lookup |

`normalizeBeuiRoute` preserves old aliases and saved state. `BeuiChassis` is mounted once by `MountedBeuiApp`; the app does not mount a second shell or re-register a legacy feature view.

Settings Integrations includes the real `Nous Portal` status from the public snapshot. Its selector offers the automatic free catalog and only the catalog-verified free model IDs. Opening Integrations and refreshing a connection load the existing model-status endpoint; changing the selection uses the existing preference key through a bridge command that rejects every unverified model. Generic connection actions are labeled `Refresh status`.

## Doc Prep data and action seams

The Dynamic Island and preview pane consume only the hydrated T1 case, ordered events, evidence, and artifact fields from `cloud-process.js`. Timers and local progress are not sources of truth. The six persisted stage labels and descriptions remain serial and are rendered from process state.

The selected public estate exposes `sourceFileReferences` only when `idiImportForRow(row).attachment.artifactId` is a verified, durable IDI import artifact. `processSnapshot()` carries that sanitized artifact ID into `POST /api/doc-prep/cases`; a missing verified PDF fails closed and cannot dispatch `beui-docprep-start`. IDI intake remains PDF-only and uses the existing durable import/readback path.

| Action | Bridge command | Durable guard |
| --- | --- | --- |
| Start | `beui-docprep-start` | verified IDI artifact required; duplicate starts rejected |
| Retry | `beui-docprep-action` / `retry` | resumes the first incomplete persisted stage |
| Stop | `beui-docprep-action` / `cancel` | updates the durable process state |
| IDI review upload | `beui-docprep-upload-idi` | PDF-only; existing verified import/readback |
| Preview/download | `beui-docprep-export` or existing packet route | verified artifact and content type/readback |
| Google Drive export | `beui-docprep-export` | server-approved completed PDF and Drive readback |
| Estate file import | `beui-import-estate-file` | `/api/agentic/estate-import`, verified free model, missing-field review, durable insertion |

The estate selection command and queue command receive the same local selected ID array. Optional controls are disabled or wired to a real bridge action; no visible dead callback is used. The Help flow navigates first, waits for the real `[data-beui-control]` target, then scrolls, focuses, and applies a quiet outline without clicking or dispatching a side effect. Reduced-motion rules are preserved.

## Proof receipt

Focused proof covers the mounted root lifecycle, state subscription/unsubscription, route aliases, real navigation and dispatch, one chassis, the preview/Dynamic Island/table anchors, shared selection IDs, PDF-only intake, Help timing, and the P0 verified-artifact guard.

The full artifact suite, artifact lint, production build, worker build, T4/T5 contracts, relevant T1/T2 contracts, estate import, and `git diff --check` are run from this checkpoint. No development server or preview is started. Generated `dist/` output remains repository-native and ignored.
