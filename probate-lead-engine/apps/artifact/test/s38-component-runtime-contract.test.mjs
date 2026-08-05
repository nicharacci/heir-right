import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuildBuild } from "esbuild";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const repoRoot = path.resolve(artifactRoot, "../..");
const sourceRoot = path.join(artifactRoot, "src");
const distRoot = path.join(artifactRoot, "dist");
const runtimeFeatureRoot = path.join(sourceRoot, "features", "__runtime_contract__");
const runtimeFeaturePath = path.join(runtimeFeatureRoot, "register.js");

function read(relativePath) {
  return fs.readFileSync(path.join(artifactRoot, relativePath), "utf8");
}

function withoutExpectedConsoleError(action) {
  const original = console.error;
  console.error = () => {};
  try {
    return action();
  } finally {
    console.error = original;
  }
}

function runBuild(nodeEnv = "development") {
  execFileSync(process.execPath, ["build.js"], {
    cwd: artifactRoot,
    env: { ...process.env, NODE_ENV: nodeEnv },
    stdio: "pipe",
  });
}

function readTextTree(directory) {
  if (!fs.existsSync(directory)) return "";
  return fs.readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return readTextTree(target);
      return /\.(?:css|html|js|json|map|mjs)$/.test(entry.name) ? fs.readFileSync(target, "utf8") : "";
    })
    .join("\n");
}

function workspaceManifests(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", ".git", ".turbo"].includes(entry.name)) return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return workspaceManifests(target);
    return entry.name === "package.json" ? [target] : [];
  });
}

function fingerprint() {
  const files = [
    "index.html",
    "assets/app.js",
    "assets/app.css",
    "assets/feature-manifest.json",
    "assets/webawesome/manifest.json",
  ];
  return Object.fromEntries(files.map((relativePath) => {
    const contents = fs.readFileSync(path.join(distRoot, relativePath));
    return [relativePath, createHash("sha256").update(contents).digest("hex")];
  }));
}

