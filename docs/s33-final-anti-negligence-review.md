# S33 Final Anti-Negligence Review

Date: 2026-07-04

Reviewer posture: assume every claim is false until proven by route output, browser behavior, generated artifacts, or deployment-provider state.

## Verdict

S33 code and local deployment-equivalent proof pass the production-source cleanup bar for:

- autonomous Tax Collector receipt capture from estate facts,
- Tax Collector receipt merge into Discovery source facts,
- shared-backend IDI token support plus personal user override,
- IDI duplicate paid-run guard,
- IDI provider evidence redaction,
- single PDF artifacts for single and batch Discovery / Closing exports,
- visible browser behavior for Doc Prep, Settings, Queue, and every export option.

One deployment-provider fact does not pass: the real private IDI Core token and endpoint are not installed in the checked Vercel or Cloudflare Worker environments. Do not tell the client live production IDI is configured until `IDI_CORE_API_URL` and `IDI_CORE_API_TOKEN` are installed as secrets and a live paid run is approved.

## Evidence Reviewed

- Contract tests: `pnpm --dir probate-lead-engine --filter @ple/artifact test`
- Worker build: `pnpm --dir probate-lead-engine --filter @ple/worker build`
- Clean artifact build: `rm -rf probate-lead-engine/apps/artifact/dist && pnpm --dir probate-lead-engine --filter @ple/artifact build`
- Route proof: `docs/evidence/s33-route-proof.json`
- Browser proof: `docs/evidence/s33-browser-proof.json`
- PDF files:
  - `docs/evidence/s33-discovery-single.pdf`
  - `docs/evidence/s33-closing-single.pdf`
  - `docs/evidence/s33-discovery-batch.pdf`
  - `docs/evidence/s33-closing-batch.pdf`
- Browser screenshots:
  - `docs/evidence/s33-docprep-tax-receipt.png`
  - `docs/evidence/s33-settings-idi-ready.png`
  - `docs/evidence/s33-queue-proof.png`
  - `docs/evidence/s33-export-buttons-proof.png`
  - `docs/evidence/s33-mobile-docprep-proof.png`

## Claims Checked

| Claim | Result | Evidence |
|---|---:|---|
| Tax Collector receipt capture starts from estate facts, not a supplied listing link. | Pass | `s33-route-proof.json` shows `tax_collector_receipt_run_started_from_estate_facts` and receipt mode `listing_page_bottom_right`. |
| External Source Run merges Tax Collector receipt facts into Discovery. | Pass | `s33-route-proof.json` includes tax collector `sourceFacts` for receipt link, paid by, paid date, amount due, unpaid years, and reassessment. |
| Shared backend IDI token is supported by the app. | Pass | Route proof returned `apiKeySource: shared_default`, `paidRun: true`, `readbackStatus: route_readback_confirmed`. |
| Personal user IDI key remains supported. | Pass | Contract test `idi_core_shared_default_and_user_override_contract`. |
| IDI duplicate paid runs are blocked. | Pass | Route proof duplicate call returned `409 duplicate_idi_asset_search`. |
| IDI secrets do not leak in responses. | Pass | Contract and route proof verify token/provider auth markers are redacted. |
| Single export creates one PDF artifact. | Pass | Discovery and Closing single exports returned `kind: single_pdf`, `contentType: application/pdf`, and fetched `%PDF` bytes. |
| Batch export creates one PDF artifact, not a folder. | Pass | Discovery and Closing batch exports returned one `single_pdf` artifact each and fetched `%PDF` bytes. |
| Export buttons are not dangling. | Pass | Browser proof clicked Add to Queue, Google Workspace, Podio, Podio readiness check, and Google + Podio. Each produced visible status matching its label. |
| Export menu is usable above PDF previews. | Pass after fix | Browser proof found iframe pointer interception; fixed topbar/export stacking and iframe pointer capture while menu is open. Rerun passed. |
| Preview header copy is no longer `Live packet preview`. | Pass | Browser proof checks no `Live packet preview` copy and Preview labels exist. |
| Live deployment has real shared IDI Core secret installed. | Fail | `vercel env ls` and `wrangler secret list` do not list IDI Core endpoint/token names. |

## Required Before Calling Live IDI Production-Ready

Install the real private provider values in the active deployment target:

- `IDI_CORE_API_URL`
- `IDI_CORE_API_TOKEN`
- `IDI_CORE_LIVE_RUN_APPROVED=true` only for the controlled proof window

Then rerun:

- `/api/connections/status`
- `/api/discovery/idi-asset-search/import` with `runMode: live_idi_core`
- duplicate paid-run guard
- response redaction scan

## TP Acceptance Checklist

- Open Doc Prep.
- Click `Run Source Search`.
- Confirm Tax Collector receipt link, paid by, paid date, amount due, unpaid years, and reassessment are filled.
- Open Settings.
- Confirm IDI Core says team default is available when the deployment secret is installed, and personal key input remains optional.
- Open Queue.
- Confirm batch export surface is clear.
- Open Prep Export.
- Click Add to Queue, Google Workspace, Podio, Podio readiness check, and Google + Podio.
- Confirm each option changes visible status and no option is blocked by the PDF preview.
- Open generated PDFs from `docs/evidence`.
- Reject any claim that live IDI is configured until the private token is present in the deployment provider and a controlled live proof passes.
