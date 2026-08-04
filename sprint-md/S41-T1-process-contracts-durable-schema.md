# S41 - Estate-to-Packet Cloud Process

## Track T1 - Process Contracts And Durable Schema

## Problem And Solution

- **Original Problem**: Estate Search can select an estate, but its queue is an in-memory browser `Set` and Doc Prep is serialized UI state. No canonical cloud case, durable sequence, event history, or retry-safe handoff owns the estate through a verified PDF.
- **Solution**: Estate-to-Packet Cloud Process.
- **Outcome Objective**: Deliver Estate-to-Packet Cloud Process so a HeirRight operator can move one real estate from Estate Search through source-backed document preparation to a verified cloud PDF; this owner is responsible for the durable contract, legal transitions, validation, and migration proof.
- **Linear Review Source**: Linear was explicitly deferred by TP on 2026-08-03. No issue status is claimed.

## Context

This track creates the shared process language and PostgreSQL source of truth used by Hono and pg-boss. It runs first so API, worker, and Fly tracks cannot invent incompatible payloads or states. Existing Cloudflare source/artifact routes remain adapters; this schema owns case lifecycle, jobs, events, artifacts, and idempotency.

## Solvys Coding-Agent Contract

- Follow `SOLVYS_AGENT_SYSTEM_PROMPT.md`, current `AGENTS.md`, and the CAO Refresh System.
- Start from repo truth, preserve intentional dirty state, and modify only assigned files.
- Understand Estate Search, Doc Prep, packet readback, export, auth, legal-review, and no-auto-send boundaries.
- This track has no rendered UI. Prove migrations and transitions with runnable tests; schema existence is not completion.

## Linear Scope

- **Issue name**: `S41 - Estate-to-Packet Cloud Process / T1 - Process Contracts And Durable Schema`
- **Phase**: Pre-Release
- **Team / Cycle / Project / Initiative**: Deferred by TP; not set in Linear.
- **Due**: 2026-08-08
- **Owner**: Codex Cloud

## Branch And Cloud Pickup

- **Date branch**: `2026-08-03` `[created in the clean planning clone; no implementation dispatched]`; `main` is protected.
- **Plan**: this brief, dated 2026-08-03.
- **Environment**: repository-backed Codex Cloud, label `heir-right`.
- **Environment ID**: `REQUIRED AT DISPATCH` - exact 32-character lowercase hexadecimal ID. Saved project UUID is not an environment ID.
- **Repository**: `solvys/heir-right`; saved Cloud project `06565aba-04d7-48e9-9f86-1923ded2ed12`, host `solvys-cloud`, managed path `/workspaces/heir-right`. Dispatch must return exact task attachment proof.
- **Base**: `4e1d9e11ba4638bca78b01a31d2709024eb6f034` plus accepted remote `refs/sprints/S41/P1`. Stop if absent or mismatched.
- **Checkpoint**: `refs/sprints/S41/T1/P1`.
- **Checkout/publication**: clean detached task-owned worktree and managed Cloud Git transport to `git@github.com:solvys/heir-right.git`; receipt must include exact HEAD, status, path, task identity, detached mode, and authenticated publication route.
- **Protected zones**: existing artifact and worker files; auth; providers; packet/export; legal templates; outreach; websites/campaigns; every unrelated dirty file.
- **Secrets (names only)**: `DATABASE_URL`, `DATABASE_URL_TEST`. Exclude all provider/OAuth/client values.
- **Human gates**: production database provisioning and migration execution.
- **Return**: immutable T1 checkpoint for Wave 2, never `main`.
- **Capacity**: reserve 2 GiB; require >=4 GiB free before and >=2 GiB projected after.
- **Closure**: package, migrations, tests, and protected-zone receipt published; otherwise exact blocker.

## File Ownership

- `probate-lead-engine/packages/docprep-core/**` `[NEW - create]`

## Scope -- Included

