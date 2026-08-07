# S45 Discovery source gates

The S45 sandbox produces a Discovery Family Tree only after every required source stage succeeds. It uses the isolated S45 D1 database, private R2 bucket, and queue.

## Required stages

1. Extract page-by-page text from the controlled IDI PDF.
2. Store the page and supporting source text for each mapped IDI field in the private mapping receipt.
3. Run the approved Browserbase vital and obituary function. It must return a HTTPS obituary source, an obituary snapshot, DOB, and DOD.
4. Generate a short factual Back Story through the configured Nous endpoint. It must be under 500 characters and contain no legal conclusion.
5. Require one fully supported potential-heir record with name, age, email, phone number, and five addresses from the report before the packet can render.
6. Render with the existing Family Tree packet renderer, keep the offer/profit cells blank, store the PDF privately, then read it back for MIME type, byte count, and SHA-256.

The public PDF contains structured fields only. It does not contain page text, Browserbase snapshots, mapping receipts, raw report labels, or a review-state completion marker.

## Required sandbox bindings

- `BROWSERBASE_API_KEY`
- `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`
- `BROWSERBASE_API_BASE`
- `BROWSERBASE_PROJECT_ID`
- `NOUS_API_KEY`
- `NOUS_BASE_URL`
- `NOUS_MODEL`

Only binding names belong in source control. The worker fails closed if a required binding, source result, or completion condition is missing.

## Current proof boundary

The source-stage contract tests and the Family Tree packet contract pass. The current HeirRight runtime reports no configured Browserbase vital/obituary workflow, and the configured Nous account has no available model credit. A real Michelet run therefore remains failed rather than completed until those provider conditions are restored.
