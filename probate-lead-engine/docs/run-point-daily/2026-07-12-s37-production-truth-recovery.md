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

## Open Gates

- [ ] Shared Vercel route auth and auth-first paint
- [ ] Real Discovery/Closing single and batch PDFs
- [ ] Estate-fact-driven Tax Collector receipt capture with live provider proof
- [ ] Durable Podio session/readback proof
- [ ] Responsive Document Prep and keyboard/browser E2E
- [ ] Production domain/OAuth deployment proof
- [ ] Final Solvys and HeirRight hostile review
