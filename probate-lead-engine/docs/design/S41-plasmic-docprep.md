# S41 T5 Doc Prep BeUI surface handoff

Date: 2026-08-05
Revision: S41-r2
Owner: T5 Doc Prep surface
Next owner: T6 reconciliation with TP's final design

## Scope and source of truth

This track adds an isolated, unmounted React surface and pure sequence model. It does not mount, redesign, recolor, or change the current rendered Doc Prep UI. TP retains Plasmic ownership. No Plasmic file was mutated, and no source-transfer receipt is claimed. T6 reconciles this seam with TP's final design.

The durable T1 process case and its persisted events are the only source of sequence state. The model never advances from browser time, timers, local progress, or a client-side percentage. The first stage reads a selected persisted IDI report. Live IDI Core API access remains client-pending and is not implied by this surface.

## Preserved anchors

- The Dynamic Island retains one current task, completed predecessors, and truthful queued, active, review-required, blocked, failed, stopped, and complete states.
- The preview pane remains empty until a PDF artifact has `packet_ready` state, PDF content type, verified readback, and a valid SHA-256. Only the existing `/api/doc-prep/cases/:id/view` and `/download` routes are derived after verification.
- The existing table and domain behavior remain untouched. The new table is a six-row, unmounted BeUI shell driven by the same durable stage identifiers.
- The surface uses neutral black/gray values with a solid deep-blue pearl action accent. Content remains visible. No gradients, purple tones, glowy pills, icon tiles, card grids, hover lifts, fake data, or custom SVGs are introduced.

## Canonical stage matrix

| ID | Stage | Detail | Durable states represented |
| --- | --- | --- | --- |
| `skip_trace_parse` | Parsing Skip Trace Report | Filling out Potential Heirs, Contact information… | pending, running, succeeded, review_required, blocked, failed, cancelled |
| `obituary_search` | Searching Obituary | Gathering vital obituary, marriage & related records… | pending, running, succeeded, review_required, blocked, failed, cancelled |
| `deed_title_search` | Searching for Deeds or Titles | Checking official records…. | pending, running, succeeded, review_required, blocked, failed, cancelled |
| `tax_receipt_fetch` | Fetching Tax Receipt | Pulling from public Tax Collector’s Office records…. | pending, running, succeeded, review_required, blocked, failed, cancelled |
| `court_records_search` | Searching Court Records | Probate, Civil, Family Courts….. | pending, running, succeeded, review_required, blocked, failed, cancelled |
| `backstory_generate` | Generating Back Story | Using Solvys systems…. | pending, running, succeeded, review_required, blocked, failed, cancelled |

The source model retains the T1 `&amp;` entity in the canonical detail string and decodes it only for visible React text.

## BeUI mapping

Public BeUI source is installed under `apps/artifact/src/beui-foundation` and its provenance is recorded in `docs/ui-library-foundation/S41-beui-installation.md`. The isolated surface maps public primitives as follows:

| Screen seam | BeUI source | Role |
| --- | --- | --- |
| Run, retry, stop, and Google Drive actions | `motion/button/base` | Real buttons with durable disabled states |
| Missing persisted IDI report review | `motion/file-upload` | One PDF/DOCX selection, no live IDI call implied |
| Dynamic Island status | `motion/animated-badge` | State badge with pulse disabled |
| Event provenance note | `motion/popover`, `motion/tooltip` | Safe explanation and retry affordance context |
| Ordered six-stage shell | `motion/table` | Non-selectable, non-resizable, non-reorderable table |
| Verified artifact pane | Existing Doc Prep view/download route plus native iframe/links | Rendered only after verified readback |

All actions are callback seams for T6 integration. An enabled control is only possible when its callback and the corresponding durable state permit the action. Review upload errors stay inline. Provider/system failures use safe operator text. Tokens, raw provider payloads, stack traces, private contact data, and unsanitized event details are excluded from the island.

## Exact no-fit gap

T2's system-failure adapter receives a sanitized Linear issue reference from the logger, but the current T1 `ProcessEvent` and public `ProcessCase` contract do not persist that reference. The adapter currently drops the returned issue after logging. T5 therefore renders generic safe failure text and exposes a repair link only for an explicit future-safe `repairReference` or Linear issue shape already present on the durable case/step. It does not infer or manufacture a Linear URL, and it does not add another library. T6 or the T1/T2 owner must close this contract gap before a truthful repair link can be guaranteed.

## State and delivery behavior

Run queues one durable case and is disabled when a case already exists. Retry targets the first incomplete durable stage. Stop/Cancel is available only for queued, sourcing, review-required, and rendering cases and must be wired to the durable action. Missing IDI input produces a review action. Preview/download and Google Drive export remain unavailable until verified PDF readback; success and failure delivery messages are explicit and safe. Reduced-motion CSS disables transition and animation durations within the isolated root.

## Protected zones and access basis

No existing entry, index, shell, current Doc Prep feature, API, provider, manifest, lockfile, build script, deployment file, T4 file, test, `test-results/`, or current rendered UI was modified. No private BeUI Pro registry was accessed because `BEUI_PRO_TOKEN` was absent. Secret manifest is name-only: `BEUI_PRO_TOKEN`. No token value, credential, auth material, or client secret is stored, logged, committed, or embedded.
