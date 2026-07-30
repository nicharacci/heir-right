# HeirRight Retrospective Discovery

Date: 2026-06-15
Mode: retrospective `solvys-discovery` run on an existing app
Canonical repo: `/Users/tifos/Documents/Codebases/heir-right`

## Project Brief

Project name: HeirRight Deal Engine / HWRITE

One-line mission: turn HeirRight's inherited-property research workflow into a guarded lead engine that creates evidence-backed lead packets, completed lead reports, and reviewed handoffs into the team's work queue.

Primary users:

- HeirRight operators and Joshua's team, who need reviewable lead packets and follow-up work queues.
- Solvys/Codex run-point agents, who need reliable build, test, dry-run, and blocker evidence.
- Sam/TP at milestone gates, where credentials, approvals, and acceptance decisions are made.

Core problem:

HeirRight does not just need more probate/property data. It needs a system that separates weak public-source seeds from qualified leads, packages evidence into operator-ready reports, and moves only reviewed work into Google/Podio without pretending external actions succeeded.

Platform:

- `probate-lead-engine/apps/worker`: TypeScript worker and Cloudflare-compatible HTTP surface.
- `probate-lead-engine/apps/artifact`: local/operator artifact shell.
- `site-v2`: public website draft.
- `sprint-md/` and `docs/run-point-daily/`: planning and run-point truth.

Timeline pressure:

- Pre-Alaska MVP before Joshua left on 2026-06-06.
- 30-day milestone on 2026-06-21: 60%+ front-end qualified lead generation and completed report automation, plus draft/manual-review follow-up workflow scaffolding.
- 90-day milestone on 2026-08-20: full document-prep automation and a functioning deal engine.

Existing assets inspected:

- `docs/HEIRRIGHT_LEAD_ENGINE_PRD.md`
- `docs/HEIRRIGHT_IMPLEMENTATION_ROADMAP.md`
- `docs/HEIRRIGHT_WORKFLOW_ROADMAP_GAP_ANALYSIS.md`
- `docs/HEIRRIGHT_ZOOM_ONBOARDING_NOTES_SYNTHESIS.md`
- `docs/FRIDAY_HANDOFF_RUNBOOK.md`
- `docs/CLAUDE_COWORK_PODIO_AUTOMATION_ARTIFACT.md`
- `docs/HWRITE_ADMIN_SHELL_PLAN.md`
- `sprint-md/S1-*` through `sprint-md/S15-*`
- `probate-lead-engine/apps/worker/output/*.md`
- `probate-lead-engine/apps/worker/output/*.json`
- Worker source files under `probate-lead-engine/apps/worker/src/`

## Research Taste Ledger

### Problem Thesis

The original outcome was a working real-estate probate lead operating system, not just a polished dashboard. The system should ingest public-source/property/probate inputs, produce raw evidence and completed lead reports, decide what is qualified versus merely reviewable, and hand off approved work to the client's operating queue with live readback.

That problem is still worth solving now because the client is returning from their trip on 2026-06-16, and the repo currently has a credible dry-run engine but not the production-volume/live-readback evidence needed for 30-day acceptance.

### Rejected Problems

- Generic website refresh: rejected as the core problem because the website is secondary to lead-engine delivery.
- Generic CRM migration: rejected because Podio remains the leading path until smoke tests disprove it.
- Fully autonomous outreach: rejected because compliance approval, contact enrichment, legal language, and external sends are explicitly blocked.
- "Any probate lead list" generation: rejected because the workflow requires source convergence and review before a record counts as qualified.
- Heavy white-labeled shell extraction: rejected until HeirRight validates the pattern with real operator use.

### Inputs That Changed The Thesis

