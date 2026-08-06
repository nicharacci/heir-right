import { useEffect, useMemo, useState } from "react";
import { AnimatedBadge } from "../../beui-foundation/components/motion/animated-badge";
import { Button } from "../../beui-foundation/components/motion/button/base";
import { Table, type TableColumn } from "../../beui-foundation/components/motion/table";
import type { BeuiBridgeAdapter, LegacyState } from "./bridge-adapter";
import { renderOperationalGridRail } from "./operational-grid-rails";

type EstateRow = {
  id: string;
  title: string;
  address: string;
  workflowState: string;
  workflowStages: Array<Record<string, unknown>>;
};

type BatchRow = EstateRow & {
  stage: string;
  detail: string;
  state: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown, fallback = "") {
  const valueText = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return valueText || fallback;
}

function estateRows(snapshot: LegacyState): EstateRow[] {
  const source = record(snapshot);
  return (Array.isArray(source.docPrepEstates) ? source.docPrepEstates : [])
    .map((value) => {
      const row = record(value);
      const id = text(row.id);
      if (!id) return null;
      return {
        id,
        title: text(row.title, "Estate file"),
        address: text(row.address, "Address needs review"),
        workflowState: text(row.workflowState, "queued"),
        workflowStages: (Array.isArray(row.workflowStages) ? row.workflowStages : []).map(record),
      };
    })
    .filter((row): row is EstateRow => Boolean(row));
}

function parseIds(value: string | undefined) {
  return String(value || "").split(",").map((id) => id.trim()).filter(Boolean);
}

function useLegacySnapshot(adapter: BeuiBridgeAdapter) {
  const [snapshot, setSnapshot] = useState(() => adapter.readState());
  useEffect(() => adapter.subscribe((next) => setSnapshot(next)), [adapter]);
  return snapshot;
}

function currentStage(row: EstateRow) {
  const active = row.workflowStages.find((stage) => text(stage.status) === "active");
  const blocked = row.workflowStages.find((stage) => text(stage.status) === "blocked");
  const pending = row.workflowStages.find((stage) => text(stage.status) === "pending");
  const stage = active || blocked || pending || row.workflowStages[row.workflowStages.length - 1];
  if (active) return { stage: text(stage?.label, "Checking source records"), detail: "Working through the estate file", state: "active" };
  if (blocked) return { stage: text(stage?.label, "Review required"), detail: "Review required before continuing", state: "blocked" };
  if (row.workflowState === "completed-awaiting-export") return { stage: "Packet ready", detail: "Waiting for controlled export", state: "complete" };
  if (row.workflowState === "exported") return { stage: "Exported", detail: "Handed off to the approved destination", state: "complete" };
  return { stage: text(stage?.label, "Queued for Doc Prep"), detail: row.workflowState === "processing" ? "Starting the estate file" : "Waiting to start", state: "pending" };
}

function badgeStatus(state: string) {
  if (state === "active") return "loading" as const;
  if (state === "blocked") return "warning" as const;
  if (state === "complete") return "success" as const;
  return "neutral" as const;
}

function stateLabel(state: string) {
  if (state === "active") return "In progress";
  if (state === "blocked") return "Review required";
  if (state === "complete") return "Complete";
  return "Queued";
}

