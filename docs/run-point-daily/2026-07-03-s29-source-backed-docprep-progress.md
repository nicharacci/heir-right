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

## Thirteenth Repair Pass: Vital/Obituary Workflow API Hook

- Replaced the worker marriage/death/obituary adapter's import-only/manual posture with a configurable browser/API workflow contract:
  - `OBITUARY_VITAL_WORKFLOW_URL`;
  - `VITAL_OBITUARY_WORKFLOW_URL`;
  - `MARRIAGE_DEATH_WORKFLOW_URL`.
- The worker posts estate name, owner name, property address, folio, case number, county, and the Clerk search URL to the configured workflow.
- Workflow responses can persist reviewable Discovery facts for:
  - marriage-license signal;
  - date of birth;
  - date of death;
  - obituary link;
  - obituary snapshot/excerpt/attachment;
  - death-certificate status;
  - incarceration/deceased-indicator status.
- When no workflow is configured, the source run now saves a first-class `source_status` fact with:
  - `source_status.value.mode: workflow_required`;
  - `VITAL_RECORDS_WORKFLOW_REQUIRED`;
  - a plain-language next action for vital, obituary, marriage-license, death-certificate, Findagrave/Legacy, and deceased-indicator review.
- Added `Vital/Obituary Workflow` to Settings/export readiness so the app no longer hides this requirement behind generic Web Search readiness.
- Direct adapter proof with a mocked workflow response returned:
  - `source_status.value.mode: workflow_reviewed`;
  - `date_of_death: 2024-01-02`;
  - `obituary_link: https://legacy.test/example-obituary`;
  - `marriage_license_signal: reviewed-no-hit`;
  - `death_certificate_status: requested-not-attached`.
- Local route proof on `http://localhost:4178/api/discovery/external-source-run` returned:
  - vital summary mode `browser_workflow_or_source_capture`;
  - vital summary status `needs_review`;
  - `source_status.value.mode: workflow_required`;
  - `VITAL_RECORDS_WORKFLOW_REQUIRED`.
- Local Settings proof on `http://localhost:4178/api/connections/status` returned `Vital/Obituary Workflow` as blocked with `OBITUARY_VITAL_WORKFLOW_URL` blocker.
- Route-level UI proof for `?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` confirmed:
  - `Public-record capture`;
  - `Run Source Search`;
  - `Tax Collector listing page`;
  - `Preview`;
  - old `Live packet preview` wording absent.

## Fourteenth Repair Pass: Route-Visible Governed Research Bucket

- Promoted source governance from an intake-only catalog fact to a route-visible `source_governance` source bucket.
- Expanded governed/manual research coverage for workflow-packet sources that are not safe to fake as automated:
  - voter records;
  - professional licenses;
  - business and address associations;
  - social profiles;
  - deceased-indicator cross-checks.
- Added manual task rows for voter-record, professional-license, business/address, and social-profile review.
- `/api/discovery/external-source-run` now returns 8 source summaries, including `Governed manual and paid research`.
- Local route proof returned:
  - governance mode `approval_gated_source_governance`;
  - governance status `blocked`;
  - review flags `PAID_SOURCE_APPROVAL_REQUIRED`, `MANUAL_SOURCE_APPROVAL_REQUIRED`, `HUMAN_REVIEW_REQUIRED`, `NO_ENRICHMENT_RUN`;
  - all newly named governed source codes present in the returned `source_governance_catalog`.

## Fifteenth Repair Pass: Direct Browserbase Function Acquisition Paths

- Added direct Browserbase Function invocation to the worker Tax Collector receipt acquisition path.
- Added direct Browserbase Function invocation to the worker vital/obituary/marriage/death indicator path.
- Added deployment env contract:
  - `BROWSERBASE_API_KEY`;
  - `BROWSERBASE_API_BASE`;
  - `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`;
  - `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`.
- Fixed the actual Tax Collector source-run gate so function credentials trigger acquisition. The previous direct adapter proof was not enough because `fetchTaxHistoryFacts` did not request acquisition for Browserbase-only config.
- Settings/export readiness now marks:
  - `Tax Collector Source.sourceAutomation.browserbaseFunctionConfigured`;
  - `Vital/Obituary Workflow.sourceAutomation.browserbaseFunctionConfigured`.
- Validation now includes mocked Browserbase Function proof for:
  - Tax Collector bottom-right receipt extraction;
  - vital/obituary DOB/DOD/obituary/marriage/death-certificate facts.
