// [claude-code 2026-06-02] Google OAuth gate for the HeirRight beta artifact.
const { createServer } = require("node:http");
const { randomBytes, createHmac } = require("node:crypto");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const port = Number(process.env.PORT || 4173);
const root = join(__dirname, "dist");
const workerOutput = join(__dirname, "..", "worker", "output", "latest-run.json");
const dailyRunOutput = join(__dirname, "..", "worker", "output", "daily-run.json");
const qualificationReviewJsonOutput = join(__dirname, "..", "worker", "output", "qualification-review.json");
const qualificationReviewMarkdownOutput = join(__dirname, "..", "worker", "output", "qualification-review.md");
const freshLeadBatchOutput = join(__dirname, "..", "worker", "output", "fresh-lead-batch.json");
const readbackEvidenceJsonOutput = join(__dirname, "..", "worker", "output", "readback-evidence.json");
const readbackEvidenceMarkdownOutput = join(__dirname, "..", "worker", "output", "readback-evidence.md");
const thirtyDayMilestoneEvidenceJsonOutput = join(__dirname, "..", "worker", "output", "thirty-day-milestone-evidence.json");
const thirtyDayMilestoneEvidenceMarkdownOutput = join(__dirname, "..", "worker", "output", "thirty-day-milestone-evidence.md");
const thirtyDayReviewScriptOutput = join(__dirname, "..", "worker", "output", "thirty-day-review-script.md");
const distWorkerOutput = join(root, "latest-run.json");
const distDailyRunOutput = join(root, "daily-run.json");
const distQualificationReviewJsonOutput = join(root, "qualification-review.json");
const distQualificationReviewMarkdownOutput = join(root, "qualification-review.md");
const distFreshLeadBatchOutput = join(root, "fresh-lead-batch.json");
const distReadbackEvidenceJsonOutput = join(root, "readback-evidence.json");
const distReadbackEvidenceMarkdownOutput = join(root, "readback-evidence.md");
const distThirtyDayMilestoneEvidenceJsonOutput = join(root, "thirty-day-milestone-evidence.json");
const distThirtyDayMilestoneEvidenceMarkdownOutput = join(root, "thirty-day-milestone-evidence.md");
const distThirtyDayReviewScriptOutput = join(root, "thirty-day-review-script.md");
const sessionCookie = process.env.AUTH_SESSION_COOKIE || "hr_session";
const stateCookie = process.env.AUTH_STATE_COOKIE || "hr_oauth_state";
const sessionTtlSeconds = Number(process.env.AUTH_SESSION_TTL_SECONDS || 60 * 60 * 12);
const localIdiRuns = new Map();
const localSourceCaptures = new Map();
const localContactReviews = new Map();
const localClientState = new Map();

function firstExistingPath(...paths) {
  return paths.find((path) => existsSync(path));
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function authRequired() {
  return process.env.AUTH_REQUIRED !== "false";
}

function allowedDomains() {
  return splitList(process.env.AUTH_ALLOWED_DOMAINS || "heirright.com");
}

function allowedEmails() {
  return splitList(process.env.AUTH_ALLOWED_EMAILS || process.env.SOLVYS_ADMIN_EMAILS || "");
}

function originFor(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${port}`;
  const proto = req.headers["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function redirectUriFor(req) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${originFor(req)}/auth/callback`;
}

function oauthConfigured(req) {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID
      && process.env.GOOGLE_OAUTH_CLIENT_SECRET
      && process.env.AUTH_SESSION_SECRET
      && redirectUriFor(req)
  );
}

