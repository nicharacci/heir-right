import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { IntakeSeed, SeedBatchSummary, SeedValidationIssue, SeedValidationReport } from "@ple/types";
import { nowIso, seedIdentity, slug } from "../lib";

type RuntimeEnv = Record<string, string | undefined>;

interface SeedBatchFile {
  batchId?: string;
  sourceLabel?: string;
  sourceOwner?: string;
  approvalMarker?: string;
  seeds?: Partial<IntakeSeed>[];
}

const APPROVED_PRODUCTION_MARKER = "approved_for_production_batch";
const SUPPORTED_PRODUCTION_COUNTIES = new Set(["miami-dade"]);

function defaultSeedFileCandidates(): string[] {
  const cwd = process.cwd();
  return [
    join(cwd, "apps", "worker", "input", "production-seeds.json"),
    join(cwd, "input", "production-seeds.json"),
  ];
}

function configuredSeedFile(env: RuntimeEnv): string | undefined {
  if (!env.DAILY_RUN_SEEDS_FILE) return undefined;
  return isAbsolute(env.DAILY_RUN_SEEDS_FILE)
    ? env.DAILY_RUN_SEEDS_FILE
    : resolve(process.cwd(), env.DAILY_RUN_SEEDS_FILE);
}

function findSeedFile(env: RuntimeEnv): string | undefined {
  const configured = configuredSeedFile(env);
  if (configured) return configured;
  return defaultSeedFileCandidates().find((candidate) => existsSync(candidate));
}

function normalizeBatchInput(input: unknown, env: RuntimeEnv, inputPath?: string): Required<SeedBatchFile> {
  if (Array.isArray(input)) {
    return {
      batchId: env.DAILY_RUN_BATCH_ID ?? `env-batch-${new Date().toISOString().slice(0, 10)}`,
      sourceLabel: env.DAILY_RUN_SOURCE_LABEL ?? "Operator-provided seed batch",
      sourceOwner: env.DAILY_RUN_SOURCE_OWNER ?? "HeirRight operator",
      approvalMarker: env.DAILY_RUN_APPROVAL_MARKER ?? "",
      seeds: input as Partial<IntakeSeed>[],
    };
  }

  const object = (input ?? {}) as SeedBatchFile;
  return {
    batchId: object.batchId ?? env.DAILY_RUN_BATCH_ID ?? (inputPath ? slug(inputPath) : `seed-batch-${Date.now()}`),
    sourceLabel: object.sourceLabel ?? env.DAILY_RUN_SOURCE_LABEL ?? "",
    sourceOwner: object.sourceOwner ?? env.DAILY_RUN_SOURCE_OWNER ?? "",
    approvalMarker: object.approvalMarker ?? env.DAILY_RUN_APPROVAL_MARKER ?? "",
    seeds: object.seeds ?? [],
  };
}

function seedKey(seed: Partial<IntakeSeed>): string {
  return slug([
    seed.county ?? "unknown-county",
    seed.caseNumber,
    seed.parcelId,
    seed.propertyAddress,
    seed.estateName,
    seed.ownerName,
  ].filter(Boolean).join(":") || "unknown-seed");
}

function issue(input: Omit<SeedValidationIssue, "severity"> & { severity?: SeedValidationIssue["severity"] }): SeedValidationIssue {
  return {
    severity: input.severity ?? "error",
    code: input.code,
    message: input.message,
    seedIndex: input.seedIndex,
  };
}

function hasIdentifier(seed: Partial<IntakeSeed>): boolean {
  return Boolean(seed.estateName || seed.propertyAddress || seed.parcelId || seed.caseNumber);
}

