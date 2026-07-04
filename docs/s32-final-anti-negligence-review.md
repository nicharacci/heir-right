# S32 Final Anti-Negligence Review

Reviewer stance: assume every claim is false until route output, browser behavior, PDF bytes, or explicit blocker proves it.

## Findings

1. Backend live IDI Core is not configured.
   - Evidence: `docs/evidence/s32-route-pdf-proof.json` reports `endpointConfigured: false`, `sharedDefaultConfigured: false`, and personal override blocks on missing endpoint.
   - Impact: Do not claim same shared IDI Core API key is available for all users. Today the app supports operator portal import and distinguishes a user override key, but cannot run live backend IDI Core.

2. External Discovery sources are not all real APIs yet.
   - Evidence: the source-run route accounts for eight required buckets, but Settings and source proof keep Tax Collector public search, Clerk records, vital/obituary workflows, skip trace, and governed sources blocked or review-gated.
   - Impact: The app has source contracts and capture APIs. It does not yet fully automate every public/county/manual workflow end to end.

3. Tax Collector receipt extraction is real only after listing-page evidence is supplied.
   - Evidence: `tax_receipt_link`, `tax_receipt_attachment`, receipt URL, and payer are captured from listing HTML in `s32-route-pdf-proof.json`.
   - Impact: The specific bottom-right receipt fix is covered. The browser/script workflow that searches the public site and lands on that listing page still needs production proof.

4. Closing legal-template immutability is not fully proven.
   - Evidence: Closing Prep stream/blocker UI and single-PDF export are proven, but no S32 test compares generated output against real client legal templates.
   - Impact: Keep legal-template readiness blocked until fixture-based fill-only tests prove no template language mutation.

5. Batch Queue route behavior was correct, but UI copy was not explicit enough.
   - Evidence: route proof already returned `single_pdf`; browser proof initially found Queue copy did not say single/combined PDF.
   - Fix: patched Queue heading/copy in `probate-lead-engine/apps/artifact/src/index.html`, rebuilt, and reran browser proof. `s32-queue-proof.png` now shows `Batch Queue export prep` and `one combined PDF per selected flow`.

6. Auth is locally proven but production OAuth is not.
   - Evidence: `s32-auth-domain-proof.json`, `s32-auth-gate.png`, and `s32-avatar-menu.png`.
   - Impact: Allowed-domain gate, Google-only redirect, and avatar menu work locally. Production needs deployed Google OAuth client/redirect proof.

7. Outreach is safe but not live-production connected.
   - Evidence: `s32-outreach-proof.png` and `/api/outreach/sync` no-direct-send guard in `s32-route-pdf-proof.json`.
   - Impact: Good for review/staging. Live Podio/readback and ActivePieces handoff remain blocked.

## Proof Summary

- Route/PDF proof: `docs/evidence/s32-route-pdf-proof.json`
- Auth/domain route proof: `docs/evidence/s32-auth-domain-proof.json`
- Browser proof: `docs/evidence/s32-browser-proof.json`
- PDF artifacts: `docs/evidence/s32-discovery-prep.pdf`, `docs/evidence/s32-closing-prep.pdf`, `docs/evidence/s32-batch-discovery-prep.pdf`, `docs/evidence/s32-batch-closing-prep.pdf`, `docs/evidence/s32-direct-report.pdf`
- Screenshots: `docs/evidence/s32-help-demos.png`, `docs/evidence/s32-docprep-proof.png`, `docs/evidence/s32-queue-proof.png`, `docs/evidence/s32-settings-proof.png`, `docs/evidence/s32-outreach-proof.png`, `docs/evidence/s32-mobile-proof.png`, `docs/evidence/s32-auth-gate.png`, `docs/evidence/s32-avatar-menu.png`

## Decision

Reject production shipment for a team of 10 today.

Accept internal review/demo readiness for the locally proven flows, with explicit blockers for live IDI API, live public-source automation, live Clerk/vital workflows, real Google/Podio readback, and legal-template immutability proof.

