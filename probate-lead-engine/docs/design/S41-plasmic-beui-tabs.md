# S41 T4 BeUI tabs, icons, and account mapping

Status: isolated source contract for T4. The modules in this receipt are intentionally unmounted. TP has waived the external design-input dependency; T6 is governed by live app/source truth plus the fixed shell, three-anchor, BeUI, and theme contract.

## Source boundary

The implementation uses the public BeUI foundation already installed under `apps/artifact/src/beui-foundation`. Icons resolve through the installed foundation's `lucide-react` dependency in `beui-icon-bank.tsx`. No private registry, BeUI Pro source, second UI library, or hand-authored SVG is used.

The existing artifact entry remains the mounted runtime. T4 adds source modules and a stylesheet without importing them from `src/entry.js`, `index.html`, the legacy shell, or the current Doc Prep surface. T6 must reconcile against live app/source truth and the fixed shell/three-anchor/BeUI/theme contract; it does not wait for or claim an external Plasmic design reconciliation.

## Component-to-screen mapping

| Visible surface | Isolated module | BeUI source used | Contract seam |
| --- | --- | --- | --- |
| Manage Estates | `features/beui-tabs/dashboard.tsx` | Button, Loader, installed icon bank | `DashboardSnapshot`, `onOpenEstates`, `onOpenQueue` |
| Estates search and PDF/CSV intake | `features/beui-tabs/estates.tsx` | FileUpload, Input, Select, Table, Button | `EstateRecord`, `onEstateFilesAdded`, `onSelectionChange`, `s40-queue-estates` |
| Export | `features/beui-tabs/export.tsx` | Table, installed icon bank | packet href/status readback fields on `EstateRecord` |
| Outreach | `features/beui-tabs/outreach.tsx` | BeuiTabs, Button, installed icon bank | campaign/template records and callback-only actions |
| Queue | `features/beui-tabs/queue.tsx` | Table, Loader, Button | selected IDs and `export` command |
| Admin | `features/beui-tabs/admin.tsx` | Button, installed icon bank | authenticated permission and supplied domains/connections |
| Settings and Integrations | `features/beui-tabs/settings.tsx` | BeuiTabs, Switch, Button | session identity, integration records, preference callbacks |
| Help & Demos | `features/beui-tabs/help-demos.tsx` | BeuiTabs, installed icon bank | route and target mappings; navigate/spotlight callbacks only |
| Shared rail, header, command actions | `features/beui-tabs/beui-tabs.tsx` | AnimatedSidebar, Popover, Input, Button | exact route IDs and existing command IDs |
| Account control | `ui/beui-account-control.tsx` | Popover, installed icon bank | authenticated identity plus existing `/auth/login` and `/auth/logout` routes |

## Interaction and state coverage

The modules expose resting, hover, focus-visible, pressed, loading, disabled, error, and reduced-motion states through the installed BeUI components and `beui-tabs.css`. Loading and error copy is callback/state driven. Disabled actions disclose the missing selection, callback, permission, or current status instead of pretending to complete work. Narrow layouts stack work areas and keep tables horizontally readable.

Estate intake accepts only PDF and CSV MIME/extensions. Imported rows are handed to the owner callback and remain represented as incomplete records for review. Queue and export actions use the existing command IDs and selected estate IDs. Help actions only call navigation and spotlight callbacks; they do not submit, fetch, or mutate workspace data.

## Exact no-fit gaps

1. The installed public BeUI source does not contain an exact authenticated account-control component. The T4 module composes the installed Popover and Button primitives around real session identity fields and the existing auth routes. It intentionally has no avatar, photo, initials, or logo state.
2. The installed public BeUI source does not contain a Help spotlight/navigation primitive. T4 records the exact target selectors and emits `onNavigate`/`onSpotlight` callbacks; T6 must connect those callbacks to the existing shell behavior. No local side effect or replacement routing is invented here.
3. BeUI Pro is unavailable. No private source transfer or Plasmic mutation is claimed. The external design-input dependency is waived; the remaining integration authority is live app/source truth plus the fixed shell/three-anchor/BeUI/theme contract.

These gaps are recorded rather than filled with a new library or generic replacement.
