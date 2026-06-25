# 2026-06-24 HeirRight Run Point

## Sprint

S21 Discovery Dossiers Product Loop

## Opening Audit

- Work surface: canonical repo `/Users/tifos/Documents/Codebases/heir-right`, artifact app `probate-lead-engine/apps/artifact/src/index.html`.
- Prompt source: browser comments against `https://heirright-landing-demo.vercel.app/` plus `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf`.
- Source packet read: extracted workflow text from `/Users/tifos/Desktop/HRight/tmp/extracted/HeirRight_Workflow__pdf.txt` and `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.
- Design gates read: `/Users/tifos/Documents/Codebases/solvys-skills/Design.md` and `/Users/tifos/.codex/skills/solvys-feels/SKILL.md`.
- Existing dirty state preserved: artifact build/server/index changes, root package dependency update, lockfile update, artifact API folder, and Vercel config.

## Progress Log

- Created S21 brief at `sprint-md/S21-BRIEF-discovery-dossiers-product-loop.md`.
- Confirmed `/Users/tifos/Desktop/HRight` is not a git repo and the canonical implementation repo is `/Users/tifos/Documents/Codebases/heir-right`.
- Reworked artifact navigation into Dashboard, Find Estates, Dossiers, Drips, Queue, Admin, and Settings.
- Added Dashboard task tracker, Dossiers document workspace, Drips prep, Queue batch prep, Admin wrapper/readiness, and Settings preference panels.
- Replaced the report rail chip strip with a Discovery fuse, percentage/phase display, and Begin Discovery CTA.
- Added a full-rail guided Discovery workflow with phase steps, preferences, notes, completion, and close-after-complete behavior.
- Fixed the rail outside-click handler after browser verification found the Discovery wizard was being closed by a stale click path after re-render.

## Guardrails

- No live outreach, production Podio write, paid-source automation, legal claims, or live-readiness claims without approval and readback proof.
- Client-facing copy must stay in plain real estate workflow language.
- Dossiers must be a product loop surface, not another report-rail view.

## Validation

- `pnpm --filter @ple/artifact build` passed.
- `pnpm build` passed.
- Local review server ran with `AUTH_REQUIRED=false` on `http://localhost:4173`.
- Browser verification with system Chrome and Playwright passed:
  - Sidebar order: Dashboard, Find Estates, Dossiers, Drips, Queue, Admin, Settings.
  - Find Estates header measured 141px after trimming.
  - Report rail opened on a real loaded row and showed the Discovery fuse, 0% owner/property phase, and Begin Discovery CTA.
  - Begin Discovery opened the full-rail wizard; notes entry, Complete Phase, Close Discovery, and post-close fuse progress all worked.
  - Dossiers hid the report rail, showed 6 document cards, embedded the document reader, selected Probate Document Request, and opened a pop-out Discovery Dossier window.
  - Drips rendered the OpenCodeGo direct API wrapper.
  - Queue staged a batch prep action.
  - Mobile fresh load at 390px had no horizontal overflow and opened Dashboard with the sidebar hidden as expected.
  - Browser console/page errors: none.
- Production deploy:
  - First deploy failed because the pre-existing Vercel config referenced `api/**/*.js` without root-level API functions.
  - Added root Vercel wrappers for `/api/connections/status`, `/api/leads/fresh-batch`, `/api/exports`, and `/auth/*`.
  - Added an inline favicon to remove the browser `/favicon.ico` 404.
  - Final deployment `dpl_9RwEgXeg2KF4gFJayDiM4PYUnd94` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live browser verification on the alias passed with Dashboard, Find Estates, Discovery wizard, Dossiers reader, 6 dossier documents, report rail hidden in Dossiers, no console errors, no page errors, and no 4xx responses.

## /solvys-heir-audit

Source checked: `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf` extracted text, HeirRight deal-flow checklist, current artifact UI, local rendered browser proof.

Backward: Built the product loop around Dashboard, Find Estates, Dossiers, Drips, Queue, Admin, and Settings; added the Discovery fuse and guided dossier workflow for owner/property, tax, court/probate, heirs/contact, manual research, document prep, and CRM handoff phases; added Dossiers document selection, embedded reader, and pop-out without using the report rail; kept drips, queue, Podio, and OpenCodeGo wrapper states review-only.

UX pass: aligned with gaps. The client can use the guided UI tomorrow for review/demo, but live Podio writes, live outreach, paid-source automation, and real Hermes/cloud cron execution remain explicitly blocked until credentials and approval exist.

Forward: Next safe work is to attach the seven to ten real document templates/examples arriving in the morning to the Dossiers document model and wire approved Podio readback only after credentials and controlled-write approval.

Alignment: aligned with gaps

Required corrections before complete:
- none local; external blockers remain credentials, approval, and incoming document examples.

## Visual-System Addendum

- Applied the blended-backdrop correction from browser annotations across the artifact app, using `#202124` for the sidebar cap, sidebar navigation rail, results toolbar, table header, workbench, product-loop tabs, and structural app surfaces.
- Replaced the remaining spotty light panel fills with tinted dark Liquid Glass cards, fading divider rules, and transparent alternative actions; preferred actions remain glass or primary CTA surfaces.
- Added a local Nucleo-style line icon resolver for the product-loop sidebar and Dashboard tracker icons without adding a remote icon runtime.
- Extended the treatment to popovers, activity drawer rows, rail context plates, settings controls, selected row indicators, and mobile breakpoints.
- Verification:
  - `pnpm build` passed after the patch.
  - Local Chrome/Playwright verification passed across Dashboard, Find Estates, Dossiers, Drips, Queue, Admin, and Settings with no console/page errors.
  - Mobile 390px verification passed with Dashboard collapsed to one column and no horizontal overflow.
  - Production deployment `dpl_3Pa1Qd12W584dJzNB2dNhKiLG2Ci` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias verification confirmed `.sidebar-top`, `.nav-list`, `.results-toolbar`, and `thead tr` compute to `rgb(32, 33, 36)` and the Dashboard/Dossiers product-loop surfaces still render without the report rail in Dossiers.
- Follow-up annotation batch:
  - Hardened `#dossiersView`, `.sidebar-top`, `.nav-list`, and `.sidebar-footer` to `#202124`.
  - Hardened every Dossiers document card, including selected state, to `#262626`.
  - Production deployment `dpl_Ck2PNfvZZ4bkjiAH4RD49FQvcaKt` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias verification confirmed the annotated Dossiers/sidebar selectors compute to the requested colors with no console/page errors.
- Header hierarchy follow-up:
  - Set the Dossiers result count to `#616161` at `0.5` opacity.
  - Set the Dossiers reader lead/title header text to `#787878`.
  - Production deployment `dpl_H5Bq2xbCezVfQryh8PVyrZNfJe7j` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias verification confirmed the annotated header selectors compute to the requested colors with no console/page errors.

## HEI-001 Run-Point Continuation

