# HeirRight Run-Point Automation

Status: active contract-completion run-point plan
Owner: Codex Automation / Claude Cowork
Project root: `/Users/tifos/Documents/Codebases/heir-right`
Linear team: HeirRight
Active Linear project: HeirRight Deal Engine Automation
Daily trigger: 11:30 AM America/New_York
Current completion pack: S22-S27, six sprints total
Branch namespace source: `probate-lead-engine/package.json` reports `1.0.0`; first new-week branch should use `v1.1.0/heirright-contract-completion-<sprint-pair>`.

## Purpose

HeirRight is the first Solvys project where an orchestrated agent runs point across multiple days. The workflow keeps granular Linear tickets for agent execution, but moves human testing to milestone gates so Sam/Joshua only enter the loop when approval, credentials, legal/compliance review, live-write permission, or milestone acceptance is needed.

## Daily Flow

1. Review the previous day's local changes, automation output, Cursor Web PWA sessions, and Linear updates.
2. Run the repo smoke gates before starting new work.
3. Fix broken builds, tests, dry-runs, or UI regressions first.
4. Run a Solvys design-guideline UI audit on changed surfaces.
5. Open Cursor Web PWA through Codex Computer Use.
6. Start parallel Cursor tabs for ready tickets by pasting each `@sprint-md/...` brief.
7. Take on two full sprints per daily run unless the second sprint is concretely blocked by credentials, external live-write approval, legal/compliance review, or a failing smoke gate that cannot be repaired safely in the same run.
8. Monitor outputs, capture blockers, and update Linear statuses/comments.
9. Assign human-attention tickets to `sam@solvys.io` only for approvals, credentials, legal/compliance review, live-write approval, or milestone acceptance.

## Milestone Gates

- FULLY FUNCTIONAL PRD: S22 locks the corrected contract scope, source docs, architecture decisions, IDI Core cost guardrails, closing-template inventory, six-sprint map, validation commands, and known blockers so implementation agents can execute without rediscovery.
- FULL-APP HUMAN-PRACTICAL TESTING: S26 is a dedicated realistic operator test sprint across import, Discovery DocPrep, Closing Docs, IDI import review, outreach prep, Google Sheets, Podio, website, Settings, and error states. Fixes found here route back to the implementation sprint that owns the broken behavior.
- UX AND PRODUCT LOOP HUMAN REVIEW: S27 is the final Sam/Joshua review of the end-to-end product loop, readiness, legal/compliance judgment calls, and remaining acceptance decisions.

Legacy milestone names stay as history only. The S22-S27 completion pack is controlled by the three gates above.

Human testing tickets should not be created after every S5-S11 execution batch.

## Ready Brief Order

- S22: Contract Completion PRD + source lock.
- S23: Discovery and Closing DocPrep automation assembly.
- S24: Outreach automation + Google Sheets/Podio integration proof.
- S25: Website finalization, legal page split, and production alias proof.
- S26: Full-app human-practical testing.
- S27: UX and product-loop human review, launch packet, and handoff.

Daily pairing:

- Day 1: S22 + S23.
- Day 2: S24 + S25.
- Day 3: S26 + S27.

## Smoke Gates

```bash
cd probate-lead-engine
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker milestone:30-day
pnpm --filter @ple/artifact build
```

Website gate when S25 or public-site files are touched:

```bash
cd site-v2
pnpm build
```

## Guardrails

- Podio remains the CRM/work queue of record unless smoke tests disprove it.
- Macro and Close are companion/fallback candidates, not the CRM of record.
- Claude Cowork owns the Podio automation artifact; do not reuse the old cloud/cowork label.
- Zapier is only a narrow fallback bridge.
- The client has authorized finishing the remaining project assembly, but every external send, production CRM write, paid/manual source run, and legal/compliance claim still needs the matching configured credentials, test proof, and review gate before it is treated as complete.
- IDI Core is expensive per run. Use it only through the approved Asset Discovery intake pipeline. Once one verified test proves the pipeline can pull one advanced people search for an Asset Discovery file and fill deceased, relative, immediate family, spouse, child, and alternative contact fields, do not refactor, reroute, or "improve" that intake path unless TP explicitly reopens it.
- No background IDI cron, repeated paid lookup loop, or per-person paid lookup is allowed. Duplicate IDI imports must stay blocked unless an admin override reason is recorded.
