import { existsSync } from "node:fs";
import type { SourceFact, SourceKey, SourceSubject } from "@ple/types";
import { runDailyProduction } from "../daily/run-daily";
import { validateSeedBatchInput } from "../daily/seed-batch";
import { buildRawDossier } from "../dossier/build-raw-dossier";
import { connectionStatuses, exportCompletedReport } from "../export/export-package";
import { PODIO_LIVE_WRITE_APPROVAL_KEY, TEXAS_EQUITY_PROS_LEADS_APP_ID } from "../export/podio-config";
import { runDryPipeline } from "../index";
import { fact, nowIso } from "../lib";
import { generateThirtyDayMilestoneEvidence, renderThirtyDayClientReviewScriptMarkdown, renderThirtyDayMilestoneEvidenceMarkdown } from "../milestone/thirty-day-evidence";
import { renderQualificationReviewMarkdown } from "../qualification/qualification-review";
import { buildReadbackEvidencePacket, renderReadbackEvidenceMarkdown } from "../readback/readback-evidence";
import { persistOutput } from "../storage/write-output";

function fixtureFact(input: {
  runId: string;
  rawId: string;
  source?: SourceKey;
  factType: SourceFact["factType"];
  value: unknown;
  subject: SourceSubject;
  reviewFlags?: SourceFact["reviewFlags"];
}): SourceFact {
  return fact({
    runId: input.runId,
    source: input.source ?? "property_appraiser",
    rawId: input.rawId,
    fetchedAt: nowIso(),
    county: input.subject.county ?? "miami-dade",
    subject: input.subject,
    factType: input.factType,
    value: input.value,
    confidence: input.value === null ? 0 : 0.95,
    sourceUrl: "validation://s5-fixture",
    reviewFlags: input.reviewFlags ?? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
  });
}

function buildS5FixtureDossier(input: {
  runId: string;
  ownerName: string;
  ownerType: string;
  lastSaleDate?: string | null;
}) {
  const subject: SourceSubject = {
    ownerName: input.ownerName,
    propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    county: "miami-dade",
  };
  const facts = [
    fixtureFact({ runId: input.runId, rawId: `${input.runId}:address`, factType: "property_address", value: subject.propertyAddress, subject }),
    fixtureFact({ runId: input.runId, rawId: `${input.runId}:owner`, factType: "property_owner", value: input.ownerName, subject }),
    fixtureFact({ runId: input.runId, rawId: `${input.runId}:owner-type`, factType: "owner_type", value: input.ownerType, subject }),
    fixtureFact({ runId: input.runId, rawId: `${input.runId}:county`, factType: "property_county", value: "miami-dade", subject }),
    fixtureFact({
      runId: input.runId,
      rawId: `${input.runId}:last-sale-date`,
      source: "official_records",
      factType: "last_sale_date",
      value: input.lastSaleDate ?? null,
      subject,
      reviewFlags: input.lastSaleDate ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_RECENT_SALE_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    }),
  ];
  return buildRawDossier(input.runId, facts);
}

