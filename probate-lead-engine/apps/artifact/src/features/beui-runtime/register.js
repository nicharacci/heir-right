import { createRoot } from "react-dom/client";
import { registerFeature } from "../../core/feature-registry.js";
import { createBeuiBridgeAdapter } from "./bridge-adapter.ts";
import { renderBeuiRail } from "./doc-prep-rails.tsx";
import "./runtime.css";

const runtimeState = {
  roots: new Map(),
  syncToken: 0,
  bridge: null,
};

function unmountRuntime() {
  runtimeState.syncToken += 1;
  runtimeState.roots.forEach(({ root }) => root.unmount());
  runtimeState.roots.clear();
}

function syncRuntime(bridge) {
  const targets = [...document.querySelectorAll("[data-s40-beui-queue], [data-s40-beui-batch-progress], [data-beui-rail]")];
  runtimeState.roots.forEach(({ root }, element) => {
    if (!targets.includes(element) || !element.isConnected) {
      root.unmount();
      runtimeState.roots.delete(element);
    }
  });
  if (!targets.length) return;
  const adapter = createBeuiBridgeAdapter(bridge);
  targets.forEach((element) => {
    const existing = runtimeState.roots.get(element);
    const root = existing?.root || createRoot(element);
    runtimeState.roots.set(element, { root });
    root.render(renderBeuiRail(adapter, element));
  });
}

function scheduleRuntimeSync(bridge) {
  runtimeState.bridge = bridge;
  const token = ++runtimeState.syncToken;
  queueMicrotask(() => {
    if (token !== runtimeState.syncToken) return;
    syncRuntime(bridge);
  });
}

window.addEventListener("heirright:beui-rail-render", () => {
  if (runtimeState.bridge) scheduleRuntimeSync(runtimeState.bridge);
});

registerFeature({
  id: "s41-mounted-beui-runtime",
  lifecycle: {
    bridgeReady: ({ bridge }) => scheduleRuntimeSync(bridge),
    afterRender: ({ bridge }) => scheduleRuntimeSync(bridge),
    bridgeLost: () => {
      runtimeState.bridge = null;
      unmountRuntime();
    },
    unmount: () => {
      runtimeState.bridge = null;
      unmountRuntime();
    },
  },
});
