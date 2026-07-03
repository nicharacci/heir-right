# S29 Doc Prep Anti-Negligence Review

Date: 2026-07-03

## Reviewer Posture

Assume every AI-built completion claim is false until the app proves it with source evidence, persisted state, route output, and a visible operator-facing blocker when something is not ready.

## What Changed

- IDI now has two explicit modes: `live_idi_core` for controlled paid runs and `operator_import` for approved report imports.
- Missing IDI access or approval blocks with a human-readable message.
- Discovery cannot auto-complete tax, deed, obituary, IDI, or contact-review phases without evidence.
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

## Remaining Proof Required

- A real live IDI Core run still requires vendor credentials and approval in the target environment.
- Google/Podio live write and readback still require configured credentials and approval.
- Browser E2E and PDF inspection must be run after build.

## TP Checklist

- Run an estate from CRM import.
- Attempt Discovery without IDI and confirm it blocks.
- Run or attempt live IDI Core and confirm paid-run proof or exact blocker.
- Import an approved IDI report and accept a contact.
- Fill Closing required fields.
- Confirm Closing export blocks while a field is missing.
- Confirm Batch Queue describes one PDF artifact.

