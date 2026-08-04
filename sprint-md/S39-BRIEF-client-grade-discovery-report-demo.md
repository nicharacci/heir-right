# S39 - Client-Grade Discovery Report Demo

## Original Problem

HeirRight employees can run HeirRight's Discovery workflow, but the client cannot yet judge the output as equivalent to the family-tree reports they supplied. Earlier artifacts either produced a one-page index, an internally styled dossier with placeholder review rows, or a technically correct packet whose real new-estate, IDI-enriched, Google-delivered result was never compared page by page against the client references.

The affected user is a HeirRight employee preparing an estate for review. The problem closes when that employee can start a brand-new estate, retrieve and review the approved IDI evidence once, generate one source-backed report with real relatives and associates, and open the same immutable PDF from Google Drive with the client reference structure, research depth, and readable visual hierarchy.

## Named Solution

Deliver the **HeirRight Client-Grade Discovery Packet** so a HeirRight employee can create, review, export, and hand off a new-estate family-tree report that meets the client north star. Ownership includes source intake, contact review, report modeling, PDF presentation, Google Drive delivery, user-facing controls, validation, deployment, and evidence.

## Run Point

- Product partition: HeirRight estate workflow.
- Lifecycle phase: PL5 beta hardening.
- Entry evidence: S38 upload-to-packet work is merged to `main`; the current packet renderer has a client-family-tree presentation path, immutable artifact storage, IDI report intake, contact review, and Google Workspace delivery contracts.
- Missing gate: a fresh employee-run estate has not produced a visually inspected, source-backed, IDI-enriched report with client-reference parity and Google Drive readback.
- Next phase: remain in PL5 until the report parity, security, live employee flow, and deployment gates pass.
- Outcome owner: this Codex task, end to end.

## Repository And Execution Truth

- Workspace: `/workspaces/heir-right`
- Repository: `https://github.com/solvys/heir-right.git`
- Exact base: `d89eda1691b9913f45bc443825bd04445817145d`
- Task branch: `solvys/s39-client-grade-discovery-report`
- Checkout proof: clean `main` was verified before branch creation with `login: false`; the branch was created from the exact merged S38 base.
- Execution lane: task-native repository-backed Codex Cloud worktree on `remote-ssh-discovered:solvys-cloud`.
- Shell invariant: every repository command uses an explicit absolute workdir and `login: false`.
- Capacity: the workspace volume reported 13 GB available before dependency installation. The locked workspace install added the existing 350-package graph and no new product dependency.
- Publication path: branch to GitHub pull request, merge to `main`, production deployment, and live replay.
- Workspace closure state: active until the live demo and PL5 receipt close.

## Client Source Lock

These workspace documents are the report and workflow truth:

- `AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`
  - 11 letter-size pages.
  - Complex benchmark with 11 heir/contact entries, fractional interests, address histories, phones, emails, deed/mortgage/probate narrative, and the Offer/Profit table.
- `ZILPHY MAE COOPER EST OF Family Tree.pdf`
  - 5 letter-size pages.
  - Uncertain-heir benchmark with explicit relationship caveats and source discrepancies.
- `docs/north-star-packets/constance-e-white-est-family-tree.pdf`
  - 4 letter-size pages.
  - Simple benchmark with the same report grammar and three contacts.
- `docs/north-star-packets/deborah-cheatham-est-family-tree.pdf`
  - 5 letter-size pages.
  - Probate and mortgage nuance with four contacts.
- `HeirRight Workflow. pdf.pdf`
  - 21 letter-size pages.
  - The controlling Discovery checklist and completed-lead content contract.
- `HeirRight_Workflow_Templates_11.15.25.pdf`
  - 20 letter-size pages.
  - Near-duplicate workflow source used to detect version drift.

The client output grammar is:

1. Estate title, `Family Tree`, and date added.
2. Linked property address.
3. Offer/Profit table with As-Is Value, Taxes Due, Liens, Mortgages, Selling Costs, Probate Costs, Partition Costs, Post Equity Value, amount/equity per heir, heirs on board, offer, profit, Min Profit, and the `$100,000 Net` benchmark.
4. Owner name, DOB, DOD, and obituary result/source.
5. A plain-language Back Story that covers ownership, adverse possession, taxes, payer and receipt, reassessment, deed/title, mortgages/liens, marriage, probate status, distribution, discrepancies, and inheritance logic.
6. Heirs, possible heirs, and relevant associates separated honestly.
7. One contact block per person with relationship or interest, age when known, likely current address, dated county/parish/borough address history, phone numbers, email, evidence basis, and review posture.
8. Clickable public-record and report evidence without exposing credentials or raw provider text.

