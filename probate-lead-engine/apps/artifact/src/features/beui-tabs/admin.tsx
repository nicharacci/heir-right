import { BeuiIcon } from "../../ui/beui-icon-bank";
import type { IntegrationRecord } from "./contract";
import {
  QuietButton,
  ScreenHeading,
  ScreenStatus,
  StateBadge,
  type ScreenStatusProps,
} from "./shared";

export interface AdminSurfaceProps extends ScreenStatusProps {
  canOpenAdmin?: boolean;
  accessDomains?: readonly string[];
  connections?: readonly IntegrationRecord[];
  onOpenSettings?: () => void;
  onAdminAction?: (action: string) => void;
}

export function AdminSurface({
  canOpenAdmin = false,
  accessDomains = [],
  connections = [],
  onOpenSettings,
  onAdminAction,
  status,
  message,
}: AdminSurfaceProps) {
  if (!canOpenAdmin) {
    return (
      <section className="beui-tabs-screen" data-beui-view="admin" aria-labelledby="beui-admin-title">
        <ScreenHeading id="beui-admin-title" eyebrow="Restricted workspace" title="Admin" copy="Admin controls appear only for an authenticated operator with permission." />
        <section className="beui-tabs-panel beui-tabs-restricted-panel">
          <BeuiIcon name="admin" size={22} />
          <h2>Admin access is unavailable</h2>
          <p>Open Settings to review the current account and access state.</p>
          {onOpenSettings ? <QuietButton onClick={onOpenSettings}>Open Settings</QuietButton> : null}
        </section>
      </section>
    );
  }

  return (
    <section className="beui-tabs-screen" data-beui-view="admin" aria-labelledby="beui-admin-title">
      <ScreenHeading id="beui-admin-title" eyebrow="Operator controls" title="Admin" copy="Review access boundaries, connection state, and support actions for this workspace." />
      <div className="beui-tabs-admin-layout">
        <section className="beui-tabs-panel" aria-labelledby="beui-admin-access-title">
          <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Access</p><h2 id="beui-admin-access-title">Allowed workspace domains</h2></div><StateBadge state={accessDomains.length ? "ready" : "blocked"}>{accessDomains.length ? "Configured" : "Not provided"}</StateBadge></div>
          <p className="beui-tabs-detail-copy">Only the access domains supplied by the authenticated workspace are shown here.</p>
          {accessDomains.length ? <ul className="beui-tabs-inline-list">{accessDomains.map((domain) => <li key={domain}>{domain}</li>)}</ul> : <p className="beui-tabs-empty">No access domains were supplied.</p>}
          {onAdminAction ? <QuietButton onClick={() => onAdminAction("review-access")}>Review access state</QuietButton> : null}
        </section>
        <section className="beui-tabs-panel" aria-labelledby="beui-admin-connections-title">
          <div className="beui-tabs-panel-heading"><div><p className="beui-tabs-eyebrow">Connections</p><h2 id="beui-admin-connections-title">Workspace connections</h2></div><span className="beui-tabs-count">{connections.length} shown</span></div>
          <ul className="beui-tabs-connection-list">
            {connections.map((connection) => <li key={connection.id}><span><strong>{connection.label}</strong><span>{connection.detail || "Connection detail supplied by the workspace."}</span></span><StateBadge state={connection.state}>{connection.state}</StateBadge></li>)}
          </ul>
          {!connections.length ? <p className="beui-tabs-empty">No connection details were supplied.</p> : null}
          {onAdminAction ? <QuietButton onClick={() => onAdminAction("refresh-connections")}>Refresh connection state</QuietButton> : null}
        </section>
      </div>
      <ScreenStatus status={status} message={message} />
    </section>
  );
}