- Branch: `v2.5.4/heirright-discovery-dossiers-2026-06-24`.
- Pushed remote branch: `origin/v2.5.4/heirright-discovery-dossiers-2026-06-24`; implementation closeout commit `a858196` is included, followed by handoff bookkeeping.
- Previous-day touchups reviewed:
  - `docs/run-point-daily/2026-06-23-heirright-live-leads.md`: live Miami-Dade fresh-batch loop was implemented and proved with non-placeholder leads.
  - `docs/run-point-daily/2026-06-23-heirright-podio-ui-test.md`: UI-driven controlled Podio test export is wired, but live delivery remains blocked by missing Podio config and approval.
  - Linear live read failed with `oauth_token_invalid_grant`; repo-local tickets and handoff notes remained the fallback source.
- Sprint or milestone batches worked:
  - S21 Discovery Dossiers Product Loop: repo-verified current branch tip and rendered Dashboard color follow-up.
  - S21 production-hosting hardening: validated artifact build/server fallback changes that let API routes serve built `dist` outputs when worker output files are absent in the deployed artifact context.
- Tickets touched:
  - Repo-local S21 brief and daily handoff only; no live Linear mutation because reauthentication is required.
- Repo evidence:
  - `probate-lead-engine/apps/artifact/build.js` copies `fresh-lead-batch.json` and can derive built `latest-run.json` / `daily-run.json` from the fresh batch when present.
  - `probate-lead-engine/apps/artifact/server.js` exports `handleRequest` for Vercel wrappers and checks built `dist` files as fallbacks for latest run, daily run, qualification review, readback evidence, milestone evidence, and review script routes.
  - Root Vercel wrappers under `probate-lead-engine/api/` were already committed on this branch.
  - Existing uncommitted `postgres` dependency and duplicate `probate-lead-engine/apps/artifact/api/` wrappers were not treated as validated S21 work; they remain separate dirty state unless a later pass confirms they are needed.
- Validation commands and results:
  - `pnpm build` from `probate-lead-engine/`: passed.
  - `pnpm --filter @ple/worker test`: passed with `ok: true`, 49 facts, and refreshed worker outputs.
  - `pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"`: passed with `status: ready_for_review`, `operatorQueueState: manual_review`, and source-evidence review flags preserved.
  - `pnpm --filter @ple/artifact build`: passed and wrote `apps/artifact/dist/index.html`.
  - Local server `AUTH_REQUIRED=false PORT=4175 pnpm --filter @ple/artifact dev`: passed after port 4173 was already occupied.
  - `curl` checks against `http://localhost:4175/health`, `/latest-run.json`, and `/api/connections/status`: all returned `200`.
  - `apps/artifact/dist/latest-run.json` exists and resolves to the live external Hawkins dossier from the previous fresh-batch proof.
  - Headless Chrome screenshot `/tmp/heirright-dashboard-2026-06-24.png`: Dashboard rendered with dark hardening, readable task panels, and no visible text overlap at 1440px.
- Source packet boundary:
  - Canonical repo path `HeirRight Workflow. pdf.pdf` is still missing.
  - Fallback source checked: `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf` extracted text and `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.
  - Example packet checked: `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`; the packet shape still requires tax payer, deed/title, probate, heirs, offer/profit, and backstory evidence before a lead can be treated as complete.

## /solvys-heir-audit - Run-Point Continuation

Source checked: fallback workflow PDF extracted text, Amaranthe example packet text, HeirRight deal-flow checklist, S21 brief, June 23 and June 24 handoff notes, current repo diff.

Backward: Verified S21 product-loop and hosting-hardening work against the workflow steps it supports: operator dashboard triage, Find Estates source review, Discovery Dossier phases for owner/property, tax, deed/title, court/probate, heirs/contact, manual research, document prep, and CRM handoff. The dry-run stayed in manual review and did not promote a generic seed as a qualified lead.

UX pass: aligned with gaps. Dashboard and dossier surfaces are operator-readable and avoid developer-console language, but live Podio write/readback, live outreach, paid/manual source automation, and legal/compliance claims remain blocked.

Forward: Next work should attach the real incoming document templates/examples to the Dossiers model and complete controlled Podio readback only after credentials, test contact values, and explicit live-write approval are present.

Alignment: aligned with gaps.

Required corrections before complete:
- Keep Linear reauthentication, Podio credentials/config, controlled live-write approval, Google destination config, and canonical workflow PDF placement as blockers.

## 11 AM Review Packet

What was done:

- S21 product-loop work was verified on the existing same-day branch.
- Artifact hosting fallback behavior was validated locally so built review outputs can be served by the artifact API path.
- Required worker and artifact smoke gates passed.
- Source review stayed tied to the HeirRight workflow packet and Amaranthe completed-lead shape.

What was not done:

- No live Podio card was created.
- No Google Workspace export was created.
- No live outreach, paid-source automation, legal claim, or production CRM write was attempted.
- Live Linear issue updates were not possible because the app connection needs reauthentication.

What needs Sam's review:

- Reauthenticate Linear for the HeirRight workspace if live ticket updates are needed.
- Provide Podio credentials/config, controlled test phone/email, lead point profile ID, and explicit live-write approval before another controlled Podio readback.
- Confirm the real document templates/examples that should populate the Dossiers document model.
- Place the canonical workflow PDF in the repo path if the audit source should stop depending on the Desktop fallback.

Tomorrow's recommended sprints:

- Finish the Dossiers document-template attachment pass using the real examples.
- Then run the controlled Podio readback sprint only if credentials and live-write approval are available; otherwise continue with document packet/readback-proof surfaces that remain prep-only.
- Dashboard discoloring follow-up:
  - Hardened `#dashboardView` to `#202124`.
  - Hardened Dashboard loop panels and preferred suggestion chips to `#262626`, leaving tracker/drip rows transparent so fading divider lines carry hierarchy.
  - Kept secondary Dashboard actions unbordered/transparent.
  - Production deployment `dpl_Fck4yTE85HsLo6r14DeXFWP1Pm4z` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias verification confirmed Dashboard canvas `rgb(32, 33, 36)`, loop panels `rgb(38, 38, 38)`, suggestion chips `rgb(38, 38, 38)`, transparent tracker rows, and no console/page errors.
- Ten-document packet follow-up:
  - Expanded Dossiers from 6 documents to 10 documents: Discovery Dossier, Completed Lead Report, Source Notes, Deed & Title Notes, Tax History Packet, Probate Document Request, Heir Contact Matrix, Outreach Drafts, Drip Schedule, and CRM Handoff.
  - Added rendered reader/pop-out bodies for Deed & Title Notes, Tax History Packet, Heir Contact Matrix, and Drip Schedule.
  - Updated Dashboard milestone copy to call out the 10-document dossier packet.
  - Production deployment `dpl_51cP2QdQA574TgW9CS1H9nyBEFH8` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias verification confirmed 10 Dossier document cards, added-document selection into the embedded reader, no report rail in Dossiers, Dashboard 10-document packet copy, no console/page errors, and no mobile horizontal overflow at 390px.
