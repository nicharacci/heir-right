import { useCallback, useEffect, useRef, useState } from "react";
import { BeuiChassis } from "../beui-tabs/beui-tabs";
import type {
  BeuiAccountIdentity,
  BeuiAgenticModelStatus,
  BeuiCommandHandler,
  BeuiCommandPayload,
  BeuiHelpAreaId,
  BeuiPreferences,
  BeuiRouteId,
  BeuiScreenStatus,
  BeuiSettingsTabId,
  DashboardSnapshot,
  EstateRecord,
  IntegrationRecord,
  OutreachCampaign,
  OutreachTemplate,
} from "../beui-tabs/contract";
import { DocPrepSequence, type DocPrepPendingAction } from "../doc-prep-beui/doc-prep-sequence";
import {
  caseForEstate,
  hydrateProcessCase,
} from "../doc-prep/cloud-process.js";
import {
  normalizeBeuiRoute,
  type BeuiBridgeAdapter,
  type LegacyState,
} from "./bridge-adapter";

type ProcessCase = Record<string, unknown> | null;

interface MountedSnapshot {
  activeRoute: BeuiRouteId;
  selectedEstateId: string | null;
  hasVerifiedIdiReport: boolean;
  selectedIds: string[];
  identity: BeuiAccountIdentity | null;
  canOpenAdmin: boolean;
  estates: EstateRecord[];
  exportedEstates: EstateRecord[];
  queuedEstates: EstateRecord[];
  dashboard: DashboardSnapshot;
  campaigns: OutreachCampaign[];
  templates: OutreachTemplate[];
  selectedCampaignId?: string;
  selectedTemplateId?: string;
  integrations: IntegrationRecord[];
  agenticModelStatus: BeuiAgenticModelStatus;
  agenticModelPreference: string;
  verifiedFreeModels: string[];
  preferences: BeuiPreferences;
  settingsTab: BeuiSettingsTabId;
  accessDomains: string[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown, fallback = "") {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => stringValue(entry)).filter(Boolean)
    : [];
}

function mapEstate(value: unknown): EstateRecord | null {
  const source = record(value);
  const id = stringValue(source.id);
  if (!id) return null;
  const rawSource = stringValue(source.source).toLowerCase();
  const rawWorkflow = stringValue(source.workflowState) as EstateRecord["workflowState"];
  const workflowState = [
    "active",
    "queued",
    "processing",
    "completed-awaiting-export",
    "exported",
    "blocked",
  ].includes(rawWorkflow || "") ? rawWorkflow : undefined;
  const estate: EstateRecord = {
    id,
    title: stringValue(source.title, "Estate file"),
    address: stringValue(source.address),
    missingFields: stringList(source.missingFields),
  };
  if (rawSource === "pdf" || rawSource === "csv") estate.source = rawSource;
  if (workflowState) estate.workflowState = workflowState;
  const packetHref = stringValue(source.packetHref);
  if (packetHref.startsWith("/")) estate.packetHref = packetHref;
  const packetStatus = stringValue(source.packetStatus);
  if (packetStatus) estate.packetStatus = packetStatus;
  const exportedAt = stringValue(source.exportedAt);
  if (exportedAt) estate.exportedAt = exportedAt;
  return estate;
}

function mapConnection(value: unknown): IntegrationRecord | null {
  const source = record(value);
  const id = stringValue(source.id || source.name);
  if (!id) return null;
  const label = stringValue(source.label || source.name, "Connection");
  const state = source.ok === true && source.mode === "live"
    ? "ready"
    : source.ok === true
      ? "review"
      : source.ok === false
        ? "blocked"
        : "neutral";
  return {
    id,
    label,
    state,
    detail: state === "ready"
      ? "Verified connection state."
      : state === "blocked"
        ? "Connection needs operator review."
        : "Connection state is available for review.",
  };
}

function mapCampaign(value: unknown): OutreachCampaign | null {
  const source = record(value);
  const id = stringValue(source.id);
  if (!id) return null;
  return {
    id,
    label: stringValue(source.label || source.name, "Campaign"),
    detail: stringValue(source.detail || source.description),
  };
}

function mapTemplate(value: unknown): OutreachTemplate | null {
  const source = record(value);
  const id = stringValue(source.id);
  const campaignId = stringValue(source.campaignId);
  if (!id || !campaignId) return null;
  const rawChannel = stringValue(source.channel).toLowerCase();
  const rawState = stringValue(source.state || source.status);
  const state = ["Draft", "Ready", "Approved", "Sync to Podio", "Archived"].includes(rawState)
    ? rawState as OutreachTemplate["state"]
    : "Draft";
  return {
    id,
    campaignId,
    label: stringValue(source.label || source.name, "Template"),
    channel: rawChannel === "email" ? "email" : "sms",
    state,
    detail: stringValue(source.detail || source.subject),
  };
}

