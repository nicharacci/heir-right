# S44 T1 Cloud custody and encrypted hold contract

## Pickup identity

- Sprint: `S44 - Doc Prep Sandbox`
- Track and checkpoint: `T1`, `refs/sprints/S44/T1/P1`
- Execution lane: repository-backed Codex Cloud
- Controlling Cloud environment ID, canonical 32-character form: `bba3fc131846ddc7a9e33ec395b6a40a`
- Environment label: `S44 T1 secure artifact hold`
- Repository: `nicharacci/heir-right`
- Exact base: `8edb4517b5042d5b02a166b0d8118d97e922e1f0`
- Checkout mode: clean detached checkout
- Publication route: HTTPS `origin` at `https://github.com/nicharacci/heir-right.git`, publishing the exact detached checkpoint to `refs/sprints/S44/T1/P1` when the host GitHub credential is valid.
- Owner: S44 sandbox custody setup

## Seven-day artifact hold

`scripts/s44-artifact-hold.mjs` owns the task-only hold lifecycle. It accepts one regular file up to 100 MiB through explicit absolute paths, encrypts it with AES-256-GCM using the sandbox-only `S44_ARTIFACT_HOLD_KEY`, and writes a mode `0600` ciphertext plus a mode `0600` manifest inside a mode `0700` task-owned directory. The source filename and content are absent from the manifest. Transient plaintext inputs and bounded restore outputs remain task-owned, must stay outside the repository, and must be removed immediately after seal or readback by the calling workflow.

Every seal records its own UTC `createdAt`, exact UTC `expiresAt`, and fixed `retentionSeconds: 604800`. Those fields, the hold ID, byte count, digest, and ciphertext filename are authenticated as AES-GCM additional data. Changing the expiry invalidates restoration. Restore is blocked at or after `expiresAt`. `purge-expired` refuses an active hold and removes only the exact ciphertext and manifest named by an expired, validated manifest.

The task owner must run expiry cleanup at the recorded time or at the first task wake after it. Cloud task closure must purge any remaining task-owned hold pair before archive. No hold may be copied to production storage, provider storage, a Git object, or an unencrypted local path. A hold is complete only after a successful bounded restore/readback or a verified expiry purge. The generated hold directory is ignored by Git as a second guardrail.

The validation fixture records this exact lifecycle without retaining an artifact:

- Proof `createdAt`: `2026-08-07T12:00:00.000Z`
- Proof `expiresAt`: `2026-08-14T12:00:00.000Z`
- Retention: `604800` seconds
- Payload classification: synthetic sandbox-only text
- Provider or estate data: none
- Restore: byte-for-byte verified before expiry
- Expiry enforcement: restore refused at expiry
- Cleanup: encrypted hold pair removed; temporary proof directory removed by the test harness

The live S44 sandbox receipt records only a file classification, byte count, SHA-256 digest, hold timing, and successful bounded readback. It never records a source filename, artifact content, or estate identity.

## Secret-name manifest

- Sandbox secret: `S44_ARTIFACT_HOLD_KEY`
- Host-provided publication credential variable inspected without disclosure: `GITHUB_TOKEN`
- The successful GitHub CLI host credential is outside the repository secret manifest and is used only by the HTTPS Git transport.
- No secret value may appear in source, logs, manifests, fixtures, commits, refs, or receipts.

Excluded credentials and data categories: production provider credentials, Podio credentials or tokens, Google Workspace credentials or tokens, IDI credentials, skip-trace credentials, Browserbase credentials, Cloudflare credentials, Fly credentials, Vercel credentials, database credentials, auth/session secrets, estate PII, client documents, and production queue payloads.

## Protected zones and authority

Protected and unchanged: `main`, all existing refs, the production queue, production providers, frontend source, authentication and authorization, deployment configuration, database state, and HeirRight legal workflow semantics. This track authorizes no provider run, no production credential materialization, no deployment, no merge, no date-branch mutation, and no frontend change.

Installation foundation disposition: BeUI, Vercel UI, Bklit, and EvilCharts are each `not applicable`. This is policy and backend custody tooling. Adding a UI dependency would cross the protected frontend zone without solving the custody problem.

## Proof commands

From `probate-lead-engine/`:

```sh
pnpm test:s44-hold
```

Operational use requires the sandbox secret in the environment and explicit task-owned paths:

```sh
node scripts/s44-artifact-hold.mjs seal --input /absolute/task-owned/artifact --output-dir /absolute/task-owned/holds
node scripts/s44-artifact-hold.mjs inspect --manifest /absolute/task-owned/holds/HOLD_ID.manifest.json
node scripts/s44-artifact-hold.mjs restore --manifest /absolute/task-owned/holds/HOLD_ID.manifest.json --output /absolute/task-owned/restore
node scripts/s44-artifact-hold.mjs purge-expired --manifest /absolute/task-owned/holds/HOLD_ID.manifest.json
```

The variable value must remain inside the Cloud secret boundary. Receipts record the variable name only.
