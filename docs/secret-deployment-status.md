# Secret Deployment Status

Date: 2026-07-04

## Result

No new provider secrets were deployed because the actual private values are not available in the checked local environment, env files, Keychain names, Vercel project, Cloudflare Worker, or local secret-manager CLIs.

Do not use dummy values. Do not set `IDI_CORE_LIVE_RUN_APPROVED=true` without the real endpoint/token and an approved proof window.

## Checked Targets

- Vercel project: `solvys/heirright-landing-demo`
- Cloudflare Worker: `heirright-probate-lead-engine`
- Local env files:
  - `.env.local`
  - `probate-lead-engine/.vercel/.env.production.local`
  - `probate-lead-engine/apps/artifact/.vercel/.env.production.local`
  - `site-v2/.vercel/.env.production.local`
  - package-level `.env` / `.env.local` paths
- Process env
- macOS Keychain account/service names:
  - `IDI_CORE_API_TOKEN`
  - `HEIRRIGHT_IDI_CORE_API_TOKEN`
  - `BROWSERBASE_API_KEY`
- Secret-manager CLIs:
  - `op`
  - `doppler`
  - `infisical`

## Present Values Found

- `.env.local` contains `IDI_CORE_LIVE_RUN_APPROVED`.
- No `IDI_CORE_API_URL`.
- No `IDI_CORE_API_TOKEN`.
- No `HEIRRIGHT_IDI_CORE_API_TOKEN`.
- No `IDI_CORE_API_KEY`.
- No `BROWSERBASE_API_KEY`.
- No `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`.
- No `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`.
- No `MIAMI_DADE_CLERK_AUTH_KEY`.

## Required Deployment Values

Minimum for live shared IDI proof:

- `IDI_CORE_API_URL`
- `IDI_CORE_API_TOKEN`
- `IDI_CORE_LIVE_RUN_APPROVED=true` only during controlled proof

Minimum for live Tax Collector public search:

- `BROWSERBASE_API_KEY`
- `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`
- optional `BROWSERBASE_API_BASE`

Required for remaining live Discovery source automation:

- `MIAMI_DADE_CLERK_AUTH_KEY`
- `OBITUARY_VITAL_WORKFLOW_URL` or `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`

## Deployment Destinations

Deploy shared app/runtime secrets to both:

- Vercel production env for `probate-lead-engine`
- Cloudflare Worker secrets for `heirright-probate-lead-engine`

Deploy Browserbase function IDs only after the Browserbase source functions are actually deployed.

## Verification After Deployment

Run:

```bash
vercel env ls --cwd probate-lead-engine
pnpm --dir probate-lead-engine --filter @ple/worker exec wrangler secret list
pnpm --dir probate-lead-engine --filter @ple/artifact test
```

Then rerun route/browser proof against the deployment, not only localhost.