function mountedSnapshot(sourceState: LegacyState): MountedSnapshot {
  const source = record(sourceState);
  const session = record(source.session);
  const user = record(session.user);
  const settings = record(source.settings);
  const preferences = record(settings.preferences);
  const selectedEstate = record(source.selectedEstate);
  const estates = (Array.isArray(source.estates) ? source.estates : [])
    .map(mapEstate)
    .filter((estate): estate is EstateRecord => Boolean(estate));
  const queuedEstates = (Array.isArray(source.docPrepEstates) ? source.docPrepEstates : [])
    .map(mapEstate)
    .filter((estate): estate is EstateRecord => Boolean(estate));
  const exportedEstates = estates.filter((estate) => estate.workflowState === "exported");
  const selectedEstateId = stringValue(source.selectedEstateId) || null;
  const hasVerifiedIdiReport = stringList(selectedEstate.sourceFileReferences).length > 0;
  const selectedIds = stringList(source.selectedIds);
  const reviewCount = estates.filter((estate) => estate.missingFields?.length || estate.workflowState === "blocked").length;
  const dashboardSource = record(source.dashboard);
  const dashboard: DashboardSnapshot = {
    openEstateCount: typeof dashboardSource.openEstateCount === "number"
      ? dashboardSource.openEstateCount
      : estates.filter((estate) => estate.workflowState !== "exported").length,
    queuedCount: typeof dashboardSource.queuedCount === "number"
      ? dashboardSource.queuedCount
      : queuedEstates.length,
    reviewCount: typeof dashboardSource.reviewCount === "number" ? dashboardSource.reviewCount : reviewCount,
    nextAction: stringValue(
      dashboardSource.nextAction,
      selectedEstateId ? "Open Document Prep for the selected estate." : "Choose an estate file to begin.",
    ),
  };
  const identity: BeuiAccountIdentity | null = session.authenticated || user.email
    ? {
        authenticated: session.authenticated === true,
        email: stringValue(user.email),
        name: stringValue(user.name, "Team member"),
        domain: stringValue(user.email).split("@")[1] || undefined,
      }
    : null;
  const outreach = record(source.outreach);
  const campaigns = (Array.isArray(outreach.campaigns) ? outreach.campaigns : [])
    .map(mapCampaign)
    .filter((campaign): campaign is OutreachCampaign => Boolean(campaign));
  const templates = (Array.isArray(outreach.templates) ? outreach.templates : [])
    .map(mapTemplate)
    .filter((template): template is OutreachTemplate => Boolean(template));
  const integrations = (Array.isArray(source.connections) ? source.connections : [])
    .map(mapConnection)
    .filter((connection): connection is IntegrationRecord => Boolean(connection));
  const modelStatusSource = record(settings.agenticModelStatus);
  const verifiedFreeModels = stringList(settings.verifiedFreeModels);
  const modelCandidate = stringValue(modelStatusSource.model);
  const agenticModelStatus: BeuiAgenticModelStatus = {
    loaded: modelStatusSource.loaded === true,
    available: modelStatusSource.available === true && verifiedFreeModels.length > 0,
    provider: "nous",
    model: verifiedFreeModels.includes(modelCandidate) ? modelCandidate : null,
    route: ["dynamic-free-catalog", "configured-free-model", "unavailable"].includes(stringValue(modelStatusSource.route))
      ? stringValue(modelStatusSource.route) as BeuiAgenticModelStatus["route"]
      : "unavailable",
  };
  const preferenceCandidate = stringValue(settings.agenticModelPreference, "dynamic-free-catalog");
  const agenticModelPreference = preferenceCandidate === "dynamic-free-catalog" || verifiedFreeModels.includes(preferenceCandidate)
    ? preferenceCandidate
    : "dynamic-free-catalog";
  const modelIntegration: IntegrationRecord = {
    id: "nous-portal",
    label: "Nous Portal",
    state: !agenticModelStatus.loaded ? "neutral" : agenticModelStatus.available ? "ready" : "review",
    detail: !agenticModelStatus.loaded
      ? "Loading the verified free text-model catalog."
      : agenticModelStatus.available
        ? "Verified free text-model catalog available."
        : "No verified free model is available; reviewed formatting remains available.",
  };
  const visibleIntegrations = [modelIntegration, ...integrations.filter((integration) => integration.id !== "nous-portal" && integration.label !== "Nous Portal")];
  const settingsTab = ["access", "integrations", "support", "outreach", "preferences", "admin"].includes(
    stringValue(settings.activeTab),
  ) ? stringValue(settings.activeTab) as BeuiSettingsTabId : "integrations";
  return {
    activeRoute: normalizeBeuiRoute(stringValue(source.activeView, "dashboard")),
    selectedEstateId,
    hasVerifiedIdiReport,
    selectedIds,
    identity,
    canOpenAdmin: Boolean(session.canAdminister),
    estates,
    exportedEstates,
    queuedEstates: queuedEstates.length ? queuedEstates : estates.filter((estate) => estate.workflowState === "queued"),
    dashboard,
    campaigns,
    templates,
    selectedCampaignId: stringValue(outreach.selectedCampaignId) || undefined,
    selectedTemplateId: stringValue(outreach.selectedTemplateId) || undefined,
    integrations: visibleIntegrations,
    agenticModelStatus,
    agenticModelPreference,
    verifiedFreeModels,
    preferences: {
      holdNoContact: preferences.holdNoContact !== false,
      compactTables: preferences.compactTables === true,
    },
    settingsTab,
    accessDomains: stringList(settings.accessDomains || source.adminAccessDomains),
  };
}

