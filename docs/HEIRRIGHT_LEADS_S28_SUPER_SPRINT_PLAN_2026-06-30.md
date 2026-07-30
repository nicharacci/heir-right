# HeirRight Leads S28 Super-Sprint Plan - 2026-06-30

Status: annotation intake and S28 execution plan. S22 through S27 are treated as finished baseline work. S28 is the next implementation pass, with internal tracks used only to organize the super-sprint. Implementation for this pass begins after the remaining annotation batches land.

Execution tracker: `docs/HEIRRIGHT_LEADS_S28_EXECUTION_TRACKER_2026-06-30.md`

Risk and decision register: `docs/HEIRRIGHT_LEADS_S28_RISK_DECISION_REGISTER_2026-06-30.md`

## Current Production Truth

- Canonical repo: `/Users/tifos/Documents/Codebases/heir-right`
- Active branch: `v1.1.1/heirright-2026-06-30-s26-s27`
- Completed baseline: S22 through S27
- Current unrelated dirty files: `probate-lead-engine/package.json`, `probate-lead-engine/pnpm-lock.yaml`
- Live app alias: `https://heirright-leads.vercel.app/`
- Verified source/build/live artifact hash before this plan: `04e4a68237d7bae2a491ecbb30c9f0a0ca0a542454e0ce7a1f555152bff90fa5`
- Latest production run: `run-1782844176326-20611-nw-33rd-pl-miami-gardens-fl-33056`
- Latest lead under review: `20611 NW 33rd Pl, Miami Gardens, FL 33056`
- Current workflow state: `review_required`
- Current operator queue: `manual_review`
- Current completed lead report blockers: 6 missing-data sections
- Current CRM state: `not_configured`
- Current integration health: Podio, Google, Resend, SMS Gateway, and Web Search are blocked or waiting for approved client/service inputs. These must stay visible as setup blockers until a controlled readback proves otherwise.

## User Scope

1. Verify the dashboard active-process view and Needs Attention section use accurate real data.
2. Replace placeholders with live run, workflow, document, CRM, outreach, and integration data.
3. Ensure every CTA button functions, opens the right workflow, or shows a concrete setup blocker.
4. Finish the app product loop across import, review, document prep, report packet, outreach, CRM handoff, and export.
5. Make both document-prep workflows run end to end with production-grade process statuses.
6. Complete visual review across desktop and mobile, including alignment, container-relative sizing, and thin-width behavior.
7. Run full QA for overflow, clipped text, and off-screen content at multiple widths.
8. Wire outreach with an open-source Podio automation bridge. If it cannot complete with the available credentials, fall back to an Architecturally Free Outreach tab that keeps the queue operational without pretending to send live outreach.
9. Present the completed report packet as a PDF. Replace the top six-card report cover with a Date Added dropdown. Put notes and blockers below the PDF viewport.
10. Add a product demo and guided walkthrough pop-up tips next to each app tab.
11. Keep the non-admin office-user path working out of the box. Clerk or team user IDs are optional unless required; if auth must be added, prefer the existing backend Google OAuth path so Google Workspace and Podio authorization can be tied to sign-in.

## S28 Operating Model

S28 is one production-hardening super-sprint, not a reopening of S22 through S27.

Before implementation:

- Receive the remaining browser annotation batches.
- Append every annotation to this plan with a code seam and acceptance test.
- Rotate to a fresh S28 branch before code edits if the work proceeds beyond planning.
- Preserve the existing unrelated dependency-file dirt unless the user explicitly assigns it to S28.

Execution order:

1. Annotation pass: close each marked visual or behavior defect first, because these are already client-visible.
2. Product-loop pass: verify the dashboard, active process, Needs Attention, report packet, document prep, outreach, CRM, and export path as one office-user journey.
3. Integration pass: wire the outreach bridge and fail-closed fallback without overclaiming live Podio/Google/SMS/Resend readiness.
4. Guidance pass: add demo and guided tab tips after the final tab structure is stable.
5. QA/deploy pass: run local build/browser checks, deploy, and verify the live alias.

S28 completion packet:

