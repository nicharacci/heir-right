# HeirRight Run Point - 2026-06-12

Branch: `v2.2.1/heirright-2026-06-12-run-point`
Pushed remote branch: `origin/v2.2.1/heirright-2026-06-12-run-point`
Pushed ref: `origin/v2.2.1/heirright-2026-06-12-run-point`

## Previous-Day Touchups Reviewed

- Read the automation memory through the 2026-06-08 run.
- Read `docs/run-point-daily/2026-06-08-heirright-run-point.md`.
- Read `/Users/tifos/.codex/skills/solvys-heir-audit/SKILL.md` and `references/deal-flow-checklist.md`.
- Fetched remotes and confirmed the checkout started on `v2.2.1/heirright-2026-06-08-run-point` at `d07c97f`.
- Confirmed `origin/main` still pointed at `17c119f`, behind the current validated June 8 run-point branch, so today branched from the current validated tip.
- Confirmed there was no existing local or remote `heirright-2026-06-12` unified branch.
- Created today's unified branch `v2.2.1/heirright-2026-06-12-run-point`.
- Verified `origin/sprint/S12-S13-heirright-2-beta-access-ui` and `origin/sprint/S14-S15-heirright-2-beta-production-export` are ancestors of today's branch. No merge was needed.

## Sprint / Milestone Batches Worked

- S12/S13 - beta access gate and report rail/operator UI verification.
- S14/S15 - daily lead production truth and Google/Podio export/readback verification.
- S9 live Podio remained a blocker check only because credentials, controlled-write approval, and readback proof are external dependencies.

## Tickets Touched

Read-only Linear context:

- `HEI-77` - In Progress, 30-Day acceptance remains blocked on production volume and live readback proof.
- `HEI-76` - Todo, Pre-Alaska MVP acceptance remains blocked by S9 live Podio proof.
- `HEI-34` / `HEI-61` - Podio automation and technical validation remain blocked/in progress by live access and readback requirements.
- `HEI-80` / `HEI-81` - S12 children are Done in Linear and repo-verified locally today.
- `HEI-82` / `HEI-83` / `HEI-84` - S13 report rail/report shape work is Done in Linear and repo-verified locally today.
- `HEI-85` / `HEI-87` / `HEI-88` - S14 daily production/qualification work is Done in Linear and repo-verified locally today.
- `HEI-86` / `HEI-89` / `HEI-90` - S15 Google/Podio export work is Done in Linear and repo-verified locally today, with live readback still externally blocked.

No Linear status changes, comments, assignments, or closures were made.

## What Was Done

- Repo-verified that S12/S13 and S14/S15 work are already present on the current unified history.
- Re-ran the required `probate-lead-engine` smoke bundle.
- Re-ran S14 daily production validation and confirmed the output still tells the truth: 2 raw leads, 0 qualified leads, 2 review leads, and production-volume blockers.
- Re-ran S15 dry export validation and confirmed Google and Podio handoff routes prepare in dry-run mode without claiming readback.
- Re-ran the guarded Podio live test and confirmed it blocks before any network write because live Podio config is missing.
- Verified S12 local auth behavior:
  - `/` returns `401` and shows the beta login blocker when OAuth/session config is missing.
  - `/latest-run.json` returns `401` instead of exposing lead data.
  - `/auth/session` reports `authenticated: false`, `required: true`, `configured: false`, and allowed domain `heirright.com`.
- Verified S13/S15 artifact dashboard behavior in the in-app Browser with local review mode:
  - Desktop dashboard loads 49 evidence items with no console warnings/errors and no horizontal overflow.
  - Podio and Google footer chips show `Blocked`.
  - Report rail opens and shows rendered report content, missing sections, and readback blockers.
  - Combined Google + Podio handoff route reports prepared for review and keeps live readback/CRM write approval explicit.
  - Mobile `390x844` viewport has no horizontal overflow and keeps plain lead-review language visible.
- Rebuilt `site-v2` to confirm the prior public-site state still compiles.

## What Was Not Done

- No production deploy was performed because today's product surfaces were verification-only and the only repo mutation is this handoff note.
- No live Podio item, comment, task, file/link, or readback request was executed.
- No live Google Workspace Drive/Docs/Sheets write or readback was executed.
- No outreach, calls, texts, emails, letters, offers, legal claims, paid-source lookup, or production CRM write was attempted.
- No Linear mutation was made.

## Repo Evidence