- Full local route proof with a mocked Browserbase API and actual `http://localhost:4178/api/discovery/external-source-run` returned:
  - Tax Collector `tax_receipt_link: https://miamidade.county-taxes.test/receipt/2025-paid.pdf`;
  - Tax Collector `source_status.value.mode: listing_page_bottom_right`;
  - vital `date_of_death: 2024-01-02`;
  - vital `source_status.value.mode: workflow_reviewed`;
  - Settings showed both Browserbase function paths configured;
  - route still returned `ok: false` because Official Records, Probate/Civil/Family, IDI, skip trace, and governed manual/paid research were still honestly blocked or review-gated.

## Sixteenth Repair Pass: Deployable Browserbase Function Sources

- Added `probate-lead-engine/browserbase-functions` with deployable function sources:
  - `src/tax-collector-receipt.mjs`;
  - `src/vital-obituary-review.mjs`;
  - `src/source-helpers.mjs`.
- Added a function-package check script that syntax-checks both functions and runs deterministic extraction contract tests.
- Tax Collector function contract:
  - accepts folio/address/owner/search URL;
  - searches or opens the Tax Collector listing page;
  - extracts the bottom-right receipt/payment/print link;
  - returns a blocker when the page loads without a receipt link.
- Vital/obituary function contract:
  - accepts estate/owner/county/source URLs;
  - captures obituary/memorial candidates;
  - preserves source URL, snapshot text, DOB/DOD hints, marriage/death-certificate review states;
  - returns review facts only, not heirship conclusions.
- Updated the vital Browserbase invocation allowlist to permit Google search when the function uses Google to discover obituary/memorial pages.
- Proof:
  - `node --check src/source-helpers.mjs && node --check src/tax-collector-receipt.mjs && node --check src/vital-obituary-review.mjs && node test/contracts.test.mjs`: passed.
  - `pnpm build && pnpm test`: passed.

## Seventeenth Repair Pass: Doc Prep Source Readiness Preflight

- Added a source-readiness preflight panel to the Doc Prep public-record capture card before `Run Source Search`.
- The panel shows operator-visible readiness for:
  - Tax receipts;
  - Clerk records;
  - Obituary and vital review;
  - IDI asset search;
  - Manual research.
- The readiness panel reads the existing `/api/connections/status` contract and refreshes the Doc Prep rail once connection statuses load.
- Added plain-language blocker copy for Clerk records and vital/obituary workflow readiness so those gaps are visible before a source run starts.
- Proof:
  - `pnpm build`: passed.
  - `pnpm test`: passed.
  - Local server/API proof on `http://localhost:4178/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` found `Source readiness before this run`, `Tax receipts`, `Clerk records`, `Obituary and vital review`, `IDI asset search`, and `Manual research`.
  - The same proof confirmed `/api/connections/status` exposes `Tax Collector Source`, `Miami-Dade Clerk API`, `Vital/Obituary Workflow`, and `IDI Core`.
  - Chrome Computer Use proof on a clean `localhost:4179` origin switched to `Estate Discovery`, showed the source-readiness rows in the visible Doc Prep rail, clicked `Run Source Search`, and rendered review blockers plus source facts without assuming missing public or paid-source facts.

## Eighteenth Repair Pass: Source-Capture Deep Link Honors Discovery

- Fixed the Doc Prep QA/demo route so `section=source-capture` and `section=source-search` force the `Estate Discovery` workflow before render.
- The route also accepts explicit `flow` or `docprepFlow` query params for future demos, but source-capture/source-search default to Discovery because they are Discovery source-acquisition work.
- The forced workflow is not persisted, so opening a source-capture proof link does not overwrite an operator's normal saved workflow preference.
- Proof:
  - `pnpm build`: passed.
  - `pnpm test`: passed.
  - Chrome Computer Use proof on `localhost:4180` first clicked `Closing Prep` to persist the stale workflow state, then reopened `?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture`; the rendered page showed `Estate Discovery`, `Public-record capture`, `Source readiness before this run`, and the source readiness blockers instead of the Closing Prep rail.

## Nineteenth Repair Pass: Source-Run Proof Ledger

- Added a machine-readable `sourceRunProof` ledger to `/api/discovery/external-source-run` across the worker, local artifact server, and serverless fallback.
- The ledger records each required source's:
  - proof state;
  - completion gate;
  - credential or workflow gate;
  - fact count;
  - extracted fact types;
  - review flags;
  - next operator action.
- The ledger explicitly keeps `legalTemplateAutofillAllowed: false` at the run and source level, so Closing Prep cannot treat returned source facts as legal-template permission.
- Source proof states are intentionally conservative:
  - `facts_returned_review_required`;
  - `evidence_required`;
  - `blocked`;
  - `not_checked`.
