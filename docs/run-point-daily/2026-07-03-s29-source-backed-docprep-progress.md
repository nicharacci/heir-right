# 2026-07-03 S29 Source-Backed Doc Prep Progress

Status: implemented first S12/S29 source-backed Doc Prep repair pass in `probate-lead-engine`.

## What Changed

- Added first-class tax receipt fields to the shared data contract:
  - `tax_receipt_link`
  - `tax_paid_date`
  - `TAX_COLLECTOR_LISTING_PAGE_REQUIRED`
  - `TAX_RECEIPT_LINK_REQUIRED`
  - `TAX_RECEIPT_LINK_CAPTURED`
- Added a deterministic Tax Collector listing-page receipt extractor.
- Wired `/api/discovery/source-capture` so listing page HTML or an explicit receipt link returns structured facts for:
  - `tax_receipt_link`
  - `tax_receipt_attachment`
  - `tax_paid_date`
  - `tax_payer_identity`
  - `tax_last_paid_by`
  - `tax_amount_due`
- Updated dossier, source coverage, evidence QA, completed report, internal summary, and Podio payloads to include receipt link and paid date.
- Updated Doc Prep public-record capture UI to collect Tax Collector listing URL, bottom-right receipt link, paid-by, paid date, amount due, unpaid years, status, and optional listing-page HTML.
- Updated the tax phase so it no longer completes on listing URL alone. It needs a receipt link/source URL or an explicit unavailable-after-listing-check status.
- Changed the rail preview header to `Preview`.
- Bounded the PDF preview card/frame so the preview sits inside the rail container.
- Verified existing Option+Up / Option+Down section cycling is present.

## Proof Run

- `pnpm build`: passed.
- `pnpm test`: passed.
- Local artifact server: `AUTH_REQUIRED=false PORT=4174 pnpm --filter @ple/artifact dev`.
- `POST /api/discovery/source-capture` with a Tax Collector listing-page HTML fixture returned:
  - `mode: review_receipt`
  - `factType: tax_receipt_link`
  - `value: https://county-taxes.example/receipts/2025-paid.pdf`
  - unique response flags: `HUMAN_REVIEW_REQUIRED, TAX_RECEIPT_LINK_CAPTURED`
  - receipt fact flags: `TAX_RECEIPT_LINK_CAPTURED, HUMAN_REVIEW_REQUIRED`
  - `tax_paid_date: 2025-11-18`
- `POST /api/exports` for a batch Discovery export returned:
  - `artifact.kind: single_pdf`
  - `artifact.contentType: application/pdf`
  - `artifact.flow: discovery`
- `HEAD /api/reports/pdf` returned:
  - `Content-Type: application/pdf`
- Static route proof found:
  - `Preview`
  - `pdf-packet-card`
  - `pdf-packet-frame`
  - `Option+Up / Option+Down`
  - `Help & Demos`
  - Tax Collector listing-page/bottom-right receipt language.
- Targeted legacy scan found no remaining `Live packet preview`, `memorial_search_placeholder`, `placeholderNode`, or `review-placeholder` tokens in the touched Doc Prep/worker surfaces.
- Fresh Chrome proof after clearing generated temp artifacts showed:
  - Dossier rail Docs tab uses a bounded `.pdf-packet-card`.
  - Embedded `.pdf-reader` geometry is contained by its card.
  - Report rail Docs tab toolbar text starts with `Preview`.
  - `Completed report packet` and `Live packet preview` are absent from the served page.
  - `.pdf-packet-frame` geometry is contained by its card.
  - Console and page error arrays were empty.
- Direct fallback workflow packet text check used `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf` because the canonical copy was absent. Extracted text confirms the workflow requires tax history, receipt status, who paid taxes, downloading tax receipts when payer differs, civil/family/probate records, marriage, obituary, Findagrave/Legacy/Ancestry/Intelius/IDI, voter records, and completed lead report fields.

## Current IDI Proof Blocker

IDI Core shared-default proof is blocked by missing deployment/runtime config:

- Local runtime: `IDI_CORE_API_KEY` missing, `IDI_CORE_API_URL` missing.
- Vercel project env list for `heirright-landing-demo`: no `IDI_CORE_API_KEY` or `IDI_CORE_API_URL` entries found.
- `/api/connections/status` reports IDI Core as `operator_portal` / `review` mode with portal configured, `api.endpointConfigured: false`, `api.sharedDefaultConfigured: false`, `api.userOverrideAllowed: true`, and `api.liveRunApproved: false`.
- Current app behavior is correct for this state: personal user override is allowed, but live paid backend runs block until explicit approval and vendor endpoint/shared access are present.
- This means the code path supports team default plus user override, but the shared default is not actually configured in the current local/deployment environment.
- `/api/discovery/idi-asset-search/import` correctly rejects an import without approved report text/metadata with `missing_idi_report`.

