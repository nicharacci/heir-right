# Sprint Brief: S17-T1 -- Property + Tax Extraction Path

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Turn official property and tax checks into structured facts that operators can review.

## Scope

- Upgrade property and tax adapters from reachability/placeholders toward extracted values where official surfaces allow it.
- Capture folio/property identity, mailing address, ownership, latest tax status, receipt/payment signal, reassessment signal, and source timestamp.
- Preserve review flags where the public source blocks extraction.

## Out Of Bounds

- Paid-source scraping.
- Claiming tax or owner facts without source evidence.
- Browser-assisted extraction without a repeatable adapter boundary.

## Validation

```bash
cd probate-lead-engine
pnpm --filter @ple/worker test
pnpm --filter @ple/worker run:daily
```
