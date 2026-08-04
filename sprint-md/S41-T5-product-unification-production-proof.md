# S41 - Estate-to-Packet Cloud Process

## Track T5 - Product Unification And Production Proof

## Problem And Solution

- **Original Problem**: HeirRight has Estate Search and Doc Prep controls, but Estate queue changes browser memory and the visible sequence advances locally. Estate files do not reliably cross the first handoff, and no complete production prep journey has worked.
- **Solution**: Estate-to-Packet Cloud Process.
- **Outcome Objective**: Deliver Estate-to-Packet Cloud Process so a HeirRight operator can click an estate in production, watch its cloud-owned sequence survive refresh/retry, and open the verified cloud PDF; this owner is responsible for unification, every affected control, deployment safety, responsive behavior, and production proof.
- **Linear Review Source**: Deferred by TP on 2026-08-03.

## Context

This required final track integrates T1-T4, creates the one root lock update, wires the existing artifact server/UI to Hono, deploys after human verification, and performs the real browser flow. It alone may edit dirty production UI/server files and must start from the accepted preservation checkpoint.

## Solvys Coding-Agent Contract

- Follow `SOLVYS_AGENT_SYSTEM_PROMPT.md`, full current `AGENTS.md` anti-slop law, `/Users/tifos/.codex/skills/Design.md`, and CAO Refresh System.
- Re-read Design immediately before source edits and re-check every anti-slop/design point after rendered proof.
- Preserve HeirRight's current visual register/layout. This is behavior wiring, not redesign or UI-library migration.
- Every affected control must work through real clicks with loading, disabled, error, retry/cancel, navigation, persistence, refresh, and duplicate behavior where applicable.
- Production-grade is the only done state. Report source, CI, build, deployed, browser, and live-process proof separately.

## Linear Scope

- **Issue**: `S41 - Estate-to-Packet Cloud Process / T5 - Product Unification And Production Proof`
- **Phase / due / owner**: Pre-Release / 2026-08-08 / Codex Cloud execution; TP final acceptance
- **Team / cycle / project / initiative**: Deferred; not set.

## Branch And Cloud Pickup

