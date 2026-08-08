# S46 - Verified Manual Discovery Intake

## Checkpoint truth

- Environment ID: `6a6b64c3a9ac832cb1491c495e4a55de`
- Environment label: `s46-verified-manual-discovery`
- Base: `refs/sprints/S45/T1/P11` at `4c6229293428d1d515f7e5c601c2b1db2debd865`
- Worktree: clean detached pickup, task-owned under `/tmp`
- Repository and GitHub identity: `nicharacci/heir-right`, `nicharacci`

## Implemented

- Authenticated multipart single and bounded batch PDF intake
- PDF MIME, magic, byte, page, `unpdf`, SHA-256, R2 put, and R2 readback gates
- Versioned D1 schema for cases, batches, jobs, source versions, checks, observations, field receipts, artifacts, and events
- ID-only Queue messages, retry state, DLQ configuration, event replay, reload, and idempotency
- Approved source outcome policy with fail-closed configuration, access, identity, conflict, provider, and exhaustion states
- Page evidence, partial heir-cell evidence, automatic mapping receipts, and private source excerpts
- North Star-aligned `pdf-lib` packet with a blank Offer/Profit table, clickable supported links, and no internal workflow copy
- Artifact MIME, byte, signature, load, and SHA-256 verification with alteration demotion
- Disabled IDI API and Closing routes, provider-neutral source contract, schemas, and sanitized fixtures
- Patched `mermaid` and `dompurify` dependency chain; production audit reports no known vulnerabilities

## Proof reached

- Full monorepo tests: pass, nine tasks
- S44 hold and evidence suites: pass
- S45 worker and packet suites: pass
- S46 build, worker validation, manual intake, source-attempt, batch, and North Star contracts: pass
- Wrangler local D1 migration: 19 statements pass
- Wrangler local HTTP and Queue runtime: authentication, malformed input, wrong MIME, duplicate, reload, Last-Event-ID replay, retry, DLQ, ordered batch children, isolated child failure, disabled lanes, and alteration demotion pass
- Both North Star first and second pages were rendered and compared with the S46 packet; the final two-page sample has no clipping, overlap, or forbidden copy
- Real private Michelet custody readback: case `case_a3bce94dcc554922bc3a05e225206852`, job `job_c672a23a51654155833aa9f6f0df1021`, PDF MIME, 3,153 bytes, 2 pages, SHA-256 `8fa1c0a7b9fd195dfaa5b7d20c00be1d0c086a5dd79ebd50449dd2a6ea99e388`
- Michelet source outcomes before exhaustion: IDI Core `found`, IDI contacts `found`, Property Appraiser `found`, Tax Collector `unconfigured`; Official Records and direct obituary did not run because the earlier required stage failed
- No Michelet Discovery PDF was created and completion was never reported

## External blockers

Cloudflare remote proof is blocked. Wrangler has no authenticated session, and the available browser identity has no permission for required HeirRight account `0accc9c5d935b32672a8df2b21ee2435`. No S46 Cloudflare resource was created in another account.

The approved Tax Collector browser workflow is also not configured in the available environment. The real Michelet run failed closed at that source, retried, reached the DLQ path, and left all later checks unfinished. Remote D1/R2/Queue proof, secret bindings, deployment, a completed Michelet artifact, private authenticated PDF handoff, and exact artifact readback remain blocked by these external authority and configuration gates.

## Binding manifest

Secrets, names only: `BROWSERBASE_API_KEY`, `HEIRRIGHT_DOC_PREP_SOURCE_TOKEN`, `NOUS_API_KEY`, `S46_EVENT_SIGNING_SECRET`, `S46_INTERNAL_API_TOKEN`.

Public configuration, names only: `BROWSERBASE_API_BASE`, `BROWSERBASE_PROJECT_ID`, `OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID`, `NOUS_BASE_URL`, `NOUS_MODEL`, `NOUS_FREE_TIER_ONLY`, `S46_SANDBOX_LABEL`, `IDI_API_ENABLED`, `CLOSING_ENABLED`.
