import type { FactType, FreshLeadBatchRequest, FreshLeadSearchMode, IntakeSeed, RawDossier, ReviewFlag, SourceAttachmentRef, SourceFact } from "@ple/types";
import { discoverTaxCollectorReceipt } from "./adapters/tax-collector-receipt";
import { runDailyProduction } from "./daily/run-daily";
import { buildControlledPodioTestSeed } from "./export/controlled-test-lead";
import { connectionStatuses, exportCompletedReport, podioReadbackBlockerMessage, resolvePodioAccessToken } from "./export/export-package";
import { TEXAS_EQUITY_PROS_LEADS_APP_ID, TEXAS_EQUITY_PROS_LEADS_SPACE_ID } from "./export/podio-config";
import { runDryPipeline } from "./index";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "./lib";
import { runFreshLeadBatch } from "./live/source-batch";
import { renderQualificationReviewMarkdown } from "./qualification/qualification-review";
import { buildReadbackEvidencePacket, renderReadbackEvidenceMarkdown } from "./readback/readback-evidence";

interface CloudflareEnv {
  DEPLOYMENT_KEY?: string;
  COUNTY_LIST?: string;
  PODIO_ACCESS_TOKEN?: string;
  PODIO_REFRESH_TOKEN?: string;
  PODIO_CLIENT_ID?: string;
  PODIO_CLIENT_SECRET?: string;
  PODIO_APP_TOKEN?: string;
  PODIO_APP_ID?: string;
  PODIO_SPACE_ID?: string;
  PODIO_FIELD_MAP_JSON?: string;
  PODIO_REPORT_FILE_URL?: string;
  PODIO_LIVE_WRITE_APPROVED?: string;
  PODIO_TEST_PHONE?: string;
  PODIO_TEST_EMAIL?: string;
  PODIO_LEAD_POINT_PROFILE_ID?: string;
  PODIO_LOGIN_URL?: string;
  PODIO_WORKSPACE_NAME?: string;
  PODIO_APP_NAME?: string;
  PODIO_OAUTH_REDIRECT_URI?: string;
  PODIO_OAUTH_COOKIE_SECRET?: string;
  PODIO_OAUTH_STATE_COOKIE?: string;
  PODIO_OAUTH_REFRESH_COOKIE?: string;
  AUTH_REQUIRED?: string;
  AUTH_SESSION_SECRET?: string;
  AUTH_SESSION_COOKIE?: string;
  AUTH_ALLOWED_DOMAINS?: string;
  AUTH_ALLOWED_EMAILS?: string;
  SOLVYS_ADMIN_EMAILS?: string;
  HEIRRIGHT_API_TOKEN?: string;
  GOOGLE_WORKSPACE_ACCESS_TOKEN?: string;
  GOOGLE_TRACKING_SHEET_ID?: string;
  GOOGLE_DRIVE_PARENT_FOLDER_ID?: string;
  GOOGLE_TRACKING_SHEET_RANGE?: string;
  GOOGLE_LIVE_WRITE_APPROVED?: string;
  GOOGLE_WORKSPACE_WEBHOOK_URL?: string;
  GOOGLE_WORKSPACE_WEBHOOK_SECRET?: string;
  IDI_CORE_API_URL?: string;
  IDI_CORE_API_KEY?: string;
  IDI_CORE_LIVE_RUN_APPROVED?: string;
  IDI_CORE_LOGIN_URL?: string;
  IDI_CORE_PORTAL_URL?: string;
  IDI_CORE_SEARCH_URL?: string;
  IDI_CORE_ACCOUNT_ID?: string;
  IDI_CORE_ACCOUNT_COMPANY?: string;
  IDI_CORE_OPERATOR_EMAIL?: string;
  ACTIVEPIECES_WEBHOOK_URL?: string;
  HEIRRIGHT_ACTIVEPIECES_WEBHOOK_URL?: string;
  ACTIVEPIECES_API_KEY?: string;
  HEIRRIGHT_LINEAR_API_KEY?: string;
  LINEAR_API_KEY?: string;
  HEIRRIGHT_LINEAR_TEAM_ID?: string;
  LINEAR_TEAM_ID?: string;
  HEIRRIGHT_LINEAR_PROJECT_ID?: string;
  LINEAR_PROJECT_ID?: string;
  HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID?: string;
  LINEAR_DEFAULT_ASSIGNEE_ID?: string;
}

const DEFAULT_ADDRESS = "20611 NW 33rd Pl, Miami Gardens, FL 33056";
const DEFAULT_OWNER = "Fresh public-source lead";
const PODIO_OAUTH_STATE_TTL_SECONDS = 10 * 60;
const PODIO_OAUTH_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function routeList(): string[] {
  return [
    "/dry-run",
    "/latest-run.json",
    "/latest-dossier.json",
    "/podio-dry-run.json",
    "/internal-summary.md",
    "/internal-summary.html",
    "/daily-run.json",
    "/qualification-review.json",
    "/qualification-review.md",
    "/api/leads/fresh-batch",
    "/api/leads/public-source-pull",
    "/api/discovery/idi-core/status",
    "/api/discovery/idi-asset-search/import",
    "/api/discovery/source-capture",
    "/api/discovery/contact-candidates/:id/review",
    "/api/closing-docs/export-google",
    "/api/outreach/sync",
    "/api/exports",
    "/api/podio/diagnostics",
    "/api/podio/oauth/start",
    "/api/podio/oauth/callback",
    "/api/connections/status",
    "/api/health/deep",
    "/readback-evidence.json",
    "/readback-evidence.md",
  ];
}

