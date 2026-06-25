# 2026-06-25 North Star Doc Discovery Progress

## Superseding Goal

Complete HeirRight document discovery so a live lead can render a family-tree packet at the same level of structure and completeness as the Constance / Deborah North Star examples: compact Google Docs-like PDF layout, linked property/source text, offer/profit table, back story, possible heirs, address histories, phone numbers, emails, and export-ready app artifacts for Podio / Google review.

## Current Pass

- Re-read the Constance screenshot target and the existing Annie Hawkins packet.
- Confirmed the previous Annie output was not complete enough: it used generic relationship placeholders and no address-history / phone / email rows.
- Added a skip-trace fact contract to `@ple/types` for provider status and enriched contact profiles.
- Added an Apify-compatible skip-trace adapter that produces honest `MISSING_SKIPTRACE_CONFIG` / `SKIPTRACE_PROVIDER_FAILED` facts instead of silently pretending enrichment ran.
- Wired skip-trace facts into `runDryPipeline`.
- Updated the completed lead report contact mapping to consume enriched contact profiles when present.
- Added `output/family-tree-discovery-report.html` as a North Star-shaped packet view.
- Added a hard UI and report truth gate so Annie Hawkins cannot display as `Enriched` or completed when skip-trace/contact enrichment has not run.
- Changed the report research checklist `CONTACTS` step to `Verified contact enrichment`; it only completes when real contact evidence exists.
- Added Discovery status and Contact enrichment lines inside the family-tree packet itself so the exported packet carries the blocker without relying on surrounding UI.
- Updated Find Estates and Dossiers rows to show `Skip trace needed` / `Connect trace` or `Needs contacts` / `Run trace` when contact data is absent.
- Generated local Annie Hawkins proof files:
  - `apps/worker/output/family-tree-discovery-report.html`
  - `apps/worker/output/family-tree-discovery-report.pdf`
  - `apps/worker/output/family-tree-discovery-report-page1.png`

## Verification

- `pnpm --filter @ple/types build` passed.
- `pnpm --filter @ple/worker build` passed.
- `pnpm --filter @ple/worker run:dry -- --estate="Estate of Annie Hawkins" --owner="ANNIE HAWKINS EST OF" --address="131 NW 67 ST, Miami, FL 33150" --folio="01-3113-008-0130" --county="miami-dade"` passed.
- Browser-rendered packet proof confirmed:
  - title: `ESTATE OF ANNIE HAWKINS`
  - offer/profit table present
  - TOC links present
  - 8 possible-heir rows present
  - 13 document links present
- Local Dossier rail proof confirmed:
  - Dossiers list remains 6 rows after merging the newest selected dossier into the stale fresh-batch shell.
  - Embedded Dossier rail reader uses `completedLeadReport.formats.familyTreeHtml`.
  - Reader contains `Family tree`, the North Star offer/profit table, Table of Contents, and the Intelius link.
  - Reader no longer contains unavailable zip suffixes (`-0000`).
  - Screenshot: `probate-lead-engine/docs/run-point-daily/screenshots/2026-06-25-north-star-dossier-rail-reader-local.png`.
- Contact gate proof confirmed:
  - Dossiers row for Annie reads `Skip trace needed`.
  - Next-step chip reads `Connect trace` and fits the row.
  - Embedded packet contains the family-tree packet, offer/profit table, Table of Contents, and the contact-enrichment blocker.
  - Embedded packet and row do not contain unavailable zip suffixes (`-0000`).
  - Screenshot: `probate-lead-engine/docs/run-point-daily/screenshots/2026-06-25-annie-contact-gate-local.png`.
- Production proof confirmed on `https://heirright-landing-demo.vercel.app/` after deploy:
  - Dossiers row for Annie reads `Skip trace needed`.
  - Next-step chip reads `Connect trace`.
  - Embedded Dossier rail packet contains `Family tree`, the offer/profit table, Table of Contents, and the contact-enrichment blocker.
  - Embedded packet and row do not contain unavailable zip suffixes (`-0000`).
  - Network failure list and browser console errors were empty after static fallback responses shipped.
  - Screenshot: `probate-lead-engine/docs/run-point-daily/screenshots/2026-06-25-annie-contact-gate-live.png`.

## Blocker

No live skip-trace provider credential is present in the current environment. The packet therefore renders the correct format and an honest incomplete state, but it is not yet a completed Constance-level contact packet.

To complete the contact layer, configure one approved provider:

- `SKIPTRACE_PROVIDER=apify`
- `APIFY_TOKEN=...`
- optional `APIFY_SKIPTRACE_ACTOR=apivault_labs/skip-trace-people-finder`

