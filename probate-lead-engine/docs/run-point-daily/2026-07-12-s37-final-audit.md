# S37 Final Audit - Production Truth Recovery

Date: 2026-07-12  
Branch: `v1.1.1/heirright-2026-06-30-s28-production-loop`  
Audited commit: `fdc1933`  
Production deployment: `dpl_2HjpQNyg1k8LK4fRkuptb8rDvuyh`  
Worker version: `e4c36382-0289-4c3f-8eaf-0a5238c68746`

## Verdict

S37 is **blocked**, with zero remaining app-owned acceptance failures. The tested revision is deployed and the protected product boundary, shared state, supporting evidence, Discovery generation, batch merge, responsive Document Prep experience, and operator controls have passed. Shipment cannot be called complete until the client or provider supplies the production access required for Google OAuth and DNS, Browserbase billing, Podio reauthorization/readback, and approved blank Closing templates with a designated field map.

idiCORE remains excluded from S37 under the approved brief because the vendor has not issued API access.

## Solvys Audit

| Phase | Result | Evidence |
| --- | --- | --- |
| Environment | WARN | Node 25.8.1, Git 2.54.0, GitHub CLI 2.88.1, Vercel CLI 53.2.0, and Wrangler 4.92.0 are available. Vercel builds on Node 24. Google OAuth is unconfigured and the Surface hostname has no public DNS response. All 156 source runtime names are documented except `WORKSPACE_STATE`, which is a Wrangler Durable Object binding declared in `wrangler.toml`, not a process secret. |
| Build | PASS | `pnpm turbo run build --force` rebuilt all 3 packages with 0 cached tasks. Vercel repeated the same 3-package build without cache and completed deployment. |
| Code quality | WARN | The control inventory proves 171 buttons have real behavior and the browser loop covers every primary surface. `apps/artifact/src/index.html` remains a 24,799-line monolith and uses escaped HTML-template rendering; this is maintainability debt, not a demonstrated release failure. No `eval`, `new Function`, or `dangerouslySetInnerHTML` path was found. |
| Tests | PASS | `pnpm turbo run test --force` passed all 5 tasks; `pnpm test:e2e` passed 4/4 Chromium flows with no page or console errors; `pnpm lint` passed. Worker validation covered 61 facts. |
| Security | PASS | Anonymous Admin, connection, workspace, and attachment routes returned `401`. Stale state returned `409` and preserved the current value. `pnpm audit --prod` found no known vulnerabilities. Current source and the S37 commit range returned zero secret-pattern matches. |

Overall: **BLOCKED**  
App-owned blockers: **0**  
External/client blockers: **4 groups**  
Warnings: **2 maintainability/deployment-environment warnings**

## Acceptance Matrix

| S37 criterion | Result | Proof or exact blocker |
| --- | --- | --- |
| Auth-first initial paint | PASS | Production HTML starts with `data-auth-gated="true"`; the gate is present before hydration and CSS disables workspace pointer input. Anonymous protected routes return `401`. |
| Allowed and denied Google login, reload, switch, logout | FAIL - external | `/auth/session` reports `auth.required:true`, `auth.configured:false`. The Google OAuth client, redirect configuration, and session secret are not deployed. |
| `surface.heirright.com` | FAIL - external | Vercel assigned the alias, but the third-party domain still uses GoDaddy nameservers and public DNS returns no A/CNAME result. The DNS owner must add `A surface.heirright.com 76.76.21.21`; `heirright-leads.vercel.app` serves the current deployment with `200`. |
| Protected operational routes | PASS | Static route inventory plus production probes cover Admin, connections, Discovery, documents, exports, outreach, support, Podio, and workspace state. |
| Shared team state | PASS | Same-value production write returned verified readback; a stale revision returned `409 workspace_state_conflict`; subsequent read preserved the current value. |
| Supporting-document lifecycle | PASS | Production upload, exact-byte readback, artifact ID/hash headers, delete readback, and post-delete `404` all passed. Invalid signatures and corrupted indexes are covered by focused tests. |
| Autonomous source orchestration from estate facts | PASS - architecture | Property, owner, and folio facts drive the configured source adapters and persist a shared Discovery File. Provider failures remain explicit blockers and do not create facts. |
| Tax Collector public search and receipt | FAIL - external | The deployed run starts from folio/address/owner and reaches the configured Browserbase function, but Browserbase returns `browserbase_billing_required` before a receipt can be captured. |
| Discovery packet generation | PASS | A reviewed production dossier generated an 11-section, 30,261-byte PDF; artifact ID/hash headers matched and packet linkage persisted. The unreviewed audit dossier correctly returned `422` for eight generic contacts. |
| Discovery single export | PASS | Opened 13-page PDF contains actual estate facts, source links, review flags, blockers, and next action. No content clips or bleeds. |
| Discovery batch export | PASS | Opened 25-page, one-file PDF contains a batch contents page, two complete estates, a clean estate boundary, and final blockers. It is one PDF, not a folder. |
| Closing single and batch export | FAIL - client input | The repository contains filled historical examples, not approved blank immutable legal templates. The route correctly returns `422`; generating a packet by deleting old client facts would violate the fill-only contract. |
| Legal-template immutability | PASS - guard | No historical legal packet is altered or exported. Completion requires approved blank originals, a designated field map, and legal approval. |
| Podio durable connection/readback | FAIL - client action | Durable team auth is configured, but the current bearer is expired. The client must reconnect the approved HeirRight account and approve one Leads-app sample readback. |
| Responsive Document Prep and Preview | PASS | Chromium covered 390x844, 768x1024, 1110x627, 1280x720, and 1440x900. The app scrolls at reduced height, Preview stays inside its owner, and `Option+Up/Down` cycles sections. |
| Complete control loop | PASS | The 171-button inventory and 4-flow browser suite cover imports, queue actions, report/history/activity/guide, Settings tabs, Outreach, Help & Demos, and modal close/reversal paths. |
| Operator language | PASS | Every primary surface is checked for raw engineering terminology; incomplete sources and credentials show direct real-estate workflow actions. |
| Dependencies and secrets | PASS | Production dependency audit is clean; no current-source or S37-range secret fingerprints were found. Temporary proof artifacts and tokens are removed after final evidence capture. |

