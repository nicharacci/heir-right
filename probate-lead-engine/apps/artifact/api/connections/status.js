function missing(keys, env) {
  return keys.filter((key) => !env[key]);
}

function podioMissingConfig(env) {
  const missingKeys = missing(["PODIO_ACCESS_TOKEN", "PODIO_APP_ID"], env);
  if (!env.PODIO_FIELD_MAP_JSON && env.PODIO_APP_ID !== "24265877") {
    missingKeys.push("PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877");
  }
  return Array.from(new Set([
    ...missingKeys,
    ...missing(["PODIO_TEST_PHONE", "PODIO_TEST_EMAIL", "PODIO_LEAD_POINT_PROFILE_ID"], env),
  ]));
}

function googleMissingConfig(env) {
  return missing(["GOOGLE_WORKSPACE_ACCESS_TOKEN", "GOOGLE_TRACKING_SHEET_ID"], env);
}

function resendMissingConfig(env) {
  return ["RESEND_API_KEY", "RESEND_LIVE_SEND_APPROVED"].filter((key) => {
    if (key === "RESEND_LIVE_SEND_APPROVED") return env[key] !== "true";
    return !env[key];
  });
}

function smsMissingConfig(env) {
  if (env.PODIO_NATIVE_SMS_APPROVED === "true" && env.PODIO_ACCESS_TOKEN) return [];
  return ["SMS_CARRIER_GATEWAY", "SMS_GATEWAY_API_KEY", "SMS_LIVE_SEND_APPROVED"].filter((key) => {
    if (key === "SMS_LIVE_SEND_APPROVED") return env[key] !== "true";
    return !env[key];
  });
}

function operatorAccessList(items) {
  return (items ?? []).map((item) => String(item || "")
    .replace(/PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877/g, "Podio field map or verified Leads app")
    .replace(/PODIO_ACCESS_TOKEN/g, "Podio access")
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
