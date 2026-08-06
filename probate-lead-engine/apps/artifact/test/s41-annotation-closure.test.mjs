import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const read = (relativePath) => fs.readFileSync(path.join(artifactRoot, relativePath), "utf8");

const html = read("src/index.html");
const iconFacade = read("src/ui/icon-facade.js");
const shellView = read("src/features/shell/shell-view.js");
const shellCss = read("src/features/shell/shell.css");
const docPrepView = read("src/features/doc-prep/s40-doc-prep-view.js");
const docPrepCss = read("src/features/doc-prep/s40-doc-prep.css");
const docPrepRails = read("src/features/beui-runtime/doc-prep-rails.tsx");
const estatesGrid = read("src/features/data-grid/estates-grid.js");
const gridsCss = read("src/features/data-grid/grids.css");
const compatCss = read("src/styles/compat.css");
const legacyCss = read("src/styles/legacy.css");
const legacy = read("src/legacy/app.js");

// A-01/A-02: later B-10 removes the local Doc Prep header block; the global
// shell title remains the authoritative page title.
assert.doesNotMatch(docPrepView, /s40-docprep-head/);
assert.match(docPrepCss, /\.s40-docprep\s*\{[\s\S]*grid-template-rows:\s*auto auto/);

// B-02: a queued estate is idle until the durable run is started.
assert.match(docPrepView, /workflowState\(row\) === "queued"[\s\S]*label: "Queued for Doc Prep"[\s\S]*detail: "Waiting to start"/);

// B-03 through B-07: generated artifact tables have square header corners;
// operational BeUI tables remain separate.
assert.match(docPrepCss, /\.s40-discovery-offer > thead > tr > th,[\s\S]*\.s40-discovery-heirs-table > thead > tr > th\s*\{[\s\S]*border-radius:\s*0 !important/);

// B-08: the BeUI queue table owns resizable columns and source defaults reset
// on remount because no browser or backend persistence was added.
assert.match(docPrepRails, /<Table[\s\S]*resizable[\s\S]*minColumnWidth=\{160\}/);
assert.match(docPrepRails, /key:\s*"title", header:\s*"Estate", width:\s*"48%"/);

// A-03: the shared facade owns the approved right-panel mark and the action remains labelled.
assert.match(iconFacade, /drawer:\s*"panel-right"/);
assert.match(shellView, /id="s38OpenRail"[\s\S]*aria-label="Open case drawer"[\s\S]*iconMarkup\("drawer"/);
assert.match(shellView, /<wa-tooltip for="s38OpenRail" placement="bottom">Open case drawer<\/wa-tooltip>/);

// A-04/A-05/A-06: footer alignment and centered account geometry are shell-owned.
assert.match(shellCss, /@media \(min-width: 820px\)[\s\S]*\.connection-statuses\s*\{[^}]*margin-block-end:\s*0/);
assert.match(shellCss, /\.sidebar-footer\s*\{[\s\S]*place-items:\s*center[\s\S]*justify-items:\s*center/);
assert.match(shellCss, /\.user-strip,[\s\S]*width:\s*2\.75rem[\s\S]*height:\s*2\.75rem[\s\S]*justify-self:\s*center[\s\S]*align-self:\s*center/);
assert.match(shellCss, /\.sidebar-footer\s*\{[\s\S]*width:\s*var\(--s38-left-rail-width\)[\s\S]*min-width:\s*0[\s\S]*max-width:\s*var\(--s38-left-rail-width\)[\s\S]*justify-self:\s*start/);
assert.match(shellCss, /\.user-strip \.avatar,[\s\S]*width:\s*1\.875rem[\s\S]*height:\s*1\.875rem[\s\S]*flex:\s*0 0 1\.875rem[\s\S]*overflow:\s*visible/);

// A-07: the queue search fills the available selector column without a fixed global width.
assert.match(docPrepCss, /\.s40-selector > header \.s40-quick-search\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%/);
assert.match(docPrepCss, /\.s40-selector > header \.s40-quick-search input\s*\{[\s\S]*width:\s*100%[\s\S]*min-width:\s*0[\s\S]*max-width:\s*100%/);
assert.match(docPrepCss, /\.s40-selector > header > div,[\s\S]*flex:\s*1 1 auto[\s\S]*width:\s*100%[\s\S]*min-width:\s*0/);
assert.match(docPrepCss, /\.s40-selector > header > div\s*\{[\s\S]*margin-inline-end:\s*clamp\(var\(--hr-space-3\), 0\.83vw, var\(--hr-space-4\)\)/);

const settingsView = legacy.slice(legacy.indexOf("function renderSettingsView"));
const settingsGutter = settingsView.slice(settingsView.indexOf('<aside class="settings-gutter"'), settingsView.indexOf("</aside>", settingsView.indexOf('<aside class="settings-gutter"')));
const integrationPanel = legacy.slice(legacy.indexOf("function renderIntegrationSettingsPanel"), legacy.indexOf("function renderSupportSettingsPanel"));

// A-08/A-09/A-10: remove only the targeted Settings labels and heading, then reflow the shell.
assert.match(settingsView, /<div class="loop-panel-head">\s*<div><h2 class="loop-title">/);
assert.doesNotMatch(integrationPanel, /settingsSectionShell\("Integration status"/);
assert.match(integrationPanel, /settingsSectionShell\("", "", "Reconnect \/ Review setup"/);
assert.doesNotMatch(integrationPanel, /<p class="eyebrow">Workspace<\/p>|<h3>Integration status<\/h3>/);

// A-11: refresh controls are bare, focusable actions in a centered shared card header row.
assert.match(gridsCss, /\.integration-card-head\s*\{[\s\S]*align-items:\s*center/);
assert.match(gridsCss, /\.integration-card-head > div:first-child\s*\{[\s\S]*min-width:\s*0[\s\S]*flex:\s*1 1 auto/);
assert.match(gridsCss, /\.integration-refresh\s*\{[\s\S]*background:\s*transparent[\s\S]*border:\s*0/);
assert.match(legacyCss, /\.integration-refresh:focus-visible\s*\{[^}]*outline:/);

// A-12/A-13: the select keeps its programmatic name while the gutter title owns the hierarchy.
assert.doesNotMatch(settingsView, /settings-select-label|>Section</);
assert.match(settingsView, /<select id="settingsSectionSelect" data-settings-tab-select aria-label="Settings section">/);
assert.match(settingsView, /class="settings-panel-section-control"[\s\S]*settingsSectionSelect/);
assert.match(gridsCss, /\.settings-gutter > \.eyebrow\s*\{[\s\S]*font-size:\s*1\.5rem[\s\S]*line-height:\s*1\.1/);
assert.match(gridsCss, /@media \(max-width: 900px\)[\s\S]*\.settings-gutter > \.eyebrow\s*\{[\s\S]*font-size:\s*1\.25rem/);
assert.match(gridsCss, /\.settings-panel-section-control\s*\{[\s\S]*flex:\s*0 0 min\(13rem, 42%\)/);
assert.doesNotMatch(settingsGutter, /settingsSectionSelect/);

// A-14/A-15: the Estates toolbar owns the two measured inline paddings.
assert.match(compatCss, /\.hr-estates-grid-view \.hr-grid-controls > \.hr-grid-import-action\s*\{[\s\S]*padding-inline:\s*0\.5375rem/);
assert.match(compatCss, /\.hr-estates-grid-view \.hr-grid-controls > \.hr-grid-filter-toggle\s*\{[\s\S]*padding-inline:\s*0\.675rem/);

// B-11: Estates keeps import/filter actions and removes only its local search.
const estatesHeader = estatesGrid.slice(estatesGrid.indexOf('<header class="hr-grid-header">'), estatesGrid.indexOf("</header>", estatesGrid.indexOf('<header class="hr-grid-header">')));
assert.doesNotMatch(estatesHeader, /hr-grid-search|data-grid-quick-filter/);
assert.match(estatesHeader, /data-estates-import-file[\s\S]*data-estate-filters-toggle/);

// A-16: the shared drawer correction is wide-only and leaves compact placement at zero.
assert.match(shellCss, /--s38-header-rail-offset-y:\s*0;/);
assert.match(shellCss, /@media \(min-width: 1121px\)[\s\S]*--s38-header-rail-offset-y:\s*-0\.4375rem/);
assert.match(shellCss, /#workspace\[data-s38-shell="case-journey"\] #s38OpenRail[\s\S]*margin-block-start:\s*var\(--s38-header-rail-offset-y\)/);

// A-17: the popup is anchored to the search control, uses a positional-only entry,
// and retains search state and outside-click closure in the existing controller.
assert.match(html, /<div class="search-anchor">[\s\S]*id="globalSearch"[\s\S]*aria-controls="searchPopup" aria-expanded="false"[\s\S]*id="searchPopup" class="search-popup" role="dialog"/);
assert.match(legacyCss, /\.search-popup\s*\{[\s\S]*inset-inline-start:\s*50%[\s\S]*top:\s*calc\(100% \+ 8px\)[\s\S]*width:\s*min\(643px[\s\S]*padding:\s*37px 8px[\s\S]*transform:\s*translate\(-50%, -6px\)[\s\S]*transition:\s*transform/);
assert.doesNotMatch(legacyCss.slice(legacyCss.indexOf(".search-popup"), legacyCss.indexOf(".search-popup-title")), /opacity:/);
assert.match(legacyCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.search-popup\s*\{[\s\S]*transition:\s*none/);
assert.match(legacy, /input\.setAttribute\("aria-expanded", shouldOpen \? "true" : "false"\)/);
assert.match(legacy, /if \(!document\.querySelector\("\.search-anchor"\)\?\.contains\(event\.target\)\)/);

// Protected S40 contracts remain source-owned beside the annotation fixes.
assert.match(docPrepView, /rows\.length > 1[\s\S]*workflowBatchId/);
assert.doesNotMatch(docPrepView, /data-community-grid="docprep"|createCommunityGrid/);
assert.doesNotMatch(gridsCss, /ag-grid|data-community-grid|\.ag-root/);
assert.match(docPrepCss, /\.s40-dynamic-island[\s\S]*width:\s*100%[\s\S]*padding:\s*1\.5125rem 1rem/);

console.log("S41 annotation closure contract passed.");
