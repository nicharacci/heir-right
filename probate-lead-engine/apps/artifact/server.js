// [claude-code 2026-06-02] Google OAuth gate for the HeirRight beta artifact.
const { createServer } = require("node:http");
const { randomBytes, createHmac } = require("node:crypto");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const reportPdfHandler = require("./api/reports/pdf.js");
const activepiecesHandler = require("./api/outreach/activepieces.js");
const supportLinearHandler = require("./api/support/linear.js");
const adminAccessHandler = require("./api/admin/access.js");
const taxCollectorReceiptHandler = require("./api/discovery/tax-collector/receipt-run.js");
const { buildConnectionStatuses, buildIdiCoreStatus } = require("./api/connections/status.js");
const { discoverTaxCollectorReceipt, extractTaxCollectorDetails } = require("./api/_shared.js");
const {
  runTaxCollectorReceiptSearch,
  taxCollectorCaptureFromRun,
  withoutTaxCollectorAcquisitionEnv,
} = require("./api/discovery/tax-collector/service.js");

function loadLocalEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  [
    join(__dirname, ".env.local"),
    join(__dirname, "..", "..", ".env.local"),
    join(__dirname, "..", "..", "..", ".env.local"),
  ].forEach(loadLocalEnvFile);
}

loadLocalEnv();

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
  const hasBearer = Boolean(process.env.PODIO_ACCESS_TOKEN);
  const hasRefresh = Boolean(process.env.PODIO_CLIENT_ID && process.env.PODIO_CLIENT_SECRET && process.env.PODIO_REFRESH_TOKEN);
  const hasAppAuth = Boolean(process.env.PODIO_CLIENT_ID && process.env.PODIO_CLIENT_SECRET && process.env.PODIO_APP_TOKEN);
  const missing = ["PODIO_APP_ID"].filter((key) => !process.env[key]);
  if (!hasBearer && !hasRefresh && !hasAppAuth) {
    missing.push("PODIO_ACCESS_TOKEN, PODIO_REFRESH_TOKEN, or PODIO_CLIENT_ID/PODIO_CLIENT_SECRET/PODIO_APP_TOKEN");
  }
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
  if (process.env.PODIO_NATIVE_SMS_APPROVED === "true" && (process.env.PODIO_ACCESS_TOKEN || process.env.PODIO_REFRESH_TOKEN || process.env.PODIO_APP_TOKEN)) return [];
  return ["SMS_CARRIER_GATEWAY", "SMS_GATEWAY_API_KEY", "SMS_LIVE_SEND_APPROVED"].filter((key) => {
    if (key === "SMS_LIVE_SEND_APPROVED") return process.env[key] !== "true";
    return !process.env[key];
  });
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
    .replace(/IDI_CORE_API_URL/g, "IDI Core endpoint")
    .replace(/HEIRRIGHT_IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_KEY/g, "IDI Core access")
  ).join(", ");
}

function localConnectionStatuses() {
  const freshBatchExists = Boolean(firstExistingPath(freshLeadBatchOutput, distFreshLeadBatchOutput));
  const latestRunExists = Boolean(firstExistingPath(workerOutput, distWorkerOutput));
  return buildConnectionStatuses(process.env, { freshBatchExists, latestRunExists });
}

function workerApiBase() {
  return process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "";
}

function workerProxyHeaders(req, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {}),
  };
  if (process.env.HEIRRIGHT_API_TOKEN) headers.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
  if (req?.headers?.cookie) headers.cookie = req.headers.cookie;
  if (req) {
    headers["x-heirright-public-origin"] = originFor(req);
    headers["x-forwarded-host"] = req.headers["x-forwarded-host"] || req.headers.host || "";
    headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] || (originFor(req).startsWith("https:") ? "https" : "http");
  }
  return headers;
}

async function proxyWorkerJson(pathname, options = {}) {
  const base = workerApiBase().replace(/\/+$/, "");
  if (!base) return null;
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: workerProxyHeaders(options.req, options),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text,
    contentType: response.headers.get("content-type") || "application/json; charset=utf-8",
  };
}

