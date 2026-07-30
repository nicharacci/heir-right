import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuildBuild } from "esbuild";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);

async function importRailRuntime() {
  const result = await esbuildBuild({
    stdin: {
      contents: `
        export {
          backgroundElementsFor,
          containMobileRailKeydown,
          createBackgroundInertController,
          createRailActionFeedback,
          executeRailAction,
          focusAndConfirm,
          focusTargetAvailable,
          operatorRailError,
        } from "./src/features/shell/unified-rail-host.js";
      `,
      resolveDir: artifactRoot,
      sourcefile: "s38-unified-rail-runtime-entry.js",
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

class FakeElement {
  constructor(name, { inert = false, closest = null } = {}) {
    this.name = name;
    this.inert = inert;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map(inert ? [["inert", ""]] : []);
    this.closestResult = closest;
    this.hidden = false;
    this.disabled = false;
    this.isConnected = true;
  }

  append(...children) {
    children.forEach((child) => {
      child.parentElement = this;
      this.children.push(child);
    });
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  closest() {
    return this.closestResult;
  }

  getClientRects() {
    return this.hidden ? [] : [{}];
  }

  focus() {
    globalThis.document.activeElement = this;
  }
}

globalThis.Element = FakeElement;
globalThis.HTMLElement = FakeElement;
globalThis.document = {
  activeElement: null,
  documentElement: { dataset: {}, style: {}, classList: { toggle: () => {} } },
  body: { dataset: {} },
};
const railRuntime = await importRailRuntime();

{
  const visible = new FakeElement("visible-invoker");
  assert.equal(railRuntime.focusTargetAvailable(visible), true);
  assert.equal(railRuntime.focusAndConfirm(visible), true);
  assert.equal(globalThis.document.activeElement, visible);

  const hiddenRoute = new FakeElement("hidden-route");
  hiddenRoute.hidden = true;
  const staleInvoker = new FakeElement("stale-invoker");
  hiddenRoute.append(staleInvoker);
  assert.equal(railRuntime.focusTargetAvailable(staleInvoker), false, "a connected invoker inside a hidden route must not receive close focus");
  assert.equal(railRuntime.focusAndConfirm(staleInvoker), false);
}

{
  const message = { textContent: "" };
  const region = {
    hidden: true,
    dataset: {},
    querySelector: () => message,
  };
  const feedback = railRuntime.createRailActionFeedback(region);
  const attributes = new Map();
  const control = {
    disabled: false,
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    removeAttribute: (name) => attributes.delete(name),
  };
  const rejected = await railRuntime.executeRailAction({
    controls: [control],
    execute: async () => {
      throw new Error("secret endpoint and raw stack details");
    },
    onReject: () => feedback.show(railRuntime.operatorRailError("download-packet")),
  });
  assert.equal(rejected.ok, false);
  assert.equal(control.disabled, false, "a rejected action must restore its prior enabled state");
  assert.equal(attributes.has("aria-busy"), false, "a rejected action must always clear aria-busy");
  assert.equal(region.hidden, false, "a rejected action must expose the compact rail alert");
  assert.equal(region.dataset.visible, "true");
  assert.match(message.textContent, /current verified packet could not be downloaded/i);
  assert.doesNotMatch(message.textContent, /secret|endpoint|stack/i, "the visible operator alert must not expose raw rejection details");
  assert.match(railRuntime.operatorRailError("review-contact-candidate"), /IDI contact decision could not be saved/i);
  assert.match(railRuntime.operatorRailError("save-source-capture"), /source evidence could not be saved/i);

  feedback.clear();
  assert.equal(region.hidden, true, "retry and content changes must be able to clear the alert before another attempt");
  assert.equal(message.textContent, "");
  const retried = await railRuntime.executeRailAction({ controls: [control], execute: async () => "opened" });
  assert.deepEqual(retried, { ok: true, value: "opened" });
  assert.equal(control.disabled, false);
  assert.equal(attributes.has("aria-busy"), false);
}

{
  const body = new FakeElement("body");
  const workspace = new FakeElement("workspace");
  const priorInertOverlay = new FakeElement("prior-inert-overlay", { inert: true });
  const app = new FakeElement("app");
  const sidebar = new FakeElement("sidebar");
  const topbar = new FakeElement("topbar");
  const content = new FakeElement("content");
  const workbench = new FakeElement("workbench");
  const layer = new FakeElement("rail-layer");
  body.append(workspace, priorInertOverlay);
  workspace.append(sidebar, app);
  app.append(topbar, content);
  content.append(workbench, layer);

  assert.deepEqual(
    railRuntime.backgroundElementsFor(layer, body).map((element) => element.name),
    ["workbench", "topbar", "sidebar", "prior-inert-overlay"],
  );
  const inert = railRuntime.createBackgroundInertController(layer, body);
  assert.equal(inert.apply(), true);
  assert.equal(inert.active(), true);
  for (const element of [workbench, topbar, sidebar, priorInertOverlay]) assert.equal(element.inert, true);
  assert.equal(layer.inert, false, "the active rail layer must remain interactive");
  assert.equal(inert.restore(), true);
  assert.equal(workbench.inert, false);
  assert.equal(topbar.inert, false);
  assert.equal(sidebar.inert, false);
  assert.equal(priorInertOverlay.inert, true, "a pre-existing inert value must survive close, breakpoint changes, and destroy");
  assert.equal(priorInertOverlay.hasAttribute("inert"), true);
  assert.equal(inert.restore(), false, "restoration must be idempotent");
}

{
  const insideButton = new FakeElement("inside-button");
  const insideInput = new FakeElement("inside-input");
  insideInput.closestResult = insideInput;
  const outside = new FakeElement("background-shortcut");
  const rail = { contains: (target) => [insideButton, insideInput].includes(target) };
  let focusCount = 0;
  const eventFor = (target, key, overrides = {}) => ({
    target,
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; },
    ...overrides,
  });

  const escapedSlash = eventFor(outside, "/");
  assert.equal(railRuntime.containMobileRailKeydown(escapedSlash, rail, () => { focusCount += 1; }), true);
  assert.equal(escapedSlash.prevented, true);
  assert.equal(escapedSlash.stopped, true);
  assert.equal(focusCount, 1, "a background shortcut attempt must return focus to the mobile rail");

  const railSlash = eventFor(insideButton, "/");
  assert.equal(railRuntime.containMobileRailKeydown(railSlash, rail, () => { focusCount += 1; }), true);
  assert.equal(railSlash.prevented, true);
  assert.equal(railSlash.stopped, true, "the app-level slash shortcut must not escape an open mobile rail");

  const railCommand = eventFor(insideButton, "k", { metaKey: true });
  assert.equal(railRuntime.containMobileRailKeydown(railCommand, rail, () => { focusCount += 1; }), true);
  assert.equal(railCommand.stopped, true, "other app command shortcuts must remain inside the modal rail layer");

  const legacySectionShortcut = eventFor(insideButton, "ArrowDown", { altKey: true });
  assert.equal(railRuntime.containMobileRailKeydown(legacySectionShortcut, rail, () => { focusCount += 1; }), true);
  assert.equal(legacySectionShortcut.prevented, true);
  assert.equal(legacySectionShortcut.stopped, true, "Option+Arrow must not reach the legacy packet-section shortcut behind the mobile rail");

  const typedSlash = eventFor(insideInput, "/");
  assert.equal(railRuntime.containMobileRailKeydown(typedSlash, rail, () => { focusCount += 1; }), false);
  assert.equal(typedSlash.prevented, false, "text entry inside the rail must retain normal typing");
}

console.log("s38 unified rail runtime contracts passed");