- Operator-language audit follow-up:
  - Replaced exposed Drips/Admin wording like "direct API", "wrapper", and "cloud artifact" with operator-facing scheduled-work prep language while preserving OpenCodeGo and Hermes approval truth.
  - Added an operator-facing connection-message translation layer so raw setup variables such as Podio/Google environment names do not appear in Admin readiness, footer titles, or accessibility labels.
  - Production deployment `dpl_9veNZSru74k1HFRHqE6WMaitdpfb` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias verification confirmed no `PODIO_*`/`GOOGLE_*` setup strings, no old wrapper/API phrases, plain Podio/Google prep-only status, OpenCodeGo/Hermes review-route copy retained, and no console/page errors.

## /solvys-heir-audit Closeout

Source checked: `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`, current artifact source, local rendered browser proof, and live Vercel alias proof.

Backward: The latest pass cleaned Drips/Admin automation copy and connection readiness messages so the workflow reads as scheduled follow-up prep, CRM handoff prep, contact approval, and confirmation rather than integration plumbing. This supports S8 outreach/no-auto-send guardrails and S9 Podio/workflow-loop adoption without implying live sends or production CRM writes.

UX pass: aligned. The operator now sees concrete work states: review-only, no live send, CRM handoff prep-only, one approved test card, and confirmation needed.

Forward: Next work should attach the incoming client-provided document examples/templates to the 10-document packet and replace generic packet bodies with final client-specific forms.

Alignment: aligned with gaps

Required corrections before complete:
- Incoming client document examples/templates are still external inputs for the final production packet.
- Clean-tree deploy and health follow-up:
  - Removed the stale local `postgres` dependency change and duplicate untracked artifact-level API shims from the working tree; the tracked root `api/` wrappers are the Vercel production route source.
  - Added a tracked `/api/health` wrapper and `/health` rewrite so production health checks match the local artifact server.
  - Production deployment `dpl_GADV1RFY5U24LXgURAmqoAfWRtqZ` proved the clean tracked tree deploys and removed `postgres` during Vercel install.
  - Production deployment `dpl_Ak5mZCu4bFtvM1CzzuBSkZkryQ23` is aliased to `https://heirright-landing-demo.vercel.app` with `/health` returning 200.
  - Live alias verification confirmed `/health`, `/api/connections/status`, and `/api/exports` return 200; Dossiers still renders 10 documents without the report rail; Admin/Drips operator copy stays sanitized; and no console/page errors occurred.
- Discovery workflow persistence follow-up:
  - Persisted the guided Discovery workflow state in local browser storage: current phase, completed phases, operator notes, and per-phase preference controls now survive reloads and closing the wizard.
  - Fixed the Discovery step-status display so a phase only marks its own steps complete after that phase is complete, instead of inheriting done states from the total completed-phase count.
  - Local proof:
    - `pnpm build` passed.
    - `pnpm --filter @ple/artifact build` passed.
    - Browser proof on the local artifact server completed Owner and Property, saved preference toggles and notes, advanced to Tax History, reloaded, and reopened Discovery with the Tax History phase, notes, preferences, completed phase, and 14% progress intact.
  - Production deployment `dpl_BLEFnaVykfsQ4JRgqY5zuEQYAdFQ` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof confirmed the same Discovery persistence behavior on the public URL with no console/page errors.
  - Live Dossiers regression after the Discovery deploy confirmed Dossiers still opens as the active product-loop view, renders 3 leads and 10 documents, keeps the report rail closed, updates the embedded iframe reader when selecting Tax History Packet, and reports no console/page errors or 4xx responses.

## /solvys-heir-audit Discovery Persistence Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local browser proof, and live Vercel alias proof.

Backward: Discovery now preserves operator preferences, notes, current phase, and completed phases for the dossier-preparation workflow. This keeps owner/property and tax-history work from being lost when the operator closes the wizard or reloads before handoff.

UX pass: aligned with gaps. Preference controls are stateful, close-after-complete remains available, and Dossiers continues to keep finished documents inside the product loop without exposing the report rail.

Forward: The next production pass should replace the generic packet bodies with the client-provided seven to ten document examples/templates when they arrive.

Alignment: aligned with gaps

Required corrections before complete:
- Incoming client document examples/templates remain external inputs for the final comprehensive packet.
- Drips scheduled-work and product-loop backdrop follow-up:
  - Hardened Drips, Queue, Admin, and Settings product-loop surfaces to the same `#202124` app backdrop and `#262626` loop-panel treatment already applied to Dashboard and Dossiers.
  - Expanded Drips from a static prep list into a chatless scheduled-work control surface:
    - Prepared drip sequences now reflect saved start delay, SMS cap, court-packet gate, no-contact hold, and review-owner gate.
    - Added OpenCodeGo scheduled checks for Discovery dossier review, court packet review, and drip draft preparation while keeping Hermes as a later approved route.
    - Added local preference controls and an operator note field; all persist in browser storage under `heirright:drip-settings`.
    - The Dashboard Drips widget and the Dossier "Drip Schedule" embedded document now read from the same saved controls.
  - Local proof:
    - `pnpm build` passed.
    - Browser proof on `http://localhost:4173` confirmed Drips canvas `rgb(32, 33, 36)`, Drips panels and setting cards `rgb(38, 38, 38)`, 6 Drips controls, 3 scheduled checks, saved next-business start delay, 3-SMS cap, court-packet override, operator note persistence after reload, Preview next check activity, Dashboard Drips reflection, and Dossier Drip Schedule iframe updates with the report rail closed.
    - Malformed local Drips storage self-heals to bounded values: known start delay, 1-4 SMS cap, boolean gates, and 500-character operator note.
    - Mobile proof at 390px confirmed Drips has no horizontal overflow and still renders 6 controls.
  - Production deployment `dpl_9AdFw9ucG1QhcwwxtTdtWZKMqQyD` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof confirmed the same Drips styling, storage self-healing, persistence, Dashboard reflection, Dossier iframe propagation, report-rail lockout in Dossiers, no console/page errors, no 4xx responses, no visible `CRM write` phrasing, and no mobile horizontal overflow at 390px.

## /solvys-heir-audit Drips Scheduled-Work Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local browser proof, live Vercel alias proof, and production deployment metadata.

Backward: This pass strengthens S8/S9 workflow support without claiming live sends or live CRM card creation. Drips now behaves like a scheduled-work prep surface for dossier review, probate/court packet checks, and follow-up draft preparation, while preserving operator review, no-contact holds, owner stop rules, and CRM readback boundaries.

UX pass: aligned with gaps. The operator sees saved cadence controls, scheduled checks, next action preview, and Drip Schedule document output in plain real estate workflow language. The remaining gap is not UI mechanics; it is the real client-provided document examples/templates and approved CRM/outreach credentials.

Forward: Attach the incoming client examples to the 10-document packet and only then run any controlled Podio/readback work if credentials and explicit approval are available.

Alignment: aligned with gaps

Required corrections before complete:
- Incoming client document examples/templates remain external inputs for the final comprehensive packet.
- Live outreach and production CRM card creation remain locked until credentials, approval, and readback proof exist.

