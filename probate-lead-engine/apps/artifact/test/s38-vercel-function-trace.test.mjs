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
const estateImportFunctionRoot = path.join(
  repoRoot,
  ".vercel/output/functions/api/agentic/estate-import.func",
);

assert.ok(
  fs.existsSync(functionRoot),
  "run `vercel build --prod --yes` before the Vercel trace test",
);
assert.ok(
  fs.existsSync(estateImportFunctionRoot),
  "the root Vercel build must emit the estate-file import function",
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
const estateImportConfig = JSON.parse(fs.readFileSync(path.join(estateImportFunctionRoot, ".vc-config.json"), "utf8"));
const estateImportFilePathMap = estateImportConfig.filePathMap || {};
const estateImportFiles = [...new Set([
  ...walk(estateImportFunctionRoot).map(normalize),
  ...Object.keys(estateImportFilePathMap).map(normalize),
])];
const estateImportMatches = (suffix) => estateImportFiles.filter((file) => file.endsWith(suffix));

for (const source of Object.values(filePathMap)) {
  assert.ok(
    fs.existsSync(path.resolve(repoRoot, source)),
    `the Vercel trace source must exist: ${source}`,
  );
}
for (const source of Object.values(estateImportFilePathMap)) {
  assert.ok(
    fs.existsSync(path.resolve(repoRoot, source)),
    `the estate-import Vercel trace source must exist: ${source}`,
  );
}

assert.ok(
  matches("/runtime-functions/idi-extract.cjs").length > 0,
  "the extraction function must contain its generated dependency bundle",
);
assert.ok(
  estateImportMatches("/runtime-functions/idi-extract.cjs").length > 0,
  "the estate-import function must contain its generated extraction bundle",
);
assert.ok(
  estateImportMatches("/runtime-assets/pdfjs-dist/legacy/build/pdf.mjs").length > 0,
  "the estate-import function must trace the searchable-PDF runtime",
);
assert.ok(
  matches("/runtime-assets/pdfjs-dist/package.json").length > 0,
  "the extraction function trace must preserve the packaged pdfjs-dist runtime",
);
assert.ok(
  matches("/runtime-assets/@napi-rs/canvas/package.json").length > 0,
  "the extraction function trace must preserve the packaged DOMMatrix runtime",
);
assert.ok(
  matches("/runtime-assets/pdfjs-dist/legacy/build/pdf.mjs").length > 0,
  "the extraction function must contain the pdfjs runtime module",
);
assert.ok(
  matches("/runtime-assets/pdfjs-dist/legacy/build/pdf.worker.mjs").length > 0,
  "the extraction function must contain the pdfjs fake-worker module required in Node",
);
assert.ok(
  matches("/runtime-assets/@napi-rs/canvas/geometry.js").length > 0,
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
    matches(`/runtime-assets/pdfjs-dist/standard_fonts/${font}`).length > 0,
    `the extraction trace must contain pdfjs standard font ${font}`,
  );
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "idi_extraction_dependency_bundle_traced",
    "pdfjs_runtime_assets_traced",
    "pdfjs_dommatrix_runtime_assets_traced",
    "pdfjs_runtime_module_traced",
    "pdfjs_worker_module_traced",
    "pdfjs_dommatrix_runtime_traced",
    "pdfjs_standard_fonts_traced",
    "production_trace_has_no_source_maps",
    "production_trace_has_no_native_canvas_binding",
    "estate_import_extraction_bundle_traced",
    "estate_import_pdf_runtime_traced",
  ],
  standardFontCount: expectedFonts.length,
}, null, 2));
