# HeirRight Leads S28 Execution Tracker - 2026-06-30

Companion plan: `docs/HEIRRIGHT_LEADS_S28_SUPER_SPRINT_PLAN_2026-06-30.md`

Risk and decision register: `docs/HEIRRIGHT_LEADS_S28_RISK_DECISION_REGISTER_2026-06-30.md`

Status: ready for annotation intake. Implementation has not started.

## Current Gate

- Gate: waiting for remaining browser annotation batches, unless the user explicitly says to start early.
- Baseline: S22 through S27 are complete.
- Current app: `https://heirright-leads.vercel.app/`
- Current repo: `/Users/tifos/Documents/Codebases/heir-right`
- Current branch at planning time: `v1.1.1/heirright-2026-06-30-s26-s27`
- Do not absorb unrelated dirty files: `probate-lead-engine/package.json`, `probate-lead-engine/pnpm-lock.yaml`

## Annotation Intake

| Comment | Surface | Status | Required action | Proof |
| --- | --- | --- | --- | --- |
| 1 | Dossier document row actions | Pending implementation | Replace row-level Quick Look text with an eye icon and fix action alignment | Desktop/mobile browser proof |
| 2 | Pending | Waiting | Append when received | Acceptance test added |
| 3 | Pending | Waiting | Append when received | Acceptance test added |
| 4 | Pending | Waiting | Append when received | Acceptance test added |
| 5 | Pending | Waiting | Append when received | Acceptance test added |

## Execution Blocks

| Block | Scope | Tickets | Status | Exit proof |
| --- | --- | --- | --- | --- |
| 0 | Intake freeze | All annotations | Waiting | Every annotation is in the plan/tracker |
| 1 | Visual stabilization | S28-01, S28-09 slice | Not started | Annotated regions fixed at desktop/mobile widths |
| 2 | Data truth and product loop | S28-02, S28-03, S28-04, S28-05 | Not started | Dashboard to DocPrep to report to export path works |
| 3 | Outreach and connector path | S28-06, S28-07 | Not started | Activepieces/Podio readback or fallback proof |
| 4 | Guided demo | S28-08 | Not started | Walkthrough start/next/skip/replay proof |
| 5 | Full visual QA | S28-09 | Not started | Required viewport screenshots and overflow checks |
| 6 | Build, deploy, live proof | S28-10 | Not started | Live alias serves updated artifact and proof packet is complete |

## Ticket Tracker

| Ticket | Owner | Status | Source seams | Done evidence |
| --- | --- | --- | --- | --- |
| S28-01 Annotation closeout | Main session | Waiting | `documentRequirementHtml`, `.document-actions` | screenshots/browser proof per comment |
| S28-02 Dashboard truth | Main session | Not started | `needsAttentionItems`, `dashboardActivityRows`, `processCardHtml` | dashboard source trace and screenshot |
| S28-03 CTA matrix | Main session | Not started | top-bar, shell nav, queue/report/export/outreach handlers | clicked CTA matrix |
| S28-04 DocPrep E2E | Main session | Not started | `renderDossiersView`, `docsForFlow`, `handleDocumentMenuAction` | discovery/closing reload and export proof |
| S28-05 Report packet PDF | Main session | Not started | `railDocsHtml`, `.report-cover`, `.doc-frame` | Date Added selector and PDF viewport proof |
| S28-06 Outreach bridge/fallback | Main session | Not started | `renderDripsView`, `syncOutreachTemplate`, connector APIs | readback or fallback blocked-live-sync proof |
| S28-07 Settings/auth setup | Main session | Not started | connector cards, auth/session, `/api/connections/status` | office-user setup proof |
| S28-08 Demo/walkthrough | Main session | Not started | shell nav, tab renderers, local persistence | desktop/mobile walkthrough proof |
| S28-09 Responsive QA | Main session plus optional scout | Not started | dashboard, docs, report, outreach, queue, settings | screenshots and overflow assertions |
| S28-10 Deploy/live proof | Main session | Not started | artifact build, Vercel alias | live alias proof and connection status |

## CTA Proof Checklist

| Surface | CTA | Status | Notes |
| --- | --- | --- | --- |
| Header | Import | Not started | Must open import/setup path |
| Header | Prep export | Not started | Must prepare/export or show blocker |
| Header | Report | Not started | Must open report rail |
| Header | Save search | Not started | Must persist context or explain missing selection |
| Header | Activity | Not started | Must open activity drawer |
| Header | Load latest | Not started | Must reload latest run/fresh batch |
| Dashboard | Needs Attention cards | Not started | Must route to exact next-action panel |
| Dashboard | Active Process cards | Not started | Must open the correct DocPrep flow |
| Dossiers | Add/Open/Preview/Export | Not started | Must preserve selected estate/flow |
| Report | Date Added/PDF/export | Not started | Must show selected report context |
| Outreach | New/Edit/Ready/Approve/Sync | Not started | Must preserve approval and no-send gates |
| Queue | Stage batch | Not started | Must prepare review-only handoff |
| Settings | Connector cards | Not started | Must reflect status API |
| Walkthrough | Start/next/skip/replay | Not started | Must work on desktop/mobile |

## Proof Packet Checklist

| Proof item | Status | Artifact or note |
| --- | --- | --- |
| Local artifact build | Not started | |
| Worker tests, if touched | Not started | |
| Full build, if shared/backend touched | Not started | |
| Desktop screenshots | Not started | |
| Mobile screenshots | Not started | |
| Overflow assertions | Not started | |
| CTA matrix | Not started | |
| Connector status response | Not started | |
| Outreach bridge or fallback proof | Not started | |
| Live Vercel alias proof | Not started | |
| `/solvys-heir-audit` closeout | Not started | |

## Stop Conditions

- No live Podio, Google, SMS, Resend, or paid-source write without explicit credentials, approval, and readback.
- No claim that legal/probate documents are complete if the app only prepared review materials.
- No Clerk addition unless existing Google OAuth/backend path cannot satisfy the team/user-ID need.
- No destructive git cleanup or dependency rollback unless explicitly requested.
- No implementation start until annotation intake is complete or the user says to start early.
