# Website client edits - 2026-07-09

## Scope

Applied the client's July 8 website copy and section requests to the active
`site-v2` landing page.

## Progress

- Updated the hero headline, supporting copy, primary consultation CTA, and side
  panel copy.
- Removed the hero proof-stat strip that was outside the requested first-screen
  copy.
- Updated the support cards for attorney fees, ownership disputes, creditor
  claims/liens/tax issues, and property condition.
- Reworked the process section around "CLAIM MONEY FROM YOUR INHERITED HOUSE
  HASSLE-FREE" and the three requested plain-language steps.
- Removed the extra review-boundaries, testimonials, about, reason, and legal
  teaser blocks so the page follows the requested client flow.
- Retitled the gallery section to "Real families, real settlements."
- Replaced the comparison table with the requested Traditional Sale vs
  HeirRight Way rows.
- Updated the final consultation paragraph.
- Synced the Spanish page generator with the edited English source.

- 2026-07-09: `pnpm build` passed from `site-v2`, including locale generation,
  TypeScript, and Vite production build.
- 2026-07-09: Local Vite site tested at `http://127.0.0.1:5173/` with
  Playwright/Chromium on desktop `1440x1000` and mobile `390x844`. Verified
  requested copy, removed sections, CTA scroll, required-field blocking, and
  valid form step progression. Screenshots: `/tmp/heirright-desktop.png` and
  `/tmp/heirright-mobile.png`.
- 2026-07-09: `expect-cli` could not run because its configured Claude agent is
  not authenticated on this machine. Replaced with direct Playwright browser
  verification through the bundled Codex runtime.
- 2026-07-09: Production preview from built `dist/` passed browser smoke at
  `http://127.0.0.1:4173/`; verified edited hero, gallery/comparison/contact
  copy, CTA scroll, and no console/page errors. Screenshot:
  `/tmp/heirright-preview.png`.
- 2026-07-09: Final dedicated review completed against the client plan. Source,
  generated Spanish page, built output, route status, stale-section search, and
  whitespace diff check all passed.
- 2026-07-09: Pushed commit `c0bdff5` and deployed `site-v2` to the Vercel
  production project `solvys/heirright`. Production deployment:
  `dpl_Ef1Y9aKqrPAdiCDFJj2AEjmi6SC5` (`https://heirright.vercel.app`).
- 2026-07-09: Live verification passed for `/`, `/es/`, `/contact.html`,
  `/legal.html`, `/terms.html`, `/privacy.html`, and `/api/review-request`.
  Desktop `1440x1000` and mobile `390x844` browser checks found no console or
  network errors, broken images, or meaningful horizontal overflow. CTA and
  required-field form progression passed without submitting a live follow-up
  request. Screenshots: `/tmp/heirright-live-desktop.webp` and
  `/tmp/heirright-live-mobile.webp`.
- 2026-07-09: Custom-domain promotion remains externally blocked. Vercel has
  `heirright.com` assigned to the new production deployment, but GoDaddy DNS
  still resolves the apex to the previous WordPress host at `160.153.0.141`.
  The required provider-side record is `A heirright.com 76.76.21.21` (or the
  domain nameservers must move to Vercel). No GoDaddy/DNS credentials are
  available in this workspace, so the public apex still serves the old site.
- 2026-07-09: Removed only the five client-identified carousel entries
  `property-10.jpg` through `property-14.jpg`. Kept the brick-house feature
  (`property-01.jpg`) and every other carousel entry and source asset intact.
  Production build passed. Real-Chrome checks at desktop `1440x1000` and mobile
  `390x844` verified all 10 remaining tiles, active-state switching, rapid
  selection, horizontal mobile scrolling, zero broken images, zero document
  overflow, and no console or network failures. Screenshots:
  `/tmp/heirright-carousel-desktop.webp` and
  `/tmp/heirright-carousel-mobile.webp`.
- 2026-07-09: Deployed the carousel cleanup to Vercel production as
  `dpl_AesmFYp8Vqff726Vmbifixduzppx`. Live checks at
  `https://heirright.vercel.app` confirmed the same 10 retained tiles, no
  references or requests for `property-10.jpg` through `property-14.jpg`, the
  brick house as the default feature, working tile selection, and clean mobile
  console/network state. Live screenshot:
  `/tmp/heirright-carousel-live-mobile.webp`.
