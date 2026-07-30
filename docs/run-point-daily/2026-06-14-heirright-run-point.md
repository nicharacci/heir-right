# HeirRight Run Point - 2026-06-14

Branch: `v2.3.1/heirright-2026-06-14-run-point`
Pushed remote branch: `origin/v2.3.1/heirright-2026-06-14-run-point`
Pushed ref: `origin/v2.3.1/heirright-2026-06-14-run-point`

## Previous-Day Touchups Reviewed

- Read `/Users/tifos/.codex/automations/heirright-run-point/memory.md`; the automation memory currently ends at the 2026-06-12 run.
- Confirmed there is no `docs/run-point-daily/2026-06-13-heirright-run-point.md` in this checkout, despite the automation metadata reporting a 2026-06-13 run.
- Read `docs/run-point-daily/2026-06-12-heirright-run-point.md`.
- Read `/Users/tifos/.codex/skills/solvys-heir-audit/SKILL.md`, `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`, and `/Users/tifos/.codex/skills/solvys-inform/SKILL.md`.
- Read the PDF skill and checked the source PDFs with `pypdf` because Poppler tools are not installed locally.
- Confirmed the canonical audit path `HeirRight Workflow. pdf.pdf` is still missing in the repo.
- Checked fallback source PDFs:
  - `HeirRight_Workflow_Templates_11.15.25.pdf`: 20 pages; extracted text includes property search, deed, tax, probate, heirs, receipt, and obituary workflow terms.
  - `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`: 11 pages; extracted text includes date added, property address, offer/profit fields, owner DOB/DOD, obituary, tax, deed, probate, and heirs.
- Fetched remotes and confirmed `origin/main` still points to `17c119f`, behind the validated June 12 branch tip `90ed188`.
- Confirmed there was no existing local or remote `heirright-2026-06-14` unified branch, then created `v2.3.1/heirright-2026-06-14-run-point` from the June 12 validated tip.

## Sprint / Milestone Batches Worked

- HEI-77 / 30-Day Workflow Automation acceptance evidence packet.
- S14/S15 validation: daily production truth plus Google/Podio dry handoff and live-readback blockers.
- S9/S15 blocker verification: Podio live write/readback still fails closed before network write because runtime config and explicit approval are absent.

## Tickets Touched

Read-only Linear context:

- `HEI-77` - In Progress, 30-Day acceptance remains blocked by production seed volume, qualified-lead volume, and live readback.
- `HEI-86`, `HEI-89`, `HEI-90` - Done S15 export/readback work was revalidated locally in dry-run and blocked-live modes.
- `HEI-85`, `HEI-87`, `HEI-88` - Done S14 daily production/qualification work was revalidated locally.
- `HEI-34`, `HEI-61`, `HEI-62` through `HEI-65` - S9 Podio work remains Todo/In Progress in Linear because live Podio access/readback is still external.
- `HEI-76` - Todo human Pre-Alaska acceptance remains blocked by S9 live proof.

No Linear status changes, comments, assignments, or closures were made.

## What Was Done

- Added a first-class worker command for the 30-Day acceptance packet: `pnpm --filter @ple/worker milestone:30-day`.
- Added shared `ThirtyDayMilestoneEvidence` and `MilestoneEvidenceGate` types.
- Added `apps/worker/src/milestone/thirty-day-evidence.ts` to generate:
  - current daily run counts and volume target comparison,
  - production seed readiness,
  - qualification integrity,
  - duplicate/dead-letter handling,
  - Google and Podio dry handoff route evidence,
  - Google and Podio live-readback blockers,
  - external-use/no-auto-send guard evidence,
  - operator-readable JSON and markdown packets under `apps/worker/output/`.
- Added validation coverage so `pnpm --filter @ple/worker test` proves the default 30-Day packet is blocked without production seeds/live readback while still passing qualification-integrity and external-use guard gates.
- Generated a fresh local packet:
  - `apps/worker/output/thirty-day-milestone-evidence.json`
  - `apps/worker/output/thirty-day-milestone-evidence.md`
- Revalidated S14/S15 outputs and S9/S15 live-write blockers.

## What Was Not Done

- No production deploy was performed.
- No live Podio item, task, comment, file/link, or readback request was executed.
- No live Google Workspace Drive/Docs/Sheets write or readback was executed.
- No outreach, calls, texts, emails, letters, offers, legal claims, paid-source lookup, or production CRM write was attempted.
- No UI surface changed, so no browser UI pass was required today.

