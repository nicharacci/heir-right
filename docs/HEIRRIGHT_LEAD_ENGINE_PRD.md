# HeirRight Lead Engine PRD

Status: Friday delivery record + contract-completion PRD
Owner: TP / Solvys
Client: HeirRight Real Estate
Target: S1-S21 delivery history preserved; S22-S27 complete the corrected contract scope

## Goal

Build the entire HeirRight operational lead system as a Friday-deliverable local/dry-run implementation. The first milestone is a live property-first public-source run without enrichment. The system must produce raw source facts, a no-enrichment dossier shell, a CRM adapter dry-run payload, an internal document summary, and an operator dashboard.

The planning roadmap now also captures the client's full "running the play" workflow as the post-Friday operating model: estate-name intake, owner qualification, property/deed/tax checks, probate/heirship research, lead-quality signal review, completed lead report generation, offer math, CRM work queues, document drafts, and human-reviewed outreach scripts.

The pre-Alaska MVP target is delivery before June 6, 2026 with at least 2 days for Joshua to test before leaving. The June 6-20 Alaska window should be used for debugging and refinement before full forward testing resumes.

HeirRight is also the first testbed for the Solvys white-labeled operator shell pattern. The shell should stay HeirRight-specific through MVP, then be extracted into reusable Solvys infrastructure after the MVP proves the pattern. Shared infrastructure must not force generic navigation or dashboard design across future client projects.

Podio is now the leading CRM path unless smoke tests disprove it. The lead engine should run as a Claude Cowork automation artifact that integrates directly with Podio through API, hooks/webhooks, MCP if acceptable, and scheduled worker jobs. Zapier is allowed only as a narrow fallback bridge, not as the core automation layer.

Post-Friday execution is milestone-based. S5-S11 can stay granular for agent execution and parallel Cursor Web PWA sessions, but human testing is requested only at milestone gates or when a blocker needs credentials, legal/compliance approval, live-write approval, or client acceptance. Daily run-point automation owns regression checks, smoke gates, Solvys UI audit, Linear updates, and human-attention assignment to `sam@solvys.io`.

## Corrected Contract Objective - 2026-06-29

The current acceptance target is contract completion, not proving lead-generation volume. The client explicitly wanted enriched leads now, plus the capability to generate leads later when the time comes.

Current scope:

- Automate both Doc Prep processes: Discovery and Closing.
- Ship the new website with landing, Terms of Use, and Privacy Policy content as readable public pages/subpages.
- Automate SMS and email outreach through Podio, Resend, or an owned app queue plus an approved SMS gateway. The app owns templates, approvals, audit, retries, and stop rules; SMS carrier delivery still requires a provider.
- Keep the user interface error-free on the tested app and website surfaces.
- Prove Google Sheets and Podio integrations with controlled writes and readback.

Lead generation remains a supported capability path, but it is no longer the deciding completion score for the current contract objective.

## Source Materials

- `Heir Right (Notion).pdf`
- `HeirRight Workflow. pdf.pdf`
- `HeirRight_Solvys_Project_Agreement_REVISED.pdf` / `.docx`
- `workflow_templates.md`
- `cloud_scraper_prd.md`
- `index.html`
- `leads.json`
- `proposal.html`
- `faces_handoff_prompt.md`
- `docs/HEIRRIGHT_CONTRACT_COMPLETION_PLAN_2026-06-29.md`
- `/Users/tifos/Downloads/Automation Project.pdf`
- `/Users/tifos/Downloads/AutomationProject .pdf`
- Zoom meeting notes link: blocked by Zoom Docs permissions as of May 21, 2026; user-supplied pasted notes are incorporated in `docs/HEIRRIGHT_ZOOM_ONBOARDING_NOTES_SYNTHESIS.md`.

## Friday Done

Friday done means:

- live public-source property-first search runs;
- official-record/title source status is checked where feasible;
- raw no-enrichment dossier renders;
- CRM adapter path is represented first, with Podio as the leading CRM path and Macro/Close as fallbacks;
- document automation dry-run produces an internal summary;
- landing/intake/operator artifact is runnable;
- missing external systems are blockers, not fabricated success.

Two-week MVP done means:

- estate-name-first intake/search path is represented;
- Miami-Dade property data collection targets the 60-70% automation goal;
- latest deed and lien collection are modeled as source facts or review tasks;
- lead-quality settings exist for configurable source-signal toggles, thresholds, and reason codes;
- completed lead report generation exists with tax/deed/probate/family-tree/offer sections;
- document prep scaffolding exists for 10+ closing-document templates;
- text/email follow-up sequences are scaffolded as draft/manual-review workflows;
- Podio path is validated through provider-neutral adapter smoke tests, with Macro and Close retained as fallback options.
- Claude Cowork worker/artifact path is defined for direct Podio workflow automation without core Zapier dependency.