- `probate-lead-engine/apps/worker/src/validation/run-validation.ts`
- `probate-lead-engine/apps/worker/src/daily/run-daily.ts`
- `probate-lead-engine/apps/worker/src/export/export-package.ts`
- `probate-lead-engine/apps/worker/src/cloudflare.ts`
- `probate-lead-engine/apps/artifact/server.js`
- `probate-lead-engine/apps/artifact/src/index.html`
- `sprint-md/S12-ORCHESTRATION.md`
- `sprint-md/S13-ORCHESTRATION.md`
- `sprint-md/S14-ORCHESTRATION.md`
- `sprint-md/S15-ORCHESTRATION.md`

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

Passed. Validation output reported `ok: true`, run id `run-1781258621199-20611-nw-33rd-pl-miami-gardens-fl-33056`, and 49 facts.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
```

Passed. Dry run reported:

- `runId: run-1781258627481-20611-nw-33rd-pl-miami-gardens-fl-33056`
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
pnpm --filter @ple/worker run:daily
```

Passed. Daily run reported:

- `id: daily-1781258638317-miami-dade-broward`
- `rawLeadCount: 2`
- `qualifiedLeadCount: 0`
- `reviewLeadCount: 2`
- `duplicateCount: 0`
- missed volume reasons: raw count below target, qualified count below target, and no production batch seed file

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker export:dry
```

Passed. Google and Podio routes returned `mode: dry_run`, `readbackOk: false`, with live readback skipped blockers.

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
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
node --check apps/artifact/server.js
```

Passed.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
node - <<'NODE'
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const html = readFileSync('apps/artifact/src/index.html', 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim()).filter(Boolean);
for (const [index, script] of scripts.entries()) {
  new vm.Script(script, { filename: `apps/artifact/src/index.html#script-${index + 1}` });
}
console.log(`parsed ${scripts.length} inline script(s)`);
NODE
```

Passed. Parsed 1 inline script.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/site-v2
pnpm build
```

Passed.

```bash
cd /Users/tifos/Documents/Codebases/heir-right
git diff --check
```

Passed.

## Browser / UI QA

Artifact auth-blocker server:

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
PORT=4182 pnpm --filter @ple/artifact dev
```

Verified by `curl`:

- `GET /` returned `401 Unauthorized` with the visible blocker `Google OAuth is not configured yet.`
- `GET /latest-run.json` returned `401 Unauthorized` with `error: auth_required`.
- `GET /auth/session` returned `authenticated: false`, `required: true`, `configured: false`, `allowedDomains: ["heirright.com"]`.

Artifact local-review server:

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
AUTH_REQUIRED=false PORT=4182 pnpm --filter @ple/artifact dev
```

In-app Browser desktop pass on `http://127.0.0.1:4182/`:

- Title: `HeirRight Lead Review`
- Top status: `49 evidence items loaded from the latest lead review.`
- Podio status: `Podio - Blocked`
- Google status: `Google - Blocked`
- Handoff status before action: `handoff: [PREP ONLY]`
- Report rail opened with rendered report content and missing sections visible.
- Combined Google + Podio handoff showed `handoff: [GOOGLE + PODIO] [PREPARED]`.
- Top status after combined handoff: `Google + Podio handoff prepared for review. Live readback still needs approval before any CRM write.`
- Desktop overflow: `scrollWidth=1280`, `clientWidth=1280`.
- Console warnings/errors: none.

In-app Browser mobile pass:

- Viewport: `390x844`
- Title: `HeirRight Lead Review`
- Top status: `49 evidence items loaded from the latest lead review.`
- Podio status: `Podio - Blocked`
- Google status: `Google - Blocked`
- Handoff status: `handoff: [PREP ONLY]`
- Plain lead-review language visible: `Find Estates` and `Add tax history`.
- Mobile overflow: `scrollWidth=375`, `clientWidth=375`, `bodyScrollWidth=375`, `bodyClientWidth=375`.
- Console warnings/errors: none.

## Solvys Design-Guideline UI Audit

- Artifact dashboard copy stays in real estate workflow language: estates, files, property address, evidence, missing sections, tax history, report rail, Podio handoff, Google Workspace handoff.
- The main operator view does not expose JSON, payload, adapter, CLI, or TypeScript wording.
- The first dashboard state shows lead-review status and blocked handoff status, not a false readiness claim.
- Report rail gives the operator a concrete review workspace instead of a raw technical artifact.
- Export actions are labeled as prepared handoff routes and keep live readback/CRM write approval visible.
- Mobile `390px` width has no horizontal overflow.

