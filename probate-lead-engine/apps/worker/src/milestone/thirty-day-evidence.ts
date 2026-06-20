import type {
  ConnectionStatus,
  DailyRunConfig,
  DailyRunResult,
  ExportResult,
  ExportRouteResult,
  MilestoneEvidenceGate,
  MilestoneEvidenceGateStatus,
  RawDossier,
  ThirtyDayMilestoneEvidence,
} from "@ple/types";
import { dailyRunConfigFromEnv, runDailyProduction } from "../daily/run-daily";
import { connectionStatuses, exportCompletedReport } from "../export/export-package";
import { PODIO_LIVE_WRITE_APPROVAL_KEY } from "../export/podio-config";
import { runDryPipeline, type RunDryPipelineOptions } from "../index";
import { nowIso } from "../lib";
import { buildReadbackEvidencePacket } from "../readback/readback-evidence";

type RuntimeEnv = Record<string, string | undefined>;

function rangeLabel(range: { min: number; max: number }): string {
  return `${range.min}-${range.max}`;
}

function inRange(value: number, range: { min: number; max: number }): boolean {
  return value >= range.min && value <= range.max;
}

function gate(input: {
  id: string;
  label: string;
  status: MilestoneEvidenceGateStatus;
  evidence: string;
  nextAction: string;
  blockers?: string[];
}): MilestoneEvidenceGate {
  return {
    blockers: input.blockers ?? [],
    ...input,
  };
}

function dryRunExportEnv(env: RuntimeEnv): RuntimeEnv {
  return {
    ...env,
    GOOGLE_WORKSPACE_ACCESS_TOKEN: env.GOOGLE_WORKSPACE_ACCESS_TOKEN ?? "dry-run-google-token",
    GOOGLE_TRACKING_SHEET_ID: env.GOOGLE_TRACKING_SHEET_ID ?? "dry-run-sheet",
    PODIO_ACCESS_TOKEN: env.PODIO_ACCESS_TOKEN ?? "dry-run-podio-token",
    PODIO_APP_ID: env.PODIO_APP_ID ?? "dry-run-app",
    PODIO_FIELD_MAP_JSON: env.PODIO_FIELD_MAP_JSON ?? JSON.stringify({
      title: "title",
      property_address: "property_address",
      county: "county",
      lead_bucket: "lead_bucket",
      report_link: "report_link",
    }),
  };
}

function routeFor(exportResult: ExportResult, routeName: ExportRouteResult["route"]): ExportRouteResult | undefined {
  return exportResult.routes.find((route) => route.route === routeName);
}

function connectionFor(statuses: ConnectionStatus[], name: ConnectionStatus["name"]): ConnectionStatus | undefined {
  return statuses.find((status) => status.name === name);
}

function podioLiveReadbackReady(status: ConnectionStatus | undefined, env: RuntimeEnv): boolean {
  return Boolean(status?.ok && status.mode === "live" && env[PODIO_LIVE_WRITE_APPROVAL_KEY] === "true");
}

function liveReadbackBlocker(status: ConnectionStatus | undefined, fallback: string): string[] {
  if (!status) return [fallback];
  return status.ok ? [status.message] : [status.message];
}

function qualificationIntegrityPassed(dailyRun: DailyRunResult): boolean {
  return dailyRun.leads.every((lead) => !lead.qualified || lead.blockers.length === 0);
}

function noExternalUseGuardPassed(dossier: RawDossier): boolean {
  return Boolean(dossier.completedLeadReport?.reviewGate.externalUseBlocked && dossier.outreach.noAutoSendGuard.enabled);
}

