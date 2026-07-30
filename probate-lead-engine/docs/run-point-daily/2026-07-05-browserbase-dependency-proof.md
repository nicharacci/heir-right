# 2026-07-05 Browserbase Dependency Proof

Purpose: record the Browserbase dependency completion pass while IDI API access is pending through the vendor portal.

## Published Browserbase Functions

- Tax Collector receipt function: `54ecee5f-696f-41c2-a898-dafacb4dd1b9`
  - Latest published version in this pass: `8fc48001-fe0c-4520-b677-f6da2e1802c1`
  - Behavior: accepts estate facts or existing listing HTML, searches the Miami-Dade County Taxes property-tax flow, rejects Cloudflare/challenge pages, rejects local-business-tax/generic receipt false positives, and returns only bounded proof snippets.
- Vital/obituary review function: `59bf1447-9ca9-4bdb-9b7b-ea58619fd901`
  - Latest published version in this pass: `264b1435-e818-4ed7-a504-8b039d3da71b`
  - Behavior: opens obituary/memorial candidates, rejects generic funeral-home/navigation pages, captures a reviewable obituary source, and extracts DOB/DOD from explicit text or obituary header date ranges.

## Live Proof

- Deploy proof:
  - Vercel production deployment: `dpl_4w1ekkssFWsZ3xLJnizgR6uZZZ4b`
  - Vercel alias: `https://heirright-landing-demo.vercel.app`
  - Cloudflare Worker version: `5e7e26cb-8774-4968-b98d-ac60146f0289`
  - Worker health endpoint returned `ok: true`.
  - `/api/connections/status` returned Tax Collector Source `ok: true`, `configuredMode: browser_workflow`, Vital/Obituary Workflow `ok: true`, and IDI Core `configuredMode: operator_portal` with backend API access still pending.
- Tax Collector deterministic deployed-function proof:
  - Invocation: `01f79301-b5de-4592-9d88-f2c3f1d053d0`
  - Result: `ok: true`, `mode: listing_page_bottom_right`
  - Captured receipt: `https://county-taxes.net/receipts/2025-paid.pdf`
  - Duration: 10.80s
- Tax Collector production route proof with listing page evidence:
  - Route: `POST /api/discovery/tax-collector/receipt-run`
  - Result: `ok: true`, `mode: listing_page_bottom_right`
  - Captured receipt: `https://county-taxes.net/receipts/2025-paid.pdf`
  - Captured payer: `Maria Browserbase`
  - Captured paid date: `2025-03-10`
  - Captured amount due: `$0.00`
- Tax Collector public-search proof against Annie Hawkins:
  - Invocation without paid proxy: `d0a85ff3-f5b2-4f03-84b5-c59699be0a01`
  - Result: `ok: false`, `mode: browser_navigation_blocked`
  - County Taxes returned Cloudflare verification before the property listing.
  - Browserbase proxy routing test returned HTTP `402 Payment Required`, so this Browserbase account can run functions but cannot use paid proxy routing yet.
- Tax Collector production route proof against Annie Hawkins:
  - Route: `POST /api/discovery/tax-collector/receipt-run`
  - Result: `ok: false`, `mode: listing_page_blocked`
  - Search input came from estate facts: `01-3113-008-0130`, `131 NW 67 ST, Miami, FL 33150`, `ANNIE HAWKINS EST OF`.
  - Source evidence preserved the County Taxes Cloudflare verification snippet and did not create a fake receipt fact.
- Vital/obituary live proof:
  - Invocation: `84992c26-b0b7-4d80-8861-71c744ec1585`
  - Result: `ok: true`, `status: reviewed-with-source`
  - Source: `https://www.dignitymemorial.com/obituaries/miami-fl/annie-hawkins-6021574#`
  - Extracted DOB: `February 7, 1937`
  - Extracted DOD: `June 23, 2014`
  - Duration: 24.25s
- Production external-source proof:
  - Route: `POST /api/discovery/external-source-run`
  - Result: `ok: false` because completion gates remain blocked.
  - Tax Collector summary: `blocked`, next action says County Taxes verification blocked the listing page.
  - Vital/obituary summary: `partial`, with `date_of_birth`, `date_of_death`, `obituary_link`, `obituary_snapshot`, marriage/death status, and manual review gates.
  - `legalTemplateAutofillAllowed: false`.

## App Wiring Completed

- App/worker Browserbase calls now poll invocation readback before treating `PENDING` as a final result.
- Browserbase `advancedStealth` was removed because the current Browserbase account rejects it.
- Browserbase captcha solving is enabled for function sessions.
- Paid Browserbase proxy routing is available behind environment flags:
  - `BROWSERBASE_PROXY_ENABLED=true`
  - `TAX_COLLECTOR_BROWSERBASE_PROXY_ENABLED=true`
  - `TAX_COLLECTOR_BROWSERBASE_PROXY_DOMAIN_PATTERN=county-taxes.net`
  - `OBITUARY_VITAL_BROWSERBASE_PROXY_ENABLED=true`
- Default Tax Collector search URL is now `https://county-taxes.net/fl-miamidade/property-tax` across worker, artifact route, tax-history facts, and connection status.

## Current Boundary

IDI API access is vendor/client pending through the ID Analyzer developer portal. Browserbase dependencies are wired and deployed, but the live County Taxes public-search path still needs Browserbase paid proxy/verified browsing enabled on the production Browserbase account or an alternate first-party/API source for that Tax Collector listing page.

## Tests

- `node --check src/source-helpers.mjs && node --check src/tax-collector-receipt.mjs && node --check src/vital-obituary-review.mjs && node test/contracts.test.mjs`
- `pnpm --filter @ple/worker build`
- `node apps/artifact/test/source-run-contract.test.mjs && node apps/artifact/test/s33-production-source-cleanup.test.mjs && node apps/artifact/test/source-readiness-contract.test.mjs`