- Blended backdrop visual follow-up:
  - Collapsed the dark theme substrate and glass tint source to `#202124` so the app no longer mixes `#1c1c1e`, `#2c2c2e`, `#202124`, and `#262626` across the main work areas.
  - Moved Dashboard, Drips, Queue, Admin, Settings, and Dossiers structural panels to the same `#202124` backdrop with fading divider lines and rounded iOS-style panel borders.
  - Kept dossier document tiles as the annotated `#262626` document controls, while leaving dashboard rows transparent and using subtle liquid-glass treatment only for preferred productivity chips and the search control.
  - Local proof:
    - `pnpm build` passed.
    - Browser proof on `http://localhost:4173` confirmed Dashboard panels, Dossiers view, Dossier list panel, and Dossier reader panel compute to `rgb(32, 33, 36)`.
    - Dashboard rows compute transparent with divider hierarchy; suggestion chips keep a subtle glass fill on the same dark substrate; search control computes to `rgba(32, 33, 36, 0.78)`.
    - Dossiers loaded 3 rendered rows and 10 document controls, selected Tax History Packet into the embedded reader, and kept the report rail closed.
    - Clean browser pass reported no console/page errors and no failed responses.

## /solvys-heir-audit Blended Backdrop Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local Chrome browser proof, and existing run-point deployment notes.

Backward: This pass supports the product-loop UX around S7/S8/S9 by making the Dashboard and Dossiers work areas read as one organized real estate workbench instead of separate gray blocks. It preserves the dossier document controls and the Dossiers no-report-rail loop while reducing visual noise for a non-technical operator.

UX pass: aligned with gaps. The operator sees one dark-gray surface, fading hierarchy lines, clear selected document controls, and subtle preferred-action glass without extra developer-facing language.

Forward: Deploy the blended backdrop pass, then re-run live alias proof and keep the remaining gaps limited to incoming client document examples/templates and approved CRM/outreach credentials.

Alignment: aligned with gaps

Required corrections before complete:
- Incoming client document examples/templates remain external inputs for the final comprehensive packet.
- Live outreach and production CRM card creation remain locked until credentials, approval, and readback proof exist.
- Dossier document language cleanup follow-up:
  - Replaced raw object-shaped source fact rendering in Source Notes and Tax History Packet with plain operator-readable field labels and values.
  - Replaced raw Podio setup names in the CRM Handoff document and report-rail handoff readiness with plain labels: Podio access, Podio Leads app, and Podio field map.
  - Updated the CRM Handoff document boundary copy to say no live Podio card is created until credentials, approval, and readback proof exist.
  - Local proof:
    - `pnpm build` passed.
    - Browser proof on `http://localhost:4173` confirmed Source Notes and Tax History Packet no longer render JSON-shaped fact values, CRM Handoff no longer renders raw `PODIO_*` setup names, the report-rail Docs tab shows plain setup labels, and Dossiers keeps the report rail closed.
  - Production deployment `dpl_2Z79yvkY37UNYkDDueMvr99PEYV4` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof confirmed Source Notes, Tax History Packet, CRM Handoff, and the report-rail Docs tab avoid JSON-shaped fact output, raw Podio setup names, and "Live write" wording; `/health` returned 200 and no console/page errors or 4xx responses occurred.

## /solvys-heir-audit Dossier Document Language Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local browser proof, live Vercel alias proof, and production deployment metadata.

Backward: This pass supports S7/S9 by making the generated Dossier documents and report-rail handoff readiness readable to a real estate operator. Source facts now read like field notes instead of raw data, and CRM Handoff shows plain Podio setup needs without implying a live card was created.

UX pass: aligned with gaps. The operator can read Source Notes, Tax History, and CRM Handoff without developer terminology, while the app still preserves review-only boundaries.

Forward: Attach the incoming client examples/templates to the 10-document packet and run a controlled Podio readback only after credentials and explicit approval exist.

Alignment: aligned with gaps

Required corrections before complete:
- Incoming client document examples/templates remain external inputs for the final comprehensive packet.
- Live outreach and production CRM card creation remain locked until credentials, approval, and readback proof exist.

- North Star dossier rail follow-up:
  - Copied the client-provided Deborah Cheatham and Constance E. White family-tree PDFs into `docs/north-star-packets/` as durable reference anchors.
  - Added `docs/north-star-packets/README.md` to capture the report structure these packets anchor: property identity, date-added metadata, Offer / Profit math, owner DOB/DOD and obituary status, back story, public-record notes, heir/contact matrix, and Podio / Google Docs / Google Sheets export posture.
  - Moved Dossiers document review out of the main Dossiers canvas and into the right-side rail, sharing the Report rail mechanics while keeping the normal report rail out of the Dossiers product loop.
  - Added a North-Star-style Completed Lead Report renderer in the Dossier rail with Offer / Profit table, Back Story, source review checklist, contact matrix, Podio fields, Google Sheets row, and explicit review-only export gates.
  - Dashboard annotation fixes: Activities / Drips subtab content now transitions, the Recent Activity CTA reads `Open Estate Search`, and Suggestions now reads `Next Actions`.
  - Local proof:
    - `pnpm build` passed.
    - Browser proof on `http://localhost:4173` confirmed Dashboard subtab animation `loopSubtabIn`, `Open Estate Search`, `Next Actions`, Dashboard panel backdrop `rgb(32, 33, 36)`, Dossiers `data-mode="dossier"` rail open with 10 document controls, no Dossier reader/doc grid inside the main Dossiers view, and normal Report rail still available only from Find Estates.
    - Iframe proof confirmed the Completed Lead Report `srcdoc` contains North Star anchors, Offer / Profit Table, Back Story, Podio Lead Fields, Google Sheets Row, and `$100,000 Net`.
    - Row-switch proof confirmed clicking Bryant changes the Dossier rail context and keeps the rail open; pop-out proof confirmed the separate document window contains the North Star Completed Lead Report.
    - Mobile render proof at 390px confirmed the Dossier rail renders 10 docs with no horizontal overflow.
    - Production deployment `dpl_DBtm2JqEFPiPzcKrjaB6RpcQea2b` is aliased to `https://heirright-landing-demo.vercel.app`.
    - Live alias proof confirmed `/health` 200, Dashboard subtab animation/copy, Dossier `data-mode="dossier"` rail open with 10 docs and no main-view reader, Completed Lead Report North Star sections, row switching, pop-out rendering, normal Report rail isolation in Find Estates, no console/page errors, and no failed responses.

## /solvys-heir-audit Sidebar Divider Polish Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local rendered proof, and current Queue/sidebar screenshot annotation.

Backward: This pass supports the operator workbench polish track by removing the fading divider under the collapsed sidebar top control while leaving content-section hierarchy dividers intact.

UX pass: aligned. The annotated top-left sidebar line is gone; Queue content cards, toolbar controls, and section dividers still render normally. The annotated Drips, Queue, and Admin sidebar icons now use clearer scheduled-drip, batch-tray, and admin-shield glyphs.

Forward: Deploy the visual polish pass and verify the live alias.

Alignment: aligned

Required corrections before complete:
- None for this visual correction. Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked behind approved access and readback proof.

