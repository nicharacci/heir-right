import type { ContactCandidate, DossierClaim, DossierEvent, DocketReference, FamilyTreeHypothesisData, LatestDeedRecord, MemorialSearchTask, OfficialRecordCrossLink, OrBookPageRef, RawDossier, ReviewFlag, SourceAttachmentRef, SourceEvidenceReviewTask, SourceFact, SourceGovernanceCatalog, SourceKey, SourceRef, TaxAmountDue } from "@ple/types";
import { nowIso, sourceRef, slug } from "../lib";
import { buildOutreachWorkflow } from "../outreach/build-outreach-workflow";
import { buildSourceCoverageProfile } from "../qa/source-coverage";
import { runSourceEvidenceQa } from "../qa/source-evidence";
import { buildOperatorQueue } from "../queue/operator-queue";
import { evaluateWorkflowRules } from "../workflow/evaluate-workflow-rules";

function refsFor(facts: SourceFact[], factType: SourceFact["factType"]): SourceRef[] {
  return facts
    .filter((item) => item.factType === factType)
    .map((item) => sourceRef(item.source, item.rawId, item.fetchedAt));
}

function valueFor<T>(facts: SourceFact[], factType: SourceFact["factType"]): T | null {
  const item = facts.find((candidate) => candidate.factType === factType && candidate.value !== null && candidate.value !== undefined);
  return item ? (item.value as T) : null;
}

const BLOCKING_SOURCE_FACT_FLAGS: ReviewFlag[] = ["SOURCE_EVIDENCE_REQUIRED", "SOURCE_HEALTH_ONLY", "SOURCE_BLOCKED"];
const DEAL_FACT_TYPES = new Set<SourceFact["factType"]>([
  "offer_as_is_value",
  "offer_heir_count",
  "offer_buy_percentage",
  "offer_minimum_net_profit",
]);

function hasDealInput(facts: SourceFact[]): boolean {
  return facts.some((fact) => DEAL_FACT_TYPES.has(fact.factType));
}

function isSourceBackedFact(fact: SourceFact): boolean {
  if (fact.value === null || fact.value === undefined || fact.value === "") return false;
  if (fact.source === "intake" || fact.source === "document_packet" || fact.source === "podio") return false;
  return !fact.reviewFlags.some((flag) => BLOCKING_SOURCE_FACT_FLAGS.includes(flag));
}

function factsForClaim(facts: SourceFact[], factType: SourceFact["factType"]): SourceFact[] {
  const related = facts.filter((item) => item.factType === factType);
  const sourceBacked = related.filter(isSourceBackedFact);
  return sourceBacked.length ? sourceBacked : related;
}

function claim<T>(facts: SourceFact[], factType: SourceFact["factType"], missing: ReviewFlag): DossierClaim<T> {
  const related = factsForClaim(facts, factType);
  const value = valueFor<T>(related, factType);
  const reviewFlags = Array.from(new Set(related.flatMap((item) => item.reviewFlags).concat(value === null ? [missing] : [])));
  return {
    value,
    confidence: related.length ? Math.max(...related.map((item) => item.confidence)) : 0,
    sourceRefs: refsFor(related, factType),
    reviewFlags,
  };
}

function optionalClaim<T>(facts: SourceFact[], factType: SourceFact["factType"]): DossierClaim<T> {
  const related = factsForClaim(facts, factType);
  const value = valueFor<T>(related, factType);
  return {
    value,
    confidence: related.length ? Math.max(...related.map((item) => item.confidence)) : 0,
    sourceRefs: refsFor(related, factType),
    reviewFlags: Array.from(new Set(related.flatMap((item) => item.reviewFlags))),
  };
}

function reviewTask(input: {
  code: string;
  title: string;
  source: SourceKey;
  reason: string;
  nextAction: string;
  claim: DossierClaim<unknown>;
  fallbackFlags?: ReviewFlag[];
}): SourceEvidenceReviewTask | null {
  if (input.claim.value !== null && input.claim.reviewFlags.length === 0) return null;
  const reviewFlags = Array.from(new Set(input.claim.reviewFlags.concat(input.fallbackFlags ?? [])));
  return {
    code: input.code,
    title: input.title,
    source: input.source,
    reason: input.reason,
    nextAction: input.nextAction,
    sourceRefs: input.claim.sourceRefs,
    reviewFlags,
  };
}

