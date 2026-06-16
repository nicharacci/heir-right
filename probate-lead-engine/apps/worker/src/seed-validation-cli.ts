import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { renderSeedValidationReportMarkdown, validateSeedBatchInput } from "./daily/seed-batch";
import { writeJsonOutput, writeTextOutput } from "./storage/write-output";

type RuntimeEnv = Record<string, string | undefined>;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function resolveInputPath(env: RuntimeEnv): string {
  const raw = arg("file") ?? env.DAILY_RUN_SEEDS_FILE ?? "input/production-seeds.json";
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

function loadInput(env: RuntimeEnv): { input: unknown; inputPath: string } {
  if (env.DAILY_RUN_SEEDS_JSON) {
    return {
      input: JSON.parse(env.DAILY_RUN_SEEDS_JSON),
      inputPath: "DAILY_RUN_SEEDS_JSON",
    };
  }

  const inputPath = resolveInputPath(env);
  if (!existsSync(inputPath)) {
    throw new Error(`No production seed file found at ${inputPath}. Add input/production-seeds.json or pass --file=<path>.`);
  }
  return {
    input: JSON.parse(readFileSync(inputPath, "utf8")),
    inputPath,
  };
}

function main(): void {
  const env = process.env;
  const { input, inputPath } = loadInput(env);
  const report = validateSeedBatchInput(input, env, inputPath);
  const jsonPath = writeJsonOutput("seed-import-report.json", report);
  const markdownPath = writeTextOutput("seed-import-report.md", renderSeedValidationReportMarkdown(report));

  console.log(JSON.stringify({
    ok: report.ok,
    batchId: report.batch.batchId,
    acceptedSeedCount: report.batch.acceptedSeedCount,
    rejectedSeedCount: report.batch.rejectedSeedCount,
    duplicateCount: report.batch.duplicateCount,
    issueCount: report.issues.length,
    jsonOutput: jsonPath,
    markdownOutput: markdownPath,
  }, null, 2));

  if (!report.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
