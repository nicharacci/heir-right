# S37 Production Truth Recovery

Date: 2026-07-12
Branch: `v1.1.1/heirright-2026-06-30-s28-production-loop`
Brief: `sprint-md/S37-BRIEF-production-truth-recovery.md`

## Completion Rule

S37 remains open until every app-owned acceptance gate is proven through fresh tests, browser behavior, provider readback where available, and inspection of the generated PDFs themselves. Route existence, HTTP 200, PDF MIME type, mocked final providers, and UI copy are not completion proof.

## Baseline

- The production Vercel alias serves the auth gate, but Google OAuth is not configured and `surface.heirright.com` does not resolve.
- Vercel `/api/admin/access` and `/api/connections/status` are readable without a user session; Admin POST can reach persistence/support-routing side effects without a shared route guard.
- Worker operational routes correctly require a signed HeirRight session or internal bearer token.
- All export variants point to `/api/reports/pdf`, whose current renderer creates a one-page index from query parameters rather than embedding the Discovery or Closing packet.
- The stored S33 Discovery/Closing single/batch PDFs are one-page cover sheets and do not satisfy the hired workflow packet.
- The current dry pipeline keeps tax receipt, payer, deed/OR book, probate, and verified-heir fields unresolved while still producing a report shell.
- Browserbase Tax Collector production evidence previously stopped at HTTP 402, so autonomous receipt capture is not yet proven live.
- Podio reports a bearer connection but lacks the approved Lead profile/durable refresh readback needed for team-proof completion.
- Mobile Document Prep has right-edge overflow at 390px even though vertical page scrolling works.

## Evidence Log

### Milestone 0 - Contract and baseline

- Loaded the S37 brief, shared Solvys design canon, HeirRight workflow checklist, canonical repo instructions, route/auth seams, export renderer, and current generated packet evidence.
- Confirmed the working tree contained only the new S37 brief before execution began.
- Self-review: the work must repair the shared renderer and shared route boundary first; patching individual buttons or handlers would leave sibling paths unsafe and inconsistent.

### Milestone 1 - Shared route boundary and auth-first paint

- Added one shared API authorization guard for signed HeirRight sessions and the internal bearer path, then applied it to every operational Vercel handler that can read or mutate estate, integration, export, outreach, or support data.
- Changed the initial document state to render a blocking access-check card before application JavaScript runs, which removes the pre-session workspace flash.
- Added `s37-route-auth.test.mjs` to prove anonymous rejection, signed-session access, internal-service access, initial auth gating, and the complete protected-handler inventory.
- Fresh proof: `pnpm turbo run build --force` and `pnpm turbo run test --force` both passed with remote caching disabled. The worker validation produced 61 normalized facts and all pre-existing S31-S35 contracts remained green.
- Anti-negligence review: auth endpoints and intentionally public helpers remain outside the operational inventory; all stateful or sensitive handlers are covered. The local server's intentionally public health metadata remains unchanged.

### Milestone 2 - Durable Discovery packet artifacts

- Replaced the query-string cover-sheet renderer with a deterministic packet model and `pdf-lib` renderer. `pdf-lib` is MIT-licensed, runs in the existing Cloudflare Worker compatibility mode, and provides testable multi-page output without a second document service.
- Added immutable packet records in a dedicated Cloudflare KV namespace. Export returns an artifact ID, content hash, estate/section map, expiration, and one PDF URL; retrieval verifies the stored model hash before rendering.
- Discovery packets now include estate summary, stop rules, offer math, tax and receipt review, deed/title, probate/court, vital records, backstory, family/contact review, source evidence, and blockers/next action. Long estate names and source URLs wrap against measured page width.
- Removed query-controlled report generation. `GET /api/reports/pdf` accepts only a validated artifact ID and proxies the authenticated Worker PDF; sample estates and generic family/contact rows are blocked from export.
- Single and batch exports share the same model and renderer. The focused content test produced 13 and 25 pages respectively, asserted every selected estate exactly once, rejected old cover-sheet URLs, and caught artifact tampering.
- Visual review rendered the cover, estate summary, tax, backstory, contact, and blocker pages to images. An initial clipped title and overlong URL were found and repaired before deployment.
- Live proof: Worker version `a2316bd7-c413-408f-abc8-097879dfd0a7` and the new packet KV completed an authenticated artifact round trip. The downloaded live PDF was 13 pages / 30,692 bytes, all required Discovery headings extracted successfully, and forbidden placeholder identities were absent.
- Fresh regression proof: `pnpm turbo run test --force` passed all five tasks uncached after deployment, including the 61-fact worker validation and the new PDF content/integrity assertions.
- Rotated the shared Worker/Vercel bearer token and auth session secret as write-only provider secrets, then set the production Worker URL, Surface origin, OAuth redirect, allowed domains, and auth-required flag without committing values.
- Anti-negligence review: Closing remains deliberately blocked. Two 54-page filled historical example packets are available, but they contain prior seller, property, trust, date, amount, and signature data, have no PDF form fields, and are not approved blank originals. The app will not erase and rewrite those examples; it requires the approved blank templates and designated field map before producing a Closing PDF.