Proof:
- `pnpm build` passed from `probate-lead-engine/apps/artifact`.
- `git diff --check` passed.
- Local rendered proof at 1230x994 confirmed `.sidebar-top::after` has `content: none`, Queue remained visible, and no console/page errors fired. Screenshot saved to `/tmp/heirright-sidebar-line-removed-local.png`.
- Local rendered proof at 1230x994 confirmed Drips/Queue/Admin hydrate to `scheduled-drips`, `batch-tray`, and `admin-shield`, the Queue view remained usable, the sidebar divider remained removed, and no console/page errors or failed responses fired. Screenshot saved to `/tmp/heirright-sidebar-icons-local.png`.
- Production deployment `dpl_DQqc2hdHWYVzasrZrCJxqQ2CbmQq` is aliased to `https://heirright-landing-demo.vercel.app`.
- Live alias proof at 1230x994 confirmed `.sidebar-top::after` has `content: none`, Drips/Queue/Admin hydrate to `scheduled-drips`, `batch-tray`, and `admin-shield`, Queue opened to `Batch handoff prep`, and no console/page errors or failed responses fired. Screenshot saved to `/tmp/heirright-sidebar-icons-live.png`.

## /solvys-heir-audit Dossier Batch Selection And Table Alignment Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local rebuilt browser proof, and current Dossier/Queue product loop.

Backward: This pass supports S7/S9 by fixing the Dossiers list row shift, adding real checkbox-based lead selection, and turning the top export control into batch export mode when leads are selected. The dropdown now starts with `Add to Queue`, and the Queue tab displays queued leads instead of pretending every lead is already queued.

UX pass: aligned with gaps. Root cause was a generated `::before` divider on `.dossier-table tr + tr`, which the browser treated like an extra table cell and shifted every row after the first. The Dossier table now uses fixed columns with no phantom table-cell divider. Current/open row state is separate from checked batch state, so checkboxes only look checked when the user actually selects leads.

Forward: Deploy the batch-selection pass, rerun live alias proof, then keep Podio/Google/email/SMS writes locked until approved access and readback proof exist.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until approved access, approval, and confirmation readback exist.

Dossier batch-selection cleanup:
- Added checked-lead and queued-lead state so row selection no longer doubles as batch selection.
- Added real checkbox controls for visible-row select-all and per-row selection in Find Estates and Dossiers.
- Replaced the top `Prep export` label with `Batch export (N)` whenever leads are checked.
- Added `Add to Queue` as the first export dropdown option.
- Queue now lists queued leads, enables `Stage batch` only when there is something to stage, and keeps live writes locked.
- Local proof:
  - `pnpm build` passed from `probate-lead-engine/apps/artifact`.
  - `git diff --check` passed.
  - In-app Browser geometry proof after rebuild confirmed all six Dossier table columns had stable left positions across all rows and no console/page errors. Browser-control later reset during checkbox interaction, so the interaction proof used the bundled Playwright runtime against the same local server.
  - Bundled Playwright proof at 1433x994 selected all three Dossier rows, confirmed `Batch export (3)`, confirmed `Add to Queue` was the first dropdown option, added three leads to Queue, staged the batch, found no console/page errors, and saved `/tmp/heirright-batch-queue-qa.png`.
  - Production deployment `dpl_Fksg8nsd38LBZ91ijzwnrNYvvm3R` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof at 1433x994 selected all three Dossier rows, confirmed all Dossier table columns stayed aligned, confirmed the current/open row checkbox did not appear checked before batch selection, confirmed `Batch export (3)`, confirmed `Add to Queue` was the first dropdown option, added three leads to Queue, staged the batch, found no console/page errors, found no failed responses, and saved `/tmp/heirright-live-batch-queue-qa-final.png`.

## /solvys-heir-audit North Star Dossier Rail Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local browser proof, live Vercel alias proof, client-provided Deborah Cheatham PDF, and client-provided Constance E. White PDF.

Backward: This pass corrects the Dossiers layout to use a specialized right-side rail rather than a second main-content reader, while preserving the product-loop rule that the normal Report rail is not available inside Dossiers.

UX pass: aligned with gaps. The Dossier tab now behaves like a finished packet review workspace: list on the left, document packet in the rail, embedded PDF-style reader, pop-out option, and export-ready report sections grounded in the North Star packet structure.

Forward: Refine the report renderer against the next client examples when they arrive, then run controlled Podio/Google readback only after credentials and explicit approval exist.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until credentials, approval, and readback proof exist.

## /solvys-heir-audit Live Lead North Star Dossier Follow-up

Source checked: Constance North Star packet, Annie Hawkins live Miami-Dade Property Appraiser source run, current completed-report renderer, current Dossier rail source, local browser proof, and PDF annotation proof.

Backward: This pass takes the North Star family-tree packet shape and applies it to a live public-source lead without fabricating enrichment. The selected live lead is Estate of Annie Hawkins at 131 NW 67 ST, Miami, FL 33150-0000, folio `01-3113-008-0130`. The report now renders title/date/property identity, offer/profit table, back story, property/deed notes, tax notes, probate/court notes, family-tree/contact matrix, source notes, source links, Podio fields, Google Sheets row, outreach blockers, review flags, and next action.

UX pass: aligned with gaps. The Dossiers tab opens the Annie dossier in the specialized right rail, the Completed Lead Report document renders in the embedded reader, and the Source Links section contains real clickable anchors instead of inert link-looking buttons. The rail iframe permits clicked document links to open without enabling scripts.

Forward: The next production-data step is approved enrichment/manual source capture for DOB/DOD, obituary/probate facts, tax amount/payer/receipt facts, phone/email/address history, and confirmed heir count. Until that approval exists, the app correctly keeps those values as review-gated instead of inventing Constance-style contact data.

Alignment: aligned with gaps

Required corrections before complete:
- Enrichment/manual source facts remain blocked by approval and source access.
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until credentials, approval, and readback proof exist.

- Live dossier artifact package:
  - `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-family-tree-discovery-dossier.md`
  - `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-family-tree-discovery-dossier.html`
  - `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-family-tree-discovery-dossier.pdf`
  - `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-source-run.json`
  - `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-vs-constance-north-star-review.md`
- Renderer and app fixes:
  - Expanded completed lead reports into the North Star family-tree dossier structure.
  - Persisted completed-report Markdown and HTML from the live fresh-batch output path.
  - Hydrated Streamdown-rendered report links into real anchors.
  - Added clickable Source Links to the in-app Completed Lead Report rail document.
  - Updated the Dossier iframe sandbox to allow clicked public-record links to open while keeping scripts disabled.
  - Updated the production demo latest-run fixture to the Annie Hawkins dossier.
