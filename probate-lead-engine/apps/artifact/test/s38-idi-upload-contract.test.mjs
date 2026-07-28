import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import workerModule, { WorkspaceState } from "../../worker/dist/cloudflare.js";
import { matchIdiReportSubject } from "../../worker/dist/enrichment/idi-upload.js";

const worker = workerModule.default || workerModule;
const require = createRequire(import.meta.url);
const idiExtractHandler = require("../api/discovery/idi-asset-search/extract.js");

const legacyAppSource = readFileSync(new URL("../src/legacy/app.js", import.meta.url), "utf8");
const idiImportRouteSource = readFileSync(new URL("../api/discovery/idi-asset-search/import.js", import.meta.url), "utf8");
const idiExtractRouteSource = readFileSync(new URL("../server/idi-extract-handler.js", import.meta.url), "utf8");
const contactReviewRouteSource = readFileSync(new URL("../api/discovery/contact-candidates/[id]/review.js", import.meta.url), "utf8");
const localServerSource = readFileSync(new URL("../server.js", import.meta.url), "utf8");
const rootIdiImportWrapperSource = readFileSync(new URL("../../../api/discovery/idi-asset-search/import.js", import.meta.url), "utf8");
for (const source of [idiImportRouteSource, localServerSource]) {
  assert.doesNotMatch(source, /body\.liveRunApproved|liveRunApproved\s*===/, "client approval flags must never authorize a paid IDI request");
  assert.match(source, /wantsLiveRun[\s\S]{0,220}requireApiAdmin/, "paid IDI requests must pass the shared administrator gate");
  assert.match(source, /idi_paid_run_lock_unavailable/, "paid fallback must fail closed without durable duplicate protection");
}
assert.doesNotMatch(localServerSource, /function idiAssetImportFactsFromBody/, "the local source-run fallback must not convert browser-supplied IDI blobs into evidence");
assert.match(localServerSource, /confirmedSourceFactsInput[\s\S]{0,260}source\)\.toLowerCase\(\) !== "idi"/, "the local source-run fallback must reject client-supplied confirmed IDI facts");
assert.match(localServerSource, /discovery_file_store_unavailable/, "the local source-run route must fail closed when canonical persistence is unavailable");
assert.doesNotMatch(localServerSource, /localDiscoveryFiles\.set\(/, "the local source-run route must never present an in-memory Discovery File as canonical");
assert.match(localServerSource, /handleContactCandidateReview[\s\S]{0,140}req\.method !== "POST"/, "the local contact-review route must reject non-POST decisions");
assert.match(localServerSource, /contact_review_store_unavailable/, "the local contact-review fallback must fail closed without canonical storage");
assert.doesNotMatch(contactReviewRouteSource, /mode:\s*"review_receipt"/, "the production contact-review facade must not return a fake saved receipt");
assert.match(contactReviewRouteSource, /contact_review_store_unavailable/, "the production contact-review facade must fail closed when the Worker is unavailable");
assert.doesNotMatch(idiExtractRouteSource, /JSON\.stringify\(\{\s*\.\.\.body/, "the general-auth extraction route must not spread browser fields into the internal import");
assert.match(idiExtractRouteSource, /uploadedImportPayload\(body, session, verifiedAttachment, extraction\)/, "uploaded intake must use a strict internal payload allowlist");
assert.match(rootIdiImportWrapperSource, /apps\/artifact\/api\/discovery\/idi-asset-search\/import/, "the production wrapper must use the GET/POST canonical import handler directly");
assert.doesNotMatch(rootIdiImportWrapperSource, /handleRequest/, "the production wrapper must not bypass canonical GET hydration through the legacy POST-only server route");
assert.match(idiExtractRouteSource, /adminOverrideReason\.length < 12/, "replacement uploads require a descriptive administrator reason");
assert.match(legacyAppSource, /removeUncommittedSupportingAttachment\(storedAttachment\)/, "unverified browser uploads must request verified cleanup");
assert.match(legacyAppSource, /importCommitted[\s\S]*removeUncommittedSupportingAttachment\(storedAttachment\)/, "the client must clean an IDI attachment unless canonical import committed");

const cleanupBoundary = legacyAppSource.match(/async function removeUncommittedSupportingAttachment[\s\S]*?\n}\n\nfunction uploadCleanupMessage[\s\S]*?\n}/);
assert.ok(cleanupBoundary, "the client upload cleanup helper must remain directly testable");
const cleanupCalls = [];
const cleanupApi = vm.runInNewContext(`${cleanupBoundary[0]}\n({ removeUncommittedSupportingAttachment, uploadCleanupMessage });`, {
  encodeURIComponent,
  fetch: async (url, options) => {
    cleanupCalls.push({ url, options });
    return { ok: true, json: async () => ({ ok: true, deleted: false, readbackStatus: "not_found" }) };
  },
});
const alreadyRemovedCleanup = await cleanupApi.removeUncommittedSupportingAttachment({ id: "supporting-123-test" });
assert.equal(alreadyRemovedCleanup.attempted, true);
assert.equal(alreadyRemovedCleanup.verified, true, "already-removed uploads count as verified cleanup");
assert.equal(cleanupCalls[0].options.method, "DELETE");
assert.match(cleanupCalls[0].url, /attachmentId=supporting-123-test/);
const failedCleanupApi = vm.runInNewContext(`${cleanupBoundary[0]}\n({ removeUncommittedSupportingAttachment, uploadCleanupMessage });`, {
  encodeURIComponent,
  fetch: async () => ({ ok: false, json: async () => ({}) }),
});
const failedCleanup = await failedCleanupApi.removeUncommittedSupportingAttachment({ artifactId: "supporting-456-test" });
assert.equal(failedCleanup.attempted, true);
assert.equal(failedCleanup.verified, false);
assert.match(failedCleanupApi.uploadCleanupMessage("Readback failed.", failedCleanup), /administrator.*secure document storage/i);
const persistenceBoundary = legacyAppSource.match(/\/\/ IDI_PERSISTENCE_BOUNDARY_START([\s\S]*?)\/\/ IDI_PERSISTENCE_BOUNDARY_END/);
assert.ok(persistenceBoundary, "the IDI persistence boundary must remain directly contract-testable");
const persistenceApi = vm.runInNewContext(`${persistenceBoundary[1]}\n({ workspaceSafeStateText });`);

const sensitiveIdiState = {
  "131 nw 67 st:hawkins": {
    importedText: "CONFIDENTIAL REPORT BODY Maria Secret 305-555-1212",
    candidates: [{ name: "Maria Secret", phone: "305-555-1212", email: "maria@example.test" }],
    attachment: { sourceUrl: "https://private.test/report.pdf", contentHash: "sensitive-hash" },
    importedAt: 1_752_000_000_000,
  },
};
assert.deepEqual(
  JSON.parse(persistenceApi.workspaceSafeStateText("heirright:idi-asset-imports", JSON.stringify(sensitiveIdiState))),
  {},
  "raw IDI imports must never enter generic workspace persistence"
);
assert.deepEqual(
  JSON.parse(persistenceApi.workspaceSafeStateText("heirright:contact-review-state", JSON.stringify({
    "131 nw 67 st:hawkins": { "131 nw 67 st:hawkins:idi:1": { status: "accepted", reviewedBy: "operator@example.test" } },
  }))),
  {},
  "contact-review IDs and reviewer data must remain in memory for the active run"
);

const safeSourceState = JSON.parse(persistenceApi.workspaceSafeStateText("heirright:source-capture-state", JSON.stringify({
  estate_opaque_id: {
    captureStatus: "complete",
    importedText: "CONFIDENTIAL REPORT BODY",
    candidates: [{ name: "Maria Secret" }],
    dossier: { familyTree: { contacts: [{ name: "Maria Secret", phone: "305-555-1212" }] } },
    sourceFacts: [
      { source: "idi", factType: "primary_contact_profile", value: { name: "Maria Secret", email: "maria@example.test" } },
      { source: "tax_collector", factType: "tax_paid_date", value: "2026-06-01" },
    ],
    sourceApiRun: { message: "Complete", sourceRunProof: { satisfiedBy: [{ name: "Maria Secret" }] } },
  },
})));
const safeSourceText = JSON.stringify(safeSourceState);
assert.doesNotMatch(safeSourceText, /CONFIDENTIAL|Maria Secret|305-555-1212|maria@example\.test/);
assert.equal(safeSourceState.estate_opaque_id.sourceFacts.length, 1);
assert.equal(safeSourceState.estate_opaque_id.sourceFacts[0].source, "tax_collector");
assert.equal("dossier" in safeSourceState.estate_opaque_id, false);
assert.equal("sourceRunProof" in safeSourceState.estate_opaque_id.sourceApiRun, false);

const safeDocuments = JSON.parse(persistenceApi.workspaceSafeStateText("heirright:document-files-state", JSON.stringify({
  "estate_opaque_id:idi-asset-search": {
    id: "idi-asset-search",
    name: "Maria Secret IDI Report.pdf",
    artifactUrl: "https://private.test/report.pdf",
    contentHash: "sensitive-hash",
  },
  "estate_opaque_id:latest-deed": { id: "latest-deed", artifactId: "deed-opaque-id", readbackStatus: "verified" },
})));
assert.equal("estate_opaque_id:idi-asset-search" in safeDocuments, false);
assert.equal(safeDocuments["estate_opaque_id:latest-deed"].artifactId, "deed-opaque-id");

const browserStorageFunctions = legacyAppSource.match(/function storageCookieName[\s\S]*?(?=function storageSetItem)/);
assert.ok(browserStorageFunctions, "browser-state purge functions must remain contract-testable");
const localValues = new Map();
const sessionValues = new Map();
const cookieValues = new Map();
const storageMock = (values) => ({
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
});
const documentMock = {};
Object.defineProperty(documentMock, "cookie", {
  configurable: true,
  get: () => [...cookieValues.entries()].map(([name, value]) => `${name}=${value}`).join("; "),
  set: (cookie) => {
    const [pair, ...attributes] = String(cookie).split(";").map((part) => part.trim());
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (attributes.some((attribute) => attribute.toLowerCase() === "max-age=0")) cookieValues.delete(name);
    else cookieValues.set(name, value);
  },
});
const volatileKeys = ["heirright:idi-asset-imports", "heirright:contact-review-state"];
volatileKeys.forEach((key) => {
  localValues.set(key, JSON.stringify(sensitiveIdiState));
  sessionValues.set(key, JSON.stringify(sensitiveIdiState));
  cookieValues.set(`hr_${encodeURIComponent(key).replace(/%/g, "_")}`, encodeURIComponent(JSON.stringify(sensitiveIdiState)));
});
const windowMock = {
  localStorage: storageMock(localValues),
  sessionStorage: storageMock(sessionValues),
  name: `heirright-storage:${JSON.stringify(Object.fromEntries(volatileKeys.map((key) => [key, JSON.stringify(sensitiveIdiState)])))}`,
  location: { hostname: "example.test" },
};
vm.runInNewContext(
  `const volatileIdiBrowserStateKeys = new Set(${JSON.stringify(volatileKeys)});\n${browserStorageFunctions[0]}\npurgeLegacyIdiBrowserState();`,
  { window: windowMock, document: documentMock }
);
volatileKeys.forEach((key) => {
  assert.equal(localValues.has(key), false, `${key} must be removed from localStorage`);
  assert.equal(sessionValues.has(key), false, `${key} must be removed from sessionStorage`);
  assert.equal(cookieValues.has(`hr_${encodeURIComponent(key).replace(/%/g, "_")}`), false, `${key} cookie must be expired`);
});
const migratedWindowName = JSON.parse(windowMock.name.replace(/^heirright-storage:/, ""));
volatileKeys.forEach((key) => assert.equal(key in migratedWindowName, false, `${key} must be removed from window.name`));

assert.doesNotMatch(legacyAppSource, /storageSetItem\(idiImportStateKey,\s*JSON\.stringify\(state\.idiImports\)\)/);
assert.doesNotMatch(legacyAppSource, /storageSetItem\(contactReviewStateKey,\s*JSON\.stringify\(state\.contactReviews\)\)/);
assert.doesNotMatch(legacyAppSource, /liveRunApproved:\s*true/, "the browser must not authorize paid vendor spend");
assert.doesNotMatch(legacyAppSource, /privateStorage(?:Get|Set)Item/, "personal IDI credentials must not use browser storage");
assert.match(legacyAppSource, /storageRemoveItem\(idiCoreUserApiKeyKey\);\s*state\.idiCoreUserApiKey = "";/, "legacy browser-stored IDI credentials must be purged on startup");
assert.match(legacyAppSource, /purgeLegacyIdiBrowserState\(\);\s*state\.sourceCaptures/);
assert.match(legacyAppSource, /window\.localStorage[\s\S]*?store\.removeItem\(key\)/);
assert.match(legacyAppSource, /window\.sessionStorage[\s\S]*?store\.removeItem\(key\)/);
assert.match(legacyAppSource, /max-age=0/);
assert.match(legacyAppSource, /delete record\[key\];\s*setStorageNameRecord\(record\)/);
assert.match(legacyAppSource, /let safeValue = workspaceSafeStateText\(key, payload\.value\)/);
assert.match(legacyAppSource, /state\.idiImports\[key\] = \{[\s\S]*?candidates:/);
assert.match(legacyAppSource, /purgeLegacyIdiBrowserState\(\);\s*loadSession\(\)\.then/);
assert.doesNotMatch(legacyAppSource, /Contact review saved locally|local review remains visible/, "failed canonical contact reviews must never be presented as saved");
assert.match(
  legacyAppSource,
  /const result = await postJson\(`\/api\/discovery\/contact-candidates\/[\s\S]{0,500}const verifiedReview = verifiedContactReviewResult\(result, status\);[\s\S]{0,180}state\.contactReviews\[key\]/,
  "the UI must wait for verified canonical contact-review readback before changing local readiness state"
);
const verifiedContactReviewBoundary = legacyAppSource.match(/function verifiedContactReviewResult\([\s\S]*?\n}/)?.[0];
assert.ok(verifiedContactReviewBoundary, "the verified contact-review response guard must remain directly testable");
const verifiedContactReviewResult = vm.runInNewContext(
  `${verifiedContactReviewBoundary}\nverifiedContactReviewResult;`,
  { cleanDisplayValue: (value) => String(value ?? "") }
);
assert.throws(
  () => verifiedContactReviewResult({ ok: true, status: "accepted", readbackStatus: "pending" }, "accepted"),
  /not saved/i
);
assert.throws(
  () => verifiedContactReviewResult({ ok: true, status: "rejected", readbackStatus: "verified", reviewedAt: "now", reviewedBy: "server" }, "accepted"),
  /not saved/i
);
assert.deepEqual(
  { ...verifiedContactReviewResult({ ok: true, status: "accepted", readbackStatus: "verified", reviewedAt: "2026-07-14T19:00:00.000Z", reviewedBy: "signed@heirright.com" }, "accepted") },
  { status: "accepted", reviewedAt: "2026-07-14T19:00:00.000Z", reviewedBy: "signed@heirright.com" }
);
assert.match(
  legacyAppSource,
  /phaseId === "idi-asset-search"[\s\S]{0,320}idiImport\.reviewRequired !== true[\s\S]{0,160}idiImport\.paidRunApproved === true/,
  "pending paid IDI records may remain visible but must not complete the IDI phase"
);

class MemoryKv {
  values = new Map();
  options = new Map();
  async get(key) { return this.values.get(key) || null; }
  async put(key, value, options = {}) {
    this.values.set(key, value);
    this.options.set(key, options);
  }
  async delete(key) { this.values.delete(key); }
}

class MemoryDurableStorage {
  values = new Map();
  transactionTail = Promise.resolve();
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async transaction(closure) {
    const previous = this.transactionTail;
    let release;
    this.transactionTail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await closure(this); }
    finally { release(); }
  }
}

const paidRunStorage = new MemoryDurableStorage();
const paidRunState = new WorkspaceState({ storage: paidRunStorage });
const workspaceNamespace = {
  idFromName(name) { return name; },
  get() { return { fetch: (request) => paidRunState.fetch(request) }; },
};

const env = {
  AUTH_REQUIRED: "false",
  HEIRRIGHT_API_TOKEN: "test-internal-token",
  PACKET_ARTIFACTS: new MemoryKv(),
  WORKSPACE_STATE: workspaceNamespace,
};
const estateId = "estate:s38-idi-upload";
const csv = [
  "Name,Relationship,Phone,Email,Address,Property Owner,Subject Property",
  "Avery QA Fixture,Spouse,305-555-0100,avery.qa@example.test,707 TEST RECORD WAY MIAMI FL 00000,Estate of Rowan QA Fixture,707 TEST RECORD WAY MIAMI FL 00000",
].join("\n");

const subjectExtraction = (text) => ({ text });
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: Morgan Wrong\nProperty: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "Li",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "a two-character surname must remain a required independent subject signal");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: Morgan Wrong\nProperty: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "an owner suffix must not replace the family name during subject matching");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nProperty: 999 OTHER AVE MIAMI FL 33101"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 NW 7 ST, MIAMI, FL 33101",
}).matched, false, "short directional and numeric street addresses must remain required subject signals");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: Li\nProperty: 707 NW 7 ST MIAMI FL 33101"),
  ownerName: "Li",
  propertyAddress: "707 NW 7 ST, MIAMI, FL 33101",
}).matched, true, "two durable short-form owner and address signals must bind the report to the selected estate");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nProperty: 707 SW 7 ST MIAMI FL 33101"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 NW 7 ST, MIAMI, FL 33101",
}).matched, false, "opposite directional streets with the same numeric tokens must never cross-bind");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Subject: Mary Smith\nRelative: John Doe\nProperty: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "owner tokens from different report contexts must never synthesize a subject match");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Subject: Mary Jones\nRelative: John Smith\nProperty: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "an exact relative name must never substitute for the report subject owner");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nSubject Property: 999 OTHER AVE MIAMI FL 33101\nRelative: Mary Smith\nAddress history: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "address history must never substitute for a conflicting subject property");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nProperty: 707 TEST RECORD WAY MIAMI FL 00000\nFolio: 99-9999-999-9999"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
  parcelId: "01-2345-678-9000",
}).matched, false, "an explicitly conflicting report folio must block otherwise matching owner and address evidence");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nFolio: 01-2345-678-9000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
  parcelId: "01-2345-678-9000",
}).matched, true, "exact label-scoped owner and folio signals may bind a report that omits the property address");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nProperty: 707 NORTHWEST 7TH STREET MIAMI FL 33101"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 NW 7 ST, MIAMI, FL 33101",
}).matched, true, "direction words and numeric ordinals must normalize without discarding the direction");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nSubject: Mary Jones\nProperty: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "one matching owner field must not mask a contradictory subject owner field");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nSubject Property: 999 OTHER AVE MIAMI FL 33101\nAddress: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "a generic address must not mask a contradictory subject property field");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr.\nProperty: 707 TEST RECORD WAY MIAMI FL 00000\nFolio: 01-2345-678-9000\nParcel ID: 99-9999-999-9999"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
  parcelId: "01-2345-678-9000",
}).matched, false, "one exact folio field must not mask a contradictory parcel field");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction([
    "Name,Property Owner,Address,Subject Property",
    "Mary Smith,John Smith Jr.,707 TEST RECORD WAY MIAMI FL 00000,999 OTHER AVE MIAMI FL 33101",
  ].join("\n")),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "a CSV contact address must not mask its contradictory Subject Property column");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("IDI Core Asset Report\nEstate of Alicia Rivera\nProperty: 4410 Palm Avenue Miami FL 33101"),
  ownerName: "Estate of Alicia Rivera",
  propertyAddress: "4410 Palm Avenue, Miami, FL 33101",
}).matched, true, "a standalone exact estate header may supply owner evidence when no labeled owner field exists");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("IDI Core Asset Report - Estate of Alicia Rivera\nProperty: 4410 Palm Avenue Miami FL 33101"),
  ownerName: "Estate of Alicia Rivera",
  propertyAddress: "4410 Palm Avenue, Miami, FL 33101",
}).matched, true, "an exact owner phrase in the report header may bind a DOCX-style report without a labeled owner field");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("IDI Core Asset Report - Mary Jones\nPossible relative: John Smith Jr.\nProperty: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "a possible-relative line must never supply the standalone report owner fallback");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: Mary Jones Relative: John Smith Jr. Property: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "a later inline relative field must not satisfy a contradictory owner field");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr. Subject Property: 999 OTHER AVE MIAMI FL 33101 Address: 707 TEST RECORD WAY MIAMI FL 00000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}).matched, false, "a later inline generic address must not satisfy a contradictory Subject Property field");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith Jr. Property: 707 TEST RECORD WAY MIAMI FL 00000 Folio: 99-9999-999-9999 Parcel ID: 01-2345-678-9000"),
  ownerName: "John Smith Jr.",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
  parcelId: "01-2345-678-9000",
}).matched, false, "a later inline parcel field must not erase a contradictory folio field");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith\nFolio: 9912345677"),
  ownerName: "John Smith",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
  parcelId: "123456",
}).matched, false, "a durable folio must not match as a substring inside a longer conflicting identifier");
assert.equal(matchIdiReportSubject({
  extraction: subjectExtraction("Owner: John Smith\nFolio: 99012345678900077"),
  ownerName: "John Smith",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
  parcelId: "01-2345-678-9000",
}).matched, false, "a full durable folio with added prefix and suffix digits must remain a contradiction");
const insufficientSubjectSignals = matchIdiReportSubject({
  extraction: subjectExtraction("Property: 4410 Palm Avenue Miami FL 33101"),
  ownerName: "Estate of Alicia Rivera",
  propertyAddress: "4410 Palm Avenue, Miami, FL 33101",
});
assert.equal(insufficientSubjectSignals.matched, false);
assert.equal(insufficientSubjectSignals.reviewRequired, true, "fewer than two subject signals must remain visibly review-required even without an explicit contradiction");

async function workerRequest(pathname, options = {}) {
  const response = await worker.fetch(new Request(`https://worker.test${pathname}`, options), env);
  return { response, body: await response.json() };
}

async function seedCanonicalEstate(targetEnv, input, record = {}) {
  const assetKey = String(input.assetKey || "");
  assert.ok(assetKey, "canonical estate fixtures require an exact stable estate ID");
  await targetEnv.PACKET_ARTIFACTS.put(`discovery-file:${createHash("sha256").update(assetKey).digest("hex")}`, JSON.stringify({
    estateId: assetKey,
    revision: `canonical-${assetKey.replace(/[^a-z0-9]+/gi, "-")}`,
    seed: {
      ownerName: input.ownerName || input.estateName,
      propertyAddress: input.propertyAddress,
      county: input.county || "miami-dade",
    },
    ...record,
  }));
}

async function seedCrmImportsInState(workspaceState, imports) {
  const key = "heirright:crm-imported-estates";
  const statusResponse = await workspaceState.fetch(new Request(`https://workspace-state.internal/?key=${encodeURIComponent(key)}`));
  const status = await statusResponse.json();
  const writeResponse = await workspaceState.fetch(new Request("https://workspace-state.internal/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value: JSON.stringify(imports), expectedRevision: status.revision }),
  }));
  const write = await writeResponse.json();
  assert.equal(writeResponse.status, 200);
  assert.equal(write.readbackStatus, "verified");
}

async function seedWorkspaceCrmImports(imports) {
  return seedCrmImportsInState(paidRunState, imports);
}

async function productionWorkerRequest(pathname, options = {}) {
  const headers = { authorization: "Bearer test-internal-token", ...(options.headers || {}) };
  const response = await worker.fetch(new Request(`https://worker.test${pathname}`, { ...options, headers }), { ...env, AUTH_REQUIRED: "true" });
  return { response, body: await response.json() };
}

const sourceCaptureEstateId = "estate:s38-source-capture";
const sourceCapture = await workerRequest("/api/discovery/source-capture", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: sourceCaptureEstateId,
    owner: "Estate of Source Capture Fixture",
    address: "10000 Test Record Way, Miami, FL 00000",
    capturedBy: "forged-reviewer@attacker.test",
    confirmedSourceFacts: [{ source: "idi", factType: "primary_contact_profile", value: { name: "Forged Contact" } }],
    idiAssetImport: { importedText: "FORGED SECRET IDI BODY", candidates: [{ name: "Forged Contact" }] },
    taxReceipt: {
      listingUrl: "https://county.example.test/listing/source-capture",
      receiptLink: "https://county.example.test/receipt/source-capture.pdf",
      paidBy: "Synthetic estate representative",
      paidDate: "07/14/2026",
    },
  }),
});
assert.equal(sourceCapture.response.status, 200);
assert.equal(sourceCapture.body.ok, true);
assert.equal(sourceCapture.body.readbackStatus, "verified");
assert.equal(sourceCapture.body.persistence.readbackStatus, "verified");
assert.equal(sourceCapture.body.capture.assetKey, sourceCaptureEstateId);
assert.equal(sourceCapture.body.capture.capturedBy, "approved HeirRight user");
assert.equal("idiAssetImport" in sourceCapture.body.capture, false);
assert.ok(sourceCapture.body.sourceFacts.some((fact) => fact.source === "tax_collector" && fact.factType === "tax_receipt_link"));
const sourceCaptureStorageEntry = [...env.PACKET_ARTIFACTS.values.entries()]
  .find(([key, value]) => key.startsWith("discovery-file:") && JSON.parse(value).estateId === sourceCaptureEstateId);