function parseCookies(req) {
  const out = {};
  for (const pair of String(req.headers.cookie || "").split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    out[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return out;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", process.env.AUTH_SESSION_SECRET || "")
    .update(value)
    .digest("base64url");
}

function emailAllowed(email) {
  const normalized = String(email || "").toLowerCase();
  const domain = normalized.split("@")[1] || "";
  return allowedEmails().includes(normalized) || allowedDomains().includes(domain);
}

function createSessionToken(user) {
  const payload = base64Url(JSON.stringify({
    email: user.email,
    name: user.name || user.email,
    picture: user.picture || null,
    domain: String(user.email || "").split("@")[1] || "",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  }));
  return `${payload}.${sign(payload)}`;
}

function readSession(req) {
  if (!authRequired()) {
    return {
      email: "local-dev@heirright.com",
      name: "Local Beta Review",
      picture: null,
      domain: "heirright.com",
      mode: "disabled",
    };
  }
  if (!process.env.AUTH_SESSION_SECRET) return null;

  const token = parseCookies(req)[sessionCookie];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    if (!emailAllowed(session.email)) return null;
    return { ...session, mode: "oauth" };
  } catch {
    return null;
  }
}

function secureCookie(req) {
  return originFor(req).startsWith("https://") ? "; Secure" : "";
}

function cookie(name, value, req, maxAgeSeconds) {
  const maxAge = Number.isFinite(maxAgeSeconds) ? `; Max-Age=${maxAgeSeconds}` : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secureCookie(req)}`;
}

function clearCookie(name, req) {
  return cookie(name, "", req, 0);
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendHtml(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", ...headers });
  res.end(body);
}

function readRequestBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loginPage(req, message = "Sign in with your HeirRight Google account to review lead packets.") {
  const configured = oauthConfigured(req);
  const domainText = allowedDomains().join(", ") || "heirright.com";
  const emailText = allowedEmails().join(", ") || "approved Solvys admin emails";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HeirRight Beta Login</title>
  <style>
    :root { color-scheme: light; --page:#f2f2f7; --text:#1d1d1f; --muted:#6e7681; --line:rgba(16,24,40,.12); --glass:rgba(255,255,255,.74); }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--page); color:var(--text); font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif; }
    main { width:min(420px, calc(100vw - 32px)); padding:22px; border:1px solid var(--line); border-radius:14px; background:var(--glass); backdrop-filter:saturate(180%) blur(28px); -webkit-backdrop-filter:saturate(180%) blur(28px); }
    h1 { margin:0 0 8px; font-size:24px; letter-spacing:0; }
    p { margin:0 0 14px; color:var(--muted); line-height:1.45; }
    a { display:inline-flex; align-items:center; justify-content:center; min-height:40px; width:100%; color:#fff; background:#2f3137; text-decoration:none; border-radius:9px; font-weight:720; }
    .meta { margin-top:14px; padding-top:14px; border-top:1px solid var(--line); font-size:12px; }
    code { font-family:"SFMono-Regular","SF Mono",ui-monospace,Menlo,Consolas,monospace; color:var(--text); }
  </style>
</head>
<body>
  <main>
    <h1>HeirRight Beta</h1>
    <p>${escapeHtml(message)}</p>
    ${configured ? `<a href="/auth/login">Continue with Google</a>` : `<p><strong>Google sign-in is not set up yet.</strong></p>`}
    <p class="meta">Allowed domain: <code>${escapeHtml(domainText)}</code><br>Solvys admin access: <code>${escapeHtml(emailText)}</code></p>
  </main>
</body>
</html>`;
}

function sessionBody(req) {
  const session = readSession(req);
  return {
    authenticated: Boolean(session),
    user: session ? {
      email: session.email,
      name: session.name,
      picture: session.picture ?? null,
      domain: session.domain,
      mode: session.mode,
    } : null,
    auth: {
      required: authRequired(),
      configured: oauthConfigured(req),
      allowedDomains: allowedDomains(),
      allowedEmails: allowedEmails(),
    },
  };
}

function podioMissingLocalConfig() {
  const missing = ["PODIO_ACCESS_TOKEN", "PODIO_APP_ID"].filter((key) => !process.env[key]);
  if (!process.env.PODIO_FIELD_MAP_JSON && process.env.PODIO_APP_ID !== "24265877") {
    missing.push("PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877");
  }
  return missing;
}

function podioMissingControlledTestConfig() {
  return Array.from(new Set([
    ...podioMissingLocalConfig(),
    ...["PODIO_TEST_PHONE", "PODIO_TEST_EMAIL", "PODIO_LEAD_POINT_PROFILE_ID"].filter((key) => !process.env[key]),
  ]));
}