function safeActionError() {
  return "The workspace action could not complete. Review the current state and try again.";
}

function matchesGlobalSearch(value: string, query: string) {
  return !query || value.toLowerCase().includes(query);
}

function useMountedSnapshot(adapter: BeuiBridgeAdapter) {
  const [snapshot, setSnapshot] = useState(() => mountedSnapshot(adapter.readState()));
  useEffect(() => adapter.subscribe((next) => setSnapshot(mountedSnapshot(next))), [adapter]);
  return snapshot;
}

function useDocPrepController(adapter: BeuiBridgeAdapter, estateId: string | null, hasVerifiedIdiReport: boolean) {
  const [processCase, setProcessCase] = useState<ProcessCase>(() => estateId ? caseForEstate(estateId) : null);
  const [pendingAction, setPendingAction] = useState<DocPrepPendingAction>();
  const [uploadError, setUploadError] = useState("");
  const [googleDriveState, setGoogleDriveState] = useState<"idle" | "pending" | "success" | "failed">("idle");
  const [hydrating, setHydrating] = useState(Boolean(estateId));

  useEffect(() => {
    let active = true;
    setPendingAction(undefined);
    setUploadError("");
    setGoogleDriveState("idle");
    setProcessCase(estateId ? caseForEstate(estateId) : null);
    if (!estateId) {
      setHydrating(false);
      return () => {
        active = false;
      };
    }
    setHydrating(true);
    void hydrateProcessCase(estateId, { force: true })
      .then((next) => {
        if (active) setProcessCase(next);
      })
      .catch(() => {
        if (active && !caseForEstate(estateId)) setUploadError("The durable Doc Prep case could not be loaded. Refresh and try again.");
      })
      .finally(() => {
        if (active) setHydrating(false);
      });
    return () => {
      active = false;
    };
  }, [adapter, estateId]);

  async function refreshCase() {
    if (!estateId) return null;
    const localCase = caseForEstate(estateId);
    if (localCase) setProcessCase(localCase);
    try {
      const next = await hydrateProcessCase(estateId, { force: true });
      setProcessCase(next);
      return next;
    } catch (error) {
      if (localCase) return localCase;
      throw error;
    }
  }

  async function runCommand(action: DocPrepPendingAction, command: string, payload: Record<string, unknown> = {}) {
    if (!estateId || pendingAction) return;
    if (action === "start" && !hasVerifiedIdiReport) {
      setUploadError("Attach a verified PDF IDI report before starting Doc Prep.");
      return;
    }
    setPendingAction(action);
    setUploadError("");
    try {
      await adapter.dispatch(command, { estateId, ...payload });
      await refreshCase();
    } catch {
      setUploadError(safeActionError());
    } finally {
      setPendingAction(undefined);
    }
  }

  async function exportToDrive() {
    if (!estateId || pendingAction) return;
    setPendingAction("export");
    setGoogleDriveState("pending");
    try {
      await adapter.dispatch("beui-docprep-export", { estateId });
      setGoogleDriveState("success");
    } catch {
      setGoogleDriveState("failed");
    } finally {
      setPendingAction(undefined);
    }
  }

  function uploadFiles(files: File[]) {
    const file = files[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
    if (!isPdf) {
      setUploadError("Select a PDF IDI report to continue.");
      return;
    }
    void runCommand("upload", "beui-docprep-upload-idi", { file });
  }

  const events = processCase && Array.isArray(processCase.events)
    ? processCase.events.filter((event): event is Record<string, unknown> => Boolean(event && typeof event === "object"))
    : [];
  return {
    processCase,
    events,
    pendingAction,
    uploadError,
    googleDriveState,
    onStart: estateId && hasVerifiedIdiReport && !hydrating ? () => void runCommand("start", "beui-docprep-start") : undefined,
    onRetry: estateId ? () => void runCommand("retry", "beui-docprep-action", { action: "retry" }) : undefined,
    onStop: estateId ? () => void runCommand("stop", "beui-docprep-action", { action: "cancel" }) : undefined,
    onExportGoogleDrive: estateId ? () => void exportToDrive() : undefined,
    onUploadFiles: estateId ? uploadFiles : undefined,
  };
}

export function MountedBeuiApp({ adapter }: { adapter: BeuiBridgeAdapter }) {
  const snapshot = useMountedSnapshot(adapter);
  const [selectedEstateIds, setSelectedEstateIds] = useState(snapshot.selectedIds);
  const [settingsTab, setSettingsTab] = useState(snapshot.settingsTab);
  const [helpArea, setHelpArea] = useState<BeuiHelpAreaId>("estates");
  const [importPending, setImportPending] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const selectionKey = snapshot.selectedIds.join("\u001f");
  const lastBridgeSelectionKey = useRef(selectionKey);
  const docPrep = useDocPrepController(adapter, snapshot.selectedEstateId, snapshot.hasVerifiedIdiReport);

  useEffect(() => {
    if (lastBridgeSelectionKey.current === selectionKey) return;
    lastBridgeSelectionKey.current = selectionKey;
    setSelectedEstateIds(snapshot.selectedIds);
  }, [selectionKey, snapshot.selectedIds]);

  useEffect(() => setSettingsTab(snapshot.settingsTab), [snapshot.settingsTab]);

  const emitFailure = useCallback(() => {
    adapter.emit("Action needs attention", safeActionError(), "blocked");
  }, [adapter]);

  const dispatchSafely = useCallback(async (command: string, payload: BeuiCommandPayload = {}) => {
    try {
      await adapter.dispatch(command, payload);
    } catch {
      emitFailure();
    }
  }, [adapter, emitFailure]);

  useEffect(() => {
    if (snapshot.activeRoute !== "settings" || snapshot.settingsTab !== "integrations" || snapshot.agenticModelStatus.loaded) return;
    void dispatchSafely("beui-load-agentic-model-status");
  }, [dispatchSafely, snapshot.activeRoute, snapshot.agenticModelStatus.loaded, snapshot.settingsTab]);

  const handleCommand: BeuiCommandHandler = useCallback((command, payload) => {
    if (command === "select-estate") {
      const estateId = stringValue(payload.estateId);
      if (estateId) setSelectedEstateIds([estateId]);
    }
    void dispatchSafely(command, payload);
  }, [dispatchSafely]);

  const handleNavigate = useCallback((route: BeuiRouteId) => {
    try {
      adapter.navigate(route);
      if (route === "settings") void dispatchSafely("beui-load-agentic-model-status");
    } catch {
      emitFailure();
    }
  }, [adapter, dispatchSafely, emitFailure]);

  const handleImport = useCallback(async (files: File[]) => {
    if (importPending) throw new Error("An estate file import is already in progress.");
    setImportPending(true);
    try {
      for (const file of files) {
        await adapter.dispatch("beui-import-estate-file", { file });
      }
    } catch {
      emitFailure();
      throw new Error("The estate files could not be added. Review the file and try again.");
    } finally {
      setImportPending(false);
    }
  }, [adapter, emitFailure, importPending]);

  const spotlight = useCallback((targetId: string) => {
    const findTarget = () => document.querySelector(`[data-beui-control="${targetId}"]`);
    const waitForTarget = (attempt = 0) => {
      window.requestAnimationFrame(() => {
        const target = findTarget();
        if (!target && attempt < 8) {
          waitForTarget(attempt + 1);
          return;
        }
        if (!target) return;
        document.querySelectorAll("[data-beui-spotlight]").forEach((node) => node.removeAttribute("data-beui-spotlight"));
        target.setAttribute("data-beui-spotlight", "true");
        (target as HTMLElement).scrollIntoView?.({
          block: "center",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        });
        const focusable = target.matches("button,input,a,[tabindex]")
          ? target
          : target.querySelector("button,input,a,[tabindex]");
        (focusable as HTMLElement | null)?.focus?.({ preventScroll: true });
      });
    };
    waitForTarget();
  }, []);

  const status: BeuiScreenStatus = importPending ? "loading" : "idle";
  const normalizedGlobalSearch = globalSearchQuery.trim().toLowerCase();
  const visibleEstates = snapshot.estates.filter((estate) => matchesGlobalSearch(
    `${estate.title} ${estate.address || ""}`,
    normalizedGlobalSearch,
  ));
  const visibleQueuedEstates = snapshot.queuedEstates.filter((estate) => matchesGlobalSearch(
    `${estate.title} ${estate.address || ""}`,
    normalizedGlobalSearch,
  ));
  const visibleExportedEstates = snapshot.exportedEstates.filter((estate) => matchesGlobalSearch(
    `${estate.title} ${estate.address || ""}`,
    normalizedGlobalSearch,
  ));
  const visibleCampaigns = snapshot.campaigns.filter((campaign) => matchesGlobalSearch(
    `${campaign.label} ${campaign.detail || ""}`,
    normalizedGlobalSearch,
  ));
  const visibleTemplates = snapshot.templates.filter((template) => matchesGlobalSearch(
    `${template.label} ${template.detail || ""}`,
    normalizedGlobalSearch,
  ));
  const settingsPreferences = snapshot.preferences;
  const docPrepNode = (
    <DocPrepSequence
      processCase={docPrep.processCase}
      events={docPrep.events}
      requiresIdiReview={!snapshot.hasVerifiedIdiReport}
      pendingAction={docPrep.pendingAction}
      uploadError={docPrep.uploadError}
      googleDriveState={docPrep.googleDriveState}
      onStart={docPrep.onStart}
      onRetry={docPrep.onRetry}
      onStop={docPrep.onStop}
      onExportGoogleDrive={docPrep.onExportGoogleDrive}
      onUploadFiles={docPrep.onUploadFiles}
    />
  );

  return (
    <BeuiChassis
      activeRoute={snapshot.activeRoute}
      includeDossiers
      identity={snapshot.identity}
      canOpenAdmin={snapshot.canOpenAdmin}
      status={status}
      dashboard={snapshot.dashboard}
      estates={visibleEstates}
      exportedEstates={visibleExportedEstates}
      queuedEstates={visibleQueuedEstates}
      selectedEstateIds={selectedEstateIds}
      campaigns={visibleCampaigns}
      templates={visibleTemplates}
      selectedCampaignId={snapshot.selectedCampaignId}
      selectedTemplateId={snapshot.selectedTemplateId}
      integrations={snapshot.integrations}
      agenticModelStatus={snapshot.agenticModelStatus}
      agenticModelPreference={snapshot.agenticModelPreference}
      verifiedFreeModels={snapshot.verifiedFreeModels}
      preferences={settingsPreferences}
      activeSettingsTab={settingsTab}
      activeHelpArea={helpArea}
      accessDomains={snapshot.accessDomains}
      docPrep={docPrepNode}
      onNavigate={handleNavigate}
      onGlobalSearchChange={setGlobalSearchQuery}
      onSwitchAccount={() => window.location.assign("/auth/login?prompt=select_account")}
      onSignOut={() => window.location.assign("/auth/logout")}
      onCommand={handleCommand}
      onEstateSelectionChange={setSelectedEstateIds}
      onEstateFilesAdded={handleImport}
      onCampaignChange={(campaignId) => void dispatchSafely("beui-outreach-select-campaign", { campaignId })}
      onTemplateChange={(templateId) => void dispatchSafely("beui-outreach-select-template", { templateId })}
      onTemplateAction={(action, template) => void dispatchSafely("beui-outreach-template-action", { action, templateId: template.id })}
      onSettingsTabChange={(tab) => {
        setSettingsTab(tab);
        void dispatchSafely("beui-settings-tab", { tab });
      }}
      onPreferenceChange={(key, value) => void dispatchSafely("beui-set-preference", { key, value })}
      onConnectionAction={(connectionId) => void dispatchSafely("beui-refresh-connection", { connectionId })}
      onAgenticModelChange={(model) => void dispatchSafely("beui-set-agentic-model", { model })}
      onOpenAuth={() => window.location.assign("/auth/login")}
      onAdminAction={(action) => void dispatchSafely("beui-admin-action", { action })}
      onHelpAreaChange={setHelpArea}
      onSpotlight={spotlight}
    />
  );
}
