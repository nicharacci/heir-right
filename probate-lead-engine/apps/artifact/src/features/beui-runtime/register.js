import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { registerFeature } from "../../core/feature-registry.js";
import { MountedBeuiApp } from "./mounted-app.tsx";
import {
  createBeuiBridgeAdapter,
  createReactRuntimeLifecycle,
} from "./bridge-adapter.ts";
import "./runtime.css";
import "../../styles/beui-tabs.css";
import "../../styles/doc-prep-beui.css";

const runtimeState = {
  lifecycle: null,
  element: null,
  restoredChildren: [],
};

function hideLegacyChildren(workspace, runtimeElement) {
  const restoredChildren = [];
  for (const child of workspace.children) {
    if (child === runtimeElement) continue;
    restoredChildren.push([child, child.hasAttribute("hidden")]);
    child.setAttribute("hidden", "");
  }
  runtimeState.restoredChildren = restoredChildren;
}

function restoreLegacyChildren() {
  for (const [child, wasHidden] of runtimeState.restoredChildren) {
    if (wasHidden) child.setAttribute("hidden", "");
    else child.removeAttribute("hidden");
  }
  runtimeState.restoredChildren = [];
}

function mountRuntime(bridge) {
  if (runtimeState.lifecycle?.isMounted()) return;
  const workspace = document.getElementById("workspace");
  if (!workspace) return;

  const runtimeElement = document.createElement("div");
  runtimeElement.className = "beui-mounted-runtime";
  runtimeElement.dataset.beuiRuntimeRoot = "true";
  workspace.append(runtimeElement);
  hideLegacyChildren(workspace, runtimeElement);
  workspace.dataset.beuiRuntime = "mounted";

  const adapter = createBeuiBridgeAdapter(bridge);
  runtimeState.element = runtimeElement;
  runtimeState.lifecycle = createReactRuntimeLifecycle({
    createRoot,
    render: (root, props) => root.render(createElement(MountedBeuiApp, props)),
  });
  runtimeState.lifecycle.mount(runtimeElement, { adapter });
}

function unmountRuntime() {
  runtimeState.lifecycle?.unmount();
  runtimeState.lifecycle = null;
  runtimeState.element?.remove();
  runtimeState.element = null;
  const workspace = document.getElementById("workspace");
  workspace?.removeAttribute("data-beui-runtime");
  restoreLegacyChildren();
}

registerFeature({
  id: "s41-mounted-beui-runtime",
  lifecycle: {
    bridgeReady: ({ bridge }) => mountRuntime(bridge),
    afterRender: ({ bridge }) => mountRuntime(bridge),
    bridgeLost: unmountRuntime,
    unmount: unmountRuntime,
  },
});