- Doc Prep now preserves `sourceRunProof` in the saved source-capture run state for future S30/S32 demo and audit assertions.
- Proof:
  - `pnpm build`: passed.
  - `pnpm test`: passed.
  - `node --check probate-lead-engine/apps/artifact/api/discovery/external-source-run.js`: passed.
  - `node --check probate-lead-engine/apps/artifact/server.js`: passed.
  - Local route proof on `http://localhost:4181/api/discovery/external-source-run` returned `sourceRunProof` with 8 sources, `allRequiredSourcesAccountedFor: true`, `readyForDiscoveryCompletion: false`, `legalTemplateAutofillAllowed: false`, `blockedCount: 3`, and `evidenceRequiredCount: 3`.

## Twentieth Repair Pass: Operator-Visible Source Proof And Preview Fit

- Rendered the `sourceRunProof` ledger directly inside the Doc Prep source-run result as an operator-language `What this run proved` section.
- The proof rows now tell the operator what each source requires instead of exposing raw credential names:
  - Property Appraiser: review owner, folio, mailing address, recent sale, and stop-rule signals.
  - Tax Collector: confirm the listing and capture the bottom-right receipt link, payer, paid date, unpaid years, and reassessment notes.
  - Official Records: attach the latest deed or connect Clerk commercial access before OR book/page, instrument, grantor/grantee, lien, or mortgage facts count.
  - Probate/Civil/Family Court, vital/obituary, IDI, skip trace, and governed manual research stay review/blocker rows until evidence exists.
- Fixed the Doc Prep artifact preview sizing so the stream card no longer forces `calc(var(--artifact-preview-height) + 230px)` and the scrollable document stays bounded by `max-height: var(--artifact-preview-height)`.
- Confirmed the artifact preview header source text is exactly `Preview`; CSS renders it uppercase as an eyebrow, but the stale `Live packet preview` copy is absent.
- Proof:
  - `pnpm build`: passed.
  - Local route proof on `http://localhost:4182/api/discovery/external-source-run` returned `sourceRunProof` with `allRequiredSourcesAccountedFor: true`, `readyForOperatorReview: false`, `blockedCount: 3`, and `evidenceRequiredCount: 3`.
  - Served page proof found `What this run proved`, `bottom-right receipt link`, `Review owner name, folio`, `Attach the latest deed`, `Run Source Search`, and `Preview`.
  - Headless Chromium DevTools proof loaded `http://localhost:4182/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture`, clicked the real `Run Source Search` button, and rendered 8 `source-proof-row` entries without exposing `IDI_CORE_API_KEY`, `MIAMI_DADE_CLERK_AUTH_KEY`, or `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID` in operator copy.
  - Headless Chromium Doc Prep preview proof clicked `Run Full Discovery`; `.docprep-artifact-stream` rendered with `minHeight: 0px`, document `height: 228px`, `maxHeight: 228px`, `overflowY: auto`, and `previewFitsCard: true`.
  - Computer Use and Chrome AppleScript execution were not usable in this resumed session: Computer Use returned `cgWindowNotFound`, and Chrome had JavaScript-from-Apple-Events disabled. The fallback proof used the same local browser route through headless Chromium/CDP instead of code-only inspection.

## Twenty-First Proof Pass: IDI Shared Default And User Override

- Rechecked local/deployment env key presence without printing secret values.
- Current local `.env.local` has IDI portal/account context and live-run approval, but it does not contain `IDI_CORE_API_URL` or the shared default `IDI_CORE_API_KEY`.
- Current production-local Vercel env exports also do not contain `IDI_CORE_API_URL`, `IDI_CORE_API_KEY`, Browserbase function credentials, or `MIAMI_DADE_CLERK_AUTH_KEY`.
- Route proof on `http://localhost:4182/api/discovery/idi-core/status` returned:
  - `configuredMode: operator_portal`;
  - `api.endpointConfigured: false`;
  - `api.sharedDefaultConfigured: false`;
  - `api.userOverrideAllowed: true`;
  - blocker: backend live runs need a vendor API endpoint.
- Live-run proof with a pasted user key on `/api/discovery/idi-asset-search/import` returned:
  - HTTP `503`;
  - `error: idi_core_not_configured`;
  - `apiKeySource: user_override`;
  - blocker only named `IDI Core endpoint`, proving the personal key was accepted but the vendor endpoint is still missing.
- Live-run proof with no pasted user key returned:
  - HTTP `503`;
  - `apiKeySource: missing`;
  - blockers named `IDI Core endpoint` and `IDI Core access`, proving the shared default key is not configured in this environment.
