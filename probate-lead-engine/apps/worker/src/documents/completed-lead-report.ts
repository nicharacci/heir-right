import type {
  CompletedLeadReport,
  ContactPlaceholderEntry,
  LeadBucket,
  LeadQualityProfile,
  OfferProfitField,
  OfferProfitMath,
  RawDossier,
  ReportReviewGate,
  ResearchStepChecklistItem,
  ReviewFlag,
  SourceKey,
} from "@ple/types";
import { nowIso, slug } from "../lib";
import { renderMarkdownWithStreamdown } from "../markdown/render-streamdown";
import { buildOfferProfitMath } from "../reports/offer-profit-math";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function uniqueFlags(flags: ReviewFlag[]): ReviewFlag[] {
  return Array.from(new Set(flags));
}

const DEAL_FACT_TYPES = new Set([
  "offer_as_is_value",
  "offer_heir_count",
  "offer_buy_percentage",
  "offer_minimum_net_profit",
]);

const DEAL_REVIEW_FLAGS = new Set<ReviewFlag>([
  "MISSING_OFFER_MATH_FACT",
  "UNDERWRITING_REVIEW_REQUIRED",
]);

function hasDealInput(dossier: RawDossier): boolean {
  return dossier.audit.facts.some((fact) => (
    DEAL_FACT_TYPES.has(fact.factType)
  ));
}

function filterDealReviewFlags(flags: ReviewFlag[], includeDealSection: boolean): ReviewFlag[] {
  if (includeDealSection) return flags;
  return flags.filter((flag) => !DEAL_REVIEW_FLAGS.has(flag));
}

