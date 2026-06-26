import type { ContactCandidate, IntakeSeed, SourceAttachmentRef, SourceFact, SourceRef } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug, sourceRef } from "../lib";

const PRIMARY_RELATIONSHIPS = new Set(["spouse", "wife", "husband", "child", "children", "son", "daughter"]);

export interface IdiAssetImportInput {
  provider?: "idi" | string;
  importedText?: string;
  capturedBy?: string;
  attachment?: Partial<SourceAttachmentRef>;
  adminOverrideReason?: string;
}

export function normalizeAssetAddress(value = ""): string {
  return value
    .toLowerCase()
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(court)\b/g, "ct")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function ownerLastName(ownerName = ""): string {
  const cleaned = ownerName
    .replace(/\b(est|estate|of|the)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (cleaned.at(-1) ?? "").toLowerCase();
}

export function idiRunLockKey(seed: IntakeSeed, provider = "idi"): string {
  const address = normalizeAssetAddress(seed.propertyAddress ?? seed.estateName ?? seedIdentity(seed));
  const owner = ownerLastName(seed.ownerName ?? seed.estateName ?? "");
  return slug([provider.toLowerCase(), address, owner].filter(Boolean).join(":"));
}

function extractPhones(text: string): string[] {
  return Array.from(new Set(text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g) ?? []));
}

function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? []));
}

function extractAddresses(text: string): string[] {
  const matches = text.match(/\b\d{2,6}\s+[A-Z0-9 .'-]+,\s*[A-Z .'-]+,\s*[A-Z]{2}\s*\d{5}\b/gi) ?? [];
  return Array.from(new Set(matches.map((item) => item.replace(/\s+/g, " ").trim())));
}

function inferRelationship(block: string): string {
  const lower = block.toLowerCase();
  if (/\b(wife|husband|spouse)\b/.test(lower)) return "spouse";
  if (/\b(son|daughter|child|children)\b/.test(lower)) return /\bdaughter\b/.test(lower) ? "daughter" : /\bson\b/.test(lower) ? "son" : "child";
  if (/\b(parent|mother|father)\b/.test(lower)) return "parent";
  if (/\b(sibling|brother|sister)\b/.test(lower)) return "sibling";
  if (/\b(associate|neighbor|possible associate)\b/.test(lower)) return "associate";
  return "relative";
}

