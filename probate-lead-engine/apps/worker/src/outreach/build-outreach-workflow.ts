import type {
  CompletedLeadReport,
  FollowUpTaskTemplate,
  NoAutoSendGuard,
  OutreachReadinessEvaluation,
  OutreachWorkflow,
  RawDossier,
  ReviewFlag,
} from "@ple/types";
import { nowIso } from "../lib";
import { buildOutreachDraftAssets } from "./script-assets";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function manualTask(input: Omit<FollowUpTaskTemplate, "manualOnly" | "reviewFlags">): FollowUpTaskTemplate {
  return {
    ...input,
    manualOnly: true,
    reviewFlags: [
      "OUTREACH_BLOCKED",
      "COMPLIANCE_REVIEW_REQUIRED",
      "LIVE_OUTREACH_DISABLED",
      "NO_AUTO_SEND_GUARD",
      "HUMAN_REVIEW_REQUIRED",
    ],
  };
}

const DEAL_FACT_TYPES = new Set([
  "offer_as_is_value",
  "offer_heir_count",
  "offer_buy_percentage",
  "offer_minimum_net_profit",
]);

function includesDealMath(dossier: Omit<RawDossier, "outreach">): boolean {
  return dossier.audit.facts.some((fact) => DEAL_FACT_TYPES.has(fact.factType));
}

function buildFollowUpTasks(includeDealMath: boolean): FollowUpTaskTemplate[] {
  return [
    manualTask({
      id: "call-attempt-1",
      title: "Call lead - attempt 1",
      channel: "call",
      cadence: "First manual call after operator approval.",
      attemptNumber: 1,
      window: "morning",
      assignedRole: "operator",
      description: "Call the selected contact in the morning window after the report, contact data, and script are reviewed.",
    }),
    manualTask({
      id: "call-attempt-2",
      title: "Call lead - attempt 2",
      channel: "call",
      cadence: "Second manual call if attempt 1 does not connect.",
      attemptNumber: 2,
      window: "afternoon",
      assignedRole: "operator",
      description: "Call again in the afternoon window and record whether the contact answered, declined, or needs another follow-up.",
    }),
    manualTask({
      id: "call-attempt-3",
      title: "Call lead - attempt 3",
      channel: "call",
      cadence: "Third manual call before escalation or longer retry.",
      attemptNumber: 3,
      window: "multi_day",
      assignedRole: "operator",
      description: "Make the third manual call across the multi-day retry window before manager review.",
    }),
    manualTask({
      id: "voicemail-text-follow-up",
      title: "Leave voicemail and prepare text follow-up",
      channel: "voicemail",
      cadence: "After missed calls, prepare voicemail and text follow-up for manual review.",
      attemptNumber: null,
      window: "multi_day",
      assignedRole: "operator",
      description: "Leave voicemail and prepare a text only after the script and disclaimer are approved for manual use.",
    }),
    manualTask({
      id: "multi-contact-review",
      title: "Review all contact options",
      channel: "call",
      cadence: "Before repeating outreach, inspect each heir/contact option.",
      attemptNumber: null,
      window: "multi_day",
      assignedRole: "operator",
      description: "Check all known relatives, owners, and contact placeholders before deciding which person or number to call next.",
    }),
    manualTask({
      id: "joshua-escalation",
      title: "Escalate to Joshua",
      channel: "call",
      cadence: "After repeated attempts or a high-value response, escalate for manager review.",
      attemptNumber: null,
      window: "manager_review",
      assignedRole: "manager",
      description: includeDealMath
        ? "Send the reviewed lead packet, call notes, and open questions to Joshua before any offer or external document is used."
        : "Send the reviewed lead packet, call notes, and open questions to Joshua before any external document is used.",
    }),
  ];
}

