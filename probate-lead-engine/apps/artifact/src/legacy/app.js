import { installLegacyBridge, renderView, runLifecycle, runtime, uninstallLegacyBridge } from "../core/feature-registry.js";
import { clientDefaultEstatesCsv, clientDefaultEstatesFileName } from "../data/client-default-estates.mjs";
import { normalizePublicConnection } from "../core/public-connection.js";
import { setTheme as setRuntimeTheme } from "../core/theme-store.js";
import { verifiedArtifactHref } from "../core/verified-artifact-link.js";
import { containModalKeydown } from "../ui/focus-containment.js";
import {
  estateWorkflowDocPrepStates,
  estateWorkflowExportQueueStates,
  estateWorkflowStateLabels,
  estateWorkflowStates,
  estateWorkflowTransitions,
} from "../features/estate-export/workflow-model.js";
import {
  caseForEstate,
  exportVerifiedPdfToGoogleDrive,
  hydrateProcessCase,
  requestCaseAction,
  startProcessCase,
} from "../features/doc-prep/cloud-process.js";

const state = {
  activeView: "find-estates",
  data: null,
  dossier: null,
  dailyRun: null,
  qualificationReview: null,
  freshBatch: null,
  session: null,
  connections: [],
  googleWorkspace: null,
  googleWorkspaceFolders: [],
  googleWorkspaceLoading: false,
  exportResult: null,
  packetArtifacts: {},
  packetApprovals: {},
  rows: [],
  filteredRows: [],
  demoEstateLeadsActive: false,
  resultsPage: 1,
  resultsPageSize: 10,
  selectedId: null,
  selectedIds: new Set(),
  queueIds: new Set(),
  queueSelectionIds: new Set(),
  queueTab: "doc-prep",
  estateWorkflow: {},
  summaryMetricsOpen: false,
  railOpen: false,
  railMode: "report",
  detailRailOpen: true,
  railTab: "flow",
  railWidth: 388,
  railResizing: false,
  activeRailPointerId: undefined,
  suppressRailOutsideCloseOnce: false,
  suppressRailOutsideCloseUntil: 0,
  filterWidth: 320,
  filterCollapsed: false,
  railPreview: null,
  exportRoute: null,
  filled: new Set(),
  railNames: {},
  activityOpen: false,
  shellCommandCount: 0,
  shellEvents: [],
  actionErrorLog: [],
  railRenaming: false,
  dashboardActivityTab: "activities",
  dashboardRange: "7d",
  selectedDossierDocId: "",
  activeDocPrepFlow: "discovery",
  docPrepListOpen: true,
  searchPopupOpen: false,
  historyRailOpen: false,
  filterPopoverOpen: false,
  searchHistory: [],
  historyProspectIds: null,
  sortState: {
    results: { key: "address", direction: "asc" },
    dossiers: { key: "", direction: "" }
  },
  docPrepAddModal: {
    open: false,
    flowId: "discovery"
  },
  dealStatuses: {},
  dealStatusLabels: {},
  docPrepPhaseIndex: {
    discovery: 0,
    "closing-docs": 0
  },
  docPrepEstateState: {},
  discoveryOpen: false,
  docPrepManualFix: null,
  discoveryPhaseIndex: 0,
  discoveryCompleted: new Set(),
  discoveryNotes: {},
  discoveryPreferences: {},
  sourceCaptures: {},
  idiImports: {},
  contactReviews: {},
  documentFiles: {},
  closingFieldValues: {},
  closingTemplateSelections: {},
  closingExportState: {},
  workspaceStateRevisions: {},
  documentActionModal: {
    open: false,
    docId: null,
    action: "add"
  },
  crmImports: [],
  showArchivedEstates: false,
  crmImportModal: {
    open: false,
    mode: "single",
    provider: "podio",
    draft: {
      batchRows: "",
      sourceUrl: "",
      notes: ""
    }
  },
  crmImportUpload: {
    status: "idle",
    name: "",
    size: 0,
    rowCount: 0,
    progress: 0,
    message: "",
    failurePhase: "",
    source: ""
  },
  columnOrder: {
    results: ["address", "lead", "evidence"],
    dossiers: ["address", "lead", "evidence"]
  },
  dripSettings: {
    startDelay: "same-day",
    smsCap: "2",
    reviewOwnerRequired: true,
    requireCourtPacket: true,
    holdNoContact: true,
    operatorNote: ""
  },
  beuiPreferences: {
    compactTables: false,
  },
  outreachTemplateModal: {
    open: false,
    channel: "sms",
    templateId: null,
    attachmentsOpen: false
  },
  outreachWorkspace: {
    campaigns: [],
    templates: [],
    audit: []
  },
  accountMenuOpen: false,
  selectedOutreachCampaignId: null,
  selectedOutreachTemplateId: null,
  outreachArchiveOpen: false,
  outreachNotification: null,
  outreachSideTab: "variables",
  settingsTab: "integrations",
  adminSettingsUnlocked: false,
  adminPasswordStatus: { state: "idle", message: "" },
  agenticModelPreference: "dynamic-free-catalog",
  agenticModelStatus: { loaded: false, available: false, provider: "nous", model: null, freeModels: [], route: "unavailable" },
  documentAutomationStates: {},
  docPrepRunStates: {},
  docPrepStreamStates: {},
  docPrepSectionIndex: {},
  helpDemoTab: "docprep",
  reportDateAdded: "",
  walkthrough: {
    open: false,
    index: 0,
    demoId: "product-tour"
  },
  adminAccessStatus: {
    state: "idle",
    message: ""
  },
  adminTicketStatus: {
    state: "idle",
    message: ""
  },
  adminAccessDomains: ["heirright.com", "solvys.io", "texasequitypros.com"],
  adminAccessEmails: [],
  shellSettings: {
    signalWeight: "3",
    taxThreshold: "2",
    reasonCodes: "probate-title-tax",
    deedProofRequired: true,
    paidSourceApproval: true
  }
};

const railWidthKey = "heirright:research-rail-width";
const filterWidthKey = "heirright:filter-rail-width";
const filterCollapsedKey = "heirright:filter-rail-collapsed";
const filterCollapseThreshold = 292;
const filledKey = "heirright:filled-report-gaps";
const railNamesKey = "heirright:rail-names";
const themeKey = "heirright:theme";
const shellSettingsKey = "heirright:shell-settings";
const discoveryStateKey = "heirright:discovery-workflow-state";
const docPrepEstateStateKey = "heirright:docprep-estate-state";
const adminAccessDomainsKey = "heirright:admin-access-domains";
const dealStatusStateKey = "heirright:deal-status-state";
const dealStatusLabelStateKey = "heirright:deal-status-labels";
const crmImportStateKey = "heirright:crm-imported-estates";
const sourceCaptureStateKey = "heirright:source-capture-state";
const idiImportStateKey = "heirright:idi-asset-imports";
const contactReviewStateKey = "heirright:contact-review-state";
const documentFilesStateKey = "heirright:document-files-state";
const closingFieldValuesStateKey = "heirright:closing-field-values";
const closingTemplateSelectionsStateKey = "heirright:closing-template-selections";
const closingExportStateKey = "heirright:closing-export-state";
const estateWorkflowStateKey = "heirright:estate-workflow-state";
const columnOrderStateKey = "heirright:column-order-state";
const searchHistoryStateKey = "heirright:search-history-state";
const dripSettingsKey = "heirright:drip-settings";
const beuiPreferencesKey = "heirright:beui-preferences";
const agenticModelPreferenceKey = "heirright:agentic-model-preference";
const outreachWorkspaceKey = "heirright:outreach-workspace";
const walkthroughStateKey = "heirright:guided-walkthrough-seen";
const estateFileImportMaxBytes = 3 * 1024 * 1024;
let walkthroughAutoTimer = null;
let shellViewTransitionTimer = null;
let estateImportFile = null;
let estateImportUploadToken = 0;
const documentAutomationTimers = new Map();
const serverBackedStateKeys = new Set([
  crmImportStateKey,
  docPrepEstateStateKey,
  dealStatusStateKey,
  dealStatusLabelStateKey,
  discoveryStateKey,
  sourceCaptureStateKey,
  idiImportStateKey,
  contactReviewStateKey,
  documentFilesStateKey,
  closingFieldValuesStateKey,
  closingTemplateSelectionsStateKey,
  closingExportStateKey,
  estateWorkflowStateKey,
  outreachWorkspaceKey
]);

// IDI_PERSISTENCE_BOUNDARY_START
// IDI report contents and contact data are server-owned records. The browser
// keeps them in memory for the active run, but generic workspace persistence
// may only retain the non-IDI parts of otherwise shared state.
const volatileIdiBrowserStateKeys = new Set([
  "heirright:idi-asset-imports",
  "heirright:contact-review-state"
]);

function parsedObjectState(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function idiSourceFact(fact) {
  if (!fact || typeof fact !== "object" || Array.isArray(fact)) return false;
  const source = `${fact.source || ""} ${fact.provider || ""}`.toLowerCase();
  const flags = Array.isArray(fact.reviewFlags) ? fact.reviewFlags.map(String) : [];
  return /\bidi(?:\b|\s|_|-)|idicore|idi_core/.test(source) || flags.some((flag) => /^IDI(?:_|-)/i.test(flag));
}

function sourceCapturePersistenceSnapshot(value) {
  const captures = parsedObjectState(value);
  return Object.fromEntries(Object.entries(captures).map(([key, record]) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return [key, record];
    const {
      dossier: _dossier,
      idiAssetImport: _idiAssetImport,
      idiImport: _idiImport,
      importedText: _importedText,
      candidates: _candidates,
      contactCandidates: _contactCandidates,
      reportText: _reportText,
      rawReport: _rawReport,
      ...safeRecord
    } = record;
    if (Array.isArray(record.sourceFacts)) {
      safeRecord.sourceFacts = record.sourceFacts.filter((fact) => !idiSourceFact(fact));
    }
    if (record.sourceApiRun && typeof record.sourceApiRun === "object" && !Array.isArray(record.sourceApiRun)) {
      const { sourceRunProof: _sourceRunProof, ...safeSourceApiRun } = record.sourceApiRun;
      safeRecord.sourceApiRun = safeSourceApiRun;
    }
    return [key, safeRecord];
  }));
}

function cloneSourceCaptureRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function documentFilesPersistenceSnapshot(value) {
  const files = parsedObjectState(value);
  return Object.fromEntries(Object.entries(files).filter(([key, record]) => {
    const recordId = String(record?.id || record?.documentId || "").toLowerCase();
    return recordId !== "idi-asset-search" && !String(key).toLowerCase().endsWith(":idi-asset-search");
  }));
}

function workspaceSafeStateText(key, value) {
  const text = String(value ?? "");
  if (volatileIdiBrowserStateKeys.has(key)) return "{}";
  if (key === "heirright:source-capture-state") {
    return JSON.stringify(sourceCapturePersistenceSnapshot(text));
  }
  if (key === "heirright:document-files-state") {
    return JSON.stringify(documentFilesPersistenceSnapshot(text));
  }
  return text;
}
// IDI_PERSISTENCE_BOUNDARY_END

const outreachAllowedApprovers = ["sam@heirright.com", "joshua@heirright.com"];
const outreachStatuses = ["Draft", "Ready", "Approved", "Sync to Podio", "Archived"];
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const columnMap = {
  lead: '[data-column="lead"]',
  address: '[data-column="address"]',
  score: '[data-column="score"]',
  evidence: '[data-column="evidence"]'
};

const defaultColumnOrder = {
  results: ["address", "lead", "evidence"],
  dossiers: ["address", "lead", "evidence"]
};

const tableColumnLabels = {
  lead: "Estate file",
  address: "Property address",
  evidence: "Classification"
};

function tableColumnLabel(scope, key) {
  if (scope === "results" && key === "evidence") return estateDateColumnMode(state.filteredRows.length ? state.filteredRows : state.rows) === "passing" ? "Date of Passing" : "Last Sale Date";
  return tableColumnLabels[key] ?? displayStatus(key);
}

const productViews = ["find-estates", "dossiers", "export", "drips", "dashboard", "queue", "admin", "settings", "help-demos"];

function normalizeEstateWorkflowStage(stage = {}) {
  const source = stage && typeof stage === "object" && !Array.isArray(stage) ? stage : {};
  const status = ["pending", "active", "complete", "blocked"].includes(String(source.status))
    ? String(source.status)
    : "pending";
  return {
    id: String(source.id || "stage").slice(0, 80),
    label: cleanDisplayValue(source.label || "Doc Prep stage").slice(0, 120),
    status,
    blocker: status === "blocked" ? cleanDisplayValue(source.blocker || "Review this stage before retrying.").slice(0, 240) : "",
    updatedAt: String(source.updatedAt || ""),
  };
}

function normalizeEstateWorkflowRecord(record = {}) {
  const source = record && typeof record === "object" && !Array.isArray(record) ? record : {};
  const stateName = estateWorkflowStates.includes(String(source.state)) ? String(source.state) : "active";
  const stages = Array.isArray(source.stages) ? source.stages.slice(0, 12).map(normalizeEstateWorkflowStage) : [];
  const artifact = source.artifact && typeof source.artifact === "object" && !Array.isArray(source.artifact)
    ? {
        artifactId: cleanDisplayValue(source.artifact.artifactId || ""),
        artifactUrl: String(source.artifact.artifactUrl || ""),
        contentHash: cleanDisplayValue(source.artifact.contentHash || ""),
        expiresAt: String(source.artifact.expiresAt || ""),
        fileName: cleanDisplayValue(source.artifact.fileName || ""),
        packetRevision: Number(source.artifact.packetRevision || 0),
      }
    : null;
  const handoff = source.handoff && typeof source.handoff === "object" && !Array.isArray(source.handoff)
    ? {
        route: cleanDisplayValue(source.handoff.route || ""),
        artifactId: cleanDisplayValue(source.handoff.artifactId || ""),
        readbackStatus: source.handoff.readbackStatus === "verified" ? "verified" : "review",
        completedAt: String(source.handoff.completedAt || ""),
      }
    : null;
  return {
    state: stateName,
    label: estateWorkflowStateLabels[stateName],
    exportEligible: Boolean(source.exportEligible),
    blocker: cleanDisplayValue(source.blocker || "").slice(0, 300),
    blockerStage: cleanDisplayValue(source.blockerStage || "").slice(0, 100),
    stages,
    artifact,
    handoff,
    updatedAt: String(source.updatedAt || ""),
    queuedAt: String(source.queuedAt || ""),
    processingAt: String(source.processingAt || ""),
    completedAt: String(source.completedAt || ""),
    exportedAt: String(source.exportedAt || ""),
  };
}

function normalizeEstateWorkflowState(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([estateId, record]) => estateId && record && typeof record === "object" && !Array.isArray(record))
    .map(([estateId, record]) => [String(estateId), normalizeEstateWorkflowRecord(record)]));
}

function estateWorkflowForRow(row = selectedRow()) {
  if (!row?.id) return normalizeEstateWorkflowRecord();
  return state.estateWorkflow[String(row.id)] || normalizeEstateWorkflowRecord();
}

function syncLegacyQueueIds() {
  state.queueIds = new Set(state.rows
    .filter((row) => estateWorkflowDocPrepStates.includes(estateWorkflowForRow(row).state))
    .map((row) => row.id));
}

function persistEstateWorkflow({ syncWorkspace = true } = {}) {
  const text = JSON.stringify(normalizeEstateWorkflowState(state.estateWorkflow));
  storageSetItem(estateWorkflowStateKey, text, { sync: false });
  return syncWorkspace ? persistServerState(estateWorkflowStateKey, text) : Promise.resolve(true);
}

function setEstateWorkflowState(row, nextState, patch = {}) {
  if (!row?.id || !estateWorkflowStates.includes(nextState)) throw new Error("Estate workflow state is unavailable.");
  const estateId = String(row.id);
  const previous = estateWorkflowForRow(row);
  if (previous.state !== nextState && !estateWorkflowTransitions[previous.state]?.includes(nextState)) {
    throw new Error("That estate is already in a later workflow stage. Refresh the workspace before retrying.");
  }
  const next = normalizeEstateWorkflowRecord({
    ...previous,
    ...patch,
    state: nextState,
    updatedAt: new Date().toISOString(),
  });
  state.estateWorkflow[estateId] = next;
  syncLegacyQueueIds();
  return next;
}

function patchEstateWorkflowState(row, patch = {}) {
  if (!row?.id) return null;
  const previous = estateWorkflowForRow(row);
  const requestedState = patch.state === undefined ? previous.state : String(patch.state);
  guardEstateWorkflowTransition(previous.state, requestedState);
  const next = normalizeEstateWorkflowRecord({
    ...previous,
    ...patch,
    state: requestedState,
    updatedAt: new Date().toISOString(),
  });
  state.estateWorkflow[String(row.id)] = next;
  syncLegacyQueueIds();
  return next;
}

const discoveryPhases = [
  {
    id: "owner-details",
    name: "Owner Details",
    label: "Owner details",
    source: "County property search",
    summary: "Start from the estate address, confirm owner name, folio, mailing address, and owner stop rules before any paid lookup.",
    steps: ["Confirm property address and folio from Property Appraiser.", "Confirm owner detail and mailing address.", "Mark company-owned or recently sold stop rules before continuing."],
    preferences: ["Address first", "Stop on company owner", "Flag sale inside five years"]
  },
  {
    id: "tax-receipt",
    name: "Tax Receipt",
    label: "Tax receipt",
    source: "Tax Collector",
    summary: "Capture tax history from the Tax Collector listing page, including the bottom-right receipt link and last paid-by party.",
    steps: ["Open the Tax Collector listing page for the asset.", "Capture the bottom-right receipt link and receipt artifact.", "Fill paid-by, paid date, amount due, unpaid years, and reassessment status."],
    preferences: ["Require listing-page receipt link", "Require paid-by name", "Capture reassessment changes"]
  },
  {
    id: "deed",
    name: "Deed",
    label: "Deed",
    source: "Official Records",
    summary: "Fetch the latest deed from the public-record source and preserve the OR book/page or instrument number.",
    steps: ["Search Official Records by owner/address/folio.", "Attach the latest deed file or source link.", "Fill OR book/page, instrument, grantor, grantee, and recording date."],
    preferences: ["Require deed attachment", "Require OR book/page", "Flag missing title path"]
  },
  {
    id: "obituary",
    name: "Obituary",
    label: "Obituary",
    source: "Google obituary search",
    summary: "Search owner obituary, then attach screenshot and link when found or record reviewed-not-found.",
    steps: ["Search the owner name and estate address context.", "Attach obituary screenshot and public link when found.", "Record reviewed-not-found without blocking the other stages."],
    preferences: ["Use obituary first", "Attach screenshot", "Record not-found result"]
  },
  {
    id: "idi-asset-search",
    name: "IDI Asset Search",
    label: "IDI asset search",
    source: "IDI Core expanded asset search",
    summary: "Import exactly one expanded asset search by estate address, then block duplicate paid runs unless admin override records a reason.",
    steps: ["Run IDI Core expanded asset search by the property address once.", "Import the report text or attachment metadata.", "Keep raw import review-only until contacts are accepted."],
    preferences: ["One paid run only", "Asset address search", "Admin override requires reason"]
  },
  {
    id: "contact-review",
    name: "Contact Review",
    label: "Contact review",
    source: "IDI likely relatives and associates",
    summary: "Accept spouse and children as primary secondary contacts, then keep remaining relatives and associates in Alternative Contacts unless promoted.",
    steps: ["Review spouse and child candidates first.", "Accept, reject, or promote each contact.", "Confirm phone, email, current address, and address history before score increases."],
    preferences: ["Spouse and children primary", "Same last name ranks higher", "Associates stay alternative"]
  },
  {
    id: "dossier-export",
    name: "Dossier Export",
    label: "Dossier export",
    source: "Podio prep",
    summary: "Prepare the completed dossier packet, Podio fields, and Google export rows after source evidence and contacts are reviewed.",
    steps: ["Review Discovery Dossier and completed report.", "Stage Podio fields and Google Sheets row.", "Hold live export until approval and readback are proven."],
    preferences: ["Prep only", "Batch export", "Require readback proof"]
  }
];

const closingDocPhases = [
  {
    id: "closing-intake",
    name: "Closing Intake",
    label: "Closing intake",
    source: "Podio or Google Sheets row",
    summary: "Start from the imported estate record, confirm the seller file, property address, folio, title company contact, and review owner.",
    steps: ["Confirm the imported estate row and review owner.", "Attach title-company or closing contact notes.", "Lock the source row before drafting closing paperwork."],
    preferences: ["Use imported estate record", "Require review owner", "Keep imported fields linked"]
  },
  {
    id: "title-clearance",
    name: "Title Clearance",
    label: "Title clearance",
    source: "Official Records and title review",
    summary: "Confirm the latest deed, title blockers, unpaid taxes, liens, and probate documents needed before a closing package can be drafted.",
    steps: ["Review latest deed and title chain notes.", "Confirm unpaid tax, lien, and mortgage assumptions.", "Record title-company blockers or clear-to-draft notes."],
    preferences: ["Require deed proof", "Require tax receipt status", "Flag lien review"]
  },
  {
    id: "seller-approval",
    name: "Seller Approval",
    label: "Seller approval",
    source: "Heir contact matrix",
    summary: "Map the heirs or sellers who must approve the deal and keep unresolved family-tree questions visible before drafting signatures.",
    steps: ["Confirm accepted spouse, child, heir, or representative contacts.", "Record signature authority questions.", "Keep alternative contacts out of the signer list unless promoted."],
    preferences: ["Primary contacts first", "Signature authority required", "No outreach without approval"]
  },
  {
    id: "offer-underwriting",
    name: "Offer Underwriting",
    label: "Offer underwriting",
    source: "Completed lead report",
    summary: "Review as-is value, taxes due, liens, mortgages, probate costs, partition risk, and per-heir offer math before drafting closing documents.",
    steps: ["Review the offer/profit table.", "Capture missing underwriting numbers.", "Mark the offer as review-ready or blocked."],
    preferences: ["Require offer table", "Keep draft label", "Block external use until review"]
  },
  {
    id: "closing-package",
    name: "Closing Package",
    label: "Closing package",
    source: "Closing docs template",
    summary: "Prepare purchase agreement, seller packet, assignment or deed request, escrow notes, and final recording checklist as one review bundle.",
    steps: ["Draft the closing packet from linked source facts.", "Stage Podio tasks and Google Sheets row.", "Hold live export until approval and readback are proven."],
    preferences: ["Bundle docs together", "Stage CRM tasks", "Require readback proof"]
  }
];

const docPrepFlows = {
  discovery: {
    id: "discovery",
    label: "Estate Discovery",
    title: "Estate Discovery",
    shortTitle: "Estate Discovery",
    cta: "Run Full Discovery",
    tag: "",
    copy: "Run the source-backed estate play: owner, property, deed, taxes, probate, heirs, IDI, contacts, and lead report.",
    phases: discoveryPhases
  },
  "closing-docs": {
    id: "closing-docs",
    label: "Closing Prep",
    title: "Closing Prep",
    shortTitle: "Closing Prep",
    cta: "Run Closing Prep",
    tag: "Closing templates",
    copy: "Turn a reviewed estate into the closing-template packet without leaving the same estate file.",
    phases: closingDocPhases
  }
};

const dealStatusOptions = [
  {
    id: "pre-discovery",
    label: "Pre-Discovery",
    flowId: "discovery",
    route: "Estate Discovery",
    copy: "Imported and waiting for source-backed Discovery."
  },
  {
    id: "post-discovery",
    label: "Post-Discovery",
    flowId: "discovery",
    route: "Outreach review",
    copy: "Discovery is complete enough for outreach review."
  },
  {
    id: "outreach",
    label: "Outreach",
    flowId: "discovery",
    route: "Email and SMS review",
    copy: "Ready for approved outreach templates and review."
  },
  {
    id: "warm",
    label: "Warm",
    flowId: "closing-docs",
    route: "Closing Prep",
    copy: "Move the estate toward Closing Prep."
  },
  {
    id: "hot",
    label: "Hot",
    flowId: "closing-docs",
    route: "Closing Prep",
    copy: "Prioritize Closing Prep and seller packet prep."
  },
  {
    id: "cold",
    label: "Cold",
    flowId: "discovery",
    route: "SMS drip outreach",
    copy: "Route to the cold-lead outreach drip queue."
  }
];

const closingTemplateFamilies = [
  {
    id: "fund-transfer-bank-account-transfer",
    title: "Fund Transfer / Bank Account Transfer",
    phaseId: "closing-package",
    type: "Disbursement setup",
    copy: "Seller proceeds and transfer authorization fields.",
    required: ["seller_heirs", "property_address", "folio", "transfer_amount", "buyer_entity"]
  },
  {
    id: "contract-for-deed",
    title: "Contract for Deed",
    phaseId: "offer-underwriting",
    type: "Draft agreement",
    copy: "Buyer, seller, transfer amount, property, folio, and legal description.",
    required: ["seller_heirs", "buyer_entity", "property_address", "folio", "legal_description", "transfer_amount"]
  },
  {
    id: "quit-claim-deed",
    title: "Quit Claim Deed",
    phaseId: "title-clearance",
    type: "Deed prep",
    copy: "Grantor, grantee, legal description, folio, mailing address, and marital status.",
    required: ["seller_heirs", "buyer_entity", "property_address", "folio", "legal_description", "seller_mailing_address", "seller_marital_status"]
  },
  {
    id: "limited-power-of-attorney",
    title: "Limited Power of Attorney",
    phaseId: "seller-approval",
    type: "Authority review",
    copy: "Principal, attorney-in-fact, and property scope.",
    required: ["seller_heirs", "representative", "property_address"]
  },
  {
    id: "assignment-of-surplus-rights",
    title: "Assignment of Surplus Rights Purchase Agreement",
    phaseId: "offer-underwriting",
    type: "Surplus rights draft",
    copy: "Surplus assignment parties, property, folio, and foreclosure case.",
    required: ["seller_heirs", "buyer_entity", "property_address", "folio", "foreclosure_case"],
    reviewNote: "Template examples use both HeirRight, LLC and Somi Home Buyers, LLC. Confirm the correct buyer/assignee entity before external use."
  },
  {
    id: "same-name-affidavit",
    title: "Same Name Affidavit",
    phaseId: "seller-approval",
    type: "Identity affidavit",
    copy: "Signer identity and reviewed name variants.",
    required: ["seller_heirs", "name_variants"]
  },
  {
    id: "joinder-waiver-consent",
    title: "Joinder, Waiver and Consent",
    phaseId: "seller-approval",
    type: "Consent packet",
    copy: "Estate, consenting party, and probate case.",
    required: ["deceased_name", "seller_heirs", "probate_case"]
  },
  {
    id: "affidavit-of-heirs",
    title: "Affidavit of Heirs",
    phaseId: "seller-approval",
    type: "Heirship affidavit",
    copy: "Deceased, reviewed heirs, relationships, and probate case.",
    required: ["deceased_name", "seller_heirs", "heir_relationships", "probate_case"]
  },
  {
    id: "valuable-consideration-disbursement",
    title: "Valuable Consideration Disbursement",
    phaseId: "closing-package",
    type: "Payment review",
    copy: "Grantor, grantee, property, and valuable-consideration amount.",
    required: ["seller_heirs", "buyer_entity", "property_address", "valuable_consideration_amount"]
  },
  {
    id: "assignment-disclaimer-interest",
    title: "Assignment and Disclaimer of Interest",
    phaseId: "seller-approval",
    type: "Interest transfer",
    copy: "Deceased, assigning party, disclaimer recipient, and probate case.",
    required: ["deceased_name", "seller_heirs", "disclaimer_recipient", "probate_case"]
  },
  {
    id: "land-trust-agreement",
    title: "Land Trust Agreement",
    phaseId: "closing-package",
    type: "Trust setup",
    copy: "Trust name, settlor, trustee, beneficiary, property, folio, and legal description.",
    required: ["trust_name", "property_address", "folio", "legal_description", "settlor_entity", "trustee", "beneficiary"]
  },
  {
    id: "tax-reimbursement",
    title: "Tax Reimbursement Credit",
    phaseId: "title-clearance",
    type: "Tax credit",
    copy: "Property, folio, tax payer, amount due, and deceased owner.",
    required: ["property_address", "folio", "tax_paid_by", "taxes_due", "deceased_name"]
  },
  {
    id: "buyer-purchase-agreement",
    title: "Buyer Purchase Agreement",
    phaseId: "offer-underwriting",
    type: "Purchase agreement",
    copy: "Buyer, seller, purchase price, property, folio, and legal description.",
    required: ["buyer_entity", "seller_heirs", "property_address", "folio", "legal_description", "purchase_price"]
  },
  {
    id: "unclaimed-funds-instructions",
    title: "Unclaimed Funds Instructions",
    phaseId: "closing-package",
    type: "Claim instructions",
    copy: "Claimant name and city for the approved unclaimed-funds instructions.",
    required: ["claimant_last_name", "claimant_first_name", "claimant_city"]
  }
].map((template) => ({ ...template, variables: template.required }));

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizedAssetAddress(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(court)\b/g, "ct")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function ownerLastName(value = "") {
  const parts = String(value || "")
    .replace(/\b(est|estate|of|the)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return String(parts.at(-1) || "").toLowerCase();
}

function legacyEstateStateFingerprint(row = selectedRow()) {
  if (!row) return "";
  return [normalizedAssetAddress(row.address || row.title), ownerLastName(row.owner || row.title || row.leadName)]
    .filter(Boolean)
    .join(":");
}

function assetDiscoveryKey(row = selectedRow()) {
  const estateId = String(row?.id || "").trim();
  return estateId;
}

const entityOwnerPattern = /\b(LLC|L\.L\.C\.|INC|CORP|CORPORATION|COMPANY|CO\.|LTD|LP|LLP|BANK|ASSOCIATION|ASSOC|FOUNDATION|ENTERPRISES?|HOLDINGS?|INVESTMENTS?|REALTY|PROPERTIES|CHURCH|IGLESIA|MINISTRIES|CONDO|COOPERATIVE)(?![A-Z0-9_])/i;
const recentSaleWindowMs = 5 * 365.25 * 24 * 60 * 60 * 1000;

function canonicalStopReasonsForRow(row = selectedRow()) {
  if (!row) return [];
  const dossier = dossierForRow(row);
  const capture = sourceCaptureForRow(row);
  const rules = Array.isArray(dossier?.workflow?.rules) ? dossier.workflow.rules : [];
  const ruleCodes = new Set(rules
    .filter((rule) => rule?.status === "stop")
    .flatMap((rule) => Array.isArray(rule.reasonCodes) ? rule.reasonCodes : []));
  const ownerValues = [
    capture.propertyAppraiser?.owner,
    capture.propertyAppraiser?.ownerName,
    dossier?.property?.ownerName?.value,
    row.owner,
  ].filter(Boolean);
  const companyOwner = ruleCodes.has("COMPANY_OWNER") || ownerValues.some((value) => entityOwnerPattern.test(String(value)));
  const saleValues = [
    capture.deed?.lastSaleDate,
    dossier?.deedHistory?.lastSaleDate?.value,
    rowLastSaleDateValue(row),
  ].filter(Boolean);
  const recentSale = ruleCodes.has("RECENT_SALE_WITHIN_5_YEARS") || saleValues.some((value) => {
    const timestamp = Date.parse(String(value));
    return Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp <= recentSaleWindowMs;
  });
  return [
    ...(companyOwner ? [{
      code: "COMPANY_OWNER",
      message: "Property Appraiser evidence identifies a company or entity owner. Move on; if the classification is wrong, correct the Property Appraiser source before retrying. There is no override.",
    }] : []),
    ...(recentSale ? [{
      code: "RECENT_SALE_WITHIN_5_YEARS",
      message: "Official Records evidence shows a sale within the last 5 years. Move on; if the date is wrong, correct the Official Records source before retrying. There is no override.",
    }] : []),
  ];
}

function canonicalStopBlocker(row = selectedRow(), action = "This action") {
  const reason = canonicalStopReasonsForRow(row)[0];
  return reason ? `${action} is blocked. ${reason.message}` : "";
}

function storageCookieName(key) {
  return `hr_${encodeURIComponent(key).replace(/%/g, "_")}`;
}

function storageNameRecord() {
  const prefix = "heirright-storage:";
  try {
    const value = String(window.name || "");
    if (!value.startsWith(prefix)) return {};
    const parsed = JSON.parse(value.slice(prefix.length));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function setStorageNameRecord(record) {
  try {
    window.name = `heirright-storage:${JSON.stringify(record)}`;
  } catch {}
}

function localStateEndpointEnabled() {
  try {
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  } catch {
    return false;
  }
}

async function persistServerState(key, value) {
  if (!serverBackedStateKeys.has(key)) return true;
  try {
    const text = workspaceSafeStateText(key, value);
    const local = localStateEndpointEnabled();
    const expectedRevision = state.workspaceStateRevisions[key];
    if (!local && !Number.isInteger(expectedRevision)) {
      addShellEvent("Workspace save blocked", "The latest team version has not loaded yet. Reload the workspace before saving this change.", "blocked", true);
      return false;
    }
    const response = await fetch(local ? `/local-state/${encodeURIComponent(key)}` : "/api/workspace/state", {
      method: "POST",
      headers: { "content-type": local ? "text/plain;charset=utf-8" : "application/json" },
      body: local ? text : JSON.stringify({ key, value: text, expectedRevision }),
      keepalive: text.length < 60000
    });
    const result = await response.json().catch(() => ({}));
    if (!local && response.status === 409) {
      addShellEvent("Newer team version loaded", result.message || "A teammate saved this workspace first, so HeirRight reloaded the newest version instead of overwriting it.", "blocked", true);
      await hydrateServerBackedState();
      return false;
    }
    const verified = response.ok && (local || result.readbackStatus === "verified");
    if (verified && !local && Number.isInteger(result.revision)) state.workspaceStateRevisions[key] = result.revision;
    if (!verified) addShellEvent("Workspace save blocked", result.message || "A team workspace update did not pass storage readback.", "blocked", true);
    return verified;
  } catch {
    addShellEvent("Workspace save blocked", "The team workspace could not be reached. Your change remains in this browser until retry succeeds.", "blocked", true);
    return false;
  }
}

function storageGetItem(key) {
  try {
    const store = window.localStorage;
    if (store && typeof store.getItem === "function") {
      const stored = store.getItem(key);
      if (stored !== null) return stored;
    }
  } catch {}
  try {
    const store = window.sessionStorage;
    if (store && typeof store.getItem === "function") {
      const stored = store.getItem(key);
      if (stored !== null) return stored;
    }
  } catch {}
  try {
    const name = `${storageCookieName(key)}=`;
    const entry = document.cookie.split("; ").find((item) => item.startsWith(name));
    if (entry) return decodeURIComponent(entry.slice(name.length));
  } catch {}
  try {
    const record = storageNameRecord();
    return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : null;
  } catch {}
  return null;
}

function storageRemoveItem(key) {
  try {
    const store = window.localStorage;
    if (store && typeof store.removeItem === "function") store.removeItem(key);
  } catch {}
  try {
    const store = window.sessionStorage;
    if (store && typeof store.removeItem === "function") store.removeItem(key);
  } catch {}
  try {
    document.cookie = `${storageCookieName(key)}=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
  try {
    const record = storageNameRecord();
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      delete record[key];
      setStorageNameRecord(record);
    }
  } catch {}
}

function purgeLegacyIdiBrowserState() {
  const idiCoreUserApiKeyKey = "heirright:idi-core-user-api-key";
  const state = typeof globalThis !== "undefined" && globalThis.state && typeof globalThis.state === "object"
    ? globalThis.state
    : {};
  storageRemoveItem(idiCoreUserApiKeyKey);
  state.idiCoreUserApiKey = "";
  volatileIdiBrowserStateKeys.forEach((key) => storageRemoveItem(key));
}

function storageSetItem(key, value, options = {}) {
  const text = workspaceSafeStateText(key, value);
  if (volatileIdiBrowserStateKeys.has(key)) {
    storageRemoveItem(key);
    return options.sync === false ? Promise.resolve(true) : persistServerState(key, text);
  }
  try {
    const store = window.localStorage;
    if (store && typeof store.setItem === "function") {
      store.setItem(key, text);
    }
  } catch {}
  try {
    const store = window.sessionStorage;
    if (store && typeof store.setItem === "function") {
      store.setItem(key, text);
    }
  } catch {}
  try {
    document.cookie = `${storageCookieName(key)}=${encodeURIComponent(text)}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {}
  try {
    const record = storageNameRecord();
    record[key] = text;
    setStorageNameRecord(record);
  } catch {}
  return options.sync === false ? Promise.resolve(true) : persistServerState(key, text);
}

function restoreObjectFromStorage(key, fallback = {}) {
  try {
    const stored = JSON.parse(storageGetItem(key) ?? "null");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

function restoreWorkspaceSafeObjectFromStorage(key, fallback = {}) {
  const stored = storageGetItem(key);
  if (stored === null) return fallback;
  const safe = workspaceSafeStateText(key, stored);
  if (safe !== stored) storageSetItem(key, safe, { sync: false });
  try {
    const parsed = JSON.parse(safe);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function persistAssetDiscoveryState() {
  storageSetItem(sourceCaptureStateKey, JSON.stringify(sourceCapturePersistenceSnapshot(state.sourceCaptures)));
  storageSetItem(idiImportStateKey, "{}");
  storageSetItem(contactReviewStateKey, "{}");
}

function persistDocumentFiles() {
  storageSetItem(documentFilesStateKey, JSON.stringify(documentFilesPersistenceSnapshot(state.documentFiles)));
}

function persistClosingFieldValues() {
  storageSetItem(closingFieldValuesStateKey, JSON.stringify(state.closingFieldValues));
}

function persistClosingTemplateSelections() {
  storageSetItem(closingTemplateSelectionsStateKey, JSON.stringify(state.closingTemplateSelections));
}

function persistClosingExportState() {
  storageSetItem(closingExportStateKey, JSON.stringify(state.closingExportState));
}

function loadCrmImports() {
  try {
    const storedValue = storageGetItem(crmImportStateKey);
    if (storedValue === null) {
      state.crmImports = initialCrmImports();
      state.demoEstateLeadsActive = true;
      return;
    }
    const canonicalValue = canonicalCrmImportStateText(storedValue || "[]");
    state.crmImports = mergeClientDefaultEstateImports(JSON.parse(canonicalValue));
    const mergedValue = JSON.stringify(state.crmImports);
    if (mergedValue !== storedValue) storageSetItem(crmImportStateKey, mergedValue, { sync: false });
    state.demoEstateLeadsActive = state.crmImports.some(isDemoEstateImport);
  } catch {
    state.crmImports = initialCrmImports();
    state.demoEstateLeadsActive = true;
  }
}

function normalizeDealStatusState(value = {}) {
  const valid = new Set(dealStatusOptions.map((item) => item.id));
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .map(([key, status]) => [String(key || "").trim(), String(status || "").trim()])
    .filter(([key, status]) => key && valid.has(status)));
}

function normalizeDealStatusLabels(value = {}) {
  const valid = new Set(dealStatusOptions.map((item) => item.id));
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .map(([status, label]) => [
      String(status || "").trim(),
      String(label || "").replace(/\s+/g, " ").trim().slice(0, 34)
    ])
    .filter(([status, label]) => valid.has(status) && label));
}

function loadDealStatuses() {
  state.dealStatuses = normalizeDealStatusState(restoreObjectFromStorage(dealStatusStateKey, {}));
}

function loadDealStatusLabels() {
  state.dealStatusLabels = normalizeDealStatusLabels(restoreObjectFromStorage(dealStatusLabelStateKey, {}));
}

function persistDealStatuses() {
  storageSetItem(dealStatusStateKey, JSON.stringify(normalizeDealStatusState(state.dealStatuses)));
}

function persistDealStatusLabels() {
  storageSetItem(dealStatusLabelStateKey, JSON.stringify(normalizeDealStatusLabels(state.dealStatusLabels)));
}

function persistCrmImports(reason = "") {
  state.crmImports = state.crmImports.map(normalizeCrmImport);
  state.demoEstateLeadsActive = state.crmImports.some(isDemoEstateImport);
  const save = storageSetItem(crmImportStateKey, JSON.stringify(state.crmImports));
  if (reason) {
    addShellEvent(reason, "Saving the estate update to the shared HeirRight workspace. Live CRM writes and readback remain gated.", "review", false);
    save.then((verified) => {
      if (verified) addShellEvent("Workspace estate saved", "The estate update passed shared workspace readback and is available to the HeirRight team.", "ready", false);
    });
  }
}

function loadAssetDiscoveryState() {
  purgeLegacyIdiBrowserState();
  state.sourceCaptures = restoreWorkspaceSafeObjectFromStorage(sourceCaptureStateKey, {});
  state.idiImports = {};
  state.contactReviews = {};
  state.documentFiles = restoreWorkspaceSafeObjectFromStorage(documentFilesStateKey, {});
  state.closingFieldValues = restoreObjectFromStorage(closingFieldValuesStateKey, {});
  state.closingTemplateSelections = restoreObjectFromStorage(closingTemplateSelectionsStateKey, {});
  state.closingExportState = restoreObjectFromStorage(closingExportStateKey, {});
  const storedColumnOrder = restoreObjectFromStorage(columnOrderStateKey, {});
  state.columnOrder = {
    results: normalizeColumnOrder("results", storedColumnOrder.results),
    dossiers: normalizeColumnOrder("dossiers", storedColumnOrder.dossiers),
  };
}

function normalizeColumnOrder(scope, order) {
  const defaults = defaultColumnOrder[scope] ?? defaultColumnOrder.results;
  const incoming = Array.isArray(order) ? order.map(String) : [];
  const sortable = incoming.filter((key) => defaults.includes(key));
  return [...sortable, ...defaults.filter((key) => !sortable.includes(key))];
}

function persistColumnOrder() {
  storageSetItem(columnOrderStateKey, JSON.stringify(state.columnOrder));
}

function normalizeSearchHistoryItem(item = {}) {
  const prospects = Array.isArray(item.prospects) ? item.prospects : [];
  const normalizedProspects = prospects
    .map((prospect) => {
      if (typeof prospect === "string") return { id: prospect, label: prospect, address: "" };
      if (!prospect || typeof prospect !== "object") return null;
      return {
        id: String(prospect.id || "").trim(),
        label: String(prospect.label || prospect.name || prospect.id || "Prospect").trim().slice(0, 140),
        address: String(prospect.address || "").trim().slice(0, 180)
      };
    })
    .filter((prospect) => prospect?.id);
  return {
    id: String(item.id || `history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
    createdAt: item.createdAt || isoNow(),
    label: String(item.label || "Fresh lead search").trim().slice(0, 140),
    query: String(item.query || "").trim().slice(0, 140),
    county: String(item.county || "").trim().slice(0, 80),
    prospects: normalizedProspects.slice(0, 100),
    filters: item.filters && typeof item.filters === "object" && !Array.isArray(item.filters) ? item.filters : {}
  };
}

function loadSearchHistory() {
  const stored = restoreObjectFromStorage(searchHistoryStateKey, { items: [] });
  const items = Array.isArray(stored) ? stored : stored.items;
  state.searchHistory = Array.isArray(items) ? items.map(normalizeSearchHistoryItem).filter((item) => item.prospects.length) : [];
}

function persistSearchHistory() {
  const seen = new Set();
  const items = state.searchHistory
    .map(normalizeSearchHistoryItem)
    .filter((item) => {
      const key = `${item.query}:${item.createdAt}:${item.prospects.map((prospect) => prospect.id).join("|")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return item.prospects.length;
    })
    .slice(0, 20);
  state.searchHistory = items;
  storageSetItem(searchHistoryStateKey, JSON.stringify({ items }));
}

function searchHistoryRowEntry(row) {
  const parts = addressDisplayParts(row.address, row.county);
  return {
    id: row.id,
    label: row.leadName || row.title || "Estate prospect",
    address: `${parts.street}${parts.locality ? `, ${parts.locality}` : ""}`
  };
}

function recordSearchHistory(batch = state.freshBatch, filters = currentFreshLeadFilters()) {
  const rows = batch ? buildFreshBatchRows(batch) : state.rows.filter((row) => row.sourceKind === "fresh-batch");
  const prospects = rows.filter((row) => !row.isArchived).map(searchHistoryRowEntry);
  if (!prospects.length) return;
  const query = cleanDisplayValue(filters.query || document.getElementById("globalSearch")?.value || document.getElementById("sourceQuery")?.value || "Fresh lead search");
  const item = normalizeSearchHistoryItem({
    id: `history-${Date.now().toString(36)}`,
    createdAt: isoNow(),
    label: query || "Fresh lead search",
    query,
    county: filters.county || "miami-dade",
    filters,
    prospects
  });
  state.searchHistory = [item, ...state.searchHistory.filter((entry) => entry.id !== item.id)];
  persistSearchHistory();
}

function seedSearchHistoryFromCurrentRows() {
  if (state.searchHistory.length || !state.rows.length) return;
  const prospects = state.rows.filter((row) => row.sourceKind === "fresh-batch" && !row.isArchived).map(searchHistoryRowEntry);
  if (!prospects.length) return;
  state.searchHistory = [normalizeSearchHistoryItem({
    id: "history-current-public-batch",
    createdAt: state.freshBatch?.generatedAt || state.freshBatch?.latestRun?.generatedAt || isoNow(),
    label: "Current public-source batch",
    query: "EST OF",
    county: prospects[0]?.address?.split(",").slice(-2).join(",").trim() || "Miami-Dade",
    filters: currentFreshLeadFilters(),
    prospects
  })];
  persistSearchHistory();
}

function rowInDocPrepQueue(rowId) {
  const row = rowById(rowId);
  if (!row) return false;
  return Object.keys(docPrepFlows).some((flowId) => docPrepFlowHasWork(row, flowId));
}

function availableHistoryProspects(item) {
  return normalizeSearchHistoryItem(item).prospects.filter((prospect) => !rowInDocPrepQueue(prospect.id));
}

function applyServerBackedStateValue(key, value) {
  let parsed;
  try {
    parsed = JSON.parse(workspaceSafeStateText(key, value));
  } catch {
    return false;
  }
  if (key === crmImportStateKey) {
    state.crmImports = Array.isArray(parsed) ? parsed.map(normalizeCrmImport) : [];
    state.demoEstateLeadsActive = state.crmImports.some(isDemoEstateImport);
    return true;
  }
  if (key === docPrepEstateStateKey) {
    state.docPrepEstateState = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed)
        .filter(([recordKey, recordValue]) => recordKey && recordValue && typeof recordValue === "object" && !Array.isArray(recordValue))
        .map(([recordKey, recordValue]) => [recordKey, normalizeDocPrepEstateRecord(recordValue)]))
      : {};
    return true;
  }
  if (key === dealStatusStateKey) {
    state.dealStatuses = normalizeDealStatusState(parsed);
    return true;
  }
  if (key === dealStatusLabelStateKey) {
    state.dealStatusLabels = normalizeDealStatusLabels(parsed);
    return true;
  }
  if (key === sourceCaptureStateKey) {
    const incoming = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    const runtime = state.sourceCaptures;
    state.sourceCaptures = Object.fromEntries([...new Set([...Object.keys(incoming), ...Object.keys(runtime)])].map((recordKey) => {
      const safeRecord = incoming[recordKey] && typeof incoming[recordKey] === "object" && !Array.isArray(incoming[recordKey])
        ? incoming[recordKey]
        : {};
      const runtimeRecord = runtime[recordKey] && typeof runtime[recordKey] === "object" && !Array.isArray(runtime[recordKey])
        ? runtime[recordKey]
        : {};
      const runtimeIdiFacts = Array.isArray(runtimeRecord.sourceFacts) ? runtimeRecord.sourceFacts.filter(idiSourceFact) : [];
      const safeFacts = Array.isArray(safeRecord.sourceFacts) ? safeRecord.sourceFacts : [];
      const merged = {
        ...safeRecord,
        ...(runtimeRecord.dossier ? { dossier: runtimeRecord.dossier } : {}),
        sourceFacts: [...safeFacts, ...runtimeIdiFacts]
      };
      if (runtimeRecord.sourceApiRun?.sourceRunProof) {
        merged.sourceApiRun = {
          ...(safeRecord.sourceApiRun && typeof safeRecord.sourceApiRun === "object" ? safeRecord.sourceApiRun : {}),
          sourceRunProof: runtimeRecord.sourceApiRun.sourceRunProof
        };
      }
      return [recordKey, merged];
    }));
    return true;
  }
  if (key === idiImportStateKey) {
    return false;
  }
  if (key === contactReviewStateKey) {
    return false;
  }
  if (key === documentFilesStateKey) {
    const incoming = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    const runtimeIdiFiles = Object.fromEntries(Object.entries(state.documentFiles).filter(([recordKey, record]) => {
      const recordId = String(record?.id || record?.documentId || "").toLowerCase();
      return recordId === "idi-asset-search" || String(recordKey).toLowerCase().endsWith(":idi-asset-search");
    }));
    state.documentFiles = { ...incoming, ...runtimeIdiFiles };
    return true;
  }
  if (key === closingFieldValuesStateKey) {
    state.closingFieldValues = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    return true;
  }
  if (key === closingTemplateSelectionsStateKey) {
    state.closingTemplateSelections = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    return true;
  }
  if (key === closingExportStateKey) {
    state.closingExportState = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    return true;
  }
  if (key === estateWorkflowStateKey) {
    state.estateWorkflow = normalizeEstateWorkflowState(parsed);
    syncLegacyQueueIds();
    return true;
  }
  if (key === discoveryStateKey && parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const validPhaseIds = new Set(Object.values(docPrepFlows).flatMap((flow) => flow.phases.map((phase) => phase.id)));
    const completed = Array.isArray(parsed.completed) ? parsed.completed.map(String) : [];
    state.discoveryCompleted = new Set(completed.filter((phaseId) => validPhaseIds.has(phaseId)));
    const storedFlow = String(parsed.activeFlow || "").trim();
    state.activeDocPrepFlow = docPrepFlows[storedFlow] ? storedFlow : state.activeDocPrepFlow;
    const storedIndices = parsed.phaseIndices && typeof parsed.phaseIndices === "object" && !Array.isArray(parsed.phaseIndices) ? parsed.phaseIndices : {};
    state.docPrepPhaseIndex = Object.fromEntries(Object.keys(docPrepFlows).map((flowId) => [flowId, clampDocPrepPhaseIndex(flowId, storedIndices[flowId])]));
    state.discoveryPhaseIndex = state.docPrepPhaseIndex.discovery ?? 0;
    state.discoveryNotes = parsed.notes && typeof parsed.notes === "object" && !Array.isArray(parsed.notes) ? parsed.notes : {};
    state.discoveryPreferences = parsed.preferences && typeof parsed.preferences === "object" && !Array.isArray(parsed.preferences) ? parsed.preferences : {};
    return true;
  }
  return false;
}

async function hydrateServerBackedState() {
  let changed = false;
  const local = localStateEndpointEnabled();
  await Promise.all(Array.from(serverBackedStateKeys, async (key) => {
    try {
      const path = local ? `/local-state/${encodeURIComponent(key)}` : `/api/workspace/state?key=${encodeURIComponent(key)}`;
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      if (!local && Number.isInteger(payload.revision)) state.workspaceStateRevisions[key] = payload.revision;
      if (typeof payload.value === "string") {
        let safeValue = workspaceSafeStateText(key, payload.value);
        if (key === crmImportStateKey) safeValue = canonicalCrmImportStateText(safeValue);
        if (volatileIdiBrowserStateKeys.has(key)) {
          storageRemoveItem(key);
        } else if (safeValue !== storageGetItem(key)) {
          storageSetItem(key, safeValue, { sync: false });
        }
        changed = applyServerBackedStateValue(key, safeValue) || changed;
        if (safeValue !== payload.value) await persistServerState(key, safeValue);
      }
    } catch {}
  }));
  document.documentElement.dataset.crmImportCount = String(state.crmImports.length);
  document.documentElement.dataset.serverHydrated = changed ? "true" : "false";
  const hasActiveCrmImports = state.crmImports.some((item) => !item.deletedAt && !item.archivedAt);
  if (!changed && !hasActiveCrmImports) return false;
  rebuildRowsFromCurrentSources();
  const preferredCrmRow = crmImportRows()[0] ?? null;
  // Hydration may finish after the operator has opened an estate. Only choose
  // the first CRM row when nothing is selected; never replace the
  // operator's active estate with a sample/imported row in the background.
  if (!state.selectedId && preferredCrmRow) {
    state.selectedId = preferredCrmRow.id;
  }
  if (!state.selectedId || !rowById(state.selectedId)) state.selectedId = state.rows[0]?.id ?? null;
  applyFilters();
  updateFooterLeadContext(selectedRow());
  renderShellPanels();
  renderCurrentLoopView();
  document.documentElement.dataset.crmRowCount = String(state.rows.filter((row) => row.sourceKind === "crm-import").length);
  return true;
}

function sourceCaptureForRow(row = selectedRow()) {
  return state.sourceCaptures[assetDiscoveryKey(row)] ?? {};
}

function verifiedSourceCaptureResult(row = selectedRow()) {
  if (!row) return null;
  const capture = sourceCaptureForRow(row);
  const sourceRun = capture.sourceApiRun;
  if (
    !sourceRun
    || !capture.dossier
    || (sourceRun.mode !== "external_source_run" && sourceRun.configuredSourceRunVerified !== true)
    || sourceRun.persistence?.stored !== true
    || sourceRun.persistence?.readbackStatus !== "verified"
    || !sourceRun.generatedAt
    || !Array.isArray(capture.sourceFacts)
  ) return null;
  return {
    ok: true,
    mode: sourceRun.mode || "external_source_run",
    runId: sourceRun.runId || "",
    generatedAt: sourceRun.generatedAt,
    sourceFacts: capture.sourceFacts,
    sourceSummaries: Array.isArray(sourceRun.sourceSummaries) ? sourceRun.sourceSummaries : [],
    sourceRunProof: sourceRun.sourceRunProof || null,
    blockers: Array.isArray(sourceRun.blockers) ? sourceRun.blockers : [],
    message: sourceRun.message || "",
    persistence: sourceRun.persistence,
    dossier: capture.dossier
  };
}

function idiImportForRow(row = selectedRow()) {
  return state.idiImports[assetDiscoveryKey(row)] ?? null;
}

function idiImportReadyForDocPrep(row = selectedRow()) {
  const imported = idiImportForRow(row);
  return Boolean(
    imported
    && imported.readbackStatus === "verified"
    && imported.importVerification === "verified"
    && imported.reviewRequired !== true
    && (!imported.paidRun || imported.paidRunApproved === true)
    && imported.attachment?.artifactId
  );
}

async function hydrateCanonicalIdiImport(row = selectedRow()) {
  if (!row || isDemoEstateImport(row)) return null;
  const key = assetDiscoveryKey(row);
  try {
    const response = await fetch(`/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(key)}`, { cache: "no-store" });
    const record = await response.json().catch(() => ({}));
    if (response.status === 404 || record?.exists === false) return null;
    if (!response.ok || record?.ok !== true || record?.readbackStatus !== "verified") return null;
    state.idiImports[key] = {
      mode: cleanDisplayValue(record.mode || "uploaded_file"),
      provider: "idi",
      lockKey: cleanDisplayValue(record.lockKey || ""),
      importedAt: record.importedAt || new Date().toISOString(),
      importedBy: cleanDisplayValue(record.importedBy || "approved HeirRight user"),
      duplicateGuard: cleanDisplayValue(record.duplicateGuard || "first_import_only"),
      adminOverrideReason: record.adminOverrideReason ? cleanDisplayValue(record.adminOverrideReason) : null,
      attachment: record.attachment && typeof record.attachment === "object" ? record.attachment : null,
      extraction: record.extraction && typeof record.extraction === "object" ? record.extraction : null,
      candidates: Array.isArray(record.candidates) ? record.candidates : [],
      contactPreviewCount: Math.max(0, Number(record.contactPreviewCount || 0)),
      importVerification: cleanDisplayValue(record.importVerification || "verified"),
      paidRun: record.paidRun === true,
      paidRunApproved: record.paidRunApproved === true,
      paidRunVerification: cleanDisplayValue(record.paidRunVerification || "not_applicable"),
      reviewRequired: record.reviewRequired === true,
      readbackStatus: "verified",
    };
    return state.idiImports[key];
  } catch {
    return null;
  }
}

function contactReviewsForRow(row = selectedRow()) {
  return state.contactReviews[assetDiscoveryKey(row)] ?? {};
}

function extractPhones(text = "") {
  return Array.from(new Set(String(text).match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g) ?? []));
}

function extractEmails(text = "") {
  return Array.from(new Set(String(text).match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) ?? []));
}

function extractAddresses(text = "") {
  const matches = String(text).match(/\b\d{2,6}\s+[A-Z0-9 .#'-]+,\s*[A-Z .'-]+,\s*[A-Z]{2}\s*\d{5}\b/gi) ?? [];
  return Array.from(new Set(matches.map((item) => item.replace(/\s+/g, " ").trim())));
}

function extractIdiAge(text = "") {
  const value = Number(String(text).match(/\bage\s*[:#-]?\s*(\d{1,3})\b/i)?.[1]);
  return Number.isInteger(value) && value > 0 && value < 125 ? value : undefined;
}

function extractIdiInterest(text = "") {
  const value = String(text).match(
    /\b(?:interest|ownership share|heir share)\s*[:#-]\s*([^\n|;]{1,80}?)(?=\s+(?:age|likely current address|current address|address history|phone|email|relationship|review status|relative|associate|spouse|child|contact)\s*[:#-]|[\n|;]|$)/i,
  )?.[1]
    || String(text).match(/\b(?:\d+\/\d+(?:st|nd|rd|th)?|\d+(?:\.\d+)?%)\s*(?:interest|share)\b/i)?.[0]
    || "";
  return value.replace(/\s+/g, " ").trim();
}

function extractIdiAddressHistory(text = "") {
  const output = [];
  const lines = String(text).split(/\r?\n/);
  const addressPattern = /\b\d{2,6}\s+[A-Z0-9 .#'-]+,\s*[A-Z .'-]+,\s*[A-Z]{2}\s*\d{5}\b/gi;
  const countyPattern = /\b([A-Z][A-Za-z .'-]+(?:County|Parish|Borough))\b/i;
  const datePattern = /\b(?:(?:0?[1-9]|1[0-2])\/)?(?:19|20)\d{2}\b(?:\s*[-–—]\s*(?:(?:(?:0?[1-9]|1[0-2])\/)?(?:19|20)\d{2}|present|current))?/i;
  lines.forEach((line, index) => {
    const context = `${line} ${lines[index + 1] || ""}`;
    for (const match of line.matchAll(addressPattern)) {
      const address = match[0].replace(/\s+/g, " ").trim();
      const county = context.match(countyPattern)?.[1]?.replace(/\s+/g, " ").trim() || "";
      const dates = context.match(datePattern)?.[0]?.replace(/\s+/g, " ").trim() || "";
      if (!output.some((entry) => entry.address.toLowerCase() === address.toLowerCase() && entry.dates === dates)) {
        output.push({ address, ...(county ? { county } : {}), ...(dates ? { dates } : {}) });
      }
    }
  });
  return output;
}

function inferIdiRelationship(block = "") {
  const lower = String(block).toLowerCase();
  if (/\b(wife|husband|spouse)\b/.test(lower)) return "spouse";
  if (/\bdaughter\b/.test(lower)) return "daughter";
  if (/\bson\b/.test(lower)) return "son";
  if (/\b(child|children)\b/.test(lower)) return "child";
  if (/\b(parent|mother|father)\b/.test(lower)) return "parent";
  if (/\b(brother|sister|sibling)\b/.test(lower)) return "sibling";
  if (/\b(associate|neighbor)\b/.test(lower)) return "associate";
  return "relative";
}

function inferIdiName(block = "") {
  const lines = String(block).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const labeled = lines.map((line) => line.match(/(?:name|relative|associate|spouse|child|son|daughter)\s*[:\-]\s*([A-Z][A-Z .'-]{2,})/i)?.[1]).find(Boolean);
  if (labeled) return labeled.replace(/\s+/g, " ").trim();
  const heading = lines.find((line) => /^[0-9.)\s-]*[A-Z][A-Z .'-]{3,}$/.test(line) && !/\d{3}|\b(address|phone|email)\b/i.test(line));
  return heading ? heading.replace(/^[0-9.)\s-]+/, "").replace(/\s+/g, " ").trim() : "Unnamed contact";
}

function parseIdiImportCandidates(row, importedText = "") {
  const blocks = String(importedText || "")
    .split(/\n{2,}|(?=\n\s*(?:relative|associate|spouse|child|son|daughter)\s*[:\-])/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 8 && (/\b(phone|email|address|relative|associate|spouse|child|son|daughter)\b/i.test(block) || extractPhones(block).length || extractEmails(block).length));
  return blocks.map((block, index) => {
    const relationship = inferIdiRelationship(block);
    const addresses = extractAddresses(block);
    const addressHistoryDetails = extractIdiAddressHistory(block);
    const name = inferIdiName(block);
    const primary = /^(spouse|wife|husband|child|son|daughter)$/i.test(relationship);
    const sameLast = Boolean(ownerLastName(row?.owner || row?.title) && ownerLastName(name) === ownerLastName(row?.owner || row?.title));
    return {
      id: `${assetDiscoveryKey(row)}:idi:${index + 1}`,
      name,
      relationship,
      ...(extractIdiAge(block) ? { age: extractIdiAge(block) } : {}),
      ...(extractIdiInterest(block) ? { interest: extractIdiInterest(block) } : {}),
      group: primary ? "primary" : "alternative",
      phones: extractPhones(block),
      emails: extractEmails(block),
      currentAddress: addresses[0] || "",
      addressHistory: addresses,
      addressHistoryDetails,
      ownerLastNameMatch: sameLast,
      confidence: primary ? 86 : sameLast ? 72 : 58,
      reviewStatus: "imported",
    };
  });
}

function contactCandidatesForRow(row = selectedRow()) {
  const stored = idiImportForRow(row);
  return Array.isArray(stored?.candidates) ? stored.candidates : [];
}

function candidateReviewState(row, candidate) {
  return contactReviewsForRow(row)[candidate.id]?.status || candidate.reviewStatus || "imported";
}

function idiContactReviewRevision(row = selectedRow()) {
  const stored = idiImportForRow(row);
  return cleanDisplayValue(
    stored?.attachment?.contentHash
    || stored?.attachment?.artifactId
    || stored?.lockKey
    || stored?.importedAt
    || ""
  );
}

function publicContactReview(row = selectedRow()) {
  const stored = idiImportForRow(row);
  const candidates = contactCandidatesForRow(row);
  if (!row || !stored || !candidates.length) return null;
  return {
    estateId: String(row.id || ""),
    reportRevision: idiContactReviewRevision(row),
    candidates: candidates.map((candidate) => ({
      id: String(candidate.id || ""),
      name: cleanDisplayValue(candidate.name || "Unnamed contact"),
      relationship: cleanDisplayValue(candidate.relationship || "Relationship needs review"),
      group: candidate.group === "primary" ? "primary" : "alternative",
      phoneCount: Array.isArray(candidate.phones) ? candidate.phones.length : 0,
      emailCount: Array.isArray(candidate.emails) ? candidate.emails.length : 0,
      ownerLastNameMatch: candidate.ownerLastNameMatch === true,
      sourceLabel: cleanDisplayValue(candidate.sourceLocator?.label || "IDI report"),
      status: cleanDisplayValue(candidateReviewState(row, candidate) || "needs_review"),
    })),
  };
}

function acceptedContactCandidates(row = selectedRow()) {
  return contactCandidatesForRow(row).filter((candidate) => {
    const status = candidateReviewState(row, candidate);
    return status === "accepted" || status === "promoted" || status === "auto_accepted_high_confidence";
  });
}

function primaryContactCandidates(row = selectedRow()) {
  return contactCandidatesForRow(row).filter((candidate) => candidate.group === "primary" || candidateReviewState(row, candidate) === "promoted");
}

function alternativeContactCandidates(row = selectedRow()) {
  return contactCandidatesForRow(row).filter((candidate) => candidate.group !== "primary" && candidateReviewState(row, candidate) !== "promoted");
}

function rowDisplayScore(row) {
  if (!row) return 0;
  const accepted = acceptedContactCandidates(row).length;
  return Math.min(100, Number(row.score || 0) + accepted * 8);
}

function estateScoreValues(rows = state.rows) {
  return rows
    .filter((row) => row && row.kind !== "File")
    .map((row) => Number(rowDisplayScore(row)))
    .filter(Number.isFinite);
}

function lowestEstateScore(rows = state.rows) {
  const scores = estateScoreValues(rows);
  return scores.length ? Math.min(...scores) : 0;
}

function averageEstateScore(rows = state.rows) {
  const scores = estateScoreValues(rows);
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function highestEstateScore(rows = state.rows) {
  const scores = estateScoreValues(rows);
  return scores.length ? Math.max(...scores) : 0;
}

function rowDisplayClassification(row) {
  if (!row) return "Review";
  if (acceptedContactCandidates(row).length) return "Contact verified";
  if (idiImportForRow(row)) return "Review contacts";
  return rowClassification(row);
}

function rowSourceFacts(row = selectedRow()) {
  const sources = [
    row?.data?.seed?.confirmedSourceFacts,
    row?.data?.facts,
    row?.dossier?.audit?.facts,
    row?.dossier?.sourceFacts,
    row?.dossier?.publicRecordFacts
  ];
  return sources.flatMap((items) => Array.isArray(items) ? items : []).filter((item) => item && typeof item === "object");
}

function sourceFactType(fact = {}) {
  return cleanDisplayValue(fact.factType ?? fact.type ?? fact.kind ?? fact.key ?? fact.name ?? "");
}

function sourceFactValue(fact = {}) {
  return cleanDisplayValue(
    fact.value ??
    fact.displayValue ??
    fact.rawValue ??
    fact.label ??
    fact.summary ??
    fact.note ??
    ""
  );
}

function rowSourceFactValue(row, patterns = []) {
  const matchers = patterns.map((pattern) => pattern instanceof RegExp ? pattern : new RegExp(String(pattern), "i"));
  const found = rowSourceFacts(row).find((fact) => {
    const type = sourceFactType(fact);
    return matchers.some((pattern) => pattern.test(type));
  });
  return found ? sourceFactValue(found) : "";
}

function rowDateOfPassingValue(row) {
  return rowSourceFactValue(row, [/date[_\s-]*(of[_\s-]*)?(passing|death)/i, /\bdecedent[_\s-]*date\b/i, /\bdod\b/i]);
}

function rowLastSaleDateValue(row) {
  return rowSourceFactValue(row, [/last[_\s-]*sale[_\s-]*date/i, /sale[_\s-]*date/i, /deed[_\s-]*date/i, /instrument[_\s-]*date/i]);
}

function parseEvidenceDate(value) {
  const text = cleanDisplayValue(value);
  if (!text || /needs|missing|unknown|review/i.test(text)) return 0;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatEvidenceDate(value) {
  const text = cleanDisplayValue(value);
  const parsed = parseEvidenceDate(text);
  if (!parsed) return text || "Needs deed review";
  return new Date(parsed).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function estateDateColumnMode(rows = state.filteredRows) {
  return rows.some((row) => rowDateOfPassingValue(row)) ? "passing" : "sale";
}

function rowEstateDateValue(row, mode = estateDateColumnMode()) {
  const sourceValue = mode === "passing" ? rowDateOfPassingValue(row) : rowLastSaleDateValue(row);
  return formatEvidenceDate(sourceValue || rowLastSaleDateValue(row) || rowDateOfPassingValue(row));
}

function rowNextAction(row) {
  if (!row) return "Review";
  if (row.sourceKind === "crm-import" && !phaseIsComplete("dossier-export", row, "discovery")) return "Begin Estate Discovery";
  if (!idiImportForRow(row)) return "Import IDI";
  if (!acceptedContactCandidates(row).length) return "Review contacts";
  return row.next || "Review dossier";
}

function propertyAppraiserEvidenceComplete(row = selectedRow()) {
  const capture = sourceCaptureForRow(row);
  const evidence = capture.propertyAppraiser || {};
  const sourceUrl = String(evidence.sourceUrl || "").trim();
  let verifiedSource = false;
  try {
    const parsed = new URL(sourceUrl, window.location.origin);
    verifiedSource = parsed.protocol === "https:" && parsed.hostname !== window.location.hostname;
  } catch {}
  const persistenceVerified = capture.sourceApiRun?.persistence?.stored === true
    && capture.sourceApiRun?.persistence?.readbackStatus === "verified";
  return Boolean(
    verifiedSource
    && persistenceVerified
    && hasReviewedEvidenceValue(evidence.owner || evidence.ownerName)
    && hasReviewedEvidenceValue(evidence.address || evidence.propertyAddress)
    && hasReviewedEvidenceValue(evidence.folio || evidence.parcelId)
    && hasReviewedEvidenceValue(evidence.mailingAddress || evidence.mailingAddressSignal)
  );
}

function assetPhaseComplete(row, phaseId) {
  const dossier = dossierForRow(row);
  const capture = sourceCaptureForRow(row);
  if (phaseId === "owner-details") return propertyAppraiserEvidenceComplete(row);
  if (phaseId === "tax-receipt") return Boolean(
    capture.taxReceipt?.receiptLink
    || capture.taxReceipt?.sourceUrl
    || (capture.taxReceipt?.listingUrl && capture.taxReceipt?.status === "unavailable_after_listing_check")
  ) && capture.taxReceipt?.status !== "browser_workflow_required";
  if (phaseId === "deed") return Boolean(
    (capture.deed?.sourceUrl || capture.deed?.documentUrl || capture.deed?.fileName)
    && (capture.deed?.instrument || capture.deed?.instrumentNumber || capture.deed?.book || capture.deed?.page)
  );
  if (phaseId === "obituary") return Boolean(capture.obituary?.sourceUrl || capture.obituary?.fileName || capture.obituary?.status === "reviewed-not-found");
  if (phaseId === "idi-asset-search") {
    const idiImport = idiImportForRow(row);
    return Boolean(
      idiImport
      && idiImport.importVerification !== "pending_guard_commit"
      && idiImport.importVerification !== "review_required"
      && idiImport.reviewRequired !== true
      && (idiImport.paidRun !== true || idiImport.paidRunApproved === true)
    );
  }
  if (phaseId === "contact-review") return acceptedContactCandidates(row).length > 0;
  if (phaseId === "dossier-export") return docPrepPhaseMarkedComplete(row, "discovery", phaseId);
  if (phaseId === "closing-intake") return Boolean(row?.address && (row?.owner || row?.leadName));
  if (phaseId === "title-clearance") return assetPhaseComplete(row, "deed") && assetPhaseComplete(row, "tax-receipt");
  if (phaseId === "seller-approval") return acceptedContactCandidates(row).length > 0 || docPrepPhaseMarkedComplete(row, "discovery", "contact-review");
  if (phaseId === "offer-underwriting") return Boolean(dossier?.completedLeadReport?.offerMath);
  if (phaseId === "closing-package") return Boolean(row?.id && (state.queueIds.has(row.id) || state.exportResult?.ok));
  return false;
}

function initials(value) {
  const words = String(value || "HeirRight")
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? "").join("") || "HR";
}

function authGateBlocking(session = state.session) {
  return Boolean(session?.auth?.required && !session?.authenticated);
}

function authAllowedCopy(session = state.session) {
  const domains = Array.isArray(session?.auth?.allowedDomains) ? session.auth.allowedDomains : [];
  const emails = Array.isArray(session?.auth?.allowedEmails) ? session.auth.allowedEmails : [];
  const domainCopy = domains.length ? domains.join(", ") : "approved business domains";
  const emailCopy = emails.length ? ` Approved users: ${emails.join(", ")}.` : "";
  return `${domainCopy}.${emailCopy}`;
}

let authorizedWorkspaceReady = false;

function renderAuthGate(session = state.session, { startupError = "" } = {}) {
  const gate = document.getElementById("authGate");
  const workspace = document.getElementById("workspace");
  if (!gate) return;
  const blocked = authGateBlocking(session);
  const gated = blocked || !authorizedWorkspaceReady;
  document.body.dataset.authGated = gated ? "true" : "false";
  if (gated) workspace?.setAttribute("inert", "");
  else workspace?.removeAttribute("inert");
  if (!gated) {
    gate.innerHTML = "";
    return;
  }
  if (!blocked) {
    const failed = Boolean(startupError);
    gate.innerHTML = `
      <section class="auth-card" role="${failed ? "alert" : "status"}" aria-label="${failed ? "Workspace startup failed" : "Preparing workspace"}">
        <div>
          <p class="eyebrow">Team access confirmed</p>
          <h2>${failed ? "HeirRight could not finish opening" : "Preparing your workspace"}</h2>
        </div>
        <p>${escapeHtml(failed ? startupError : "Restoring the latest estate state and verified operator controls before the workspace becomes interactive.")}</p>
        ${failed ? `<button id="reloadWorkspace" class="btn primary" type="button">Reload workspace</button>` : ""}
      </section>
    `;
    gate.querySelector("#reloadWorkspace")?.addEventListener("click", () => window.location.reload());
    return;
  }
  const configured = Boolean(session?.auth?.configured);
  gate.innerHTML = `
    <section class="auth-card" role="dialog" aria-modal="true" aria-label="Sign in">
      <div>
        <p class="eyebrow">Team access</p>
        <h2>Sign in to HeirRight</h2>
      </div>
      <p>Use your approved Google Workspace account. Personal email domains cannot clear this workspace gate.</p>
      <a class="auth-google-button" href="/auth/login" aria-disabled="${configured ? "false" : "true"}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21 12.2c0-.7-.06-1.37-.18-2.02H12v3.82h5.05a4.32 4.32 0 0 1-1.87 2.84v2.36h3.03C20 17.56 21 15.12 21 12.2Z" fill="#4285F4"/><path d="M12 21c2.43 0 4.47-.8 5.96-2.18l-3.03-2.36c-.84.56-1.92.9-2.93.9-2.35 0-4.34-1.58-5.05-3.72H3.82v2.43A9 9 0 0 0 12 21Z" fill="#34A853"/><path d="M6.95 13.64A5.4 5.4 0 0 1 6.67 12c0-.57.1-1.12.28-1.64V7.93H3.82A9 9 0 0 0 3 12c0 1.45.35 2.82.82 4.07l3.13-2.43Z" fill="#FBBC05"/><path d="M12 6.64c1.32 0 2.5.45 3.43 1.34l2.59-2.59A8.7 8.7 0 0 0 12 3a9 9 0 0 0-8.18 4.93l3.13 2.43C7.66 8.22 9.65 6.64 12 6.64Z" fill="#EA4335"/></svg>
        <span>Continue with Google</span>
      </a>
      <p class="auth-allow-list">Accepted access: ${escapeHtml(authAllowedCopy(session))}</p>
      ${configured ? "" : `<p class="copy">Google sign-in is not configured in this environment yet. The deployed app needs the approved Google OAuth client and session secret before a user can clear this gate.</p>`}
    </section>
  `;
}

function renderAccountMenu() {
  const menu = document.getElementById("accountMenu");
  const chip = document.getElementById("accountChip");
  if (!menu || !chip) return;
  const user = state.session?.user;
  const name = user?.name || user?.email || "Beta access";
  const email = user?.email || (state.session?.auth?.required ? "Not signed in" : "Local review session");
  menu.dataset.open = state.accountMenuOpen ? "true" : "false";
  chip.setAttribute("aria-expanded", state.accountMenuOpen ? "true" : "false");
  menu.innerHTML = `
    <div class="account-menu-head beui-menu-head">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml(email)}</span>
    </div>
    <div class="account-menu-divider" role="presentation"></div>
    <a class="account-menu-action beui-menu-item" role="menuitem" href="/auth/login?prompt=select_account">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4.5 20a7.5 7.5 0 0 1 15 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M19 8v4m2-2h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span>Switch account</span>
    </a>
    <a class="account-menu-action beui-menu-item" role="menuitem" href="/auth/logout">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 6H6.5A2.5 2.5 0 0 0 4 8.5v7A2.5 2.5 0 0 0 6.5 18H10m4-8 4 4-4 4m4-4H9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span>Log out</span>
    </a>
  `;
}

function setAccountMenuOpen(open) {
  state.accountMenuOpen = Boolean(open && !authGateBlocking());
  renderAccountMenu();
  wireBeuiMenuKeyboard(document.getElementById("accountMenu") || document);
  if (state.accountMenuOpen) {
    document.querySelector("#accountMenu [role='menuitem']")?.focus({ preventScroll: true });
  }
}

function renderSession(session) {
  state.session = session;
  const accountChip = document.getElementById("accountChip");
  if (!accountChip) {
    renderAuthGate(session);
    return;
  }
  const user = session?.user;
  const name = user?.name || user?.email || "Beta access";
  const domain = user?.domain || (session?.auth?.required ? "Google OAuth" : "Local review");
  const avatar = document.getElementById("accountAvatar");
  if (avatar) {
    avatar.classList.toggle("has-image", Boolean(user?.picture));
    avatar.style.backgroundImage = user?.picture ? `url("${String(user.picture).replace(/"/g, "%22")}")` : "";
    avatar.textContent = user?.picture ? "" : initials(name);
  }
  document.getElementById("accountName").textContent = user?.email ? name : authGateBlocking(session) ? "Sign in" : "Beta access";
  document.getElementById("accountDomain").textContent = user?.email ? domain : authGateBlocking(session) ? "Google required" : "Local review";
  accountChip.title = user?.email ? `Signed in as ${user.email}. Click to sign out.` : "Beta access session";
  accountChip.setAttribute("aria-label", "Open account menu");
  renderAuthGate(session);
  if (authGateBlocking(session)) state.accountMenuOpen = false;
  renderAccountMenu();
}

function cleanDisplayValue(value) {
  return String(value ?? "").replace(/\b(\d{5})-0000\b/g, "$1");
}

function isPlaceholderLeadName(value) {
  return /^(fresh\s+public-source\s+validation\s+lead|live\s+public-source\s+lead|current\s+estate|lead\s+prospect|owner\s+needs\s+review|needs\s+review)$/i
    .test(String(value || "").trim());
}

function hasSpecificOwnerName(value) {
  const text = cleanDisplayValue(value).trim();
  return text.length > 2 && !isPlaceholderLeadName(text);
}

async function loadSession() {
  try {
    const response = await fetch("/auth/session", { cache: "no-store" });
    if (!response.ok) throw new Error("Session unavailable");
    const session = await response.json();
    renderSession(session);
    return session;
  } catch (error) {
    const session = {
      authenticated: false,
      user: null,
      auth: { required: true, configured: false, allowedDomains: ["heirright.com"], allowedEmails: [] }
    };
    renderSession(session);
    return session;
  }
}

function claimValue(claim, fallback = "Needs review") {
  if (!claim || claim.value === null || claim.value === undefined || claim.value === "") return cleanDisplayValue(fallback);
  if (typeof claim.value === "object") {
    return cleanDisplayValue(Object.values(claim.value).filter(Boolean).join(" / ") || fallback);
  }
  return cleanDisplayValue(claim.value);
}

function titleCaseNamePart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

const estateFileNameOverrides = new Map();

function leadNameInitialLabel(...candidates) {
  const raw = candidates
    .map((candidate) => String(candidate || "").trim())
    .find((candidate) => candidate && !/needs review|current estate/i.test(candidate));
  const clean = String(raw || "Lead prospect")
    .split(/\s+-\s+/)[0]
    .replace(/\b(the\s+)?(estate\s+of|est\s+of)\b\s*/i, "")
    .replace(/\b(est|estate)\b\.?$/i, "")
    .replace(/[^\p{L}\p{N},'\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.includes(",")) {
    return clean
      .split(",")
      .map((part) => titleCaseNamePart(part.trim()))
      .filter(Boolean)
      .join(", ");
  }
  return titleCaseNamePart(clean || "Lead prospect");
}

function estateFileNameKey(value) {
  return cleanDisplayValue(value)
    .split(/\s+-\s+/)[0]
    .replace(/\b(the\s+)?(estate\s+of|est\s+of)\b\s*/gi, "")
    .replace(/\b(est|estate)\b\.?$/i, "")
    .replace(/[^\p{L}\p{N},'\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function estateFileFromPersonName(person) {
  const key = estateFileNameKey(person);
  if (estateFileNameOverrides.has(key)) return estateFileNameOverrides.get(key);
  if (!person || /lead prospect|needs review|current estate/i.test(person)) return "Estate file";
  return `Estate of ${person}`;
}

function estateFileDisplayLabel(...candidates) {
  const ownerEstateLabel = candidates
    .map((candidate) => cleanDisplayValue(candidate).trim())
    .find((candidate) => /\best\s+of\b/i.test(candidate) && !/^(?:the\s+)?(?:estate\s+of|est\s+of)\b/i.test(candidate) && !isPlaceholderLeadName(candidate));
  if (ownerEstateLabel) return estateFileFromPersonName(leadNameInitialLabel(ownerEstateLabel));

  const existingEstateLabel = candidates
    .map((candidate) => cleanDisplayValue(candidate).trim())
    .find((candidate) => /^(?:the\s+)?(?:estate\s+of|est\s+of)\b/i.test(candidate) && !isPlaceholderLeadName(candidate));
  if (existingEstateLabel) {
    const normalized = existingEstateLabel
      .split(/\s+-\s+/)[0]
      .replace(/^(?:the\s+)?est\s+of\b/i, "Estate of")
      .replace(/\s+/g, " ")
      .trim();
    const override = estateFileNameOverrides.get(estateFileNameKey(normalized));
    return override || normalized;
  }

  const person = leadNameInitialLabel(...candidates);
  return estateFileFromPersonName(person);
}

function displayStatus(value, fallback = "Needs review") {
  if (!value) return fallback;
  const raw = String(value);
  const key = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const operatorLabels = {
    configured_batch: "Approved Batch",
    default_review_seeds: "Review Seeds",
    dry_run: "Prep only",
    human_review_required: "Team review",
    internal_draft: "Review Draft",
    manual_or_browser_extraction_required: "Needs source review",
    manual_review_required: "Needs manual review",
    no_enrichment_run: "Contact research not run",
    not_configured: "Needs setup",
    ready_for_controlled_validation: "Ready for approval",
    source_evidence_required: "Source evidence needed",
    source_health_only: "Source availability checked",
  };
  if (operatorLabels[key]) return operatorLabels[key];
  return raw.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCountyName(value, fallback = "County needs review") {
  const raw = cleanDisplayValue(value || fallback).trim();
  if (!raw) return fallback;
  if (/needs review|missing|blocked|unknown/i.test(raw)) {
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }
  const normalized = raw
    .replace(/_/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return titleCasePhrase(normalized)
    .replace(/\bMiami Dade\b/g, "Miami-Dade")
    .replace(/\bCounty,\s*Fl\b/g, "County, FL")
    .replace(/\bCounty\s+Fl\b/g, "County, FL");
}

function operatorPlainText(value) {
  return clientFacingCopy(cleanDisplayValue(value)
    .replace(/\bmanual_or_browser_extraction_required\b/gi, "Needs source review")
    .replace(/\bmanual_review_required\b/gi, "Needs manual review")
    .replace(/\bNO_ENRICHMENT_RUN\b/g, "Contact research has not run")
    .replace(/\bSOURCE_HEALTH_ONLY\b/g, "Source availability checked")
    .replace(/\bHUMAN_REVIEW_REQUIRED\b/g, "Team review required")
    .replace(/\bSOURCE_EVIDENCE_REQUIRED\b/g, "Source evidence needed")
    .replace(/\bMISSING_([A-Z0-9_]+)\b/g, (_match, label) => `Missing ${displayStatus(label)}`)
    .replace(/\bsource refs?\b/gi, "source notes")
    .replace(/\bcontrolled-write\b/gi, "approval")
    .replace(/\braw public-source shell\b/gi, "public-record review packet")
    .replace(new RegExp("\\b" + "place" + "holder-only\\b", "gi"), "review-only")
    .replace(/\bInternal Draft\b/g, "Review Draft"));
}

function clientFacingCopy(value) {
  return String(value || "")
    .replace(new RegExp("\\b" + "Handoff" + " Package\\b", "g"), "Doc Prep")
    .replace(new RegExp("\\b" + "handoff" + " package\\b", "gi"), "Doc Prep")
    .replace(new RegExp("\\b" + "Source" + " Files\\b", "g"), "Supporting Documents")
    .replace(new RegExp("\\b" + "source" + " files\\b", "gi"), "supporting documents")
    .replace(new RegExp("\\b" + "Source" + " File\\b", "g"), "Supporting Document")
    .replace(new RegExp("\\b" + "source" + " file\\b", "gi"), "supporting document")
    .replace(new RegExp("\\b" + "Operator" + " shell loaded\\b", "gi"), "Workspace opened")
    .replace(new RegExp("\\b" + "Operator" + " review required\\b", "gi"), "Team review required")
    .replace(new RegExp("\\b" + "Operator" + " review\\b", "gi"), "Team review")
    .replace(/\boperator review\b/gi, "team review")
    .replace(/\bOperator approval\b/gi, "Approval")
    .replace(/\boperator approval\b/gi, "approval")
    .replace(/\bOperator-approved\b/gi, "Approved")
    .replace(/\boperator-approved\b/gi, "approved")
    .replace(/\bOperator-facing\b/gi, "Office-facing")
    .replace(/\boperator-facing\b/gi, "office-facing")
    .replace(/\bOperator checks\b/gi, "Review checks")
    .replace(/\bOperator notes\b/gi, "Review notes")
    .replace(/\bOperator note\b/gi, "Review note")
    .replace(/\boperator notes\b/gi, "review notes")
    .replace(/\boperator note\b/gi, "review note")
    .replace(new RegExp("\\b" + "op" + "erator" + "@heirright\\.com\\b", "gi"), "team@heirright.com")
    .replace(/\boperator\b/g, "team")
    .replace(/\bOperator\b/g, "Team");
}

function clientFacingEvent(event = {}) {
  return {
    ...event,
    title: clientFacingCopy(event.title),
    copy: clientFacingCopy(event.copy)
  };
}

function currentUserDisplayName() {
  const name = cleanDisplayValue(state.session?.user?.name || state.session?.name || "");
  if (name && !/needs review|unknown/i.test(name)) return name;
  const email = cleanDisplayValue(state.session?.user?.email || state.session?.email || "");
  if (email && email.includes("@")) return titleCasePhrase(email.split("@")[0].replace(/[._-]+/g, " "));
  return "User";
}

function currentUserFirstName() {
  const displayName = currentUserDisplayName().trim();
  return displayName.split(/\s+/)[0] || "there";
}

function formatSourceFactValue(value, fallback = "Needs review") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.map((item) => formatSourceFactValue(item, "")).filter(Boolean).join("; ") || fallback;
  }
  if (typeof value === "object") {
    const skippedKeys = /^(sourceUrl|rawId|finalUrl|url|confirmedSourceFacts|confidence|approvalMarker|seedBatchId|seedSourceLabel|sourceOwner|clientAppName)$/i;
    const parts = Object.entries(value)
      .filter(([key]) => !skippedKeys.test(key))
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${displayStatus(key)}: ${/county/i.test(key) ? formatCountyName(item, "") : formatSourceFactValue(item, "")}`)
      .filter((item) => !item.endsWith(": "));
    return parts.join("; ") || fallback;
  }
  const text = operatorPlainText(value);
  if (/^miami[-_\s]dade(?:\s+county)?(?:,\s*fl)?$/i.test(text)) return formatCountyName(text, fallback);
  if (/^https?:\/\//i.test(text)) return "Source link recorded";
  return text;
}

function operatorDocumentFacts(facts = []) {
  const blockedFactTypes = /^(intake_seed|source_search_url|source_governance_catalog)$/i;
  return facts.filter((fact) => {
    if (blockedFactTypes.test(String(fact.factType ?? ""))) return false;
    const rendered = formatSourceFactValue(fact.value, "");
    if (!rendered || rendered === "Needs review") return false;
    return !/ConfirmedSourceFacts|SourceUrl|RawId|SeedBatch|ApprovalMarker|clientAppName/i.test(rendered);
  });
}

function formatMoney(value, currency = "USD") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Needs review";
  return `${currency} ${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function allReviewTasks(dossier) {
  if (!dossier) return [];
  return [
    ...(dossier.operatorQueue?.items ?? []),
    ...(dossier.taxHistory?.reviewTasks ?? []),
    ...(dossier.deedHistory?.reviewTasks ?? []),
    ...(dossier.probateDocket?.reviewTasks ?? []),
    ...(dossier.marriageDeathIndicators?.reviewTasks ?? []),
    ...(dossier.familyTree?.reviewTasks ?? []),
    ...(dossier.sourceGovernance?.reviewTasks ?? [])
  ];
}

function taskCount(dossier) {
  return allReviewTasks(dossier).length;
}

function decisionCopy(dossier) {
  if (!dossier) {
    return { label: "Waiting", tone: "neutral", next: "Load the latest lead packet." };
  }
  if (dossier.workflow?.status === "stop") {
    return {
      label: "Do not contact yet",
      tone: "blocked",
      next: dossier.summary?.nextBestAction ?? "Move on unless the HeirRight review team approves this lead."
    };
  }
  if (dossier.operatorQueue?.state === "manual_review" || dossier.workflow?.status === "review_required") {
    return {
      label: "Needs review",
      tone: "review",
      next: dossier.summary?.nextBestAction ?? "Review the missing items before outreach."
    };
  }
  return {
    label: "Ready for review",
    tone: "ready",
    next: "Review the completed lead packet before outreach."
  };
}

function qualificationDecision(dossier = state.dossier) {
  return dossier?.qualificationDecision ?? state.dailyRun?.leads?.[0]?.qualificationDecision ?? null;
}

function qualificationReview() {
  return state.qualificationReview ?? state.dailyRun?.qualificationReview ?? null;
}

function qualificationTone(decision) {
  if (!decision) return "neutral";
  if (decision.status === "qualified") return "ready";
  if (decision.status === "disqualified") return "blocked";
  return "review";
}

function qualificationLabel(decision) {
  if (!decision) return "No qualification packet";
  if (decision.status === "qualified") return "Qualified";
  if (decision.status === "disqualified") return "Disqualified";
  return "Review";
}

function qualificationScoreText(decision) {
  if (!decision) return "Needs review";
  return `${decision.coverageScore} / ${decision.requiredCoverageScore}`;
}

function rowTone(row) {
  if (row.status === "archived") return "neutral";
  if (row.status === "blocked") return "blocked";
  if (row.score >= 80 && row.missing.length <= 2) return "ready";
  return "review";
}

function buildMissingSections(dossier) {
  const sections = [
    {
      id: "tax",
      label: "Add tax history",
      short: "Tax history",
      type: "tax",
      source: "Tax Collector",
      copy: "Capture unpaid years, amount due, receipt status, and who paid the taxes.",
      tasks: dossier.taxHistory?.reviewTasks ?? []
    },
    {
      id: "heirs",
      label: "Confirm heirs",
      short: "Heirs",
      type: "heirs",
      source: "Probate and family records",
      copy: "Confirm heirs, family-tree questions, marriage/death facts, and contact confidence.",
      tasks: [
        ...(dossier.probateDocket?.reviewTasks ?? []).filter((task) => /heir|affidavit/i.test(`${task.title} ${task.reason}`)),
        ...(dossier.marriageDeathIndicators?.reviewTasks ?? []),
        ...(dossier.familyTree?.reviewTasks ?? [])
      ]
    },
    {
      id: "probate",
      label: "Check probate status",
      short: "Probate",
      type: "probate",
      source: "Clerk and probate docket",
      copy: "Confirm case number, docket status, affidavit availability, and document request needs.",
      tasks: dossier.probateDocket?.reviewTasks ?? []
    },
    {
      id: "phones",
      label: "Import IDI contacts",
      short: "IDI contacts",
      type: "phones",
      source: "IDI Core expanded asset search",
      copy: "Run the one-time asset search, import relatives and associates, then accept reviewed phone/email contacts.",
      tasks: dossier.sourceGovernance?.reviewTasks ?? []
    },
    {
      id: "podio",
      label: "Prepare CRM review",
      short: "CRM review",
      type: "podio",
      source: "CRM prep",
      copy: "Prepare the Doc Prep package, missing setup list, approval steps, and readback checks.",
      tasks: (dossier.crm?.payload?.podioReadiness?.blockers ?? []).map((blocker) => ({ title: "Podio access", nextAction: blocker }))
    }
  ];
  return sections.filter((section) => {
    if (state.filled.has(section.id)) return false;
    if (section.id === "podio") return true;
    return section.tasks.length > 0;
  });
}

function freshBatchRowFromRun(run, index) {
  const dossier = run.dossier ?? {};
  const decision = decisionCopy(dossier);
  const qualification = qualificationDecision(dossier);
  const qTone = qualificationTone(qualification);
  const missing = buildMissingSections(dossier);
  const facts = run.facts?.length ?? 0;
  const sourceFactCount = run.seed?.confirmedSourceFacts?.length || facts;
  const baseScore = qualification?.coverageScore ?? Math.max(28, Math.min(94, facts * 3 + Math.max(0, 72 - taskCount(dossier) * 4)));
  const address = claimValue(dossier.property?.address, run.seed?.propertyAddress ?? "Address needs review");
  const owner = claimValue(dossier.property?.ownerName, run.seed?.ownerName ?? "Owner needs review");
  const sourceEstate = claimValue(dossier.property?.estateName, dossier.summary?.displayName ?? `Live lead ${index + 1}`);
  const estate = estateFileDisplayLabel(sourceEstate, owner, dossier.summary?.displayName);
  const leadName = estate;
  const caseNumber = claimValue(dossier.property?.caseNumber, dossier.summary?.caseNumber ?? "Internal report");
  const county = claimValue(dossier.property?.county, run.seed?.county ?? "miami-dade");
  const parcel = claimValue(dossier.property?.parcelId, run.seed?.parcelId ?? "Folio needs review");
  const contactGate = contactEnrichmentGate(dossier);

  return {
    id: `live-${run.runId}`,
    kind: "Live lead",
    sourceKind: "fresh-batch",
    title: estate,
    file: caseNumber,
    leadName,
    address,
    county,
    parcel,
    owner,
    score: baseScore,
    evidence: Math.min(sourceFactCount, 9),
    evidenceTotal: 9,
    status: contactGate?.status ?? (qTone === "neutral" ? decision.tone : qTone),
    next: contactGate?.next ?? missing[0]?.label ?? decision.next,
    classification: contactGate?.classification,
    missing,
    search: `${estate} ${owner} ${leadName} ${address} ${caseNumber} ${county} ${parcel} ${decision.label} ${qualification?.label ?? ""} ${(qualification?.reasonCodes ?? []).join(" ")} ${missing.map((item) => item.label).join(" ")}`,
    leadType: "probate",
    dossier,
    data: run
  };
}

function buildFreshBatchRows(batch) {
  const leadRuns = Array.isArray(batch?.leadRuns) ? batch.leadRuns : [];
  const seenEstates = new Set();
  return leadRuns
    .map((run, index) => freshBatchRowFromRun(run, index))
    .filter((row) => {
      const parcel = normalizeLookupText(row.parcel || "");
      const address = normalizeLookupText(row.address || "");
      const identity = parcel && !/needs review/i.test(row.parcel || "")
        ? `parcel:${parcel}`
        : `address:${address}`;
      if (seenEstates.has(identity)) return false;
      seenEstates.add(identity);
      return true;
    })
    .map((row) => ({ ...row, tone: rowTone(row) }));
}

function crmProviderLabel(provider = "podio") {
  return {
    podio: "Podio",
    "google-sheets": "Google Sheets",
    csv: "CSV",
    "file-upload": "Uploaded PDF/CSV"
  }[provider] ?? displayStatus(provider, "CRM");
}

const demoEstateLeadMeta = {
  "demo-estate-001": {
    score: 72,
    evidence: 6,
    status: "review",
    classification: "Tax receipt needed",
    next: "Capture Tax Collector receipt",
    dealStatus: "pre-discovery",
    facts: [
      { factType: "date_of_passing", value: "2021-08-14" },
      { factType: "last_sale_date", value: "2014-03-06" }
    ]
  },
  "demo-estate-002": {
    score: 58,
    evidence: 5,
    status: "review",
    classification: "Deed review",
    next: "Attach deed and OR book/page",
    dealStatus: "pre-discovery",
    facts: [
      { factType: "date_of_passing", value: "2020-11-02" },
      { factType: "last_sale_date", value: "2012-09-18" }
    ]
  },
  "demo-estate-003": {
    score: 86,
    evidence: 8,
    status: "review",
    classification: "Discovery reviewed",
    next: "Review heirs before outreach",
    dealStatus: "post-discovery",
    facts: [
      { factType: "date_of_passing", value: "2019-05-27" },
      { factType: "last_sale_date", value: "2006-01-20" }
    ]
  },
  "demo-estate-004": {
    score: 80,
    evidence: 7,
    status: "review",
    classification: "Closing prep ready",
    next: "Fill closing template fields",
    dealStatus: "warm",
    facts: [
      { factType: "date_of_passing", value: "2022-02-09" },
      { factType: "last_sale_date", value: "2010-10-15" }
    ]
  },
  "demo-estate-005": {
    score: 41,
    evidence: 4,
    status: "blocked",
    classification: "Recent sale review",
    next: "Review sale date before paid sources",
    dealStatus: "cold",
    facts: [
      { factType: "date_of_passing", value: "2023-01-11" },
      { factType: "last_sale_date", value: "2025-02-12" }
    ]
  },
  "demo-estate-006": {
    score: 67,
    evidence: 6,
    status: "review",
    classification: "Probate docket needed",
    next: "Check probate and family records",
    dealStatus: "pre-discovery",
    facts: [
      { factType: "date_of_passing", value: "2018-07-31" },
      { factType: "last_sale_date", value: "2001-04-03" }
    ]
  }
};

function clientDefaultEstateImports() {
  return csvFileImportItems(clientDefaultEstatesCsv, clientDefaultEstatesFileName);
}

function mergeClientDefaultEstateImports(imports = []) {
  const current = Array.isArray(imports) ? imports.map(normalizeCrmImport) : [];
  const sourceKey = (item) => String(item.provider || "") + ":" + String(item.sourceRecordId || "");
  const existingSources = new Set(current.map(sourceKey));
  const missing = clientDefaultEstateImports().filter((item) => !existingSources.has(sourceKey(item)));
  return missing.length ? [...current, ...missing] : current;
}

function initialCrmImports() {
  return clientDefaultEstateImports();
}

function isDemoEstateImport(item = {}) {
  return /^demo-estate-\d+$/i.test(String(item?.id || ""));
}

function demoEstateMetaFor(rowOrImport = {}) {
  return demoEstateLeadMeta[String(rowOrImport?.id || "")] || {};
}

const legacyPlaceholderEstatePattern = /\b(?:sample|fixture|fictional|non[-\s]?deliverable|test\s+only|test\s+record|demo\s+estate)\b/i;
const legacyPlaceholderEstateIds = /^demo-estate-\d+$/i;
const placeholderCleanupAgeMs = 3 * 24 * 60 * 60 * 1000;

function isLegacyPlaceholderEstateImport(item = {}) {
  const values = [item?.id, item?.estateName, item?.ownerName, item?.propertyAddress, item?.sourceRecordId, item?.notes]
    .map((value) => String(value || ""));
  return legacyPlaceholderEstateIds.test(values[0]) || values.some((value) => legacyPlaceholderEstatePattern.test(value));
}

function legacyPlaceholderEstateImportsOlderThan(referenceAt = Date.now()) {
  const cutoff = referenceAt - placeholderCleanupAgeMs;
  return state.crmImports
    .map(normalizeCrmImport)
    .filter((item) => !item.deletedAt && isLegacyPlaceholderEstateImport(item))
    .filter((item) => Number.isFinite(Date.parse(item.importedAt || "")) && Date.parse(item.importedAt) < cutoff);
}

function syncLegacyPlaceholderCleanupControl() {
  const button = document.getElementById("legacyPlaceholderCleanup");
  if (!button) return;
  const count = legacyPlaceholderEstateImportsOlderThan().length;
  button.hidden = count === 0;
  button.textContent = `Remove ${count} placeholder estate${count === 1 ? "" : "s"} older than 3 days`;
}
function generatedCrmEstateId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `crm-${uuid}`
    : `crm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function normalizeCrmImport(input = {}) {
  const provider = ["podio", "google-sheets", "csv", "file-upload"].includes(input.provider) ? input.provider : "podio";
  const fileUpload = provider === "file-upload";
  const estateName = String(input.estateName || input.ownerName || (fileUpload ? "" : "Imported estate")).trim().slice(0, 120);
  const propertyAddress = String(input.propertyAddress || (fileUpload ? "" : "Address needs review")).trim().slice(0, 180);
  const ownerName = String(input.ownerName || (fileUpload ? "" : estateName)).trim().slice(0, 120);
  const county = String(input.county || (fileUpload ? "" : "miami-dade")).trim().slice(0, 80);
  const parcelId = String(input.parcelId || (fileUpload ? "" : "Folio needs review")).trim().slice(0, 80);
  const missingFields = Array.isArray(input.missingFields)
    ? Array.from(new Set(input.missingFields.map((field) => String(field || "").trim()).filter(Boolean))).slice(0, 12)
    : [];
  const sourceRecordId = String(input.sourceRecordId || "").trim().slice(0, 120);
  const exactEstateId = String(input.id || (sourceRecordId ? `crm:${provider}:${sourceRecordId}` : "")).trim().slice(0, 240);
  return {
    id: exactEstateId || generatedCrmEstateId(),
    provider,
    estateName,
    propertyAddress,
    ownerName,
    county,
    parcelId,
    sourceRecordId,
    sourceUrl: String(input.sourceUrl || "").trim().slice(0, 240),
    sourceHash: String(input.sourceHash || "").trim().slice(0, 128),
    sourceFileName: String(input.sourceFileName || "").trim().slice(0, 180),
    sourceMethod: String(input.sourceMethod || "").trim().slice(0, 80),
    sourceModel: String(input.sourceModel || "").trim().slice(0, 180),
    missingFields,
    notes: String(input.notes || "").trim().slice(0, 800),
    importedAt: input.importedAt || isoNow(),
    importedBy: input.importedBy || currentActorEmail(),
    archivedAt: input.archivedAt || "",
    deletedAt: input.deletedAt || ""
  };
}

function canonicalCrmImportStateText(value = "[]") {
  const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
  const normalized = Array.isArray(parsed) ? parsed.map(normalizeCrmImport) : [];
  return JSON.stringify(normalized);
}

function minimalImportedDossier(imported) {
  const provider = crmProviderLabel(imported.provider);
  const fileUpload = imported.provider === "file-upload";
  const sourceLabel = imported.sourceFileName || provider;
  return {
    generatedAt: imported.importedAt,
    workflow: { status: "review_required" },
    summary: {
      estateName: imported.estateName,
      displayName: imported.estateName,
      caseNumber: imported.sourceRecordId || "Source record",
      nextBestAction: "Begin Estate Discovery first; move to Closing Prep after review."
    },
    property: {
      address: { value: imported.propertyAddress },
      ownerName: { value: imported.ownerName },
      estateName: { value: imported.estateName },
      county: { value: imported.county },
      parcelId: { value: imported.parcelId },
      caseNumber: { value: imported.sourceRecordId || "Source record" }
    },
    completedLeadReport: {
      generatedAt: imported.importedAt,
      missingData: ["Source evidence", "Heir/contact review", "Offer math", ...(fileUpload ? [] : ["Source-system readback"])],
      reviewGate: { externalUseBlocked: true },
      offerMath: {},
      formats: {
        html: pageShellHtml("Imported Estate Review Packet", imported.estateName, `
          <p class="muted">${fileUpload ? `Parsed from ${escapeHtml(sourceLabel)} with ${escapeHtml(imported.sourceModel || "a verified free Nous model")}. Missing facts remain review-required.` : `Imported from ${escapeHtml(provider)} into the shared HeirRight workspace. Source evidence, approval, and source-system confirmation are still required.`}</p>
          <table>
            <tr><th>Estate</th><td>${escapeHtml(imported.estateName)}</td></tr>
            <tr><th>Owner</th><td>${escapeHtml(imported.ownerName)}</td></tr>
            <tr><th>Property</th><td>${escapeHtml(imported.propertyAddress)}</td></tr>
            <tr><th>County</th><td>${escapeHtml(formatCountyName(imported.county))}</td></tr>
            <tr><th>${fileUpload ? "Source file" : "Imported source"}</th><td>${escapeHtml(sourceLabel)}${imported.sourceRecordId ? ` - ${escapeHtml(imported.sourceRecordId)}` : ""}</td></tr>
          </table>
        `)
      }
    },
    crm: {
      status: fileUpload ? "not_applicable" : "not_configured",
      payload: {
        appModel: {
          workspace: provider,
          app: fileUpload ? "Parsed estate source" : "Imported estate row",
          fields: {
            estate_name: imported.estateName,
            property_address: imported.propertyAddress,
            owner_name: imported.ownerName,
            county: formatCountyName(imported.county),
            source_record_id: imported.sourceRecordId
          },
          pipelineStages: ["Imported", "Estate Discovery", "Closing Prep", "Review"]
        },
        podioReadiness: fileUpload ? {
          classification: "not_applicable",
          missingConfig: [],
          blockers: [],
          readbackChecks: []
        } : {
          classification: "prep_only",
          missingConfig: ["Approved access", "Readback proof"],
          blockers: ["The estate is shared in HeirRight, but its source system still needs an approved connection and confirmation check."],
          readbackChecks: ["Confirm imported estate row", "Confirm linked source facts", "Confirm no duplicate source record"]
        }
      }
    },
    sourceUpload: fileUpload ? {
      fileName: imported.sourceFileName,
      contentHash: imported.sourceHash,
      method: imported.sourceMethod,
      model: imported.sourceModel,
      missingFields: imported.missingFields,
      reviewRequired: true,
    } : null,
    operatorQueue: {
      state: "manual_review",
      items: [{ title: "Imported estate review", nextAction: "Confirm source evidence before outreach or closing docs." }]
    }
  };
}

function crmImportRow(imported) {
  const normalized = normalizeCrmImport(imported);
  const fileUpload = normalized.provider === "file-upload";
  const dossier = minimalImportedDossier(normalized);
  const missing = buildMissingSections(dossier);
  const archived = Boolean(normalized.archivedAt);
  const demoMeta = demoEstateMetaFor(normalized);
  const baseEstateFileName = estateFileDisplayLabel(normalized.estateName, normalized.ownerName);
  const estateFileName = isDemoEstateImport(normalized) ? `Sample: ${baseEstateFileName}` : baseEstateFileName;
  const row = {
    id: normalized.id,
    kind: fileUpload ? "Estate File" : "Imported Estate",
    sourceKind: fileUpload ? "file-import" : "crm-import",
    sourceProvider: normalized.provider,
    sourceRecordId: normalized.sourceRecordId,
    isArchived: archived,
    title: estateFileName,
    file: normalized.sourceFileName || normalized.sourceRecordId || crmProviderLabel(normalized.provider),
    leadName: estateFileName,
    address: normalized.propertyAddress,
    county: normalized.county,
    parcel: normalized.parcelId,
    owner: normalized.ownerName,
    score: demoMeta.score ?? 44,
    evidence: demoMeta.evidence ?? 3,
    evidenceTotal: 9,
    status: archived ? "archived" : (demoMeta.status || "review"),
    next: archived ? "Archived" : (demoMeta.next || "Begin Estate Discovery"),
    classification: archived ? "Archived Import" : (demoMeta.classification || (fileUpload ? "File Import" : "Imported Estate")),
    missing,
    search: `${normalized.estateName} ${normalized.ownerName} ${estateFileName} ${normalized.propertyAddress} ${normalized.parcelId} ${normalized.sourceRecordId} ${normalized.sourceFileName} ${crmProviderLabel(normalized.provider)} imported ${fileUpload ? "pdf csv file" : "crm"} discovery ${demoMeta.classification || ""}`,
    leadType: "probate",
    dossier,
    data: {
      runId: normalized.id,
      seed: {
        estateName: normalized.estateName,
        ownerName: normalized.ownerName,
        propertyAddress: normalized.propertyAddress,
        county: normalized.county,
        parcelId: normalized.parcelId
      },
      facts: Array.isArray(demoMeta.facts) ? demoMeta.facts : []
    }
  };
  return { ...row, tone: rowTone(row) };
}

function crmImportRows() {
  return state.crmImports
    .map(normalizeCrmImport)
    .filter((item) => !item.deletedAt && (state.showArchivedEstates ? item.archivedAt : !item.archivedAt))
    .map(crmImportRow);
}

function migrateUnambiguousLegacyEstateState(rows = state.rows) {
  const migrationTargets = [...new Map(rows
    .filter((row) => row?.id)
    .map((row) => [row.id, row])).values()];
  const knownEstateRows = new Map();
  (state.crmImports || []).forEach((imported) => {
    const row = crmImportRow(imported);
    if (row?.id) knownEstateRows.set(row.id, row);
  });
  migrationTargets.forEach((row) => knownEstateRows.set(row.id, row));
  const fingerprints = new Map();
  [...knownEstateRows.values()].forEach((row) => {
    const legacyKey = legacyEstateStateFingerprint(row);
    if (!legacyKey || legacyKey === row.id) return;
    fingerprints.set(legacyKey, new Set([...(fingerprints.get(legacyKey) || []), row.id]));
  });
  const migrations = migrationTargets
    .map((row) => [legacyEstateStateFingerprint(row), row])
    .filter(([legacyKey, row]) => legacyKey && legacyKey !== row.id && fingerprints.get(legacyKey)?.size === 1);
  if (!migrations.length) return 0;
  let changed = 0;
  const migrateObjectKey = (record, legacyKey, estateId) => {
    if (!record || !Object.prototype.hasOwnProperty.call(record, legacyKey) || Object.prototype.hasOwnProperty.call(record, estateId)) return;
    record[estateId] = record[legacyKey];
    delete record[legacyKey];
    changed += 1;
  };
  migrations.forEach(([legacyKey, row]) => {
    const estateId = row.id;
    [
      state.sourceCaptures,
      state.idiImports,
      state.contactReviews,
      state.dealStatuses,
      state.docPrepEstateState,
      state.closingFieldValues,
      state.closingTemplateSelections,
      state.closingExportState,
    ].forEach((record) => migrateObjectKey(record, legacyKey, estateId));
    Object.keys(state.documentFiles || {}).filter((key) => key.startsWith(`${legacyKey}:`)).forEach((legacyDocumentKey) => {
      const documentKey = `${estateId}:${legacyDocumentKey.slice(legacyKey.length + 1)}`;
      if (Object.prototype.hasOwnProperty.call(state.documentFiles, documentKey)) return;
      state.documentFiles[documentKey] = state.documentFiles[legacyDocumentKey];
      delete state.documentFiles[legacyDocumentKey];
      changed += 1;
    });
  });
  if (!changed) return 0;
  storageSetItem(sourceCaptureStateKey, JSON.stringify(sourceCapturePersistenceSnapshot(state.sourceCaptures)), { sync: false });
  storageSetItem(dealStatusStateKey, JSON.stringify(normalizeDealStatusState(state.dealStatuses)), { sync: false });
  storageSetItem(docPrepEstateStateKey, JSON.stringify(state.docPrepEstateState), { sync: false });
  storageSetItem(documentFilesStateKey, JSON.stringify(documentFilesPersistenceSnapshot(state.documentFiles)), { sync: false });
  storageSetItem(closingFieldValuesStateKey, JSON.stringify(state.closingFieldValues), { sync: false });
  storageSetItem(closingTemplateSelectionsStateKey, JSON.stringify(state.closingTemplateSelections), { sync: false });
  storageSetItem(closingExportStateKey, JSON.stringify(state.closingExportState), { sync: false });
  return changed;
}

function syncLegacyPlaceholderEstateState() {
  state.legacyPlaceholderEstatesActive = state.crmImports.some(isLegacyPlaceholderEstateImport);
  document.documentElement.dataset.legacyPlaceholderEstates = state.legacyPlaceholderEstatesActive ? "true" : "false";
}

function crmImportCounts() {
  const active = state.crmImports.filter((item) => !item.deletedAt && !item.archivedAt).length;
  const archived = state.crmImports.filter((item) => !item.deletedAt && item.archivedAt).length;
  return { active, archived };
}

function rebuildRowsFromCurrentSources() {
  state.rows = state.data && state.dossier ? buildRows(state.data, state.dossier) : crmImportRows();
  migrateUnambiguousLegacyEstateState(state.rows);
  pruneBatchSets();
  syncLegacyPlaceholderEstateState();
  syncLegacyPlaceholderCleanupControl();
}

function syncEstateArchiveToggle() {
  const toggle = document.getElementById("estateArchiveToggle");
  if (!toggle) return;
  const counts = crmImportCounts();
  toggle.hidden = counts.active + counts.archived === 0;
  toggle.textContent = state.showArchivedEstates ? `Active (${counts.active})` : `Archive (${counts.archived})`;
  toggle.setAttribute("aria-pressed", state.showArchivedEstates ? "true" : "false");
  toggle.title = state.showArchivedEstates ? "Show active imported estates" : "Show archived imported estates";
}

function setEstateArchiveMode(showArchived) {
  state.showArchivedEstates = Boolean(showArchived);
  rebuildRowsFromCurrentSources();
  applyFilters();
  syncEstateArchiveToggle();
}

function updateImportedEstateLifecycle(id, action, { confirmDelete = true } = {}) {
  const index = state.crmImports.findIndex((item) => item.id === id);
  if (index < 0) return false;
  const current = normalizeCrmImport(state.crmImports[index]);
  const label = current.estateName || "Imported estate";
  if (action === "delete" && confirmDelete && !window.confirm(`Delete ${label} from the shared HeirRight workspace?`)) return false;
  const next = { ...current };
  if (action === "archive") {
    next.archivedAt = isoNow();
  } else if (action === "restore") {
    next.archivedAt = "";
  } else if (action === "delete") {
    next.deletedAt = isoNow();
  } else {
    return false;
  }
  state.crmImports[index] = next;
  persistCrmImports(`Estate ${action === "delete" ? "deleted" : action === "restore" ? "restored" : "archived"}`);
  state.selectedIds.delete(id);
  state.queueIds.delete(id);
  if (state.selectedId === id && action !== "restore") state.selectedId = null;
  if (action === "restore") state.showArchivedEstates = false;
  rebuildRowsFromCurrentSources();
  if (!state.selectedId || !rowById(state.selectedId)) state.selectedId = state.rows[0]?.id ?? null;
  applyFilters();
  updateFooterLeadContext(selectedRow());
  document.getElementById("topStatus").textContent = action === "delete"
    ? `${label} was removed from the shared estate list.`
    : action === "restore"
    ? `${label} was restored to active estates.`
    : `${label} was moved to Archive.`;
  return true;
}

function buildRows(data, dossier) {
  if (state.freshBatch?.latestRun?.runId === data?.runId && Array.isArray(state.freshBatch?.leadRuns) && state.freshBatch.leadRuns.length) {
    return [...buildFreshBatchRows(state.freshBatch), ...crmImportRows()];
  }

  const decision = decisionCopy(dossier);
  const qualification = qualificationDecision(dossier);
  const qTone = qualificationTone(qualification);
  const missing = buildMissingSections(dossier);
  const facts = data.facts?.length ?? 0;
  const baseScore = qualification?.coverageScore ?? Math.max(28, Math.min(94, facts * 3 + Math.max(0, 72 - taskCount(dossier) * 4)));
  const address = claimValue(dossier.property?.address, data.seed?.propertyAddress ?? "Address needs review");
  const owner = claimValue(dossier.property?.ownerName, data.seed?.ownerName ?? "Owner needs review");
  const sourceEstate = claimValue(dossier.property?.estateName, dossier.summary?.displayName ?? "Current estate");
  const estate = estateFileDisplayLabel(sourceEstate, owner, dossier.summary?.displayName);
  const leadName = estate;
  const caseNumber = claimValue(dossier.property?.caseNumber, dossier.summary?.caseNumber ?? "Case needs review");
  const county = claimValue(dossier.property?.county, data.seed?.county ?? "miami-dade");
  const parcel = claimValue(dossier.property?.parcelId, "Folio needs review");
  const contactGate = contactEnrichmentGate(dossier);
  const rows = [
    {
      id: "estate",
      kind: "Estate",
      title: estate,
      file: caseNumber,
      leadName,
      address,
      county,
      parcel,
      owner,
      score: baseScore,
      evidence: qualification?.coverage?.filter((area) => area.status === "extracted").length ?? Math.min(facts, 9),
      evidenceTotal: qualification?.coverage?.length ?? 9,
      status: contactGate?.status ?? (qTone === "neutral" ? decision.tone : qTone),
      next: contactGate?.next ?? missing[0]?.label ?? decision.next,
      classification: contactGate?.classification,
      missing,
      search: `${estate} ${owner} ${leadName} ${address} ${caseNumber} ${county} ${parcel} ${decision.label} ${qualification?.label ?? ""} ${(qualification?.reasonCodes ?? []).join(" ")} ${missing.map((item) => item.label).join(" ")}`,
      leadType: "probate"
    }
  ];
  return [...rows.map((row) => ({ ...row, tone: rowTone(row) })), ...crmImportRows()];
}

function selectedRow() {
  return state.rows.find((row) => row.id === state.selectedId) ?? state.rows[0] ?? null;
}

function rowById(id) {
  return state.rows.find((row) => row.id === id) ?? null;
}

function pruneBatchSets() {
  const valid = new Set(state.rows.map((row) => row.id));
  [...state.selectedIds].forEach((id) => {
    if (!valid.has(id)) state.selectedIds.delete(id);
  });
  [...state.queueIds].forEach((id) => {
    if (!valid.has(id)) state.queueIds.delete(id);
  });
}

function checkedRows() {
  pruneBatchSets();
  return state.rows.filter((row) => state.selectedIds.has(row.id));
}

function queuedRows() {
  pruneBatchSets();
  return state.rows.filter((row) => state.queueIds.has(row.id));
}

function rowsForBatchAction() {
  const checked = checkedRows();
  if (checked.length) return checked;
  const row = selectedRow();
  return row ? [row] : [];
}

function checkboxHtml(id, label, checked = false, attrs = "") {
  const mark = checked ? "✓" : "";
  return `<label class="select-box ${checked ? "is-checked" : ""}" aria-label="${escapeHtml(label)}"><input type="checkbox" ${attrs} ${checked ? "checked" : ""}><span class="select-checkmark" aria-hidden="true">${mark}</span></label>`;
}

function selectAllCheckboxHtml(rows, scope = "results") {
  const ids = rows.map((row) => row.id);
  const checkedCount = ids.filter((id) => state.selectedIds.has(id)).length;
  const allChecked = ids.length > 0 && checkedCount === ids.length;
  const partial = checkedCount > 0 && !allChecked;
  const mark = allChecked ? "✓" : partial ? "–" : "";
  return `<label class="select-box ${allChecked ? "is-checked" : ""} ${partial ? "is-mixed" : ""}" aria-label="Select all visible leads"><input type="checkbox" data-select-visible="${escapeHtml(scope)}" ${allChecked ? "checked" : ""}><span class="select-checkmark" aria-hidden="true">${mark}</span></label>`;
}

function checkedLeadSummary() {
  const count = checkedRows().length;
  return `${count} Selected`;
}

function visibleRowsForListControls() {
  if (state.activeView === "dossiers") {
    return [...document.querySelectorAll("#dossiersView [data-dossier-row]")]
      .map((rowEl) => rowById(rowEl.dataset.dossierRow))
      .filter(Boolean);
  }
  if (state.activeView === "find-estates") {
    return [...document.querySelectorAll("#resultsBody [data-row-id]")]
      .map((rowEl) => rowById(rowEl.dataset.rowId))
      .filter(Boolean);
  }
  return state.filteredRows.length ? state.filteredRows : state.rows;
}

function syncFloatingListControls() {
  const controls = document.getElementById("floatingListControls");
  if (!controls) return;
  const selected = checkedRows();
  const count = selected.length;
  const visibleRows = visibleRowsForListControls();
  const visibleCount = visibleRows.length;
  const countLabel = document.getElementById("floatingListCount");
  const scopeLabel = document.getElementById("floatingListScope");
  if (countLabel) countLabel.textContent = `${count} Selected`;
  if (scopeLabel) {
    scopeLabel.textContent = state.activeView === "dossiers"
      ? "Dossier list"
      : state.activeView === "find-estates"
        ? `${visibleCount} visible in Estate Search`
        : "Lead list";
  }
  const showFloatingControls = count > 0 && state.activeView === "find-estates";
  controls.dataset.open = showFloatingControls ? "true" : "false";
  controls.setAttribute("aria-hidden", showFloatingControls ? "false" : "true");
  controls.querySelectorAll("[data-list-control]").forEach((button) => {
    const action = button.dataset.listControl;
    const needsSelection = ["queue", "podio", "both", "archive", "delete", "clear"].includes(action);
    const needsVisible = action === "select-visible";
    button.disabled = (needsSelection && count === 0) || (needsVisible && visibleCount === 0);
  });
}

function syncBatchExportControls() {
  const count = checkedRows().length;
  const label = document.getElementById("exportToggleLabel");
  const menu = document.getElementById("exportMenu");
  if (label) label.textContent = count ? `Batch export (${count})` : "Prep export";
  if (menu) menu.dataset.mode = count ? "batch" : "single";
  syncFloatingListControls();
}

function syncSelectionLabels() {
  const selection = document.getElementById("selectionState");
  if (selection) selection.textContent = checkedLeadSummary();
  syncBatchExportControls();
}

function setLeadChecked(id, checked) {
  if (!rowById(id)) return;
  if (checked) state.selectedIds.add(id);
  else state.selectedIds.delete(id);
  syncSelectionLabels();
}

function setVisibleLeadChecked(rows, checked) {
  rows.forEach((row) => {
    if (checked) state.selectedIds.add(row.id);
    else state.selectedIds.delete(row.id);
  });
  syncSelectionLabels();
}

function clearLeadSelection() {
  state.selectedIds.clear();
  document.getElementById("topStatus").textContent = "Lead selection cleared.";
  renderCurrentLoopView();
  if (state.activeView === "find-estates") renderResults();
  syncSelectionLabels();
}

function selectVisibleLeadsFromControls(source = null) {
  const rows = visibleRowsForListControls();
  if (!rows.length) return;
  setVisibleLeadChecked(rows, true);
  document.getElementById("topStatus").textContent = `${rows.length} visible lead${rows.length === 1 ? "" : "s"} selected for list controls.`;
  renderCurrentLoopView();
  if (state.activeView === "find-estates") renderResults();
  source?.blur?.();
}

function runEstateLifecycleForRows(candidateRows, action, source = null, { confirmDelete = true } = {}) {
  const rows = candidateRows.filter((row) => row.sourceKind === "crm-import");
  if (!rows.length) {
    nudgeDeniedAction(
      source,
      action === "delete" ? "Delete blocked" : "Archive blocked",
      "Archive and delete are available only for imported estate records.",
      { pill: true, source: "selected-lead-controls" }
    );
    return;
  }
  if (action === "delete" && confirmDelete) {
    const label = `${rows.length} imported estate${rows.length === 1 ? "" : "s"}`;
    if (!window.confirm(`Delete ${label} from the shared HeirRight workspace?`)) {
      source?.blur?.();
      return;
    }
  }
  let changed = 0;
  rows.forEach((row) => {
    if (updateImportedEstateLifecycle(row.id, action, { confirmDelete: false })) changed += 1;
  });
  document.getElementById("topStatus").textContent = action === "delete"
    ? `${changed} imported estate${changed === 1 ? "" : "s"} deleted from the shared estate list.`
    : `${changed} imported estate${changed === 1 ? "" : "s"} moved to Archive.`;
  addShellEvent(
    action === "delete" ? "Imported estates deleted" : "Imported estates archived",
    `${changed} selected imported estate${changed === 1 ? "" : "s"} ${action === "delete" ? "deleted from the shared list" : "moved to Archive"}.`,
    "review",
    false
  );
  source?.blur?.();
  return changed;
}

function runSelectedEstateLifecycle(action, source = null) {
  return runEstateLifecycleForRows(checkedRows(), action, source);
}

function runFloatingListControl(action, source = null) {
  if (action === "queue") {
    addRowsToQueue(checkedRows(), source);
  } else if (action === "podio" || action === "both") {
    chooseExportRoute(action, source);
  } else if (action === "archive" || action === "delete") {
    runSelectedEstateLifecycle(action, source);
  } else if (action === "select-visible") {
    selectVisibleLeadsFromControls(source);
  } else if (action === "clear") {
    clearLeadSelection();
    source?.blur?.();
  }
  syncFloatingListControls();
}

async function addRowsToQueue(rows = rowsForBatchAction(), source = null) {
  const validRows = rows.filter(Boolean);
  if (!validRows.length) {
    nudgeDeniedAction(
      source,
      "Queue blocked",
      "Select an estate before adding it to the batch queue.",
      { pill: true, source: "selected-lead-controls" }
    );
    return false;
  }
  const stoppedRow = validRows.find((row) => canonicalStopReasonsForRow(row).length > 0);
  if (stoppedRow) {
    const message = canonicalStopBlocker(stoppedRow, "Queue handoff");
    nudgeDeniedAction(source, "Queue blocked by stop rule", `${docPrepEstateLabel(stoppedRow)}: ${message}`, { pill: true, source: "selected-lead-controls" });
    document.getElementById("topStatus").textContent = message;
    addShellEvent("Queue handoff blocked", message, "blocked", true);
    return false;
  }
  try {
    await queueEstatesForDocPrep(validRows);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    nudgeDeniedAction(source, "Queue blocked", message, { pill: true, source: "selected-lead-controls" });
    document.getElementById("topStatus").textContent = message;
    return false;
  }
  const count = validRows.length;
  state.railPreview = {
    title: `${count} lead${count === 1 ? "" : "s"} added to Queue`,
    markdown: "The selected dossier packets are staged for batch export review. No live Podio card, Google Doc, Google Sheet row, email, or SMS was created.",
    updatedAt: Date.now()
  };
  document.getElementById("statusExport").textContent = `export: [${count} QUEUED]`;
  document.getElementById("topStatus").textContent = `${count} lead${count === 1 ? "" : "s"} added to Queue for batch export review.`;
  addShellEvent("Leads added to Queue", `${count} dossier packet${count === 1 ? "" : "s"} staged for batch export review. Live writes remain locked.`, "review", true);
  setActiveShellView("dossiers", "Doc Prep");
  renderShellPanels();
  renderRail();
  if (source) source.blur?.();
  return true;
}

async function queueRowFromButton(button, event = null) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
    event.heirRightQueueHandled = true;
  }
  const rowId = button?.getAttribute?.("data-add-row-to-queue") || button?.dataset?.addRowToQueue;
  const row = rowById(rowId);
  if (!row) {
    nudgeDeniedAction(
      button,
      "Queue blocked",
      "That estate is no longer available in the current results.",
      { pill: true, source: "selected-lead-controls" }
    );
    return false;
  }
  state.selectedId = row.id;
  return addRowsToQueue([row], button);
}

document.addEventListener("click", (event) => {
  if (event.heirRightQueueHandled) return;
  const button = event.target.closest?.("[data-add-row-to-queue]");
  if (!button || !document.body.contains(button)) return;
  void queueRowFromButton(button, event);
});

function wireBatchSelection(root, rowSelector, scope = "results") {
  root.querySelectorAll("[data-row-select]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", (event) => {
      event.stopPropagation();
      setLeadChecked(input.dataset.rowSelect, input.checked);
      renderCurrentLoopView();
      if (state.activeView === "find-estates") renderResults();
    });
  });
  root.querySelectorAll(`[data-select-visible="${scope}"]`).forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", (event) => {
      event.stopPropagation();
      const rows = [...root.querySelectorAll(rowSelector)]
        .map((rowEl) => rowById(rowEl.dataset.rowId || rowEl.dataset.dossierRow))
        .filter(Boolean);
      setVisibleLeadChecked(rows, input.checked);
      renderCurrentLoopView();
      if (state.activeView === "find-estates") renderResults();
    });
  });
}

function dossierForRow(row = selectedRow()) {
  const capturedDossier = row ? sourceCaptureForRow(row)?.dossier : null;
  return capturedDossier ?? row?.dossier ?? state.dossier;
}

function railNameFor(row = selectedRow()) {
  if (!row) return "";
  const saved = state.railNames?.[row.id];
  return saved && saved.trim() ? saved.trim() : row.title;
}

function persistRailNames() {
  storageSetItem(railNamesKey, JSON.stringify(state.railNames ?? {}));
}

function setRailRenaming(isRenaming) {
  const context = document.getElementById("railContext");
  const copy = document.getElementById("railContextCopy");
  if (!context || !copy) return;
  context.classList.toggle("is-renaming", isRenaming);
  copy.setAttribute("aria-label", isRenaming ? "Editing report rail name" : "Rename report rail");
}

function startRailRename() {
  const row = selectedRow();
  const input = document.getElementById("railRenameInput");
  if (!row || !input) return;
  state.railRenaming = true;
  setRailRenaming(true);
  input.value = railNameFor(row);
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function finishRailRename(save = true) {
  if (!state.railRenaming) return;
  const row = selectedRow();
  const input = document.getElementById("railRenameInput");
  state.railRenaming = false;
  setRailRenaming(false);
  if (!row || !input) return;
  if (save) {
    const nextName = input.value.trim().replace(/\s+/g, " ");
    if (nextName && nextName !== row.title) state.railNames[row.id] = nextName;
    else delete state.railNames[row.id];
    persistRailNames();
    addShellEvent("Report rail renamed", "The report rail label was updated locally for this review session.", "review", false);
  }
  syncRailContext(row);
}

function titleCasePhrase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bFl\b/g, "FL")
    .replace(/\bNw\b/g, "NW")
    .replace(/\bNe\b/g, "NE")
    .replace(/\bSw\b/g, "SW")
    .replace(/\bSe\b/g, "SE");
}

function formatPersonName(value) {
  const cleaned = String(value || "")
    .replace(/\s+-\s+.*$/, "")
    .replace(/\b(est of|estate of)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || /needs review|current estate|internal report/i.test(cleaned)) return "Lead File";
  if (cleaned.includes(",")) {
    const [last, ...rest] = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
    const first = rest.join(", ");
    return first ? `${titleCasePhrase(last)}, ${titleCasePhrase(first)}` : titleCasePhrase(last);
  }
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length >= 2) return `${titleCasePhrase(words.slice(1).join(" "))}, ${titleCasePhrase(words[0])}`;
  return titleCasePhrase(cleaned);
}

function cityStateFromAddress(value) {
  const parts = String(value || "").split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts.length >= 2 ? parts[1] : "";
  const stateMatch = (parts[2] || "").match(/\b[A-Z]{2}\b/i);
  return `${titleCasePhrase(city || "City needs review")}, ${(stateMatch?.[0] || "FL").toUpperCase()}`;
}

function leadCrumb(row = selectedRow()) {
  if (!row) return "[No lead selected]";
  const owner = row.owner || claimValue(state.dossier?.property?.ownerName, row.title || "Lead file");
  const address = row.address || claimValue(state.dossier?.property?.address, state.data?.seed?.propertyAddress || "");
  return `[${formatPersonName(owner)}; ${cityStateFromAddress(address)}]`;
}

function updateFooterLeadContext(row = selectedRow()) {
  const crumb = leadCrumb(row);
  const statusCrumb = document.getElementById("statusCrumb");
  const statusRun = document.getElementById("statusRun");
  const statusSelected = document.getElementById("statusSelected");
  if (statusCrumb) {
    statusCrumb.textContent = crumb;
    statusCrumb.title = crumb;
  }
  if (statusRun) {
    statusRun.textContent = row ? "packet: [latest]" : "packet: [blocked]";
    statusRun.title = row ? `Latest packet for ${crumb}` : "No lead packet loaded";
  }
  if (statusSelected) {
    statusSelected.textContent = row ? "selected: [current]" : "selected: [none]";
    statusSelected.title = row ? `Selected lead ${crumb}` : "No selected lead";
  }
}

function applyTheme(theme, persist = true) {
  const mode = ["light", "cream", "dark", "system"].includes(theme) ? theme : "system";
  const runtimeMode = mode === "light" ? "cream" : mode;
  const runtimeTheme = setRuntimeTheme(runtimeMode, { persist });
  const nextTheme = runtimeTheme?.resolved || (mode === "light" ? "cream" : "dark");
  document.body.dataset.theme = nextTheme;
  document.body.dataset.themeMode = runtimeMode;
  document.documentElement.style.colorScheme = nextTheme === "cream" ? "light" : "dark";
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    const option = button.dataset.themeOption === "light" ? "cream" : button.dataset.themeOption;
    const active = option === runtimeMode;
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (persist) storageSetItem(themeKey, runtimeMode);
}

function loadSavedState() {
  const storedTheme = storageGetItem(themeKey);
  applyTheme(["light", "cream", "dark", "system"].includes(storedTheme) ? storedTheme : "dark", false);
  const storedWidth = Number(storageGetItem(railWidthKey));
  if (Number.isFinite(storedWidth)) state.railWidth = clampRailWidth(storedWidth);
  const storedFilterWidth = Number(storageGetItem(filterWidthKey));
  if (Number.isFinite(storedFilterWidth)) state.filterWidth = clampFilterWidth(storedFilterWidth);
  const storedFilterCollapsed = storageGetItem(filterCollapsedKey);
  state.filterCollapsed = storedFilterCollapsed === null ? true : storedFilterCollapsed === "true";
  applyFilterWidth();
  try {
    const storedFilled = JSON.parse(storageGetItem(filledKey) ?? "[]");
    if (Array.isArray(storedFilled)) state.filled = new Set(storedFilled.map(String));
  } catch {
    state.filled = new Set();
  }
  try {
    const storedRailNames = JSON.parse(storageGetItem(railNamesKey) ?? "{}");
    state.railNames = storedRailNames && typeof storedRailNames === "object" && !Array.isArray(storedRailNames)
      ? storedRailNames
      : {};
  } catch {
    state.railNames = {};
  }
  loadDiscoveryState();
  loadDocPrepEstateState();
  loadEstateWorkflowState();
  loadDealStatusLabels();
  loadDealStatuses();
  loadCrmImports();
  loadAssetDiscoveryState();
  loadSearchHistory();
  loadShellSettings();
  loadDripSettings();
  loadBeuiPreferences();
  loadOutreachWorkspace();
  loadAdminAccessDomains();
  state.shellEvents = defaultShellEvents();
  syncShellSettings();
  renderShellPanels();
}

function persistFilled() {
  storageSetItem(filledKey, JSON.stringify([...state.filled]));
}

function loadDiscoveryState() {
  try {
    const stored = JSON.parse(storageGetItem(discoveryStateKey) ?? "{}");
    const completed = Array.isArray(stored.completed) ? stored.completed.map(String) : [];
    const phaseIndex = Number(stored.phaseIndex);
    const validPhaseIds = new Set(Object.values(docPrepFlows).flatMap((flow) => flow.phases.map((phase) => phase.id)));
    state.discoveryCompleted = new Set(completed.filter((phaseId) => validPhaseIds.has(phaseId)));
    const storedFlow = String(stored.activeFlow || "").trim();
    state.activeDocPrepFlow = docPrepFlows[storedFlow] ? storedFlow : state.activeDocPrepFlow;
    const storedIndices = stored.phaseIndices && typeof stored.phaseIndices === "object" && !Array.isArray(stored.phaseIndices) ? stored.phaseIndices : {};
    state.docPrepPhaseIndex = Object.fromEntries(Object.keys(docPrepFlows).map((flowId) => {
      const fallback = flowId === "discovery" && Number.isFinite(phaseIndex) ? phaseIndex : state.docPrepPhaseIndex[flowId] ?? 0;
      const value = Number(storedIndices[flowId] ?? fallback);
      const phases = docPrepFlows[flowId].phases;
      return [flowId, Number.isFinite(value) ? Math.max(0, Math.min(phases.length - 1, value)) : 0];
    }));
    state.discoveryPhaseIndex = state.docPrepPhaseIndex.discovery ?? 0;
    state.discoveryNotes = stored.notes && typeof stored.notes === "object" && !Array.isArray(stored.notes) ? stored.notes : {};
    state.discoveryPreferences = stored.preferences && typeof stored.preferences === "object" && !Array.isArray(stored.preferences) ? stored.preferences : {};
  } catch {
    state.discoveryCompleted = new Set();
    state.discoveryNotes = {};
    state.discoveryPreferences = {};
    state.docPrepPhaseIndex = { discovery: 0, "closing-docs": 0 };
  }
}

function clampDocPrepPhaseIndex(flowId, value = 0) {
  const phases = docPrepPhases(flowId);
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(Math.max(0, phases.length - 1), numeric)) : 0;
}

function normalizeDocPrepPreferences(preferences = {}) {
  return preferences && typeof preferences === "object" && !Array.isArray(preferences) ? { ...preferences } : {};
}

function normalizePacketApproval(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const packetRevision = Number(source.packetRevision);
  if (!Number.isInteger(packetRevision) || packetRevision < 1) return null;
  const approvedAt = String(source.approvedAt || "").trim();
  const approvedBy = cleanDisplayValue(source.approvedBy || "");
  const artifactId = String(source.artifactId || "").trim();
  const estateId = String(source.estateId || "").trim();
  const flow = String(source.flow || "").trim();
  if (!approvedAt || !approvedBy || !artifactId || !estateId || !docPrepFlows[flow]) return null;
  return { packetRevision, approvedAt, approvedBy, artifactId, estateId, flow };
}

function normalizePacketCorrectionNote(value = "") {
  return cleanDisplayValue(String(value || "").replace(/\s+/g, " ").trim()).slice(0, 500);
}

function normalizeGeneratedPacketRecord(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const packetRevision = Number(source.packetRevision);
  return {
    ...source,
    ...(Number.isInteger(packetRevision) && packetRevision > 0 ? { packetRevision } : {}),
    correctionNote: normalizePacketCorrectionNote(source.correctionNote),
    generatedBy: cleanDisplayValue(source.generatedBy || ""),
  };
}

function normalizeDocPrepFlowState(flowId, value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const validPhaseIds = new Set(docPrepPhases(flowId).map((phase) => phase.id));
  const completed = Array.isArray(source.completed)
    ? [...new Set(source.completed.map(String).filter((phaseId) => validPhaseIds.has(phaseId)))]
    : [];
  return {
    phaseIndex: clampDocPrepPhaseIndex(flowId, source.phaseIndex),
    completed,
    notes: normalizeDocPrepPreferences(source.notes),
    preferences: normalizeDocPrepPreferences(source.preferences),
    generatedPackets: Array.isArray(source.generatedPackets)
      ? source.generatedPackets.slice(0, 25).map(normalizeGeneratedPacketRecord)
      : [],
    packetRevision: Math.max(0, Number(source.packetRevision || 0)),
    startedAt: source.startedAt || "",
    updatedAt: source.updatedAt || ""
  };
}

function normalizeDocPrepEstateRecord(record = {}) {
  const source = record && typeof record === "object" && !Array.isArray(record) ? record : {};
  return Object.fromEntries(Object.keys(docPrepFlows).map((flowId) => [flowId, normalizeDocPrepFlowState(flowId, source[flowId])]));
}

function loadDocPrepEstateState() {
  const stored = restoreObjectFromStorage(docPrepEstateStateKey, {});
  state.docPrepEstateState = Object.fromEntries(Object.entries(stored)
    .filter(([key, value]) => key && value && typeof value === "object" && !Array.isArray(value))
    .map(([key, value]) => [key, normalizeDocPrepEstateRecord(value)]));
}

function loadEstateWorkflowState() {
  state.estateWorkflow = normalizeEstateWorkflowState(restoreObjectFromStorage(estateWorkflowStateKey, {}));
  syncLegacyQueueIds();
}

function persistDocPrepEstateState() {
  storageSetItem(docPrepEstateStateKey, JSON.stringify(state.docPrepEstateState));
}

function loadAdminAccessDomains() {
  try {
    const stored = JSON.parse(storageGetItem(adminAccessDomainsKey) ?? "[]");
    state.adminAccessDomains = Array.isArray(stored) && stored.length ? stored.map(String).filter(Boolean) : ["heirright.com", "solvys.io", "texasequitypros.com"];
  } catch {
    state.adminAccessDomains = ["heirright.com", "solvys.io", "texasequitypros.com"];
  }
}

function persistAdminAccessDomains() {
  storageSetItem(adminAccessDomainsKey, JSON.stringify([...new Set(state.adminAccessDomains.map(String).filter(Boolean))]));
}

function docPrepEstateKey(row = selectedRow()) {
  return assetDiscoveryKey(row);
}

function docPrepEstateRecord(row = selectedRow()) {
  if (!row) return normalizeDocPrepEstateRecord();
  const key = docPrepEstateKey(row);
  state.docPrepEstateState[key] = normalizeDocPrepEstateRecord(state.docPrepEstateState[key]);
  return state.docPrepEstateState[key];
}

function docPrepFlowState(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flowKey = docPrepFlows[flowId] ? flowId : "discovery";
  return docPrepEstateRecord(row)[flowKey];
}

function existingDocPrepFlowState(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) return null;
  const record = state.docPrepEstateState[docPrepEstateKey(row)];
  return record?.[docPrepFlows[flowId] ? flowId : "discovery"] || null;
}

function docPrepFlowStarted(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flowState = existingDocPrepFlowState(row, flowId);
  if (!flowState) return false;
  return Boolean(
    flowState.startedAt ||
    flowState.updatedAt ||
    flowState.completed?.length ||
    flowState.generatedPackets?.length
  );
}

function ensureDocPrepStarted(row = selectedRow(), flowId = state.activeDocPrepFlow, { persist = true } = {}) {
  if (!row) return null;
  const flowState = docPrepFlowState(row, flowId);
  if (!flowState.startedAt) flowState.startedAt = isoNow();
  flowState.updatedAt = flowState.updatedAt || flowState.startedAt;
  if (persist) persistDocPrepEstateState();
  return flowState;
}

function docPrepCurrentIndex(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  return clampDocPrepPhaseIndex(flowId, docPrepFlowState(row, flowId).phaseIndex);
}

function setDocPrepPhaseIndex(row = selectedRow(), flowId = state.activeDocPrepFlow, index = 0, { persist = true } = {}) {
  const flowKey = docPrepFlows[flowId] ? flowId : "discovery";
  const flowState = docPrepFlowState(row, flowKey);
  flowState.phaseIndex = clampDocPrepPhaseIndex(flowKey, index);
  flowState.updatedAt = new Date().toISOString();
  state.docPrepPhaseIndex[flowKey] = flowState.phaseIndex;
  state.discoveryPhaseIndex = state.docPrepPhaseIndex.discovery ?? state.discoveryPhaseIndex;
  if (persist) persistDiscoveryState();
}

function docPrepPhaseMarkedComplete(row = selectedRow(), flowId = state.activeDocPrepFlow, phaseId = "") {
  return docPrepFlowState(row, flowId).completed.includes(phaseId);
}

function markDocPrepPhaseComplete(row = selectedRow(), flowId = state.activeDocPrepFlow, phaseId = "", { persist = true } = {}) {
  const flowState = docPrepFlowState(row, flowId);
  if (!flowState.startedAt) flowState.startedAt = isoNow();
  if (!flowState.completed.includes(phaseId)) flowState.completed.push(phaseId);
  flowState.phaseIndex = clampDocPrepPhaseIndex(flowId, docPrepPhases(flowId).findIndex((phase) => phase.id === phaseId));
  flowState.updatedAt = new Date().toISOString();
  state.discoveryCompleted.add(phaseId);
  setDocPrepPhaseIndex(row, flowId, flowState.phaseIndex, { persist: false });
  if (persist) persistDiscoveryState();
}

function docPrepNoteValue(phaseId, row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flowState = docPrepFlowState(row, flowId);
  return flowState.notes[phaseId] ?? state.discoveryNotes[phaseId] ?? "";
}

function setDocPrepNote(phaseId, value, row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flowState = docPrepFlowState(row, flowId);
  flowState.notes[phaseId] = value;
  flowState.updatedAt = new Date().toISOString();
  state.discoveryNotes[phaseId] = value;
  persistDiscoveryState();
}

function setDocPrepPreference(key, checked, row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flowState = docPrepFlowState(row, flowId);
  flowState.preferences[key] = Boolean(checked);
  flowState.updatedAt = new Date().toISOString();
  state.discoveryPreferences[key] = Boolean(checked);
  persistDiscoveryState();
}

function persistDiscoveryState({ syncWorkspace = true } = {}) {
  const docPrepText = JSON.stringify(state.docPrepEstateState);
  const discoveryText = JSON.stringify({
    activeFlow: state.activeDocPrepFlow,
    phaseIndex: state.docPrepPhaseIndex.discovery ?? state.discoveryPhaseIndex,
    phaseIndices: state.docPrepPhaseIndex,
    completed: [...state.discoveryCompleted],
    notes: state.discoveryNotes,
    preferences: state.discoveryPreferences
  });
  if (syncWorkspace) {
    persistDocPrepEstateState();
    storageSetItem(discoveryStateKey, discoveryText);
    return;
  }
  storageSetItem(docPrepEstateStateKey, docPrepText, { sync: false });
  storageSetItem(discoveryStateKey, discoveryText, { sync: false });
}

function defaultShellEvents() {
  return [];
}

function exportSuccessActivityTitle() {
  return "Doc Prep Prepared";
}

function exportSuccessActivityCopy(destination = "your integrated CRM") {
  const target = String(destination || "export queue").trim();
  return `The Doc Prep package is prepared for ${target} review. No live Podio card, Google Doc, Google Sheet row, email, or SMS is created until approval and readback proof are complete.`;
}

function signalWeightLabel(value) {
  const labels = {
    "1": "Very conservative",
    "2": "Conservative",
    "3": "Balanced",
    "4": "Aggressive review",
    "5": "High-volume review"
  };
  return labels[String(value)] ?? labels["3"];
}

function loadShellSettings() {
  try {
    const stored = JSON.parse(storageGetItem(shellSettingsKey) ?? "{}");
    state.shellSettings = { ...state.shellSettings, ...stored };
  } catch {
    state.shellSettings = { ...state.shellSettings };
  }
}

function persistShellSettings(reason = "Settings changed") {
  storageSetItem(shellSettingsKey, JSON.stringify(state.shellSettings));
  addShellEvent(reason, "Lead-quality settings were updated locally. Review-only guardrails remain active.", "review", false);
  syncShellSettings();
}

function loadDripSettings() {
  try {
    const stored = JSON.parse(storageGetItem(dripSettingsKey) ?? "{}");
    state.dripSettings = normalizeDripSettings({ ...state.dripSettings, ...(stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {}) });
    storageSetItem(dripSettingsKey, JSON.stringify(state.dripSettings));
  } catch {
    state.dripSettings = normalizeDripSettings(state.dripSettings);
  }
}

function persistDripSettings(reason = "") {
  state.dripSettings = normalizeDripSettings(state.dripSettings);
  storageSetItem(dripSettingsKey, JSON.stringify(state.dripSettings));
  if (reason) {
    addShellEvent(reason, "Scheduled follow-up controls were saved locally. Live sends and CRM card creation remain locked.", "review", false);
  }
}

function normalizeDripSettings(settings = {}) {
  const smsCap = Math.max(1, Math.min(4, Number(settings.smsCap || 2)));
  return {
    startDelay: settings.startDelay === "next-business" ? "next-business" : "same-day",
    smsCap: String(Number.isFinite(smsCap) ? smsCap : 2),
    reviewOwnerRequired: settings.reviewOwnerRequired === false ? false : true,
    requireCourtPacket: settings.requireCourtPacket === false ? false : true,
    holdNoContact: settings.holdNoContact === false ? false : true,
    workflowTrigger: ["manual", "post-discovery", "queue-stage"].includes(settings.workflowTrigger) ? settings.workflowTrigger : "post-discovery",
    communicationWindow: ["weekday-9-4", "weekday-10-6", "manual-only"].includes(settings.communicationWindow) ? settings.communicationWindow : "weekday-9-4",
    runRule: settings.runRule === "run-multiple" ? "run-multiple" : "run-once",
    senderMode: ["lead-owner", "approval-owner", "static-manager"].includes(settings.senderMode) ? settings.senderMode : "lead-owner",
    operatorNote: String(settings.operatorNote ?? "").slice(0, 500)
  };
}

function loadBeuiPreferences() {
  try {
    const stored = JSON.parse(storageGetItem(beuiPreferencesKey) ?? "{}");
    state.beuiPreferences = {
      compactTables: stored?.compactTables === true,
    };
  } catch {
    state.beuiPreferences = { compactTables: false };
  }
}

function persistBeuiPreferences() {
  storageSetItem(beuiPreferencesKey, JSON.stringify(state.beuiPreferences));
}

function isoNow() {
  return new Date().toISOString();
}

function outreachId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function outreachDelayDays(value) {
  const numeric = Number(String(value || "").replace(/[^\d]/g, ""));
  return [1, 3, 5, 7].includes(numeric) ? numeric : 1;
}

function currentActorEmail() {
  return state.session?.user?.email || state.session?.email || "team@heirright.com";
}

function defaultOutreachWorkspace() {
  const at = isoNow();
  return {
    campaigns: [
      {
        id: "campaign-heir-warm-follow-up",
        name: "Heir warm follow-up",
        description: "Initial reviewed outreach after Discovery is finished.",
        status: "Draft",
        defaultDelayDays: 1,
        stopRules: ["No-contact hold", "Company owner", "Recent sale", "Source blocker", "Finished Discovery required"],
        createdAt: at,
        updatedAt: at,
        archivedAt: ""
      },
      {
        id: "campaign-probate-document-request",
        name: "Probate document request",
        description: "Court packet follow-up once docket status and page count are reviewed.",
        status: "Draft",
        defaultDelayDays: 3,
        stopRules: ["Court packet not reviewed", "No approval owner", "Source blocker"],
        createdAt: at,
        updatedAt: at,
        archivedAt: ""
      }
    ],
    templates: [],
    audit: []
  };
}

const outreachStopRulePresets = Object.freeze([
  {
    id: "standard",
    label: "Standard review holds",
    rules: ["No-contact hold", "Company owner", "Recent sale", "Source blocker", "Finished Discovery required"]
  },
  {
    id: "court-packet",
    label: "Court packet review holds",
    rules: ["Court packet not reviewed", "No approval owner", "Source blocker"]
  },
  {
    id: "strict",
    label: "Strict compliance holds",
    rules: ["Reply", "Call", "No-contact", "Source blocker", "Status change"]
  },
  {
    id: "manual",
    label: "Manual team hold only",
    rules: ["Manual team hold"]
  }
]);

function outreachStopRulePresetId(campaign) {
  const current = Array.isArray(campaign?.stopRules) ? campaign.stopRules.map(String) : [];
  return outreachStopRulePresets.find((preset) => preset.rules.length === current.length && preset.rules.every((rule, index) => rule === current[index]))?.id || "custom";
}

function outreachStopRuleOptionsHtml(campaign) {
  const selectedId = outreachStopRulePresetId(campaign);
  const options = outreachStopRulePresets.map((preset) => `<option value="${escapeHtml(preset.id)}" ${selectedId === preset.id ? "selected" : ""}>${escapeHtml(preset.label)}</option>`);
  if (selectedId === "custom") options.unshift(`<option value="custom" selected>Current campaign rules</option>`);
  return options.join("");
}

function updateSelectedOutreachStopRules(presetId) {
  const campaign = selectedOutreachCampaign();
  const preset = outreachStopRulePresets.find((item) => item.id === presetId);
  if (!campaign || !preset) return;
  state.outreachWorkspace.campaigns = state.outreachWorkspace.campaigns.map((item) => item.id === campaign.id
    ? { ...item, stopRules: [...preset.rules], updatedAt: isoNow() }
    : item);
  persistOutreachWorkspace("Campaign stop rules updated");
  renderDripsView();
}

function normalizeOutreachWorkspace(input = {}) {
  const seed = defaultOutreachWorkspace();
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const campaigns = Array.isArray(source.campaigns) && source.campaigns.length ? source.campaigns : seed.campaigns;
  const templates = Array.isArray(source.templates) ? source.templates : seed.templates;
  const audit = Array.isArray(source.audit) ? source.audit : seed.audit;
  return {
    campaigns: campaigns.map((campaign) => ({
      id: String(campaign.id || outreachId("campaign")),
      name: String(campaign.name || "Untitled campaign"),
      description: String(campaign.description || ""),
      status: outreachStatuses.includes(campaign.status) ? campaign.status : "Draft",
      defaultDelayDays: outreachDelayDays(campaign.defaultDelayDays),
      stopRules: Array.isArray(campaign.stopRules) ? campaign.stopRules.map(String).filter(Boolean) : [],
      createdAt: campaign.createdAt || isoNow(),
      updatedAt: campaign.updatedAt || isoNow(),
      archivedAt: campaign.archivedAt || ""
    })),
    templates: templates.map((template) => normalizeOutreachTemplate(template)).filter(Boolean),
    audit: audit.map((event) => ({
      id: String(event.id || outreachId("audit")),
      templateId: String(event.templateId || ""),
      actorEmail: String(event.actorEmail || "team@heirright.com"),
      action: String(event.action || "Updated"),
      summary: String(event.summary || "Template changed."),
      at: event.at || isoNow()
    })).filter((event) => event.templateId)
  };
}

function normalizeOutreachTemplate(template = {}) {
  if (!template || typeof template !== "object") return null;
  const channel = template.channel === "email" ? "email" : "sms";
  const seed = outreachTemplateSeed(channel);
  const status = outreachStatuses.includes(template.status) ? template.status : "Draft";
  const campaignId = template.campaignId || state.selectedOutreachCampaignId || "campaign-heir-warm-follow-up";
  return {
    id: String(template.id || outreachId("template")),
    campaignId: String(campaignId),
    channel,
    name: String(template.name || seed.name),
    subject: channel === "email" ? String(template.subject || seed.subject || "") : "",
    body: String(template.body || seed.body),
    status,
    delayDays: outreachDelayDays(template.delayDays),
    podioDestination: String(template.podioDestination || "Podio - Outreach Templates"),
    approvalOwner: String(template.approvalOwner || "sam@heirright.com"),
    stopRules: String(template.stopRules || "Stop if no-contact, company owner, recent sale, source blocker, finished discovery missing, or manual team hold is active."),
    variables: Array.isArray(template.variables) ? template.variables.map(String) : extractTemplateVariables(String(template.body || seed.body)),
    customVariables: template.customVariables && typeof template.customVariables === "object" && !Array.isArray(template.customVariables) ? template.customVariables : {},
    lastEditedBy: String(template.lastEditedBy || currentActorEmail()),
    lastEditedAt: template.lastEditedAt || isoNow(),
    approvedBy: String(template.approvedBy || ""),
    approvedAt: template.approvedAt || "",
    podioSyncState: String(template.podioSyncState || "Not synced"),
    podioArtifactId: String(template.podioArtifactId || ""),
    createdAt: template.createdAt || isoNow(),
    updatedAt: template.updatedAt || isoNow(),
    archivedAt: status === "Archived" ? (template.archivedAt || isoNow()) : (template.archivedAt || "")
  };
}

function loadOutreachWorkspace() {
  try {
    const stored = JSON.parse(storageGetItem(outreachWorkspaceKey) || "{}");
    state.outreachWorkspace = normalizeOutreachWorkspace(stored);
  } catch {
    state.outreachWorkspace = normalizeOutreachWorkspace();
  }
  if (!state.selectedOutreachCampaignId || !state.outreachWorkspace.campaigns.some((campaign) => campaign.id === state.selectedOutreachCampaignId)) {
    state.selectedOutreachCampaignId = state.outreachWorkspace.campaigns[0]?.id || null;
  }
  if (!state.selectedOutreachTemplateId || !state.outreachWorkspace.templates.some((template) => template.id === state.selectedOutreachTemplateId)) {
    state.selectedOutreachTemplateId = activeOutreachTemplates()[0]?.id || state.outreachWorkspace.templates[0]?.id || null;
  }
  persistOutreachWorkspace();
}

function persistOutreachWorkspace(reason = "") {
  storageSetItem(outreachWorkspaceKey, JSON.stringify(state.outreachWorkspace));
  if (reason) addShellEvent(reason, "Outreach campaign and template changes were saved through the review workspace. Podio sync still requires approval and connection checks.", "review", false);
}

function selectedOutreachCampaign() {
  return state.outreachWorkspace.campaigns.find((campaign) => campaign.id === state.selectedOutreachCampaignId) ?? state.outreachWorkspace.campaigns[0] ?? null;
}

function campaignById(id) {
  return state.outreachWorkspace.campaigns.find((campaign) => campaign.id === id) ?? null;
}

function selectedOutreachTemplate() {
  return state.outreachWorkspace.templates.find((template) => template.id === state.selectedOutreachTemplateId) ?? activeOutreachTemplates()[0] ?? archivedOutreachTemplates()[0] ?? null;
}

function activeOutreachTemplates(campaignId = state.selectedOutreachCampaignId) {
  return state.outreachWorkspace.templates
    .filter((template) => template.campaignId === campaignId && template.status !== "Archived")
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function archivedOutreachTemplates(campaignId = state.selectedOutreachCampaignId) {
  return state.outreachWorkspace.templates
    .filter((template) => template.campaignId === campaignId && template.status === "Archived")
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

function outreachTemplateAudit(templateId) {
  return state.outreachWorkspace.audit
    .filter((event) => event.templateId === templateId)
    .slice()
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

function addOutreachAudit(templateId, action, summary, actorEmail = currentActorEmail()) {
  state.outreachWorkspace.audit.unshift({
    id: outreachId("audit"),
    templateId,
    actorEmail,
    action,
    summary,
    at: isoNow()
  });
  state.outreachWorkspace.audit = state.outreachWorkspace.audit.slice(0, 80);
}

function splitName(value = "") {
  const cleaned = String(value || "").replace(/\s+/g, " ").trim();
  const parts = cleaned.split(" ").filter(Boolean);
  return {
    first: parts[0] || "there",
    full: cleaned || "Review contact"
  };
}

function firstContactForDossier(dossier = state.dossier) {
  const report = dossier?.completedLeadReport ?? {};
  const contact = report.contactPlaceholders?.[0] ?? dossier?.familyTree?.hypothesis?.value?.nodes?.[0] ?? null;
  const person = splitName(contact?.name || contact?.label || selectedRow()?.title || "Review contact");
  return {
    firstName: person.first,
    fullName: person.full,
    relationship: contact?.relationship || contact?.role || "Relationship needs review"
  };
}

function normalizeVariableName(token = "") {
  return String(token).replace(/[{}]/g, "").trim().replace(/\s+/g, " ");
}

function registryEntry(name, label, value, fallback = "Needs review") {
  const display = cleanDisplayValue(value || fallback);
  const resolved = Boolean(value) && !/needs review|missing|blocked|unknown/i.test(display);
  return { name, token: `{{ ${name} }}`, label, value: display, resolved };
}

function outreachVariableRegistry(row = selectedRow(), dossier = dossierForRow(row) ?? state.dossier) {
  const contact = firstContactForDossier(dossier);
  const report = dossier?.completedLeadReport ?? {};
  const offer = report?.offerMath ?? {};
  const owner = dossier?.owner?.name?.value || dossier?.ownerName || row?.title;
  const county = formatCountyName(dossier?.county || dossier?.property?.county?.value || row?.county || "Miami-Dade");
  const phase = currentDiscoveryPhase()?.label || "Discovery review";
  return [
    registryEntry("contact.first_name", "Contact first name", contact.firstName),
    registryEntry("contact.full_name", "Contact full name", contact.fullName),
    registryEntry("lead.display_name", "Lead display name", row?.title || owner),
    registryEntry("lead.owner_name", "Owner or estate", owner),
    registryEntry("lead.folio", "Folio", row?.folio || dossier?.folio),
    registryEntry("dossier.property_address", "Property address", row?.address || dossier?.property?.address?.value),
    registryEntry("dossier.county", "County", county),
    registryEntry("dossier.current_phase", "Current phase", phase),
    registryEntry("dossier.tax_status", "Tax status", report?.taxStatus?.label || report?.taxStatus?.value || dossier?.taxHistory?.status),
    registryEntry("dossier.probate_status", "Probate status", report?.probateStatus?.label || report?.probateStatus?.value || dossier?.probate?.status),
    registryEntry("dossier.deed_status", "Deed status", report?.titleStatus?.label || report?.titleStatus?.value || dossier?.deed?.status),
    registryEntry("heir.full_name", "Heir name", contact.fullName),
    registryEntry("heir.relationship", "Heir relationship", contact.relationship),
    registryEntry("offer.amount", "Offer amount", offer.offerAmount ? moneyClaimValue(offer.offerAmount) : ""),
    registryEntry("campaign.name", "Campaign name", selectedOutreachCampaign()?.name || "Heir warm follow-up"),
    registryEntry("user.from_name", "Sender name", state.session?.user?.name || "HeirRight"),
    registryEntry("user.from_email", "Sender email", state.session?.user?.email || "sam@heirright.com"),
    registryEntry("user.phone", "Sender phone", "(305) 555-0134"),
    registryEntry("custom.note", "Custom note", "Review note")
  ];
}

function registryByName() {
  return new Map(outreachVariableRegistry().map((entry) => [entry.name, entry]));
}

function extractTemplateVariables(text = "") {
  const found = new Set();
  String(text || "").replace(/{{\s*([^{}]+?)\s*}}/g, (_match, name) => {
    found.add(normalizeVariableName(name));
    return _match;
  });
  return [...found];
}

function unresolvedTemplateVariables(template) {
  const registry = registryByName();
  return extractTemplateVariables(`${template?.subject || ""}\n${template?.body || ""}`)
    .map((name) => registry.get(name) || { name, token: `{{ ${name} }}`, label: name, value: "Missing variable", resolved: false })
    .filter((entry) => !entry.resolved);
}

function renderTemplateText(value = "") {
  const registry = registryByName();
  return String(value || "").replace(/{{\s*([^{}]+?)\s*}}/g, (match, name) => {
    const entry = registry.get(normalizeVariableName(name));
    return entry?.resolved ? entry.value : `[${normalizeVariableName(name)}]`;
  });
}

function templateSummary(template) {
  if (!template) return "No template selected.";
  const campaign = campaignById(template.campaignId);
  return `${template.channel.toUpperCase()} - ${template.status} - ${template.delayDays} day${template.delayDays === 1 ? "" : "s"} - ${campaign?.name || "Campaign needed"}`;
}

function syncShellSettings() {
  const signalWeight = document.getElementById("signalWeight");
  const taxThreshold = document.getElementById("taxThreshold");
  const reasonCodes = document.getElementById("reasonCodes");
  const deedProofRequired = document.getElementById("deedProofRequired");
  const paidSourceApproval = document.getElementById("paidSourceApproval");
  const signalWeightValue = document.getElementById("signalWeightValue");
  if (signalWeight) signalWeight.value = state.shellSettings.signalWeight;
  if (taxThreshold) taxThreshold.value = state.shellSettings.taxThreshold;
  if (reasonCodes) reasonCodes.value = state.shellSettings.reasonCodes;
  if (deedProofRequired) deedProofRequired.checked = Boolean(state.shellSettings.deedProofRequired);
  if (paidSourceApproval) paidSourceApproval.checked = Boolean(state.shellSettings.paidSourceApproval);
  if (signalWeightValue) signalWeightValue.textContent = signalWeightLabel(state.shellSettings.signalWeight);
  syncAllEnhancedSelects();
}

function eventTime(value) {
  const elapsedMs = Math.max(0, Date.now() - Number(value || Date.now()));
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return `${parts.join(" ")} ago`;
}

function renderActivityDrawer() {
  const list = document.getElementById("activityList");
  if (!list) return;
  const adminErrors = state.activeView === "admin" || (state.activeView === "settings" && state.settingsTab === "admin") ? adminErrorItems() : null;
  const events = adminErrors || (state.shellEvents.length ? state.shellEvents : defaultShellEvents()).map(clientFacingEvent);
  list.innerHTML = events.map((event) => `
    <article class="activity-event ${escapeHtml(event.tone ?? "review")}">
      <strong>${escapeHtml(event.title)}</strong>
      <span>${escapeHtml(event.copy)}</span>
      ${adminErrors && !event.ready ? `<button class="btn quick" type="button" data-drawer-file-ticket="${escapeHtml(event.id)}">File Linear</button>` : ""}
      <div class="activity-time">${escapeHtml(adminErrors ? (event.ready ? "Resolved" : "Needs review") : eventTime(event.at ?? Date.now()))}</div>
    </article>
  `).join("");
  list.querySelectorAll("[data-drawer-file-ticket]").forEach((button) => button.addEventListener("click", () => { const item = adminErrorItems().find((entry) => entry.id === button.dataset.drawerFileTicket); if (item) fileAdminLinearTicket({ title: `[HeirRight] ${item.title}`, message: item.copy, severity: item.severity === "blocked" ? "high" : "medium", source: "HeirRight Admin Error Log", actor: currentActorEmail(), context: item.payload }); }));
  const drawer = document.getElementById("agentDrawer");
  if (drawer) {
    const queueOpen = drawer.dataset.drawerMode === "queue" && drawer.dataset.open === "true";
    if (!queueOpen) {
      drawer.dataset.drawerMode = adminErrors ? "admin" : "activity";
      drawer.setAttribute("aria-label", adminErrors ? "Admin error log" : "Workflow updates");
      drawer.querySelector(".drawer-title").textContent = adminErrors ? "Error log" : "Workflow updates";
      drawer.querySelector(".drawer-head .eyebrow").textContent = adminErrors ? "Admin" : "Workflow";
      const close = drawer.querySelector("#closeAgentDrawer");
      if (close) {
        close.setAttribute("aria-label", adminErrors ? "Close error log" : "Close workflow updates");
        close.setAttribute("title", adminErrors ? "Close error log" : "Close workflow updates");
      }
    }
  }
}

function renderShellPanels() {
  const commands = document.getElementById("analyticsCommands");
  const blockers = document.getElementById("analyticsBlockers");
  const events = document.getElementById("analyticsEvents");
  const runtimeRunId = document.getElementById("runtimeRunId");
  const linearSyncState = document.getElementById("linearSyncState");
  if (commands) commands.textContent = String(state.shellCommandCount);
  if (blockers) blockers.textContent = String((state.exportResult?.blockers?.length ?? 0) + 1);
  if (events) events.textContent = String(Math.max(state.shellEvents.length, defaultShellEvents().length));
  if (runtimeRunId) {
    runtimeRunId.textContent = state.data?.runId
    ? "The latest lead packet was checked for missing property, tax, probate, heir, report, and CRM review items."
      : "Waiting for the next lead packet.";
    runtimeRunId.title = state.data?.runId ? String(state.data.runId) : "";
  }
  if (linearSyncState) {
    linearSyncState.textContent = state.activityOpen
      ? "The review trail is open so the team can see recent export and report activity."
      : "Finish review-screen polish, then clear CRM access and readback proof.";
  }
  renderActivityDrawer();
}

function uniqueItems(items) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function operatorBlockerText(value) {
  return String(value || "")
    .replace(/Podio export is blocked until .*field map.*configured\./i, "Podio review is blocked until CRM access, the Leads app, and field mapping are approved.")
    .replace(/Missing Podio export config: /i, "Podio setup still needed before an approved sample card and confirmation readback: ")
    .replace(/Missing Google Workspace config: /i, "Google setup still needed before Docs, Sheets, and confirmation readback: ")
    .replace(/Raw lead count/i, "Raw leads")
    .replace(/Qualified lead count/i, "Qualified leads")
    .replace(/Raw leads (\d+) is below target ([\d-]+)\./i, "Lead list is too small: $1 raw leads loaded, but the 30-day target is $2.")
    .replace(/Qualified leads (\d+) is below target ([\d-]+)\./i, "Ready-lead count is too low: $1 ready leads can be counted, but the 30-day target is $2.")
    .replace(/No production batch seed file was provided; default review seeds do not satisfy contract volume\./i, "Production county seed file is still needed before volume targets can be claimed.")
    .replace(/(\d+) source area\(s\) are still blocked by missing extracted property, tax, deed, probate, or family-tree facts\./i, "$1 county-record checks still need real property, tax, deed, probate, or heir facts before the lead can count.")
    .replace(/Lead bucket is review_required, not qualified\./i, "Selected lead still needs review before it can be counted as ready.")
    .replace(/Workflow status is review_required\./i, "Workflow still needs team review.")
    .replace(/(?:Op)erator queue is manual_review\./i, "Review queue still needs manual review.")
    .replace(/No enrichment\/contact run has been approved or completed\./i, "Contact research has not been approved or completed.")
    .replace(/Report has (\d+) missing section\(s\)\./i, "$1 report sections still need review.")
    .replace(/Live (Google|Podio) readback skipped in dry-run mode\./i, "$1 readback has not run yet.")
    .replace(/Live (Google|Podio) (config|setup) still needed before .*readback: /i, "$1 setup still needed before an approved sample card and confirmation readback: ")
    .replace(/PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877/g, "Podio field map or verified Leads app")
    .replace(/PODIO_ACCESS_TOKEN/g, "Podio access")
    .replace(/PODIO_APP_ID/g, "Podio Leads app")
    .replace(/GOOGLE_WORKSPACE_ACCESS_TOKEN/g, "Google Workspace access")
    .replace(/GOOGLE_TRACKING_SHEET_ID/g, "Google tracking Sheet");
}

function operatorSetupLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/PODIO_FIELD_MAP_JSON/i.test(text)) return "Podio field map";
  if (/PODIO_ACCESS_TOKEN/i.test(text)) return "Podio access";
  if (/PODIO_APP_ID/i.test(text)) return "Podio Leads app";
  if (/GOOGLE|DRIVE|DOCS|SHEETS/i.test(text)) return "Google export destination";
  if (/TOKEN|SECRET|CREDENTIAL/i.test(text)) return "Approved access";
  return displayStatus(text.replace(/[_=]/g, " "));
}

function operatorSetupList(items = []) {
  return uniqueItems(items.map(operatorSetupLabel)).join(", ") || "None recorded";
}

function milestoneBlockerLabel(blocker) {
  if (/lead list|production county seed|raw lead/i.test(blocker)) return "Lead list size";
  if (/ready-lead|qualified|counted as ready|No lead is ready/i.test(blocker)) return "Ready-lead count";
  if (/county-record|property, tax, deed|source record/i.test(blocker)) return "County-record facts";
  if (/CRM|Podio/i.test(blocker)) return "CRM review";
  if (/report section|completed lead/i.test(blocker)) return "Report completion";
  if (/Google|Drive|Docs|Sheet/i.test(blocker)) return "Google export";
  return "Review item";
}

function milestoneBlockers(dossier) {
  const blockers = [];
  const dailyRun = state.dailyRun;
  const dailyMisses = dailyRun?.missedVolumeReasons ?? [];
  if (dailyMisses.length) {
    blockers.push(...dailyMisses.slice(0, 3).map(operatorBlockerText));
  } else {
    blockers.push("Production county seed file is still needed before volume targets can be claimed.");
  }
  const review = qualificationReview();
  if (review?.summary && review.summary.qualified === 0 && !blockers.some((blocker) => /ready-lead count|ready leads can be counted/i.test(blocker))) {
    blockers.push("No lead is ready to count yet. The review packet is keeping every unresolved item visible.");
  }

  const podio = dossier?.crm?.payload?.podioReadiness ?? {};
  if ((podio.missingConfig?.length ?? 0) || (podio.blockers?.length ?? 0)) {
    blockers.push("CRM review is not live yet. We still need CRM access, one approved test record, and a readback check showing the CRM saved it correctly.");
  }

  const reportMissing = dossier?.completedLeadReport?.missingData?.length ?? buildMissingSections(dossier ?? {}).length;
  if (reportMissing > 0) {
    blockers.push(`${reportMissing} report section${reportMissing === 1 ? "" : "s"} still need review before a completed lead claim.`);
  }
  const blockedSourceAreas = dailyRun?.sourceCoverageSummary?.blockedAreaCount ?? 0;
  if (blockedSourceAreas > 0 && !blockers.some((blocker) => /county-record checks|property, tax, deed, probate, or heir facts/i.test(blocker))) {
    blockers.push(`${blockedSourceAreas} county-record checks still need property, tax, deed, probate, or heir facts from the source records.`);
  }

  const googleConnection = connectionByName("Google");
  if (!(googleConnection?.ok && googleConnection?.mode === "live")) {
    blockers.push("Google Workspace export still needs Drive, Docs, and tracking Sheet approval.");
  }
  return uniqueItems(blockers).slice(0, 6);
}

function renderMilestoneBlockers(dossier) {
  const list = document.getElementById("milestoneBlockers");
  if (!list) return;
  list.innerHTML = milestoneBlockers(dossier).map((blocker) => `
    <li><strong>${escapeHtml(milestoneBlockerLabel(blocker))}</strong><span>${escapeHtml(blocker)}</span></li>
  `).join("");
}

function setActivityOpen(open) {
  state.activityOpen = open;
  const drawer = document.getElementById("agentDrawer");
  const toggle = document.getElementById("agentDrawerToggle");
  if (drawer) {
    drawer.dataset.open = open ? "true" : "false";
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
  }
  if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
  renderShellPanels();
}

function addShellEvent(title, copy, tone = "review", openDrawer = true, context = {}) {
  const eventContext = context && typeof context === "object" ? context : {};
  const global = eventContext.global === true;
  const contextRow = eventContext.row && typeof eventContext.row === "object" ? eventContext.row : selectedRow();
  const estateId = global ? "" : String(eventContext.estateId || contextRow?.id || "").trim();
  const actor = clientFacingCopy(eventContext.actor || currentUserDisplayName() || "HeirRight team");
  const source = clientFacingCopy(eventContext.source || (global ? "HeirRight system" : activeViewLabel(state.activeView) || "HeirRight workspace"));
  state.shellEvents = [
    { title: clientFacingCopy(title), copy: clientFacingCopy(copy), tone, at: Date.now(), estateId, actor, source, global },
    ...state.shellEvents
  ].slice(0, 10);
  renderShellPanels();
  if (openDrawer) setActivityOpen(true);
}

function recordActionError(title, copy, source = "ui-action") {
  const item = {
    id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: clientFacingCopy(title),
    copy: clientFacingCopy(copy),
    severity: "blocked",
    ready: false,
    at: Date.now(),
    payload: {
      source,
      category: "ui-action",
      message: copy,
      view: state.activeView
    }
  };
  state.actionErrorLog = [item, ...state.actionErrorLog].slice(0, 8);
  addShellEvent(item.title, item.copy, "blocked", false);
  if (state.activeView === "admin") renderAdminLoopView();
  return item;
}

function nudgeDeniedAction(target, title, copy, options = {}) {
  const control = options.pill
    ? document.getElementById("floatingListControls")
    : target?.closest?.("#floatingListControls") || target || document.getElementById("floatingListControls");
  if (control) {
    control.dataset.denied = "false";
    void control.offsetWidth;
    control.dataset.denied = "true";
    window.setTimeout(() => {
      if (control.dataset.denied === "true") control.dataset.denied = "false";
    }, 360);
  }
  recordActionError(title, copy, options.source || "denied-action");
  target?.blur?.();
}

function activeViewLabel(view = state.activeView) {
  return {
    "find-estates": "Estates",
    dossiers: "Document Prep",
    export: "Export",
    drips: "Outreach",
    dashboard: "Manage Estates",
    queue: "Queue",
    admin: "Admin",
    settings: "Settings",
    "help-demos": "Help & Demos"
  }[view] ?? "Estates";
}

function nucleoIcon(name = "check-circle", size = 19, extraClass = "") {
  const paths = {
    "people-three": '<circle cx="12" cy="7.2" r="2.7"/><circle cx="5.8" cy="9.3" r="2.1"/><circle cx="18.2" cy="9.3" r="2.1"/><path d="M7.1 19.2a4.9 4.9 0 0 1 9.8 0"/><path d="M2.6 18.2a3.8 3.8 0 0 1 5.3-3.5M16.1 14.7a3.8 3.8 0 0 1 5.3 3.5"/>',
    "search-estate": '<path d="m20.5 20.5-4.4-4.4"/><circle cx="10.5" cy="10.5" r="6.2"/><path d="M7.7 12.2V9.4l2.8-2 2.8 2v2.8"/><path d="M6.9 12.2h7.2"/>',
    "open-book": '<path d="M4.5 5.5h5.7c1.1 0 1.8.7 1.8 1.8v11.2c0-1.1-.7-1.8-1.8-1.8H4.5V5.5Z"/><path d="M19.5 5.5h-5.7c-1.1 0-1.8.7-1.8 1.8v11.2c0-1.1.7-1.8 1.8-1.8h5.7V5.5Z"/><path d="M7.4 9h2.3M14.3 9h2.3M7.4 12h2.3M14.3 12h2.3"/>',
    "scheduled-drips": '<path d="M5.2 6.5h9.8a2.3 2.3 0 0 1 2.3 2.3v5.1a2.3 2.3 0 0 1-2.3 2.3H5.2a2.3 2.3 0 0 1-2.3-2.3V8.8a2.3 2.3 0 0 1 2.3-2.3Z"/><path d="m4.2 8.2 5.9 4 5.9-4"/><path d="M17.6 13.8a3 3 0 1 1-3 4.6"/><path d="M17.1 15.7v1.5l1 .6"/>',
    "batch-tray": '<path d="M5.6 5.5h12.8l1.2 8.2v4.2a2.2 2.2 0 0 1-2.2 2.2H6.6a2.2 2.2 0 0 1-2.2-2.2v-4.2l1.2-8.2Z"/><path d="M4.7 13.7h4.5l1.3 2.1h3l1.3-2.1h4.5"/><path d="M8.3 8.7h7.4M8.3 11.1h5.2"/>',
    "admin-shield": '<path d="M12 3.8 18.8 6.3v5.2c0 4.3-2.6 6.9-6.8 8.7-4.2-1.8-6.8-4.4-6.8-8.7V6.3L12 3.8Z"/><path d="m9.1 12.1 2 2 4-4.3"/>',
    fingerprint: '<path d="M8.1 17.5c.7-1.1 1-2.6 1-4.6a2.9 2.9 0 0 1 5.8 0c0 1.3-.1 2.5-.3 3.5"/><path d="M6.1 14.3v-1.4a5.9 5.9 0 1 1 11.8 0c0 .8 0 1.6-.1 2.3"/><path d="M4.1 11.8a8 8 0 0 1 15.8 1.1c0 2.8-.4 5-1.2 6.6"/><path d="M12 12.9c0 3.3-.7 5.7-2.1 7.2"/><path d="M12 4.9a8 8 0 0 1 7.3 4.8M4.7 16.8c.5-1 .7-2.3.7-3.9"/>',
    sliders: '<path d="M4 6h8M16 6h4M4 12h3M11 12h9M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
    gear: '<path d="M9.67 4.14a2.34 2.34 0 0 1 4.66 0 2.34 2.34 0 0 0 3.32 1.91 2.34 2.34 0 0 1 2.33 4.04 2.34 2.34 0 0 0 0 3.82 2.34 2.34 0 0 1-2.33 4.04 2.34 2.34 0 0 0-3.32 1.91 2.34 2.34 0 0 1-4.66 0 2.34 2.34 0 0 0-3.32-1.91 2.34 2.34 0 0 1-2.33-4.04 2.34 2.34 0 0 0 0-3.82 2.34 2.34 0 0 1 2.33-4.04 2.34 2.34 0 0 0 3.32-1.91Z"/><circle cx="12" cy="12" r="3"/>',
    "packet-clock": '<path d="M5.5 4.5h8.2l4.8 4.8v10.2h-13V4.5Z"/><path d="M13.5 4.8v4.7h4.7"/><circle cx="11" cy="14.5" r="3.1"/><path d="M11 12.8v1.9l1.3.8"/>',
    "magnifier-route": '<path d="m20.5 20.5-4.2-4.2"/><circle cx="10.4" cy="10.4" r="6"/><path d="M7.4 8.3h.01M13.5 12.7h.01M7.5 8.4c3.2.1 5.6.8 5.6 2.4 0 1.8-3.4 1.5-4.8 3.1"/>',
    "panel-right": '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/><path d="M15.5 4.5v15"/><path d="m11 9 3 3-3 3"/>',
    eye: '<path d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"/><circle cx="12" cy="12" r="2.7"/>',
    pencil: '<path d="M4.8 16.8 4 20l3.2-.8L18.6 7.8a2.2 2.2 0 0 0-3.1-3.1L4.8 16.8Z"/><path d="m14.2 6 3.8 3.8"/><path d="M9.2 20h10.1"/>',
    flag: '<path d="M6.2 20V5.2"/><path d="M6.2 5.2h9.8l-1.4 3.1L16 11.4H6.2"/><path d="M6.2 15.3h6.5"/>',
    trash: '<path d="M5.2 7h13.6"/><path d="M9.2 7V4.9h5.6V7"/><path d="M7.3 7.1 8 19.2h8l.7-12.1"/><path d="M10.2 10.3v5.7M13.8 10.3v5.7"/>',
    close: '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    caution: '<path d="M12 4.2 20.4 19H3.6L12 4.2Z"/><path d="M12 9.2v4.5M12 16.7h.01"/>',
    "check-circle": '<circle cx="12" cy="12" r="8.4"/><path class="nucleo-check-mark" d="m8.75 12.1 2.35 2.25 4.45-4.65"/>'
  };
  const className = ["nucleo-icon", extraClass].filter(Boolean).join(" ");
  return `<svg class="${className}" data-nucleo-icon="${escapeHtml(name)}" style="--nucleo-size:${Number(size) || 19}px" viewBox="0 0 24 24" fill="none" aria-hidden="true">${paths[name] ?? paths["check-circle"]}</svg>`;
}

function applyNucleoIcons() {
  const navIcons = {
    dashboard: "people-three",
    "find-estates": "search-estate",
    dossiers: "open-book",
    drips: "scheduled-drips",
    queue: "batch-tray",
    admin: "admin-shield",
    settings: "gear",
    "help-demos": "open-book"
  };
  document.querySelectorAll("[data-shell-nav]").forEach((button) => {
    const slot = button.querySelector(".nav-icon");
    if (!slot) return;
    slot.innerHTML = nucleoIcon(navIcons[button.dataset.shellNav] ?? "check-circle", 19);
  });
}

function trackerIcon(type = "check") {
  const icons = {
    check: "check-circle",
    clock: "packet-clock",
    flag: "flag",
    route: "magnifier-route"
  };
  return `<span class="tracker-icon" aria-hidden="true">${nucleoIcon(icons[type] ?? "check-circle", 15)}</span>`;
}

function docPrepFlow(flowId = state.activeDocPrepFlow) {
  return docPrepFlows[flowId] ?? docPrepFlows.discovery;
}

function docPrepPhases(flowId = state.activeDocPrepFlow) {
  return docPrepFlow(flowId).phases;
}

function dealStatusBaseMeta(statusId = "pre-discovery") {
  return dealStatusOptions.find((item) => item.id === statusId) ?? dealStatusOptions[0];
}

function dealStatusLabel(statusId = "pre-discovery") {
  const status = dealStatusBaseMeta(statusId);
  return state.dealStatusLabels?.[status.id] || status.label;
}

function dealStatusMeta(statusId = "pre-discovery") {
  const status = dealStatusBaseMeta(statusId);
  return {
    ...status,
    label: dealStatusLabel(status.id)
  };
}

function dealStatusForRow(row = selectedRow()) {
  if (!row) return "pre-discovery";
  const key = assetDiscoveryKey(row);
  return dealStatusMeta(state.dealStatuses[key]).id;
}

function dealStatusOptionsHtml(selectedStatus = "pre-discovery") {
  return dealStatusOptions.map((status) => `
    <option value="${escapeHtml(status.id)}" ${status.id === selectedStatus ? "selected" : ""}>${escapeHtml(dealStatusLabel(status.id))}</option>
  `).join("");
}

function renameDealStatusLabel(statusId = "pre-discovery", label = "") {
  const base = dealStatusBaseMeta(statusId);
  const nextLabel = String(label || "").replace(/\s+/g, " ").trim().slice(0, 34);
  if (!nextLabel || nextLabel === base.label) delete state.dealStatusLabels[base.id];
  else state.dealStatusLabels[base.id] = nextLabel;
  persistDealStatusLabels();
  const displayLabel = dealStatusLabel(base.id);
  document.getElementById("topStatus").textContent = `${base.label} now displays as ${displayLabel}.`;
  addShellEvent("Deal status renamed", `${base.label} now displays as ${displayLabel}. The workflow route is unchanged.`, "review", false);
}

function setDealStatusForRow(row = selectedRow(), statusId = "pre-discovery", { rerender = true } = {}) {
  if (!row) return;
  const status = dealStatusMeta(statusId);
  state.dealStatuses[assetDiscoveryKey(row)] = status.id;
  persistDealStatuses();
  if (status.flowId === "closing-docs") {
    setActiveDocPrepFlow("closing-docs", { persist: true, rerender: false });
  }
  const routeCopy = status.id === "cold"
    ? "Cold status is ready for the SMS drip outreach pipeline."
    : `${status.label} routes this estate toward ${status.route}.`;
  document.getElementById("topStatus").textContent = `${row.leadName || row.title} updated to ${status.label}. ${routeCopy}`;
  addShellEvent("Deal status updated", `${row.leadName || row.title} moved to ${status.label}. ${routeCopy}`, "review", false, { row, source: "Case Journey" });
  if (rerender) {
    renderCurrentLoopView();
    renderRail();
  }
}

function seedImportedDealStatus(row) {
  if (!row) return;
  const key = assetDiscoveryKey(row);
  if (!state.dealStatuses[key]) state.dealStatuses[key] = "pre-discovery";
}

function setActiveDocPrepFlow(flowId = "discovery", { persist = true, rerender = true } = {}) {
  const nextFlow = docPrepFlows[flowId] ? flowId : "discovery";
  state.activeDocPrepFlow = nextFlow;
  state.selectedDossierDocId = "";
  const phases = docPrepPhases(nextFlow);
  const currentIndex = docPrepCurrentIndex(selectedRow(), nextFlow);
  state.docPrepPhaseIndex[nextFlow] = Number.isFinite(currentIndex)
    ? Math.max(0, Math.min(phases.length - 1, currentIndex))
    : 0;
  state.discoveryPhaseIndex = state.docPrepPhaseIndex.discovery ?? 0;
  if (persist) persistDiscoveryState();
  if (rerender) {
    renderCurrentLoopView();
    renderRail();
  }
}

function currentDiscoveryPhase(flowId = state.activeDocPrepFlow, row = selectedRow()) {
  const phases = docPrepPhases(flowId);
  const index = docPrepCurrentIndex(row, flowId);
  return phases[index] ?? phases[0] ?? discoveryPhases[0];
}

function firstIncompletePhaseIndex(flowId = state.activeDocPrepFlow, row = selectedRow()) {
  const phases = docPrepPhases(flowId);
  const index = phases.findIndex((phase) => !phaseIsComplete(phase.id, row, flowId));
  return index < 0 ? Math.max(0, phases.length - 1) : index;
}

function discoveryProgress(flowId = state.activeDocPrepFlow, row = selectedRow()) {
  const phases = docPrepPhases(flowId);
  const completed = phases.filter((phase) => phaseIsComplete(phase.id, row, flowId)).length;
  const total = phases.length;
  return Math.round((completed / total) * 100);
}

function flowIdForPhaseId(phaseId = "") {
  return Object.values(docPrepFlows).find((flow) => flow.phases.some((phase) => phase.id === phaseId))?.id || state.activeDocPrepFlow;
}

function phaseIsComplete(phaseId = currentDiscoveryPhase().id, row = selectedRow(), flowId = flowIdForPhaseId(phaseId)) {
  const flowKey = docPrepFlows[flowId] ? flowId : flowIdForPhaseId(phaseId);
  if (docPrepPhaseMarkedComplete(row, flowKey, phaseId)) return true;
  return flowKey === "discovery" ? assetPhaseComplete(row, phaseId) : false;
}

function discoveryPreferenceKey(phaseId, index) {
  return `${phaseId}:${index}`;
}

function discoveryPreferenceChecked(phaseId, index, row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const key = discoveryPreferenceKey(phaseId, index);
  const flowState = docPrepFlowState(row, flowId);
  if (Object.prototype.hasOwnProperty.call(flowState.preferences, key)) {
    return Boolean(flowState.preferences[key]);
  }
  if (Object.prototype.hasOwnProperty.call(state.discoveryPreferences, key)) {
    return Boolean(state.discoveryPreferences[key]);
  }
  return index < 2;
}

function dashboardMilestones() {
  const row = selectedRow();
  const rows = state.rows;
  const dossier = dossierForRow(row);
  const missing = row?.missing?.length ?? buildMissingSections(dossier ?? state.dossier ?? {}).length;
  const review = qualificationReview();
  const qualified = review?.summary?.qualified ?? state.dailyRun?.qualifiedLeadCount ?? rows.filter((item) => item.tone === "ready").length;
  const reviewed = review?.summary?.review ?? state.dailyRun?.reviewLeadCount ?? rows.filter((item) => item.tone !== "ready").length;
  const raw = state.freshBatch?.acceptedSeedCount ?? state.dailyRun?.rawLeadCount ?? rows.length;
  const sourceGaps = state.dailyRun?.sourceCoverageSummary?.blockedAreaCount ?? milestoneBlockers(dossier).filter((blocker) => /county-record|source|property, tax, deed|report section/i.test(blocker)).length;
  const openReviews = taskCount(dossier ?? state.dossier ?? {});
  const queued = queuedRows().length;
  return [
    {
      icon: "clock",
      title: "Live lead packet",
      copy: `${raw} live lead${raw === 1 ? "" : "s"} loaded; ${qualified} ready, ${reviewed} still in review.`,
      date: `${qualified}/${Math.max(raw, 1)} ready`
    },
    {
      icon: "route",
      title: "Source gaps to clear",
      copy: `${sourceGaps} county-record check${sourceGaps === 1 ? "" : "s"} still need property, tax, deed, probate, or heir facts.`,
      date: sourceGaps ? "Review" : "Clear"
    },
    {
      icon: "flag",
      title: "Dossier export blockers",
      copy: `${missing} report section${missing === 1 ? "" : "s"}, ${openReviews} review task${openReviews === 1 ? "" : "s"}, ${queued} queued for export.`,
      date: queued ? "Queued" : "Next"
    }
  ];
}

function dashboardSuggestions() {
  return [
    ["Start with owner stop rules", "Move company-owned and recently sold properties out before spending research time."],
    ["Batch missing tax notes", "Filter by tax history and clear receipt, payer, and reassessment notes together."],
    ["Stage Podio after documents", "Use Queue only after the dossier packet has a review owner and readback gate."]
  ];
}

function scheduledDrips() {
  const settings = state.dripSettings;
  const startDelay = settings.startDelay === "next-business" ? "Next business morning" : "Same day after review";
  const smsCap = Math.max(1, Math.min(4, Number(settings.smsCap || 2)));
  return [
    { title: "Heir warm follow-up template", channel: "Email + SMS", cadence: `${startDelay}; Day 1, Day 4, Day 9`, status: "Prepared only", nextRun: "After dossier approval", guardrail: `${smsCap} SMS cap per heir, per week; SMS attachments US/CA/AU only` },
    { title: "Probate document request", channel: "Email", cadence: settings.requireCourtPacket ? "After court packet review" : "After review owner approval", status: "Needs approval", nextRun: "After court packet clears", guardrail: "Court packet must stay review-owned" },
    { title: "No-contact hold", channel: "Internal task", cadence: settings.holdNoContact ? "Until review clears" : "Team override required", status: "Active guardrail", nextRun: "Every queued dossier check", guardrail: "No-contact, company owner, recent sale, and source blocker stops stay active" }
  ];
}

function dripStartDelayLabel(value = state.dripSettings.startDelay) {
  return value === "next-business" ? "Next business morning" : "Same day after review";
}

function dripAutomationJobs() {
  return [
    {
      title: "Discovery dossier check",
      schedule: "Hourly during review hours",
      route: "Review automation route",
      status: "Ready to prepare",
      action: "Find completed dossiers that still need source notes, owner stop checks, or tax receipt notes.",
      stop: "Finished Discovery required"
    },
    {
      title: "Court packet check",
      schedule: state.dripSettings.requireCourtPacket ? "After court packet review" : "After review owner approval",
      route: "Review automation route",
      status: "Held for approval",
      action: "Prepare the probate document request task after docket status and page count are reviewed.",
      stop: "No court request leaves review automatically"
    },
    {
      title: "Drip draft prep",
      schedule: dripStartDelayLabel(),
      route: "Review automation now; approved background route later",
      status: "Prepared only",
      action: "Prepare email, SMS, and task drafts for team review in Podio.",
      stop: "No external send, no live CRM card"
    }
  ];
}

function queueItems() {
  const queued = queuedRows();
  const checked = checkedRows();
  const sourceRows = queued.length ? queued : checked;
  return sourceRows.map((row, index) => ({
    id: row.id,
    estate: row.leadName || row.title,
    title: row.leadName || row.title,
    copy: `${row.address || "Address needs review"} - ${row.next || "Review next action"}`,
    route: index % 2 === 0 ? "Podio batch prep" : "Google + Podio prep",
    type: ["completed-awaiting-export", "exported"].includes(estateWorkflowForRow(row).state) ? "export" : "doc-prep",
    status: queued.length ? estateWorkflowForRow(row).state === "exported" ? "Exported" : "Queued" : row.tone === "ready" ? "Ready for review" : row.tone === "blocked" ? "Blocked" : "Selected, not queued"
  }));
}

function closingTemplateSelectionRecord(row = selectedRow()) {
  if (!row) return { selectedTemplateIds: [] };
  const record = state.closingTemplateSelections?.[assetDiscoveryKey(row)];
  return record && typeof record === "object" && !Array.isArray(record)
    ? record
    : { selectedTemplateIds: [] };
}

function selectedClosingTemplateIds(row = selectedRow()) {
  const validIds = new Set(closingTemplateFamilies.map((template) => template.id));
  return [...new Set((closingTemplateSelectionRecord(row).selectedTemplateIds ?? []).map(String))]
    .filter((templateId) => validIds.has(templateId));
}

function selectedClosingTemplates(row = selectedRow()) {
  const selectedIds = new Set(selectedClosingTemplateIds(row));
  return closingTemplateFamilies.filter((template) => selectedIds.has(template.id));
}

function setClosingTemplateSelected(row = selectedRow(), templateId = "", included = false) {
  if (!row || !closingTemplateFamilies.some((template) => template.id === templateId)) return;
  const selectedIds = new Set(selectedClosingTemplateIds(row));
  if (included) selectedIds.add(templateId);
  else selectedIds.delete(templateId);
  state.closingTemplateSelections[assetDiscoveryKey(row)] = {
    selectedTemplateIds: [...selectedIds],
    updatedAt: isoNow(),
    updatedBy: state.session?.user?.email || "team"
  };
  persistClosingTemplateSelections();
}

function selectedClosingBlockers(row = selectedRow(), dossier = dossierForRow(row)) {
  const templates = selectedClosingTemplates(row);
  if (!templates.length) return [{ key: "template_selection", label: "Choose at least one Closing form", value: "No forms selected", resolved: false }];
  return templates.flatMap((template) => closingTemplateBlockers(template, row, dossier));
}

function closingFieldRecord(row = selectedRow(), key = "") {
  const estateKey = assetDiscoveryKey(row);
  const record = state.closingFieldValues?.[estateKey] ?? {};
  const value = record?.[key];
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string") return { value, note: "", savedAt: "" };
  return { value: "", note: "", savedAt: "" };
}

function closingFieldOverrideValue(row = selectedRow(), key = "") {
  const record = closingFieldRecord(row, key);
  const value = String(record.value || "").trim();
  if (value) return value;
  const note = String(record.note || "").trim();
  if (record.resolution === "not_applicable" && key === "foreclosure_case" && note) return `N/A - ${note}`;
  return "";
}

function setClosingFieldOverride(row = selectedRow(), key = "", value = "", note = "", resolution = "provided", supportingDocumentId = "") {
  if (!row || !key) return;
  const estateKey = assetDiscoveryKey(row);
  state.closingFieldValues[estateKey] = {
    ...(state.closingFieldValues[estateKey] ?? {}),
    [key]: {
      value: String(value || "").trim(),
      note: String(note || "").trim(),
      resolution,
      supportingDocumentId: String(supportingDocumentId || "").trim(),
      savedAt: isoNow(),
      savedBy: state.session?.user?.email || "team"
    }
  };
  persistClosingFieldValues();
}

function closingResolvedValue(row = selectedRow(), key = "", inferred = "") {
  return closingFieldOverrideValue(row, key) || inferred;
}

function closingRegistryEntry(key, label, value, { fallback = "Needs review", resolved } = {}) {
  const display = cleanDisplayValue(value || fallback);
  const autoResolved = Boolean(value) && !/needs review|missing|blocked|unknown|confirm|required/i.test(display);
  return {
    key,
    label,
    value: display,
    resolved: typeof resolved === "boolean" ? resolved : autoResolved
  };
}

function closingVariableRegistry(row = selectedRow(), dossier = dossierForRow(row)) {
  const report = dossier?.completedLeadReport ?? {};
  const offer = report.offerMath ?? {};
  const capture = sourceCaptureForRow(row);
  const acceptedContacts = acceptedContactCandidates(row);
  const primaryContacts = primaryContactCandidates(row);
  const sellerNames = acceptedContacts.map((contact) => contact.name).filter(Boolean).join(", ");
  const contactRelationships = acceptedContacts.map((contact) => `${contact.name || "Contact"}: ${displayStatus(contact.relationship, "relationship needs review")}`).join("; ");
  const deceasedName = row?.owner || dossier?.owner?.name?.value || dossier?.summary?.estateName || row?.leadName;
  const deedInstrument = capture.deed?.instrument || dossier?.deedHistory?.latestInstrument || "";
  const legalDescription = capture.deed?.legalDescription || capture.property?.legalDescription || dossier?.property?.legalDescription?.value || "";
  const taxPaidBy = capture.taxReceipt?.paidBy || report?.taxStatus?.paidBy || "";
  const titleEvidence = [deedInstrument ? `Deed ${deedInstrument}` : "", taxPaidBy ? `Tax receipt paid by ${taxPaidBy}` : ""].filter(Boolean).join("; ");
  const probateCase = row?.file || report?.probateStatus?.caseNumber || dossier?.probate?.caseNumber || "";
  const offerAmount = offer.offerAmount ? moneyClaimValue(offer.offerAmount) : "";
  const perHeirAmount = offer.equityPerHeir ? moneyClaimValue(offer.equityPerHeir) : "";
  const taxesDue = report?.taxStatus?.amountDue ? moneyClaimValue(report.taxStatus.amountDue) : report?.taxSummary || dossier?.taxHistory?.status || "";
  return [
    closingRegistryEntry("estate_name", "Estate / lead file", closingResolvedValue(row, "estate_name", dossier?.summary?.estateName || row?.leadName || row?.title)),
    closingRegistryEntry("deceased_name", "Deceased / owner name", closingResolvedValue(row, "deceased_name", deceasedName)),
    closingRegistryEntry("deceased_dob_dod", "DOB / DOD", closingResolvedValue(row, "deceased_dob_dod", ""), { fallback: "Needs vital, obituary, probate, or memorial source review" }),
    closingRegistryEntry("property_address", "Property address", closingResolvedValue(row, "property_address", row?.address || dossier?.property?.address?.value)),
    closingRegistryEntry("county", "County", closingResolvedValue(row, "county", formatCountyName(row?.county || dossier?.property?.county?.value || "Miami-Dade County, FL"))),
    closingRegistryEntry("folio", "Folio / parcel", closingResolvedValue(row, "folio", row?.parcel || dossier?.property?.parcelId?.value || row?.folio)),
    closingRegistryEntry("legal_description", "Legal description", closingResolvedValue(row, "legal_description", legalDescription), { fallback: "Needs reviewed deed or title evidence" }),
    closingRegistryEntry("seller_heirs", "Seller / heir signers", closingResolvedValue(row, "seller_heirs", sellerNames), { fallback: "Needs accepted signer contacts from Contact Review" }),
    closingRegistryEntry("heir_relationships", "Heir relationships", closingResolvedValue(row, "heir_relationships", contactRelationships), { fallback: "Needs family-tree relationship review" }),
    closingRegistryEntry("seller_mailing_address", "Seller mailing address", closingResolvedValue(row, "seller_mailing_address", primaryContacts[0]?.likelyCurrentAddress || primaryContacts[0]?.addresses?.[0] || ""), { fallback: "Needs reviewed signer mailing address" }),
    closingRegistryEntry("seller_marital_status", "Seller marital status", closingResolvedValue(row, "seller_marital_status", ""), { fallback: "Needs signer-confirmed marital status" }),
    closingRegistryEntry("buyer_entity", "Buyer / assignee entity", closingResolvedValue(row, "buyer_entity", ""), { fallback: "Confirm HeirRight, LLC vs Somi Home Buyers, LLC" }),
    closingRegistryEntry("representative", "Representative / attorney-in-fact", closingResolvedValue(row, "representative", primaryContacts[0]?.name || ""), { fallback: "Needs representative or attorney-in-fact" }),
    closingRegistryEntry("trust_name", "Land trust name", closingResolvedValue(row, "trust_name", ""), { fallback: "Needs title-approved trust name" }),
    closingRegistryEntry("settlor_entity", "Settlor entity", closingResolvedValue(row, "settlor_entity", ""), { fallback: "Needs approved settlor entity" }),
    closingRegistryEntry("trustee", "Trustee", closingResolvedValue(row, "trustee", ""), { fallback: "Needs trustee" }),
    closingRegistryEntry("beneficiary", "Beneficiary", closingResolvedValue(row, "beneficiary", ""), { fallback: "Needs approved trust beneficiary" }),
    closingRegistryEntry("title_company", "Title company / closer", closingResolvedValue(row, "title_company", ""), { fallback: "Needs title-company contact" }),
    closingRegistryEntry("offer_amount", "Offer amount", closingResolvedValue(row, "offer_amount", offerAmount)),
    closingRegistryEntry("transfer_amount", "Transfer amount", closingResolvedValue(row, "transfer_amount", offerAmount)),
    closingRegistryEntry("purchase_price", "Purchase price", closingResolvedValue(row, "purchase_price", offerAmount)),
    closingRegistryEntry("assignment_amount", "Assignment amount", closingResolvedValue(row, "assignment_amount", offerAmount)),
    closingRegistryEntry("per_heir_amount", "Per-heir amount", closingResolvedValue(row, "per_heir_amount", perHeirAmount)),
    closingRegistryEntry("valuable_consideration_amount", "Valuable consideration amount", closingResolvedValue(row, "valuable_consideration_amount", ""), { fallback: "Needs approved disbursement amount" }),
    closingRegistryEntry("tax_paid_by", "Last tax paid by", closingResolvedValue(row, "tax_paid_by", taxPaidBy), { fallback: "Needs Tax Collector receipt payer" }),
    closingRegistryEntry("taxes_due", "Taxes due / reimbursement amount", closingResolvedValue(row, "taxes_due", taxesDue)),
    closingRegistryEntry("title_evidence", "Title / deed evidence", closingResolvedValue(row, "title_evidence", titleEvidence), { fallback: "Needs deed instrument and tax receipt evidence" }),
    closingRegistryEntry("probate_case", "Probate / court case", closingResolvedValue(row, "probate_case", probateCase), { fallback: "Needs probate or official-record case reference" }),
    closingRegistryEntry("foreclosure_case", "Foreclosure case", closingResolvedValue(row, "foreclosure_case", ""), { fallback: "Needs foreclosure case or reviewed not-applicable value" }),
    closingRegistryEntry("disclaimer_recipient", "Disclaimer recipient", closingResolvedValue(row, "disclaimer_recipient", ""), { fallback: "Needs approved recipient" }),
    closingRegistryEntry("bank_transfer", "Bank transfer instructions", closingResolvedValue(row, "bank_transfer", ""), { fallback: "Needs seller-approved disbursement instructions" }),
    closingRegistryEntry("closing_date", "Closing / signing date", closingResolvedValue(row, "closing_date", ""), { fallback: "Needs approved closing date" }),
    closingRegistryEntry("name_variants", "Name variants", closingResolvedValue(row, "name_variants", ""), { fallback: "Needs same-name review notes" }),
    closingRegistryEntry("claim_instructions", "Claim instructions", closingResolvedValue(row, "claim_instructions", ""), { fallback: "Needs court or agency claim route" }),
    closingRegistryEntry("claimant_last_name", "Claimant last name", closingResolvedValue(row, "claimant_last_name", ""), { fallback: "Needs approved claimant" }),
    closingRegistryEntry("claimant_first_name", "Claimant first name", closingResolvedValue(row, "claimant_first_name", ""), { fallback: "Needs approved claimant" }),
    closingRegistryEntry("claimant_city", "Claimant city", closingResolvedValue(row, "claimant_city", ""), { fallback: "Needs claimant city" })
  ];
}

function closingVariableMap(row = selectedRow(), dossier = dossierForRow(row)) {
  return new Map(closingVariableRegistry(row, dossier).map((entry) => [entry.key, entry]));
}

function closingTemplateBlockers(template, row = selectedRow(), dossier = dossierForRow(row)) {
  const variables = closingVariableMap(row, dossier);
  return (template.required ?? [])
    .map((key) => variables.get(key) || closingRegistryEntry(key, displayStatus(key), "", { fallback: "Needs review" }))
    .filter((entry) => !entry.resolved);
}

function closingTemplateStatus(template, row = selectedRow(), dossier = dossierForRow(row)) {
  if (!selectedClosingTemplateIds(row).includes(template.id)) return "Not included";
  const blockers = closingTemplateBlockers(template, row, dossier);
  return blockers.length ? `Blocked: ${blockers.length} missing` : "Ready to generate";
}

function closingVariableRowsHtml(template, row = selectedRow(), dossier = dossierForRow(row)) {
  const variables = closingVariableMap(row, dossier);
  return (template.variables ?? []).map((key) => {
    const entry = variables.get(key) || closingRegistryEntry(key, displayStatus(key), "", { fallback: "Needs review" });
    return `<tr><th>${escapeHtml(entry.label)}</th><td>${escapeHtml(entry.value)}</td><td>${escapeHtml(entry.resolved ? "Ready" : "Needs review")}</td></tr>`;
  }).join("");
}

function closingBlockerListHtml(blockers) {
  return blockers.length
    ? `<ul>${blockers.map((entry) => `<li><strong>${escapeHtml(entry.label)}</strong> - ${escapeHtml(entry.value)}</li>`).join("")}</ul>`
    : "<ul><li>No missing required fields beyond final team/legal review.</li></ul>";
}

function closingTemplateSourceRows(row = selectedRow(), dossier = dossierForRow(row)) {
  const report = dossier?.completedLeadReport ?? {};
  return [
    ["Estate source", row?.sourceProvider || "HeirRight imported estate record"],
    ["Property", row?.address || dossier?.property?.address?.value || "Needs review"],
    ["Folio / parcel", row?.parcel || dossier?.property?.parcelId?.value || "Needs review"],
    ["Deed evidence", phaseIsComplete("deed", row, "discovery") ? "Captured or source-complete" : "Needs Official Records review"],
    ["Tax evidence", phaseIsComplete("tax-receipt", row, "discovery") ? "Captured or source-complete" : "Needs Tax Collector review"],
    ["Contacts", acceptedContactCandidates(row).length ? `${acceptedContactCandidates(row).length} accepted` : "Needs accepted signer contacts"],
    ["Review gate", report?.reviewGate?.externalUseBlocked ? "External use blocked" : "Approval still required"]
  ].map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(formatSourceFactValue(value))}</td></tr>`).join("");
}

function closingPacketOverviewHtml(row = selectedRow(), dossier = dossierForRow(row)) {
  const selectedIds = new Set(selectedClosingTemplateIds(row));
  const allBlockers = selectedIds.size
    ? selectedClosingTemplates(row).flatMap((template) => closingTemplateBlockers(template, row, dossier).map((entry) => `${template.title}: ${entry.label}`))
    : ["Choose at least one Closing form"];
  return pageShellHtml("Closing Packet Review", row?.leadName ?? row?.title ?? "Lead file", `
    <p class="muted">Generated from the selected estate file and the reviewed closing-template packet. This is a field map and review draft, not a live closing action.</p>
    <div class="notice"><strong>Review draft only.</strong> No live Podio card, Google Doc, Google Sheet row, email, SMS, signature request, escrow instruction, recording task, or legal finalization is created from this preview.</div>
    <h2>Template Families</h2>
    <table>
      <thead><tr><th>Template</th><th>Phase</th><th>Status</th><th>Required fields</th></tr></thead>
      <tbody>
        ${closingTemplateFamilies.map((template) => `
          <tr>
            <td>${escapeHtml(template.title)}</td>
            <td>${escapeHtml(docPrepPhases("closing-docs").find((phase) => phase.id === template.phaseId)?.label || "Closing")}</td>
            <td>${escapeHtml(selectedIds.has(template.id) ? closingTemplateStatus(template, row, dossier) : "Not included")}</td>
            <td>${escapeHtml((template.required ?? []).map(displayStatus).join(", "))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <h2>Shared Source Evidence</h2>
    <table>${closingTemplateSourceRows(row, dossier)}</table>
    <h2>Open Blockers</h2>
    <ul>${allBlockers.length ? [...new Set(allBlockers)].map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>No required template fields are missing beyond final team/legal approval.</li>"}</ul>
    <p class="small">Entity review remains explicit because the reviewed examples use both HeirRight, LLC and Somi Home Buyers, LLC.</p>
  `);
}

function closingTemplateDraftHtml(row = selectedRow(), dossier = dossierForRow(row), template = closingTemplateFamilies[0]) {
  const blockers = closingTemplateBlockers(template, row, dossier);
  return pageShellHtml(template.title, row?.leadName ?? row?.title ?? "Lead file", `
    <p class="muted">${escapeHtml(template.copy)}</p>
    <div class="notice"><strong>Review draft only.</strong> This preview prepares fields and blockers for team review. It does not create a live Podio card, Google Doc, Google Sheet row, email, SMS, signature request, escrow instruction, recording task, or legal final document.</div>
    ${template.reviewNote ? `<div class="notice">${escapeHtml(template.reviewNote)}</div>` : ""}
    <h2>Required Field Map</h2>
    <table>
      <thead><tr><th>Field</th><th>Current value</th><th>Status</th></tr></thead>
      <tbody>${closingVariableRowsHtml(template, row, dossier)}</tbody>
    </table>
    <h2>Missing Field Blockers</h2>
    ${closingBlockerListHtml(blockers)}
    <h2>Source Evidence</h2>
    <table>${closingTemplateSourceRows(row, dossier)}</table>
    <h2>Next Review Actions</h2>
    <ol>
      <li>Resolve every missing required field listed above.</li>
      <li>Confirm the correct legal entity and template version with the review owner.</li>
      <li>Only after approval, route the reviewed packet through Google/Podio readback gates.</li>
    </ol>
  `);
}

function closingTemplateDocuments(row = selectedRow(), dossier = dossierForRow(row)) {
  const selectedTemplates = selectedClosingTemplates(row);
  const overviewBlockers = selectedClosingBlockers(row, dossier).length;
  return [
    {
      id: "closing-packet-review",
      title: "Closing Packet Review",
      flowId: "closing-docs",
      phaseId: "closing-package",
      type: "Generated packet",
      copy: "One overview of every reviewed closing-template family, required variables, blockers, and source evidence.",
      status: overviewBlockers ? `Blocked: ${overviewBlockers} missing` : "Review draft",
      body: closingPacketOverviewHtml(row, dossier)
    },
    ...selectedTemplates.map((template) => ({
      id: `closing-template-${template.id}`,
      title: template.title,
      flowId: "closing-docs",
      phaseId: template.phaseId,
      type: template.type,
      copy: template.copy,
      status: closingTemplateStatus(template, row, dossier),
      body: closingTemplateDraftHtml(row, dossier, template)
    }))
  ];
}

function dossierDocuments(row = selectedRow(), dossier = dossierForRow(row)) {
  const report = dossier?.completedLeadReport;
  const missing = row?.missing ?? buildMissingSections(dossier ?? {});
  const familyTreePacketBody = report?.formats?.familyTreeHtml || discoveryDossierHtml(row, dossier);
  return [
    {
      id: "discovery-dossier",
      title: "Discovery Dossier",
      flowId: "discovery",
      phaseId: "owner-details",
      type: "PDF packet",
      copy: "Owner, property, deed, tax, probate, heirs, notes, and next actions.",
      status: missing.length ? `${missing.length} open section${missing.length === 1 ? "" : "s"}` : "Ready for review",
      body: familyTreePacketBody
    },
    {
      id: "completed-report",
      title: "Completed Lead Report",
      flowIds: ["discovery", "closing-docs"],
      phaseId: "dossier-export",
      flowPhaseIds: { discovery: "dossier-export", "closing-docs": "closing-intake" },
      type: "Rendered report",
      copy: "Lead report draft with offer, source notes, and review gate.",
      status: report?.reviewGate?.externalUseBlocked ? "Review blocked" : "Prepared",
      body: completedLeadReportHtml(row, dossier)
    },
    {
      id: "source-notes",
      title: "Source Notes",
      flowId: "discovery",
      phaseId: "owner-details",
      type: "Review notes",
      copy: "County records, source coverage, and missing fact checklist.",
      status: "Source-backed",
      body: sourceNotesHtml(row, dossier)
    },
    {
      id: "deed-title-notes",
      title: "Deed & Title Notes",
      flowIds: ["discovery", "closing-docs"],
      phaseId: "deed",
      flowPhaseIds: { discovery: "deed", "closing-docs": "title-clearance" },
      type: "Official records",
      copy: "Owner chain, deed gaps, OR book/page notes, and title review blockers.",
      status: (dossier?.deedHistory?.reviewTasks ?? []).length ? "Needs review" : "Staged",
      body: deedTitleNotesHtml(row, dossier)
    },
    {
      id: "tax-history",
      title: "Tax History Packet",
      flowIds: ["discovery", "closing-docs"],
      phaseId: "tax-receipt",
      flowPhaseIds: { discovery: "tax-receipt", "closing-docs": "title-clearance" },
      type: "Tax collector",
      copy: "Unpaid years, receipt status, payer notes, reassessment, and lien review.",
      status: missing.some((item) => item.type === "tax") ? "Open" : "Staged",
      body: taxHistoryHtml(row, dossier)
    },
    {
      id: "probate-request",
      title: "Probate Document Request",
      flowId: "discovery",
      phaseId: "deed",
      type: "Court request",
      copy: "Court call, page count, money order, certified copy, and pickup path.",
      status: "Draft",
      body: probateRequestHtml(row, dossier)
    },
    {
      id: "heir-contact-matrix",
      title: "Heir Contact Matrix",
      flowIds: ["discovery", "closing-docs"],
      phaseId: "contact-review",
      flowPhaseIds: { discovery: "contact-review", "closing-docs": "seller-approval" },
      type: "Contact review",
      copy: "Potential heirs, contact confidence, approval gates, and source notes.",
      status: (dossier?.familyTree?.reviewTasks ?? []).length ? "Needs review" : "Staged",
      body: heirContactMatrixHtml(row, dossier)
    },
    {
      id: "outreach-drafts",
      title: "Outreach Drafts",
      flowId: "discovery",
      phaseId: "dossier-export",
      type: "Email and SMS",
      copy: "Review-only outreach language held until approval.",
      status: "Locked",
      body: outreachDraftHtml(row, dossier)
    },
    {
      id: "drip-schedule",
      title: "Drip Schedule",
      flowId: "discovery",
      phaseId: "dossier-export",
      type: "Automation prep",
      copy: "Email/SMS cadence, stop rules, review owner, and no-send guardrails.",
      status: "Prepared only",
      body: dripScheduleHtml(row, dossier)
    },
    {
      id: "crm-handoff",
      title: "CRM Review",
      flowIds: ["discovery", "closing-docs"],
      phaseId: "dossier-export",
      flowPhaseIds: { discovery: "dossier-export", "closing-docs": "closing-package" },
      type: "Podio fields",
      copy: "Batch export fields, tasks, drip route, and readback checklist.",
      status: "Prep only",
      body: crmHandoffHtml(row, dossier)
    },
    ...closingTemplateDocuments(row, dossier)
  ];
}

function documentFlowMatches(doc, flowId = state.activeDocPrepFlow) {
  const flows = Array.isArray(doc?.flowIds) ? doc.flowIds : [doc?.flowId || "discovery"];
  return flows.includes(flowId);
}

function docsForFlow(row = selectedRow(), dossier = dossierForRow(row), flowId = state.activeDocPrepFlow) {
  return dossierDocuments(row, dossier).filter((doc) => documentFlowMatches(doc, flowId));
}

function dossierDocWorkflowState(doc, index = 0) {
  const flowId = documentFlowMatches(doc, state.activeDocPrepFlow) ? state.activeDocPrepFlow : (doc.flowId || doc.flowIds?.[0] || "discovery");
  const phases = docPrepPhases(flowId);
  const phaseId = doc.flowPhaseIds?.[flowId] || doc.phaseId;
  const phaseIndex = phases.findIndex((phase) => phase.id === phaseId);
  const phase = phases[phaseIndex] ?? phases[0];
  const row = selectedRow();
  const running = docPrepMainRunActive(row, flowId) && phase.id === currentDiscoveryPhase(flowId, row).id;
  const complete = !running && phaseIsComplete(phase.id, row, flowId);
  const active = running || (!complete && phase.id === currentDiscoveryPhase(flowId, row).id);
  const blocked = /blocked|locked/i.test(doc.status || "") && !complete;
  return {
    phase,
    state: complete ? "complete" : active ? "active" : blocked ? "blocked" : "pending",
    label: complete ? "Done" : active ? "Working" : blocked ? "Blocked" : "Needed",
    action: complete ? "Open" : active ? "Continue" : "Review",
    copy: complete
      ? `${phase.label} complete. ${doc.title} is ready to review.`
      : active
      ? `${phase.label} is active. Finish this stage to unlock the checkmark.`
      : blocked
      ? `${doc.status}. Complete ${phase.label} before this can be used.`
      : `Waiting on ${phase.label}. ${doc.status}.`,
    order: index + 1
  };
}

function dossierChecklistStatusHtml(workflow) {
  if (workflow.state === "complete") {
    return `<span class="dossier-check-status" aria-label="Complete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12.5 3.8 3.8L18 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }
  if (workflow.state === "active") {
    return `<span class="dossier-check-status" aria-label="Checking"><span class="dossier-check-spinner"></span></span>`;
  }
  return `<span class="dossier-check-status" aria-label="${escapeHtml(workflow.label)}">${String(workflow.order).padStart(2, "0")}</span>`;
}

function linearStatusIconHtml(stateName = "pending", label = "Needed") {
  const stateValue = ["complete", "active", "processing", "blocked", "pending"].includes(stateName) ? stateName : "pending";
  if (stateValue === "processing" || stateValue === "active") {
    return `<span class="linear-status-icon" data-state="${stateValue}" aria-label="${escapeHtml(label)}"><span class="linear-status-spinner" aria-hidden="true"></span></span>`;
  }
  if (stateValue === "complete") {
    return `<span class="linear-status-icon" data-state="complete" aria-label="${escapeHtml(label)}"><span class="linear-status-check-mark" aria-hidden="true"></span></span>`;
  }
  if (stateValue === "blocked") {
    return `<span class="linear-status-icon" data-state="blocked" aria-label="${escapeHtml(label)}">${nucleoIcon("flag", 15)}</span>`;
  }
  return `<span class="linear-status-icon" data-state="pending" aria-label="${escapeHtml(label)}"><span class="linear-status-pending-mark" aria-hidden="true"></span></span>`;
}

function adminErrorStatusIconHtml(item) {
  const label = item?.ready ? "Complete" : item?.severity === "review" ? "Review needed" : "Blocked";
  return `<span class="admin-error-status-icon" data-state="${item?.ready ? "complete" : "caution"}" aria-label="${escapeHtml(label)}">${nucleoIcon(item?.ready ? "check-circle" : "caution", 16)}</span>`;
}

function documentAutomationKey(docId, row = selectedRow()) {
  return `${documentStorageKey(row, docId)}:automation`;
}

function documentAutomationState(docId, row = selectedRow()) {
  return state.documentAutomationStates[documentAutomationKey(docId, row)] || "";
}

function setDocumentAutomationState(docId, stateName, row = selectedRow()) {
  const key = documentAutomationKey(docId, row);
  if (stateName) state.documentAutomationStates[key] = stateName;
  else delete state.documentAutomationStates[key];
}

function docPrepRunKey(row = selectedRow(), flowId = "discovery") {
  const flowKey = docPrepFlows[flowId] ? flowId : "discovery";
  return `${docPrepEstateKey(row)}:${flowKey}:run`;
}

function docPrepRunState(row = selectedRow(), flowId = "discovery") {
  return state.docPrepRunStates[docPrepRunKey(row, flowId)] || "";
}

function setDocPrepRunState(row = selectedRow(), flowId = "discovery", value = "") {
  const key = docPrepRunKey(row, flowId);
  if (value) state.docPrepRunStates[key] = value;
  else delete state.docPrepRunStates[key];
}

function docPrepMainRunActive(row = selectedRow(), flowId = "discovery") {
  return docPrepRunState(row, flowId) === "running";
}

function docPrepFlowIsComplete(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) return false;
  const phases = docPrepPhases(flowId);
  const phaseComplete = phases.length > 0 && phases.every((phase) => phaseIsComplete(phase.id, row, flowId));
  const dossier = dossierForRow(row);
  const stats = documentPrepStats(row, dossier, flowId);
  const documentsComplete = stats.total > 0 && stats.missing === 0;
  const closingFieldsComplete = flowId !== "closing-docs" || (selectedClosingTemplates(row).length > 0 && selectedClosingBlockers(row, dossier).length === 0);
  return phaseComplete && documentsComplete && closingFieldsComplete;
}

function docPrepMainRunLabel(row = selectedRow(), flowId = "discovery") {
  const flow = docPrepFlow(flowId);
  if (docPrepMainRunActive(row, flow.id)) return flow.id === "discovery" ? "Stop Discovery" : `Stop ${flow.shortTitle}`;
  if (docPrepFlowIsComplete(row, flow.id)) return "Complete";
  return flow.id === "discovery" ? "Run Full Discovery" : `Run ${flow.shortTitle}`;
}

function docPrepRunControlsHtml(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flow = docPrepFlow(flowId);
  const running = docPrepMainRunActive(row, flow.id);
  const complete = docPrepFlowIsComplete(row, flow.id);
  return `
    <div class="docprep-run-actions">
      ${complete ? `<button class="docprep-rerun-button" type="button" data-docprep-rerun-review="${escapeHtml(flow.id)}">Run again</button>` : ""}
      <button
        class="docprep-main-run-button ${running ? "is-running" : ""} ${complete ? "is-complete" : ""}"
        type="button"
        data-docprep-main-run="${escapeHtml(flow.id)}"
        ${complete ? "disabled aria-disabled=\"true\"" : ""}
      >${escapeHtml(docPrepMainRunLabel(row, flow.id))}</button>
      ${flow.id === "discovery" ? `
        <button class="docprep-idi-report-button" type="button" data-upload-idi-report aria-label="Upload IDI Report for this estate" title="Upload IDI Report">
          ${nucleoIcon("batch-tray", 14)}
          <span>Upload IDI Report</span>
        </button>
        <input type="file" hidden data-idi-report-file accept=".pdf,.docx" aria-label="Choose an IDI report PDF or DOCX file">
      ` : ""}
    </div>
  `;
}

function docPrepStreamKey(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flow = docPrepFlow(flowId);
  return `${docPrepEstateKey(row)}:${flow.id}:stream`;
}

function docPrepStreamForRow(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) return null;
  return state.docPrepStreamStates[docPrepStreamKey(row, flowId)] || null;
}

function docPrepStreamStatusLabel(status = "pending") {
  return {
    pending: "Waiting",
    writing: "Writing",
    complete: "Written",
    blocked: "Needs review",
    paused: "Paused",
    exported: "Exported"
  }[status] || "Waiting";
}

function sourceProofForCapture(capture = {}) {
  const proof = capture.sourceApiRun?.sourceRunProof;
  return proof && typeof proof === "object" ? proof : null;
}

function sourceProofBucket(capture = {}, source = "") {
  const sources = sourceProofForCapture(capture)?.sources;
  if (!Array.isArray(sources)) return null;
  return sources.find((item) => item.source === source || item.label === source) || null;
}

function sourceProofBucketLine(capture = {}, source = "", label = "Source proof") {
  const bucket = sourceProofBucket(capture, source);
  if (!bucket) return "";
  const status = sourceProofLabel(bucket.proofState);
  const action = sourceProofOperatorAction(bucket);
  return `${label}: ${status}${action ? ` - ${action}` : ""}`;
}

function sourceProofDetailLine(capture = {}, source = "", codes = [], label = "Source check") {
  const bucket = sourceProofBucket(capture, source);
  const checks = Array.isArray(bucket?.detailChecks) ? bucket.detailChecks : [];
  const targets = new Set(codes);
  const check = checks.find((item) => targets.has(item.code));
  if (!check) return sourceProofBucketLine(capture, source, label);
  const status = sourceDetailLabel(check.status);
  return `${label}: ${status}${check.operatorAction ? ` - ${check.operatorAction}` : ""}`;
}

function currentCaptureProofLine(hasEvidence, label = "Source check", evidenceCopy = "Evidence captured from the current Discovery File.") {
  return hasEvidence ? `${label}: Evidence captured - ${evidenceCopy}` : "";
}

function sourceRunSummaryLine(capture = {}) {
  const proof = sourceProofForCapture(capture);
  if (!proof) return "";
  const unresolved = Number(proof.blockingDetailCheckCount || proof.unresolvedDetailCheckCount || 0);
  const sourceCount = Array.isArray(proof.sources) ? proof.sources.length : 0;
  const generatedAt = Date.parse(capture.sourceApiRun?.generatedAt || "");
  const savedAt = Number(capture.updatedAt || 0);
  const newerCapture = Number.isFinite(generatedAt) && savedAt > generatedAt + 1000;
  const suffix = newerCapture ? " Current saved capture is newer than that source-search proof." : "";
  return proof.readyForOperatorReview
    ? `Source proof: ${sourceCount} source buckets returned evidence for operator review.${suffix}`
    : `Source proof: ${sourceCount} source buckets checked; ${unresolved} blocking checklist item${unresolved === 1 ? "" : "s"} remain visible.${suffix}`;
}

function docPrepStreamPhaseLines(row = selectedRow(), dossier = dossierForRow(row), flowId = state.activeDocPrepFlow, phase = currentDiscoveryPhase(flowId, row), status = "pending", message = "") {
  const capture = sourceCaptureForRow(row);
  const idi = idiImportForRow(row);
  const accepted = acceptedContactCandidates(row);
  const docs = docsForFlow(row, dossier, flowId);
  const discoveryStats = documentPrepStats(row, dossier, "discovery");
  const closingBlockers = selectedClosingBlockers(row, dossier).map((entry) => entry.label);
  const taxStatus = capture.taxReceipt?.status === "browser_workflow_required" ? "Browser workflow blocked" : capture.taxReceipt?.status || "Needs review";
  const taxBlocker = capture.taxReceipt?.sourceBlockedReason || capture.taxReceipt?.blocker || "";
  const common = [
    `Estate: ${docPrepEstateLabel(row)}`,
    `Property: ${cleanDisplayValue(row?.address || dossier?.property?.address?.value || "Address needs review")}`,
    `Source: ${phase?.source || docPrepFlow(flowId).title}`,
    sourceRunSummaryLine(capture)
  ].filter(Boolean);
  const phaseLines = {
    "owner-details": [
      `Owner: ${docPrepOwnerLabel(row)}`,
      `Folio: ${cleanDisplayValue(row?.parcel || dossier?.property?.parcelId?.value || "Needs folio review")}`,
      sourceProofDetailLine(capture, "property_appraiser", ["property_identity", "owner_name", "owner_identity"], "Property Appraiser proof"),
      row?.sourceKind === "crm-import" ? `Imported record: ${row.sourceRecordId || row.file || "linked estate import"}` : "External estate row is being assembled from public source evidence."
    ].filter(Boolean),
    "tax-receipt": [
      `Tax source status: ${cleanDisplayValue(taxStatus)}`,
      `Listing page: ${cleanDisplayValue(capture.taxReceipt?.listingUrl || "Needs Tax Collector listing page")}`,
      `Bottom-right receipt link: ${cleanDisplayValue(capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl || "Needs bottom-right receipt link")}`,
      `Paid by: ${cleanDisplayValue(capture.taxReceipt?.paidBy || "Needs Tax Collector payer")}`,
      `Paid date: ${cleanDisplayValue(capture.taxReceipt?.paidDate || "Needs receipt paid date")}`,
      `Amount due: ${cleanDisplayValue(capture.taxReceipt?.amountDue || "Needs amount due review")}`,
      `Unpaid years: ${cleanDisplayValue(capture.taxReceipt?.unpaidYears || "Needs unpaid-year review")}`,
      `Reassessment: ${cleanDisplayValue(capture.taxReceipt?.reassessment || "Needs reassessment review")}`,
      taxBlocker ? `Tax source blocker: ${cleanDisplayValue(taxBlocker)}` : "",
      currentCaptureProofLine(Boolean(capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl), "Bottom-right receipt proof", "Receipt link is saved from the Tax Collector listing page.")
        || sourceProofDetailLine(capture, "tax_collector", ["bottom_right_receipt", "tax_receipt_link"], "Bottom-right receipt proof")
    ].filter(Boolean),
    deed: [
      `Official Records: ${cleanDisplayValue(capture.deed?.sourceUrl || "Needs Official Records source")}`,
      `Instrument: ${cleanDisplayValue(capture.deed?.instrument || capture.deed?.instrumentNumber || dossier?.deedHistory?.latestInstrument || "Needs OR book/page or instrument")}`,
      `Deed file: ${cleanDisplayValue(capture.deed?.documentUrl || capture.deed?.fileName || "Not attached yet")}`,
      `Grantor / grantee: ${cleanDisplayValue([capture.deed?.grantor, capture.deed?.grantee].filter(Boolean).join(" to ") || "Needs source review")}`,
      `Recording date: ${cleanDisplayValue(capture.deed?.recordingDate || capture.deed?.lastSaleDate || "Needs recording-date review")}`,
      `Adverse possession: ${cleanDisplayValue(capture.deed?.adversePossessionSignal || "Needs explicit present/absent review")}`,
      currentCaptureProofLine(Boolean((capture.deed?.sourceUrl || capture.deed?.documentUrl || capture.deed?.fileName) && (capture.deed?.instrument || capture.deed?.instrumentNumber || capture.deed?.book || capture.deed?.page)), "Deed/title proof", "Official Records evidence and instrument are saved in the Discovery File.")
        || sourceProofDetailLine(capture, "official_records", ["latest_deed", "deed_instrument", "title_chain"], "Deed/title proof"),
      currentCaptureProofLine(Boolean(capture.probate?.caseNumber || capture.probate?.docketUrl || capture.probate?.sourceUrl), "Court/probate proof", "Court docket evidence is saved in the Discovery File.")
        || sourceProofDetailLine(capture, "probate_court", ["case_lookup", "probate_case", "affidavit_of_heirs"], "Court/probate proof")
    ].filter(Boolean),
    obituary: [
      `Obituary status: ${cleanDisplayValue(capture.obituary?.status || (capture.obituary?.sourceUrl ? "found" : "Needs obituary source review"))}`,
      `Obituary evidence: ${cleanDisplayValue(capture.obituary?.sourceUrl || capture.obituary?.fileName || "Not attached yet")}`,
      `DOB / DOD: ${cleanDisplayValue([capture.obituary?.dateOfBirth, capture.obituary?.dateOfDeath].filter(Boolean).join(" / ") || "Needs vital source review")}`,
      `Probate case: ${cleanDisplayValue(capture.probate?.caseNumber || "Needs docket source review")}`,
      `Probate docket: ${cleanDisplayValue(capture.probate?.docketUrl || capture.probate?.sourceUrl || "Needs docket link")}`,
      currentCaptureProofLine(Boolean(capture.obituary?.sourceUrl || capture.obituary?.fileName || capture.obituary?.dateOfDeath || capture.obituary?.status === "reviewed-not-found"), "Obituary/vital proof", "Obituary or vital-source review is saved in the Discovery File.")
        || sourceProofDetailLine(capture, "clerk_of_courts", ["vital_indicators", "obituary_vital_review", "deceased_indicator"], "Obituary/vital proof")
    ].filter(Boolean),
    "idi-asset-search": [
      `IDI search: ${idi?.mode === "live_idi_core" ? "Completed through approved team access" : idi ? "Approved report imported" : "Needs approved access or report import"}`,
      `Paid search: ${idi?.paidRun ? "Completed with approval" : "Not run"}`,
      `Access: ${idi ? "Team account" : "Needs approved access"}`,
      `Duplicate paid-search protection: ${idi?.lockKey ? "On" : "Waiting for the first approved search"}`,
      `Contacts found: ${Array.isArray(idi?.candidates) ? idi.candidates.length : 0}`,
      `Evidence saved: ${idi?.readbackStatus === "verified" || idi?.sourceEvidence?.readbackStatus === "verified" ? "Yes" : "Not yet"}`,
      sourceProofDetailLine(capture, "idi", ["idi_paid_run_approval", "idi_report_import", "idi_contact_review"], "IDI source gate")
    ].filter(Boolean),
    "contact-review": [
      `Accepted contacts: ${accepted.length}`,
      accepted.length ? `Signer/contact names: ${accepted.map((contact) => contact.name).filter(Boolean).join(", ")}` : "Signer/contact review is still required.",
      sourceProofDetailLine(capture, "skip_trace", ["skip_trace_contact_review", "provider_access"], "Contact-source gate")
    ],
    "dossier-export": [
      `Packet sections: ${docs.length}`,
      `Discovery documents linked: ${documentPrepStats(row, dossier, "discovery").linked} / ${documentPrepStats(row, dossier, "discovery").total}`,
      "Batch Queue export target: one combined Discovery Prep PDF for this estate flow."
    ],
    "closing-intake": [
      `Imported row: ${row?.sourceRecordId || row?.file || "estate row linked"}`,
      `Reviewed Discovery File: ${discoveryProgress("discovery", row)}% complete; ${discoveryStats.linked} / ${discoveryStats.total} Discovery documents linked`,
      `Review owner: ${state.session?.user?.email || "team"}`
    ],
    "title-clearance": [
      `Deed status: ${assetPhaseComplete(row, "deed") ? "deed evidence present" : "needs deed evidence"}`,
      `Tax status: ${assetPhaseComplete(row, "tax-receipt") ? "tax evidence present" : "needs tax evidence"}`,
      `Bottom-right receipt link: ${cleanDisplayValue(capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl || "Needs bottom-right receipt link")}`,
      `Title evidence: ${cleanDisplayValue(capture.deed?.instrument || capture.deed?.sourceUrl || "Needs deed/title source")}`
    ],
    "seller-approval": [
      `Accepted signers: ${accepted.length}`,
      accepted.length ? `Signer/contact names: ${accepted.map((contact) => contact.name).filter(Boolean).join(", ")}` : "Closing signer approval is still required."
    ],
    "offer-underwriting": [
      `Offer amount: ${moneyClaimValue(dossier?.completedLeadReport?.offerMath?.offerAmount) || "Needs offer review"}`,
      `Minimum net: ${moneyClaimValue(dossier?.completedLeadReport?.offerMath?.minimumNetProfit) || "Needs review"}`
    ],
    "closing-package": [
      `Template families: ${closingTemplateFamilies.length}`,
      `Required-field blockers: ${closingBlockers.length}`,
      closingBlockers.length ? `First blockers: ${closingBlockers.slice(0, 4).join("; ")}` : "All required mapped fields are present for review.",
      `Bottom-right receipt link: ${cleanDisplayValue(capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl || "Needs bottom-right receipt link")}`,
      "Export target: one combined Closing Prep PDF. Legal template language remains unchanged."
    ].filter(Boolean)
  };
  const result = [...common, ...(phaseLines[phase?.id] || [phase?.summary || docPrepFlow(flowId).copy])];
  if (message) result.push(message);
  if (status === "complete") result.push(`${phase?.label || "Section"} written from current reviewed fields.`);
  if (status === "blocked") result.push("Stopped before export so the user can supply or approve the missing information.");
  if (status === "writing") result.push("Writing visible packet text from the saved estate record now.");
  return result.filter(Boolean);
}

function buildDocPrepStreamSections(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const dossier = dossierForRow(row);
  return docPrepPhases(flowId).map((phase) => {
    const status = phaseIsComplete(phase.id, row, flowId) ? "complete" : "pending";
    return {
      id: phase.id,
      title: phase.name,
      eyebrow: phase.label,
      source: phase.source,
      status,
      updatedAt: isoNow(),
      lines: docPrepStreamPhaseLines(row, dossier, flowId, phase, status)
    };
  });
}

function beginDocPrepStream(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) return null;
  const flow = docPrepFlow(flowId);
  const sections = buildDocPrepStreamSections(row, flow.id);
  const firstOpenIndex = Math.max(0, sections.findIndex((section) => section.status !== "complete"));
  const index = firstOpenIndex < 0 ? 0 : firstOpenIndex;
  const key = docPrepStreamKey(row, flow.id);
  state.docPrepStreamStates[key] = {
    flowId: flow.id,
    estateKey: docPrepEstateKey(row),
    estateLabel: docPrepEstateLabel(row),
    status: "writing",
    activeSectionId: sections[index]?.id || sections[0]?.id || "",
    startedAt: isoNow(),
    updatedAt: isoNow(),
    sections
  };
  state.docPrepSectionIndex[key] = index;
  return state.docPrepStreamStates[key];
}

function setDocPrepStreamPhase(row = selectedRow(), flowId = state.activeDocPrepFlow, phase = currentDiscoveryPhase(flowId, row), status = "writing", message = "") {
  if (!row || !phase) return null;
  const flow = docPrepFlow(flowId);
  const key = docPrepStreamKey(row, flow.id);
  const stream = state.docPrepStreamStates[key] || beginDocPrepStream(row, flow.id);
  if (!stream) return null;
  const index = Math.max(0, stream.sections.findIndex((section) => section.id === phase.id));
  const section = stream.sections[index] || {
    id: phase.id,
    title: phase.name,
    eyebrow: phase.label,
    source: phase.source,
    status: "pending",
    lines: []
  };
  stream.sections[index] = {
    ...section,
    status,
    updatedAt: isoNow(),
    lines: docPrepStreamPhaseLines(row, dossierForRow(row), flow.id, phase, status, message)
  };
  stream.status = status === "blocked" ? "blocked" : status === "paused" ? "paused" : "writing";
  stream.activeSectionId = phase.id;
  stream.updatedAt = isoNow();
  state.docPrepSectionIndex[key] = index;
  return stream;
}

function completeDocPrepStream(row = selectedRow(), flowId = state.activeDocPrepFlow, linkedCount = 0) {
  if (!row) return null;
  const flow = docPrepFlow(flowId);
  const stream = state.docPrepStreamStates[docPrepStreamKey(row, flow.id)] || beginDocPrepStream(row, flow.id);
  if (!stream) return null;
  stream.status = "exported";
  stream.updatedAt = isoNow();
  stream.activeSectionId = stream.sections[stream.sections.length - 1]?.id || stream.activeSectionId;
  stream.summary = `${flow.shortTitle} generated ${linkedCount} packet section${linkedCount === 1 ? "" : "s"} for one combined PDF export.`;
  stream.sections = stream.sections.map((section) => ({
    ...section,
    status: "complete",
    updatedAt: isoNow(),
    lines: section.lines?.length ? section.lines : docPrepStreamPhaseLines(row, dossierForRow(row), flow.id, docPrepPhases(flow.id).find((phase) => phase.id === section.id), "complete")
  }));
  state.docPrepSectionIndex[docPrepStreamKey(row, flow.id)] = Math.max(0, stream.sections.length - 1);
  return stream;
}

function pauseDocPrepStream(row = selectedRow(), flowId = state.activeDocPrepFlow, message = "") {
  const phase = currentDiscoveryPhase(flowId, row);
  return setDocPrepStreamPhase(row, flowId, phase, "paused", message || `${docPrepFlow(flowId).shortTitle} paused before the next section.`);
}

function docPrepStreamTone(stream) {
  if (!stream) return "review";
  if (stream.status === "blocked") return "blocked";
  if (stream.status === "exported") return "ready";
  return "review";
}

function docPrepStreamProgressLabel(stream) {
  if (!stream?.sections?.length) return "0 / 0";
  const done = stream.sections.filter((section) => section.status === "complete" || section.status === "exported").length;
  return `${done} / ${stream.sections.length}`;
}

function docPrepStreamPanelHtml(row = selectedRow(), dossier = dossierForRow(row), flowId = state.activeDocPrepFlow) {
  const stream = docPrepStreamForRow(row, flowId);
  if (!stream) return "";
  const key = docPrepStreamKey(row, flowId);
  const flow = docPrepFlow(flowId);
  const index = Math.max(0, Math.min(stream.sections.length - 1, Number(state.docPrepSectionIndex[key] ?? 0)));
  const activeSectionId = stream.activeSectionId || stream.sections[index]?.id || stream.sections[0]?.id || "";
  const complete = stream.status === "exported";
  return `
    <section class="glass-card rail-card docprep-artifact-stream" data-docprep-stream="${escapeHtml(key)}" data-docprep-stream-flow="${escapeHtml(flow.id)}">
      <div class="artifact-stream-head">
        <div>
          <p class="eyebrow">Preview</p>
          <h3>${escapeHtml(flow.shortTitle)} artifact ${complete ? "ready for review" : "being written"}</h3>
          <p class="copy">${escapeHtml(stream.summary || "Sections update as the actual Doc Prep run clears source, IDI, contact, and closing-field gates.")}</p>
        </div>
        ${statusPill(docPrepStreamTone(stream), `${docPrepStreamProgressLabel(stream)} sections`)}
      </div>
      <div class="docprep-section-control" aria-label="${escapeHtml(flow.shortTitle)} section navigation">
        <button type="button" data-docprep-section-cycle="-1" aria-label="Previous packet section">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m15 18-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="docprep-section-chips" role="tablist" aria-label="${escapeHtml(flow.shortTitle)} packet sections">
          ${stream.sections.map((section) => `
            <button
              class="docprep-section-chip"
              type="button"
              role="tab"
              aria-selected="${section.id === activeSectionId ? "true" : "false"}"
              data-docprep-section-jump="${escapeHtml(section.id)}"
              data-active="${section.id === activeSectionId ? "true" : "false"}"
              data-state="${escapeHtml(section.status)}"
            >${escapeHtml(section.eyebrow || section.title)}</button>
          `).join("")}
        </div>
        <button type="button" data-docprep-section-cycle="1" aria-label="Next packet section">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="artifact-stream-document" data-docprep-stream-document>
        ${stream.sections.map((section) => `
          <article class="artifact-stream-section" data-docprep-stream-section="${escapeHtml(section.id)}" data-state="${escapeHtml(section.status)}" data-active="${section.id === activeSectionId ? "true" : "false"}">
            <h4>
              <span>${escapeHtml(section.title)}</span>
              <span class="pill neutral">${escapeHtml(docPrepStreamStatusLabel(section.status))}</span>
            </h4>
            <ol class="artifact-stream-lines">
              ${(section.lines || []).map((line, lineIndex) => `<li>${escapeHtml(line)}${section.status === "writing" && lineIndex === (section.lines || []).length - 1 ? `<span class="stream-cursor" aria-hidden="true"></span>` : ""}</li>`).join("")}
            </ol>
          </article>
        `).join("")}
      </div>
      <p class="artifact-stream-shortcut">Use Option+Up / Option+Down to cycle sections while this rail is open.</p>
    </section>
  `;
}

function syncDocPrepStreamActiveDom(sectionId) {
  const content = document.getElementById("railContent");
  if (!content || !sectionId) return;
  content.querySelectorAll("[data-docprep-section-jump]").forEach((button) => {
    const active = button.dataset.docprepSectionJump === sectionId;
    button.dataset.active = active ? "true" : "false";
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  content.querySelectorAll("[data-docprep-stream-section]").forEach((section) => {
    section.dataset.active = section.dataset.docprepStreamSection === sectionId ? "true" : "false";
  });
}

function scrollToDocPrepStreamSection(sectionId, { behavior = "smooth", announce = true } = {}) {
  const row = selectedRow();
  const flow = docPrepFlow();
  const stream = docPrepStreamForRow(row, flow.id);
  if (!row || !stream || !sectionId) return false;
  const index = stream.sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return false;
  const key = docPrepStreamKey(row, flow.id);
  stream.activeSectionId = sectionId;
  state.docPrepSectionIndex[key] = index;
  syncDocPrepStreamActiveDom(sectionId);
  const target = Array.from(document.querySelectorAll("[data-docprep-stream-section]")).find((section) => section.dataset.docprepStreamSection === sectionId);
  if (target) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "start", inline: "nearest", behavior: reduced ? "auto" : behavior });
  }
  if (announce) {
    const label = stream.sections[index]?.title || "packet section";
    document.getElementById("topStatus").textContent = `${label} selected in the ${flow.shortTitle} preview.`;
  }
  return true;
}

function cycleDocPrepStreamSection(direction = 1) {
  const row = selectedRow();
  const flow = docPrepFlow();
  const stream = docPrepStreamForRow(row, flow.id);
  if (!stream?.sections?.length) return false;
  const key = docPrepStreamKey(row, flow.id);
  const current = Math.max(0, Math.min(stream.sections.length - 1, Number(state.docPrepSectionIndex[key] ?? 0)));
  const next = (current + Number(direction || 1) + stream.sections.length) % stream.sections.length;
  return scrollToDocPrepStreamSection(stream.sections[next].id);
}

function wireDocPrepStreamControls(root, row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const stream = docPrepStreamForRow(row, flowId);
  if (!root || !stream) return;
  root.querySelectorAll("[data-docprep-section-jump]").forEach((button) => {
    button.addEventListener("click", () => scrollToDocPrepStreamSection(button.dataset.docprepSectionJump));
  });
  root.querySelectorAll("[data-docprep-section-cycle]").forEach((button) => {
    button.addEventListener("click", () => cycleDocPrepStreamSection(Number(button.dataset.docprepSectionCycle || 1)));
  });
  if (docPrepMainRunActive(row, flowId)) {
    requestAnimationFrame(() => scrollToDocPrepStreamSection(stream.activeSectionId, { behavior: "smooth", announce: false }));
  }
}

function docPrepPhaseBlocker(row = selectedRow(), flowId = state.activeDocPrepFlow, phase = currentDiscoveryPhase(flowId, row)) {
  if (!row || !phase) return "";
  const dossier = dossierForRow(row);
  if (flowId === "discovery") {
    if (phase.id === "owner-details" && !assetPhaseComplete(row, "owner-details")) {
      return "Owner Details needs verified Property Appraiser readback with the source URL, owner, property address, folio, and mailing address before Discovery can continue.";
    }
    if (phase.id === "tax-receipt" && !assetPhaseComplete(row, "tax-receipt")) {
      const providerBlocker = (sourceCaptureForRow(row).sourceApiRun?.blockers || [])
        .find((message) => /browserbase\b.*\b(?:billing|payment|402)\b/i.test(String(message)));
      if (providerBlocker) return String(providerBlocker);
      return "Tax receipt needs the Tax Collector listing page and bottom-right receipt link, or an explicit unavailable-after-listing-check note, before Discovery can continue.";
    }
    if (phase.id === "deed" && !assetPhaseComplete(row, "deed")) return "Latest deed needs OR book/page, instrument, attachment, or saved Official Records evidence before Discovery can continue.";
    if (phase.id === "obituary" && !assetPhaseComplete(row, "obituary")) return "Obituary review needs a found link/snapshot or an explicit reviewed-not-found note.";
    if (phase.id === "idi-asset-search" && !assetPhaseComplete(row, "idi-asset-search")) return "IDI Core asset search needs a controlled live run or an approved report import before contact review.";
    if (phase.id === "contact-review" && !assetPhaseComplete(row, "contact-review")) return "Contact review needs at least one accepted or promoted spouse, child, heir, or representative contact.";
  }
  if (flowId === "closing-docs") {
    const blockers = selectedClosingBlockers(row, dossier);
    if (phase.id === "closing-package" && blockers.length) return `${blockers.length} required Closing Prep field${blockers.length === 1 ? "" : "s"} must be filled or marked not applicable before export.`;
    if (phase.id === "title-clearance" && !assetPhaseComplete(row, "title-clearance")) return "Title Clearance needs deed and tax evidence from Discovery before Closing Prep can continue.";
    if (phase.id === "seller-approval" && !assetPhaseComplete(row, "seller-approval")) return "Seller Approval needs accepted signer/contact review before Closing Prep can continue.";
  }
  return "";
}

function linkGeneratedDocPrepPackets(row = selectedRow(), flowId = state.activeDocPrepFlow, options = {}) {
  const packet = packetArtifactForRow(row, flowId);
  if (!row || !packet?.verification?.verified || packet?.verification?.readbackStatus !== "verified") return 0;
  const flow = docPrepFlow(flowId);
  // docsForFlow may normalize and replace this estate's workflow record. Resolve
  // it before taking the mutable flow-state reference so packet audit writes land
  // on the canonical record that will be persisted.
  const docs = docsForFlow(row, dossierForRow(row), flow.id);
  const flowState = docPrepFlowState(row, flow.id);
  const artifactId = String(packet.artifact?.artifactId || "");
  const documentArtifacts = new Map((packet.documentArtifacts || []).map((document) => [String(document.documentId || ""), document]));
  const correctionNote = normalizePacketCorrectionNote(options.correctionNote);
  const existingPacket = correctionNote
    ? null
    : (flowState.generatedPackets || []).find((entry) => entry?.artifactId === artifactId);
  const boundPacketRevision = Number(packet?.artifact?.packetRevision || packet?.packetRevision);
  const expectedPacketRevision = currentPacketRevision(row, flow.id) + 1;
  if (!existingPacket && (!Number.isInteger(boundPacketRevision) || boundPacketRevision !== expectedPacketRevision)) return 0;
  let linked = 0;
  docs.forEach((doc) => {
    const boundArtifact = flow.id === "discovery" && doc.id !== "discovery-dossier"
      ? documentArtifacts.get(doc.id)
      : {
          artifactId,
          artifactUrl: packet.artifactUrl,
          contentHash: packet.artifact.contentHash,
          expiresAt: packet.artifact.expiresAt,
          verification: packet.verification
        };
    if (!boundArtifact?.artifactId || !boundArtifact?.artifactUrl || !boundArtifact?.contentHash
      || boundArtifact?.verification?.readbackStatus !== "verified") return;
    const storageKey = documentStorageKey(row, doc.id);
    const existing = documentFileRecord(doc.id, row);
    if (existing?.artifactId === boundArtifact.artifactId) return;
    state.documentFiles[storageKey] = {
      id: doc.id,
      name: `${doc.title} - ${docPrepOwnerLabel(row)}.pdf`,
      size: boundArtifact.verification.byteLength,
      type: "application/pdf",
      source: "verified_packet_artifact",
      artifactId: boundArtifact.artifactId,
      artifactUrl: boundArtifact.artifactUrl,
      contentHash: boundArtifact.contentHash,
      readbackStatus: "verified",
      sectionTitle: doc.title,
      sectionIds: boundArtifact.sectionIds || [],
      version: existing ? Number(existing.version || 1) + 1 : 1,
      linkedAt: Date.now(),
      linkedBy: state.session?.user?.email || "team",
      expiresAt: boundArtifact.expiresAt
    };
    linked += 1;
  });
  if (!existingPacket) {
    flowState.packetRevision = boundPacketRevision;
    flowState.generatedPackets = [
      normalizeGeneratedPacketRecord({
        flowId: flow.id,
        packetRevision: flowState.packetRevision,
        generatedAt: packet.verification.verifiedAt,
        generatedBy: state.session?.user?.email || "HeirRight operator",
        correctionNote,
        artifactId,
        artifactUrl: packet.artifactUrl,
        contentHash: packet.artifact.contentHash,
        readbackStatus: "verified",
        artifact: flow.id === "discovery" ? "combined_and_separated_pdf" : "single_pdf",
        documents: docs.length,
        sections: packet.sections
      }),
      ...(flowState.generatedPackets || [])
    ].slice(0, 25);
  }
  if (options.syncWorkspace === false) {
    storageSetItem(documentFilesStateKey, JSON.stringify(documentFilesPersistenceSnapshot(state.documentFiles)), { sync: false });
    storageSetItem(docPrepEstateStateKey, JSON.stringify(state.docPrepEstateState), { sync: false });
  } else {
    persistDocumentFiles();
    persistDocPrepEstateState();
  }
  return linked;
}

async function verifyGeneratedPacketAuditReadback(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const packet = packetArtifactForRow(row, flowId);
  const flowState = existingDocPrepFlowState(row, flowId);
  const latest = flowState?.generatedPackets?.[0];
  if (
    !packet?.verification?.verified
    || latest?.readbackStatus !== "verified"
    || latest?.artifactId !== packet.artifact?.artifactId
    || latest?.packetRevision !== currentPacketRevision(row, flowId)
  ) {
    throw new Error("The generated packet audit record does not match the verified artifact revision.");
  }
  const text = JSON.stringify(state.docPrepEstateState);
  const verified = await persistServerState(docPrepEstateStateKey, text);
  if (!verified) {
    throw new Error("The packet audit history did not pass shared-workspace readback.");
  }
  await storageSetItem(docPrepEstateStateKey, text, { sync: false });
  return latest;
}

function currentPacketRevision(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flowState = existingDocPrepFlowState(row, flowId);
  return Math.max(
    Number(flowState?.packetRevision || 0),
    Number(flowState?.generatedPackets?.length || 0)
  );
}

function currentPacketApproval(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) return null;
  const packet = packetArtifactForRow(row, flowId);
  if (!packetMatchesCurrentVerifiedRevision(row, flowId, packet) || !packetArtifactIsUnexpired(packet)) return null;
  const approval = normalizePacketApproval(state.packetApprovals?.[`${flowId}:${assetDiscoveryKey(row)}`]);
  const packetRevision = currentPacketRevision(row, flowId);
  if (
    !approval
    || approval.packetRevision !== packetRevision
    || approval.artifactId !== String(packet.artifact?.artifactId || "")
    || approval.estateId !== assetDiscoveryKey(row)
    || approval.flow !== flowId
  ) return null;
  return approval;
}

function setRuntimePacketApproval(row, flowId, value = null) {
  if (!row || !docPrepFlows[flowId]) return null;
  const key = `${flowId}:${assetDiscoveryKey(row)}`;
  const approval = normalizePacketApproval(value);
  if (approval) state.packetApprovals[key] = approval;
  else delete state.packetApprovals[key];
  return approval;
}

async function hydrateCurrentPacketApproval(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row || !docPrepFlows[flowId]) return null;
  const packet = packetArtifactForRow(row, flowId);
  if (!packetMatchesCurrentVerifiedRevision(row, flowId, packet) || !packetArtifactIsUnexpired(packet)) {
    setRuntimePacketApproval(row, flowId, null);
    return null;
  }
  const packetRevision = currentPacketRevision(row, flowId);
  const artifactId = String(packet.artifact?.artifactId || "");
  try {
    const result = await postJson("/api/doc-prep/packet-approval", {
      action: "status",
      packetRevision,
      artifactId,
      estateId: assetDiscoveryKey(row),
      flow: flowId,
    });
    const approval = result?.approved === true ? normalizePacketApproval(result.approval) : null;
    if (
      result?.readbackStatus === "verified"
      && approval
      && approval.packetRevision === packetRevision
      && approval.artifactId === artifactId
      && approval.estateId === assetDiscoveryKey(row)
      && approval.flow === flowId
    ) return setRuntimePacketApproval(row, flowId, approval);
  } catch {}
  setRuntimePacketApproval(row, flowId, null);
  return null;
}

async function approveCurrentPacket(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) throw new Error("Choose an estate before approving its packet.");
  const flow = docPrepFlow(flowId);
  const stopBlocker = canonicalStopBlocker(row, "Packet approval");
  if (stopBlocker) throw new Error(stopBlocker);
  const packet = packetArtifactForRow(row, flow.id);
  requireCurrentUnexpiredPacket(row, flow.id, packet, "approval");
  const existingApproval = currentPacketApproval(row, flow.id);
  if (existingApproval) return existingApproval;
  const packetRevision = currentPacketRevision(row, flow.id);
  if (!packetRevision) throw new Error("The verified packet revision is unavailable. Regenerate the packet before approval.");
  const approvalResult = await postJson("/api/doc-prep/packet-approval", {
    action: "approve",
    packetRevision,
    artifactId: packet.artifact?.artifactId,
    estateId: assetDiscoveryKey(row),
    flow: flow.id,
  });
  const approval = normalizePacketApproval(approvalResult?.approval);
  if (
    approvalResult?.readbackStatus !== "verified"
    || !approval
    || approval.packetRevision !== packetRevision
    || approval.artifactId !== String(packet.artifact?.artifactId || "")
    || approval.estateId !== assetDiscoveryKey(row)
    || approval.flow !== flow.id
  ) throw new Error("Packet approval did not pass exact server-attested readback. Review the blocker and retry.");

  setRuntimePacketApproval(row, flow.id, approval);
  document.getElementById("topStatus").textContent = "The current verified packet was approved for controlled handoff.";
  addShellEvent(
    "Packet approved",
    `${flow.shortTitle} revision ${packetRevision} was explicitly approved for ${docPrepEstateLabel(row)} after verified artifact readback.`,
    "ready",
    false,
    { row, source: flow.title }
  );
  return approval;
}

function closingPacketControlHtml(row = selectedRow()) {
  const dossier = dossierForRow(row);
  const packet = packetArtifactForRow(row, "closing-docs");
  const blockers = selectedClosingBlockers(row, dossier);
  const exportReady = selectedClosingTemplates(row).length > 0 && blockers.length === 0 && assetPhaseComplete(row, "title-clearance") && assetPhaseComplete(row, "seller-approval");
  return `
    <div class="docprep-run-actions">
      <button class="docprep-main-run-button" type="button" data-generate-closing-pdf ${exportReady ? "" : "disabled"}>Generate Closing PDF</button>
      ${packet?.artifactUrl ? `<a class="text-link" href="${escapeHtml(packet.artifactUrl)}" target="_blank" rel="noopener">Open PDF</a>` : ""}
    </div>
  `;
}

function renderDocPrepRunSurfaces() {
  renderCurrentLoopView();
  renderRail();
}

function snapshotFullDiscoveryOutput(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const packetKey = `${flowId}:${row?.id || ""}`;
  const documentRecords = docsForFlow(row, dossierForRow(row), flowId).map((doc) => {
    const key = documentStorageKey(row, doc.id);
    return {
      key,
      present: Object.prototype.hasOwnProperty.call(state.documentFiles, key),
      value: state.documentFiles[key],
    };
  });
  return {
    packetKey,
    packetPresent: Object.prototype.hasOwnProperty.call(state.packetArtifacts, packetKey),
    packet: state.packetArtifacts[packetKey],
    exportResultPresent: Object.prototype.hasOwnProperty.call(state, "exportResult"),
    exportResult: state.exportResult,
    documentRecords,
  };
}

function restoreFullDiscoveryOutput(snapshot) {
  if (!snapshot) return;
  if (snapshot.packetPresent) state.packetArtifacts[snapshot.packetKey] = snapshot.packet;
  else delete state.packetArtifacts[snapshot.packetKey];
  snapshot.documentRecords.forEach((record) => {
    if (record.present) state.documentFiles[record.key] = record.value;
    else delete state.documentFiles[record.key];
  });
  if (snapshot.exportResultPresent) state.exportResult = snapshot.exportResult;
  else delete state.exportResult;
  storageSetItem(documentFilesStateKey, JSON.stringify(documentFilesPersistenceSnapshot(state.documentFiles)), { sync: false });
}

function stopFullDiscoveryRun(row = selectedRow(), flowId = "discovery", { silent = false } = {}) {
  if (!row) return;
  const flow = docPrepFlow(flowId);
  setDocPrepRunState(row, flowId, "");
  pauseDocPrepStream(row, flowId);
  if (!silent) {
    document.getElementById("topStatus").textContent = `${docPrepEstateLabel(row)} ${flow.shortTitle} run stopped.`;
    addShellEvent(`${flow.shortTitle} stopped`, `${docPrepEstateLabel(row)} ${flow.shortTitle} was stopped before the next phase completed.`, "review", false, { row, source: flow.title });
  }
  renderDocPrepRunSurfaces();
}

async function finishFullDiscoveryRun(row = selectedRow(), flowId = "discovery", finalPhase = null, options = {}) {
  if (!row) return;
  const flow = docPrepFlow(flowId);
  const previousOutput = snapshotFullDiscoveryOutput(row, flowId);
  document.getElementById("topStatus").textContent = `Building and verifying the ${flow.shortTitle} PDF for ${docPrepEstateLabel(row)}...`;
  let packet;
  try {
    packet = await generatePacketPreview(row, null, { flowId, render: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The packet export or readback did not complete.";
    restoreFullDiscoveryOutput(previousOutput);
    if (!docPrepMainRunActive(row, flowId)) return;
    setDocPrepRunState(row, flowId, "");
    if (finalPhase) setDocPrepStreamPhase(row, flowId, finalPhase, "blocked", message);
    document.getElementById("topStatus").textContent = `${flow.shortTitle} packet verification blocked. ${message}`;
    addShellEvent(`${flow.shortTitle} packet blocked`, `${message} The prior active output remains unchanged.`, "blocked", true, { row, source: flow.title });
    renderDocPrepRunSurfaces();
    return;
  }
  if (!packet?.verification?.verified || !docPrepMainRunActive(row, flowId)) {
    const message = Array.isArray(state.exportResult?.blockers) && state.exportResult.blockers.length
      ? state.exportResult.blockers.join(" ")
      : "The packet did not pass artifact and storage readback verification.";
    restoreFullDiscoveryOutput(previousOutput);
    if (!docPrepMainRunActive(row, flowId)) return;
    setDocPrepRunState(row, flowId, "");
    if (finalPhase) setDocPrepStreamPhase(row, flowId, finalPhase, "blocked", message);
    document.getElementById("topStatus").textContent = `${flow.shortTitle} packet verification blocked. ${message}`;
    addShellEvent(`${flow.shortTitle} packet blocked`, `${message} No document was marked complete.`, "blocked", true, { row, source: flow.title });
    renderDocPrepRunSurfaces();
    return;
  }
  const previousFlowState = normalizeDocPrepFlowState(flowId, docPrepFlowState(row, flowId));
  const previousDiscoveryCompleted = new Set(state.discoveryCompleted);
  if (finalPhase) {
    markDocPrepPhaseComplete(row, flowId, finalPhase.id, { persist: false });
    setDocPrepStreamPhase(row, flowId, finalPhase, "complete");
  }
  const linkedCount = linkGeneratedDocPrepPackets(row, flowId, {
    correctionNote: options.correctionNote,
    syncWorkspace: false,
  });
  const auditBaseRevision = state.workspaceStateRevisions[docPrepEstateStateKey];
  let auditEntry;
  try {
    auditEntry = await verifyGeneratedPacketAuditReadback(row, flowId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canonicalStateAdvanced = state.workspaceStateRevisions[docPrepEstateStateKey] !== auditBaseRevision;
    if (!canonicalStateAdvanced) docPrepEstateRecord(row)[flowId] = previousFlowState;
    state.discoveryCompleted = previousDiscoveryCompleted;
    restoreFullDiscoveryOutput(previousOutput);
    persistDiscoveryState({ syncWorkspace: false });
    setDocPrepRunState(row, flowId, "");
    if (finalPhase) setDocPrepStreamPhase(row, flowId, finalPhase, "blocked", message);
    document.getElementById("topStatus").textContent = `${flow.shortTitle} packet audit blocked. ${message}`;
    addShellEvent(`${flow.shortTitle} audit blocked`, `The local PDF passed artifact verification, but ${message.toLowerCase()}`, "blocked", true, { row, source: flow.title });
    renderDocPrepRunSurfaces();
    return;
  }
  setDocPrepRunState(row, flowId, "");
  completeDocPrepStream(row, flowId, linkedCount);
  const finalIndex = Math.max(0, docPrepPhases(flowId).length - 1);
  setDocPrepPhaseIndex(row, flowId, finalIndex, { persist: false });
  persistDiscoveryState({ syncWorkspace: false });
  storageSetItem(documentFilesStateKey, JSON.stringify(documentFilesPersistenceSnapshot(state.documentFiles)));
  document.getElementById("topStatus").textContent = `${docPrepEstateLabel(row)} ${flow.shortTitle} run complete. The verified PDF is ready in HeirRight.`;
  addShellEvent(
    `${flow.shortTitle} complete`,
    `${docPrepEstateLabel(row)} completed ${flow.shortTitle} revision ${auditEntry.packetRevision} locally. One verified PDF contains ${linkedCount} reviewed packet section${linkedCount === 1 ? "" : "s"}.${auditEntry.correctionNote ? " The reviewed correction note is saved with this revision." : ""}`,
    "ready",
    false,
    { row, source: flow.title }
  );
  renderDocPrepRunSurfaces();

  if (flow.id !== "discovery") return;
  if (!googleWorkspaceDeliveryReady()) {
    document.getElementById("topStatus").textContent = "Discovery is complete in HeirRight. Connect Google Workspace when you are ready to place the verified PDF in Drive.";
    addShellEvent("Google setup available", "The verified Discovery PDF is complete in HeirRight. Connect Google Workspace and choose a Drive folder when the team is ready for delivery.", "review", false, { row, source: flow.title });
    renderDocPrepRunSurfaces();
    return;
  }
  document.getElementById("topStatus").textContent = "Discovery is complete in HeirRight. Send the verified packet to Google Workspace from Completion when the team is ready.";
  addShellEvent("Google handoff ready", "The verified Discovery PDF remains local until an operator explicitly sends it from the Completion rail.", "review", false, { row, source: flow.title });
  renderDocPrepRunSurfaces();
}

async function advanceFullDiscoveryFromResults(row = selectedRow(), flowId = state.activeDocPrepFlow, phaseIndex = 0, options = {}) {
  if (!row) return;
  const phases = docPrepPhases(flowId);
  for (let index = phaseIndex; index < phases.length; index += 1) {
    if (!docPrepMainRunActive(row, flowId)) return;
    const phase = phases[index];
    setDocPrepPhaseIndex(row, flowId, index, { persist: false });
    setDocPrepStreamPhase(row, flowId, phase, "writing");
    persistDiscoveryState({ syncWorkspace: false });
    document.getElementById("topStatus").textContent = `${phase.label} is validating saved evidence for ${docPrepEstateLabel(row)}.`;
    renderDocPrepRunSurfaces();
    const blocker = docPrepPhaseBlocker(row, flowId, phase);
    if (blocker) {
      setDocPrepRunState(row, flowId, "");
      setDocPrepStreamPhase(row, flowId, phase, "blocked", blocker);
      document.getElementById("topStatus").textContent = blocker;
      addShellEvent(`${phase.label} needs review`, blocker, "blocked", true, { row, source: docPrepFlow(flowId).title });
      renderDocPrepRunSurfaces();
      return;
    }
    if (index === phases.length - 1) {
      await finishFullDiscoveryRun(row, flowId, phase, options);
      return;
    }
    const evidenceComplete = assetPhaseComplete(row, phase.id);
    if (!evidenceComplete) {
      const message = `${phase.label} did not return complete saved evidence, so ${docPrepFlow(flowId).shortTitle} stopped before packet generation.`;
      setDocPrepRunState(row, flowId, "");
      setDocPrepStreamPhase(row, flowId, phase, "blocked", message);
      document.getElementById("topStatus").textContent = message;
      addShellEvent(`${phase.label} needs review`, message, "blocked", true, { row, source: docPrepFlow(flowId).title });
      renderDocPrepRunSurfaces();
      return;
    }
    markDocPrepPhaseComplete(row, flowId, phase.id, { persist: false });
    setDocPrepStreamPhase(row, flowId, phase, "complete");
    addShellEvent(`${phase.label} complete`, `${phase.summary} Current saved evidence cleared this stage.`, "ready", false, { row, source: docPrepFlow(flowId).title });
  }
}

async function runAutonomousDiscoverySources(row = selectedRow()) {
  if (!row) return { ok: false, message: "Select an estate before running Discovery." };
  const key = assetDiscoveryKey(row);
  const previousCapture = cloneSourceCaptureRecord(state.sourceCaptures[key]);
  const capture = {
    ...(state.sourceCaptures[key] ?? {}),
    assetKey: key,
    leadId: row.id,
    owner: row.owner || row.title,
    address: row.address,
    capturedAt: new Date().toISOString(),
    capturedBy: state.session?.user?.email || "team"
  };
  try {
    const result = await postJson("/api/discovery/external-source-run", externalSourceRunPayload(row, capture, key));
    if (result.persistence?.readbackStatus !== "verified") {
      throw new Error("Source evidence returned, but the shared Discovery File did not pass storage readback. Retry before continuing.");
    }
    applyExternalSourceRunResult(row, capture, result);
    persistAssetDiscoveryState();
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The source search could not run.";
    state.sourceCaptures[key] = {
      ...(previousCapture ?? {}),
      sourceApiRun: {
        ok: false,
        mode: "external_source_run",
        runId: "",
        generatedAt: new Date().toISOString(),
        sourceSummaries: [],
        blockers: [message],
        message
      },
      updatedAt: Date.now()
    };
    persistAssetDiscoveryState();
    return { ok: false, message };
  }
}

async function hydratePersistedDiscoveryFile(row = selectedRow()) {
  if (!row || isDemoEstateImport(row)) return null;
  const key = assetDiscoveryKey(row);
  await Promise.all([hydrateCanonicalIdiImport(row), hydrateSupportingDocuments(row)]);
  try {
    const response = await fetch(`/api/discovery/file?estateId=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (response.status === 404) return state.idiImports[key] || null;
    const record = await response.json().catch(() => ({}));
    const hasCanonicalSourceRecord = record?.capture && typeof record.capture === "object"
      && Array.isArray(record.sourceFacts);
    if (!response.ok || !record?.ok || record.readbackStatus !== "verified" || (!record.dossier && !hasCanonicalSourceRecord)) return null;
    const current = state.sourceCaptures[key] ?? {};
    const currentAt = Date.parse(current.sourceApiRun?.generatedAt || "") || 0;
    const storedAt = Date.parse(record.generatedAt || "") || 0;
    if (currentAt > storedAt) {
      return current;
    }
    state.sourceCaptures[key] = {
      ...current,
      ...(record.capture && typeof record.capture === "object" ? record.capture : {}),
      sourceFacts: Array.isArray(record.sourceFacts) ? record.sourceFacts : [],
      ...(record.dossier && typeof record.dossier === "object" ? { dossier: record.dossier } : {}),
      taxCollectorReceiptRun: record.taxCollectorReceiptRun || null,
      sourceApiRun: {
        ok: !Array.isArray(record.blockers) || record.blockers.length === 0,
        mode: record.mode || (record.dossier ? "external_source_run" : "source_capture"),
        runId: record.revision || record.runId || "",
        generatedAt: record.generatedAt || new Date().toISOString(),
        sourceSummaries: Array.isArray(record.sourceSummaries) ? record.sourceSummaries : [],
        sourceRunProof: record.sourceRunProof && typeof record.sourceRunProof === "object" ? record.sourceRunProof : null,
        blockers: Array.isArray(record.blockers) ? record.blockers : [],
        persistence: { stored: true, readbackStatus: record.readbackStatus },
        message: record.dossier
          ? "Shared Discovery File loaded with verified storage readback."
          : "Saved source capture loaded with verified Discovery File readback."
      },
      updatedAt: Date.now()
    };
    const auditedPacketIds = new Set((existingDocPrepFlowState(row, state.activeDocPrepFlow)?.generatedPackets || [])
      .filter((item) => item?.readbackStatus === "verified")
      .map((item) => String(item?.artifactId || ""))
      .filter(Boolean));
    const packetReference = Array.isArray(record.packetArtifacts)
      ? record.packetArtifacts.find((item) => (
        item?.flow === state.activeDocPrepFlow
        && item?.readbackStatus === "verified"
        && auditedPacketIds.has(String(item?.artifactId || ""))
      ))
      : null;
    if (packetReference?.artifactId && packetReference?.artifactUrl) {
      const hydratedPacket = {
        ok: true,
        flow: packetReference.flow,
        estateId: key,
        estateIds: [key],
        contentType: packetReference.contentType,
        artifactUrl: packetReference.artifactUrl,
        sections: packetReference.sections || [],
        documentArtifacts: packetReference.documentArtifacts || [],
        packetPersistence: [{ estateId: key, stored: true, readbackStatus: "verified" }],
        artifact: {
          kind: "single_pdf",
          artifactId: packetReference.artifactId,
          contentType: packetReference.contentType,
          contentHash: packetReference.contentHash,
          expiresAt: packetReference.expiresAt,
          url: packetReference.artifactUrl,
          sections: packetReference.sections || []
        }
      };
      try {
        state.packetArtifacts[`${packetReference.flow}:${row.id}`] = await verifyPacketArtifact(hydratedPacket, key);
        linkGeneratedDocPrepPackets(row, packetReference.flow);
        await hydrateCurrentPacketApproval(row, packetReference.flow);
      } catch {}
    }
    persistAssetDiscoveryState();
    if (state.activeView === "dossiers" && selectedRow()?.id === row.id) {
      renderDossiersView();
      renderRail();
    }
    return state.sourceCaptures[key];
  } catch {
    return null;
  }
}

async function runFullDiscovery(row = selectedRow(), source = null, flowId = state.activeDocPrepFlow, options = {}) {
  if (!row) return;
  const flow = docPrepFlow(flowId);
  const stopBlocker = canonicalStopBlocker(row, `${flow.shortTitle} run`);
  if (stopBlocker) {
    setDocPrepRunState(row, flow.id, "");
    document.getElementById("topStatus").textContent = stopBlocker;
    addShellEvent(`${flow.shortTitle} blocked by stop rule`, stopBlocker, "blocked", true, { row, source: flow.title });
    renderDocPrepRunSurfaces();
    return;
  }
  const correctionNote = normalizePacketCorrectionNote(options.correctionNote);
  if (docPrepFlowIsComplete(row, flow.id) && correctionNote.length < 8) {
    document.getElementById("topStatus").textContent = `${flow.shortTitle} needs a correction note before replacing its active packet.`;
    addShellEvent(`${flow.shortTitle} rerun blocked`, "Add a short correction note before replacing the active verified packet.", "blocked", true, { row, source: flow.title });
    return;
  }
  if (isLegacyPlaceholderEstateImport(row)) {
    nudgeDeniedAction(source, `${flow.shortTitle} blocked`, "A legacy placeholder estate stays isolated until it is removed from the shared workspace.", { pill: true, source: "docprep-run" });
    return;
  }
  state.discoveryOpen = false;
  state.docPrepManualFix = null;
  state.railMode = "dossier";
  ensureDocPrepStarted(row, flowId, { persist: false });
  setActiveDocPrepFlow(flowId, { persist: false, rerender: false });
  setDocPrepRunState(row, flowId, "running");
  beginDocPrepStream(row, flowId);
  addShellEvent(
    `${flow.shortTitle} started`,
    `${docPrepEstateLabel(row)} is validating each ${flow.shortTitle} stage against source results and saved evidence.${correctionNote ? " The reviewed correction note will be stored with the new packet revision." : ""}`,
    "review",
    false,
    { row, source: flow.title }
  );
  if (flow.id === "discovery") {
    const savedSourceResult = verifiedSourceCaptureResult(row);
    document.getElementById("topStatus").textContent = savedSourceResult
      ? `Validating the saved public-source capture for ${docPrepEstateLabel(row)}...`
      : `Searching configured public sources for ${docPrepEstateLabel(row)}...`;
    renderDocPrepRunSurfaces();
    const sourceRun = savedSourceResult
      ? { ok: true, result: savedSourceResult, reused: true }
      : await runAutonomousDiscoverySources(row);
    if (!docPrepMainRunActive(row, flow.id)) return;
    if (!sourceRun.ok) {
      setDocPrepRunState(row, flow.id, "");
      const phase = currentDiscoveryPhase(flow.id, row) || docPrepPhases(flow.id)[0];
      setDocPrepStreamPhase(row, flow.id, phase, "blocked", sourceRun.message);
      document.getElementById("topStatus").textContent = `Discovery source search blocked: ${sourceRun.message}`;
      addShellEvent("Discovery source search blocked", sourceRun.message, "blocked", true, { row, source: flow.title });
      renderDocPrepRunSurfaces();
      return;
    }
    const blockerCount = Array.isArray(sourceRun.result?.blockers) ? sourceRun.result.blockers.length : 0;
    addShellEvent(
      sourceRun.reused ? "Verified Discovery sources reused" : "Discovery sources checked",
      sourceRun.reused
        ? `The saved public-source capture passed shared Discovery File readback. ${blockerCount ? `${blockerCount} review item${blockerCount === 1 ? "" : "s"} remain visible in the packet workflow.` : "No source blockers remain."}`
        : blockerCount
          ? `${blockerCount} source review item${blockerCount === 1 ? "" : "s"} remain visible in the packet workflow.`
          : "Configured public sources returned evidence for the Discovery review.",
      blockerCount ? "blocked" : "ready",
      true,
      { row, source: flow.title }
    );
  }
  const firstIndex = docPrepPhases(flowId).findIndex((phase) => !docPrepPhaseMarkedComplete(row, flowId, phase.id));
  setRailOpen(true, source);
  await advanceFullDiscoveryFromResults(row, flowId, firstIndex < 0 ? 0 : firstIndex, { correctionNote });
}

function toggleFullDiscoveryRun(source = null, flowId = state.activeDocPrepFlow) {
  const row = selectedRow();
  if (!row) return;
  const flow = docPrepFlow(flowId);
  if (docPrepMainRunActive(row, flow.id)) {
    stopFullDiscoveryRun(row, flow.id);
    return;
  }
  if (docPrepFlowIsComplete(row, flow.id)) {
    openDocPrepRerunReview(flow.id, source);
    return;
  }
  runFullDiscovery(row, source, flow.id);
}

function dossierChecklistHtml(docs, { compact = false } = {}) {
  return `
    <div class="dossier-checklist" role="list">
      ${docs.map((doc, index) => {
        const workflow = dossierDocWorkflowState(doc, index);
        return `
          <button class="dossier-check-row" type="button" role="listitem" data-dossier-doc="${escapeHtml(doc.id)}" data-state="${escapeHtml(workflow.state)}">
            ${dossierChecklistStatusHtml(workflow)}
            <span>
              <span class="dossier-check-title">${escapeHtml(doc.title)}</span>
              <span class="dossier-check-copy">${escapeHtml(compact ? workflow.copy : `${workflow.copy} ${doc.copy}`)}</span>
            </span>
            <span class="dossier-check-action">${escapeHtml(workflow.action)}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function todayLongLabel() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function processRunDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function estateDiscoveryLastRunLabel(row = selectedRow()) {
  const flowState = existingDocPrepFlowState(row, "discovery");
  const runDate = processRunDateLabel(flowState?.updatedAt || flowState?.startedAt);
  return runDate ? `Last ran ${runDate}` : "Not run yet";
}

function processProgressDots(done, total) {
  const safeTotal = Math.max(1, Math.min(14, Number(total) || 1));
  const safeDone = Math.max(0, Math.min(safeTotal, Number(done) || 0));
  return `<span class="process-progress-dots" aria-label="${safeDone} of ${safeTotal} complete">${Array.from({ length: safeTotal }, (_item, index) => `<i class="${index < safeDone ? "is-filled" : ""}"></i>`).join("")}</span>`;
}

function documentStorageKey(row = selectedRow(), docId = "") {
  return `${assetDiscoveryKey(row)}:${docId || "document"}`;
}

function documentFileRecord(docId, row = selectedRow()) {
  const record = state.documentFiles[documentStorageKey(row, docId)] ?? null;
  if (!record || record.readbackStatus !== "verified" || !record.artifactId || !record.artifactUrl || !record.contentHash) return null;
  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) return null;
  return record;
}

function documentFileLabel(record) {
  if (!record) return "";
  const size = record.size ? ` · ${humanFileSize(record.size)}` : "";
  return `${record.name}${size}`;
}

function humanFileSize(size) {
  const bytes = Number(size) || 0;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function selectedDocumentFileCount(row = selectedRow()) {
  const prefix = `${assetDiscoveryKey(row)}:`;
  return Object.entries(state.documentFiles).filter(([key, record]) => key.startsWith(prefix) && record?.readbackStatus === "verified" && record?.artifactId && record?.artifactUrl && record?.contentHash).length;
}

function selectedDocumentStorageSize(row = selectedRow()) {
  const prefix = `${assetDiscoveryKey(row)}:`;
  return Object.entries(state.documentFiles)
    .filter(([key, record]) => key.startsWith(prefix) && record?.readbackStatus === "verified" && record?.artifactId && record?.artifactUrl && record?.contentHash)
    .reduce((sum, [, record]) => sum + (Number(record?.size) || 0), 0);
}

function documentPrepStats(row = selectedRow(), dossier = dossierForRow(row), flowId = state.activeDocPrepFlow) {
  const docs = docsForFlow(row, dossier, flowId);
  const linked = docs.filter((doc) => documentFileRecord(doc.id, row)).length;
  return {
    total: docs.length,
    linked,
    missing: Math.max(0, docs.length - linked),
    versions: Object.values(state.documentFiles).filter((record) => Number(record?.version || 1) > 1).length,
    size: selectedDocumentStorageSize(row)
  };
}

function processActivityTime(value) {
  const numeric = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(numeric) ? numeric : 0;
}

function docPrepDocumentActivityAt(row, flowId) {
  if (!row) return 0;
  return docsForFlow(row, dossierForRow(row), flowId).reduce((latest, doc) => {
    const record = documentFileRecord(doc.id, row);
    return Math.max(latest, processActivityTime(record?.linkedAt || record?.updatedAt));
  }, 0);
}

function docPrepFlowActivityAt(row, flowId) {
  const flowState = existingDocPrepFlowState(row, flowId);
  return Math.max(
    processActivityTime(flowState?.updatedAt),
    processActivityTime(flowState?.startedAt),
    docPrepDocumentActivityAt(row, flowId)
  );
}

function handoffReviewActivityAt(row) {
  const exportState = row ? state.closingExportState?.[assetDiscoveryKey(row)] : null;
  return Math.max(
    processActivityTime(exportState?.updatedAt),
    docPrepFlowActivityAt(row, "closing-docs"),
    state.queueIds.has(row?.id) ? 1 : 0
  );
}

function activeProcessActivityAt(row, processId) {
  if (processId === "estate-discovery") return docPrepFlowActivityAt(row, "discovery");
  if (processId === "closing-docs") return docPrepFlowActivityAt(row, "closing-docs");
  if (processId === "handoff-review") return handoffReviewActivityAt(row);
  return 0;
}

function lastActiveProcessRow(processId, fallbackRow = selectedRow()) {
  const ranked = state.rows
    .map((row) => ({ row, at: activeProcessActivityAt(row, processId) }))
    .filter((item) => item.at > 0)
    .sort((a, b) => b.at - a.at);
  return ranked[0]?.row || fallbackRow || null;
}

function dashboardActiveProcessEstateLabel(fallbackRow = selectedRow()) {
  const ranked = ["estate-discovery", "closing-docs", "handoff-review"]
    .map((processId) => {
      const row = lastActiveProcessRow(processId, fallbackRow);
      return { row, at: activeProcessActivityAt(row, processId) };
    })
    .filter((item) => item.row && item.at > 0)
    .sort((a, b) => b.at - a.at);
  const row = ranked[0]?.row || fallbackRow;
  return row ? `Last active: ${docPrepEstateLabel(row)}` : "Load a lead packet to start";
}

function processSummaries(row = selectedRow(), dossier = dossierForRow(row)) {
  const discoveryRow = lastActiveProcessRow("estate-discovery", row);
  const closingRow = lastActiveProcessRow("closing-docs", row);
  const handoffRow = lastActiveProcessRow("handoff-review", row);
  const discoveryDossier = dossierForRow(discoveryRow);
  const closingDossier = dossierForRow(closingRow);
  const handoffDossier = dossierForRow(handoffRow);
  const docs = dossierDocuments(handoffRow, handoffDossier);
  const discoveryStats = documentPrepStats(discoveryRow, discoveryDossier, "discovery");
  const closingStats = documentPrepStats(closingRow, closingDossier, "closing-docs");
  const discoveryDone = docPrepPhases("discovery").filter((phase) => phaseIsComplete(phase.id, discoveryRow, "discovery")).length;
  const selectedClosing = selectedClosingTemplates(closingRow);
  const closingTemplateReady = selectedClosing.filter((template) => closingTemplateBlockers(template, closingRow, closingDossier).length === 0).length;
  const reviewTasks = taskCount(handoffDossier ?? {});
  const closingDocs = dossierDocuments(closingRow, closingDossier).filter((doc) => documentFlowMatches(doc, "closing-docs"));
  const readyDocs = docs.filter((doc) => !/blocked|locked|open/i.test(doc.status || "")).length;
  return [
    {
      id: "estate-discovery",
      title: "Estate Discovery",
      rowId: discoveryRow?.id || "",
      estate: docPrepEstateLabel(discoveryRow),
      done: discoveryStats.linked,
      total: discoveryStats.total,
      tag: "",
      due: `${discoveryDone}/${docPrepPhases("discovery").length} Discovery steps`,
      status: estateDiscoveryLastRunLabel(discoveryRow),
      ready: discoveryStats.missing === 0 && discoveryDone >= docPrepPhases("discovery").length
    },
    {
      id: "closing-docs",
      title: "Closing Prep",
      rowId: closingRow?.id || "",
      estate: docPrepEstateLabel(closingRow),
      done: closingTemplateReady,
      total: selectedClosing.length || 1,
      tag: docPrepFlow("closing-docs").tag,
      due: `${Math.max(0, closingDocs.length - closingStats.missing)}/${closingDocs.length} packet documents`,
      status: selectedClosing.length && closingTemplateReady >= selectedClosing.length ? "Ready to bundle" : selectedClosing.length ? `${closingTemplateReady}/${selectedClosing.length}` : "Choose forms",
      ready: selectedClosing.length > 0 && closingTemplateReady >= selectedClosing.length
    },
    {
      id: "handoff-review",
      title: "Export Review",
      rowId: handoffRow?.id || "",
      estate: docPrepEstateLabel(handoffRow),
      done: readyDocs,
      total: docs.length,
      tag: "Podio and Google prep",
      due: reviewTasks ? `${reviewTasks} review items` : "No open review items",
      status: queuedRows().length ? "Queued" : "Prep only",
      ready: queuedRows().length > 0
    }
  ];
}

function attentionItems(row = selectedRow(), dossier = dossierForRow(row)) {
  if (!row || !dossier) {
    return [
      {
        title: "Load the latest estate packet",
        copy: "The dashboard will show source tasks, missing documents, and export prep after the lead packet loads.",
        action: "Open Estates",
        view: "find-estates",
        urgent: true
      }
    ];
  }
  const stats = documentPrepStats(row, dossier);
  const missing = row.missing ?? buildMissingSections(dossier);
  const blockers = milestoneBlockers(dossier);
  const estateFileName = docPrepEstateLabel(row);
  const items = [];
  if (missing.length) {
    items.push({
      title: `${missing[0].short || missing[0].label} needs attention`,
      copy: estateFileName,
      action: "Review",
      view: "find-estates",
      urgent: true
    });
  }
  if (stats.missing) {
    items.push({
      title: `${stats.missing} dossier document${stats.missing === 1 ? "" : "s"} still missing`,
      copy: estateFileName,
      action: "Open",
      view: "dossiers",
      urgent: false
    });
  }
  if (blockers.length) {
    items.push({
      title: "Export remains prep only",
      copy: estateFileName,
      action: "View",
      view: "queue",
      urgent: false
    });
  }
  return items.slice(0, 2);
}

function dashboardActivityRows(row = selectedRow()) {
  const fileCount = selectedDocumentFileCount(row);
  const events = state.shellEvents
    .map((event) => {
      const next = clientFacingEvent(event);
      const userLabel = currentUserDisplayName();
      if (/\bopened$/i.test(next.title) && !next.title.toLowerCase().startsWith(userLabel.toLowerCase())) {
        next.title = `${userLabel} opened ${next.title.replace(/\s+opened$/i, "").trim() || "a file"}`;
      }
      return next;
    })
    .filter((event) => {
      const title = String(event.title || "").trim();
      const copy = String(event.copy || "").trim();
      return !(
        /^Workspace opened$/i.test(title) ||
        / selected$/i.test(title) ||
        /^Doc Prep Prepared$/i.test(title) ||
        /^\d+\s+supporting documents?\s+linked$/i.test(title) ||
        /navigation, review settings/i.test(copy) ||
        /opens the public-record lead list/i.test(copy) ||
        /workspace selected/i.test(copy)
      );
    });
  const documentEvent = fileCount > 0 ? [{
    title: `${fileCount} Supporting Document${fileCount === 1 ? "" : "s"} linked`,
    copy: "Estate Discovery and Closing Prep use these documents throughout Doc Prep.",
    tone: "check",
    at: docPrepDocumentActivityAt(row, "discovery") || docPrepDocumentActivityAt(row, "closing-docs") || Date.now()
  }] : [];
  return [...events, ...documentEvent].slice(0, 6);
}

function recordLeadOpened(row, context = "Estate file") {
  if (!row) return;
  const target = row.leadName || row.title || "estate file";
  addShellEvent(`${currentUserDisplayName()} opened ${target}`, row.address || context, "route", false);
}

function documentRequirementStatus(doc, row = selectedRow()) {
  const record = documentFileRecord(doc.id, row);
  const workflow = dossierDocWorkflowState(doc);
  if (record) return { linked: true, label: documentFileLabel(record), action: "Run", recordSource: record.source };
  return {
    linked: false,
    label: workflow.state === "complete" ? "Generate and verify the PDF before linking this completed section." : doc.copy,
    action: "Run"
  };
}

function documentRequirementHtml(doc, row = selectedRow()) {
  const file = documentRequirementStatus(doc, row);
  const workflow = dossierDocWorkflowState(doc);
  const packet = packetArtifactForRow(row);
  const verifiedPacketReady = Boolean(packet?.verification?.verified && packet?.verification?.readbackStatus === "verified");
  const automation = documentAutomationState(doc.id, row);
  const running = automation === "processing";
  const actionLabel = running ? "Stop" : "Run";
  const statusState = automation || (workflow.state === "active" ? "active" : file.linked ? "complete" : workflow.state === "blocked" ? "blocked" : "pending");
  const statusLabel = automation === "processing" ? "Processing" : workflow.state === "active" ? "Working" : file.linked ? "Complete" : workflow.label;
  return `
    <article class="document-requirement ${file.linked ? "is-linked" : ""} ${state.selectedDossierDocId === doc.id ? "is-previewed" : ""}" data-document-row="${escapeHtml(doc.id)}" data-document-preview-card="${escapeHtml(doc.id)}" role="group" tabindex="0" aria-label="${escapeHtml(doc.title)}" aria-description="Press Enter or Space to preview this document in the dossier rail.">
      <button class="file-drop-icon" type="button" data-document-action="add" data-document-id="${escapeHtml(doc.id)}" aria-label="${escapeHtml(actionLabel)} ${escapeHtml(doc.title)}">${linearStatusIconHtml(statusState, statusLabel)}</button>
      <span class="document-copy">
        <strong>${escapeHtml(doc.title)}</strong>
        <span>${escapeHtml(file.label)}</span>
      </span>
      <span class="document-actions">
        <span class="document-type-pill">${escapeHtml(doc.type)}</span>
        <button class="btn icon-only document-icon-button" type="button" data-document-action="preview" data-document-id="${escapeHtml(doc.id)}" aria-label="Preview ${escapeHtml(doc.title)}" title="Preview">${nucleoIcon("eye", 16)}</button>
        <button class="btn primary solvys-liquid-glass document-run-button ${running ? "is-running" : ""}" type="button" data-document-action="add" data-document-id="${escapeHtml(doc.id)}">${escapeHtml(actionLabel)}</button>
            <span class="headless-menu-wrap" data-ui-menu>
              <button class="btn icon-only beui-menu-trigger" type="button" aria-haspopup="menu" aria-expanded="false" data-ui-menu-button aria-label="Document actions for ${escapeHtml(doc.title)}">${nucleoIcon("sliders", 16)}</button>
          <span class="headless-menu beui-menu t-dropdown" data-beui-menu-surface data-origin="top-right" role="menu" hidden>
            <button class="beui-menu-item" type="button" role="menuitem" data-ui-menu-action="preview" data-document-id="${escapeHtml(doc.id)}">${nucleoIcon("eye", 15)}<span>Preview</span></button>
            ${verifiedPacketReady ? `<button class="beui-menu-item" type="button" role="menuitem" data-ui-menu-action="link-generated" data-document-id="${escapeHtml(doc.id)}">${nucleoIcon("batch-tray", 15)}<span>Use verified packet</span></button>` : ""}
            <button class="beui-menu-item" type="button" role="menuitem" data-ui-menu-action="replace" data-document-id="${escapeHtml(doc.id)}">${nucleoIcon("packet-clock", 15)}<span>Save new version</span></button>
            ${file.linked && file.recordSource === "supporting_document" ? `<button class="beui-menu-item" type="button" role="menuitem" data-ui-menu-action="remove" data-document-id="${escapeHtml(doc.id)}">${nucleoIcon("trash", 15)}<span>Remove supporting file</span></button>` : ""}
            <button class="beui-menu-item" type="button" role="menuitem" data-ui-menu-action="queue" data-document-id="${escapeHtml(doc.id)}">${nucleoIcon("flag", 15)}<span>Stage for export</span></button>
          </span>
        </span>
        <span class="document-action-status">${linearStatusIconHtml(statusState, statusLabel)}</span>
      </span>
    </article>
  `;
}

function wireDocumentPreviewCards(root = document) {
  root.querySelectorAll("[data-document-preview-card]").forEach((card) => {
    if (card.dataset.documentPreviewWired) return;
    card.dataset.documentPreviewWired = "true";
    const preview = () => {
      const docId = card.dataset.documentPreviewCard;
      if (!docId) return;
      previewDossierDocument(docId);
    };
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea, [contenteditable='true'], [data-ui-menu]")) return;
      preview();
    });
    card.addEventListener("keydown", (event) => {
      if (event.target !== card || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      preview();
    });
  });
}

function currentProcessFacts(row = selectedRow(), dossier = dossierForRow(row)) {
  const stats = documentPrepStats(row, dossier);
  return [
    ["Source", formatCountyName(row?.county || claimValue(dossier?.property?.county, "County needs review"))],
    ["Created", formatPacketDate(dossier?.generatedAt ?? state.data?.generatedAt ?? Date.now())],
    ["Deadline", row?.next || "Resolve review flags"],
    ["Progress", `${stats.linked} of ${stats.total} files`]
  ];
}

function chatgptWorkDelivery(packet = null) {
  if (packet?.googleDelivery?.readbackStatus === "verified") return packet.googleDelivery;
  return (packet?.routes || []).find((route) => route?.route === "google" && route?.readbackStatus === "verified") || null;
}

function chatgptWorkBrief(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flow = docPrepFlow(flowId);
  const packet = packetArtifactForRow(row, flow.id);
  const delivery = chatgptWorkDelivery(packet);
  const estate = docPrepEstateLabel(row) || "the selected estate";
  const packetLocation = delivery?.fileUrl
    || packet?.artifactUrl
    || (delivery?.destination ? `Google Drive folder: ${delivery.destination}` : "the verified packet in HeirRight");
  return [
    "Open ChatGPT Work and prepare a review-only HeirRight Discovery follow-up.",
    `Estate: ${estate}`,
    `Workflow: ${flow.title}`,
    `Verified packet: ${packetLocation}`,
    "Use the verified PDF as the source of truth. Identify missing source-backed facts, produce a concise review memo, and preserve every uncertainty as a question for the operator.",
    "Do not contact anyone, spend money, alter a CRM, create a legal document, or make any external change. Ask for approval before any action outside this review memo. Do not infer facts that are not in the packet."
  ].join("\n\n");
}

function chatgptWorkHandoffHtml(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flow = docPrepFlow(flowId);
  const packet = packetArtifactForRow(row, flow.id);
  const delivery = chatgptWorkDelivery(packet);
  const workspaceReady = googleWorkspaceDeliveryReady();
  const packetReady = Boolean(packet?.verification?.verified && packet?.verification?.readbackStatus === "verified");
  const delivered = Boolean(delivery?.readbackStatus === "verified");
  const location = String(delivery?.destination || state.googleWorkspace?.destinationName || "selected Drive folder");
  const status = !packetReady
    ? { tone: "review", label: "Packet needed", copy: "Complete Discovery to create the verified PDF that ChatGPT Work can use as review context." }
    : !workspaceReady
      ? { tone: "ready", label: "Local packet ready", copy: "The verified PDF is complete in HeirRight. Open ChatGPT Work now, or connect Google Workspace afterward to add a shared Drive destination." }
      : !delivered
        ? { tone: "review", label: "Ready to deliver", copy: "The verified PDF is ready. Deliver it to the selected Drive folder, then open ChatGPT Work with a prebuilt review brief." }
        : { tone: "ready", label: "Ready for Work", copy: `The verified PDF is in ${location}. Continuing to ChatGPT copies the review brief; choose Work and paste it to begin.` };
  const action = !packetReady
    ? ""
    : !workspaceReady
      ? `<span class="chatgpt-work-actions"><button class="btn" type="button" data-open-chatgpt-work="${escapeHtml(flow.id)}">Continue to ChatGPT Work</button>${packet?.artifactUrl ? `<a class="text-link" href="${escapeHtml(packet.artifactUrl)}" target="_blank" rel="noopener">Open packet</a>` : ""}<a class="text-link" href="/auth/login?integration=google-workspace">Set up Google</a></span>`
    : !delivered
      ? `<button class="btn" type="button" data-prepare-chatgpt-work="${escapeHtml(flow.id)}">Prepare for ChatGPT Work</button>`
      : `<span class="chatgpt-work-actions"><button class="btn" type="button" data-open-chatgpt-work="${escapeHtml(flow.id)}">Continue to ChatGPT Work</button>${delivery?.fileUrl ? `<a class="text-link" href="${escapeHtml(delivery.fileUrl)}" target="_blank" rel="noopener">Open packet</a>` : ""}</span>`;
  return `
    <section class="chatgpt-work-handoff" aria-label="ChatGPT Work handoff">
      <div class="chatgpt-work-head">
        <div>
          <p class="eyebrow">ChatGPT Work</p>
          <h4>Continue with the verified packet</h4>
        </div>
        ${statusPill(status.tone, status.label)}
      </div>
      <p class="copy">${escapeHtml(status.copy)}</p>
      ${action}
    </section>
  `;
}

async function copyPlainTextToClipboard(value) {
  const text = String(value || "");
  if (!text) throw new Error("The ChatGPT Work brief was empty.");
  if (globalThis.navigator?.clipboard?.writeText && window.isSecureContext) {
    try {
      await globalThis.navigator.clipboard.writeText(text);
      return;
    } catch {
      // Some managed browsers expose the Clipboard API but deny writes. Fall
      // through to the selected-text copy path before asking for manual copy.
    }
  }
  if (typeof document.execCommand !== "function") {
    const error = new Error("This browser does not allow HeirRight to write to the clipboard.");
    error.name = "ClipboardUnavailableError";
    throw error;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
  }
  if (!copied) {
    const error = new Error("This browser does not allow HeirRight to write to the clipboard.");
    error.name = "ClipboardUnavailableError";
    throw error;
  }
}

async function prepareChatgptWorkHandoff(row = selectedRow(), flowId = state.activeDocPrepFlow, source = null) {
  const flow = docPrepFlow(flowId);
  const stopBlocker = canonicalStopBlocker(row, "ChatGPT Work handoff");
  if (stopBlocker) throw new Error(stopBlocker);
  const packet = packetArtifactForRow(row, flow.id);
  requireCurrentUnexpiredPacket(row, flow.id, packet, "preparing the ChatGPT Work handoff");
  source?.setAttribute("aria-busy", "true");
  if (source) source.disabled = true;
  try {
    const delivery = chatgptWorkDelivery(packet);
    await copyPlainTextToClipboard(chatgptWorkBrief(row, flow.id));
    addShellEvent(
      "ChatGPT Work packet prepared",
      delivery
        ? `The verified ${flow.shortTitle} PDF is in ${delivery.destination || state.googleWorkspace?.destinationName || "Google Drive"}, and the review brief is copied to the clipboard.`
        : "The local verified packet is ready, and the review brief is copied to the clipboard. Attach or open the packet in ChatGPT Work before starting the review.",
      "ready",
      false,
      { row, source: "ChatGPT Work" }
    );
    document.getElementById("topStatus").textContent = "ChatGPT Work brief copied. Open Work, attach or open the verified packet, then paste the brief.";
    renderCurrentLoopView();
    return { delivery };
  } finally {
    source?.removeAttribute("aria-busy");
    if (source?.isConnected) source.disabled = false;
  }
}

async function openChatgptWorkHandoff(row = selectedRow(), flowId = state.activeDocPrepFlow, source = null) {
  const flow = docPrepFlow(flowId);
  const stopBlocker = canonicalStopBlocker(row, "ChatGPT Work handoff");
  if (stopBlocker) throw new Error(stopBlocker);
  const packet = packetArtifactForRow(row, flow.id);
  requireCurrentUnexpiredPacket(row, flow.id, packet, "continuing to ChatGPT Work");
  try {
    if (!chatgptWorkDelivery(packet)) {
      await prepareChatgptWorkHandoff(row, flow.id, source);
    } else {
      await copyPlainTextToClipboard(chatgptWorkBrief(row, flow.id));
    }
  } catch (error) {
    if (error?.name !== "ClipboardUnavailableError") throw error;
    openManualChatgptWorkHandoff(row, flow.id, chatgptWorkBrief(row, flow.id));
    return { manualCopyRequired: true };
  }
  continueToChatgptWork(row, flow.id);
  return { manualCopyRequired: false };
}

function continueToChatgptWork(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flow = docPrepFlow(flowId);
  addShellEvent("ChatGPT Work handoff ready", `The ${flow.shortTitle} review brief is copied. HeirRight is continuing to ChatGPT in this browser; choose Work, paste the brief, and keep external actions approval-gated.`, "ready", false, { row, source: "ChatGPT Work" });
  document.getElementById("topStatus").textContent = "ChatGPT Work review brief copied. Continuing to ChatGPT in this browser.";
  window.location.assign("https://chatgpt.com/");
}

let documentActionModalInvoker = null;
let documentActionModalReturnAction = "";
let documentActionModalBackground = [];

function setDocumentActionModalBackgroundInert(inert) {
  if (!inert) {
    documentActionModalBackground.forEach(({ element, ariaHidden, wasInert }) => {
      if (!element?.isConnected) return;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
      element.inert = wasInert;
    });
    documentActionModalBackground = [];
    return;
  }
  if (documentActionModalBackground.length) return;
  const modalMount = document.getElementById("documentActionModalMount");
  documentActionModalBackground = [...document.body.children]
    .filter((element) => element !== modalMount && element.tagName !== "SCRIPT")
    .map((element) => {
      const record = {
        element,
        ariaHidden: element.getAttribute("aria-hidden"),
        wasInert: Boolean(element.inert),
      };
      element.setAttribute("aria-hidden", "true");
      element.inert = true;
      return record;
    });
}

function openDocumentActionModal(docId, action = "add") {
  documentActionModalInvoker = document.activeElement?.focus ? document.activeElement : null;
  documentActionModalReturnAction = String(documentActionModalInvoker?.dataset?.railAction || "");
  state.documentActionModal = { open: true, docId, action };
  renderDocumentActionModal();
}

function openManualChatgptWorkHandoff(row, flowId, brief) {
  const activeElement = document.activeElement;
  const resolvedFlowId = String(flowId || state.activeDocPrepFlow);
  const packet = packetArtifactForRow(row, resolvedFlowId);
  documentActionModalInvoker = activeElement?.focus && activeElement !== document.body ? activeElement : null;
  documentActionModalReturnAction = "chatgpt-work";
  state.documentActionModal = {
    open: true,
    docId: null,
    action: "chatgpt-work",
    estateId: String(row?.id || ""),
    estateLabel: String(row?.leadName || row?.title || "original estate"),
    flowId: resolvedFlowId,
    packetArtifactId: String(packet?.artifact?.artifactId || packet?.verification?.artifactId || ""),
    packetRevision: currentPacketRevision(row, resolvedFlowId),
    brief: String(brief || ""),
  };
  document.getElementById("topStatus").textContent = "The review brief is selected. Copy it, then continue to ChatGPT in this browser.";
  renderDocumentActionModal();
}

function restoreDocumentActionModalFocus() {
  const invoker = documentActionModalInvoker;
  const returnAction = documentActionModalReturnAction;
  documentActionModalInvoker = null;
  documentActionModalReturnAction = "";
  const restore = () => {
    const currentAction = /^[a-z0-9-]+$/i.test(returnAction)
      ? document.querySelector(`[data-rail-action="${returnAction}"]`)
      : null;
    const shellFallback = document.getElementById("s38OpenRail");
    const railIsOpen = shellFallback?.getAttribute("aria-expanded") === "true";
    const invokerInRail = Boolean(invoker?.closest?.("#s38UnifiedRail"));
    const visibleInvoker = (!invokerInRail || railIsOpen) && invoker?.isConnected && invoker.getClientRects?.().length ? invoker : null;
    const visibleAction = railIsOpen && currentAction?.isConnected && currentAction.getClientRects?.().length ? currentAction : null;
    const target = visibleInvoker || visibleAction || shellFallback;
    target?.focus?.({ preventScroll: true });
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(restore);
  else restore();
}

function closeDocumentActionModal() {
  const closingChatgptHandoff = state.documentActionModal.action === "chatgpt-work";
  state.documentActionModal = { open: false, docId: null, action: "add" };
  renderDocumentActionModal();
  if (closingChatgptHandoff) {
    const topStatus = document.getElementById("topStatus");
    if (topStatus) topStatus.textContent = "ChatGPT Work handoff canceled. The verified local packet remains ready.";
  }
  restoreDocumentActionModalFocus();
}

function renderDocumentActionModal() {
  const mount = document.getElementById("documentActionModalMount");
  if (!mount) return;
  const modal = state.documentActionModal;
  if (!modal.open) {
    mount.innerHTML = "";
    setDocumentActionModalBackgroundInert(false);
    return;
  }
  if (modal.action === "chatgpt-work") {
    const row = rowById(modal.estateId);
    const brief = String(modal.brief || "");
    const missingEstateMessage = row
      ? ""
      : "The estate that created this brief is no longer available. Cancel and reopen the handoff from the estate.";
    mount.innerHTML = `
      <section class="document-modal-layer" role="presentation" data-document-modal-layer>
        <div class="document-modal beui-dialog chatgpt-work-modal" role="dialog" aria-modal="true" aria-labelledby="documentModalTitle" aria-describedby="chatgptWorkCopyHelp">
          <div class="document-modal-head">
            <div>
              <h2 id="documentModalTitle" class="rail-title">Copy the ChatGPT Work brief</h2>
              <p id="chatgptWorkCopyHelp" class="copy">This browser blocks automatic clipboard access. The sanitized brief is selected below. Press ⌘C or Ctrl+C, then continue in this tab.</p>
            </div>
            <button class="btn icon-only" type="button" data-close-document-modal aria-label="Close ChatGPT Work handoff">${nucleoIcon("close", 16)}</button>
          </div>
          <div class="document-modal-body">
            <label class="field" for="chatgptWorkBriefCopy">
              <span>Review brief for ${escapeHtml(modal.estateLabel || "original estate")}</span>
              <textarea id="chatgptWorkBriefCopy" class="chatgpt-work-copy" readonly spellcheck="false">${escapeHtml(brief)}</textarea>
            </label>
            <p class="copy chatgpt-work-error" role="alert" tabindex="-1" data-chatgpt-work-error${missingEstateMessage ? "" : " hidden"}>${escapeHtml(missingEstateMessage)}</p>
            <p class="copy">Only the estate summary and verified packet link are included. The uploaded IDI report text and credentials remain in HeirRight.</p>
          </div>
          <div class="document-modal-foot">
            <button class="btn" type="button" data-close-document-modal>Cancel</button>
            <button class="btn primary solvys-liquid-glass" type="button" data-continue-chatgpt-work ${row ? "" : "disabled"}>Continue in ChatGPT Work</button>
          </div>
        </div>
      </section>
    `;
    setDocumentActionModalBackgroundInert(true);
    wireDocumentActionModal(mount);
    requestAnimationFrame(() => {
      const textarea = mount.querySelector("#chatgptWorkBriefCopy");
      textarea?.focus({ preventScroll: true });
      textarea?.select();
    });
    return;
  }
  const row = selectedRow();
  const doc = dossierDocuments(row, dossierForRow(row)).find((item) => item.id === modal.docId) ?? selectedDossierDocument(row);
  const record = documentFileRecord(doc?.id, row);
  const packet = packetArtifactForRow(row);
  const verifiedPacketReady = Boolean(packet?.verification?.verified && packet?.verification?.readbackStatus === "verified");
  mount.innerHTML = `
    <section class="document-modal-layer" role="presentation" data-document-modal-layer>
      <div class="document-modal beui-dialog" role="dialog" aria-modal="true" aria-labelledby="documentModalTitle">
        <div class="document-modal-head">
          <div>
            <p class="eyebrow">File control</p>
            <h2 id="documentModalTitle" class="rail-title">${escapeHtml(doc?.title ?? "Dossier document")}</h2>
            <p class="copy">${escapeHtml(doc?.copy ?? "Add the supporting document used for this dossier section.")}</p>
          </div>
          <button class="btn icon-only" type="button" data-close-document-modal aria-label="Close file control">${nucleoIcon("close", 16)}</button>
        </div>
        <div class="document-modal-body">
          <div class="file-control-box">
            <strong>${record ? "Current file" : "Choose Supporting Document"}</strong>
            <span class="copy">${escapeHtml(record ? documentFileLabel(record) : "Select a PDF, image, or office file. HeirRight stores the actual file and verifies backend readback before this section can be marked complete.")}</span>
            <input id="documentFileInput" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" aria-label="Choose file for ${escapeHtml(doc?.title ?? "document")}">
          </div>
          <div class="fact-grid">
            <div class="fact"><label>Process</label><span>${escapeHtml(row?.leadName || row?.title || "Lead file")}</span></div>
            <div class="fact"><label>Status</label><span>${escapeHtml(record ? "Linked" : doc?.status || "Needs review")}</span></div>
            <div class="fact"><label>Version</label><span>${escapeHtml(record?.version ? `v${record.version}` : "v1")}</span></div>
            <div class="fact"><label>Source</label><span>${escapeHtml(doc?.type || "Document")}</span></div>
          </div>
        </div>
        <div class="document-modal-foot">
          ${verifiedPacketReady ? `<button class="btn" type="button" data-link-generated-document="${escapeHtml(doc?.id ?? "")}">Use Verified Packet</button>` : ""}
          <button class="btn primary solvys-liquid-glass" type="button" data-save-document-file="${escapeHtml(doc?.id ?? "")}">${record ? "Save New Version" : "Attach File"}</button>
        </div>
      </div>
    </section>
  `;
  setDocumentActionModalBackgroundInert(true);
  wireDocumentActionModal(mount);
  requestAnimationFrame(() => mount.querySelector("#documentFileInput")?.focus());
}

function fileContentType(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase();
  const byExtension = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    csv: "text/csv"
  }[extension];
  return byExtension || file?.type || "application/octet-stream";
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "").split(",").pop() || ""), { once: true });
    reader.addEventListener("error", () => reject(reader.error || new Error("The selected file could not be read.")), { once: true });
    reader.readAsDataURL(file);
  });
}

async function verifyStoredAttachment(attachment) {
  if (!attachment?.artifactId && !attachment?.id) throw new Error("The supporting document did not return an artifact ID.");
  const artifactId = attachment.artifactId || attachment.id;
  const response = await fetch(attachment.artifactUrl, { cache: "no-store" });
  const bytes = await response.arrayBuffer();
  const returnedId = response.headers.get("x-heirright-artifact-id");
  const returnedHash = response.headers.get("x-heirright-content-hash");
  if (!response.ok || bytes.byteLength !== Number(attachment.size) || returnedId !== artifactId || returnedHash !== attachment.contentHash) {
    throw new Error("The supporting document did not pass artifact readback verification.");
  }
  return { ...attachment, artifactId, readbackStatus: "verified" };
}

async function removeUncommittedSupportingAttachment(attachment) {
  const attachmentId = String(attachment?.artifactId || attachment?.id || "").trim();
  if (!attachmentId) return { attempted: false, verified: true };
  try {
    const response = await fetch(`/api/documents/attachments?attachmentId=${encodeURIComponent(attachmentId)}`, {
      method: "DELETE",
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    const verified = Boolean(response.ok && (
      (result?.deleted === true && result?.readbackStatus === "verified")
      || result?.readbackStatus === "not_found"
    ));
    return { attempted: true, verified };
  } catch {
    return { attempted: true, verified: false };
  }
}

function uploadCleanupMessage(message, cleanup) {
  if (!cleanup?.attempted || cleanup.verified) return message;
  return `${message} Cleanup could not be verified; ask an administrator to review secure document storage.`;
}

async function hydrateSupportingDocuments(row = selectedRow()) {
  if (!row || isDemoEstateImport(row)) return [];
  try {
    const response = await fetch(`/api/documents/attachments?estateId=${encodeURIComponent(assetDiscoveryKey(row))}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.ok || !Array.isArray(result.attachments)) return [];
    const latestByDocument = new Map();
    result.attachments.forEach((attachment) => {
      if (!attachment?.documentId || latestByDocument.has(attachment.documentId)) return;
      latestByDocument.set(attachment.documentId, attachment);
    });
    latestByDocument.forEach((attachment, docId) => {
      state.documentFiles[documentStorageKey(row, docId)] = {
        id: docId,
        name: attachment.fileName,
        size: attachment.size,
        type: attachment.contentType,
        source: "supporting_document",
        artifactId: attachment.id,
        artifactUrl: attachment.artifactUrl,
        contentHash: attachment.contentHash,
        readbackStatus: attachment.readbackStatus,
        version: 1,
        linkedAt: Date.parse(attachment.createdAt) || Date.now(),
        linkedBy: attachment.uploadedBy || "team"
      };
    });
    persistDocumentFiles();
    return [...latestByDocument.values()];
  } catch {
    return [];
  }
}

async function saveDocumentFile(docId, file = null, source = "file") {
  const row = selectedRow();
  const existing = documentFileRecord(docId, row);
  const doc = dossierDocuments(row, dossierForRow(row)).find((item) => item.id === docId) ?? selectedDossierDocument(row);
  if (source === "verified-packet") {
    const linked = linkGeneratedDocPrepPackets(row, state.activeDocPrepFlow);
    if (!linked && !documentFileRecord(docId, row)) {
      document.getElementById("topStatus").textContent = "Generate and verify the packet before linking it.";
      return;
    }
    addShellEvent("Verified packet linked", `${docPrepFlow().title} is linked to ${row?.leadName || row?.title || "the current lead"} with artifact readback.`, "ready", false, { row, source: "Document Prep" });
    renderCurrentLoopView();
    renderRail();
    closeDocumentActionModal();
    return;
  }
  if (!file) {
    document.getElementById("topStatus").textContent = "Choose a supporting document before attaching it.";
    return;
  }
  if (file.size > 3_000_000) {
    document.getElementById("topStatus").textContent = "Supporting documents must be 3 MB or smaller.";
    return;
  }
  document.getElementById("topStatus").textContent = `Storing and verifying ${file.name}...`;
  let storedAttachment = null;
  let attachment;
  try {
    const result = await postJson("/api/documents/attachments", {
      estateId: assetDiscoveryKey(row),
      documentId: docId,
      fileName: file.name,
      contentType: fileContentType(file),
      dataBase64: await fileToBase64(file)
    });
    storedAttachment = result?.attachment || null;
    attachment = await verifyStoredAttachment(storedAttachment);
  } catch (error) {
    const cleanup = await removeUncommittedSupportingAttachment(storedAttachment);
    const message = uploadCleanupMessage(
      error instanceof Error ? error.message : "The supporting document could not be stored.",
      cleanup
    );
    document.getElementById("topStatus").textContent = `Attachment blocked: ${message}`;
    addShellEvent("Supporting document blocked", message, "blocked", true, { row, source: "Document Prep" });
    return;
  }
  const record = {
    id: docId,
    name: attachment.fileName,
    size: attachment.size,
    type: attachment.contentType,
    source: "supporting_document",
    artifactId: attachment.artifactId,
    artifactUrl: attachment.artifactUrl,
    contentHash: attachment.contentHash,
    readbackStatus: "verified",
    version: existing ? Number(existing.version || 1) + 1 : 1,
    linkedAt: Date.now(),
    linkedBy: state.session?.user?.email || "team"
  };
  state.documentFiles[documentStorageKey(row, docId)] = record;
  setDocumentAutomationState(docId, "complete", row);
  persistDocumentFiles();
  document.getElementById("topStatus").textContent = `${doc?.title || "Supporting document"} passed backend storage and artifact readback.`;
  addShellEvent("Supporting document attached", `${doc?.title || "Dossier document"} passed backend storage and artifact readback for ${row?.leadName || row?.title || "the current lead"}.`, "ready", false, { row, source: "Document Prep" });
  renderCurrentLoopView();
  renderRail();
  closeDocumentActionModal();
}

async function importIdiReportFile(file, row = selectedRow(), { adminOverrideReason = "", startDiscovery = true } = {}) {
  if (!row || !file) return { ok: false, message: "Select an estate and choose an IDI report PDF." };
  const stopBlocker = canonicalStopBlocker(row, "IDI report upload");
  if (stopBlocker) {
    document.getElementById("topStatus").textContent = stopBlocker;
    addShellEvent("IDI report upload blocked", stopBlocker, "blocked", true, { row, source: "IDI report upload" });
    return { ok: false, message: stopBlocker };
  }
  const key = assetDiscoveryKey(row);
  const sourceCapture = sourceCaptureForRow(row);
  const lastSaleDate = sourceCapture.deed?.lastSaleDate || dossierForRow(row)?.deedHistory?.lastSaleDate?.value || "";
  const replacementReason = String(adminOverrideReason || "").replace(/\s+/g, " ").trim();
  if (state.idiImports[key] && replacementReason.length < 12) {
    addShellEvent("IDI report replacement blocked", "A configured administrator must add a specific replacement reason before changing this estate's verified IDI report.", "blocked", true, { row, source: "IDI report upload" });
    return { ok: false, message: "A replacement reason is required before changing the verified IDI report." };
  }
  if (file.size > 3_000_000) {
    addShellEvent("IDI report blocked", "IDI reports must be 3 MB or smaller.", "blocked", true, { row, source: "IDI report upload" });
    return { ok: false, message: "IDI reports must be 3 MB or smaller." };
  }
  document.getElementById("topStatus").textContent = `Storing and reading ${file.name}...`;
  const capturedAt = new Date().toISOString();
  let storedAttachment = null;
  let importCommitted = false;
  let attachment;
  try {
    const stored = await postJson("/api/documents/attachments", {
      estateId: key,
      documentId: "idi-asset-search",
      fileName: file.name,
      contentType: fileContentType(file),
      dataBase64: await fileToBase64(file)
    });
    storedAttachment = stored?.attachment || null;
    const verified = await verifyStoredAttachment(storedAttachment);
    attachment = {
      label: "IDI asset-search report",
      sourceUrl: verified.artifactUrl,
      fileKind: "uploaded-report",
      fileName: verified.fileName,
      artifactId: verified.artifactId,
      contentHash: verified.contentHash,
      capturedAt,
      capturedBy: state.session?.user?.email || "team",
      reviewFlags: ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"]
    };
    document.getElementById("topStatus").textContent = `Reading ${file.name} and locating report evidence...`;
    const imported = await postJson("/api/discovery/idi-asset-search/extract", {
      assetKey: key,
      estateId: row.id,
      leadId: row.id,
      ownerName: row.owner || row.title,
      propertyAddress: row.address,
      parcelId: row.parcel,
      lastSaleDate,
      provider: "idi",
      attachment,
      ...(replacementReason ? { adminOverrideReason: replacementReason } : {})
    });
    importCommitted = true;
    state.documentFiles[documentStorageKey(row, "idi-asset-search")] = {
      id: "idi-asset-search",
      name: verified.fileName,
      size: verified.size,
      type: verified.contentType,
      source: "supporting_document",
      artifactId: verified.artifactId,
      artifactUrl: verified.artifactUrl,
      contentHash: verified.contentHash,
      readbackStatus: "verified",
      version: 1,
      linkedAt: Date.now(),
      linkedBy: state.session?.user?.email || "team"
    };
    state.idiImports[key] = {
      ...imported,
      importedText: "",
      candidates: Array.isArray(imported.candidates) ? imported.candidates : [],
      attachment: imported.attachment || attachment,
      duplicateGuard: imported.duplicateGuard || "first_import_only",
      importedAt: Date.now()
    };
    persistDocumentFiles();
    const autoAccepted = state.idiImports[key].candidates.filter((candidate) => candidate.reviewStatus === "auto_accepted_high_confidence").length;
    document.getElementById("topStatus").textContent = startDiscovery
      ? `IDI report verified. Starting Discovery for ${docPrepEstateLabel(row)}...`
      : `IDI report verified for ${docPrepEstateLabel(row)}. Ready to run Discovery.`;
    addShellEvent(
      "IDI report ready",
      autoAccepted
        ? `${autoAccepted} high-confidence contact${autoAccepted === 1 ? " was" : "s were"} recorded with report locations. ${startDiscovery ? "Discovery is running for this estate." : "The estate is ready for Discovery."}`
        : `The report passed artifact readback and source extraction. ${startDiscovery ? "Discovery is running, while contact review stays visible." : "The estate is ready for Discovery."}`,
      autoAccepted ? "ready" : "review",
      true,
      { row, source: "IDI report upload" }
    );
  } catch (error) {
    const cleanup = importCommitted
      ? { attempted: false, verified: true }
      : await removeUncommittedSupportingAttachment(storedAttachment);
    const message = uploadCleanupMessage(
      error instanceof Error ? error.message : "The IDI report could not be stored.",
      cleanup
    );
    document.getElementById("topStatus").textContent = `IDI report blocked: ${message}`;
    addShellEvent("IDI report blocked", message, "blocked", true, { row, source: "IDI report upload" });
    return { ok: false, message };
  }
  rerenderAssetDiscoverySurface();
  if (!startDiscovery) return { ok: true };
  if (docPrepMainRunActive(row, "discovery")) stopFullDiscoveryRun(row, "discovery", { silent: true });
  await runFullDiscovery(row, null, "discovery", { correctionNote: replacementReason });
  return { ok: true };
}

function wireIdiReportUploadControls(content, row = selectedRow()) {
  if (!content || !row) return;
  content.querySelectorAll("[data-upload-idi-report]").forEach((button) => {
    button.addEventListener("click", () => button.parentElement?.querySelector("[data-idi-report-file]")?.click());
  });
  content.querySelectorAll("[data-idi-report-file]").forEach((input) => {
    input.addEventListener("change", async (event) => {
      const fileInput = event.currentTarget;
      const file = fileInput.files?.[0] || null;
      if (!file) return;
      const button = fileInput.parentElement?.querySelector("[data-upload-idi-report]");
      if (button) {
        button.disabled = true;
        button.setAttribute("aria-busy", "true");
      }
      await importIdiReportFile(file, row);
      if (fileInput.isConnected) fileInput.value = "";
      if (button?.isConnected) {
        button.disabled = false;
        button.removeAttribute("aria-busy");
      }
    });
  });
}

async function removeSupportingDocument(docId) {
  const row = selectedRow();
  const record = documentFileRecord(docId, row);
  if (!row) throw new Error("Select an estate before removing a supporting document.");
  if (record?.source !== "supporting_document") {
    throw new Error("Only operator-uploaded supporting files can be removed. Verified generated packets remain in the audit trail.");
  }
  const doc = dossierDocuments(row, dossierForRow(row)).find((item) => item.id === docId) ?? selectedDossierDocument(row);
  if (!window.confirm(`Remove all saved versions of ${doc?.title || "this supporting document"} from the shared workspace?`)) return;
  try {
    const listResponse = await fetch(`/api/documents/attachments?estateId=${encodeURIComponent(assetDiscoveryKey(row))}`, { cache: "no-store" });
    const list = await listResponse.json().catch(() => ({}));
    if (!listResponse.ok || !Array.isArray(list.attachments)) throw new Error(list.message || "Saved supporting documents could not be loaded.");
    const attachments = list.attachments.filter((item) => item?.documentId === docId && item?.id);
    const removals = await Promise.all(attachments.map(async (item) => {
      const response = await fetch(`/api/documents/attachments?attachmentId=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      return response.ok && result?.readbackStatus === "verified";
    }));
    if (!attachments.length || removals.some((removed) => !removed)) throw new Error("One or more saved versions did not pass removal readback.");
    delete state.documentFiles[documentStorageKey(row, docId)];
    setDocumentAutomationState(docId, "", row);
    persistDocumentFiles();
    document.getElementById("topStatus").textContent = `${doc?.title || "Supporting document"} was removed from the shared workspace.`;
    addShellEvent("Supporting document removed", "All saved versions passed backend removal readback.", "ready", false, { row, source: "Document Prep" });
    renderCurrentLoopView();
    renderRail();
  } catch (error) {
    const message = error instanceof Error ? error.message : "The supporting document could not be removed.";
    document.getElementById("topStatus").textContent = `Removal blocked: ${message}`;
    addShellEvent("Supporting document removal blocked", message, "blocked", true, { row, source: "Document Prep" });
  }
}

function documentNeedsHumanInput(docId, action = "add") {
  const row = selectedRow();
  const doc = dossierDocuments(row, dossierForRow(row)).find((item) => item.id === docId) ?? selectedDossierDocument(row);
  const workflow = doc ? dossierDocWorkflowState(doc) : null;
  if (action === "replace") return true;
  return Boolean(workflow?.state !== "complete" || /blocked|locked/i.test(doc?.status || ""));
}

function stopDocumentAutomation(docId, row = selectedRow()) {
  const doc = dossierDocuments(row, dossierForRow(row)).find((item) => item.id === docId) ?? selectedDossierDocument(row);
  const key = documentAutomationKey(docId, row);
  const timer = documentAutomationTimers.get(key);
  if (timer) window.clearTimeout(timer);
  documentAutomationTimers.delete(key);
  setDocumentAutomationState(docId, "", row);
  document.getElementById("topStatus").textContent = `${doc?.title || "Document"} run stopped.`;
  addShellEvent("Document run stopped", `${doc?.title || "Document"} was stopped before the linked packet was updated.`, "review", false, { row, source: "Document Prep" });
  renderCurrentLoopView();
  renderRail();
}

function startDocumentAutomation(docId, action = "add") {
  const row = selectedRow();
  const doc = dossierDocuments(row, dossierForRow(row)).find((item) => item.id === docId) ?? selectedDossierDocument(row);
  if (!doc) return;
  if (documentAutomationState(doc.id, row) === "processing") {
    stopDocumentAutomation(doc.id, row);
    return;
  }
  if (documentNeedsHumanInput(docId, action)) {
    state.selectedDossierDocId = doc.id;
    state.railMode = "dossier";
    state.railTab = "docs";
    renderRail();
    setRailOpen(true);
    openDocumentActionModal(doc.id, action === "replace" ? "replace" : "add");
    addShellEvent("Human review needed", `${doc.title} needs a supporting document, filter, or approval note before it can be marked complete.`, "blocked", false, { row, source: "Document Prep" });
    return;
  }
  setDocumentAutomationState(doc.id, "processing", row);
  renderCurrentLoopView();
  renderRail();
  Promise.resolve(packetArtifactForRow(row)?.verification?.verified
    ? packetArtifactForRow(row)
    : generatePacketPreview(row, null, { flowId: state.activeDocPrepFlow, render: false }))
    .then((packet) => {
      if (documentAutomationState(doc.id, row) !== "processing") return;
      if (!packet?.verification?.verified) throw new Error("The packet did not pass artifact and storage readback verification.");
      linkGeneratedDocPrepPackets(row, state.activeDocPrepFlow);
      setDocumentAutomationState(doc.id, "complete", row);
      addShellEvent("Verified packet linked", `${doc.title} is backed by the verified packet artifact for the selected estate.`, "ready", false, { row, source: "Document Prep" });
      renderCurrentLoopView();
      renderRail();
    })
    .catch((error) => {
      setDocumentAutomationState(doc.id, "", row);
      const message = error instanceof Error ? error.message : "The packet could not be verified.";
      document.getElementById("topStatus").textContent = `Document step blocked: ${message}`;
      addShellEvent("Document step blocked", message, "blocked", true, { row, source: "Document Prep" });
      renderCurrentLoopView();
      renderRail();
    });
}

function wireDocumentActionModal(mount) {
  const dialog = mount.querySelector('[role="dialog"]');
  dialog?.addEventListener("keydown", (event) => containModalKeydown(event, dialog, { onEscape: closeDocumentActionModal }));
  mount.querySelectorAll("[data-close-document-modal]").forEach((control) => {
    control.addEventListener("click", closeDocumentActionModal);
  });
  mount.querySelector("[data-document-modal-layer]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget && state.documentActionModal.action !== "chatgpt-work") closeDocumentActionModal();
  });
  mount.querySelector("[data-continue-chatgpt-work]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const modal = state.documentActionModal;
    const errorMessage = mount.querySelector("[data-chatgpt-work-error]");
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      const row = rowById(modal.estateId);
      if (!row) {
        throw new Error("The estate that created this brief is no longer available. Cancel and reopen the handoff from the estate.");
      }
      const flowId = String(modal.flowId || state.activeDocPrepFlow);
      const stopBlocker = canonicalStopBlocker(row, "ChatGPT Work handoff");
      if (stopBlocker) throw new Error(stopBlocker);
      const packet = packetArtifactForRow(row, flowId);
      requireCurrentUnexpiredPacket(row, flowId, packet, "continuing to ChatGPT Work");
      const packetArtifactId = String(packet?.artifact?.artifactId || packet?.verification?.artifactId || "");
      if (
        packetArtifactId !== String(modal.packetArtifactId || "")
        || currentPacketRevision(row, flowId) !== Number(modal.packetRevision || 0)
      ) {
        throw new Error("The active packet changed after this brief opened. Cancel and reopen the ChatGPT Work handoff from the current packet.");
      }
      closeDocumentActionModal();
      continueToChatgptWork(row, flowId);
    } catch (error) {
      const message = clientFacingCopy(error instanceof Error ? error.message : "The ChatGPT Work handoff could not continue.");
      if (errorMessage) {
        errorMessage.hidden = false;
        errorMessage.textContent = message;
        errorMessage.focus?.({ preventScroll: true });
      }
      const topStatus = document.getElementById("topStatus");
      if (topStatus) topStatus.textContent = `ChatGPT Work handoff blocked: ${message}`;
      button.removeAttribute("aria-busy");
      if (button.isConnected) button.disabled = false;
    }
  });
  mount.querySelector("[data-link-generated-document]")?.addEventListener("click", (event) => {
    saveDocumentFile(event.currentTarget.dataset.linkGeneratedDocument, null, "verified-packet");
  });
  mount.querySelector("[data-save-document-file]")?.addEventListener("click", async (event) => {
    const file = mount.querySelector("#documentFileInput")?.files?.[0] ?? null;
    const button = event.currentTarget;
    const docId = button.dataset.saveDocumentFile;
    button.disabled = true;
    await saveDocumentFile(docId, file, "file");
    if (button.isConnected) button.disabled = false;
  });
}

function openCrmImportModal() {
  resetCrmImportUpload();
  state.crmImportModal.open = true;
  renderCrmImportModal();
}

function closeCrmImportModal() {
  resetCrmImportUpload();
  state.crmImportModal.open = false;
  renderCrmImportModal();
}
function emptyCrmImportUpload() {
  return {
    status: "idle",
    name: "",
    size: 0,
    rowCount: 0,
    progress: 0,
    message: "",
    failurePhase: "",
    source: "",
    items: [],
    model: "",
    sourceHash: "",
    reviewRequired: true
  };
}

function resetCrmImportUpload() {
  estateImportFile = null;
  estateImportUploadToken += 1;
  state.crmImportUpload = emptyCrmImportUpload();
}

function formatCrmFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  return (value / (1024 * 1024)).toFixed(1) + " MB";
}

function crmImportUploadStatusText(upload) {
  switch (upload.status) {
    case "uploading":
      return upload.message || "Sending the estate file for secure text extraction…";
    case "importing":
      return upload.message || "Adding reviewed estate records…";
    case "success":
      return upload.message || "Estate records are ready for review.";
    case "error":
      return upload.message || "The estate file could not be parsed.";
    case "queued":
      return upload.message || "Estate file queued.";
    default:
      return "PDF or CSV, up to 3 MB. A verified zero-cost Nous model parses the source without filling missing facts.";
  }
}

function renderCrmImportUpload() {
  const upload = state.crmImportUpload || emptyCrmImportUpload();
  const progress = Math.max(0, Math.min(100, Number(upload.progress) || 0));
  const hasFile = Boolean(upload.name);
  const showProgress = upload.status === "uploading" || upload.status === "importing";
  const retry = upload.status === "error"
    ? '<button class="btn compact" type="button" data-crm-upload-retry>Retry</button>'
    : "";
  const remove = hasFile
    ? '<button class="btn compact" type="button" data-crm-upload-remove>Remove</button>'
    : "";
  const fileRow = hasFile
    ? '<div class="crm-upload-file" data-crm-upload-file-row>' +
        '<div class="crm-upload-file-meta">' +
          '<strong>' + escapeHtml(upload.name) + '</strong>' +
          '<span>' + formatCrmFileSize(upload.size) + (upload.rowCount ? " · " + upload.rowCount + " estate" + (upload.rowCount === 1 ? "" : "s") : "") + '</span>' +
        '</div>' +
        '<div class="crm-upload-file-actions">' +
          '<span class="crm-upload-file-status" data-crm-upload-file-status>' + escapeHtml(upload.status) + '</span>' +
          retry +
          remove +
        '</div>' +
      '</div>'
    : "";
  const progressMarkup = showProgress
    ? '<div class="crm-upload-progress" role="progressbar" aria-label="Estate file parsing progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + progress + '">' +
        '<span style="width:' + progress + '%"></span>' +
      '</div>'
    : "";
  return '<div class="crm-upload" data-crm-upload-status="' + escapeHtml(upload.status) + '">' +
    '<label class="crm-upload-dropzone" for="estateFileInput" tabindex="0" role="button" data-estate-upload-dropzone>' +
      '<span class="crm-upload-kicker">Estate source</span>' +
      '<strong>Browse PDF or CSV, or drop it here</strong>' +
      '<span class="field-note">Searchable PDF or CSV (UTF-8 or Windows-1252), up to 3 MB. Parsing stays review-required.</span>' +
    '</label>' +
    '<input id="estateFileInput" class="crm-upload-input" type="file" accept=".pdf,.csv,application/pdf,text/csv" aria-describedby="estateFileInputNote">' +
    '<p id="estateFileInputNote" class="field-note crm-upload-message" aria-live="polite">' + escapeHtml(crmImportUploadStatusText(upload)) + '</p>' +
    fileRow +
    progressMarkup +
  '</div>';
}

async function base64ForEstateFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32_768)));
  }
  return btoa(chunks.join(""));
}

function setCrmImportUploadError(message, failurePhase = "processing") {
  state.crmImportUpload = {
    ...(state.crmImportUpload || emptyCrmImportUpload()),
    status: "error",
    progress: 0,
    failurePhase,
    message
  };
  renderCrmImportModal({ focus: false });
  document.getElementById("topStatus").textContent = message;
}

async function queueEstateFile(file) {
  if (!file) return;
  estateImportFile = file;
  const token = ++estateImportUploadToken;
  const fileName = String(file.name || "estate-source");
  const fileType = String(file.type || "").toLowerCase();
  const contentType = /\.pdf$/i.test(fileName) || fileType === "application/pdf" ? "application/pdf" : "text/csv";
  state.crmImportUpload = {
    ...emptyCrmImportUpload(),
    status: "queued",
    name: fileName,
    size: Number(file.size) || 0,
    source: "file-upload",
    message: "Estate file queued for parsing…"
  };
  renderCrmImportModal({ focus: false });
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (token !== estateImportUploadToken) return;
  const supportedPdf = /\.pdf$/i.test(fileName) || fileType === "application/pdf";
  const supportedCsv = /\.csv$/i.test(fileName) || ["text/csv", "application/csv"].includes(fileType);
  if (!supportedPdf && !supportedCsv) {
    setCrmImportUploadError("Choose a PDF or CSV file to continue.", "validation");
    return;
  }
  if (!Number(file.size) || Number(file.size) > estateFileImportMaxBytes) {
    setCrmImportUploadError("Choose a non-empty PDF or CSV no larger than 3 MB.", "validation");
    return;
  }
  try {
    state.crmImportUpload = { ...state.crmImportUpload, status: "uploading", progress: 20, message: "Reading the selected file…" };
    renderCrmImportModal({ focus: false });
    const contentBase64 = await base64ForEstateFile(file);
    if (token !== estateImportUploadToken) return;
    state.crmImportUpload = { ...state.crmImportUpload, progress: 55, message: "Extracting text and parsing estate records with a verified free Nous model…" };
    renderCrmImportModal({ focus: false });
    const result = await postJson("/api/agentic/estate-import", {
      fileName,
      contentType,
      contentBase64,
      model: state.agenticModelPreference || "dynamic-free-catalog",
    });
    if (token !== estateImportUploadToken) return;
    const items = Array.isArray(result.estates) ? result.estates.filter((item) => item && typeof item === "object") : [];
    if (!result.ok || !result.freeModelVerified || !items.length) throw new Error(result.message || "The file did not contain any reviewable estate records.");
    state.crmImportUpload = {
      ...state.crmImportUpload,
      status: "success",
      progress: 100,
      rowCount: items.length,
      items,
      model: String(result.model || ""),
      sourceHash: String(result.sourceHash || ""),
      reviewRequired: result.reviewRequired !== false,
      message: items.length + " estate" + (items.length === 1 ? "" : "s") + " parsed by " + String(result.model || "the verified free Nous model") + ". Review, then add them to Estates."
    };
    renderCrmImportModal({ focus: false });
    document.getElementById("topStatus").textContent = state.crmImportUpload.message;
  } catch (error) {
    if (token !== estateImportUploadToken) return;
    setCrmImportUploadError(error instanceof Error ? error.message : "That file could not be parsed safely.", "parse");
  }
}

function removeEstateFile() {
  const input = document.getElementById("estateFileInput");
  if (input) input.value = "";
  estateImportFile = null;
  estateImportUploadToken += 1;
  state.crmImportUpload = emptyCrmImportUpload();
  renderCrmImportModal({ focus: false });
}

function renderCrmImportModal({ focus = true } = {}) {
  const mount = document.getElementById("crmImportModalMount");
  if (!mount) return;
  if (!state.crmImportModal.open) {
    mount.innerHTML = "";
    return;
  }
  const upload = state.crmImportUpload || emptyCrmImportUpload();
  const isImporting = upload.status === "importing";
  const parsedItems = Array.isArray(upload.items) ? upload.items : [];
  const canCommit = upload.status === "success" && parsedItems.length > 0;
  const preview = parsedItems.length ? `
    <section class="estate-file-preview" data-estate-file-preview aria-live="polite">
      <div><strong>${parsedItems.length} estate${parsedItems.length === 1 ? "" : "s"} ready for review</strong><span>Parsed by ${escapeHtml(upload.model || "a verified free Nous model")}. Missing facts stay blank and review-required.</span></div>
      <ol>
        ${parsedItems.slice(0, 5).map((item) => `<li><strong>${escapeHtml(item.estateName || item.ownerName || "Estate name needs review")}</strong><span>${escapeHtml(item.propertyAddress || "Address needs review")}</span></li>`).join("")}
      </ol>
      ${parsedItems.length > 5 ? `<span class="field-note">${parsedItems.length - 5} more estate${parsedItems.length - 5 === 1 ? "" : "s"} will be added with the same review boundary.</span>` : ""}
    </section>
  ` : "";
  mount.innerHTML = `
    <section class="document-modal-layer" role="presentation" data-crm-import-layer>
      <form class="document-modal beui-dialog crm-import-modal" role="dialog" aria-modal="true" aria-labelledby="crmImportTitle" data-crm-import-form>
        <div class="document-modal-head">
          <div>
            <p class="eyebrow">Estate files</p>
            <h2 id="crmImportTitle" class="rail-title">Upload PDF or CSV</h2>
            <p class="copy">Choose a source document from the client. HeirRight extracts its text, sends only that text to a verified zero-cost Nous model, and keeps every parsed estate in review until you add it.</p>
          </div>
          <button class="btn icon-only" type="button" data-close-crm-import aria-label="Close estate file upload">${nucleoIcon("check-circle", 16)}</button>
        </div>
        <div class="document-modal-body">
          <div class="crm-import-grid">
            <div class="field full">
              ${renderCrmImportUpload()}
            </div>
            ${preview}
          </div>
        </div>
        <div class="document-modal-foot">
          <button class="btn" type="button" data-close-crm-import ${isImporting ? "disabled" : ""}>Cancel</button>
          <button class="btn primary solvys-liquid-glass" type="submit" data-estate-file-submit ${canCommit && !isImporting ? "" : "disabled"} aria-busy="${isImporting ? "true" : "false"}">${canCommit ? `Add ${parsedItems.length} estate${parsedItems.length === 1 ? "" : "s"}` : "Parse a file first"}</button>
        </div>
      </form>
    </section>
  `;
  mount.querySelectorAll("[data-close-crm-import]").forEach((button) => button.addEventListener("click", closeCrmImportModal));
  mount.querySelector("[data-crm-import-layer]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeCrmImportModal();
  });
  mount.querySelector("[data-crm-import-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void commitEstateFileImports();
  });
  const fileInput = mount.querySelector("#estateFileInput");
  fileInput?.addEventListener("change", (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) void queueEstateFile(file);
  });
  const dropzone = mount.querySelector("[data-estate-upload-dropzone]");
  dropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.dataset.dragging = "true";
  });
  dropzone?.addEventListener("dragleave", () => {
    delete dropzone.dataset.dragging;
  });
  dropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    delete dropzone.dataset.dragging;
    const file = event.dataTransfer?.files?.[0];
    if (file) void queueEstateFile(file);
  });
  dropzone?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    fileInput?.click();
  });
  mount.querySelector("[data-crm-upload-retry]")?.addEventListener("click", () => {
    if (estateImportFile) void queueEstateFile(estateImportFile);
  });
  mount.querySelector("[data-crm-upload-remove]")?.addEventListener("click", removeEstateFile);
  if (focus) requestAnimationFrame(() => dropzone?.focus());
}

const crmBatchImportLimit = 250;

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  return [";", "\t", ","].reduce((selected, delimiter) => {
    const occurrences = firstLine.split(delimiter).length - 1;
    const selectedOccurrences = firstLine.split(selected).length - 1;
    return occurrences > selectedOccurrences ? delimiter : selected;
  }, ",");
}

function crmColumnKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function rowValueByColumn(row, headerIndex, names) {
  const index = names.map(crmColumnKey).map((name) => headerIndex.get(name)).find(Number.isInteger);
  return index === undefined ? "" : String(row[index] || "").trim();
}

function cleanCrmImportCell(value) {
  return String(value ?? "")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function csvFileImportItems(text, fileName = "CSV file") {
  const rows = parseDelimitedRows(String(text || ""), csvDelimiter(String(text || "")));
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one estate row.");
  const headerIndex = new Map(rows[0].map((header, index) => [crmColumnKey(header), index]));
  const hasContactAddressHeaders = ["firstname", "lastname", "address"].every((column) => headerIndex.has(column));
  const hasEstateHeaders = ["estatename", "ownername", "propertyaddress"].some((column) => headerIndex.has(column));
  if (!hasContactAddressHeaders && !hasEstateHeaders) {
    throw new Error("The CSV needs estate fields or First Name, Last Name, and Address columns.");
  }
  const imports = rows.slice(1).map((row, index) => {
    const clean = (names) => cleanCrmImportCell(rowValueByColumn(row, headerIndex, names));
    if (!row.some((cell) => cleanCrmImportCell(cell))) return null;
    const firstName = clean(["first name", "first"]);
    const lastName = clean(["last name", "last"]);
    const sourceOwner = clean(["owner name", "owner", "seller"]);
    const ownerName = sourceOwner || cleanCrmImportCell([firstName, lastName].filter(Boolean).join(" ")) || `Imported estate ${index + 2}`;
    const estateName = clean(["estate name", "estate"]) || ownerName;
    const street = clean(["property address", "address", "street address"]);
    const city = clean(["city"]);
    const stateValue = clean(["state"]);
    const zip = clean(["zip code", "zip", "postal code"]);
    const cityLine = [city, stateValue, zip].filter(Boolean).join(" ");
    const propertyAddress = cleanCrmImportCell([street, cityLine].filter(Boolean).join(", ")) || "Address needs review";
    const incompleteFields = [!sourceOwner && !firstName && !lastName ? "owner" : "", !street ? "address" : ""].filter(Boolean);
    return normalizeCrmImport({
      provider: "csv",
      estateName,
      ownerName,
      propertyAddress,
      county: clean(["county"]),
      parcelId: clean(["folio", "parcel", "parcel id"]),
      sourceRecordId: `${fileName}:row-${index + 2}`,
      notes: `Imported from ${fileName} row ${index + 2}.${incompleteFields.length ? ` Needs review: missing ${incompleteFields.join(" and ")} field${incompleteFields.length === 1 ? "" : "s"}.` : ""}`,
    });
  }).filter(Boolean);
  if (!imports.length) throw new Error("The CSV did not contain any estate rows.");
  if (imports.length > crmBatchImportLimit) throw new Error(`This import has ${imports.length} rows. Import up to ${crmBatchImportLimit} at a time.`);
  return imports;
}

function estateFileImportItems() {
  const upload = state.crmImportUpload || emptyCrmImportUpload();
  const sourceHash = String(upload.sourceHash || "").trim();
  const sourceFileName = String(upload.name || "estate-source").trim();
  const model = String(upload.model || "").trim();
  return (Array.isArray(upload.items) ? upload.items : []).slice(0, crmBatchImportLimit).map((item, index) => {
    const missingFields = Array.isArray(item.missingFields) ? item.missingFields.map((field) => String(field || "").trim()).filter(Boolean) : [];
    const notes = [
      String(item.notes || "").trim(),
      missingFields.length ? `Needs review: missing ${missingFields.join(", ")}.` : "",
      `Parsed from ${sourceFileName} by verified free Nous model ${model || "automatic selection"}.`,
    ].filter(Boolean).join(" ");
    return normalizeCrmImport({
      ...item,
      provider: "file-upload",
      sourceRecordId: item.sourceRecordId || `file:${sourceHash || sourceFileName}:record-${index + 1}`,
      sourceUrl: sourceFileName,
      sourceHash,
      sourceFileName,
      sourceMethod: "nous-free-model",
      sourceModel: model,
      notes,
    });
  });
}

async function commitEstateFileImports() {
  const imports = estateFileImportItems();
  const sourceFileName = String(state.crmImportUpload?.name || "the uploaded file");
  if (!imports.length) {
    document.getElementById("topStatus").textContent = "Parse a PDF or CSV before adding estates.";
    return;
  }
  state.crmImportUpload = {
    ...(state.crmImportUpload || emptyCrmImportUpload()),
    status: "importing",
    progress: 0,
    rowCount: imports.length,
    message: "Preparing estate records…"
  };
  renderCrmImportModal({ focus: false });
  try {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const prepared = [];
    for (let index = 0; index < imports.length; index += 1) {
      prepared.push(imports[index]);
      const progress = Math.max(1, Math.round(((index + 1) / imports.length) * 65));
      state.crmImportUpload = {
        ...state.crmImportUpload,
        progress,
        message: "Preparing estate " + (index + 1) + " of " + imports.length + "…"
      };
      if (index % 8 === 7 || index === imports.length - 1) {
        renderCrmImportModal({ focus: false });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }
    const ids = new Set(prepared.map((item) => item.id));
    state.crmImports = [
      ...prepared,
      ...state.crmImports.filter((item) => !ids.has(item.id))
    ].slice(0, crmBatchImportLimit);
    prepared.map(crmImportRow).forEach(seedImportedDealStatus);
    persistDealStatuses();
    persistCrmImports(prepared.length + " estate file records added");
    state.rows = state.data && state.dossier ? buildRows(state.data, state.dossier) : crmImportRows();
    state.selectedId = prepared[0]?.id ?? state.selectedId;
    state.selectedIds.clear();
    state.showArchivedEstates = false;
    setActiveDocPrepFlow("discovery", { persist: true, rerender: false });
    state.docPrepListOpen = true;
    state.crmImportUpload = {
      ...state.crmImportUpload,
      status: "success",
      progress: 100,
      message: prepared.length + " estate" + (prepared.length === 1 ? "" : "s") + " added. Opening Estates…"
    };
    renderCrmImportModal({ focus: false });
    await new Promise((resolve) => setTimeout(resolve, 350));
    closeCrmImportModal();
    setActiveShellView("find-estates", "Estates");
    const evidenceFilter = document.getElementById("evidenceFilter");
    const statusFilter = document.getElementById("statusFilter");
    const globalSearch = document.getElementById("globalSearch");
    if (evidenceFilter) evidenceFilter.value = "0";
    if (statusFilter) statusFilter.value = "all";
    if (globalSearch) globalSearch.value = "";
    syncAllEnhancedSelects();
    applyFilters();
    updateFooterLeadContext(selectedRow());
    document.getElementById("topStatus").textContent = prepared.length + " estate" + (prepared.length === 1 ? "" : "s") + " added from " + sourceFileName + ". Review and queue them from Estates.";
    addShellEvent("Estate file parsed", prepared.length + " review-required estate record" + (prepared.length === 1 ? " is" : "s are") + " available in Estates. Missing fields remain incomplete.", "review", false);
  } catch (error) {
    setCrmImportUploadError(error instanceof Error ? error.message : "The parsed estates could not be added. Review the file and retry.", "import");
  }
}

function closeHeadlessMenu(wrap, immediate = false) {
  if (!wrap) return;
  const button = wrap.querySelector("[data-ui-menu-button]");
  const menu = wrap.querySelector(".headless-menu");
  button?.setAttribute("aria-expanded", "false");
  if (!menu) return;
  window.clearTimeout(Number(menu.dataset.closeTimer || 0));
  menu.classList.remove("is-open");
  if (immediate || !menu.classList.contains("t-dropdown")) {
    menu.classList.remove("is-closing");
    menu.setAttribute("hidden", "");
    return;
  }
  menu.classList.add("is-closing");
  menu.dataset.closeTimer = String(window.setTimeout(() => {
    const stillOpen = button?.getAttribute("aria-expanded") === "true";
    if (!stillOpen) {
      menu.setAttribute("hidden", "");
      menu.classList.remove("is-closing");
    }
  }, dropdownCloseDelay()));
}

function closeHeadlessMenus(except = null) {
  document.querySelectorAll("[data-ui-menu]").forEach((wrap) => {
    if (wrap === except) return;
    closeHeadlessMenu(wrap);
  });
}

function wireHeadlessMenus(root = document) {
  if (!document.documentElement.dataset.headlessMenusWired) {
    document.documentElement.dataset.headlessMenusWired = "true";
    document.addEventListener("click", (event) => {
      if (!event.target.closest("[data-ui-menu]")) closeHeadlessMenus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeHeadlessMenus();
        if (state.documentActionModal.open) closeDocumentActionModal();
        if (state.crmImportModal.open) closeCrmImportModal();
      }
    });
  }
  root.querySelectorAll("[data-ui-menu]").forEach((wrap) => {
    const button = wrap.querySelector("[data-ui-menu-button]");
    const menu = wrap.querySelector(".headless-menu");
    if (!button || !menu || button.dataset.menuWired) return;
    button.dataset.menuWired = "true";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const opening = menu.hasAttribute("hidden");
      closeHeadlessMenus(wrap);
      if (opening) {
        window.clearTimeout(Number(menu.dataset.closeTimer || 0));
        button.setAttribute("aria-expanded", "true");
        menu.removeAttribute("hidden");
        menu.classList.remove("is-closing");
        requestAnimationFrame(() => {
          menu.classList.add("is-open");
          menu.querySelector("[role='menuitem']")?.focus();
        });
      } else {
        closeHeadlessMenu(wrap);
      }
    });
    menu.querySelectorAll("[data-ui-menu-action]").forEach((item) => {
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        handleDocumentMenuAction(item.dataset.uiMenuAction, item.dataset.documentId);
        closeHeadlessMenus();
      });
    });
  });
  wireBeuiMenuKeyboard(root);
}

function wireBeuiMenuKeyboard(root = document) {
  if (!document.documentElement.dataset.beuiMenuKeyboardWired) {
    document.documentElement.dataset.beuiMenuKeyboardWired = "true";
    document.addEventListener("keydown", (event) => {
      const surface = event.target.closest?.("[data-beui-menu-surface]");
      if (!surface) return;
      const items = [...surface.querySelectorAll('[role="menuitem"]')]
        .filter((item) => !item.disabled && !item.hidden && item.getClientRects().length);
      if (!items.length) return;
      const current = items.indexOf(document.activeElement);
      const move = (index) => {
        event.preventDefault();
        items[(index + items.length) % items.length]?.focus();
      };
      if (event.key === "ArrowDown") move(current < 0 ? 0 : current + 1);
      if (event.key === "ArrowUp") move(current < 0 ? items.length - 1 : current - 1);
      if (event.key === "Home") move(0);
      if (event.key === "End") move(items.length - 1);
    });
  }
  root.querySelectorAll?.("[data-beui-menu-surface]").forEach((surface) => {
    surface.querySelectorAll('[role="menuitem"]').forEach((item) => {
      if (!item.hasAttribute("tabindex")) item.tabIndex = -1;
    });
  });
}

function handleDocumentMenuAction(action, docId) {
  if (action === "preview") {
    previewDossierDocument(docId);
    return;
  }
  if (action === "link-generated") {
    startDocumentAutomation(docId, "link-generated");
    return;
  }
  if (action === "queue") {
    addRowsToQueue(rowsForBatchAction());
    return;
  }
  if (action === "remove") {
    const row = selectedRow();
    void removeSupportingDocument(docId).catch((error) => {
      const message = error instanceof Error ? error.message : "The supporting document could not be removed.";
      document.getElementById("topStatus").textContent = `Removal blocked: ${message}`;
      addShellEvent("Supporting document removal blocked", message, "blocked", true, { row, source: "Document Prep" });
    });
    return;
  }
  if (action === "add") {
    startDocumentAutomation(docId, "add");
    return;
  }
  openDocumentActionModal(docId, action === "replace" ? "replace" : "add");
}

function previewDossierDocument(docId) {
  state.selectedDossierDocId = docId || selectedDossierDocument()?.id || "discovery-dossier";
  state.discoveryOpen = false;
  state.railMode = "dossier";
  state.railTab = "docs";
  renderRail();
  setRailOpen(true);
}

function safeDossierPreviewSrcdoc(value = "") {
  // Preview reports as inert documents. The packet can contain generated HTML
  // from different renderers, so a DOM parse is safer than trying to identify
  // executable tags with regular expressions.
  const parsed = new DOMParser().parseFromString(String(value || ""), "text/html");
  parsed.querySelectorAll("script, noscript, iframe, object, embed, base, form, meta[http-equiv='refresh'], link[rel='import']")
    .forEach((element) => element.remove());
  parsed.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const target = String(attribute.value || "").trim().toLowerCase();
      const normalizedTarget = target.replace(/[\u0000-\u0020\u007f]+/g, "");
      const unsafeUrl = /^(?:javascript|vbscript):/i.test(normalizedTarget) || /^data:text\/html/i.test(normalizedTarget);
      if (name.startsWith("on") || name === "srcdoc" || (unsafeUrl && ["href", "src", "action", "formaction", "xlink:href"].includes(name))) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return `<!doctype html>${parsed.documentElement.outerHTML}`;
}

function assetStepStatusHtml(complete, active, index) {
  if (complete) {
    return `<span class="asset-step-status" aria-label="Complete"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12.5 3.8 3.8L18 8" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
  }
  if (active) {
    return `<span class="asset-step-status" aria-label="Working"><span class="dossier-check-spinner"></span></span>`;
  }
  return `<span class="asset-step-status" aria-label="Needed">${String(index + 1).padStart(2, "0")}</span>`;
}

function assetDiscoveryChecklistHtml(row = selectedRow()) {
  const flow = docPrepFlow();
  const phases = docPrepPhases(flow.id);
  const current = currentDiscoveryPhase(flow.id, row);
  return `
    <div class="asset-step-stack" role="list">
      ${phases.map((phase, index) => {
        const complete = phaseIsComplete(phase.id, row, flow.id);
        const active = !complete && phase.id === current.id;
        return `
          <article class="asset-step-row" role="listitem" data-state="${complete ? "complete" : active ? "active" : "pending"}">
            ${assetStepStatusHtml(complete, active, index)}
            <span>
              <span class="dossier-check-title">${escapeHtml(phase.name)}</span>
              <span class="dossier-check-copy">${escapeHtml(phase.summary)}</span>
            </span>
            <span class="dossier-check-action">${complete ? "Done" : active ? "Working" : "Needed"}</span>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function closingRequiredFieldInputsHtml(row = selectedRow(), dossier = dossierForRow(row)) {
  const selectedTemplates = selectedClosingTemplates(row);
  if (!selectedTemplates.length) {
    return `
      <section class="glass-card rail-card">
        <h3>Required closing fields</h3>
        <p class="copy">Choose at least one form above. HeirRight will show only the fields required by that packet and will block export until each value is source-backed or entered.</p>
      </section>
    `;
  }
  const requiredKeys = [...new Set(selectedTemplates.flatMap((template) => template.required ?? []))];
  const variables = closingVariableMap(row, dossier);
  const rows = requiredKeys
    .map((key) => variables.get(key) || closingRegistryEntry(key, displayStatus(key), "", { fallback: "Needs review" }))
    .filter((entry) => !entry.resolved);
  if (!rows.length) {
    return `
      <section class="glass-card rail-card">
        <h3>Required closing fields</h3>
        <p class="copy">Required Closing Prep fields are either source-backed or saved by the operator. Keep final legal review before external use.</p>
      </section>
    `;
  }
  return `
    <section class="glass-card rail-card">
      <h3>Required closing fields</h3>
      <p class="copy">Fill only what the Discovery file or attached deal notes cannot prove. Use “not applicable” only when the review owner confirms the field does not apply.</p>
      <div class="asset-capture-grid">
        ${rows.map((entry) => {
          const record = closingFieldRecord(row, entry.key);
          const resolution = record.resolution || "provided";
          const inputValue = resolution === "supporting_document" ? record.supportingDocumentId || "" : resolution === "not_applicable" ? record.note || "" : record.value || "";
          return `
            <div class="field full">
              <label>${escapeHtml(entry.label)}</label>
              <select data-closing-resolution="${escapeHtml(entry.key)}">
                <option value="provided" ${resolution === "provided" ? "selected" : ""}>Enter reviewed value</option>
                <option value="supporting_document" ${resolution === "supporting_document" ? "selected" : ""}>Needs supporting document</option>
                ${entry.key === "foreclosure_case" ? `<option value="not_applicable" ${resolution === "not_applicable" ? "selected" : ""}>Not applicable with reason</option>` : ""}
              </select>
              <input data-closing-field="${escapeHtml(entry.key)}" value="${escapeHtml(inputValue)}" placeholder="${escapeHtml(resolution === "supporting_document" ? "Supporting document ID or file name" : resolution === "not_applicable" ? "Why this field does not apply" : entry.value)}">
              <span class="field-note">${escapeHtml(resolution === "supporting_document" ? "This remains blocked until the supporting document yields a reviewed value." : resolution === "not_applicable" ? "A reason is required and will be written as N/A in the approved blank." : "This value fills the mapped blank; legal template language stays unchanged.")}</span>
            </div>
          `;
        }).join("")}
      </div>
      <div class="discovery-actions">
        <span class="copy">${escapeHtml(rows.length)} field${rows.length === 1 ? "" : "s"} blocking Closing Prep export.</span>
        <button class="btn primary solvys-liquid-glass" type="button" data-save-closing-fields>Save Required Fields</button>
      </div>
    </section>
  `;
}

function closingTemplateSelectionHtml(row = selectedRow(), dossier = dossierForRow(row)) {
  const selectedIds = new Set(selectedClosingTemplateIds(row));
  return `
    <section class="glass-card rail-card">
      <h3>Choose forms</h3>
      <p class="copy">Include only the legal forms this estate needs. Unchecked forms are excluded from the PDF and do not create blockers.</p>
      <div class="closing-template-picker" role="group" aria-label="Closing forms for this estate">
        ${closingTemplateFamilies.map((template) => {
          const included = selectedIds.has(template.id);
          const blockerCount = included ? closingTemplateBlockers(template, row, dossier).length : 0;
          return `
            <label class="closing-template-option">
              <input type="checkbox" data-closing-template="${escapeHtml(template.id)}" ${included ? "checked" : ""}>
              <span><strong>${escapeHtml(template.title)}</strong><span>${escapeHtml(template.copy)}</span></span>
              <em>${escapeHtml(included ? blockerCount ? `${blockerCount} missing` : "Ready" : "Excluded")}</em>
            </label>
          `;
        }).join("")}
      </div>
      <span class="copy">${escapeHtml(selectedIds.size ? `${selectedIds.size} form${selectedIds.size === 1 ? "" : "s"} selected for this estate.` : "Choose at least one form to continue.")}</span>
    </section>
  `;
}

function wireClosingFieldControls(content, row = selectedRow()) {
  content.querySelectorAll("[data-closing-template]").forEach((input) => {
    input.addEventListener("change", () => {
      setClosingTemplateSelected(row, input.dataset.closingTemplate, input.checked);
      addShellEvent("Closing form selection saved", `${input.checked ? "Included" : "Excluded"} ${closingTemplateFamilies.find((template) => template.id === input.dataset.closingTemplate)?.title || "Closing form"} for ${docPrepEstateLabel(row)}.`, "review", false);
      renderDossiersView();
      renderRail();
    });
  });
  content.querySelector("[data-save-closing-fields]")?.addEventListener("click", () => {
    content.querySelectorAll("[data-closing-field]").forEach((input) => {
      const key = input.dataset.closingField;
      const resolution = content.querySelector(`[data-closing-resolution="${CSS.escape(key)}"]`)?.value || "provided";
      const entered = input.value.trim();
      setClosingFieldOverride(
        row,
        key,
        resolution === "provided" ? entered : "",
        resolution === "not_applicable" ? entered : resolution === "supporting_document" ? "Waiting for supporting document review." : "Saved from Closing Prep required-field panel.",
        resolution,
        resolution === "supporting_document" ? entered : ""
      );
    });
    addShellEvent("Closing fields saved", "Required Closing Prep values were saved to the estate file. Legal-template language was not changed.", "ready", false);
    renderDossiersView();
    renderRail();
  });
}

function closingWorkflowPanelHtml(row = selectedRow(), dossier = dossierForRow(row)) {
  const report = dossier?.completedLeadReport ?? {};
  const offer = report.offerMath ?? {};
  const packet = packetArtifactForRow(row, "closing-docs");
  const selectedTemplates = selectedClosingTemplates(row);
  const fieldBlockers = selectedClosingBlockers(row, dossier);
  const exportReady = selectedTemplates.length > 0 && fieldBlockers.length === 0 && assetPhaseComplete(row, "title-clearance") && assetPhaseComplete(row, "seller-approval");
  const templateSummaries = closingTemplateFamilies.map((template) => ({
    title: template.title,
    status: closingTemplateStatus(template, row, dossier),
    blockers: selectedClosingTemplateIds(row).includes(template.id) ? closingTemplateBlockers(template, row, dossier).length : 0
  }));
  const rows = [
    ["Estate source", row?.sourceKind === "crm-import" ? `${displayStatus(row.sourceProvider)} imported record` : "Current estate record"],
    ["Title proof", assetPhaseComplete(row, "title-clearance") ? "Deed and tax evidence captured" : "Needs deed and tax evidence"],
    ["Seller contacts", acceptedContactCandidates(row).length ? `${acceptedContactCandidates(row).length} accepted` : "Needs accepted signer contacts"],
    ["Offer math", offer.offerAmount ? moneyClaimValue(offer.offerAmount) : "Needs underwriting review"],
    ["Bundle state", state.queueIds.has(row?.id) ? "Queued for export prep" : "Not queued"]
  ];
  return `
    <section class="glass-card rail-card">
      <h3>Closing package inputs</h3>
      <p class="copy">Closing Prep reuses the same estate facts, source attachments, imported record, contact decisions, and offer math. Add source facts once; reuse them across every closing document.</p>
      <ul class="mini-list">
        ${rows.map(([label, value]) => `<li><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></li>`).join("")}
      </ul>
      <div class="discovery-actions">
        <span class="copy">${escapeHtml(packet?.verification?.verified ? "The immutable Closing PDF passed artifact and Discovery File readback." : exportReady ? "The selected forms and required fields are ready to generate." : "Choose forms, resolve their required fields, and finish title/seller review before generation.")}</span>
        <button class="btn primary solvys-liquid-glass" type="button" data-generate-closing-pdf ${exportReady ? "" : "disabled"}>Generate Closing PDF</button>
      </div>
      ${packet?.artifactUrl ? `<a class="text-link" href="${escapeHtml(packet.artifactUrl)}" target="_blank" rel="noopener">Open verified PDF</a>` : ""}
    </section>
    ${closingTemplateSelectionHtml(row, dossier)}
    ${closingRequiredFieldInputsHtml(row, dossier)}
    <section class="glass-card rail-card">
      <h3>Closing template families</h3>
      <p class="copy">Only selected forms enter the generated PDF; excluded forms create no blockers.</p>
      <ul class="mini-list">
        ${templateSummaries.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.blockers ? `${item.blockers} blocker${item.blockers === 1 ? "" : "s"}` : item.status)}</span></li>`).join("")}
      </ul>
    </section>
  `;
}

function sourceRunTone(status = "") {
  if (status === "partial") return "review";
  if (status === "blocked" || status === "needs_review") return "blocked";
  if (status === "ready") return "ready";
  return "neutral";
}

function sourceRunStatusLabel(status = "") {
  if (status === "partial") return "Facts found";
  if (status === "blocked") return "Blocked";
  if (status === "needs_review") return "Needs review";
  if (status === "ready") return "Ready";
  return "Not checked";
}

function sourceProofTone(proofState = "") {
  if (proofState === "facts_returned_review_required") return "review";
  if (proofState === "blocked" || proofState === "evidence_required") return "blocked";
  return "neutral";
}

function sourceProofLabel(proofState = "") {
  if (proofState === "facts_returned_review_required") return "Review facts";
  if (proofState === "evidence_required") return "Needs evidence";
  if (proofState === "blocked") return "Blocked";
  return "Not checked";
}

function sourceDetailTone(status = "") {
  if (status === "evidence_returned_review_required" || status === "ready_for_review") return "review";
  if (status === "complete" || status === "completed") return "ready";
  if (status === "evidence_required" || status === "approval_required" || status === "manual_review_required") return "blocked";
  return "neutral";
}

function sourceDetailLabel(status = "") {
  if (status === "evidence_returned_review_required") return "Evidence found";
  if (status === "ready_for_review") return "Review";
  if (status === "complete" || status === "completed") return "Done";
  if (status === "approval_required") return "Approval";
  if (status === "manual_review_required") return "Manual";
  if (status === "evidence_required") return "Needs evidence";
  return "Check";
}

function sourceProofOperatorAction(item = {}) {
  const source = item.source || "";
  if (source === "property_appraiser") return "Review owner name, folio, mailing address, recent sale, and stop-rule signals before moving the lead forward.";
  if (source === "tax_collector") return item.proofState === "facts_returned_review_required"
    ? "Confirm the Tax Collector listing and capture the bottom-right receipt link, payer, paid date, unpaid years, and reassessment notes."
    : "Paste the Tax Collector listing page or connect the browser workflow before receipt and payer fields can count.";
  if (source === "official_records") return "Attach the latest deed or connect Clerk commercial access before OR book/page, instrument, grantor, grantee, lien, or mortgage facts count.";
  if (source === "probate_court") return "Attach or connect the probate, civil, or family docket before case status, affidavits of heirs, and court documents count.";
  if (source === "clerk_of_courts") return "Review obituary, marriage-license, death-certificate, memorial, and deceased-indicator sources before DOB/DOD or spouse signals count.";
  if (source === "idi") return "Run one approved IDI asset search or import the approved report; keep contacts review-only until accepted.";
  if (source === "skip_trace") return "Leave skip trace off until provider access and approval are present.";
  if (source === "source_governance") return "Review manual and paid research policy before using voter, social, license, business/address, or field findings.";
  return item.nextAction || "Review this source before completing Discovery.";
}

function sourceRunProofHtml(run = {}) {
  const proof = run.sourceRunProof && typeof run.sourceRunProof === "object" ? run.sourceRunProof : null;
  const sources = Array.isArray(proof?.sources) ? proof.sources : [];
  if (!sources.length) return "";
  const unresolvedDetails = Number(proof.blockingDetailCheckCount || proof.unresolvedDetailCheckCount || 0);
  const completionCopy = proof.readyForOperatorReview
    ? "All source buckets returned evidence for operator review. Closing Prep still waits for reviewed Discovery facts."
    : unresolvedDetails
      ? `This run is not complete. ${unresolvedDetails} source checklist item${unresolvedDetails === 1 ? "" : "s"} still block Discovery from moving forward.`
      : "This run is not complete. Review the blocked and missing evidence rows before Discovery can move forward.";
  return `
    <p class="copy">What this run proved: ${escapeHtml(completionCopy)}</p>
    <ul class="mini-list source-proof-list">
      ${sources.map((item) => `
        <li data-source-proof-row="${escapeHtml(item.source || item.label || "source")}">
          <strong>${escapeHtml(item.label || displayStatus(item.source, "Source"))} ${statusPill(sourceProofTone(item.proofState), sourceProofLabel(item.proofState))}</strong>
          <span>${escapeHtml(sourceProofOperatorAction(item))}</span>
          ${sourceProofDetailChecksHtml(item)}
        </li>
      `).join("")}
    </ul>
  `;
}

function sourceProofDetailChecksHtml(item = {}) {
  const checks = Array.isArray(item.detailChecks) ? item.detailChecks : [];
  if (!checks.length) return "";
  const showAllChecks = ["source_governance", "idi", "skip_trace"].includes(item.source);
  const visibleChecks = showAllChecks
    ? checks
    : checks.filter((check) => check.blocksUntilCaptured).concat(checks.filter((check) => !check.blocksUntilCaptured)).slice(0, 4);
  if (!visibleChecks.length) return "";
  return `
    <ul class="source-proof-detail-list">
      ${visibleChecks.map((check) => `
        <li data-source-proof-detail="${escapeHtml(check.code || check.label || "check")}">
          <span>${escapeHtml(check.label || displayStatus(check.code, "Check"))} ${statusPill(sourceDetailTone(check.status), sourceDetailLabel(check.status))}</span>
          <small>${escapeHtml(check.operatorAction || "Review this source step before Discovery completion.")}</small>
        </li>
      `).join("")}
    </ul>
  `;
}

function sourceRunSummaryHtml(capture = {}) {
  const run = capture.sourceApiRun;
  if (!run) {
    return `
      <p class="copy">Run the source search to check county/property sources from this estate record. The app will keep public-source blockers visible instead of filling blanks.</p>
    `;
  }
  const summaries = Array.isArray(run.sourceSummaries) ? run.sourceSummaries : [];
  const blockers = Array.isArray(run.blockers) ? run.blockers : [];
  const checked = summaries.filter((item) => Number(item.factCount) > 0).length;
  const blocked = summaries.filter((item) => item.status === "blocked" || item.status === "needs_review").length;
  const runTime = run.generatedAt ? new Date(run.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "just now";
  const receiptRun = capture.taxCollectorReceiptRun && typeof capture.taxCollectorReceiptRun === "object" ? capture.taxCollectorReceiptRun : null;
  const receiptRunLine = receiptRun ? `
      <li><strong>Tax Collector receipt run ${statusPill(receiptRun.ok ? "review" : "blocked", receiptRun.ok ? "Receipt found" : "Blocked")}</strong><span>${escapeHtml(receiptRun.message || "Tax Collector receipt search result recorded.")}</span></li>
    ` : "";
  return `
    <p class="copy">${escapeHtml(run.message || `Source search checked ${checked} source${checked === 1 ? "" : "s"}. ${blocked ? `${blocked} still need review.` : "No source blockers returned."}`)} Last checked ${escapeHtml(runTime)}.</p>
    <ul class="mini-list source-run-list">
      ${receiptRunLine}
      ${summaries.map((summary) => `
        <li>
          <strong>${escapeHtml(summary.label || displayStatus(summary.source, "Source"))} ${statusPill(sourceRunTone(summary.status), sourceRunStatusLabel(summary.status))}</strong>
          <span>${escapeHtml(summary.nextAction || "Review this source before completing Discovery.")}</span>
        </li>
      `).join("") || `<li><strong>Source search</strong><span>No source checks returned yet.</span></li>`}
      ${blockers.length ? `<li><strong>Open review items</strong><span>${escapeHtml(blockers.slice(0, 3).join(" "))}</span></li>` : ""}
    </ul>
    ${sourceRunProofHtml(run)}
  `;
}

function sourceReadinessLabel(connection, fallback = "Needs setup") {
  if (!connection) return fallback;
  if (connection.ok && connection.mode === "live") return "Live";
  if (connection.ok && connection.mode === "review") return "Ready";
  if (connection.ok) return displayStatus(connection.mode, "Ready");
  return connection.mode ? displayStatus(connection.mode) : fallback;
}

function sourceReadinessItems() {
  const tax = connectionByName("Tax Collector Source");
  const clerk = connectionByName("Miami-Dade Clerk API");
  const vital = connectionByName("Vital/Obituary Workflow");
  const idi = connectionByName("IDI Core");
  return [
    {
      title: "Tax receipts",
      connection: tax,
      copy: operatorConnectionMessage(tax, "Tax Collector Source"),
    },
    {
      title: "Clerk records",
      connection: clerk,
      copy: operatorConnectionMessage(clerk, "Miami-Dade Clerk API"),
    },
    {
      title: "Obituary and vital review",
      connection: vital,
      copy: operatorConnectionMessage(vital, "Vital/Obituary Workflow"),
    },
    {
      title: "IDI asset search",
      connection: idi,
      copy: operatorConnectionMessage(idi, "IDI Core"),
    },
    {
      title: "Manual research",
      tone: "review",
      label: "Review-only",
      copy: "Voter, social, professional-license, business/address, field, and paid people-search checks stay approval-gated until reviewed.",
    },
  ];
}

function sourceReadinessHtml() {
  const loading = !state.connections.length;
  const items = sourceReadinessItems();
  return `
    <div data-source-readiness-panel>
      <p class="copy">${loading ? "Checking source readiness before public-record search." : "Source readiness before this run:"}</p>
      <ul class="mini-list source-readiness-list">
        ${items.map((item) => {
          const tone = item.tone || connectionTone(item.connection);
          const label = item.label || sourceReadinessLabel(item.connection);
          return `
            <li data-source-readiness-row="${escapeHtml(item.title)}">
              <strong>${escapeHtml(item.title)} ${statusPill(tone, label)}</strong>
              <span>${escapeHtml(item.copy)}</span>
            </li>
          `;
        }).join("")}
      </ul>
    </div>
  `;
}

function assetCaptureFormHtml(row = selectedRow()) {
  const capture = sourceCaptureForRow(row);
  return `
    <section class="glass-card rail-card">
      <h3>Public-record capture</h3>
      <p class="copy">Run source search from the estate facts first. HeirRight searches Tax Collector by folio, address, and owner, opens the matching listing, then captures the receipt link shown in the bottom-right corner. Manual fields below are fallback review only.</p>
      ${sourceReadinessHtml()}
      ${sourceRunSummaryHtml(capture)}
      <div class="asset-capture-grid">
        <div class="field full"><label>Tax Collector listing page</label><input data-source-capture-field="taxReceipt.listingUrl" value="${escapeHtml(capture.taxReceipt?.listingUrl ?? "")}" placeholder="Tax Collector parcel/listing page URL"></div>
        <div class="field full"><label>Bottom-right receipt link</label><input data-source-capture-field="taxReceipt.receiptLink" value="${escapeHtml(capture.taxReceipt?.receiptLink ?? capture.taxReceipt?.sourceUrl ?? "")}" placeholder="Receipt link from the listing page"></div>
        <div class="field"><label>Tax paid by</label><input data-source-capture-field="taxReceipt.paidBy" value="${escapeHtml(capture.taxReceipt?.paidBy ?? "")}" placeholder="Name on last paid receipt"></div>
        <div class="field"><label>Paid date</label><input data-source-capture-field="taxReceipt.paidDate" value="${escapeHtml(capture.taxReceipt?.paidDate ?? "")}" placeholder="Date shown on receipt"></div>
        <div class="field"><label>Amount due</label><input data-source-capture-field="taxReceipt.amountDue" value="${escapeHtml(capture.taxReceipt?.amountDue ?? "")}" placeholder="$0.00 or amount from record"></div>
        <div class="field"><label>Unpaid years</label><input data-source-capture-field="taxReceipt.unpaidYears" value="${escapeHtml(capture.taxReceipt?.unpaidYears ?? "")}" placeholder="Example: 2024, 2025"></div>
        <div class="field"><label>Reassessment</label><input data-source-capture-field="taxReceipt.reassessment" value="${escapeHtml(capture.taxReceipt?.reassessment ?? "")}" placeholder="Reassessment note from tax record"></div>
        <div class="field"><label>Receipt status</label><select data-source-capture-field="taxReceipt.status"><option value="">Needs review</option><option value="receipt_link_captured" ${capture.taxReceipt?.status === "receipt_link_captured" ? "selected" : ""}>Receipt link captured</option><option value="paid_receipt_reviewed" ${capture.taxReceipt?.status === "paid_receipt_reviewed" ? "selected" : ""}>Paid receipt reviewed</option><option value="browser_workflow_required" ${capture.taxReceipt?.status === "browser_workflow_required" ? "selected" : ""}>Browser workflow blocked</option><option value="unavailable_after_listing_check" ${capture.taxReceipt?.status === "unavailable_after_listing_check" ? "selected" : ""}>Unavailable after listing check</option></select></div>
        <div class="field full"><label>Official Records search page</label><input data-source-capture-field="deed.sourceUrl" value="${escapeHtml(capture.deed?.sourceUrl ?? "")}" placeholder="Official Records search/result URL"></div>
        <div class="field"><label>Deed OR / instrument</label><input data-source-capture-field="deed.instrument" value="${escapeHtml(capture.deed?.instrument ?? capture.deed?.instrumentNumber ?? "")}" placeholder="OR book/page or instrument"></div>
        <div class="field"><label>Recorded deed file</label><input data-source-capture-field="deed.documentUrl" value="${escapeHtml(capture.deed?.documentUrl ?? capture.deed?.fileName ?? "")}" placeholder="PDF/link for the latest recorded deed"></div>
        <div class="field"><label>Book</label><input data-source-capture-field="deed.book" value="${escapeHtml(capture.deed?.book ?? "")}" placeholder="OR book"></div>
        <div class="field"><label>Page</label><input data-source-capture-field="deed.page" value="${escapeHtml(capture.deed?.page ?? "")}" placeholder="OR page"></div>
        <div class="field"><label>Recording date</label><input data-source-capture-field="deed.recordingDate" value="${escapeHtml(capture.deed?.recordingDate ?? "")}" placeholder="Date recorded"></div>
        <div class="field"><label>Document type</label><input data-source-capture-field="deed.documentType" value="${escapeHtml(capture.deed?.documentType ?? "")}" placeholder="Warranty deed, quit claim, etc."></div>
        <div class="field"><label>Grantor</label><input data-source-capture-field="deed.grantor" value="${escapeHtml(capture.deed?.grantor ?? "")}" placeholder="Seller/grantor shown"></div>
        <div class="field"><label>Grantee</label><input data-source-capture-field="deed.grantee" value="${escapeHtml(capture.deed?.grantee ?? "")}" placeholder="Buyer/grantee shown"></div>
        <div class="field"><label>Last sale date</label><input data-source-capture-field="deed.lastSaleDate" value="${escapeHtml(capture.deed?.lastSaleDate ?? "")}" placeholder="Last sale or transfer date"></div>
        <div class="field"><label>Mortgage signal</label><input data-source-capture-field="deed.mortgageSignal" value="${escapeHtml(capture.deed?.mortgageSignal ?? "")}" placeholder="Present, absent, or needs review"></div>
        <div class="field"><label>Lien signal</label><input data-source-capture-field="deed.lienSignal" value="${escapeHtml(capture.deed?.lienSignal ?? "")}" placeholder="Present, absent, or needs review"></div>
        <div class="field"><label>Lis Pendens</label><input data-source-capture-field="deed.lisPendensSignal" value="${escapeHtml(capture.deed?.lisPendensSignal ?? "")}" placeholder="Present, absent, or needs review"></div>
        <div class="field"><label>Foreclosure signal</label><input data-source-capture-field="deed.foreclosureSignal" value="${escapeHtml(capture.deed?.foreclosureSignal ?? "")}" placeholder="Present, absent, or needs review"></div>
        <div class="field"><label>Adverse possession</label><input data-source-capture-field="deed.adversePossessionSignal" value="${escapeHtml(capture.deed?.adversePossessionSignal ?? "")}" placeholder="Present, absent, or needs review"></div>
        <div class="field"><label>Property Appraiser owner</label><input data-source-capture-field="propertyAppraiser.owner" value="${escapeHtml(capture.propertyAppraiser?.owner ?? capture.propertyAppraiser?.ownerName ?? "")}" placeholder="Owner exactly as shown"></div>
        <div class="field"><label>Property Appraiser folio</label><input data-source-capture-field="propertyAppraiser.folio" value="${escapeHtml(capture.propertyAppraiser?.folio ?? capture.propertyAppraiser?.parcelId ?? "")}" placeholder="Folio / parcel number"></div>
        <div class="field full"><label>Property Appraiser property address</label><input data-source-capture-field="propertyAppraiser.address" value="${escapeHtml(capture.propertyAppraiser?.address ?? capture.propertyAppraiser?.propertyAddress ?? "")}" placeholder="Property address exactly as shown"></div>
        <div class="field full"><label>Property Appraiser mailing address</label><input data-source-capture-field="propertyAppraiser.mailingAddress" value="${escapeHtml(capture.propertyAppraiser?.mailingAddress ?? capture.propertyAppraiser?.mailingAddressSignal ?? "")}" placeholder="Mailing address or mismatch note"></div>
        <div class="field full"><label>Property Appraiser source</label><input data-source-capture-field="propertyAppraiser.sourceUrl" value="${escapeHtml(capture.propertyAppraiser?.sourceUrl ?? "")}" placeholder="Property Appraiser parcel URL"></div>
        <div class="field full"><label>Probate docket page</label><input data-source-capture-field="probate.docketUrl" value="${escapeHtml(capture.probate?.docketUrl ?? capture.probate?.sourceUrl ?? "")}" placeholder="Clerk/probate docket URL"></div>
        <div class="field"><label>Probate case number</label><input data-source-capture-field="probate.caseNumber" value="${escapeHtml(capture.probate?.caseNumber ?? "")}" placeholder="Case number from docket"></div>
        <div class="field"><label>Probate case status</label><input data-source-capture-field="probate.caseStatus" value="${escapeHtml(capture.probate?.caseStatus ?? "")}" placeholder="Open, closed, pending, etc."></div>
        <div class="field"><label>Affidavit of heirs</label><input data-source-capture-field="probate.affidavitOfHeirsStatus" value="${escapeHtml(capture.probate?.affidavitOfHeirsStatus ?? "")}" placeholder="Available, missing, requested"></div>
        <div class="field"><label>Probate documents</label><input data-source-capture-field="probate.documentAvailability" value="${escapeHtml(capture.probate?.documentAvailability ?? "")}" placeholder="Available documents or request needed"></div>
        <div class="field"><label>Related docket</label><input data-source-capture-field="probate.docketNumber" value="${escapeHtml(capture.probate?.docketNumber ?? "")}" placeholder="Civil/family docket if found"></div>
        <div class="field"><label>Related case type</label><input data-source-capture-field="probate.caseType" value="${escapeHtml(capture.probate?.caseType ?? "")}" placeholder="Civil, family, probate"></div>
        <div class="field"><label>Obituary status</label><select data-source-capture-field="obituary.status"><option value="">Needs review</option><option value="found" ${capture.obituary?.status === "found" ? "selected" : ""}>Found</option><option value="reviewed-not-found" ${capture.obituary?.status === "reviewed-not-found" ? "selected" : ""}>Reviewed not found</option></select></div>
        <div class="field"><label>Obituary link or snapshot</label><input data-source-capture-field="obituary.sourceUrl" value="${escapeHtml(capture.obituary?.sourceUrl ?? capture.obituary?.fileName ?? "")}" placeholder="Obituary URL or screenshot file"></div>
        <div class="field"><label>Date of birth</label><input data-source-capture-field="obituary.dateOfBirth" value="${escapeHtml(capture.obituary?.dateOfBirth ?? "")}" placeholder="DOB from obituary/vital source"></div>
        <div class="field"><label>Date of death</label><input data-source-capture-field="obituary.dateOfDeath" value="${escapeHtml(capture.obituary?.dateOfDeath ?? "")}" placeholder="DOD from obituary/vital source"></div>
        <div class="field"><label>Marriage/license signal</label><input data-source-capture-field="obituary.marriageLicenseSignal" value="${escapeHtml(capture.obituary?.marriageLicenseSignal ?? "")}" placeholder="Spouse/marriage signal or absent"></div>
        <div class="field"><label>Death certificate</label><input data-source-capture-field="obituary.deathCertificateStatus" value="${escapeHtml(capture.obituary?.deathCertificateStatus ?? "")}" placeholder="Requested, obtained, missing"></div>
        <div class="field full"><label>Tax source blocker note</label><textarea data-source-capture-field="taxReceipt.sourceBlockedReason" placeholder="Use when the Tax Collector listing page needs a browser workflow, is blocked, or the receipt link cannot be reached from the public result.">${escapeHtml(capture.taxReceipt?.sourceBlockedReason ?? capture.taxReceipt?.blocker ?? "")}</textarea></div>
        <div class="field full"><label>Listing page HTML / source note</label><textarea data-source-capture-field="taxReceipt.listingHtml" placeholder="Optional: paste the Tax Collector listing page source if browser-to-api discovery needs to parse the receipt link.">${escapeHtml(capture.taxReceipt?.listingHtml ?? "")}</textarea></div>
        <div class="field full"><label>Official Records notes</label><textarea data-source-capture-field="deed.note" placeholder="Owner-chain, title, mortgage, lien, or filing notes from Official Records.">${escapeHtml(capture.deed?.note ?? "")}</textarea></div>
        <div class="field full"><label>Obituary / vital notes</label><textarea data-source-capture-field="obituary.googleNote" placeholder="Record obituary, memorial, vital, or reviewed-not-found source notes.">${escapeHtml(capture.obituary?.googleNote ?? "")}</textarea></div>
      </div>
      <div class="discovery-actions">
        <span class="copy">${escapeHtml(capture.updatedAt ? `Saved ${new Date(capture.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not saved yet")}</span>
        <div>
          <button class="btn" type="button" data-run-source-search>Run Source Search</button>
          <button class="btn primary solvys-liquid-glass" type="button" data-save-source-capture>Save Capture</button>
        </div>
      </div>
    </section>
  `;
}

function idiImportPanelHtml(row = selectedRow()) {
  const stored = idiImportForRow(row);
  const idiConnection = connectionByName("IDI Core");
  const idiCredential = idiCoreCredentialStatus(idiConnection);
  const idiPortalUrl = idiConnection?.portal?.searchUrl || "https://idicore.com/search/PropertySearch";
  return `
    <section class="glass-card rail-card">
      <h3>IDI asset search</h3>
      <p class="copy">Run IDI Core once by asset address, then import the report text or attachment metadata. Duplicate paid runs are blocked unless admin override includes a reason.</p>
      ${stored ? `
        <ul class="mini-list">
          <li><strong>Status</strong><span>${escapeHtml(stored.mode === "live_idi_core" ? "Live IDI Core run completed" : stored.duplicateGuard === "admin_override_recorded" ? "Imported with admin override" : "Imported once")}</span></li>
          <li><strong>Paid run</strong><span>${escapeHtml(stored.paidRun ? "Yes - controlled proof" : "No - report import only")}</span></li>
          <li><strong>Duplicate protection</strong><span>${escapeHtml(stored.lockKey ? "On for this estate" : "Waiting for first approved search")}</span></li>
          <li><strong>Contacts found</strong><span>${escapeHtml(stored.candidates?.length ?? 0)} candidates, ${escapeHtml(acceptedContactCandidates(row).length)} accepted</span></li>
        </ul>
      ` : ""}
      <div class="idi-import-grid">
        <div class="field"><label>Report label</label><input data-idi-report-label value="${escapeHtml(stored?.attachment?.label ?? "IDI expanded asset search")}"></div>
        <div class="field"><label>Source link / file</label><input data-idi-report-source value="${escapeHtml(stored?.attachment?.sourceUrl ?? stored?.attachment?.fileName ?? "")}" placeholder="IDI report PDF, CSV, or source note"></div>
        <div class="field full">
          <label>IDI access</label>
          <span class="copy">${escapeHtml(idiCredential.copy)} Personal API-key entry is disabled; approved runs use the server-side team connection.</span>
        </div>
        <div class="field full"><label>IDI report text</label><textarea data-idi-import-text placeholder="Paste likely relatives and associates from the expanded asset report.">${escapeHtml(stored?.importedText ?? "")}</textarea></div>
        <div class="field full"><label>Admin override reason</label><input data-idi-admin-reason value="" placeholder="Only required if replacing an existing imported IDI asset search"></div>
      </div>
      <div class="discovery-actions">
        <span class="copy">Raw IDI import does not raise the score until contacts are accepted. ${escapeHtml(idiCredential.label)}.</span>
        <div>
          <a class="btn" href="${escapeHtml(idiPortalUrl)}" target="_blank" rel="noreferrer">Open idiCORE</a>
          <button class="btn" type="button" data-run-live-idi>Run live IDI Core</button>
          <button class="btn primary solvys-liquid-glass" type="button" data-import-idi>Import approved report</button>
        </div>
      </div>
    </section>
  `;
}

function contactCandidateMeta(candidate) {
  const pieces = [
    displayStatus(candidate.relationship, "Relative"),
    candidate.interest || "",
    candidate.age ? `age ${candidate.age}` : "",
    candidate.ownerLastNameMatch ? "last-name match" : "last-name unchecked",
    candidate.phones?.length ? `${candidate.phones.length} phone${candidate.phones.length === 1 ? "" : "s"}` : "no phone",
    candidate.emails?.length ? `${candidate.emails.length} email${candidate.emails.length === 1 ? "" : "s"}` : "no email",
  ];
  return pieces.filter(Boolean).join(" · ");
}

function contactReviewRowsHtml(row, groupLabel, contacts) {
  return `
    <h3>${escapeHtml(groupLabel)}</h3>
    <div class="contact-review-list">
      ${contacts.map((candidate) => {
        const status = candidateReviewState(row, candidate);
        return `
          <article class="contact-review-row" data-contact-status="${escapeHtml(status)}">
            <span>
              <span class="dossier-check-title">${escapeHtml(candidate.name)}</span>
              <span class="dossier-check-copy">${escapeHtml(contactCandidateMeta(candidate))}${candidate.currentAddress ? ` · ${escapeHtml(candidate.currentAddress)}` : ""}</span>
            </span>
            <span class="contact-review-actions">
              ${statusPill(status === "accepted" || status === "promoted" ? "ready" : status === "rejected" ? "blocked" : "review", displayStatus(status))}
              <button class="btn" type="button" data-contact-review="${escapeHtml(candidate.id)}" data-contact-status="accepted">Accept</button>
              <button class="btn" type="button" data-contact-review="${escapeHtml(candidate.id)}" data-contact-status="promoted">Promote</button>
              <button class="btn" type="button" data-contact-review="${escapeHtml(candidate.id)}" data-contact-status="rejected">Reject</button>
            </span>
          </article>
        `;
      }).join("") || `<p class="copy">No ${escapeHtml(groupLabel.toLowerCase())} imported yet.</p>`}
    </div>
  `;
}

function contactReviewPanelHtml(row = selectedRow()) {
  const primary = primaryContactCandidates(row);
  const alternative = alternativeContactCandidates(row);
  return `
    <section class="glass-card rail-card">
      <h3>Contact review</h3>
      <p class="copy">Accept spouse and children first. Remaining relatives and associates stay in Alternative Contacts unless promoted.</p>
      ${contactReviewRowsHtml(row, "Primary secondary contacts", primary)}
      ${contactReviewRowsHtml(row, "Alternative Contacts", alternative)}
    </section>
  `;
}

async function saveContactCandidateReview(row, candidateId, status, reportRevision = "") {
  candidateId = String(candidateId || "").trim();
  status = String(status || "").trim();
  if (!row || !candidateId) throw new Error("Select an IDI contact candidate first.");
  const key = assetDiscoveryKey(row);
  const currentRevision = idiContactReviewRevision(row);
  if (!["accepted", "promoted", "rejected"].includes(status)) throw new Error("Choose a valid contact decision.");
  if (!currentRevision || String(reportRevision || "") !== currentRevision) {
    throw new Error("The IDI report changed before this contact decision could be saved.");
  }
  if (!contactCandidatesForRow(row).some((candidate) => String(candidate.id || "") === candidateId)) {
    throw new Error("This contact candidate is no longer part of the current IDI report.");
  }
  try {
    const result = await postJson(`/api/discovery/contact-candidates/${encodeURIComponent(candidateId)}/review`, {
      assetKey: key,
      leadId: row.id,
      status,
      reviewedBy: state.session?.user?.email || "team"
    });
    const verifiedReview = verifiedContactReviewResult(result, status);
    if (idiContactReviewRevision(row) !== currentRevision) {
      throw new Error("The IDI report changed before the saved contact decision could be confirmed.");
    }
    state.contactReviews[key] = {
      ...(state.contactReviews[key] ?? {}),
      [candidateId]: verifiedReview
    };
    addShellEvent("Contact review updated", `${displayStatus(status)} was saved for the selected IDI contact candidate.`, status === "rejected" ? "review" : "ready", false, { row, source: "IDI contact review" });
    return verifiedReview;
  } catch (error) {
    addShellEvent("Contact review not saved", error instanceof Error ? error.message : "The shared review write failed, so the prior decision remains unchanged.", "blocked", true, { row, source: "IDI contact review" });
    throw error;
  } finally {
    rerenderAssetDiscoverySurface();
  }
}

function verifiedContactReviewResult(result, requestedStatus) {
  const review = result?.review && typeof result.review === "object" ? result.review : {};
  const status = cleanDisplayValue(result?.status || review.status);
  const reviewedAt = result?.reviewedAt || review.reviewedAt;
  const reviewedBy = cleanDisplayValue(result?.reviewedBy || review.reviewedBy);
  if (result?.ok !== true || result?.readbackStatus !== "verified" || status !== requestedStatus || !reviewedAt || !reviewedBy) {
    throw new Error("The contact review did not pass shared storage readback, so it was not saved.");
  }
  return { status, reviewedAt, reviewedBy };
}

function setNestedValue(target, path, value) {
  const [head, ...tail] = String(path || "").split(".");
  if (!head) return;
  if (!tail.length) {
    target[head] = value;
    return;
  }
  target[head] = target[head] && typeof target[head] === "object" ? target[head] : {};
  setNestedValue(target[head], tail.join("."), value);
}

function collectSourceCapturePayload(root, row) {
  const payload = {
    assetKey: assetDiscoveryKey(row),
    leadId: row?.id,
    owner: row?.owner || row?.title,
    address: row?.address,
    capturedAt: new Date().toISOString(),
    capturedBy: state.session?.user?.email || state.session?.email || "team"
  };
  root.querySelectorAll("[data-source-capture-field]").forEach((field) => {
    setNestedValue(payload, field.dataset.sourceCaptureField, field.value.trim());
  });
  return payload;
}

function externalSourceRunPayload(row, capture, key) {
  const idiImport = idiImportForRow(row);
  const contactReviews = contactReviewsForRow(row);
  const payload = {
    operatorIntent: "run_external_source_search",
    assetKey: key,
    leadId: row?.id,
    seed: {
      ownerName: row?.owner || row?.title || capture.owner,
      estateName: row?.leadName || row?.title || capture.owner,
      propertyAddress: row?.address || capture.address,
      parcelId: row?.parcel || capture.propertyAppraiser?.folio,
      county: row?.county || capture.county || "miami-dade",
      taxCollectorListingUrl: capture.taxReceipt?.listingUrl,
      taxCollectorReceiptUrl: capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl,
    },
    capture,
    includeSkipTrace: false
  };
  if (idiImport) {
    payload.idiAssetImport = {
      provider: idiImport.provider || "idi",
      mode: idiImport.mode || "operator_import",
      paidRun: Boolean(idiImport.paidRun),
      paidRunApproved: idiImport.mode === "live_idi_core" || idiImport.paidRun === true,
      readbackStatus: idiImport.readbackStatus || "",
      apiKeySource: idiImport.apiKeySource || "",
      approvalRecord: idiImport.sourceEvidence || idiImport.approvalRecord || null,
      lockKey: idiImport.lockKey || assetDiscoveryKey(row),
      importedText: idiImport.importedText || "",
      adminOverrideReason: idiImport.adminOverrideReason || "",
      attachment: idiImport.attachment || null,
      contactReviews,
      candidates: contactCandidatesForRow(row).map((candidate) => ({
        ...candidate,
        reviewStatus: candidateReviewState(row, candidate)
      }))
    };
  }
  return payload;
}

function sourceFactByType(facts = [], source, factTypes = []) {
  const types = new Set(factTypes);
  const matches = facts.filter((fact) => fact?.source === source && types.has(fact.factType));
  return matches.find((fact) => {
    if (fact.value === undefined || fact.value === null || fact.value === "") return false;
    if (Array.isArray(fact.value)) return fact.value.length > 0;
    if (typeof fact.value === "object") return Object.keys(fact.value).length > 0;
    return true;
  }) || matches[0];
}

function sourceFactHasFlag(fact, flag) {
  return Array.isArray(fact?.reviewFlags) && fact.reviewFlags.includes(flag);
}

function taxCaptureDisplayValue(value) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object" && "amount" in value) {
    const amount = Number(value.amount);
    const amountText = Number.isFinite(amount) ? `$${amount.toFixed(2)}` : cleanDisplayValue(value.amount);
    const years = Array.isArray(value.years) && value.years.length ? ` (${value.years.join(", ")})` : "";
    return `${amountText}${years}`;
  }
  return cleanDisplayValue(value);
}

function applyExternalSourceRunResult(row, capture, result) {
  const key = assetDiscoveryKey(row);
  const sourceFacts = Array.isArray(result.sourceFacts) ? result.sourceFacts : [];
  const taxCollectorReceiptRun = result.taxCollectorReceiptRun && typeof result.taxCollectorReceiptRun === "object" ? result.taxCollectorReceiptRun : null;
  const stored = {
    ...(state.sourceCaptures[key] ?? {}),
    ...capture,
    updatedAt: Date.now(),
    sourceFacts,
    ...(result.dossier && typeof result.dossier === "object" ? { dossier: result.dossier } : {}),
    taxCollectorReceiptRun,
    sourceApiRun: {
      ok: Boolean(result.ok),
      mode: result.mode || "external_source_run",
      runId: result.runId || "",
      generatedAt: result.generatedAt || new Date().toISOString(),
      sourceSummaries: Array.isArray(result.sourceSummaries) ? result.sourceSummaries : [],
      sourceRunProof: result.sourceRunProof && typeof result.sourceRunProof === "object" ? result.sourceRunProof : null,
      blockers: Array.isArray(result.blockers) ? result.blockers : [],
      message: result.message || "",
      persistence: result.persistence && typeof result.persistence === "object" ? result.persistence : null
    }
  };
  const taxStatus = sourceFactByType(sourceFacts, "tax_collector", ["source_status"]);
  const taxStatusValue = taxStatus?.value && typeof taxStatus.value === "object" ? taxStatus.value : {};
  if (sourceFactHasFlag(taxStatus, "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED") || taxStatusValue.mode === "browser_workflow_required") {
    setNestedValue(stored, "taxReceipt.status", "browser_workflow_required");
    setNestedValue(stored, "taxReceipt.sourceBlockedReason", taxStatusValue.note || "Open the Tax Collector listing page and capture the receipt link shown in the bottom-right corner.");
  }
  if (taxStatusValue.listingUrl && !stored.taxReceipt?.listingUrl) setNestedValue(stored, "taxReceipt.listingUrl", taxStatusValue.listingUrl);
  if (taxStatusValue.receiptUrl) {
    setNestedValue(stored, "taxReceipt.receiptLink", taxStatusValue.receiptUrl);
    setNestedValue(stored, "taxReceipt.status", "receipt_link_captured");
  }
  const receiptLinkFact = sourceFactByType(sourceFacts, "tax_collector", ["tax_receipt_link"]);
  if (receiptLinkFact?.value) {
    setNestedValue(stored, "taxReceipt.receiptLink", receiptLinkFact.value);
    setNestedValue(stored, "taxReceipt.status", "receipt_link_captured");
  }
  const taxFactMappings = [
    ["tax_last_paid_by", "taxReceipt.paidBy"],
    ["tax_payer_identity", "taxReceipt.payerIdentity"],
    ["tax_paid_date", "taxReceipt.paidDate"],
    ["tax_amount_due", "taxReceipt.amountDue"],
    ["unpaid_tax_years", "taxReceipt.unpaidYears"],
    ["tax_reassessment_signal", "taxReceipt.reassessment"],
  ];
  taxFactMappings.forEach(([factType, targetPath]) => {
    const fact = sourceFactByType(sourceFacts, "tax_collector", [factType]);
    if (fact?.value) setNestedValue(stored, targetPath, taxCaptureDisplayValue(fact.value));
  });
  const canonicalPropertyFact = (factTypes) => sourceFacts.find((fact) => (
    fact?.source === "property_appraiser"
    && factTypes.includes(fact.factType)
    && fact?.sourceUrl
    && !["SOURCE_EVIDENCE_REQUIRED", "SOURCE_HEALTH_ONLY", "SOURCE_BLOCKED", "NO_ENRICHMENT_RUN"].some((flag) => fact?.reviewFlags?.includes?.(flag))
  ));
  const propertyOwnerFact = canonicalPropertyFact(["property_owner"]);
  const propertyAddressFact = canonicalPropertyFact(["property_address"]);
  const propertyFolioFact = canonicalPropertyFact(["property_folio"]);
  const mailingFact = canonicalPropertyFact(["mailing_address", "mailing_address_signal"]);
  const propertySourceFact = propertyOwnerFact || propertyAddressFact || propertyFolioFact || mailingFact;
  if (propertySourceFact?.sourceUrl) setNestedValue(stored, "propertyAppraiser.sourceUrl", propertySourceFact.sourceUrl);
  if (propertyOwnerFact?.value) setNestedValue(stored, "propertyAppraiser.owner", propertyOwnerFact.value);
  if (propertyAddressFact?.value) setNestedValue(stored, "propertyAppraiser.address", propertyAddressFact.value);
  if (propertyFolioFact?.value) setNestedValue(stored, "propertyAppraiser.folio", propertyFolioFact.value);
  if (mailingFact?.value && !stored.propertyAppraiser?.mailingAddress) setNestedValue(stored, "propertyAppraiser.mailingAddress", mailingFact.value);

  const latestDeedFact = sourceFactByType(sourceFacts, "official_records", ["latest_deed", "deed_instrument", "title_chain"]);
  const deedAttachmentFact = sourceFactByType(sourceFacts, "official_records", ["deed_attachment"]);
  const bookPageFact = sourceFactByType(sourceFacts, "official_records", ["or_book_page"]);
  const latestDeed = latestDeedFact?.value && typeof latestDeedFact.value === "object" && !Array.isArray(latestDeedFact.value)
    ? latestDeedFact.value
    : {};
  const deedAttachment = deedAttachmentFact?.value && typeof deedAttachmentFact.value === "object" && !Array.isArray(deedAttachmentFact.value)
    ? deedAttachmentFact.value
    : {};
  const deedInstrument = cleanDisplayValue(
    latestDeed.instrumentNumber
    || latestDeed.instrument
    || latestDeed.documentType
    || latestDeed.orBookPage
    || bookPageFact?.value
    || (typeof latestDeedFact?.value === "string" ? latestDeedFact.value : "")
  );
  const deedDocumentUrl = cleanDisplayValue(
    deedAttachment.url
    || deedAttachment.artifactUrl
    || deedAttachment.documentUrl
    || (typeof deedAttachmentFact?.value === "string" ? deedAttachmentFact.value : "")
  );
  const deedFileName = cleanDisplayValue(deedAttachment.fileName || deedAttachment.name || "");
  const deedSourceUrl = cleanDisplayValue(
    latestDeedFact?.sourceUrl
    || deedAttachmentFact?.sourceUrl
    || bookPageFact?.sourceUrl
    || deedDocumentUrl
  );
  if (deedInstrument || latestDeed.book || latestDeed.page || deedDocumentUrl || deedFileName) {
    if (deedSourceUrl) setNestedValue(stored, "deed.sourceUrl", deedSourceUrl);
    if (deedDocumentUrl) setNestedValue(stored, "deed.documentUrl", deedDocumentUrl);
    if (deedFileName) setNestedValue(stored, "deed.fileName", deedFileName);
    if (deedInstrument) setNestedValue(stored, "deed.instrument", deedInstrument);
    if (latestDeed.instrumentNumber) setNestedValue(stored, "deed.instrumentNumber", cleanDisplayValue(latestDeed.instrumentNumber));
    if (latestDeed.book) setNestedValue(stored, "deed.book", cleanDisplayValue(latestDeed.book));
    if (latestDeed.page) setNestedValue(stored, "deed.page", cleanDisplayValue(latestDeed.page));
    if (latestDeed.grantor || latestDeed.firstParty) setNestedValue(stored, "deed.grantor", cleanDisplayValue(latestDeed.grantor || latestDeed.firstParty));
    if (latestDeed.grantee || latestDeed.secondParty) setNestedValue(stored, "deed.grantee", cleanDisplayValue(latestDeed.grantee || latestDeed.secondParty));
  }

  const obituaryLinkFact = sourceFactByType(sourceFacts, "clerk_of_courts", ["obituary_link"]);
  const obituarySnapshotFact = sourceFactByType(sourceFacts, "clerk_of_courts", ["obituary_snapshot"]);
  const obituarySnapshot = obituarySnapshotFact?.value && typeof obituarySnapshotFact.value === "object" && !Array.isArray(obituarySnapshotFact.value)
    ? obituarySnapshotFact.value
    : {};
  const obituaryLink = cleanDisplayValue(typeof obituaryLinkFact?.value === "string" ? obituaryLinkFact.value : "");
  const obituarySnapshotUrl = cleanDisplayValue(
    obituarySnapshot.url
    || obituarySnapshot.artifactUrl
    || obituarySnapshot.sourceUrl
    || (typeof obituarySnapshotFact?.value === "string" ? obituarySnapshotFact.value : "")
  );
  const obituaryNotFound = /reviewed[_ -]?not[_ -]?found/i.test(obituaryLink);
  const obituarySourceUrl = cleanDisplayValue(
    (!obituaryNotFound && /^https?:\/\//i.test(obituaryLink) ? obituaryLink : "")
    || obituarySnapshotUrl
    || (!obituaryNotFound ? obituaryLinkFact?.sourceUrl : "")
    || obituarySnapshotFact?.sourceUrl
  );
  if (obituaryNotFound) setNestedValue(stored, "obituary.status", "reviewed-not-found");
  if (obituarySourceUrl) setNestedValue(stored, "obituary.sourceUrl", obituarySourceUrl);
  if (obituarySnapshot.fileName || obituarySnapshot.name) {
    setNestedValue(stored, "obituary.fileName", cleanDisplayValue(obituarySnapshot.fileName || obituarySnapshot.name));
  }
  const dateOfBirthFact = sourceFactByType(sourceFacts, "clerk_of_courts", ["date_of_birth"]);
  const dateOfDeathFact = sourceFactByType(sourceFacts, "clerk_of_courts", ["date_of_death"]);
  if (dateOfBirthFact?.value) setNestedValue(stored, "obituary.dateOfBirth", cleanDisplayValue(dateOfBirthFact.value));
  if (dateOfDeathFact?.value) setNestedValue(stored, "obituary.dateOfDeath", cleanDisplayValue(dateOfDeathFact.value));
  state.sourceCaptures[key] = stored;
}

function idiCoreCredentialStatus(connection = connectionByName("IDI Core")) {
  const api = connection?.api || {};
  if (api.sharedDefaultConfigured || api.accessConfigured) {
    return {
      tone: "ready",
      label: "Team default",
      copy: "Approved IDI runs use the shared team-managed connection."
    };
  }
  if (api.endpointConfigured && api.userOverrideAllowed) {
    return {
      tone: "review",
      label: "Team access pending",
      copy: "The vendor endpoint is configured, but team-managed access still needs confirmation."
    };
  }
  return {
    tone: "blocked",
    label: "Team access required",
    copy: "Team-managed vendor access is required before live searches can run."
  };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json.message || json.blockers?.[0] || json.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return json;
}

function applyAdminAccessConfig(config = {}) {
  const domains = Array.isArray(config.allowedDomains) ? config.allowedDomains : [];
  const emails = Array.isArray(config.allowedEmails) ? config.allowedEmails : [];
  if (!domains.length && !emails.length) return false;
  if (domains.length) {
    state.adminAccessDomains = Array.from(new Set(domains.map((domain) => String(domain || "").trim().toLowerCase()).filter(Boolean)));
    persistAdminAccessDomains();
  }
  state.adminAccessEmails = Array.from(new Set(emails.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean)));
  if (state.session?.auth) {
    state.session.auth.allowedDomains = [...state.adminAccessDomains];
    state.session.auth.allowedEmails = [...state.adminAccessEmails];
  }
  return true;
}

async function loadAdminAccessConfig({ rerender = true } = {}) {
  try {
    const response = await fetch("/api/admin/access", { cache: "no-store" });
    if (!response.ok) throw new Error("Access list unavailable");
    const config = await response.json();
    const changed = applyAdminAccessConfig(config);
    if (rerender && changed) {
      renderSession(state.session);
      if (state.activeView === "admin") renderAdminLoopView();
      if (state.activeView === "settings") renderSettingsView();
    }
    return config;
  } catch {
    return null;
  }
}

function rerenderAssetDiscoverySurface() {
  persistAssetDiscoveryState();
  renderResults();
  if (state.activeView === "dossiers") renderDossiersView();
  renderRail();
  renderCurrentLoopView();
}

async function runExternalSourceSearchForRow(row = selectedRow(), payload = sourceCaptureForRow(row)) {
  if (!row) throw new Error("Select an estate before running the public sources.");
  const key = assetDiscoveryKey(row);
  const previousCapture = cloneSourceCaptureRecord(state.sourceCaptures[key]);
  try {
    const result = await postJson("/api/discovery/external-source-run", externalSourceRunPayload(row, payload, key));
    if (result.persistence?.readbackStatus !== "verified") {
      throw new Error("Source evidence returned, but the shared Discovery File did not pass storage readback. Retry before continuing.");
    }
    applyExternalSourceRunResult(row, payload, result);
    const summaries = Array.isArray(result.sourceSummaries) ? result.sourceSummaries : [];
    const factSources = summaries.filter((summary) => Number(summary.factCount) > 0).length;
    const blockers = Array.isArray(result.blockers) ? result.blockers.length : 0;
    addShellEvent(
      "Source search ran",
      `${factSources} county/source check${factSources === 1 ? "" : "s"} returned evidence. ${blockers ? `${blockers} review item${blockers === 1 ? "" : "s"} remain visible in Doc Prep.` : "No source blockers returned."}`,
      blockers ? "blocked" : "ready",
      true,
      { row, source: "Discovery source review" }
    );
    return result;
  } catch (error) {
    state.sourceCaptures[key] = {
      ...(previousCapture ?? {}),
      sourceApiRun: {
        ok: false,
        mode: "external_source_run",
        runId: "",
        generatedAt: new Date().toISOString(),
        sourceSummaries: [],
        blockers: [error instanceof Error ? error.message : "Source search could not run."],
        message: "Source search could not run. Keep Discovery blocked until the county source checks are reviewed."
      },
      updatedAt: Date.now()
    };
    addShellEvent("Source search blocked", error instanceof Error ? error.message : "The source search could not run.", "blocked", true, { row, source: "Discovery source review" });
    throw error;
  } finally {
    rerenderAssetDiscoverySurface();
  }
}

function wireAssetDiscoveryControls(content, row = selectedRow()) {
  if (!content || !row) return;
  content.querySelector("[data-save-source-capture]")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const payload = collectSourceCapturePayload(content, row);
    const key = assetDiscoveryKey(row);
    const previousCapture = cloneSourceCaptureRecord(state.sourceCaptures[key]);
    try {
      const result = await postJson("/api/discovery/source-capture", payload);
      if (result.ok !== true || result.readbackStatus !== "verified" || result.persistence?.readbackStatus !== "verified") {
        throw new Error("The source capture did not pass canonical Discovery File readback.");
      }
      state.sourceCaptures[key] = {
        ...(previousCapture ?? {}),
        ...(result.capture && typeof result.capture === "object" ? result.capture : payload),
        sourceFacts: Array.isArray(result.sourceFacts) ? result.sourceFacts : [],
        updatedAt: Date.now()
      };
      const receiptLinkFact = result.sourceFacts?.find?.((fact) => fact.factType === "tax_receipt_link" && fact.value);
      if (receiptLinkFact?.value) setNestedValue(state.sourceCaptures[key], "taxReceipt.receiptLink", receiptLinkFact.value);
      addShellEvent("Source capture saved", "Tax, deed/title, property appraiser, probate, and obituary/vital evidence were saved to the dossier review trail.", "ready", false, { row, source: "Discovery source review" });
    } catch (error) {
      if (previousCapture) state.sourceCaptures[key] = previousCapture;
      else delete state.sourceCaptures[key];
      addShellEvent("Source capture not saved", error instanceof Error ? error.message : "The canonical Discovery File did not save this capture.", "blocked", true, { row, source: "Discovery source review" });
    }
    rerenderAssetDiscoverySurface();
  });

  content.querySelector("[data-run-source-search]")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const button = event.currentTarget;
    const payload = collectSourceCapturePayload(content, row);
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await runExternalSourceSearchForRow(row, payload);
    } catch {
      // The shared runner records the truthful source blocker and preserves the prior verified capture.
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });

  content.querySelector("[data-import-idi]")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const key = assetDiscoveryKey(row);
    const text = content.querySelector("[data-idi-import-text]")?.value.trim() ?? "";
    const overrideReason = content.querySelector("[data-idi-admin-reason]")?.value.trim() ?? "";
    const label = content.querySelector("[data-idi-report-label]")?.value.trim() || "IDI expanded asset search";
    const sourceUrl = content.querySelector("[data-idi-report-source]")?.value.trim() ?? "";
    if (!text && !sourceUrl) {
      addShellEvent("IDI import needs a report", "Paste the expanded asset-search text or attach the report metadata before importing.", "blocked", true, { row, source: "IDI asset search" });
      return;
    }
    if (state.idiImports[key] && !overrideReason) {
      addShellEvent("Duplicate IDI run blocked", "This estate already has one imported asset-search report. Admin override requires a reason before replacing it.", "blocked", true, { row, source: "IDI asset search" });
      return;
    }
    const candidates = parseIdiImportCandidates(row, text);
    const payload = {
      assetKey: key,
      leadId: row.id,
      ownerName: row.owner || row.title,
      address: row.address,
      provider: "idi",
      importedText: text,
      adminOverrideReason: overrideReason,
      attachment: {
        label,
        sourceUrl,
        fileKind: sourceUrl ? "link" : "text",
        capturedAt: new Date().toISOString(),
        capturedBy: state.session?.user?.email || state.session?.email || "team",
        reviewFlags: ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"]
      }
    };
    try {
      const result = await postJson("/api/discovery/idi-asset-search/import", payload);
      state.idiImports[key] = {
        ...result,
        importedText: text,
        candidates,
        attachment: payload.attachment,
        duplicateGuard: overrideReason ? "admin_override_recorded" : result.duplicateGuard || "first_import_locked",
        importedAt: Date.now()
      };
      addShellEvent("IDI asset search imported", `${candidates.length} contact candidate${candidates.length === 1 ? "" : "s"} are ready for team review. Score will update after acceptance.`, "review", true, { row, source: "IDI asset search" });
    } catch (error) {
      addShellEvent("IDI import blocked", error instanceof Error ? error.message : "The imported report could not be saved.", "blocked", true, { row, source: "IDI asset search" });
    }
    rerenderAssetDiscoverySurface();
  });

  content.querySelector("[data-run-live-idi]")?.addEventListener("click", async (event) => {
    event.preventDefault();
    const key = assetDiscoveryKey(row);
    const overrideReason = content.querySelector("[data-idi-admin-reason]")?.value.trim() ?? "";
    if (state.idiImports[key] && !overrideReason) {
      addShellEvent("Duplicate IDI run blocked", "This estate already has one IDI asset-search record. Add an admin override reason before spending another paid lookup.", "blocked", true, { row, source: "IDI Core" });
      return;
    }
    const payload = {
      assetKey: key,
      leadId: row.id,
      ownerName: row.owner || row.title,
      estateName: row.leadName || row.title,
      propertyAddress: row.address,
      address: row.address,
      county: row.county || "miami-dade",
      provider: "idi",
      runMode: "live_idi_core",
      paidRun: true,
      apiKeySource: "shared_default",
      adminOverrideReason: overrideReason,
      reason: "S29 controlled Discovery proof from Doc Prep",
      attachment: {
        label: "IDI Core live asset search",
        fileKind: "provider-run",
        capturedAt: new Date().toISOString(),
        capturedBy: state.session?.user?.email || "team",
        reviewFlags: ["IDI_CORE_LIVE_RUN_REVIEW_REQUIRED"]
      }
    };
    try {
      const result = await postJson("/api/discovery/idi-asset-search/import", payload);
      const liveCandidates = Array.isArray(result.candidates) && result.candidates.length
        ? result.candidates
        : parseIdiImportCandidates(row, result.importedText || "");
      state.idiImports[key] = {
        ...result,
        candidates: liveCandidates,
        attachment: result.attachment || payload.attachment,
        importedText: result.importedText || "",
        duplicateGuard: overrideReason ? "admin_override_recorded" : result.duplicateGuard || "first_paid_run_only",
        importedAt: Date.now()
      };
      addShellEvent("Live IDI Core completed", `${liveCandidates.length} contact candidate${liveCandidates.length === 1 ? "" : "s"} are ready for review from the controlled paid search.`, "ready", true, { row, source: "IDI Core" });
    } catch (error) {
      addShellEvent("Live IDI Core blocked", error instanceof Error ? error.message : "Live IDI Core could not run. Import an approved report or configure vendor access.", "blocked", true, { row, source: "IDI Core" });
    }
    rerenderAssetDiscoverySurface();
  });

  content.querySelectorAll("[data-contact-review]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const candidateId = button.dataset.contactReview;
      const status = button.dataset.contactStatus;
      void saveContactCandidateReview(row, candidateId, status, idiContactReviewRevision(row)).catch(() => {});
    });
  });
}

function docPrepReadinessItems(row = selectedRow(), dossier = dossierForRow(row), { includeOptional = true } = {}) {
  if (!row) return [{
    title: "No estate selected",
    copy: "Choose an estate before reviewing export readiness.",
    mandatory: true,
    state: "blocked"
  }];
  const discoveryStats = documentPrepStats(row, dossier, "discovery");
  const closingStats = documentPrepStats(row, dossier, "closing-docs");
  const discoveryDone = discoveryProgress("discovery", row) >= 100;
  const closingStarted = docPrepFlowStarted(row, "closing-docs") || state.queueIds.has(row.id);
  const outreachReady = activeOutreachTemplates().some((template) => ["Approved", "Sync to Podio"].includes(template.status));
  const items = [];
  if (!discoveryDone) {
    items.push({
      title: "Discovery Doc Prep incomplete",
      copy: `${discoveryProgress("discovery", row)}% complete. Finish owner, deed, tax, probate, heir/contact, and report review before export.`,
      mandatory: true,
      state: "blocked"
    });
  }
  if (discoveryStats.missing > 0) {
    items.push({
      title: "Discovery packet documents missing",
      copy: `${discoveryStats.missing} Discovery document${discoveryStats.missing === 1 ? "" : "s"} still need a linked Supporting Document or generated packet section.`,
      mandatory: true,
      state: "blocked"
    });
  }
  if (includeOptional && closingStarted && closingStats.missing > 0) {
    items.push({
      title: "Closing Prep packet not finished",
      copy: `${closingStats.missing} Closing Prep document${closingStats.missing === 1 ? "" : "s"} still need review. This is tracked for the deal file but does not block Discovery export.`,
      mandatory: false,
      state: "review"
    });
  }
  if (includeOptional && state.queueIds.has(row.id) && !outreachReady) {
    items.push({
      title: "Linked outreach campaign needs approval",
      copy: "Add or approve the outreach campaign before external follow-up. This does not block a Discovery export.",
      mandatory: false,
      state: "review"
    });
  }
  if (!items.length) {
    items.push({
      title: "Discovery export ready",
      copy: "Required Discovery Doc Prep items are complete for export review.",
      mandatory: false,
      state: "complete"
    });
  }
  return items;
}

function exportBlockerItems(result = state.exportResult) {
  return uniqueItems((result?.blockers ?? [])
    .filter((blocker) => !/skipped in dry-run mode/i.test(blocker))
    .map(operatorBlockerText));
}

function connectionDisplayName(name) {
  if (name === "Activepieces") return "Backstage outreach";
  if (name === "Google") return "Google Workspace";
  return name;
}

function queueReadinessItems() {
  const queued = queuedRows();
  if (!queued.length) {
    return [{
      title: "No leads queued",
      copy: "Add selected Estate Search or Dossier leads to Queue before reviewing export stages."
    }];
  }
  return queued.flatMap((row) => docPrepReadinessItems(row, dossierForRow(row)).map((item) => ({
    title: `${row.leadName || row.title}: ${item.title}`,
    copy: `${item.mandatory ? "Required" : "Tracked"} - ${item.copy}`,
    state: item.state,
    mandatory: item.mandatory
  })));
}

function queueDestinationItems() {
  const names = ["Podio", "Google Workspace", "Resend", "SMS Gateway", "Activepieces", "Linear Support", "Leads Engine Access"];
  return names.map((name) => {
    const connection = connectionByName(name === "Google Workspace" ? "Google" : name);
    const connected = Boolean(connection?.ok && connection?.mode === "live");
    return {
      title: connectionDisplayName(name),
      connected,
      status: connected ? "Ready" : "Setup needed"
    };
  });
}

function pageShellHtml(title, kicker, body) {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { margin: 0; padding: 32px; color: #1d1d1f; background: #f7f7f2; font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .page { max-width: 760px; margin: 0 auto; padding: 36px; background: #fff; border: 1px solid #d8d5ca; border-radius: 8px; }
          h1 { margin: 0 0 6px; font-size: 28px; line-height: 1.05; }
          h2 { margin: 24px 0 8px; font-size: 16px; }
          .kicker { color: #6e7681; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          td, th { padding: 9px; border: 1px solid #ddd8cc; text-align: left; vertical-align: top; }
          ul { padding-left: 18px; }
          li { margin: 6px 0; }
          .muted { color: #6e7681; }
          .notice { margin: 18px 0; padding: 12px 14px; border: 1px solid #d8d5ca; border-radius: 8px; background: #fbfaf5; color: #3f4854; }
          .section { margin-top: 22px; padding-top: 16px; border-top: 1px solid #e5e0d6; }
          .two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
          .fact { padding: 10px; border: 1px solid #e5e0d6; border-radius: 8px; background: #fbfaf5; }
          .fact span { display: block; color: #6e7681; font-size: 11px; font-weight: 700; text-transform: uppercase; }
          .fact strong { display: block; margin-top: 3px; font-size: 15px; }
          .status { font-weight: 700; }
          .small { color: #6e7681; font-size: 12px; }
          .source-links a { color: #185abc; font-weight: 700; overflow-wrap: anywhere; }
          code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
          @media (max-width: 720px) { body { padding: 16px; } .page { padding: 22px; } .two-col, .facts { grid-template-columns: 1fr; } }
        </style>
      </head>
      <body><main class="page"><div class="kicker">${escapeHtml(kicker)}</div><h1>${escapeHtml(title)}</h1>${body}</main></body>
    </html>
  `;
}

function formatPacketDate(value) {
  if (!value) return "Needs review";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US");
}

function moneyClaimValue(claim, fallback = "Needs review") {
  if (!claim || claim.value === null || claim.value === undefined || claim.value === "") return fallback;
  const value = Number(claim.value);
  if (Number.isNaN(value)) return String(claim.value);
  const symbol = claim.currency === "USD" || !claim.currency ? "$" : `${claim.currency} `;
  return `${symbol}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function percentClaimValue(claim, fallback = "Needs review") {
  if (!claim || claim.value === null || claim.value === undefined || claim.value === "") return fallback;
  const value = Number(claim.value);
  if (Number.isNaN(value)) return String(claim.value);
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

function countClaimValue(claim, fallback = "Needs review") {
  if (!claim || claim.value === null || claim.value === undefined || claim.value === "") return fallback;
  return Number.isNaN(Number(claim.value)) ? String(claim.value) : Number(claim.value).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function reportClaimNote(claim, fallback = "Source review required") {
  return claim?.note || claim?.reviewFlags?.slice(0, 2).map(displayStatus).join("; ") || fallback;
}

function paragraphBlock(text, fallback = "Needs review.") {
  const lines = String(text || fallback).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

function offerProfitRows(report) {
  const math = report?.offerMath ?? {};
  return [
    ["As-Is Value", "", moneyClaimValue(math.asIsValue), reportClaimNote(math.asIsValue, "Comp or appraisal input required.")],
    ["Taxes Due", "", moneyClaimValue(math.taxesDue), reportClaimNote(math.taxesDue, "Tax amount due must be captured.")],
    ["Liens", "", moneyClaimValue(math.liens), reportClaimNote(math.liens, "Lien amount must be confirmed.")],
    ["Mortgages", "", moneyClaimValue(math.mortgages), reportClaimNote(math.mortgages, "Mortgage balance must be confirmed.")],
    ["Selling Costs", "", moneyClaimValue(math.sellingCosts), reportClaimNote(math.sellingCosts, "Review closing-cost assumption required.")],
    ["Probate Costs", "", moneyClaimValue(math.probateCosts), reportClaimNote(math.probateCosts, "Court/admin cost estimate required.")],
    ["Partition Costs", "", moneyClaimValue(math.partitionCosts), reportClaimNote(math.partitionCosts, "Litigation-cost assumption required.")],
    ["Post Equity Value", "", moneyClaimValue(math.postEquityValue), reportClaimNote(math.postEquityValue, "Computed after deductions are known.")],
    ["Amount per heir $$", "", moneyClaimValue(math.equityPerHeir), reportClaimNote(math.equityPerHeir, "Needs confirmed equity and heir count.")],
    ["# of heirs on board", "", countClaimValue(math.heirCount), reportClaimNote(math.heirCount, "Heir count comes from the current family-tree hypothesis.")],
    ["Profit", "", moneyClaimValue(math.profit), reportClaimNote(math.profit, "Draft only until underwriting clears.")],
    ["Offer per heir", percentClaimValue(math.buyPercentage), moneyClaimValue(math.offerAmount), reportClaimNote(math.offerAmount, "Draft offer blocked until review.")],
    ["Min Profit", "", moneyClaimValue(math.minimumNetProfit), reportClaimNote(math.minimumNetProfit, "Minimum net still needs review.")],
    ["$100,000 Net", "", "Benchmark", "North Star packet comparison row retained for deal review."]
  ];
}

function offerProfitTable(report) {
  return `
    <table>
      <thead><tr><th>Description</th><th>Percentage</th><th>Total</th><th>Review note</th></tr></thead>
      <tbody>
        ${offerProfitRows(report).map(([label, pct, total, note]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(pct)}</td><td>${escapeHtml(total)}</td><td>${escapeHtml(note)}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function sourceChecklistRows(report) {
  const checklist = report?.researchChecklist ?? [];
  return checklist.length
    ? checklist.map((step) => `<tr><td>${escapeHtml(step.label ?? "Review step")}</td><td>${escapeHtml(displayStatus(step.status))}</td><td>${escapeHtml(step.note ?? "Review source evidence.")}</td></tr>`).join("")
    : `<tr><td>Source checklist</td><td>Needs review</td><td>Run Discovery to populate source-backed checks.</td></tr>`;
}

function sourceLinkItems(report) {
  const links = report?.sourceLinks ?? [];
  return links.length
    ? links.map((link) => {
      const label = `${link.label ?? "Source record"}${link.source ? ` (${displayStatus(link.source)})` : ""}`;
      const sourceUrl = String(link.url || "").trim();
      const safeUrl = /^https?:\/\//i.test(sourceUrl) || (sourceUrl.startsWith("/") && !sourceUrl.startsWith("//"));
      return safeUrl
        ? `<li><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a></li>`
        : `<li>${escapeHtml(label)} - URL needs review</li>`;
    }).join("")
    : "<li>No source URLs are attached to this report yet.</li>";
}

function sourceArtifactLink(label, value) {
  const text = String(value || "").trim();
  if (!text) return "Needs review";
  if (/^https?:\/\//i.test(text)) {
    return `<a href="${escapeHtml(text)}" target="_blank" rel="noreferrer noopener">${escapeHtml(label)}</a>`;
  }
  return escapeHtml(text);
}

function sourceCaptureEvidenceRows(row) {
  const capture = sourceCaptureForRow(row);
  const idi = idiImportForRow(row);
  const rows = [
    ["Tax Collector listing page", sourceArtifactLink("Listing page", capture.taxReceipt?.listingUrl)],
    ["Tax Collector source status", escapeHtml(capture.taxReceipt?.status === "browser_workflow_required" ? "Browser workflow blocked" : capture.taxReceipt?.status || "Needs review")],
    ["Tax Collector blocker", escapeHtml(capture.taxReceipt?.sourceBlockedReason || capture.taxReceipt?.blocker || "None recorded")],
    ["Tax receipt link", sourceArtifactLink("Tax Collector receipt", capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl || capture.taxReceipt?.fileName)],
    ["Tax paid by", escapeHtml(capture.taxReceipt?.paidBy || "Needs review")],
    ["Tax paid date", escapeHtml(capture.taxReceipt?.paidDate || "Needs review")],
    ["Official Records source", sourceArtifactLink("Official Records", capture.deed?.sourceUrl)],
    ["Deed OR / instrument", escapeHtml(capture.deed?.instrument || capture.deed?.instrumentNumber || [capture.deed?.book, capture.deed?.page].filter(Boolean).join("/") || "Needs review")],
    ["Deed attachment", sourceArtifactLink("Official Records deed", capture.deed?.documentUrl || capture.deed?.fileName)],
    ["Grantor / grantee", escapeHtml([capture.deed?.grantor, capture.deed?.grantee].filter(Boolean).join(" to ") || "Needs review")],
    ["Property Appraiser mailing", escapeHtml(capture.propertyAppraiser?.mailingAddress || capture.propertyAppraiser?.mailingAddressSignal || "Needs review")],
    ["Probate docket", sourceArtifactLink(capture.probate?.caseNumber || "Probate docket", capture.probate?.docketUrl || capture.probate?.sourceUrl)],
    ["Probate status", escapeHtml(capture.probate?.caseStatus || capture.probate?.status || "Needs review")],
    ["Probate documents", escapeHtml(capture.probate?.documentAvailability || "Needs review")],
    ["Obituary evidence", capture.obituary?.status === "reviewed-not-found" ? "Reviewed not found" : sourceArtifactLink("Obituary snapshot/link", capture.obituary?.sourceUrl || capture.obituary?.fileName)],
    ["DOB / DOD", escapeHtml([capture.obituary?.dateOfBirth, capture.obituary?.dateOfDeath].filter(Boolean).join(" / ") || "Needs review")],
    ["IDI asset search", escapeHtml(idi ? `${idi.candidates?.length ?? 0} imported candidate${(idi.candidates?.length ?? 0) === 1 ? "" : "s"}; ${acceptedContactCandidates(row).length} accepted` : "Needs one-time asset search import")]
  ];
  return rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`).join("");
}

function assetDiscoveryReportRows(row) {
  return discoveryPhases.map((phase) => {
    const complete = phaseIsComplete(phase.id, row, "discovery");
    return `<tr><th>${escapeHtml(phase.name)}</th><td>${escapeHtml(complete ? "Complete" : "Needs review")}</td><td>${escapeHtml(phase.summary)}</td></tr>`;
  }).join("");
}

function packageContentsItems() {
  const sections = [
    ["property-address", "Property Address", "Recorded address and parcel identity."],
    ["lead-snapshot", "Lead Snapshot", "Estate, owner, folio, status, and next action."],
    ["offer-profit", "Offer / Profit Table", "North Star underwriting table and missing inputs."],
    ["back-story", "Back Story", "Plain-language public-record narrative."],
    ["property-deed", "Property / Deed", "Owner, folio, deed, sale, and title-review notes."],
    ["taxes-probate", "Taxes / Probate", "Tax, court, probate, and document-request status."],
    ["family-tree", "Family Tree And Contact Matrix", "Heir/contact rows with approval gates."],
    ["source-notes", "Source Notes Review", "Source coverage and open review steps."],
    ["source-links", "Source Links", "Clickable public-record source links."],
    ["missing-data", "Missing Data", "Remaining facts needed before external use."],
    ["podio-fields", "Podio Lead Fields", "CRM review fields staged for review."],
    ["google-sheets", "Google Sheets Row", "One-row spreadsheet export shape."],
    ["next-action", "Next Action", "The next review step."]
  ];
  return sections.map(([id, title, copy]) => `<li><a href="#${escapeHtml(id)}">${escapeHtml(title)}</a><span>${escapeHtml(copy)}</span></li>`).join("");
}

function contactMatrixRows(row, report, dossier, group = "primary") {
  const imported = group === "primary" ? primaryContactCandidates(row) : alternativeContactCandidates(row);
  const contacts = imported.length ? imported : group === "primary" ? (report?.contactPlaceholders ?? dossier?.familyTree?.hypothesis?.value?.nodes ?? []) : [];
  if (!contacts.length) {
    return `<tr><td colspan="5">No ${group === "primary" ? "accepted spouse or child" : "alternative relative or associate"} contacts yet. Build this from obituary, probate, family tree, approved IDI asset search, and review notes.</td></tr>`;
  }
  return contacts.slice(0, 18).map((contact, index) => {
    const name = contact.name || contact.label || `${displayStatus(contact.role, "Contact")} ${index + 1}`;
    const phones = (contact.phones ?? []).join(", ") || "Needs review";
    const emails = (contact.emails ?? []).join(", ") || "Needs review";
    const addresses = (contact.addressHistory ?? contact.addresses ?? []).join("; ") || contact.currentAddress || "Needs review";
    const relationship = contact.relationship || contact.role || "Relationship";
    const review = contact.id ? displayStatus(candidateReviewState(row, contact)) : "Needs review";
    return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(displayStatus(relationship))}</td><td>${escapeHtml(phones)}</td><td>${escapeHtml(emails)}</td><td>${escapeHtml(addresses)}<br><span class="small">${escapeHtml(contact.note ?? `${review}; confidence ${contact.confidence ?? "needs review"}.`)}</span></td></tr>`;
  }).join("");
}

function podioFieldRows(row, dossier, report) {
  const fields = dossier?.crm?.payload?.appModel?.fields ?? {};
  const rows = [
    ["title", fields.title ?? dossier?.summary?.displayName ?? row?.leadName],
    ["estate_name", fields.estate_name ?? dossier?.summary?.estateName ?? row?.owner],
    ["property_address", fields.property_address ?? row?.address],
    ["owner_name", fields.owner_name ?? row?.owner],
    ["county", formatCountyName(fields.county ?? row?.county)],
    ["parcel_id", fields.parcel_id ?? row?.parcel],
    ["dossier_status", fields.dossier_status ?? dossier?.operatorQueue?.state],
    ["lead_bucket", fields.lead_bucket ?? report?.leadQualityProfile?.leadBucket],
    ["offer_math", fields.offer_math ? "Mapped for review" : "Needs Podio field map"],
    ["outreach_workflow", fields.outreach_workflow ? "Mapped for review" : "Prepared only"]
  ];
  return rows.map(([field, value]) => `<tr><th>${escapeHtml(displayStatus(field))}</th><td>${escapeHtml(formatSourceFactValue(value))}</td></tr>`).join("");
}

function googleSheetsRow(row, dossier, report) {
  return [
    dossier?.summary?.estateName ?? row?.owner ?? row?.leadName,
    row?.address ?? claimValue(dossier?.property?.address),
    formatCountyName(row?.county ?? claimValue(dossier?.property?.county)),
    row?.parcel ?? claimValue(dossier?.property?.parcelId),
    displayStatus(report?.reviewGate?.reportStatus, "Review"),
    displayStatus(report?.leadQualityProfile?.leadBucket, "Unbucketed"),
    countClaimValue(report?.offerMath?.heirCount),
    moneyClaimValue(report?.offerMath?.offerAmount),
    row?.next ?? dossier?.summary?.nextBestAction ?? "Review source packet"
  ];
}

function completedLeadReportHtml(row, dossier) {
  const report = dossier?.completedLeadReport;
  const property = dossier?.property ?? {};
  const sheetRow = googleSheetsRow(row, dossier, report);
  const missing = report?.missingData ?? buildMissingSections(dossier ?? {}).map((item) => item.label);
  const reviewGate = report?.reviewGate ?? {};
  return pageShellHtml("Completed Lead Report", row?.leadName ?? dossier?.summary?.estateName ?? "Lead file", `
    <p class="muted">Prepared from the live public-record lead packet. North Star anchors: Deborah Cheatham complex family-tree packet and Constance E. White simpler family-tree packet.</p>
    <div class="notice"><strong>Review draft.</strong> External outreach, offers, Podio writes, Google Docs exports, and Google Sheets updates remain blocked until approval and readback proof are complete.</div>
    <div class="facts">
      <div class="fact"><span>Date added</span><strong>${escapeHtml(formatPacketDate(dossier?.generatedAt ?? report?.generatedAt))}</strong></div>
      <div class="fact"><span>Report status</span><strong>${escapeHtml(displayStatus(reviewGate.reportStatus, "Review"))}</strong></div>
      <div class="fact"><span>External use</span><strong>${escapeHtml(reviewGate.externalUseBlocked ? "Blocked" : "Ready for approval")}</strong></div>
    </div>
    <div class="section source-links" id="document-package-contents">
      <h2>Document Package Table Of Contents</h2>
      <p class="muted">Use these links to jump to each part of the dossier package.</p>
      <ul>${packageContentsItems()}</ul>
    </div>
    <div id="property-address"></div>
    <div id="lead-snapshot"></div>
    <table>
      <tr><th>Owner / estate</th><td>${escapeHtml(row?.owner ?? claimValue(property.ownerName, "Needs review"))}</td></tr>
      <tr><th>Property</th><td>${escapeHtml(row?.address ?? claimValue(property.address, "Needs review"))}</td></tr>
      <tr><th>County</th><td>${escapeHtml(formatCountyName(row?.county ?? claimValue(property.county, "Needs review")))}</td></tr>
      <tr><th>Folio / parcel</th><td>${escapeHtml(row?.parcel ?? claimValue(property.parcelId, "Needs review"))}</td></tr>
      <tr><th>Case / file</th><td>${escapeHtml(row?.file ?? claimValue(property.caseNumber, "Needs review"))}</td></tr>
	      <tr><th>Owner DOB / DOD</th><td>Needs review from vital, obituary, memorial, or probate source notes.</td></tr>
	      <tr><th>Obituary status</th><td>Needs review. Preserve the link or explicit "not found" note before outreach.</td></tr>
	    </table>
	    <h2>Captured Source Evidence</h2>
	    <table>${sourceCaptureEvidenceRows(row)}</table>

	    <div class="section" id="offer-profit">
      <h2>Offer / Profit Table</h2>
      <p class="muted">Mirrors the client packet structure while keeping unverified values visible instead of silently filling them.</p>
      ${offerProfitTable(report)}
    </div>

    <div class="section" id="back-story">
      <h2>Back Story</h2>
      ${paragraphBlock(operatorPlainText(report?.backstory ?? dossier?.narrative), "Back story needs review from public-record notes.")}
    </div>

    <div class="section two-col" id="property-deed">
      <div>
        <h2>Property / Deed</h2>
        ${paragraphBlock(report?.propertySummary, "Property summary needs review.")}
        ${paragraphBlock(report?.deedSummary, "Deed and title notes need review.")}
      </div>
      <div id="taxes-probate">
        <h2>Taxes / Probate</h2>
        ${paragraphBlock(report?.taxSummary, "Tax summary needs review.")}
        ${paragraphBlock(report?.probateSummary, "Probate summary needs review.")}
      </div>
    </div>

	    <div class="section" id="family-tree">
	      <h2>Family Tree And Contact Matrix</h2>
	      ${paragraphBlock(report?.familyTreeSummary, "Family-tree hypothesis needs review.")}
	      <h2>Primary Secondary Contacts</h2>
	      <table>
	        <thead><tr><th>Name</th><th>Relationship</th><th>Phone numbers</th><th>Email</th><th>Current / history address</th></tr></thead>
	        <tbody>${contactMatrixRows(row, report, dossier, "primary")}</tbody>
	      </table>
	      <h2>Alternative Contacts</h2>
	      <table>
	        <thead><tr><th>Name</th><th>Relationship</th><th>Phone numbers</th><th>Email</th><th>Current / history address</th></tr></thead>
	        <tbody>${contactMatrixRows(row, report, dossier, "alternative")}</tbody>
	      </table>
	    </div>

    <div class="section" id="source-notes">
      <h2>Source Notes Review</h2>
      <table>
        <thead><tr><th>Step</th><th>Status</th><th>Note</th></tr></thead>
        <tbody>${sourceChecklistRows(report)}</tbody>
      </table>
      <h2 id="source-links">Source Links</h2>
      <ul class="source-links">${sourceLinkItems(report)}</ul>
      <h2 id="missing-data">Missing Data</h2>
      <ul>${missing.length ? missing.map((item) => `<li>${escapeHtml(item)}</li>`).join("") : "<li>No critical missing-data items flagged beyond review markers.</li>"}</ul>
    </div>

    <div class="section" id="podio-fields">
      <h2>Podio Lead Fields</h2>
      <table>${podioFieldRows(row, dossier, report)}</table>
    </div>

    <div class="section" id="google-sheets">
      <h2>Google Sheets Row</h2>
      <table>
        <tr><th>Estate</th><th>Property</th><th>County</th><th>Folio</th><th>Report</th><th>Bucket</th><th>Heirs</th><th>Offer</th><th>Next action</th></tr>
        <tr>${sheetRow.map((value) => `<td>${escapeHtml(formatSourceFactValue(value))}</td>`).join("")}</tr>
      </table>
      <p class="small">Google Docs export target: completed lead report body plus Discovery Dossier attachments. Google Sheets target: one row per lead with source-backed status, offer math, and queue state.</p>
    </div>

    <div class="section" id="next-action">
      <h2>Next Action</h2>
      <p class="status">${escapeHtml(dossier?.summary?.nextBestAction ?? row?.next ?? "Resolve review flags before export or outreach.")}</p>
    </div>
  `);
}

function discoveryDossierHtml(row, dossier) {
  const property = dossier?.property ?? {};
  const missing = row?.missing ?? buildMissingSections(dossier ?? {});
  return pageShellHtml("Discovery Dossier", row?.leadName ?? "Lead file", `
    <p class="muted">Prepared from the current public-record lead packet. Review-only until source notes and export gates clear.</p>
	    <table>
	      <tr><th>Owner / estate</th><td>${escapeHtml(row?.owner ?? claimValue(property.ownerName, "Needs review"))}</td></tr>
	      <tr><th>Property</th><td>${escapeHtml(row?.address ?? claimValue(property.address, "Needs review"))}</td></tr>
	      <tr><th>County</th><td>${escapeHtml(formatCountyName(row?.county ?? claimValue(property.county, "Miami-Dade County, FL")))}</td></tr>
	      <tr><th>Case / file</th><td>${escapeHtml(row?.file ?? claimValue(property.caseNumber, "Needs review"))}</td></tr>
	      <tr><th>Current phase</th><td>${escapeHtml(currentDiscoveryPhase("discovery", row).label)}</td></tr>
	    </table>
	    <h2>Asset-first Discovery checklist</h2>
	    <table>
	      <thead><tr><th>Stage</th><th>Status</th><th>What it proves</th></tr></thead>
	      <tbody>${assetDiscoveryReportRows(row)}</tbody>
	    </table>
	    <h2>Captured evidence</h2>
	    <table>${sourceCaptureEvidenceRows(row)}</table>
	    <h2>Open source notes</h2>
    <ul>${(missing.length ? missing : buildMissingSections(dossier ?? {})).map((item) => `<li><strong>${escapeHtml(item.short ?? item.label)}</strong> - ${escapeHtml(item.copy)}</li>`).join("") || "<li>All current dossier sections are marked ready in this view.</li>"}</ul>
    <h2>Document packet</h2>
    <p>Ten documents are staged for team review: discovery dossier, completed lead report, source notes, deed and title notes, tax history packet, probate request, heir contact matrix, outreach drafts, drip schedule, and CRM review.</p>
  `);
}

function sourceNotesHtml(row, dossier) {
  const facts = operatorDocumentFacts(state.data?.facts ?? [])
    .filter((fact) => !/offer_|source_governance_catalog/i.test(String(fact.factType ?? "")))
    .slice(0, 16);
  const coverage = qualificationDecision(dossier)?.coverage ?? [];
  return pageShellHtml("Source Notes", row?.leadName ?? "Lead file", `
    <p class="muted">County-record and workflow checks remain visible so unconfirmed values never count as confirmed facts.</p>
    <h2>Coverage</h2>
    <ul>${coverage.map((area) => `<li><strong>${escapeHtml(area.label)}</strong> - ${escapeHtml(displayStatus(area.status))}: ${escapeHtml(operatorPlainText(area.nextAction))}</li>`).join("") || "<li>Run qualification review to populate coverage.</li>"}</ul>
    <h2>Facts</h2>
    <ul>${facts.slice(0, 12).map((fact) => `<li><strong>${escapeHtml(displayStatus(fact.factType, "Source fact"))}</strong> - ${escapeHtml(formatSourceFactValue(fact.value))}</li>`).join("") || "<li>No facts loaded yet.</li>"}</ul>
  `);
}

function probateRequestHtml(row, dossier) {
  return pageShellHtml("Probate Document Request", row?.leadName ?? "Lead file", `
    <p class="muted">Use this when probate documents need to be requested after docket review.</p>
    <h2>Request steps</h2>
    <ol>
      <li>Call probate court to verify the documents available and page count.</li>
      <li>Prepare a written request with the case number and copy type.</li>
      <li>Use money order by mail or go in person for same-day copies.</li>
      <li>Record whether copies are certified and add the final cost to the dossier.</li>
    </ol>
    <h2>Case</h2>
    <table><tr><th>Case / file</th><td>${escapeHtml(row?.file ?? "Needs review")}</td></tr><tr><th>Property</th><td>${escapeHtml(row?.address ?? "Needs review")}</td></tr></table>
  `);
}

function deedTitleNotesHtml(row, dossier) {
  const tasks = dossier?.deedHistory?.reviewTasks ?? [];
  const property = dossier?.property ?? {};
  const capture = sourceCaptureForRow(row);
  return pageShellHtml("Deed & Title Notes", row?.leadName ?? "Lead file", `
    <p class="muted">Official-record notes for owner chain, deed gaps, and title-review blockers.</p>
    <table>
      <tr><th>Owner / estate</th><td>${escapeHtml(row?.owner ?? claimValue(property.ownerName, "Needs review"))}</td></tr>
      <tr><th>Property</th><td>${escapeHtml(row?.address ?? claimValue(property.address, "Needs review"))}</td></tr>
      <tr><th>Folio / parcel</th><td>${escapeHtml(row?.parcel ?? claimValue(property.parcelId, "Needs review"))}</td></tr>
      <tr><th>County</th><td>${escapeHtml(formatCountyName(row?.county ?? claimValue(property.county, "Miami-Dade County, FL")))}</td></tr>
      <tr><th>OR / instrument</th><td>${escapeHtml(capture.deed?.instrument || "Needs review")}</td></tr>
      <tr><th>Deed attachment</th><td>${sourceArtifactLink("Official Records deed", capture.deed?.documentUrl || capture.deed?.fileName)}</td></tr>
    </table>
    <h2>Title review tasks</h2>
    <ul>${tasks.map((task) => `<li><strong>${escapeHtml(task.title ?? "Review task")}</strong> - ${escapeHtml(operatorPlainText(task.nextAction ?? task.reason ?? "Record the official-record note."))}</li>`).join("") || "<li>Owner chain is staged for review; no deed blocker is recorded in the current packet.</li>"}</ul>
    <h2>Review checks</h2>
    <ol>
      <li>Confirm vesting, transfer path, and any company-owned stop rule.</li>
      <li>Record OR book/page, deed date, and seller/buyer names when visible.</li>
      <li>Flag recent sales, title defects, or missing official-record pages before outreach.</li>
    </ol>
  `);
}

function taxHistoryHtml(row, dossier) {
  const tasks = dossier?.taxHistory?.reviewTasks ?? [];
  const capture = sourceCaptureForRow(row);
  const facts = operatorDocumentFacts(state.data?.facts ?? [])
    .filter((fact) => /tax|assessment|receipt|payer|folio|parcel/i.test(`${fact.source ?? ""} ${fact.factType ?? ""}`))
    .slice(0, 10);
  return pageShellHtml("Tax History Packet", row?.leadName ?? "Lead file", `
    <p class="muted">Tax collector notes for unpaid years, payer history, receipt status, reassessment, and lien review.</p>
    <table>
      <tr><th>Property</th><td>${escapeHtml(row?.address ?? "Needs review")}</td></tr>
      <tr><th>Folio / parcel</th><td>${escapeHtml(row?.parcel ?? "Needs review")}</td></tr>
      <tr><th>Listing page</th><td>${sourceArtifactLink("Tax Collector listing", capture.taxReceipt?.listingUrl)}</td></tr>
      <tr><th>Source status</th><td>${escapeHtml(capture.taxReceipt?.status === "browser_workflow_required" ? "Browser workflow blocked" : capture.taxReceipt?.status || "Needs review")}</td></tr>
      <tr><th>Source blocker</th><td>${escapeHtml(capture.taxReceipt?.sourceBlockedReason || capture.taxReceipt?.blocker || "None recorded")}</td></tr>
      <tr><th>Receipt link</th><td>${sourceArtifactLink("Tax Collector receipt", capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl || capture.taxReceipt?.fileName)}</td></tr>
      <tr><th>Last paid by</th><td>${escapeHtml(capture.taxReceipt?.paidBy || "Needs review")}</td></tr>
      <tr><th>Paid date</th><td>${escapeHtml(capture.taxReceipt?.paidDate || "Needs review")}</td></tr>
      <tr><th>Next tax action</th><td>${escapeHtml(operatorPlainText(tasks[0]?.nextAction ?? tasks[0]?.reason ?? "Confirm unpaid years, amount due, and who paid the taxes."))}</td></tr>
    </table>
    <h2>Tax tasks</h2>
    <ul>${tasks.map((task) => `<li><strong>${escapeHtml(task.title ?? "Tax review")}</strong> - ${escapeHtml(operatorPlainText(task.nextAction ?? task.reason ?? "Capture tax status from the collector record."))}</li>`).join("") || "<li>No open tax blocker is recorded; preserve receipt and payer notes during review.</li>"}</ul>
    <h2>Tax-related source facts</h2>
    <ul>${facts.map((fact) => `<li><strong>${escapeHtml(displayStatus(fact.factType, "Tax fact"))}</strong> - ${escapeHtml(formatSourceFactValue(fact.value))}</li>`).join("") || "<li>Tax facts need review from the live source packet before this document is final.</li>"}</ul>
  `);
}

function heirContactMatrixHtml(row, dossier) {
  const report = dossier?.completedLeadReport;
  const importedContacts = contactCandidatesForRow(row);
  const contacts = importedContacts.length ? importedContacts : report?.contactPlaceholders ?? dossier?.familyTree?.hypothesis?.value?.nodes ?? [];
  const tasks = [
    ...(dossier?.familyTree?.reviewTasks ?? []),
    ...(dossier?.marriageDeathIndicators?.reviewTasks ?? [])
  ];
  return pageShellHtml("Heir Contact Matrix", row?.leadName ?? "Lead file", `
    <p class="muted">Contact research remains review-only until source notes, paid-source approval, and team contact approval clear.</p>
    <table>
      <tr><th>Estate</th><td>${escapeHtml(row?.owner ?? row?.leadName ?? "Needs review")}</td></tr>
      <tr><th>IDI candidates</th><td>${escapeHtml(contacts.length)}</td></tr>
      <tr><th>Accepted contacts</th><td>${escapeHtml(acceptedContactCandidates(row).length)}</td></tr>
      <tr><th>Approval status</th><td>Do not contact until review clears</td></tr>
    </table>
    <h2>Primary secondary contacts</h2>
    <table>
      <thead><tr><th>Name</th><th>Relationship</th><th>Phone numbers</th><th>Email</th><th>Current / history address</th></tr></thead>
      <tbody>${contactMatrixRows(row, report, dossier, "primary")}</tbody>
    </table>
    <h2>Alternative Contacts</h2>
    <table>
      <thead><tr><th>Name</th><th>Relationship</th><th>Phone numbers</th><th>Email</th><th>Current / history address</th></tr></thead>
      <tbody>${contactMatrixRows(row, report, dossier, "alternative")}</tbody>
    </table>
    <h2>Open contact checks</h2>
    <ul>${tasks.map((task) => `<li><strong>${escapeHtml(task.title ?? "Contact review")}</strong> - ${escapeHtml(operatorPlainText(task.nextAction ?? task.reason ?? "Confirm heir/contact confidence."))}</li>`).join("") || "<li>Confirm heir roles, phone/address confidence, and no-contact gates before outreach.</li>"}</ul>
  `);
}

function outreachDraftHtml(row) {
  return pageShellHtml("Outreach Drafts", row?.leadName ?? "Lead file", `
    <p class="muted">Review-only drafts. Nothing is sent until contact approval and compliance review clear.</p>
    <h2>Email draft</h2>
    <p>We are reviewing public records for the property at ${escapeHtml(row?.address ?? "the property")} and would like to confirm the right person to speak with about the estate file.</p>
    <h2>SMS draft</h2>
    <p>Hello, this is the HeirRight team following up about ${escapeHtml(row?.address ?? "the property")}. Please reply with the best time to connect if you are the right contact.</p>
  `);
}

function dripScheduleHtml(row) {
  const drips = scheduledDrips();
  return pageShellHtml("Drip Schedule", row?.leadName ?? "Lead file", `
    <p class="muted">Scheduled automations are prepared only. No email, SMS, or CRM card is created from this review surface.</p>
    <h2>Prepared cadences</h2>
    <table>
      <tr><th>Sequence</th><th>Channel</th><th>Cadence</th><th>Status</th><th>Guardrail</th></tr>
      ${drips.map((drip) => `<tr><td>${escapeHtml(drip.title)}</td><td>${escapeHtml(drip.channel)}</td><td>${escapeHtml(drip.cadence)}</td><td>${escapeHtml(drip.status)}</td><td>${escapeHtml(drip.guardrail)}</td></tr>`).join("")}
    </table>
    <h2>Stop rules</h2>
    <ul>
      <li>No live send until contact approval and compliance review clear.</li>
      <li>Stop if a lead is marked no-contact, company-owned, recently sold, or source-blocked.</li>
      <li>Queue only batch-ready dossiers with owner, source notes, document packet, and readback gate.</li>
    </ul>
  `);
}

function crmHandoffHtml(row, dossier) {
  const podio = dossier?.crm?.payload?.podioReadiness ?? {};
  return pageShellHtml("CRM Review", row?.leadName ?? "Lead file", `
    <p class="muted">Prepared for Podio batch export. No live Podio card is created until access is approved and confirmation readback exists.</p>
    <table>
      <tr><th>Route</th><td>Podio batch prep</td></tr>
      <tr><th>Status</th><td>${escapeHtml(displayStatus(dossier?.crm?.status, "Prep only"))}</td></tr>
      <tr><th>Missing setup</th><td>${escapeHtml(operatorSetupList(podio.missingConfig ?? []))}</td></tr>
      <tr><th>Readback checks</th><td>${escapeHtml(podio.readbackChecks?.length ?? 0)} required</td></tr>
    </table>
  `);
}

function closingDocHtml(row, dossier, title, rows = []) {
  const safeRows = rows.length ? rows : [["Status", "Needs review"]];
  return pageShellHtml(title, row?.leadName ?? row?.title ?? "Lead file", `
    <p class="muted">Closing Prep uses the same estate file and linked source facts. This packet is review-only until approval and readback proof clear.</p>
    <div class="notice">No live Podio card, Google Doc, Google Sheet row, email, SMS, signature request, escrow instruction, or recording task is created from this preview.</div>
    <table>
      ${safeRows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}
    </table>
    <div class="section">
      <h2>Source boundary</h2>
      <ul>
        <li>Estate source: ${escapeHtml(row?.sourceProvider || "HeirRight imported estate record")}</li>
        <li>Property source: ${escapeHtml(row?.address || dossier?.property?.address?.value || "Needs review")}</li>
        <li>Review gate: approval required before any external use.</li>
      </ul>
    </div>
  `);
}

function selectedDossierDocument(row = selectedRow()) {
  const docs = docsForFlow(row, dossierForRow(row));
  return docs.find((doc) => doc.id === state.selectedDossierDocId) ?? docs[0];
}

function renderDashboardView() {
  const target = document.getElementById("dashboardView");
  if (!target) return;
  const activeRows = state.rows.filter((estate) => !estate.isArchived);
  const hasReport = (estate) => Boolean(
    packetArtifactForRow(estate, "discovery")?.verification?.verified
      || docPrepFlowHasWork(estate, "discovery")
  );
  const withoutReports = activeRows.filter((estate) => !hasReport(estate)).length;
  const withReports = activeRows.filter(hasReport).length;
  const exported = activeRows.filter((estate) => estateWorkflowForRow(estate).state === "exported").length;
  const history = state.searchHistory.map(normalizeSearchHistoryItem).filter((item) => item.prospects.length).slice(0, 6);
  const previous = history[0] || null;
  const fileHistory = activeRows
    .filter((estate) => hasReport(estate) || estate.id === state.selectedId)
    .slice(0, 6);
  target.innerHTML = `
    <div class="manage-estates-dashboard" aria-label="HeirRight Manage Estates workspace">
      <header class="dashboard-heading">
        <div><p class="eyebrow">Manage Estates</p><h2>Good to see you, ${escapeHtml(currentUserFirstName())}</h2></div>
        <span class="dashboard-date">${escapeHtml(todayLongLabel())}</span>
      </header>
      <nav class="dashboard-range-tabs beui-tabs" role="tablist" aria-label="Dashboard time range">
        ${["7d", "14d", "30d"].map((range) => `<button class="beui-tabs-trigger" type="button" role="tab" data-dashboard-range="${range}" aria-selected="${state.dashboardRange === range}">${range}</button>`).join("")}
      </nav>
      <section class="dashboard-kpi-strip" aria-label="Estate report counters">
        <article><span>Estates without Reports</span><strong>${escapeHtml(withoutReports)}</strong></article>
        <article><span>Estates with Reports</span><strong>${escapeHtml(withReports)}</strong></article>
        <article><span>Estates Exported</span><strong>${escapeHtml(exported)}</strong></article>
      </section>
      <section class="dashboard-decision-band" aria-label="Next decision">
        <div><p class="eyebrow">Next decision</p><h3>Keep the estate loop moving</h3><p class="copy">Search Estates for new files, or reopen the last file you visited before continuing review.</p></div>
        <div class="dashboard-decision-actions">
          <button class="btn primary solvys-liquid-glass" type="button" data-dashboard-estate-search>Estate Search</button>
          <button class="btn quick" type="button" data-dashboard-previous-file ${previous ? "" : "disabled"}>${previous ? "Open previous file" : "No previous file"}</button>
        </div>
        <div class="dashboard-last-visited"><span>Last Visited</span><strong>${escapeHtml(previous?.label || "No previous file")}</strong><small>${escapeHtml(previous?.createdAt ? historyDateLabel(previous.createdAt) : "Open an estate to start history")}</small></div>
      </section>
      <section class="dashboard-file-history" aria-label="File history">
        <div class="dashboard-section-head"><div><p class="eyebrow">History</p><h3>File history</h3></div><button class="btn quick" type="button" data-dashboard-estate-search>Estate Search</button></div>
        <div class="dashboard-history-list">
          ${fileHistory.map((estate) => `<button class="dashboard-history-row" type="button" data-dashboard-history-estate="${escapeHtml(estate.id)}"><span><strong>${escapeHtml(estate.leadName || estate.title)}</strong><small>${escapeHtml(estate.address || "Address needs review")}</small></span><span>${escapeHtml(estateWorkflowForRow(estate).state === "exported" ? "Exported" : hasReport(estate) ? "Report ready" : "Needs report")}</span></button>`).join("") || `<p class="copy">No files have been visited yet. Start in Estate Search.</p>`}
        </div>
      </section>
    </div>
  `;
  target.querySelectorAll("[data-dashboard-range]").forEach((button) => {
    button.addEventListener("click", () => {
      state.dashboardRange = button.dataset.dashboardRange || "7d";
      renderDashboardView();
    });
  });
  target.querySelectorAll("[data-dashboard-estate-search]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector('[data-shell-nav="find-estates"]')?.click());
  });
  target.querySelector("[data-dashboard-previous-file]")?.addEventListener("click", () => {
    if (previous) openHistoryItem(previous.id);
  });
  target.querySelectorAll("[data-dashboard-history-estate]").forEach((button) => {
    button.addEventListener("click", () => {
      const rowId = button.dataset.dashboardHistoryEstate;
      if (!rowId || !rowById(rowId)) return;
      state.selectedId = rowId;
      state.docPrepListOpen = false;
      updateFooterLeadContext(selectedRow());
      document.querySelector('[data-shell-nav="dossiers"]')?.click();
    });
  });
}

function docPrepFlowHasWork(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) return false;
  if (docPrepFlowStarted(row, flowId)) return true;
  const docs = docsForFlow(row, dossierForRow(row), flowId);
  return docs.some((doc) => documentFileRecord(doc.id, row));
}

function docPrepListRows() {
  return state.rows.filter((row) => !row.isArchived && (
    row.sourceKind === "crm-import" ||
    row.sourceKind === "fresh-batch" ||
    Object.keys(docPrepFlows).some((flowId) => docPrepFlowHasWork(row, flowId) || docPrepRowStageEligible(row, flowId))
  ));
}

function docPrepRowStageEligible(row, flowId = state.activeDocPrepFlow) {
  if (!row || row.isArchived) return false;
  const status = dealStatusForRow(row);
  if (flowId === "closing-docs") {
    return ["warm", "hot", "post-discovery"].includes(status) || discoveryProgress("discovery", row) >= 100;
  }
  return !["warm", "hot"].includes(status);
}

function eligibleDocPrepRows(flowId = state.activeDocPrepFlow) {
  return state.rows.filter((row) => (
    docPrepRowStageEligible(row, flowId) &&
    discoveryProgress(flowId, row) < 100 &&
    !docPrepFlowStarted(row, flowId)
  ));
}

function openDocPrepAddModal(flowId = state.activeDocPrepFlow) {
  state.docPrepAddModal = {
    open: true,
    flowId: docPrepFlows[flowId] ? flowId : state.activeDocPrepFlow
  };
  renderDossiersView();
}

function closeDocPrepAddModal() {
  state.docPrepAddModal.open = false;
  renderDossiersView();
}

async function generateClosingPdf(source = null) {
  const row = selectedRow();
  if (!row) {
    document.getElementById("topStatus").textContent = "Select an estate before generating Closing Prep.";
    return;
  }
  const dossier = dossierForRow(row);
  const fieldBlockers = selectedClosingBlockers(row, dossier).map((entry) => entry.label);
  if (fieldBlockers.length) {
    document.getElementById("topStatus").textContent = `${fieldBlockers.length} Closing Prep blocker${fieldBlockers.length === 1 ? "" : "s"} must be resolved before generation.`;
    addShellEvent("Closing PDF blocked", `${fieldBlockers.slice(0, 3).join("; ")}${fieldBlockers.length > 3 ? "..." : ""}`, "blocked", true, { row, source: "Closing Prep" });
    state.activeDocPrepFlow = "closing-docs";
    renderDossiersView();
    renderRail();
    return;
  }
  if (!assetPhaseComplete(row, "title-clearance") || !assetPhaseComplete(row, "seller-approval")) {
    document.getElementById("topStatus").textContent = "Finish title evidence and accepted signer review before generating Closing Prep.";
    addShellEvent("Closing PDF blocked", "Title evidence and accepted signer review are required before legal-template fill.", "blocked", true, { row, source: "Closing Prep" });
    return;
  }
  document.getElementById("topStatus").textContent = "Building and verifying the immutable Closing PDF...";
  const result = await generatePacketPreview(row, source, { flowId: "closing-docs", render: false });
  if (result?.verification?.verified) {
    document.getElementById("topStatus").textContent = "Closing PDF generated and verified.";
    addShellEvent("Closing PDF ready", `${docPrepEstateLabel(row)} generated one immutable-template PDF with storage readback.`, "ready", false, { row, source: "Closing Prep" });
    setDealStatusForRow(row, "hot", { rerender: false });
  }
  renderDossiersView();
  renderRail();
}

function addDocPrepForRow(rowId, flowId = state.docPrepAddModal.flowId || state.activeDocPrepFlow) {
  const row = rowById(rowId);
  if (!row) return;
  state.selectedId = row.id;
  state.docPrepListOpen = false;
  state.docPrepAddModal.open = false;
  setActiveDocPrepFlow(flowId, { persist: true, rerender: false });
  ensureDocPrepStarted(row, flowId);
  document.getElementById("topStatus").textContent = `${docPrepEstateLabel(row)} added to ${docPrepFlow(flowId).title}.`;
  addShellEvent("DocPrep added", `${docPrepEstateLabel(row)} is now in ${docPrepFlow(flowId).title}.`, "ready", false);
  renderDossiersView();
  renderRail();
  syncSelectionLabels();
}

function openDocPrepRow(rowId, flowId = state.activeDocPrepFlow) {
  const row = rowById(rowId);
  if (!row) return;
  state.selectedId = row.id;
  state.docPrepListOpen = false;
  setActiveDocPrepFlow(flowId, { persist: true, rerender: false });
  ensureDocPrepStarted(row, flowId);
  recordLeadOpened(row, "Document Prep");
  renderDossiersView();
  renderRail();
  updateFooterLeadContext(row);
  hydratePersistedDiscoveryFile(row);
}

function docPrepFlowLineHtml(row, flowId) {
  const progress = discoveryProgress(flowId, row);
  const started = docPrepFlowStarted(row, flowId);
  const label = started || progress > 0 ? `${progress}%` : "Not started";
  return `
    <span class="docprep-flow-line">
      <span class="docprep-flow-meter" aria-hidden="true"><i style="--docprep-progress:${progress}%"></i></span>
      <strong>${escapeHtml(docPrepFlow(flowId).shortTitle)}</strong>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function closingExportForRow(row = selectedRow()) {
  if (!row) return null;
  return state.closingExportState?.[assetDiscoveryKey(row)] ?? null;
}

function docPrepFileStatusItems(row = selectedRow()) {
  const discoveryStats = documentPrepStats(row, dossierForRow(row), "discovery");
  const closingStats = documentPrepStats(row, dossierForRow(row), "closing-docs");
  const discoveryPct = discoveryProgress("discovery", row);
  const closingPct = discoveryProgress("closing-docs", row);
  const idi = idiImportForRow(row);
  const idiCandidates = Number(idi?.candidates?.length || 0);
  const acceptedIdi = acceptedContactCandidates(row).length;
  const closingExport = closingExportForRow(row);
  const googleRoute = closingExport?.result?.export?.routes?.find?.((item) => item.route === "google");
  const activeTemplates = activeOutreachTemplates().filter((template) => ["Approved", "Sync to Podio"].includes(template.status));
  const discoveryReady = discoveryPct >= 100 && discoveryStats.missing === 0;
  const closingPacketReady = closingPct >= 100 && closingStats.missing === 0;
  const closingReady = Boolean(closingExport?.result?.ok && googleRoute?.url);
  return [
    {
      label: "Discovery",
      value: discoveryReady ? "Complete" : discoveryPct > 0 ? `${discoveryPct}%` : "Not started",
      state: discoveryReady ? "complete" : discoveryStats.missing ? "pending" : "active"
    },
    {
      label: "IDI Core Report",
      value: idi ? (acceptedIdi ? `${acceptedIdi} accepted` : idiCandidates ? `${idiCandidates} imported` : "Imported") : "Needs import",
      state: idi ? "complete" : "pending"
    },
    {
      label: "Closing Docs",
      value: closingReady ? "Exported" : closingPacketReady ? "Complete" : closingPct > 0 ? `${closingPct}%` : "Not started",
      state: closingReady || closingPacketReady ? "complete" : closingStats.missing ? "pending" : "active"
    },
    {
      label: "Google",
      value: closingReady ? "Doc ready" : closingExport?.result?.blockers?.length ? "Blocked" : closingStats.missing === 0 ? "Ready to export" : "Not exported",
      state: closingReady ? "complete" : closingExport?.result?.blockers?.length ? "blocked" : closingStats.missing === 0 ? "active" : "pending"
    },
    {
      label: "Outreach",
      value: activeTemplates.length ? `${activeTemplates.length} ready` : "Needs approval",
      state: activeTemplates.length ? "complete" : "pending"
    }
  ];
}

function docPrepEstateLabel(row) {
  if (!row) return "Current estate";
  if (isDemoEstateImport(row) && row.leadName) return row.leadName;
  const dossier = dossierForRow(row);
  return estateFileDisplayLabel(
    row.leadName,
    dossier?.summary?.estateName,
    dossier?.property?.estateName?.value,
    row.data?.seed?.estateName,
    row.owner,
    row.title
  );
}

function docPrepAddressLines(row) {
  if (!row) return ["Load a lead packet from Estates to start document prep."];
  const address = row.address || claimValue(dossierForRow(row)?.property?.address, "Address needs review");
  const parts = cleanDisplayValue(address).split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) return [parts[0], parts[1], parts.slice(2).join(", ")];
  if (parts.length === 2) return [parts[0], parts[1]];
  return [parts[0] || "Address needs review"];
}

function docPrepAddressLinesHtml(row) {
  return docPrepAddressLines(row).map((line) => `<span>${escapeHtml(line)}</span>`).join("");
}

function docPrepOwnerLabel(row) {
  const dossier = dossierForRow(row);
  const owner = claimValue(dossier?.property?.ownerName, row?.owner || row?.data?.seed?.ownerName || row?.leadName || row?.title || "Owner needs review");
  return hasSpecificOwnerName(owner) ? owner : "Owner needs review";
}

function docPrepClientSubtitle(row) {
  const estate = docPrepEstateLabel(row);
  const address = row?.address || claimValue(dossierForRow(row)?.property?.address, "Address needs review");
  const file = row?.file && !/internal report|case needs review/i.test(row.file) ? ` - ${row.file}` : "";
  return `${estate}${address ? ` - ${address}` : ""}${file}`;
}

function docPrepClientRowHtml(row) {
  const checked = state.selectedIds.has(row.id);
  const status = dealStatusMeta(dealStatusForRow(row));
  const flowId = status.flowId;
  const selected = row.id === state.selectedId;
  const estateLabel = docPrepEstateLabel(row);
  const ownerLabel = docPrepOwnerLabel(row);
  const fileStatuses = docPrepFileStatusItems(row);
  return `
    <article class="docprep-client-row ${selected ? "is-selected" : ""}" data-dossier-row="${escapeHtml(row.id)}" data-open-docprep-row="${escapeHtml(row.id)}" data-open-docprep-flow="${escapeHtml(flowId)}" tabindex="0" role="button" aria-label="Open ${escapeHtml(ownerLabel)} document prep">
      <div class="docprep-client-main">
        ${checkboxHtml(row.id, `Select ${ownerLabel} for document prep actions`, checked, `data-row-select="${escapeHtml(row.id)}"`)}
        <div class="docprep-client-title">
          <strong>${escapeHtml(ownerLabel)}</strong>
          <span>${escapeHtml(docPrepClientSubtitle(row))}</span>
        </div>
        <button class="btn" type="button" data-open-docprep-row="${escapeHtml(row.id)}" data-open-docprep-flow="${escapeHtml(flowId)}">Open</button>
      </div>
      <div class="docprep-client-meta">
        <span class="docprep-flow-line"><strong>Status</strong><span>${escapeHtml(status.label)}</span></span>
        ${Object.keys(docPrepFlows).map((item) => docPrepFlowLineHtml(row, item)).join("")}
      </div>
      <div class="docprep-file-status-grid" aria-label="File status columns">
        ${fileStatuses.map((item) => `
          <span class="docprep-file-status" data-state="${escapeHtml(item.state)}">
            ${linearStatusIconHtml(item.state, item.value)}
            <span><strong>${escapeHtml(item.label)}</strong><em>${escapeHtml(item.value)}</em></span>
          </span>
        `).join("")}
      </div>
    </article>
  `;
}

function docPrepAddModalHtml() {
  if (!state.docPrepAddModal.open) return "";
  const flowId = docPrepFlows[state.docPrepAddModal.flowId] ? state.docPrepAddModal.flowId : state.activeDocPrepFlow;
  const flow = docPrepFlow(flowId);
  const eligible = eligibleDocPrepRows(flowId);
  return `
    <div class="docprep-modal-layer" role="presentation" data-docprep-add-layer>
      <section class="docprep-add-modal" role="dialog" aria-modal="true" aria-labelledby="docprepAddTitle">
        <header class="docprep-add-head">
          <div>
            <p class="eyebrow">Add prep</p>
            <h3 id="docprepAddTitle">${escapeHtml(flow.title)}</h3>
          </div>
          <button class="btn icon-only" type="button" data-close-docprep-add aria-label="Close add prep">${nucleoIcon("check-circle", 16)}</button>
        </header>
        <div class="docprep-add-flow-tabs" role="tablist" aria-label="Choose document prep flow">
          ${Object.values(docPrepFlows).map((item) => `
            <button type="button" role="tab" data-docprep-add-flow="${escapeHtml(item.id)}" aria-pressed="${item.id === flowId ? "true" : "false"}">${escapeHtml(item.title)}</button>
          `).join("")}
        </div>
        <div class="docprep-add-list">
          ${eligible.map((row) => {
            const status = dealStatusMeta(dealStatusForRow(row));
            const estateLabel = docPrepEstateLabel(row);
            return `
              <button class="docprep-add-option" type="button" data-add-docprep-row="${escapeHtml(row.id)}" data-add-docprep-flow="${escapeHtml(flowId)}">
                <span>
                  <strong>${escapeHtml(estateLabel)}</strong>
                  <span>${escapeHtml(row.address || "Address needs review")} - ${escapeHtml(status.label)}</span>
                </span>
                <span>${escapeHtml(`${discoveryProgress(flowId, row)}%`)}</span>
              </button>
            `;
          }).join("") || `<div class="docprep-empty-state"><strong>No eligible estates for ${escapeHtml(flow.title)}.</strong><span class="copy">Update an estate status or finish the previous prep stage before adding it here.</span></div>`}
        </div>
      </section>
    </div>
  `;
}

function renderDossiersListView(target) {
  const rows = docPrepListRows();
  const flow = docPrepFlow();
  target.innerHTML = `
    <div class="document-prep">
      <div class="document-prep-topline docprep-list-topline">
        <div class="docprep-title-stack">
          <div class="docprep-breadcrumb-row">
            <span>Document Prep</span>
            <span>/</span>
            <strong>All clients</strong>
          </div>
          <h2>All clients</h2>
          <p class="copy">${rows.length ? `${rows.length} document prep${rows.length === 1 ? "" : "s"} in progress.` : "No document preps are in progress yet."}</p>
        </div>
        <div class="docprep-toolbar">
          <button class="btn" type="button" data-docprep-list-back>Current estate</button>
          <button class="btn primary solvys-liquid-glass" type="button" data-open-docprep-add="${escapeHtml(flow.id)}">Add prep</button>
        </div>
      </div>
      <section class="document-panel" aria-label="Document prep clients">
        <div class="docprep-client-list">
          ${rows.map(docPrepClientRowHtml).join("") || `<div class="docprep-empty-state"><strong>No active document prep rows.</strong><span class="copy">Use Add prep to start Estate Discovery or Closing Prep from eligible estates.</span></div>`}
        </div>
      </section>
    </div>
    ${docPrepAddModalHtml()}
  `;
  target.querySelector("[data-docprep-list-back]")?.addEventListener("click", () => {
    state.docPrepListOpen = false;
    renderDossiersView();
  });
  target.querySelectorAll("[data-open-docprep-add]").forEach((button) => {
    button.addEventListener("click", () => openDocPrepAddModal(button.dataset.openDocprepAdd));
  });
  const clientList = target.querySelector(".docprep-client-list");
  clientList?.addEventListener("click", (event) => {
    const trigger = event.target.closest?.("[data-open-docprep-row]");
    if (!trigger || !clientList.contains(trigger)) return;
    if (!trigger.matches?.("button") && event.target.closest?.("input, label")) return;
    event.preventDefault();
    event.stopPropagation();
    openDocPrepRow(trigger.dataset.openDocprepRow, trigger.dataset.openDocprepFlow);
  });
  clientList?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const trigger = event.target.closest?.("[data-open-docprep-row]");
    if (!trigger || !clientList.contains(trigger) || event.target.closest?.("input, label")) return;
    event.preventDefault();
    openDocPrepRow(trigger.dataset.openDocprepRow, trigger.dataset.openDocprepFlow);
  });
  wireDocPrepAddModal(target);
  wireBatchSelection(target, "[data-dossier-row]", "dossiers");
  syncSelectionLabels();
}

function wireDocPrepAddModal(root) {
  root.querySelector("[data-close-docprep-add]")?.addEventListener("click", closeDocPrepAddModal);
  root.querySelector("[data-docprep-add-layer]")?.addEventListener("click", (event) => {
    if (event.target?.matches?.("[data-docprep-add-layer]")) closeDocPrepAddModal();
  });
  root.querySelectorAll("[data-docprep-add-flow]").forEach((button) => {
    button.addEventListener("click", () => openDocPrepAddModal(button.dataset.docprepAddFlow));
  });
  root.querySelectorAll("[data-add-docprep-row]").forEach((button) => {
    button.addEventListener("click", () => addDocPrepForRow(button.dataset.addDocprepRow, button.dataset.addDocprepFlow));
  });
}

function renderDossiersView() {
  const target = document.getElementById("dossiersView");
  if (!target) return;
  const row = selectedRow();
  if (state.docPrepListOpen) {
    renderDossiersListView(target);
    return;
  }
  const dossier = dossierForRow(row);
  const flow = docPrepFlow();
  const docs = docsForFlow(row, dossier, flow.id);
  const stats = documentPrepStats(row, dossier, flow.id);
  const facts = currentProcessFacts(row, dossier);
  const missingDocs = docs.filter((doc) => !documentFileRecord(doc.id, row));
  const dealStatus = dealStatusMeta(dealStatusForRow(row));
  const estateTitle = row ? docPrepEstateLabel(row) : "Current estate";
  target.innerHTML = `
    <div class="document-prep">
      <div class="document-prep-topline">
        <div class="docprep-title-stack">
          <div class="docprep-breadcrumb-row">
            <button class="docprep-breadcrumb" type="button" data-show-docprep-list>All clients</button>
            <span>/</span>
            <strong>${escapeHtml(estateTitle)}</strong>
          </div>
          <h2>${escapeHtml(estateTitle)}</h2>
          <p class="copy docprep-address-stack">${docPrepAddressLinesHtml(row)}</p>
        </div>
        <label class="docprep-status-control">
          <span>Deal status</span>
          <select data-deal-status data-renamable="deal-status" aria-label="Deal status for ${escapeHtml(docPrepEstateLabel(row) || "current estate")}">
            ${dealStatusOptionsHtml(dealStatus.id)}
          </select>
        </label>
        <div class="doc-flow-selector" role="tablist" aria-label="DocPrep workflow templates">
          ${Object.values(docPrepFlows).map((item) => `
            <button class="doc-flow-tab" type="button" role="tab" data-doc-flow="${escapeHtml(item.id)}" aria-pressed="${item.id === flow.id ? "true" : "false"}">
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(`${discoveryProgress(item.id, row)}%${item.tag ? ` · ${item.tag}` : ""}`)}</span>
            </button>
          `).join("")}
        </div>
        <div class="document-filter-tabs" role="tablist" aria-label="Document filters">
          <button type="button" data-doc-filter="all" aria-pressed="true">All</button>
          <button type="button" data-doc-filter="linked" aria-pressed="false">Linked · ${escapeHtml(stats.linked)}</button>
          <button type="button" data-doc-filter="missing" aria-pressed="false">Missing · ${escapeHtml(stats.missing)}</button>
        </div>
      </div>
      <div class="document-prep-shell">
        <section class="document-panel" aria-label="Dossier Supporting Documents">
          <div class="document-panel-head">
            <div class="document-panel-title">
              <h3>${escapeHtml(docPrepEstateLabel(row))}</h3>
              <div class="document-progress-row">
                ${processProgressDots(stats.linked, stats.total)}
                <span>${escapeHtml(`${stats.linked}/${stats.total} documents`)}</span>
              </div>
            </div>
            <div class="document-panel-actions">
              ${docPrepRunControlsHtml(row, flow.id)}
              ${flow.id === "closing-docs" ? closingPacketControlHtml(row) : ""}
            </div>
          </div>
          <div class="document-list">
            ${docs.map((doc) => documentRequirementHtml(doc, row)).join("")}
          </div>
        </section>
        <aside class="process-side" aria-label="Process details">
          <div class="process-side-head">
            <div class="process-side-title">
              <p class="eyebrow">Process</p>
              <h3>${escapeHtml(flow.title)}</h3>
            </div>
            <div class="process-side-actions">
              <button class="btn primary solvys-liquid-glass" type="button" data-queue-stage>Queue</button>
              <span class="headless-menu-wrap" data-ui-menu>
                <button class="btn icon-only beui-menu-trigger" type="button" aria-haspopup="menu" aria-expanded="false" data-ui-menu-button aria-label="Process actions">${nucleoIcon("sliders", 16)}</button>
                <span class="headless-menu beui-menu t-dropdown" data-beui-menu-surface data-origin="top-right" role="menu" hidden>
                  <button class="beui-menu-item" type="button" role="menuitem" data-ui-menu-action="queue" data-document-id="${escapeHtml(docs[0]?.id ?? "discovery-dossier")}">${nucleoIcon("batch-tray", 15)}<span>Stage bundle</span></button>
                  <button class="beui-menu-item" type="button" role="menuitem" data-ui-menu-action="preview" data-document-id="${escapeHtml(docs[0]?.id ?? "discovery-dossier")}">${nucleoIcon("eye", 15)}<span>Preview packet</span></button>
                </span>
              </span>
            </div>
          </div>
          <div class="process-side-body">
            <div class="process-facts">
              ${facts.map(([label, value]) => `<div class="process-fact-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
            </div>
            <section>
              <p class="eyebrow">Still missing</p>
              <ul class="missing-mini-list">
                ${missingDocs.map((doc) => `<li><span>+</span><strong>${escapeHtml(doc.title)}</strong></li>`).join("") || `<li><span>✓</span><strong>All listed documents are linked.</strong></li>`}
              </ul>
            </section>
            ${chatgptWorkHandoffHtml(row, flow.id)}
          </div>
          <div class="process-side-foot">
            <button class="btn" type="button" data-shell-nav-shortcut="find-estates">Back to Estates</button>
          </div>
        </aside>
      </div>
    </div>
  `;
  enhanceSelectMenus(target);
  target.querySelector("[data-show-docprep-list]")?.addEventListener("click", () => {
    state.docPrepListOpen = true;
    state.discoveryOpen = false;
    renderDossiersView();
    renderRail();
  });
  target.querySelector("[data-deal-status]")?.addEventListener("change", (event) => {
    setDealStatusForRow(selectedRow(), event.target.value);
  });
  target.querySelectorAll("[data-doc-flow]").forEach((button) => {
    button.addEventListener("click", async () => {
      setActiveDocPrepFlow(button.dataset.docFlow, { persist: true, rerender: false });
      renderDossiersView();
      renderRail();
      addShellEvent(`${docPrepFlow().label} template selected`, `${docPrepFlow().title} is now the active DocPrep workflow for the selected estate.`, "review", false);
      await hydratePersistedDiscoveryFile(selectedRow());
    });
  });
  target.querySelectorAll("[data-docprep-main-run]").forEach((button) => {
    button.addEventListener("click", (event) => toggleFullDiscoveryRun(event.currentTarget, button.dataset.docprepMainRun || state.activeDocPrepFlow));
  });
  wireIdiReportUploadControls(target, row);
  target.querySelectorAll("[data-docprep-rerun-review]").forEach((button) => {
    button.addEventListener("click", (event) => openDocPrepRerunReview(button.dataset.docprepRerunReview || state.activeDocPrepFlow, event.currentTarget));
  });
  target.querySelectorAll("[data-generate-closing-pdf]").forEach((button) => {
    button.addEventListener("click", (event) => generateClosingPdf(event.currentTarget));
  });
  target.querySelector("[data-queue-stage]")?.addEventListener("click", () => {
    void addRowsToQueue(rowsForBatchAction());
  });
  target.querySelectorAll("[data-prepare-chatgpt-work]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await prepareChatgptWorkHandoff(row, button.dataset.prepareChatgptWork || flow.id, button);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addShellEvent("ChatGPT Work handoff blocked", message, "blocked", true, { row, source: "ChatGPT Work" });
        document.getElementById("topStatus").textContent = `ChatGPT Work handoff blocked: ${message}`;
      }
    });
  });
  target.querySelectorAll("[data-open-chatgpt-work]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await openChatgptWorkHandoff(row, button.dataset.openChatgptWork || flow.id, button);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addShellEvent("ChatGPT Work handoff blocked", message, "blocked", true, { row, source: "ChatGPT Work" });
        document.getElementById("topStatus").textContent = `ChatGPT Work handoff blocked: ${message}`;
      }
    });
  });
  target.querySelectorAll("[data-shell-nav-shortcut]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector(`[data-shell-nav="${button.dataset.shellNavShortcut}"]`)?.click());
  });
  target.querySelectorAll("[data-document-action]").forEach((button) => {
    button.addEventListener("click", () => handleDocumentMenuAction(button.dataset.documentAction, button.dataset.documentId));
  });
  wireDocumentPreviewCards(target);
  target.querySelectorAll("[data-doc-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      target.querySelectorAll("[data-doc-filter]").forEach((item) => item.setAttribute("aria-pressed", item === button ? "true" : "false"));
      const mode = button.dataset.docFilter;
      target.querySelectorAll("[data-document-row]").forEach((rowEl) => {
        const linked = rowEl.classList.contains("is-linked");
        rowEl.hidden = mode === "linked" ? !linked : mode === "missing" ? linked : false;
      });
    });
  });
  wireHeadlessMenus(target);
  if (state.activeView === "dossiers") {
    state.railMode = "dossier";
    renderRail();
  }
}

function renderDossierRail(row = selectedRow(), dossier = dossierForRow(row)) {
  const content = document.getElementById("railContent");
  const flow = docPrepFlow();
  const docs = docsForFlow(row, dossier, flow.id);
  const selectedDoc = selectedDossierDocument(row);
  const qualification = qualificationDecision(dossier);
  syncRailContext(row);
  syncRailTabs();
  if (!content) return;
  if (!row || !dossier) {
    content.innerHTML = `<section class="glass-card rail-title-card"><h2 class="rail-title">Dossier rail</h2><p class="copy">Load the latest lead packet, then choose a dossier to review the documents.</p></section>`;
    setRailOpen(state.railOpen);
    return;
  }
  if (state.docPrepManualFix?.rowKey === docPrepEstateKey(row) && state.docPrepManualFix?.flowId === flow.id) {
    content.innerHTML = renderDocPrepRerunReview(row);
    wireDocPrepRerunReview(content);
    setRailOpen(true);
    return;
  }
  if (state.discoveryOpen) {
    content.innerHTML = renderDiscoveryWizard(row, dossier);
    wireDiscoveryWizard(content);
    setRailOpen(true);
    return;
  }
  const titleCard = `
    <section class="glass-card rail-title-card">
      <div class="rail-title-row">
        <div>
          <p class="eyebrow">${escapeHtml(flow.title)}</p>
          <h2 class="rail-title">${escapeHtml(flow.shortTitle)} checklist</h2>
          <p class="copy">${escapeHtml(flow.copy)}</p>
        </div>
      ${statusPill(discoveryProgress(flow.id, row) >= 100 ? "ready" : "review", discoveryProgress(flow.id, row) >= 100 ? "Complete" : "In progress")}
      </div>
      ${discoveryStripHtml(row, dossier)}
    </section>
  `;
  let bodyHtml = "";
  if (state.railTab === "timeline") {
    bodyHtml = `
      <section class="glass-card rail-card">
        <h3>Quality &amp; Score</h3>
        <ul class="mini-list">
          <li><strong>Status</strong><span>${escapeHtml(qualificationLabel(qualification))}</span></li>
          <li><strong>Source score</strong><span>${escapeHtml(qualificationScoreText(qualification))}</span></li>
          <li><strong>Next action</strong><span>${escapeHtml(qualification?.nextAction ?? "Run the daily qualification packet.")}</span></li>
        </ul>
        <div>
          ${(qualification?.coverage ?? []).map((area, index) => `
            <article class="rail-item">
              <span class="rail-item-index">${String(index + 1).padStart(2, "0")}</span>
              <span>
                <span class="rail-item-title">${escapeHtml(area.label)}</span>
                <span class="rail-item-copy">${escapeHtml(area.nextAction)}</span>
              </span>
              ${statusPill(area.status === "extracted" ? "ready" : area.status === "partial" ? "review" : "blocked", `${area.earned}/${area.weight}`)}
            </article>
          `).join("") || `<p class="copy">Qualification coverage appears after the daily review packet is prepared.</p>`}
        </div>
      </section>
    `;
  } else if (state.railTab === "docs") {
    bodyHtml = `
      <section class="glass-card rail-card">
        <div class="dossier-rail-toolbar">
          <div>
            <p class="eyebrow">Docs</p>
            <h2 class="rail-title">${escapeHtml(flow.shortTitle)} checklist</h2>
            <p class="copy">Checks turn green only after the active DocPrep stage is complete or a linked Supporting Document exists.</p>
          </div>
          <button class="btn" type="button" data-popout-doc="${escapeHtml(selectedDoc?.id ?? "discovery-dossier")}">Pop out</button>
        </div>
        ${dossierChecklistHtml(docs)}
      </section>
      <section class="glass-card rail-card pdf-packet-card">
        <div class="pdf-toolbar"><span>${escapeHtml(selectedDoc?.type ?? "PDF packet")} - ${escapeHtml(selectedDoc?.status ?? "Review")}</span><span class="tracker-date">Embedded PDF reader</span></div>
        <iframe class="pdf-reader" title="${escapeHtml(selectedDoc?.title ?? "Discovery Dossier")}" sandbox="allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation" srcdoc="${escapeHtml(safeDossierPreviewSrcdoc(selectedDoc?.body ?? ""))}"></iframe>
      </section>
    `;
  } else {
    bodyHtml = `
      <section class="glass-card rail-card">
        <h3>${escapeHtml(flow.shortTitle)} checklist</h3>
        <p class="copy">Work the estate in order. Rows turn green after required source evidence, contact review, estate import, or closing package prep is saved.</p>
        ${assetDiscoveryChecklistHtml(row)}
      </section>
      ${flow.id === "closing-docs" ? closingWorkflowPanelHtml(row, dossier) : `${assetCaptureFormHtml(row)}${idiImportPanelHtml(row)}${contactReviewPanelHtml(row)}`}
    `;
  }
  const streamPanel = docPrepStreamPanelHtml(row, dossier, flow.id);
  content.innerHTML = (state.railTab === "flow" ? titleCard : "") + streamPanel + bodyHtml;
  wireDocPrepStreamControls(content, row, flow.id);
  content.querySelectorAll("[data-docprep-main-run]").forEach((button) => {
    button.addEventListener("click", (event) => toggleFullDiscoveryRun(event.currentTarget, button.dataset.docprepMainRun || state.activeDocPrepFlow));
  });
  wireIdiReportUploadControls(content, row);
  content.querySelectorAll("[data-docprep-rerun-review]").forEach((button) => {
    button.addEventListener("click", (event) => openDocPrepRerunReview(button.dataset.docprepRerunReview || state.activeDocPrepFlow, event.currentTarget));
  });
  content.querySelector("[data-generate-closing-pdf]")?.addEventListener("click", (event) => generateClosingPdf(event.currentTarget));
  wireAssetDiscoveryControls(content, row);
  wireClosingFieldControls(content, row);
  content.querySelectorAll("[data-discovery-preference]").forEach((input) => {
    input.addEventListener("change", (event) => {
      setDocPrepPreference(event.target.dataset.discoveryPreference, event.target.checked, row, flow.id);
      addShellEvent("DocPrep preference saved", "The workflow preference is saved in this browser and syncing to the shared team workspace.", "review", false);
    });
  });
  content.querySelectorAll("[data-dossier-doc]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDossierDocId = button.dataset.dossierDoc;
      state.railTab = "docs";
      renderRail();
    });
  });
  content.querySelectorAll("[data-popout-doc]").forEach((button) => {
    button.addEventListener("click", () => popOutDossierDocument(button.dataset.popoutDoc));
  });
  content.querySelector("[data-report-date-added]")?.addEventListener("change", (event) => {
    state.reportDateAdded = event.target.value;
    renderRail();
  });
  content.querySelector("[data-generate-packet-preview]")?.addEventListener("click", (event) => {
    generatePacketPreview(row, event.currentTarget);
  });
  setRailOpen(state.railOpen);
}

function popOutDossierDocument(docId) {
  const row = selectedRow();
  const doc = dossierDocuments(row, dossierForRow(row)).find((item) => item.id === docId) ?? selectedDossierDocument(row);
  const popout = window.open("", "_blank", "width=960,height=760");
  if (!popout) {
    addShellEvent("Pop-out blocked", "Allow browser pop-outs to open the selected dossier document in a separate window.", "blocked", true);
    return;
  }
  // The blank window must be retained long enough to write the inert preview,
  // so sever its opener synchronously before any report-controlled markup is
  // parsed. This provides the same isolation as rel=noopener without losing the
  // Window handle that the preview writer requires.
  popout.opener = null;
  const safePreview = safeDossierPreviewSrcdoc(doc?.body ?? "");
  popout.document.open();
  popout.document.write(safePreview);
  popout.document.close();
}

function outreachTemplateSeed(channel = state.outreachTemplateModal.channel) {
  if (channel === "email") {
    return {
      title: "New Email Template",
      name: "Heir warm follow-up email",
      subject: "Question about {{ dossier.property_address }}",
      body: "Hi {{ contact.first_name }},\n\nI am preparing the {{ dossier.property_address }} estate file for review and wanted to make sure the right family contact receives the packet.\n\nPlease reply with the best phone number for {{ heir.full_name }} or call {{ user.phone }}.\n\nSincerely,\n{{ user.from_name }}\n{{ user.from_email }}",
      limit: 4000
    };
  }
  return {
    title: "New SMS Template",
    name: "Heir warm follow-up SMS",
    subject: "",
    body: "Hi {{ contact.first_name }}, this is {{ user.from_name }} with HeirRight. I am preparing the {{ dossier.property_address }} estate file and need to confirm the best contact for {{ heir.full_name }}. Please call {{ user.phone }}.",
    limit: 1000
  };
}

function openOutreachTemplateModal(channel = "sms", templateId = null) {
  const template = templateId ? state.outreachWorkspace.templates.find((item) => item.id === templateId) : null;
  const resolvedChannel = template?.channel || (channel === "email" ? "email" : "sms");
  state.outreachTemplateModal = {
    open: true,
    channel: resolvedChannel,
    templateId: template?.id || null,
    attachmentsOpen: false
  };
  renderOutreachTemplateModal();
}

function closeOutreachTemplateModal() {
  state.outreachTemplateModal.open = false;
  state.outreachTemplateModal.templateId = null;
  renderOutreachTemplateModal();
}

function outreachTemplateVariables() {
  return outreachVariableRegistry().map((entry) => entry.token);
}

function outreachCampaignOptions(selectedId) {
  return state.outreachWorkspace.campaigns
    .map((campaign) => `<option value="${escapeHtml(campaign.id)}" ${campaign.id === selectedId ? "selected" : ""}>${escapeHtml(campaign.name)}</option>`)
    .join("");
}

function outreachStatusOptions(selectedStatus) {
  return outreachStatuses
    .map((status) => `<option value="${escapeHtml(status)}" ${status === selectedStatus ? "selected" : ""}>${escapeHtml(status)}</option>`)
    .join("");
}

function outreachDelayOptions(selectedDelay) {
  return [1, 3, 5, 7]
    .map((days) => `<option value="${days}" ${days === Number(selectedDelay) ? "selected" : ""}>${days} day${days === 1 ? "" : "s"}</option>`)
    .join("");
}

function outreachOwnerOptions(selectedOwner) {
  const owners = [...outreachAllowedApprovers, "Available for approval"];
  return owners
    .map((owner) => `<option value="${escapeHtml(owner)}" ${owner === selectedOwner ? "selected" : ""}>${escapeHtml(owner)}</option>`)
    .join("");
}

function outreachModalScrollTop() {
  const scroll = document.querySelector("#outreachTemplateModalMount .outreach-modal-scroll");
  return Number(scroll?.scrollTop ?? 0);
}

function restoreOutreachModalScroll(scrollTop) {
  if (!Number.isFinite(scrollTop)) return;
  const restore = () => {
    const scroll = document.querySelector("#outreachTemplateModalMount .outreach-modal-scroll");
    if (scroll) scroll.scrollTop = scrollTop;
  };
  window.requestAnimationFrame(restore);
  window.requestAnimationFrame(() => window.requestAnimationFrame(restore));
  window.setTimeout(restore, 0);
  window.setTimeout(restore, 60);
  window.setTimeout(restore, 140);
}

function readOutreachTemplateForm(mount, nextStatus = null) {
  const channel = state.outreachTemplateModal.channel === "email" ? "email" : "sms";
  const existing = state.outreachTemplateModal.templateId
    ? state.outreachWorkspace.templates.find((template) => template.id === state.outreachTemplateModal.templateId)
    : null;
  const seed = outreachTemplateSeed(channel);
  const body = mount.querySelector("#templateBody")?.value || seed.body;
  const subject = channel === "email" ? (mount.querySelector("#templateSubject")?.value || seed.subject || "") : "";
  return normalizeOutreachTemplate({
    ...(existing || {}),
    id: existing?.id || outreachId("template"),
    channel,
    campaignId: mount.querySelector("#templateCampaign")?.value || state.selectedOutreachCampaignId || "campaign-heir-warm-follow-up",
    podioDestination: mount.querySelector("#templatePodioApp")?.value || "Podio - Outreach Templates",
    name: mount.querySelector("#templateName")?.value?.trim() || seed.name,
    status: nextStatus || mount.querySelector("#templateStatus")?.value || existing?.status || "Draft",
    subject,
    body,
    delayDays: outreachDelayDays(mount.querySelector("#templateDelay")?.value),
    approvalOwner: mount.querySelector("#templateOwner")?.value || "sam@heirright.com",
    stopRules: mount.querySelector("#templateStopRules")?.value || "",
    variables: extractTemplateVariables(`${subject}\n${body}`),
    lastEditedBy: currentActorEmail(),
    lastEditedAt: isoNow(),
    updatedAt: isoNow()
  });
}

function upsertOutreachTemplate(template, action, summary) {
  const index = state.outreachWorkspace.templates.findIndex((item) => item.id === template.id);
  if (index >= 0) state.outreachWorkspace.templates[index] = template;
  else state.outreachWorkspace.templates.unshift(template);
  state.selectedOutreachCampaignId = template.campaignId;
  state.selectedOutreachTemplateId = template.id;
  addOutreachAudit(template.id, action, summary, template.lastEditedBy);
  persistOutreachWorkspace();
  renderCurrentLoopView();
}

function saveOutreachTemplateFromModal(mount, nextStatus) {
  const template = readOutreachTemplateForm(mount, nextStatus);
  const requiredMissing = [
    template.name ? "" : "template name",
    template.body ? "" : "body",
    template.stopRules ? "" : "stop rules",
    template.channel === "email" && !template.subject ? "subject" : ""
  ].filter(Boolean);
  if (nextStatus !== "Draft" && requiredMissing.length) {
    showOutreachNotification({
      tone: "blocked",
      title: "Template still needs fields",
      copy: `Add ${requiredMissing.join(", ")} before submitting for approval.`,
      action: "edit"
    });
    return;
  }
  upsertOutreachTemplate(
    template,
    nextStatus === "Ready" ? "Submitted for approval" : "Draft saved",
    nextStatus === "Ready" ? `${template.name} is ready for approver review.` : `${template.name} was saved as a draft.`
  );
  addShellEvent(
    nextStatus === "Ready" ? "Template submitted for approval" : "Template draft saved",
    nextStatus === "Ready"
      ? `${template.name} is available for sam@heirright.com or joshua@heirright.com approval before Podio sync.`
      : `${template.name} was saved as a ${template.channel.toUpperCase()} draft for Podio preparation. Approval is still required before sync.`,
    "review",
    false
  );
  closeOutreachTemplateModal();
}

function renderOutreachTemplateModal(options = {}) {
  const mount = document.getElementById("outreachTemplateModalMount");
  if (!mount) return;
  const modal = state.outreachTemplateModal;
  if (!modal?.open) {
    mount.innerHTML = "";
    return;
  }
  const editing = modal.templateId ? state.outreachWorkspace.templates.find((template) => template.id === modal.templateId) : null;
  const channel = editing?.channel || (modal.channel === "email" ? "email" : "sms");
  const seed = outreachTemplateSeed(channel);
  const template = normalizeOutreachTemplate({
    ...(editing || {}),
    channel,
    campaignId: editing?.campaignId || state.selectedOutreachCampaignId || state.outreachWorkspace.campaigns[0]?.id,
    name: editing?.name || seed.name,
    subject: editing?.subject || seed.subject,
    body: editing?.body || seed.body,
    delayDays: editing?.delayDays || selectedOutreachCampaign()?.defaultDelayDays || 1,
    status: editing?.status || "Draft"
  });
  const count = template.body.length;
  const isEmail = channel === "email";
  const unresolved = unresolvedTemplateVariables(template);
  const registry = outreachVariableRegistry();
  mount.innerHTML = `
    <div class="outreach-modal-layer" role="presentation" data-outreach-modal-layer>
      <section class="outreach-template-modal" role="dialog" aria-modal="true" aria-labelledby="outreachTemplateTitle">
        <header class="outreach-modal-head">
          <button class="outreach-modal-back" type="button" data-close-outreach-template aria-label="Back to templates">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 18 9 12l6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Templates &amp; Snippets
          </button>
          <div class="outreach-modal-title-row">
            <div>
              <h2 id="outreachTemplateTitle">${escapeHtml(editing ? "Edit Template" : seed.title)}</h2>
              <p class="copy">Build the template here, then hand it to Podio after approval. Nothing sends from this screen.</p>
            </div>
            <div class="template-channel-switch" role="group" aria-label="Template channel">
              <button type="button" data-template-channel="sms" aria-pressed="${channel === "sms"}">SMS</button>
              <button type="button" data-template-channel="email" aria-pressed="${isEmail}">Email</button>
            </div>
          </div>
        </header>
        <div class="outreach-modal-scroll">
          <div class="template-form-grid">
            <div class="template-field">
              <label for="templateCampaign">Campaign</label>
              <select id="templateCampaign">${outreachCampaignOptions(template.campaignId)}</select>
              <span>Templates attach to a campaign before Podio sync.</span>
            </div>
            <div class="template-field">
              <label for="templatePodioApp">Podio destination</label>
              <select id="templatePodioApp">
                ${["Podio - Outreach Templates", "Podio - Probate Follow-Up", "Resend fallback draft"].map((value) => `<option value="${escapeHtml(value)}" ${value === template.podioDestination ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
              </select>
              <span>Podio remains the required automation path; Resend is fallback only.</span>
            </div>
            <div class="template-field">
              <label for="templateName">Name</label>
              <input id="templateName" type="text" value="${escapeHtml(template.name)}" autocomplete="off">
              <span>Maps to Podio template name.</span>
            </div>
            <div class="template-field">
              <label for="templateStatus">Status</label>
              <select id="templateStatus">${outreachStatusOptions(template.status)}</select>
              <span>Approval gates live sync.</span>
            </div>
            ${isEmail ? `<div class="template-field full"><label for="templateSubject">Subject</label><input id="templateSubject" type="text" value="${escapeHtml(template.subject)}" autocomplete="off"><span>Required for email templates and written to the Podio subject field.</span></div>` : ""}
            <div class="template-field">
              <label for="templateDelay">Delay after prior step</label>
              <select id="templateDelay">${outreachDelayOptions(template.delayDays)}</select>
              <span>Used when this template becomes part of a sequence.</span>
            </div>
            <div class="template-field">
              <label for="templateOwner">Approval owner</label>
              <select id="templateOwner">${outreachOwnerOptions(template.approvalOwner)}</select>
              <span>Only approved owners can unlock Podio sync.</span>
            </div>
            <div class="template-field full">
              <label for="templateStopRules">Stop rules</label>
              <textarea id="templateStopRules" rows="2">${escapeHtml(template.stopRules)}</textarea>
              <span>Podio sequence rules and agent checks read this before preparation.</span>
            </div>
          </div>
          <section class="template-body-card" aria-label="${escapeHtml(seed.title)} body">
            <div class="template-body-head">
              <div class="template-body-label">Body</div>
              <div class="template-body-tools">
                <button class="template-tag-link" type="button" data-template-tags>Learn about template tags</button>
                <span>${escapeHtml(channel.toUpperCase())} body field</span>
              </div>
            </div>
            <div class="template-body-editor">
              <textarea id="templateBody" aria-label="Template body">${escapeHtml(template.body)}</textarea>
              <div class="template-editor-toolbar">
                <div class="template-editor-icons">
                  <button class="template-editor-button" type="button" data-template-attachment aria-label="Add attachment" title="Add attachment">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9.1 12.7 5.9-5.9a3.4 3.4 0 0 1 4.8 4.8l-7.4 7.4a5.2 5.2 0 0 1-7.4-7.4l7.4-7.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                  <button class="template-editor-button" type="button" data-template-insert-var aria-label="Insert variable" title="Insert variable">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 4v16M17 4v16M4 8h16M4 16h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </button>
                </div>
                <span class="template-counter" data-template-counter>${escapeHtml(count)} / ${escapeHtml(seed.limit)}</span>
              </div>
            </div>
            ${modal.attachmentsOpen ? `
              <div class="template-attachment-popover">
                <div class="template-attachment-note">Images are limited to 5MB and other media is limited to 600KB. SMS attachments can only be sent to numbers in the US, CA, and AU.</div>
                <button class="template-attachment-option" type="button" data-template-attach-existing>${nucleoIcon("open-book", 17)} Browse existing files</button>
                <button class="template-attachment-option" type="button" data-template-attach-upload>${nucleoIcon("batch-tray", 17)} Upload from your computer</button>
              </div>
            ` : ""}
          </section>
          <section class="template-required-card" aria-label="Podio required fields">
            <div class="template-required-row"><strong>Podio fields</strong><span>Campaign, channel, template name, body, delay, stop rules, status, approval owner, and sync target are required before approval.</span></div>
            <div class="template-required-row"><strong>Variables</strong><span>${registry.slice(0, 18).map((entry) => `${escapeHtml(entry.token)} ${entry.resolved ? "" : "(needs value)"}`).join(", ")}</span></div>
            <div class="template-required-row"><strong>Approval block</strong><span>${unresolved.length ? `${unresolved.length} unresolved variable${unresolved.length === 1 ? "" : "s"} must resolve before approval: ${unresolved.map((entry) => escapeHtml(entry.token)).join(", ")}` : "Variables resolve for the selected dossier preview."}</span></div>
          </section>
        </div>
        <footer class="outreach-modal-foot">
          <span class="template-footnote">Prepared only. No Podio card, email, SMS, or Resend message is created here.</span>
          <div class="template-modal-actions">
            <button class="btn quick" type="button" data-close-outreach-template>Cancel</button>
            <button class="btn quick" type="button" data-save-outreach-template>Save Draft</button>
            <button class="btn primary solvys-liquid-glass" type="button" data-submit-outreach-template>Submit for Approval</button>
          </div>
        </footer>
      </section>
    </div>
  `;

  const scroll = mount.querySelector(".outreach-modal-scroll");
  if (scroll && Number.isFinite(options.scrollTop)) {
    scroll.scrollTop = options.scrollTop;
    window.requestAnimationFrame(() => {
      scroll.scrollTop = options.scrollTop;
    });
  }
  scroll?.addEventListener("scroll", () => {
    if (state.outreachTemplateModal.attachmentsOpen) return;
    if (Date.now() < Number(state.outreachTemplateModal.suppressScrollRememberUntil || 0)) return;
    const previous = Number(state.outreachTemplateModal.lastScrollTop);
    if (!Number.isFinite(previous) || Math.abs(scroll.scrollTop - previous) > 24) {
      state.outreachTemplateModal.lastScrollTop = scroll.scrollTop;
    }
  }, { passive: true });

  enhanceSelectMenus(mount);
  const body = mount.querySelector("#templateBody");
  const counter = mount.querySelector("[data-template-counter]");
  const rememberModalScroll = () => {
    const nextScrollTop = outreachModalScrollTop();
    const previous = Number(state.outreachTemplateModal.lastScrollTop);
    if (!Number.isFinite(previous) || Math.abs(nextScrollTop - previous) > 24) {
      state.outreachTemplateModal.lastScrollTop = nextScrollTop;
    }
  };
  const suppressModalFocusScroll = () => {
    state.outreachTemplateModal.suppressScrollRememberUntil = Date.now() + 360;
  };
  body?.addEventListener("input", () => {
    if (counter) counter.textContent = `${body.value.length} / ${seed.limit}`;
  });
  mount.querySelector("[data-outreach-modal-layer]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeOutreachTemplateModal();
  });
  mount.querySelectorAll("[data-close-outreach-template]").forEach((button) => button.addEventListener("click", (event) => {
    event.preventDefault();
    closeOutreachTemplateModal();
  }));
  mount.querySelectorAll("[data-template-channel]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const scrollTop = outreachModalScrollTop();
      state.outreachTemplateModal.channel = button.dataset.templateChannel === "email" ? "email" : "sms";
      state.outreachTemplateModal.templateId = null;
      state.outreachTemplateModal.attachmentsOpen = false;
      renderOutreachTemplateModal({ scrollTop });
    });
  });
  mount.querySelector("[data-template-attachment]")?.addEventListener("pointerdown", rememberModalScroll);
  mount.querySelector("[data-template-attachment]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const scrollTop = outreachModalScrollTop();
    state.outreachTemplateModal.lastScrollTop = scrollTop;
    state.outreachTemplateModal.attachmentsOpen = !state.outreachTemplateModal.attachmentsOpen;
    renderOutreachTemplateModal({ scrollTop });
  });
  mount.querySelector("[data-template-insert-var]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const scrollTop = outreachModalScrollTop();
    addShellEvent("Template variable menu opened", "Discovery dossier fields are available as Podio template variables for outreach personalization.", "review", false);
    restoreOutreachModalScroll(scrollTop);
  });
  mount.querySelector("[data-template-tags]")?.addEventListener("click", (event) => {
    event.preventDefault();
    const scrollTop = outreachModalScrollTop();
    addShellEvent("Template tags reviewed", "Use contact, lead, dossier, heir, and user tags so Podio can personalize the approved template.", "review", false);
    restoreOutreachModalScroll(scrollTop);
  });
  mount.querySelectorAll("[data-template-attach-existing], [data-template-attach-upload]").forEach((button) => {
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("pointerdown", suppressModalFocusScroll);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const scrollTop = outreachModalScrollTop();
      state.outreachTemplateModal.lastScrollTop = scrollTop;
      addShellEvent("Template attachment staged", "Attachment selection is recorded for Podio preparation. SMS delivery remains limited to US, CA, and AU numbers.", "review", false);
      restoreOutreachModalScroll(scrollTop);
    });
  });
  mount.querySelector("[data-save-outreach-template]")?.addEventListener("click", (event) => {
    event.preventDefault();
    saveOutreachTemplateFromModal(mount, "Draft");
  });
  mount.querySelector("[data-submit-outreach-template]")?.addEventListener("click", (event) => {
    event.preventDefault();
    saveOutreachTemplateFromModal(mount, "Ready");
  });
}

function outreachStatusTone(status) {
  if (status === "Approved" || status === "Sync to Podio") return "ready";
  if (status === "Archived") return "neutral";
  return "review";
}

function formatOutreachDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Not edited yet";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function renderOutreachNotification() {
  const mount = document.getElementById("outreachNotificationMount");
  if (!mount) return;
  const note = state.outreachNotification;
  if (!note) {
    mount.innerHTML = "";
    return;
  }
  mount.innerHTML = `
    <section class="outreach-toast" role="status">
      <strong>${escapeHtml(note.title)}</strong>
      <p>${escapeHtml(note.copy)}</p>
      <div class="outreach-toast-actions">
        ${note.action === "settings" ? `<button class="btn quick" type="button" data-outreach-open-settings>Open Settings</button>` : ""}
        ${note.action === "retry" ? `<button class="btn quick" type="button" data-outreach-retry-sync>Retry</button>` : ""}
        <button class="btn primary solvys-liquid-glass" type="button" data-dismiss-outreach-note>Dismiss</button>
      </div>
    </section>
  `;
  mount.querySelector("[data-dismiss-outreach-note]")?.addEventListener("click", () => showOutreachNotification(null));
  mount.querySelector("[data-outreach-open-settings]")?.addEventListener("click", () => {
    showOutreachNotification(null);
    setActiveShellView("settings", "Settings");
  });
  mount.querySelector("[data-outreach-retry-sync]")?.addEventListener("click", () => {
    const template = selectedOutreachTemplate();
    showOutreachNotification(null);
    if (template) syncOutreachTemplate(template.id);
  });
}

function showOutreachNotification(note) {
  state.outreachNotification = note;
  renderOutreachNotification();
}

function approveOutreachTemplate(templateId, root) {
  const template = state.outreachWorkspace.templates.find((item) => item.id === templateId);
  if (!template) return;
  const owner = root.querySelector("[data-approval-owner]")?.value || template.approvalOwner;
  const password = root.querySelector("[data-approval-password]")?.value || "";
  const unresolved = unresolvedTemplateVariables(template);
  if (!outreachAllowedApprovers.includes(owner)) {
    showOutreachNotification({
      tone: "blocked",
      title: "Approval owner blocked",
      copy: "Only sam@heirright.com or joshua@heirright.com can approve Outreach templates.",
      action: "edit"
    });
    return;
  }
  if (!password.trim()) {
    showOutreachNotification({
      tone: "blocked",
      title: "Password required",
      copy: "Enter the approval password before this template can move to Approved.",
      action: "edit"
    });
    return;
  }
  if (unresolved.length) {
    showOutreachNotification({
      tone: "blocked",
      title: "Variables unresolved",
      copy: `Resolve or fallback-safe ${unresolved.length} variable${unresolved.length === 1 ? "" : "s"} before approval.`,
      action: "edit"
    });
    return;
  }
  const approved = normalizeOutreachTemplate({
    ...template,
    status: "Approved",
    approvalOwner: owner,
    approvedBy: owner,
    approvedAt: isoNow(),
    lastEditedBy: owner,
    lastEditedAt: isoNow(),
    updatedAt: isoNow()
  });
  upsertOutreachTemplate(approved, "Approved", `${approved.name} was approved by ${owner}.`);
  addShellEvent("Outreach template approved", `${approved.name} can be prepared for Podio sync. No message was sent.`, "ready", false);
}

function archiveOutreachTemplate(templateId) {
  const template = state.outreachWorkspace.templates.find((item) => item.id === templateId);
  if (!template) return;
  const archived = normalizeOutreachTemplate({
    ...template,
    status: "Archived",
    archivedAt: isoNow(),
    lastEditedBy: currentActorEmail(),
    lastEditedAt: isoNow(),
    updatedAt: isoNow()
  });
  upsertOutreachTemplate(archived, "Archived", `${archived.name} was moved to Archive.`);
  state.selectedOutreachTemplateId = activeOutreachTemplates(archived.campaignId)[0]?.id || archived.id;
  persistOutreachWorkspace();
  renderDripsView();
}

function restoreOutreachTemplate(templateId) {
  const template = state.outreachWorkspace.templates.find((item) => item.id === templateId);
  if (!template) return;
  const restored = normalizeOutreachTemplate({
    ...template,
    status: "Draft",
    archivedAt: "",
    lastEditedBy: currentActorEmail(),
    lastEditedAt: isoNow(),
    updatedAt: isoNow()
  });
  upsertOutreachTemplate(restored, "Restored", `${restored.name} was restored to active drafts.`);
}

function deleteArchivedOutreachTemplate(templateId) {
  const template = state.outreachWorkspace.templates.find((item) => item.id === templateId);
  if (!template || template.status !== "Archived") return;
  addOutreachAudit(template.id, "Deleted", `${template.name} was permanently removed from active template lists. Audit history retained.`, currentActorEmail());
  state.outreachWorkspace.templates = state.outreachWorkspace.templates.filter((item) => item.id !== templateId);
  state.selectedOutreachTemplateId = activeOutreachTemplates()[0]?.id || archivedOutreachTemplates()[0]?.id || null;
  persistOutreachWorkspace("Archived template permanently deleted");
  renderDripsView();
}

async function syncOutreachTemplate(templateId) {
  const template = state.outreachWorkspace.templates.find((item) => item.id === templateId);
  if (!template) return;
  if (template.status !== "Approved") {
    showOutreachNotification({
      tone: "blocked",
      title: "Approval required",
      copy: "Approve this template before preparing a Podio sync.",
      action: "edit"
    });
    return;
  }
  showOutreachNotification({
    tone: "review",
    title: "Preparing outreach package",
    copy: "HeirRight is preparing a Podio review package. If the backstage handoff is not configured, the package stays in the app-owned review queue without sending.",
    action: "retry"
  });
  const podio = connectionByName("Podio");
  const campaign = selectedOutreachCampaign();
  let result = null;
  try {
    result = await postJson("/api/outreach/sync", {
      template,
      campaign,
      lead: selectedRow(),
      podioReady: Boolean(podio?.ok && podio?.mode === "live"),
      actor: currentActorEmail(),
      requestedAt: isoNow()
    });
  } catch (error) {
    result = {
      ok: false,
      status: "architecturally_free_outreach",
      message: error.message || "Backstage Outreach handoff unavailable."
    };
  }
  if (!result?.ok) {
    const fallback = normalizeOutreachTemplate({
      ...template,
      status: "Sync to Podio",
      podioSyncState: "Architecturally Free Outreach fallback",
      podioArtifactId: `free-outreach-${template.id}`,
      lastEditedBy: currentActorEmail(),
      lastEditedAt: isoNow(),
      updatedAt: isoNow()
    });
    upsertOutreachTemplate(fallback, "Fallback outreach staged", `${fallback.name} was staged in the Architecturally Free Outreach path. No outbound send was attempted.`);
    showOutreachNotification({
      tone: "review",
      title: "Fallback outreach staged",
      copy: result?.message || "Backstage handoff is unavailable, so the reviewed template was staged in the app-owned outreach queue without sending.",
      action: "settings"
    });
    return;
  }
  const synced = normalizeOutreachTemplate({
    ...template,
    status: "Sync to Podio",
    podioSyncState: "Podio review package queued",
    podioArtifactId: result?.runId || `podio-template-${template.id}`,
    lastEditedBy: currentActorEmail(),
    lastEditedAt: isoNow(),
    updatedAt: isoNow()
  });
  upsertOutreachTemplate(synced, "Podio package queued", `${synced.name} was handed to the approved Podio review workflow. No direct SMS or email send was attempted by HeirRight Leads.`);
  showOutreachNotification({
    tone: "ready",
    title: "Podio package queued",
    copy: "The reviewed outreach package is queued for Podio readback. Proof is still required before any outbound send.",
    action: "retry"
  });
}

function outreachTemplateListHtml(templates, sectionTitle = "templates") {
  if (!templates.length) {
    return `<li class="template-list-item"><strong>No ${escapeHtml(sectionTitle.toLowerCase())} yet</strong><span>Create or move an SMS/email template into this section when it clears review.</span></li>`;
  }
  return templates.map((template) => `
    <li>
      <button class="template-list-item ${template.id === state.selectedOutreachTemplateId ? "is-selected" : ""}" type="button" data-outreach-template="${escapeHtml(template.id)}">
        <strong>${escapeHtml(template.name)}</strong>
        <span>${escapeHtml(templateSummary(template))}</span>
        <span>${escapeHtml(formatOutreachDate(template.lastEditedAt))} by ${escapeHtml(template.lastEditedBy)}</span>
      </button>
    </li>
  `).join("");
}

function outreachTemplateSectionsHtml(campaignId) {
  const templates = state.outreachWorkspace.templates.filter((template) => template.campaignId === campaignId && template.status !== "Archived");
  const sections = [
    {
      title: "Active templates",
      templates: templates.filter((template) => ["Ready", "Approved"].includes(template.status))
    },
    {
      title: "Exported templates",
      templates: templates.filter((template) => template.status === "Sync to Podio")
    },
    {
      title: "Draft templates",
      templates: templates.filter((template) => template.status === "Draft")
    }
  ];
  return sections.map((section) => `
    <section class="template-status-section" aria-label="${escapeHtml(section.title)} templates">
      <div class="template-section-head">
        <strong>${escapeHtml(section.title)}</strong>
        <span class="outreach-template-count">${escapeHtml(section.templates.length)} shown</span>
      </div>
      <ul class="template-section-list">
        ${outreachTemplateListHtml(section.templates, section.title)}
      </ul>
    </section>
  `).join("");
}

function outreachSidePanelHtml(variables, settings) {
  const activeTab = state.outreachSideTab === "preferences" ? "preferences" : "variables";
  return `
    <section class="loop-panel outreach-side-card">
      <div class="loop-panel-head">
        <div><p class="eyebrow">Outreach Prep</p><h2 class="loop-title">${activeTab === "preferences" ? "Cadence controls" : "Preview inputs"}</h2></div>
        <span class="pill neutral">${activeTab === "preferences" ? "Local" : `${escapeHtml(variables.filter((entry) => entry.resolved).length)} ready`}</span>
      </div>
      <div class="tabbed-panel">
        <div class="tab-strip" role="tablist" aria-label="Outreach side panel">
          <button type="button" data-outreach-side-tab="variables" aria-pressed="${activeTab === "variables"}">Variables</button>
          <button type="button" data-outreach-side-tab="preferences" aria-pressed="${activeTab === "preferences"}">Preferences</button>
        </div>
        ${activeTab === "variables" ? `
          <div class="variable-scroll">
            <ul class="variable-list">
              ${variables.map((entry) => `<li class="variable-item"><strong>${escapeHtml(entry.token)}</strong><span>${escapeHtml(entry.label)} - ${escapeHtml(entry.value)}</span></li>`).join("")}
            </ul>
          </div>
        ` : `
          <div class="settings-grid">
            <div class="setting-card"><label for="dripStartDelay"><strong>Start delay</strong><span>After dossier approval</span></label><select id="dripStartDelay" data-drip-setting="startDelay"><option value="same-day">Same day after review</option><option value="next-business">Next business morning</option></select></div>
            <div class="setting-card"><label for="dripSmsCap"><strong>SMS cap</strong><span><span data-drip-sms-value>${escapeHtml(settings.smsCap)}</span> messages per heir, per week</span></label><input id="dripSmsCap" data-drip-setting="smsCap" type="range" min="1" max="4" value="${escapeHtml(settings.smsCap)}"></div>
            <div class="setting-card"><label class="toggle-line"><strong>Require Finished Discovery before Auto Follow-Up</strong><input id="dripRequireCourtPacket" data-drip-setting="requireCourtPacket" type="checkbox" ${settings.requireCourtPacket ? "checked" : ""}></label><span>Auto follow-up waits until Discovery is finished and the dossier is review-ready.</span></div>
            <div class="setting-card"><label class="toggle-line"><strong>Hold no-contact leads</strong><input id="dripHoldNoContact" data-drip-setting="holdNoContact" type="checkbox" ${settings.holdNoContact ? "checked" : ""}></label><span>No-contact, company-owned, source-blocked, and recent-sale leads stay out of outreach.</span></div>
            <div class="setting-card"><label for="dripOperatorNote"><strong>Review note</strong><span>Saved with the scheduled-work prep controls</span></label><textarea id="dripOperatorNote" class="discovery-notes" data-drip-setting="operatorNote" rows="3" placeholder="Example: keep SMS paused until the court packet is reviewed.">${escapeHtml(settings.operatorNote)}</textarea></div>
          </div>
        `}
      </div>
    </section>
  `;
}

function outreachWorkflowControlsHtml(campaign, settings) {
  const podio = connectionByName("Podio");
  const activepieces = connectionByName("Activepieces");
  const podioReady = Boolean(podio?.ok && podio?.mode === "live");
  const automationReady = Boolean(activepieces?.ok && activepieces?.mode === "live");
  return `
    <section class="outreach-workflow-controls" aria-label="Outreach workflow controls">
      <div class="workflow-control-head">
        <div>
          <p class="eyebrow">Workflow Controls</p>
          <h3>${escapeHtml(campaign?.name || "Selected campaign")}</h3>
        </div>
        <span class="pill ${podioReady && automationReady ? "ready" : "review"}">${escapeHtml(podioReady ? "Package-ready" : "Review-only")}</span>
      </div>
      <div class="workflow-control-grid">
        <label class="workflow-control-item">
          <span>Trigger</span>
          <select data-drip-setting="workflowTrigger">
            <option value="post-discovery">Finished Discovery</option>
            <option value="queue-stage">Queued export</option>
            <option value="manual">Manual only</option>
          </select>
        </label>
        <label class="workflow-control-item">
          <span>Recipient</span>
          <strong>Reviewed primary contact</strong>
          <em>Fallback contacts stay blocked until approved.</em>
        </label>
        <label class="workflow-control-item">
          <span>Send as</span>
          <select data-drip-setting="senderMode">
            <option value="lead-owner">Lead owner</option>
            <option value="approval-owner">Approval owner</option>
            <option value="static-manager">Manager fallback</option>
          </select>
        </label>
        <label class="workflow-control-item">
          <span>Window</span>
          <select data-drip-setting="communicationWindow">
            <option value="weekday-9-4">Weekdays 9-4</option>
            <option value="weekday-10-6">Weekdays 10-6</option>
            <option value="manual-only">Manual approval only</option>
          </select>
        </label>
        <label class="workflow-control-item">
          <span>Run rule</span>
          <select data-drip-setting="runRule">
            <option value="run-once">Run once per contact</option>
            <option value="run-multiple">Allow repeat after approval</option>
          </select>
        </label>
        <label class="workflow-control-item">
          <span>Stop rules</span>
          <select data-outreach-stop-rules aria-label="Stop rules for ${escapeHtml(campaign?.name || "selected campaign")}">
            ${outreachStopRuleOptionsHtml(campaign)}
          </select>
          <em>${escapeHtml((campaign?.stopRules || []).join(" / ") || "Campaign stop rules required.")}</em>
        </label>
      </div>
    </section>
  `;
}

function outreachPipelineHtml(template) {
  const status = template?.status || "Draft";
  const approved = status === "Approved" || status === "Sync to Podio";
  const synced = status === "Sync to Podio";
  const ready = status === "Ready" || approved;
  const stages = [
    { title: "Stage", state: "ready", copy: "Draft exists in the app." },
    { title: "Review", state: ready ? "ready" : "review", copy: ready ? "Variables and stop rules reviewed." : "Mark Ready after variables and stop rules are checked." },
    { title: "Approve", state: approved ? "ready" : "review", copy: approved ? "Approved owner recorded." : "Needs approved owner and password." },
    { title: "Sync package", state: synced ? "ready" : approved ? "review" : "blocked", copy: synced ? "Podio review package prepared." : approved ? "Ready to prepare a Podio package." : "Approval required first." },
    { title: "Send locked", state: "blocked", copy: "No direct SMS or email send from HeirRight." },
  ];
  return `
    <div class="outreach-pipeline" aria-label="Outreach approval path">
      ${stages.map((stage) => `
        <div class="outreach-pipeline-step" data-state="${escapeHtml(stage.state)}">
          <strong>${escapeHtml(stage.title)}</strong>
          <span>${escapeHtml(stage.copy)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function outreachEditorHtml(template) {
  if (!template) {
    return `
      <section class="loop-panel outreach-editor-panel">
        <div class="loop-panel-head"><div><p class="eyebrow">Template</p><h2 class="loop-title">Nothing selected</h2></div></div>
        <p class="copy">Create an SMS or email template to begin the Podio-ready Outreach workflow.</p>
        ${outreachPipelineHtml(null)}
        <div class="template-action-row">
          <button class="btn quick solvys-liquid-glass" type="button" data-template-send-blocked="none" onclick="handleOutreachTemplateAction(this); return false;">Send locked</button>
        </div>
      </section>
    `;
  }
  const unresolved = unresolvedTemplateVariables(template);
  const audit = outreachTemplateAudit(template.id);
  const renderedSubject = renderTemplateText(template.subject || "");
  const renderedBody = renderTemplateText(template.body || "");
  return `
    <section class="loop-panel outreach-editor-panel">
      <div class="loop-panel-head">
        <div>
          <p class="eyebrow">Template</p>
          <h2 class="loop-title">${escapeHtml(template.name)}</h2>
        </div>
        <span class="pill ${outreachStatusTone(template.status)}">${escapeHtml(template.status)}</span>
      </div>
      <p class="copy">${escapeHtml(templateSummary(template))}</p>
      ${outreachPipelineHtml(template)}
      <div class="template-preview-box">
        <strong>Selected dossier preview</strong>
        ${template.channel === "email" ? `<span class="copy">Subject: ${escapeHtml(renderedSubject || "No subject")}</span>` : ""}
        <pre>${escapeHtml(renderedBody)}</pre>
      </div>
      <div class="template-required-card">
        <div class="template-required-row"><strong>Variable readiness</strong><span>${unresolved.length ? `${unresolved.length} unresolved variable${unresolved.length === 1 ? "" : "s"}: ${unresolved.map((entry) => escapeHtml(entry.token)).join(", ")}` : "Ready for approval preview."}</span></div>
        <div class="template-required-row"><strong>Stop rules</strong><span>${escapeHtml(template.stopRules || "Stop rules required before approval.")}</span></div>
        <div class="template-required-row"><strong>Podio state</strong><span>${escapeHtml(template.podioSyncState || "Not synced")}</span></div>
      </div>
      <div class="approval-row">
        <label>Approver
          <select data-approval-owner>${outreachOwnerOptions(template.approvalOwner)}</select>
        </label>
        <label>Password
          <input data-approval-password type="password" placeholder="Required to approve">
        </label>
        <button class="btn primary solvys-liquid-glass" type="button" data-template-approve="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Approve</button>
      </div>
      <div class="template-action-row">
        ${template.status !== "Archived" ? `<button class="btn quick solvys-liquid-glass" type="button" data-template-edit="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Edit</button>` : ""}
        ${template.status === "Draft" ? `<button class="btn quick solvys-liquid-glass" type="button" data-template-ready="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Mark Ready</button>` : ""}
        ${template.status === "Approved" ? `<button class="btn primary solvys-liquid-glass" type="button" data-template-sync="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Sync package</button>` : ""}
        <button class="btn quick solvys-liquid-glass" type="button" data-template-send-blocked="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Send locked</button>
        ${template.status !== "Archived" ? `<button class="plain-action" type="button" data-template-archive="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Archive</button>` : `<button class="plain-action" type="button" data-template-restore="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Restore</button><button class="plain-action" type="button" data-template-delete="${escapeHtml(template.id)}" onclick="handleOutreachTemplateAction(this); return false;">Delete permanently</button>`}
      </div>
      <p class="outreach-section-label">Audit Trail</p>
      <ul class="audit-list">
        ${audit.length ? audit.slice(0, 6).map((event) => `<li class="audit-item"><strong>${escapeHtml(event.action)}</strong><span>${escapeHtml(event.summary)}</span><span>${escapeHtml(formatOutreachDate(event.at))} by ${escapeHtml(event.actorEmail)}</span></li>`).join("") : `<li class="audit-item"><strong>No audit events yet</strong><span>Saving this template will record the first edit.</span></li>`}
      </ul>
    </section>
  `;
}

function handleOutreachTemplateAction(button, root = document.getElementById("dripsView")) {
  if (!button || !root?.contains(button)) return false;
  if (button.dataset.templateEdit) {
    openOutreachTemplateModal(selectedOutreachTemplate()?.channel || "sms", button.dataset.templateEdit);
    return true;
  }
  if (button.dataset.templateReady) {
    const template = state.outreachWorkspace.templates.find((item) => item.id === button.dataset.templateReady);
    if (!template) return true;
    const ready = normalizeOutreachTemplate({ ...template, status: "Ready", lastEditedBy: currentActorEmail(), lastEditedAt: isoNow(), updatedAt: isoNow() });
    upsertOutreachTemplate(ready, "Marked ready", `${ready.name} is available for approval.`);
    addShellEvent("Template marked ready", `${ready.name} is available for approval. No live outreach was sent.`, "review", false);
    return true;
  }
  if (button.dataset.templateApprove) {
    approveOutreachTemplate(button.dataset.templateApprove, root);
    return true;
  }
  if (button.dataset.templateSync) {
    syncOutreachTemplate(button.dataset.templateSync);
    return true;
  }
  if (button.dataset.templateSendBlocked) {
    showOutreachNotification({
      tone: "blocked",
      title: "Direct send is locked",
      copy: "HeirRight does not send SMS or email from this screen. Prepare a reviewed Podio package, confirm readback proof, then use the approved external send path.",
      action: "settings"
    });
    addShellEvent("Outbound send blocked", "A user checked the send path. The app kept the reviewed outreach package locked from direct SMS/email send.", "blocked", false);
    return true;
  }
  if (button.dataset.templateArchive) {
    archiveOutreachTemplate(button.dataset.templateArchive);
    return true;
  }
  if (button.dataset.templateRestore) {
    restoreOutreachTemplate(button.dataset.templateRestore);
    return true;
  }
  if (button.dataset.templateDelete) {
    deleteArchivedOutreachTemplate(button.dataset.templateDelete);
    return true;
  }
  return false;
}

function renderDripsView() {
  const target = document.getElementById("dripsView");
  if (!target) return;
  const campaign = selectedOutreachCampaign();
  const campaignTemplates = state.outreachWorkspace.templates.filter((template) => template.campaignId === campaign?.id && template.status !== "Archived");
  const archivedTemplates = archivedOutreachTemplates(campaign?.id);
  const selectableTemplates = campaignTemplates.length ? campaignTemplates : archivedTemplates;
  if (!state.selectedOutreachTemplateId || !selectableTemplates.some((template) => template.id === state.selectedOutreachTemplateId)) {
    state.selectedOutreachTemplateId = selectableTemplates[0]?.id || null;
  }
  const selectedTemplate = selectedOutreachTemplate();
  const variables = outreachVariableRegistry();
  const settings = state.dripSettings;
  target.innerHTML = `
    <div class="outreach-layout">
      <section class="loop-panel outreach-panel">
        <div class="loop-panel-head">
          <div><p class="eyebrow">Outreach</p><h2 class="loop-title">Campaign templates</h2></div>
          <div class="outreach-actions">
            <button class="btn text-action" type="button" data-new-template="email">New Email</button>
            <button class="btn primary solvys-liquid-glass" type="button" data-new-template="sms">New SMS</button>
          </div>
        </div>
        <p class="copy">Create SMS and email templates, attach them to campaigns, and prepare the Podio sync path. Templates do not send until approved and synced.</p>
        ${outreachWorkflowControlsHtml(campaign, settings)}
        <div class="outreach-workspace">
          <div class="outreach-column">
            <p class="outreach-section-label">Campaigns</p>
            <ul class="campaign-list">
              ${state.outreachWorkspace.campaigns.map((item) => `
                <li>
                  <button class="campaign-item ${item.id === campaign?.id ? "is-selected" : ""}" type="button" data-outreach-campaign="${escapeHtml(item.id)}">
                    <strong>${escapeHtml(item.name)}</strong>
                    <span>${escapeHtml(item.description || "Campaign needs description.")}</span>
                    <span>${escapeHtml(item.defaultDelayDays)} day${item.defaultDelayDays === 1 ? "" : "s"} default delay</span>
                  </button>
                </li>
              `).join("")}
            </ul>
          </div>
          <div class="outreach-column">
            <div class="loop-panel-head">
              <p class="outreach-section-label">Templates</p>
              <span class="outreach-template-count">${campaignTemplates.length} shown</span>
            </div>
            ${outreachTemplateSectionsHtml(campaign?.id)}
          </div>
        </div>
      </section>
      <aside class="outreach-side" aria-label="Outreach review and cadence controls">
        ${outreachEditorHtml(selectedTemplate)}
        ${outreachSidePanelHtml(variables, settings)}
      </aside>
    </div>
  `;
  const startDelay = target.querySelector("#dripStartDelay");
  if (startDelay) startDelay.value = settings.startDelay;
  target.querySelectorAll("[data-drip-setting]").forEach((control) => {
    const key = control.dataset.dripSetting;
    if (!key || control.type === "checkbox" || control.type === "range" || control.tagName === "TEXTAREA") return;
    if (Object.prototype.hasOwnProperty.call(settings, key)) control.value = settings[key];
  });
  enhanceSelectMenus(target);
  target.querySelectorAll("[data-new-template]").forEach((button) => {
    button.addEventListener("click", () => openOutreachTemplateModal(button.dataset.newTemplate === "email" ? "email" : "sms"));
  });
  target.querySelectorAll("[data-outreach-campaign]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOutreachCampaignId = button.dataset.outreachCampaign;
      state.outreachArchiveOpen = false;
      state.selectedOutreachTemplateId = activeOutreachTemplates(button.dataset.outreachCampaign)[0]?.id || null;
      renderDripsView();
    });
  });
  target.querySelectorAll("[data-outreach-template]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOutreachTemplateId = button.dataset.outreachTemplate;
      renderDripsView();
    });
  });
  target.querySelectorAll("[data-outreach-side-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.outreachSideTab = button.dataset.outreachSideTab === "preferences" ? "preferences" : "variables";
      renderDripsView();
    });
  });
  target.querySelector("[data-outreach-stop-rules]")?.addEventListener("change", (event) => {
    updateSelectedOutreachStopRules(event.currentTarget.value);
  });
  target.querySelectorAll("[data-drip-setting]").forEach((control) => {
    const update = () => {
      const key = control.dataset.dripSetting;
      if (!key) return;
      state.dripSettings[key] = control.type === "checkbox" ? control.checked : control.value;
      const smsValue = target.querySelector("[data-drip-sms-value]");
      if (smsValue) smsValue.textContent = state.dripSettings.smsCap;
      persistDripSettings();
    };
    control.addEventListener(control.type === "range" || control.tagName === "TEXTAREA" ? "input" : "change", update);
    control.addEventListener("change", () => persistDripSettings("Drip controls saved"));
  });
  renderOutreachNotification();
}

function renderQueueView() {
  const target = document.getElementById("queueView");
  if (!target) return;
  const items = queueItems();
  const visibleItems = items.filter((item) => item.type === (state.queueTab === "export" ? "export" : "doc-prep"));
  const readiness = queueReadinessItems();
  target.innerHTML = `
    <div class="queue-layout">
      <section class="loop-panel queue-panel">
        <div class="loop-panel-head"><div><p class="eyebrow">Queue</p><h2 class="loop-title">Batch Queue export</h2></div><button class="btn primary solvys-liquid-glass" type="button" data-queue-export ${items.length ? "" : "disabled"}>${nucleoIcon("batch-tray", 15)}<span>Export combined PDF</span></button></div>
        <p class="copy">Use this queue after Discovery review to stage documents, CRM fields, and spreadsheet rows as one batch. Exports produce one combined PDF per selected flow; nothing here creates a live Podio card, Google Doc, Google Sheet row, email, or SMS.</p>
        <div class="beui-tabs queue-tabs" role="tablist" aria-label="Queue type">
          <button class="beui-tabs-trigger" type="button" role="tab" data-queue-tab="doc-prep" aria-selected="${state.queueTab !== "export"}">Doc Prep</button>
          <button class="beui-tabs-trigger" type="button" role="tab" data-queue-tab="export" aria-selected="${state.queueTab === "export"}">Export</button>
        </div>
        <div class="queue-table-wrap">
          <table class="queue-table">
            <thead><tr><th scope="col" class="queue-check-col"><span class="sr-only">Select</span></th><th scope="col">Estate</th><th scope="col">Status</th><th scope="col" class="queue-actions-col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              ${visibleItems.map((item) => `<tr class="queue-row" data-queue-row="${escapeHtml(item.id)}">
                <td class="queue-check-col"><input type="checkbox" data-queue-select="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.estate)}" ${state.queueSelectionIds.has(item.id) ? "checked" : ""}></td>
                <td><strong>${escapeHtml(item.estate)}</strong><span class="queue-row-copy">${escapeHtml(item.copy)}</span></td>
                <td><span class="queue-row-status" data-queue-row-status>${escapeHtml(item.status)}</span></td>
                <td class="queue-actions-col"><span class="queue-row-actions" aria-label="Actions for ${escapeHtml(item.estate)}">
                  <span class="queue-row-spinner" data-queue-spinner hidden aria-hidden="true"></span>
                  <button class="plain-action" type="button" data-queue-run="${escapeHtml(item.id)}">Run individually</button>
                  <button class="plain-action is-danger" type="button" data-queue-remove="${escapeHtml(item.id)}">Remove</button>
                </span></td>
              </tr>`).join("") || `<tr class="queue-empty-row"><td colspan="4"><strong>No ${state.queueTab === "export" ? "export" : "Doc Prep"} items queued</strong><span>Open Estate Search and select estates before staging a batch.</span></td></tr>`}
            </tbody>
          </table>
        </div>
      </section>
      <aside class="queue-side" aria-label="Queue review">
        <section class="loop-panel">
          <div class="loop-panel-head"><div><p class="eyebrow">Readiness</p><h2 class="loop-title">Needs Review (Queued Items)</h2></div><span class="pill review">Review</span></div>
          <ul class="mini-list">
            ${readiness.map((item) => `<li><strong>${linearStatusIconHtml(item.state === "complete" ? "complete" : item.mandatory ? "blocked" : "pending", item.state)} ${escapeHtml(item.title)}</strong><span>${escapeHtml(item.copy)}</span></li>`).join("")}
          </ul>
          ${state.exportResult?.ok && state.exportResult?.artifactUrl ? `<a class="btn primary solvys-liquid-glass" href="${escapeHtml(state.exportResult.artifactUrl)}" download>${nucleoIcon("batch-tray", 15)}<span>Download latest PDF</span></a>` : ""}
        </section>
      </aside>
    </div>
  `;
  target.querySelectorAll("[data-queue-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.queueTab = button.dataset.queueTab === "export" ? "export" : "doc-prep";
      renderQueueView();
    });
  });
  target.querySelectorAll("[data-queue-select]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.queueSelectionIds.add(checkbox.dataset.queueSelect);
      else state.queueSelectionIds.delete(checkbox.dataset.queueSelect);
    });
  });
  target.querySelector("[data-queue-export]")?.addEventListener("click", (event) => {
    const actionRows = queuedRows().length ? queuedRows() : checkedRows();
    if (!actionRows.length) {
      nudgeDeniedAction(
        event.currentTarget,
        "Batch export blocked",
        "Select or queue an estate before generating a combined PDF.",
        { source: "queue-export" }
      );
      return;
    }
    actionRows.forEach((row) => state.queueIds.add(row.id));
    chooseExportRoute("pdf", event.currentTarget, actionRows);
  });
  target.querySelectorAll("[data-queue-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      const estateId = button.dataset.queueRemove;
      if (!estateId || button.disabled) return;
      const row = rowById(estateId);
      if (!row) return;
      button.disabled = true;
      const spinner = button.closest(".queue-row-actions")?.querySelector("[data-queue-spinner]");
      if (spinner) spinner.hidden = false;
      try {
        await dispatchLegacyCommand("remove-from-queue", { estateId });
        state.queueIds.delete(estateId);
        state.queueSelectionIds.delete(estateId);
        document.getElementById("topStatus").textContent = `${docPrepEstateLabel(row)} was removed from Queue.`;
        renderQueueView();
        syncBatchExportControls();
      } catch (error) {
        button.disabled = false;
        if (spinner) spinner.hidden = true;
        nudgeDeniedAction(button, "Queue removal blocked", error instanceof Error ? error.message : "The estate could not be removed safely.", { source: "queue-remove" });
      }
    });
  });
  target.querySelectorAll("[data-queue-run]").forEach((button) => {
    button.addEventListener("click", async () => {
      const estateId = button.dataset.queueRun;
      const row = rowById(estateId);
      if (!row || button.disabled) return;
      button.disabled = true;
      const actionRoot = button.closest(".queue-row-actions");
      const spinner = actionRoot?.querySelector("[data-queue-spinner]");
      if (spinner) spinner.hidden = false;
      try {
        state.selectedId = row.id;
        state.docPrepListOpen = false;
        await runS40DocPrep([row.id]);
        setActiveShellView("dossiers", "Doc Prep");
      } catch (error) {
        button.disabled = false;
        if (spinner) spinner.hidden = true;
        nudgeDeniedAction(button, "Doc Prep run blocked", error instanceof Error ? error.message : "The individual run could not start safely.", { source: "queue-run" });
      }
    });
  });
}

function adminErrorItems() {
  const connectionNames = ["Podio", "Google", "Resend", "SMS Gateway", "Web Search", "Tax Collector Source", "Miami-Dade Clerk API", "Vital/Obituary Workflow", "IDI Core", "Browserbase Usage", "Activepieces", "Linear Support", "Leads Engine Access"];
  const actionItems = state.actionErrorLog.filter((item) => item?.resolved !== true && item?.dismissed !== true).map((item) => ({ ...item, ready: false }));
  const connectionItems = connectionNames.map((name) => {
    const connection = connectionByName(name);
    const ok = Boolean(connection?.ok && connection?.mode === "live");
    const tone = connectionTone(connection);
    return {
      id: `connection-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      title: `${connectionDisplayName(name)} setup`,
      copy: operatorConnectionMessage(connection, name),
      severity: ok ? "ready" : tone === "review" ? "review" : "blocked",
      ready: ok,
      payload: {
        source: "admin-error-log",
        category: "integration",
        integration: name,
        message: operatorConnectionMessage(connection, name),
        rawConnection: connection || null
      }
    };
  }).filter((item) => !item.ready);
  const selected = selectedRow();
  const dossier = dossierForRow(selected);
  const docItems = selected ? docPrepReadinessItems(selected, dossier).filter((item) => item.state !== "complete").map((item, index) => ({
    id: `docprep-${index}`,
    title: item.title,
    copy: item.copy,
    severity: item.mandatory ? "blocked" : "review",
    ready: false,
    payload: {
      source: "admin-error-log",
      category: "document-prep",
      leadId: selected?.id,
      lead: selected?.leadName || selected?.title,
      item
    }
  })) : [];
  const fallback = !actionItems.length && !connectionItems.length && !docItems.length ? [{
    id: "no-errors",
    title: "No open setup errors",
    copy: "Current workspace blockers are clear. New integration or document-prep issues will appear here.",
    severity: "ready",
    ready: true,
    payload: {}
  }] : [];
  return [...actionItems, ...connectionItems, ...docItems, ...fallback].slice(0, 12);
}

function adminStatusHtml(status) {
  if (!status?.message) return `<span class="admin-submit-status" data-state="idle"></span>`;
  const stateName = status.state || "idle";
  const icon = stateName === "processing"
    ? `<span class="admin-processing-spinner" aria-hidden="true"></span>`
    : stateName === "success" || stateName === "fading"
      ? linearStatusIconHtml("complete", "Complete")
      : "";
  return `<span class="admin-submit-status" data-state="${escapeHtml(stateName)}">${icon}<span>${escapeHtml(status.message)}</span></span>`;
}

function teamActivityRows() {
  const blockers = adminErrorItems().filter((item) => !item.ready).length;
  const docs = documentPrepStats(selectedRow(), dossierForRow(selectedRow()));
  const templates = state.outreachWorkspace.templates.filter((template) => template.status !== "Archived");
  const activeTemplates = templates.filter((template) => ["Ready", "Approved", "Sync to Podio"].includes(template.status)).length;
  return [
    {
      title: "Document Prep Completion",
      counter: `${docs.linked}/${docs.total || 0}`,
      actor: currentUserDisplayName(),
    },
    {
      title: "Outreach Readiness",
      counter: `${activeTemplates}/${templates.length}`,
      actor: currentUserDisplayName(),
    },
    {
      title: "Integration Blockers",
      counter: blockers,
      actor: currentUserDisplayName(),
    },
    {
      title: "Team Activity",
      counter: state.shellEvents.length,
      actor: currentUserDisplayName(),
    }
  ];
}

function adminAccessRowsHtml() {
  const entries = [
    ...[...new Set(state.adminAccessDomains)].map((value) => ({ value, type: "Business domain" })),
    ...[...new Set(state.adminAccessEmails)].map((value) => ({ value, type: "Exact email" })),
  ];
  return entries.map((entry) => `
    <li class="admin-access-row">
      <span><strong>${escapeHtml(entry.value)}</strong><span class="copy">${escapeHtml(entry.type)} access is active in the current sign-in allowlist.</span></span>
      <button class="plain-action" type="button" data-admin-remove-access="${escapeHtml(entry.value)}">Remove</button>
    </li>
  `).join("");
}

async function supportFilePayload(file) {
  if (!file) return null;
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf) throw new Error("Upload a PDF file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("PDF must be 10 MB or smaller.");
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const sha256 = [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return {
    name: file.name,
    type: file.type || "application/pdf",
    size: file.size,
    sha256,
    lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : "",
    base64: btoa(binary)
  };
}

async function submitAdminAccessForm(form) {
  const value = form.querySelector("[name='accessValue']")?.value?.trim();
  const action = form.querySelector("[name='accessAction']")?.value === "remove" ? "remove" : "add";
  if (!value) {
    state.adminAccessStatus = { state: "error", message: "Enter an email domain or company email first." };
    renderAdminLoopView();
    return;
  }
  state.adminAccessStatus = { state: "processing", message: `${action === "add" ? "Adding" : "Removing"} access...` };
  renderAdminLoopView();
  try {
    const normalized = value.replace(/^@+/, "").toLowerCase();
    const result = await postJson("/api/admin/access", { action, value, actor: currentActorEmail(), requestedAt: isoNow() });
    applyAdminAccessConfig(result);
    if (result.applied) {
      await loadSession();
      state.adminAccessStatus = { state: "success", message: result.message || "The local sign-in allowlist was updated." };
      addShellEvent("Leads engine access updated", `${normalized} was ${action === "add" ? "added to" : "removed from"} the local sign-in gate and passed config readback.`, "ready", false);
    } else {
      state.adminAccessStatus = { state: "success", message: result.message || "The access approval request was recorded; sign-in access has not changed." };
      addShellEvent("Access approval requested", `${normalized} remains unchanged until the approved environment allowlist is deployed.`, "review", false);
    }
    renderAdminLoopView();
    window.setTimeout(() => {
      state.adminAccessStatus = { state: "fading", message: state.adminAccessStatus.message };
      renderAdminLoopView();
      window.setTimeout(() => {
        state.adminAccessStatus = { state: "idle", message: "" };
        renderAdminLoopView();
      }, 340);
    }, 950);
  } catch (error) {
    state.adminAccessStatus = { state: "error", message: error.message || "Access request failed." };
    renderAdminLoopView();
  }
}

async function fileAdminLinearTicket(payload, statusCopy = "Filing Linear support ticket...") {
  state.adminTicketStatus = { state: "processing", message: statusCopy };
  renderAdminLoopView();
  try {
    const result = await postJson("/api/support/linear", payload);
    state.adminTicketStatus = { state: "success", message: result.issue?.identifier ? `Filed ${result.issue.identifier}` : "Support ticket queued for Linear." };
    addShellEvent("Linear support ticket filed", payload.title || "Admin support ticket", "ready", false);
    renderAdminLoopView();
  } catch (error) {
    state.adminTicketStatus = { state: "error", message: error.message || "Linear ticket failed." };
    renderAdminLoopView();
  }
}

async function submitAdminTicketForm(form) {
  const title = form.querySelector("[name='ticketTitle']")?.value?.trim() || "HeirRight support request";
  const message = form.querySelector("[name='ticketMessage']")?.value?.trim();
  const file = form.querySelector("[name='ticketPdf']")?.files?.[0] || null;
  if (!message && !file) {
    state.adminTicketStatus = { state: "error", message: "Add a note or attach a PDF before filing." };
    renderAdminLoopView();
    return;
  }
  state.adminTicketStatus = { state: "processing", message: "Preparing support ticket..." };
  renderAdminLoopView();
  try {
    const attachment = await supportFilePayload(file);
    await fileAdminLinearTicket({
      title,
      message: message || "Support ticket submitted with uploaded PDF.",
      severity: "medium",
      source: "HeirRight Admin",
      actor: currentActorEmail(),
      attachment,
      context: {
        selectedLead: selectedRow()?.leadName || selectedRow()?.title || "",
        selectedAddress: selectedRow()?.address || "",
        connectionBlockers: adminErrorItems().filter((item) => !item.ready).map((item) => ({ title: item.title, copy: item.copy }))
      }
    }, "Uploading support ticket...");
  } catch (error) {
    state.adminTicketStatus = { state: "error", message: error.message || "Support ticket failed." };
    renderAdminLoopView();
  }
}

function renderAdminLoopView() {
  const target = document.getElementById("adminView");
  if (!target) return;
  const errors = adminErrorItems();
  const activities = teamActivityRows();
  const recentEvents = (state.shellEvents.length ? state.shellEvents : defaultShellEvents()).map(clientFacingEvent).slice(0, 5);
  target.innerHTML = `
    <div class="admin-tall-grid">
      <section class="loop-panel is-tall">
        <div class="loop-panel-head"><div><p class="eyebrow">Team activity</p><h2 class="loop-title">Team Activity</h2></div><span class="pill ready">${state.shellEvents.length} events</span></div>
        <div class="team-activity-layout">
          <div class="admin-error-list">
            ${activities.map((item) => `
              <article class="team-kpi-row">
                <span><strong>${escapeHtml(item.title)}</strong><small class="team-activity-actor">${escapeHtml(item.actor || currentUserDisplayName())}</small></span>
                <span class="team-kpi-count">${escapeHtml(item.counter)}</span>
              </article>
            `).join("")}
            ${recentEvents.map((event) => `
              <article class="team-kpi-row">
                <span><strong>${escapeHtml(event.title)}</strong><small class="team-activity-actor">${escapeHtml(event.actor || currentUserDisplayName())}</small></span>
                <span class="tracker-date">${escapeHtml(eventTime(event.at))}</span>
              </article>
            `).join("") || `<p class="copy">No team activity has been recorded yet.</p>`}
          </div>
          <div class="admin-grid">
            <div class="admin-metric"><span>Commands</span><strong>${escapeHtml(state.shellCommandCount)}</strong></div>
            <div class="admin-metric"><span>Blockers</span><strong>${escapeHtml(errors.filter((item) => !item.ready).length)}</strong></div>
            <div class="admin-metric"><span>Events</span><strong>${escapeHtml(state.shellEvents.length)}</strong></div>
          </div>
          <form class="admin-ticket-form" data-admin-support-form>
            <label><span class="eyebrow">Support</span><input name="ticketTitle" type="text" placeholder="Short support title"></label>
            <textarea name="ticketMessage" rows="3" placeholder="What should the team review?"></textarea>
            <input name="ticketPdf" type="file" accept="application/pdf,.pdf">
            <div class="loop-panel-head">
              ${adminStatusHtml(state.adminTicketStatus)}
              <button class="btn quick" type="submit">File support ticket</button>
            </div>
          </form>
        </div>
      </section>
      <section class="loop-panel is-tall">
        <div class="loop-panel-head"><div><p class="eyebrow">Access</p><h2 class="loop-title">Members</h2></div></div>
        <div class="admin-access-layout">
          <div>
            <p class="copy">Review active business domains and exact email approvals. Production changes remain pending until the approved environment allowlist is deployed.</p>
            <ul class="admin-error-list" aria-label="Members">
              ${adminAccessRowsHtml()}
            </ul>
          </div>
          <form class="admin-access-form" data-admin-access-form>
            <div class="admin-inline-form">
              <input name="accessValue" type="text" placeholder="company.com or user@company.com" autocomplete="off">
              <select class="admin-role-combobox" name="accessAction" aria-label="Member role"><option value="add">Add role</option><option value="remove">Remove</option></select>
              <button class="btn primary solvys-liquid-glass" type="submit">Add</button>
            </div>
            ${adminStatusHtml(state.adminAccessStatus)}
          </form>
        </div>
      </section>
    </div>
  `;
  target.querySelector("[data-admin-support-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAdminTicketForm(event.currentTarget);
  });
  target.querySelector("[data-admin-access-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitAdminAccessForm(event.currentTarget);
  });
  target.querySelector("[name='accessAction']")?.addEventListener("change", (event) => {
    const button = target.querySelector("[data-admin-access-form] button[type='submit']");
    if (button) button.textContent = event.currentTarget.value === "remove" ? "Remove" : "Add";
  });
  target.querySelectorAll("[data-admin-remove-access]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.adminRemoveAccess;
      const form = target.querySelector("[data-admin-access-form]");
      if (!form || !value) return;
      form.querySelector("[name='accessValue']").value = value;
      form.querySelector("[name='accessAction']").value = "remove";
      submitAdminAccessForm(form);
    });
  });
  enhanceSelectMenus(target);
}

function integrationOnboardingCardHtml(kind) {
  const meta = {
    podio: {
      name: "Podio",
      title: "Podio",
      action: "Review Podio setup",
      steps: ["Add Podio access, Leads app, and verified field map", "Confirm CSV backup before the sample write", "Create one approved sample card and read it back"]
    },
    google: {
      name: "Google",
      title: "Google Workspace",
      action: "Connect Google",
      steps: ["Sign in with the approved Google account", "Choose the Drive folder for completed Discovery PDFs", "HeirRight uploads and reads back the immutable PDF"]
    },
    resend: {
      name: "Resend",
      title: "Resend Fallback",
      action: "Review Resend setup",
      steps: ["Add Resend access", "Approve internal test-recipient use only", "Keep Podio as the primary work queue"]
    },
    sms: {
      name: "SMS Gateway",
      title: "SMS Gateway",
      action: "Review SMS setup",
      steps: ["Choose Podio-native SMS or an approved carrier gateway", "Add carrier access and internal-test approval", "Keep messages queued until each template is approved"]
    },
    activepieces: {
      name: "Activepieces",
      title: "Outreach automation",
      action: "Review handoff",
      steps: ["Keep the automation builder backstage", "Validate the first-party outreach review package", "Fall back to app-owned Podio packages if automation is blocked"]
    },
    linear: {
      name: "Linear Support",
      title: "Linear Support",
      action: "Review Linear setup",
      steps: ["Add Linear API access and team routing", "File setup/support tickets from Admin", "Keep blocker tickets linked to integration status"]
    },
    web: {
      name: "Web Search",
      title: "Public Records",
      action: "Review source status",
      steps: ["Run Miami-Dade public-source fetch", "Capture source facts into Discovery", "Keep paid-source work approval-gated"]
    },
    tax: {
      name: "Tax Collector Source",
      title: "Tax Collector",
      action: "Review tax source",
      steps: ["Open the Tax Collector listing page or run the approved browser workflow", "Capture the bottom-right receipt link, payer, paid date, and unpaid years", "Keep tax fields review-blocked until receipt evidence or an approved unavailable note exists"]
    },
    clerk: {
      name: "Miami-Dade Clerk API",
      title: "Clerk Records",
      action: "Review Clerk access",
      steps: ["Add Commercial Data Services access before automatic Clerk pulls", "Fetch Official Records by folio and court dockets by case when access is ready", "Review deed, OR book/page, probate, civil, and family facts before Discovery completion"]
    },
    vital: {
      name: "Vital/Obituary Workflow",
      title: "Vital Sources",
      action: "Review vital workflow",
      steps: ["Run the approved obituary and vital-source browser workflow", "Capture obituary, marriage, death, memorial, and deceased-indicator evidence", "Keep DOB, DOD, spouse, and heir signals review-gated before Closing Prep"]
    },
    browserbase: {
      name: "Browserbase Usage",
      title: "Browserbase (Public Records)",
      action: "Review browser usage",
      steps: ["Single-estate source capture can run only after credentials, functions, and billing readiness are verified", "Paid batch runs require explicit batch approval", "Split large batches at the configured session cap before capture starts"]
    },
    idi: {
      name: "IDI Core",
      title: "IDI Core",
      action: "Open idiCORE",
      steps: ["Use the approved idiCORE account or the shared team-managed connection", "Keep approved run access behind the existing review gate", "Import or review contacts before Discovery can use them"]
    },
    leads: {
      name: "Leads Engine Access",
      title: "Leads Engine Access",
      action: "Review access routing",
      steps: ["Route company/domain access changes", "Keep admin add/remove approvals auditable", "Sync resolved companies into the admin surface"]
    }
  }[kind] ?? null;
  if (!meta) return "";
  const isGoogle = kind === "google";
  const isIdi = kind === "idi";
  const isUserScoped = kind === "podio" || isGoogle;
  const connection = connectionByName(meta.name);
  const workspace = isGoogle ? state.googleWorkspace : null;
  const workspaceConnected = Boolean(workspace?.connected);
  const connected = isGoogle
    ? Boolean(workspaceConnected && workspace?.destinationId)
    : Boolean(connection?.ok && connection?.mode === "live");
  const publicRecordsReady = kind === "web";
  const displayConnected = connected || publicRecordsReady;
  const browserbaseSetupRequired = kind === "browserbase" && !connection?.ok;
  const browserbaseBlocked = kind === "browserbase" && Boolean(connection?.ok) && connectionTone(connection) === "blocked";
  const sessionReady = Boolean(state.session?.auth?.configured);
  const actionLabel = displayConnected ? (publicRecordsReady ? "Ready" : "Connected") : meta.action;
  const statusLabel = isGoogle
    ? connected ? "Ready" : workspaceConnected ? "Choose folder" : "Setup required"
    : publicRecordsReady ? "Ready" : connected ? "Live" : browserbaseSetupRequired ? "Setup required" : browserbaseBlocked ? "Blocked" : connection?.mode ? displayStatus(connection.mode) : "Setup required";
  const statusTone = displayConnected ? "ready" : browserbaseBlocked ? "blocked" : "review";
  const steps = meta.steps.map((step, index) => index === 0 && displayConnected ? `${meta.title} ready` : step);
  const idiPortalUrl = connection?.portal?.searchUrl || "https://idicore.com/search/PropertySearch";
  const googleWorkspaceControl = isGoogle ? (() => {
    if (!sessionReady) return `<span class="copy">Google OAuth needs to be configured before the Drive connection can start.</span>`;
    if (!workspaceConnected) return `<a class="btn primary solvys-liquid-glass" href="/auth/login?integration=google-workspace">Connect Google Workspace</a>`;
    const folders = Array.isArray(state.googleWorkspaceFolders) ? state.googleWorkspaceFolders : [];
    const folderOptions = folders.map((folder) => `<option value="${escapeHtml(folder.id)}" data-folder-name="${escapeHtml(folder.name)}" ${folder.id === workspace.destinationId ? "selected" : ""}>${escapeHtml(folder.name)}</option>`).join("");
    return `
      <div class="field">
        <label>Discovery PDF folder</label>
        ${folders.length ? `<select data-google-workspace-destination aria-label="Choose Google Drive folder"><option value="">Choose Drive folder</option>${folderOptions}</select>` : `<span class="copy">${escapeHtml(workspace.destinationName ? `Current folder: ${workspace.destinationName}.` : "Load your available Drive folders, then choose one for verified Discovery PDFs.")}</span>`}
      </div>
      <button class="btn ${workspace.destinationId ? "quick" : "primary solvys-liquid-glass"}" type="button" data-google-workspace-load-folders ${state.googleWorkspaceLoading ? "disabled" : ""}>${state.googleWorkspaceLoading ? "Loading folders..." : folders.length ? "Refresh folders" : "Choose Drive folder"}</button>
    `;
  })() : "";
  const action = isIdi && connection?.configuredMode === "operator_portal"
    ? `<a class="btn primary solvys-liquid-glass" href="${escapeHtml(idiPortalUrl)}" target="_blank" rel="noreferrer">Open idiCORE</a>`
    : isGoogle
    ? googleWorkspaceControl
    : `<button class="btn ${displayConnected ? "" : "primary solvys-liquid-glass"}" type="button" data-integration-onboarding="${escapeHtml(kind)}" ${displayConnected ? "disabled" : ""}>${escapeHtml(actionLabel)}</button>`;
  return `
    <article class="integration-card" data-connected="${displayConnected ? "true" : "false"}">
      <div class="integration-card-head">
        <div>
          <h3>${escapeHtml(meta.title)}</h3>
        </div>
        <div class="integration-card-status"><span class="pill ${statusTone}">${escapeHtml(statusLabel)}</span><button class="integration-refresh" type="button" data-settings-refresh-integration="${escapeHtml(kind)}" aria-label="Refresh ${escapeHtml(meta.title)} status" title="Refresh status">↻</button></div>
      </div>
      <p class="copy">${escapeHtml(publicRecordsReady
        ? "Public record source checks are ready and reported per run."
        : isGoogle && workspaceConnected
        ? workspace.destinationName ? `Drive folder selected: ${workspace.destinationName}. An operator can explicitly send an approved Discovery PDF here from Completion.` : "Google Workspace is connected. Choose a Drive folder for optional approved-packet handoff."
        : operatorConnectionMessage(connection, meta.name))}</p>
      <p class="integration-scope">${isUserScoped ? "Per-user connection" : "Shared team connection"}</p>
      <ul class="integration-steps">
        ${steps.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join("")}
      </ul>
      <div class="integration-card-actions">${action}</div>
    </article>
  `;
}

function handleIntegrationOnboarding(kind) {
  const name = kind === "google"
    ? "Google"
    : kind === "resend"
      ? "Resend"
      : kind === "sms"
        ? "SMS Gateway"
        : kind === "activepieces"
          ? "Activepieces"
          : kind === "linear"
            ? "Linear Support"
            : kind === "web"
              ? "Web Search"
              : kind === "tax"
                ? "Tax Collector Source"
                : kind === "clerk"
                  ? "Miami-Dade Clerk API"
                  : kind === "vital"
                    ? "Vital/Obituary Workflow"
                    : kind === "browserbase"
                      ? "Browserbase Usage"
                      : kind === "idi"
                        ? "IDI Core"
                        : kind === "leads"
                          ? "Leads Engine Access"
                          : "Podio";
  const isGoogle = kind === "google";
  const connection = connectionByName(name);
  if (isGoogle && !state.session?.auth?.configured) {
    document.getElementById("topStatus").textContent = "Google OAuth is not configured yet. Add the approved client details before Workspace login opens.";
    addShellEvent("Google onboarding blocked", "Google OAuth configuration is still required before the Workspace login flow can start.", "blocked", false);
    return;
  }
  const message = operatorConnectionMessage(connection, name);
  document.getElementById("topStatus").textContent = message;
  addShellEvent(`${connectionDisplayName(name)} onboarding reviewed`, message, connectionTone(connection), false);
  renderSettingsView();
}

const settingsTabs = [
  { id: "access", label: "Access" },
  { id: "integrations", label: "Integrations" },
  { id: "support", label: "Support" },
  { id: "outreach", label: "Outreach" },
  { id: "preferences", label: "Preferences" },
  { id: "admin", label: "Admin" },
];

function normalizedSettingsTab(value = state.settingsTab) {
  return settingsTabs.some((tab) => tab.id === value) ? value : "access";
}

function settingsAllowedDomains() {
  const sessionDomains = state.session?.auth?.allowedDomains;
  const domains = Array.isArray(sessionDomains) && sessionDomains.length ? sessionDomains : state.adminAccessDomains;
  return Array.from(new Set(domains.map((domain) => String(domain || "").trim().toLowerCase()).filter(Boolean)));
}

function connectionReadyState(name) {
  const connection = connectionByName(name);
  if (connection?.ok && connection?.mode === "live") return "ready";
  return connectionTone(connection) === "blocked" ? "blocked" : "review";
}

function settingsSectionShell(title, eyebrow, badge, body) {
  return `
    <div class="settings-section">
      <div class="settings-section-head">
        <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h3>${escapeHtml(title)}</h3></div>
        ${badge ? `<span class="pill review">${escapeHtml(badge)}</span>` : ""}
      </div>
      ${body}
    </div>
  `;
}

function renderAccessSettingsPanel() {
  const domains = settingsAllowedDomains();
  const authConfigured = Boolean(state.session?.auth?.configured);
  const session = state.session || {};
  const user = session.user || {};
  const idi = connectionByName("IDI Core");
  const status = [
    { state: authConfigured ? "ready" : "blocked", copy: "Google-only login clears the blurred app gate." },
    { state: domains.length ? "ready" : "blocked", copy: `Allowed domains: ${domains.join(", ") || "not set"}.` },
    { state: state.session?.authenticated ? "ready" : "review", copy: user.email ? `Current user: ${user.name || user.email}.` : "No signed-in Google user on this browser." },
    { state: idi?.api?.sharedDefaultConfigured ? "ready" : "review", copy: "IDI Core uses the shared team-managed connection for approved runs." },
  ];
  return `
    ${settingsSectionShell("Team access", "Access", authConfigured ? "Google ready" : "Setup needed", `
      <div class="settings-control-grid">
        <article class="settings-control-card">
          <strong>Allowed business domains</strong>
          <span>Only users with these Google Workspace domains can clear the sign-in overlay.</span>
          <div class="settings-field-grid">
            <div class="settings-field"><label>Domains</label><code>${escapeHtml(domains.join(", ") || "Add business domains")}</code></div>
            <div class="settings-field"><label>Login method</label><code>Google only</code></div>
          </div>
          <ul class="settings-control-list">
            ${status.map((item) => `<li data-state="${escapeHtml(item.state)}">${escapeHtml(item.copy)}</li>`).join("")}
          </ul>
          <div class="settings-action-row">
            <a class="btn primary solvys-liquid-glass" href="/auth/login">Continue with Google</a>
            <button class="btn quick solvys-liquid-glass" type="button" data-settings-account-menu>Account menu</button>
          </div>
        </article>
        <article class="settings-control-card">
          <strong>IDI Core API access</strong>
          <span>The shared team key remains the only team-managed route shown here; any personal key stays outside Settings and is never entered on this surface.</span>
          <ul class="settings-control-list">
            <li data-state="${idi?.api?.sharedDefaultConfigured ? "ready" : "review"}">Shared team key: ${idi?.api?.sharedDefaultConfigured ? "available" : "not confirmed here"}.</li>
            <li data-state="${idi?.api?.endpointConfigured ? "ready" : "blocked"}">IDI Core connection: ${idi?.api?.endpointConfigured ? "configured" : "needed before live searches"}.</li>
            <li data-state="review">Paid runs remain controlled and duplicate-guarded before Discovery can use the result.</li>
          </ul>
        </article>
      </div>
    `)}
  `;
}

function renderIntegrationSettingsPanel() {
  const modelStatus = state.agenticModelStatus || {};
  const freeModels = Array.isArray(modelStatus.freeModels) ? modelStatus.freeModels : [];
  const options = ["dynamic-free-catalog", ...freeModels.filter((model) => model !== "dynamic-free-catalog")];
  const selectedModel = options.includes(state.agenticModelPreference) ? state.agenticModelPreference : "dynamic-free-catalog";
  const agenticCard = `
    <article class="settings-control-card settings-agentic-mini-card" data-agentic-model-card>
      <div class="settings-mini-card-head">
        <div><p class="eyebrow">Nous Portal</p><strong>Back Story formatter</strong></div>
        <span class="settings-mini-card-status" data-state="${modelStatus.available ? "ready" : "review"}">${escapeHtml(modelStatus.available ? "Automatic" : "Review only")}</span>
      </div>
      <span>HeirRight chooses the first verified zero-cost text model from the Nous catalog automatically. Doc Prep only receives the reviewed writing result.</span>
      <div class="settings-field-grid">
        <div class="settings-field"><label for="settingsAgenticModel">Free model</label><select id="settingsAgenticModel" data-agentic-model>${options.map((model) => `<option value="${escapeHtml(model)}" ${model === selectedModel ? "selected" : ""}>${escapeHtml(model === "dynamic-free-catalog" ? "Automatic free model" : model)}</option>`).join("")}</select></div>
        <div class="settings-field"><label>Route</label><code>${escapeHtml(modelStatus.available ? "Nous Portal automatic selection" : "Reviewed report formatting")}</code></div>
      </div>
      <ul class="settings-control-list">
        <li data-state="${modelStatus.available ? "ready" : "review"}">${escapeHtml(modelStatus.available ? `Automatic selection is ready${modelStatus.model ? `: ${modelStatus.model}` : ""}.` : "The catalog is not available in this environment; reviewed report formatting remains available.")}</li>
        <li data-state="review">Generated Back Story text remains review-required and cannot authorize export, outreach, or legal conclusions.</li>
      </ul>
    </article>
  `;
  return `
    ${settingsSectionShell("Integration status", "Workspace", "Reconnect / Review setup", `
      <p class="copy">Connector setup, approval, and readback status live here so Batch Queue and Outreach show only deal-work blockers.</p>
      <div class="settings-integrations-layout">
        <div class="integration-directory settings-integrations-list" aria-label="Workspace integrations">
          ${integrationOnboardingCardHtml("podio")}
          ${integrationOnboardingCardHtml("google")}
          ${integrationOnboardingCardHtml("idi")}
          ${integrationOnboardingCardHtml("tax")}
          ${integrationOnboardingCardHtml("clerk")}
          ${integrationOnboardingCardHtml("vital")}
          ${integrationOnboardingCardHtml("browserbase")}
          ${integrationOnboardingCardHtml("web")}
          ${integrationOnboardingCardHtml("resend")}
          ${integrationOnboardingCardHtml("sms")}
        </div>
        <aside class="settings-integrations-rail" aria-label="Integration readiness">
          ${agenticCard}
        </aside>
      </div>
    `)}
  `;
}

function renderSupportSettingsPanel() {
  const connection = connectionByName("Linear Support");
  const connected = Boolean(connection?.ok && connection?.mode === "live");
  const status = connected ? "Available" : connectionTone(connection) === "review" ? "Review needed" : "Not connected";
  return `
    ${settingsSectionShell("Ticket routing", "Support", "", `
      <div class="support-routing-row" data-state="${connected ? "ready" : "review"}">
        <div>
          <strong>Linear Support</strong>
          <span>Internal setup and support tickets use the team route. The route stays separate from the operator integration gallery.</span>
        </div>
        <span class="support-routing-status" data-state="${connected ? "ready" : "review"}">${escapeHtml(status)}</span>
      </div>
      <div class="settings-action-row">
        <button class="btn quick solvys-liquid-glass" type="button" data-settings-open-view="admin">Open Admin support</button>
      </div>
    `)}
  `;
}

function sourceControlCardHtml({ name, title, badge, copy, checks, statusLabel: requestedStatusLabel = "", statusTone: requestedStatusTone = "" }) {
  const connection = connectionByName(name);
  const tone = connectionTone(connection);
  const state = tone === "blocked" ? "blocked" : connection?.mode === "live" ? "ready" : "review";
  const statusLabel = requestedStatusLabel || (tone === "blocked" ? "Blocked" : displayStatus(connection?.mode || "blocked"));
  const statusTone = requestedStatusTone || (tone === "blocked" ? "blocked" : tone === "ready" ? "ready" : "review");
  return `
    <article class="source-control-card" data-state="${escapeHtml(state)}">
      <div class="settings-section-head">
        <div><p class="eyebrow">${escapeHtml(badge)}</p><strong>${escapeHtml(title)}</strong></div>
        <span class="pill ${escapeHtml(statusTone)}">${escapeHtml(statusLabel)}</span>
      </div>
      <span>${escapeHtml(copy || operatorConnectionMessage(connection, name))}</span>
      <ul class="source-control-list">
        ${checks.map((check) => `<li data-state="${escapeHtml(check.state || state)}">${escapeHtml(check.copy)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderSourceSettingsPanel() {
  const tax = connectionByName("Tax Collector Source");
  const clerk = connectionByName("Miami-Dade Clerk API");
  const vital = connectionByName("Vital/Obituary Workflow");
  const idi = connectionByName("IDI Core");
  const browserbase = connectionByName("Browserbase Usage");
  const browserbaseReady = connectionReadyState("Browserbase Usage") === "ready";
  const browserbaseConfigured = Boolean(browserbase?.ok);
  const browserbaseBillingCopy = operatorConnectionMessage(browserbase, "Browserbase Usage");
  const browserbaseFunctionState = (configured) => configured ? (browserbaseReady ? "ready" : "review") : "blocked";
  const browserbaseFunctionCopy = (configured, readyCopy, missingCopy) => {
    if (!configured) return missingCopy;
    return browserbaseReady ? readyCopy : browserbaseBillingCopy;
  };
  const browserWorkflowState = (connection, configured) => {
    if (!configured) return "blocked";
    return connection?.sourceAutomation?.browserbaseFunctionConfigured && !browserbaseReady ? "review" : "ready";
  };
  const browserWorkflowCopy = (connection, configured, readyCopy, missingCopy) => {
    if (!configured) return missingCopy;
    return connection?.sourceAutomation?.browserbaseFunctionConfigured && !browserbaseReady ? browserbaseBillingCopy : readyCopy;
  };
  return `
    ${settingsSectionShell("Source and enrichment controls", "Discovery", "Manual proof stays visible", `
      <div class="source-receipt-callout">
        <strong>Tax Collector Source receipt capture</strong>
        <span>For direct listing/template paths, the script must capture the receipt link on the bottom-right of the listing page, then preserve payer, paid date, unpaid years, and source evidence. For GovHub, Cloudflare, or public-search blockers, use the Browserbase/controlled Chrome workflow and keep the receipt fields review-blocked until the listing page is reached.</span>
      </div>
      <div class="source-control-grid">
        ${sourceControlCardHtml({
          name: "Tax Collector Source",
          title: "Tax Collector Source",
          badge: tax?.configuredMode === "script_listing" ? "Script listing" : "Browser workflow",
          copy: operatorConnectionMessage(tax, "Tax Collector Source"),
          checks: [
            { state: tax?.sourceAutomation?.scriptDirectListingConfigured ? "ready" : "review", copy: "Direct listing/template script path checked." },
            { state: browserWorkflowState(tax, tax?.sourceAutomation?.browserWorkflowConfigured), copy: browserWorkflowCopy(tax, tax?.sourceAutomation?.browserWorkflowConfigured, "Browser workflow handles GovHub/public-search blockers.", "GovHub/public-search browser workflow still needs to be configured.") },
            { state: "review", copy: "Bottom-right receipt link, payer, paid date, and unpaid years must be preserved before Discovery completion." },
          ]
        })}
        ${sourceControlCardHtml({
          name: "Miami-Dade Clerk API",
          title: "Miami-Dade Clerk API records",
          badge: clerk?.configuredMode === "commercial_api" ? "Commercial API" : "Access needed",
          copy: operatorConnectionMessage(clerk, "Miami-Dade Clerk API"),
          checks: [
            { state: clerk?.ok ? "ready" : "blocked", copy: "Commercial Data Services access is required before automated Official Records pulls." },
            { state: "review", copy: "Deed, OR book/page, probate, civil, and family records still require review before legal-template use." },
          ]
        })}
        ${sourceControlCardHtml({
          name: "Vital/Obituary Workflow",
          title: "Vital/Obituary Workflow",
          badge: vital?.configuredMode === "browser_workflow" ? "Browser workflow" : "Workflow needed",
          copy: operatorConnectionMessage(vital, "Vital/Obituary Workflow"),
          checks: [
            { state: browserWorkflowState(vital, vital?.sourceAutomation?.workflowConfigured), copy: browserWorkflowCopy(vital, vital?.sourceAutomation?.workflowConfigured, "Findagrave, Legacy, marriage, death, DOB/DOD, and deceased indicators have a saved workflow.", "Vital, obituary, marriage, and deceased-indicator browser workflow still needs to be configured.") },
            { state: "review", copy: "Returned family-tree facts stay review-gated before Closing Prep." },
          ]
        })}
        ${sourceControlCardHtml({
          name: "Browserbase Usage",
          title: "Browserbase source usage",
          badge: browserbaseReady ? (browserbase?.usagePolicy?.batchApprovalRequired ? "Batch approval" : "Batch review") : browserbaseConfigured ? "Billing blocked" : "Setup required",
          copy: browserbaseBillingCopy,
          statusLabel: browserbaseReady ? "Live" : browserbaseConfigured ? "Blocked" : "Setup required",
          statusTone: browserbaseReady ? "ready" : browserbaseConfigured ? "blocked" : "review",
          checks: [
            { state: browserbaseFunctionState(browserbase?.usagePolicy?.taxCollectorFunctionConfigured), copy: browserbaseFunctionCopy(browserbase?.usagePolicy?.taxCollectorFunctionConfigured, "Tax Collector browser function is ready for estate-fact receipt capture.", "Tax Collector browser function still needs to be configured.") },
            { state: browserbaseFunctionState(browserbase?.usagePolicy?.vitalObituaryFunctionConfigured), copy: browserbaseFunctionCopy(browserbase?.usagePolicy?.vitalObituaryFunctionConfigured, "Vital and obituary browser capture has a saved function.", "Vital and obituary browser function still needs to be configured.") },
            { state: browserbaseReady ? (browserbase?.usagePolicy?.batchApprovalRequired ? "review" : "ready") : "blocked", copy: browserbaseConfigured ? `${browserbaseReady ? "Paid batch capture cap" : "Configured batch cap after billing recovery"}: ${browserbase?.usagePolicy?.maxBatchSessions || 10} estates, ${browserbase?.usagePolicy?.maxConcurrency || 2} at a time.` : "Connect Browserbase before configuring a paid batch capture cap." },
          ]
        })}
        ${sourceControlCardHtml({
          name: "IDI Core",
          title: "IDI Core enrichment",
          badge: idi?.configuredMode === "api" ? "API" : "Portal/import",
          copy: operatorConnectionMessage(idi, "IDI Core"),
          checks: [
            { state: idi?.api?.sharedDefaultConfigured ? "ready" : "review", copy: "Team-managed IDI access remains the default for approved enrichment." },
            { state: idi?.api?.liveRunApproved ? "ready" : "review", copy: "Controlled paid-run approval is required before a live lookup spends." },
          ]
        })}
      </div>
      <div class="settings-action-row">
        <button class="btn primary solvys-liquid-glass" type="button" data-settings-open-view="dossiers">Open Doc Prep</button>
      </div>
    `)}
  `;
}

function renderOutreachSettingsPanel() {
  const podio = connectionByName("Podio");
  const activepieces = connectionByName("Activepieces");
  const resend = connectionByName("Resend");
  const sms = connectionByName("SMS Gateway");
  return `
    ${settingsSectionShell("Outreach production controls", "Safety gates", "No native builder", `
      <div class="outreach-control-grid">
        <article class="outreach-control-card">
          <strong>First-party operator workflow</strong>
          <span>Operators stage, review, approve, and sync packages from HeirRight. The automation builder stays backstage.</span>
          <ul class="outreach-control-list">
            <li data-state="ready">Draft and variable review happen in the Outreach tab.</li>
            <li data-state="review">Approval requires an approved owner and password.</li>
            <li data-state="${podio?.ok ? "ready" : "blocked"}">Podio handoff requires access plus readback proof before external work continues.</li>
            <li data-state="blocked">Direct send is locked from the app surface.</li>
          </ul>
          <div class="settings-action-row">
            <button class="btn primary solvys-liquid-glass" type="button" data-settings-open-view="drips">Open Outreach</button>
          </div>
        </article>
        <article class="outreach-control-card">
          <strong>Delivery readiness</strong>
          <span>SMS and email routes are visible as delivery readiness, not as a permission to send without review.</span>
          <ul class="outreach-control-list">
            <li data-state="${activepieces?.ok ? "ready" : "review"}">Backstage automation: ${displayStatus(activepieces?.mode || "review")}.</li>
            <li data-state="${resend?.ok ? "ready" : "review"}">Email fallback: ${displayStatus(resend?.mode || "review")}.</li>
            <li data-state="${sms?.ok ? "ready" : "review"}">SMS gateway: ${displayStatus(sms?.mode || "review")}.</li>
            <li data-state="review">All outbound work keeps compliance review and no-send guardrails.</li>
          </ul>
        </article>
      </div>
    `)}
  `;
}

function renderPreferencesSettingsPanel() {
  return `
    ${settingsSectionShell("Discovery and review preferences", "Preferences", "Office policy", `
      <div class="settings-grid">
        <div class="setting-card settings-theme-setting">
          <div><strong>Workspace theme</strong><span>Choose the appearance used on this device.</span></div>
          <div id="s38SettingsThemeMount" class="shell-theme-control-mount"></div>
        </div>
        <div class="setting-card"><label for="settingsSignalWeight"><strong>Source signal weight</strong><span>${escapeHtml(signalWeightLabel(state.shellSettings.signalWeight))}</span></label><input id="settingsSignalWeight" type="range" min="1" max="5" value="${escapeHtml(state.shellSettings.signalWeight)}"></div>
        <div class="setting-card"><label for="settingsTaxThreshold"><strong>Tax pressure threshold</strong><span>Unpaid years before priority review.</span></label><select id="settingsTaxThreshold"><option value="1">1+ unpaid year</option><option value="2">2+ unpaid years</option><option value="3">3+ unpaid years</option></select></div>
        <div class="setting-card"><label for="settingsReasonCodes"><strong>Reason-code set</strong><span>Office-facing qualification reasons.</span></label><select id="settingsReasonCodes"><option value="probate-title-tax">Probate + title + tax</option><option value="property-pressure">Property pressure only</option><option value="heirship-first">Heirship first</option></select></div>
        <div class="setting-card"><label class="toggle-line"><strong>Require deed proof</strong><input id="settingsDeedProofRequired" type="checkbox" ${state.shellSettings.deedProofRequired ? "checked" : ""}></label><span>OR book/page evidence stays required before promotion.</span></div>
        <div class="setting-card"><label class="toggle-line"><strong>Manual paid-source approval</strong><input id="settingsPaidSourceApproval" type="checkbox" ${state.shellSettings.paidSourceApproval ? "checked" : ""}></label><span>IDI, Intelius, Ancestry, ForeWarn, VitalChek, and PI work stay gated.</span></div>
      </div>
  `)}
  `;
}

function adminPasswordStatusHtml() {
  const status = state.adminPasswordStatus || {};
  if (!status.message) return "";
  return `<p class="settings-admin-status" data-state="${escapeHtml(status.state || "review")}" role="status">${escapeHtml(status.message)}</p>`;
}

function renderAdminSettingsPanel() {
  if (!state.adminSettingsUnlocked) {
    return `
      ${settingsSectionShell("Admin settings", "Admin", "Locked", `
        <p class="copy">Admin settings require the server-side admin password key. The initial setup credential is supplied out of band, is never displayed in this surface or logs, and must be rotated before normal use.</p>
        <form class="settings-admin-lock-form" data-admin-settings-unlock>
          <label><span>Admin password key</span><input name="adminPassword" type="password" autocomplete="current-password" required></label>
          <button class="btn primary solvys-liquid-glass" type="submit">Unlock Admin settings</button>
        </form>
        ${adminPasswordStatusHtml()}
      `)}
    `;
  }
  return `
    ${settingsSectionShell("Admin settings", "Admin", "Unlocked for this session", `
      <p class="copy">Rotate the server-side admin password key now. The new key is accepted only by the protected server endpoint and is never echoed into the UI, browser storage, or activity logs.</p>
      <form class="settings-admin-password-form" data-admin-settings-password>
        <label><span>Current password key</span><input name="currentPassword" type="password" autocomplete="current-password" required></label>
        <label><span>New password key</span><input name="newPassword" type="password" autocomplete="new-password" minlength="12" required></label>
        <label><span>Confirm new password key</span><input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required></label>
        <div class="settings-action-row"><button class="btn primary solvys-liquid-glass" type="submit">Change password key</button><button class="btn quick" type="button" data-settings-open-view="admin">Open Admin workspace</button><button class="btn quick" type="button" data-admin-settings-lock>Lock Admin settings</button></div>
      </form>
      ${adminPasswordStatusHtml()}
    `)}
  `;
}

function settingsTabPanelHtml(tab) {
  if (tab === "integrations") return renderIntegrationSettingsPanel();
  if (tab === "support") return renderSupportSettingsPanel();
  if (tab === "outreach") return renderOutreachSettingsPanel();
  if (tab === "preferences") return renderPreferencesSettingsPanel();
  if (tab === "admin") return renderAdminSettingsPanel();
  return renderAccessSettingsPanel();
}

function renderSettingsView() {
  const target = document.getElementById("settingsView");
  if (!target) return;
  const tab = normalizedSettingsTab();
  state.settingsTab = tab;
  if (tab === "integrations" && !state.agenticModelStatus?.loaded) void loadAgenticModelStatus({ rerender: true });
  target.innerHTML = `
    <div class="settings-center-shell">
      <div class="settings-main-layout">
        <aside class="settings-gutter" aria-label="Settings navigation">
          <p class="eyebrow">Settings</p>
          <label class="settings-select-label" for="settingsSectionSelect">Section</label>
          <select id="settingsSectionSelect" data-settings-tab-select aria-label="Settings section">
            ${settingsTabs.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === tab ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}
          </select>
        </aside>
        <section class="loop-panel full settings-unified-card">
        <div class="loop-panel-head">
          <div><p class="eyebrow">Settings</p><h2 class="loop-title">${escapeHtml(settingsTabs.find((item) => item.id === tab)?.label || "Access")}</h2></div>
        </div>
        <div id="settingsTabPanel" role="tabpanel">${settingsTabPanelHtml(tab)}</div>
        </section>
      </div>
    </div>
  `;
  const tax = target.querySelector("#settingsTaxThreshold");
  const reason = target.querySelector("#settingsReasonCodes");
  if (tax) tax.value = state.shellSettings.taxThreshold;
  if (reason) reason.value = state.shellSettings.reasonCodes;
  enhanceSelectMenus(target);
  target.querySelector("[data-settings-tab-select]")?.addEventListener("change", (event) => {
      state.settingsTab = normalizedSettingsTab(event.target.value);
      renderSettingsView();
  });
  target.querySelectorAll("[data-settings-open-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.settingsOpenView || "dashboard";
      setActiveShellView(view, activeViewLabel(view));
    });
  });
  target.querySelector("[data-admin-settings-unlock]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.querySelector("[name='adminPassword']")?.value || "";
    if (!password) return;
    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    try {
      const result = await postJson("/api/admin/settings/unlock", { password });
      if (result?.ok !== true || result?.authorized !== true) throw new Error(result?.message || "Admin settings remain locked.");
      state.adminSettingsUnlocked = true;
      state.adminPasswordStatus = { state: "ready", message: "Admin settings unlocked for this session. Rotate the setup key before continuing." };
    } catch (error) {
      state.adminPasswordStatus = { state: "blocked", message: error instanceof Error ? error.message : "Admin settings remain locked." };
    }
    renderSettingsView();
  });
  target.querySelector("[data-admin-settings-password]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = form.querySelector("[name='currentPassword']")?.value || "";
    const newPassword = form.querySelector("[name='newPassword']")?.value || "";
    const confirmPassword = form.querySelector("[name='confirmPassword']")?.value || "";
    if (newPassword !== confirmPassword) {
      state.adminPasswordStatus = { state: "blocked", message: "The new password keys do not match." };
      renderSettingsView();
      return;
    }
    const submit = form.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
    try {
      const result = await postJson("/api/admin/settings/password", { currentPassword, newPassword });
      if (result?.ok !== true || result?.rotated !== true) throw new Error(result?.message || "The password key was not rotated.");
      state.adminSettingsUnlocked = false;
      state.adminPasswordStatus = { state: "ready", message: "Admin password key rotated. Unlock again with the new server-side key." };
    } catch (error) {
      state.adminPasswordStatus = { state: "blocked", message: error instanceof Error ? error.message : "The password key was not rotated." };
    }
    renderSettingsView();
  });
  target.querySelector("[data-admin-settings-lock]")?.addEventListener("click", () => {
    state.adminSettingsUnlocked = false;
    state.adminPasswordStatus = { state: "review", message: "Admin settings locked for this session." };
    renderSettingsView();
  });
  target.querySelectorAll("[data-settings-refresh-connections]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Checking...";
      await loadConnectionStatuses();
      addShellEvent("Connection statuses refreshed", "Settings pulled the latest integration, source, and Outreach readiness checks.", "review", false);
      renderSettingsView();
    });
  });
  target.querySelectorAll("[data-settings-refresh-integration]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      const refreshed = await loadConnectionStatuses();
      addShellEvent(refreshed ? "Integration status refreshed" : "Integration status needs retry", refreshed ? "The latest saved integration status is visible." : "The last saved integration status is still shown. Try again when the connection is available.", refreshed ? "review" : "blocked", false);
      renderSettingsView();
    });
  });
  target.querySelector("[data-agentic-model]")?.addEventListener("change", (event) => {
    const value = String(event.target.value || "dynamic-free-catalog");
    const available = value === "dynamic-free-catalog" || state.agenticModelStatus?.freeModels?.includes(value);
    if (!available) return;
    state.agenticModelPreference = value;
    storageSetItem(agenticModelPreferenceKey, value, { sync: false });
    addShellEvent("Agentic model preference saved", value === "dynamic-free-catalog" ? "Nous Portal will choose the first verified free text model automatically." : "The selected verified free text model will be used for review-only Back Story drafting.", "review", false);
  });
  target.querySelectorAll("[data-settings-account-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      setAccountMenuOpen(true);
      document.getElementById("accountChip")?.focus();
    });
  });
  target.querySelectorAll("[data-integration-onboarding]").forEach((button) => {
    button.addEventListener("click", () => handleIntegrationOnboarding(button.dataset.integrationOnboarding));
  });
  target.querySelectorAll("[data-google-workspace-load-folders]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      await loadGoogleWorkspaceConnection({ folders: true, rerender: true });
      if (state.googleWorkspace?.error) {
        addShellEvent("Drive folders blocked", state.googleWorkspace.error, "blocked", true);
      }
    });
  });
  target.querySelectorAll("[data-google-workspace-destination]").forEach((select) => {
    select.addEventListener("change", async () => {
      const option = select.selectedOptions?.[0];
      const destinationId = String(select.value || "");
      const destinationName = String(option?.dataset?.folderName || option?.textContent || "").trim();
      if (!destinationId || !destinationName) return;
      select.disabled = true;
      try {
        const result = await postJson("/api/google-workspace/destinations", { destinationId, destinationName });
        if (!result?.ok || result.readbackStatus !== "verified") throw new Error(result?.message || "Drive destination did not pass readback verification.");
        state.googleWorkspace = result;
        addShellEvent("Drive folder selected", `${destinationName} can receive an approved Discovery PDF when an operator explicitly sends it from Completion.`, "ready", false);
      } catch (error) {
        addShellEvent("Drive folder blocked", error instanceof Error ? error.message : String(error), "blocked", true);
      }
      renderSettingsView();
    });
  });
  target.querySelector("#settingsSignalWeight")?.addEventListener("input", (event) => {
    state.shellSettings.signalWeight = event.target.value;
    persistShellSettings("Source signal weight updated");
    renderSettingsView();
  });
  target.querySelector("#settingsTaxThreshold")?.addEventListener("change", (event) => {
    state.shellSettings.taxThreshold = event.target.value;
    persistShellSettings("Tax pressure threshold updated");
  });
  target.querySelector("#settingsReasonCodes")?.addEventListener("change", (event) => {
    state.shellSettings.reasonCodes = event.target.value;
    persistShellSettings("Reason-code set updated");
  });
  target.querySelector("#settingsDeedProofRequired")?.addEventListener("change", (event) => {
    state.shellSettings.deedProofRequired = event.target.checked;
    persistShellSettings("Deed proof gate updated");
  });
  target.querySelector("#settingsPaidSourceApproval")?.addEventListener("change", (event) => {
    state.shellSettings.paidSourceApproval = event.target.checked;
    persistShellSettings("Paid-source approval gate updated");
  });
  document.dispatchEvent(new CustomEvent("heirright:settings-rendered", { detail: { tab } }));
}

function helpDemoCardsForTab(tabId = state.helpDemoTab) {
  return Object.entries(walkthroughDemos)
    .filter(([id, demo]) => id !== "product-tour" && demo.tab === tabId)
    .map(([id, demo]) => ({ id, ...demo }));
}

function renderHelpDemosView() {
  const target = document.getElementById("helpDemosView");
  if (!target) return;
  const tab = helpDemoTabs.some((item) => item.id === state.helpDemoTab) ? state.helpDemoTab : "docprep";
  state.helpDemoTab = tab;
  const cards = helpDemoCardsForTab(tab);
  const activeTab = helpDemoTabs.find((item) => item.id === tab) || helpDemoTabs[0];
  target.innerHTML = `
    <div class="help-demos-shell">
      <header class="help-demos-head">
        <div>
          <p class="eyebrow">Help &amp; Demos</p>
          <h2>One-minute workflow guides</h2>
          <p class="copy">Start a walkthrough, then follow the highlighted workspace changes and rail transitions.</p>
        </div>
        <div class="help-demo-tabs" role="tablist" aria-label="Help and demo categories">
          ${helpDemoTabs.map((item) => `
            <button type="button" role="tab" aria-pressed="${item.id === tab ? "true" : "false"}" data-help-demo-tab="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>
          `).join("")}
        </div>
      </header>
      <section class="help-demo-section" aria-label="${escapeHtml(activeTab.label)} walkthroughs">
        <div class="help-demo-section-head">
          <h3>${escapeHtml(activeTab.label)}</h3>
        </div>
        <div class="help-demo-grid">
          ${cards.map((card) => `
            <button class="help-demo-card" type="button" data-help-demo-card="${escapeHtml(card.id)}">
              <span class="help-demo-card-top">
                <span class="help-demo-card-icon">${nucleoIcon(card.icon || "open-book", 18)}</span>
                <span class="help-demo-duration">${escapeHtml(card.duration || "1 min")}</span>
              </span>
              <span>
                <h4>${escapeHtml(card.title)}</h4>
                <p>${escapeHtml(card.cardCopy || "")}</p>
              </span>
              <span class="help-demo-card-action">
                <span>Start walkthrough</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 18 6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </button>
          `).join("")}
        </div>
      </section>
    </div>
  `;
  target.querySelectorAll("[data-help-demo-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.helpDemoTab = button.dataset.helpDemoTab || "docprep";
      renderHelpDemosView();
    });
  });
  target.querySelectorAll("[data-help-demo-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const demoId = button.dataset.helpDemoCard || "product-tour";
      const demo = walkthroughDemos[demoId] || walkthroughDemos["product-tour"];
      addShellEvent("Walkthrough started", `${demo.title} opened from Help & Demos.`, "review", false);
      openWalkthrough(0, demoId);
    });
  });
}

function renderCurrentLoopView() {
  const replacement = renderView(state.activeView, {
    activeView: state.activeView,
    mount: document.querySelector(`[data-view-panel="${state.activeView}"]`),
  });
  const hasReplacement = typeof replacement === "string"
    ? replacement.trim().length > 0
    : replacement !== null && replacement !== undefined;
  if (hasReplacement) {
    const mount = document.querySelector(`[data-view-panel="${state.activeView}"]`);
    if (mount && typeof replacement === "string") mount.innerHTML = replacement;
    runLifecycle("afterRender", { activeView: state.activeView, mount });
    notifyLegacySubscribers();
    return;
  }
  if (state.activeView === "dashboard") renderDashboardView();
  if (state.activeView === "find-estates") renderResults();
  if (state.activeView === "dossiers") renderDossiersView();
  if (state.activeView === "drips") renderDripsView();
  if (state.activeView === "queue") renderQueueView();
  if (state.activeView === "admin") renderAdminLoopView();
  if (state.activeView === "settings") renderSettingsView();
  if (state.activeView === "help-demos") renderHelpDemosView();
  notifyLegacySubscribers();
}

function playShellViewTransition(view) {
  const content = document.querySelector(".content.t-page-slide");
  if (!content) return;
  window.clearTimeout(shellViewTransitionTimer);
  if (view !== "find-estates" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    content.dataset.viewTransition = "idle";
    return;
  }
  content.dataset.viewTransition = "idle";
  void content.offsetWidth;
  content.dataset.viewTransition = "find-estates";
  shellViewTransitionTimer = window.setTimeout(() => {
    if (content.dataset.viewTransition === "find-estates") {
      content.dataset.viewTransition = "idle";
    }
  }, 280);
}

const productTourSteps = [
  { view: "find-estates", title: "Upload the client file", copy: "Press Upload PDF or CSV. A verified free Nous model parses the source, while every missing fact stays blank and review-required.", target: "[data-estates-import-file], #estateFileUpload" },
  { view: "find-estates", title: "Find the estate", copy: "Use Filter estates to narrow the review list by owner, address, county, or status.", target: "[data-grid-quick-filter]" },
  { view: "find-estates", title: "Queue reviewed estates", copy: "Select the eligible rows, then press Queue for Doc Prep. The button stays unavailable until at least one estate is selected.", target: "[data-estates-add-queue]" },
  { view: "dossiers", title: "Choose the queued estate", copy: "Use Quick search, then choose the estate that will enter Document Prep.", target: "[data-s40-queue-search], [data-s40-stream-estate]" },
  { view: "dossiers", title: "Supply the IDI report", copy: "Press Upload IDI Report PDF when the report was not fetched automatically. Doc Prep cannot run without verified IDI evidence.", target: "[data-s40-idi-upload]" },
  { view: "dossiers", title: "Run Document Prep", copy: "Press Run Doc Prep after the IDI requirement clears. The progress island explains the current work and exposes Stop while the sequence is active.", target: "[data-s40-run], [data-run-docprep]" },
  { view: "queue", title: "Export the reviewed batch", copy: "Select completed packets, then press Export combined PDF. The Queue keeps incomplete work out of the export bundle.", target: "[data-queue-export]" },
  { view: "settings", settingsTab: "integrations", title: "Verify the free model", copy: "Open Integrations and confirm the free Nous model selector is available before relying on file parsing.", target: "[data-agentic-model]" }
];

const walkthroughDemos = {
  "product-tour": {
    title: "Product Tour",
    tab: "overview",
    icon: "open-book",
    duration: "55 sec",
    startView: "find-estates",
    kicker: "Guided walkthrough",
    cardCopy: "Follow the live controls from file upload through estate review, Doc Prep, export, and integration verification.",
    steps: productTourSteps
  },
  "docprep-discovery": {
    title: "Run Estate Discovery",
    tab: "docprep",
    icon: "magnifier-route",
    duration: "50 sec",
    startView: "dossiers",
    flowId: "discovery",
    kicker: "Discovery walkthrough",
    cardCopy: "Open an estate, satisfy the IDI gate, run Discovery, approve the PDF, then hand it off.",
    steps: [
      { view: "dossiers", title: "Choose the estate", copy: "Use Quick search, then press the queued estate that needs Discovery.", target: "[data-s40-queue-search], [data-s40-stream-estate]" },
      { view: "dossiers", title: "Add verified IDI evidence", copy: "If IDI was not fetched automatically, press Upload IDI Report PDF. This requirement must clear before the run button is available.", target: "[data-s40-idi-upload]" },
      { view: "dossiers", title: "Run Discovery", copy: "Press Run Doc Prep. The progress island describes the current step in plain language and exposes Stop while work is active.", target: "[data-s40-run], [data-run-docprep]" },
      { view: "dossiers", title: "Approve the packet", copy: "After the PDF preview is complete, press Approve packet for export to lock the reviewed revision.", target: "[data-s40-approve], [data-approve-packet]" },
      { view: "dossiers", title: "Send the approved PDF", copy: "Press Export only after approval and the Google Drive destination are ready.", target: "[data-s40-export], [data-export-handoff]" }
    ]
  },
  "estate-file-upload": {
    title: "Upload Estate Files",
    tab: "docprep",
    icon: "open-book",
    duration: "45 sec",
    startView: "find-estates",
    kicker: "File intake walkthrough",
    cardCopy: "Upload a client PDF or CSV, parse it with a verified free Nous model, then review the estates before queueing.",
    steps: [
      { view: "find-estates", title: "Open file upload", copy: "Press Upload PDF or CSV. Estate files stay review-required after parsing.", target: "[data-estates-import-file], #estateFileUpload" },
      { view: "find-estates", title: "Choose the client file", copy: "Drop or browse to a searchable PDF or CSV. The selected file is parsed only by a verified free Nous model.", target: "[data-estate-upload-dropzone], [data-estates-import-file]" },
      { view: "find-estates", title: "Add the parsed estates", copy: "After parsing succeeds, press Add estates. Missing fields remain visible for review instead of blocking the whole upload.", target: "[data-estate-file-submit], [data-estates-import-file]" },
      { view: "find-estates", title: "Review the new rows", copy: "Use Filter estates to find the uploaded records and review every incomplete field before queueing.", target: "[data-grid-quick-filter]" }
    ]
  },
  "estate-queue": {
    title: "Queue Estates for Doc Prep",
    tab: "docprep",
    icon: "batch-tray",
    duration: "35 sec",
    startView: "find-estates",
    kicker: "Estate queue walkthrough",
    cardCopy: "Select reviewable estates in Estates and move them into the shared Document Prep workbench.",
    steps: [
      { view: "find-estates", title: "Find reviewable estates", copy: "Use Filter estates to narrow the list before selecting rows.", target: "[data-grid-quick-filter]" },
      { view: "find-estates", title: "Select the estate rows", copy: "Check each estate that should enter Document Prep. Incomplete fields stay review-visible.", target: "[data-estates-grid] input[type='checkbox'], [data-grid-quick-filter]" },
      { view: "find-estates", title: "Queue for Doc Prep", copy: "Press Queue for Doc Prep. The button becomes available when at least one eligible estate is selected.", target: "[data-estates-add-queue]" },
      { view: "dossiers", title: "Confirm the handoff", copy: "Use Quick search in Document Prep to confirm the queued estate arrived.", target: "[data-s40-queue-search], [data-s40-stream-estate]" }
    ]
  },
  "batch-queue-export": {
    title: "Batch Queue Export",
    tab: "export",
    icon: "batch-tray",
    duration: "45 sec",
    startView: "dossiers",
    kicker: "Queue walkthrough",
    cardCopy: "Approve reviewed packets, stage their handoff, then build one combined PDF from Queue.",
    steps: [
      { view: "dossiers", title: "Approve the current packet", copy: "Press Approve packet for export after reviewing the exact PDF revision.", target: "[data-s40-approve], [data-approve-packet]" },
      { view: "dossiers", title: "Queue the approved handoff", copy: "Press Export after the packet and destination gates clear.", target: "[data-s40-export], [data-export-handoff]" },
      { view: "queue", title: "Select Queue items", copy: "Check each completed packet that belongs in the combined PDF.", target: "[data-queue-select], [data-queue-tab='export']" },
      { view: "queue", title: "Export the combined PDF", copy: "Press Export combined PDF. Incomplete packets stay outside the bundle.", target: "[data-queue-export]" }
    ]
  },
  "settings-readiness": {
    title: "Settings Readiness",
    tab: "admin",
    icon: "gear",
    duration: "45 sec",
    startView: "settings",
    kicker: "Settings walkthrough",
    cardCopy: "Open the exact integration controls for the Nous model, Google Drive destination, and public-record status.",
    steps: [
      { view: "settings", settingsTab: "integrations", title: "Choose the free Nous route", copy: "Use Free model to keep file parsing on a verified zero-cost text model.", target: "[data-agentic-model]" },
      { view: "settings", settingsTab: "integrations", title: "Check Google Workspace", copy: "Use the Google Workspace refresh control, then choose the shared Drive folder for approved Discovery PDFs.", target: "[data-settings-refresh-integration='google'], [data-google-workspace-load-folders]" },
      { view: "settings", settingsTab: "integrations", title: "Confirm public records", copy: "Public Records should show Ready. Use its refresh control if the saved status is stale.", target: "[data-settings-refresh-integration='web']" }
    ]
  }
};

const helpDemoTabs = [
  { id: "docprep", label: "Doc Prep" },
  { id: "export", label: "Queue & Export" },
  { id: "admin", label: "Settings & Access" }
];

function activeWalkthroughDemo() {
  return walkthroughDemos[state.walkthrough.demoId] || walkthroughDemos["product-tour"];
}

function activeWalkthroughSteps() {
  return activeWalkthroughDemo().steps || productTourSteps;
}

function clearWalkthroughTarget() {
  document.querySelectorAll('[data-walkthrough-target="true"]').forEach((target) => {
    target.removeAttribute("data-walkthrough-target");
  });
}

function walkthroughTargetFor(step) {
  if (step?.target) {
    const target = document.querySelector(step.target);
    if (target) return target;
  }
  return step?.view ? document.querySelector(`[data-shell-nav="${step.view}"]`) : null;
}

function syncWalkthroughTarget() {
  clearWalkthroughTarget();
  if (!state.walkthrough.open) return;
  const steps = activeWalkthroughSteps();
  const step = steps[state.walkthrough.index] || steps[0];
  const target = walkthroughTargetFor(step);
  if (!target) return;
  target.setAttribute("data-walkthrough-target", "true");
  if (!target.matches?.("[data-shell-nav]")) {
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
      inline: "nearest",
    });
  }
  requestAnimationFrame(positionWalkthrough);
}

function positionWalkthrough() {
  if (!state.walkthrough.open) return;
  const steps = activeWalkthroughSteps();
  const step = steps[state.walkthrough.index] || steps[0];
  const popover = document.querySelector(".walkthrough-popover");
  const anchor = walkthroughTargetFor(step);
  if (!popover || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const gap = 14;
  const edge = 14;
  const maxLeft = Math.max(edge, window.innerWidth - popoverRect.width - edge);
  const maxTop = Math.max(edge, window.innerHeight - popoverRect.height - edge);
  const fitsBelow = rect.bottom + gap + popoverRect.height <= window.innerHeight - edge;
  const fitsAbove = rect.top - gap - popoverRect.height >= edge;
  let left = rect.left + rect.width / 2 - popoverRect.width / 2;
  let top;
  let placement;
  if (fitsBelow) {
    top = rect.bottom + gap;
    placement = "bottom";
  } else if (fitsAbove) {
    top = rect.top - popoverRect.height - gap;
    placement = "top";
  } else {
    top = rect.top + rect.height / 2 - popoverRect.height / 2;
    left = rect.right + gap;
    if (left > maxLeft) left = rect.left - popoverRect.width - gap;
    placement = "side";
  }
  left = Math.max(edge, Math.min(maxLeft, left));
  top = Math.max(edge, Math.min(maxTop, top));
  popover.dataset.placement = placement;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function renderWalkthrough() {
  const mount = document.getElementById("walkthroughMount");
  if (!mount) return;
  if (!state.walkthrough.open) {
    clearWalkthroughTarget();
    mount.innerHTML = "";
    return;
  }
  const demo = activeWalkthroughDemo();
  const steps = activeWalkthroughSteps();
  const index = Math.max(0, Math.min(steps.length - 1, state.walkthrough.index));
  state.walkthrough.index = index;
  const step = steps[index];
  mount.innerHTML = `
    <section class="walkthrough-popover" role="dialog" aria-modal="false" aria-label="${escapeHtml(step.title)} walkthrough tip">
      <div class="walkthrough-step-row">
        <p class="eyebrow">${escapeHtml(demo.kicker || "Guided walkthrough")}</p>
        <span class="walkthrough-step-count">${index + 1} / ${steps.length}</span>
      </div>
      <h3>${escapeHtml(step.title)}</h3>
      <p>${escapeHtml(step.copy)}</p>
      <div class="walkthrough-actions">
        <button class="btn text-action" type="button" data-walkthrough-close>Skip</button>
        <button class="btn primary solvys-liquid-glass" type="button" data-walkthrough-next>${index === steps.length - 1 ? "Done" : "Next"}</button>
      </div>
    </section>
  `;
  mount.querySelector("[data-walkthrough-close]")?.addEventListener("click", () => closeWalkthrough(true));
  mount.querySelector("[data-walkthrough-next]")?.addEventListener("click", () => {
    if (state.walkthrough.index >= steps.length - 1) {
      closeWalkthrough(true);
      return;
    }
    state.walkthrough.index += 1;
    syncWalkthroughView();
    renderWalkthrough();
  });
  requestAnimationFrame(syncWalkthroughTarget);
}

function syncWalkthroughView() {
  if (!state.walkthrough.open) return;
  const steps = activeWalkthroughSteps();
  const index = Math.max(0, Math.min(steps.length - 1, state.walkthrough.index));
  const step = steps[index];
  if (step && state.activeView !== step.view) {
    setActiveShellView(step.view, activeViewLabel(step.view));
  }
  if (step?.view === "settings" && step.settingsTab && state.settingsTab !== step.settingsTab) {
    state.settingsTab = normalizedSettingsTab(step.settingsTab);
    renderCurrentLoopView();
  }
  requestAnimationFrame(syncWalkthroughTarget);
}

function prepareWalkthroughDemo(demoId = "product-tour") {
  const demo = walkthroughDemos[demoId] || walkthroughDemos["product-tour"];
  if (demo.startView) setActiveShellView(demo.startView, activeViewLabel(demo.startView));
  if (demo.flowId && selectedRow()) {
    state.docPrepListOpen = false;
    state.discoveryOpen = false;
    state.railMode = "dossier";
    state.railTab = "flow";
    setActiveDocPrepFlow(demo.flowId, { persist: true, rerender: false });
    renderCurrentLoopView();
    renderRail();
    setRailOpen(true);
  }
}

function openWalkthrough(index = 0, demoId = "product-tour", { prepare = true } = {}) {
  if (walkthroughAutoTimer) {
    window.clearTimeout(walkthroughAutoTimer);
    walkthroughAutoTimer = null;
  }
  state.walkthrough.demoId = walkthroughDemos[demoId] ? demoId : "product-tour";
  if (prepare) prepareWalkthroughDemo(state.walkthrough.demoId);
  const steps = activeWalkthroughSteps();
  state.walkthrough.open = true;
  state.walkthrough.index = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
  syncWalkthroughView();
  renderWalkthrough();
}

function closeWalkthrough(markSeen = false) {
  state.walkthrough.open = false;
  state.walkthrough.demoId = "product-tour";
  clearWalkthroughTarget();
  if (markSeen) storageSetItem(walkthroughStateKey, "true");
  renderWalkthrough();
}

function shellCommandCopy(command) {
  const normalized = String(command || "").trim().toLowerCase();
  if (/flag|block/.test(normalized)) return "record-blocker";
  if (/open-admin|admin/.test(normalized)) return "open-admin";
  if (/refresh-packet|refresh/.test(normalized)) return "refresh-packet";
  if (/export|podio|google/.test(normalized)) return "stage-export";
  if (/report|rail|document/.test(normalized)) return "open-report";
  if (/dry|run|build|test/.test(normalized)) return "dry-run";
  return "note";
}

function openReportRailForHandoff(source = null, tab = "docs") {
  if (state.activeView === "find-estates") {
    openRailWithContinuity(source, tab);
  }
}

function runShellCommand(command, source = null, freeform = "") {
  const action = shellCommandCopy(command);
  state.shellCommandCount += 1;
  if (action === "open-report") {
    addShellEvent("Report rail opened", "The current lead report is open for team review.", "ready", false);
    openUtilityRail("report", source);
  } else if (action === "record-blocker") {
    document.getElementById("statusExport").textContent = "export: [BLOCKED]";
    document.getElementById("topStatus").textContent = "Flag recorded: CRM review remains gated until access and readback proof.";
    addShellEvent("Flag recorded", freeform || "CRM access, export approval, and readback proof are still required.", "blocked");
  } else if (action === "stage-export") {
    state.railPreview = {
      title: "Doc Prep prepared for review",
      markdown: "The Doc Prep package is prepared in review-only mode. No live Podio card, Google Doc, Google Sheet row, email, or SMS was created.",
      updatedAt: Date.now()
    };
    document.getElementById("statusExport").textContent = "export: [PREPARED]";
    addShellEvent(exportSuccessActivityTitle(), exportSuccessActivityCopy("your integrated CRM"), "review", false);
    openReportRailForHandoff(source, "docs");
  } else if (action === "open-admin") {
    setActiveShellView("admin", "Admin");
    document.getElementById("topStatus").textContent = "Admin readiness is open for review.";
    addShellEvent("Admin review opened", "Review access, connections, support, and deployment readiness in one place.", "review", false);
  } else if (action === "refresh-packet") {
    document.getElementById("topStatus").textContent = "Refreshing the latest estate packet...";
    addShellEvent("Packet refresh started", "HeirRight is loading the newest estate and source state.", "review", false);
    loadRun();
  } else {
    addShellEvent("Command captured", freeform || "The command was captured as a review note for the current review session.", "review");
  }
  renderShellPanels();
}

function railWidthBounds() {
  const viewport = Math.max(360, window.innerWidth || 1440);
  // Keep the dossier reader a true right rail. Fintheon's shell uses a roughly
  // 380px rail, which leaves the working document readable on a 1280px screen.
  const preferredMin = state.railMode === "dossier" ? 380 : 360;
  const available = Math.max(320, viewport - 96);
  const modeRatio = state.railMode === "dossier" ? .72 : .64;
  const max = Math.max(320, Math.min(available, Math.floor(viewport * modeRatio)));
  return {
    min: Math.min(preferredMin, max),
    max
  };
}

function clampRailWidth(value) {
  const bounds = railWidthBounds();
  const numeric = Number.isFinite(Number(value)) ? Number(value) : bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(numeric)));
}

function clampFilterWidth(value) {
  const max = Math.min(420, Math.max(320, Math.floor(window.innerWidth * .38)));
  return Math.min(max, Math.max(292, Math.round(value)));
}

function applyFilterWidth() {
  state.filterWidth = clampFilterWidth(state.filterWidth);
  const content = document.querySelector(".content");
  if (content) {
    content.style.setProperty("--filters-width", state.filterCollapsed ? "0px" : `${state.filterWidth}px`);
    content.classList.toggle("is-filter-collapsed", state.filterCollapsed);
  }
  const handle = document.getElementById("filterResizer");
  if (handle) {
    handle.setAttribute("aria-valuemin", String(filterCollapseThreshold));
    handle.setAttribute("aria-valuemax", String(Math.min(420, Math.max(320, Math.floor(window.innerWidth * .38)))));
    handle.setAttribute("aria-valuenow", state.filterCollapsed ? "0" : String(state.filterWidth));
    handle.setAttribute("aria-valuetext", state.filterCollapsed ? "Filters closed" : `Filters ${state.filterWidth}px wide`);
  }
  syncFilterWidthToggle();
}

function syncFilterWidthToggle() {
  const toggle = document.getElementById("filterWidthToggle");
  if (!toggle) return;
  toggle.tabIndex = state.filterCollapsed ? 0 : -1;
  toggle.setAttribute("aria-expanded", state.filterCollapsed ? "false" : "true");
  toggle.setAttribute("aria-label", state.filterCollapsed ? "Open add estates rail" : "Close add estates rail");
  toggle.setAttribute("title", state.filterCollapsed ? "Open add estates rail" : "Close add estates rail");
}

function setFilterCollapsed(collapsed, persist = true) {
  state.filterCollapsed = Boolean(collapsed);
  if (!state.filterCollapsed && state.filterWidth <= filterCollapseThreshold) {
    state.filterWidth = 320;
  }
  if (persist) {
    storageSetItem(filterCollapsedKey, state.filterCollapsed ? "true" : "false");
    storageSetItem(filterWidthKey, String(state.filterWidth));
  }
  applyFilterWidth();
}

function syncSidebarState() {
  const workspace = document.getElementById("workspace");
  const toggle = document.getElementById("sidebarToggle");
  if (!workspace || !toggle) return;
  const autoCollapsed = window.matchMedia("(max-width: 1500px)").matches;
  workspace.classList.toggle("is-auto-collapsed", autoCollapsed);
  const collapsed = autoCollapsed || workspace.classList.contains("is-collapsed");
  toggle.setAttribute("aria-label", autoCollapsed ? "Sidebar auto-collapsed" : collapsed ? "Expand sidebar" : "Collapse sidebar");
  toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  toggle.setAttribute("title", autoCollapsed ? "Sidebar auto-collapsed" : collapsed ? "Expand sidebar" : "Collapse sidebar");
}

function setDetailRailOpen(open) {
  state.detailRailOpen = open;
  const app = document.querySelector(".app");
  app?.classList.toggle("detail-rail-collapsed", !open);
}

function setActiveShellView(view = "find-estates", label = "") {
  if (walkthroughAutoTimer && !state.walkthrough.open) {
    window.clearTimeout(walkthroughAutoTimer);
    walkthroughAutoTimer = null;
  }
  const app = document.querySelector(".app");
  const nextView = productViews.includes(view) ? view : "find-estates";
  if (nextView === "admin" && !state.adminSettingsUnlocked) {
    state.settingsTab = "admin";
    state.activeView = "settings";
    if (app) app.dataset.activeView = "settings";
    renderCurrentLoopView();
    return;
  }
  const detail = document.querySelector(".detail");
  const previousRailMode = state.railMode;
  state.activeView = nextView;
  if (app) app.dataset.activeView = nextView;
  if (detail) detail.setAttribute("aria-hidden", "true");
  if (nextView === "dossiers") {
    state.railMode = "dossier";
    if (previousRailMode !== "dossier") state.railTab = "flow";
    state.railOpen = false;
    setRailOpen(false);
    setDetailRailOpen(false);
    document.getElementById("topStatus").textContent = "Document Prep workspace selected. Supporting Documents and packet controls are ready.";
  } else if (nextView !== "find-estates") {
    state.railMode = "report";
    setRailOpen(false);
    setDetailRailOpen(false);
    document.getElementById("topStatus").textContent = `${label || activeViewLabel(nextView)} workspace selected.`;
  } else {
    state.railMode = "report";
    setRailOpen(false);
    setDetailRailOpen(false);
    document.getElementById("topStatus").textContent = "Find Estates workspace selected. Open a lead, then begin Discovery from the rail.";
  }
  renderCurrentLoopView();
  syncBatchExportControls();
  playShellViewTransition(nextView);
  positionWalkthrough();
}

function syncRailContext(row) {
  const context = document.getElementById("railContext");
  const copy = document.getElementById("railContextCopy");
  const title = document.getElementById("railContextTitle");
  const meta = document.getElementById("railContextMeta");
  const pill = document.getElementById("railContextPill");
  const input = document.getElementById("railRenameInput");
  if (!title || !meta || !pill) return;
  const kicker = document.querySelector(".rail-context-kicker");
  if (!row) {
    context?.classList.remove("is-renaming");
    if (copy) {
      copy.setAttribute("aria-disabled", "true");
      copy.setAttribute("aria-label", state.railMode === "dossier" ? "No dossier rail selected" : "No report rail selected");
    }
    title.textContent = "No lead selected";
    meta.textContent = "Choose a file to review";
    if (kicker) kicker.textContent = state.railMode === "dossier" ? "Dossier rail" : "Report rail";
    pill.className = "pill neutral";
    pill.textContent = "Waiting";
    return;
  }
  if (kicker) kicker.textContent = state.railMode === "dossier" ? "Dossier rail" : "Report rail";
  const railTitle = railNameFor(row);
  const selectedDoc = state.railMode === "dossier" ? selectedDossierDocument(row) : null;
  if (copy) {
    copy.removeAttribute("aria-disabled");
    copy.setAttribute("aria-label", state.railMode === "dossier"
      ? `Dossier rail for ${row.leadName ?? railTitle}; ${selectedDoc?.title ?? "document packet"}`
      : `Rename report rail: ${railTitle}`);
  }
  title.textContent = state.railMode === "dossier" ? (row.leadName ?? railTitle) : railTitle;
  title.title = state.railMode === "dossier" ? "Dossier document rail" : "Click to rename report rail";
  meta.textContent = state.railMode === "dossier" ? `${selectedDoc?.title ?? "Discovery Dossier"} · ${selectedDoc?.type ?? "PDF packet"} · ${selectedDoc?.status ?? "Review"}` : `${row.kind} · ${row.address}`;
  if (input && !state.railRenaming) input.value = railTitle;
  pill.className = `pill ${row.tone}`;
  pill.textContent = row.tone === "blocked" ? "Blocked" : row.tone === "ready" ? "Ready" : "Review";
}

function syncRailTabs() {
  document.querySelectorAll("[data-rail-tab]").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.railTab === state.railTab ? "true" : "false");
    button.removeAttribute("aria-hidden");
    button.tabIndex = 0;
    const label = state.railMode === "dossier" && button.dataset.railTab === "timeline" ? "Quality & Score" : button.dataset.railTab === "flow" ? "Flow" : button.dataset.railTab === "docs" ? "Docs" : "Timeline";
    const textNode = Array.from(button.childNodes).find((node) => node.nodeType === 3 && node.textContent.trim());
    if (textNode) textNode.textContent = ` ${label}`;
  });
}

function scrollDocPrepDeepLinkSection(section = "") {
  const target = section === "source-capture"
    ? document.querySelector(".asset-capture-grid")?.closest(".rail-card")
    : section === "source-search"
      ? document.querySelector("[data-run-source-search]")?.closest(".rail-card")
      : null;
  if (!target) return;
  target.scrollIntoView({ block: "start", behavior: "auto" });
}

function docPrepFlowForDeepLink(params = new URLSearchParams()) {
  const explicitFlow = params.get("flow") || params.get("docprepFlow");
  if (docPrepFlows[explicitFlow]) return explicitFlow;
  const section = params.get("section");
  if (["source-capture", "source-search"].includes(section)) return "discovery";
  return state.activeDocPrepFlow;
}

function setRailOpen(open, source = null) {
  state.railOpen = open;
  const rail = document.getElementById("researchRail");
  state.railWidth = clampRailWidth(state.railMode === "dossier" ? Math.max(state.railWidth, 380) : state.railWidth);
  const bounds = railWidthBounds();
  const width = `${state.railWidth}px`;
  const app = document.querySelector(".app");
  rail.dataset.mode = state.railMode;
  rail.setAttribute("aria-label", state.railMode === "dossier" ? "HeirRight Dossier Rail" : "HeirRight Report Rail");
  const resizer = document.getElementById("railResizer");
  const closeButton = document.getElementById("closeRail");
  const closeLabel = state.railMode === "dossier" ? "Close dossier rail" : "Close report rail";
  resizer?.setAttribute("aria-label", state.railMode === "dossier" ? "Resize dossier rail" : "Resize report rail");
  closeButton?.setAttribute("aria-label", closeLabel);
  closeButton?.setAttribute("title", closeLabel);
  resizer?.setAttribute("aria-valuemin", String(bounds.min));
  resizer?.setAttribute("aria-valuemax", String(bounds.max));
  resizer?.setAttribute("aria-valuenow", String(state.railWidth));
  resizer?.setAttribute("aria-valuetext", `${state.railMode === "dossier" ? "Dossier" : "Report"} rail ${state.railWidth}px wide`);
  app?.style.setProperty("--active-rail-width", open ? width : "0px");
  rail.dataset.open = open ? "true" : "false";
  rail.style.width = width;
  rail.style.marginRight = open ? "0" : `calc(-1 * ${width})`;
  rail.style.transform = open ? "translateX(0)" : "translateX(100%)";
  document.getElementById("statusRail").textContent = `rail: [${open ? "OPEN" : "CLOSED"}]`;
  if (open && window.matchMedia("(max-width: 820px)").matches) {
    requestAnimationFrame(() => {
      rail.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    });
  }
}

function setRailTab(tab) {
  state.railTab = tab;
  syncRailTabs();
  renderRail();
}

function openRailWithContinuity(source = null, tab = state.railTab) {
  state.railMode = "report";
  state.railTab = tab;
  setDetailRailOpen(false);
  syncRailTabs();
  renderRail();
  setRailOpen(true, source);
}

function openRailPreview(sectionId, source = null) {
  const row = selectedRow();
  if (!row) return;
  const dossier = dossierForRow(row);
  const section = row.missing.find((item) => item.id === sectionId) ?? buildMissingSections(dossier).find((item) => item.id === sectionId);
  if (!section) return;
  state.railPreview = {
    title: section.label,
    markdown: `${section.copy}\n\nNext: ${section.tasks[0]?.nextAction || "Review the source record and add the missing note to the report."}`,
    updatedAt: Date.now()
  };
  openRailWithContinuity(source, section.id === "podio" ? "docs" : "flow");
  updateFooterLeadContext(row);
}

function docPrepRerunNoteKey(flowId = state.activeDocPrepFlow) {
  return `manual-rerun:${docPrepFlow(flowId).id}`;
}

function openDocPrepRerunReview(flowId = state.activeDocPrepFlow, source = null) {
  const row = selectedRow();
  if (!row) return;
  const flow = docPrepFlow(flowId);
  state.discoveryOpen = false;
  state.docPrepManualFix = {
    rowKey: docPrepEstateKey(row),
    flowId: flow.id,
    openedAt: Date.now()
  };
  setActiveDocPrepFlow(flow.id, { persist: true, rerender: false });
  state.railMode = "dossier";
  state.railTab = "flow";
  renderRail();
  setRailOpen(true, source);
  document.getElementById("topStatus").textContent = `${flow.shortTitle} is complete. Add what needs to be fixed before running it again.`;
  addShellEvent(`${flow.shortTitle} rerun requested`, `${docPrepEstateLabel(row)} needs a manual review note before the completed Doc Prep is run again.`, "review", false);
}

function renderDocPrepRerunReview(row = selectedRow()) {
  const flow = docPrepFlow(state.docPrepManualFix?.flowId || state.activeDocPrepFlow);
  const note = docPrepNoteValue(docPrepRerunNoteKey(flow.id), row, flow.id);
  return `
    <section class="discovery-wizard" aria-label="${escapeHtml(flow.shortTitle)} rerun review">
      <div class="discovery-head">
        <div>
          <p class="eyebrow">${escapeHtml(flow.shortTitle)} review</p>
          <h2 class="rail-title">What needs to be fixed?</h2>
          <p class="copy">This file is already complete. Tell the team what changed or what looks wrong, and the estate file will be fixed by hand before another run.</p>
        </div>
        <span class="pill review">Manual review</span>
      </div>
      <section class="glass-card rail-card">
        <h3>Describe the fix</h3>
        <textarea class="discovery-notes" data-docprep-rerun-note="${escapeHtml(flow.id)}" placeholder="Example: update seller name, replace title note, correct address line, or regenerate the closing packet after source review.">${escapeHtml(note)}</textarea>
      </section>
      <section class="glass-card rail-card">
        <h3>What happens next</h3>
        <div>
          <article class="rail-item">
            <span class="rail-item-index">01</span>
            <span><span class="rail-item-title">Manual fix</span><span class="rail-item-copy">The team reviews the note and updates the estate file by hand.</span></span>
          </article>
          <article class="rail-item">
            <span class="rail-item-index">02</span>
            <span><span class="rail-item-title">Run corrected packet</span><span class="rail-item-copy">After the correction note is saved, run the completed package again and watch the Preview rebuild each section.</span></span>
          </article>
        </div>
      </section>
      <div class="discovery-actions">
        <button class="btn" type="button" data-docprep-rerun-close>Close</button>
        <div>
          <button class="btn primary solvys-liquid-glass" type="button" data-docprep-rerun-save="${escapeHtml(flow.id)}">Save review note</button>
          <button class="btn primary solvys-liquid-glass" type="button" data-docprep-rerun-run="${escapeHtml(flow.id)}">Run corrected packet</button>
        </div>
      </div>
    </section>
  `;
}

function wireDocPrepRerunReview(content) {
  content.querySelector("[data-docprep-rerun-note]")?.addEventListener("input", (event) => {
    const flowId = event.target.dataset.docprepRerunNote || state.activeDocPrepFlow;
    setDocPrepNote(docPrepRerunNoteKey(flowId), event.target.value, selectedRow(), flowId);
  });
  content.querySelector("[data-docprep-rerun-save]")?.addEventListener("click", (event) => {
    const row = selectedRow();
    const flowId = event.currentTarget.dataset.docprepRerunSave || state.activeDocPrepFlow;
    const flow = docPrepFlow(flowId);
    const note = docPrepNoteValue(docPrepRerunNoteKey(flow.id), row, flow.id).trim();
    document.getElementById("topStatus").textContent = note
      ? `${flow.shortTitle} manual fix note saved.`
      : `${flow.shortTitle} manual fix opened. Add a note before rerunning.`;
    addShellEvent(`${flow.shortTitle} manual fix saved`, note || "Manual fix review opened for the completed Doc Prep package.", "review", false);
    renderRail();
  });
  content.querySelector("[data-docprep-rerun-run]")?.addEventListener("click", (event) => {
    const row = selectedRow();
    const flowId = event.currentTarget.dataset.docprepRerunRun || state.activeDocPrepFlow;
    const flow = docPrepFlow(flowId);
    const note = docPrepNoteValue(docPrepRerunNoteKey(flow.id), row, flow.id).trim();
    if (!note) {
      document.getElementById("topStatus").textContent = `${flow.shortTitle} needs a correction note before it runs again.`;
      addShellEvent(`${flow.shortTitle} rerun blocked`, "Add a short correction note before rerunning the completed packet.", "blocked", true);
      return;
    }
    state.docPrepManualFix = null;
    addShellEvent(`${flow.shortTitle} rerun started`, `${docPrepEstateLabel(row)} is rebuilding the completed package from the reviewed correction note.`, "review", false);
    runFullDiscovery(row, event.currentTarget, flow.id, { correctionNote: note });
  });
  content.querySelector("[data-docprep-rerun-close]")?.addEventListener("click", () => {
    state.docPrepManualFix = null;
    renderRail();
    setRailOpen(false);
  });
}

function discoveryStripHtml(row, dossier) {
  const flow = docPrepFlow();
  const pct = discoveryProgress(flow.id, row);
  const phase = currentDiscoveryPhase(flow.id, row);
  return `
      <div class="discovery-strip" aria-label="${escapeHtml(flow.label)} completion">
        <div class="discovery-fuse" style="--fuse-progress: ${pct}%" aria-label="${escapeHtml(flow.label)} ${pct}% complete"></div>
        <div class="discovery-phase-meter"><strong>${pct}%</strong><span>${escapeHtml(phase.label)}</span></div>
      ${docPrepRunControlsHtml(row, flow.id)}
      </div>
  `;
}

function beginDiscoveryWizard(source = null) {
  const row = selectedRow();
  if (!row) return;
  const flow = docPrepFlow();
  ensureDocPrepStarted(row, flow.id, { persist: false });
  setDocPrepPhaseIndex(row, flow.id, docPrepCurrentIndex(row, flow.id), { persist: false });
  state.discoveryOpen = true;
  state.railTab = "flow";
  if (state.activeView === "dossiers" || state.railMode === "dossier") {
    state.railMode = "dossier";
    renderRail();
    setRailOpen(true, source);
  } else {
    openRailWithContinuity(source, "flow");
  }
  persistDiscoveryState();
  addShellEvent(`${flow.label} started`, `The guided ${flow.label.toLowerCase()} workflow opened for the selected estate.`, "ready", false);
}

function closeDiscoveryWizard() {
  const flow = docPrepFlow();
  const row = selectedRow();
  state.discoveryOpen = false;
  state.railPreview = {
    title: `${flow.label} paused`,
    markdown: `${currentDiscoveryPhase(flow.id, row).label} is saved in this browser and syncing to the shared team workspace. Continue from the fuse when ready.`,
    updatedAt: Date.now()
  };
  persistDiscoveryState();
  renderRail();
}

function completeDiscoveryPhase() {
  const flow = docPrepFlow();
  const row = selectedRow();
  const phase = currentDiscoveryPhase(flow.id, row);
  const blocker = docPrepPhaseBlocker(row, flow.id, phase);
  if (blocker) {
    document.getElementById("topStatus").textContent = blocker;
    addShellEvent(`${phase.label} needs review`, blocker, "blocked", true);
    renderRail();
    renderCurrentLoopView();
    return;
  }
  markDocPrepPhaseComplete(row, flow.id, phase.id);
  addShellEvent(`${phase.label} complete`, `${phase.summary} The team can close ${flow.label} or continue to the next phase.`, "ready", false);
  renderRail();
  renderCurrentLoopView();
}

function advanceDiscoveryPhase(direction = 1) {
  const flow = docPrepFlow();
  const row = selectedRow();
  const phases = docPrepPhases(flow.id);
  const current = docPrepCurrentIndex(row, flow.id);
  const next = Math.max(0, Math.min(phases.length - 1, current + direction));
  setDocPrepPhaseIndex(row, flow.id, next);
  renderRail();
}

function renderDiscoveryWizard(row, dossier) {
  const flow = docPrepFlow();
  const phases = docPrepPhases(flow.id);
  const phase = currentDiscoveryPhase(flow.id, row);
  const currentIndex = docPrepCurrentIndex(row, flow.id);
  const phaseComplete = phaseIsComplete(phase.id, row, flow.id);
  const pct = discoveryProgress(flow.id, row);
  const missing = row.missing.length ? row.missing : buildMissingSections(dossier);
  return `
    <section class="discovery-wizard" aria-label="${escapeHtml(flow.label)} workflow">
      <div class="discovery-head">
        <div>
          <p class="eyebrow">${escapeHtml(flow.title)}</p>
          <h2 class="rail-title">${escapeHtml(phase.name)}</h2>
          <p class="copy">${escapeHtml(phase.summary)}</p>
        </div>
        <span class="pill ${phaseComplete ? "ready" : "review"}">${phaseComplete ? "Phase complete" : `${pct}% complete`}</span>
      </div>
      <div class="phase-ruler" style="--phase-count: ${phases.length}" aria-hidden="true">
        ${phases.map((item, index) => `<span class="${phaseIsComplete(item.id, row, flow.id) ? "is-complete" : index === currentIndex ? "is-active" : ""}"></span>`).join("")}
      </div>
      <div class="discovery-body">
        <section class="glass-card rail-card">
          <h3>What this phase creates</h3>
          <ul class="mini-list">
            <li><strong>Source</strong><span>${escapeHtml(phase.source)}</span></li>
            <li><strong>Dossier output</strong><span>${escapeHtml(phase.label)} notes, review decision, and next action.</span></li>
            <li><strong>Current lead</strong><span>${escapeHtml(row.leadName)} - ${escapeHtml(row.address)}</span></li>
          </ul>
        </section>
        <section class="glass-card rail-card">
          <h3>Steps</h3>
          <div>
            ${phase.steps.map((step, index) => `
              <article class="rail-item">
                <span class="rail-item-index">${String(index + 1).padStart(2, "0")}</span>
                <span><span class="rail-item-title">${escapeHtml(step)}</span><span class="rail-item-copy">${escapeHtml(missing[index]?.copy ?? "Record the source note or blocker before moving forward.")}</span></span>
                ${statusPill(phaseComplete ? "ready" : "review", phaseComplete ? "Done" : "Check")}
              </article>
            `).join("")}
          </div>
        </section>
        <section class="glass-card rail-card">
          <h3>Preferences</h3>
          <div class="preference-grid">
            ${phase.preferences.map((preference, index) => `
              <div class="preference-card">
                <label>${escapeHtml(preference)}<input type="checkbox" data-discovery-preference="${escapeHtml(discoveryPreferenceKey(phase.id, index))}" ${discoveryPreferenceChecked(phase.id, index, row, flow.id) ? "checked" : ""}></label>
                <span class="copy">${index === 0 ? "Default for this workflow." : index === 1 ? "Recommended for the current lead." : "Optional review preference."}</span>
              </div>
            `).join("")}
          </div>
        </section>
        <section class="glass-card rail-card">
          <h3>Review notes</h3>
          <textarea class="discovery-notes" data-discovery-notes="${escapeHtml(phase.id)}" placeholder="Add source notes, blockers, or export context for this phase.">${escapeHtml(docPrepNoteValue(phase.id, row, flow.id))}</textarea>
        </section>
      </div>
      <div class="discovery-actions">
        <button class="btn" type="button" data-discovery-prev ${currentIndex === 0 ? "disabled" : ""}>Previous</button>
        <div>
          ${phaseComplete ? `<button class="btn" type="button" data-close-discovery>Close ${escapeHtml(flow.shortTitle)}</button>` : ""}
          <button class="btn primary solvys-liquid-glass" type="button" data-complete-phase>${phaseComplete ? "Save Again" : "Complete Phase"}</button>
          <button class="btn" type="button" data-discovery-next ${currentIndex === phases.length - 1 ? "disabled" : ""}>Next Phase</button>
        </div>
      </div>
    </section>
  `;
}

function wireDiscoveryWizard(content) {
  content.querySelector("[data-complete-phase]")?.addEventListener("click", completeDiscoveryPhase);
  content.querySelector("[data-close-discovery]")?.addEventListener("click", closeDiscoveryWizard);
  content.querySelector("[data-discovery-prev]")?.addEventListener("click", () => advanceDiscoveryPhase(-1));
  content.querySelector("[data-discovery-next]")?.addEventListener("click", () => advanceDiscoveryPhase(1));
  content.querySelector("[data-discovery-notes]")?.addEventListener("input", (event) => {
    setDocPrepNote(event.target.dataset.discoveryNotes, event.target.value, selectedRow(), state.activeDocPrepFlow);
  });
  content.querySelectorAll("[data-discovery-preference]").forEach((input) => {
    input.addEventListener("change", (event) => {
      setDocPrepPreference(event.target.dataset.discoveryPreference, event.target.checked, selectedRow(), state.activeDocPrepFlow);
      addShellEvent("Discovery preference saved", "The phase preference was saved for this review session.", "review", false);
    });
  });
}

function fillSection(sectionId) {
  state.filled.add(sectionId);
  persistFilled();
  if (state.data && state.dossier) {
    state.rows = buildRows(state.data, state.dossier);
    if (!state.rows.some((row) => row.id === state.selectedId)) state.selectedId = state.rows[0]?.id ?? null;
  }
  state.railPreview = {
    title: "Section marked ready",
    markdown: "This fills the missing section in the current review view. A production version would save the source note back to the lead record.",
    updatedAt: Date.now()
  };
  renderAll();
}

function statusPill(tone, label) {
  return `<span class="pill ${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

function conciseNextStep(value) {
  const text = cleanDisplayValue(value || "Review").trim();
  return text
    .replace(/^Add tax history$/i, "Tax history")
    .replace(/^Check probate status$/i, "Probate")
    .replace(/^Add phone numbers$/i, "Phone numbers")
    .replace(/^Prepare CRM handoff$/i, "CRM review")
    .replace(/^Connect skip trace$/i, "Import IDI")
    .replace(/^Run skip trace$/i, "Import IDI");
}

function evidenceClassification(evidence) {
  const value = Number(evidence) || 0;
  if (value >= 8) return "Enriched";
  if (value >= 5) return "Fully Scouted";
  return "Basic Scouting";
}

function dossierReviewFlags(dossier = {}) {
  const directFlags = dossier.audit?.reviewFlags ?? [];
  const factFlags = (dossier.audit?.facts ?? []).flatMap((fact) => fact.reviewFlags ?? []);
  return [...new Set([...directFlags, ...factFlags])];
}

function dossierHasVerifiedContactData(dossier = {}) {
  return (dossier.audit?.facts ?? []).some((fact) => {
    if (fact.factType !== "enriched_contact_profile" || !fact.value || typeof fact.value !== "object") return false;
    const profile = fact.value;
    const phones = Array.isArray(profile.phones) ? profile.phones.filter(Boolean) : [];
    const emails = Array.isArray(profile.emails) ? profile.emails.filter(Boolean) : [];
    const addressHistory = Array.isArray(profile.addressHistory) ? profile.addressHistory.filter(Boolean) : [];
    return Boolean(profile.likelyCurrentAddress) || phones.length > 0 || emails.length > 0 || addressHistory.length > 0;
  });
}

function contactEnrichmentGate(dossier = {}) {
  if (dossierHasVerifiedContactData(dossier)) {
    return { classification: "Contact verified", status: null, next: null };
  }
  const flags = dossierReviewFlags(dossier);
  if (flags.includes("MISSING_SKIPTRACE_CONFIG") || flags.includes("MISSING_IDI_ASSET_SEARCH")) {
    return {
      classification: "IDI needed",
      status: "blocked",
      next: "Import IDI"
    };
  }
  if (flags.includes("NO_ENRICHMENT_RUN") || flags.includes("CONTACT_REVIEW_REQUIRED") || flags.includes("IDI_ASSET_SEARCH_REVIEW_REQUIRED") || flags.includes("CONTACT_ACCEPTANCE_REQUIRED")) {
    return {
      classification: "Needs contacts",
      status: "review",
      next: "Review contacts"
    };
  }
  return null;
}

function idiReportAvailableForRow(row = selectedRow()) {
  if (!row || row.kind === "File") return false;
  const dossier = dossierForRow(row) ?? {};
  const flags = dossierReviewFlags(dossier);
  if (idiImportForRow(row)) return true;
  if (acceptedContactCandidates(row).length) return true;
  if (dossierHasVerifiedContactData(dossier)) return true;
  if (flags.includes("IDI_ASSET_SEARCH_REVIEW_REQUIRED") || flags.includes("CONTACT_REVIEW_REQUIRED") || flags.includes("CONTACT_ACCEPTANCE_REQUIRED")) return true;
  const nextText = `${row.next || ""} ${rowNextAction(row)} ${row.classification || ""}`;
  return /\b(import idi|idi needed|idi asset search|review contacts|contact verified)\b/i.test(nextText);
}

function idiReportsAvailableCount(rows = state.rows) {
  return rows.filter((row) => idiReportAvailableForRow(row)).length;
}

function rowClassification(row) {
  return row.classification || evidenceClassification(row.evidence);
}

function addressDisplayParts(address, fallback = "") {
  const text = cleanDisplayValue(address).trim();
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      street: parts[0],
      locality: parts.slice(1).join(", ")
    };
  }
  return {
    street: text || "Address pending",
    locality: formatCountyName(fallback, "")
  };
}

function renderSummary() {
  const reportsAvailable = idiReportsAvailableCount();
  const lowestScore = lowestEstateScore();
  const highestScore = highestEstateScore();
  const averageScore = averageEstateScore();
  const metrics = [
    { label: "Estate files", value: state.rows.length || 0 },
    { label: "Lowest Score", value: lowestScore },
    { label: "Highest Score", value: highestScore },
    { label: "Average Score", value: averageScore },
    { label: "Reports Available", value: reportsAvailable }
  ];
  const target = document.getElementById("summaryMetrics");
  if (!target) return;
  const open = Boolean(state.summaryMetricsOpen);
  target.dataset.open = open ? "true" : "false";
  target.innerHTML = `
    <button class="summary-metrics-toggle" type="button" aria-expanded="${open ? "true" : "false"}" aria-controls="summaryMetricsList" data-summary-metrics-toggle>
      <span>
        <strong>Estate KPIs</strong>
        <span>${escapeHtml(metrics[0].value)} files · low ${escapeHtml(metrics[1].value)} · high ${escapeHtml(metrics[2].value)}</span>
      </span>
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div id="summaryMetricsList" class="summary-metrics-list">
      ${metrics.map((item) => `
        <section class="metric">
          <span class="metric-label">${escapeHtml(item.label)}</span>
          <strong class="metric-value">${escapeHtml(item.value)}</strong>
        </section>
      `).join("")}
    </div>
  `;
  target.querySelector("[data-summary-metrics-toggle]")?.addEventListener("click", () => {
    state.summaryMetricsOpen = !state.summaryMetricsOpen;
    renderSummary();
  });
}

function rowMatchesFilters(row) {
  const query = document.getElementById("globalSearch").value.trim().toLowerCase();
  const county = document.getElementById("countyFilter").value;
  const leadType = document.getElementById("leadTypeFilter").value;
  const status = document.getElementById("statusFilter").value;
  const evidence = Number(document.getElementById("evidenceFilter").value);
  const missing = document.getElementById("missingFilter").value;
  const priorityOnly = document.getElementById("priorityOnly").checked;
  if (state.historyProspectIds && !state.historyProspectIds.has(row.id)) return false;
  if (query && !row.search.toLowerCase().includes(query)) return false;
  if (county !== "all" && !String(row.county).toLowerCase().includes(county)) return false;
  if (leadType !== "all" && row.leadType !== leadType && !row.search.toLowerCase().includes(leadType)) return false;
  if (status !== "all" && row.status !== status && row.tone !== status) return false;
  if (row.evidence < evidence) return false;
  if (missing !== "all" && !row.missing.some((item) => item.type === missing)) return false;
  if (priorityOnly && row.score < 75) return false;
  return true;
}

function rowSortValue(row, key) {
  if (!row) return "";
  if (key === "score") return Number(rowDisplayScore(row) || row.score || 0);
  if (key === "address") {
    const parts = addressDisplayParts(row.address, row.county);
    return `${parts.locality} ${parts.street}`.toLowerCase();
  }
  if (key === "lead") return String(row.leadName || row.title || "").toLowerCase();
  if (key === "evidence") return parseEvidenceDate(rowEstateDateValue(row));
  if (key === "next") return "add to queue";
  return String(row[key] ?? "").toLowerCase();
}

function sortedRowsForScope(rows = [], scope = "results") {
  const sort = state.sortState?.[scope] || {};
  if (!sort.key || !sort.direction) return rows;
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const aValue = rowSortValue(a, sort.key);
    const bValue = rowSortValue(b, sort.key);
    if (typeof aValue === "number" || typeof bValue === "number") {
      return ((Number(aValue) || 0) - (Number(bValue) || 0)) * direction;
    }
    return String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: "base" }) * direction;
  });
}

function nextSortDirection(scope, key) {
  const current = state.sortState?.[scope] || {};
  if (current.key !== key) return key === "score" || key === "evidence" ? "desc" : "asc";
  if (current.direction === "asc") return "desc";
  if (current.direction === "desc") return "";
  return key === "score" || key === "evidence" ? "desc" : "asc";
}

function sortColumn(scope, key) {
  const direction = nextSortDirection(scope, key);
  state.sortState[scope] = { key: direction ? key : "", direction };
  if (scope === "dossiers") renderDossiersView();
  else applyFilters();
  const label = tableColumnLabel(scope, key);
  const copy = direction ? `${label} sorted ${direction === "asc" ? "ascending" : "descending"}.` : `${label} sorting cleared.`;
  addShellEvent("Column sort updated", copy, "review", false);
}

function applyFilters() {
  state.filteredRows = sortedRowsForScope(state.rows.filter(rowMatchesFilters), "results");
  if (!state.filteredRows.some((row) => row.id === state.selectedId)) {
    state.selectedId = state.filteredRows[0]?.id ?? state.rows[0]?.id ?? null;
  }
  renderResults();
  renderDetail();
  renderRail();
  renderCurrentLoopView();
  renderSearchPopup();
  renderHistoryRail();
  renderTableFiltersPopover();
}

function orderedColumns(scope) {
  state.columnOrder[scope] = normalizeColumnOrder(scope, state.columnOrder[scope]);
  return state.columnOrder[scope];
}

function tableHeaderHtml(scope, rows = []) {
  const selectScope = scope === "dossiers" ? "dossiers" : "results";
  const sort = state.sortState?.[scope] || {};
  const actionColumn = selectScope === "results" ? `<th data-column="next" class="row-action-head" aria-label="Row actions"></th>` : "";
  return `
    <th style="width: 42px;">${selectScope === "results" ? `<span id="resultsSelectAllMount"></span>` : selectAllCheckboxHtml(rows, "dossiers")}</th>
    ${orderedColumns(scope).map((key) => {
      const active = sort.key === key && sort.direction;
      const sortLabel = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
      const iconPath = active && sort.direction === "asc" ? "m7 14 5-5 5 5" : "m7 10 5 5 5-5";
      return `
        <th data-column="${escapeHtml(key)}" data-column-drag="${escapeHtml(key)}" draggable="true" tabindex="0" aria-sort="${sortLabel}" title="Click to sort. Drag to reorder columns.">
          <span class="column-drag-label">
            ${escapeHtml(tableColumnLabel(scope, key))}
            <span class="column-sort-indicator" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="${iconPath}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          </span>
        </th>
      `;
    }).join("")}
    ${actionColumn}
  `;
}

function scoreHtml(row) {
  return `<span class="score ${escapeHtml(row.tone)}">${escapeHtml(rowDisplayScore(row))}</span>`;
}

function importedEstateLifecycleHtml(row) {
  if (row.sourceKind !== "crm-import") return "";
  return `
    <button class="row-trash-action" type="button" data-estate-lifecycle="delete" data-estate-id="${escapeHtml(row.id)}" aria-label="Delete ${escapeHtml(row.leadName || row.title)}">
      ${nucleoIcon("trash", 15)}
    </button>
  `;
}

function resultCellHtml(key, row) {
  const addressParts = addressDisplayParts(row.address, row.county);
  if (key === "address") {
    return `<td data-column="address"><span class="primary-text">${escapeHtml(addressParts.street)}</span><span class="secondary-text">${escapeHtml(addressParts.locality)}</span></td>`;
  }
  if (key === "lead") {
    return `<td data-column="lead"><span class="primary-text">${escapeHtml(row.leadName)}</span></td>`;
  }
  if (key === "evidence") return `<td data-column="evidence"><span class="classification">${escapeHtml(rowEstateDateValue(row))}</span></td>`;
  if (key === "next") {
    return `<td data-column="next"><span class="estate-next-stack"><button class="next-link solvys-liquid-glass" type="button" title="Add ${escapeHtml(row.leadName || row.title)} to Queue" data-add-row-to-queue="${escapeHtml(row.id)}">Add to queue</button>${importedEstateLifecycleHtml(row)}</span></td>`;
  }
  return "";
}

function dossierCellHtml(key, row) {
  const address = addressDisplayParts(row.address, row.county);
  if (key === "address") {
    return `<td data-column="address"><span class="primary-text">${escapeHtml(address.street)}</span><span class="secondary-text">${escapeHtml(address.locality)}</span></td>`;
  }
  if (key === "lead") return `<td data-column="lead"><span class="primary-text">${escapeHtml(row.leadName)}</span></td>`;
  if (key === "evidence") return `<td data-column="evidence"><span class="classification">${escapeHtml(rowDisplayClassification(row))}</span></td>`;
  return "";
}

function wireColumnReorder(root, scope) {
  let dragged = null;
  let draggedAt = 0;
  const clearDragState = () => {
    root.querySelectorAll("[data-column-drag].is-dragging, [data-column-drag].is-drop-target").forEach((item) => {
      item.classList.remove("is-dragging", "is-drop-target");
    });
    dragged = null;
  };
  root.querySelectorAll("[data-column-drag]").forEach((header) => {
    header.addEventListener("dragstart", (event) => {
      dragged = header.dataset.columnDrag;
      draggedAt = Date.now();
      event.dataTransfer?.setData("text/plain", dragged);
      event.dataTransfer?.setDragImage?.(header, 10, 10);
      header.classList.add("is-dragging");
    });
    header.addEventListener("dragend", () => {
      draggedAt = Date.now();
      clearDragState();
    });
    header.addEventListener("dragover", (event) => {
      if (!dragged || dragged === header.dataset.columnDrag) return;
      event.preventDefault();
      header.classList.add("is-drop-target");
    });
    header.addEventListener("dragleave", () => header.classList.remove("is-drop-target"));
    header.addEventListener("drop", (event) => {
      event.preventDefault();
      header.classList.remove("is-drop-target");
      const sourceKey = dragged || event.dataTransfer?.getData("text/plain");
      const targetKey = header.dataset.columnDrag;
      if (!sourceKey || !targetKey || sourceKey === targetKey) return;
      const order = orderedColumns(scope).filter((key) => key !== sourceKey);
      const targetIndex = order.indexOf(targetKey);
      order.splice(targetIndex < 0 ? order.length : targetIndex, 0, sourceKey);
      state.columnOrder[scope] = normalizeColumnOrder(scope, order);
      persistColumnOrder();
      if (scope === "dossiers") renderDossiersView();
      else renderResults();
      addShellEvent("Columns reordered", `${tableColumnLabel(scope, sourceKey)} moved before ${tableColumnLabel(scope, targetKey)}.`, "review", false);
    });
    header.addEventListener("click", (event) => {
      if (Date.now() - draggedAt < 180) return;
      event.preventDefault();
      sortColumn(scope, header.dataset.columnDrag);
    });
    header.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      sortColumn(scope, header.dataset.columnDrag);
    });
  });
  window.addEventListener("pointerup", clearDragState, { once: true });
}

function resultsPageSize() {
  return Math.max(1, Number(state.resultsPageSize) || 10);
}

function resultTotalPages(rows = state.filteredRows) {
  return Math.max(1, Math.ceil((rows?.length || 0) / resultsPageSize()));
}

function clampResultsPage(rows = state.filteredRows) {
  const total = resultTotalPages(rows);
  const next = Math.max(1, Math.min(Number(state.resultsPage) || 1, total));
  state.resultsPage = next;
  return next;
}

function pagedResultRows(rows = state.filteredRows) {
  const page = clampResultsPage(rows);
  const size = resultsPageSize();
  return rows.slice((page - 1) * size, page * size);
}

function renderSummaryPager(rows = state.filteredRows) {
  const pager = document.getElementById("summaryPager");
  if (!pager) return;
  const total = Math.ceil((rows?.length || 0) / resultsPageSize());
  if (total <= 1) {
    pager.hidden = true;
    pager.innerHTML = "";
    return;
  }
  const current = clampResultsPage(rows);
  pager.hidden = false;
  pager.innerHTML = Array.from({ length: total }, (_, index) => {
    const page = index + 1;
    const active = page === current;
    return `<button class="${active ? "is-active" : ""}" type="button" data-results-page="${page}" aria-label="${active ? "Current page" : "Open page"} ${page}" ${active ? `aria-current="page"` : ""}>${page}</button>`;
  }).join("");
  pager.querySelectorAll("[data-results-page]").forEach((button) => {
    button.addEventListener("click", () => setResultsPage(Number(button.dataset.resultsPage)));
  });
}

function setResultsPage(page) {
  state.resultsPage = Math.max(1, Number(page) || 1);
  clampResultsPage();
  renderSummaryPager();
  renderResultsPage({ animate: true });
}

function renderResultsPage({ animate = false } = {}) {
  const rows = state.filteredRows;
  const visibleRows = pagedResultRows(rows);
  const body = document.getElementById("resultsBody");
  if (!body) return;
  const selectAllMount = document.getElementById("resultsSelectAllMount");
  if (selectAllMount) selectAllMount.innerHTML = selectAllCheckboxHtml(visibleRows, "results");
  if (!rows.length) {
    body.classList.remove("is-page-transition");
    body.innerHTML = `<tr><td colspan="${orderedColumns("results").length + 2}"><span class="primary-text">No estate files match these filters.</span><span class="secondary-text">Try showing all missing info or lowering minimum evidence.</span></td></tr>`;
    syncSelectionLabels();
    wireBatchSelection(document, "[data-row-id]", "results");
    return;
  }
  body.classList.toggle("is-page-transition", animate);
  body.innerHTML = visibleRows.map((row, index) => {
    const checked = state.selectedIds.has(row.id);
    const classes = [
      row.id === state.selectedId ? "is-current" : "",
      checked ? "is-batch-selected" : ""
    ].filter(Boolean).join(" ");
    return `
      <tr data-row-id="${escapeHtml(row.id)}" class="${classes}" style="--row-index: ${index}">
        <td>${checkboxHtml(row.id, `Select ${row.leadName} for batch export`, checked, `data-row-select="${escapeHtml(row.id)}"`)}</td>
        ${orderedColumns("results").map((key) => resultCellHtml(key, row)).join("")}
        ${resultCellHtml("next", row)}
      </tr>
    `;
  }).join("");
  if (animate) {
    window.setTimeout(() => body.classList.remove("is-page-transition"), 520);
  }

  body.querySelectorAll("[data-row-id]").forEach((rowEl) => {
    rowEl.addEventListener("click", (event) => {
      if (event.target.closest("input, label, button, a, select, textarea")) return;
      state.selectedId = rowEl.dataset.rowId;
      recordLeadOpened(rowById(state.selectedId));
      state.railOpen = true;
      setDetailRailOpen(false);
      renderAll();
      setRailOpen(true, rowEl);
    });
  });
  body.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-add-row-to-queue]");
    if (!button || !body.contains(button) || event.heirRightQueueHandled) return;
    void queueRowFromButton(button, event).then((queued) => {
      if (queued) renderResults();
    });
  });
  body.querySelectorAll("[data-estate-lifecycle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      updateImportedEstateLifecycle(button.dataset.estateId, button.dataset.estateLifecycle);
    });
  });
  wireBatchSelection(document, "[data-row-id]", "results");
  applyColumnVisibility();
  syncSelectionLabels();
}

function renderResults() {
  const rows = state.filteredRows;
  document.getElementById("resultsCount").innerHTML = `<strong>${rows.length}</strong> result${rows.length === 1 ? "" : "s"}`;
  syncEstateArchiveToggle();
  const header = document.getElementById("resultsHeaderRow");
  if (header) header.innerHTML = tableHeaderHtml("results", rows);
  clampResultsPage(rows);
  renderSummaryPager(rows);
  renderResultsPage();
  wireColumnReorder(document, "results");
	}

function searchPopupMatches(query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return [];
  return state.rows
    .filter((row) => !row.isArchived && row.search.toLowerCase().includes(normalized))
    .slice(0, 7);
}

function renderSearchPopup() {
  const popup = document.getElementById("searchPopup");
  const input = document.getElementById("globalSearch");
  if (!popup || !input) return;
  const query = input.value.trim();
  const shouldOpen = state.searchPopupOpen && query.length > 0;
  popup.hidden = !shouldOpen;
  popup.dataset.open = shouldOpen ? "true" : "false";
  if (!shouldOpen) {
    popup.innerHTML = "";
    return;
  }
  const rows = searchPopupMatches(query);
  popup.innerHTML = `
    <div class="search-popup-title beui-command-heading">
      <span>Matching estates</span>
      <span>${rows.length} shown</span>
    </div>
    ${rows.length ? rows.map((row) => {
      const parts = addressDisplayParts(row.address, row.county);
      return `
        <div class="search-result-card" role="button" tabindex="0" data-search-open="${escapeHtml(row.id)}">
          <span class="search-result-copy">
            <strong>${escapeHtml(row.leadName || row.title)}</strong>
            <span>${escapeHtml(parts.street)} · ${escapeHtml(parts.locality)}</span>
          </span>
          <button class="search-result-action" type="button" data-search-queue="${escapeHtml(row.id)}">Add to queue</button>
        </div>
      `;
    }).join("") : `<div class="history-empty">No estate files match this search yet.</div>`}
  `;
  popup.querySelectorAll("[data-search-open]").forEach((card) => {
    const openRow = () => {
      const row = rowById(card.dataset.searchOpen);
      if (!row) return;
      state.selectedId = row.id;
      recordLeadOpened(row, "Search result");
      document.querySelector('[data-shell-nav="find-estates"]')?.click();
      renderAll();
      renderSearchPopup();
    };
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-search-queue]")) return;
      openRow();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openRow();
    });
  });
  popup.querySelectorAll("[data-search-queue]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const row = rowById(button.dataset.searchQueue);
      if (row) void addRowsToQueue([row], button).then(() => renderSearchPopup());
      else renderSearchPopup();
    });
  });
}

function setSearchPopupOpen(open) {
  state.searchPopupOpen = Boolean(open);
  renderSearchPopup();
}

function selectOptionsMarkup(sourceId, currentValue = "") {
  const select = document.getElementById(sourceId);
  if (!select) return "";
  return [...select.options].map((option) => `
    <option value="${escapeHtml(option.value)}" ${option.value === currentValue ? "selected" : ""}>${escapeHtml(option.textContent.trim())}</option>
  `).join("");
}

function renderTableFiltersPopover() {
  const popover = document.getElementById("tableFiltersPopover");
  const toggle = document.getElementById("tableFiltersToggle");
  if (!popover || !toggle) return;
  const open = Boolean(state.filterPopoverOpen);
  popover.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) {
    popover.innerHTML = "";
    return;
  }
  const proxyValue = (id) => document.getElementById(id)?.value || "";
  const proxyChecked = (id) => Boolean(document.getElementById(id)?.checked);
  const visible = (key) => [...document.querySelectorAll(`[data-column-toggle="${key}"]`)].every((toggleItem) => toggleItem.checked);
  popover.innerHTML = `
    <div class="filter-popover-head">
      <strong>List filters</strong>
      <span>Filter the current estate list, then click a column header to sort or drag it to reorder.</span>
    </div>
    <div class="filter-popover-grid">
      <label class="filter-popover-field">County
        <select data-filter-proxy="countyFilter">${selectOptionsMarkup("countyFilter", proxyValue("countyFilter"))}</select>
      </label>
      <label class="filter-popover-field">Lead type
        <select data-filter-proxy="leadTypeFilter">${selectOptionsMarkup("leadTypeFilter", proxyValue("leadTypeFilter"))}</select>
      </label>
      <label class="filter-popover-field">Source search
        <select data-filter-proxy="sourceModeFilter">${selectOptionsMarkup("sourceModeFilter", proxyValue("sourceModeFilter"))}</select>
      </label>
      <label class="filter-popover-field">Source filter
        <input type="search" data-filter-proxy="sourceQuery" value="${escapeHtml(proxyValue("sourceQuery"))}">
      </label>
      <label class="filter-popover-field">Batch size
        <select data-filter-proxy="sourceLimit">${selectOptionsMarkup("sourceLimit", proxyValue("sourceLimit"))}</select>
      </label>
      <label class="filter-popover-field">Property status
        <select data-filter-proxy="statusFilter">${selectOptionsMarkup("statusFilter", proxyValue("statusFilter"))}</select>
      </label>
      <label class="filter-popover-field">Minimum evidence
        <select data-filter-proxy="evidenceFilter">${selectOptionsMarkup("evidenceFilter", proxyValue("evidenceFilter"))}</select>
      </label>
      <label class="filter-popover-field">Missing info
        <select data-filter-proxy="missingFilter">${selectOptionsMarkup("missingFilter", proxyValue("missingFilter"))}</select>
      </label>
      <label class="filter-popover-switch">
        <span>Show only high-priority leads</span>
        <input type="checkbox" data-filter-proxy="priorityOnly" ${proxyChecked("priorityOnly") ? "checked" : ""}>
      </label>
      <div class="filter-popover-columns">
        <span>Columns</span>
        <div class="filter-popover-column-list">
          ${orderedColumns("results").map((key) => `
            <label><span>${escapeHtml(tableColumnLabel("results", key))}</span><input type="checkbox" data-column-toggle="${escapeHtml(key)}" ${visible(key) ? "checked" : ""}></label>
          `).join("")}
        </div>
      </div>
    </div>
    <button class="btn quick table-filters-toggle" type="button" data-reset-table-filters>Clear filters</button>
  `;
  positionTableFiltersPopover();
  popover.querySelectorAll("[data-filter-proxy]").forEach((control) => {
    const applyProxy = () => {
      const target = document.getElementById(control.dataset.filterProxy);
      if (!target) return;
      if (target.type === "checkbox") target.checked = control.checked;
      else target.value = control.value;
      state.historyProspectIds = null;
      if (target.id === "sourceModeFilter") target.dispatchEvent(new Event("change", { bubbles: true }));
      applyFilters();
      renderTableFiltersPopover();
    };
    if (control.matches('input[type="search"], input[type="text"]')) {
      control.addEventListener("change", applyProxy);
    } else {
      control.addEventListener("input", applyProxy);
      control.addEventListener("change", applyProxy);
    }
  });
  popover.querySelectorAll("[data-column-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      document.querySelectorAll(`[data-column-toggle="${toggle.dataset.columnToggle}"]`).forEach((other) => {
        other.checked = toggle.checked;
      });
      applyColumnVisibility();
    });
  });
  popover.querySelector("[data-reset-table-filters]")?.addEventListener("click", () => {
    document.getElementById("globalSearch").value = "";
    document.getElementById("countyFilter").value = "miami-dade";
    document.getElementById("leadTypeFilter").value = "all";
    document.getElementById("statusFilter").value = "all";
    document.getElementById("evidenceFilter").value = "0";
    document.getElementById("missingFilter").value = "all";
    document.getElementById("priorityOnly").checked = false;
    state.historyProspectIds = null;
    applyFilters();
    renderTableFiltersPopover();
  });
}

function positionTableFiltersPopover() {
  const popover = document.getElementById("tableFiltersPopover");
  const toggle = document.getElementById("tableFiltersToggle");
  if (!popover || !toggle || popover.hidden) return;
  const margin = window.matchMedia("(max-width: 760px)").matches ? 12 : 16;
  const gap = 9;
  const rect = toggle.getBoundingClientRect();
  const width = Math.min(360, Math.max(260, window.innerWidth - margin * 2));
  const right = Math.max(margin, window.innerWidth - rect.right);
  const top = Math.min(
    rect.bottom + gap,
    Math.max(margin, window.innerHeight - margin - 260)
  );
  const maxHeight = Math.max(220, window.innerHeight - top - margin);
  popover.style.setProperty("--table-filters-popover-right", `${Math.round(right)}px`);
  popover.style.setProperty("--table-filters-popover-top", `${Math.round(top)}px`);
  popover.style.setProperty("--table-filters-popover-width", `${Math.round(width)}px`);
  popover.style.setProperty("--table-filters-popover-max-height", `${Math.round(maxHeight)}px`);
}

function setFilterPopoverOpen(open) {
  state.filterPopoverOpen = Boolean(open);
  renderTableFiltersPopover();
}

function historyDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Unscheduled search";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function historyProspectSample(prospects = []) {
  return prospects.slice(0, 3).map((prospect) => prospect.label).join(", ");
}

function renderHistoryRail() {
  const rail = document.getElementById("historyRail");
  const toggle = document.getElementById("historyToggle");
  const body = document.getElementById("historyRailBody");
  if (!rail || !body) return;
  const open = Boolean(state.historyRailOpen);
  rail.dataset.open = open ? "true" : "false";
  rail.setAttribute("aria-hidden", open ? "false" : "true");
  toggle?.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) return;
  const items = state.searchHistory
    .map(normalizeSearchHistoryItem)
    .map((item) => ({ item, prospects: availableHistoryProspects(item) }))
    .filter(({ prospects }) => prospects.length);
  body.innerHTML = items.length ? items.map(({ item, prospects }) => `
    <section class="history-card" data-history-open="${escapeHtml(item.id)}">
      <span class="history-card-copy">
        <strong>${escapeHtml(historyDateLabel(item.createdAt))}</strong>
        <span>${prospects.length} Prospect${prospects.length === 1 ? "" : "s"}</span>
        <small>${escapeHtml(historyProspectSample(prospects) || item.query || "Prospects pending review")}</small>
      </span>
      <button class="history-card-action solvys-liquid-glass" type="button" data-history-open-button="${escapeHtml(item.id)}">Open</button>
    </section>
  `).join("") : `<div class="history-empty">No past searches remain outside Doc Prep. New public-source pulls will appear here until a prospect is worked.</div>`;
  body.querySelectorAll("[data-history-open]").forEach((card) => {
    const openItem = () => openHistoryItem(card.dataset.historyOpen);
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-history-open-button]")) return;
      openItem();
    });
  });
  body.querySelectorAll("[data-history-open-button]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openHistoryItem(button.dataset.historyOpenButton);
    });
  });
}

function setHistoryRailOpen(open) {
  state.historyRailOpen = Boolean(open);
  if (state.historyRailOpen) state.activityOpen = false;
  renderHistoryRail();
  setActivityOpen(state.activityOpen);
}

function openHistoryItem(itemId) {
  const item = state.searchHistory.map(normalizeSearchHistoryItem).find((entry) => entry.id === itemId);
  if (!item) return;
  const prospects = availableHistoryProspects(item);
  state.historyProspectIds = new Set(prospects.map((prospect) => prospect.id));
  const firstRow = prospects.map((prospect) => rowById(prospect.id)).find(Boolean);
  if (firstRow) state.selectedId = firstRow.id;
  document.querySelector('[data-shell-nav="find-estates"]')?.click();
  setHistoryRailOpen(false);
  applyFilters();
  document.getElementById("topStatus").textContent = `${prospects.length} prospect${prospects.length === 1 ? "" : "s"} opened from Search History.`;
}

function renderDetail() {
  const row = selectedRow();
  const dossier = dossierForRow(row);
  if (!row || !dossier) return;
  const decision = decisionCopy(dossier);
  const qualification = qualificationDecision(dossier);
  document.getElementById("detailTitle").textContent = row.title;
  document.getElementById("detailSubtitle").textContent = `${row.kind} · ${row.file}`;
  document.getElementById("detailPill").className = `pill ${row.tone}`;
  document.getElementById("detailPill").textContent = row.tone === "blocked" ? "Do not contact" : row.tone === "ready" ? "Ready" : "Review";
  document.getElementById("nextBestAction").textContent = row.next || decision.next;
  document.getElementById("nextActionCopy").textContent = "Use the report rail to review the section, then mark it ready when the source note is filled in.";
  document.getElementById("factGrid").innerHTML = [
    ["Owner", row.owner],
    ["County", formatCountyName(row.county)],
    ["Folio", row.parcel],
    ["Case", row.file],
    ["Qualification", qualificationLabel(qualification)],
    ["Source score", qualificationScoreText(qualification)],
    ["Workflow", displayStatus(dossier.workflow?.status)],
    ["Outreach", displayStatus(dossier.outreach?.readiness?.status, "Blocked")]
  ].map(([label, value]) => `
    <div class="fact">
      <label>${escapeHtml(label)}</label>
      <span>${escapeHtml(value)}</span>
    </div>
  `).join("");
  const evidencePct = Math.round((row.evidence / row.evidenceTotal) * 100);
  document.getElementById("evidenceFill").style.width = `${Math.min(100, evidencePct)}%`;
  document.getElementById("evidenceSummary").textContent = qualification
    ? `${qualification.evidenceSummary} Source coverage score is ${qualificationScoreText(qualification)}.`
    : `${row.evidence} of ${row.evidenceTotal} report sections have evidence attached.`;
  renderMilestoneBlockers(dossier);
  document.getElementById("detailChips").innerHTML = row.missing.length
    ? row.missing.map((item) => `<button class="chip solvys-liquid-glass" type="button" data-chip="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")
    : `<span class="copy">No missing sections for this view.</span>`;
  document.querySelectorAll("[data-chip]").forEach((chip) => {
    chip.addEventListener("click", () => openRailPreview(chip.dataset.chip, chip));
  });
  updateFooterLeadContext(row);
}

function renderRail() {
  const row = selectedRow();
  const dossier = dossierForRow(row);
  const content = document.getElementById("railContent");
  if (state.activeView === "dossiers" || state.railMode === "dossier") {
    state.railMode = "dossier";
    renderDossierRail(row, dossier);
    return;
  }
  state.railMode = "report";
  syncRailTabs();
  syncRailContext(row);
  if (!row || !dossier) {
    content.innerHTML = `<section class="glass-card rail-title-card"><h2 class="rail-title">Lead report</h2><p class="copy">Load the latest lead packet to see report gaps.</p></section>`;
    setRailOpen(state.railOpen);
    return;
  }
  if (state.discoveryOpen) {
    content.innerHTML = renderDiscoveryWizard(row, dossier);
    wireDiscoveryWizard(content);
    setRailOpen(true);
    return;
  }
  const previewHtml = state.railPreview ? `
    <section class="glass-card rail-preview">
      <time>${new Date(state.railPreview.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
      <h3>Preview</h3>
      <p class="copy"><strong>${escapeHtml(state.railPreview.title)}</strong> ${escapeHtml(state.railPreview.markdown)}</p>
    </section>
  ` : "";
  const titleCard = `
    <section class="glass-card rail-title-card">
      <div class="rail-title-row">
        <div>
          <p class="eyebrow">Review packet</p>
          <h2 class="rail-title">Fill these sections before export</h2>
        </div>
        ${statusPill(row.tone, row.tone === "blocked" ? "Blocked" : row.tone === "ready" ? "Ready" : "Review")}
      </div>
      ${discoveryStripHtml(row, dossier)}
    </section>
  `;
  content.innerHTML = (state.railTab === "flow" ? titleCard : "") + previewHtml + railTabHtml(row, dossier);
  content.querySelectorAll("[data-docprep-main-run]").forEach((button) => {
    button.addEventListener("click", (event) => toggleFullDiscoveryRun(event.currentTarget, button.dataset.docprepMainRun || state.activeDocPrepFlow));
  });
  wireIdiReportUploadControls(content, row);
  content.querySelectorAll("[data-docprep-rerun-review]").forEach((button) => {
    button.addEventListener("click", (event) => openDocPrepRerunReview(button.dataset.docprepRerunReview || state.activeDocPrepFlow, event.currentTarget));
  });
  content.querySelectorAll("[data-rail-chip]").forEach((chip) => {
    chip.addEventListener("click", () => openRailPreview(chip.dataset.railChip, chip));
  });
  content.querySelectorAll("[data-fill-section]").forEach((button) => {
    button.addEventListener("click", () => fillSection(button.dataset.fillSection));
  });
  content.querySelector("[data-report-date-added]")?.addEventListener("change", (event) => {
    state.reportDateAdded = event.target.value;
    renderRail();
  });
  setRailOpen(state.railOpen);
}

function railTabHtml(row, dossier) {
  if (state.railTab === "timeline") return railTimelineHtml(row, dossier);
  if (state.railTab === "docs") return railDocsHtml(row, dossier);
  return railFlowHtml(row, dossier);
}

function railFlowHtml(row, dossier) {
  const sections = row.missing.length ? row.missing : buildMissingSections(dossier);
  const qualification = qualificationDecision(dossier);
  return `
    <section class="glass-card rail-card">
      <h3>What to fill in next</h3>
      <p class="copy">Review the open file, choose a missing section, then mark that section ready once the source note is filled in.</p>
      <div>
        ${sections.map((section, index) => `
          <article class="rail-item">
            <span class="rail-item-index">${String(index + 1).padStart(2, "0")}</span>
            <span>
              <span class="rail-item-title">${escapeHtml(section.label)}</span>
              <span class="rail-item-copy">${escapeHtml(section.copy)}</span>
            </span>
            <button class="btn" type="button" data-fill-section="${escapeHtml(section.id)}">Fill</button>
          </article>
        `).join("") || `<p class="copy">No flow gaps remain for this file.</p>`}
      </div>
    </section>
    <section class="glass-card rail-card">
      <h3>Qualification review</h3>
      <ul class="mini-list">
        <li><strong>Status</strong><span>${escapeHtml(qualificationLabel(qualification))}</span></li>
        <li><strong>Source score</strong><span>${escapeHtml(qualificationScoreText(qualification))}</span></li>
        <li><strong>Next action</strong><span>${escapeHtml(qualification?.nextAction ?? "Run the daily qualification packet.")}</span></li>
      </ul>
      <div>
        ${(qualification?.coverage ?? []).map((area, index) => `
          <article class="rail-item">
            <span class="rail-item-index">${String(index + 1).padStart(2, "0")}</span>
            <span>
              <span class="rail-item-title">${escapeHtml(area.label)}</span>
              <span class="rail-item-copy">${escapeHtml(area.nextAction)}</span>
            </span>
            ${statusPill(area.status === "extracted" ? "ready" : area.status === "partial" ? "review" : "blocked", `${area.earned}/${area.weight}`)}
          </article>
        `).join("") || `<p class="copy">Qualification coverage appears after the daily review packet is prepared.</p>`}
      </div>
    </section>
    <section class="glass-card rail-card">
      <h3>Current stop rules</h3>
      <ul class="mini-list">
        <li><strong>Company owner</strong><span>Move on unless the HeirRight review team approves the lead.</span></li>
        <li><strong>Sold inside five years</strong><span>Review before spending time on outreach.</span></li>
        <li><strong>Paid source needed</strong><span>IDI, Intelius, Ancestry, ForeWarn, VitalChek, and PI work stay approval-gated.</span></li>
      </ul>
    </section>
  `;
}

function railTimelineHtml(row, dossier) {
  const stages = [
    ["Seed captured", `Owner and property seed: ${row.owner}`],
    ["County records checked", `${row.evidence} evidence sections attached so far.`],
    ["Report gaps visible", `${row.missing.length} missing section${row.missing.length === 1 ? "" : "s"} still need review.`],
    ["Team review", decisionCopy(dossier).next],
    ["Export prep", "Podio and Google Workspace stay prep-only until access and approval are clear."]
  ];
  return `
    <section class="glass-card rail-card">
      <h3>Review timeline</h3>
      <div>
        ${stages.map(([title, copy], index) => `
          <article class="rail-item">
            <span class="rail-item-index">${String(index + 1).padStart(2, "0")}</span>
            <span>
              <span class="rail-item-title">${escapeHtml(title)}</span>
              <span class="rail-item-copy">${escapeHtml(copy)}</span>
            </span>
            ${index < 2 ? statusPill("ready", "Done") : statusPill(index === 4 ? "blocked" : "review", index === 4 ? "Gate" : "Next")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function reportPacketDateOptions(row, dossier) {
  const values = [
    dossier?.completedLeadReport?.generatedAt,
    dossier?.generatedAt,
    row?.data?.generatedAt,
    row?.data?.seed?.dateAdded,
    row?.importedAt,
    state.data?.generatedAt
  ].filter(Boolean);
  const unique = [...new Set(values.map((value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10);
  }))];
  if (!unique.length) unique.push(new Date().toISOString().slice(0, 10));
  if (!state.reportDateAdded || !unique.includes(state.reportDateAdded)) state.reportDateAdded = unique[0];
  return unique;
}

function packetArtifactForRow(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  if (!row) return null;
  return state.packetArtifacts?.[`${flowId}:${row.id}`] || null;
}

async function verifyPacketArtifact(result, estateId = "", expectedEstateIds = [], expectedBinding = {}) {
  const artifactId = result?.artifact?.artifactId;
  const artifactUrl = result?.artifactUrl;
  const contentHash = result?.artifact?.contentHash;
  const requiredEstateIds = Array.from(new Set([estateId, ...expectedEstateIds].filter(Boolean)));
  if (!result?.ok || result?.contentType !== "application/pdf" || !artifactId || !artifactUrl || !contentHash) {
    throw new Error("Packet generation did not return a complete PDF artifact record.");
  }
  if (!artifactUrl.includes(encodeURIComponent(artifactId))) {
    throw new Error("Packet artifact identity did not match its download route.");
  }
  const returnedEstateIds = Array.from(new Set((result?.artifact?.estateIds || result?.estateIds || []).filter(Boolean)));
  if (requiredEstateIds.length !== returnedEstateIds.length
    || requiredEstateIds.some((id) => !returnedEstateIds.includes(id))) {
    throw new Error("Packet artifact identity did not match the exact selected estate records.");
  }
  const expectedPacketRevision = Number(expectedBinding.packetRevision);
  if (expectedBinding.flowId && (result.flow !== expectedBinding.flowId || result?.artifact?.flow !== expectedBinding.flowId)) {
    throw new Error("Packet artifact identity did not match the selected workflow.");
  }
  if (Number.isInteger(expectedPacketRevision) && expectedPacketRevision > 0
    && (Number(result.packetRevision) !== expectedPacketRevision || Number(result?.artifact?.packetRevision) !== expectedPacketRevision)) {
    throw new Error("Packet artifact identity did not match the current workflow revision.");
  }
  const persistence = Array.isArray(result.packetPersistence) ? result.packetPersistence : [];
  if (requiredEstateIds.some((id) => !persistence.some((item) => item?.estateId === id && item?.readbackStatus === "verified"))) {
    throw new Error("The packet did not pass shared Discovery File readback for every selected estate.");
  }
  const response = await fetch(artifactUrl, { cache: "no-store" });
  const bytes = await response.arrayBuffer();
  const returnedId = response.headers.get("x-heirright-artifact-id");
  const returnedHash = response.headers.get("x-heirright-content-hash");
  if (!response.ok || response.headers.get("content-type") !== "application/pdf") {
    throw new Error("The stored packet could not be opened as a PDF.");
  }
  if (returnedId !== artifactId || returnedHash !== contentHash || bytes.byteLength < 10_000) {
    throw new Error("The stored packet did not pass artifact identity, hash, and content readback.");
  }
  const requiredDiscoveryDocuments = [
    "completed-report",
    "source-notes",
    "deed-title-notes",
    "tax-history",
    "probate-request",
    "heir-contact-matrix",
    "outreach-drafts",
    "drip-schedule",
    "crm-handoff"
  ];
  const documentArtifacts = Array.isArray(result.documentArtifacts) ? result.documentArtifacts : [];
  if (result.flow === "discovery") {
    const returnedDocumentIds = new Set(documentArtifacts.map((document) => String(document?.documentId || "")));
    if (returnedDocumentIds.size !== requiredDiscoveryDocuments.length
      || requiredDiscoveryDocuments.some((documentId) => !returnedDocumentIds.has(documentId))) {
      throw new Error("Discovery did not return one separated PDF artifact for every document-prep step.");
    }
  }
  const verifiedDocumentArtifacts = [];
  for (const document of documentArtifacts) {
    const documentId = String(document?.documentId || "");
    const childArtifactId = String(document?.artifactId || "");
    const childArtifactUrl = String(document?.artifactUrl || "");
    const childContentHash = String(document?.contentHash || "");
    if (!documentId || !childArtifactId || !childArtifactUrl || !childContentHash
      || !childArtifactUrl.includes(encodeURIComponent(childArtifactId))) {
      throw new Error(`The separated ${documentId || "document"} PDF returned an incomplete artifact record.`);
    }
    const childResponse = await fetch(childArtifactUrl, { cache: "no-store" });
    const childBytes = await childResponse.arrayBuffer();
    if (!childResponse.ok
      || childResponse.headers.get("content-type") !== "application/pdf"
      || childResponse.headers.get("x-heirright-artifact-id") !== childArtifactId
      || childResponse.headers.get("x-heirright-content-hash") !== childContentHash
      || childBytes.byteLength < 700) {
      throw new Error(`The separated ${documentId} PDF did not pass artifact identity, hash, and content readback.`);
    }
    verifiedDocumentArtifacts.push({
      ...document,
      verification: {
        verified: true,
        readbackStatus: "verified",
        artifactId: childArtifactId,
        contentHash: childContentHash,
        byteLength: childBytes.byteLength,
        verifiedAt: new Date().toISOString()
      }
    });
  }
  return {
    ...result,
    documentArtifacts: verifiedDocumentArtifacts,
    verification: {
      verified: true,
      readbackStatus: "verified",
      artifactId,
      contentHash,
      byteLength: bytes.byteLength,
      verifiedAt: new Date().toISOString()
    }
  };
}

async function generatePacketPreview(row = selectedRow(), source = null, options = {}) {
  const flowId = options.flowId || state.activeDocPrepFlow;
  const flow = docPrepFlow(flowId);
  const dossier = dossierForRow(row);
  if (!row || !dossier) return;
  const stopBlocker = canonicalStopBlocker(row, "Packet generation");
  if (stopBlocker) {
    document.getElementById("topStatus").textContent = stopBlocker;
    addShellEvent("Packet generation blocked by stop rule", stopBlocker, "blocked", true, { row, source: flow.title });
    return null;
  }
  if (isDemoEstateImport(row)) {
    nudgeDeniedAction(source, "Preview blocked", "Sample estates stay isolated from production packet export.", { pill: true, source: "document-preview" });
    return;
  }
  source?.setAttribute?.("aria-busy", "true");
  if (source) source.disabled = true;
  try {
    const estateId = assetDiscoveryKey(row);
    const packetRevision = currentPacketRevision(row, flowId) + 1;
    const generated = await postJson("/api/exports", {
      routes: [],
      dryRun: false,
      flow: flowId,
      estateId,
      packetRevision,
      dossier,
      ...(flowId === "closing-docs" ? {
        selectedClosingTemplateIds: selectedClosingTemplateIds(row),
        closingFieldValues: state.closingFieldValues?.[assetDiscoveryKey(row)] || {}
      } : {}),
      operatorIntent: "generate_packet"
    });
    if (!generated?.ok || !generated?.artifactUrl) throw new Error((generated?.blockers || []).join(" ") || "Packet generation is blocked.");
    const result = await verifyPacketArtifact(generated, estateId, [], { flowId, packetRevision });
    state.packetArtifacts[`${flowId}:${row.id}`] = result;
    state.exportResult = result;
    addShellEvent("Packet preview ready", `${docPrepEstateLabel(row)} was rendered as one source-backed PDF.`, "ready", false, { row, source: flow.title });
    if (options.render !== false) renderRail();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = options.s40 ? s40SafeBlocker(error, "The packet did not pass verified PDF readback. Retry the Doc Prep run.") : message;
    state.exportResult = { ok: false, blockers: [safeMessage], routes: [] };
    document.getElementById("topStatus").textContent = options.s40 ? safeMessage : `Packet preview blocked: ${message}`;
    if (options.render !== false) renderRail();
    return null;
  } finally {
    source?.removeAttribute?.("aria-busy");
    if (source) source.disabled = false;
  }
}

async function deliverPacketToGoogle(row = selectedRow(), packet = null) {
  const flow = String(packet?.flow || state.activeDocPrepFlow);
  const stopBlocker = canonicalStopBlocker(row, "Google Workspace delivery");
  if (stopBlocker) throw new Error(stopBlocker);
  requireCurrentUnexpiredPacket(row, flow, packet, "Google Workspace delivery");
  const artifactId = packet?.artifact?.artifactId || packet?.verification?.artifactId;
  if (!artifactId) throw new Error("The Discovery PDF did not pass artifact verification before delivery.");
  if (!googleWorkspaceDeliveryReady()) {
    throw new Error("Connect Google Workspace and choose a Drive folder before the Discovery PDF can be delivered.");
  }
  const approval = currentPacketApproval(row, flow);
  if (!approval) throw new Error("Approve the current verified packet revision before Google Workspace delivery.");
  document.getElementById("topStatus").textContent = `Saving the verified Discovery PDF to ${state.googleWorkspace.destinationName}...`;
  const delivery = await postJson("/api/google-workspace/export", {
    artifactId,
    estateId: assetDiscoveryKey(row),
    flow,
    packetRevision: approval.packetRevision,
    ...(flow === "discovery" ? { deliveryDocumentId: "completed-report" } : {}),
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
  });
  if (!delivery?.ok || delivery.readbackStatus !== "verified" || !delivery.readbackOk) {
    throw new Error(delivery?.message || "Google Drive delivery did not pass readback verification.");
  }
  const routes = [...(packet.routes || []).filter((route) => route?.route !== "google"), delivery];
  const deliveredPacket = { ...packet, routes, googleDelivery: delivery };
  state.packetArtifacts[`${flow}:${row.id}`] = deliveredPacket;
  state.exportResult = deliveredPacket;
  return delivery;
}

function railDocsHtml(row, dossier) {
  const options = reportPacketDateOptions(row, dossier);
  const dateAdded = state.reportDateAdded;
  const report = dossier.completedLeadReport;
  const packetArtifact = packetArtifactForRow(row);
  const readiness = docPrepReadinessItems(row, dossier);
  const exportResults = state.exportResult?.routes ?? [];
  const exportBlockers = exportBlockerItems();
  return `
    <section class="glass-card rail-card pdf-packet-card">
      <div class="pdf-packet-toolbar">
        <div>
          <p class="eyebrow">Preview</p>
          <h2 class="rail-title">${escapeHtml(row?.leadName || row?.title || "Lead report")}</h2>
        </div>
        <div class="pdf-packet-actions">
          <label class="pdf-date-select">Date added
            <select data-report-date-added aria-label="Select Date Added property">
              ${options.map((date) => `<option value="${escapeHtml(date)}" ${date === dateAdded ? "selected" : ""}>${escapeHtml(new Date(`${date}T12:00:00`).toLocaleDateString())}</option>`).join("")}
            </select>
          </label>
          ${packetArtifact?.artifactUrl ? `<a class="btn primary solvys-liquid-glass" href="${escapeHtml(packetArtifact.artifactUrl)}" download>${nucleoIcon("batch-tray", 15)}<span>Download PDF</span></a>` : ""}
        </div>
      </div>
      ${packetArtifact?.artifactUrl ? `
        <iframe class="pdf-packet-frame" title="Preview PDF" src="${escapeHtml(packetArtifact.artifactUrl)}"></iframe>
      ` : `
        <div class="pdf-packet-empty">
          <p class="copy">Generate the current source-backed packet to preview the exact PDF that will download.</p>
          <button class="btn primary solvys-liquid-glass" type="button" data-generate-packet-preview>Generate Preview</button>
        </div>
      `}
    </section>
    <section class="glass-card rail-card">
      <h3>Notes and blockers</h3>
      <ul class="pdf-blocker-list">
        ${readiness.map((item) => `
          <li>
            ${linearStatusIconHtml(item.state === "complete" ? "complete" : item.mandatory ? "blocked" : "pending", item.title)}
            <span><strong>${escapeHtml(item.title)}</strong><span class="rail-item-copy">${escapeHtml(item.copy)}</span></span>
            <span class="pill ${item.mandatory ? "blocked" : item.state === "complete" ? "ready" : "review"}">${escapeHtml(item.mandatory ? "Required" : item.state === "complete" ? "Ready" : "Tracked")}</span>
          </li>
        `).join("")}
        ${(report?.reviewGate?.externalUseBlocked ? [report.reviewGate.reason || "External use remains blocked until review clears."] : []).map((blocker) => `
          <li>
            ${linearStatusIconHtml("blocked", "Review blocked")}
            <span><strong>Report review gate</strong><span class="rail-item-copy">${escapeHtml(blocker)}</span></span>
            <span class="pill blocked">Blocked</span>
          </li>
        `).join("")}
        ${exportResults.map((result) => `
          <li>
            ${linearStatusIconHtml(result.readbackOk ? "complete" : "pending", result.route)}
            <span><strong>${escapeHtml(displayStatus(result.route))}</strong><span class="rail-item-copy">${escapeHtml(operatorBlockerText(result.message ?? "Doc Prep result recorded."))}</span></span>
            <span class="pill ${result.readbackOk ? "ready" : "review"}">${escapeHtml(handoffModeLabel(result.mode))}</span>
          </li>
        `).join("")}
        ${exportBlockers.map((blocker) => `
          <li>
            ${linearStatusIconHtml("blocked", "Doc Prep blocker")}
            <span><strong>Doc Prep blocker</strong><span class="rail-item-copy">${escapeHtml(blocker)}</span></span>
            <span class="pill blocked">Blocked</span>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

function applyColumnVisibility() {
  document.querySelectorAll("[data-column-toggle]").forEach((toggle) => {
    const key = toggle.dataset.columnToggle;
    document.querySelectorAll(columnMap[key]).forEach((cell) => {
      cell.classList.toggle("column-hidden", !toggle.checked);
    });
  });
}

function renderAll() {
  renderSummary();
  applyFilters();
  renderCurrentLoopView();
  syncBatchExportControls();
}

function connectionVisibleState(tone, status) {
  if (status) return status;
  if (tone === "ready") return "Live";
  if (tone === "review") return "Prep";
  if (tone === "blocked") return "Blocked";
  return "Unknown";
}

function handoffModeLabel(mode) {
  if (mode === "dry_run") return "prep only";
  if (mode === "blocked") return "blocked";
  if (mode === "live") return "live";
  return displayStatus(mode, "review");
}

function connectionName(id) {
  return {
    podioStatus: "Podio",
    googleStatus: "Google",
    webSearchStatus: "Web Search"
  }[id] ?? "Connection";
}

function setConnectionChip(id, tone, label, visibleState = null) {
  const chip = document.getElementById(id);
  chip.className = `connection-chip ${tone}`;
  chip.title = label;
  const name = connectionName(id);
  const status = connectionVisibleState(tone, visibleState);
  chip.innerHTML = `<span class="connection-dot" aria-hidden="true"></span>${escapeHtml(name)} · ${escapeHtml(status)}`;
  chip.setAttribute("aria-label", `${name} ${status}: ${label}`);
}

function connectionTone(status) {
  if (!status) return "neutral";
  if (status.ok && status.mode === "live") return "ready";
  if (status.name === "Browserbase Usage" && status.ok) return "blocked";
  if (status.ok) return "review";
  return "blocked";
}

function connectionByName(name) {
  return state.connections.find((connection) => connection.name === name);
}

function operatorConnectionMessage(connection, name) {
  const raw = connection?.message ?? "";
  if (name === "Browserbase Usage" && connection?.ok && connection?.mode !== "live") {
    return "Saved Browserbase configuration remains review-only. Recent disposable sessions return HTTP 402, so live browser capture is blocked until billing is restored and a successful session is verified.";
  }
  const hasSetupDetail = /[A-Z0-9]+_[A-Z0-9_]+|credential|missing|token|field map|config is missing|setup is incomplete|not configured/i.test(raw);
  if (!raw || hasSetupDetail) {
    if (name === "Podio") return "Podio is not connected yet. Keep CRM review prep-only until access, one approved sample card, and confirmation are complete.";
    if (name === "Google") return "Google Workspace export is not connected yet. Keep Docs and Sheets prep-only until destination approval is complete.";
    if (name === "Resend") return "Resend fallback is not approved yet. Keep email drafts queued in Podio and use only controlled internal test recipients after approval.";
    if (name === "SMS Gateway") return "SMS delivery is not configured yet. Keep SMS templates in the app-owned queue until a carrier or Podio-native SMS path is approved.";
    if (name === "Web Search") return "Public-source validation needs a fresh checked lead packet before promotion.";
    if (name === "Tax Collector Source") return "Tax Collector receipt capture needs a funded browser workflow before HeirRight can search from estate facts and preserve the receipt automatically.";
    if (name === "Miami-Dade Clerk API") return "Clerk records are not connected yet. Official Records and court docket checks stay review-blocked until commercial access is added.";
    if (name === "Vital/Obituary Workflow") return "Obituary and vital-source review needs the browser workflow before it can return source links automatically.";
    if (name === "IDI Core") return "idiCORE portal access is not confirmed yet. Keep Discovery blocked until an approved operator search is imported or vendor API access is provisioned.";
    if (name === "Browserbase Usage") return "Browserbase browser capture is not ready yet. Single-estate source capture and paid batch approval stay blocked until access and function checks are configured.";
    if (name === "Activepieces") return "Backstage outreach handoff is not configured yet. Outreach will use the first-party fallback package and stay queued for Podio review.";
    if (name === "Linear Support") return "Linear support routing is not connected yet. HeirRight will not claim a support ticket was filed until the team route confirms it.";
    if (name === "Leads Engine Access") return "Leads engine access changes are captured in-app until support routing or the access webhook is configured.";
  }
  return raw;
}

async function loadConnectionStatuses() {
  try {
    const response = await fetch("/api/connections/status", { cache: "no-store" });
    if (!response.ok) throw new Error("Connection status unavailable");
    state.connections = await response.json();
    updateConnectionStatuses();
    if (document.querySelector("[data-source-readiness-panel]")) renderRail();
    return true;
  } catch (error) {
    return false;
  }
}

async function loadAgenticModelStatus({ rerender = false } = {}) {
  try {
    const response = await fetch("/api/agentic/models", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || "Automatic model selection is unavailable.");
    state.agenticModelStatus = {
      loaded: true,
      available: Boolean(result.available),
      provider: "nous",
      model: result.model || null,
      freeModels: Array.isArray(result.freeModels) ? result.freeModels.map(String).filter(Boolean) : [],
      route: result.route || "unavailable",
    };
    const stored = storageGetItem(agenticModelPreferenceKey);
    if (stored && (stored === "dynamic-free-catalog" || state.agenticModelStatus.freeModels.includes(stored))) {
      state.agenticModelPreference = stored;
    } else {
      state.agenticModelPreference = "dynamic-free-catalog";
    }
  } catch {
    state.agenticModelStatus = { loaded: true, available: false, provider: "nous", model: null, freeModels: [], route: "unavailable" };
    state.agenticModelPreference = "dynamic-free-catalog";
  }
  if (rerender && state.activeView === "settings" && state.settingsTab === "integrations") renderSettingsView();
  return state.agenticModelStatus;
}

function googleWorkspaceDeliveryReady() {
  return Boolean(state.googleWorkspace?.connected && state.googleWorkspace?.destinationId);
}

async function loadGoogleWorkspaceConnection({ folders = false, rerender = false } = {}) {
  if (!state.session?.authenticated || !state.session?.user?.email) {
    state.googleWorkspace = null;
    state.googleWorkspaceFolders = [];
    return null;
  }
  state.googleWorkspaceLoading = true;
  try {
    const response = await fetch("/api/google-workspace/status", { cache: "no-store" });
    const connection = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(connection.message || "Google Workspace status is unavailable.");
    state.googleWorkspace = connection;
    if (folders && connection.connected) {
      const foldersResponse = await fetch("/api/google-workspace/destinations", { cache: "no-store" });
      const foldersResult = await foldersResponse.json().catch(() => ({}));
      if (!foldersResponse.ok) throw new Error(foldersResult.message || "Drive folders are unavailable.");
      state.googleWorkspaceFolders = Array.isArray(foldersResult.folders) ? foldersResult.folders : [];
    }
    return connection;
  } catch (error) {
    state.googleWorkspace = { connected: false, error: error instanceof Error ? error.message : String(error) };
    state.googleWorkspaceFolders = [];
    return null;
  } finally {
    state.googleWorkspaceLoading = false;
    if (rerender && state.activeView === "settings") renderSettingsView();
  }
}

function updateConnectionStatuses() {
  const dossier = state.dossier;
  const podioConnection = connectionByName("Podio");
  const googleConnection = connectionByName("Google");
  const webConnection = connectionByName("Web Search");

  if (podioConnection || googleConnection || webConnection) {
    setConnectionChip("podioStatus", connectionTone(podioConnection), operatorConnectionMessage(podioConnection, "Podio"), displayStatus(podioConnection?.mode));
    setConnectionChip("googleStatus", connectionTone(googleConnection), operatorConnectionMessage(googleConnection, "Google"), displayStatus(googleConnection?.mode));
    setConnectionChip("webSearchStatus", "ready", "Public record source checks are ready and reported per run.", "Ready");
    return;
  }

  if (!dossier) {
    setConnectionChip("podioStatus", "neutral", "Podio status unknown until a lead packet is loaded.");
    setConnectionChip("googleStatus", "neutral", "Google status unknown until a lead packet is loaded.");
    setConnectionChip("webSearchStatus", "ready", "Public record source checks are ready and reported per run.", "Ready");
    return;
  }
  const podio = dossier.crm?.payload?.podioReadiness ?? {};
  const podioBlocked = (podio.blockers?.length ?? 0) > 0 || (podio.missingConfig?.length ?? 0) > 0;
  setConnectionChip(
    "podioStatus",
    podioBlocked ? "blocked" : "review",
    podioBlocked ? "Podio is not connected. Doc Prep is prep-only." : "Podio package is prepared for an approved sample-card check.",
    podioBlocked ? "Prep blocked" : "Prep ready"
  );
  setConnectionChip(
    "googleStatus",
    "review",
    "Google Workspace export is prep-only. No live Docs or Sheets write has run.",
    "Prep only"
  );
  const publicSourceOk = (state.data?.facts ?? []).some((fact) => {
    const value = fact.value;
    return fact.factType === "source_status" && value && typeof value === "object" && value.ok === true;
  });
  setConnectionChip(
    "webSearchStatus",
    "ready",
    publicSourceOk ? "Public web search sources are reachable in the latest packet." : "Public record source checks are ready and reported per run.",
    publicSourceOk ? "Sources checked" : "Ready"
  );
}

function renderLoadedState(data, dossier) {
  state.data = data;
  state.dossier = dossier;
  state.rows = buildRows(data, dossier);
  migrateUnambiguousLegacyEstateState(state.rows);
  pruneBatchSets();
  syncLegacyPlaceholderEstateState();
  syncLegacyPlaceholderCleanupControl();
  state.selectedId = state.selectedId ?? state.rows[0]?.id ?? null;
  document.getElementById("topStatus").textContent = `${data.facts?.length ?? 0} evidence items loaded from the latest lead review.`;
  updateFooterLeadContext(selectedRow());
  updateConnectionStatuses();
  loadConnectionStatuses();
  renderShellPanels();
  renderAll();
}

async function loadDailyRun() {
  try {
    const response = await fetch("/daily-run.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No daily run loaded.");
    return await response.json();
  } catch {
    return null;
  }
}

async function loadQualificationReview() {
  try {
    const response = await fetch("/qualification-review.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No qualification review loaded.");
    return await response.json();
  } catch {
    return null;
  }
}

async function loadFreshLeadBatch() {
  try {
    const response = await fetch("/fresh-lead-batch.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No fresh lead batch loaded.");
    const batch = await response.json();
    if (!batch?.latestRun?.dossier || !Array.isArray(batch.leadRuns) || !batch.leadRuns.length) {
      throw new Error("Fresh lead batch is not renderable yet.");
    }
    return batch;
  } catch {
    return null;
  }
}

async function loadLatestRunPacket() {
  const response = await fetch("/latest-run.json", { cache: "no-store" });
  if (!response.ok) throw new Error("No latest lead found. Run the lead review pipeline first.");
  const data = await response.json();
  if (!data.dossier) throw new Error("The latest lead review did not include a dossier.");
  return data;
}

async function loadRun() {
  try {
    document.getElementById("topStatus").textContent = "Loading latest lead packet...";
    clearFreshBatchStatus();
    const freshBatch = await loadFreshLeadBatch();
    if (freshBatch) {
      const latestPacket = await loadLatestRunPacket().catch(() => null);
      if (latestPacket?.dossier?.completedLeadReport?.formats?.familyTreeHtml) {
        const latestOwner = cleanDisplayValue(latestPacket.dossier?.property?.ownerName?.value ?? latestPacket.seed?.ownerName ?? "");
        if (hasSpecificOwnerName(latestOwner)) freshBatch.latestRun = latestPacket;
        const latestAddress = cleanDisplayValue(latestPacket.dossier?.property?.address?.value ?? latestPacket.seed?.propertyAddress ?? "");
        const latestName = cleanDisplayValue(latestPacket.dossier?.summary?.estateName ?? latestPacket.seed?.estateName ?? latestPacket.seed?.ownerName ?? "");
        const matchesLatest = (leadRun) => {
          const address = cleanDisplayValue(leadRun?.dossier?.property?.address?.value ?? leadRun?.seed?.propertyAddress ?? "");
          const name = cleanDisplayValue(leadRun?.dossier?.summary?.estateName ?? leadRun?.seed?.estateName ?? leadRun?.seed?.ownerName ?? "");
          return (latestAddress && address === latestAddress) || (latestName && name === latestName) || leadRun.runId === latestPacket.runId;
        };
        if (hasSpecificOwnerName(latestOwner)) {
          freshBatch.leadRuns = [latestPacket, ...freshBatch.leadRuns.filter((leadRun) => !matchesLatest(leadRun))];
        }
      }
      state.freshBatch = freshBatch;
      state.dailyRun = freshBatch.dailyRun ?? await loadDailyRun();
      state.qualificationReview = state.dailyRun?.qualificationReview ?? await loadQualificationReview();
      renderLoadedState(freshBatch.latestRun, freshBatch.latestRun.dossier);
      seedSearchHistoryFromCurrentRows();
      const firstSeed = freshBatch.seeds?.[0] ?? {};
      const firstLead = firstSeed.ownerName || firstSeed.estateName || cleanDisplayValue(firstSeed.propertyAddress) || "live public-source lead";
      const summary = clientFacingCopy(freshBatch.operatorSummary || `Pulled ${freshBatch.acceptedSeedCount ?? freshBatch.leadRuns.length} live lead(s).`);
      document.getElementById("topStatus").textContent = `${summary} First lead: ${firstLead}.`;
      await hydrateServerBackedState();
      await hydratePersistedDiscoveryFile(selectedRow());
      return;
    }
    const data = await loadLatestRunPacket();
    state.freshBatch = null;
    state.dailyRun = await loadDailyRun();
    state.qualificationReview = state.dailyRun?.qualificationReview ?? await loadQualificationReview();
    renderLoadedState(data, data.dossier);
    await hydrateServerBackedState();
    await hydratePersistedDiscoveryFile(selectedRow());
  } catch (error) {
    state.data = null;
    state.dossier = null;
    state.dailyRun = null;
    state.qualificationReview = null;
    state.rows = crmImportRows();
    state.filteredRows = state.rows;
    state.selectedId = state.rows[0]?.id ?? null;
    state.selectedIds.clear();
    state.queueIds.clear();
    syncLegacyPlaceholderEstateState();
  syncLegacyPlaceholderCleanupControl();
    document.getElementById("topStatus").textContent = error.message;
    document.getElementById("resultsBody").innerHTML = state.rows.length
      ? ""
      : `<tr><td colspan="6"><span class="primary-text">No lead packet loaded.</span><span class="secondary-text">${escapeHtml(error.message)}</span></td></tr>`;
    updateFooterLeadContext(selectedRow());
    updateConnectionStatuses();
    renderShellPanels();
    if (state.rows.length) renderAll();
    await hydrateServerBackedState();
    await hydratePersistedDiscoveryFile(selectedRow());
  }
}

function currentFreshLeadFilters() {
  const sourceQuery = document.getElementById("sourceQuery")?.value?.trim();
  const globalQuery = document.getElementById("globalSearch")?.value?.trim();
  const county = document.getElementById("countyFilter")?.value || "miami-dade";
  return {
    county: county === "all" ? "miami-dade" : county,
	    searchMode: document.getElementById("sourceModeFilter")?.value || "address",
    query: sourceQuery || globalQuery || "EST OF",
    limit: Number(document.getElementById("sourceLimit")?.value || 3),
    leadType: document.getElementById("leadTypeFilter")?.value || "all",
    status: document.getElementById("statusFilter")?.value || "all",
    minimumEvidence: Number(document.getElementById("evidenceFilter")?.value || 0),
    missingInfo: document.getElementById("missingFilter")?.value || "all",
    priorityOnly: Boolean(document.getElementById("priorityOnly")?.checked),
    includeCompanyOwners: false
  };
}

function clearFreshBatchStatus() {
  const status = document.getElementById("freshBatchStatus");
  if (!status) return;
  status.textContent = "";
  status.dataset.tone = "neutral";
  status.dataset.visible = "false";
  status.hidden = true;
}

function setFreshBatchStatus(message, tone = "neutral") {
  const status = document.getElementById("freshBatchStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
  status.dataset.visible = message ? "true" : "false";
  status.hidden = !message;
}

function setFreshBatchBusy(isBusy) {
  const button = document.getElementById("freshBatch");
  if (!button) return;
  button.disabled = isBusy;
  button.setAttribute("aria-busy", isBusy ? "true" : "false");
}

async function pullFreshBatch(source = null) {
  const filters = currentFreshLeadFilters();
  const payload = {
    source: "miami_dade_property_appraiser",
    startedBy: "operator_ui",
    filters
  };
  setFreshBatchBusy(true);
  clearFreshBatchStatus();
  document.getElementById("topStatus").textContent = "Pulling a live external lead batch...";
  try {
    const response = await postFreshLeadBatch(payload);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      throw new Error(result?.blockers?.[0] || result?.message || result?.error || `Fresh lead pull failed with HTTP ${response.status}.`);
    }
    if (!result.latestRun?.dossier) {
      throw new Error(result.blockers?.[0] || "Fresh lead pull did not return a usable lead packet.");
    }

    state.freshBatch = result;
    state.dailyRun = result.dailyRun;
    state.qualificationReview = result.dailyRun?.qualificationReview ?? null;
    state.selectedId = null;
    state.historyProspectIds = null;
    renderLoadedState(result.latestRun, result.latestRun.dossier);
    recordSearchHistory(result, filters);

    const firstSeed = result.seeds?.[0] ?? {};
    const firstLead = firstSeed.ownerName || firstSeed.estateName || cleanDisplayValue(firstSeed.propertyAddress) || "live public-source lead";
    const summary = clientFacingCopy(result.operatorSummary || `Pulled ${result.acceptedSeedCount ?? 0} live lead(s).`);
    document.getElementById("topStatus").textContent = `${summary} First lead: ${firstLead}.`;
    setFreshBatchStatus(`${result.acceptedSeedCount} live lead${result.acceptedSeedCount === 1 ? "" : "s"} pulled from Miami-Dade Property Appraiser.`, "ready");
    addShellEvent(
      "Fresh leads pulled",
      `${firstLead} loaded from external public records; source gaps remain in review before outreach.`,
      "ready",
      false
    );
    await loadConnectionStatuses();
    setRailOpen(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setFreshBatchStatus(message, "blocked");
    document.getElementById("topStatus").textContent = `Fresh lead pull blocked: ${message}`;
    addShellEvent("Fresh lead pull blocked", message, "blocked", false);
  } finally {
    setFreshBatchBusy(false);
    renderShellPanels();
  }
}

async function postFreshLeadBatch(payload) {
  const options = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
  const primary = await fetch("/api/leads/public-source-pull", options);
  if (primary.ok || ![404, 405].includes(primary.status)) return primary;
  return fetch("/api/leads/fresh-batch", {
    ...options,
    body: JSON.stringify(payload),
  });
}

const allowedExportRoutes = new Set(["queue", "pdf", "google", "podio", "podio-test", "both"]);
const allowedDocumentActions = new Set(["select", "preview", "replace", "remove", "queue", "download"]);

function requireExportRoute(route) {
  const normalized = String(route || "");
  if (!allowedExportRoutes.has(normalized)) throw new Error(`Unsupported export route: ${normalized || "(empty)"}`);
  return normalized;
}

function exportRouteMeta(route) {
  const routes = {
    pdf: {
      label: "combined PDF",
      status: "export: [PDF]",
      title: "Generate combined PDF",
      copy: "Generate one reviewed PDF containing every queued estate for the selected Doc Prep flow."
    },
    google: {
      label: "Google Workspace",
      status: "export: [GOOGLE]",
      title: "Prepare Google Workspace export",
      copy: "Prepare the completed report for Google Docs or Sheets review. Use this when the team needs a clean document package before outreach; no live file is created from the review surface."
    },
    podio: {
      label: "Podio",
      status: "export: [PODIO]",
      title: "Prepare Podio review",
      copy: "Prepare the completed report and lead fields for Podio. Use this when the file is ready for CRM review, before any production card is created."
    },
    "podio-test": {
      label: "Podio readiness check",
      status: "export: [PODIO CHECK]",
      title: "Run Podio readiness check",
      copy: "Create one approved sample Lead card in Podio and confirm it comes back.",
      dryRun: false,
      controlledTest: true
    },
    both: {
      label: "Google + Podio",
      status: "export: [GOOGLE + PODIO]",
      title: "Prepare Google + Podio export",
      copy: "Prepare one completed report package for Google Workspace review and Podio review; live writes stay locked until approval and readback proof."
    }
  };
  return routes[requireExportRoute(route)];
}

function setExportMenuOpen(open) {
  const menu = document.getElementById("exportMenu");
  const toggle = document.getElementById("exportToggle");
  const popover = document.getElementById("exportPopover");
  menu.dataset.open = open ? "true" : "false";
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  popover?.classList.toggle("is-open", open);
  if (open) popover?.classList.remove("is-closing");
  else popover?.classList.add("is-closing");
  wireBeuiMenuKeyboard(menu || document);
  if (open) popover?.querySelector("[role='menuitem']")?.focus({ preventScroll: true });
}

function dropdownCloseDelay() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--t-dropdown-close-dur").trim();
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 160;
  return raw.endsWith("ms") ? value : value * 1000;
}

function optionLabel(option) {
  return option?.textContent?.trim()?.replace(/\s+/g, " ") || "";
}

function selectDisplayLabel(select) {
  return optionLabel(select.selectedOptions?.[0]) || optionLabel(select.options?.[0]) || "Select";
}

function syncEnhancedSelect(select) {
  const wrapper = select.closest(".select-enhanced");
  if (!wrapper) return;
  const label = wrapper.querySelector(".select-label");
  const button = wrapper.querySelector(".select-button");
  if (label) label.textContent = selectDisplayLabel(select);
  if (button) button.title = selectDisplayLabel(select);
  wrapper.querySelectorAll(".select-option").forEach((optionButton) => {
    const selected = optionButton.dataset.value === select.value;
    const option = [...select.options].find((item) => item.value === optionButton.dataset.value);
    const optionLabelElement = optionButton.querySelector(".select-option-label");
    if (option && optionLabelElement && !optionButton.classList.contains("is-editing")) {
      optionLabelElement.textContent = optionLabel(option);
    }
    optionButton.setAttribute("aria-selected", selected ? "true" : "false");
    optionButton.tabIndex = selected ? 0 : -1;
  });
}

function closeEnhancedSelect(wrapper, immediate = false) {
  if (!wrapper) return;
  const menu = wrapper.querySelector(".select-menu");
  const button = wrapper.querySelector(".select-button");
  wrapper.classList.remove("is-open");
  button?.setAttribute("aria-expanded", "false");
  if (!menu) return;
  window.clearTimeout(Number(wrapper.dataset.closeTimer || 0));
  menu.classList.remove("is-open");
  if (immediate) {
    menu.classList.remove("is-closing");
    menu.hidden = true;
    return;
  }
  menu.classList.add("is-closing");
  wrapper.dataset.closeTimer = String(window.setTimeout(() => {
    if (!wrapper.classList.contains("is-open")) {
      menu.hidden = true;
      menu.classList.remove("is-closing");
    }
  }, dropdownCloseDelay()));
}

function closeAllEnhancedSelects(except = null) {
  document.querySelectorAll(".select-enhanced.is-open").forEach((wrapper) => {
    if (wrapper !== except) closeEnhancedSelect(wrapper);
  });
}

function openEnhancedSelect(wrapper) {
  const menu = wrapper.querySelector(".select-menu");
  const button = wrapper.querySelector(".select-button");
  if (!menu) return;
  closeAllEnhancedSelects(wrapper);
  const buttonRect = button?.getBoundingClientRect();
  const menuHeight = Math.min(260, window.innerHeight * 0.48);
  const opensUp = Boolean(buttonRect && buttonRect.top > menuHeight && buttonRect.bottom + menuHeight + 12 > window.innerHeight);
  wrapper.dataset.beuiPlacement = opensUp ? "top" : "bottom";
  window.clearTimeout(Number(wrapper.dataset.closeTimer || 0));
  wrapper.classList.add("is-open");
  button?.setAttribute("aria-expanded", "true");
  menu.hidden = false;
  menu.classList.remove("is-closing");
  requestAnimationFrame(() => menu.classList.add("is-open"));
}

function chooseEnhancedSelectOption(select, value) {
  if (select.value === value) {
    syncEnhancedSelect(select);
    return;
  }
  select.value = value;
  syncEnhancedSelect(select);
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function dealStatusSelectRenamable(select) {
  return select?.dataset?.renamable === "deal-status";
}

function syncDealStatusSelectLabels(select) {
  if (!dealStatusSelectRenamable(select)) return;
  [...select.options].forEach((option) => {
    option.textContent = dealStatusLabel(option.value);
  });
}

function beginEnhancedSelectOptionRename(select, optionValue, optionRow) {
  if (!dealStatusSelectRenamable(select)) return;
  const base = dealStatusBaseMeta(optionValue);
  optionRow.classList.add("is-editing");
  optionRow.innerHTML = "";
  const input = document.createElement("input");
  input.className = "select-option-edit-input";
  input.type = "text";
  input.value = dealStatusLabel(base.id);
  input.maxLength = 34;
  input.setAttribute("aria-label", `Rename ${base.label}`);
  const save = document.createElement("button");
  save.type = "button";
  save.className = "select-option-edit";
  save.title = "Save status name";
  save.setAttribute("aria-label", "Save status name");
  save.innerHTML = nucleoIcon("check-circle", 13);
  optionRow.appendChild(input);
  optionRow.appendChild(save);
  let finished = false;
  const finish = (saveChange = true) => {
    if (finished) return;
    finished = true;
    if (saveChange) renameDealStatusLabel(base.id, input.value);
    renderCurrentLoopView();
    renderRail();
  };
  input.addEventListener("click", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (!optionRow.contains(document.activeElement)) finish(true);
    }, 0);
  });
  save.addEventListener("mousedown", (event) => event.preventDefault());
  save.addEventListener("click", (event) => {
    event.stopPropagation();
    finish(true);
  });
  window.setTimeout(() => {
    input.focus({ preventScroll: true });
    input.select();
  }, 0);
}

function enhanceSelect(select) {
  if (!select || select.classList.contains("select-native") || select.closest(".select-enhanced")) return;
  syncDealStatusSelectLabels(select);
  const wrapper = document.createElement("div");
  // The app is a vanilla DOM surface, so this adapter keeps the native select
  // as the source of truth while matching the authenticated beUI Pro menu contract.
  wrapper.className = "select-enhanced beui-select";
  wrapper.dataset.beuiComponent = "select";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "select-button beui-select-trigger solvys-liquid-glass";
  button.id = `${select.id || "select"}-beui-trigger`;
  button.setAttribute("role", "combobox");
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", `${button.id}-listbox`);
  button.innerHTML = `
    <span class="select-label"></span>
    <svg class="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  `;
  const menu = document.createElement("div");
  menu.className = "select-menu beui-select-content solvys-liquid-glass-strong t-dropdown";
  menu.id = `${button.id}-listbox`;
  menu.hidden = true;
  menu.setAttribute("role", "listbox");
  [...select.options].forEach((option) => {
    const optionButton = document.createElement("div");
    optionButton.className = "select-option beui-select-item";
    optionButton.dataset.value = option.value;
    optionButton.setAttribute("role", "option");
    if (option.disabled) optionButton.setAttribute("aria-disabled", "true");
    const labelSpan = document.createElement("span");
    labelSpan.className = "select-option-label";
    labelSpan.textContent = optionLabel(option);
    optionButton.appendChild(labelSpan);
    if (dealStatusSelectRenamable(select)) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "select-option-edit";
      editButton.title = `Rename ${optionLabel(option)}`;
      editButton.setAttribute("aria-label", `Rename ${optionLabel(option)}`);
      editButton.innerHTML = nucleoIcon("pencil", 13);
      editButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        beginEnhancedSelectOptionRename(select, option.value, optionButton);
      });
      optionButton.appendChild(editButton);
    }
    const check = document.createElement("span");
    check.className = "select-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = "✓";
    optionButton.appendChild(check);
    optionButton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (option.disabled || optionButton.classList.contains("is-editing")) return;
      chooseEnhancedSelectOption(select, option.value);
      closeEnhancedSelect(wrapper);
      button.focus({ preventScroll: true });
    });
    optionButton.addEventListener("keydown", (event) => {
      if (option.disabled || optionButton.classList.contains("is-editing")) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseEnhancedSelectOption(select, option.value);
        closeEnhancedSelect(wrapper);
        button.focus({ preventScroll: true });
      }
    });
    menu.appendChild(optionButton);
  });
  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  wrapper.appendChild(button);
  wrapper.appendChild(menu);
  select.classList.add("select-native");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (wrapper.classList.contains("is-open")) closeEnhancedSelect(wrapper);
    else openEnhancedSelect(wrapper);
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEnhancedSelect(wrapper);
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
      event.preventDefault();
      openEnhancedSelect(wrapper);
      wrapper.querySelector('.select-option[aria-selected="true"]')?.focus({ preventScroll: true });
    }
  });
  menu.addEventListener("keydown", (event) => {
    const options = [...menu.querySelectorAll('.select-option:not([aria-disabled="true"])')];
    const index = options.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      closeEnhancedSelect(wrapper);
      button.focus({ preventScroll: true });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      options[Math.min(options.length - 1, index + 1)]?.focus({ preventScroll: true });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      options[Math.max(0, index - 1)]?.focus({ preventScroll: true });
    } else if (event.key === "Home") {
      event.preventDefault();
      options[0]?.focus({ preventScroll: true });
    } else if (event.key === "End") {
      event.preventDefault();
      options[options.length - 1]?.focus({ preventScroll: true });
    }
  });
  select.addEventListener("change", () => syncEnhancedSelect(select));
  syncEnhancedSelect(select);
}

function enhanceSelectMenus(root = document) {
  root.querySelectorAll("select").forEach(enhanceSelect);
}

function syncAllEnhancedSelects() {
  document.querySelectorAll("select.select-native").forEach(syncEnhancedSelect);
}

function routesForExport(route) {
  requireExportRoute(route);
  if (route === "pdf") return [];
  if (route === "podio-test") return ["podio"];
  if (route === "both") return ["google", "podio"];
  return [route];
}

function deliveredPodioTest(result) {
  return Boolean(result?.ok && (result.routes ?? []).some((route) => route.route === "podio" && route.mode === "live" && route.readbackOk));
}

async function chooseExportRoute(route, source = null, rowsOverride = null) {
  route = requireExportRoute(route);
  setExportMenuOpen(false);
  if (route === "queue") {
    state.exportRoute = "queue";
    const queueRows = Array.isArray(rowsOverride) && rowsOverride.length ? rowsOverride : rowsForBatchAction();
    addRowsToQueue(queueRows, source);
    syncBatchExportControls();
    return;
  }
  const meta = exportRouteMeta(route);
  if (!state.dossier) {
    document.getElementById("topStatus").textContent = "Load the latest lead packet before choosing an export route.";
    document.getElementById("statusExport").textContent = "export: [WAITING]";
    return;
  }
  state.exportRoute = route;
  state.exportResult = null;
  const isControlledTest = Boolean(meta.controlledTest);
  const batchRows = Array.isArray(rowsOverride) && rowsOverride.length ? rowsOverride : rowsForBatchAction();
  const stoppedRow = !isControlledTest ? batchRows.find((row) => canonicalStopReasonsForRow(row).length > 0) : null;
  if (stoppedRow) {
    const message = canonicalStopBlocker(stoppedRow, "Packet or handoff export");
    nudgeDeniedAction(source, "Export blocked by stop rule", `${docPrepEstateLabel(stoppedRow)}: ${message}`, { pill: true, source: "packet-export" });
    document.getElementById("topStatus").textContent = message;
    addShellEvent("Packet or handoff export blocked", message, "blocked", true);
    return;
  }
  if (!isControlledTest && batchRows.some((row) => isDemoEstateImport(row))) {
    nudgeDeniedAction(source, "Export blocked", "Sample estates stay isolated from production exports. Select an imported or fetched estate.", { pill: true, source: "packet-export" });
    return;
  }
  const packetDossiers = batchRows.map((row) => dossierForRow(row)).filter(Boolean);
  if (!isControlledTest && packetDossiers.length !== batchRows.length) {
    nudgeDeniedAction(source, "Export blocked", "Every selected estate needs a loaded Discovery dossier before one combined PDF can be generated.", { pill: true, source: "packet-export" });
    return;
  }
  if (!isControlledTest && state.activeDocPrepFlow === "closing-docs") {
    const blockedRow = batchRows.find((row) => selectedClosingBlockers(row, dossierForRow(row)).length > 0);
    if (blockedRow) {
      const blockers = selectedClosingBlockers(blockedRow, dossierForRow(blockedRow));
      nudgeDeniedAction(source, "Closing batch blocked", `${docPrepEstateLabel(blockedRow)}: ${blockers[0]?.label || "choose forms and resolve required fields"}.`, { pill: true, source: "packet-export" });
      return;
    }
  }
  const checkedCount = batchRows.length;
  const isBatch = checkedCount > 1 && !isControlledTest;
  const nextPacketRevisions = isControlledTest
    ? []
    : batchRows.map((row) => currentPacketRevision(row, state.activeDocPrepFlow) + 1);
  const packetRevision = nextPacketRevisions[0];
  if (!isControlledTest && (!Number.isInteger(packetRevision) || packetRevision < 1)) {
    const message = "The selected estate's next packet revision is unavailable. Review its packet history and try again.";
    nudgeDeniedAction(source, "Packet generation blocked", message, { pill: true, source: "packet-export" });
    document.getElementById("topStatus").textContent = message;
    addShellEvent("Packet generation blocked", message, "blocked", true);
    return;
  }
  if (isBatch && new Set(nextPacketRevisions).size !== 1) {
    const message = "Selected estates are on different packet revisions. Generate them separately, or bring their packet histories into alignment before creating one combined PDF.";
    nudgeDeniedAction(source, "Batch generation blocked", message, { pill: true, source: "packet-export" });
    document.getElementById("topStatus").textContent = message;
    addShellEvent("Batch generation blocked", message, "blocked", true);
    return;
  }
  const batchCopy = isBatch
    ? ` Preparing a ${checkedCount}-lead Doc Prep batch now. No live CRM card, Google Doc, Google Sheet row, email, or SMS will be created from this review surface.`
    : " Preparing a review-only Doc Prep package now. No live CRM card will be created from this review surface.";
  state.railPreview = {
    title: isBatch ? `${meta.title} Batch` : meta.title,
    markdown: isControlledTest
      ? `${meta.copy} This uses an approved sample lead, not the loaded lead packet.`
      : `${meta.copy}${batchCopy}`,
    updatedAt: Date.now()
  };
  openReportRailForHandoff(source, "docs");
  document.getElementById("statusExport").textContent = meta.status;
  document.getElementById("topStatus").textContent = isControlledTest
    ? "Checking Podio with an approved sample Lead card..."
    : isBatch
      ? `Preparing ${checkedCount} selected leads for ${meta.label} batch export review...`
      : `Preparing completed report export for ${meta.label}...`;
  try {
    const response = await fetch("/api/exports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        routes: routesForExport(route),
        dryRun: meta.dryRun === false ? false : true,
        controlledTest: isControlledTest,
        batch: isBatch,
        estateIds: batchRows.map((row) => assetDiscoveryKey(row)),
        dossiers: packetDossiers,
        flow: state.activeDocPrepFlow,
        ...(isControlledTest ? {} : { packetRevision }),
        ...(state.activeDocPrepFlow === "closing-docs" ? {
          selectedClosingTemplateIdsByEstate: Object.fromEntries(batchRows.map((row) => [assetDiscoveryKey(row), selectedClosingTemplateIds(row)])),
          closingFieldValuesByEstate: Object.fromEntries(batchRows.map((row) => [assetDiscoveryKey(row), state.closingFieldValues?.[assetDiscoveryKey(row)] || {}]))
        } : {}),
        expectedArtifact: "single_pdf",
        operatorIntent: "generate_packet",
      }),
    });
    let result = await response.json();
    if (!isControlledTest && result?.ok && result?.artifactUrl) {
      result = await verifyPacketArtifact(result, "", batchRows.map((row) => assetDiscoveryKey(row)));
    }
    state.exportResult = result;
    if (result?.ok && result?.artifactUrl) {
      batchRows.forEach((row) => {
        state.packetArtifacts[`${state.activeDocPrepFlow}:${row.id}`] = result;
      });
    }
    const blockers = (result.blockers ?? []).filter((blocker) => !/skipped in dry-run mode/i.test(blocker));
    const testDelivered = isControlledTest && deliveredPodioTest(result);
    if (testDelivered) {
      addShellEvent("Podio readiness check delivered", "An approved sample Lead card was created in Podio and read back successfully.", "ready", false);
    } else if (result.ok) {
      addShellEvent(exportSuccessActivityTitle(), exportSuccessActivityCopy(meta.label), "review", false);
    }
    state.railPreview = testDelivered
      ? {
          title: "Podio readiness check delivered",
          markdown: "An approved sample Lead card was created in Podio and read back successfully.",
          updatedAt: Date.now()
        }
      : result.ok
        ? {
            title: exportSuccessActivityTitle(),
            markdown: `${exportSuccessActivityCopy(meta.label)} Single PDF artifact: ${result.artifact?.url || "prepared by export route"}.`,
            updatedAt: Date.now()
          }
        : {
            title: `${meta.label} export blocked`,
            markdown: blockers.length
              ? blockers.map(operatorBlockerText).join(" ")
              : "Approval and readback proof are required before a live export.",
            updatedAt: Date.now()
          };
    document.getElementById("topStatus").textContent = testDelivered
      ? "Podio sample card delivered and readback confirmed."
      : result.ok
        ? isBatch
          ? `${checkedCount} selected leads prepared as one ${meta.label} batch PDF for review. Live writes and readback still need approval before any external record is created.`
          : `${meta.label} export prepared as one PDF for review. Live write and readback still need approval before any external record is created.`
        : blockers.length
          ? `${meta.label} export has ${blockers.length} blocker${blockers.length === 1 ? "" : "s"}.`
          : `${meta.label} export is blocked.`;
    document.getElementById("statusExport").textContent = testDelivered
      ? `${meta.status} [DELIVERED]`
      : result.ok ? `${meta.status} [PREPARED]` : `${meta.status} [BLOCKED]`;
    await loadConnectionStatuses();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    state.exportResult = {
      ok: false,
      blockers: [message],
      routes: [],
    };
    document.getElementById("topStatus").textContent = `Export blocked: ${message}`;
    document.getElementById("statusExport").textContent = `${meta.status} [BLOCKED]`;
  }
  renderShellPanels();
  renderRail();
}

function openUtilityRail(kind, source = null) {
  if (state.activeView === "dossiers") {
    state.railMode = "dossier";
    state.railOpen = true;
    renderRail();
    document.getElementById("topStatus").textContent = "Dossiers use the Dossier rail for document review. Estate Search opens the report rail.";
    addShellEvent("Report rail held", "Dossiers keeps the document packet in its specialized rail instead of opening the report rail.", "review", false);
    return;
  }
  if (state.activeView !== "find-estates") {
    document.querySelector('[data-shell-nav="find-estates"]')?.click();
  }
  if (kind === "report") {
    const origin = source || document.getElementById("quickReport");
    state.railPreview = {
      title: "Lead report",
      markdown: "Review the report preview and fill missing sections before outreach.",
      updatedAt: Date.now()
    };
    document.getElementById("statusExport").textContent = "export: [REPORT VIEW]";
    openRailWithContinuity(origin, "docs");
    return;
  }
  openRailWithContinuity(source);
}

function wireEvents() {
  enhanceSelectMenus();
  wireBeuiMenuKeyboard();
  if (!window.__heirrightBeuiSelectObserver) {
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches?.("select")) enhanceSelect(node);
          node.querySelectorAll?.("select").forEach(enhanceSelect);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.__heirrightBeuiSelectObserver = observer;
  }
  document.getElementById("sidebarToggle").addEventListener("click", () => {
    const workspace = document.getElementById("workspace");
    if (workspace.classList.contains("is-auto-collapsed")) return;
    workspace.classList.toggle("is-collapsed");
    syncSidebarState();
  });
  document.getElementById("accountChip")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setAccountMenuOpen(!state.accountMenuOpen);
  });
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.addEventListener("click", () => applyTheme(button.dataset.themeOption));
  });
  systemThemeQuery.addEventListener("change", () => {
    if (document.body.dataset.themeMode === "system") applyTheme("system", false);
  });
  const filterWidthToggle = document.getElementById("filterWidthToggle");
  if (filterWidthToggle) {
    filterWidthToggle.addEventListener("click", () => {
      setFilterCollapsed(!state.filterCollapsed);
    });
  }
  document.querySelectorAll("[data-shell-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-shell-nav]").forEach((item) => {
        const isSelected = item === button;
        item.classList.toggle("is-active", isSelected);
      });
      const label = button.textContent.trim();
      setActiveShellView(button.dataset.shellNav, label);
    });
  });
  document.querySelectorAll("[data-open-estate-files]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openCrmImportModal();
    });
  });
  window.addEventListener("heirright:open-estate-files", () => openCrmImportModal());
  document.getElementById("refresh")?.addEventListener("click", loadRun);
  document.getElementById("freshBatch").addEventListener("click", (event) => pullFreshBatch(event.currentTarget));
  document.getElementById("sourceQuery").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      pullFreshBatch(document.getElementById("freshBatch"));
    }
  });
  document.getElementById("sourceModeFilter").addEventListener("change", () => {
    const mode = document.getElementById("sourceModeFilter").value;
    const query = document.getElementById("sourceQuery");
    query.placeholder = mode === "address" ? "552 SW 2 ST" : mode === "folio" ? "0102020001080" : "EST OF";
    clearFreshBatchStatus();
  });
  document.getElementById("footerBack").addEventListener("click", () => window.history.back());
  document.getElementById("footerForward").addEventListener("click", () => window.history.forward());
  document.getElementById("agentDrawerToggle").addEventListener("click", () => {
    setHistoryRailOpen(false);
    setActivityOpen(!state.activityOpen);
  });
  document.getElementById("closeAgentDrawer").addEventListener("click", () => setActivityOpen(false));
  document.getElementById("historyToggle")?.addEventListener("click", () => setHistoryRailOpen(!state.historyRailOpen));
  document.getElementById("closeHistoryRail")?.addEventListener("click", () => setHistoryRailOpen(false));
  document.getElementById("tableFiltersToggle")?.addEventListener("click", (event) => {
    event.stopPropagation();
    setFilterPopoverOpen(!state.filterPopoverOpen);
  });
  document.getElementById("globalSearch")?.addEventListener("focus", () => setSearchPopupOpen(Boolean(document.getElementById("globalSearch")?.value.trim())));
  document.getElementById("globalSearch")?.addEventListener("input", () => {
    state.historyProspectIds = null;
    state.searchPopupOpen = true;
    applyFilters();
  });
  document.getElementById("railContextCopy").addEventListener("click", (event) => {
    if (event.target.id === "railRenameInput") return;
    if (state.railMode === "dossier") return;
    if (state.railRenaming) return;
    startRailRename();
  });
  document.getElementById("railContextCopy").addEventListener("keydown", (event) => {
    if (event.target.id === "railRenameInput" || state.railRenaming) return;
    if (state.railMode === "dossier") return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startRailRename();
    }
  });
  document.getElementById("railRenameInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      finishRailRename(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishRailRename(false);
    }
  });
  document.getElementById("railRenameInput").addEventListener("blur", () => finishRailRename(true));
  document.getElementById("commandForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("commandInput");
    const value = input.value.trim();
    runShellCommand(value || "note", event.submitter, value);
    input.value = "";
  });
  document.querySelectorAll("[data-shell-command]").forEach((button) => {
    button.addEventListener("click", () => runShellCommand(button.dataset.shellCommand, button));
  });
  document.querySelectorAll("[data-list-control]").forEach((button) => {
    button.addEventListener("click", () => runFloatingListControl(button.dataset.listControl, button));
  });
  document.getElementById("signalWeight").addEventListener("input", (event) => {
    state.shellSettings.signalWeight = event.target.value;
    syncShellSettings();
  });
  document.getElementById("signalWeight").addEventListener("change", () => persistShellSettings("Source signal weight updated"));
  document.getElementById("taxThreshold").addEventListener("change", (event) => {
    state.shellSettings.taxThreshold = event.target.value;
    persistShellSettings("Tax pressure threshold updated");
  });
  document.getElementById("reasonCodes").addEventListener("change", (event) => {
    state.shellSettings.reasonCodes = event.target.value;
    persistShellSettings("Reason-code set updated");
  });
  document.getElementById("deedProofRequired").addEventListener("change", (event) => {
    state.shellSettings.deedProofRequired = event.target.checked;
    persistShellSettings("Deed proof gate updated");
  });
  document.getElementById("paidSourceApproval").addEventListener("change", (event) => {
    state.shellSettings.paidSourceApproval = event.target.checked;
    persistShellSettings("Paid-source approval gate updated");
  });
  document.getElementById("estateArchiveToggle")?.addEventListener("click", () => {
    setEstateArchiveMode(!state.showArchivedEstates);
  });
  document.getElementById("exportToggle").addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = document.getElementById("exportMenu").dataset.open === "true";
    setExportMenuOpen(!isOpen);
  });
  document.getElementById("exportMenu").addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-export-route]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    chooseExportRoute(button.dataset.exportRoute, button);
  });
  document.addEventListener("click", (event) => {
    if (!document.getElementById("accountMenu")?.contains(event.target) && !document.getElementById("accountChip")?.contains(event.target)) {
      setAccountMenuOpen(false);
    }
    const docPrepTrigger = event.target.closest?.("[data-open-docprep-row]");
    if (docPrepTrigger && document.getElementById("dossiersView")?.contains(docPrepTrigger)) {
      if (!docPrepTrigger.matches?.("button") && event.target.closest?.("input, label")) return;
      event.preventDefault();
      openDocPrepRow(docPrepTrigger.dataset.openDocprepRow, docPrepTrigger.dataset.openDocprepFlow);
      return;
    }
    const reportTrigger = event.target.closest?.('[data-rail-action="report"]');
    if (reportTrigger) {
      event.preventDefault();
      openUtilityRail("report", reportTrigger);
      return;
    }
    const outreachButton = event.target.closest?.("[data-template-edit], [data-template-ready], [data-template-approve], [data-template-sync], [data-template-send-blocked], [data-template-archive], [data-template-restore], [data-template-delete]");
    if (outreachButton && handleOutreachTemplateAction(outreachButton)) {
      event.preventDefault();
      return;
    }
    closeAllEnhancedSelects(event.target.closest?.(".select-enhanced"));
    const suppressRailOutsideClose = state.railResizing || state.suppressRailOutsideCloseOnce || Date.now() < state.suppressRailOutsideCloseUntil;
    if (suppressRailOutsideClose) state.suppressRailOutsideCloseOnce = false;
    if (!document.getElementById("exportMenu").contains(event.target)) {
      setExportMenuOpen(false);
    }
    if (!document.getElementById("tableFiltersPopover")?.contains(event.target) && !document.getElementById("tableFiltersToggle")?.contains(event.target)) {
      setFilterPopoverOpen(false);
    }
    if (!document.getElementById("searchPopup")?.contains(event.target) && !document.querySelector(".search-control")?.contains(event.target)) {
      setSearchPopupOpen(false);
    }
  });
  document.getElementById("closeRail").addEventListener("click", () => {
    setRailOpen(false);
    if (state.activeView === "find-estates") setDetailRailOpen(true);
  });
  document.getElementById("walkthroughReplay")?.addEventListener("click", () => openWalkthrough(0));
  ["countyFilter", "leadTypeFilter", "statusFilter", "evidenceFilter", "missingFilter", "priorityOnly"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      state.historyProspectIds = null;
      applyFilters();
    });
    document.getElementById(id).addEventListener("change", () => {
      state.historyProspectIds = null;
      applyFilters();
    });
  });
  document.querySelectorAll("[data-column-toggle]").forEach((toggle) => {
    toggle.addEventListener("change", () => {
      document.querySelectorAll(`[data-column-toggle="${toggle.dataset.columnToggle}"]`).forEach((other) => {
        other.checked = toggle.checked;
      });
      applyColumnVisibility();
      renderTableFiltersPopover();
    });
  });
  document.querySelectorAll("[data-rail-tab]").forEach((button) => {
    button.addEventListener("click", () => setRailTab(button.dataset.railTab));
  });
  document.addEventListener("keydown", (event) => {
    const activeTag = document.activeElement?.tagName;
    const typing = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT" || document.activeElement?.isContentEditable;
    if (event.key === "Escape") {
      closeAllEnhancedSelects();
      setExportMenuOpen(false);
      setFilterPopoverOpen(false);
      setSearchPopupOpen(false);
      setHistoryRailOpen(false);
      setActivityOpen(false);
      setAccountMenuOpen(false);
      closeWalkthrough(false);
      if (state.crmImportModal.open) closeCrmImportModal();
      if (state.documentActionModal.open) closeDocumentActionModal();
    }
    if (!typing && state.activeView === "dossiers" && state.railMode === "dossier" && event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      if (cycleDocPrepStreamSection(event.key === "ArrowDown" ? 1 : -1)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    if (event.key === "/" && !typing) {
      event.preventDefault();
      document.getElementById("globalSearch").focus();
    }
  });
  window.addEventListener("resize", () => {
    syncSidebarState();
    applyFilterWidth();
    state.railWidth = clampRailWidth(state.railWidth);
    setRailOpen(state.railOpen);
    positionTableFiltersPopover();
    positionWalkthrough();
  });
  // Capture phase so scrolls inside nested panels keep the tip on its target.
  window.addEventListener("scroll", positionWalkthrough, { capture: true, passive: true });
  syncSidebarState();
  wireRailResize();
  wireFilterResize();
}

function wireRailResize() {
  const handle = document.getElementById("railResizer");
  let startX = 0;
  let startWidth = state.railWidth;
  function resize(event) {
    state.railWidth = clampRailWidth(startWidth + startX - event.clientX);
    storageSetItem(railWidthKey, String(state.railWidth));
    setRailOpen(true);
  }
  function stopResize() {
    state.railResizing = false;
    state.suppressRailOutsideCloseOnce = true;
    state.suppressRailOutsideCloseUntil = Date.now() + 900;
    if (state.activeRailPointerId !== undefined) {
      try { handle.releasePointerCapture(state.activeRailPointerId); } catch (error) {}
      state.activeRailPointerId = undefined;
    }
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", resize);
    window.removeEventListener("pointerup", stopResize);
  }
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.railResizing = true;
    state.suppressRailOutsideCloseOnce = true;
    state.suppressRailOutsideCloseUntil = Date.now() + 250;
    state.activeRailPointerId = event.pointerId;
    try { handle.setPointerCapture(event.pointerId); } catch (error) {}
    startX = event.clientX;
    startWidth = state.railWidth;
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
  });
}

function wireFilterResize() {
  const handle = document.getElementById("filterResizer");
  if (!handle) return;
  let startX = 0;
  let startWidth = state.filterWidth;
  function resize(event) {
    const nextWidth = startWidth + event.clientX - startX;
    if (nextWidth <= filterCollapseThreshold) {
      setFilterCollapsed(true);
      return;
    }
    state.filterCollapsed = false;
    storageSetItem(filterCollapsedKey, "false");
    state.filterWidth = clampFilterWidth(nextWidth);
    storageSetItem(filterWidthKey, String(state.filterWidth));
    applyFilterWidth();
  }
  function stopResize() {
    document.body.style.userSelect = "";
    window.removeEventListener("pointermove", resize);
    window.removeEventListener("pointerup", stopResize);
  }
  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startX = event.clientX;
    startWidth = state.filterWidth;
    setFilterCollapsed(false);
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", resize);
    window.addEventListener("pointerup", stopResize, { once: true });
  });
  handle.addEventListener("dblclick", () => {
    state.filterWidth = 320;
    state.filterCollapsed = false;
    storageSetItem(filterCollapsedKey, "false");
    storageSetItem(filterWidthKey, String(state.filterWidth));
    applyFilterWidth();
  });
}

const legacySubscribers = new Set();
const beuiDocPrepActions = new Set();

function freezePublicValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezePublicValue);
  return Object.freeze(value);
}

function hasReviewedEvidenceValue(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return Boolean(text && !/\b(?:needs? review|unknown|missing|unavailable|not available|blocked|not attached)\b/i.test(text));
}

function publicEstateEvidenceGroups(row) {
  if (!row) return { property: false, deed: false, tax: false, probate: false, heirs: false };
  const capture = sourceCaptureForRow(row);
  const probateReference = capture.probate?.caseNumber || capture.probate?.docketNumber;
  const probateSource = capture.probate?.docketUrl || capture.probate?.sourceUrl;
  const probateReview = capture.probate?.caseStatus
    || capture.probate?.status;
  const deedReference = capture.deed?.sourceUrl
    || capture.deed?.documentUrl
    || capture.deed?.fileName;
  const deedIdentifier = capture.deed?.instrument
    || capture.deed?.instrumentNumber
    || [capture.deed?.book, capture.deed?.page].filter(Boolean).join("/");
  const taxReference = capture.taxReceipt?.receiptLink || capture.taxReceipt?.sourceUrl;
  const taxStatus = capture.taxReceipt?.status;
  const obituaryReviewed = capture.obituary?.status === "reviewed-not-found"
    || Boolean(capture.obituary?.sourceUrl || capture.obituary?.fileName);
  const reviewedHeir = acceptedContactCandidates(row).some((candidate) => (
    hasReviewedEvidenceValue(candidate?.name)
    && /\b(?:spouse|wife|husband|child|son|daughter|heir|representative|executor|administrator|parent|mother|father|sibling|brother|sister|relative)\b/i.test(String(candidate?.relationship || ""))
  ));
  return {
    property: propertyAppraiserEvidenceComplete(row),
    deed: [
      deedReference,
      deedIdentifier,
      capture.deed?.lastSaleDate,
      capture.deed?.grantor,
      capture.deed?.grantee,
      capture.deed?.adversePossessionSignal,
    ].every(hasReviewedEvidenceValue),
    tax: [
      capture.taxReceipt?.listingUrl,
      taxReference,
      capture.taxReceipt?.paidBy,
      capture.taxReceipt?.paidDate,
      capture.taxReceipt?.amountDue,
      capture.taxReceipt?.unpaidYears,
      capture.taxReceipt?.reassessment,
      taxStatus,
    ].every(hasReviewedEvidenceValue)
      && !["browser_workflow_required", "unavailable_after_listing_check"].includes(String(taxStatus || "")),
    probate: [
      probateReference,
      probateSource,
      probateReview,
      capture.probate?.documentAvailability,
      capture.probate?.affidavitOfHeirsStatus,
    ].every(hasReviewedEvidenceValue),
    heirs: reviewedHeir && obituaryReviewed,
  };
}

function publicDiscoveryPreview(row, dossier, workflow) {
  if (!row || state.activeView !== "dossiers" || row.id !== state.selectedId) return null;
  const report = dossier?.completedLeadReport ?? {};
  const math = report?.offerMath ?? {};
  const live = workflow?.state !== "queued";
  const claim = (value, fallback = "") => live ? claimValue(value, fallback) : fallback;
  const money = (value) => live ? moneyClaimValue(value, "") : "";
  const percent = (value) => live ? percentClaimValue(value, "") : "";
  const count = (value) => live ? countClaimValue(value, "") : "";
  const dateAdded = live ? formatPacketDate(dossier?.generatedAt || row.importedAt || row.updatedAt) : "";
  const title = cleanDisplayValue(
    dossier?.summary?.estateName
      || dossier?.property?.estateName?.value
      || row.leadName
      || row.title
      || row.owner
      || "Estate file",
  );
  const offerValues = {
    "As-Is Value": ["", money(math.asIsValue)],
    "Taxes Due": ["", money(math.taxesDue)],
    "Liens": ["", money(math.liens)],
    "Mortgages": ["", money(math.mortgages)],
    "Selling Costs": ["", money(math.sellingCosts)],
    "Probate Costs": ["", money(math.probateCosts)],
    "Partition Costs": ["", money(math.partitionCosts)],
    "Post Equity Value": ["", money(math.postEquityValue)],
    "Amount per heir $$": ["", money(math.equityPerHeir)],
    "# of heirs on board": ["", count(math.heirCount)],
    "Profit": ["", money(math.profit)],
    "Offer per heir": [percent(math.buyPercentage), money(math.offerAmount)],
    "Min Profit": ["", money(math.minimumNetProfit)],
  };
  const offerRow = (label, tone = "normal") => {
    const values = offerValues[label] ?? ["", ""];
    return { label, percentage: values[0], total: values[1], tone };
  };
  const offerRows = [
    offerRow("As-Is Value"),
    offerRow("Taxes Due"),
    offerRow("Liens"),
    offerRow("Mortgages"),
    offerRow("Selling Costs"),
    offerRow("Probate Costs"),
    offerRow("Partition Costs"),
    offerRow("Post Equity Value"),
    offerRow("Amount per heir $$"),
    offerRow("# of heirs on board"),
    offerRow("Profit"),
    offerRow("Offer per heir"),
    offerRow(""),
    offerRow(""),
    offerRow(""),
    offerRow("Min Profit", "blue"),
    offerRow("$100,000 Net", "yellow"),
    offerRow("", "yellow"),
    offerRow("", "yellow"),
  ];
  const rawContacts = live && Array.isArray(report.contactPlaceholders) && report.contactPlaceholders.length
    ? report.contactPlaceholders
    : live && Array.isArray(dossier?.familyTree?.hypothesis?.value?.nodes)
      ? dossier.familyTree.hypothesis.value.nodes
      : [];
  const contacts = rawContacts.slice(0, 18).map((contact, index) => {
    const addressHistory = Array.isArray(contact?.addressHistory)
      ? contact.addressHistory
      : Array.isArray(contact?.addresses)
        ? contact.addresses.map((address) => ({ address }))
        : [];
    return {
      name: cleanDisplayValue(contact?.name || ""),
      relationship: cleanDisplayValue([displayStatus(contact?.role, "Heir/contact review"), contact?.interest].filter(Boolean).join(" - ")),
      age: cleanDisplayValue(contact?.age || ""),
      likelyCurrentAddress: cleanDisplayValue(contact?.likelyCurrentAddress || contact?.address || ""),
      addressHistory: addressHistory.slice(0, 4).map((item) => ({
        address: cleanDisplayValue(item?.address || item?.value || ""),
        dates: cleanDisplayValue(item?.dates || item?.dateRange || ""),
      })),
      phones: (Array.isArray(contact?.phones) ? contact.phones : []).slice(0, 4).map(cleanDisplayValue),
      emails: (Array.isArray(contact?.emails) ? contact.emails : []).slice(0, 4).map(cleanDisplayValue),
    };
  });
  const previewUrl = (...values) => values.map((value) => {
    const candidate = typeof value === "object" && value ? value.value : value;
    const text = String(candidate || "").trim();
    if (!text) return "";
    if (text.startsWith("/") && !text.startsWith("//")) return text;
    try {
      const parsed = new URL(text, globalThis.location?.origin || window.location.origin);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
      return "";
    }
  }).find(Boolean) || "";
  const sourceLinks = Array.isArray(report.sourceLinks) ? report.sourceLinks : [];
  const linkFor = (pattern) => sourceLinks.find((link) => pattern.test(String(link?.label || "")))?.url || "";
  const capture = sourceCaptureForRow(row) || {};
  const propertyTaxUrl = previewUrl(
    linkFor(/property tax|property appraiser|parcel/i),
    dossier?.property?.officialParcelUrl,
    dossier?.property?.parcelUrl,
    capture.propertyAppraiser?.sourceUrl,
    capture.propertyAppraiser?.officialParcelUrl,
  );
  const taxReceiptUrl = previewUrl(
    linkFor(/tax receipt|receipt copy/i),
    dossier?.taxHistory?.receiptLink,
    capture.taxReceipt?.receiptLink,
    capture.taxReceipt?.sourceUrl,
  );
  const obituaryUrl = previewUrl(
    linkFor(/obituar/i),
    dossier?.marriageDeathIndicators?.obituaryLink,
    capture.obituary?.sourceUrl,
  );
  return {
    state: live ? "live" : "template",
    workflowState: workflow?.state || "queued",
    title,
    dateAdded: dateAdded === "Needs review" ? "" : dateAdded,
    propertyAddress: cleanDisplayValue(row.address || claim(dossier?.property?.address)),
    sourceLink: live ? propertyTaxUrl : "",
    propertyTaxUrl: live ? propertyTaxUrl : "",
    taxReceiptUrl: live ? taxReceiptUrl : "",
    obituaryUrl: live ? obituaryUrl : "",
    owner: claim(dossier?.property?.ownerName),
    folio: claim(dossier?.property?.parcelId),
    deedOrBookPage: claim(dossier?.deedHistory?.orBookPage),
    taxReview: claim(dossier?.taxHistory?.sourceStatus),
    probateReview: claim(dossier?.probateDocket?.sourceStatus),
    contactEnrichment: live
      ? contacts.length ? contacts.length + " contact review row" + (contacts.length === 1 ? "" : "s") : "Contact enrichment still needs review."
      : "",
    dateOfBirth: claim(dossier?.marriageDeathIndicators?.dateOfBirth),
    dateOfDeath: claim(dossier?.marriageDeathIndicators?.dateOfDeath),
    obituary: live && obituaryUrl ? "View source" : "",
    backStory: live ? cleanDisplayValue(report.backstory || dossier?.narrative || "") : "",
    contacts,
    offerRows,
  };
}

function publicEstateRow(row) {
  if (!row) return null;
  const dossier = dossierForRow(row);
  const capture = sourceCaptureForRow(row);
  const ownerTypeFact = [
    ...(Array.isArray(capture?.sourceFacts) ? capture.sourceFacts : []),
    ...rowSourceFacts(row),
  ].find((fact) => /^owner[_\s-]*type$/i.test(sourceFactType(fact)));
  const stopReasonCodes = [...new Set((dossier?.workflow?.rules || [])
    .filter((rule) => rule?.status === "stop")
    .flatMap((rule) => Array.isArray(rule.reasonCodes) ? rule.reasonCodes : [])
    .map(String)
    .filter((code) => ["COMPANY_OWNER", "RECENT_SALE_WITHIN_5_YEARS"].includes(code)))];
  const lastSaleValue = capture?.deed?.lastSaleDate || dossier?.deedHistory?.lastSaleDate?.value || "";
  const parsedLastSale = Date.parse(String(lastSaleValue || ""));
  const recentSaleWithinFiveYears = Number.isFinite(parsedLastSale)
    && parsedLastSale <= Date.now()
    && Date.now() - parsedLastSale <= 5 * 365.25 * 24 * 60 * 60 * 1000;
  const workflow = estateWorkflowForRow(row);
  const idiConnection = connectionByName("IDI Core");
  const idiReportReady = idiImportReadyForDocPrep(row);
  const verifiedIdiArtifactId = idiReportReady
    ? cleanDisplayValue(idiImportForRow(row)?.attachment?.artifactId || "").slice(0, 240)
    : "";
  const caseReference = [capture?.probate?.caseNumber, capture?.probate?.docketNumber]
    .map((value) => cleanDisplayValue(value).slice(0, 160))
    .find(hasReviewedEvidenceValue) || "";
  const idiApiAvailable = Boolean(idiConnection?.api?.endpointConfigured && idiConnection?.api?.sharedDefaultConfigured);
  return {
    id: String(row.id || ""),
    title: cleanDisplayValue(row.leadName || row.title || row.owner || "Estate file"),
    owner: cleanDisplayValue(row.owner || row.title || "Needs review"),
    ownerType: sourceFactValue(ownerTypeFact),
    address: cleanDisplayValue(row.address || "Address needs review"),
    county: cleanDisplayValue(row.county || "County needs review"),
    parcel: cleanDisplayValue(row.parcel || "Folio needs review"),
    score: Number(row.score || 0),
    evidence: Number(row.evidence || 0),
    evidenceTotal: Number(row.evidenceTotal || 0),
    status: displayStatus(row.status || "review"),
    tone: String(row.tone || "review"),
    nextAction: cleanDisplayValue(row.next || "Review the estate file"),
    classification: cleanDisplayValue(row.classification || "Needs review"),
    disposition: cleanDisplayValue(row.disposition || ""),
    leadType: cleanDisplayValue(row.leadType || row.sourceKind || "Estate lead"),
    missingTypes: Array.isArray(row.missing)
      ? row.missing.map((item) => cleanDisplayValue(item?.type || "")).filter(Boolean)
      : [],
    source: cleanDisplayValue(row.sourceProvider || row.sourceKind || "HeirRight packet"),
    evidenceGroups: publicEstateEvidenceGroups(row),
    stopReasonCodes,
    recentSaleWithinFiveYears,
    selected: row.id === state.selectedId,
    queued: state.queueIds.has(row.id),
    workflowState: workflow.state,
    workflowLabel: workflow.label,
    workflowBlocker: workflow.blocker,
    workflowBlockerStage: workflow.blockerStage,
    workflowStages: workflow.stages,
    exportEligible: workflow.exportEligible,
    workflowArtifact: workflow.artifact,
    handoff: workflow.handoff,
    exportedAt: workflow.exportedAt,
    idiReportReady,
    sourceFileReferences: verifiedIdiArtifactId ? [verifiedIdiArtifactId] : [],
    ...(caseReference ? { caseReference } : {}),
    idiApiAvailable,
    idiReportStatus: idiReportReady ? "IDI report verified" : idiApiAvailable ? "IDI report required" : "Manual IDI report required",
    idiReportStatusCopy: idiReportReady
      ? "The report passed storage and readback verification."
      : idiApiAvailable
        ? "No verified report is attached yet. Complete the approved IDI search or upload its PDF."
        : "IDI Core API access is unavailable here. Upload the approved IDI report PDF before running Doc Prep.",
    updatedAt: row.updatedAt || dossier?.updatedAt || workflow.updatedAt || "",
    packetApproved: Boolean(workflow.artifact && s40EnsurePacketArtifact(row) && currentPacketApproval(row, "discovery")),
    discoveryPreview: publicDiscoveryPreview(row, dossier, workflow),
  };
}

function evidenceStepForType(value = "") {
  const type = String(value || "").toLowerCase();
  if (/tax|receipt|reassessment/.test(type)) return "Tax History";
  if (/deed|title|mortgage|lien|official_record|ownership|sale/.test(type)) return "Deed & Title";
  if (/probate|court|docket|affidavit|case_/.test(type)) return "Probate";
  if (/obituar|death|birth|marriage|vital/.test(type)) return "Back Story";
  if (/contact|heir|family|relative/.test(type)) return "Heir Contact";
  if (/owner|property|parcel|folio|mailing|address/.test(type)) return "Estate Summary";
  return "Source Notes";
}

function publicEvidenceAttachments(row) {
  if (!row) return [];
  const dossier = dossierForRow(row);
  const capture = sourceCaptureForRow(row);
  const entries = new Map();
  const add = (input = {}) => {
    const href = String(input.href || input.sourceUrl || "").trim();
    const fileName = cleanDisplayValue(input.fileName || "");
    if (!href && !fileName) return;
    const key = href || `${input.label || "Evidence"}:${fileName}`;
    const existing = entries.get(key);
    const next = {
      id: cleanDisplayValue(input.id || `evidence-${entries.size + 1}`),
      label: cleanDisplayValue(input.label || fileName || "Source evidence"),
      source: cleanDisplayValue(input.source || "HeirRight Discovery"),
      step: cleanDisplayValue(input.step || evidenceStepForType(input.factType)),
      href,
      fileName,
      fileKind: cleanDisplayValue(input.fileKind || (href ? "link" : "file")),
      capturedAt: input.capturedAt || input.fetchedAt || "",
      reviewFlags: Array.isArray(input.reviewFlags) ? input.reviewFlags.map((flag) => cleanDisplayValue(flag)) : [],
      downloadable: Boolean(
        input.downloadable
        || /^\/api\/documents\/attachments\b/.test(href)
        || /\.(pdf|png|jpe?g|csv|json|txt)(?:$|[?#])/i.test(href)
        || ["pdf", "image", "csv", "json", "text"].includes(String(input.fileKind || "").toLowerCase())
      )
    };
    if (!existing || (!existing.href && next.href) || (!existing.fileName && next.fileName)) entries.set(key, next);
  };
  const sourceFacts = [
    ...(Array.isArray(dossier?.audit?.facts) ? dossier.audit.facts : []),
    ...(Array.isArray(capture?.sourceFacts) ? capture.sourceFacts : [])
  ];
  sourceFacts.forEach((fact, index) => add({
    id: fact?.id || `source-fact-${index + 1}`,
    label: fact?.attachment?.label || displayStatus(fact?.factType, "Source evidence"),
    source: displayStatus(fact?.source, "Discovery source"),
    step: evidenceStepForType(fact?.factType),
    factType: fact?.factType,
    href: fact?.attachment?.sourceUrl || fact?.sourceUrl,
    fileName: fact?.attachment?.fileName,
    fileKind: fact?.attachment?.fileKind,
    capturedAt: fact?.attachment?.capturedAt || fact?.fetchedAt,
    reviewFlags: [...(fact?.reviewFlags || []), ...(fact?.attachment?.reviewFlags || [])]
  }));
  (dossier?.completedLeadReport?.sourceLinks || []).forEach((link, index) => add({
    id: `report-source-${index + 1}`,
    label: link?.label,
    source: displayStatus(link?.source, "Completed lead report"),
    href: link?.url,
    fileKind: "link",
    step: evidenceStepForType(link?.label)
  }));
  [
    ["Property Appraiser record", capture?.propertyAppraiser?.sourceUrl, "property_appraiser", "Estate Summary"],
    ["Tax Collector listing page", capture?.taxReceipt?.listingUrl, "tax_collector", "Tax History"],
    ["Tax receipt", capture?.taxReceipt?.receiptLink || capture?.taxReceipt?.sourceUrl, "tax_collector", "Tax History"],
    ["Official Records search", capture?.deed?.sourceUrl, "official_records", "Deed & Title"],
    ["Recorded deed", capture?.deed?.documentUrl, "official_records", "Deed & Title"],
    ["Probate docket", capture?.probate?.docketUrl || capture?.probate?.sourceUrl, "probate_court", "Probate"],
    ["Obituary", capture?.obituary?.sourceUrl, "public obituary", "Back Story"]
  ].forEach(([label, href, source, step], index) => add({
    id: `capture-evidence-${index + 1}`,
    label,
    href,
    source,
    step,
    fileKind: /\.pdf(?:$|[?#])/i.test(String(href || "")) ? "pdf" : "link",
    capturedAt: capture?.updatedAt
  }));
  return [...entries.values()].sort((left, right) => {
    const byStep = left.step.localeCompare(right.step);
    return byStep || left.label.localeCompare(right.label);
  });
}

function publicDocumentRows(row) {
  if (!row) return [];
  const dossier = dossierForRow(row);
  const rows = docsForFlow(row, dossier, state.activeDocPrepFlow).map((doc, index) => {
    const workflow = dossierDocWorkflowState(doc, index);
    const file = documentFileRecord(doc.id, row);
    return {
      id: doc.id,
      title: cleanDisplayValue(doc.title),
      description: cleanDisplayValue(doc.copy),
      status: cleanDisplayValue(doc.status || workflow.label),
      workflowStatus: workflow.state,
      workflowLabel: workflow.label,
      source: cleanDisplayValue(doc.type || "Supporting document"),
      fileSource: file?.source === "supporting_document" ? "supporting_document" : file?.source === "verified_packet_artifact" ? "verified_packet_artifact" : "",
      updatedAt: Number(file?.linkedAt || docPrepDocumentActivityAt(row, state.activeDocPrepFlow) || 0),
      hasVerifiedFile: Boolean(file?.readbackStatus === "verified" && file?.artifactId && file?.artifactUrl && file?.contentHash),
      artifactId: String(file?.artifactId || ""),
      artifactUrl: String(file?.artifactUrl || ""),
      contentHash: String(file?.contentHash || ""),
      fileName: cleanDisplayValue(file?.name || ""),
      expiresAt: String(file?.expiresAt || ""),
      sectionIds: Array.isArray(file?.sectionIds) ? file.sectionIds.map(String) : [],
      selected: doc.id === state.selectedDossierDocId,
    };
  });
  if (state.activeDocPrepFlow !== "discovery") return rows;
  const idiImport = idiImportForRow(row);
  const idiFile = documentFileRecord("idi-asset-search", row);
  if (!idiImport && !idiFile) return rows;
  return [
    {
      id: "idi-asset-search",
      title: "IDI Core Report",
      description: "Operator-approved IDI report linked to this estate.",
      status: idiFile ? "Verified" : "Readback needed",
      workflowStatus: idiFile ? "complete" : "review",
      workflowLabel: idiFile ? "Verified" : "Needs review",
      source: "IDI Core upload",
      fileSource: "idi_report",
      updatedAt: Math.max(
        processActivityTime(idiFile?.linkedAt),
        processActivityTime(idiImport?.importedAt),
        processActivityTime(idiImport?.attachment?.capturedAt)
      ),
      hasVerifiedFile: Boolean(idiFile?.readbackStatus === "verified" && idiFile?.artifactId && idiFile?.artifactUrl && idiFile?.contentHash),
      artifactId: String(idiFile?.artifactId || ""),
      artifactUrl: String(idiFile?.artifactUrl || ""),
      contentHash: String(idiFile?.contentHash || ""),
      fileName: cleanDisplayValue(idiFile?.name || ""),
      expiresAt: String(idiFile?.expiresAt || ""),
      sectionIds: [],
      selected: state.selectedDossierDocId === "idi-asset-search",
    },
    ...rows,
  ];
}

function publicPacketHistory(row = selectedRow(), flowId = state.activeDocPrepFlow) {
  const flowState = existingDocPrepFlowState(row, flowId);
  const currentRevision = currentPacketRevision(row, flowId);
  return (flowState?.generatedPackets || []).slice(0, 25).map((packet, index) => ({
    packetRevision: Number.isInteger(Number(packet?.packetRevision)) && Number(packet.packetRevision) > 0
      ? Number(packet.packetRevision)
      : Math.max(1, currentRevision - index),
    artifactId: String(packet?.artifactId || ""),
    generatedAt: String(packet?.generatedAt || ""),
    generatedBy: cleanDisplayValue(packet?.generatedBy || "HeirRight operator"),
    correctionNote: normalizePacketCorrectionNote(packet?.correctionNote),
    readbackStatus: packet?.readbackStatus === "verified" ? "verified" : "review",
  }));
}

function packetMatchesCurrentVerifiedRevision(row, flowId, packet) {
  const current = existingDocPrepFlowState(row, flowId)?.generatedPackets?.[0];
  const artifactId = String(packet?.artifact?.artifactId || packet?.verification?.artifactId || "");
  return Boolean(
    packet?.verification?.verified
    && packet.verification.readbackStatus === "verified"
    && artifactId
    && current?.readbackStatus === "verified"
    && current.artifactId === artifactId
    && Number(current.packetRevision || 0) === currentPacketRevision(row, flowId)
  );
}

function publicPacketIsVerified(row, flowId, packet) {
  return packetMatchesCurrentVerifiedRevision(row, flowId, packet)
    && packetArtifactIsUnexpired(packet);
}

function packetArtifactExpiration(packet) {
  const expiresAt = packet?.artifact?.expiresAt || packet?.expiresAt;
  const parsed = Date.parse(String(expiresAt || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function packetArtifactIsUnexpired(packet, now = Date.now()) {
  const expiration = packetArtifactExpiration(packet);
  return expiration > Number(now);
}

function requireCurrentUnexpiredPacket(row, flowId, packet, actionLabel = "continuing") {
  if (!packetMatchesCurrentVerifiedRevision(row, flowId, packet)) {
    throw new Error("The current packet no longer matches the verified active revision. Run Document Prep again before continuing.");
  }
  if (!packetArtifactIsUnexpired(packet)) {
    throw new Error(`The current verified packet link expired before ${actionLabel}. Run Document Prep again to create a new verified packet.`);
  }
  return packet;
}

function publicPacketIsExpired(row, flowId, packet) {
  const expiration = packetArtifactExpiration(packet);
  return Boolean(
    packetMatchesCurrentVerifiedRevision(row, flowId, packet)
    && expiration > 0
    && expiration <= Date.now()
  );
}

function publicShellEvents(row) {
  const selectedEstateId = String(row?.id || "").trim();
  return state.shellEvents
    .filter((event) => event?.global === true || (selectedEstateId && String(event?.estateId || "") === selectedEstateId))
    .slice(0, 30)
    .map(clientFacingEvent)
    .map((event) => ({
      estateId: cleanDisplayValue(event.estateId || ""),
      global: event.global === true,
      actor: cleanDisplayValue(event.actor || "HeirRight team"),
      source: cleanDisplayValue(event.source || "HeirRight workspace"),
      title: cleanDisplayValue(event.title || "Update"),
      copy: cleanDisplayValue(event.copy || ""),
      tone: String(event.tone || "review"),
      updatedAt: Number(event.updatedAt || event.at || 0),
    }));
}

function legacyPublicSnapshot() {
  const row = selectedRow();
  const flow = docPrepFlow(state.activeDocPrepFlow);
  const phase = currentDiscoveryPhase(flow.id, row);
  const stream = docPrepStreamForRow(row, flow.id);
  const packet = packetArtifactForRow(row, flow.id);
  const workflow = estateWorkflowForRow(row);
  const rawAgenticModelStatus = state.agenticModelStatus || {};
  const verifiedFreeModels = [...new Set((Array.isArray(rawAgenticModelStatus.freeModels) ? rawAgenticModelStatus.freeModels : [])
    .map((model) => cleanDisplayValue(model))
    .filter((model) => model && model !== "dynamic-free-catalog"))];
  const modelValue = cleanDisplayValue(rawAgenticModelStatus.model || "");
  const publicAgenticModelStatus = {
    loaded: rawAgenticModelStatus.loaded === true,
    available: rawAgenticModelStatus.available === true && verifiedFreeModels.length > 0,
    provider: "nous",
    model: verifiedFreeModels.includes(modelValue) ? modelValue : null,
    route: ["dynamic-free-catalog", "configured-free-model", "unavailable"].includes(rawAgenticModelStatus.route)
      ? rawAgenticModelStatus.route
      : "unavailable",
  };
  const publicAgenticModelPreference = state.agenticModelPreference === "dynamic-free-catalog"
    || verifiedFreeModels.includes(state.agenticModelPreference)
    ? state.agenticModelPreference
    : "dynamic-free-catalog";
  const publicEstates = state.rows.map(publicEstateRow);
  const docPrepEstates = publicEstates.filter((estate) => estateWorkflowDocPrepStates.includes(estate.workflowState));
  const exportQueue = publicEstates.filter((estate) => estate.exportEligible && estateWorkflowExportQueueStates.includes(estate.workflowState));
  return freezePublicValue({
    activeView: state.activeView,
    selectedEstateId: row?.id || null,
    selectedEstate: publicEstateRow(row),
    estates: publicEstates,
    docPrepEstates,
    exportQueue,
    selectedIds: [...state.selectedIds],
    queueIds: [...state.queueIds],
    docPrep: {
      listOpen: state.docPrepListOpen,
      workflowState: workflow.state,
      workflowLabel: workflow.label,
      workflowStages: workflow.stages,
      flow: { id: flow.id, label: flow.label, title: flow.title },
      progress: row ? discoveryProgress(flow.id, row) : 0,
      currentPhase: phase ? { id: phase.id, label: phase.label, source: phase.source } : null,
      complete: Boolean(row && docPrepFlowIsComplete(row, flow.id)),
      documents: publicDocumentRows(row),
      attachments: publicEvidenceAttachments(row),
      packet: publicPacketIsVerified(row, flow.id, packet) ? {
        artifactId: String(packet?.artifact?.artifactId || ""),
        artifactUrl: String(packet?.artifactUrl || ""),
        contentHash: String(packet?.artifact?.contentHash || ""),
        expiresAt: String(packet?.artifact?.expiresAt || ""),
        fileName: `${flow.title} - ${docPrepOwnerLabel(row)}.pdf`,
      } : null,
      packetVerified: publicPacketIsVerified(row, flow.id, packet),
      packetExpired: publicPacketIsExpired(row, flow.id, packet),
      packetApproved: Boolean(currentPacketApproval(row, flow.id)),
      packetRevision: currentPacketRevision(row, flow.id),
      packetHistory: publicPacketHistory(row, flow.id),
      googleDelivered: Boolean(chatgptWorkDelivery(packet)?.readbackStatus === "verified"),
      googleDestination: cleanDisplayValue(chatgptWorkDelivery(packet)?.destination || ""),
      googleHandoffReady: googleWorkspaceDeliveryReady(),
      googleHandoffDestination: cleanDisplayValue(state.googleWorkspace?.destinationName || ""),
      contactReview: publicContactReview(row),
      sourceCapture: row
        ? cloneSourceCaptureRecord(sourceCapturePersistenceSnapshot({ [assetDiscoveryKey(row)]: sourceCaptureForRow(row) })[assetDiscoveryKey(row)]) || {}
        : {},
      automation: stream ? {
        status: cleanDisplayValue(stream.status || "pending"),
        updatedAt: Number(stream.updatedAt || 0),
        sections: (stream.sections || []).map((section) => ({
          id: String(section.id || ""),
          title: cleanDisplayValue(section.title || "Discovery stage"),
          status: cleanDisplayValue(section.status || "pending"),
        })),
      } : null,
    },
    dealStatus: row ? {
      id: dealStatusForRow(row),
      label: dealStatusLabel(dealStatusForRow(row)),
    } : null,
    rail: {
      open: state.railOpen,
      tab: state.railTab,
      width: state.railWidth,
      mode: state.railMode,
    },
    session: {
      authenticated: Boolean(state.session?.authenticated),
      canAdminister: Boolean(state.session?.canAdminister || state.session?.user?.canAdminister),
      user: state.session?.user ? {
        name: cleanDisplayValue(state.session.user.name || "Team member"),
        email: cleanDisplayValue(state.session.user.email || ""),
      } : null,
    },
    connections: state.connections.map(normalizePublicConnection),
    settings: {
      activeTab: state.settingsTab,
      accessDomains: [...state.adminAccessDomains],
      preferences: {
        holdNoContact: Boolean(state.dripSettings.holdNoContact),
        compactTables: Boolean(state.beuiPreferences.compactTables),
      },
      agenticModelStatus: publicAgenticModelStatus,
      agenticModelPreference: publicAgenticModelPreference,
      verifiedFreeModels,
    },
    outreach: {
      selectedCampaignId: state.selectedOutreachCampaignId,
      selectedTemplateId: state.selectedOutreachTemplateId,
      campaigns: state.outreachWorkspace.campaigns.map((campaign) => ({
        id: String(campaign.id || ""),
        label: cleanDisplayValue(campaign.name || "Campaign"),
        detail: cleanDisplayValue(campaign.description || ""),
      })),
      templates: state.outreachWorkspace.templates.map((template) => ({
        id: String(template.id || ""),
        campaignId: String(template.campaignId || ""),
        label: cleanDisplayValue(template.name || "Template"),
        channel: template.channel === "email" ? "email" : "sms",
        state: template.status,
        detail: template.channel === "email" ? cleanDisplayValue(template.subject || "") : "",
      })),
    },
    activity: publicShellEvents(row),
  });
}

function notifyLegacySubscribers() {
  if (!legacySubscribers.size) return;
  const next = legacyPublicSnapshot();
  legacySubscribers.forEach((listener) => {
    try {
      listener(next);
    } catch (error) {
      console.error("HeirRight state subscriber failed.", error);
    }
  });
}

function subscribeLegacyState(listener) {
  if (typeof listener !== "function") throw new TypeError("State subscriber must be a function.");
  legacySubscribers.add(listener);
  try {
    listener(legacyPublicSnapshot());
  } catch (error) {
    legacySubscribers.delete(listener);
    throw error;
  }
  return () => legacySubscribers.delete(listener);
}

function estateForLegacyCommand(payload = {}) {
  const hasEstateId = Object.prototype.hasOwnProperty.call(payload, "estateId");
  if (!hasEstateId) return selectedRow();
  const estateId = String(payload.estateId ?? "").trim();
  const row = estateId ? rowById(estateId) : null;
  if (!row) throw new Error(`Estate is unavailable: ${estateId || "(empty)"}`);
  return row;
}

async function withBeuiDocPrepAction(estateId, action, operation) {
  const key = `${String(estateId || "")}:${String(action || "")}`;
  if (beuiDocPrepActions.has(key)) throw new Error("That Doc Prep action is already in progress.");
  beuiDocPrepActions.add(key);
  try {
    return await operation();
  } finally {
    beuiDocPrepActions.delete(key);
  }
}

async function runLegacyDocumentAction(row, payload = {}) {
  const documentId = String(payload.documentId || "").trim();
  const action = String(payload.action || "").trim();
  if (!allowedDocumentActions.has(action)) throw new Error(`Unsupported document action: ${action || "(empty)"}`);
  const isIdiReport = documentId === "idi-asset-search" && Boolean(idiImportForRow(row) || documentFileRecord(documentId, row));
  const documentRow = docsForFlow(row, dossierForRow(row), state.activeDocPrepFlow).find((item) => item.id === documentId)
    || (isIdiReport ? { id: documentId, title: "IDI Core Report" } : null);
  if (!documentRow) throw new Error(`Document is unavailable for the selected estate: ${documentId || "(empty)"}`);
  state.selectedId = row.id;
  state.selectedDossierDocId = documentId;
  if (action === "select") return;
  const file = documentFileRecord(documentId, row);
  if (action === "preview") {
    if (file?.readbackStatus === "verified" && file?.artifactId && file?.artifactUrl && file?.contentHash) {
      const href = sameOriginVerifiedArtifactHref(file.artifactUrl, file.artifactId);
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
      return;
    }
    if (isIdiReport) throw new Error("The IDI report has not passed verified file readback.");
    previewDossierDocument(documentId);
    return;
  }
  if (action === "replace") {
    if (isIdiReport) {
      if (!state.session?.canAdminister && !state.session?.user?.canAdminister) {
        throw new Error("A configured administrator must replace verified IDI reports.");
      }
      const picker = document.querySelector("[data-feature='doc-prep'] [data-idi-picker]");
      if (!picker || picker.disabled) throw new Error("Open this estate's Discovery workflow before replacing its IDI report.");
      runtime.rails.setOpen(false);
      picker.click();
      document.getElementById("topStatus").textContent = "Choose the replacement PDF or DOCX, then record why the verified report changed.";
      return;
    }
    openDocumentActionModal(documentId, "replace");
    return;
  }
  if (action === "remove") {
    if (isIdiReport) throw new Error("Verified IDI reports remain linked to the estate audit trail and cannot be removed from document actions.");
    await removeSupportingDocument(documentId);
    return;
  }
  if (action === "queue") {
    addRowsToQueue([row]);
    return;
  }
  if (file?.readbackStatus !== "verified" || !file?.artifactId || !file?.artifactUrl || !file?.contentHash) {
    throw new Error("This document does not have a verified file to download.");
  }
  const href = sameOriginVerifiedArtifactHref(file.artifactUrl, file.artifactId);
  const link = document.createElement("a");
  link.href = href;
  link.download = safeArtifactFileName(file.name || `${documentRow.title || "HeirRight document"}.pdf`);
  link.rel = "noopener noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
}

function sameOriginVerifiedArtifactHref(candidate, artifactId) {
  return verifiedArtifactHref(candidate, artifactId, window.location.origin);
}

function safeArtifactFileName(value) {
  const normalized = String(value || "HeirRight document.pdf")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return normalized || "HeirRight document.pdf";
}

function runLegacyPacketAction(row, payload = {}) {
  const action = String(payload.action || "").trim();
  if (!["open", "download"].includes(action)) throw new Error(`Unsupported packet action: ${action || "(empty)"}`);
  const flowId = String(payload.flowId || state.activeDocPrepFlow || "discovery");
  if (!docPrepFlows[flowId]) throw new Error(`Unsupported Document Prep workflow: ${flowId || "(empty)"}`);
  const packet = packetArtifactForRow(row, flowId);
  requireCurrentUnexpiredPacket(row, flowId, packet, `${action}ing the packet`);
  const artifactId = String(packet?.artifact?.artifactId || packet?.verification?.artifactId || "");
  if (!packet?.artifactUrl || !artifactId) {
    throw new Error("The current packet has not passed verified revision readback.");
  }
  const href = sameOriginVerifiedArtifactHref(packet.artifactUrl, artifactId);
  if (action === "open") {
    window.location.assign(href);
    return;
  }
  const link = document.createElement("a");
  link.href = href;
  link.download = safeArtifactFileName(`${docPrepFlow(flowId).title} - ${docPrepOwnerLabel(row)}.pdf`);
  link.rel = "noopener noreferrer";
  document.body.append(link);
  link.click();
  link.remove();
  document.getElementById("topStatus").textContent = "The current verified packet download started.";
}
const s40StageTemplate = Object.freeze([
  { id: "source-review", label: "Source evidence", status: "pending" },
  { id: "packet-render", label: "Packet render", status: "pending" },
  { id: "pdf-readback", label: "PDF readback", status: "pending" },
  { id: "export-handoff", label: "Export handoff", status: "pending" },
]);

function s40StagesFor(row, reset = false) {
  const existing = reset ? [] : estateWorkflowForRow(row).stages;
  return s40StageTemplate.map((stage) => {
    const saved = existing.find((candidate) => candidate.id === stage.id);
    return normalizeEstateWorkflowStage(saved || stage);
  });
}

function s40StageUpdate(row, stageId, status, blocker = "", { render = true } = {}) {
  const stages = s40StagesFor(row).map((stage) => stage.id === stageId
    ? normalizeEstateWorkflowStage({ ...stage, status, blocker, updatedAt: new Date().toISOString() })
    : stage);
  const next = patchEstateWorkflowState(row, {
    stages,
    blocker: status === "blocked" ? cleanDisplayValue(blocker) : "",
    blockerStage: status === "blocked" ? stageId : estateWorkflowForRow(row).blockerStage,
  });
  queueS40WorkflowPersist();
  if (render) renderCurrentLoopView();
  return next;
}

function s40SafeBlocker(error, fallback = "This stage could not complete. Review the estate file and retry.") {
  const raw = String(error?.message || error || "").replace(/\s+/g, " ").trim();
  if (/workspace|shared.*save|reload|revision/i.test(raw)) return "The shared workflow state could not be saved. Reload the workspace, then retry.";
  if (/source|discovery|evidence|idi|provider|public/i.test(raw)) return "Source evidence needs verified readback before Doc Prep can continue.";
  if (/packet|pdf|artifact|render/i.test(raw)) return "The packet did not pass verified PDF readback. Retry the Doc Prep run.";
  if (/approval|google|drive|destination|handoff|export/i.test(raw)) return "Export approval and readback are required before the file can leave Doc Prep.";
  return fallback;
}

function s40SourceEvidenceReady(row) {
  const capture = sourceCaptureForRow(row);
  const persistence = capture?.sourceApiRun?.persistence;
  const proof = capture?.sourceApiRun?.sourceRunProof;
  const manualReportReady = idiImportReadyForDocPrep(row);
  return Boolean(
    dossierForRow(row)
    && (
      manualReportReady
      ||
      persistence?.readbackStatus === "verified"
      || (persistence?.stored === true && persistence?.readbackStatus === "verified")
      || proof?.readbackStatus === "verified"
    )
  );
}

function s40ArtifactMetadata(result, row) {
  const artifact = result?.artifact || {};
  return {
    artifactId: cleanDisplayValue(artifact.artifactId || result?.verification?.artifactId || ""),
    artifactUrl: String(result?.artifactUrl || artifact.url || ""),
    contentHash: cleanDisplayValue(artifact.contentHash || result?.verification?.contentHash || ""),
    expiresAt: String(artifact.expiresAt || result?.expiresAt || ""),
    fileName: docPrepFlow("discovery").title + " - " + docPrepOwnerLabel(row) + ".pdf",
    packetRevision: Number(result?.packetRevision || artifact.packetRevision || currentPacketRevision(row, "discovery")),
  };
}
function s40EnsurePacketArtifact(row) {
  if (!row) return null;
  const existing = packetArtifactForRow(row, "discovery");
  if (existing?.verification?.verified && existing.verification.readbackStatus === "verified") return existing;
  const workflowArtifact = estateWorkflowForRow(row).artifact;
  if (!workflowArtifact?.artifactId || !workflowArtifact.artifactUrl || !workflowArtifact.contentHash || !workflowArtifact.expiresAt) return existing || null;
  const packet = {
    ok: true,
    flow: "discovery",
    estateId: assetDiscoveryKey(row),
    estateIds: [assetDiscoveryKey(row)],
    contentType: "application/pdf",
    artifactUrl: workflowArtifact.artifactUrl,
    packetRevision: workflowArtifact.packetRevision,
    packetPersistence: [{ estateId: assetDiscoveryKey(row), stored: true, readbackStatus: "verified" }],
    artifact: {
      kind: "combined_and_separated_pdf",
      artifactId: workflowArtifact.artifactId,
      contentType: "application/pdf",
      contentHash: workflowArtifact.contentHash,
      expiresAt: workflowArtifact.expiresAt,
      packetRevision: workflowArtifact.packetRevision,
      url: workflowArtifact.artifactUrl,
    },
    verification: {
      verified: true,
      readbackStatus: "verified",
      artifactId: workflowArtifact.artifactId,
      contentHash: workflowArtifact.contentHash,
      verifiedAt: workflowArtifact.updatedAt || estateWorkflowForRow(row).updatedAt || new Date().toISOString(),
    },
    routes: [],
    documentArtifacts: [],
  };
  state.packetArtifacts[`discovery:${row.id}`] = packet;
  return packet;
}

let s40WorkflowPersistChain = Promise.resolve(true);
const s40StopRequests = new Set();

function s40StopRequested(row) {
  return Boolean(row?.id && s40StopRequests.has(String(row.id)));
}

function s40EnsureNotStopped(row) {
  if (!s40StopRequested(row)) return;
  const error = new Error("Doc Prep was stopped by the operator.");
  error.code = "S40_RUN_STOPPED";
  throw error;
}

function queueS40WorkflowPersist() {
  s40WorkflowPersistChain = s40WorkflowPersistChain
    .catch(() => true)
    .then(() => persistEstateWorkflow())
    .catch(() => false);
  return s40WorkflowPersistChain;
}


async function s40PersistWorkflowOrThrow() {
  if (!await queueS40WorkflowPersist()) {
    throw new Error("The shared workflow state could not be saved. Reload the workspace, then retry.");
  }
}

async function stopS40DocPrep(estateIds = [], { silent = false } = {}) {
  const ids = [...new Set(estateIds.map(String).filter(Boolean))];
  if (!ids.length) throw new Error("Select at least one estate before stopping Doc Prep.");
  const stopped = [];
  for (const estateId of ids) {
    const row = rowById(estateId);
    if (!row) continue;
    const current = estateWorkflowForRow(row);
    if (current.state !== "processing") continue;
    s40StopRequests.add(String(row.id));
    setEstateWorkflowState(row, "queued", {
      exportEligible: false,
      blocker: "",
      blockerStage: "",
      stages: s40StagesFor(row, true),
      artifact: null,
      handoff: null,
      processingAt: "",
    });
    stopped.push(row);
  }
  if (stopped.length) {
    syncLegacyQueueIds();
    await s40PersistWorkflowOrThrow();
    if (!silent) {
      addShellEvent(
        "Doc Prep stopped",
        stopped.length === 1
          ? `${docPrepEstateLabel(stopped[0])} returned to the Doc Prep queue.`
          : `${stopped.length} estates returned to the Doc Prep queue.`,
        "review",
        true,
        { row: stopped[0], source: "Doc Prep" },
      );
      renderCurrentLoopView();
    }
  } else {
    ids.forEach((estateId) => s40StopRequests.delete(estateId));
  }
  return stopped.map((row) => row.id);
}

async function ensureS40WorkflowStateReady() {
  if (localStateEndpointEnabled()) return;
  const requiredKeys = [crmImportStateKey, sourceCaptureStateKey, estateWorkflowStateKey];
  const missingKeys = requiredKeys.filter((key) => !Number.isInteger(state.workspaceStateRevisions[key]));
  if (!missingKeys.length) return;
  await hydrateServerBackedState();
  if (missingKeys.some((key) => !Number.isInteger(state.workspaceStateRevisions[key]))) {
    throw new Error("The latest team version has not loaded yet. Reload the workspace before queueing Doc Prep.");
  }
}

async function queueEstatesForDocPrep(rows = []) {
  const requestedIds = [...new Set(rows.filter(Boolean).map((row) => String(row.id || "")).filter(Boolean))];
  if (!requestedIds.length) throw new Error("Select at least one active estate before queueing Doc Prep.");
  await ensureS40WorkflowStateReady();
  const uniqueRows = [...new Map(
    requestedIds
      .map((estateId) => [estateId, rowById(estateId)])
      .filter(([, row]) => row),
  ).values()];
  if (uniqueRows.length !== requestedIds.length) {
    throw new Error("One or more selected estates are unavailable.");
  }
  if (!uniqueRows.length) throw new Error("Select at least one active estate before queueing Doc Prep.");
  const previous = new Map(uniqueRows.map((row) => [String(row.id), normalizeEstateWorkflowRecord(estateWorkflowForRow(row))]));
  const blocked = uniqueRows.find((row) => canonicalStopReasonsForRow(row).length > 0);
  if (blocked) {
    throw new Error("This estate is held by an existing review stop. Resolve the estate review before queueing Doc Prep.");
  }
  try {
    uniqueRows.forEach((row) => {
      const current = estateWorkflowForRow(row);
      if (current.state === "active") {
        setEstateWorkflowState(row, "queued", {
          exportEligible: false,
          blocker: "",
          blockerStage: "",
          stages: [],
          artifact: null,
          handoff: null,
          queuedAt: isoNow(),
        });
      } else if (current.state !== "queued") {
        throw new Error("One or more selected estates already left the active Estates worklist.");
      }
    });
    uniqueRows.forEach((row) => state.selectedIds.delete(row.id));
    await s40PersistWorkflowOrThrow();
  } catch (error) {
    uniqueRows.forEach((row) => {
      const prior = previous.get(String(row.id));
      if (prior) state.estateWorkflow[String(row.id)] = prior;
    });
    syncLegacyQueueIds();
    throw error;
  }
  state.selectedId = uniqueRows[0]?.id || state.selectedId;
  addShellEvent(
    "Estates queued for Doc Prep",
    uniqueRows.length + " estate" + (uniqueRows.length === 1 ? "" : "s") + " moved from Estates into the Doc Prep workbench.",
    "ready",
    true,
  );
  return uniqueRows;
}

async function runS40DocPrep(estateIds = []) {
  const ids = [...new Set(estateIds.map(String).filter(Boolean))];
  if (!ids.length) throw new Error("Select at least one queued estate before starting Doc Prep.");
  const results = [];
  for (const estateId of ids) {
    const row = rowById(estateId);
    if (!row) {
      results.push({ estateId, state: "blocked", blocker: "That estate is no longer available in the workspace." });
      continue;
    }
    s40EnsureNotStopped(row);
    const previous = normalizeEstateWorkflowRecord(estateWorkflowForRow(row));
    const current = previous.state;
    if (current === "exported" || current === "completed-awaiting-export") {
      results.push({ estateId, state: current });
      continue;
    }
    if (current === "processing") {
      results.push({ estateId, state: "blocked", blocker: "This estate is already running in Doc Prep. Wait for the current run to finish." });
      continue;
    }
    if (!["queued", "blocked"].includes(current)) {
      results.push({ estateId, state: "blocked", blocker: "Queue this estate from Estates before starting Doc Prep." });
      continue;
    }
    if (current === "blocked" && previous.blockerStage === "export-handoff" && previous.exportEligible) {
      results.push({ estateId, state: "blocked", blocker: "This estate is waiting for export handoff retry." });
      continue;
    }
    let stageId = "source-review";
    try {
      state.selectedId = row.id;
      state.activeDocPrepFlow = "discovery";
      setEstateWorkflowState(row, "processing", {
        exportEligible: false,
        blocker: "",
        blockerStage: "",
        stages: s40StagesFor(row, true),
        processingAt: isoNow(),
      });
      await s40PersistWorkflowOrThrow();
      s40EnsureNotStopped(row);
      s40StageUpdate(row, "source-review", "active");
      await hydratePersistedDiscoveryFile(row);
      s40EnsureNotStopped(row);
      renderCurrentLoopView();
      if (!s40SourceEvidenceReady(row)) {
        throw new Error("Source evidence needs verified readback before Doc Prep can continue.");
      }
      s40EnsureNotStopped(row);
      s40StageUpdate(row, "source-review", "complete");
      stageId = "packet-render";
      s40StageUpdate(row, stageId, "active");
      const result = await generatePacketPreview(row, null, { flowId: "discovery", render: false, s40: true });
      s40EnsureNotStopped(row);
      if (!result?.ok || result?.verification?.verified !== true || result?.verification?.readbackStatus !== "verified") {
        throw new Error("The packet did not pass verified PDF readback.");
      }
      linkGeneratedDocPrepPackets(row, "discovery", { syncWorkspace: false });
      await verifyGeneratedPacketAuditReadback(row, "discovery");
      persistDiscoveryState({ syncWorkspace: false });
      persistDocumentFiles();
      s40StageUpdate(row, stageId, "complete");
      stageId = "pdf-readback";
      s40StageUpdate(row, stageId, "active");
      const artifact = s40ArtifactMetadata(result, row);
      s40EnsureNotStopped(row);
      if (!artifact.artifactId || !artifact.artifactUrl || !artifact.contentHash) {
        throw new Error("The packet did not return a complete verified PDF record.");
      }
      s40StageUpdate(row, stageId, "complete");
      patchEstateWorkflowState(row, {
        state: "completed-awaiting-export",
        label: estateWorkflowStateLabels["completed-awaiting-export"],
        exportEligible: true,
        blocker: "",
        blockerStage: "",
        artifact,
      });
      syncLegacyQueueIds();
      await s40PersistWorkflowOrThrow();
      addShellEvent(
        "Doc Prep packet verified",
        docPrepEstateLabel(row) + " passed PDF render and shared readback, and is waiting for export approval.",
        "ready",
        true,
        { row, source: "Doc Prep" },
      );
      results.push({ estateId, state: "completed-awaiting-export" });
    } catch (error) {
      if (error?.code === "S40_RUN_STOPPED" || s40StopRequested(row)) {
        s40StopRequests.delete(String(row.id));
        renderCurrentLoopView();
        results.push({ estateId, state: "queued", stopped: true });
        continue;
      }
      const blocker = s40SafeBlocker(error);
      s40StageUpdate(row, stageId, "blocked", blocker, { render: false });
      patchEstateWorkflowState(row, {
        state: "blocked",
        label: estateWorkflowStateLabels.blocked,
        exportEligible: false,
        blocker,
        blockerStage: stageId,
      });
      try {
        await s40PersistWorkflowOrThrow();
      } catch {}
      document.getElementById("topStatus").textContent = blocker;
      addShellEvent("Doc Prep stage blocked", blocker, "blocked", true, { row, source: "Doc Prep" });
      renderCurrentLoopView();
      results.push({ estateId, state: "blocked", blocker });
    }
  }
  state.selectedId = rowById(ids[0])?.id || state.selectedId;
  return results;
}

async function exportS40Handoff(estateIds = []) {
  const ids = [...new Set(estateIds.map(String).filter(Boolean))];
  if (!ids.length) throw new Error("Select at least one completed report before export handoff.");
  const results = [];
  for (const estateId of ids) {
    const row = rowById(estateId);
    if (!row) {
      results.push({ estateId, state: "blocked", blocker: "That estate is no longer available in the workspace." });
      continue;
    }
    const previous = normalizeEstateWorkflowRecord(estateWorkflowForRow(row));
    if (previous.state === "exported") {
      results.push({ estateId, state: "exported" });
      continue;
    }
    if (!previous.exportEligible || !estateWorkflowExportQueueStates.includes(previous.state)) {
      results.push({ estateId, state: "blocked", blocker: "Only a verified completed report can enter export handoff." });
      continue;
    }
    let stageId = "export-handoff";
    try {
      state.selectedId = row.id;
      const packet = s40EnsurePacketArtifact(row);
      if (!packet?.verification?.verified || packet?.verification?.readbackStatus !== "verified") {
        throw new Error("The current packet did not pass verified PDF readback.");
      }
      if (!currentPacketApproval(row, "discovery")) {
        throw new Error("Approve the current verified packet before export handoff.");
      }
      if (!googleWorkspaceDeliveryReady()) {
        throw new Error("Export destination approval is required before handoff.");
      }
      s40StageUpdate(row, stageId, "active");
      const delivery = await deliverPacketToGoogle(row, packet);
      if (!delivery?.ok || delivery.readbackStatus !== "verified" || delivery.readbackOk !== true) {
        throw new Error("Export handoff did not pass destination readback.");
      }
      s40StageUpdate(row, stageId, "complete");
      setEstateWorkflowState(row, "exported", {
        exportEligible: false,
        blocker: "",
        blockerStage: "",
        handoff: {
          route: "google-workspace",
          artifactId: cleanDisplayValue(packet.artifact?.artifactId || ""),
          readbackStatus: "verified",
          completedAt: isoNow(),
        },
        exportedAt: isoNow(),
      });
      await s40PersistWorkflowOrThrow();
      addShellEvent(
        "Export handoff verified",
        docPrepEstateLabel(row) + " passed destination readback and moved into Export.",
        "ready",
        true,
        { row, source: "Export" },
      );
      results.push({ estateId, state: "exported" });
    } catch (error) {
      const blocker = s40SafeBlocker(error, "Export approval and readback are required before the file can leave Doc Prep.");
      s40StageUpdate(row, stageId, "blocked", blocker, { render: false });
      patchEstateWorkflowState(row, {
        state: "blocked",
        exportEligible: true,
        blocker,
        blockerStage: stageId,
      });
      try {
        await s40PersistWorkflowOrThrow();
      } catch {}
      document.getElementById("topStatus").textContent = blocker;
      addShellEvent("Export handoff blocked", blocker, "blocked", true, { row, source: "Export" });
      renderCurrentLoopView();
      results.push({ estateId, state: "blocked", blocker });
    }
  }
  return results;
}

async function dispatchLegacyCommand(command, payload = {}) {
  const id = String(command || "");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("Command payload must be an object.");
  try {
    if (id === "beui-import-estate-file") {
      const file = payload.file;
      if (!file || typeof file.arrayBuffer !== "function") throw new Error("Choose a PDF or CSV file before importing.");
      if (state.crmImportModal) state.crmImportModal.open = false;
      await queueEstateFile(file);
      if (state.crmImportUpload?.status !== "success" || state.crmImportUpload?.reviewRequired !== true) {
        throw new Error("The estate file did not pass the verified free-model review gate.");
      }
      await commitEstateFileImports();
      if (state.crmImportUpload?.status !== "success") throw new Error("The parsed estate records could not be added safely.");
    } else if (id === "beui-docprep-start") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate before starting Doc Prep.");
      state.selectedId = row.id;
      await withBeuiDocPrepAction(row.id, "start", async () => {
        if (!idiImportReadyForDocPrep(row)) throw new Error("Attach a verified IDI report before starting cloud document preparation.");
        if (caseForEstate(row.id)) throw new Error("This estate already has a durable Doc Prep case.");
        await startProcessCase(legacyPublicSnapshot());
        setActiveShellView("dossiers", "Doc Prep");
      });
    } else if (id === "beui-docprep-action") {
      const row = estateForLegacyCommand(payload);
      const action = ["retry", "cancel"].includes(String(payload.action || "")) ? String(payload.action) : "";
      if (!row || !action) throw new Error("Choose a valid durable Doc Prep action.");
      state.selectedId = row.id;
      await withBeuiDocPrepAction(row.id, action, async () => {
        const processCase = caseForEstate(row.id) || await hydrateProcessCase(row.id, { force: true });
        if (!processCase) throw new Error("The durable Doc Prep case is unavailable. Refresh and try again.");
        await requestCaseAction(processCase, action);
        setActiveShellView("dossiers", "Doc Prep");
      });
    } else if (id === "beui-docprep-upload-idi") {
      const row = estateForLegacyCommand(payload);
      const file = payload.file;
      if (!row) throw new Error("Select an available estate before uploading an IDI report.");
      if (!file || (file.type !== "application/pdf" && !String(file.name || "").toLowerCase().endsWith(".pdf"))) {
        throw new Error("Choose a PDF exported from the approved IDI report workflow.");
      }
      state.selectedId = row.id;
      await withBeuiDocPrepAction(row.id, "upload", async () => {
        const imported = await importIdiReportFile(file, row, { startDiscovery: false });
        if (imported?.ok !== true) throw new Error("The IDI report could not be verified.");
        const processCase = caseForEstate(row.id) || await hydrateProcessCase(row.id, { force: true });
        if (processCase) await requestCaseAction(processCase, "retry");
        setActiveShellView("dossiers", "Doc Prep");
      });
    } else if (id === "beui-docprep-export") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate before exporting the verified PDF.");
      await withBeuiDocPrepAction(row.id, "export", async () => {
        const processCase = caseForEstate(row.id) || await hydrateProcessCase(row.id, { force: true });
        if (!processCase) throw new Error("The durable Doc Prep case is unavailable. Refresh and try again.");
        await exportVerifiedPdfToGoogleDrive(processCase);
      });
    } else if (id === "beui-settings-tab") {
      const tab = String(payload.tab || "");
      if (!["access", "integrations", "support", "outreach", "preferences", "admin"].includes(tab)) {
        throw new Error("Choose a valid Settings section.");
      }
      state.settingsTab = tab;
      if (tab === "integrations" && !state.agenticModelStatus?.loaded) await loadAgenticModelStatus();
    } else if (id === "beui-load-agentic-model-status") {
      if (!state.agenticModelStatus?.loaded) await loadAgenticModelStatus();
    } else if (id === "beui-set-agentic-model") {
      const model = String(payload.model || "").trim();
      const verifiedFreeModels = Array.isArray(state.agenticModelStatus?.freeModels)
        ? state.agenticModelStatus.freeModels.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      if (model !== "dynamic-free-catalog" && !verifiedFreeModels.includes(model)) {
        throw new Error("Choose a model from the verified Nous free catalog.");
      }
      state.agenticModelPreference = model || "dynamic-free-catalog";
      storageSetItem(agenticModelPreferenceKey, state.agenticModelPreference, { sync: false });
    } else if (id === "beui-set-preference") {
      const key = String(payload.key || "");
      if (key === "holdNoContact") {
        state.dripSettings.holdNoContact = payload.value !== false;
        persistDripSettings("Outreach no-contact preference updated");
      } else if (key === "compactTables") {
        state.beuiPreferences.compactTables = payload.value === true;
        persistBeuiPreferences();
      } else {
        throw new Error("Choose a supported workspace preference.");
      }
    } else if (id === "beui-refresh-connection") {
      await loadConnectionStatuses();
      await loadAgenticModelStatus();
    } else if (id === "beui-outreach-select-campaign") {
      const campaign = campaignById(payload.campaignId);
      if (!campaign) throw new Error("The selected campaign is unavailable.");
      state.selectedOutreachCampaignId = campaign.id;
      state.selectedOutreachTemplateId = activeOutreachTemplates(campaign.id)[0]?.id || null;
    } else if (id === "beui-outreach-select-template") {
      const template = state.outreachWorkspace.templates.find((item) => item.id === String(payload.templateId || ""));
      if (!template) throw new Error("The selected template is unavailable.");
      state.selectedOutreachTemplateId = template.id;
      state.selectedOutreachCampaignId = template.campaignId;
    } else if (id === "beui-outreach-template-action") {
      const template = state.outreachWorkspace.templates.find((item) => item.id === String(payload.templateId || ""));
      const action = String(payload.action || "");
      if (!template) throw new Error("The selected template is unavailable.");
      if (["mark-ready", "submit-approval"].includes(action)) {
        const next = normalizeOutreachTemplate({ ...template, status: "Ready", lastEditedBy: currentActorEmail(), lastEditedAt: isoNow(), updatedAt: isoNow() });
        upsertOutreachTemplate(next, action === "mark-ready" ? "Marked ready" : "Submitted for approval", `${next.name} is held for the existing approval boundary.`);
      } else if (action === "sync") {
        await syncOutreachTemplate(template.id);
      } else if (action === "hold-outbound") {
        showOutreachNotification({ tone: "blocked", title: "Direct send is locked", copy: "HeirRight does not send SMS or email from this screen. The reviewed package remains queued for the approved external path.", action: "settings" });
      } else {
        throw new Error("Choose a supported outreach action.");
      }
    } else if (id === "beui-admin-action") {
      const action = String(payload.action || "");
      state.settingsTab = action === "open-support" ? "support" : action === "review-access" ? "admin" : state.settingsTab;
      setActiveShellView("settings", "Settings");
    } else if (id === "s40-queue-estates") {
      const estateIds = Array.isArray(payload.estateIds) ? [...new Set(payload.estateIds.map(String).filter(Boolean))] : [];
      if (!estateIds.length) throw new Error("Select at least one active estate before queueing Doc Prep.");
      const rows = estateIds.map(rowById).filter(Boolean);
      if (rows.length !== estateIds.length) throw new Error("One or more selected estates are unavailable.");
      await queueEstatesForDocPrep(rows);
      setActiveShellView("dossiers", "Doc Prep");
    } else if (id === "s40-run-docprep") {
      const estateIds = Array.isArray(payload.estateIds) ? payload.estateIds : [];
      await runS40DocPrep(estateIds);
      setActiveShellView("dossiers", "Doc Prep");
    } else if (id === "s40-stop-docprep") {
      const estateIds = Array.isArray(payload.estateIds) ? payload.estateIds : [];
      await stopS40DocPrep(estateIds);
      setActiveShellView("dossiers", "Doc Prep");
    } else if (id === "s40-upload-idi-report") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate before uploading an IDI report.");
      const file = payload.file;
      if (!file || (file.type !== "application/pdf" && !String(file.name || "").toLowerCase().endsWith(".pdf"))) {
        throw new Error("Choose a PDF exported from the approved IDI report workflow.");
      }
      state.selectedId = row.id;
      if (estateWorkflowForRow(row).state === "processing") {
        await stopS40DocPrep([row.id], { silent: true });
      }
      const imported = await importIdiReportFile(file, row, { startDiscovery: false });
      if (imported?.ok !== true) throw new Error(imported?.message || "The IDI report could not be verified.");
      const verifiedReport = documentFileRecord("idi-asset-search", row);
      if (!verifiedReport) throw new Error("The IDI report did not pass storage and readback verification.");
      await hydratePersistedDiscoveryFile(row);
      await runS40DocPrep([row.id]);
      setActiveShellView("dossiers", "Doc Prep");
    } else if (id === "s40-approve-packet") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      if (!s40EnsurePacketArtifact(row)) throw new Error("Run Doc Prep and verify the PDF before approving export.");
      await hydrateCurrentPacketApproval(row, "discovery");
      await approveCurrentPacket(row, "discovery");
      setActiveShellView("dossiers", "Doc Prep");
      renderCurrentLoopView();
    } else if (id === "s40-export-handoff") {
      const estateIds = Array.isArray(payload.estateIds) ? payload.estateIds : [];
      await exportS40Handoff(estateIds);
      setActiveShellView("dossiers", "Doc Prep");
    } else if (id === "select-estate") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      state.selectedId = row.id;
      renderCurrentLoopView();
      renderRail();
      updateFooterLeadContext(row);
      await hydratePersistedDiscoveryFile(row);
    } else if (id === "open-doc-prep") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      openDocPrepRow(row.id, payload.flowId || "discovery");
      await hydratePersistedDiscoveryFile(row);
    } else if (id === "set-doc-prep-flow") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      const flowId = String(payload.flowId || "").trim();
      if (!docPrepFlows[flowId]) throw new Error(`Unsupported Document Prep workflow: ${flowId || "(empty)"}`);
      state.selectedId = row.id;
      setActiveDocPrepFlow(flowId, { persist: true, rerender: true });
      await hydratePersistedDiscoveryFile(row);
    } else if (id === "set-deal-status") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      setDealStatusForRow(row, payload.statusId);
    } else if (id === "run-discovery") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      await runFullDiscovery(row, payload.source || null, payload.flowId || "discovery", {
        correctionNote: payload.correctionNote,
      });
    } else if (id === "run-source-search") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      await runExternalSourceSearchForRow(row);
    } else if (id === "upload-idi-report") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      await importIdiReportFile(payload.file, row, { adminOverrideReason: payload.adminOverrideReason });
    } else if (id === "open-document") {
      state.selectedDossierDocId = String(payload.documentId || "");
      previewDossierDocument(state.selectedDossierDocId);
    } else if (id === "clear-document-selection") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      state.selectedId = row.id;
      state.selectedDossierDocId = "";
      renderRail();
    } else if (id === "document-action") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      await runLegacyDocumentAction(row, payload);
    } else if (id === "packet-action") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      runLegacyPacketAction(row, payload);
    } else if (id === "review-contact-candidate") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      if (String(payload.estateId || "") !== String(state.selectedId || "")) {
        throw new Error("The selected estate changed before this contact decision could be saved.");
      }
      await saveContactCandidateReview(row, payload.candidateId, payload.status, payload.reportRevision);
    } else if (id === "save-source-capture") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      if (String(payload.estateId || "") !== String(state.selectedId || "")) {
        throw new Error("The selected estate changed before this source evidence could be saved.");
      }
      await saveSourceCaptureForRow(row, payload.capture);
    } else if (id === "remove-from-queue") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      const workflow = estateWorkflowForRow(row);
      if (workflow.state === "queued") {
        setEstateWorkflowState(row, "active", {
          exportEligible: false,
          blocker: "",
          blockerStage: "",
          stages: [],
          artifact: null,
          handoff: null,
        });
        void persistEstateWorkflow();
      } else {
        state.queueIds.delete(row.id);
      }
      document.getElementById("topStatus").textContent = `${docPrepEstateLabel(row)} was removed from Queue.`;
      renderCurrentLoopView();
      renderRail();
    } else if (id === "deliver-google-packet") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      const flowId = String(payload.flowId || "discovery");
      const packet = packetArtifactForRow(row, flowId);
      if (!packet?.verification?.verified || packet?.verification?.readbackStatus !== "verified") {
        throw new Error("Complete Discovery and verify the local PDF before sending it to Google Workspace.");
      }
      if (!currentPacketApproval(row, flowId)) {
        throw new Error("Approve Current Packet in Case Journey before sending this revision to Google Workspace.");
      }
      if (!googleWorkspaceDeliveryReady()) {
        throw new Error("Connect Google Workspace and choose a Drive folder before sending the approved packet.");
      }
      const existingDelivery = chatgptWorkDelivery(packet);
      const delivery = existingDelivery || await deliverPacketToGoogle(row, packet);
      document.getElementById("topStatus").textContent = existingDelivery
        ? `The verified PDF is already saved to ${delivery.destination || "the selected Drive folder"}.`
        : `The verified PDF was saved to ${delivery.destination || "the selected Drive folder"} and passed readback.`;
      addShellEvent(
        existingDelivery ? "Google packet already verified" : "Discovery PDF saved",
        `The verified PDF passed Google Workspace readback in ${delivery.destination || "the selected Drive folder"}.`,
        "ready",
        false,
        { row, source: "Google Workspace" }
      );
    } else if (id === "export") {
      const estateIds = Array.isArray(payload.estateIds) ? payload.estateIds.map(String) : [];
      if (!estateIds.length) throw new Error("Select at least one estate before exporting or adding it to Queue.");
      const rows = estateIds.map(rowById).filter(Boolean);
      if (rows.length !== new Set(estateIds).size) throw new Error("One or more requested estates are unavailable.");
      await chooseExportRoute(payload.route, payload.source || null, rows);
    } else if (id === "estate-lifecycle") {
      const action = String(payload.action || "");
      if (!["archive", "delete"].includes(action)) throw new Error("Choose Archive or Delete for the selected estates.");
      const estateIds = Array.isArray(payload.estateIds) ? payload.estateIds.map(String) : [];
      if (!estateIds.length) throw new Error("Select at least one imported estate.");
      const rows = estateIds.map(rowById).filter(Boolean);
      if (rows.length !== new Set(estateIds).size) throw new Error("One or more selected estates are unavailable.");
      if (rows.some((row) => row.sourceKind !== "crm-import")) throw new Error("Archive and delete are available only for imported estate records.");
      if (action === "delete" && payload.confirmed !== true) throw new Error("Confirm deletion before removing imported estates.");
      const changed = runEstateLifecycleForRows(rows, action, null, { confirmDelete: false });
      if (changed !== rows.length) throw new Error("One or more selected estates could not be updated.");
    } else if (id === "open-chatgpt-work") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      await openChatgptWorkHandoff(row, payload.flowId || state.activeDocPrepFlow, payload.source || null);
    } else if (id === "approve-packet") {
      const row = estateForLegacyCommand(payload);
      if (!row) throw new Error("Select an available estate.");
      await approveCurrentPacket(row, payload.flowId || state.activeDocPrepFlow);
    } else if (id === "set-theme") {
      applyTheme(payload.mode || "system");
    } else if (id === "set-rail-open") {
      setRailOpen(Boolean(payload.open), payload.source || null);
    } else {
      throw new Error(`Unsupported HeirRight command: ${id}`);
    }
  } finally {
    notifyLegacySubscribers();
  }
  return legacyPublicSnapshot();
}

function navigateLegacy(view) {
  if (!productViews.includes(view)) throw new Error(`Unsupported HeirRight view: ${String(view || "(empty)")}`);
  try {
    setActiveShellView(view, activeViewLabel(view));
  } finally {
    notifyLegacySubscribers();
  }
  return legacyPublicSnapshot();
}

function installAuthorizedLegacyBridge() {
  const bridge = installLegacyBridge({
    readState: legacyPublicSnapshot,
    subscribe: subscribeLegacyState,
    dispatch: dispatchLegacyCommand,
    selectedEstateId: () => selectedRow()?.id || null,
    navigate: navigateLegacy,
    emit: (title, copy, tone = "review") => {
      addShellEvent(title, copy, tone, false);
      notifyLegacySubscribers();
    },
    escapeHtml,
    icon: nucleoIcon,
  });
  // Four legacy Outreach templates still contain an inline command. Keep the
  // one named compatibility hook until the feature renderer removes them.
  window.handleOutreachTemplateAction = handleOutreachTemplateAction;
  return bridge;
}

const initialUrlParams = new URLSearchParams(window.location.search);
const initialViewParam = initialUrlParams.get("view");
const initialView = productViews.includes(initialViewParam) ? initialViewParam : "dashboard";
let workspaceBooted = false;
let workspaceBooting = false;

function prepareAuthorizedWorkspace() {
  if (workspaceBooted || workspaceBooting) return false;
  workspaceBooting = true;
  try {
    loadSavedState();
    applyNucleoIcons();
    wireEvents();
    setRailOpen(false);
    document.querySelectorAll("[data-shell-nav]").forEach((item) => {
      const isSelected = item.dataset.shellNav === initialView;
      item.classList.toggle("is-active", isSelected);
    });
    setActiveShellView(initialView, activeViewLabel(initialView));
    if (initialView === "dossiers" && initialUrlParams.get("docprep") === "estate") {
      state.docPrepListOpen = false;
      state.discoveryOpen = false;
      state.railMode = "dossier";
      state.railTab = ["flow", "timeline", "docs"].includes(initialUrlParams.get("railTab")) ? initialUrlParams.get("railTab") : "flow";
      setActiveDocPrepFlow(docPrepFlowForDeepLink(initialUrlParams), { persist: false, rerender: false });
      renderCurrentLoopView();
      renderRail();
      setRailOpen(initialUrlParams.get("rail") !== "closed");
      if (initialUrlParams.get("section")) {
        window.setTimeout(() => scrollDocPrepDeepLinkSection(initialUrlParams.get("section")), 200);
      }
    }
    return true;
  } catch (error) {
    workspaceBooting = false;
    workspaceBooted = false;
    throw error;
  }
}

function completeAuthorizedWorkspace() {
  installAuthorizedLegacyBridge();
  renderCurrentLoopView();
  workspaceBooted = true;
  workspaceBooting = false;
  authorizedWorkspaceReady = true;
  renderAuthGate(state.session);
  if (initialUrlParams.get("walkthrough") !== "off") {
    walkthroughAutoTimer = window.setTimeout(() => {
      walkthroughAutoTimer = null;
      if (storageGetItem(walkthroughStateKey) !== "true") openWalkthrough(0);
    }, 700);
  }
  return true;
}

function failAuthorizedWorkspace(error) {
  workspaceBooted = false;
  workspaceBooting = false;
  authorizedWorkspaceReady = false;
  uninstallLegacyBridge();
  delete window.handleOutreachTemplateAction;
  const message = error instanceof Error ? error.message : String(error || "Unknown startup error");
  console.error("HeirRight authorized workspace startup failed.", error);
  renderAuthGate(state.session, { startupError: `The workspace stayed locked because startup failed: ${message}. Reload to try again.` });
}

function lockWorkspaceForHistoryRestore() {
  authorizedWorkspaceReady = false;
  document.getElementById("workspace")?.setAttribute("aria-hidden", "true");
  renderAuthGate(state.session);
}

window.addEventListener("pagehide", (event) => {
  if (event.persisted) lockWorkspaceForHistoryRestore();
});

window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  lockWorkspaceForHistoryRestore();
  window.location.reload();
});

// Purge legacy IDI/contact payloads before session resolution so an expired or
// unauthorized browser never retains the former JS-readable copies.
purgeLegacyIdiBrowserState();
loadSession().then(async (session) => {
  if (authGateBlocking(session)) return;
  try {
    prepareAuthorizedWorkspace();
    const runRestore = loadRun();
    await Promise.race([runRestore, new Promise((resolve) => window.setTimeout(resolve, 2400))]);
    completeAuthorizedWorkspace();
    void runRestore.then(() => { if (workspaceBooted) renderCurrentLoopView(); }).catch(() => {});
    // Access-list and Google status are secondary chrome. Let the estate
    // workspace become interactive first, then refresh those surfaces without
    // holding the auth gate open for optional network work.
    void Promise.all([
      loadAdminAccessConfig({ rerender: true }),
      loadGoogleWorkspaceConnection({ folders: initialUrlParams.get("googleWorkspace") === "connected" })
    ]);
  } catch (error) {
    failAuthorizedWorkspace(error);
  }
});