- `HEIRRIGHT_LEAD_ENGINE_PRD.md`: made the target a lead system with source facts, raw dossiers, CRM adapter dry-run, reports, operator dashboard, milestone gates, and live-readback blockers.
- `HEIRRIGHT_WORKFLOW_ROADMAP_GAP_ANALYSIS.md`: clarified that the real workflow is a staged investigation play: owner qualification, recent sale stop rules, tax/deed/probate/heirship research, family tree, offer math, and reviewed outreach.
- `HEIRRIGHT_ZOOM_ONBOARDING_NOTES_SYNTHESIS.md`: preserved the time pressure and the 30-day/90-day success metrics.
- `HEIRRIGHT_IMPLEMENTATION_ROADMAP.md`: showed that S5-S15 are largely implemented as local/dry-run and guarded systems.
- `thirty-day-milestone-evidence.md`: proved the core acceptance result is still blocked: 2 raw leads, 0 qualified leads, no production county seed batch, no Google live readback, no Podio live readback.
- Worker source inspection: showed property and official-record adapters mostly prove source reachability and seed facts, not robust structured extraction.

### Assumptions To Test

- Hypothesis: production-volume seed ingestion plus structured source extraction will convert the app from honest dry-run to real 30-day acceptance candidate.
- Evidence: current daily run uses default review seeds and reports 2 raw / 0 qualified; qualification integrity correctly refuses to count weak records.
- Expectation: once approved production seeds and reliable source extraction land, raw volume can rise first, then qualified volume can rise as missing source flags are resolved.
- Risk: source extraction is harder than expected because public county apps may require browser automation, endpoint discovery, or manual/batch imports.
- Fastest falsifying test: load an approved 20-50 record production seed batch and run source extraction against Miami-Dade for property, tax, deed, and probate fields. If fewer than 30-40% of records resolve enough facts for report review, the current automation path cannot plausibly hit the 30-day goal without manual import or a different source strategy.
- Belief update if wrong: if county extraction fails at scale, pivot from "automated county scraping first" to "client-approved seed/import + operator-assisted extraction queue first."

### Raw Outputs To Inspect

- `probate-lead-engine/apps/worker/output/daily-run.json`
- `probate-lead-engine/apps/worker/output/thirty-day-milestone-evidence.md`
- `probate-lead-engine/apps/worker/output/completed-lead-report.md`
- `probate-lead-engine/apps/worker/output/internal-summary.md`
- `probate-lead-engine/apps/worker/output/export-result.json`
- `probate-lead-engine/apps/worker/output/podio-live-export-result.json`
- Artifact UI in local review mode.
- Any client-supplied production county seed batch.
- First controlled Google/Podio readback results.

### People Signal

- Joshua: can say whether the report and queue match the actual operator workflow.
- Sam: can provide or decline production seeds, Google/Podio credentials, write approval, and milestone acceptance.
- HeirRight operator/sales user: can falsify whether the generated review packet is enough to act on.
- Compliance/legal reviewer: can approve or block outreach/script/document language.

## Initial Problems And Verdicts

