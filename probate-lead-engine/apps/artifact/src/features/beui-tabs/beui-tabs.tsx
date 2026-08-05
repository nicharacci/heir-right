import { useState } from "react";
import { Button } from "../../beui-foundation/components/motion/button/base";
import {
  AnimatedSidebar,
  AnimatedSidebarContent,
  AnimatedSidebarFooter,
  AnimatedSidebarHeader,
  AnimatedSidebarInset,
  AnimatedSidebarMenu,
  AnimatedSidebarMenuButton,
  AnimatedSidebarMenuItem,
  AnimatedSidebarProvider,
  AnimatedSidebarTrigger,
} from "../../beui-foundation/components/motion/animated-sidebar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../beui-foundation/components/motion/popover";
import { Input } from "../../beui-foundation/components/motion/input";
import { BeuiIcon } from "../../ui/beui-icon-bank";
import { BeuiAccountControl } from "../../ui/beui-account-control";
import {
  BEUI_EXPORT_ROUTES,
  BEUI_NAV_ITEMS,
  type BeuiAccountIdentity,
  type BeuiCommandHandler,
  type BeuiHelpAreaId,
  type BeuiOwnedRouteId,
  type BeuiPreferences,
  type BeuiScreenStatus,
  type BeuiSettingsTabId,
  type DashboardSnapshot,
  type EstateRecord,
  type IntegrationRecord,
  type OutreachCampaign,
  type OutreachTemplate,
} from "./contract";
import {
  AdminSurface,
  EstatesSurface,
  ExportSurface,
  HelpDemosSurface,
  ManageEstatesDashboard,
  OutreachSurface,
  QueueSurface,
  SettingsSurface,
} from "./screens";

interface BeuiCommandHeaderProps {
  query: string;
  selectedEstateIds: readonly string[];
  status?: BeuiScreenStatus;
  onQueryChange: (query: string) => void;
  onNavigate: (route: BeuiOwnedRouteId) => void;
  onCommand?: BeuiCommandHandler;
}

