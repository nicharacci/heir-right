# S41 BeUI Repository Foundation

Date: 2026-08-05

Revision: `S41-r2-2026-08-05T02:15:00Z`

Track: `S41 / T3 BeUI Repository Foundation`

State: public BeUI Wave 1 installed and compile-proven; BeUI Pro Wave 2 blocked

## Problem and named solution

HeirRight needs a source-owned React component chassis before rebuilt UI work can begin, while the current vanilla artifact, its Web Awesome and AG Grid runtime contract, and every rendered operator behavior remain stable.

Deliver the **S41 BeUI Compile-Only Chassis** so the next authorized UI owner can build from verified BeUI source without introducing an untracked library, global Tailwind reset, second mounted runtime, secret leak, or premature visual migration.

Design impact: not applicable. This track installs and compiles source only. It does not mount, prototype, redesign, recolor, or change a rendered surface.

## Pickup and ownership

- Environment: repository-backed Codex Cloud, ID `6a6b64c3a9ac832cb1491c495e4a55de`, label `Solvys (Cloud)`
- Canonical repository: `https://github.com/nicharacci/heir-right.git`
- Managed repository attachment: `/workspaces/heir-right`
- Task-owned detached worktree: `/home/codespace/.codex/worktrees/3fc12015-7a53-4514-9719-b1990778f981/heir-right`
- Exact base: `d8e1d23dc81f587a4c9e107e9cc3dad98e17ce31`
- Requested base ref: `2026-08-04-s41-settings-audit-removal`
- Date integration branch: `2026-08-04`
- Task checkpoint: `refs/sprints/S41/T3/P1`
- Owner: S41 T3 foundation owner through compile proof and checkpoint publication
- Next owner: the separately authorized BeUI surface-rebuild track after design acceptance and source-transfer authority

## Verified official sources and access basis

| Source | Verified fact | Disposition |
| --- | --- | --- |
| `https://beui.dev` | Public BeUI v2 source registry for React, Motion, and Tailwind components | Adopted as copy-source foundation |
| `https://beui.dev/r` | Current public registry index and exact component slugs | Adopted |
| `https://beui.dev/r/{name}.json` | Public shadcn-compatible registry item endpoint | Adopted for slug, dependency, and target-path metadata |
| `https://github.com/starc007/ui-components` | Canonical public source repository | Adopted at `bf16e25ac05651eb924006d5e631c54cbead3ac0` |
| `https://github.com/starc007/ui-components/blob/main/LICENSE` | MIT License, copyright 2026 Saurabh Chauhan | License copied to `src/beui-foundation/LICENSE.beui.md` |
| `https://pro.beui.dev/components/installation` | Private shadcn registry requiring `BEUI_PRO_TOKEN`; React 19 and Tailwind CSS v4 documented prerequisites | Planned and blocked because the process-scoped token is absent |
| `https://pro.beui.dev/r/{name}.json` | Authenticated Pro item endpoint | No request made |

The public registry items were retrieved from the verified registry metadata and copied from the canonical GitHub source at the exact revision above. Import aliases were changed only from upstream `@/components` and `@/lib` roots to `@/beui-foundation/components` and `@/beui-foundation/lib`. No behavior or visual source was otherwise adapted.

The shadcn `4.16.1` dry-run correctly recognized the project but requires a conventional `tsconfig.json`. This track owns only `tsconfig.ui.json`, so no unapproved shim was created. BeUI documents copy-source ownership as a supported installation path. `components.json` remains ready for future namespaced CLI use in a conventionally configured successor lane.

Paste approval status: the source is recorded in this repository ledger. Paste was unavailable in this Cloud lane, so no pin was claimed.

## Compatibility and installed versions

