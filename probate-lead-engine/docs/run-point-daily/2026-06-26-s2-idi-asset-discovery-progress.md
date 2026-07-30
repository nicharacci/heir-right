# 2026-06-26 S2 IDI Asset Discovery Progress

## Scope

Implemented the first production-shaped pass of the asset-first Discovery workflow requested for HeirRight. This pass keeps IDI as an explicit operator-import workflow and avoids automated paid IDI runs.

## Completed

- Added IDI source support, source attachment references, and primary/alternative contact candidate types.
- Extended worker dossier generation to understand IDI asset-search status, report attachment, tax receipt attachment, tax paid-by party, deed attachment, obituary snapshot, and primary/alternative contact profiles.
- Added worker placeholders for tax receipt, deed, and obituary capture tasks.
- Added artifact endpoints for operator-imported IDI asset search, source capture, and contact candidate review with local fallback behavior.
- Rebuilt the Dossier rail around ordered stages: Owner Details, Tax Receipt, Deed, Obituary, IDI Asset Search, Contact Review, Dossier Export.
- Added Dossier rail controls for public-record capture, one-time IDI import, duplicate warning, contact review, and score/status updates after accepted contacts.
- Changed Estate Search and Dossiers tables to address-first defaults with draggable local column ordering.
- Updated rendered dossier documents and completed report output with captured evidence, primary secondary contacts, Alternative Contacts, and export-ready Podio/Google sections.

## Constraints

- IDI automation remains import-only. No live IDI API run, cron, or repeated paid lookup was added.
- Source capture stores manual evidence metadata locally in the artifact fallback and in UI local storage until a backend persistence layer is wired.
- Operator-entered source links render in the embedded report, while plain text values are escaped before display.

## Next Verification

- Run worker and artifact builds.
- Use the local artifact server to prove source capture, IDI import, contact review, score/status update, and column persistence in browser.
- Deploy the verified artifact and confirm the public demo surface.

## Verification Results

- `pnpm --filter @ple/types build` passed.
- `pnpm --filter @ple/worker build` passed.
- `rm -rf apps/artifact/dist && pnpm --filter @ple/artifact build` passed.
- `pnpm build` passed across `@ple/types`, `@ple/worker`, and `@ple/artifact`.
- Local browser proof on `http://localhost:4188/?proof=s2-idi-discovery-cold` passed:
  - Dossiers opened address-first with columns `address, lead, score, evidence`.
  - Source capture saved tax paid-by `Maria Hawkins` and deed instrument `OR 33491-1127`.
  - IDI import created 3 contact candidates.
  - Duplicate IDI import was blocked without admin override.
  - Accepting one contact changed the selected dossier classification to `Contact verified`.
  - Discovery checklist showed 6 completed stages and left Dossier Export still in progress.
  - Dossier column drag changed order to `address, score, lead, evidence`, and the order persisted after reload.
- Screenshot evidence: `docs/run-point-daily/screenshots/2026-06-26-s2-idi-dossier-proof.png`.