assert.ok(sourceCaptureStorageEntry);
assert.equal(env.PACKET_ARTIFACTS.options.get(sourceCaptureStorageEntry[0])?.expirationTtl, 30 * 24 * 60 * 60);
const storedSourceCapture = JSON.parse(sourceCaptureStorageEntry[1]);
assert.equal(storedSourceCapture.mode, "source_capture");
assert.equal("dossier" in storedSourceCapture, false, "a saved capture must invalidate the prior generated dossier until Discovery reruns");
assert.doesNotMatch(JSON.stringify(storedSourceCapture), /FORGED SECRET|Forged Contact|forged-reviewer@attacker\.test/);
const sourceCaptureReload = await workerRequest(`/api/discovery/file?estateId=${encodeURIComponent(sourceCaptureEstateId)}`);
assert.equal(sourceCaptureReload.response.status, 200);
assert.equal(sourceCaptureReload.body.readbackStatus, "verified");
assert.equal(sourceCaptureReload.body.mode, "source_capture");
assert.equal(sourceCaptureReload.body.capture.taxReceipt.paidBy, "Synthetic estate representative");
const sourceCaptureViaGet = await workerRequest("/api/discovery/source-capture", { method: "GET" });
assert.equal(sourceCaptureViaGet.response.status, 405);
const sourceCaptureWithoutStoreResponse = await worker.fetch(new Request("https://worker.test/api/discovery/source-capture", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ assetKey: "estate:s38-source-capture-no-store" }),
}), { AUTH_REQUIRED: "false" });
const sourceCaptureWithoutStore = await sourceCaptureWithoutStoreResponse.json();
assert.equal(sourceCaptureWithoutStoreResponse.status, 503);
assert.equal(sourceCaptureWithoutStore.error, "source_capture_store_unavailable");

