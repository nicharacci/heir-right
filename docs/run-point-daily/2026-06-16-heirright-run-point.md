# HeirRight Run-Point Daily Handoff - 2026-06-16

## Branch

- Local branch: `v2.4.1/heirright-2026-06-16-run-point`
- Pushed remote branch: `origin/v2.4.1/heirright-2026-06-16-run-point`
- Base reviewed: `v2.3.1/heirright-2026-06-14-run-point` at `1b89d68`
- Version namespace: continued the existing `v2.x` automation branch series and rolled this week to `v2.4.1`.

## Opening Review

- Previous daily handoff reviewed: no `docs/run-point-daily/2026-06-15-heirright-run-point.md` existed.
- Previous-day touchups reviewed: found untracked `docs/discovery/heirright-retrospective-discovery-2026-06-15.md`; it defined the S16-S20 implementation sequence and was brought onto today's branch instead of being left orphaned.
- Git state at start: on `v2.3.1/heirright-2026-06-14-run-point`, clean except untracked `docs/discovery/`.
- Remote state: no existing local or remote `2026-06-16` unified branch.
- Linear: live Linear connector calls were attempted for team/project/status/issues, but every call returned `This app connection requires reauthentication before other actions on this app can succeed.` No Linear issue status was changed.

## Sprints Worked

- S16 - Production Seed Intake And Acceptance Batch.
- S17 - Structured Source Extraction Upgrade, limited to the measurable source-coverage/acceptance evidence layer. No unsupported scraping or paid/manual source automation was claimed.

## What Changed

- Added a production seed batch contract and validator:
  - `DAILY_RUN_SEEDS_JSON` and `apps/worker/input/production-seeds.json` now load through validation.
  - `pnpm --filter @ple/worker seeds:validate -- --file=<path>` writes `seed-import-report.json` and `seed-import-report.md`.
  - Batches are blocked unless they include source label, source owner, `approvalMarker: approved_for_production_batch`, supported county, and at least one estate/address/folio/case identifier per seed.
  - Duplicate seeds are removed from the accepted batch and reported.
- Added a checked-in example seed file at `apps/worker/input/production-seeds.example.json`.
- Added seed provenance to daily run config and lead inputs so default review seeds stay visibly `review_only_not_for_acceptance`.
- Added source coverage profiles to dossiers and daily run ledgers:
  - property;
  - tax;
  - deed/title;
  - probate/court;
  - family tree / offer inputs.
- Added a 30-day acceptance gate for structured source coverage.
- Updated the artifact shell blocker language so missing source coverage reads as real estate workflow work, not technical status.

## Files Changed

- `docs/discovery/heirright-retrospective-discovery-2026-06-15.md`
- `probate-lead-engine/packages/types/src/index.ts`
- `probate-lead-engine/apps/worker/package.json`
- `probate-lead-engine/apps/worker/input/production-seeds.example.json`
- `probate-lead-engine/apps/worker/src/daily/run-daily.ts`
- `probate-lead-engine/apps/worker/src/daily/seed-batch.ts`
- `probate-lead-engine/apps/worker/src/seed-validation-cli.ts`
- `probate-lead-engine/apps/worker/src/qa/source-coverage.ts`
- `probate-lead-engine/apps/worker/src/qa/source-evidence.ts`
- `probate-lead-engine/apps/worker/src/dossier/build-raw-dossier.ts`
- `probate-lead-engine/apps/worker/src/queue/operator-queue.ts`
- `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts`
- `probate-lead-engine/apps/worker/src/validation/run-validation.ts`
- `probate-lead-engine/apps/artifact/src/index.html`

## Validation

Commands run from `probate-lead-engine/`:

```bash
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/worker seeds:validate -- --file=input/production-seeds.example.json
DAILY_RUN_SEEDS_FILE=input/production-seeds.example.json pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
pnpm --filter @ple/artifact build
pnpm --filter @ple/worker milestone:30-day
```

Results:

- `pnpm build`: passed.
- `@ple/worker test`: passed; validation now includes S16 seed validation and S17 source coverage checks.
- `seeds:validate` with the example batch: passed with 2 accepted, 0 rejected, 0 duplicates.
- Configured daily run: passed with `seedSource: configured_batch`, `counties: ["miami-dade"]`, 2 raw leads, 0 qualified leads, 2 review leads, 0 errors.
- Configured daily run source coverage: 3 extracted fields, 47 missing fields, 9 blocked source areas.
- Required dry run: passed for `20611 NW 33rd Pl, Miami Gardens, FL 33056`.
- `@ple/artifact build`: passed.
- `milestone:30-day`: passed as a command but correctly reported `overallStatus: blocked`, 2 raw leads, 0 qualified leads, and 6 blocked acceptance gates.

## /solvys-heir-audit

