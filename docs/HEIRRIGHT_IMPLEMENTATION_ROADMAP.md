# HeirRight S1-S27 Run-Point Roadmap

Status: implementation-facing roadmap and contract-completion run-point plan
Friday delivery target: completed Friday, May 22, 2026
Post-Friday owner: Claude Cowork / Codex Automation, with TP/Sam at milestone gates
Track cap: 5 child tracks max per execution batch
Historical Linear project: HeirRight Friday Delivery preserves completed S1-S4 evidence
Active Linear project: HeirRight Deal Engine Automation
Completion rule: S22-S27 are exactly six full sprints, run two full sprints per daily automation run unless the second sprint is concretely blocked.

## New Onboarding Inputs

New source reviewed on May 21, 2026:

- `HeirRight Workflow. pdf.pdf`
- User-supplied Zoom onboarding notes pasted into the working thread.

Zoom meeting notes link supplied by the client is blocked in this session:

- `https://hub.zoom.us/doc/pyeWoASdRpyhp_8YFjZ7nw?from=hub&skipCheck=1`
- Direct file lookup returned `REASON_PERMISSION_DENIED`.
- Content APIs returned unauthorized/no-permission responses.

Planning rule: use the workflow PDF and pasted Zoom notes now, but treat direct Zoom export/share access as a source-provenance blocker until the notes are exported or shared with readable permissions.

## MVP Timeline

Pre-Alaska delivery target:

- Joshua leaves for Alaska on June 6, 2026.
- Target MVP delivery before June 6 with at least 2 days for Joshua to test.
- Use Joshua's June 6-20 unavailable window for debugging and refinement.
- Resume full forward testing when Joshua returns.

Historical success metrics:

- 30-day: automate at least 60% of front-end qualified lead generation and lead report creation, plus implement text/email follow-up workflow scaffolding.
- 90-day: full document prep automation and a working deal engine that produces qualified prospects with closing opportunities.

Corrected contract-completion target as of June 29, 2026:

- Automate Discovery DocPrep.
- Automate Closing DocPrep.
- Finalize the public website with landing, Terms of Use, and Privacy Policy content.
- Automate SMS/email outreach through Podio, Resend, or an owned app queue plus an approved SMS carrier gateway.
- Prove the tested UI surfaces are error-free.
- Prove Google Sheets and Podio integrations with controlled write/readback.
- Preserve lead generation as future capability, not the current completion yardstick.

Current milestone gates:

- FULLY FUNCTIONAL PRD.
- FULL-APP HUMAN-PRACTICAL TESTING.
- UX AND PRODUCT LOOP HUMAN REVIEW.

Historical Linear milestone targets:

- Project Semi-Automation Setup: May 27, 2026.
- Pre-Alaska MVP Testing Handoff: June 4, 2026.
- 30-Day Workflow Automation Milestone: June 21, 2026.
- 90-Day Deal Engine Milestone: August 20, 2026.

Run-point rule:

- Codex Automation starts daily at 11:30 AM America/New_York.
- It reviews the previous day's work, runs smoke gates, fixes regressions first, performs a Solvys UI audit, then starts the current day's ready briefs in Cursor Web PWA tabs.
- It takes two full sprints per day until S22-S27 are complete unless the second sprint is blocked by credentials, live-write approval, legal/compliance review, or a failing smoke gate.
- Human testing is created only at milestone acceptance gates, not after every S5-S11 execution batch.
- Human-attention blockers go to `sam@solvys.io` only for credentials, approvals, legal/compliance review, live-write permission, or milestone acceptance.

Scope posture:

- 2-week MVP should be assisted automation plus human review, not fully autonomous county scraping, paid-source enrichment, CRM migration, and live outreach all at once.
- Website redesign begins after lead engine delivery, during forward testing.
- HeirRight is the first testbed for a future Solvys white-labeled operator shell, but generic shell extraction should wait until after the HeirRight MVP proves the pattern.
- IDI Core is expensive per run. The approved Asset Discovery intake path can be verified once, then it must remain locked unless TP explicitly reopens it.

## Friday Done

Friday done means a working local/dry-run system:

