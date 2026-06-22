import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type { ConfirmedSourceFactInput, FactType, IntakeSeed, ReviewFlag, SeedBatchSummary, SeedValidationIssue, SeedValidationReport } from "@ple/types";
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
const CONFIRMED_SOURCE_FACT_SOURCES = new Set<ConfirmedSourceFactInput["source"]>([
  "clerk_of_courts",
  "property_appraiser",
  "probate_court",
  "tax_collector",
  "official_records",
]);
const CONFIRMED_SOURCE_FACT_TYPES = new Set<FactType>([
  "property_address",
  "property_owner",
  "property_folio",
  "mailing_address_signal",
  "tax_history_status",
  "unpaid_tax_years",
  "tax_amount_due",
  "tax_reassessment_signal",
  "tax_receipt_status",
  "tax_payer_identity",
  "deed_history_status",
  "latest_deed",
  "or_book_page",
  "last_sale_date",
  "ownership_activity_note",
  "mortgage_signal",
  "lien_signal",
  "lis_pendens_signal",
  "foreclosure_signal",
  "adverse_possession_signal",
  "case_number",
  "probate_docket_status",
  "probate_case_status",
  "civil_family_docket_ref",
  "affidavit_of_heirs_status",
  "probate_document_availability",
  "official_record_cross_link",
  "marriage_death_status",
  "marriage_license_signal",
  "date_of_birth",
  "date_of_death",
  "obituary_link",
  "family_tree_status",
  "family_tree_hypothesis",
  "offer_as_is_value",
  "offer_heir_count",
  "offer_buy_percentage",
  "offer_minimum_net_profit",
]);
const BLOCKING_CONFIRMED_SOURCE_FLAGS = new Set<ReviewFlag>(["SOURCE_EVIDENCE_REQUIRED", "SOURCE_HEALTH_ONLY", "SOURCE_BLOCKED"]);

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
  const confirmedSourceFacts = Array.isArray(seed.confirmedSourceFacts) ? seed.confirmedSourceFacts : undefined;
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
    confirmedSourceFacts,
  };
}

function isBlankValue(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function validateConfirmedSourceFacts(facts: unknown, seedIndex: number): SeedValidationIssue[] {
  const issues: SeedValidationIssue[] = [];
  if (facts === undefined) return issues;
  if (!Array.isArray(facts)) {
    issues.push(issue({
      code: "INVALID_CONFIRMED_SOURCE_FACTS",
      message: `Seed ${seedIndex + 1} confirmed source facts must be a list of source-backed field records.`,
      seedIndex,
    }));
    return issues;
  }
  facts.forEach((candidate, factIndex) => {
    const location = `confirmed source fact ${factIndex + 1}`;
    if (!candidate || typeof candidate !== "object") {
      issues.push(issue({
        code: "INVALID_CONFIRMED_SOURCE_FACT",
        message: `Seed ${seedIndex + 1} ${location} must be an object with source, factType, value, and source reference.`,
        seedIndex,
      }));
      return;
    }
    const sourceFact = candidate as Partial<ConfirmedSourceFactInput>;
    if (!CONFIRMED_SOURCE_FACT_SOURCES.has(sourceFact.source as ConfirmedSourceFactInput["source"])) {
      issues.push(issue({
        code: "INVALID_CONFIRMED_SOURCE",
        message: `Seed ${seedIndex + 1} ${location} uses an unsupported source. Use public property, tax, official-record, probate, or clerk sources only.`,
        seedIndex,
      }));
    }
    if (!CONFIRMED_SOURCE_FACT_TYPES.has(sourceFact.factType as FactType)) {
      issues.push(issue({
        code: "INVALID_CONFIRMED_FACT_TYPE",
        message: `Seed ${seedIndex + 1} ${location} uses ${sourceFact.factType}; only deal-flow source fields can be confirmed on seed intake.`,
        seedIndex,
      }));
    }
    if (isBlankValue(sourceFact.value)) {
      issues.push(issue({
        code: "MISSING_CONFIRMED_FACT_VALUE",
        message: `Seed ${seedIndex + 1} ${location} needs a non-empty value before it can count as source evidence.`,
        seedIndex,
      }));
    }
    if (!sourceFact.rawId && !sourceFact.sourceUrl) {
      issues.push(issue({
        code: "MISSING_CONFIRMED_FACT_REFERENCE",
        message: `Seed ${seedIndex + 1} ${location} needs a source URL or record reference such as folio, OR book/page, instrument, docket, or receipt ID.`,
        seedIndex,
      }));
    }
    if (sourceFact.confidence !== undefined && (!Number.isFinite(sourceFact.confidence) || sourceFact.confidence < 0 || sourceFact.confidence > 1)) {
      issues.push(issue({
        code: "INVALID_CONFIRMED_FACT_CONFIDENCE",
        message: `Seed ${seedIndex + 1} ${location} confidence must be between 0 and 1.`,
        seedIndex,
      }));
    }
    const reviewFlags = Array.isArray(sourceFact.reviewFlags) ? sourceFact.reviewFlags : [];
    const blockingFlags = reviewFlags.filter((flag) => BLOCKING_CONFIRMED_SOURCE_FLAGS.has(flag));
    if (blockingFlags.length) {
      issues.push(issue({
        code: "BLOCKED_CONFIRMED_SOURCE_FACT",
        message: `Seed ${seedIndex + 1} ${location} still has blocking source flags (${blockingFlags.join(", ")}); leave it out until the source fact is actually confirmed.`,
        seedIndex,
      }));
    }
  });
  return issues;
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
    seedIssues.push(...validateConfirmedSourceFacts((rawSeed as { confirmedSourceFacts?: unknown }).confirmedSourceFacts, index));

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
