# Sprint Brief: S21 -- Discovery Dossiers Product Loop (single-agent)

## Intent

HeirRight operators get a working product loop for document preparation: Dashboard, Find Estates, Dossiers, Drips, Queue, Admin, and Settings. The Find Estates rail opens a guided, chat-less Discovery workflow with preference controls and notes, then finished dossier work is visible in a new Dossiers tab with the same lead list, document selection, embedded PDF preview, and pop-out controls.

## Branch Target

`v2.5.4/heirright-discovery-dossiers-2026-06-24`

## Scope -- Included

- [x] Replace old shell navigation with Dashboard, Find Estates, Dossiers, Drips, Queue, Admin, Settings.
- [x] Make Dashboard a task tracker with Activities, scheduled drips, recent activity, milestones, and productivity chips.
- [x] Reduce Find Estates header height and remove excess lower whitespace from Find Estates and Dossiers.
- [x] Convert the rail gap-chip strip into a three-chip-width completion fuse with percentage and phase label, plus a right-aligned Begin Discovery CTA.
- [x] Add a full-rail Discovery wizard takeover with uniform fades, modular controls, preference toggles, note fields, close-on-phase-complete behavior, and the workflow packet phases.
- [x] Add a Dossiers tab that mirrors the main lead list, opens the selected lead documents in the rail area, embeds a document/PDF-style reader below, and supports pop-out.
- [x] Add a ten-document dossier packet so the client-requested 7-10 document workflow is represented in the app.
- [x] Add Drips and Queue tabs for configurable email/SMS preparation and batch export queue state without claiming live sends.
- [x] Represent the autonomous agent wrapper as direct OpenCodeGo/API artifact scaffolding for now, with no unapproved live outreach, paid-source usage, or production Podio write.
- [x] Add progress evidence under `docs/run-point-daily/2026-06-24-heirright-run-point.md`.

## Scope -- Excluded (OUT OF BOUNDS)

- No live outreach, calls, SMS, emails, or legal/probate claims.
- No paid-source automation for IDI, Intelius, Ancestry, ForeWarn, VitalChek, PI work, or door-knock research without explicit approval.
- No production Podio write/readback claim without credentials, controlled write approval, and verified readback.
- No new database, background worker platform, Hermes deployment, or cloud cron implementation in this pass.

## Known Issues to Preserve

- Existing dirty work in the canonical repo already added artifact server/build handling for dist output and fresh lead batches. Preserve and build on it.
- Podio and Google handoff remain prep-only or controlled-test gated unless live credentials and readback proof are present.
- The canonical checkout is `/Users/tifos/Documents/Codebases/heir-right`; `/Users/tifos/Desktop/HRight` supplies the attached workflow PDF reference.
- The `solvys-brief/reference/engineering-guidelines.md` file is absent in this skill install, so planning uses the loaded brief rules, `Design.md`, `/solvys-feels`, and `/solvys-heir-audit`.

## Design Pass

### Layout / Interaction

The sidebar becomes the product loop. Dashboard opens first and shows a compact operator tracker: top-left milestones, top Activities switcher, scheduled drips, recent lead activity, and productivity chips. Find Estates keeps the existing lead table but with a shorter header and tighter bottom spacing. The report rail becomes a Discovery launcher: a completion fuse spans about three old chips, the percentage sits where the CRM handoff chip was, and the current phase appears in muted title case.

Begin Discovery fades a full-rail wizard over the current rail. The wizard is chat-less: each step has structured choices, preference controls, and optional notes. Phase completion exposes a close action so the operator can leave once that phase is done. Dossiers mirrors the Find Estates list, but the report rail is not available there; selecting a lead opens a dossier document workspace with a document list and embedded reader, plus a pop-out command.

### API / Service Shape

No new backend route is required for this pass. Existing artifact routes remain the data source: `/latest-run.json`, `/fresh-lead-batch.json`, `/daily-run.json`, `/qualification-review.json`, `/api/connections/status`, `/api/leads/fresh-batch`, and `/api/exports`.

For the agent wrapper, the UI renders a direct-API OpenCodeGo readiness panel and scheduled drip controls. It is a cloud-artifact placeholder until Hermes or a comparable runtime is approved and configured.

### Data / Agent Shape

Discovery phases come from the workflow packet and HeirRight deal-flow checklist:

- Property and owner stop rules.
- Deed, OR book/page, sale activity, and mailing address.
- Tax history, unpaid years, receipts, payer, and reassessment.
- Civil, family, probate, affidavit, and marriage records.
- Heirs, contacts, obituary, family tree, and deceased indicators.
- Approval-gated paid/manual research.
- Probate document ordering and CRM handoff preparation.

Finished dossiers are derived from the loaded lead run/dossier and rendered as ten document cards: Discovery Dossier, Lead Report, Source Notes, Deed & Title Notes, Tax History Packet, Probate Request, Heir Contact Matrix, Outreach Drafts, Drip Schedule, and CRM Handoff.

### Aesthetic Rules

- `Design.md` was read immediately before planning and the plan was re-checked against it before implementation.
- Preserve dense operator-workbench structure with warm near-black/dark mode compatibility, restrained accent, flat rows, compact panels, and fade transitions.
- No duplicate labels, implementation narration, raw source strings without user-facing capitalization, invented decorative icons, emojis, AI sparkles, generic box-shadows, decorative button borders/backplates, pointed square borders, or untransitioned new surfaces.
- Keep client-facing copy in plain real estate workflow language.

## Development Flow

1. Data/constants first: add Discovery phase, dossier document, drips, queue, and dashboard models in the artifact script.
2. State and view routing: generalize `setActiveShellView` beyond the old admin/source-runs split.
3. Frontend UI: update sidebar, workbench shell, dashboard/dossier/drips/queue/admin/settings views, rail fuse, discovery overlay, and embedded reader.
4. Interaction wiring: Discovery begin/next/complete/close, dossier row/doc selection/popout, dashboard activity chips, drips and queue buttons.
5. Validation: `pnpm --filter @ple/artifact build`, `pnpm build`, local server smoke with browser/API checks, and a final UI review pass.
6. Handoff: update daily run-point doc, run `/solvys-heir-audit`, commit, push, and deploy if Vercel auth allows.

## Acceptance Criteria

- [x] Sidebar shows exactly Dashboard, Find Estates, Dossiers, Drips, Queue, Admin, Settings in that order.
- [x] Dashboard is the default task-tracker surface and uses operator workflow language.
- [x] Find Estates header and bottom space are visibly tighter.
- [x] Report rail gap chips are replaced by fuse, percent, phase label, and Begin Discovery CTA.
- [x] Discovery wizard fades in, occupies the full rail, supports preferences and notes, and can be closed after a phase completes.
- [x] Dossiers mirrors the lead list, has no report rail, opens lead documents in the dossier workspace, embeds a reader below, and supports pop-out.
- [x] Dossiers renders 10 packet documents, satisfying the requested 7-10 document preparation workflow range.
- [x] Drips and Queue are useful prep surfaces without implying unapproved live sends or CRM writes.
- [x] `pnpm --filter @ple/artifact build` passes.
- [x] `pnpm build` passes.
- [x] UI is browser-verified on the rendered artifact and reviewed for overlap/text fit.
- [x] Daily handoff/progress file is updated.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/artifact build
pnpm build
```

## Commit Format

```text
[v2.5.4] feat: S21 discovery dossiers product loop
```
