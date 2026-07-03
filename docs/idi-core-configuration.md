# idiCORE Configuration

## Current State

idiCORE operator portal access has been confirmed through the saved browser profile. The account can reach the idiCORE app and the Property Search surface.

This is not the same thing as backend API access. The visible idiCORE profile and admin surface do not expose API keys, developer credentials, webhooks, or integration settings.

## App Contract

HeirRight supports two distinct IDI states:

- `operator_portal`: the approved operator uses idiCORE in the browser, then imports the approved report text or attachment metadata into Discovery.
- `api`: IDI provides backend API access, then HeirRight can run the controlled paid Asset Discovery path through `/api/discovery/idi-asset-search/import`.

Portal mode is configured by:

- `IDI_CORE_LOGIN_URL`
- `IDI_CORE_PORTAL_URL` or `IDI_CORE_SEARCH_URL`
- one of `IDI_CORE_ACCOUNT_ID`, `IDI_CORE_ACCOUNT_COMPANY`, or `IDI_CORE_OPERATOR_EMAIL`

API mode additionally requires:

- `IDI_CORE_API_URL`
- `IDI_CORE_API_KEY` as the shared default key for all approved users
- `IDI_CORE_LIVE_RUN_APPROVED=true` for the single approved paid proof

Users can also paste a personal IDI access key in Settings or the Doc Prep IDI panel. That key is stored only in the user's browser and sent only with the live IDI run they trigger. It does not replace `IDI_CORE_API_KEY`, and the app never returns either key from connection-status APIs.

## Guardrails

- Do not store the idiCORE password in repo env files.
- Do not expose the shared `IDI_CORE_API_KEY` in browser responses; show only whether the team default is configured.
- Do not let a personal pasted key overwrite the shared default key.
- Do not scrape the logged-in browser session as a backend substitute.
- Do not call portal access a successful backend live run.
- Keep paid lookup execution blocked unless IDI provisions API access or the operator imports an approved portal report.