## Anti-Negligence Review

- Source checked: the user-corrected Tax Collector receipt source is the listing page, with the receipt link in the bottom-right corner. The app now models that source directly instead of treating the receipt as an optional manual attachment.
- Backward pass: Discovery evidence, dossier fields, report sections, internal summary, Podio payloads, QA checks, and validation now know about receipt link and paid date.
- Gap pass: this does not yet discover the real county Tax Collector endpoint by browser workflow; it parses supplied listing HTML or an explicit receipt link. Browserbase/script automation remains the next implementation step.
- UX pass: the public-record capture UI now asks for listing page, bottom-right receipt link, paid-by, paid date, amount due, unpaid years, and source note. The phase cannot complete on listing URL alone.
- PDF/export pass: batch export route still returns one `single_pdf` artifact for Discovery with `application/pdf`.
- Preview pass: served UI has `Preview`, `pdf-packet-card`, and `pdf-packet-frame`; no `Live packet preview` string remains.
- Verdict: this repairs the Tax Collector receipt miss and makes the source contract explicit. It is not a claim that every S29 source workflow is complete.

## Second Repair Pass: Other Source Steps

- Expanded `/api/discovery/source-capture` beyond the Tax Collector path. It now emits structured facts for Official Records deed/title, Property Appraiser mailing address, Probate docket/document availability, and obituary/vital review fields.
- Tightened deed completion: the deed phase now needs source evidence plus OR book/page, instrument, or equivalent identifier. A typed instrument alone no longer completes the phase.
- Expanded public-record capture UI with fields for Official Records source, deed PDF/link, OR book/page, recording date, grantor/grantee, title-friction signals, Property Appraiser mailing address/source, probate docket/case/document availability, DOB/DOD, marriage signal, and death certificate status.
- Added packet/evidence rows for Official Records source, deed attachment, grantor/grantee, Property Appraiser mailing, probate docket/status/documents, and DOB/DOD.
- Broad source-capture route proof returned:
  - `mode: source_review`
  - `sourceFactCount: 35`
  - fact coverage for `tax_receipt_link`, `latest_deed`, `deed_attachment`, `mailing_address_signal`, `case_number`, `obituary_link`, and `date_of_death`.
- Served DOM proof found the new source fields plus `Preview` and `pdf-packet-card`.

## Third Repair Pass: Single-PDF Export Contract

- Local artifact server, serverless export fallback, and worker export response now normalize the requested Doc Prep flow instead of treating every batch as generic Discovery.
- Discovery batch export route proof returned:
  - `artifact.kind: single_pdf`
  - `artifact.contentType: application/pdf`
  - `artifact.flow: discovery`
  - `artifact.estateId: estate-proof-discovery`
  - sections: `Discovery dossier`, `Completed lead report`, `Source notes`, `Closing Prep review`, `CRM handoff`
- Closing Prep batch export route proof returned:
  - `artifact.kind: single_pdf`
  - `artifact.contentType: application/pdf`
  - `artifact.flow: closing-docs`
  - `artifact.estateId: estate-proof-closing`
  - sections: `Reviewed Discovery File`, `Closing field map`, `Required seller/client fields`, `Template fill review`, `Closing Prep packet`
- PDF route proof returned `Content-Type: application/pdf` and `Content-Disposition: inline; filename="heirright-report-packet.pdf"`.
- Fresh local API proof after the preview fix returned real PDF bytes for both batch flows:
  - Discovery batch: `artifact.kind: single_pdf`, `artifact.contentType: application/pdf`, `artifact.flow: discovery`, `sectionCount: 5`, PDF magic `%PDF-1.4`.
  - Closing batch: `artifact.kind: single_pdf`, `artifact.contentType: application/pdf`, `artifact.flow: closing-docs`, `sectionCount: 5`, PDF magic `%PDF-1.4`.

## Fourth Repair Pass: Public Source Acquisition Contracts

- Added dossier-level public source acquisition contracts for:
  - `property_appraiser`
  - `tax_collector_receipt`
  - `official_records_deed`
  - `probate_court`
  - `obituary_vital_review`
- Added validation so the worker test fails if public-source contracts are missing or if the Tax Collector contract does not include the blocking `bottom_right_receipt` stage.
- Generated dossier proof from `apps/worker/output/latest-dossier.json` showed:
  - `contractCount: 5`
  - Tax Collector stage codes: `tax_search`, `listing_page`, `bottom_right_receipt`, `payer_review`
  - `bottom_right_receipt.blocksUntilCaptured: true`
  - required evidence: `receipt link`, `receipt artifact`

