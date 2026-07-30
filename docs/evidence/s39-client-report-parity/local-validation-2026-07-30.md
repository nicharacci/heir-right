# S39 Local Validation Receipt

Date: 2026-07-30

Scope: controlled local validation only. This receipt does not claim the pending authenticated `Sam@heirright.com`, real-estate, live Google Drive, deployed replay, or Recordly gates.

## Numbered Evidence

1. Client-format report, page 1
   - Current-run render: `/tmp/s39-client-report-final.jABcdw/page-1.png`
   - Result: estate title, Family Tree subtitle, date, linked property, complete blue Offer/Profit table, cyan/yellow anchors, owner, DOB, DOD, and obituary row render on US Letter without clipping.
2. Client-format report, page 2
   - Current-run render: `/tmp/s39-client-report-final.jABcdw/page-2.png`
   - Result: ownership, mailing, deed, adverse-possession, tax/receipt/reassessment, title encumbrance, probate/court, vital-record, contact, and inheritance caveats render in client language with linked evidence.
3. Client-format report, page 3
   - Current-run render: `/tmp/s39-client-report-final.jABcdw/page-3.png`
   - Result: the Heirs heading stays with the contact block; relationship, fractional interest, age, current address, dated county history, phone, and email render without an orphaned review page.
4. Desktop Document Prep
   - Current-run render: `/tmp/s39-browser-audit/docprep-1440x900.png`
   - Result: no horizontal overflow, clipped primary controls, or console/page errors.
5. Compact desktop Document Prep
   - Current-run render: `/tmp/s39-browser-audit/docprep-1280x720.png`
   - Result: no horizontal overflow, clipped primary controls, or console/page errors.
6. Tablet Document Prep
   - Current-run render: `/tmp/s39-browser-audit/docprep-768x1024.png`
   - Result: no horizontal overflow, clipped primary controls, or console/page errors.
7. Mobile Document Prep
   - Current-run render: `/tmp/s39-browser-audit/docprep-390x844.png`
   - Result: no horizontal overflow; Discovery controls, estate selection, upload, run, progress, keyboard focus, and bottom status remain reachable.
8. Controlled non-sample estate source run
   - Current-run render: `/tmp/s39-browser-audit/fresh-estate-after-source-local-1440.png`
   - Result: explicit user action reached the Worker source orchestrator, persisted the Discovery File, and surfaced the truthful IDI requirement.
9. Controlled IDI upload
   - Current-run render: `/tmp/s39-browser-audit/idi-upload-local-1440.png`
   - Result: PDF upload, supporting-document readback, real PDF.js extraction, estate binding, canonical import, source rerun, and contact review completed without raw report persistence in general browser state.

## Automated Gates

- `pnpm build`: pass.
- `pnpm lint`: pass.
- `pnpm test`: pass, five tasks.
- `pnpm --filter @ple/artifact test`: pass.
- `pnpm audit --prod --audit-level high`: no known vulnerabilities.
- `git diff --check`: pass.
- Identity scan: no `AirRight` string in source, tests, briefs, or evidence.
- PDF structure: US Letter, three pages, clickable annotations, non-trivial text on every page.
- PDF content: complete Offer/Profit values, client narrative, structured contact fields, and rejection of internal run terms.
- IDI extraction: PDF, DOCX, flattened PDF field boundaries, age, fractional interest, county, and dated address history.
- Google lifecycle: exact revision-bound `completed-report` child bytes uploaded and read back; wrong folder/size cleanup, concurrency, rollback, and token/PDF non-leakage pass.
- Responsive matrix: 1440x900, 1280x720, 768x1024, and 390x844 all report `scrollWidth === clientWidth`.

## Remaining Release Gates

1. Attach the user-provided Chrome session and authenticate only as `Sam@heirright.com`.
2. Create a brand-new real estate and run its configured public sources.
3. Retrieve/import exactly one approved IDI report and review the real relatives/associates.
4. Inspect every page of that estate's generated completed report and close the final parity ledger.
5. Approve the exact packet revision, export the `completed-report` child to Google Drive, and open/read back the same file.
6. Merge, deploy, and replay the authenticated production workflow.
7. Record and verify the sanitized Recordly video.