const upload = await workerRequest("/api/documents/attachments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    estateId,
    documentId: "idi-asset-search",
    fileName: "idi-report.csv",
    contentType: "text/csv",
    dataBase64: Buffer.from(csv).toString("base64"),
  }),
});
assert.equal(upload.response.status, 200);
assert.equal(upload.body.attachment.readbackStatus, "verified");
const supportingDocumentStorageKey = `supporting-document:${upload.body.attachment.id}`;
const supportingDocumentIndexStorageKey = [...env.PACKET_ARTIFACTS.values.keys()].find((key) => key.startsWith("supporting-document-index:"));
assert.equal(env.PACKET_ARTIFACTS.options.get(supportingDocumentStorageKey)?.expirationTtl, 30 * 24 * 60 * 60);
assert.equal(env.PACKET_ARTIFACTS.options.get(supportingDocumentIndexStorageKey)?.expirationTtl, 30 * 24 * 60 * 60);

const originalDateNow = Date.now;
let sameMillisecondUploads;
try {
  Date.now = () => 1_752_000_123_456;
  sameMillisecondUploads = await Promise.all(["estate:s38-same-bytes-a", "estate:s38-same-bytes-b"].map((collisionEstateId) =>
    workerRequest("/api/documents/attachments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        estateId: collisionEstateId,
        documentId: "idi-asset-search",
        fileName: "same-idi-report.csv",
        contentType: "text/csv",
        dataBase64: Buffer.from(csv).toString("base64"),
      }),
    })
  ));
} finally {
  Date.now = originalDateNow;
}
assert.equal(sameMillisecondUploads.every((result) => result.response.status === 200), true);
const sameMillisecondIds = sameMillisecondUploads.map((result) => result.body.attachment.id);
assert.equal(new Set(sameMillisecondIds).size, 2, "identical bytes uploaded in one millisecond must receive distinct artifact IDs");
assert.deepEqual(
  sameMillisecondIds.map((id) => JSON.parse(env.PACKET_ARTIFACTS.values.get(`supporting-document:${id}`)).estateId).sort(),
  ["estate:s38-same-bytes-a", "estate:s38-same-bytes-b"],
  "same-byte concurrent uploads must preserve their separate estate bindings"
);

const collidingEstateIds = ["estate:s38-same-bytes-a", "estate:s38-same-bytes-b"];
const collidingImports = await Promise.all(collidingEstateIds.map((collidingEstateId, index) => workerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    assetKey: collidingEstateId,
    estateId: collidingEstateId,
    leadId: collidingEstateId,
    ownerName: "Estate of Rowan QA Fixture",
    propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
    mode: "uploaded_file",
    attachment: {
      artifactId: sameMillisecondUploads[index].body.attachment.id,
      contentHash: sameMillisecondUploads[index].body.attachment.contentHash,
    },
    extraction: {
      status: "extracted",
      method: "csv_rows",
      fileKind: "csv",
      text: csv,
      sourceLocators: [{ kind: "row", index: 2, label: "CSV row 2", text: csv.split("\n")[1] }],
      extractedAt: new Date().toISOString(),
    },
  }),
})));
assert.equal(collidingImports.every((result) => result.response.status === 200), true, "same owner and address must not merge two exact estate imports");
assert.deepEqual(
  collidingImports.map((result) => result.body.candidates[0].id.split(":idi:")[0]).sort(),
  collidingEstateIds,
  "candidate identity must remain bound to the exact CRM estate ID",
);
const renamedEstateReload = await workerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(collidingEstateIds[0])}`, {
  headers: { authorization: "Bearer test-internal-token" },
});
assert.equal(renamedEstateReload.response.status, 200, "display-name or address edits must not change exact-ID report lookup");
const addressFingerprintReload = await workerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent("707 test record way:fixture")}`, {
  headers: { authorization: "Bearer test-internal-token" },
});
assert.equal(addressFingerprintReload.body.exists, false, "an address fingerprint must never resolve an estate report record");

const wrongReportEstateId = "crm:podio:s38-wrong-report-target";
const wrongReportText = "IDI Asset Report\nOwner: Morgan Wrong Subject\nProperty: 999 OTHER PROPERTY AVE MIAMI FL 33101\nSpouse: Taylor Wrong\nPhone: 305-555-0199";
const wrongReportUpload = await workerRequest("/api/documents/attachments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    estateId: wrongReportEstateId,
    documentId: "idi-asset-search",
    fileName: "wrong-estate-report.csv",
    contentType: "text/csv",
    dataBase64: Buffer.from(wrongReportText).toString("base64"),
  }),
});
assert.equal(wrongReportUpload.response.status, 200);
await seedCanonicalEstate(env, {
  assetKey: wrongReportEstateId,
  ownerName: "Estate of Rowan QA Fixture",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
});
await seedWorkspaceCrmImports([{
  id: wrongReportEstateId,
  provider: "podio",
  estateName: "Estate of Rowan QA Fixture",
  ownerName: "Estate of Rowan QA Fixture",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
}]);
const identityMismatch = await workerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    assetKey: wrongReportEstateId,
    estateId: wrongReportEstateId,
    leadId: "crm:podio:different-estate",
    ownerName: "Estate of Rowan QA Fixture",
    propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
    mode: "uploaded_file",
    attachment: { artifactId: wrongReportUpload.body.attachment.id, contentHash: wrongReportUpload.body.attachment.contentHash },
    extraction: { status: "extracted", method: "csv_rows", fileKind: "csv", text: wrongReportText, sourceLocators: [{ kind: "row", index: 1, label: "Row 1", text: wrongReportText }] },
  }),
});
assert.equal(identityMismatch.response.status, 409);
assert.equal(identityMismatch.body.error, "idi_estate_identity_mismatch");
const wrongReportImport = await productionWorkerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    assetKey: wrongReportEstateId,
    estateId: wrongReportEstateId,
    leadId: wrongReportEstateId,
    ownerName: "Morgan Wrong Subject",
    propertyAddress: "999 OTHER PROPERTY AVE MIAMI FL 33101",
    mode: "uploaded_file",
    attachment: { artifactId: wrongReportUpload.body.attachment.id, contentHash: wrongReportUpload.body.attachment.contentHash },
    extraction: { status: "extracted", method: "csv_rows", fileKind: "csv", text: wrongReportText, sourceLocators: [{ kind: "row", index: 1, label: "Row 1", text: wrongReportText }] },
  }),
});
assert.equal(wrongReportImport.response.status, 422);
assert.equal(wrongReportImport.body.error, "idi_report_subject_mismatch");
assert.deepEqual(wrongReportImport.body.requiredSignals.sort(), ["address", "owner"], "subject checks must use the selected estate's canonical identity instead of spoofable request metadata");
assert.deepEqual(wrongReportImport.body.matchedSignals, []);
assert.ok(wrongReportImport.body.missingSignals.includes("owner") && wrongReportImport.body.missingSignals.includes("address"));
assert.doesNotMatch(JSON.stringify(wrongReportImport.body), /Morgan Wrong|Taylor Wrong|305-555-0199|999 OTHER/i, "subject mismatch responses must never return raw report content");
assert.equal(
  [...env.PACKET_ARTIFACTS.values.values()].some((value) => {
    try { return JSON.parse(value).assetKey === wrongReportEstateId && JSON.parse(value).provider === "idi"; }
    catch { return false; }
  }),
  false,
  "a wrong-estate report must be rejected before canonical IDI commit",
);

const durableCrmSubjectEstateId = "crm:podio:s38-durable-subject";
const durableCrmCompanyEstateId = "crm:podio:s38-durable-company-stop";
const durableCrmConflictEstateId = "crm:podio:s38-canonical-crm-conflict";
await seedWorkspaceCrmImports([
  {
    id: durableCrmSubjectEstateId,
    provider: "podio",
    estateName: "Estate of Rowan QA Fixture",
    ownerName: "Estate of Rowan QA Fixture",
    propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
    parcelId: "01-2345-678-9000",
  },
  {
    id: durableCrmCompanyEstateId,
    provider: "podio",
    estateName: "Sample Property L.L.C.",
    ownerName: "Sample Property L.L.C.",
    propertyAddress: "808 STOP RECORD WAY, MIAMI, FL 00000",
    parcelId: "01-2345-678-9001",
  },
  {
    id: durableCrmConflictEstateId,
    provider: "podio",
    estateName: "Estate of Rowan QA Fixture",
    ownerName: "Estate of Rowan QA Fixture",
    propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
    parcelId: "01-2345-678-9002",
  },
]);
await seedCanonicalEstate(env, {
  assetKey: durableCrmConflictEstateId,
  ownerName: "Morgan Wrong Subject",
  propertyAddress: "999 OTHER PROPERTY AVE, MIAMI, FL 33101",
});
const conflictingCanonicalKey = `discovery-file:${createHash("sha256").update(durableCrmConflictEstateId).digest("hex")}`;
const conflictingCanonicalBefore = env.PACKET_ARTIFACTS.values.get(conflictingCanonicalKey);
const conflictingCanonicalIdi = await productionWorkerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: durableCrmConflictEstateId,
    estateId: durableCrmConflictEstateId,
    leadId: durableCrmConflictEstateId,
    ownerName: "Morgan Wrong Subject",
    propertyAddress: "999 OTHER PROPERTY AVE, MIAMI, FL 33101",
    mode: "operator_import",
    importedText: wrongReportText,
    attachment: { fileName: "conflicting-canonical.txt", sourceUrl: "https://operator.test/conflicting-canonical.txt" },
  }),
});
assert.equal(conflictingCanonicalIdi.response.status, 409);
assert.equal(conflictingCanonicalIdi.body.error, "exact_estate_subject_mismatch");
assert.equal(conflictingCanonicalIdi.body.readbackStatus, "canonical_crm_subject_mismatch");
assert.equal(
  [...env.PACKET_ARTIFACTS.values.values()].some((value) => {
    try { return JSON.parse(value).assetKey === durableCrmConflictEstateId && JSON.parse(value).provider === "idi"; }
    catch { return false; }
  }),
  false,
  "a canonical/CRM subject conflict must block before IDI commit",
);
const conflictingCanonicalDiscovery = await productionWorkerRequest("/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: durableCrmConflictEstateId,
    estateId: durableCrmConflictEstateId,
    leadId: durableCrmConflictEstateId,
    seed: {
      estateName: "Morgan Wrong Subject",
      ownerName: "Morgan Wrong Subject",
      propertyAddress: "999 OTHER PROPERTY AVE, MIAMI, FL 33101",
      county: "miami-dade",
    },
    capture: {},
    includeSkipTrace: false,
  }),
});
assert.equal(conflictingCanonicalDiscovery.response.status, 409);
assert.equal(conflictingCanonicalDiscovery.body.error, "exact_estate_subject_mismatch");
assert.equal(conflictingCanonicalDiscovery.body.readbackStatus, "canonical_crm_subject_mismatch");
assert.equal(env.PACKET_ARTIFACTS.values.get(conflictingCanonicalKey), conflictingCanonicalBefore, "a subject-conflicted Discovery run must not replace the active canonical file");
const durableCrmWrongUpload = await productionWorkerRequest("/api/documents/attachments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    estateId: durableCrmSubjectEstateId,
    documentId: "idi-asset-search",
    fileName: "spoofed-subject.csv",
    contentType: "text/csv",
    dataBase64: Buffer.from(wrongReportText).toString("base64"),
  }),
});
assert.equal(durableCrmWrongUpload.response.status, 200);
const durableCrmSpoofAttempt = await productionWorkerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: durableCrmSubjectEstateId,
    estateId: durableCrmSubjectEstateId,
    leadId: durableCrmSubjectEstateId,
    ownerName: "Morgan Wrong Subject",
    propertyAddress: "999 OTHER PROPERTY AVE MIAMI FL 33101",
    mode: "uploaded_file",
    attachment: {
      artifactId: durableCrmWrongUpload.body.attachment.id,
      contentHash: durableCrmWrongUpload.body.attachment.contentHash,
    },
    extraction: { status: "extracted", method: "csv_rows", fileKind: "csv", text: wrongReportText, sourceLocators: [{ kind: "row", index: 1, label: "Row 1", text: wrongReportText }] },
  }),
});
assert.equal(durableCrmSpoofAttempt.response.status, 422);
assert.equal(durableCrmSpoofAttempt.body.error, "idi_report_subject_mismatch", "production subject binding must ignore spoofed request metadata and use durable exact CRM identity");
assert.doesNotMatch(JSON.stringify(durableCrmSpoofAttempt.body), /Morgan Wrong|Taylor Wrong|305-555-0199|999 OTHER/i, "a forged subject mismatch must not return pasted report text");
const sourceUrlOnlyOperatorImport = await productionWorkerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: durableCrmSubjectEstateId,
    estateId: durableCrmSubjectEstateId,
    leadId: durableCrmSubjectEstateId,
    mode: "operator_import",
    attachment: { fileName: "metadata-only.txt", sourceUrl: "https://operator.test/metadata-only.txt" },
  }),
});
assert.equal(sourceUrlOnlyOperatorImport.response.status, 400);
assert.equal(sourceUrlOnlyOperatorImport.body.error, "missing_idi_report", "source URL metadata alone must never become a canonical operator import");
const forgedOperatorPaste = await productionWorkerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: durableCrmSubjectEstateId,
    estateId: durableCrmSubjectEstateId,
    leadId: durableCrmSubjectEstateId,
    ownerName: "Morgan Wrong Subject",
    propertyAddress: "999 OTHER PROPERTY AVE MIAMI FL 33101",
    mode: "operator_import",
    importedText: wrongReportText,
    attachment: { fileName: "forged-operator-paste.txt", sourceUrl: "https://operator.test/forged-operator-paste.txt" },
  }),
});
assert.equal(forgedOperatorPaste.response.status, 422);
assert.equal(forgedOperatorPaste.body.error, "idi_report_subject_mismatch", "an operator paste must match the exact durable estate before canonical commit");
assert.deepEqual(forgedOperatorPaste.body.requiredSignals.sort(), ["address", "owner"]);
assert.deepEqual(forgedOperatorPaste.body.matchedSignals, []);
assert.doesNotMatch(JSON.stringify(forgedOperatorPaste.body), /Morgan Wrong|Taylor Wrong|305-555-0199|999 OTHER/i, "operator-paste mismatch responses must not return raw report content");
const authoritativeOperatorText = [
  "IDI Asset Report",
  "Owner: Estate of Rowan QA Fixture",
  "Property: 707 TEST RECORD WAY, MIAMI, FL 00000",
  "Spouse: Avery QA Fixture",
  "Phone: 305-555-0100",
].join("\n");
const authoritativeOperatorImport = await productionWorkerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: durableCrmSubjectEstateId,
    estateId: durableCrmSubjectEstateId,
    leadId: durableCrmSubjectEstateId,
    ownerName: "Forged Request Owner",
    propertyAddress: "123 FORGED REQUEST ST, MIAMI, FL 33101",
    mode: "operator_import",
    importedText: authoritativeOperatorText,
    attachment: { fileName: "authoritative-operator-paste.txt", sourceUrl: "https://operator.test/authoritative-operator-paste.txt" },
  }),
});
assert.equal(authoritativeOperatorImport.response.status, 200, "a report matching the exact durable estate subject must pass");
assert.equal(authoritativeOperatorImport.body.readbackStatus, "verified");
assert.equal(authoritativeOperatorImport.body.subjectMatch.matched, true);
assert.deepEqual(authoritativeOperatorImport.body.subjectMatch.signals.sort(), ["address", "owner"]);
assert.equal(authoritativeOperatorImport.body.candidates[0].ownerLastNameMatch, true, "candidate owner comparison must use the durable estate owner, not forged request fields");
assert.equal("text" in authoritativeOperatorImport.body.extraction, false);
assert.equal(authoritativeOperatorImport.body.extraction.sourceLocators.some((locator) => "text" in locator), false);
assert.doesNotMatch(JSON.stringify(authoritativeOperatorImport.body), /IDI Asset Report|Owner:|Property:/, "successful operator imports must not return the raw report body");
const authoritativeOperatorStorageEntry = [...env.PACKET_ARTIFACTS.values.entries()]
  .find(([key, value]) => key.startsWith("idi-import:") && JSON.parse(value).assetKey === durableCrmSubjectEstateId);
