# Annie Hawkins Dossier Vs Constance North Star Review

Date: 2026-06-24

Selected live lead: Estate of Annie Hawkins, 131 NW 67 ST, Miami, FL 33150-0000

North Star packet: `docs/north-star-packets/constance-e-white-est-family-tree.pdf`

Finished dossier artifacts:

- `2026-06-24-annie-hawkins-family-tree-discovery-dossier.md`
- `2026-06-24-annie-hawkins-family-tree-discovery-dossier.html`
- `2026-06-24-annie-hawkins-family-tree-discovery-dossier.pdf`
- `2026-06-24-annie-hawkins-document-package-index.html`
- `2026-06-24-annie-hawkins-document-package-index.pdf`
- `sections/` split package with 16 section HTML/PDF pairs
- `2026-06-24-annie-hawkins-source-run.json`

## Verdict

This Annie Hawkins packet is the selected completed-goal dossier for the live app/report architecture pass. It is production-presentable as a review-gated Discovery Dossier and export-prep artifact. It is not being represented as a fully enriched heir-contact packet because the live public-source run did not produce confirmed DOB, DOD, obituary, probate case, tax amount, payer identity, or approved phone/email data.

That is the correct behavior: the system keeps missing facts visible instead of fabricating a Constance-style contact table.

## Sample Comparison

| Requirement from Constance packet | Annie finished dossier result | Status |
| --- | --- | --- |
| Title and estate/property identity | Uses `Estate of Annie Hawkins - 131 NW 67 ST, Miami, FL 33150-0000 Family-Tree Discovery Dossier`. | Matched |
| Date added / report date | Includes date added and report generated date. | Matched |
| Offer / Profit table | Mirrors the North Star rows: as-is value, taxes, liens, mortgages, selling costs, probate costs, partition costs, post-equity value, amount per heir, heirs on board, profit, offer per heir, min profit, and `$100,000 net`. | Matched |
| Back story | Includes public-source narrative, estate/property seed, guardrails, and explicit review-only limitations. | Matched |
| Table of contents | Includes a `Document Package Table Of Contents` that links to package sections in the single PDF and in the Dossier rail. Also includes a separate package index PDF that links to each split section PDF. | Better than sample PDF |
| Property/deed notes | Includes Miami-Dade source-backed address, owner, folio, latest deed date, and OR book/page. | Matched |
| Tax notes | Shows unpaid years, amount due, receipt, reassessment, and payer identity as review-gated. | Partial, honest |
| Probate/court notes | Shows case number, status, affidavit of heirs, and document availability as review-gated. | Partial, honest |
| Family tree/contact matrix | Provides spouse/child/parent/sibling/grandparent/aunt-uncle/cousin/niece-nephew review rows without fake contacts. | Partial, honest |
| Source links | HTML and PDF contain 10 real anchors; first source link opens the Miami-Dade Property Appraiser proxy URL for folio `01-3113-008-0130`. | Better than sample PDF |
| Podio / Google handoff | Includes Podio field map, Google Sheets row, Google Docs body target, and blockers. No live writes are performed. | Matched |
| Export readiness | Staged as review-only for Podio, Google Docs, Google Sheets, email, and SMS. | Matched |

## Link Review

The Constance PDF export has visual link-like text but no PDF link annotations when inspected with `pypdf`. The Annie single PDF has 29 link annotations: 10 external public-record URI links and 19 internal table-of-contents destination annotations. The split package index PDF has 18 URI annotations: one link to the single PDF, one link to the in-app HTML report, and 16 links to the separate section PDFs.

Browser proof clicked the first source link inside the Dossier rail iframe and opened:

`https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx?Operation=GetPropertySearchByFolio&folioNumber=0131130080130&clientAppName=PropertySearch`

Local Dossier rail proof also confirmed the embedded Completed Lead Report contains the TOC, property/offer/source/missing anchors, the Miami-Dade source URL, no table-toolbar controls, no script tags, no page errors, and no failed requests.

## Remaining Gaps Against A Fully Enriched Packet

- Owner DOB and DOD require manual/vital/obituary/probate source confirmation.
- Tax amount due, tax receipt status, reassessment, and payer identity require tax collector review.
- Probate case number, case status, affidavit of heirs, and document availability require clerk/probate review.
- Phone numbers, emails, and address history require approved enrichment/manual source capture.
- Offer/profit math requires as-is value, tax amount, liens, mortgages, cost assumptions, and confirmed heir count.

## Completion Standard

The completed-goal bar is met for:

- live public-source lead intake;
- comprehensive dossier structure;
- app-rendered Dossier rail workflow;
- export-ready Markdown, HTML, and PDF artifacts;
- clickable source links in the app and PDF;
- same-document PDF table-of-contents links;
- separate section PDFs with a linked package index;
- Podio/Google handoff preparation;
- honest review gates instead of fabricated facts.

The enrichment bar remains intentionally blocked until approved source access and operator review are available.