- live public-source property-first search;
- official-record/title signal capture where feasible;
- raw no-enrichment dossier generation;
- CRM adapter dry-run path;
- document automation dry-run;
- landing/intake path;
- operator dashboard;
- deployment/handoff blockers listed plainly.

Excluded:

- live outreach sends;
- guaranteed lead volume;
- legal review;
- new counties;
- enrichment for the first milestone;
- AI scoring for Friday unless explicitly re-added.

## Architecture

Core flow:

```text
Live public source search -> SourceFact[] -> Raw Dossier -> CRM adapter dry-run -> Document packet -> Dashboard / Intake
```

Workflow-informed production flow:

```text
Estate/address/folio/case seed -> owner qualification -> property/deed/tax checks -> court/probate/heirship checks -> raw lead report -> Claude Cowork worker -> Podio work queue -> document/outreach drafts -> human review
```

Minimum interfaces:

- `SourceFact`: source, raw ID, fetchedAt, county, subject identifiers, fact type, value, confidence, source URL, review flags.
- `RawDossier`: lead summary, property profile, owner profile, title/records events, document payload, CRM sync state, source refs, audit trail.
- `CrmAdapter`: `healthcheck()`, `dryRun(dossier)`, `sync(dossier)`, readback verification, and `describeRequiredConfig()`.
- Provider adapters: `PodioAdapter`, `MacroCrmAdapter`, `CloseCrmAdapter`, and `DryRunCrmAdapter` should share the same contract as providers are validated.
- `DocumentPacket`: internal summary first, then offer/heir/negotiation templates as available.

## White-Labeled Shell Direction

HeirRight should not become a generic Solvys dashboard. It should become a probate/sales operator shell first, then inform a reusable Solvys shell system after MVP.

Shared shell infrastructure:

- bottom composer as the command surface;
- project-specific navigation registry;
- lightweight agent activity drawer;
- local build/test/dry-run/artifact runtime;
- Linear sync, with Linear remaining the source of truth;
- OpenPanel/PostHog-ready analytics and monitoring event contract;
- Solvys admin dashboard for cross-project analytics and deeper Solvys-1 control.

Project-specific design remains mandatory:

- each client shell defines its own tabs and home screen;
- HeirRight can test CRM/work-queue vs chat-first command center;
- the visible client experience should match the client's workflow, not a universal pane list.

## CRM Strategy

Current client systems:

- Qualified leads live in Google Sheets.
- Bonus/warm leads live in Podio.

Decision path:

1. Treat Podio as the leading CRM path unless smoke tests disprove it.
2. Keep CRM integration behind a provider-neutral adapter so Macro/Close remain fallback options.
3. Validate Podio API, hooks/webhooks, MCP access, item/task/comment/file operations, and readback behavior.
4. Build a Claude Cowork automation artifact that owns orchestration and talks directly to Podio.
5. Avoid Zapier as the core automation layer; use it only as a narrow bridge for a specific missing action.
6. Use Podio CSV export for backup/migration safety so original data stays intact.
7. Test Macro or Close only if Podio fails automation/readback/team-fit gates.

CRM preferences from onboarding:

- Podio is the leading CRM if it can support direct automation and workflow readback.
- Macro and Close remain fallback candidates if Podio fails technical validation.
- Notion is not recommended as the system of record.
- Slack may be useful as an AI/context workflow layer, but not as the default CRM.

## Claude Cowork Automation Artifact

The lead engine should run as a controlled Claude Cowork artifact in Joshua's cloud/code configuration or in Solvys-managed infrastructure approved for the project.

Responsibilities:

- source runs;
- dossier and completed lead report generation;
- Podio item/task/comment/file sync;
- Podio hook/webhook handling;
- readback verification;
- retry/dead-letter handling;
- objective workflow-state automation;
- no-auto-send enforcement;
- audit logs for source facts, CRM syncs, documents, and review gates.

Zapier should not be the primary automation engine. The worker owns orchestration; Podio owns CRM/work queue state; the operator shell owns visibility and review.

## Project Semi-Automation Setup

Status: **Done** (2026-06-01, Linear `HEI-29` / `HEI-37`–`HEI-40`)

Goal: make the HeirRight project the first semi-automated Solvys run-point workflow.

