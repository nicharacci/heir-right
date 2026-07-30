const storageKey = "heirright:theme";
const modes = Object.freeze(["dark", "cream", "system"]);
const subscribers = new Set();
let currentMode = "dark";
let mediaQuery = null;

function reportThemeError(scope, error) {
  console.error(`HeirRight theme ${scope} failed.`, error);
}

function normalizeMode(mode) {
  if (mode === "light") return "cream";
  return modes.includes(mode) ? mode : "system";
}

function resolvedMode(mode = currentMode) {
  const normalized = normalizeMode(mode);
  if (normalized !== "system") return normalized;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "cream";
}

function snapshot() {
  return Object.freeze({ mode: currentMode, resolved: resolvedMode(currentMode) });
}

function emit() {
  const next = snapshot();
  subscribers.forEach((listener) => {
    try {
      listener(next);
    } catch (error) {
      reportThemeError("subscriber", error);
    }
  });
  return next;
}

function apply(mode = currentMode) {
  currentMode = normalizeMode(mode);
  const resolved = resolvedMode(currentMode);
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeMode = currentMode;
    document.documentElement.style.colorScheme = resolved === "cream" ? "light" : "dark";
    document.documentElement.classList.toggle("wa-dark", resolved === "dark");
    document.documentElement.classList.toggle("wa-light", resolved === "cream");
    if (document.body) {
      document.body.dataset.theme = resolved;
      document.body.dataset.themeMode = currentMode;
    }
  }
  return emit();
}

function setTheme(mode, { persist = true } = {}) {
  const next = normalizeMode(mode);
  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey, next);
    } catch {
      // A blocked storage surface must not block a theme change.
    }
  }
  return apply(next);
}

function initializeTheme(fallback = "dark") {
  let stored = null;
  if (typeof window !== "undefined") {
    try {
      stored = window.localStorage.getItem(storageKey);
    } catch {
      stored = null;
    }
  }
  if (typeof window !== "undefined" && window.matchMedia && !mediaQuery) {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener?.("change", () => {
      if (currentMode === "system") apply("system");
    });
  }
  return apply(stored || fallback);
}

function subscribeTheme(listener) {
  if (typeof listener !== "function") throw new TypeError("Theme subscriber must be a function.");
  subscribers.add(listener);
  try {
    listener(snapshot());
  } catch (error) {
    subscribers.delete(listener);
    throw error;
  }
  return () => subscribers.delete(listener);
}

export { apply, initializeTheme, modes, normalizeMode, setTheme, snapshot as themeSnapshot, subscribeTheme };
