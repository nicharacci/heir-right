# HEI-001 2026-06-22

# HeirRight Run Point Handoff - 2026-06-22

## Branch

- Local branch: `v2.5.2/heirright-2026-06-22-run-point`
- Remote branch: `origin/v2.5.2/heirright-2026-06-22-run-point`
- Base context: started from `v2.5.1/heirright-2026-06-21-run-point` at `e16279b`, because `main` remains stale and the June 21 branch contains the latest verified S17/S20 work.
- Version note: `probate-lead-engine/package.json` still says `1.0.0`; the active run-point namespace is `v2.5.x`, so this run used the next daily patch namespace.

## Previous-Day Touchups Reviewed

- Reviewed `docs/run-point-daily/2026-06-21-heirright-run-point.md`.
- Confirmed yesterday's S17/S20 captured-vs-missing work was present on the branch and no unrelated dirty state existed at run start.
- Checked live Linear and confirmed it remains blocked by reauthentication: `oauth_token_invalid_grant`.
- Checked the automation memory path. `/Users/tifos/.codex/automations/HEI-001-run-point/memory.md` was absent at run start and was created during closeout.

## Sprints Worked

- S17 - Structured Source Extraction Upgrade: added a guarded `confirmedSourceFacts` path for approved production seed batches.
- S18 - Qualification Promotion Loop: made dossier claims prefer real source-backed facts over same-field placeholders, while preserving remaining promotion blockers.
- S20 - 30-Day Acceptance Run: clarified aggregate source coverage wording for mixed-lead packet evidence.

## Tickets Touched

- `S17-T1` property + tax extraction path - seed batches can carry confirmed property/tax facts with source URLs or record references.
- `S17-T2` official records + deed extraction path - confirmed deed/title facts such as `last_sale_date` can clear their own field coverage.
- `S18-T1` evidence coverage scoring - validation now proves confirmed facts reduce source blockers without counting a lead as qualified.
- `S18-T3` operator spot-check packet - qualification review keeps remaining no-enrichment and missing-source blockers visible.
- `S20-T2` acceptance packet - milestone evidence now says `captured on at least one lead` and `still missing on at least one lead`.
- `S20-T3` client review script - review agenda uses the same mixed-lead wording.

## Repo Evidence

- Added `ConfirmedSourceFactInput` and `confirmedSourceFacts` to `IntakeSeed` in `probate-lead-engine/packages/types/src/index.ts`.
- Added source, fact-type, value, reference, confidence, and blocking-flag validation in `probate-lead-engine/apps/worker/src/daily/seed-batch.ts`.
- Added confirmed source fact materialization in `probate-lead-engine/apps/worker/src/index.ts`.
- Updated claim selection in `probate-lead-engine/apps/worker/src/dossier/build-raw-dossier.ts` so source-backed facts supersede placeholders for the same field.
- Added `tax status` to source coverage in `probate-lead-engine/apps/worker/src/qa/source-coverage.ts`.
- Updated S20 output wording in `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts`.
- Expanded validation in `probate-lead-engine/apps/worker/src/validation/run-validation.ts`.
- Updated `probate-lead-engine/apps/worker/input/production-seeds.example.json` with guarded sample confirmed facts.
- Updated `linear/HEIRRIGHT_LINEAR_TICKETS.md` because live Linear remains unavailable.

Generated sample-file evidence:

- `DAILY_RUN_SEEDS_FILE=input/production-seeds.example.json pnpm --filter @ple/worker run:daily` passed with 2 raw leads, 0 qualified leads, and 7 blocked source areas.
- `DAILY_RUN_SEEDS_FILE=input/production-seeds.example.json pnpm --filter @ple/worker milestone:30-day` passed with `overallStatus: blocked`, `blockedGateCount: 5`, 2 raw leads, and 0 qualified leads.
- `thirty-day-milestone-evidence.md` now shows `Captured on at least one lead: tax status` and `Captured on at least one lead: last sale date`.
- `thirty-day-review-script.md` now says records are captured or missing `on at least one lead`.

## Validation Results

All commands ran from `/Users/tifos/Documents/Codebases/heir-right/probate-lead-engine`.

| Command | Result |
| --- | --- |
| `pnpm build` | Passed |
| `pnpm lint` | Passed |
| `pnpm --filter @ple/worker test` | Passed; validation includes confirmed-source seed coverage and blocked-promotion checks |
| `pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"` | Passed; status `ready_for_review`, workflow `review_required`, operator queue `manual_review` |
| `pnpm --filter @ple/artifact build` | Passed |
| `pnpm --filter @ple/worker seeds:validate -- --file=input/production-seeds.example.json` | Passed; 2 accepted, 0 rejected, 0 issues |
| `DAILY_RUN_SEEDS_FILE=input/production-seeds.example.json pnpm --filter @ple/worker run:daily` | Passed; 2 raw, 0 qualified, 7 source areas still blocked |
| `DAILY_RUN_SEEDS_FILE=input/production-seeds.example.json pnpm --filter @ple/worker milestone:30-day` | Passed; `overallStatus: blocked`, 5 blocked gates |
| `git diff --check` | Passed |