### Milestone 3A - Tax Collector Browserbase production contract

- Ran the production Worker with a real Miami-Dade folio/address/owner payload and the configured Browserbase API key plus deployed Tax Collector function ID. The provider accepted authentication and function lookup, then returned HTTP 402 before creating a browser session.
- Corrected the run contract so every Browserbase invocation is marked `paidRun: true`, including provider failures. Added distinct modes for billing required, concurrency/rate limit, timeout, and function failure instead of collapsing every provider response into a generic browser blocker.
- Enabled the Browserbase managed proxy for the county-tax workflow. Captcha solving, session recording, session logs, and PDF viewer support remain enabled in the function invocation settings.
- Added worker validation for the successful receipt-link result and the billing-required result. Fresh build and validation passed with 61 normalized facts.
- Deployed Worker version `822cb6b6-0db2-4b94-91c3-609b927afef2`, rotated the shared internal bearer without exposing it, and repeated the live call. The response was correctly classified as `browserbase_billing_required`, `paidRun: true`, HTTP 402, with the exact folio/address search input preserved.
- Anti-negligence review: Browserbase configuration is proven valid, but live receipt retrieval cannot be marked complete while the provider refuses to start a session for billing. This is an external account prerequisite rather than an app fallback; the app now reports it explicitly and does not pretend the public search ran.

### Milestone 3B - Durable Podio credential lifecycle

- Found the recurring disconnect mechanism: a diagnostics request could exchange one refresh token four times in parallel, and Podio's rotated refresh token was detected but discarded. That can invalidate the remaining requests and guarantees eventual reconnect churn.
- Changed Podio operational routes to resolve authentication once per request, persist rotated refresh access back to encrypted team KV, and reuse the request-scoped access token across diagnostics, export, readback, and Outreach.
- Added validation proving that a rotated refresh token is returned for durable storage and a resolved request token prevents a second token exchange. Fresh worker build and validation passed with 61 normalized facts.
- Deployed Worker version `ea44b2a9-502d-4796-8b76-6370d02941bc` and ran live Podio user, Leads app, and workspace-member readback. The legacy bearer is expired (`401` on all three checks), no durable refresh token has been stored yet, and the app correctly reports reconnect required without treating the credential's presence as readiness.
- Opened the Podio API settings page in Chrome for the one-time approved-account reconnect. The browser currently needs the user to sign in before OAuth consent and team-KV persistence can be proven live.
- Anti-negligence review: the recurring disconnect defect is repaired and regression-tested, but the Podio acceptance gate stays open until the approved account completes one sign-in and the follow-up app/member readback returns success.

### Milestone 4 - Responsive Doc Prep Preview

