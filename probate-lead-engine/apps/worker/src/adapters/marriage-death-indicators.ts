import type { IntakeSeed, SourceFact } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "../lib";

const CLERK_RECORDS_URL = "https://www2.miamidadeclerk.gov/ocs/";
const missingFlags = ["MISSING_MARRIAGE_DEATH_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;
const deathCertFlags = ["MANUAL_DEATH_CERTIFICATE_REQUIRED", "MISSING_MARRIAGE_DEATH_FACT", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;

export async function fetchMarriageDeathIndicatorFacts(runId: string, seed: IntakeSeed): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const rawId = `marriage-death:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);

  return [
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "marriage_death_status",
      value: "manual_review_required",
      confidence: 0,
      sourceUrl: CLERK_RECORDS_URL,
      reviewFlags: [...missingFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:marriage-license`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "marriage_license_signal",
      value: null,
      confidence: 0,
      sourceUrl: CLERK_RECORDS_URL,
      reviewFlags: [...missingFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:dob`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "date_of_birth",
      value: null,
      confidence: 0,
      reviewFlags: [...missingFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:dod`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "date_of_death",
      value: null,
      confidence: 0,
      reviewFlags: [...missingFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:obituary`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "obituary_link",
      value: null,
      confidence: 0,
      reviewFlags: [...missingFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:obituary-snapshot`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "obituary_snapshot",
      value: null,
      confidence: 0,
      reviewFlags: ["SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:memorial-search`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "memorial_search_placeholder",
      value: [
        { provider: "findagrave", note: "Search by decedent name; record link or absent status with source ref." },
        { provider: "legacy", note: "Search Legacy.com obituaries; record link or absent status with source ref." },
        { provider: "google", note: "Record Google result placeholders only; no automated scraping." },
      ],
      confidence: 0.4,
      reviewFlags: ["SOURCE_HEALTH_ONLY", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:death-certificate`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "death_certificate_status",
      value: null,
      confidence: 0,
      reviewFlags: [...deathCertFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:incarceration`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "incarceration_status_signal",
      value: null,
      confidence: 0,
      reviewFlags: [...missingFlags],
    }),
  ];
}
