# 2026-07-02 Product Loop Verification

Goal: verify the user-facing HeirRight loop from fresh public-record source through Estates queue, Discovery / document prep, Google Workspace export, Google document open/readback, Dashboard, and Export Queue. Outreach is explicitly out of scope except for noting connection blockers.

## Progress

- Started from `/Users/tifos/Desktop/HRight`, then found the real git checkout at `/Users/tifos/Documents/Codebases/heir-right`.
- Loaded `/solvys-heir-audit` and the deal-flow checklist before judging completion.
- Cleared generated browser/Codex caches after Chrome failed with no disk space; free space improved from about 108 MB to about 1.9 GB.
- Connected to Chrome profile `heirright.com` through the Codex Chrome Extension after opening Chrome.
- Verified production deep health at `https://heirright-leads.vercel.app/api/health/deep`: discovery routes, fresh-batch, export, and closing-doc Google export are available through the Cloudflare worker.
- Verified production connection status: Google is live with webhook export and tracking readback; Podio, Resend, SMS, and Activepieces remain blocked.
- API-level Google export smoke created a real Google Doc and returned readback proof:
  - `https://docs.google.com/open?id=1KLVRj0AK5LP37J87ZN6oTwm2DwxKHVx_Qdt7ifD44-w`
  - Route mode: live
  - Readback: true
  - Remaining packet blocker: missing closing-doc folio field
- Browser/user-facing Estates pull initially failed even though the production API worked. Direct Chrome navigation to `/api/leads/fresh-batch?...` reported `net::ERR_BLOCKED_BY_CLIENT`, so the legacy `fresh-batch` route name is blocked by this Chrome profile before the app can complete the pull.
- Added a browser-safe alias, `/api/leads/public-source-pull`, and changed the Estates UI to post there first while preserving the legacy route as a fallback.
- Verified a fresh non-example public-record query through production API:
  - Query: `EST OF Q`
  - Accepted leads: `Estate of Ella St Jacques`, `Estate of Isabelle Q Rolle Tr`, `Estate of Jacques S Bent`
  - Source: Miami-Dade Property Appraiser live search
  - Example folio exclusion remains in code.
- Patched Document Prep list routing so each estate opens the flow required by its own deal status. Before the fix, a Pre-Discovery row could inherit Closing Prep after a Hot estate was opened.
- Verified Queue tab after the fix path: `Estate of Ella St Jacques Renold St Jacques` appears as queued for batch export review.

## Next

- Drive the deployed app in Chrome as a user, including Estates source pull, adding a fresh estate to the queue, document-prep discovery, app-triggered Google export, opening the Google document, dashboard verification, and export queue verification.
- Review the resulting behavior against the workflow checklist and sprint plans.

## Final Pass Notes

- Final deployed app alias: `https://heirright-landing-demo.vercel.app`.
- Final Vercel deployment: `dpl_DatZm8G8DA1SwAaKFAFX9hqbBk5Q` / `https://heirright-landing-demo-9rwu5twxl-solvys.vercel.app`.
- Final Cloudflare Worker version: `d7bdc176-a5d4-486e-8447-6c1c8d0b604f`.
- Added `/api/leads/public-source-pull` to both artifact and Worker route surfaces; final deep health reports `/api/leads/public-source-pull` and `/api/closing-docs/export-google` as `available`.
- Fixed Estates intake usability: the document/review rail no longer opens over fresh-pull results, so row actions and selected-row queue controls remain clickable after a public-source pull.
- Fresh public-record source used for final browser proof:
  - County: Miami-Dade County, FL
  - Search mode: owner
  - Query: `EST OF Q`
  - Returned fresh leads: `Estate of Ella St Jacques`, `Estate of Isabelle Q Rolle Tr`, `Estate of Jacques S Bent`
  - Source: Miami-Dade Property Appraiser live search
- User-facing app proof:
  - Estates tab pulled the fresh `EST OF Q` batch and kept the rail closed.
  - `Estate of Jacques S Bent` was queued from Estates, opened in Document Prep, run through Estate Discovery from 14% to 100%, run through Closing Prep from 0% to 100%, and exported from the app's `Export to Google Workspace` button.
  - App-created Google URLs returned for Jacques:
    - `https://docs.google.com/open?id=1RUkZq3cCekf_AkehPtb0VVY5oUjh0oEKjwKqdRlYCiU`
    - `https://docs.google.com/open?id=1F5jgLANZPGSkWXfz5Xhu7eLltcDVXv2zF3bbQwEAQaM`
  - Final Dashboard proof showed active process cards and recent activity from the fresh pull/queue run.
  - Final Export Queue proof showed a fresh queued estate from the same `EST OF Q` batch (`Estate of Ella St Jacques`) in batch export prep.
- Remaining blocker:
  - Google Workspace webhook creates the document and reports readback to the app, but the created Google Docs are not shared with the current Chrome account `sam@heirright.com`.
  - Chrome opens the returned app-generated document URLs to Google Drive `Access Denied`.
  - The app now sends `workspaceDestination: "airwrite"` plus `shareWithEmails`, `shareWith`, `shareWithEmail`, `viewerEmails`, `viewers`, `collaboratorEmails`, and `accessEmails`, but the current webhook ignores those sharing fields.
  - Completion requires updating the Google Workspace webhook / Apps Script to share created docs with the intended viewer account or running the test in the actual AirWrite Google account.

## Final Verification Commands

- `pnpm --filter @ple/types build`
- `pnpm --filter @ple/artifact build`
- `pnpm --filter @ple/worker build`
- `pnpm exec wrangler deploy src/cloudflare.ts --name heirright-probate-lead-engine`
- `pnpm exec vercel deploy --prod --scope solvys`
- `curl https://heirright-landing-demo.vercel.app/api/health/deep`
- `curl https://heirright-landing-demo.vercel.app/api/closing-docs/export-google?dry-run=true`
