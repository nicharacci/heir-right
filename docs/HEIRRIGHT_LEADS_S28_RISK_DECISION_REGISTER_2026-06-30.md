# HeirRight Leads S28 Risk And Decision Register - 2026-06-30

Companion plan: `docs/HEIRRIGHT_LEADS_S28_SUPER_SPRINT_PLAN_2026-06-30.md`

Execution tracker: `docs/HEIRRIGHT_LEADS_S28_EXECUTION_TRACKER_2026-06-30.md`

Status: open for S28 annotation intake and implementation.

## Open Decisions

| ID | Decision | Default | Needed when | Owner |
| --- | --- | --- | --- | --- |
| D1 | Start implementation before all annotations arrive? | No | User explicitly says to start early | User |
| D2 | Branch for S28 implementation | Fresh S28 branch | Code edits start | Main session |
| D3 | Pull existing dependency-file edits into scope? | No | User explicitly assigns them or code requires them | Main session plus user if ambiguous |
| D4 | Clerk vs existing Google OAuth/backend | Use existing Google OAuth/backend first | Team/user IDs become required | Main session |
| D5 | Activepieces bridge vs fallback | Activepieces first, fallback if unavailable | Outreach sync implementation starts | Main session |
| D6 | Report packet PDF implementation shape | Actual PDF artifact or PDF-oriented viewport, whichever proves best in-app | Report packet work starts | Main session |

## High-Risk Items

| Risk | Why it matters | Mitigation | Exit proof |
| --- | --- | --- | --- |
| Remaining annotations change tab structure | Could invalidate CTA and walkthrough planning | Finish annotation intake before implementation unless user starts early | Every annotation logged with acceptance tests |
| Live Podio/Google credentials absent | Client asked for production-grade integration, but live writes need credentials and approval | Build fail-closed bridge/fallback and show exact blockers | `/api/connections/status` plus fallback proof |
| Outreach overclaims live sending | External SMS/email cannot be implied without approval | Preserve no-auto-send and approval gates | Browser proof shows draft/queue/export only unless readback succeeds |
| Report packet is HTML-only | User specifically asked for PDF presentation | Add PDF artifact/viewport proof as S28-05 exit gate | Screenshot/browser proof of PDF-oriented packet view |
| Dashboard shows fake recency | Active process and Needs Attention must be accurate | Replace fabricated activity with real state or clear workspace activity labeling | Source trace plus dashboard screenshot |
| Mobile overflow from dense operator UI | User called out thin-format shifting and off-screen content | Required viewport tests at 1440, 1180, 820, 430, 390, 360px | Overflow assertions and screenshots |
| Legal/probate language overpromises completion | HeirRight needs review materials, not unsupported legal claims | Use "prepared for review" language unless approved legal completion exists | Copy audit and report screenshot |
| Non-admin user sees developer setup | Client users should not need repo/tooling knowledge | Keep env/CLI/debug language out of main UI | Office-user language audit |

## External Gates

| Gate | Current planning assumption | Cannot claim complete until |
| --- | --- | --- |
| Podio live write/readback | Blocked or approval-gated | approved credentials, target app IDs, sample write, readback |
| Google Workspace export/readback | Blocked or approval-gated | OAuth/access, destination Sheet/Doc, sample export, readback |
| Resend | Blocked or approval-gated | approved sender/test recipient and delivery proof |
| SMS Gateway or Podio-native SMS | Blocked or approval-gated | approved carrier/path, test approval, no-contact compliance |
| Paid/manual sources | Approval-gated | client approval and imported/proven source evidence |
| Clerk/team IDs | Optional unless Google OAuth/backend cannot satisfy need | explicit need plus implementation proof |

## S28 Shipment Rules

- Ship the app with explicit blockers rather than fake-complete external integrations.
- Prefer existing app seams over new abstractions unless they remove real complexity.
- Keep any new OSS integration behind configuration, approval, and readback checks.
- Use plain real estate workflow language in the main UI.
- Put technical proof in closeout artifacts, not in the operator's primary path.
- Do not collapse DocPrep discovery and closing flows into one generic process.
- Preserve source references and review flags when replacing placeholders.
- Treat final deploy to `https://heirright-leads.vercel.app/` as part of done.

## Risk Review Cadence

- Review before implementation starts.
- Review after Block 2 data/product-loop work.
- Review before outreach bridge changes.
- Review before deploy.
- Review in the final `/solvys-heir-audit` closeout.