function splitList(value: string | undefined, fallback = ""): string[] {
  return String(value || fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseCookie(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of String(header || "").split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    cookies[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return cookies;
}

function responseCookie(request: Request, name: string, value: string, maxAgeSeconds: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function clearResponseCookie(request: Request, name: string): string {
  return responseCookie(request, name, "", 0);
}

function base64UrlToBase64(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return padded + "=".repeat((4 - (padded.length % 4)) % 4);
}

function utf8ToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToUtf8(value: Uint8Array): string {
  return new TextDecoder().decode(value);
}

function byteArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function base64UrlToBytes(value: string): Uint8Array {
  const binary = atob(base64UrlToBase64(value));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", byteArrayBuffer(utf8ToBytes(value)));
  return new Uint8Array(digest);
}

async function hmacBase64Url(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    byteArrayBuffer(utf8ToBytes(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, byteArrayBuffer(utf8ToBytes(payload)));
  return bytesToBase64Url(new Uint8Array(signature));
}

function podioStateCookieName(env: CloudflareEnv): string {
  return env.PODIO_OAUTH_STATE_COOKIE || "hr_podio_state";
}

function podioRefreshCookieName(env: CloudflareEnv): string {
  return env.PODIO_OAUTH_REFRESH_COOKIE || "hr_podio_refresh";
}

function podioCookieSecret(env: CloudflareEnv): string {
  return env.PODIO_OAUTH_COOKIE_SECRET || env.AUTH_SESSION_SECRET || env.HEIRRIGHT_API_TOKEN || "";
}

function publicOriginFor(request: Request): string {
  const explicitOrigin = request.headers.get("x-heirright-public-origin");
  if (explicitOrigin) return explicitOrigin.replace(/\/+$/, "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

function podioRedirectUri(request: Request, env: CloudflareEnv): string {
  return env.PODIO_OAUTH_REDIRECT_URI || `${publicOriginFor(request)}/api/podio/oauth/callback`;
}

async function encryptCookieValue(value: string, env: CloudflareEnv): Promise<string | null> {
  const secret = podioCookieSecret(env);
  if (!secret) return null;
  const keyBytes = await sha256Bytes(secret);
  const key = await crypto.subtle.importKey("raw", byteArrayBuffer(keyBytes), { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: byteArrayBuffer(iv) }, key, byteArrayBuffer(utf8ToBytes(value)));
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(cipher))}`;
}

async function decryptCookieValue(value: string | undefined, env: CloudflareEnv): Promise<string | null> {
  if (!value || !value.includes(".")) return null;
  const secret = podioCookieSecret(env);
  if (!secret) return null;
  const [ivRaw, cipherRaw] = value.split(".");
  if (!ivRaw || !cipherRaw) return null;
  try {
    const keyBytes = await sha256Bytes(secret);
    const key = await crypto.subtle.importKey("raw", byteArrayBuffer(keyBytes), { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: byteArrayBuffer(base64UrlToBytes(ivRaw)) },
      key,
      byteArrayBuffer(base64UrlToBytes(cipherRaw)),
    );
    return bytesToUtf8(new Uint8Array(plain));
  } catch {
    return null;
  }
}

async function podioRuntimeEnv(request: Request, env: CloudflareEnv): Promise<CloudflareEnv> {
  const refreshCookie = parseCookie(request.headers.get("cookie"))[podioRefreshCookieName(env)];
  const refreshToken = await decryptCookieValue(refreshCookie, env);
  return refreshToken ? { ...env, PODIO_REFRESH_TOKEN: refreshToken } : env;
}

function html(body: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
  return new Response(body, {
    ...init,
    headers,
  });
}

function emailAllowed(email: string | undefined, env: CloudflareEnv): boolean {
  const normalized = String(email || "").toLowerCase();
  const domain = normalized.split("@")[1] || "";
  const domains = splitList(env.AUTH_ALLOWED_DOMAINS, "heirright.com");
  const emails = splitList(env.AUTH_ALLOWED_EMAILS || env.SOLVYS_ADMIN_EMAILS);
  return emails.includes(normalized) || domains.includes(domain);
}

async function hasValidSession(request: Request, env: CloudflareEnv): Promise<boolean> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (env.HEIRRIGHT_API_TOKEN && bearer === env.HEIRRIGHT_API_TOKEN) return true;
  if (!env.AUTH_SESSION_SECRET) return false;

  const cookieName = env.AUTH_SESSION_COOKIE || "hr_session";
  const token = parseCookie(request.headers.get("cookie"))[cookieName];
  if (!token || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacBase64Url(payload, env.AUTH_SESSION_SECRET);
  if (expected !== signature) return false;

  try {
    const body = JSON.parse(atob(base64UrlToBase64(payload))) as { email?: string; exp?: number };
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return false;
    return emailAllowed(body.email, env);
  } catch {
    return false;
  }
}

async function authBlocker(request: Request, env: CloudflareEnv): Promise<Response | null> {
  if (env.AUTH_REQUIRED === "false") return null;
  if (await hasValidSession(request, env)) return null;
  return json({
    ok: false,
    error: "auth_required",
    message: "Sign in with an approved HeirRight Google account or provide the internal API bearer token.",
  }, { status: 401 });
}

function seedFromUrl(url: URL, env: CloudflareEnv): IntakeSeed {
  const estateName = url.searchParams.get("estate") || undefined;
  const propertyAddress = url.searchParams.get("address") || undefined;
  const ownerName = url.searchParams.get("owner") || undefined;
  const caseNumber = url.searchParams.get("case-number") || undefined;
  const parcelId = url.searchParams.get("folio") || undefined;
  const county = url.searchParams.get("county") || env.COUNTY_LIST?.split(",")[0] || "miami-dade";

  if (!estateName && !propertyAddress && !parcelId && !caseNumber) {
    return {
      propertyAddress: DEFAULT_ADDRESS,
      ownerName: ownerName || DEFAULT_OWNER,
      county,
      parcelId,
      source: "operator_cli",
    };
  }

  return {
    estateName,
    propertyAddress,
    ownerName,
    caseNumber,
    county,
    parcelId,
    source: "operator_cli",
  };
}

function normalizeAssetAddress(value = ""): string {
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

function ownerLastName(value = ""): string {
  return String(value || "")
    .replace(/\b(est|estate|of|the)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .at(-1)?.toLowerCase() || "";
}

function idiLockKey(body: Record<string, unknown>): string {
  return [
    String(body.provider || "idi").toLowerCase(),
    normalizeAssetAddress(String(body.propertyAddress || body.address || body.assetAddress || "")),
    ownerLastName(String(body.ownerName || body.estateName || "")),
  ].filter(Boolean).join(":");
}

function idiCoreUserApiKey(body: Record<string, unknown>): string {
  return stringValue(body.idiCoreApiKey || body.userApiKey);
}

function idiCoreRequestApiKey(body: Record<string, unknown>, env: CloudflareEnv): string {
  return idiCoreUserApiKey(body) || stringValue(env.IDI_CORE_API_KEY);
}

function idiCoreApiKeySource(body: Record<string, unknown>, env: CloudflareEnv): "user_override" | "shared_default" | "missing" {
  if (idiCoreUserApiKey(body)) return "user_override";
  return env.IDI_CORE_API_KEY ? "shared_default" : "missing";
}

function idiCoreMissingConfig(env: CloudflareEnv, body: Record<string, unknown> = {}): string[] {
  const missing: string[] = [];
  if (!env.IDI_CORE_API_URL) missing.push("IDI_CORE_API_URL");
  if (!idiCoreRequestApiKey(body, env)) missing.push("IDI_CORE_API_KEY");
  return missing;
}

function idiCorePortalConfigured(env: CloudflareEnv): boolean {
  return Boolean(
    (env.IDI_CORE_PORTAL_URL || env.IDI_CORE_SEARCH_URL)
      && (env.IDI_CORE_ACCOUNT_ID || env.IDI_CORE_ACCOUNT_COMPANY || env.IDI_CORE_OPERATOR_EMAIL)
  );
}

function idiCoreLiveApproved(body: Record<string, unknown>, env: CloudflareEnv): boolean {
  return body.liveRunApproved === true || body.liveRunApproved === "true" || env.IDI_CORE_LIVE_RUN_APPROVED === "true";
}

function redactIdiCoreProviderResponse(value: unknown, depth = 0): unknown {
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.map((item) => redactIdiCoreProviderResponse(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
    key,
    /authorization|api[_-]?key|token|secret|password/i.test(key)
      ? "[redacted]"
      : redactIdiCoreProviderResponse(nested, depth + 1),
  ]));
}

async function liveIdiCoreResponse(body: Record<string, unknown>, env: CloudflareEnv): Promise<Response> {
  const lockKey = idiLockKey(body);
  const apiKey = idiCoreRequestApiKey(body, env);
  const apiKeySource = idiCoreApiKeySource(body, env);
  if (!idiCoreLiveApproved(body, env)) {
    return json({
      ok: false,
      error: "idi_live_run_not_approved",
      blockers: ["A live IDI Core run needs explicit approval before the app can spend a paid lookup."],
      message: "Live IDI Core is blocked until the review owner approves this paid asset search.",
    }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const missing = idiCoreMissingConfig(env, body);
  if (missing.length) {
    const portalConfigured = idiCorePortalConfigured(env);
    return json({
      ok: false,
      error: "idi_core_not_configured",
      blockers: [`Live IDI Core needs approved vendor access before it can run: ${missing.join(", ")}.`],
      message: portalConfigured
        ? "idiCORE portal access is configured for approved operator searches, but backend live runs still need vendor API access. Open idiCORE, run the approved property search, then import the report."
        : "Live IDI Core is not configured. Import an approved report or add vendor access before running the paid search.",
      apiKeySource,
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const response = await fetch(String(env.IDI_CORE_API_URL), {
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
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.ok === false) {
    return json({
      ok: false,
      error: data.error || "idi_core_run_failed",
      blockers: data.blockers || [`IDI Core returned ${response.status}. No Discovery contact facts were accepted.`],
      message: data.message || "Live IDI Core did not complete. The Discovery file remains blocked.",
      providerResponse: redactIdiCoreProviderResponse(data),
      apiKeySource,
    }, { status: response.status || 502, headers: { "cache-control": "no-store" } });
  }
  const candidates = Array.isArray(data.candidates) ? data.candidates : Array.isArray(data.contactCandidates) ? data.contactCandidates : [];
  return json({
    ok: true,
    mode: "live_idi_core",
    provider: body.provider || "idi",
    lockKey,
    importedAt: nowIso(),
    duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_paid_run_only",
    adminOverrideReason: body.adminOverrideReason || null,
    attachment: data.attachment || body.attachment || null,
    importedText: data.importedText || data.reportText || "",
    candidates,
    contactPreviewCount: candidates.length || stringValue(data.importedText || data.reportText).split(/\n{2,}/).filter(Boolean).length,
    paidRun: true,
    apiKeySource,
    readbackStatus: data.readbackStatus || data.status || "provider_completed",
    sourceEvidence: data.sourceEvidence || data.evidence || null,
    message: "Live IDI Core asset search completed and is ready for contact review.",
  }, { headers: { "cache-control": "no-store" } });
}

function receiptId(prefix = "heirright"): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sourceFactsFromCapture(runId: string, seed: IntakeSeed, capture: Record<string, unknown>): SourceFact[] {
  const subject = intakeSubject(seed);
  const fetchedAt = nowIso();
  const out: SourceFact[] = [];
  const addFact = (
    source: SourceFact["source"],
    factType: FactType,
    value: unknown,
    sourceUrl?: string,
    attachment?: SourceAttachmentRef,
    reviewFlags?: ReviewFlag[],
  ) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value) && !value.length) return;
    if (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length) return;
    out.push(fact({
      runId,
      source,
      rawId: `operator-source:${slug(seedIdentity(seed))}:${slug(factType)}:${out.length + 1}`,
      fetchedAt,
      county: seed.county,
      subject,
      factType,
      value,
      confidence: 0.85,
      sourceUrl,
      attachment,
      reviewFlags: reviewFlags ?? (sourceUrl || attachment
        ? ["HUMAN_REVIEW_REQUIRED"]
        : ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"]),
    }));
  };
  const taxReceipt = (capture.taxReceipt && typeof capture.taxReceipt === "object") ? capture.taxReceipt as Record<string, unknown> : {};
  const deed = (capture.deed && typeof capture.deed === "object") ? capture.deed as Record<string, unknown> : {};
  const propertyAppraiser = (capture.propertyAppraiser && typeof capture.propertyAppraiser === "object") ? capture.propertyAppraiser as Record<string, unknown> : {};
  const probate = (capture.probate && typeof capture.probate === "object") ? capture.probate as Record<string, unknown> : {};
  const obituary = (capture.obituary && typeof capture.obituary === "object") ? capture.obituary as Record<string, unknown> : {};
  const compactObject = (input: Record<string, unknown>) => {
    const output = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""));
    return Object.keys(output).length ? output : undefined;
  };
  const sourceAttachment = (label: string, sourceUrl?: string, fileName?: string, fileKind: SourceAttachmentRef["fileKind"] = "link"): SourceAttachmentRef | undefined => {
    if (!sourceUrl && !fileName) return undefined;
    return {
      label,
      sourceUrl,
      fileName,
      fileKind,
      capturedAt: fetchedAt,
      capturedBy: "source-capture",
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
    };
  };
  const receiptDiscovery = discoverTaxCollectorReceipt(taxReceipt);
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
    ? ["SOURCE_BLOCKED", "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED", "TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as ReviewFlag[]
    : receiptUrl
      ? receiptDiscovery?.reviewFlags ?? ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"] as ReviewFlag[]
      : ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as ReviewFlag[];
  const receiptAttachment = receiptUrl ? {
    label: "Tax Collector receipt",
    sourceUrl: receiptUrl,
    fileKind: "link",
    capturedAt: fetchedAt,
    capturedBy: "source-capture",
    reviewFlags: receiptDiscovery?.reviewFlags ?? ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
  } satisfies SourceAttachmentRef : undefined;
  addFact("tax_collector", "source_status", taxSourceStatus, listingUrl || receiptUrl, undefined, taxSourceStatusFlags);
  addFact("tax_collector", "tax_last_paid_by", taxReceipt.paidBy, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_payer_identity", taxReceipt.paidBy || taxReceipt.payerIdentity, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_paid_date", taxReceipt.paidDate, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_status", taxReceipt.status || (receiptUrl ? "receipt_link_captured" : undefined), listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_link", receiptUrl, receiptUrl, receiptAttachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_receipt_attachment", receiptAttachment, receiptUrl, receiptAttachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_amount_due", taxReceipt.amountDue, listingUrl || receiptUrl);
  addFact("tax_collector", "unpaid_tax_years", taxReceipt.unpaidYears, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_reassessment_signal", taxReceipt.reassessment, listingUrl || receiptUrl);
  const deedSourceUrl = stringValue(deed.documentUrl) || stringValue(deed.sourceUrl) || stringValue(deed.fileName);
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
  const deedAttachment = sourceAttachment("Official Records deed", stringValue(deed.documentUrl) || stringValue(deed.sourceUrl), stringValue(deed.fileName), deedSourceUrl && /\.pdf($|\?)/i.test(deedSourceUrl) ? "pdf" : "link");
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
  addFact("property_appraiser", "mailing_address_signal", propertyAppraiser.mailingAddressSignal || propertyAppraiser.mailingAddress, stringValue(propertyAppraiser.sourceUrl));
  const probateSourceUrl = stringValue(probate.docketUrl) || stringValue(probate.sourceUrl) || stringValue(probate.searchUrl);
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
  addFact("official_records", "official_record_cross_link", officialRecordCrossLink ? [officialRecordCrossLink] : undefined, stringValue(probate.officialRecordUrl) || deedSourceUrl);
  const obituarySourceUrl = stringValue(obituary.sourceUrl) || stringValue(obituary.fileName);
  const obituaryAttachment = sourceAttachment("Obituary snapshot/link", stringValue(obituary.sourceUrl), stringValue(obituary.fileName), obituarySourceUrl && /\.(png|jpe?g|webp)($|\?)/i.test(obituarySourceUrl) ? "image" : "link");
  addFact("clerk_of_courts", "marriage_death_status", obituary.status || (obituarySourceUrl ? "obituary_reviewed" : undefined), obituarySourceUrl);
  addFact("clerk_of_courts", "marriage_license_signal", obituary.marriageLicenseSignal, obituarySourceUrl);
  addFact("clerk_of_courts", "date_of_birth", obituary.dateOfBirth, obituarySourceUrl);
  addFact("clerk_of_courts", "date_of_death", obituary.dateOfDeath, obituarySourceUrl);
  addFact("clerk_of_courts", "obituary_link", obituary.sourceUrl || (obituary.status === "reviewed-not-found" ? "reviewed_not_found" : undefined), stringValue(obituary.sourceUrl));
  addFact("clerk_of_courts", "obituary_snapshot", obituaryAttachment, stringValue(obituary.sourceUrl), obituaryAttachment);
  addFact("clerk_of_courts", "memorial_search_tasks", [
    compactObject({ provider: "findagrave", url: obituary.findagraveUrl, note: obituary.findagraveNote }),
    compactObject({ provider: "legacy", url: obituary.legacyUrl, note: obituary.legacyNote }),
    compactObject({ provider: "google", url: obituary.googleUrl, note: obituary.googleNote }),
  ].filter(Boolean), obituarySourceUrl);
  addFact("clerk_of_courts", "death_certificate_status", obituary.deathCertificateStatus, obituarySourceUrl);
  addFact("clerk_of_courts", "incarceration_status_signal", obituary.incarcerationStatus, obituarySourceUrl);
  return out;
}

async function dryRunResponse(url: URL, env: CloudflareEnv): Promise<Response> {
  const result = await runDryPipeline(seedFromUrl(url, env), {
    env: env as Record<string, string | undefined>,
  });

  const output = url.pathname === "/latest-dossier.json"
    ? result.outputFiles.dossier
    : url.pathname === "/podio-dry-run.json"
      ? result.outputFiles.podio
      : url.pathname === "/internal-summary.md"
        ? result.outputFiles.summaryMarkdown
        : url.pathname === "/internal-summary.html"
          ? result.outputFiles.summaryHtml
          : result.outputFiles.latestRun;

  return new Response(output.body, {
    headers: {
      "content-type": output.contentType,
      "cache-control": "no-store",
    },
  });
}

async function dailyRunResponse(env: CloudflareEnv): Promise<Response> {
  const result = await runDailyProduction(undefined, {
    env: env as Record<string, string | undefined>,
  });
  return json(result, { headers: { "cache-control": "no-store" } });
}

async function qualificationReviewResponse(env: CloudflareEnv, markdown: boolean): Promise<Response> {
  const result = await runDailyProduction(undefined, {
    env: env as Record<string, string | undefined>,
  });
  if (markdown) {
    return new Response(renderQualificationReviewMarkdown(result.qualificationReview), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return json(result.qualificationReview, { headers: { "cache-control": "no-store" } });
}

function freshLeadRequestFromHttp(requestBody: FreshLeadBatchRequest | undefined, url: URL): FreshLeadBatchRequest {
  const query = url.searchParams.get("query")
    || url.searchParams.get("owner")
    || url.searchParams.get("address")
    || url.searchParams.get("folio")
    || undefined;
  const searchMode = url.searchParams.get("searchMode") || url.searchParams.get("mode");
  return {
    ...requestBody,
    source: "miami_dade_property_appraiser",
    filters: {
      ...(requestBody?.filters ?? {}),
      county: url.searchParams.get("county") ?? requestBody?.filters?.county,
      searchMode: (searchMode ?? requestBody?.filters?.searchMode) as FreshLeadSearchMode | undefined,
      query: query ?? requestBody?.filters?.query,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : requestBody?.filters?.limit,
      includeCompanyOwners: url.searchParams.get("includeCompanyOwners")
        ? url.searchParams.get("includeCompanyOwners") === "true"
        : requestBody?.filters?.includeCompanyOwners,
    },
  };
}

async function freshLeadBatchResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => undefined) as FreshLeadBatchRequest | undefined
    : undefined;
  const result = await runFreshLeadBatch(freshLeadRequestFromHttp(body, url), {
    env: env as Record<string, string | undefined>,
  });
  return json(result, { headers: { "cache-control": "no-store" } });
}

function normalizedExportFlow(body?: { flow?: unknown; docPrepFlow?: unknown; batch?: unknown; controlledTest?: unknown }): "controlled-test" | "discovery" | "closing-docs" {
  if (body?.controlledTest) return "controlled-test";
  const raw = stringValue(body?.flow) || stringValue(body?.docPrepFlow) || (body?.batch ? "batch" : "discovery");
  if (raw === "closing" || raw === "closing-docs" || raw === "closing-prep") return "closing-docs";
  if (raw === "batch") return body?.docPrepFlow === "closing-docs" ? "closing-docs" : "discovery";
  return "discovery";
}

function exportSectionsForFlow(flow: "controlled-test" | "discovery" | "closing-docs"): string[] {
  if (flow === "closing-docs") {
    return ["Reviewed Discovery File", "Closing field map", "Required seller/client fields", "Template fill review", "Closing Prep packet"];
  }
  return ["Discovery dossier", "Completed lead report", "Source notes", "Closing Prep review", "CRM handoff"];
}

async function exportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const dryRun = url.searchParams.get("dry-run") !== "false";
  const routesParam = url.searchParams.get("routes");
  const routes = routesParam
    ? routesParam.split(",").map((route) => route.trim()).filter((route): route is "google" | "podio" => route === "google" || route === "podio")
    : ["google", "podio"] as Array<"google" | "podio">;
  const body = request.method === "POST"
    ? await request.json().catch(() => undefined) as { seed?: IntakeSeed; routes?: Array<"google" | "podio">; dryRun?: boolean; controlledTest?: boolean; flow?: string; docPrepFlow?: string; batch?: boolean; estateId?: string; leadId?: string } | undefined
    : undefined;
  const seed = body?.controlledTest
    ? buildControlledPodioTestSeed(env as Record<string, string | undefined>)
    : body?.seed ?? seedFromUrl(url, env);
  const pipeline = await runDryPipeline(seed, {
    env: env as Record<string, string | undefined>,
  });
  const result = await exportCompletedReport({
    routes: body?.routes ?? routes,
    dossier: pipeline.dossier,
    dryRun: body?.dryRun ?? dryRun,
    controlledTest: body?.controlledTest,
  }, env as Record<string, string | undefined>);
  const flow = normalizedExportFlow(body);
  const title = flow === "closing-docs"
    ? `HeirRight Closing Prep Packet - ${pipeline.dossier.summary.displayName}`
    : `HeirRight Discovery Prep Packet - ${pipeline.dossier.summary.displayName}`;
  return json({
    ...result,
    artifact: {
      kind: "single_pdf",
      contentType: "application/pdf",
      flow,
      estateId: body?.estateId || body?.leadId || pipeline.dossier.id,
      url: `/api/reports/pdf?title=${encodeURIComponent(title)}&status=${encodeURIComponent(result.ok ? "Export review packet" : "Export blocked")}`,
      sections: exportSectionsForFlow(flow),
    },
  }, { headers: { "cache-control": "no-store" } });
}

async function idiAssetImportResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const wantsLiveRun = body.runMode === "live_idi_core" || body.mode === "live_idi_core" || body.paidRun === true;
  if (wantsLiveRun) return liveIdiCoreResponse(body, env);
  if (!stringValue(body.importedText) && !(body.attachment && typeof body.attachment === "object" && stringValue((body.attachment as Record<string, unknown>).sourceUrl))) {
    return json({
      ok: false,
      error: "missing_idi_report",
      message: "Paste the approved IDI Asset Discovery report text or attach report metadata before importing.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  return json({
    ok: true,
    mode: "operator_import",
    provider: body.provider || "idi",
    lockKey: idiLockKey(body),
    importedAt: nowIso(),
    duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_import_only",
    adminOverrideReason: body.adminOverrideReason || null,
    attachment: body.attachment || null,
    contactPreviewCount: stringValue(body.importedText).split(/\n{2,}/).filter(Boolean).length,
    paidRun: false,
    readbackStatus: "operator_import_only",
    sourceEvidence: null,
    message: "Approved IDI report metadata was imported for review. The production backend did not run IDI Core.",
  }, { headers: { "cache-control": "no-store" } });
}

async function sourceCaptureResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const seed = (body.seed && typeof body.seed === "object" ? body.seed : undefined) as IntakeSeed | undefined
    ?? seedFromUrl(new URL(request.url), env);
  const runId = stringValue(body.runId) || `source-capture-${Date.now()}-${slug(seedIdentity(seed))}`;
  const sourceFacts = sourceFactsFromCapture(runId, seed, body);
  return json({
    ok: true,
    mode: "source_review",
    id: body.assetKey || body.id || receiptId("source-capture"),
    capturedAt: nowIso(),
    seed,
    sourceFacts,
    reviewFlags: [...new Set(sourceFacts.flatMap((item) => item.reviewFlags))],
    message: sourceFacts.length
      ? "Source capture saved for Discovery review."
      : "Source capture saved, but no structured source facts were detected.",
  }, { headers: { "cache-control": "no-store" } });
}

const discoverySourceLabels: Array<{ source: SourceFact["source"]; label: string; mode: string }> = [
  { source: "property_appraiser", label: "Property Appraiser", mode: "public_api" },
  { source: "tax_collector", label: "Tax Collector", mode: "script_or_browser_required" },
  { source: "official_records", label: "Official Records", mode: "commercial_api_or_browser_capture" },
  { source: "probate_court", label: "Probate/Civil/Family Court", mode: "commercial_api_or_browser_capture" },
  { source: "clerk_of_courts", label: "Marriage, death, obituary, and vital review", mode: "browser_workflow_or_source_capture" },
  { source: "idi", label: "IDI Core Asset Search", mode: "paid_api_or_operator_import" },
  { source: "skip_trace", label: "Skip trace/contact enrichment", mode: "paid_manual_approval" },
  { source: "source_governance", label: "Governed manual and paid research", mode: "approval_gated_source_governance" },
];

function sourceRunSeedFromBody(body: Record<string, unknown>, fallback: IntakeSeed): IntakeSeed {
  const seed = body.seed && typeof body.seed === "object" ? body.seed as Record<string, unknown> : {};
  const capture = body.capture && typeof body.capture === "object" ? body.capture as Record<string, unknown> : body;
  const taxReceipt = capture.taxReceipt && typeof capture.taxReceipt === "object" ? capture.taxReceipt as Record<string, unknown> : {};
  return {
    ownerName: stringValue(seed.ownerName) || stringValue(body.ownerName) || stringValue(body.owner) || fallback.ownerName,
    estateName: stringValue(seed.estateName) || stringValue(body.estateName) || fallback.estateName,
    propertyAddress: stringValue(seed.propertyAddress) || stringValue(body.propertyAddress) || stringValue(body.address) || fallback.propertyAddress,
    caseNumber: stringValue(seed.caseNumber) || stringValue(body.caseNumber) || fallback.caseNumber,
    county: stringValue(seed.county) || stringValue(body.county) || fallback.county || "miami-dade",
    parcelId: stringValue(seed.parcelId) || stringValue(body.parcelId) || stringValue(body.folio) || fallback.parcelId,
    taxCollectorListingUrl: stringValue(seed.taxCollectorListingUrl) || stringValue(taxReceipt.listingUrl) || fallback.taxCollectorListingUrl,
    taxCollectorReceiptUrl: stringValue(seed.taxCollectorReceiptUrl) || stringValue(taxReceipt.receiptLink) || stringValue(taxReceipt.receiptUrl) || fallback.taxCollectorReceiptUrl,
    source: "operator_cli",
    includeDealMath: false,
    includeSkipTrace: body.includeSkipTrace === true,
  };
}

function factValuePresent(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function summarizeSourceRunFacts(facts: SourceFact[]): Array<Record<string, unknown>> {
  return discoverySourceLabels.map((item) => {
    const sourceFacts = facts.filter((factItem) => factItem.source === item.source);
    const flags = Array.from(new Set(sourceFacts.flatMap((factItem) => factItem.reviewFlags || [])));
    const sourceStatusFact = sourceFacts.find((factItem) => factItem.factType === "source_status")
      || sourceFacts.find((factItem) => `${factItem.factType}`.endsWith("_status"));
    const extractedFacts = sourceFacts.filter((factItem) =>
      factValuePresent(factItem.value)
      && !(factItem.reviewFlags || []).includes("SOURCE_HEALTH_ONLY")
      && !(factItem.reviewFlags || []).some((flag) => String(flag).startsWith("MISSING_"))
    );
    const blocked = flags.includes("SOURCE_BLOCKED")
      || flags.includes("TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED")
      || flags.includes("PAID_SOURCE_APPROVAL_REQUIRED")
      || flags.includes("MISSING_SKIPTRACE_CONFIG");
    const status = blocked ? "blocked" : extractedFacts.length ? "partial" : "needs_review";
    return {
      source: item.source,
      label: item.label,
      mode: item.mode,
      status,
      factCount: sourceFacts.length,
      extractedFactTypes: Array.from(new Set(extractedFacts.map((factItem) => factItem.factType))),
      reviewFlags: flags,
      nextAction: sourceStatusFact?.value && typeof sourceStatusFact.value === "object" && "note" in sourceStatusFact.value
        ? String((sourceStatusFact.value as Record<string, unknown>).note || "")
        : blocked
          ? `${item.label} needs source access or browser/operator review before Discovery can treat it as complete.`
          : extractedFacts.length
            ? `${item.label} returned structured facts; review and keep source evidence attached.`
            : `${item.label} still needs source evidence before Discovery can treat it as complete.`,
    };
  });
}

function sourceRunCredentialGate(source: string): string {
  if (source === "property_appraiser") return "Public county property search";
  if (source === "tax_collector") return "Direct Tax Collector listing URL, TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID, or TAX_COLLECTOR_BROWSER_WORKFLOW_URL";
  if (source === "official_records" || source === "probate_court") return "MIAMI_DADE_CLERK_AUTH_KEY with Clerk Commercial Data Services units";
  if (source === "clerk_of_courts") return "OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID or OBITUARY_VITAL_WORKFLOW_URL";
  if (source === "idi") return "IDI_CORE_API_URL plus shared IDI_CORE_API_KEY and IDI_CORE_LIVE_RUN_APPROVED=true, or approved operator report import";
  if (source === "skip_trace") return "Approved skip-trace provider plus operator approval";
  if (source === "source_governance") return "Operator approval for manual, paid, voter, social, license, business/address, and field research";
  return "Source-specific evidence or operator review";
}

function sourceProofState(status: unknown): string {
  if (status === "blocked") return "blocked";
  if (status === "needs_review") return "evidence_required";
  if (status === "partial") return "facts_returned_review_required";
  return "not_checked";
}

function sourceRunProofLedger(sourceSummaries: Array<Record<string, unknown>>): Record<string, unknown> {
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
      legalTemplateAutofillAllowed: false,
    };
  });
  const blockedCount = sources.filter((item) => item.proofState === "blocked").length;
  const evidenceRequiredCount = sources.filter((item) => item.proofState === "evidence_required").length;
  return {
    completionStandard: "proof_or_explicit_blocker",
    allRequiredSourcesAccountedFor: discoverySourceLabels.every((item) => sources.some((source) => source.source === item.source)),
    readyForOperatorReview: blockedCount === 0 && evidenceRequiredCount === 0,
    readyForDiscoveryCompletion: false,
    legalTemplateAutofillAllowed: false,
    blockedCount,
    evidenceRequiredCount,
    factsReturnedCount: sources.filter((item) => item.factCount > 0).length,
    sources,
  };
}

async function externalSourceRunResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const seed = sourceRunSeedFromBody(body, seedFromUrl(url, env));
  const pipeline = await runDryPipeline(seed, { env: env as Record<string, string | undefined> });
  const sourceFacts = pipeline.facts.filter((factItem) => discoverySourceLabels.some((source) => source.source === factItem.source));
  const sourceSummaries = summarizeSourceRunFacts(sourceFacts);
  const sourceRunProof = sourceRunProofLedger(sourceSummaries);
  const blockers = Array.from(new Set([
    ...sourceSummaries
      .filter((summary) => summary.status === "blocked" || summary.status === "needs_review")
      .map((summary) => String(summary.nextAction)),
    ...(pipeline.dossier.audit.reviewFlags.includes("SOURCE_BLOCKED")
      ? ["One or more Discovery sources are blocked; keep the packet in review."]
      : []),
  ]));
  return json({
    ok: blockers.length === 0,
    mode: "external_source_run",
    runId: pipeline.runId,
    estateId: stringValue(body.assetKey) || seedIdentity(seed),
    generatedAt: nowIso(),
    seed,
    sourceSummaries,
    sourceRunProof,
    sourceFacts,
    dossier: pipeline.dossier,
    blockers,
    message: blockers.length
      ? "Discovery source checks ran and returned review blockers. The app did not assume missing public or paid-source facts."
      : "Discovery source checks returned structured source facts for review.",
  }, { headers: { "cache-control": "no-store" } });
}

async function contactCandidateReviewResponse(request: Request, candidateId: string): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const status = ["accepted", "rejected", "promoted", "alternative"].includes(stringValue(body.status || body.decision))
    ? stringValue(body.status || body.decision)
    : "accepted";
  return json({
    ok: true,
    candidateId,
    status,
    reviewedAt: nowIso(),
    reviewedBy: body.reviewedBy || body.actor || "office user",
    contact: body.contact || null,
    message: status === "accepted" || status === "promoted"
      ? "Contact candidate saved for the Discovery contact matrix."
      : "Contact candidate review saved.",
  }, { headers: { "cache-control": "no-store" } });
}

function closingOverrideValue(values: Record<string, unknown>, key: string): string {
  const raw = values[key];
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return stringValue((raw as Record<string, unknown>).value);
  return "";
}

function closingDocValue(dossier: RawDossier, key: string, closingFieldValues: Record<string, unknown> = {}): string {
  const override = closingOverrideValue(closingFieldValues, key);
  if (override) return override;
  const values: Record<string, unknown> = {
    estate_name: dossier.summary.estateName || dossier.summary.displayName,
    property_address: dossier.property.address.value,
    county: dossier.property.county.value,
    folio: dossier.property.parcelId.value,
    case_number: dossier.summary.caseNumber || dossier.property.caseNumber.value,
    owner_name: dossier.property.ownerName.value || dossier.summary.displayName,
    offer_status: dossier.completedLeadReport?.reviewGate.reportStatus,
    lead_bucket: dossier.completedLeadReport?.leadQualityProfile.leadBucket,
    next_action: dossier.summary.nextBestAction,
    tax_status: dossier.taxHistory.sourceStatus.value || dossier.taxHistory.receiptStatus.value,
    probate_status: dossier.probateDocket.caseStatus.value || dossier.probateDocket.sourceStatus.value,
    title_status: dossier.deedHistory.sourceStatus.value || dossier.deedHistory.ownershipActivity.value,
  };
  const value = values[key];
  return value === undefined || value === null ? "" : String(value);
}

function buildClosingDocsPacket(dossier: RawDossier, notes = "", closingFieldValues: Record<string, unknown> = {}): { title: string; markdown: string; blockers: string[] } {
  const templates = [
    "Fund Transfer / Bank Account Transfer",
    "Contract for Deed",
    "Quit Claim Deed",
    "Limited Power of Attorney",
    "Assignment of Surplus Rights Purchase Agreement",
    "Same Name Affidavit",
    "Joinder, Waiver and Consent",
    "Affidavit of Heirs",
    "Valuable Consideration Disbursement",
    "Assignment and Disclaimer of Interest",
    "Land Trust Agreement",
    "Tax Reimbursement Credit",
    "Buyer Purchase Agreement",
    "Unclaimed Funds Instructions",
  ];
  const required = ["estate_name", "property_address", "county", "folio", "owner_name", "tax_status", "title_status", "probate_status", "buyer_entity", "seller_heirs", "offer_amount"];
  const blockers = required
    .filter((key) => !closingDocValue(dossier, key, closingFieldValues))
    .map((key) => `Missing closing-doc field: ${key.replace(/_/g, " ")}.`);
  const title = `Closing Prep Packet - ${dossier.summary.displayName}`;
  const facts = required.map((key) => `- ${key.replace(/_/g, " ")}: ${closingDocValue(dossier, key, closingFieldValues) || "[NEEDS REVIEW]"}`).join("\n");
  const templateList = templates.map((template) => `- ${template}: Draft - Review Required`).join("\n");
  const markdown = [
    `# ${title}`,
    "",
    "Internal draft - review required before external use.",
    "",
    "## Estate Fields",
    facts,
    "",
    "## Closing Templates",
    templateList,
    "",
    "## Blockers",
    blockers.length ? blockers.map((blocker) => `- ${blocker}`).join("\n") : "- No required closing fields are missing from this draft packet.",
    "",
    "## Operator Notes",
    notes || "No operator notes were provided.",
  ].join("\n");
  return { title, markdown, blockers };
}

async function closingDocsGoogleExportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as {
      seed?: IntakeSeed;
      dossier?: RawDossier;
      dryRun?: boolean;
      notes?: string;
      workspaceDestination?: string;
      workspaceDestinationEmail?: string;
      shareWithEmails?: string[];
      requestedByEmail?: string;
      closingFieldValues?: Record<string, unknown>;
    }
    : {};
  const pipeline = body.dossier
    ? null
    : await runDryPipeline(body.seed ?? seedFromUrl(url, env), { env: env as Record<string, string | undefined> });
  const dossier = body.dossier ?? pipeline?.dossier;
  if (!dossier) {
    return json({ ok: false, error: "missing_dossier", message: "Closing Docs export needs a dossier or estate seed." }, { status: 400 });
  }
  const packet = buildClosingDocsPacket(dossier, body.notes, body.closingFieldValues || {});
  const exportResult = await exportCompletedReport({
    routes: ["google"],
    dossier,
    dryRun: body.dryRun ?? url.searchParams.get("dry-run") !== "false",
    documentTitle: packet.title,
    documentBody: packet.markdown,
    workspaceDestination: body.workspaceDestination,
    workspaceDestinationEmail: body.workspaceDestinationEmail,
    shareWithEmails: Array.isArray(body.shareWithEmails) ? body.shareWithEmails : [],
    requestedByEmail: body.requestedByEmail,
  }, env as Record<string, string | undefined>);
  return json({
    ok: exportResult.ok && packet.blockers.length === 0,
    status: packet.blockers.length ? "draft_review_required" : exportResult.ok ? "google_exported" : "blocked",
    packet,
    export: exportResult,
    blockers: [...packet.blockers, ...exportResult.blockers],
  }, { headers: { "cache-control": "no-store" } });
}

async function linearSupportIssue(env: CloudflareEnv, title: string, description: string): Promise<Record<string, unknown> | null> {
  const apiKey = env.HEIRRIGHT_LINEAR_API_KEY || env.LINEAR_API_KEY;
  const teamId = env.HEIRRIGHT_LINEAR_TEAM_ID || env.LINEAR_TEAM_ID;
  if (!apiKey || !teamId) return null;
  const input: Record<string, unknown> = { teamId, title, description, priority: 3 };
  if (env.HEIRRIGHT_LINEAR_PROJECT_ID || env.LINEAR_PROJECT_ID) input.projectId = env.HEIRRIGHT_LINEAR_PROJECT_ID || env.LINEAR_PROJECT_ID;
  if (env.HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID || env.LINEAR_DEFAULT_ASSIGNEE_ID) input.assigneeId = env.HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID || env.LINEAR_DEFAULT_ASSIGNEE_ID;
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      query: "mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }",
      variables: { input },
    }),
  });
  const data = await response.json().catch(() => ({})) as { data?: { issueCreate?: { success?: boolean; issue?: Record<string, unknown> } } };
  return data.data?.issueCreate?.issue ?? null;
}

