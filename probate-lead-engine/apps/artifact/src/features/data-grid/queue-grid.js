import { escapeFor } from "../doc-prep/document-row.js";
import { gridStatus } from "./grid-status.js";

let queueSelection = new Set();
let queueQuery = "";
let removeQueueRailSelectionHandler = null;

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
      <div class="hr-beui-rail-host" data-beui-rail="queue" data-grid-label="Queue" data-selected-ids="${escape([...queueSelection].join(","))}" data-query="${escape(queueQuery)}"></div>
    </section>
  `;
}

function mountQueueGrid(root, bridge) {
  const container = root?.querySelector?.('[data-beui-rail="queue"]');
  if (!container) return null;
  removeQueueRailSelectionHandler?.();
  removeQueueRailSelectionHandler = null;
  const snapshot = bridge.readState();
  const rows = queueRows(snapshot);
  const exportButton = root.querySelector("[data-queue-export]");
  const count = root.querySelector("[data-grid-selection-count]");
  const updateSelection = (selectedRows) => {
    queueSelection = new Set(selectedRows.map((row) => String(row.id)));
    if (count) count.textContent = `${queueSelection.size} selected`;
    if (exportButton) exportButton.disabled = queueSelection.size === 0;
  };
  const selectionHandler = (event) => {
    const detail = event?.detail;
    if (detail?.target !== "queue") return;
    const selectedIds = Array.isArray(detail.estateIds) ? detail.estateIds.map(String) : [];
    const selectedRows = rows.filter((row) => selectedIds.includes(String(row.id)));
    updateSelection(selectedRows);
    const primary = selectedRows[0];
    if (!primary) return;
    void bridge.dispatch("select-estate", { estateId: primary.id }).catch(() => {
      gridStatus(root, "That estate is no longer available.", "blocked");
    });
  };
  window.addEventListener("heirright:beui-rail", selectionHandler);
  removeQueueRailSelectionHandler = () => window.removeEventListener("heirright:beui-rail", selectionHandler);
  const syncRailQuery = () => window.dispatchEvent(new CustomEvent("heirright:beui-rail-filter", {
    detail: { target: "queue", query: queueQuery },
  }));
  syncRailQuery();
  root.querySelector("[data-grid-quick-filter]")?.addEventListener("input", (event) => {
    queueQuery = event.currentTarget.value;
    syncRailQuery();
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
  return root;
}

export { mountQueueGrid, queueRows, renderQueueGrid, selectedQueueEstateIds };
