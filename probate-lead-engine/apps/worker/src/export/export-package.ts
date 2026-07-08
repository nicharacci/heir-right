import type { ConnectionStatus, ExportRequest, ExportResult, ExportRoute, ExportRouteResult, RawDossier } from "@ple/types";
import { formatCountyName } from "../display";
import { nowIso, slug } from "../lib";
import {
  PODIO_LIVE_WRITE_APPROVAL_KEY,
  PODIO_CSV_BACKUP_CONFIRMATION_KEY,
  TEXAS_EQUITY_PROS_LEADS_SPACE_ID,
  podioLiveWriteApproved,
  podioCsvBackupConfirmed,
  podioMissingExportConfig,
  podioAccessToken,
  podioAppId,
  podioAppToken,
  podioAuthConfigured,
  podioAuthSummary,
  podioBrowserRefreshToken,
  podioClientId,
  podioClientSecret,
  podioServerRefreshToken,
  podioRefreshToken,
  resolvePodioFieldMap,
  type PodioFieldKind,
  type PodioFieldMapEntry,
} from "./podio-config";

type RuntimeEnv = Record<string, string | undefined>;
export const GOOGLE_LIVE_WRITE_APPROVAL_KEY = "GOOGLE_LIVE_WRITE_APPROVED";

type GoogleWorkspaceExportOptions = Pick<ExportRequest,
  "workspaceDestination" | "workspaceDestinationEmail" | "shareWithEmails" | "requestedByEmail"
>;

interface GoogleWorkspaceTargets {
  workspaceDestination: string;
  workspaceDestinationEmail?: string;
  shareWithEmails: string[];
}

function missing(keys: string[], env: RuntimeEnv): string[] {
  return keys.filter((key) => !env[key]);
}

function idiCorePortalConfigured(env: RuntimeEnv): boolean {
  return Boolean(
    (env.IDI_CORE_PORTAL_URL || env.IDI_CORE_SEARCH_URL)
      && (env.IDI_CORE_ACCOUNT_ID || env.IDI_CORE_ACCOUNT_COMPANY || env.IDI_CORE_OPERATOR_EMAIL)
  );
}

function idiCoreApiDetails(env: RuntimeEnv): {
  endpointConfigured: boolean;
  sharedDefaultConfigured: boolean;
  userOverrideAllowed: boolean;
} {
  return {
    endpointConfigured: Boolean(env.IDI_CORE_API_URL),
    sharedDefaultConfigured: Boolean(env.IDI_CORE_API_TOKEN || env.HEIRRIGHT_IDI_CORE_API_TOKEN || env.IDI_CORE_API_KEY),
    userOverrideAllowed: true,
  };
}

function idiCoreApiConfigured(env: RuntimeEnv): boolean {
  const api = idiCoreApiDetails(env);
  return Boolean(api.endpointConfigured && api.sharedDefaultConfigured);
}

function taxCollectorSourceConnectionStatus(env: RuntimeEnv, checkedAt: string): ConnectionStatus {
  const directListingConfigured = Boolean(env.TAX_COLLECTOR_LISTING_URL || env.TAX_COLLECTOR_LISTING_URL_TEMPLATE);
  const scriptLiveProbeEnabled = env.TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED === "true";
  const browserbaseFunctionConfigured = Boolean(
    env.BROWSERBASE_API_KEY
      && (env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID || env.BROWSERBASE_TAX_COLLECTOR_FUNCTION_ID)
  );
  const browserWorkflowConfigured = Boolean(
    (env.BROWSERBASE_API_KEY && env.BROWSERBASE_PROJECT_ID)
      || env.TAX_COLLECTOR_BROWSER_WORKFLOW_URL
      || browserbaseFunctionConfigured
      || env.TAX_COLLECTOR_BROWSER_WORKFLOW_ENABLED === "true"
  );
  const ok = directListingConfigured || browserWorkflowConfigured;
  return {
    name: "Tax Collector Source",
    ok,
    mode: ok ? "review" : "blocked",
    configuredMode: directListingConfigured ? "script_listing" : browserWorkflowConfigured ? "browser_workflow" : "none",
    message: directListingConfigured
      ? "Tax Collector listing-page script capture is configured for direct listing/template paths; public GovHub search still uses a saved blocker until browser workflow is proven."
      : browserWorkflowConfigured
        ? "Tax Collector browser workflow credentials are configured for GovHub/public-search blockers. Keep receipt/payer fields review-gated until the run captures the listing-page receipt link."
        : "Tax Collector direct listing capture is available when an operator supplies the listing page, but public GovHub search needs Browserbase or controlled Chrome workflow before it can be automated.",
    checkedAt,
    blockers: ok ? [] : ["Configure Tax Collector listing URL template or Browserbase/Chrome workflow before claiming public-search automation."],
    sourceAutomation: {
      scriptDirectListingConfigured: directListingConfigured,
      scriptLiveProbeEnabled,
      browserWorkflowConfigured,
      browserbaseFunctionConfigured,
      publicSearchUrl: env.TAX_COLLECTOR_SEARCH_URL || "https://county-taxes.net/fl-miamidade/property-tax",
    },
  };
}

