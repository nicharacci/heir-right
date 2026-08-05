import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { registerFeature, unmountView } from "../../core/feature-registry.js";
import { MountedBeuiApp } from "./mounted-app.tsx";
import {
  createBeuiBridgeAdapter,
  createReactRuntimeLifecycle,
  normalizeBeuiRoute,
} from "./bridge-adapter.ts";
import "./runtime.css";
import "../../styles/beui-tabs.css";
import "../../styles/doc-prep-beui.css";

const runtimeState = {
  lifecycle: null,
  element: null,
  mount: null,
  syncToken: 0,
};

function isDocPrepRoute(bridge) {
  return normalizeBeuiRoute(bridge.readState?.().activeView) === "dossiers";
}

function removeRuntimeElement() {
  runtimeState.element?.remove();
  runtimeState.mount?.removeAttribute("data-beui-runtime");
  runtimeState.element = null;
  runtimeState.mount = null;
}

function mountRuntime(bridge) {
  if (runtimeState.lifecycle?.isMounted()) return;
  const mount = document.getElementById("dossiersView");
  if (!mount) return;

  const runtimeElement = document.createElement("div");
  runtimeElement.className = "beui-mounted-runtime";
  runtimeElement.dataset.beuiRuntimeRoot = "true";
  unmountView("dossiers", { mount, bridge });
  mount.replaceChildren(runtimeElement);
  mount.dataset.beuiRuntime = "mounted";

  const adapter = createBeuiBridgeAdapter(bridge);
  runtimeState.mount = mount;
  runtimeState.element = runtimeElement;
  runtimeState.lifecycle = createReactRuntimeLifecycle({
    createRoot,
    render: (root, props) => root.render(createElement(MountedBeuiApp, {
      ...props,
      presentation: "legacy-docprep",
    })),
  });
  runtimeState.lifecycle.mount(runtimeElement, { adapter });
}

function unmountRuntime() {
  runtimeState.syncToken += 1;
  runtimeState.lifecycle?.unmount();
  runtimeState.lifecycle = null;
  removeRuntimeElement();
}

function syncRuntime(bridge) {
  if (!isDocPrepRoute(bridge)) {
    unmountRuntime();
    return;
  }
  const mount = document.getElementById("dossiersView");
  if (!mount) {
    unmountRuntime();
    return;
  }
  if (runtimeState.lifecycle?.isMounted() && runtimeState.mount === mount) return;
  unmountRuntime();
  mountRuntime(bridge);
}

function scheduleRuntimeSync(bridge) {
  const token = ++runtimeState.syncToken;
  queueMicrotask(() => {
    if (token !== runtimeState.syncToken) return;
    syncRuntime(bridge);
  });
}

registerFeature({
  id: "s41-mounted-beui-runtime",
  lifecycle: {
    bridgeReady: ({ bridge }) => scheduleRuntimeSync(bridge),
    afterRender: ({ bridge }) => scheduleRuntimeSync(bridge),
    bridgeLost: unmountRuntime,
    unmount: unmountRuntime,
  },
});