function normalizeSeed(seed: Partial<IntakeSeed>, batch: Required<SeedBatchFile>): IntakeSeed {
  return {
    ownerName: seed.ownerName,
    estateName: seed.estateName,
    propertyAddress: seed.propertyAddress,
    caseNumber: seed.caseNumber,
    county: String(seed.county ?? "").trim().toLowerCase(),
    parcelId: seed.parcelId,
    source: seed.source ?? "operator_cli",
    seedBatchId: batch.batchId,
    seedSourceLabel: seed.seedSourceLabel ?? batch.sourceLabel,
    sourceOwner: seed.sourceOwner ?? batch.sourceOwner,
    approvalMarker: seed.approvalMarker ?? batch.approvalMarker,
  };
}

function summarize(report: Omit<SeedValidationReport, "operatorSummary" | "nextActions">): Pick<SeedValidationReport, "operatorSummary" | "nextActions"> {
  const errors = report.issues.filter((item) => item.severity === "error");
  if (errors.length) {
    return {
      operatorSummary: `Seed batch ${report.batch.batchId} is blocked: ${errors.length} issue(s) must be fixed before it can run as production input.`,
      nextActions: Array.from(new Set(errors.slice(0, 5).map((item) => item.message))),
    };
  }
  return {
    operatorSummary: `Seed batch ${report.batch.batchId} is ready for a production dry run with ${report.batch.acceptedSeedCount} accepted seed(s).`,
    nextActions: report.batch.duplicateCount
      ? ["Review duplicate seed warnings before using volume counts."]
      : ["Run the daily batch and inspect source coverage before claiming qualified lead volume."],
  };
}

export function validateSeedBatchInput(input: unknown, env: RuntimeEnv = {}, inputPath?: string): SeedValidationReport {
  const batch = normalizeBatchInput(input, env, inputPath);
  const issues: SeedValidationIssue[] = [];
  const acceptedSeeds: IntakeSeed[] = [];
  const rejectedSeeds: SeedValidationReport["rejectedSeeds"] = [];
  const seen = new Set<string>();
  let duplicateCount = 0;

  if (!batch.batchId) issues.push(issue({ code: "MISSING_BATCH_ID", message: "Add a batch ID before running production seeds." }));
  if (!batch.sourceLabel) issues.push(issue({ code: "MISSING_SOURCE_LABEL", message: "Add the county/source list name for this batch." }));
  if (!batch.sourceOwner) issues.push(issue({ code: "MISSING_SOURCE_OWNER", message: "Add the person or team that supplied the seed batch." }));
  if (batch.approvalMarker !== APPROVED_PRODUCTION_MARKER) {
    issues.push(issue({
      code: "MISSING_APPROVAL_MARKER",
      message: `Set approvalMarker to ${APPROVED_PRODUCTION_MARKER} after Sam/Joshua approve this batch for production testing.`,
    }));
  }
  if (!batch.seeds.length) issues.push(issue({ code: "EMPTY_BATCH", message: "Add at least one seed before running production intake." }));

  batch.seeds.forEach((rawSeed, index) => {
    const seed = normalizeSeed(rawSeed, batch);
    const seedIssues: SeedValidationIssue[] = [];
    if (!seed.county) {
      seedIssues.push(issue({ code: "MISSING_COUNTY", message: "Every seed needs a county.", seedIndex: index }));
    } else if (!SUPPORTED_PRODUCTION_COUNTIES.has(seed.county)) {
      seedIssues.push(issue({
        code: "UNSUPPORTED_COUNTY",
        message: `Seed county ${seed.county} is not production-supported yet; use Miami-Dade until extraction paths are validated.`,
        seedIndex: index,
      }));
    }
    if (!hasIdentifier(seed)) {
      seedIssues.push(issue({
        code: "MISSING_IDENTIFIER",
        message: "Every seed needs at least one estate name, property address, folio, or case number.",
        seedIndex: index,
      }));
    }
    if (!seed.sourceOwner || !seed.seedSourceLabel || seed.approvalMarker !== APPROVED_PRODUCTION_MARKER) {
      seedIssues.push(issue({
        code: "MISSING_SEED_PROVENANCE",
        message: "Every accepted seed must carry source owner, source label, and production approval marker.",
        seedIndex: index,
      }));
    }

    const dedupeKey = seedKey(seed);
    if (seen.has(dedupeKey)) {
      duplicateCount += 1;
      const duplicate = issue({
        severity: "warning",
        code: "DUPLICATE_SEED",
        message: `Duplicate seed ${seedIdentity(seed)} was removed from the accepted batch.`,
        seedIndex: index,
      });
      issues.push(duplicate);
      rejectedSeeds.push({ seed, issues: [duplicate] });
      return;
    }
    seen.add(dedupeKey);

    if (seedIssues.length) {
      issues.push(...seedIssues);
      rejectedSeeds.push({ seed, issues: seedIssues });
      return;
    }
    acceptedSeeds.push(seed);
  });

  const summary: SeedBatchSummary = {
    batchId: batch.batchId,
    sourceLabel: batch.sourceLabel || "Unlabeled seed batch",
    sourceOwner: batch.sourceOwner || "Unknown source owner",
    approvalMarker: batch.approvalMarker,
    seedCount: batch.seeds.length,
    acceptedSeedCount: acceptedSeeds.length,
    rejectedSeedCount: rejectedSeeds.length,
    duplicateCount,
    counties: Array.from(new Set(acceptedSeeds.map((seed) => seed.county))).sort(),
    inputPath,
  };
  const partialReport = {
    ok: !issues.some((item) => item.severity === "error"),
    generatedAt: nowIso(),
    batch: summary,
    issues,
    acceptedSeeds,
    rejectedSeeds,
  };
  return {
    ...partialReport,
    ...summarize(partialReport),
  };
}

