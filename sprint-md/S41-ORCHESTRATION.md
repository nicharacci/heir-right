# S41 - Estate-to-Packet Cloud Process

## Problem And Solution

- **Original Problem**: Estate Search and Doc Prep do not have a durable cloud process behind them. First handoff mutates browser memory, phase progress is partly UI timers, and no real complete estate-to-PDF journey has worked.
- **Solution**: Estate-to-Packet Cloud Process.
- **Objective**: Deliver Estate-to-Packet Cloud Process so a HeirRight operator can move one real estate from Estate Search through source-backed document preparation to a verified cloud PDF; owners prove behavior, controls, validation, design compliance, cloud persistence, and live operation.
- **Phase**: Pre-Release
- **Date branch**: `2026-08-03` `[created in the clean planning clone; no implementation dispatched]`
- **Root preservation**: `refs/sprints/S41/P1` `[REQUIRED before dispatch]`
- **Current source**: `4e1d9e11ba4638bca78b01a31d2709024eb6f034`

## Corrected Process Truth

HeirRight already has cloud-backed workspace and packet readback in Cloudflare. The missing seam is a durable workflow: `state.queueIds` is queue authority, Doc Prep is serialized per-estate UI state, and visible phases advance through browser `setTimeout`. S41 keeps the existing source/PDF work and makes PostgreSQL plus pg-boss own the sequence.

## Installation Decision

| OSS | Exact job |
| --- | --- |
| `hono`, `@hono/node-server` | authenticated Node API on Fly |
| `pg`, `drizzle-orm`, `drizzle-kit` | PostgreSQL and versioned migrations |
| `pg-boss` | durable jobs, retries, leases, recovery |
| `zod` | strict commands/events/responses/config |
| `@aws-sdk/client-s3` | R2 write/readback through S3 API |

Keep `pdf-lib` and existing HeirRight source/packet code. Do not install Mayan, Temporal, Redis, a UI kit, or another document engine. Mayan would add a second document product while leaving the broken Estate Search handoff/browser sequence in place; this foundation fixes the missing process seam.

## Fixed System Map

1. Estate Search sends authenticated idempotent intake to Hono.
2. PostgreSQL atomically stores estate, case, steps, event, and outbox.
3. Outbox dispatches one singleton pg-boss job.
4. Worker calls existing Cloudflare sources and existing packet/PDF code.
5. PostgreSQL records each step/blocker/retry/cancel/artifact version.
6. R2 stores bytes; SHA/bytes/type readback is required for `packet_ready`.
7. Browser observes server events, survives reload/second session, and never decides completion.

## Dispatch Preconditions

- Saved Cloud project exists, but its UUID is not the required 32-character environment ID. Dispatch returns exact environment, attachment, checkout, capacity, and Git receipts.
- `/Volumes/Ext.` is mounted read-only and the checkout is dirty. Authorized custody must create/push `refs/sprints/S41/P1` with accepted bounded PLE overlay and manifest, without absorbing unrelated site/campaign work.
- `2026-08-03` now contains planning documents only; no implementation checkpoint may enter it until preservation and Cloud pickup pass.
- Infrastructure, Postgres, migrations, secrets, deploy, and controlled live estate require TP verification.
- Linear is intentionally deferred by TP. These briefs are source of truth; no Linear status is claimed.

## Tracks

| Track | Brief | Owner files | Depends | Checkpoint |
| --- | --- | --- | --- | --- |
| T1 | `@sprint-md/S41-T1-process-contracts-durable-schema.md` | `packages/docprep-core/**` | preservation | `refs/sprints/S41/T1/P1` |
| T2 | `@sprint-md/S41-T2-hono-process-api.md` | `apps/docprep-api/**` | T1 | `refs/sprints/S41/T2/P1` |
| T3 | `@sprint-md/S41-T3-pgboss-document-worker.md` | `apps/docprep-worker/**`, worker export seam | T1 | `refs/sprints/S41/T3/P1` |
| T4 | `@sprint-md/S41-T4-fly-runtime-cloud-proof.md` | deploy bundle and smoke script | T1 | `refs/sprints/S41/T4/P1` |
| T5 | `@sprint-md/S41-T5-product-unification-production-proof.md` | exact artifact files and root lock | T2-T4 | `refs/sprints/S41/T5/P1` |

## Assignment Matrix

| Issue | Brief | Owner | Execution | Cycle | Project | Initiative |
| --- | --- | --- | --- | --- | --- | --- |
| ORCH | `@sprint-md/S41-ORCHESTRATION.md` | TP | planning/gates/acceptance | deferred | deferred | Pre-Release ref |
| T1 | `@sprint-md/S41-T1-process-contracts-durable-schema.md` | Codex Cloud | repo-backed Cloud | deferred | deferred | Pre-Release ref |
| T2 | `@sprint-md/S41-T2-hono-process-api.md` | Codex Cloud | repo-backed Cloud | deferred | deferred | Pre-Release ref |
| T3 | `@sprint-md/S41-T3-pgboss-document-worker.md` | Codex Cloud | repo-backed Cloud | deferred | deferred | Pre-Release ref |
| T4 | `@sprint-md/S41-T4-fly-runtime-cloud-proof.md` | Codex Cloud | repo-backed Cloud | deferred | deferred | Pre-Release ref |
| T5 | `@sprint-md/S41-T5-product-unification-production-proof.md` | Codex Cloud; TP accepts | Cloud + human deploy gate | deferred | deferred | Pre-Release ref |

## Wave Sequence

### Wave 0 - Preservation And Cloud Receipt

Authorized custody creates/pushes root preservation; dispatch resolves exact Cloud identity and repository/ref/checkout/capacity/publication receipts. No implementation starts earlier.

### Wave 1 - Foundation

T1 runs alone and freezes the contract/schema.

### Wave 2 - Parallel Implementation

T2, T3, and T4 run in parallel from accepted T1 with no file overlap.

### Wave 3 - Unification And Production Proof

T5 integrates green checkpoints. It alone owns dirty UI/server, root lock, infrastructure mutation, migrations/deploy, and complete browser proof.

## Design Decision

Full active anti-slop law and shared Design canon were loaded. T5 is behavior-only on existing HeirRight. Wonder, Refero, BeUI, Vercel UI, Bklit, EvilCharts, and visual redesign are not applicable. Completion still requires every control and point-by-point responsive design proof.

## Sprint Acceptance

- A controlled actual estate begins on deployed Estate Search and creates one durable case.
- Process survives page close, refresh, second session, restart, duplicate, and concurrent command.
- Source/review/retry/cancel/PDF/failure states are durable and observable.
- PDF becomes ready only after R2 hash/bytes/type readback and opens in deployed browser.
- Every affected control passes real click/tap with loading/disabled/error/navigation/persistence.
- Auth, source, legal, export, CRM, and no-send boundaries remain intact.
- Proof rungs are labeled. If actual estate does not reach opened verified PDF, S41 is not done.

## Linear Audit And Memory Flush

TP directed `skip linear for now`; active count/taxonomy are unknown. No issue was created, moved, assigned, or commented. Sprint S41 uses branch `2026-08-03`; TP owns gates/acceptance; Codex Cloud owns T1-T5 after valid dispatch; order is preservation -> T1 -> parallel T2-T4 -> T5. Nothing was pushed in planning. Durable rule: cloud-backed blobs are not a workflow, and production done requires every visible control plus one real deployed Estate Search-to-opened-PDF journey.