| Original problem | Current verdict | Evidence | What remains |
| --- | --- | --- | --- |
| Run a public-source property-first dry run without enrichment | Mostly solved | `pnpm --filter @ple/worker test` passed on 2026-06-15 with 49 facts and generated run/dossier/report outputs. | Public sources are often reachability/status plus placeholders, not reliable structured extraction. |
| Produce raw source facts and a no-enrichment dossier | Solved for dry-run/review mode | `latest-run.json`, `latest-dossier.json`, and reports show source refs, review flags, and no-enrichment guardrails. | Needs production seed batches and higher source fact completion. |
| Encode HeirRight's actual "running the play" workflow | Partially solved | S5-S8 models exist: owner/recent-sale rules, tax/deed/probate queues, family-tree hypothesis, offer math, outreach drafts, no-auto-send guard. | Many fields remain missing/manual-review because adapters do not yet extract enough real county data. |
| Separate weak seeds from qualified leads | Solved as a guardrail | Current daily run reports 2 raw, 0 qualified, and does not count review-only records as qualified. | Need enough source convergence to produce real qualified leads. |
| Hit 30-day automation goal: 60%+ front-end qualified lead/report automation | Not solved | Fresh `milestone:30-day` on 2026-06-15 reports `overallStatus: blocked`, 2 raw leads, 0 qualified leads, 5 blocked gates. | Production county seed batch, raw volume, qualified volume, Google live readback, Podio live readback. |
| Create completed lead reports with review gates | Partially solved | `completed-lead-report.md` includes backstory, checklist, tax/deed/probate/family-tree, offer math placeholders, source links, review flags, outreach blockers. | Missing data still dominates the report: folio, tax amount, latest deed, probate case number, date of death, as-is value. |
| Route work to Google/Podio with readback | Partially solved | Dry Google/Podio exports pass and expose skipped live readback blockers. Podio field map includes Texas Equity Pros Leads preset. | Missing live credentials, target config, controlled write approval, test contact values, and successful readback. |
| Keep outreach and external actions safe | Solved as a guardrail | No-auto-send and external-use blocked states are present in reports and milestone gates. | Compliance approval and approved disclaimer language remain absent, so no live outreach should exist yet. |
| Provide an operator shell instead of raw repo tooling | Mostly solved locally | HWRITE shell has navigation, report rail, blocker states, command deck, activity drawer, settings, runtime/Linear panel, and prep-only export language. | Needs real operator/client validation; not enough to claim practical production readiness. |
| Redesign public site | Mostly solved as demo/launch prep | `HEIRRIGHT_SITE_LAUNCH_QA.md` passed with launch approval notes. | Intake destination, final claims/disclaimers, and public production routing still need approval. |
| Prove a reusable Solvys operator shell pattern | Not ready to extract | S11 docs and local shell exist. | Extraction should wait until HeirRight is validated against real operator workflow and live handoffs. |

## Short Answer

We solved the dry-run/trust layer. We have not solved the full client business outcome yet.

The most important thing we solved is honesty: the system generates review packets, shows missing facts, blocks outreach, and refuses to count weak seeds as qualified. That is a real foundation.

The problem we have not solved is production throughput: approved production seed ingestion, structured source extraction, qualified lead volume, and live Google/Podio readback.

## Current Validation Snapshot

Commands run from `/Users/tifos/Documents/Codebases/heir-right/probate-lead-engine` on 2026-06-15:

```bash
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker milestone:30-day
```

Results:

- Build passed across `@ple/types`, `@ple/worker`, and `@ple/artifact`.
- Worker validation passed with 49 facts and generated run, dossier, Podio dry-run, summaries, and completed-report outputs.
- Daily run passed technically but produced 2 raw leads, 0 qualified leads, 2 review leads, and missed-volume blockers.
- Dry export passed for Google and Podio, but both routes skipped live readback.
- 30-day milestone evidence passed as a command but reported `overallStatus: blocked`, `blockedGateCount: 5`.

## MIT Repo / Architecture Selection

This was a retrospective discovery on an existing codebase, so no new MIT repo was selected. The effective current architecture is:

- Turborepo + pnpm workspace.
- TypeScript worker with Cloudflare-compatible HTTP entry.
- Static artifact app served from `apps/artifact`.
- Shared types in `packages/types`.
- Vite-based public site in `site-v2`.
- Direct Google/Podio integration paths with guarded dry-run and live-readback checks.

Recommendation: do not introduce a new starter or framework now. The unsolved problem is source acquisition, seed volume, credentialed readback, and operator validation, not app scaffolding.

## Design Inspirations And Existing Direction

No new visual prototypes were generated in this retrospective pass because the app already has an approved local visual direction and shell foundation. The useful design lessons are:

- Operator UI should be a work queue, not a generic dashboard: Source Runs, Dossiers, Lead Reports, CRM Queue, Documents, Blockers, Settings.
- State labels matter more than decoration: `needs_source`, `review_ready`, `blocked`, `stage_for_crm`, `sent_to_crm`.
- Export controls must show prep/live/readback status inline instead of optimistic success.
- The report rail should show human review work, not raw JSON.
- Public marketing should stay separate from operator proof; a launch-ready site does not prove lead-engine readiness.

## Implementation Plan To Actually Solve The Remaining Problems

### Sprint S16: Production Seed Intake And Acceptance Batch

Goal: replace default review seeds with an approved production county seed batch and make seed provenance visible.

Features:

1. Production seed file contract
   - Add a checked-in sample schema and runtime loader for `DAILY_RUN_SEEDS_JSON` or `apps/worker/input/production-seeds.json`.
   - Required fields: county, estate name or property address or folio or case number, seed source, source owner, approval marker.
   - Reject unlabeled default/test seeds from milestone acceptance.

2. Seed review/import CLI
   - Add `pnpm --filter @ple/worker seeds:validate`.
   - Validate dedupe keys, missing identifiers, county support, and source provenance.
   - Output an operator-readable import report.

3. Small production-batch falsifier
   - Run a 20-50 seed batch before attempting the 200-400 target.
   - Measure source coverage, dead letters, duplicate rate, missing fields, and time per lead.

Exit criteria:

- `milestone:30-day` reports `seedSource: configured_batch`.
- Default review seeds cannot satisfy acceptance.
- A batch ledger shows seed provenance and failure piles.

Guardrails:

- No lead-volume claim from default review seeds.
- No paid-source data unless approved.
- No live outreach or CRM writes from seed import.

### Sprint S17: Source Extraction Upgrade

Goal: move from source reachability to structured source facts for Miami-Dade property, tax, deed/title, and probate/court signals.

Features:

1. Property/tax extraction path
   - Upgrade `property-appraiser.ts` and `tax-history.ts` from reachability/placeholders to structured extraction where possible.
   - Prefer official or stable endpoints. If none exist, add browser-assisted extraction behind a clear adapter boundary.

2. Official records/deed extraction path
   - Extract latest deed, OR book/page or instrument number, last-sale date, mortgage/lien/Lis Pendens/foreclosure/adverse possession indicators.
   - Preserve source URL, raw ID, fetched timestamp, confidence, and review flags.

3. Probate/court extraction path
   - Extract case number, case status, document availability, affidavit-of-heirs status, and docket links for estate/case-number seeds.

Exit criteria:

- At least 30-40% of the small production batch has real extracted values for property identity, tax status, deed/title, and probate/case status.
- Reports show fewer placeholder missing sections for extracted records.
- Source-health-only facts are not treated as source evidence.

Guardrails:

- If browser extraction is used, keep it isolated and repeatable.
- Do not scrape paid/manual sources.
- Do not infer legal heirship from weak public signals.

### Sprint S18: Qualification Promotion Loop

Goal: turn extracted evidence into qualified/review/disqualified outcomes that match HeirRight's actual workflow.

Features:

1. Evidence coverage scoring
   - Add a visible source-coverage profile per lead: property, owner, tax, deed, probate, family tree, offer math.
   - Keep qualification separate from report completeness.

2. Lead-quality settings activation
   - Use existing lead-quality settings to drive qualification thresholds.
   - Add reason-code rollups for why each record is not qualified.

3. Operator spot-check packet
   - Generate a `qualification-review.md` packet with a sample of qualified, review, disqualified, duplicate, and dead-letter records.

Exit criteria:

- The system can produce a small number of qualified candidates from real source evidence or honestly report why none qualify.
- No lead with open core blockers is counted as qualified.
- Operator review can tune thresholds without a deploy.

Guardrails:

- Do not optimize for qualified count by weakening review gates.
- Do not count source reachability as source evidence.
- Do not use AI score as a substitute for source convergence.

### Sprint S19: Controlled Google And Podio Readback

