# Sprint Brief: S19-T3 -- Readback Evidence Packet

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Preserve a single packet proving which Google and Podio handoff records were created, read back, and left for cleanup or review.

## Scope

- Emit a markdown packet with IDs, URLs, timestamps, field/task/comment verification, and cleanup/rollback notes.
- Link the packet from the 30-day milestone evidence.
- Keep failed or skipped readback visible as a blocker.

## Out Of Bounds

- Hiding failed readback behind successful preparation.
- Milestone readiness claims without packet evidence.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker milestone:30-day
```