export function loadConfiguredSeedBatch(env: RuntimeEnv = process.env): SeedValidationReport | null {
  if (env.DAILY_RUN_SEEDS_JSON) {
    const report = validateSeedBatchInput(JSON.parse(env.DAILY_RUN_SEEDS_JSON), env, "DAILY_RUN_SEEDS_JSON");
    if (!report.ok) throw new Error(`Production seed batch rejected: ${report.operatorSummary}`);
    return report;
  }

  const inputPath = findSeedFile(env);
  if (!inputPath) return null;
  if (!existsSync(inputPath)) throw new Error(`Production seed file not found: ${inputPath}`);

  const report = validateSeedBatchInput(JSON.parse(readFileSync(inputPath, "utf8")), env, inputPath);
  if (!report.ok) throw new Error(`Production seed batch rejected: ${report.operatorSummary}`);
  return report;
}

export function renderSeedValidationReportMarkdown(report: SeedValidationReport): string {
  const issueLines = report.issues.length
    ? report.issues.map((item) => `- ${item.severity.toUpperCase()} ${item.code}${item.seedIndex === undefined ? "" : ` seed ${item.seedIndex + 1}`}: ${item.message}`).join("\n")
    : "- None";
  const nextActions = report.nextActions.length ? report.nextActions.map((item) => `- ${item}`).join("\n") : "- None";
  return `# HeirRight Seed Import Report

Generated: ${report.generatedAt}
Status: ${report.ok ? "Ready for production dry run" : "Blocked"}

${report.operatorSummary}

## Batch

- Batch ID: ${report.batch.batchId}
- Source list: ${report.batch.sourceLabel}
- Source owner: ${report.batch.sourceOwner}
- Approval marker: ${report.batch.approvalMarker || "missing"}
- Accepted seeds: ${report.batch.acceptedSeedCount}
- Rejected seeds: ${report.batch.rejectedSeedCount}
- Duplicates removed: ${report.batch.duplicateCount}
- Counties: ${report.batch.counties.length ? report.batch.counties.join(", ") : "none accepted"}
- Input: ${report.batch.inputPath ?? "inline JSON"}

## Issues

${issueLines}

## Next Actions

${nextActions}
`;
}
