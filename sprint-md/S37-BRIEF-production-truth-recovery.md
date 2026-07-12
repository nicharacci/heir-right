# Sprint Brief: S37 -- Production Truth Recovery (single-agent)

## Intent

When this sprint is done, a HeirRight operator can sign in at `surface.heirright.com`, run Discovery from an estate's existing facts, review a complete source-backed packet, fill only genuinely missing Closing fields, and export one real combined PDF for either flow. The sprint closes only after the documents themselves, authenticated browser flow, Tax Collector receipt capture, Podio persistence, and mobile/desktop user loop are proven with production-shaped evidence.

## Branch Target

`v1.1.1/heirright-2026-06-30-s28-production-loop`

## Scope -- Included

- [ ] Replace the one-page cover-sheet PDF renderer with one shared deterministic packet service that embeds the actual Discovery or Closing sections in one PDF.
- [ ] Make single and batch exports call the same packet service and return one PDF per selected flow, never an index that leaves material below the app viewport.
- [ ] Generate Discovery packets from persisted estate facts and source evidence, including owner/stop-rule state, mailing address, deed and OR book/page, sale history, adverse possession, tax history, receipt/payer/reassessment, probate/court records, heir/contact review, offer math, source links, blockers, and next action.
- [ ] Generate Closing packets from a reviewed Discovery File plus explicit operator inputs, using deterministic field mapping while preserving every byte of legal template language outside designated fill fields.
- [ ] Block Closing export when required values are absent, uncertain, unsupported, or marked for a supporting document; never insert `[NEEDS REVIEW]`, generic people, or inferred legal facts into an exportable Closing document.
- [ ] Add one reusable Vercel session guard and apply it to every operational, integration, export, source, support, and Admin route, including `GET` and `POST /api/admin/access` and `/api/connections/status`.
- [ ] Render the authentication gate in the initial HTML/CSS state before application data or workspace chrome can paint, then hydrate it from `/auth/session` without exposing the underlying app.
- [ ] Finish the production domain and Google OAuth configuration for `surface.heirright.com`, including one allowed-domain proof and one denied-domain bounce proof.
- [ ] Make Tax Collector Browserbase acquisition start from folio/address/owner facts, discover the listing page, follow the bottom-right receipt link, persist the receipt and payer facts, and return explicit retryable provider errors.
- [ ] Prove Podio uses durable team authentication across a fresh browser session and performs one approved sample-card readback without exposing credentials.
- [ ] Repair Document Prep containment at narrow widths and reduced heights, preserving vertical scrolling and keeping all preview/rail content inside its owning container.
- [ ] Replace string-presence release tests with PDF-content, auth-route, source-workflow, keyboard, responsive, and browser E2E assertions.
- [ ] Produce a final anti-negligence review that assumes every completion claim is false until supported by browser state, route output, provider readback, and opened PDF inspection.

## Scope -- Excluded (OUT OF BOUNDS)

- idiCORE API credentials and vendor approval are client-owned external actions. Keep idiCORE portal/import mode honest, but do not block this sprint on credentials the vendor has not issued.
- Do not replace Browserbase, add Ollama, add Agent Reach, embed ActivePieces UI, or introduce another automation runtime.
- Do not auto-send email, SMS, outreach, offers, or legal documents.
- Do not change legal-template wording, formatting, clauses, pagination, headers, signatures, or document order except where a designated fill field requires layout-safe text insertion.
- Do not create generic spouse/child/relative rows to make a packet look complete.
- Do not claim success from HTTP `200`, `application/pdf`, route existence, mocked provider responses, or local-only state.
- Do not commit, log, screenshot, return, or document raw secrets, OAuth codes, tokens, API keys, or private client data.

## Known Issues to Preserve

- Keep the owner-company stop rule, recent-sale stop rule, paid-run approval guard, no-auto-send guard, source evidence requirements, human review gate, and legal-template immutability.
- Preserve the shared allowed-domain source used by Admin and `/auth/session`: `heirright.com`, `solvys.io`, and `texasequitypros.com` are current defaults, but production uses the persisted Admin list.
- Preserve the worker's `HEIRRIGHT_API_TOKEN` and signed-session protections; fix the unguarded Vercel seams rather than weakening Worker auth.
- Preserve explicit Browserbase batch caps, concurrency controls, and paid-run approval.
- Preserve Google and Podio write/readback gates. A generated PDF is not proof of a CRM or Workspace write.
- Preserve sample leads for table demonstration, but label and isolate them so they cannot be exported or confused with production estates.
- Preserve unrelated `site-v2` work and any concurrent changes that are outside this sprint.

