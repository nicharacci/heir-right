# Wall-Wave Brief: S31 -- Settings, Outreach, Auth, Deployment Readiness

## Intent

Prepare the non-Doc Prep surfaces for team shipping after S29 and S30 prove the core flow. Settings should explain access and integration readiness, Outreach should be simple enough for a non-technical operator, and Google OAuth should gate the app.

## Mandatory Waves

- Wave 1: Settings readiness modeled after Linear/Apollo admin patterns.
- Wave 2: Outreach production hardening with first-party stage, review, approve, sync/send controls.
- Review wave: hostile review of every button, navigation path, status, blocker, and cross-tab handoff.
- Proof wave: Google OAuth overlay, allowed-domain gate, Google avatar, account menu, deployment readiness.

## Acceptance Criteria

- [ ] Settings covers team access, allowed domains, integration status/reconnect, API/webhook controls, activity/audit log, templates, and source/enrichment controls.
- [ ] Outreach does not expose the ActivePieces builder as the user-facing UX.
- [ ] Outreach shows stage/review/approve/sync/send states with no-send guardrails.
- [ ] Every Outreach button either works or clearly explains the blocker.
- [ ] App shows blurred overlay sign-in gate when auth is required.
- [ ] Google-only login is used.
- [ ] Only accepted business domains can clear the overlay.
- [ ] Avatar uses Google profile data when available.
- [ ] Avatar menu shows name, divider, switch account, and log out with icons.

## TP Checklist

- Log in with an approved business Google account.
- Confirm disallowed domain cannot clear the app gate.
- Click the avatar and verify account menu behavior.
- Review every Settings tab and integration status.
- Click every Outreach control and confirm safe blocked/ready behavior.
- Confirm ActivePieces is backstage only.

