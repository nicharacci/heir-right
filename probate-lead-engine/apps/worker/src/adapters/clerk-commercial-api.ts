import type { IntakeSeed, SourceFact } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "../lib";

type RuntimeEnv = Record<string, string | undefined>;
type FetchImpl = typeof fetch;
type JsonRecord = Record<string, unknown>;

interface ClerkApiOptions {
  env?: RuntimeEnv;
  fetchImpl?: FetchImpl;
}

const DEFAULT_API_BASE = "https://www2.miamidadeclerk.gov/Developers/api";
const OFFICIAL_RECORDS_DOC_URL = "https://www2.miamidadeclerk.gov/Developers/Help/Api/GET-api-OfficialRecords_parameter1_parameter2_authKey";
const CIVIL_CASE_DOC_URL = "https://www2.miamidadeclerk.gov/Developers/Help/Api/GET-api-Civil_caseNumber_AuthKey";
const CIVIL_DOCKET_DOC_URL = "https://www2.miamidadeclerk.gov/Developers/Help/Api/GET-api-Civil_civilCaseNumber_AuthKey";

const paidApiFlags = ["PAID_SOURCE_APPROVAL_REQUIRED", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D+/g, "");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

function clerkAuthKey(env: RuntimeEnv): string {
  return stringValue(env.MIAMI_DADE_CLERK_AUTH_KEY)
    || stringValue(env.MIAMI_DADE_COMMERCIAL_AUTH_KEY)
    || stringValue(env.CLERK_COMMERCIAL_AUTH_KEY);
}

function apiBase(env: RuntimeEnv): string {
  return stringValue(env.MIAMI_DADE_CLERK_API_BASE) || DEFAULT_API_BASE;
}

