# Wall-Wave Brief: S30 -- Demo, Streaming Preview, Help & Demos

## Intent

Show both Doc Prep flows end to end after the corrected S29 source contracts pass. The user should watch documents stream into the rail, jump between sections, and run concise walkthroughs without seeing placeholders, fake files, or pre-correction source assumptions.

## Mandatory Waves

- Wave 1: Streaming Doc Prep preview for Discovery and Closing Prep.
- Wave 2: Section quick access plus `Option+Up` / `Option+Down` section cycling.
- Review wave: hostile review for placeholders, fake files, broken keyboard paths, awkward transitions, confusing copy, and any source step that appears complete without Tax Collector receipt/deed/probate/IDI evidence.
- Proof wave: desktop/mobile E2E demo proof with screenshots or video plus clean console/network notes.

## Acceptance Criteria

- [ ] Discovery and Closing Prep stream visibly in the rail from the corrected S29 artifact state.
- [ ] Discovery demo exercises the Tax Collector listing-page receipt capture, including the bottom-right receipt link, saved browser-workflow blocker, or explicit unavailable-after-check blocker.
- [ ] Discovery demo shows the IDI API state honestly: live paid proof only when backend API is configured; otherwise operator-import or exact blocker.
- [ ] Section jump control scrolls smoothly to packet sections.
- [ ] `Option+Up` and `Option+Down` cycle sections without moving focus unpredictably.
- [ ] Help & Demos exists as a sidebar tab.
- [ ] Help & Demos cards are grouped by app section with right-justified headers.
- [ ] Each walkthrough explains a feature in under one minute.
- [ ] Walkthrough transitions look intentional and do not overlap UI.
- [ ] No placeholder copy, fake file names, stale `Live packet preview` wording, or unverifiable completion claims remain.

## TP Checklist

- Open Help & Demos.
- Run the Discovery Doc Prep demo.
- Run the Closing Prep demo.
- Watch a document stream into the rail.
- Confirm Tax Collector receipt, saved browser-workflow blocker, deed/title, probate/court, and IDI sections visibly stream or block for source evidence.
- Jump sections with the quick access control.
- Cycle sections with `Option+Up` and `Option+Down`.
- Confirm no placeholder text or fake-file proof is visible.
