import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { build as esbuildBuild } from "esbuild";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const featureRoot = path.join(artifactRoot, "src", "features");

function read(relativePath) {
  return fs.readFileSync(path.join(artifactRoot, relativePath), "utf8");
}

function readTree(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return readTree(target);
      return /\.(?:css|js)$/.test(entry.name) ? fs.readFileSync(target, "utf8") : "";
    })
    .join("\n");
}

async function importCaseJourneyRuntime() {
  const result = await esbuildBuild({
    stdin: {
      contents: `
        export { DISPOSITIONS, LIFECYCLE_STAGES, buildJourneyTimeline, buildLifecycle, companyOwnerStop, hasHandoffEvidence, reviewedEvidenceGroups, resolveDisposition } from "./src/features/case-journey/case-journey.js";
        export { caseJourneyRailDefinition } from "./src/features/case-journey/case-journey-rail.js";
        export { attentionRows, renderDashboardView } from "./src/features/dashboard/dashboard-view.js";
        export { installLegacyBridge, uninstallLegacyBridge } from "./src/core/feature-registry.js";
        export { verifiedArtifactHref } from "./src/core/verified-artifact-link.js";
      `,
      resolveDir: artifactRoot,
      sourcefile: "s38-shell-contract-entry.js",
      loader: "js",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
    logLevel: "silent",
  });
  const encoded = Buffer.from(result.outputFiles[0].text).toString("base64");
  return import(`data:text/javascript;base64,${encoded}#${Date.now()}`);
}

function selectedEstate(overrides = {}) {
  return {
    id: "estate-001",
    title: "Hernandez Estate",
    address: "20611 NW 33rd Pl, Miami Gardens, FL",
    owner: "Maria Hernandez",
    source: "Miami-Dade public records",
    classification: "Probate review",
    nextAction: "Confirm the probate case",
    evidence: 4,
    evidenceTotal: 8,
    score: 82,
    ...overrides,
  };
}

function baseState(overrides = {}) {
  return {
    activeView: "dashboard",
    selectedEstateId: "estate-001",
    selectedEstate: selectedEstate(),
    estates: [selectedEstate({ selected: true })],
    dealStatus: { id: "cold", label: "Review" },
    queueIds: [],
    activity: [],
    docPrep: {
      progress: 0,
      complete: false,
      packetVerified: false,
      packetApproved: false,
      currentPhase: { label: "Property review" },
      automation: { status: "idle", sections: [] },
      documents: [],
    },
    ...overrides,
  };
}

function assertStaticContracts() {
  const register = read("src/features/shell/register.js");
  const controller = read("src/features/shell/shell-controller.js");
  const commandDrawer = read("src/features/shell/command-drawer.js");
  const shellView = read("src/features/shell/shell-view.js");
  const railHost = read("src/features/shell/unified-rail-host.js");
  const themeControl = read("src/features/shell/theme-control.js");
  const shellCss = read("src/features/shell/shell.css");
  const gridsCss = read("src/features/data-grid/grids.css");
  const tokensCss = read("src/styles/tokens.css");
  const legacyCss = read("src/styles/legacy.css");
  const indexHtml = read("src/index.html");
  const dashboardSource = read("src/features/dashboard/dashboard-view.js");
  const dashboardCss = read("src/features/dashboard/dashboard.css");
  const journeySource = read("src/features/case-journey/case-journey.js");
  const journeyRailSource = read("src/features/case-journey/case-journey-rail.js");
  const docPrepSource = readTree(path.join(featureRoot, "doc-prep"));
  const docPrepViewSource = read("src/features/doc-prep/doc-prep-view.js");
  const docPrepRailSource = read("src/features/doc-prep/doc-prep-rail.js");
  const iconFacadeSource = read("src/ui/icon-facade.js");
  const verifiedArtifactLinkSource = read("src/core/verified-artifact-link.js");
  const legacySource = read("src/legacy/app.js");
  const buildSource = read("build.js");
  const serverSource = read("server.js");
  const authSharedSource = read("api/auth/_shared.js");
  const artifactVercel = JSON.parse(read("vercel.json"));
  const rootVercel = JSON.parse(fs.readFileSync(path.resolve(artifactRoot, "../..", "vercel.json"), "utf8"));
  const source = ["shell", "dashboard", "case-journey"]
    .map((directory) => readTree(path.join(featureRoot, directory)))
    .join("\n");

  assert.match(register, /id:\s*"case-journey-cockpit"/);
  assert.match(register, /id:\s*"dashboard"/);
  assert.match(register, /rails:\s*\[caseJourneyRailDefinition\(\)\]/);
  assert.match(register, /bridgeReady:[\s\S]*controller\.mount/);
  assert.match(register, /bridgeLost:[\s\S]*controller\.unmount/);

  assert.match(controller, /SESSION_ROUTE_KEY = "heirright:shell:session-view:v2"/);
  assert.match(controller, /return readSessionView\(\) \|\| "dashboard"/);
  assert.match(controller, /params\.get\("docprep"\) === "estate"/);
  assert.match(controller, /VALID_VIEWS\.has\(explicit\)/);
  assert.match(controller, /function resolveDeepLinkRail[\s\S]*docs: "document"[\s\S]*timeline: "automation"[\s\S]*flow: "automation"/);
  assert.match(controller, /open: params\.get\("rail"\) !== "closed"/);
  assert.match(controller, /runtime\.rails\.activate\(deepLinkRail\.railId/);
  assert.match(controller, /function onCommandSubmit[\s\S]*\\b\(report\|rail\|document\)\\b[\s\S]*event\.stopImmediatePropagation\(\)[\s\S]*openContext\("documents", source\)/);
  assert.match(controller, /createCommandDrawer\([\s\S]*root: shell\.workspace[\s\S]*announce:/);
  assert.match(controller, /function openContext[\s\S]*commandDrawer\?\.close\(\{ restoreFocus: false \}\)[\s\S]*unifiedRail\?\.open/);
  assert.match(controller, /const source = commandDrawer\?\.toggle \|\| event\.submitter/);
  assert.match(controller, /commandDrawer\?\.destroy\(\)/);
  assert.match(controller, /commandForm\?\.addEventListener\("submit", onCommandSubmit, \{ capture: true \}\)/);
  assert.match(controller, /commandForm\?\.removeEventListener\("submit", onCommandSubmit, \{ capture: true \}\)/);
  assert.match(controller, /SETTINGS_RENDERED_EVENT = "heirright:settings-rendered"/);
  assert.match(controller, /function mountThemeControl[\s\S]*s38SettingsThemeMount[\s\S]*replaceChildren\(themeControl\.element\)/);
  assert.match(controller, /document\.addEventListener\(SETTINGS_RENDERED_EVENT, onSettingsRendered\)/);
  assert.match(controller, /document\.removeEventListener\(SETTINGS_RENDERED_EVENT, onSettingsRendered\)/);
  assert.match(shellView, /SIDEBAR_STORAGE_KEY = "heirright:shell:sidebar-collapsed:v1"/);
  assert.match(shellView, /matchMedia\("\(max-width: 819px\)"\)[\s\S]*shellCompactHome = "true"[\s\S]*"Go to Dashboard"/);
  assert.match(shellView, /window\.addEventListener\("resize", onWindowResize\)/);
  assert.match(shellView, /window\.removeEventListener\("resize", onWindowResize\)/);
  assert.match(controller, /sidebarToggle\.dataset\.shellCompactHome === "true"[\s\S]*bridge\.navigate\("dashboard"\)/);
  assert.match(shellView, /querySelector\("\.toggle-panel-icon"\)[\s\S]*panelIcon\.innerHTML = iconMarkup\("actions"/);
  assert.match(shellView, /data-command-drawer-close-icon[\s\S]*iconMarkup\("close"/);
  assert.match(shellView, /iconMarkup\("journey", \{ size: 27 \}\)/, "the Case Journey control must use the larger semantic route icon");
  assert.match(shellView, /id="s38OpenRail"[\s\S]*aria-controls="s38UnifiedRail"[\s\S]*aria-expanded="false"/, "the stable Case Journey trigger must disclose the unified rail it controls");
  assert.doesNotMatch(shellView, /id="s38OpenRail"[^>]*aria-haspopup=/, "the desktop header trigger must not statically claim that the nonmodal rail is a dialog");
  assert.doesNotMatch(shellView, /s38ThemeControlMount/, "theme selection belongs in Settings rather than the header");
  assert.doesNotMatch(shellView, /sidebarToggle\.innerHTML\s*=/, "the collapsed rail must preserve the HeirRight brand slot");
  assert.match(shellView, /return true;\n}/, "the icon rail must start collapsed when no preference exists");
  assert.match(shellCss, /@media \(min-width: 820px\)[\s\S]*data-shell-sidebar-collapsed="false"[\s\S]*\.nav-label[\s\S]*display:\s*block[\s\S]*opacity:\s*1/, "explicit expansion must override the legacy auto-collapse class");
  assert.match(shellView, /element\.inert = true/);
  assert.match(shellView, /\["researchRail", "historyRail", "agentDrawer"\]/);
  assert.match(shellView, /state\.activeView === "find-estates"[\s\S]*label: "Import Estate"[\s\S]*action: "import-estate"/);
  assert.match(shellView, /primaryAction\.action === "import-estate" \? "estates" : "discovery"/);
  assert.match(shellView, /this\.primaryCommand\.setAttribute\("title", primaryAction\.label\)/);
  assert.match(controller, /data-shell-action="import-estate"[\s\S]*document\.getElementById\("crmImportSingle"\)[\s\S]*importButton\.click\(\)/);
  assert.match(controller, /await bridge\.navigate\(view\)[\s\S]*viewButton\.dataset\.dashboardContext[\s\S]*openContext\(viewButton\.dataset\.dashboardContext, viewButton\)/, "a Dashboard approval CTA must deep-link to the explicit rail action after opening Document Prep");
  assert.match(dashboardCss, /\.case-lifecycle-stage:not\(:last-child\)::after \{\s*content:\s*none;/, "the lifecycle must not draw a connector plate around the steps");
  assert.match(dashboardCss, /\.case-stage-index \{[\s\S]*background:\s*transparent;[\s\S]*border:\s*0;[\s\S]*border-radius:\s*0;/, "lifecycle steps must render as bare status marks without circular button plates");
  assert.doesNotMatch(dashboardCss, /\.case-stage-index \{[\s\S]*border-radius:\s*999px/, "the retired circular lifecycle treatment must not return");
  assert.match(shellCss, /button:not\(:where\([^)]*\[data-case-stage\]/, "lifecycle step buttons must be excluded from the shared graphite action plate");
  assert.match(railHost, /querySelectorAll\([\s\S]*wa-button:not\(\[disabled\]\):not\(\[loading\]\)[\s\S]*wa-icon-button:not\(\[disabled\]\):not\(\[loading\]\)/, "the mobile rail focus trap must include enabled Web Awesome action hosts");
  assert.match(docPrepViewSource, /function buttonStartIcon[\s\S]*slot="start" class="hr-button-start-icon"/, "Web Awesome action icons must use the dedicated start slot so they share a row with the label");
  assert.doesNotMatch(docPrepViewSource, /<p class="hr-eyebrow">(?:Document Prep|Estate file|\$\{moveOn \? "Disposition")/, "the three redundant main Document Prep eyebrow headers must remain removed");
  assert.doesNotMatch(docPrepSource, /@keyframes hr-(?:docprep|inline)-enter\s*\{[\s\S]*?from\s*\{[^}]*opacity\s*:\s*0/, "Document Prep entrance motion must never gate load-bearing content behind opacity zero");
  assert.doesNotMatch(shellCss, /@keyframes shell-rail-feedback-enter\s*\{[\s\S]*?from\s*\{[^}]*opacity\s*:\s*0/, "rail feedback must remain visible if its entrance motion never runs");
  for (const entranceName of ["accountMenuIn", "tPageSlideEstatesIn", "loopViewIn", "loopSubtabIn", "discoveryTakeover", "outreachToastIn", "walkthroughIn", "railFade", "resultsPageRowIn"]) {
    assert.doesNotMatch(legacyCss, new RegExp(`@keyframes\\s+${entranceName}\\s*\\{\\s*from\\s*\\{[^}]*opacity\\s*:\\s*0`), `${entranceName} must not opacity-gate routed or interactive content`);
  }
  assert.doesNotMatch(legacyCss, /\.(?:outreach-toast|walkthrough-popover)\s*\{[^}]*opacity\s*:\s*0/, "transient operator surfaces must render visibly before their motion completes");
  assert.doesNotMatch(dashboardSource, /dashboard-kicker/, "Dashboard sections must use direct headings instead of repeated kicker-over-heading templates");

  assert.match(indexHtml, /id="commandDrawerToggle"[\s\S]*aria-controls="commandDrawerPanel"[\s\S]*aria-expanded="false"/);
  assert.match(indexHtml, /id="commandDrawerPanel"[\s\S]*role="region"[\s\S]*aria-hidden="true" inert/);
  assert.match(indexHtml, /id="commandInput"[\s\S]*aria-label="Command"/);
  assert.match(indexHtml, /rel="icon" type="image\/png" href="\/assets\/heirright-mark\.png"/);
  assert.equal((indexHtml.match(/<img src="\/assets\/heirright-mark\.png"/g) || []).length, 2, "the collapsed and expanded sidebar must use the real HeirRight mark");
  assert.equal((indexHtml.match(/width="382" height="480"/g) || []).length, 2, "the real cropped mark must declare its intrinsic dimensions");
  assert.doesNotMatch(indexHtml, /id="themeToggle"|data-theme-option=/, "the hidden legacy theme listener surface must not remain beside the Settings singleton");
  assert.doesNotMatch(indexHtml, /shield-placeholder/, "the shell must not retain a fabricated logo placeholder");
  assert.doesNotMatch(indexHtml, /<wa-drawer/i, "the command surface must remain nonmodal");
  assert.doesNotMatch(indexHtml, /class="import-plus"/, "the shared pill treatment must not add a leading import glyph");
  assert.match(indexHtml, /id="filterWidthToggle" class="[^"]*\bicon-only\b[^"]*"/, "the legacy filter rail toggle must identify itself as an icon-only control rather than borrowing the selected-nav plate");
  assert.match(commandDrawer, /panel\.inert = !open/);
  assert.match(commandDrawer, /requestAnimationFrame[\s\S]*input\.focus\(\{ preventScroll: true \}\)/);
  const drawerSync = commandDrawer.slice(commandDrawer.indexOf("function syncState"), commandDrawer.indexOf("function openDrawer"));
  assert.ok(drawerSync.indexOf("toggle.inert = open") < drawerSync.indexOf("toggle.focus"), "drawer close must make its launcher focusable before restoring focus");
  assert.ok(drawerSync.indexOf("toggle.focus") < drawerSync.indexOf("panel.inert = !open"), "drawer close must restore focus before making the panel inert");
  assert.match(commandDrawer, /event\.key !== "Escape"[\s\S]*event\.stopImmediatePropagation\(\)[\s\S]*closeDrawer\(\)/);
  assert.match(commandDrawer, /document\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(commandDrawer, /document\.removeEventListener\("keydown", onKeyDown, true\)/);
  assert.match(shellCss, /--s38-command-drawer-width:\s*30rem/);
  assert.match(shellCss, /\.app \{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/, "the overlay row must not create an implicit narrow grid column");
  assert.match(shellCss, /grid-template-rows:\s*auto minmax\(0, 1fr\) var\(--s38-command-row-height\) var\(--s38-footer-height\)/);
  assert.match(shellCss, /\.content \{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*2 \/ 4[\s\S]*padding:\s*0 var\(--hr-space-2\) var\(--hr-space-2\) var\(--s38-main-gutter\)/);
  assert.match(shellCss, /\.shell-composer \{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*3[\s\S]*background:\s*transparent[\s\S]*border:\s*0/);
  assert.match(shellCss, /\.workbench \{[\s\S]*scrollbar-width:\s*none[\s\S]*-ms-overflow-style:\s*none[\s\S]*\.workbench::\-webkit-scrollbar \{[\s\S]*display:\s*none/, "mobile workbench scrolling must stay operable without a visible scrollbar");
  assert.match(shellCss, /command-drawer-toggle[\s\S]*width:\s*max-content[\s\S]*opacity:\s*0[\s\S]*pointer-events:\s*none/);
  assert.match(shellCss, /shell-composer:is\(:hover, :focus-within\) \.command-drawer-toggle[\s\S]*opacity:\s*1[\s\S]*pointer-events:\s*auto/);
  assert.match(shellCss, /command-drawer-panel[\s\S]*width:\s*min\(var\(--s38-command-drawer-width\), calc\(100% - 1\.5rem\)\)/);
  assert.match(shellCss, /command-drawer-panel[\s\S]*visibility:\s*hidden[\s\S]*transform:\s*translateX\(0\.5rem\)[\s\S]*transition:/);
  assert.match(shellCss, /data-command-drawer-open="true"[\s\S]*command-drawer-panel[\s\S]*visibility:\s*visible[\s\S]*transform:\s*translateX\(0\)/);
  assert.match(shellCss, /command-drawer-panel \.command-form[\s\S]*background:\s*transparent[\s\S]*border:\s*0[\s\S]*box-shadow:\s*none/);
  assert.match(shellCss, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*command-drawer-toggle[\s\S]*opacity:\s*1[\s\S]*pointer-events:\s*auto/, "touch layouts must expose the command chip without hover");
  assert.doesNotMatch(shellCss, /border-bottom-color:\s*transparent|border-radius:\s*0 0 999px 999px/, "the retired cup/join seam must not remain");
  assert.match(shellCss, /--s38-action-row-offset-y:\s*0\.25rem/, "labeled action rows must share the approved four-pixel optical offset");
  assert.match(shellCss, /button:not\(:where\([\s\S]*margin-block-start:\s*var\(--s38-action-row-offset-y\)/, "native labeled actions must use the shared optical row offset");
  assert.match(shellCss, /wa-button \{[\s\S]*margin-block-start:\s*var\(--s38-action-host-margin-block-start, var\(--s38-action-row-offset-y\)\)/, "Web Awesome labeled actions must use the shared optical row offset while honoring a component-owned layout margin");
  assert.match(docPrepSource, /\.hr-docprep-empty wa-button \{[\s\S]*--s38-action-host-margin-block-start:\s*var\(--hr-space-3\)[\s\S]*margin-block-start:\s*var\(--hr-space-3\)/, "the Document Prep empty-state CTA must retain its intentional twelve-pixel separation");
  assert.match(shellCss, /a\.btn:not\(\.icon-only\) \{[\s\S]*margin-block-start:\s*var\(--s38-action-row-offset-y\)/, "link actions must use the shared optical row offset");
  assert.match(shellCss, /#crmImportMenu \.import-split > button \{[\s\S]*margin-block-start:\s*var\(--s38-action-row-offset-y\)/, "both halves of the Import split control must keep their label and arrow rows aligned");
  assert.match(shellCss, /body\[data-s38-shell="case-journey"\] button:not\(:where\([\s\S]*\[role="tab"\][\s\S]*\[role="menuitem"\][\s\S]*\.ag-root-wrapper button[\s\S]*background:\s*var\(--hr-action-surface\)[\s\S]*border-radius:\s*999px/, "approved controls must share the tokenized graphite pill without leaking into tabs, menus, or grids");
  assert.match(shellCss, /wa-button::part\(base\)[\s\S]*background:\s*var\(--hr-action-surface\)[\s\S]*border-radius:\s*999px/, "Web Awesome actions must share the source-owned material");
  assert.match(shellCss, /a\.btn:not\(\.icon-only\) \{[\s\S]*background:\s*var\(--hr-action-surface\)[\s\S]*border-radius:\s*999px/, "link actions must share the source-owned material");
  assert.match(shellCss, /Icon-only commands stay as bare marks[\s\S]*padding:\s*0 !important[\s\S]*background:\s*transparent !important[\s\S]*border:\s*0 !important[\s\S]*:not\(:disabled\):is\(:hover, :focus-visible, :active\)[\s\S]*filter:\s*drop-shadow\(0 0 0\.3rem var\(--hr-icon-glow\)\)/, "icon-only hover, focus, and active states must preserve the hit target while limiting feedback to the tokenized HeirRight-blue glyph glow");
  assert.match(legacySource, /<button class="file-drop-icon"[^>]*aria-label="\$\{escapeHtml\(actionLabel\)\}[\s\S]*\$\{linearStatusIconHtml\(statusState, statusLabel\)\}<\/button>/, "the document status command must remain identifiable as an icon-only action");
  assert.match(shellCss, /button:not\(:where\([^)]*\.file-drop-icon[^)]*\)\) \{/, "the document status icon must be excluded from the shared graphite button plate");
  assert.match(shellCss, /button\.file-drop-icon,[\s\S]*background:\s*transparent !important;[\s\S]*border:\s*0 !important;[\s\S]*box-shadow:\s*none !important;/, "the document status icon must use the shared borderless icon contract");
  assert.match(shellCss, /button\.file-drop-icon,[\s\S]*\.linear-status-icon[\s\S]*:not\(:disabled\):is\(:hover, :focus-visible, :active\)[\s\S]*filter:\s*drop-shadow\(0 0 0\.3rem var\(--hr-icon-glow\)\)/, "the document status icon must use the tokenized HeirRight blue glow");
  assert.match(shellCss, /#workspace\[data-s38-shell="case-journey"\] \.nav-item\.is-active \{[\s\S]*background:\s*var\(--hr-action-surface\)[\s\S]*border:\s*1px solid var\(--hr-action-border\)/, "the selected primary navigation item must retain the sole intentional icon-rail pill");
  assert.match(shellCss, /\.nav-icon \{[\s\S]*color:\s*var\(--hr-accent-strong\);/, "unselected sidebar glyphs must already be blue so hover feedback adds only the glow");
  assert.match(shellCss, /\.nav-item:not\(\.is-active\):not\(:disabled\):is\(:hover, :focus-visible, :active\) \{[\s\S]*background:\s*transparent !important[\s\S]*border:\s*0 !important[\s\S]*box-shadow:\s*none !important/, "unselected navigation must never regain a hover, focus, or active plate");
  assert.match(shellCss, /\.nav-item:not\(\.is-active\):focus-visible \{[\s\S]*outline:\s*var\(--hr-focus-width\) solid var\(--hr-focus\) !important;[\s\S]*@media \(forced-colors: active\)[\s\S]*\.nav-item:not\(\.is-active\):focus-visible,[\s\S]*outline-color:\s*ButtonText !important/, "unselected navigation must keep its plate-free glow and a crisp keyboard focus ring");
  assert.match(legacyCss, /\.nav-icon::before \{[\s\S]*background:\s*radial-gradient\(circle, rgba\(10,132,255,\.42\)[\s\S]*opacity:\s*0[\s\S]*\.nav-item:not\(\.is-active\):hover \.nav-icon::before,[\s\S]*opacity:\s*\.9/, "navigation feedback must be a soft iOS-blue glyph glow rather than a square backplate");
  assert.match(shellCss, /@media \(max-width: 1120px\)[\s\S]*body\[data-s38-shell="case-journey"\] \.shell-primary-command \{[\s\S]*margin-block-start:\s*0[\s\S]*background:\s*transparent !important[\s\S]*border:\s*0 !important[\s\S]*box-shadow:\s*none !important[\s\S]*\.shell-primary-command:not\(:disabled\):is\(:hover, :focus-visible, :active\)[\s\S]*drop-shadow\(0 0 0\.3rem var\(--hr-icon-glow\)\)[\s\S]*\.shell-primary-command:disabled[\s\S]*filter:\s*none !important[\s\S]*@media \(forced-colors: active\)[\s\S]*outline-color:\s*ButtonText !important/, "the compact glyph-only primary command must return to the zero-offset bare-mark contract and must not regain the desktop plate while pressed, disabled, or keyboard-focused");
  assert.match(shellCss, /button\.icon-button,[\s\S]*\.toggle-logo img[\s\S]*:not\(:disabled\):is\(:hover, :focus-visible, :active\)[\s\S]*\.toggle-logo img\)[\s\S]*drop-shadow\(0 0 0\.3rem var\(--hr-icon-glow\)\)/, "the collapsed real HeirRight mark must receive glyph-shaped feedback without a tile");
  assert.match(shellCss, /data-shell-sidebar-collapsed="true"\] \.user-strip:not\(:disabled\):is\(:hover, :focus-visible, :active\) \.avatar \{[\s\S]*drop-shadow\(0 0 0\.3rem var\(--hr-icon-glow\)\)/, "the collapsed account action must glow its avatar rather than drawing a plate");
  assert.match(shellCss, /\.user-strip \.avatar \{[\s\S]*color:\s*var\(--hr-accent-strong\);/, "the collapsed account glyph must already be blue so its only interaction delta is the glow");
  assert.match(shellCss, /button\.row-trash-action \{[\s\S]*color:\s*var\(--hr-danger\) !important;/, "the destructive glyph must keep its semantic resting color while sharing the plate-free glow contract");
  assert.match(shellCss, /:focus-visible \{[\s\S]*outline:\s*var\(--hr-focus-width\) solid var\(--hr-focus\) !important;[\s\S]*@media \(forced-colors: active\)[\s\S]*outline-color:\s*ButtonText !important/, "icon-only keyboard focus must use the tokenized ring without restoring a hover plate");
  assert.match(shellCss, /:disabled \{[\s\S]*opacity:\s*0\.46;[\s\S]*cursor:\s*not-allowed;[\s\S]*:disabled :is\(svg, \.nucleo-icon, \.linear-status-icon, \.toggle-logo img\) \{[\s\S]*filter:\s*none !important/, "disabled icon-only controls must remain muted and must not retain a glow");
  assert.doesNotMatch(docPrepSource, /<wa-icon-button\b|<wa-button\b[^>]*(?:\bcircle(?:\s|=|>)|data-icon-only|class="[^"]*\bicon-only\b)/i, "current Web Awesome actions are labeled controls; no unstyled Web Awesome icon-only action may bypass the shared audit");
  assert.match(tokensCss, /:root \{[\s\S]*--hr-accent:\s*#0a84ff;[\s\S]*--hr-icon-glow:\s*rgb\(10 132 255 \/ 58%\)/, "graphite mode must use iOS blue interaction tokens");
  assert.match(tokensCss, /:root\[data-theme="cream"\] \{[\s\S]*--hr-surface-selected:\s*color-mix\(in srgb, var\(--hr-accent\) 12%, var\(--hr-surface\)\);[\s\S]*--hr-accent:\s*#007aff;[\s\S]*--hr-action-border:\s*rgb\(0 122 255 \/ 55%\)/, "cream mode must use iOS blue interaction tokens too");
  assert.equal((legacyCss.match(/--accent:\s*var\(--hr-accent\);/g) || []).length, 2, "the initial and explicit dark legacy fallbacks must bridge to HeirRight blue");
  assert.doesNotMatch(legacyCss, /--accent:\s*#f5f5f7|--focus-ring:\s*rgba\(235, 235, 245/, "legacy startup styles must not flash a cream interaction accent before theme mounting");
  assert.match(legacyCss, /tr\.is-selected \.select-box,[\s\S]*\.select-box\.is-mixed,[\s\S]*color:\s*var\(--hr-accent-strong\);[\s\S]*background:\s*color-mix\(in srgb, var\(--hr-accent\) 18%, transparent\);[\s\S]*border-color:\s*color-mix\(in srgb, var\(--hr-accent\) 64%, transparent\);/, "legacy checkbox selection must use the shared blue state instead of cream fill");
  assert.match(legacyCss, /input\[type="range"\] \{[\s\S]*accent-color:\s*var\(--accent\);/, "Settings ranges must inherit the blue interaction accent");
  assert.doesNotMatch(legacyCss, /accent-color:\s*var\(--text\)/, "legacy range controls must not fall back to the cream text color");
  assert.match(gridsCss, /\.ag-paging-button \{[\s\S]*background:\s*transparent !important;[\s\S]*border:\s*0 !important;[\s\S]*box-shadow:\s*none !important;[\s\S]*outline:\s*none !important;/, "AG Grid pagination icons must remain bare controls");
  assert.match(gridsCss, /\.ag-paging-button:not\(\.ag-disabled\) \{[\s\S]*color:\s*var\(--hr-accent-strong\);/, "enabled pagination glyphs must already be blue so interaction adds only the glow");
  assert.match(gridsCss, /\.ag-paging-button::after \{[\s\S]*display:\s*none !important;[\s\S]*content:\s*none !important;/, "AG Grid must not redraw its default square keyboard-focus plate");
  assert.match(gridsCss, /\.ag-paging-button:not\(\.ag-disabled\):is\(:hover, :focus-visible, :active\) \.ag-icon \{[\s\S]*drop-shadow\(0 0 0\.3rem var\(--hr-icon-glow\)\)/, "AG Grid pagination hover, focus, and active feedback must use the shared blue glyph glow");
  assert.match(gridsCss, /\.ag-paging-button:not\(\.ag-disabled\):focus-visible \{[\s\S]*outline:\s*var\(--hr-focus-width\) solid var\(--hr-focus\) !important/, "AG Grid pagination must retain an explicit normal-mode keyboard ring");
  assert.match(gridsCss, /@media \(forced-colors: active\)[\s\S]*:is\([\s\S]*\.ag-paging-button:not\(\.ag-disabled\),[\s\S]*\.ag-header-cell-menu-button,[\s\S]*\.ag-header-cell-filter-button[\s\S]*\):focus-visible \{[\s\S]*outline:\s*2px solid ButtonText !important/, "AG Grid icon controls must recover an explicit keyboard outline in forced-colors mode");
  assert.match(gridsCss, /\.ag-header-cell-menu-button, \.ag-header-cell-filter-button\)[\s\S]*background:\s*transparent !important;[\s\S]*border:\s*0 !important;[\s\S]*box-shadow:\s*none !important;/, "AG Grid header icon buttons must not draw Quartz square hover plates");
  assert.match(gridsCss, /\.ag-header-cell-menu-button, \.ag-header-cell-filter-button\):is\(:hover, :focus-visible, :active\) \.ag-icon \{[\s\S]*drop-shadow\(0 0 0\.3rem var\(--hr-icon-glow\)\)/, "AG Grid header icon feedback must use the shared blue glyph glow");
  assert.match(gridsCss, /\.ag-header-cell-menu-button, \.ag-header-cell-filter-button\):focus-visible \{[\s\S]*outline:\s*var\(--hr-focus-width\) solid var\(--hr-focus\) !important/, "AG Grid header icon controls must retain an explicit normal-mode keyboard ring");
  assert.match(gridsCss, /\.hr-grid-row-action \{[\s\S]*background:\s*var\(--hr-action-surface\);[\s\S]*border:\s*1px solid[\s\S]*border-radius:\s*999px;[\s\S]*box-shadow:\s*inset 0 1px 0 var\(--hr-action-highlight\)/, "Queue's labeled Remove action must use the shared graphite pill material");
  assert.match(gridsCss, /\.hr-grid-row-action:focus-visible \{[\s\S]*outline:\s*var\(--hr-focus-width\) solid var\(--hr-focus\)/, "Queue's Remove action must retain an explicit keyboard focus state");

  assert.equal((source.match(/id="s38UnifiedRail"/g) || []).length, 1, "the application must create exactly one contextual rail host");
  assert.match(railHost, /const RAIL_EXIT_MS = 320/);
  assert.match(railHost, /const RAIL_WIDTH_STEP = 16/);
  assert.match(railHost, /defaultWidth \|\| 392/);
  assert.match(railHost, /minWidth \|\| 340/);
  assert.match(railHost, /maxWidth \|\| 480/);
  assert.match(railHost, /matchMedia\("\(max-width: 819px\)"\)/);
  assert.match(railHost, /function syncRailTriggerSemantics\(state\)[\s\S]*aria-controls", "s38UnifiedRail"[\s\S]*aria-expanded", String\(Boolean\(state\.open\)\)[\s\S]*state\.mobileSheet[\s\S]*aria-haspopup", "dialog"[\s\S]*removeAttribute\("aria-haspopup"\)/, "the stable trigger must match desktop disclosure and mobile dialog semantics");
  assert.match(railHost, /railState = next;\s*syncRailTriggerSemantics\(next\);/, "rail state changes must keep the stable trigger's expanded semantics current");
  assert.match(railHost, /const opening = Boolean\(next\.open && \(!previous\.open \|\| layer\.hidden\)\)/);
  assert.match(railHost, /document\.activeElement/);
  assert.match(railHost, /openRail\(\{ focusOnOpen: opening \}\)/);
  assert.match(railHost, /\(selectedTab \|\| railContent\)\.focus/);
  assert.match(railHost, /rail\.setAttribute\("role", "dialog"\)/);
  assert.match(railHost, /rail\.removeAttribute\("role"\)/);
  assert.match(railHost, /rail\.setAttribute\("aria-modal", "true"\)/);
  assert.doesNotMatch(railHost, /setAttribute\("aria-modal", "false"\)/);
  assert.match(railHost, /function focusTargetAvailable[\s\S]*current\.hidden \|\| current\.inert[\s\S]*getClientRects\(\)\.length > 0/, "rail close must reject hidden or inert invokers");
  assert.match(railHost, /function focusAndConfirm[\s\S]*document\.activeElement === target/);
  assert.match(railHost, /if \(focusAndConfirm\(source\)\) return true;\s*return fallback !== source && focusAndConfirm\(fallback\);/, "rail close must verify focus and fall back to the stable header control");
  assert.match(railHost, /event\.key === "Escape"/);
  assert.match(railHost, /\["ArrowLeft", "ArrowRight", "Home", "End"\]\.includes\(event\.key\)/);
  assert.match(railHost, /runtime\.rails\.selectTab\(nextTabId\)/);
  assert.match(railHost, /runtime\.rails\.selectTab\(tabId\);\s*focusRailTab\(tabId\);/, "click and Enter activation must restore focus to the selected tab after tablist replacement");
  assert.match(railHost, /next\.open && contextChanged && !opening\) focusRailEntry\(\)/, "an open rail context swap must focus the selected tab in the new context");
  assert.match(railHost, /role="tabpanel"/);
  assert.match(railHost, /aria-controls="s38UnifiedRailPanel"/);
  assert.match(railHost, /railContent\.setAttribute\("aria-labelledby", selectedTab\.id\)/);
  assert.match(railHost, /event\.key !== "Tab" \|\| !mobileQuery\.matches/);
  assert.match(railHost, /element\.getClientRects\(\)\.length > 0/);
  assert.match(railHost, /document\.body\.classList\.add\("s38-mobile-rail-open"\)/);
  assert.match(railHost, /createBackgroundInertController\(layer\)/);
  assert.match(railHost, /backgroundInert\.apply\(\)/);
  assert.match(railHost, /backgroundInert\.restore\(\)/);
  assert.match(railHost, /document\.addEventListener\("keydown", onKeyDown, true\)/, "mobile shortcut containment must run before global document shortcuts");
  assert.match(railHost, /document\.addEventListener\("focusin", onFocusIn, true\)/);
  assert.match(railHost, /containMobileRailKeydown\(event, rail, focusRailEntry\)/);
  assert.match(railHost, /role="alert" aria-live="assertive" aria-atomic="true" data-unified-rail-error/);
  assert.match(railHost, /data-unified-rail-retry/);
  assert.match(railHost, /const actionControl = findRailActionControl\(descriptor\.actionId\);[\s\S]*focusAndConfirm\(actionControl\)[\s\S]*clearActionError\(\);[\s\S]*runAction\(actionControl \|\| retry, descriptor\)/, "Retry must move focus off its hidden recovery region before rerunning");
  assert.match(railHost, /const focusedControl = captureRailContentFocus\(\);[\s\S]*renderContent\(\);[\s\S]*restoreRailContentFocus\(focusedControl\)/, "state-driven content replacement must restore the focused action or rail entry");
  assert.match(railHost, /executeRailAction[\s\S]*finally[\s\S]*removeAttribute\?\.\("aria-busy"\)/, "rail actions must leave busy state after rejection");
  assert.match(railHost, /const closeLabel = `Close \$\{label\}`[\s\S]*data-unified-rail-close/);
  const closeRailSource = railHost.slice(railHost.indexOf("function closeRail"), railHost.indexOf("function focusRailEntry"));
  assert.ok(closeRailSource.indexOf("restoreInvokerFocus();") < closeRailSource.indexOf('rail.setAttribute("aria-hidden", "true")'), "closing must restore focus before the rail becomes aria-hidden");
  assert.match(railHost, /data-rail-action-id\], \[data-rail-action/);
  assert.match(railHost, /iconMarkup\("close", \{ size: 18 \}\)/, "the unified rail close control must use the semantic icon facade");
  assert.doesNotMatch(railHost, />×</, "the unified rail must not ship a raw multiplication glyph as its close icon");
  assert.match(iconFacadeSource, /close:\s*"close"/);
  assert.match(iconFacadeSource, /journey:\s*"magnifier-route"/);

  assert.match(themeControl, /\{ id: "dark", label: "Dark" \}/);
  assert.match(themeControl, /\{ id: "cream", label: "Cream" \}/);
  assert.match(themeControl, /\{ id: "system", label: "System" \}/);
  assert.match(legacySource, /id="s38SettingsThemeMount" class="shell-theme-control-mount"/);
  assert.match(legacySource, /document\.dispatchEvent\(new CustomEvent\("heirright:settings-rendered"/);
  assert.match(shellCss, /shell-theme-control button[\s\S]*min-height:\s*2\.75rem/, "theme choices need 44px targets in every layout");
  const narrowCss = shellCss.slice(shellCss.indexOf("@media (max-width: 430px)"), shellCss.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.doesNotMatch(narrowCss, /shell-theme-control-mount[\s\S]*display:\s*none/, "theme selection must remain visible at 390px");
  const mobileCss = shellCss.slice(shellCss.indexOf("@media (max-width: 819px)"), shellCss.indexOf("@media (max-width: 430px)"));
  assert.match(mobileCss, /shell-theme-control button[\s\S]*width:\s*3rem[\s\S]*min-height:\s*2\.75rem[\s\S]*font-size:\s*var\(--hr-type-xs\)/, "mobile theme choices need readable 44px touch targets");

  assert.match(shellCss, /--s38-left-rail-collapsed:\s*3\.5rem/);
  assert.match(shellCss, /--s38-main-radius:\s*var\(--hr-radius-main\)/);
  assert.match(shellCss, /border-radius:\s*var\(--s38-main-radius\)/);
  assert.match(shellCss, /var\(--hr-motion-feedback\)/);
  assert.match(shellCss, /var\(--hr-motion-state\)/);
  assert.match(shellCss, /var\(--hr-motion-rail\)/);
  assert.match(shellCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(shellCss, /body\.s38-mobile-rail-open[\s\S]*overflow:\s*hidden/);
  assert.doesNotMatch(shellCss, /transition:\s*all/i);
  const designGradients = source.match(/(?:linear|radial)-gradient\(/gi) || [];
  assert.equal(designGradients.length, 0, "the rejected fading footer ruler must leave no S38 shell gradient behind");
  assert.doesNotMatch(shellCss, /\.statusbar::before/, "the status footer must not draw a fading top ruler");
  assert.match(shellCss, /@media \(min-width: 820px\)[\s\S]*\.shell-kpi-strip,\s*[\s\S]*\.connection-statuses\s*\{[^}]*align-self:\s*end[^}]*margin-block-end:\s*0\.3125rem/, "both desktop footer status clusters must share the same bottom alignment");
  assert.match(shellCss, /@media \(min-width: 820px\)[\s\S]*\.shell-kpi-strip\s*\{[^}]*margin-inline-start:\s*0\.9375rem/, "the selected-estate indicators must keep the approved 15px desktop inset");
  assert.match(shellCss, /@media \(min-width: 820px\)[\s\S]*data-shell-sidebar-collapsed="true"\] \.user-strip \.avatar\s*\{[^}]*margin-inline-start:\s*0\.125rem[^}]*margin-block-end:\s*-0\.8125rem/, "the collapsed account mark must retain its approved desktop optical alignment");
  assert.doesNotMatch(source, /#0077ed|<svg|https?:\/\//i);
  assert.doesNotMatch(source, /ag-grid/i, "small dashboard and document surfaces must stay editorial");
  assert.doesNotMatch([register, controller, shellView, railHost, themeControl, dashboardSource, journeySource, journeyRailSource].join("\n"), /solvys-liquid-glass/i);
  assert.doesNotMatch(indexHtml, /class="search-control solvys-liquid-glass|class="import-split solvys-liquid-glass|class="search-popup solvys-liquid-glass-strong/, "permanent shell controls must not opt into the legacy glass material");
  assert.match(buildSource, /copyBrandAssets[\s\S]*heirright-mark\.png/);
  assert.match(serverSource, /"\.png":\s*"image\/png"/);
  assert.match(shellCss, /\.user-strip[\s\S]*background:\s*transparent !important[\s\S]*border:\s*0 !important[\s\S]*box-shadow:\s*none !important/);
  assert.match(shellCss, /:is\(\.solvys-liquid-glass, \.solvys-liquid-glass-strong\)::before,[\s\S]*::after[\s\S]*display:\s*none !important[\s\S]*content:\s*none !important/, "the S38 shell must neutralize legacy pseudo-element rims on remaining views");

  for (const label of ["Move Forward", "Review", "Blocked", "Move On"]) {
    assert.match(journeySource, new RegExp(`"${label}"`));
  }
  for (const label of ["Intake", "Property", "Title & Tax", "Probate & Heirs", "Discovery", "Packet Review", "Handoff"]) {
    assert.match(journeySource, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  const stageCompletionSource = journeySource.slice(journeySource.indexOf("function stageCompletionIndex"), journeySource.indexOf("function stageReason"));
  assert.doesNotMatch(stageCompletionSource, /dealStatus|\bhot\b/i, "legacy deal temperature must not complete the Handoff stage");
  assert.match(stageCompletionSource, /hasHandoffEvidence\(state\)/);
  assert.match(dashboardSource, /data-dashboard-estate-id/);
  assert.match(dashboardSource, /<button class="dashboard-estate-row"/);
  assert.doesNotMatch(dashboardSource, /eye icon|data-document-preview/i);
  assert.match(journeyRailSource, /const estateId = payload\.state\?\.selectedEstateId[\s\S]*dispatch\("document-action", \{[\s\S]*estateId,[\s\S]*action: "select"[\s\S]*runtime\.rails\.activate\("doc-prep-context", \{ tab: "document", open: true \}\)/, "whole-row activation must select the document and open its rail without triggering a file action");
  assert.match(legacySource, /function publicEstateEvidenceGroups[\s\S]*property:\s*propertyAppraiserEvidenceComplete\(row\)[\s\S]*deed:[\s\S]*tax:[\s\S]*probate:[\s\S]*heirs:/, "the public Property lifecycle gate must reuse the verified automation evidence contract");
  for (const requiredEvidence of [
    "lastSaleDate",
    "adversePossessionSignal",
    "paidBy",
    "paidDate",
    "unpaidYears",
    "reassessment",
    "documentAvailability",
    "affidavitOfHeirsStatus",
    "obituaryReviewed",
  ]) {
    assert.match(legacySource, new RegExp(requiredEvidence), `Case Journey evidence groups must require ${requiredEvidence}`);
  }
  assert.match(legacySource, /evidenceGroups: publicEstateEvidenceGroups\(row\)/);
  assert.match(legacySource, /function addShellEvent\([^)]*context = \{\}[\s\S]*estateId[\s\S]*actor[\s\S]*source[\s\S]*global/, "shell events must record estate identity and human-readable attribution when they are created");
  assert.match(legacySource, /function publicShellEvents\(row\)[\s\S]*event\?\.global === true[\s\S]*event\?\.estateId[\s\S]*actor:[\s\S]*source:/, "the public Case Journey activity stream must keep only selected-estate or explicit global events");
  assert.match(legacySource, /activity: publicShellEvents\(row\)/);
  assert.match(legacySource, /const entityOwnerPattern = \/\\b[\s\S]*\(\?!\[A-Z0-9_\]\)\/i;/, "legacy stop enforcement must recognize punctuated company suffixes without matching longer words");
  assert.match(legacySource, /packetApproved: Boolean\(currentPacketApproval\(row, flow\.id\)\)/, "public status must distinguish verified readback from explicit packet approval");
  assert.match(legacySource, /async function hydrateCurrentPacketApproval[\s\S]*action: "status"[\s\S]*result\?\.approved === true[\s\S]*setRuntimePacketApproval/, "reloads must hydrate current approval through actor-bound server-attested status readback");
  assert.match(legacySource, /async function approveCurrentPacket[\s\S]*action: "approve"[\s\S]*readbackStatus !== "verified"[\s\S]*setRuntimePacketApproval/, "packet approval must pass exact server attestation before its runtime display state is updated");
  assert.doesNotMatch(legacySource.match(/async function approveCurrentPacket[\s\S]*?\n\}/)?.[0] || "", /persistServerState|storageSetItem/, "approval display must not be mirrored through forgeable generic workspace state");
  assert.match(legacySource, /verifyPacketArtifact\(hydratedPacket, key\)[\s\S]*hydrateCurrentPacketApproval\(row, packetReference\.flow\)/, "verified packet reload must hydrate its durable actor-bound approval before rendering the rail");
  assert.match(serverSource, /body\.controlledTest === true && requireApiAdmin\(req, res\)/, "the local production facade must reserve controlled live exports for administrators");
  assert.match(legacySource, /id === "approve-packet"[\s\S]*await approveCurrentPacket/, "the rail approval control must reach the durable approval command");
  assert.match(legacySource, /function sameOriginVerifiedArtifactHref[\s\S]*return verifiedArtifactHref\(candidate, artifactId, window\.location\.origin\)/);
  assert.match(verifiedArtifactLinkSource, /"\/api\/reports\/pdf": "artifactId"[\s\S]*"\/api\/documents\/attachments": "attachmentId"/);
  assert.match(verifiedArtifactLinkSource, /parameterNames\.length !== 1[\s\S]*getAll\(identityParameter\)\.length !== 1/, "file controls must require one exact identity parameter on an approved readback route");
  assert.match(legacySource, /function packetMatchesCurrentVerifiedRevision[\s\S]*current\.artifactId === artifactId[\s\S]*currentPacketRevision\(row, flowId\)/, "packet-bound controls must share one exact active-revision check");
  assert.match(legacySource, /function runLegacyPacketAction[\s\S]*requireCurrentUnexpiredPacket\(row, flowId, packet,[\s\S]*sameOriginVerifiedArtifactHref/, "packet controls must resolve the exact unexpired verified revision at click time");
  assert.match(docPrepRailSource, /data-rail-action="open-packet"[\s\S]*"open-packet": \(payload\) => runPacketAction\("open", payload\)/, "Open current packet must use the source-bound rail action that Codex Browser executes");
  const packetActionSource = legacySource.match(/function runLegacyPacketAction[\s\S]*?\n\}/)?.[0] || "";
  assert.match(packetActionSource, /const href = sameOriginVerifiedArtifactHref\(packet\.artifactUrl, artifactId\)[\s\S]*if \(action === "open"\) \{[\s\S]*window\.location\.assign\(href\);[\s\S]*return;/, "Open current packet must navigate the verified same-origin route in the current Codex Browser tab");
  assert.doesNotMatch(packetActionSource, /window\.open|target\s*=\s*"_blank"|opened in a new tab/, "packet opening must not use a discarded popup, synthetic new-tab target, or false success copy");
  assert.match(shellCss, /\.shell-rail-action-error\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important/, "a cleared rail action error must not remain visually exposed through the shell display rule");
  assert.match(legacySource, /function packetArtifactIsUnexpired[\s\S]*expiration > Number\(now\)/);
  assert.match(legacySource, /function publicPacketIsVerified[\s\S]*packetArtifactIsUnexpired\(packet\)/, "Completion must stop exposing packet controls after the stored artifact expires");
  assert.match(legacySource, /function requireCurrentUnexpiredPacket[\s\S]*!packetArtifactIsUnexpired\(packet\)[\s\S]*packet link expired/, "the shared click-time gate must reject an expired stored artifact");
  for (const actionFunction of [
    "approveCurrentPacket",
    "prepareChatgptWorkHandoff",
    "openChatgptWorkHandoff",
    "deliverPacketToGoogle",
    "runLegacyPacketAction",
  ]) {
    const actionStart = legacySource.indexOf(`function ${actionFunction}`);
    const nextFunction = legacySource.indexOf("\nfunction ", actionStart + 10);
    const nextAsyncFunction = legacySource.indexOf("\nasync function ", actionStart + 10);
    const candidates = [nextFunction, nextAsyncFunction].filter((index) => index > actionStart);
    const actionEnd = candidates.length ? Math.min(...candidates) : legacySource.length;
    assert.match(
      legacySource.slice(actionStart, actionEnd),
      /requireCurrentUnexpiredPacket\(/,
      `${actionFunction} must recheck packet expiry when the operator invokes it`
    );
  }
  assert.match(legacySource, /function currentPacketApproval[\s\S]*packetMatchesCurrentVerifiedRevision\(row, flowId, packet\)[\s\S]*packetArtifactIsUnexpired\(packet\)/, "an expired packet approval must stop being current without a rerender");
  assert.match(legacySource, /id === "packet-action"[\s\S]*runLegacyPacketAction\(row, payload\)/);
  assert.match(legacySource, /function packetMatchesCurrentVerifiedRevision[\s\S]*current\.artifactId === artifactId[\s\S]*currentPacketRevision\(row, flowId\)[\s\S]*packetVerified: publicPacketIsVerified/, "Completion controls must only render for the exact verified active revision");
  assert.match(legacySource, /if \(result\.applied\)[\s\S]*Access approval requested[\s\S]*remains unchanged until the approved environment allowlist is deployed/, "production access requests must never be described as already applied");
  assert.match(legacySource, /state\.adminAccessEmails[\s\S]*Exact email[\s\S]*data-admin-remove-access/, "exact email approvals must remain distinct and removable in Admin");
  assert.match(legacySource, /\[name='accessAction'\][\s\S]*button\.textContent = event\.currentTarget\.value === "remove" \? "Remove" : "Add"/, "the access form button must match its selected action");
  assert.doesNotMatch(legacySource, /Domain added to the live sign-in gate|Domain removed from the live sign-in gate/);
  assert.match(legacySource, /window\.addEventListener\("pagehide"[\s\S]*event\.persisted[\s\S]*lockWorkspaceForHistoryRestore/);
  assert.match(legacySource, /window\.addEventListener\("pageshow"[\s\S]*event\.persisted[\s\S]*window\.location\.reload\(\)/, "a browser history restore must revalidate the session instead of exposing cached estate DOM");
  assert.match(serverSource, /"cache-control": "private, no-store, max-age=0"/);
  assert.match(serverSource, /frame-ancestors 'none'/);
  assert.match(serverSource, /"x-frame-options": "DENY"/);
  assert.match(authSharedSource, /canAdminister[\s\S]*session\?\.mode === "google"[\s\S]*adminEmails\(process\.env\)\.includes/, "admin replacement capability must come from the exact server-side administrator list");
  for (const config of [artifactVercel, rootVercel]) {
    const renderedHeaders = JSON.stringify(config.headers || []);
    assert.match(renderedHeaders, /private, no-store, max-age=0/);
    assert.match(renderedHeaders, /frame-ancestors 'none'/);
    assert.match(renderedHeaders, /X-Frame-Options[\s\S]*DENY/);
  }
}

async function assertExecutableContracts() {
  const storage = new Map();
  const rootClasses = new Set();
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  };
  globalThis.document = {
    documentElement: {
      dataset: {},
      style: {},
      classList: { toggle: (name, active) => active ? rootClasses.add(name) : rootClasses.delete(name) },
    },
    body: { dataset: {} },
  };

  const runtime = await importCaseJourneyRuntime();

  assert.deepEqual(runtime.DISPOSITIONS, ["Move Forward", "Review", "Blocked", "Move On"]);
  assert.deepEqual(runtime.LIFECYCLE_STAGES.map((stage) => stage.label), [
    "Intake",
    "Property",
    "Title & Tax",
    "Probate & Heirs",
    "Discovery",
    "Packet Review",
    "Handoff",
  ]);

  assert.equal(runtime.resolveDisposition({}).label, "Blocked");
  assert.equal(runtime.verifiedArtifactHref("/api/reports/pdf?artifactId=packet-1", "packet-1", "https://app.heirright.test"), "/api/reports/pdf?artifactId=packet-1");
  assert.equal(runtime.verifiedArtifactHref("https://app.heirright.test/api/documents/attachments?attachmentId=file-1", "file-1", "https://app.heirright.test"), "/api/documents/attachments?attachmentId=file-1");
  for (const hostileLink of [
    "/api/auth/logout?artifactId=packet-1",
    "/api/reports/pdf?artifactId=wrong",
    "/api/reports/pdf?artifactId=packet-1&attachmentId=packet-1",
    "/api/reports/pdf?artifactId=packet-1&artifactId=packet-1",
    "/api/documents/attachments?artifactId=file-1",
    "https://evil.example/api/reports/pdf?artifactId=packet-1",
  ]) {
    assert.throws(() => runtime.verifiedArtifactHref(hostileLink, hostileLink.includes("file-1") ? "file-1" : "packet-1", "https://app.heirright.test"));
  }
  assert.equal(runtime.resolveDisposition(baseState()).label, "Review");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ ownerType: "company" }) })).label, "Move On", "the typed owner classification must enforce the company stop");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ owner: "Acme Holdings LLC", classification: "Probate review", nextAction: "Confirm the probate case" }) })).label, "Move On", "the authoritative owner field must enforce the company stop");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ stopReasonCodes: ["COMPANY_OWNER"] }) })).label, "Move On", "the server workflow company stop must remain authoritative");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ owner: "Sample Estate Holdings" }) })).label, "Move On", "a Holdings owner name must align with the source workflow entity stop");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ owner: "Sample Property Investments" }) })).label, "Move On", "the browser fallback must retain the authoritative Worker entity-owner vocabulary beyond Holdings");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ owner: "Acme L.L.C." }) })).label, "Move On", "a punctuated LLC suffix must not bypass the company stop");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ owner: "Acme Co." }) })).label, "Move On", "a punctuated company suffix must not bypass the company stop");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ recentSaleWithinFiveYears: true }) })).label, "Move On", "a verified sale inside five years must stop the lead without presentation-copy matching");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ stopReasonCodes: ["RECENT_SALE_WITHIN_5_YEARS"] }) })).label, "Move On", "the server workflow recent-sale stop must remain authoritative");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ ownerType: "trust_estate_review", nextAction: "Review family trust records" }) })).label, "Review", "trust and estate ownership must stay active for representative review");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ nextAction: "Rule out LLC ownership" }) })).label, "Review", "an operator question about entity ownership must not become a company stop");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ nextAction: "Confirm whether a recent sale occurred" }) })).label, "Review", "a recent-sale question must not stop the lead without typed evidence or an authoritative reason code");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ nextAction: "Review whether to move on" }) })).label, "Review", "operator prose about a decision must not become the decision");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ nextAction: "Do not move on yet" }) })).label, "Review", "negated operator prose must not stop the estate");
  assert.equal(runtime.resolveDisposition(baseState({ selectedEstate: selectedEstate({ disposition: "Move On" }) })).label, "Move On", "a dedicated structured disposition may explicitly stop the estate");
  const moveOnState = baseState({
    selectedEstate: selectedEstate({ owner: "Sample Property Holdings LLC" }),
    docPrep: {
      ...baseState().docPrep,
      progress: 100,
      complete: true,
      packetVerified: true,
      packetApproved: true,
      documents: [{ id: "deed", title: "Recorded Deed", source: "County recorder", status: "Verified", hasVerifiedFile: true }],
    },
  });
  const moveOnAttention = runtime.attentionRows(moveOnState);
  assert.deepEqual(moveOnAttention.map((item) => item.id), ["disposition"], "Move On must remove Discovery, document, approval, and handoff work from Dashboard attention");
  assert.equal(moveOnAttention[0].view, "find-estates");
  assert.equal(runtime.resolveDisposition(baseState({
    docPrep: { ...baseState().docPrep, automation: { status: "failed", sections: [] } },
  })).label, "Blocked");
  assert.equal(runtime.resolveDisposition(baseState({
    dealStatus: { id: "warm", label: "Warm" },
    docPrep: { ...baseState().docPrep, progress: 100, complete: true },
  })).label, "Review", "Discovery completion cannot substitute for human packet approval");
  assert.equal(runtime.resolveDisposition(baseState({
    docPrep: { ...baseState().docPrep, packetVerified: true },
  })).label, "Review", "artifact readback cannot substitute for human packet approval");
  assert.equal(runtime.resolveDisposition(baseState({
    docPrep: { ...baseState().docPrep, packetVerified: true, packetApproved: true },
  })).label, "Move Forward");

  for (const companyEstate of [
    selectedEstate({ owner: "Sample Property LLC" }),
    selectedEstate({ owner: "Sample Property Inc." }),
    selectedEstate({ owner: "Sample Estate Holdings" }),
    selectedEstate({ owner: "Sample Property Investments" }),
    selectedEstate({ owner: "Sample Person", stopReasonCodes: ["COMPANY_OWNER"] }),
  ]) {
    const companyState = baseState({ selectedEstate: companyEstate });
    assert.equal(runtime.companyOwnerStop(companyState), true);
    const companyLifecycle = runtime.buildLifecycle(companyState);
    assert.equal(companyLifecycle.find((stage) => stage.id === "property").status, "blocked", `${companyEstate.owner} must stop at ownership review`);
    assert.equal(companyLifecycle.find((stage) => stage.id === "title-tax").status, "upcoming", "company ownership must stop before title and tax research");
  }

  const unsupportedCompletion = runtime.buildLifecycle(baseState({
    selectedEstate: selectedEstate({
      evidenceGroups: { property: false, deed: false, tax: false, probate: false, heirs: false },
    }),
    docPrep: { ...baseState().docPrep, progress: 100, complete: true, packetVerified: true },
  }));
  assert.equal(unsupportedCompletion.find((stage) => stage.id === "property").status, "current");
  assert.equal(unsupportedCompletion.find((stage) => stage.id === "title-tax").status, "upcoming");
  assert.equal(unsupportedCompletion.find((stage) => stage.id === "probate-heirs").status, "upcoming");

  const titleTaxOnly = runtime.buildLifecycle(baseState({
    selectedEstate: selectedEstate({
      evidenceGroups: { property: true, deed: true, tax: true, probate: false, heirs: false },
    }),
    docPrep: { ...baseState().docPrep, progress: 20 },
  }));
  assert.equal(titleTaxOnly.find((stage) => stage.id === "title-tax").status, "completed");
  assert.equal(titleTaxOnly.find((stage) => stage.id === "probate-heirs").status, "current");

  const partialTitleTax = runtime.buildLifecycle(baseState({
    selectedEstate: selectedEstate({
      evidenceGroups: { property: true, deed: true, tax: false, probate: false, heirs: false },
    }),
  }));
  assert.equal(partialTitleTax.find((stage) => stage.id === "title-tax").status, "current", "partial title/tax evidence must not complete the stage");

  const partialProbateHeirs = runtime.buildLifecycle(baseState({
    selectedEstate: selectedEstate({
      evidenceGroups: { property: true, deed: true, tax: true, probate: true, heirs: false },
    }),
  }));
  assert.equal(partialProbateHeirs.find((stage) => stage.id === "probate-heirs").status, "current", "probate evidence without reviewed heir cross-checks must not complete the stage");

  const allReviewed = runtime.buildLifecycle(baseState({
    selectedEstate: selectedEstate({
      evidenceGroups: { property: true, deed: true, tax: true, probate: true, heirs: true },
    }),
  }));
  assert.equal(allReviewed.find((stage) => stage.id === "probate-heirs").status, "completed");
  assert.equal(allReviewed.find((stage) => stage.id === "discovery").status, "current");

  const readyForHandoff = baseState({
    selectedEstate: selectedEstate({
      evidenceGroups: { property: true, deed: true, tax: true, probate: true, heirs: true },
    }),
    dealStatus: { id: "hot", label: "Hot" },
    queueIds: [],
    docPrep: {
      ...baseState().docPrep,
      progress: 100,
      complete: true,
      packetVerified: true,
      packetApproved: true,
    },
  });
  assert.equal(runtime.hasHandoffEvidence(readyForHandoff), false);
  assert.equal(runtime.buildLifecycle(readyForHandoff).find((stage) => stage.id === "handoff").status, "current", "legacy Hot status must not complete Handoff");
  assert.equal(runtime.hasHandoffEvidence({ ...readyForHandoff, queueIds: [readyForHandoff.selectedEstate.id] }), true);
  assert.equal(runtime.buildLifecycle({ ...readyForHandoff, queueIds: [readyForHandoff.selectedEstate.id] }).find((stage) => stage.id === "handoff").status, "completed", "explicit Queue evidence may complete Handoff");
  assert.equal(runtime.hasHandoffEvidence({ ...readyForHandoff, docPrep: { ...readyForHandoff.docPrep, googleDelivered: true } }), true);
  assert.equal(runtime.buildLifecycle({ ...readyForHandoff, docPrep: { ...readyForHandoff.docPrep, googleDelivered: true } }).find((stage) => stage.id === "handoff").status, "completed", "verified delivery evidence may complete Handoff");

  const verifiedUnapprovedAttention = runtime.attentionRows(baseState({
    docPrep: { ...baseState().docPrep, progress: 100, complete: true, packetVerified: true, packetApproved: false },
  }));
  assert.deepEqual(verifiedUnapprovedAttention.map((item) => item.id), ["packet-approval"]);
  assert.equal(verifiedUnapprovedAttention[0].action, "Approve Current Packet");
  assert.equal(verifiedUnapprovedAttention[0].view, "dossiers", "packet approval must stay in Document Prep");
  assert.equal(verifiedUnapprovedAttention[0].context, "actions", "the Dashboard CTA must expose the exact packet approval action instead of a generic Document Prep landing");
  assert.doesNotMatch(JSON.stringify(verifiedUnapprovedAttention), /Packet review is complete|Open Queue/, "verified readback alone must not claim review completion or route to Queue");

  const approvedAttention = runtime.attentionRows(baseState({
    docPrep: { ...baseState().docPrep, progress: 100, complete: true, packetVerified: true, packetApproved: true },
  }));
  assert.equal(approvedAttention[0].id, "handoff");
  assert.equal(approvedAttention[0].view, "queue");

  const now = Date.now();
  const liveActivity = Array.from({ length: 9 }, (_, index) => ({
    estateId: "estate-001",
    actor: "Tifos",
    source: "Property Appraiser",
    title: `Live estate update ${index + 1}`,
    copy: `Verified source event ${index + 1}.`,
    tone: index === 1 ? "blocked" : index % 2 ? "review" : "ready",
    updatedAt: now - index * 1000,
  }));
  const journeyEvents = runtime.buildJourneyTimeline(baseState({ activity: liveActivity }));
  assert.equal(journeyEvents.length, 9, "the vertical timeline must retain live events beyond the seven lifecycle stages");
  assert.ok(journeyEvents.every((event) => event.id.startsWith("event-")), "the vertical timeline must render recorded events instead of lifecycle placeholders");
  assert.deepEqual(journeyEvents.map((event) => event.title), liveActivity.map((event) => event.title));
  assert.equal(journeyEvents[0].tone, "completed");
  assert.equal(journeyEvents[1].tone, "blocked");
  assert.equal(journeyEvents[3].tone, "current");
  assert.equal(journeyEvents[0].estateId, "estate-001");
  assert.equal(journeyEvents[0].actor, "Tifos");
  assert.equal(journeyEvents[0].source, "Property Appraiser");
  const duplicateJourneyEvents = runtime.buildJourneyTimeline(baseState({ activity: [liveActivity[0], { ...liveActivity[0] }] }));
  assert.equal(duplicateJourneyEvents.length, 1, "identical subscriber updates must not duplicate a timeline event");

  for (const state of [
    {},
    baseState(),
    baseState({ selectedEstate: selectedEstate({ ownerType: "company" }) }),
    baseState({ docPrep: { ...baseState().docPrep, packetVerified: true } }),
    baseState({ docPrep: { ...baseState().docPrep, packetVerified: true, packetApproved: true } }),
  ]) {
    const lifecycle = runtime.buildLifecycle(state);
    assert.equal(lifecycle.length, 7);
    assert.ok(lifecycle.every((stage) => ["completed", "current", "blocked", "upcoming"].includes(stage.status)));
    assert.ok(lifecycle.filter((stage) => ["current", "blocked"].includes(stage.status)).length <= 1);
  }

  let state = baseState({
    activity: [{ title: "County source reviewed", copy: "The deed source is attached.", tone: "ready", updatedAt: Date.now() }],
    docPrep: {
      ...baseState().docPrep,
      progress: 35,
      documents: [{ id: "deed", title: "Recorded Deed", source: "County recorder", status: "Verified", hasVerifiedFile: true }],
    },
  });
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
  const bridge = runtime.installLegacyBridge({
    readState: () => state,
    subscribe: () => () => {},
    dispatch: async () => null,
    selectedEstateId: () => state.selectedEstateId,
    navigate: () => null,
    emit: () => null,
    escapeHtml,
    icon: (name, size) => `<span data-test-icon="${escapeHtml(name)}" data-size="${size}"></span>`,
  });
  const markup = runtime.renderDashboardView({ bridge });
  assert.match(markup, /HeirRight Case Journey Dashboard/);
  assert.match(markup, /Disposition[\s\S]*Review/);
  assert.match(markup, /Estate lifecycle/);
  assert.match(markup, /Intake[\s\S]*Property[\s\S]*Title &amp; Tax[\s\S]*Probate &amp; Heirs[\s\S]*Discovery[\s\S]*Packet Review[\s\S]*Handoff/);
  assert.match(markup, /<button class="dashboard-estate-row"/);
  assert.match(markup, /Recorded Deed|Verified documents/);
  assert.doesNotMatch(markup, /\b(?:JSON|payload|adapter|schema|endpoint|CLI|TypeScript|environment variable)\b/i);
  const journeyTab = runtime.caseJourneyRailDefinition().tabs.find((tab) => tab.id === "journey");
  const liveJourneyMarkup = journeyTab.render({ state: baseState({ activity: liveActivity }), bridge });
  assert.match(liveJourneyMarkup, /aria-label="Live Case Journey activity timeline"/);
  assert.match(liveJourneyMarkup, /Live estate update 1[\s\S]*Live estate update 9/, "all current activity events must remain visible in the rail");
  assert.match(liveJourneyMarkup, /Tifos · Property Appraiser ·/, "the timeline must show the recorded actor and source");
  assert.doesNotMatch(liveJourneyMarkup, />Intake<|>Property<|>Title &amp; Tax</, "the vertical activity timeline must not duplicate the horizontal lifecycle placeholders");
  assert.match(journeyTab.render({ state: baseState({ activity: [] }), bridge }), /No Case Journey updates yet/);
  const actionsTab = runtime.caseJourneyRailDefinition().tabs.find((tab) => tab.id === "actions");
  const documentsTab = runtime.caseJourneyRailDefinition().tabs.find((tab) => tab.id === "documents");
  for (const stoppedMarkup of [actionsTab.render({ state: moveOnState, bridge }), documentsTab.render({ state: moveOnState, bridge })]) {
    assert.match(stoppedMarkup, /data-move-on-stop[\s\S]*Move On[\s\S]*data-rail-action-id="review-next-estate"[\s\S]*Review Next Estate/);
    assert.doesNotMatch(stoppedMarkup, /open-doc-prep|open-document|open-queue|approve-packet|open-chatgpt-work/, "Move On rail tabs must not expose prohibited work controls");
  }
  const completeWithoutReadback = actionsTab.render({
    state: { ...state, docPrep: { ...state.docPrep, complete: true, packetVerified: false } },
    bridge,
  });
  assert.doesNotMatch(completeWithoutReadback, /Continue in ChatGPT Work/, "completion handoff must wait for verified packet readback");
  const verifiedActions = actionsTab.render({
    state: { ...state, docPrep: { ...state.docPrep, complete: true, packetVerified: true } },
    bridge,
  });
  assert.match(verifiedActions, /Continue in ChatGPT Work/);
  assert.match(verifiedActions, /data-rail-action-id="approve-packet"[\s\S]*Approve Current Packet/, "verified readback must expose an explicit human approval control");
  const approvedActions = actionsTab.render({
    state: { ...state, docPrep: { ...state.docPrep, complete: true, packetVerified: true, packetApproved: true } },
    bridge,
  });
  assert.match(approvedActions, /Current Packet Approved/);
  assert.doesNotMatch(approvedActions, /data-rail-action-id="approve-packet"/, "the exact current revision must not expose a duplicate approval action");

  const legacySource = read("src/legacy/app.js");
  const packetGateSource = legacySource.slice(
    legacySource.indexOf("function packetMatchesCurrentVerifiedRevision"),
    legacySource.indexOf("function publicShellEvents")
  );
  const packetClock = { now: Date.parse("2026-07-15T12:00:00.000Z") };
  const packetGateRuntime = vm.runInNewContext(`${packetGateSource}\n({ packetMatchesCurrentVerifiedRevision, packetArtifactIsUnexpired, requireCurrentUnexpiredPacket });`, {
    existingDocPrepFlowState: () => ({ generatedPackets: [{ artifactId: "packet-1", packetRevision: 2, readbackStatus: "verified" }] }),
    currentPacketRevision: () => 2,
    Date: {
      now: () => packetClock.now,
      parse: (value) => Date.parse(value),
    },
  });
  const activePacket = {
    artifact: { artifactId: "packet-1", expiresAt: "2026-07-15T12:05:00.000Z" },
    verification: { verified: true, readbackStatus: "verified" },
  };
  assert.equal(packetGateRuntime.packetMatchesCurrentVerifiedRevision({ id: "estate-001" }, "discovery", activePacket), true);
  assert.equal(packetGateRuntime.packetArtifactIsUnexpired(activePacket), true);
  assert.equal(packetGateRuntime.requireCurrentUnexpiredPacket({ id: "estate-001" }, "discovery", activePacket, "approval"), activePacket);
  packetClock.now = Date.parse("2026-07-15T12:05:01.000Z");
  assert.equal(packetGateRuntime.packetArtifactIsUnexpired(activePacket), false, "packet expiry must be recomputed against click-time clock state");
  assert.throws(
    () => packetGateRuntime.requireCurrentUnexpiredPacket({ id: "estate-001" }, "discovery", activePacket, "approval"),
    /packet link expired before approval/,
    "a control rendered before expiry must fail closed when it is clicked after expiry"
  );

  const addShellEventSource = legacySource.slice(legacySource.indexOf("function addShellEvent"), legacySource.indexOf("function recordActionError"));
  const eventState = { activeView: "dossiers", shellEvents: [] };
  const eventRuntime = vm.runInNewContext(`${addShellEventSource}\n({ addShellEvent });`, {
    state: eventState,
    selectedRow: () => ({ id: "estate-001" }),
    clientFacingCopy: (value) => String(value || ""),
    currentUserDisplayName: () => "Tifos",
    activeViewLabel: () => "Document Prep",
    renderShellPanels: () => {},
    setActivityOpen: () => {},
  });
  eventRuntime.addShellEvent("Report extracted", "The report passed readback.", "ready", false);
  eventRuntime.addShellEvent("Workspace refreshed", "Connection status was refreshed.", "review", false, { global: true, source: "HeirRight system" });
  assert.deepEqual(
    JSON.parse(JSON.stringify(eventState.shellEvents.map(({ estateId, actor, source, global }) => ({ estateId, actor, source, global })))),
    [
      { estateId: "", actor: "Tifos", source: "HeirRight system", global: true },
      { estateId: "estate-001", actor: "Tifos", source: "Document Prep", global: false },
    ],
    "shell events must bind to the exact selected estate unless explicitly marked global",
  );

  const publicShellEventsSource = legacySource.slice(legacySource.indexOf("function publicShellEvents"), legacySource.indexOf("function legacyPublicSnapshot"));
  const publicEventState = {
    shellEvents: [
      { estateId: "estate-001", actor: "Tifos", source: "Document Prep", title: "Selected estate event", copy: "Selected", tone: "ready", at: now },
      { estateId: "estate-002", actor: "Another user", source: "Document Prep", title: "Other estate event", copy: "Other", tone: "review", at: now - 1 },
      { estateId: "", global: true, actor: "HeirRight system", source: "Connection status", title: "Global event", copy: "Global", tone: "review", at: now - 2 },
      { estateId: "", global: false, actor: "Unknown", source: "Unknown", title: "Unbound event", copy: "Unbound", tone: "review", at: now - 3 },
    ],
  };
  const publicEventRuntime = vm.runInNewContext(`${publicShellEventsSource}\n({ publicShellEvents });`, {
    state: publicEventState,
    clientFacingEvent: (event) => ({ ...event }),
    cleanDisplayValue: (value) => String(value || ""),
  });
  const selectedActivity = JSON.parse(JSON.stringify(publicEventRuntime.publicShellEvents({ id: "estate-001" })));
  assert.deepEqual(selectedActivity.map((event) => event.title), ["Selected estate event", "Global event"], "another estate or an unbound event must never appear in the selected Case Journey");
  assert.deepEqual(selectedActivity.map((event) => [event.actor, event.source]), [["Tifos", "Document Prep"], ["HeirRight system", "Connection status"]]);
  assert.equal(runtime.uninstallLegacyBridge(), true);
}

assertStaticContracts();
await assertExecutableContracts();
console.log("s38 shell contracts passed");
