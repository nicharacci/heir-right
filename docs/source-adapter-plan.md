# HeirRight Source Adapter Plan

Status: Friday implementation v2
Purpose: define how planned public sources feed the raw dossier engine.

## Current Source-Run Surface

`/api/discovery/external-source-run` is now the unified Doc Prep source-run route for worker, local artifact server, and serverless artifact fallback.

The route is intentionally proof-or-blocker:

- it returns `mode: external_source_run`, `runId`, `estateId`, `sourceSummaries`, `sourceFacts`, `dossier`, and `blockers`;
- it includes all Discovery source buckets so the operator can see what was checked or still blocked;
- it returns `ok: false` when a bucket is blocked or still needs review;
- it does not convert source-health checks or missing paid/manual sources into completed facts.

Current route proof returned eight buckets. With no live workflow credentials, the route returns blockers instead of blank facts. With Browserbase Function env pointed at a mocked Browserbase API, the actual source-run route returned Tax Collector receipt facts and vital/obituary facts while leaving Clerk, IDI, skip trace, and governed research blocked or review-gated. That means the buckets are callable and visible, not that every external source is fully automated end to end.

The source-run response now includes `sourceRunProof`, a machine-readable proof ledger for every required Discovery source. It records proof state, completion gate, credential/workflow gate, fact count, extracted fact types, review flags, and next action. The ledger keeps `legalTemplateAutofillAllowed: false` until a later Closing Prep review explicitly maps reviewed Discovery facts into template blanks.

Doc Prep renders that ledger as an operator-facing `What this run proved` section after `Run Source Search`. The UI copy must stay plain-language and action-oriented: capture the Tax Collector bottom-right receipt link, review Property Appraiser details, attach or connect the latest deed/Clerk access, run or import approved IDI evidence, and keep governed manual/paid sources approval-gated. Each source row can include `detailChecks` so the operator sees the exact receipt/deed/probate/vital/manual research steps instead of a vague source bucket. Backend credential names remain proof metadata, not operator instructions.

Official Records and Civil/Family/Probate now have first-class Miami-Dade Clerk Commercial Data Services API clients. They run only when `MIAMI_DADE_CLERK_AUTH_KEY` is configured; otherwise they return `commercial_api_key_required` blockers. This matches the Clerk's published API posture: developer account enabled, pre-paid units required, and `AuthKey` supplied with each request.

Tax Collector and vital/obituary browser workflows can invoke Browserbase Functions directly through Browserbase's `POST /v1/functions/{id}/invoke` API. The app keeps `BROWSERBASE_API_KEY` server-side and stores only readiness booleans in Settings. Browserbase invocation is documented by Browserbase at `https://docs.browserbase.com/reference/api/invoke-a-function`.

Deployable function sources live in `probate-lead-engine/browserbase-functions`. The package includes:

- `src/tax-collector-receipt.mjs`;
- `src/vital-obituary-review.mjs`;
- deterministic helper tests in `test/contracts.test.mjs`.

## Adapter Output Principle

Adapters return normalized `SourceFact[]`. They do not decide CRM state, score, outreach strategy, or legal interpretation. The dossier builder converts facts into claims, title events, review flags, document fields, and CRM adapter dry-run payloads.

Minimum adapter output:

```ts
type SourceFact = {
  id: string;
  runId: string;
  source: SourceKey;
  rawId: string;
  fetchedAt: string;
  county: string;
  subject: {
    ownerName?: string;
    propertyAddress?: string;
    parcelId?: string;
    caseNumber?: string;
    county?: string;
  };
  factType: FactType;
  value: unknown;
  confidence: number;
  sourceUrl?: string;
  reviewFlags: ReviewFlag[];
};
```

## Friday Source Scope

