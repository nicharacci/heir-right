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
- Public-source acquisition contracts now name the expected Property Appraiser, Tax Collector receipt, Official Records deed/title, Probate Court, and obituary/vital review stages.
- `/api/discovery/external-source-run` now gives Doc Prep one callable source-run surface across worker, local artifact server, and serverless fallback. It returns all required Discovery source buckets, source facts, and blockers without marking missing sources complete.
- Doc Prep now has an operator-facing `Run Source Search` control in the public-record capture panel. It writes back returned source facts, Tax Collector browser blockers, receipt links, and source summaries into the estate-scoped capture state.
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

## Remaining Proof Required

- A real live IDI Core backend run still requires `IDI_CORE_API_URL`, the shared default `IDI_CORE_API_KEY`, and approval in the target environment. Current proof shows operator portal/import mode only, with user override allowed.
- A production Browserbase/Chrome Tax Collector workflow still needs to be implemented and proven against the real public-search flow. Current proof preserves the blocker and parses reachable listing pages; it does not claim the GovHub browser run is automated end to end.
- Live system-Chrome proof reached Cloudflare security verification at the public GovHub entry, confirming pure script is not enough from the public search URL.
- Official Records, Probate/Civil/Family Court, marriage/death/obituary/vital sources, and skip trace are represented in the source-run contract but still need extraction/browser workflows or explicit operator-review completion proof before anyone can say the external-source Discovery workflow is fully automated.
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

## Dedicated Final Review Pass

/solvys-heir-audit
Source checked: `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf`, `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`, repo routes, local API proof, and headless Chrome proof.
Backward: S29 now has a unified external source-run route and a Doc Prep `Run Source Search` control. This supports the workflow steps for owner/property/deed/tax/probate/vital/IDI review by making every bucket visible, preserving source facts, and blocking incomplete buckets instead of filling legal/document blanks from assumptions.
UX pass: aligned with gaps. The operator can run the source search from Doc Prep and see public-record capture fields in the rail. The remaining gap is that browser-based Tax Collector and court/vital extraction still require production workflows before a non-technical user can complete Discovery without manual source work.
Forward: S30 must demo Discovery/Closing with the source-run blockers visible, not hidden. S31 must expose source/integration readiness in Settings. S32 must reject shipment unless Tax Collector browser workflow, IDI shared-default proof, and court/vital source workflows are either automated or explicitly accepted as human-required.
Alignment: aligned with gaps
Required corrections before complete:
- Do not claim all external Discovery sources are automated. They are callable/visible buckets with honest blockers.
- Implement/prove Browserbase or controlled Chrome for the Tax Collector public-search flow.
- Implement/prove Official Records, Probate/Civil/Family Court, and vital/obituary extraction or keep them as explicit operator-review steps.
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
