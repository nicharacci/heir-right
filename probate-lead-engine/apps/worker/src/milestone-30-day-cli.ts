import { generateThirtyDayMilestoneEvidence, renderThirtyDayClientReviewScriptMarkdown, renderThirtyDayMilestoneEvidenceMarkdown } from "./milestone/thirty-day-evidence";
import { renderReadbackEvidenceMarkdown } from "./readback/readback-evidence";
import { writeJsonOutput, writeTextOutput } from "./storage/write-output";

generateThirtyDayMilestoneEvidence()
  .then((evidence) => {
    const jsonPath = writeJsonOutput("thirty-day-milestone-evidence.json", evidence);
    const markdownPath = writeTextOutput("thirty-day-milestone-evidence.md", renderThirtyDayMilestoneEvidenceMarkdown(evidence));
    const reviewScriptPath = writeTextOutput("thirty-day-review-script.md", renderThirtyDayClientReviewScriptMarkdown(evidence));
    const readbackJsonPath = writeJsonOutput("readback-evidence.json", evidence.exportReadiness.readbackEvidence);
    const readbackMarkdownPath = writeTextOutput("readback-evidence.md", renderReadbackEvidenceMarkdown(evidence.exportReadiness.readbackEvidence));
    console.log(JSON.stringify({
      ok: true,
      milestone: evidence.milestone,
      overallStatus: evidence.overallStatus,
      blockedGateCount: evidence.gates.filter((gate) => gate.status === "blocked").length,
      rawLeadCount: evidence.dailyRun.rawLeadCount,
      qualifiedLeadCount: evidence.dailyRun.qualifiedLeadCount,
      outputs: {
        json: jsonPath,
        markdown: markdownPath,
        reviewScript: reviewScriptPath,
        readbackJson: readbackJsonPath,
        readbackMarkdown: readbackMarkdownPath,
      },
    }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