assert.ok(authoritativeOperatorStorageEntry);
const operatorWithoutSubjectMatch = JSON.parse(authoritativeOperatorStorageEntry[1]);
delete operatorWithoutSubjectMatch.subjectMatch;
await env.PACKET_ARTIFACTS.put(authoritativeOperatorStorageEntry[0], JSON.stringify(operatorWithoutSubjectMatch));
const unverifiedStoredOperator = await productionWorkerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(durableCrmSubjectEstateId)}`);
assert.equal(unverifiedStoredOperator.response.status, 200);
assert.equal(unverifiedStoredOperator.body.status, "review_required", "a stored operator import without subject-match evidence must not be canonical");
assert.equal("candidates" in unverifiedStoredOperator.body, false);
await env.PACKET_ARTIFACTS.put(authoritativeOperatorStorageEntry[0], authoritativeOperatorStorageEntry[1]);
const durableCrmCompanyStop = await productionWorkerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: durableCrmCompanyEstateId,
    estateId: durableCrmCompanyEstateId,
    leadId: durableCrmCompanyEstateId,
    ownerName: "Individual Spoof",
    propertyAddress: "808 STOP RECORD WAY, MIAMI, FL 00000",
    mode: "uploaded_file",
    attachment: { artifactId: durableCrmWrongUpload.body.attachment.id },
  }),
});
assert.equal(durableCrmCompanyStop.response.status, 409);
assert.equal(durableCrmCompanyStop.body.error, "canonical_stop_rule");
assert.ok(durableCrmCompanyStop.body.reasonCodes.includes("COMPANY_OWNER"), "durable CRM company ownership must stop before report intake despite spoofed browser ownership");

const crmReadbackGuardStorage = new MemoryDurableStorage();
const crmReadbackGuardState = new WorkspaceState({ storage: crmReadbackGuardStorage });
const crmReadbackGuardKv = new MemoryKv();
const crmReadbackGuardEnv = {
  ...env,
  AUTH_REQUIRED: "true",
  PACKET_ARTIFACTS: crmReadbackGuardKv,
  WORKSPACE_STATE: {
    idFromName(name) { return name; },
    get() { return { fetch: (request) => crmReadbackGuardState.fetch(request) }; },
  },
};
const duplicateCrmEstateId = "crm:podio:s38-duplicate-exact-id";
await seedCanonicalEstate(crmReadbackGuardEnv, {
  assetKey: duplicateCrmEstateId,
  ownerName: "Estate of Rowan QA Fixture",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
});
await seedCrmImportsInState(crmReadbackGuardState, [
  { id: duplicateCrmEstateId, ownerName: "Estate of Rowan QA Fixture", propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000" },
  { id: duplicateCrmEstateId, ownerName: "Morgan Duplicate Record", propertyAddress: "999 OTHER PROPERTY AVE, MIAMI, FL 33101" },
]);
const duplicateCrmIdiResponse = await worker.fetch(new Request("https://worker.test/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    assetKey: duplicateCrmEstateId,
    estateId: duplicateCrmEstateId,
    leadId: duplicateCrmEstateId,
    mode: "operator_import",
    importedText: authoritativeOperatorText,
    attachment: { fileName: "duplicate-id.txt", sourceUrl: "https://operator.test/duplicate-id.txt" },
  }),
}), crmReadbackGuardEnv);
const duplicateCrmIdi = await duplicateCrmIdiResponse.json();
assert.equal(duplicateCrmIdiResponse.status, 503);
assert.equal(duplicateCrmIdi.error, "discovery_file_readback_failed");
assert.equal(duplicateCrmIdi.readbackStatus, "crm_estate_identity_ambiguous", "duplicate durable CRM IDs must block even when a canonical Discovery File exists");
assert.equal([...crmReadbackGuardKv.values.keys()].some((key) => key.startsWith("idi-import:")), false);
const duplicateCrmDiscoveryResponse = await worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: duplicateCrmEstateId,
    seed: { ownerName: "Estate of Rowan QA Fixture", propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000", county: "miami-dade" },
    capture: {},
    includeSkipTrace: false,
  }),
}), crmReadbackGuardEnv);
const duplicateCrmDiscovery = await duplicateCrmDiscoveryResponse.json();
assert.equal(duplicateCrmDiscoveryResponse.status, 503);
assert.equal(duplicateCrmDiscovery.readbackStatus, "crm_estate_identity_ambiguous");

const incompleteCrmEstateId = "crm:podio:s38-incomplete-exact-id";
await seedCanonicalEstate(crmReadbackGuardEnv, {
  assetKey: incompleteCrmEstateId,
  ownerName: "Estate of Rowan QA Fixture",
  propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
});
await seedCrmImportsInState(crmReadbackGuardState, [{
  id: incompleteCrmEstateId,
  ownerName: "Imported estate — needs review",
  propertyAddress: "Missing",
}]);
const incompleteCrmIdiResponse = await worker.fetch(new Request("https://worker.test/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    assetKey: incompleteCrmEstateId,
    estateId: incompleteCrmEstateId,
    leadId: incompleteCrmEstateId,
    mode: "operator_import",
    importedText: authoritativeOperatorText,
    attachment: { fileName: "incomplete-id.txt", sourceUrl: "https://operator.test/incomplete-id.txt" },
  }),
}), crmReadbackGuardEnv);
const incompleteCrmIdi = await incompleteCrmIdiResponse.json();
assert.equal(incompleteCrmIdiResponse.status, 503);
assert.equal(incompleteCrmIdi.error, "discovery_file_readback_failed");
assert.equal(incompleteCrmIdi.readbackStatus, "crm_estate_subject_incomplete", "an incomplete durable CRM subject must block even when a canonical Discovery File exists");
assert.equal([...crmReadbackGuardKv.values.keys()].some((key) => key.startsWith("idi-import:")), false);

class ObjectReadbackFailureKv extends MemoryKv {
  failed = false;
  async get(key) {
    if (!this.failed && key.startsWith("supporting-document:") && this.values.has(key)) {
      this.failed = true;
      return null;
    }
    return super.get(key);
  }
}
const objectFailureKv = new ObjectReadbackFailureKv();
const objectReadbackFailure = await worker.fetch(new Request("https://worker.test/api/documents/attachments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    estateId: "estate:s38-object-readback-failure",
    documentId: "idi-asset-search",
    fileName: "idi-object-readback.csv",
    contentType: "text/csv",
    dataBase64: Buffer.from(csv).toString("base64"),
  }),
}), { AUTH_REQUIRED: "false", PACKET_ARTIFACTS: objectFailureKv });
const objectReadbackFailureBody = await objectReadbackFailure.json();
assert.equal(objectReadbackFailure.status, 503);
assert.equal(objectReadbackFailureBody.error, "supporting_document_readback_failed");
assert.equal(objectReadbackFailureBody.cleanup.complete, true);
assert.equal([...objectFailureKv.values.keys()].some((key) => key.startsWith("supporting-document:")), false);

class IndexWriteFailureKv extends MemoryKv {
  failed = false;
  async put(key, value, options = {}) {
    await super.put(key, value, options);
    if (!this.failed && key.startsWith("supporting-document-index:")) {
      this.failed = true;
      throw new Error("injected partial index write");
    }
  }
}
const indexFailureKv = new IndexWriteFailureKv();
const indexWriteFailure = await worker.fetch(new Request("https://worker.test/api/documents/attachments", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    estateId: "estate:s38-index-write-failure",
    documentId: "idi-asset-search",
    fileName: "idi-index-write.csv",
    contentType: "text/csv",
    dataBase64: Buffer.from(csv).toString("base64"),
  }),
}), { AUTH_REQUIRED: "false", PACKET_ARTIFACTS: indexFailureKv });
const indexWriteFailureBody = await indexWriteFailure.json();
assert.equal(indexWriteFailure.status, 503);
assert.equal(indexWriteFailureBody.error, "supporting_document_index_readback_failed");
assert.equal(indexWriteFailureBody.cleanup.complete, true);
assert.equal([...indexFailureKv.values.keys()].some((key) => key.startsWith("supporting-document:")), false);
assert.equal([...indexFailureKv.values.keys()].some((key) => key.startsWith("supporting-document-index:")), false);

const protectedImport = await workerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: estateId,
    ownerName: "Estate of Rowan QA Fixture",
    mode: "uploaded_file",
    attachment: { artifactId: upload.body.attachment.id, contentHash: upload.body.attachment.contentHash },
    extraction: { status: "extracted", method: "csv_rows", fileKind: "csv", text: csv, sourceLocators: [{ kind: "row", index: 1, label: "CSV row 1", text: csv.split("\n")[0] }, { kind: "row", index: 2, label: "CSV row 2", text: csv.split("\n")[1] }] },
  }),
});
assert.equal(protectedImport.response.status, 403);
assert.equal(protectedImport.body.error, "uploaded_intake_internal_only");

const imported = await workerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    assetKey: estateId,
    estateId,
    leadId: estateId,
    ownerName: "Estate of Rowan QA Fixture",
    propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
    mode: "uploaded_file",
    attachment: { artifactId: upload.body.attachment.id, contentHash: upload.body.attachment.contentHash },
    extraction: {
      status: "extracted",
      method: "csv_rows",
      fileKind: "csv",
      text: csv,
      sourceLocators: [{ kind: "row", index: 1, label: "CSV row 1", text: csv.split("\n")[0] }, { kind: "row", index: 2, label: "CSV row 2", text: csv.split("\n")[1] }],
      extractedAt: new Date().toISOString(),
    },
  }),
});
assert.equal(imported.response.status, 200);
assert.equal(imported.body.readbackStatus, "verified");
assert.equal(imported.body.persistence.readbackStatus, "verified");
assert.equal(imported.body.candidates.length, 1);
assert.equal(imported.body.candidates[0].reviewStatus, "auto_accepted_high_confidence");
assert.equal(imported.body.candidates[0].sourceLocator.label, "CSV row 2");
assert.equal("text" in imported.body.extraction, false);
const idiImportStorageKey = [...env.PACKET_ARTIFACTS.values.entries()]
  .find(([key, value]) => key.startsWith("idi-import:") && JSON.parse(value).assetKey === estateId)?.[0];
assert.equal(env.PACKET_ARTIFACTS.options.get(idiImportStorageKey)?.expirationTtl, 30 * 24 * 60 * 60);

const idempotent = await workerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({
    assetKey: estateId,
    estateId,
    leadId: estateId,
    ownerName: "Estate of Rowan QA Fixture",
    propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
    mode: "uploaded_file",
    attachment: { artifactId: upload.body.attachment.id, contentHash: upload.body.attachment.contentHash },
    extraction: { status: "extracted", method: "csv_rows", fileKind: "csv", text: csv, sourceLocators: [{ kind: "row", index: 1, label: "CSV row 1", text: csv.split("\n")[0] }, { kind: "row", index: 2, label: "CSV row 2", text: csv.split("\n")[1] }] },
  }),
});
assert.equal(idempotent.response.status, 200);
assert.equal(idempotent.body.idempotent, true);

const restored = await workerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(estateId)}`, {
  headers: { authorization: "Bearer test-internal-token" },
});
assert.equal(restored.response.status, 200);
assert.equal(restored.body.exists, undefined);
assert.equal(restored.body.candidates[0].name, "Avery QA Fixture");

