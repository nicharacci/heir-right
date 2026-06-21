# HeirRight Run Point Handoff - 2026-06-21

## Branch

- Local branch: `v2.5.1/heirright-2026-06-21-run-point`
- Remote branch: `origin/v2.5.1/heirright-2026-06-21-run-point`
- Base context: started from `v2.4.4/heirright-2026-06-20-run-point` at `8794d2f`, because `main` remains stale at `17c119f` and the June 20 branch contains the latest repo-verified S17/S20 work.
- Version note: `probate-lead-engine/package.json` still says `1.0.0`, but active run-point history is `v2.4.x`; this run is the first new-week HEI automation branch and rolled the minor namespace to `v2.5.1`.

## Previous-Day Touchups Reviewed

- Reviewed `docs/run-point-daily/2026-06-20-heirright-run-point.md` and `/Users/tifos/.codex/automations/HEI-001-run-point/memory.md`.
- Verified the prior claim that S20 remained blocked: latest repo evidence still has default review seeds, 2 raw review leads, 0 qualified leads, and missing Google/Podio live readback.
- Checked live Linear and confirmed it remains blocked by reauthentication: `oauth_token_invalid_grant`.
- Confirmed no Google/Podio `.env` config exists locally, so S19 live readback remains externally blocked and was not attempted as a write.

## Sprints Worked

- S17 - Structured Source Extraction Upgrade: preserved captured source fields on source coverage blockers so the packet can show captured versus missing source work by deal-flow area.
- S20 - 30-Day Acceptance Run: updated milestone evidence and the 30-day review agenda to show which source fields are already captured and which records must still be pulled or confirmed.
- S19 - Controlled Google + Podio Readback: revalidated dry-prep and the guarded Podio live-test blocker only. No live Google or Podio write was attempted.

## Tickets Touched

- `S17-T1` property + tax extraction path - source coverage blockers now include current status and captured fields; property identity is visible as partial with property address and owner captured.
- `S17-T2` official records + deed extraction path - deed/title remains blocked with missing OR book/page, latest deed, last sale, mortgage, lien, Lis Pendens, foreclosure, and adverse-possession signals visible.
- `S17-T3` probate + court extraction path - probate/court remains blocked with missing case status, affidavit of heirs, document availability, official-record cross-link, and case number visible.
- `S20-T2` acceptance packet - Source Coverage Blockers now include captured and missing field lines.
- `S20-T3` client review script - Records To Pull Next now says what is already captured versus what Sam/Joshua still need to pull or confirm.

## Repo Evidence

- Added `status` and `capturedFields` to `SourceCoverageBlocker` in `probate-lead-engine/packages/types/src/index.ts`.
- Aggregated captured source fields for blocker areas in `probate-lead-engine/apps/worker/src/daily/run-daily.ts`.
- Rendered captured versus missing source fields in `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts`.
- Added validation coverage in `probate-lead-engine/apps/worker/src/validation/run-validation.ts`.
- Updated the repo-local Linear fallback sheet in `linear/HEIRRIGHT_LINEAR_TICKETS.md`.

Generated current packet evidence:

- `probate-lead-engine/apps/worker/output/thirty-day-milestone-evidence.md` contains `Captured: property address, property owner`.
- `probate-lead-engine/apps/worker/output/thirty-day-review-script.md` contains `Records To Pull Next` lines such as `Property identity: across 2 lead(s), already captured property address, property owner; still pull or confirm folio, mailing address, property address.`
- Latest 30-day packet status remains `blocked`: 2 raw leads, 0 qualified leads, 6 blocked gates.

## Validation Results

All commands ran from `/Users/tifos/Documents/Codebases/heir-right/probate-lead-engine`.

| Command | Result |
| --- | --- |
| `pnpm build` | Passed |
| `pnpm lint` | Passed |
| `pnpm --filter @ple/worker test` | Passed |
| `pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"` | Passed; status `ready_for_review`, workflow `review_required` |
| `pnpm --filter @ple/artifact build` | Passed |
| `pnpm --filter @ple/worker run:daily` | Passed; 2 raw, 0 qualified, 2 review, 8 source area instances blocked |
| `pnpm --filter @ple/worker export:dry` | Passed; Google and Podio prepared only, live readback blocked |
| `pnpm --filter @ple/worker milestone:30-day` | Passed; `overallStatus: blocked`, 6 blocked gates |
| `pnpm --filter @ple/worker seeds:validate -- --file=input/production-seeds.example.json` | Passed; 2 accepted sample seeds |
| `pnpm --filter @ple/worker export:podio-live-test` | Blocked before write as expected; missing `PODIO_ACCESS_TOKEN`, `PODIO_APP_ID`, and field map or `PODIO_APP_ID=24265877` |
| `AUTH_REQUIRED=false pnpm --filter @ple/artifact dev` plus curl route checks | Passed for `/thirty-day-milestone-evidence.md`, `/thirty-day-review-script.md`, and `/thirty-day-milestone-evidence.json` with captured source fields visible |
| `git diff --check` | Passed |

## Source Check

