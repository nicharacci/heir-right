import type { OfferProfitField, OfferProfitMath, RawDossier, ReviewFlag, SourceRef } from "@ple/types";
import { nowIso } from "../lib";

const DEFAULT_BUY_PERCENTAGE = 50;
const DEFAULT_MINIMUM_NET_PROFIT = 15000;

function field(input: {
  label: string;
  value: number | null;
  confidence: number;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
  note?: string;
}): OfferProfitField {
  return {
    label: input.label,
    value: input.value,
    currency: "USD",
    confidence: input.confidence,
    sourceRefs: input.sourceRefs,
    reviewFlags: input.reviewFlags,
    note: input.note,
  };
}

function uniqueFlags(flags: ReviewFlag[]): ReviewFlag[] {
  return Array.from(new Set(flags));
}

function parseCurrencyHint(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/\$?\s*([\d]+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function sumKnown(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value as number), 0);
}

export function buildOfferProfitMath(dossier: RawDossier): OfferProfitMath {
  const factValue = <T,>(factType: string): T | null => {
    const item = dossier.audit.facts.find((candidate) => candidate.factType === factType && candidate.value !== null && candidate.value !== undefined);
    return item ? (item.value as T) : null;
  };

  const taxAmount = dossier.taxHistory.amountDue.value?.amount ?? null;
  const taxesDue = field({
    label: "Taxes due",
    value: taxAmount,
    confidence: dossier.taxHistory.amountDue.confidence,
    sourceRefs: dossier.taxHistory.amountDue.sourceRefs,
    reviewFlags: taxAmount === null
      ? uniqueFlags([...dossier.taxHistory.amountDue.reviewFlags, "MISSING_OFFER_MATH_FACT"])
      : dossier.taxHistory.amountDue.reviewFlags,
    note: taxAmount === null ? "Capture unpaid tax amount before underwriting." : undefined,
  });

  const mortgageHint = dossier.deedHistory.mortgageSignal.value;
  const mortgageValue = parseCurrencyHint(mortgageHint);
  const mortgages = field({
    label: "Mortgages",
    value: mortgageValue,
    confidence: mortgageValue === null ? 0 : dossier.deedHistory.mortgageSignal.confidence,
    sourceRefs: dossier.deedHistory.mortgageSignal.sourceRefs,
    reviewFlags: mortgageValue === null
      ? uniqueFlags([...dossier.deedHistory.mortgageSignal.reviewFlags, "MISSING_OFFER_MATH_FACT"])
      : dossier.deedHistory.mortgageSignal.reviewFlags,
    note: mortgageHint ?? "Mortgage balance not yet quantified.",
  });

  const lienHint = dossier.deedHistory.lienSignal.value;
  const lienValue = parseCurrencyHint(lienHint);
  const liens = field({
    label: "Liens",
    value: lienValue,
    confidence: lienValue === null ? 0 : dossier.deedHistory.lienSignal.confidence,
    sourceRefs: dossier.deedHistory.lienSignal.sourceRefs,
    reviewFlags: lienValue === null
      ? uniqueFlags([...dossier.deedHistory.lienSignal.reviewFlags, "MISSING_OFFER_MATH_FACT"])
      : dossier.deedHistory.lienSignal.reviewFlags,
    note: lienHint ?? "Lien amounts require operator confirmation.",
  });

  const asIsValue = field({
    label: "As-is value",
    value: factValue<number>("offer_as_is_value"),
    confidence: factValue<number>("offer_as_is_value") === null ? 0 : 0.6,
    sourceRefs: dossier.audit.facts.filter((item) => item.factType === "offer_as_is_value").map((item) => ({
      source: item.source,
      rawId: item.rawId,
      fetchedAt: item.fetchedAt,
    })),
    reviewFlags: factValue<number>("offer_as_is_value") === null
      ? ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"]
      : ["UNDERWRITING_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    note: factValue<number>("offer_as_is_value") === null ? "Requires operator comp or appraisal input." : undefined,
  });

  const sellingCosts = field({
    label: "Selling costs",
    value: null,
    confidence: 0,
    sourceRefs: [],
    reviewFlags: ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED"],
    note: "Default closing/selling assumptions not auto-filled.",
  });

  const probateCosts = field({
    label: "Probate costs",
    value: null,
    confidence: 0,
    sourceRefs: dossier.probateDocket.sourceStatus.sourceRefs,
    reviewFlags: ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED"],
    note: "Estimate probate/administration costs during review.",
  });

  const partitionCosts = field({
    label: "Partition costs",
    value: null,
    confidence: 0,
    sourceRefs: [],
    reviewFlags: ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED"],
    note: "Partition litigation costs remain operator inputs.",
  });

  const heirNodes = dossier.familyTree.hypothesis.value?.nodes.length ?? 0;
  const heirCountValue = factValue<number>("offer_heir_count") ?? (heirNodes > 0 ? heirNodes : null);
  const heirCount = field({
    label: "Number of heirs",
    value: heirCountValue,
    confidence: heirCountValue !== null ? dossier.familyTree.hypothesis.confidence : 0,
    sourceRefs: dossier.familyTree.hypothesis.sourceRefs,
    reviewFlags: heirCountValue !== null
      ? dossier.familyTree.hypothesis.reviewFlags
      : ["MISSING_OFFER_MATH_FACT", "HUMAN_REVIEW_REQUIRED"],
    note: heirCountValue !== null ? "Heir count derived from family-tree hypothesis nodes." : "Confirm heir count before offer math.",
  });

  const buyPercentageValue = factValue<number>("offer_buy_percentage") ?? DEFAULT_BUY_PERCENTAGE;
  const buyPercentage = field({
    label: "Buy percentage",
    value: buyPercentageValue,
    confidence: 0.5,
    sourceRefs: dossier.audit.facts.filter((item) => item.factType === "offer_buy_percentage").map((item) => ({
      source: item.source,
      rawId: item.rawId,
      fetchedAt: item.fetchedAt,
    })),
    reviewFlags: ["UNDERWRITING_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    note: "Default buy percentage pending operator review.",
  });

  const minimumNetProfitValue = factValue<number>("offer_minimum_net_profit") ?? DEFAULT_MINIMUM_NET_PROFIT;
  const minimumNetProfit = field({
    label: "Minimum net profit",
    value: minimumNetProfitValue,
    confidence: 0.5,
    sourceRefs: dossier.audit.facts.filter((item) => item.factType === "offer_minimum_net_profit").map((item) => ({
      source: item.source,
      rawId: item.rawId,
      fetchedAt: item.fetchedAt,
    })),
    reviewFlags: ["UNDERWRITING_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    note: "Default minimum net profit target pending operator review.",
  });

  const deductions = sumKnown([
    taxesDue.value,
    liens.value,
    mortgages.value,
    sellingCosts.value,
    probateCosts.value,
    partitionCosts.value,
  ]);
  const postEquityValue = field({
    label: "Post-equity value",
    value: asIsValue.value !== null && deductions !== null ? asIsValue.value - deductions : null,
    confidence: asIsValue.value !== null && deductions !== null ? 0.4 : 0,
    sourceRefs: [...asIsValue.sourceRefs, ...taxesDue.sourceRefs, ...mortgages.sourceRefs],
    reviewFlags: ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED"],
    note: "Computed only when as-is value and all deduction inputs are known.",
  });

  const equityPerHeir = field({
    label: "Equity per heir",
    value: postEquityValue.value !== null && heirCount.value !== null && heirCount.value > 0
      ? postEquityValue.value / heirCount.value
      : null,
    confidence: postEquityValue.value !== null && heirCount.value !== null ? 0.4 : 0,
    sourceRefs: [...postEquityValue.sourceRefs, ...heirCount.sourceRefs],
    reviewFlags: ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED"],
  });

  const offerAmount = field({
    label: "Offer amount",
    value: equityPerHeir.value !== null && buyPercentage.value !== null
      ? Math.round(equityPerHeir.value * (buyPercentage.value / 100))
      : null,
    confidence: equityPerHeir.value !== null ? 0.35 : 0,
    sourceRefs: [...equityPerHeir.sourceRefs, ...buyPercentage.sourceRefs],
    reviewFlags: ["MISSING_OFFER_MATH_FACT", "UNDERWRITING_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    note: "Draft offer only; not approved for external use.",
  });

  const profit = field({
    label: "Estimated profit",
    value: equityPerHeir.value !== null && offerAmount.value !== null
      ? Math.round(equityPerHeir.value - offerAmount.value)
      : null,
    confidence: offerAmount.value !== null ? 0.35 : 0,
    sourceRefs: [...equityPerHeir.sourceRefs, ...offerAmount.sourceRefs],
    reviewFlags: ["UNDERWRITING_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
  });

  const reviewFlags = uniqueFlags([
    "UNDERWRITING_REVIEW_REQUIRED",
    "HUMAN_REVIEW_REQUIRED",
    "OUTREACH_BLOCKED",
    ...asIsValue.reviewFlags,
    ...taxesDue.reviewFlags,
    ...liens.reviewFlags,
    ...mortgages.reviewFlags,
    ...sellingCosts.reviewFlags,
    ...probateCosts.reviewFlags,
    ...partitionCosts.reviewFlags,
    ...postEquityValue.reviewFlags,
    ...heirCount.reviewFlags,
    ...equityPerHeir.reviewFlags,
    ...buyPercentage.reviewFlags,
    ...offerAmount.reviewFlags,
    ...profit.reviewFlags,
    ...minimumNetProfit.reviewFlags,
  ]);

  return {
    asIsValue,
    taxesDue,
    liens,
    mortgages,
    sellingCosts,
    probateCosts,
    partitionCosts,
    postEquityValue,
    heirCount,
    equityPerHeir,
    buyPercentage,
    offerAmount,
    profit,
    minimumNetProfit,
    computedAt: nowIso(),
    reviewFlags,
  };
}