function buildGates(input: {
  dailyRun: DailyRunResult;
  dryExport: ExportResult;
  connectionStatuses: ConnectionStatus[];
  dossier: RawDossier;
  env: RuntimeEnv;
}): MilestoneEvidenceGate[] {
  const googleDry = routeFor(input.dryExport, "google");
  const podioDry = routeFor(input.dryExport, "podio");
  const googleStatus = connectionFor(input.connectionStatuses, "Google");
  const podioStatus = connectionFor(input.connectionStatuses, "Podio");
  const rawTarget = input.dailyRun.config.targetRawLeadRange;
  const qualifiedTarget = input.dailyRun.config.targetQualifiedLeadRange;
  const productionSeedReady = input.dailyRun.config.seedSource === "configured_batch";
  const rawVolumeReady = inRange(input.dailyRun.rawLeadCount, rawTarget);
  const qualifiedVolumeReady = inRange(input.dailyRun.qualifiedLeadCount, qualifiedTarget);
  const podioReady = podioLiveReadbackReady(podioStatus, input.env);
  const googleReady = Boolean(googleStatus?.ok && googleStatus.mode === "live");
  const sourceCoverageReady = input.dailyRun.sourceCoverageSummary.extractedFieldCount > 0
    && input.dailyRun.sourceCoverageSummary.blockedAreaCount === 0;
  const sourceCoverageBlockerLabels = input.dailyRun.sourceCoverageBlockers.map((item) => item.label).join(", ");

  return [
    gate({
      id: "production_seed_batch",
      label: "Production county seed batch",
      status: productionSeedReady ? "passed" : "blocked",
      evidence: productionSeedReady
        ? "The daily run used a configured production batch."
        : "The daily run used default review seeds, not an approved production county batch.",
      nextAction: productionSeedReady
        ? "Keep the approved batch attached to the acceptance record."
        : "Load an approved production county seed batch before claiming contract volume.",
      blockers: productionSeedReady ? [] : ["No production county seed batch was provided."],
    }),
    gate({
      id: "raw_lead_volume",
      label: "Raw lead volume",
      status: rawVolumeReady ? "passed" : "blocked",
      evidence: `${input.dailyRun.rawLeadCount} raw lead(s) found; target is ${rangeLabel(rawTarget)}.`,
      nextAction: rawVolumeReady
        ? "Review the raw lead list for duplicates and source gaps."
        : "Run a production county batch large enough to reach the 30-Day raw lead target.",
      blockers: rawVolumeReady ? [] : [`Raw lead count is outside the ${rangeLabel(rawTarget)} target.`],
    }),
    gate({
      id: "qualified_lead_volume",
      label: "Qualified lead volume",
      status: qualifiedVolumeReady ? "passed" : "blocked",
      evidence: `${input.dailyRun.qualifiedLeadCount} qualified lead(s) found; target is ${rangeLabel(qualifiedTarget)}.`,
      nextAction: qualifiedVolumeReady
        ? "Spot-check qualified reports before Sam acceptance."
        : "Resolve review flags and run approved source evidence before counting leads as qualified.",
      blockers: qualifiedVolumeReady ? [] : [`Qualified lead count is outside the ${rangeLabel(qualifiedTarget)} target.`],
    }),
    gate({
      id: "qualification_integrity",
      label: "Qualification integrity",
      status: qualificationIntegrityPassed(input.dailyRun) ? "passed" : "blocked",
      evidence: qualificationIntegrityPassed(input.dailyRun)
        ? "No lead with open blockers was counted as qualified."
        : "At least one lead with open blockers was counted as qualified.",
      nextAction: qualificationIntegrityPassed(input.dailyRun)
        ? "Keep generic seeds in review until source evidence converges."
        : "Fix qualification rules before acceptance review.",
      blockers: qualificationIntegrityPassed(input.dailyRun) ? [] : ["Blocked or generic review leads are being counted as qualified."],
    }),
    gate({
      id: "structured_source_coverage",
      label: "Structured source coverage",
      status: sourceCoverageReady ? "passed" : "blocked",
      evidence: [
        `${input.dailyRun.sourceCoverageSummary.extractedFieldCount} extracted source field(s), ${input.dailyRun.sourceCoverageSummary.missingFieldCount} missing field(s), ${input.dailyRun.sourceCoverageSummary.blockedAreaCount} blocked source area(s).`,
        sourceCoverageBlockerLabels ? `Blocked areas: ${sourceCoverageBlockerLabels}.` : "",
      ].filter(Boolean).join(" "),
      nextAction: sourceCoverageReady
        ? "Spot-check extracted fields against county source links before acceptance review."
        : "Pull the source records listed in the Source Coverage Blockers section before using the run as acceptance evidence.",
      blockers: sourceCoverageReady ? [] : ["Source coverage still depends on missing facts, source-health checks, or intake placeholders."],
    }),
    gate({
      id: "dead_letters_duplicates",
      label: "Dead letters and duplicate handling",
      status: input.dailyRun.errorCount === 0 ? "passed" : "blocked",
      evidence: `${input.dailyRun.errorCount} dead letter(s), ${input.dailyRun.duplicateCount} duplicate(s).`,
      nextAction: input.dailyRun.errorCount === 0
        ? "Keep duplicate counts visible in the acceptance packet."
        : "Review failed seeds before using the run for milestone evidence.",
      blockers: input.dailyRun.errorCount === 0 ? [] : [`${input.dailyRun.errorCount} seed(s) failed.`],
    }),
    gate({
      id: "google_dry_handoff",
      label: "Google handoff route",
      status: googleDry?.ok ? "passed" : "blocked",
      evidence: googleDry?.message ?? "Google handoff route did not return evidence.",
      nextAction: googleDry?.ok
        ? "Configure the approved Workspace destination for live readback."
        : "Fix the Google handoff route before acceptance review.",
      blockers: googleDry?.ok ? [] : (googleDry?.blockers.length ? googleDry.blockers : ["Google dry handoff failed."]),
    }),
    gate({
      id: "podio_dry_handoff",
      label: "Podio handoff route",
      status: podioDry?.ok ? "passed" : "blocked",
      evidence: podioDry?.message ?? "Podio handoff route did not return evidence.",
      nextAction: podioDry?.ok
        ? "Configure Podio access and controlled test values for live readback."
        : "Fix the Podio handoff route before acceptance review.",
      blockers: podioDry?.ok ? [] : (podioDry?.blockers.length ? podioDry.blockers : ["Podio dry handoff failed."]),
    }),
    gate({
      id: "google_live_readback",
      label: "Google live readback",
      status: googleReady ? "passed" : "blocked",
      evidence: googleStatus?.message ?? "Google connection status was not available.",
      nextAction: googleReady
        ? "Run one approved live Google export/readback before acceptance."
        : "Add Workspace access, target Sheet/Drive/Docs config, and approval for the controlled readback test.",
      blockers: googleReady ? [] : liveReadbackBlocker(googleStatus, "Google connection status is missing."),
    }),
    gate({
      id: "podio_live_readback",
      label: "Podio live readback",
      status: podioReady ? "passed" : "blocked",
      evidence: podioStatus?.message ?? "Podio connection status was not available.",
      nextAction: podioReady
        ? "Run one approved controlled Podio write/readback before acceptance."
        : "Add Podio bearer-token config, controlled test values, and explicit write approval.",
      blockers: podioReady ? [] : [
        ...liveReadbackBlocker(podioStatus, "Podio connection status is missing."),
        ...(input.env[PODIO_LIVE_WRITE_APPROVAL_KEY] === "true" ? [] : [`${PODIO_LIVE_WRITE_APPROVAL_KEY}=true is not present.`]),
      ],
    }),
    gate({
      id: "external_use_guard",
      label: "External use guard",
      status: noExternalUseGuardPassed(input.dossier) ? "passed" : "blocked",
      evidence: noExternalUseGuardPassed(input.dossier)
        ? "Completed reports and outreach remain blocked from external use until review."
        : "External-use or no-auto-send guard is missing.",
      nextAction: noExternalUseGuardPassed(input.dossier)
        ? "Keep outreach and offer language internal until Sam approves."
        : "Restore the external-use and no-auto-send guards.",
      blockers: noExternalUseGuardPassed(input.dossier) ? [] : ["External-use guard is missing from the report or outreach workflow."],
    }),
  ];
}