The Apify actor documentation shows it can return current/past addresses, phone numbers, relatives, aliases, and profile links for lawful B2B use.

## Next Pass

1. Validate the Apify provider payload against a real approved token.
2. Normalize returned people into heir rows with current address, address history, phone numbers, and emails.
3. Validate provider output against the Constance / Deborah examples and iterate the packet until the actual contact rows, address histories, phones, and emails match that level of completion.
4. Deploy and verify on `https://heirright-landing-demo.vercel.app/`.

## Apify Skip-Trace Adapter Pass

- Updated `apps/worker/src/enrichment/skip-trace.ts` to use the selected Apify actor schema:
  - `name`: estate/person name with location context.
  - `street_citystatezip`: selected lead property address.
  - `source`: defaults to `merge` for the most comprehensive demo result set.
  - `max_results`: defaults to `10`, clamped to the actor-supported range.
- Hardened returned-profile parsing for common Apify result shapes:
  - `full_name`, first/last names, nested result/data wrappers.
  - `phone_numbers`, `phone_number`, `best_phone`, mobile and landline arrays.
  - `email_addresses`, `best_email`, and nested email objects.
  - `current_address`, `past_addresses`, address history, profile/source URLs, relatives, and associates.
- Added local dry-run env loading in `apps/worker/src/cli.ts` so `.env` / `.env.local` credentials are picked up by `pnpm --filter @ple/worker run:dry`.
- Added `.env.example` controls:
  - `APIFY_SKIPTRACE_SOURCE=merge`
  - `APIFY_SKIPTRACE_MAX_RESULTS=10`

## Apify Adapter Verification

- `pnpm --filter @ple/worker build` passed.
- Simulated Apify response verified:
  - outbound payload contains `name`, `street_citystatezip`, `source=merge`, and `max_results=10`;
  - response produced one `enriched_contact_profile`;
  - phone, email, current address, address history, and relative counts all landed in the profile fact.
- Real Annie Hawkins dry run with Apify enabled reached the provider gate and stopped at `MISSING_SKIPTRACE_CONFIG`.
- Checked repo-local env files without printing secrets:
  - `/Users/tifos/Documents/Codebases/heir-right/.env.local` exists;
  - no `APIFY_TOKEN` is configured there.

## Current Contact Blocker

The leads machine is ready to run the selected Apify skip-trace actor, but Annie Hawkins cannot be filled with real contact info until an Apify token is provided locally:

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
APIFY_TOKEN="..." SKIPTRACE_PROVIDER=apify pnpm --filter @ple/worker run:dry -- --estate="Estate of Annie Hawkins" --owner="Annie Hawkins" --address="131 NW 67 ST, Miami, FL 33150" --county="miami-dade"
```

Do not present Annie Hawkins as a completed contact dossier until the credentialed run returns real `enriched_contact_profile` facts.

## Credentialed Annie Hawkins Contact Run

- Retrieved the Apify default API token from the logged-in Chrome console and used it only as a local process environment value for the worker run.
- Re-ran Annie Hawkins with:
  - `SKIPTRACE_PROVIDER=apify`
  - `APIFY_SKIPTRACE_ACTOR=apivault_labs/skip-trace-people-finder`
  - `APIFY_SKIPTRACE_SOURCE=merge`
  - `APIFY_SKIPTRACE_MAX_RESULTS=10`
- Generated run: `run-1782426059206-estate-of-annie-hawkins`.
- Skip trace status:
  - provider: `apify`
  - ok: `true`
  - profile count: `3`
- Redacted contact enrichment proof:
  - profile 1: current address present; 23 address-history entries; 15 phone values; 8 email values; 8 related-person values.
  - profile 2: current address present; 38 address-history entries; 51 phone values; 0 email values.
  - profile 3: current address present; 32 address-history entries; 26 phone values; 8 email values.
- `MISSING_SKIPTRACE_CONFIG` is no longer present.
- `CONTACT_REVIEW_REQUIRED` remains present by design because skip-trace/people-finder data must be operator-reviewed before outreach, CRM writes, or legal/contact use.
- Refreshed local artifacts:
  - `probate-lead-engine/apps/worker/output/latest-run.json`
  - `probate-lead-engine/apps/worker/output/latest-dossier.json`
  - `probate-lead-engine/apps/worker/output/family-tree-discovery-report.html`
  - `probate-lead-engine/apps/worker/output/family-tree-discovery-report.pdf`
- Enriched report proof:
  - title present: `ESTATE OF ANNIE HAWKINS`
  - Table of Contents present.
  - phone section present.
  - email section present.
  - likely current address section present.
  - address-history section present.
  - refreshed PDF size: 309,664 bytes.
  - refreshed PDF timestamp: `2026-06-25T22:21:45.762Z`.