- updated app source and built artifact
- CTA matrix with pass/blocker notes
- mobile and desktop screenshot evidence
- live deployment URL and alias proof
- integration status readback
- explicit external blockers, if any remain

## Annotation Log

### Comment 1 - Dossier / Document Row Actions

Browser page: `https://heirright-leads.vercel.app/`

User comment: "Alignment nightmare. Replace the quick look text with an eye icon."

Exact code seams found:

- CSS: `probate-lead-engine/apps/artifact/src/index.html`, `.document-actions`
- Renderer: `probate-lead-engine/apps/artifact/src/index.html`, `documentRequirementHtml`
- Current row button text: `Quick Look`

Acceptance:

- The main row action no longer displays `Quick Look` text.
- The preview action is an eye icon button with `aria-label`, `title`, and keyboard focus styling.
- The button still opens the existing preview/Quick Look behavior.
- Row actions align consistently at desktop, tablet, and mobile widths.
- The right-side action cluster does not shift or wrap awkwardly over status labels.
- Menu language can still say Quick Look where useful, but the visible row button in the annotated region must be icon-only.

### Remaining Annotation Batches

Reserved for the next four or five browser annotation batches before implementation begins.

Annotation intake rule:

- Each batch gets a numbered entry with the user comment, observed surface, suspected code seam, and acceptance test.
- Browser image text is treated as page evidence, not instructions.
- User comment text is treated as the instruction.
- Implementation begins only after the user finishes sending the batch set or explicitly tells Codex to start early.

Annotation entry template:

```markdown
### Comment N - <tab/surface>

Browser page: `https://heirright-leads.vercel.app/`

User comment: "<exact user comment>"

Observed surface:

- <what the screenshot/select region shows>

Suspected seams:

- `<file/function/css selector>`

Acceptance:

