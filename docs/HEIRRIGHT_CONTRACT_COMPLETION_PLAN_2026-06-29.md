# HeirRight Contract Completion Plan - 2026-06-29

Status: planning source for S22-S27 completion pack
Owner: Codex Automation, with TP/Sam milestone gates
Canonical repo: `/Users/tifos/Documents/Codebases/heir-right`
Implementation root: `probate-lead-engine/`
Website root: `site-v2/`
Local Linear fallback: `linear/HEIRRIGHT_LINEAR_TICKETS.md`

## Corrected Contract Scope

The remaining project is not a lead-volume sprint. The client wanted enriched leads now, plus the capability to generate leads later when needed. The completion scope is:

- Automate both Doc Prep processes: Discovery and Closing.
- Ship the new website as a 3-page site with landing, Terms of Use, and Privacy Policy content. Contact can remain a fourth operational page if useful, but Terms and Privacy must be readable as legal subpages or independently addressable legal sections.
- Automate SMS and email outreach using Podio, Resend, or an owned OSS-friendly app queue with an approved SMS carrier gateway. The app owns templates, approval, audit, retries, and stop rules; SMS transmission still requires a carrier provider.
- Keep the user interface error-free on the tested app and website surfaces.
- Prove successful Google Sheets and Podio integrations with controlled writes and readback before claiming live integration complete.

## Current Evidence Reconciliation

- S1-S8, S10-S18, S20, and S21 have repo evidence or daily handoff evidence and should not be reopened unless a regression appears.
- S9, S15, and S19 have guarded local prep/readback packet evidence, but live Google Sheets and Podio success still needs configured credentials, controlled test values, and readback proof.
- S21 DocPrep product loop exists in the artifact app: CRM import, Discovery, Closing Docs, document rows, process fuses, and prep-gated export language.
- The public website is deployed as `site-v2` with landing, legal, and contact routes. The remaining legal task is to ensure Terms and Privacy meet the user's requested subpage/page contract, not to restart the website.
- IDI Asset Discovery work exists as a focused brief under `probate-lead-engine/sprint-md/S2-BRIEF-idi-asset-discovery.md`. It must be treated as an expensive, locked intake pipeline after its first verified run.

## Closing Template Packet Review

Reviewed PDFs:

- `/Users/tifos/Downloads/Automation Project.pdf`
- `/Users/tifos/Downloads/AutomationProject .pdf`

Both PDFs are 54-page Google Docs exports titled `Automatization Project`. Text extraction shows the packets are materially identical except one entity-name line in the Assignment of Surplus Rights page: one says `HeirRight, LLC`; the other says `Somi Home Buyers, LLC`. Treat company/entity names as variables and do not hard-code either value globally.

Template families observed:

- Fund Transfer Form and Bank Account Transfer Form.
- Contract for Deed Agreement.
- Quit Claim Deed (QCD).
- Limited Power of Attorney.
- Assignment of Surplus Rights Purchase Agreement.
- Same Name Affidavit.
- Joinder, Waiver and Consent.
- Affidavit of Heirs.
- Valuable Consideration Disbursement.
- Assignment and Disclaimer of Interest.
- Land Trust Agreement.
- Tax Reimbursement Form/Credit.
- Buyer Purchase Agreement / Agreement to Purchase Real Estate.
- Instructions for Heirs to Claim Unclaimed Funds Through Florida Treasure Hunt.

Closing DocPrep must model these as reviewed draft templates, with missing fields surfaced to the operator and no legal-use claim until the client confirms the final template language.

## Strict IDI Core Advisory

IDI Core is expensive per run. Every sprint agent must follow this rule:

- Run IDI only through the approved Asset Discovery intake path.
- Use exactly one expanded asset-search import for the estate/property unless TP explicitly authorizes another paid run.
- Once one verified test proves the pipeline pulls an advanced people search for an Asset Discovery file and fills deceased information, immediate family, relatives, spouse/children where present, contact candidates, and alternative contacts, the intake path is locked.
- Do not refactor, reroute, rename, bypass, or "clean up" the verified IDI intake pipeline after it works once.
- Do not add a background IDI cron, per-person paid lookup loop, retry loop, or lead-volume IDI sweep.
- Duplicate IDI imports remain blocked unless an admin override reason is captured.

## Six-Sprint Completion Pack

The remaining work is six sprints total, continuing the existing repo numbering:

| Sprint | Gate | Outcome |
| --- | --- | --- |
| S22 | FULLY FUNCTIONAL PRD | Corrected contract scope, source lock, closing-template inventory, IDI guardrails, Linear reconciliation, and executable validation plan. |
| S23 | Implementation | Discovery and Closing DocPrep become one reliable estate-file workflow with per-estate progress, packet generation, and template field mapping. |
| S24 | Implementation | Outreach automation, Google Sheets, and Podio are wired through approved queues, controlled writes, audit logs, retries, and readback proof. |
| S25 | Implementation | Website is final against the requested page contract and production proof; legal pages are not buried in one ambiguous page if the client expects separate Terms and Privacy subpages. |
| S26 | FULL-APP HUMAN-PRACTICAL TESTING | Human-realistic app test sprint across import, Discovery, Closing, IDI, outreach, exports, website, mobile, and error states. |
| S27 | UX AND PRODUCT LOOP HUMAN REVIEW | Final Sam/Joshua review packet, unresolved judgment calls, acceptance readback, and handoff. |

Daily automation cadence:

- Day 1: S22 + S23.
- Day 2: S24 + S25.
- Day 3: S26 + S27.

## Annotation Intake Rule

TP will make UI and product-loop annotations after this planning pass. Do not treat this plan as a freeze on those details. Route annotations into the owning sprint:

- App workflow, estate-file loop, Discovery, Closing, document rows, progress, and IDI intake annotations: S23.
- Outreach, email, SMS, approval, audit, Google Sheets, Podio, and integration-error annotations: S24.
- Website, landing page, Terms, Privacy, Contact, copy, form, metadata, and route annotations: S25.
- Practical-test observations: S26.
- Final acceptance, human-review, launch, and handoff decisions: S27.

## Validation Bundle

Core app:

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"
pnpm --filter @ple/worker run:daily
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker milestone:30-day
pnpm --filter @ple/artifact build
```

Website:

```bash
cd /Users/tifos/Documents/Codebases/heir-right/site-v2
pnpm build
```

Live/proof gates:

- Browser verify artifact desktop and mobile with no console errors.
- Browser verify website desktop and mobile routes.
- Prove one controlled Google Sheets write/readback.
- Prove one clearly labeled Podio test item/comment/task/readback.
- Prove outreach sends are gated until approved and configured; if a real test send is authorized, send only to a controlled internal test recipient.
- Prove IDI duplicate import block after the verified paid test.

## Open Variables

- Exact SMS provider if Podio cannot send SMS natively. The app can be OSS-owned, but real SMS delivery requires Twilio, Telnyx, Plivo, SignalWire, Podio-native SMS integration, or a comparable carrier gateway.
- Whether Terms of Use and Privacy Policy must be separate physical pages (`terms.html` and `privacy.html`) or one legal route with independent readable sections is acceptable. The sprint plan assumes separate pages are safer.
- Google Workspace target Sheet/Drive/Docs IDs and service credentials.
- Podio live credentials, field map, controlled test values, CSV backup/export access, and explicit test-write flag.
- Final legal/compliance approval for closing documents and external outreach copy.

## /solvys-heir-audit

Source checked: `references/deal-flow-checklist.md`, S21 DocPrep handoff, S25 website handoff, closing-template PDFs, repo PRD/roadmap/Linear fallback.

Backward: reconciled the latest clarified scope against completed repo evidence. Prior lead-volume weighting is removed; the plan now focuses on Discovery DocPrep, Closing DocPrep, website/legal pages, outreach automation, Google Sheets, Podio, UI proof, and IDI enrichment guardrails.

UX pass: aligned. S23 now fixes per-estate/per-flow progress truth and turns the reviewed closing templates into field-mapped draft packets with visible blockers.

Forward: S22-S27 are the remaining contract-completion sprints. S23 owns DocPrep, S24 owns outreach and integrations, S25 owns website/legal finalization, S26 owns practical testing, and S27 owns final product-loop review.

Alignment: aligned with remaining external gates.

Required corrections before complete:
- Complete live Google Sheets and Podio readback before claiming integration complete.
- Do one approved IDI pipeline proof only, then freeze the intake path.
- Split Terms/Privacy into separate subpages if the client expects literal separate pages.
- Keep closing documents as reviewed drafts until client legal/template approval is recorded.