function truthyEnv(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function positiveIntegerEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function browserbaseUsageConnectionStatus(env: RuntimeEnv, checkedAt: string): ConnectionStatus {
  const taxCollectorFunctionConfigured = Boolean(
    env.BROWSERBASE_API_KEY
      && (env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID || env.BROWSERBASE_TAX_COLLECTOR_FUNCTION_ID)
  );
  const vitalObituaryFunctionConfigured = Boolean(
    env.BROWSERBASE_API_KEY
      && (env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID
        || env.VITAL_OBITUARY_BROWSERBASE_FUNCTION_ID
        || env.MARRIAGE_DEATH_BROWSERBASE_FUNCTION_ID
        || env.BROWSERBASE_VITAL_OBITUARY_FUNCTION_ID)
  );
  const apiConfigured = Boolean(env.BROWSERBASE_API_KEY);
  const projectConfigured = Boolean(env.BROWSERBASE_PROJECT_ID);
  const configured = Boolean(apiConfigured && (projectConfigured || taxCollectorFunctionConfigured || vitalObituaryFunctionConfigured));
  const maxBatchSessions = positiveIntegerEnv(env.BROWSERBASE_BATCH_MAX_SESSIONS, 10);
  const maxConcurrency = positiveIntegerEnv(env.BROWSERBASE_BATCH_CONCURRENCY, 2);
  const batchApprovalRequired = env.BROWSERBASE_BATCH_APPROVAL_REQUIRED !== "false";
  const batchApprovedByEnv = truthyEnv(env.BROWSERBASE_BATCH_RUN_APPROVED);
  return {
    name: "Browserbase Usage",
    ok: configured,
    mode: configured ? "review" : "blocked",
    configuredMode: configured ? "usage_policy" : "none",
    message: configured
      ? `Browserbase is configured for single-estate source capture. Paid batch source runs are capped at ${maxBatchSessions} estates with ${maxConcurrency} running at a time and require explicit batch approval.`
      : "Browserbase is not connected. Tax Collector and vital-source browser workflows stay blocked until source capture is configured.",
    checkedAt,
    blockers: configured ? [] : ["Connect Browserbase source capture before claiming automated browser retrieval."],
    usagePolicy: {
      apiConfigured,
      projectConfigured,
      taxCollectorFunctionConfigured,
      vitalObituaryFunctionConfigured,
      proxyEnabled: truthyEnv(env.BROWSERBASE_PROXY_ENABLED) || truthyEnv(env.TAX_COLLECTOR_BROWSERBASE_PROXY_ENABLED),
      batchApprovalRequired,
      batchApprovedByEnv,
      maxBatchSessions,
      maxConcurrency,
    },
  };
}

function clerkCommercialApiConnectionStatus(env: RuntimeEnv, checkedAt: string): ConnectionStatus {
  const authConfigured = Boolean(env.MIAMI_DADE_CLERK_AUTH_KEY || env.MIAMI_DADE_COMMERCIAL_AUTH_KEY || env.CLERK_COMMERCIAL_AUTH_KEY);
  const baseUrl = env.MIAMI_DADE_CLERK_API_BASE || "https://www2.miamidadeclerk.gov/Developers/api";
  return {
    name: "Miami-Dade Clerk API",
    ok: authConfigured,
    mode: authConfigured ? "review" : "blocked",
    configuredMode: authConfigured ? "commercial_api" : "none",
    message: authConfigured
      ? "Miami-Dade Clerk Commercial Data Services AuthKey is configured. Official Records and Civil/Family/Probate API calls can run, but each returned fact still needs review before legal or outreach use."
      : "Official Records and Civil/Family/Probate APIs require a Miami-Dade Clerk Commercial Data Services AuthKey and pre-paid units before HeirRight can run them automatically.",
    checkedAt,
    blockers: authConfigured ? [] : ["Add Miami-Dade Clerk Commercial Data Services access before claiming Official Records or Probate/Court automation."],
    sourceAutomation: {
      officialRecordsApi: "api/OfficialRecords?parameter1={folio}&parameter2=FN&authKey=...",
      civilCaseApi: "api/Civil?caseNumber={caseNumber}&AuthKey=...",
      civilDocketApi: "api/Civil?civilCaseNumber={caseNumber}&AuthKey=...",
      baseUrl,
    },
  };
}

function vitalObituaryWorkflowConnectionStatus(env: RuntimeEnv, checkedAt: string): ConnectionStatus {
  const workflowUrl = env.OBITUARY_VITAL_WORKFLOW_URL
    || env.VITAL_OBITUARY_WORKFLOW_URL
    || env.MARRIAGE_DEATH_WORKFLOW_URL;
  const browserbaseFunctionConfigured = Boolean(
    env.BROWSERBASE_API_KEY
      && (env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID
        || env.VITAL_OBITUARY_BROWSERBASE_FUNCTION_ID
        || env.MARRIAGE_DEATH_BROWSERBASE_FUNCTION_ID
        || env.BROWSERBASE_VITAL_OBITUARY_FUNCTION_ID)
  );
  const configured = Boolean(workflowUrl || browserbaseFunctionConfigured);
  return {
    name: "Vital/Obituary Workflow",
    ok: configured,
    mode: configured ? "review" : "blocked",
    configuredMode: configured ? "browser_workflow" : "none",
    message: configured
      ? "Vital, obituary, marriage-license, death-certificate, and deceased-indicator workflow is configured. Returned facts stay review-gated before Closing Prep uses them."
      : "Vital, obituary, marriage-license, death-certificate, Findagrave/Legacy, and deceased-indicator review needs a configured browser/API workflow before Discovery can fill those facts automatically.",
    checkedAt,
    blockers: configured ? [] : ["Add the vital/obituary browser workflow before claiming obituary, marriage, death, or deceased-indicator automation."],
    sourceAutomation: {
      workflowConfigured: configured,
      browserbaseFunctionConfigured,
      supports: ["obituary", "marriageLicense", "dateOfBirth", "dateOfDeath", "deathCertificateStatus", "incarcerationStatus"],
    },
  };
}

function idiCoreConnectionStatus(env: RuntimeEnv, checkedAt: string): ConnectionStatus {
  const api = idiCoreApiDetails(env);
  const apiConfigured = idiCoreApiConfigured(env);
  const liveApproved = env.IDI_CORE_LIVE_RUN_APPROVED === "true";
  const portalConfigured = idiCorePortalConfigured(env);
  const searchUrl = env.IDI_CORE_PORTAL_URL || env.IDI_CORE_SEARCH_URL || "https://idicore.com/search/PropertySearch";
  const loginUrl = env.IDI_CORE_LOGIN_URL || "https://login.idicore.com/";
  if (apiConfigured) {
    return {
      name: "IDI Core",
      ok: liveApproved,
      mode: liveApproved ? "live" : "review",
      configuredMode: "api",
      message: liveApproved
        ? "idiCORE API access and paid-run approval are configured for the controlled Asset Discovery path."
        : "idiCORE API access is configured; paid runs still require review-owner approval before Discovery can spend a lookup.",
      checkedAt,
      portal: { configured: portalConfigured, searchUrl, loginUrl },
      api: { ...api, accessConfigured: true, liveRunApproved: liveApproved },
    };
  }
  if (portalConfigured) {
    return {
      name: "IDI Core",
      ok: true,
      mode: "review",
      configuredMode: "operator_portal",
      message: "idiCORE portal access is confirmed for approved operator searches. Backend paid-run automation still needs IDI API access; import the approved report after the controlled search.",
      checkedAt,
      portal: { configured: true, searchUrl, loginUrl },
      api: { ...api, accessConfigured: false, liveRunApproved: liveApproved },
      apiRequest: {
        status: "pending_vendor_credentials",
        requestedCredentials: ["API Secret", "Site Key", "Company Key"],
        supportEmail: "idicoresupport@ididata.com",
        backendAutomationAllowed: false,
        manualImportAllowed: true,
      },
      blockers: [
        api.endpointConfigured
          ? "Team-default IDI Core API access is not configured here; a user can paste their own key for one approved run."
          : "Backend IDI Core live runs need IDI-issued API Secret, Site Key, and Company Key before they can execute from HeirRight."
      ],
    };
  }
  return {
    name: "IDI Core",
    ok: false,
    mode: "blocked",
    configuredMode: "none",
    message: "idiCORE is not configured. Add either approved API access for backend live runs or the confirmed operator portal account for report import.",
    checkedAt,
    portal: { configured: false, searchUrl, loginUrl },
    api: { ...api, accessConfigured: false, liveRunApproved: liveApproved },
    blockers: ["IDI Core portal/account confirmation or vendor API access is missing."],
  };
}

function routeResult(input: Omit<ExportRouteResult, "blockers"> & { blockers?: string[] }): ExportRouteResult {
  return {
    blockers: input.blockers ?? [],
    ...input,
  };
}

function reportTitle(dossier: RawDossier, overrideTitle?: string): string {
  return overrideTitle || `Completed Lead Report - ${dossier.summary.displayName}`;
}

function reportText(dossier: RawDossier, overrideBody?: string): string {
  return overrideBody || (
    dossier.completedLeadReport?.formats.markdown
    ?? dossier.documentPacket?.formats.markdown
    ?? dossier.narrative
    ?? reportTitle(dossier)
  );
}

function uniqueEmails(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || "").trim().toLowerCase())
    .filter((value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function resolveGoogleWorkspaceTargets(env: RuntimeEnv, options: GoogleWorkspaceExportOptions = {}): GoogleWorkspaceTargets {
  const workspaceDestination = options.workspaceDestination
    || env.GOOGLE_WORKSPACE_DESTINATION
    || "heirright";
  const workspaceDestinationEmail = options.workspaceDestinationEmail
    || env.GOOGLE_WORKSPACE_DESTINATION_EMAIL
    || env.HEIRRIGHT_WORKSPACE_EMAIL;
  const shareWithEmails = uniqueEmails([
    workspaceDestinationEmail,
    ...(options.shareWithEmails ?? []),
    options.requestedByEmail,
  ]);
  return { workspaceDestination, workspaceDestinationEmail, shareWithEmails };
}

function normalizedEmailSet(values: Array<string | undefined>): Set<string> {
  return new Set(uniqueEmails(values));
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function missingEmailConfirmations(requested: string[], confirmed: string[]): string[] {
  const confirmedSet = normalizedEmailSet(confirmed);
  return requested.filter((email) => !confirmedSet.has(email));
}

async function shareGoogleFileWithEmails(fileId: string, token: string, emails: string[]): Promise<string[]> {
  const blockers: string[] = [];
  for (const email of emails) {
    const response = await googleFetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=false&supportsAllDrives=true`,
      token,
      {
        method: "POST",
        body: JSON.stringify({
          type: "user",
          role: "writer",
          emailAddress: email,
        }),
      },
    );
    if (!response.ok) blockers.push(`Google Drive permission failed for ${email} on ${fileId}: ${response.status}`);
  }
  return blockers;
}

async function shareGoogleFilesWithEmails(fileIds: string[], token: string, emails: string[]): Promise<string[]> {
  if (!fileIds.length || !emails.length) return [];
  const blockers: string[] = [];
  for (const fileId of fileIds) blockers.push(...await shareGoogleFileWithEmails(fileId, token, emails));
  return blockers;
}

async function exportGoogleWebhook(
  dossier: RawDossier,
  env: RuntimeEnv,
  dryRun: boolean,
  documentTitle?: string,
  documentBody?: string,
  options: GoogleWorkspaceExportOptions = {},
): Promise<ExportRouteResult | null> {
  if (!env.GOOGLE_WORKSPACE_WEBHOOK_URL) return null;
  if (!env.GOOGLE_WORKSPACE_WEBHOOK_SECRET) {
    return routeResult({
      route: "google",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: ["Missing Google Workspace webhook secret."],
      message: "Google Workspace webhook export is blocked until the shared webhook secret is configured.",
    });
  }
  if (dryRun) {
    return routeResult({
      route: "google",
      ok: true,
      mode: "dry_run",
      readbackOk: false,
      externalId: `dry-google-webhook-${slug(dossier.id)}`,
      blockers: ["Live Google readback skipped in dry-run mode."],
      message: "Google Workspace webhook export is prepared for controlled live export.",
    });
  }
  if (env[GOOGLE_LIVE_WRITE_APPROVAL_KEY] !== "true") {
    return routeResult({
      route: "google",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`${GOOGLE_LIVE_WRITE_APPROVAL_KEY}=true is required before writing through the Google Workspace webhook.`],
      message: "Google live export is blocked by the explicit write-approval guard.",
    });
  }
  const { workspaceDestination, workspaceDestinationEmail, shareWithEmails } = resolveGoogleWorkspaceTargets(env, options);
  const response = await fetch(env.GOOGLE_WORKSPACE_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-heirright-workspace-secret": env.GOOGLE_WORKSPACE_WEBHOOK_SECRET,
    },
    body: JSON.stringify({
      source: "HeirRight Leads",
      secret: env.GOOGLE_WORKSPACE_WEBHOOK_SECRET,
      dossierId: dossier.id,
      displayName: dossier.summary.displayName,
      propertyAddress: dossier.property.address.value,
      folio: dossier.property.parcelId.value,
      county: formatCountyName(dossier.property.county.value),
      title: reportTitle(dossier, documentTitle),
      markdown: reportText(dossier, documentBody),
      workspaceDestination,
      workspaceDestinationEmail,
      shareWithEmails,
      shareWith: shareWithEmails,
      shareWithEmail: shareWithEmails[0],
      viewerEmails: shareWithEmails,
      viewers: shareWithEmails,
      collaboratorEmails: shareWithEmails,
      accessEmails: shareWithEmails,
      requestedByEmail: options.requestedByEmail,
      generatedAt: nowIso(),
    }),
  });
  const data = await response.json().catch(() => ({})) as {
    ok?: boolean;
    docId?: string;
    docUrl?: string;
    folderId?: string;
    folderUrl?: string;
    sheetId?: string;
    updatedRange?: string;
    workspaceDestination?: string;
    workspaceDestinationEmail?: string;
    sharedWithEmails?: string[];
    shareWithEmails?: string[];
    viewerEmails?: string[];
    collaboratorEmails?: string[];
    accessEmails?: string[];
    permissionEmails?: string[];
    readbackOk?: boolean;
    blockers?: string[];
    message?: string;
  };
  const confirmedShareEmails = uniqueEmails([
    ...(Array.isArray(data.sharedWithEmails) ? data.sharedWithEmails : []),
    ...(Array.isArray(data.shareWithEmails) ? data.shareWithEmails : []),
    ...(Array.isArray(data.viewerEmails) ? data.viewerEmails : []),
    ...(Array.isArray(data.collaboratorEmails) ? data.collaboratorEmails : []),
    ...(Array.isArray(data.accessEmails) ? data.accessEmails : []),
    ...(Array.isArray(data.permissionEmails) ? data.permissionEmails : []),
  ]);
  const postWebhookAccessToken = response.ok && data.docId ? env.GOOGLE_WORKSPACE_ACCESS_TOKEN : undefined;
  const webhookReportedAccess = confirmedShareEmails.length > 0;
  const canApplyPostWebhookSharing = Boolean(postWebhookAccessToken);
  const postWebhookShareBlockers = postWebhookAccessToken
    ? await shareGoogleFilesWithEmails(
        uniqueStrings([data.docId, data.folderId]),
        postWebhookAccessToken,
        missingEmailConfirmations(shareWithEmails, confirmedShareEmails),
      )
    : [];
  const sharedWithEmails = uniqueEmails([
    ...confirmedShareEmails,
    ...(!webhookReportedAccess || (canApplyPostWebhookSharing && !postWebhookShareBlockers.length) ? shareWithEmails : []),
  ]);
  const missingShareEmails = missingEmailConfirmations(shareWithEmails, sharedWithEmails);
  const blockers = [
    ...(response.ok ? [] : [`Google Workspace webhook failed: ${response.status}`]),
    ...(data.blockers ?? []),
    ...(data.readbackOk ? [] : ["Google Workspace webhook did not return readback proof."]),
    ...(webhookReportedAccess && missingShareEmails.length ? [`Google Workspace webhook did not confirm Drive access for: ${missingShareEmails.join(", ")}.`] : []),
    ...postWebhookShareBlockers,
  ];
  return routeResult({
    route: "google",
    ok: Boolean(response.ok && data.ok && data.readbackOk && !blockers.length),
    mode: "live",
    externalId: data.docId || data.updatedRange,
    url: data.docUrl || data.folderUrl,
    workspaceDestination: data.workspaceDestination || data.workspaceDestinationEmail || workspaceDestination,
    sharedWithEmails,
    readbackOk: Boolean(data.readbackOk),
    blockers,
    message: data.message || (blockers.length
      ? "Google Workspace webhook export needs review before handoff."
      : "Google Workspace webhook created the Doc, appended the Sheet row, and returned readback proof."),
  });
}

async function googleFetch(path: string, token: string, init: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: {
      "authorization": `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

async function exportGoogle(
  dossier: RawDossier,
  env: RuntimeEnv,
  dryRun: boolean,
  documentTitle?: string,
  documentBody?: string,
  options: GoogleWorkspaceExportOptions = {},
): Promise<ExportRouteResult> {
  const webhook = await exportGoogleWebhook(dossier, env, dryRun, documentTitle, documentBody, options);
  if (webhook) return webhook;

  const required = ["GOOGLE_WORKSPACE_ACCESS_TOKEN", "GOOGLE_TRACKING_SHEET_ID"];
  const missingConfig = missing(required, env);
  if (missingConfig.length) {
    return routeResult({
      route: "google",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`Missing Google Workspace config: ${missingConfig.join(", ")}`],
      message: "Google export is blocked until Drive/Docs/Sheets credentials are configured.",
    });
  }

  if (dryRun) {
    return routeResult({
      route: "google",
      ok: true,
      mode: "dry_run",
      readbackOk: false,
      externalId: `dry-google-${slug(dossier.id)}`,
      blockers: ["Live Google readback skipped in dry-run mode."],
      message: "Google Drive folder, Doc, and Sheet row are prepared for controlled live export.",
    });
  }

  if (env[GOOGLE_LIVE_WRITE_APPROVAL_KEY] !== "true") {
    return routeResult({
      route: "google",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`${GOOGLE_LIVE_WRITE_APPROVAL_KEY}=true is required before writing the controlled Google test row.`],
      message: "Google live export is blocked by the explicit write-approval guard.",
    });
  }

  const token = env.GOOGLE_WORKSPACE_ACCESS_TOKEN as string;
  const { workspaceDestination, shareWithEmails } = resolveGoogleWorkspaceTargets(env, options);
  const folderResponse = await googleFetch("https://www.googleapis.com/drive/v3/files", token, {
    method: "POST",
    body: JSON.stringify({
      name: reportTitle(dossier, documentTitle),
      mimeType: "application/vnd.google-apps.folder",
      parents: env.GOOGLE_DRIVE_PARENT_FOLDER_ID ? [env.GOOGLE_DRIVE_PARENT_FOLDER_ID] : undefined,
    }),
  });
  if (!folderResponse.ok) {
    return routeResult({
      route: "google",
      ok: false,
      mode: "live",
      readbackOk: false,
      blockers: [`Drive folder create failed: ${folderResponse.status}`],
      message: "Google export failed before report document creation.",
    });
  }
  const folder = await folderResponse.json() as { id: string; webViewLink?: string };

  const docResponse = await googleFetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", token, {
    method: "POST",
    body: JSON.stringify({
      name: reportTitle(dossier, documentTitle),
      mimeType: "application/vnd.google-apps.document",
      parents: [folder.id],
    }),
  });
  if (!docResponse.ok) {
    return routeResult({
      route: "google",
      ok: false,
      mode: "live",
      externalId: folder.id,
      url: folder.webViewLink,
      readbackOk: false,
      blockers: [`Google Doc create failed: ${docResponse.status}`],
      message: "Google export created the folder but failed to create the report Doc.",
    });
  }
  const doc = await docResponse.json() as { id: string; webViewLink?: string };

  const writeResponse = await googleFetch(`https://docs.googleapis.com/v1/documents/${doc.id}:batchUpdate`, token, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: 1 }, text: reportText(dossier, documentBody) } }],
    }),
  });
  if (!writeResponse.ok) {
    return routeResult({
      route: "google",
      ok: false,
      mode: "live",
      externalId: doc.id,
      url: doc.webViewLink ?? `https://docs.google.com/document/d/${doc.id}/edit`,
      readbackOk: false,
      blockers: [`Google Doc write failed: ${writeResponse.status}`],
      message: "Google export created the report Doc but failed to write the completed report body.",
    });
  }

  const shareBlockers = await shareGoogleFilesWithEmails([folder.id, doc.id], token, shareWithEmails);

  const row = [[
    nowIso(),
    dossier.summary.displayName,
    dossier.property.address.value ?? "",
    formatCountyName(dossier.property.county.value, ""),
    dossier.completedLeadReport?.leadQualityProfile.leadBucket ?? "review_required",
    doc.id,
    folder.id,
  ]];
  const range = encodeURIComponent(env.GOOGLE_TRACKING_SHEET_RANGE || "Lead Reports!A:G");
  const sheetResponse = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_TRACKING_SHEET_ID}/values/${range}:append?valueInputOption=RAW`,
    token,
    { method: "POST", body: JSON.stringify({ values: row }) },
  );
  const sheetAppend = sheetResponse.ok
    ? await sheetResponse.json().catch(() => ({})) as { updates?: { updatedRange?: string } }
    : {};
  const updatedRange = sheetAppend.updates?.updatedRange;
  const sheetReadbackResponse = sheetResponse.ok && updatedRange
    ? await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_TRACKING_SHEET_ID}/values/${encodeURIComponent(updatedRange)}`,
        token,
        { method: "GET" },
      )
    : null;
  const sheetReadback = sheetReadbackResponse?.ok
    ? await sheetReadbackResponse.json().catch(() => ({})) as { values?: unknown[][] }
    : {};
  const sheetReadbackOk = Boolean(sheetReadbackResponse?.ok && sheetReadback.values?.some((readRow) => readRow.includes(dossier.summary.displayName)));
  const readbackResponse = await googleFetch(`https://www.googleapis.com/drive/v3/files/${doc.id}?fields=id,webViewLink`, token, {
    method: "GET",
  });
  const readbackOk = sheetResponse.ok && sheetReadbackOk && readbackResponse.ok;
  const blockers = [
    ...shareBlockers,
    ...(sheetResponse.ok ? [] : [`Google Sheet append failed: ${sheetResponse.status}`]),
    ...(sheetResponse.ok && !updatedRange ? ["Google Sheet append response did not include a readback range."] : []),
    ...(sheetResponse.ok && updatedRange && !sheetReadbackResponse?.ok ? [`Google Sheet readback failed: ${sheetReadbackResponse?.status ?? "not available"}`] : []),
    ...(sheetReadbackResponse?.ok && !sheetReadbackOk ? ["Google Sheet readback did not include the controlled test row label."] : []),
    ...(readbackResponse.ok ? [] : [`Google report readback failed: ${readbackResponse.status}`]),
  ];

  return routeResult({
    route: "google",
    ok: readbackOk && !blockers.length,
    mode: "live",
    externalId: doc.id,
    url: doc.webViewLink ?? `https://docs.google.com/document/d/${doc.id}/edit`,
    workspaceDestination,
    sharedWithEmails: shareBlockers.length ? [] : shareWithEmails,
    readbackOk,
    blockers,
    message: readbackOk
      ? "Google export created the folder, report Doc, tracking Sheet row, and read the controlled row back."
      : "Google export created the report Doc but failed one or more tracking Sheet readback checks.",
  });
}

