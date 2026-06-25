import type { DossierClaim, RawDossier, ReviewFlag, SourceEvidenceQaCheck, SourceEvidenceQaResult, SourceEvidenceQaStatus } from "@ple/types";
import { nowIso } from "../lib";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function checkClaim(input: { code: string; label: string; claim: DossierClaim<unknown> }): SourceEvidenceQaCheck {
  const hasSource = input.claim.sourceRefs.length > 0;
  const hasReviewFlag = input.claim.reviewFlags.length > 0;

  if (hasSource && input.claim.value !== null) {
    return {
      code: input.code,
      label: input.label,
      status: "passed",
      explanation: "Claim has a value and source evidence.",
      sourceRefs: input.claim.sourceRefs,
      reviewFlags: input.claim.reviewFlags,
    };
  }

  if (hasReviewFlag) {
    return {
      code: input.code,
      label: input.label,
      status: "review_required",
      explanation: "Claim is missing or unverified, but the dossier exposes that as a visible review flag.",
      sourceRefs: input.claim.sourceRefs,
      reviewFlags: input.claim.reviewFlags,
    };
  }

  return {
    code: input.code,
    label: input.label,
    status: "failed",
    explanation: "Claim has neither source evidence nor a visible review flag.",
    sourceRefs: input.claim.sourceRefs,
    reviewFlags: input.claim.reviewFlags,
  };
}

function rollup(checks: SourceEvidenceQaCheck[]): SourceEvidenceQaStatus {
  if (checks.some((check) => check.status === "failed")) return "failed";
  if (checks.some((check) => check.status === "review_required")) return "review_required";
  return "passed";
}

export function runSourceEvidenceQa(dossier: Omit<RawDossier, "evidenceQa" | "sourceCoverage" | "outreach">): SourceEvidenceQaResult {
  const checks = [
    checkClaim({ code: "PROPERTY_ADDRESS", label: "Property address", claim: dossier.property.address }),
    checkClaim({ code: "PROPERTY_OWNER", label: "Property owner", claim: dossier.property.ownerName }),
    checkClaim({ code: "PROPERTY_FOLIO", label: "Parcel/folio", claim: dossier.property.parcelId }),
    checkClaim({ code: "TAX_HISTORY_STATUS", label: "Tax history status", claim: dossier.taxHistory.sourceStatus }),
    checkClaim({ code: "UNPAID_TAX_YEARS", label: "Unpaid tax years", claim: dossier.taxHistory.unpaidYears }),
    checkClaim({ code: "TAX_AMOUNT_DUE", label: "Tax amount due", claim: dossier.taxHistory.amountDue }),
    checkClaim({ code: "TAX_RECEIPT_STATUS", label: "Tax receipt status", claim: dossier.taxHistory.receiptStatus }),
    checkClaim({ code: "TAX_PAYER_IDENTITY", label: "Tax payer identity", claim: dossier.taxHistory.payerIdentity }),
    checkClaim({ code: "DEED_HISTORY_STATUS", label: "Deed history status", claim: dossier.deedHistory.sourceStatus }),
    checkClaim({ code: "LATEST_DEED", label: "Latest deed", claim: dossier.deedHistory.latestDeed }),
    checkClaim({ code: "OR_BOOK_PAGE", label: "OR book/page", claim: dossier.deedHistory.orBookPage }),
    checkClaim({ code: "LAST_SALE_DATE", label: "Last sale date", claim: dossier.deedHistory.lastSaleDate }),
    checkClaim({ code: "MAILING_ADDRESS_SIGNAL", label: "Mailing address signal", claim: dossier.deedHistory.mailingAddressSignal }),
    checkClaim({ code: "ADVERSE_POSSESSION", label: "Adverse possession signal", claim: dossier.deedHistory.adversePossessionSignal }),
    checkClaim({ code: "PROBATE_DOCKET_STATUS", label: "Probate docket status", claim: dossier.probateDocket.sourceStatus }),
    checkClaim({ code: "PROBATE_CASE_NUMBER", label: "Probate case number", claim: dossier.probateDocket.caseNumber }),
    checkClaim({ code: "PROBATE_CASE_STATUS", label: "Probate case status", claim: dossier.probateDocket.caseStatus }),
    checkClaim({ code: "AFFIDAVIT_OF_HEIRS", label: "Affidavit of heirs", claim: dossier.probateDocket.affidavitOfHeirs }),
    checkClaim({ code: "PROBATE_DOCUMENTS", label: "Probate document availability", claim: dossier.probateDocket.documentAvailability }),
    checkClaim({ code: "PROBATE_OR_CROSS_LINK", label: "Official record cross-links", claim: dossier.probateDocket.officialRecordCrossLinks }),
    checkClaim({ code: "MARRIAGE_DEATH_STATUS", label: "Marriage/death research status", claim: dossier.marriageDeathIndicators.sourceStatus }),
    checkClaim({ code: "DEATH_CERTIFICATE", label: "Death certificate status", claim: dossier.marriageDeathIndicators.deathCertificateStatus }),
    checkClaim({ code: "FAMILY_TREE_STATUS", label: "Family tree status", claim: dossier.familyTree.sourceStatus }),
    checkClaim({ code: "FAMILY_TREE_HYPOTHESIS", label: "Family tree hypothesis", claim: dossier.familyTree.hypothesis }),
    checkClaim({ code: "SOURCE_GOVERNANCE", label: "Source governance catalog", claim: dossier.sourceGovernance.catalog }),
  ];
  if (dossier.completedLeadReport?.offerMath) {
    checks.push({
      code: "OFFER_AS_IS_VALUE",
      label: "As-is value",
      status: dossier.completedLeadReport.offerMath.asIsValue.value !== null ? "passed" : "review_required",
      explanation: dossier.completedLeadReport.offerMath.asIsValue.value !== null
        ? "As-is value captured for underwriting."
        : "As-is value remains a placeholder with visible review flags.",
      sourceRefs: dossier.completedLeadReport.offerMath.asIsValue.sourceRefs,
      reviewFlags: dossier.completedLeadReport.offerMath.asIsValue.reviewFlags,
    });
  }
  if (dossier.completedLeadReport) {
    checks.push({
      code: "REPORT_REVIEW_GATE",
      label: "Report review gate",
      status: dossier.completedLeadReport.reviewGate.externalUseBlocked ? "review_required" : "failed",
      explanation: dossier.completedLeadReport.reviewGate.externalUseBlocked
        ? "Report is internal-only until operator review."
        : "Report review gate failed to block external use.",
      sourceRefs: [],
      reviewFlags: dossier.completedLeadReport.reviewGate.reviewFlags,
    });
  }
  const reviewFlags = unique(checks.flatMap((check) => check.reviewFlags));
  const status = rollup(checks);

  return {
    status,
    checkedAt: nowIso(),
    checks,
    reviewFlags: status === "failed" ? unique([...reviewFlags, "SOURCE_EVIDENCE_REQUIRED"] as ReviewFlag[]) : reviewFlags,
  };
}
