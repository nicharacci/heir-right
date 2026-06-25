# Sprint Brief: S1 -- Outreach And Dossier Readiness (single-agent)

## Intent

Operators can select a dossier and immediately understand what is done, what remains, and what is blocked before outreach or export. The Outreach tab becomes a production-shaped campaign and template workspace where SMS and email templates are attached to campaigns, sequenced with delays, previewed against live dossier variables, approved only by authorized users, and synced to Podio with Resend as a fallback.

## Branch Target

`v2.5.4/heirright-discovery-dossiers-2026-06-24`

## Scope -- Included

- [ ] Convert the selected Dossier rail document grid into a completion checklist before any PDF reader content, with rows separated by fading divider lines.
- [ ] Each Dossier checklist row must show the document/stage name, current stage or blocker, source of truth, and a status indicator that only becomes a green circled check after the matching Discovery phase is completed.
- [ ] Keep the existing Dossier rail architecture and right-side rail behavior; do not reintroduce the Report rail inside Dossiers.
- [ ] Rename the Drips tab and related copy to Outreach while preserving the sidebar product loop and current route compatibility if the internal view id remains `drips`.
- [ ] Build campaign-attached SMS and email template management for Outreach: create, edit, save draft, mark ready, request approval, approve, sync to Podio, archive, restore, and permanently delete from archive.
- [ ] Support mixed-channel campaign sequences with one, three, five, and seven-day delay options between automation runs.
- [ ] Implement template statuses: Draft, Ready, Approved, Sync to Podio, Archived.
- [ ] Gate approval so only `sam@heirright.com` or `joshua@heirright.com` can approve, with password protection in the UI and server-side enforcement before live sync.
- [ ] Allow non-approvers to edit templates and make them available for approval.
- [ ] Persist last-edited audit trails for templates and approvals.
- [ ] Build a variable registry from the selected Discovery Dossier and selected lead, including owner, estate, property, county, folio, tax status, probate status, deed/title facts, heir/contact facts, source blockers, offer fields, campaign fields, and custom variables.
- [ ] Permit saving drafts with unresolved variables, but block approval until variables resolve or are explicitly marked fallback-safe.
- [ ] Preview templates against the currently selected dossier and test contact profile.
- [ ] Add Podio sync preparation and execution paths using the existing Podio adapter shape where possible.
- [ ] Use Resend only as a supported fallback route when Podio cannot create or update the campaign/template artifact.
- [ ] Add floating iOS-style liquid glass list/CRM controls for selected rows, but keep preferred actions as compact chips and secondary actions as plain text commands.
- [ ] Fix fresh-lead success status so it only fades in after the operator triggers Pull fresh leads and the run succeeds; cached/latest batch load must not show a fresh-pull success message.
- [ ] Add bottom-right main-content notification behavior for Podio sync failures with Retry and Open Settings CTAs, plus a Linear fallback ticket attempt when sync cannot be repaired.
- [ ] Write progress notes under `docs/run-point-daily/` and commit after meaningful verified passes.

## Scope -- Excluded (OUT OF BOUNDS)

- Do not build a live outbound SMS/email sender in this sprint.
- Do not remove the existing worker outreach draft generation unless replacing it with a tested equivalent.
- Do not invent placeholder lead data to make the UI look complete.
- Do not add a new component library, icon runtime, auth provider, animation system, or database unless the existing repo requires it.
- Do not make the Dossiers section a full-width document workspace again; it stays list-plus-right-rail.
- Do not silently bypass approval gates for live Podio writes.

## Known Issues to Preserve

- Current branch already contains local work for Discovery, Dossiers, Queue, liquid-glass treatments, rail sizing, batch selection, and drip control copy. Preserve unrelated dirty or committed state.
- The app is currently a dense single-file artifact at `apps/artifact/src/index.html`; prefer scoped functions and CSS over broad rewrites.
- Existing worker domain logic already includes outreach and Podio shapes in `apps/worker/src/outreach/`, `apps/worker/src/export/`, and `apps/worker/src/crm/podio-adapter.ts`. Reuse these instead of inventing a separate model.
- Existing Podio live-write safety blockers and controlled-test approval checks in worker validation must remain intact.
- Current UI intentionally uses dark grey/liquid glass treatments, fading divider lines, rounded iOS-style main surfaces, and Nucleo-style icon mappings.
- The `freshBatchStatus` currently shows cached latest-batch success from `loadRun()`; this is incorrect and must be fixed without breaking explicit Pull fresh leads feedback.
- `solvys-brief` referenced `reference/engineering-guidelines.md` and `/solvys-feels/reference/design-guidelines.md`, but those files were not present. `Design.md` and `/solvys-feels/SKILL.md` were loaded and govern the plan.

## Discovery Answers

### Intent