Included setup:

1. `R0-T1: Claude Cowork terminology and milestone docs`
   Keep docs, sprint briefs, and Linear language aligned around Claude Cowork and milestone acceptance.

2. `R0-T2: /solvys-run-point skill`
   Create a reusable setup skill for Linear-backed, Codex Automation-driven, Cursor Web PWA execution.

3. `R0-T3: Daily HeirRight Run Point automation`
   Schedule the daily 11:30 AM run with regression gates, UI audit, Cursor Web PWA brief launch, Linear updates, and human blocker routing.

4. `R0-HUMAN: Supervised run-point dry run acceptance`
   Confirm the automation can open the right project context, launch at least one brief session, update Linear, and avoid live outreach.

Acceptance:

- `rg -n -i "cloud[_[:space:]-]*cowork" docs linear sprint-md` returns no legacy naming references.
- `/solvys-run-point` validates locally.
- Linear has the active project, milestone gates, S5-S11 ORCH/issues, and milestone-only human testing tickets.
- First automation run is supervised or dry-run.

## S1 - Tuesday, May 19: Live Property + Records Search

Parent issue: `S1-ORCH: HeirRight live public-source search`

Goal: first live property-first test from app sources, no enrichment.

Tracks:

1. `S1-T1: App Scaffold + Source Run Shell`
   Build runnable worker/app shell, run lifecycle, source selection, local dry-run output, and source status logging.

2. `S1-T2: Miami-Dade Property Search Adapter`
   Implement live public property search by address/folio/owner where feasible. Output raw owner/property/parcel facts.

3. `S1-T3: Official Records / Clerk Signal Adapter`
   Capture title/deed/mortgage/lien/adverse-possession signals from public records where feasible. If blocked, produce documented fallback and raw import shape.

4. `S1-T4: Raw Dossier Shell`
   Convert live property + records facts into a no-enrichment dossier shell: owner, property, title events, missing fields, source refs, review flags.

5. `S1-T5: Validation Harness`
   Validate one fresh live lead search, no skip trace, no AI score, no CRM write. Output pass/fail and blocker notes.

Acceptance:

- Fresh live/public-source run executes.
- No-enrichment dossier shell generated.
- Every claim has sourceRef or review flag.
- Blocked source behavior is documented.

## S2 - Wednesday, May 20: CRM Adapter + Raw Dossier System

Parent issue: `S2-ORCH: HeirRight raw dossier to CRM adapter`

Goal: make the raw dossier operational and CRM-ready.

Tracks:

1. `S2-T1: Dossier Contract + Storage`
   Finalize `RawDossier`, `SourceFact`, `DossierClaim`, `DossierEvent`, and audit trail types. Persist raw runs, facts, dossiers, and sync attempts.

2. `S2-T2: CRM Adapter Contract`
   Define provider-neutral dry-run/sync/readback/config behavior. Keep Podio as incumbent, Macro as migration candidate, and Close as fallback.

3. `S2-T3: CRM Pipeline Model`
   Map HeirRight workflow into provider-neutral CRM areas: research queue, acquisition, disposition; lead status; source status; review flags; doc-ready status; next action.

4. `S2-T4: Dossier Narrative Only`
   Generate deterministic or AI-assisted narrative summary only. No scoring by Friday unless later explicitly added.

5. `S2-T5: CRM Dry-Run Validation`
   Produce inspectable provider payload: lead item, contacts placeholder, title/source notes, tasks, and review blockers. No live write unless access is confirmed.

Acceptance:

- Raw dossier maps to provider-neutral CRM fields.
- Macro/Podio/Close provider gaps can be captured without changing the lead engine.
- Browser automation or Albato fallback is specified only for blocked provider actions.
- CRM dry-run output is complete.

## S3 - Thursday, May 21: Document Automation

Parent issue: `S3-ORCH: HeirRight document prep automation`

Goal: generate document-ready outputs from raw dossier and CRM fields.

Tracks:

1. `S3-T1: Template Inventory + Field Map`
   Map available document types from HeirRight workflow: offer letter, heir communication, negotiation doc, internal summary, follow-up/status update.

