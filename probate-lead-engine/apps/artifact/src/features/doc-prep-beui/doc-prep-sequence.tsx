import { AnimatedBadge } from "../../beui-foundation/components/motion/animated-badge";
import { Button } from "../../beui-foundation/components/motion/button/base";
import {
  FileUpload,
  type FileUploadItem,
} from "../../beui-foundation/components/motion/file-upload";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../beui-foundation/components/motion/popover";
import {
  Table,
  type TableColumn,
} from "../../beui-foundation/components/motion/table";
import { Tooltip } from "../../beui-foundation/components/motion/tooltip";
import {
  actionAvailability,
  deriveSequence,
} from "./sequence-model.js";

type ProcessCaseLike = Record<string, unknown> | null;
type ProcessEventLike = Record<string, unknown>;

export type DocPrepPendingAction = "start" | "retry" | "stop" | "export" | "upload";

export interface DocPrepSequenceProps {
  processCase?: ProcessCaseLike;
  events?: ProcessEventLike[];
  requiresIdiReview?: boolean;
  pendingAction?: DocPrepPendingAction;
  uploadError?: string;
  googleDriveState?: "idle" | "pending" | "success" | "failed";
  onStart?: () => void;
  onRetry?: (stageId: string) => void;
  onStop?: () => void;
  onExportGoogleDrive?: () => void;
  onUploadFiles?: (files: File[]) => void;
}

const BADGE_STATUS = {
  active: "loading",
  review: "warning",
  complete: "success",
  blocked: "warning",
  failed: "danger",
  stopped: "neutral",
  pending: "neutral",
  queued: "neutral",
  idle: "neutral",
} as const;

function badgeStatus(state: keyof typeof BADGE_STATUS) {
  return BADGE_STATUS[state] ?? "neutral";
}

function stateLabel(state: string) {
  return {
    active: "In progress",
    review: "Review required",
    complete: "Complete",
    blocked: "Blocked",
    failed: "Failed",
    stopped: "Stopped",
    pending: "Pending",
  }[state] ?? "Pending";
}