The user-visible outcome is a clear selected-dossier readiness loop and a real Outreach tab where operators manage Podio-ready SMS/email campaigns without guessing whether a lead is safe to contact, export, or sync. The user is the HeirRight internal operator/admin, plus Solvys builders validating the client demo. The problem solved is current ambiguity: Dossier rows do not clearly say done versus needed, and Drips is static prep copy instead of a working campaign/template workflow.

### Surface

This touches the HeirRight artifact UI, Dossier rail, sidebar tab copy, Dashboard activity labels, Outreach tab, Queue/list selection controls, Settings credential CTAs, and worker/API sync paths. It is an existing UI change plus backend/API/service work. The design anchors are the annotated browser screenshots in this thread and the current app surface at `https://heirright-landing-demo.vercel.app/`.

### Architecture

Needed data: selected lead rows, dossier document list, Discovery phase completion state, worker outreach assets, Podio config/readiness status, connection status, template/campaign records, audit events, and variable registry values derived from live dossier data. Existing endpoints include `/api/leads/fresh-batch`, `/api/connections/status`, export routes, and existing worker Podio adapters. New or extended endpoints should handle Outreach campaign/template CRUD, approval, archive/delete, variable preview, Podio sync, and sync retry. State lifecycle is persistent for templates/audit, session-backed for selected dossier and checklist UI, and scheduled/prepared for Podio automation sequences.

### Constraints

Do not break current Find Estates, Dossiers, Queue, report rail, Discovery wizard, or Podio controlled-write guardrails. Deadline pressure is client-facing: the app should be usable for morning review. The branch exists and should remain the target. Do not start a Vite dev server; use clean builds and browser verification against the served artifact only when already running or deployed.

### Validation

Happy path: select a dossier, see a checklist with incomplete rows, complete Discovery phases, see corresponding green circled checks, create SMS/email templates inside Outreach, preview variables against selected dossier, request/approve with authorized credentials, then sync or see a useful Settings/Retry error. Edge cases: unresolved variables save as draft but block approval; unauthorized approver cannot approve; missing Podio/Resend credentials cannot send/sync and must route to Settings; archived templates do not appear in active campaign lists; stale fresh-lead success text does not appear on load.

## Design Pass

### Layout / Interaction

Selected Dossier rail: the Docs tab begins with a checklist, not a card grid. Each row is a flat horizontal item with a left status circle, document/stage title, short one-line current blocker or next stage, and a right-side compact action such as Review, Open PDF, or Continue Discovery. Rows use fading divider lines for hierarchy. Incomplete rows show muted empty circles or review dots; completed rows show a green circled check only if the Discovery phase completion state says complete. Clicking a row opens the relevant embedded PDF/HTML section below without moving the checklist or shifting the left dossier table.

Outreach tab: the first panel is Campaign Templates, not Scheduled Work. The left column lists campaigns and templates with status text, channel, delay, owner, and last edited. The right column is the template editor with channel toggles, subject/body fields, variable picker, preview against selected dossier, sequence delay controls, stop-rule controls, and audit trail. Approved/sync actions are preferred liquid-glass chips; archive, restore, and delete from archive are plain secondary commands unless destructive confirmation is active.

Floating list/CRM controls: when rows are selected in Estate Search or Dossiers, show one iOS liquid glass pill near the bottom center with concise chips: Add to Queue, Podio Prep, Google + Podio, Select Visible, Clear. Text must fit one line. Secondary commands remain unbordered.

Fresh-pull status: the source-pull status is hidden/empty on cached load. It fades in only after a user-initiated pull starts, succeeds, or fails. Success copy uses "pulled" not "loaded" to distinguish a real trigger from cached run hydration.

Notifications: Podio sync failures surface as a bottom-right main-content liquid-glass notification with short copy, Retry, Open Settings, and an internal Linear ticket fallback indicator. It must transition in and out. The user asked for this even though `/solvys-feels` normally prefers inline status; this is a product-specific exception for external sync failures.

### API / Service Shape

Add or extend worker/API routes with Zod validation at the boundary:

- `GET /api/outreach/campaigns`
  - Response: `{ campaigns: CampaignSummary[] }`
- `POST /api/outreach/campaigns`
  - Request: `{ name: string; description?: string; defaultDelayDays?: 1 | 3 | 5 | 7; stopRules: string[] }`
- `GET /api/outreach/templates?campaignId=...`
  - Response: `{ templates: OutreachTemplate[] }`
- `POST /api/outreach/templates`
  - Request: `{ campaignId: string; channel: "sms" | "email"; name: string; subject?: string; body: string; delayDays: 1 | 3 | 5 | 7; variables: string[]; customVariables?: Record<string,string>; stopRules: string[] }`
- `PUT /api/outreach/templates/:id`
  - Same editable fields; must append audit event.
- `POST /api/outreach/templates/:id/submit-approval`
  - Moves Draft or Ready into Ready with validation warnings.