## Agent-Facing Notes

- Future HeirRight agents should treat `S12/S13` and `S14/S15` as present on the current unified branch and repo-verified today.
- Do not move `HEI-77`, `HEI-76`, `HEI-34`, or `HEI-61` to acceptance-ready without live credential/readback proof and production county seeds.
- Keep Podio as the CRM/work queue of record unless a credentialed smoke test disproves it.
- Keep public lead and report language review-gated. A generic public-source seed is not a qualified lead until source evidence and quality signals converge.
- Keep beta access fail-closed when OAuth/session config is missing.
- Keep local review mode explicitly local; it is not a production auth bypass.

## /solvys-heir-audit

```text
/solvys-heir-audit
Source checked: AGENTS.md, automation memory, June 8 handoff, deal-flow checklist, repo fallback HeirRight_Workflow_Templates_11.15.25.pdf via pypdf, Amaranthe example lead packet via pypdf, S12/S13/S14/S15 briefs, Linear read-only state, worker validation output, daily/export outputs, artifact auth checks, and in-app Browser artifact QA
Backward: repo-verified S12/S13 beta access and report rail behavior plus S14/S15 daily production and export/readback behavior; confirmed auth-required surfaces block lead data without OAuth/session config, report rail shows review work instead of raw artifacts, daily production does not count generic review seeds as qualified, and Google/Podio handoffs stay prep/readback-gated
UX pass: aligned
Forward: if credentials arrive, prioritize S9/S15 controlled Podio and Google readback; otherwise continue HEI-77 acceptance packet truth and production county seed readiness before any volume or qualification claim
Alignment: aligned with gaps
Required corrections before complete:
- canonical repo path HeirRight Workflow. pdf.pdf is still missing; repo fallback HeirRight_Workflow_Templates_11.15.25.pdf and Amaranthe packet were checked
- live Podio proof still needs PODIO_ACCESS_TOKEN, PODIO_APP_ID=24265877, PODIO_LIVE_WRITE_APPROVED=true, PODIO_TEST_PHONE, PODIO_TEST_EMAIL, PODIO_LEAD_POINT_PROFILE_ID, CSV backup access, and successful item/task/comment/readback
- live Google proof still needs Google Workspace credentials and target Sheet/Drive/Docs configuration
- production county seed inputs still gate 30-Day milestone acceptance and any 200-400 raw / 80-150 qualified volume claim
```

## Remaining Blockers

- S9 remains externally blocked for live completion until Podio runtime config, controlled write approval, CSV backup access, and readback proof are supplied.
- S12 beta production readiness still needs Google OAuth client configuration and session secret in the target runtime.
- S15 remains repo-complete but externally blocked for live Google/Podio readback.
- HEI-77 / 30-Day acceptance is not claim-ready while latest daily output remains 2 raw, 0 qualified, and no production county seed file.
- Public review-request production routing still needs Sam's destination decision.
- The canonical workflow PDF path named by the audit skill is still missing in this repo checkout.

## Decisions Needed From Sam

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
- Second: HEI-77 30-Day acceptance evidence packet and production county seed readiness.
- If credentials do not arrive, prioritize S12 production OAuth configuration notes plus HEI-77 blocker-proof cleanup, keeping all readiness claims review-gated.

## 11 AM Review Packet

### What was done

- Verified S12/S13 and S14/S15 are present on the unified branch and pass current repo smoke gates.
- Proved the beta app blocks lead data without OAuth/session config.
- Proved the report rail and export prep surfaces stay readable, operator-facing, and readback-gated.
- Reproved daily production truth: current local seeds do not satisfy 30-Day volume or qualified-lead targets.

### What was not done

- No live CRM, Google Workspace, outreach, paid source, legal/compliance, Linear mutation, or production deploy action was performed.
- No milestone acceptance claim was made.

### What needs Sam's review

- Whether to provide Podio and Google credentials/readback approvals now.
- Whether to provide production county seed inputs for the 30-Day acceptance run.
- Whether to configure Google OAuth for protected beta access.
- Whether the fallback workflow template PDF can remain the audit source, or the canonical workflow PDF should be restored.

### What tomorrow's agent should improve before starting new work

- Check whether a same-day unified branch already exists and reuse it.
- Start by revalidating S9/S15 blockers before expanding product scope.
- If credentials are still absent, spend the run tightening HEI-77 acceptance evidence and production seed readiness rather than adding unrelated UI polish.
