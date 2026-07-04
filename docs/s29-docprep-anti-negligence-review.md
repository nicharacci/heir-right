# S29 Doc Prep Anti-Negligence Review

Date: 2026-07-03

## Reviewer Posture

Assume every AI-built completion claim is false until the app proves it with source evidence, persisted state, route output, and a visible operator-facing blocker when something is not ready.

## What Changed

- IDI now has two explicit modes: `live_idi_core` for controlled paid runs and `operator_import` for approved report imports.
- Missing IDI access or approval blocks with a human-readable message.
- Discovery cannot auto-complete tax, deed, obituary, IDI, or contact-review phases without evidence.
- Tax Collector evidence now has to include the listing page receipt path: the bottom-right receipt link, paid date, payer identity, or an explicit unavailable-after-listing-check blocker.
- Tax Collector browser-workflow blockers now save as `source_status` facts with `TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED`, so the blocker survives API fallback paths, UI evidence rows, and packet output.
- Tax Collector has a `TAX_COLLECTOR_BROWSER_WORKFLOW_URL` hook so a Browserbase/controlled Chrome workflow can return listing HTML or the receipt link for deterministic extraction.
- Public-source acquisition contracts now name the expected Property Appraiser, Tax Collector receipt, Official Records deed/title, Probate Court, and obituary/vital review stages.
- `/api/discovery/external-source-run` now gives Doc Prep one callable source-run surface across worker, local artifact server, and serverless fallback. It returns all required Discovery source buckets, source facts, and blockers without marking missing sources complete.
- Doc Prep now has an operator-facing `Run Source Search` control in the public-record capture panel. It writes back returned source facts, Tax Collector browser blockers, receipt links, and source summaries into the estate-scoped capture state.
- Official Records and Civil/Family/Probate now have explicit Miami-Dade Clerk Commercial Data Services API clients. They are credential-gated by `MIAMI_DADE_CLERK_AUTH_KEY` and return `commercial_api_key_required` blockers when the paid AuthKey is missing.
- Marriage/death/obituary/vital indicators now have a configurable workflow API hook. When no workflow is configured, they return `workflow_required` plus `VITAL_RECORDS_WORKFLOW_REQUIRED` instead of blank source facts.
- Settings/export readiness now exposes `Vital/Obituary Workflow` separately from generic Web Search readiness.
- Source governance is now route-visible as `Governed manual and paid research`, and explicitly names voter records, professional licenses, business/address associations, social profiles, and deceased-indicator cross-checks as approval-gated review work.
- Tax Collector and vital/obituary adapters now invoke Browserbase Functions directly when function IDs and `BROWSERBASE_API_KEY` are configured, instead of requiring a separate custom workflow URL.
- Deployable Browserbase Function source files now exist in `probate-lead-engine/browserbase-functions` for Tax Collector receipt capture and vital/obituary review.
- Closing Prep cannot auto-complete title, seller approval, or package phases when required evidence or fields are missing.
- Required Closing fields persist per estate and feed the deterministic field map.
- Closing export blocks before Google export if required fields are unresolved.
- Batch export responses now expose a single PDF artifact contract.
- Legacy S28 proof seeding is disabled unless explicitly opted in through `heirright:allow-legacy-s28-proof-seed`.

## Hostile Findings Addressed

- A demo proof helper could make current Doc Prep look complete. Disabled by default.
- The app could visually advance through Discovery phases without IDI/source evidence. Blocked.
- Closing template values could rely on unresolved inferred data. Required input panel added.
- Google Closing export could be requested before missing legal-template fields were resolved. Preflight block added.
- Export responses did not clearly state one PDF artifact. Artifact contract added.
- Preview rail could let the embedded PDF bleed outside the card and still had stale packet-preview wording. The report rail now uses `Preview`, the old wording is absent, and Chrome geometry proof shows the PDF frame/card containment passes.
- Browser-blocked Tax Collector runs could look like generic missing tax evidence. The source-capture route now records `browser_workflow_required`, keeps the Tax Collector phase incomplete, and shows a plain blocker note field in Doc Prep.
- Settings could hide Tax Collector automation readiness behind generic Web Search. `/api/connections/status` now reports `Tax Collector Source` separately, including script-listing and Browserbase/Chrome readiness.
- External-source readiness could be misunderstood as "all sources are automated." The source-run route now exposes Property Appraiser as partial, Tax Collector as blocked when GovHub needs browser workflow, and court/vital/IDI/manual sources as needs-review/blocker states until proven.
- The Doc Prep rail was hard to proof directly because Document Prep opens to the all-clients list and the walkthrough can overlay the rail. QA/demo deep links now open the estate rail directly and can scroll to source capture without touching production data.
- Operators could click `Run Source Search` without seeing which source systems were actually ready. The public-record capture card now shows a source-readiness preflight for tax receipts, Clerk records, obituary/vital review, IDI, and manual research before a run starts.

