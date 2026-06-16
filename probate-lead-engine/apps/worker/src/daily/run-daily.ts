import type { DailyLeadResult, DailyRunConfig, DailyRunResult, IntakeSeed, RawDossier, SeedBatchSummary, SourceCoverageSummary } from "@ple/types";
import { runDryPipeline, type RunDryPipelineOptions } from "../index";
import { nowIso, seedIdentity, slug } from "../lib";
import { loadConfiguredSeedBatch } from "./seed-batch";

type RuntimeEnv = Record<string, string | undefined>;

function splitList(value: string | undefined, fallback: string): string[] {
  return String(value || fallback)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultReviewSeeds(counties: string[]): IntakeSeed[] {
  return counties.map((county) => ({
    propertyAddress: county.toLowerCase() === "miami-dade"
      ? "20611 NW 33rd Pl, Miami Gardens, FL 33056"
      : undefined,
    estateName: county.toLowerCase() === "miami-dade" ? undefined : `Daily ${county} estate review seed`,
    ownerName: "Fresh public-source lead",
    county,
    source: "operator_cli",
    seedBatchId: "default-review-seeds",
    seedSourceLabel: "Default review seeds",
    sourceOwner: "Codex Automation",
    approvalMarker: "review_only_not_for_acceptance",
  }));
}

function aggregateCoverageStatus(summary: Omit<SourceCoverageSummary, "status">): SourceCoverageSummary["status"] {
  if (summary.blockedAreaCount > 0 || summary.leadCount === 0) return "blocked";
  if (summary.partialAreaCount > 0) return "partial";
  return "extracted";
}

function summarizeSourceCoverage(leads: DailyLeadResult[]): SourceCoverageSummary {
  const areaMap = new Map<string, { key: SourceCoverageSummary["areaStatuses"][number]["key"]; label: string; extracted: number; partial: number; blocked: number }>();
  let extractedAreaCount = 0;
  let partialAreaCount = 0;
  let blockedAreaCount = 0;
  let extractedFieldCount = 0;
  let missingFieldCount = 0;

  for (const lead of leads) {
    extractedAreaCount += lead.sourceCoverage.extractedAreaCount;
    partialAreaCount += lead.sourceCoverage.partialAreaCount;
    blockedAreaCount += lead.sourceCoverage.blockedAreaCount;
    extractedFieldCount += lead.sourceCoverage.extractedFieldCount;
    missingFieldCount += lead.sourceCoverage.missingFieldCount;
    for (const area of lead.sourceCoverage.areas) {
      const current = areaMap.get(area.key) ?? { key: area.key, label: area.label, extracted: 0, partial: 0, blocked: 0 };
      if (area.status === "extracted") current.extracted += 1;
      if (area.status === "partial") current.partial += 1;
      if (area.status === "blocked") current.blocked += 1;
      areaMap.set(area.key, current);
    }
  }

  const base = {
    leadCount: leads.length,
    extractedAreaCount,
    partialAreaCount,
    blockedAreaCount,
    extractedFieldCount,
    missingFieldCount,
    areaStatuses: Array.from(areaMap.values()),
  };
  return {
    status: aggregateCoverageStatus(base),
    ...base,
  };
}

export function dailyRunConfigFromEnv(env: RuntimeEnv = process.env): DailyRunConfig {
  const counties = splitList(env.DAILY_COUNTIES || env.COUNTY_LIST, "miami-dade,broward").map((county) => county.toLowerCase());
  const seedBatch = loadConfiguredSeedBatch(env);
  const runCounties = seedBatch?.batch.counties.length ? seedBatch.batch.counties : counties;
  const seeds = seedBatch?.acceptedSeeds ?? defaultReviewSeeds(runCounties);
  const summary: SeedBatchSummary | undefined = seedBatch?.batch;
  return {
    counties: runCounties,
    targetRawLeadRange: {
      min: numberFromEnv(env.DAILY_TARGET_RAW_MIN, 200),
      max: numberFromEnv(env.DAILY_TARGET_RAW_MAX, 400),
    },
    targetQualifiedLeadRange: {
      min: numberFromEnv(env.DAILY_TARGET_QUALIFIED_MIN, 80),
      max: numberFromEnv(env.DAILY_TARGET_QUALIFIED_MAX, 150),
    },
    seeds,
    seedSource: seedBatch ? "configured_batch" : "default_review_seeds",
    seedBatch: summary,
    startedBy: "automation",
  };
}

function dedupeKey(dossier: RawDossier): string {
  const caseNumber = dossier.summary.caseNumber;
  const parcelId = dossier.property.parcelId.value;
  const address = dossier.property.address.value;
  const owner = dossier.property.ownerName.value;
  return slug(caseNumber || parcelId || `${address || "unknown-address"}:${owner || "unknown-owner"}`);
}

function qualificationBlockers(dossier: RawDossier): string[] {
  const blockers: string[] = [];
  const profile = dossier.completedLeadReport?.leadQualityProfile;
  if (!profile?.promotionEligible) blockers.push(`Lead bucket is ${profile?.leadBucket ?? "unknown"}, not qualified.`);
  if (dossier.workflow.status !== "continue") blockers.push(`Workflow status is ${dossier.workflow.status}.`);
  if (dossier.operatorQueue.state !== "ready_for_review") blockers.push(`Operator queue is ${dossier.operatorQueue.state}.`);
  if (dossier.audit.reviewFlags.includes("SOURCE_HEALTH_ONLY")) blockers.push("Only source reachability is proven for at least one source.");
  if (dossier.audit.reviewFlags.includes("NO_ENRICHMENT_RUN")) blockers.push("No enrichment/contact run has been approved or completed.");
  if (dossier.completedLeadReport?.missingData.length) blockers.push(`Report has ${dossier.completedLeadReport.missingData.length} missing section(s).`);
  return Array.from(new Set(blockers));
}

function leadResult(dossier: RawDossier): DailyLeadResult {
  const blockers = qualificationBlockers(dossier);
  return {
    dedupeKey: dedupeKey(dossier),
    county: dossier.property.county.value ?? "unknown",
    runId: dossier.runId,
    displayName: dossier.summary.displayName,
    status: dossier.status,
    workflowStatus: dossier.workflow.status,
    operatorQueueState: dossier.operatorQueue.state,
    leadBucket: dossier.completedLeadReport?.leadQualityProfile.leadBucket ?? "review_required",
    qualified: blockers.length === 0,
    blockers,
    reportId: dossier.completedLeadReport?.id,
    sourceCoverage: dossier.sourceCoverage,
  };
}

export async function runDailyProduction(config: DailyRunConfig = dailyRunConfigFromEnv(), options: RunDryPipelineOptions = {}): Promise<DailyRunResult> {
  const generatedAt = nowIso();
  const runId = `daily-${Date.now()}-${slug(config.counties.join("-"))}`;
  const leads: DailyLeadResult[] = [];
  const deadLetters: DailyRunResult["deadLetters"] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  for (const seed of config.seeds) {
    try {
      const result = await runDryPipeline(seed, options);
      const lead = leadResult(result.dossier);
      if (seen.has(lead.dedupeKey)) {
        duplicateCount += 1;
        continue;
      }
      seen.add(lead.dedupeKey);
      leads.push(lead);
    } catch (error) {
      deadLetters.push({
        id: `${runId}:dead-letter:${deadLetters.length + 1}`,
        runId,
        source: "intake",
        rawId: slug(seedIdentity(seed)),
        error: error instanceof Error ? error.message : String(error),
        retryCount: 0,
        createdAt: nowIso(),
      });
    }
  }

  const rawLeadCount = leads.length;
  const qualifiedLeadCount = leads.filter((lead) => lead.qualified).length;
  const reviewLeadCount = leads.filter((lead) => !lead.qualified).length;
  const blockers = Array.from(new Set(leads.flatMap((lead) => lead.blockers)));
  const missedVolumeReasons: string[] = [];
  if (rawLeadCount < config.targetRawLeadRange.min) {
    missedVolumeReasons.push(`Raw lead count ${rawLeadCount} is below target ${config.targetRawLeadRange.min}-${config.targetRawLeadRange.max}.`);
  }
  if (qualifiedLeadCount < config.targetQualifiedLeadRange.min) {
    missedVolumeReasons.push(`Qualified lead count ${qualifiedLeadCount} is below target ${config.targetQualifiedLeadRange.min}-${config.targetQualifiedLeadRange.max}.`);
  }
  if (config.seedSource !== "configured_batch") {
    missedVolumeReasons.push("No production batch seed file was provided; default review seeds do not satisfy contract volume.");
  }
  if (config.seedBatch?.rejectedSeedCount) {
    missedVolumeReasons.push(`${config.seedBatch.rejectedSeedCount} seed(s) were rejected by intake validation before the run.`);
  }
  const sourceCoverageSummary = summarizeSourceCoverage(leads);
  if (sourceCoverageSummary.blockedAreaCount > 0) {
    missedVolumeReasons.push(`${sourceCoverageSummary.blockedAreaCount} source area(s) are still blocked by missing extracted property, tax, deed, probate, or family-tree facts.`);
  }
  if (deadLetters.length) missedVolumeReasons.push(`${deadLetters.length} seed(s) failed and were written to dead letters.`);

  return {
    id: runId,
    generatedAt,
    config,
    rawLeadCount,
    qualifiedLeadCount,
    reviewLeadCount,
    duplicateCount,
    errorCount: deadLetters.length,
    leads,
    deadLetters,
    missedVolumeReasons,
    blockers,
    sourceCoverageSummary,
  };
}
