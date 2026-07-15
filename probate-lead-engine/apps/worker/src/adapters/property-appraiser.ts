import type { IntakeSeed, SourceFact } from "@ple/types";
import { fact, fetchStatus, intakeSubject, nowIso, seedIdentity, slug } from "../lib";
import { isEntityOwnerName, isTrustOrEstateOwnerName } from "../workflow/entity-owner";

const PROPERTY_SEARCH_URL = "https://www.miamidade.gov/Apps/PA/PropertySearch/#/";

function ownerTypeFromSeed(ownerName?: string): "company" | "trust_estate_review" | "individual_review" | null {
  if (!ownerName) return null;
  if (isEntityOwnerName(ownerName)) return "company";
  return isTrustOrEstateOwnerName(ownerName) ? "trust_estate_review" : "individual_review";
}

export async function fetchPropertyFacts(runId: string, seed: IntakeSeed): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const status = await fetchStatus(PROPERTY_SEARCH_URL);
  const rawId = `property-search:${slug(seedIdentity(seed))}`;
  const ownerType = ownerTypeFromSeed(seed.ownerName);
  const subject = intakeSubject(seed);

  const facts: SourceFact[] = [
    fact({
      runId,
      source: "property_appraiser",
      rawId: `${rawId}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: {
        ok: status.ok,
        status: status.status,
        finalUrl: status.finalUrl,
        note: status.ok
          ? "Miami-Dade Property Search is reachable. A person still needs to confirm the exact property details before this lead moves forward."
          : status.error ?? "Miami-Dade Property Search was not reachable.",
      },
      confidence: status.ok ? 0.8 : 0.2,
      sourceUrl: status.finalUrl,
      reviewFlags: status.ok ? ["SOURCE_HEALTH_ONLY", "NO_ENRICHMENT_RUN"] : ["SOURCE_BLOCKED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "property_appraiser",
      rawId: `${rawId}:search-url`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_search_url",
      value: PROPERTY_SEARCH_URL,
      confidence: 0.9,
      sourceUrl: PROPERTY_SEARCH_URL,
      reviewFlags: ["SOURCE_HEALTH_ONLY", "NO_ENRICHMENT_RUN"],
    }),
  ];

  if (seed.source === "external_public_source") {
    return facts;
  }

  facts.push(
    fact({
      runId,
      source: "property_appraiser",
      rawId: `${rawId}:address`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "property_address",
      value: seed.propertyAddress ?? null,
      confidence: seed.propertyAddress ? 0.7 : 0,
      sourceUrl: PROPERTY_SEARCH_URL,
      reviewFlags: seed.propertyAddress
        ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"]
        : ["MISSING_PROPERTY_FACT", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "property_appraiser",
      rawId: `${rawId}:owner`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "property_owner",
      value: seed.ownerName ?? null,
      confidence: seed.ownerName ? 0.65 : 0,
      sourceUrl: PROPERTY_SEARCH_URL,
      reviewFlags: seed.ownerName ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_OWNER_FACT", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "property_appraiser",
      rawId: `${rawId}:owner-type`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "owner_type",
      value: ownerType,
      confidence: ownerType ? 0.55 : 0,
      sourceUrl: PROPERTY_SEARCH_URL,
      reviewFlags: ownerType ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_OWNER_TYPE_FACT", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "property_appraiser",
      rawId: `${rawId}:mailing-address`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "mailing_address_signal",
      value: null,
      confidence: 0,
      sourceUrl: PROPERTY_SEARCH_URL,
      reviewFlags: ["MISSING_MAILING_ADDRESS_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "property_appraiser",
      rawId: `${rawId}:folio`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "property_folio",
      value: seed.parcelId ?? null,
      confidence: seed.parcelId ? 0.65 : 0,
      sourceUrl: PROPERTY_SEARCH_URL,
      reviewFlags: seed.parcelId ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_PROPERTY_FACT", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  );

  return facts;
}