Explicit exclusions:

- live outreach sends;
- guaranteed lead volume;
- legal review;
- new counties;
- enrichment for the first milestone;
- AI scoring by Friday unless explicitly re-added.

## Data Flow

```text
Live public source search -> SourceFact[] -> RawDossier -> CRM adapter dry-run -> DocumentPacket -> Operator Artifact
```

Future workflow-aligned flow:

```text
Estate/address/folio/case seed -> owner qualification -> property/deed/tax checks -> probate/heirship checks -> lead-quality settings + signal stack -> completed lead report -> Claude Cowork worker -> Podio queue -> document/outreach drafts -> human review
```

## Core Interfaces

Implemented in `@ple/types`:

- `SourceFact`: source, raw ID, fetchedAt, county, subject identifiers, fact type, value, confidence, source URL, review flags.
- `RawDossier`: lead summary, property claims, title events, narrative, CRM state, document packet, source refs, audit trail.
- `CrmAdapter`: `healthcheck()`, `dryRun(dossier)`, `sync(dossier)`, readback verification, and `describeRequiredConfig()`.
- `DocumentPacket`: draft review-required markdown and HTML outputs.
- `IntakeSeed`: operator/landing input for public-source runs.

Planned post-Friday interfaces:

- `LeadQualitySettings`: operator-controlled settings for source-signal toggles, thresholds, and scoring weights.
- `LeadQualityProfile`: explainable quality outcome with enabled signals, missing signals, score band, reason codes, and review flags.

## Execution Batches

The S1-S21 labels remain useful for brief paths, Linear issue grouping, and evidence history. They are not sprint-review loops. Agent work rolls up to milestone acceptance tickets, with human testing only at those gates.

The remaining completion pack is exactly six sprints:

- S22: Contract Completion PRD + Source Lock.
- S23: Discovery and Closing DocPrep Automation.
- S24: Outreach Automation + Google/Podio Integration.
- S25: Website + Legal Page Finalization.
- S26: Full-App Human-Practical Testing.
- S27: UX + Product Loop Human Review.

### S1 - Live Property + Records Search

Goal: first property-first public-source test, no enrichment.

Tracks:

- S1-T1: App Scaffold + Source Run Shell
- S1-T2: Miami-Dade Property Search Adapter
- S1-T3: Official Records / Clerk Signal Adapter
- S1-T4: Raw Dossier Shell
- S1-T5: Validation Harness

### S2 - CRM Adapter + Raw Dossier System

Goal: make the raw dossier operational and CRM-ready.

Tracks:

- S2-T1: Dossier Contract + Storage
- S2-T2: CRM Adapter Contract
- S2-T3: CRM Pipeline Model
- S2-T4: Dossier Narrative Only
- S2-T5: CRM Dry-Run Validation

### S3 - Document Automation

Goal: generate document-ready outputs from raw dossier and CRM fields.

Tracks:

- S3-T1: Template Inventory + Field Map
- S3-T2: Document Data Contract
- S3-T3: Internal Summary Generator
- S3-T4: PDF/Word Dry-Run Export
- S3-T5: Document Review Gate

### S4 - Landing, Intake, Deployable Demo, Handoff

Goal: connect the Friday delivery surface.

Tracks:

- S4-T1: Landing + Intake
- S4-T2: Operator Dashboard
- S4-T3: Deployment Prep
- S4-T4: End-to-End QA
- S4-T5: Handoff Packet

### S5 - Workflow Rules + Tax/Deed Depth

Goal: encode the client workflow rules and lead-quality signal stack behind "running the play."

Tracks:

- S5-T1: Workflow Rule Contract
- S5-T2: Tax History Adapter Plan
- S5-T3: Deed + OR Book/Page Evidence
- S5-T4: Lead Disqualification Queue
- S5-T5: Source Evidence QA

### S6 - Probate + Heirship Research

Goal: turn court/probate/family-tree work into an auditable research queue.

Tracks:

- S6-T1: Estate-Name Search Path
- S6-T2: Probate/Civil/Family Docket Model
- S6-T3: Marriage + Death Indicator Checks
- S6-T4: Family Tree Hypothesis
- S6-T5: Paid/Manual Source Governance

### S7 - Completed Lead Report + Offer Math

Goal: generate the report format HeirRight operators use before outreach, including the explainable lead-quality profile.

Tracks:

- S7-T1: Completed Lead Report Schema
- S7-T2: Offer/Profit Inputs
- S7-T3: Report Renderer
- S7-T4: CRM Field Expansion
- S7-T5: Human Review Gate

### S8 - Outreach Draft Library + Follow-Up Workflow

