import { escapeFor, relativeUpdate } from "../doc-prep/document-row.js";
import { createCommunityGrid, destroyCommunityGrid, setGridQuickFilter } from "./community-grid.js";

let adminAuditMount = null;
let adminAuditApi = null;
let adminQuery = "";

function displayTone(tone) {
  return {
    ready: "Ready",
    complete: "Complete",
    check: "Checked",
    blocked: "Needs review",
    review: "Review",
    route: "Opened",
  }[String(tone || "").toLowerCase()] || "Update";
}

function adminAuditRows(snapshot = {}) {
  return (snapshot.activity || []).map((event, index) => ({
    id: `audit-${Number(event.updatedAt || 0)}-${index}`,
    title: event.title || "Workspace update",
    copy: event.copy || "Review the workspace update.",
    status: displayTone(event.tone),
    updated: relativeUpdate(event.updatedAt),
    updatedAt: Number(event.updatedAt || 0),
  }));
}

function renderAdminAuditHost(snapshot, bridge) {
  const escape = (value) => escapeFor(bridge, value);
  return `
    <section class="hr-admin-audit" aria-labelledby="hrAdminAuditTitle">
      <header class="hr-admin-audit-header">
        <div><p class="hr-grid-eyebrow">Audit</p><h3 id="hrAdminAuditTitle">Workspace activity</h3><p>Open a row with Enter to review the operator-facing event.</p></div>
        <label class="hr-grid-search"><span>Filter activity</span><input type="search" value="${escape(adminQuery)}" data-grid-quick-filter placeholder="Action, status, or update"></label>
      </header>
      <div class="hr-community-grid hr-admin-audit-grid" data-community-grid="admin-audit" data-grid-label="Admin audit activity"></div>
    </section>
  `;
}

function mountAdminAuditGrid(root, bridge, snapshot = bridge?.readState?.()) {
  const legacyHost = root?.querySelector?.(".team-activity-layout");
  if (!legacyHost || !bridge || snapshot?.activeView !== "admin") return null;
  if (adminAuditMount === legacyHost && adminAuditApi && legacyHost.querySelector('[data-community-grid="admin-audit"]')) {
    adminAuditApi.setGridOption("rowData", adminAuditRows(snapshot));
    setGridQuickFilter(adminAuditApi, adminQuery);
    return adminAuditApi;
  }
  destroyCommunityGrid("admin-audit");
  adminAuditMount = legacyHost;
  legacyHost.classList.add("hr-admin-audit-host");
  legacyHost.innerHTML = renderAdminAuditHost(snapshot, bridge);
  const container = legacyHost.querySelector('[data-community-grid="admin-audit"]');
  const api = createCommunityGrid(container, {
    key: "admin-audit",
    rows: adminAuditRows(snapshot),
    columns: [
      { field: "title", headerName: "Event", minWidth: 190, flex: 1.15, filter: "agTextColumnFilter" },
      { field: "copy", headerName: "Operator update", minWidth: 280, flex: 1.8, filter: "agTextColumnFilter" },
      { field: "status", headerName: "Status", minWidth: 130, filter: "agTextColumnFilter" },
      { field: "updated", headerName: "Updated", minWidth: 140, sortable: false, filter: "agTextColumnFilter" },
    ],
    selectionMode: "single",
    pageSize: 10,
    emptyMessage: "No workspace activity has been recorded yet.",
    onOpen: (row) => bridge.emit("Audit event reviewed", `${row.title}: ${row.copy}`, "review"),
  });
  adminAuditApi = api;
  if (adminQuery) setGridQuickFilter(api, adminQuery);
  legacyHost.querySelector("[data-grid-quick-filter]")?.addEventListener("input", (event) => {
    adminQuery = event.currentTarget.value;
    setGridQuickFilter(api, adminQuery);
  });
  return api;
}

function resetAdminAuditMount() {
  destroyCommunityGrid("admin-audit");
  adminAuditMount = null;
  adminAuditApi = null;
}

export { adminAuditRows, mountAdminAuditGrid, renderAdminAuditHost, resetAdminAuditMount };
