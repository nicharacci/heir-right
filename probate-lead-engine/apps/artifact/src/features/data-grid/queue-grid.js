import { escapeFor } from "../doc-prep/document-row.js";
import { createCommunityGrid, gridStatus, setGridQuickFilter } from "./community-grid.js";

let queueSelection = new Set();
let queueQuery = "";

function selectedQueueEstateIds(rows = [], selection = queueSelection) {
  const queuedIds = new Set(rows.map((row) => String(row.id)));
  return [...selection].map(String).filter((id) => queuedIds.has(id));
}

function queueRows(snapshot) {
  const queued = new Set((snapshot.queueIds || []).map(String));
  return (snapshot.estates || [])
    .filter((estate) => queued.has(String(estate.id)))
    .map((estate) => ({
      ...estate,
      packetState: estate.id === snapshot.selectedEstateId && snapshot.docPrep?.packetVerified
        ? "Packet verified"
        : "Review before export",
    }));
}

function renderQueueGrid({ bridge }) {
  const snapshot = bridge.readState();
  const rows = queueRows(snapshot);
  const queuedIds = new Set(rows.map((row) => String(row.id)));
  queueSelection = new Set([...queueSelection].filter((id) => queuedIds.has(String(id))));
  const selectedCount = queueSelection.size;
  const escape = (value) => escapeFor(bridge, value);
  return `
    <section class="hr-grid-view" data-operational-grid-view="queue">
      <header class="hr-grid-header">
        <div><p class="hr-grid-eyebrow">Queue</p><h1>Batch export</h1><p>Review the staged estate packets, then export one combined PDF for the selected rows.</p></div>
        <div class="hr-grid-controls">
          <label class="hr-grid-search"><span>Filter Queue</span><input type="search" value="${escape(queueQuery)}" data-grid-quick-filter placeholder="Estate, property, or status"></label>
          <button type="button" class="hr-grid-primary-action" data-queue-export ${selectedCount ? "" : "disabled"}>Export combined PDF</button>
        </div>
      </header>
      <div class="hr-grid-meta"><span>${escape(`${rows.length} queued estate${rows.length === 1 ? "" : "s"}`)}</span><span data-grid-selection-count>${escape(`${selectedCount} selected`)}</span><span data-grid-status aria-live="polite"></span></div>
      <div class="hr-community-grid" data-community-grid="queue" data-grid-label="Queue"></div>
    </section>
  `;
}

function removeCellRenderer(onRemove) {
  return (params) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hr-grid-row-action";
    button.textContent = "Remove";
    button.setAttribute("aria-label", `Remove ${params.data.title} from Queue`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onRemove(params.data, button);
    });
    return button;
  };
}

function mountQueueGrid(root, bridge) {
  const container = root?.querySelector?.('[data-community-grid="queue"]');
  if (!container) return null;
  const snapshot = bridge.readState();
  const rows = queueRows(snapshot);
  const exportButton = root.querySelector("[data-queue-export]");
  const count = root.querySelector("[data-grid-selection-count]");
  const updateSelection = (selectedRows) => {
    queueSelection = new Set(selectedRows.map((row) => String(row.id)));
    if (count) count.textContent = `${queueSelection.size} selected`;
    if (exportButton) exportButton.disabled = queueSelection.size === 0;
  };
  const api = createCommunityGrid(container, {
    key: "queue",
    rows,
    columns: [
      { field: "title", headerName: "Estate", minWidth: 190, flex: 1.25, filter: "agTextColumnFilter" },
      { field: "address", headerName: "Property", minWidth: 220, flex: 1.35, filter: "agTextColumnFilter" },
      { field: "status", headerName: "Lead state", minWidth: 140, filter: "agTextColumnFilter" },
      { field: "packetState", headerName: "Packet", minWidth: 160, filter: "agTextColumnFilter" },
      { field: "source", headerName: "Source", minWidth: 150, filter: "agTextColumnFilter" },
      {
        colId: "remove",
        headerName: "",
        width: 100,
        minWidth: 100,
        maxWidth: 100,
        sortable: false,
        filter: false,
        cellRenderer: removeCellRenderer(async (row, button) => {
          button.disabled = true;
          try {
            await bridge.dispatch("remove-from-queue", { estateId: row.id });
            queueSelection.delete(String(row.id));
            gridStatus(root, `${row.title} removed from Queue.`, "ready");
          } catch {
            gridStatus(root, "The estate could not be removed from Queue.", "blocked");
            if (button.isConnected) button.disabled = false;
          }
        }),
      },
    ],
    selectedIds: [...queueSelection],
    emptyMessage: "No estates are queued yet.",
    onSelect: (row) => bridge.dispatch("select-estate", { estateId: row.id }).catch(() => {
      gridStatus(root, "That estate is no longer available.", "blocked");
    }),
    onOpen: async (row) => {
      try {
        await bridge.dispatch("select-estate", { estateId: row.id });
        bridge.navigate("dossiers");
      } catch {
        gridStatus(root, "That estate is no longer available.", "blocked");
      }
    },
    onSelectionChange: updateSelection,
  });
  if (queueQuery) setGridQuickFilter(api, queueQuery);
  root.querySelector("[data-grid-quick-filter]")?.addEventListener("input", (event) => {
    queueQuery = event.currentTarget.value;
    setGridQuickFilter(api, queueQuery);
  });
  exportButton?.addEventListener("click", async () => {
    const estateIds = selectedQueueEstateIds(rows);
    if (!estateIds.length) return;
    exportButton.disabled = true;
    exportButton.setAttribute("aria-busy", "true");
    try {
      await bridge.dispatch("export", { route: "pdf", estateIds });
      gridStatus(root, `Combined PDF created for ${estateIds.length} estate${estateIds.length === 1 ? "" : "s"}.`, "ready");
    } catch {
      gridStatus(root, "The combined PDF could not be created. Review the queued packet blockers and retry.", "blocked");
    } finally {
      if (exportButton.isConnected) {
        exportButton.disabled = queueSelection.size === 0;
        exportButton.removeAttribute("aria-busy");
      }
    }
  });
  return api;
}

export { mountQueueGrid, queueRows, renderQueueGrid, selectedQueueEstateIds };
