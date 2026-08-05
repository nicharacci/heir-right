import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, transform } from "esbuild";

const testFile = fileURLToPath(import.meta.url);
const artifactRoot = fileURLToPath(new URL("..", import.meta.url));
const runtimeRoot = new URL("../src/features/beui-runtime/", import.meta.url);

const bridgeSource = await readFile(new URL("bridge-adapter.ts", runtimeRoot), "utf8");
const registerSource = await readFile(new URL("register.js", runtimeRoot), "utf8");
const mountedAppSource = await readFile(new URL("mounted-app.tsx", runtimeRoot), "utf8");
const docPrepSource = await readFile(new URL("../src/features/doc-prep-beui/doc-prep-sequence.tsx", import.meta.url), "utf8");
const estatesSource = await readFile(new URL("../src/features/beui-tabs/estates.tsx", import.meta.url), "utf8");
const runtimeCss = await readFile(new URL("runtime.css", runtimeRoot), "utf8");
const legacySource = await readFile(new URL("../src/legacy/app.js", import.meta.url), "utf8");
const s40Source = await readFile(new URL("../src/features/doc-prep/s40-doc-prep-view.js", import.meta.url), "utf8");
const s40Css = await readFile(new URL("../src/features/doc-prep/s40-doc-prep.css", import.meta.url), "utf8");
const cloudProcessSource = await readFile(new URL("../src/features/doc-prep/cloud-process.js", import.meta.url), "utf8");