async function importRuntime() {
  const result = await esbuildBuild({
    entryPoints: [path.join(sourceRoot, "core", "feature-registry.js")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    write: false,
    logLevel: "silent",
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${Date.now()}`);
}

function contrastRatio(first, second) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/.{2}/g).map((value) => Number.parseInt(value, 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
  };
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

function token(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(match, `missing color token --${name}`);
  return match[1];
}

function assertContrastContract() {
  const css = read("src/styles/tokens.css");
  const [dark, creamAndRest] = css.split(':root[data-theme="cream"]');
  const cream = creamAndRest.split("@media")[0];
  for (const [mode, block] of [["dark", dark], ["cream", cream]]) {
    const surface = token(block, "hr-surface");
    const canvas = token(block, "hr-canvas");
    for (const role of ["hr-text", "hr-text-muted", "hr-text-subtle"]) {
      assert.ok(contrastRatio(token(block, role), surface) >= 4.5, `${mode} ${role} must meet 4.5:1 on a surface`);
      assert.ok(contrastRatio(token(block, role), canvas) >= 4.5, `${mode} ${role} must meet 4.5:1 on the canvas`);
    }
    assert.ok(
      contrastRatio(token(block, "hr-control-boundary"), surface) >= 3,
      `${mode} control boundaries must meet 3:1 against their surface`,
    );
    assert.ok(contrastRatio(token(block, "hr-focus"), surface) >= 3, `${mode} focus rings must meet 3:1`);
  }
}

function assertStaticContracts() {
  const packageJson = JSON.parse(read("package.json"));
  const sourceIndex = read("src/index.html");
  const webAwesomeSource = read("src/ui/webawesome-free.js");
  const legacySource = read("src/legacy/app.js");
  const compatSource = read("src/styles/compat.css");
  const serverSource = read("server.js");
  const lock = fs.readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");
  const ossPolicy = fs.readFileSync(path.join(repoRoot, "docs", "oss-ui-dependencies.md"), "utf8");
  const sourceText = readTextTree(sourceRoot);
  const dist = [
    fs.readFileSync(path.join(distRoot, "index.html"), "utf8"),
    fs.readFileSync(path.join(distRoot, "assets", "app.js"), "utf8"),
    fs.readFileSync(path.join(distRoot, "assets", "app.css"), "utf8"),
  ].join("\n");

  assert.match(sourceIndex, /<main id="workspace"[^>]*\sinert(?:\s|>)/, "workspace must fail closed before authorization");
  assert.ok(sourceIndex.indexOf("<noscript>") < sourceIndex.indexOf('src="/assets/app.js"'), "the no-script auth fallback must precede application code");
  assert.match(sourceIndex, /href="\/assets\/app\.css"/);
  assert.match(sourceIndex, /src="\/assets\/app\.js"/);
  assert.doesNotMatch(sourceIndex, /<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/i, "the HTML shell must not contain executable inline JavaScript");

  assert.equal(packageJson.dependencies["@awesome.me/webawesome"], "3.10.0");
  assert.equal(packageJson.dependencies["ag-grid-community"], "36.0.0");
  assert.equal(packageJson.devDependencies.esbuild, "0.28.1");
  assert.equal(packageJson.dependencies["ag-grid-enterprise"], undefined);
  const manifests = workspaceManifests(repoRoot);
  assert.ok(manifests.length >= 3, "the Enterprise boundary must inspect every workspace manifest");
  manifests.forEach((manifest) => {
    assert.doesNotMatch(fs.readFileSync(manifest, "utf8"), /ag-grid-enterprise/i, `${path.relative(repoRoot, manifest)} must not declare AG Grid Enterprise`);
  });
  assert.doesNotMatch(lock, /ag-grid-enterprise/i);
  assert.doesNotMatch(sourceText, /ag-grid-enterprise/i, "application source must not import AG Grid Enterprise");
  assert.doesNotMatch(
    dist,
    /(?:AllEnterpriseModule|EnterpriseCoreModule|LicenseManager|setLicenseKey)/,
    "the browser bundle must not contain Enterprise modules or licensing APIs",
  );
  const allowedFreeComponents = new Set([
    "badge", "button", "callout", "checkbox", "details", "dialog", "divider", "drawer", "dropdown",
    "dropdown-item", "input", "option", "progress-bar", "radio", "radio-group", "select", "spinner", "switch",
    "tab", "tab-group", "tab-panel", "tag", "tooltip",
  ]);
  const componentImports = [...webAwesomeSource.matchAll(/dist\/components\/([^/]+)\/([^"']+\.js)/g)]
    .filter((match) => !(match[1] === "icon" && match[2] === "library.js"))
    .map((match) => match[1]);
  assert.ok(componentImports.length > 0, "Web Awesome Free components must be imported explicitly");
  componentImports.forEach((name) => assert.ok(allowedFreeComponents.has(name), `forbidden Web Awesome component import: ${name}`));
  assert.doesNotMatch(webAwesomeSource, /dist\/components\/(?:file-input|combobox|date-input|date-picker|toast|patterns|data-viz)/i);
  assert.match(webAwesomeSource, /unregisterIconLibrary\("default"\)/);
  assert.match(webAwesomeSource, /setBasePath\(basePath\)/);
  assert.match(webAwesomeSource, /setIconPath\(`\$\{basePath\}\/icons`\)/);
  assert.match(serverSource, /staticContentTypes/);
  assert.match(serverSource, /"x-content-type-options": "nosniff"/i);
  assert.match(ossPolicy, /@awesome\.me\/webawesome` \| `3\.10\.0` \| MIT/);
  assert.match(ossPolicy, /ag-grid-community` \| `36\.0\.0` \| MIT/);
  assert.match(ossPolicy, /esbuild` \| `0\.28\.1` \| MIT/);
  assert.ok(fs.existsSync(path.join(distRoot, "assets", "webawesome", "LICENSE.md")), "the shipped Web Awesome license must be local");
  assert.doesNotMatch(dist, /https?:\/\/(?:ka-[fp]\.fontawesome\.com|ka-f\.webawesome\.com|cdn\.jsdelivr\.net|unpkg\.com|fonts\.bunny\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)/i);

  assert.match(legacySource, /const gated = blocked \|\| !authorizedWorkspaceReady/);
  assert.match(legacySource, /function failAuthorizedWorkspace[\s\S]*workspaceBooted = false;[\s\S]*uninstallLegacyBridge\(\)/);
  assert.doesNotMatch(legacySource, /await Promise\.race\(\[runRestore/, "run restoration must not hold the authenticated route behind the startup gate");
  assert.match(
    legacySource,
    /prepareAuthorizedWorkspace\(\);\s+completeAuthorizedWorkspace\(\);\s+\/\/ The authenticated route is ready[\s\S]*?void loadRun\(\)\.then\(\(\) => \{\s+if \(workspaceBooted\) renderCurrentLoopView\(\);/,
    "the requested route must open before the latest run refresh completes",
  );
  assert.match(legacySource, /Object\.prototype\.hasOwnProperty\.call\(payload, "estateId"\)/);
  assert.match(legacySource, /if \(!row\) throw new Error\(`Estate is unavailable:/);
  assert.match(legacySource, /const allowedExportRoutes = new Set\(\["queue", "pdf", "google", "podio", "podio-test", "both"\]\)/);
  assert.match(legacySource, /throw new Error\(`Unsupported HeirRight command:/);
  assert.match(legacySource, /if \(!productViews\.includes\(view\)\) throw new Error\(`Unsupported HeirRight view:/);
  assert.doesNotMatch(legacySource, /legacyNotificationSuppressed/, "live Discovery stages must reach feature subscribers");
  assert.match(legacySource, /\["light", "cream", "dark", "system"\]\.includes\(theme\)/);
  const publicSnapshot = legacySource.slice(legacySource.indexOf("function legacyPublicSnapshot"), legacySource.indexOf("function notifyLegacySubscribers"));
  assert.doesNotMatch(publicSnapshot, /idiCoreUserApiKey|sourceCaptures|rawReport|reportText|serverPayload|accessToken|refreshToken/i);
  assert.match(publicSnapshot, /freezePublicValue\(/, "legacy snapshots must be deeply frozen");
  assert.match(
    compatSource,
    /body\[data-theme\] \.search-control,[\s\S]*body\[data-theme\] \.discovery-notes[\s\S]*border-color: var\(--hr-control-boundary\)/,
    "real form and search controls must use the 3:1 boundary role",
  );

  for (const privateRuntimeFile of ["fresh-lead-batch.json", "daily-run.json", "latest-run.json", "qualification-review.json", "api/connections/status"]) {
    assert.equal(fs.existsSync(path.join(distRoot, privateRuntimeFile)), false, `${privateRuntimeFile} must be served only after API authentication`);
  }
  assertContrastContract();
}

async function assertExecutableRuntime() {
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
  const runtimeModule = await importRuntime();
  const {
    installLegacyBridge,
    registerFeature,
    renderView,
    runCommand,
    subscribeFeatures,
    uninstallLegacyBridge,
  } = runtimeModule;
  const { runtime } = runtimeModule;

  assert.equal(renderView("missing"), null);
  await assert.rejects(runCommand("missing", {}), /before authorized workspace activation/);
  assert.throws(() => runtime.rails.activate("case"), /before authorized workspace activation/);

  let rejectedSubscriberCalls = 0;
  assert.throws(() => subscribeFeatures(() => {
    rejectedSubscriberCalls += 1;
    throw new Error("initial feature subscriber failure");
  }), /initial feature subscriber failure/);
  let rejectedRailSubscriberCalls = 0;
  assert.throws(() => runtime.rails.subscribe(() => {
    rejectedRailSubscriberCalls += 1;
    throw new Error("initial rail subscriber failure");
  }), /initial rail subscriber failure/);

  assert.throws(() => registerFeature({
    id: "duplicate-inside-feature",
    views: [
      { id: "duplicate-view", render: () => null },
      { id: "duplicate-view", render: () => null },
    ],
  }), /duplicate view ids/);

  const releaseSharedOwner = withoutExpectedConsoleError(() => registerFeature({
    id: "shared-owner",
    views: [{ id: "shared-view", render: () => null }],
    commands: [{ id: "shared-command", run: () => null }],
  }));
  assert.throws(() => registerFeature({
    id: "shared-contender",
    views: [{ id: "shared-view", render: () => null }],
  }), /View already registered/);
  assert.throws(() => registerFeature({
    id: "shared-command-contender",
    commands: [{ id: "shared-command", run: () => null }],
  }), /Command already registered/);
  assert.equal(releaseSharedOwner(), true);

  let featureEvents = 0;
  const stopFeatures = subscribeFeatures(() => { featureEvents += 1; });
  let fragileFeatureEvents = 0;
  const stopFragileFeatures = subscribeFeatures(() => {
    fragileFeatureEvents += 1;
    if (fragileFeatureEvents === 2) throw new Error("expected isolated feature listener failure");
  });
  let survivorFeatureEvents = 0;
  const stopSurvivorFeatures = subscribeFeatures(() => { survivorFeatureEvents += 1; });
  let fragileRailEvents = 0;
  const stopFragileRails = runtime.rails.subscribe(() => {
    fragileRailEvents += 1;
    if (fragileRailEvents === 2) throw new Error("expected isolated rail listener failure");
  });
  let survivorRailEvents = 0;
  const stopSurvivorRails = runtime.rails.subscribe(() => { survivorRailEvents += 1; });
  let survivorThemeEvents = 0;
  let fragileThemeEvents = 0;
  const stopFragileTheme = runtime.theme.subscribe(() => {
    fragileThemeEvents += 1;
    if (fragileThemeEvents > 1) throw new Error("expected isolated theme listener failure");
  });
  const stopSurvivorTheme = runtime.theme.subscribe(() => { survivorThemeEvents += 1; });

  let bridgeReady = 0;
  let bridgeLost = 0;
  const teardown = withoutExpectedConsoleError(() => registerFeature({
    id: "runtime-contract",
    views: [{ id: "runtime-contract-view", render: ({ bridge }) => bridge.readState().estate.id }],
    commands: [{ id: "runtime-contract-command", run: (payload, bridge) => bridge.dispatch("select-estate", payload) }],
    rails: [{
      id: "runtime-contract-rail",
      label: "Runtime contract",
      minWidth: 320,
      maxWidth: 480,
      defaultWidth: 392,
      tabs: [{
        id: "timeline",
        label: "Timeline",
        render: ({ estateId }) => `timeline:${estateId}`,
        actions: { review: (payload) => `review:${payload.estateId}` },
      }, { id: "details", label: "Details" }],
    }],
    lifecycle: {
      bridgeReady: () => { bridgeReady += 1; },
      bridgeLost: () => { bridgeLost += 1; },
    },
  }));
  assert.throws(() => registerFeature({ id: "runtime-contract" }), /already registered/);
  assert.equal(rejectedSubscriberCalls, 1, "a rejected feature subscriber must not leak");
  assert.equal(rejectedRailSubscriberCalls, 1, "a rejected rail subscriber must not leak");
  assert.ok(survivorFeatureEvents > 1, "a failing feature subscriber must not suppress healthy listeners");
  assert.ok(survivorRailEvents > 1, "a failing rail subscriber must not suppress healthy listeners");

  let preBridgeUnmountCalls = 0;
  const preBridgeTeardown = registerFeature({
    id: "pre-bridge-teardown",
    lifecycle: { unmount: () => { preBridgeUnmountCalls += 1; } },
  });
  assert.equal(preBridgeTeardown(), true);
  assert.equal(preBridgeUnmountCalls, 0, "feature lifecycle work must remain disabled before bridge authorization");

  const calls = [];
  const bridge = {
    readState: () => Object.freeze({ estate: Object.freeze({ id: "estate-1" }) }),
    subscribe: () => () => {},
    dispatch: async (command, payload) => { calls.push({ command, payload }); return "dispatched"; },
    selectedEstateId: () => "estate-1",
    navigate: (view) => view,
    emit: () => {},
    escapeHtml: (value) => String(value),
    icon: (name) => `<svg data-icon="${name}"></svg>`,
  };

  const installed = installLegacyBridge(bridge);
  assert.ok(Object.isFrozen(installed));
  assert.deepEqual(Object.keys(installed).sort(), ["dispatch", "emit", "escapeHtml", "icon", "navigate", "readState", "selectedEstateId", "subscribe"]);
  assert.equal(bridgeReady, 1);
  assert.equal(renderView("runtime-contract-view"), "estate-1");
  assert.equal(await runCommand("runtime-contract-command", { estateId: "estate-1" }), "dispatched");
  assert.deepEqual(calls, [{ command: "select-estate", payload: { estateId: "estate-1" } }]);

  const failingTeardown = registerFeature({
    id: "failing-teardown",
    views: [{ id: "failing-teardown-view", render: () => null }],
    commands: [{ id: "failing-teardown-command", run: () => null }],
    rails: [{ id: "failing-teardown-rail", tabs: [{ id: "main", label: "Main" }] }],
    lifecycle: { unmount: () => { throw new Error("expected unmount failure"); } },
  });
  assert.throws(() => failingTeardown(), /expected unmount failure/);
  const replacementTeardown = registerFeature({
    id: "failing-teardown",
    views: [{ id: "failing-teardown-view", render: () => null }],
    commands: [{ id: "failing-teardown-command", run: () => null }],
    rails: [{ id: "failing-teardown-rail", tabs: [{ id: "main", label: "Main" }] }],
  });
  assert.equal(replacementTeardown(), true, "failed lifecycle cleanup must release every owned ID");

  runtime.rails.activate("runtime-contract-rail", { width: 900 });
  const rail = runtime.rails.snapshot();
  assert.ok(Object.isFrozen(rail));
  assert.ok(Object.isFrozen(rail.active));
  assert.ok(Object.isFrozen(rail.active.tabs));
  assert.equal(rail.open, true);
  assert.equal(rail.width, 480);
  assert.equal(runtime.rails.render({ estateId: "estate-1" }), "timeline:estate-1");
  assert.equal(await runtime.rails.runAction("review", { estateId: "estate-1" }), "review:estate-1");
  runtime.rails.selectTab("details");
  runtime.rails.setOpen(false);
  runtime.rails.setOpen(true);
  const persistedDesktopRail = JSON.parse(storage.get("heirright:contextual-rail:v1"));
  assert.deepEqual(
    { activeId: persistedDesktopRail.activeId, activeTab: persistedDesktopRail.activeTab, open: persistedDesktopRail.open, width: persistedDesktopRail.width },
    { activeId: "runtime-contract-rail", activeTab: "details", open: true, width: 480 },
  );
  runtime.rails.selectTab("timeline");
  const persistedRail = storage.get("heirright:contextual-rail:v1");
  runtime.rails.setMobileSheet(true);
  assert.equal(runtime.rails.snapshot().mobileSheet, true);
  assert.equal(storage.get("heirright:contextual-rail:v1"), persistedRail, "mobile sheet state must not persist over desktop geometry");

  const releaseSecondRail = runtime.rails.register({
    id: "second-runtime-rail",
    tabs: [{ id: "summary", label: "Summary" }],
  });
  runtime.rails.activate("second-runtime-rail");
  assert.equal(runtime.rails.snapshot().activeId, "second-runtime-rail", "only one contextual rail may be active");
  assert.throws(() => runtime.rails.register({ id: "second-runtime-rail", tabs: [{ id: "x", label: "X" }] }), /already registered/);
  assert.equal(releaseSecondRail(), true);

  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => runtime.theme.set("cream"));
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(runtime.theme.snapshot().resolved, "cream");
  assert.equal(storage.get("heirright:theme"), "cream");
  assert.equal(document.documentElement.dataset.theme, "cream");
  assert.ok(rootClasses.has("wa-light"));
  assert.equal(survivorThemeEvents, 2, "one failing theme subscriber must not suppress healthy subscribers");

  assert.equal(uninstallLegacyBridge(), true);
  assert.equal(bridgeLost, 1);
  assert.throws(() => runtime.rails.setOpen(true), /before authorized workspace activation/);
  assert.equal(teardown(), true);
  assert.equal(runtime.features.snapshot().features.length, 0);
  assert.ok(featureEvents >= 4);
  stopFeatures();
  stopFragileFeatures();
  stopSurvivorFeatures();
  stopFragileRails();
  stopSurvivorRails();
  stopFragileTheme();
  stopSurvivorTheme();
  delete globalThis.document;
  delete globalThis.window;
}

let baseline;
try {
  runBuild();
  baseline = fingerprint();
  runBuild();
  assert.deepEqual(fingerprint(), baseline, "two clean builds must emit byte-identical entry assets and manifests");

  fs.mkdirSync(runtimeFeatureRoot, { recursive: true });
  fs.writeFileSync(runtimeFeaturePath, [
    'import { registerFeature } from "../../core/feature-registry.js";',
    'registerFeature({ id: "runtime-discovery-contract", views: [], commands: [], rails: [] });',
    "",
  ].join("\n"));
  runBuild();
  const manifest = JSON.parse(fs.readFileSync(path.join(distRoot, "assets", "feature-manifest.json"), "utf8"));
  assert.ok(manifest.features.includes("features/__runtime_contract__/register.js"), "new register.js modules must be discovered without build configuration edits");
} finally {
  fs.rmSync(runtimeFeatureRoot, { recursive: true, force: true });
  const featureRoot = path.join(sourceRoot, "features");
  if (fs.existsSync(featureRoot) && fs.readdirSync(featureRoot).length === 0) fs.rmdirSync(featureRoot);
  runBuild();
}

assert.deepEqual(fingerprint(), baseline, "removing an auto-discovered feature must restore the prior deterministic build");
assertStaticContracts();
await assertExecutableRuntime();

console.log("s38 component runtime contracts passed");
