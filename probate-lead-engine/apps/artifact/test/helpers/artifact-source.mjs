import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const artifactRoot = path.dirname(testRoot);
const sourceRoot = path.join(artifactRoot, "src");
const distRoot = path.join(artifactRoot, "dist");

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(entryPath);
      return entry.isFile() && /\.(?:html|css|js)$/.test(entry.name) ? [entryPath] : [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function readFiles(files) {
  return files.map((file) => `\n/* ${path.relative(artifactRoot, file)} */\n${fs.readFileSync(file, "utf8")}`).join("\n");
}

function readArtifactSource() {
  const priority = [
    path.join(sourceRoot, "index.html"),
    path.join(sourceRoot, "legacy", "app.js"),
    path.join(sourceRoot, "styles", "legacy.css"),
  ];
  const prioritized = new Set(priority);
  return readFiles([
    ...priority,
    ...sourceFiles(sourceRoot).filter((file) => !prioritized.has(file)),
  ]);
}

function readArtifactDist() {
  return readFiles([
    path.join(distRoot, "index.html"),
    path.join(distRoot, "assets", "app.js"),
    path.join(distRoot, "assets", "app.css"),
  ]);
}

export { artifactRoot, distRoot, readArtifactDist, readArtifactSource, sourceRoot };
