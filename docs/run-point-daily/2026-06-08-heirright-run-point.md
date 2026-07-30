# HeirRight Run Point - 2026-06-08

Branch: `v2.2.1/heirright-2026-06-08-run-point`
Pushed remote branch: `origin/v2.2.1/heirright-2026-06-08-run-point`
Pushed ref: `origin/v2.2.1/heirright-2026-06-08-run-point`

## Previous-Day Touchups Reviewed

- Read `docs/run-point-daily/2026-06-07-heirright-run-point.md`.
- Read the automation memory through June 7.
- Started from `main` at `17c119f` after `git fetch --all --prune`.
- Found carried public-site edits in `site-v2/index.html`, `site-v2/src/main.ts`, and `site-v2/src/styles.css` before branching. Preserved them on today's fresh unified branch and hardened them through S10 launch QA instead of reverting them.
- Rechecked Linear read-only. Visible state: `HEI-77` In Progress, `HEI-61` In Progress, `HEI-76` Todo, `HEI-34` Todo, S10 tickets `HEI-66` through `HEI-70` Todo, and S11 tickets `HEI-71` through `HEI-75` Todo. No Linear mutations were performed.

## Sprint / Milestone Batches Worked

- S10 - public website redesign build/polish and launch QA.
- S14/S15 - 30-Day production/export blocker verification for HEI-77.
- S9/S15 live-readback blocker check only, because Podio and Google runtime inputs remain external dependencies.

## Tickets Touched

Read-only Linear context:

- `HEI-35`
- `HEI-69`
- `HEI-70`
- `HEI-77`
- `HEI-61`
- `HEI-34`
- `HEI-76`

No Linear status changes, assignments, comments, or closures were made.

## What Was Done

- Carried forward and hardened the public-site hero/nav visual pass in `site-v2`.
- Reworked the public-site first viewport around the actual HeirRight family-property review promise:
  - centered inherited-property review hero;
  - visible title/tax/probate/heir review badge;
  - review-area stat cards;
  - refined glass nav and call-to-action controls.
- Fixed the contact CTA behavior so header links scroll to the contact section with a fixed-nav offset and focus the target section.
- Removed the hero's dependency on hide-before-reveal animation after Browser QA showed the headline could remain invisible in desktop automation.
- Shortened the mobile header CTA to `Review` visually while keeping `aria-label="Request Review"`.
- Tightened the mobile hero layout so the badge, headline, summary, buttons, and stat cards stay inside the 390px viewport.
- Reverified S14/S15 output truth: latest daily run still has 2 raw leads, 0 qualified leads, no production county seed file, and live exports blocked without credentials/readback.

## What Was Not Done

- No production deploy was performed.
- No live Podio item, comment, task, file/link, or readback request was executed.
- No live Google Workspace Drive/Docs/Sheets write or readback was executed.
- No outreach, calls, texts, emails, letters, offers, legal claims, paid-source lookup, or production CRM write was attempted.
- No Linear mutation was made.

## Repo Evidence

- `site-v2/index.html`
- `site-v2/src/main.ts`
- `site-v2/src/styles.css`

## Validation Commands / Results

```bash
cd /Users/tifos/Documents/Codebases/heir-right/site-v2
pnpm build
```

Passed after the final public-site edits.

```bash
cd /Users/tifos/Documents/Codebases/heir-right
git diff --check
```

Passed.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
```

Passed. Turbo reported 3 successful package builds.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker test
```

Passed. Validation output reported `ok: true`, run id `run-1780899579611-20611-nw-33rd-pl-miami-gardens-fl-33056`, and 49 facts.

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
```

Passed. Dry run reported:

- `runId: run-1780899579614-20611-nw-33rd-pl-miami-gardens-fl-33056`
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

- `id: daily-1780899578795-miami-dade-broward`
- `rawLeadCount: 2`
- `qualifiedLeadCount: 0`
- `reviewLeadCount: 2`
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

## Browser / UI QA

Public-site dev server:

```bash
cd /Users/tifos/Documents/Codebases/heir-right/site-v2
pnpm dev
```

Served at `http://127.0.0.1:5173/`.

In-app Browser desktop pass:

- Page: `http://127.0.0.1:5173/`
- Title: `HeirRight | Inherited Property Review`
- Hero headline accessible label: `Inherited Property Review`
- Hero word opacity/filter after hardening: opacity `1`, filter `none`
- Header contact CTA count: 1
- Clicking the header CTA landed on `#contact`, focused `contact`, and placed the contact section below the fixed nav (`contactTop=84`, `navHeight=64`)
- Desktop overflow: `scrollWidth=1265`, `clientWidth=1265`
- Console warnings/errors: none

In-app Browser mobile pass:

- Viewport: `390x844`
- Header CTA visual label: `Review`; accessible label remains `Request Review`
- Header CTA bounds: left `240`, right `348`, width `108`
- Hero content bounds: left `18`, right `357`, width `339`
- Title, badge, lede, summary, and stat cards stayed inside the viewport
- Clicking the header CTA landed on `#contact`, focused `contact`, and placed the contact section below the fixed nav (`contactTop=78`, `navHeight=58`)
- Mobile overflow: `scrollWidth=375`, `clientWidth=375`, `bodyScrollWidth=375`, `bodyClientWidth=375`
- Console warnings/errors: none