- Ran Estate Discovery in the real local app and measured the open Preview rail at `390x844`, `768x1024`, `1280x720`, and `1440x900`. The first mobile pass proved the 375px content track contained a 452px rail, which cut off Preview status, section controls, and document text.
- Constrained the rail, title card, Preview card, section control, and document layers to a zero-minimum grid track. The section-chip row remains intentionally horizontally scrollable, while the rail and page themselves have no horizontal overflow.
- Collapsed the Preview header, checklist title row, and completion strip to mobile-safe rows. The Preview card now encloses its header, controls, streamed document window, scrollbar, and shortcut copy without bleeding beyond its container.
- Final geometry at `390x844`: document `clientWidth=375 / scrollWidth=375`; rail `374 / 374`; rail content `374 / 374`; title card `348 / 348`; Preview card `348 / 348`. Tablet and both desktop sizes also stayed within their viewport widths.
- Verified reduced-height behavior at `1110x627`: the page scroll height was `1930` against a `627` viewport and the rail content had its own `323 / 5251` scroll region, so content remains reachable instead of being cut off.
- Exercised the actual keyboard handler in Chrome: `Option+Down` moved from Tax Receipt to Deed, and `Option+Up` returned to Tax Receipt. A final mobile screenshot visually confirmed full-width text and status containment.
- Fresh artifact build and full artifact test passed, including the existing preview-fit contract, route guards, source readiness, settings/access, and 13/25-page PDF content assertions.
- Anti-negligence review: the last hidden overflow came from the completion strip above Preview, not Preview itself. It was removed and remeasured rather than accepted because the page happened to clip it.

### Milestone 5 - Truthful single and Batch Queue PDF controls

- Added an explicit Download PDF action beside the exact PDF shown in Preview and a Download latest PDF action after Queue generation. The user no longer has to infer that the embedded PDF frame is also the export artifact.
- Replaced Queue's misleading Stage batch action with Export combined PDF. It now sends every deliberately queued estate to the shared `/api/exports` packet renderer with `expectedArtifact: single_pdf` and no external CRM or Workspace route.
- Removed automatic sample-estate queue seeding. Sample rows remain available for table inspection, but they no longer mutate production Queue state or guarantee a blocked first export.
- Added per-estate Queue removal with a named icon control, so an accidental selection can be corrected without deleting, archiving, or clearing unrelated estate state.
- Changed machine review flags in generated Discovery packet content to readable title-case labels while retaining the deterministic source model.
- Added `s37-tax-receipt-e2e.test.mjs` to drive folio, address, and owner facts through the Browserbase function payload, managed proxy, listing-page receipt extraction, paid-run provenance, and billing classification.
- Added `s37-product-loop-e2e.test.mjs` to lock the clean Queue state, combined-PDF trigger, row removal, download actions, single-PDF API contract, and immutable Closing-template blocker.
- Browser proof: after a full reload, Queue showed no queued estates, the export action was disabled, and the screen instructed the user to select an estate. Fresh build and the complete artifact suite passed after the change.
- Anti-negligence review: the original Queue copy promised an export while its button only changed local state, and demo rows were silently inserted. Both behaviors were removed instead of being explained away in Help content.

### Milestone 6A - Production deployment and Podio route boundary correction

- Deployed Worker version `8f427e58-7733-45c5-a8a3-f366f9ff4697` and Vercel production deployment `heirright-landing-demo-b23em4x3g-solvys.vercel.app`; Vercel assigned `surface.heirright.com`, but public DNS still has no record and the custom hostname does not resolve.
- Verified the deployed HTML starts in the Checking access state and includes the new Preview download and Export combined PDF controls. The legacy production alias also serves the auth-first build.
- Ran anonymous requests against Admin access, connection status, exports, source capture, Tax Collector, Outreach sync, support, and PDF retrieval. Each returned `401` before work began.
- The same hostile check found `/api/podio/diagnostics` returning live connection metadata anonymously because the production server dispatched Podio routes before its global API gate.
- Moved Podio diagnostics, OAuth start, and OAuth callback behind the shared signed-session/internal-bearer guard in both the production server and direct handlers. Added the exact Vercel wrapper to the route test, rather than relying on a neighboring handler with different dispatch order.
- Fresh focused proof: the route-auth test passed anonymous rejection, internal bearer access, approved signed-session access, auth-first markup, and the expanded protected-handler inventory. The artifact rebuilt successfully afterward.
- Anti-negligence review: this miss existed despite an earlier green route-inventory test because that test did not invoke the production wrapper. Future security proof now exercises the deployed dispatch seam itself.
- Redeployed as `heirright-landing-demo-gsszav9og-solvys.vercel.app`, repointed the stale `heirright-leads.vercel.app` alias, and confirmed Podio diagnostics/start/callback all return `401` anonymously on both live entry points.
- The first complete uncached suite exposed an older S35 assertion coupled to Podio's superseded HTML login sentence. Updated it to assert the shared `auth_required` security contract, then reran the complete suite with `set -e`.
- Final clean pass at this milestone: three uncached builds passed, all five test tasks passed, Worker validation produced 61 facts, Discovery packet assertions opened 13-page single and 25-page batch PDFs, lint completed, `pnpm audit --prod` found no known vulnerabilities, and the token-pattern scan returned no findings.