- Approved report import proof returned HTTP `200`, `mode: operator_import`, `paidRun: false`, `duplicateGuard: first_import_only`, and the message that the backend did not run IDI Core.

## Twenty-Second Repair Pass: Source-Run Contract Regression Test

- Added `apps/artifact/test/source-run-contract.test.mjs` and wired it into `@ple/artifact` test.
- The test calls the deployed-style `/api/discovery/external-source-run` serverless handler with a Tax Collector listing/receipt fixture and proves:
  - all eight required source buckets are present;
  - `ok` remains false while required source blockers remain;
  - `readyForDiscoveryCompletion` remains false;
  - `legalTemplateAutofillAllowed` remains false at run and source level;
  - the Tax Collector bottom-right `tax_receipt_link` fact is preserved;
  - IDI stays `evidence_required` without approved live or imported evidence;
  - the operator bundle still contains `What this run proved`, receipt/deed/property action copy, `Preview`, bounded preview CSS, and no stale `Live packet preview`.
- Updated `@ple/artifact` test so it builds the worker before the source-run contract test. This avoids a false green caused by worker-dist task-order luck.
- Proof:
  - `pnpm --filter @ple/artifact test`: passed.
  - `pnpm test`: passed.
  - `git diff --check`: passed.
  - Live route proof on `http://localhost:4183/api/discovery/external-source-run` returned `sourceCount: 8`, `allRequiredSourcesAccountedFor: true`, `readyForDiscoveryCompletion: false`, `legalTemplateAutofillAllowed: false`, `blockedCount: 3`, `evidenceRequiredCount: 3`, Tax Collector `proofState: facts_returned_review_required`, Tax Collector `tax_receipt_link` fact present, and IDI `proofState: evidence_required`.
  - Served page proof on `http://localhost:4183/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` found `What this run proved`, `bottom-right receipt link`, `Review owner name, folio`, `Attach the latest deed`, `Run Source Search`, and `Preview`; `Live packet preview` was false.
  - IDI status proof on `http://localhost:4183/api/discovery/idi-core/status` still returned `configuredMode: operator_portal`, `sharedDefaultConfigured: false`, `endpointConfigured: false`, and `userOverrideAllowed: true`.

## Twenty-Third Repair Pass: Source Credential Cache Invalidation

- Added the source-acquisition credential and workflow env vars to `turbo.json` `globalEnv`.
- Covered IDI Core, Browserbase, Tax Collector direct/browser workflow, Miami-Dade Clerk Commercial Data Services, vital/obituary workflow, and alternate worker proxy env names.
- Extended the artifact source-run contract test so it fails if those source-acquisition env vars fall out of Turbo's cache key.
- Why it matters: when TP configures `IDI_CORE_API_URL`, shared `IDI_CORE_API_KEY`, Browserbase function IDs, Clerk AuthKey, or vital/obituary workflow URLs, source-run proof must rerun with the new env instead of reusing stale blocked output.
- Proof:
  - `pnpm --filter @ple/artifact test`: passed and reported `source_acquisition_env_cache_key`.
  - `pnpm test`: passed with all five workspace tasks executing after the env-key change.
  - Direct `turbo.json` proof confirmed `IDI_CORE_API_URL`, `IDI_CORE_API_KEY`, `BROWSERBASE_API_KEY`, `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`, `MIAMI_DADE_CLERK_AUTH_KEY`, and `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID` are tracked.
  - `git diff --check`: passed.

## Twenty-Fourth Repair Pass: Tax Collector Receipt Link Selection

- Hardened the Tax Collector listing-page receipt picker across all active paths:
  - Browserbase function helper;
  - worker Tax Collector adapter;
  - artifact/serverless source-capture helper.
- The picker now scores receipt/tax-bill/print-receipt anchors and de-prioritizes footer/account/history/help links, instead of blindly taking the last payment-like link in the DOM.
- Added fixtures where the correct bottom-right receipt link appears before a later footer `Payment history` link. This would have been brittle under the old last-candidate behavior.
- Proof:
  - `pnpm --dir probate-lead-engine/browserbase-functions run check`: passed.
  - `pnpm --filter @ple/worker test`: passed.
  - `pnpm --filter @ple/artifact test`: passed.
  - `pnpm test`: passed after rebuilding worker TypeScript.
  - Live `POST http://localhost:4184/api/discovery/source-capture` with a listing page containing the bottom-right receipt link plus a later footer `Payment history` link returned `mode: source_review`, `source_status.value.mode: listing_page_bottom_right`, `tax_receipt_link: https://miamidade.county-taxes.test/receipts/2025-live.pdf`, and matching receipt attachment URL.
  - Served page proof on `localhost:4184` still found `Bottom-right receipt link`, `Tax Collector listing page`, `What this run proved`, and `Preview`; `Live packet preview` remained absent.