interface PodioFieldBuild {
  fields: Record<string, unknown>;
  blockers: string[];
  mapSource: string;
}

function podioEntryField(entry: PodioFieldMapEntry): string {
  return typeof entry === "string" ? entry : entry.field;
}

function podioEntryKind(entry: PodioFieldMapEntry): PodioFieldKind {
  return typeof entry === "string" ? "text" : (entry.kind ?? "text");
}

function hasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function normalizePodioInput(value: unknown): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function rawPodioValueByKey(dossier: RawDossier, env: RuntimeEnv, reportUrl?: string): Record<string, unknown> {
  const leadBucket = dossier.completedLeadReport?.leadQualityProfile.leadBucket ?? "review_required";
  const reportStatus = dossier.completedLeadReport?.reviewGate.reportStatus ?? "internal_draft";
  const valueByKey: Record<string, unknown> = {
    title: dossier.summary.displayName,
    estate_name: dossier.summary.estateName ?? dossier.summary.displayName,
    lead_status: leadBucket,
    report_status: reportStatus,
    deal_status: "needs_to_be_contacted",
    property_address: dossier.property.address.value,
    county: formatCountyName(dossier.property.county.value),
    folio: dossier.property.parcelId.value,
    lead_bucket: leadBucket,
    next_action: dossier.summary.nextBestAction,
    report_link: reportUrl || env.PODIO_REPORT_FILE_URL,
    case_number: dossier.summary.caseNumber ?? dossier.property.caseNumber.value,
    phone: env.PODIO_TEST_PHONE,
    date_created: nowIso().slice(0, 10),
    spanish_lead: "no",
    email: env.PODIO_TEST_EMAIL,
    lead_source: "HeirRight controlled API test",
    lead_point: env.PODIO_LEAD_POINT_PROFILE_ID,
    first_call: "n_a",
    asking_price: "0",
    occupancy: "vacant",
    best_call_time: "anytime",
    listed: "no",
  };
  return valueByKey;
}