function buildReadiness(dossier: Omit<RawDossier, "outreach">, report?: CompletedLeadReport): OutreachReadinessEvaluation {
  const includeDealMath = includesDealMath(dossier);
  const blockers = [
    "Compliance approval is missing for every outreach script.",
    includeDealMath
      ? "Approved disclaimers are not attached to script, text, email, or offer-letter drafts."
      : "Approved disclaimers are not attached to script, text, or email drafts.",
    "Contact data is still placeholder-only until enrichment or manual capture is reviewed.",
    includeDealMath
      ? "Live calls, texts, emails, and offer letters are disabled by the no-auto-send guard."
      : "Live calls, texts, and emails are disabled by the no-auto-send guard.",
  ];
  const reviewFlags: ReviewFlag[] = [
    "SCRIPT_REVIEW_REQUIRED",
    "COMPLIANCE_REVIEW_REQUIRED",
    "CONTACT_REVIEW_REQUIRED",
    "OUTREACH_BLOCKED",
    "LIVE_OUTREACH_DISABLED",
    "NO_AUTO_SEND_GUARD",
    "HUMAN_REVIEW_REQUIRED",
  ];

  if (!report || report.reviewGate.reportStatus !== "reviewed") {
    blockers.unshift("Completed lead report still needs operator review.");
    reviewFlags.push("REPORT_REVIEW_REQUIRED");
  }
  if (includeDealMath && (!report?.offerMath || report.offerMath.reviewFlags.includes("UNDERWRITING_REVIEW_REQUIRED"))) {
    blockers.unshift("Offer/profit underwriting still needs operator review.");
    reviewFlags.push("UNDERWRITING_REVIEW_REQUIRED");
  }
  if (dossier.workflow.status !== "continue" || dossier.operatorQueue.state !== "ready_for_review") {
    blockers.unshift("Property, deed, tax, probate, or heirship review flags still need to be cleared.");
    reviewFlags.push(...dossier.workflow.reviewFlags);
  }

  return {
    status: blockers.length ? "blocked" : "ready_for_draft_outreach",
    evaluatedAt: nowIso(),
    blockers: unique(blockers),
    nextAction: blockers.length
      ? includeDealMath
        ? "Clear the report, offer, contact, script, and compliance review items before any manual outreach."
        : "Clear the report, contact, script, and compliance review items before any manual outreach."
      : "Prepare manual outreach only; automated sends remain disabled.",
    reviewFlags: unique(reviewFlags),
  };
}

function buildNoAutoSendGuard(includeDealMath: boolean): NoAutoSendGuard {
  return {
    enabled: true,
    blockedActions: ["call", "voicemail", "text", "email", "letter"],
    reason: includeDealMath
      ? "S8 creates draft assets and manual tasks only. Automated calls, texts, emails, letters, and offers require future explicit approval."
      : "S8 creates draft assets and manual tasks only. Automated calls, texts, emails, and letters require future explicit approval.",
    reviewFlags: ["NO_AUTO_SEND_GUARD", "LIVE_OUTREACH_DISABLED", "OUTREACH_BLOCKED", "HUMAN_REVIEW_REQUIRED"],
  };
}

export function buildOutreachWorkflow(dossier: Omit<RawDossier, "outreach">, report?: CompletedLeadReport): OutreachWorkflow {
  const includeDealMath = includesDealMath(dossier);
  const assets = buildOutreachDraftAssets().filter((asset) => includeDealMath || !/offer|underwriting/i.test(`${asset.title} ${asset.intendedUse} ${asset.body}`));
  const readiness = buildReadiness(dossier, report);
  return {
    assets,
    complianceStatus: "needs_compliance_review",
    followUpTasks: buildFollowUpTasks(includeDealMath),
    readiness,
    noAutoSendGuard: buildNoAutoSendGuard(includeDealMath),
    notes: [
      "Scripts are draft reference material sourced from workflow_templates.md.",
      "Follow-up work is represented as manual operator tasks only.",
      includeDealMath
        ? "Joshua escalation is visible before manager calls, offers, or external documents."
        : "Joshua escalation is visible before manager calls or external documents.",
      "No live Podio writes or live outreach sends are enabled by this sprint.",
    ],
  };
}