## Installation Foundation

| Foundation | Disposition | Provenance / target seam | Owner and protected zones | Reason |
| --- | --- | --- | --- | --- |
| BeUI | Not applicable | Approved Solvys interaction source | HeirRight keeps shell, state, auth, and document workflow native | No missing generic interaction primitive is causing report parity failure. |
| Vercel UI library | Not applicable | Approved secondary interaction source | HeirRight keeps existing Web Awesome Free controls | A second component source would add ownership without improving the PDF. |
| Bklit | Not applicable | Approved visualization source | Offer/profit math and PDF table remain HeirRight-owned | The client reference uses a compact document table, not an analytical chart. |
| EvilCharts | Not applicable | Approved secondary visualization source | Same protected report-data contract | No chart seam exists in the requested output. |

Existing adopted blocks:

- `pdf-lib` owns deterministic PDF composition and link annotations.
- PDF.js owns bounded PDF extraction and structural inspection.
- Poppler tooling is used only for audit rendering and text/page metadata.
- Web Awesome Free and AG Grid Community remain the accepted S38 application primitives.
- Google Drive API owns file delivery; HeirRight owns identity, authorization, artifact immutability, destination choice, and readback.

## Ponytail Audit

1. The repo already solves most of the path: yes. Reuse packet model, family-tree renderer, IDI import/review, artifact storage, and Google lifecycle.
2. The selected foundation already solves it: existing `pdf-lib` and PDF.js solve generation and inspection.
3. Native platform solves part of it: Google Drive provides destination and file readback; browser file upload provides IDI intake.
4. Installed dependencies solve it: yes. No package addition is planned.
5. Maintained OSS with lower ownership cost: already adopted. No broader search is earned until a concrete renderer limitation appears.
6. One-line or shared-seam fixes first: repair packet-model data loss, field labeling, pagination, typography, or Drive handoff at their earliest common owner.
7. Custom code is allowed only for client-specific report semantics or presentation that the current owned seams cannot express.

## System Model

```text
new estate
  -> canonical estate identity
  -> public-record source run
  -> one approved IDI report retrieval/import
  -> operator contact review
  -> reviewed Discovery File revision
  -> packet model
  -> client-format PDF renderer
  -> immutable artifact readback
  -> Google Drive delivery/readback
  -> client comparison and approval evidence
```

Ownership:

- Estate identity and selected-estate state: HeirRight workspace.
- Public facts and provenance: Discovery File.
- Raw IDI report: bounded server artifact and provider portal only.
- Accepted contact candidates: revision-bound review state.
- Report structure and semantics: packet model.
- Typography, tables, pagination, links, and PDF metadata: packet renderer.
- Storage identity and hash: immutable packet artifact.
- External delivery: Google Drive with HeirRight readback.
- Acceptance: page-by-page visual and field parity ledger plus live browser proof.

The model breaks if a visually correct PDF is fed placeholder contacts, if provider output bypasses review, if a Drive upload differs from the reviewed local packet, or if a screenshot substitutes for opening the actual artifact.

## Scope

### Included

- Read and render every client report and workflow packet firsthand.
- Build a page, section, field, and visual parity ledger.
- Baseline the current local and deployed employee workflow in Chrome.
- Use `Sam@heirright.com` for the employee flow and Google Workspace actions.
- Create one brand-new production-safe estate.
- Retrieve exactly one approved IDI report for that estate and prevent duplicate paid retrieval.
- Import, parse, review, and accept only source-supported relatives/associates and contact data.
- Complete the available public-record source path and preserve truthful blockers.
- Generate the Discovery family-tree report.
- Repair shared report-model, renderer, UI, or Drive seams required for parity.
- Prove Google Drive destination selection, upload, file identity, access, and readback.
- Test desktop, tablet, and mobile workflow states plus opened PDF pages.
- Record a sanitized end-to-end mockup video in Recordly after the deployed flow passes.
- Run build, test, lint, browser, accessibility, privacy, security, and artifact-integrity gates.
- Open and merge the pull request, deploy the reviewed production revision, and replay the demo on the live employee surface.

### Excluded

- Automatic outreach, SMS, email, offers, or CRM mutation.
- Declaring a person a legal heir from IDI or public-source association alone.
- Rewriting closing legal templates.
- Bulk paid IDI, Clerk, Browserbase, or skip-trace runs.
- Persisting raw provider text, credentials, tokens, or private contact data in screenshots, logs, Git, briefs, or test fixtures.
- Cosmetic redesign outside the report, its direct prep controls, and the Drive handoff needed for this outcome.

## Protected Zones