## Source Of Truth

- Workflow packet: `/Users/tifos/Desktop/HRight/HeirRight Workflow. pdf.pdf` until the canonical repo reference is repaired.
- Completed packet example: `/Users/tifos/Documents/Codebases/heir-right/AMARANTHE MOREAU EST OF EST OF ACHILLE V MOREAU Family Tree.pdf`.
- HeirRight checklist: `/Users/tifos/.codex/skills/solvys-heir-audit/references/deal-flow-checklist.md`.
- Audit evidence: the S33 PDFs under `/Users/tifos/Documents/Codebases/heir-right/docs/evidence/` and the current generated dossier under `probate-lead-engine/apps/worker/output/`.
- Shared design canon: `/Users/tifos/Documents/Codebases/solvys-skills/Design.md`, read immediately before frontend planning and re-checked before frontend edits.

## Design Pass

### Layout / Interaction

Reuse the existing Document Prep list, preview rail, section navigator, Settings, Admin, Queue, and authentication surfaces. The preview owns a stable responsive frame; its document canvas, streaming state, section navigation, required-field form, and blocker summary stay inside that frame at desktop and mobile widths. `Option+Up` and `Option+Down` continue to move between actual packet sections with smooth, reduced-motion-aware scrolling.

Discovery shows one ordered operator path: estate identity, autonomous source run, source review, contact review, completed packet, then export. Closing starts only from a reviewed Discovery File and shows required fields beside their source and confidence. An uncertain field offers three explicit operator outcomes: enter a value, mark not applicable with a reason, or attach supporting evidence. Export remains disabled with a plain-language next action until every required field is valid.

The authentication overlay exists in initial markup with the workspace inert and visually obscured before JavaScript runs. A denied user sees the existing access-denied message and returns home; an unconfigured production OAuth state is a deployment failure, not a shippable UI mode.

Mobile fixes must use responsive constraints at the owning rail/card level. Do not hide overflow to conceal clipping, shrink text by viewport width, or create a second mobile-only workflow.

### API / Service Shape

Create or consolidate these service boundaries before changing handlers:

- `packet-model`: converts a reviewed dossier and flow-specific inputs into a validated section tree with source refs, blockers, and a stable section map.
- `packet-validator`: rejects placeholder identities, generic relatives, missing required source evidence, incomplete Closing fields, unreviewed Discovery state, and unsupported template mappings.
- `packet-pdf`: renders the validated section tree and designated Closing templates into one PDF buffer. Prefer maintained `pdf-lib` if its template-fill, merge, metadata, and testability fit are better than extending the current handwritten PDF serializer; record the license/runtime decision before installing it.
- `route-auth`: reads the signed HeirRight session or internal bearer token once and returns a consistent `401/403` response for protected Vercel handlers.
- `source-orchestrator`: owns estate-fact-to-provider requests and persists raw/provider evidence before the dossier is regenerated.

Required route contracts:

- `POST /api/exports` accepts `{ flow, estateId, batch, estateIds?, closingFieldValues?, supportingDocuments?, operatorIntent }` and returns `{ ok, flow, estateId|estateIds, sections, contentType: "application/pdf", artifactUrl, blockers, readback }`.
- `GET /api/reports/pdf?artifactId=...` returns only a previously validated server-side artifact; it must not build a cover sheet from query-string title text.
- `POST /api/discovery/external-source-run` starts from the persisted estate and explicit operator intent, executes configured sources, persists raw evidence, regenerates the dossier, and never reports completion while required source blockers remain.
- `POST /api/discovery/tax-collector/receipt-run` accepts estate identity rather than a required listing URL and returns listing URL, receipt URL/artifact, payer, paid date, amount, assessment/reassessment facts, source timestamps, and review flags.
- Every `/api/admin/*`, `/api/connections/*`, `/api/discovery/*`, `/api/exports`, `/api/reports/*`, `/api/outreach/*`, `/api/support/*`, and Podio route requires an approved user session or internal bearer token. Only login/callback/logout/session and intentionally public health metadata remain public.

