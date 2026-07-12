# S37 Production Truth Recovery

Date: 2026-07-12
Branch: `v1.1.1/heirright-2026-06-30-s28-production-loop`
Brief: `sprint-md/S37-BRIEF-production-truth-recovery.md`

## Completion Rule

S37 remains open until every app-owned acceptance gate is proven through fresh tests, browser behavior, provider readback where available, and inspection of the generated PDFs themselves. Route existence, HTTP 200, PDF MIME type, mocked final providers, and UI copy are not completion proof.

## Baseline

- The production Vercel alias serves the auth gate, but Google OAuth is not configured and `surface.heirright.com` does not resolve.
- Vercel `/api/admin/access` and `/api/connections/status` are readable without a user session; Admin POST can reach persistence/support-routing side effects without a shared route guard.
- Worker operational routes correctly require a signed HeirRight session or internal bearer token.
- All export variants point to `/api/reports/pdf`, whose current renderer creates a one-page index from query parameters rather than embedding the Discovery or Closing packet.
- The stored S33 Discovery/Closing single/batch PDFs are one-page cover sheets and do not satisfy the hired workflow packet.
- The current dry pipeline keeps tax receipt, payer, deed/OR book, probate, and verified-heir fields unresolved while still producing a report shell.
- Browserbase Tax Collector production evidence previously stopped at HTTP 402, so autonomous receipt capture is not yet proven live.
- Podio reports a bearer connection but lacks the approved Lead profile/durable refresh readback needed for team-proof completion.
- Mobile Document Prep has right-edge overflow at 390px even though vertical page scrolling works.

## Evidence Log

### Milestone 0 - Contract and baseline

- Loaded the S37 brief, shared Solvys design canon, HeirRight workflow checklist, canonical repo instructions, route/auth seams, export renderer, and current generated packet evidence.
- Confirmed the working tree contained only the new S37 brief before execution began.
- Self-review: the work must repair the shared renderer and shared route boundary first; patching individual buttons or handlers would leave sibling paths unsafe and inconsistent.

### Milestone 1 - Shared route boundary and auth-first paint

- Added one shared API authorization guard for signed HeirRight sessions and the internal bearer path, then applied it to every operational Vercel handler that can read or mutate estate, integration, export, outreach, or support data.
- Changed the initial document state to render a blocking access-check card before application JavaScript runs, which removes the pre-session workspace flash.
- Added `s37-route-auth.test.mjs` to prove anonymous rejection, signed-session access, internal-service access, initial auth gating, and the complete protected-handler inventory.
- Fresh proof: `pnpm turbo run build --force` and `pnpm turbo run test --force` both passed with remote caching disabled. The worker validation produced 61 normalized facts and all pre-existing S31-S35 contracts remained green.
- Anti-negligence review: auth endpoints and intentionally public helpers remain outside the operational inventory; all stateful or sensitive handlers are covered. The local server's intentionally public health metadata remains unchanged.

### Milestone 2 - Durable Discovery packet artifacts

- Replaced the query-string cover-sheet renderer with a deterministic packet model and `pdf-lib` renderer. `pdf-lib` is MIT-licensed, runs in the existing Cloudflare Worker compatibility mode, and provides testable multi-page output without a second document service.
- Added immutable packet records in a dedicated Cloudflare KV namespace. Export returns an artifact ID, content hash, estate/section map, expiration, and one PDF URL; retrieval verifies the stored model hash before rendering.
- Discovery packets now include estate summary, stop rules, offer math, tax and receipt review, deed/title, probate/court, vital records, backstory, family/contact review, source evidence, and blockers/next action. Long estate names and source URLs wrap against measured page width.
- Removed query-controlled report generation. `GET /api/reports/pdf` accepts only a validated artifact ID and proxies the authenticated Worker PDF; sample estates and generic family/contact rows are blocked from export.
- Single and batch exports share the same model and renderer. The focused content test produced 13 and 25 pages respectively, asserted every selected estate exactly once, rejected old cover-sheet URLs, and caught artifact tampering.
- Visual review rendered the cover, estate summary, tax, backstory, contact, and blocker pages to images. An initial clipped title and overlong URL were found and repaired before deployment.
- Live proof: Worker version `a2316bd7-c413-408f-abc8-097879dfd0a7` and the new packet KV completed an authenticated artifact round trip. The downloaded live PDF was 13 pages / 30,692 bytes, all required Discovery headings extracted successfully, and forbidden placeholder identities were absent.
- Fresh regression proof: `pnpm turbo run test --force` passed all five tasks uncached after deployment, including the 61-fact worker validation and the new PDF content/integrity assertions.
- Rotated the shared Worker/Vercel bearer token and auth session secret as write-only provider secrets, then set the production Worker URL, Surface origin, OAuth redirect, allowed domains, and auth-required flag without committing values.
- Anti-negligence review: Closing remains deliberately blocked because the repository and local machine contain the fourteen form names but none of the client legal template files or designated field map. The app no longer claims a Closing PDF exists when those immutable inputs are absent.

### Milestone 3A - Tax Collector Browserbase production contract

- Ran the production Worker with a real Miami-Dade folio/address/owner payload and the configured Browserbase API key plus deployed Tax Collector function ID. The provider accepted authentication and function lookup, then returned HTTP 402 before creating a browser session.
- Corrected the run contract so every Browserbase invocation is marked `paidRun: true`, including provider failures. Added distinct modes for billing required, concurrency/rate limit, timeout, and function failure instead of collapsing every provider response into a generic browser blocker.
- Enabled the Browserbase managed proxy for the county-tax workflow. Captcha solving, session recording, session logs, and PDF viewer support remain enabled in the function invocation settings.
- Added worker validation for the successful receipt-link result and the billing-required result. Fresh build and validation passed with 61 normalized facts.
- Deployed Worker version `822cb6b6-0db2-4b94-91c3-609b927afef2`, rotated the shared internal bearer without exposing it, and repeated the live call. The response was correctly classified as `browserbase_billing_required`, `paidRun: true`, HTTP 402, with the exact folio/address search input preserved.
- Anti-negligence review: Browserbase configuration is proven valid, but live receipt retrieval cannot be marked complete while the provider refuses to start a session for billing. This is an external account prerequisite rather than an app fallback; the app now reports it explicitly and does not pretend the public search ran.

## Open Gates

- [x] Shared Vercel route auth and auth-first paint
- [ ] Real Discovery/Closing single and batch PDFs
- [ ] Estate-fact-driven Tax Collector receipt capture with live provider proof
- [ ] Durable Podio session/readback proof
- [ ] Responsive Document Prep and keyboard/browser E2E
- [ ] Production domain/OAuth deployment proof
- [ ] Final Solvys and HeirRight hostile review
