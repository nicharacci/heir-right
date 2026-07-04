# S32 Final Readiness Report

Generated: 2026-07-04

## Score

Current product rating: 74/100.

The product is materially stronger than the S29 starting point because Doc Prep preview streaming, single-PDF export contracts, Help & Demos, Settings readiness, Outreach safety gates, auth/domain gating, and local route/browser/PDF proof are now in place.

It is not above 80 because trust-critical production dependencies are still not proven live: backend IDI Core API, real Tax Collector search-to-listing automation, Clerk/vital source automation, Google/Podio write/readback, production Google OAuth, and real legal-template immutability tests.

## What Passed

- External source-run route accounts for all eight Discovery source buckets and preserves Tax Collector receipt/payer facts.
- Tax Collector listing-page receipt parser captures the bottom-right receipt link from supplied listing HTML.
- IDI operator import is distinguished from paid live run and duplicate imports are guarded.
- Personal IDI key override is distinguished, but blocks correctly without vendor endpoint.
- Discovery, Closing, Batch Discovery, and Batch Closing exports return one `application/pdf` artifact each.
- Batch Queue UI now explicitly says one combined PDF per selected flow.
- Doc Prep Preview streams sectioned artifacts and supports `Option+Down` section cycling.
- Help & Demos cards render and launch guided walkthrough state.
- Outreach uses first-party review controls and does not expose ActivePieces native builder UI.
- Auth-required local server proves allowed-domain access, disallowed-domain rejection, Google-only login redirect, visible auth gate, and avatar menu.
- Mobile Settings proof has no horizontal overflow.

## Remaining Blockers

- Add `IDI_CORE_API_URL` and shared `IDI_CORE_API_KEY`, then run one controlled live backend IDI proof with `paidRun: true`, lock key, readback, and source evidence.
- Implement or connect the real Tax Collector search workflow that reaches the listing page and extracts the bottom-right receipt link without manual HTML paste.
- Add Clerk Commercial Data Services credentials and prove Official Records, probate/civil/family, deed, OR book/page, affidavit, and cross-link pulls.
- Configure obituary/vital browser/API workflow and prove obituary, Findagrave/Legacy, marriage/death, DOB/DOD, and deceased-indicator capture.
- Run live Podio and Google Workspace write/readback in approved test mode.
- Deploy with real Google OAuth credentials and allowed business domains, then verify profile avatar from Google Workspace.
- Add real legal-template fixtures and tests proving Closing Prep fills blanks only and does not mutate template language.

## Deployment Checklist

- Set production env: `AUTH_REQUIRED=true`, `AUTH_SESSION_SECRET`, `AUTH_ALLOWED_DOMAINS`, Google OAuth client ID/secret/redirect.
- Set provider env only after approval: `IDI_CORE_API_URL`, shared `IDI_CORE_API_KEY`, `IDI_CORE_LIVE_RUN_APPROVED=true` for a controlled proof only.
- Configure Tax Collector Browserbase/script workflow and save workflow id/URL.
- Configure Clerk Commercial Data Services AuthKey and unit limits.
- Configure Google Workspace and Podio Worker routes with dry-run and controlled live-readback modes.
- Run `pnpm --dir probate-lead-engine --filter @ple/artifact test`.
- Run route/PDF proof and browser proof against deployment, not only localhost.
- Open generated PDFs and compare Closing output against approved legal templates.

## TP Acceptance Checklist

- Open `docs/s32-objective-matrix.md` and verify each hired workflow objective without reading code.
- Open `docs/evidence/s32-discovery-prep.pdf` and `docs/evidence/s32-closing-prep.pdf`.
- Open `docs/evidence/s32-batch-discovery-prep.pdf` and `docs/evidence/s32-batch-closing-prep.pdf`; confirm they are single PDFs.
- Review `docs/evidence/s32-route-pdf-proof.json`; confirm Tax Collector receipt URL and paid-by facts are present.
- Review IDI proof in `docs/evidence/s32-route-pdf-proof.json`; confirm backend live IDI is blocked, not claimed complete.
- Open `docs/evidence/s32-docprep-proof.png`; confirm Preview is contained in the rail and section navigation is visible.
- Open `docs/evidence/s32-queue-proof.png`; confirm Batch Queue says one combined PDF per selected flow.
- Open `docs/evidence/s32-outreach-proof.png`; confirm no-send Outreach gates.
- Open `docs/evidence/s32-auth-gate.png` and `docs/evidence/s32-avatar-menu.png`; confirm Google gate and avatar menu.
- Approve internal demo/review only, or reject production shipment until blockers above are resolved.