function claimText(value: unknown, fallback = "Needs review"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) {
    const items = value
      .map((item) => claimText(item, ""))
      .filter(Boolean);
    return items.length ? items.join(", ") : fallback;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${humanStatus(key)}: ${claimText(item, "")}`);
    return entries.length ? entries.join("; ") : fallback;
  }
  return String(value);
}

function displayAddress(value: string | null | undefined): string {
  return (value ?? "Needs review").replace(/,?\s*FL\s+(\d{5})-0000\b/gi, ", FL $1");
}

function formatMoney(field: OfferProfitField): string {
  if (field.value === null) return field.note ?? "Needs review";
  return `${field.currency} ${field.value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(field: OfferProfitField): string {
  if (field.value === null) return "Needs review";
  return `${field.value}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Needs review";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US");
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return "Needs review";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
}

function humanStatus(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reviewNote(field: OfferProfitField, fallback = "Operator review required"): string {
  return field.note
    ?? field.reviewFlags.slice(0, 2).map(humanStatus).join("; ")
    ?? fallback;
}

function buildLeadBucket(dossier: RawDossier): LeadBucket {
  if (dossier.operatorQueue.state === "disqualified" || dossier.workflow.status === "stop") return "disqualified";
  if (dossier.operatorQueue.state === "manual_review" || dossier.workflow.status === "review_required") return "review_required";
  const enabledWeight = dossier.workflow.leadQuality.enabledSignals.length;
  if (enabledWeight < dossier.workflow.leadQuality.minEnabledSignalWeightForPromotion) return "generic_seed";
  if (dossier.workflow.leadQuality.reasonCodes.some((code) => code.includes("WARM") || code.includes("BONUS"))) return "bonus_warm";
  return "qualified";
}

function buildLeadQualityProfile(dossier: RawDossier): LeadQualityProfile {
  const settings = dossier.workflow.leadQuality;
  const enabledSignals = settings.signals.filter((signal) => signal.enabled).map((signal) => signal.label);
  const missingSignals = settings.signals
    .filter((signal) => signal.enabled && signal.requiresSourceEvidence)
    .filter((signal) => !settings.reasonCodes.includes(signal.reasonCode))
    .map((signal) => signal.label);
  const leadBucket = buildLeadBucket(dossier);

  return {
    model: settings.model,
    leadBucket,
    enabledSignals,
    missingSignals,
    reasonCodes: Array.from(new Set([...settings.reasonCodes, ...dossier.operatorQueue.reasonCodes])),
    promotionEligible: leadBucket === "qualified" || leadBucket === "bonus_warm",
    reviewFlags: uniqueFlags([
      ...dossier.workflow.reviewFlags,
      ...(leadBucket === "generic_seed" ? (["MISSING_LEAD_QUALITY_SIGNAL"] as ReviewFlag[]) : []),
      ...(leadBucket === "disqualified" ? (["HUMAN_REVIEW_REQUIRED"] as ReviewFlag[]) : []),
    ]),
  };
}

function buildReviewGate(dossier: RawDossier, offerReviewFlags: ReviewFlag[], includeDealSection: boolean): ReportReviewGate {
  const blocked = dossier.workflow.status === "stop"
    || dossier.operatorQueue.state === "disqualified"
    || dossier.operatorQueue.state === "blocked";
  const activeOfferReviewFlags = filterDealReviewFlags(offerReviewFlags, includeDealSection);

  return {
    reportStatus: "internal_draft",
    ...(includeDealSection
      ? { underwritingStatus: activeOfferReviewFlags.includes("MISSING_OFFER_MATH_FACT") ? "draft" as const : "pending_review" as const }
      : {}),
    documentReadiness: "draft_only",
    outreachReadiness: blocked ? "blocked" : "pending_review",
    externalUseBlocked: true,
    reviewerPlaceholder: "Assign operator reviewer before external use.",
    approvalPlaceholder: includeDealSection
      ? "Compliance/operator approval required before outreach or offers."
      : "Operator approval required before CRM handoff or external use.",
    reviewFlags: uniqueFlags([
      "REPORT_REVIEW_REQUIRED",
      "HUMAN_REVIEW_REQUIRED",
      "OUTREACH_BLOCKED",
      ...activeOfferReviewFlags,
      ...filterDealReviewFlags(dossier.audit.reviewFlags, includeDealSection),
    ]),
  };
}

function enrichedContactProfiles(dossier: RawDossier): Record<string, unknown>[] {
  return dossier.audit.facts
    .filter((item) => item.factType === "enriched_contact_profile" && item.value && typeof item.value === "object")
    .map((item) => item.value as Record<string, unknown>);
}

function profileHasContactEvidence(profile: Record<string, unknown>): boolean {
  const phones = Array.isArray(profile.phones) ? profile.phones.filter(Boolean) : [];
  const emails = Array.isArray(profile.emails) ? profile.emails.filter(Boolean) : [];
  const addressHistory = Array.isArray(profile.addressHistory) ? profile.addressHistory.filter(Boolean) : [];
  return Boolean(profile.likelyCurrentAddress) || phones.length > 0 || emails.length > 0 || addressHistory.length > 0;
}

function buildResearchChecklist(dossier: RawDossier, includeDealSection: boolean): ResearchStepChecklistItem[] {
  const familyNodeCount = dossier.familyTree.hypothesis.value?.nodes.length ?? 0;
  const contactProfiles = enrichedContactProfiles(dossier);
  const hasEnrichedContacts = contactProfiles.some(profileHasContactEvidence);
  const skipTraceFlags = uniqueFlags(dossier.audit.facts
    .filter((item) => item.factType === "skip_trace_status" || item.factType === "enriched_contact_profile")
    .flatMap((item) => item.reviewFlags));
  const contactReviewFlags = uniqueFlags([
    ...skipTraceFlags,
    ...(hasEnrichedContacts ? [] : (["NO_ENRICHMENT_RUN", "CONTACT_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"] as ReviewFlag[])),
  ]);
  const step = (input: {
    code: string;
    label: string;
    complete: boolean;
    partial: boolean;
    note: string;
    sourceRefs: ResearchStepChecklistItem["sourceRefs"];
    reviewFlags: ReviewFlag[];
  }): ResearchStepChecklistItem => ({
    code: input.code,
    label: input.label,
    status: input.complete ? "complete" : input.partial ? "partial" : "missing",
    note: input.note,
    sourceRefs: input.sourceRefs,
    reviewFlags: input.reviewFlags,
  });

  const checklist: ResearchStepChecklistItem[] = [
    step({
      code: "PROPERTY",
      label: "Property appraiser search",
      complete: dossier.property.address.value !== null && dossier.property.parcelId.value !== null,
      partial: dossier.property.address.value !== null || dossier.property.ownerName.value !== null,
      note: claimText(dossier.property.address.value, "Property address still missing."),
      sourceRefs: dossier.property.address.sourceRefs,
      reviewFlags: dossier.property.address.reviewFlags,
    }),
    step({
      code: "TAX",
      label: "Tax history review",
      complete: dossier.taxHistory.unpaidYears.value !== null && dossier.taxHistory.amountDue.value !== null,
      partial: dossier.taxHistory.sourceStatus.value !== null,
      note: claimText(dossier.taxHistory.sourceStatus.value, "Tax history requires operator capture."),
      sourceRefs: dossier.taxHistory.sourceStatus.sourceRefs,
      reviewFlags: dossier.taxHistory.reviewTasks.flatMap((task) => task.reviewFlags),
    }),
    step({
      code: "DEED",
      label: "Deed / OR book-page review",
      complete: dossier.deedHistory.latestDeed.value !== null && dossier.deedHistory.orBookPage.value !== null,
      partial: dossier.deedHistory.sourceStatus.value !== null,
      note: claimText(dossier.deedHistory.sourceStatus.value, "Deed evidence incomplete."),
      sourceRefs: dossier.deedHistory.sourceStatus.sourceRefs,
      reviewFlags: dossier.deedHistory.reviewTasks.flatMap((task) => task.reviewFlags),
    }),
    step({
      code: "PROBATE",
      label: "Probate / civil / family docket",
      complete: dossier.probateDocket.caseNumber.value !== null && dossier.probateDocket.caseStatus.value !== null,
      partial: dossier.probateDocket.sourceStatus.value !== null,
      note: claimText(dossier.probateDocket.sourceStatus.value, "Probate docket facts pending."),
      sourceRefs: dossier.probateDocket.sourceStatus.sourceRefs,
      reviewFlags: dossier.probateDocket.reviewTasks.flatMap((task) => task.reviewFlags),
    }),
    step({
      code: "MARRIAGE_DEATH",
      label: "Marriage + death indicators",
      complete: dossier.marriageDeathIndicators.dateOfDeath.value !== null || dossier.marriageDeathIndicators.obituaryLink.value !== null,
      partial: dossier.marriageDeathIndicators.sourceStatus.value !== null,
      note: claimText(dossier.marriageDeathIndicators.sourceStatus.value, "Marriage/death research incomplete."),
      sourceRefs: dossier.marriageDeathIndicators.sourceStatus.sourceRefs,
      reviewFlags: dossier.marriageDeathIndicators.reviewTasks.flatMap((task) => task.reviewFlags),
    }),
    step({
      code: "FAMILY_TREE",
      label: "Family tree hypothesis",
      complete: familyNodeCount > 0,
      partial: dossier.familyTree.sourceStatus.value !== null,
      note: `${familyNodeCount} relationship nodes recorded as hypothesis only.`,
      sourceRefs: dossier.familyTree.hypothesis.sourceRefs,
      reviewFlags: dossier.familyTree.reviewTasks.flatMap((task) => task.reviewFlags),
    }),
    step({
      code: "CONTACTS",
      label: "Verified contact enrichment",
      complete: hasEnrichedContacts,
      partial: familyNodeCount > 0 || contactProfiles.length > 0,
      note: hasEnrichedContacts
        ? `${contactProfiles.length} contact profile${contactProfiles.length === 1 ? "" : "s"} include address history, phone, email, or current-address evidence.`
        : "Contact research is blocked until approved skip-trace or manual source capture returns real people, address history, phones, or emails.",
      sourceRefs: dossier.familyTree.hypothesis.sourceRefs,
      reviewFlags: contactReviewFlags,
    }),
  ];
  if (includeDealSection) {
    checklist.push(step({
      code: "OFFER_MATH",
      label: "Offer / profit underwriting",
      complete: false,
      partial: dossier.taxHistory.amountDue.value !== null,
      note: "Offer math remains draft until operator confirms as-is value and heir count.",
      sourceRefs: dossier.taxHistory.amountDue.sourceRefs,
      reviewFlags: ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED"],
    }));
  }
  return checklist;
}

function buildContactPlaceholders(dossier: RawDossier): ContactPlaceholderEntry[] {
  const enriched = dossier.audit.facts
    .filter((item) => item.factType === "enriched_contact_profile" && item.value && typeof item.value === "object")
    .map((item) => item.value as Record<string, unknown>);

  if (enriched.length) {
    return enriched.map((profile) => {
      const addressHistory = Array.isArray(profile.addressHistory)
        ? profile.addressHistory.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const record = item as Record<string, unknown>;
          const address = claimText(record.address, "");
          if (!address) return [];
          return [{
            address: displayAddress(address),
            county: claimText(record.county, ""),
            dates: claimText(record.dates, ""),
            sourceUrl: claimText(record.sourceUrl, ""),
          }];
        })
        : [];
      const phones = Array.isArray(profile.phones) ? profile.phones.map((item) => claimText(item, "")).filter(Boolean) : [];
      const emails = Array.isArray(profile.emails) ? profile.emails.map((item) => claimText(item, "")).filter(Boolean) : [];
      const likelyCurrentAddress = displayAddress(claimText(profile.likelyCurrentAddress, addressHistory[0]?.address ?? ""));
      return {
        role: claimText(profile.role, "heir"),
        name: claimText(profile.name, undefined as unknown as string),
        age: typeof profile.age === "number" ? profile.age : undefined,
        likelyCurrentAddress,
        phones,
        emails,
        addresses: addressHistory.length ? addressHistory.map((item) => item.address) : likelyCurrentAddress ? [likelyCurrentAddress] : [],
        addressHistory,
        note: profile.profileUrl ? `Skip-trace profile: ${profile.profileUrl}` : "Skip-trace profile requires operator review before outreach.",
        reviewFlags: ["CONTACT_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      };
    });
  }

  const nodes = dossier.familyTree.hypothesis.value?.nodes ?? [];
  if (!nodes.length) {
    return [{
      role: "primary_heir",
      phones: [],
      emails: [],
      addresses: [],
      note: "No heir contact placeholders yet. Build family tree hypothesis first.",
      reviewFlags: ["NO_ENRICHMENT_RUN", "HUMAN_REVIEW_REQUIRED"],
    }];
  }

  return nodes.map((node) => ({
    role: node.role,
    name: node.name,
    phones: [],
    emails: [],
    addresses: node.contactPlaceholder ? [node.contactPlaceholder] : [],
    note: node.contactPlaceholder ?? "Contact placeholder pending enrichment or manual capture.",
    reviewFlags: uniqueFlags([...node.reviewFlags, "NO_ENRICHMENT_RUN", "HUMAN_REVIEW_REQUIRED"]),
  }));
}

function buildSourceLinks(dossier: RawDossier): Array<{ label: string; url?: string; source: SourceKey }> {
  const links = new Map<string, { label: string; url?: string; source: SourceKey }>();
  for (const fact of dossier.audit.facts) {
    if (!fact.sourceUrl) continue;
    const key = `${fact.source}:${fact.sourceUrl}`;
    if (!links.has(key)) {
      links.set(key, {
        label: `${fact.source} search`,
        url: fact.sourceUrl,
        source: fact.source,
      });
    }
  }
  for (const link of dossier.probateDocket.officialRecordCrossLinks.value ?? []) {
    if (!link.url) continue;
    links.set(link.url, { label: link.label, url: link.url, source: "official_records" });
  }
  return Array.from(links.values());
}

function buildMissingData(dossier: RawDossier, offerMath: OfferProfitMath, includeDealSection: boolean): string[] {
  const missing: string[] = [];
  if (!dossier.property.address.value) missing.push("Property address");
  if (!dossier.property.parcelId.value) missing.push("Parcel/folio");
  if (!dossier.taxHistory.amountDue.value) missing.push("Tax amount due");
  if (!dossier.deedHistory.latestDeed.value) missing.push("Latest deed record");
  if (!dossier.probateDocket.caseNumber.value) missing.push("Probate case number");
  if (!dossier.marriageDeathIndicators.dateOfDeath.value) missing.push("Date of death");
  if (!dossier.familyTree.hypothesis.value?.nodes.length) missing.push("Family tree hypothesis nodes");
  if (includeDealSection && offerMath.asIsValue.value === null) missing.push("As-is value");
  if (includeDealSection && offerMath.heirCount.value === null) missing.push("Confirmed heir count");
  return missing;
}

function buildBackstory(dossier: RawDossier): string {
  const enrichedContacts = dossier.audit.facts.filter((item) => item.factType === "enriched_contact_profile").length;
  const parts = [
    enrichedContacts
      ? `${dossier.summary.displayName} was prepared as a family-tree discovery packet from the current public-record lead run. The packet includes property identity, deed history, tax review, probate review, and ${enrichedContacts} enriched contact profile${enrichedContacts === 1 ? "" : "s"} for operator review.`
      : dossier.narrative,
    dossier.deedHistory.adversePossessionSignal.value === false
      ? "No adverse possession signal is currently recorded."
      : "Adverse possession status requires operator review.",
    dossier.taxHistory.receiptStatus.value
      ? `Tax receipt status: ${dossier.taxHistory.receiptStatus.value}.`
      : "Tax receipt status is not yet captured.",
    dossier.deedHistory.mortgageSignal.value
      ? `Mortgage signal: ${dossier.deedHistory.mortgageSignal.value}.`
      : "Mortgage balance/details require operator confirmation.",
    dossier.probateDocket.caseStatus.value
      ? `Probate case status: ${dossier.probateDocket.caseStatus.value}.`
      : "Probate case status is still open for research.",
    "Family tree and heirship notes are hypotheses only and do not constitute legal heir determinations.",
  ];
  return parts.join("\n\n");
}

function buildSummaries(dossier: RawDossier) {
  return {
    propertySummary: [
      `Address: ${claimText(dossier.property.address.value)}`,
      `Owner: ${claimText(dossier.property.ownerName.value)}`,
      `Estate: ${claimText(dossier.property.estateName.value)}`,
      `Case number: ${claimText(dossier.property.caseNumber.value)}`,
      `County: ${claimText(dossier.property.county.value, "miami-dade")}`,
      `Folio: ${claimText(dossier.property.parcelId.value)}`,
    ].join("\n"),
    taxSummary: [
      `Status: ${claimText(dossier.taxHistory.sourceStatus.value)}`,
      `Unpaid years: ${dossier.taxHistory.unpaidYears.value?.join(", ") ?? "Needs review"}`,
      `Amount due: ${dossier.taxHistory.amountDue.value ? formatMoney({ ...dossier.taxHistory.amountDue, label: "Taxes due", currency: "USD" } as OfferProfitField) : "Needs review"}`,
      `Reassessment: ${claimText(dossier.taxHistory.reassessment.value)}`,
      `Receipt status: ${claimText(dossier.taxHistory.receiptStatus.value)}`,
      `Payer identity: ${claimText(dossier.taxHistory.payerIdentity.value)}`,
    ].join("\n"),
    deedSummary: [
      `Status: ${claimText(dossier.deedHistory.sourceStatus.value)}`,
      `Latest deed: ${claimText(dossier.deedHistory.latestDeed.value)}`,
      `OR book/page: ${claimText(dossier.deedHistory.orBookPage.value)}`,
      `Last sale: ${claimText(dossier.deedHistory.lastSaleDate.value)}`,
      `Mortgage: ${claimText(dossier.deedHistory.mortgageSignal.value)}`,
      `Liens: ${claimText(dossier.deedHistory.lienSignal.value)}`,
      `Lis pendens: ${claimText(dossier.deedHistory.lisPendensSignal.value)}`,
      `Foreclosure: ${claimText(dossier.deedHistory.foreclosureSignal.value)}`,
    ].join("\n"),
    probateSummary: [
      `Status: ${claimText(dossier.probateDocket.sourceStatus.value)}`,
      `Case number: ${claimText(dossier.probateDocket.caseNumber.value)}`,
      `Case status: ${claimText(dossier.probateDocket.caseStatus.value)}`,
      `Affidavit of heirs: ${claimText(dossier.probateDocket.affidavitOfHeirs.value)}`,
      `Document availability: ${claimText(dossier.probateDocket.documentAvailability.value)}`,
    ].join("\n"),
    familyTreeSummary: [
      `Status: ${claimText(dossier.familyTree.sourceStatus.value)}`,
      `Nodes: ${dossier.familyTree.hypothesis.value?.nodes.length ?? 0}`,
      ...(dossier.familyTree.hypothesis.value?.unresolvedQuestions.map((question) => `- Open question: ${question}`) ?? []),
    ].join("\n"),
  };
}

function renderOfferTable(offerMath: OfferProfitMath): string[] {
  const rows: Array<[string, string, string, string]> = [
    ["As-is value", "", formatMoney(offerMath.asIsValue), reviewNote(offerMath.asIsValue, "Comp or appraisal input required")],
    ["Taxes due", "", formatMoney(offerMath.taxesDue), reviewNote(offerMath.taxesDue, "Tax amount due must be captured")],
    ["Liens", "", formatMoney(offerMath.liens), reviewNote(offerMath.liens, "Lien amount must be confirmed")],
    ["Mortgages", "", formatMoney(offerMath.mortgages), reviewNote(offerMath.mortgages, "Mortgage balance must be confirmed")],
    ["Selling costs", "", formatMoney(offerMath.sellingCosts), reviewNote(offerMath.sellingCosts, "Operator closing-cost assumption required")],
    ["Probate costs", "", formatMoney(offerMath.probateCosts), reviewNote(offerMath.probateCosts, "Court/admin cost estimate required")],
    ["Partition costs", "", formatMoney(offerMath.partitionCosts), reviewNote(offerMath.partitionCosts, "Litigation-cost assumption required")],
    ["Post equity value", "", formatMoney(offerMath.postEquityValue), reviewNote(offerMath.postEquityValue, "Computed after deductions are known")],
    ["Amount per heir $$", "", formatMoney(offerMath.equityPerHeir), reviewNote(offerMath.equityPerHeir, "Needs confirmed equity and heir count")],
    ["# of heirs on board", "", offerMath.heirCount.value === null ? "Needs review" : String(offerMath.heirCount.value), reviewNote(offerMath.heirCount, "Heir count is a hypothesis until reviewed")],
    ["Profit", "", formatMoney(offerMath.profit), reviewNote(offerMath.profit, "Draft only until underwriting clears")],
    ["Offer per heir", formatPercent(offerMath.buyPercentage), formatMoney(offerMath.offerAmount), reviewNote(offerMath.offerAmount, "Draft offer blocked until review")],
    ["Min profit", "", formatMoney(offerMath.minimumNetProfit), reviewNote(offerMath.minimumNetProfit, "Minimum net placeholder for operator review")],
    ["$100,000 net", "", "Benchmark", "North Star packet comparison row retained for deal review"],
  ];
  return [
    "| Description | Percentage | Total | Review note |",
    "| --- | --- | --- | --- |",
    ...rows.map(([label, percentage, total, note]) => `| ${label} | ${percentage} | ${total} | ${note} |`),
  ];
}

function renderSourceChecklist(report: {
  researchChecklist: ResearchStepChecklistItem[];
}): string[] {
  return [
    "| Source step | Status | Note |",
    "| --- | --- | --- |",
    ...report.researchChecklist.map((step) => `| ${step.label} | ${humanStatus(step.status)} | ${step.note} |`),
  ];
}

function renderContactMatrix(contacts: ContactPlaceholderEntry[]): string[] {
  if (!contacts.length) {
    return [
      "| Name | Relationship | Phone numbers | Email | Current / history address | Confidence / next action |",
      "| --- | --- | --- | --- | --- | --- |",
      "| Needs review | Heir/contact research not started | Needs approved enrichment | Needs approved enrichment | Needs approved enrichment | Build the family-tree hypothesis before outreach. |",
    ];
  }

  return [
    "| Name | Relationship | Phone numbers | Email | Current / history address | Confidence / next action |",
    "| --- | --- | --- | --- | --- | --- |",
    ...contacts.map((contact, index) => {
      const name = contact.name ?? `Potential ${humanStatus(contact.role)} ${index + 1}`;
      const phones = contact.phones.length ? contact.phones.join(", ") : "Needs approved enrichment";
      const emails = contact.emails.length ? contact.emails.join(", ") : "Needs approved enrichment";
      const addresses = contact.addresses.length ? contact.addresses.map(displayAddress).join("; ") : "Needs approved enrichment";
      return `| ${name} | ${humanStatus(contact.role)} | ${phones} | ${emails} | ${addresses} | ${contact.note} |`;
    }),
  ];
}

function renderFamilyTreePacketHtml(input: {
  dossier: RawDossier;
  contacts: ContactPlaceholderEntry[];
  offerMath: OfferProfitMath;
  backstory: string;
  researchChecklist: ResearchStepChecklistItem[];
  includeDealSection: boolean;
}): string {
  const { dossier, contacts, offerMath, backstory, includeDealSection } = input;
  const title = (dossier.summary.estateName ?? dossier.property.ownerName.value ?? dossier.summary.displayName).toUpperCase();
  const propertyAddress = displayAddress(dossier.property.address.value);
  const ownerName = claimText(dossier.property.ownerName.value ?? dossier.summary.estateName, "Needs review");
  const moneyValue = (field: OfferProfitMath["asIsValue"]) => field.value === null ? "" : formatMoney(field);
  const offerRows: Array<[string, string, string, "normal" | "blue" | "yellow"]> = [
    ["As-Is Value", "", moneyValue(offerMath.asIsValue), "normal"],
    ["Taxes Due", "", moneyValue(offerMath.taxesDue), "normal"],
    ["Liens", "", moneyValue(offerMath.liens), "normal"],
    ["Mortgages", "", moneyValue(offerMath.mortgages), "normal"],
    ["Selling Costs", "", moneyValue(offerMath.sellingCosts), "normal"],
    ["Probate Costs", "", moneyValue(offerMath.probateCosts), "normal"],
    ["Partition Costs", "", moneyValue(offerMath.partitionCosts), "normal"],
    ["Post Equity Value", "", moneyValue(offerMath.postEquityValue), "normal"],
    ["Amount per heir $$", "", moneyValue(offerMath.equityPerHeir), "normal"],
    ["# of heirs on board", "", offerMath.heirCount.value === null ? "Needs review" : String(offerMath.heirCount.value), "normal"],
    ["Profit", "", moneyValue(offerMath.profit), "normal"],
    ["Offer per heir", offerMath.offerAmount.value === null ? "" : formatPercent(offerMath.buyPercentage), moneyValue(offerMath.offerAmount), "normal"],
    ["", "", "", "normal"],
    ["", "", "", "normal"],
    ["", "", "", "normal"],
    ["Min Profit", "", moneyValue(offerMath.minimumNetProfit), "blue"],
    ["$100,000 Net", "", "", "yellow"],
    ["", "", "", "yellow"],
    ["", "", "", "yellow"],
  ];
  const sourceLink = input.dossier.completedLeadReport?.sourceLinks.find((link) => link.url)?.url ?? "#";
  const contactChecklist = input.researchChecklist.find((step) => step.code === "CONTACTS");
  const openChecklist = input.researchChecklist.filter((step) => step.status !== "complete");
  const contactBlocks = contacts.map((contact, index) => {
    const name = escapeHtml(contact.name ?? `Possible heir ${index + 1}`);
    const age = contact.age ? `<p>(${contact.age})</p>` : "";
    const history = contact.addressHistory?.length
      ? contact.addressHistory.map((item) => `<p><a href="${escapeHtml(item.sourceUrl || "#")}">${escapeHtml(displayAddress(item.address))}</a> ${item.county ? `(${escapeHtml(item.county)})` : ""}<br><span>${escapeHtml(item.dates || "Dates need review")}</span></p>`).join("")
      : `<p><a href="#">${escapeHtml(displayAddress(contact.likelyCurrentAddress ?? contact.addresses[0] ?? "Address needs approved enrichment"))}</a></p>`;
    const phones = contact.phones.length ? contact.phones.map((phone) => `<p>${escapeHtml(phone)}</p>`).join("") : "<p>Needs approved enrichment</p>";
    const emails = contact.emails.length ? contact.emails.map((email) => `<p><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>`).join("") : "<p>Needs approved enrichment</p>";
    return `<section class="person"><h3>${index + 1}. ${name}</h3>${age}<p>Likely Current Address: ${escapeHtml(displayAddress(contact.likelyCurrentAddress ?? contact.addresses[0] ?? "Needs approved enrichment"))}</p><h4>Address (County/Parish/Borough) History:</h4>${history}<h4>Phone number:</h4>${phones}<h4>Email Address:</h4>${emails}</section>`;
  }).join("");
  const packetSummaryRows: Array<[string, string]> = [
    ["Owner / estate", ownerName],
    ["Folio", claimText(dossier.property.parcelId.value)],
    ["Property", propertyAddress],
    ["Deed / OR book-page", claimText(dossier.deedHistory.orBookPage.value)],
    ["Tax review", claimText(dossier.taxHistory.sourceStatus.value)],
    ["Probate review", claimText(dossier.probateDocket.sourceStatus.value)],
    ["Contact enrichment", contactChecklist?.note ?? "Verified contact enrichment still needs review."],
  ];
  const packetSummaryTable = includeDealSection
    ? `<table class="offer">
    <tr class="bar"><th colspan="3">Offer/Profit</th></tr>
    <tr><th>Description</th><th>Percentage</th><th>Total</th></tr>
    ${offerRows.map(([label, percentage, total, tone]) => `<tr class="${tone}"><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(percentage)}</td><td>${escapeHtml(total)}</td></tr>`).join("")}
  </table>`
    : `<table class="packet-summary">
    <tr class="bar"><th colspan="2">Discovery Summary</th></tr>
    ${packetSummaryRows.map(([label, value]) => `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`).join("")}
  </table>`;
  const tableStyles = includeDealSection
    ? `table.offer, table.packet-summary { border-collapse: collapse; width: 470px; margin: 0 auto 24px; font-size: 14px; }
  .offer th, .offer td, .packet-summary th, .packet-summary td { border: 1px solid #111; height: 21px; padding: 1px 8px; text-align: center; }
  .offer .bar th { background: #43abd6; font-weight: 700; }
  .offer .blue td:first-child { background: #13a3d8; font-weight: 700; }
  .offer .yellow td:first-child { background: #ffc20a; }
  .packet-summary .bar th { background: #43abd6; font-weight: 700; }
  .packet-summary td:first-child { width: 36%; text-align: left; }
  .packet-summary td:last-child { text-align: left; }`
    : `table.packet-summary { border-collapse: collapse; width: 470px; margin: 0 auto 24px; font-size: 14px; }
  .packet-summary th, .packet-summary td { border: 1px solid #111; height: 21px; padding: 1px 8px; text-align: center; }
  .packet-summary .bar th { background: #43abd6; font-weight: 700; }
  .packet-summary td:first-child { width: 36%; text-align: left; }
  .packet-summary td:last-child { text-align: left; }`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} Family tree</title>
