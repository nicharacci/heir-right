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

## Next Work

- Add live source-run client for the actual Tax Collector search/listing endpoint once endpoint discovery is captured from the browser workflow.
- Prefer a deterministic script/API client for Tax Collector search/listing extraction first. Use Browserbase only if the public site requires browser session state, JS navigation, or endpoint discovery that cannot be captured safely by a script.
- Rerun S30 demos against the corrected S29 source contracts before treating S30 as final client acceptance proof.
- Continue source-backed treatment for marriage/death, offender/professional-license, voter/license, field/neighbor/code-enforcement, and paid/manual research tasks as explicitly human-required or approval-gated.
