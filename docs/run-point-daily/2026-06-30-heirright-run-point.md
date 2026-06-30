# HEI-001 2026-06-30 Run Point

Thread title fallback: `HEI-001 2026-06-30` because thread renaming was unavailable in this session.

## Branch

- Working branch: `v1.1.1/heirright-2026-06-30-s26-s27`
- Base branch reviewed: `v1.1.0/heirright-contract-completion-s26-s27` at `41c56a8`
- Pushed remote branch: `origin/v1.1.1/heirright-2026-06-30-s26-s27`
- Preserved unrelated dirty state: `probate-lead-engine/package.json` and `probate-lead-engine/pnpm-lock.yaml` dependency edits were stashed during deployment so they would not leak into the app deploy. Restore after commit/push and keep them separate unless TP explicitly accepts them.

## Previous-Day Touchups Reviewed

- Read `docs/run-point-daily/2026-06-29-s26-s27-completion.md`.
- Confirmed S26/S27 had a claimed completion note but the checkout still had uncommitted website changes and preserved dependency edits.
- Treated the remaining dirty site and operator-dashboard defects as unfinished S26/S27 closeout work rather than a clean completed sprint.

## Sprints Worked

- S26: Full-App Human-Practical Testing.
- S27: UX and Product Loop Human Review.

## Changes Made

- Fixed the operator app label helper so the current dry-run lead renders as `Fresh Public-Source Lead` instead of `Lead, F.` in dashboard cards, active processes, and recent activity.
- Finished the website redesign changes already present in the worktree, then corrected customer-facing copy:
  - removed visible competitor-reference language from the legal-boundary section,
  - changed the legal-adjacent comparison copy from a stronger promise to `We work to resolve liens and judgments.`,
  - changed counsel language to `Professional guidance is coordinated when needed.`,
  - softened the About copy from guaranteed success to a clear-path-forward statement.
- Added dated browser proof screenshots for local and production website/app checks under `docs/run-point-daily/screenshots/`.

## Tickets Touched

Live Linear was not updated from this run. Repo-local fallback status is updated in `linear/HEIRRIGHT_LINEAR_TICKETS.md`.

Touched fallback scope:

- S26 full-app practical testing: completed with fixes.
- S27 final product-loop review: completed with external blockers carried forward.

## Repo Evidence

- Website production alias: `https://heirright.vercel.app`
- Website production deployment: `https://heirright-n5jlwgtmm-solvys.vercel.app`
- Website deployment id: `dpl_fuaqa1EbYQiNBAQyq3AFTa38Qy1P`
- Operator app production alias: `https://heirright-landing-demo.vercel.app`
- Operator app production deployment: `https://heirright-landing-demo-mc6d625m5-solvys.vercel.app`
- Operator app deployment id: `dpl_12gtibGrHCTQNuJUsJrSFJARaQzw`
- Production route checks returned HTTP 200 for:
  - `https://heirright.vercel.app/`
  - `https://heirright.vercel.app/contact.html`
  - `https://heirright.vercel.app/legal.html`
  - `https://heirright.vercel.app/terms.html`
  - `https://heirright.vercel.app/privacy.html`
  - `https://heirright-landing-demo.vercel.app/`
  - `https://heirright-landing-demo.vercel.app/health`
  - `https://heirright-landing-demo.vercel.app/api/connections/status`
  - `https://heirright-landing-demo.vercel.app/latest-run.json`
- Production contact endpoint honeypot-safe POST returned `{"ok":true,"receiptId":"HR-20260630-0D7070BD","message":"Request received."}` without creating a real consultation lead.

## Validation Commands And Results

From `probate-lead-engine/`:

- `pnpm build` passed.
- `pnpm --filter @ple/worker test` passed with 54 facts.
- `pnpm --filter @ple/worker run:dry -- --address="20611 NW 33rd Pl, Miami Gardens, FL 33056" --owner="Fresh public-source lead"` passed with `status: ready_for_review` and `operatorQueueState: manual_review`.
- `pnpm --filter @ple/worker run:daily` passed with 2 raw leads, 0 qualified leads, and review-only contract-volume blockers.
- `pnpm --filter @ple/worker export:dry` passed and kept live Google/Podio readbacks blocked in dry-run mode.
- `pnpm --filter @ple/worker export:podio-live-test` failed closed before write because `PODIO_ACCESS_TOKEN`, `PODIO_APP_ID`, and field-map config are missing.
- `pnpm --filter @ple/worker export:google-live-test` failed closed before write because `GOOGLE_WORKSPACE_ACCESS_TOKEN` and `GOOGLE_TRACKING_SHEET_ID` are missing.
- `pnpm --filter @ple/worker milestone:30-day` passed and reported `overallStatus: blocked` with 6 external blocked gates.
- `pnpm --filter @ple/artifact build` passed.

From `site-v2/`:

- `rm -rf dist && pnpm build` passed.