### Milestone 6B - One estate row per property

- The browser walkthrough exposed the same current property three times in Estates. The upstream payload was not duplicated; `buildRows` incorrectly promoted the lead report, property/title review, and Outreach prep artifacts into peer estate rows with the same address and estate name.
- Removed those internal artifacts from the Estate collection. They remain available inside the selected estate's Doc Prep and related workflow surfaces, while Estates now preserves its one-row-per-property contract.
- Hardened fresh-provider deduplication to prefer folio and otherwise use normalized property address, so reruns with a changed owner label cannot create a second estate for the same property.
- Added regression assertions for both data paths: provider reruns are deduplicated and a latest-run packet creates only the `estate` row, never the three internal artifact IDs.
- Fresh proof: the complete artifact suite passed. After a full Chrome reload, the summary reported seven Estate files; clearing the default evidence threshold showed six sample estates plus exactly one `Estate of Fresh Public-Source Validation Lead` row at `20611 NW 33rd Pl`.
- Anti-negligence review: this was a state-model defect disguised as duplicate data. The fix was applied at row construction rather than hiding duplicate DOM rows after rendering.

### Milestone 7 - Autonomous Discovery run and committed browser acceptance

- The browser acceptance pass proved `Run Full Discovery` was only advancing a timed local checklist over existing state. It did not call `/api/discovery/external-source-run`, so the button could animate a packet without first acquiring the configured public-source evidence.
- Added a shared autonomous source-run step to the main Discovery command. It derives owner, estate, address, folio, county, prior capture, reviewed IDI import, and operator intent from the selected estate, waits for the source orchestrator, persists the returned facts and regenerated dossier, and only then advances the visible packet sections.
- A failed source request now stops the run and writes the provider message into the active Preview section. A successful run with review blockers continues only until the corresponding deterministic phase gate stops it; the UI no longer treats an HTTP response as completed Discovery.
- Persisted the regenerated dossier with the estate's source capture and made every downstream `dossierForRow` consumer prefer that source-backed revision. This keeps CRM-imported estates and external estates on the same Preview/export truth path.
- Blocked all production source runs and packet generation for labeled sample estates. They remain available for table and walkthrough inspection only.
- Added Playwright as a release dependency and committed browser E2E for one-property row identity, six isolated samples, Queue add/remove, all eight primary sections, source-run request payload, Preview streaming, `Option+Up` / `Option+Down`, console/page errors, four required viewports, and reduced-height scrolling.
- The first browser run found the row-level Add to queue control accepted pointer events only while hovered, which made it unreliable and inaccessible on touch. The action is now always operable; hover remains visual feedback only.
- Final browser proof: `pnpm test:e2e` passed both product-loop tests in Chromium. The source request fired exactly once from `20611 NW 33rd Pl`, every primary section opened, Queue returned to an empty disabled-export state after removal, and all required viewport geometry stayed contained.
- Anti-negligence review: the auth-first overlay correctly blocked the first test when it accidentally launched with production auth and no Google session. The suite now starts an explicit local authenticated server and waits for the actual `#authGate` to clear; production auth remains tested separately through deployed route and initial-markup checks.

### Milestone 8 - Shared Discovery File persistence and transition-safe Preview containment

