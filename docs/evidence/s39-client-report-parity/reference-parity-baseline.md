# S39 Client Report Parity Baseline

Date: 2026-07-30

## Audit Scope

Compare the current HeirRight Discovery PDF path against the client-provided family-tree reports and the completed-lead criteria in the two workflow packets. This baseline uses only files rendered and inspected during S39.

## Reference Set

| Reference | Pages | Size | Page geometry | Role |
| --- | ---: | ---: | --- | --- |
| Amaranthe Moreau | 11 | 244,728 bytes | US Letter, 612 x 792 pt | Complex 11-contact benchmark |
| Zilphy Mae Cooper | 5 | 129,946 bytes | US Letter, 612 x 792 pt | Uncertain-heir benchmark |
| Constance E. White | 4 | 146,858 bytes | US Letter, 612 x 792 pt | Simple three-contact benchmark |
| Deborah Cheatham | 5 | 160,398 bytes | US Letter, 612 x 792 pt | Probate/mortgage nuance benchmark |
| Current reviewed Discovery fixture | 10 | 34,479 bytes | US Letter, 612 x 792 pt | Full internal Discovery packet after S39 report hardening |
| Current public-estate family-tree fixture | 3 | 13,854 bytes | US Letter, 612 x 792 pt | Client-format document baseline without IDI |
| S39 reviewed completed-report fixture | 3 | 12,484 bytes | US Letter, 612 x 792 pt | Client-format artifact with reviewed IDI fields and rich narrative |

The older S33 one-page `discovery-single.pdf` is 1,461 bytes and contains only a packet index. It is historical failure evidence and is not the current renderer.

## Visual Findings

### Confirmed strengths

1. The current renderer uses the correct US Letter canvas.
2. Its first-page left edge is 72 pt, matching the client reference.
3. The property row, centered title, Family Tree subtitle, date, owner block, and owner-vital stack follow the client composition.
4. The Offer/Profit table keeps the client-specific 332 pt width, blue title band, three-column grid, cyan Min Profit row, and yellow `$100,000 Net` block.
5. Contact blocks flow as plain report text instead of cards.
6. Property, obituary, probate, and source evidence can be clickable PDF annotations.

### Structural risks

1. The combined Discovery artifact intentionally retains internal Qualification, Tax, Deed, Probate, Source Checklist, and Blockers pages. The separated `completed-report` child is now the explicit client delivery artifact.
2. The Google handoff now resolves and verifies the revision-bound `completed-report` child while retaining parent-packet approval. Contract and lifecycle tests prove the mocked Drive bytes exactly match that stored child artifact; authenticated live Drive proof remains.
3. The current public-estate family-tree fixture contains four relationship hypotheses with `IDI report pending`. This is correct fail-closed behavior but cannot satisfy the requested client demo.
4. The current reviewed fixture proves only one accepted contact. It does not prove multi-contact continuation, multiple phone/email values, dated address history, fractional interest, or associate wording from real input.
5. The model now exposes contact interest/fraction and structured address-history fields. Real new-estate extraction still has to prove those fields against the approved IDI report.
6. The workflow example contains a `Buy % Value` row that is not present in every supplied client report and is not a dedicated row in the current renderer. The new estate must establish whether the client expects it for this report.

### Copy and information risks

1. The S39 Back Story assembler now covers ownership/mailing, adverse possession, taxes, receipt/payer/reassessment, title encumbrances, probate/court, vital records, and inheritance caveats in client language. Regression tests reject internal run terms; live new-estate content remains.
2. Internal `Review:` paragraphs no longer render in the separated client report.
3. The client reports distinguish confirmed heirs, possible heirs, and non-heir associates. The current output needs a real-estate proof that those classes remain visibly distinct after IDI review.
4. Client backstories consistently address adverse possession, taxes, last payer and amount, reassessment, deed/title, mortgage/liens, marriage, probate, distribution status, discrepancies, and the inheritance hypothesis. The current renderer can display these facts, but the narrative assembler must be tested with a new estate.
5. Client person blocks preserve long dated address histories and every available phone/email. The current model supports these values, but real extraction and pagination remain unproven.

## Current Parity Matrix

| Criterion | Baseline result | Evidence / next proof |
| --- | --- | --- |
| US Letter output | Pass | Poppler metadata |
| Centered estate title, Family Tree, date | Pass | Rendered current first page |
| Linked property row | Pass | PDF annotation and first-page geometry test |
| Blue/yellow Offer/Profit table | Pass | Rendered current first page |
| Every required offer row | Partial | `Buy % Value` decision remains |
| Owner, DOB, DOD, obituary | Pass structurally | Real new-estate values remain |
| Plain-language Back Story | Pass on reviewed fixture | Internal run terms rejected; new-estate facts remain |
| Tax/deed/mortgage/probate narrative depth | Pass structurally | Comprehensive assembler rendered; new-estate source depth remains |
| Multiple heirs/possible heirs | Partial | Public hypotheses render; reviewed multi-contact output is unproven |
| Non-heir associates | Unproven | Requires IDI report and explicit labeling |
| Age and relationship/interest | Pass on reviewed fixture | `child - 1/9th Interest` and age 58 rendered |
| Current address | Partial | Supported; real extraction unproven |
| Dated address history | Pass on reviewed fixture | County and date ranges extracted and rendered; real report remains |
| Multiple phones and emails | Partial | Supported; real multi-value rendering unproven |
| Contact continuation pages | Pass on reviewed fixture | Heirs heading and normal contact block kept together; dense real blocks remain |
| No accidental blank page | Pass on current fixtures | Must repeat with new estate |
| Clickable evidence | Pass structurally | New-estate source coverage remains |
| Client-only report as primary delivered file | Pass in contract/lifecycle tests | Revision-bound `completed-report` child selected |
| Exact Google Drive readback | Pass in byte-level mock; live pending | Authenticated employee Drive flow remains |

## Highest-Risk Shared Seams

1. Authenticated Google Drive destination, permission, and live readback.
2. Real contact classification between the approved IDI report and the packet model.
3. Contact pagination under a dense real address/phone history.
4. Duplicate-paid-run protection during the real new-estate IDI retrieval.
5. Sanitized Recordly capture of the successful deployed workflow.

## Baseline Verdict

The current renderer now closes the known local artifact-selection, offer-field, narrative, structured-contact, and ordinary-pagination gaps. Page-one geometry and the client-specific table remain strong, and the separated reviewed fixture is visually coherent across three pages. The release gap is now the authenticated new-estate data run, real contact classification, live Drive delivery/readback, deployed replay, and Recordly proof.
