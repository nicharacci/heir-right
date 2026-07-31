const rails = new Map();
const subscribers = new Set();
const storageKey = "heirright:contextual-rail:v1";
const defaults = Object.freeze({ open: false, activeId: null, activeTab: null, width: 392, mobileSheet: false });
let state = { ...defaults };
let runtimeActive = false;

function reportRailError(scope, error) {
  console.error(`HeirRight rail ${scope} failed.`, error);
}

function requireActiveRuntime() {
  if (!runtimeActive) throw new Error("The contextual rail is unavailable before authorized workspace activation.");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || min));
}

function descriptorFor(id = state.activeId) {
  return id ? rails.get(id) || null : null;
}

function readPersistedState() {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      open: state.open,
      activeId: state.activeId,
      activeTab: state.activeTab,
      width: state.width,
    }));
  } catch {
    // The in-memory rail remains usable when storage is unavailable.
  }
}

function publicDescriptor(descriptor) {
  if (!descriptor) return null;
  return Object.freeze({
    id: descriptor.id,
    label: descriptor.label,
    tabs: Object.freeze(descriptor.tabs.map((tab) => Object.freeze({ id: tab.id, label: tab.label }))),
    minWidth: descriptor.minWidth,
    maxWidth: descriptor.maxWidth,
    defaultWidth: descriptor.defaultWidth,
    mobileSheet: descriptor.mobileSheet,
  });
}

function snapshot() {
  return Object.freeze({
    ...state,
    active: publicDescriptor(descriptorFor()),
    registered: Object.freeze([...rails.values()].map(publicDescriptor)),
  });
}

function emit({ persistState = true } = {}) {
  if (persistState) persist();
  const next = snapshot();
  subscribers.forEach((listener) => {
    try {
      listener(next);
    } catch (error) {
      reportRailError("subscriber", error);
    }
  });
  return next;
}

function normalizeRail(definition) {
  if (!definition || typeof definition !== "object") throw new TypeError("Rail definition is required.");
  const id = String(definition.id || "").trim();
  if (!id) throw new TypeError("Rail id is required.");
  const tabs = Array.isArray(definition.tabs) ? definition.tabs.map((tab) => ({
    id: String(tab?.id || "").trim(),
    label: String(tab?.label || tab?.id || "").trim(),
    render: typeof tab?.render === "function" ? tab.render : null,
    actions: tab?.actions && typeof tab.actions === "object" ? { ...tab.actions } : {},
  })) : [];
  if (!tabs.length || tabs.some((tab) => !tab.id)) throw new TypeError(`Rail ${id} requires named tabs.`);
  if (new Set(tabs.map((tab) => tab.id)).size !== tabs.length) throw new Error(`Rail ${id} contains duplicate tab ids.`);
  const minWidth = clamp(definition.minWidth || 392, 280, 520);
  const maxWidth = clamp(definition.maxWidth || 552, minWidth, 640);
  return Object.freeze({
    id,
    label: String(definition.label || id),
    tabs: Object.freeze(tabs.map(Object.freeze)),
    defaultTab: tabs.some((tab) => tab.id === definition.defaultTab) ? definition.defaultTab : tabs[0].id,
    minWidth,
    maxWidth,
    defaultWidth: clamp(definition.defaultWidth || 392, minWidth, maxWidth),
    mobileSheet: definition.mobileSheet !== false,
    render: typeof definition.render === "function" ? definition.render : null,
    actions: definition.actions && typeof definition.actions === "object" ? Object.freeze({ ...definition.actions }) : Object.freeze({}),
  });
}

/**
 * Register a contextual rail descriptor with a globally unique ID, named tabs,
 * optional render/action callbacks, and width bounds. Registration is safe
 * before auth so auto-discovered modules can declare themselves, while rail
 * activation and callbacks stay bridge-gated. The returned teardown removes
 * the descriptor and closes it if active; snapshots contain frozen public
 * labels/geometry only and never expose render or action functions.
 */
