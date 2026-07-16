import { iconMarkup } from "../../ui/icon-facade.js";
import { buildLifecycle, resolveDisposition } from "../case-journey/case-journey.js";

const SIDEBAR_STORAGE_KEY = "heirright:shell:sidebar-collapsed:v1";
const ROUTE_LABELS = Object.freeze({
  dashboard: "Dashboard",
  "find-estates": "Estates",
  dossiers: "Document Prep",
  drips: "Outreach",
  queue: "Queue",
  admin: "Admin",
  settings: "Settings",
  "help-demos": "Help & Demos",
});

function readSidebarCollapsed() {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored === "true" || stored === "false") return stored === "true";
  } catch {
    // The shell remains usable when storage is unavailable.
  }
  return true;
}

function persistSidebarCollapsed(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(Boolean(collapsed)));
  } catch {
    // Keep the in-memory preference for this session.
  }
}

function setSidebarCollapsed(workspace, collapsed, { persist = true } = {}) {
  const next = Boolean(collapsed);
  workspace.dataset.shellSidebarCollapsed = String(next);
  workspace.classList.toggle("is-collapsed", next);
  const toggle = workspace.querySelector("#sidebarToggle");
  if (toggle) {
    const label = next ? "Expand navigation" : "Collapse navigation";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    toggle.setAttribute("aria-expanded", String(!next));
  }
  if (persist) persistSidebarCollapsed(next);
  return next;
}

function syncSidebarControl(workspace) {
  const toggle = workspace.querySelector("#sidebarToggle");
  if (!toggle) return;
  if (window.matchMedia("(max-width: 819px)").matches) {
    toggle.dataset.shellCompactHome = "true";
    toggle.setAttribute("aria-label", "Go to Dashboard");
    toggle.setAttribute("title", "Go to Dashboard");
    toggle.removeAttribute("aria-expanded");
    toggle.removeAttribute("aria-controls");
    return;
  }
  delete toggle.dataset.shellCompactHome;
  toggle.setAttribute("aria-controls", "primarySidebar");
  setSidebarCollapsed(workspace, workspace.dataset.shellSidebarCollapsed === "true", { persist: false });
}