Validate request bodies at the boundary with the repo's existing TypeScript/runtime patterns. Do not add a second schema framework solely for this sprint; if no runtime validator exists, implement narrow shared validators with typed error codes and tests.

### Data / State Shape

Persist packet artifacts by immutable artifact ID with `flow`, estate IDs, source dossier revision, template revision, section map, generation timestamp, validation result, content hash, and storage URL. The PDF route reads this record rather than accepting operator-controlled packet content in a query string.

Persist source-run attempts with provider, mode, started/completed timestamps, estate facts used, provider invocation ID, evidence artifacts, usage/session metadata, retryability, and sanitized error. The dossier only consumes confirmed facts with source references.

Closing field state records `fieldId`, `templateId`, `value`, `sourceFactId`, `enteredBy`, `confidence`, `resolution`, and optional supporting-document ID. Legal templates are versioned immutable inputs; a generated packet records the exact template hash used.

No new AI or agent layer is authorized. Rules, source acquisition, field mapping, validation, and document generation remain deterministic.

### Aesthetic Rules

- `Design.md` must be re-read immediately before frontend implementation and the UI plan re-checked against it.
- Preserve the warm near-black operational workspace, restrained accent events, flat rows, fading rulers, and existing icon facade.
- Ordinary controls remain borderless; only a true primary command may use the existing primary fill or approved soft-glow state.
- Keep the preview and section rail integrated with their owning surface; do not add nested cards or detached modal-shaped drawers.
- New blocker, attachment, and field-resolution surfaces need intentional enter/exit transitions and `prefers-reduced-motion` behavior.
- Render real-estate language only. Do not show JSON, payload, adapter, schema, endpoint, environment-variable names, or raw error codes to operators.
- No gradients, emojis, Kanban borders, generic box-shadows, decorative button borders/backplates, pointed borders, duplicated labels, invented icons, raw source strings, or homemade Liquid Glass.

## Development Flow

1. **Preflight and falsifier setup**
   - Confirm the canonical checkout, branch, clean/dirty ownership, current deployment targets, and current provider status without printing secrets.
   - Copy the workflow PDF into the canonical documented location or update the Heir audit reference so future audits do not depend on the Desktop copy.
   - Add failing tests that inspect the current S33-style PDF and prove it lacks its declared sections, estate identity, and packet data.
   - Record baseline live failures for OAuth configuration, Surface DNS, unauthenticated Vercel Admin access, Browserbase Tax Collector execution, Podio durability, and mobile containment.

2. **Shared authorization boundary**
   - Extract the existing session verification into one reusable Vercel route guard compatible with Google sessions and the internal Worker bearer token.
   - Inventory every Vercel API handler and apply the guard before body parsing, provider calls, file writes, webhook calls, Linear tickets, exports, or access-list mutation.
   - Add negative tests for anonymous GET/POST, disallowed-domain sessions, expired/tampered sessions, and missing internal tokens.
   - Verify the Worker remains protected and the Vercel proxy can still authenticate to it server-to-server.

3. **Auth-first rendering and production domain**
   - Make the initial HTML auth-gated by default and keep workspace controls inert until an authenticated session is confirmed.
   - Configure `surface.heirright.com`, Vercel DNS/alias/certificate, Google OAuth redirect, client credentials, and session secret through provider secret stores.
   - Prove allowed Google login, disallowed-domain denial/bounce, avatar/menu, switch account, logout, session expiry, and reload persistence in the deployed browser.

4. **Packet model and validation**
   - Define the flow-neutral section tree, artifact metadata, source-reference shape, and validation errors in `packages/types` or the nearest existing shared seam.
   - Build Discovery sections from the completed-lead report and reviewed dossier instead of duplicating narrative logic in route handlers.
   - Build Closing sections from the reviewed Discovery revision, immutable legal templates, deterministic field mapping, operator resolutions, and supporting-document references.
   - Reject `Selected estate`, `Owner review`, generic relationship candidates, unresolved required fields, missing source evidence, and unreviewed dossiers before PDF generation.

