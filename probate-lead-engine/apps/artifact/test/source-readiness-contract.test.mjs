import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const { buildConnectionStatuses, buildIdiCoreStatus } = require("../api/connections/status.js");

function byName(statuses, name) {
  const row = statuses.find((status) => status.name === name);
  assert.ok(row, `${name} status row missing`);
  return row;
}

function assertNoRawEnvCopy(row) {
  const rawEnvPattern = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/;
  const technicalConsolePattern = /\b(JSON|payload|adapter|dry-run|TypeScript|CLI)\b/i;
  const visibleStrings = [
    row.message,
    ...(Array.isArray(row.blockers) ? row.blockers : []),
  ].filter(Boolean);
  for (const text of visibleStrings) {
    assert.doesNotMatch(String(text), rawEnvPattern, `${row.name} visible readiness copy must not expose raw env keys`);
    assert.doesNotMatch(String(text), technicalConsolePattern, `${row.name} visible readiness copy must stay operator-facing`);
  }
}

const missing = buildConnectionStatuses({}, { freshBatchExists: false, latestRunExists: false });

const missingTax = byName(missing, "Tax Collector Source");
assert.equal(missingTax.ok, false);
assert.equal(missingTax.mode, "blocked");
assert.equal(missingTax.configuredMode, "none");
assert.equal(missingTax.sourceAutomation.scriptDirectListingConfigured, false);
assert.equal(missingTax.sourceAutomation.browserWorkflowConfigured, false);
assert.match(missingTax.message, /public GovHub search needs Browserbase or controlled Chrome workflow/i);

const missingClerk = byName(missing, "Miami-Dade Clerk API");
assert.equal(missingClerk.ok, false);
assert.equal(missingClerk.mode, "blocked");
assert.equal(missingClerk.configuredMode, "none");
assert.match(missingClerk.message, /Commercial Data Services AuthKey and pre-paid units/i);
assert.match(missingClerk.blockers.join(" "), /Commercial Data Services access/i);

const missingVital = byName(missing, "Vital/Obituary Workflow");
assert.equal(missingVital.ok, false);
assert.equal(missingVital.mode, "blocked");
assert.equal(missingVital.configuredMode, "none");
assert.match(missingVital.message, /Findagrave\/Legacy/i);
assert.match(missingVital.blockers.join(" "), /vital\/obituary browser workflow/i);

const missingIdi = byName(missing, "IDI Core");
assert.equal(missingIdi.ok, false);
assert.equal(missingIdi.mode, "blocked");
assert.equal(missingIdi.configuredMode, "none");
assert.equal(missingIdi.api.endpointConfigured, false);
assert.equal(missingIdi.api.sharedDefaultConfigured, false);
assert.equal(missingIdi.api.userOverrideAllowed, true);

for (const row of [missingTax, missingClerk, missingVital, missingIdi]) {
  assertNoRawEnvCopy(row);
}

const configured = buildConnectionStatuses({
  TAX_COLLECTOR_LISTING_URL_TEMPLATE: "https://tax.example.test/accounts/{parcelId}",
  TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED: "true",
  BROWSERBASE_API_KEY: "browserbase-test-key",
  TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID: "tax-function",
  MIAMI_DADE_CLERK_AUTH_KEY: "clerk-test-key",
  OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID: "vital-function",
  IDI_CORE_API_URL: "https://idi.example.test/search",
  IDI_CORE_API_KEY: "shared-default-key",
  IDI_CORE_LIVE_RUN_APPROVED: "true",
}, { freshBatchExists: true });

const configuredTax = byName(configured, "Tax Collector Source");
assert.equal(configuredTax.ok, true);
assert.equal(configuredTax.mode, "review");
assert.equal(configuredTax.configuredMode, "script_listing");
assert.equal(configuredTax.sourceAutomation.scriptDirectListingConfigured, true);
assert.equal(configuredTax.sourceAutomation.scriptLiveProbeEnabled, true);
assert.equal(configuredTax.sourceAutomation.browserbaseFunctionConfigured, true);
assert.equal(configuredTax.sourceAutomation.browserWorkflowConfigured, true);
assert.match(configuredTax.message, /listing-page script capture/i);

const configuredClerk = byName(configured, "Miami-Dade Clerk API");
assert.equal(configuredClerk.ok, true);
assert.equal(configuredClerk.mode, "review");
assert.equal(configuredClerk.configuredMode, "commercial_api");
assert.match(configuredClerk.message, /Official Records and Civil\/Family\/Probate API calls can run/i);

const configuredVital = byName(configured, "Vital/Obituary Workflow");
assert.equal(configuredVital.ok, true);
assert.equal(configuredVital.mode, "review");
assert.equal(configuredVital.configuredMode, "browser_workflow");
assert.equal(configuredVital.sourceAutomation.browserbaseFunctionConfigured, true);
assert.deepEqual(configuredVital.sourceAutomation.supports, [
  "obituary",
  "marriageLicense",
  "dateOfBirth",
  "dateOfDeath",
  "deathCertificateStatus",
  "incarcerationStatus",
]);

const configuredIdi = byName(configured, "IDI Core");
assert.equal(configuredIdi.ok, true);
assert.equal(configuredIdi.mode, "live");
assert.equal(configuredIdi.configuredMode, "api");
assert.equal(configuredIdi.api.accessConfigured, true);
assert.equal(configuredIdi.api.sharedDefaultConfigured, true);
assert.equal(configuredIdi.api.liveRunApproved, true);
assert.equal(configuredIdi.api.userOverrideAllowed, true);

const userOverrideEndpointOnly = buildIdiCoreStatus({
  IDI_CORE_API_URL: "https://idi.example.test/search",
}, "2026-07-03T00:00:00.000Z");
assert.equal(userOverrideEndpointOnly.ok, false);
assert.equal(userOverrideEndpointOnly.configuredMode, "none");
assert.equal(userOverrideEndpointOnly.api.endpointConfigured, true);
assert.equal(userOverrideEndpointOnly.api.sharedDefaultConfigured, false);
assert.equal(userOverrideEndpointOnly.api.userOverrideAllowed, true);

for (const row of [configuredTax, configuredClerk, configuredVital, configuredIdi, userOverrideEndpointOnly]) {
  assertNoRawEnvCopy(row);
}

const bundle = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
assert.ok(bundle.includes('integrationOnboardingCardHtml("tax")'), "Settings must expose a Tax Collector source card.");
assert.ok(bundle.includes('integrationOnboardingCardHtml("clerk")'), "Settings must expose a Clerk Records source card.");
assert.ok(bundle.includes('integrationOnboardingCardHtml("vital")'), "Settings must expose a Vital Sources card.");
assert.ok(bundle.includes('"Miami-Dade Clerk API", "Vital/Obituary Workflow"'), "Settings status rows must include Clerk and Vital/Obituary readiness.");
assert.ok(bundle.includes('"Web Search", "Tax Collector Source", "Miami-Dade Clerk API", "Vital/Obituary Workflow", "IDI Core"'), "Admin blockers must include every source-readiness integration.");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "source_readiness_distinguishes_api_browser_and_blocked_modes",
    "tax_collector_readiness_keeps_listing_and_browserbase_paths_separate",
    "clerk_readiness_requires_commercial_api_access",
    "vital_obituary_readiness_requires_browser_workflow",
    "idi_core_shared_default_and_user_override_contract",
    "operator_visible_readiness_copy_has_no_raw_env_keys",
    "settings_exposes_source_readiness_controls",
  ],
}, null, 2));
