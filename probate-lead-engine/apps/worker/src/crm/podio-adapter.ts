import type { CrmAdapter, RawDossier } from "@ple/types";
import { formatCountyName } from "../display";
import {
  PODIO_LIVE_WRITE_APPROVAL_KEY,
  podioMissingExportConfig,
  TEXAS_EQUITY_PROS_LEADS_APP,
  TEXAS_EQUITY_PROS_LEADS_APP_ID,
  TEXAS_EQUITY_PROS_LEADS_WORKSPACE,
} from "../export/podio-config";

type EnvLookup = Record<string, string | undefined>;

const DEAL_FACT_TYPES = new Set([
  "offer_as_is_value",
  "offer_heir_count",
  "offer_buy_percentage",
  "offer_minimum_net_profit",
]);

function includesDealMath(dossier: RawDossier): boolean {
  return dossier.audit.facts.some((fact) => DEAL_FACT_TYPES.has(fact.factType));
}

function filterDealText(value: string, includeDealMath: boolean): boolean {
  return includeDealMath || !/offer|underwriting/i.test(value);
}

function discoveryReviewGate(dossier: RawDossier, includeDealMath: boolean): unknown {
  const gate = dossier.completedLeadReport?.reviewGate;
  if (!gate || includeDealMath) return gate;
  const { underwritingStatus: _underwritingStatus, reviewFlags, approvalPlaceholder, ...rest } = gate;
  return {
    ...rest,
    approvalPlaceholder: approvalPlaceholder.replace(/ or offers/gi, ""),
    reviewFlags: reviewFlags.filter((flag) => !/OFFER|UNDERWRITING/i.test(flag)),
  };
}

function discoveryOutreachReadiness(dossier: RawDossier, includeDealMath: boolean): unknown {
  const readiness = dossier.outreach.readiness;
  if (includeDealMath) return readiness;
  return {
    ...readiness,
    blockers: readiness.blockers.filter((blocker) => filterDealText(blocker, false)),
    nextAction: readiness.nextAction.replace("offer, ", ""),
    reviewFlags: readiness.reviewFlags.filter((flag) => !/OFFER|UNDERWRITING/i.test(flag)),
  };
}

export interface PodioDryRunPayload {
  provider: "podio";
  mode: "dry_run";
  appModel: {
    workspace: string;
    app: string;
    pipelineStages: string[];
    fields: Record<string, unknown>;
  };
  tasks: Array<{ title: string; description: string }>;
  browserAutomationFallback: {
    recommended: boolean;
    reason: string;
    requiredConfig: string[];
  };
  podioReadiness: {
    classification: "blocked_missing_access" | "ready_for_controlled_validation";
    requiredAccess: string[];
    missingConfig: string[];
    safeLiveWriteTestSteps: string[];
    csvDryRunRequirements: string[];
    readbackChecks: string[];
    blockers: string[];
  };
}

export class PodioAdapter implements CrmAdapter<PodioDryRunPayload> {
  provider: "podio" = "podio";

  constructor(private readonly env: EnvLookup = process.env) {}

  describeRequiredConfig(): string[] {
    return ["PODIO_ACCESS_TOKEN", "PODIO_APP_ID", "PODIO_FIELD_MAP_JSON"];
  }

  async healthcheck(): Promise<{ ok: boolean; reason?: string; mode: "api" | "browser_fallback" | "dry_run" }> {
    const missing = podioMissingExportConfig(this.env);
    if (missing.length) {
      return {
        ok: false,
        mode: "dry_run",
        reason: `Podio bearer-token exporter is not configured. Missing: ${missing.join(", ")}. Browser automation remains an audit-only fallback.`,
      };
    }

    return { ok: true, mode: "api", reason: "Podio bearer-token export config is present. Live sync still requires explicit controlled write/readback validation." };
  }

