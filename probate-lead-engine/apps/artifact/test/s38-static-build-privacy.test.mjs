import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const repoRoot = path.resolve(artifactRoot, "../..");
const distRoot = path.join(artifactRoot, "dist");
const forbiddenPublicFiles = [
  "api/connections/status",
  "daily-run.json",
  "fresh-lead-batch.json",
  "latest-run.json",
  "qualification-review.json",
  "qualification-review.md",
  "readback-evidence.json",
  "readback-evidence.md",
  "thirty-day-review-script.md",
];

execFileSync(process.execPath, ["build.js"], {
  cwd: artifactRoot,
  env: { ...process.env, NODE_ENV: "development" },
  stdio: "pipe",
});
const developmentBundleSize = fs.statSync(path.join(distRoot, "assets", "app.js")).size;
assert.equal(fs.existsSync(path.join(distRoot, "assets", "app.js.map")), true, "development builds must retain external source maps for local debugging");

execFileSync(process.execPath, ["build.js", "--production"], {
  cwd: artifactRoot,
  env: { ...process.env, NODE_ENV: "development" },
  stdio: "pipe",
});
const productionBundlePath = path.join(distRoot, "assets", "app.js");
const productionBundleSize = fs.statSync(productionBundlePath).size;
assert.ok(productionBundleSize < developmentBundleSize, "the explicit production build must minify the browser bundle");
assert.equal(fs.existsSync(`${productionBundlePath}.map`), false, "the explicit production build must not emit a source map");
assert.doesNotMatch(fs.readFileSync(productionBundlePath, "utf8"), /sourceMappingURL=/, "the explicit production bundle must not reference a source map");
assert.deepEqual(
  JSON.parse(fs.readFileSync(path.join(distRoot, "assets", "webawesome", "package.json"), "utf8")),
  { private: true, type: "module" },
  "the self-hosted Web Awesome browser modules must retain an ESM package boundary during Vercel function tracing",
);
for (const relativePath of forbiddenPublicFiles) {
  assert.equal(fs.existsSync(path.join(distRoot, relativePath)), false, `${relativePath} must not be a public static asset`);
}

const topLevelEntries = fs.readdirSync(distRoot).sort();
assert.deepEqual(topLevelEntries, ["assets", "index.html"], "the public artifact root must contain only the inert shell and static code assets");
const publicShell = fs.readFileSync(path.join(distRoot, "index.html"), "utf8");
const publicBundle = fs.readFileSync(path.join(distRoot, "assets", "app.js"), "utf8");
assert.doesNotMatch(`${publicShell}\n${publicBundle}`, /Annie Hawkins|Catherine Etienne|Chusa Sylvestre|131\s+NW\s+67\s+ST|01-3113-008-0130|estate-of-annie-hawkins|Lucia Alvarez|Walter Green|Carmen Rosales|Harold Milton|Denise Parker|Samuel Baptiste|1840\s+NW\s+55|7230\s+NW\s+12|1551\s+SW\s+19|20215\s+NW\s+33|481\s+NW\s+102|930\s+NE\s+138/i);
assert.doesNotMatch(publicBundle, /Estate of Avery Example \(Sample\)|SAMPLE-CRM-001|TEST RECORD WAY[\s\S]*00000/, "the production browser bundle must not ship synthetic estate records or their placeholder addresses");

const rootVercelPath = path.join(repoRoot, "vercel.json");
const artifactVercelPath = path.join(artifactRoot, "vercel.json");
const rootVercel = JSON.parse(fs.readFileSync(rootVercelPath, "utf8"));
const artifactVercel = JSON.parse(fs.readFileSync(artifactVercelPath, "utf8"));

