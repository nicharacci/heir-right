import { runtime } from "../../core/feature-registry.js";
import { renderDashboardView, setDashboardRange } from "../dashboard/dashboard-view.js";
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
    if (queueDrawerOpen) renderShellQueue();
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

  let queueDrawerOpen = false;
  let queueDrawerTab = "docprep";

  function queueRows(snapshot) {
    return queueDrawerTab === "export"
      ? (Array.isArray(snapshot.exportQueue) ? snapshot.exportQueue : [])
      : (Array.isArray(snapshot.docPrepEstates) ? snapshot.docPrepEstates : []);
  }

  function renderShellQueue() {
    const drawer = document.getElementById("agentDrawer");
    const list = document.getElementById("activityList");
    if (!drawer || !list || !bridge) return;
    drawer.dataset.drawerMode = "queue";
    drawer.setAttribute("aria-label", "Workflow queue");
    const snapshot = bridge.readState();
    const rows = queueRows(snapshot);
    const escape = (value) => bridge.escapeHtml(String(value ?? ""));
    const rowHtml = rows.length ? rows.map((row) => "<tr><td><button type=\"button\" data-shell-queue-estate=\"" + escape(row.id) + "\" data-shell-queue-view=\"" + (queueDrawerTab === "export" && row.workflowState === "exported" ? "export" : "dossiers") + "\"><strong>" + escape(row.title || "Estate file") + "<\/strong><span>" + escape(row.address || "Address unavailable") + "<\/span><\/button><\/td><td>" + escape(row.workflowLabel || ({ queued: "Queued for Doc Prep", processing: "Preparing packet", "completed-awaiting-export": "Ready for export", blocked: "Needs attention", exported: "Exported" }[row.workflowState] || "In review")) + "<\/td><td>" + escape(row.workflowBlocker || (row.workflowState === "completed-awaiting-export" ? "Verified report is ready for export." : "Workflow state updated.")) + "<\/td><\/tr>").join("") : "<tr><td colspan=\"3\" class=\"shell-queue-empty\">No estates are waiting in this queue.<\/td><\/tr>";
    drawer.querySelector(".drawer-title").textContent = "Workflow queue";
    drawer.querySelector(".drawer-head .eyebrow").textContent = "Queue";
    const close = drawer.querySelector("#closeAgentDrawer");
    if (close) {
      close.setAttribute("aria-label", "Close workflow queue");
      close.setAttribute("title", "Close workflow queue");
    }
    list.innerHTML = "<div class=\"shell-queue-tabs hr-docprep-flow-switch beui-tabs\" role=\"tablist\" aria-label=\"Queue type\"><button class=\"beui-tabs-trigger\" type=\"button\" data-shell-queue-tab=\"docprep\" aria-selected=\"" + String(queueDrawerTab === "docprep") + "\">Doc Prep<\/button><button class=\"beui-tabs-trigger\" type=\"button\" data-shell-queue-tab=\"export\" aria-selected=\"" + String(queueDrawerTab === "export") + "\">Export<\/button><\/div><div class=\"shell-queue-table-wrap\"><table class=\"shell-queue-table\"><thead><tr><th>Estate<\/th><th>Status<\/th><th>Notification<\/th><\/tr><\/thead><tbody>" + rowHtml + "<\/tbody><\/table><\/div>";
  }

  function openShellQueue() {
    const drawer = document.getElementById("agentDrawer");
    if (!drawer) return;
    queueDrawerOpen = true;
    renderShellQueue();
    drawer.dataset.open = "true";
    drawer.setAttribute("aria-hidden", "false");
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

    const queueCommand = target.closest("[data-shell-primary-command][data-shell-action=\"queue\"]");
    if (queueCommand) { event.preventDefault(); openShellQueue(); return; }

    const queueTab = target.closest("[data-shell-queue-tab]");
    if (queueTab) { event.preventDefault(); queueDrawerTab = queueTab.dataset.shellQueueTab === "export" ? "export" : "docprep"; renderShellQueue(); return; }

    const queueEstate = target.closest("[data-shell-queue-estate]");
    if (queueEstate) { event.preventDefault(); await runControl(queueEstate, async () => { await bridge.dispatch("select-estate", { estateId: queueEstate.dataset.shellQueueEstate }); bridge.navigate(queueEstate.dataset.shellQueueView || "dossiers"); }); return; }

    const closeQueue = target.closest("#closeAgentDrawer");
    if (closeQueue && queueDrawerOpen) { queueDrawerOpen = false; }

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

    const dashboardRange = target.closest("[data-dashboard-range]");
    if (dashboardRange) { event.preventDefault(); setDashboardRange(dashboardRange.dataset.dashboardRange); refreshDashboard(bridge.readState()); return; }

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