Goal: preserve scripts and follow-up rhythms as reviewed drafts without live outreach automation.

Tracks:

- S8-T1: Script Inventory
- S8-T2: Compliance Review State
- S8-T3: Follow-Up Task Model
- S8-T4: Outreach-Ready Criteria
- S8-T5: No-Auto-Send Guard

### S9 - Podio Claude Cowork Automation + Sales Queue Validation

Goal: validate Podio as the leading CRM path, prove direct automation/readback, and keep Macro/Close as fallback options only if Podio fails.

Tracks:

- S9-T1: Podio Technical + MCP Validation
- S9-T2: CSV Migration Dry Run
- S9-T3: Claude Cowork Podio Automation Artifact
- S9-T4: Podio Workflow Loop Test
- S9-T5: Team Adoption Gate

### S10 - Website Redesign

Goal: redesign the public site after lead engine delivery begins forward testing.

Tracks:

- S10-T1: Website Content Intake
- S10-T2: Visual Direction Prototypes
- S10-T3: Copy/Layout Drafts
- S10-T4: Build + Polish
- S10-T5: Launch QA

### S11 - White-Labeled Operator Shell Foundation

Goal: extract a reusable Solvys operator shell pattern after HeirRight validates the MVP.

Tracks:

- S11-T1: Project Shell Contract
- S11-T2: HeirRight Shell MVP Pattern
- S11-T3: Solvys Admin Analytics Hub
- S11-T4: Local Runtime + Linear Sync
- S11-T5: Extraction + Solvys-1/Fintheon Hooks

## Workflow Rules From Onboarding

Derived from `HeirRight Workflow. pdf.pdf`:

- Search by estate name must be supported as a primary lookup path.
- Qualified leads and bonus/warm leads are separate buckets.
- Round-robin call queues must support multiple contacts or 4-5 numbers on one opportunity.
- If the property is owned by a company, mark it out of scope or disqualified.
- If the property recently sold within 5 years, mark it out of scope or disqualified.
- Check mailing addresses, OR book/page, adverse possession, ownership activity, unpaid taxes, reassessments, receipt status, and tax payer identity.
- Check civil, family, probate, official records, affidavit of heirs, marriage licenses, obituary/death indicators, incarceration status, professional licenses, and family tree evidence.
- Treat "generic probate lead" or "any old data pull" as a seed only. A lead is promoted when multiple source signals converge.
- Expose lead-quality settings as app toggles so HeirRight can refine which signals count as qualification, review, or disqualification criteria.
- Treat IDI, Intelius, Ancestry, ForeWarn, VitalChek, PI services, code-enforcement calls, door knocks, and neighbor research as paid/manual/approval-required workflows.
- Generate completed lead reports with backstory, family tree, source links, tax/title/probate status, contact placeholders, and offer math.
- Keep all outreach scripts, text/email templates, and offer letters draft-only until reviewed.

## Lead Quality Settings

Generic probate or property pulls are not reliable enough to be treated as qualified leads. The app should treat raw source hits as seeds, then promote only the records that pass an explainable signal stack.

Settings must be configurable without a deploy so the team can tune the quality bar after real review sessions. The first settings surface should include toggles for:

- estate/property match required;
- probate/court signal required or bonus-weighted;
- stuck-estate timing window, initially 45-180 days from relevant filing/activity;
- mailing-address mismatch or out-of-area ownership;
- unpaid tax or tax-certificate friction;
- title/deed friction, including recent transfer, mortgage, lien, Lis Pendens, or foreclosure signals;
- code-enforcement or visible property-friction signals, gated until the source path is validated;
- company-owner and recent-sale disqualification;
- manual/paid-source evidence allowed only after approval.

Each toggle should carry an operator-facing label, default state, weight/threshold, reason code, and source-evidence requirement. Settings changes are configuration changes only; they do not approve live outreach or guarantee lead volume.

## White-Labeled Operator Shell Rules

- Client shells should be white-labeled and project-specific, not cookie-cutter dashboards.
- Navigation tabs must come from the project's operating model.
- The bottom composer remains the shared command surface.
- Agent visibility should be a lightweight drawer because most client projects will expose only one or two agent streams.
- The local runtime should make build, test, dry-run, artifact preview, and handoff validation repeatable.
- Linear remains the source of truth for milestone, issue, and status planning.
- OpenPanel or PostHog should be evaluated for analytics, error handling, and monitoring.
- Solvys needs an internal admin dashboard for cross-project analytics and deeper Solvys-1 controls.
- HeirRight should validate the pattern before extracting the generic shell.

## CRM Migration Rules