function registerRail(definition) {
  const descriptor = normalizeRail(definition);
  if (rails.has(descriptor.id)) throw new Error(`Rail already registered: ${descriptor.id}`);
  rails.set(descriptor.id, descriptor);
  const persisted = readPersistedState();
  if (!state.activeId && persisted.activeId === descriptor.id) {
    state = {
      ...state,
      activeId: descriptor.id,
      activeTab: descriptor.tabs.some((tab) => tab.id === persisted.activeTab) ? persisted.activeTab : descriptor.defaultTab,
      open: Boolean(persisted.open),
      width: clamp(persisted.width || descriptor.defaultWidth, descriptor.minWidth, descriptor.maxWidth),
    };
  }
  emit({ persistState: false });
  return () => {
    if (rails.get(descriptor.id) !== descriptor) return false;
    rails.delete(descriptor.id);
    if (state.activeId === descriptor.id) state = { ...state, open: false, activeId: null, activeTab: null };
    emit();
    return true;
  };
}

function activateRail(id, options = {}) {
  requireActiveRuntime();
  const descriptor = descriptorFor(id);
  if (!descriptor) throw new Error(`Unknown rail: ${id}`);
  const requestedTab = options.tab || state.activeTab;
  const activeTab = descriptor.tabs.some((tab) => tab.id === requestedTab) ? requestedTab : descriptor.defaultTab;
  state = {
    ...state,
    activeId: id,
    activeTab,
    open: options.open !== false,
    width: clamp(options.width || state.width || descriptor.defaultWidth, descriptor.minWidth, descriptor.maxWidth),
    mobileSheet: Boolean(options.mobileSheet ?? state.mobileSheet),
  };
  return emit();
}

function setRailOpen(open) {
  requireActiveRuntime();
  state = { ...state, open: Boolean(open && state.activeId) };
  return emit();
}

function selectRailTab(tabId) {
  requireActiveRuntime();
  const descriptor = descriptorFor();
  if (!descriptor?.tabs.some((tab) => tab.id === tabId)) throw new Error(`Unknown rail tab: ${tabId}`);
  state = { ...state, activeTab: tabId };
  return emit();
}

function setRailWidth(width) {
  requireActiveRuntime();
  const descriptor = descriptorFor();
  const min = descriptor?.minWidth || 392;
  const max = descriptor?.maxWidth || 552;
  state = { ...state, width: clamp(width, min, max) };
  return emit();
}

function setMobileSheet(mobileSheet) {
  requireActiveRuntime();
  state = { ...state, mobileSheet: Boolean(mobileSheet) };
  return emit({ persistState: false });
}

function renderActiveRail(context) {
  requireActiveRuntime();
  const descriptor = descriptorFor();
  if (!descriptor) return null;
  const tab = descriptor.tabs.find((item) => item.id === state.activeTab) || descriptor.tabs[0];
  return tab.render ? tab.render(context) : descriptor.render?.({ ...context, tab: tab.id }) ?? null;
}

async function runRailAction(actionId, payload) {
  requireActiveRuntime();
  const descriptor = descriptorFor();
  const tab = descriptor?.tabs.find((item) => item.id === state.activeTab);
  const action = tab?.actions?.[actionId] || descriptor?.actions?.[actionId];
  if (typeof action !== "function") throw new Error(`Unknown rail action: ${actionId}`);
  return action(payload);
}

function subscribeRails(listener) {
  if (typeof listener !== "function") throw new TypeError("Rail subscriber must be a function.");
  subscribers.add(listener);
  try {
    listener(snapshot());
  } catch (error) {
    subscribers.delete(listener);
    throw error;
  }
  return () => subscribers.delete(listener);
}

function setRailRuntimeActive(active) {
  runtimeActive = Boolean(active);
  if (!runtimeActive && (state.open || state.mobileSheet)) {
    state = { ...state, open: false, mobileSheet: false };
    emit();
  }
  return runtimeActive;
}

export {
  activateRail,
  registerRail,
  renderActiveRail,
  runRailAction,
  selectRailTab,
  setMobileSheet,
  setRailOpen,
  setRailRuntimeActive,
  setRailWidth,
  snapshot as railSnapshot,
  subscribeRails,
};