2. `S3-T2: Document Data Contract`
   Define the document payload from dossier/CRM data: owner, property, tax/title fields, review flags, offer fields, contact placeholders, missing-input markers.

3. `S3-T3: Internal Summary Generator`
   Generate the internal "Running the play" style summary from raw dossier facts.

4. `S3-T4: PDF/Word Dry-Run Export`
   Produce print-ready HTML/markdown now, with PDF/Word conversion path documented if a conversion dependency is not installed.

5. `S3-T5: Document Review Gate`
   Mark all generated docs as drafts requiring human review. No legal/compliance claims, no auto-send, no external use without approval.

Acceptance:

- At least one internal summary document generates from a live raw dossier.
- Document fields are tied to dossier/CRM fields.
- Missing data remains visible.
- Review gate is explicit.

## S4 - Friday, May 22: Landing, Intake, Deployable Demo, Handoff

Parent issue: `S4-ORCH: HeirRight Friday delivery`

Goal: tie the system together into a Friday-complete runnable delivery.

Tracks:

1. `S4-T1: Landing + Intake`
   Build mobile-first HeirRight intake page with basic SEO-ready structure. Intake creates a local/dry-run lead seed and maps toward the CRM adapter.

2. `S4-T2: Operator Dashboard`
   Show source run status, generated dossier, source refs, review flags, document status, and CRM dry-run status.

3. `S4-T3: Deployment Prep`
   Prepare Railway/Vercel or local runnable deployment path. If credentials are missing, ship local runbook plus env checklist and dry-run demo.

4. `S4-T4: End-to-End QA`
   Run fresh public-source lead search through raw dossier, CRM adapter dry-run, document generation, landing/intake, and dashboard.

5. `S4-T5: Handoff Packet`
   Produce implementation-facing runbook: setup, env vars, source limitations, CRM provider status, known blockers, Friday acceptance checklist, and refinement backlog.

Acceptance:

- One fresh live public-source run works.
- No-enrichment raw dossier renders.
- CRM adapter dry-run path is proven; provider-specific live sync remains gated by validation.
- Internal document output exists.
- Landing/intake and dashboard are runnable.
- Missing external systems are blockers, not fabricated success.

## Current Implementation Status

Last roadmap sync: June 3, 2026. Linear project `HeirRight Deal Engine Automation` is the status source of truth (`HEI-29` through `HEI-90`).

### Sprint completion (post-Friday)

| Sprint | Linear | Status | Completed |
| --- | --- | --- | --- |
| R0 — Run-point semi-automation setup | `HEI-29`, `HEI-37`–`HEI-40` | Done | 2026-06-01 |
| S5 — Workflow rules + tax/deed depth | `HEI-30`, `HEI-41`–`HEI-45` | Done | 2026-05-28 |
| S6 — Probate + heirship research | `HEI-31`, `HEI-46`–`HEI-49`, `HEI-55` | Done | 2026-06-01 |
| S7 — Completed lead report + offer math | `HEI-32`, `HEI-50`–`HEI-54` | Done | 2026-06-01 |
| S8 — Outreach draft library | `HEI-33`, `HEI-56`–`HEI-60` | Done | 2026-06-01 |
| S9 — Podio Claude Cowork automation | `HEI-34`, `HEI-61`–`HEI-65` | Partially unblocked by Podio browser field audit; blocked on API runtime config, controlled write approval, CSV backup, and live readback | — |
| S10 — Website redesign | `HEI-35`, `HEI-66`–`HEI-70` | Done; Civic Ledger site built and launch-QA checked with approval notes | 2026-06-03 |
| S11 — Operator shell foundation | `HEI-36`, `HEI-71`–`HEI-75` | Done; HeirRight shell MVP, composer/drawer, settings, runtime/Linear, admin event contract, and extraction notes landed locally | 2026-06-03 |
| S12 — Organization access + beta runtime gate | `HEI-79`–`HEI-81` | Done | 2026-06-02 |
| S13 — Report rail + operator UI completion | `HEI-82`–`HEI-84` | Done | 2026-06-02 |
| S14 — Daily lead production + qualification | `HEI-85`, `HEI-87`–`HEI-88` | Done; production seeds needed for volume proof | 2026-06-02 |
| S15 — Google/Podio export + readback | `HEI-86`, `HEI-89`–`HEI-90` | Done; live credentials/readback needed for milestone proof | 2026-06-02 |
| S16 — Production seed intake + acceptance batch | local fallback | Done for contract/example path; real production batch optional/future | 2026-06-16 |
| S17 — Structured source extraction upgrade | local fallback | Partially implemented; remaining extraction depth is future lead-generation capability unless needed for DocPrep proof | — |
| S18 — Qualification promotion loop | local fallback | Done in repo; live acceptance still depends on real source coverage if lead-volume mode is activated | 2026-06-17 |
| S19 — Controlled Google + Podio readback | local fallback | Packet done; live readback still externally blocked | — |
| S20 — 30-day acceptance run | local fallback | Packet/review script done; old lead-volume milestone no longer controls current contract completion | 2026-06-17 |
| S21 — Discovery dossiers product loop | local fallback | Done for UI/product loop; S23 hardening complete | 2026-06-28 |
| S22 — Contract completion PRD + source lock | local fallback | Done | 2026-06-29 |
| S23 — Discovery + Closing DocPrep automation | local fallback | Done | 2026-06-29 |
| S24 — Outreach automation + Google/Podio integration | local fallback | Ready; credentials required for live completion | — |
| S25 — Website + legal page finalization | local fallback | Mostly implemented; route split/verification remains | — |
| S26 — Full-app human-practical testing | local fallback | Pending S23-S25 | — |
| S27 — UX + product-loop human review | local fallback | Pending S26 | — |

