import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bundle = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
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
assert.ok(server.includes('prompt: "select_account"'), "Google login must force account selection.");
assert.ok(bundle.includes("positionTableFiltersPopover"), "Estate list filters must calculate viewport-safe popover placement.");
assert.ok(bundle.includes("--table-filters-popover-max-height"), "Estate list filters must cap height from the visible viewport.");
assert.ok(bundle.includes("overscroll-behavior: contain"), "Estate list filters must scroll internally instead of bleeding past the viewport.");

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
  ],
}, null, 2));
