# Sprint Brief: S33 -- Production Source Cleanup (single-agent)

## Intent

Make the remaining pre-release blockers production-proof before the final shipment sprint. A real estate operator should be able to start from an estate/property record and have HeirRight retrieve the Tax Collector receipt, run shared backend IDI Core securely, preserve source evidence, generate Discovery and Closing Prep packets, and show exact blockers only when a real source cannot be reached.

## Branch Target

`v1.1.1/heirright-2026-06-30-s28-production-loop`

## Scope -- Included

- [ ] Replace the Tax Collector manual-listing standard with full public search-to-receipt automation.
- [ ] Use prior Discovery facts as input: county, folio/parcel, property address, owner/estate name, and Property Appraiser results.
- [ ] Search the Tax Collector site automatically, select the matching listing, extract the bottom-right receipt link, open/download the receipt, and persist receipt URL/PDF, payer, paid date, amount due, unpaid years, reassessment, source page, timestamp, and screenshot/evidence.
- [ ] Keep manual Tax Collector listing URL/HTML paste as fallback only, not the primary path or acceptance proof.
- [ ] Configure shared backend IDI Core access as a private server-side token for all users.
- [ ] Preserve optional personal IDI key override without exposing either key to browser code, logs, screenshots, route responses, local storage, PDFs, or docs.
- [ ] Run one controlled live backend IDI proof with paid-run approval, duplicate guard, lock key, readback status, source evidence, and imported contact candidates.
- [ ] Keep IDI contacts blocked from Discovery/Closing use until reviewed.
- [ ] Close remaining external-source proof gaps for Clerk/Official Records and vital/obituary workflows with either live evidence or exact visible blockers.
- [ ] Prove Closing Prep fills real legal-template blanks only and does not mutate template language.
- [ ] Re-run the full product loop and update the S32 readiness docs into S33 proof artifacts.

## Scope -- Excluded (OUT OF BOUNDS)

- Do not expose raw API keys, tokens, credentials, or private company account details in the client app or evidence artifacts.
- Do not treat IDI, Intelius, Ancestry, voter, social, professional-license, or skip-trace sources as automatically approved for unrestricted use.
- Do not send outreach, SMS, email, offers, or legal/probate language externally.
- Do not modify legal template language. Only fill approved blanks from reviewed source fields.
- Do not claim production readiness from mock HTML, pasted listing pages, localhost-only proof, or a browser screenshot without route/PDF/readback evidence.

## Known Issues to Preserve

- S32 correctly rejected production shipment at 74/100 because live IDI API, real Tax Collector search-to-receipt, Clerk/vital automation, Google/Podio readback, production OAuth, and legal-template immutability were not proven.
- Existing Doc Prep Preview, Help & Demos, Batch Queue single-PDF copy, Outreach no-send guard, Settings source controls, and auth gate behavior should be preserved.
- Existing manual source-capture fields should remain as operator fallback and audit override paths, but they cannot satisfy the main Tax Collector production acceptance path.
- Existing unrelated `site-v2` dirty work must not be touched.

## Design Pass

### Layout / Interaction

Use the existing Document Prep, Settings, and source-capture surfaces. Do not add a new app area unless the existing surfaces cannot hold the workflow.

Tax Collector UX:
- In Doc Prep, the Tax Receipt phase should show `Search Tax Collector`, `Receipt found`, `Needs review`, or `Blocked`.
- The primary button starts from the estate facts already in the Discovery File.
- If the app finds multiple possible listings, show a plain-language match review: address, folio, owner, tax account, and why it matched.
- If the app reaches the listing page, show the receipt link, payer, paid date, amount due, unpaid years, reassessment, and source evidence.
- If blocked, show the exact reason: no match, site unavailable, CAPTCHA, missing folio/address, receipt link not present, or receipt page failed.
- The fallback manual listing/HTML controls should be visually secondary and labeled as fallback review.

IDI UX:
- Settings should show `Team IDI access ready`, `Personal key in use`, or `IDI blocked`.
- Discovery should show whether the run used shared team access or a user override, without revealing the key.
- Paid duplicate runs must show a lock message and require an admin override reason.

Closing Prep UX:
- Closing Preview should show template family, required blanks, filled values, source field, and blocker.
- Operator copy must say “fill blanks only” and “template wording unchanged.”

### API / Service Shape

Add or upgrade service modules before route handlers:

- `taxCollectorSearchService`
  - Input: `estateId`, `county`, `folio`, `propertyAddress`, `ownerName`, optional `propertyAppraiserEvidence`.
  - Output: `mode`, `searchInput`, `matchedListing`, `receipt`, `sourceEvidence`, `blockers`, `reviewRequired`.
  - Primary path: folio search. Secondary path: address search. Owner name is tie-break evidence only.
  - Use a direct script/HTTP parser where the public page is stable.
  - Use Browserbase or controlled Chrome workflow when search requires session, JavaScript, GovHub navigation, or anti-bot handling.
  - Never require the user to supply the final listing URL for the happy path.

