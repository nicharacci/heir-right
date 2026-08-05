import { escapeFor } from "../doc-prep/document-row.js";

function exportedRows(snapshot) {
  return (snapshot.estates || []).filter((row) => row.workflowState === "exported");
}

function renderExportView({ bridge }) {
  const snapshot = bridge.readState();
  const rows = exportedRows(snapshot);
  const escape = (value) => escapeFor(bridge, value);
  return `
    <section class="hr-grid-view s40-export-view" data-operational-grid-view="export">
      <header class="hr-grid-header">
        <div><p class="hr-grid-eyebrow">Export</p><h1>Verified handoffs</h1><p>Read back completed estate files that have left Doc Prep. ${escape(`${rows.length} exported file${rows.length === 1 ? "" : "s"}.`)}</p></div>
      </header>
      <div class="hr-beui-rail-host" data-beui-rail="export" data-grid-label="Exported estate files"></div>
    </section>
  `;
}

function mountExportView(root, bridge) {
  return root?.querySelector?.('[data-beui-rail="export"]') || null;
}

function unmountExportView() {}

export { exportedRows, mountExportView, renderExportView, unmountExportView };