## Twenty-Fifth Repair Pass: Source Readiness Contract

- Added an executable artifact contract test for `/api/connections/status` source readiness.
- The test locks the distinction TP asked about:
  - Tax Collector is not "an API" by default; it is direct listing/script-ready only when a listing URL/template exists and browser-workflow-ready only when Browserbase/Chrome workflow access exists.
  - Miami-Dade Clerk records require commercial API access.
  - Vital/obituary, marriage, death, memorial, and deceased-indicator review require a browser/API workflow before facts can be filled automatically.
  - IDI Core supports a shared default key plus user override, but live backend runs still require the vendor endpoint and approval.
- Changed the operator-facing readiness blockers for Clerk and vital/obituary so they no longer expose raw env var names in Settings or Doc Prep readiness copy.
- Mirrored the same blocker copy in the worker export readiness seam so generated/exported readiness metadata matches the artifact app.
- Proof:
  - First attempted `pnpm --filter @ple/artifact test` from the git root and got the expected repo-root package-manifest failure; reran from the package root.
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `source_readiness_distinguishes_api_browser_and_blocked_modes`, `idi_core_shared_default_and_user_override_contract`, and `operator_visible_readiness_copy_has_no_raw_env_keys`.
  - `pnpm --dir probate-lead-engine test`: passed.
  - Local `AUTH_REQUIRED=false` route proof on `http://localhost:4185/api/connections/status` returned:
    - `Tax Collector Source`: `blocked`, `configuredMode: none`, with Browserbase/controlled Chrome required for public GovHub search;
    - `Miami-Dade Clerk API`: `blocked`, `configuredMode: none`, with Commercial Data Services access required;
    - `Vital/Obituary Workflow`: `blocked`, `configuredMode: none`, with browser/API workflow required;
    - `IDI Core`: `review`, `configuredMode: operator_portal`, `userOverrideAllowed: true`, `sharedDefaultConfigured: false`, and backend live run blocked by missing vendor endpoint.
  - Headless browser proof on `http://localhost:4185/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` clicked the real `Run Source Search` button and rendered 8 `[data-source-proof-row]` rows for Property Appraiser, Tax Collector, Official Records, Probate Court, Clerk/Vital sources, IDI, Skip Trace, and Source Governance.
  - Browser proof confirmed operator copy for the bottom-right receipt link, latest deed/Clerk access, approved IDI asset search, and manual/paid research policy; visible copy did not expose `IDI_CORE_API_KEY`, `MIAMI_DADE_CLERK_AUTH_KEY`, `OBITUARY_VITAL_WORKFLOW_URL`, or `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`.
  - Browser proof reported no console errors, no failed requests, and no stale `Live packet preview` copy.

## Twenty-Sixth Repair Pass: Settings Source Controls

- Confirmed and fixed a visible Settings gap: `Miami-Dade Clerk API` and `Vital/Obituary Workflow` existed in the API/readiness layer, but the global Settings connection list and admin blocker list did not show them.
- Added dedicated Settings integration cards for:
  - Tax Collector;
  - Clerk Records;
  - Vital Sources.
- Added `Miami-Dade Clerk API` and `Vital/Obituary Workflow` to Settings connection status rows and admin blocker coverage so source-readiness blockers are visible outside the Doc Prep rail.
- Extended the source-readiness contract test so it fails if Settings loses the Tax Collector, Clerk, or Vital source controls.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `settings_exposes_source_readiness_controls`.
  - `pnpm --dir probate-lead-engine test`: passed.
  - Headless browser proof on `http://localhost:4185/?view=settings&walkthrough=off` rendered `Tax Collector`, `Clerk Records`, `Vital Sources`, and the status rows `Tax Collector Source`, `Miami-Dade Clerk API`, and `Vital/Obituary Workflow`.
  - Browser proof found no raw env names, no console errors, and no failed requests.

## Twenty-Seventh Repair Pass: No Fake API Claim

