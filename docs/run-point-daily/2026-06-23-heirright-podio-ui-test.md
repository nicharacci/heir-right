# 2026-06-23 HeirRight Podio UI Test

## Scope

Wire and test the Podio controlled-test export through the operator dashboard, using user-facing buttons instead of terminal export scripts.

## What changed

- Added a `Send Podio test card` option to the dashboard export menu.
- The new option posts to `/api/exports` with `routes: ["podio"]`, `dryRun: false`, and `controlledTest: true`.
- Added a synthetic controlled Podio test seed builder so the test card does not reuse the Amaranthe packet, the loaded dashboard packet, or the default validation lead.
- Updated the local artifact server so the controlled test path calls the real worker export adapter when no remote worker URL is configured.
- Added validation coverage that prevents the controlled Podio test seed from drifting back to packet/default lead data.

## Real UI proof

Local app:

- URL: `http://localhost:4173`
- Auth mode: `AUTH_REQUIRED=false`
- Browser action: clicked `Prep export` -> `Send Podio test card`

Observed browser request:

```json
{"routes":["podio"],"dryRun":false,"controlledTest":true}
```

Observed response:

```json
{
  "ok": false,
  "routes": [
    {
      "route": "podio",
      "mode": "blocked",
      "readbackOk": false,
      "message": "Podio export is blocked until bearer-token access, target app, and a field map or verified Leads preset are configured."
    }
  ],
  "blockers": [
    "Missing Podio export config: PODIO_ACCESS_TOKEN, PODIO_APP_ID, PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877"
  ]
}
```

UI result:

- Top status: `Podio test card handoff has 1 blocker.`
- Export status: `handoff: [PODIO TEST] [BLOCKED]`
- Podio chip: `Podio - Blocked`

Screenshots saved during local verification:

- `/tmp/heirright-podio-test-final-before.png`
- `/tmp/heirright-podio-test-final-after.png`

## Credential check

- Local environment has no `PODIO_*` variables loaded.
- `.env.local` has no Podio variables.
- `wrangler secret list` returned `[]`.

## Verdict

Architecture is now wired for a user-facing controlled Podio test export, but the live delivery is blocked by missing external Podio credentials/config. No Podio item/contact card was created in this run.

To complete live delivery, configure:

- `PODIO_ACCESS_TOKEN`
- `PODIO_APP_ID=24265877`
- `PODIO_TEST_PHONE`
- `PODIO_TEST_EMAIL`
- `PODIO_LEAD_POINT_PROFILE_ID`
- `PODIO_LIVE_WRITE_APPROVED=true`

Then re-click `Prep export` -> `Send Podio test card` and confirm the response returns `ok: true`, `mode: live`, and `readbackOk: true`.