function summaryFor(gates: MilestoneEvidenceGate[], dailyRun: DailyRunResult): string {
  const blocked = gates.filter((item) => item.status === "blocked");
  if (blocked.length) {
    return [
      "Not ready for 30-Day acceptance.",
      `Latest run has ${dailyRun.rawLeadCount} raw lead(s), ${dailyRun.qualifiedLeadCount} qualified lead(s), and ${blocked.length} blocked acceptance gate(s).`,
    ].join(" ");
  }
  return "Ready for Sam's 30-Day acceptance review. Volume, qualification integrity, handoff routes, and live readback gates have evidence.";
}

function nextActionsFor(gates: MilestoneEvidenceGate[]): string[] {
  return gates
    .filter((item) => item.status !== "passed")
    .map((item) => item.nextAction);
}

export async function generateThirtyDayMilestoneEvidence(
  env: RuntimeEnv = process.env,
  options: RunDryPipelineOptions = {},
): Promise<ThirtyDayMilestoneEvidence> {
  const dailyConfig: DailyRunConfig = dailyRunConfigFromEnv(env);
  const dailyRun = await runDailyProduction(dailyConfig, options);
  const pipeline = await runDryPipeline(undefined, options);
  const dryExport = await exportCompletedReport({
    routes: ["google", "podio"],
    dossier: pipeline.dossier,
    dryRun: true,
  }, dryRunExportEnv(env));
  const statuses = await connectionStatuses(env);
  const readbackEvidence = buildReadbackEvidencePacket(dryExport, statuses);
  const gates = buildGates({
    dailyRun,
    dryExport,
    connectionStatuses: statuses,
    dossier: pipeline.dossier,
    env,
  });
  const blockers = Array.from(new Set(gates.flatMap((item) => item.blockers)));
  const overallStatus = gates.some((item) => item.status === "blocked") ? "blocked" : "ready_for_human_review";

  return {
    milestone: "30-Day Workflow Automation Milestone",
    generatedAt: nowIso(),
    overallStatus,
    operatorSummary: summaryFor(gates, dailyRun),
    dailyRun: {
      id: dailyRun.id,
      seedSource: dailyRun.config.seedSource,
      counties: dailyRun.config.counties,
      rawLeadCount: dailyRun.rawLeadCount,
      rawLeadTarget: dailyRun.config.targetRawLeadRange,
      qualifiedLeadCount: dailyRun.qualifiedLeadCount,
      qualifiedLeadTarget: dailyRun.config.targetQualifiedLeadRange,
      reviewLeadCount: dailyRun.reviewLeadCount,
      duplicateCount: dailyRun.duplicateCount,
      errorCount: dailyRun.errorCount,
      missedVolumeReasons: dailyRun.missedVolumeReasons,
      seedBatch: dailyRun.config.seedBatch,
      sourceCoverageSummary: dailyRun.sourceCoverageSummary,
      sourceCoverageBlockers: dailyRun.sourceCoverageBlockers,
      qualificationReviewSummary: dailyRun.qualificationReview.summary,
    },
    exportReadiness: {
      connectionStatuses: statuses,
      dryRunRoutes: dryExport.routes,
      readbackEvidence,
    },
    gates,
    blockers,
    nextActions: nextActionsFor(gates),
  };
}

