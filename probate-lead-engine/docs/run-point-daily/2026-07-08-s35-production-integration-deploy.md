# 2026-07-08 S35 Production Integration Deploy

## Goal

Deploy the received HeirRight integration information safely, harden production routes, prove live behavior, and keep the app honest about external credentials that are not yet issued or funded.

## Deployment State

- Vercel production deployment: `https://heirright-landing-demo-iuiv54kfu-solvys.vercel.app`
- Vercel project: `heirright-landing-demo`
- Worker deployment: `https://heirright-probate-lead-engine.sam-e7a.workers.dev`
- Worker version proved after deploy: `5b316922-8876-4d8a-bac8-662aece18067`
- Intended client URL: `https://app.heirright.com`
- Domain status: Vercel has the domain request, but external DNS is still missing `A app.heirright.com -> 76.76.21.21`; `app.heirright.com` did not resolve during proof.

## Backend Secrets And Runtime Config

- Vercel production env names present for auth/session, allowed domains, Podio client credentials, Podio OAuth callback, Podio durable auth requirement, Miami-Dade Clerk AuthKey, Browserbase key/project/function IDs, Worker URL, and Worker token.
- Worker secrets present for Miami-Dade Clerk AuthKey, Podio client ID/secret, Browserbase key/project/function IDs, and the shared internal API token.
- No raw secret values were written to docs or committed files.
- idiCORE remains `operator_portal` / manual import only. API Secret, Site Key, and Company Key are pending from IDI support.

## Code Changes

- Replaced static Vercel `/auth/session` fallback with dynamic serverless auth routes and `/auth/:path*` rewrites.
- Added production route guards so external source run, exports, and fresh batch are `POST` only.
- Added explicit operator-intent requirement before external source searches can run.
- Added Vercel Podio OAuth diagnostics/start/callback pass-through routes to the Worker.
- Locked Podio OAuth pass-through behind the app session gate so unauthenticated users cannot attach a Podio account.
- Added direct Worker route for `/api/discovery/tax-collector/receipt-run` so Tax Collector receipt capture uses the Browserbase-capable backend path instead of the artifact fallback parser.
- Added idiCORE API-request status to connection status types and UI/backend status responses.
- Added `pnpm` override for `dompurify@3.4.11` to clear the production audit vulnerability from the Streamdown/Mermaid transitive dependency.
- Added IDI API-access request how-to at `docs/idi-core-api-access-request.md`.

## Live Proof

- `GET /auth/session`: `200`, `auth.required=true`, `auth.configured=false`, allowed domains include `heirright.com`, `solvys.io`, `texasequitypros.com`.
- `GET /api/admin/access`: `200`, allowed domains match Admin/auth expectations.
- `GET /api/discovery/external-source-run`: `405 method_not_allowed`.
- `GET /api/exports`: `405 method_not_allowed`.
- `GET /api/leads/fresh-batch`: `405 method_not_allowed`.
- `POST /api/discovery/external-source-run` without operator intent: `400 source_run_intent_required`.
- `GET /api/podio/oauth/start` while unauthenticated: `401`, no redirect location returned.
- `POST /api/discovery/tax-collector/receipt-run` from estate facts reached the Worker Browserbase path and returned `browser_workflow_required` with blocker `Browserbase Tax Collector function invocation failed with HTTP 402`.
- `POST /api/discovery/external-source-run` with operator intent reached the same Browserbase-backed Tax Collector path and returned source blockers instead of fake completion.
- `POST /api/exports` for Discovery returned one `single_pdf` artifact with `contentType=application/pdf`.
- `POST /api/exports` for Closing Docs returned one `single_pdf` artifact with `contentType=application/pdf`; direct artifact fetch returned `application/pdf` and `%PDF-1.4`.

## Browser Proof

- Desktop Chrome proof against the final deployment: auth gate visible, Google sign-in button visible, copy truthfully says Google sign-in is not configured, no console errors, no page errors, no failed requests.
- Mobile Chrome proof against the final deployment: auth gate visible, page scrolls past viewport height, no console errors, no page errors, no failed requests.
- Screenshot artifacts:
  - `/var/folders/bp/3nb6l28n1gv2zl2_84_ybhw80000gn/T/heirright-s35-final-desktop.png`
  - `/var/folders/bp/3nb6l28n1gv2zl2_84_ybhw80000gn/T/heirright-s35-final-mobile.png`

## Test Gates

- `pnpm build`: passed.
- `pnpm test`: passed.
- `pnpm audit --prod`: passed, no known vulnerabilities.
- Focused S35 route/auth guard test: passed.
- Secret leak scan: no real client secrets found in committed docs/source; test-only dummy env values are present in contract tests.

## Remaining External Actions

- Add DNS record at the domain provider: `A app.heirright.com -> 76.76.21.21`, then retry the Vercel alias/certificate.
- Provide or create Google OAuth client ID and client secret for `https://app.heirright.com/auth/callback`; until then the auth gate is enforced but cannot be cleared.
- Fund or upgrade Browserbase; live Tax Collector source proof is blocked by Browserbase HTTP 402.
- Complete Podio OAuth after Google auth and DNS are configured, then verify durable refresh storage and Lead Point profile readback.
- Request idiCORE API Secret, Site Key, and Company Key from IDI support before backend idiCORE live runs can be claimed.

## Readiness Judgment

The HeirRight code path is materially safer and more honest after S35: route guards hold, secrets are deployed by name, the Worker owns receipt-run acquisition, export returns single PDFs, and the UI no longer claims unavailable Google/IDI/Browserbase capability. It is not yet client-walk-in ready because the external deployment prerequisites above still block login, app-domain access, Browserbase receipt capture, and idiCORE API automation.
