import type {
  ContactPlaceholderEntry,
  DossierClaim,
  OfferProfitField,
  RawDossier,
  SourceKey,
  SourceRef,
} from "@ple/types";
import { clientEvidenceLabel, displayAddress } from "./completed-lead-report";

export type PacketFlow = "discovery" | "closing-docs";

export interface PacketLine {
  label?: string;
  value: string;
  tone?: "normal" | "muted" | "warning";
  contactGroup?: "confirmed-heir" | "possible-heir" | "associate";
}

export interface PacketAttachment {
  id: string;
  label: string;
  url: string;
  source: SourceKey;
  fileKind: "pdf" | "image" | "csv" | "html" | "text" | "json" | "link";
  fileName?: string;
  capturedAt?: string;
  reviewFlags: string[];
}

export interface PacketSection {
  id: string;
  title: string;
  lines: PacketLine[];
  sourceUrls: string[];
  attachments: PacketAttachment[];
}

export interface PacketEstate {
  dossierId: string;
  displayName: string;
  propertyAddress: string;
  sections: PacketSection[];
  closing?: {
    templateIds: string[];
    fields: Record<string, string>;
  };
}

export interface PacketModel {
  version: 1;
  flow: PacketFlow;
  title: string;
  generatedAt: string;
  estateIds: string[];
  estates: PacketEstate[];
  sections: Array<{ id: string; title: string; estateId: string }>;
  blockers: string[];
  closingTemplate?: {
    templateId: string;
    templateHash: string;
    version: number;
  };
}

const GENERIC_IDENTITIES = new Set([
  "selected estate",
  "owner review",
  "fresh public-source lead",
  "unknown owner",
  "sample owner",
]);

export const DISCOVERY_DOCUMENT_SECTIONS = Object.freeze({
  "discovery-dossier": Object.freeze([
    "estate-summary",
    "workflow-rules",
    "offer-profit",
    "tax-history",
    "deed-title",
    "probate-court",
    "vital-records",
    "backstory",
    "family-contacts",
    "source-review",
    "blockers-next-action",
  ]),
  "completed-report": Object.freeze(["estate-summary", "offer-profit", "vital-records", "backstory", "family-contacts"]),
  "source-notes": Object.freeze(["source-review"]),
  "deed-title-notes": Object.freeze(["deed-title"]),
  "tax-history": Object.freeze(["tax-history"]),
  "probate-request": Object.freeze(["probate-court", "vital-records"]),
  "heir-contact-matrix": Object.freeze(["family-contacts"]),
  "outreach-drafts": Object.freeze(["blockers-next-action"]),
  "drip-schedule": Object.freeze(["workflow-rules", "blockers-next-action"]),
  "crm-handoff": Object.freeze(["estate-summary", "source-review", "blockers-next-action"]),
} as const);

export type DiscoveryDocumentId = keyof typeof DISCOVERY_DOCUMENT_SECTIONS;

