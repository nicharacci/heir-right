import { readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceRoots = ["api", "e2e", "scripts", "src", "test"];

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(target);
    return [".js", ".mjs"].includes(extname(entry.name)) ? [target] : [];
  });
}

const files = [
  join(packageRoot, "build.js"),
  join(packageRoot, "server.js"),
  ...sourceRoots.flatMap((directory) => javascriptFiles(join(packageRoot, directory))),
].sort();

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  if (result.status === 0) continue;
  failed = true;
  process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`artifact lint passed (${files.length} JavaScript modules)`);
}