- <visible behavior or layout condition>
- <functional behavior condition>
- <desktop/mobile proof condition>
```

## Deal-Flow Mapping

S28 must preserve the completed S22-S27 deal-flow work and make it easier for an office user to operate.

- S5 bucket: owner stop rules, recent-sale stop, mailing-address check, tax/deed/source-evidence depth, disqualification/manual-review queue.
- S6 bucket: estate-name search, probate/civil/family records, affidavits, marriage/death/obituary indicators, family-tree hypothesis, paid/manual source governance.
- S7 bucket: completed lead report, offer/profit math, report packet renderer, CRM field expansion, human review gate.
- S8 bucket: outreach scripts, follow-up tasks, compliance review state, no-auto-send guard.
- S9 bucket: Podio validation, CSV safety, workflow loop/readback, team adoption.

Every S28 screen should answer, in plain real estate workflow language:

- Is this lead moving forward, under review, blocked, or a move-on?
- What property, owner, deed, OR book/page, tax, probate, heir, or offer/profit detail needs review?
- What should the office user click or inspect next?
- What external access or approval is still missing?

## S28 Backlog Tickets

### S28-01 - Annotation Closeout Pass

Primary seams:

- `probate-lead-engine/apps/artifact/src/index.html`, `documentRequirementHtml`
- `.document-actions`, `.document-requirement`, narrow-width media rules

Work:

- Close Comment 1 by replacing the row-level `Quick Look` text button with an eye icon button.
- Add each remaining annotation as it arrives.
- Fix marked visual defects before larger product-loop changes so later QA starts from the client-visible problem areas.

Acceptance:

- Every received annotation has a code change or explicit blocker.
- Comment 1 row actions stay aligned at desktop, tablet, and mobile widths.
- Preview remains keyboard and screen-reader accessible.

### S28-02 - Dashboard Truth Pass

Primary seams:

- `needsAttentionItems`
- `dashboardActivityRows`
- `processCardHtml`
- dashboard render block around the Needs Attention and Active Processes sections
- `/api/connections/status`

Work:

- Trace Needs Attention and Active Processes to current run facts, document prep state, CRM/handoff blockers, and connector status.
- Remove or relabel any fabricated clock/activity values that look like live history.
- Make every card click land on the panel where the office user can do the next action.

Acceptance:

- Needs Attention count and card copy match current missing sections, document gaps, and external blockers.
- Active Processes shows Estate Discovery and Closing Prep status from real document/workflow state.
- Recent Activity is either sourced from actual app events/local state or clearly labeled as current workspace activity, not fake production history.

### S28-03 - CTA Matrix And Product Loop

Primary seams:

- top-bar buttons with `data-rail-action`, `data-export-route`, `data-crm-batch-import`
- shell navigation handlers with `data-shell-nav`
- queue, report, document prep, outreach, connector, and footer action handlers

Work:

- Build the CTA matrix before editing.
- Verify every CTA by clicking it in browser automation after editing.
- Keep CTAs that cannot perform a live external action behind clear setup/readback blockers.

Acceptance:

- No dead CTA remains.
- No CTA silently mutates state without feedback.
- No CTA claims that a live Podio card, Google Doc, Google Sheet row, email, SMS, or Resend message was created unless the controlled readback proves it.

### S28-04 - Document Prep End-To-End

Primary seams:

- `renderDossiersView`
- `renderDossiersListView`
- `addDocPrepForRow`
- `openDocPrepRow`
- `documentRequirementHtml`
- `handleDocumentMenuAction`
- `docsForFlow`
- `docPrepFlows`

Work:

- Verify Estate Discovery and Closing Prep as separate flows.
- Confirm stage eligibility, start/add flow, file/link action, generated-packet linking, preview, blocker state, bundle export, and reload safety.
- Make statuses office-readable and tied to the selected estate, not generic process words.

Acceptance:

- Estate Discovery can be started, reviewed, partially completed, completed, and exported.
- Closing Prep can be started after eligibility, reviewed, partially completed, completed, and exported.
- Switching flows does not lose the selected estate, file links, or status.

### S28-05 - Completed Report Packet PDF View

Primary seams:

- `railDocsHtml`
- `.report-cover`
- `.doc-frame`
- completed report renderer fields from `completedLeadReportHtml`

Work:

- Replace the six-card report cover with a Date Added dropdown at the top of the completed report packet.
- Render the packet in a PDF-oriented viewport or real PDF artifact path.
- Move notes, missing-data sections, live blockers, and readback blockers below the PDF viewport.
- Preserve download/export paths.

Acceptance:

- The report packet view starts with a Date Added selector, then the PDF/packet viewport.
- Notes and blockers appear below the viewport.
- The viewport content matches the selected lead/report context.

### S28-06 - Outreach Bridge And Free Fallback

Primary seams:

- `renderDripsView`
- `syncOutreachTemplate`
- outreach workspace local persistence
- `probate-lead-engine/apps/artifact/api/connections/status.js`
- `probate-lead-engine/apps/worker/src/export/export-package.ts`

Work:

- Add an Activepieces/Podio bridge path for approved outreach sync.
- Add or expose an Architecturally Free Outreach fallback when the bridge is not configured.
- Preserve no-auto-send, approval, and readback guardrails.
- Store remote IDs/readback state only after real connector confirmation.

Acceptance:

- With missing credentials, outreach remains usable as approved drafts, queue, export, and Podio-ready mapping with a clear blocked live-sync step.
- With credentials, the app writes through the bridge, reads back the created/updated Podio artifact, and records the readback before marking sync complete.
- No SMS/email is sent by the fallback path.

### S28-07 - Settings, Auth, And Non-Admin Setup

Primary seams:

- `renderAdminLoopView`
- `integrationOnboardingCardHtml`
- connection chips and `/api/connections/status`
- existing auth/session surface

Work:

- Confirm the non-admin office-user path works without repo tooling.
- If auth is required for team IDs, prefer existing Google OAuth/backend flow over introducing Clerk unless Clerk becomes strictly necessary.
- Explain connector setup in office-user terms: access, backup, approval, sample write, readback.

Acceptance:

- An office user can understand why a connector is blocked and what access/approval is needed.
- The app does not expose Node, CLI, JSON, env-var, or repo-tool instructions in the main client-facing path.

### S28-08 - Product Demo And Guided Walkthrough

Primary seams:

- shell navigation buttons
- app state/local persistence keys
- tab render functions for Dashboard, Estates, Dossiers, Outreach, Queue, Settings/Admin

Work:

- Add a demo launcher.
- Add anchored pop-up tips next to each primary tab.
- Persist dismissed/replay state locally.
- Keep copy tied to actual workflow actions.

Acceptance:

- First-time users can launch, step through, skip, and replay the walkthrough.
- Tips do not cover the CTA they describe on mobile or desktop.

### S28-09 - Visual And Responsive QA

Primary seams:

- document row action layout
- report rail layout
- outreach two-column layout
- dashboard grids
- queue/settings cards

Work:

- Fix non-relative positioning, awkward wrapping, text clipping, action overlap, and thin-width shifts.
- Add viewport checks for the agreed widths.

Acceptance:

- No incoherent overlap or off-screen primary content at 1440, 1180, 820, 430, 390, or 360px widths.
- Any necessary horizontal scrolling is contained to the relevant table/list, not the page.

### S28-10 - Build, Deploy, And Live Proof

Primary seams:

- `probate-lead-engine/apps/artifact/src/index.html`
- `probate-lead-engine/apps/artifact/dist/index.html`
- Vercel deployment/alias for `https://heirright-leads.vercel.app/`