- Added a protected estate-scoped Discovery File read route and persisted every completed external-source run to the existing packet-artifact KV namespace. Each record carries the seed, raw capture, source summaries, source facts, Tax Collector result, regenerated dossier, blockers, revision, and generated time.
- Made storage readback part of the user-visible run contract. Doc Prep stops before streaming when the shared Discovery File does not return the same revision, and opening an estate hydrates the newest verified team record instead of relying on one browser's local storage.
- Added focused persistence tests for write/readback, source-fact and dossier survival, truthful missing-file behavior, protected route coverage, and frontend hydration. The full artifact suite passed after the change.
- Reproduced the user's 390px Preview bleed in committed Playwright, then traced it through the live ownership chain. Desktop padding and rail transforms were still animating after the viewport crossed into mobile, while narrow desktop rail widths allowed Preview children to retain a larger intrinsic width.
- Changed the mobile workbench to a zero-minimum grid track, removed geometry transitions at the mobile breakpoint, and made the Preview hierarchy obey the rail width at every breakpoint and intermediate resize state. The source document, section transitions, and keyboard cycling remain animated and functional.
- Hardened `pnpm test:e2e` with an automatic artifact build so the browser cannot prove a stale `dist/index.html`. The final Chromium run passed both product-loop tests across `390x844`, `768x1024`, `1110x627`, `1280x720`, and `1440x900`, including vertical scrolling, Queue add/remove, all primary navigation, the real source-run request, Preview streaming, and `Option+Up` / `Option+Down`.
- Anti-negligence review: the first responsive fix appeared ineffective because the E2E server was serving an old build. That release-process flaw was repaired before accepting the geometry result; the final proof now rebuilds and asserts owner, rail, Preview, and document bounds directly.

### Milestone 9 - Uncached local release gates

- Verified the pushed `4503bc3` milestone with `pnpm turbo run build --force` and `pnpm turbo run test --force`; remote caching was disabled and all three packages rebuilt. All five test tasks passed, including the 61-fact worker validation, route boundaries, source contracts, Discovery persistence, PDF content/integrity, and product-loop assertions.
- Ran `pnpm test:e2e` from its new build-first contract. Chromium passed both end-to-end flows with one worker and no console/page errors.
- Ran `pnpm lint` successfully, `pnpm audit --prod` with no known vulnerabilities, and the S37 secret fingerprint scan with no matches outside excluded secret/build/dependency paths.
- Removed the generated Playwright last-run marker after proof collection so test output does not enter the release commit.
- Anti-negligence review: no gate used a replayed test result. Lint's only package task reused the TypeScript build cache after the same source had already passed an uncached build; build and test truth came from the explicit `--force` runs.

### Milestone 10 - Production Discovery persistence deployment

- Deployed Worker version `54843af9-db50-465e-8324-3b3b1c909d41` with the protected Discovery File route and SHA-256 estate storage keys.
- Rotated the shared backend bearer through Cloudflare and Vercel's provider secret stores without printing or committing it. The first Vercel add used a Sensitive variable type that was unavailable to the packaged function; it was converted back to the project's encrypted runtime type and deployed without cache.
- Ran a controlled production external-source request, then fetched the estate-scoped Discovery File directly from the Worker. Both calls returned `200`, storage/readback were `verified`, revisions matched, and source facts plus the regenerated dossier survived the round trip.
- The first Vercel deployment returned `404` because only the artifact-local handler existed. Added the root production wrapper, tested it, committed it, and redeployed.
- The next live bearer proof found the root server gate accepted Google sessions but rejected the internal bearer before dispatch. Replaced that duplicate session-only check with the shared route guard, added a production-wrapper bearer regression assertion, and redeployed commit `d33e464`.
- Final production proof on `heirright-landing-demo-ev4m9zubi-solvys.vercel.app`: auth-first HTML `200`, anonymous Discovery File `401`, backend-bearer Discovery File `200`, and verified KV record readback. Explicitly reassigned `heirright-leads.vercel.app` to the same deployment and repeated the same successful checks.
- Deleted all temporary token and environment files after proof. `surface.heirright.com` remains assigned in Vercel but has no public A or CNAME response, so TLS/browser proof on that hostname remains blocked by DNS ownership outside the repository.
- Anti-negligence review: two locally green seams failed in production, function packaging and the root auth dispatcher. Neither was accepted as a provider issue; each was repaired at the deployed boundary and retested through the actual public function URL.