function statusLabel(status: MilestoneEvidenceGateStatus): string {
  if (status === "passed") return "Passed";
  if (status === "review_required") return "Review required";
  return "Blocked";
}

function bulletList(items: string[]): string {
  if (!items.length) return "- None";
  return items.map((item) => `- ${item}`).join("\n");
}

function sourceCoverageBlockerList(blockers: ThirtyDayMilestoneEvidence["dailyRun"]["sourceCoverageBlockers"]): string {
  if (!blockers.length) return "- None";
  return blockers.map((blocker) => [
    `- ${blocker.label}: ${blocker.affectedLeadCount} lead(s) affected.`,
    `  Missing: ${blocker.missingFields.join(", ") || "none"}.`,
    `  Next: ${blocker.nextAction}`,
  ].join("\n")).join("\n");
}

export function renderThirtyDayMilestoneEvidenceMarkdown(evidence: ThirtyDayMilestoneEvidence): string {
  const gateRows = evidence.gates
    .map((item) => `| ${item.label} | ${statusLabel(item.status)} | ${item.evidence.replace(/\|/g, "/")} | ${item.nextAction.replace(/\|/g, "/")} |`)
    .join("\n");
  return `# HeirRight 30-Day Milestone Evidence

Generated: ${evidence.generatedAt}
Status: ${evidence.overallStatus === "blocked" ? "Blocked" : "Ready for human review"}

${evidence.operatorSummary}

## Latest Daily Run

- Run: ${evidence.dailyRun.id}
- Counties: ${evidence.dailyRun.counties.join(", ")}
- Seed source: ${evidence.dailyRun.seedSource}
- Raw leads: ${evidence.dailyRun.rawLeadCount} of target ${rangeLabel(evidence.dailyRun.rawLeadTarget)}
- Qualified leads: ${evidence.dailyRun.qualifiedLeadCount} of target ${rangeLabel(evidence.dailyRun.qualifiedLeadTarget)}
- Review leads: ${evidence.dailyRun.reviewLeadCount}
- Duplicates: ${evidence.dailyRun.duplicateCount}
- Dead letters: ${evidence.dailyRun.errorCount}
- Source coverage: ${evidence.dailyRun.sourceCoverageSummary.extractedFieldCount} extracted field(s), ${evidence.dailyRun.sourceCoverageSummary.missingFieldCount} missing field(s), ${evidence.dailyRun.sourceCoverageSummary.blockedAreaCount} blocked area(s)
- Qualification review: ${evidence.dailyRun.qualificationReviewSummary.qualified} qualified, ${evidence.dailyRun.qualificationReviewSummary.review} review, ${evidence.dailyRun.qualificationReviewSummary.disqualified} disqualified, ${evidence.dailyRun.qualificationReviewSummary.duplicate} duplicate, ${evidence.dailyRun.qualificationReviewSummary.deadLetter} dead-letter
- Google/Podio readback: ${evidence.exportReadiness.readbackEvidence.overallStatus === "passed" ? "passed" : "blocked"}
${evidence.dailyRun.seedBatch ? `- Seed batch: ${evidence.dailyRun.seedBatch.batchId} (${evidence.dailyRun.seedBatch.acceptedSeedCount} accepted, ${evidence.dailyRun.seedBatch.rejectedSeedCount} rejected)` : ""}

## Source Coverage Blockers

${sourceCoverageBlockerList(evidence.dailyRun.sourceCoverageBlockers)}

## Acceptance Gates

| Gate | Status | Evidence | Next action |
| --- | --- | --- | --- |
${gateRows}

## Current Blockers

${bulletList(evidence.blockers)}

## Google + Podio Readback

${evidence.exportReadiness.readbackEvidence.operatorSummary}

${bulletList(evidence.exportReadiness.readbackEvidence.nextActions)}

## Missed Volume Reasons

${bulletList(evidence.dailyRun.missedVolumeReasons)}

## Next Actions

${bulletList(evidence.nextActions)}
`;
}

