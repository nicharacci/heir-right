import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readArtifactSource } from "./helpers/artifact-source.mjs";

const bundle = readArtifactSource();
const server = readFileSync(new URL("../server.js", import.meta.url), "utf8");

for (const tab of ["Access", "Integrations", "Sources", "Outreach", "Audit", "Preferences"]) {
  assert.ok(bundle.includes(`label: "${tab}"`), `Settings tab missing: ${tab}`);
}

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
assert.ok(bundle.includes("demoEstateLeadImports"), "The live demo must seed sample estate leads when no saved estate list exists.");
assert.ok(bundle.includes("seedDemoEstatePreviewState"), "Sample estate leads must hydrate the shared table, document prep, and queue state.");
assert.ok(bundle.includes("Sample: "), "Sample estate rows must be visibly labeled instead of looking like real sourced leads.");
assert.ok(bundle.includes("SAMPLE-CRM-001"), "Sample CRM rows must include reviewable source record IDs.");
assert.ok(bundle.includes('document.documentElement.dataset.demoEstateLeads = state.demoEstateLeadsActive ? "true" : "false"'), "The shell must expose whether demo estate leads are active for browser verification.");

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
    "settings_access_integrations_sources_outreach_audit_preferences_tabs",
    "google_only_auth_gate_and_account_menu_contract",
    "idi_core_team_default_and_personal_override_copy",
    "tax_collector_bottom_right_receipt_controls",
    "source_enrichment_readiness_controls",
    "outreach_first_party_review_package_without_activepieces_builder",
    "send_locked_guardrail_visible",
    "sample_estate_leads_seeded_for_table_preview",
  ],
}, null, 2));
