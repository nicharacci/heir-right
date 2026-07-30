# S31 Anti-Negligence Review

Reviewer posture: assume every AI-built claim is false until proven by route output, DOM proof, screenshots, and tests.

## Findings

- Pass: Settings is no longer a vague connector drawer.
  - It now exposes access, integrations, source/enrichment controls, Outreach safety, audit/template controls, and preferences.
  - The source tab names Tax Collector Source, Miami-Dade Clerk API, Vital/Obituary Workflow, and IDI Core explicitly.
  - Tax Collector receipt capture now calls out the listing-page bottom-right receipt link and separates script listing paths from browser workflow paths.

- Pass: Outreach no longer exposes ActivePieces native UI as the product surface.
  - The user-facing workflow is Stage, Review, Approve, Sync package, Send locked.
  - The automation builder is described as backstage only.
  - The direct-send path is visibly locked and click-tested.

- Pass: Auth overlay and protected-route behavior are proven.
  - `AUTH_REQUIRED=true` renders the blurred overlay and does not load product data.
  - `/latest-run.json` returns `401` without an accepted session.
  - Signed allowed-domain session passes.
  - Signed personal-domain session fails.

- Pass: Account menu exists and is reachable from Settings.
  - Menu includes user identity area, divider, Switch account, and Log out.
  - Google login path uses account selection.

- Correction made during review: source cards hid exact source names behind nicer titles.
  - Miami-Dade Clerk API and Vital/Obituary Workflow are now visible labels.

- Correction made during review: empty Outreach state did not expose the no-send guard.
  - Send locked is now visible even with no selected template.

- Correction made during review: Outreach stage map was too cramped in the right rail.
  - Template editor pipeline now renders as a readable vertical list.

- Correction made during review: mobile Settings tabs clipped later tabs.
  - Settings tab strip is horizontally scrollable and all tabs remain present in DOM proof.

## Residual Risk

- A real Google OAuth redirect with actual Workspace profile image cannot be proven in this local environment because OAuth secrets are not present.
- This is not a code blocker, but deployment must set the OAuth and session env vars before team use.
- ActivePieces remains backstage; this sprint did not validate a credentialed live Podio automation run.

## Verdict

Alignment: aligned with deployment credential note.

Required corrections before S32:

- Set production OAuth/session environment values.
- Run one deployed Google OAuth sign-in with an allowed business-domain account.
- Run one deployed Google OAuth sign-in attempt with a disallowed personal-domain account.
- Confirm avatar image appears when Google returns a profile picture.