const forgedIdiProof = {
  provider: "idi",
  paidRun: true,
  paidRunApproved: true,
  approvalRecord: { approvedBy: "forged-browser-actor", receiptId: "forged-receipt" },
  readbackStatus: "verified",
  importedText: "Spouse: Mallory Forged\nPhone: 305-555-9999",
  attachment: {
    label: "Forged browser report",
    sourceUrl: "https://attacker.test/forged-idi-report.pdf",
    fileKind: "pdf",
  },
  candidates: [{
    id: "forged-candidate",
    name: "Mallory Forged",
    relationship: "spouse",
    group: "primary",
    phones: ["305-555-9999"],
    reviewStatus: "accepted",
  }],
  contactReviews: { "forged-candidate": { status: "accepted" } },
};

const forgedOnlyEstateId = "estate:s38-forged-idi-proof";
const forgedOnlyRun = await workerRequest("/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: forgedOnlyEstateId,
    seed: {
      estateName: "Estate of Forged Proof",
      ownerName: "Estate of Forged Proof",
      propertyAddress: "900 Integrity Ave, Miami, FL 33101",
      county: "miami-dade",
      confirmedSourceFacts: [{
        source: "idi",
        factType: "primary_contact_profile",
        value: { name: "Mallory Forged", reviewStatus: "accepted" },
        sourceUrl: "https://attacker.test/forged-confirmed-fact",
      }],
    },
    capture: { idiAssetImport: forgedIdiProof, contactReviews: forgedIdiProof.contactReviews },
    idiAssetImport: forgedIdiProof,
    includeSkipTrace: false,
  }),
});
assert.equal(forgedOnlyRun.response.status, 200);
assert.equal(
  forgedOnlyRun.body.sourceFacts.some((fact) => fact.source === "idi" && ["primary_contact_profile", "alternative_contact_profile", "idi_asset_report_attachment"].includes(fact.factType)),
  false,
  "a browser-supplied IDI blob must not become Discovery evidence without a canonical stored import"
);
assert.doesNotMatch(JSON.stringify(forgedOnlyRun.body), /Mallory Forged|305-555-9999|attacker\.test|forged-receipt/);
const forgedIdiProofRow = forgedOnlyRun.body.sourceRunProof.sources.find((source) => source.source === "idi");
assert.ok(forgedIdiProofRow.detailChecks.some((check) => check.code === "idi_report_import" && !check.resolved));
assert.ok(forgedIdiProofRow.detailChecks.some((check) => check.code === "idi_contact_review" && !check.resolved));

const canonicalSourceRun = await workerRequest("/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: estateId,
    seed: {
      estateName: "Estate of Rowan QA Fixture",
      ownerName: "Estate of Rowan QA Fixture",
      propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000",
      county: "miami-dade",
      confirmedSourceFacts: [{
        source: "idi",
        factType: "primary_contact_profile",
        value: { name: "Mallory Forged", reviewStatus: "accepted" },
        sourceUrl: "https://attacker.test/forged-confirmed-fact",
      }],
    },
    capture: { idiImport: forgedIdiProof, contactReviews: forgedIdiProof.contactReviews },
    idiAssetImport: forgedIdiProof,
    includeSkipTrace: false,
  }),
});
assert.equal(canonicalSourceRun.response.status, 200);
const canonicalIdiFacts = canonicalSourceRun.body.sourceFacts.filter((fact) => fact.source === "idi");
assert.ok(canonicalIdiFacts.some((fact) => fact.factType === "idi_asset_report_attachment" && fact.sourceUrl === imported.body.attachment.artifactUrl));
assert.ok(canonicalIdiFacts.some((fact) => fact.factType === "primary_contact_profile" && fact.value?.name === "Avery QA Fixture" && fact.value?.reviewStatus === "accepted"));
assert.equal(canonicalIdiFacts.some((fact) => fact.value?.name === "Mallory Forged"), false);
const canonicalIdiStatus = canonicalIdiFacts.find((fact) => fact.factType === "idi_asset_search_status");
assert.equal(canonicalIdiStatus.value.paidRunApproved, false);
assert.equal("approvalRecord" in canonicalIdiStatus.value, false);
assert.doesNotMatch(JSON.stringify(canonicalSourceRun.body), /Mallory Forged|305-555-9999|attacker\.test|forged-receipt/);
const canonicalIdiProof = canonicalSourceRun.body.sourceRunProof.sources.find((source) => source.source === "idi");
assert.ok(canonicalIdiProof.detailChecks.some((check) => check.code === "idi_report_import" && check.resolved));
assert.ok(canonicalIdiProof.detailChecks.some((check) => check.code === "idi_contact_review" && check.resolved));
assert.ok(canonicalIdiProof.detailChecks.some((check) => check.code === "idi_paid_run_approval" && !check.resolved));
const discoveryStorageKey = [...env.PACKET_ARTIFACTS.values.entries()]
  .find(([key, value]) => key.startsWith("discovery-file:") && JSON.parse(value).estateId === estateId)?.[0];
assert.ok(discoveryStorageKey);
assert.equal(env.PACKET_ARTIFACTS.options.get(discoveryStorageKey)?.expirationTtl, 30 * 24 * 60 * 60);
const canonicalDiscoveryReadback = JSON.parse(env.PACKET_ARTIFACTS.values.get(discoveryStorageKey));
assert.equal("idiImport" in canonicalDiscoveryReadback.capture, false);
assert.equal("idiAssetImport" in canonicalDiscoveryReadback.capture, false);
assert.equal("contactReviews" in canonicalDiscoveryReadback.capture, false);

const canonicalCandidateId = imported.body.candidates[0].id;
const missingReviewStatus = await workerRequest(`/api/discovery/contact-candidates/${encodeURIComponent(canonicalCandidateId)}/review`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ assetKey: estateId }),
});
assert.equal(missingReviewStatus.response.status, 400);
assert.equal(missingReviewStatus.body.error, "contact_review_invalid");
const unknownCandidateReview = await workerRequest(`/api/discovery/contact-candidates/${encodeURIComponent("forged-candidate")}/review`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ assetKey: estateId, status: "accepted" }),
});
assert.equal(unknownCandidateReview.response.status, 404);
assert.equal(unknownCandidateReview.body.error, "idi_contact_candidate_not_found");
const reviewViaGet = await workerRequest(`/api/discovery/contact-candidates/${encodeURIComponent(canonicalCandidateId)}/review`, {
  method: "GET",
});
assert.equal(reviewViaGet.response.status, 405);

const rejectedReview = await workerRequest(`/api/discovery/contact-candidates/${encodeURIComponent(canonicalCandidateId)}/review`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ assetKey: estateId, status: "rejected", reviewedBy: "forged-reviewer@attacker.test" }),
});
assert.equal(rejectedReview.response.status, 200);
assert.equal(rejectedReview.body.readbackStatus, "verified");
assert.equal(rejectedReview.body.status, "rejected");
assert.notEqual(rejectedReview.body.reviewedBy, "forged-reviewer@attacker.test");
const contactReviewStorageKey = [...env.PACKET_ARTIFACTS.values.keys()].find((key) => key.startsWith("idi-contact-review:"));
assert.ok(contactReviewStorageKey);
assert.equal(env.PACKET_ARTIFACTS.options.get(contactReviewStorageKey)?.expirationTtl, 30 * 24 * 60 * 60);
const rejectedReload = await workerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(estateId)}`);
assert.equal(rejectedReload.body.candidates[0].reviewStatus, "rejected");
assert.equal(rejectedReload.body.contactReviews[canonicalCandidateId].status, "rejected");
const rejectedSourceRun = await workerRequest("/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: estateId,
    seed: { estateName: "Estate of Rowan QA Fixture", ownerName: "Estate of Rowan QA Fixture", propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000", county: "miami-dade" },
    capture: {},
    includeSkipTrace: false,
  }),
});
const rejectedIdiProof = rejectedSourceRun.body.sourceRunProof.sources.find((source) => source.source === "idi");
assert.ok(rejectedIdiProof.detailChecks.some((check) => check.code === "idi_contact_review" && !check.resolved));

const promotedReview = await workerRequest(`/api/discovery/contact-candidates/${encodeURIComponent(canonicalCandidateId)}/review`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ assetKey: estateId, status: "promoted", reviewedBy: "another-forged-reviewer@attacker.test" }),
});
assert.equal(promotedReview.response.status, 200);
assert.equal(promotedReview.body.status, "promoted");
assert.notEqual(promotedReview.body.reviewedBy, "another-forged-reviewer@attacker.test");
const promotedReload = await workerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(estateId)}`);
assert.equal(promotedReload.body.candidates[0].reviewStatus, "promoted");
const promotedSourceRun = await workerRequest("/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: estateId,
    seed: { estateName: "Estate of Rowan QA Fixture", ownerName: "Estate of Rowan QA Fixture", propertyAddress: "707 TEST RECORD WAY, MIAMI, FL 00000", county: "miami-dade" },
    capture: {},
    includeSkipTrace: false,
  }),
});
const promotedIdiProof = promotedSourceRun.body.sourceRunProof.sources.find((source) => source.source === "idi");
assert.ok(promotedIdiProof.detailChecks.some((check) => check.code === "idi_contact_review" && check.resolved));
const promotedCompletedContact = promotedSourceRun.body.dossier.completedLeadReport.contactPlaceholders
  .find((contact) => contact.name === "Avery QA Fixture");
assert.ok(promotedCompletedContact, "a canonically promoted IDI contact must reach the completed lead report contact matrix");
assert.match(promotedCompletedContact.note, /^Promoted from the reviewed IDI report\./);
assert.deepEqual(promotedCompletedContact.reviewFlags, [], "a canonically promoted IDI contact must not retain generic contact-review placeholder flags");
assert.equal(
  ["CONTACT_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"]
    .some((flag) => promotedCompletedContact.reviewFlags.includes(flag)),
  false,
);
const canonicalImportBeforeReplacement = env.PACKET_ARTIFACTS.values.get(idiImportStorageKey);
const replacementRevision = JSON.parse(canonicalImportBeforeReplacement);
replacementRevision.attachment.contentHash = "f".repeat(64);
await env.PACKET_ARTIFACTS.put(idiImportStorageKey, JSON.stringify(replacementRevision), {
  expirationTtl: 30 * 24 * 60 * 60,
  metadata: { kind: "idi_import", contentHash: replacementRevision.attachment.contentHash },
});
const replacementReload = await workerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(estateId)}`);
assert.notEqual(replacementReload.body.candidates[0].reviewStatus, "promoted", "contact decisions from an older report revision must not attach to its replacement");
await env.PACKET_ARTIFACTS.put(idiImportStorageKey, canonicalImportBeforeReplacement, {
  expirationTtl: 30 * 24 * 60 * 60,
  metadata: { kind: "idi_import", contentHash: imported.body.attachment.contentHash },
});

const concurrentManualAssetKey = "estate:s38-concurrent-manual-import";
const manualImportRequest = (name, phone) => workerRequest("/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    assetKey: concurrentManualAssetKey,
    ownerName: "Estate of Concurrent Fixture",
    propertyAddress: "401 Concurrent Fixture Way, Miami, FL 33101",
    mode: "operator_import",
    importedText: `Owner: Estate of Concurrent Fixture\nProperty: 401 Concurrent Fixture Way, Miami, FL 33101\nSpouse: ${name}\nPhone: ${phone}`,
    attachment: { fileName: `${name}.txt`, sourceUrl: `https://operator.test/${encodeURIComponent(name)}.txt` },
  }),
});
const concurrentManualImports = await Promise.all([
  manualImportRequest("Alpha Fixture", "305-555-0101"),
  manualImportRequest("Beta Fixture", "305-555-0102"),
]);
const manualWinner = concurrentManualImports.find((result) => result.response.status === 200);
const manualLoser = concurrentManualImports.find((result) => result.response.status === 409);
assert.ok(manualWinner, "one concurrent manual import must win canonical commit");
assert.ok(manualLoser, "one concurrent manual import must be rejected before canonical replacement");
assert.ok(["idi_import_in_progress", "duplicate_idi_asset_search"].includes(manualLoser.body.error));
const concurrentManualReload = await workerRequest(
  `/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(concurrentManualAssetKey)}`
);
assert.equal(concurrentManualReload.response.status, 200);
assert.equal(concurrentManualReload.body.importVerification, "verified");
assert.equal(concurrentManualReload.body.attachment.contentHash, manualWinner.body.attachment.contentHash);