- Treat Podio as the leading CRM path unless smoke tests disprove it.
- Do not overbuild Podio before proving API/MCP/hooks/workflow behavior in the real workspace.
- Build the lead engine as a Claude Cowork automation artifact that can own orchestration outside Podio.
- Use direct Podio API/MCP/hooks before Zapier.
- Keep Zapier as a narrow fallback bridge only.
- Keep Macro and Close as fallback options if Podio fails automation/readback/team-fit gates.
- Use CSV export/import as the low-risk migration path.
- Run Podio and any replacement CRM in parallel only if fallback migration becomes necessary.
- Do not use Notion as the CRM system of record.

## Objective Milestones

Dates use the current project planning date of May 26, 2026.

- Project Semi-Automation Setup: May 27, 2026. Confirm the daily run-point automation, `/solvys-run-point` setup skill, Linear project/milestone structure, and a supervised Cursor Web PWA dry run.
- Pre-Alaska MVP Testing Handoff: June 4, 2026. Deliver a usable MVP before Joshua leaves on June 6, with at least two days available for testing.
- 30-Day Workflow Automation Milestone: June 21, 2026. Automate at least 60% of front-end qualified lead generation and completed lead report creation, plus scaffold text/email follow-up workflows as draft/manual-review Podio tasks.
- 90-Day Deal Engine Milestone: August 20, 2026. Complete document-prep automation and a functioning Podio-backed deal engine that produces qualified prospects with closing opportunities.

Human testing tickets exist only for these milestone gates. Day-to-day agent tickets remain implementation or validation tasks unless a blocker requires Sam/client action.

## Current Implementation

The workspace now contains:

- `probate-lead-engine/apps/worker`: local dry-run pipeline.
- `probate-lead-engine/apps/artifact`: operator artifact/dashboard.
- `probate-lead-engine/packages/types`: shared contracts.
- `docs/HEIRRIGHT_IMPLEMENTATION_ROADMAP.md`: S1-S11 execution roadmap and milestone plan.
- `docs/HEIRRIGHT_WORKFLOW_ROADMAP_GAP_ANALYSIS.md`: workflow PDF deltas, Zoom access blocker, and post-Friday planning gaps.
- `docs/HEIRRIGHT_ZOOM_ONBOARDING_NOTES_SYNTHESIS.md`: pasted meeting-note synthesis including timeline, CRM decision path, automation priorities, and website sequencing.
- `docs/CLAUDE_COWORK_PODIO_AUTOMATION_ARTIFACT.md`: Claude Cowork worker architecture for direct Podio automation without core Zapier dependency.
- `docs/HEIRRIGHT_RUN_POINT_AUTOMATION.md`: daily Codex Automation, Cursor Web PWA, Linear, and milestone gate operating plan.
- `docs/HEIRRIGHT_CONTRACT_COMPLETION_PLAN_2026-06-29.md`: corrected contract objective, S22-S27 completion pack, closing-template review, and IDI guardrails.
- `docs/FRIDAY_HANDOFF_RUNBOOK.md`: setup, outputs, blockers, acceptance.
- `linear/HEIRRIGHT_LINEAR_TICKETS.md`: parent ORCH + child ticket load sheet.
- `sprint-md/`: S1-S27 Solvys briefs and completion-pack briefs.

## Validation

Required commands:

```bash
cd probate-lead-engine
pnpm install
pnpm build
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker milestone:30-day
pnpm --filter @ple/worker test
pnpm --filter @ple/artifact build
pnpm --filter @ple/artifact dev
```

Expected outputs:

- `apps/worker/output/latest-run.json`
- `apps/worker/output/latest-dossier.json`
- `apps/worker/output/podio-dry-run.json`
- `apps/worker/output/internal-summary.md`
- `apps/worker/output/internal-summary.html`
- local dashboard at `http://localhost:4173`

## Known Blockers

- Google Sheets controlled write/readback needs target config and credentials.
- Podio controlled write/readback needs credentials, field map, controlled test values, CSV backup/export access, and explicit live-write approval.
- SMS delivery needs a provider decision if Podio-native SMS is unavailable; an OSS-owned app queue cannot deliver carrier SMS by itself.
- Macro and Close remain fallback candidates, not the leading path.
- Browserbase/browser automation credentials are not configured.
- Miami-Dade Property Search and Official Records are reachable, but reliable record extraction still needs endpoint discovery or browser automation.
- Native PDF/Word conversion is represented as HTML/markdown dry-run until conversion dependency is selected.
- Direct Zoom meeting notes are not readable from the supplied link; pasted notes are incorporated, but export/share is still needed for source provenance.
- IDI Core is expensive per run. The Asset Discovery pipeline may be verified once with approval, then must remain locked unless TP explicitly reopens it.
- Legal/compliance approval is still needed before closing templates or outreach copy are used externally.