Work:

- Build locally.
- Run browser QA locally or against a preview.
- Deploy and alias the production app.
- Re-run browser proof on the live alias.

Acceptance:

- Build passes.
- Live alias serves the updated artifact.
- Desktop/mobile proof and connector status proof are captured.

## CTA Matrix Scaffold

| Surface | CTA group | Expected behavior | Proof |
| --- | --- | --- | --- |
| Header | Import | Opens Podio/batch import path or setup blocker | Browser click plus state/status change |
| Header | Prep export | Opens export route menu and prepares route-specific package | Browser click plus export result/blocker |
| Header | Report | Opens report rail on the current lead | Browser click plus rail docs/flow state |
| Header | Save search | Persists current estate/search context or explains missing selection | Browser click plus persisted state/status |
| Header | Activity | Opens activity drawer with current app events | Browser click plus drawer content |
| Header | Load latest | Reloads latest run/fresh batch and updates selected estate | Browser click plus selected lead proof |
| Dashboard | Needs Attention | Sends user to the action panel for the blocker | Browser click per card |
| Dashboard | Active Processes | Opens Estate Discovery or Closing Prep with selected flow | Browser click plus active flow state |
| Dossiers | Add/Open/Preview/Export | Advances document prep without losing selected estate | Browser click plus reload-safe state |
| Report Packet | Date Added/PDF/export | Changes report context and preserves packet view | Browser click plus viewport proof |
| Outreach | New/Edit/Ready/Approve/Sync | Moves template through guarded approval and sync states | Browser click plus audit trail |
| Queue | Stage batch | Creates a review-only handoff package | Browser click plus queue/export status |
| Settings | Connector cards | Shows setup blocker or ready state from status API | Browser click plus `/api/connections/status` |
| Walkthrough | Start/next/skip/replay | Guides first-time user without blocking work | Browser click plus persisted state |

## Evidence Register

| Requirement | Evidence required before S28 done |
| --- | --- |
| Annotation closeout | Screenshot or browser proof for each annotated area |
| Dashboard truth | JSON/source trace plus rendered dashboard screenshot |
| CTA completion | CTA matrix with pass/blocker notes |
| Estate Discovery E2E | Browser path proof, reload proof, exported/prepared packet proof |
| Closing Prep E2E | Browser path proof, reload proof, exported/prepared packet proof |
| Report packet PDF | Rendered PDF/packet viewport proof and Date Added dropdown proof |
| Outreach bridge | Activepieces/Podio readback proof or fallback proof with blocked live-sync state |
| Non-admin office user | Main path contains plain workflow language and no repo/CLI setup requirements |
| Guided walkthrough | Desktop and mobile walkthrough proof |
| Responsive QA | Desktop/mobile screenshots plus overflow check results |
| Live deploy | Vercel alias proof for `https://heirright-leads.vercel.app/` |
| External blockers | `/api/connections/status` response and plain-language UI blockers |

