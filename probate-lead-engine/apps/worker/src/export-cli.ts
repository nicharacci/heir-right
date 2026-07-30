import { runDryPipeline } from "./index";
import { connectionStatuses, exportCompletedReport } from "./export/export-package";
import { buildReadbackEvidencePacket, renderReadbackEvidenceMarkdown } from "./readback/readback-evidence";
import { jsonOutput, textOutput } from "./storage/output-manifest";
import { persistOutput } from "./storage/write-output";

const dryRunEnv = {
  ...process.env,
  GOOGLE_WORKSPACE_ACCESS_TOKEN: process.env.GOOGLE_WORKSPACE_ACCESS_TOKEN ?? "dry-run-google-token",
  GOOGLE_TRACKING_SHEET_ID: process.env.GOOGLE_TRACKING_SHEET_ID ?? "dry-run-sheet",
  PODIO_ACCESS_TOKEN: process.env.PODIO_ACCESS_TOKEN ?? "dry-run-podio-token",
  PODIO_APP_ID: process.env.PODIO_APP_ID ?? "dry-run-app",
  PODIO_FIELD_MAP_JSON: process.env.PODIO_FIELD_MAP_JSON ?? JSON.stringify({
    title: "title",
    property_address: "property_address",
    county: "county",
    lead_bucket: "lead_bucket",
    report_link: "report_link",
  }),
};

runDryPipeline()
  .then((pipeline) => exportCompletedReport({
    routes: ["google", "podio"],
    dossier: pipeline.dossier,
    dryRun: true,
  }, dryRunEnv))
  .then((result) => {
    const output = jsonOutput("export-result.json", result);
    persistOutput(output);
    return connectionStatuses(dryRunEnv).then((statuses) => {
      const readbackPacket = buildReadbackEvidencePacket(result, statuses);
      const readbackJson = jsonOutput("readback-evidence.json", readbackPacket);
      const readbackMarkdown = textOutput("readback-evidence.md", renderReadbackEvidenceMarkdown(readbackPacket), "text/markdown; charset=utf-8");
      persistOutput(readbackJson);
      persistOutput(readbackMarkdown);
      console.log(JSON.stringify({
        ok: result.ok,
        routes: result.routes.map((route) => ({
          route: route.route,
          ok: route.ok,
          mode: route.mode,
          readbackOk: route.readbackOk,
          blockers: route.blockers,
        })),
        blockers: result.blockers,
        output: output.path,
        readbackEvidence: {
          json: readbackJson.path,
          markdown: readbackMarkdown.path,
          status: readbackPacket.overallStatus,
        },
      }, null, 2));
    });
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