From repo root:

- `git diff --check` passed.
- Local Playwright harness passed on website routes and operator app at 1440x1000 and 390x844: no console errors and no horizontal overflow.
- Production Playwright harness passed on website aliases and operator app alias at 1440x1000 and 390x844: no console errors and no horizontal overflow.

## Browser Evidence

Local screenshots:

- `docs/run-point-daily/screenshots/2026-06-30-site-home-desktop.png`
- `docs/run-point-daily/screenshots/2026-06-30-site-home-mobile.png`
- `docs/run-point-daily/screenshots/2026-06-30-operator-app-desktop.png`
- `docs/run-point-daily/screenshots/2026-06-30-operator-app-mobile.png`

Production screenshots:

- `docs/run-point-daily/screenshots/2026-06-30-production-site-home-desktop.png`
- `docs/run-point-daily/screenshots/2026-06-30-production-site-home-mobile.png`
- `docs/run-point-daily/screenshots/2026-06-30-production-operator-app-desktop.png`
- `docs/run-point-daily/screenshots/2026-06-30-production-operator-app-mobile.png`

## /solvys-heir-audit Closeout

Source checked: `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`, `HeirRight_Workflow_Templates_11.15.25.pdf`, `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`, S26/S27 briefs, the June 29 S26/S27 completion note, and current repo/browser proof.

Backward: Finished the two remaining S26/S27 sprint surfaces by validating the product loop, fixing the hidden operator-label regression, deploying the public website and operator app, and proving the routes in browser. These changes support the workflow steps around owner/property review, source-backed manual review, document prep, closing prep, and operator handoff without promoting a generic lead to qualified.

UX pass: aligned. The website no longer exposes competitor-reference wording or overly strong legal-adjacent promises. The operator dashboard shows the full lead label, visible blocked handoff copy, and no mobile/desktop overflow in local or production browser checks.

Forward: Next work is milestone acceptance only, not more safe repo implementation, unless TP/Sam/Joshua provide new feedback. The remaining work belongs to credentialed Google/Podio readback, outreach/compliance approval, closing-template approval, optional custom-domain migration, and approved IDI proof if still required.

Alignment: aligned with gaps.

Required corrections before complete:

- Canonical `HeirRight Workflow. pdf.pdf` is still absent from this checkout; fallback workflow-template PDF and example lead packet were checked.
- Live Google Sheets and Podio readback remain blocked until approved credentials/config and controlled-write approval are supplied.
- No paid IDI Core run was executed. Keep IDI locked unless TP explicitly approves exactly one proof.
- Closing document output remains subject to final client/legal approval of reviewed closing templates.
- Live SMS/email sending remains blocked until outreach compliance and provider decisions are approved.

## Human Decisions Needed From Sam / Joshua

- Provide Google Workspace access plus the target tracking Sheet for one controlled readback.
- Provide Podio credentials, Leads app/field-map confirmation, and explicit controlled-write approval.
- Confirm final closing-template language and entity-name variables.
- Approve outreach compliance language and SMS carrier path before any live send.
- Decide whether to move the custom domain from the existing WordPress/Cloudflare surface to Vercel.
- Decide whether one paid IDI proof is still required, then authorize exactly one run if needed.

## 11 AM Review Packet

What was done:

- Finished S26/S27 repo work on a fresh June 30 branch.
- Fixed the operator app’s abbreviated lead label.
- Finalized and deployed the website copy/surface corrections.
- Rebuilt and deployed both Vercel targets.
- Proved website/app production routes with browser checks, screenshots, and HTTP 200 responses.

What was not done:

- No live Google or Podio writes/readbacks because credentials/config are missing.
- No paid IDI Core run.
- No live outreach, email, SMS, or legal/compliance claim.
- No final closing-template legal approval was recorded.

What needs Sam/Joshua review:

- Confirm the website and operator dashboard are acceptable at the live aliases.
- Supply/approve Google and Podio controlled-readback credentials.
- Confirm closing templates, outreach copy, SMS provider path, and custom-domain direction.

Tomorrow's recommended work:

- Do not open another implementation sprint unless new review feedback arrives.
- If credentials are available, run controlled Google/Podio readback and update the final milestone packet.
- If approvals are still absent, prepare a short acceptance/blocker packet for Sam/Joshua rather than changing product code.

## Agent-Facing Notes

- Future agents should treat S26/S27 as repo-implemented and production-smoke-passed, with external acceptance blockers only.
- The correct operator label for the current dry-run lead is `Fresh Public-Source Lead`; regressions back to `Lead, F.` should fail S26.
- Keep Podio, Google, Resend, SMS, IDI, and closing-document legal approval as separate blocked gates. Do not collapse them into a generic "ready" status.
- The site project is `site-v2` and deploys to `heirright.vercel.app`; the operator app is `probate-lead-engine` and deploys to `heirright-landing-demo.vercel.app`.
