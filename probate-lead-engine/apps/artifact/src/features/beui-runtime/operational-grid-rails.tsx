import { useEffect, useMemo, useState } from "react";
import { Button } from "../../beui-foundation/components/motion/button/base";
import { Table, type TableColumn } from "../../beui-foundation/components/motion/table";
import type { BeuiBridgeAdapter, LegacyState } from "./bridge-adapter";

type RailRecord = Record<string, unknown>;

type EstateRailRow = {
  id: string;
  title: string;
  address: string;
  county: string;
  status: string;
  evidence: number;
  evidenceTotal: number;
  nextAction: string;
  source: string;
  workflowState: string;
  packetState: string;
};

type AdminRailRow = {
  id: string;
  title: string;
  copy: string;
  status: string;
  updated: string;
};

type EstateFilters = {
  county: string;
  status: string;
  minimumEvidence: number;
  missing: string;
  priorityOnly: boolean;
};

function record(value: unknown): RailRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RailRecord
    : {};
}

function text(value: unknown, fallback = "") {
  const result = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return result || fallback;
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function normalize(value: unknown) {
  return text(value).toLowerCase();
}

function useLegacySnapshot(adapter: BeuiBridgeAdapter) {
  const [snapshot, setSnapshot] = useState(() => adapter.readState());
  useEffect(() => adapter.subscribe((next) => setSnapshot(next)), [adapter]);
  return snapshot;
}

function selectedIds(element: HTMLElement) {
  return text(element.dataset.selectedIds).split(",").map((id) => id.trim()).filter(Boolean);
}

function estateRows(snapshot: LegacyState) {
  const source = record(snapshot);
  return list(source.estates).map((value) => {
    const row = record(value);
    const evidence = Number(row.evidence || 0);
    const evidenceTotal = Number(row.evidenceTotal || 0);
    return {
      id: text(row.id),
      title: text(row.title, "Estate file"),
      address: text(row.address, "Address needs review"),
      county: text(row.county, "Unassigned"),
      status: text(row.status, "Needs review"),
      evidence,
      evidenceTotal,
      nextAction: text(row.nextAction, "Review estate"),
      source: text(row.source, "Workspace"),
      workflowState: text(row.workflowState, "active"),
      packetState: "Review before export",
      missingTypes: list(row.missingTypes).map(normalize),
      score: Number(row.score || 0),
      tone: text(row.tone),
      handoff: record(row.handoff),
      workflowArtifact: record(row.workflowArtifact),
      exportedAt: text(row.exportedAt),
    };
  }).filter((row) => Boolean(row.id));
}

function initialEstateFilters(element: HTMLElement): EstateFilters {
  return {
    county: text(element.dataset.filterCounty, "all"),
    status: text(element.dataset.filterStatus, "all"),
    minimumEvidence: Number(element.dataset.filterMinimumEvidence || 0),
    missing: text(element.dataset.filterMissing, "all"),
    priorityOnly: element.dataset.filterPriorityOnly === "true",
  };
}

function matchesEstateFilters(row: ReturnType<typeof estateRows>[number], filters: EstateFilters) {
  if (row.workflowState && row.workflowState !== "active") return false;
  if (filters.county !== "all" && normalize(row.county) !== normalize(filters.county)) return false;
  if (filters.status !== "all" && ![row.status, row.tone].some((value) => normalize(value).includes(normalize(filters.status)))) return false;
  if (row.evidence < filters.minimumEvidence) return false;
  if (filters.missing !== "all" && !row.missingTypes.some((value) => value === normalize(filters.missing))) return false;
  return !(filters.priorityOnly && row.score < 75);
}

function railEvent(target: string, element: HTMLElement, detail: RailRecord) {
  window.dispatchEvent(new CustomEvent("heirright:beui-rail", { detail: { target, element, ...detail } }));
}

function EstateRail({ adapter, element }: { adapter: BeuiBridgeAdapter; element: HTMLElement }) {
  const snapshot = useLegacySnapshot(adapter);
  const [query, setQuery] = useState(() => text(element.dataset.query));
  const [filters, setFilters] = useState(() => initialEstateFilters(element));
  const [activeSelection, setActiveSelection] = useState(() => selectedIds(element));
  const rows = estateRows(snapshot);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; query?: string; filters?: EstateFilters }>).detail;
      if (detail?.target !== "estates") return;
      if (typeof detail.query === "string") setQuery(detail.query);
      if (detail.filters) setFilters(detail.filters);
    };
    window.addEventListener("heirright:beui-rail-filter", listener);
    return () => window.removeEventListener("heirright:beui-rail-filter", listener);
  }, []);
  const data = useMemo(() => rows.filter((row) => {
    const matchesQuery = !query || `${row.title} ${row.address} ${row.county} ${row.status}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && matchesEstateFilters(row, filters);
  }), [filters, query, rows]);
  const columns: TableColumn<EstateRailRow>[] = [
    {
      key: "title",
      header: "Estate",
      width: "20%",
      cell: (row) => <button type="button" className="hr-beui-rail-open" onClick={() => {
        void Promise.resolve(adapter.dispatch("select-estate", { estateId: row.id }))
          .then(() => adapter.navigate("dossiers"))
          .catch(() => adapter.emit("Estate selection blocked", "That estate is no longer available.", "blocked"));
      }}>{row.title}</button>,
    },
    { key: "address", header: "Property", width: "23%" },
    { key: "county", header: "County", width: "13%" },
    { key: "status", header: "Status", width: "14%" },
    {
      key: "evidence",
      header: "Evidence",
      width: "12%",
      cell: (row) => <span>{row.evidenceTotal ? `${row.evidence} of ${row.evidenceTotal}` : `${row.evidence} items`}</span>,
    },
    { key: "nextAction", header: "Next action", width: "18%" },
  ];
  return <div className="hr-beui-rail" data-beui-foundation="public">
    <Table
      data={data}
      columns={columns}
      getRowId={(row) => row.id}
      selectable
      selectedRowIds={activeSelection}
      onSelectionChange={(estateIds) => {
        setActiveSelection(estateIds);
        railEvent("estates", element, { estateIds });
      }}
      rowHeight={48}
      height={560}
      emptyState="No estates match this filter."
      className="hr-beui-table"
    />
  </div>;
}

function QueueRail({ adapter, element }: { adapter: BeuiBridgeAdapter; element: HTMLElement }) {
  const snapshot = useLegacySnapshot(adapter);
  const [query, setQuery] = useState(() => text(element.dataset.query));
  const [removingId, setRemovingId] = useState("");
  const [activeSelection, setActiveSelection] = useState(() => selectedIds(element));
  const source = record(snapshot);
  const queueIds = new Set(list(source.queueIds).map((id) => text(id)));
  const data = estateRows(snapshot)
    .filter((row) => queueIds.has(row.id))
    .map((row) => ({
      ...row,
      packetState: row.id === text(source.selectedEstateId) && record(source.docPrep).packetVerified === true
        ? "Packet verified"
        : "Review before export",
    }))
    .filter((row) => !query || `${row.title} ${row.address} ${row.status} ${row.packetState}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; query?: string }>).detail;
      if (detail?.target === "queue") setQuery(text(detail.query));
    };
    window.addEventListener("heirright:beui-rail-filter", listener);
    return () => window.removeEventListener("heirright:beui-rail-filter", listener);
  }, []);
  const columns: TableColumn<EstateRailRow>[] = [
    {
      key: "title",
      header: "Estate",
      width: "21%",
      cell: (row) => <button type="button" className="hr-beui-rail-open" onClick={() => {
        void Promise.resolve(adapter.dispatch("select-estate", { estateId: row.id }))
          .then(() => adapter.navigate("dossiers"))
          .catch(() => adapter.emit("Estate selection blocked", "That estate is no longer available.", "blocked"));
      }}>{row.title}</button>,
    },
    { key: "address", header: "Property", width: "25%" },
    { key: "status", header: "Lead state", width: "15%" },
    { key: "packetState", header: "Packet", width: "17%" },
    { key: "source", header: "Source", width: "14%" },
    {
      key: "id",
      header: "",
      width: "8%",
      cell: (row) => <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={removingId === row.id}
        onClick={() => {
          setRemovingId(row.id);
          void Promise.resolve(adapter.dispatch("remove-from-queue", { estateId: row.id }))
            .then(() => {
              const nextSelection = activeSelection.filter((estateId) => estateId !== row.id);
              setActiveSelection(nextSelection);
              railEvent("queue", element, { estateIds: nextSelection });
              adapter.emit("Queue updated", `${row.title} was removed from Queue.`, "ready");
            })
            .catch(() => adapter.emit("Queue update blocked", "The estate could not be removed from Queue.", "blocked"))
            .finally(() => setRemovingId(""));
        }}
      >{removingId === row.id ? "Removing…" : "Remove"}</Button>,
    },
  ];
  return <div className="hr-beui-rail" data-beui-foundation="public">
    <Table
      data={data}
      columns={columns}
      getRowId={(row) => row.id}
      selectable
      selectedRowIds={activeSelection}
      onSelectionChange={(estateIds) => {
        setActiveSelection(estateIds);
        railEvent("queue", element, { estateIds });
      }}
      rowHeight={48}
      height={520}
      emptyState="No estates are queued yet."
      className="hr-beui-table"
    />
  </div>;
}

