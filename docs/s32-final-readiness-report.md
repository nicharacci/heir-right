# S32 Final Readiness Report

Generated: 2026-07-04

## Score

Current product rating: 79/100.

The product is now close to internal release quality for demos and operator review. S33 resolved the biggest local/product-loop gaps: Tax Collector receipt capture now starts from estate facts, IDI shared-token support exists with redaction and duplicate guard, batch/single exports return one PDF artifact, and every visible export option was browser-clicked and verified.

It is still not above 80 because the live deployment does not have the real IDI Core endpoint/token installed, the real Tax Collector Browserbase/public workflow secrets are not installed, Clerk/vital workflows are not live-proven, Google/Podio live write/readback are not proven, production OAuth is not deployment-proven, and Closing legal-template immutability still needs real fixture diff tests.

## What Passed

- `Run Source Search` starts from estate/property facts and populates Tax Collector receipt link, paid by, paid date, amount due, unpaid years, and reassessment.
- `/api/discovery/external-source-run` merges Tax Collector receipt facts into Discovery source facts.
- IDI live-run route supports a shared backend token by default and a personal key override per user.
- IDI duplicate paid-run guard blocks repeat paid runs without admin override.
- IDI provider evidence is redacted on successful and failed responses.
- Discovery single, Closing single, Discovery batch, and Closing batch exports each return one `application/pdf` artifact.
- PDF byte proof and rendered PNG proof exist for all four S33 export artifacts.
- Browser proof clicked Add to Queue, Google Workspace, Podio, Podio readiness check, and Google + Podio; each produced visible state matching its label.
- Export menu layering bug was found and fixed so PDF previews do not intercept export menu clicks.
- Settings shows IDI team-default copy and no secret markers.
- Queue and mobile Doc Prep render without console errors or framework overlays.
- `Preview` copy is present and `Live packet preview` copy is absent.

## Remaining Blockers

- Install real `IDI_CORE_API_URL` and `IDI_CORE_API_TOKEN` in the active deployment provider, then run one approved live IDI proof.
- Install/configure the real Tax Collector Browserbase or controlled-browser workflow in production and prove it against the public county site.
- Install Clerk/Official Records provider credentials and prove deed, OR book/page, title friction, probate/civil/family, affidavit, and cross-link pulls.
- Install vital/obituary workflow credentials and prove obituary, Findagrave/Legacy, marriage/death, DOB/DOD, and deceased-indicator capture.
- Run live Podio and Google Workspace write/readback in approved sample mode.
- Deploy production Google OAuth with allowed business domains and verify Google Workspace avatar/profile.
- Add real legal-template fixtures and diff tests proving Closing Prep fills blanks only and does not mutate template language.

## Deployment Checklist

- Set `AUTH_REQUIRED=true`, `AUTH_SESSION_SECRET`, `AUTH_ALLOWED_DOMAINS`, Google OAuth client ID/secret/redirect.
- Set `IDI_CORE_API_URL`, `IDI_CORE_API_TOKEN`, and enable `IDI_CORE_LIVE_RUN_APPROVED=true` only during the controlled proof.
- Configure Tax Collector Browserbase/function ID or workflow URL.
- Configure Clerk Commercial Data Services AuthKey and unit limits.
- Configure vital/obituary workflow endpoint or Browserbase function.
- Configure Google Workspace and Podio Worker routes with dry-run and approved live-readback modes.
- Run `pnpm --dir probate-lead-engine --filter @ple/artifact test`.
- Run route/PDF proof and browser proof against deployment, not only localhost.
- Open generated PDFs and compare Closing output against approved legal templates.

## TP Acceptance Checklist

- Open `docs/s32-objective-matrix.md` and review every objective without reading code.
- Open `docs/evidence/s33-route-proof.json`; confirm Tax Collector and IDI route proof.
- Open `docs/evidence/s33-browser-proof.json`; confirm export buttons and browser checks.
- Open the four S33 PDFs and confirm they are individual PDFs, not folders.
- Open `docs/evidence/s33-docprep-tax-receipt.png`; confirm receipt fields populated after `Run Source Search`.
- Open `docs/evidence/s33-export-buttons-proof.png`; confirm export menu options remain usable above the PDF preview.
- Reject production shipment until live deployment secrets/providers, OAuth, Google/Podio readback, and legal-template fixture tests pass.
