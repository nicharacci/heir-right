import { type ComponentProps, type ReactNode } from "react";
import { Button } from "../../beui-foundation/components/motion/button/base";
import { Loader } from "../../beui-foundation/components/motion/loader";
import { BeuiIcon } from "../../ui/beui-icon-bank";
import type {
  BeuiScreenStatus,
  BeuiStateTone,
  EstateWorkflowState,
} from "./contract";

export interface ScreenStatusProps {
  status?: BeuiScreenStatus;
  message?: string;
}

export function ScreenStatus({ status = "idle", message }: ScreenStatusProps) {
  if (status === "idle" && !message) return null;
  const copy = message
    || (status === "loading"
      ? "Loading current workspace state."
      : "This control is unavailable for the current account.");
  return (
    <div
      className="beui-tabs-status"
      data-state={status}
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      {status === "loading" ? <Loader size={16} label={copy} /> : null}
      <span>{copy}</span>
    </div>
  );
}

export function ScreenHeading({
  id,
  eyebrow,
  title,
  copy,
  actions,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  copy: string;
  actions?: ReactNode;
}) {
  const headingId = id ?? `beui-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`;
  return (
    <header className="beui-tabs-screen-heading">
      <div>
        <p className="beui-tabs-eyebrow">{eyebrow}</p>
        <h1 id={headingId}>{title}</h1>
        <p>{copy}</p>
      </div>
      {actions ? <div className="beui-tabs-heading-actions">{actions}</div> : null}
    </header>
  );
}

export function PearlButton({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      whileHover={undefined}
      className={`beui-tabs-pearl-button ${className}`}
    >
      {children}
    </Button>
  );
}

export function QuietButton({
  children,
  className = "",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      {...props}
      whileHover={undefined}
      variant="ghost"
      className={`beui-tabs-quiet-button ${className}`}
    >
      {children}
    </Button>
  );
}

export function StateBadge({
  state,
  children,
}: {
  state: BeuiStateTone;
  children: ReactNode;
}) {
  return (
    <span className="beui-tabs-state" data-state={state}>
      <span className="beui-tabs-state-mark" aria-hidden="true">
        <BeuiIcon name={state === "ready" ? "success" : state === "blocked" ? "close" : "success"} size={12} />
      </span>
      {children}
    </span>
  );
}

export function workflowLabel(state: EstateWorkflowState | undefined) {
  return {
    active: "Active in Estates",
    queued: "Queued for Doc Prep",
    processing: "Doc Prep in progress",
    "completed-awaiting-export": "Ready for export",
    exported: "Exported",
    blocked: "Blocked - review needed",
  }[state ?? "active"];
}

export function workflowTone(state: EstateWorkflowState | undefined): BeuiStateTone {
  if (state === "blocked") return "blocked";
  if (state === "exported" || state === "completed-awaiting-export") return "ready";
  if (state === "queued" || state === "processing") return "review";
  return "neutral";
}