### Milestone 11 - Verified packet linkage, supporting evidence, and shared team state

- The final hostile UI review found two fake-completion paths: a timed document action could create a generated-file record without a PDF, and a selected Mac filename was treated as linked even though no file bytes left the browser. Removed the legacy S28 proof seed, fake Google export record, timer completion, and unverified document records.
- Generated Discovery sections now become complete only after `/api/exports` returns an immutable artifact, the PDF is fetched back, its artifact ID and SHA-256 hash match response headers, its MIME type is PDF, its body is non-trivial, and every selected estate has verified shared Discovery File readback. Batch and single export use the same verifier.
- Packet artifact references are written back into each estate's shared Discovery File. Reloading Doc Prep reopens and verifies the newest team packet instead of trusting one browser's prior state; expired packet references no longer count as linked documents.
- Added protected supporting-document storage for PDF, JPG, PNG, WEBP, DOC, and DOCX files up to 3 MB. The Worker verifies file signatures, stores the actual bytes, verifies storage readback, returns metadata without file data, and serves the file only through an authenticated artifact route with ID/hash headers.
- Added an explicit Remove supporting file action that deletes every saved version for that dossier section and requires backend removal readback. The API supports authenticated delete and the focused test proves the artifact returns `404` afterward, so controlled production probes and real users do not leave unwanted evidence behind.
- Added a browser proof that a document stays incomplete when Attach File is clicked without a file, then becomes linked only after the selected PDF passes backend artifact readback. The complete Chromium suite passed all three E2E tests with no console or page errors.
- Replaced production-only local browser state with an authenticated Cloudflare Durable Object for the approved CRM, Doc Prep, review, Closing, and Outreach state keys. Writes are serialized, revisioned, read back before success, and hydrated without creating a write loop. CRM copy now says when shared workspace readback is running and only announces team availability after verification.
- Documented all 154 runtime environment names referenced by the apps and packages, including provider aliases, test controls, Worker bindings, and migration-only compatibility variables. No values or credentials were added.
- Fresh proof: Worker and artifact builds passed; the full artifact suite passed packet integrity, source workflow, auth inventory, attachment byte readback, Durable Object reload, 13-page single PDF, and 25-page batch PDF assertions; `pnpm test:e2e` passed 3/3.
- Anti-negligence review: file names, animation completion, local storage, and HTTP success are no longer accepted as document or team-state proof. Each user-visible completion now depends on backend storage readback.

### Milestone 12 - Production artifact and team-state round trip

- Deployed Worker version `9362f78a-2f36-4acb-a4e7-1b86a6cc616b` with the `WorkspaceState` Durable Object, supporting-document lifecycle, packet-reference persistence, and existing KV bindings. Rotated the private Worker/Vercel bearer through provider secret stores without printing or committing it.
- Deployed Vercel production `heirright-landing-demo-cv0hqqiwe-solvys.vercel.app`, assigned `surface.heirright.com`, and repointed `heirright-leads.vercel.app` to the same build. The custom hostname still has no public DNS record; the Vercel alias alone cannot make the hostname resolve.
- Public-boundary security proof: anonymous Workspace state, supporting-document, and connection-status requests each returned `401`. The public auth session returned `200` with `authenticated:false` and `configured:false`, proving Google OAuth credentials are still absent rather than silently bypassed.
- Team-state proof through Vercel: read the current CRM estate state, wrote the exact same value through the Durable Object, then read the same revision and value back. The write and read both returned `200` with `readbackStatus:verified`, preserving existing user data while proving production durability.
- Supporting-document proof through Vercel: uploaded a controlled 35-byte PDF, fetched the exact bytes with matching artifact ID and content hash, deleted it, and confirmed the authenticated artifact route returned `404` afterward.
- Discovery artifact proof through Vercel: reused the controlled `s37-production-proof` Discovery File, generated one validated PDF, fetched 30,231 bytes with matching ID/hash headers, and confirmed the packet reference was written back to the shared Discovery File with verified readback.
- The controlled source record still carries six explicit provider/source blockers. The app preserved them and generated a review packet; it did not claim that missing Browserbase, Clerk, vital, or idiCORE evidence had been acquired.
- Added the five production auth/domain variables reported by Vercel to Turbo's declared global environment contract, removing build-time ambiguity without placing values in source.
- Anti-negligence review: the production probe preserved the current CRM state byte-for-byte and deleted its temporary attachment. The retained `s37-production-proof` Discovery record is an explicit audit fixture rather than an operator estate.