- [ ] Create `@ple/docprep-core` with Zod commands/results, TypeScript types, lifecycle guards, Drizzle schema/repositories, and versioned migrations.
- [ ] Define a stable estate snapshot: estate ID, name/owner, address, county, parcel/case refs when present, source-file refs, and actor metadata. Never store browser blobs or PDF bytes in PostgreSQL.
- [ ] Case states: `queued`, `sourcing`, `review_required`, `rendering`, `packet_ready`, `blocked`, `failed`, `cancelled`.
- [ ] Step states: `pending`, `running`, `succeeded`, `review_required`, `blocked`, `failed`, `cancelled`.
- [ ] Tables: estates, cases, steps, artifacts, append-only events, idempotency keys, transactional outbox. pg-boss owns its own schema.
- [ ] Enforce one active case per estate, ordered events, optimistic revisions, request fingerprints, and artifact hash/readback fields.
- [ ] Make intake one transaction: upsert estate, create/return active case, create steps, append event, write outbox.
- [ ] Every review/block/failure state carries a plain-language blocker and next action; missing evidence never becomes completion.

## Excluded (DO NOT TOUCH)

- Existing `packages/types/src/index.ts`, worker/artifact/server/provider/export/outreach files, Fly configuration, root lockfile, UI, or production database.

## Frontend / Wonder Gate

Design impact: not applicable. Wonder, Refero, and port 7777 are not applicable.

## Reuse Inventory

- Existing `Lead`, `SourceRef`, and `BetaAuthSession` at `probate-lead-engine/packages/types/src/index.ts` - preserve vocabulary without editing the file.
- `WorkspaceState` at `apps/worker/src/cloudflare.ts:1151` - evidence of existing cloud blob state, not the relational process model.
- Fintheon Hono/Postgres/Fly structure under `/Volumes/Ext./Codebases/fintheon/backend-hono` - approved structural precedent only.

## Implementation Steps

1. Create package manifest/config/exports/README. Install `drizzle-orm`, `pg`, `zod`; dev-install `drizzle-kit`, `@types/pg`, TypeScript. Do not update root lockfile.
2. Write strict Zod schemas for snapshots, intake, case views, steps, events, artifacts, actions, and errors; reject unknown/oversized input.
3. Implement and test the finite-state transition map, including duplicate, stale revision, retry, cancellation, review, block, and failure.
4. Define tables, indexes, constraints, append-only events, idempotency fingerprint, and transactional outbox.
5. Implement atomic repositories: intake, reads, event append, step claim/finish/fail, cancel, artifact record, outbox claim/mark, and retry preparation.
6. Generate migrations and prove them on isolated PostgreSQL, including concurrent intake producing one active case.
7. Publish dependency/license, schema, migration, test, and protected-zone receipts.

## Acceptance Criteria

- [ ] Intake atomically owns case, steps, event, and outbox; crashes cannot leave orphan work.
- [ ] Same idempotency key/fingerprint returns the same result; changed fingerprint is rejected.
- [ ] Concurrent intake creates one active case. Illegal transitions make no mutation.
- [ ] Artifact metadata includes object key/version, type, bytes, SHA-256, readback status, and verification time.
- [ ] Forward migration passes against isolated PostgreSQL; production remains untouched pending human review.
- [ ] Execution lane, capacity, exit, closure, and protected-zone receipts are complete.

## Validation

```bash
cd probate-lead-engine
pnpm install --lockfile=false
rm -rf packages/docprep-core/dist
pnpm --filter @ple/docprep-core typecheck
pnpm --filter @ple/docprep-core test
pnpm --filter @ple/docprep-core build
git diff --check
git status --short
```

Run migration tests only against `DATABASE_URL_TEST`.

## Commit Format

```text
S41 - estate-to-packet cloud process / T1

Outcome: durable contracts, state machine, schema, and migrations
Principal areas: @ple/docprep-core
Proof: typecheck, tests, isolated PostgreSQL migration
Protected zones: artifact UI, providers, auth, export, legal, outreach
Remaining blocker: exact Cloud or production migration gate, if any
```
