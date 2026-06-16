# Sprint Brief: S20-T3 -- Client Review Script

Branch: `v2.4.1/heirright-2026-06-16-run-point`

## Intent

Prepare a plain-language 30-minute review agenda for Sam/Joshua.

## Scope

- Summarize what is automated, what remains manual, what proof exists, and what decisions unblock the next milestone.
- Keep the review in real estate workflow language: property, deed, taxes, probate, heirs, offer, review, move on.
- Preserve decisions for production seed batch, Google/Podio credentials, controlled write approval, and acceptance status.

## Out Of Bounds

- Asking the client to run repo tooling.
- Developer-facing logs as the client review artifact.
- Legal/compliance claims without approval.

## Validation

```bash
rg -n "30-day|production seed|Google|Podio|qualified" docs/run-point-daily docs/discovery sprint-md/S20-*.md
```
