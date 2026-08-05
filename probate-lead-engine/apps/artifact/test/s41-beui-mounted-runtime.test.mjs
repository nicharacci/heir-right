import assert from "node:assert/strict";
import { File } from "node:buffer";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, transform } from "esbuild";

const artifactRoot = fileURLToPath(new URL("..", import.meta.url));
const runtimeRoot = new URL("../src/features/beui-runtime/", import.meta.url);
const buildSource = await readFile(new URL("../build.js", import.meta.url), "utf8");
const bridgeSource = await readFile(new URL("bridge-adapter.ts", runtimeRoot), "utf8");
const registerSource = await readFile(new URL("register.js", runtimeRoot), "utf8");
const railSource = await readFile(new URL("doc-prep-rails.tsx", runtimeRoot), "utf8");
const operationalRails = await readFile(new URL("operational-grid-rails.tsx", runtimeRoot), "utf8");
const runtimeCss = await readFile(new URL("runtime.css", runtimeRoot), "utf8");
const legacySource = await readFile(new URL("../src/legacy/app.js", import.meta.url), "utf8");
const s40Source = await readFile(new URL("../src/features/doc-prep/s40-doc-prep-view.js", import.meta.url), "utf8");
const s40Css = await readFile(new URL("../src/features/doc-prep/s40-doc-prep.css", import.meta.url), "utf8");
const cloudProcessSource = await readFile(new URL("../src/features/doc-prep/cloud-process.js", import.meta.url), "utf8");

assert.match(bridgeSource, /createBeuiBridgeAdapter/);
assert.match(bridgeSource, /dispatchFile/);
assert.doesNotMatch(bridgeSource, /createReactRuntimeLifecycle/);
assert.doesNotMatch(buildSource, /excludedFeatureRegisters/);
assert.match(buildSource, /filter\(isPublishedFeatureRegister\)/);
assert.match(registerSource, /bridgeReady/);
assert.match(registerSource, /afterRender/);
assert.match(registerSource, /createRoot/);
assert.match(registerSource, /\[data-s40-beui-queue\], \[data-s40-beui-batch-progress\], \[data-beui-rail\]/);
assert.match(registerSource, /renderBeuiRail/);
assert.match(registerSource, /heirright:beui-rail-render/);
assert.match(registerSource, /queueMicrotask/);
assert.doesNotMatch(registerSource, /MountedBeuiApp|replaceChildren|unmountView|getElementById\("dossiersView"\)/);
assert.match(railSource, /Table, type TableColumn/);
assert.match(railSource, /AnimatedBadge/);
assert.match(railSource, /s40-docprep-selection/);
assert.match(railSource, /s40-stop-docprep/);
assert.match(operationalRails, /renderOperationalGridRail/);
assert.match(operationalRails, /case "estates"[\s\S]*case "queue"[\s\S]*case "export"[\s\S]*case "admin-audit"[\s\S]*case "shell-queue"/);
assert.match(runtimeCss, /\.s40-beui-rail/);
assert.match(runtimeCss, /\.s40-beui-batch-rail > header[\s\S]*padding: 1\.5125rem 1rem/);
assert.match(runtimeCss, /prefers-reduced-motion/);
assert.doesNotMatch(runtimeCss, /\.beui-mounted-runtime/);
assert.match(s40Source, /data-s40-beui-queue/);
assert.match(s40Source, /data-s40-beui-batch-progress/);
assert.match(s40Source, /batchIsRunning\(selected\)/);
assert.match(s40Source, /rows\.length > 1[\s\S]*workflowBatchId/);
assert.match(s40Source, /renderArtifactRail\(current, bridge, rows, snapshot\)/);
assert.doesNotMatch(s40Source, /data-community-grid="docprep"|createCommunityGrid|setGridQuickFilter/);
assert.match(s40Css, /@media \(min-width: 701px\)[\s\S]*width: calc\(100% \+ var\(--s40-docprep-gutter\)\)/);
assert.match(s40Css, /\.s40-dynamic-island[\s\S]*width: 100%[\s\S]*padding: 1\.5125rem 1rem/);
assert.equal(existsSync(new URL("mounted-app.tsx", runtimeRoot)), false, "the obsolete full-page BeUI chassis is removed");
assert.equal(existsSync(new URL("../src/features/doc-prep-beui/doc-prep-sequence.tsx", import.meta.url)), false, "the obsolete full-page Doc Prep surface is removed");
assert.equal(existsSync(new URL("../src/styles/doc-prep-beui.css", import.meta.url)), false, "the obsolete full-page Doc Prep stylesheet is removed");
assert.match(legacySource, /id === "s40-stop-docprep"/);
assert.match(legacySource, /workflowBatchId: workflow\.batchId/);
assert.match(legacySource, /const batchId = ids\.length > 1/);
assert.match(legacySource, /id === "select-estate"[\s\S]*hydratePersistedDiscoveryFile\(row\)/);
assert.match(legacySource, /dispatchFile:\s*\(command, payload, file\)/);
assert.match(cloudProcessSource, /contentType === "application\/pdf"/);
assert.match(cloudProcessSource, /readbackStatus === "verified"/);
assert.match(cloudProcessSource, /operatorIntent: "export_verified_pdfs_to_google_drive"/);

const compiledBridge = await transform(bridgeSource, {
  loader: "ts",
  format: "esm",
  target: "es2020",
  sourcefile: "bridge-adapter.ts",
});
const bridgeModule = await import(
  `data:text/javascript;base64,${Buffer.from(compiledBridge.code).toString("base64")}`,
);

const state = { activeView: "manage-estates" };
const listeners = new Set();
const calls = { navigate: [], dispatch: [] };
const legacyBridge = {
  readState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  },
  navigate(route) {
    calls.navigate.push(route);
    state.activeView = route;
    for (const listener of listeners) listener(state);
    return state;
  },
  dispatch(command, payload) {
    calls.dispatch.push([command, payload]);
    return { ok: true };
  },
  dispatchFile(command, payload, file) {
    calls.dispatch.push([command, { ...payload, file }]);
    return { ok: true };
  },
};

const adapter = bridgeModule.createBeuiBridgeAdapter(legacyBridge);
let updates = 0;
const unsubscribe = adapter.subscribe(() => updates++);
assert.equal(updates, 1, "the narrow rail subscribes to the authorized bridge");
adapter.navigate("estates");
assert.deepEqual(calls.navigate, ["find-estates"], "route aliases use the real bridge navigate call");
adapter.dispatch("select-estate", { estateId: "estate-1" });
assert.deepEqual(calls.dispatch, [["select-estate", { estateId: "estate-1" }]], "queue selection uses the real bridge dispatch call");
const idiFile = new File(["%PDF-1.7\nIDI"], "Michelet.pdf", { type: "application/pdf" });
adapter.dispatchFile("s40-upload-idi-report", { estateId: "estate-1" }, idiFile);
assert.equal(calls.dispatch[1][0], "s40-upload-idi-report", "file commands retain their S40 identity");
assert.strictEqual(calls.dispatch[1][1].file, idiFile, "the real File object crosses the rail bridge unchanged");
unsubscribe();
const updatesBeforeUnsubscribe = updates;
for (const listener of listeners) listener(state);
assert.equal(updates, updatesBeforeUnsubscribe, "unsubscribe removes the rail state listener");

await build({
  entryPoints: [new URL("../src/features/beui-runtime/register.js", import.meta.url).pathname],
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  absWorkingDir: artifactRoot,
  tsconfig: `${artifactRoot}/tsconfig.ui.json`,
  loader: { ".css": "empty" },
});

console.log("S41 BeUI rail runtime contract passed.");
