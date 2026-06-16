# Sprint Brief: S18-T2 -- Lead-Quality Settings Activation

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Use the lead-quality settings to explain why a record is qualified, review-only, disqualified, duplicate, or blocked.

## Scope

- Activate qualification thresholds from existing lead-quality settings.
- Add reason-code rollups for records that are not qualified.
- Keep source evidence, operator review, and report completeness visible as separate gates.

## Out Of Bounds

- Weakening qualification gates to increase qualified count.
- Auto-approving paid/manual source use.
- Live outreach.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker test
pnpm --filter @ple/worker milestone:30-day
```
