import type {
  DailyDuplicateLeadResult,
  DailyLeadResult,
  DeadLetter,
  LeadQualitySettings,
  QualificationCoverageScore,
  QualificationDecision,
  QualificationReviewPacket,
  QualificationReviewRecord,
  RawDossier,
  SourceCoverageArea,
  SourceCoverageAreaKey,
  SourceCoverageProfile,
  SourceCoverageSummary,
} from "@ple/types";
import { nowIso, slug } from "../lib";

const REQUIRED_COVERAGE_SCORE = 70;
const AREA_ORDER: SourceCoverageAreaKey[] = ["property", "tax", "deed_title", "probate", "family_tree_contacts", "family_tree_offer"];
const AREA_LABELS: Record<SourceCoverageAreaKey, string> = {
  property: "Property",
  tax: "Tax",
  deed_title: "Deed and title",
  probate: "Probate",
  family_tree_contacts: "Family tree and contacts",
  family_tree_offer: "Family tree and offer",
};
const AREA_WEIGHTS: Record<SourceCoverageAreaKey, number> = {
  property: 24,
  tax: 18,
  deed_title: 22,
  probate: 22,
  family_tree_contacts: 14,
  family_tree_offer: 14,
};

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function humanStatus(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function areaFor(profile: SourceCoverageProfile, key: SourceCoverageAreaKey): SourceCoverageArea {
  return profile.areas.find((area) => area.key === key) ?? {
    key,
    label: AREA_LABELS[key],
    status: "blocked",
    extractedFields: [],
    missingFields: ["Source coverage record missing"],
    nextAction: "Capture source-backed facts for this area.",
    sourceRefs: [],
    reviewFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
  };
}

function reasonCodeFor(area: SourceCoverageArea): string {
  const prefix = area.key.toUpperCase();
  if (area.status === "extracted") return `${prefix}_SOURCE_EXTRACTED`;
  if (area.status === "partial") return `${prefix}_SOURCE_PARTIAL`;
  return `${prefix}_SOURCE_BLOCKED`;
}

function earnedScore(area: SourceCoverageArea, weight: number): number {
  if (area.status === "extracted") return weight;
  if (area.status === "partial") return Math.round(weight * 0.45);
  return 0;
}

function coverageBreakdown(profile: SourceCoverageProfile): QualificationCoverageScore[] {
  const availableKeys = new Set(profile.areas.map((area) => area.key));
  return AREA_ORDER.filter((key) => availableKeys.has(key) || (key !== "family_tree_contacts" && key !== "family_tree_offer")).map((key) => {
    const area = areaFor(profile, key);
    const weight = AREA_WEIGHTS[key];
    return {
      area: key,
      label: area.label,
      status: area.status,
      weight,
      earned: earnedScore(area, weight),
      reasonCode: reasonCodeFor(area),
      nextAction: area.nextAction,
    };
  });
}

function coverageScore(profile: SourceCoverageProfile): number {
  return coverageBreakdown(profile).reduce((sum, area) => sum + area.earned, 0);
}

function requiredCoverageScore(dossier: RawDossier): number {
  return Math.max(REQUIRED_COVERAGE_SCORE, dossier.workflow.leadQuality.minEnabledSignalWeightForPromotion);
}

export function qualificationBlockers(dossier: RawDossier): string[] {
  const blockers: string[] = [];
  const profile = dossier.completedLeadReport?.leadQualityProfile;
  const score = coverageScore(dossier.sourceCoverage);
  const requiredScore = requiredCoverageScore(dossier);

  if (!profile?.promotionEligible) blockers.push(`Lead bucket is ${profile?.leadBucket ?? "unknown"}, not qualified.`);
  if (dossier.workflow.status !== "continue") blockers.push(`Workflow status is ${dossier.workflow.status}.`);
  if (dossier.operatorQueue.state !== "ready_for_review") blockers.push(`Operator queue is ${dossier.operatorQueue.state}.`);
  if (dossier.audit.reviewFlags.includes("SOURCE_HEALTH_ONLY") && dossier.sourceCoverage.extractedFieldCount === 0) {
    blockers.push("Only source reachability is proven for at least one source.");
  }
  if (dossier.audit.reviewFlags.includes("NO_ENRICHMENT_RUN")) blockers.push("No enrichment/contact run has been approved or completed.");
  if (dossier.sourceCoverage.blockedAreaCount > 0) {
    blockers.push(`${plural(dossier.sourceCoverage.blockedAreaCount, "source area")} still need real county source facts.`);
  }
  if (score < requiredScore) blockers.push(`Source coverage score ${score} is below the required ${requiredScore}.`);
  if (dossier.completedLeadReport?.missingData.length) blockers.push(`Report has ${dossier.completedLeadReport.missingData.length} missing section(s).`);
  return unique(blockers);
}

function disqualifiedByStopRule(dossier: RawDossier): boolean {
  return dossier.workflow.status === "stop"
    || dossier.operatorQueue.state === "disqualified"
    || dossier.completedLeadReport?.leadQualityProfile.leadBucket === "disqualified";
}

function decisionLabel(decisionStatus: QualificationDecision["status"]): string {
  if (decisionStatus === "qualified") return "Qualified for operator spot-check";
  if (decisionStatus === "disqualified") return "Disqualified until operator override";
  return "Review before promotion";
}

function nextActionFor(dossier: RawDossier, decisionStatus: QualificationDecision["status"], blockers: string[]): string {
  if (decisionStatus === "qualified") return "Spot-check the completed report and source links before any handoff or outreach.";
  if (decisionStatus === "disqualified") return "Keep this lead out of the qualified queue unless an operator documents an override.";
  if (blockers.some((blocker) => /source area|Source coverage/i.test(blocker))) {
    return "Resolve blocked source areas, then rerun qualification review before promotion.";
  }
  if (blockers.some((blocker) => /enrichment|contact/i.test(blocker))) {
    return "Approve or complete contact enrichment before counting the lead as qualified.";
  }
  if (dossier.workflow.status !== "continue") return dossier.workflow.nextAction;
  return "Review the open reason codes and missing report sections before promotion.";
}

export function buildQualificationDecision(dossier: RawDossier, blockers = qualificationBlockers(dossier)): QualificationDecision {
  const coverage = coverageBreakdown(dossier.sourceCoverage);
  const score = coverage.reduce((sum, area) => sum + area.earned, 0);
  const requiredScore = requiredCoverageScore(dossier);
  const status: QualificationDecision["status"] = disqualifiedByStopRule(dossier)
    ? "disqualified"
    : blockers.length === 0 && score >= requiredScore
      ? "qualified"
      : "review";
  const reasonCodes = unique([
    ...(dossier.completedLeadReport?.leadQualityProfile.reasonCodes ?? []),
    ...dossier.workflow.rules.flatMap((rule) => rule.reasonCodes),
    ...dossier.operatorQueue.reasonCodes,
    ...coverage.map((area) => area.reasonCode),
    status === "qualified" ? "PROMOTION_READY_FOR_SPOT_CHECK" : "PROMOTION_BLOCKED",
  ]);

  return {
    status,
    label: decisionLabel(status),
    promotionEligible: status === "qualified",
    coverageScore: score,
    requiredCoverageScore: requiredScore,
    sourceCoverageStatus: dossier.sourceCoverage.status,
    evidenceSummary: `${plural(dossier.sourceCoverage.extractedAreaCount, "area")} extracted, ${plural(dossier.sourceCoverage.partialAreaCount, "area")} partial, ${plural(dossier.sourceCoverage.blockedAreaCount, "area")} blocked.`,
    reasonCodes,
    blockers,
    nextAction: nextActionFor(dossier, status, blockers),
    coverage,
    reviewedAt: nowIso(),
  };
}

function recordFromLead(lead: DailyLeadResult): QualificationReviewRecord {
  const decision = lead.qualificationDecision;
  return {
    status: decision.status,
    dedupeKey: lead.dedupeKey,
    county: lead.county,
    runId: lead.runId,
    displayName: lead.displayName,
    qualified: lead.qualified,
    leadBucket: lead.leadBucket,
    workflowStatus: lead.workflowStatus,
    operatorQueueState: lead.operatorQueueState,
    coverageScore: decision.coverageScore,
    requiredCoverageScore: decision.requiredCoverageScore,
    reasonCodes: decision.reasonCodes,
    blockers: decision.blockers,
    nextAction: decision.nextAction,
    reportId: lead.reportId,
  };
}

function recordFromDuplicate(duplicate: DailyDuplicateLeadResult): QualificationReviewRecord {
  return {
    status: "duplicate",
    dedupeKey: duplicate.dedupeKey,
    county: duplicate.county,
    runId: duplicate.runId,
    displayName: duplicate.displayName,
    qualified: false,
    reasonCodes: ["DUPLICATE_DEDUPE_KEY"],
    blockers: [duplicate.reason],
    nextAction: duplicate.nextAction,
  };
}

function recordFromDeadLetter(deadLetter: DeadLetter): QualificationReviewRecord {
  return {
    status: "dead_letter",
    dedupeKey: slug(deadLetter.rawId),
    county: "unknown",
    runId: deadLetter.runId,
    displayName: deadLetter.rawId,
    qualified: false,
    reasonCodes: ["SEED_FAILED_BEFORE_REVIEW"],
    blockers: [deadLetter.error],
    nextAction: "Review the failed seed and rerun it only after the input issue is fixed.",
  };
}

function count(records: QualificationReviewRecord[], status: QualificationReviewRecord["status"]): number {
  return records.filter((record) => record.status === status).length;
}

function samples(records: QualificationReviewRecord[], status: QualificationReviewRecord["status"]): QualificationReviewRecord[] {
  return records.filter((record) => record.status === status).slice(0, 3);
}

function summaryFor(records: QualificationReviewRecord[]): QualificationReviewPacket["summary"] {
  const qualified = count(records, "qualified");
  const review = count(records, "review");
  const disqualified = count(records, "disqualified");
  const duplicate = count(records, "duplicate");
  const deadLetter = count(records, "dead_letter");
  return {
    totalRecords: records.length,
    qualified,
    review,
    disqualified,
    duplicate,
    deadLetter,
    blockedFromPromotion: records.length - qualified,
  };
}

function operatorSummary(summary: QualificationReviewPacket["summary"]): string {
  if (summary.qualified === 0) {
    return `No candidates are qualified yet. ${summary.blockedFromPromotion} record(s) remain in review, duplicate, disqualified, or dead-letter status.`;
  }
  return `${summary.qualified} candidate(s) are ready for operator spot-check; ${summary.blockedFromPromotion} record(s) remain blocked from promotion.`;
}

function defaultSettings(leads: DailyLeadResult[], settings?: LeadQualitySettings): QualificationReviewPacket["settings"] {
  const firstDecision = leads[0]?.qualificationDecision;
  return {
    model: settings?.model ?? "heirright-s5-v1",
    requiredCoverageScore: firstDecision?.requiredCoverageScore ?? REQUIRED_COVERAGE_SCORE,
    minEnabledSignalWeightForPromotion: settings?.minEnabledSignalWeightForPromotion ?? 40,
    evidenceGatesCannotBeWeakened: true,
    enabledSignals: settings?.enabledSignals ?? [],
    reasonCodes: settings?.reasonCodes ?? [],
  };
}

export function buildQualificationReviewPacket(input: {
  dailyRunId: string;
  generatedAt: string;
  leads: DailyLeadResult[];
  duplicates: DailyDuplicateLeadResult[];
  deadLetters: DeadLetter[];
  sourceCoverageSummary: SourceCoverageSummary;
  settings?: LeadQualitySettings;
}): QualificationReviewPacket {
  const records = [
    ...input.leads.map(recordFromLead),
    ...input.duplicates.map(recordFromDuplicate),
    ...input.deadLetters.map(recordFromDeadLetter),
  ];
  const summary = summaryFor(records);
  const nextActions = unique(records
    .filter((record) => !record.qualified)
    .map((record) => record.nextAction));

  return {
    id: `qualification-review-${input.dailyRunId}`,
    runId: input.dailyRunId,
    generatedAt: input.generatedAt,
    operatorSummary: operatorSummary(summary),
    settings: defaultSettings(input.leads, input.settings),
    summary,
    sourceCoverageSummary: input.sourceCoverageSummary,
    records,
    samples: {
      qualified: samples(records, "qualified"),
      review: samples(records, "review"),
      disqualified: samples(records, "disqualified"),
      duplicate: samples(records, "duplicate"),
      deadLetter: samples(records, "dead_letter"),
    },
    nextActions,
  };
}

function tableCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "/")
    .replace(/\n/g, " ");
}

