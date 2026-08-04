import { escapeFor } from "../doc-prep/document-row.js";
import { createCommunityGrid, gridStatus, setGridQuickFilter, setGridRows } from "./community-grid.js";

let estateSelection = new Set();
let estateQuery = "";
let estateFiltersOpen = false;
let estateFilters = {
  county: "all",
  status: "all",
  minimumEvidence: 0,
  missing: "all",
  priorityOnly: false,
};

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function estateMatchesFilters(row, filters = estateFilters) {
  if (filters.county !== "all" && normalized(row.county) !== normalized(filters.county)) return false;
  if (filters.status !== "all" && ![row.status, row.tone].some((value) => normalized(value).includes(normalized(filters.status)))) return false;
  if (Number(row.evidence || 0) < Number(filters.minimumEvidence || 0)) return false;
  if (filters.missing !== "all" && !(row.missingTypes || []).some((type) => normalized(type) === normalized(filters.missing))) return false;
  if (filters.priorityOnly && Number(row.score || 0) < 75) return false;
  return true;
}

function filteredEstateRows(rows, filters = estateFilters) {
  return rows.filter((row) => estateMatchesFilters(row, filters));
}

function activeEstateRows(rows) {
  return rows.filter((row) => !row.workflowState || row.workflowState === "active");
}

function activeEstateFilterCount(filters = estateFilters) {
  return Number(filters.county !== "all")
    + Number(filters.status !== "all")
    + Number(Number(filters.minimumEvidence || 0) > 0)
    + Number(filters.missing !== "all")
    + Number(Boolean(filters.priorityOnly));
}

