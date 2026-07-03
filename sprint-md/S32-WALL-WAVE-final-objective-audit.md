# Wall-Wave Brief: S32 -- Final Objective Audit

## Intent

Audit the full HeirRight project against the hired workflow packets, sprint briefs, current repo, and live product behavior. The output is an accept/reject readiness package, not another feature sprint.

## Mandatory Waves

- Wave 1: Objective matrix from workflow packets and prior sprint briefs, including Tax Collector receipt, deed/title, mailing address, adverse possession, tax history, probate/court, marriage, obituary/vital, IDI/Intelius/Ancestry, voter/license/manual research, offer/profit, outreach, and CRM handoff.
- Wave 2: Full product-loop proof across CRM/external fetch, IDI, Discovery PDF, Closing Prep PDF, Batch Queue, Help & Demos, Settings, Outreach, auth, desktop, and mobile.
- Review wave: hostile final review that assumes every claim is false until proven.
- Proof wave: final readiness report, score update, blockers, deployment checklist, and TP acceptance checklist.

## Acceptance Criteria

- [ ] Every hired workflow objective is marked automated, human-required, blocked, or intentionally out of scope.
- [ ] Every completion claim has a route output, browser proof, PDF inspection, or explicit blocker.
- [ ] Tax Collector listing-page receipt capture is verified with a visible receipt link or exact unavailable-after-check blocker.
- [ ] IDI proof distinguishes shared backend API, personal override, operator portal import, and missing-vendor blocker.
- [ ] Discovery and Closing Prep PDFs open as single artifacts.
- [ ] Outreach safety gates are verified.
- [ ] Login/team access is verified.
- [ ] Mobile and desktop surfaces pass layout proof.
- [ ] Final product score is updated with next steps to exceed 80/100.

## TP Checklist

- Read the objective matrix without opening code.
- Open generated Discovery and Closing Prep PDFs.
- Verify IDI proof or exact IDI blocker.
- Verify the Tax Collector receipt link and payer fields are present in the Discovery File/PDF or visibly blocked.
- Verify Batch Queue single-PDF behavior.
- Verify Outreach safety gates.
- Verify login and allowed-domain access.
- Approve or reject shipment.
