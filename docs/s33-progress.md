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
- Updated Settings/readiness status, Worker connection status, Turbo env tracking, Wrangler guidance, `.env.example`, and `docs/idi-core-configuration.md`.

## Proof So Far

- `pnpm --dir probate-lead-engine --filter @ple/artifact test` passed.
- New S33 contract coverage proves:
  - Tax Collector receipt run starts from estate facts with no supplied listing URL.
  - External source run merges Tax Collector receipt facts back into Discovery.
  - IDI shared backend token alias is recognized as the team default.
  - Personal IDI override remains separate.
  - Duplicate IDI paid runs are blocked without admin override.
  - Browserbase and IDI tokens are absent from route responses.

## Remaining Before S33 Close

- Run deployment-equivalent local server route proof.
- Run browser proof for Doc Prep source search, Settings IDI status, Queue buttons, and export buttons.
- Generate S33 evidence artifacts.
- Run worker build and clean artifact build.
- Run final S33 anti-negligence review and commit.
