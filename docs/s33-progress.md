# S33 Production Source Cleanup Progress

## Goal

Complete the production-source cleanup before the final S32 readiness pass: Tax Collector must search from estate facts, IDI Core must use a shared private backend token by default, manual capture must remain fallback only, and Doc Prep / Queue / export behavior must be proven on routes and browser surface.

## 2026-07-04

- Wrote `sprint-md/S33-BRIEF-production-source-cleanup.md`.
- Added `POST /api/discovery/tax-collector/receipt-run` as an explicit Tax Collector search-to-receipt route.
- Added a Tax Collector service that starts from estate facts: county, folio, property address, owner, and prior Property Appraiser facts.
- The Tax Collector service now tries captured evidence, configured browser workflow / Browserbase function, configured listing URL/template, then returns an exact blocker. Manual listing URL or listing HTML remains fallback only.
- Wired `/api/discovery/external-source-run` to run Tax Collector receipt capture first, merge receipt facts into the Discovery pipeline, and avoid duplicate Tax Collector browser runs.
- Updated Doc Prep copy so `Run Source Search` is clearly the primary automated path and the manual Tax Collector fields are fallback review only.
- Added IDI shared-backend token aliases: `IDI_CORE_API_TOKEN` and `HEIRRIGHT_IDI_CORE_API_TOKEN`, with `IDI_CORE_API_KEY` retained as a legacy alias.
- Updated the standalone IDI import route to support controlled live runs, shared backend token default, personal user override, duplicate guard, readback status, and provider-response redaction.
- Hardened successful IDI Core responses so provider `sourceEvidence` is redacted too, not only failure payloads.
- Updated Settings/readiness status, Worker connection status, Turbo env tracking, Wrangler guidance, `.env.example`, and `docs/idi-core-configuration.md`.
- Fixed the export dropdown layering bug found in browser QA: PDF iframes no longer intercept Google, Podio, readiness-check, or Google + Podio export options while the menu is open.

## Proof So Far

- `pnpm --dir probate-lead-engine --filter @ple/artifact test` passed.
- `docs/evidence/s33-route-proof.json` passed against `http://127.0.0.1:4197` with controlled Browserbase-style Tax Collector and IDI provider endpoints.
- `docs/evidence/s33-browser-proof.json` passed with Playwright fallback after in-app browser attach timeout.
- Generated and validated one PDF artifact for each export case:
  - `docs/evidence/s33-discovery-single.pdf`
  - `docs/evidence/s33-closing-single.pdf`
  - `docs/evidence/s33-discovery-batch.pdf`
  - `docs/evidence/s33-closing-batch.pdf`
- Rendered PDF PNG proof:
  - `docs/evidence/s33-discovery-single.png`
  - `docs/evidence/s33-closing-single.png`
  - `docs/evidence/s33-discovery-batch.png`
  - `docs/evidence/s33-closing-batch.png`
- Browser screenshots saved:
  - `docs/evidence/s33-docprep-initial.png`
  - `docs/evidence/s33-docprep-tax-receipt.png`
  - `docs/evidence/s33-settings-idi-ready.png`
  - `docs/evidence/s33-queue-proof.png`
  - `docs/evidence/s33-export-buttons-proof.png`
  - `docs/evidence/s33-mobile-docprep-proof.png`
- New S33 contract coverage proves:
  - Tax Collector receipt run starts from estate facts with no supplied listing URL.
  - External source run merges Tax Collector receipt facts back into Discovery.
  - IDI shared backend token alias is recognized as the team default.
  - Personal IDI override remains separate.
  - Duplicate IDI paid runs are blocked without admin override.
  - Browserbase and IDI tokens, bearer headers, and provider auth fields are absent from route responses.
- Browser proof verifies:
  - `Run Source Search` populates the Tax Collector receipt link, paid-by, paid-date, amount-due, unpaid-years, and reassessment fields.
  - Settings shows IDI Core team-default copy without exposing the shared backend token.
  - Queue view renders the batch-export surface.
  - Export menu buttons for Add to Queue, Google Workspace, Podio, Podio readiness check, and Google + Podio all perform visible state changes matching their labels.
  - Mobile Doc Prep renders without a framework overlay, no console errors, no secret markers, and no `Live packet preview` copy.
- Deploy-provider secret-name check:
  - `vercel env ls --cwd probate-lead-engine` did not list `IDI_CORE_API_URL`, `IDI_CORE_API_TOKEN`, `HEIRRIGHT_IDI_CORE_API_TOKEN`, or `IDI_CORE_API_KEY`.
  - `pnpm --dir probate-lead-engine --filter @ple/worker exec wrangler secret list` did not list `IDI_CORE_API_URL`, `IDI_CORE_API_TOKEN`, `HEIRRIGHT_IDI_CORE_API_TOKEN`, or `IDI_CORE_API_KEY`.
  - The code path and route proof support shared default IDI access, but the real private vendor token is not installed in the checked deployment providers.

## Remaining Before S33 Close

- Run final S33 anti-negligence review and commit.