function outreachSeed(body: Record<string, unknown>): IntakeSeed {
  const explicitSeed = (body.seed && typeof body.seed === "object") ? body.seed as IntakeSeed : null;
  if (explicitSeed) return explicitSeed;
  const lead = (body.lead && typeof body.lead === "object") ? body.lead as Record<string, unknown> : {};
  return {
    estateName: stringValue(lead.estateName) || stringValue(lead.displayName) || undefined,
    propertyAddress: stringValue(lead.propertyAddress) || stringValue(lead.address) || DEFAULT_ADDRESS,
    ownerName: stringValue(lead.ownerName) || stringValue(lead.displayName) || DEFAULT_OWNER,
    caseNumber: stringValue(lead.caseNumber) || undefined,
    county: stringValue(lead.county) || "miami-dade",
    parcelId: stringValue(lead.parcelId) || stringValue(lead.folio) || undefined,
    source: "operator_cli",
  };
}

async function outreachDossier(body: Record<string, unknown>, env: CloudflareEnv): Promise<RawDossier> {
  const dossier = body.dossier && typeof body.dossier === "object" ? body.dossier as RawDossier : null;
  if (dossier?.id && dossier.summary && dossier.property) return dossier;
  const pipeline = await runDryPipeline(outreachSeed(body), {
    env: env as Record<string, string | undefined>,
  });
  return pipeline.dossier;
}