async function main(): Promise<void> {
  const result = await runDryPipeline({
    propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    ownerName: "Fresh public-source validation lead",
    county: "miami-dade",
    source: "operator_cli",
  });
  for (const output of Object.values(result.outputFiles)) persistOutput(output);

  const failures: string[] = [];
  if (!result.facts.length) failures.push("No source facts generated.");
  if (!result.dossier.property.address.value) failures.push("Dossier address missing.");
  if (!result.dossier.audit.sourceRefs.length) failures.push("Dossier sourceRefs missing.");
  if (!result.dossier.crm.payload) failures.push("Podio dry-run payload missing.");
  if (!result.dossier.documentPacket?.formats.markdown) failures.push("Internal summary markdown missing.");
  if (!result.dossier.documentPacket?.formats.html.includes("streamdown-doc")) failures.push("Streamdown HTML output missing.");
  if (result.dossier.documentPacket?.renderer !== "streamdown") failures.push("Document packet renderer is not Streamdown.");
  if (!result.dossier.completedLeadReport?.formats.markdown.includes("Completed Lead Report")) failures.push("Completed lead report markdown missing.");
  if (!result.dossier.completedLeadReport?.formats.markdown.includes("Date added:")) failures.push("Completed lead report date-added line missing.");
  if (!result.dossier.completedLeadReport?.formats.markdown.includes("Client Report Snapshot")) failures.push("Completed lead report client snapshot missing.");
  if (!result.dossier.completedLeadReport?.formats.html.includes("Internal draft")) failures.push("Completed lead report review banner missing.");
  if (!result.dossier.completedLeadReport?.reviewGate.externalUseBlocked) failures.push("Completed lead report external-use gate missing.");
  if (!result.dossier.completedLeadReport?.offerMath.reviewFlags.includes("UNDERWRITING_REVIEW_REQUIRED")) failures.push("Offer math underwriting review flag missing.");
  if (!result.dossier.completedLeadReport?.researchChecklist.length) failures.push("Completed lead report research checklist missing.");
  if (!result.dossier.completedLeadReport?.leadQualityProfile.leadBucket) failures.push("Lead quality profile bucket missing.");
  if (!result.facts.some((item) => item.factType === "offer_buy_percentage")) failures.push("Offer buy percentage fact missing.");
  if (!result.facts.some((item) => item.factType === "offer_minimum_net_profit")) failures.push("Offer minimum net profit fact missing.");
  const podioOffer = (result.dossier.crm.payload as { appModel?: { fields?: { offer_math?: unknown; lead_bucket?: unknown; outreach_readiness?: unknown } } })?.appModel?.fields;
  if (!podioOffer?.offer_math) failures.push("Podio offer_math payload missing.");
  if (!podioOffer?.lead_bucket) failures.push("Podio lead_bucket payload missing.");
  if (!podioOffer?.outreach_readiness) failures.push("Podio outreach_readiness payload missing.");
  if (!result.dossier.outreach?.assets.length) failures.push("S8 outreach draft assets missing.");
  if (result.dossier.outreach.assets.length < 9) failures.push("S8 outreach script inventory incomplete.");
  if (result.dossier.outreach.assets.some((asset) => asset.status !== "draft" && asset.status !== "needs_compliance_review")) failures.push("S8 outreach asset escaped draft/review status.");
  if (result.dossier.outreach.assets.some((asset) => asset.automationAllowed || asset.externalUseAllowed)) failures.push("S8 outreach asset incorrectly allows automation or external use.");
  if (result.dossier.outreach.complianceStatus !== "needs_compliance_review") failures.push("S8 compliance status should require review.");
  if (!result.dossier.outreach.noAutoSendGuard.enabled) failures.push("S8 no-auto-send guard missing.");
  for (const blocked of ["call", "voicemail", "text", "email", "letter"] as const) {
    if (!result.dossier.outreach.noAutoSendGuard.blockedActions.includes(blocked)) failures.push(`S8 no-auto-send guard missing ${blocked}.`);
  }
  if (result.dossier.outreach.readiness.status !== "blocked") failures.push("S8 outreach readiness should be blocked before approvals.");
  if (!result.dossier.outreach.readiness.reviewFlags.includes("COMPLIANCE_REVIEW_REQUIRED")) failures.push("S8 compliance review flag missing.");
  if (!result.dossier.outreach.readiness.reviewFlags.includes("CONTACT_REVIEW_REQUIRED")) failures.push("S8 contact review flag missing.");
  const followUps = result.dossier.outreach.followUpTasks;
  if (followUps.filter((task) => task.channel === "call" && task.attemptNumber !== null).length < 3) failures.push("S8 three-call follow-up pattern missing.");
  if (!followUps.some((task) => task.id === "voicemail-text-follow-up")) failures.push("S8 voicemail/text follow-up task missing.");
  if (!followUps.some((task) => task.id === "multi-contact-review")) failures.push("S8 multi-contact review task missing.");
  if (!followUps.some((task) => task.id === "joshua-escalation" && task.assignedRole === "manager")) failures.push("S8 Joshua escalation task missing.");
  if (followUps.some((task) => !task.manualOnly)) failures.push("S8 follow-up task is not manual-only.");
  if (!result.dossier.completedLeadReport?.formats.markdown.includes("Outreach Drafts And Follow-Up")) failures.push("Completed lead report outreach section missing.");
  if (!result.dossier.completedLeadReport?.formats.markdown.includes("No-auto-send guard: Enabled")) failures.push("Completed lead report no-auto-send guard missing.");
  const podioPayload = result.dossier.crm.payload as {
    appModel?: { fields?: { outreach_workflow?: unknown } };
    podioReadiness?: { blockers?: string[]; csvDryRunRequirements?: string[]; readbackChecks?: string[]; classification?: string };
  };
  if (!podioPayload.appModel?.fields?.outreach_workflow) failures.push("Podio outreach_workflow payload missing.");
  if (!podioPayload.podioReadiness?.csvDryRunRequirements?.length) failures.push("S9 CSV dry-run prep missing.");
  if (!podioPayload.podioReadiness?.readbackChecks?.length) failures.push("S9 Podio readback checks missing.");
  if (!podioPayload.podioReadiness?.blockers?.some((item) => item.includes("Live sync is disabled"))) failures.push("S9 live-sync blocker missing.");
  if (!result.dossier.workflow.rules.length) failures.push("Workflow rules missing.");
  if (!result.dossier.workflow.leadQuality.enabledSignals.length) failures.push("Lead-quality settings missing.");
  if (!result.facts.some((item) => item.factType === "owner_type")) failures.push("Owner-type workflow fact missing.");
  if (!result.dossier.taxHistory.manualReceiptTask.required) failures.push("Manual tax receipt fallback missing.");
  if (result.dossier.taxHistory.reviewTasks.length < 5) failures.push("Tax history review tasks missing.");
  if (result.dossier.deedHistory.reviewTasks.length < 7) failures.push("Deed/title review tasks missing.");
  if (!result.dossier.probateDocket.reviewTasks.length) failures.push("Probate docket review tasks missing.");
  if (!result.dossier.probateDocket.documentRequestTask.required) failures.push("Probate document request task missing.");
  if (!result.facts.some((item) => item.factType === "probate_docket_status")) failures.push("Probate docket status fact missing.");
  const podioProbate = (result.dossier.crm.payload as { appModel?: { fields?: { probate_docket?: unknown } } })?.appModel?.fields?.probate_docket;
  if (!podioProbate) failures.push("Podio probate_docket payload missing.");
  if (!result.dossier.marriageDeathIndicators.reviewTasks.length) failures.push("Marriage/death review tasks missing.");
  if (!result.dossier.marriageDeathIndicators.deathCertificateTask.required) failures.push("Death certificate task missing.");
  if (!result.dossier.familyTree.hypothesis.value?.nodes.length) failures.push("Family tree hypothesis nodes missing.");
  if (!result.dossier.sourceGovernance.catalog.value?.governedSources.length) failures.push("Source governance catalog missing.");
  const paidSource = result.dossier.sourceGovernance.catalog.value?.governedSources.find((source) => source.code === "idi");
  if (paidSource?.automationAllowed) failures.push("Paid source IDI incorrectly marked as automated.");
  if (!result.facts.some((item) => item.factType === "marriage_death_status")) failures.push("Marriage/death status fact missing.");
  if (!result.facts.some((item) => item.factType === "family_tree_hypothesis")) failures.push("Family tree hypothesis fact missing.");
  if (!result.facts.some((item) => item.factType === "source_governance_catalog")) failures.push("Source governance catalog fact missing.");
  const podioHeirship = (result.dossier.crm.payload as { appModel?: { fields?: { marriage_death_indicators?: unknown; family_tree?: unknown; source_governance?: unknown } } })?.appModel?.fields;
  if (!podioHeirship?.marriage_death_indicators) failures.push("Podio marriage_death_indicators payload missing.");
  if (!podioHeirship?.family_tree) failures.push("Podio family_tree payload missing.");
  if (!podioHeirship?.source_governance) failures.push("Podio source_governance payload missing.");
  if (!result.dossier.deedHistory.mailingAddressSignal.reviewFlags.includes("MISSING_MAILING_ADDRESS_FACT")) failures.push("Mailing-address review flag missing.");
  if (!result.dossier.deedHistory.orBookPage.reviewFlags.length) failures.push("OR book/page review flags missing.");
  if (!result.dossier.operatorQueue.items.length) failures.push("Operator queue items missing.");
  if (!result.dossier.evidenceQa.checks.length) failures.push("Source evidence QA checks missing.");
  if (result.dossier.evidenceQa.status === "failed") failures.push("Source evidence QA failed.");
  if (!result.dossier.sourceCoverage.areas.length) failures.push("S17 source coverage areas missing.");
  if (result.dossier.sourceCoverage.extractedFieldCount <= 0) failures.push("S17 source coverage should count property seed facts as captured.");
  if (result.dossier.sourceCoverage.blockedAreaCount <= 0) failures.push("S17 source coverage should keep missing source areas blocked.");
  if (!result.dossier.qualificationDecision) failures.push("S18 dry-run qualification decision missing.");
  if (result.dossier.qualificationDecision?.status !== "review") failures.push("S18 default dry-run lead should remain in review.");
  if ((result.dossier.qualificationDecision?.coverageScore ?? 0) <= 0) failures.push("S18 qualification coverage score missing.");
  if (!result.dossier.qualificationDecision?.reasonCodes.length) failures.push("S18 qualification reason codes missing.");
  if (!result.dossier.qualificationDecision?.blockers.some((blocker) => blocker.includes("No enrichment/contact"))) failures.push("S18 no-enrichment promotion blocker missing.");

  const dailyResult = await runDailyProduction({
    counties: ["miami-dade", "broward"],
    targetRawLeadRange: { min: 200, max: 400 },
    targetQualifiedLeadRange: { min: 80, max: 150 },
    seedSource: "manual",
    startedBy: "automation",
    seeds: [
      {
        propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
        ownerName: "Fresh public-source validation lead",
        county: "miami-dade",
        source: "operator_cli",
      },
      {
        propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
        ownerName: "Fresh public-source validation lead",
        county: "miami-dade",
        source: "operator_cli",
      },
      {
        estateName: "Estate of Broward Daily Review",
        county: "broward",
        source: "operator_cli",
      },
    ],
  });
  if (!dailyResult.id.startsWith("daily-")) failures.push("S14 daily run id missing.");
  if (dailyResult.rawLeadCount !== 2) failures.push("S14 daily run did not dedupe repeated seeds.");
  if (dailyResult.duplicateCount !== 1) failures.push("S14 daily duplicate count missing.");
  if (dailyResult.duplicates.length !== 1) failures.push("S18 daily duplicate sample missing.");
  if (dailyResult.qualifiedLeadCount !== 0) failures.push("S14 should not count review-placeholder/no-enrichment leads as qualified.");
  if (dailyResult.leads.some((lead) => !lead.qualificationDecision)) failures.push("S18 daily lead qualification decision missing.");
  if (dailyResult.leads.some((lead) => lead.qualified && lead.qualificationDecision.blockers.length)) failures.push("S18 blocked lead was counted as qualified.");
  if (dailyResult.qualificationReview.summary.qualified !== 0) failures.push("S18 review-placeholder run should have zero qualified samples.");
  if (dailyResult.qualificationReview.summary.review < 1) failures.push("S18 review sample count missing.");
  if (dailyResult.qualificationReview.summary.duplicate !== 1) failures.push("S18 duplicate summary missing.");
  if (!dailyResult.qualificationReview.samples.review.length) failures.push("S18 review sample missing.");
  if (!dailyResult.qualificationReview.samples.duplicate.length) failures.push("S18 duplicate sample section missing.");
  const qualificationReviewMarkdown = renderQualificationReviewMarkdown(dailyResult.qualificationReview);
  if (!qualificationReviewMarkdown.includes("HeirRight Qualification Review Packet")) failures.push("S18 qualification review markdown heading missing.");
  for (const heading of ["Qualified Samples", "Review Samples", "Disqualified Samples", "Duplicate Samples", "Dead-Letter Samples"] as const) {
    if (!qualificationReviewMarkdown.includes(heading)) failures.push(`S18 qualification review markdown section missing ${heading}.`);
  }
  if (!dailyResult.missedVolumeReasons.some((reason) => reason.includes("Qualified lead count"))) failures.push("S14 missed qualified-volume reason missing.");
  if (!dailyResult.missedVolumeReasons.some((reason) => reason.includes("No production batch seed file"))) failures.push("S14 production seed blocker missing.");
  if (!dailyResult.missedVolumeReasons.some((reason) => reason.includes("source area"))) failures.push("S17 source coverage missed-volume reason missing.");
  if (!dailyResult.sourceCoverageSummary.areaStatuses.length) failures.push("S17 daily source coverage rollup missing.");
  if (!dailyResult.sourceCoverageBlockers.length) failures.push("S17 source coverage blocker summary missing.");
  if (!dailyResult.sourceCoverageBlockers.some((blocker) => blocker.label === "Tax status" && blocker.missingFields.includes("unpaid tax years"))) failures.push("S17 source coverage blocker fields missing.");
  if (!dailyResult.blockers.some((blocker) => blocker.includes("No enrichment/contact"))) failures.push("S14 no-enrichment qualification blocker missing.");

  const validSeedReport = validateSeedBatchInput({
    batchId: "validation-miami-dade-seeds",
    sourceLabel: "Validation county seed batch",
    sourceOwner: "HeirRight operator",
    approvalMarker: "approved_for_production_batch",
    seeds: [
      {
        propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
        ownerName: "Fresh public-source validation lead",
        county: "miami-dade",
        source: "operator_cli",
      },
      {
        propertyAddress: "20611 NW 33rd Pl, Miami Gardens, FL 33056",
        ownerName: "Fresh public-source validation lead",
        county: "miami-dade",
        source: "operator_cli",
      },
    ],
  });
  if (!validSeedReport.ok) failures.push("S16 approved Miami-Dade seed batch should validate.");
  if (validSeedReport.batch.acceptedSeedCount !== 1) failures.push("S16 seed validator should dedupe duplicate seeds.");
  if (validSeedReport.batch.duplicateCount !== 1) failures.push("S16 seed validator duplicate count missing.");
  const invalidSeedReport = validateSeedBatchInput({
    batchId: "validation-unapproved-seeds",
    sourceLabel: "Unapproved county seed batch",
    sourceOwner: "HeirRight operator",
    seeds: [{ county: "broward", source: "operator_cli" }],
  });
  if (invalidSeedReport.ok) failures.push("S16 unapproved or unsupported seed batch should be blocked.");
  if (!invalidSeedReport.issues.some((item) => item.code === "MISSING_APPROVAL_MARKER")) failures.push("S16 missing approval marker issue missing.");
  if (!invalidSeedReport.issues.some((item) => item.code === "UNSUPPORTED_COUNTY")) failures.push("S16 unsupported county issue missing.");

  const dryExport = await exportCompletedReport({
    routes: ["google", "podio"],
    dossier: result.dossier,
    dryRun: true,
  }, {
    GOOGLE_WORKSPACE_ACCESS_TOKEN: "validation-google-token",
    GOOGLE_TRACKING_SHEET_ID: "validation-sheet",
    PODIO_ACCESS_TOKEN: "validation-podio-token",
    PODIO_APP_ID: "validation-app",
    PODIO_FIELD_MAP_JSON: JSON.stringify({
      title: "title",
      property_address: "property_address",
      report_link: "report_link",
    }),
  });
  if (!dryExport.ok) failures.push("S15 dry export should prepare both routes.");
  if (dryExport.routes.length !== 2) failures.push("S15 dry export did not return Google and Podio routes.");
  if (!dryExport.routes.every((route) => route.mode === "dry_run")) failures.push("S15 dry export routes should stay dry-run.");
  if (!dryExport.routes.every((route) => route.blockers.some((blocker) => blocker.includes("skipped in dry-run")))) failures.push("S15 dry export readback blockers missing.");
  const dryReadbackPacket = buildReadbackEvidencePacket(dryExport, await connectionStatuses({
    GOOGLE_WORKSPACE_ACCESS_TOKEN: "validation-google-token",
    GOOGLE_TRACKING_SHEET_ID: "validation-sheet",
    PODIO_ACCESS_TOKEN: "validation-podio-token",
    PODIO_APP_ID: "validation-app",
    PODIO_FIELD_MAP_JSON: JSON.stringify({ title: "title" }),
  }));
  const dryReadbackMarkdown = renderReadbackEvidenceMarkdown(dryReadbackPacket);
  if (dryReadbackPacket.overallStatus !== "blocked") failures.push("S19 dry readback packet should stay blocked until live readback passes.");
  if (!dryReadbackPacket.routes.every((route) => route.status === "prepared_only")) failures.push("S19 dry readback routes should be prepared-only.");
  if (!dryReadbackMarkdown.includes("HeirRight Google + Podio Readback Evidence")) failures.push("S19 readback markdown heading missing.");
  if (!dryReadbackMarkdown.includes("No live record")) failures.push("S19 readback markdown should show no live record for dry prep.");

  const podioPresetDryExport = await exportCompletedReport({
    routes: ["podio"],
    dossier: result.dossier,
    dryRun: true,
  }, {
    PODIO_ACCESS_TOKEN: "validation-podio-token",
    PODIO_APP_ID: TEXAS_EQUITY_PROS_LEADS_APP_ID,
  });
  const podioPresetRoute = podioPresetDryExport.routes.find((route) => route.route === "podio");
  if (!podioPresetDryExport.ok) failures.push("S9/S15 Podio Texas Equity Pros Leads preset should dry-run without PODIO_FIELD_MAP_JSON.");
  if (podioPresetRoute?.mode !== "dry_run") failures.push("S9/S15 Podio preset route should stay dry-run.");
  if (!podioPresetRoute?.message.includes("texas_equity_pros_leads_preset")) failures.push("S9/S15 Podio preset route should report the built-in schema source.");

  const podioApprovalBlockedExport = await exportCompletedReport({
    routes: ["podio"],
    dossier: result.dossier,
    dryRun: false,
  }, {
    PODIO_ACCESS_TOKEN: "validation-podio-token",
    PODIO_APP_ID: TEXAS_EQUITY_PROS_LEADS_APP_ID,
  });
  if (podioApprovalBlockedExport.ok) failures.push("S9/S15 live Podio export should require explicit write approval.");
  if (!podioApprovalBlockedExport.blockers.some((blocker) => blocker.includes(PODIO_LIVE_WRITE_APPROVAL_KEY))) failures.push("S9/S15 live Podio approval blocker missing.");

  const podioDefaultsBlockedExport = await exportCompletedReport({
    routes: ["podio"],
    dossier: result.dossier,
    dryRun: false,
  }, {
    PODIO_ACCESS_TOKEN: "validation-podio-token",
    PODIO_APP_ID: TEXAS_EQUITY_PROS_LEADS_APP_ID,
    [PODIO_LIVE_WRITE_APPROVAL_KEY]: "true",
  });
  if (podioDefaultsBlockedExport.ok) failures.push("S9/S15 live Podio export should require controlled test defaults before network write.");
  for (const key of ["PODIO_TEST_PHONE", "PODIO_TEST_EMAIL", "PODIO_LEAD_POINT_PROFILE_ID"] as const) {
    if (!podioDefaultsBlockedExport.blockers.some((blocker) => blocker.includes(key))) failures.push(`S9/S15 live Podio default blocker missing ${key}.`);
  }

  const blockedExport = await exportCompletedReport({
    routes: ["google", "podio"],
    dossier: result.dossier,
    dryRun: false,
  }, {});
  if (blockedExport.ok) failures.push("S15 live export should not succeed without configured credentials.");
  if (!blockedExport.blockers.some((blocker) => blocker.includes("Missing Google Workspace config"))) failures.push("S15 missing Google config blocker missing.");
  if (!blockedExport.blockers.some((blocker) => blocker.includes("Missing Podio export config"))) failures.push("S15 missing Podio config blocker missing.");

  const statuses = await connectionStatuses({});
  for (const name of ["Podio", "Google", "Web Search"] as const) {
    if (!statuses.some((status) => status.name === name)) failures.push(`S15 connection status missing ${name}.`);
  }

  const thirtyDayEvidence = await generateThirtyDayMilestoneEvidence({});
  const thirtyDayEvidenceMarkdown = renderThirtyDayMilestoneEvidenceMarkdown(thirtyDayEvidence);
  const thirtyDayReviewScript = renderThirtyDayClientReviewScriptMarkdown(thirtyDayEvidence);
  if (thirtyDayEvidence.milestone !== "30-Day Workflow Automation Milestone") failures.push("HEI-77 milestone evidence title missing.");
  if (thirtyDayEvidence.overallStatus !== "blocked") failures.push("HEI-77 default evidence should be blocked without production seeds and live readback.");
  if (!thirtyDayEvidence.gates.some((item) => item.id === "production_seed_batch" && item.status === "blocked")) failures.push("HEI-77 production seed blocker missing.");
  if (!thirtyDayEvidence.gates.some((item) => item.id === "qualified_lead_volume" && item.status === "blocked")) failures.push("HEI-77 qualified-volume blocker missing.");
  if (!thirtyDayEvidence.gates.some((item) => item.id === "qualification_integrity" && item.status === "passed")) failures.push("HEI-77 qualification-integrity gate missing.");
  if (!thirtyDayEvidence.gates.some((item) => item.id === "structured_source_coverage" && item.status === "blocked")) failures.push("S17 structured-source coverage gate missing.");
  if (!thirtyDayEvidence.gates.some((item) => item.id === "external_use_guard" && item.status === "passed")) failures.push("HEI-77 external-use guard gate missing.");
  if (!thirtyDayEvidence.dailyRun.sourceCoverageBlockers.length) failures.push("S17 milestone source coverage blockers missing.");
  if (!thirtyDayEvidence.dailyRun.qualificationReviewSummary) failures.push("S18 milestone qualification summary missing.");
  if (!thirtyDayEvidence.exportReadiness.readbackEvidence) failures.push("S19 milestone readback evidence packet missing.");
  if (thirtyDayEvidence.exportReadiness.readbackEvidence.overallStatus !== "blocked") failures.push("S19 default milestone readback evidence should remain blocked.");
  if (!thirtyDayEvidenceMarkdown.includes("HeirRight 30-Day Milestone Evidence")) failures.push("HEI-77 evidence markdown heading missing.");
  if (!thirtyDayEvidenceMarkdown.includes("Source Coverage Blockers")) failures.push("S17 milestone markdown source blocker section missing.");
  if (!thirtyDayEvidenceMarkdown.includes("Qualification review:")) failures.push("S18 milestone markdown qualification summary missing.");
  if (!thirtyDayEvidenceMarkdown.includes("Google + Podio Readback")) failures.push("S19 milestone markdown readback section missing.");
  if (!thirtyDayEvidenceMarkdown.includes("Not ready for 30-Day acceptance")) failures.push("HEI-77 evidence markdown summary missing.");
  if (!thirtyDayReviewScript.includes("HeirRight 30-Day Review Agenda")) failures.push("S20 client review script heading missing.");
  if (!thirtyDayReviewScript.includes("Records To Pull Next")) failures.push("S20 client review script source blocker section missing.");
  for (const phrase of ["production seed", "Google", "Podio", "qualified"] as const) {
    if (!thirtyDayReviewScript.includes(phrase)) failures.push(`S20 client review script missing ${phrase}.`);
  }

  const estateResult = await runDryPipeline({
    estateName: "Estate of Maria Lopez",
    county: "miami-dade",
    source: "operator_cli",
  });
  if (!estateResult.dossier.summary.estateName) failures.push("Estate-only seed missing summary.estateName.");
  if (!estateResult.dossier.summary.estateSearchKey) failures.push("Estate-only seed missing summary.estateSearchKey.");
  if (!estateResult.dossier.summary.displayName.startsWith("Estate of Maria Lopez")) failures.push("Estate-only seed did not use estate-first displayName.");
  const podioFields = (estateResult.dossier.crm.payload as { appModel?: { fields?: Record<string, unknown> } })?.appModel?.fields;
  if (podioFields?.estate_name !== "Estate of Maria Lopez") failures.push("Estate-only seed missing Podio estate_name field.");
  if (podioFields?.estate_search_key !== "maria-lopez") failures.push("Estate-only seed missing normalized Podio estate_search_key.");
  if (!estateResult.dossier.probateDocket.reviewTasks.length) failures.push("Estate-only seed missing probate docket review tasks.");

  const caseResult = await runDryPipeline({
    estateName: "Estate of Maria Lopez",
    caseNumber: "2024-CP-001234",
    county: "miami-dade",
    source: "operator_cli",
  });
  if (caseResult.dossier.probateDocket.caseNumber.value !== "2024-CP-001234") failures.push("Case-number seed missing probateDocket.caseNumber.");

  for (const path of Object.values(result.outputs)) {
    if (!existsSync(path)) failures.push(`Expected output missing: ${path}`);
  }
  if (!result.dossier.audit.reviewFlags.includes("NO_ENRICHMENT_RUN")) failures.push("No-enrichment flag missing.");

  const companyDossier = buildS5FixtureDossier({
    runId: "validation-s5-company-owner",
    ownerName: "Estate Holdings LLC",
    ownerType: "company",
  });
  const companyRule = companyDossier.workflow.rules.find((rule) => rule.code === "OWNER_TYPE");
  if (companyRule?.status !== "stop") failures.push("S5 company-owner rule did not stop the lead.");
  if (companyDossier.operatorQueue.state !== "disqualified") failures.push("S5 company-owner fixture did not enter disqualified queue.");

  const recentSaleDossier = buildS5FixtureDossier({
    runId: "validation-s5-recent-sale",
    ownerName: "Fresh Public Source Lead",
    ownerType: "individual_review",
    lastSaleDate: new Date().toISOString().slice(0, 10),
  });
  const recentSaleRule = recentSaleDossier.workflow.rules.find((rule) => rule.code === "RECENT_SALE");
  if (recentSaleRule?.status !== "stop") failures.push("S5 recent-sale rule did not stop the lead.");
  if (recentSaleDossier.operatorQueue.state !== "disqualified") failures.push("S5 recent-sale fixture did not enter disqualified queue.");

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({
    ok: true,
    runId: result.runId,
    facts: result.facts.length,
    outputs: result.outputs,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
