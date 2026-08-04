# S41 Estate-to-Packet Cloud Process Progress

Date: 2026-08-03  
Branch: `2026-08-03`  
Plan: `sprint-md/S41-T5-product-unification-production-proof.md`

## Outcome in the integration lane

The Estate Search to Doc Prep handoff now creates a durable document-preparation case through an authenticated server proxy. Case lifecycle, idempotency, optimistic revisions, append-only events, worker handoff, retry/cancel controls, and verified-PDF completion belong to the process service rather than a browser queue or timer.

## Delivered checkpoints

- `fb8a5b1`: durable case contract, migration, in-memory conformance tests, and verified-PDF rule.
- `4689545`: Hono process API and Postgres repository adapter.
- `856960d` and `3a85fd0`: R2 readback worker, transactional outbox, and pg-boss execution queue with stale-claim recovery.
- `27122e4` and `5d29a39`: authenticated artifact proxy, server-owned actor identity, stable idempotency, case hydration, retry/cancel controls, and removal of the 680ms browser process sequencer.
- `45733e1` and `3595fe7`: typed durable schema, repository readiness probe, request size bound, and API actor normalization.
- `fc019a2`: isolated API/worker Docker and Fly manifests plus a Cloud smoke command that refuses controlled-estate intake until an explicit approval variable is present.

## Fresh local proof

- `pnpm --filter @ple/artifact build`
- `node apps/artifact/test/s41-docprep-route-auth.test.mjs`
- `node apps/artifact/test/s37-product-loop-e2e.test.mjs`
- `pnpm --filter @ple/docprep-core test`
- `pnpm --filter @ple/docprep-api test`
- `pnpm --filter @ple/docprep-worker test`
- `node scripts/s41-cloud-smoke.test.mjs`

The tests prove request ownership, idempotent intake, retry/cancel revision handling, durable case hydration contract, outbox recovery, source blockers, and PDF SHA-256 readback. They do not represent a deployed case or real-estate result.

## Remaining production gates

- Apply `packages/docprep-core/migrations/0001_docprep_process.sql` to the approved managed Postgres instance.
- Set the named process, database, R2, and existing Worker environment variables in the approved provider stores. No values belong in the repository.
- Build/deploy the API and worker with the Docker/Fly manifests, then run `PROCESS_API_URL=... node scripts/s41-cloud-smoke.mjs`.
- Configure the artifact process URL/token in the approved deployment, authenticate an approved operator, and run a controlled estate only after `S41_CONTROLLED_ESTATE_APPROVED=approved` is intentionally supplied.
- Confirm an R2 object readback, verified PDF open, restart behavior, cancel behavior, and export eligibility in the deployed surface.

## Execution caveat

The original S41 checkpoint refs were unavailable, so work continued from the current `2026-08-03` integration checkout under the user-authorized workaround. The external canonical checkout remains read-only and untouched. Docker is installed but its daemon is unavailable on this workstation, whose data volume has about 8 GiB free; container-image proof remains a Cloud gate rather than a local claim.