Goal: prove the handoff loop with one controlled Google export and one controlled Podio write/readback.

Features:

1. Google Workspace readback
   - Configure `GOOGLE_WORKSPACE_ACCESS_TOKEN`, `GOOGLE_TRACKING_SHEET_ID`, optional Drive parent folder, and Sheet range.
   - Create folder, create Doc, write report, append Sheet row, read back Doc link.

2. Podio controlled write
   - Configure `PODIO_ACCESS_TOKEN`, `PODIO_APP_ID=24265877`, `PODIO_TEST_PHONE`, `PODIO_TEST_EMAIL`, `PODIO_LEAD_POINT_PROFILE_ID`, and `PODIO_LIVE_WRITE_APPROVED=true`.
   - Create one clearly labeled `HEIRRIGHT TEST - DO NOT WORK - <timestamp>` item.
   - Create source-note/comment, review task, report link, then read back item.

3. Readback evidence packet
   - Emit a single markdown packet with IDs, URLs, timestamps, field/task/comment verification, and cleanup/rollback note.

Exit criteria:

- `export:podio-live-test` returns `readbackOk: true`.
- Google live route returns `readbackOk: true`.
- `milestone:30-day` no longer blocks on Google/Podio live readback.

Guardrails:

- One controlled test write only until approved.
- CSV backup/export access should be confirmed before treating Podio live proof as milestone evidence.
- No real outreach, no external send.

### Sprint S20: 30-Day Acceptance Run

Goal: run the first acceptance-grade evidence packet for Sam/Joshua.

Features:

1. Production-volume run
   - Run approved seeds toward the 200-400 raw / 80-150 qualified target.
   - Capture duplicate, dead-letter, source coverage, and qualified/review/disqualified counts.

2. Acceptance packet
   - Extend `milestone:30-day` with links to seed batch, source coverage, qualification-review packet, Google/Podio readback packet, and external-use guard evidence.

3. Client review script
   - Prepare a 30-minute review agenda: what is automated, what remains manual, what proof exists, what decisions unblock the next milestone.

Exit criteria:

- `overallStatus` is either `ready_for_human_review` or blocked by a small named set of non-repo decisions.
- The packet clearly answers: raw volume, qualified volume, report completeness, Google/Podio readback, no-auto-send guard, and next actions.

Guardrails:

- Do not claim 60% automation unless the packet shows it.
- Do not claim a qualified lead from default seeds.
- Do not hide missing source coverage behind UI polish.

## Feature Specs

### Feature: Production Seed Intake

Outcome basis: the operator can load an approved county seed batch so daily runs measure real production input instead of demo defaults.

User journey segment: before daily run and 30-day milestone packet generation.

CTAs:

- Primary CTA: Validate seed batch -> run schema/provenance validation.
- Secondary CTA: Run daily batch -> execute `run:daily` with the configured batch.
- Contextual CTA: Review dead letters -> inspect failed seeds.

Hook model:

- Trigger: Sam/Joshua provides a county seed list or asks whether the app is acceptance-ready.
- Action: validate and run the batch.
- Variable reward: which seeds resolve enough evidence and which fail.
- Investment: the team improves seed quality and source provenance over time.

Acceptance criteria:

- `seedSource` is `configured_batch`.
- Invalid or unapproved seeds fail with visible reasons.
- Milestone evidence links the batch used.

Hard scope guardrails:

- Does not approve paid-source enrichment.
- Does not create CRM records.
- Does not count raw seeds as qualified.

Risks:

- Technical risk: seed formats vary.
- UX risk: operators may treat seed import as qualification.
- Mitigation: show `raw`, `review`, and `qualified` as separate counts everywhere.

### Feature: Structured Source Extraction

Outcome basis: the app can extract real property, tax, deed/title, and probate facts so reports contain evidence instead of placeholder review tasks.

User journey segment: during dry-run/daily-run source acquisition.

CTAs:

- Primary CTA: Run source extraction -> fetch source facts for a seed.
- Secondary CTA: Open source -> inspect the official source manually.
- Contextual CTA: Mark extraction blocked -> preserve blocker and next action.

Hook model:

- Trigger: a seed is missing facts required for qualification.
- Action: run extraction adapters.
- Variable reward: some public sources resolve cleanly, some require manual/browser fallback.
- Investment: resolved extraction paths improve future batches.

Acceptance criteria:

- Extracted facts have source refs and timestamps.
- Missing facts produce review flags, not silent nulls.
- Source reachability is not counted as source evidence.

Hard scope guardrails:

- Does not automate paid/manual sources.
- Does not infer legal conclusions.
- Does not bypass county site constraints.

Risks:

- Technical risk: county apps may not expose stable endpoints.
- UX risk: users may over-trust low-confidence extraction.
- Mitigation: confidence, review flags, and source links stay visible.

### Feature: Qualification Promotion Loop

Outcome basis: the operator can see why a record is qualified, review-only, disqualified, duplicate, or dead-lettered.

User journey segment: after source extraction and before report/CRM handoff.

CTAs:

- Primary CTA: Review qualification -> inspect reason codes and source coverage.
- Secondary CTA: Tune lead settings -> adjust thresholds.
- Contextual CTA: Send back to source work -> create missing-source tasks.

Hook model:

- Trigger: daily run completes.
- Action: inspect lead buckets and reason codes.
- Variable reward: the operator discovers which records are real opportunities.
- Investment: tuning settings improves future qualification accuracy.

Acceptance criteria:

- No blocked/review-only lead is counted as qualified.
- Qualified leads have evidence coverage and no core blockers.
- Disqualified leads preserve stop reasons.

Hard scope guardrails:

- Does not use AI score as a primary qualification basis.
- Does not optimize counts by weakening gates.
- Does not trigger outreach.

Risks:

- Technical risk: strict rules may produce 0 qualified leads until source extraction improves.
- UX risk: client may read 0 qualified as failure instead of truth.
- Mitigation: show failure piles and next actions, not just totals.

### Feature: Live Readback Proof

Outcome basis: the team can prove that reviewed report packets reach Google/Podio and can be read back before any milestone claims live workflow readiness.

User journey segment: after report review and before milestone acceptance.

CTAs:

- Primary CTA: Run controlled readback -> execute approved Google/Podio live test.
- Secondary CTA: View readback packet -> inspect IDs, URLs, fields, and blockers.
- Contextual CTA: Keep dry-run -> prepare handoff without live write.

Hook model:

- Trigger: Sam/Joshua provides credentials and explicit write approval.
- Action: create one controlled export and read it back.
- Variable reward: live systems either accept the workflow or reveal field/permission failures.
- Investment: field mapping and credentials become reusable for later accepted runs.

Acceptance criteria:

- Google live export returns readback evidence.
- Podio controlled write returns readback evidence.
- Failed readback writes named blockers.

Hard scope guardrails:

- One controlled test write until approved.
- No real outreach.
- No success state without readback.

Risks:

- Technical risk: Podio required fields or permissions fail in live workspace.
- UX risk: a test item could be mistaken for real work.
- Mitigation: label test items clearly and require explicit write approval.

## Sprint Plan

| Sprint | Goal | Exit criteria |
| --- | --- | --- |
| S16 | Production seed intake | Approved batch loads, validates, and marks `seedSource: configured_batch`. |
| S17 | Structured source extraction | Property/tax/deed/probate fields resolve for a meaningful share of a small batch, with source refs. |
| S18 | Qualification promotion loop | Real extracted evidence can promote leads or honestly explain why none qualify. |
| S19 | Controlled Google/Podio readback | One Google and one Podio handoff have live readback proof. |
| S20 | 30-day acceptance run | Acceptance packet is ready for human review or blocked only by explicitly named non-repo decisions. |