| Source | Friday posture | Primary inputs | Output facts | Blocker behavior |
| --- | --- | --- | --- | --- |
| Miami-Dade Property Appraiser | Live app reachability + public search URL; structured extraction where feasible | address, owner, folio | source status, search URL, seed address/owner/folio/county facts | `SOURCE_HEALTH_ONLY`, `MISSING_PROPERTY_FACT`, source refs |
| Miami-Dade Tax Collector | Guarded listing-page receipt client implemented for explicit receipt links, supplied listing HTML, direct listing URLs, configured listing URL templates, `TAX_COLLECTOR_BROWSER_WORKFLOW_URL`, and direct Browserbase Function invocation through `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`; public GovHub entry still needs real Browserbase proof | folio, address, owner, listing page URL, browser workflow/function response | acquisition/source status, receipt link, receipt artifact/link, paid date, payer identity, unpaid years, amount due, reassessment/status notes | block until bottom-right receipt link is captured or the browser-workflow/source blocker is preserved |
| Miami-Dade Official Records / Clerk | Commercial API client by folio when `MIAMI_DADE_CLERK_AUTH_KEY` exists; live app reachability + title/deed capture fallback | folio, owner, address, OR book/page | source status, latest record/deed candidate, OR book/page, recorded/document date, parties, title friction | `commercial_api_key_required` without AuthKey; human review required even when API returns records |
| Probate/Civil/Family Court | Commercial API client by case number when `MIAMI_DADE_CLERK_AUTH_KEY` exists; browser/capture fallback | case number, estate name, owner/decedent | source status, case number, case status, docket refs, affidavit/document availability | `commercial_api_key_required` without AuthKey; `commercial_api_input_required` without case number; human review required |
| Marriage/death/obituary/vital review | Configurable workflow API hook and direct Browserbase Function invocation implemented through `OBITUARY_VITAL_WORKFLOW_URL` / equivalents or `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`; real controlled-browser/API endpoint proof remains | estate/owner/decedent names, address, folio, case number, county | source status, obituary link, DOB/DOD, marriage-license signal, obituary snapshot, death-certificate status, incarceration/deceased-indicator status | `workflow_required` and `VITAL_RECORDS_WORKFLOW_REQUIRED` until the workflow/function is configured; human review required even when facts return |
| IDI Core / skip trace | Source-run bucket only; paid/API proof requires configured vendor access and approval | owner/address/DOB/DOD | imported or live-run contact/address/family evidence | paid/manual blocker until shared/default key or approved user key run produces readback |
| Governed manual and paid research | Route-visible source governance bucket; no automation claim | voter records, professional licenses, business/address associations, social profiles, deceased indicators, PI/field tasks | governed-source catalog, manual task list, approval blockers | `PAID_SOURCE_APPROVAL_REQUIRED`, `MANUAL_SOURCE_APPROVAL_REQUIRED`, and source evidence review until operator approval/proof exists |

The source-run proof now promotes the governed-source catalog into `detailChecks` on the proof ledger. The Doc Prep rail renders these detail rows for bottom-right receipt capture, voter records, professional licenses, business/address associations, social profiles, deceased-indicator cross-checks, door knock / field visit, neighbor research, code enforcement, and manual document requests. Every detail check keeps `legalTemplateAutofillAllowed: false`.
| Landing/intake | Local dry-run seed | address, owner, county, folio | intake seed fact | missing fields become review flags |
| Podio | Dry-run only unless config exists | raw dossier | CRM payload fact | missing credentials block live sync |
| Document packet | Draft internal summary first | raw dossier | document output fact | `HUMAN_REVIEW_REQUIRED` |

## Workflow-Informed Source Backlog

The workflow PDF expands the source plan beyond the Friday public-source slice. These sources should be modeled explicitly so the system can distinguish automated public checks from manual, paid, or compliance-sensitive steps.

| Source/workflow | Posture | Primary inputs | Output facts | Guardrail |
| --- | --- | --- | --- | --- |
| Estate-name search | First-class input path | estate name, owner name, case number | estate seed, possible owner, possible probate case | Never infer heirship without source refs |
| Owner type qualification | Automatable when source exposes owner type | owner name, property record | individual owner, company owner, trust/estate owner, disqualification status | Company-owned properties default out of scope |
| Recent sale / deed history | Public-source target | folio, address, owner, OR book/page | deed event, sale date, book/page, ownership activity | Sale within 5 years defaults disqualified/review |
| Adverse possession | Public-source target where available | owner, address, folio | adverse-possession claim/status | Missing signal becomes review flag |
| Tax history | Public-source target with guarded listing-page receipt extraction | folio, address, owner, Tax Collector listing page | unpaid tax years, tax amount, receipt status/link, reassessment, payer identity, paid date, browser-workflow blocker | Listing-page receipt link is required; script client handles direct listing pages/templates, and Browserbase/Chrome workflow is required when GovHub/Cloudflare blocks script access |
| Civil/family/probate docket | Public-source target | estate name, decedent, case number | case status, docket refs, affidavit of heirs, document availability | No legal conclusion; record-only facts |
| Marriage licenses | Public-source target | decedent/heir names | marriage-license signal, spouse hypothesis | Human review required |
| Obituary/death indicators | Public web/manual target | name, DOB/DOD, location | obituary link, death date, family names | Human review required |
| Voter/professional/license/incarceration records | Manual/public target | name, DOB, address | possible address/status signal | Do not use without source policy review |
| Code enforcement / door knock / neighbor research | Manual-only | property address, case details | manual task, photos/notes, officer contact | Never automate external contact by default |
| IDI / Intelius / Ancestry / ForeWarn / VitalChek / PI | Paid/manual source | identity, address, DOB/DOD | contact/address/family tree evidence | Requires client credentials and storage approval |

