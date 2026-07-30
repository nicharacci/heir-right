# Sprint Brief: S19-T1 -- Google Workspace Readback

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Prove the completed report packet can be written to Google Workspace and read back from the target account.

## Scope

- Configure `GOOGLE_WORKSPACE_ACCESS_TOKEN`, `GOOGLE_TRACKING_SHEET_ID`, optional Drive parent folder, and Sheet range.
- Create a folder, create a Doc, write report content, append a tracking Sheet row, and read back the resulting link.
- Surface missing configuration as a blocker.

## Out Of Bounds

- Treating dry preparation as live proof.
- Live outreach.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker milestone:30-day
```
