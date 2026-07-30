import type { OperatorQueue, OperatorQueueItem, OperatorQueueState, RawDossier, ReviewFlag } from "@ple/types";

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function rank(state: OperatorQueueState): number {
  if (state === "disqualified") return 4;
  if (state === "blocked") return 3;
  if (state === "manual_review") return 2;
  return 1;
}

function item(input: OperatorQueueItem): OperatorQueueItem {
  return {
    ...input,
    reviewFlags: unique(input.reviewFlags),
    sourceRefs: unique(input.sourceRefs),
  };
}

export function buildOperatorQueue(dossier: Omit<RawDossier, "operatorQueue" | "evidenceQa" | "sourceCoverage" | "outreach">): OperatorQueue {
  const items: OperatorQueueItem[] = [];
  const auditFlags = dossier.audit.reviewFlags;

  for (const rule of dossier.workflow.rules) {
    if (rule.status === "stop") {
      items.push(item({
        code: rule.code,
        label: rule.label,
        state: "disqualified",
        reason: rule.explanation,
        nextAction: "Move this lead out of the active queue. Correct and rerun the source record if the stop fact is wrong.",
        sourceRefs: rule.sourceRefs,
        reviewFlags: rule.reviewFlags,
      }));
    } else if (rule.status === "review_required") {
      items.push(item({
        code: rule.code,
        label: rule.label,
        state: "manual_review",
        reason: rule.explanation,
        nextAction: "Review the county-record evidence and decide whether this item can move forward.",
        sourceRefs: rule.sourceRefs,
        reviewFlags: rule.reviewFlags,
      }));
    }
  }

  if (auditFlags.includes("SOURCE_BLOCKED")) {
    items.push(item({
      code: "SOURCE_BLOCKED",
      label: "Source blocked",
      state: "blocked",
      reason: "At least one required public source could not be reached or extracted.",
      nextAction: "Use the manual source path or retry after the blocker is resolved.",
      sourceRefs: dossier.audit.sourceRefs,
      reviewFlags: ["SOURCE_BLOCKED"],
    }));
  }

  const missingFactFlags = auditFlags.filter((flag): flag is ReviewFlag => flag.startsWith("MISSING_"));
  if (missingFactFlags.length) {
    items.push(item({
      code: "MISSING_FACTS",
      label: "Missing source facts",
      state: "manual_review",
      reason: "One or more property, tax, deed, title, or owner facts are still missing.",
      nextAction: "Open the lead report and resolve the listed review flags before enrichment, CRM writes, or outreach.",
      sourceRefs: dossier.audit.sourceRefs,
      reviewFlags: missingFactFlags,
    }));
  }

  if (!items.length) {
    return {
      state: "ready_for_review",
      reasonCodes: ["READY_FOR_OPERATOR_REVIEW"],
      nextAction: "Review the completed record-backed lead packet before any external action.",
      items: [],
    };
  }

  const state = items.reduce((highest, candidate) => rank(candidate.state) > rank(highest) ? candidate.state : highest, "ready_for_review" as OperatorQueueState);

  return {
    state,
    reasonCodes: unique(items.map((entry) => entry.code)),
    nextAction: state === "disqualified"
      ? "Inspect the disqualification reason and keep the lead out of the active queue unless corrected source evidence removes the stop."
      : state === "blocked"
        ? "Resolve the source blocker before continuing this lead."
        : "Clear the manual review items before enrichment, CRM writes, document prep, or outreach.",
    items,
  };
}