assert.match(bridgeSource, /createBeuiBridgeAdapter/);
assert.match(bridgeSource, /dispatchFile/);
assert.match(bridgeSource, /createReactRuntimeLifecycle/);
assert.match(registerSource, /bridgeReady/);
assert.match(registerSource, /afterRender/);
assert.match(registerSource, /createRoot/);
assert.match(registerSource, /beuiRuntimeRoot/);
assert.match(registerSource, /getElementById\("dossiersView"\)/);
assert.match(registerSource, /unmountView\("dossiers"/);
assert.match(registerSource, /presentation: "legacy-docprep"/);
assert.match(registerSource, /queueMicrotask/);
assert.doesNotMatch(registerSource, /hideLegacyChildren/);
assert.doesNotMatch(registerSource, /workspace\.append\(runtimeElement\)/);
assert.equal((mountedAppSource.match(/<BeuiChassis/g) || []).length, 1, "one mounted BeUI chassis is authored");
assert.match(mountedAppSource, /legacy-docprep/);
assert.match(mountedAppSource, /beui-mounted-runtime-content/);
assert.match(mountedAppSource, /<DocPrepSequence/);
assert.match(docPrepSource, /data-docprep-beui/);
assert.match(docPrepSource, /data-dynamic-island/);
assert.match(docPrepSource, /data-beui-component=\"table\"/);
assert.match(mountedAppSource, /setSelectedEstateIds\(\[estateId\]\)/);
assert.match(mountedAppSource, /selectedEstateIds=\{selectedEstateIds\}/);
assert.match(mountedAppSource, /setInterval\(poll, 1500\)/, "active durable Doc Prep cases must refresh while work is in progress");
assert.match(mountedAppSource, /\["queued", "sourcing", "rendering"\]/, "polling must follow durable active states only");
assert.match(estatesSource, /estateIds: \[\.\.\.selected\]/);
assert.match(runtimeCss, /\.beui-mounted-runtime \.beui-tabs-root[\s\S]*border-radius/);
assert.match(runtimeCss, /\.beui-mounted-runtime-content/);
assert.doesNotMatch(runtimeCss, /#workspace\[data-beui-runtime/);
const spotlightSource = mountedAppSource.slice(mountedAppSource.indexOf("const spotlight"), mountedAppSource.indexOf("const status"));
assert.match(spotlightSource, /requestAnimationFrame/);
assert.match(spotlightSource, /scrollIntoView/);
assert.match(spotlightSource, /focus/);
assert.doesNotMatch(spotlightSource, /\.click\(|dispatch\(/);
assert.match(docPrepSource, /accept=\"\.pdf,application\/pdf\"/);
assert.doesNotMatch(docPrepSource, /application\/vnd\.openxmlformats|\.docx/);
assert.match(legacySource, /id === \"beui-import-estate-file\"/);
assert.match(legacySource, /await queueEstateFile\(file\)/);
assert.match(legacySource, /freeModelVerified/);
assert.match(legacySource, /reviewRequired/);
assert.match(legacySource, /persistCrmImports/);
assert(legacySource.includes("const caseReference = [capture?.probate?.caseNumber, capture?.probate?.docketNumber]"));
assert(legacySource.includes("...(caseReference ? { caseReference } : {})"));
assert.match(legacySource, /id === \"beui-docprep-action\"[\s\S]*requestCaseAction/);
assert.match(legacySource, /id === \"beui-docprep-export\"[\s\S]*exportVerifiedPdfToGoogleDrive/);
assert.match(legacySource, /dispatchFile:\s*\(command, payload, file\)/);
assert.match(legacySource, /id === \"select-estate\"[\s\S]*hydratePersistedDiscoveryFile\(row\)/);
assert.match(legacySource, /imported\.reviewRequired !== true/);
const hydratedDiscoverySource = legacySource.slice(
  legacySource.indexOf("async function hydratePersistedDiscoveryFile"),
  legacySource.indexOf("async function runFullDiscovery"),
);
assert.match(hydratedDiscoverySource, /response\.status === 404\) return state\.idiImports\[key\] \|\| null/);
assert.match(hydratedDiscoverySource, /finally \{[\s\S]*rerenderHydratedDocPrepSurface\(row\)/, "verified IDI hydration must repaint after every readback outcome");
const stoppedDiscoverySource = legacySource.slice(
  legacySource.indexOf("async function stopS40DocPrep"),
  legacySource.indexOf("async function ensureS40WorkflowStateReady"),
);
assert.match(stoppedDiscoverySource, /void Promise\.all\(stopped\.map\(\(row\) => hydratePersistedDiscoveryFile\(row\)\)\)/, "stopping must rehydrate the persisted IDI record before the route settles");
const dossiersScrollRule = s40Css.match(/\.app\[data-active-view="dossiers"\] #dossiersView \{([\s\S]*?)\n\}/)?.[1] || "";
assert.match(dossiersScrollRule, /height: auto/);
assert.match(dossiersScrollRule, /min-height: 100%/);
assert.match(dossiersScrollRule, /overflow: visible/);
assert.match(s40Css, /#workspace\[data-s38-shell="case-journey"\] \.app\[data-active-view="dossiers"\] \.content \{[\s\S]*display: block !important;[\s\S]*overflow-y: auto;[\s\S]*overflow-x: hidden;/, "Doc Prep must outrank the S38 shell clip and own page scrolling");
assert.match(s40Css, /#workspace\[data-s38-shell="case-journey"\] \.app\[data-active-view="dossiers"\] \.workbench \{[\s\S]*height: auto;[\s\S]*min-height: 100%;[\s\S]*overflow: visible;/, "the shell workbench must expand instead of clipping Doc Prep");
assert.match(s40Css, /#workspace\[data-s38-shell="case-journey"\] \.app\[data-active-view="dossiers"\] #dossiersView \{[\s\S]*height: auto;[\s\S]*min-height: 100%;[\s\S]*overflow: visible;/, "the active Doc Prep host must remain content-sized");
assert.match(s40Css, /\.s40-docprep \{[\s\S]*grid-template-rows: auto auto auto;[\s\S]*min-height: auto;/);
assert.match(s40Css, /\.s40-workbench \{[\s\S]*min-height: clamp\(32rem, 68vh, 52rem\);[\s\S]*overflow: visible;/);
assert.match(s40Css, /\.s40-artifact-surface \{[\s\S]*grid-template-rows: auto minmax\(28rem, 70vh\) auto;[\s\S]*min-height: 28rem;/);
assert.match(s40Css, /\.s40-preview-viewport \{[\s\S]*overflow-y: auto;/);
assert.match(s40Source, /data-s40-idi-file data-estate-id=/);
assert.match(s40Source, /bridge\.dispatchFile\(command, payload, file\)/);
assert.match(cloudProcessSource, /contentType === \"application\/pdf\"/);
assert.match(cloudProcessSource, /readbackStatus === \"verified\"/);
assert.match(cloudProcessSource, /operatorIntent: \"export_verified_pdfs_to_google_drive\"/);
assert(cloudProcessSource.includes("const caseReference = asDisplayText(estate.caseReference).slice(0, 160);"));
assert.match(registerSource, /MountedBeuiApp/);

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
assert.equal(updates, 1, "the mounted adapter subscribes to the authorized bridge");
adapter.navigate("estates");
assert.deepEqual(calls.navigate, ["find-estates"], "route aliases use the real bridge navigate call");
adapter.dispatch("select-estate", { estateId: "estate-1" });
assert.deepEqual(calls.dispatch, [["select-estate", { estateId: "estate-1" }]], "commands use the real bridge dispatch call");
const idiFile = new File(["%PDF-1.7\nIDI"], "Michelet.pdf", { type: "application/pdf" });
adapter.dispatchFile("s40-upload-idi-report", { estateId: "estate-1" }, idiFile);
assert.equal(calls.dispatch[1][0], "s40-upload-idi-report", "file commands keep their legacy command identity");
assert.strictEqual(calls.dispatch[1][1].file, idiFile, "the real File object crosses the mounted bridge unchanged");
unsubscribe();
const updatesBeforeUnsubscribe = updates;
for (const listener of listeners) listener(state);
assert.equal(updates, updatesBeforeUnsubscribe, "unsubscribe removes the mounted state listener");

let rootCreates = 0;
let rootUnmounts = 0;
let renders = 0;
const lifecycle = bridgeModule.createReactRuntimeLifecycle({
  createRoot: () => {
    rootCreates += 1;
    return {
      render: () => {
        renders += 1;
      },
      unmount: () => {
        rootUnmounts += 1;
      },
    };
  },
  render: (root, props) => root.render(props),
});
const element = {};
lifecycle.mount(element, { adapter });
lifecycle.mount(element, { adapter });
assert.equal(rootCreates, 1, "one React root is retained for the mounted chassis");
assert.equal(renders, 2, "the existing root receives lifecycle updates");
assert.equal(lifecycle.isMounted(), true);
lifecycle.unmount();
assert.equal(rootUnmounts, 1);
assert.equal(lifecycle.isMounted(), false);

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

console.log("S41 mounted runtime contract: 6 assertions passed");
