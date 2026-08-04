# S41 - Estate-to-Packet Cloud Process

## Track T2 - Hono Process API

## Problem And Solution

- **Original Problem**: Estate Search controls have no authenticated cloud command that durably creates a Doc Prep case, returns real state, or safely retries/cancels it.
- **Solution**: Estate-to-Packet Cloud Process.
- **Outcome Objective**: Deliver Estate-to-Packet Cloud Process so a HeirRight operator can issue one authenticated queue command and receive a durable observable case; this owner is responsible for API behavior, security, and validation proof.
- **Linear Review Source**: Deferred by TP on 2026-08-03.

## Context

Build the Fly-hosted Hono API against T1. The first real seam is idempotent intake that writes a case and transactional outbox, followed by canonical reads/events/retry/cancel. Do not touch the browser or artifact server; T5 owns integration.

## Solvys Coding-Agent Contract

- Follow `SOLVYS_AGENT_SYSTEM_PROMPT.md`, `AGENTS.md`, and CAO Refresh System.
- Start from accepted T1, preserve dirty work, and retain auth/source/legal/export/no-send gates.
- Use `hono` and `@hono/node-server`; prove request behavior, not route registration.

## Linear Scope

- **Issue**: `S41 - Estate-to-Packet Cloud Process / T2 - Hono Process API`
- **Phase / due / owner**: Pre-Release / 2026-08-08 / Codex Cloud
- **Team / cycle / project / initiative**: Deferred; not set.

## Branch And Cloud Pickup

- **Date branch/checkpoint**: `2026-08-03`; `refs/sprints/S41/T2/P1`; `main` protected.
- **Environment**: repository-backed Codex Cloud, label `heir-right`, exact 32-character environment ID required.
- **Repository proof**: canonical `nicharacci/heir-right`; former `solvys/heir-right` redirects there. Saved project `06565aba-04d7-48e9-9f86-1923ded2ed12` at `/workspaces/heir-right`; dispatch must confirm canonical attachment.
- **Base**: source `4e1d9e11ba4638bca78b01a31d2709024eb6f034`; start from green remote `refs/sprints/S41/T1/P1`.
- **Checkout/publication**: clean detached task-owned worktree and managed Cloud Git receipt required.
- **Protected**: artifact/worker/provider/deploy/export/outreach/legal/root-lock/site/campaign files.
- **Secrets (names only)**: `DATABASE_URL`, `HEIRRIGHT_PROCESS_API_TOKEN`, `PORT`, `NODE_ENV`; exclude provider/Fly/operator values.
- **Human gates**: no production secret, migration, deploy, provider, export, or outreach operation.
- **Proof**: PostgreSQL-backed auth/input/idempotency/concurrency/SSE/retry/cancel/health tests.
- **Capacity/return**: reserve 1.5 GiB, >=4 GiB before and >=2.5 GiB after; publish T2 checkpoint to T5.

## File Ownership

- `probate-lead-engine/apps/docprep-api/**` `[NEW]`

## Scope -- Included

- [ ] Node 20+ Hono service with `hono`, `@hono/node-server`, strict config, redacted logs, request IDs, bounded bodies/timeouts, and graceful shutdown.
- [ ] `POST /v1/doc-prep/cases` for 1-50 estate snapshots with `Idempotency-Key` and per-estate results.
- [ ] `GET /v1/doc-prep/cases/:caseId`, `GET /v1/doc-prep/cases?estateId=...`, and resumable SSE `GET /v1/doc-prep/cases/:caseId/events` using `Last-Event-ID`.
- [ ] Idempotent `POST /v1/doc-prep/cases/:caseId/actions/retry` and `/actions/cancel`.
- [ ] `/healthz` liveness and `/readyz` database/migration readiness.
- [ ] Validate all requests/responses through T1. Require service bearer; trust actor headers only after bearer validation. Never expose stack traces, raw evidence, secrets, or PDFs.

## Excluded (DO NOT TOUCH)

- T1 core except imports; artifact/worker/root/deploy/source/packet/R2/UI/live infrastructure.

## Frontend / Wonder Gate

Design impact: not applicable. Wonder, Refero, and port 7777 are not applicable.

## Reuse Inventory

- `@ple/docprep-core` from T1 - mandatory contracts/repositories/lifecycle.
- Existing auth semantics at `apps/artifact/server.js:162` and `apps/worker/src/cloudflare.ts:444` - preserve allowed-user behavior; do not copy browser cookie verification into Hono.
- Fintheon Hono Node and `/healthz` structure - approved precedent only.

## Implementation Steps

1. Create package/config/app factory/logger/bearer middleware/Node entrypoint.
2. Implement intake through T1 atomic repository: `201` create, `200` same idempotent result, `409` fingerprint conflict/incompatible active state.
3. Implement case reads and resumable SSE from persisted events with safe heartbeats.
4. Implement guarded durable retry/cancel; retry cannot bypass legal/human-review blockers.
5. Add safe health/readiness, origin policy for server proxying, limits, timeouts, redaction, and shutdown.
6. Test auth denial, malformed/oversized input, duplicate/conflicting key, concurrent intake, stale revision, retry/cancel, SSE resume, and no-mutation failures.
7. Publish endpoint contract, proof, redaction review, and protected-zone receipt.

## Acceptance Criteria

- [ ] Authenticated intake creates/returns one durable active case and outbox event.
- [ ] Duplicate clicks/network retries cannot duplicate cases/jobs; rejected requests make no mutation.
- [ ] GET/SSE rebuild state after reload without browser memory.
- [ ] Retry/cancel are durable commands with correct forbidden states and event history.
- [ ] Logs/errors contain no secrets, evidence bodies, or documents.
- [ ] Design impact and Cloud/capacity/exit receipts are complete.

## Validation

```bash
cd probate-lead-engine
pnpm install --lockfile=false
rm -rf apps/docprep-api/dist
pnpm --filter @ple/docprep-api typecheck
pnpm --filter @ple/docprep-api test
pnpm --filter @ple/docprep-api build
git diff --check
git status --short
```

## Commit Format

```text
S41 - estate-to-packet cloud process / T2

Outcome: authenticated idempotent Hono process API
Principal areas: apps/docprep-api
Proof: API, auth, concurrency, SSE, retry, cancel
Protected zones: current UI, providers, export, legal, outreach
Remaining blocker: Fly/unification gate, if any
```