- One paid IDI retrieval per estate unless an exact administrator override reason is recorded.
- Company-owner and recent-sale stop rules.
- Human review before contact use or heirship conclusions.
- Raw IDI text and credentials remain outside browser persistence and generated evidence.
- Existing authentication, allowed-domain, exact-admin, signed-session, and bearer boundaries.
- Immutable packet artifact identity and hash.
- Google and Podio write/readback gates.
- No automatic external outreach or legal-use claim.
- Existing Closing template language and hashes.
- Public/demo estate separation.

## Development Flow

1. **Reference and current-output baseline**
   - Extract text and metadata from every client reference.
   - Render every page and inspect title geometry, margins, table proportions, type scale, line density, page breaks, hyperlinks, blank pages, and contact continuation behavior.
   - Generate the current S38 report from representative reviewed data and capture the same evidence.
   - Write the parity ledger before changing the renderer.

2. **Employee-flow baseline**
   - Observe the open Chrome tab before navigation.
   - Sign in only through Google as `Sam@heirright.com`.
   - Capture current Dashboard, Document Prep, estate creation/import, IDI intake, contact review, packet preview, export, Settings, and Drive destination states.
   - Record console, network, focus, responsive, and accessibility findings.

3. **Fresh estate and source acquisition**
   - Select a brand-new production-safe estate from the authorized source flow.
   - Record canonical owner, property, county, folio, and source identity.
   - Run configured public sources once and preserve exact missing-evidence blockers.
   - Retrieve one IDI report, import it, verify extraction provenance, and bind it to the exact estate.
   - Review relatives and associates individually. Preserve relationship uncertainty and reject mismatches.

4. **Packet-model fidelity**
   - Ensure every client-required field has one source-backed model owner.
   - Preserve address dates/counties, multiple phones/emails, relationship or interest, associates, conflicting facts, and source notes.
   - Separate `heir`, `possible heir`, and `associate` in wording and review status.
   - Keep unknown values empty or plainly unresolved without developer-language flags.

5. **PDF fidelity**
   - Match the client letter-size geometry and concise report grammar.
   - Preserve the blue Offer/Profit header and yellow benchmark treatment as source-specific visual anchors.
   - Keep the first page limited to identity, property, offer table, and owner/vital block.
   - Flow Back Story and contact blocks across pages without clipped rows, orphaned headings, accidental blank pages, or excessive internal-review sections.
   - Keep evidence links clickable and readable.

6. **Google Workspace delivery**
   - Use existing admin-authorized Google Workspace access.
   - Configure only the minimum OAuth/Drive permissions required if the production setup is incomplete.
   - Choose or create the client-approved destination through the employee UI.
   - Upload the exact reviewed artifact and verify file ID, parent, size, hash/readback, access, and open behavior.

7. **Falsification and repair**
   - Exercise duplicate IDI, wrong-estate upload, replacement, refresh, back/forward, interrupted source run, missing contacts, long address history, many contacts, blank offer values, failed Drive write, and Drive retry.
   - Test pointer, keyboard, focus restoration, labels, error recovery, zoom/reflow, and mobile containment.
   - Repair the earliest shared seam and repeat the full comparison after each material report change.

8. **Release**
   - Freeze the exact reviewed tree.
   - Run uncached builds/tests, browser matrix, dependency/license/advisory checks, secret scans, and PDF page inspection.
   - Commit, push, open the PR, merge to `main`, deploy, and verify the intended live URL.
   - Repeat the new-estate employee loop against the deployed revision and issue the PL5 closeout receipt.

9. **Recordly proof**
   - Record the successful deployed workflow only after authentication is complete.
   - Show the new estate, source checks, reviewed IDI import, client-format report preview, revision approval, Google Drive export, Drive readback, and the opened file.
   - Exclude password/OAuth entry, raw IDI text, provider credentials, private tokens, and any non-demo private contact data.
   - Verify playback and preserve the final Recordly link or file with the release evidence.

## Acceptance Criteria

