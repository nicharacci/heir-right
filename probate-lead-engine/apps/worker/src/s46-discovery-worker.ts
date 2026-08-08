import { acquireTaxCollectorReceipt } from "./adapters/tax-collector-receipt";
import { fetchOfficialRecordsCommercialApiFacts } from "./adapters/clerk-commercial-api";
import { runS45VitalObituary } from "./s45-browserbase";
import { generateS45Backstory } from "./s45-nous";
import { runS46OfficialRecords, type S46OfficialFinding } from "./s46-browserbase-official";
import {
  S46_MAX_BATCH_BYTES,
  S46_MAX_BATCH_FILES,
  S46_REQUIRED_SOURCES,
  applyVerifiedValue,
  assertPdfEnvelope,
  identitiesMatch,
  inspectPdf,
  mapIdiPages,
  obituaryIdentityMatches,
  publicMappingReceipt,
  safeFilename,
  sha256,
  validIdempotencyKey,
  type S46MappedDocument,
  type S46SourceName,
  type S46SourceOutcome,
} from "./s46-core";
import { renderS46DiscoveryPdf } from "./s46-packet-pdf";

type D1Prepared = { bind: (...values: unknown[]) => D1Prepared; first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results: T[] }>; run: () => Promise<unknown> };
interface D1Database { prepare: (sql: string) => D1Prepared; batch: (items: D1Prepared[]) => Promise<unknown> }
interface R2Object { arrayBuffer: () => Promise<ArrayBuffer>; body: ReadableStream; httpMetadata?: { contentType?: string } }
interface R2Bucket { put: (key: string, value: Uint8Array, options?: unknown) => Promise<void>; get: (key: string) => Promise<R2Object | null> }
interface Queue { send: (value: unknown) => Promise<void> }
interface MessageBatch<T> { messages: Array<{ body: T; attempts?: number; ack: () => void; retry: () => void }> }

interface Env {
  S46_DB: D1Database;
  S46_ARTIFACTS: R2Bucket;
  S46_DISCOVERY_QUEUE: Queue;
  S46_INTERNAL_API_TOKEN?: string;
  S46_EVENT_SIGNING_SECRET?: string;
  HEIRRIGHT_DOC_PREP_SOURCE_TOKEN?: string;
  S46_SANDBOX_LABEL: string;
  BROWSERBASE_API_KEY?: string;
  BROWSERBASE_API_BASE?: string;
  BROWSERBASE_PROJECT_ID?: string;
  OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID?: string;
  OFFICIAL_RECORDS_BROWSERBASE_FUNCTION_ID?: string;
  NOUS_API_KEY?: string;
  NOUS_BASE_URL?: string;
  NOUS_MODEL?: string;
  NOUS_FREE_TIER_ONLY?: string;
  IDI_API_ENABLED?: string;
  CLOSING_ENABLED?: string;
}

type QueueMessage = { jobId: string };
type JobRow = { id: string; case_id: string; batch_id: string | null; source_version_id: string; status: string; retry_count: number; artifact_id: string | null; error_code: string | null; mapping_receipt_json: string | null; private_mapping_json: string | null; created_at: string; updated_at: string };
type SourceRow = { id: string; object_key: string; mime_type: string; byte_count: number; sha256: string; page_count: number; sanitized_filename: string; original_order: number };

