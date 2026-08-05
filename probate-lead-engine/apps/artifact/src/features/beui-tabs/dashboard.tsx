import { BeuiIcon } from "../../ui/beui-icon-bank";
import type { DashboardSnapshot } from "./contract";
import {
  PearlButton,
  QuietButton,
  ScreenHeading,
  ScreenStatus,
  StateBadge,
  type ScreenStatusProps,
} from "./shared";

export interface ManageEstatesDashboardProps extends ScreenStatusProps {
  snapshot?: DashboardSnapshot;
  onOpenEstates?: () => void;
  onOpenQueue?: () => void;
}

export function ManageEstatesDashboard({
  snapshot,
  status,
  message,
  onOpenEstates,
  onOpenQueue,
}: ManageEstatesDashboardProps) {
  const metrics = [
    ["Open estate files", snapshot?.openEstateCount],
    ["Queued for Doc Prep", snapshot?.queuedCount],
    ["Needs review", snapshot?.reviewCount],
  ].filter(([, value]) => typeof value === "number");

  return (
    <section className="beui-tabs-screen" data-beui-view="dashboard" aria-labelledby="beui-manage-estates-title">
      <ScreenHeading
        id="beui-manage-estates-title"
        eyebrow="Workspace"
        title="Manage Estates"
        copy="Keep the estate file, its review state, and the next permitted action in one readable starting point."
        actions={(
          <>
            {onOpenEstates ? (
              <PearlButton data-beui-control="manage-estates-open" onClick={onOpenEstates}>
                Open Estates
              </PearlButton>
            ) : null}
            {onOpenQueue ? (
              <QuietButton data-beui-control="manage-estates-queue" onClick={onOpenQueue}>
                Open Queue
              </QuietButton>
            ) : null}
          </>
        )}
      />
      <div className="beui-tabs-panel" data-beui-control="manage-estates-panel">
        <div className="beui-tabs-panel-heading">
          <div>
            <p className="beui-tabs-eyebrow">Current view</p>
            <h2>Estate workflow at a glance</h2>
          </div>
          <StateBadge state="review">Operator review</StateBadge>
        </div>
        {metrics.length ? (
          <dl className="beui-tabs-metric-list" aria-label="Estate workflow counts">
            {metrics.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="beui-tabs-empty">No estate counts are available in the current workspace state.</p>
        )}
        <div className="beui-tabs-next-action" data-state="review">
          <BeuiIcon name="external" size={17} aria-hidden="true" />
          <div>
            <strong>Next action</strong>
            <p>{snapshot?.nextAction || "Choose an estate file to begin."}</p>
          </div>
        </div>
        <ScreenStatus status={status} message={message} />
      </div>
    </section>
  );
}