- Removed the bad "Discovery source APIs ran" wording from the artifact serverless route, local artifact server, and worker source-run response.
- The source-run response now says `Discovery source checks ran` / `Discovery source checks returned`, because Tax Collector, vital/obituary, IDI, and governed research are not all API integrations.
- The fallback response now says `source-run worker` instead of `source API worker`.
- Added a source-run contract assertion that fails if the response message implies every Discovery source is an API.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed.
  - `pnpm --dir probate-lead-engine test`: passed.
  - Search proof found no remaining `Discovery source APIs`, `source APIs ran`, `source APIs returned`, or `source API worker` strings in active artifact/server/worker/test paths.
  - Restarted the local app on `localhost:4185`; route proof for `/api/discovery/external-source-run` returned message `Discovery source checks ran and returned review blockers...`, `hasBadApiClaim: false`, 8 source buckets, `readyForDiscoveryCompletion: false`, and `legalTemplateAutofillAllowed: false`.
  - Browser proof clicked `Run Source Search` after restart and saw the source-check message, no fake API claim, source proof copy still present, no console errors, and no failed requests.

## Twenty-Eighth Repair Pass: Source Proof Detail Checks

- Promoted the existing source-governance catalog into the source-run proof ledger as `detailChecks`.
- Each public source row can now expose its exact evidence checklist from the workflow packet; Tax Collector proof includes `bottom_right_receipt` as a blocking evidence step.
- The governed manual/paid research row now exposes concrete checklist items instead of a vague policy bucket:
  - IDI, Intelius, Ancestry, ForeWarn, and VitalChek;
  - voter records;
  - professional licenses;
  - business/address associations;
  - social profiles;
  - deceased-indicator cross-check;
  - private investigator request;
  - door knock / field visit;
  - neighbor research;
  - code enforcement call;
  - manual document request.
- Every detail check returns `legalTemplateAutofillAllowed: false`, so Closing Prep cannot treat these checklist rows as template-fill facts.
- Doc Prep renders the detail checks underneath each source proof row after `Run Source Search`, keeping the operator's source work visible in the rail.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed.
  - `pnpm --dir probate-lead-engine test`: passed and reported `source_proof_detail_checks` plus `governed_manual_and_paid_sources_visible`.
  - `git diff --check`: passed.
  - Local route proof on `http://localhost:4186/api/discovery/external-source-run` returned:
    - `sourceCount: 8`;
    - `taxDetailCount: 4`;
    - `hasBottomRightReceipt: true`;
    - `governanceDetailCount: 19`;
    - `requiredGovernanceVisible: true`;
    - `legalAutofillAllowedInDetails: false`.
  - Browser proof on `http://localhost:4186/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` clicked `Run Source Search`, rendered 33 `[data-source-proof-detail]` rows, and confirmed required detail rows for bottom-right receipt, voter records, professional licenses, business/address associations, social profiles, deceased-indicator cross-check, door knock, neighbor research, and code enforcement.
  - Browser proof found plain operator text for the required source steps, no raw env names, no fake API claim, no console errors, and no failed requests.

## Twenty-Ninth Repair Pass: IDI Guardrail Detail Checks

- Added explicit IDI Core guardrail detail checks to the `IDI Core Asset Search` source proof row:
  - confirm IDI access mode;
  - approve paid asset search;
  - confirm first-run lock / duplicate guard;
  - import approved report evidence when backend live access is not ready;
  - review IDI contact candidates before Discovery or Closing Prep can use them.
- Added explicit skip-trace detail checks to the `Skip trace/contact enrichment` source proof row:
  - confirm provider access and storage/source approval;
  - review skip-trace contacts before outreach or Discovery completion.
- The Doc Prep proof renderer now shows all detail checks for IDI, skip trace, and governed manual/paid research instead of clipping those rows.
- Every IDI and skip-trace detail check keeps `automationAllowed: false` and `legalTemplateAutofillAllowed: false`.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `idi_core_guardrail_detail_checks`.
  - `pnpm --dir probate-lead-engine test`: passed.
  - `git diff --check`: passed.
  - Local route proof on `http://localhost:4187/api/discovery/external-source-run` returned:
    - `idiProofState: evidence_required`;
    - `idiDetailCount: 5`;
    - `idiRequiredVisible: true`;
    - `skipTraceDetailCount: 2`;
    - `skipTraceRequiredVisible: true`;
    - `allIdiBlockedFromAutofill: true`.
  - IDI status proof on `http://localhost:4187/api/discovery/idi-core/status` still returned `configuredMode: operator_portal`, `endpointConfigured: false`, `sharedDefaultConfigured: false`, and `userOverrideAllowed: true`; no backend live IDI claim was made.
  - Browser proof on `http://localhost:4187/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` clicked `Run Source Search` and rendered IDI access mode, paid approval, first-run lock, report import, contact review, provider access, and skip-trace contact review in plain operator language.
  - Browser proof found no raw env names, no fake API claim, no console errors, and no failed requests.

## Thirtieth Repair Pass: Blocking Detail Checks Gate Readiness

