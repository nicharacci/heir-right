# S2 Brief: Asset-First Discovery And IDI Contact Enrichment

## Objective

Make Discovery work from the estate asset first. Operators confirm owner details, capture tax receipt/deed/obituary evidence, then import exactly one IDI Core expanded asset-search result for that property address. The import fills spouse and children as primary secondary contacts, keeps remaining relatives and associates visible as Alternative Contacts, and only raises dossier status after operator contact review.

## Locked Assumptions

- IDI is operator-import first. No background IDI cron, no per-person paid lookup automation, and no repeated paid runs in this sprint.
- The IDI run guard is keyed by normalized address, owner last name, and provider. A duplicate import is blocked unless an admin override reason is recorded.
- Raw IDI attachments can be stored as review artifacts. Score/status movement happens after accepted contact candidates, not raw import alone.
- Column ordering is local-only unless a user persistence layer is already present.
- Public-record capture supports manual fallback when county pages cannot be machine-read.

## Product Loop

1. Owner Details: confirm the estate address, owner name, folio, and owner stop rules.
2. Tax Receipt: attach the last paid receipt and capture the paid-by party from the Tax Collector record.
3. Deed: attach the latest deed or source link and capture OR book/page or instrument.
4. Obituary: attach screenshot/link when found, or record reviewed-not-found.
5. IDI Asset Search: import one expanded asset-search report by property address.
6. Contact Review: accept/reject/promote spouse, children, relatives, and associates.
7. Dossier Export: prepare Podio fields, Google Docs body, and Google Sheets row after review gates clear.

## Implementation Notes

- Shared types now include IDI source facts, source attachment refs, and contact candidate shapes.
- Artifact local endpoints provide development-safe wrappers for IDI import, source capture, and contact candidate review.
- Estate Search and Dossiers default to address-first tables with draggable column order persisted in local storage.
- The Dossier rail owns the document packet loop; the report rail remains out of the Dossier tab.
- Completed report output includes a table of contents, captured source evidence, primary secondary contacts, Alternative Contacts, Podio fields, and Google Sheets row shape.

## Validation Gates

- Importing one IDI asset-search report creates primary and alternative contact candidates.
- A second IDI import for the same asset is blocked without an admin override reason.
- Accepting a contact updates score/status and marks Contact Review complete.
- Capturing tax receipt, deed, and obituary evidence updates the Discovery checklist and rendered dossier documents.
- Dragging table columns persists after reload for Estate Search and Dossiers.
- Artifact and worker builds pass before deploy.