Source checked: `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`, `HeirRight_Workflow_Templates_11.15.25.pdf`, `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`, repo PRD/roadmap, retrospective discovery doc, worker outputs.
Backward: Previous state had honest default review seeds and qualification blockers, but no production seed file contract and no structured source-coverage gate. Today's changes support production seed intake, source provenance, county fact coverage, and 30-day evidence truth.
UX pass: aligned. Changed operator shell copy says source records, property, tax, deed, probate, and heir facts instead of developer status.
Forward: S18 qualification promotion loop should use source coverage and reason codes to generate a `qualification-review.md` packet; S19 remains blocked until Google/Podio credentials and live-write approval exist.
Alignment: aligned with gaps.
Required corrections before complete:
- Reauthenticate Linear before live ticket updates.
- Provide a real approved production county seed batch; the checked-in file is only a safe example.
- Upgrade extraction adapters so tax, deed/title, probate/court, and family-tree areas contain real source facts rather than review placeholders.
- Provide Google Workspace config, Podio config, controlled test values, and explicit live-write approval before live readback claims.

## Agent-Facing Notes

- Future agents should use `pnpm --filter @ple/worker seeds:validate -- --file=input/production-seeds.json` before any production daily run.
- A daily run only counts as `configured_batch` when `DAILY_RUN_SEEDS_JSON` or `apps/worker/input/production-seeds.json` passes validation.
- Default review seeds are still useful for smoke tests, but they cannot satisfy the 30-day production seed gate.
- Source coverage intentionally does not count source-health checks or intake placeholders as extracted source evidence.
- The source-coverage gate must stay blocked until property, tax, deed/title, probate, and family-tree/offer facts are captured from source records.
- Keep live outreach, live CRM writes, paid/manual sources, and legal/compliance claims blocked without explicit approval.

## Remaining Blockers

- Linear connector needs reauthentication before live ticket reads/updates.
- Canonical workflow PDF `HeirRight Workflow. pdf.pdf` is still missing; fallback workflow template and Amaranthe example packet were used for audit.
- No real approved production county seed batch is present at `apps/worker/input/production-seeds.json`.
- Current runs still produce 0 qualified leads because tax, deed/title, probate, and heir/family facts remain missing.
- Google live readback needs Workspace token and target Sheet/Drive/Docs config.
- Podio live readback needs bearer token, app ID/field map or Texas Equity preset, controlled test phone/email/profile values, and `PODIO_LIVE_WRITE_APPROVED=true`.
- No live outreach, production Podio write, paid/manual source, or compliance claim was attempted.

## Decisions Needed From Sam

- Provide or approve the first real Miami-Dade production seed file for `apps/worker/input/production-seeds.json`.
- Reauthenticate Linear for the HeirRight workspace if live issue updates are required from automation.
- Decide when to supply Google/Podio credentials and whether one controlled test write/readback is approved.
- Confirm whether S18 should prioritize stricter qualification packets or whether S17 source extraction should continue first with a real production batch.

## Tomorrow's Recommended Sprints

- First choice: S18 Qualification Promotion Loop, using `sourceCoverageSummary` and lead blockers to generate a `qualification-review.md` packet.
- Second choice: continue S17 extraction adapters against the real approved seed batch if Sam supplies it.
- S19 Controlled Google/Podio Readback should only start when credentials, controlled test values, and explicit live-write approval are available.

## 11 AM Review Packet

What was done:

- S16 production seed intake was implemented with validation, provenance, duplicate handling, and a seed import report.
- S17 source coverage evidence was added to dossiers, daily ledgers, milestone gates, and operator blocker copy.
- The June 15 retrospective discovery doc was preserved on today's branch.

What was not done:

- No live Linear update because the connector requires reauthentication.
- No real production batch was loaded; only the safe example contract was validated.
- No new county scraping or paid/manual source automation was added.
- No live Google or Podio readback was attempted.

Needs Sam review:

- Approve/provide the real Miami-Dade seed batch.
- Decide whether to unblock Linear reauth and Google/Podio credential work now.
- Confirm that the source coverage gate is the right acceptance language for Joshua's 30-day review.

Tomorrow's agent should improve:

- Build S18 `qualification-review.md` around source coverage and reason codes.
- If a real batch exists, run `seeds:validate`, `run:daily`, and compare coverage against the 30-40% source-fact target.
- Keep the 30-day packet blocked unless source coverage, qualified volume, and live readback evidence actually clear.

## Planning Normalization Addendum

Completed after reviewing the missing/archived June 15 planning state:

- Added durable sprint briefs for S16-S20 under `sprint-md/`, including orchestration files and child tracks.
- Backfilled the local Linear load sheet so S12-S20 now appear in `linear/HEIRRIGHT_LINEAR_TICKETS.md`.
- Preserved the June 15 retrospective discovery doc as the planning source for S16-S20.
- Live Linear sync is still blocked by reauthentication, so the repo-local Linear load sheet is the sync-ready source until the connector is restored.

S16-S20 planning status:

- S16: planned and partly implemented for the seed contract/example path; real production seed batch still needs Sam/Joshua approval.
- S17: planned and partly implemented for source-coverage gating; extraction adapters still need real property/tax/deed/probate facts.
- S18: planned and next recommended implementation, centered on `qualification-review.md`.
- S19: planned but externally blocked until Google/Podio credentials, controlled test values, and live-write approval exist.
- S20: planned but blocked until S16-S19 evidence exists.
