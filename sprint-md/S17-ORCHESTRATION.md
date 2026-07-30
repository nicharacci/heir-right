# Sprint Brief: S17-ORCH -- Structured Source Extraction Upgrade

Owner: TP
Beta phase: 30-Day Acceptance
Branch: `v2.4.1/heirright-2026-06-16-run-point`
Project: HeirRight Deal Engine Automation

## Goal

Move from source reachability to structured source facts for Miami-Dade property, tax, deed/title, and probate/court signals.

## Tracks

| Track | Title | Brief |
| --- | --- | --- |
| S17-T1 | Property + Tax Extraction Path | `@sprint-md/S17-T1-property-tax-extraction-path.md` |
| S17-T2 | Official Records + Deed Extraction Path | `@sprint-md/S17-T2-official-records-deed-extraction-path.md` |
| S17-T3 | Probate + Court Extraction Path | `@sprint-md/S17-T3-probate-court-extraction-path.md` |

## Acceptance

- A meaningful share of the approved small batch has extracted property identity, tax status, deed/title, and probate/case facts with source references.
- Reports show fewer placeholder missing sections for extracted records.
- Source-health-only facts are not treated as evidence.
- Paid/manual sources and legal heirship conclusions remain approval-gated.
