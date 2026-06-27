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

## Review Notes

- This pass intentionally did not claim live Podio or Google Sheets writes. All CRM import/readback language remains prep-gated.
- The existing mobile shell hides the left navigation below 820px. The new mobile proof covers the changed import/table surface; broader mobile navigation is outside this product-loop change.
- Pre-existing `package.json` and `pnpm-lock.yaml` edits were left untouched and unstaged.
