import { runtime } from "../../core/feature-registry.js";
import { renderDashboardView } from "../dashboard/dashboard-view.js";
import { createCommandDrawer } from "./command-drawer.js";
import { createShellView, ROUTE_LABELS } from "./shell-view.js";
import { createThemeControl } from "./theme-control.js";
import { createUnifiedRailHost } from "./unified-rail-host.js";

const SESSION_ROUTE_KEY = "heirright:shell:session-view:v2";
const SETTINGS_RENDERED_EVENT = "heirright:settings-rendered";
const VALID_VIEWS = new Set(Object.keys(ROUTE_LABELS));

function readSessionView() {
  try {
    const stored = window.sessionStorage.getItem(SESSION_ROUTE_KEY);
    return VALID_VIEWS.has(stored) ? stored : null;
  } catch {
    return null;
  }
}

function writeSessionView(view) {
  if (!VALID_VIEWS.has(view)) return;
  try {
    window.sessionStorage.setItem(SESSION_ROUTE_KEY, view);
  } catch {
    // In-memory navigation still works when session storage is unavailable.
  }
}

function resolveBootView(location = window.location) {
  const params = new URLSearchParams(location.search || "");
  const explicit = params.get("view");
  if (VALID_VIEWS.has(explicit)) return explicit;
  if (params.get("docprep") === "estate") return "dossiers";
  return readSessionView() || "dashboard";
}

function resolveDeepLinkRail(location = window.location) {
  const params = new URLSearchParams(location.search || "");
  if (params.get("docprep") !== "estate") return null;
  if (params.has("view") && params.get("view") !== "dossiers") return null;
  const legacyTab = params.get("railTab") || "flow";
  const tab = {
    docs: "document",
    timeline: "automation",
    flow: "automation",
  }[legacyTab] || "automation";
  return Object.freeze({
    railId: "doc-prep-context",
    tab,
    open: params.get("rail") !== "closed",
  });
}

