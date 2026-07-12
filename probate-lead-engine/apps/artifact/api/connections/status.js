function missing(keys, env) {
  return keys.filter((key) => !env[key]);
}

function envValue(env, keys) {
  return keys.map((key) => env[key]).find(Boolean);
}

function podioAccessToken(env) {
  return envValue(env, ["PODIO_ACCESS_TOKEN", "PODIO_OAUTH_ACCESS_TOKEN"]);
}

function podioRefreshToken(env) {
  return envValue(env, [
    "PODIO_DURABLE_REFRESH_TOKEN",
    "PODIO_TEAM_REFRESH_TOKEN",
    "PODIO_REFRESH_TOKEN",
    "PODIO_OAUTH_REFRESH_TOKEN",
    "PODIO_REFRESH_ACCESS_TOKEN",
    "PODIO_BROWSER_REFRESH_TOKEN",
  ]);
}

function podioServerRefreshToken(env) {
  return envValue(env, [
    "PODIO_DURABLE_REFRESH_TOKEN",
    "PODIO_TEAM_REFRESH_TOKEN",
    "PODIO_REFRESH_TOKEN",
    "PODIO_OAUTH_REFRESH_TOKEN",
    "PODIO_REFRESH_ACCESS_TOKEN",
  ]);
}

function podioBrowserRefreshToken(env) {
  return envValue(env, ["PODIO_BROWSER_REFRESH_TOKEN"]);
}

function podioClientId(env) {
  return envValue(env, ["PODIO_CLIENT_ID", "PODIO_API_CLIENT_ID"]);
}

function podioClientSecret(env) {
  return envValue(env, ["PODIO_CLIENT_SECRET", "PODIO_API_CLIENT_SECRET"]);
}

function podioAppId(env) {
  return envValue(env, ["PODIO_APP_ID", "PODIO_LEADS_APP_ID"]);
}

function podioAppToken(env) {
  return envValue(env, ["PODIO_APP_TOKEN", "PODIO_LEADS_APP_TOKEN"]);
}

function podioAuthConfigured(env) {
  const clientId = podioClientId(env);
  const clientSecret = podioClientSecret(env);
  return Boolean(
    podioAccessToken(env)
      || (clientId && clientSecret && podioRefreshToken(env))
      || (clientId && clientSecret && podioAppId(env) && podioAppToken(env))
  );
}

function podioAutoRefreshConfigured(env) {
  const clientId = podioClientId(env);
  const clientSecret = podioClientSecret(env);
  return Boolean(
    clientId
      && clientSecret
      && (podioRefreshToken(env) || (podioAppId(env) && podioAppToken(env)))
  );
}

function podioAuthSummary(env) {
  const clientId = podioClientId(env);
  const clientSecret = podioClientSecret(env);
  const appTokenConfigured = Boolean(clientId && clientSecret && podioAppId(env) && podioAppToken(env));
  const serverRefreshConfigured = Boolean(clientId && clientSecret && podioServerRefreshToken(env));
  const browserSessionRefresh = Boolean(clientId && clientSecret && podioBrowserRefreshToken(env));
  const bearerTokenConfigured = Boolean(podioAccessToken(env));
  const durableTeamAuth = appTokenConfigured || serverRefreshConfigured || bearerTokenConfigured;
  const durableRequired = env.PODIO_DURABLE_AUTH_REQUIRED !== "false";
  const perUserRequired = env.PODIO_PER_USER_AUTH_REQUIRED === "true";
  const userScopedRefresh = env.PODIO_USER_SCOPED_REFRESH === "true" || browserSessionRefresh;
  const accessRequirementMet = perUserRequired ? userScopedRefresh : (!durableRequired || durableTeamAuth);
  return {
    mode: appTokenConfigured
      ? "app_auth"
      : serverRefreshConfigured
        ? "refresh"
        : browserSessionRefresh
          ? "browser_refresh"
          : bearerTokenConfigured
            ? "bearer"
            : "missing",
    durableTeamAuth,
    appTokenConfigured,
    serverRefreshConfigured,
    browserSessionRefresh,
    bearerTokenConfigured,
    reconnectRequired: !accessRequirementMet,
    durableRequired,
    perUserRequired,
    userScopedRefresh,
    accessRequirementMet,
  };
}