5. **Real single-PDF generation**
   - Replace `apps/artifact/api/reports/pdf.js` query-string cover generation with artifact-ID retrieval and the shared packet service.
   - Render all declared sections into one navigable PDF with bookmarks or a stable table of contents, page numbers, source links, evidence labels, blockers, and readable page breaks.
   - Merge designated Closing templates without rewriting their legal language; fill only mapped fields and compare template hashes before/after generation.
   - Make single export and Batch Queue call this same service. A batch selection produces one combined PDF for the selected flow, with per-estate dividers and no folder response.

6. **Tax Collector autonomous acquisition**
   - Trace estate identity from the prior Property Appraiser step into the Browserbase Tax Collector request.
   - Make the browser workflow perform public search, select the correct property deterministically, open the listing, locate the bottom-right receipt link, download/preserve the receipt, and parse payer/payment/reassessment facts.
   - Distinguish no match, ambiguous match, provider credit/payment failure, navigation drift, missing receipt link, parse failure, and transient timeout. Retry only retryable states and never manufacture evidence.
   - Persist invocation/readback evidence and update the Discovery File automatically after successful capture.

7. **Podio durability and readback**
   - Complete team-owned refresh/app authentication using the existing Worker/KV seams.
   - Prove connection survives a new browser session and deployment, then perform one explicitly approved sample-card write/readback against the correct Leads app and field map.
   - Keep CSV backup, approval, and readback gates; failed persistence returns a blocked state with a direct operator action.

8. **Document Prep UX correction**
   - Bind the preview stream and section navigator to the real packet section tree and generation events.
   - Show required Closing inputs, evidence attachment choices, source/confidence labels, blockers, and export readiness without developer language.
   - Repair preview/rail containment at 390x844, 768x1024, 1280x720, and 1440x900, including reduced-height scrolling and filter/popover containment.
   - Verify `Option+Up` and `Option+Down`, focus order, icon labels/tooltips, reduced motion, loading, empty, failure, retry, and success states.

9. **Release-grade tests**
   - Add unit tests for section assembly, placeholder rejection, Closing field mapping, template immutability, source-fact persistence, auth guard decisions, and Tax Collector result classification.
   - Add integration tests that open generated PDFs and assert estate identity, every declared section heading, source links, page count greater than one where content requires it, absence of unresolved placeholders, and correct batch estate count.
   - Add browser E2E for allowed/denied auth, CRM estate to Discovery, external estate to receipt, Discovery preview/export, Closing blocker/export, Batch Queue combined export, Podio persistence, section shortcuts, and responsive containment.
   - Do not stub the final provider proof. Browserbase, Google OAuth, Vercel domain, and Podio acceptance use production credentials and controlled client-safe records.

10. **Deploy, inspect, and anti-negligence review**
   - Run fresh uncached build, lint, test, audit, and secret scans; do not rely on Turbo replay logs.
   - Deploy Worker and Vercel, then run the full product loop at `https://surface.heirright.com` on desktop and mobile.
   - Download and visually inspect the Discovery single, Discovery batch, Closing single, and Closing batch PDFs page by page.
   - Compare one completed Discovery packet against the Amaranthe example and workflow checklist, recording every automated, human-reviewed, blocked, and intentionally excluded step.
   - Write progress and final evidence under `probate-lead-engine/docs/run-point-daily/`, then run `/solvys-audit` and `/solvys-heir-audit`. Any failed gate keeps S37 open.

## Acceptance Criteria

