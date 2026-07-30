import { runDailyProduction } from "./daily/run-daily";
import { renderQualificationReviewMarkdown } from "./qualification/qualification-review";
import { jsonOutput, textOutput } from "./storage/output-manifest";
import { persistOutput } from "./storage/write-output";

runDailyProduction()
  .then((result) => {
    const output = jsonOutput("daily-run.json", result);
    const reviewJson = jsonOutput("qualification-review.json", result.qualificationReview);
    const reviewMarkdown = textOutput("qualification-review.md", renderQualificationReviewMarkdown(result.qualificationReview), "text/markdown; charset=utf-8");
    persistOutput(output);
    persistOutput(reviewJson);
    persistOutput(reviewMarkdown);
    console.log(JSON.stringify({
      ok: result.errorCount === 0,
      id: result.id,
      counties: result.config.counties,
      rawLeadCount: result.rawLeadCount,
      qualifiedLeadCount: result.qualifiedLeadCount,
      reviewLeadCount: result.reviewLeadCount,
      duplicateCount: result.duplicateCount,
      errorCount: result.errorCount,
      missedVolumeReasons: result.missedVolumeReasons,
      outputs: {
        dailyRun: output.path,
        qualificationReviewJson: reviewJson.path,
        qualificationReviewMarkdown: reviewMarkdown.path,
      },
    }, null, 2));
    if (result.errorCount > 0) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