## Fifth Repair Pass: Preview Containment And Plan Refinement

- Freed generated/temp artifacts enough to run fresh Chrome proof.
- Moved `.rail-card.pdf-packet-card` CSS inside the actual stylesheet and removed the dead rule that had been appended after `</html>`.
- Applied bounded `pdf-packet-card` behavior to both the Dossier rail embedded reader and report rail packet frame.
- Changed the completed packet rail eyebrow to `Preview`.
- Verified in Chrome that the Dossier rail reader is contained in its card and has no console/page errors.
- Verified in Chrome that the report rail Docs tab shows `Preview`, no `Completed report packet`, no `Live packet preview`, and the PDF frame is contained in its card.
- Final Chrome proof also confirmed the iframe title is `Preview PDF` and the served page HTML no longer contains `Completed report packet`.
- Refined S29-S32 briefs, S29 anti-negligence review, S30 progress, IDI configuration, and source-adapter plan so later sprints cannot claim completion without the corrected Tax Collector receipt, source evidence, and IDI API/shared-default proof.

## Sixth Repair Pass: Tax Collector Acquisition Client

- Added a guarded Tax Collector receipt acquisition client in the worker:
  - accepts explicit receipt links and operator-supplied listing HTML;
  - fetches a direct listing URL or configured `TAX_COLLECTOR_LISTING_URL_TEMPLATE`;
  - when `TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED=true` and no listing URL is configured, probes the public GovHub entry;
  - extracts the bottom-right receipt/payment/print link when the listing page is reachable;
  - returns `browser_workflow_required` with `TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED` when the public entry is Cloudflare/JavaScript blocked.
- Added shared seed fields for `taxCollectorListingUrl` and `taxCollectorReceiptUrl`.
- Threaded the acquisition result into tax-history source facts and the manual receipt task, so the operator-facing blocker now says the Tax Collector public search needs a browser workflow instead of only saying the receipt is missing.
- Added validation fixtures for:
  - listing-page HTML with a bottom-right receipt link resolving to `https://miamidade.county-taxes.test/receipts/2025-paid.pdf`;
  - Cloudflare-style `Just a moment...` response returning `browser_workflow_required` and `TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED`.
- Live public-entry proof with `TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED=true` returned:
  - `mode: browser_workflow_required`;
  - `status: 403`;
  - `listingUrl/searchUrl: https://miamidade.county-taxes.com/public`;
  - review flags: `SOURCE_BLOCKED`, `TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED`, `TAX_COLLECTOR_LISTING_PAGE_REQUIRED`, `TAX_RECEIPT_LINK_REQUIRED`, `HUMAN_REVIEW_REQUIRED`, `NO_ENRICHMENT_RUN`.
- Live pipeline proof preserved that blocker in dossier facts and in `taxHistory.manualReceiptTask.reason`.
- Completed lead report flag rendering now converts `TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED` to `Tax Collector browser workflow required`.

## Seventh Repair Pass: Saved Browser-Workflow Blocker

- Upgraded every `/api/discovery/source-capture` fallback path so Tax Collector source status is saved as a first-class `source_status` fact, not only implied by a missing receipt link:
  - local artifact server fallback;
  - serverless artifact API fallback;
  - Cloudflare worker route.
- Added a Doc Prep receipt status option for `Browser workflow blocked` and a plain-language `Tax source blocker note` field.
- Kept the Tax Collector phase incomplete when `browser_workflow_required` is selected, even if a listing URL is present.
- Added Tax Collector source status/blocker rows to the Discovery evidence table and Tax History packet.
- Route proof on `http://localhost:4176/api/discovery/source-capture` with a browser-blocked GovHub payload returned:
  - `mode: source_review`;
  - `source_status.value.mode: browser_workflow_required`;
  - `source_status.value.ok: false`;
  - `SOURCE_BLOCKED`, `TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED`, `TAX_COLLECTOR_LISTING_PAGE_REQUIRED`, `TAX_RECEIPT_LINK_REQUIRED`, `HUMAN_REVIEW_REQUIRED`, `NO_ENRICHMENT_RUN`.
- Route proof with a listing-page HTML fixture still returned:
  - `source_status.value.mode: listing_page_bottom_right`;
  - `source_status.value.ok: true`;
  - `receiptUrl: https://miamidade.county-taxes.test/receipts/2025-paid.pdf`;
  - `tax_receipt_link` with `TAX_RECEIPT_LINK_CAPTURED`.
