# S41 - Estate-to-Packet Cloud Process

## Track T4 - Fly Runtime And Cloud Proof Harness

## Problem And Solution

- **Original Problem**: A local script or unit test cannot make document prep reliable for the team. API, worker, database, and files must run continuously in the cloud with repeatable operational proof.
- **Solution**: Estate-to-Packet Cloud Process.
- **Outcome Objective**: Deliver Estate-to-Packet Cloud Process so HeirRight can run Hono and the document worker on Fly with managed PostgreSQL, R2, health checks, migrations, and black-box proof; this owner is responsible for runtime safety and proof tooling.
- **Linear Review Source**: Deferred by TP on 2026-08-03.

## Context

Prepare Fly deployment and production-safe smoke tooling while T2/T3 build. Do not provision/deploy independently; T5 owns human-verified migration, secret, deployment, and product acceptance. One Fly app uses separate `api` and `worker` process groups against shared Postgres/R2.

## Solvys Coding-Agent Contract

- Follow `SOLVYS_AGENT_SYSTEM_PROMPT.md`, `AGENTS.md`, and CAO Refresh System.
- Use official Fly/Hono/Postgres/pg-boss/R2 patterns and adapt Fintheon's health posture without importing its identity.
- Distinguish source, image, deployed, and live proof. Infrastructure/migration/secrets require human verification.

## Linear Scope

- **Issue**: `S41 - Estate-to-Packet Cloud Process / T4 - Fly Runtime And Cloud Proof Harness`
- **Phase / due / owner**: Pre-Release / 2026-08-08 / Codex Cloud
- **Team / cycle / project / initiative**: Deferred; not set.

## Branch And Cloud Pickup

- **Date branch/checkpoint**: `2026-08-03`; `refs/sprints/S41/T4/P1`; `main` protected.
- **Environment**: repository-backed Codex Cloud, label `heir-right`, exact 32-character environment ID required.
- **Repository**: canonical `nicharacci/heir-right`; former `solvys/heir-right` redirects there. Saved project `06565aba-04d7-48e9-9f86-1923ded2ed12` at `/workspaces/heir-right`; dispatch must confirm canonical attachment.
- **Base**: `4e1d9e11ba4638bca78b01a31d2709024eb6f034`; start from green `refs/sprints/S41/T1/P1`.
- **Checkout/publication**: clean detached task worktree and managed Cloud Git receipt.
- **Protected**: all T1/T2/T3/app/current-worker/root-lock/provider/export/legal/outreach/site/campaign files.
- **Secrets (names only)**: `DATABASE_URL`, `HEIRRIGHT_PROCESS_API_TOKEN`, `HEIRRIGHT_WORKER_URL`, `HEIRRIGHT_API_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `FLY_API_TOKEN` (operator only), `NODE_ENV`, `PORT`.
- **Human gates**: no Fly/database creation, secret write, migration, routing change, or deploy.
- **Proof**: deterministic non-root image, process commands, health/readiness, release migration, shutdown, smoke dry contract, redaction.
- **Capacity/return**: reserve 2 GiB, >=5 GiB before and >=3 GiB after; publish T4 checkpoint.

## File Ownership

- `probate-lead-engine/deploy/heirright-process/**` `[NEW]`
- `probate-lead-engine/scripts/s41-cloud-smoke.mjs` `[NEW]`

## Scope -- Included

- [ ] Multi-stage monorepo-root Dockerfile that installs from lockfile at T5, builds T1-T3, prunes development dependencies, and runs non-root.
- [ ] Fly config with `api`/`worker` process groups, HTTPS, API health check, one warm API and worker, constrained resources, and graceful shutdown.
- [ ] Fail-closed release-command migration entrypoint, never worker boot migration.
- [ ] Names-only Managed Postgres/R2 environment contract and operator runbook.
- [ ] Black-box smoke: controlled case, events, duplicate intake, terminal state, approved artifact download/hash/bytes/type, case refresh, unauthorized denial.
- [ ] Redacted receipt: deployment version, health, case ID hash, event statuses, duplicate result, artifact proof, reload/auth result, timestamp.

## Excluded (DO NOT TOUCH)

- T1-T3/app/current-worker/root-package/lock/turbo/env/Cloudflare/UI/live infrastructure.

## Frontend / Wonder Gate

Design impact: not applicable. Wonder, Refero, and port 7777 are not applicable.

## Reuse Inventory

- Fintheon `backend-hono/fly.toml` - approved precedent for port 8080, HTTPS, warm machine, `/healthz`.
- Fintheon `backend-hono/Dockerfile` - precedent for immutable non-root runtime; do not include its Playwright/Grok payload.
- T1 migrations, T2 API/health, and T3 worker commands become runtime inputs at T5.

## Implementation Steps

1. Create Dockerfile, `.dockerignore`, `fly.toml`, migration entrypoint, and runbook using repository root context.
2. Scope HTTP to `api`; give database to both; give R2/source credentials only to worker; use least privilege.
3. Configure safe `/healthz` and `/readyz`, shutdown signals, and grace for pg-boss lease release.
4. Write smoke harness against T1/T2 contract; fixture lives outside Git and is never printed.
5. Add operator commands for preflight, secret-name audit, migration review, deploy, status/logs, smoke, and rollback. T5 executes mutations after human gate.
6. Validate config/harness in T4; deterministic integrated image proof occurs in T5. Never call dry config deployed.
7. Publish bundle with every unexecuted production operation marked.

## Acceptance Criteria

- [ ] One image runs separate API/worker groups; API stays warm and both shut down safely.
- [ ] Migration runs once as release command.
- [ ] Secret scope is least privilege and only names enter source/receipts.
- [ ] Smoke proves duplicate safety, event continuity, terminal state, artifact readback, reload, and auth denial.
- [ ] T4 changes no live infrastructure and reports build/deploy/live rungs separately.
- [ ] Design impact and Cloud/capacity/exit receipts are complete.

## Validation

```bash
cd probate-lead-engine
node --check scripts/s41-cloud-smoke.mjs
rm -rf deploy/heirright-process/.build-proof
docker build --file deploy/heirright-process/Dockerfile --tag heirright-process:s41 .
git diff --check
git status --short
```

If Docker is unavailable, return the exact blocker; do not substitute source for image proof.

## Commit Format

```text
S41 - estate-to-packet cloud process / T4

Outcome: Fly runtime and black-box cloud proof harness
Principal areas: deploy/heirright-process and s41 smoke
Proof: image/config/harness checks
Protected zones: application source, providers, UI, secrets, live infrastructure
Remaining blocker: human-verified provision/deploy/production smoke
```