class ManualVerifiedWriteFailureKv extends MemoryKv {
  verifiedWriteFailuresRemaining = 0;
  stageDeleteFailuresRemaining = 0;
  failNextVerifiedWrite() { this.verifiedWriteFailuresRemaining += 1; }
  failNextStageDelete() { this.stageDeleteFailuresRemaining += 1; }
  async put(key, value, options = {}) {
    const record = key.startsWith("idi-import:") ? JSON.parse(value) : null;
    if (record?.importVerification === "verified" && this.verifiedWriteFailuresRemaining > 0) {
      this.verifiedWriteFailuresRemaining -= 1;
      this.options.set(key, options);
      return;
    }
    return super.put(key, value, options);
  }
  async delete(key) {
    if (key.startsWith("idi-import-stage:") && this.stageDeleteFailuresRemaining > 0) {
      this.stageDeleteFailuresRemaining -= 1;
      return;
    }
    return super.delete(key);
  }
}
const manualFinalWriteStorage = new MemoryDurableStorage();
const manualFinalWriteState = new WorkspaceState({ storage: manualFinalWriteStorage });
const manualFinalWriteKv = new ManualVerifiedWriteFailureKv();
const manualFinalWriteEnv = {
  ...env,
  PACKET_ARTIFACTS: manualFinalWriteKv,
  WORKSPACE_STATE: {
    idFromName(name) { return name; },
    get() { return { fetch: (request) => manualFinalWriteState.fetch(request) }; },
  },
};
const manualFinalWriteAssetKey = "estate:s38-manual-final-write-failure";
const manualFinalWritePayload = {
  assetKey: manualFinalWriteAssetKey,
  ownerName: "Estate of Pending Fixture",
  propertyAddress: "402 Pending Fixture Way, Miami, FL 33101",
  mode: "operator_import",
  importedText: "Owner: Estate of Pending Fixture\nProperty: 402 Pending Fixture Way, Miami, FL 33101\nSpouse: Pending Fixture\nPhone: 305-555-0110",
  attachment: { fileName: "pending.txt", sourceUrl: "https://operator.test/pending.txt" },
};
const manualFinalWriteRequest = (payload = manualFinalWritePayload, headers = {}) => worker.fetch(new Request("https://worker.test/api/discovery/idi-asset-search/import", {
  method: "POST",
  headers: { "content-type": "application/json", ...headers },
  body: JSON.stringify(payload),
}), manualFinalWriteEnv);
manualFinalWriteKv.failNextVerifiedWrite();
const manualFinalWriteResponse = await manualFinalWriteRequest();
const manualFinalWriteResult = await manualFinalWriteResponse.json();
assert.equal(manualFinalWriteResponse.status, 503);
assert.equal(manualFinalWriteResult.error, "idi_import_verification_readback_failed");
const manualPendingReloadResponse = await worker.fetch(new Request(
  `https://worker.test/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(manualFinalWriteAssetKey)}`
), manualFinalWriteEnv);
const manualPendingReload = await manualPendingReloadResponse.json();
assert.equal(manualPendingReload.exists, false);
assert.equal("candidates" in manualPendingReload, false);
const manualPendingSourceResponse = await worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: manualFinalWriteAssetKey,
    seed: { county: "miami-dade" },
    capture: {},
    includeSkipTrace: false,
  }),
}), manualFinalWriteEnv);
const manualPendingSource = await manualPendingSourceResponse.json();
assert.equal(manualPendingSource.sourceFacts.some((fact) => fact.source === "idi"), false);
const manualStagingKey = [...manualFinalWriteKv.values.keys()].find((key) => key.startsWith("idi-import-stage:"));
assert.ok(manualStagingKey);
assert.equal(manualFinalWriteKv.options.get(manualStagingKey)?.expirationTtl, 30 * 24 * 60 * 60);
const manualRecoveryResponse = await manualFinalWriteRequest();
const manualRecovery = await manualRecoveryResponse.json();
assert.equal(manualRecoveryResponse.status, 200, JSON.stringify(manualRecovery));
assert.equal(manualRecovery.idempotent, true);
assert.equal(manualRecovery.importVerification, "verified");
assert.equal(manualFinalWriteKv.values.has(manualStagingKey), false, "same-content retry must remove the bounded staging record after recovery");

const replacementAssetKey = "estate:s38-replacement-crash-window";
const originalReplacementPayload = {
  assetKey: replacementAssetKey,
  ownerName: "Estate of Stable Fixture",
  propertyAddress: "506 Transient Status Ave, Miami, FL 33101",
  mode: "operator_import",
  importedText: "Owner: Estate of Stable Fixture\nProperty: 506 Transient Status Ave, Miami, FL 33101\nSpouse: Stable Original\nPhone: 305-555-0120",
  attachment: { fileName: "stable-original.txt", sourceUrl: "https://operator.test/stable-original.txt" },
};
const originalReplacementResponse = await manualFinalWriteRequest(originalReplacementPayload);
const originalReplacement = await originalReplacementResponse.json();
assert.equal(originalReplacementResponse.status, 200);
manualFinalWriteKv.failNextVerifiedWrite();
const replacementPayload = {
  ...originalReplacementPayload,
  importedText: "Owner: Estate of Stable Fixture\nProperty: 506 Transient Status Ave, Miami, FL 33101\nSpouse: Committed Replacement\nPhone: 305-555-0121",
  attachment: { fileName: "committed-replacement.txt", sourceUrl: "https://operator.test/committed-replacement.txt" },
  adminOverrideReason: "Verified operator supplied a corrected report",
};
const replacementFailureResponse = await manualFinalWriteRequest(replacementPayload, { authorization: "Bearer test-internal-token" });
const replacementFailure = await replacementFailureResponse.json();
assert.equal(replacementFailureResponse.status, 503);
assert.equal(replacementFailure.error, "idi_import_verification_readback_failed");
await manualFinalWriteKv.put(`discovery-file:${createHash("sha256").update(replacementAssetKey).digest("hex")}`, JSON.stringify({
  estateId: replacementAssetKey,
  revision: "s38-replacement-canonical-1",
  seed: {
    ownerName: "Estate of Stable Fixture",
    propertyAddress: "506 Transient Status Ave, Miami, FL 33101",
  },
}));
const transientStatusEnv = {
  ...manualFinalWriteEnv,
  IDI_CORE_API_URL: "https://idi.vendor.test/should-not-run",
  IDI_CORE_API_TOKEN: "status-read-test-token",
  IDI_CORE_LIVE_RUN_APPROVED: "true",
  WORKSPACE_STATE: {
    idFromName(name) { return name; },
    get() {
      return {
        fetch: async (request) => {
          const command = await request.clone().json();
          if (new URL(request.url).pathname === "/idi-import-lock" && command.action === "status") {
            return new Response(JSON.stringify({ ok: false, error: "injected_status_read_failure" }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          }
          return manualFinalWriteState.fetch(request);
        },
      };
    },
  },
};
const fetchBeforeTransientStatus = globalThis.fetch;
let transientStatusVendorCalls = 0;
try {
  globalThis.fetch = async () => {
    transientStatusVendorCalls += 1;
    return new Response(JSON.stringify({ ok: true, candidates: [], readbackStatus: "provider_completed" }), { status: 200 });
  };
  const transientStatusResponse = await worker.fetch(new Request("https://worker.test/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify({
      assetKey: replacementAssetKey,
      ownerName: "Estate of Stable Fixture",
      propertyAddress: "506 Transient Status Ave, Miami, FL 33101",
      runMode: "live_idi_core",
      paidRun: true,
    }),
  }), transientStatusEnv);
  const transientStatus = await transientStatusResponse.json();
  assert.equal(transientStatusResponse.status, 503);
  assert.equal(transientStatus.error, "idi_import_guard_readback_failed");
  assert.equal(transientStatusVendorCalls, 0, "a transient asset-guard status failure must fail closed before vendor spend");
} finally {
  globalThis.fetch = fetchBeforeTransientStatus;
}
const replacementCrashReloadResponse = await worker.fetch(new Request(
  `https://worker.test/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(replacementAssetKey)}`
), manualFinalWriteEnv);
const replacementCrashReload = await replacementCrashReloadResponse.json();
assert.equal(replacementCrashReloadResponse.status, 200);
assert.equal(replacementCrashReload.attachment.contentHash, originalReplacement.attachment.contentHash, "a commit-to-canonical-write crash must leave the prior verified report active");
const replacementRecoveryResponse = await manualFinalWriteRequest(replacementPayload, { authorization: "Bearer test-internal-token" });
const replacementRecovery = await replacementRecoveryResponse.json();
assert.equal(replacementRecoveryResponse.status, 200);
assert.equal(replacementRecovery.idempotent, true);
assert.notEqual(replacementRecovery.attachment.contentHash, originalReplacement.attachment.contentHash);
assert.equal([...manualFinalWriteKv.values.keys()].some((key) => key.startsWith("idi-import-stage:")), false);

const cleanupRetryAssetKey = "estate:s38-staging-cleanup-retry";
const cleanupRetryPayload = {
  assetKey: cleanupRetryAssetKey,
  ownerName: "Estate of Cleanup Fixture",
  propertyAddress: "404 Cleanup Fixture Way, Miami, FL 33101",
  mode: "operator_import",
  importedText: "Owner: Estate of Cleanup Fixture\nProperty: 404 Cleanup Fixture Way, Miami, FL 33101\nSpouse: Cleanup Fixture\nPhone: 305-555-0122",
  attachment: { fileName: "cleanup.txt", sourceUrl: "https://operator.test/cleanup.txt" },
};
manualFinalWriteKv.failNextStageDelete();
const cleanupFailureResponse = await manualFinalWriteRequest(cleanupRetryPayload);
const cleanupFailure = await cleanupFailureResponse.json();
assert.equal(cleanupFailureResponse.status, 503);
assert.equal(cleanupFailure.error, "idi_import_stage_cleanup_failed");
const cleanupRetryResponse = await manualFinalWriteRequest(cleanupRetryPayload);
const cleanupRetry = await cleanupRetryResponse.json();
assert.equal(cleanupRetryResponse.status, 200);
assert.equal(cleanupRetry.idempotent, true);
assert.equal([...manualFinalWriteKv.values.keys()].some((key) => key.startsWith("idi-import-stage:")), false);