## PDF Inspection

- Discovery single: 13 letter-size pages, 30,253 bytes in the final local render. All eleven sections plus contents and final blockers are readable, contained, and estate-specific.
- Discovery batch: 25 letter-size pages, 57,481 bytes in the final local render. The first estate ends on page 13, the second begins on page 14, and the contents page declares both estates and 22 sections.
- Discovery source evidence is deliberately dense because it preserves every source and review flag. It remains legible and does not clip.
- Closing single/batch: no artifact was generated because approved blank templates and mappings are absent. This is the required legal safety behavior.

## HeirRight Workflow Audit

`/solvys-heir-audit`

Source checked: HeirRight workflow packet, Amaranthe example packet, 20-page workflow/template playbook, two 54-page filled historical Closing examples, and the HeirRight deal-flow checklist.

Backward: S37 secures the operator boundary; starts Discovery from an estate record; preserves owner and recent-sale stop rules; captures property, title, tax, probate, vital, family/contact, offer, source, blocker, and next-action sections; verifies supporting evidence; and produces one real Discovery PDF for single or batch export. Closing remains blocked before legal output because the required blank templates and deterministic field designations are absent.

UX pass: aligned. A non-technical operator can traverse CRM import, Discovery review, Preview, Queue, Settings, Outreach staging, and Help & Demos without raw implementation language. Provider and review blockers state the next business action.

Forward: client/provider closeout remains in S37, not a new feature sprint: configure Surface DNS and Google OAuth, activate Browserbase billing, reconnect Podio and approve one readback, then supply and approve blank Closing templates and mappings.

Alignment: blocked.

Required corrections before complete:

- Add `A surface.heirright.com 76.76.21.21` at the current GoDaddy-backed DNS provider and deploy the approved Google OAuth client/session secret, then prove allowed and denied accounts in the deployed browser.
- Activate Browserbase billing and rerun the estate-fact-to-listing-to-bottom-right-receipt path through production.
- Reconnect the approved HeirRight Podio account and complete one controlled Leads-app write/readback across a fresh session.
- Supply approved blank Closing originals, a designated field map, and legal approval; then generate and visually inspect Closing single and batch PDFs.

## Client Acceptance Checklist

- Open `surface.heirright.com`, sign in with an approved business account, reload, switch account, and log out; then try one disallowed domain and confirm it returns home without access.
- Select one approved estate and run Full Discovery without pasting a Tax Collector listing URL; open the captured receipt and confirm payer/payment facts match the county page.
- Review or remove every proposed family/contact row, generate Discovery, open the PDF, and confirm the packet is one complete file.
- Select two reviewed estates in Batch Queue and confirm the export is one combined PDF with both estates in the contents page.
- Reconnect Podio once, close the browser, reopen it, and confirm the connection remains active; approve one sample Leads card and verify the same card reads back.
- Provide the approved blank Closing documents and field designations, intentionally leave one required field unresolved, and confirm export blocks before completing and opening the final one-PDF packet.
