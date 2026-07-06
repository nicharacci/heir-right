# 2026-07-06 App-Owned Readiness Progress

## Goal

Bring HeirRight to 100% for app-owned production readiness, excluding client-owned vendor approvals for IDI Core API access and Miami-Dade Clerk Commercial Data Services access.

## Completed

- Wrote `sprint-md/S34-BRIEF-app-owned-production-readiness.md` to lock the cleanup scope.
- Split Podio auth readiness into durable team access, server refresh access, browser-session refresh, bearer fallback, and missing access.
- Changed Cloudflare OAuth runtime handling so browser reconnects use a browser-session refresh field and no longer look like durable team refresh access.
- Created and bound Cloudflare KV namespace `PODIO_TOKEN_STORE` so the approved Podio OAuth refresh token can be stored encrypted server-side for team-durable access.
- Changed the Podio OAuth callback to save the encrypted refresh token into KV and report `Podio Team Access Connected` when durable storage succeeds.
- Added Browserbase Usage readiness with single-estate source capture status, batch approval requirement, batch size cap, concurrency cap, proxy flag, and function readiness.
- Added Browserbase paid batch guardrails for Tax Collector receipt capture. Unapproved batch runs block before Browserbase is called.
- Added Worker-side Tax Collector receipt acquisition to `/api/discovery/external-source-run` so production can capture the bottom-right receipt link from estate facts, not only through the local fallback.
- Added Settings controls for Browserbase Usage and durable Podio guidance.
- Replaced raw source-run credential labels with operator-facing source access language.
- Added `/api/discovery/external-source-run` to Worker health route metadata.
- Added S34 regression coverage for Podio durability, Browserbase usage status, Settings exposure, batch blocking, approved batch capture, and token redaction.

## Verified

- `pnpm --filter @ple/types build`
- `pnpm --filter @ple/worker build`
- `node apps/artifact/test/source-readiness-contract.test.mjs`
- `node apps/artifact/test/s31-readiness-contract.test.mjs`
- `node apps/artifact/test/s33-production-source-cleanup.test.mjs`
- `node apps/artifact/test/source-run-contract.test.mjs`
- `node apps/artifact/test/s34-app-owned-readiness.test.mjs`
- `git diff --check`
- Vercel production deploy: `dpl_Bek1ktanMShWDrcWRtVmFrZYA2F2`, aliased at `https://heirright-landing-demo.vercel.app`.
- Cloudflare Worker deploy: `2398267c-ba98-4ba9-ad6d-911ec0a0f1f2`, live at `https://heirright-probate-lead-engine.sam-e7a.workers.dev`.
- Worker deploy proof showed `PODIO_TOKEN_STORE` bound to KV namespace `d21d2926fe3e4e12ae17bc89e0907a93`.
- Live `/api/connections/status`: Browserbase Usage row present, usage policy mode `review`, batch approval required, cap 10 estates, concurrency 2.
- Live `/api/discovery/external-source-run`: unapproved batch returns `browserbase_batch_blocked`, includes a Tax Collector guard fact, and does not expose Browserbase secret names.
- Live Worker `/health`: lists `/api/discovery/external-source-run` and `/api/connections/status`.

## Client-Owned Access Still Required

- IDI Core vendor API access.
- Miami-Dade Clerk Commercial Data Services AuthKey and prepaid units.
- Browserbase paid account capacity/proxy settings remain an account-level operating decision, but app-side guardrails now prevent silent batch spend.
