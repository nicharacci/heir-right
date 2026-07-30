import type { ContactCandidate, IntakeSeed, SourceAttachmentRef, SourceFact, SourceRef } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug, sourceRef } from "../lib";

const PRIMARY_RELATIONSHIPS = new Set(["spouse", "wife", "husband", "child", "children", "son", "daughter"]);

export interface IdiAssetImportInput {
  provider?: "idi" | string;
  mode?: string;
  paidRun?: boolean;
  paidRunApproved?: boolean;
  paidRunVerification?: string;
  approvalRecord?: unknown;
  readbackStatus?: string;
  apiKeySource?: string;
  importedText?: string;
  candidates?: Array<Partial<ContactCandidate> & Record<string, unknown>>;
  contactReviews?: Record<string, { status?: ContactCandidate["reviewStatus"] } | ContactCandidate["reviewStatus"] | undefined>;
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
  const matches = text.match(/\b\d{2,6}\s+[A-Z0-9 .#'-]+,\s*[A-Z .'-]+,\s*[A-Z]{2}\s*\d{5}\b/gi) ?? [];
  return Array.from(new Set(matches.map((item) => item.replace(/\s+/g, " ").trim())));
}

function extractAge(text: string): number | undefined {
  const value = Number(text.match(/\bage\s*[:#-]?\s*(\d{1,3})\b/i)?.[1]);
  return Number.isInteger(value) && value > 0 && value < 125 ? value : undefined;
}

function extractInterest(text: string): string | undefined {
  const labeled = text.match(
    /\b(?:interest|ownership share|heir share)\s*[:#-]\s*([^\n|;]{1,80}?)(?=\s+(?:age|likely current address|current address|address history|phone|email|relationship|review status|relative|associate|spouse|child|contact)\s*[:#-]|[\n|;]|$)/i,
  )?.[1];
  if (labeled) return labeled.replace(/\s+/g, " ").trim();
  return text.match(/\b(?:\d+\/\d+(?:st|nd|rd|th)?|\d+(?:\.\d+)?%)\s*(?:interest|share)\b/i)?.[0]?.replace(/\s+/g, " ").trim();
}

function extractAddressHistoryDetails(text: string): Array<{ address: string; county?: string; dates?: string }> {
  const output: Array<{ address: string; county?: string; dates?: string }> = [];
  const lines = text.split(/\r?\n/);
  const addressPattern = /\b\d{2,6}\s+[A-Z0-9 .#'-]+,\s*[A-Z .'-]+,\s*[A-Z]{2}\s*\d{5}\b/gi;
  const countyPattern = /\b([A-Z][A-Za-z .'-]+(?:County|Parish|Borough))\b/i;
  const datePattern = /\b(?:(?:0?[1-9]|1[0-2])\/)?(?:19|20)\d{2}\b(?:\s*[-–—]\s*(?:(?:(?:0?[1-9]|1[0-2])\/)?(?:19|20)\d{2}|present|current))?/i;
  for (let index = 0; index < lines.length; index += 1) {
    const context = `${lines[index]} ${lines[index + 1] || ""}`;
    for (const match of lines[index].matchAll(addressPattern)) {
      const address = match[0].replace(/\s+/g, " ").trim();
      const county = context.match(countyPattern)?.[1]?.replace(/\s+/g, " ").trim();
      const dates = context.match(datePattern)?.[0]?.replace(/\s+/g, " ").trim();
      if (!output.some((entry) => entry.address.toLowerCase() === address.toLowerCase() && entry.dates === dates)) {
        output.push({ address, ...(county ? { county } : {}), ...(dates ? { dates } : {}) });
      }
    }
  }
  return output;
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

function reviewStatusFrom(value: unknown): ContactCandidate["reviewStatus"] {
  return value === "accepted" || value === "rejected" || value === "promoted" ? value : "imported";
}

function candidateReviewFlags(status: ContactCandidate["reviewStatus"]): ContactCandidate["reviewFlags"] {
  return status === "accepted" || status === "promoted" ? [] : ["CONTACT_REVIEW_REQUIRED"];
}

function suppliedReviewStatus(
  candidate: Partial<ContactCandidate> & Record<string, unknown>,
  contactReviews: IdiAssetImportInput["contactReviews"] = {},
): ContactCandidate["reviewStatus"] {
  const id = String(candidate.id || "");
  const review = id ? contactReviews?.[id] : undefined;
  if (typeof review === "string") return reviewStatusFrom(review);
  if (review && typeof review === "object") return reviewStatusFrom(review.status);
  return reviewStatusFrom(candidate.reviewStatus);
}

function normalizeSuppliedCandidate(
  candidate: Partial<ContactCandidate> & Record<string, unknown>,
  index: number,
  seed: IntakeSeed,
  ref: SourceRef,
  contactReviews: IdiAssetImportInput["contactReviews"] = {},
): ContactCandidate {
  const name = String(candidate.name || `Imported contact ${index + 1}`).trim();
  const relationship = String(candidate.relationship || "relative").trim();
  const status = suppliedReviewStatus(candidate, contactReviews);
  const phones = Array.isArray(candidate.phones) ? candidate.phones.map(String).filter(Boolean) : [];
  const emails = Array.isArray(candidate.emails) ? candidate.emails.map(String).filter(Boolean) : [];
  const addressHistory = Array.isArray(candidate.addressHistory) ? candidate.addressHistory.map(String).filter(Boolean) : [];
  const addressHistoryDetails = Array.isArray(candidate.addressHistoryDetails)
    ? candidate.addressHistoryDetails.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const address = String(item.address || "").trim();
      if (!address) return [];
      const county = String(item.county || "").trim();
      const dates = String(item.dates || "").trim();
      return [{ address, ...(county ? { county } : {}), ...(dates ? { dates } : {}) }];
    })
    : [];
  const currentAddress = String(candidate.currentAddress || addressHistory[0] || "").trim();
  const group = candidate.group === "primary" || candidate.group === "alternative"
    ? candidate.group
    : candidateGroup(relationship);
  return {
    id: String(candidate.id || `${idiRunLockKey(seed)}:contact:${index + 1}`),
    name,
    relationship,
    ...(typeof candidate.age === "number" && candidate.age > 0 && candidate.age < 125 ? { age: candidate.age } : {}),
    ...(String(candidate.interest || "").trim() ? { interest: String(candidate.interest).trim() } : {}),
    group,
    phones,
    emails,
    currentAddress: currentAddress || undefined,
    addressHistory,
    ...(addressHistoryDetails.length ? { addressHistoryDetails } : {}),
    ownerLastNameMatch: typeof candidate.ownerLastNameMatch === "boolean"
      ? candidate.ownerLastNameMatch
      : ownerNameMatches(name, seed.ownerName ?? seed.estateName ?? ""),
    confidence: typeof candidate.confidence === "number"
      ? Math.max(0, Math.min(candidate.confidence > 1 ? candidate.confidence / 100 : candidate.confidence, 1))
      : group === "primary" ? 0.86 : 0.58,
    sourceRefs: [ref],
    reviewStatus: status,
    reviewFlags: candidateReviewFlags(status),
  };
}

export function parseIdiAssetSearchText(importedText: string, seed: IntakeSeed, ref: SourceRef): ContactCandidate[] {
  const blocks = importedText
    .split(/\n{2,}|(?=\n\s*(?:relative|associate|spouse|child|son|daughter)\s*[:\-])/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 8 && (/\b(phone|email|address|relative|associate|spouse|child|son|daughter)\b/i.test(block) || extractPhones(block).length || extractEmails(block).length));

  return blocks.map((block, index) => {
    const relationship = inferRelationship(block);
    const addresses = extractAddresses(block);
    const addressDetails = extractAddressHistoryDetails(block);
    const currentAddress = addresses.find((address) => /current|likely/i.test(block)) ?? addresses[0];
    const sameLastName = ownerNameMatches(inferName(block), seed.ownerName ?? seed.estateName ?? "");
    const primary = candidateGroup(relationship) === "primary";
    return {
      id: `${idiRunLockKey(seed)}:contact:${index + 1}`,
      name: inferName(block),
      relationship,
      ...(extractAge(block) ? { age: extractAge(block) } : {}),
      ...(extractInterest(block) ? { interest: extractInterest(block) } : {}),
      group: primary ? "primary" : "alternative",
      phones: extractPhones(block),
      emails: extractEmails(block),
      currentAddress,
      addressHistory: addresses,
      ...(addressDetails.length ? { addressHistoryDetails: addressDetails } : {}),
      ownerLastNameMatch: sameLastName,
      confidence: primary ? 0.86 : sameLastName ? 0.72 : 0.58,
      sourceRefs: [ref],
      reviewStatus: "imported",
      reviewFlags: candidateReviewFlags("imported"),
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
  const suppliedCandidates = Array.isArray(input.candidates)
    ? input.candidates.map((candidate, index) => normalizeSuppliedCandidate(candidate, index, seed, ref, input.contactReviews))
    : [];
  const candidates = suppliedCandidates.length ? suppliedCandidates : parseIdiAssetSearchText(input.importedText ?? "", seed, ref);
  const primaryCandidates = candidates.filter((candidate) => candidate.group === "primary");
  const alternativeCandidates = candidates.filter((candidate) => candidate.group === "alternative");
  const acceptedCandidateCount = candidates.filter((candidate) => candidate.reviewStatus === "accepted" || candidate.reviewStatus === "promoted").length;
  const approvalRecord = input.approvalRecord && typeof input.approvalRecord === "object"
    ? input.approvalRecord as Record<string, unknown>
    : null;
  const paidRunApproved = input.paidRunApproved === true && approvalRecord?.readbackStatus === "verified";

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
        contactPreviewCount: candidates.length,
        acceptedContactCount: acceptedCandidateCount,
        mode: input.mode || "operator_import",
        paidRun: Boolean(input.paidRun),
        paidRunApproved,
        paidRunVerification: input.paidRunVerification,
        approvalRecord: paidRunApproved ? approvalRecord : undefined,
        readbackStatus: input.readbackStatus,
        apiKeySource: input.apiKeySource,
      },
      confidence: candidates.length ? 0.7 : 0.35,
      sourceUrl: attachment?.sourceUrl,
      attachment,
      reviewFlags: acceptedCandidateCount
        ? ["HUMAN_REVIEW_REQUIRED"]
        : candidates.length ? ["CONTACT_REVIEW_REQUIRED"] : ["IDI_ASSET_SEARCH_REVIEW_REQUIRED", "CONTACT_REVIEW_REQUIRED"],
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