Current milestone gates: S22 closes FULLY FUNCTIONAL PRD, S26 closes FULL-APP HUMAN-PRACTICAL TESTING, and S27 closes UX AND PRODUCT LOOP HUMAN REVIEW. Historical gates `HEI-76`, `HEI-77`, and `HEI-78` remain useful history, but the corrected contract objective is now S22-S27.

### Implemented in the workspace

- `@ple/types` includes `SourceFact`, `RawDossier`, `CrmAdapter`, `DocumentPacket`, probate/heirship models, completed-lead-report schema, and offer/profit types.
- `@ple/worker` runs a local dry pipeline and writes `output/latest-run.json`; supports estate-only seeds via `--estate` and `--case-number`.
- Workflow rule evaluation, tax/deed adapters, disqualification queue, and source-evidence QA (S5).
- Estate-name search path, probate docket model, marriage/death indicators, family-tree hypothesis, and paid/manual source governance (S6).
- Completed lead report renderer (markdown/HTML), offer/profit math, CRM field expansion, and human review gate (S7).
- Outreach draft assets, compliance review state, manual follow-up tasks, outreach-ready blockers, no-auto-send guard, report/Podio/artifact wiring, and validation checks (S8).
- Google OAuth beta access, protected artifact/worker runtime, account state, and allowed-domain/admin-email gating (S12).
- Streamdown report rail, client report snapshot shape, report cover sheet, neutral frosted UI, and operator export-readiness copy (S13).
- Daily county production ledger, dedupe/dead-letter accounting, raw/review/qualified count separation, and qualification blockers for source-health/no-enrichment/placeholder records (S14).
- Google Workspace and Podio export/readback service paths, `/api/exports`, `/api/connections/status`, Export dropdown result/blocker rendering, and footer status indicators (S15).
- Miami-Dade Property Search and Official Records adapters perform live public app reachability checks and produce review flags.
- `PodioAdapter` produces dry-run payloads with expanded S6/S7/S8 fields plus S9 access, CSV, readback, and blocker prep; live sync remains disabled until Podio access and live-write approval are validated.
- `@ple/artifact` serves the latest dry-run result at `http://localhost:4173`.
- `docs/FRIDAY_HANDOFF_RUNBOOK.md` documents setup, outputs, blockers, and Friday acceptance.
- `probate-lead-engine/site-v2/` preserves the S10 prototype gallery and copy/layout review surface.
- `site-v2/` now contains the built Civic Ledger public-site draft with responsive layout, intake bridge, generated dossier image, SEO metadata, and S10 launch QA notes.
- `@ple/artifact` now carries the S11 HeirRight operator shell foundation: project-specific nav, CRM/work-queue shell status, bottom composer, lightweight activity drawer, lead-quality settings, runtime/Linear panel, Solvys admin event counters, and prep-only export guardrails.
- `docs/S11_OPERATOR_SHELL_FOUNDATION.md` records the reusable shell contract, HeirRight config example, analytics event inventory, local runtime/Linear sync model, and extraction plan for Solvys-1/Fintheon hooks.
- S21 added the current DocPrep product loop: CRM import, Discovery and Closing Docs flow tabs, closing document rows, estate process fuses, queue prep, and production app proof.
- S23 completed DocPrep hardening: per-estate/per-flow Discovery and Closing progress, reload-safe CRM/DocPrep state, reviewed closing-template family mapping, generated Closing Packet Review, and in-app Quick Look blocker preview.
- `docs/HEIRRIGHT_CONTRACT_COMPLETION_PLAN_2026-06-29.md` records the corrected contract objective, reviewed closing-template packet, IDI Core guardrails, and S22-S27 sprint map.

