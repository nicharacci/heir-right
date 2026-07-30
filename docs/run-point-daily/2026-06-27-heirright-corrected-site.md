# 2026-06-27 HeirRight Corrected Site Pass

## Goal

Correct the site rebuild so the landing page uses the original HeirRight website copy, the visual format follows the supplied glass-panel reference without the lime/lava hero forms, the color palette follows the provided HeirRight logo, and Terms of Use plus Privacy Policy are readable as plain text on the page.

## Sources

- Original HeirRight home copy: `https://www.heirright.com/` / WordPress page slug `home-2-2`.
- Original privacy policy copy: `https://www.heirright.com/privacy-policy/`.
- Logo PDF: `/Users/tifos/Downloads/HR LOGO.pdf`.
- Accepted visual format: `/var/folders/bp/3nb6l28n1gv2zl2_84_ybhw80000gn/T/codex-clipboard-08910b05-5494-4270-8544-a69e106f7c77.png`.

## Implementation

- Rebuilt `site-v2/index.html` around the restored HeirRight landing copy: hero, inheritance recovery copy, heavy-lifting bullets, estate settlement comparison, reviews, About Us, beliefs, cash-offer program, reasons list, legal docs, and contact.
- Replaced the lime/Three.js hero with a static navy/gold glass format matching the supplied reference structure.
- Extracted logo assets from the PDF render and removed the inherited PDF white page background from the shield mark.
- Added SVG logo wrappers/assets:
  - `site-v2/public/assets/heirright-logo.svg`
  - `site-v2/public/assets/heirright-logo-light.svg`
  - `site-v2/public/assets/heirright-mark.svg`
  - `site-v2/public/assets/heirright-preview-bg.svg`
- Added preview/favicons:
  - `site-v2/public/assets/heirright-preview.png`
  - `site-v2/public/assets/favicon-192.png`
  - `site-v2/public/assets/favicon-512.png`
- Updated the contact endpoint to accept the restored site fields: address, name, email, phone, and notes.

## Verification

- `pnpm build` passed.
- `git diff --check` passed before the final note.
- Browser proof used Playwright with system Chrome because the in-app Browser tool was unavailable.
- Accepted reference image inspected with `view_image`.
- Final desktop screenshot inspected with `view_image`: `docs/run-point-daily/screenshots/2026-06-27-heirright-corrected-desktop-final.png`.
- Final mobile screenshot inspected with `view_image`: `docs/run-point-daily/screenshots/2026-06-27-heirright-corrected-mobile-final.png`.
- Form success screenshot inspected with `view_image`: `docs/run-point-daily/screenshots/2026-06-27-heirright-corrected-form-success.png`.
- Vercel dev form POST returned `200` with receipt `HR-20260627-E2AE34D6`.
- Asset load check confirmed SVG logo/mark images load with natural dimensions and no browser console errors.
- Search check found no remaining `lava`, `lime`, `three`, `CapsuleGeometry`, `matterType`, or downloadable legal-doc link path in the site code. The only `download` text hit is the Privacy Policy cookie definition word `downloaded`.

## /solvys-heir-audit

Source checked: original HeirRight website copy, original privacy page, provided logo PDF, accepted visual reference screenshot, `site-v2` implementation, `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.

Backward: rebuilt the public website to carry HeirRight's real inherited-property settlement message, logo palette, readable Terms/Privacy documents, and a working consultation form. This supports public intake and client-facing explanation only; it does not alter CRM, outreach, lead qualification, report generation, or deal-flow automation.

UX pass: aligned. The site is client-facing, not an engineering console. It uses estate-settlement language from the source website and preserves a clear consultation path for non-technical users.

Forward: deploy the committed `site-v2` branch when ready, then verify the production URL and preview metadata on the selected live domain.

Alignment: aligned.

Required corrections before complete:
- none
