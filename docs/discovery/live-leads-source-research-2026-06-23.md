# Live Leads Source Research - 2026-06-23

## Verdict

The prior claim that the existing demo already supported live fetched leads was false. The old loop could run review seeds and source-health checks, but it could not let an operator request a fresh external batch from the current filters.

Live external lead intake is feasible for Miami-Dade property/ownership facts through the public Property Appraiser service. It is not yet feasible to claim live probate qualification from the Official Records API alone, because the probate document search flow is browser/recaptcha gated. The product must therefore pull real property candidates, attach source-backed property/deed facts, and leave probate/tax/family-tree gaps in review.

## Source Ledger

- Official public search surface: https://www.miamidade.gov/pa/property_search.asp
- Candidate search used by implementation: `https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx?Operation=GetOwners&ownerName=EST+OF&from=1&to=40&clientAppName=PropertySearch`
- Detail record used for proof: `https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx?Operation=GetPropertySearchByFolio&folioNumber=0131130080130&clientAppName=PropertySearch`
- Official Records document type check confirmed probate document types exist, but standard search submission expects the application flow and recaptcha token; no backend-only probate pull is represented as production-ready.

## Falsifying Checks

- Baseline `run:daily` used `default_review_seeds`, not live external candidates.
- Baseline `run:dry` used CLI-provided seed data and source-health facts, not a fresh public source lead.
- The known HeirRight example folio `3421080072710` is excluded from fresh-source proof batches.
- Persisted live proof on this pass contains no `MOREAU`, no `AMARANTHE`, and no `Fresh public-source lead`.

## Implemented Product Loop

- Automatic filters still update the current in-memory lead list.
- The new `Pull fresh leads` action snapshots the current county/source/search/limit filters.
- The backend calls Miami-Dade Property Appraiser live public endpoints, normalizes candidates, excludes company/entity owners by default, enriches accepted folios, and feeds the existing daily/dossier/qualification pipeline.
- The run persists `fresh-lead-batch.json`, `latest-run.json`, `daily-run.json`, and qualification review outputs for audit.

## Live Proof Snapshot

- Command: `pnpm --filter @ple/worker fresh:batch -- --owner="EST OF" --limit=3`
- Result: `acceptedSeedCount: 3`, `externalRecordCount: 40`, `ok: true`
- First external lead: `ANNIE HAWKINS EST OF`, `131 NW 67 ST, Miami, FL 33150-0000`, folio `01-3113-008-0130`
- Source URL: `https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx?Operation=GetPropertySearchByFolio&folioNumber=0131130080130&clientAppName=PropertySearch`
- Qualification status: review required, because tax/probate/family-tree/contact evidence remains unconfirmed.