## Tax Collector Automation Decision

Use the smallest reliable path that preserves the workflow packet:

1. Script path first when the app already has an explicit receipt link, supplied listing HTML, direct listing URL, configured listing URL template, or stable endpoint discovered from browser observation.
2. Browserbase or controlled Chrome path when the public GovHub search/listing workflow requires JavaScript, cookies, Cloudflare, or interactive navigation. The worker can call `TAX_COLLECTOR_BROWSER_WORKFLOW_URL` and consume returned `listingHtml`, `listingUrl`, `receiptUrl`, or `receiptLink`.
3. Promote any stable network endpoint observed during browser workflow back into the deterministic script client.
4. When neither path can capture the bottom-right receipt link, save `source_status.mode = browser_workflow_required` or `listing_page_no_receipt` and keep Discovery blocked. Do not leave payer/receipt fields blank without an operator-visible reason.

July 3 live probe: system Chrome reached `https://miamidade.county-taxes.com/public` but only saw Cloudflare security verification with a hidden Turnstile response input and no search form. That confirms Browserbase/controlled-browser workflow is needed for the public-search entry, while script extraction remains valid once a listing page or stable endpoint is available.

The Doc Prep public-record capture card now shows a source-readiness preflight from `/api/connections/status` before `Run Source Search`, so operators see tax, Clerk, vital/obituary, IDI, and manual-research readiness before they spend a run.

## SourceRef Rule

Every dossier claim must have at least one source ref or a review flag explaining why it is not source-confirmed.

Example:

```json
{
  "source": "property_appraiser",
  "rawId": "property-search:20611-nw-33rd-pl-miami-gardens-fl-33056:status",
  "fetchedAt": "2026-05-19T00:00:00.000Z"
}
```

Every source ref must also identify its access class:

- `public_automated`
- `public_manual`
- `paid_manual`
- `paid_automated_pending_approval`
- `operator_observed`
- `client_supplied`

## Stop Conditions

Stop and report a blocker instead of forcing source extraction when:

- a source requires login or authenticated access without approval;
- a source presents CAPTCHA, Cloudflare, or anti-automation controls;
- a source returns repeated 403/429 responses;
- the public app is reachable but structured records require endpoint discovery;
- fetching would violate a known source restriction.

## Degradation Rules

- One blocked source must not fail the whole run.
- Missing facts create visible `reviewFlags`.
- Friday mode must not synthesize tax, probate, death, lien, or heirship facts.
- Friday mode must not use enrichment or skip trace.
- Friday mode can produce source-health facts while marking unverified property/title claims for review.
- Paid/manual facts may be represented as placeholders or task requirements, but should not be synthesized as completed evidence.
- Outreach facts must remain task/status metadata until compliance approval exists.

## Implementation Order

1. Property-first live public-source run shell.
2. Miami-Dade Property Appraiser adapter.
3. Miami-Dade Official Records / Clerk adapter.
4. Raw dossier builder with source-ref discipline.
5. CRM adapter dry-run payload.
6. Internal summary document packet.
7. Dashboard/intake and Friday handoff.
8. Workflow rule engine for disqualifications and review-required states.
9. Tax Collector search/listing client that lands on the listing page and extracts the bottom-right receipt link; direct listing/template path and saved browser-workflow blockers are implemented, Browserbase/Chrome capture remains for GovHub/Cloudflare.
10. Tax Collector browser-workflow API hook and direct Browserbase Function invocation via `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`; deployable function source exists and the hook is route-proven with a mocked Browserbase API, real GovHub proof remains.
11. Miami-Dade Clerk Commercial Data Services clients for Official Records by folio and Civil/Family/Probate by case number; AuthKey-gated client implemented, credentialed proof remains.
12. Vital/obituary/marriage/death workflow API hook and direct Browserbase Function invocation via `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`; deployable function source exists and the hook is route-proven with a mocked Browserbase API, real controlled-browser/API source proof remains.
13. Route-visible governed manual/paid research bucket for voter records, professional licenses, business/address associations, social profiles, deceased indicators, PI/field tasks, and paid genealogy/people-search tools.
14. Tax/deed depth adapters.
15. Probate/heirship research queue.
16. Paid/manual source governance.
17. Completed lead report and offer math payload.