- Fixed the source-run proof ledger so detail checks are not decorative.
- The proof ledger now exposes:
  - `detailCheckCount`;
  - `blockingDetailCheckCount`;
  - `unresolvedDetailCheckCount`.
- `readyForOperatorReview` now requires:
  - no blocked source rows;
  - no evidence-required source rows;
  - no unresolved blocking detail checks.
- Doc Prep now explains the unresolved checklist count in operator language: source checklist items still block Discovery from moving forward.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `blocking_detail_checks_gate_readiness`.
  - `pnpm --dir probate-lead-engine test`: passed.
  - `git diff --check`: passed.
  - Local route proof on `http://localhost:4188/api/discovery/external-source-run` returned:
    - `readyForOperatorReview: false`;
    - `readyForDiscoveryCompletion: false`;
    - `detailCheckCount: 40`;
    - `blockingDetailCheckCount: 18`;
    - `unresolvedDetailCheckCount: 18`;
    - `legalTemplateAutofillAllowed: false`.
  - Browser proof on `http://localhost:4188/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` clicked `Run Source Search` and showed the source-checklist blocker count in the Doc Prep rail.
  - Corrected DOM proof found 40 actual `[data-source-proof-detail]` rows and confirmed required rows for `bottom_right_receipt`, `idi_contact_review`, `skiptrace_contact_review`, and `voter_records`.
  - Browser proof found no raw env names, no fake API claim, no console errors, and no failed requests.

## Thirty-First Repair Pass: Captured Evidence Resolves Source Detail Rows

- Fixed the source-run proof ledger so operator-captured public-source facts are merged into the external-source run instead of living only in `/api/discovery/source-capture`.
- Added a source-fact-to-check satisfaction layer across the artifact route, Cloudflare worker route, and local dev server route.
- Captured evidence now resolves the specific checklist row to `evidence_returned_review_required` / visible `Evidence found` without marking Discovery complete or allowing legal-template autofill.
- Confirmed examples:
  - Tax Collector `tax_receipt_link` resolves `bottom_right_receipt`;
  - Tax Collector payer/date/amount/unpaid-year facts resolve `payer_review`;
  - Official Records deed facts resolve `latest_deed`;
  - probate docket facts resolve `case_lookup`;
  - obituary/vital facts resolve `vital_indicators`;
  - IDI contact review still remains manual until accepted contacts exist.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `captured_source_facts_reduce_detail_blockers`.
  - `pnpm --dir probate-lead-engine test`: passed.
  - `node -c probate-lead-engine/apps/artifact/server.js`: passed.
  - Local route proof on `http://localhost:4191/api/discovery/external-source-run` with captured tax/deed/probate/obituary evidence returned:
    - `detailCheckCount: 40`;
    - `blockingDetailCheckCount: 7`;
    - `unresolvedDetailCheckCount: 7`;
    - Tax Collector, Official Records, Probate Court, and Clerk/Vital source states as `facts_returned_review_required`;
    - IDI and skip trace as `evidence_required`;
    - governed manual/paid research as `blocked`;
    - `legalTemplateAutofillAllowed: false`.
  - Chrome DevTools proof clicked the real `Run Source Search` button on `http://localhost:4191/?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture`, rendered 8 source rows and 40 detail rows, showed `Evidence found` for `bottom_right_receipt`, `latest_deed`, `case_lookup`, and `vital_indicators`, and left `idi_contact_review` as `Manual`.
  - Browser proof found no console errors and no failed network requests.
  - Screenshot evidence: `docs/run-point-daily/2026-07-03-s29-source-detail-browser-proof.png`.

## Thirty-Second Repair Pass: Tax Collector Listing Detail Parser

- Added deterministic Tax Collector page-detail extraction for listing/receipt HTML or text.
- The parser now extracts:
  - bottom-right receipt link;
  - paid-by party;
  - paid date;
  - amount due as a USD amount object;
  - unpaid tax years;
  - reassessment/status note.
- Wired the parser through:
  - artifact serverless source-capture;
  - local artifact server source-capture;
  - Cloudflare worker source-capture;
  - worker Tax Collector acquisition facts from direct listing / Browserbase returns.