- Canonical workflow PDF `HeirRight Workflow. pdf.pdf` is still absent from the checkout.
- Fallback workflow PDF checked with `pypdf`: `HeirRight_Workflow_Templates_11.15.25.pdf`. It confirms owner/company stop rules, county property search, deed/OR book, mailing address, tax history, unpaid taxes, reassessment, receipts/payer, civil/family/probate records, affidavits of heirs, official-record cross-checks, and completed lead report shape.
- Example lead checked with `pypdf`: `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`. It confirms completed packet fields for property address, offer/profit table, owner DOB/DOD, obituary/source status, adverse possession, tax payer/payment, deed/title state, probate, and heirs.
- `/solvys-heir-audit` checklist checked from `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.

## /solvys-heir-audit

Source checked: `references/deal-flow-checklist.md`, fallback workflow PDF `HeirRight_Workflow_Templates_11.15.25.pdf`, Amaranthe example lead packet, S17/S20/S19 sprint briefs, latest handoff, and repo implementation under `probate-lead-engine`

Backward: Added captured-field detail to source coverage blockers and surfaced it in the 30-day milestone packet and client review agenda. This supports property identity, tax, deed/title, probate/court, family-tree, and offer review by separating what is already captured from what must still be pulled, without promoting default review seeds or source-health checks as qualified leads.

UX pass: aligned. The changed operator artifacts use plain real estate workflow language: `Captured`, `Missing`, `Records To Pull Next`, property identity, tax status, deed and title, probate and court, and family tree and offer inputs. The agenda remains a Sam/Joshua review script, not a developer log.

Forward: Next work belongs to S17/S20 if credentials remain unavailable: fill the missing source-record facts with approved source records and rerun the 30-day packet. If credentials and explicit approval arrive, run S19-T1/T2 controlled Google/Podio readbacks first.

Alignment: aligned with gaps

Required corrections before complete:

- Keep S20 acceptance blocked until an approved production county seed batch, stronger source coverage, qualified volume, and controlled Google/Podio readback are present.
- Keep S19-T1/T2 blocked until Google Workspace config, Podio config, controlled test values, CSV backup/export access, and explicit live-write approval are supplied.
- Reauthenticate Linear before relying on live issue state or issue mutation.

## Remaining Blockers

- Live Linear mutation is blocked by reauthentication (`oauth_token_invalid_grant`).
- Google live readback needs approved Workspace access plus Drive/Docs/Sheets target config.
- Podio controlled write/readback needs credentials, target app setup, field mapping or Texas Equity preset, controlled test phone/email/profile values, CSV backup/export access, and explicit `PODIO_LIVE_WRITE_APPROVED=true`.
- Production acceptance still needs a real approved production seed batch, 200-400 raw lead volume, 80-150 qualified lead volume, stronger source coverage, and human acceptance review.
- No public deploy was performed because this automation prompt does not grant publish/deploy approval.

## Decisions Needed From Sam

- Provide or approve the first production seed batch for the county run.
- Decide whether the next pass should prioritize pulling source records for property, taxes, deed/title, probate, and heirs before expanding volume.
- Choose when to provide Google Workspace config for one controlled readback.
- Choose whether to approve one clearly labeled Podio test item and readback.
- Reauthenticate Linear if live issue updates are required from this automation.

## 11 AM Review Packet

What was done:

- Added captured-source-field detail to source coverage blockers.
- Updated the 30-day evidence packet so each blocked source area shows `Captured`, `Missing`, and `Next`.
- Updated the 30-day agenda so Sam/Joshua can see what source work is already done versus what records still need to be pulled.
- Revalidated the full smoke bundle and the guarded Podio live-test blocker.

What was not done:

- No live Google Workspace write/readback.
- No live Podio item/comment/task/readback.
- No outreach, legal/compliance claim, paid/manual source use, or production CRM write.
- No public deploy.

What needs Sam's review:

- Whether to supply production seeds and live handoff credentials/approval now.
- Whether the captured-vs-missing source plan is enough for the June 21 30-day review while acceptance remains blocked.

What tomorrow's agent should improve before starting new work:

- If credentials/approval arrive, run S19-T1/T2 live readbacks first and attach IDs/URLs/readback proof.
- If credentials are still missing, continue S17 by ingesting real approved source-record facts into the existing blocker areas and rerun S20.
- Keep `qualification-review.md`, `readback-evidence.md`, `thirty-day-milestone-evidence.md`, and `thirty-day-review-script.md` as the operator-facing review packet set.

## Agent Briefing

--- Briefing for HeirRight Run-Point Agent ---
Generated: 2026-06-21
Project: HeirRight Probate Lead Engine
Branch: `v2.5.1/heirright-2026-06-21-run-point` (main: stale at `17c119f`; use run-point branch history for S16-S20 truth)

## Identity

HeirRight Probate Lead Engine turns probate/heir-property seeds into review packets, qualification evidence, and guarded Google/Podio handoff artifacts for a real estate operator. Client-facing language must stay in real estate workflow terms, not repo or engineering terms.

## Stack

- Frontend: vanilla HTML/CSS/JS artifact dashboard in `probate-lead-engine/apps/artifact`.
- Backend: TypeScript worker/CLI in `probate-lead-engine/apps/worker`.
- Infrastructure: pnpm workspaces, Turborepo, Cloudflare Worker config, file-based outputs under `apps/worker/output`.

## Core Rules

- Do not count default review seeds as production acceptance.
- Do not promote generic probate/property pulls as qualified leads without converging source evidence.
- Do not perform live outreach, production CRM writes, paid/manual source use, or legal/compliance claims without explicit approval.
- Podio remains the CRM/work queue of record unless smoke tests disprove it.
- Keep operator-facing setup/review language plain for a real estate user.

## Key Paths

| Path | Purpose |
|------|---------|
| `probate-lead-engine/apps/worker/src/daily/run-daily.ts` | Daily production/review run aggregation |
| `probate-lead-engine/apps/worker/src/qa/source-coverage.ts` | Source coverage area extraction and missing-field profile |
| `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts` | 30-day evidence packet and review agenda |
| `probate-lead-engine/apps/worker/src/readback/readback-evidence.ts` | Google/Podio readback evidence packet |
| `probate-lead-engine/apps/artifact/server.js` | Local artifact/dashboard server routes |
| `linear/HEIRRIGHT_LINEAR_TICKETS.md` | Repo-local Linear fallback while live Linear auth is blocked |

## Agent Roster

| Agent | Role | Notes |
|-------|------|-------|
| Codex Automation | Run point | Owns daily smoke gates, repo implementation, handoff notes |
| Claude Cowork / worker artifact | Podio automation artifact | Owns guarded Podio workflow prep/readback design |
| Sam | Human blocker owner | Credentials, approvals, live-write approval, milestone acceptance only |
| Joshua / HeirRight operator | Workflow reviewer | Reviews real estate packet, source records, and milestone acceptance |

## Recent Changes

- `8794d2f` surfaced source coverage blockers in the 30-day packet and dashboard routes.
- `e3da344` added S19 readback evidence packet.
- `2bdaa8a` normalized S16-S20 planning whitespace.
- This run adds captured-field detail to source coverage blockers and review agenda lines.

## Open Issues

- Linear connector reauth required.
- Production seed batch missing.
- Google Workspace and Podio live readback credentials/config/approval missing.
- Source coverage is still review-heavy and must be filled with real county/source records before acceptance.

## Available Commands

| Command | Purpose |
|---------|---------|
| `pnpm build` | Build all packages |
| `pnpm lint` | Build-backed lint validation |
| `pnpm --filter @ple/worker test` | Worker validation harness |
| `pnpm --filter @ple/worker run:daily` | Daily review packet generation |
| `pnpm --filter @ple/worker milestone:30-day` | 30-day evidence and review agenda |
| `AUTH_REQUIRED=false pnpm --filter @ple/artifact dev` | Local dashboard on port 4173 |

## Tools and Operational Protocol Updates

- `SourceCoverageBlocker` now includes `status` and `capturedFields`.
- Agents should use `dailyRun.sourceCoverageBlockers[].capturedFields` before writing vague source status updates.
- The 30-day review agenda now separates captured source fields from records still needing operator pull/confirmation.

## Build and Deploy

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/artifact build
```

