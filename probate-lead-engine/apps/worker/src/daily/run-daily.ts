import type { DailyDuplicateLeadResult, DailyLeadResult, DailyRunConfig, DailyRunResult, IntakeSeed, LeadQualitySettings, RawDossier, SeedBatchSummary, SourceCoverageBlocker, SourceCoverageSummary } from "@ple/types";
import { runDryPipeline, type RunDryPipelineOptions } from "../index";
import { nowIso, seedIdentity, slug } from "../lib";
import { buildQualificationDecision, buildQualificationReviewPacket, qualificationBlockers } from "../qualification/qualification-review";
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

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
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

function summarizeSourceCoverageBlockers(leads: DailyLeadResult[]): SourceCoverageBlocker[] {
  const blockerMap = new Map<SourceCoverageBlocker["key"], SourceCoverageBlocker & { runIds: Set<string> }>();

  for (const lead of leads) {
    for (const area of lead.sourceCoverage.areas) {
      if (area.status === "extracted") continue;
      const current = blockerMap.get(area.key) ?? {
        key: area.key,
        label: area.label,
        status: area.status === "partial" ? "partial" : "blocked",
        affectedLeadCount: 0,
        capturedFields: [],
        missingFields: [],
        reviewFlags: [],
        nextAction: area.nextAction,
        runIds: new Set<string>(),
      };
      current.status = current.status === "blocked" || area.status === "blocked" ? "blocked" : "partial";
      current.runIds.add(lead.runId);
      current.affectedLeadCount = current.runIds.size;
      current.capturedFields = unique([...current.capturedFields, ...area.extractedFields]).sort();
      current.missingFields = unique([...current.missingFields, ...area.missingFields]).sort();
      current.reviewFlags = unique([...current.reviewFlags, ...area.reviewFlags]).sort();
      blockerMap.set(area.key, current);
    }
  }

  return Array.from(blockerMap.values()).map(({ runIds: _runIds, ...blocker }) => blocker);
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

function leadResult(dossier: RawDossier): DailyLeadResult {
  const blockers = qualificationBlockers(dossier);
  const qualificationDecision = buildQualificationDecision(dossier, blockers);
  dossier.qualificationDecision = qualificationDecision;
  return {
    dedupeKey: dedupeKey(dossier),
    county: dossier.property.county.value ?? "unknown",
    runId: dossier.runId,
    displayName: dossier.summary.displayName,
    status: dossier.status,
    workflowStatus: dossier.workflow.status,
    operatorQueueState: dossier.operatorQueue.state,
    leadBucket: dossier.completedLeadReport?.leadQualityProfile.leadBucket ?? "review_required",
    qualified: qualificationDecision.status === "qualified" && blockers.length === 0,
    blockers,
    reportId: dossier.completedLeadReport?.id,
    sourceCoverage: dossier.sourceCoverage,
    qualificationDecision,
  };
}

export async function runDailyProduction(config: DailyRunConfig = dailyRunConfigFromEnv(), options: RunDryPipelineOptions = {}): Promise<DailyRunResult> {
  const generatedAt = nowIso();
  const runId = `daily-${Date.now()}-${slug(config.counties.join("-"))}`;
  const leads: DailyLeadResult[] = [];
  const duplicates: DailyDuplicateLeadResult[] = [];
  const deadLetters: DailyRunResult["deadLetters"] = [];
  const seen = new Map<string, DailyLeadResult>();
  let settings: LeadQualitySettings | undefined;

  for (const seed of config.seeds) {
    try {
      const result = await runDryPipeline(seed, options);
      settings = settings ?? result.dossier.workflow.leadQuality;
      const lead = leadResult(result.dossier);
      const original = seen.get(lead.dedupeKey);
      if (original) {
        duplicates.push({
          dedupeKey: lead.dedupeKey,
          county: lead.county,
          runId: lead.runId,
          displayName: lead.displayName,
          originalRunId: original.runId,
          reason: "Duplicate dedupe key matched an earlier lead in this daily run.",
          nextAction: "Keep the first packet and suppress this duplicate from qualified counts.",
        });
        continue;
      }
      seen.set(lead.dedupeKey, lead);
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
  const duplicateCount = duplicates.length;
  const blockers = Array.from(new Set(leads.flatMap((lead) => lead.blockers)));
  const missedVolumeReasons: string[] = [];
  if (rawLeadCount < config.targetRawLeadRange.min) {
    missedVolumeReasons.push(`Raw lead count ${rawLeadCount} is below target ${config.targetRawLeadRange.min}-${config.targetRawLeadRange.max}.`);
  }
  if (qualifiedLeadCount < config.targetQualifiedLeadRange.min) {
    missedVolumeReasons.push(`Qualified lead count ${qualifiedLeadCount} is below target ${config.targetQualifiedLeadRange.min}-${config.targetQualifiedLeadRange.max}.`);
  }
  if (config.seedSource === "default_review_seeds") {
    missedVolumeReasons.push("No production batch seed file was provided; default review seeds do not satisfy contract volume.");
  }
  if (config.seedSource === "manual") {
    missedVolumeReasons.push("Manual operator seeds do not satisfy production batch volume until an approved seed file is provided.");
  }
  if (config.seedSource === "external_live_source") {
    missedVolumeReasons.push("Operator-requested live source pulls prove fresh external intake, but still need approved production-volume criteria before contract volume is satisfied.");
  }
  if (config.seedBatch?.rejectedSeedCount) {
    missedVolumeReasons.push(`${config.seedBatch.rejectedSeedCount} seed(s) were rejected by intake validation before the run.`);
  }
  const sourceCoverageSummary = summarizeSourceCoverage(leads);
  const sourceCoverageBlockers = summarizeSourceCoverageBlockers(leads);
  if (sourceCoverageSummary.blockedAreaCount > 0) {
    missedVolumeReasons.push(`${sourceCoverageSummary.blockedAreaCount} source area(s) are still blocked by missing extracted property, tax, deed, probate, or family-tree facts.`);
  }
  if (deadLetters.length) missedVolumeReasons.push(`${deadLetters.length} seed(s) failed and were written to dead letters.`);
  const qualificationReview = buildQualificationReviewPacket({
    dailyRunId: runId,
    generatedAt,
    leads,
    duplicates,
    deadLetters,
    sourceCoverageSummary,
    settings,
  });

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
    duplicates,
    deadLetters,
    missedVolumeReasons,
    blockers,
    sourceCoverageSummary,
    sourceCoverageBlockers,
    qualificationReview,
  };
}
