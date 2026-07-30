# Sprint Brief: S17-T3 -- Probate + Court Extraction Path

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Capture probate/court signals separately from legal conclusions so operators know what still needs human review.

## Scope

- Extract case number, case status, document availability, affidavit-of-heirs status, and docket links for estate or case-number seeds.
- Track civil, family, probate, and official-record cross-checks as separate evidence areas.
- Preserve missing or blocked court records as review work.

## Out Of Bounds

- Inferring heirship from weak public signals.
- Automated legal conclusions.
- Paid/manual source automation without approval.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:daily
```