function countyOptions(estates, escape) {
  const counties = [...new Set(estates.map((estate) => String(estate.county || "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  return ["<option value=\"all\">All counties</option>", ...counties.map((county) => (
    `<option value="${escape(county)}" ${estateFilters.county === county ? "selected" : ""}>${escape(county)}</option>`
  ))].join("");
}

function evidenceLabel(row) {
  const total = Number(row.evidenceTotal || 0);
  return total > 0 ? `${Number(row.evidence || 0)} of ${total}` : `${Number(row.evidence || 0)} items`;
}

function renderEstatesGrid({ bridge }) {
  const snapshot = bridge.readState();
  const escape = (value) => escapeFor(bridge, value);
  const filterCount = activeEstateFilterCount();
  const selectedCount = estateSelection.size;
  return `
    <section class="hr-grid-view hr-estates-grid-view" data-operational-grid-view="estates">
      <header class="hr-grid-header">
        <div><p class="hr-grid-eyebrow">Estates</p><h1>Ready for Doc Prep</h1><p>Select eligible estates, review their source state, then move them into the shared Doc Prep workbench.</p></div>
        <div class="hr-grid-controls" data-selection-active="${selectedCount > 0}">
          <label class="hr-grid-search"><span>Filter estates</span><input type="search" value="${escape(estateQuery)}" data-grid-quick-filter placeholder="Owner, address, county, or status"></label>
          <button type="button" class="hr-grid-import-action" data-estates-import-file aria-haspopup="dialog">Upload PDF or CSV</button>
          <button type="button" class="hr-grid-filter-toggle beui-popover-trigger" data-estate-filters-toggle aria-expanded="${estateFiltersOpen}" aria-controls="hrEstateFilters">Filters <span data-estate-filter-count data-active="${filterCount > 0}">${filterCount}</span></button>
          <span class="hr-estate-selection-assist" data-estates-selection-assist ${selectedCount ? "" : "hidden"}>
            <button type="button" class="hr-grid-primary-action" data-estates-add-queue ${selectedCount ? "" : "disabled"}>${selectedCount === 1 ? "Queue for Doc Prep" : `Queue ${selectedCount} estates for Doc Prep`}</button>
            <button type="button" class="hr-grid-lifecycle-action" data-estates-archive ${selectedCount ? "" : "disabled"}>${selectedCount === 1 ? "Archive estate" : `Archive ${selectedCount} estates`}</button>
            <button type="button" class="hr-grid-lifecycle-action is-danger" data-estates-delete ${selectedCount ? "" : "disabled"}>${selectedCount === 1 ? "Delete estate" : `Delete ${selectedCount} estates`}</button>
          </span>
          <span class="hr-grid-action-status" data-grid-status aria-live="polite"></span>
        </div>
      </header>
      <section class="hr-estate-filters beui-popover" id="hrEstateFilters" data-beui-menu-surface aria-label="Estate list filters" ${estateFiltersOpen ? "" : "hidden"}>
        <label><span>County</span><select data-estate-filter="county">${countyOptions(activeEstateRows(snapshot.estates), escape)}</select></label>
        <label><span>Property status</span><select data-estate-filter="status">
          <option value="all">All statuses</option>
          <option value="review" ${estateFilters.status === "review" ? "selected" : ""}>Needs review</option>
          <option value="blocked" ${estateFilters.status === "blocked" ? "selected" : ""}>Do not contact yet</option>
          <option value="ready" ${estateFilters.status === "ready" ? "selected" : ""}>Ready for team review</option>
        </select></label>
        <label><span>Minimum evidence</span><select data-estate-filter="minimumEvidence">
          ${[0, 3, 6, 10].map((value) => `<option value="${value}" ${Number(estateFilters.minimumEvidence) === value ? "selected" : ""}>${value ? `At least ${value} items` : "Any evidence"}</option>`).join("")}
        </select></label>
        <label><span>Missing info</span><select data-estate-filter="missing">
          <option value="all">Anything missing</option>
          <option value="tax" ${estateFilters.missing === "tax" ? "selected" : ""}>Tax history</option>
          <option value="heirs" ${estateFilters.missing === "heirs" ? "selected" : ""}>Heirs or family tree</option>
          <option value="probate" ${estateFilters.missing === "probate" ? "selected" : ""}>Probate status</option>
          <option value="phones" ${estateFilters.missing === "phones" ? "selected" : ""}>Phone numbers</option>
          <option value="podio" ${estateFilters.missing === "podio" ? "selected" : ""}>CRM review</option>
        </select></label>
        <label class="hr-estate-priority-filter beui-checkbox"><input type="checkbox" data-estate-filter="priorityOnly" ${estateFilters.priorityOnly ? "checked" : ""}><span>High priority only</span></label>
        <button type="button" class="hr-text-command" data-estate-filters-clear>Clear filters</button>
      </section>
      <div class="hr-community-grid" data-community-grid="estates" data-grid-label="Estates"></div>
    </section>
  `;
}

function mountEstatesGrid(root, bridge) {
  const container = root?.querySelector?.('[data-community-grid="estates"]');
  if (!container) return null;
  const snapshot = bridge.readState();
  const rows = activeEstateRows(snapshot.estates).map((estate) => ({ ...estate, evidenceLabel: evidenceLabel(estate) }));
  const controls = root.querySelector(".hr-grid-controls");
  const action = root.querySelector("[data-estates-add-queue]");
  const assist = root.querySelector("[data-estates-selection-assist]");
  const archiveAction = root.querySelector("[data-estates-archive]");
  const deleteAction = root.querySelector("[data-estates-delete]");
  const status = root.querySelector("[data-grid-status]");
  const statusRoot = () => root.isConnected
    ? root
    : root.ownerDocument?.querySelector?.('[data-operational-grid-view="estates"]') || root;
  const updateSelection = (selectedRows) => {
    const nextSelection = new Set(selectedRows.map((row) => String(row.id)));
    const selectionChanged = nextSelection.size !== estateSelection.size
      || [...nextSelection].some((estateId) => !estateSelection.has(estateId));
    estateSelection = nextSelection;
    const selectedCount = estateSelection.size;
    if (controls) controls.dataset.selectionActive = String(selectedCount > 0);
    if (assist) assist.hidden = selectedCount === 0;
    if (status && selectionChanged) {
      status.textContent = "";
      delete status.dataset.tone;
    }
    if (action) {
      action.disabled = selectedCount === 0;
      action.textContent = selectedCount === 1 ? "Queue for Doc Prep" : `Queue ${selectedCount} estates for Doc Prep`;
    }
    if (archiveAction) {
      archiveAction.disabled = selectedCount === 0;
      archiveAction.textContent = selectedCount === 1 ? "Archive estate" : `Archive ${selectedCount} estates`;
    }
    if (deleteAction) {
      deleteAction.disabled = selectedCount === 0;
      deleteAction.textContent = selectedCount === 1 ? "Delete estate" : `Delete ${selectedCount} estates`;
    }
  };
  const api = createCommunityGrid(container, {
    key: "estates",
    rows,
    columns: [
      { field: "title", headerName: "Estate", minWidth: 190, flex: 1.35, filter: "agTextColumnFilter" },
      { field: "address", headerName: "Property", minWidth: 220, flex: 1.45, filter: "agTextColumnFilter" },
      { field: "county", headerName: "County", minWidth: 130, filter: "agTextColumnFilter" },
      { field: "status", headerName: "Status", minWidth: 140, filter: "agTextColumnFilter" },
      { field: "evidenceLabel", headerName: "Evidence", minWidth: 120, comparator: (_left, _right, leftNode, rightNode) => Number(leftNode.data?.evidence || 0) - Number(rightNode.data?.evidence || 0), filter: "agTextColumnFilter" },
      { field: "nextAction", headerName: "Next action", minWidth: 220, flex: 1.35, filter: "agTextColumnFilter" },
    ],
    selectedIds: [...estateSelection],
    emptyMessage: "No estates match this filter.",
    onSelect: async (row) => {
      try {
        await bridge.dispatch("select-estate", { estateId: row.id });
      } catch {
        gridStatus(statusRoot(), "That estate is no longer available.", "blocked");
      }
    },
    onOpen: async (row) => {
      try {
        await bridge.dispatch("select-estate", { estateId: row.id });
        bridge.navigate("dossiers");
      } catch {
        gridStatus(statusRoot(), "That estate is no longer available.", "blocked");
      }
    },
    onSelectionChange: updateSelection,
  });
  if (estateQuery) setGridQuickFilter(api, estateQuery);
  const filterCount = root.querySelector("[data-estate-filter-count]");
  const updateRows = () => {
    const nextRows = filteredEstateRows(rows);
    setGridRows(api, nextRows);
    if (filterCount) {
      const activeCount = activeEstateFilterCount();
      filterCount.textContent = String(activeCount);
      filterCount.dataset.active = String(activeCount > 0);
    }
  };
  updateRows();
  root.querySelector("[data-grid-quick-filter]")?.addEventListener("input", (event) => {
    estateQuery = event.currentTarget.value;
    setGridQuickFilter(api, estateQuery);
  });
  root.querySelector("[data-estates-import-file]")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("heirright:open-estate-files"));
  });
  root.querySelector("[data-estate-filters-toggle]")?.addEventListener("click", (event) => {
    estateFiltersOpen = !estateFiltersOpen;
    event.currentTarget.setAttribute("aria-expanded", String(estateFiltersOpen));
    const panel = root.querySelector("#hrEstateFilters");
    if (panel) panel.hidden = !estateFiltersOpen;
  });
  root.querySelectorAll("[data-estate-filter]").forEach((control) => {
    control.addEventListener("change", () => {
      const key = control.dataset.estateFilter;
      estateFilters = {
        ...estateFilters,
        [key]: control.type === "checkbox"
          ? control.checked
          : key === "minimumEvidence"
            ? Number(control.value || 0)
            : control.value,
      };
      updateRows();
    });
  });
  root.querySelector("[data-estate-filters-clear]")?.addEventListener("click", () => {
    estateFilters = { county: "all", status: "all", minimumEvidence: 0, missing: "all", priorityOnly: false };
    root.querySelectorAll("[data-estate-filter]").forEach((control) => {
      const key = control.dataset.estateFilter;
      if (control.type === "checkbox") control.checked = false;
      else control.value = key === "minimumEvidence" ? "0" : "all";
    });
    updateRows();
  });
  action?.addEventListener("click", async () => {
    const estateIds = [...estateSelection];
    if (!estateIds.length) return;
    action.disabled = true;
    action.setAttribute("aria-busy", "true");
    try {
      await bridge.dispatch("s40-queue-estates", { estateIds });
      gridStatus(statusRoot(), `${estateIds.length} estate${estateIds.length === 1 ? "" : "s"} moved to Doc Prep.`, "ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      gridStatus(statusRoot(), message || "The selected estates could not be queued for Doc Prep.", "blocked");
    } finally {
      if (action.isConnected) {
        action.disabled = false;
        action.removeAttribute("aria-busy");
      }
    }
  });
  const runLifecycleAction = async (lifecycleAction, source) => {
    const estateIds = [...estateSelection];
    if (!estateIds.length) return;
    if (
      lifecycleAction === "delete"
      && !globalThis.confirm(`Delete ${estateIds.length} imported estate${estateIds.length === 1 ? "" : "s"} from the shared HeirRight workspace?`)
    ) {
      gridStatus(statusRoot(), "Deletion canceled.", "neutral");
      return;
    }
    const selectedBeforeDispatch = new Set(estateIds);
    estateSelection = new Set();
    [action, archiveAction, deleteAction].forEach((control) => {
      if (!control) return;
      control.disabled = true;
      control.setAttribute("aria-busy", "true");
    });
    try {
      await bridge.dispatch("estate-lifecycle", {
        estateIds,
        action: lifecycleAction,
        confirmed: lifecycleAction === "delete",
      });
      gridStatus(
        statusRoot(),
        `${estateIds.length} estate${estateIds.length === 1 ? "" : "s"} ${lifecycleAction === "delete" ? "deleted" : "archived"}.`,
        "ready",
      );
    } catch {
      estateSelection = selectedBeforeDispatch;
      gridStatus(
        statusRoot(),
        `The selected estate${estateIds.length === 1 ? "" : "s"} could not be ${lifecycleAction === "delete" ? "deleted" : "archived"}.`,
        "blocked",
      );
    } finally {
      [action, archiveAction, deleteAction].forEach((control) => {
        if (!control?.isConnected) return;
        control.removeAttribute("aria-busy");
      });
      source?.blur?.();
    }
  };
  archiveAction?.addEventListener("click", () => runLifecycleAction("archive", archiveAction));
  deleteAction?.addEventListener("click", () => runLifecycleAction("delete", deleteAction));
  return api;
}

export { activeEstateFilterCount, estateMatchesFilters, evidenceLabel, filteredEstateRows, mountEstatesGrid, renderEstatesGrid };
