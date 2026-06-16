# Sprint Brief: S16-T2 -- Seed Review + Import CLI

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Give the team an operator-readable seed import report before any production run starts.

## Scope

- Add `pnpm --filter @ple/worker seeds:validate`.
- Validate missing identifiers, unsupported counties, provenance, approval marker, and duplicate keys.
- Write `seed-import-report.json` and `seed-import-report.md`.
- Explain rejected records as review work, not system success.

## Out Of Bounds

- Accepting unlabeled or unapproved seed batches.
- Hiding duplicate or rejected seeds from the batch ledger.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker test
pnpm --filter @ple/worker seeds:validate -- --file=input/production-seeds.example.json
```

