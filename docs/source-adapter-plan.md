# HeirRight Source Adapter Plan

Status: Friday implementation v1  
Purpose: define how planned public sources feed the raw dossier engine.

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
| Miami-Dade Tax Collector | Guarded listing-page receipt client implemented for explicit receipt links, supplied listing HTML, direct listing URLs, and configured listing URL templates; source-capture now saves `browser_workflow_required` blockers; public GovHub entry currently returns a Cloudflare/browser-workflow blocker | folio, address, owner, listing page URL | acquisition/source status, receipt link, receipt artifact/link, paid date, payer identity, unpaid years, amount due, reassessment/status notes | block until bottom-right receipt link is captured or the browser-workflow/source blocker is preserved |
| Miami-Dade Official Records / Clerk | Live app reachability + title/deed source capture; browser/API extraction next | owner, address, folio, OR book/page | official-record source, deed attachment/link, OR book/page, recording date, grantor/grantee, title friction | `MISSING_TITLE_FACT`, source refs |
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
2. Browserbase or controlled Chrome path when the public GovHub search/listing workflow requires JavaScript, cookies, Cloudflare, or interactive navigation.
3. Promote any stable network endpoint observed during browser workflow back into the deterministic script client.
4. When neither path can capture the bottom-right receipt link, save `source_status.mode = browser_workflow_required` or `listing_page_no_receipt` and keep Discovery blocked. Do not leave payer/receipt fields blank without an operator-visible reason.

July 3 live probe: system Chrome reached `https://miamidade.county-taxes.com/public` but only saw Cloudflare security verification with a hidden Turnstile response input and no search form. That confirms Browserbase/controlled-browser workflow is needed for the public-search entry, while script extraction remains valid once a listing page or stable endpoint is available.

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
10. Tax/deed depth adapters.
11. Probate/heirship research queue.
12. Paid/manual source governance.
13. Completed lead report and offer math payload.
