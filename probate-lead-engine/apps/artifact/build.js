const { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

mkdirSync(join(__dirname, "dist"), { recursive: true });
copyFileSync(join(__dirname, "src", "index.html"), join(__dirname, "dist", "index.html"));
const freshLeadBatchPath = join(__dirname, "..", "worker", "output", "fresh-lead-batch.json");
const distFreshLeadBatchPath = join(__dirname, "dist", "fresh-lead-batch.json");
let freshLeadBatch = null;
if (existsSync(freshLeadBatchPath)) {
  copyFileSync(freshLeadBatchPath, distFreshLeadBatchPath);
}
if (existsSync(distFreshLeadBatchPath)) {
  try {
    freshLeadBatch = JSON.parse(readFileSync(distFreshLeadBatchPath, "utf8"));
  } catch {
    freshLeadBatch = null;
  }
}
const latestRunPath = join(__dirname, "..", "worker", "output", "latest-run.json");
if (existsSync(latestRunPath)) {
  copyFileSync(latestRunPath, join(__dirname, "dist", "latest-run.json"));
} else if (freshLeadBatch?.latestRun?.dossier) {
  writeFileSync(join(__dirname, "dist", "latest-run.json"), `${JSON.stringify(freshLeadBatch.latestRun, null, 2)}\n`);
} else if (existsSync(join(__dirname, "demo", "latest-run.json"))) {
  copyFileSync(join(__dirname, "demo", "latest-run.json"), join(__dirname, "dist", "latest-run.json"));
}
const dailyRunPath = join(__dirname, "..", "worker", "output", "daily-run.json");
if (freshLeadBatch?.dailyRun) {
  writeFileSync(join(__dirname, "dist", "daily-run.json"), `${JSON.stringify(freshLeadBatch.dailyRun, null, 2)}\n`);
} else if (existsSync(dailyRunPath)) {
  copyFileSync(dailyRunPath, join(__dirname, "dist", "daily-run.json"));
} else if (existsSync(join(__dirname, "demo", "daily-run.json"))) {
  copyFileSync(join(__dirname, "demo", "daily-run.json"), join(__dirname, "dist", "daily-run.json"));
}
for (const name of ["qualification-review.json", "qualification-review.md", "readback-evidence.json", "readback-evidence.md", "thirty-day-review-script.md"]) {
  const path = join(__dirname, "..", "worker", "output", name);
  if (existsSync(path)) {
    copyFileSync(path, join(__dirname, "dist", name));
  } else if (existsSync(join(__dirname, "demo", name))) {
    copyFileSync(join(__dirname, "demo", name), join(__dirname, "dist", name));
  }
}
console.log("artifact built: dist/index.html");