function sameOriginArtifactHref(artifact: RailRecord) {
  const candidate = text(artifact.artifactUrl);
  if (!candidate) return "";
  try {
    const origin = globalThis.location?.origin || "";
    const url = new URL(candidate, origin);
    return origin && url.origin === origin ? url.href : "";
  } catch {
    return "";
  }
}

function ExportRail({ adapter, element }: { adapter: BeuiBridgeAdapter; element: HTMLElement }) {
  const snapshot = useLegacySnapshot(adapter);
  const data = estateRows(snapshot)
    .filter((row) => row.workflowState === "exported")
    .map((row) => ({
      ...row,
      handoffStatus: record(row.handoff).readbackStatus === "verified" ? "Verified readback" : "Review needed",
      artifactStatus: record(row.workflowArtifact).artifactId ? "Verified PDF" : "PDF unavailable",
    }));
  const columns: TableColumn<(typeof data)[number]>[] = [
    { key: "title", header: "Estate", width: "21%" },
    { key: "address", header: "Property address", width: "27%" },
    { key: "handoffStatus", header: "Handoff", width: "16%" },
    { key: "artifactStatus", header: "Packet", width: "14%" },
    { key: "exportedAt", header: "Exported", width: "14%" },
    {
      key: "workflowArtifact",
      header: "PDF",
      width: "8%",
      cell: (row) => {
        const href = sameOriginArtifactHref(record(row.workflowArtifact));
        return href ? <a className="hr-beui-rail-open" href={href} target="_blank" rel="noopener noreferrer">Open PDF</a> : "Unavailable";
      },
    },
  ];
  return <div className="hr-beui-rail" data-beui-foundation="public">
    <Table data={data} columns={columns} getRowId={(row) => row.id} rowHeight={48} height={520} emptyState="No estate files have completed export handoff." className="hr-beui-table" />
  </div>;
}

