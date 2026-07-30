# 2026-06-25 North Star Doc Discovery Progress

## Superseding Goal

Complete HeirRight document discovery so a live lead can render a family-tree packet at the same level of structure and completeness as the Constance / Deborah North Star examples: compact Google Docs-like PDF layout, linked property/source text, discovery summary, back story, possible heirs, address histories, phone numbers, emails, source review, and export-ready app artifacts for Podio / Google review.

Clarification applied: because Annie Hawkins does not have real deal terms, offer/profit/underwriting elements are excluded from the completed packet instead of being filled with placeholders.

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

## 2026-06-25 19:09 EDT - Annie Hawkins discovery-only packet finalized

Goal written for this pass: complete the Annie Hawkins discovery document package with contact enrichment, matching the North Star family-tree packet shape, while explicitly removing offer/profit/underwriting language because no real deal terms exist.

What changed:
- Added an `includeDealMath` intake switch and threaded it through the worker so discovery-only packets do not render offer/profit tables, offer tasks, underwriting review copy, or `offer_math` Podio payload fields.
- Kept normal deal-packet behavior intact when offer facts are present; the validation sample still exercises that path.
- Made tax/title review-task copy deal-aware so unpaid-tax and title-friction gaps read as discovery/document-prep gates when no deal facts exist.
- Made outreach readiness and Podio dry-run payloads deal-aware so discovery-only handoff language contains no offer/profit/underwriting blockers.
- Preserved the Apify skip-trace contact-enrichment facts from the successful actor run as confirmed source facts for Annie, with live token use disabled for deterministic demo regeneration.

Final Annie proof:
- Final run id: `run-1782429876958-annie-hawkins-est-of`.
- Output packet: `probate-lead-engine/apps/worker/output/family-tree-discovery-report.pdf`.
- PDF metadata: 11 pages; title `ANNIE HAWKINS EST OF Family tree`.
- Family-tree packet contains: Discovery Summary, Table of Contents, Back Story, Possible heirs, address-history section, phone section, email section, and Source review.
- Redacted contact proof: 3 enriched contact profiles; phone counts `[15, 51, 26]`; email counts `[8, 0, 8]`; address-history counts `[23, 38, 32]`.
- Skip-trace proof: `NO_ENRICHMENT_RUN` and `SKIP_TRACE_NOT_CONFIGURED` are not present in the final Annie facts.
- Deal-language proof: generated report, family-tree HTML, latest dossier JSON, and Podio dry-run payload have zero user-facing offer/profit/underwriting elements for Annie; discovery-only reports omit `offerMath` and use `family_tree_contacts`.

Source-backed gates left visible instead of faked:
- Miami-Dade Property Appraiser facts are captured for owner, folio, property, deed/OR book-page, assessed values, taxable values, and property characteristics.
- Miami-Dade Tax Collector payment/receipt lookup hit Cloudflare and remains an operator receipt-review step.
- Miami-Dade Clerk Official Records and OCS search routes were identified, but direct worker extraction is browser/captcha-gated; probate/court status remains manual review until a browser-backed pass is approved.

Verification:
- `pnpm --filter @ple/types build` passed.
- `pnpm --filter @ple/worker build` passed.
- `pnpm --filter @ple/worker test` passed before restoring Annie as the app-facing output.
- `git diff --check` passed.
- Generated PDF was rendered by headless Chrome and previewed with Quick Look at `/tmp/heirright-annie-final-preview/family-tree-discovery-report.pdf.png`.

## 2026-06-25 19:42 EDT - Outreach template workspace first working slice

Scope:
- Kept the attachment picker back in the editor body near the paperclip instead of floating above the modal footer.
- Converted the Outreach tab from static scheduled-work copy into a campaign/template workspace with active campaigns, template lists, selected-template preview, dossier variable registry, approval controls, audit trail, archive view, and local cadence controls.
- Added local demo persistence for campaigns, templates, and audit events under `heirright:outreach-workspace` as the UI bridge before the server/API tasks are built.
- Added bottom-right liquid-glass sync notifications and a Settings CTA for missing Podio credentials.
- Added Linear-ready implementation tasks in `docs/run-point-daily/2026-06-25-outreach-linear-ready-tasks.md`.

