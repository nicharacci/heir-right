const { copyFileSync, existsSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

mkdirSync(join(__dirname, "dist"), { recursive: true });
copyFileSync(join(__dirname, "src", "index.html"), join(__dirname, "dist", "index.html"));
const latestRunPath = join(__dirname, "..", "worker", "output", "latest-run.json");
if (existsSync(latestRunPath)) {
  copyFileSync(latestRunPath, join(__dirname, "dist", "latest-run.json"));
} else if (existsSync(join(__dirname, "demo", "latest-run.json"))) {
  copyFileSync(join(__dirname, "demo", "latest-run.json"), join(__dirname, "dist", "latest-run.json"));
}
const dailyRunPath = join(__dirname, "..", "worker", "output", "daily-run.json");
if (existsSync(dailyRunPath)) {
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
