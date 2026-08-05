import type { BeuiIconName } from "../../ui/beui-icon-bank";

type BeuiRouteId =
  | "dashboard"
  | "find-estates"
  | "dossiers"
  | "export"
  | "drips"
  | "queue"
  | "admin"
  | "settings"
  | "help-demos";

type BeuiOwnedRouteId = Exclude<BeuiRouteId, "dossiers">;

const BEUI_ROUTE_LABELS: Readonly<Record<BeuiRouteId, string>> = Object.freeze({
  dashboard: "Manage Estates",
  "find-estates": "Estates",
  dossiers: "Document Prep",
  export: "Export",
  drips: "Outreach",
  queue: "Queue",
  admin: "Admin",
  settings: "Settings",
  "help-demos": "Help & Demos",
});

interface BeuiNavItem {
  id: BeuiRouteId;
  label: string;
  icon: BeuiIconName;
  requiresAdmin?: boolean;
  renderInT4: boolean;
}

const BEUI_NAV_ITEMS: readonly BeuiNavItem[] = Object.freeze([
  { id: "dashboard", label: "Manage Estates", icon: "dashboard", renderInT4: true },
  { id: "find-estates", label: "Estates", icon: "estates", renderInT4: true },
  { id: "dossiers", label: "Document Prep", icon: "documents", renderInT4: false },
  { id: "export", label: "Export", icon: "export", renderInT4: true },
  { id: "drips", label: "Outreach", icon: "outreach", renderInT4: true },
  { id: "queue", label: "Queue", icon: "queue", renderInT4: true },
  { id: "admin", label: "Admin", icon: "admin", requiresAdmin: true, renderInT4: true },
  { id: "settings", label: "Settings", icon: "settings", renderInT4: true },
  { id: "help-demos", label: "Help & Demos", icon: "help", renderInT4: true },
]);

type BeuiSettingsTabId =
  | "access"
  | "integrations"
  | "support"
  | "outreach"
  | "preferences"
  | "admin";

const BEUI_SETTINGS_TABS: readonly { id: BeuiSettingsTabId; label: string; requiresAdmin?: boolean }[] = Object.freeze([
  { id: "access", label: "Access" },
  { id: "integrations", label: "Integrations" },
  { id: "support", label: "Support" },
  { id: "outreach", label: "Outreach" },
  { id: "preferences", label: "Preferences" },
  { id: "admin", label: "Admin", requiresAdmin: true },
]);

type BeuiCommandId =
  | "select-estate"
  | "s40-queue-estates"
  | "export"
  | "estate-lifecycle"
  | "set-theme"
  | "set-rail-open";

type BeuiCommandPayload = Readonly<Record<string, unknown>>;
type BeuiCommandHandler = (command: BeuiCommandId, payload: BeuiCommandPayload) => void | Promise<void>;

type BeuiScreenStatus = "idle" | "loading" | "error" | "disabled";
type BeuiStateTone = "neutral" | "review" | "ready" | "blocked";

type EstateWorkflowState =
  | "active"
  | "queued"
  | "processing"
  | "completed-awaiting-export"
  | "exported"
  | "blocked";

interface EstateRecord {
  id: string;
  title: string;
  address?: string;
  source?: "pdf" | "csv";
  workflowState?: EstateWorkflowState;
  missingFields?: readonly string[];
  packetHref?: string;
  packetStatus?: string;
  exportedAt?: string;
}

interface DashboardSnapshot {
  openEstateCount?: number;
  queuedCount?: number;
  reviewCount?: number;
  nextAction?: string;
}

interface BeuiAccountIdentity {
  authenticated: boolean;
  email?: string;
  name?: string;
  domain?: string;
}

interface IntegrationRecord {
  id: string;
  label: string;
  state: BeuiStateTone;
  detail?: string;
}

interface BeuiAgenticModelStatus {
  loaded: boolean;
  available: boolean;
  provider: "nous";
  model: string | null;
  route: "dynamic-free-catalog" | "configured-free-model" | "unavailable";
}

interface BeuiPreferences {
  holdNoContact: boolean;
  compactTables: boolean;
}

interface OutreachCampaign {
  id: string;
  label: string;
  detail?: string;
}

