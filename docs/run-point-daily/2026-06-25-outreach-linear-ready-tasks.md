# 2026-06-25 Outreach Linear-Ready Tasks

## HR-OUT-001 - Persist Outreach campaigns and templates server-side

- Build worker/API routes for campaign and template CRUD: create, edit, list, archive, restore, and permanent delete from archive.
- Store status, channel, campaign id, sequence delay, Podio destination, stop rules, variables, custom variables, last edited metadata, and audit events.
- Acceptance: UI can reload with server data; local storage is only a fallback when the backend is unavailable.

## HR-OUT-002 - Server-side approval gate

- Enforce approval on the server, not only in the artifact UI.
- Only `sam@heirright.com` and `joshua@heirright.com` can approve.
- Require a protected approval credential or session-backed challenge before status can move to Approved.
- Acceptance: non-approvers can save Draft and Ready, but cannot approve or sync.

## HR-OUT-003 - Variable registry and preview API

- Add a preview endpoint that renders subject and body against the selected dossier.
- Return resolved and unresolved variables with labels and fallback safety state.
- Include owner, estate, property, county, folio, tax status, probate status, deed/title facts, family/heir/contact facts, source blockers, campaign fields, and custom variables.
- Acceptance: unresolved variables can save as Draft/Ready but block approval unless explicitly fallback-safe.

## HR-OUT-004 - Podio template sync and readback

- Shape approved templates into Podio payloads using the existing Podio adapter boundary.
- Sync template name, channel, body, subject for email, delay, stop rules, campaign, status, and approval owner.
- Return Podio artifact ids and readback proof.
- Acceptance: no live email/SMS send occurs; sync creates or updates only the approved Podio template artifact.

## HR-OUT-005 - Resend fallback readiness

- Add a Resend fallback path only when Podio is unavailable and Resend credentials are configured.
- Keep fallback prepared-only until operator approval and readback.
- Acceptance: if both Podio and Resend are missing, UI shows the Settings CTA and does not attempt a send.

## HR-OUT-006 - Failure notification and Linear fallback

- Convert Podio/Resend sync failures into bottom-right liquid-glass notifications with Retry and Open Settings CTAs.
- When retry cannot repair the process, create a Linear fallback ticket with route, template id, error kind, and redacted context.
- Acceptance: users see a clear path forward; no failure disappears into console logs.

## HR-OUT-007 - Security and audit pass

- Redact credentials, phone numbers, email addresses, and API errors in client logs.
- Add immutable audit events for save, submit, approve, sync, archive, restore, and delete.
- Acceptance: audit trail shows actor, action, timestamp, and summary without leaking secrets.

## HR-OUT-008 - Performance and UX hardening

- Keep Outreach render bounded as template count grows.
- Avoid opening the activity drawer over workflow controls.
- Preserve modal scroll position when paperclip, attachment options, variable help, save, and submit controls are used.
- Acceptance: template workspace remains responsive with at least 100 templates and no action causes scroll jumps.

## HR-OUT-009 - Production verification suite

- Add browser tests for create Draft, submit Ready, unauthorized approve block, authorized approve, missing Podio Settings CTA, archive, restore, permanent delete, and attachment picker scroll stability.
- Add worker tests for transition guards and Podio payload shaping.
- Acceptance: artifact build and worker build pass with workflow tests before deployment.
