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

## Open Gates

- [x] Shared Vercel route auth and auth-first paint
- [ ] Real Discovery/Closing single and batch PDFs
- [ ] Estate-fact-driven Tax Collector receipt capture with live provider proof
- [ ] Durable Podio session/readback proof
- [ ] Responsive Document Prep and keyboard/browser E2E
- [ ] Production domain/OAuth deployment proof
- [ ] Final Solvys and HeirRight hostile review