function reviewAgendaStatus(evidence: ThirtyDayMilestoneEvidence): string {
  if (evidence.overallStatus === "ready_for_human_review") {
    return "Ready for Sam and Joshua to spot-check before acceptance.";
  }
  return "Not ready for acceptance yet. The review should focus on the decisions that unblock a real production run.";
}

function reviewDecisionList(evidence: ThirtyDayMilestoneEvidence): string[] {
  const decisions: string[] = [];
  if (evidence.dailyRun.seedSource !== "configured_batch") {
    decisions.push("Provide or approve the first production seed batch for the county run.");
  }
  if (evidence.dailyRun.qualifiedLeadCount < evidence.dailyRun.qualifiedLeadTarget.min) {
    decisions.push("Decide whether the next pass should prioritize source records for property, taxes, deed/title, probate, and heirs before expanding volume.");
  }
  const google = evidence.gates.find((gate) => gate.id === "google_live_readback");
  if (google?.status !== "passed") {
    decisions.push("Choose when to provide the approved Google Workspace destination for one controlled readback.");
  }
  const podio = evidence.gates.find((gate) => gate.id === "podio_live_readback");
  if (podio?.status !== "passed") {
    decisions.push("Choose whether to approve one clearly labeled Podio test item and readback.");
  }
  if (!decisions.length) {
    decisions.push("Confirm whether the 30-Day Workflow Automation Milestone is accepted.");
  }
  return Array.from(new Set(decisions));
}