## Current Contract Completion Pack - S22-S27

S22-S27 are the remaining six sprints total. TP annotations should be captured after this planning pass and routed into the sprint that owns the affected behavior.

1. S22: Contract Completion PRD + Source Lock.
2. S23: Discovery and Closing DocPrep Automation.
3. S24: Outreach Automation + Google/Podio Integration.
4. S25: Website + Legal Page Finalization.
5. S26: Full-App Human-Practical Testing.
6. S27: UX + Product Loop Human Review.

Annotation routing:

- UI/product-loop annotations for app workflow go to S23 or S26 depending on whether they are implementation changes or test observations.
- Outreach, approval, SMS/email, Google Sheets, and Podio annotations go to S24.
- Public website, Terms, Privacy, contact, copy, or route annotations go to S25.
- Final judgment calls, acceptance notes, and client-review annotations go to S27.

## Workflow PDF Planning Deltas

The workflow PDF adds the following product requirements beyond the first Friday slice:

- Estate name must be a first-class search seed, not just an optional note.
- Owner type matters: individual owners continue; company-owned properties should be disqualified or marked out of scope.
- Recent sale within 5 years is a disqualification rule unless the client overrides it.
- Tax history must track 2+ years unpaid taxes, reassessment changes, receipt status, and payer identity.
- Deed/OR book-page checks must capture ownership activity, adverse possession, mailing address changes, mortgages, liens, and Lis Pendens/foreclosure signals.
- Probate/court work must include civil, family, probate, official records, affidavits of heirs, marriage licenses, docket status, and case-specific document requests.
- Heirship research should capture DOB/DOD, obituary links, family tree hypothesis, spouse/children/sibling/parent relationships, mailing addresses, phone/email placeholders, incarceration status, and PI/manual research handoff.
- Lead quality must be configurable in Settings. Generic probate/data pulls are source seeds only; promotion should depend on a tunable signal stack across probate, property, tax, deed/title, mailing-address, code-enforcement, and timing signals.
- Outreach scripts and offer templates belong in a draft library with review gates; live calls, texts, emails, neighbor outreach, and external sends stay excluded until compliance approval.
- Completed lead reports need offer/profit math inputs: as-is value, taxes, liens, mortgages, selling costs, probate costs, partition costs, post-equity value, heirs, equity per heir, buy percentage, offer, and minimum profit.

## Post-Friday Roadmap

### S5 - Workflow Rules + Tax/Deed Depth

Status: **Done** (2026-05-28, Linear `HEI-30` / `HEI-41`–`HEI-45`)

Goal: encode the real "running the play" qualification rules and lead-quality settings behind the dry-run system.

Tracks:

1. `S5-T1: Workflow Rule Contract`
   Add explicit continue/stop/review statuses for individual owner, company owner, recent sale within 5 years, adverse possession, missing source refs, review-required claims, and configurable lead-quality signal toggles.

2. `S5-T2: Tax History Adapter Plan`
   Capture unpaid-tax years, tax amounts, receipt status, reassessment changes, and payer identity. Keep PDF receipt download as manual until source access is validated.

