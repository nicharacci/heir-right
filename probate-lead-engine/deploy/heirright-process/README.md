# S41 process deployment contract

Deploy the API and worker only after the approved provider records exist. Keep every value in its provider secret store; this file names variables only.

## API service

The Fly API service uses `deploy/heirright-process/fly.api.toml` and needs:

- `DATABASE_URL`
- `HEIRRIGHT_PROCESS_API_TOKEN`
- `GOOGLE_WORKSPACE_ACCESS_TOKEN`
- `GOOGLE_DRIVE_PARENT_FOLDER_ID` when exports belong in a specific shared folder

The API exposes readiness at `/readyz`. Its Google Drive route accepts only durable cases with a verified R2 PDF, checks the source bytes and SHA-256, then reads the Drive PDF metadata and checksum back. A repeated request for the same case and content hash reuses the prior verified Drive file.

## Worker service

The Fly worker uses `deploy/heirright-process/fly.worker.toml` and needs:

- `DATABASE_URL`
- `HEIRRIGHT_WORKER_URL`
- `HEIRRIGHT_API_TOKEN`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`

The worker reads the persisted Discovery File, retrieves or renders a Discovery PDF through the existing source authority, verifies PDF bytes, writes to R2, reads the object back, and only then records `packet_ready`.

## Artifact service

The existing authenticated artifact deployment needs:

- `HEIRRIGHT_PROCESS_API_URL`
- `HEIRRIGHT_PROCESS_API_TOKEN`

It forwards the signed operator identity to the process API. The browser never holds the process token.

## Controlled production smoke

1. Apply `packages/docprep-core/migrations/0001_docprep_process.sql` to the selected production Postgres database.
2. Deploy API and worker, then set the artifact service process URL/token and redeploy it.
3. Run `PROCESS_API_URL=<api-url> node scripts/s41-cloud-smoke.mjs` for health/readiness/auth proof.
4. Only for the named approved estate, set `S41_CONTROLLED_ESTATE_APPROVED=approved`, `S41_SMOKE_ACTOR_EMAIL`, and `S41_SMOKE_ESTATE_JSON`. The smoke then requires the terminal `packet_ready` state and a matching PDF byte/hash readback.
5. Set `S41_VERIFY_GOOGLE_DRIVE=approved` only when the single approved estate may create its separate Drive PDF. This adds Drive readback proof.

Do not place estate payloads, API tokens, R2 credentials, or Google tokens in source control or receipts.