Deploy remains blocked unless explicitly approved.

## Environment Variables

- `DAILY_RUN_SEEDS_JSON` or `DAILY_RUN_SEEDS_FILE`: approved production seed input.
- `GOOGLE_WORKSPACE_ACCESS_TOKEN`, `GOOGLE_TRACKING_SHEET_ID`: Google readback config.
- `PODIO_ACCESS_TOKEN`, `PODIO_APP_ID`, `PODIO_FIELD_MAP_JSON`: Podio export config.
- `PODIO_LIVE_WRITE_APPROVED`: must be `true` before any controlled live Podio write.
- Auth vars for artifact beta login when `AUTH_REQUIRED` is not disabled.

## How to Work Here

- Use one same-day HeirRight branch and preserve unrelated worktree changes.
- Run smoke gates before closeout and record blocked commands exactly.
- Keep generated review artifacts honest: blocked means blocked.
- Prefer repo-local fallback notes when Linear auth is unavailable.

## Architectural Guidance

Small vertical slices are preferred. Source facts, qualification, readback, and acceptance packets are separate proof layers. Do not hide manual/paid source gates or turn review-only placeholders into qualification evidence. UI/report changes should read like a real estate workbench, not an engineering console.

## Docs Sync

No Mintlify docs (`docs.json` or `mint.json`) were found locally. External docs were not updated.

--- End Briefing ---

## Tomorrow's Recommended Sprints

- First choice if external inputs arrive: S19-T1 and S19-T2 controlled Google/Podio readback, then update S19-T3 with IDs/URLs/readback proof.
- First choice if inputs do not arrive: continue S17 source extraction depth by filling the blocker areas now visible in `sourceCoverageBlockers`, then rerun S20.
- Do not start visual polish until production seeds, source coverage, qualification, and readback blockers move.