function sampleRows(records: QualificationReviewRecord[]): string {
  if (!records.length) return "- None in this run.";
  return [
    "| Lead | County | Score | Reason codes | Next action |",
    "| --- | --- | --- | --- | --- |",
    ...records.map((record) => {
      const score = record.coverageScore === undefined ? "n/a" : `${record.coverageScore}/${record.requiredCoverageScore}`;
      return `| ${tableCell(record.displayName)} | ${tableCell(record.county)} | ${tableCell(score)} | ${tableCell(record.reasonCodes.slice(0, 4).join(", "))} | ${tableCell(record.nextAction)} |`;
    }),
  ].join("\n");
}

function actionList(actions: string[]): string {
  if (!actions.length) return "- None";
  return actions.map((action) => `- ${action}`).join("\n");
}

export function renderQualificationReviewMarkdown(packet: QualificationReviewPacket): string {
  return `# HeirRight Qualification Review Packet

Generated: ${packet.generatedAt}
Run: ${packet.runId}
Status: ${packet.summary.qualified} qualified / ${packet.summary.blockedFromPromotion} blocked from promotion

${packet.operatorSummary}

## Qualification Settings

- Model: ${packet.settings.model}
- Required source coverage score: ${packet.settings.requiredCoverageScore}
- Promotion signal threshold: ${packet.settings.minEnabledSignalWeightForPromotion}
- Evidence gates can be weakened: ${packet.settings.evidenceGatesCannotBeWeakened ? "No" : "Yes"}
- Enabled signals: ${packet.settings.enabledSignals.join(", ") || "None recorded"}

## Batch Summary

- Total records reviewed: ${packet.summary.totalRecords}
- Qualified: ${packet.summary.qualified}
- Review: ${packet.summary.review}
- Disqualified: ${packet.summary.disqualified}
- Duplicates: ${packet.summary.duplicate}
- Dead letters: ${packet.summary.deadLetter}
- Source coverage: ${humanStatus(packet.sourceCoverageSummary.status)} (${packet.sourceCoverageSummary.extractedFieldCount} extracted field(s), ${packet.sourceCoverageSummary.missingFieldCount} missing field(s), ${packet.sourceCoverageSummary.blockedAreaCount} blocked area(s))

## Qualified Samples

${sampleRows(packet.samples.qualified)}

## Review Samples

${sampleRows(packet.samples.review)}

## Disqualified Samples

${sampleRows(packet.samples.disqualified)}

## Duplicate Samples

${sampleRows(packet.samples.duplicate)}

## Dead-Letter Samples

${sampleRows(packet.samples.deadLetter)}

## Next Actions

${actionList(packet.nextActions)}
`;
}