## Remaining Proof Required

- A real live IDI Core backend run still requires `IDI_CORE_API_URL`, the shared default `IDI_CORE_API_KEY`, and approval in the target environment. Current proof shows operator portal/import mode only, with user override allowed.
- A production Browserbase/Chrome Tax Collector workflow still needs to be deployed and proven against the real public-search flow. Current proof includes a Browserbase API mock and parser proof; it does not claim the GovHub browser run is automated end to end.
- The Tax Collector Browserbase Function path is mock-proven through the actual source-run route, but the real deployed function must still be configured and run against GovHub.
- Live system-Chrome proof reached Cloudflare security verification at the public GovHub entry, confirming pure script is not enough from the public search URL.
- Official Records, Probate/Civil/Family Court, Tax Collector public search, marriage/death/obituary/vital sources, and skip trace are represented in the source-run contract but still need credentialed workflow proof or explicit operator-review completion proof before anyone can say the external-source Discovery workflow is fully automated.
- Official Records and Probate/Civil/Family Court now have official commercial API paths, but they still need a credentialed paid proof run with an enabled Clerk developer account and pre-paid units before anyone can call them production-complete.
- Vital/obituary Browserbase Function path is mock-proven through the actual source-run route, but the real deployed function must still be configured and run against source pages before anyone can call those fields production-complete.
- Google/Podio live write and readback still require configured credentials and approval.
- Browser E2E and PDF inspection must be rerun after any additional source-flow or preview changes.

## 2026-07-03 Source-Run Proof Addendum

- Local route proof on `http://localhost:4178/api/discovery/external-source-run` returned:
  - `ok: false`;
  - `mode: external_source_run`;
  - all required source buckets present;
  - `sourceFacts: 49`;
  - Property Appraiser status `partial`;
  - Tax Collector status `blocked`;
  - `blockers: 7`.
- Headless Chrome DOM proof for `?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture` found:
  - `Public-record capture`;
  - `Run Source Search`;
  - `Tax Collector listing page`;
  - `Bottom-right receipt link`;
  - `Tax source blocker note`;
  - `Listing page HTML / source note`.
