# S41 - Estate-to-Packet Cloud Process

## Track T3 - pg-boss Document Worker

## Problem And Solution

- **Original Problem**: The visible Doc Prep sequence advances through browser timers after one source call. Closing the tab leaves no durable worker ownership, retry ledger, or reliable path from evidence to a verified stored PDF.
- **Solution**: Estate-to-Packet Cloud Process.
- **Outcome Objective**: Deliver Estate-to-Packet Cloud Process so queued estate work continues in the cloud through sources, review gates, PDF generation, R2 readback, and durable completion when the browser disappears; this owner is responsible for worker behavior and recovery proof.
- **Linear Review Source**: Deferred by TP on 2026-08-03.

## Context

Install pg-boss as the sequence runner. Preserve HeirRight's actual script by wrapping existing Cloudflare source routes and packet/PDF modules instead of replacing them with a document-management platform. PostgreSQL owns state/retries; R2 owns bytes; the browser observes and commands.

## Solvys Coding-Agent Contract

- Follow `SOLVYS_AGENT_SYSTEM_PROMPT.md`, `AGENTS.md`, and CAO Refresh System.
- Start from T1, preserve dirty state, reuse current source/dossier/packet/PDF code, and never fabricate evidence completion.
- Preserve legal/manual review, auth, export-readback, provider, and no-auto-send gates.
- Prove crash, retry, cancellation, stale job, and duplicate delivery behavior.

## Linear Scope

- **Issue**: `S41 - Estate-to-Packet Cloud Process / T3 - pg-boss Document Worker`
- **Phase / due / owner**: Pre-Release / 2026-08-08 / Codex Cloud
- **Team / cycle / project / initiative**: Deferred; not set.

## Branch And Cloud Pickup

