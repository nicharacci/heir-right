# 2026-06-27 HeirRight Legal Site Rebuild

## Goal

Rebuild the public `site-v2` surface as a serious, futuristic HeirRight legal-services style website inspired by the supplied Vorszk/Awwwards reference, while removing inherited-property, real-estate, house, and sale language from visible marketing copy.

## Progress

- Created branch `v0.1.0/heirright-legal-site-2026-06-27` from a clean canonical repo checkout.
- Verified `/Users/tifos/Desktop/HRight` is an artifact/source-copy folder without git; implementation and commit are in `/Users/tifos/Documents/Codebases/heir-right`.
- Confirmed the active website implementation is `site-v2` with Vite, TypeScript, Three.js, and the existing `/api/review-request` contact endpoint.
- Pulled original public-site copy from `https://www.heirright.com/` and `https://www.heirright.com/privacy-policy/`; home-page copy is excluded from the new visible story because it is real-estate/housing/sale-centered.
- Privacy policy source is the original WordPress privacy page, with stale Somi Homebuyers and `somihomebuyers.com` references corrected to HeirRight-facing references in the rebuilt policy.
- Awwwards reference inspected: Vorszk uses a stark black/white visual system, large mixed typography, spatial 3D/asset-led hero work, section-scale motion, and a modern stepped contact form element.
- Generated and inspected the implementation concept at `docs/run-point-daily/screenshots/2026-06-27-heirright-legal-site-concept.png`.
- Replaced the old inherited-property public-site copy with a three-section site: Terms of Use, Privacy Policy, and Contact.
- Implemented a Three.js hero scene with lime sculptural forms, a translucent central panel, line-separated legal rows, and a stepped contact form.
- Updated `/api/review-request` to accept legal-intake fields: `name`, `email`, `phone`, `matterType`, and `notes`.

## Verification

- `pnpm build` passed in `site-v2`; Vite reports the Three.js bundle-size warning only.
- `git diff --check` passed.
- Browser fallback: Playwright using system Chrome, because the in-app Browser tool was not available.
- Desktop proof at `docs/run-point-daily/screenshots/2026-06-27-heirright-legal-site-desktop.png`.
- Mobile proof at `docs/run-point-daily/screenshots/2026-06-27-heirright-legal-site-mobile.png`.
- Vercel dev proof at `http://127.0.0.1:5179/` returned `200` for `/api/review-request`.
- Form-success proof at `docs/run-point-daily/screenshots/2026-06-27-heirright-legal-site-form-success.png`; receipt observed: `HR-20260627-4CD630BD`.
- Canvas pixel proof:
  - Desktop canvas: `nonzero=89063`, `limeish=82657`.
  - Mobile canvas: `nonzero=33405`, `limeish=29115`.
- Browser console after fixes: no warnings or errors beyond Vite development connection messages.
- Copy scan over `site-v2/index.html`, `site-v2/src`, `site-v2/api`, and public metadata found no real-estate/housing terms in site copy; remaining `property` hits are HTML `meta property` attributes and the Terms phrase `Intellectual Property`.

## Final Review

- Source review confirmed the public page contains only Terms of Use, Privacy Policy, and Contact.
- Responsive CSS review confirmed desktop/tablet/mobile layouts use stable dimensions, no viewport-scaled fonts, no negative letter spacing, no nested cards, and no hidden-before-scroll content.
- API review confirmed the live contact endpoint accepts the new legal-intake fields and rejects missing required fields.
- Source scan found no TODO/FIXME/mock/demo implementation language in the public site code path.

## /solvys-heir-audit

Source checked: original `https://www.heirright.com/` home copy, original `https://www.heirright.com/privacy-policy/` copy, supplied `https://www.awwwards.com/sites/vorszk` reference, `site-v2` implementation, `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.

Backward: rebuilt the public marketing/legal surface into a restricted Terms, Privacy, and Contact site. This does not alter HeirRight deal-flow automation, CRM review, lead qualification, outreach, or report generation.

UX pass: aligned. The visible site is serious and client-facing, avoids developer terminology, and avoids real-estate/housing language except for policy/legal terms that are not property-sales copy.

Forward: deploy the committed `site-v2` branch when ready, then re-run production URL proof on the live domain after DNS/deploy routing is selected.

Alignment: aligned.

Required corrections before complete:
- none
