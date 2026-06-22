import type { DossierClaim, RawDossier, ReviewFlag, SourceCoverageArea, SourceCoverageAreaKey, SourceCoverageProfile, SourceRef } from "@ple/types";
import { nowIso } from "../lib";

type CoverageInput = Omit<RawDossier, "sourceCoverage" | "outreach">;

interface CoverageField {
  label: string;
  claim: DossierClaim<unknown>;
}

const ACTIONS: Record<SourceCoverageAreaKey, string> = {
  property: "Confirm parcel, mailing address, and owner details in the county property record.",
  tax: "Capture unpaid tax years, amount due, receipt status, and payer identity from tax records.",
  deed_title: "Capture latest deed, OR book/page or instrument number, recent sale, and title-friction signals.",
  probate: "Search probate/civil/family dockets and record case status, affidavit status, and document availability.",
  family_tree_offer: "Replace intake placeholders with sourced heir/contact facts and operator-reviewed offer inputs.",
};

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function uniqueRefs(refs: SourceRef[]): SourceRef[] {
  return Array.from(new Map(refs.map((ref) => [`${ref.source}:${ref.rawId}:${ref.fetchedAt}`, ref])).values());
}

function isSourceExtracted(claim: DossierClaim<unknown>): boolean {
  if (claim.value === null || claim.value === undefined || claim.value === "") return false;
  if (!claim.sourceRefs.some((ref) => ref.source !== "intake" && ref.source !== "document_packet" && ref.source !== "podio")) return false;
  const blockingFlags: ReviewFlag[] = ["SOURCE_EVIDENCE_REQUIRED", "SOURCE_HEALTH_ONLY", "SOURCE_BLOCKED"];
  return !claim.reviewFlags.some((flag) => blockingFlags.includes(flag));
}

function area(input: { key: SourceCoverageAreaKey; label: string; fields: CoverageField[] }): SourceCoverageArea {
  const extractedFields = input.fields
    .filter((field) => isSourceExtracted(field.claim))
    .map((field) => field.label);
  const missingFields = input.fields
    .filter((field) => !isSourceExtracted(field.claim))
    .map((field) => field.label);
  return {
    key: input.key,
    label: input.label,
    status: missingFields.length === 0 ? "extracted" : extractedFields.length > 0 ? "partial" : "blocked",
    extractedFields,
    missingFields,
    nextAction: ACTIONS[input.key],
    sourceRefs: uniqueRefs(input.fields.flatMap((field) => field.claim.sourceRefs)),
    reviewFlags: unique(input.fields.flatMap((field) => field.claim.reviewFlags)),
  };
}

export function buildSourceCoverageProfile(dossier: CoverageInput): SourceCoverageProfile {
  const areas = [
    area({
      key: "property",
      label: "Property identity",
      fields: [
        { label: "property address", claim: dossier.property.address },
        { label: "property owner", claim: dossier.property.ownerName },
        { label: "folio", claim: dossier.property.parcelId },
        { label: "mailing address", claim: dossier.deedHistory.mailingAddressSignal },
      ],
    }),
    area({
      key: "tax",
      label: "Tax status",
      fields: [
        { label: "tax status", claim: dossier.taxHistory.sourceStatus },
        { label: "unpaid tax years", claim: dossier.taxHistory.unpaidYears },
        { label: "tax amount due", claim: dossier.taxHistory.amountDue },
        { label: "receipt status", claim: dossier.taxHistory.receiptStatus },
        { label: "payer identity", claim: dossier.taxHistory.payerIdentity },
      ],
    }),
    area({
      key: "deed_title",
      label: "Deed and title",
      fields: [
        { label: "latest deed", claim: dossier.deedHistory.latestDeed },
        { label: "OR book/page", claim: dossier.deedHistory.orBookPage },
        { label: "last sale date", claim: dossier.deedHistory.lastSaleDate },
        { label: "mortgage signal", claim: dossier.deedHistory.mortgageSignal },
        { label: "lien signal", claim: dossier.deedHistory.lienSignal },
        { label: "Lis Pendens signal", claim: dossier.deedHistory.lisPendensSignal },
        { label: "foreclosure signal", claim: dossier.deedHistory.foreclosureSignal },
        { label: "adverse possession signal", claim: dossier.deedHistory.adversePossessionSignal },
      ],
    }),
    area({
      key: "probate",
      label: "Probate and court",
      fields: [
        { label: "probate case number", claim: dossier.probateDocket.caseNumber },
        { label: "case status", claim: dossier.probateDocket.caseStatus },
        { label: "civil/family docket", claim: dossier.probateDocket.civilFamilyDocket },
        { label: "affidavit of heirs", claim: dossier.probateDocket.affidavitOfHeirs },
        { label: "document availability", claim: dossier.probateDocket.documentAvailability },
        { label: "official-record cross-link", claim: dossier.probateDocket.officialRecordCrossLinks },
      ],
    }),
    area({
      key: "family_tree_offer",
      label: "Family tree and offer inputs",
      fields: [
        { label: "date of death", claim: dossier.marriageDeathIndicators.dateOfDeath },
        { label: "obituary link", claim: dossier.marriageDeathIndicators.obituaryLink },
        { label: "family tree hypothesis", claim: dossier.familyTree.hypothesis },
      ],
    }),
  ];

  const extractedAreaCount = areas.filter((item) => item.status === "extracted").length;
  const partialAreaCount = areas.filter((item) => item.status === "partial").length;
  const blockedAreaCount = areas.filter((item) => item.status === "blocked").length;
  return {
    status: blockedAreaCount > 0 ? "blocked" : partialAreaCount > 0 ? "partial" : "extracted",
    checkedAt: nowIso(),
    extractedAreaCount,
    partialAreaCount,
    blockedAreaCount,
    extractedFieldCount: areas.reduce((total, item) => total + item.extractedFields.length, 0),
    missingFieldCount: areas.reduce((total, item) => total + item.missingFields.length, 0),
    areas,
  };
}
