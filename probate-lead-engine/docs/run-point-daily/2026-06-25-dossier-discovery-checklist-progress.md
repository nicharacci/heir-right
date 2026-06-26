# 2026-06-25 Dossier Discovery Checklist Progress

## Pass

- Reframed the selected Dossier rail around completion truth instead of document presence.
- Removed the visible "Discovery fuse" text from the fuse and kept the progress information as an aria label.
- Darkened the fuse track and made the filled segment brighter so both report and dossier rail fuses read clearly.
- Changed Discovery progress to use completed Discovery phases only; report sections marked filled no longer make a dossier appear complete.
- Mapped the ten dossier documents to the seven Discovery phases and rendered them as a checklist with fading divider lines.
- Added explicit row states:
  - `active` shows a spinner while the current phase is in progress.
  - `complete` shows a green circled check only after the matching Discovery phase is completed.
  - `pending` and `blocked` stay numbered and readable until the phase is complete.
- Fixed the Dossier rail product loop so Begin Discovery opens the guided wizard inside the Dossier rail instead of falling back into report-rail behavior.

## Verification

- `rm -rf apps/artifact/dist && pnpm --filter @ple/artifact build`
- `git diff --check`
- Local artifact server: `AUTH_REQUIRED=false PORT=4187 node apps/artifact/server.js`
- Browser proof with Playwright against `http://localhost:4187/`:
  - Before completion: first dossier checklist row was `active`, aria label `Checking`, copy `Owner and property is active. Finish this stage to unlock the checkmark.`
  - Begin Discovery opened the Dossier rail wizard with title `Owner And Property`.
  - After completing the phase and closing Discovery: first dossier checklist row was `complete`, aria label `Complete`, copy `Owner and property complete. Discovery Dossier is ready to review.`
  - Fuse text content was empty and progress showed `14%`.
- Production deployment: `dpl_H3xXE2R6MnXNmjvb2KgX12y5woP4`
- Production alias: `https://heirright-landing-demo.vercel.app`
- Live browser proof:
  - Dossier rail status showed `In progress`.
  - Fuse text content was empty.
  - First dossier checklist row was `active`, aria label `Checking`, copy `Owner and property is active. Finish this stage to unlock the checkmark.`

## Evidence

- `docs/run-point-daily/screenshots/2026-06-25-dossier-checklist-local.png`
- `docs/run-point-daily/screenshots/2026-06-25-dossier-checklist-complete-local.png`
- `docs/run-point-daily/screenshots/2026-06-25-dossier-checklist-live.png`

## Product Note

Annie Hawkins remains an in-progress dossier unless the Discovery phase checklist is completed. The UI no longer treats the existence of the generated document packet as successful completion of the full workflow.

## Dossier List Cleanup

- Removed the Dossiers table `Next step` column and the trace action chips from that list.
- Rebalanced the remaining Dossier columns so lead, address, score, and classification stay readable without the cramped action lane.
- Kept the Estate Search `Next step` controls intact; this cleanup only applies to the Dossiers list.

## Dossier List Verification

- `pnpm --filter @ple/artifact build`
- Local browser proof against `http://localhost:4188/?proof=dossiers-no-next-column-local`:
  - Dossiers header count was `5`.
  - Headers were checkbox, `Last Name, First Initial`, `Property address`, `Score`, and `Classification`.
  - `Next step` header was absent.
  - Dossier list `.next-link` count was `0`.
  - Row selection still left one current dossier row and kept the Dossier rail checklist rendered.
- Production deployment: `dpl_9xUwFQ7JowZa6BKE6iUcoBKPTdFt`
- Production alias: `https://heirright-landing-demo.vercel.app`
- Live browser proof against `https://heirright-landing-demo.vercel.app/?proof=dossiers-no-next-column-live`:
  - Dossiers header count was `5`.
  - `Next step` header was absent.
  - Dossier list `.next-link` count was `0`.
  - Row selection still left one current dossier row and kept the Dossier rail checklist rendered.
  - Browser console warning/error count was `0`.