async function proxyWorkerHttp(req, res, pathname, options = {}) {
  const base = workerApiBase().replace(/\/+$/, "");
  if (!base) return false;
  const response = await fetch(`${base}${pathname}`, {
    method: options.method || req.method || "GET",
    headers: workerProxyHeaders(req, options),
    body: options.body,
    redirect: "manual",
  });
  const headers = {
    "content-type": response.headers.get("content-type") || "text/html; charset=utf-8",
    "cache-control": response.headers.get("cache-control") || "no-store",
  };
  const location = response.headers.get("location");
  if (location) headers.location = location;
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  if (setCookies.length) headers["set-cookie"] = setCookies;
  res.writeHead(response.status, headers);
  res.end(await response.text());
  return true;
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

function localSourceFactsFromCapture(body = {}) {
  const capturedAt = new Date().toISOString();
  const seed = body.seed || {};
  const county = seed.county || body.county || "miami-dade";
  const subject = {
    ownerName: seed.ownerName || body.ownerName,
    propertyAddress: seed.propertyAddress || body.propertyAddress || body.address,
    parcelId: seed.parcelId || body.parcelId || body.folio,
    caseNumber: seed.caseNumber || body.caseNumber,
    estateName: seed.estateName || body.estateName,
    county,
  };
  const facts = [];
  const addFact = (source, factType, value, sourceUrl, attachment, reviewFlags) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    if (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length) return;
    facts.push({
      id: `${body.runId || "local-source-capture"}:${source}:${factType}:${facts.length + 1}`,
      runId: body.runId || "local-source-capture",
      source,
      rawId: `operator-source:${factType}:${facts.length + 1}`,
      fetchedAt: capturedAt,
      county,
      subject,
      factType,
      value,
      confidence: 0.85,
      sourceUrl,
      attachment,
      reviewFlags: reviewFlags || (sourceUrl || attachment ? ["HUMAN_REVIEW_REQUIRED"] : ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"]),
    });
  };
  const taxReceipt = body.taxReceipt || {};
  const deed = body.deed || {};
  const propertyAppraiser = body.propertyAppraiser || {};
  const probate = body.probate || {};
  const obituary = body.obituary || {};
  const compactObject = (input) => {
    const output = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""));
    return Object.keys(output).length ? output : undefined;
  };
  const stringValue = (value) => typeof value === "string" ? value.trim() : "";
  const sourceAttachment = (label, sourceUrl, fileName, fileKind = "link") => {
    if (!sourceUrl && !fileName) return undefined;
    return {
      label,
      sourceUrl,
      fileName,
      fileKind,
      capturedAt,
      capturedBy: "source-capture",
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
    };
  };
  const receiptDiscovery = discoverTaxCollectorReceipt(taxReceipt);
  const taxDetails = {
    ...extractTaxCollectorDetails(taxReceipt),
    ...(receiptDiscovery?.details || {}),
  };
  const receiptUrl = receiptDiscovery?.receiptUrl || stringValue(taxReceipt.receiptUrl) || stringValue(taxReceipt.receiptLink);
  const listingUrl = receiptDiscovery?.listingUrl || stringValue(taxReceipt.listingUrl) || stringValue(taxReceipt.sourceUrl);
  const taxReceiptStatus = stringValue(taxReceipt.status);
  const browserWorkflowRequired = taxReceipt.browserWorkflowRequired === true || taxReceiptStatus === "browser_workflow_required";
  const taxSourceBlockedReason = stringValue(taxReceipt.sourceBlockedReason) || stringValue(taxReceipt.blocker) || stringValue(taxReceipt.browserWorkflowReason);
  const taxSourceStatus = compactObject({
    mode: browserWorkflowRequired
      ? "browser_workflow_required"
      : receiptUrl
        ? receiptDiscovery?.mode || "receipt_link_captured"
        : taxReceiptStatus === "unavailable_after_listing_check"
          ? "listing_page_no_receipt"
          : listingUrl
            ? "listing_page_review"
            : undefined,
    ok: Boolean(receiptUrl),
    listingUrl,
    receiptUrl,
    note: browserWorkflowRequired
      ? taxSourceBlockedReason || "Tax Collector public search needs a browser workflow before the listing-page receipt link can be captured."
      : taxReceiptStatus === "unavailable_after_listing_check"
        ? taxSourceBlockedReason || "Tax Collector listing page was checked and no bottom-right receipt link was available."
        : undefined,
  });
  const taxSourceStatusFlags = browserWorkflowRequired
    ? ["SOURCE_BLOCKED", "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED", "TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"]
    : receiptUrl
      ? receiptDiscovery?.reviewFlags || ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"]
      : ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"];
  const receiptAttachment = receiptUrl ? {
    label: "Tax Collector receipt",
    sourceUrl: receiptUrl,
    fileKind: "link",
    capturedAt,
    capturedBy: "source-capture",
    reviewFlags: receiptDiscovery?.reviewFlags || ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
  } : undefined;
  addFact("tax_collector", "source_status", taxSourceStatus, listingUrl || receiptUrl, undefined, taxSourceStatusFlags);
  addFact("tax_collector", "tax_last_paid_by", taxReceipt.paidBy || taxDetails.paidBy, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_payer_identity", taxReceipt.paidBy || taxReceipt.payerIdentity || taxDetails.payerIdentity, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_paid_date", taxReceipt.paidDate || taxDetails.paidDate, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_status", taxReceipt.status || taxDetails.receiptStatus || (receiptUrl ? "receipt_link_captured" : undefined), listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_link", receiptUrl, receiptUrl, receiptAttachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_receipt_attachment", receiptAttachment, receiptUrl, receiptAttachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_amount_due", taxDetails.amountDue || taxReceipt.amountDue, listingUrl || receiptUrl);
  addFact("tax_collector", "unpaid_tax_years", taxDetails.unpaidYears || taxReceipt.unpaidYears, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_reassessment_signal", taxReceipt.reassessment || taxDetails.reassessment, listingUrl || receiptUrl);
  const deedSourceUrl = deed.documentUrl || deed.sourceUrl || deed.fileName;
  const orBookPage = compactObject({
    book: deed.book,
    page: deed.page,
    instrumentNumber: deed.instrument || deed.instrumentNumber,
  });
  const latestDeed = compactObject({
    recordingDate: deed.recordingDate,
    documentType: deed.documentType || deed.status,
    orBookPage,
    grantor: deed.grantor,
    grantee: deed.grantee,
  });
  const deedAttachment = sourceAttachment("Official Records deed", deed.documentUrl || deed.sourceUrl, deed.fileName, deedSourceUrl && /\.pdf($|\?)/i.test(String(deedSourceUrl)) ? "pdf" : "link");
  addFact("official_records", "official_records_status", deed.status || (deedSourceUrl ? "official_records_evidence_captured" : undefined), deedSourceUrl);
  addFact("official_records", "deed_history_status", deed.status || (deedSourceUrl ? "latest_deed_captured" : undefined), deedSourceUrl);
  addFact("official_records", "or_book_page", orBookPage || deed.instrument, deedSourceUrl);
  addFact("official_records", "latest_deed", latestDeed || deed.status || deed.instrument, deedSourceUrl);
  addFact("official_records", "deed_attachment", deedAttachment, deedSourceUrl, deedAttachment);
  addFact("official_records", "last_sale_date", deed.lastSaleDate, deedSourceUrl);
  addFact("official_records", "ownership_activity_note", deed.ownershipActivity || deed.note, deedSourceUrl);
  addFact("official_records", "mortgage_signal", deed.mortgageSignal, deedSourceUrl);
  addFact("official_records", "lien_signal", deed.lienSignal, deedSourceUrl);
  addFact("official_records", "lis_pendens_signal", deed.lisPendensSignal, deedSourceUrl);
  addFact("official_records", "foreclosure_signal", deed.foreclosureSignal, deedSourceUrl);
  addFact("official_records", "adverse_possession_signal", deed.adversePossessionSignal, deedSourceUrl);
  addFact("official_records", "title_signal", deed.titleSignal || deed.note, deedSourceUrl);
  addFact("property_appraiser", "mailing_address_signal", propertyAppraiser.mailingAddressSignal || propertyAppraiser.mailingAddress, propertyAppraiser.sourceUrl);
  const probateSourceUrl = probate.docketUrl || probate.sourceUrl || probate.searchUrl;
  const civilFamilyDocket = compactObject({
    court: probate.court,
    division: probate.division,
    docketNumber: probate.relatedDocketNumber || probate.docketNumber,
    caseType: probate.caseType,
  });
  const officialRecordCrossLink = compactObject({
    label: probate.officialRecordLabel || "Official Records cross-link",
    url: probate.officialRecordUrl,
    orBookPage,
    note: probate.officialRecordNote,
  });
  addFact("probate_court", "probate_docket_status", probate.status || (probateSourceUrl ? "probate_docket_reviewed" : undefined), probateSourceUrl);
  addFact("probate_court", "case_number", probate.caseNumber, probateSourceUrl);
  addFact("probate_court", "probate_case_status", probate.caseStatus, probateSourceUrl);
  addFact("probate_court", "civil_family_docket_ref", civilFamilyDocket, probateSourceUrl);
  addFact("probate_court", "affidavit_of_heirs_status", probate.affidavitOfHeirsStatus, probateSourceUrl);
  addFact("probate_court", "probate_document_availability", probate.documentAvailability, probateSourceUrl);
  addFact("official_records", "official_record_cross_link", officialRecordCrossLink ? [officialRecordCrossLink] : undefined, probate.officialRecordUrl || deedSourceUrl);
  const obituarySourceUrl = obituary.sourceUrl || obituary.fileName;
  const obituaryAttachment = sourceAttachment("Obituary snapshot/link", obituary.sourceUrl, obituary.fileName, obituarySourceUrl && /\.(png|jpe?g|webp)($|\?)/i.test(String(obituarySourceUrl)) ? "image" : "link");
  addFact("clerk_of_courts", "marriage_death_status", obituary.status || (obituarySourceUrl ? "obituary_reviewed" : undefined), obituarySourceUrl);
  addFact("clerk_of_courts", "marriage_license_signal", obituary.marriageLicenseSignal, obituarySourceUrl);
  addFact("clerk_of_courts", "date_of_birth", obituary.dateOfBirth, obituarySourceUrl);
  addFact("clerk_of_courts", "date_of_death", obituary.dateOfDeath, obituarySourceUrl);
  addFact("clerk_of_courts", "obituary_link", obituary.sourceUrl || (obituary.status === "reviewed-not-found" ? "reviewed_not_found" : undefined), obituary.sourceUrl);
  addFact("clerk_of_courts", "obituary_snapshot", obituaryAttachment, obituary.sourceUrl, obituaryAttachment);
  addFact("clerk_of_courts", "memorial_search_tasks", [
    compactObject({ provider: "findagrave", url: obituary.findagraveUrl, note: obituary.findagraveNote }),
    compactObject({ provider: "legacy", url: obituary.legacyUrl, note: obituary.legacyNote }),
    compactObject({ provider: "google", url: obituary.googleUrl, note: obituary.googleNote }),
  ].filter(Boolean), obituarySourceUrl);
  addFact("clerk_of_courts", "death_certificate_status", obituary.deathCertificateStatus, obituarySourceUrl);
  addFact("clerk_of_courts", "incarceration_status_signal", obituary.incarcerationStatus, obituarySourceUrl);
  return facts;
}