### Milestone 13 - Concurrent team-state and artifact-index hardening

- Replaced blind last-write-wins workspace updates with revision-aware writes. The browser records every server revision, includes it on save, and reloads the newest team copy when another operator wins the race instead of overwriting their work.
- The Durable Object now rejects missing revisions with `428` and stale revisions with `409`; the focused contract proves a stale payload cannot replace the current shared estate state and that state still survives a new Worker instance.
- Hardened supporting-document indexes and records against malformed stored JSON. Listing recovers to an empty set, a subsequent upload rebuilds the index, corrupted file metadata returns an explicit integrity failure, and delete no longer crashes on a damaged index.
- Replaced the premature “ready to link” section message with an instruction to generate and verify the PDF first, keeping operator copy aligned with the artifact contract.
- Fresh proof: Worker build and the complete artifact test suite passed, including source orchestration, auth boundaries, PDF integrity, attachment recovery, workspace conflicts, Tax Collector, Discovery persistence, and product-loop assertions.
- Anti-negligence review: serialized storage alone did not prevent logical lost updates because each browser writes whole snapshots. The revision check closes that team-use race at the write boundary rather than relying on users to avoid simultaneous work.

### Milestone 14 - Complete operator-control inventory and browser smoke loop

- Added a release contract that inventories all 171 product buttons and fails when a control has no command handler, form submission, inline action, or accessible focus behavior. Companion metadata attributes are explicitly separated from command attributes so the check cannot pass on decorative state alone.
- Expanded committed Chromium coverage through Report, History, Activity, Guide, single import, batch CSV import, all six Settings tabs, both Outreach side panels, the SMS editor, all three Help categories, and a walkthrough from launch through completion.
- Added a browser-level accessible-name assertion for every visible enabled button in Settings and the Outreach editor, preventing icon-only or dynamically rendered controls from shipping without an operator-readable name.
- The first hostile click pass found both CRM Import and the Outreach editor rendered below the top bar's stacking layer. Their header and close controls looked present but could not receive pointer events. Unified both modal layers above app chrome while preserving viewport-bounded bodies and internal scrolling.
- Isolated the browser suite from deployed/paid providers with an explicit local-backend-only server mode, while requiring the real local source orchestrator to return `200` plus verified Discovery File persistence. This prevents inherited production secrets or provider billing from making local acceptance flaky.
- Fresh proof: the control inventory passed all 171 buttons and the combined Playwright suite passed 4/4 end-to-end flows in 11.2 seconds with no console or page errors.
- Anti-negligence review: a listener reference alone does not prove the surrounding user loop, and a visible modal does not prove its controls can be clicked. The browser test verifies each major control changes the intended visible state and can be reversed or completed without an orphaned or occluded panel.

### Milestone 15 - Workflow, legal-template, and operator-language review