assert.deepEqual({
  buildCommand: rootVercel.buildCommand,
  installCommand: rootVercel.installCommand,
  outputDirectory: rootVercel.outputDirectory,
}, {
  buildCommand: "pnpm build:production",
  installCommand: "pnpm install --frozen-lockfile",
  outputDirectory: "apps/artifact/dist",
}, "the canonical repository-root deployment must retain its monorepo build contract");
assert.deepEqual({
  buildCommand: artifactVercel.buildCommand,
  installCommand: artifactVercel.installCommand,
  outputDirectory: artifactVercel.outputDirectory,
}, {
  buildCommand: "pnpm build:production",
  installCommand: "pnpm install --frozen-lockfile",
  outputDirectory: "dist",
}, "the artifact-root fallback must install its pinned build dependencies before compiling");
const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const artifactPackage = JSON.parse(fs.readFileSync(path.join(artifactRoot, "package.json"), "utf8"));
const idiExtractionShim = fs.readFileSync(path.join(artifactRoot, "api", "discovery", "idi-asset-search", "extract.js"), "utf8");
const idiExtractionRoute = fs.readFileSync(path.join(artifactRoot, "server", "idi-extract-handler.js"), "utf8");
assert.match(rootPackage.scripts["build:production"], /@ple\/artifact build:production/, "the repository-root release build must invoke the explicit artifact production build");
assert.equal(artifactPackage.scripts["build:production"], "node build.js --production", "the artifact release build must explicitly enable production mode");
assert.match(idiExtractionShim, /runtime-functions\/idi-extract\.cjs/, "the serverless route must invoke the generated dependency bundle");
assert.match(idiExtractionRoute, /PDF_EXTRACTION_RUNTIME_ROOT = join\(__dirname, "\.\.\/runtime-assets"\)/, "the serverless PDF extractor must use the generated runtime asset directory");
assert.doesNotMatch(idiExtractionRoute, /require\.resolve\("pdfjs-dist\//, "the serverless PDF extractor must not trace the pnpm package symlink tree");
assert.match(idiExtractionRoute, /require\(DOM_MATRIX_MODULE_PATH\)/, "the serverless PDF extractor must load the packaged pure-JavaScript DOMMatrix required by PDF.js");
assert.match(idiExtractionRoute, /import\(PDFJS_MODULE_URL\)/, "the serverless PDF extractor must load the packaged PDF.js runtime");
assert.match(idiExtractionRoute, /PDFJS_WORKER_MODULE_URL/, "the serverless PDF extractor must use the packaged fake-worker module required by PDF.js in Node");
assert.equal(artifactPackage.dependencies?.["@napi-rs/canvas"], "0.1.100", "the PDF.js DOMMatrix runtime must be a direct pinned production dependency");
assert.equal(rootVercel.functions?.["api/discovery/idi-asset-search/extract.js"]?.includeFiles, "apps/artifact/{runtime-assets,runtime-functions}/**", "the canonical extraction function must include its generated bundle and runtime assets");
assert.equal(artifactVercel.functions?.["api/discovery/idi-asset-search/extract.js"]?.includeFiles, "{runtime-assets,runtime-functions}/**", "the artifact-root extraction function must include its generated bundle and runtime assets");
assert.equal(artifactVercel.functions?.["api/**/*.js"]?.maxDuration, 60, "the artifact-root fallback must preserve the API execution budget");
assert.equal(rootVercel.functions?.["api/**/*.js"]?.excludeFiles, "apps/artifact/dist/**/*.map", "the canonical Vercel functions must exclude browser source maps from serverless traces");
assert.equal(artifactVercel.functions?.["api/**/*.js"]?.excludeFiles, "dist/**/*.map", "the artifact-root Vercel fallback must exclude browser source maps from serverless traces");

for (const [configPath, config] of [[rootVercelPath, rootVercel], [artifactVercelPath, artifactVercel]]) {
  const rewrites = new Map(config.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));
  for (const name of ["latest-run.json", "daily-run.json", "fresh-lead-batch.json", "qualification-review.json"]) {
    assert.equal(rewrites.get(`/${name}`), `/api/runtime-artifact?name=${name}`, `${path.relative(repoRoot, configPath)} must route ${name} through authenticated runtime data`);
  }
}

const savedEnv = {
  AUTH_REQUIRED: process.env.AUTH_REQUIRED,
  AUTH_ALLOWED_DOMAINS: process.env.AUTH_ALLOWED_DOMAINS,
  AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
  HEIRRIGHT_WORKER_URL: process.env.HEIRRIGHT_WORKER_URL,
  WORKER_API_URL: process.env.WORKER_API_URL,
  WORKER_BASE_URL: process.env.WORKER_BASE_URL,
};

function callHandler(handler, { name, method = "GET", cookie = "" } = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      method,
      url: `/api/runtime-artifact?name=${encodeURIComponent(name || "")}`,
      query: { name },
      headers: cookie ? { cookie } : {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
      end(body = "") { resolve({ statusCode: this.statusCode, headers: this.headers, body: String(body) }); },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

try {
  process.env.AUTH_REQUIRED = "true";
  process.env.AUTH_ALLOWED_DOMAINS = "heirright.com";
  process.env.AUTH_SESSION_SECRET = "s38-static-build-privacy-secret";
  delete process.env.HEIRRIGHT_WORKER_URL;
  delete process.env.WORKER_API_URL;
  delete process.env.WORKER_BASE_URL;

  const auth = require("../api/auth/_shared.js");
  const handler = require("../api/runtime-artifact.js");
  const names = ["latest-run.json", "daily-run.json", "fresh-lead-batch.json", "qualification-review.json"];
  for (const name of names) {
    const denied = await callHandler(handler, { name });
    assert.equal(denied.statusCode, 401, `${name} must reject an unauthenticated request`);
    assert.equal(JSON.parse(denied.body).error, "auth_required");
  }

  const token = auth.createSessionToken({ email: "operator@heirright.com", name: "Operator" });
  const cookie = `hr_session=${encodeURIComponent(token)}`;
  const latest = await callHandler(handler, { name: "latest-run.json", cookie });
  assert.equal(latest.statusCode, 200);
  assert.ok(JSON.parse(latest.body).dossier, "an authenticated operator must still receive a usable latest-run fallback");
  assert.equal(latest.headers["cache-control"], "no-store");

  const missing = await callHandler(handler, { name: "readback-evidence.json", cookie });
  assert.equal(missing.statusCode, 404, "unlisted evidence payloads must stay unavailable rather than becoming a generic file reader");
} finally {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "explicit_production_bundle_minified",
    "explicit_production_source_maps_disabled",
    "self_hosted_browser_modules_preserve_esm_boundary",
    "operator_json_absent_from_public_dist",
    "public_runtime_urls_rewrite_to_authenticated_handler",
    "unauthenticated_runtime_artifacts_denied",
    "authenticated_latest_run_remains_usable",
    "runtime_artifact_allowlist_blocks_arbitrary_evidence_reads",
  ],
}, null, 2));
