# S28 Finalization Proof

Date: 2026-07-01
Branch: `v1.1.1/heirright-2026-06-30-s28-production-loop`
Production URL: `https://heirright-leads.vercel.app`
Frontend deployment: `https://heirright-landing-demo-ccf0ll4u9-solvys.vercel.app`
Worker deployment: Cloudflare Worker production API surface

## Shipped

- Document Prep remains the default app surface and now spans the main content lane on desktop and mobile.
- Document Prep file rows, status columns, guided walkthrough, and deal-status control are production-visible.
- Document Prep now promotes the completed owner file row by owner name, not the generic latest packet title.
- Deal Status uses the enhanced rounded dark dropdown menu instead of the native bright menu.
- Deal Status options can be renamed from the dropdown after a delayed hover pencil appears.
- Admin Team Activity uses large number counters and no sparkline/radial mini-graphs.
- Import split control no longer renders the divider between Import and the chevron.
- Outreach sync uses Activepieces only when configured and otherwise stages a first-party Podio-compatible review package with a Linear setup ticket.
- Settings and health surfaces report external dependency status from the live backend.

## Production Proof

- `pnpm build` passed.
- `pnpm --filter @ple/worker test` passed.
- `git diff --check` passed.
- Vercel production deployment `dpl_Eoded7rAQvk63whZnypGNKaxLagy` is READY.
- `heirright-leads.vercel.app` is aliased to the latest deployment.
- `GET /api/health/deep` reports `backendTarget: cloudflare-worker` with 21 available routes.
- Live browser proof at 1444x994:
  - Document Prep list rect: `x=60`, `w=1384`.
  - Completed Document Prep first row: `ANNIE HAWKINS EST OF`.
  - Completed Document Prep statuses: Discovery `Complete`, IDI Core Report `1 accepted`, Closing Docs `Exported`, Google `Doc ready`.
  - Google Workspace export/readback created Doc `1Y6CMgv1FejgdbesTYKzZYbP0jzi1nIiU6TeSRCXhxUg` and appended/read back the tracking Sheet row.
  - Import split menu border-left: `0px`.
  - Deal Status enhanced select present with open menu background `rgb(43, 46, 56)`, radius `10px`.
  - Deal Status rename proof: pencil opacity `0` before hover, opacity `1` after the 3-second reveal, renamed label persisted as `{"pre-discovery":"Needs Research"}` in the browser session.
  - Admin Team Activity counters: `0/10`, `0/0`, `7`, `2`; no `.sparkline` or `.radial-kpi` elements.

## Remaining Blockers

- Podio remains blocked because the configured access token returns `401 expired_token` for the Leads app readback.
- Activepieces webhook is not configured, so outreach correctly uses the first-party fallback package and Linear support ticket path.
- Resend and SMS Gateway remain blocked until live-send credentials and explicit approvals are configured.

## Current Integration Status

- Google Workspace: live.
- Linear Support: live.
- Leads Engine Access: live.
- Web Search: prep/dry-run controlled by Worker.
- Podio: blocked by expired token.
- Activepieces: blocked, fallback active.
- Resend: blocked.
- SMS Gateway: blocked.

## 2026-07-02 Addendum

- Queue action column annotation is live in production. The Estates table now ends with an unlabeled, non-movable row-action column; the spreadsheet-style columns remain Property address, Estate file, Score, and Last Sale Date.
- Production DOM proof on `https://heirright-leads.vercel.app/?proof=queue-action-column` shows the final header cell as `text: ""`, `data-column: "next"`, `hasDrag: false`, and `aria: "Row actions"`.
- Vercel deploy `dpl_Efs97XHsshyBsXajkeTMTyykUWDv` shipped the queue action-column source change, and deploy `dpl_5kePRUdJfzW13J9Z1BRaAJPjDCWE` shipped the Podio OAuth route wrappers.
- `GET /api/podio/oauth/start` now returns a production `302` to Podio OAuth with the `hr_podio_state` cookie and callback URL. This fixes the missing Vercel wrapper route.
- `POST /api/outreach/sync` production smoke staged a first-party Podio-compatible review package, did not send SMS/email, and filed Linear issue `HEI-110` for the Activepieces/Podio setup blocker.
- `GET /api/health/deep` still reports Google Workspace, Linear Support, and Leads Engine Access as live. Podio remains blocked until the HeirRight Podio account completes OAuth refresh or a Leads app token is installed.