3. `S5-T3: Deed + OR Book/Page Evidence`
   Model deed links, OR book/page refs, ownership changes, mortgages, liens, Lis Pendens/foreclosure signals, and mailing-address deltas.

4. `S5-T4: Lead Disqualification Queue`
   Surface company-owned, recently sold, missing-property, missing-title, source-blocked, and low-signal generic-pull leads as explicit dashboard states.

5. `S5-T5: Source Evidence QA`
   Validate every workflow rule and lead-quality toggle with source refs or visible review flags.

### S6 - Probate + Heirship Research

Status: **Done** (2026-06-01, Linear `HEI-31` / `HEI-46`–`HEI-49`, `HEI-55`)

Goal: turn the court/probate/family-tree workflow into an auditable research queue.

Tracks:

1. `S6-T1: Estate-Name Search Path`
   Promote estate name to a primary seed alongside address, owner, folio, and case number.

2. `S6-T2: Probate/Civil/Family Docket Model`
   Track case number, docket status, affidavit of heirs, probate document availability, official-record cross-links, and stuck-estate timing signals for lead-quality scoring.

3. `S6-T3: Marriage + Death Indicator Checks`
   Represent marriage licenses, obituary links, DOB/DOD, death certificate status, Findagrave/Legacy links, and manual vital-record steps.

4. `S6-T4: Family Tree Hypothesis`
   Model spouse, children, parents, siblings, grandparents, aunts/uncles, cousins, nieces/nephews, confidence, and unresolved research questions.

5. `S6-T5: Paid/Manual Source Governance`
   Inventory IDI, Intelius, Ancestry, ForeWarn, PI requests, voter records, incarceration records, code-enforcement calls, door knocks, and neighbor research as approved/manual/blocked source categories.

### S7 - Completed Lead Report + Offer Math

Status: **Done** (2026-06-01, Linear `HEI-32` / `HEI-50`–`HEI-54`)

Goal: generate the report format operators actually use before outreach or negotiation, including explainable quality reasons.

Tracks:

1. `S7-T1: Completed Lead Report Schema`
   Capture every "running the play" step, backstory, source links, missing data, review flags, and family tree notes.

2. `S7-T2: Offer/Profit Inputs`
   Model as-is value, taxes due, liens, mortgages, selling costs, probate costs, partition costs, post-equity value, heir count, equity per heir, buy percentage, offer, profit, and minimum net profit.

3. `S7-T3: Report Renderer`
   Generate an internal report from the dossier with workflow sections aligned to the PDF template.

4. `S7-T4: CRM Field Expansion`
   Map estate name, family tree status, tax flags, title flags, probate status, lead-quality profile, offer math, and next action into CRM-ready fields.

5. `S7-T5: Human Review Gate`
   Require operator approval before any report becomes outreach-ready.

### S8 - Outreach Draft Library + Follow-Up Workflow

Status: **Done** (2026-06-01, local validation; Linear `HEI-33` / `HEI-56`–`HEI-60`)

Goal: preserve HeirRight's scripts and follow-up rhythm without creating unapproved live outreach automation.

Tracks:

1. `S8-T1: Script Inventory`
   Convert unclassified associate, neighbor, relative, owner, only-heir, closing-call, text, email, and offer templates into draft assets.

2. `S8-T2: Compliance Review State`
   Mark every script as draft, approved, retired, or blocked. Default is draft.

3. `S8-T3: Follow-Up Task Model`
   Represent calling each lead 3 times, voicemail/text follow-up, repeated follow-up windows, and escalation to Joshua as CRM tasks.

4. `S8-T4: Outreach-Ready Criteria`
   Define the evidence and approvals required before a lead can move from research to outreach.

5. `S8-T5: No-Auto-Send Guard`
   Enforce no automated calls, texts, emails, or external document sends without explicit future approval.

### S9 - Podio Claude Cowork Automation + Sales Queue Validation

Status: **Partially unblocked / local prep ready**. Authenticated browser audit confirmed the Texas Equity Pros LLC `Leads` app and field shape, and the worker now has a guarded bearer-token export/readback path. Live proof still waits on approved API runtime config, one clearly labeled controlled test write, CSV backup access, and successful item/task/comment readback.