## Repo Evidence

- `probate-lead-engine/apps/worker/src/milestone/thirty-day-evidence.ts`
- `probate-lead-engine/apps/worker/src/milestone-30-day-cli.ts`
- `probate-lead-engine/packages/types/src/index.ts`
- `probate-lead-engine/apps/worker/src/validation/run-validation.ts`
- `probate-lead-engine/apps/worker/package.json`
- `probate-lead-engine/apps/worker/src/storage/output-manifest.ts`

## Validation Commands / Results

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
```

Passed. Turbo reported 3 successful package builds.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker test
```

Passed. Validation output reported `ok: true`, run id `run-1781431692131-20611-nw-33rd-pl-miami-gardens-fl-33056`, and 49 facts. The validation now includes HEI-77 default milestone evidence checks.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
```

Passed. Dry run reported:

- `runId: run-1781431708679-20611-nw-33rd-pl-miami-gardens-fl-33056`
- `status: ready_for_review`
- `workflowStatus: review_required`
- `operatorQueueState: manual_review`
- next best action: resolve workflow review flags before enrichment, document prep, CRM writes, or outreach

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/artifact build
```

Passed.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker milestone:30-day
```

Passed. The evidence packet reported:

- `overallStatus: blocked`
- `blockedGateCount: 5`
- `rawLeadCount: 2`
- `qualifiedLeadCount: 0`
- output JSON: `/Users/tifos/Documents/Codebases/heir-right/probate-lead-engine/apps/worker/output/thirty-day-milestone-evidence.json`
- output markdown: `/Users/tifos/Documents/Codebases/heir-right/probate-lead-engine/apps/worker/output/thirty-day-milestone-evidence.md`

Current blocked gates:

- Production county seed batch.
- Raw lead volume: 2 of target 200-400.
- Qualified lead volume: 0 of target 80-150.
- Google live readback.
- Podio live readback.

Passing gates:

- Qualification integrity: no lead with open blockers was counted as qualified.
- Dead letters and duplicate handling: 0 dead letters, 0 duplicates.
- Google handoff route dry prep.
- Podio handoff route dry prep.
- External-use/no-auto-send guard.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker run:daily
```

Passed. Daily run reported:

- `id: daily-1781431648965-miami-dade-broward`
- `rawLeadCount: 2`
- `qualifiedLeadCount: 0`
- `reviewLeadCount: 2`
- `duplicateCount: 0`
- `errorCount: 0`
- missed volume reasons: raw count below target, qualified count below target, and no production batch seed file

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker export:dry
```

Passed. Google and Podio routes returned `mode: dry_run`, `ok: true`, and `readbackOk: false` with live readback explicitly skipped.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker export:podio-live-test
```

Blocked before network write as expected. Result:

- `ok: false`
- `mode: blocked`
- `routeOk: false`
- `readbackOk: false`
- blocker: `Missing Podio export config: PODIO_ACCESS_TOKEN, PODIO_APP_ID, PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877`

```bash
cd /Users/tifos/Documents/Codebases/heir-right
git diff --check
```

Passed.

## Solvys Design-Guideline UI Audit

- No UI surface changed today.
- The generated markdown evidence packet is plain-language review material for the 30-Day milestone and does not ask a real estate operator to use repo tooling.
- The packet keeps review language explicit: blocked, passed, next action, raw lead volume, qualified lead volume, live readback, and no external-use guard.

## Agent-Facing Notes

- Future HeirRight agents should run `pnpm --filter @ple/worker milestone:30-day` before asking Sam to review `HEI-77`.
- Do not claim 30-Day acceptance from the default review seeds. The current local packet correctly reports 2 raw leads, 0 qualified leads, and no production batch seed file.
- Do not move `HEI-77`, `HEI-76`, `HEI-34`, or `HEI-61` to acceptance-ready without live credential/readback proof and production county seeds.
- Podio remains the CRM/work queue of record unless a credentialed smoke test disproves it.
- Keep Google/Podio dry handoff readiness separate from live readback readiness.
- Keep public lead/report language review-gated. A generic public-source seed is not a qualified lead until source evidence and quality signals converge.

## /solvys-heir-audit

