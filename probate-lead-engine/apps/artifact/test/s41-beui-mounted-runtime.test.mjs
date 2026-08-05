import assert from "node:assert/strict";
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
const cloudProcessSource = await readFile(new URL("../src/features/doc-prep/cloud-process.js", import.meta.url), "utf8");

assert.match(bridgeSource, /createBeuiBridgeAdapter/);
assert.match(bridgeSource, /createReactRuntimeLifecycle/);
assert.match(registerSource, /bridgeReady/);
assert.match(registerSource, /afterRender/);
assert.match(registerSource, /createRoot/);
assert.match(registerSource, /beuiRuntimeRoot/);
assert.equal((mountedAppSource.match(/<BeuiChassis/g) || []).length, 1, "one mounted BeUI chassis is authored");
assert.match(mountedAppSource, /<DocPrepSequence/);
assert.match(docPrepSource, /data-docprep-beui/);
assert.match(docPrepSource, /data-dynamic-island/);
assert.match(docPrepSource, /data-beui-component=\"table\"/);
assert.match(mountedAppSource, /setSelectedEstateIds\(\[estateId\]\)/);
assert.match(mountedAppSource, /selectedEstateIds=\{selectedEstateIds\}/);
assert.match(estatesSource, /estateIds: \[\.\.\.selected\]/);
assert.match(runtimeCss, /\.beui-mounted-runtime \.beui-tabs-root[\s\S]*border-radius/);
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
};

const adapter = bridgeModule.createBeuiBridgeAdapter(legacyBridge);
let updates = 0;
const unsubscribe = adapter.subscribe(() => updates++);
assert.equal(updates, 1, "the mounted adapter subscribes to the authorized bridge");
adapter.navigate("estates");
assert.deepEqual(calls.navigate, ["find-estates"], "route aliases use the real bridge navigate call");
adapter.dispatch("select-estate", { estateId: "estate-1" });
assert.deepEqual(calls.dispatch, [["select-estate", { estateId: "estate-1" }]], "commands use the real bridge dispatch call");
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
