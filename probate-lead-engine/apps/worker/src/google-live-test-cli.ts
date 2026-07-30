import { exportCompletedReport } from "./export/export-package";
import { runDryPipeline } from "./index";
import { jsonOutput } from "./storage/output-manifest";
import { persistOutput } from "./storage/write-output";

const testTitle = `HEIRRIGHT GOOGLE TEST - DO NOT WORK - ${new Date().toISOString()}`;

runDryPipeline({
  estateName: testTitle,
  propertyAddress: process.env.GOOGLE_TEST_PROPERTY_ADDRESS ?? "20611 NW 33rd Pl, Miami Gardens, FL 33056",
  ownerName: "HeirRight controlled Google Sheets test",
  caseNumber: process.env.GOOGLE_TEST_CASE_NUMBER ?? "HEIRRIGHT-GOOGLE-TEST",
  county: process.env.GOOGLE_TEST_COUNTY ?? "miami-dade",
  source: "operator_cli",
})
  .then((pipeline) => exportCompletedReport({
    routes: ["google"],
    dossier: pipeline.dossier,
    dryRun: false,
  }, process.env))
  .then((result) => {
    const output = jsonOutput("google-live-export-result.json", result);
    persistOutput(output);
    const googleRoute = result.routes.find((route) => route.route === "google");
    console.log(JSON.stringify({
      ok: result.ok,
      testTitle,
      mode: googleRoute?.mode,
      routeOk: googleRoute?.ok,
      readbackOk: googleRoute?.readbackOk,
      externalId: googleRoute?.externalId,
      url: googleRoute?.url,
      blockers: result.blockers,
      output: output.path,
    }, null, 2));
    if (!result.ok) process.exitCode = 1;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
