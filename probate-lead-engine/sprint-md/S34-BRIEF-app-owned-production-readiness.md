# Sprint Brief: S34 -- App-Owned Production Readiness (single-agent)

## Intent

When this is done, a HeirRight operator can use the app-owned surfaces without hidden manual engineering steps: Podio connection status will distinguish durable team access from browser-session reconnects, Browserbase source runs will be controlled before paid batch usage, and the app will show clear Settings readiness for what is ready, what is client-owned access, and what is blocked.

## Branch Target

`v1.1.1/heirright-2026-06-30-s28-production-loop`

## Scope -- Included

- [x] Harden Podio readiness so users understand whether the integration is durable team auth, server refresh auth, bearer fallback, or browser-session-only auth.
- [x] Store approved Podio OAuth refresh access server-side so one successful team connection can remain linked outside a single browser session.
- [x] Prefer durable Podio modes for readback/export and expose reconnect/breakage reasons without raw environment names in operator-facing UI.
- [x] Add Browserbase paid-usage policy status and batch-run approval controls so large source runs cannot silently spend browser sessions.
- [x] Surface Browserbase usage and durable Podio guidance in Settings without exposing ActivePieces builder UI or developer-console language.
- [x] Add regression tests for Podio durable-mode classification, Browserbase batch guardrails, source-run behavior, and Settings readiness copy.
- [x] Update progress evidence and run a final HeirRight audit against the deal-flow checklist.

## Scope -- Excluded (OUT OF BOUNDS)

- Client-owned IDI Core vendor API approval.
- Client-owned Miami-Dade Clerk Commercial Data Services AuthKey approval.
- Replacing Browserbase with Ollama, Agent Reach, or another autonomous browser agent.
- Direct legal-template rewriting or AI-generated legal language.
- Sending outbound SMS/email or creating production Podio records without approval and readback.

## Known Issues to Preserve

- Discovery and Closing Prep must keep legal-template autofill deterministic and review-gated.
- Tax Collector receipt capture must start from estate facts, not only from a pasted listing page.
- Browserbase proxy/browsing capabilities may depend on the paid account; code must report account blockers honestly.
- IDI Core remains client-owned until the vendor grants API access; the app may support team default token and per-user pasted key once available.

## Design Pass

### Layout / Interaction

Settings remains the existing dense workbench. Add concise operator-facing rows/cards for durable Podio connection state and Browserbase usage controls. Do not add a new marketing panel, builder iframe, or developer console; use existing Settings cards, connection rows, and source readiness bands.

### API / Service Shape

- `GET /api/connections/status` returns Podio auth-mode metadata and a `Browserbase Usage` row.
- Podio auth resolution distinguishes app token, server refresh token, browser-session refresh token, bearer token, and missing auth.
- Browserbase source routes block batch runs unless a batch approval marker or server-level approval flag is present.
- Single-estate Browserbase source runs remain allowed when credentials and function IDs are configured.

### Data / Agent Shape

No new agent layer. The work is deterministic auth/status/routing logic. Browserbase is an approved paid browser dependency; Ollama and Agent Reach stay out of scope.

### Aesthetic Rules

- `Design.md` was read immediately before planning and this brief is checked against it before implementation.
- Use existing Settings cards and rows.
- No gradients, emojis, decorative button borders, ActivePieces builder iframe, developer-facing copy, or raw environment-key text in user-facing readiness rows.
- Keep main operator copy in deal language: CRM, source runs, receipt capture, readback, approval, batch review.

## Development Flow

1. Add Podio auth-mode helpers and durable-team-auth metadata in the worker and Vercel status runtime.
2. Change browser OAuth runtime injection to use a browser-session refresh field, not the same field as server refresh auth.
3. Add Browserbase usage policy helpers, status row, and batch source-run approval guard.
4. Update Settings copy and status lists so durable Podio and Browserbase usage appear in the operator-facing readiness flow.
5. Add regression tests for Podio auth classification, Browserbase batch blocking/approval, and Settings exposure.
6. Run worker build, artifact contract tests, source-run tests, and route proofs.
7. Update run-point progress notes and perform `/solvys-heir-audit`.

## Acceptance Criteria

- [x] Podio status reports durable app-token/server-refresh auth separately from browser-session-only auth.
- [x] Podio OAuth callback can save the approved team refresh token in Worker KV for durable team access.
- [x] Browser-session Podio reconnect no longer claims durable team linkage.
- [x] Browserbase batch source runs block without approval and explain the operator action.
- [x] Browserbase single-estate source runs still work from estate facts.
- [x] Settings exposes durable Podio and Browserbase usage readiness without raw secret names.
- [x] `pnpm --filter @ple/worker build` passes.
- [x] Artifact contract tests pass.
- [x] Live or local route proof confirms `/api/connections/status` exposes the new state.
- [x] Final audit has no app-owned corrections remaining.

## Validation Commands

```bash
pnpm --filter @ple/worker build
node apps/artifact/test/source-readiness-contract.test.mjs
node apps/artifact/test/s31-readiness-contract.test.mjs
node apps/artifact/test/s33-production-source-cleanup.test.mjs
node apps/artifact/test/source-run-contract.test.mjs
node apps/artifact/test/s34-app-owned-readiness.test.mjs
```

## Commit Format

```text
fix: harden HeirRight app-owned production readiness
```