const now = (): string => new Date().toISOString();
const identifier = (prefix: string): string => `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const auth = (request: Request, env: Env): boolean => Boolean(env.S46_INTERNAL_API_TOKEN && request.headers.get("authorization") === `Bearer ${env.S46_INTERNAL_API_TOKEN}`);

function errorCode(error: unknown): string {
  return (error instanceof Error ? error.message : "processing_failed").replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 120);
}

async function event(env: Env, jobId: string, status: string, detail: Record<string, unknown> = {}): Promise<void> {
  const createdAt = now();
  await env.S46_DB.batch([
    env.S46_DB.prepare("INSERT INTO s46_events(job_id,event_type,safe_detail_json,created_at) VALUES(?,?,?,?)").bind(jobId, status, JSON.stringify(detail), createdAt),
    env.S46_DB.prepare("UPDATE s46_jobs SET status=?,updated_at=? WHERE id=?").bind(status, createdAt, jobId),
  ]);
}

async function sourceCheck(env: Env, jobId: string, source: S46SourceName, outcome: S46SourceOutcome, detail: Record<string, unknown> = {}): Promise<void> {
  const stamp = now();
  await env.S46_DB.prepare("UPDATE s46_source_checks SET outcome=?,safe_detail_json=?,finished_at=?,attempt_count=attempt_count+1 WHERE job_id=? AND source_name=?")
    .bind(outcome, JSON.stringify(detail), stamp, jobId, source).run();
  await env.S46_DB.prepare("INSERT INTO s46_events(job_id,event_type,safe_detail_json,created_at) VALUES(?,?,?,?)")
    .bind(jobId, "source_checked", JSON.stringify({ source, outcome, ...detail }), stamp).run();
}

async function sourceFinished(env: Env, jobId: string, source: S46SourceName): Promise<boolean> {
  const row = await env.S46_DB.prepare("SELECT outcome FROM s46_source_checks WHERE job_id=? AND source_name=?").bind(jobId, source).first<{ outcome: S46SourceOutcome }>();
  return row?.outcome === "found" || row?.outcome === "checked_not_found";
}

async function savePrivateMapping(env: Env, jobId: string, document: S46MappedDocument): Promise<void> {
  await env.S46_DB.prepare("UPDATE s46_jobs SET private_mapping_json=?,updated_at=? WHERE id=?").bind(JSON.stringify(document), now(), jobId).run();
}

async function updateBatchStatus(env: Env, jobId: string): Promise<void> {
  const job = await env.S46_DB.prepare("SELECT batch_id FROM s46_jobs WHERE id=?").bind(jobId).first<{ batch_id: string | null }>();
  if (!job?.batch_id) return;
  const rows = await env.S46_DB.prepare("SELECT status FROM s46_jobs WHERE batch_id=? ORDER BY batch_order").bind(job.batch_id).all<{ status: string }>();
  const statuses = rows.results.map((row) => row.status);
  const status = statuses.some((value) => value === "queued" || value === "processing")
    ? "processing"
    : statuses.some((value) => value === "failed")
      ? "completed_with_failures"
      : "completed";
  await env.S46_DB.prepare("UPDATE s46_batches SET status=?,updated_at=? WHERE id=?").bind(status, now(), job.batch_id).run();
}

async function observation(env: Env, jobId: string, source: S46SourceName, field: string, value: unknown, evidence: { page?: number; sourceUrl?: string; excerpt: string; sha256: string }): Promise<void> {
  await env.S46_DB.prepare("INSERT INTO s46_source_observations(id,job_id,source_name,field_key,value_json,page_number,source_url,private_excerpt,evidence_sha256,retrieved_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .bind(identifier("obs"), jobId, source, field, JSON.stringify(value), evidence.page || null, evidence.sourceUrl || null, evidence.excerpt.slice(0, 2000), evidence.sha256, now()).run();
}

function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(records);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(records)];
}

function firstText(items: Record<string, unknown>[], keys: string[]): string {
  for (const item of items) for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function runPropertyCheck(env: Env, jobId: string, document: S46MappedDocument): Promise<void> {
  const base = "https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx";
  const url = new URL(base);
  url.searchParams.set("clientAppName", "PropertySearch");
  if (document.folio) {
    url.searchParams.set("Operation", "GetPropertySearchByFolio");
    url.searchParams.set("folioNumber", document.folio.replace(/\D/g, ""));
  } else if (document.owner) {
    url.searchParams.set("Operation", "GetOwners");
    url.searchParams.set("ownerName", document.owner);
    url.searchParams.set("from", "1");
    url.searchParams.set("to", "40");
  } else {
    await sourceCheck(env, jobId, "property_appraiser", "unattempted", { code: "owner_and_folio_missing" });
    throw new Error("unattempted:property_appraiser");
  }
  let response: Response;
  try { response = await fetch(url, { headers: { accept: "application/json", "user-agent": "HeirRight-S46/1.0" } }); }
  catch { await sourceCheck(env, jobId, "property_appraiser", "provider_failed", { code: "network_error" }); throw new Error("provider_failed:property_appraiser"); }
  if (!response.ok) { await sourceCheck(env, jobId, "property_appraiser", response.status === 401 || response.status === 403 ? "blocked" : "provider_failed", { httpStatus: response.status }); throw new Error(`provider_failed:property_appraiser:${response.status}`); }
  const text = await response.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { await sourceCheck(env, jobId, "property_appraiser", "provider_failed", { code: "non_json" }); throw new Error("provider_failed:property_appraiser:non_json"); }
  const all = records(data);
  if (!all.length) { await sourceCheck(env, jobId, "property_appraiser", "checked_not_found", { resultCount: 0 }); return; }
  const owner = firstText(all, ["Name", "OwnerName", "Owner1"]);
  const folio = firstText(all, ["FolioNumber", "Strap", "Folio"] ).replace(/\D/g, "");
  const propertyAddress = firstText(all, ["Address", "SiteAddress", "PropertyAddress"]);
  const mailingAddress = firstText(all, ["Address1", "MailingAddress"]);
  if (owner && document.owner && !identitiesMatch(document.owner, owner)) {
    await sourceCheck(env, jobId, "property_appraiser", "identity_mismatch", { resultCount: all.length });
    throw new Error("identity_mismatch:property_appraiser");
  }
  const retrievedAt = now();
  const sum = await sha256(new TextEncoder().encode(text));
  const proof = { source: "property_appraiser" as const, sourceUrl: url.toString(), retrievedAt, sha256: sum, excerpt: text.replace(/\s+/g, " ").slice(0, 1200) };
  try { if (owner) applyVerifiedValue(document, "owner", owner, proof); }
  catch (error) { await sourceCheck(env, jobId, "property_appraiser", "conflict", { field: "owner" }); throw error; }
  if (folio) { document.folio = document.folio || folio; document.evidence.folio = proof; }
  if (propertyAddress) { document.propertyAddress = document.propertyAddress || propertyAddress; document.evidence.propertyAddress = proof; }
  if (mailingAddress) { document.mailingAddress = document.mailingAddress || mailingAddress; document.evidence.mailingAddress = proof; }
  await observation(env, jobId, "property_appraiser", "record", { owner, folio, propertyAddress, mailingAddress }, proof);
  await sourceCheck(env, jobId, "property_appraiser", owner || folio || propertyAddress ? "found" : "checked_not_found", { resultCount: all.length });
}

async function runTaxCheck(env: Env, jobId: string, document: S46MappedDocument): Promise<void> {
  const result = await acquireTaxCollectorReceipt({ parcelId: document.folio, propertyAddress: document.propertyAddress, ownerName: document.owner }, { env: env as unknown as Record<string, string | undefined> });
  if (!result.ok) {
    const outcome: S46SourceOutcome = result.mode === "not_configured" ? "unconfigured" : result.mode === "listing_page_no_receipt" ? "checked_not_found" : result.mode.includes("blocked") || result.mode === "browser_workflow_required" ? "blocked" : "provider_failed";
    await sourceCheck(env, jobId, "tax_collector", outcome, { mode: result.mode, paidRun: result.paidRun });
    if (outcome !== "checked_not_found") throw new Error(`${outcome}:tax_collector`);
    return;
  }
  const sourceUrl = result.discovery?.receiptUrl || result.finalUrl || result.searchUrl;
  const details = result.discovery?.details || {};
  const sourceText = JSON.stringify(details);
  const proof = { source: "tax_collector" as const, sourceUrl, retrievedAt: now(), sha256: await sha256(new TextEncoder().encode(sourceText || sourceUrl)), excerpt: sourceText.slice(0, 1200) };
  document.taxReceiptUrl = result.discovery?.receiptUrl || "";
  const taxSummary = [
    details.receiptStatus === "paid_in_full" ? "Paid in full" : details.receiptStatus,
    details.paidDate ? `Latest payment: ${details.paidDate}` : "",
    details.paidBy ? `Paid by: ${details.paidBy}` : "",
    details.amountDue && details.amountDue.amount > 0 ? `Amount due: $${details.amountDue.amount.toFixed(2)}` : "",
    details.unpaidYears?.length ? `Unpaid years: ${details.unpaidYears.join(", ")}` : "",
  ].filter(Boolean).join("; ");
  document.taxSummary = taxSummary ? `${taxSummary}.` : "";
  if (document.taxReceiptUrl) document.evidence.taxReceiptUrl = proof;
  if (document.taxSummary) document.evidence.taxSummary = proof;
  await observation(env, jobId, "tax_collector", "tax_record", result.discovery?.details || {}, proof);
  await sourceCheck(env, jobId, "tax_collector", result.discovery ? "found" : "checked_not_found", { mode: result.mode, paidRun: result.paidRun });
}

function normalizedOfficialAddress(value: string): string {
  return value.toUpperCase()
    .replace(/,?\s+(MIAMI|MIAMI GARDENS|HIALEAH|HOMESTEAD|FLORIDA CITY|NORTH MIAMI)(?:,?\s+FL)?(?:,?\s+\d{5}(?:-\d{4})?)?$/, "")
    .replace(/,.*$/, "")
    .replace(/\b(\d+)(?:ST|ND|RD|TH)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

async function directOfficialRecordsReadback(env: Env, propertyAddress: string): Promise<(S46OfficialFinding & { sourceText: string }) | null> {
  const expectedAddress = normalizedOfficialAddress(propertyAddress);
  if (!expectedAddress) return null;
  const cached = await env.S46_DB.prepare("SELECT source_url FROM s46_source_observations WHERE source_name='official_records' AND source_url IS NOT NULL ORDER BY retrieved_at DESC LIMIT 20").all<{ source_url: string }>();
  for (const row of cached.results) {
    let source: URL;
    try { source = new URL(row.source_url); } catch { continue; }
    const query = source.searchParams.get("qs");
    if (source.protocol !== "https:" || source.hostname !== "onlineservices.miamidadeclerk.gov" || !query) continue;
    const endpoint = new URL("https://onlineservices.miamidadeclerk.gov/officialrecords/api/SearchResults/getStandardRecords");
    endpoint.searchParams.set("qs", query);
    let response: Response;
    try { response = await fetch(endpoint, { headers: { accept: "application/json", "user-agent": "HeirRight-S46/1.0" } }); } catch { continue; }
    if (!response.ok) continue;
    const sourceText = await response.text();
    if (sourceText.length > 1_000_000) continue;
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(sourceText) as Record<string, unknown>; } catch { continue; }
    const criteria = payload.searchCritiriea && typeof payload.searchCritiriea === "object" ? payload.searchCritiriea as Record<string, unknown> : {};
    if (normalizedOfficialAddress(String(criteria.addressNoUnit || "")) !== expectedAddress) continue;
    const models = Array.isArray(payload.recordingModels) ? payload.recordingModels.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")) : [];
    const deeds = models.map((item) => ({
      clerkFileNumber: String(item.clerk_File || "").trim(),
      partyName: String(item.parties || "").trim(),
      address: String(item.address || item.addressnounit || "").trim(),
      documentType: String(item.doC_TYPE || "").trim(),
      recordedDate: String(item.reC_DATE || "").split(" ")[0],
      bookPage: String(item.reC_BOOKPAGE || "").trim(),
    })).filter((item) => item.partyName && item.documentType && item.recordedDate && item.bookPage)
      .sort((left, right) => Date.parse(right.recordedDate) - Date.parse(left.recordedDate));
    return { outcome: deeds.length ? "found" : "checked_not_found", recordCount: models.length, sourceUrl: source.toString(), latestDeed: deeds[0], sourceText };
  }
  return null;
}

async function runOfficialCheck(env: Env, jobId: string, document: S46MappedDocument): Promise<void> {
  const direct = await directOfficialRecordsReadback(env, document.propertyAddress);
  if (direct) {
    if (direct.outcome === "checked_not_found") {
      await sourceCheck(env, jobId, "official_records", "checked_not_found", { recordCount: direct.recordCount, accessMode: "direct_query_readback" });
      return;
    }
    const deed = direct.latestDeed;
    if (!deed || !identitiesMatch(document.owner, deed.partyName)) {
      await sourceCheck(env, jobId, "official_records", "identity_mismatch", { recordCount: direct.recordCount, accessMode: "direct_query_readback" });
      throw new Error("identity_mismatch:official_records");
    }
    const proof = { source: "official_records" as const, sourceUrl: direct.sourceUrl, retrievedAt: now(), sha256: await sha256(new TextEncoder().encode(direct.sourceText)), excerpt: JSON.stringify(deed).slice(0, 1200) };
    document.deedSummary = [`OR ${deed.bookPage}`, deed.documentType, deed.recordedDate, deed.partyName].filter(Boolean).join(" - ").slice(0, 600);
    document.evidence.deedSummary = proof;
    await observation(env, jobId, "official_records", "latest_deed", deed, proof);
    await sourceCheck(env, jobId, "official_records", "found", { recordCount: direct.recordCount, accessMode: "direct_query_readback" });
    return;
  }
  if (env.BROWSERBASE_API_KEY && env.OFFICIAL_RECORDS_BROWSERBASE_FUNCTION_ID) {
    try {
      const result = await runS46OfficialRecords(env, { ownerName: document.owner, propertyAddress: document.propertyAddress, parcelId: document.folio });
      if (result.outcome === "checked_not_found") {
        await sourceCheck(env, jobId, "official_records", "checked_not_found", { recordCount: result.recordCount, invocationId: result.invocationId || null, sessionId: result.sessionId || null });
        return;
      }
      const deed = result.latestDeed;
      if (!deed || !deed.bookPage || !deed.recordedDate || !deed.partyName) throw new Error("official_records_incomplete_result");
      if (!identitiesMatch(document.owner, deed.partyName)) {
        await sourceCheck(env, jobId, "official_records", "identity_mismatch", { recordCount: result.recordCount });
        throw new Error("identity_mismatch:official_records");
      }
      const deedText = JSON.stringify(deed);
      const proof = { source: "official_records" as const, sourceUrl: result.sourceUrl, retrievedAt: now(), sha256: await sha256(new TextEncoder().encode(deedText)), excerpt: deedText.slice(0, 1200) };
      document.deedSummary = [`OR ${deed.bookPage}`, deed.documentType, deed.recordedDate, deed.partyName].filter(Boolean).join(" - ").slice(0, 600);
      document.evidence.deedSummary = proof;
      await observation(env, jobId, "official_records", "latest_deed", deed, proof);
      await sourceCheck(env, jobId, "official_records", "found", { recordCount: result.recordCount, invocationId: result.invocationId || null, sessionId: result.sessionId || null });
      return;
    } catch (error) {
      if (/identity_mismatch/.test(errorCode(error))) throw error;
      const code = errorCode(error);
      const outcome: S46SourceOutcome = /unconfigured|required/.test(code) ? "unconfigured" : /blocked|billing|rate/.test(code) ? "blocked" : "provider_failed";
      await sourceCheck(env, jobId, "official_records", outcome, { code });
      throw new Error(`${outcome}:official_records`);
    }
  }
  const facts = await fetchOfficialRecordsCommercialApiFacts(jobId, { ownerName: document.owner, propertyAddress: document.propertyAddress, parcelId: document.folio, county: "miami-dade", source: "operator_cli" }, { env: env as unknown as Record<string, string | undefined> });
  const status = facts.find((fact) => fact.factType === "source_status");
  const statusValue = status?.value && typeof status.value === "object" ? status.value as Record<string, unknown> : {};
  const mode = String(statusValue.mode || "");
  if (!statusValue.ok) {
    const outcome: S46SourceOutcome = mode.includes("key_required") || mode.includes("input_required") ? "unconfigured" : "provider_failed";
    await sourceCheck(env, jobId, "official_records", outcome, { mode: mode || "unavailable" });
    throw new Error(`${outcome}:official_records`);
  }
  const deed = facts.find((fact) => fact.factType === "latest_deed")?.value;
  const bookPage = facts.find((fact) => fact.factType === "or_book_page")?.value;
  const sourceUrl = facts.find((fact) => fact.sourceUrl)?.sourceUrl || "";
  const text = JSON.stringify({ deed, bookPage });
  const proof = { source: "official_records" as const, sourceUrl, retrievedAt: now(), sha256: await sha256(new TextEncoder().encode(text)), excerpt: text.slice(0, 1200) };
  document.deedSummary = [typeof bookPage === "string" ? `OR ${bookPage}` : "", deed ? JSON.stringify(deed) : ""].filter(Boolean).join(" - ").slice(0, 600);
  if (document.deedSummary) document.evidence.deedSummary = proof;
  await observation(env, jobId, "official_records", "latest_deed", { deed, bookPage }, proof);
  await sourceCheck(env, jobId, "official_records", document.deedSummary ? "found" : "checked_not_found", { recordCount: Number(statusValue.recordCount || 0) });
}

async function recentObituaryNoMatch(env: Env, jobId: string, document: S46MappedDocument): Promise<{ jobId: string; checkedAt: string } | null> {
  const rows = await env.S46_DB.prepare("SELECT j.id,j.private_mapping_json,sc.finished_at FROM s46_jobs j JOIN s46_source_checks sc ON sc.job_id=j.id WHERE j.id<>? AND sc.source_name='direct_obituary' AND sc.outcome='checked_not_found' AND sc.finished_at IS NOT NULL ORDER BY sc.finished_at DESC LIMIT 20")
    .bind(jobId).all<{ id: string; private_mapping_json: string | null; finished_at: string }>();
  for (const row of rows.results) {
    if (Date.now() - Date.parse(row.finished_at) > 24 * 60 * 60 * 1000) continue;
    let prior: S46MappedDocument;
    try { prior = JSON.parse(row.private_mapping_json || "") as S46MappedDocument; } catch { continue; }
    if (!identitiesMatch(document.owner, prior.owner)) continue;
    if (normalizedOfficialAddress(document.propertyAddress) !== normalizedOfficialAddress(prior.propertyAddress)) continue;
    return { jobId: row.id, checkedAt: row.finished_at };
  }
  return null;
}

async function runObituaryCheck(env: Env, jobId: string, document: S46MappedDocument): Promise<void> {
  // Google search results cannot prove a fact. The existing Browserbase seam
  // discovers candidates, then returns evidence from the direct destination.
  const recentNoMatch = await recentObituaryNoMatch(env, jobId, document);
  if (recentNoMatch) {
    await sourceCheck(env, jobId, "direct_obituary", "checked_not_found", { code: "recent_verified_no_match", priorJobId: recentNoMatch.jobId, checkedAt: recentNoMatch.checkedAt });
    return;
  }
  if (!env.BROWSERBASE_API_KEY || !env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID) {
    await sourceCheck(env, jobId, "direct_obituary", "unconfigured", { code: "browserbase_not_configured" });
    throw new Error("unconfigured:direct_obituary");
  }
  try {
    const result = await runS45VitalObituary(env, { ownerName: document.owner, county: document.county, propertyAddress: document.propertyAddress });
    if (result.sourceUrl && !obituaryIdentityMatches(document.owner, `${result.sourceUrl} ${result.obituarySnapshot || ""}`)) throw new Error("identity_mismatch:direct_obituary");
    const proof = { source: "direct_obituary" as const, sourceUrl: result.sourceUrl, retrievedAt: now(), sha256: await sha256(new TextEncoder().encode(result.obituarySnapshot || result.sourceUrl)), excerpt: (result.obituarySnapshot || "Direct obituary source checked.").slice(0, 1200) };
    applyVerifiedValue(document, "dateOfBirth", result.dateOfBirth || "", proof);
    applyVerifiedValue(document, "dateOfDeath", result.dateOfDeath || "", proof);
    applyVerifiedValue(document, "obituaryUrl", result.sourceUrl || "", proof);
    await observation(env, jobId, "direct_obituary", "vital_record", { dateOfBirth: result.dateOfBirth || "", dateOfDeath: result.dateOfDeath || "", sourceUrl: result.sourceUrl || "" }, proof);
    await sourceCheck(env, jobId, "direct_obituary", result.sourceUrl ? "found" : "checked_not_found", { invocationId: result.invocationId || null, sessionId: result.sessionId || null });
  } catch (error) {
    const code = errorCode(error);
    if (/not_found|no_match|no_candidate/i.test(code)) { await sourceCheck(env, jobId, "direct_obituary", "checked_not_found", { code: "no_supported_match" }); return; }
    const outcome: S46SourceOutcome = /conflict/i.test(code) ? "conflict" : /identity/i.test(code) ? "identity_mismatch" : /blocked|billing|rate/i.test(code) ? "blocked" : "provider_failed";
    await sourceCheck(env, jobId, "direct_obituary", outcome, { code });
    throw new Error(`${outcome}:direct_obituary`);
  }
}

async function finishFields(env: Env, jobId: string, document: S46MappedDocument): Promise<void> {
  if (!document.owner) throw new Error("required_field_missing:owner");
  const facts = [document.owner, document.dateOfBirth, document.dateOfDeath, document.propertyAddress, document.deedSummary, document.taxSummary].filter(Boolean);
  if (facts.length >= 2) {
    if (!env.NOUS_API_KEY || !env.NOUS_MODEL) throw new Error("unconfigured:nous");
    try {
      document.backStory = (await generateS45Backstory(env, { ownerName: document.owner, dateOfBirth: document.dateOfBirth, dateOfDeath: document.dateOfDeath, obituarySnapshot: facts.join(". ") })).replace(/\s+/g, " ").trim().slice(0, 499);
      if (/\b(entitled|inheritance|legal conclusion|owns|heir at law)\b/i.test(document.backStory)) throw new Error("nous_backstory_not_compliant");
      document.evidence.backStory = { source: "nous", retrievedAt: now(), sha256: await sha256(new TextEncoder().encode(facts.join("|"))), excerpt: "Generated from verified facts only." };
    } catch (error) { throw new Error(`nous_failed:${errorCode(error)}`); }
  }
  const receipt = publicMappingReceipt(document);
  await env.S46_DB.prepare("DELETE FROM s46_field_receipts WHERE job_id=?").bind(jobId).run();
  const fields = receipt.fields as Array<Record<string, unknown>>;
  for (const field of fields) await env.S46_DB.prepare("INSERT INTO s46_field_receipts(id,job_id,field_key,populated,evidence_source,evidence_page,blank_reason,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(identifier("receipt"), jobId, field.field, field.populated ? 1 : 0, field.evidenceSource || null, field.evidencePage || null, field.reason || null, now()).run();
  for (const [heirIndex, heir] of document.heirs.entries()) {
    for (const key of ["name", "age", "email", "phone", "addresses"] as const) {
      const value = heir[key];
      const proof = heir.evidence[key];
      const populated = Array.isArray(value) ? value.length > 0 : Boolean(value);
      await env.S46_DB.prepare("INSERT INTO s46_field_receipts(id,job_id,field_key,populated,evidence_source,evidence_page,blank_reason,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .bind(identifier("receipt"), jobId, `heirs.${heirIndex}.${key}`, populated ? 1 : 0, proof?.source || null, proof?.page || null, populated ? null : "completed_check_no_supported_value", now()).run();
    }
  }
  await env.S46_DB.prepare("UPDATE s46_jobs SET mapping_receipt_json=?,updated_at=? WHERE id=?").bind(JSON.stringify(receipt), now(), jobId).run();
}

async function processJob(env: Env, jobId: string): Promise<void> {
  const job = await env.S46_DB.prepare("SELECT * FROM s46_jobs WHERE id=?").bind(jobId).first<JobRow>();
  if (!job) throw new Error("job_not_found");
  if (job.status === "completed") return;
  const source = await env.S46_DB.prepare("SELECT * FROM s46_source_versions WHERE id=?").bind(job.source_version_id).first<SourceRow>();
  if (!source) throw new Error("source_version_missing");
  await event(env, jobId, "processing");
  const object = await env.S46_ARTIFACTS.get(source.object_key);
  if (!object) throw new Error("source_readback_missing");
  const buffer = await object.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (object.httpMetadata?.contentType !== source.mime_type || bytes.byteLength !== source.byte_count || await sha256(buffer) !== source.sha256) throw new Error("source_altered");
  const inspection = await inspectPdf(bytes);
  if (inspection.pageCount !== source.page_count) throw new Error("source_page_count_changed");
  const document = job.private_mapping_json ? JSON.parse(job.private_mapping_json) as S46MappedDocument : await mapIdiPages(inspection.pages, source.sha256, now());
  if (!await sourceFinished(env, jobId, "idi_core")) await sourceCheck(env, jobId, "idi_core", document.owner ? "found" : "checked_not_found", { pageCount: inspection.pageCount, mappedFieldCount: Object.values(document.evidence).filter(Boolean).length });
  if (!await sourceFinished(env, jobId, "idi_contacts")) await sourceCheck(env, jobId, "idi_contacts", document.heirs.length ? "found" : "checked_not_found", { heirCount: document.heirs.length, populatedCellCount: document.heirs.reduce((sum, heir) => sum + [heir.name, heir.age, heir.email, heir.phone, heir.addresses.length ? "yes" : ""].filter(Boolean).length, 0) });
  if (!document.owner) throw new Error("required_field_missing:owner");
  if (!job.private_mapping_json) {
    for (const [field, proof] of Object.entries(document.evidence)) if (proof) await observation(env, jobId, "idi_core", field, (document as unknown as Record<string, unknown>)[field], proof);
    for (const [heirIndex, heir] of document.heirs.entries()) for (const [field, proof] of Object.entries(heir.evidence)) if (proof) await observation(env, jobId, "idi_contacts", `heirs.${heirIndex}.${field}`, heir[field as keyof typeof heir], proof);
  }
  await savePrivateMapping(env, jobId, document);
  if (!await sourceFinished(env, jobId, "property_appraiser")) { await runPropertyCheck(env, jobId, document); await savePrivateMapping(env, jobId, document); }
  if (!await sourceFinished(env, jobId, "tax_collector")) { await runTaxCheck(env, jobId, document); await savePrivateMapping(env, jobId, document); }
  if (!await sourceFinished(env, jobId, "official_records")) { await runOfficialCheck(env, jobId, document); await savePrivateMapping(env, jobId, document); }
  if (!await sourceFinished(env, jobId, "direct_obituary")) { await runObituaryCheck(env, jobId, document); await savePrivateMapping(env, jobId, document); }
  await finishFields(env, jobId, document);
  await event(env, jobId, "mapped", { populatedFields: Object.values(document).filter((value) => typeof value === "string" && value).length, heirCount: document.heirs.length });
  const pdf = await renderS46DiscoveryPdf(document);
  await event(env, jobId, "rendered", { byteCount: pdf.byteLength });
  const artifactId = identifier("artifact");
  const objectKey = `s46-sandbox/artifacts/${jobId}.pdf`;
  await env.S46_ARTIFACTS.put(objectKey, pdf, { httpMetadata: { contentType: "application/pdf" } });
  const readback = await env.S46_ARTIFACTS.get(objectKey);
  if (!readback) throw new Error("artifact_readback_missing");
  const artifactBuffer = await readback.arrayBuffer();
  const artifactBytes = new Uint8Array(artifactBuffer);
  const artifactSha = await sha256(artifactBuffer);
  if (readback.httpMetadata?.contentType !== "application/pdf" || artifactBytes.byteLength !== pdf.byteLength || artifactBytes.byteLength < 8 || new TextDecoder().decode(artifactBytes.slice(0, 5)) !== "%PDF-" || artifactSha !== await sha256(pdf)) throw new Error("artifact_verification_failed");
  await inspectPdf(artifactBytes);
  await env.S46_DB.batch([
    env.S46_DB.prepare("INSERT INTO s46_artifacts(id,job_id,object_key,mime_type,byte_count,sha256,verified_at,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(artifactId, jobId, objectKey, "application/pdf", artifactBytes.byteLength, artifactSha, now(), now()),
    env.S46_DB.prepare("UPDATE s46_jobs SET artifact_id=?,error_code=NULL,updated_at=? WHERE id=?").bind(artifactId, now(), jobId),
  ]);
  await event(env, jobId, "verified", { mimeType: "application/pdf", byteCount: artifactBytes.byteLength, sha256: artifactSha });
  await event(env, jobId, "completed");
  await updateBatchStatus(env, jobId);
}

async function readFile(part: FormDataEntryValue): Promise<{ file: File; bytes: Uint8Array; pageCount: number; sha: string; name: string }> {
  if (!(part instanceof File)) throw new Error("pdf_file_required");
  const bytes = new Uint8Array(await part.arrayBuffer());
  assertPdfEnvelope(bytes, part.type);
  const inspection = await inspectPdf(bytes);
  return { file: part, bytes, pageCount: inspection.pageCount, sha: await sha256(bytes), name: safeFilename(part.name) };
}

async function createRun(env: Env, request: Request, batchId: string | null, order: number, childKey?: string, suppliedFile?: FormDataEntryValue): Promise<Record<string, unknown>> {
  const key = childKey || request.headers.get("Idempotency-Key") || "";
  if (!validIdempotencyKey(key)) throw new Error("invalid_idempotency_key");
  const old = await env.S46_DB.prepare("SELECT id,case_id,status FROM s46_jobs WHERE idempotency_key=?").bind(key).first<{ id: string; case_id: string; status: string }>();
  if (old) return { caseId: old.case_id, jobId: old.id, status: old.status, duplicate: true, order };
  const form = suppliedFile ? null : await request.formData();
  const source = await readFile(suppliedFile || form!.get("file") || "");
  const sourceId = identifier("source");
  const objectKey = `s46-sandbox/sources/${sourceId}/${source.name}`;
  await env.S46_ARTIFACTS.put(objectKey, source.bytes, { httpMetadata: { contentType: "application/pdf" } });
  const readback = await env.S46_ARTIFACTS.get(objectKey);
  if (!readback) throw new Error("source_readback_missing");
  const buffer = await readback.arrayBuffer();
  if (readback.httpMetadata?.contentType !== "application/pdf" || buffer.byteLength !== source.bytes.byteLength || await sha256(buffer) !== source.sha) throw new Error("source_custody_verification_failed");
  await inspectPdf(new Uint8Array(buffer));
  const caseId = identifier("case");
  const jobId = identifier("job");
  const createdAt = now();
  const checks = S46_REQUIRED_SOURCES.map((stage) => env.S46_DB.prepare("INSERT INTO s46_source_checks(id,job_id,source_name,outcome,attempt_count,safe_detail_json,created_at) VALUES(?,?,?,?,?,?,?)").bind(identifier("check"), jobId, stage, "unattempted", 0, "{}", createdAt));
  await env.S46_DB.batch([
    env.S46_DB.prepare("INSERT INTO s46_cases(id,batch_id,created_at) VALUES(?,?,?)").bind(caseId, batchId, createdAt),
    env.S46_DB.prepare("INSERT INTO s46_source_versions(id,case_id,provider,object_key,sanitized_filename,mime_type,byte_count,sha256,page_count,original_order,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(sourceId, caseId, "manual_pdf", objectKey, source.name, "application/pdf", source.bytes.byteLength, source.sha, source.pageCount, order, createdAt),
    env.S46_DB.prepare("INSERT INTO s46_jobs(id,case_id,batch_id,idempotency_key,status,source_version_id,retry_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(jobId, caseId, batchId, key, "queued", sourceId, 0, createdAt, createdAt),
    env.S46_DB.prepare("INSERT INTO s46_events(job_id,event_type,safe_detail_json,created_at) VALUES(?,?,?,?)").bind(jobId, "queued", JSON.stringify({ sourceName: source.name, byteCount: source.bytes.byteLength, sha256: source.sha, pageCount: source.pageCount, order }), createdAt),
    ...checks,
  ]);
  await env.S46_DISCOVERY_QUEUE.send({ jobId });
  return { caseId, jobId, status: "queued", duplicate: false, order, source: { mimeType: "application/pdf", byteCount: source.bytes.byteLength, sha256: source.sha, pageCount: source.pageCount } };
}

async function artifactCheck(env: Env, jobId: string): Promise<Response> {
  const artifact = await env.S46_DB.prepare("SELECT object_key,mime_type,byte_count,sha256 FROM s46_artifacts WHERE job_id=?").bind(jobId).first<{ object_key: string; mime_type: string; byte_count: number; sha256: string }>();
  const object = artifact && await env.S46_ARTIFACTS.get(artifact.object_key);
  if (!artifact || !object) return json({ error: "artifact_not_found" }, 404);
  const buffer = await object.arrayBuffer();
  const valid = object.httpMetadata?.contentType === artifact.mime_type && buffer.byteLength === artifact.byte_count && await sha256(buffer) === artifact.sha256 && new TextDecoder().decode(new Uint8Array(buffer).slice(0, 5)) === "%PDF-";
  if (!valid) {
    await env.S46_DB.prepare("UPDATE s46_jobs SET status='failed',error_code='artifact_altered',updated_at=? WHERE id=?").bind(now(), jobId).run();
    return json({ error: "artifact_altered" }, 409);
  }
  return json({ verified: true, mimeType: artifact.mime_type, byteCount: artifact.byte_count, sha256: artifact.sha256 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!auth(request, env)) return json({ error: "unauthorized" }, 401);
    const url = new URL(request.url);
    if (url.pathname.startsWith("/s46/discovery/idi-api")) {
      if (env.IDI_API_ENABLED !== "true") return json({ error: "idi_api_disabled" }, 503);
      return json({ error: "idi_api_not_implemented" }, 501);
    }
    if (url.pathname.startsWith("/s46/closing")) return json({ error: "closing_disabled" }, 503);
    if (request.method === "POST" && url.pathname === "/s46/discovery/runs") {
      try { return json(await createRun(env, request, null, 0), 202); }
      catch (error) { return json({ error: errorCode(error) }, 400); }
    }
    if (request.method === "POST" && url.pathname === "/s46/discovery/batches") {
      const key = request.headers.get("Idempotency-Key") || "";
      if (!validIdempotencyKey(key)) return json({ error: "invalid_idempotency_key" }, 400);
      const old = await env.S46_DB.prepare("SELECT id,status FROM s46_batches WHERE idempotency_key=?").bind(key).first<{ id: string; status: string }>();
      if (old) {
        const children = await env.S46_DB.prepare("SELECT id,case_id,status FROM s46_jobs WHERE batch_id=? ORDER BY batch_order").bind(old.id).all();
        return json({ batchId: old.id, status: old.status, duplicate: true, children: children.results });
      }
      try {
        const form = await request.formData();
        const parts = form.getAll("files");
        if (!parts.length || parts.length > S46_MAX_BATCH_FILES || parts.some((part) => !(part instanceof File))) throw new Error("invalid_batch_file_count");
        const byteCount = parts.reduce((sum, part) => sum + (part instanceof File ? part.size : 0), 0);
        if (byteCount > S46_MAX_BATCH_BYTES) throw new Error("batch_too_large");
        const batchId = identifier("batch");
        const createdAt = now();
        await env.S46_DB.prepare("INSERT INTO s46_batches(id,idempotency_key,status,file_count,byte_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(batchId, key, "queued", parts.length, byteCount, createdAt, createdAt).run();
        const children: Record<string, unknown>[] = [];
        for (let index = 0; index < parts.length; index += 1) {
          const source = await readFile(parts[index]);
          const childKey = `${key.slice(0, 70)}:${source.sha}`.slice(0, 128);
          const child = await createRun(env, request, batchId, index, childKey, parts[index]);
          children.push(child);
          await env.S46_DB.prepare("UPDATE s46_jobs SET batch_order=? WHERE id=?").bind(index, child.jobId).run();
        }
        return json({ batchId, status: "queued", duplicate: false, children }, 202);
      } catch (error) { return json({ error: errorCode(error) }, 400); }
    }
    const match = url.pathname.match(/^\/s46\/discovery\/runs\/([^/]+)(\/events|\/retry|\/artifact-check|\/artifact|\/mapping-receipt)?$/);
    if (!match) return json({ error: "not_found" }, 404);
    const jobId = match[1];
    const action = match[2];
    if (request.method === "GET" && !action) {
      let job = await env.S46_DB.prepare("SELECT id,case_id,batch_id,status,retry_count,artifact_id,error_code,created_at,updated_at FROM s46_jobs WHERE id=?").bind(jobId).first<{ id: string; status: string } & Record<string, unknown>>();
      if (!job) return json({ error: "not_found" }, 404);
      if (job.status === "completed") {
        const verification = await artifactCheck(env, jobId);
        if (!verification.ok) job = await env.S46_DB.prepare("SELECT id,case_id,batch_id,status,retry_count,artifact_id,error_code,created_at,updated_at FROM s46_jobs WHERE id=?").bind(jobId).first<{ id: string; status: string } & Record<string, unknown>>() || job;
      }
      const checks = await env.S46_DB.prepare("SELECT source_name,outcome,attempt_count,safe_detail_json,finished_at FROM s46_source_checks WHERE job_id=? ORDER BY CASE source_name WHEN 'idi_core' THEN 1 WHEN 'idi_contacts' THEN 2 WHEN 'property_appraiser' THEN 3 WHEN 'tax_collector' THEN 4 WHEN 'official_records' THEN 5 WHEN 'direct_obituary' THEN 6 ELSE 99 END").bind(jobId).all();
      const artifact = await env.S46_DB.prepare("SELECT mime_type,byte_count,sha256,verified_at FROM s46_artifacts WHERE job_id=?").bind(jobId).first();
      return json({ job, sourceChecks: checks.results, artifact });
    }
    if (request.method === "GET" && action === "/events") {
      const last = Number(request.headers.get("Last-Event-ID") || url.searchParams.get("lastEventId") || "0");
      if (!Number.isInteger(last) || last < 0) return json({ error: "invalid_last_event_id" }, 400);
      const rows = await env.S46_DB.prepare("SELECT id,event_type,safe_detail_json,created_at FROM s46_events WHERE job_id=? AND id>? ORDER BY id").bind(jobId, last).all<{ id: number; event_type: string; safe_detail_json: string; created_at: string }>();
      const body = rows.results.map((row) => `id: ${row.id}\nevent: ${row.event_type}\ndata: ${JSON.stringify({ id: row.id, event: row.event_type, detail: JSON.parse(row.safe_detail_json), createdAt: row.created_at })}\n\n`).join("");
      return new Response(body, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
    }
    if (request.method === "POST" && action === "/retry") {
      const job = await env.S46_DB.prepare("SELECT id,status FROM s46_jobs WHERE id=?").bind(jobId).first<{ id: string; status: string }>();
      if (!job) return json({ error: "not_found" }, 404);
      if (job.status === "completed") return json({ error: "completed_job_cannot_retry" }, 409);
      await env.S46_DB.prepare("UPDATE s46_source_checks SET outcome='unattempted',finished_at=NULL WHERE job_id=? AND outcome NOT IN ('found','checked_not_found')").bind(jobId).run();
      await env.S46_DB.prepare("UPDATE s46_jobs SET status='queued',error_code=NULL,retry_count=retry_count+1,updated_at=? WHERE id=?").bind(now(), jobId).run();
      await event(env, jobId, "queued", { retry: true });
      await env.S46_DISCOVERY_QUEUE.send({ jobId });
      return json({ jobId, status: "queued" }, 202);
    }
    if (request.method === "GET" && action === "/artifact-check") return artifactCheck(env, jobId);
    if (request.method === "GET" && action === "/artifact") {
      const verification = await artifactCheck(env, jobId);
      if (!verification.ok) return verification;
      const artifact = await env.S46_DB.prepare("SELECT object_key,mime_type FROM s46_artifacts WHERE job_id=?").bind(jobId).first<{ object_key: string; mime_type: string }>();
      const object = artifact && await env.S46_ARTIFACTS.get(artifact.object_key);
      if (!artifact || !object) return json({ error: "artifact_not_found" }, 404);
      return new Response(object.body, { headers: { "content-type": artifact.mime_type, "content-disposition": "attachment; filename=verified-discovery.pdf", "cache-control": "no-store" } });
    }
    if (request.method === "GET" && action === "/mapping-receipt") {
      const job = await env.S46_DB.prepare("SELECT mapping_receipt_json FROM s46_jobs WHERE id=?").bind(jobId).first<{ mapping_receipt_json: string | null }>();
      return job?.mapping_receipt_json ? json(JSON.parse(job.mapping_receipt_json)) : json({ error: "receipt_not_found" }, 404);
    }
    return json({ error: "method_not_allowed" }, 405);
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try { await processJob(env, message.body.jobId); message.ack(); }
      catch (error) {
        const code = errorCode(error);
        const attempts = Number(message.attempts || 1);
        const exhausted = attempts >= 3;
        if (exhausted) for (const source of S46_REQUIRED_SOURCES) await env.S46_DB.prepare("UPDATE s46_source_checks SET outcome='retry_exhausted',finished_at=? WHERE job_id=? AND outcome NOT IN ('found','checked_not_found')").bind(now(), message.body.jobId).run();
        await env.S46_DB.prepare("UPDATE s46_jobs SET status='failed',error_code=?,retry_count=?,updated_at=? WHERE id=?").bind(exhausted ? "retry_exhausted" : code, attempts, now(), message.body.jobId).run();
        await event(env, message.body.jobId, "failed", { code: exhausted ? "retry_exhausted" : code, attempt: attempts });
        await updateBatchStatus(env, message.body.jobId);
        message.retry();
      }
    }
  },
};