function QueueRail({ adapter, element }: { adapter: BeuiBridgeAdapter; element: HTMLElement }) {
  const snapshot = useLegacySnapshot(adapter);
  const rows = estateRows(snapshot);
  const initialIds = parseIds(element.dataset.estateIds);
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [query, setQuery] = useState("");
  const slotId = element.dataset.s40BeuiQueue || "docprep-queue";

  useEffect(() => setSelectedIds(parseIds(element.dataset.estateIds)), [element.dataset.estateIds]);
  useEffect(() => {
    const onQuery = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string; query?: string }>).detail;
      if (detail?.target === slotId) setQuery(String(detail.query || ""));
    };
    window.addEventListener("s40-docprep-query", onQuery);
    return () => window.removeEventListener("s40-docprep-query", onQuery);
  }, [slotId]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? rows.filter((row) => `${row.title} ${row.address}`.toLowerCase().includes(normalized))
      : rows;
  }, [query, rows]);
  const columns: TableColumn<EstateRow>[] = [
    { key: "title", header: "Estate", width: "48%" },
    { key: "address", header: "Address", width: "52%" },
  ];

  return <div className="s40-beui-rail" data-beui-foundation="public">
    <Table
      data={filteredRows}
      columns={columns}
      getRowId={(row) => row.id}
      selectable
      selectedRowIds={selectedIds}
      resizable
      minColumnWidth={160}
      onSelectionChange={(nextIds) => {
        setSelectedIds(nextIds);
        window.dispatchEvent(new CustomEvent("s40-docprep-selection", { detail: { estateIds: nextIds } }));
      }}
      rowHeight={40}
      height={480}
      emptyState="No queued estates match the current search."
      className="s40-beui-table"
    />
  </div>;
}

function BatchProgressRail({ adapter, element }: { adapter: BeuiBridgeAdapter; element: HTMLElement }) {
  const snapshot = useLegacySnapshot(adapter);
  const rows = estateRows(snapshot);
  const selectedIds = parseIds(element.dataset.estateIds);
  const selected = rows.filter((row) => selectedIds.includes(row.id));
  const batch = (selected.length ? selected : rows.filter((row) => row.workflowState === "processing"))
    .map((row) => ({ ...row, ...currentStage(row) }));
  const activeCount = batch.filter((row) => row.state === "active").length;
  const [stopping, setStopping] = useState(false);
  const activeEstateIds = batch
    .filter((row) => row.workflowState === "processing")
    .map((row) => row.id);
  const columns: TableColumn<BatchRow>[] = [
    { key: "title", header: "Estate", width: "30%" },
    {
      key: "stage",
      header: "Current step",
      width: "42%",
      cell: (row) => <span className="s40-beui-stage"><strong>{row.stage}</strong><span>{row.detail}</span></span>,
    },
    {
      key: "state",
      header: "State",
      width: "28%",
      cell: (row) => <AnimatedBadge status={badgeStatus(row.state)} size="sm" pulse={false} showIcon>{stateLabel(row.state)}</AnimatedBadge>,
    },
  ];

  return <section className="s40-beui-batch-rail" data-beui-foundation="public" aria-labelledby="s40BatchProgressTitle">
    <header>
      <div>
        <p>Doc Prep batch</p>
        <h2 id="s40BatchProgressTitle">Progress by estate</h2>
        <span>{activeCount ? `${activeCount} estate${activeCount === 1 ? "" : "s"} running` : "Waiting for the next durable update"}</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={activeEstateIds.length === 0 || stopping}
        onClick={() => {
          setStopping(true);
          void Promise.resolve(adapter.dispatch("s40-stop-docprep", { estateIds: activeEstateIds }))
            .catch(() => adapter.emit("Doc Prep stop blocked", "The active Doc Prep batch could not be stopped. Review the estate state and retry.", "blocked"))
            .finally(() => setStopping(false));
        }}
      >
        {stopping ? "Stopping…" : "Stop batch"}
      </Button>
    </header>
    <div className="s40-beui-batch-table">
      <Table
        data={batch}
        columns={columns}
        getRowId={(row) => row.id}
        rowHeight={58}
        height={420}
        emptyState="No estate is running in this batch."
        className="s40-beui-table"
      />
    </div>
  </section>;
}

export function renderBeuiRail(adapter: BeuiBridgeAdapter, element: HTMLElement) {
  if (element.matches("[data-s40-beui-queue]")) return <QueueRail adapter={adapter} element={element} />;
  if (element.matches("[data-s40-beui-batch-progress]")) return <BatchProgressRail adapter={adapter} element={element} />;
  return renderOperationalGridRail(adapter, element);
}
