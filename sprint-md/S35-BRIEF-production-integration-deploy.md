# Sprint Brief: S35 -- Production Integration Deploy (single-agent)

## Intent

Deploy the newly received HeirRight integration information into the production app without leaking secrets, then prove the client-facing app can run on `app.heirright.com` with enforced Google login, durable Podio connection, Miami-Dade Clerk API readiness, Browserbase source workflows, and honest idiCORE status. When this is done, a HeirRight operator should see clear connected/blocked states and should not need engineering help to understand what is usable today.

## Branch Target

`v1.1.1/heirright-2026-06-30-s28-production-loop`

## Scope -- Included

- [ ] Set `app.heirright.com` as the intended production app domain and keep `heirright-leads.vercel.app` as an internal fallback alias only.
- [ ] Configure Vercel domain/DNS and OAuth callbacks for the production app URL.
- [ ] Deploy the received Miami-Dade Clerk Auth Key as backend-only secrets for Vercel and Worker runtime.
- [ ] Deploy the received Podio client ID and client secret as backend-only secrets.
- [ ] Configure Podio OAuth redirect to the production app domain and prove a durable refresh-token connection/readback path.
- [ ] Preserve Browserbase as the paid browser dependency, verify production project/function IDs, and keep batch caps/approval gates active.
- [ ] Keep idiCORE in portal/manual-import mode until IDI issues API Secret, Site Key, and Company Key.
- [ ] Add the idiCORE support request context to project docs without storing credentials.
- [ ] Fix production route parity discovered in audit: source/export routes must enforce method guards and explicit operator action.
- [ ] Prove live connection state, auth gate, external source run, Podio status, Miami-Dade status, and PDF export from the deployed app.

## Scope -- Excluded (OUT OF BOUNDS)

- Do not commit, print, screenshot, or document raw client secrets, auth keys, API keys, refresh tokens, OAuth client secrets, IDI credentials, or Browserbase keys.
- Do not claim idiCORE API automation until IDI issues API credentials and the backend supports their required auth shape.
- Do not send outreach, SMS, email, live Podio writes, or Google writes unless a controlled-readback approval gate is explicitly part of the validation step.
- Do not replace Browserbase with Ollama, Agent Reach, or a new browsing stack.
- Do not change legal-template language.
- Do not treat dry-run export success as production integration success.

## Known Issues to Preserve

- S34 hardened app-owned readiness and Browserbase/Podio classifications; preserve those semantics.
- Tax Collector receipt capture must start from estate facts, not only from a pasted listing URL.
- Browserbase batch runs must stay capped and approval-gated.
- IDI currently has portal access only. Both Batch and API were shown disabled in the portal screenshot, so the product must stay honest until IDI approves production credentials.
- Current audit found `GET /api/discovery/external-source-run` executing a run on production. This must be fixed; source runs should be `POST` only.
- Current audit found production auth disabled. This brief cannot close until the production auth gate is actually enforced.
- Existing unrelated `site-v2` dirty work must not be reverted.

## Received Integration Context

The client has provided these inputs through a private operator handoff:

- Miami-Dade Clerk of Courts Auth Key.
- Podio client ID.
- Podio client secret.
- IDI support instructions: request API Secret, Site Key, and Company Key from `idicoresupport@ididata.com`; organization must verify approved use-case criteria such as GLBA/DPPA before production credentials are issued.

Handle those values as secrets only. The brief intentionally names target env vars but does not include secret values.

## Design Pass

### Layout / Interaction

Use existing Settings, Admin, Doc Prep, and Help & Demos surfaces. Do not create a new deployment dashboard.

Operator-facing states:

- Auth should show Google login configured and the allowed domains from Admin.
- Podio should show `Connected`, `Reconnect required`, or `Setup blocked`, with durable team access distinguished from browser-session access.
- Miami-Dade Clerk API should show `Configured`, `Test failed`, or `Auth key needed`.
- Browserbase should show single-estate capture readiness plus paid batch caps.
- idiCORE should show `Portal/manual import only` until API credentials are issued.
- External source run errors should say exactly which provider blocked the run and what action is needed.

Use existing HeirRight dense workbench patterns. Avoid new decorative surfaces, gradients, oversized cards, or developer-console language.

### API / Service Shape

Deployment/env targets:

- Vercel production app:
  - `AUTH_REQUIRED=true`
  - `AUTH_ALLOWED_DOMAINS=heirright.com,solvys.io,texasequitypros.com`
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REDIRECT_URI=https://app.heirright.com/auth/callback`
  - `AUTH_SESSION_SECRET`
  - `HEIRRIGHT_WORKER_URL`
  - `HEIRRIGHT_API_TOKEN`
  - `PODIO_CLIENT_ID`
  - `PODIO_CLIENT_SECRET`
  - `PODIO_OAUTH_REDIRECT_URI=https://app.heirright.com/api/podio/oauth/callback`
  - `PODIO_DURABLE_AUTH_REQUIRED=true`
  - `MIAMI_DADE_CLERK_AUTH_KEY`
  - `BROWSERBASE_API_KEY`
  - `BROWSERBASE_PROJECT_ID`
  - `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`
  - `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`

