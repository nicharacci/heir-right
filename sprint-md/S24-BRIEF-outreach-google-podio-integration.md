# Sprint Brief: S24 -- Outreach Automation And Google/Podio Integration

## Intent

Turn Outreach, Google Sheets, and Podio from prepared surfaces into controlled, auditable integration flows. Operators should be able to prepare email/SMS outreach, approve it, sync it to the CRM/work queue, and prove Google/Podio readback without sending unapproved external messages.

## Milestone Gate

Implementation sprint after FULLY FUNCTIONAL PRD

## Branch Target

`v1.1.0/heirright-contract-completion-s24-s25`

## Scope -- Included

- Persist outreach campaigns/templates server-side or through the existing repo storage seam.
- Support email and SMS template workflows with Draft, Ready, Approved, Sync to Podio, Archived.
- Use Podio as CRM/work queue of record unless a smoke test disproves it.
- Use Resend as the email fallback only when configured and approved.
- For SMS, use an app-owned queue plus an approved carrier gateway or Podio-native SMS path. Do not pretend OSS alone can deliver carrier SMS.
- Add approval gates, audit events, stop rules, retry behavior, missing-credential Settings CTAs, and redacted error handling.
- Prove one controlled Google Sheets export/readback.
- Prove one clearly labeled Podio test item/comment/task/readback.
- Keep CSV backup/export safety before production Podio mutation.

## Strict IDI Core Advisory

IDI Core data may be consumed by S24 only as accepted contact-review output from S23. Do not run IDI from Outreach, Podio sync, Google export, retry, preview, or automation code.

- No enrichment retry loop.
- No paid lookup inside template preview.
- No paid lookup inside CRM sync.
- No mutation to the verified IDI intake path.

## Scope -- Excluded

- No mass send.
- No live external SMS/email send without a controlled internal test recipient and explicit approval.
- No weakening approval because templates render successfully.
- No production CRM mutation without backup, configured credentials, controlled test values, and readback proof.

## Acceptance Criteria

- [ ] Campaign/template CRUD persists beyond reload.
- [ ] Unresolved variables can save as Draft/Ready but block approval unless fallback-safe.
- [ ] Only approved users can approve.
- [ ] Missing Podio, Google, Resend, or SMS credentials show clear operator next actions.
- [ ] Podio controlled test creates a clearly labeled item/task/comment and reads it back.
- [ ] Google Sheets controlled test writes one clearly labeled row and reads it back.
- [ ] Outreach sync does not send live SMS/email.
- [ ] Audit trail records save, ready, approve, sync, archive, restore, and delete events without leaking secrets.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine
pnpm build
pnpm --filter @ple/worker test
pnpm --filter @ple/worker export:dry
pnpm --filter @ple/worker export:podio-live-test
pnpm --filter @ple/artifact build
```

Expected blocked result before credentials are configured: `export:podio-live-test` must fail closed before write and name missing configuration.

## Handoff

S24 hands off to S25 when outreach automation and Google/Podio integration paths are implemented, controlled-testable, and honest about credential or live-send blockers.
