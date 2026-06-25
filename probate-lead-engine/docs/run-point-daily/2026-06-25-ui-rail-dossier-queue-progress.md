# 2026-06-25 UI Rail, Dossier, Queue Progress

## Completed

- Replaced visible placeholder ZIP suffixes ending in `-0000` with clean five-digit ZIP display across the artifact UI.
- Changed dashboard To-Do milestones to use current lead/run, source-gap, review-task, and queue counts instead of generic placeholder copy.
- Removed outside-click auto-close from the right rail. Report and Dossier rails now stay open after over-dragging and close only through explicit rail controls or product navigation.
- Added resize clamping, per-mode min/max ARIA values, pointer capture, and higher rail layering so the rail remains readable and interactive while dragged.
- Reworked Dossier Rail tabs into `Flow`, `Quality & Score`, and `Docs`.
- Replaced the Dossier Rail document grid-first view with a document-prep flow where the 10 prepared documents are the workflow steps.
- Moved qualification scoring into the Dossier Rail `Quality & Score` tab.
- Converted next-step table actions into concise one-line liquid-glass chips with full text preserved in `title`.
- Replaced the Queue destination narrative card with a two-row iOS rounded connection card for `Podio` and `Google Workspace`.
- Changed Queue readiness to `Needs Review (Queued Items)` and limited readiness rows to queued leads only.

## Local Proof

- `pnpm --filter @ple/artifact build`
- `git diff --check`
- Browser proof at `http://localhost:4173`:
  - Report rail and Dossier rail remain open after left/right over-drag attempts.
  - Dossier Rail Flow includes document-prep steps, `Quality & Score` includes source scoring, and `Docs` includes the embedded reader.
  - Queue shows exactly two connection rows and no old destination-task copy.
  - Dashboard shows live lead/run counts and recent leads without visible `-0000` ZIP suffixes.

## Evidence

- `docs/run-point-daily/screenshots/2026-06-25-rail-dossier-queue-local.png`
- `docs/run-point-daily/screenshots/2026-06-25-dashboard-real-data-cleanup-local.png`
- `docs/run-point-daily/screenshots/2026-06-25-dossier-rail-flow-local.png`
- `docs/run-point-daily/screenshots/2026-06-25-dossier-rail-quality-local.png`
- `docs/run-point-daily/screenshots/2026-06-25-queue-connections-local.png`
