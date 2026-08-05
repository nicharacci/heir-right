import { escapeFor, relativeUpdate } from "../doc-prep/document-row.js";

let adminAuditMount = null;
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
      <div class="hr-admin-audit-grid hr-beui-rail-host" data-beui-rail="admin-audit" data-grid-label="Admin audit activity" data-query="${escape(adminQuery)}"></div>
    </section>
  `;
}

function mountAdminAuditGrid(root, bridge, snapshot = bridge?.readState?.()) {
  const legacyHost = root?.querySelector?.(".team-activity-layout");
  if (!legacyHost || !bridge || snapshot?.activeView !== "admin") return null;
  if (adminAuditMount === legacyHost && legacyHost.querySelector('[data-beui-rail="admin-audit"]')) {
    window.dispatchEvent(new CustomEvent("heirright:beui-rail-filter", {
      detail: { target: "admin-audit", query: adminQuery },
    }));
    return legacyHost;
  }
  adminAuditMount = legacyHost;
  legacyHost.classList.add("hr-admin-audit-host");
  legacyHost.innerHTML = renderAdminAuditHost(snapshot, bridge);
  legacyHost.querySelector("[data-grid-quick-filter]")?.addEventListener("input", (event) => {
    adminQuery = event.currentTarget.value;
    window.dispatchEvent(new CustomEvent("heirright:beui-rail-filter", {
      detail: { target: "admin-audit", query: adminQuery },
    }));
  });
  return legacyHost;
}

function resetAdminAuditMount() {
  adminAuditMount = null;
}

export { adminAuditRows, mountAdminAuditGrid, renderAdminAuditHost, resetAdminAuditMount };