function redactedApiUrl(path: string, params: URLSearchParams, env: RuntimeEnv): string {
  const url = new URL(`${apiBase(env).replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  params.forEach((value, key) => url.searchParams.set(key, /authkey/i.test(key) ? "configured" : value));
  return url.toString();
}

function apiUrl(path: string, params: Record<string, string>, env: RuntimeEnv): { url: string; redactedUrl: string } {
  const searchParams = new URLSearchParams(params);
  const url = new URL(`${apiBase(env).replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  searchParams.forEach((value, key) => url.searchParams.set(key, value));
  return {
    url: url.toString(),
    redactedUrl: redactedApiUrl(path, searchParams, env),
  };
}

async function fetchClerkJson(path: string, params: Record<string, string>, options: ClerkApiOptions): Promise<{ ok: boolean; status: number; redactedUrl: string; data?: JsonRecord; error?: string }> {
  const env = options.env ?? {};
  const { url, redactedUrl } = apiUrl(path, params, env);
  try {
    const response = await (options.fetchImpl ?? fetch)(url, {
      headers: {
        accept: "application/json,text/json;q=0.9,*/*;q=0.8",
        "user-agent": "HeirRight-ClerkCommercialApi/1.0",
      },
    });
    const text = await response.text();
    let data: JsonRecord = {};
    try {
      data = JSON.parse(text) as JsonRecord;
    } catch {
      return {
        ok: false,
        status: response.status,
        redactedUrl,
        error: `Clerk Commercial API returned non-JSON content: ${text.replace(/\s+/g, " ").slice(0, 160)}`,
      };
    }
    const statusText = stringValue(data.Status);
    const ok = response.ok && !/^error$/i.test(statusText);
    return { ok, status: response.status, redactedUrl, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      redactedUrl,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function statusDesc(data: JsonRecord | undefined): string {
  return stringValue(data?.StatusDesc) || stringValue(data?.Status) || "";
}

function officialRecordsFromPayload(data: JsonRecord | undefined): JsonRecord[] {
  const list = asRecord(data?.OfficialRecordList);
  return asArray(list.OfficialRecords).map(asRecord);
}

function latestOfficialRecord(records: JsonRecord[]): JsonRecord | null {
  return records
    .slice()
    .sort((a, b) => Date.parse(stringValue(b.REC_DATE)) - Date.parse(stringValue(a.REC_DATE)))
    .find((record) => stringValue(record.REC_BOOK) || stringValue(record.REC_PAGE) || stringValue(record.CFN_SEQ))
    ?? records[0]
    ?? null;
}

function officialRecordBookPage(record: JsonRecord | null): string {
  if (!record) return "";
  return [record.REC_BOOK, record.REC_PAGE].map(stringValue).filter(Boolean).join("/");
}

export async function fetchOfficialRecordsCommercialApiFacts(runId: string, seed: IntakeSeed, options: ClerkApiOptions = {}): Promise<SourceFact[]> {
  const env = options.env ?? {};
  const authKey = clerkAuthKey(env);
  const fetchedAt = nowIso();
  const rawId = `official-records-api:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);
  const folio = digitsOnly(seed.parcelId);
  if (!authKey) {
    return [fact({
      runId,
      source: "official_records",
      rawId: `${rawId}:auth-required`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: {
        mode: "commercial_api_key_required",
        ok: false,
        note: "Miami-Dade Clerk Official Records API requires a commercial Developer AuthKey and pre-paid units before the app can run this source automatically.",
        docsUrl: OFFICIAL_RECORDS_DOC_URL,
      },
      confidence: 0.9,
      sourceUrl: OFFICIAL_RECORDS_DOC_URL,
      reviewFlags: [...paidApiFlags],
    })];
  }
  if (!folio) {
    return [fact({
      runId,
      source: "official_records",
      rawId: `${rawId}:folio-required`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: {
        mode: "commercial_api_input_required",
        ok: false,
        note: "Official Records API is configured, but this estate needs a folio, CFN, or OR book/page before the API can search records.",
        docsUrl: OFFICIAL_RECORDS_DOC_URL,
      },
      confidence: 0.75,
      sourceUrl: OFFICIAL_RECORDS_DOC_URL,
      reviewFlags: ["MISSING_OR_BOOK_PAGE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    })];
  }

  const result = await fetchClerkJson("OfficialRecords", { parameter1: folio, parameter2: "FN", authKey }, options);
  const records = officialRecordsFromPayload(result.data);
  const latest = latestOfficialRecord(records);
  const bookPage = officialRecordBookPage(latest);
  const common = {
    runId,
    fetchedAt,
    county: seed.county,
    subject,
    sourceUrl: result.redactedUrl,
  };
  return [
    fact({
      ...common,
      source: "official_records",
      rawId: `${rawId}:api-status`,
      factType: "source_status",
      value: {
        mode: "commercial_api",
        ok: result.ok,
        status: result.status,
        statusDesc: statusDesc(result.data) || result.error || "",
        unitsBalance: result.data?.UnitsBalance ?? null,
        recordCount: records.length,
        note: result.ok
          ? `Official Records API returned ${records.length} record${records.length === 1 ? "" : "s"} for folio ${folio}. Review the deed/title facts before using them.`
          : `Official Records API did not return usable records: ${statusDesc(result.data) || result.error || `HTTP ${result.status}`}.`,
      },
      confidence: result.ok ? 0.85 : 0.25,
      reviewFlags: result.ok ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["SOURCE_BLOCKED", ...paidApiFlags],
    }),
    fact({
      ...common,
      source: "official_records",
      rawId: `${rawId}:latest-record`,
      factType: "latest_deed",
      value: latest ? {
        documentType: stringValue(latest.DOC_TYPE),
        recordedDate: stringValue(latest.REC_DATE),
        documentDate: stringValue(latest.DOC_DATE),
        book: stringValue(latest.REC_BOOK),
        page: stringValue(latest.REC_PAGE),
        cfnYear: latest.CFN_YEAR ?? null,
        cfnSeq: latest.CFN_SEQ ?? null,
        firstParty: stringValue(latest.FIRST_PARTY),
        secondParty: stringValue(latest.SECOND_PARTY),
        caseNumber: stringValue(latest.CASE_NUM),
      } : null,
      confidence: latest ? 0.8 : 0,
      reviewFlags: latest ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_DEED_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      ...common,
      source: "official_records",
      rawId: `${rawId}:book-page`,
      factType: "or_book_page",
      value: bookPage || null,
      confidence: bookPage ? 0.8 : 0,
      reviewFlags: bookPage ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_OR_BOOK_PAGE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      ...common,
      source: "official_records",
      rawId: `${rawId}:last-sale-date`,
      factType: "last_sale_date",
      value: stringValue(latest?.DOC_DATE) || stringValue(latest?.REC_DATE) || null,
      confidence: latest ? 0.65 : 0,
      reviewFlags: latest ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_RECENT_SALE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  ];
}

function caseInfo(data: JsonRecord | undefined): JsonRecord {
  return asRecord(data?.CaseInfo);
}

function docketRows(data: JsonRecord | undefined): JsonRecord[] {
  const list = asRecord(data?.DocketsList);
  return asArray(list.DocketInfo).map(asRecord);
}

export async function fetchCivilProbateCommercialApiFacts(runId: string, seed: IntakeSeed, options: ClerkApiOptions = {}): Promise<SourceFact[]> {
  const env = options.env ?? {};
  const authKey = clerkAuthKey(env);
  const fetchedAt = nowIso();
  const rawId = `civil-probate-api:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);
  const caseNumber = stringValue(seed.caseNumber);
  if (!authKey) {
    return [fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:auth-required`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: {
        mode: "commercial_api_key_required",
        ok: false,
        note: "Miami-Dade Clerk Civil/Family/Probate API requires a commercial Developer AuthKey and pre-paid units before the app can run this source automatically.",
        docsUrl: CIVIL_CASE_DOC_URL,
      },
      confidence: 0.9,
      sourceUrl: CIVIL_CASE_DOC_URL,
      reviewFlags: [...paidApiFlags],
    })];
  }
  if (!caseNumber) {
    return [fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:case-required`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: {
        mode: "commercial_api_input_required",
        ok: false,
        note: "Clerk Civil/Family/Probate API is configured, but this estate needs a case number before the API can pull docket details.",
        docsUrl: CIVIL_CASE_DOC_URL,
      },
      confidence: 0.75,
      sourceUrl: CIVIL_CASE_DOC_URL,
      reviewFlags: ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    })];
  }

  const caseResult = await fetchClerkJson("Civil", { caseNumber, AuthKey: authKey }, options);
  const docketResult = await fetchClerkJson("Civil", { civilCaseNumber: caseNumber, AuthKey: authKey }, options);
  const info = caseInfo(caseResult.data);
  const dockets = docketRows(docketResult.data);
  const affidavit = dockets.find((item) => /affidavit.*heirs?|heir/i.test(`${item.docketDescrition ?? ""} ${item.comments ?? ""}`));
  const docsAvailable = dockets.some((item) => Number(item.numberOfDocuments) > 0);
  const caseStatus = stringValue(info.caseStatus) || statusDesc(caseResult.data);
  const common = {
    runId,
    fetchedAt,
    county: seed.county,
    subject,
  };
  return [
    fact({
      ...common,
      source: "probate_court",
      rawId: `${rawId}:api-status`,
      factType: "source_status",
      value: {
        mode: "commercial_api",
        ok: caseResult.ok || docketResult.ok,
        caseStatus,
        caseType: stringValue(info.caseType),
        filingDate: stringValue(info.filingDate),
        docketCount: dockets.length,
        unitsBalance: caseResult.data?.UnitsBalance ?? docketResult.data?.UnitsBalance ?? null,
        note: caseResult.ok || docketResult.ok
          ? `Clerk Civil/Family/Probate API returned case/docket data for ${caseNumber}. Review before treating probate facts as complete.`
          : `Clerk Civil/Family/Probate API did not return usable case data: ${statusDesc(caseResult.data) || caseResult.error || docketResult.error || "API request failed"}.`,
      },
      confidence: caseResult.ok || docketResult.ok ? 0.82 : 0.25,
      sourceUrl: caseResult.redactedUrl,
      reviewFlags: caseResult.ok || docketResult.ok ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["SOURCE_BLOCKED", ...paidApiFlags],
    }),
    fact({
      ...common,
      source: "probate_court",
      rawId: `${rawId}:case-number`,
      factType: "case_number",
      value: stringValue(info.caseNumber) || caseNumber,
      confidence: 0.8,
      sourceUrl: caseResult.redactedUrl,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      ...common,
      source: "probate_court",
      rawId: `${rawId}:case-status`,
      factType: "probate_case_status",
      value: caseStatus || null,
      confidence: caseStatus ? 0.8 : 0,
      sourceUrl: caseResult.redactedUrl,
      reviewFlags: caseStatus ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      ...common,
      source: "probate_court",
      rawId: `${rawId}:dockets`,
      factType: "civil_family_docket_ref",
      value: dockets.length ? dockets.slice(0, 12).map((item) => ({
        date: stringValue(item.eventDate),
        docketNumber: item.docketNumber ?? null,
        description: stringValue(item.docketDescrition),
        comments: stringValue(item.comments),
        documents: item.numberOfDocuments ?? null,
      })) : null,
      confidence: dockets.length ? 0.78 : 0,
      sourceUrl: docketResult.redactedUrl,
      reviewFlags: dockets.length ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      ...common,
      source: "probate_court",
      rawId: `${rawId}:affidavit-of-heirs`,
      factType: "affidavit_of_heirs_status",
      value: affidavit ? `Possible affidavit/heir docket: ${stringValue(affidavit.docketDescrition) || affidavit.docketNumber}` : null,
      confidence: affidavit ? 0.7 : 0,
      sourceUrl: docketResult.redactedUrl,
      reviewFlags: affidavit ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_AFFIDAVIT_OF_HEIRS_FACT", "PROBATE_DOCUMENT_REQUEST_REQUIRED", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      ...common,
      source: "probate_court",
      rawId: `${rawId}:document-availability`,
      factType: "probate_document_availability",
      value: docsAvailable ? "Docket images/documents indicated by Clerk API; review and request copies as needed." : null,
      confidence: docsAvailable ? 0.7 : 0,
      sourceUrl: docketResult.redactedUrl,
      reviewFlags: docsAvailable ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["PROBATE_DOCUMENT_REQUEST_REQUIRED", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  ];
}