function renderOutreachPackageMarkdown(payload: Record<string, unknown>): string {
  const template = (payload.template && typeof payload.template === "object") ? payload.template as Record<string, unknown> : {};
  const lead = (payload.lead && typeof payload.lead === "object") ? payload.lead as Record<string, unknown> : {};
  const campaign = (payload.campaign && typeof payload.campaign === "object") ? payload.campaign as Record<string, unknown> : {};
  return [
    "# HeirRight Outreach Review Package",
    "",
    `Package: ${String(payload.packageId || "outreach-package")}`,
    `Requested: ${String(payload.requestedAt || nowIso())}`,
    `Actor: ${String(payload.actor || "office user")}`,
    "",
    "## Lead",
    "",
    `Name: ${String(lead.displayName || lead.estateName || "Selected lead")}`,
    `Property: ${String(lead.propertyAddress || lead.address || DEFAULT_ADDRESS)}`,
    "",
    "## Campaign",
    "",
    `Name: ${String(campaign.name || "Outreach campaign")}`,
    `Channel: ${String(template.channel || "review")}`,
    "",
    "## Approved Template",
    "",
    String(template.body || ""),
    "",
    "## Guardrails",
    "",
    "- HeirRight Leads did not send SMS or email.",
    "- Podio sync creates a review package, source note, and operator task only.",
    "- External outreach remains blocked until an operator approves the Podio readback.",
  ].join("\n");
}

