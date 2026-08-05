import { Loader } from "../../beui-foundation/components/motion/loader";
import { Table, type TableColumn } from "../../beui-foundation/components/motion/table";
import type { BeuiCommandHandler, EstateRecord } from "./contract";
import { PearlButton, ScreenHeading, ScreenStatus, StateBadge, workflowLabel, workflowTone, type ScreenStatusProps } from "./shared";

export interface QueueSurfaceProps extends ScreenStatusProps {
  queuedEstates?: readonly EstateRecord[];
  selectedEstateIds?: readonly string[];
  onSelectionChange?: (estateIds: string[]) => void;
  onCommand?: BeuiCommandHandler;
}

export function QueueSurface({
  queuedEstates = [],
  selectedEstateIds = [],
  onSelectionChange,
  onCommand,
  status,
  message,
}: QueueSurfaceProps) {
  const selected = new Set(selectedEstateIds.map(String));
  const columns: TableColumn<EstateRecord>[] = [
    { key: "title", header: "Estate", width: "27%" },
    { key: "address", header: "Property address", width: "32%", cell: (estate) => estate.address || "Address needs review" },
    { key: "workflowState", header: "State", width: "24%", cell: (estate) => <StateBadge state={workflowTone(estate.workflowState)}>{workflowLabel(estate.workflowState)}</StateBadge> },
    { key: "missingFields", header: "Review", width: "17%", cell: (estate) => estate.missingFields?.length ? `${estate.missingFields.length} field${estate.missingFields.length === 1 ? "" : "s"} missing` : "Ready to inspect" },
  ];

  function exportSelected() {
    if (!selected.size || !onCommand) return;
    void onCommand("export", { estateIds: [...selected], route: "queue" });
  }

  return (
    <section className="beui-tabs-screen" data-beui-view="queue" aria-labelledby="beui-queue-title">
      <ScreenHeading
        id="beui-queue-title"
        eyebrow="Batch review"
        title="Queue"
        copy="Hold selected estate packets at the review boundary until the operator chooses an export route."
        actions={(
          <PearlButton
            data-beui-control="queue-export"
            disabled={!selected.size || !onCommand || status === "loading"}
            onClick={exportSelected}
          >
            {status === "loading" ? <Loader size={16} label="Preparing export" /> : null}
            Export selected
          </PearlButton>
        )}
      />
      <section className="beui-tabs-panel" aria-labelledby="beui-queue-table-title">
        <div className="beui-tabs-panel-heading">
          <div><p className="beui-tabs-eyebrow">Selected estate files</p><h2 id="beui-queue-table-title">Batch export review</h2></div>
          <span className="beui-tabs-count">{queuedEstates.length} queued</span>
        </div>
        <div className="beui-tabs-table-wrap">
          <Table
            data={[...queuedEstates]}
            columns={columns}
            getRowId={(estate) => estate.id}
            selectable
            selectedRowIds={[...selected]}
            onSelectionChange={(ids) => onSelectionChange?.(ids)}
            height={380}
            emptyState="No estate files are queued for export review."
            className="beui-tabs-table"
          />
        </div>
        <ScreenStatus status={status} message={message} />
      </section>
    </section>
  );
}