- [ ] `surface.heirright.com` resolves with a valid certificate and serves the current production deployment.
- [ ] The workspace never paints or becomes interactive before authentication resolves.
- [ ] An allowed Google Workspace user can sign in, reload, switch accounts, and log out.
- [ ] A disallowed domain sees the denied page, cannot receive a session, and returns home.
- [ ] Anonymous requests cannot read connection details or read/change Admin access configuration.
- [ ] Every protected Vercel route rejects anonymous and invalid sessions before side effects.
- [ ] Discovery starts from a real estate record and automatically runs all configured non-IDI source steps after Step 1.
- [ ] Tax Collector capture derives its search from estate facts and retrieves the listing-page receipt without a pasted listing URL.
- [ ] Receipt URL/artifact, payer, payment date, amount, status, and reassessment evidence persist into the reviewed Discovery File.
- [ ] Provider credit/payment, ambiguous-match, page-drift, timeout, and missing-receipt failures are truthful, retryable where appropriate, and never marked complete.
- [ ] A Discovery PDF contains the actual packet sections, facts, source links, review flags, and next action in one artifact.
- [ ] A Closing PDF contains the actual filled legal templates and supporting review material in one artifact.
- [ ] Legal-template text and template hash remain unchanged outside designated fill fields.
- [ ] Closing export blocks on every unresolved required field and explains the exact operator action.
- [ ] Single Discovery, batch Discovery, single Closing, and batch Closing export buttons each produce exactly one downloadable PDF matching their labels.
- [ ] Batch PDFs include every selected estate exactly once and do not return a folder or index-only cover sheet.
- [ ] Generated PDFs contain no `Selected estate`, `Owner review`, generic relatives, `[NEEDS REVIEW]`, fake files, or claims unsupported by source evidence.
- [ ] Podio remains connected across a fresh browser session and one approved sample card is read back from the expected Leads app.
- [ ] Sample/demo leads cannot be mistaken for or exported as production estates.
- [ ] Document Prep preview and controls remain inside their containers at all four required viewports and reduced browser heights.
- [ ] `Option+Up` and `Option+Down` cycle real packet sections without focus loss or incoherent scrolling.
- [ ] All eight primary sections open without console errors, dead buttons, misleading status, or broken related-task navigation.
- [ ] No secrets appear in source, git history for this sprint, logs, screenshots, route responses, PDFs, browser storage, or evidence notes.
- [ ] Fresh uncached `pnpm turbo run build --force`, `pnpm turbo run test --force`, `pnpm lint`, and `pnpm audit --prod` pass.
- [ ] `/solvys-audit` reports no app-owned FAIL findings and `/solvys-heir-audit` returns `aligned`.

## Validation Commands

```bash
cd /Users/tifos/Documents/Codebases/heir-right/probate-lead-engine

# Fresh build and tests; stale bundles and Turbo replay are not accepted proof.
rm -rf apps/artifact/dist apps/worker/dist packages/types/dist
pnpm turbo run build --force
pnpm turbo run test --force
pnpm lint
pnpm audit --prod

# Focused security and packet tests added by this sprint.
node apps/artifact/test/s37-route-auth.test.mjs
node apps/artifact/test/s37-pdf-content.test.mjs
node apps/artifact/test/s37-tax-receipt-e2e.test.mjs
node apps/artifact/test/s37-product-loop-e2e.test.mjs

# Production auth checks. Protected routes must return 401/403 without a session.
curl -sS -o /dev/null -w '%{http_code}\n' https://surface.heirright.com/api/admin/access
curl -sS -o /dev/null -w '%{http_code}\n' https://surface.heirright.com/api/connections/status
curl -sS https://surface.heirright.com/auth/session

# DNS and certificate proof.
dig +short surface.heirright.com A
curl -sSIL https://surface.heirright.com/

# Secret scan. Add value-specific fingerprints privately without printing them.
rg -n --hidden -S '(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|bb_live_[A-Za-z0-9_-]{12,})' . \
  -g '!**/.git/**' -g '!**/node_modules/**' -g '!**/dist/**' -g '!**/.vercel/**' -g '!pnpm-lock.yaml' -g '!.env*'

# PDF inspection after controlled browser exports.
pdfinfo /path/to/discovery-single.pdf
pdfinfo /path/to/discovery-batch.pdf
pdfinfo /path/to/closing-single.pdf
pdfinfo /path/to/closing-batch.pdf
pdftoppm -png /path/to/discovery-single.pdf /tmp/heirright-discovery
pdftoppm -png /path/to/closing-single.pdf /tmp/heirright-closing
```

Browser validation must use the real deployed surface and controlled production-safe records. Test desktop at 1280x720 and 1440x900, mobile at 390x844, and tablet at 768x1024. Capture the sign-in states, Tax Collector receipt evidence, streamed Discovery and Closing previews, keyboard section movement, Batch Queue exports, opened PDFs, Podio persistence/readback, and console/network-clean proof.

## Progress And Evidence

Maintain `probate-lead-engine/docs/run-point-daily/2026-07-12-s37-production-truth-recovery.md` throughout execution. After every meaningful step, record the implementation seam, fresh test result, browser/provider proof, self-review finding, and commit SHA. Do not mark a gate complete when it has a caveat, failed assertion, mocked final provider, missing screenshot, or uninspected PDF.

## Commit Format

```text
[v1.1.1] fix: S37 production truth recovery
```