| Contract | Installed or observed version | Proof basis |
| --- | ---: | --- |
| Node.js | `24.14.0` | Runtime command; repository requires Node 20 or newer |
| pnpm | `10.32.1` | Runtime command; lockfile v9 accepted |
| esbuild | `0.28.1` | Existing artifact production bundler |
| React | `19.2.6` | Exact artifact dependency, aligned with the existing workspace React line |
| React DOM | `19.2.6` | Exact artifact dependency |
| React types | `19.2.15` | Exact artifact development dependency |
| React DOM types | `19.2.3` | Exact artifact development dependency |
| Motion | `12.43.0` | Exact dependency; current peer range supports React 18 and 19 |
| Tailwind CSS | `4.3.3` | Exact development dependency |
| Tailwind PostCSS adapter | `4.3.3` | In-memory CSS compile path |
| PostCSS | `8.5.25` | In-memory CSS compile path |
| TypeScript | `5.9.3` | Strict `tsconfig.ui.json` compile gate |
| `clsx` | `2.1.1` | BeUI source dependency |
| `tailwind-merge` | `3.6.0` | BeUI source dependency |
| `lucide-react` | `1.28.0` | BeUI source-internal icons only; no existing runtime icon-facade migration |
| `@tanstack/react-virtual` | `3.14.9` | BeUI table source dependency; peer range supports React 19 |
| shadcn CLI inspected | `4.16.1` | Registry/config compatibility dry-run only; not persisted |

Tailwind CSS v4 targets modern browsers. The current foundation is unmounted, so its browser floor does not alter the legacy artifact's current browser contract.

Installed package metadata reports MIT for React, React DOM, Motion, Tailwind CSS, the Tailwind PostCSS adapter, PostCSS, `clsx`, `tailwind-merge`, and TanStack React Virtual. `lucide-react` reports ISC. Lucide remains internal to copied BeUI source and does not replace HeirRight's mounted Nucleo icon facade.

## Installation foundation disposition

| Foundation | State | Target seam, owner, fallback, and protected zones |
| --- | --- | --- |
| BeUI public | Installed and compile-proven | Future React UI under `src/beui-foundation/**`; presentation only; current vanilla runtime remains fallback and protected |
| BeUI Pro | Planned, blocked | Private source only after a clean `BEUI_PRO_TOKEN` exists; no fallback fetch and no guessed slug installation |
| Vercel UI | Not applicable | This bounded track has no BeUI ownership gap requiring a secondary interaction source |
| Bklit | Not applicable | No new visualization is in scope; AG Grid Community remains protected |
| EvilCharts | Not applicable | No secondary visualization gap exists |

## Installed public registry items

| Exact slug | Primary future seam | Main installed module |
| --- | --- | --- |
| `@beui/button-base` | General controls | `components/motion/button/base.tsx` |
| `@beui/animated-sidebar` | Future shell chassis | `components/motion/animated-sidebar.tsx` |
| `@beui/input` | Text controls | `components/motion/input.tsx` |
| `@beui/select` | Account and form selection | `components/motion/select.tsx` |
| `@beui/checkbox` | Choice controls and table selection | `components/motion/checkbox.tsx` |
| `@beui/switch` | Binary controls | `components/motion/switch.tsx` |
| `@beui/file-upload` | Future document intake | `components/motion/file-upload.tsx` |
| `@beui/popover` | Account and contextual surfaces | `components/motion/popover.tsx` |
| `@beui/tooltip` | Focus and hover help | `components/motion/tooltip.tsx` |
| `@beui/table` | Future table foundation and skeleton/menu states | `components/motion/table/index.tsx` |
| `@beui/loader` | Table-adjacent loading state | `components/motion/loader.tsx` |
| `@beui/animated-badge` | Table-adjacent status state | `components/motion/animated-badge.tsx` |

No Pro registry item or Pro source file is installed. Wave 2 must select its exact namespaced slugs from authenticated component pages after the token gate passes.

## Installed files

Repository configuration and compile boundary:

- `apps/artifact/components.json`
- `apps/artifact/tsconfig.ui.json`
- `apps/artifact/src/styles/beui-foundation.css`
- `apps/artifact/src/beui-foundation/compile-proof.tsx`
- `apps/artifact/src/beui-foundation/LICENSE.beui.md`

Copied BeUI source:

- `components/motion/animated-badge.tsx`
- `components/motion/animated-sidebar.tsx`
- `components/motion/button/base.tsx`
- `components/motion/checkbox.tsx`
- `components/motion/file-upload.tsx`
- `components/motion/input.tsx`
- `components/motion/loader.tsx`
- `components/motion/popover-position.ts`
- `components/motion/popover.tsx`
- `components/motion/select.tsx`
- `components/motion/shared-layout-bg.tsx`
- `components/motion/switch.tsx`
- `components/motion/table/editable-cell.tsx`
- `components/motion/table/index.tsx`
- `components/motion/table/row-handle.tsx`
- `components/motion/table/skeleton-rows.tsx`
- `components/motion/table/table-header.tsx`
- `components/motion/table/table-menu.tsx`
- `components/motion/table/types.ts`
- `components/motion/table/use-column-reorder.ts`
- `components/motion/table/use-column-resize.ts`
- `components/motion/table/use-column-sort.ts`
- `components/motion/table/use-row-selection.ts`
- `components/motion/table/utils.ts`
- `components/motion/tooltip.tsx`
- `lib/ease.ts`
- `lib/hooks/use-hover-capable.ts`
- `lib/utils.ts`

Every copied path above is relative to `apps/artifact/src/beui-foundation/`.

## Isolation and runtime boundary

- `src/entry.js` does not import the BeUI proof or foundation stylesheet.
- `src/styles/index.css` is unchanged.
- Tailwind scans only `src/beui-foundation/**` through `source(none)` plus an explicit `@source`.
- Tailwind Preflight is omitted.
- BeUI semantic values are defined only for a future `[data-beui-foundation]` root.
- `build.js` compiles the BeUI JavaScript and Tailwind CSS in memory and writes neither into `dist`.
- The current artifact still ships only its existing `assets/app.js` and `assets/app.css` references.
- Web Awesome Free, AG Grid Community, the Nucleo facade, product state, auth, evidence, lifecycle, provider routing, persistence, and legal workflow semantics remain product-owned.

## Proof

- `pnpm install --lockfile-only --filter @ple/artifact`: lockfile finalized for the artifact importer.
- `pnpm install --frozen-lockfile`: passed across all seven workspace projects.
- `pnpm --filter @ple/artifact lint`: passed JavaScript syntax checks and strict TypeScript no-emit compilation.
- `pnpm --filter @ple/artifact build:production`: passed; legacy artifact built and BeUI compiled in memory as `890281` JavaScript bytes plus `59030` Tailwind CSS bytes.
- Official-source readback: passed for all 28 copied files against `starc007/ui-components@bf16e25ac05651eb924006d5e631c54cbead3ac0`, allowing only the documented local import-root rewrite.
- Existing `s38-component-runtime-contract`, `s38-shell-contract`, and `s38-static-build-privacy` tests: passed.
- `git diff --check`: passed.
- Protected source hash comparison: passed for `index.html`, `entry.js`, `legacy/app.js`, all existing styles, feature source, tests, and `test-results/`.
- Shipped-reference comparison: passed; `dist/index.html` exactly matches the protected source HTML and contains only the existing `assets/app.css` and `assets/app.js` references. No BeUI foundation identifier appears in `dist`.
- No dev server was started.

Highest proof rung: production build and strict type compilation. No rendered, browser, deployed, live, or installed-application claim applies to an intentionally unmounted foundation.

## Secrets and protected zones

Secret manifest: `BEUI_PRO_TOKEN` by name only. It was absent. No value was read, printed, copied, logged, stored, or committed. Production, provider, auth, signing, personal, client, database, and other credentials were excluded.

Protected and unchanged zones:

- `apps/artifact/src/index.html`
- `apps/artifact/src/entry.js`
- `apps/artifact/src/legacy/app.js`
- all existing feature files and styles
- all existing tests and protected `test-results/`
- current rendered HTML, CSS, screenshots, controls, theme, icons, shell, rails, grids, document intake behavior, and legal workflow semantics
- `main`, the configured shared `origin`, `/Volumes/Ext./Codebases/heir-right`, and `/workspaces/heir-right-s40-surface/probate-lead-engine`

## Remaining gate

Wave 2 remains blocked until `BEUI_PRO_TOKEN` is available as a clean, non-empty process-scoped environment variable and the selected Pro component pages provide exact namespaced slugs. The next owner must stop before any private registry request if that gate is absent or rejected.