- Chrome proof through system Chrome confirmed the rendered Doc Prep controls include:
  - the `browser_workflow_required` receipt status option;
  - the `taxReceipt.sourceBlockedReason` blocker field;
  - the `taxReceipt.status` select;
  - no console/page errors.
- Served bundle proof confirmed:
  - `Preview` present;
  - `Live packet preview` absent;
  - `pdf-packet-card` and `pdf-packet-frame` present;
  - Tax Collector blocker/receipt copy present.

## Automation Decision: Script First, Browser Workflow When Required

- Deterministic script remains the right path when the app has a direct Tax Collector listing URL, supplied listing HTML, explicit receipt link, or a stable discovered endpoint.
- Browserbase or controlled Chrome workflow is required for GovHub/public-search navigation when the public entry returns JavaScript/Cloudflare/browser challenges.
- If browser observation exposes stable API calls behind the listing page, promote those calls into the deterministic script client.
- Until that is proven, the app must save `browser_workflow_required` as a source blocker and keep Discovery incomplete instead of silently leaving receipt/payer fields blank.

## Eighth Repair Pass: Source Readiness Status And Live Browser Probe

- Added `Tax Collector Source` to connection status outputs so Settings can distinguish generic Web Search from the exact Tax Collector acquisition path.
- Shared status contract now exposes:
  - `configuredMode: script_listing`, `browser_workflow`, or `none`;
  - `sourceAutomation.scriptDirectListingConfigured`;
  - `sourceAutomation.scriptLiveProbeEnabled`;
  - `sourceAutomation.browserWorkflowConfigured`;
  - `sourceAutomation.publicSearchUrl`.
- Local route proof on `http://localhost:4177/api/connections/status` returned `Tax Collector Source` as:
  - `ok: false`;
  - `mode: blocked`;
  - `configuredMode: none`;
  - blocker: configure a listing URL template or Browserbase/Chrome workflow before claiming public-search automation.
- Served UI bundle proof confirmed `Tax Collector Source` and the public-search browser-workflow copy are present.
- Live system-Chrome probe of `https://miamidade.county-taxes.com/public` returned:
  - page title: `Just a moment...`;
  - body copy: security verification / malicious bots / Cloudflare;
  - hidden `cf-turnstile-response` input;
  - no searchable Tax Collector form controls;
  - challenge-platform requests and 401/403 console errors.
- Conclusion: the public GovHub entry cannot be treated as a deterministic script entry point. Script capture remains correct for direct listing/template/source HTML paths; Browserbase or controlled Chrome is required to acquire listing pages from the public search flow.

## Ninth Repair Pass: Unified Discovery Source Run

- Added `/api/discovery/external-source-run` in all served runtimes:
  - Cloudflare worker route;
  - local artifact server route;
  - serverless artifact fallback.
- The route runs the existing dry pipeline from an estate seed and returns a single estate-scoped source run with:
  - `mode: external_source_run`;
  - `runId`;
  - `estateId`;
  - `sourceSummaries`;
  - `sourceFacts`;
  - `blockers`;
  - dossier readback.
- Source summaries now cover the Discovery buckets explicitly:
  - Property Appraiser;
  - Tax Collector;
  - Official Records;
  - Probate/Civil/Family Court;
  - marriage/death/obituary/vital review;
  - IDI Core Asset Search;
  - skip trace/contact enrichment.
- The route does not fake completion. It returns `ok: false` when any required source remains blocked or needs review.
- Local route proof on `http://localhost:4178/api/discovery/external-source-run` with a Miami-Dade estate seed returned:
  - `mode: external_source_run`;
  - all seven source buckets present;
  - `sourceFacts: 49`;
  - Property Appraiser status: `partial`;
  - Tax Collector status: `blocked`;
  - `blockers: 7`.

## Tenth Repair Pass: Source Search In Doc Prep

- Added an operator-facing `Run Source Search` control to the Doc Prep public-record capture panel.
- The control saves the current capture fields, runs `/api/discovery/external-source-run`, and writes the returned source facts, source summaries, blockers, and tax receipt status back into the estate-scoped source-capture state.
- Tax Collector source-run results now write back:
  - `browser_workflow_required` status when the source run sees the GovHub/browser blocker;
  - the plain-language blocker note;
  - receipt link/status when a receipt URL is actually returned.
- Property Appraiser results write back source URL and mailing-address signal when present.
- Added source-run summary rendering above the capture fields so an operator sees which sources returned facts and which still need review.
- Added QA/demo deep links for the actual Doc Prep rail:
  - `?view=dossiers&docprep=estate&rail=open&walkthrough=off`;
  - `section=source-capture` / `section=source-search`.