- Worker production runtime:
  - `HEIRRIGHT_API_TOKEN`
  - `PODIO_CLIENT_ID`
  - `PODIO_CLIENT_SECRET`
  - `PODIO_OAUTH_REDIRECT_URI=https://app.heirright.com/api/podio/oauth/callback`
  - `PODIO_DURABLE_AUTH_REQUIRED=true`
  - `MIAMI_DADE_CLERK_AUTH_KEY`
  - `BROWSERBASE_API_KEY`
  - `BROWSERBASE_PROJECT_ID`
  - `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`
  - `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`
  - `IDI_CORE_LOGIN_URL=https://login.idicore.com/`
  - `IDI_CORE_PORTAL_URL=https://idicore.com/search/PropertySearch`
  - `IDI_CORE_LIVE_RUN_APPROVED=false`

Do not set `IDI_CORE_API_TOKEN` or `IDI_CORE_LIVE_RUN_APPROVED=true` until IDI issues API credentials and the integration is updated/tested for API Secret, Site Key, and Company Key.

Routes to verify/fix:

- `GET /auth/session` returns auth required/configured true on production.
- `GET /api/admin/access` returns the same allowed domains shown in Settings/Admin.
- `GET /api/connections/status` returns honest provider statuses.
- `GET /api/discovery/external-source-run` returns `405 method_not_allowed`.
- `POST /api/discovery/external-source-run` requires an explicit operator action and returns source facts or visible blockers.
- `GET /api/exports` returns `405 method_not_allowed` unless intentionally designed as safe status-only.
- `POST /api/exports` returns a single PDF artifact and does not claim live readback unless readback happened.
- `POST /api/discovery/tax-collector/receipt-run` blocks unapproved paid batch runs.

### Data / Agent Shape

No new AI or agentic layer. This is deterministic deployment, secret wiring, route hardening, provider readback, and browser proof.

For idiCORE, record the current state as:

- `accessMode: operator_portal`
- `apiAccess: requested_or_pending`
- `apiCredentials: not_issued`
- `manualImportAllowed: true`
- `backendAutomationAllowed: false`

When IDI issues credentials later, add a follow-up brief to map API Secret, Site Key, and Company Key into the backend service shape according to IDI docs. Do not assume the existing bearer-token path is sufficient.

### Security Rules

- Secret values belong only in Vercel env vars, Wrangler secrets, local uncommitted `.env.local`, or password manager handoff.
- Never put secret values into `sprint-md`, `docs`, screenshots, test fixtures, Playwright traces, route responses, logs, generated PDFs, or browser local storage.
- If a secret is accidentally committed or exposed in a screenshot, stop and rotate it before continuing.
- Use token-redaction tests after deployment.
- Live route proofs must summarize statuses, not print secrets.

### Aesthetic Rules

- Existing Settings/Admin/Doc Prep surfaces only; no new marketing cards.
- User-facing copy should say `Google login`, `Podio`, `Miami-Dade Clerk`, `Tax Collector`, `Browserbase source capture`, `idiCORE portal/manual import`, `readback`, and `approval`.
- Avoid raw env-var names in visible UI except inside developer-only docs.
- No gradients, emojis, decorative button borders, AI sparkles, or new Liquid Glass experiments.
- New popups, rails, drawers, modals, sheets, and panels must include enter/exit transitions.

## Development Flow

1. **Preflight and secret hygiene**
   - Confirm working tree and do not revert unrelated dirty files.
   - Confirm production targets: Vercel project, Worker route, Browserbase project, Podio app, Google OAuth project, DNS host.
   - Create a private local checklist of secret values from the client handoff; do not write values into repo files.
   - Confirm no current repo file contains the newly received keys.

2. **Domain and auth configuration**
   - Add `app.heirright.com` to Vercel.
   - Configure DNS `app` record to Vercel.
   - Update Google OAuth allowed redirect URI to `https://app.heirright.com/auth/callback`.
   - Set Vercel auth env vars and `AUTH_REQUIRED=true`.
   - Verify production `/auth/session` reports `required: true`, `configured: true`, and allowed domains include `heirright.com`, `solvys.io`, and `texasequitypros.com`.

3. **Worker and app secret deployment**
   - Deploy Miami-Dade Clerk key to both app/worker runtime locations that call Clerk APIs.
   - Deploy Podio client ID/secret to app/worker runtime.
   - Deploy or verify Browserbase app/worker secrets and function IDs.
   - Ensure `HEIRRIGHT_WORKER_URL` points to the live Worker.
   - Ensure `HEIRRIGHT_API_TOKEN` is shared between app and Worker without exposing it.