## Dependency-Ordered Execution Board

### Block 0 - Intake Freeze

Status: pending remaining annotations.

- Finish receiving browser annotation batches.
- Append each annotation under Annotation Log with the screenshot surface, user comment, code seam, and acceptance test.
- Decide whether S28 will start on the existing branch or a fresh S28 branch. Default: fresh branch before code edits.
- Reconfirm the unrelated dependency-file edits are still unrelated before implementation begins.

Exit criteria:

- The plan contains every annotation the user sent.
- No user annotation remains only in conversation history.

## S28 Kickoff Checklist

Run this checklist immediately when the user says the annotation batches are complete or explicitly says to start early.

1. Re-read the newest user message and confirm whether annotation intake is complete.
2. Run `git status --short --branch` from `/Users/tifos/Documents/Codebases/heir-right`.
3. If code edits are starting, create or switch to a fresh S28 implementation branch unless the user explicitly keeps the current branch.
4. Confirm the existing `probate-lead-engine/package.json` and `probate-lead-engine/pnpm-lock.yaml` edits are still unrelated or intentionally pulled into scope.
5. Copy every new annotation into the Annotation Log using the template above.
6. Convert any newly discovered app seam into the relevant S28 ticket.
7. Start Block 1 with the client-visible visual defects before broader refactors.
8. Keep a running proof note as each S28 ticket is completed.

First-hour implementation order:

- Fix Comment 1 in `documentRequirementHtml` and the document-action CSS.
- Sweep all remaining annotations for shared layout causes.
- Run a narrow artifact build.
- Open the app locally or in preview at desktop and mobile widths.
- Capture before/after notes for annotated regions.
- Then move into Dashboard truth and CTA wiring.

Stop conditions:

- Stop before any live Podio, Google, SMS, Resend, or paid-source write unless explicit credentials, approval, and readback path are present.
- Stop before claiming legal/probate document completion if the app only prepared operator review materials.
- Stop before adding Clerk unless the existing Google OAuth/backend path cannot satisfy the team/user-ID requirement.
- Stop before destructive git cleanup or dependency rollback unless the user explicitly asks.
- Stop if an annotation contradicts a completed S22-S27 baseline assumption; record the conflict and resolve it before implementation continues.

### Block 1 - First Visual Stabilization Cut

Tickets: S28-01, first slice of S28-09.

- Fix Comment 1 and any other annotation that affects layout, alignment, text overflow, or action clusters.
- Keep these edits local to CSS/render seams unless the annotation exposes a real behavior bug.
- Run a narrow browser proof at desktop and mobile width before larger product-loop edits.

Exit criteria:

- Annotated regions no longer reproduce the visible defect.
- No new horizontal overflow appears on the touched views.

### Block 2 - Data Truth And Product Loop

Tickets: S28-02, S28-03, S28-04, S28-05.

- Make dashboard, Needs Attention, Active Processes, DocPrep, report packet, and export surfaces read from the same selected-run truth.
- Replace placeholders with either real data or explicit "needs review/setup" states.
- Build the CTA matrix as a live QA checklist while wiring each action.

Exit criteria:

- A user can start from Dashboard, open the current estate, move through DocPrep, open the report packet, stage/export the handoff, and understand the remaining blockers.

### Block 3 - Outreach And Connector Path

Tickets: S28-06, S28-07.

- Wire the Activepieces/Podio bridge only behind approval, connector, and readback checks.
- Expose the Architecturally Free Outreach fallback when the bridge is unavailable.
- Keep all client-facing connector copy in plain office workflow language.

Exit criteria:

- Missing credentials produce a usable fallback path and a specific blocked live-sync state.
- Present credentials produce write/readback proof before a sync is marked complete.

### Block 4 - Guided Demo

Ticket: S28-08.

- Add walkthrough launcher, per-tab tips, replay, skip, and persisted dismissed state.
- Verify tips do not cover critical controls on mobile.

Exit criteria:

- A first-time office user can follow the guided path without developer instructions.

### Block 5 - Full Visual QA

Ticket: S28-09.