- Proof:
  - `pnpm build` passed.
  - `pnpm --filter @ple/worker fresh:batch -- --owner="EST OF" --limit=6` passed with 48 external Miami-Dade records, 6 accepted live seeds, 0 rejected candidates, and first live lead `ANNIE HAWKINS EST OF`.
  - Completed Annie PDF has 10 pages and 10 `/Link` annotations; the Constance sample PDF has 4 pages and 0 PDF annotations.
  - Local Dossier rail E2E on `http://localhost:4173` passed with Annie selected, Completed Lead Report open, Offer / Profit Table visible, Source Links visible, Podio Lead Fields visible, 10 source anchors, no page errors, and no console errors.
  - Browser click proof opened the first source link popup to the Miami-Dade Property Appraiser proxy URL containing folio `0131130080130`.
  - Production deployment `dpl_CHQ47zDxeQFjR1VEUQGf3tUsWpaE` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof confirmed `/health` 200, Annie selected in Dossiers, Completed Lead Report open in the Dossier rail, Offer / Profit Table visible, Source Links visible, Podio Lead Fields visible, 10 source anchors, first source-link popup to the Miami-Dade Property Appraiser URL for folio `0131130080130`, and no failed HTTP responses. Playwright console collection reports sandboxed utility-script blocks because the embedded reader intentionally does not allow scripts; the iframe `srcdoc` itself contains no script tags.
  - Screenshot proof:
    - `docs/run-point-daily/screenshots/2026-06-24-annie-hawkins-local-dossier-rail.png`
    - `docs/run-point-daily/screenshots/2026-06-24-annie-hawkins-report-source-links.png`
    - `docs/run-point-daily/screenshots/2026-06-24-annie-hawkins-live-source-links.png`

## /solvys-heir-audit Dossier Packet Language Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local Dossier document browser proof, Deborah/Constance North Star packet notes, and existing deployment notes.

Backward: This pass supports S7/S8/S9 by making the 10-document Dossier packet read like an operator review packet instead of an internal data dump. The work keeps the North Star report shape while preserving review gates for source evidence, Podio, Google Docs, Google Sheets, email, and SMS.

UX pass: aligned with gaps. Embedded Dossier documents now use `Review Draft`, plain source-note wording, approval/readback wording, and curated county-record facts. The Tax History Packet no longer renders the full intake seed, raw source URLs, or review-code strings.

Forward: Deploy this packet-language pass, rerun the live 10-document Dossier audit, then keep live writes locked until approved access and confirmation readback exist.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until approved access, approval, and confirmation readback exist.
- The live packet can render source-backed public-record data, but unverified fields must remain review items until a human clears them.

Dossier packet language cleanup:
- Added operator-safe status labels for review-code values such as manual review, source review, source evidence needed, and contact research not run.
- Added an operator-safe fact formatter that hides raw source URLs, raw IDs, confidence plumbing, seed batch details, and setup labels from embedded Dossier documents.
- Filtered Source Notes and Tax History Packet facts so raw intake seed records and search-link records do not appear in the operator packet.
- Replaced `controlled-write`, `source refs`, `raw public-source shell`, and `Internal Draft` wording with approval/readback, source notes, public-record review packet, and Review Draft language.

Local proof:
- `pnpm build` passed from `probate-lead-engine/apps/artifact`.
- `git diff --check` passed.
- Chrome proof on `http://localhost:4173` opened all 10 Dossier documents by document ID in the right rail and found no `Internal Review Codes`, `Internal Source Appendix`, `NO_ENRICHMENT_RUN`, `SOURCE_HEALTH_ONLY`, `HUMAN_REVIEW_REQUIRED`, `MISSING_`, `raw public-source shell`, `placeholder-only`, `JSON`, `payload`, `source refs`, `dry-run`, `configured`, `credentials`, `token`, `schema`, `endpoint`, `controlled-write`, `RawId`, `SourceUrl`, `ConfirmedSourceFacts`, or `SeedBatch` text.
- Local document proof reported no console/page errors and no failed responses.

Production proof:
- Production deployment `dpl_9grTtg7xAjRr7MZM5j4jERtquUMN` is aliased to `https://heirright-landing-demo.vercel.app`.
- Vercel inspect reported production status `Ready`.
- Chrome proof on `https://heirright-landing-demo.vercel.app` opened all 10 Dossier documents by document ID in the right rail and found no `Internal Review Codes`, `Internal Source Appendix`, `NO_ENRICHMENT_RUN`, `SOURCE_HEALTH_ONLY`, `HUMAN_REVIEW_REQUIRED`, `MISSING_`, `raw public-source shell`, `placeholder-only`, `JSON`, `payload`, `source refs`, `dry-run`, `configured`, `credentials`, `token`, `schema`, `endpoint`, `controlled-write`, `RawId`, `SourceUrl`, `ConfirmedSourceFacts`, or `SeedBatch` text.
- Live document proof reported no console/page errors and no failed responses.

## /solvys-heir-audit Operator API And Dossier Rail Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local API proof, local Chrome proof, and the current Dossiers rail screenshot.

Backward: This pass supports S8/S9 by removing internal setup wording from the operator-facing readiness paths while keeping the app honest about blocked live handoff. It also fixes the product-loop handoff from Dossiers back to Estate Search so the specialized Dossier rail cannot intercept Estate Search row clicks.

UX pass: aligned with gaps. Dossiers now renders as a left finished-dossier list plus right-side Dossier rail, aligned to the same top edge. Leaving Dossiers closes that specialized rail, returns it to Report rail mode, and lets Estate Search rows open the normal Report rail again.

Forward: Deploy this operator-language and rail-handoff pass, run live alias proof, then keep production writes locked until approved access and confirmation readback exist.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until approved access, approval, and confirmation readback exist.
- Queue and export prep remain prepared-only until the client provides approved destinations and readback proof.

- Operator API and Dossier rail proof:
  - Replaced local status/export fallback messages that exposed raw setup keys, `dry-run` wording, route internals, and setup jargon with plain Podio/Google handoff setup language.
  - Re-labeled prepared handoff routes as `review` mode instead of returning `dry_run` mode in the local artifact response.
  - Updated `/health` to report `signInReady` instead of exposing the internal auth setup label.
  - Added operator status labels so packet values like `not_configured` render as `Needs setup`.
  - Closed the Dossier rail when the operator moves back to Estate Search so the Report rail can reopen from row selection.
  - Aligned the Dossier rail top and bottom to the finished-dossier list.
  - Local proof:
    - `pnpm build` passed from `probate-lead-engine/apps/artifact`.
    - `git diff --check` passed.
    - `GET /api/connections/status` returned HTTP 200 with no forbidden internal terms and plain blocked setup messages for Podio and Google.
    - `POST /api/exports` with Google + Podio prepared handoff returned HTTP 200, `mode: review`, confirmation-readback blockers, and no raw setup keys or internal route language.
    - Chrome proof on `http://localhost:4173` confirmed every sidebar tab, dashboard subtabs, the Dossier rail, and the Report rail tabs render with no forbidden internal terms, no console/page errors, and no failed responses.
    - Chrome geometry proof confirmed Dossiers list `{x:76,y:80,width:781,height:838}` and right rail `{x:873,y:80,width:560,height:838}`, with `readerIsRightRail: true` and `sharedTop: true`.
    - Chrome handoff proof confirmed switching Dossiers -> Estate Search leaves the rail in `mode: report`, `open: false`, and `pointerEvents: none`, then Estate Search row selection opens the normal Report rail.
    - Screenshot proof: `docs/run-point-daily/screenshots/2026-06-24-dossier-rail-local.png`.
  - Production deployment `dpl_1496zL8L128uVPc98RDmb31ihr6V` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof:
    - `/health` returned HTTP 200 with `signInReady: false` and no forbidden setup/internal terms.
    - `GET /api/connections/status` returned HTTP 200 with no forbidden setup/internal terms and plain blocked setup messages for Podio and Google.
    - `POST /api/exports` with Google + Podio prepared handoff returned HTTP 200, `mode: review`, confirmation-readback blockers, and no raw setup keys or internal route language.
    - Chrome proof on `https://heirright-landing-demo.vercel.app` confirmed every sidebar tab, dashboard subtabs, the Dossier rail, and the Report rail tabs render with no forbidden internal terms, no console/page errors, and no failed responses.
    - Chrome geometry proof confirmed Dossiers list `{x:76,y:80,width:781,height:838}` and right rail `{x:873,y:80,width:560,height:838}`, with `readerIsRightRail: true` and `sharedTop: true`.
    - Chrome handoff proof confirmed switching Dossiers -> Estate Search leaves the rail in `mode: report`, `open: false`, and `pointerEvents: none`, then Estate Search row selection opens the normal Report rail.
    - Screenshot proof: `docs/run-point-daily/screenshots/2026-06-24-dossier-rail-live.png`.

