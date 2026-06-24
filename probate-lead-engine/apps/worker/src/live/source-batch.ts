import type {
  ConfirmedSourceFactInput,
  DailyRunConfig,
  FreshLeadBatchRequest,
  FreshLeadBatchResult,
  FreshLeadCandidateSummary,
  FreshLeadFilters,
  FreshLeadSearchMode,
  FreshLeadSourceLedgerEntry,
  IntakeSeed,
} from "@ple/types";
import { runDailyProduction } from "../daily/run-daily";
import { runDryPipeline, type RunDryPipelineOptions } from "../index";
import { nowIso, slug } from "../lib";
import { renderQualificationReviewMarkdown } from "../qualification/qualification-review";
import { jsonOutput, textOutput } from "../storage/output-manifest";
import { persistOutput } from "../storage/write-output";

type FetchImpl = typeof fetch;
type RuntimeEnv = Record<string, string | undefined>;
type JsonRecord = Record<string, unknown>;

export interface FreshLeadBatchOptions extends RunDryPipelineOptions {
  fetchImpl?: FetchImpl;
}

const SOURCE = "miami_dade_property_appraiser" as const;
const PROPERTY_APPRAISER_PROXY = "https://apps.miamidadepa.gov/PApublicServiceProxy/PaServicesProxy.ashx";
const PROPERTY_SEARCH_PAGE = "https://www.miamidade.gov/pa/property_search.asp";
const DEFAULT_OWNER_QUERY = "EST OF";
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;
const HEIRRIGHT_EXAMPLE_FOLIOS = new Set(["3421080072710"]);
const ENTITY_OWNER_PATTERN = /\b(LLC|L\.L\.C\.|INC|CORP|CORPORATION|COMPANY|CO\.|LTD|LP|LLP|BANK|TRUST|ASSOCIATION|ASSOC|FOUNDATION|ENTERPRISES|HOLDINGS|INVESTMENTS|REALTY|PROPERTIES|CHURCH|IGLESIA|MINISTRIES|CONDO|COOPERATIVE)\b/i;

interface SourceCandidate {
  rawId: string;
  folio: string;
  ownerNames: string[];
  propertyAddress?: string;
  municipality?: string;
  sourceUrl: string;
  sourceRecord: unknown;
}

interface AcceptedCandidate extends SourceCandidate {
  detail: JsonRecord;
  detailUrl: string;
  seed: IntakeSeed;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text ? text : undefined;
}

function digitsOnly(value: unknown): string {
  return String(value ?? "").replace(/\D+/g, "");
}

function clampLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(parsed)));
}

function normalizeSearchMode(value: unknown): FreshLeadSearchMode {
  return value === "address" || value === "folio" ? value : "owner";
}

function normalizeCounty(value: unknown): string {
  const normalized = String(value || "miami-dade").trim().toLowerCase();
  if (normalized === "all" || normalized === "miami dade" || normalized === "miami-dade county, fl") return "miami-dade";
  return normalized || "miami-dade";
}

function normalizeFilters(filters: FreshLeadFilters | undefined): FreshLeadBatchResult["filters"] {
  const searchMode = normalizeSearchMode(filters?.searchMode);
  const fallbackQuery = searchMode === "owner" ? DEFAULT_OWNER_QUERY : "";
  return {
    county: normalizeCounty(filters?.county),
    query: String(filters?.query || fallbackQuery).trim() || fallbackQuery,
    searchMode,
    limit: clampLimit(filters?.limit),
    leadType: filters?.leadType,
    status: filters?.status,
    minimumEvidence: filters?.minimumEvidence,
    missingInfo: filters?.missingInfo,
    priorityOnly: filters?.priorityOnly,
    includeCompanyOwners: filters?.includeCompanyOwners,
  };
}

function propertyAppraiserUrl(params: Record<string, string | number | undefined>): string {
  const url = new URL(PROPERTY_APPRAISER_PROXY);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  if (!url.searchParams.has("clientAppName")) url.searchParams.set("clientAppName", "PropertySearch");
  return url.toString();
}

function detailUrl(folio: string): string {
  return propertyAppraiserUrl({
    Operation: "GetPropertySearchByFolio",
    folioNumber: folio,
  });
}