- Reopened the client document inventory instead of accepting the earlier “templates absent” shorthand. `HeirRight_Workflow_Templates_11.15.25.pdf` is the 20-page operating playbook; the two `Automation Project` PDFs are 54-page filled historical Closing examples with prior seller, property, trust, date, amount, and signature data and no PDF form fields.
- Confirmed the historical packets identify all fourteen Closing form families and one entity-name variation, but cannot be treated as approved blank legal templates without deleting or rewriting prior client facts. Closing remains correctly blocked until HeirRight supplies the approved blank originals and designated fill-field map.
- Compared the Discovery packet model against the HeirRight deal-flow checklist and Amaranthe packet shape. The model covers owner and stop rules, mailing address, deed/title/OR book and page, sale and adverse-possession signals, tax receipt/payer/reassessment, court/probate/affidavit checks, vital records, backstory, reviewed family contacts, offer math, source evidence, blockers, and next action.
- Removed stale local-only wording from CRM imports, shared-estate deletion, Doc Prep preferences, and paused phases. Replaced two legacy no-op dashboard commands with real packet refresh and Admin review actions, and corrected Tax Collector/Linear readiness copy to describe actual product behavior.
- Added a browser assertion that every primary surface is free of raw engineering language including JSON, payload, adapter, schema, endpoint, CLI, TypeScript, and environment-variable wording.
- Fresh proof: the 171-button control inventory passed and the full Playwright suite passed 4/4 in 13.3 seconds with no console/page errors or operator-language violations.
- Anti-negligence review: example packets are evidence of the manual process, not safe fill-only templates. The product now states the exact missing legal input instead of implying no client documents exist or fabricating a Closing artifact from filled examples.

### Milestone 16 - Fresh release gates, exact deployment, and final hostile audit

- Deleted prior package outputs, then ran `pnpm turbo run build --force` and `pnpm turbo run test --force`. All three packages rebuilt uncached and all five test tasks passed, including the 61-fact worker validation, route guards, source orchestration, state conflicts, artifact storage, PDF integrity, and complete 171-control inventory.
- Ran `pnpm test:e2e`; Chromium passed 4/4 operator flows in 11.1 seconds with no page or console errors. `pnpm lint` passed and `pnpm audit --prod` reported no known vulnerabilities. Secret scans returned zero matches in current source and the complete S37 commit range.
- Generated and opened fresh Discovery artifacts. The single export is 13 pages; the batch export is one 25-page PDF with two complete estate sections and a clean page-13/page-14 estate boundary. The evidence register and blocker pages are readable and contained.
- Deployed Worker version `e4c36382-0289-4c3f-8eaf-0a5238c68746` and Vercel deployment `dpl_2HjpQNyg1k8LK4fRkuptb8rDvuyh` from commit `fdc1933`, both without build cache. Repointed `heirright-leads.vercel.app` to the exact deployment. Vercel also assigned `surface.heirright.com`, but the third-party domain still uses GoDaddy nameservers and needs `A surface.heirright.com 76.76.21.21` before public DNS can resolve.
- Production security and durability passed: four anonymous operational routes returned `401`; same-value shared state returned verified readback; a stale update returned `409` without changing current data; a controlled supporting PDF passed exact-byte and hash readback, delete, and post-delete `404`.
- Production packet proof passed with a reviewed dossier: the route returned an 11-section, 30,261-byte PDF with matching artifact ID/content-hash headers and verified packet-reference persistence. The retained unreviewed production fixture returned `422` for eight generic contact rows, proving the placeholder guard remains active.
- The estate-fact Tax Collector route reached the configured Browserbase function and classified the provider response as `browserbase_billing_required`; it did not claim a receipt. Podio reports durable bearer mode but an expired live access token. Google session status remains `configured:false`.
- Completed the dedicated `/solvys-audit` and `/solvys-heir-audit` record in `2026-07-12-s37-final-audit.md`. There are zero app-owned failing gates, but the sprint remains blocked on client/provider production inputs and cannot be called 100% or complete.
- Anti-negligence review: the final pass opened the actual PDF pages, attempted an unreviewed production export, exercised a stale state write, checked live provider classifications, and kept external/client failures visible. HTTP success, route existence, and local tests were not accepted as substitutes for those checks.

## Open Gates

- [x] Shared Vercel route auth and auth-first paint
- [ ] Real Discovery/Closing single and batch PDFs
- [ ] Estate-fact-driven Tax Collector receipt capture with live provider proof
- [ ] Durable Podio session/readback proof
- [x] Responsive Document Prep and keyboard/browser E2E
- [ ] Production domain/OAuth deployment proof
- [x] Final Solvys and HeirRight hostile review