async function outreachSyncResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const template = (body.template && typeof body.template === "object") ? body.template as Record<string, unknown> : {};
  const status = stringValue(template.status);
  const unresolvedVariables = Array.isArray(body.unresolvedVariables) ? body.unresolvedVariables : [];
  if (!stringValue(template.id) || !stringValue(template.body)) {
    return json({ ok: false, status: "blocked", error: "template_required", message: "Approved outreach template body is required." }, { status: 400 });
  }
  if (status && status !== "Approved" && status !== "Sync to Podio") {
    return json({
      ok: false,
      status: "approval_required",
      message: "Approve this outreach template before Podio sync.",
      blockers: ["Template is not approved."],
    }, { headers: { "cache-control": "no-store" } });
  }
  if (unresolvedVariables.length) {
    return json({
      ok: false,
      status: "variables_required",
      message: "Resolve outreach variables before Podio sync.",
      blockers: unresolvedVariables.map((item) => `Unresolved variable: ${String(item)}`),
    }, { headers: { "cache-control": "no-store" } });
  }
  const podioStatuses = await connectionStatuses(env as Record<string, string | undefined>);
  const podioStatus = podioStatuses.find((item) => item.name === "Podio");
  const podioReady = podioStatus?.ok === true;
  const packageId = receiptId("outreach");
  const payload = {
    packageId,
    source: "HeirRight Leads",
    actor: body.actor || "office user",
    requestedAt: body.requestedAt || nowIso(),
    campaign: body.campaign || null,
    template,
    lead: body.lead || null,
    guardrails: {
      noDirectSend: true,
      requiresReadbackProof: true,
      podioReady,
    },
  };
  const webhookUrl = env.ACTIVEPIECES_WEBHOOK_URL || env.HEIRRIGHT_ACTIVEPIECES_WEBHOOK_URL || "";
  if (webhookUrl && podioReady) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.ACTIVEPIECES_API_KEY) headers.authorization = `Bearer ${env.ACTIVEPIECES_API_KEY}`;
    const upstream = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    if (upstream.ok) {
      return json({
        ok: true,
        status: "activepieces_queued",
        runId: packageId,
        upstreamStatus: upstream.status,
        message: "Activepieces accepted the Podio outreach workflow request. No direct SMS or email was sent by HeirRight Leads.",
      }, { headers: { "cache-control": "no-store" } });
    }
  }
  if (podioReady) {
    const dossier = await outreachDossier(body, env);
    const podioExport = await exportCompletedReport({
      routes: ["podio"],
      dossier,
      dryRun: body.dryRun === true,
      documentTitle: `Outreach review package - ${dossier.summary.displayName}`,
      documentBody: renderOutreachPackageMarkdown(payload),
    }, env as Record<string, string | undefined>);
    const podioRoute = podioExport.routes.find((route) => route.route === "podio") || podioExport.routes[0];
    if (podioExport.ok) {
      return json({
        ok: true,
        status: podioRoute?.mode === "dry_run" ? "podio_ready_dry_run" : "podio_exported_for_review",
        runId: packageId,
        package: payload,
        podio: podioRoute,
        blockers: podioExport.blockers,
        message: "Outreach was exported to Podio as a review package. No outbound SMS or email was sent by HeirRight Leads.",
      }, { headers: { "cache-control": "no-store" } });
    }
    const linearIssue = await linearSupportIssue(
      env,
      "[HeirRight outreach] Podio export/readback failed",
      [
        "HeirRight outreach sync attempted the first-party Podio export fallback.",
        "",
        `Package: ${packageId}`,
        `Export blockers: ${podioExport.blockers.join("; ") || "Unknown Podio export failure"}`,
        "",
        "No SMS, email, or live outreach send was attempted.",
      ].join("\n"),
    ).catch(() => null);
    return json({
      ok: true,
      status: "ready_for_podio_review",
      fallback: "First-party Outreach package",
      package: payload,
      podio: podioRoute,
      blockers: podioExport.blockers.length ? podioExport.blockers : ["Podio export/readback failed."],
      linearIssue,
      message: "Outreach stayed staged because the Podio export/readback fallback did not complete.",
    }, { headers: { "cache-control": "no-store" } });
  }
  const blockers = [
    ...(podioReady ? [] : [podioStatus?.message || "Podio controlled write/readback is not ready yet."]),
    ...(webhookUrl ? [] : ["Activepieces webhook is not configured."]),
  ];
  const linearIssue = await linearSupportIssue(
    env,
    "[HeirRight outreach] Automation setup/readback needed",
    [
      "HeirRight outreach sync fell back to the first-party package.",
      "",
      `Package: ${packageId}`,
      `Blockers: ${blockers.join("; ") || "None"}`,
      "",
      "No SMS, email, or live Podio outreach send was attempted.",
    ].join("\n"),
  ).catch(() => null);
  return json({
    ok: true,
    status: "ready_for_podio_review",
    fallback: "First-party Outreach package",
    package: payload,
    blockers,
    linearIssue,
    message: "Outreach was staged as a Podio-compatible review package. No outbound SMS or email was sent.",
  }, { headers: { "cache-control": "no-store" } });
}

