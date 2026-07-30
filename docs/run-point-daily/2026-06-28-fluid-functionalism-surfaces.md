# 2026-06-28 Fluid Functionalism Surfaces

## Reference

- Source: `https://www.fluidfunctionalism.com/docs/surfaces`
- Adapted pattern: eight dark surface levels, inset rings, layered shadows, and relative elevation for nested panels, dropdowns, and modals.
- HRight adjustment: surface level 1 stays the approved flat app background `#202124`; higher levels lift from that value instead of adopting the reference site's darker base color.

## Implementation

- Added the surface token ladder and shadow ladder to `apps/artifact/src/index.html`.
- Tagged the document body with `data-surface-system="fluid-functionalism"`.
- Kept shell, sidebar, topbar, filters, results, and workbench on `surface-1`.
- Mapped controls, cards, document rows, DocPrep tabs, import/export popovers, headless menus, and modals onto higher surface levels.
- Kept primary blue actions as action controls rather than surface tokens.

## Verification

- `git diff --check` passed.
- `pnpm --filter @ple/artifact build` passed.
- Local Chrome proof at `http://localhost:4173/?surface=fluid-functionalism`:
  - Page identity: `HeirRight Lead Review`.
  - Body background: `rgb(32, 33, 36)`.
  - Body surface marker: `fluid-functionalism`.
  - Import chip: `surface-2`.
  - Import popover: `surface-5`.
  - CRM import modal: `surface-5`; modal header: `surface-6`.
  - Closing Docs active tab: `surface-3`; default flow tab: `surface-2`.
  - Document shell: `surface-2`; document rows: `surface-3`.
  - Batch import created a local CRM estate.
  - Closing Docs opened with 11 document rows.
  - Browser console warnings/errors: none.
  - Desktop screenshot: `/tmp/hright-fluid-surfaces-desktop-final.png`.
- Mobile screenshot proof at 390 x 844:
  - Import chip, Prep export, and quick actions stay inside the viewport.
  - Dashboard cards retain dark contrast without bright background regression.
  - Screenshot: `/tmp/hright-fluid-surfaces-mobile-final.png`.