function localIdiLockKey(body = {}) {
  return [
    String(body.provider || "idi").toLowerCase(),
    normalizeAssetAddress(body.propertyAddress || body.address || body.assetAddress),
    ownerLastName(body.ownerName || body.estateName),
  ].filter(Boolean).join(":");
}

function idiCoreUserApiKey(body = {}) {
  const directKey = String(body.idiCoreApiKey || body.userApiKey || "").trim();
  return directKey || "";
}

function idiCoreSharedApiKey(env = process.env) {
  return String(env.IDI_CORE_API_TOKEN || env.HEIRRIGHT_IDI_CORE_API_TOKEN || env.IDI_CORE_API_KEY || "").trim();
}

function idiCoreRequestApiKey(body = {}) {
  return idiCoreUserApiKey(body) || idiCoreSharedApiKey(process.env);
}

function idiCoreApiKeySource(body = {}) {
  if (idiCoreUserApiKey(body)) return "user_override";
  return idiCoreSharedApiKey(process.env) ? "shared_default" : "missing";
}

function idiCoreMissingConfig(body = {}) {
  const missing = [];
  if (!process.env.IDI_CORE_API_URL) missing.push("IDI_CORE_API_URL");
  if (!idiCoreRequestApiKey(body)) missing.push("IDI_CORE_API_TOKEN");
  return missing;
}

function idiCoreLiveApproved(body = {}) {
  return body.liveRunApproved === true || body.liveRunApproved === "true" || process.env.IDI_CORE_LIVE_RUN_APPROVED === "true";
}

function redactIdiCoreProviderResponse(value, depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.map((item) => redactIdiCoreProviderResponse(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    /authorization|api[_-]?key|token|secret|password/i.test(key)
      ? "[redacted]"
      : redactIdiCoreProviderResponse(nested, depth + 1),
  ]));
}

async function runLiveIdiCore(body = {}, lockKey = "") {
  const apiKey = idiCoreRequestApiKey(body);
  const apiKeySource = idiCoreApiKeySource(body);
  const missing = idiCoreMissingConfig(body);
  if (!idiCoreLiveApproved(body)) {
    return {
      ok: false,
      status: 403,
      error: "idi_live_run_not_approved",
      blockers: ["A live IDI Core run needs explicit approval before the app can spend a paid lookup."],
      message: "Live IDI Core is blocked until the review owner approves this paid asset search.",
    };
  }
  if (missing.length) {
    const status = buildIdiCoreStatus(process.env);
    const portalConfigured = status.configuredMode === "operator_portal";
    return {
      ok: false,
      status: 503,
      error: "idi_core_not_configured",
      blockers: [`Live IDI Core needs approved access before it can run: ${operatorAccessList(missing) || missing.join(", ")}`],
      message: portalConfigured
        ? "idiCORE portal access is configured for approved operator searches, but backend live runs still need vendor API access. Open idiCORE, run the approved property search, then import the report."
        : "Live IDI Core is not configured. Import an approved report or add the vendor access before running the paid search.",
      idiCoreStatus: status,
      apiKeySource,
    };
  }
  const response = await fetch(process.env.IDI_CORE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      propertyAddress: body.propertyAddress || body.address || body.assetAddress,
      ownerName: body.ownerName || body.estateName,
      estateName: body.estateName || body.ownerName,
      county: body.county || "miami-dade",
      lockKey,
      reason: body.reason || "HeirRight controlled asset-search proof",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    return {
      ok: false,
      status: response.status || 502,
      error: data.error || "idi_core_run_failed",
      blockers: data.blockers || [`IDI Core returned ${response.status}. No Discovery contact facts were accepted.`],
      message: data.message || "Live IDI Core did not complete. The Discovery file remains blocked.",
      providerResponse: redactIdiCoreProviderResponse(data),
      apiKeySource,
    };
  }
  const candidates = data.candidates || data.contactCandidates || [];
  return {
    ok: true,
    status: 200,
    mode: "live_idi_core",
    provider: body.provider || "idi",
    lockKey,
    importedAt: new Date().toISOString(),
    duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_paid_run_only",
    adminOverrideReason: body.adminOverrideReason || null,
    paidRun: true,
    apiKeySource,
    readbackStatus: data.readbackStatus || data.status || "provider_completed",
    sourceEvidence: redactIdiCoreProviderResponse(data.sourceEvidence || data.evidence || null),
    attachment: data.attachment || body.attachment || null,
    importedText: data.importedText || data.reportText || "",
    candidates,
    contactPreviewCount: Array.isArray(candidates)
      ? candidates.length
      : String(data.importedText || data.reportText || "").split(/\n{2,}/).filter(Boolean).length,
    message: "Live IDI Core asset search completed and is ready for contact review.",
  };
}

