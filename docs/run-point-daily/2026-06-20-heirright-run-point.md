# HeirRight Run Point Handoff - 2026-06-20

## Branch

- Local branch: `v2.4.4/heirright-2026-06-20-run-point`
- Remote branch: `origin/v2.4.4/heirright-2026-06-20-run-point`
- Base context: started from `v2.4.3/heirright-2026-06-18-run-point` at `e3da344`, because `main` is stale at `17c119f` and the June 18 branch contains the latest repo-verified S16-S20 work.
- Version note: `probate-lead-engine/package.json` still says `1.0.0`, but active remote run-point history is `v2.4.x`; this run preserved that active namespace and incremented to `v2.4.4`.

## Previous-Day Touchups Reviewed

- No `docs/run-point-daily/2026-06-19-heirright-run-point.md` exists.
- Memory for the June 19 run says it only opened the HEI-001 run point, checked audit inputs, and confirmed the branch still needed rotation before implementation.
- The June 18 handoff was treated as the last implemented baseline.
- Live Linear remains unavailable through the connector: `oauth_token_invalid_grant` / reauthentication required.

## Sprints Worked

- S17 - Structured Source Extraction Upgrade: added explicit source coverage blocker aggregation to the daily run and 30-day evidence packet.
- S20 - 30-Day Acceptance Run: improved the acceptance packet and review agenda so Sam/Joshua can see exactly which real estate records must be pulled next before acceptance.
- S19 - Controlled Google + Podio Readback: revalidated dry-prep and guarded live-test behavior. No live readback was attempted.

## Tickets Touched

- `S17-T1` property + tax extraction path - repo evidence now names missing property and tax fields by area.
- `S17-T2` official records + deed extraction path - repo evidence now names deed/title blockers including OR book/page, last sale, mortgage, lien, Lis Pendens, foreclosure, and adverse possession.
- `S17-T3` probate + court extraction path - repo evidence now names probate/court blockers including case number, status, civil/family docket, affidavit, document availability, and official-record cross-link.
- `S20-T2` acceptance packet - generated packet now includes a `Source Coverage Blockers` section.
- `S20-T3` client review script - generated agenda now includes `Records To Pull Next`.
- `S19-T1` and `S19-T2` remain externally blocked until Google Workspace and Podio credentials/config plus explicit live-write approval are supplied.

## Repo Evidence

- Added `SourceCoverageBlocker` shared type in `probate-lead-engine/packages/types/src/index.ts`.
- Added source coverage blocker aggregation in `probate-lead-engine/apps/worker/src/daily/run-daily.ts`.
- Added source blocker sections to `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts`.
- Added validation assertions in `probate-lead-engine/apps/worker/src/validation/run-validation.ts`.
- Added artifact server routes for `/thirty-day-milestone-evidence.json` and `/thirty-day-milestone-evidence.md`.
- Added a dashboard packet link named `30-Day evidence`.
- Updated the repo-local Linear fallback sheet in `linear/HEIRRIGHT_LINEAR_TICKETS.md`.

Generated current packet evidence:

- `probate-lead-engine/apps/worker/output/thirty-day-milestone-evidence.md` contains `Source Coverage Blockers`.
- `probate-lead-engine/apps/worker/output/thirty-day-review-script.md` contains `Records To Pull Next`.
- Latest 30-day packet status remains `blocked`: 2 raw review leads, 0 qualified leads, 6 blocked acceptance gates.

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
| `AUTH_REQUIRED=false pnpm --filter @ple/artifact dev` plus curl route checks | Passed for `/thirty-day-milestone-evidence.md` and `/thirty-day-review-script.md` source blocker sections |

## Source Check