export const DISCOVERY_DOCUMENT_TITLES: Readonly<Record<DiscoveryDocumentId, string>> = Object.freeze({
  "discovery-dossier": "Discovery Dossier",
  "completed-report": "Completed Lead Report",
  "source-notes": "Source Notes",
  "deed-title-notes": "Deed & Title Notes",
  "tax-history": "Tax History Packet",
  "probate-request": "Probate Document Request",
  "heir-contact-matrix": "Heir Contact Matrix",
  "outreach-drafts": "Outreach Drafts",
  "drip-schedule": "Drip Schedule",
  "crm-handoff": "CRM Review",
});

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not confirmed";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "Not confirmed";
  if (Array.isArray(value)) return value.length ? value.map(valueText).join(", ") : "None confirmed";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${key.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}: ${valueText(item)}`);
    return entries.length ? entries.join("; ") : "Not confirmed";
  }
  return String(value).trim() || "Not confirmed";
}

function reviewLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reviewText(flags: string[] = []): string {
  return flags.length ? ` | review: ${flags.map(reviewLabel).join(", ")}` : "";
}

function claimLine(label: string, claim: DossierClaim<unknown>): PacketLine {
  const value = valueText(claim.value);
  const confidence = Math.round((claim.confidence || 0) * 100);
  return {
    label,
    value: `${value} | confidence ${confidence}%${reviewText(claim.reviewFlags)}`,
    tone: claim.value === null || claim.reviewFlags.length ? "warning" : "normal",
  };
}

function safeClaim<T>(claim: DossierClaim<T> | undefined): DossierClaim<T> {
  return claim ?? { value: null, confidence: 0, sourceRefs: [], reviewFlags: ["HUMAN_REVIEW_REQUIRED"] };
}

function sourceKey(ref: SourceRef): string {
  return `${ref.source}:${ref.rawId}`;
}

function sourceUrls(dossier: RawDossier, refs: SourceRef[] = []): string[] {
  const keys = new Set(refs.map(sourceKey));
  return [...new Set(dossier.audit.facts
    .filter((fact) => !keys.size || keys.has(sourceKey({ source: fact.source, rawId: fact.rawId, fetchedAt: fact.fetchedAt })))
    .map((fact) => fact.attachment?.sourceUrl || fact.sourceUrl)
    .filter((url): url is string => Boolean(url)))]
    .sort();
}

function safeEvidenceUrl(value: unknown): string {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//")) ? url : "";
}

function factLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function evidenceUrlKey(value: string): string {
  const url = safeEvidenceUrl(value);
  if (!url || url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    const params = [...parsed.searchParams.entries()]
      .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
      ));
    parsed.hash = "";
    parsed.search = "";
    for (const [key, item] of params) parsed.searchParams.append(key, item);
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

function evidenceLabel(url: string, factType: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (factType === "obituary_link") return host === "hispanicad.com" ? "HispanicAd obituary" : "Obituary";
    if (host.includes("floridapublicnotices.com")) return "Florida public probate notice";
    if (host.includes("miamidadepa.gov")) return "Miami-Dade Property Appraiser";
    if (host.includes("miamidadeclerk.gov")) return "Miami-Dade Official Records";
  } catch {
    // Relative stored artifacts keep their existing evidence label.
  }
  return factLabel(factType);
}

function evidenceAttachments(dossier: RawDossier): PacketAttachment[] {
  const byUrl = new Map<string, PacketAttachment>();
  for (const fact of dossier.audit.facts) {
    const url = safeEvidenceUrl(fact.attachment?.sourceUrl || fact.sourceUrl);
    if (!url) continue;
    const urlKey = evidenceUrlKey(url);
    const attachment = fact.attachment;
    const next: PacketAttachment = {
      id: fact.id,
      label: clientEvidenceLabel({ source: fact.source, factType: fact.factType }) || evidenceLabel(url, fact.factType),
      url,
      source: fact.source,
      fileKind: attachment?.fileKind || "link",
      ...(attachment?.fileName ? { fileName: attachment.fileName } : {}),
      ...(attachment?.capturedAt || fact.fetchedAt ? { capturedAt: attachment?.capturedAt || fact.fetchedAt } : {}),
      reviewFlags: [...new Set([...(fact.reviewFlags || []), ...(attachment?.reviewFlags || [])])],
    };
    const existing = byUrl.get(urlKey);
    const nextHasSpecificLabel = /obituar|deed|tax receipt|probate notice/i.test(next.label)
      && !/obituar|deed|tax receipt|probate notice/i.test(existing?.label || "");
    if (!existing || (existing.fileKind === "link" && next.fileKind !== "link") || nextHasSpecificLabel) byUrl.set(urlKey, next);
  }
  for (const [index, link] of (dossier.completedLeadReport?.sourceLinks || []).entries()) {
    const url = safeEvidenceUrl(link.url);
    const urlKey = evidenceUrlKey(url);
    if (!url || byUrl.has(urlKey)) continue;
    byUrl.set(urlKey, {
      id: `report-source-${index + 1}`,
      label: link.label,
      url,
      source: link.source,
      fileKind: "link",
      reviewFlags: [],
    });
  }
  return [...byUrl.values()].sort((left, right) => left.label.localeCompare(right.label));
}

function attachmentsForUrls(attachments: PacketAttachment[], urls: string[]): PacketAttachment[] {
  const accepted = new Set(urls.map(evidenceUrlKey).filter(Boolean));
  return attachments.filter((attachment) => accepted.has(evidenceUrlKey(attachment.url)));
}

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not confirmed";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function offerLine(field: OfferProfitField | undefined): PacketLine {
  if (!field) return { value: "Not confirmed", tone: "warning" };
  return {
    label: field.label,
    value: `${money(field.value)} | confidence ${Math.round(field.confidence * 100)}%${field.note ? ` | ${field.note}` : ""}`,
    tone: field.value === null || field.reviewFlags.length ? "warning" : "normal",
  };
}

function offerScalarLine(
  field: OfferProfitField | undefined,
  format: (value: number) => string,
): PacketLine {
  if (!field) return { value: "Not confirmed", tone: "warning" };
  const value = field.value === null ? "Not confirmed" : format(field.value);
  const confidence = Math.round(field.confidence * 100);
  return {
    label: field.label,
    value: `${value} | confidence ${confidence}%${field.note ? ` | ${field.note}` : ""}`,
    tone: field.value === null || field.reviewFlags.length ? "warning" : "normal",
  };
}

function contactLines(contact: ContactPlaceholderEntry, index: number): PacketLine[] {
  const identity = contact.name || `${contact.role} contact`;
  const normalizedRole = contact.role.toLowerCase().replace(/[\s-]+/g, "_");
  const contactGroup: PacketLine["contactGroup"] = /^(confirmed|legal)_heir$/.test(normalizedRole)
    ? "confirmed-heir"
    : /associate|friend|neighbor|business|coworker|colleague|roommate|caregiver/.test(normalizedRole)
      ? "associate"
      : "possible-heir";
  const addressHistory = (contact.addressHistory || []).map((item) => [
    item.address,
    item.county ? `(${item.county})` : "",
    item.dates ? `\n(${item.dates})` : "",
  ].filter(Boolean).join(" ")).join("\n");
  return [
    {
      label: `Contact ${index + 1}`,
      value: `${identity} | relationship ${contact.role}${contact.interest ? ` | interest ${contact.interest}` : ""}${contact.age ? ` | age ${contact.age}` : ""}`,
      contactGroup,
    },
    { label: "Likely Current Address", value: contact.likelyCurrentAddress || "Not confirmed", tone: contact.likelyCurrentAddress ? "normal" : "warning" },
    { label: "Address (County/Parish/Borough) History", value: addressHistory || "None confirmed", tone: addressHistory ? "normal" : "warning" },
    { label: "Phone number", value: contact.phones.length ? contact.phones.join("\n") : "None confirmed", tone: contact.phones.length ? "normal" : "warning" },
    { label: "Email Address", value: contact.emails.length ? contact.emails.join("\n") : "None confirmed", tone: contact.emails.length ? "normal" : "warning" },
    {
      label: "Review",
      value: `${contact.note}${contact.reviewFlags.length ? ` Review gate: ${contact.reviewFlags.map(reviewLabel).join(", ")}.` : ""}`,
      tone: contact.reviewFlags.length ? "warning" : "muted",
    },
  ];
}

function hypothesisContactLines(dossier: RawDossier): PacketLine[] {
  const nodes = dossier.familyTree.hypothesis.value?.nodes.filter((node) => node.name) ?? [];
  return nodes.flatMap((node, index) => {
    const relationship = node.role.replace(/_/g, " ");
    return [
      { label: `Contact ${index + 1}`, value: `${node.name} | relationship reported ${relationship}`, contactGroup: "possible-heir" },
      { label: "Likely Current Address", value: "IDI report pending", tone: "warning" },
      { label: "Address (County/Parish/Borough) History", value: "IDI report pending", tone: "warning" },
      { label: "Phone number", value: "IDI report pending", tone: "warning" },
      { label: "Email Address", value: "IDI report pending", tone: "warning" },
      {
        label: "Review",
        value: "Public-source relationship hypothesis only. IDI evidence and operator review are required before contact use or any heirship conclusion.",
        tone: "warning",
      },
    ];
  });
}

function discoverySections(dossier: RawDossier): PacketSection[] {
  const report = dossier.completedLeadReport;
  const offer = report?.offerMath;
  const sourceLinks = report?.sourceLinks ?? [];
  const allAttachments = evidenceAttachments(dossier);
  const propertyTaxLinks = sourceLinks.filter((link) => /property tax|property appraiser|parcel/i.test(link.label));
  const taxReceiptLinks = sourceLinks.filter((link) => /tax receipt|receipt copy/i.test(link.label));
  const obituaryLinks = sourceLinks.filter((link) => /obituar/i.test(link.label));
  const backstoryAttachments = allAttachments.filter((attachment) => !attachment.reviewFlags.some((flag) => (
    flag === "SOURCE_EVIDENCE_REQUIRED"
    || flag === "SOURCE_HEALTH_ONLY"
    || flag === "TAX_RECEIPT_LINK_REQUIRED"
    || flag === "VITAL_RECORDS_WORKFLOW_REQUIRED"
  )));
  const publicFamilyLines = hypothesisContactLines(dossier);
  const reviewedContacts = [...(report?.contactPlaceholders ?? [])].sort((left, right) => {
    const groupRank = (contact: ContactPlaceholderEntry): number => {
      const role = contact.role.toLowerCase().replace(/[\s-]+/g, "_");
      if (/^(confirmed|legal)_heir$/.test(role)) return 0;
      if (/associate|friend|neighbor|business|coworker|colleague|roommate|caregiver/.test(role)) return 2;
      return 1;
    };
    return groupRank(left) - groupRank(right);
  });
  const titleRefs = [
    ...dossier.deedHistory.sourceStatus.sourceRefs,
    ...dossier.deedHistory.latestDeed.sourceRefs,
    ...dossier.deedHistory.orBookPage.sourceRefs,
  ];
  const taxRefs = [
    ...dossier.taxHistory.sourceStatus.sourceRefs,
    ...safeClaim(dossier.taxHistory.receiptLink).sourceRefs,
    ...dossier.taxHistory.payerIdentity.sourceRefs,
  ];
  const probateRefs = [
    ...dossier.probateDocket.sourceStatus.sourceRefs,
    ...dossier.probateDocket.caseNumber.sourceRefs,
    ...dossier.probateDocket.affidavitOfHeirs.sourceRefs,
  ];
  const sections: PacketSection[] = [
    {
      id: "estate-summary",
      title: "Estate Summary",
      lines: [
        { label: "Estate", value: dossier.summary.estateName || dossier.summary.displayName },
        claimLine("Owner of record", dossier.property.ownerName),
        claimLine("Property", dossier.property.address),
        claimLine("Mailing address", dossier.deedHistory.mailingAddressSignal),
        claimLine("Folio / parcel", dossier.property.parcelId),
        claimLine("County", dossier.property.county),
        { label: "Dossier status", value: dossier.status },
        { label: "Next action", value: dossier.summary.nextBestAction, tone: dossier.status === "blocked" ? "warning" : "normal" },
      ],
      sourceUrls: [...new Set([...sourceUrls(dossier, [
        ...dossier.property.ownerName.sourceRefs,
        ...dossier.property.address.sourceRefs,
        ...dossier.property.parcelId.sourceRefs,
      ]), ...propertyTaxLinks.map((link) => link.url).filter((url): url is string => Boolean(url))])],
      attachments: attachmentsForUrls(allAttachments, propertyTaxLinks.map((link) => link.url).filter((url): url is string => Boolean(url))),
    },
    {
      id: "workflow-rules",
      title: "Qualification And Stop Rules",
      lines: dossier.workflow.rules.map((rule) => ({
        label: rule.label,
        value: `${rule.status}: ${rule.explanation}${rule.reasonCodes.length ? ` | ${rule.reasonCodes.join(", ")}` : ""}`,
        tone: rule.status === "continue" ? "normal" : "warning",
      })),
      sourceUrls: sourceUrls(dossier, dossier.workflow.rules.flatMap((rule) => rule.sourceRefs)),
      attachments: [],
    },
    {
      id: "offer-profit",
      title: "Offer And Profit Review",
      lines: offer ? [
        offerLine(offer.asIsValue),
        offerLine(offer.taxesDue),
        offerLine(offer.liens),
        offerLine(offer.mortgages),
        offerLine(offer.sellingCosts),
        offerLine(offer.probateCosts),
        offerLine(offer.partitionCosts),
        offerLine(offer.postEquityValue),
        offerLine(offer.equityPerHeir),
        offerScalarLine(offer.heirCount, (value) => String(value)),
        offerScalarLine(offer.buyPercentage, (value) => `${value}%`),
        offerLine(offer.offerAmount),
        offerLine(offer.profit),
        offerLine(offer.minimumNetProfit),
      ] : [{ value: "Offer math has not been confirmed from source-backed values.", tone: "warning" }],
      sourceUrls: sourceUrls(dossier, offer ? Object.values(offer).flatMap((field) => typeof field === "object" && field && "sourceRefs" in field ? field.sourceRefs : []) : []),
      attachments: [],
    },
    {
      id: "tax-history",
      title: "Tax History And Receipt",
      lines: [
        claimLine("Source status", dossier.taxHistory.sourceStatus),
        claimLine("Unpaid years", dossier.taxHistory.unpaidYears),
        claimLine("Amount due", dossier.taxHistory.amountDue),
        claimLine("Last paid by", safeClaim(dossier.taxHistory.lastPaidBy)),
        claimLine("Receipt payer", dossier.taxHistory.payerIdentity),
        claimLine("Paid date", safeClaim(dossier.taxHistory.paidDate)),
        claimLine("Reassessment", dossier.taxHistory.reassessment),
        claimLine("Receipt", safeClaim(dossier.taxHistory.receiptLink)),
        { label: "Operator task", value: dossier.taxHistory.manualReceiptTask.reason, tone: dossier.taxHistory.manualReceiptTask.required ? "warning" : "muted" },
      ],
      sourceUrls: [...new Set([...sourceUrls(dossier, taxRefs), ...(safeClaim(dossier.taxHistory.receiptLink).value ? [String(safeClaim(dossier.taxHistory.receiptLink).value)] : []), ...taxReceiptLinks.map((link) => link.url).filter((url): url is string => Boolean(url))])],
      attachments: attachmentsForUrls(allAttachments, taxReceiptLinks.map((link) => link.url).filter((url): url is string => Boolean(url))),
    },
    {
      id: "deed-title",
      title: "Deed, Title And Ownership",
      lines: [
        claimLine("Source status", dossier.deedHistory.sourceStatus),
        claimLine("Latest deed", dossier.deedHistory.latestDeed),
        claimLine("OR book / page", dossier.deedHistory.orBookPage),
        claimLine("Last sale date", dossier.deedHistory.lastSaleDate),
        claimLine("Ownership activity", dossier.deedHistory.ownershipActivity),
        claimLine("Mortgage", dossier.deedHistory.mortgageSignal),
        claimLine("Lien", dossier.deedHistory.lienSignal),
        claimLine("Lis pendens", dossier.deedHistory.lisPendensSignal),
        claimLine("Foreclosure", dossier.deedHistory.foreclosureSignal),
        claimLine("Adverse possession", dossier.deedHistory.adversePossessionSignal),
      ],
      sourceUrls: sourceUrls(dossier, titleRefs),
      attachments: [],
    },
    {
      id: "probate-court",
      title: "Probate And Court Records",
      lines: [
        claimLine("Source status", dossier.probateDocket.sourceStatus),
        claimLine("Case number", dossier.probateDocket.caseNumber),
        claimLine("Case status", dossier.probateDocket.caseStatus),
        claimLine("Civil / family docket", dossier.probateDocket.civilFamilyDocket),
        claimLine("Affidavit of heirs", dossier.probateDocket.affidavitOfHeirs),
        claimLine("Available documents", dossier.probateDocket.documentAvailability),
        claimLine("Official-record cross-links", dossier.probateDocket.officialRecordCrossLinks),
        { label: "Document request", value: dossier.probateDocket.documentRequestTask.reason, tone: dossier.probateDocket.documentRequestTask.required ? "warning" : "muted" },
      ],
      sourceUrls: sourceUrls(dossier, probateRefs),
      attachments: [],
    },
    {
      id: "vital-records",
      title: "Owner, Marriage And Vital Records",
      lines: [
        claimLine("Source status", dossier.marriageDeathIndicators.sourceStatus),
        claimLine("Date of birth", dossier.marriageDeathIndicators.dateOfBirth),
        claimLine("Date of death", dossier.marriageDeathIndicators.dateOfDeath),
        claimLine("Marriage license", dossier.marriageDeathIndicators.marriageLicense),
        claimLine("Obituary", dossier.marriageDeathIndicators.obituaryLink),
        claimLine("Death certificate", dossier.marriageDeathIndicators.deathCertificateStatus),
        claimLine("Incarceration indicator", dossier.marriageDeathIndicators.incarcerationStatus),
      ],
      sourceUrls: [...new Set([...sourceUrls(dossier, dossier.marriageDeathIndicators.sourceStatus.sourceRefs), ...(dossier.marriageDeathIndicators.obituaryLink.value ? [dossier.marriageDeathIndicators.obituaryLink.value] : []), ...obituaryLinks.map((link) => link.url).filter((url): url is string => Boolean(url))])],
      attachments: attachmentsForUrls(allAttachments, obituaryLinks.map((link) => link.url).filter((url): url is string => Boolean(url))),
    },
    {
      id: "backstory",
      title: "Back Story",
      lines: [{ value: report?.backstory || dossier.narrative || "No source-backed narrative has been assembled.", tone: report?.backstory || dossier.narrative ? "normal" : "warning" }],
      sourceUrls: sourceLinks.map((link) => link.url).filter((url): url is string => Boolean(url)),
      attachments: backstoryAttachments,
    },
    {
      id: "family-contacts",
      title: "Family Tree And Contact Review",
      lines: reviewedContacts.length
        ? reviewedContacts.flatMap(contactLines)
        : publicFamilyLines.length
          ? publicFamilyLines
          : [],
      sourceUrls: sourceUrls(dossier, dossier.familyTree.hypothesis.sourceRefs),
      attachments: [],
    },
    {
      id: "source-review",
      title: "Source Evidence And Research Checklist",
      lines: [
        ...(report?.researchChecklist.map((item) => ({
          label: item.label,
          value: `${reviewLabel(item.status)}: ${item.note}${reviewText(item.reviewFlags)}`,
          tone: item.status === "complete" || item.status === "not_applicable" ? "normal" as const : "warning" as const,
        })) ?? []),
        ...(sourceLinks.map((link) => ({ label: link.label, value: link.url || "Source reference recorded without a public URL", tone: link.url ? "normal" as const : "muted" as const }))),
      ],
      sourceUrls: sourceLinks.map((link) => link.url).filter((url): url is string => Boolean(url)),
      attachments: allAttachments,
    },
    {
      id: "blockers-next-action",
      title: "Blockers And Next Action",
      lines: [
        ...(report?.missingData.map((item) => ({ value: item, tone: "warning" as const })) ?? []),
        ...dossier.operatorQueue.items.map((item) => ({
          label: item.label,
          value: `${item.state}: ${item.reason} Next: ${item.nextAction}`,
          tone: item.state === "ready_for_review" ? "normal" as const : "warning" as const,
        })),
        { label: "Next action", value: dossier.summary.nextBestAction },
      ],
      sourceUrls: [],
      attachments: [],
    },
  ];
  return sections.map((section) => ({
    ...section,
    attachments: section.attachments.length
      ? section.attachments
      : attachmentsForUrls(allAttachments, section.sourceUrls),
  }));
}

function dossierBlockers(dossier: RawDossier): string[] {
  const identity = (dossier.summary.displayName || "").trim().toLowerCase();
  const blockers: string[] = [];
  if (!identity || GENERIC_IDENTITIES.has(identity)) blockers.push(`Dossier ${dossier.id} has a generic or missing estate identity.`);
  if (!dossier.property.address.value) blockers.push(`${dossier.summary.displayName}: property address is not confirmed.`);
  if (!dossier.property.ownerName.value) blockers.push(`${dossier.summary.displayName}: owner of record is not confirmed.`);
  if (!dossier.completedLeadReport) blockers.push(`${dossier.summary.displayName}: completed lead report is missing.`);
  const obituaryUrl = safeEvidenceUrl(dossier.marriageDeathIndicators.obituaryLink.value);
  if (!obituaryUrl) blockers.push(`${dossier.summary.displayName}: a source-verified obituary link or stored obituary artifact is required.`);
  const genericContacts = dossier.completedLeadReport?.contactPlaceholders.filter((contact) => (
    !contact.name
    || /\bplaceholder\b/i.test(contact.name)
    || /\bplaceholder\b/i.test(contact.note)
  )) ?? [];
  if (genericContacts.length) blockers.push(`${dossier.summary.displayName}: ${genericContacts.length} generic family/contact row${genericContacts.length === 1 ? " remains" : "s remain"}; review or remove them before export.`);
  return blockers;
}

export function buildDiscoveryPacketModel(dossiers: RawDossier[], generatedAt = new Date().toISOString()): PacketModel {
  if (!dossiers.length) throw new Error("At least one reviewed dossier is required.");
  const estates = dossiers.map((dossier) => ({
    dossierId: dossier.id,
    displayName: dossier.summary.estateName || dossier.property.ownerName.value || dossier.summary.displayName,
    propertyAddress: displayAddress(dossier.property.address.value),
    sections: discoverySections(dossier),
  }));
  const sections = estates.flatMap((estate) => estate.sections.map((section) => ({
    id: `${estate.dossierId}:${section.id}`,
    title: section.title,
    estateId: estate.dossierId,
  })));
  return {
    version: 1,
    flow: "discovery",
    title: dossiers.length === 1
      ? `HeirRight Discovery Packet - ${dossiers[0].summary.displayName}`
      : `HeirRight Discovery Batch - ${dossiers.length} estates`,
    generatedAt,
    estateIds: dossiers.map((dossier) => dossier.id),
    estates,
    sections,
    blockers: dossiers.flatMap(dossierBlockers),
  };
}

export function buildDiscoveryDocumentModels(model: PacketModel): Array<{
  documentId: DiscoveryDocumentId;
  title: string;
  sectionIds: string[];
  model: PacketModel;
}> {
  if (model.flow !== "discovery") return [];
  return (Object.keys(DISCOVERY_DOCUMENT_SECTIONS) as DiscoveryDocumentId[])
    .filter((documentId) => documentId !== "discovery-dossier")
    .map((documentId) => {
      const accepted = new Set<string>(DISCOVERY_DOCUMENT_SECTIONS[documentId]);
      const estates = model.estates.map((estate) => ({
        ...estate,
        sections: estate.sections.filter((section) => accepted.has(section.id)),
      }));
      const sections = estates.flatMap((estate) => estate.sections.map((section) => ({
        id: `${estate.dossierId}:${section.id}`,
        title: section.title,
        estateId: estate.dossierId,
      })));
      return {
        documentId,
        title: DISCOVERY_DOCUMENT_TITLES[documentId],
        sectionIds: [...accepted],
        model: {
          ...model,
          title: `${DISCOVERY_DOCUMENT_TITLES[documentId]} - ${model.estates.length === 1 ? model.estates[0].displayName : `${model.estates.length} estates`}`,
          estates,
          sections,
        },
      };
    });
}

export function validatePacketModel(model: PacketModel): string[] {
  const blockers = [...model.blockers];
  if (!model.estates.length) blockers.push("Packet has no estates.");
  for (const estate of model.estates) {
    if (!estate.sections.length) blockers.push(`${estate.displayName}: packet has no sections.`);
    for (const section of estate.sections) {
      if (!section.lines.length) blockers.push(`${estate.displayName}: ${section.title} has no content.`);
    }
  }
  return [...new Set(blockers)];
}