async function handleIdiAssetImport(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/discovery/idi-asset-search/import", {
    req,
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
  const wantsLiveRun = body.runMode === "live_idi_core" || body.mode === "live_idi_core" || body.paidRun === true;
  if (wantsLiveRun) {
    const result = await runLiveIdiCore(body, lockKey);
    if (result.ok) {
      localIdiRuns.set(lockKey, result);
      sendJson(res, 200, result, { "cache-control": "no-store" });
      return;
    }
    sendJson(res, result.status || 503, result, { "cache-control": "no-store" });
    return;
  }
  if (!String(body.importedText || "").trim() && !(body.attachment && (body.attachment.sourceUrl || body.attachment.fileName))) {
    sendJson(res, 400, {
      ok: false,
      error: "missing_idi_report",
      message: "Paste the approved IDI Asset Discovery report text or attach report metadata before importing.",
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
    paidRun: false,
    message: "Approved IDI report metadata was imported for review. The production backend did not run IDI Core.",
  };
  localIdiRuns.set(lockKey, result);
  sendJson(res, 200, result, { "cache-control": "no-store" });
}

async function handleSourceCapture(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/discovery/source-capture", {
    req,
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  const id = body.assetKey || body.id || `${body.leadId || "lead"}:${body.kind || "source"}:${Date.now()}`;
  const sourceFacts = localSourceFactsFromCapture(body);
  const result = {
    ok: true,
    mode: "source_review",
    id,
    capturedAt: new Date().toISOString(),
    artifact: body,
    sourceFacts,
    reviewFlags: [...new Set(sourceFacts.flatMap((item) => item.reviewFlags))],
    message: sourceFacts.length
      ? "Source capture saved for Discovery review."
      : "Source capture saved, but no structured source facts were detected.",
  };
  localSourceCaptures.set(id, result);
  sendJson(res, 200, result, { "cache-control": "no-store" });
}

const discoverySourceLabels = [
  { source: "property_appraiser", label: "Property Appraiser", mode: "public_api" },
  { source: "tax_collector", label: "Tax Collector", mode: "script_or_browser_required" },
  { source: "official_records", label: "Official Records", mode: "commercial_api_or_browser_capture" },
  { source: "probate_court", label: "Probate/Civil/Family Court", mode: "commercial_api_or_browser_capture" },
  { source: "clerk_of_courts", label: "Marriage, death, obituary, and vital review", mode: "browser_workflow_or_source_capture" },
  { source: "idi", label: "IDI Core Asset Search", mode: "paid_api_or_operator_import" },
  { source: "skip_trace", label: "Skip trace/contact enrichment", mode: "paid_manual_approval" },
  { source: "source_governance", label: "Governed manual and paid research", mode: "approval_gated_source_governance" },
];

function sourceFactValuePresent(value) {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function sourceFactHasBlockingFlag(fact) {
  return (fact.reviewFlags || []).some((flag) =>
    flag === "SOURCE_HEALTH_ONLY"
      || flag === "SOURCE_BLOCKED"
      || flag === "PAID_SOURCE_APPROVAL_REQUIRED"
      || flag === "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED"
      || flag === "MISSING_SKIPTRACE_CONFIG"
      || String(flag).startsWith("MISSING_")
  );
}

function sourceEvidenceFacts(facts = []) {
  return facts.filter((fact) =>
    sourceFactValuePresent(fact.value)
      && fact.factType !== "source_status"
      && fact.factType !== "source_search_url"
      && !sourceFactHasBlockingFlag(fact)
  );
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sourceRunSeedFromBody(body = {}) {
  const seed = body.seed && typeof body.seed === "object" ? body.seed : {};
  const capture = body.capture && typeof body.capture === "object" ? body.capture : body;
  const taxReceipt = capture.taxReceipt && typeof capture.taxReceipt === "object" ? capture.taxReceipt : {};
  const stringValue = (value) => typeof value === "string" ? value.trim() : "";
  const confirmedSourceFacts = Array.isArray(seed.confirmedSourceFacts)
    ? seed.confirmedSourceFacts
    : Array.isArray(body.confirmedSourceFacts) ? body.confirmedSourceFacts : undefined;
  return {
    ownerName: stringValue(seed.ownerName) || stringValue(body.ownerName) || stringValue(body.owner) || "Fresh public-source lead",
    estateName: stringValue(seed.estateName) || stringValue(body.estateName) || undefined,
    propertyAddress: stringValue(seed.propertyAddress) || stringValue(body.propertyAddress) || stringValue(body.address) || "20611 NW 33rd Pl, Miami Gardens, FL 33056",
    caseNumber: stringValue(seed.caseNumber) || stringValue(body.caseNumber) || undefined,
    county: stringValue(seed.county) || stringValue(body.county) || "miami-dade",
    parcelId: stringValue(seed.parcelId) || stringValue(body.parcelId) || stringValue(body.folio) || undefined,
    taxCollectorListingUrl: stringValue(seed.taxCollectorListingUrl) || stringValue(taxReceipt.listingUrl) || undefined,
    taxCollectorReceiptUrl: stringValue(seed.taxCollectorReceiptUrl) || stringValue(taxReceipt.receiptLink) || stringValue(taxReceipt.receiptUrl) || undefined,
    source: "operator_cli",
    includeDealMath: false,
    includeSkipTrace: body.includeSkipTrace === true,
    ...(confirmedSourceFacts ? { confirmedSourceFacts } : {}),
  };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function idiAssetImportInputFromBody(body = {}) {
  const capture = objectValue(body.capture);
  const input = objectValue(body.idiAssetImport || body.idiImport || capture.idiAssetImport || capture.idiImport);
  const importedText = stringValue(input.importedText || body.idiImportedText);
  const attachment = objectValue(input.attachment);
  const sourceUrl = stringValue(attachment.sourceUrl || input.sourceUrl || input.reportSourceUrl);
  if (!importedText && !sourceUrl && !Array.isArray(input.candidates)) return null;
  return {
    provider: stringValue(input.provider) || "idi",
    mode: stringValue(input.mode) || undefined,
    paidRun: input.paidRun === true,
    paidRunApproved: input.paidRunApproved === true,
    approvalRecord: input.approvalRecord || undefined,
    readbackStatus: stringValue(input.readbackStatus) || undefined,
    apiKeySource: stringValue(input.apiKeySource) || undefined,
    importedText,
    candidates: Array.isArray(input.candidates) ? input.candidates : undefined,
    contactReviews: objectValue(input.contactReviews || body.contactReviews),
    capturedBy: stringValue(input.capturedBy || body.capturedBy) || undefined,
    adminOverrideReason: stringValue(input.adminOverrideReason) || undefined,
    attachment: {
      label: stringValue(attachment.label || input.label) || "IDI expanded asset search",
      sourceUrl: sourceUrl || undefined,
      fileKind: stringValue(attachment.fileKind || input.fileKind) || (sourceUrl ? "link" : "text"),
      fileName: stringValue(attachment.fileName || input.fileName) || undefined,
      capturedAt: stringValue(attachment.capturedAt) || new Date().toISOString(),
      capturedBy: stringValue(attachment.capturedBy || input.capturedBy || body.capturedBy) || undefined,
      reviewFlags: Array.isArray(attachment.reviewFlags) ? attachment.reviewFlags : ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"],
    },
  };
}

function idiAssetImportFactsFromBody(runId, seed, body = {}) {
  const input = idiAssetImportInputFromBody(body);
  if (!input) return [];
  const { buildIdiAssetSearchFacts } = require("../worker/dist/enrichment/idi-asset-search");
  return buildIdiAssetSearchFacts(runId, seed, input);
}

function summarizeSourceRunFacts(sourceFacts) {
  return discoverySourceLabels.map((item) => {
    const facts = sourceFacts.filter((fact) => fact.source === item.source);
    const flags = [...new Set(facts.flatMap((fact) => fact.reviewFlags || []))];
    const sourceStatusFact = facts.find((fact) => fact.factType === "source_status")
      || facts.find((fact) => String(fact.factType || "").endsWith("_status"));
    const extractedFacts = sourceEvidenceFacts(facts);
    const blocked = flags.includes("SOURCE_BLOCKED")
      || flags.includes("TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED")
      || flags.includes("PAID_SOURCE_APPROVAL_REQUIRED")
      || flags.includes("MISSING_SKIPTRACE_CONFIG");
    const status = blocked && !extractedFacts.length ? "blocked" : extractedFacts.length ? "partial" : "needs_review";
    return {
      source: item.source,
      label: item.label,
      mode: item.mode,
      status,
      factCount: facts.length,
      extractedFactTypes: [...new Set(extractedFacts.map((fact) => fact.factType))],
      reviewFlags: flags,
      nextAction: sourceStatusFact?.value && typeof sourceStatusFact.value === "object" && "note" in sourceStatusFact.value
        ? String(sourceStatusFact.value.note || "")
        : blocked
          ? `${item.label} needs source access or browser/operator review before Discovery can treat it as complete.`
          : extractedFacts.length
            ? `${item.label} returned structured facts; review and keep source evidence attached.`
            : `${item.label} still needs source evidence before Discovery can treat it as complete.`,
    };
  });
}

function sourceRunCredentialGate(source) {
  if (source === "property_appraiser") return "Public county property search";
  if (source === "tax_collector") return "Direct Tax Collector listing URL, TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID, or TAX_COLLECTOR_BROWSER_WORKFLOW_URL";
  if (source === "official_records" || source === "probate_court") return "MIAMI_DADE_CLERK_AUTH_KEY with Clerk Commercial Data Services units";
  if (source === "clerk_of_courts") return "OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID or OBITUARY_VITAL_WORKFLOW_URL";
  if (source === "idi") return "IDI_CORE_API_URL plus shared IDI_CORE_API_KEY and IDI_CORE_LIVE_RUN_APPROVED=true, or approved operator report import";
  if (source === "skip_trace") return "Approved skip-trace provider plus operator approval";
  if (source === "source_governance") return "Operator approval for manual, paid, voter, social, license, business/address, and field research";
  return "Source-specific evidence or operator review";
}

function sourceProofState(status) {
  if (status === "blocked") return "blocked";
  if (status === "needs_review") return "evidence_required";
  if (status === "partial") return "facts_returned_review_required";
  return "not_checked";
}

function governanceCatalogFromFacts(sourceFacts = []) {
  const fact = sourceFacts.find((item) =>
    item.source === "source_governance"
      && item.factType === "source_governance_catalog"
      && item.value
      && typeof item.value === "object"
  );
  return fact?.value && typeof fact.value === "object" ? fact.value : null;
}

function sourceDetailChecks(source, sourceFacts = []) {
  const catalog = governanceCatalogFromFacts(sourceFacts);
  if (!catalog) return [];
  const publicContracts = Array.isArray(catalog.publicSourceContracts) ? catalog.publicSourceContracts : [];
  const governedSources = Array.isArray(catalog.governedSources) ? catalog.governedSources : [];
  const manualTasks = Array.isArray(catalog.manualTasks) ? catalog.manualTasks : [];
  const contract = publicContracts.find((item) => item && item.source === source);
  const checks = [];
  if (contract && Array.isArray(contract.stages)) {
    checks.push(...contract.stages.map((stage) => ({
      code: stage.code,
      label: stage.title,
      type: "source_evidence_step",
      accessClass: contract.accessClass,
      status: stage.blocksUntilCaptured ? "evidence_required" : "review_required",
      operatorAction: stage.operatorAction,
      requiredEvidence: Array.isArray(stage.requiredEvidence) ? stage.requiredEvidence : [],
      blocksUntilCaptured: Boolean(stage.blocksUntilCaptured),
      automationAllowed: Boolean(contract.automationAllowed),
      legalTemplateAutofillAllowed: false,
    })));
  }
  if (source === "idi") {
    checks.push(
      {
        code: "idi_access_mode",
        label: "Confirm IDI access mode",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Use team backend access when configured, paste a personal approved key for one run, or open idiCORE and import the approved report.",
        requiredEvidence: ["approved IDI access mode", "review-owner approval"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_paid_run_approval",
        label: "Approve paid asset search",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Run one paid asset search by property address only after the review owner approves the lookup.",
        requiredEvidence: ["approval record", "property address search target"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_duplicate_guard",
        label: "Confirm first-run lock",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Do not rerun the paid search unless an admin override reason is recorded.",
        requiredEvidence: ["lock/readback status", "override reason if rerun"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_report_import",
        label: "Import approved report evidence",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "evidence_required",
        operatorAction: "Import the approved report text or attachment metadata when backend live access is not ready.",
        requiredEvidence: ["IDI report PDF/source note", "import timestamp/readback"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "idi_contact_review",
        label: "Review IDI contact candidates",
        type: "contact_review_gate",
        accessClass: "paid_approval_gated",
        status: "manual_review_required",
        operatorAction: "Accept spouse, children, relatives, and associates before Discovery or Closing Prep can use contact facts.",
        requiredEvidence: ["accepted contact candidates", "reviewer attribution"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
    );
  }
  if (source === "skip_trace") {
    checks.push(
      {
        code: "skiptrace_provider_access",
        label: "Confirm skip-trace provider access",
        type: "paid_source_guardrail",
        accessClass: "paid_approval_gated",
        status: "approval_required",
        operatorAction: "Connect an approved provider or leave skip trace blocked; do not substitute unreviewed contact data.",
        requiredEvidence: ["provider access approval", "source terms/storage approval"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
      {
        code: "skiptrace_contact_review",
        label: "Review skip-trace contacts",
        type: "contact_review_gate",
        accessClass: "paid_approval_gated",
        status: "manual_review_required",
        operatorAction: "Review phones, emails, and addresses before they can influence outreach or Discovery completion.",
        requiredEvidence: ["accepted contact candidates", "reviewer attribution"],
        blocksUntilCaptured: true,
        automationAllowed: false,
        storageApproved: false,
        legalTemplateAutofillAllowed: false,
      },
    );
  }
  if (source === "source_governance") {
    checks.push(...governedSources.map((item) => ({
      code: item.code,
      label: item.label,
      type: "governed_source",
      accessClass: item.accessClass,
      status: item.accessClass === "paid_approval_gated" ? "approval_required" : "manual_review_required",
      operatorAction: item.reason,
      requiredEvidence: ["source link, reviewed-not-found note, or approval record"],
      blocksUntilCaptured: false,
      automationAllowed: Boolean(item.automationAllowed),
      storageApproved: Boolean(item.storageApproved),
      legalTemplateAutofillAllowed: false,
    })));
    checks.push(...manualTasks.map((task) => ({
      code: task.code,
      label: task.title,
      type: "manual_task",
      accessClass: task.accessClass,
      status: "manual_review_required",
      operatorAction: task.description,
      requiredEvidence: ["operator note, source link, photo, or reviewed-not-found note"],
      blocksUntilCaptured: false,
      automationAllowed: false,
      storageApproved: false,
      legalTemplateAutofillAllowed: false,
    })));
  }
  return checks;
}

const detailEvidenceFactTypes = {
  owner_type: ["owner_type", "property_owner", "property_folio"],
  mailing_address: ["mailing_address", "mailing_address_signal"],
  tax_search: ["tax_history_status", "tax_receipt_status", "tax_receipt_link"],
  listing_page: ["tax_receipt_status", "tax_receipt_link"],
  bottom_right_receipt: ["tax_receipt_link", "tax_receipt_attachment"],
  payer_review: ["tax_last_paid_by", "tax_payer_identity", "tax_paid_date", "tax_amount_due", "unpaid_tax_years", "tax_reassessment_signal"],
  latest_deed: ["latest_deed", "deed_attachment", "or_book_page"],
  title_friction: ["title_signal", "ownership_activity_note", "mortgage_signal", "lien_signal", "lis_pendens_signal", "foreclosure_signal", "adverse_possession_signal"],
  recent_sale_stop: ["last_sale_date"],
  case_lookup: ["case_number", "probate_case_status", "civil_family_docket_ref", "probate_docket_status"],
  affidavit_documents: ["affidavit_of_heirs_status", "probate_document_availability"],
  or_cross_link: ["official_record_cross_link"],
  obituary_search: ["obituary_link", "obituary_snapshot", "marriage_death_status", "memorial_search_tasks"],
  vital_indicators: ["date_of_birth", "date_of_death", "marriage_license_signal", "death_certificate_status", "incarceration_status_signal"],
  idi_access_mode: ["idi_asset_search_status", "idi_asset_report_attachment"],
  idi_paid_run_approval: ["idi_asset_search_status"],
  idi_duplicate_guard: ["idi_asset_search_status"],
  idi_report_import: ["idi_asset_search_status", "idi_asset_report_attachment"],
  idi_contact_review: ["primary_contact_profile", "alternative_contact_profile"],
  skiptrace_provider_access: ["skip_trace_status"],
  skiptrace_contact_review: ["enriched_contact_profile"],
};

function sourceStatusEvidence(source, code, facts = []) {
  const statuses = facts.filter((fact) =>
    fact.source === source
      && fact.factType === "source_status"
      && sourceFactValuePresent(fact.value)
  );
  return statuses.filter((fact) => {
    if (sourceFactHasBlockingFlag(fact)) return false;
    const value = fact.value && typeof fact.value === "object" ? fact.value : {};
    if (code === "tax_search" || code === "listing_page") return Boolean(value.listingUrl || value.receiptUrl || value.ok);
    if (code === "case_lookup") return Boolean(value.caseStatus || value.caseType || value.docketCount || value.ok);
    return Boolean(value.ok);
  });
}

function satisfiedEvidenceForCheck(source, check, sourceFacts = []) {
  const codes = detailEvidenceFactTypes[check.code] || [];
  const facts = sourceFacts.filter((fact) => fact.source === source);
  const checkCode = String(check.code || "");
  const byFactType = facts.filter((fact) =>
    codes.includes(fact.factType)
      && sourceFactValuePresent(fact.value)
      && !sourceFactHasBlockingFlag(fact)
      && (checkCode !== "idi_contact_review" || ["accepted", "promoted"].includes(String(fact.value?.reviewStatus || "")))
      && (checkCode !== "idi_paid_run_approval" || Boolean(fact.value?.paidRunApproved || fact.value?.approvalRecord || fact.value?.paidRun === true))
  );
  const statusFacts = sourceStatusEvidence(source, check.code, facts);
  return [...byFactType, ...statusFacts].map((fact) => ({
    factType: fact.factType,
    sourceUrl: fact.sourceUrl || fact.attachment?.sourceUrl || undefined,
    rawId: fact.rawId,
  }));
}

function applySourceDetailEvidence(source, check, sourceFacts = []) {
  const satisfiedBy = satisfiedEvidenceForCheck(source, check, sourceFacts);
  if (!satisfiedBy.length) return check;
  return {
    ...check,
    status: "evidence_returned_review_required",
    resolved: true,
    satisfiedFactTypes: [...new Set(satisfiedBy.map((fact) => fact.factType))],
    satisfiedBy,
    legalTemplateAutofillAllowed: false,
  };
}

function detailCheckBlocks(check) {
  const status = String(check?.status || "");
  return Boolean(check?.blocksUntilCaptured)
    && !["evidence_returned_review_required", "ready_for_review", "complete", "completed"].includes(status);
}

function sourceRunProofLedger(sourceSummaries, sourceFacts = []) {
  const sources = sourceSummaries.map((summary) => {
    const source = String(summary.source || "");
    const status = String(summary.status || "not_checked");
    const proofState = sourceProofState(status);
    const factCount = Number(summary.factCount || 0);
    return {
      source,
      label: summary.label,
      mode: summary.mode,
      status,
      proofState,
      completionGate: proofState === "facts_returned_review_required" ? "operator_review_required" : "blocked",
      credentialGate: sourceRunCredentialGate(source),
      factCount,
      extractedFactTypes: summary.extractedFactTypes,
      reviewFlags: summary.reviewFlags,
      nextAction: summary.nextAction,
      detailChecks: sourceDetailChecks(source, sourceFacts).map((check) => applySourceDetailEvidence(source, check, sourceFacts)),
      legalTemplateAutofillAllowed: false,
    };
  });
  const blockedCount = sources.filter((item) => item.proofState === "blocked").length;
  const evidenceRequiredCount = sources.filter((item) => item.proofState === "evidence_required").length;
  const detailCheckCount = sources.reduce((total, item) => total + (Array.isArray(item.detailChecks) ? item.detailChecks.length : 0), 0);
  const blockingDetailCheckCount = sources.reduce((total, item) =>
    total + (Array.isArray(item.detailChecks) ? item.detailChecks.filter(detailCheckBlocks).length : 0), 0);
  return {
    completionStandard: "proof_or_explicit_blocker",
    allRequiredSourcesAccountedFor: discoverySourceLabels.every((item) => sources.some((source) => source.source === item.source)),
    readyForOperatorReview: blockedCount === 0 && evidenceRequiredCount === 0 && blockingDetailCheckCount === 0,
    readyForDiscoveryCompletion: false,
    legalTemplateAutofillAllowed: false,
    blockedCount,
    evidenceRequiredCount,
    detailCheckCount,
    blockingDetailCheckCount,
    unresolvedDetailCheckCount: blockingDetailCheckCount,
    factsReturnedCount: sources.filter((item) => item.factCount > 0).length,
    sources,
  };
}

function mergeTaxCollectorCapture(capture = {}, taxCollectorReceiptRun = null) {
  if (!taxCollectorReceiptRun) return capture;
  const runCapture = taxCollectorCaptureFromRun(taxCollectorReceiptRun);
  return {
    ...capture,
    taxReceipt: {
      ...(capture.taxReceipt || {}),
      ...runCapture,
    },
  };
}

async function maybeRunTaxCollectorReceipt(body, seed) {
  const capture = body.capture && typeof body.capture === "object" ? body.capture : body;
  const existingReceipt = capture?.taxReceipt?.receiptLink || capture?.taxReceipt?.receiptUrl || capture?.taxReceipt?.sourceUrl;
  const existingListingHtml = capture?.taxReceipt?.listingHtml;
  const hasPriorFacts = seed.parcelId || seed.propertyAddress || seed.ownerName || existingListingHtml || existingReceipt;
  if (!hasPriorFacts) return null;
  return runTaxCollectorReceiptSearch({
    ...body,
    capture,
    seed,
  });
}

function mergeConfirmedFacts(seed, facts = []) {
  if (!facts.length) return seed;
  return {
    ...seed,
    confirmedSourceFacts: [
      ...(Array.isArray(seed.confirmedSourceFacts) ? seed.confirmedSourceFacts : []),
      ...facts,
    ],
  };
}

async function handleExternalSourceRun(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/discovery/external-source-run", {
    req,
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  const baseSeed = sourceRunSeedFromBody(body);
  const taxCollectorReceiptRun = await maybeRunTaxCollectorReceipt(body, baseSeed);
  const seed = mergeConfirmedFacts(baseSeed, taxCollectorReceiptRun?.sourceFacts || []);
  const { runDryPipeline } = require("../worker/dist/index");
  const pipeline = await runDryPipeline(seed, { env: taxCollectorReceiptRun ? withoutTaxCollectorAcquisitionEnv(process.env) : process.env });
  const baseCapture = body.capture && typeof body.capture === "object" ? body.capture : body;
  const capture = mergeTaxCollectorCapture(baseCapture, taxCollectorReceiptRun);
  const capturedSourceFacts = localSourceFactsFromCapture({ ...capture, seed, runId: pipeline.runId });
  const sourceFacts = [
    ...pipeline.facts,
    ...capturedSourceFacts,
    ...idiAssetImportFactsFromBody(pipeline.runId, seed, body),
  ].filter((fact) => discoverySourceLabels.some((item) => item.source === fact.source));
  const sourceSummaries = summarizeSourceRunFacts(sourceFacts);
  const sourceRunProof = sourceRunProofLedger(sourceSummaries, sourceFacts);
  const blockers = [...new Set([
    ...sourceSummaries
      .filter((summary) => summary.status === "blocked" || summary.status === "needs_review")
      .map((summary) => summary.nextAction),
    ...(pipeline.dossier.audit.reviewFlags.includes("SOURCE_BLOCKED")
      ? ["One or more Discovery sources are blocked; keep the packet in review."]
      : []),
  ])];
  sendJson(res, 200, {
    ok: blockers.length === 0,
    mode: "external_source_run",
    runId: pipeline.runId,
    estateId: body.assetKey || seed.estateName || seed.propertyAddress || seed.parcelId || "source-run",
    generatedAt: new Date().toISOString(),
    seed,
    sourceSummaries,
    sourceRunProof,
    sourceFacts,
    taxCollectorReceiptRun,
    dossier: pipeline.dossier,
    blockers,
    message: blockers.length
      ? "Discovery source checks ran and returned review blockers. The app did not assume missing public or paid-source facts."
      : "Discovery source checks returned structured source facts for review.",
  }, { "cache-control": "no-store" });
}

async function handleContactCandidateReview(req, res, candidateId) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson(`/api/discovery/contact-candidates/${encodeURIComponent(candidateId)}/review`, {
    req,
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

function normalizedExportFlow(body = {}) {
  const raw = String(body.flow || body.docPrepFlow || (body.batch ? "batch" : "discovery")).trim();
  if (raw === "closing" || raw === "closing-docs" || raw === "closing-prep") return "closing-docs";
  if (raw === "batch") return body.docPrepFlow === "closing-docs" ? "closing-docs" : "discovery";
  return "discovery";
}

function exportSectionsForFlow(flow) {
  if (flow === "closing-docs") {
    return ["Reviewed Discovery File", "Closing field map", "Required seller/client fields", "Template fill review", "Closing Prep packet"];
  }
  return ["Discovery dossier", "Completed lead report", "Source notes", "Closing Prep review", "CRM handoff"];
}

function exportTitleForFlow(flow, isBatch) {
  if (flow === "closing-docs") return isBatch ? "HeirRight Batch Closing Prep Packet" : "HeirRight Closing Prep Packet";
  return isBatch ? "HeirRight Batch Discovery Prep Packet" : "HeirRight Discovery Prep Packet";
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
    req,
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
  const latestRun = JSON.parse(readFileSync(latestRunPath, "utf8"));
  const flow = normalizedExportFlow(body);
  const estateId = body.estateId || body.leadId || latestRun.dossier?.id || "latest";
  const title = exportTitleForFlow(flow, Boolean(body.batch || body.mode === "batch"));
  const results = Array.from(new Set(routes)).map((route) => localExportRoute(route, dryRun));
  sendJson(res, 200, sanitizeLocalExportResult({
    ok: results.every((result) => result.ok),
    generatedAt: new Date().toISOString(),
    dossierId: latestRun.dossier?.id ?? "latest",
    routes: results,
    blockers: results.flatMap((result) => result.blockers),
    artifact: {
      kind: "single_pdf",
      contentType: "application/pdf",
      flow,
      estateId,
      url: `/api/reports/pdf?title=${encodeURIComponent(title)}&status=${encodeURIComponent(dryRun ? "Review packet" : "Controlled export packet")}`,
      sections: exportSectionsForFlow(flow),
    },
  }));
}

async function handleFreshLeadBatch(req, res, options = {}) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  if (!options.localOnly) {
    const proxied = await proxyWorkerJson("/api/leads/fresh-batch", {
      req,
      method: "POST",
      body: JSON.stringify(body),
    });
    if (proxied) {
      res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
      res.end(proxied.body);
      return;
    }
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

async function handleDeepHealth(req, res) {
  const proxied = await proxyWorkerJson("/api/health/deep", { req, method: "GET" });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  sendJson(res, 200, {
    ok: true,
    backendTarget: "vercel-artifact-fallback",
    service: "heirright-artifact",
    message: "Cloudflare Worker backend is not configured for this frontend environment.",
    routes: {
      "/api/leads/fresh-batch": "local",
      "/api/leads/public-source-pull": "local",
      "/api/discovery/idi-asset-search/import": "local",
      "/api/discovery/source-capture": "local",
      "/api/discovery/contact-candidates/:id/review": "local",
      "/api/closing-docs/export-google": "blocked_without_worker",
      "/api/outreach/sync": "fallback_without_worker",
    },
    connections: localConnectionStatuses(),
  }, { "cache-control": "no-store" });
}

async function handlePodioDiagnostics(req, res) {
  const proxied = await proxyWorkerJson("/api/podio/diagnostics", { req, method: "GET" });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  sendJson(res, 200, {
    ok: false,
    status: "blocked",
    blockers: ["Cloudflare Worker backend is required for Podio diagnostics."],
    message: "Podio diagnostics are blocked until HEIRRIGHT_WORKER_URL is configured.",
  }, { "cache-control": "no-store" });
}

async function handleClosingDocsGoogleExport(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const proxiedBody = { ...body };
  if (proxiedBody.dryRun === undefined && url.searchParams.has("dry-run")) {
    proxiedBody.dryRun = url.searchParams.get("dry-run") !== "false";
  }
  const proxied = await proxyWorkerJson("/api/closing-docs/export-google", {
    req,
    method: "POST",
    body: JSON.stringify(proxiedBody),
  });
  if (proxied) {
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  sendJson(res, 200, {
    ok: false,
    status: "blocked",
    blockers: ["Cloudflare Worker backend is required for Closing Docs Google export."],
    message: "Closing Docs export is blocked until HEIRRIGHT_WORKER_URL is configured.",
  }, { "cache-control": "no-store" });
}

async function createVercelLinearIssue(title, description) {
  const apiKey = process.env.HEIRRIGHT_LINEAR_API_KEY || process.env.LINEAR_API_KEY;
  const teamId = process.env.HEIRRIGHT_LINEAR_TEAM_ID || process.env.LINEAR_TEAM_ID;
  if (!apiKey || !teamId) return null;
  const input = {
    teamId,
    title,
    description,
    priority: 3,
  };
  const projectId = process.env.HEIRRIGHT_LINEAR_PROJECT_ID || process.env.LINEAR_PROJECT_ID;
  const assigneeId = process.env.HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID || process.env.LINEAR_DEFAULT_ASSIGNEE_ID;
  const labelIds = String(process.env.HEIRRIGHT_LINEAR_LABEL_IDS || process.env.HEIRRIGHT_LINEAR_INCIDENT_LABEL_IDS || process.env.LINEAR_LABEL_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (projectId) input.projectId = projectId;
  if (assigneeId) input.assigneeId = assigneeId;
  if (labelIds.length) input.labelIds = labelIds;
  const createIssue = async (issueInput) => {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        query: "mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }",
        variables: { input: issueInput },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.errors?.length || !data.data?.issueCreate?.success) {
      throw new Error(data.errors?.map((error) => error.message).join("; ") || `Linear API failed with ${response.status}`);
    }
    return data.data.issueCreate.issue;
  };
  try {
    return await createIssue(input);
  } catch (error) {
    if (!input.labelIds?.length) throw error;
    const retryInput = { ...input };
    delete retryInput.labelIds;
    return createIssue(retryInput);
  }
}

async function handleOutreachSync(req, res) {
  const body = req.method === "POST" ? await readJsonBody(req) : {};
  const proxied = await proxyWorkerJson("/api/outreach/sync", {
    req,
    method: "POST",
    body: JSON.stringify(body),
  });
  if (proxied) {
    let payload = null;
    try {
      payload = JSON.parse(proxied.body);
    } catch {
      payload = null;
    }
    if (payload?.ok && payload.status === "ready_for_podio_review" && !payload.linearIssue) {
      const issue = await createVercelLinearIssue(
        "[HeirRight outreach] Automation setup/readback needed",
        [
          "HeirRight outreach sync fell back to the first-party package.",
          "",
          `Package: ${payload.package?.packageId || "unknown"}`,
          `Blockers: ${(payload.blockers || []).join("; ") || "None"}`,
          "",
          "No SMS, email, or live Podio outreach send was attempted.",
        ].join("\n"),
      ).catch(() => null);
      if (issue) {
        payload.linearIssue = issue;
        res.writeHead(proxied.status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
        res.end(`${JSON.stringify(payload, null, 2)}\n`);
        return;
      }
    }
    res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
    res.end(proxied.body);
    return;
  }
  sendJson(res, 200, {
    ok: true,
    status: "ready_for_podio_review",
    fallback: "First-party Outreach package",
    package: {
      packageId: `outreach-${Date.now()}`,
      source: "HeirRight Leads",
      template: body.template || null,
      campaign: body.campaign || null,
      lead: body.lead || null,
      guardrails: {
        noDirectSend: true,
        requiresReadbackProof: true,
        podioReady: false,
      },
    },
    blockers: ["Cloudflare Worker backend is not configured.", "Podio controlled write/readback is not approved in this environment."],
    message: "Outreach was staged as a Podio-compatible review package. No outbound SMS or email was sent.",
  }, { "cache-control": "no-store" });
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

  if (url.pathname === "/api/health/deep") {
    handleDeepHealth(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/podio/diagnostics") {
    handlePodioDiagnostics(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/podio/oauth/start" || url.pathname === "/api/podio/oauth/callback") {
    proxyWorkerHttp(req, res, `${url.pathname}${url.search}`)
      .then((proxied) => {
        if (!proxied) {
          sendJson(res, 503, { ok: false, error: "worker_unavailable", message: "Podio connect is unavailable until the Worker URL is configured." });
        }
      })
      .catch((error) => sendJson(res, 502, { ok: false, error: error.message }));
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
    proxyWorkerJson("/api/connections/status", { req, method: "GET" })
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

  if (url.pathname === "/api/discovery/idi-core/status") {
    proxyWorkerJson("/api/discovery/idi-core/status", { req, method: "GET" })
      .then((proxied) => {
        if (proxied) {
          res.writeHead(proxied.status, { "content-type": proxied.contentType, "cache-control": "no-store" });
          res.end(proxied.body);
          return;
        }
        sendJson(res, 200, buildIdiCoreStatus(process.env), { "cache-control": "no-store" });
      })
      .catch((error) => sendJson(res, 502, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/reports/pdf") {
    reportPdfHandler(req, res);
    return;
  }

  if (url.pathname === "/api/outreach/activepieces") {
    activepiecesHandler(req, res);
    return;
  }

  if (url.pathname === "/api/outreach/sync") {
    handleOutreachSync(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/support/linear") {
    supportLinearHandler(req, res);
    return;
  }

  if (url.pathname === "/api/admin/access") {
    adminAccessHandler(req, res);
    return;
  }

  if (url.pathname === "/connection-status.json") {
    proxyWorkerJson("/connection-status.json", { req, method: "GET" })
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

  if (url.pathname === "/api/exports") {
    handleLocalExport(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/closing-docs/export-google") {
    handleClosingDocsGoogleExport(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
    return;
  }

  if (url.pathname === "/api/leads/fresh-batch" || url.pathname === "/api/leads/public-source-pull") {
    handleFreshLeadBatch(req, res, { localOnly: url.pathname === "/api/leads/public-source-pull" }).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
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

  if (url.pathname === "/api/discovery/tax-collector/receipt-run") {
    taxCollectorReceiptHandler(req, res);
    return;
  }

  if (url.pathname === "/api/discovery/external-source-run") {
    handleExternalSourceRun(req, res).catch((error) => sendJson(res, 500, { ok: false, error: error.message }));
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
    const proxied = proxyWorkerJson("/daily-run.json", { req, method: "GET" });
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
    const proxied = proxyWorkerJson(url.pathname, { req, method: "GET" });
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
    const proxied = proxyWorkerJson(url.pathname, { req, method: "GET" });
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
