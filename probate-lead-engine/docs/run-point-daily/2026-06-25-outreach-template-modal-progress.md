# Outreach Template Modal Progress - 2026-06-25

## Scope

Implemented the Close-style template creation popup for the Outreach section. The modal supports SMS and email templates as a Podio-prep wrapper, not a live-send surface.

## Included Fields

- Campaign attachment
- Podio destination
- Template name
- Template status
- Email subject when channel is Email
- Sequence delay options
- Approval owner
- Stop rules
- Template body
- Discovery/lead/heir/user variable tags
- Attachment controls with SMS media guardrails

## Guardrails

- Drafts can be saved without sync.
- Submit for Approval records an operator-trail event.
- The modal states that no Podio card, email, SMS, or Resend message is created from the screen.
- SMS attachments show the Close-style limits: images up to 5MB, other media up to 600KB, and SMS attachment delivery limited to US, CA, and AU numbers.

## Local Proof

- `pnpm --filter @ple/artifact build` passed.
- In-app browser verified `http://localhost:4188/`.
- Opened Outreach.
- Opened New SMS Template.
- Confirmed Podio required fields, SMS attachment guardrail, variable tags, and Submit for Approval.
- Confirmed the attachment picker is visible on open with both Browse existing files and Upload from your computer above the sticky footer.
- Confirmed paperclip and attachment actions do not reset the modal scroll to the top.
- Switched to Email and confirmed the email subject field and title.
- Submitted the template and confirmed the operator-trail event.
- Screenshot: `docs/run-point-daily/screenshots/2026-06-25-outreach-template-modal-local.png`.
- Scroll-stability screenshot: `docs/run-point-daily/screenshots/2026-06-25-outreach-template-modal-no-scroll-jump-local.png`.

## Live Proof

- Deployment: `dpl_HtbdrKnVXD5N6ov9MdbqYc7cSeg8`
- Alias: `https://heirright-landing-demo.vercel.app`
- Opened Outreach on production.
- Opened New SMS Template.
- Scrolled the modal, clicked the paperclip and Browse existing files, and confirmed the modal did not return to the top.
- Screenshot: `docs/run-point-daily/screenshots/2026-06-25-outreach-template-modal-live.png`.

## Fresh Pull Status Pass

- Fixed the source-pull status so cached `fresh-lead-batch.json` hydration does not show a fresh-pull success message.
- Removed the static `Ready to pull an external batch.` status from initial markup.
- Source-search mode changes now keep the status hidden.
- `pullFreshBatch()` remains the only path that reveals the status, with in-progress, success, or blocked copy after an operator-triggered pull.
- Validation:
  - `rm -rf apps/artifact/dist && pnpm --filter @ple/artifact build`
  - Static guard confirmed stale fresh-pull success strings are absent from `apps/artifact/src/index.html`.
  - In-app browser at `http://localhost:4188/` confirmed initial status hidden, source-mode change hidden, and Pull fresh leads revealed the pull status.
- Screenshot: `docs/run-point-daily/screenshots/2026-06-25-fresh-pull-status-local.png`.
