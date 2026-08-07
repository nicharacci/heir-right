# S44 - Michelet Sandbox Evidence Control

## Control Objective

Deliver the **Michelet Sandbox Evidence Run** so HeirRight can test one real IDI input through an isolated backend workflow, prove the resulting evidence and custody chain, and remove the held material after seven days. This file is the S44 control contract only. T1-T4 implementation begins in fresh task-owned repository-backed Cloud worktrees after this P0 checkpoint is accepted.

## Frozen Boundaries

- Exact base: `809c28404a7645d85ff2683c252f04cf30a34e3b`.
- Date integration branch: `2026-08-06`.
- Input: the real Michelet IDI input only. Synthetic, sample, substituted, or second-estate input fails acceptance.
- Execution: isolated sandbox backend paths and sandbox-only credentials.
- Custody: encrypted at rest and in transit; hold begins at verified intake and ends exactly seven calendar days later. T4 must prove readback before expiry and deletion plus absence after expiry.
- Secrets: values stay in the encrypted Cloud environment. Git, task copy, commands, logs, screenshots, evidence, and receipts may contain names and redacted status only.
- Prohibited: production queues, production credentials, deployments, frontend source, automatic outreach, CRM writes, legal-heir conclusions, and any second paid IDI retrieval.
- Design impact: not applicable. BeUI, Vercel UI, Bklit, and EvilCharts are not applicable to this backend control sprint.

## Track Freeze

| Track | Owner | Scope | Dependencies | Checkpoint |
| --- | --- | --- | --- | --- |
| T1 - Encrypted intake and estate binding | Fresh Cloud custody agent | Receive the real Michelet IDI input through the approved encrypted sandbox lane; verify estate binding, format, byte count, and SHA-256; create a sanitized manifest; start the seven-day hold clock. Raw input never enters Git or task output. | Accepted P0; sandbox environment; real Michelet input; names-only sandbox credential manifest. | `refs/sprints/S44/T1/P1` |
| T2 - Backend sandbox execution | Fresh Cloud systems agent | From T1's accepted encrypted object and checksum, run or implement only the smallest backend-only sandbox seam required to parse the input, preserve provenance and review gates, and generate one Michelet Discovery evidence artifact. No production provider, queue, credential, deployment, or frontend path may be used. | Accepted T1 checkpoint and custody receipt. | `refs/sprints/S44/T2/P1` |
| T3 - Evidence falsification | Fresh Cloud adversarial-review agent | Independently test estate binding, source attribution, contact-review posture, duplicate-run lock, unsupported-heir language, artifact integrity, redaction, and failure behavior. Inspect the actual generated artifact and record sanitized acceptance evidence. | Accepted T2 checkpoint; encrypted input/output read access limited to review. | `refs/sprints/S44/T3/P1` |
| T4 - Hold closure and final acceptance | Fresh Cloud release-custody agent | Reconcile T1-T3 receipts, prove an encrypted restore/readback during the hold, keep the material inaccessible outside the approved sandbox, then after seven full calendar days delete the Michelet input, derived private artifacts, and sandbox credentials and prove absence. Publish the final sanitized acceptance ledger only. | Accepted T1-T3 checkpoints; hold expiry; deletion authority limited to S44 sandbox objects and credentials. | `refs/sprints/S44/T4/P1` |

T1-T4 are workstreams, not reusable agent tranches. S44 executes in four sequential quarters with one fresh task and worktree per quarter: Q1 establishes T1 and the T2 ingress contract; Q2 completes T2 and starts T3 evidence capture; Q3 completes T3 and starts T4 hold verification; Q4 closes T4 after the seven-day expiry. Each quarter starts from the accepted predecessor checkpoint and stops at its own acceptance gate.

## Protected Zones

- `main`, every production branch, and every production deployment.
- Production lead, report, outreach, document-prep, and provider queues.
- Production IDI, Google, Podio, Vercel, Cloudflare, Browserbase, database, auth, signing, billing, and provider-admin credentials.
- All frontend source, including `probate-lead-engine/apps/artifact/src/`, `probate-lead-engine/site-v2/`, and `site-v2/`.
- Existing auth, authorization, allowed-domain, exact-admin, signed-session, bearer, paid-run, duplicate-run, company-owner, recent-sale, human-review, immutable-artifact, Google/Podio write, and no-auto-outreach controls.
- Existing legal-template language and hashes. S44 evidence cannot declare or imply legal heirship.
- Raw Michelet content, contact data, provider text, and credential values. None may enter Git, task text, screenshots, logs, fixtures, or committed evidence.

