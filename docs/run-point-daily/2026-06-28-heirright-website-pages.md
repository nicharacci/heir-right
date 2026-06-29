# 2026-06-28 HeirRight Website Pages

## Goal

Turn the corrected one-page HeirRight build into a small production website with a landing page, dedicated Terms of Use and Privacy Policy page, dedicated Contact page, preserved landing-page form, and an interactive navy/gold background effect.

## Implementation

- Kept `site-v2/index.html` as the landing page and removed the full legal document reader from the landing page.
- Added `site-v2/legal.html` as the readable plain-text Terms of Use and Privacy Policy subpage.
- Added `site-v2/contact.html` as a standalone contact page with its own consultation form.
- Kept the landing-page contact form in place and gave it a distinct source value from the contact-page form.
- Added a shared `data-ambient-canvas` background on every route.
- Implemented an interactive canvas effect in `site-v2/src/main.ts`: navy/gold contour ribbons plus a subtle key-field motif that responds to pointer movement and scroll.
- Updated `site-v2/vite.config.ts` so `index.html`, `legal.html`, and `contact.html` all build as production entrypoints.
- Added `legal.html` and `contact.html` to `site-v2/public/sitemap.xml`.

## Verification

- `pnpm build` passed and emitted `dist/index.html`, `dist/legal.html`, and `dist/contact.html`.
- `git diff --check` passed.
- Browser proof used Playwright with system Chrome because the in-app Browser tool was unavailable.
- Route proof:
  - `/` rendered the landing page with one form and no full legal documents.
  - `/legal.html` rendered two legal documents and no form.
  - `/contact.html` rendered the standalone contact page with one form.
- Interactive background proof:
  - Desktop canvas initialized at `1440x1100`.
  - Mobile canvas initialized at `390x900`.
  - Pointer movement changed canvas pixels, proving the effect is interactive.
- Vercel dev form proof:
  - Landing form returned `HR-20260628-F90FA52F`.
  - Contact page form returned `HR-20260628-9925ABD6`.
- Production deployment:
  - Superseded: the first production website deploy targeted the app project `heirright-landing-demo` and was corrected.
  - Restored app project: `heirright-landing-demo`.
  - Restored app alias: `https://heirright-landing-demo.vercel.app`.
  - Restored app deployment id: `dpl_CoqyMU6FLEerHhbuAX9bwUgnGuwy`.
  - Restored app health proof: `/api/health` returned 200 with `{"ok":true,"service":"heirright-artifact"}`.
  - Website project: `heirright`.
  - Website alias: `https://heirright.vercel.app`.
  - Website deployment URL: `https://heirright-9a7jddc79-solvys.vercel.app`.
  - Website deployment id: `dpl_8sRznEzgSyBeaKxeYwP5wQL43tYt`.
  - Website Vercel inspect status: `Ready`.
  - App and website production error-log scans after correction: no logs found.
- Live route proof against `https://heirright.vercel.app`:
  - `/` returned 200, rendered the landing page with one form and no full legal documents.
  - `/legal.html` returned 200, rendered two readable legal documents and no form.
  - `/contact.html` returned 200, rendered the standalone contact page with one form.
  - Mobile `/legal.html` returned 200 with no horizontal overflow.
- Live interactive background proof:
  - Canvas initialized at `1440x1100` on desktop and `780x1800` on mobile retina.
  - Reduced-motion-off pointer movement changed the broad canvas sample by `78031` bytes.
- Live form proof:
  - Landing form returned `HR-20260628-ACC1BCBB`.
  - Contact page form returned `HR-20260628-20F819D0`.
  - Corrected website-domain form returned `HR-20260629-4CED78DE`.
- Visual proof inspected with `view_image`:
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-home.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-legal.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-contact.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-home-mobile.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-legal-mobile.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-landing-form-success.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-contact-form-success.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-live-home.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-live-legal.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-live-contact.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-live-legal-mobile.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-live-landing-form-success.png`
  - `docs/run-point-daily/screenshots/2026-06-28-heirright-website-live-contact-form-success.png`

## /solvys-heir-audit

Source checked: corrected HeirRight site proof, original website copy, logo assets, `site-v2` implementation, and `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.

Backward: converted the single public surface into a true small website with separate landing, legal, and contact routes. This supports public education and consultation intake only; it does not alter lead qualification, CRM/Podio writes, outreach, source research, or report generation.

UX pass: aligned. The public site uses client-facing estate-settlement language, keeps legal text readable without downloads, and provides clear contact paths without exposing developer language.

Forward: production website deployment is complete on the separate `heirright` Vercel project and `https://heirright.vercel.app` alias. The app remains on `heirright-landing-demo` and `https://heirright-landing-demo.vercel.app`. If a custom client domain is desired later, attach DNS to the `heirright` website project and re-run route, metadata, and form verification against that domain.

Alignment: aligned.

Required corrections before complete:
- none