const paidBody = {
  assetKey: "estate:s38-paid-lock",
  ownerName: "Estate of Ada Lock",
  estateName: "Estate of Ada Lock",
  propertyAddress: "500 Durable Street, Miami, FL 33101",
  county: "miami-dade",
  provider: "idi",
  runMode: "live_idi_core",
  paidRun: true,
};
const originalFetch = globalThis.fetch;
const originalAuthRequired = process.env.AUTH_REQUIRED;
const originalWorkerUrl = process.env.HEIRRIGHT_WORKER_URL;
const originalApiToken = process.env.HEIRRIGHT_API_TOKEN;
let vendorCalls = 0;
let ambiguousVendorCalls = 0;
let canonicalWriteFailureCalls = 0;
try {
  globalThis.fetch = async (input, init = {}) => {
    if (String(input) !== "https://idi.vendor.test/search") throw new Error(`Unexpected paid-run fetch: ${String(input)}`);
    const vendorRequest = JSON.parse(String(init.body || "{}"));
    if (String(vendorRequest.propertyAddress).includes("Ambiguous Empty")) {
      ambiguousVendorCalls += 1;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }
    if (String(vendorRequest.propertyAddress).includes("Ambiguous Shape")) {
      ambiguousVendorCalls += 1;
      return new Response(JSON.stringify({ ok: true, readbackStatus: "provider_completed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (String(vendorRequest.propertyAddress).includes("Canonical Write Failure")) {
      canonicalWriteFailureCalls += 1;
      return new Response(JSON.stringify({ ok: true, candidates: [], readbackStatus: "provider_completed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    vendorCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ ok: true, candidates: [], readbackStatus: "provider_completed" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  env.IDI_CORE_API_URL = "https://idi.vendor.test/search";
  env.IDI_CORE_API_TOKEN = "paid-test-token";
  delete env.IDI_CORE_LIVE_RUN_APPROVED;
  await seedCanonicalEstate(env, paidBody);

  const clientApprovedOnly = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify({ ...paidBody, liveRunApproved: true }),
  });
  assert.equal(clientApprovedOnly.response.status, 403);
  assert.equal(clientApprovedOnly.body.error, "idi_live_run_not_approved");
  assert.equal(vendorCalls, 0);

  env.IDI_CORE_LIVE_RUN_APPROVED = "true";
  const browserPaidRun = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(paidBody),
  });
  assert.equal(browserPaidRun.response.status, 403);
  assert.equal(browserPaidRun.body.error, "paid_idi_intake_internal_only");

  env.WORKSPACE_STATE = {
    idFromName(name) { return name; },
    get() {
      return {
        fetch: async (request) => {
          if (new URL(request.url).pathname === "/idi-import-lock") {
            return new Response(JSON.stringify({ ok: false, error: "idi_import_guard_unavailable", message: "Canonical IDI import serialization is unavailable. No report was saved." }), {
              status: 503,
              headers: { "content-type": "application/json" },
            });
          }
          return paidRunState.fetch(request);
        },
      };
    },
  };
  const missingLock = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(paidBody),
  });
  assert.equal(missingLock.response.status, 503);
  assert.equal(missingLock.body.error, "idi_import_guard_unavailable");
  assert.equal(vendorCalls, 0);
  env.WORKSPACE_STATE = workspaceNamespace;

  const stoppedVendorBaseline = vendorCalls;
  for (const stoppedCase of [
    {
      input: { ...paidBody, assetKey: "crm:podio:company-owner-stop", ownerName: "Lock Holdings LLC", estateName: "Lock Holdings LLC", propertyAddress: "601 Stop Rule Ave, Miami, FL 33101", adminOverrideReason: "Administrator requested another paid report" },
      record: { capture: { propertyAppraiser: { ownerName: "Lock Holdings LLC" } } },
      reasonCode: "COMPANY_OWNER",
    },
    {
      input: { ...paidBody, assetKey: "crm:podio:recent-sale-stop", propertyAddress: "602 Stop Rule Ave, Miami, FL 33101", adminOverrideReason: "Administrator requested another paid report" },
      record: { capture: { deed: { lastSaleDate: "2026-06-01" } } },
      reasonCode: "RECENT_SALE_WITHIN_5_YEARS",
    },
  ]) {
    await seedCanonicalEstate(env, stoppedCase.input, stoppedCase.record);
    const stopped = await workerRequest("/api/discovery/idi-asset-search/import", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
      body: JSON.stringify(stoppedCase.input),
    });
    assert.equal(stopped.response.status, 409);
    assert.equal(stopped.body.error, "canonical_stop_rule");
    assert.ok(stopped.body.reasonCodes.includes(stoppedCase.reasonCode));
    assert.match(
      stopped.body.message,
      stoppedCase.reasonCode === "COMPANY_OWNER" ? /correct the Property Appraiser source record/i : /correct the Official Records source record/i,
      "canonical stops must direct the operator to the authoritative source that needs correction",
    );
    assert.match(stopped.body.blockers.join(" "), /no override/i);
  }
  assert.equal(vendorCalls, stoppedVendorBaseline, "company-owner and recent-sale stops must block before paid vendor access even with an administrator reason");

  for (const ambiguousCase of [
    { assetKey: "estate:s38-paid-ambiguous-empty", propertyAddress: "501 Ambiguous Empty Ave, Miami, FL 33101" },
    { assetKey: "estate:s38-paid-ambiguous-shape", propertyAddress: "502 Ambiguous Shape Ave, Miami, FL 33101" },
  ]) {
    await seedCanonicalEstate(env, { ...paidBody, ...ambiguousCase });
    const ambiguousResult = await workerRequest("/api/discovery/idi-asset-search/import", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
      body: JSON.stringify({ ...paidBody, ...ambiguousCase }),
    });
    assert.equal(ambiguousResult.response.status, 502);
    assert.equal(ambiguousResult.body.error, "idi_core_result_ambiguous");
    assert.match(ambiguousResult.body.blockers.join(" "), /administrator must verify vendor history/i);
  }
  assert.equal(ambiguousVendorCalls, 2);
  assert.equal(
    [...paidRunStorage.values.values()].filter((record) => record.status === "review_required").length,
    2,
    "ambiguous HTTP 2xx vendor results must finalize the durable locks as review-required"
  );
  const ambiguousRetryBody = { ...paidBody, assetKey: "estate:s38-paid-ambiguous-empty-retry", propertyAddress: "501 Ambiguous Empty Ave, Miami, FL 33101" };
  await seedCanonicalEstate(env, ambiguousRetryBody);
  const ambiguousRetry = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(ambiguousRetryBody),
  });
  assert.equal(ambiguousRetry.response.status, 409);
  assert.equal(ambiguousRetry.body.error, "duplicate_idi_paid_run");
  assert.equal(ambiguousVendorCalls, 2);

  class IdiImportWriteFailureKv extends MemoryKv {
    async put(key, value, options = {}) {
      if (key.startsWith("idi-import:")) throw new Error("injected canonical IDI write failure");
      return super.put(key, value, options);
    }
  }
  const canonicalFailureStorage = new MemoryDurableStorage();
  const canonicalFailureState = new WorkspaceState({ storage: canonicalFailureStorage });
  const canonicalFailureEnv = {
    ...env,
    PACKET_ARTIFACTS: new IdiImportWriteFailureKv(),
    WORKSPACE_STATE: {
      idFromName(name) { return name; },
      get() { return { fetch: (request) => canonicalFailureState.fetch(request) }; },
    },
  };
  const canonicalWriteFailureInput = {
    ...paidBody,
    assetKey: "estate:s38-paid-canonical-write-failure",
    propertyAddress: "503 Canonical Write Failure Ave, Miami, FL 33101",
  };
  await seedCanonicalEstate(canonicalFailureEnv, canonicalWriteFailureInput);
  const canonicalWriteFailureResponse = await worker.fetch(new Request("https://worker.test/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(canonicalWriteFailureInput),
  }), canonicalFailureEnv);
  const canonicalWriteFailureBody = await canonicalWriteFailureResponse.json();
  assert.equal(canonicalWriteFailureResponse.status, 503);
  assert.equal(canonicalWriteFailureBody.error, "idi_import_verification_readback_failed");
  assert.equal(canonicalWriteFailureCalls, 1);
  assert.equal([...canonicalFailureStorage.values.values()].some((record) => record.status === "completed"), false);
  assert.equal([...canonicalFailureStorage.values.values()].some((record) => record.status === "review_required"), true);

  const finalizationFailureStorage = new MemoryDurableStorage();
  const finalizationFailureState = new WorkspaceState({ storage: finalizationFailureStorage });
  const finalizationFailureKv = new MemoryKv();
  const finalizationFailureEnv = {
    ...env,
    PACKET_ARTIFACTS: finalizationFailureKv,
    WORKSPACE_STATE: {
      idFromName(name) { return name; },
      get() {
        return {
          fetch: async (request) => {
            const command = await request.clone().json();
            if (command.action === "complete") {
              return new Response(JSON.stringify({ ok: false, error: "injected_complete_readback_failure" }), {
                status: 503,
                headers: { "content-type": "application/json" },
              });
            }
            return finalizationFailureState.fetch(request);
          },
        };
      },
    },
  };
  const finalizationFailureBody = {
    ...paidBody,
    assetKey: "estate:s38-paid-finalization-failure",
    propertyAddress: "504 Finalization Failure Ave, Miami, FL 33101",
  };
  await seedCanonicalEstate(finalizationFailureEnv, finalizationFailureBody);
  const finalizationFailureResponse = await worker.fetch(new Request("https://worker.test/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(finalizationFailureBody),
  }), finalizationFailureEnv);
  const finalizationFailureResult = await finalizationFailureResponse.json();
  assert.equal(finalizationFailureResponse.status, 503);
  assert.equal(finalizationFailureResult.error, "idi_paid_run_lock_readback_failed");
  assert.equal([...finalizationFailureStorage.values.values()].some((record) => record.status === "completed"), false);
  assert.equal([...finalizationFailureStorage.values.values()].some((record) => record.status === "review_required"), true);
  const failedPaidReloadResponse = await worker.fetch(new Request(
    `https://worker.test/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(finalizationFailureBody.assetKey)}`
  ), finalizationFailureEnv);
  const failedPaidReload = await failedPaidReloadResponse.json();
  assert.equal(failedPaidReloadResponse.status, 200);
  assert.equal(failedPaidReload.paidRun, true);
  assert.equal(failedPaidReload.paidRunApproved, false);
  assert.equal(failedPaidReload.reviewRequired, true);
  assert.notEqual(failedPaidReload.paidRunVerification, "verified");
  const failedPaidSourceResponse = await worker.fetch(new Request("https://worker.test/api/discovery/external-source-run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operatorIntent: "run_external_source_search",
      assetKey: finalizationFailureBody.assetKey,
      seed: { county: "miami-dade" },
      capture: {},
      includeSkipTrace: false,
    }),
  }), finalizationFailureEnv);
  const failedPaidSource = await failedPaidSourceResponse.json();
  assert.equal(failedPaidSourceResponse.status, 200, JSON.stringify(failedPaidSource));
  const failedPaidStatus = failedPaidSource.sourceFacts.find((fact) => fact.source === "idi" && fact.factType === "idi_asset_search_status");
  assert.equal(failedPaidStatus.value.paidRunApproved, false);
  assert.equal("approvalRecord" in failedPaidStatus.value, false);
  const failedPaidProof = failedPaidSource.sourceRunProof.sources.find((source) => source.source === "idi");
  assert.ok(failedPaidProof.detailChecks.some((check) => check.code === "idi_paid_run_approval" && !check.resolved));

  class StalePaidPhaseKv extends MemoryKv {
    async put(key, value, options = {}) {
      const record = key.startsWith("idi-import:") ? JSON.parse(value) : null;
      if (record?.paidRunVerification === "verified") {
        this.options.set(key, options);
        return;
      }
      return super.put(key, value, options);
    }
  }
  const stalePhaseStorage = new MemoryDurableStorage();
  const stalePhaseState = new WorkspaceState({ storage: stalePhaseStorage });
  const stalePhaseEnv = {
    ...env,
    PACKET_ARTIFACTS: new StalePaidPhaseKv(),
    WORKSPACE_STATE: {
      idFromName(name) { return name; },
      get() { return { fetch: (request) => stalePhaseState.fetch(request) }; },
    },
  };
  const stalePhaseBody = {
    ...paidBody,
    assetKey: "estate:s38-paid-stale-phase-readback",
    propertyAddress: "505 Stale Phase Ave, Miami, FL 33101",
  };
  await seedCanonicalEstate(stalePhaseEnv, stalePhaseBody);
  const stalePhaseResponse = await worker.fetch(new Request("https://worker.test/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(stalePhaseBody),
  }), stalePhaseEnv);
  const stalePhaseResult = await stalePhaseResponse.json();
  assert.equal(stalePhaseResponse.status, 503);
  assert.equal(stalePhaseResult.error, "idi_paid_run_verification_readback_failed");
  const stalePhaseReloadResponse = await worker.fetch(new Request(
    `https://worker.test/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(stalePhaseBody.assetKey)}`
  ), stalePhaseEnv);
  const stalePhaseReload = await stalePhaseReloadResponse.json();
  assert.equal(stalePhaseReload.paidRunApproved, false);
  assert.equal(stalePhaseReload.reviewRequired, true);
  assert.equal(stalePhaseReload.paidRunVerification, "pending_lock_completion");

  const paidRunVendorBaseline = vendorCalls;
  const paidRequest = () => workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(paidBody),
  });
  const concurrentPaidRuns = await Promise.all([paidRequest(), paidRequest()]);
  const firstPaidRun = concurrentPaidRuns.find((result) => result.response.status === 200);
  const concurrentDuplicate = concurrentPaidRuns.find((result) => result.response.status === 409);
  assert.ok(firstPaidRun);
  assert.ok(concurrentDuplicate);
  assert.equal(firstPaidRun.response.status, 200);
  assert.equal(firstPaidRun.body.paidRun, true);
  assert.equal(firstPaidRun.body.paidRunApproved, true);
  assert.equal(firstPaidRun.body.paidRunVerification, "verified");
  assert.equal(firstPaidRun.body.persistence.readbackStatus, "verified");
  assert.ok(
    ["duplicate_idi_paid_run", "idi_import_in_progress"].includes(concurrentDuplicate.body.error),
    "the losing concurrent paid request must be stopped by either the paid-address or canonical-asset guard"
  );
  assert.equal(vendorCalls, paidRunVendorBaseline + 1);
  const paidCanonicalEntry = [...env.PACKET_ARTIFACTS.values.entries()]
    .find(([key, value]) => key.startsWith("idi-import:") && JSON.parse(value).assetKey === paidBody.assetKey);
  assert.ok(paidCanonicalEntry);
  assert.equal(JSON.parse(paidCanonicalEntry[1]).paidRun, true);
  assert.equal(JSON.parse(paidCanonicalEntry[1]).paidRunVerification, "verified");
  assert.equal(JSON.parse(paidCanonicalEntry[1]).mode, "live_idi_core");
  assert.equal(env.PACKET_ARTIFACTS.options.get(paidCanonicalEntry[0])?.expirationTtl, 30 * 24 * 60 * 60);
  const paidCanonicalReload = await workerRequest(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(paidBody.assetKey)}`);
  assert.equal(paidCanonicalReload.response.status, 200);
  assert.equal(paidCanonicalReload.body.paidRun, true);
  assert.equal(paidCanonicalReload.body.paidRunApproved, true);
  assert.equal(paidCanonicalReload.body.mode, "live_idi_core");
  assert.equal(paidCanonicalReload.body.readbackStatus, "verified");

  const duplicatePaidRun = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(paidBody),
  });
  assert.equal(duplicatePaidRun.response.status, 409);
  assert.equal(duplicatePaidRun.body.error, "duplicate_idi_paid_run");
  assert.equal(vendorCalls, paidRunVendorBaseline + 1);

  const identityVariationBody = {
    ...paidBody,
    assetKey: "estate:s38-paid-lock-provider-owner-variation",
    provider: "forged-provider-variant",
    ownerName: "Estate of Completely Different Owner",
    estateName: "Estate of Completely Different Owner",
    propertyAddress: "500 DURABLE ST, MIAMI, FL 33101",
  };
  await seedCanonicalEstate(env, identityVariationBody);
  const identityVariation = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify(identityVariationBody),
  });
  assert.equal(identityVariation.response.status, 409);
  assert.equal(identityVariation.body.error, "duplicate_idi_paid_run");
  assert.equal(vendorCalls, paidRunVendorBaseline + 1, "provider and owner variations at one normalized property address must not buy another lookup");

  const paidLockEntry = [...paidRunStorage.values.entries()].find(([key, record]) => key.startsWith("paid-idi:") && record.status === "completed");
  assert.ok(paidLockEntry);
  const staleReservationId = "stale-reservation-before-retry";
  paidRunStorage.values.set(paidLockEntry[0], {
    ...paidLockEntry[1],
    reservationId: staleReservationId,
    status: "reserved",
    reservedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    completedAt: undefined,
  });
  const staleRetry = await paidRequest();
  assert.equal(staleRetry.response.status, 409);
  assert.equal(staleRetry.body.error, "duplicate_idi_paid_run");
  assert.equal(vendorCalls, paidRunVendorBaseline + 1);

  const shortOverride = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify({ ...paidBody, adminOverrideReason: "retry" }),
  });
  assert.equal(shortOverride.response.status, 422);
  assert.equal(shortOverride.body.error, "idi_import_override_reason_required");
  assert.equal(vendorCalls, paidRunVendorBaseline + 1);

  const overrideReason = "Prior vendor result omitted the approved heir address";
  const overriddenPaidRun = await workerRequest("/api/discovery/idi-asset-search/import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
    body: JSON.stringify({ ...paidBody, adminOverrideReason: overrideReason }),
  });
  assert.equal(overriddenPaidRun.response.status, 200);
  assert.equal(vendorCalls, paidRunVendorBaseline + 2);
  const paidLockRecord = [...paidRunStorage.values.entries()].find(([key, record]) => key.startsWith("paid-idi:") && record.overrideReason === overrideReason)?.[1];
  assert.equal(paidLockRecord?.status, "completed");
  assert.equal(paidLockRecord?.overrideReason, overrideReason);
  assert.ok(paidLockRecord?.previousReservationId);

  process.env.AUTH_REQUIRED = "false";
  process.env.HEIRRIGHT_WORKER_URL = "https://worker.cleanup.test";
  process.env.HEIRRIGHT_API_TOKEN = "test-internal-token";
  const cleanupRequests = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = String(init.method || "GET").toUpperCase();
    cleanupRequests.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : null });
    if (method === "GET" && url.includes("/api/documents/attachments?attachmentId=")) {
      return new Response(Buffer.from(csv), {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "x-heirright-artifact-id": upload.body.attachment.id,
          "x-heirright-content-hash": upload.body.attachment.contentHash,
        },
      });
    }
    if (method === "POST" && url.endsWith("/api/discovery/idi-asset-search/import")) {
      return new Response(JSON.stringify({ ok: false, error: "idi_import_store_unavailable", message: "Shared IDI storage is unavailable." }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    if (method === "DELETE" && url.includes("/api/documents/attachments?attachmentId=")) {
      return new Response(JSON.stringify({ ok: true, deleted: true, readbackStatus: "verified" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected cleanup fetch: ${method} ${url}`);
  };
  const failedIntake = await new Promise((resolve, reject) => {
    const request = {
      method: "POST",
      headers: {},
      body: {
        assetKey: estateId,
        ownerName: "Estate of Rowan QA Fixture",
        runMode: "live_idi_core",
        mode: "live_idi_core",
        paidRun: true,
        liveRunApproved: true,
        attachment: {
          id: upload.body.attachment.id,
          artifactId: upload.body.attachment.id,
          fileName: "idi-report.csv",
        },
      },
      on() {},
      destroy() {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
      end(payload = "") {
        try { resolve({ statusCode: this.statusCode, body: JSON.parse(String(payload || "{}")) }); }
        catch (error) { reject(error); }
      },
    };
    Promise.resolve(idiExtractHandler(request, response)).catch(reject);
  });
  assert.equal(failedIntake.statusCode, 503);
  assert.equal(failedIntake.body.error, "idi_import_store_unavailable");
  assert.deepEqual(cleanupRequests.map(({ method }) => method), ["GET", "POST", "DELETE"]);
  const forwardedUpload = cleanupRequests.find(({ method }) => method === "POST")?.body;
  assert.equal(forwardedUpload.mode, "uploaded_file");
  assert.equal(forwardedUpload.provider, "idi");
  for (const forbiddenField of ["runMode", "paidRun", "liveRunApproved"]) {
    assert.equal(forbiddenField in forwardedUpload, false, `${forbiddenField} must not cross the uploaded-intake trust boundary`);
  }

  cleanupRequests.length = 0;
  const shortReplacementReason = await new Promise((resolve, reject) => {
    const request = {
      method: "POST",
      headers: {},
      body: {
        assetKey: estateId,
        adminOverrideReason: "replace",
        attachment: { id: upload.body.attachment.id, artifactId: upload.body.attachment.id },
      },
      on() {},
      destroy() {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[String(key).toLowerCase()] = value; },
      end(payload = "") {
        try { resolve({ statusCode: this.statusCode, body: JSON.parse(String(payload || "{}")) }); }
        catch (error) { reject(error); }
      },
    };
    Promise.resolve(idiExtractHandler(request, response)).catch(reject);
  });
  assert.equal(shortReplacementReason.statusCode, 422);
  assert.equal(shortReplacementReason.body.error, "idi_replacement_reason_required");
  assert.deepEqual(cleanupRequests.map(({ method }) => method), ["DELETE"]);
} finally {
  globalThis.fetch = originalFetch;
  if (originalAuthRequired === undefined) delete process.env.AUTH_REQUIRED;
  else process.env.AUTH_REQUIRED = originalAuthRequired;
  if (originalWorkerUrl === undefined) delete process.env.HEIRRIGHT_WORKER_URL;
  else process.env.HEIRRIGHT_WORKER_URL = originalWorkerUrl;
  if (originalApiToken === undefined) delete process.env.HEIRRIGHT_API_TOKEN;
  else process.env.HEIRRIGHT_API_TOKEN = originalApiToken;
  delete env.IDI_CORE_API_URL;
  delete env.IDI_CORE_API_TOKEN;
  delete env.IDI_CORE_LIVE_RUN_APPROVED;
  env.WORKSPACE_STATE = workspaceNamespace;
}

