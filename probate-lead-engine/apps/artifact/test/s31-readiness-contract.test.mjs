import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readArtifactSource } from "./helpers/artifact-source.mjs";

const bundle = readArtifactSource();
const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");

for (const tab of ["Access", "Integrations", "Sources", "Outreach", "Preferences"]) {
  assert.ok(bundle.includes(`label: "${tab}"`), `Settings tab missing: ${tab}`);
}

assert.doesNotMatch(
  bundle,
  /\{ id: "audit", label: "Audit" \}|function renderAuditSettingsPanel|Activity and audit log|Recent workspace activity|Template controls|settings-(?:readiness-band|readiness-tile|audit-grid|audit-card)/,
  "Settings must not restore the retired audit readiness destination or its dead presentation styles.",
);

for (const copy of [
  "Team access",
  "Allowed business domains",
  "Google only",
  "Continue with Google",
  "Switch account",
  "Log out",
]) {
  assert.ok(bundle.includes(copy), `Auth/account readiness copy missing: ${copy}`);
}

assert.ok(bundle.includes("auth-gate"), "Auth gate overlay markup/styles must remain present.");
assert.ok(bundle.includes('body[data-auth-gated="true"] .workspace'), "Auth gate must blur the app shell.");
assert.ok(bundle.includes("data-settings-account-menu"), "Settings must expose the account menu control.");
assert.ok(server.includes('prompt: connectWorkspace ? "select_account consent" : "select_account"'), "Google login must force account selection, including Workspace consent.");
assert.ok(bundle.includes("positionTableFiltersPopover"), "Estate list filters must calculate viewport-safe popover placement.");
assert.ok(bundle.includes("--table-filters-popover-max-height"), "Estate list filters must cap height from the visible viewport.");
assert.ok(bundle.includes("overscroll-behavior: contain"), "Estate list filters must scroll internally instead of bleeding past the viewport.");
assert.ok(bundle.includes("@media (min-width: 821px) and (max-height: 720px)"), "Desktop shell must have a short-height scroll fallback.");
assert.ok(bundle.includes("min-height: 720px"), "Desktop shell must preserve a minimum usable height when the viewport is compressed.");
assert.ok(bundle.includes(".workspace.is-collapsed .user-strip"), "Collapsed sidebar account chip rules must remain present.");
assert.ok(bundle.includes("width: 44px;\n      height: 44px;\n      min-height: 44px;"), "Collapsed account chip must align to the same 44px rail geometry as nav items.");
assert.ok(bundle.includes(".workspace.is-collapsed .user-strip .avatar"), "Collapsed account emblem must have explicit centered avatar geometry.");
assert.ok(bundle.includes("width: 42px;\n      height: 42px;\n      border-radius: inherit;"), "Collapsed account emblem must match the 42px nav icon well.");
assert.doesNotMatch(bundle, /demoEstateLeadImports|seedDemoEstatePreviewState|SAMPLE-CRM-001/, "The production shell must not seed or expose synthetic estate records.");
assert.ok(bundle.includes("csvFileImportItems"), "The app must parse selected CSV files before the operator commits an import.");
assert.ok(bundle.includes("crmBatchImportLimit = 250"), "The app batch limit must accept the supplied 51-row client file without silently truncating it.");
assert.ok(bundle.includes("First Name, Last Name, and Address columns"), "The app must explain the required client CSV mapping.");
assert.ok(bundle.includes("legacyPlaceholderEstateImportsOlderThan"), "The app must identify old placeholder estates through a bounded lifecycle path.");
assert.ok(bundle.includes("Remove ${count} placeholder estate"), "The app must show the exact old-placeholder cleanup count before deletion.");

for (const copy of [
  "IDI Core API access",
  "shared team key",
  "personal key",
  "Tax Collector Source receipt capture",
  "bottom-right receipt link",
  "direct listing/template paths",
  "Browserbase/controlled Chrome workflow",
  "Miami-Dade Clerk API",
  "Vital/Obituary Workflow",
]) {
  assert.ok(bundle.includes(copy), `Settings/source control copy missing: ${copy}`);
}

for (const copy of [
  "Outreach production controls",
  "No native builder",
  "outreachPipelineHtml",
  "Sync package",
  "Send locked",
  "data-template-send-blocked",
  "Direct send is locked",
  "No direct SMS or email send",
]) {
  assert.ok(bundle.includes(copy), `Outreach safety copy/control missing: ${copy}`);
}

assert.doesNotMatch(bundle, /Embed Builder|activepieces\.com\/docs|cdn\.activepieces\.com\/sdk|<iframe[^>]+activepieces/i, "The shipped app must not expose ActivePieces native builder embedding.");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "settings_access_integrations_sources_outreach_preferences_tabs_without_audit",
    "google_only_auth_gate_and_account_menu_contract",
    "idi_core_team_default_and_personal_override_copy",
    "tax_collector_bottom_right_receipt_controls",
    "source_enrichment_readiness_controls",
    "outreach_first_party_review_package_without_activepieces_builder",
    "send_locked_guardrail_visible",
    "app_native_csv_import_and_bounded_placeholder_cleanup",
  ],
}, null, 2));