function defaultPodioValue(entry: PodioFieldMapEntry, env: RuntimeEnv): unknown {
  if (typeof entry === "string") return undefined;
  if (entry.defaultEnv && hasValue(env[entry.defaultEnv])) return env[entry.defaultEnv];
  if (entry.defaultValue === "today") return nowIso().slice(0, 10);
  return entry.defaultValue;
}

function resolveMappedPodioValue(entry: PodioFieldMapEntry, rawValue: unknown, env: RuntimeEnv): unknown {
  const configured = typeof entry === "string" ? undefined : entry;
  const defaultValue = defaultPodioValue(entry, env);
  if (!hasValue(rawValue)) return defaultValue;
  if (!configured?.valueByInput) return rawValue;
  const mapped = configured.valueByInput[normalizePodioInput(rawValue)];
  return mapped ?? defaultValue;
}

function encodePodioFieldValue(kind: PodioFieldKind, value: unknown): unknown {
  if (kind === "category") return { value: Number(value) };
  if (kind === "contact") return { value: Number(value) };
  if (kind === "date") return { start_date: String(value) };
  if (kind === "location") return { value: String(value) };
  return { value: String(value) };
}

function invalidEncodedValue(kind: PodioFieldKind, value: unknown): string | null {
  if (kind !== "category" && kind !== "contact") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return null;
  return kind === "contact"
    ? "PODIO_LEAD_POINT_PROFILE_ID must be a numeric Podio profile id for the required Lead point contact field."
    : `Podio category field value must resolve to a numeric option id; received ${String(value)}.`;
}