- Added the missing visible `Reassessment` field in Doc Prep public-record capture.
- Fixed the client fact picker so the UI prefers non-empty parsed facts over earlier placeholder/null facts from the dry pipeline.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `tax_collector_listing_detail_parser`.
  - `pnpm --dir probate-lead-engine test`: passed.
  - Local route proof on `http://localhost:4191/api/discovery/external-source-run` using only Tax Collector listing HTML returned:
    - receipt link `https://miamidade.county-taxes.test/receipt/2025-paid.pdf`;
    - paid by `Estate representative`;
    - paid date `03/14/2025`;
    - amount due `{ amount: 1234.56, currency: "USD", years: [2024, 2025] }`;
    - unpaid years `[2024, 2025]`;
    - reassessment `No reassessment change shown`;
    - `payer_review` and `bottom_right_receipt` as `evidence_returned_review_required`;
    - `legalTemplateAutofillAllowed: false`.
  - Chrome DevTools proof filled only Tax Collector listing URL plus listing HTML, clicked `Run Source Search`, and confirmed the visible fields populated with receipt link, paid by, paid date, amount due, unpaid years, and reassessment. The proof rendered 40 detail rows, showed `Evidence found`, kept the no-fake-API claim clean, and had no console or network failures.

## Thirty-Third Repair Pass: IDI Import Evidence In Source Run

- Wired approved IDI report import evidence into `/api/discovery/external-source-run` across:
  - artifact serverless route;
  - local artifact server;
  - Cloudflare worker route;
  - Doc Prep `Run Source Search` payload.
- Preserved `seed.confirmedSourceFacts` instead of dropping confirmed source facts at the source-run boundary.
- Extended IDI import fact building so supplied IDI candidates and contact-review state can be carried through the source-run proof.
- Corrected the IDI detail resolver:
  - imported report evidence resolves `idi_report_import`;
  - imported contacts do **not** resolve `idi_contact_review` until accepted or promoted;
  - imported reports do **not** resolve `idi_paid_run_approval` unless a live approved run or approval record is present;
  - legal-template autofill remains false in every IDI state.
- Removed the legacy proof seed's pre-accepted IDI contact. Any seeded IDI contact now starts as imported/review-gated.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `idi_import_and_contact_review_split`.
  - Route proof on `http://localhost:4192/api/discovery/external-source-run` returned:
    - imported-only: `idi_report_import = evidence_returned_review_required`, `idi_contact_review = manual_review_required`, `idi_paid_run_approval = approval_required`, `legalTemplateAutofillAllowed = false`;
    - accepted-contact: `idi_contact_review = evidence_returned_review_required` while `idi_paid_run_approval` stayed `approval_required`;
    - live-approved payload: `idi_paid_run_approval = evidence_returned_review_required`.
  - Clean Chrome DevTools proof on `localhost:4192` imported an IDI report, clicked `Run Source Search`, saw contact review stay `Manual`, then accepted the contact and saw only contact review change to `Evidence found`. Paid-run approval stayed `Approval`, no fake API claim appeared, no raw env names were visible, and console/network failures were empty.
  - Screenshot evidence: `docs/run-point-daily/2026-07-03-s29-idi-source-run-browser-proof.png`.

## Thirty-Fourth Repair Pass: Clerk Commercial API Route Mapping Proof

- Added a route-level source-run contract for the configured Miami-Dade Clerk Commercial Data Services path.
- The test configures a mocked Clerk AuthKey/API base and verifies `/api/discovery/external-source-run` maps mocked Clerk responses into source-run facts instead of only testing adapter code in isolation.
- Proved:
  - Official Records API facts return `latest_deed` with book/page, recorded date, parties, and case link data;
  - Civil/Family/Probate API facts return case status, docket refs, affidavit-of-heirs signal, and document availability;
  - Official Records and probate/court proof rows become `facts_returned_review_required`;
  - `latest_deed` and `case_lookup` detail checks resolve to `Evidence found`;
  - the Clerk AuthKey is redacted from stored source URLs.
- Proof:
  - `pnpm --dir probate-lead-engine --filter @ple/artifact test`: passed and reported `clerk_commercial_api_route_fact_mapping`.

## Next Work

- Deploy/configure the real Browserbase Functions for Tax Collector and vital/obituary, then run against the real public sites rather than the mocked Browserbase API.
- If browser observation exposes stable API calls behind GovHub, move them into the deterministic script client.
- Configure/prove `MIAMI_DADE_CLERK_AUTH_KEY` in the target environment, then run a paid controlled Official Records and Civil/Family/Probate API proof with readback.
- Configure/prove `IDI_CORE_API_URL`, the shared default `IDI_CORE_API_KEY`, and explicit live-run approval or keep IDI in operator-import mode.
- Rerun S30 demos against the corrected S29 source contracts before treating S30 as final client acceptance proof.
- Continue source-backed treatment for marriage/death, offender/professional-license, voter/license, field/neighbor/code-enforcement, and paid/manual research tasks as explicitly human-required or approval-gated.
