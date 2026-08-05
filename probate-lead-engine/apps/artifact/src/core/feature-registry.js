import {
  activateRail,
  railSnapshot,
  registerRail,
  renderActiveRail,
  runRailAction,
  selectRailTab,
  setMobileSheet,
  setRailOpen,
  setRailRuntimeActive,
  setRailWidth,
  subscribeRails,
} from "./shell-rail-registry.js";
import { initializeTheme, modes, setTheme, subscribeTheme, themeSnapshot } from "./theme-store.js";

const features = new Map();
const views = new Map();
const commands = new Map();
const subscribers = new Set();
let legacyBridge = null;

function reportFeatureError(scope, error) {
  console.error(`HeirRight feature ${scope} failed.`, error);
}

function readonlyMetadata(definition) {
  return Object.freeze({
    id: definition.id,
    views: Object.freeze(definition.views.map((view) => view.id)),
    commands: Object.freeze(definition.commands.map((command) => command.id)),
    rails: Object.freeze(definition.rails.map((rail) => rail.id)),
    lifecycle: Object.freeze(Object.keys(definition.lifecycle)),
  });
}

function snapshot() {
  return Object.freeze({
    features: Object.freeze([...features.values()].map(readonlyMetadata)),
    bridgeReady: Boolean(legacyBridge),
  });
}

function emit() {
  const next = snapshot();
  subscribers.forEach((listener) => {
    try {
      listener(next);
    } catch (error) {
      reportFeatureError("subscriber", error);
    }
  });
  return next;
}

function normalizeViews(value) {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([id, render]) => ({ id, render }))
      : [];
  return list.map((view) => {
    const id = String(view?.id || "").trim();
    if (!id || typeof view?.render !== "function") throw new TypeError("Feature views require an id and renderer.");
    return Object.freeze({
      id,
      render: view.render,
      mount: typeof view.mount === "function" ? view.mount : null,
      unmount: typeof view.unmount === "function" ? view.unmount : null,
    });
  });
}

function normalizeCommands(value) {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.entries(value).map(([id, run]) => ({ id, run }))
      : [];
  return list.map((command) => {
    const id = String(command?.id || "").trim();
    const run = command?.run || command?.handler;
    if (!id || typeof run !== "function") throw new TypeError("Feature commands require an id and handler.");
    return Object.freeze({ id, run });
  });
}

function normalizeFeature(definition) {
  if (!definition || typeof definition !== "object") throw new TypeError("Feature definition is required.");
  const id = String(definition.id || "").trim();
  if (!id) throw new TypeError("Feature id is required.");
  const lifecycle = definition.lifecycle && typeof definition.lifecycle === "object"
    ? Object.fromEntries(Object.entries(definition.lifecycle).filter(([, handler]) => typeof handler === "function"))
    : {};
  const normalizedViews = normalizeViews(definition.views || definition.view);
  const normalizedCommands = normalizeCommands(definition.commands);
  if (new Set(normalizedViews.map((view) => view.id)).size !== normalizedViews.length) {
    throw new Error(`Feature ${id} contains duplicate view ids.`);
  }
  if (new Set(normalizedCommands.map((command) => command.id)).size !== normalizedCommands.length) {
    throw new Error(`Feature ${id} contains duplicate command ids.`);
  }
  return Object.freeze({
    id,
    views: Object.freeze(normalizedViews),
    commands: Object.freeze(normalizedCommands),
    rails: Object.freeze(Array.isArray(definition.rails) ? [...definition.rails] : definition.rail ? [definition.rail] : []),
    lifecycle: Object.freeze(lifecycle),
  });
}

/**
 * Register one independently owned feature module. A definition may contain
 * globally unique `views`, `commands`, `rails`, and named lifecycle callbacks.
 * Modules may register during pre-auth evaluation, but rendering, commands,
 * lifecycle work, and rail execution remain disabled until the authorized
 * legacy bridge is installed. The returned teardown removes every owned ID,
 * even when an unmount callback fails; `snapshot()` exposes frozen metadata
 * only, never callback or mutable application references.
 */
function registerFeature(definition) {
  const feature = normalizeFeature(definition);
  if (features.has(feature.id)) throw new Error(`Feature already registered: ${feature.id}`);
  for (const view of feature.views) {
    if (views.has(view.id)) throw new Error(`View already registered: ${view.id}`);
  }
  for (const command of feature.commands) {
    if (commands.has(command.id)) throw new Error(`Command already registered: ${command.id}`);
  }

  const railTeardowns = [];
  try {
    feature.rails.forEach((rail) => railTeardowns.push(registerRail(rail)));
    features.set(feature.id, feature);
    feature.views.forEach((view) => views.set(view.id, { ...view, featureId: feature.id }));
    feature.commands.forEach((command) => commands.set(command.id, { ...command, featureId: feature.id }));
  } catch (error) {
    railTeardowns.reverse().forEach((teardown) => teardown());
    throw error;
  }
  emit();

  return () => {
    if (features.get(feature.id) !== feature) return false;
    let teardownError = null;
    try {
      if (legacyBridge) feature.lifecycle.unmount?.({ bridge: legacyBridge, feature: readonlyMetadata(feature) });
    } catch (error) {
      teardownError = error;
    } finally {
      feature.views.forEach((view) => views.delete(view.id));
      feature.commands.forEach((command) => commands.delete(command.id));
      railTeardowns.reverse().forEach((teardown) => {
        try {
          teardown();
        } catch (error) {
          teardownError ||= error;
        }
      });
      features.delete(feature.id);
      emit();
    }
    if (teardownError) throw teardownError;
    return true;
  };
}

