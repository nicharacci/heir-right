# S31 Progress: Settings, Outreach, Auth

Status: implementation and proof pass complete.

## What Changed

- Settings is now a readiness console instead of a two-tab connector list.
  - Tabs: Access, Integrations, Sources, Outreach, Audit, Preferences.
  - Access shows Google-only login, allowed business domains, account menu entry, and IDI Core API key posture.
  - Sources shows Tax Collector Source, Miami-Dade Clerk API, Vital/Obituary Workflow, and IDI Core as separate Discovery dependencies.
  - Outreach shows first-party review-package controls and keeps automation builder language backstage.
  - Audit shows workspace activity and template controls.

- Outreach now exposes the actual safety path.
  - Stage, Review, Approve, Sync package, Send locked.
  - The locked-send guard is visible even when no template is selected.
  - Direct SMS/email send is not available from the app surface.
  - Sync copy now says Podio review package/readback, not native automation-builder work.

- Auth now supports the shipped overlay shape.
  - App shell loads under `AUTH_REQUIRED=true` so the blurred sign-in overlay can render.
  - Protected JSON/data routes still return `401`.
  - Account chip opens a menu with name/email, divider, Switch account, and Log out.
  - Google login uses `prompt=select_account`.
  - Allowed-domain gate is enforced by signed session readback.

## Proof

- `pnpm --dir probate-lead-engine --filter @ple/artifact test`
  - Build passed.
  - Worker build passed.
  - Source-run contract passed.
  - Source-readiness contract passed.
  - S31 readiness contract passed.

- Browser proof saved:
  - `docs/evidence/s31-auth-gate.png`
  - `docs/evidence/s31-settings-sources.png`
  - `docs/evidence/s31-outreach-send-locked.png`
  - `docs/evidence/s31-settings-mobile-outreach.png`
  - `docs/evidence/s31-browser-proof.json`

- Domain-gate proof saved:
  - `docs/evidence/s31-domain-gate-proof.json`
  - Allowed signed session: `operator@heirright.com` accepted.
  - Disallowed signed session: `operator@gmail.com` rejected.
  - Protected data route accepted allowed domain and rejected disallowed domain.

## Deployment Notes

- Local env does not contain Google OAuth client/secret/session values.
- Deployment must set:
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `AUTH_SESSION_SECRET`
  - `AUTH_ALLOWED_DOMAINS`
  - optional `AUTH_ALLOWED_EMAILS`
- Local proof validated overlay behavior, protected-route blocking, signed-session domain enforcement, and account-menu UI. A real Google redirect round trip still requires deployment credentials.

## TP Checklist

- Open Settings and verify all six tabs are reachable.
- Open Sources and confirm Tax Collector Source receipt capture calls out the bottom-right receipt link.
- Open Access and confirm Google-only access, allowed domains, and IDI shared-default/personal-key controls.
- Open Outreach from Settings.
- Press Send locked and confirm no SMS/email send happens.
- Confirm Account menu shows Switch account and Log out.
- Confirm a business-domain session clears protected routes while a personal-domain session is rejected.
