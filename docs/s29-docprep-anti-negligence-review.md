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

## Remaining Proof Required

- A real live IDI Core backend run still requires `IDI_CORE_API_URL`, the shared default `IDI_CORE_API_KEY`, and approval in the target environment. Current proof shows operator portal/import mode only, with user override allowed.
- A production Browserbase/Chrome Tax Collector workflow still needs to be implemented and proven against the real public-search flow. Current proof preserves the blocker and parses reachable listing pages; it does not claim the GovHub browser run is automated end to end.
- Google/Podio live write and readback still require configured credentials and approval.
- Browser E2E and PDF inspection must be rerun after any additional source-flow or preview changes.

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
