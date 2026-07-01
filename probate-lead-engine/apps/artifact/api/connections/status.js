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
  return envValue(env, ["PODIO_REFRESH_TOKEN", "PODIO_OAUTH_REFRESH_TOKEN", "PODIO_REFRESH_ACCESS_TOKEN"]);
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
      ok: !missingPodio.length && podioApproved && podioBackupConfirmed,
      mode: !missingPodio.length && podioApproved && podioBackupConfirmed ? "live" : "blocked",
      message: !missingPodio.length
        ? !podioApproved
          ? "Podio handoff access is present; final sample-card approval still needs confirmation."
          : !podioBackupConfirmed
            ? "Podio handoff access is present; export a CSV backup before the controlled sample-card write."
            : "Podio handoff access, backup confirmation, and approval are present."
        : `Podio handoff setup is incomplete: ${operatorAccessList(missingPodio)}.`,
      checkedAt,
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

function handler(_request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.statusCode = 200;
  response.end(JSON.stringify(buildConnectionStatuses(process.env), null, 2));
}

module.exports = handler;
module.exports.buildConnectionStatuses = buildConnectionStatuses;