- Review Dashboard, Estates, Dossiers, Report rail, Outreach, Queue, Settings/Admin, modals, menus, and walkthrough.
- Test the required viewport widths.
- Fix any overlap, clipping, action wrapping, or page-level overflow.

Exit criteria:

- Desktop and mobile screenshots show no incoherent overlap or off-screen primary content.

### Block 6 - Build, Deploy, And Proof Packet

Ticket: S28-10.

- Run local build/test gates.
- Deploy to Vercel.
- Verify the live alias and connector status.
- Attach the proof packet to the closeout.

Exit criteria:

- Live `https://heirright-leads.vercel.app/` serves the updated artifact.
- Proof packet covers each row in the Evidence Register.

## Parallelization Rules

The main session keeps ownership of source edits, branch state, deploy, and final proof. Subagents can help only when their work is evidence-gathering or analysis that does not mutate the shared tree unexpectedly.

Safe subagent lanes:

- Visual QA scout: inspect screenshots and list alignment/overflow defects with coordinates.
- CTA scout: click through the app and report dead or confusing controls.
- Outreach integration scout: verify current Activepieces/Podio API assumptions and list exact connector fields needed.
- Copy scout: review client-facing text for developer language or overclaimed automation.

Not delegated:

- final code edits
- Vercel deploy/alias
- credentialed live writes
- deciding whether external integrations are complete

## QA And Deploy Runbook

Local commands:

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/artifact build
pnpm --filter @ple/worker test
pnpm build
```

Run `pnpm --filter @ple/worker test` and `pnpm build` when worker, shared package, export, connector, or generated output code changes. For a narrow artifact-only visual patch, `pnpm --filter @ple/artifact build` is the minimum local gate.

Browser proof:

- Start the local artifact server or use a preview deployment.
- Test widths: 1440 x 1000, 1180 x 900, 820 x 900, 430 x 932, 390 x 844, 360 x 740.
- Check browser console for runtime errors.
- Assert `document.documentElement.scrollWidth <= document.documentElement.clientWidth` unless a deliberate contained scroller is active.
- Click every CTA in the CTA Matrix Scaffold.
- Capture screenshots for annotated regions, dashboard, DocPrep, report packet, outreach, settings, and walkthrough.

Live proof:

- Deploy the scoped S28 changes.
- Alias to `https://heirright-leads.vercel.app/`.
- Fetch the live root and compare it to the built artifact by hash or an equivalent immutable marker.
- Re-run the CTA and responsive smoke checks against the live alias.
- Fetch `/api/connections/status` and keep any blocked external access visible in the closeout.

Closeout packet:

- branch and commit/deploy reference
- build/test command results
- live alias proof
- screenshots or browser notes for desktop and mobile
- CTA matrix with pass/blocker notes
- connector status response summary
- remaining external blockers in plain language
- `/solvys-heir-audit` verdict

## Requirement Coverage Audit

| User requirement | S28 ticket/block | Completion evidence |
| --- | --- | --- |
| Active-process and Needs Attention accuracy | S28-02, Block 2 | source trace, rendered dashboard proof, CTA card proof |
| Replace placeholders with real data | S28-02, S28-03, Block 2 | current-run/source audit plus UI screenshots |
| All CTA buttons function | S28-03, CTA Matrix, Block 2 | clicked CTA matrix with pass/blocker notes |
| Finish product loop and annotations | S28-01 through S28-10 | annotation log plus end-to-end browser proof |
| Both document-prep workflows end to end | S28-04, Block 2 | Estate Discovery and Closing Prep browser/reload/export proof |
| Visual review desktop and mobile | S28-01, S28-09, Blocks 1 and 5 | required-width screenshots and overflow assertions |
| Full QA for content falling off screen | S28-09, QA runbook | viewport checks at 1440, 1180, 820, 430, 390, and 360px |
| Outreach with open-source Podio bridge and fallback | S28-06, Block 3 | Activepieces/Podio readback or fallback blocked-live-sync proof |
| Completed report packet as PDF with Date Added dropdown | S28-05, Block 2 | report packet viewport proof and dropdown behavior proof |
| Notes/blockers below PDF viewport | S28-05, Block 2 | screenshot/browser DOM proof |
| Review all annotations before implementation | Block 0, Annotation Log | every batch appended with acceptance tests |
| 99.9% complete shipment posture | Blocks 0-6, Evidence Register | closeout packet proves every non-external gate |
| Clerk/team IDs only if required | S28-07, Block 3 | auth decision note and office-user setup proof |
| Non-admin office user out of the box | S28-07, S28-08 | walkthrough proof and client-facing language audit |
| Product demo and guided walkthrough | S28-08, Block 4 | start/next/skip/replay proof on desktop/mobile |

