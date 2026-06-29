# Sprint Brief: S26 -- Full-App Human-Practical Testing

## Intent

Run the whole HeirRight product like an operator, not like a developer. This sprint is for realistic human-practical testing across the app, website, DocPrep, IDI intake, outreach, Google Sheets, Podio, Settings, mobile, error states, and handoff packets.

## Milestone Gate

FULL-APP HUMAN-PRACTICAL TESTING

## Branch Target

`v1.1.0/heirright-contract-completion-s26-s27`

## Scope -- Included

- Test fresh estate import from Podio-style, Google Sheets-style, and pasted/CSV-style input.
- Test Discovery DocPrep from first phase through generated dossier packet.
- Test Closing Docs from first phase through generated draft closing packet.
- Test IDI intake only if the approved controlled proof has not already been completed. If it has been completed, verify duplicate-run blocking without running IDI again.
- Test outreach campaign/template prep, approval blocks, variable preview, archive/restore, retry, and Settings CTAs.
- Test controlled Google Sheets readback and controlled Podio readback if credentials are configured.
- Test website landing, Terms, Privacy, and forms.
- Test desktop and mobile for text fit, overflow, modals, menus, and console errors.
- File fixes back to S23, S24, or S25 ownership instead of hiding them in S26 notes.

## Strict IDI Core Advisory

IDI Core is expensive per run. S26 is a testing sprint, not an enrichment sprint.

- If S23 already proved IDI once, do not run IDI again.
- Verify duplicate-blocking and contact-review state using existing proof artifacts.
- If the one approved IDI proof is still missing, run only the approved single estate/property test and then freeze the intake path.
- Any proposed IDI code change after the verified test is a blocker requiring TP approval.

## Scope -- Excluded

- No production bulk import.
- No mass outreach.
- No extra paid-source tests for convenience.
- No silent fix ownership. Route defects to the sprint that owns the broken behavior.

## Acceptance Criteria

- [ ] A non-technical operator can see the estate state, next action, blockers, and review status without developer help.
- [ ] Discovery and Closing flows are tested end to end.
- [ ] Outreach is tested end to end through approval/sync gates.
- [ ] Google and Podio are either readback-proved or blocked with exact missing configuration.
- [ ] Website routes are production-verified.
- [ ] Desktop and mobile proof show no console errors or incoherent overlap.
- [ ] Defects are mapped back to S23/S24/S25 with evidence.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker milestone:30-day
pnpm --filter @ple/artifact build
cd /Users/tifos/Documents/Codebases/heir-right/site-v2
pnpm build
```

## Handoff

S26 hands off to S27 only after the full practical test packet exists and each defect is either fixed or assigned back to its owning sprint with proof.