- Dossier rail annotation and readiness cleanup:
  - Converted the shared right rail into a mode-aware Dossier rail with Dossier-specific aria labels, close/resize labels, context copy, and no report-tab segment inside Dossiers.
  - Moved the selected document heading and pop-out control into a Dossier document toolbar, keeping the finished dossier list as the main left workspace and the document packet/PDF reader in the right rail.
  - Set a wider Dossier rail target so saved narrow Report rail widths do not crush document cards or the embedded packet reader.
  - Disabled report-rail rename behavior while in Dossier mode.
  - Sanitized local export/readiness API responses so blocked Podio readiness returns plain operator copy instead of raw setup keys or server-error semantics.
  - Replaced remaining visible `controlled write` language with approval and confirmation-readback language.
  - Local proof:
    - `pnpm build` passed from `probate-lead-engine`.
    - Source audit found no remaining visible `OpenCodeGo`, `Hermes`, `Podio test card`, `controlled test`, `controlled live test`, `controlled write`, `Mapped payload ready`, `generated test lead`, `PODIO TEST`, `bearer-token`, or `local Podio test` strings in the artifact source/server.
    - `POST /api/exports` for the Podio readiness path returned HTTP 200 with `ok: false`, one plain Podio setup blocker, and no raw `PODIO_*` keys in the returned message/blocker copy.
    - Chrome proof on `http://localhost:4173` confirmed Dossiers opens `#researchRail` as `data-mode="dossier"` at 560px, list and rail share the workbench, the report tab segment is hidden, 10 document cards and one embedded PDF reader render in the right rail, no inline Dossier reader remains in the main view, row switching keeps the rail open, close/toggle work, Drips/Admin/export copy stays plain, and no console/page errors or failed responses occurred.
  - Production deployment `dpl_9xkwm7N26jdYh2zy2kEMyVuhDt6b` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof:
    - `/health` returned 200 with auth disabled for the demo.
    - `POST /api/exports` for the Podio readiness path returned HTTP 200 with a safe blocked state and no package/runtime internals.
    - Chrome proof on `https://heirright-landing-demo.vercel.app` confirmed Dossiers opens the right rail as `data-mode="dossier"` at 560px, Dossier labels/close/resize copy are mode-specific, the report tab segment is hidden, 10 document cards and one embedded PDF reader render, no inline reader remains in the main view, row switching keeps the Dossier rail context synced, Drips/Admin/export copy stays plain, forbidden implementation phrases are absent, and no console/page errors or failed responses occurred.
- The new PDFs are visual anchors; their pages are image-based and still need human/client review before any field is treated as confirmed source truth.

## /solvys-heir-audit North Star Linked Dossier Package Follow-up

Source checked: Deborah Cheatham complex family-tree PDF, Constance E. White simpler family-tree PDF, current completed-report renderer, live fresh-batch worker output, generated PDFs, and local Dossier rail proof.

Backward: This pass closes the sample-document gap the client called out: the live dossier now has a document-package table of contents, same-document PDF jumps, separate section PDFs, and a linked package index. It keeps the Annie Hawkins file as the selected completed-goal dossier while still marking source gaps instead of inventing DOB, DOD, obituary, probate, tax, phone, email, or heir-contact facts.

UX pass: aligned with gaps. The Dossier rail Completed Lead Report now exposes a usable TOC inside the embedded report, with anchors for property, lead snapshot, offer/profit, back story, source notes, source links, missing data, Podio fields, Google Sheets row, and next action.

Forward: Use this package as the client-facing proof artifact, then continue enrichment only through approved public-record, paid-source, or operator-reviewed inputs.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until approved access, approval, and confirmation readback exist.
- Annie Hawkins is structurally comprehensive and source-linked, but still review-gated because public records did not confirm DOB, DOD, obituary, probate case, tax amount, payer identity, or approved contact data.

- Linked dossier package proof:
  - Added a generated `Document Package Table Of Contents` to the completed lead report source.
  - Hydrated TOC links as same-document PDF anchors and preserved public-record source links as external links.
  - Added heading IDs for all package sections during report generation.
  - Hid Streamdown table action controls in report/PDF output so generated PDFs keep clean document tables without copy/download/fullscreen UI chrome.
  - Refreshed Annie Hawkins from the live worker path with 48 external records, 6 accepted seeds, 0 rejected candidates, and the same honest review blockers.
  - Generated the single complete linked PDF: `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-family-tree-discovery-dossier.pdf`.
  - Generated the split package index PDF: `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-document-package-index.pdf`.
  - Generated 16 separate section PDFs under `docs/completed-dossiers/annie-hawkins/sections/`.
  - PDF object proof:
    - Single PDF: 11 pages, 29 link annotations, 10 external source URI links, and 19 internal TOC destination annotations.
    - Package index PDF: 1 page, 18 URI annotations linking the single PDF, in-app HTML report, and all 16 separate section PDFs.
  - Local proof:
    - `pnpm build` passed from `probate-lead-engine`.
    - `pnpm --filter @ple/worker test` passed.
    - `pnpm --filter @ple/artifact build` passed.
    - `git diff --check` passed.
    - Browser proof on `http://localhost:4173` confirmed Dossiers opens the right Dossier rail, the Completed Lead Report is selected, the embedded report contains the TOC, property/offer/source/missing anchors, the Miami-Dade public-record source URL, no table-toolbar controls, no script tags, no page errors, and no failed requests.
    - Screenshot proof: `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-dossier-rail-local.png`.
  - Production deployment `dpl_5nYA7mcs3HvTvN1c2bFTtYtqpsw6` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof:
    - Browser proof on `https://heirright-landing-demo.vercel.app` confirmed Dossiers opens the right Dossier rail, the Completed Lead Report is selected, the embedded report contains the TOC, property/offer/source/missing anchors, the Miami-Dade public-record source URL, no table-toolbar controls, no script tags, no page errors, and no failed requests.
    - Screenshot proof: `docs/completed-dossiers/annie-hawkins/2026-06-24-annie-hawkins-dossier-rail-live.png`.

