# Secret Deployment Status

Date: 2026-07-04

## Result

IDI Core operator-portal configuration was found, deployed, and verified live.

The shared backend IDI API endpoint/token and Browserbase credentials were not found in the checked local environment, provider env inventories, Chrome profile metadata, local Mail storage, or available app connectors. They were not fabricated.

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
- Chrome profile data:
  - Profile 11 contains saved `login.idicore.com` credentials.
  - The valid idiCORE credential reaches the email authentication-code gate.
  - The copied Chrome session is expired for idiCORE app pages.
  - Chrome history/saved-login metadata did not contain Browserbase dashboard/API-key access.
- Gmail/Mail retrieval:
  - Gmail connector returned `UNAUTHORIZED` / reauthentication required.
  - Local Mail storage did not contain a fresh idiCORE authentication-code email after requesting one.
- Secret-manager CLIs:
  - `op`
  - `doppler`
  - `infisical`

## Present Values Found

- `.env.local` contains `IDI_CORE_LIVE_RUN_APPROVED`.
- Chrome Profile 11 contains a valid idiCORE portal login, but the app requires an emailed authentication code before admin/search surfaces can be reached.
- Deployed to Vercel production:
  - `IDI_CORE_LOGIN_URL`
  - `IDI_CORE_PORTAL_URL`
  - `IDI_CORE_OPERATOR_EMAIL`
  - `IDI_CORE_LIVE_RUN_APPROVED=false`
- Deployed to Cloudflare Worker secrets:
  - `IDI_CORE_OPERATOR_EMAIL`
- Cloudflare Worker vars already contain:
  - `IDI_CORE_LOGIN_URL`
  - `IDI_CORE_PORTAL_URL`
  - `IDI_CORE_LIVE_RUN_APPROVED=false`
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

## Live Verification

- Vercel production deployment: `dpl_5TTCUuevxQEaM8nCDe9GoToBA9PC`
- Cloudflare Worker deployment version: `82e87deb-5453-447b-b5a8-f96fa5564afa`
- `GET https://heirright-landing-demo.vercel.app/api/discovery/idi-core/status`
  - HTTP `200`
  - `name: IDI Core`
  - `ok: true`
  - `mode: review`
  - `configuredMode: operator_portal`
  - `portal.configured: true`
  - `api.endpointConfigured: false`
  - `api.sharedDefaultConfigured: false`
- `POST https://heirright-landing-demo.vercel.app/api/discovery/external-source-run`
  - HTTP `200`
  - route is live
  - current blocker: Tax Collector public search still needs a direct listing URL/template or browser workflow capture.
- `POST https://heirright-landing-demo.vercel.app/api/discovery/tax-collector/receipt-run`
  - HTTP `200`
  - route is live
  - current blocker: no `TAX_COLLECTOR_LISTING_URL_TEMPLATE`, Browserbase function, or controlled browser workflow is deployed.

## Route Fixes Deployed

- Added root Vercel API shims for:
  - `/api/discovery/idi-core/status`
  - `/api/discovery/external-source-run`
  - `/api/discovery/tax-collector/receipt-run`
- Deployed the current Cloudflare Worker so Vercel source routes no longer hit stale Worker 404s.
- Patched Tax Collector receipt-run to fall back to local acquisition when the Worker does not implement that standalone receipt route.

## Verification After Deployment

Run:

```bash
vercel env ls --cwd probate-lead-engine
pnpm --dir probate-lead-engine --filter @ple/worker exec wrangler secret list
pnpm --dir probate-lead-engine --filter @ple/artifact test
```

Then rerun route/browser proof against the deployment, not only localhost.
