import type {
  ContactPlaceholderEntry,
  DossierClaim,
  OfferProfitField,
  RawDossier,
  SourceRef,
} from "@ple/types";

export type PacketFlow = "discovery" | "closing-docs";

export interface PacketLine {
  label?: string;
  value: string;
  tone?: "normal" | "muted" | "warning";
}

export interface PacketSection {
  id: string;
  title: string;
  lines: PacketLine[];
  sourceUrls: string[];
}

export interface PacketEstate {
  dossierId: string;
  displayName: string;
  propertyAddress: string;
  sections: PacketSection[];
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
}

const GENERIC_IDENTITIES = new Set([
  "selected estate",
  "owner review",
  "fresh public-source lead",
  "unknown owner",
  "sample owner",
]);

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
    .map((fact) => fact.sourceUrl)
    .filter((url): url is string => Boolean(url)))]
    .sort();
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

function contactLines(contact: ContactPlaceholderEntry, index: number): PacketLine[] {
  const identity = contact.name || `${contact.role} contact`;
  return [
    { label: `Contact ${index + 1}`, value: `${identity} | relationship ${contact.role}${contact.age ? ` | age ${contact.age}` : ""}` },
    { label: "Current address", value: contact.likelyCurrentAddress || "Not confirmed", tone: contact.likelyCurrentAddress ? "normal" : "warning" },
    { label: "Phones", value: contact.phones.length ? contact.phones.join(", ") : "None confirmed", tone: contact.phones.length ? "normal" : "warning" },
    { label: "Emails", value: contact.emails.length ? contact.emails.join(", ") : "None confirmed", tone: contact.emails.length ? "normal" : "warning" },
    { label: "Review", value: `${contact.note}${reviewText(contact.reviewFlags)}`, tone: contact.reviewFlags.length ? "warning" : "muted" },
  ];
}

function discoverySections(dossier: RawDossier): PacketSection[] {
  const report = dossier.completedLeadReport;
  const offer = report?.offerMath;
  const sourceLinks = report?.sourceLinks ?? [];
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
  return [
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
      sourceUrls: sourceUrls(dossier, [
        ...dossier.property.ownerName.sourceRefs,
        ...dossier.property.address.sourceRefs,
        ...dossier.property.parcelId.sourceRefs,
      ]),
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
        offerLine(offer.heirCount),
        offerLine(offer.equityPerHeir),
        offerLine(offer.offerAmount),
        offerLine(offer.profit),
        offerLine(offer.minimumNetProfit),
      ] : [{ value: "Offer math has not been confirmed from source-backed values.", tone: "warning" }],
      sourceUrls: sourceUrls(dossier, offer ? Object.values(offer).flatMap((field) => typeof field === "object" && field && "sourceRefs" in field ? field.sourceRefs : []) : []),
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
      sourceUrls: [...new Set([...sourceUrls(dossier, taxRefs), ...(safeClaim(dossier.taxHistory.receiptLink).value ? [String(safeClaim(dossier.taxHistory.receiptLink).value)] : [])])],
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
      sourceUrls: [...new Set([...sourceUrls(dossier, dossier.marriageDeathIndicators.sourceStatus.sourceRefs), ...(dossier.marriageDeathIndicators.obituaryLink.value ? [dossier.marriageDeathIndicators.obituaryLink.value] : [])])],
    },
    {
      id: "backstory",
      title: "Back Story",
      lines: [{ value: report?.backstory || dossier.narrative || "No source-backed narrative has been assembled.", tone: report?.backstory || dossier.narrative ? "normal" : "warning" }],
      sourceUrls: sourceLinks.map((link) => link.url).filter((url): url is string => Boolean(url)),
    },
    {
      id: "family-contacts",
      title: "Family Tree And Contact Review",
      lines: report?.contactPlaceholders.length
        ? report.contactPlaceholders.flatMap(contactLines)
        : [{ value: "No reviewed family or contact candidates are attached to this dossier.", tone: "warning" }],
      sourceUrls: sourceUrls(dossier, dossier.familyTree.hypothesis.sourceRefs),
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
    },
  ];
}

function dossierBlockers(dossier: RawDossier): string[] {
  const identity = (dossier.summary.displayName || "").trim().toLowerCase();
  const blockers: string[] = [];
  if (!identity || GENERIC_IDENTITIES.has(identity)) blockers.push(`Dossier ${dossier.id} has a generic or missing estate identity.`);
  if (!dossier.property.address.value) blockers.push(`${dossier.summary.displayName}: property address is not confirmed.`);
  if (!dossier.property.ownerName.value) blockers.push(`${dossier.summary.displayName}: owner of record is not confirmed.`);
  if (!dossier.completedLeadReport) blockers.push(`${dossier.summary.displayName}: completed lead report is missing.`);
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
    displayName: dossier.summary.displayName,
    propertyAddress: dossier.property.address.value || "Address not confirmed",
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
