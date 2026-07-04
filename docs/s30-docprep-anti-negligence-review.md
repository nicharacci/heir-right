# S30 Doc Prep Anti-Negligence Review

Date: 2026-07-03

## Scope
- Sprint: S30 End-to-End Demos, Streaming Preview, Help & Demos.
- Surface reviewed: `probate-lead-engine/apps/artifact/src/index.html`, rebuilt `probate-lead-engine/apps/artifact/dist/index.html`, local app at `http://localhost:4194`.
- Evidence reviewed:
  - `docs/evidence/s30-docprep-stream-proof-rerun.json`
  - `docs/evidence/s30-docprep-stream-desktop-rerun.png`
  - `docs/evidence/s30-docprep-stream-mobile-rerun.png`
  - `docs/evidence/s30-discovery-stream-proof-rerun.json`
  - `docs/evidence/s30-discovery-stream-desktop-rerun.png`
  - `docs/evidence/s30-discovery-stream-mobile-rerun.png`
  - `docs/evidence/s30-docprep-stream-proof.json`

## Hostile Findings
1. The completed-packet rerun path was incomplete.
   - Failure: `Run again` opened a correction note, but there was no user-facing action to run the corrected packet afterward.
   - Correction: Added `Run corrected packet`.
   - Proof: Discovery and Closing browser reruns used `Run again` -> correction note -> `Run corrected packet` and reached completed streamed previews.

2. Source edits were not enough.
   - Failure: the local dev server was serving `dist/index.html`, so source-only changes did not appear in Chrome.
   - Correction: rebuilt the artifact bundle after edits with `pnpm --filter @ple/artifact build`.
   - Proof: rebuilt dist includes `data-docprep-rerun-run`, and browser proof saw the new action.

3. The Preview container previously did not contain the preview.
   - Failure: the stream card could compute as a 26px-tall container while the document pane rendered far beyond it.
   - Correction: the stream card now reserves a real preview height, constrains the document pane, and hides overflow.
   - Proof: desktop and mobile DOM metrics show the document bottom inside the panel bottom with no horizontal overflow.

4. Closing did not carry the exact Tax Collector instruction forward.
   - Failure: Closing showed a generic `Tax receipt` line instead of the workflow-specific `Bottom-right receipt link`.
   - Correction: Title Clearance and Closing Package now label the value as `Bottom-right receipt link`.
   - Proof: Closing rerun proof requires and passes the bottom-right receipt link check.

5. Discovery needed post-S29 source-contract proof.
   - Failure risk: older S30 proof predated the corrected Tax Collector receipt and public-record source evidence contract.
   - Correction: reran Discovery after the S29 correction.
   - Proof: Discovery Preview shows Tax Collector listing page, bottom-right receipt link, receipt proof, deed/title proof, court/probate proof, obituary/vital proof, IDI gate, accepted contacts, and one combined Discovery Prep PDF target.

## What Passed
- Help & Demos exists in the sidebar and previously launched the Discovery walkthrough into Document Prep.
- The rail header says `Preview`; `Live packet preview` is gone.
- Discovery streams 7/7 sections on desktop and mobile after a completed-packet rerun.
- Closing streams 5/5 sections on desktop and mobile after a completed-packet rerun.
- Option+Down and Option+Up cycle sections in Chrome without fallback for both flows.
- No visible fake-file, placeholder-only, or lorem ipsum wording appeared in the rerun proof.
- Closing Preview states legal template language remains unchanged.

## Remaining Non-S30 Risks
- This review proves the local rebuilt app surface. It does not prove production provider availability.
- The Discovery proof uses the saved local source facts and IDI operator-import gate. S29/S32 remain responsible for live external-provider/readback proof when credentials and provider routes are available.
- If a real public-record website blocks browser automation, the product must keep showing the saved blocker note in Preview rather than presenting blanks as facts.

## Verdict
Aligned with gaps outside S30.

S30's UI/demo/streaming obligations are proven on the local product surface. The remaining risks belong to deployment/live-provider readiness, not to the S30 streaming Preview mechanics.