## UX And Interaction Spec

Use the existing HWRITE shell language:

- State chips: Needs source, Ready for review, Blocked, Stage for CRM, Sent to CRM.
- Inline status text instead of toast popups.
- Export buttons must show dry-run/live/readback state.
- Report rail should stay readable and operator-facing.
- Blocker drawer should group source gaps, credential gaps, legal/compliance gaps, paid-source approvals, and client decisions.

Micro-interactions:

- Button hover: border opacity, 150ms.
- Button click: scale to 0.98, 100ms.
- Panel/drawer open: opacity plus subtle translate, 200-250ms.
- Tab switch: content crossfade, 150-200ms.
- Loading state: compact inline `[RUNNING]`, `[BLOCKED]`, `[READY]`; no full-page skeleton.

Icons and fonts:

- Keep one line-icon system if adding new icon buttons.
- Keep operator screens dense and plain-language.
- Do not introduce new brand fonts until public site approval changes.

## Design System Summary

Current direction:

- Operator app: HWRITE shell, frosted/neutral operator workspace, state-forward UI.
- Public site: Civic Ledger direction in `site-v2`.

Design rules for next implementation:

- No optimistic success colors for unproven CRM/export actions.
- No dashboard cards that hide source gaps.
- Use structured lists and review queues instead of kanban.
- Keep public marketing copy separate from operator evidence.
- Preserve no-auto-send and external-use blocked states in every surface.

## Architecture Decision Record

Frontend:

- Artifact app: static HTML shell served by `@ple/artifact`.
- Public site: Vite + TypeScript under `site-v2`.
- Component approach: project-owned shell markup for now; reusable shell extraction deferred.

Backend / worker:

- TypeScript worker under `@ple/worker`.
- Cloudflare-compatible entry in `cloudflare.ts`.
- Local CLI commands for dry runs, daily runs, exports, Podio test, and milestone evidence.

Data model:

- Shared types in `@ple/types`.
- Outputs written to `apps/worker/output/`.
- Current seed batch hook: `DAILY_RUN_SEEDS_JSON`.

Integrations:

- Google Workspace export/readback path exists but needs credentials and live proof.
- Podio export/readback path exists with Texas Equity Pros Leads preset but needs bearer token, required test values, explicit approval, and readback proof.
- County/public sources currently mix reachability checks with placeholder/manual-review facts; this is the main implementation gap.

Hosting:

- Worker can deploy to Cloudflare.
- Demo/public site has Vercel history.
- Live acceptance still depends on external secrets and approved runtime config.

## Visual Prototypes

No new Superdesign prototypes were generated in this retrospective pass. Existing relevant design artifacts:

- `docs/HWRITE_ADMIN_SHELL_PLAN.md`
- `docs/S11_OPERATOR_SHELL_FOUNDATION.md`
- `docs/HWRITE_VISUAL_DIRECTION.md`
- `docs/HEIRRIGHT_SITE_LAUNCH_QA.md`

Prototype decision:

- Continue with the HWRITE operator shell for app work.
- Continue with Civic Ledger for public-site work unless the client changes direction.
- Do not spend the next sprint on new visual exploration; spend it on source extraction, seed ingestion, readback, and acceptance evidence.

## Final Discovery Verdict

The original problems were not purely UI problems. They were evidence, qualification, and handoff problems.

Solved:

- dry-run lead engine foundation;
- raw dossier/report generation;
- review and no-auto-send guardrails;
- operator shell shape;
- public site demo/launch-prep surface;
- honest milestone evidence command.

Not solved:

- production-volume seed ingestion;
- reliable structured public-source extraction;
- qualified lead volume;
- Google live readback;
- Podio live write/readback;
- client/operator acceptance of real workflow output;
- 30-day automation claim.

The next implementation should therefore be S16-S20 above. Anything else risks polishing a demo around the same unsolved business gap.