async function fetchJson(url: string, ledger: FreshLeadSourceLedgerEntry[], label: string, fetchImpl: FetchImpl): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      "user-agent": "HeirRight-LiveLeadBatch/1.0",
    },
  });
  const text = await response.text();
  const ok = response.ok;
  ledger.push({
    label,
    url,
    status: ok ? "used" : "blocked",
    note: ok ? `HTTP ${response.status} public source response received.` : `HTTP ${response.status} from public source.`,
  });
  if (!ok) throw new Error(`${label} failed with HTTP ${response.status}.`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned non-JSON content: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function ownerNamesFromCandidate(record: JsonRecord): string[] {
  return ["Owner1", "Owner2", "Owner3", "Owner4", "Name", "OwnerName"]
    .map((key) => stringValue(record[key]))
    .filter((value): value is string => Boolean(value));
}

function ownerNamesFromDetail(detail: JsonRecord): string[] {
  return asArray(detail.OwnerInfos)
    .map((item) => stringValue(asRecord(item).Name))
    .filter((value): value is string => Boolean(value));
}

function ownerDisplayName(ownerNames: string[]): string | undefined {
  return ownerNames.filter(Boolean).join(" / ") || undefined;
}

function isCompanyOwner(ownerNames: string[]): boolean {
  return ENTITY_OWNER_PATTERN.test(ownerNames.join(" "));
}

function folioFromRecord(record: JsonRecord): string {
  return digitsOnly(record.Strap ?? record.FolioNumber ?? record.Folio ?? record.folio);
}

function addressFromCandidate(record: JsonRecord): string | undefined {
  return stringValue(record.SiteAddress ?? record.Address ?? record.PropertyAddress);
}

function municipalityFromCandidate(record: JsonRecord): string | undefined {
  return stringValue(record.Municipality ?? record.City);
}

function candidateRecords(payload: unknown): unknown[] {
  const record = asRecord(payload);
  for (const key of ["MinimumPropertyInfos", "PropertyInfos", "SearchResults", "Results"]) {
    const values = asArray(record[key]);
    if (values.length) return values;
  }
  if (record.PropertyInfo || record.FolioNumber || record.Strap) return [record];
  return [];
}

function normalizeCandidate(recordInput: unknown, sourceUrl: string, index: number): SourceCandidate | null {
  const record = asRecord(recordInput);
  const folio = folioFromRecord(record);
  if (!folio) return null;
  const ownerNames = ownerNamesFromCandidate(record);
  return {
    rawId: `miami-dade-pa:${folio || index + 1}`,
    folio,
    ownerNames,
    propertyAddress: addressFromCandidate(record),
    municipality: municipalityFromCandidate(record),
    sourceUrl,
    sourceRecord: record,
  };
}

function siteAddressFromDetail(detail: JsonRecord): string | undefined {
  const site = asRecord(asArray(detail.SiteAddress)[0]);
  return stringValue(site.Address);
}

function mailingAddressFromDetail(detail: JsonRecord): string | undefined {
  const mailing = asRecord(detail.MailingAddress);
  const lines = [
    stringValue(mailing.Address1),
    stringValue(mailing.Address2),
    stringValue(mailing.Address3),
    [mailing.City, mailing.State, mailing.ZipCode].map(stringValue).filter(Boolean).join(" "),
  ].filter(Boolean);
  return lines.join(", ") || undefined;
}

function displayFolio(detail: JsonRecord, fallback: string): string {
  const propertyInfo = asRecord(detail.PropertyInfo);
  return stringValue(propertyInfo.FolioNumber) ?? fallback;
}

function latestSale(detail: JsonRecord): JsonRecord | undefined {
  const sales = asArray(detail.SalesInfos).map(asRecord);
  return sales.find((sale) => stringValue(sale.DateOfSale));
}

function orBookPageFromSale(sale: JsonRecord | undefined): { book?: string; page?: string } | undefined {
  if (!sale) return undefined;
  const book = stringValue(sale.OfficialRecordBook);
  const page = stringValue(sale.OfficialRecordPage);
  return book || page ? { book, page } : undefined;
}

function titleCaseLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

function estateNameFromOwners(ownerNames: string[]): string | undefined {
  const hit = ownerNames.find((name) => /\bEST(?:ATE)?\.?\s+OF\b|\bESTO\s+OF\b/i.test(name));
  if (!hit) return undefined;
  const cleaned = hit
    .replace(/\bREM\b/gi, "")
    .replace(/\bEST(?:ATE)?\.?\s+OF\b/gi, "")
    .replace(/\bESTO\s+OF\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned ? `Estate of ${titleCaseLoose(cleaned)}` : titleCaseLoose(hit);
}

function confirmedFact(input: Omit<ConfirmedSourceFactInput, "source" | "confidence"> & { confidence?: number }): ConfirmedSourceFactInput {
  return {
    source: "property_appraiser",
    confidence: input.confidence ?? 0.92,
    ...input,
  };
}

function sourceFactsForDetail(candidate: SourceCandidate, detail: JsonRecord, detailSourceUrl: string): ConfirmedSourceFactInput[] {
  const ownerNames = ownerNamesFromDetail(detail);
  const propertyInfo = asRecord(detail.PropertyInfo);
  const ownerName = ownerDisplayName(ownerNames) ?? ownerDisplayName(candidate.ownerNames);
  const address = siteAddressFromDetail(detail) ?? candidate.propertyAddress;
  const folio = displayFolio(detail, candidate.folio);
  const mailingAddress = mailingAddressFromDetail(detail);
  const sale = latestSale(detail);
  const orBookPage = orBookPageFromSale(sale);
  const saleInstrument = stringValue(sale?.SaleInstrument);
  const saleDate = stringValue(sale?.DateOfSale);
  const facts: ConfirmedSourceFactInput[] = [];

  if (address) {
    facts.push(confirmedFact({
      factType: "property_address",
      value: address,
      rawId: `${candidate.rawId}:property-address`,
      sourceUrl: detailSourceUrl,
    }));
  }
  if (ownerName) {
    facts.push(confirmedFact({
      factType: "property_owner",
      value: ownerName,
      rawId: `${candidate.rawId}:owner`,
      sourceUrl: detailSourceUrl,
    }));
  }
  facts.push(confirmedFact({
    factType: "property_folio",
    value: folio,
    rawId: `${candidate.rawId}:folio`,
    sourceUrl: detailSourceUrl,
  }));
  facts.push(confirmedFact({
    factType: "property_county",
    value: "miami-dade",
    rawId: `${candidate.rawId}:county`,
    sourceUrl: PROPERTY_SEARCH_PAGE,
  }));
  if (ownerName) {
    facts.push(confirmedFact({
      factType: "owner_type",
      value: isCompanyOwner(ownerNames.length ? ownerNames : candidate.ownerNames) ? "company" : "individual_review",
      rawId: `${candidate.rawId}:owner-type`,
      sourceUrl: detailSourceUrl,
    }));
  }
  if (mailingAddress) {
    facts.push(confirmedFact({
      factType: "mailing_address_signal",
      value: mailingAddress,
      rawId: `${candidate.rawId}:mailing-address`,
      sourceUrl: detailSourceUrl,
    }));
  }
  if (sale) {
    facts.push(confirmedFact({
      factType: "deed_history_status",
      value: `Property Appraiser sales history returned ${asArray(detail.SalesInfos).length} sale record(s); latest ${saleInstrument || "instrument"} dated ${saleDate || "unknown date"}.`,
      rawId: `${candidate.rawId}:deed-history`,
      sourceUrl: detailSourceUrl,
    }));
    if (saleDate) {
      facts.push(confirmedFact({
        factType: "last_sale_date",
        value: saleDate,
        rawId: `${candidate.rawId}:last-sale-date`,
        sourceUrl: detailSourceUrl,
      }));
    }
    if (orBookPage) {
      facts.push(confirmedFact({
        factType: "or_book_page",
        value: orBookPage,
        rawId: `${candidate.rawId}:or-book-page`,
        sourceUrl: detailSourceUrl,
      }));
    }
    facts.push(confirmedFact({
      factType: "latest_deed",
      value: {
        recordingDate: saleDate,
        documentType: saleInstrument,
        orBookPage,
        grantor: [sale.GrantorName1, sale.GrantorName2].map(stringValue).filter(Boolean).join(" / ") || undefined,
        grantee: [sale.GranteeName1, sale.GranteeName2].map(stringValue).filter(Boolean).join(" / ") || undefined,
      },
      rawId: `${candidate.rawId}:latest-deed`,
      sourceUrl: detailSourceUrl,
    }));
  }
  if (ownerNames.length || stringValue(propertyInfo.DORDescription)) {
    facts.push(confirmedFact({
      factType: "ownership_activity_note",
      value: [
        ownerNames.length ? `Owner records: ${ownerNames.join(" / ")}` : undefined,
        stringValue(propertyInfo.DORDescription) ? `DOR use: ${stringValue(propertyInfo.DORDescription)}` : undefined,
      ].filter(Boolean).join(". "),
      rawId: `${candidate.rawId}:ownership-note`,
      sourceUrl: detailSourceUrl,
    }));
  }

  return facts;
}

function seedFromAccepted(candidate: SourceCandidate, detail: JsonRecord, detailSourceUrl: string): IntakeSeed {
  const ownerNames = ownerNamesFromDetail(detail);
  const ownerName = ownerDisplayName(ownerNames) ?? ownerDisplayName(candidate.ownerNames);
  const propertyAddress = siteAddressFromDetail(detail) ?? candidate.propertyAddress;
  const display = displayFolio(detail, candidate.folio);
  return {
    ownerName,
    estateName: estateNameFromOwners(ownerNames.length ? ownerNames : candidate.ownerNames),
    propertyAddress,
    county: "miami-dade",
    parcelId: display,
    source: "external_public_source",
    seedBatchId: `live-miami-dade-pa-${new Date().toISOString().slice(0, 10)}`,
    seedSourceLabel: "Miami-Dade Property Appraiser live search",
    sourceOwner: "Miami-Dade County Property Appraiser",
    approvalMarker: "external_public_source_operator_pull",
    confirmedSourceFacts: sourceFactsForDetail(candidate, detail, detailSourceUrl),
  };
}

function candidateSummary(candidate: SourceCandidate, accepted: boolean, rejectedReason?: string): FreshLeadCandidateSummary {
  return {
    rawId: candidate.rawId,
    folio: candidate.folio,
    ownerName: ownerDisplayName(candidate.ownerNames),
    propertyAddress: candidate.propertyAddress,
    county: "miami-dade",
    municipality: candidate.municipality,
    sourceUrl: candidate.sourceUrl,
    accepted,
    rejectedReason,
    sourceRecord: candidate.sourceRecord,
  };
}

async function searchCandidates(filters: FreshLeadBatchResult["filters"], ledger: FreshLeadSourceLedgerEntry[], fetchImpl: FetchImpl): Promise<{ candidates: SourceCandidate[]; sourceUrl: string }> {
  const range = Math.max(filters.limit * 8, 40);
  let sourceUrl: string;
  if (filters.searchMode === "address") {
    sourceUrl = propertyAppraiserUrl({
      Operation: "GetAddress",
      myAddress: filters.query,
      myUnit: "",
      from: 1,
      to: range,
    });
  } else if (filters.searchMode === "folio") {
    const folio = digitsOnly(filters.query);
    sourceUrl = folio.length >= 13
      ? detailUrl(folio)
      : propertyAppraiserUrl({
        Operation: "GetPropertySearchByPartialFolio",
        partialFolioNumber: folio || filters.query,
        from: 1,
        to: range,
      });
  } else {
    sourceUrl = propertyAppraiserUrl({
      Operation: "GetOwners",
      ownerName: filters.query,
      from: 1,
      to: range,
    });
  }

  const payload = await fetchJson(sourceUrl, ledger, "Miami-Dade Property Appraiser candidate search", fetchImpl);
  const candidates = candidateRecords(payload)
    .map((record, index) => normalizeCandidate(record, sourceUrl, index))
    .filter((candidate): candidate is SourceCandidate => Boolean(candidate));
  return { candidates, sourceUrl };
}

function detailCompleted(detail: JsonRecord): boolean {
  return detail.Completed !== false && Boolean(detail.PropertyInfo || detail.OwnerInfos || detail.SiteAddress);
}

async function enrichCandidates(
  candidates: SourceCandidate[],
  filters: FreshLeadBatchResult["filters"],
  ledger: FreshLeadSourceLedgerEntry[],
  fetchImpl: FetchImpl,
): Promise<{ accepted: AcceptedCandidate[]; summaries: FreshLeadCandidateSummary[] }> {
  const accepted: AcceptedCandidate[] = [];
  const summaries: FreshLeadCandidateSummary[] = [];
  const seenFolios = new Set<string>();

  for (const candidate of candidates) {
    if (accepted.length >= filters.limit) break;
    if (seenFolios.has(candidate.folio)) {
      summaries.push(candidateSummary(candidate, false, "Duplicate folio suppressed from this fresh batch."));
      continue;
    }
    seenFolios.add(candidate.folio);
    if (HEIRRIGHT_EXAMPLE_FOLIOS.has(candidate.folio)) {
      summaries.push(candidateSummary(candidate, false, "Known HeirRight example folio excluded from live-source proof batches."));
      continue;
    }
    if (!filters.includeCompanyOwners && isCompanyOwner(candidate.ownerNames)) {
      summaries.push(candidateSummary(candidate, false, "Company/entity owner excluded by default workflow filter."));
      continue;
    }

    const url = detailUrl(candidate.folio);
    const detail = asRecord(await fetchJson(url, ledger, `Miami-Dade Property Appraiser detail ${candidate.folio}`, fetchImpl));
    if (!detailCompleted(detail)) {
      summaries.push(candidateSummary(candidate, false, "Property Appraiser detail response was incomplete."));
      continue;
    }

    const seed = seedFromAccepted(candidate, detail, url);
    accepted.push({ ...candidate, detail, detailUrl: url, seed });
    summaries.push({
      ...candidateSummary(candidate, true),
      ownerName: seed.ownerName,
      propertyAddress: seed.propertyAddress,
      sourceUrl: url,
    });
  }

  return { accepted, summaries };
}

function dailyConfig(filters: FreshLeadBatchResult["filters"], seeds: IntakeSeed[], startedBy: DailyRunConfig["startedBy"]): DailyRunConfig {
  return {
    counties: [filters.county],
    targetRawLeadRange: { min: 1, max: Math.max(filters.limit, 1) },
    targetQualifiedLeadRange: { min: 1, max: Math.max(filters.limit, 1) },
    seeds,
    seedSource: "external_live_source",
    seedBatch: {
      batchId: `live-miami-dade-pa-${Date.now()}`,
      sourceLabel: "Miami-Dade Property Appraiser live search",
      sourceOwner: "Miami-Dade County Property Appraiser",
      approvalMarker: "external_public_source_operator_pull",
      seedCount: seeds.length,
      acceptedSeedCount: seeds.length,
      rejectedSeedCount: 0,
      duplicateCount: 0,
      counties: [filters.county],
    },
    startedBy,
  };
}

function sourceBlockers(acceptedCount: number, dailyBlockers: string[]): string[] {
  const blockers = [...dailyBlockers];
  if (acceptedCount === 0) blockers.unshift("No live public-source candidates survived the current source filters.");
  blockers.push("Official Records probate document search remains browser/recaptcha gated; this batch only confirms Property Appraiser public-record facts.");
  return Array.from(new Set(blockers));
}

function operatorSummary(filters: FreshLeadBatchResult["filters"], acceptedCount: number, externalRecordCount: number): string {
  return `Pulled ${acceptedCount} live lead${acceptedCount === 1 ? "" : "s"} from ${externalRecordCount} Miami-Dade Property Appraiser candidate${externalRecordCount === 1 ? "" : "s"} using ${filters.searchMode} search "${filters.query}".`;
}

export async function runFreshLeadBatch(request: FreshLeadBatchRequest = {}, options: FreshLeadBatchOptions = {}): Promise<FreshLeadBatchResult> {
  const filters = normalizeFilters(request.filters);
  if (filters.county !== "miami-dade") {
    throw new Error("Live public-source pulls are currently implemented for Miami-Dade County only.");
  }
  const fetchImpl = options.fetchImpl ?? fetch;
  const sourceLedger: FreshLeadSourceLedgerEntry[] = [{
    label: "Miami-Dade Property Search public page",
    url: PROPERTY_SEARCH_PAGE,
    status: "checked",
    note: "Official public search surface used as the source owner boundary for candidate and folio detail calls.",
  }];

  const { candidates } = await searchCandidates(filters, sourceLedger, fetchImpl);
  const { accepted, summaries } = await enrichCandidates(candidates, filters, sourceLedger, fetchImpl);
  const seeds = accepted.map((candidate) => candidate.seed);
  const dailyRun = await runDailyProduction(dailyConfig(filters, seeds, request.startedBy ?? "operator_ui"), {
    env: options.env,
  });
  const leadRuns = await Promise.all(seeds.map(async (seed) => {
    const pipeline = await runDryPipeline(seed, { env: options.env });
    return {
      runId: pipeline.runId,
      seed,
      facts: pipeline.facts,
      dossier: pipeline.dossier,
    };
  }));
  const latestRun = leadRuns[0];

  return {
    ok: seeds.length > 0 && dailyRun.errorCount === 0,
    source: SOURCE,
    generatedAt: nowIso(),
    filters,
    externalRecordCount: candidates.length,
    acceptedSeedCount: seeds.length,
    rejectedCandidateCount: summaries.filter((candidate) => !candidate.accepted).length,
    seeds,
    candidates: summaries,
    leadRuns,
    dailyRun,
    latestRun,
    blockers: sourceBlockers(seeds.length, dailyRun.blockers),
    operatorSummary: operatorSummary(filters, seeds.length, candidates.length),
    sourceLedger,
  };
}

export function persistFreshLeadBatchOutputs(result: FreshLeadBatchResult): Record<string, string> {
  const freshBatchOutput = jsonOutput("fresh-lead-batch.json", result);
  const dailyRunOutput = jsonOutput("daily-run.json", result.dailyRun);
  const qualificationReviewJson = jsonOutput("qualification-review.json", result.dailyRun.qualificationReview);
  const qualificationReviewMarkdown = textOutput(
    "qualification-review.md",
    renderQualificationReviewMarkdown(result.dailyRun.qualificationReview),
    "text/markdown; charset=utf-8",
  );
  persistOutput(freshBatchOutput);
  persistOutput(dailyRunOutput);
  persistOutput(qualificationReviewJson);
  persistOutput(qualificationReviewMarkdown);

  const outputs: Record<string, string> = {
    freshLeadBatch: freshBatchOutput.path,
    dailyRun: dailyRunOutput.path,
    qualificationReviewJson: qualificationReviewJson.path,
    qualificationReviewMarkdown: qualificationReviewMarkdown.path,
  };

  if (result.latestRun) {
    const latestRunOutput = jsonOutput("latest-run.json", result.latestRun);
    const latestDossierOutput = jsonOutput("latest-dossier.json", result.latestRun.dossier);
    persistOutput(latestRunOutput);
    persistOutput(latestDossierOutput);
    outputs.latestRun = latestRunOutput.path;
    outputs.latestDossier = latestDossierOutput.path;

    if (result.latestRun.dossier.completedLeadReport) {
      const completedReportMarkdown = textOutput(
        "completed-lead-report.md",
        result.latestRun.dossier.completedLeadReport.formats.markdown,
        "text/markdown; charset=utf-8",
      );
      const completedReportHtml = textOutput(
        "completed-lead-report.html",
        result.latestRun.dossier.completedLeadReport.formats.html,
        "text/html; charset=utf-8",
      );
      persistOutput(completedReportMarkdown);
      persistOutput(completedReportHtml);
      outputs.completedReportMarkdown = completedReportMarkdown.path;
      outputs.completedReportHtml = completedReportHtml.path;
    }

    if (result.latestRun.dossier.documentPacket) {
      const summaryMarkdown = textOutput(
        "internal-summary.md",
        result.latestRun.dossier.documentPacket.formats.markdown,
        "text/markdown; charset=utf-8",
      );
      const summaryHtml = textOutput(
        "internal-summary.html",
        result.latestRun.dossier.documentPacket.formats.html,
        "text/html; charset=utf-8",
      );
      persistOutput(summaryMarkdown);
      persistOutput(summaryHtml);
      outputs.summaryMarkdown = summaryMarkdown.path;
      outputs.summaryHtml = summaryHtml.path;
    }
  }

  return outputs;
}

function cliArg(name: string, argv = process.argv): string | undefined {
  const prefix = `--${name}=`;
  const hit = argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

export function freshLeadRequestFromCli(argv = process.argv, env: RuntimeEnv = process.env): FreshLeadBatchRequest {
  const owner = cliArg("owner", argv);
  const address = cliArg("address", argv);
  const folio = cliArg("folio", argv);
  const searchMode: FreshLeadSearchMode = address ? "address" : folio ? "folio" : "owner";
  return {
    source: SOURCE,
    startedBy: "operator_cli",
    filters: {
      county: cliArg("county", argv) ?? env.COUNTY_LIST?.split(",")[0] ?? "miami-dade",
      searchMode,
      query: address ?? folio ?? owner ?? cliArg("query", argv) ?? DEFAULT_OWNER_QUERY,
      limit: clampLimit(cliArg("limit", argv) ?? env.FRESH_LEAD_LIMIT),
      includeCompanyOwners: cliArg("include-company-owners", argv) === "true",
    },
  };
}