- [ ] A brand-new estate is created or imported under the authenticated HeirRight employee account.
- [ ] Canonical owner, property address, county, and folio/parcel identity are preserved through packet generation.
- [ ] Exactly one approved IDI retrieval/import is bound to that estate; a repeated paid attempt is blocked.
- [ ] The accepted report includes real, reviewed relatives and associates with available phones, emails, likely current addresses, and dated address histories.
- [ ] Relationship uncertainty is explicit; the PDF makes no unsupported legal-heir claim.
- [ ] The PDF is US Letter and opens as one immutable artifact.
- [ ] Page 1 visibly matches the client grammar: estate title, Family Tree, date, property link, Offer/Profit table, owner, DOB, DOD, and obituary result.
- [ ] The Offer/Profit table contains every client row and preserves the blue header plus yellow Min Profit / `$100,000 Net` anchor.
- [ ] Back Story covers each applicable workflow criterion: ownership, adverse possession, tax status, payer/receipt, reassessment, deed/title, mortgages/liens, marriage, probate/distribution, discrepancies, inheritance logic, and source limitations.
- [ ] Every included person has a coherent contact block with name, relationship/interest, age when known, current address, address history, phones, email, evidence basis, and review posture.
- [ ] Long contact blocks paginate without clipping, duplicated lines, orphaned headings, or accidental blank pages.
- [ ] The client comparison ledger marks each structural, informational, and visual criterion `pass` or records an intentional, client-benefiting divergence.
- [ ] The generated PDF contains clickable property, obituary/vital, deed/title, tax, probate, and provider-evidence links when those sources exist.
- [ ] The same artifact is delivered to Google Drive and opened successfully from `Sam@heirright.com`.
- [ ] Drive readback proves the uploaded file is the reviewed artifact, not a regenerated variant.
- [ ] Raw IDI text, provider credentials, OAuth values, and private tokens appear nowhere in Git, logs, screenshots, browser storage, packet copy, or evidence notes.
- [ ] Desktop 1440x900 and 1280x720, tablet 768x1024, and mobile 390x844 flows have no horizontal overflow, clipped controls, dead actions, focus loss, or inaccessible error state.
- [ ] Build, tests, lint, browser E2E, PDF structure/content checks, dependency/advisory checks, and secret scans pass from the exact release tree.
- [ ] PL5 SimpleScore is at least 7/10 and every security, protected-contract, truthful-release, and artifact-integrity critical gate passes.
- [ ] The PR merges to `main`, the approved production revision deploys, and the fresh-estate demo is replayed on the live employee surface.
- [ ] A sanitized Recordly video of the successful deployed flow plays end to end and includes report preview, Drive delivery/readback, and the opened client-format PDF.

## Validation

```bash
cd /workspaces/heir-right/probate-lead-engine

pnpm turbo run build --force
pnpm turbo run test --force
pnpm lint
pnpm test:e2e

node apps/artifact/test/s37-pdf-content.test.mjs
node apps/artifact/test/s37-product-loop-e2e.test.mjs
node apps/artifact/test/s38-idi-real-extraction.test.mjs
node apps/artifact/test/s38-idi-reload-contract.test.mjs
node apps/artifact/test/s38-google-workspace-contract.test.mjs
node apps/artifact/test/s38-google-lifecycle.test.mjs
```

PDF review:

```bash
pdfinfo /path/to/new-estate-family-tree.pdf
pdftotext -layout /path/to/new-estate-family-tree.pdf -
pdftoppm -png -r 144 /path/to/new-estate-family-tree.pdf /tmp/s39-new-estate-page
```

Browser evidence uses accepted screenshots from the current run only. Every important step must have a valid screenshot or named blocker. Screenshot evidence supports UX and visible accessibility findings; keyboard, semantics, focus, contrast, zoom, and assistive-technology behavior require direct browser checks.

## Credentials And External-State Contract

- Employee identity: `Sam@heirright.com`.
- Credentials are entered by the user in Chrome or through an approved provider consent screen and are never copied into repository files, shell output, screenshots, or notes.
- The exact IDI report retrieval for the new estate is authorized once. Duplicate paid retrieval remains blocked.
- Google Workspace OAuth/admin changes are limited to the minimum Drive export/readback capability required for HeirRight.
- No email, SMS, outreach, offer, closing, recording, or Podio production mutation is authorized by this sprint.

## Rollback

- Keep the current S38 packet generator and production deployment as the rollback baseline.
- Report changes remain isolated on the S39 branch until the new-estate comparison passes.
- Packet schema changes must remain backward-readable for existing immutable artifacts.
- Google delivery retries reconcile by artifact identity and must not create duplicate files while prior state is ambiguous.
- A failed live postcheck rolls production back to the prior verified deployment while preserving the S39 evidence and immutable demo packet.

## Evidence Outputs

- `docs/evidence/s39-client-report-parity/`
  - client reference renders;
  - current-output baseline;
  - accepted employee-flow screenshots;
  - new-estate report page renders;
  - comparison ledger;
  - browser/API/Drive readback receipts;
  - privacy-safe test results.
- `docs/run-point-daily/2026-07-30-s39-client-grade-discovery-report.md`
  - checkpoint truth, source changes, proof, blockers, and exact commit/deployment receipts.
- `docs/product-lifecycle/heirright/reports/PLN-PL5-closeout.pdf`
  - picture-led PL5 receipt after every exit gate passes.