- `idiCoreService`
  - Input: estate/property search target, approval record, optional user override key.
  - Token priority: user override only for that user-approved run; otherwise shared backend token.
  - Output must expose only `mode`, `apiKeySource`, `paidRun`, `lockKey`, `readbackStatus`, `sourceEvidence`, and review candidates.
  - Output must never expose token values.

Routes:
- `POST /api/discovery/tax-collector/receipt-run`
- `POST /api/discovery/idi-asset-search/import` upgraded for live shared-token proof.
- `POST /api/discovery/external-source-run` should call the Tax Collector receipt run when Tax Collector facts are missing and enough property facts exist.
- Existing `/api/discovery/source-capture` remains fallback capture.

Fallback behavior:
- Missing Tax Collector workflow config returns an operator blocker, not a fake source fact.
- Missing IDI token or endpoint returns `blocked`, not `operator_import` success.
- Site/CAPTCHA failures persist a blocker with evidence of attempted source, timestamp, and search inputs.

### Data / Agent Shape

Persist source evidence as estate-scoped Discovery facts:
- `tax_collector_search_attempt`
- `tax_collector_listing_match`
- `tax_receipt_link`
- `tax_receipt_attachment`
- `tax_last_paid_by`
- `tax_paid_date`
- `tax_amount_due`
- `unpaid_tax_years`
- `tax_reassessment_signal`
- `idi_asset_search_status`
- `idi_asset_report_attachment`
- `primary_contact_profile`
- `alternative_contact_profile`

The app may assist with matching and extraction, but source truth comes from public records, IDI response/readback, or reviewed operator evidence. Agentic fill is not allowed as legal-template source truth.

### Security Rules

- Store shared IDI access only as a backend secret/token: local `.env.local` for dev, deployment secret store for production.
- Do not commit `.env.local`, screenshots containing secrets, route responses containing keys, or docs containing private token values.
- Redact provider responses before logging or saving evidence.
- Add tests that fail if token-like values appear in route responses or generated evidence.

### Aesthetic Rules

- Use existing HeirRight operator surfaces and language.
- No developer-facing labels on client surfaces: avoid JSON, payload, adapter, endpoint, schema, CLI, or test.
- Use property, owner, folio, deed, OR book/page, taxes, receipt, payer, probate, heirs, review, move on.
- New popups, rails, drawers, modals, sheets, and panels must include enter/exit transitions.
- Keep the Doc Prep Preview rail contained; no bleed outside the preview container.

## Development Flow

1. **Source audit first**
   - Re-read S32 docs and the HeirRight deal-flow checklist.
   - Trace current Tax Collector, IDI, source-run, Doc Prep, PDF/export, and Settings code paths.
   - Confirm exact deployment/runtime target for secrets before touching IDI code.

2. **Tax Collector service**
   - Build a county-specific Tax Collector receipt service for Miami-Dade first.
   - Start from folio, address, owner, and Property Appraiser facts.
   - Implement direct search/listing parsing where possible.
   - Add Browserbase/controlled Chrome fallback when public search cannot be completed by direct script.
   - Parse bottom-right receipt link from the reached listing page.
   - Open/download receipt and extract payer/date/amount/unpaid/reassessment where available.
   - Persist search attempt, listing match, receipt evidence, and blockers.

3. **Tax Collector route integration**
   - Add `POST /api/discovery/tax-collector/receipt-run`.
   - Wire `/api/discovery/external-source-run` so it attempts Tax Collector receipt retrieval from prior Discovery facts.
   - Keep manual listing URL/HTML as fallback only.
   - Update Settings and Doc Prep copy to make the automated path primary.

4. **Shared IDI Core backend access**
   - Add secure server-side token handling for shared company IDI access.
   - Confirm deployment secret name and local dev secret name.
   - Ensure `apiKeySource` reports `shared_default`, `user_override`, or `missing`.
   - Add redaction tests for all IDI routes and evidence.
   - Run one controlled live IDI proof only when approval flag and token are present.

5. **External source completion gates**
   - Clerk/Official Records: prove deed, OR book/page, ownership activity, adverse possession, probate/civil/family records, affidavits, OR cross-link, or show exact blocker.
   - Vital/obituary: prove obituary, Findagrave/Legacy, marriage/death indicators, DOB/DOD, or show exact blocker.
   - Preserve all source references and review flags in the Discovery File.

6. **Closing template proof**
   - Inventory real legal templates used by the company.
   - Build fixture-based fill-only tests.
   - Compare before/after template text and fail if non-blank legal wording changes.
   - Block export when required fields are missing, uncertain, or unsupported by Discovery evidence.