Browser proof on `http://localhost:4188/?proof=outreach-workspace-modal`:
- Paperclip click opened the attachment popover from the body editor, 6 px above the toolbar.
- Modal scroll stayed at `420` before and after opening the attachment popover.
- Attachment option click also preserved modal scroll at `420`.
- New SMS template saved as Draft and appeared in the campaign template list.
- Mark Ready transitioned the selected template to Ready without opening the activity drawer over the action chips.
- Approve without password showed the bottom-right `Password required` notification.
- Approve with an entered password transitioned the template to Approved and exposed `Sync Podio`.
- Sync Podio with missing Podio connection showed `Podio is not connected`, stated that no SMS/email/CRM/Google/Resend artifact was created, and exposed `Open Settings`.
- Open Settings CTA routed to the Settings surface.

Verification:
- `rm -rf apps/artifact/dist && pnpm --filter @ple/artifact build` passed after the final UI changes.

Still not complete:
- Server-side Outreach CRUD, approval enforcement, Podio sync/readback, Resend fallback, and Linear fallback ticket creation remain future tasks in the new task breakdown.
- Current UI persistence is local artifact storage for client demo continuity; it is not production storage yet.

## 2026-06-25 20:06 EDT - Fresh-lead status behavior tightened

Scope:
- Changed the Estate Search fresh-pull inline status so it is fully collapsed at rest.
- Removed the inline `Pulling...` message from the filter pane; while a pull is in flight, only the top workspace status and the busy button state show progress.
- Kept the inline status for a real successful pull or a real blocked response, with the success message fading/sliding into the filter pane after data returns.

Local browser proof on `http://localhost:4188/?proof=fresh-status-local`:
- Initial `freshBatchStatus`: empty, `data-visible="false"`, `opacity: 0`, `max-height: 0px`, rendered height `0`.
- Immediately after clicking `Pull fresh leads`: still empty and hidden, while `topStatus` read `Pulling a live external lead batch...` and the button was busy.
- After the successful fresh run returned: `data-visible="true"`, `tone="ready"`, `opacity: 1`, `max-height: 52px`, rendered height `32.375`, and text `3 live leads pulled from Miami-Dade Property Appraiser.`

Verification:
- `git diff --check` passed.
- `pnpm --filter @ple/artifact build` passed.

## 2026-06-25 20:31 EDT - Fresh-pull live production proof completed

Production blockers found during live proof:
- The Vercel fresh-pull route first failed on `Cannot find package 'react' imported from /var/task/apps/worker/dist/markdown/render-streamdown.js`.
- Fixed by replacing the worker Markdown renderer's variable dynamic import helper with literal dynamic imports for `react`, `react-dom/server`, and `streamdown`, so Vercel can trace the runtime dependencies.
- The route then failed on `EROFS: read-only file system, open 'output/fresh-lead-batch.json'`.
- Fixed by keeping local output persistence for normal local/CLI runs, but making Vercel API persistence nonfatal. If serverless output writes are read-only, the API now returns the generated fresh-batch result with `outputPersistence.mode = "ephemeral"`.
- The inline status initially had a cascade/transition issue where `data-visible="true"` was set but the row stayed collapsed. Replaced the status with a plain `hidden` message row so rest and in-flight states have no visible row, and success is a normal visible row.

Final live browser proof on `https://heirright-landing-demo.vercel.app/?proof=fresh-status-visible-live`:
- Initial status: `hidden: true`, `data-visible="false"`, `display: none`, rendered height `0`, no text.
- Immediately after clicking `Pull fresh leads`: still hidden with no inline message; top status read `Pulling a live external lead batch...`; button busy.
- Final result: `hidden: false`, `data-visible="true"`, `tone="ready"`, `display: block`, `opacity: 1`, margin-top `8px`, rendered height `32.375`.
- Final status text: `3 live leads pulled from Miami-Dade Property Appraiser.`
- Live result table rendered `3` rows and selected `Hawkins, A.`
- Top status: `Pulled 3 live leads from 40 Miami-Dade Property Appraiser candidates using owner search "EST OF". First lead: ANNIE HAWKINS EST OF.`
- Browser console errors: none.

Verification:
- `pnpm --filter @ple/artifact build` passed.
- `pnpm --filter @ple/worker build` passed.
- `pnpm --filter @ple/worker test` passed.
- Production deploys passed and aliased to `https://heirright-landing-demo.vercel.app`.
- Commits pushed during this pass:
  - `b09ef48` - fresh status timing
  - `b8ec726` - worker renderer import tracing
  - `6aa6a6f` - serverless ephemeral fresh-batch output
  - `05881cf` - visible fresh-pull success status