Current planning verdict:

- Covered enough to start implementation after annotation intake.
- Not complete enough to close the active goal as fully achieved because remaining annotation batches have not arrived.
- No implementation should claim live Podio, Google, SMS, Resend, or paid-source completion without credentialed readback evidence.

## Execution Lanes

### Lane A - Real Data And Dashboard Accuracy

- Trace every active-process and Needs Attention card to the current run, batch, document, integration, and operator-queue state.
- Remove or relabel placeholder text. If data is absent, show the real absent state with the next required action.
- Cross-check these sources:
  - latest lead run JSON
  - latest fresh-lead batch
  - document-prep state
  - CRM handoff state
  - `/api/connections/status`
  - current integration blockers
- Acceptance: a non-admin office user can tell what is active, what is blocked, who owns the next step, and what to click next.

### Lane B - CTA And Product Loop Matrix

Build and verify a CTA matrix for:

- top bar: Import, Prep export, Report, Save search, Activity, Load latest
- dashboard: active process cards, Needs Attention items, queue chips, refresh/load controls
- lead review: flag, export, source review, status transitions
- document prep: start, add, preview, complete, blocker, official record, packet review
- report packet: select date added, view PDF, export/download, notes/blockers
- outreach: draft, approve, queue, sync, send/setup blocker, Podio handoff
- CRM: field mapping, handoff, readback, export
- settings/connectors: connect, test, explain blockers, retry
- guided demo: walkthrough start/next/skip/replay

Acceptance: every CTA either performs the expected action, navigates to the right panel, creates/updates real state, exports a real artifact, or displays a specific credential/setup blocker.

### Lane C - Document Prep Workflows

Workflow 1: Estate Discovery / Discovery Dossier

- Verify source facts, source notes, title/deed notes, tax history, probate request, heir contact matrix, outreach drafts, drip schedule, and CRM handoff stages.
- Make status transitions reload-safe and tied to real run data.
- Ensure packet generation, preview, completion, and blockers reflect current facts.

Workflow 2: Closing Prep / Closing Packet

- Verify deed/title review, document request, closing-template family mapping, signature/readback checklist, and final packet review.
- Make closing status independent from discovery status while keeping shared lead context.
- Ensure production language fits office operations and does not overpromise legal completion.

Acceptance: both workflows can be started, reviewed, advanced, blocked, unblocked, and exported without losing state on reload.

### Lane D - Completed Report Packet PDF

- Replace the current six-card report cover with a Date Added dropdown at the top of the report packet view.
- Render the completed report packet as a PDF-style viewport or actual PDF artifact, not just scattered HTML summary cards.
- Keep notes and blockers below the PDF viewport.
- Preserve the export/download path.
- Verify the selected Date Added option changes the report context predictably.

Primary seam found:

- `probate-lead-engine/apps/artifact/src/index.html`, `railDocsHtml`
- Current report cover selector: `.report-cover`

Acceptance: a user sees a report packet first, chooses the Date Added property from a dropdown, then sees notes/blockers below the viewport.

### Lane E - Outreach And Podio Automation

