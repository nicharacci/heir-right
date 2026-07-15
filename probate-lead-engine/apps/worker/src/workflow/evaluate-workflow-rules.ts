import type {
  LeadQualitySettings,
  ReviewFlag,
  SourceFact,
  SourceRef,
  WorkflowRuleEvaluation,
  WorkflowRuleResult,
  WorkflowRuleStatus,
} from "@ple/types";
import { nowIso, sourceRef } from "../lib";
import { isEntityOwnerName, isTrustOrEstateOwnerName } from "./entity-owner";

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

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

function isSourceBackedFact(fact: SourceFact): boolean {
  if (fact.value === null || fact.value === undefined || fact.value === "") return false;
  if (fact.source === "intake" || fact.source === "document_packet" || fact.source === "podio") return false;
  return !fact.reviewFlags.some((flag) => BLOCKING_SOURCE_FACT_FLAGS.includes(flag));
}

function rule(input: {
  code: WorkflowRuleResult["code"];
  label: string;
  status: WorkflowRuleStatus;
  explanation: string;
  reasonCodes: string[];
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}): WorkflowRuleResult {
  return {
    ...input,
    reasonCodes: unique(input.reasonCodes),
    reviewFlags: unique(input.reviewFlags),
  };
}

function evaluateOwnerType(facts: SourceFact[]): WorkflowRuleResult {
  const ownerName = valueFor<string>(facts, "property_owner");
  const ownerType = valueFor<string>(facts, "owner_type");
  const sourceRefs = [...refsFor(facts, "property_owner"), ...refsFor(facts, "owner_type")];

  if (!ownerName) {
    return rule({
      code: "OWNER_TYPE",
      label: "Owner qualification",
      status: "review_required",
      explanation: "Owner name is missing, so the lead cannot continue until an operator confirms ownership type.",
      reasonCodes: ["OWNER_MISSING"],
      sourceRefs,
      reviewFlags: ["MISSING_OWNER_FACT", "MISSING_OWNER_TYPE_FACT", "HUMAN_REVIEW_REQUIRED"],
    });
  }

  const normalizedType = ownerType?.toLowerCase();
  const looksLikeEntity = normalizedType === "company" || isEntityOwnerName(ownerName);
  if (looksLikeEntity) {
    return rule({
      code: "OWNER_TYPE",
      label: "Owner qualification",
      status: "stop",
      explanation: "The Property Appraiser owner appears to be a company or other non-probate entity, so this lead must leave the active play.",
      reasonCodes: ["COMPANY_OWNER"],
      sourceRefs,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
    });
  }

  if (["trust", "estate", "trust_estate_review"].includes(normalizedType || "") || isTrustOrEstateOwnerName(ownerName)) {
    return rule({
      code: "OWNER_TYPE",
      label: "Owner qualification",
      status: "continue",
      explanation: "The owner appears to be a trust or estate. Keep the lead active and verify the trustee, personal representative, and current Property Appraiser record.",
      reasonCodes: ["TRUST_OR_ESTATE_OWNER_REVIEW"],
      sourceRefs,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
    });
  }

  return rule({
    code: "OWNER_TYPE",
    label: "Owner qualification",
    status: "continue",
    explanation: "The owner seed does not match the entity-owner stop pattern. Keep it moving, but preserve source review until public records confirm the owner.",
    reasonCodes: ["INDIVIDUAL_OWNER_SEED"],
    sourceRefs,
    reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
  });
}

