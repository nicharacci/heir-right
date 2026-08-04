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
- `657ac09`: source-to-PDF readback repair, durable queue status surface, individual download, and verified Google Drive PDF export path.
- `e334719`: idempotent Google Drive export keyed to the durable case and verified PDF hash.

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
- Build/deploy the API and worker with the Docker/Fly manifests, then run `PROCESS_API_URL=... node scripts/s41-cloud-smoke.mjs`. The explicitly approved branch now requires `packet_ready`, PDF byte/hash readback, and optionally the Drive readback before it reports success.
- Configure the artifact process URL/token in the approved deployment, authenticate an approved operator, and run a controlled estate only after `S41_CONTROLLED_ESTATE_APPROVED=approved` is intentionally supplied.
- Confirm an R2 object readback, verified PDF open, restart behavior, cancel behavior, and export eligibility in the deployed surface.

## Execution caveat

The original S41 checkpoint refs were unavailable, so work continued from the current `2026-08-03` integration checkout under the user-authorized workaround. The external canonical checkout remains read-only and untouched. Docker is installed but its daemon is unavailable on this workstation, whose data volume has about 8 GiB free; container-image proof remains a Cloud gate rather than a local claim.

## Final review

- Re-ran `pnpm turbo run build --force` and `pnpm turbo run test --force` after the retry-delivery repair: all 6 build packages and all 11 test tasks passed without remote cache reuse.
- Re-ran `pnpm audit --prod`: no known vulnerabilities remain after upgrading the affected Drizzle, Hono Node adapter, and DOMPurify resolutions.
- Inspected the deployed `surface.heirright.com` Document Prep view in the Codex in-app browser. Its signed-in production session loads, navigation to Document Prep works, and the existing surface correctly shows a disabled run control while its source evidence is incomplete. It does not contain this un-deployed S41 process API, so it is evidence of the current deployed boundary, not S41 live acceptance.
- Re-read the added UI behavior against the project design canon: the change reuses the existing Doc Prep control language, keeps the rare process state as plain status text, avoids fabricated success, requires a real verified PDF before the open action appears, and leaves review/legal blocks explicit. No new visual metaphor, font, palette, animation, or generic component system was introduced.
- The final source review found and repaired retry delivery before acceptance. Retry now writes a new durable outbox event, and lifecycle changes update durable steps. No unresolved source-level control or fake-completion issue remains in the implementation lane.