function truthyEnv(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function positiveIntegerEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function podioMissingConfig(env) {
  const missingKeys = podioAppId(env) ? [] : ["PODIO_APP_ID"];
  if (!podioAuthConfigured(env)) {
    missingKeys.push("PODIO_ACCESS_TOKEN, PODIO_REFRESH_TOKEN, or PODIO_CLIENT_ID/PODIO_CLIENT_SECRET/PODIO_APP_TOKEN");
  }
  if (!env.PODIO_FIELD_MAP_JSON && podioAppId(env) !== "24265877") {
    missingKeys.push("PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877");
  }
  return Array.from(new Set([
    ...missingKeys,
    ...missing(["PODIO_TEST_PHONE", "PODIO_TEST_EMAIL", "PODIO_LEAD_POINT_PROFILE_ID"], env),
  ]));
}

function googleMissingConfig(env) {
  if (env.GOOGLE_WORKSPACE_WEBHOOK_URL && env.GOOGLE_WORKSPACE_WEBHOOK_SECRET) return [];
  return missing(["GOOGLE_WORKSPACE_ACCESS_TOKEN", "GOOGLE_TRACKING_SHEET_ID"], env);
}

function resendMissingConfig(env) {
  return ["RESEND_API_KEY", "RESEND_LIVE_SEND_APPROVED"].filter((key) => {
    if (key === "RESEND_LIVE_SEND_APPROVED") return env[key] !== "true";
    return !env[key];
  });
}

function smsMissingConfig(env) {
  if (env.PODIO_NATIVE_SMS_APPROVED === "true" && podioAuthConfigured(env)) return [];
  return ["SMS_CARRIER_GATEWAY", "SMS_GATEWAY_API_KEY", "SMS_LIVE_SEND_APPROVED"].filter((key) => {
    if (key === "SMS_LIVE_SEND_APPROVED") return env[key] !== "true";
    return !env[key];
  });
}

function activepiecesMissingConfig(env) {
  return ["ACTIVEPIECES_WEBHOOK_URL"].filter((key) => !env[key] && !env.HEIRRIGHT_ACTIVEPIECES_WEBHOOK_URL);
}

function idiCorePortalConfigured(env) {
  return Boolean(
    (env.IDI_CORE_PORTAL_URL || env.IDI_CORE_SEARCH_URL)
      && (env.IDI_CORE_ACCOUNT_ID || env.IDI_CORE_ACCOUNT_COMPANY || env.IDI_CORE_OPERATOR_EMAIL)
  );
}

function idiCoreApiDetails(env) {
  return {
    endpointConfigured: Boolean(env.IDI_CORE_API_URL),
    sharedDefaultConfigured: Boolean(env.IDI_CORE_API_TOKEN || env.HEIRRIGHT_IDI_CORE_API_TOKEN || env.IDI_CORE_API_KEY),
    userOverrideAllowed: true,
  };
}

function idiCoreApiConfigured(env) {
  const api = idiCoreApiDetails(env);
  return Boolean(api.endpointConfigured && api.sharedDefaultConfigured);
}

function taxCollectorSourceStatus(env, checkedAt = new Date().toISOString()) {
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

function clerkCommercialApiStatus(env, checkedAt = new Date().toISOString()) {
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

function vitalObituaryWorkflowStatus(env, checkedAt = new Date().toISOString()) {
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

function browserbaseUsageStatus(env, checkedAt = new Date().toISOString()) {
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

function idiCoreStatus(env, checkedAt = new Date().toISOString()) {
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

function linearMissingConfig(env) {
  return ["HEIRRIGHT_LINEAR_API_KEY", "HEIRRIGHT_LINEAR_TEAM_ID"].filter((key) => {
    if (key === "HEIRRIGHT_LINEAR_API_KEY") return !env[key] && !env.LINEAR_API_KEY;
    if (key === "HEIRRIGHT_LINEAR_TEAM_ID") return !env[key] && !env.LINEAR_TEAM_ID;
    return !env[key];
  });
}

function leadsEngineMissingConfig(env) {
  if (env.HEIRRIGHT_ACCESS_WEBHOOK_URL || ((env.HEIRRIGHT_LINEAR_API_KEY || env.LINEAR_API_KEY) && (env.HEIRRIGHT_LINEAR_TEAM_ID || env.LINEAR_TEAM_ID))) return [];
  return ["HEIRRIGHT_ACCESS_WEBHOOK_URL or Linear support env"];
}

function operatorAccessList(items) {
  return (items ?? []).map((item) => String(item || "")
    .replace(/PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877/g, "Podio field map or verified Leads app")
    .replace(/PODIO_ACCESS_TOKEN/g, "Podio access")
    .replace(/PODIO_REFRESH_TOKEN/g, "Podio refresh access")
    .replace(/PODIO_CLIENT_ID/g, "Podio API client")
    .replace(/PODIO_CLIENT_SECRET/g, "Podio API secret")
    .replace(/PODIO_APP_TOKEN/g, "Podio app token")
    .replace(/PODIO_APP_ID/g, "Podio Leads app")
    .replace(/PODIO_LIVE_WRITE_APPROVED/g, "Podio controlled write approval")
    .replace(/PODIO_CSV_BACKUP_CONFIRMED/g, "Podio CSV backup confirmation")
    .replace(/PODIO_TEST_PHONE/g, "approved sample phone")
    .replace(/PODIO_TEST_EMAIL/g, "approved sample email")
    .replace(/PODIO_LEAD_POINT_PROFILE_ID/g, "approved Lead profile")
    .replace(/GOOGLE_WORKSPACE_ACCESS_TOKEN/g, "Google Workspace access")
    .replace(/GOOGLE_TRACKING_SHEET_ID/g, "Google tracking Sheet")
    .replace(/GOOGLE_LIVE_WRITE_APPROVED/g, "Google controlled write approval")
    .replace(/RESEND_API_KEY/g, "Resend access")
    .replace(/RESEND_LIVE_SEND_APPROVED/g, "Resend internal-test approval")
    .replace(/SMS_CARRIER_GATEWAY/g, "approved SMS carrier gateway")
    .replace(/SMS_GATEWAY_API_KEY/g, "SMS gateway access")
    .replace(/SMS_LIVE_SEND_APPROVED/g, "SMS internal-test approval")
    .replace(/ACTIVEPIECES_WEBHOOK_URL/g, "Activepieces Podio workflow webhook")
    .replace(/TAX_COLLECTOR_LISTING_URL_TEMPLATE/g, "Tax Collector listing URL template")
    .replace(/BROWSERBASE_API_KEY/g, "Browserbase access")
    .replace(/BROWSERBASE_PROJECT_ID/g, "Browserbase project")
    .replace(/TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID/g, "Tax Collector Browserbase function")
    .replace(/OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID/g, "vital/obituary Browserbase function")
    .replace(/MIAMI_DADE_CLERK_AUTH_KEY/g, "Miami-Dade Clerk API access")
    .replace(/MIAMI_DADE_COMMERCIAL_AUTH_KEY/g, "Miami-Dade Clerk API access")
    .replace(/CLERK_COMMERCIAL_AUTH_KEY/g, "Miami-Dade Clerk API access")
    .replace(/OBITUARY_VITAL_WORKFLOW_URL/g, "vital/obituary workflow")
    .replace(/IDI_CORE_API_URL/g, "IDI Core endpoint")
    .replace(/HEIRRIGHT_IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_KEY/g, "IDI Core access")
    .replace(/IDI_CORE_PORTAL_URL/g, "idiCORE portal")
    .replace(/IDI_CORE_ACCOUNT_ID/g, "idiCORE account")
    .replace(/HEIRRIGHT_LINEAR_API_KEY/g, "Linear API access")
    .replace(/HEIRRIGHT_LINEAR_TEAM_ID/g, "Linear team")
    .replace(/HEIRRIGHT_ACCESS_WEBHOOK_URL or Linear support env/g, "Leads engine access webhook or Linear support routing")
  ).join(", ");
}

function buildConnectionStatuses(env = process.env, options = {}) {
  const checkedAt = new Date().toISOString();
  const missingPodio = podioMissingConfig(env);
  const podioApproved = env.PODIO_LIVE_WRITE_APPROVED === "true";
  const podioBackupConfirmed = env.PODIO_CSV_BACKUP_CONFIRMED === "true";
  const podioHasRefreshPath = podioAutoRefreshConfigured(env);
  const podioAuthState = podioAuthSummary(env);
  const missingGoogle = googleMissingConfig(env);
  const googleApproved = env.GOOGLE_LIVE_WRITE_APPROVED === "true";
  const missingResend = resendMissingConfig(env);
  const missingSms = smsMissingConfig(env);
  const missingActivepieces = activepiecesMissingConfig(env);
  const missingLinear = linearMissingConfig(env);
  const missingLeadsEngine = leadsEngineMissingConfig(env);
  const freshBatchExists = Boolean(options.freshBatchExists);
  const latestRunExists = Boolean(options.latestRunExists);

  return [
    {
      name: "Podio",
      ok: !missingPodio.length && podioApproved && podioBackupConfirmed && podioHasRefreshPath && podioAuthState.accessRequirementMet,
      mode: !missingPodio.length && podioApproved && podioBackupConfirmed && podioHasRefreshPath && podioAuthState.accessRequirementMet ? "live" : podioHasRefreshPath ? "review" : "blocked",
      message: !missingPodio.length
        ? podioAuthState.reconnectRequired
          ? podioAuthState.perUserRequired
            ? "Connect your own Podio account from Settings. This connection is stored against your signed-in Google user."
            : "Podio access needs a durable refresh path."
          : !podioHasRefreshPath
          ? "Podio access needs reconnect. Reconnect with the approved HeirRight account, or add the Podio Leads app token fallback before export/readback."
          : !podioApproved
          ? "Podio handoff access is present; final sample-card approval still needs confirmation."
          : !podioBackupConfirmed
            ? "Podio handoff access is present; export a CSV backup before the controlled sample-card write."
            : podioAuthState.perUserRequired
              ? "Your Podio handoff access, backup confirmation, and approval are present."
              : "Podio handoff access, backup confirmation, and approval are present."
        : `Podio handoff setup is incomplete: ${operatorAccessList(missingPodio)}.`,
      checkedAt,
      auth: podioAuthState,
    },
    {
      name: "Google",
      ok: !missingGoogle.length && googleApproved,
      mode: !missingGoogle.length && googleApproved ? "live" : "blocked",
      message: missingGoogle.length
        ? `Google Workspace handoff setup is incomplete: ${operatorAccessList(missingGoogle)}.`
        : googleApproved
          ? "Google Workspace handoff access and controlled write approval are present."
          : "Google Workspace handoff access is present; controlled Sheet/Doc write approval still needs confirmation.",
      checkedAt,
    },
    {
      name: "Resend",
      ok: !missingResend.length,
      mode: missingResend.length ? "blocked" : "live",
      message: missingResend.length
        ? `Resend fallback is incomplete: ${operatorAccessList(missingResend)}. Use Podio queue prep until this is approved.`
        : "Resend fallback is configured for controlled internal email tests only.",
      checkedAt,
    },
    {
      name: "SMS Gateway",
      ok: !missingSms.length,
      mode: missingSms.length ? "blocked" : "live",
      message: missingSms.length
        ? `SMS delivery is incomplete: ${operatorAccessList(missingSms)}. Keep SMS in the app-owned approval queue.`
        : "Approved SMS carrier or Podio-native SMS path is configured; templates still require approval.",
      checkedAt,
    },
    {
      name: "Web Search",
      ok: freshBatchExists || latestRunExists,
      mode: freshBatchExists ? "live" : latestRunExists ? "review" : "blocked",
      message: freshBatchExists
        ? "A live external public-source lead batch has been pulled and persisted."
        : latestRunExists
          ? "Public source checks are represented in the latest lead packet."
          : "Public-source status needs a fresh lead packet before validation.",
      checkedAt,
    },
    taxCollectorSourceStatus(env, checkedAt),
    clerkCommercialApiStatus(env, checkedAt),
    vitalObituaryWorkflowStatus(env, checkedAt),
    idiCoreStatus(env, checkedAt),
    browserbaseUsageStatus(env, checkedAt),
    {
      name: "Activepieces",
      ok: !missingActivepieces.length,
      mode: missingActivepieces.length ? "blocked" : "live",
      message: missingActivepieces.length
        ? `Activepieces outreach automation is incomplete: ${operatorAccessList(missingActivepieces)}. The app will use the Architecturally Free Outreach fallback.`
        : "Activepieces Podio outreach workflow webhook is configured.",
      checkedAt,
    },
    {
      name: "Linear Support",
      ok: !missingLinear.length,
      mode: missingLinear.length ? "blocked" : "live",
      message: missingLinear.length
        ? `Linear support ticket filing is incomplete: ${operatorAccessList(missingLinear)}. Admin tickets stay local until support routing is configured.`
        : "Linear support ticket filing is configured.",
      checkedAt,
    },
    {
      name: "Leads Engine Access",
      ok: !missingLeadsEngine.length,
      mode: missingLeadsEngine.length ? "review" : "live",
      message: missingLeadsEngine.length
        ? `Leads engine access changes are captured locally: ${operatorAccessList(missingLeadsEngine)}.`
        : "Leads engine access changes can be routed for approval.",
      checkedAt,
    },
  ];
}

function handler(request, response) {
  const { requireApiAuth } = require("../_shared");
  if (requireApiAuth(request, response)) return;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.statusCode = 200;
  response.end(JSON.stringify(buildConnectionStatuses(process.env), null, 2));
}

module.exports = handler;
module.exports.buildConnectionStatuses = buildConnectionStatuses;
module.exports.buildIdiCoreStatus = idiCoreStatus;
