# Sprint Brief: S16-T3 -- Small Production Batch Falsifier

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Prove whether a small approved county batch can produce enough source facts before scaling toward the 30-day volume target.

## Scope

- Run a 20-50 record approved batch before attempting the larger 200-400 raw lead target.
- Measure source coverage, dead letters, duplicate rate, missing fields, and time per lead.
- Preserve a clear blocker if the batch cannot produce enough reviewable source facts.

## Out Of Bounds

- Scaling to production-volume claims before the small-batch falsifier passes.
- Counting source-health checks as extracted property, tax, deed, probate, or heir facts.

## Validation

```bash
cd probate-lead-engine
DAILY_RUN_SEEDS_FILE=input/production-seeds.json pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker milestone:30-day
```