function renderView(id, context = {}) {
  if (!legacyBridge) return null;
  const view = views.get(id);
  if (!view) return null;
  try {
    return view.render(Object.freeze({ ...context, bridge: legacyBridge }));
  } catch (error) {
    reportFeatureError(`view ${id}`, error);
    return null;
  }
}

function mountView(id, context = {}) {
  if (!legacyBridge) return null;
  const view = views.get(id);
  if (!view?.mount) return null;
  try {
    return view.mount(Object.freeze({ ...context, bridge: legacyBridge })) ?? null;
  } catch (error) {
    reportFeatureError(`mount ${id}`, error);
    return null;
  }
}

function unmountView(id, context = {}) {
  if (!legacyBridge) return null;
  const view = views.get(id);
  if (!view?.unmount) return null;
  try {
    return view.unmount(Object.freeze({ ...context, bridge: legacyBridge })) ?? null;
  } catch (error) {
    reportFeatureError(`unmount ${id}`, error);
    return null;
  }
}

async function runCommand(id, payload) {
  if (!legacyBridge) throw new Error("Feature commands are unavailable before authorized workspace activation.");
  const command = commands.get(id);
  if (!command) throw new Error(`Unknown feature command: ${id}`);
  return command.run(payload, legacyBridge);
}

function runLifecycle(name, context = {}) {
  if (!legacyBridge) return [];
  const results = [];
  features.forEach((feature) => {
    const handler = feature.lifecycle[name];
    if (!handler) return;
    try {
      const result = handler(Object.freeze({ ...context, bridge: legacyBridge }));
      if (result && typeof result.then === "function") {
        results.push(Promise.resolve(result).catch((error) => {
          reportFeatureError(`${feature.id} ${name} lifecycle`, error);
          return null;
        }));
      } else {
        results.push(result);
      }
    } catch (error) {
      reportFeatureError(`${feature.id} ${name} lifecycle`, error);
      results.push(null);
    }
  });
  return results;
}

function subscribeFeatures(listener) {
  if (typeof listener !== "function") throw new TypeError("Feature subscriber must be a function.");
  subscribers.add(listener);
  try {
    listener(snapshot());
  } catch (error) {
    subscribers.delete(listener);
    throw error;
  }
  return () => subscribers.delete(listener);
}

function installLegacyBridge(bridge) {
  if (legacyBridge) throw new Error("The legacy bridge is already installed.");
  if (!bridge || typeof bridge !== "object") throw new TypeError("A legacy bridge is required.");
  const required = ["readState", "subscribe", "dispatch", "selectedEstateId", "navigate", "emit", "escapeHtml", "icon"];
  required.forEach((name) => {
    if (typeof bridge[name] !== "function") throw new TypeError(`Legacy bridge is missing ${name}().`);
  });
  const optional = ["dispatchFile"].filter((name) => typeof bridge[name] === "function");
  legacyBridge = Object.freeze(Object.fromEntries([...required, ...optional].map((name) => [name, bridge[name].bind(bridge)])));
  setRailRuntimeActive(true);
  emit();
  runLifecycle("bridgeReady", { bridge: legacyBridge });
  return legacyBridge;
}

function uninstallLegacyBridge() {
  if (!legacyBridge) return false;
  const bridge = legacyBridge;
  runLifecycle("bridgeLost", { bridge });
  legacyBridge = null;
  setRailRuntimeActive(false);
  emit();
  return true;
}

function getLegacyBridge() {
  return legacyBridge;
}

const runtime = Object.freeze({
  version: 1,
  features: Object.freeze({
    register: registerFeature,
    snapshot,
    subscribe: subscribeFeatures,
    renderView,
    mountView,
    unmountView,
    runCommand,
    runLifecycle,
  }),
  rails: Object.freeze({
    register: registerRail,
    activate: activateRail,
    snapshot: railSnapshot,
    subscribe: subscribeRails,
    setOpen: setRailOpen,
    selectTab: selectRailTab,
    setWidth: setRailWidth,
    setMobileSheet,
    render: renderActiveRail,
    runAction: runRailAction,
  }),
  theme: Object.freeze({ modes, initialize: initializeTheme, set: setTheme, snapshot: themeSnapshot, subscribe: subscribeTheme }),
  bridge: Object.freeze({ install: installLegacyBridge, get: getLegacyBridge }),
});

initializeTheme("dark");

export {
  getLegacyBridge,
  installLegacyBridge,
  mountView,
  registerFeature,
  renderView,
  runCommand,
  runLifecycle,
  runtime,
  subscribeFeatures,
  uninstallLegacyBridge,
  unmountView,
};