  async dryRun(dossier: RawDossier): Promise<PodioDryRunPayload> {
    const health = await this.healthcheck();
    const missingConfig = podioMissingExportConfig(this.env);
    const includeDealMath = includesDealMath(dossier);
    const outreachAssets = dossier.outreach.assets.filter((asset) => filterDealText(`${asset.title} ${asset.intendedUse}`, includeDealMath));
    const outreachTasks = dossier.outreach.followUpTasks.filter((task) => filterDealText(`${task.title} ${task.description}`, includeDealMath));
    const outreachReadiness = discoveryOutreachReadiness(dossier, includeDealMath) as RawDossier["outreach"]["readiness"];
    return {
      provider: "podio",
      mode: "dry_run",
      appModel: {
        workspace: TEXAS_EQUITY_PROS_LEADS_WORKSPACE,
        app: TEXAS_EQUITY_PROS_LEADS_APP,
        pipelineStages: ["Marketing", "Acquisition", "Disposition"],
        fields: {
          title: dossier.summary.displayName,
          estate_name: dossier.summary.estateName,
          estate_search_key: dossier.summary.estateSearchKey,
          case_number: dossier.summary.caseNumber,
          property_address: dossier.property.address.value,
          owner_name: dossier.property.ownerName.value,
          county: formatCountyName(dossier.property.county.value, "Miami-Dade"),
          parcel_id: dossier.property.parcelId.value,
          source_status: dossier.audit.reviewFlags.includes("SOURCE_BLOCKED") ? "blocked" : "source_checked",
          dossier_status: dossier.status,
          tax_history: {
            status: dossier.taxHistory.sourceStatus.value,
            unpaid_years: dossier.taxHistory.unpaidYears.value,
            amount_due: dossier.taxHistory.amountDue.value,
            reassessment: dossier.taxHistory.reassessment.value,
            receipt_status: dossier.taxHistory.receiptStatus.value,
            payer_identity: dossier.taxHistory.payerIdentity.value,
            review_tasks: dossier.taxHistory.reviewTasks,
            manual_receipt_task: dossier.taxHistory.manualReceiptTask,
          },
          deed_history: {
            status: dossier.deedHistory.sourceStatus.value,
            latest_deed: dossier.deedHistory.latestDeed.value,
            or_book_page: dossier.deedHistory.orBookPage.value,
            last_sale_date: dossier.deedHistory.lastSaleDate.value,
            mailing_address_signal: dossier.deedHistory.mailingAddressSignal.value,
            ownership_activity: dossier.deedHistory.ownershipActivity.value,
            mortgage_signal: dossier.deedHistory.mortgageSignal.value,
            lien_signal: dossier.deedHistory.lienSignal.value,
            lis_pendens_signal: dossier.deedHistory.lisPendensSignal.value,
            foreclosure_signal: dossier.deedHistory.foreclosureSignal.value,
            adverse_possession_signal: dossier.deedHistory.adversePossessionSignal.value,
            review_tasks: dossier.deedHistory.reviewTasks,
          },
          probate_docket: {
            status: dossier.probateDocket.sourceStatus.value,
            case_number: dossier.probateDocket.caseNumber.value,
            case_status: dossier.probateDocket.caseStatus.value,
            civil_family_docket: dossier.probateDocket.civilFamilyDocket.value,
            affidavit_of_heirs: dossier.probateDocket.affidavitOfHeirs.value,
            document_availability: dossier.probateDocket.documentAvailability.value,
            official_record_cross_links: dossier.probateDocket.officialRecordCrossLinks.value,
            review_tasks: dossier.probateDocket.reviewTasks,
            document_request_task: dossier.probateDocket.documentRequestTask,
          },
          marriage_death_indicators: {
            status: dossier.marriageDeathIndicators.sourceStatus.value,
            marriage_license: dossier.marriageDeathIndicators.marriageLicense.value,
            date_of_birth: dossier.marriageDeathIndicators.dateOfBirth.value,
            date_of_death: dossier.marriageDeathIndicators.dateOfDeath.value,
            obituary_link: dossier.marriageDeathIndicators.obituaryLink.value,
            memorial_searches: dossier.marriageDeathIndicators.memorialSearches.value,
            death_certificate_status: dossier.marriageDeathIndicators.deathCertificateStatus.value,
            incarceration_status: dossier.marriageDeathIndicators.incarcerationStatus.value,
            review_tasks: dossier.marriageDeathIndicators.reviewTasks,
            death_certificate_task: dossier.marriageDeathIndicators.deathCertificateTask,
          },
          family_tree: {
            status: dossier.familyTree.sourceStatus.value,
            hypothesis: dossier.familyTree.hypothesis.value,
            review_tasks: dossier.familyTree.reviewTasks,
          },
          source_governance: dossier.sourceGovernance.catalog.value,
          heirship_family_tree_status: dossier.familyTree.sourceStatus.value,
          lead_bucket: dossier.completedLeadReport?.leadQualityProfile.leadBucket ?? "review_required",
          owner_type: dossier.workflow.rules.find((rule) => rule.code === "OWNER_TYPE")?.reasonCodes.join(", ") ?? "unknown",
          tax_flags: {
            unpaid_years: dossier.taxHistory.unpaidYears.value,
            amount_due: dossier.taxHistory.amountDue.value,
            receipt_status: dossier.taxHistory.receiptStatus.value,
            reassessment: dossier.taxHistory.reassessment.value,
          },
          title_deed_flags: {
            mortgage_signal: dossier.deedHistory.mortgageSignal.value,
            lien_signal: dossier.deedHistory.lienSignal.value,
            lis_pendens_signal: dossier.deedHistory.lisPendensSignal.value,
            foreclosure_signal: dossier.deedHistory.foreclosureSignal.value,
            adverse_possession_signal: dossier.deedHistory.adversePossessionSignal.value,
          },
          probate_status: dossier.probateDocket.caseStatus.value,
          family_tree_status: dossier.familyTree.hypothesis.value?.status ?? "hypothesis",
          lead_quality_profile: dossier.completedLeadReport?.leadQualityProfile ?? {
            model: dossier.workflow.leadQuality.model,
            leadBucket: "review_required",
            enabledSignals: dossier.workflow.leadQuality.enabledSignals,
            missingSignals: [],
            reasonCodes: dossier.workflow.leadQuality.reasonCodes,
            promotionEligible: false,
            reviewFlags: dossier.workflow.reviewFlags,
          },
          lead_quality_reason_codes: dossier.completedLeadReport?.leadQualityProfile.reasonCodes ?? dossier.workflow.leadQuality.reasonCodes,
          ...(includeDealMath ? { offer_math: dossier.completedLeadReport?.offerMath } : {}),
          report_review_gate: discoveryReviewGate(dossier, includeDealMath),
          outreach_readiness: dossier.completedLeadReport?.reviewGate.outreachReadiness ?? "blocked",
          outreach_workflow: {
            compliance_status: dossier.outreach.complianceStatus,
            readiness: outreachReadiness,
            no_auto_send_guard: dossier.outreach.noAutoSendGuard,
            draft_assets: outreachAssets.map((asset) => ({
              id: asset.id,
              title: asset.title,
              intended_use: asset.intendedUse,
              language: asset.language,
              channel: asset.channel,
              status: asset.status,
              automation_allowed: asset.automationAllowed,
              external_use_allowed: asset.externalUseAllowed,
              source_document: asset.sourceDocument,
            })),
            manual_follow_up_tasks: outreachTasks,
          },
          completed_lead_report_id: dossier.completedLeadReport?.id,
          completed_lead_report_status: dossier.completedLeadReport?.reviewGate.reportStatus ?? "internal_draft",
          next_action: dossier.summary.nextBestAction,
          workflow_status: dossier.workflow.status,
          workflow_rules: dossier.workflow.rules.map((rule) => ({
            code: rule.code,
            status: rule.status,
            reason_codes: rule.reasonCodes,
          })),
          lead_quality_settings: dossier.workflow.leadQuality,
          operator_queue: dossier.operatorQueue,
          evidence_qa: dossier.evidenceQa,
          review_flags: dossier.audit.reviewFlags,
          next_best_action: dossier.summary.nextBestAction,
          narrative: dossier.narrative,
        },
      },
      tasks: [
        {
          title: "Resolve workflow review flags",
          description: dossier.workflow.nextAction,
        },
        {
          title: "Capture tax/deed source evidence",
          description: "Confirm unpaid taxes, receipts, payer identity, latest deed, OR book/page, recent sale, and title-friction signals before promoting the lead.",
        },
        ...dossier.taxHistory.reviewTasks.map((task) => ({
          title: task.title,
          description: task.nextAction,
        })),
        ...dossier.deedHistory.reviewTasks.map((task) => ({
          title: task.title,
          description: task.nextAction,
        })),
        ...(dossier.probateDocket.documentRequestTask.required
          ? [{
            title: "Request missing probate documents",
            description: dossier.probateDocket.documentRequestTask.reason,
          }]
          : []),
        ...dossier.probateDocket.reviewTasks.map((task) => ({
          title: task.title,
          description: task.nextAction,
        })),
        ...(dossier.marriageDeathIndicators.deathCertificateTask.required
          ? [{
            title: "Capture death certificate status",
            description: dossier.marriageDeathIndicators.deathCertificateTask.reason,
          }]
          : []),
        ...dossier.marriageDeathIndicators.reviewTasks.map((task) => ({
          title: task.title,
          description: task.nextAction,
        })),
        ...dossier.familyTree.reviewTasks.map((task) => ({
          title: task.title,
          description: task.nextAction,
        })),
        ...dossier.sourceGovernance.reviewTasks.map((task) => ({
          title: task.title,
          description: task.nextAction,
        })),
        ...(dossier.sourceGovernance.catalog.value?.manualTasks.map((task) => ({
          title: task.title,
          description: task.description,
        })) ?? []),
        {
          title: "Review completed lead report",
          description: dossier.completedLeadReport?.reviewGate.approvalPlaceholder ?? "Human review required before outreach.",
        },
        ...(includeDealMath
          ? [{
            title: "Confirm offer/profit underwriting",
            description: dossier.completedLeadReport?.offerMath?.asIsValue.note ?? "Capture as-is value, heir count, and deduction inputs before offer math is trusted.",
          }]
          : []),
        {
          title: "Decide enrichment run",
          description: "Run skip trace/contact enrichment only after raw public-source facts are accepted.",
        },
        ...outreachTasks.map((task) => ({
          title: task.title,
          description: task.description,
        })),
        {
          title: "Review outreach scripts and disclaimers",
          description: outreachReadiness.nextAction,
        },
      ],
      browserAutomationFallback: {
        recommended: !health.ok,
        reason: health.reason ?? "Podio API status unknown.",
        requiredConfig: ["PODIO_BROWSER_SESSION", "PODIO_WORKSPACE_NAME", "PODIO_APP_NAME"],
      },
      podioReadiness: {
        classification: missingConfig.length ? "blocked_missing_access" : "ready_for_controlled_validation",
        requiredAccess: [
          `Podio workspace invite for ${TEXAS_EQUITY_PROS_LEADS_WORKSPACE}`,
          `Target Leads app id ${TEXAS_EQUITY_PROS_LEADS_APP_ID}`,
          "PODIO_ACCESS_TOKEN bearer token with item/comment/task/readback access",
          "PODIO_FIELD_MAP_JSON override, or the built-in Texas Equity Pros Leads schema preset",
          `${PODIO_LIVE_WRITE_APPROVAL_KEY}=true for the one approved controlled test write`,
          "PODIO_TEST_PHONE and PODIO_TEST_EMAIL only for the clearly labeled controlled test item",
          "PODIO_LEAD_POINT_PROFILE_ID for the required Lead point contact field",
          "Permission to create one controlled test item",
          "Permission to create one task, one comment, and one report link on that test item",
          "CSV export access for Podio and Google Sheets backup comparison",
          "Explicit live-write approval before sync() is enabled",
        ],
        missingConfig,
        safeLiveWriteTestSteps: [
          "Create one clearly labeled test lead item from the dry-run payload.",
          "Attach or link the completed lead report to the test item.",
          includeDealMath
            ? "Create research, offer-review, and manual follow-up tasks only."
            : "Create research and manual follow-up tasks only.",
          "Add one source-note comment with review flags.",
          "Read the item back and compare fields, tasks, comments, and links against the dry-run payload.",
          "Delete or archive the test item only after readback evidence is captured.",
        ],
        csvDryRunRequirements: [
          "Export qualified leads from Google Sheets.",
          "Export bonus or warm leads from Podio.",
          includeDealMath
            ? "Map estate name, property address, folio, probate status, family-tree status, offer math, outreach status, and owner queue."
            : "Map estate name, property address, folio, probate status, family-tree status, contact-review status, outreach status, and owner queue.",
          "Produce a dry-run import report without mutating either original system.",
        ],
        readbackChecks: [
          "Lead item title keeps estate name or property as the visible identifier.",
          "Review flags and source notes remain visible to the operator.",
          "Completed lead report link or attachment persists.",
          "Manual follow-up tasks remain draft/manual and do not send outreach.",
          "No-auto-send guard is represented in status fields or notes.",
        ],
        blockers: [
          ...(missingConfig.length ? [`Missing Podio export config: ${missingConfig.join(", ")}`] : []),
          "Live sync is disabled until the target workspace/app is validated.",
          "No outreach automation is approved.",
          "CSV exports are required before migration confidence.",
        ],
      },
    };
  }

  async sync(): Promise<{ ok: boolean; reason?: string }> {
    const health = await this.healthcheck();
    if (!health.ok) {
      return { ok: false, reason: health.reason };
    }
    return { ok: false, reason: "Live Podio sync is intentionally disabled until TP validates the target workspace/app." };
  }
}
