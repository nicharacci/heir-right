# Sprint Brief: S18-T1 -- Evidence Coverage Scoring

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Show the source coverage behind each lead before qualification decisions are counted.

## Scope

- Add a visible source-coverage profile per lead: property, owner, tax, deed, probate, family tree, and offer inputs.
- Keep report completeness separate from qualification.
- Roll missing source areas into clear next actions.

## Out Of Bounds

- Counting source reachability as extracted evidence.
- Using AI score as a substitute for source convergence.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:daily
```
