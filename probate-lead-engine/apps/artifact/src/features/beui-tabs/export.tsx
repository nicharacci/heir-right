import { Table, type TableColumn } from "../../beui-foundation/components/motion/table";
import type { EstateRecord } from "./contract";
import { ScreenHeading, ScreenStatus, StateBadge, type ScreenStatusProps } from "./shared";

export interface ExportSurfaceProps extends ScreenStatusProps {
  exportedEstates?: readonly EstateRecord[];
}

export function ExportSurface({ exportedEstates = [], status, message }: ExportSurfaceProps) {
  const columns: TableColumn<EstateRecord>[] = [
    { key: "title", header: "Estate", width: "22%" },
    { key: "address", header: "Property address", width: "28%", cell: (estate) => estate.address || "Address needs review" },
    { key: "handoff", header: "Handoff", width: "16%", cell: (estate) => <StateBadge state={estate.workflowState === "exported" ? "ready" : "review"}>{estate.workflowState === "exported" ? "Verified readback" : "Review needed"}</StateBadge> },
    { key: "packet", header: "Packet", width: "14%", cell: (estate) => estate.packetStatus || "Packet status unavailable" },
    { key: "exportedAt", header: "Exported", width: "12%", cell: (estate) => estate.exportedAt || "—" },
    {
      key: "packetHref",
      header: "PDF",
      width: "8%",
      sortable: false,
      cell: (estate) => estate.packetHref ? (
        <a className="beui-tabs-inline-link" href={estate.packetHref} target="_blank" rel="noopener noreferrer">
          Open PDF
        </a>
      ) : "Unavailable",
    },
  ];

  return (
    <section className="beui-tabs-screen" data-beui-view="export" aria-labelledby="beui-export-title">
      <ScreenHeading
        id="beui-export-title"
        eyebrow="Verified handoffs"
        title="Export"
        copy="Read back completed estate files that have left Doc Prep."
      />
      <section className="beui-tabs-panel" data-beui-control="export-table" aria-labelledby="beui-export-table-title">
        <div className="beui-tabs-panel-heading">
          <div>
            <p className="beui-tabs-eyebrow">Returned files</p>
            <h2 id="beui-export-table-title">Exported estate files</h2>
          </div>
          <span className="beui-tabs-count">{exportedEstates.length} shown</span>
        </div>
        <div className="beui-tabs-table-wrap">
          <Table
            data={[...exportedEstates]}
            columns={columns}
            getRowId={(estate) => estate.id}
            height={360}
            emptyState="No estate files have completed export handoff."
            className="beui-tabs-table"
          />
        </div>
        <ScreenStatus status={status} message={message} />
      </section>
    </section>
  );
}
