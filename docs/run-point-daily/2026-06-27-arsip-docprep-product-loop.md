# 2026-06-27 Arsip-Inspired DocPrep Product Loop

## Reference Sources

- Arsip official site: https://arsip.app/
- Arsip App Store listing: https://apps.apple.com/us/app/arsip-paperwork-organizer/id6780822724
- App Store screenshots reviewed locally from `/tmp/arsip-reference/appstore-01.jpg` through `/tmp/arsip-reference/appstore-06.jpg`.

## Reference Lock

- Preserve HRight's current operator-shell visual canon. This is product-loop refinement, not a redesign.
- Adapt Arsip's loop, not its branding: one central object, global add/import action, active process cards, process dots/fuse, recent activity, and documents reused across processes.
- HRight object is the estate file, not a generic document.
- HRight import action must be CRM-first: Podio, Google Sheets, or pasted CRM row.
- Discovery and Closing Docs are workflow templates inside DocPrep, not separate pages.
- Public records and source files stay linked once and are reused across document workflows.
- Podio/Google live writes and readback remain blocked unless approved credentials and real readback proof exist.

## Implemented In This Pass

- Added a global sidebar `Import estate` action available outside the Estates tab.
- Added a CRM import modal for Podio, Google Sheets, and pasted CRM rows.
- Imported CRM estates persist locally and appear in Estates, Dashboard, Document Prep, Queue, and the rail.
- Added a flow-aware DocPrep template system with `Estate Discovery` and `Closing Docs`.
- Added Closing Docs stages: Closing Intake, Title Clearance, Seller Approval, Offer Underwriting, Closing Package.
- Added closing document requirements and preview packets: intake sheet, purchase agreement draft, seller signature packet, title request, escrow statement, and recording checklist.
- Updated process cards, fuses, stage dots, rail copy, and document rows to switch by active workflow template.

## Verification Plan

- Build `@ple/artifact`.
- Run the real local artifact app.
- In browser: open Dashboard, use Import estate, verify the imported estate appears in Estates, switch to Document Prep, switch between Discovery and Closing Docs, open the rail, complete at least one stage, queue the estate, and verify no copy claims live Podio/Google writes.
- Final review pass: inspect diff for unrelated churn, guardrail wording, responsive risk, and stale references.

## Verification Results

- `pnpm --filter @ple/artifact build` passed.
- `git diff --check` passed.
- Local app was verified with `AUTH_REQUIRED=false pnpm --filter @ple/artifact dev` at `http://localhost:4173`.
- Desktop Chrome end-to-end passed:
  - Imported a Podio estate from the global import action.
  - Confirmed the estate appeared in Estates with `CRM Import` and `Begin Discovery`.
  - Switched Document Prep to `Closing Docs`.
  - Opened the Closing Docs workflow fuse and verified 5 stages.
  - Completed the first phase and queued the estate for batch export review.
  - Browser console errors: none.
  - Screenshot: `/tmp/hright-arsip-desktop-final-proof.png`.
- Mobile Chrome import/layout check passed at 390px wide:
  - Opened the CRM import modal from the visible dashboard action.
  - Modal bounds stayed within the viewport.
  - Imported a Google Sheets estate and confirmed `Begin Discovery` in Estates.
  - Document-wide scroll width stayed at 390px; the inherited estate table used its own horizontal scroll region.
  - Browser console errors: none.
  - Screenshot: `/tmp/hright-arsip-mobile-import-proof.png`.
- Production deploy completed:
  - Commit deployed first: `9a28674 Strengthen DocPrep estate workflow loop`.
  - Vercel deployment: `dpl_6HpHthDQCUU6CSJGR7HLrTPFKrXf`.
  - Production URL: `https://heirright-landing-demo.vercel.app`.
  - Inspect URL: `https://vercel.com/solvys/heirright-landing-demo/6HpHthDQCUU6CSJGR7HLrTPFKrXf`.
  - Live alias returned `HTTP/2 200`.
  - Live HTML contained the new `crmImportSidebar`, `Import estate`, `Closing Docs`, `doc-flow-tab`, and `heirright:crm-imported-estates` markers.
  - Live Chrome smoke imported a Podio estate, confirmed `CRM Import` plus `Begin Discovery`, opened Closing Docs, found 11 document rows, and reported no console errors.
  - Live screenshot: `/tmp/hright-arsip-live-vercel-proof.png`.