- Visual proof saved at `/tmp/heirright-docprep-source.png` shows the public-record capture panel contained in the Doc Prep rail.
- Clerk API route proof returned explicit `commercial_api_key_required` blockers for Official Records and Probate/Civil/Family Court and added `Miami-Dade Clerk API` to Settings connection status.
- Tax Collector browser-workflow hook proof returned a bottom-right receipt link from mocked workflow listing HTML and preserved review flags.
- Vital/obituary workflow direct proof returned mocked DOB/DOD/obituary/marriage/death-certificate facts and preserved review flags.
- Vital/obituary route proof returned `workflow_required` and `VITAL_RECORDS_WORKFLOW_REQUIRED`; Settings returned `Vital/Obituary Workflow` as blocked until the workflow URL is configured.
- Source governance route proof returned 8 source summaries and a blocked `Governed manual and paid research` bucket containing voter, professional-license, business/address, social-profile, and deceased-indicator review codes.
- Browserbase route proof with mocked Browserbase Function API returned Tax Collector receipt link and vital date-of-death facts through the actual `/api/discovery/external-source-run` route, while leaving Clerk/IDI/skip/governed sources blocked.
- Browserbase function package proof passed syntax checks and extraction contract tests for receipt capture, obituary-link selection, and DOB/DOD hints.
- Source-readiness server/API proof found `Source readiness before this run`, `Tax receipts`, `Clerk records`, `Obituary and vital review`, `IDI asset search`, and `Manual research`, backed by `/api/connections/status` rows for `Tax Collector Source`, `Miami-Dade Clerk API`, `Vital/Obituary Workflow`, and `IDI Core`.
- Chrome Computer Use proof on a clean `localhost:4179` origin switched to `Estate Discovery`, showed the readiness rows in the visible Doc Prep rail, clicked `Run Source Search`, and rendered review blockers plus source facts without assuming missing public or paid-source facts.
- Deep-link proof on `localhost:4180` first persisted `Closing Prep`, then reopened the `section=source-capture` route. The app forced `Estate Discovery` for that proof route and rendered `Public-record capture` with source readiness blockers, so S29/S30 demos no longer depend on an operator manually switching tabs first.
- Source-run proof ledger route proof on `localhost:4181` returned 8 source proof rows, `allRequiredSourcesAccountedFor: true`, `readyForDiscoveryCompletion: false`, and `legalTemplateAutofillAllowed: false`; the ledger keeps credential/workflow gates machine-readable for Tax Collector, Clerk, vital/obituary, IDI, skip trace, and governed manual research.
- Operator-visible proof addendum on `localhost:4182` clicked the real `Run Source Search` button in headless Chromium and rendered the `What this run proved` section with 8 source proof rows. The visible rows explain bottom-right Tax Collector receipt capture, Property Appraiser review, latest-deed/Clerk access, vital/obituary review, IDI import/run approval, skip-trace approval, and governed manual research without leaking backend env var names into the UI.
- Preview containment addendum on `localhost:4182` clicked `Run Full Discovery` in headless Chromium and proved the artifact stream is bounded: card `minHeight: 0px`, document `height: 228px`, `maxHeight: 228px`, `overflowY: auto`, and `previewFitsCard: true`. The source text for the preview eyebrow is `Preview`; stale `Live packet preview` copy is absent.
- Tooling caveat: Computer Use could not attach to Chrome after the resumed context (`cgWindowNotFound`), and Chrome AppleScript JavaScript execution was disabled, so the browser proof used cached headless Chromium with DevTools Protocol instead of a screenshot claim.
- IDI proof addendum on `localhost:4182` found `operator_portal` mode with user override allowed, but no `IDI_CORE_API_URL` and no shared default `IDI_CORE_API_KEY` in the current local/deployment env files. A pasted user key was accepted as `apiKeySource: user_override` and then blocked only on the missing endpoint; no pasted key returned `apiKeySource: missing` with both endpoint and access blockers. Approved report import returned HTTP `200` in `operator_import` mode with `paidRun: false`.
- Source-run contract addendum: `@ple/artifact` now has an executable contract test for `/api/discovery/external-source-run`. It fails if any required source bucket disappears, if Discovery is marked complete while blockers remain, if legal-template autofill becomes allowed from unreviewed source facts, if the Tax Collector bottom-right receipt link is dropped, or if the operator bundle loses the source-proof/preview containment copy.
- Cache-invalidation addendum: Turbo now tracks IDI, Browserbase, Tax Collector, Miami-Dade Clerk, vital/obituary, and alternate worker proxy env vars. The artifact source-run contract test fails if those env vars fall out of `globalEnv`, preventing stale cached "blocked" proof after production credentials are configured.
- Tax Collector receipt-selection addendum: Browserbase, worker, and artifact source-capture helpers now score the listing-page receipt link instead of taking the last payment-like anchor. Regression fixtures include a correct bottom-right receipt link followed by a misleading footer `Payment history` link.
- Source-readiness contract addendum: `@ple/artifact` now has an executable `/api/connections/status` contract test that fails if Tax Collector, Clerk, vital/obituary, or IDI readiness collapses into a fake "all APIs are automated" state. Browser proof clicked `Run Source Search` on `localhost:4185` and rendered 8 source-proof rows without raw credential/env names in visible operator copy.
- Settings source-controls addendum: Settings now exposes dedicated `Tax Collector`, `Clerk Records`, and `Vital Sources` cards plus status rows for `Tax Collector Source`, `Miami-Dade Clerk API`, and `Vital/Obituary Workflow`. The source-readiness test fails if those controls disappear.
- No-fake-API-claim addendum: the source-run response now says `Discovery source checks`, not `Discovery source APIs`. The source-run contract fails if the response implies all Discovery sources are APIs.
- Source-proof detail addendum: source-run proof rows now include `detailChecks` from the source-governance catalog. The Doc Prep rail renders blocking source steps and governed manual/paid items, including bottom-right receipt capture, voter records, professional licenses, business/address associations, social profiles, deceased-indicator cross-check, door knock, neighbor research, and code enforcement.
- IDI guardrail detail addendum: the IDI source proof row now renders access mode, paid-run approval, first-run duplicate lock, approved report import, and contact-review details. Skip trace now renders provider-access and contact-review details. All remain approval-gated and blocked from legal-template autofill.
- Detail-readiness addendum: blocking detail checks now affect `readyForOperatorReview`. The source-run proof exposes `detailCheckCount`, `blockingDetailCheckCount`, and `unresolvedDetailCheckCount`, and the Doc Prep rail tells the operator when source checklist items still block Discovery.
- Captured-evidence addendum: external-source runs now merge operator source-capture facts and resolve only the specific checklist rows backed by facts. Tax receipt, payer/date, deed, probate docket, and obituary/vital facts can show `Evidence found`; IDI contact review, skip-trace review, and governed manual/paid research remain blocked or manual until approval/review exists.
- Tax Collector detail parser addendum: listing/receipt HTML or text now extracts receipt link, paid-by party, paid date, amount due, unpaid years, and reassessment/status note. The UI has a visible reassessment field and prefers non-empty parsed facts over earlier placeholder/null facts.
- IDI import addendum: external-source runs now preserve confirmed source facts and accept approved IDI report-import evidence from Doc Prep. Imported IDI reports resolve the report-import detail, imported contacts stay manual until accepted/promoted, and report import does not prove paid-run approval without a live approved run or approval record.