async function deepHealthResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const runtimeEnv = await podioRuntimeEnv(request, env);
  const statuses = await connectionStatuses(runtimeEnv as Record<string, string | undefined>);
  return json({
    ok: true,
    backendTarget: "cloudflare-worker",
    service: "heirright-probate-lead-engine",
    deploymentKey: env.DEPLOYMENT_KEY || "heirright",
    routes: Object.fromEntries(routeList().map((route) => [route, "available"])),
    connections: statuses,
    podioBrowserBackedRefresh: Boolean(runtimeEnv.PODIO_REFRESH_TOKEN && !env.PODIO_REFRESH_TOKEN),
  }, { headers: { "cache-control": "no-store" } });
}

function podioProfileCandidate(value: Record<string, unknown>, source: string): Record<string, unknown> | null {
  const profile = (value.profile && typeof value.profile === "object") ? value.profile as Record<string, unknown> : {};
  const user = (value.user && typeof value.user === "object") ? value.user as Record<string, unknown> : {};
  const userProfile = (user.profile && typeof user.profile === "object") ? user.profile as Record<string, unknown> : {};
  const profileId = value.profile_id ?? profile.profile_id ?? user.profile_id ?? userProfile.profile_id;
  if (!profileId) return null;
  return {
    source,
    profileId: String(profileId),
    name: value.name ?? profile.name ?? user.name ?? userProfile.name ?? null,
    email: value.email ?? profile.email ?? user.email ?? userProfile.email ?? null,
  };
}