function createShellController() {
  let bridge = null;
  let shell = null;
  let unifiedRail = null;
  let themeControl = null;
  let commandDrawer = null;
  let unsubscribeState = null;
  let commandForm = null;
  let mounted = false;

  function mountThemeControl() {
    const mount = document.getElementById("s38SettingsThemeMount");
    if (!mount || !themeControl?.element || themeControl.element.parentElement === mount) return false;
    mount.replaceChildren(themeControl.element);
    return true;
  }

  function onSettingsRendered() {
    mountThemeControl();
  }

  function updateAddressBar(view) {
    if (!VALID_VIEWS.has(view)) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // URL state is a convenience; navigation remains functional without it.
    }
  }

  function refreshDashboard(state) {
    if (state.activeView !== "dashboard") return;
    const mount = document.getElementById("dashboardView");
    if (mount) mount.innerHTML = renderDashboardView({ bridge });
  }

  function sync(next) {
    if (!mounted || !shell || !unifiedRail) return;
    shell.sync(next);
    unifiedRail.updateApplicationState(next);
    refreshDashboard(next);
    writeSessionView(next.activeView);
    updateAddressBar(next.activeView);
  }

  async function runControl(button, operation) {
    if (!button || button.getAttribute("aria-busy") === "true") return;
    const wasDisabled = Boolean(button.disabled);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await operation();
    } catch {
      shell?.announce("That command could not finish. Review the selected estate and try again.");
    } finally {
      button.disabled = wasDisabled;
      button.removeAttribute("aria-busy");
    }
  }

  function openContext(tab = "overview", source = null) {
    commandDrawer?.close({ restoreFocus: false });
    unifiedRail?.open({ railId: "case-journey", tab, source });
  }

  function onCommandSubmit(event) {
    const input = commandForm?.querySelector("#commandInput");
    const command = String(input?.value || "").trim();
    if (!/\b(report|rail|document)\b/i.test(command)) return;
    const source = commandDrawer?.toggle || event.submitter;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (input) input.value = "";
    openContext("documents", source);
    shell?.announce("Estate documents opened in the Case Journey.");
  }

  async function onWorkspaceClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !shell?.workspace.contains(target)) return;

    const sidebarToggle = target.closest("#sidebarToggle");
    if (sidebarToggle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (sidebarToggle.dataset.shellCompactHome === "true") {
        bridge.navigate("dashboard");
        shell.announce("Dashboard opened.");
        return;
      }
      const collapsed = shell.toggleSidebar();
      shell.announce(collapsed ? "Navigation collapsed." : "Navigation expanded.");
      return;
    }

    if (target.closest("#s38UnifiedRail")) return;

    const contextTrigger = target.closest("[data-shell-open-context]");
    if (contextTrigger) {
      event.preventDefault();
      openContext(contextTrigger.dataset.shellOpenContext || "overview", contextTrigger);
      return;
    }

    const stage = target.closest("[data-case-stage]");
    if (stage) {
      event.preventDefault();
      openContext("journey", stage);
      return;
    }

    const estateRow = target.closest("[data-dashboard-estate-id]");
    if (estateRow) {
      event.preventDefault();
      await runControl(estateRow, async () => {
        await bridge.dispatch("select-estate", { estateId: estateRow.dataset.dashboardEstateId });
        bridge.navigate(estateRow.dataset.dashboardEstateOpen || "dossiers");
      });
      return;
    }

    const primaryCommand = target.closest('[data-shell-primary-command][data-shell-action="import-estate"]');
    if (primaryCommand) {
      event.preventDefault();
      await runControl(primaryCommand, async () => {
        const importButton = document.getElementById("crmImportSingle");
        if (!importButton) throw new Error("Estate import is unavailable.");
        importButton.click();
      });
      return;
    }

    const viewButton = target.closest("[data-dashboard-view], [data-journey-next-view], [data-shell-primary-command]");
    if (viewButton) {
      event.preventDefault();
      const view = viewButton.dataset.dashboardView
        || viewButton.dataset.journeyNextView
        || viewButton.dataset.nextView
        || "dossiers";
      await runControl(viewButton, async () => {
        await bridge.navigate(view);
        if (viewButton.dataset.dashboardContext) {
          openContext(viewButton.dataset.dashboardContext, viewButton);
        }
      });
      return;
    }

    const legacyRailAction = target.closest("[data-rail-action], #historyToggle, #agentDrawerToggle");
    if (legacyRailAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const tab = legacyRailAction.id === "historyToggle" || legacyRailAction.id === "agentDrawerToggle"
        ? "activity"
        : legacyRailAction.dataset.railAction === "report"
          ? "documents"
          : "overview";
      openContext(tab, legacyRailAction);
    }
  }

  function mount(authorizedBridge) {
    if (mounted) return false;
    bridge = authorizedBridge;
    shell = createShellView();
    unifiedRail = createUnifiedRailHost({
      bridge,
      content: shell.content,
      announce: (message) => shell.announce(message),
    });
    themeControl = createThemeControl({ announce: (message) => shell.announce(message) });
    commandDrawer = createCommandDrawer({
      root: shell.workspace,
      announce: (message) => shell.announce(message),
    });
    document.addEventListener(SETTINGS_RENDERED_EVENT, onSettingsRendered);
    mounted = true;

    const railSnapshot = runtime.rails.snapshot();
    if (!railSnapshot.activeId) {
      runtime.rails.activate("case-journey", { open: false, tab: "overview" });
    }

    const deepLinkRail = resolveDeepLinkRail();
    if (deepLinkRail && runtime.rails.snapshot().registered.some((rail) => rail.id === deepLinkRail.railId)) {
      runtime.rails.activate(deepLinkRail.railId, {
        tab: deepLinkRail.tab,
        open: deepLinkRail.open,
      });
    }

    shell.workspace.addEventListener("click", onWorkspaceClick, { capture: true });
    commandForm = document.getElementById("commandForm");
    commandForm?.addEventListener("submit", onCommandSubmit, { capture: true });
    const targetView = resolveBootView();
    const current = bridge.readState();
    if (current.activeView !== targetView) bridge.navigate(targetView);
    unsubscribeState = bridge.subscribe(sync);
    sync(bridge.readState());
    mountThemeControl();
    return true;
  }

  function afterRender() {
    if (!mounted || !bridge) return;
    sync(bridge.readState());
    mountThemeControl();
  }

  function unmount() {
    if (!mounted) return false;
    shell?.workspace.removeEventListener("click", onWorkspaceClick, { capture: true });
    commandForm?.removeEventListener("submit", onCommandSubmit, { capture: true });
    document.removeEventListener(SETTINGS_RENDERED_EVENT, onSettingsRendered);
    unsubscribeState?.();
    unsubscribeState = null;
    commandDrawer?.destroy();
    themeControl?.destroy();
    unifiedRail?.destroy();
    shell?.destroy();
    bridge = null;
    shell = null;
    unifiedRail = null;
    themeControl = null;
    commandDrawer = null;
    commandForm = null;
    mounted = false;
    return true;
  }

  return Object.freeze({
    mount,
    afterRender,
    unmount,
    openContext,
    mounted: () => mounted,
  });
}

export {
  SESSION_ROUTE_KEY,
  SETTINGS_RENDERED_EVENT,
  VALID_VIEWS,
  createShellController,
  resolveBootView,
  resolveDeepLinkRail,
};