- Full proof after this pass:
  - `pnpm build`: passed.
  - `pnpm test`: passed.
  - Headless Chrome DOM proof for `?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` found `Public-record capture`, `Run Source Search`, `Tax Collector listing page`, `Bottom-right receipt link`, `Tax source blocker note`, and `Listing page HTML / source note`.
  - Visual proof saved at `/tmp/heirright-docprep-source.png` showed the Doc Prep rail on the public-record capture panel with tax receipt fields contained inside the rail.

## Eleventh Repair Pass: Clerk Commercial API Path

- Researched the official Miami-Dade Clerk Commercial Data Services API docs:
  - Official Records API: `GET api/OfficialRecords?parameter1={parameter1}&parameter2={parameter2}&authKey={authKey}`.
  - Civil/Family/Probate case API: `GET api/Civil?caseNumber={caseNumber}&AuthKey={AuthKey}`.
  - Civil docket API: `GET api/Civil?civilCaseNumber={civilCaseNumber}&AuthKey={AuthKey}`.
  - The Clerk documentation says developer accounts must be enabled and contain units; commercial API use is paid per request.
- Added a typed worker adapter for those official APIs:
  - Official Records searches by folio using `parameter1=<folio>` and `parameter2=FN`.
  - Civil/Family/Probate uses the estate case number when present.
  - API URLs are redacted before they are stored in source facts.
  - Missing `MIAMI_DADE_CLERK_AUTH_KEY` creates explicit `source_status` blockers instead of generic manual-review text.
- Routed Official Records and Probate/Civil/Family Court source facts through this API adapter before the older health-only/browser fallback facts.
- Added `Miami-Dade Clerk API` to Settings connection status with:
  - `configuredMode: commercial_api` when an AuthKey exists;
  - `configuredMode: none` and a blocker when the AuthKey is missing;
  - exact endpoint shapes for Official Records, case, and docket APIs.
- Local route proof on `http://localhost:4178/api/discovery/external-source-run` returned:
  - Official Records status: `blocked`;
  - Official Records next action: Clerk Official Records API requires a commercial Developer AuthKey and pre-paid units;
  - Probate/Civil/Family Court status: `blocked`;
  - Probate next action: Clerk Civil/Family/Probate API requires a commercial Developer AuthKey and pre-paid units;
  - `source_status.value.mode: commercial_api_key_required` for both buckets.
- Local Settings proof on `http://localhost:4178/api/connections/status` returned `Miami-Dade Clerk API` as blocked with endpoint shapes and `MIAMI_DADE_CLERK_AUTH_KEY` blocker.

## Twelfth Repair Pass: Tax Collector Browser Workflow API Hook

- Added a standard `TAX_COLLECTOR_BROWSER_WORKFLOW_URL` contract to the worker Tax Collector receipt client.
- When no direct listing page URL/source HTML is available, the client can call that workflow endpoint with:
  - `source: tax_collector`;
  - public search URL;
  - folio;
  - property address;
  - owner name.
- The workflow response can return `listingHtml`, `listingUrl`, `receiptUrl`, or `receiptLink`. The worker still runs the deterministic bottom-right receipt extractor over the returned result.
- Authorization uses `TAX_COLLECTOR_BROWSER_WORKFLOW_TOKEN` or `BROWSERBASE_API_KEY` when present.
- Direct adapter proof with a mocked browser-workflow response returned:
  - `ok: true`;
  - `mode: listing_page_bottom_right`;
  - `receiptUrl: https://miamidade.county-taxes.test/receipt/2025.pdf`;
  - review flags: `TAX_RECEIPT_LINK_CAPTURED`, `HUMAN_REVIEW_REQUIRED`.

## Next Work

- Point `TAX_COLLECTOR_BROWSER_WORKFLOW_URL` at the real Browserbase or controlled Chrome workflow, run it against GovHub, and store the captured listing/receipt proof.
- If browser observation exposes stable API calls behind GovHub, move them into the deterministic script client.
- Configure/prove `MIAMI_DADE_CLERK_AUTH_KEY` in the target environment, then run a paid controlled Official Records and Civil/Family/Probate API proof with readback.
- Add actual extraction adapters or browser workflows for vital/obituary sources. They are currently visible/callable buckets with blockers, not proven end-to-end automations.
- Rerun S30 demos against the corrected S29 source contracts before treating S30 as final client acceptance proof.
- Continue source-backed treatment for marriage/death, offender/professional-license, voter/license, field/neighbor/code-enforcement, and paid/manual research tasks as explicitly human-required or approval-gated.