7. **Frontend operator review**
   - Update Doc Prep, Settings, Help & Demos, and Queue copy only where needed.
   - Ensure Tax Collector “search to receipt” is primary and manual paste is fallback.
   - Ensure IDI shared access status is visible without secrets.

8. **Validation and proof**
   - Unit tests for Tax Collector search/match/parser, IDI token redaction, duplicate guard, source fact persistence, Closing fill-only template diff.
   - Route proof for Tax Collector from estate facts to receipt evidence.
   - Controlled live IDI route proof with shared backend token.
   - Browser proof for Doc Prep Tax Receipt phase, Settings IDI status, error states, mobile layout.
   - PDF proof for Discovery and Closing Prep after new source evidence.
   - Final `/solvys-heir-audit`.

9. **Docs and final readiness update**
   - Write S33 progress, evidence summary, anti-negligence review, and updated score.
   - Update S32 blockers to resolved/blocker-current status.
   - Commit only S33 source, tests, docs, and evidence. Do not stage unrelated `site-v2` changes.

## Acceptance Criteria

- [ ] Starting from estate facts only, Tax Collector search reaches the correct listing page and captures the bottom-right receipt link.
- [ ] Receipt evidence includes payer, paid date, amount due, unpaid years, reassessment status when available, source page, timestamp, and receipt artifact/link.
- [ ] Manual Tax Collector listing URL/HTML is fallback only and cannot be used as the primary production proof.
- [ ] Shared backend IDI token is configured as a private backend/deployment secret and works for all users.
- [ ] Optional personal IDI key override still works without overriding the shared default for other users.
- [ ] No IDI token or private provider credential appears in browser code, route responses, logs, screenshots, generated PDFs, or docs.
- [ ] One controlled live IDI run proves `paidRun`, `lockKey`, duplicate guard, readback, and source evidence.
- [ ] IDI contacts remain review-gated before Discovery/Closing use.
- [ ] Clerk/Official Records and vital/obituary sources either return live evidence or show exact blockers.
- [ ] Closing templates are proven fill-only against real template fixtures.
- [ ] Batch Queue still exports one combined PDF per selected flow.
- [ ] Doc Prep Preview remains contained and section navigation still works.
- [ ] Deployed or deployment-equivalent proof covers auth, source routes, PDFs, and browser behavior.
- [ ] Final S33 anti-negligence review rejects any claim without route output, browser proof, PDF inspection, live readback, or exact blocker.

## Validation Commands

```bash
# Artifact app test suite
pnpm --dir probate-lead-engine --filter @ple/artifact test

# Worker build
pnpm --dir probate-lead-engine --filter @ple/worker build

# Clean artifact build
rm -rf probate-lead-engine/apps/artifact/dist
pnpm --dir probate-lead-engine --filter @ple/artifact build

# Route proof examples
curl -s http://localhost:4201/api/discovery/tax-collector/receipt-run \
  -H 'content-type: application/json' \
  --data '{"county":"miami-dade","folio":"<approved-test-folio>","propertyAddress":"<approved-test-address>"}'

curl -s http://localhost:4201/api/discovery/idi-core/status
```

## Evidence To Produce

- `docs/evidence/s33-tax-collector-receipt-run.json`
- `docs/evidence/s33-tax-collector-receipt.pdf` or source receipt link evidence
- `docs/evidence/s33-idi-live-shared-token-proof.json`
- `docs/evidence/s33-token-redaction-proof.json`
- `docs/evidence/s33-discovery-prep.pdf`
- `docs/evidence/s33-closing-prep.pdf`
- `docs/evidence/s33-browser-proof.json`
- `docs/evidence/s33-docprep-tax-receipt.png`
- `docs/evidence/s33-settings-idi-ready.png`
- `docs/s33-progress.md`
- `docs/s33-final-anti-negligence-review.md`
- `docs/s33-readiness-update.md`
- `docs/s33-solvys-heir-audit.md`

## Commit Format

```text
feat: complete s33 production source cleanup
```

## Solvys Heir Audit Gate

```text
/solvys-heir-audit
Source checked: HeirRight deal-flow checklist, S32 objective matrix, S32 final readiness report
Backward: S32 proved local surfaces but left Tax Collector search-to-receipt and shared backend IDI incomplete.
UX pass: aligned with gaps
Forward: S33 must complete production source automation, secure IDI, live/readback proof, and legal-template immutability before final sprint.
Alignment: blocked until S33 is executed
Required corrections before complete:
- Tax Collector auto-search from estate facts, not manual listing paste.
- Shared IDI backend token configured and proven without leaking secrets.
- External source evidence or exact blockers for Clerk/vital paths.
- Closing templates proven fill-only.
```

