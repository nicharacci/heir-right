# S36 Surface Denied Access Proof - 2026-07-08

## Scope
- Rename the intended production surface from `app.heirright.com` to `surface.heirright.com`.
- Add a denied-access page for Google users whose email/domain is not on the approved HeirRight access list.
- Clear stale auth cookies when a denied user returns from Google OAuth.
- Bounce denied users back to `/` after the denial message is visible.

## Implementation
- Serverless auth callback now returns a `403` denied page for disallowed Google emails/domains.
- Local artifact server mirrors the same denied-access behavior for parity.
- Denied page copy names the blocked domain and lists approved access domains.
- Denied page includes:
  - Meta refresh back to `/` after 6 seconds.
  - JavaScript `window.location.replace("/")` fallback after 6 seconds.
  - Manual `Return to HeirRight` link.
- Auth/session and Podio OAuth fallbacks now use `surface.heirright.com`.
- Vercel production env was updated for:
  - `APP_PUBLIC_URL=https://surface.heirright.com`
  - `GOOGLE_OAUTH_REDIRECT_URI=https://surface.heirright.com/auth/callback`
  - `PODIO_OAUTH_REDIRECT_URI=https://surface.heirright.com/api/podio/oauth/callback`
- Cloudflare Worker production deploy completed with Podio redirect pointed at Surface.
  - Worker version: `b2a5ee79-6dc7-476d-b5ae-e1363cff44af`

## Live Deploy Proof
- Vercel production deployment: `https://heirright-landing-demo-ode3c4g5n-solvys.vercel.app`
- Vercel deployment id: `dpl_5PtYK9mbjrxD9jo17Kv1EXcjjdXn`
- Vercel deployment status: Ready.
- Current alias: `https://heirright-landing-demo.vercel.app`
- Surface domain status: registered in Vercel, but DNS does not resolve yet.
- Vercel alias attempt for `surface.heirright.com` failed during certificate issuance while DNS was still missing.
- Required DNS action at domain provider:
  - `A surface.heirright.com 76.76.21.21`
- `curl https://surface.heirright.com/auth/session` failed with DNS resolution error, which matches the missing A record.

## Route Proof
- `GET /auth/session` on the live Vercel deployment returns:
  - `authenticated: false`
  - `auth.required: true`
  - `auth.configured: false`
  - allowed domains: `heirright.com`, `solvys.io`, `texasequitypros.com`
- `GET /api/podio/oauth/start` without a signed-in user returns `401` and does not start a Podio OAuth redirect.

## Browser Proof
- Desktop Chrome proof: `docs/run-point-daily/evidence/s36-surface-auth-final-desktop.png`
- Mobile Chrome proof: `docs/run-point-daily/evidence/s36-surface-auth-final-mobile.png`
- Both render the HeirRight Google-only sign-in gate with accepted domains.
- Both show the expected OAuth-not-configured copy until Google OAuth client credentials are installed.
- Browser proof had no console errors and no failed network requests.

## Test Proof
- `node apps/artifact/test/s35-production-route-guards.test.mjs` passed.
- `pnpm build` passed.
- `pnpm test` passed.
- `pnpm audit --prod` passed with no known vulnerabilities.

## Denied Access Acceptance
- Contract test covers the actual callback path using a disallowed Google profile email.
- The test verifies:
  - Response status is `403`.
  - Denied page is rendered.
  - Blocked domain is named.
  - `hr_session` is cleared.
  - OAuth state cookie is cleared.
  - User is bounced back to `/`.

## Remaining External Gates
- Add DNS record for `surface.heirright.com` at the DNS provider.
- Install the Google OAuth client ID and secret, then set Google redirect URI to `https://surface.heirright.com/auth/callback`.
- After DNS and Google OAuth are live, run a real allowed-domain login and a real disallowed-domain login from the browser.