function consolidateLegacyRails() {
  const records = ["researchRail", "historyRail", "agentDrawer"].map((id) => {
    const element = document.getElementById(id);
    if (!element) return null;
    const record = {
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: Boolean(element.inert),
    };
    element.dataset.s38Consolidated = "true";
    element.setAttribute("aria-hidden", "true");
    element.inert = true;
    return record;
  }).filter(Boolean);
  return () => records.forEach(({ element, ariaHidden, inert }) => {
    delete element.dataset.s38Consolidated;
    if (ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", ariaHidden);
    element.inert = inert;
  });
}

function createShellView() {
  const workspace = document.getElementById("workspace");
  const app = workspace?.querySelector(".app");
  const sidebar = workspace?.querySelector("#primarySidebar");
  const topbar = app?.querySelector(".topbar");
  const content = app?.querySelector(".content");
  const statusbar = app?.querySelector(".statusbar");
  if (!workspace || !app || !sidebar || !topbar || !content || !statusbar) {
    throw new Error("The HeirRight workspace shell is unavailable.");
  }

  workspace.dataset.s38Shell = "case-journey";
  document.body.dataset.s38Shell = "case-journey";
  setSidebarCollapsed(workspace, readSidebarCollapsed(), { persist: false });
  syncSidebarControl(workspace);
  const onWindowResize = () => syncSidebarControl(workspace);
  window.addEventListener("resize", onWindowResize);

  const sidebarToggle = document.getElementById("sidebarToggle");
  const panelIcon = sidebarToggle?.querySelector(".toggle-panel-icon");
  if (panelIcon) panelIcon.innerHTML = iconMarkup("actions", { size: 19 });
  const commandDrawerCloseIcon = workspace.querySelector("[data-command-drawer-close-icon]");
  if (commandDrawerCloseIcon) commandDrawerCloseIcon.innerHTML = iconMarkup("close", { size: 18 });

  const routeContext = document.createElement("div");
  routeContext.className = "shell-route-context";
  routeContext.innerHTML = `
    <span class="shell-route-kicker">Estate operations</span>
    <div class="shell-route-title-line">
      <h1 id="s38RouteTitle">Dashboard</h1>
      <span id="s38RouteDisposition" class="shell-route-disposition">Review</span>
    </div>
    <p id="s38RouteMeta">Choose an estate file to begin.</p>
  `;
  topbar.prepend(routeContext);

  const headerCommands = document.createElement("div");
  headerCommands.className = "shell-header-commands";
  headerCommands.innerHTML = `
    <div class="shell-header-status" id="s38ShellStatus" role="status" aria-live="polite"></div>
    <button class="shell-primary-command" type="button" data-shell-primary-command>
      <span data-shell-primary-label>Continue Review</span>
      <span data-shell-primary-icon aria-hidden="true">${iconMarkup("discovery", { size: 17 })}</span>
    </button>
    <wa-tooltip for="s38OpenRail" placement="bottom">Open the Case Journey</wa-tooltip>
    <button id="s38OpenRail" class="shell-icon-command" type="button" data-shell-open-context="overview" aria-label="Open Case Journey" aria-controls="s38UnifiedRail" aria-expanded="false">
      ${iconMarkup("journey", { size: 27 })}
    </button>
  `;
  topbar.append(headerCommands);

  const legacyTopActions = topbar.querySelector(".top-actions");
  const importMenu = document.getElementById("crmImportMenu");
  const importRecord = importMenu ? {
    parent: importMenu.parentNode,
    next: importMenu.nextSibling,
  } : null;
  if (importMenu) headerCommands.prepend(importMenu);
  if (legacyTopActions) legacyTopActions.dataset.s38LegacyActions = "true";

  const kpiStrip = document.createElement("div");
  kpiStrip.className = "shell-kpi-strip";
  kpiStrip.setAttribute("aria-label", "Selected estate status");
  kpiStrip.innerHTML = `
    <span><small>Disposition</small><strong id="s38FooterDisposition">Review</strong></span>
    <span><small>Current stage</small><strong id="s38FooterStage">Intake</strong></span>
    <span><small>Discovery</small><strong id="s38FooterProgress">0%</strong></span>
  `;
  statusbar.prepend(kpiStrip);

  const restoreLegacyRails = consolidateLegacyRails();

  return {
    workspace,
    app,
    sidebar,
    topbar,
    content,
    statusbar,
    routeContext,
    headerCommands,
    primaryCommand: headerCommands.querySelector("[data-shell-primary-command]"),
    openRailButton: headerCommands.querySelector("#s38OpenRail"),
    toggleSidebar() {
      return setSidebarCollapsed(
        workspace,
        workspace.dataset.shellSidebarCollapsed !== "true",
      );
    },
    sync(state) {
      const disposition = resolveDisposition(state);
      const lifecycle = buildLifecycle(state);
      const currentStage = lifecycle.find((stage) => ["current", "blocked"].includes(stage.status))
        || lifecycle.at(-1);
      const routeTitle = ROUTE_LABELS[state.activeView] || "Dashboard";
      routeContext.querySelector("#s38RouteTitle").textContent = routeTitle;
      const routeDisposition = routeContext.querySelector("#s38RouteDisposition");
      routeDisposition.textContent = disposition.label;
      routeDisposition.dataset.disposition = disposition.tone;
      routeContext.querySelector("#s38RouteMeta").textContent = state.selectedEstate
        ? `${state.selectedEstate.title} · ${state.selectedEstate.address}`
        : "Choose an estate file to begin.";
      const primaryAction = state.activeView === "find-estates"
        ? { label: "Import Estate", view: "", action: "import-estate" }
        : { ...disposition.next, action: "navigate" };
      const primaryLabel = headerCommands.querySelector("[data-shell-primary-label]");
      primaryLabel.textContent = primaryAction.label;
      headerCommands.querySelector("[data-shell-primary-icon]").innerHTML = iconMarkup(
        primaryAction.action === "import-estate" ? "estates" : "discovery",
        { size: 17 },
      );
      this.primaryCommand.dataset.nextView = primaryAction.view;
      this.primaryCommand.dataset.shellAction = primaryAction.action;
      this.primaryCommand.disabled = false;
      this.primaryCommand.setAttribute("aria-label", primaryAction.label);
      this.primaryCommand.setAttribute("title", primaryAction.label);
      app.dataset.activeView = state.activeView;

      workspace.querySelectorAll("[data-shell-nav]").forEach((button) => {
        const active = button.dataset.shellNav === state.activeView;
        button.classList.toggle("is-active", active);
        [...button.classList]
          .filter((className) => className.endsWith("-glass"))
          .forEach((className) => button.classList.remove(className));
        if (active) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });

      kpiStrip.querySelector("#s38FooterDisposition").textContent = disposition.label;
      kpiStrip.querySelector("#s38FooterStage").textContent = currentStage?.label || "Intake";
      kpiStrip.querySelector("#s38FooterProgress").textContent = `${Math.max(0, Math.min(100, Number(state.docPrep?.progress || 0)))}%`;
    },
    announce(message) {
      const status = headerCommands.querySelector("#s38ShellStatus");
      status.textContent = "";
      window.requestAnimationFrame(() => {
        status.textContent = message;
      });
    },
    destroy() {
      restoreLegacyRails();
      window.removeEventListener("resize", onWindowResize);
      if (importMenu && importRecord?.parent) {
        importRecord.parent.insertBefore(importMenu, importRecord.next);
      }
      delete legacyTopActions?.dataset.s38LegacyActions;
      routeContext.remove();
      headerCommands.remove();
      kpiStrip.remove();
      delete workspace.dataset.s38Shell;
      delete workspace.dataset.shellSidebarCollapsed;
      delete document.body.dataset.s38Shell;
    },
  };
}

export {
  ROUTE_LABELS,
  SIDEBAR_STORAGE_KEY,
  createShellView,
  readSidebarCollapsed,
  setSidebarCollapsed,
  syncSidebarControl,
};