function googleMissingControlledTestConfig() {
  return ["GOOGLE_WORKSPACE_ACCESS_TOKEN", "GOOGLE_TRACKING_SHEET_ID"].filter((key) => !process.env[key]);
}

function resendMissingConfig() {
  return ["RESEND_API_KEY", "RESEND_LIVE_SEND_APPROVED"].filter((key) => {
    if (key === "RESEND_LIVE_SEND_APPROVED") return process.env[key] !== "true";
    return !process.env[key];
  });
}

function smsMissingConfig() {
  if (process.env.PODIO_NATIVE_SMS_APPROVED === "true" && process.env.PODIO_ACCESS_TOKEN) return [];
  return ["SMS_CARRIER_GATEWAY", "SMS_GATEWAY_API_KEY", "SMS_LIVE_SEND_APPROVED"].filter((key) => {
    if (key === "SMS_LIVE_SEND_APPROVED") return process.env[key] !== "true";
    return !process.env[key];
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

function localConnectionStatuses() {
  const checkedAt = new Date().toISOString();
  const missingPodio = podioMissingControlledTestConfig();
  const podioApproved = process.env.PODIO_LIVE_WRITE_APPROVED === "true";
  const podioBackupConfirmed = process.env.PODIO_CSV_BACKUP_CONFIRMED === "true";
  const missingGoogle = googleMissingControlledTestConfig();
  const googleApproved = process.env.GOOGLE_LIVE_WRITE_APPROVED === "true";
  const missingResend = resendMissingConfig();
  const missingSms = smsMissingConfig();
  const freshBatchExists = Boolean(firstExistingPath(freshLeadBatchOutput, distFreshLeadBatchOutput));
  const latestRunExists = Boolean(firstExistingPath(workerOutput, distWorkerOutput));
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

function workerApiBase() {
  return process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "";
}

async function proxyWorkerJson(pathname, options = {}) {
  const base = workerApiBase().replace(/\/+$/, "");
  if (!base) return null;
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };
  if (process.env.HEIRRIGHT_API_TOKEN) headers.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text,
    contentType: response.headers.get("content-type") || "application/json; charset=utf-8",
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function normalizeAssetAddress(value = "") {
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

function localIdiLockKey(body = {}) {
  return [
    String(body.provider || "idi").toLowerCase(),
    normalizeAssetAddress(body.propertyAddress || body.address || body.assetAddress),
    ownerLastName(body.ownerName || body.estateName),
  ].filter(Boolean).join(":");
}

async function handleIdiAssetImport(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/discovery/idi-asset-search/import", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  const lockKey = localIdiLockKey(body);
  const existing = localIdiRuns.get(lockKey);
  if (existing && !body.adminOverrideReason) {
    sendJson(res, 409, {
      ok: false,
      error: "duplicate_idi_asset_search",
      message: "This estate address already has an imported IDI asset search. Admin override requires a reason.",
      lockKey,
      firstImportedAt: existing.importedAt,
    }, { "cache-control": "no-store" });
    return;
  }
  const importedAt = new Date().toISOString();
  const result = {
    ok: true,
    mode: "operator_import",
    provider: body.provider || "idi",
    lockKey,
    importedAt,
    duplicateGuard: existing ? "admin_override_recorded" : "first_import_only",
    adminOverrideReason: body.adminOverrideReason || null,
    attachment: body.attachment || null,
    contactPreviewCount: String(body.importedText || "").split(/\n{2,}/).filter(Boolean).length,
  };
  localIdiRuns.set(lockKey, result);
  sendJson(res, 200, result, { "cache-control": "no-store" });
}

async function handleSourceCapture(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/discovery/source-capture", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  const id = body.assetKey || body.id || `${body.leadId || "lead"}:${body.kind || "source"}:${Date.now()}`;
  const result = {
    ok: true,
    id,
    capturedAt: new Date().toISOString(),
    artifact: body,
    reviewFlags: body.reviewFlags || [],
  };
  localSourceCaptures.set(id, result);
  sendJson(res, 200, result, { "cache-control": "no-store" });
}

async function handleContactCandidateReview(req, res, candidateId) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson(`/api/discovery/contact-candidates/${encodeURIComponent(candidateId)}/review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  const result = {
    ok: true,
    candidateId,
    status: body.status || "accepted",
    reviewedAt: new Date().toISOString(),
    reviewedBy: body.reviewedBy || readSession(req)?.email || "local-dev@heirright.com",
  };
  localContactReviews.set(candidateId, result);
  sendJson(res, 200, result, { "cache-control": "no-store" });
}

function localExportRoute(route, dryRun) {
  const routeName = route === "google" ? "Google" : "Podio";
  const required = route === "google"
    ? ["GOOGLE_WORKSPACE_ACCESS_TOKEN", "GOOGLE_TRACKING_SHEET_ID"]
    : [];
  const missing = route === "podio" ? podioMissingLocalConfig() : required.filter((key) => !process.env[key]);
  if (dryRun) {
    return {
      route,
      ok: true,
      mode: "review",
      externalId: `review-${route}-${Date.now()}`,
      readbackOk: false,
      blockers: [
        `${routeName} confirmation readback has not run yet.`,
        ...(missing.length ? [`Live ${routeName} setup still needed before approval and readback: ${operatorAccessList(missing)}`] : []),
      ],
      message: `${routeName} handoff package is prepared from the latest lead packet. No live write was attempted.`,
    };
  }
  if (!dryRun && !workerApiBase()) {
    return {
      route,
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`${routeName} handoff needs an approved destination before live readback can run.`],
      message: `${routeName} handoff package is prepared for review; live write was not attempted.`,
    };
  }
  if (missing.length) {
    return {
      route,
      ok: false,
      mode: "blocked",
      readbackOk: false,
      blockers: [`${routeName} setup still needed before approval and readback: ${operatorAccessList(missing)}`],
      message: `${routeName} handoff is blocked until approved access and readback are available.`,
    };
  }
  return {
    route,
    ok: true,
    mode: dryRun ? "review" : "live",
    externalId: `${dryRun ? "review" : "ready"}-${route}-${Date.now()}`,
    readbackOk: !dryRun,
    blockers: dryRun ? [`${routeName} confirmation readback has not run yet.`] : [],
    message: dryRun
      ? `${routeName} handoff package is prepared for approval and live readback.`
      : `${routeName} handoff access is present; route is ready for approval and live readback.`,
  };
}

function operatorSetupText(value) {
  return String(value || "")
    .replace(/PODIO_FIELD_MAP_JSON or PODIO_APP_ID=24265877/g, "Podio field map or verified Leads app")
    .replace(/PODIO_ACCESS_TOKEN/g, "Podio access")
    .replace(/PODIO_APP_ID/g, "Podio Leads app")
    .replace(/GOOGLE_WORKSPACE_ACCESS_TOKEN/g, "Google Workspace access")
    .replace(/GOOGLE_TRACKING_SHEET_ID/g, "Google tracking Sheet")
    .replace(/PODIO_TEST_PHONE/g, "approved sample phone")
    .replace(/PODIO_TEST_EMAIL/g, "approved sample email")
    .replace(/PODIO_LEAD_POINT_PROFILE_ID/g, "approved Lead profile");
}

function operatorBlockerText(value) {
  return operatorSetupText(value)
    .replace(/Missing Podio export config: /i, "Podio setup still needed before an approved sample card and confirmation readback: ")
    .replace(/Missing Google export config: /i, "Google setup still needed before Docs, Sheets, and confirmation readback: ")
    .replace(/Podio export is blocked until .*field map.*configured\./i, "Podio handoff is blocked until CRM access, the Leads app, and field mapping are approved.")
    .replace(/Live (Google|Podio) readback skipped in dry-run mode\./i, "$1 readback has not run yet.")
    .replace(/Live (Google|Podio) (config|setup) still needed before .*readback: /i, "$1 setup still needed before approval and confirmation readback: ");
}

function sanitizeLocalExportResult(result) {
  const routes = (result?.routes ?? []).map((route) => ({
    ...route,
    blockers: (route.blockers ?? []).map(operatorBlockerText),
    message: operatorBlockerText(route.message ?? "Handoff result recorded."),
  }));
  return {
    ...result,
    routes,
    blockers: (result?.blockers ?? []).map(operatorBlockerText),
    error: result?.error ? operatorBlockerText(result.error) : result?.error,
  };
}

async function localControlledPodioExport() {
  const { runDryPipeline } = require("../worker/dist/index");
  const { buildControlledPodioTestSeed } = require("../worker/dist/export/controlled-test-lead");
  const { exportCompletedReport } = require("../worker/dist/export/export-package");
  const seed = buildControlledPodioTestSeed(process.env);
  const pipeline = await runDryPipeline(seed, { env: process.env });
  return exportCompletedReport({
    routes: ["podio"],
    dossier: pipeline.dossier,
    dryRun: false,
    controlledTest: true,
  }, process.env);
}

async function handleLocalExport(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/exports", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  const requestedRoutes = Array.isArray(body.routes) && body.routes.length ? body.routes : ["google", "podio"];
  const routes = requestedRoutes
    .map((route) => route === "both" ? ["google", "podio"] : [route])
    .flat()
    .filter((route) => route === "google" || route === "podio");
  const dryRun = body.dryRun !== false;
  if (body.controlledTest === true && routes.includes("podio") && !dryRun) {
    try {
      const result = await localControlledPodioExport();
      sendJson(res, 200, sanitizeLocalExportResult(result), { "cache-control": "no-store" });
    } catch (error) {
      const blocker = "Podio readiness check is blocked until access, approved sample-card permission, and confirmation readback are available.";
      sendJson(res, 200, {
        ok: false,
        generatedAt: new Date().toISOString(),
        error: "Podio readiness check is blocked before an approved sample card can be created.",
        routes: [{
          route: "podio",
          ok: false,
          mode: "blocked",
          readbackOk: false,
          blockers: [blocker],
          message: "Podio readiness check is blocked before any live CRM card is created.",
        }],
        blockers: [blocker],
      }, { "cache-control": "no-store" });
    }
    return;
  }
  const latestRunPath = firstExistingPath(workerOutput, distWorkerOutput);
  if (!latestRunPath) {
    sendJson(res, 404, { ok: false, error: "Load the latest lead packet first." });
    return;
  }
  const results = Array.from(new Set(routes)).map((route) => localExportRoute(route, dryRun));
  sendJson(res, 200, sanitizeLocalExportResult({
    ok: results.every((result) => result.ok),
    generatedAt: new Date().toISOString(),
    dossierId: JSON.parse(readFileSync(latestRunPath, "utf8")).dossier?.id ?? "latest",
    routes: results,
    blockers: results.flatMap((result) => result.blockers),
  }));
}

async function handleFreshLeadBatch(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/leads/fresh-batch", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }

  try {
    const { runFreshLeadBatch, persistFreshLeadBatchOutputs } = require("../worker/dist/live/source-batch");
    const result = await runFreshLeadBatch(body, { env: process.env });
    let outputs = {};
    let outputPersistence = { ok: true, mode: "filesystem" };
    try {
      outputs = persistFreshLeadBatchOutputs(result);
    } catch (error) {
      outputPersistence = {
        ok: false,
        mode: "ephemeral",
        error: error instanceof Error ? error.message : String(error),
      };
    }
    sendJson(res, 200, { ...result, outputs, outputPersistence }, { "cache-control": "no-store" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) }, { "cache-control": "no-store" });
  }
}

async function handleLogin(req, res) {
  if (!oauthConfigured(req)) {
    sendHtml(res, 503, loginPage(req, "Google sign-in setup is incomplete. Add the approved access details before beta access opens."));
    return;
  }

  const state = randomBytes(24).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUriFor(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.writeHead(302, {
    "set-cookie": cookie(stateCookie, state, req, 600),
    location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
  res.end();
}

async function exchangeGoogleCode(req, code) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUriFor(req),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
  const token = await tokenResponse.json();
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error(`Google profile lookup failed: ${profileResponse.status}`);
  return profileResponse.json();
}

async function handleCallback(req, res, url) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = parseCookies(req)[stateCookie];
  if (!code || !state || !expectedState || state !== expectedState) {
    sendHtml(res, 400, loginPage(req, "The Google sign-in request expired. Start the login again."));
    return;
  }

  try {
    const profile = await exchangeGoogleCode(req, code);
    if (!profile.email || !emailAllowed(profile.email)) {
      sendHtml(res, 403, loginPage(req, "This Google account is not approved for the HeirRight beta workspace."));
      return;
    }
    const token = createSessionToken(profile);
    res.writeHead(302, {
      "set-cookie": [
        cookie(sessionCookie, token, req, sessionTtlSeconds),
        clearCookie(stateCookie, req),
      ],
      location: "/",
    });
    res.end();
  } catch (error) {
    sendHtml(res, 502, loginPage(req, error.message));
  }
}

function handleRequest(req, res) {
  const url = new URL(req.url || "/", originFor(req));

  if (url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "heirright-artifact",
      authRequired: authRequired(),
      signInReady: oauthConfigured(req),
    });
    return;
  }

  if (url.pathname === "/auth/session") {
    sendJson(res, 200, sessionBody(req));
    return;
  }

  if (url.pathname === "/auth/login") {
    handleLogin(req, res).catch((error) => sendHtml(res, 500, loginPage(req, error.message)));
    return;
  }

  if (url.pathname === "/auth/callback") {
    handleCallback(req, res, url).catch((error) => sendHtml(res, 500, loginPage(req, error.message)));
    return;
  }

  if (url.pathname === "/auth/logout") {
    res.writeHead(302, { "set-cookie": clearCookie(sessionCookie, req), location: "/" });
    res.end();
    return;
  }

  const session = readSession(req);
  if (authRequired() && !session) {
    if (url.pathname === "/latest-run.json" || url.pathname === "/daily-run.json" || url.pathname === "/qualification-review.json" || url.pathname === "/qualification-review.md" || url.pathname === "/readback-evidence.json" || url.pathname === "/readback-evidence.md" || url.pathname === "/thirty-day-milestone-evidence.json" || url.pathname === "/thirty-day-milestone-evidence.md" || url.pathname === "/thirty-day-review-script.md" || url.pathname.startsWith("/api/")) {
      sendJson(res, 401, { ok: false, error: "auth_required", loginUrl: "/auth/login" });
      return;
    }
    sendHtml(res, 401, loginPage(req));
    return;
  }

  if (url.pathname.startsWith("/local-state/")) {
    const key = decodeURIComponent(url.pathname.slice("/local-state/".length));
    if (!key || key.length > 160) {
      sendJson(res, 400, { ok: false, error: "invalid_state_key" });
      return;
    }
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true, key, value: localClientState.get(key) ?? null }, { "cache-control": "no-store" });
      return;
    }
    if (req.method === "POST") {
      readRequestBody(req)
        .then((body) => {
          localClientState.set(key, body);
          sendJson(res, 200, { ok: true, key, bytes: Buffer.byteLength(body) }, { "cache-control": "no-store" });
        })
        .catch((error) => sendJson(res, 413, { ok: false, error: error.message }));
      return;
    }
    sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/api/connections/status") {
    proxyWorkerJson("/api/connections/status")
      .then((proxied) => {
        if (proxied) {
          res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
          res.end(proxied.body);
          return;
        }
        sendJson(res, 200, localConnectionStatuses(), { "cache-control": "no-store" });
      })
      .catch((error) => sendJson(res, 502, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/connection-status.json") {
    sendJson(res, 200, localConnectionStatuses(), { "cache-control": "no-store" });
    return;
  }

  if (url.pathname === "/api/exports") {
    handleLocalExport(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/leads/fresh-batch") {
    handleFreshLeadBatch(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/discovery/idi-asset-search/import") {
    handleIdiAssetImport(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/discovery/source-capture") {
    handleSourceCapture(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  const contactReviewMatch = url.pathname.match(/^\/api\/discovery\/contact-candidates\/([^/]+)\/review$/);
  if (contactReviewMatch) {
    handleContactCandidateReview(req, res, decodeURIComponent(contactReviewMatch[1])).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/fresh-lead-batch.json") {
    const freshBatchPath = firstExistingPath(freshLeadBatchOutput, distFreshLeadBatchOutput);
    if (!freshBatchPath) {
      sendJson(res, 404, { error: "Pull a fresh lead batch first." });
      return;
    }
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(readFileSync(freshBatchPath));
    return;
  }

  if (url.pathname === "/latest-run.json") {
    const latestRunPath = firstExistingPath(workerOutput, distWorkerOutput);
    if (!latestRunPath) {
      sendJson(res, 404, { error: "Load the latest lead packet first." });
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(readFileSync(latestRunPath));
    return;
  }

  if (url.pathname === "/daily-run.json") {
    const proxied = proxyWorkerJson("/daily-run.json");
    proxied.then((response) => {
      if (response) {
        res.writeHead(response.status, { "content-type": response.contentType, "cache-control": "no-store" });
        res.end(response.body);
        return;
      }
      const dailyRunPath = firstExistingPath(dailyRunOutput, distDailyRunOutput);
      if (!dailyRunPath) {
        sendJson(res, 404, { error: "Run the daily production review first." });
        return;
      }
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(readFileSync(dailyRunPath));
    }).catch((error) => sendJson(res, 502, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/qualification-review.json" || url.pathname === "/qualification-review.md") {
    const localPath = url.pathname.endsWith(".md")
      ? firstExistingPath(qualificationReviewMarkdownOutput, distQualificationReviewMarkdownOutput)
      : firstExistingPath(qualificationReviewJsonOutput, distQualificationReviewJsonOutput);
    const contentType = url.pathname.endsWith(".md") ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8";
    const proxied = proxyWorkerJson(url.pathname);
    proxied.then((response) => {
      if (response) {
        res.writeHead(response.status, { "content-type": response.contentType, "cache-control": "no-store" });
        res.end(response.body);
        return;
      }
      if (!localPath) {
        sendJson(res, 404, { error: "Run the daily production review first." });
        return;
      }
      res.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
      res.end(readFileSync(localPath));
    }).catch((error) => sendJson(res, 502, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/readback-evidence.json" || url.pathname === "/readback-evidence.md") {
    const localPath = url.pathname.endsWith(".md")
      ? firstExistingPath(readbackEvidenceMarkdownOutput, distReadbackEvidenceMarkdownOutput)
      : firstExistingPath(readbackEvidenceJsonOutput, distReadbackEvidenceJsonOutput);
    const contentType = url.pathname.endsWith(".md") ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8";
    const proxied = proxyWorkerJson(url.pathname);
    proxied.then((response) => {
      if (response) {
        res.writeHead(response.status, { "content-type": response.contentType, "cache-control": "no-store" });
        res.end(response.body);
        return;
      }
      if (!localPath) {
        sendJson(res, 404, { error: "Run the export or 30-Day milestone review first." });
        return;
      }
      res.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
      res.end(readFileSync(localPath));
    }).catch((error) => sendJson(res, 502, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/thirty-day-milestone-evidence.json" || url.pathname === "/thirty-day-milestone-evidence.md") {
    const localPath = url.pathname.endsWith(".md")
      ? firstExistingPath(thirtyDayMilestoneEvidenceMarkdownOutput, distThirtyDayMilestoneEvidenceMarkdownOutput)
      : firstExistingPath(thirtyDayMilestoneEvidenceJsonOutput, distThirtyDayMilestoneEvidenceJsonOutput);
    const contentType = url.pathname.endsWith(".md") ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8";
    if (!localPath) {
      sendJson(res, 404, { error: "Run the 30-Day milestone review first." });
      return;
    }
    res.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    res.end(readFileSync(localPath));
    return;
  }

  if (url.pathname === "/thirty-day-review-script.md") {
    const reviewScriptPath = firstExistingPath(thirtyDayReviewScriptOutput, distThirtyDayReviewScriptOutput);
    if (!reviewScriptPath) {
      sendJson(res, 404, { error: "Run the 30-Day milestone review first." });
      return;
    }
    res.writeHead(200, { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-store" });
    res.end(readFileSync(reviewScriptPath));
    return;
  }

  const html = readFileSync(join(root, "index.html"), "utf8");
  res.writeHead(200, { "content-type": "text/html" });
  res.end(html);
}

if (require.main === module) {
  createServer(handleRequest).listen(port, () => {
    console.log(`HeirRight artifact listening on http://localhost:${port}`);
  });
}

module.exports = { handleRequest };
