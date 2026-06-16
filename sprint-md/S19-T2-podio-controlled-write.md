# Sprint Brief: S19-T2 -- Podio Controlled Write

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Prove the Podio handoff with one explicitly approved test write and readback.

## Scope

- Configure `PODIO_ACCESS_TOKEN`, `PODIO_APP_ID=24265877`, `PODIO_TEST_PHONE`, `PODIO_TEST_EMAIL`, `PODIO_LEAD_POINT_PROFILE_ID`, and `PODIO_LIVE_WRITE_APPROVED=true`.
- Create one clearly labeled `HEIRRIGHT TEST - DO NOT WORK - <timestamp>` item.
- Add source-note/comment, review task, optional report link, and read back the item.

## Out Of Bounds

- Production Podio writes without explicit approval.
- Treating missing credentials as a repo failure.
- Auto-sending outreach.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker export:podio-live-test
```