## Dedicated Final Review Pass

/solvys-heir-audit
Source checked: `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf`, `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`, repo routes, local API proof, and headless Chrome proof.
Backward: S29 now has a unified external source-run route and a Doc Prep `Run Source Search` control. This supports the workflow steps for owner/property/deed/tax/probate/vital/IDI/manual research review by making every bucket visible, preserving source facts, and blocking incomplete buckets instead of filling legal/document blanks from assumptions.
UX pass: aligned with gaps. The operator can run the source search from Doc Prep and see public-record capture fields in the rail. The remaining gap is that browser-based Tax Collector and court/vital extraction still require production workflows before a non-technical user can complete Discovery without manual source work.
Forward: S30 must demo Discovery/Closing with the source-run blockers visible, not hidden. S31 must expose source/integration readiness in Settings. S32 must reject shipment unless Tax Collector browser workflow, IDI shared-default proof, and court/vital source workflows are either automated or explicitly accepted as human-required.
Alignment: aligned with gaps
Required corrections before complete:
- Do not claim all external Discovery sources are automated. They are callable/visible buckets with honest blockers.
- Implement/prove Browserbase or controlled Chrome for the Tax Collector public-search flow.
- Configure/prove Miami-Dade Clerk Commercial Data Services AuthKey for Official Records and Probate/Civil/Family Court, then inspect returned deed/docket facts against the source packets.
- Configure/prove the real `TAX_COLLECTOR_BROWSER_WORKFLOW_URL` Browserbase/Chrome endpoint against the public GovHub search flow.
- Configure/prove the real `OBITUARY_VITAL_WORKFLOW_URL` or equivalent controlled workflow against obituary, marriage-license, death-certificate, Findagrave/Legacy, and deceased-indicator pages.
- Configure/prove real IDI Core shared-default access before calling IDI production-ready.

## TP Checklist

- Run an estate from CRM import.
- Attempt Discovery without IDI and confirm it blocks.
- Run or attempt live IDI Core and confirm paid-run proof or exact blocker.
- Import an approved IDI report and accept a contact.
- Fill Closing required fields.
- Confirm Closing export blocks while a field is missing.
- Confirm Batch Queue describes one PDF artifact.
- Confirm the report rail header is `Preview` and the PDF does not bleed outside the card.
- Save a Tax Collector `Browser workflow blocked` status and confirm the Discovery tax phase does not complete until a receipt link or approved unavailable-after-check blocker exists.
- In Doc Prep, open `?view=dossiers&docprep=estate&rail=open&walkthrough=off&section=source-capture`, click `Run Source Search`, and confirm source summaries show returned facts plus blockers instead of blank fields.
- In Settings, confirm `Miami-Dade Clerk API` shows blocked until `MIAMI_DADE_CLERK_AUTH_KEY` is configured.
- In Settings, confirm `Vital/Obituary Workflow` shows blocked until `OBITUARY_VITAL_WORKFLOW_URL` or equivalent is configured.

## Final Dedicated Review After Source Repairs

Evidence rerun:

- `pnpm build`: passed.
- `pnpm test`: passed.
- `/api/discovery/external-source-run`: returned 8 source summaries.
- `/api/discovery/external-source-run` with Browserbase Function env and mocked Browserbase API: returned Tax Collector `listing_page_bottom_right`, a receipt link, vital `workflow_reviewed`, and date of death.
- `browserbase-functions` package check: passed.
- Vital/obituary route proof: `source_status.value.mode = workflow_required`, `VITAL_RECORDS_WORKFLOW_REQUIRED`.
- Source-governance route proof: `Governed manual and paid research` returned as blocked with voter records, professional licenses, business/address associations, social profiles, and deceased-indicator cross-checks in the catalog.
- `/api/connections/status`: `Miami-Dade Clerk API` and `Vital/Obituary Workflow` expose blocked readiness until their credentials/workflows are configured.
- UI route proof: Doc Prep route includes `Public-record capture`, `Run Source Search`, `Tax Collector listing page`, and `Preview`; stale `Live packet preview` copy is absent.
- UI action proof: headless Chromium clicked `Run Source Search` and showed `What this run proved` with operator-readable source proof rows; headless Chromium clicked `Run Full Discovery` and proved the preview document fits inside its card.
- IDI route proof: `user_override` personal-key runs are accepted and blocked only by missing vendor endpoint; shared-default runs are still blocked because no shared `IDI_CORE_API_KEY` is configured in this environment.
- Regression proof: `pnpm test` now includes the artifact source-run contract test and passed. Live `localhost:4183` route proof still returned eight source buckets, `readyForDiscoveryCompletion: false`, `legalTemplateAutofillAllowed: false`, Tax Collector receipt fact present, and IDI `evidence_required`.
- Cache proof: `pnpm test` passed after adding source-acquisition env vars to Turbo's `globalEnv`, and the artifact contract test now reports `source_acquisition_env_cache_key`.
- Receipt-selection proof: live `localhost:4184` source-capture returned `listing_page_bottom_right` and `tax_receipt_link: https://miamidade.county-taxes.test/receipts/2025-live.pdf` even with a later footer `Payment history` link present.
- Source-readiness proof: `pnpm --dir probate-lead-engine --filter @ple/artifact test` and `pnpm --dir probate-lead-engine test` passed with the new source-readiness contract. Local route proof on `localhost:4185` showed Tax Collector, Clerk, and Vital/Obituary blocked unless their specific acquisition path is configured, while IDI remained operator-portal review with user override allowed but no shared backend endpoint. Browser proof clicked `Run Source Search`, rendered 8 source-proof rows, and showed no raw env names or stale preview copy.
- Settings source-controls proof: browser proof on `localhost:4185/?view=settings&walkthrough=off` rendered the dedicated Tax Collector, Clerk Records, and Vital Sources cards plus source status rows for Tax Collector Source, Miami-Dade Clerk API, and Vital/Obituary Workflow with no raw env names, console errors, or failed requests.
- Source-language proof: after restarting `localhost:4185`, `/api/discovery/external-source-run` returned `Discovery source checks ran and returned review blockers...`, `hasBadApiClaim: false`, 8 source buckets, `readyForDiscoveryCompletion: false`, and `legalTemplateAutofillAllowed: false`. Browser proof clicked `Run Source Search` and found no `Discovery source APIs` claim in visible copy.
- Source-detail proof: after starting `localhost:4186`, `/api/discovery/external-source-run` returned 4 Tax Collector detail checks, 19 governed manual/paid detail checks, `hasBottomRightReceipt: true`, `requiredGovernanceVisible: true`, and `legalAutofillAllowedInDetails: false`. Browser proof clicked `Run Source Search` and rendered 33 source-detail rows with the packet-required manual/paid source families visible in operator language.
- IDI guardrail proof: after starting `localhost:4187`, `/api/discovery/external-source-run` returned `idiDetailCount: 5`, `idiRequiredVisible: true`, `skipTraceDetailCount: 2`, `skipTraceRequiredVisible: true`, and `allIdiBlockedFromAutofill: true`. `/api/discovery/idi-core/status` still showed operator-portal review mode with no backend endpoint/shared default key. Browser proof clicked `Run Source Search` and rendered the IDI and skip-trace guardrails without raw env names, fake API claims, console errors, or failed requests.
- Detail-readiness proof: after starting `localhost:4188`, `/api/discovery/external-source-run` returned `detailCheckCount: 40`, `blockingDetailCheckCount: 18`, `unresolvedDetailCheckCount: 18`, `readyForOperatorReview: false`, and `readyForDiscoveryCompletion: false`. Browser proof clicked `Run Source Search`, showed the source-checklist blocker count, and confirmed 40 real source-detail rows by DOM attribute.
- Captured-evidence proof: after starting local beta-review mode on `localhost:4191`, `/api/discovery/external-source-run` with captured Tax Collector, Property Appraiser, Official Records, probate docket, and obituary/vital facts returned `detailCheckCount: 40`, `blockingDetailCheckCount: 7`, `unresolvedDetailCheckCount: 7`, public/court/vital rows as `facts_returned_review_required`, IDI/skip trace as `evidence_required`, governed manual/paid research as `blocked`, and `legalTemplateAutofillAllowed: false`. Chrome DevTools proof clicked the real `Run Source Search` button, rendered 8 source rows and 40 detail rows, showed `Evidence found` for receipt/deed/probate/vital rows, kept IDI contact review manual, and recorded no console or network failures.
- Tax Collector parser proof: route proof on `localhost:4191` using only Tax Collector listing HTML returned the bottom-right receipt URL, paid-by party, paid date, amount due object, unpaid years, and reassessment note while leaving legal-template autofill false. Chrome DevTools proof filled only listing URL plus listing HTML, clicked `Run Source Search`, and saw the visible receipt, payer, date, amount, unpaid-year, and reassessment fields populate with no console or network failures.
- IDI import/contact-review proof: route proof on `localhost:4192` showed imported-only IDI evidence resolving `idi_report_import` while leaving `idi_contact_review = manual_review_required`, `idi_paid_run_approval = approval_required`, and `legalTemplateAutofillAllowed = false`; accepting the contact resolved only contact review; a live-approved payload resolved paid approval. Clean Chrome DevTools proof imported an IDI report, clicked `Run Source Search`, saw contact review stay `Manual`, accepted the contact, saw contact review change to `Evidence found`, kept paid approval at `Approval`, and recorded no console or network failures.

