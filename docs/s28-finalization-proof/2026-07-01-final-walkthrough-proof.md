# S28 Finalization Proof - 2026-07-01

This file is updated by Codex during the final guided-walkthrough/product-loop sprint.

## Live Product Loop

### 1. Fresh lead pull

- Endpoint: `POST https://heirright-leads.vercel.app/api/leads/fresh-batch?county=miami-dade&limit=1&includeCompanyOwners=false`
- Result: success from `miami_dade_property_appraiser`.
- Batch: `live-miami-dade-pa-2026-07-01`.
- Pulled lead: Estate of Annie Hawkins / ANNIE HAWKINS EST OF.
- Property: 131 NW 67 ST, Miami, FL 33150-0000.
- Folio: 01-3113-008-0130.
- Evidence: 40 external public records returned, 1 accepted seed, 11 source facts on the accepted seed.

### 2. IDI Core path

- Endpoint: `POST https://heirright-leads.vercel.app/api/discovery/idi-asset-search/import`
- Result: success as an operator-approved IDI report import.
- Guardrail: `paidRun` was `false`; the backend did not run paid IDI Core automatically.
- Imported contacts: 2 review candidates.
- Duplicate guard: `idi:131 nw 67 st miami fl 33150 0000:hawkins`.
- Code audit: current repo scope intentionally supports one approved expanded IDI report import by property address; no live paid IDI client or background paid lookup runner is present in this branch.

### 3. Discovery completion

- Endpoint: `POST https://heirright-leads.vercel.app/api/discovery/source-capture`
- Result: 7 structured source facts captured for tax, deed/title, and probate/obituary review.
- Contact review:
  - Marcus Hawkins promoted to the Discovery contact matrix.
  - Denise Hawkins retained as an alternate contact candidate.
- Remaining review posture: source evidence and human review flags stay visible for operator/legal safety.

### 4. Closing Prep and Google Workspace export

- Endpoint: `POST https://heirright-leads.vercel.app/api/closing-docs/export-google?dry-run=false`
- Result: `google_exported`.
- Blockers: none.
- Packet: Closing Prep Packet - Estate of Annie Hawkins - 131 NW 67 ST, Miami, FL 33150-0000.
- Google Doc: https://docs.google.com/open?id=1j6OfFWzooIvOy33t4h5H1Jgy4SwGnKow_nyPj2MJ3dU

### 5. Outreach automation / Podio staging

- Endpoint: `POST https://heirright-leads.vercel.app/api/outreach/sync`
- Result: `ready_for_podio_review`.
- Package: `outreach-20260701180136-2f7d2544`.
- Linear setup issue: `HEI-100`.
- Blockers surfaced by the live backend:
  - Podio controlled write/readback is not approved yet.
  - Activepieces webhook is not configured.
- Safety proof: no outbound SMS or email was sent; the app staged a Podio-compatible review package and filed setup support.

## Final deployment proof

- Frontend production alias: https://heirright-leads.vercel.app
- Vercel deployment promoted to alias: https://heirright-landing-demo-cy9h5uaeq-solvys.vercel.app
- Cloudflare Worker production API: https://heirright-probate-lead-engine.sam-e7a.workers.dev
- Worker version deployed: `9e65825c-dc0f-4bf9-98c3-c0ee860e931a`
- `GET /api/health/deep`: ok, with S28 routes available for fresh batch, IDI import, source capture, contact review, Closing Docs Google export, outreach sync, Podio diagnostics, report PDF, and connection status.
- `GET /api/connections/status`: Google live; Podio blocked by expired token; Activepieces, Linear support, Resend, and SMS Gateway blocked until approved credentials/webhooks are configured.

## Browser QA proof

- Production desktop screenshot: `/tmp/heirright-production-docprep-final.png`
- Production settings screenshot: `/tmp/heirright-production-settings-final.png`
- Production outreach screenshot: `/tmp/heirright-production-outreach-final.png`
- Production mobile screenshot: `/tmp/heirright-production-mobile-final.png`
- Production assertion artifact: `/tmp/heirright-production-final-assertions.json`
- Production full-loop artifact: `/tmp/heirright-production-full-loop-complete-after-export.json`
- Production full-loop screenshot: `/tmp/heirright-production-full-loop-complete-after-export.png`
- Document Prep opens by default and renders 7 rows with Discovery, Closing Docs, Google, and Outreach file-status columns.
- Guided walkthrough is themed, rounded, and visible as an 8-step product demo.
- Settings are centered in one unified card with 28% combined horizontal margin at the 1444px desktop viewport.
- Outreach renders workflow controls plus Active, Exported, and Draft template sections.
- Desktop and mobile checks reported no horizontal overflow and no console/page errors.
- Full production browser loop completed against a freshly pulled lead:
  - Discovery docs: 10/10 linked.
  - Closing docs: 20/20 linked.
  - File statuses: Discovery complete, Closing Docs exported, Google Doc ready, Outreach needs approval.
  - Google export status: `google_exported`.
  - Google Doc: https://docs.google.com/open?id=1jD3zav3dLmB7lKLoWYeZHNRmtDRRrRAgQYj0pWVD0Fs

## Remaining external blockers

- Podio: access token is expired. The code now supports refresh-token and app-token aliases, but Cloudflare Worker still needs a valid Podio refresh/app credential set before live write/readback can pass.
- Activepieces: no webhook is configured. Outreach safely falls back to first-party staging.
- Linear support on Worker: not configured on Cloudflare. Vercel protected env values were not decryptable from `vercel env pull`, so the Worker needs its own Linear API secret before after-hours support tickets can be filed directly from Worker routes.
- Resend/SMS: intentionally blocked until live-send credentials and approval flags are present.