export async function resolvePodioAccessToken(env: RuntimeEnv): Promise<{ token?: string; mode: "bearer" | "app_auth" | "refresh" | "browser_refresh" | "missing"; blocker?: string; refreshTokenRotated?: boolean }> {
  const clientId = podioClientId(env);
  const clientSecret = podioClientSecret(env);
  const appId = podioAppId(env);
  const appToken = podioAppToken(env);
  const serverRefreshToken = podioServerRefreshToken(env);
  const browserRefreshToken = podioBrowserRefreshToken(env);
  const refreshToken = serverRefreshToken || browserRefreshToken;
  const accessToken = podioAccessToken(env);

  if (clientId && clientSecret && appId && appToken) {
    const body = new URLSearchParams({
      grant_type: "app",
      app_id: appId,
      app_token: appToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const response = await fetch("https://api.podio.com/oauth/token/v2", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
      body,
    });
    const data = await response.json().catch(() => ({})) as { access_token?: string; error?: string; error_description?: string };
    if (response.ok && data.access_token) {
      return { token: data.access_token, mode: "app_auth" };
    }
    return {
      mode: "app_auth",
      blocker: `Podio app-auth token exchange failed: ${response.status}${data.error ? ` ${data.error}` : ""}${data.error_description ? ` - ${data.error_description}` : ""}`,
    };
  }
  if (clientId && clientSecret && refreshToken) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const response = await fetch("https://api.podio.com/oauth/token/v2", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
      body,
    });
    const data = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
    if (response.ok && data.access_token) {
      return {
        token: data.access_token,
        mode: serverRefreshToken ? "refresh" : "browser_refresh",
        refreshTokenRotated: Boolean(data.refresh_token && data.refresh_token !== refreshToken),
      };
    }
    return {
      mode: serverRefreshToken ? "refresh" : "browser_refresh",
      blocker: `Podio refresh-token exchange failed: ${response.status}${data.error ? ` ${data.error}` : ""}${data.error_description ? ` - ${data.error_description}` : ""}`,
    };
  }
  if (accessToken) return { token: accessToken, mode: "bearer" };
  return {
    mode: "missing",
    blocker: "Missing Podio access: configure a Podio access token, refresh token, or client/app token set.",
  };
}