async function podioJson(path: string, env: CloudflareEnv): Promise<{ ok: boolean; status: number; data: unknown }> {
  const auth = await resolvePodioAccessToken(env as Record<string, string | undefined>);
  if (!auth.token) {
    return { ok: false, status: 0, data: { error: auth.blocker || "missing_podio_access_token" } };
  }
  const response = await fetch(`https://api.podio.com${path}`, {
    headers: { authorization: `Bearer ${auth.token}` },
  });
  return {
    ok: response.ok,
    status: response.status,
    data: await response.json().catch(() => null),
  };
}

async function podioDiagnosticsResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const runtimeEnv = await podioRuntimeEnv(request, env);
  const appId = runtimeEnv.PODIO_APP_ID || TEXAS_EQUITY_PROS_LEADS_APP_ID;
  const spaceId = runtimeEnv.PODIO_SPACE_ID || TEXAS_EQUITY_PROS_LEADS_SPACE_ID;
  const auth = await resolvePodioAccessToken(runtimeEnv as Record<string, string | undefined>);
  const [userStatus, app, members] = await Promise.all([
    podioJson("/user/status", runtimeEnv),
    podioJson(`/app/${appId}`, runtimeEnv),
    podioJson(`/space/${spaceId}/member/`, runtimeEnv),
  ]);
  const memberRows = Array.isArray(members.data) ? members.data as Array<Record<string, unknown>> : [];
  const appObject = app.data && typeof app.data === "object" ? app.data as Record<string, unknown> : {};
  const appConfig = appObject.config && typeof appObject.config === "object" ? appObject.config as Record<string, unknown> : {};
  const candidates = [
    userStatus.data && typeof userStatus.data === "object" ? podioProfileCandidate(userStatus.data as Record<string, unknown>, "user_status") : null,
    ...memberRows.map((item) => podioProfileCandidate(item, "space_member")),
  ].filter((item): item is Record<string, unknown> => Boolean(item));
  const podioAuthOk = Boolean(auth.token && userStatus.ok && app.ok && members.ok);
  const authBlocker = auth.blocker || podioReadbackBlockerMessage(
    app.status || userStatus.status || members.status,
    app.data || userStatus.data || members.data,
  );
  return json({
    ok: true,
    appId,
    spaceId,
    authMode: auth.mode,
    browserBackedRefresh: Boolean(runtimeEnv.PODIO_REFRESH_TOKEN && !env.PODIO_REFRESH_TOKEN),
    authOk: podioAuthOk,
    authBlocker: podioAuthOk ? null : authBlocker,
    setupOptions: podioAuthOk ? [] : [
      "Reconnect Podio once with the approved HeirRight account so the Worker can use refresh-token auth.",
      "Fallback: add the Podio Leads app token so the Worker can request fresh app-scoped access without relying on a stale bearer token.",
    ],
    userStatus: { ok: userStatus.ok, status: userStatus.status },
    app: {
      ok: app.ok,
      status: app.status,
      name: appConfig.name ?? appObject.name ?? null,
    },
    members: {
      ok: members.ok,
      status: members.status,
      count: memberRows.length,
    },
    profileCandidates: candidates,
    configuredLeadPointProfileId: runtimeEnv.PODIO_LEAD_POINT_PROFILE_ID || null,
  }, { headers: { "cache-control": "no-store" } });
}

function podioSetupHtml(title: string, copy: string, status: "ok" | "blocked" = "ok"): string {
  const color = status === "ok" ? "#36d278" : "#f4c542";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; --page:#111214; --panel:#1b1d21; --line:#32353c; --text:#f4f6fb; --muted:#b8beca; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--page); color:var(--text); font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif; }
    main { width:min(520px, calc(100vw - 32px)); border:1px solid var(--line); border-radius:24px; padding:24px; background:rgba(27,29,33,.86); box-shadow:0 24px 80px rgba(0,0,0,.34); }
    .dot { width:14px; height:14px; border-radius:999px; background:${color}; box-shadow:0 0 24px ${color}; }
    h1 { margin:16px 0 10px; font-size:28px; letter-spacing:0; }
    p { margin:0 0 18px; color:var(--muted); line-height:1.5; }
    a { color:var(--text); text-decoration:none; display:inline-flex; min-height:42px; align-items:center; justify-content:center; border-radius:999px; padding:0 16px; background:rgba(72,145,255,.72); border:1px solid rgba(255,255,255,.22); backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px); }
  </style>
