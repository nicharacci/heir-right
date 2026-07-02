# 2026-07-02 Estates Table, History, And Filter Pass

## Completed

- Replaced the dead topbar Save Search action with a History rail for past public-source search batches.
- Added a search popup under the global search field with matching estate rows and queue staging.
- Changed the Estates table action column to hover-only Add to queue buttons; these stage rows through the batch queue and do not start Doc Prep.
- Changed the Estates table classification column to a source-date column that labels itself as Date of Passing when available, otherwise Last Sale Date.
- Added click sorting and drag reorder behavior to Estates table headers.
- Added a full filters popover next to the Selected count with list filters, fresh-pull settings, priority toggle, and column visibility.
- Updated Estate file display names so public-source rows show `Estate of ...` instead of bare owner names.

## Verification

- `pnpm --filter @ple/artifact build`
- `pnpm build`
- `pnpm test`
- `pnpm --filter @ple/worker test`
- `git diff --check`
- Playwright desktop smoke on auth-disabled local artifact surface:
  - date header present;
  - Score sorting high-to-low;
  - Add to queue hidden until row hover;
  - search popup opens;
  - History rail opens;
  - filters popover opens;
  - no console errors.
- Playwright mobile smoke on auth-disabled local artifact surface:
  - KPI summary collapses;
  - Add to queue updates queue status;
  - History rail remains accessible;
  - no console errors.
