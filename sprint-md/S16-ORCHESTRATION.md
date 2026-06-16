# Sprint Brief: S16-ORCH -- Production Seed Intake + Acceptance Batch

Owner: TP
Beta phase: 30-Day Acceptance
Branch: `v2.4.1/heirright-2026-06-16-run-point`
Project: HeirRight Deal Engine Automation

## Goal

Replace default review seeds with an approved production county seed batch and make seed provenance visible before any 30-day acceptance claim.

## Tracks

| Track | Title | Brief |
| --- | --- | --- |
| S16-T1 | Production Seed File Contract | `@sprint-md/S16-T1-production-seed-file-contract.md` |
| S16-T2 | Seed Review + Import CLI | `@sprint-md/S16-T2-seed-review-import-cli.md` |
| S16-T3 | Small Production Batch Falsifier | `@sprint-md/S16-T3-small-production-batch-falsifier.md` |

## Acceptance

- Approved production seeds can be loaded from `DAILY_RUN_SEEDS_JSON` or `apps/worker/input/production-seeds.json`.
- Default review seeds remain visibly review-only and cannot satisfy milestone acceptance.
- Seed import output shows provenance, duplicates, missing identifiers, county support, and failure piles.
- No paid/manual source data, live outreach, or CRM write is triggered by seed intake.

