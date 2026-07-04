# S32 Final Anti-Negligence Review

Reviewer stance: assume every claim is false until route output, browser behavior, PDF bytes, deployment-provider state, or explicit blocker proves it.

## Findings

1. Live deployment IDI Core is not configured.
   - Evidence: S33 route proof proves the code path with `apiKeySource: shared_default`; Vercel and Cloudflare Worker secret-name checks do not list `IDI_CORE_API_URL`, `IDI_CORE_API_TOKEN`, `HEIRRIGHT_IDI_CORE_API_TOKEN`, or `IDI_CORE_API_KEY`.
   - Impact: The app can use a shared backend IDI token, but live production cannot run the real vendor path until TP installs the private endpoint/token.

2. Tax Collector automation is fixed at the app-contract level, not live-public-site proven.
   - Evidence: `docs/evidence/s33-route-proof.json` starts from estate facts, invokes the browser-workflow interface, captures the bottom-right receipt link, and populates payer/date/amount/unpaid years/reassessment. Direct curl to the Miami-Dade public site is Cloudflare-challenged, so the production path should be Browserbase/controlled browser, not plain server-side curl.
   - Impact: The app no longer requires the user to supply the listing link first. The deployment still needs the real Browserbase/function secret installed and tested against the county site.

3. Export buttons were not production-grade until S33 browser proof found a real layering bug.
   - Evidence: Browser proof initially hit PDF iframe pointer interception on lower export options. The topbar/export-menu stacking and iframe pointer capture were patched in `probate-lead-engine/apps/artifact/src/index.html`.
   - Impact: Fixed and rerun. `docs/evidence/s33-browser-proof.json` now proves Add to Queue, Google Workspace, Podio, Podio readiness check, and Google + Podio all change visible state.

4. Batch and single exports are proven as PDFs.
   - Evidence: `docs/evidence/s33-discovery-single.pdf`, `docs/evidence/s33-closing-single.pdf`, `docs/evidence/s33-discovery-batch.pdf`, and `docs/evidence/s33-closing-batch.pdf` all fetched as `%PDF` artifacts and rendered PNG previews.
   - Impact: This gate passes: export is one PDF artifact per selected flow, not a folder.

5. Closing legal-template immutability is still not proven.
   - Evidence: S33 proves Closing PDF artifact generation, but there is no fixture diff against the real client legal templates.
   - Impact: Do not claim legal-document production readiness until approved template fixtures prove blank-fill only.

6. Clerk/vital/obituary workflows remain provider/deployment blockers.
   - Evidence: Source readiness contracts expose exact blockers; S33 did not install Clerk Commercial Data Services or vital/obituary Browserbase/API credentials.
   - Impact: Source facts can be captured and normalized, but those workflows are not fully autonomous in live production yet.

7. Google/Podio live write/readback and production OAuth remain deployment blockers.
   - Evidence: S33 browser proof verifies export buttons and prep statuses; prior S32 local auth proof verifies the gate. No live deployed OAuth/readback proof was added.
   - Impact: Safe for prep/review. Not shippable to a team of 10 until deployed auth and readback are proven.

## Proof Summary

- S33 route proof: `docs/evidence/s33-route-proof.json`
- S33 browser proof: `docs/evidence/s33-browser-proof.json`
- S33 anti-negligence review: `docs/s33-final-anti-negligence-review.md`
- S33 progress: `docs/s33-progress.md`
- S33 PDFs:
  - `docs/evidence/s33-discovery-single.pdf`
  - `docs/evidence/s33-closing-single.pdf`
  - `docs/evidence/s33-discovery-batch.pdf`
  - `docs/evidence/s33-closing-batch.pdf`
- S33 screenshots:
  - `docs/evidence/s33-docprep-tax-receipt.png`
  - `docs/evidence/s33-settings-idi-ready.png`
  - `docs/evidence/s33-queue-proof.png`
  - `docs/evidence/s33-export-buttons-proof.png`
  - `docs/evidence/s33-mobile-docprep-proof.png`

## Decision

Reject production shipment for a team of 10 today.

Accept internal stakeholder demo/review of the locally proven product loop. The current remaining work is not UI polish; it is deployment/provider proof and legal-template fixture proof.
