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
