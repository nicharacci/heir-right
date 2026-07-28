import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const repoRoot = path.resolve(artifactRoot, "../..");
const functionRoot = path.join(
  repoRoot,
  ".vercel/output/functions/api/discovery/idi-asset-search/extract.func",
);

assert.ok(
  fs.existsSync(functionRoot),
  "run `vercel build --prod --yes` before the Vercel trace test",
);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : entry.isFile() ? [target] : [];
  });
}

const normalize = (value) => value.split(path.sep).join("/");
const config = JSON.parse(fs.readFileSync(path.join(functionRoot, ".vc-config.json"), "utf8"));
const filePathMap = config.filePathMap || {};
const mappedFiles = Object.keys(filePathMap).map(normalize);
const files = [...new Set([...walk(functionRoot).map(normalize), ...mappedFiles])];
const matches = (suffix) => files.filter((file) => file.endsWith(suffix));

for (const source of Object.values(filePathMap)) {
  assert.ok(
    fs.existsSync(path.resolve(repoRoot, source)),
    `the Vercel trace source must exist: ${source}`,
  );
}

assert.ok(
  matches("/node_modules/pdfjs-dist/package.json").length > 0,
  "the extraction function trace must preserve pdfjs-dist package resolution",
);
assert.ok(
  matches("/node_modules/@napi-rs/canvas/package.json").length > 0,
  "the extraction function trace must preserve DOMMatrix package resolution",
);
assert.ok(
  matches("/node_modules/pdfjs-dist/legacy/build/pdf.mjs").length > 0,
  "the extraction function must contain the pdfjs runtime module",
);
assert.ok(
  matches("/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs").length > 0,
  "the extraction function must contain the pdfjs fake-worker module required in Node",
);
assert.ok(
  matches("/node_modules/@napi-rs/canvas/geometry.js").length > 0,
  "the extraction function must contain the pure-JavaScript DOMMatrix required by PDF.js",
);
assert.equal(
  files.filter((file) => file.endsWith(".map")).length,
  0,
  "the production extraction function must not trace source maps",
);
assert.equal(
  files.filter((file) => /\/node_modules\/@napi-rs\/canvas-[^/]+\//.test(file) || file.endsWith(".node")).length,
  0,
  "the cross-platform extraction function must not trace a host-specific native canvas binding",
);

const sourceFontDir = path.dirname(require.resolve("pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf"));
const expectedFonts = fs.readdirSync(sourceFontDir)
  .filter((name) => /\.(?:pfb|ttf)$/i.test(name))
  .sort();

assert.ok(expectedFonts.length > 0, "the installed pdfjs package must expose standard fonts");
for (const font of expectedFonts) {
  assert.ok(
    matches(`/node_modules/pdfjs-dist/standard_fonts/${font}`).length > 0,
    `the extraction trace must contain pdfjs standard font ${font}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "pdfjs_package_resolution_traced",
    "pdfjs_dommatrix_package_resolution_traced",
    "pdfjs_runtime_module_traced",
    "pdfjs_worker_module_traced",
    "pdfjs_dommatrix_runtime_traced",
    "pdfjs_standard_fonts_traced",
    "production_trace_has_no_source_maps",
    "production_trace_has_no_native_canvas_binding",
  ],
  standardFontCount: expectedFonts.length,
}, null, 2));