export function podioReadbackBlockerMessage(status: number, body: unknown): string {
  const raw = typeof body === "string" ? body : JSON.stringify(body ?? "");
  const normalized = raw.toLowerCase();
  if (status === 401 || normalized.includes("expired_token") || normalized.includes("unauthorized")) {
    return [
      "Podio access has expired.",
      "Reconnect Podio with the approved HeirRight account, or add the Leads app token as the fallback.",
      "Outreach stays staged for Podio review until the Leads app readback succeeds.",
    ].join(" ");
  }
  if (status === 403) {
    return "Podio access is connected, but this account cannot read the Leads app. Grant access to the Texas Equity Pros Leads app, then run readback again.";
  }
  if (status === 404) {
    return "Podio access is connected, but the configured Leads app was not found. Confirm the Podio workspace and Leads app before exporting.";
  }
  return "Podio access is configured, but the Leads app readback did not complete. Keep outreach staged until the app readback succeeds.";
}

async function podioAuthHeaders(env: RuntimeEnv): Promise<{ headers?: Record<string, string>; mode: "bearer" | "app_auth" | "refresh" | "browser_refresh" | "missing"; blocker?: string }> {
  const resolved = await resolvePodioAccessToken(env);
  if (!resolved.token) return { mode: resolved.mode, blocker: resolved.blocker };
  return {
    mode: resolved.mode,
    headers: {
      "authorization": `Bearer ${resolved.token}`,
      "content-type": "application/json; charset=utf-8",
    },
  };
}

function podioFields(dossier: RawDossier, env: RuntimeEnv, reportUrl?: string): PodioFieldBuild {
  const fieldMap = resolvePodioFieldMap(env);
  if (fieldMap.blockers.length) {
    return { fields: {}, blockers: fieldMap.blockers, mapSource: fieldMap.source };
  }
  const valueByKey = rawPodioValueByKey(dossier, env, reportUrl);
  const fields: Record<string, unknown> = {};
  const blockers: string[] = [];
  for (const [key, entry] of Object.entries(fieldMap.map)) {
    const fieldId = podioEntryField(entry);
    const kind = podioEntryKind(entry);
    const mappedValue = resolveMappedPodioValue(entry, valueByKey[key], env);
    const requiredDefaultEnv = typeof entry === "string" ? undefined : entry.defaultEnv;
    const requiredForLive = typeof entry !== "string" && entry.requiredForLive;
    if (!hasValue(mappedValue)) {
      if (requiredForLive) {
        blockers.push(`Missing controlled Podio test value ${requiredDefaultEnv ?? key} for required Leads field ${fieldId}.`);
      }
      continue;
    }
    const invalid = invalidEncodedValue(kind, mappedValue);
    if (invalid) {
      blockers.push(invalid);
      continue;
    }
    fields[fieldId] = encodePodioFieldValue(kind, mappedValue);
  }
  return { fields, blockers, mapSource: fieldMap.source };
}

async function podioEnvWithLeadPoint(env: RuntimeEnv): Promise<RuntimeEnv> {
  if (env.PODIO_LEAD_POINT_PROFILE_ID) return env;
  const auth = await podioAuthHeaders(env);
  if (!auth.headers) return env;
  const response = await fetch("https://api.podio.com/user/status", {
    headers: auth.headers,
  });
  if (response.ok) {
    const data = await response.json().catch(() => ({})) as {
      profile_id?: number;
      profile?: { profile_id?: number };
      user?: { profile_id?: number; profile?: { profile_id?: number } };
    };
    const profileId = data.profile_id ?? data.profile?.profile_id ?? data.user?.profile_id ?? data.user?.profile?.profile_id;
    if (profileId) return { ...env, PODIO_LEAD_POINT_PROFILE_ID: String(profileId) };
  }

  const spaceId = env.PODIO_SPACE_ID || TEXAS_EQUITY_PROS_LEADS_SPACE_ID;
  const membersResponse = await fetch(`https://api.podio.com/space/${spaceId}/member/`, {
    headers: auth.headers,
  });
  if (!membersResponse.ok) return env;
  const members = await membersResponse.json().catch(() => []) as Array<{
    profile_id?: number;
    profile?: { profile_id?: number };
    user?: { profile_id?: number; profile?: { profile_id?: number } };
  }>;
  const member = members.find((item) => item.profile_id || item.profile?.profile_id || item.user?.profile_id || item.user?.profile?.profile_id);
  const memberProfileId = member?.profile_id ?? member?.profile?.profile_id ?? member?.user?.profile_id ?? member?.user?.profile?.profile_id;
  return memberProfileId ? { ...env, PODIO_LEAD_POINT_PROFILE_ID: String(memberProfileId) } : env;
}