4. **Podio durable OAuth**
   - Configure Podio redirect URI as `https://app.heirright.com/api/podio/oauth/callback`.
   - Open the production Podio connect flow from Settings.
   - Complete OAuth with approved HeirRight account.
   - Confirm refresh token storage is durable server-side/KV-backed.
   - Reopen a fresh browser session and verify Podio remains connected.
   - Run one non-destructive readback/status proof.

5. **Miami-Dade Clerk API proof**
   - Verify `/api/connections/status` moves Miami-Dade Clerk from blocked to configured/tested.
   - Run a controlled source proof against a known sample estate/folio.
   - Confirm Official Records, Civil/Probate, or Clerk blockers are based on actual API response, not missing credentials.
   - Persist source evidence without exposing the Auth Key.

6. **Browserbase production proof**
   - Verify Browserbase project ID, API key, Tax Collector function ID, and Vital/Obituary function ID.
   - Run one single-estate Tax Collector receipt workflow from estate facts.
   - Confirm batch source runs remain blocked without explicit paid batch approval.
   - Record usage limits/caps in Settings and final evidence.

7. **idiCORE request and app status**
   - Save the IDI request how-to/copy-paste email in project docs without credentials.
   - Keep app status as operator portal/manual import until API credentials are issued.
   - Confirm Settings and Doc Prep do not claim backend IDI automation.
   - Add a visible note that API Secret, Site Key, and Company Key are pending from IDI support.

8. **Route hardening**
   - Fix production server route parity so source/export mutation routes enforce methods.
   - `GET /api/discovery/external-source-run` must not execute a run.
   - `GET /api/leads/fresh-batch` must fail fast or return safe status, not hang.
   - `POST` routes must require explicit operator intent and return clear blockers.

9. **Production validation**
   - Run build/test locally.
   - Deploy app and Worker.
   - Use browser proof on `https://app.heirright.com`.
   - Verify login overlay, allowed-domain behavior, avatar/account menu, Settings statuses, Podio connection, Miami-Dade source run, Browserbase source run, and export PDF.
   - Rerun `/solvys-audit` style checks focused on auth, route guards, provider statuses, and user loop.

10. **Progress and evidence**
   - Write a short progress/evidence file under `probate-lead-engine/docs/run-point-daily/`.
   - Include route status summaries, screenshots with no secrets, and final blocker list.
   - Update final readiness score honestly.

## Acceptance Criteria

- [ ] `https://app.heirright.com` resolves and is the production app URL.
- [ ] `heirright-leads.vercel.app` remains an internal fallback, not the client-facing URL.
- [ ] Unauthenticated users see the blurred Google login gate.
- [ ] Disallowed email domains cannot clear the gate.
- [ ] Allowed business domains can clear the gate.
- [ ] `/auth/session` reports auth required/configured true on production.
- [ ] Admin allowed domains and auth session allowed domains match.
- [ ] Podio status remains connected after a fresh browser session.
- [ ] Podio uses durable server-side refresh/app auth, not browser-session-only access.
- [ ] Miami-Dade Clerk Auth Key is deployed and live source proof runs without credential blockers.
- [ ] Browserbase single-estate source capture works from estate facts.
- [ ] Browserbase batch source runs remain capped and approval-gated.
- [ ] idiCORE is visible as portal/manual import only until IDI issues API credentials.
- [ ] `GET /api/discovery/external-source-run` returns `405`.
- [ ] `GET /api/leads/fresh-batch` does not hang.
- [ ] Export returns one single PDF artifact per selected flow.
- [ ] No route response, log, screenshot, PDF, or docs file exposes secrets.
- [ ] `pnpm build` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm audit --prod` is either clean or has an explicit patched/accepted risk note before ship.
- [ ] Browser proof on desktop and mobile has no console errors tied to auth/source/export flows.

## Validation Commands

```bash
# Local build and tests
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
pnpm test
node apps/artifact/test/s34-app-owned-readiness.test.mjs
pnpm audit --prod

# Secret leak scan, values must not appear
rg -n --hidden -g '!node_modules/**' -g '!dist/**' -g '!output/**' -g '!apps/artifact/.vercel/**' -g '!*.lock' -g '!pnpm-lock.yaml' \
  'MIAMI_DADE_AUTH_KEY_VALUE|PODIO_CLIENT_SECRET_VALUE|BROWSERBASE_KEY_VALUE|IDI_SECRET_VALUE' .

# Production route proof after deploy
node - <<'NODE'
const base = 'https://app.heirright.com';
for (const path of ['/auth/session', '/api/admin/access', '/api/connections/status']) {
  const res = await fetch(base + path);
  console.log(path, res.status, res.headers.get('content-type'));
  console.log((await res.text()).slice(0, 500));
}
for (const path of ['/api/discovery/external-source-run', '/api/exports', '/api/leads/fresh-batch']) {
  const res = await fetch(base + path);
  console.log(path, res.status, (await res.text()).slice(0, 200));
}
NODE
```

## Commit Format

```text
chore: deploy HeirRight production integrations
```