- `POST /api/outreach/templates/:id/approve`
  - Request: `{ approverEmail: string; approvalPassword: string }`; server must allow only `sam@heirright.com` or `joshua@heirright.com`.
- `POST /api/outreach/templates/:id/sync-podio`
  - Syncs to Podio when approved and credentials exist; returns sync result, Podio item/task ids, and readback status.
- `POST /api/outreach/templates/:id/archive`
  - Soft archive; also disable/delete matching Podio artifact where configured.
- `DELETE /api/outreach/templates/:id`
  - Permanent delete only when archived.
- `POST /api/outreach/templates/:id/preview`
  - Request: `{ leadId: string; customVariables?: Record<string,string> }`; returns rendered subject/body and unresolved variables.

Fallback behavior: without persistent storage, keep artifact UI local-state capable for demo, but worker/service code should use explicit storage adapter seams so production can attach DB later. Without Podio credentials, sync must not send; return a typed missing-credentials error that the UI turns into Open Settings CTA. Without Resend credentials, show Podio-only readiness and block fallback send/sync.

Podio reference boundary: official Podio docs confirm OAuth2 authentication, app auth suitability for app-specific integration, and item creation through `POST /item/app/{app_id}/`. Use those docs to shape adapter calls, but do not import external SDKs unless repo evidence supports it.

### Data / Agent Shape

Use repo-native types in `packages/types/src/index.ts` and worker outreach modules:

- Campaign: id, name, description, status, createdAt, updatedAt, archivedAt, defaultDelayDays, stopRules.
- Template: id, campaignId, channel, name, subject, body, status, delayDays, variables, customVariables, lastEditedBy, lastEditedAt, approvedBy, approvedAt, podioSyncState, podioArtifactId, archivedAt.
- Audit event: id, templateId, actorEmail, action, at, before/after summary, reason.
- Variable registry: derived from selected lead, raw dossier, completed lead report, source coverage, family tree, tax history, probate, title/deed, offer math, CRM payload, queue status, and custom entries.

No new reasoning agent is required in this sprint. If an agent wrapper is added later, it should call these services, not own template truth. Agent-created templates must remain Draft until a human approval route passes.

### Aesthetic Rules

- `Design.md` was read immediately before this brief and must be re-checked before implementation.
- `/solvys-feels` was read for UI planning. Its missing `reference/design-guidelines.md` file is noted; follow `Design.md` and `/solvys-feels/SKILL.md`.
- Use the existing HeirRight dark-grey/liquid-glass direction requested by the client, but keep the material restrained and readable.
- Use frosted-glass surfaces, flat rows, fading rulers, spacing, and type for hierarchy. Do not default every child control to a bordered card.
- If UI is copied from another workspace, inspect and adapt the real source implementation instead of recreating it from memory.
- No duplicate labels, implementation narration, raw source strings without user-facing capitalization, invented icons outside the app facade/Lucide/Nucleo/verified brand path, gradients as surface fills, emojis, Kanban borders, AI sparkles, generic box-shadows, decorative button borders/backplates, pointed square borders, instant new surfaces, or unverified homemade Liquid Glass.
- New popups, rails, drawers, modals, sheets, panels, notifications, and selection pills must include enter/exit transitions.
- Drawer/rail changes must specify tucked adjacent borders and padding compensation so contents do not shift.
- Typography and spacing should follow the current HeirRight app, not generic SaaS marketing layout.

## Development Flow

1. **Repo orientation and changelog equivalent**
   - Confirm current branch and dirty state.
   - Re-scan `apps/artifact/src/index.html`, `apps/artifact/server.js`, `apps/worker/src/outreach/`, `apps/worker/src/export/`, `apps/worker/src/crm/podio-adapter.ts`, `packages/types/src/index.ts`, and validation files.
   - Confirm no `src/lib/changelog.ts` exists; use `docs/run-point-daily/` as the repo progress/changelog surface.

2. **Data/type layer**
   - Add Outreach campaign/template/audit/status types in `packages/types/src/index.ts`.
   - Add variable registry types with explicit unresolved-variable handling.
   - Map Discovery phases to Dossier document checklist rows so done state has one source of truth.

3. **Service layer**
   - Build pure helpers for campaign/template normalization, status transitions, approval eligibility, archive/delete eligibility, variable extraction, preview rendering, and Podio payload shaping.
   - Reuse `apps/worker/src/outreach/build-outreach-workflow.ts` and `script-assets.ts` for existing draft material.
   - Extend Podio adapter shape only through a service boundary.

4. **API layer**
   - Add artifact server proxy routes and worker routes for Outreach CRUD, preview, approval, sync, archive, and delete.
   - Validate requests early and return typed errors for missing variables, missing credentials, unauthorized approver, Podio failure, and fallback unavailable.
   - Add Linear ticket fallback seam, but degrade cleanly when Linear auth is unavailable.