Screenshot evidence:

- Desktop fallback screenshot: `/tmp/heirright-site-desktop-final-2026-06-08.png`
- Mobile CDP screenshot at explicit 390px viewport: `/tmp/heirright-site-mobile-cdp-390-2026-06-08.png`
- The in-app Browser screenshot API timed out on this project, so screenshot evidence used Chrome DevTools Protocol while Browser remained the DOM, console, and interaction verifier.

## Solvys Design-Guideline UI Audit

- The public-site hero uses an actual inherited-property review image and visible HeirRight review promise as the first-viewport signal.
- The first screen is the usable public review experience, not a marketing-only explainer.
- Copy stays in real estate workflow language: title, tax, probate, heirs, property review, offer conversation.
- No developer terms are visible in the first-viewport public copy.
- The risky hide-before-reveal animation was removed from the critical hero message after QA showed it could blank the headline.
- Mobile text and buttons were tightened so the operator-facing promise remains legible at 390px.

## Agent-Facing Notes

- Future HeirRight agents should treat `site-v2` as the current public-site surface and continue validating it with real browser/mobile checks after visual edits.
- Do not reintroduce first-viewport hero copy that depends on animation timing to become readable.
- Keep public review requests receipt-only unless Sam supplies and approves the production destination.
- Keep daily production claims tied to `run:daily` output. Today's output is not 30-Day volume proof.
- Keep Podio/Google export language prep-gated until controlled live write/readback evidence exists.

## /solvys-heir-audit

```text
/solvys-heir-audit
Source checked: AGENTS.md, automation memory, June 7 handoff, deal-flow checklist, repo fallback HeirRight_Workflow_Templates_11.15.25.pdf via pypdf, Amaranthe example lead packet via pypdf, S10/S14/S15 briefs, Linear read-only state, site-v2 browser QA, latest run/daily/export outputs
Backward: carried and hardened the public-site visual pass, fixed contact CTA scroll/focus behavior, removed fragile hidden hero animation, tightened mobile first-viewport layout, and reverified daily/export blockers without implying live CRM, Google, outreach, legal, or qualification success
UX pass: aligned
Forward: keep S10 launch QA ready for review; if external inputs arrive, complete controlled Podio/Google readback; otherwise continue HEI-77 acceptance packet truth and S14 production-seed readiness
Alignment: aligned with gaps
Required corrections before complete:
- canonical repo path HeirRight Workflow. pdf.pdf is still missing; repo fallback HeirRight_Workflow_Templates_11.15.25.pdf and Amaranthe packet were checked
- live Podio proof still needs PODIO_ACCESS_TOKEN, PODIO_APP_ID=24265877, PODIO_LIVE_WRITE_APPROVED=true, PODIO_TEST_PHONE, PODIO_TEST_EMAIL, PODIO_LEAD_POINT_PROFILE_ID, CSV backup access, and successful item/task/comment/readback
- live Google proof still needs Google Workspace credentials and target Sheet/Drive/Docs configuration
- production county seed inputs still gate 30-Day milestone acceptance and any 200-400 raw / 80-150 qualified volume claim
```

## Remaining Blockers

- S9 remains externally blocked for live completion until Podio runtime config, controlled write approval, CSV backup access, and readback proof are supplied.
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
- Pick the production destination for public review requests: approved webhook, CRM handoff, inbox, or no production submit until launch approval.
- Restore `HeirRight Workflow. pdf.pdf` to the canonical repo path or formally accept the repo template PDF as the audit source.

## Tomorrow's Recommended Sprints

- First: S10-T5 / HEI-70 review pass if Sam wants the public-site hero/nav polish to move toward launch approval.
- Second: S14/S15 / HEI-77 acceptance evidence, unless Podio/Google credentials arrive.
- If Podio credentials and controlled-write approval arrive, prioritize S9/S15 live readback over additional public-site polish.

## 11 AM Review Packet

### What was done

- Hardened the public-site hero/nav visual pass into a browser-verified S10 QA state.
- Fixed contact CTA scrolling and mobile CTA clipping.
- Removed fragile hero animation behavior that could hide first-viewport copy.
- Reproved daily production and export blocker truth.

### What was not done

- No production deploy, CRM write, Google write, outreach, paid source, or legal/compliance action was performed.
- No live Podio or Google readback was possible without external inputs.
- No Linear mutation was made.

### What needs Sam's review

- Whether the public-site first viewport is acceptable for S10 launch review.
- Whether to supply Podio/Google runtime inputs now or keep those gates blocked.
- Whether the 30-Day blocker state is acceptable as the review packet's current truth.
- Whether the canonical workflow PDF should be restored.

### What tomorrow's agent should improve before starting new work

- Re-run the public site at `390x844` before changing any hero/nav geometry.
- Re-run `run:daily` before making any 30-Day acceptance claim.
- If touching S10 again, add only focused polish backed by browser proof; do not broaden into a new redesign without explicit approval.
