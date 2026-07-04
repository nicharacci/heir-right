# S30 Progress

## Goal
Make Doc Prep visibly stream real Discovery and Closing Prep packet sections, add section navigation with Option+Up/Down, add a Help & Demos sidebar workspace, verify the real browser surface, run a hostile review pass, and commit only after proof.

## Acceptance Bar
- Discovery and Closing Prep show sectioned artifact progress in the Doc Prep rail while the real run loop executes.
- Rail sections can be jumped by controls and cycled with Option+Up / Option+Down.
- Help & Demos has concise walkthrough cards that launch guided flows from the sidebar.
- No user-facing fake-file or placeholder copy remains in the S30 surfaces.
- Browser proof covers desktop and mobile, with clean console/network checks.
- Final review compares S30 output against the S29-S32 plan before commit.

## Work Log
- Started from committed S29 baseline `e174a14` on July 3, 2026.
- Baseline browser check confirmed Document Prep renders and Help & Demos is not present yet.
- Added Doc Prep stream state, rail artifact preview, section chips, Option+Up/Down cycling, and a Help & Demos sidebar workspace with named walkthrough cards.
- Removed user-facing S30 copy that described outputs with non-production wording.
- Rechecked S30 after the S29 source-contract correction for Tax Collector receipt capture, public-record proof fields, and IDI/shared-key behavior.
- Fixed the completed-packet rerun path: `Run again` now opens a correction note and exposes `Run corrected packet`, which starts a new streamed Preview instead of ending at a manual-note dead end.
- Tightened the Closing stream so the Tax Collector evidence is labeled exactly as `Bottom-right receipt link`, carrying the listing-page receipt proof forward into title clearance and the final closing package section.

## Proof Log
- `pnpm --filter @ple/artifact test` passed and rebuilt `apps/artifact/dist/index.html`.
- In-app browser proof: Help & Demos rendered with 4 Doc Prep cards, right-aligned desktop headers/tabs, no console warnings/errors, and no visible fake/demo-surface/placeholder wording.
- In-app browser proof: Discovery walkthrough launched from Help & Demos and routed into Document Prep with the rail open.
- In-app browser proof: Discovery stream blocked correctly on missing tax evidence, Option+Down/Option+Up cycled sections, then completed after source capture, IDI import, and contact acceptance were entered through UI controls.
- In-app browser proof: Closing Prep streamed, blocked correctly on missing required fields, then completed after the remaining fields were entered through UI controls.
- Generated packet proof in browser: Discovery reached 7/7 stream sections and 10/10 linked documents; Closing Prep reached 5/5 stream sections and 20/20 linked documents.
- Post-fix fresh Chrome/DevTools proof loaded the rebuilt app with the corrected stream CSS and captured clean desktop/mobile screenshots: `docs/evidence/s30-docprep-stream-desktop.png`, `docs/evidence/s30-docprep-stream-mobile.png`, and `docs/evidence/s30-docprep-stream-proof.json`.
- Preview containment polish: renamed the rail header to `Preview`, gave the stream card a real document-pane row, and verified the stream no longer bleeds past its container.
- Post-fix metrics: desktop stream panel 520x648 with 494x418 scrollable document pane; mobile stream panel 392x577 with 366x342 scrollable document pane; every direct preview child is contained and the page has no horizontal overflow on either viewport.
- Rebuilt `apps/artifact/dist/index.html` after source edits; the dev server serves dist, so source-only edits are not proof.
- Closing rerun proof after rebuild: `docs/evidence/s30-docprep-stream-proof-rerun.json`, `docs/evidence/s30-docprep-stream-desktop-rerun.png`, and `docs/evidence/s30-docprep-stream-mobile-rerun.png`.
- Closing rerun results: `Run again` -> correction note -> `Run corrected packet`; `Preview` heading; 5/5 sections; bottom-right tax receipt link visible; legal template immutability visible; Option+Down/Option+Up changed sections without fallback; desktop/mobile preview cards contained the document pane with no horizontal overflow.
- Discovery rerun proof after rebuild: `docs/evidence/s30-discovery-stream-proof-rerun.json`, `docs/evidence/s30-discovery-stream-desktop-rerun.png`, and `docs/evidence/s30-discovery-stream-mobile-rerun.png`.
- Discovery rerun results: `Run again` -> correction note -> `Run corrected packet`; `Preview` heading; 7/7 sections; Tax Collector listing page and bottom-right receipt link visible; receipt proof, deed/title proof, court/probate proof, obituary/vital proof, IDI gate, and accepted contacts visible; desktop/mobile preview cards contained the document pane with no horizontal overflow.

## Review Notes
- Stream card clipping found during screenshot proof and fixed in source plus rebuilt artifact.
- Hostile review finding resolved: final post-fix proof now exists in fresh Chrome/DevTools screenshots and metrics, not the stale cached in-app browser tab.
- Hostile review finding resolved: the completed-packet rerun path was a dead end after `Save review note`. It now has a real `Run corrected packet` action and was proven in browser for Discovery and Closing.
- Hostile review finding resolved: the dev server served `dist/index.html`; after source edits, the browser kept showing stale behavior until `pnpm --filter @ple/artifact build` refreshed dist.
- Hostile review finding resolved: Closing originally showed the receipt URL as a generic `Tax receipt`. It now says `Bottom-right receipt link` in the visible Preview.
- The S30 proof is still local/browser proof. Production external service credentials and real provider uptime remain S29/S32 deployment-readiness concerns and must not be implied by these screenshots.

## S30 Plan Check
- Streaming Discovery and Closing docs in Doc Prep rail: passed in browser; both flows streamed after the completed-packet rerun path and completed with source evidence visible.
- Section anchors and Option+Up/Option+Down: passed in browser; active section and rail scroll changed as expected.
- Help & Demos sidebar tab with concise walkthrough cards: passed in browser; Doc Prep tab rendered 4 cards and Discovery walkthrough launched.
- No production-breaking wording in S30 surfaces: passed source scan for bad copy terms.
- Desktop/mobile proof: passed. Fresh Chrome/DevTools screenshots and metrics prove Discovery and Closing Preview panels render at stable dimensions with no horizontal overflow.
- Console health: passed during browser checks; no console warnings/errors were reported during Help & Demos, Discovery stream, keyboard navigation, or Closing Prep stream proof.

## Final Acceptance Notes
- Discovery streaming now shows Tax Collector listing-page receipt capture, bottom-right receipt link preservation, deed/title source evidence, probate/court source evidence, obituary/vital review, IDI operator-import gate, and contact review.
- If a real Tax Collector route is browser-blocked in production, the S29 source-capture contract still requires the saved blocker status to stream into Preview instead of leaving blank receipt fields.
- Closing Prep streaming starts from the reviewed Discovery File, shows the Tax Collector receipt link in title clearance and the final package, and states that legal template language remains unchanged.
- Preview proof confirms the header says `Preview`, no `Live packet preview` wording remains, and the streamed document is visually contained inside its rail card on desktop and mobile.
