import { escapeFor } from "../doc-prep/document-row.js";
import { createCommunityGrid, destroyCommunityGrid } from "../data-grid/community-grid.js";

function sameOriginArtifactHref(artifact) {
  const candidate = String(artifact?.artifactUrl || "").trim();
  if (!candidate) return "";
  try {
    const origin = globalThis.location?.origin || "";
    const url = new URL(candidate, origin);
    return origin && url.origin === origin ? url.href : "";
  } catch {
    return "";
  }
}

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
      <div class="hr-community-grid" data-community-grid="export" data-grid-label="Exported estate files"></div>
    </section>
  `;
}

function mountExportView(root, bridge) {
  const container = root?.querySelector?.('[data-community-grid="export"]');
  if (!container) return null;
  const rows = exportedRows(bridge.readState()).map((row) => ({
    ...row,
    handoffStatus: row.workflowState === "exported" && row.handoff?.readbackStatus === "verified" ? "Verified readback" : "Review needed",
    artifactStatus: row.workflowArtifact?.artifactId ? "Verified PDF" : "PDF unavailable",
  }));
  return createCommunityGrid(container, {
    key: "export",
    rows,
    columns: [
      { field: "title", headerName: "Estate", minWidth: 190, flex: 1.25 },
      { field: "address", headerName: "Property address", minWidth: 230, flex: 1.45 },
      { field: "handoffStatus", headerName: "Handoff", minWidth: 150 },
      { field: "artifactStatus", headerName: "Packet", minWidth: 130 },
      { field: "exportedAt", headerName: "Exported", minWidth: 170 },
      {
        field: "workflowArtifact",
        headerName: "PDF",
        minWidth: 110,
        sortable: false,
        filter: false,
        cellRenderer: ({ data }) => {
          const href = sameOriginArtifactHref(data?.workflowArtifact);
          if (!href) return "Unavailable";
          const link = document.createElement("a");
          link.href = href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = "Open PDF";
          link.addEventListener("click", (event) => event.stopPropagation());
          return link;
        },
      },
    ],
    selectionMode: "single",
    emptyMessage: "No estate files have completed export handoff.",
  });
}

function unmountExportView() {
  destroyCommunityGrid("export");
}

export { exportedRows, mountExportView, renderExportView, unmountExportView };
