export type PipelineOutputName =
  | "latest-run.json"
  | "latest-dossier.json"
  | "podio-dry-run.json"
  | "internal-summary.md"
  | "internal-summary.html"
  | "completed-lead-report.md"
  | "completed-lead-report.html"
  | "daily-run.json"
  | "qualification-review.json"
  | "qualification-review.md"
  | "fresh-lead-batch.json"
  | "export-result.json"
  | "readback-evidence.json"
  | "readback-evidence.md"
  | "podio-live-export-result.json"
  | "connection-status.json"
  | "thirty-day-milestone-evidence.json"
  | "thirty-day-milestone-evidence.md"
  | "thirty-day-review-script.md";

export interface PipelineOutput {
  path: string;
  contentType: string;
  body: string;
}

export function jsonOutput(name: PipelineOutputName, data: unknown): PipelineOutput {
  return {
    path: `output/${name}`,
    contentType: "application/json; charset=utf-8",
    body: `${JSON.stringify(data, null, 2)}\n`,
  };
}

export function textOutput(name: PipelineOutputName, data: string, contentType = "text/plain; charset=utf-8"): PipelineOutput {
  return {
    path: `output/${name}`,
    contentType,
    body: data,
  };
}
