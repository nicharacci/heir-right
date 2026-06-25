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
- Switched to Email and confirmed the email subject field and title.
- Submitted the template and confirmed the operator-trail event.
- Screenshot: `docs/run-point-daily/screenshots/2026-06-25-outreach-template-modal-local.png`.