S29-S32 plan check:

- S29 Doc Prep source architecture: aligned with gaps. Source buckets are callable, visible, persisted, and blocker-safe; real production proof still requires configured IDI API, Clerk AuthKey, Tax Collector browser workflow, and vital/obituary workflow.
- S30 demo readiness: not accepted as final until the demo shows the blocked/ready source states and generated packet streaming without placeholders. The route/UI hooks needed for the demo exist.
- S31 readiness: Settings now exposes the key source-readiness blockers, but full Outreach/auth/button audit remains S31 work.
- S32 final objective audit: must reject any claim that all external Discovery sources are automated until credentialed/live proof is attached or the source is explicitly accepted as human-required.

/solvys-heir-audit
Source checked: `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf`, `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`, source-run API proof, Browserbase mock route proof, Settings status proof, route-level UI proof, and current git diff/status.
Backward: The work changed Discovery Doc Prep from a partial UI/source-capture story into a source-run architecture with eight visible buckets: Property Appraiser, Tax Collector, Official Records, Probate/Civil/Family Court, vital/obituary, IDI, skip trace, and governed manual/paid research. It now includes direct Browserbase Function paths plus deployable function sources for Tax Collector and vital/obituary, supporting the packet's property/deed/tax/probate/vital/IDI/manual-research steps by saving facts or explicit blockers instead of blank implied completion.
UX pass: aligned with gaps. Operators get a `Run Source Search` control, source-readiness preflight, source summaries, readiness statuses, plain blocker language, a deterministic source-capture proof route that opens the correct workflow, and a backend proof ledger that makes completion blockers auditable. The remaining UX gap is live workflow completion: without real workflow endpoints and credentials, a non-technical operator still has source work to finish manually.
Forward: S30 must demo the real flow with these blockers visible and document streaming; S31 must complete Settings/Outreach/auth readiness; S32 must audit against live PDF outputs and browser/API proof.
Alignment: aligned with gaps
Required corrections before complete:
- Configure and prove `IDI_CORE_API_URL`, shared `IDI_CORE_API_KEY`, and live approval or keep IDI as import/operator-approved.
- Configure and prove `MIAMI_DADE_CLERK_AUTH_KEY` against Official Records and Civil/Family/Probate.
- Deploy/configure and prove the real Tax Collector Browserbase Function against the public GovHub listing/receipt flow.
- Deploy/configure and prove the real vital/obituary Browserbase Function against obituary, marriage-license, death-certificate, Findagrave/Legacy, and deceased-indicator pages.
- Do not tell TP that all external sources are automated; tell them which ones are automated, which are workflow-ready, and which are approval-gated.
