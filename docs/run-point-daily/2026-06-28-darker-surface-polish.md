# Darker Surface Polish

## Scope

- CSS-only color and shadow pass for the Fluid Functionalism surface layer.
- No markup, workflow, copy, routing, data, or import/export behavior changes.
- New darker treatment is gated behind `body[data-surface-system="fluid-functionalism"]` so unmarked older app paths keep their prior color cascade.

## Implementation

- Darkened the active surface ladder from the prior `#202124` base to a `#17181b` canvas with deeper card and row levels.
- Increased card and information-surface depth by using stronger scoped shadow tokens on panels, DocPrep cards, rows, flow tabs, and overlays.
- Reduced white highlight gradients so the UI reads darker while preserving borders and active-state contrast.
- Kept the previous unmarked theme behavior intact by moving the late surface overrides from broad/theme selectors to `data-surface-system` selectors.

## Verification

- `git diff --check`
- `pnpm --filter @ple/artifact build`
- In-app browser QA on `http://localhost:4173/`
  - Dashboard loaded with no console warnings/errors.
  - Import split chip opened the batch menu.
  - CSV batch import opened the modal and submitted a test estate.
  - Document Prep opened and Closing Docs selected successfully.
  - Current Fluid marker proof: body `rgb(23, 24, 27)`, DocPrep shell `rgb(27, 28, 32)`, rows `rgb(32, 33, 39)`, active flow shadow present.
- Legacy-marker probe on `http://localhost:4184/`
  - Removed `data-surface-system` in a temporary non-repo copy.
  - Unmarked path retained old body `rgb(32, 33, 36)`, old surface token `#202124`, and no new Fluid card shadow.
- Screenshot evidence:
  - `/tmp/hright-darker-surface-local-desktop.png`
  - `/tmp/hright-darker-surface-local-mobile.png`
  - `/tmp/hright-darker-surface-legacy-probe.png`