function compactTasks(tasks: Array<SourceEvidenceReviewTask | null>): SourceEvidenceReviewTask[] {
  return tasks.filter((task): task is SourceEvidenceReviewTask => task !== null);
}

function combineClaims(claims: Array<DossierClaim<unknown>>): DossierClaim<unknown> {
  const firstValue = claims.find((item) => item.value !== null)?.value ?? null;
  return {
    value: firstValue,
    confidence: claims.length ? Math.max(...claims.map((item) => item.confidence)) : 0,
    sourceRefs: Array.from(new Map(claims.flatMap((item) => item.sourceRefs).map((ref) => [`${ref.source}:${ref.rawId}:${ref.fetchedAt}`, ref])).values()),
    reviewFlags: Array.from(new Set(claims.flatMap((item) => item.reviewFlags))),
  };
}

export function buildRawDossier(runId: string, facts: SourceFact[]): RawDossier {
  const includeDealMath = hasDealInput(facts);
  const address = claim<string>(facts, "property_address", "MISSING_PROPERTY_FACT");
  const ownerName = claim<string>(facts, "property_owner", "MISSING_OWNER_FACT");
  const estateName = optionalClaim<string>(facts, "estate_name");
  const estateSearchKey = optionalClaim<string>(facts, "estate_search_key");
  const caseNumber = optionalClaim<string>(facts, "case_number");
  const county = claim<string>(facts, "property_county", "MISSING_PROPERTY_FACT");
  const parcelId = claim<string>(facts, "property_folio", "MISSING_PROPERTY_FACT");
  const taxSourceStatus = claim<string>(facts, "tax_history_status", "MISSING_TAX_HISTORY_FACT");
  const unpaidYears = claim<number[]>(facts, "unpaid_tax_years", "MISSING_TAX_HISTORY_FACT");
  const amountDue = claim<TaxAmountDue>(facts, "tax_amount_due", "MISSING_TAX_FACT");
  const reassessment = claim<string>(facts, "tax_reassessment_signal", "REASSESSMENT_REVIEW_REQUIRED");
  const receiptStatus = claim<string>(facts, "tax_receipt_status", "MISSING_TAX_RECEIPT_FACT");
  const receiptLink = claim<string>(facts, "tax_receipt_link", "TAX_RECEIPT_LINK_REQUIRED");
  const paidDate = claim<string>(facts, "tax_paid_date", "MISSING_TAX_RECEIPT_FACT");
  const payerIdentity = claim<string>(facts, "tax_payer_identity", "MISSING_TAX_PAYER_FACT");
  const receiptAttachment = claim<SourceAttachmentRef>(facts, "tax_receipt_attachment", "SOURCE_ATTACHMENT_REQUIRED");
  const lastPaidBy = claim<string>(facts, "tax_last_paid_by", "MISSING_TAX_PAYER_FACT");
  const taxHistory = {
    sourceStatus: taxSourceStatus,
    unpaidYears,
    amountDue,
    reassessment,
    receiptStatus,
    receiptLink,
    paidDate,
    payerIdentity,
    receiptAttachment,
    lastPaidBy,
    reviewTasks: compactTasks([
      reviewTask({
        code: "TAX_UNPAID_YEARS",
        title: "Confirm unpaid tax years",
        source: "tax_collector",
        reason: "The workflow needs 2+ years unpaid-tax evidence before this can count as a tax-friction signal.",
        nextAction: "Open Miami-Dade tax records and capture unpaid years or mark the signal absent.",
        claim: unpaidYears,
        fallbackFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TAX_AMOUNT_DUE",
        title: "Capture tax amount due",
        source: "tax_collector",
        reason: includeDealMath
          ? "Offer math and lead-quality review need the unpaid-tax amount from the Tax Collector record."
          : "Lead-quality review needs the unpaid-tax amount from the Tax Collector record.",
        nextAction: "Record amount due, currency, and tax years from the source record.",
        claim: amountDue,
        fallbackFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TAX_REASSESSMENT",
        title: "Review reassessment signal",
        source: "tax_collector",
        reason: "Reassessment changes can affect equity and urgency, but extraction is not validated yet.",
        nextAction: "Check the public tax record for reassessment changes and preserve the source reference.",
        claim: reassessment,
        fallbackFlags: ["REASSESSMENT_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TAX_RECEIPT_STATUS",
        title: "Capture tax receipt status",
        source: "tax_collector",
        reason: "The workflow needs the tax receipt status and the receipt artifact before payer identity can be trusted.",
        nextAction: "Open the Tax Collector listing page and use the receipt link in the bottom-right corner, then record the status or source blocker.",
        claim: receiptStatus,
        fallbackFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TAX_RECEIPT_LINK",
        title: "Capture listing-page receipt link",
        source: "tax_collector",
        reason: "The receipt link is available from the Tax Collector listing page and should be saved as evidence before any manual override.",
        nextAction: "Use the bottom-right receipt link on the listing page; if it is not present, save a source blocker and screenshot.",
        claim: receiptLink,
        fallbackFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TAX_PAID_DATE",
        title: "Capture tax paid date",
        source: "tax_collector",
        reason: "Paid date helps confirm whether taxes were handled by an heir, the estate, or another party.",
        nextAction: "Record the paid date from the receipt or mark it unavailable after checking the receipt artifact.",
        claim: paidDate,
        fallbackFlags: ["MISSING_TAX_RECEIPT_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TAX_PAYER_IDENTITY",
        title: "Confirm tax payer identity",
        source: "tax_collector",
        reason: "The workflow uses payer identity to spot heir/operator activity and possible third-party friction.",
        nextAction: "Record who paid taxes from the public record or keep the field review-required.",
        claim: combineClaims([payerIdentity, lastPaidBy]),
        fallbackFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TAX_RECEIPT_ATTACHMENT",
        title: "Attach last paid tax receipt",
        source: "tax_collector",
        reason: "The last paid receipt anchors the paid-by party and keeps tax history auditable.",
        nextAction: "Attach or link the receipt found from the Tax Collector listing page and record the paid-by party shown on it.",
        claim: receiptAttachment,
        fallbackFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
    ]),
    manualReceiptTask: {
      required: receiptLink.value === null || receiptAttachment.value === null,
      reason: receiptLink.value === null
        ? "Tax Collector listing-page receipt link has not been captured yet. Manual override is allowed only after that source path is attempted or blocked."
        : "Receipt link is captured; attach or review the receipt artifact before closing tax history.",
      sourceRefs: Array.from(new Map(
        [...refsFor(facts, "tax_receipt_status"), ...refsFor(facts, "tax_receipt_link"), ...refsFor(facts, "tax_receipt_attachment")]
          .map((ref) => [`${ref.source}:${ref.rawId}:${ref.fetchedAt}`, ref]),
      ).values()),
      reviewFlags: receiptLink.value === null
        ? ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED"] as ReviewFlag[]
        : ["SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED"] as ReviewFlag[],
    },
  };
  const deedSourceStatus = claim<string>(facts, "deed_history_status", "MISSING_DEED_FACT");
  const latestDeed = claim<LatestDeedRecord>(facts, "latest_deed", "MISSING_DEED_FACT");
  const orBookPage = claim<OrBookPageRef>(facts, "or_book_page", "MISSING_OR_BOOK_PAGE_FACT");
  const deedAttachment = claim<SourceAttachmentRef>(facts, "deed_attachment", "SOURCE_ATTACHMENT_REQUIRED");
  const lastSaleDate = claim<string>(facts, "last_sale_date", "MISSING_RECENT_SALE_FACT");
  const mailingAddressSignal = claim<string>(facts, "mailing_address_signal", "MISSING_MAILING_ADDRESS_FACT");
  const ownershipActivity = claim<string>(facts, "ownership_activity_note", "MISSING_DEED_FACT");
  const mortgageSignal = claim<string>(facts, "mortgage_signal", "MISSING_TITLE_FACT");
  const lienSignal = claim<string>(facts, "lien_signal", "MISSING_TITLE_FACT");
  const lisPendensSignal = claim<string>(facts, "lis_pendens_signal", "MISSING_TITLE_FACT");
  const foreclosureSignal = claim<string>(facts, "foreclosure_signal", "MISSING_TITLE_FACT");
  const adversePossessionSignal = claim<boolean>(facts, "adverse_possession_signal", "MISSING_ADVERSE_POSSESSION_FACT");
  const deedHistory = {
    sourceStatus: deedSourceStatus,
    latestDeed,
    orBookPage,
    deedAttachment,
    lastSaleDate,
    mailingAddressSignal,
    ownershipActivity,
    mortgageSignal,
    lienSignal,
    lisPendensSignal,
    foreclosureSignal,
    adversePossessionSignal,
    reviewTasks: compactTasks([
      reviewTask({
        code: "DEED_LATEST",
        title: "Capture latest recorded deed",
        source: "official_records",
        reason: "The latest deed anchors ownership activity and the recent-sale guard.",
        nextAction: "Record document type, recording date, grantor/grantee, and source link.",
        claim: latestDeed,
        fallbackFlags: ["MISSING_DEED_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "DEED_OR_BOOK_PAGE",
        title: "Capture OR book/page or instrument number",
        source: "official_records",
        reason: "HeirRight needs OR book/page evidence to tie title claims to public records.",
        nextAction: "Record OR book/page or instrument number from Official Records.",
        claim: orBookPage,
        fallbackFlags: ["MISSING_OR_BOOK_PAGE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "DEED_ATTACHMENT",
        title: "Attach recorded deed file",
        source: "official_records",
        reason: "The deed PDF/link must travel with the dossier so the operator can validate ownership without re-searching.",
        nextAction: "Attach the latest deed PDF or source link from Official Records and keep OR book/page or instrument visible.",
        claim: deedAttachment,
        fallbackFlags: ["MISSING_DEED_FACT", "SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "DEED_LAST_SALE",
        title: "Confirm last sale date",
        source: "official_records",
        reason: "A sale inside 5 years is a stop condition unless a human operator overrides it.",
        nextAction: "Capture the last sale date or mark it unknown with the source checked.",
        claim: lastSaleDate,
        fallbackFlags: ["MISSING_RECENT_SALE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "MAILING_ADDRESS_CHECK",
        title: "Check mailing addresses",
        source: "property_appraiser",
        reason: "The workflow asks operators to check mailing addresses associated with the property before promotion.",
        nextAction: "Capture mailing address matches, mismatches, or missing source evidence from the county property record.",
        claim: mailingAddressSignal,
        fallbackFlags: ["MISSING_MAILING_ADDRESS_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "DEED_OWNERSHIP_ACTIVITY",
        title: "Review ownership activity",
        source: "official_records",
        reason: "Ownership changes, mailing-address changes, and recorded activity influence lead qualification.",
        nextAction: "Summarize relevant ownership activity and preserve source references.",
        claim: ownershipActivity,
        fallbackFlags: ["MISSING_DEED_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "TITLE_FRICTION",
        title: "Check mortgage, lien, Lis Pendens, and foreclosure signals",
        source: "official_records",
        reason: includeDealMath
          ? "Title-friction signals affect both lead quality and offer math."
          : "Title-friction signals affect lead quality and document-prep routing.",
        nextAction: "Record each signal as present, absent, or still blocked by extraction limits.",
        claim: combineClaims([mortgageSignal, lienSignal, lisPendensSignal, foreclosureSignal]),
        fallbackFlags: ["MISSING_TITLE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "ADVERSE_POSSESSION",
        title: "Check adverse-possession signal",
        source: "official_records",
        reason: "Adverse possession requires human review before downstream action.",
        nextAction: "Confirm whether any adverse-possession signal appears in Official Records.",
        claim: adversePossessionSignal,
        fallbackFlags: ["MISSING_ADVERSE_POSSESSION_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
    ]),
  };
  const probateSourceStatus = claim<string>(facts, "probate_docket_status", "MISSING_PROBATE_FACT");
  const probateCaseNumber = claim<string>(facts, "case_number", "MISSING_PROBATE_FACT");
  const probateCaseStatus = claim<string>(facts, "probate_case_status", "MISSING_PROBATE_FACT");
  const civilFamilyDocket = claim<DocketReference>(facts, "civil_family_docket_ref", "MISSING_PROBATE_FACT");
  const affidavitOfHeirs = claim<string>(facts, "affidavit_of_heirs_status", "MISSING_AFFIDAVIT_OF_HEIRS_FACT");
  const documentAvailability = claim<string>(facts, "probate_document_availability", "MISSING_PROBATE_FACT");
  const officialRecordCrossLinks = claim<OfficialRecordCrossLink[]>(facts, "official_record_cross_link", "MISSING_PROBATE_FACT");
  const probateDocket = {
    sourceStatus: probateSourceStatus,
    caseNumber: probateCaseNumber,
    caseStatus: probateCaseStatus,
    civilFamilyDocket,
    affidavitOfHeirs,
    documentAvailability,
    officialRecordCrossLinks,
    reviewTasks: compactTasks([
      reviewTask({
        code: "PROBATE_CASE_NUMBER",
        title: "Confirm probate case number",
        source: "probate_court",
        reason: "Court docket research needs a case number or a visible review flag when it is still unknown.",
        nextAction: "Search probate/civil/family dockets by estate name and record the case number with a source reference.",
        claim: probateCaseNumber,
        fallbackFlags: ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "PROBATE_CASE_STATUS",
        title: "Capture probate case status",
        source: "probate_court",
        reason: "Case status must be recorded as a docket fact, not a legal conclusion about heirship or outcome.",
        nextAction: "Record open/closed/pending status from the public docket with source refs.",
        claim: probateCaseStatus,
        fallbackFlags: ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "CIVIL_FAMILY_DOCKET",
        title: "Capture civil/family docket references",
        source: "probate_court",
        reason: "Related civil or family docket references may affect research routing.",
        nextAction: "Record court, division, docket number, and case type when found.",
        claim: civilFamilyDocket,
        fallbackFlags: ["MISSING_PROBATE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "AFFIDAVIT_OF_HEIRS",
        title: "Check affidavit of heirs availability",
        source: "probate_court",
        reason: "Affidavit availability is a document fact, not proof of heirship.",
        nextAction: "Record whether the affidavit is available, requested, or still missing.",
        claim: affidavitOfHeirs,
        fallbackFlags: ["MISSING_AFFIDAVIT_OF_HEIRS_FACT", "PROBATE_DOCUMENT_REQUEST_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "PROBATE_DOCUMENTS",
        title: "Review probate document availability",
        source: "probate_court",
        reason: "Missing court documents must become explicit operator tasks.",
        nextAction: "List available/missing probate documents and create a document request task when needed.",
        claim: documentAvailability,
        fallbackFlags: ["PROBATE_DOCUMENT_REQUEST_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
      reviewTask({
        code: "PROBATE_OR_CROSS_LINK",
        title: "Cross-link official records",
        source: "official_records",
        reason: "Probate docket facts should cross-link to recorded instruments when possible.",
        nextAction: "Attach OR book/page or instrument references that support the docket research trail.",
        claim: officialRecordCrossLinks,
        fallbackFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      }),
    ]),
    documentRequestTask: {
      required: affidavitOfHeirs.value === null || documentAvailability.value === null,
      reason: "Affidavit of heirs or other probate documents are not yet captured; keep document requests as operator tasks.",
      sourceRefs: Array.from(new Map(
        [...affidavitOfHeirs.sourceRefs, ...documentAvailability.sourceRefs]
          .map((ref) => [`${ref.source}:${ref.rawId}:${ref.fetchedAt}`, ref]),
      ).values()),
      reviewFlags: ["PROBATE_DOCUMENT_REQUEST_REQUIRED", "HUMAN_REVIEW_REQUIRED"] as ReviewFlag[],
    },
  };
  const marriageDeathSourceStatus = claim<string>(facts, "marriage_death_status", "MISSING_MARRIAGE_DEATH_FACT");
  const marriageLicense = claim<string>(facts, "marriage_license_signal", "MISSING_MARRIAGE_DEATH_FACT");
  const dateOfBirth = claim<string>(facts, "date_of_birth", "MISSING_MARRIAGE_DEATH_FACT");
  const dateOfDeath = claim<string>(facts, "date_of_death", "MISSING_MARRIAGE_DEATH_FACT");
  const obituaryLink = claim<string>(facts, "obituary_link", "MISSING_MARRIAGE_DEATH_FACT");
  const obituarySnapshot = claim<SourceAttachmentRef>(facts, "obituary_snapshot", "SOURCE_ATTACHMENT_REQUIRED");
  const memorialSearches = claim<MemorialSearchTask[]>(facts, "memorial_search_tasks", "MISSING_MARRIAGE_DEATH_FACT");
  const deathCertificateStatus = claim<string>(facts, "death_certificate_status", "MISSING_MARRIAGE_DEATH_FACT");
  const incarcerationStatus = claim<string>(facts, "incarceration_status_signal", "MISSING_MARRIAGE_DEATH_FACT");
  const marriageDeathIndicators = {
    sourceStatus: marriageDeathSourceStatus,
    marriageLicense,
    dateOfBirth,
    dateOfDeath,
    obituaryLink,
    obituarySnapshot,
    memorialSearches,
    deathCertificateStatus,
    incarcerationStatus,
    reviewTasks: compactTasks([
      reviewTask({ code: "MARRIAGE_LICENSE", title: "Check marriage-license signal", source: "clerk_of_courts", reason: "Marriage records are research facts, not spouse/heir determinations.", nextAction: "Search clerk records and record marriage-license signal or absent status.", claim: marriageLicense, fallbackFlags: ["MISSING_MARRIAGE_DEATH_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "DOB_DOD", title: "Capture DOB/DOD indicators", source: "clerk_of_courts", reason: "Birth and death dates must remain reviewable facts with source refs.", nextAction: "Record DOB/DOD from public sources or mark unknown with review flags.", claim: combineClaims([dateOfBirth, dateOfDeath]), fallbackFlags: ["MISSING_MARRIAGE_DEATH_FACT", "HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "OBITUARY_LINK", title: "Capture obituary links", source: "clerk_of_courts", reason: "Obituary links support research but do not prove heirship.", nextAction: "Attach obituary URLs or note that none were found.", claim: obituaryLink, fallbackFlags: ["MISSING_MARRIAGE_DEATH_FACT", "HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "OBITUARY_SNAPSHOT", title: "Attach obituary snapshot", source: "clerk_of_courts", reason: "If an obituary exists, the dossier needs the screenshot or saved page plus the public URL.", nextAction: "Capture the obituary screenshot and link, or record reviewed-not-found.", claim: obituarySnapshot, fallbackFlags: ["SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "MEMORIAL_SEARCH", title: "Review memorial search tasks", source: "clerk_of_courts", reason: "Findagrave, Legacy, and Google searches must be recorded as links, absent status, or visible tasks.", nextAction: "Record search results or absent status for each memorial provider.", claim: memorialSearches, fallbackFlags: ["HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "DEATH_CERTIFICATE", title: "Capture death certificate status", source: "clerk_of_courts", reason: "VitalChek and automated death-certificate ordering remain blocked.", nextAction: "Record whether a death certificate was requested, obtained, or still missing.", claim: deathCertificateStatus, fallbackFlags: ["MANUAL_DEATH_CERTIFICATE_REQUIRED", "HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "INCARCERATION", title: "Check incarceration status signal", source: "clerk_of_courts", reason: "Incarceration status must be recorded as match, no-match, or source-blocked.", nextAction: "Record incarceration signal or mark unknown with source evidence.", claim: incarcerationStatus, fallbackFlags: ["MISSING_MARRIAGE_DEATH_FACT", "HUMAN_REVIEW_REQUIRED"] }),
    ]),
    deathCertificateTask: {
      required: deathCertificateStatus.value === null,
      reason: "Death certificate status is not captured; keep manual vital-record steps as operator tasks.",
      sourceRefs: deathCertificateStatus.sourceRefs,
      reviewFlags: ["MANUAL_DEATH_CERTIFICATE_REQUIRED", "HUMAN_REVIEW_REQUIRED"] as ReviewFlag[],
    },
  };
  const familyTreeSourceStatus = claim<string>(facts, "family_tree_status", "MISSING_PROBATE_FACT");
  const familyTreeHypothesisClaim = claim<FamilyTreeHypothesisData>(facts, "family_tree_hypothesis", "MISSING_PROBATE_FACT");
  const primaryContacts = facts
    .filter((item) => item.factType === "primary_contact_profile" && item.value && typeof item.value === "object")
    .map((item) => item.value as ContactCandidate);
  const alternativeContacts = facts
    .filter((item) => item.factType === "alternative_contact_profile" && item.value && typeof item.value === "object")
    .map((item) => item.value as ContactCandidate);
  const familyTreeHypothesisWithContacts: DossierClaim<FamilyTreeHypothesisData> = familyTreeHypothesisClaim.value
    ? {
      ...familyTreeHypothesisClaim,
      value: {
        ...familyTreeHypothesisClaim.value,
        contactCandidates: [...primaryContacts, ...alternativeContacts],
      },
    }
    : familyTreeHypothesisClaim;
  const familyTree = {
    sourceStatus: familyTreeSourceStatus,
    hypothesis: familyTreeHypothesisWithContacts,
    reviewTasks: compactTasks([
      reviewTask({ code: "FAMILY_TREE_HYPOTHESIS", title: "Build family tree hypothesis", source: "intake", reason: "Family tree output is a hypothesis with evidence, not a legal heir determination.", nextAction: "Fill relationship nodes with names, confidence, and source refs or leave review-required.", claim: familyTreeHypothesisWithContacts, fallbackFlags: ["HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "IDI_ASSET_SEARCH", title: "Import one IDI asset search", source: "idi", reason: "The client needs one expanded asset search per estate address; repeated paid runs are blocked unless an admin records an override reason.", nextAction: "Run or import the expanded asset search by property address once, then review spouse, children, relatives, and associates.", claim: combineClaims([optionalClaim(facts, "idi_asset_search_status"), optionalClaim(facts, "idi_asset_report_attachment")]), fallbackFlags: ["MISSING_IDI_ASSET_SEARCH", "PAID_SOURCE_APPROVAL_REQUIRED", "HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "FAMILY_TREE_CONTACTS", title: "Review primary and alternative contacts", source: "idi", reason: "Spouse and children become primary secondary contacts after operator review; other relatives and associates stay alternative until promoted.", nextAction: "Accept spouse/child contacts, promote if needed, and leave unverified relatives in Alternative Contacts.", claim: combineClaims([optionalClaim(facts, "primary_contact_profile"), optionalClaim(facts, "alternative_contact_profile"), familyTreeHypothesisWithContacts]), fallbackFlags: ["CONTACT_ACCEPTANCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"] }),
    ]),
  };
  const sourceGovernanceCatalog = claim<SourceGovernanceCatalog>(facts, "source_governance_catalog", "PAID_SOURCE_APPROVAL_REQUIRED");
  const sourceGovernance = {
    catalog: sourceGovernanceCatalog,
    reviewTasks: compactTasks([
      reviewTask({ code: "PAID_SOURCE_GOVERNANCE", title: "Confirm paid-source approval gates", source: "intake", reason: "IDI, Intelius, Ancestry, ForeWarn, and VitalChek cannot be automated by default.", nextAction: "Obtain client approval before any paid-source use or storage.", claim: sourceGovernanceCatalog, fallbackFlags: ["PAID_SOURCE_APPROVAL_REQUIRED", "STORAGE_APPROVAL_REQUIRED", "HUMAN_REVIEW_REQUIRED"] }),
      reviewTask({ code: "MANUAL_SOURCE_GOVERNANCE", title: "Route manual research tasks", source: "intake", reason: "Door knocks, neighbor research, and code enforcement remain manual operator work.", nextAction: "Create manual tasks only after explicit approval.", claim: sourceGovernanceCatalog, fallbackFlags: ["MANUAL_SOURCE_APPROVAL_REQUIRED", "HUMAN_REVIEW_REQUIRED"] }),
    ]),
  };
  const workflow = evaluateWorkflowRules(facts);
  const hasEnrichedContacts = facts.some((item) => item.factType === "enriched_contact_profile" || item.factType === "primary_contact_profile");
  const sourceBackedFactTypes = new Set(facts.filter(isSourceBackedFact).map((item) => item.factType));
  const effectiveFacts = facts.filter((item) => isSourceBackedFact(item) || !sourceBackedFactTypes.has(item.factType));
  const auditFlags = Array.from(new Set(
    effectiveFacts
      .flatMap((item) => item.reviewFlags)
      .concat(workflow.reviewFlags)
      .concat(hasEnrichedContacts ? [] : (["NO_ENRICHMENT_RUN"] as ReviewFlag[])),
  )).filter((flag) => !hasEnrichedContacts || flag !== "NO_ENRICHMENT_RUN");
  const titleFacts = facts.filter((item) => item.factType === "title_signal" || item.factType === "official_records_status");
  const titleEvents: DossierEvent[] = titleFacts.map((item, index) => ({
    id: `${runId}:title:${index + 1}`,
    label: item.factType === "official_records_status" ? "Official Records source checked" : "Title signal pending extraction",
    source: item.source,
    sourceRef: sourceRef(item.source, item.rawId, item.fetchedAt),
    risk: item.reviewFlags.includes("SOURCE_BLOCKED") ? "high" : "unknown",
    explanation: typeof item.value === "object" && item.value !== null && "note" in item.value
      ? String((item.value as { note?: unknown }).note)
      : "Official-record title details require browser/API extraction before claims can be treated as verified.",
    reviewFlags: item.reviewFlags,
  }));

  const displayName = estateName.value
    ? [estateName.value, address.value ?? ownerName.value].filter(Boolean).join(" - ")
    : ownerName.value
      ? `${ownerName.value} - ${address.value ?? "Property Review"}`
      : address.value ?? "HeirRight Public-Source Lead";

  const narrativeParts = [
    `Raw no-enrichment dossier generated for ${displayName}.`,
    estateName.value ? `Estate seed: ${estateName.value}.` : null,
    address.value ? `Property seed: ${address.value}.` : "Property address is missing and must be reviewed.",
    ownerName.value ? `Owner seed: ${ownerName.value}.` : "Owner name was not confirmed by the current run.",
    caseNumber.value ? `Case number seed: ${caseNumber.value}.` : null,
    "Probate/civil/family docket facts are record-only and do not assert legal conclusions.",
    "Marriage, death, and family-tree indicators are hypothesis/research facts only.",
    "Paid and manual sources remain approval-gated until client sign-off.",
    "Miami-Dade public source availability was checked before any CRM or outreach action.",
    "This is not a skip-traced or scored dossier. It is a raw public-source shell for human review.",
  ];
  const narrative = narrativeParts.filter((part): part is string => part !== null).join(" ");

  const dossierWithoutQueue: Omit<RawDossier, "operatorQueue" | "evidenceQa" | "sourceCoverage" | "outreach"> = {
    id: `dossier-${slug(displayName)}-${runId}`,
    runId,
    status: auditFlags.includes("SOURCE_BLOCKED") ? "blocked" : "ready_for_review",
    generatedAt: nowIso(),
    summary: {
      displayName,
      estateName: estateName.value,
      estateSearchKey: estateSearchKey.value,
      caseNumber: caseNumber.value,
      priority: "review",
      nextBestAction: workflow.nextAction,
    },
    property: {
      address,
      ownerName,
      estateName,
      caseNumber,
      county,
      parcelId,
    },
    taxHistory,
    deedHistory,
    probateDocket,
    marriageDeathIndicators,
    familyTree,
    sourceGovernance,
    titleEvents,
    workflow,
    narrative,
    crm: {
      provider: "podio",
      mode: "dry_run",
      status: "not_configured",
      reviewFlags: ["MISSING_CRM_CREDENTIALS", "HUMAN_REVIEW_REQUIRED"],
    },
    audit: {
      sourceRefs: facts.map((item) => sourceRef(item.source, item.rawId, item.fetchedAt)),
      reviewFlags: auditFlags,
      facts,
    },
  };
  const operatorQueue = buildOperatorQueue(dossierWithoutQueue);
  const dossierWithQueue = { ...dossierWithoutQueue, operatorQueue };
  const evidenceQa = runSourceEvidenceQa(dossierWithQueue);
  const dossierWithEvidence = { ...dossierWithQueue, evidenceQa };
  const sourceCoverage = buildSourceCoverageProfile(dossierWithEvidence);
  const dossierWithoutOutreach = { ...dossierWithEvidence, sourceCoverage };
  const outreach = buildOutreachWorkflow(dossierWithoutOutreach);

  return { ...dossierWithoutOutreach, outreach };
}