function relativeUpdate(value: unknown) {
  const updatedAt = Number(value || 0);
  if (!updatedAt) return "Recently";
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60_000));
  return minutes < 1 ? "Just now" : minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
}

function AdminRail({ adapter, element }: { adapter: BeuiBridgeAdapter; element: HTMLElement }) {
  const snapshot = useLegacySnapshot(adapter);
  const [query, setQuery] = useState(() => text(element.dataset.query));
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; query?: string }>).detail;
      if (detail?.target === "admin-audit") setQuery(text(detail.query));
    };
    window.addEventListener("heirright:beui-rail-filter", listener);
    return () => window.removeEventListener("heirright:beui-rail-filter", listener);
  }, []);
  const data: AdminRailRow[] = list(record(snapshot).activity).map((value, index) => {
    const row = record(value);
    const tone = normalize(row.tone);
    const status = ({ ready: "Ready", complete: "Complete", check: "Checked", blocked: "Needs review", review: "Review", route: "Opened" } as Record<string, string>)[tone] || "Update";
    return {
      id: `audit-${Number(row.updatedAt || 0)}-${index}`,
      title: text(row.title, "Workspace update"),
      copy: text(row.copy, "Review the workspace update."),
      status,
      updated: relativeUpdate(row.updatedAt),
    };
  }).filter((row) => !query || `${row.title} ${row.copy} ${row.status} ${row.updated}`.toLowerCase().includes(query.toLowerCase()));
  const columns: TableColumn<AdminRailRow>[] = [
    {
      key: "title",
      header: "Event",
      width: "22%",
      cell: (row) => <button type="button" className="hr-beui-rail-open" onClick={() => adapter.emit("Audit event reviewed", `${row.title}: ${row.copy}`, "review")}>{row.title}</button>,
    },
    { key: "copy", header: "Operator update", width: "44%" },
    { key: "status", header: "Status", width: "16%" },
    { key: "updated", header: "Updated", width: "18%" },
  ];
  return <div className="hr-beui-rail hr-beui-admin-rail" data-beui-foundation="public">
    <Table data={data} columns={columns} getRowId={(row) => row.id} rowHeight={48} height={420} emptyState="No workspace activity has been recorded yet." className="hr-beui-table" />
  </div>;
}

