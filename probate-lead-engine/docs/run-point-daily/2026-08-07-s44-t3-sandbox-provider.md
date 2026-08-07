# S44 T3 sandbox provider and PDF evidence contract

## Ownership and starting point

- Sprint: `S44 - Doc Prep Sandbox`
- Track: `T3 worker, sandbox provider, and PDF evidence`
- Starting checkpoint and commit: `refs/sprints/S44/T2/P1` at `48a5372400e1ac8c2f45edfcfdd522353b5a0779`
- Target checkpoint: `refs/sprints/S44/T3/P1`
- Date integration branch: `2026-08-06`
- Owner: worker/provider/PDF evidence pipeline
- Repository-backed Codespace: `s44-t1-doc-prep-sandbox-q75qpjg4wg4436474`
- Environment label: `S44 T1 Doc Prep Sandbox`
- Repository attachment: `nicharacci/heir-right`

## Sandbox-only boundary

`apps/worker/src/doc-prep/sandbox-provider.ts` contains no network client and cannot select a production provider. The caller injects a provider whose response must declare `providerMode: sandbox`. Before that provider is called, the boundary requires active authorization evidence with the exact `s44:michelet-idi:doc-prep` scope, the complete sandbox credential-name manifest, and a bounded authorization window.

The designated Michelet IDI input crosses the port only after its MIME type, byte count, SHA-256, PDF header, and PDF trailer match supplied evidence. Receipts omit input and artifact bytes and record hashes and counts only.

No external provider run is authorized by this checkpoint. The real opened-PDF provider receipt remains pending until an authorization receipt is supplied. Tests use synthetic PDFs and an in-memory provider port. They perform no network request.

## Sandbox credential-name manifest

- `S44_IDI_SANDBOX_API_URL`
- `S44_IDI_SANDBOX_API_TOKEN`
- `S44_IDI_SANDBOX_RUN_AUTHORIZATION`
- `S44_ARTIFACT_HOLD_KEY`

No credential value belongs in source, fixtures, logs, commits, refs, or receipts.

Excluded credentials and categories: all `IDI_CORE_*` production values, `HEIRRIGHT_IDI_CORE_API_TOKEN`, production provider/admin credentials, production queue credentials and payloads, Podio values, Google Workspace values, Browserbase values, Cloudflare values, Fly values, Vercel values, database credentials, authentication/session secrets, estate PII beyond the user-designated Michelet input, and unrelated client data.

## PDF and encrypted-hold evidence

The boundary accepts only `application/pdf`. It computes byte count and SHA-256 directly from returned bytes, checks `%PDF-` plus `%%EOF`, and runs an opened-PDF verifier. The default verifier loads bytes with repo-owned `pdf-lib` and requires at least one page. The verifier is injectable for a higher-reality authorized provider readback.

Success is impossible until the hold port returns AES-256-GCM encryption, exact artifact byte/hash match, `604800` retention seconds, expiry exactly seven days after creation, and a validated 32-character lowercase hexadecimal hold ID.

The focused test adapts T1's `scripts/s44-artifact-hold.mjs` into the hold port. It seals the verified PDF, restores and opens exact bytes, enforces expiry, purges ciphertext and manifest, and removes transient plaintext. Test secrets are generated in memory and never printed.

## Proof gates

```sh
pnpm test:s44-provider
pnpm test:s44-durable
pnpm test:s44-hold
pnpm lint
git diff --check
```

The boundary proof shows zero provider, PDF-open, and hold calls when authorization evidence is absent. Deterministic proof records exact MIME, byte count, SHA-256, one-page open receipt, encrypted hold, byte-for-byte restore, and verified purge.

## Protected zones

Protected and unchanged: `main`, all pre-existing refs, production queue, production providers and credentials, frontend source, authentication and authorization, deployment configuration, database state, and HeirRight legal workflow semantics. This track performs no deployment, merge, date-branch mutation, live provider request, production queue action, or frontend change.

Installation foundation disposition: BeUI, Vercel UI, Bklit, and EvilCharts are each `not applicable`. Adopted blocks are T2 durable authority, T1 AES-256-GCM hold, Node SHA-256, and installed `pdf-lib`.
