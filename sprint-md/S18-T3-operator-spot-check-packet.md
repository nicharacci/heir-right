# Sprint Brief: S18-T3 -- Operator Spot-Check Packet

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Give Sam/Joshua a review packet that shows why the qualification loop can be trusted.

## Scope

- Generate `qualification-review.md`.
- Include samples of qualified, review, disqualified, duplicate, and dead-letter records.
- Show source coverage, reason codes, report gaps, and the operator's next action.

## Out Of Bounds

- Client-facing technical logs as the primary review surface.
- Qualified claims without source-backed evidence.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:daily
```