- **Date branch/checkpoint**: `2026-08-03` `[created for planning; implementation remains undispatched]`; `refs/sprints/S41/T5/P1`; `main` protected.
- **Environment**: repository-backed Codex Cloud, label `heir-right`, exact 32-character environment ID required.
- **Repository**: canonical `nicharacci/heir-right`; former `solvys/heir-right` redirects there. Saved project `06565aba-04d7-48e9-9f86-1923ded2ed12`, host `solvys-cloud`, `/workspaces/heir-right`; dispatch must confirm canonical attachment.
- **Base/ref**: source `4e1d9e11ba4638bca78b01a31d2709024eb6f034`; start from `refs/sprints/S41/P1` containing accepted bounded PLE dirty overlay, then integrate green T1-T4 refs. Stop on absent refs, overlap, or protected-file loss.
- **Checkout/publication**: detached task-owned unification worktree; receipt lists HEAD, picked SHAs, clean-start, overlay manifest, path, and managed Git route.
- **Protected**: site/campaign work; legal templates/field map; provider/auth policy; Podio/Google approvals; outreach no-send; unrelated dirty files; no broad redesign.
- **Secrets (names only)**: `DATABASE_URL`, `HEIRRIGHT_PROCESS_API_URL`, `HEIRRIGHT_PROCESS_API_TOKEN`, `HEIRRIGHT_WORKER_URL`, `HEIRRIGHT_API_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `FLY_API_TOKEN`, and existing artifact-auth names required by deployment.
- **Human gates**: immediately before provisioning, migration, secret writes, Fly deploy, routing, or controlled live estate. No unapproved outreach/CRM/export delivery.
- **Proof**: preservation, integration, lock/license/security audit, tests, image, migration review, deploy receipt, health, smoke, authenticated responsive browser, second session, duplicate/concurrency/error/restart/cancel, PDF open/hash/readback, console/network clean.
- **Capacity**: reserve 3 GiB; require >=7 GiB before and >=4 GiB after.
- **Return/closure**: publish T5 to date integrator. Done only when one controlled actual estate completes Estate Search -> durable case -> cloud sequence -> verified/opened R2 PDF and every affected control passes.

## File Ownership

- `probate-lead-engine/apps/artifact/src/index.html`
- `probate-lead-engine/apps/artifact/server.js`
- `probate-lead-engine/apps/artifact/e2e/s41-estate-to-packet-cloud.spec.mjs` `[NEW]`
- `probate-lead-engine/apps/artifact/test/s41-docprep-route-auth.test.mjs` `[NEW]`
- `probate-lead-engine/pnpm-lock.yaml`
- Accepted T1-T4 files for integration only; prefer T5-owned adapters/shims over changing track internals.

Do not modify dirty `turbo.json`, `.env.example`, current S37 tests, or existing worker/packet bodies without an independently proven blocker and recorded protected-zone exception.

## Scope -- Included

- [ ] Integrate T1-T4 and create one audited lockfile for Hono/Node, pg/Drizzle, pg-boss, Zod, and R2 S3.
- [ ] Artifact-server proxies for create/read/events/retry/cancel. Browser never receives Fly service token.
- [ ] Replace `state.queueIds` as process authority. Queue controls call Hono; only durable successes leave active Estates and appear in Doc Prep.
- [ ] Hydrate Doc Prep from API after load/refresh. `ensureDocPrepStarted`, local flow state, and 680 ms phase timer may remain presentation helpers only; they cannot create truth or completion.
- [ ] Map canonical case/steps/events to existing rail/status/blocker/PDF surfaces without redesign.
- [ ] Wire single/batch queue, open Doc Prep, run/retry, stop/cancel, refresh/reconnect, case selection, verified PDF open/download, and existing export eligibility.
- [ ] Human-verified Postgres/R2/Fly provision, migration, deploy, artifact URL/token configuration, cloud smoke, and production-safe estate run.

## Excluded (DO NOT TOUCH)

- Mayan, Temporal, Redis, new UI kit, visual redesign, local-only authority, fake/demo completion, new provider credentials, automatic legal conclusions, outreach, or unapproved Podio/Google/export writes.
- Websites/campaigns, unrelated tabs, legal-template content/field map, provider rewrites, global design migration.

## Frontend Gate

- Full active anti-slop law and shared Design canon were loaded during planning; no repo-local Design file exists.
- Behavior-only integration. Preserve layout, type, materials, responsive behavior, and user language.
- Refero/Wonder are not applicable because this is existing-surface behavior, not greenfield visual direction. Port 7777 is not the proof rung; deployed authenticated cloud is.
- BeUI, Vercel UI, Bklit, EvilCharts, Mayan are not applicable; install none.
- Statuses are visible-by-default, accessible, plain-language, and responsive. No developer narration, raw states, new popup/card clutter, invented icons, or animation-hidden content.
- Final proof: real clicks at 1440x900, 1280x720, 768x1024, and 390x844 plus point-by-point design recheck.

## Reuse Inventory

- `addRowsToQueue` at `apps/artifact/src/index.html:13844` - replace in-memory authority with async intake while preserving presentation.
- `ensureDocPrepStarted` at line 14212 - presentation initializer only.
- `scheduleNextFullDiscoveryPhase` at line 16196 and `runFullDiscovery` near 16350 - remove browser-timer process authority and render canonical events.
- `storageSetItem` at line 12032 and `/api/workspace/state` - retain for unrelated preferences, not S41 workflow database.
- `proxyWorkerJson` at `apps/artifact/server.js:421` and authenticated gate near 2044 - reuse server-side proxy/auth pattern with separate process token.
- S37 browser suite - regression baseline only; same-session demo flow is insufficient S41 proof.
- T1-T4 packages/bundle/harness - integrate without duplicating logic.

## Known Issues To Preserve

- Workspace and packet artifacts already have cloud readback; do not claim everything was browser-only or delete them wholesale.
- Sample estates remain blocked from production source runs/export.
- `packet_ready` never implies exported, CRM-written, contacted, or legally approved.
- Dirty active client/product/site/campaign work must be preserved through `refs/sprints/S41/P1` and exact overlay manifest.

## Implementation Steps

1. Verify preservation/task refs, SHAs, clean unification checkout, overlay manifest, and ownership. Stop if any current PLE overlay is missing.
2. Integrate T1-T4, audit dependencies/licenses/security, generate root lock, and build/test packages before UI edits.
3. Add authenticated bounded/redacted artifact-server process proxy; inject bearer and trusted actor server-side.
4. Add process client to existing inline app. Queue stable estate snapshots with idempotency; disable pending controls; show per-estate durable result; route successes to Doc Prep.
5. Hydrate cases and resume events. Refresh/second session reconstruct from server without queue/local flow authority.
6. Wire durable retry/cancel and remove timer authority. Respect review/legal blockers.
7. Gate PDF preview/download on `packet_ready` and verified metadata; verify same-origin/short-lived response type/hash metadata.
8. Add route and browser tests for queue handoff, reload, second context, duplicate, concurrency, auth denial, source blocker, worker restart/retry, cancel, PDF open, and export eligibility without delivery.
9. Present infrastructure/migration/secret/deploy diff to TP. After approval, provision/attach, migrate, deploy, configure artifact, run cloud smoke.
10. In deployed authenticated browser, execute every affected control at all target widths with a controlled actual estate; capture network/console/Fly/Postgres/R2 receipts.
11. Re-read anti-slop and Design point-by-point, fix defects, run CI, publish T5, and say done only if the actual estate reaches opened verified PDF.

## Acceptance Criteria

- [ ] Deployed Estate Search creates one durable case with loading/disabled/error/success; duplicates cannot duplicate it.
- [ ] Estate moves exactly once from active Estates to Doc Prep, with no duplicate visibility across workflow surfaces.
- [ ] Refresh, second authenticated context, and reconnect show the same canonical case/events/artifact.
- [ ] Worker continues after page close, survives restart/retry, and does not repeat completed work.
- [ ] Source/legal uncertainty blocks with concrete next action; stop/cancel and retry are real durable commands.
- [ ] PDF appears only after R2 SHA/bytes/type readback; deployed browser opens the actual PDF.
- [ ] Auth/source/legal/export/CRM/no-send gates remain intact.
- [ ] Every affected control passes target-width clicks with no unexpected console/network errors.
- [ ] Design recheck passes; no new UI/design dependency was installed.
- [ ] Fly API/worker, managed Postgres, and R2 are live; lower proof rungs are labeled honestly.
- [ ] If one controlled actual estate does not complete Estate Search -> Doc Prep -> opened verified PDF, S41 is not done.

## Validation

```bash
cd probate-lead-engine
pnpm install --frozen-lockfile
rm -rf packages/docprep-core/dist apps/docprep-api/dist apps/docprep-worker/dist apps/worker/dist apps/artifact/dist
pnpm build
pnpm test
pnpm --filter @ple/artifact test
pnpm exec playwright test apps/artifact/e2e/s41-estate-to-packet-cloud.spec.mjs
docker build --file deploy/heirright-process/Dockerfile --tag heirright-process:s41 .
node scripts/s41-cloud-smoke.mjs
git diff --check
git status --short
```

Production mutation commands run only after the recorded human gate. Evidence contains no secrets/raw estate documents.

## Commit Format

```text
S41 - estate-to-packet cloud process / T5

Outcome: production Estate Search-to-verified-PDF cloud process
Principal areas: integration, artifact controls, Fly deployment, production proof
Proof: suites, smoke, authenticated responsive flow, PDF readback/open
Protected zones: dirty work, auth, providers, legal, export/outreach, sites/campaigns
Remaining blocker: none or exact failed production rung
```
