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

## /solvys-heir-audit North Star Dossier Rail Follow-up

Source checked: HeirRight deal-flow checklist, current artifact source, local browser proof, live Vercel alias proof, client-provided Deborah Cheatham PDF, and client-provided Constance E. White PDF.

Backward: This pass corrects the Dossiers layout to use a specialized right-side rail rather than a second main-content reader, while preserving the product-loop rule that the normal Report rail is not available inside Dossiers.

UX pass: aligned with gaps. The Dossier tab now behaves like a finished packet review workspace: list on the left, document packet in the rail, embedded PDF-style reader, pop-out option, and export-ready report sections grounded in the North Star packet structure.

Forward: Refine the report renderer against the next client examples when they arrive, then run controlled Podio/Google readback only after credentials and explicit approval exist.

Alignment: aligned with gaps

Required corrections before complete:
- Live Podio writes, Google Docs creation, Google Sheets insertion, email sends, and SMS sends remain locked until credentials, approval, and readback proof exist.
- The new PDFs are visual anchors; their pages are image-based and still need human/client review before any field is treated as confirmed source truth.

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