## Source Check

- Canonical workflow PDF `HeirRight Workflow. pdf.pdf` is still absent from the checkout.
- Fallback workflow PDF checked with `pypdf`: `HeirRight_Workflow_Templates_11.15.25.pdf`, 20 pages. It confirms the workflow still requires property, deed, tax, probate, heir, offer/profit, mailing-address, receipt/payer, and adverse-possession review.
- Example lead packet checked with `pypdf`: `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`, 11 pages. It confirms completed packet shape for property address, offer/profit, owner DOB/DOD, deed/title, taxes, adverse possession, probate, and heirs.
- `/solvys-heir-audit` checklist checked from `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.

## /solvys-heir-audit

Source checked: `references/deal-flow-checklist.md`, fallback workflow PDF `HeirRight_Workflow_Templates_11.15.25.pdf`, Amaranthe example lead packet, S17/S18/S20 sprint briefs, latest handoff, and repo implementation under `probate-lead-engine`

Backward: Added guarded confirmed source facts for approved seed batches, made claims prefer source-backed facts over placeholders for the same field, and clarified 30-day packet wording for mixed-lead coverage. This supports property, tax, deed/title, probate, family-tree, and offer review by allowing real source facts to clear their own fields while keeping missing facts, no-enrichment, and live-readback blockers visible.

UX pass: aligned. Changed packet text uses plain real estate workflow language: captured on at least one lead, still missing on at least one lead, tax status, deed and title, records to pull next. No developer-only wording was added to operator-facing packet sections.

Forward: Next work belongs to S17/S18 if credentials remain unavailable: add real approved county source facts across tax, deed/title, probate, and heirs, then rerun qualification and S20. If credentials and explicit approval arrive, run S19 controlled Google/Podio readbacks first.

Alignment: aligned with gaps

Required corrections before complete:

- Keep S20 acceptance blocked until real approved production volume, stronger source coverage, qualified volume, and controlled Google/Podio readback are present.
- Keep S19-T1/T2 blocked until Google Workspace config, Podio config, controlled test values, CSV backup/export access, and explicit live-write approval are supplied.
- Reauthenticate Linear before relying on live issue state or issue mutation.

## Remaining Blockers

- Live Linear mutation is blocked by reauthentication (`oauth_token_invalid_grant`).
- Google live readback needs approved Workspace access plus Drive/Docs/Sheets target config.
- Podio controlled write/readback needs credentials, target app setup, field mapping or Texas Equity preset, controlled test phone/email/profile values, CSV backup/export access, and explicit `PODIO_LIVE_WRITE_APPROVED=true`.
- Production acceptance still needs a real approved production seed batch at target volume, stronger source coverage, qualified lead volume, and human milestone acceptance review.
- No public deploy was performed because this automation prompt does not grant publish/deploy approval.

## Decisions Needed From Sam

- Provide or approve a real production seed batch with source references, not the sample contract file.
- Decide whether to prioritize adding verified county source facts before expanding volume.
- Provide Google Workspace config for one controlled readback when ready.
- Approve or withhold one clearly labeled Podio test item and readback.
- Reauthenticate Linear if live issue updates are required from this automation.

## 11 AM Review Packet

What was done:

- Added guarded source fact intake for approved seed batches.
- Updated source coverage so confirmed facts can reduce blockers without hiding remaining gaps.
- Updated 30-day packet language so Sam/Joshua can read mixed-lead source coverage clearly.
- Validated build, worker tests, dry run, artifact build, seed validation, sample daily run, and sample milestone evidence.

What was not done:

- No live Google Workspace write/readback.
- No live Podio item/comment/task/readback.
- No outreach, legal/compliance claim, paid/manual source use, or production CRM write.
- No public deploy.

What needs Sam's review:

- Whether the next work should add real source records into approved seed batches or first provide live readback credentials.
- Whether the sample confirmed-source contract is the right shape for Sam/Joshua to supply source evidence.

What tomorrow's agent should improve before starting new work:

- If credentials/approval arrive, run S19-T1/S19-T2 controlled readbacks first and attach IDs/URLs/readback proof.
- If credentials are still missing, continue S17/S18 by filling confirmed facts for tax unpaid years, receipt/payer, deed/title, probate/court, and heirs.
- Keep S20 blocked unless real production volume, source coverage, qualified volume, and live readback all pass.

## Agent Briefing

--- Briefing for HeirRight Run-Point Agent ---
Generated: 2026-06-22
Project: HeirRight Probate Lead Engine
Branch: `v2.5.2/heirright-2026-06-22-run-point` (main: stale; use run-point branch history for S16-S20 truth)

## Identity

HeirRight Probate Lead Engine turns probate/heir-property seeds into review packets, qualification evidence, and guarded Google/Podio handoff artifacts for a real estate operator. Client-facing language must stay in real estate workflow terms, not repo or engineering terms.

## Stack

- Frontend: vanilla HTML/CSS/JS artifact dashboard in `probate-lead-engine/apps/artifact`.
- Backend: TypeScript worker/CLI in `probate-lead-engine/apps/worker`.
- Infrastructure: pnpm workspaces, Turborepo, Cloudflare Worker config, file-based outputs under `apps/worker/output`.

## Core Rules

- Do not count default review seeds or sample files as production acceptance.
- Do not count source reachability as source evidence.
- Do not promote a lead with open core blockers as qualified.
- Do not perform live outreach, production CRM writes, paid/manual source use, or legal/compliance claims without explicit approval.
- Podio remains the CRM/work queue of record unless smoke tests disprove it.

## Key Paths

| Path | Purpose |
| --- | --- |
| `probate-lead-engine/apps/worker/src/daily/seed-batch.ts` | Production seed validation and confirmed source fact guardrails |
| `probate-lead-engine/apps/worker/src/dossier/build-raw-dossier.ts` | Dossier claim selection and source-backed fact preference |
| `probate-lead-engine/apps/worker/src/qa/source-coverage.ts` | S17 source coverage profile |
| `probate-lead-engine/apps/worker/src/qualification/qualification-review.ts` | S18 qualification decision and review packet |
| `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts` | S20 milestone packet and review agenda |
| `linear/HEIRRIGHT_LINEAR_TICKETS.md` | Repo-local Linear fallback while live Linear auth is blocked |

## Agent Roster

| Agent | Role | Notes |
| --- | --- | --- |
| Codex Automation | Run point | Owns daily implementation, smoke gates, and handoff notes |
| Claude Cowork / worker artifact | Podio automation artifact | Owns guarded Podio workflow prep/readback design |
| Sam | Human blocker owner | Credentials, approvals, live-write approval, milestone acceptance only |
| Joshua / HeirRight operator | Workflow reviewer | Reviews source records, packet truth, and milestone acceptance |

## Recent Changes

- `e16279b`: clarified captured-vs-missing source coverage blockers.
- `8794d2f`: surfaced source coverage blockers in packets/dashboard routes.
- `e3da344`: added Google/Podio readback evidence packet.
- This run: adds guarded confirmed source facts and improves mixed-lead packet wording.

## Open Issues

- Linear connector reauth required.
- Real production seed batch and source-record facts are still missing.
- Google Workspace and Podio live readback credentials/config/approval are missing.
- Qualified volume remains 0 in sample/default runs.

## Available Commands

| Command | Purpose |
| --- | --- |
| `pnpm build` | Build all packages |
| `pnpm lint` | Build-backed lint validation |
| `pnpm --filter @ple/worker test` | Worker validation harness |
| `pnpm --filter @ple/worker seeds:validate -- --file=input/production-seeds.example.json` | Validate sample seed contract |
| `DAILY_RUN_SEEDS_FILE=input/production-seeds.example.json pnpm --filter @ple/worker run:daily` | Generate sample daily evidence |
| `DAILY_RUN_SEEDS_FILE=input/production-seeds.example.json pnpm --filter @ple/worker milestone:30-day` | Generate sample milestone packet |

## Tools and Operational Protocol Updates

- `IntakeSeed.confirmedSourceFacts` accepts guarded field facts from property, tax, official-record, probate, and clerk sources.
- Confirmed source facts need non-empty values, source URLs or record references, and confidence from 0 to 1.
- Blocking flags such as `SOURCE_EVIDENCE_REQUIRED`, `SOURCE_HEALTH_ONLY`, and `SOURCE_BLOCKED` are rejected for confirmed facts.
- Seed-confirmed facts can reduce S17 blockers but cannot override no-enrichment, missing-source, credential, readback, or volume blockers.

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
- `AUTH_REQUIRED`, `AUTH_ALLOWED_DOMAINS`, `AUTH_ALLOWED_EMAILS`, `HEIRRIGHT_API_TOKEN`: artifact beta access controls.

## How to Work Here

- Use one same-day HeirRight branch and preserve unrelated worktree changes.
- Run smoke gates before closeout and record blocked commands exactly.
- Keep generated review artifacts honest: blocked means blocked.
- Prefer repo-local fallback notes when Linear auth is unavailable.

## Architectural Guidance

Small vertical slices are preferred. Source facts, qualification, readback, and acceptance packets are separate proof layers. Do not hide manual/paid source gates or turn sample source facts into production acceptance.

## Docs Sync

No Mintlify docs (`docs.json` or `mint.json`) were found locally. External docs were not updated.

--- End Briefing ---

## Tomorrow's Recommended Sprints

- First choice if external inputs arrive: S19-T1/S19-T2 controlled Google/Podio readback, then update S19-T3 with IDs/URLs/readback proof.
- First choice if inputs do not arrive: continue S17/S18 by adding real confirmed source facts for tax, deed/title, probate/court, and heirs, then rerun S20.
- Do not start visual polish until production seeds, source coverage, qualification, and readback blockers move.