- **Date branch/checkpoint**: `2026-08-03`; `refs/sprints/S41/T3/P1`; `main` protected.
- **Environment**: repository-backed Codex Cloud, label `heir-right`, exact 32-character environment ID required.
- **Repository**: canonical `nicharacci/heir-right`; former `solvys/heir-right` redirects there. Saved project `06565aba-04d7-48e9-9f86-1923ded2ed12`, `/workspaces/heir-right`; dispatch must confirm canonical attachment.
- **Base**: `4e1d9e11ba4638bca78b01a31d2709024eb6f034`; start from green `refs/sprints/S41/T1/P1`.
- **Checkout/publication**: clean detached task-owned worktree and managed Cloud Git receipt.
- **Protected**: `apps/worker/src/cloudflare.ts`, provider adapters, artifact UI/server, deploy, legal/export/outreach, sites/campaigns, root lock, unrelated dirty files.
- **Secrets (names only)**: `DATABASE_URL`, `HEIRRIGHT_WORKER_URL`, `HEIRRIGHT_API_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `NODE_ENV`.
- **Human gates**: no credential change, external write, production secret, or deploy.
- **Proof**: outbox recovery, singleton enqueue, crash/retry, cancellation, source blocker, packet generation, R2 SHA/readback, duplicate/stale delivery, shutdown.
- **Capacity/return**: reserve 2 GiB, >=5 GiB before and >=3 GiB after; publish `refs/sprints/S41/T3/P1`.

## File Ownership

- `probate-lead-engine/apps/docprep-worker/**` `[NEW]`
- `probate-lead-engine/apps/worker/src/index.ts` - export-only additions; preserve current behavior.

## Scope -- Included

- [ ] Install `pg-boss` and `@aws-sdk/client-s3`.
- [ ] Dispatch transactional outbox rows to singleton pg-boss jobs; crash between send/mark remains duplicate-safe.
- [ ] Durable case steps: load, acquire Discovery File/evidence, enforce review, build packet model, render PDF, write/read R2, verify SHA/bytes/type, record artifact, mark `packet_ready`.
- [ ] Call existing authenticated Cloudflare `/api/discovery/external-source-run`, `/api/discovery/file`, and attachment routes through an injectable adapter. Do not rewrite `cloudflare.ts`.
- [ ] Export existing `buildDiscoveryPacketModel`, `validatePacketModel`, and `renderPacketPdf` through `apps/worker/src/index.ts`; do not copy bodies.
- [ ] Check cancellation/revision between steps; retry transient faults; persist source/legal review blockers without retry storms.
- [ ] Append immutable events for claims, starts, success, review, retry, failure, cancellation, artifact verification, and completion.

## Excluded (DO NOT TOUCH)

- T1 except imports; Hono API; Fly; artifact UI/server; Cloudflare implementation; packet bodies; export/outreach; root lock; deployment.

## Frontend / Wonder Gate

Design impact: not applicable. Wonder, Refero, and port 7777 are not applicable.

## Reuse Inventory

- `runDryPipeline` at `apps/worker/src/index.ts` - controlled domain-pipeline tests.
- `buildDiscoveryPacketModel` and `validatePacketModel` at `apps/worker/src/documents/packet-model.ts:327,354`.
- `renderPacketPdf` at `apps/worker/src/documents/packet-pdf.ts:199`.
- `PACKET_ARTIFACTS` verification patterns at `apps/worker/src/cloudflare.ts:1215-1295`.
- Existing source route at `apps/worker/src/cloudflare.ts:2967` - adapter, not workflow authority.

## Known Issue To Resolve

`runFullDiscovery` calls the source route once, then `scheduleNextFullDiscoveryPhase` at `apps/artifact/src/index.html:16196` advances UI phases with a 680 ms timer. T3 creates process authority; T5 later removes timer authority from UI. Sample estates stay isolated and queue remains prep-only.

## Implementation Steps

1. Create worker package/config, pg-boss/R2 clients, redacted logging, lifecycle hooks, and test adapters.
2. Add export-only lines to existing worker index and prove its build/tests remain green.
3. Implement outbox claims with bounded batches, `FOR UPDATE SKIP LOCKED`, leases, singleton keys, and expired-claim recovery.
4. Implement each durable step to re-read case/revision and exit safely if already complete/cancelled.
5. Implement source adapter with timeout, bearer, schema/readback validation, and plain blockers; never log evidence bodies.
6. Use existing packet functions; upload immutable versioned bytes to R2, read back/re-hash, compare bytes/type, and record verified. Quarantine a failed new version without deleting prior verified artifacts.
7. Test crash after send, duplicate delivery, crash between R2 write/readback, network retry, blocker, cancellation, stale revision, and completion.
8. Publish job trace, redacted artifact readback proof, tests, and protected-zone receipt.

## Acceptance Criteria

- [ ] Browser close cannot stop/lose a case; duplicate delivery cannot duplicate case/artifact.
- [ ] Blocked/legal uncertainty becomes durable review/block with next action.
- [ ] Existing packet model/renderer are called directly and regression-tested.
- [ ] `packet_ready` requires matching R2 SHA-256, byte count, and content type.
- [ ] Restart resumes without repeating completed irreversible work.
- [ ] No outreach, CRM/Google write, or unapproved provider action occurs.
- [ ] Design impact and Cloud/capacity/exit receipts are complete.

## Validation

```bash
cd probate-lead-engine
pnpm install --lockfile=false
rm -rf apps/worker/dist apps/docprep-worker/dist
pnpm --filter @ple/worker build
pnpm --filter @ple/docprep-worker typecheck
pnpm --filter @ple/docprep-worker test
pnpm --filter @ple/docprep-worker build
git diff --check
git status --short
```

## Commit Format

```text
S41 - estate-to-packet cloud process / T3

Outcome: durable pg-boss estate-to-PDF worker with verified R2 storage
Principal areas: apps/docprep-worker and worker export seam
Proof: retry, crash, idempotency, blocker, packet, R2 readback
Protected zones: Cloudflare routes, providers, UI, auth, export, legal, outreach
Remaining blocker: Fly/unification gate, if any
```