```text
/solvys-heir-audit
Source checked: AGENTS.md, automation memory, June 12 handoff, run-point docs, Linear read-only state, deal-flow checklist, repo fallback HeirRight_Workflow_Templates_11.15.25.pdf via pypdf, Amaranthe example lead packet via pypdf, S14/S15 briefs, worker validation output, daily/export outputs, and the new 30-Day milestone evidence packet
Backward: added and validated a 30-Day milestone evidence generator that maps latest daily production counts, production seed readiness, qualification integrity, Google/Podio dry handoff readiness, live-readback blockers, and external-use guard state into a review packet; this supports the deal-flow requirement that generic seeds stay in review until source evidence, tax/deed/probate/heirship checks, and handoff readback converge
UX pass: aligned
Forward: next safe work is either controlled S9/S15 Podio and Google readback if credentials/approvals arrive, or HEI-77 production county seed readiness if they do not
Alignment: aligned with gaps
Required corrections before complete:
- canonical repo path HeirRight Workflow. pdf.pdf is still missing; repo fallback HeirRight_Workflow_Templates_11.15.25.pdf and the Amaranthe packet were checked
- HEI-77 remains blocked on approved production county seeds, 200-400 raw / 80-150 qualified volume proof, Google live readback, Podio live readback, and explicit Podio write approval
```

## Remaining Blockers

- HEI-77 / 30-Day acceptance is not claim-ready while the latest evidence packet reports `overallStatus: blocked`.
- Production county seed inputs still gate any 200-400 raw / 80-150 qualified volume claim.
- S9/S15 live Podio proof still needs Podio runtime config, controlled write approval, test-only phone/email values, a Podio Lead Point profile id, CSV backup access, and successful item/task/comment/readback.
- S15 live Google proof still needs Google Workspace credentials and target Sheet/Drive/Docs configuration.
- S12 beta production readiness still needs Google OAuth client configuration and session secret in the target runtime.
- Public review-request production routing still needs Sam's destination decision.
- The canonical workflow PDF path named by the audit skill is still missing in this repo checkout.

## Decisions Needed From Sam

- Provide approved production county seed inputs for the 30-Day acceptance run.
- Confirm whether Sam/Joshua can supply secure Podio bearer-token runtime config for app `24265877`.
- Approve or decline one clearly labeled `HEIRRIGHT TEST - DO NOT WORK - <timestamp>` Podio lead write.
- Provide test-only phone/email values and a Podio Lead Point profile id for required Podio fields.
- Confirm CSV backup/export access before live Podio validation is treated as milestone evidence.
- Confirm Google Workspace target folder/doc/sheet configuration for live Google readback.
- Confirm Google OAuth client id/secret and session secret for the protected beta runtime.
- Pick the production destination for public review requests: approved webhook, CRM handoff, inbox, or no production submit until launch approval.
- Restore `HeirRight Workflow. pdf.pdf` to the canonical repo path or formally accept the repo template PDF as the audit source.

## Tomorrow's Recommended Sprints

- First: S9/S15 controlled Podio and Google readback if credentials and write approval arrive.
- Second: HEI-77 production county seed run and 30-Day evidence packet review.
- If credentials do not arrive, prioritize production seed readiness and acceptance evidence cleanup over unrelated UI polish.

## 11 AM Review Packet

### What was done

- Added a repeatable 30-Day milestone evidence packet command.
- Validated that the packet reports current local truth: blocked, 2 raw leads, 0 qualified leads, no production batch seed, no live Google readback, and no live Podio readback.
- Confirmed dry Google/Podio handoff routes still prepare safely.
- Confirmed Podio live test still fails closed before network write.

### What was not done

- No live CRM, Google Workspace, outreach, paid source, legal/compliance, Linear mutation, UI change, or production deploy action was performed.
- No milestone acceptance claim was made.

### What needs Sam's review

- Whether to provide production county seed inputs now.
- Whether to provide Podio and Google credentials/readback approvals now.
- Whether to configure Google OAuth for protected beta access.
- Whether the fallback workflow template PDF can remain the audit source, or the canonical workflow PDF should be restored.

### What tomorrow's agent should improve before starting new work

- Start with `pnpm --filter @ple/worker milestone:30-day` and compare the packet to any new Sam-provided seeds/credentials.
- If credentials are still absent, improve the production seed acceptance path and keep all qualification/readiness claims review-gated.
- If credentials are present, run the controlled Google and Podio readback checks before expanding product scope.
