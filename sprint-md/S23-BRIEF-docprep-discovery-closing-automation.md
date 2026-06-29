# Sprint Brief: S23 -- Discovery And Closing DocPrep Automation

## Intent

Make DocPrep feel like one reliable estate-file workflow. Operators import or select an estate, complete Discovery, run the approved IDI Asset Discovery intake once when authorized, and then generate Closing Docs from the same source evidence without losing per-estate progress or inventing facts.

## Milestone Gate

Implementation sprint after FULLY FUNCTIONAL PRD

## Branch Target

`v1.1.0/heirright-contract-completion-s22-s23`

## Scope -- Included

- Make Discovery progress per-estate and per-flow, not global browser state.
- Make Closing Docs progress per-estate and per-flow, not inferred from unrelated Discovery state.
- Field-map the closing-template packet reviewed in S22:
  - Fund Transfer / Bank Account Transfer.
  - Contract for Deed.
  - Quit Claim Deed.
  - Limited Power of Attorney.
  - Assignment of Surplus Rights Purchase Agreement.
  - Same Name Affidavit.
  - Joinder, Waiver and Consent.
  - Affidavit of Heirs.
  - Valuable Consideration Disbursement.
  - Assignment and Disclaimer of Interest.
  - Land Trust Agreement.
  - Tax Reimbursement Credit.
  - Buyer Purchase Agreement.
  - Unclaimed Funds instructions.
- Treat `HeirRight, LLC`, `Somi Home Buyers, LLC`, trust names, trustee names, buyer/seller names, folios, dates, and addresses as variables.
- Generate reviewed draft packets with missing-field blockers, source evidence, and operator next actions.
- Keep Discovery and Closing Docs distinct templates over the same estate file.
- Preserve prep-only language until Google/Podio readback and legal/template review are complete.

## Strict IDI Core Advisory

IDI Core is expensive per run. S23 is the only sprint allowed to touch the IDI Asset Discovery intake if needed for DocPrep completion. The rule is:

- One approved expanded asset-search import per estate/property.
- The verified intake path must pull an advanced people search for the Asset Discovery file and fill deceased information, immediate family, relatives, spouse/children where present, and contact candidates.
- Once that verified test passes once, do not modify the intake pipeline unless TP explicitly reopens it.
- Do not add background IDI runs, duplicate paid pulls, or per-person lookup loops.
- Duplicate imports must stay blocked unless an admin override reason is captured.

## Scope -- Excluded

- No legal-use claim for closing templates.
- No automatic external sending, signature requests, escrow instructions, or recording tasks.
- No live paid-source run unless TP explicitly approves the controlled IDI proof.
- No DocPrep progress based on placeholder data alone.

## Acceptance Criteria

- [x] Fresh imported estate starts Discovery at the first Discovery phase and Closing Docs at the first Closing phase unless that estate has its own saved progress.
- [x] Discovery and Closing completion state survives reload per estate.
- [x] Closing Docs packet rows map to the reviewed template families.
- [x] Missing fields are written as operator blockers, not developer errors.
- [x] Generated packets show source fields, variables, and review status.
- [x] IDI import, if run, proves contact enrichment once and then leaves the pipeline locked.
- [x] No UI copy claims live Podio, Google, legal, SMS, email, signature, escrow, or recording action happened from preview.

## Completion Evidence

Completed on 2026-06-29 on branch `v1.1.0/heirright-contract-completion-s22-s23`.

- Imported estate state is persisted per estate, with browser storage plus same-origin local review fallback.
- Discovery and Closing Docs maintain independent flow progress for the same estate file.
- Browser proof imported `Estate of S23 Server 12092`, completed Discovery Tax Receipt to 29%, reloaded, and confirmed Closing remained 0%.
- Final Chrome proof imported `Estate of S23 Final 58448`, advanced from Owner Details to Tax Receipt, completed Tax Receipt, reloaded, and confirmed Discovery persisted at 29% while Closing stayed at 0%.
- Production proof on `https://heirright-landing-demo.vercel.app` imported `Estate of S23 Prod Pass 00444`, completed Tax Receipt to 29%, reloaded, and confirmed the imported estate stayed selected while Closing remained at 0%.
- Closing Docs includes Closing Packet Review plus all reviewed template-family rows.
- In-app Quick Look renders the Closing Packet Review into the rail iframe with open blockers and template-family names.
- IDI Core was not run; the intake path remains locked pending a single explicit controlled proof.
- Validation passed: `pnpm build`, `pnpm --filter @ple/worker test`, `pnpm --filter @ple/artifact build`, and browser console check.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/artifact build
```

Browser proof:

- Import a new estate.
- Open Discovery and verify first-phase state.
- Open Closing Docs and verify first-phase state.
- Complete one Discovery phase and confirm Closing Docs does not jump unless its own requirement is met.
- Generate/preview a closing packet with visible missing-field blockers.
- Confirm no console errors on desktop and mobile.

## Handoff

S23 hands off to S24 when DocPrep can produce Discovery and Closing draft packets from one estate file and all external actions are still guarded.