5. **Frontend state/hooks**
   - Add local state and persistence for selected campaign/template, current preview lead, pending approval, sync notification, archive view, and audit log.
   - Fix `freshBatchStatus` so cached `loadRun()` does not show pull success; only `pullFreshBatch()` can reveal success.
   - Preserve selection state and floating batch controls across Estate Search and Dossiers.

6. **Frontend UI**
   - Convert Dossier Docs grid into checklist-first layout with fading dividers and phase-backed green checks.
   - Rename Drips to Outreach across sidebar hover labels, Dashboard subtab copy, tab aria labels, activity feed copy, and route-specific text.
   - Replace static Scheduled Work with Campaign Templates and Template Editor.
   - Add variable picker, preview pane, delay controls, stop rules, approval gate, archive controls, audit list, and sync status.
   - Add Settings CTA integration for missing Podio/Resend credentials.

7. **Validation**
   - Run type/build checks without starting Vite.
   - Use Playwright or in-app browser verification against the served artifact or deployment.
   - Verify dossier checklist completion transitions by completing a Discovery phase.
   - Verify Outreach draft save, unresolved variable approval block, authorized approval attempt, unauthorized block, archive/restore/delete, and missing Podio credentials notification.
   - Verify fresh-pull status is hidden on cached load and appears only after Pull fresh leads is triggered.

8. **Progress, review, and commit**
   - Add progress notes and screenshot references under `docs/run-point-daily/`.
   - Review the entire diff as a fresh pass.
   - Commit meaningful verified slices with clear messages.

## Acceptance Criteria

- [ ] Selecting a dossier opens the right-side Dossier rail and the Docs tab starts with a checklist, not an ambiguous card grid.
- [ ] Dossier checklist rows use fading divider lines and clearly show Done, Needs Review, Blocked, or Not Started.
- [ ] A green circled check appears only after the corresponding Discovery phase is completed.
- [ ] Completing a Discovery phase updates the checklist without shifting the left dossier table or rail layout.
- [ ] The app no longer shows "Drips" as the product tab; the user-facing section is Outreach.
- [ ] Outreach templates are attached to campaigns and can include SMS, email, or both in a sequence.
- [ ] Delays support one, three, five, and seven days.
- [ ] Template statuses progress through Draft, Ready, Approved, Sync to Podio, and Archived.
- [ ] Draft save works with unresolved variables, but approval is blocked with a clear unresolved-variable list.
- [ ] Only `sam@heirright.com` or `joshua@heirright.com` can approve after password validation.
- [ ] Non-approvers can edit and submit templates for approval.
- [ ] Last-edited audit trail displays actor, action, timestamp, and change summary.
- [ ] Podio sync uses existing Podio adapter/service boundaries and never bypasses live-write guardrails.
- [ ] Missing Podio/Resend credentials show a bottom-right notification with Open Settings CTA and no send/sync.
- [ ] Podio sync failure shows Retry/Hotfix CTA and records or attempts a Linear fallback ticket.
- [ ] Archived templates leave active lists and can be restored; permanent delete exists only inside Archive.
- [ ] Fresh lead success status is hidden on cached load and fades in only after successful operator-triggered Pull fresh leads.
- [ ] Existing Find Estates, Dossiers, Queue, Discovery wizard, report rail, batch export controls, and Podio readiness checks still work.
- [ ] `pnpm --filter @ple/artifact build` passes after `rm -rf apps/artifact/dist`.
- [ ] `pnpm --filter @ple/worker build` passes if worker/backend code is touched.
- [ ] UI is manually or Playwright-verified on the real served surface.
- [ ] Progress notes are written under `docs/run-point-daily/`.

## Validation Commands

```bash
# Artifact clean build
rm -rf apps/artifact/dist
pnpm --filter @ple/artifact build

# Worker build if backend/worker code is touched
pnpm --filter @ple/worker build

# Whole repo build when the slice is stable
pnpm build

# Fresh-pull cached-load check: served app should not render stale success text
node -e "const fs=require('fs'); const html=fs.readFileSync('apps/artifact/src/index.html','utf8'); if(/loaded from the latest Miami-Dade Property Appraiser pull/.test(html)) process.exit(1)"

# Local endpoint smoke checks when the artifact server is already running
curl -s http://localhost:4173/api/connections/status | head -c 300
curl -s http://localhost:4173/fresh-lead-batch.json | head -c 300
```

## Commit Format

```bash
git commit -m "Build Outreach templates and dossier readiness loop"
```

## External References

- Podio API overview: https://developers.podio.com/doc
- Podio OAuth authentication: https://developers.podio.com/authentication
- Podio app authentication: https://developers.podio.com/authentication/app_auth
- Podio add item endpoint: https://developers.podio.com/doc/items/add-new-item-22362