- Canonical workflow PDF `HeirRight Workflow. pdf.pdf` is still absent from the checkout.
- Fallback source checked: `HeirRight_Workflow_Templates_11.15.25.pdf` with Python `pypdf`. The extracted pages include owner stop rules, county property search, deed/OR book, mailing address, tax history, probate/civil/family records, affidavits, marriage, obituary, paid/manual source, and completed lead report requirements.
- Example lead checked: `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf` with Python `pypdf`. The extracted pages include date added, property address, offer/profit table, taxes, current title/deed state, probate, and heirs.
- `solvys-heir-audit` checklist checked from `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.

## /solvys-heir-audit

Source checked: `references/deal-flow-checklist.md`, fallback workflow PDF `HeirRight_Workflow_Templates_11.15.25.pdf`, Amaranthe example lead packet, S17/S20 sprint briefs, and repo implementation under `probate-lead-engine`

Backward: Added repo-owned source coverage blocker aggregation and surfaced it in the 30-day milestone packet, review script, artifact route, and dashboard packet list. This supports the workflow steps for property identity, mailing address, tax payer/receipts, deed/OR book, recent sale, adverse possession, probate/court records, affidavits, and family-tree/offer review without promoting generic seeds as qualified.

UX pass: aligned. The changed operator artifacts use plain real estate workflow language: `Source Coverage Blockers`, `Records To Pull Next`, property identity, tax status, deed and title, probate and court, and family tree and offer inputs. The milestone route exposes the packet directly from the dashboard.

Forward: Next work belongs to S17 and S20 if credentials remain unavailable: pull or ingest real approved source-record facts and rerun the 30-day packet. If credentials/approval arrive, run S19-T1/T2 controlled Google/Podio readbacks first.

Alignment: aligned with gaps

Required corrections before complete:

- Keep S20 acceptance blocked until an approved production county seed batch, stronger source coverage, qualified volume, and controlled Google/Podio readback are present.
- Keep S19-T1/T2 blocked until Google Workspace config, Podio config, controlled test values, CSV backup/export access, and explicit live-write approval are supplied.
- Reauthenticate Linear before relying on live issue state.

## Remaining Blockers

- Live Linear mutation is blocked by reauthentication (`oauth_token_invalid_grant`).
- Google live readback needs approved Workspace access plus Drive/Docs/Sheets target config.
- Podio controlled write/readback needs credentials, target app setup, field mapping or Texas Equity preset, controlled test phone/email/profile values, CSV backup/export access, and explicit `PODIO_LIVE_WRITE_APPROVED=true`.
- Production acceptance still needs a real approved production seed batch, 200-400 raw lead volume, 80-150 qualified lead volume, stronger source coverage, and human acceptance review.
- No public deploy was performed because publishing/deployment was not explicitly approved by this automation prompt.

## Decisions Needed From Sam

- Provide or approve the first production seed batch for the county run.
- Decide whether the next pass should prioritize source records for property, taxes, deed/title, probate, and heirs before expanding volume.
- Choose when to provide Google Workspace config for one controlled readback.
- Choose whether to approve one clearly labeled Podio test item and readback.
- Reauthenticate Linear if live issue updates are required from this automation.

## 11 AM Review Packet

What was done:

- Added source coverage blockers to the daily run and 30-day milestone evidence contract.
- Updated the 30-day review agenda so Sam/Joshua can see which source records to pull next.
- Added direct artifact routes for the 30-day milestone evidence packet and linked it from the dashboard packet panel.
- Revalidated the full smoke bundle and the guarded Podio live-test blocker.

What was not done:

- No live Google Workspace write/readback.
- No live Podio item/comment/task/readback.
- No outreach, legal/compliance claim, paid/manual source use, or production CRM write.
- No public deploy.

What needs Sam's review:

- Whether to supply production seeds and live handoff credentials/approval now.
- Whether the newly explicit source blocker packet is sufficient for the 11 AM discussion while source coverage and live readback remain blocked.

What tomorrow's agent should improve before starting new work:

- If credentials/approval arrive, run S19-T1/T2 live readbacks first and attach IDs/URLs/readback proof.
- If credentials are still missing, continue S17 by ingesting real source-record facts into the existing blocker areas and rerun S20.
- Keep `qualification-review.md`, `readback-evidence.md`, `thirty-day-milestone-evidence.md`, and `thirty-day-review-script.md` as the operator-facing review packet set.

## Agent Briefing

--- Briefing for HeirRight Run-Point Agent ---
Generated: 2026-06-20
Project: HeirRight Probate Lead Engine
Branch: `v2.4.4/heirright-2026-06-20-run-point` (main: current run-point branch is ahead of stale `main`; use branch history, not `main`, for S16-S20 truth)

## Identity

HeirRight Probate Lead Engine is a TypeScript monorepo that turns probate/heir-property seeds into review packets, qualification evidence, and guarded Google/Podio handoff artifacts for a real estate operator. The client-facing language must stay in real estate workflow terms, not repo or engineering terms.

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
| `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts` | 30-day acceptance packet and agenda |
| `probate-lead-engine/apps/worker/src/qualification/qualification-review.ts` | Qualification packet generation |
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

- `e3da344` added S19 readback evidence packet.
- `2bdaa8a` normalized S16-S20 planning whitespace.
- `1c7636d` normalized HeirRight S16-S20 planning.
- `932839d` added production seed intake coverage.
- `1b89d68` added 30-day evidence packet.
- This run adds source coverage blocker summaries, milestone packet routes, and dashboard access to the 30-day evidence packet.

## Open Issues

- Linear connector reauth required.
- Production seed batch missing.
- Google Workspace and Podio live readback credentials/config/approval missing.
- Source coverage is still source-health/review-heavy and must be filled with real county/source records before acceptance.

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

- New artifact routes: `/thirty-day-milestone-evidence.json` and `/thirty-day-milestone-evidence.md`.
- Dashboard packet panel now links `30-Day evidence`.
- `DailyRunResult` now carries `sourceCoverageBlockers`; agents should use that before vague blocked-area summaries.

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