async function exportPodio(dossier: RawDossier, env: RuntimeEnv, dryRun: boolean, reportUrl?: string): Promise<ExportRouteResult> {
  const podioEnv = await podioEnvWithLeadPoint(env);
  const missingConfig = podioMissingExportConfig(podioEnv);
  const fieldBuild = podioFields(dossier, podioEnv, reportUrl);
  if (missingConfig.length) {
    const configDetailBlockers = fieldBuild.blockers.filter((blocker) => !blocker.includes("PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877"));
    return routeResult({
      route: "podio",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`Missing Podio export config: ${missingConfig.join(", ")}`, ...configDetailBlockers],
      message: "Podio export is blocked until bearer-token access, target app, and a field map or verified Leads preset are configured.",
    });
  }

  if (!Object.keys(fieldBuild.fields).length) {
    return routeResult({
      route: "podio",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: ["Podio field map did not map any report fields.", ...fieldBuild.blockers],
      message: "Podio export has credentials but no usable field mapping.",
    });
  }

  if (dryRun) {
    return routeResult({
      route: "podio",
      ok: true,
      mode: "dry_run",
      readbackOk: false,
      externalId: `dry-podio-${slug(dossier.id)}`,
      blockers: ["Live Podio readback skipped in dry-run mode."],
      message: `Podio item, source note, report link, tasks, and readback are prepared for controlled live export using ${fieldBuild.mapSource}.`,
    });
  }

  if (!podioLiveWriteApproved(podioEnv)) {
    return routeResult({
      route: "podio",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`${PODIO_LIVE_WRITE_APPROVAL_KEY}=true is required before creating the controlled test Lead item.`],
      message: "Podio live export is blocked by the explicit write-approval guard.",
    });
  }

  if (fieldBuild.blockers.length) {
    return routeResult({
      route: "podio",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: fieldBuild.blockers,
      message: "Podio live export is blocked until required controlled test defaults are configured.",
    });
  }

  if (!podioCsvBackupConfirmed(podioEnv)) {
    return routeResult({
      route: "podio",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`${PODIO_CSV_BACKUP_CONFIRMATION_KEY}=true is required before the controlled Podio test write.`],
      message: "Podio live export is blocked until the CSV backup/export safety check is confirmed.",
    });
  }

  const auth = await podioAuthHeaders(podioEnv);
  if (!auth.headers) {
    return routeResult({
      route: "podio",
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [auth.blocker ?? "Podio authorization failed before item creation."],
      message: "Podio export is blocked until the Worker can mint or use a valid Podio access token.",
    });
  }

  const podioExternalId = `heirright-${slug(dossier.id)}-${Date.now()}`;

  const itemResponse = await fetch(`https://api.podio.com/item/app/${podioEnv.PODIO_APP_ID}/`, {
    method: "POST",
    headers: auth.headers,
    body: JSON.stringify({
      external_id: podioExternalId,
      fields: fieldBuild.fields,
      tags: ["heirright-controlled-test", "do-not-work"],
    }),
  });
  if (!itemResponse.ok) {
    return routeResult({
      route: "podio",
      ok: false,
      mode: "live",
      readbackOk: false,
      blockers: [`Podio item create failed: ${itemResponse.status}`],
      message: "Podio export failed before readback.",
    });
  }
  const item = await itemResponse.json() as { item_id?: number; link?: string };
  if (!item.item_id) {
    return routeResult({
      route: "podio",
      ok: false,
      mode: "live",
      readbackOk: false,
      blockers: ["Podio item create response did not include an item id."],
      message: "Podio export could not verify the created item.",
    });
  }

  const commentResponse = await fetch(`https://api.podio.com/comment/item/${item.item_id}/`, {
    method: "POST",
    headers: auth.headers,
    body: JSON.stringify({
      value: [
        "HeirRight completed report package is ready for review.",
        `Controlled test external id: ${podioExternalId}`,
        reportUrl ? `Report link: ${reportUrl}` : "Report link: configure Google export or PODIO_REPORT_FILE_URL before live handoff.",
        `Lead bucket: ${dossier.completedLeadReport?.leadQualityProfile.leadBucket ?? "review_required"}`,
      ].join("\n"),
    }),
  });
  const taskResponse = await fetch("https://api.podio.com/task/", {
    method: "POST",
    headers: auth.headers,
    body: JSON.stringify({
      text: `Review HeirRight report - ${dossier.summary.displayName}`,
      description: "Confirm source notes, missing data, offer math, and manual outreach approval before external use.",
      ref_type: "item",
      ref_id: item.item_id,
    }),
  });
  const task = taskResponse.ok ? await taskResponse.json().catch(() => ({})) as { task_id?: number; id?: number } : {};
  const taskId = task.task_id ?? task.id;

  const readbackResponse = await fetch(`https://api.podio.com/item/${item.item_id}`, {
    headers: auth.headers,
  });
  const commentReadbackResponse = commentResponse.ok
    ? await fetch(`https://api.podio.com/comment/item/${item.item_id}/`, {
        headers: auth.headers,
      })
    : null;
  const taskReadbackResponse = taskId
    ? await fetch(`https://api.podio.com/task/${taskId}`, {
        headers: auth.headers,
      })
    : null;
  const readbackOk = Boolean(readbackResponse.ok && commentReadbackResponse?.ok && taskReadbackResponse?.ok);
  const blockers = [
    ...(commentResponse.ok ? [] : [`Podio source-note comment failed: ${commentResponse.status}`]),
    ...(taskResponse.ok ? [] : [`Podio review task create failed: ${taskResponse.status}`]),
    ...(commentResponse.ok && !commentReadbackResponse?.ok ? [`Podio source-note comment readback failed: ${commentReadbackResponse?.status ?? "not available"}`] : []),
    ...(taskResponse.ok && !taskId ? ["Podio review task create response did not include a task id."] : []),
    ...(taskId && !taskReadbackResponse?.ok ? [`Podio review task readback failed: ${taskReadbackResponse?.status ?? "not available"}`] : []),
    ...(readbackResponse.ok ? [] : [`Podio readback failed: ${readbackResponse.status}`]),
  ];

  return routeResult({
    route: "podio",
    ok: !blockers.length,
    mode: "live",
    externalId: String(item.item_id ?? ""),
    url: item.link,
    readbackOk,
    blockers,
    message: blockers.length
      ? "Podio item was created, but one or more handoff/readback checks failed."
      : "Podio item, source note, review task, report link fields, and readback completed successfully.",
  });
}

export async function exportCompletedReport(request: ExportRequest, env: RuntimeEnv = process.env): Promise<ExportResult> {
  const routes = Array.from(new Set(request.routes.length ? request.routes : (["google", "podio"] as ExportRoute[])));
  const results: ExportRouteResult[] = [];
  let googleReportUrl: string | undefined;
  for (const route of routes) {
    if (route === "google") {
      const google = await exportGoogle(request.dossier, env, request.dryRun ?? true, request.documentTitle, request.documentBody, request);
      if (google.url) googleReportUrl = google.url;
      results.push(google);
      continue;
    }
    results.push(await exportPodio(request.dossier, env, request.dryRun ?? true, googleReportUrl));
  }

  const blockers = results.flatMap((result) => result.blockers);
  return {
    ok: results.every((result) => result.ok),
    generatedAt: nowIso(),
    dossierId: request.dossier.id,
    routes: results,
    blockers,
  };
}

