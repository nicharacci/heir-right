# HeirRight Live Leads Run Point - 2026-06-23

## Goal

Repair the lead engine so a real operator can request a fresh external lead batch with the current filters, see the resulting leads in the product shell, and audit at least one non-placeholder/non-HeirRight-file lead from an external public source.

## Current Status

- Branch: `v2.5.3/heirright-live-leads-2026-06-23`
- Baseline verdict: existing live-lead claim was not true; the prior loop used review seeds/source-health checks.
- Architecture status: backend/API/UI fresh-batch loop implemented.
- Live source: Miami-Dade Property Appraiser public service.
- External proof lead: `ANNIE HAWKINS EST OF`, `131 NW 67 ST, Miami, FL 33150-0000`, folio `01-3113-008-0130`.
- Placeholder/sample guard: persisted live batch contains no `MOREAU`, no `AMARANTHE`, and no `Fresh public-source lead`.

## Tests So Far

- `pnpm build` - passed.
- `pnpm --filter @ple/worker fresh:batch -- --owner="EST OF" --limit=3` - passed, persisted `fresh-lead-batch.json`, `latest-run.json`, `daily-run.json`, and qualification review files.
- Output proof: `acceptedSeedCount: 3`, `externalRecordCount: 40`, first lead source URL is a Miami-Dade Property Appraiser folio detail endpoint.
- Artifact API proof: `POST http://localhost:4174/api/leads/fresh-batch` returned `ok: true`, `acceptedSeedCount: 3`, `leadRuns: 3`, three unique folios, and no sample/placeholder strings.
- Browser proof: Playwright via installed Google Chrome clicked `Pull fresh leads`; UI rendered `3 results` for three distinct live leads: `ANNIE HAWKINS EST OF` / `131 NW 67 ST` / `01-3113-008-0130`, `ARTHIA BRYANT EST OF / TERESSA BROWN` / `249 NW 56 ST` / `01-3113-048-0400`, and `CHUSA SYLVESTRE / MYRLINE ARISTIL / DIEULA ALBIN EST OF` / `131 NW 70 ST` / `01-3113-039-0080`, with `Web Search · Live` and no console errors.
- Mobile smoke: `390x844` viewport showed the fresh-batch controls with no horizontal overflow.
- `pnpm --filter @ple/worker test` - passed.
- `pnpm --filter @ple/artifact test` - passed.
- `git diff --check` - passed.
- Final persisted output restored with `pnpm --filter @ple/worker fresh:batch -- --owner="EST OF" --limit=3`.

## Remaining Before Done

- Final review pass and commit.