function BeuiCommandHeader({
  query,
  selectedEstateIds,
  status = "idle",
  onQueryChange,
  onNavigate,
  onCommand,
}: BeuiCommandHeaderProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const canExport = selectedEstateIds.length > 0 && status !== "loading";

  function runExport(route: (typeof BEUI_EXPORT_ROUTES)[number]["id"]) {
    if (!onCommand || !canExport) return;
    void onCommand("export", {
      estateIds: [...selectedEstateIds],
      route,
    });
    setExportOpen(false);
  }

  return (
    <header className="beui-tabs-command-header" data-beui-control="command-header">
      <div className="beui-tabs-command-start">
        <AnimatedSidebarTrigger className="beui-tabs-sidebar-trigger">
          <BeuiIcon name="panel" size={17} />
        </AnimatedSidebarTrigger>
        <label className="beui-tabs-command-search">
          <span className="beui-tabs-sr-only">Search the current workspace</span>
          <Input
            id="global-search"
            value={query}
            onChange={onQueryChange}
            placeholder="Search estates, files, or commands"
            leftIcon={<BeuiIcon name="command" size={16} />}
            data-beui-control="global-search"
          />
        </label>
      </div>
      <div className="beui-tabs-command-actions" aria-label="Workspace commands">
        <Button
          variant="outline"
          size="sm"
          whileHover={undefined}
          data-beui-control="estate-file-upload"
          onClick={() => onNavigate("find-estates")}
        >
          <BeuiIcon name="upload" size={15} />
          Upload estates
        </Button>
        <Popover open={exportOpen} onOpenChange={setExportOpen} side="bottom" align="end">
          <PopoverTrigger>
            <Button
              variant="primary"
              size="sm"
              whileHover={undefined}
              disabled={!canExport || !onCommand}
              data-beui-control="header-export"
            >
              <BeuiIcon name="export" size={15} />
              Export
              <BeuiIcon name="chevron" size={14} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="beui-tabs-command-popover">
            <div className="beui-tabs-popover-heading">
              <strong>Choose an export route</strong>
              <span>{selectedEstateIds.length} estate file{selectedEstateIds.length === 1 ? "" : "s"} selected</span>
            </div>
            <ul className="beui-tabs-command-list">
              {BEUI_EXPORT_ROUTES.map((route) => (
                <li key={route.id}>
                  <button
                    type="button"
                    className="beui-tabs-command-row"
                    disabled={!canExport || !onCommand}
                    onClick={() => runExport(route.id)}
                  >
                    <span>
                      <strong>{route.label}</strong>
                      <span>{route.detail}</span>
                    </span>
                    <BeuiIcon name="external" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}

interface BeuiPrimaryNavProps {
  activeRoute: BeuiOwnedRouteId;
  canOpenAdmin: boolean;
  onNavigate: (route: BeuiOwnedRouteId) => void;
}

function BeuiPrimaryNav({ activeRoute, canOpenAdmin, onNavigate }: BeuiPrimaryNavProps) {
  const items = BEUI_NAV_ITEMS.filter(
    (item) => item.renderInT4 && (!item.requiresAdmin || canOpenAdmin),
  );

  return (
    <AnimatedSidebarContent>
      <nav aria-label="Primary navigation">
        <AnimatedSidebarMenu>
          {items.map((item) => (
            <AnimatedSidebarMenuItem key={item.id}>
              <AnimatedSidebarMenuButton
                isActive={item.id === activeRoute}
                onSelect={() => onNavigate(item.id as BeuiOwnedRouteId)}
                className="beui-tabs-nav-item"
              >
                <BeuiIcon name={item.icon} size={17} />
                {item.label}
              </AnimatedSidebarMenuButton>
            </AnimatedSidebarMenuItem>
          ))}
        </AnimatedSidebarMenu>
      </nav>
    </AnimatedSidebarContent>
  );
}

interface BeuiRouteSurfaceProps {
  activeRoute: BeuiOwnedRouteId;
  identity: BeuiAccountIdentity | null;
  canOpenAdmin: boolean;
  status?: BeuiScreenStatus;
  message?: string;
  dashboard?: DashboardSnapshot;
  estates?: readonly EstateRecord[];
  exportedEstates?: readonly EstateRecord[];
  queuedEstates?: readonly EstateRecord[];
  selectedEstateIds: readonly string[];
  campaigns?: readonly OutreachCampaign[];
  templates?: readonly OutreachTemplate[];
  integrations?: readonly IntegrationRecord[];
  preferences?: BeuiPreferences;
  activeSettingsTab?: BeuiSettingsTabId;
  activeHelpArea?: BeuiHelpAreaId;
  accessDomains?: readonly string[];
  onNavigate: (route: BeuiOwnedRouteId) => void;
  onCommand?: BeuiCommandHandler;
  onEstateSelectionChange?: (estateIds: string[]) => void;
  onEstateFilesAdded?: (files: File[]) => void | Promise<void>;
  onCampaignChange?: (campaignId: string) => void;
  onTemplateChange?: (templateId: string) => void;
  onTemplateAction?: (action: string, template: OutreachTemplate) => void;
  onSettingsTabChange?: (tab: BeuiSettingsTabId) => void;
  onPreferenceChange?: (key: keyof BeuiPreferences, value: boolean) => void;
  onConnectionAction?: (connectionId: string) => void;
  onOpenAuth?: () => void;
  onAdminAction?: (action: string) => void;
  onHelpAreaChange?: (area: BeuiHelpAreaId) => void;
  onSpotlight: (targetId: string) => void;
}

function BeuiRouteSurface({
  activeRoute,
  identity,
  canOpenAdmin,
  status,
  message,
  dashboard,
  estates,
  exportedEstates,
  queuedEstates,
  selectedEstateIds,
  campaigns,
  templates,
  integrations,
  preferences,
  activeSettingsTab,
  activeHelpArea,
  accessDomains,
  onNavigate,
  onCommand,
  onEstateSelectionChange,
  onEstateFilesAdded,
  onCampaignChange,
  onTemplateChange,
  onTemplateAction,
  onSettingsTabChange,
  onPreferenceChange,
  onConnectionAction,
  onOpenAuth,
  onAdminAction,
  onHelpAreaChange,
  onSpotlight,
}: BeuiRouteSurfaceProps) {
  switch (activeRoute) {
    case "dashboard":
      return (
        <ManageEstatesDashboard
          snapshot={dashboard}
          status={status}
          message={message}
          onOpenEstates={() => onNavigate("find-estates")}
          onOpenQueue={() => onNavigate("queue")}
        />
      );
    case "find-estates":
      return (
        <EstatesSurface
          estates={estates}
          selectedEstateIds={selectedEstateIds}
          onSelectionChange={onEstateSelectionChange}
          onEstateFilesAdded={onEstateFilesAdded}
          onCommand={onCommand}
          status={status}
          message={message}
        />
      );
    case "export":
      return <ExportSurface exportedEstates={exportedEstates} status={status} message={message} />;
    case "drips":
      return (
        <OutreachSurface
          campaigns={campaigns}
          templates={templates}
          onSelectCampaign={onCampaignChange}
          onSelectTemplate={onTemplateChange}
          onTemplateAction={onTemplateAction}
          status={status}
          message={message}
        />
      );
    case "queue":
      return (
        <QueueSurface
          queuedEstates={queuedEstates}
          selectedEstateIds={selectedEstateIds}
          onSelectionChange={onEstateSelectionChange}
          onCommand={onCommand}
          status={status}
          message={message}
        />
      );
    case "admin":
      return (
        <AdminSurface
          canOpenAdmin={canOpenAdmin}
          accessDomains={accessDomains}
          connections={integrations}
          onOpenSettings={() => onNavigate("settings")}
          onAdminAction={onAdminAction}
          status={status}
          message={message}
        />
      );
    case "settings":
      return (
        <SettingsSurface
          identity={identity}
          activeTab={activeSettingsTab}
          canOpenAdmin={canOpenAdmin}
          integrations={integrations}
          preferences={preferences}
          allowedDomains={accessDomains}
          onTabChange={onSettingsTabChange}
          onPreferenceChange={onPreferenceChange}
          onConnectionAction={onConnectionAction}
          onOpenAuth={onOpenAuth}
          onAdminAction={onAdminAction}
          status={status}
          message={message}
        />
      );
    case "help-demos":
      return (
        <HelpDemosSurface
          activeArea={activeHelpArea}
          onAreaChange={onHelpAreaChange}
          onNavigate={onNavigate}
          onSpotlight={onSpotlight}
        />
      );
    default:
      return null;
  }
}

export interface BeuiChassisProps extends Omit<BeuiRouteSurfaceProps, "activeRoute" | "onNavigate"> {
  activeRoute: BeuiOwnedRouteId;
  onNavigate: (route: BeuiOwnedRouteId) => void;
  onGlobalSearchChange: (query: string) => void;
  onSwitchAccount?: () => void;
  onSignOut?: () => void;
}

export function BeuiChassis({
  activeRoute,
  identity,
  canOpenAdmin,
  status,
  message,
  dashboard,
  estates,
  exportedEstates,
  queuedEstates,
  selectedEstateIds,
  campaigns,
  templates,
  integrations,
  preferences,
  activeSettingsTab,
  activeHelpArea,
  accessDomains,
  onNavigate,
  onGlobalSearchChange,
  onSwitchAccount,
  onSignOut,
  ...surfaceProps
}: BeuiChassisProps) {
  const [query, setQuery] = useState("");

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    onGlobalSearchChange(nextQuery);
  }

  return (
    <div className="beui-tabs-root" data-beui-tabs-root data-mounted="false">
      <AnimatedSidebarProvider
        defaultOpen
        style={{ "--sidebar-width": "16rem", "--sidebar-width-icon": "4.25rem" }}
      >
        <AnimatedSidebar
          side="left"
          variant="floating"
          collapsible="icon"
          ariaLabel="HeirRight primary navigation"
          className="beui-tabs-sidebar"
          panelClassName="beui-tabs-sidebar-panel"
        >
          <AnimatedSidebarHeader className="beui-tabs-sidebar-header">
            <div className="beui-tabs-brand" aria-label="HeirRight">
              <span>HeirRight</span>
            </div>
          </AnimatedSidebarHeader>
          <BeuiPrimaryNav
            activeRoute={activeRoute}
            canOpenAdmin={canOpenAdmin}
            onNavigate={onNavigate}
          />
          <AnimatedSidebarFooter className="beui-tabs-sidebar-footer">
            <BeuiAccountControl
              identity={identity}
              onSwitchAccount={onSwitchAccount}
              onSignOut={onSignOut}
            />
          </AnimatedSidebarFooter>
        </AnimatedSidebar>
        <AnimatedSidebarInset className="beui-tabs-inset">
          <BeuiCommandHeader
            query={query}
            selectedEstateIds={selectedEstateIds}
            status={status}
            onQueryChange={updateQuery}
            onNavigate={onNavigate}
            onCommand={surfaceProps.onCommand}
          />
          <main className="beui-tabs-content">
            <BeuiRouteSurface
              activeRoute={activeRoute}
              identity={identity}
              canOpenAdmin={canOpenAdmin}
              status={status}
              message={message}
              dashboard={dashboard}
              estates={estates}
              exportedEstates={exportedEstates}
              queuedEstates={queuedEstates}
              selectedEstateIds={selectedEstateIds}
              campaigns={campaigns}
              templates={templates}
              integrations={integrations}
              preferences={preferences}
              activeSettingsTab={activeSettingsTab}
              activeHelpArea={activeHelpArea}
              accessDomains={accessDomains}
              onNavigate={onNavigate}
              {...surfaceProps}
            />
          </main>
        </AnimatedSidebarInset>
      </AnimatedSidebarProvider>
    </div>
  );
}

export { BeuiCommandHeader, BeuiPrimaryNav, BeuiRouteSurface };
export type { BeuiCommandHeaderProps, BeuiRouteSurfaceProps };