function ShellQueueRail({ adapter, element }: { adapter: BeuiBridgeAdapter; element: HTMLElement }) {
  const snapshot = useLegacySnapshot(adapter);
  const source = record(snapshot);
  const exportQueue = element.dataset.shellQueueKind === "export";
  const data = list(exportQueue ? source.exportQueue : source.docPrepEstates).map((value) => {
    const row = record(value);
    const workflowState = text(row.workflowState, "queued");
    const status = text(row.workflowLabel, ({
      queued: "Queued for Doc Prep",
      processing: "Preparing packet",
      "completed-awaiting-export": "Ready for export",
      blocked: "Needs attention",
      exported: "Exported",
    } as Record<string, string>)[workflowState] || "In review");
    return {
      id: text(row.id),
      title: text(row.title, "Estate file"),
      address: text(row.address, "Address unavailable"),
      status,
      notification: text(row.workflowBlocker, workflowState === "completed-awaiting-export" ? "Verified report is ready for export." : "Workflow state updated."),
      view: exportQueue && workflowState === "exported" ? "export" : "dossiers",
    };
  }).filter((row) => Boolean(row.id));
  const columns: TableColumn<(typeof data)[number]>[] = [
    {
      key: "title",
      header: "Estate",
      width: "32%",
      cell: (row) => <button type="button" className="hr-beui-rail-open" onClick={() => {
        void Promise.resolve(adapter.dispatch("select-estate", { estateId: row.id }))
          .then(() => adapter.navigate(row.view))
          .catch(() => adapter.emit("Estate selection blocked", "That estate is no longer available.", "blocked"));
      }}><strong>{row.title}</strong><span className="shell-beui-rail-address">{row.address}</span></button>,
    },
    { key: "status", header: "Status", width: "24%" },
    { key: "notification", header: "Notification", width: "44%" },
  ];
  return <div className="hr-beui-rail shell-beui-rail" data-beui-foundation="public">
    <Table data={data} columns={columns} getRowId={(row) => row.id} rowHeight={54} height={340} emptyState="No estates are waiting in this queue." className="hr-beui-table" />
  </div>;
}

export function renderOperationalGridRail(adapter: BeuiBridgeAdapter, element: HTMLElement) {
  switch (element.dataset.beuiRail) {
    case "estates": return <EstateRail adapter={adapter} element={element} />;
    case "queue": return <QueueRail adapter={adapter} element={element} />;
    case "export": return <ExportRail adapter={adapter} element={element} />;
    case "admin-audit": return <AdminRail adapter={adapter} element={element} />;
    case "shell-queue": return <ShellQueueRail adapter={adapter} element={element} />;
    default: return null;
  }
}
