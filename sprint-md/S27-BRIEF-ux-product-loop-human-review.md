# Sprint Brief: S27 -- UX And Product Loop Human Review

## Intent

Prepare and run the final Sam/Joshua review of the whole HeirRight loop. This is the acceptance sprint: what is done, what is blocked by credentials or legal approval, what is safe for operators, and what remains after contract completion.

## Milestone Gate

UX AND PRODUCT LOOP HUMAN REVIEW

## Branch Target

`v1.1.0/heirright-contract-completion-s26-s27`

## Scope -- Included

- Produce the final review packet in plain real estate workflow language.
- Walk the product loop:
  - Import estate.
  - Complete Discovery.
  - Run or review the one approved IDI Asset Discovery enrichment proof.
  - Review contacts.
  - Generate Discovery dossier.
  - Generate Closing Docs packet.
  - Prepare outreach.
  - Sync to Google Sheets and Podio or show exact credential blockers.
  - Verify website/legal pages.
- Capture human decisions:
  - final closing-template approval,
  - outreach compliance approval,
  - SMS provider decision,
  - live Podio/Google credential owner,
  - custom domain decision if any,
  - whether lead generation capability should be activated now or later.
- Update Linear fallback statuses and final daily handoff.

## Strict IDI Core Advisory

IDI Core must remain locked during S27.

- Do not run another IDI pull for review theatrics.
- Show the verified proof artifact or blocker.
- Treat any requested IDI pipeline change as a new scoped decision outside S22-S27 unless TP explicitly says otherwise.

## Scope -- Excluded

- No new feature build unless S26 found a launch-blocking defect.
- No mass outreach.
- No bulk CRM writes.
- No extra IDI run.
- No legal claim that forms are externally usable unless Joshua/Sam approve the final language.

## Acceptance Criteria

- [ ] Final packet says which contract items are complete, blocked, or awaiting human signoff.
- [ ] Client-facing language is plain real estate workflow language.
- [ ] Google Sheets and Podio status is backed by readback proof or exact blockers.
- [ ] IDI status is backed by one verified proof or an explicit not-run blocker.
- [ ] Website route proof is included.
- [ ] UI/product-loop notes from TP annotations are reflected in follow-up issues or acceptance notes.
- [ ] Repo-local Linear fallback and sprint docs are current.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right
git diff --check
rg -n "Required corrections before complete|blocked|readback|IDI Core is expensive|S22|S23|S24|S25|S26|S27" docs linear sprint-md probate-lead-engine/sprint-md
```

## Handoff

S27 completes the six-sprint completion pack only when the review packet has an explicit accepted/blocked status for each corrected contract objective.