function inferName(block: string): string {
  const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const labeled = lines
    .map((line) => line.match(/(?:name|relative|associate|spouse|child|son|daughter)\s*[:\-]\s*([A-Z][A-Z .'-]{2,})/i)?.[1])
    .find(Boolean);
  if (labeled) return labeled.replace(/\s+/g, " ").trim();
  const heading = lines.find((line) => /^[0-9.)\s-]*[A-Z][A-Z .'-]{3,}$/.test(line) && !/\d{3}|\b(address|phone|email)\b/i.test(line));
  if (heading) return heading.replace(/^[0-9.)\s-]+/, "").replace(/\s+/g, " ").trim();
  return "Unnamed contact candidate";
}

function candidateGroup(relationship: string): ContactCandidate["group"] {
  return PRIMARY_RELATIONSHIPS.has(relationship.toLowerCase()) ? "primary" : "alternative";
}

function ownerNameMatches(candidateName: string, ownerName: string): boolean {
  const last = ownerLastName(ownerName);
  return Boolean(last && candidateName.toLowerCase().split(/\s+/).at(-1) === last);
}

export function parseIdiAssetSearchText(importedText: string, seed: IntakeSeed, ref: SourceRef): ContactCandidate[] {
  const blocks = importedText
    .split(/\n{2,}|(?=\n\s*(?:relative|associate|spouse|child|son|daughter)\s*[:\-])/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 8 && (/\b(phone|email|address|relative|associate|spouse|child|son|daughter)\b/i.test(block) || extractPhones(block).length || extractEmails(block).length));

  return blocks.map((block, index) => {
    const relationship = inferRelationship(block);
    const addresses = extractAddresses(block);
    const currentAddress = addresses.find((address) => /current|likely/i.test(block)) ?? addresses[0];
    const sameLastName = ownerNameMatches(inferName(block), seed.ownerName ?? seed.estateName ?? "");
    const primary = candidateGroup(relationship) === "primary";
    return {
      id: `${idiRunLockKey(seed)}:contact:${index + 1}`,
      name: inferName(block),
      relationship,
      group: primary ? "primary" : "alternative",
      phones: extractPhones(block),
      emails: extractEmails(block),
      currentAddress,
      addressHistory: addresses,
      ownerLastNameMatch: sameLastName,
      confidence: primary ? 0.86 : sameLastName ? 0.72 : 0.58,
      sourceRefs: [ref],
      reviewStatus: "imported",
      reviewFlags: ["CONTACT_REVIEW_REQUIRED"],
    };
  });
}

export function buildIdiAssetSearchFacts(runId: string, seed: IntakeSeed, input: IdiAssetImportInput): SourceFact[] {
  const fetchedAt = nowIso();
  const provider = input.provider || "idi";
  const lockKey = idiRunLockKey(seed, provider);
  const rawId = `idi-asset:${lockKey}`;
  const subject = intakeSubject(seed);
  const attachment: SourceAttachmentRef | undefined = input.attachment?.label
    ? {
      label: input.attachment.label,
      sourceUrl: input.attachment.sourceUrl,
      fileKind: input.attachment.fileKind ?? "pdf",
      fileName: input.attachment.fileName,
      capturedAt: input.attachment.capturedAt ?? fetchedAt,
      capturedBy: input.attachment.capturedBy ?? input.capturedBy,
      reviewFlags: input.attachment.reviewFlags ?? ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"],
    }
    : undefined;
  const ref = sourceRef("idi", rawId, fetchedAt);
  const candidates = parseIdiAssetSearchText(input.importedText ?? "", seed, ref);
  const primaryCandidates = candidates.filter((candidate) => candidate.group === "primary");
  const alternativeCandidates = candidates.filter((candidate) => candidate.group === "alternative");

  return [
    fact({
      runId,
      source: "idi",
      rawId,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "idi_asset_search_status",
      value: {
        status: candidates.length ? "imported_needs_review" : "imported_empty_needs_review",
        provider,
        lockKey,
        importedAt: fetchedAt,
        duplicateGuard: input.adminOverrideReason ? "admin_override_recorded" : "first_import_only",
        adminOverrideReason: input.adminOverrideReason,
      },
      confidence: candidates.length ? 0.7 : 0.35,
      sourceUrl: attachment?.sourceUrl,
      attachment,
      reviewFlags: candidates.length ? ["CONTACT_REVIEW_REQUIRED"] : ["IDI_ASSET_SEARCH_REVIEW_REQUIRED", "CONTACT_REVIEW_REQUIRED"],
    }),
    ...(attachment ? [fact({
      runId,
      source: "idi",
      rawId: `${rawId}:attachment`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "idi_asset_report_attachment",
      value: attachment,
      confidence: 0.8,
      sourceUrl: attachment.sourceUrl,
      attachment,
      reviewFlags: ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"],
    })] : []),
    ...primaryCandidates.map((candidate, index) => fact({
      runId,
      source: "idi",
      rawId: `${rawId}:primary:${index + 1}`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "primary_contact_profile",
      value: candidate,
      confidence: candidate.confidence,
      sourceUrl: attachment?.sourceUrl,
      reviewFlags: candidate.reviewFlags,
    })),
    ...alternativeCandidates.map((candidate, index) => fact({
      runId,
      source: "idi",
      rawId: `${rawId}:alternative:${index + 1}`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "alternative_contact_profile",
      value: candidate,
      confidence: candidate.confidence,
      sourceUrl: attachment?.sourceUrl,
      reviewFlags: candidate.reviewFlags,
    })),
  ];
}
