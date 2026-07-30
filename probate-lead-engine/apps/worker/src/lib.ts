import type { IntakeSeed, ReviewFlag, SourceAttachmentRef, SourceFact, SourceKey, SourceRef, SourceSubject } from "@ple/types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function seedIdentity(seed: IntakeSeed): string {
  return seed.estateName ?? seed.propertyAddress ?? seed.parcelId ?? seed.caseNumber ?? seed.ownerName ?? "unknown-seed";
}

export function normalizeEstateSearchKey(estateName: string): string {
  return slug(estateName.replace(/^estate\s+of\s+/i, "").trim());
}

export function intakeSubject(seed: IntakeSeed): SourceSubject {
  return {
    ownerName: seed.ownerName,
    estateName: seed.estateName,
    propertyAddress: seed.propertyAddress,
    parcelId: seed.parcelId,
    caseNumber: seed.caseNumber,
    county: seed.county,
  };
}

export function sourceRef(source: SourceKey, rawId: string, fetchedAt: string): SourceRef {
  return { source, rawId, fetchedAt };
}

export function fact(input: {
  runId: string;
  source: SourceKey;
  rawId: string;
  fetchedAt: string;
  county: string;
  subject: SourceSubject;
  factType: SourceFact["factType"];
  value: unknown;
  confidence: number;
  sourceUrl?: string;
  attachment?: SourceAttachmentRef;
  reviewFlags?: ReviewFlag[];
}): SourceFact {
  return {
    id: `${input.runId}:${input.source}:${slug(input.factType)}:${slug(input.rawId)}`,
    runId: input.runId,
    source: input.source,
    rawId: input.rawId,
    fetchedAt: input.fetchedAt,
    county: input.county,
    subject: input.subject,
    factType: input.factType,
    value: input.value,
    confidence: input.confidence,
    sourceUrl: input.sourceUrl,
    attachment: input.attachment,
    reviewFlags: input.reviewFlags ?? [],
  };
}

export async function fetchStatus(url: string): Promise<{ ok: boolean; status: number; finalUrl: string; bodySnippet: string; error?: string }> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent": "Solvys-HeirRight-SourceCheck/1.0",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      bodySnippet: text.replace(/\s+/g, " ").slice(0, 500),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      bodySnippet: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
