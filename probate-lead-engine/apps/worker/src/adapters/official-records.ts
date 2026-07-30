import type { IntakeSeed, SourceFact } from "@ple/types";
import { fact, fetchStatus, intakeSubject, nowIso, seedIdentity, slug } from "../lib";
import { fetchOfficialRecordsCommercialApiFacts } from "./clerk-commercial-api";

const OFFICIAL_RECORDS_URL = "https://onlineservices.miamidadeclerk.gov/officialrecords";

type RuntimeEnv = Record<string, string | undefined>;

export async function fetchOfficialRecordFacts(runId: string, seed: IntakeSeed, env?: RuntimeEnv): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const [commercialApiFacts, status] = await Promise.all([
    fetchOfficialRecordsCommercialApiFacts(runId, seed, { env }),
    fetchStatus(OFFICIAL_RECORDS_URL),
  ]);
  const rawId = `official-records:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);

  return [
    ...commercialApiFacts,
    fact({
      runId,
      source: "official_records",
      rawId: `${rawId}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "official_records_status",
      value: {
        ok: status.ok,
        status: status.status,
        finalUrl: status.finalUrl,
        note: status.ok
          ? "Official Records is reachable. A person still needs to confirm the exact deed, title, and court-record details before this lead moves forward."
          : status.error ?? "Official Records was not reachable.",
      },
      confidence: status.ok ? 0.75 : 0.2,
      sourceUrl: status.finalUrl,
      reviewFlags: status.ok ? ["SOURCE_HEALTH_ONLY", "NO_ENRICHMENT_RUN"] : ["SOURCE_BLOCKED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "official_records",
      rawId: `${rawId}:title-signal`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "title_signal",
      value: {
        signal: "official_records_search_required",
        ownerName: seed.ownerName ?? null,
        propertyAddress: seed.propertyAddress,
      },
      confidence: 0.35,
      sourceUrl: OFFICIAL_RECORDS_URL,
      reviewFlags: ["MISSING_TITLE_FACT", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  ];
}