const paidCanonicalSourceRun = await workerRequest("/api/discovery/external-source-run", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    operatorIntent: "run_external_source_search",
    assetKey: paidBody.assetKey,
    seed: {
      estateName: paidBody.estateName,
      ownerName: paidBody.ownerName,
      propertyAddress: paidBody.propertyAddress,
      county: paidBody.county,
    },
    capture: {},
    includeSkipTrace: false,
  }),
});
assert.equal(paidCanonicalSourceRun.response.status, 200);
const paidCanonicalFacts = paidCanonicalSourceRun.body.sourceFacts.filter((fact) => fact.source === "idi");
const paidCanonicalStatus = paidCanonicalFacts.find((fact) => fact.factType === "idi_asset_search_status");
assert.equal(paidCanonicalStatus.value.paidRun, true);
assert.equal(paidCanonicalStatus.value.paidRunApproved, true);
assert.equal(paidCanonicalStatus.value.approvalRecord.readbackStatus, "verified");
assert.ok(paidCanonicalFacts.some((fact) => fact.factType === "idi_asset_report_attachment"));

const deletedUpload = await workerRequest(`/api/documents/attachments?attachmentId=${encodeURIComponent(upload.body.attachment.id)}`, {
  method: "DELETE",
});
assert.equal(deletedUpload.response.status, 200);
assert.equal(deletedUpload.body.readbackStatus, "verified");
assert.equal(env.PACKET_ARTIFACTS.options.get(supportingDocumentIndexStorageKey)?.expirationTtl, 30 * 24 * 60 * 60);

for (const retentionCase of [
  { configured: "60", expected: 24 * 60 * 60, label: "minimum" },
  { configured: "999999999", expected: 365 * 24 * 60 * 60, label: "maximum" },
]) {
  env.HEIRRIGHT_DOCUMENT_TTL_SECONDS = retentionCase.configured;
  const retainedUpload = await workerRequest("/api/documents/attachments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      estateId: `estate:s38-retention-${retentionCase.label}`,
      documentId: "idi-asset-search",
      fileName: `idi-retention-${retentionCase.label}.csv`,
      contentType: "text/csv",
      dataBase64: Buffer.from(`${csv}\nRetention ${retentionCase.label},Review`).toString("base64"),
    }),
  });
  assert.equal(retainedUpload.response.status, 200);
  assert.equal(
    env.PACKET_ARTIFACTS.options.get(`supporting-document:${retainedUpload.body.attachment.id}`)?.expirationTtl,
    retentionCase.expected
  );
}
delete env.HEIRRIGHT_DOCUMENT_TTL_SECONDS;

const googleBlocker = await workerRequest("/api/google-workspace/export", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({ email: "operator@heirright.com", artifactId: "packet-1234567890123-abcdef1234567890" }),
});
assert.equal(googleBlocker.response.status, 403);
assert.equal(googleBlocker.body.error, "packet_approval_actor_mismatch");

const googleRefreshConfig = await workerRequest("/api/google-workspace/connection", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer test-internal-token" },
  body: JSON.stringify({ email: "operator@heirright.com", accessToken: "test-access-token", refreshToken: "test-refresh-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
});
assert.equal(googleRefreshConfig.response.status, 503);
assert.equal(googleRefreshConfig.body.error, "google_workspace_refresh_not_configured");

console.log(JSON.stringify({ ok: true, checks: [
  "csv_supporting_document_signature_and_readback",
  "same_byte_same_millisecond_uploads_keep_unique_estate_artifacts",
  "same_owner_address_estates_keep_exact_separate_import_records",
  "display_metadata_changes_do_not_change_exact_estate_lookup",
  "address_fingerprint_cannot_resolve_estate_storage",
  "wrong_report_subject_rejected_before_commit_without_raw_text",
  "cross_estate_identity_mismatch_rejected",
  "source_capture_requires_canonical_discovery_file_readback",
  "source_capture_reloads_without_client_idi_proof_or_forged_actor",
  "supporting_document_readback_failures_rollback_unindexed_pii",
  "supporting_document_index_failures_rollback_object_and_partial_index",
  "uploaded_extraction_rejects_browser_supplied_import",
  "source_located_high_confidence_candidate_persisted",
  "raw_extracted_text_not_returned",
  "duplicate_upload_is_idempotent",
  "concurrent_different_imports_have_one_atomic_canonical_winner",
  "pending_manual_import_never_reloads_or_emits_as_discovery_evidence",
  "replacement_crash_preserves_previous_canonical_until_idempotent_recovery",
  "transient_guard_status_failure_blocks_recovery_and_vendor_spend",
  "staging_cleanup_failure_requires_verified_retry",
  "persisted_import_can_be_reloaded",
  "forged_client_idi_proof_cannot_satisfy_discovery",
  "canonical_stored_idi_import_supplies_discovery_facts",
  "contact_reviews_persist_with_ttl_and_reload_into_canonical_facts",
  "contact_reviews_do_not_cross_idi_report_replacements",
  "forged_contact_reviewer_identity_is_ignored",
  "discovery_files_receive_bounded_document_retention",
  "client_live_approval_cannot_authorize_vendor_spend",
  "company_owner_and_recent_sale_stop_before_paid_vendor_without_override",
  "vercel_and_local_paid_routes_require_shared_admin_gate",
  "paid_run_requires_internal_admin_route_and_durable_lock",
  "concurrent_paid_run_reservations_are_atomic",
  "stale_paid_run_reservation_requires_admin_review_before_retry",
  "paid_run_duplicate_guard_requires_descriptive_override",
  "paid_lock_identity_ignores_owner_and_provider_variations",
  "ambiguous_vendor_2xx_results_stay_review_required",
  "paid_success_requires_canonical_idi_storage_readback",
  "paid_result_stays_unapproved_until_lock_completion_readback",
  "stale_paid_phase_readback_cannot_return_verified_success",
  "paid_success_reloads_as_canonical_discovery_evidence",
  "paid_run_lock_completion_passes_durable_readback",
  "supporting_documents_indexes_and_idi_imports_expire_after_30_days",
  "document_retention_is_bounded_to_1_through_365_days",
  "failed_idi_intake_removes_uncommitted_upload",
  "browser_upload_cleanup_requires_delete_readback",
  "replacement_upload_requires_descriptive_admin_reason",
  "production_import_wrapper_preserves_canonical_get_hydration",
  "contact_review_ui_applies_only_verified_server_decisions",
  "pending_paid_import_cannot_complete_idi_phase",
  "uploaded_intake_strips_paid_run_smuggling_fields",
  "idi_browser_storage_boundary_redacts_raw_report_and_contacts",
  "legacy_local_session_cookie_window_name_values_are_purged",
  "generic_workspace_hydration_is_sanitized_and_migrated",
  "personal_idi_credentials_are_memory_only",
  "google_delivery_fails_closed_without_connection",
  "google_connection_requires_refresh_credentials",
] }, null, 2));
