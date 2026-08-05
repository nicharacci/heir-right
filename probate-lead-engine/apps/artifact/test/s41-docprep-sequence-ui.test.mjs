import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

const artifactRoot = path.resolve(import.meta.dirname, "..");
const sequenceModulePath = path.join(
  artifactRoot,
  "src/features/doc-prep-beui/sequence-model.js",
);
const model = await import(pathToFileURL(sequenceModulePath).href);

const stages = model.DOC_PREP_SEQUENCE;

function processCase({ state = "sourcing", steps = [], events = [], artifact } = {}) {
  return {
    id: "case-s41-proof",
    state,
    steps,
    events,
    ...(artifact ? { artifact } : {}),
  };
}

function step(id, state, extra = {}) {
  return { id, state, ...extra };
}

test("keeps the canonical persisted six-stage order and copy", () => {
  assert.deepEqual(
    stages.map((stage) => stage.id),
    [
      "skip_trace_parse",
      "obituary_search",
      "deed_title_search",
      "tax_receipt_fetch",
      "court_records_search",
      "backstory_generate",
    ],
  );
  assert.deepEqual(
    stages.map((stage) => stage.title),
    [
      "Parsing Skip Trace Report",
      "Searching Obituary",
      "Searching for Deeds or Titles",
      "Fetching Tax Receipt",
      "Searching Court Records",
      "Generating Back Story",
    ],
  );
  assert.deepEqual(
    stages.map((stage) => stage.detail),
    [
      "Filling out Potential Heirs, Contact information…",
      "Gathering vital obituary, marriage &amp; related records…",
      "Checking official records….",
      "Pulling from public Tax Collector’s Office records….",
      "Probate, Civil, Family Courts…..",
      "Using Solvys systems….",
    ],
  );
  assert.equal(model.displayStageCopy(stages[1].detail), "Gathering vital obituary, marriage & related records…");
});

test("derives active, review, blocked, failed, stopped, and complete from durable state", () => {
  const active = model.deriveSequence(
    processCase({
      steps: [
        step(stages[0].id, "succeeded"),
        step(stages[1].id, "running"),
      ],
    }),
  );
  assert.equal(active.stages[0].state, "complete");
  assert.equal(active.currentTask.id, stages[1].id);
  assert.equal(active.currentTask.state, "active");
  assert.deepEqual(
    active.completedPredecessors.map((stage) => stage.id),
    [stages[0].id],
  );
  assert.equal(active.island.state, "active");

  const review = model.deriveSequence(
    processCase({
      state: "review_required",
      steps: [
        step(stages[0].id, "review_required", {
          detail: "A selected persisted IDI report is required before skip-trace parsing.",
          nextAction: "Select the uploaded IDI report for this estate and retry this stage.",
        }),
      ],
    }),
  );
  assert.equal(review.currentTask.state, "review");
  assert.equal(review.island.state, "review");
  assert.equal(model.actionAvailability(reviewCase(review), { events: [] }).requiresIdiReview, true);

  const blocked = model.deriveSequence(
    processCase({ state: "blocked", steps: [step(stages[0].id, "blocked")] }),
  );
  assert.equal(blocked.currentTask.state, "blocked");
  assert.equal(blocked.island.state, "blocked");

  const failed = model.deriveSequence(
    processCase({ state: "failed", steps: [step(stages[0].id, "failed")] }),
  );
  assert.equal(failed.currentTask.state, "failed");
  assert.equal(failed.island.state, "failed");

  const stopped = model.deriveSequence(
    processCase({
      state: "cancelled",
      steps: [step(stages[0].id, "succeeded"), step(stages[1].id, "running")],
    }),
  );
  assert.equal(stopped.stages[1].state, "stopped");
  assert.equal(stopped.island.state, "stopped");

  const complete = model.deriveSequence(
    processCase({
      state: "packet_ready",
      steps: stages.map((stage) => step(stage.id, "succeeded")),
      artifact: {
        contentType: "application/pdf",
        readbackStatus: "verified",
        sha256: "a".repeat(64),
      },
    }),
  );
  assert.equal(complete.currentTask, null);
  assert.equal(complete.island.state, "complete");
  assert.equal(complete.stages.every((stage) => stage.state === "complete"), true);
});

function reviewCase(sequence) {
  return processCase({
    state: "review_required",
    steps: [
      step(stages[0].id, "review_required", {
        detail: sequence.currentTask.operatorText,
        nextAction: sequence.currentTask.nextAction,
      }),
    ],
  });
}

