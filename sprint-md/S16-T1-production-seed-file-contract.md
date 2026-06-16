# Sprint Brief: S16-T1 -- Production Seed File Contract

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Define the approved production seed shape so operators can distinguish a real county batch from default review examples.

## Scope

- Add a checked-in example seed file.
- Support `DAILY_RUN_SEEDS_JSON` and `apps/worker/input/production-seeds.json`.
- Require county, seed source, source owner, approval marker, and at least one estate/address/folio/case identifier.
- Keep default review seeds labeled as not acceptable for milestone volume.

## Out Of Bounds

- Lead-volume claims from default review seeds.
- Paid/manual source imports without approval.
- Live outreach or CRM writes.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker seeds:validate -- --file=input/production-seeds.example.json
```

