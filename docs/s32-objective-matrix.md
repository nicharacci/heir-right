# S32 Objective Matrix

Generated: 2026-07-04

This matrix is the final objective audit after S33 production-source cleanup. S33 evidence is now the current proof source for Doc Prep source automation, IDI route contracts, export behavior, and browser-button verification.

Status legend:

- Automated/proven: route, browser, PDF, or test proof exists in this repo.
- Human-required: the app intentionally stops for review, approval, legal judgment, or source judgment.
- Deployment-blocked: code path exists, but live production depends on missing secret/provider configuration.
- Blocked: product capability is not yet production-proven.
- Out of scope: intentionally not automated by HeirRight.

| Objective | Status | Proof / Evidence | S32 judgment |
| --- | --- | --- | --- |
| CRM estate row import, row linkage, and no paid-source trigger | Human-required / partially proven | Prior S32 browser proof for import controls; S33 preserved import/export navigation. | UI flow exists. Live Podio/Sheets import/readback is still not proven. |
| External public-source estate fetch | Automated/proven for app contract; deployment-blocked for real providers | `docs/evidence/s33-route-proof.json`, `docs/evidence/s33-browser-proof.json` | `/api/discovery/external-source-run` now calls Tax Collector receipt capture from estate facts and merges facts back into Discovery. Real production provider secrets/workflows still need installation. |
| Property Appraiser owner, folio, mailing address | Automated/proven from captured/source facts; live lookup pending | Source capture contracts and S33 route proof seed facts. | Normalized and review-gated. Production lookup depends on source adapter/provider configuration. |
| Owner stop rules: company owner, recent sale, no-contact/source blockers | Human-required | Settings/source readiness and Doc Prep blocker copy in S32/S33 browser proof. | Stop gates are visible. Final business/legal decision remains operator-owned. |
| Tax Collector search-to-receipt from estate facts | Automated/proven for app contract; deployment-blocked for real Browserbase/public workflow | `docs/evidence/s33-route-proof.json`; `docs/evidence/s33-docprep-tax-receipt.png` | HeirRight now starts from estate facts, invokes the browser-workflow interface, reaches a listing payload, extracts the bottom-right receipt link, and persists payer/date/amount/unpaid years/reassessment. The checked Vercel/Worker environments do not yet contain real Tax Collector Browserbase workflow secrets. |
| Tax payer, paid date, amount due, unpaid years, reassessment | Automated/proven | `s33-route-proof.json` and `s33-docprep-tax-receipt.png` | Fields populate after `Run Source Search` and are written as Discovery source facts. |
| Official Records latest deed, OR book/page, title friction, adverse possession | Automated/proven from capture; deployment-blocked for live Clerk | Source readiness contracts; prior S32 evidence. | Capture normalization works. Miami-Dade Clerk Commercial Data Services/AuthKey proof is still needed. |
| Probate/civil/family docket lookup, affidavits, OR cross-link | Automated/proven from capture; deployment-blocked for live Clerk | Source readiness contracts; prior S32 evidence. | Docket/cross-link capture is represented. Live Clerk workflow is not production-proven. |
| Marriage, death, obituary, Findagrave/Legacy/vital indicators | Automated/proven from capture; deployment-blocked for live browser/API workflow | Source readiness contracts; prior S32 evidence. | Captured evidence is normalized. Obituary/vital browser/API workflow remains a deployment/provider task. |
| IDI Core shared backend key for all users | Automated/proven in route contract; deployment-blocked for real production secret | `s33-route-proof.json`, `s33-final-anti-negligence-review.md` | Code supports `IDI_CORE_API_TOKEN` / `HEIRRIGHT_IDI_CORE_API_TOKEN` / legacy `IDI_CORE_API_KEY`, returns `apiKeySource: shared_default`, and redacts provider evidence. Vercel and Worker secret lists do not currently contain the real endpoint/token. |
| IDI personal user key override | Automated/proven | Contract tests and Settings/Doc Prep personal-key controls. | Users can paste a personal key without replacing the shared default for other users. |
| IDI duplicate paid-run guard | Automated/proven | `s33-route-proof.json` duplicate call returned `409 duplicate_idi_asset_search`. | Paid run lock is enforced by property/address lock key. |
| IDI contacts review gate | Automated/proven at contract level | S33 contract tests; existing contact review path. | IDI candidates remain import/review data, not automatic legal/closing truth. |
| Skip trace / Intelius / Ancestry / voter / license / social / business manual research | Human-required / governed | Source-governance copy and source readiness contracts. | These are not unrestricted automatic APIs. Keep approval/source review gates. |
| Discovery File assembly | Automated/proven | `s33-route-proof.json`, `s33-docprep-tax-receipt.png` | Discovery source facts are assembled from external run output and visible in Doc Prep. |
| Discovery Prep PDF | Automated/proven | `docs/evidence/s33-discovery-single.pdf`, `docs/evidence/s33-discovery-batch.pdf` | Single and batch Discovery exports are one PDF artifact per selected flow. |
| Closing Prep from reviewed Discovery File | Partially automated / human-required | Existing Closing Prep blocker UI and S33 Closing PDF export artifacts. | Deterministic flow exists, but final legal-template production proof still requires real template fixtures. |
| Closing legal-template language immutability | Blocked | No fixture diff against real client legal templates. | Must remain blocked until tests prove blank-fill only with no template-language mutation. |
| Missing/uncertain Closing fields | Automated/proven | Existing Closing required-field blocker UI. | Missing fields are visible and block export until valid. |
| Closing Prep PDF | Automated/proven | `docs/evidence/s33-closing-single.pdf`, `docs/evidence/s33-closing-batch.pdf` | Single and batch Closing exports are one PDF artifact per selected flow. |
| Batch Queue single-PDF export | Automated/proven | `s33-route-proof.json`, `s33-browser-proof.json`, `s33-export-buttons-proof.png` | Batch export returns one combined PDF per selected flow, not a folder. |
| Help & Demos | Automated/proven from S30/S32 and preserved through S33 | Existing S32 evidence and current browser navigation. | Help/Demos remains in the sidebar and guided walkthrough behavior is preserved. |
| Streaming Doc Prep Preview and section controls | Automated/proven | Existing S30/S32 proof; S33 browser check confirms Preview copy remains and no `Live packet preview` copy exists. | Preview rail naming and sectioned artifact surface are preserved. |
| Outreach production UX without ActivePieces native builder | Automated/proven for no-send package | Existing S31/S32 proof; S33 export-button proof preserved topbar/menu behavior. | First-party Outreach controls are the shipped UX. ActivePieces stays backstage. |
| Settings readiness controls | Automated/proven | `s33-settings-idi-ready.png`, `s33-browser-proof.json` | Settings shows IDI team-default posture and does not expose secrets. |
| Google OAuth gate and allowed domains | Automated/proven locally; deployment-blocked for production OAuth | Existing S32 auth evidence. | Local auth gate and avatar menu are proven. Production OAuth redirect/client proof remains required. |
| Google Workspace / Podio exports and readback | Prep proven; live write/readback blocked | `s33-browser-proof.json` clicked Google, Podio, Podio readiness check, and Google + Podio. | Buttons are not dangling. Live external writes/readback require approved credentials and explicit live mode. |
| Deployment readiness for team of 10 | Blocked | S33 deploy-provider checks show missing IDI endpoint/token; Clerk/vital/Google/Podio live proofs remain absent. | Not shippable for a team of 10 until deployment secrets, live providers, legal-template fixture tests, and production OAuth are proven. |
| Legal advice or legal-template rewriting | Out of scope | Flow contracts and anti-negligence reviews. | HeirRight should only populate approved blanks and preserve legal-template language. |
