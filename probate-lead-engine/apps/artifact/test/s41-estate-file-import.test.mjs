import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const repoRoot = path.resolve(artifactRoot, "../..");
const readArtifact = (relativePath) => fs.readFileSync(path.join(artifactRoot, relativePath), "utf8");
const readRepo = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

function callApi(handler, { method = "POST", body = {} } = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      method,
      body,
      url: "/api/agentic/estate-import",
      headers: { host: "surface.heirright.com", "x-forwarded-proto": "https" },
      on() {},
      destroy() {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
      writeHead(status, values = {}) {
        this.statusCode = status;
        for (const [key, value] of Object.entries(values)) this.setHeader(key, value);
      },
      end(payload = "") { resolve({ statusCode: this.statusCode, headers: this.headers, text: String(payload || "") }); },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

const extractionRuntime = require(path.join(artifactRoot, "runtime-functions", "idi-extract.cjs"));
assert.equal(typeof extractionRuntime.extractEstateUpload, "function", "the generated extraction bundle must expose estate-file extraction");

const csv = Buffer.from("Estate Name,Owner Name,Property Address,County,Folio\nEstate of Ada Example,Ada Example,,Miami-Dade,01-0000\n", "utf8");
const extraction = await extractionRuntime.extractEstateUpload("text/csv", csv);
assert.equal(extraction.fileKind, "csv");
assert.equal(extraction.method, "csv_rows");
assert.match(extraction.text, /Estate of Ada Example/);
assert.ok(extraction.sourceLocators.length >= 2, "CSV extraction must preserve source-row locators");
const windows1252Csv = Buffer.from("Estate Name,Owner Name\nEstate of Ren\xe9e Example,Ren\xe9e Example\n", "latin1");
const windows1252Extraction = await extractionRuntime.extractEstateUpload("text/csv", windows1252Csv);
assert.match(windows1252Extraction.text, /Estate of Ren\u00e9e Example/, "common Windows CSV exports must decode without replacement characters");
await assert.rejects(
  extractionRuntime.extractEstateUpload("text/csv", Buffer.from([0x61, 0x2c, 0x62, 0x0a, 0x63, 0x00, 0x64])),
  (error) => error?.code === "estate_upload_invalid_csv",
  "binary-looking CSV payloads must remain blocked",
);
await assert.rejects(
  extractionRuntime.extractEstateUpload("application/octet-stream", Buffer.from("binary")),
  (error) => error?.code === "estate_upload_type_unsupported",
);

const estateImportHandler = require(path.join(artifactRoot, "api", "agentic", "estate-import.js"));
const previousAuthRequired = process.env.AUTH_REQUIRED;
const previousWorkerUrl = process.env.HEIRRIGHT_WORKER_URL;
process.env.AUTH_REQUIRED = "false";
delete process.env.HEIRRIGHT_WORKER_URL;
try {
  const methodRejected = await callApi(estateImportHandler, { method: "GET" });
  assert.equal(methodRejected.statusCode, 405);
  const typeRejected = await callApi(estateImportHandler, {
    body: { fileName: "estate.exe", contentType: "application/octet-stream", contentBase64: Buffer.from("binary").toString("base64") },
  });
  assert.equal(typeRejected.statusCode, 415);
  const workerUnavailable = await callApi(estateImportHandler, {
    body: { fileName: "estates.csv", contentType: "text/csv", contentBase64: csv.toString("base64") },
  });
  assert.equal(workerUnavailable.statusCode, 503, "valid estate text must fail closed when the verified-free Worker route is unavailable");
  assert.equal(JSON.parse(workerUnavailable.text).error, "agentic_unavailable");
  assert.doesNotMatch(workerUnavailable.text, /Ada Example/, "the browser response must not contain extracted client text");
} finally {
  if (previousAuthRequired === undefined) delete process.env.AUTH_REQUIRED;
  else process.env.AUTH_REQUIRED = previousAuthRequired;
  if (previousWorkerUrl === undefined) delete process.env.HEIRRIGHT_WORKER_URL;
  else process.env.HEIRRIGHT_WORKER_URL = previousWorkerUrl;
}

const workerRuntime = require(path.join(repoRoot, "apps", "worker", "dist", "cloudflare.js"));
assert.equal(typeof workerRuntime.parseAgenticEstateRecords, "function");
assert.equal(typeof workerRuntime.agenticEstateImportChunks, "function");
assert.equal(typeof workerRuntime.boundedAgenticEstateRecords, "function");

const sourceHash = "a".repeat(64);
const records = workerRuntime.parseAgenticEstateRecords(JSON.stringify({
  estates: [{
    estateName: "Estate of Ada Example",
    ownerName: "Ada Example",
    propertyAddress: "",
    county: "Miami-Dade",
    parcelId: "01-0000",
    notes: "Address is absent in source row 2.",
    missingFields: ["propertyAddress"],
  }],
}), sourceHash);
assert.equal(records.length, 1);
assert.equal(records[0].propertyAddress, "", "missing source facts must stay blank");
assert.ok(records[0].missingFields.includes("propertyAddress"));
assert.equal(records[0].sourceRecordId, `file:${sourceHash}:record-1`);

const arrayRecords = workerRuntime.parseAgenticEstateRecords(JSON.stringify([
  { estateName: "", ownerName: "Incomplete Owner", propertyAddress: "", county: "", parcelId: "", missingFields: [] },
]), sourceHash, 4);
assert.equal(arrayRecords[0].sourceRecordId, `file:${sourceHash}:record-5`, "raw JSON arrays must retain stable offset identity");
assert.deepEqual(arrayRecords[0].missingFields.sort(), ["county", "estateName", "parcelId", "propertyAddress"].sort());

const duplicateRows = workerRuntime.parseAgenticEstateRecords(JSON.stringify({
  estates: [
    { estateName: "Estate of Same Source", ownerName: "Same Source", propertyAddress: "1 Test Way", county: "Miami-Dade", parcelId: "", missingFields: [] },
    { estateName: "Estate of Same Source", ownerName: "Same Source", propertyAddress: "1 Test Way", county: "Miami-Dade", parcelId: "", missingFields: [] },
  ],
}), sourceHash);
assert.equal(workerRuntime.boundedAgenticEstateRecords(duplicateRows).length, 2, "identical source rows must retain separate record boundaries");
assert.notEqual(duplicateRows[0].sourceRecordId, duplicateRows[1].sourceRecordId);

const chunks = workerRuntime.agenticEstateImportChunks({
  fileKind: "csv",
  text: extraction.text,
  sourceLocators: extraction.sourceLocators,
});
assert.ok(chunks.length >= 1);
assert.ok(chunks.every((chunk) => chunk.includes("[CSV row 1]")), "each CSV model chunk must repeat the header row");

const legacySource = readArtifact("src/legacy/app.js");
const normalizerSource = legacySource.slice(
  legacySource.indexOf("function generatedCrmEstateId"),
  legacySource.indexOf("function canonicalCrmImportStateText"),
);
const normalizerRuntime = vm.runInNewContext(`${normalizerSource}\n({ normalizeCrmImport });`, {
  globalThis: {},
  currentActorEmail: () => "operator@heirright.com",
  isoNow: () => "2026-08-04T00:00:00.000Z",
});
const normalizedIncompleteUpload = normalizerRuntime.normalizeCrmImport({
  provider: "file-upload",
  sourceRecordId: `file:${sourceHash}:record-1`,
  estateName: "Estate of Incomplete Source",
  ownerName: "",
  propertyAddress: "",
  county: "",
  parcelId: "",
  missingFields: ["ownerName", "propertyAddress", "county", "parcelId"],
});
assert.equal(normalizedIncompleteUpload.ownerName, "");
assert.equal(normalizedIncompleteUpload.propertyAddress, "");
assert.equal(normalizedIncompleteUpload.county, "");
assert.equal(normalizedIncompleteUpload.parcelId, "");
assert.deepEqual(
  Array.from(normalizedIncompleteUpload.missingFields),
  ["ownerName", "propertyAddress", "county", "parcelId"],
  "missing field provenance must survive browser-state normalization",
);

const apiSource = readArtifact("api/agentic/estate-import.js");
const workerSource = readRepo("apps/worker/src/cloudflare.ts");
const nousSource = readRepo("apps/worker/src/agentic/nous-free-model.ts");
const indexSource = readArtifact("src/index.html");
const gridsSource = readArtifact("src/features/data-grid/grids.css");
const environmentExample = readRepo(".env.example");
const workerConfig = readRepo("apps/worker/wrangler.toml");
const artifactVercel = JSON.parse(readArtifact("vercel.json"));
const rootVercel = JSON.parse(readRepo("vercel.json"));

assert.match(apiSource, /requireApiAuth/);
assert.match(apiSource, /MAX_ESTATE_FILE_BYTES = 3_000_000/);
assert.match(apiSource, /createHash\("sha256"\)/);
assert.match(apiSource, /extractEstateUpload/);
assert.match(apiSource, /proxyWorkerHttp[\s\S]*\/api\/agentic\/estate-import/);
assert.match(apiSource, /decodeCsvText\(bytes\)/);
assert.match(readArtifact("server/idi-extract-handler.js"), /new TextDecoder\("windows-1252"\)/);
assert.match(workerSource, /"\/api\/agentic\/estate-import"/);
assert.match(workerSource, /credential\.verifiedFreeModels\.includes\(model\)/);
assert.match(workerSource, /freeModelVerified: true/);
assert.match(workerSource, /reviewRequired: true/);
assert.match(workerSource, /Never research, infer, enrich/);
assert.match(workerSource, /AGENTIC_ESTATE_MODEL_CONCURRENCY = 6/);
assert.match(workerSource, /await Promise\.all\(workers\)/);
assert.match(workerSource, /const estates = boundedAgenticEstateRecords\(parsed\)/);
assert.doesNotMatch(workerSource, /function uniqueAgenticEstates/);
assert.match(nousSource, /configured && freeModels\.includes\(configured\)/);
assert.doesNotMatch(nousSource, /configured && !freeModels\.length \? \[configured\]/, "a configured model must not be labeled free without catalog proof");
assert.match(environmentExample, /^NOUS_API_KEY=$/m);
assert.match(environmentExample, /^NOUS_MODEL=dynamic-free-catalog$/m);
assert.match(workerConfig, /wrangler secret put NOUS_API_KEY/);
assert.equal(readRepo("api/agentic/estate-import.js").trim(), 'module.exports = require("../../apps/artifact/api/agentic/estate-import");');
assert.equal(readRepo("api/agentic/models.js").trim(), 'module.exports = require("../../apps/artifact/api/agentic/models");');
assert.equal(readRepo("api/agentic/backstory.js").trim(), 'module.exports = require("../../apps/artifact/api/agentic/backstory");');
assert.equal(artifactVercel.functions["api/agentic/estate-import.js"].includeFiles, "{runtime-assets,runtime-functions}/**");
assert.equal(rootVercel.functions["api/agentic/estate-import.js"].includeFiles, "apps/artifact/{runtime-assets,runtime-functions}/**");

assert.match(indexSource, /id="estateFileUpload"[\s\S]*data-open-estate-files/);
assert.doesNotMatch(indexSource, /id="crmImportMenu"|id="crmImportSingle"|Import From CRM/);
assert.match(legacySource, /function walkthroughTargetFor/);
assert.match(legacySource, /scrollIntoView/);
assert.match(legacySource, /settingsTab: "integrations"/);
assert.match(legacySource, /target: "\[data-s40-run\], \[data-run-docprep\]"/);
assert.match(legacySource, /target: "\[data-estates-add-queue\]"/);
assert.match(legacySource, /state\.crmImports = \[[\s\S]*?\]\.slice\(0, crmBatchImportLimit\)/, "the browser must retain every accepted estate record");
assert.match(readArtifact("src/features/data-grid/estates-grid.js"), /data-selection-active="\$\{selectedCount > 0\}"/);
assert.match(gridsSource, /\.hr-estate-selection-assist \{[\s\S]*?position: absolute;[\s\S]*?inset: 0;/, "selection controls must overlay the reserved command area instead of shifting the estate grid");
assert.doesNotMatch(legacySource, /"crm-import":\s*\{|title: "Import From CRM"|id="crmImportMenu"|id="crmImportSingle"/);
assert.doesNotMatch(legacySource, /CRM estate row|CRM Import|CRM source|CRM row:|CRM import is not part/);
assert.doesNotMatch(legacySource, /\{ id: "sources", label: "Sources" \}|if \(tab === "sources"\)/);

for (const staleCopy of ["Google login configured", "source groups reviewable", "Browser capture blocked", "No-send guard active"]) {
  assert.ok(!legacySource.includes(staleCopy), `stale Settings readiness copy must remain removed: ${staleCopy}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "searchable_csv_extraction_with_row_locators",
    "utf8_and_windows1252_client_csv_decoding",
    "strict_authenticated_hashing_proxy_boundary",
    "file_type_method_and_worker_unavailable_fail_closed",
    "extracted_client_text_not_returned_to_browser",
    "verified_free_nous_model_required",
    "incomplete_records_preserved_for_review",
    "missing_facts_remain_blank_after_browser_normalization",
    "missing_field_provenance_persists",
    "identical_source_rows_preserved",
    "all_accepted_records_retained_in_browser_state",
    "estate_selection_controls_do_not_shift_grid_layout",
    "bounded_parallel_model_parsing",
    "nous_environment_contract_documented",
    "root_vercel_agentic_wrappers_and_runtime_trace_rules",
    "real_control_walkthrough_targets",
    "direct_crm_intake_removed",
    "stale_settings_readiness_cards_removed",
  ],
}, null, 2));
