import type { IntakeSeed, SourceFact } from "@ple/types";
import { fact, fetchStatus, intakeSubject, nowIso, seedIdentity, slug } from "../lib";
import { fetchCivilProbateCommercialApiFacts } from "./clerk-commercial-api";

const PROBATE_COURT_SEARCH_URL = "https://www2.miamidadeclerk.gov/ocs/";
const OFFICIAL_RECORDS_URL = "https://onlineservices.miamidadeclerk.gov/officialrecords";

type RuntimeEnv = Record<string, string | undefined>;

export async function fetchProbateCourtFacts(runId: string, seed: IntakeSeed, env?: RuntimeEnv): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const identity = slug(seedIdentity(seed));
  const rawId = `probate-court:${identity}`;
  const subject = intakeSubject(seed);
  const [commercialApiFacts, status] = await Promise.all([
    fetchCivilProbateCommercialApiFacts(runId, seed, { env }),
    fetchStatus(PROBATE_COURT_SEARCH_URL),
  ]);
  const missingProbateFlags = ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;
  const missingAffidavitFlags = ["MISSING_AFFIDAVIT_OF_HEIRS_FACT", "PROBATE_DOCUMENT_REQUEST_REQUIRED", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;

  return [
    ...commercialApiFacts,
    fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "probate_docket_status",
      value: status.ok ? "manual_or_browser_extraction_required" : "source_blocked",
      confidence: status.ok ? 0 : 0.2,
      sourceUrl: status.finalUrl || PROBATE_COURT_SEARCH_URL,
      reviewFlags: status.ok ? ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["SOURCE_BLOCKED", "MISSING_PROBATE_FACT", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:search-url`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_search_url",
      value: PROBATE_COURT_SEARCH_URL,
      confidence: 0.9,
      sourceUrl: PROBATE_COURT_SEARCH_URL,
      reviewFlags: ["SOURCE_HEALTH_ONLY", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:case-status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "probate_case_status",
      value: null,
      confidence: 0,
      sourceUrl: PROBATE_COURT_SEARCH_URL,
      reviewFlags: [...missingProbateFlags],
    }),
    fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:civil-family-docket`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "civil_family_docket_ref",
      value: null,
      confidence: 0,
      sourceUrl: PROBATE_COURT_SEARCH_URL,
      reviewFlags: [...missingProbateFlags],
    }),
    fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:affidavit-of-heirs`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "affidavit_of_heirs_status",
      value: null,
      confidence: 0,
      sourceUrl: PROBATE_COURT_SEARCH_URL,
      reviewFlags: [...missingAffidavitFlags],
    }),
    fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:document-availability`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "probate_document_availability",
      value: null,
      confidence: 0,
      sourceUrl: PROBATE_COURT_SEARCH_URL,
      reviewFlags: [...missingAffidavitFlags],
    }),
    fact({
      runId,
      source: "probate_court",
      rawId: `${rawId}:official-record-cross-link`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "official_record_cross_link",
      value: [{
        label: "Miami-Dade Official Records",
        url: OFFICIAL_RECORDS_URL,
        note: "Cross-check probate docket references against recorded instruments. Record-only facts; no legal conclusion.",
      }],
      confidence: 0.5,
      sourceUrl: OFFICIAL_RECORDS_URL,
      reviewFlags: ["SOURCE_HEALTH_ONLY", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  ];
}