export async function connectionStatuses(env: RuntimeEnv = process.env): Promise<ConnectionStatus[]> {
  const checkedAt = nowIso();
  const missingPodio = podioMissingExportConfig(env);
  const podioApproved = podioLiveWriteApproved(env);
  const podioBackup = podioCsvBackupConfirmed(env);
  const podioAuthState = podioAuthSummary(env);
  const podioAuth = missingPodio.length ? { token: undefined, blocker: missingPodio.join(", ") } : await resolvePodioAccessToken(env);
  const configuredPodioAppId = podioAppId(env) || "24265877";
  const podioReadback = podioAuth.token
    ? await fetch(`https://api.podio.com/app/${configuredPodioAppId}`, {
        headers: { "authorization": `Bearer ${podioAuth.token}` },
      }).then(async (response) => ({
        ok: response.ok,
        status: response.status,
        body: response.ok ? null : await response.text().catch(() => ""),
      })).catch((error) => ({ ok: false, status: 0, body: error instanceof Error ? error.message : String(error) }))
    : { ok: false, status: 0, body: podioAuth.blocker ?? "Missing Podio access token." };
  const googleWebhookReady = Boolean(env.GOOGLE_WORKSPACE_WEBHOOK_URL && env.GOOGLE_WORKSPACE_WEBHOOK_SECRET);
  const missingGoogle = googleWebhookReady ? [] : missing(["GOOGLE_WORKSPACE_ACCESS_TOKEN", "GOOGLE_TRACKING_SHEET_ID"], env);
  const googleApproved = env[GOOGLE_LIVE_WRITE_APPROVAL_KEY] === "true";
  const resendReady = Boolean(env.RESEND_API_KEY && env.RESEND_LIVE_SEND_APPROVED === "true");
  const smsProvider = env.SMS_CARRIER_GATEWAY || env.SMS_PROVIDER || env.PODIO_NATIVE_SMS_PATH;
  const podioAuthReady = podioAuthConfigured(env);
  const smsReady = Boolean((env.PODIO_NATIVE_SMS_APPROVED === "true" && podioAuthReady) || (smsProvider && env.SMS_GATEWAY_API_KEY && env.SMS_LIVE_SEND_APPROVED === "true"));
  const activepiecesReady = Boolean(env.ACTIVEPIECES_WEBHOOK_URL || env.HEIRRIGHT_ACTIVEPIECES_WEBHOOK_URL);
  const linearReady = Boolean((env.HEIRRIGHT_LINEAR_API_KEY || env.LINEAR_API_KEY) && (env.HEIRRIGHT_LINEAR_TEAM_ID || env.LINEAR_TEAM_ID));
  const leadsEngineReady = Boolean(env.HEIRRIGHT_ACCESS_WEBHOOK_URL || linearReady);
  return [
    {
      name: "Podio",
      ok: !missingPodio.length && podioApproved && podioBackup && podioReadback.ok && (!podioAuthState.durableRequired || podioAuthState.durableTeamAuth),
      mode: !missingPodio.length && podioApproved && podioBackup && podioReadback.ok && (!podioAuthState.durableRequired || podioAuthState.durableTeamAuth) ? "live" : podioReadback.ok ? "review" : "blocked",
      message: missingPodio.length
        ? `Podio export/readback config is missing: ${missingPodio.join(", ")}.`
        : !podioReadback.ok
          ? podioReadbackBlockerMessage(podioReadback.status, podioReadback.body)
        : podioAuthState.reconnectRequired
          ? "Podio readback works from this browser session, but team-durable access is not configured. Add the Leads app token or server refresh access before calling Podio production-ready."
        : !podioApproved
          ? `Podio bearer-token export config is present; controlled write still requires ${PODIO_LIVE_WRITE_APPROVAL_KEY}=true.`
          : !podioBackup
            ? `Podio controlled write still requires ${PODIO_CSV_BACKUP_CONFIRMATION_KEY}=true before mutation.`
            : "Podio access, Leads app readback, CSV backup confirmation, and controlled write approval are present.",
      checkedAt,
      auth: podioAuthState,
    },
    {
      name: "Google",
      ok: !missingGoogle.length && googleApproved,
      mode: !missingGoogle.length && googleApproved ? "live" : "blocked",
      message: missingGoogle.length
        ? "Google Drive/Docs/Sheets export config is missing."
        : googleApproved
          ? googleWebhookReady
            ? "Google Workspace webhook export and tracking readback are enabled."
            : "Google export config and controlled write approval are present."
          : `Google export config is present; controlled write still requires ${GOOGLE_LIVE_WRITE_APPROVAL_KEY}=true.`,
      checkedAt,
    },
    {
      name: "Resend",
      ok: resendReady,
      mode: resendReady ? "live" : "blocked",
      message: resendReady
        ? "Resend fallback is configured for approved internal email tests only."
        : "Resend fallback is blocked until RESEND_API_KEY and RESEND_LIVE_SEND_APPROVED=true are configured.",
      checkedAt,
    },
    {
      name: "SMS Gateway",
      ok: smsReady,
      mode: smsReady ? "live" : "blocked",
      message: smsReady
        ? "An approved SMS carrier or Podio-native SMS path is configured; app queues still require per-template approval."
        : "SMS delivery is blocked until an approved carrier gateway or Podio-native SMS path is configured and approved.",
      checkedAt,
    },
    {
      name: "Web Search",
      ok: true,
      mode: "dry_run",
      message: "Public web search/source checks are handled by the worker and reported per run.",
      checkedAt,
    },
    taxCollectorSourceConnectionStatus(env, checkedAt),
    clerkCommercialApiConnectionStatus(env, checkedAt),
    vitalObituaryWorkflowConnectionStatus(env, checkedAt),
    idiCoreConnectionStatus(env, checkedAt),
    browserbaseUsageConnectionStatus(env, checkedAt),
    {
      name: "Activepieces",
      ok: activepiecesReady,
      mode: activepiecesReady ? "live" : "blocked",
      message: activepiecesReady
        ? "Activepieces Podio outreach workflow webhook is configured."
        : "Activepieces webhook is not configured; first-party outreach fallback will stage Podio-ready packages and Linear setup tickets.",
      checkedAt,
    },
    {
      name: "Linear Support",
      ok: linearReady,
      mode: linearReady ? "live" : "blocked",
      message: linearReady
        ? "Linear support ticket filing is configured for integration/setup blockers."
        : "Linear support ticket filing is not configured on the Worker.",
      checkedAt,
    },
    {
      name: "Leads Engine Access",
      ok: leadsEngineReady,
      mode: leadsEngineReady ? "live" : "dry_run",
      message: leadsEngineReady
        ? "Leads engine access changes can be routed for approval."
        : "Leads engine access changes are captured in-app until access webhook or Linear support routing is configured.",
      checkedAt,
    },
  ];
}