</head>
<body>
  <main>
    <div class="dot" aria-hidden="true"></div>
    <h1>${title}</h1>
    <p>${copy}</p>
    <a href="/">Back to HeirRight Leads</a>
  </main>
</body>
</html>`;
}

async function podioOAuthStartResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  if (!env.PODIO_CLIENT_ID) {
    return html(podioSetupHtml(
      "Podio Connect Is Missing API Details",
      "Add the Podio API client to the Worker before reconnecting Podio.",
      "blocked",
    ), { status: 503 });
  }
  if (!podioCookieSecret(env)) {
    return html(podioSetupHtml(
      "Podio Connect Needs A Cookie Secret",
      "Add the HeirRight session secret or Podio OAuth cookie secret before reconnecting Podio.",
      "blocked",
    ), { status: 503 });
  }
  const state = crypto.randomUUID();
  const signedState = `${state}.${await hmacBase64Url(state, podioCookieSecret(env))}`;
  const params = new URLSearchParams({
    client_id: env.PODIO_CLIENT_ID,
    redirect_uri: podioRedirectUri(request, env),
    response_type: "code",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      "set-cookie": responseCookie(request, podioStateCookieName(env), signedState, PODIO_OAUTH_STATE_TTL_SECONDS),
      location: `https://podio.com/oauth/authorize?${params.toString()}`,
      "cache-control": "no-store",
    },
  });
}

async function podioOAuthCallbackResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = parseCookie(request.headers.get("cookie"))[podioStateCookieName(env)];
  const [cookieState, cookieSignature] = String(stateCookie || "").split(".");
  const expectedSignature = cookieState ? await hmacBase64Url(cookieState, podioCookieSecret(env)) : "";
  if (!code || !state || !cookieState || state !== cookieState || cookieSignature !== expectedSignature) {
    return html(podioSetupHtml(
      "Podio Connect Expired",
      "Start the Podio connection again from Settings so HeirRight can verify the approved CRM account.",
      "blocked",
    ), {
      status: 400,
      headers: { "set-cookie": clearResponseCookie(request, podioStateCookieName(env)) },
    });
  }
  if (!env.PODIO_CLIENT_ID || !env.PODIO_CLIENT_SECRET) {
    return html(podioSetupHtml(
      "Podio API Details Are Incomplete",
      "Add the Podio API client secret to the Worker before reconnecting Podio.",
      "blocked",
    ), { status: 503 });
  }
  const tokenResponse = await fetch("https://api.podio.com/oauth/token/v2", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: new URLSearchParams({
      code,
      client_id: env.PODIO_CLIENT_ID,
      client_secret: env.PODIO_CLIENT_SECRET,
      redirect_uri: podioRedirectUri(request, env),
      grant_type: "authorization_code",
    }),
  });
  const token = await tokenResponse.json().catch(() => ({})) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenResponse.ok || !token.refresh_token) {
    return html(podioSetupHtml(
      "Podio Did Not Finish Connecting",
      "Podio did not return refresh access for this approved account. Try reconnecting, or use the Leads app token fallback.",
      "blocked",
    ), {
      status: 502,
      headers: { "set-cookie": clearResponseCookie(request, podioStateCookieName(env)) },
    });
  }
  const refreshCookie = await encryptCookieValue(token.refresh_token, env);
  if (!refreshCookie) {
    return html(podioSetupHtml(
      "Podio Refresh Could Not Be Saved",
      "HeirRight could not protect the Podio refresh access in the browser session. Add the Podio app token fallback before exporting.",
      "blocked",
    ), { status: 503 });
  }
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearResponseCookie(request, podioStateCookieName(env)));
  headers.append("set-cookie", responseCookie(request, podioRefreshCookieName(env), refreshCookie, PODIO_OAUTH_REFRESH_TTL_SECONDS));
  return html(podioSetupHtml(
    "Podio Connected",
    "HeirRight can now refresh Podio access from this approved browser session. Settings will show Podio live after the Leads app readback succeeds.",
  ), {
    headers,
  });
}

async function readbackEvidenceResponse(url: URL, env: CloudflareEnv, markdown: boolean): Promise<Response> {
  const dryRun = url.searchParams.get("dry-run") !== "false";
  const pipeline = await runDryPipeline(seedFromUrl(url, env), {
    env: env as Record<string, string | undefined>,
  });
  const exportResult = await exportCompletedReport({
    routes: ["google", "podio"],
    dossier: pipeline.dossier,
    dryRun,
  }, env as Record<string, string | undefined>);
  const packet = buildReadbackEvidencePacket(exportResult, await connectionStatuses(env as Record<string, string | undefined>));
  if (markdown) {
    return new Response(renderReadbackEvidenceMarkdown(packet), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return json(packet, { headers: { "cache-control": "no-store" } });
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD") {
      return json({ ok: false, error: "Method not allowed." }, { status: 405 });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "heirright-probate-lead-engine",
        deploymentKey: env.DEPLOYMENT_KEY || "heirright",
        endpoints: routeList(),
      });
    }

    if (url.pathname === "/api/health/deep") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return deepHealthResponse(request, env);
    }

    if ([
      "/dry-run",
      "/latest-run.json",
      "/latest-dossier.json",
      "/podio-dry-run.json",
      "/internal-summary.md",
      "/internal-summary.html",
    ].includes(url.pathname)) {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return dryRunResponse(url, env);
    }

    if (url.pathname === "/daily-run.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return dailyRunResponse(env);
    }

    if (url.pathname === "/qualification-review.json" || url.pathname === "/qualification-review.md") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return qualificationReviewResponse(env, url.pathname.endsWith(".md"));
    }

    if (url.pathname === "/api/leads/fresh-batch" || url.pathname === "/api/leads/public-source-pull" || url.pathname === "/fresh-lead-batch.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return freshLeadBatchResponse(request, url, env);
    }

    if (url.pathname === "/api/discovery/idi-core/status") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      const runtimeEnv = await podioRuntimeEnv(request, env);
      const statuses = await connectionStatuses(runtimeEnv as Record<string, string | undefined>);
      return json(statuses.find((status) => status.name === "IDI Core") ?? { ok: false, error: "idi_core_status_unavailable" }, { headers: { "cache-control": "no-store" } });
    }

    if (url.pathname === "/api/discovery/idi-asset-search/import") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return idiAssetImportResponse(request, env);
    }

    if (url.pathname === "/api/discovery/source-capture") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return sourceCaptureResponse(request, env);
    }

    if (url.pathname === "/api/discovery/external-source-run") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return externalSourceRunResponse(request, url, env);
    }

    const contactReviewMatch = url.pathname.match(/^\/api\/discovery\/contact-candidates\/([^/]+)\/review$/);
    if (contactReviewMatch) {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return contactCandidateReviewResponse(request, decodeURIComponent(contactReviewMatch[1] || ""));
    }

    if (url.pathname === "/api/closing-docs/export-google") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return closingDocsGoogleExportResponse(request, url, env);
    }

    if (url.pathname === "/api/outreach/sync") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return outreachSyncResponse(request, await podioRuntimeEnv(request, env));
    }

    if (url.pathname === "/api/exports" || url.pathname === "/export-result.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return exportResponse(request, url, await podioRuntimeEnv(request, env));
    }

    if (url.pathname === "/api/podio/diagnostics") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return podioDiagnosticsResponse(request, env);
    }

    if (url.pathname === "/api/podio/oauth/start") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return podioOAuthStartResponse(request, env);
    }

    if (url.pathname === "/api/podio/oauth/callback") {
      return podioOAuthCallbackResponse(request, url, env);
    }

    if (url.pathname === "/readback-evidence.json" || url.pathname === "/readback-evidence.md") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return readbackEvidenceResponse(url, await podioRuntimeEnv(request, env), url.pathname.endsWith(".md"));
    }

    if (url.pathname === "/api/connections/status" || url.pathname === "/connection-status.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      const runtimeEnv = await podioRuntimeEnv(request, env);
      return json(await connectionStatuses(runtimeEnv as Record<string, string | undefined>), { headers: { "cache-control": "no-store" } });
    }

    return json({ ok: false, error: "Not found." }, { status: 404 });
  },
};
