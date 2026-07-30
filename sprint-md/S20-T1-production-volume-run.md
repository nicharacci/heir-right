# Sprint Brief: S20-T1 -- Production-Volume Run

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Run the approved production batch at milestone scale only after seed validation and source coverage gates are honest.

## Scope

- Run approved seeds toward the 200-400 raw and 80-150 qualified target.
- Capture duplicate, dead-letter, source coverage, qualified, review, and disqualified counts.
- Preserve blockers when source coverage or qualified volume is not enough.

## Out Of Bounds

- Production-volume claims from default review seeds.
- Qualified claims from records with core blockers.

## Validation

```bash
cd probate-lead-engine
DAILY_RUN_SEEDS_FILE=input/production-seeds.json pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker milestone:30-day
```
