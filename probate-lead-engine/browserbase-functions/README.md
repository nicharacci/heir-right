# HeirRight Browserbase Source Functions

These functions are the deployable browser workflows used by Discovery Doc Prep when public sites need a controlled browser session.

They do not decide heirship, legal status, or outreach eligibility. They only return source facts or source blockers for the app to review.

## Functions

- `src/tax-collector-receipt.mjs`: searches the Miami-Dade Tax Collector flow, opens the matching listing, and returns the bottom-right receipt link when found.
- `src/vital-obituary-review.mjs`: checks obituary/memorial/marriage-death indicators and returns reviewable links/snippets when found.

## Environment Wiring

After deployment, set these in the app runtime:

- `BROWSERBASE_API_KEY`
- `TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID`
- `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`

Optional:

- `BROWSERBASE_API_BASE`

## Local Checks

```bash
cd probate-lead-engine/browserbase-functions
pnpm run check
```

The check validates syntax and the deterministic extraction helpers. It does not call Browserbase or public sites.

## App Contract

The app invokes Browserbase through:

```text
POST /v1/functions/{id}/invoke
```

with `params` and `sessionCreateParams`. Browserbase documents that endpoint at `https://docs.browserbase.com/reference/api/invoke-a-function`.