Goal: prove the Podio automation path without risking Joshua's existing data or team workflow.

Tracks:

1. `S9-T1: Podio Technical + MCP Validation`
   Test Podio API, hooks/webhooks, MCP, app structure, field model, auth, live-write safety, and readback.

2. `S9-T2: CSV Migration Dry Run`
   Export Podio/Sheets data to CSV and import into a sandbox model without mutating the original system.

3. `S9-T3: Claude Cowork Podio Automation Artifact`
   Build the worker/artifact contract that syncs lead engine outputs into Podio and owns workflow automation without core Zapier dependency.

4. `S9-T4: Podio Workflow Loop Test`
   Validate item creation, task creation, report linking, status transitions, hook/readback behavior, and failure blockers.

5. `S9-T5: Team Adoption Gate`
   Validate that the workflow is usable for Joshua's team's technical comfort level before scaling automation.

### S10 - Website Redesign

Status: **Done** (2026-06-03, Linear `HEI-35` / `HEI-66`–`HEI-70`)

Goal: redesign the public HeirRight website after the lead engine reaches forward testing.

Tracks:

1. `S10-T1: Website Content Intake`
   Gather current website, brand assets, disclaimers, examples, and preferred positioning.

2. `S10-T2: Visual Direction Prototypes`
   Present multiple artistic directions for Joshua to choose from.

3. `S10-T3: Copy/Layout Drafts`
   Prepare 2-3 copy and layout options. S10-T3 draft packet is ready for Joshua/Sam selection in `docs/HEIRRIGHT_SITE_COPY_LAYOUT_DRAFTS.md`.

4. `S10-T4: Build + Polish`
   Build the selected direction into a sharp, modern site. Civic Ledger is implemented in `site-v2/`.

5. `S10-T5: Launch QA`
   Validate mobile, desktop, forms, analytics, and handoff. Launch QA is recorded in `docs/HEIRRIGHT_SITE_LAUNCH_QA.md`.

### S11 - White-Labeled Operator Shell Foundation

Status: **Done locally** (2026-06-03, Linear `HEI-36` / `HEI-71`-`HEI-75`)

Goal: extract a reusable Solvys operator shell pattern after HeirRight validates the MVP.

Tracks:

1. `S11-T1: Project Shell Contract`
   Define the reusable project-shell contract without forcing a generic HeirRight UI. Landed in `docs/S11_OPERATOR_SHELL_FOUNDATION.md` with `ProjectShellConfig`, nav, workspace slots, composer commands, activity events, guardrails, and a HeirRight config example.

2. `S11-T2: HeirRight Shell MVP Pattern`
   Identify the HeirRight-specific shell behavior that should become reusable. Landed in `@ple/artifact` with Source Runs, Dossiers, Lead Reports, CRM Queue, Documents, Blockers, Settings, bottom composer, activity drawer, lead-quality controls, runtime/Linear panel, and admin counters.

3. `S11-T3: Solvys Admin Analytics Hub`
   Define the Solvys-side visibility layer for cross-project analytics and deeper Solvys-1 control. Landed as a provider-agnostic event inventory for shell views, commands, settings changes, staged runs, exports, blockers, and Linear sync.

4. `S11-T4: Local Runtime + Linear Sync`
   Keep build/test/dry-run/artifact preview and Linear sync reproducible. Landed as a local command registry, browser-execution boundary, and Linear sync state model with Linear still authoritative.

5. `S11-T5: Extraction + Solvys-1/Fintheon Hooks`
   Document reusable integration hooks after the HeirRight pattern is validated. Landed as an extraction readiness checklist and `packages/shell-core` boundary proposal that keeps client-specific home screens project-owned.

### Milestone Human Testing Gates

- Project Semi-Automation Setup: supervised run-point dry run only.
- Pre-Alaska MVP Testing Handoff: human testing covers S5-S9 together.
- 30-Day Workflow Automation Milestone: human testing covers automation percentage, Podio workflow readiness, draft follow-up tasks, and website readiness if S10 is included.
- 90-Day Deal Engine Milestone: human testing covers document prep automation, Podio-backed deal engine flow, and reusable shell extraction.