function safeUploadError(value: string | undefined) {
  if (!value) return "";
  return value.length <= 160 && !/[<>`]|(?:token|secret|password|stack|contact|email)/i.test(value)
    ? value
    : "The uploaded report could not be selected. Check the file and try again.";
}

function tableColumns(): TableColumn<Record<string, unknown>>[] {
  return [
    {
      key: "stage",
      header: "Stage",
      width: "34%",
      cell: (row) => (
        <div className="docprep-beui-table-stage">
          <strong>{String(row.title)}</strong>
          <span>{String(row.detail)}</span>
        </div>
      ),
    },
    {
      key: "state",
      header: "State",
      width: "22%",
      cell: (row) => {
        const state = String(row.state) as keyof typeof BADGE_STATUS;
        return (
          <AnimatedBadge
            status={badgeStatus(state)}
            size="sm"
            pulse={false}
            showIcon
          >
            {stateLabel(state)}
          </AnimatedBadge>
        );
      },
    },
    {
      key: "evidence",
      header: "Evidence gate",
      cell: (row) => <span>{String(row.evidenceGate)}</span>,
    },
  ];
}

function ActionButton({
  label,
  disabled,
  onClick,
  variant = "secondary",
  action,
}: {
  label: string;
  disabled: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  action: string;
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      disabled={disabled}
      onClick={onClick}
      data-action={action}
    >
      {label}
    </Button>
  );
}

export function DocPrepSequence({
  processCase = null,
  events = [],
  requiresIdiReview = false,
  pendingAction,
  uploadError,
  googleDriveState = "idle",
  onStart,
  onRetry,
  onStop,
  onExportGoogleDrive,
  onUploadFiles,
}: DocPrepSequenceProps) {
  const sequence = deriveSequence(processCase, events);
  const availability = actionAvailability(processCase, {
    events,
    pendingAction,
  });
  const firstStage = sequence.stages[0];
  const currentTask = sequence.currentTask;
  const islandTask = currentTask ?? {
    title: "Doc Prep is ready to run",
    displayDetail: "A durable case will provide the ordered six-stage process.",
    operatorText: "",
    nextAction: "",
    repairReference: null,
  };
  const links = sequence.artifact.links;
  const uploadMessage = safeUploadError(uploadError);
  const canRun = availability.canStart && Boolean(onStart);
  const canRetry = availability.canRetry && Boolean(onRetry);
  const canStop = availability.canStop && Boolean(onStop);
  const canExport =
    availability.canDownload &&
    Boolean(onExportGoogleDrive) &&
    pendingAction !== "export" &&
    googleDriveState !== "pending";

  const handleFilesAdded = (_items: FileUploadItem[], files: File[]) => {
    onUploadFiles?.(files);
  };

  const rows = sequence.stages.map((stage) => ({
    id: stage.id,
    stage: stage.title,
    title: stage.title,
    detail: stage.displayDetail,
    state: stage.state,
    evidence: stage.evidenceGate,
    evidenceGate: stage.evidenceGate,
  }));

  return (
    <section
      className="docprep-beui-surface"
      data-beui-foundation="public"
      data-docprep-beui
      aria-label="Doc Prep BeUI surface"
    >
      <div className="docprep-beui-shell">
        <section
          className="docprep-beui-island"
          data-dynamic-island
          data-state={sequence.island.state}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="docprep-beui-island-heading">
            <div>
              <p className="docprep-beui-eyebrow">Dynamic Island</p>
              <h2 data-current-task>{islandTask.title}</h2>
              <p>{islandTask.displayDetail}</p>
            </div>
            <AnimatedBadge
              status={badgeStatus(sequence.island.state)}
              size="sm"
              pulse={false}
              contentKey={sequence.island.state}
              className="docprep-beui-status-badge"
            >
              {sequence.island.label}
            </AnimatedBadge>
          </div>

          {sequence.completedPredecessors.length > 0 ? (
            <ol
              className="docprep-beui-predecessors"
              aria-label="Completed predecessor stages"
            >
              {sequence.completedPredecessors.map((stage) => (
                <li key={stage.id}>{stage.title}</li>
              ))}
            </ol>
          ) : null}

          {islandTask.operatorText || islandTask.nextAction ? (
            <div className="docprep-beui-island-note">
              {islandTask.operatorText ? <p>{islandTask.operatorText}</p> : null}
              {islandTask.nextAction ? (
                <p>
                  <span className="docprep-beui-note-label">Next action:</span>{" "}
                  {islandTask.nextAction}
                </p>
              ) : null}
              {islandTask.repairReference ? (
                <p>
                  <span className="docprep-beui-note-label">Repair reference:</span>{" "}
                  {islandTask.repairReference.href ? (
                    <a href={islandTask.repairReference.href}>
                      {islandTask.repairReference.label}
                    </a>
                  ) : (
                    islandTask.repairReference.label
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          <Popover>
            <PopoverTrigger>
              <Button type="button" variant="ghost" size="sm" data-action="event-source">
                Event source
              </Button>
            </PopoverTrigger>
            <PopoverContent className="docprep-beui-popover">
              Persisted case events drive this island. Browser time and local progress
              do not advance it. {sequence.island.eventCount} durable event
              {sequence.island.eventCount === 1 ? "" : "s"} available.
            </PopoverContent>
          </Popover>
        </section>

        <div className="docprep-beui-actions" aria-label="Doc Prep actions">
          <ActionButton
            label="Run Doc Prep"
            action="run"
            variant="primary"
            disabled={!canRun}
            onClick={onStart}
          />
          <Tooltip content="Retry resumes the first incomplete durable stage." side="top">
            <span>
              <ActionButton
                label="Retry incomplete stage"
                action="retry"
                disabled={!canRetry}
                onClick={() => {
                  if (availability.firstIncompleteStageId) {
                    onRetry?.(availability.firstIncompleteStageId);
                  }
                }}
              />
            </span>
          </Tooltip>
          <ActionButton
            label="Stop Doc Prep"
            action="stop"
            disabled={!canStop}
            onClick={onStop}
          />
          <ActionButton
            label={googleDriveState === "pending" ? "Exporting…" : "Export to Google Drive"}
            action="google-drive-export"
            disabled={!canExport}
            onClick={onExportGoogleDrive}
          />
        </div>

        {(availability.requiresIdiReview || requiresIdiReview) && firstStage ? (
          <section className="docprep-beui-review" aria-labelledby="docprep-upload-title">
            <div>
              <p className="docprep-beui-eyebrow">Review required</p>
              <h2 id="docprep-upload-title">Select the persisted IDI report</h2>
              <p>
                Stage one reads the persisted uploaded report. No live IDI API call is
                attempted.
              </p>
            </div>
            <FileUpload
              accept=".pdf,application/pdf"
              multiple={false}
              maxFiles={1}
              disabled={!onUploadFiles || pendingAction === "upload"}
              title="Add the persisted IDI report"
              description="PDF only"
              browseLabel="Select report"
              onFilesAdded={handleFilesAdded}
            />
            {uploadMessage ? (
              <p className="docprep-beui-inline-error" role="alert">
                {uploadMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="docprep-beui-table-section" aria-labelledby="docprep-stages-title">
          <div className="docprep-beui-section-heading">
            <div>
              <p className="docprep-beui-eyebrow">Ordered process</p>
              <h2 id="docprep-stages-title">Doc Prep stages</h2>
            </div>
            <span className="docprep-beui-muted">Durable case state</span>
          </div>
          <div className="docprep-beui-table" data-beui-component="table">
            <Table
              data={rows}
              columns={tableColumns()}
              getRowId={(row) => row.id}
              selectable={false}
              resizable={false}
              reorderable={false}
              rowHeight={68}
              height={410}
              emptyState="No durable stages"
            />
          </div>
        </section>

        <section className="docprep-beui-preview" aria-labelledby="docprep-preview-title">
          <div className="docprep-beui-section-heading">
            <div>
              <p className="docprep-beui-eyebrow">Verified artifact</p>
              <h2 id="docprep-preview-title">Packet preview</h2>
            </div>
            {links ? <span className="docprep-beui-muted">PDF readback verified</span> : null}
          </div>
          {links ? (
            <>
              <iframe
                className="docprep-beui-preview-frame"
                src={links.previewUrl}
                title="Verified Doc Prep packet preview"
              />
              <div className="docprep-beui-preview-links">
                <a href={links.previewUrl}>Open verified preview</a>
                <a href={links.downloadUrl}>Download verified PDF</a>
              </div>
            </>
          ) : (
            <p className="docprep-beui-empty-preview">
              The packet preview appears after the PDF is persisted and readback is verified.
            </p>
          )}
          {googleDriveState === "success" ? (
            <p className="docprep-beui-delivery-message" role="status">
              Verified packet exported to Google Drive.
            </p>
          ) : null}
          {googleDriveState === "failed" ? (
            <p className="docprep-beui-inline-error" role="alert">
              Google Drive export failed. Retry after the configured delivery service is healthy.
            </p>
          ) : null}
        </section>
      </div>
    </section>
  );
}
