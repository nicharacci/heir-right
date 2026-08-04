# S41 process deployment contract

Deploy the API and worker only after the approved provider records exist. Keep every value in its provider secret store; this file names variables only.

## API service

The Fly API service uses the repository-root `fly.toml` (or `deploy/heirright-process/fly.api.toml` for a named config) and needs:

- `DATABASE_URL`
- `HEIRRIGHT_PROCESS_API_TOKEN`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `GOOGLE_WORKSPACE_ACCESS_TOKEN`
- `GOOGLE_DRIVE_PARENT_FOLDER_ID` when exports belong in a specific shared folder

The API exposes readiness at `/readyz`. It reads verified PDFs from the private R2 bucket by object key, checks the source bytes and SHA-256, then reads Drive PDF metadata and checksum back. A durable claim ledger allows one upload owner for each case/PDF hash, rejects concurrent duplicate uploads, and reuses a completed verified Drive file on later requests.

## Worker service

The Fly worker uses `fly.worker.toml` (or `deploy/heirright-process/fly.worker.toml` for a named config) and needs:

- `DATABASE_URL`
- `HEIRRIGHT_WORKER_URL`
- `HEIRRIGHT_DOC_PREP_SOURCE_TOKEN`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

The worker reads the persisted Discovery File, retrieves or renders a Discovery PDF through the existing source authority, verifies PDF bytes, writes to private R2, reads the object back, and only then records `packet_ready`. R2 must not have a public bucket domain or public development URL enabled.

## Artifact service

The existing authenticated artifact deployment needs:

- `HEIRRIGHT_PROCESS_API_URL`
- `HEIRRIGHT_PROCESS_API_TOKEN`

It forwards the signed operator identity to the process API. The browser never holds the process token or receives a storage URL: verified PDFs open and download only through the authenticated artifact proxy.

## Controlled production smoke

1. Apply `packages/docprep-core/migrations/0001_docprep_process.sql`, then `packages/docprep-core/migrations/0002_docprep_drive_exports.sql`, to the selected production Postgres database.
2. Deploy API and worker, then set the artifact service process URL/token and redeploy it.
3. Run `PROCESS_API_URL=<api-url> node scripts/s41-cloud-smoke.mjs` for health/readiness/auth proof.
4. Only for the named approved estate, set `S41_CONTROLLED_ESTATE_APPROVED=approved`, `S41_SMOKE_ACTOR_EMAIL`, and `S41_SMOKE_ESTATE_JSON`. The smoke then requires the terminal `packet_ready` state and a matching PDF byte/hash readback.
5. Set `S41_VERIFY_GOOGLE_DRIVE=approved` only when the single approved estate may create its separate Drive PDF. This adds Drive readback proof.

Do not place estate payloads, API tokens, R2 credentials, or Google tokens in source control or receipts.