## Review Notes

- This pass intentionally did not claim live Podio or Google Sheets writes. All CRM import/readback language remains prep-gated.
- The existing mobile shell hides the left navigation below 820px. The new mobile proof covers the changed import/table surface; broader mobile navigation is outside this product-loop change.
- Pre-existing `package.json` and `pnpm-lock.yaml` edits were left untouched and unstaged.

## 2026-06-28 UI Correction

- Restored the artifact app to the canonical flat dark surface. The bright light-theme variables and light override layer were removed, and theme application now resolves the app surface to dark even if a browser has an old light preference in local storage.
- Moved CRM import out of the sidebar and dashboard section header.
- Added the topbar split import chip to the left of `Prep export`:
  - Main chip target opens single-estate import.
  - Right chevron opens batch import choices for Podio, Google Sheets, and CSV/pasted rows.
- Kept batch import prep-gated: pasted rows create local DocPrep estates only; no live CRM write or readback is claimed.
- Locked the sidebar navigation to the top of the shell.
- Fixed closed overlay overflow so mobile no longer gets document-wide horizontal scroll from hidden export/list controls.

## 2026-06-28 Correction Verification

- `pnpm --filter @ple/artifact build` passed after the correction.
- `git diff --check` passed after the correction.
- Inline artifact script parse passed.
- Local desktop Chrome proof at `http://localhost:4173`:
  - Body, app, and dashboard computed background: `rgb(32, 33, 36)`.
  - Sidebar top: `0`; nav list top: `64`.
  - Sidebar import removed.
  - Dashboard import removed.
  - Topbar import chip text: `+ Import`.
  - Single import created a CRM estate with `Begin Discovery`.
  - Batch import menu opened and imported a pasted Podio row.
  - Closing Docs still opened with 11 document rows.
  - Browser console errors: none.
  - Screenshot: `/tmp/hright-ui-correction-desktop-final.png`.
- Local mobile Chrome proof at 390px wide:
  - Body background: `rgb(32, 33, 36)`.
  - Document scroll width before dropdown: `390`.
  - Document scroll width after dropdown: `390`.
  - Batch dropdown bounds: `left=16`, `right=274`.
  - Browser console errors: none.
  - Screenshot: `/tmp/hright-ui-correction-mobile-final.png`.

## Discovery Source Plan For Tomorrow

- Source files to close before automated Discovery DocPrep can be considered ready:
  - Property identity and owner details from Property Appraiser.
  - Tax status, unpaid-year history, tax receipt, reassessment changes, and payer identity from Tax Collector.
  - Deed/title signals from Official Records: recent sale, OR book/page, mortgage, lien, adverse possession, and mailing-address facts.
  - Civil/family/probate docket status, probate case number, affidavit of heirs, and probate document request tasks.
  - Marriage/death indicators: marriage licenses, obituaries, death indicators, and death-certificate tasking.
  - Family tree and contact matrix: known heirs, primary/alternative contacts, mailing addresses, DOB/DOD where approved, and contact review decisions.
  - Paid/manual source governance for IDI, Intelius, Ancestry, ForeWarn, VitalChek, PI requests, door knocks, and code-enforcement calls.
  - Source QA/readback evidence: source links, captured fields, missing fields, Podio/Google prepared-only export result, and live readback proof once credentials are approved.
- Morning implementation target:
  - Complete both Discovery DocPrep and Closing Docs workflows as automated templates over the same estate file.
  - Make export/readback bounce to Podio only after approved credentials, write approval, and readback proof pass.
  - Preserve prep-only language until live Podio proof exists.
  - Target next-week business readiness by Wednesday with a real Podio-ready packet, not a mock path.
