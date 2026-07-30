import type { FamilyRelationshipRole, FamilyTreeHypothesisData, IntakeSeed, ReviewFlag, SourceFact } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug, sourceRef } from "../lib";

const ROLE_LABELS: Record<FamilyRelationshipRole, string> = {
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  grandparent: "Grandparent",
  aunt_uncle: "Aunt/Uncle",
  cousin: "Cousin",
  niece_nephew: "Niece/Nephew",
};

function reviewCandidateNode(role: FamilyRelationshipRole, runId: string, fetchedAt: string): FamilyTreeHypothesisData["nodes"][number] {
  return {
    id: `${role}-review-candidate`,
    role,
    contactPlaceholder: `${ROLE_LABELS[role]} contact candidate needed`,
    confidence: 0,
    reviewStatus: "needs_review",
    sourceRefs: [sourceRef("intake", `${runId}:family-tree:${role}`, fetchedAt)],
    reviewFlags: ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as ReviewFlag[],
  };
}

export async function fetchFamilyTreeHypothesisFacts(runId: string, seed: IntakeSeed): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const rawId = `family-tree:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);
  const roles = Object.keys(ROLE_LABELS) as FamilyRelationshipRole[];
  const hypothesis: FamilyTreeHypothesisData = {
    status: "hypothesis",
    nodes: roles.map((role) => reviewCandidateNode(role, runId, fetchedAt)),
    unresolvedQuestions: [
      "Who is the surviving spouse, if any?",
      "Which children or descendants are known from public records?",
      "Are parents or siblings identified in probate, obituary, or court documents?",
      "Which relationships still need source evidence before contact enrichment?",
    ],
  };

  return [
    fact({
      runId,
      source: "intake",
      rawId: `${rawId}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "family_tree_status",
      value: "hypothesis",
      confidence: 0.5,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "intake",
      rawId: `${rawId}:hypothesis`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "family_tree_hypothesis",
      value: hypothesis,
      confidence: 0.5,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  ];
}