type OutreachChannel = "email" | "sms";
type OutreachTemplateState = "Draft" | "Ready" | "Approved" | "Sync to Podio" | "Archived";

interface OutreachTemplate {
  id: string;
  campaignId: string;
  label: string;
  channel: OutreachChannel;
  state: OutreachTemplateState;
  detail?: string;
  approvalOwner?: string;
}

type ExportRouteId = "queue" | "google" | "podio" | "podio-test" | "both";

interface BeuiExportRoute {
  id: ExportRouteId;
  label: string;
  detail: string;
}

const BEUI_EXPORT_ROUTES: readonly BeuiExportRoute[] = Object.freeze([
  { id: "queue", label: "Add to Queue", detail: "Stage selected files for batch review." },
  { id: "google", label: "Google Workspace", detail: "Prepare the reviewed package for document or sheet review." },
  { id: "podio", label: "Podio", detail: "Prepare reviewed estate fields for handoff." },
  { id: "podio-test", label: "Run Podio route check", detail: "Confirm one approved sample handoff returns." },
  { id: "both", label: "Google + Podio", detail: "Prepare one reviewed package for both routes." },
]);

type BeuiHelpAreaId = "estates" | "export" | "settings";

interface BeuiHelpDemo {
  id: string;
  area: BeuiHelpAreaId;
  route: BeuiOwnedRouteId;
  targetId: string;
  title: string;
  copy: string;
}

const BEUI_HELP_TABS: readonly { id: BeuiHelpAreaId; label: string }[] = Object.freeze([
  { id: "estates", label: "Estates" },
  { id: "export", label: "Queue & Export" },
  { id: "settings", label: "Settings & Access" },
]);

const BEUI_HELP_DEMOS: readonly BeuiHelpDemo[] = Object.freeze([
  {
    id: "estate-file-import",
    area: "estates",
    route: "find-estates",
    targetId: "estate-file-upload",
    title: "Add an estate file",
    copy: "Choose a PDF or CSV. Incomplete records remain visible for review until the estate file is complete enough to queue.",
  },
  {
    id: "estate-search",
    area: "estates",
    route: "find-estates",
    targetId: "estate-search",
    title: "Find an estate",
    copy: "Search the estate list, select a record, and keep the selected estate bound to the next action.",
  },
  {
    id: "queue-estates",
    area: "export",
    route: "queue",
    targetId: "queue-export",
    title: "Review the Queue",
    copy: "Select queued estate files and keep incomplete work out of the export handoff.",
  },
  {
    id: "export-review",
    area: "export",
    route: "export",
    targetId: "export-table",
    title: "Read back an export",
    copy: "Open the verified handoff row and inspect its packet link and returned status.",
  },
  {
    id: "integration-status",
    area: "settings",
    route: "settings",
    targetId: "settings-integrations",
    title: "Check integrations",
    copy: "Open Integrations to review connection state and the next permitted setup action.",
  },
  {
    id: "account-menu",
    area: "settings",
    route: "settings",
    targetId: "account-chip",
    title: "Open the account menu",
    copy: "Use the signed-in account control to switch account or follow the existing sign-out route.",
  },
]);

export {
  BEUI_EXPORT_ROUTES,
  BEUI_HELP_DEMOS,
  BEUI_HELP_TABS,
  BEUI_NAV_ITEMS,
  BEUI_ROUTE_LABELS,
  BEUI_SETTINGS_TABS,
};
export type {
  BeuiAccountIdentity,
  BeuiAgenticModelStatus,
  BeuiCommandHandler,
  BeuiCommandId,
  BeuiCommandPayload,
  BeuiExportRoute,
  BeuiHelpAreaId,
  BeuiHelpDemo,
  BeuiNavItem,
  BeuiOwnedRouteId,
  BeuiPreferences,
  BeuiRouteId,
  BeuiScreenStatus,
  BeuiSettingsTabId,
  BeuiStateTone,
  DashboardSnapshot,
  EstateRecord,
  EstateWorkflowState,
  ExportRouteId,
  IntegrationRecord,
  OutreachCampaign,
  OutreachChannel,
  OutreachTemplate,
  OutreachTemplateState,
};