<style>
  @page { size: letter; margin: 0.75in; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #303030; color: #000; font-family: Arial, Helvetica, sans-serif; }
  main { width: 8.5in; min-height: 11in; margin: 24px auto; background: #fff; padding: 0.82in 0.85in; font-size: 15px; line-height: 1.45; }
  h1 { text-align: center; font-size: 30px; margin: 0 0 18px; font-weight: 500; letter-spacing: 0; }
  .subtitle { text-align: center; font-size: 30px; margin: 0 0 18px; font-weight: 700; }
  .date { text-align: center; margin-bottom: 56px; }
  .property { text-align: left; margin: 0 auto 8px; width: 470px; }
  a { color: #06e; text-decoration: underline; }
  ${tableStyles}
  .summary { width: 470px; margin: 0 auto 28px; }
  .summary p { margin: 4px 0; }
  .status { width: 470px; margin: 0 auto 28px; border-top: 1px solid #777; border-bottom: 1px solid #777; padding: 10px 0; }
  .status p { margin: 4px 0; }
  .story { margin-top: 10px; }
  .person { page-break-inside: avoid; margin-top: 28px; }
  .person h3 { margin: 0 0 4px; font-size: 16px; }
  .person h4 { margin: 24px 0 4px; font-size: 14px; }
  .person p { margin: 2px 0; }
  .toc { page-break-after: always; margin-top: 60px; }
  .toc h2 { font-size: 20px; margin-bottom: 16px; }
  .toc ol { line-height: 1.8; }
  @media print { body { background: #fff; } main { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p class="subtitle">Family tree</p>
  <p class="date">Date added: ${escapeHtml(formatShortDate(dossier.generatedAt))}</p>
  <p class="property">Property Address: <a href="${escapeHtml(sourceLink)}">${escapeHtml(propertyAddress)}</a></p>
  ${packetSummaryTable}
  <section class="summary">
    <p><strong>${escapeHtml(ownerName)}</strong></p>
    <p>DOB: ${escapeHtml(claimText(dossier.marriageDeathIndicators.dateOfBirth.value, "Needs review"))}</p>
    <p>DOD: ${escapeHtml(claimText(dossier.marriageDeathIndicators.dateOfDeath.value, "Needs review"))}</p>
    <p>Obituary ${dossier.marriageDeathIndicators.obituaryLink.value ? `<a href="${escapeHtml(dossier.marriageDeathIndicators.obituaryLink.value)}">Found</a>` : `not found - <a href="https://www.intelius.com/">Intelius</a>`}</p>
  </section>
  <section class="status">
    <p><strong>Discovery status:</strong> ${openChecklist.length ? `${openChecklist.length} open section${openChecklist.length === 1 ? "" : "s"}` : "Ready for operator review"}</p>
    <p><strong>Contact enrichment:</strong> ${escapeHtml(contactChecklist?.status ? humanStatus(contactChecklist.status) : "Needs review")} - ${escapeHtml(contactChecklist?.note ?? "Verified contact enrichment still needs review.")}</p>
  </section>
  <section class="toc">
    <h2>Table of Contents</h2>
    <ol>
      <li><a href="#back-story">Back Story</a></li>
      <li><a href="#possible-heirs">Possible heirs</a></li>
      <li><a href="#source-review">Source review</a></li>
    </ol>
  </section>
  <section id="back-story" class="story"><p><strong>Back Story:</strong> ${escapeHtml(backstory).replace(/\n\n/g, "</p><p>")}</p></section>
  <section id="possible-heirs"><h2>Possible heirs:</h2>${contactBlocks}</section>
  <section id="source-review"><h2>Source review</h2><p>This packet is generated from public-record and configured skip-trace facts. Missing contact rows remain blocked until provider credentials or approved manual source capture are available.</p><p>${escapeHtml(contactChecklist?.note ?? "Verified contact enrichment still needs review.")}</p></section>
</main>
</body>
</html>`;
}

function renderSourceLinks(sourceLinks: CompletedLeadReport["sourceLinks"]): string[] {
  if (!sourceLinks.length) return ["- No source URLs captured in this run."];
  return sourceLinks.map((link) => {
    const label = `${link.label} (${link.source})`;
    return link.url ? `- [${label}](${link.url})` : `- ${label} - URL needs review`;
  });
}

type PackageSection = {
  id: string;
  title: string;
  copy: string;
};

const packageSections: PackageSection[] = [
  { id: "property-address", title: "Property Address", copy: "Live public-record property identity." },
  { id: "lead-snapshot", title: "Lead Snapshot", copy: "Estate, owner, folio, status, and next action." },
  { id: "offer-profit", title: "Offer / Profit", copy: "North Star underwriting table and missing inputs." },
  { id: "back-story", title: "Back Story", copy: "Plain-language public-record narrative." },
  { id: "property-deed-notes", title: "Property And Deed Notes", copy: "Owner, folio, deed, sale, and title-review notes." },
  { id: "tax-notes", title: "Tax Notes", copy: "Tax status, amount, receipt, payer, and reassessment review." },
  { id: "probate-court-notes", title: "Probate And Court Notes", copy: "Court case, affidavit, and document-request status." },
  { id: "family-tree-contact-matrix", title: "Family Tree And Contact Matrix", copy: "Heir/contact rows with approval gates." },
  { id: "source-notes-review", title: "Source Notes Review", copy: "Source coverage and open review steps." },
  { id: "source-links", title: "Source Links", copy: "Clickable public-record source links." },
  { id: "missing-data", title: "Missing Data", copy: "Remaining facts needed before external use." },
  { id: "lead-quality-profile", title: "Lead Quality Profile", copy: "Lead bucket, signals, and source-quality status." },
  { id: "podio-google-handoff-prep", title: "Podio And Google Handoff Prep", copy: "CRM fields, Google Docs body, and Google Sheets row." },
  { id: "outreach-drafts-follow-up", title: "Outreach Drafts And Follow-Up", copy: "Manual call, text, email, and approval blockers." },
  { id: "review-flags", title: "Review Flags", copy: "Operator review flags that block live use." },
  { id: "next-action", title: "Next Action", copy: "The next operator step." },
];

function sectionsForPacket(includeDealSection: boolean): PackageSection[] {
  return includeDealSection
    ? packageSections
    : packageSections.filter((section) => section.id !== "offer-profit");
}

function renderPackageContents(sections: PackageSection[]): string[] {
  return [
    "## Document Package Table Of Contents",
    "Use this as the dossier navigation layer. In the PDF export, each entry jumps to the matching part of the same document; in the split package, the same section names are exported as individual PDFs.",
    "",
    "| Section | What it opens |",
    "| --- | --- |",
    ...sections.map((section) => `| [${section.title}](#${section.id}) | ${section.copy} |`),
  ];
}

function hydrateRenderedLinks(
  renderedMarkdown: string,
  sourceLinks: CompletedLeadReport["sourceLinks"],
  sections: PackageSection[],
): string {
  const linkTargets = [
    ...sections.map((section) => ({ href: `#${section.id}`, internal: true })),
    ...sourceLinks.map((link) => ({ href: link.url, internal: false })),
  ];
  let linkIndex = 0;
  const withLinks = renderedMarkdown.replace(
    /<button([^>]*data-streamdown="link"[^>]*)>(.*?)<\/button>/g,
    (_match, attrs: string, content: string) => {
      const link = linkTargets[linkIndex++];
      if (!link?.href) return `<span${attrs}>${content}</span>`;
      const externalAttrs = link.internal ? "" : ' target="_blank" rel="noreferrer noopener"';
      return `<a href="${escapeHtml(link.href)}"${externalAttrs} data-streamdown="link">${content}</a>`;
    },
  );

  return sections.reduce((html, section) => {
    const headingPattern = new RegExp(`(<h2\\b(?![^>]*\\bid=)([^>]*)>)${section.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(</h2>)`, "u");
    return html.replace(headingPattern, `<h2 id="${section.id}"$2>${section.title}$3`);
  }, withLinks);
}

function renderPodioGoogleSection(dossier: RawDossier, report: {
  leadQualityProfile: LeadQualityProfile;
  offerMath: OfferProfitMath;
  reviewGate: ReportReviewGate;
  includeDealSection: boolean;
  contactCount: number;
}): string[] {
  const crmPayload = dossier.crm.payload as { appModel?: { fields?: Record<string, unknown> }; podioReadiness?: { blockers?: string[] } } | undefined;
  const fields = crmPayload?.appModel?.fields ?? {};
  const sheetRow = report.includeDealSection ? [
    dossier.summary.estateName ?? dossier.summary.displayName,
    claimText(dossier.property.address.value),
    claimText(dossier.property.county.value),
    claimText(dossier.property.parcelId.value),
    humanStatus(report.reviewGate.reportStatus),
    humanStatus(report.leadQualityProfile.leadBucket),
    report.offerMath.heirCount.value === null ? "Needs review" : String(report.offerMath.heirCount.value),
    formatMoney(report.offerMath.offerAmount),
    dossier.summary.nextBestAction,
  ] : [
    dossier.summary.estateName ?? dossier.summary.displayName,
    claimText(dossier.property.address.value),
    claimText(dossier.property.county.value),
    claimText(dossier.property.parcelId.value),
    humanStatus(report.reviewGate.reportStatus),
    humanStatus(report.leadQualityProfile.leadBucket),
    `${report.contactCount} contact review row${report.contactCount === 1 ? "" : "s"}`,
    dossier.summary.nextBestAction,
  ];
  const sheetHeader = report.includeDealSection
    ? "| Estate | Property | County | Folio | Report | Bucket | Heirs | Offer | Next action |"
    : "| Estate | Property | County | Folio | Report | Bucket | Contacts | Next action |";
  const sheetRule = report.includeDealSection
    ? "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
    : "| --- | --- | --- | --- | --- | --- | --- | --- |";

  return [
    "## Podio And Google Handoff Prep",
    "No live Podio card, Google Doc, Google Sheet row, email, or SMS is created by this report. This section is the prepared handoff shape.",
    "",
    "Podio field map:",
    "",
    "| Field | Prepared value |",
    "| --- | --- |",
    `| Title | ${claimText(fields.title ?? dossier.summary.displayName)} |`,
    `| Estate name | ${claimText(fields.estate_name ?? dossier.summary.estateName ?? dossier.summary.displayName)} |`,
    `| Property address | ${claimText(fields.property_address ?? dossier.property.address.value)} |`,
    `| Owner name | ${claimText(fields.owner_name ?? dossier.property.ownerName.value)} |`,
    `| County | ${claimText(fields.county ?? dossier.property.county.value)} |`,
    `| Folio | ${claimText(fields.folio ?? dossier.property.parcelId.value)} |`,
    `| Dossier status | ${humanStatus(String(fields.dossier_status ?? dossier.operatorQueue.state))} |`,
    `| Lead bucket | ${humanStatus(report.leadQualityProfile.leadBucket)} |`,
    "",
    "Google Sheets row:",
    "",
    sheetHeader,
    sheetRule,
    `| ${sheetRow.join(" | ")} |`,
    "",
    "Handoff blockers:",
    ...(crmPayload?.podioReadiness?.blockers?.length
      ? crmPayload.podioReadiness.blockers.map((blocker) => `- ${blocker}`)
      : ["- Approval and readback proof are still required before live writes."]),
  ];
}

function renderOutreachSection(dossier: RawDossier, includeDealSection: boolean): string[] {
  const outreach = dossier.outreach;
  const hideDealText = (value: string) => !/offer|underwriting/i.test(value);
  const assets = includeDealSection
    ? outreach.assets
    : outreach.assets.filter((asset) => hideDealText(`${asset.title} ${asset.intendedUse}`));
  const blockers = includeDealSection
    ? outreach.readiness.blockers
    : outreach.readiness.blockers.filter(hideDealText);
  const followUpTasks = includeDealSection
    ? outreach.followUpTasks
    : outreach.followUpTasks.filter((task) => hideDealText(`${task.title} ${task.description}`));
  return [
    "## Outreach Drafts And Follow-Up",
    `Outreach status: ${humanStatus(outreach.readiness.status)}`,
    `Compliance review: ${humanStatus(outreach.complianceStatus)}`,
    `No-auto-send guard: ${outreach.noAutoSendGuard.enabled ? "Enabled" : "Missing"}`,
    "",
    "Draft assets:",
    ...(assets.length
      ? assets.map((asset) => `- ${asset.title} (${asset.status}, ${asset.language}) — ${asset.intendedUse}`)
      : ["- No discovery-only outreach assets are staged in this packet."]),
    "",
    "Readiness blockers:",
    ...(blockers.length
      ? blockers.map((blocker) => `- ${blocker}`)
      : ["- No outreach blockers recorded."]),
    "",
    "Manual follow-up tasks:",
    ...(followUpTasks.length
      ? followUpTasks.map((task) => `- ${task.title} — ${task.description}`)
      : ["- No discovery-only follow-up tasks are staged in this packet."]),
    "",
    includeDealSection
      ? "_These scripts are draft reference material only. Calls, texts, emails, letters, and offers remain manual and blocked until compliance/operator approval._"
      : "_These scripts are draft reference material only. Calls, texts, emails, and letters remain manual and blocked until compliance/operator approval._",
  ];
}

export async function generateCompletedLeadReport(dossier: RawDossier): Promise<CompletedLeadReport> {
  const offerMath = buildOfferProfitMath(dossier);
  const includeDealSection = hasDealInput(dossier);
  const leadQualityProfile = buildLeadQualityProfile(dossier);
  const reviewGate = buildReviewGate(dossier, offerMath.reviewFlags, includeDealSection);
  const researchChecklist = buildResearchChecklist(dossier, includeDealSection);
  const contactPlaceholders = buildContactPlaceholders(dossier);
  const sourceLinks = buildSourceLinks(dossier);
  const missingData = buildMissingData(dossier, offerMath, includeDealSection);
  const summaries = buildSummaries(dossier);
  const backstory = buildBackstory(dossier);
  const sections = sectionsForPacket(includeDealSection);
  const bannerCopy = includeDealSection
    ? "Internal draft — review required before outreach or offers"
    : "Internal discovery draft — review required before CRM handoff";

  const lines = [
    `# ${dossier.summary.displayName} Family-Tree Discovery Dossier`,
    "",
    includeDealSection
      ? "> **REVIEW DRAFT** - Human review required. External outreach, offers, compliance claims, Podio writes, Google Docs creation, Google Sheets insertion, email, and SMS are blocked until approval and readback proof are complete."
      : "> **DISCOVERY DRAFT** - Human review required. CRM handoff, Podio writes, Google Docs creation, Google Sheets insertion, email, and SMS are blocked until approval and readback proof are complete.",
    "",
    `Date added: ${formatDate(dossier.generatedAt)}`,
    `Report generated: ${formatDate(nowIso())}`,
    `Report status: ${humanStatus(reviewGate.reportStatus)}`,
    ...(includeDealSection ? [`Underwriting status: ${humanStatus(reviewGate.underwritingStatus ?? "not_started")}`] : []),
    `Document readiness: ${humanStatus(reviewGate.documentReadiness)}`,
    `Outreach readiness: ${humanStatus(reviewGate.outreachReadiness)}`,
    `External use blocked: ${reviewGate.externalUseBlocked ? "yes" : "no"}`,
    "",
    ...renderPackageContents(sections),
    "",
    "## Property Address",
    claimText(dossier.property.address.value),
    "",
    "## Lead Snapshot",
    "| Field | Value |",
    "| --- | --- |",
    `| Owner / estate | ${claimText(dossier.summary.estateName ?? dossier.property.ownerName.value)} |`,
    `| Owner DOB | ${claimText(dossier.marriageDeathIndicators.dateOfBirth.value)} |`,
    `| Owner DOD | ${claimText(dossier.marriageDeathIndicators.dateOfDeath.value)} |`,
    `| Obituary status | ${claimText(dossier.marriageDeathIndicators.obituaryLink.value, "Not found in the current public-source run; manual obituary search required.")} |`,
    `| County | ${claimText(dossier.property.county.value)} |`,
    `| Folio / parcel | ${claimText(dossier.property.parcelId.value)} |`,
    `| Case / file | ${claimText(dossier.property.caseNumber.value, "Needs probate/court search")} |`,
    `| Lead bucket | ${humanStatus(leadQualityProfile.leadBucket)} |`,
    `| Possible heirs / contacts | ${contactPlaceholders.length} review row${contactPlaceholders.length === 1 ? "" : "s"} |`,
    `| Next action | ${dossier.summary.nextBestAction} |`,
    "",
    ...(includeDealSection ? [
      "## Offer / Profit",
      ...renderOfferTable(offerMath),
      "",
      "_Offer math is draft-only. Unknown values stay visible until the operator confirms as-is value, tax amount due, liens, mortgages, costs, and heir count._",
      "",
    ] : []),
    "## Back Story",
    backstory,
    "",
    "## Property And Deed Notes",
    summaries.propertySummary,
    "",
    summaries.deedSummary,
    "",
    "## Tax Notes",
    summaries.taxSummary,
    "",
    "## Probate And Court Notes",
    summaries.probateSummary,
    "",
    "## Family Tree And Contact Matrix",
    summaries.familyTreeSummary,
    "",
    ...renderContactMatrix(contactPlaceholders),
    "",
    "## Source Notes Review",
    ...renderSourceChecklist({ researchChecklist }),
    "",
    "## Source Links",
    ...renderSourceLinks(sourceLinks),
    "",
    "## Missing Data",
    ...(missingData.length ? missingData.map((item) => `- ${item}`) : ["- No critical missing-data items flagged beyond review placeholders."]),
    "",
    "## Lead Quality Profile",
    `Lead bucket: ${humanStatus(leadQualityProfile.leadBucket)}`,
    `Promotion eligible: ${leadQualityProfile.promotionEligible ? "yes" : "no"}`,
    `Enabled signals: ${leadQualityProfile.enabledSignals.join(", ") || "None"}`,
    `Missing signals: ${leadQualityProfile.missingSignals.join(", ") || "None recorded"}`,
    `Reason codes: ${leadQualityProfile.reasonCodes.join(", ") || "None"}`,
    "",
    ...renderPodioGoogleSection(dossier, { leadQualityProfile, offerMath, reviewGate, includeDealSection, contactCount: contactPlaceholders.length }),
    "",
    ...renderOutreachSection(dossier, includeDealSection),
    "",
    "## Review Flags",
    ...uniqueFlags([
      ...reviewGate.reviewFlags,
      ...leadQualityProfile.reviewFlags,
      ...filterDealReviewFlags(offerMath.reviewFlags, includeDealSection),
    ]).map((flag) => `- ${humanStatus(flag)}`),
    "",
    "## Next Action",
    dossier.summary.nextBestAction,
  ];

  const markdown = lines.join("\n");
  const renderedMarkdown = hydrateRenderedLinks(await renderMarkdownWithStreamdown(markdown), sourceLinks, sections);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(dossier.summary.displayName)} Completed Lead Report</title>
<style>
  :root {
    color-scheme: light;
    --doc-bg: #fffaf0;
    --doc-ink: #1d1710;
    --doc-muted: #615746;
    --doc-line: #d7bf7b;
    --doc-accent: #8a6116;
    --doc-banner: #fff1cc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--doc-bg);
    color: var(--doc-ink);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    line-height: 1.55;
  }
  .banner {
    background: var(--doc-banner);
    border-bottom: 2px solid var(--doc-line);
    color: var(--doc-accent);
    font-weight: 800;
    padding: 12px 28px;
    text-transform: uppercase;
    letter-spacing: .04em;
  }
  main {
    max-width: 900px;
    margin: 0 auto;
    padding: 28px;
  }
  .streamdown-doc { overflow-wrap: anywhere; }
  .streamdown-doc :where(h1, h2, h3) {
    color: var(--doc-ink);
    line-height: 1.15;
    margin: 1.35em 0 .5em;
  }
  .streamdown-doc h1 {
    margin-top: 0;
    font-family: Georgia, serif;
    font-size: clamp(28px, 6vw, 42px);
  }
  .streamdown-doc h2 {
    border-top: 1px solid var(--doc-line);
    color: var(--doc-accent);
    font-size: 18px;
    padding-top: 18px;
  }
  .streamdown-doc :where(p, ul, ol, pre, table, blockquote) { margin: 0 0 12px; }
  .streamdown-doc :where(ul, ol) { padding-left: 22px; }
  .streamdown-doc li { margin-bottom: 6px; }
  .streamdown-doc table { width: 100%; border-collapse: collapse; }
  .streamdown-doc [data-streamdown="table-wrapper"] > .flex { display: none !important; }
  .streamdown-doc th, .streamdown-doc td {
    border: 1px solid var(--doc-line);
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  .streamdown-doc blockquote {
    border-left: 3px solid var(--doc-line);
    color: var(--doc-muted);
    padding-left: 12px;
  }
  .streamdown-doc a { color: var(--doc-accent); }
</style>
</head>
<body>
<div class="banner">${escapeHtml(bannerCopy)}</div>
<main>
${renderedMarkdown}
</main>
</body>
</html>`;
  const familyTreeHtml = renderFamilyTreePacketHtml({ dossier, contacts: contactPlaceholders, offerMath, backstory, researchChecklist, includeDealSection });

  return {
    id: `report-${slug(dossier.summary.displayName)}-${Date.now()}`,
    dossierId: dossier.id,
    generatedAt: nowIso(),
    reviewGate,
    backstory,
    researchChecklist,
    propertySummary: summaries.propertySummary,
    taxSummary: summaries.taxSummary,
    deedSummary: summaries.deedSummary,
    probateSummary: summaries.probateSummary,
    familyTreeSummary: summaries.familyTreeSummary,
    contactPlaceholders,
    missingData,
    sourceLinks,
    reviewFlags: uniqueFlags([
      ...reviewGate.reviewFlags,
      ...leadQualityProfile.reviewFlags,
      ...filterDealReviewFlags(offerMath.reviewFlags, includeDealSection),
      ...filterDealReviewFlags(dossier.outreach.readiness.reviewFlags, includeDealSection),
      ...dossier.outreach.noAutoSendGuard.reviewFlags,
      "REPORT_REVIEW_REQUIRED",
      "OUTREACH_BLOCKED",
    ]),
    leadQualityProfile,
    ...(includeDealSection ? { offerMath } : {}),
    formats: { markdown, html, familyTreeHtml },
  };
}
