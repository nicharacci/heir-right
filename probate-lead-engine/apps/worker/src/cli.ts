import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runDryPipeline } from "./index";
import { persistOutput } from "./storage/write-output";

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function envSearchDirs(start: string): string[] {
  const dirs: string[] = [];
  let current = resolve(start);
  for (let index = 0; index < 8; index += 1) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs.reverse();
}

function loadLocalEnv(): void {
  const envFiles = envSearchDirs(process.cwd()).flatMap((dir) => [join(dir, ".env"), join(dir, ".env.local")]);
  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    const contents = readFileSync(envFile, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const cleaned = line.trim();
      if (!cleaned || cleaned.startsWith("#")) continue;
      const match = cleaned.match(/^(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;
      process.env[key] = stripEnvQuotes(rawValue);
    }
  }
}

loadLocalEnv();

runDryPipeline(undefined, { env: process.env })
  .then((result) => {
    for (const output of Object.values(result.outputFiles)) persistOutput(output);

    console.log(JSON.stringify({
      ok: true,
      runId: result.runId,
      status: result.dossier.status,
      workflowStatus: result.dossier.workflow.status,
      operatorQueueState: result.dossier.operatorQueue.state,
      displayName: result.dossier.summary.displayName,
      estateName: result.dossier.summary.estateName,
      estateSearchKey: result.dossier.summary.estateSearchKey,
      caseNumber: result.dossier.summary.caseNumber,
      nextBestAction: result.dossier.summary.nextBestAction,
      reviewFlags: result.dossier.audit.reviewFlags,
      outputs: result.outputs,
    }, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