## /solvys-liquid-glass Floating CRM/List Controls Follow-up

Source checked: current artifact source, Solvys Liquid Glass skill, local browser proof, and live alias proof.

Backward: This pass adds basic list/CRM actions without changing the safety model. The new floating pill appears only when leads are selected and routes work through the existing review-only Queue, Podio prep, and Google + Podio prep flows.

UX pass: aligned with gaps. Preferred actions are Liquid Glass pill buttons; alternate list actions stay quieter. The pill floats above the bottom composer and remains usable when the activity drawer is open.

Forward: Use this as the compact batch action surface for Estate Search and Dossiers. A real Figma library import can replace the visual token mapping later if a Figma file/library is provided.

Alignment: aligned with gaps

- Floating controls proof:
  - Added `Add to Queue`, `Podio Prep`, `Google + Podio`, `Select visible`, and `Clear` actions to a floating `solvys-liquid-glass-strong` pill.
  - The pill synchronizes with selected rows, export button batch labels, visible row counts, and disabled state.
  - Local proof on `http://localhost:4173` confirmed selection opens the pill, Select visible expands to 6 selected rows, Add to Queue stages 6 leads, Clear resets selection/export label, Podio Prep opens the guarded report rail, and no browser errors or failed requests occurred.
  - Production deployment `dpl_HshWwYMzx8UeWwAJTX1oeBdp6XV4` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof confirmed the pill opens on selection with `Add to Queue`, `Podio Prep`, `Google + Podio`, `Select visible`, and `Clear` labels, shows `1 selected`, updates the header export label to `Batch export (1)`, and reported no page errors or failed requests.
  - Screenshot proof:
    - `docs/run-point-daily/screenshots/2026-06-25-floating-crm-list-controls-local.png`
    - `docs/run-point-daily/screenshots/2026-06-25-floating-crm-list-controls-live.png`

- Export / Queue handoff hardening follow-up:
  - Replaced the old `Your Report Is Ready` / `exported successfully` activity language with `Handoff Package Prepared` and explicit review-only copy for Podio, Google Docs, Google Sheets, email, and SMS.
  - Expanded Queue into a batch handoff prep surface with readiness, Dossier document count, source-backed gaps, operator task count, live handoff blockers, Podio fields/tasks, Google Docs body, and Google Sheets row.
  - Kept Queue staging inside the product loop without opening the Report rail.
  - Preserved the specialized Dossier rail during export prep and limited Report rail export previews to Find Estates.
  - Updated export route previews after `/api/exports` returns so the Report rail shows the prepared/blocked result, not a premature route title.
  - Local proof:
    - `pnpm build` passed from `probate-lead-engine`.
    - Chrome proof on `http://localhost:4173` confirmed Dashboard has no old export-success wording, Queue shows batch handoff prep and all three destinations, Queue stage sets `handoff: [BATCH PREPARED]` without opening a rail, Dossiers remains `data-mode="dossier"` before/after Google prep, Find Estates opens the normal Report rail in `report` mode, and no old export-success phrases remain.
    - Browser proof reported no console/page errors and no failed responses.
    - API proof on `POST /api/exports` with Google + Podio dry-run returned `ok: true` with `dry_run` routes and explicit live Google/Podio readback/setup blockers.
  - Production deployment `dpl_G1DwGRFYBkUshXSbAEmWzvNmsMK6` is aliased to `https://heirright-landing-demo.vercel.app`.
  - Live alias proof:
    - `/health` returned 200 with auth disabled for the demo.
    - `POST /api/exports` with Google + Podio dry-run returned `ok: true`, `dry_run` routes, and explicit live Google/Podio blockers.
    - Chrome proof on the live alias confirmed Dashboard has no old export-success wording, Queue shows batch handoff prep and all three destinations, Queue stage does not open a rail, Dossiers remains `data-mode="dossier"` before/after Google prep, Find Estates opens the normal Report rail in `report` mode, and no old export-success phrases remain.
    - Mobile-width proof confirmed Queue and Dossier rail render without horizontal overflow, Dossiers opens in `data-mode="dossier"`, and browser proof reported no console/page errors or failed responses.
    - Focused final browser proof confirmed rendered activity and Report rail copy use `readback proof are complete`, Dossier rail stays open in `dossier` mode during export prep, and Find Estates still opens the normal Report rail.

## /solvys-heir-audit Export And Queue Handoff Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local Chrome proof, local `/api/exports` dry-run proof, and existing deployment notes.

Backward: This pass supports S7/S8/S9 by making Queue and export prep accurate to the real document-preparation product loop. The operator can stage packet content for Podio and Google destinations without the interface pretending that a live CRM card, Doc, Sheet row, email, or SMS was created.

UX pass: aligned with gaps. The handoff path now reads as a batch-prep console, keeps Dossiers in its specialized rail, and uses the normal Report rail only from Find Estates.

Forward: Deploy this handoff hardening pass, run live alias proof, then keep production writes locked until approved credentials and readback proof exist.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until credentials, approval, and readback proof exist.
- Queue currently prepares the handoff package in-app; credentialed write/readback validation remains external to this pass.

- Operator-language cleanup follow-up:
  - Replaced visible implementation route names in Drips and Admin with plain review-route language.
  - Renamed the export-menu Podio test action to `Run Podio readiness check` and rewrote its copy around an approved sample Lead card.
  - Replaced visible `controlled test`, `generated test lead`, `PODIO TEST`, and `Mapped payload ready` language with approved sample-card and mapped-for-review language.
  - Added the review route to each scheduled-check row so operators can see how each drip/check will be prepared.
  - Local proof:
    - `pnpm build` passed from `probate-lead-engine`.
    - Chrome proof on `http://localhost:4173` confirmed the export menu shows `Run Podio readiness check`, Drips renders `Review automation route`, Admin describes scheduled checks as review preparation, the preview activity uses review-route language, the Podio readiness route blocks safely with `handoff: [PODIO CHECK] [BLOCKED]`, and the rendered body no longer contains `OpenCodeGo`, `Hermes`, `Podio test card`, `controlled test`, `Mapped payload ready`, `generated test lead`, or `PODIO TEST`.

## /solvys-heir-audit Operator Language Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local Chrome proof, and existing deployment notes.

Backward: This pass supports S8/S9 by keeping scheduled checks, drip prep, and Podio handoff actions understandable to a real estate operator. It keeps the same guarded export and review behavior, but removes implementation labels from visible workflow screens.

UX pass: aligned with gaps. Drips, Admin, the export menu, activity trail, and blocked Podio readiness path now use plain workflow language: review route, approved sample Lead card, prep-only, and confirmation readback.

Forward: Deploy this operator-language pass, run live alias proof, and keep production writes locked until approved credentials and readback proof exist.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until credentials, approval, and readback proof exist.