test("keeps actions durable, review-safe, and duplicate-start safe", () => {
  const noCase = model.actionAvailability(null, { pendingAction: undefined });
  assert.equal(noCase.canStart, true);

  const review = processCase({
    state: "review_required",
    steps: [
      step(stages[0].id, "review_required", {
        nextAction: "Select the uploaded IDI report for this estate and retry this stage.",
      }),
    ],
  });
  const availability = model.actionAvailability(review, { pendingAction: undefined });
  assert.equal(availability.canStart, false);
  assert.equal(availability.canRetry, true);
  assert.equal(availability.canStop, true);
  assert.equal(availability.requiresIdiReview, true);
  assert.equal(availability.firstIncompleteStageId, stages[0].id);
  assert.equal(
    model.actionAvailability(review, { pendingAction: "start" }).canStart,
    false,
  );
  assert.equal(
    model.actionAvailability(review, { pendingAction: "retry" }).canRetry,
    false,
  );
  assert.equal(
    model.actionAvailability(processCase({ state: "packet_ready" }), {}).canStop,
    false,
  );
});

test("only exposes verified artifact routes and safe repair references", () => {
  const unverified = processCase({
    state: "packet_ready",
    artifact: {
      contentType: "application/pdf",
      readbackStatus: "pending",
      sha256: "a".repeat(64),
    },
  });
  assert.equal(model.verifiedArtifact(unverified), false);
  assert.equal(model.artifactLinks(unverified), null);

  const verified = processCase({
    state: "packet_ready",
    artifact: {
      contentType: "application/pdf",
      readbackStatus: "verified",
      sha256: "b".repeat(64),
    },
  });
  assert.deepEqual(model.artifactLinks(verified), {
    previewUrl: "/api/doc-prep/cases/case-s41-proof/view",
    downloadUrl: "/api/doc-prep/cases/case-s41-proof/download",
  });

  const repairable = processCase({
    state: "failed",
    steps: [
      step(stages[0].id, "failed", {
        repairReference: {
          url: "https://linear.app/solvys/issue/HR-123/provider-failure",
        },
      }),
    ],
  });
  const repaired = model.deriveSequence(repairable).currentTask.repairReference;
  assert.equal(repaired.href, "https://linear.app/solvys/issue/HR-123/provider-failure");
  assert.equal(
    model.repairReference(null, {
      repairReference: {
        url: "https://linear.example/solvys/issue/HR-123/provider-failure",
      },
    }),
    null,
  );
  assert.deepEqual(
    model.repairReference(
      processCase({
        state: "failed",
        steps: [step(stages[0].id, "failed", { detail: "raw provider payload" })],
      }),
      repairable.steps[0],
    ),
    repaired,
  );
});

test("does not surface raw event details, provider payloads, secrets, or private contacts", () => {
  const derived = model.deriveSequence(
    processCase({
      state: "failed",
      steps: [
        step(stages[0].id, "failed", {
          detail: "token=not-for-display contact=private@example.com stack=Error: raw payload",
          nextAction: "https://provider.example/private",
        }),
      ],
      events: [
        {
          id: "event-secret",
          stageId: stages[0].id,
          state: "failed",
          occurredAt: "2026-08-05T00:00:00.000Z",
          detail: "raw provider payload token=secret",
        },
      ],
    }),
    [
      {
        id: "event-secret-2",
        stageId: stages[0].id,
        state: "failed",
        occurredAt: "2026-08-05T00:01:00.000Z",
        providerPayload: "private payload",
      },
    ],
  );
  const islandText = JSON.stringify({
    island: derived.island,
    currentTask: derived.currentTask,
    completedPredecessors: derived.completedPredecessors,
  });
  assert.doesNotMatch(islandText, /not-for-display|private@example\.com|raw provider|secret/);
  assert.doesNotMatch(islandText, /providerPayload|raw provider payload/);
  assert.equal(derived.currentTask.operatorText, "The process could not complete this stage.");
});

test("keeps the durable six-stage model while removing the duplicate full-page surface", () => {
  const entry = readFileSync(path.join(artifactRoot, "src/entry.js"), "utf8");
  const currentRegister = readFileSync(
    path.join(artifactRoot, "src/features/doc-prep/register.js"),
    "utf8",
  );
  assert.doesNotMatch(entry, /doc-prep-beui/);
  assert.match(currentRegister, /s40-doc-prep/);
  assert.equal(
    existsSync(path.join(artifactRoot, "src/features/doc-prep-beui/doc-prep-sequence.tsx")),
    false,
  );
  assert.equal(existsSync(path.join(artifactRoot, "src/styles/doc-prep-beui.css")), false);
});