function reviewProofList(evidence: ThirtyDayMilestoneEvidence): string[] {
  return [
    `${evidence.dailyRun.rawLeadCount} raw lead(s) were reviewed against a target of ${rangeLabel(evidence.dailyRun.rawLeadTarget)}.`,
    `${evidence.dailyRun.qualifiedLeadCount} qualified lead(s) were counted against a target of ${rangeLabel(evidence.dailyRun.qualifiedLeadTarget)}.`,
    `${evidence.dailyRun.reviewLeadCount} lead(s) remain in review, with ${evidence.dailyRun.duplicateCount} duplicate(s) and ${evidence.dailyRun.errorCount} dead-letter item(s).`,
    `${evidence.dailyRun.sourceCoverageSummary.extractedFieldCount} source field(s) are captured; ${evidence.dailyRun.sourceCoverageSummary.blockedAreaCount} source area(s) still need records.`,
    `${evidence.dailyRun.qualificationReviewSummary.qualified} candidate(s) are ready for spot-check and ${evidence.dailyRun.qualificationReviewSummary.blockedFromPromotion} are blocked from promotion.`,
  ];
}

function sourceCoverageReviewList(evidence: ThirtyDayMilestoneEvidence): string[] {
  if (!evidence.dailyRun.sourceCoverageBlockers.length) {
    return ["No source coverage blocker is open in the latest packet."];
  }
  return evidence.dailyRun.sourceCoverageBlockers.map((blocker) => {
    const fields = blocker.missingFields.slice(0, 4).join(", ");
    return `${blocker.label}: pull ${fields || "the missing source facts"} for ${blocker.affectedLeadCount} lead(s).`;
  });
}

export function renderThirtyDayClientReviewScriptMarkdown(evidence: ThirtyDayMilestoneEvidence): string {
  return `# HeirRight 30-Day Review Agenda

Generated: ${evidence.generatedAt}
Status: ${reviewAgendaStatus(evidence)}

## 30-Minute Agenda

- 0-5 minutes: Confirm the latest property and estate seed source.
- 5-12 minutes: Review raw, review, duplicate, and qualified counts.
- 12-20 minutes: Check the property, deed/title, tax, probate, heir, and offer facts still missing.
- 20-25 minutes: Decide whether Google and Podio controlled readback tests are approved.
- 25-30 minutes: Choose the next move: approve the milestone, keep gathering records, or run a larger approved seed batch.

## What Is Automated Now

- Intake can load approved county seed batches and reject incomplete seeds.
- The lead engine separates review candidates, duplicates, dead letters, disqualified leads, and qualified candidates.
- The qualification packet explains source coverage, reason codes, report gaps, and the next operator action.
- Completed reports and follow-up language remain blocked from outside use until review.

## What Remains Manual

- Approved production seed selection.
- Property, deed/title, tax, probate, heir, and offer fact spot-checking where source coverage is missing.
- Paid or manual research paths such as skip tracing, ancestry, obituary, and voter/license checks.
- Live Google and Podio readback approval before the handoff loop can be treated as live.

## Current Proof

${bulletList(reviewProofList(evidence))}

## Records To Pull Next

${bulletList(sourceCoverageReviewList(evidence))}

## Decisions For Sam And Joshua

${bulletList(reviewDecisionList(evidence))}

## Recommended Close

${evidence.overallStatus === "ready_for_human_review"
    ? "Accept the milestone after spot-checking the qualified samples and confirming no outreach or legal claim is sent without approval."
    : "Keep the milestone blocked until an approved seed batch, stronger source coverage, qualified volume, and controlled Google/Podio readback are all present."}
`;
}