Crossing any protected zone stops the track before mutation and requires new explicit human authority.

## Cloud Pickup Contract

Every T1-T4 task must return all of the following before editing:

- Sprint and quarter identity, task owner, environment type, opaque 32-character lowercase hexadecimal environment ID, and readable environment label.
- Repository slug `nicharacci/heir-right`, canonical HTTPS origin `https://github.com/nicharacci/heir-right.git`, managed worktree path, detached checkout proof, exact accepted predecessor SHA, clean-start status, and publication route.
- `env -u GITHUB_TOKEN -u GH_TOKEN gh api user --jq .login` output equal to `nicharacci` before any GitHub access.
- Track scope, dependency receipt, checkpoint ref, protected zones, closure condition, and return integrator `2026-08-06`.
- Names-only secrets manifest. Only S44 sandbox-scoped credential names are eligible. Every production, unrelated-client, personal, signing, billing, provider-admin, deployment, database, and machine-wide credential category is excluded.
- Default resource ceilings from the Solvys Refresh System. No override is accepted by implication.

## Full Acceptance Evidence Contract

Every receipt is sanitized and binds evidence to exact hashes and UTC timestamps. A claim without its named evidence fails.

### Common checkpoint evidence

- Environment ID and label; worktree; exact inherited base; commit SHA; date branch; checkpoint ref; remote branch/ref SHA readback; changed files; clean `git status --short --branch`.
- Commands run and verbatim outcome summaries; scoped build/test results when source changes; diff review; secret scan; protected-zone review; highest proof rung; unresolved blockers.
- Names-only secret manifest and explicit confirmation that no secret value, raw Michelet content, or private contact data appeared in Git, task output, logs, screenshots, fixtures, or committed evidence.
- Canonical-origin proof and authenticated GitHub identity `nicharacci`, with `GITHUB_TOKEN` and `GH_TOKEN` unset for GitHub commands.

### T1 evidence

- Intake UTC, hold-expiry UTC exactly seven calendar days later, encrypted object identifier, encryption-status readback, byte count, media type/page count when applicable, SHA-256, source handoff identity, Michelet estate-binding decision, access list, and sanitized manifest hash.
- Proof that no alternate estate, synthetic input, duplicate paid retrieval, or repository copy was used.

### T2 evidence

- Accepted T1 object identifier and checksum; sandbox configuration names only; exact backend entry point; one-run/duplicate-lock evidence; sanitized execution log hash; generated artifact identifier, byte count, SHA-256, and source-to-output provenance map.
- Report checks for estate identity, source citations, relatives versus associates, contact-review state, unresolved facts, and explicit absence of unsupported legal-heir conclusions.
- Network/provider ledger proving zero production queue, production credential, deployment, frontend, outreach, CRM-write, or second paid IDI activity.

### T3 evidence

- Independent replay or inspection against the same input/output hashes; pass/fail matrix for estate binding, provenance, artifact integrity, review gates, duplicate lock, redaction, malformed input, wrong-estate input, missing evidence, interrupted run, and retry behavior.
- Structural and visual inspection of the actual artifact, including page metadata, extracted-text checks, rendered-page review, link review, clipping/blank-page review, and a sanitized evidence index.
- Privacy scan covering Git diff/history for S44, task artifacts, logs, screenshots, fixtures, browser/runtime storage if used, and committed evidence.

### T4 evidence

- Cross-track SHA/ref reconciliation; encrypted restore/readback before expiry with matching hashes; hold access log; hold-start and hold-expiry UTC; proof no access or mutation escaped the sandbox.
- After expiry: exact deletion timestamp, deleted S44 object and credential names without values, deletion responses, repeated absence/readback failure, and confirmation that no recoverable private copy remains in the task worktree, cache, artifact store, or sandbox runtime.
- Final sanitized acceptance ledger with every criterion marked pass or blocked. S44 closes only when `refs/sprints/S44/T1/P1` through `T4/P1` read back remotely, all hashes reconcile, the seven-day hold completes, deletion and absence pass, and the integration worktree is clean.

## P0 Acceptance

- This contract is the only repository file changed.
- `2026-08-06` and `refs/sprints/S44/P0` resolve remotely to the same control commit.
- The worktree is clean after publication.
- No T1-T4 implementation, production access, credential installation, deployment, queue action, frontend mutation, or Michelet data handling occurs in P0.
