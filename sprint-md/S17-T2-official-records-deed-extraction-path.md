# Sprint Brief: S17-T2 -- Official Records + Deed Extraction Path

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Extract deed/title signals that decide whether a lead should move forward, be reviewed, or move on.

## Scope

- Extract latest deed, OR book/page or instrument number, last-sale date, and title status indicators where available.
- Preserve mortgage, lien, foreclosure, Lis Pendens, and adverse-possession indicators as evidence or review flags.
- Keep source URL, raw ID, fetched timestamp, confidence, and next action.

## Out Of Bounds

- Title conclusions without official record evidence.
- Bypassing recent-sale stop rules.
- Treating an official-records search page as proof that the deed facts were extracted.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker test
pnpm --filter @ple/worker milestone:30-day
```

