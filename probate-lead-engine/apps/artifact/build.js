const { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { buildConnectionStatuses } = require("./api/connections/status.js");

const distDir = join(__dirname, "dist");
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
copyFileSync(join(__dirname, "src", "index.html"), join(distDir, "index.html"));
const freshLeadBatchPath = join(__dirname, "..", "worker", "output", "fresh-lead-batch.json");
const demoFreshLeadBatchPath = join(__dirname, "demo", "fresh-lead-batch.json");
const distFreshLeadBatchPath = join(distDir, "fresh-lead-batch.json");
let freshLeadBatch = null;
if (existsSync(freshLeadBatchPath)) {
  copyFileSync(freshLeadBatchPath, distFreshLeadBatchPath);
} else if (existsSync(demoFreshLeadBatchPath)) {
  copyFileSync(demoFreshLeadBatchPath, distFreshLeadBatchPath);
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
  copyFileSync(latestRunPath, join(distDir, "latest-run.json"));
} else if (existsSync(join(__dirname, "demo", "latest-run.json"))) {
  copyFileSync(join(__dirname, "demo", "latest-run.json"), join(distDir, "latest-run.json"));
} else if (freshLeadBatch?.latestRun?.dossier) {
  writeFileSync(join(distDir, "latest-run.json"), `${JSON.stringify(freshLeadBatch.latestRun, null, 2)}\n`);
}
const dailyRunPath = join(__dirname, "..", "worker", "output", "daily-run.json");
if (freshLeadBatch?.dailyRun) {
  writeFileSync(join(distDir, "daily-run.json"), `${JSON.stringify(freshLeadBatch.dailyRun, null, 2)}\n`);
} else if (existsSync(dailyRunPath)) {
  copyFileSync(dailyRunPath, join(distDir, "daily-run.json"));
} else if (existsSync(join(__dirname, "demo", "daily-run.json"))) {
  copyFileSync(join(__dirname, "demo", "daily-run.json"), join(distDir, "daily-run.json"));
}
for (const name of ["qualification-review.json", "qualification-review.md", "readback-evidence.json", "readback-evidence.md", "thirty-day-review-script.md"]) {
  const path = join(__dirname, "..", "worker", "output", name);
  if (existsSync(path)) {
    copyFileSync(path, join(distDir, name));
  } else if (existsSync(join(__dirname, "demo", name))) {
    copyFileSync(join(__dirname, "demo", name), join(distDir, name));
  }
}

function writeJsonFallback(relativePath, value) {
  const target = join(distDir, relativePath);
  if (existsSync(target)) return;
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

writeJsonFallback("auth/session", {
  authenticated: false,
  user: null,
  auth: {
    required: false,
    configured: false,
    allowedDomains: ["heirright.com"],
    allowedEmails: [],
  },
});
writeJsonFallback("api/connections/status", buildConnectionStatuses(process.env, {
  freshBatchExists: existsSync(distFreshLeadBatchPath),
  latestRunExists: existsSync(join(distDir, "latest-run.json")),
}));
writeJsonFallback("fresh-lead-batch.json", { leadRuns: [] });
writeJsonFallback("daily-run.json", null);
writeJsonFallback("qualification-review.json", null);
console.log("artifact built: dist/index.html");
