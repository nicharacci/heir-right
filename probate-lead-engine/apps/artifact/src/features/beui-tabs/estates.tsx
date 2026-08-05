import { useMemo, useState } from "react";
import {
  FileUpload,
  type FileUploadItem,
} from "../../beui-foundation/components/motion/file-upload";
import { Input } from "../../beui-foundation/components/motion/input";
import { Loader } from "../../beui-foundation/components/motion/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../beui-foundation/components/motion/select";
import { Table, type TableColumn } from "../../beui-foundation/components/motion/table";
import { BeuiIcon } from "../../ui/beui-icon-bank";
import type {
  BeuiCommandHandler,
  BeuiScreenStatus,
  EstateRecord,
} from "./contract";
import {
  PearlButton,
  QuietButton,
  ScreenHeading,
  ScreenStatus,
  StateBadge,
  workflowLabel,
  workflowTone,
  type ScreenStatusProps,
} from "./shared";

export interface EstatesSurfaceProps extends ScreenStatusProps {
  estates?: readonly EstateRecord[];
  selectedEstateIds?: readonly string[];
  onSelectionChange?: (estateIds: string[]) => void;
  onEstateFilesAdded?: (files: File[]) => void | Promise<void>;
  onCommand?: BeuiCommandHandler;
}

export function EstatesSurface({
  estates = [],
  selectedEstateIds = [],
  onSelectionChange,
  onEstateFilesAdded,
  onCommand,
  status,
  message,
}: EstatesSurfaceProps) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [uploadItems, setUploadItems] = useState<FileUploadItem[]>([]);
  const [importStatus, setImportStatus] = useState<BeuiScreenStatus>("idle");
  const [importMessage, setImportMessage] = useState("");
  const selected = new Set(selectedEstateIds.map(String));
  const filteredEstates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return estates.filter((estate) => {
      const matchesQuery = !normalizedQuery
        || `${estate.title} ${estate.address || ""}`.toLowerCase().includes(normalizedQuery);
      const matchesState = stateFilter === "all"
        || (stateFilter === "review" && (estate.missingFields?.length || estate.workflowState === "blocked"))
        || estate.workflowState === stateFilter;
      return matchesQuery && matchesState;
    });
  }, [estates, query, stateFilter]);

  const columns: TableColumn<EstateRecord>[] = [
    { key: "title", header: "Estate", width: "22%" },
    { key: "address", header: "Property address", width: "27%", cell: (estate) => estate.address || "Address needs review" },
    { key: "source", header: "Source", width: "12%", cell: (estate) => estate.source?.toUpperCase() || "Not provided" },
    {
      key: "workflowState",
      header: "State",
      width: "22%",
      cell: (estate) => <StateBadge state={workflowTone(estate.workflowState)}>{workflowLabel(estate.workflowState)}</StateBadge>,
    },
    {
      key: "select",
      header: "Open",
      width: "17%",
      sortable: false,
      cell: (estate) => (
        <QuietButton
          size="sm"
          data-beui-control={`estate-select-${estate.id}`}
          aria-label={`Select ${estate.title}`}
          onClick={() => onCommand?.("select-estate", { estateId: estate.id })}
        >
          Select
        </QuietButton>
      ),
    },
  ];

  function handleFilesAdded(_items: FileUploadItem[], files: File[]) {
    setImportStatus("loading");
    setImportMessage("Files selected. Preserving the imported rows for review.");
    try {
      const result = onEstateFilesAdded?.(files);
      if (result && typeof (result as Promise<void>).then === "function") {
        void Promise.resolve(result).then(
          () => setImportStatus("idle"),
          () => {
            setImportStatus("error");
            setImportMessage("The estate files could not be handed to the workspace. Review the files, then try again.");
          },
        );
      } else {
        setImportStatus("idle");
      }
    } catch {
      setImportStatus("error");
      setImportMessage("The estate files could not be handed to the workspace. Review the files, then try again.");
    }
  }

  function queueSelected() {
    if (!selected.size || !onCommand) return;
    void onCommand("s40-queue-estates", { estateIds: [...selected] });
  }

  return (
    <section className="beui-tabs-screen" data-beui-view="find-estates" aria-labelledby="beui-estates-title">
      <ScreenHeading
        id="beui-estates-title"
        eyebrow="Estate files"
        title="Estates"
        copy="Search imported estate records, keep incomplete fields visible for review, and queue selected records for Doc Prep."
        actions={(
          <PearlButton
            data-beui-control="queue-estates"
            disabled={!selected.size || !onCommand || status === "loading"}
            aria-disabled={!selected.size || !onCommand ? "true" : undefined}
            onClick={queueSelected}
          >
            {status === "loading" ? <Loader size={16} label="Queueing selected estates" /> : null}
            Queue selected for Doc Prep
          </PearlButton>
        )}
      />
      <div className="beui-tabs-workbench">
        <section className="beui-tabs-panel beui-tabs-upload-panel" aria-labelledby="beui-estates-upload-title">
          <div className="beui-tabs-panel-heading">
            <div>
              <p className="beui-tabs-eyebrow">PDF / CSV intake</p>
              <h2 id="beui-estates-upload-title">Add estate files</h2>
            </div>
            <StateBadge state="review">Review first</StateBadge>
          </div>
          <FileUpload
            value={uploadItems}
            onValueChange={setUploadItems}
            onFilesAdded={handleFilesAdded}
            accept=".pdf,.csv,application/pdf,text/csv"
            multiple
            title="Drop estate files here"
            description="PDF or CSV only. Incomplete records stay available for review."
            browseLabel="Choose files"
            className="beui-tabs-file-upload"
            classNames={{ dropzone: "beui-tabs-file-dropzone", leading: "beui-tabs-file-leading" }}
          />
          <ScreenStatus status={importStatus} message={importMessage} />
        </section>
        <section className="beui-tabs-panel beui-tabs-estate-list" aria-labelledby="beui-estate-list-title">
          <div className="beui-tabs-panel-heading">
            <div>
              <p className="beui-tabs-eyebrow">Stored records</p>
              <h2 id="beui-estate-list-title">Estate search</h2>
            </div>
            <span className="beui-tabs-count" aria-live="polite">{filteredEstates.length} shown</span>
          </div>
          <div className="beui-tabs-filter-row">
            <Input
              id="estateSearch"
              value={query}
              onChange={setQuery}
              placeholder="Search by estate or address"
              aria-label="Search estate files"
              leftIcon={<BeuiIcon name="estates" size={16} />}
              className="beui-tabs-search-input"
              data-beui-control="estate-search"
            />
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="beui-tabs-state-select">
                <SelectValue placeholder="Filter estate state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All records</SelectItem>
                <SelectItem value="review">Needs review</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <span className="beui-tabs-filter-icon" aria-hidden="true"><BeuiIcon name="filter" size={16} /></span>
          </div>
          <div className="beui-tabs-table-wrap" data-beui-control="estate-table">
            <Table
              data={filteredEstates}
              columns={columns}
              getRowId={(estate) => estate.id}
              selectable
              selectedRowIds={[...selected]}
              onSelectionChange={(ids) => onSelectionChange?.(ids)}
              height={340}
              emptyState="No estate files match the current search."
              className="beui-tabs-table"
            />
          </div>
          <ScreenStatus status={status} message={message} />
        </section>
      </div>
    </section>
  );
}
