# Sprint Brief: S22 -- Contract Completion PRD And Source Lock

## Intent

Turn the current HeirRight state into an implementation-ready completion PRD for the final six-sprint pack. This sprint is done when the corrected scope, source evidence, sprint order, validation gates, Linear fallback, and IDI Core cost guardrails are explicit enough that S23-S27 agents can execute without rediscovery.

## Milestone Gate

FULLY FUNCTIONAL PRD

## Branch Target

`v1.1.0/heirright-contract-completion-s22-s23`

## Scope -- Included

- Lock the corrected contract scope:
  - Automate Discovery DocPrep.
  - Automate Closing DocPrep.
  - Finalize the website page contract.
  - Automate SMS/email outreach through Podio, Resend, or owned app queue plus approved SMS gateway.
  - Prove UI error-free behavior on tested surfaces.
  - Prove Google Sheets and Podio integrations by controlled write/readback.
- Reconcile existing S1-S21 evidence and mark done work done in the repo-local Linear fallback.
- Keep S22-S27 as the only remaining completion sprints.
- Review the two closing-template PDFs and carry the packet inventory into S23.
- Update run-point docs with two-sprints-per-day execution and the three mandatory gates.
- Preserve historical sprint numbering and do not renumber S1-S21.

## Strict IDI Core Advisory

IDI Core is expensive per run. S22 must put this warning into every remaining sprint brief and the run-point plan:

- Run IDI only through the approved Asset Discovery intake path.
- Use exactly one expanded asset-search import for the estate/property unless TP explicitly authorizes another paid run.
- Once one verified test proves the pipeline fills deceased information, immediate family, relatives, spouse/children where present, contact candidates, and alternative contacts, the intake path is locked.
- Do not refactor, reroute, rename, bypass, or "clean up" the verified IDI intake pipeline after it works once.
- No background IDI cron, per-person paid lookup loop, retry loop, or lead-volume IDI sweep.

## Scope -- Excluded

- No product code changes unless a planning file cannot truthfully reference an existing seam.
- No live Podio, Google, email, SMS, or IDI action.
- No new Linear project. Use `linear/HEIRRIGHT_LINEAR_TICKETS.md` while live Linear auth is blocked.
- No legal/compliance claim about closing document validity.

## Acceptance Criteria

- [x] `docs/HEIRRIGHT_CONTRACT_COMPLETION_PLAN_2026-06-29.md` exists and is source-backed.
- [x] `linear/HEIRRIGHT_LINEAR_TICKETS.md` includes S22-S27 and current completion status.
- [x] `docs/HEIRRIGHT_RUN_POINT_AUTOMATION.md` names the three milestone gates and two-sprints-per-day cadence.
- [x] Every S22-S27 brief contains the IDI Core cost and immutability advisory.
- [x] Closing-template packet inventory includes entity-name discrepancy handling.
- [x] The plan says lead generation volume is future capability, not the current acceptance target.

## Completion Evidence

Completed on 2026-06-29 on branch `v1.1.0/heirright-contract-completion-s22-s23`.

- Source plan, Linear fallback, roadmap, and run-point docs carry the corrected contract objective.
- S22-S27 remain the final six-sprint completion pack.
- Reviewed closing-template families and the `HeirRight, LLC` / `Somi Home Buyers, LLC` discrepancy are carried into S23.
- Validation: `git diff --check` passed.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right
rg -n "S22|S23|S24|S25|S26|S27|IDI Core is expensive|FULLY FUNCTIONAL PRD|FULL-APP HUMAN-PRACTICAL TESTING|UX AND PRODUCT LOOP HUMAN REVIEW" docs linear sprint-md probate-lead-engine/sprint-md
git diff --check
```

## Handoff

S22 hands off to S23 only when the plan is current and the repo-local Linear sheet makes clear what is done, what is blocked externally, and what remains implementation work.