Primary open-source bridge candidate: [Activepieces](https://github.com/activepieces/activepieces) with its [Podio integration](https://www.activepieces.com/pieces/podio).

Why this fits:

- Activepieces is an open-source automation platform with a Podio piece.
- The Podio piece exposes useful triggers and actions: new item, item updated, create item, update item, create task, update task, attach file, create comment, create status update, find item, find task, and custom API call.
- Podio's own docs confirm OAuth2 and app-auth flows, including app authentication for automated scripts and item creation through `POST /item/app/{app_id}/`.

Implementation path:

- Add connector settings for Activepieces webhook/base URL and Podio target IDs.
- Add an outreach queue with approval gates, no-send guardrails, and deterministic retry/error state.
- On approve, write a queued outreach action to Activepieces/Podio when credentials are present.
- Store the remote item/task/comment IDs returned by the integration.
- Read back the created/updated Podio object before marking sync complete.
- If Activepieces cannot be connected, fall back to an Architecturally Free Outreach tab:
  - local approved queue
  - CSV/JSON export
  - copy-safe email/SMS drafts
  - Podio-ready field mapping
  - no live-send claim

Acceptance: outreach is end-to-end for the available environment. With credentials, it writes and reads back through Podio. Without credentials, it remains operational, exportable, and explicit about the blocked live-send step.

Sources:

- [Activepieces repository](https://github.com/activepieces/activepieces)
- [Activepieces Podio integration](https://www.activepieces.com/pieces/podio)
- [Podio API docs](https://developers.podio.com/doc)
- [Podio authentication docs](https://developers.podio.com/authentication)
- [Podio add item endpoint](https://developers.podio.com/doc/items/add-new-item-22362)

### Lane F - Guided Demo And First-Run Walkthrough

- Add a guided walkthrough launcher.
- Add pop-up tips next to each primary tab.
- Keep tips short and tied to actual actions, not generic product marketing.
- Persist dismissed state locally for non-admin office users.
- Add a replay entry in the app chrome or help area.

Acceptance: a first-time user can complete the demo path without needing admin instructions.

### Lane G - Visual And Responsive QA

Widths to verify:

- 1440 x 1000 desktop
- 1180 x 900 narrow desktop
- 820 x 900 tablet
- 430 x 932 large mobile
- 390 x 844 mobile
- 360 x 740 thin mobile

Checks:

- no horizontal overflow unless a deliberate data table has a contained scroller
- no clipped CTA text
- no overlapping status/action regions
- no layout shift from hover/focus states
- icon buttons stay stable in fixed-size hit areas
- cards and panels respect their containers
- report PDF viewport and notes/blockers remain stacked correctly
- document-prep rows keep aligned action clusters

## Proof Gates

Local build and tests:

- `pnpm --filter @ple/artifact build`
- Worker/API tests if backend or connector code changes.
- Full build command if shared package boundaries are touched.

Browser proof:

- Exercise the full loop in a local or preview URL.
- Capture desktop and mobile screenshots after fixes.
- Check console for runtime errors.
- Programmatically assert no page-level horizontal overflow at the required widths.
- Click every CTA in the matrix and record behavior.

Live proof:

- Deploy the scoped artifact to Vercel.
- Alias and verify `https://heirright-leads.vercel.app/`.
- Confirm live source/build hash or equivalent artifact identity.
- Re-run browser proof against the live alias.
- Re-check `/api/connections/status`.
- If credentials are absent, report exact external blockers instead of calling integrations complete.

## External Gates That Cannot Be Faked

- Live Podio write/readback needs approved Podio app credentials and target app IDs.
- Google Workspace readback needs approved OAuth/configured Sheet access.
- Resend and SMS need approved sender credentials and internal-test approval.
- IDI paid proof and legal/closing-document approval remain client-side gates unless supplied.

The app can be production-grade around these gates by being explicit, operational, exportable, and fail-closed. It cannot truthfully mark live external automation complete until the relevant readback succeeds.

## Definition Of Done

- All received annotations are closed or explicitly documented with a blocker.
- Dashboard and Needs Attention show real current data.
- Both document-prep workflows run end to end and reload safely.
- Completed report packet opens as a PDF-oriented packet view with Date Added dropdown and notes/blockers below.
- Outreach works through Activepieces/Podio when configured and falls back to the Architecturally Free Outreach path when not configured.
- Every CTA has a verified behavior.
- Guided demo and tab tips work.
- Desktop and mobile QA pass without visible alignment defects or content falling off screen.
- Live `heirright-leads.vercel.app` proof is captured after deployment.
