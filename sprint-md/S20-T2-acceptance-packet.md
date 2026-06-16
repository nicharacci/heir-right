# Sprint Brief: S20-T2 -- Acceptance Packet

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Make the 30-day evidence packet answer the business milestone directly.

## Scope

- Link seed batch, source coverage, qualification review, Google/Podio readback, and external-use guard evidence.
- Report raw volume, qualified volume, report completeness, live readback state, and next actions.
- Keep blocked gates explicit when external approvals or source coverage are missing.

## Out Of Bounds

- Claiming 60% automation unless the packet shows it.
- Hiding missing source coverage behind UI polish.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker milestone:30-day
```