function evaluateRecentSale(facts: SourceFact[], nowMs = Date.now()): WorkflowRuleResult {
  const lastSaleDate = valueFor<string>(facts, "last_sale_date");
  const sourceRefs = refsFor(facts, "last_sale_date");

  if (!lastSaleDate) {
    return rule({
      code: "RECENT_SALE",
      label: "Recent sale guard",
      status: "review_required",
      explanation: "No last-sale fact is present yet. Deed/tax depth must confirm whether the property sold within the last 5 years.",
      reasonCodes: ["LAST_SALE_UNKNOWN"],
      sourceRefs,
      reviewFlags: ["MISSING_RECENT_SALE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    });
  }

  const parsed = Date.parse(lastSaleDate);
  if (Number.isNaN(parsed)) {
    return rule({
      code: "RECENT_SALE",
      label: "Recent sale guard",
      status: "review_required",
      explanation: "A last-sale value exists, but it is not parseable as a date.",
      reasonCodes: ["LAST_SALE_DATE_INVALID"],
      sourceRefs,
      reviewFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    });
  }

  if (nowMs - parsed <= FIVE_YEARS_MS) {
    return rule({
      code: "RECENT_SALE",
      label: "Recent sale guard",
      status: "stop",
      explanation: "The property appears to have sold within the last 5 years, so this lead must stop and move on.",
      reasonCodes: ["RECENT_SALE_WITHIN_5_YEARS"],
      sourceRefs,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
    });
  }

  return rule({
    code: "RECENT_SALE",
    label: "Recent sale guard",
    status: "continue",
    explanation: "The recorded last-sale date is outside the 5-year stop window.",
    reasonCodes: ["NO_RECENT_SALE"],
    sourceRefs,
    reviewFlags: [],
  });
}

function evaluateAdversePossession(facts: SourceFact[]): WorkflowRuleResult {
  const signal = valueFor<boolean>(facts, "adverse_possession_signal");
  const sourceRefs = refsFor(facts, "adverse_possession_signal");

  if (signal === true) {
    return rule({
      code: "ADVERSE_POSSESSION",
      label: "Adverse possession guard",
      status: "review_required",
      explanation: "Adverse-possession signal is present. Keep the lead visible, but require human review before any downstream action.",
      reasonCodes: ["ADVERSE_POSSESSION_SIGNAL"],
      sourceRefs,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
    });
  }

  if (signal === false) {
    return rule({
      code: "ADVERSE_POSSESSION",
      label: "Adverse possession guard",
      status: "continue",
      explanation: "No adverse-possession signal was found in the available source facts.",
      reasonCodes: ["NO_ADVERSE_POSSESSION_SIGNAL"],
      sourceRefs,
      reviewFlags: [],
    });
  }

  return rule({
    code: "ADVERSE_POSSESSION",
    label: "Adverse possession guard",
    status: "review_required",
    explanation: "Adverse-possession evidence has not been checked yet.",
    reasonCodes: ["ADVERSE_POSSESSION_UNKNOWN"],
    sourceRefs,
    reviewFlags: ["MISSING_ADVERSE_POSSESSION_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
  });
}

function leadQualitySettings(): LeadQualitySettings {
  const signals = [
    { code: "estate_property_match", label: "Estate/property match", enabled: true, weight: 20, requiresSourceEvidence: true, reasonCode: "ESTATE_PROPERTY_MATCH_REQUIRED" },
    { code: "probate_or_court_signal", label: "Probate/court signal", enabled: true, weight: 20, requiresSourceEvidence: true, reasonCode: "PROBATE_SIGNAL_REQUIRED" },
    { code: "stuck_estate_timing", label: "Stuck-estate timing", enabled: true, weight: 15, requiresSourceEvidence: true, reasonCode: "STUCK_ESTATE_TIMING_REQUIRED" },
    { code: "mailing_address_mismatch", label: "Mailing-address mismatch", enabled: true, weight: 10, requiresSourceEvidence: true, reasonCode: "MAILING_MISMATCH_REQUIRED" },
    { code: "unpaid_tax_friction", label: "Unpaid-tax friction", enabled: true, weight: 10, requiresSourceEvidence: true, reasonCode: "TAX_FRICTION_REQUIRED" },
    { code: "title_deed_friction", label: "Title/deed friction", enabled: true, weight: 15, requiresSourceEvidence: true, reasonCode: "TITLE_DEED_FRICTION_REQUIRED" },
    { code: "property_friction", label: "Code/property friction", enabled: true, weight: 10, requiresSourceEvidence: true, reasonCode: "PROPERTY_FRICTION_REQUIRED" },
    { code: "generic_pull", label: "Generic pull without convergence", enabled: false, weight: 0, requiresSourceEvidence: true, reasonCode: "GENERIC_PULL_SUPPRESSED" },
  ];

  return {
    model: "heirright-s5-v1",
    minEnabledSignalWeightForPromotion: 40,
    genericPullSuppression: true,
    enabledSignals: signals.filter((signal) => signal.enabled).map((signal) => signal.code),
    disabledSignals: signals.filter((signal) => !signal.enabled).map((signal) => signal.code),
    signals,
    reasonCodes: signals.map((signal) => signal.reasonCode),
  };
}

function evaluateLeadQuality(facts: SourceFact[], settings: LeadQualitySettings): WorkflowRuleResult {
  const sourceRefs = facts.map((item) => sourceRef(item.source, item.rawId, item.fetchedAt));
  const presentSignals = new Set(
    facts
      .filter((item) => item.factType === "lead_quality_signal" && typeof item.value === "string")
      .map((item) => item.value as string),
  );
  const enabledWeight = settings.signals
    .filter((signal) => signal.enabled && presentSignals.has(signal.code))
    .reduce((sum, signal) => sum + signal.weight, 0);

  if (enabledWeight >= settings.minEnabledSignalWeightForPromotion) {
    return rule({
      code: "LEAD_QUALITY",
      label: "Lead-quality promotion",
      status: "continue",
      explanation: "Enough enabled source-backed quality signals are present to promote this beyond a generic public-source seed.",
      reasonCodes: ["LEAD_QUALITY_THRESHOLD_MET"],
      sourceRefs,
      reviewFlags: [],
    });
  }

  return rule({
    code: "LEAD_QUALITY",
    label: "Lead-quality promotion",
    status: "review_required",
    explanation: "The lead is still a generic public-source seed until multiple enabled quality signals converge with source evidence.",
    reasonCodes: ["LEAD_QUALITY_THRESHOLD_NOT_MET", "GENERIC_PULL_SUPPRESSED"],
    sourceRefs,
    reviewFlags: ["MISSING_LEAD_QUALITY_SIGNAL", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
  });
}

function evaluateSourceEvidence(facts: SourceFact[]): WorkflowRuleResult {
  const sourceRefs = facts.map((item) => sourceRef(item.source, item.rawId, item.fetchedAt));
  const sourceBackedFactTypes = new Set(facts.filter(isSourceBackedFact).map((item) => item.factType));
  const effectiveFacts = facts.filter((item) => isSourceBackedFact(item) || !sourceBackedFactTypes.has(item.factType));
  const missingFactFlags = effectiveFacts.flatMap((item) => item.reviewFlags).filter((flag) => flag.startsWith("MISSING_"));
  const sourceHealthOnly = effectiveFacts.some((item) => item.reviewFlags.includes("SOURCE_HEALTH_ONLY"));

  if (missingFactFlags.length || sourceHealthOnly) {
    return rule({
      code: "SOURCE_EVIDENCE",
      label: "Source evidence",
      status: "review_required",
      explanation: "Some property, deed, title, or tax details still need to be confirmed from the county records before the lead moves forward.",
      reasonCodes: ["SOURCE_EVIDENCE_INCOMPLETE"],
      sourceRefs,
      reviewFlags: unique([...missingFactFlags, "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"] as ReviewFlag[]),
    });
  }

  return rule({
      code: "SOURCE_EVIDENCE",
      label: "Source evidence",
      status: "continue",
      explanation: "Every current claim is backed by a checked source.",
      reasonCodes: ["SOURCE_EVIDENCE_PRESENT"],
    sourceRefs,
    reviewFlags: [],
  });
}

function rollupStatus(rules: WorkflowRuleResult[]): WorkflowRuleStatus {
  if (rules.some((item) => item.status === "stop")) return "stop";
  if (rules.some((item) => item.status === "review_required")) return "review_required";
  return "continue";
}

export function evaluateWorkflowRules(facts: SourceFact[]): WorkflowRuleEvaluation {
  const leadQuality = leadQualitySettings();
  const rules = [
    evaluateOwnerType(facts),
    evaluateRecentSale(facts),
    evaluateAdversePossession(facts),
    evaluateSourceEvidence(facts),
    evaluateLeadQuality(facts, leadQuality),
  ];
  const status = rollupStatus(rules);
  const reviewFlags = unique(rules.flatMap((item) => item.reviewFlags));
  const nextAction = status === "stop"
      ? "Move the lead into the disqualification queue. Correct the underlying source fact if the stop was based on bad evidence."
      : status === "review_required"
        ? "Resolve workflow review flags before enrichment, document prep, CRM writes, or outreach."
      : "Continue to the next lead-review stage with checked records attached.";

  return {
    status,
    evaluatedAt: nowIso(),
    nextAction,
    rules,
    leadQuality,
    reviewFlags,
  };
}
