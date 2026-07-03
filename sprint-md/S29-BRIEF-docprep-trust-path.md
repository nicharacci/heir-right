# Sprint Brief: S29 -- Doc Prep Trust Path

## Intent

Complete the trust-critical Doc Prep path before any demo, settings, outreach, auth, or final-audit sprint claims. Discovery and Closing Prep must stop when evidence is missing, distinguish live paid IDI Core from report imports, and export one Doc Prep PDF artifact per selected flow.

## Milestone Gate

DOC PREP FLOWS COMPLETE OR FAIL CLOSED

## Branch Target

`v1.1.1/heirright-2026-06-30-s28-production-loop`

## Scope -- Included

- Discovery from CRM import and external public sources.
- Controlled live IDI Core run path with explicit approval, vendor config blockers, duplicate paid-run guard, persistence, and readback status.
- Approved IDI report import fallback that is clearly marked `operator_import` and `paidRun: false`.
- Source capture for the Tax Collector listing page, including the bottom-right receipt link, paid date, payer identity, unpaid years, receipt artifact/link, deed/OR evidence, probate/court evidence, obituary/vital review, contact review, and Discovery packet sections.
- Public-source acquisition contracts for Property Appraiser, Tax Collector receipt, Official Records deed/title, Probate Court, and obituary/vital review.
- Rule-based Closing Prep field map that fills only source-backed or operator-entered blanks.
- Required Closing input panel for values that cannot be inferred from the Discovery file.
- Closing export blocker when required fields are missing.
- Batch export response contract that names a single PDF artifact, not a folder.
- Anti-negligence review from the perspective of a hostile human reviewer.

## Scope -- Excluded

- No S30 streaming demo build.
- No S31 settings/auth/outreach production pass.
- No S32 final acceptance audit.
- No Ollama/local-agent feature.
- No ActivePieces embedded builder.
- No legal-template language modification.

## Acceptance Criteria

- [ ] Tax Collector listing-page capture extracts the bottom-right receipt link or blocks until the operator marks the receipt unavailable after checking the listing page.
- [ ] Live IDI request returns `mode: live_idi_core`, `paidRun: true`, `lockKey`, `readbackStatus`, and contacts only when `IDI_CORE_API_URL`, the shared default `IDI_CORE_API_KEY`, and explicit paid-run approval are configured.
- [ ] Missing IDI vendor API access returns a human-readable blocker and does not create a fake paid run. Portal access alone counts as `operator_portal` / import mode, not backend API proof.
- [ ] Operator-imported IDI report returns `mode: operator_import`, `paidRun: false`, `lockKey`, and contact preview count.
- [ ] Discovery auto-run stops at missing tax receipt, deed/OR, probate/court, obituary/vital, IDI, and contact evidence instead of marking phases complete.
- [ ] External-source automation is script/API-first for stable public pages and uses Browserbase only as a fallback for sites that require a browser workflow, session state, or endpoint discovery.
- [ ] Closing Prep auto-run stops at missing deed/tax/contact/required-field blockers.
- [ ] Closing required-field values persist per estate and do not edit legal template language.
- [ ] Closing export blocks before Google/Podio when required fields are unresolved.
- [ ] Batch export response includes `artifact.kind: single_pdf`, `contentType: application/pdf`, a URL, and section list.
- [ ] Legacy S28 proof seeding is disabled unless explicitly opted in.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm --filter @ple/artifact test
pnpm --filter @ple/worker build
pnpm --filter @ple/worker test
cd /Users/tifos/Documents/Codebases/heir-right
git diff --check
```

## TP Checklist

- Import one CRM estate and confirm it starts in Estate Discovery.
- Try Run Full Discovery before tax/deed/IDI evidence exists; confirm it stops with a clear blocker.
- Run or attempt live IDI Core; confirm it either completes as a paid run or blocks with vendor/approval evidence.
- Capture the Tax Collector listing page and confirm the bottom-right receipt link is preserved in the Discovery File.
- Import an approved IDI report and accept at least one contact.
- Switch to Closing Prep and confirm missing legal-template fields show as required inputs.
- Save a required field, reload, and confirm it persists.
- Attempt Closing export with a missing required field and confirm it blocks.
- Fill the missing fields and confirm Doc Prep can generate review packet records.
- Use Batch Queue export and confirm it reports one PDF artifact.
