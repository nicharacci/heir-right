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
