import type { FactType, FreshLeadBatchRequest, FreshLeadSearchMode, IntakeSeed, RawDossier, ReviewFlag, SourceAttachmentRef, SourceFact } from "@ple/types";
import { createHash, timingSafeEqual } from "node:crypto";
import { acquireTaxCollectorReceipt, discoverTaxCollectorReceipt, extractTaxCollectorDetails } from "./adapters/tax-collector-receipt";
import { runDailyProduction } from "./daily/run-daily";
import { buildControlledPodioTestSeed } from "./export/controlled-test-lead";
import { connectionStatuses, exportCompletedReport, podioReadbackBlockerMessage, resolvePodioAccessToken } from "./export/export-package";
import { TEXAS_EQUITY_PROS_LEADS_APP_ID, TEXAS_EQUITY_PROS_LEADS_SPACE_ID } from "./export/podio-config";
import { buildIdiAssetSearchFacts } from "./enrichment/idi-asset-search";
import { buildIdiUploadCandidates, matchIdiReportSubject, safeIdiExtractionMetadata, type IdiUploadExtraction } from "./enrichment/idi-upload";
import { buildClosingPacketModel, type ClosingFieldInput, type ClosingPacketOptions } from "./documents/closing-packet-model";
import {
  buildDiscoveryDocumentModels,
  buildDiscoveryPacketModel,
  validatePacketModel,
  type DiscoveryDocumentId,
  type PacketModel,
} from "./documents/packet-model";
import { renderPacketPdf } from "./documents/packet-pdf";
import { runDryPipeline } from "./index";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "./lib";
import { runFreshLeadBatch } from "./live/source-batch";
import { renderQualificationReviewMarkdown } from "./qualification/qualification-review";
import { buildReadbackEvidencePacket, renderReadbackEvidenceMarkdown } from "./readback/readback-evidence";
import { isEntityOwnerName, isTrustOrEstateOwnerName } from "./workflow/entity-owner";
import { buildRawDossier } from "./dossier/build-raw-dossier";
import { generateCompletedLeadReport } from "./documents/completed-lead-report";
import { buildOutreachWorkflow } from "./outreach/build-outreach-workflow";
import { buildQualificationDecision } from "./qualification/qualification-review";

interface CloudflareEnv {
  DEPLOYMENT_KEY?: string;
  COUNTY_LIST?: string;
  PODIO_ACCESS_TOKEN?: string;
  PODIO_REFRESH_TOKEN?: string;
  PODIO_DURABLE_REFRESH_TOKEN?: string;
  PODIO_TEAM_REFRESH_TOKEN?: string;
  PODIO_BROWSER_REFRESH_TOKEN?: string;
  PODIO_RESOLVED_ACCESS_TOKEN?: string;
  PODIO_RESOLVED_AUTH_MODE?: string;
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
  PODIO_OAUTH_REFRESH_KV_KEY?: string;
  PODIO_PER_USER_AUTH_REQUIRED?: string;
  PODIO_USER_SCOPED_REFRESH?: string;
  PODIO_TOKEN_STORE?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
    delete(key: string): Promise<void>;
  };
  PACKET_ARTIFACTS?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string, options?: { expirationTtl?: number; metadata?: unknown }): Promise<void>;
    delete(key: string): Promise<void>;
    list?(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<{
      keys: Array<{ name: string }>;
      list_complete: boolean;
      cursor?: string;
    }>;
  };
  WORKSPACE_STATE?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
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
  GOOGLE_OAUTH_CLIENT_ID?: string;
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
  IDI_CORE_API_URL?: string;
  IDI_CORE_API_TOKEN?: string;
  HEIRRIGHT_IDI_CORE_API_TOKEN?: string;
  IDI_CORE_API_KEY?: string;
  IDI_CORE_LIVE_RUN_APPROVED?: string;
  IDI_CORE_LOGIN_URL?: string;
  IDI_CORE_PORTAL_URL?: string;
  IDI_CORE_SEARCH_URL?: string;
  IDI_CORE_ACCOUNT_ID?: string;
  IDI_CORE_ACCOUNT_COMPANY?: string;
  IDI_CORE_OPERATOR_EMAIL?: string;
  HEIRRIGHT_DOCUMENT_TTL_SECONDS?: string;
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
  BROWSERBASE_API_KEY?: string;
  BROWSERBASE_PROJECT_ID?: string;
  BROWSERBASE_API_BASE?: string;
  BROWSERBASE_PROXY_ENABLED?: string;
  BROWSERBASE_BATCH_APPROVAL_REQUIRED?: string;
  BROWSERBASE_BATCH_RUN_APPROVED?: string;
  BROWSERBASE_BATCH_MAX_SESSIONS?: string;
  BROWSERBASE_BATCH_CONCURRENCY?: string;
  TAX_COLLECTOR_LISTING_URL?: string;
  TAX_COLLECTOR_LISTING_URL_TEMPLATE?: string;
  TAX_COLLECTOR_ALLOWED_ORIGINS?: string;
  TAX_COLLECTOR_FETCH_TIMEOUT_MS?: string;
  TAX_COLLECTOR_FETCH_MAX_BYTES?: string;
  TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED?: string;
  TAX_COLLECTOR_SEARCH_URL?: string;
  TAX_COLLECTOR_BROWSER_WORKFLOW_URL?: string;
  TAX_COLLECTOR_BROWSER_WORKFLOW_TOKEN?: string;
  TAX_COLLECTOR_BROWSER_WORKFLOW_ENABLED?: string;
  TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID?: string;
  BROWSERBASE_TAX_COLLECTOR_FUNCTION_ID?: string;
  TAX_COLLECTOR_BROWSERBASE_PROXY_ENABLED?: string;
  OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID?: string;
  VITAL_OBITUARY_BROWSERBASE_FUNCTION_ID?: string;
  MARRIAGE_DEATH_BROWSERBASE_FUNCTION_ID?: string;
  BROWSERBASE_VITAL_OBITUARY_FUNCTION_ID?: string;
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

function methodNotAllowed(allow = "POST"): Response {
  return json({ ok: false, error: "method_not_allowed" }, {
    status: 405,
    headers: { allow },
  });
}

function externalSourceRunApproved(body: Record<string, unknown>): boolean {
  return body.operatorIntent === "run_external_source_search"
    || body.operatorAction === "run_external_source_search"
    || body.sourceRunApproval === "approved_external_source_search";
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
    "/api/discovery/idi-asset-search/ocr",
    "/api/discovery/source-capture",
    "/api/discovery/external-source-run",
    "/api/discovery/tax-collector/receipt-run",
    "/api/discovery/contact-candidates/:id/review",
    "/api/closing-docs/export-google",
    "/api/google-workspace/connection",
    "/api/google-workspace/destinations",
    "/api/doc-prep/packet-approval",
    "/api/google-workspace/export",
    "/api/outreach/sync",
    "/api/exports",
    "/api/reports/pdf",
    "/api/documents/attachments",
    "/api/workspace/state",
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

function timingSafeStringEqual(actual: string, expected: string): boolean {
  const actualValue = String(actual || "");
  const expectedValue = String(expected || "");
  const actualDigest = createHash("sha256").update(actualValue).digest();
  const expectedDigest = createHash("sha256").update(expectedValue).digest();
  const matches = timingSafeEqual(actualDigest, expectedDigest);
  return Boolean(actualValue && expectedValue && matches);
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

async function podioRefreshKvKey(env: CloudflareEnv, userEmail: string): Promise<string> {
  const prefix = env.PODIO_OAUTH_REFRESH_KV_KEY || "heirright:podio:user-refresh";
  return `${prefix}:${await sha256Hex(userEmail.toLowerCase())}`;
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
  const userEmail = await signedSessionEmail(request, env);
  const perUserRequired = env.PODIO_PER_USER_AUTH_REQUIRED === "true";
  const refreshCookie = parseCookie(request.headers.get("cookie"))[podioRefreshCookieName(env)];
  const browserRefreshPayload = await decryptCookieValue(refreshCookie, env);
  let browserRefresh: { email?: string; refreshToken?: string } = {};
  try {
    browserRefresh = browserRefreshPayload ? JSON.parse(browserRefreshPayload) as { email?: string; refreshToken?: string } : {};
  } catch {
    browserRefresh = {};
  }
  const browserRefreshToken = userEmail && browserRefresh.email === userEmail ? browserRefresh.refreshToken || null : null;
  const storedRefreshToken = userEmail ? await podioStoredRefreshToken(env, userEmail) : null;
  const baseEnv = perUserRequired ? {
    ...env,
    PODIO_ACCESS_TOKEN: undefined,
    PODIO_REFRESH_TOKEN: undefined,
    PODIO_DURABLE_REFRESH_TOKEN: undefined,
    PODIO_TEAM_REFRESH_TOKEN: undefined,
    PODIO_APP_TOKEN: undefined,
  } : env;
  const tokenEnv = storedRefreshToken
    ? { ...baseEnv, PODIO_DURABLE_REFRESH_TOKEN: storedRefreshToken, PODIO_USER_SCOPED_REFRESH: "true" }
    : browserRefreshToken
      ? { ...baseEnv, PODIO_BROWSER_REFRESH_TOKEN: browserRefreshToken, PODIO_USER_SCOPED_REFRESH: "true" }
      : baseEnv;
  const auth = await resolvePodioAccessToken(tokenEnv as Record<string, string | undefined>);
  if (userEmail && auth.nextRefreshToken && auth.refreshTokenRotated) {
    await storePodioRefreshToken(auth.nextRefreshToken, env, userEmail);
  }
  if (!auth.token) return tokenEnv;
  return {
    ...tokenEnv,
    PODIO_RESOLVED_ACCESS_TOKEN: auth.token,
    PODIO_RESOLVED_AUTH_MODE: auth.mode,
  };
}

async function podioStoredRefreshToken(env: CloudflareEnv, userEmail: string): Promise<string | null> {
  const encrypted = await env.PODIO_TOKEN_STORE?.get(await podioRefreshKvKey(env, userEmail)).catch(() => null);
  return decryptCookieValue(encrypted || undefined, env);
}

async function storePodioRefreshToken(refreshToken: string, env: CloudflareEnv, userEmail: string): Promise<boolean> {
  if (!env.PODIO_TOKEN_STORE) return false;
  const encrypted = await encryptCookieValue(refreshToken, env);
  if (!encrypted) return false;
  await env.PODIO_TOKEN_STORE.put(await podioRefreshKvKey(env, userEmail), encrypted, {
    metadata: {
      provider: "podio",
      storedAt: nowIso(),
      purpose: "user_scoped_durable_refresh",
      userHash: await sha256Hex(userEmail.toLowerCase()),
    },
  });
  return true;
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
  const domains = splitList(env.AUTH_ALLOWED_DOMAINS, "heirright.com,solvys.io,texasequitypros.com");
  const emails = splitList(env.AUTH_ALLOWED_EMAILS || env.SOLVYS_ADMIN_EMAILS);
  return emails.includes(normalized) || domains.includes(domain);
}

async function hasValidSession(request: Request, env: CloudflareEnv): Promise<boolean> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (env.HEIRRIGHT_API_TOKEN && timingSafeStringEqual(bearer || "", env.HEIRRIGHT_API_TOKEN)) return true;
  if (!env.AUTH_SESSION_SECRET) return false;

  const cookieName = env.AUTH_SESSION_COOKIE || "hr_session";
  const token = parseCookie(request.headers.get("cookie"))[cookieName];
  if (!token || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacBase64Url(payload, env.AUTH_SESSION_SECRET);
  if (!timingSafeStringEqual(signature, expected)) return false;

  try {
    const body = JSON.parse(atob(base64UrlToBase64(payload))) as { email?: string; exp?: number };
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return false;
    return emailAllowed(body.email, env);
  } catch {
    return false;
  }
}

async function signedSessionEmail(request: Request, env: CloudflareEnv): Promise<string | null> {
  if (!env.AUTH_SESSION_SECRET) return null;
  const cookieName = env.AUTH_SESSION_COOKIE || "hr_session";
  const token = parseCookie(request.headers.get("cookie"))[cookieName];
  if (!token || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = await hmacBase64Url(payload, env.AUTH_SESSION_SECRET);
  if (!timingSafeStringEqual(signature, expected)) return null;
  try {
    const body = JSON.parse(atob(base64UrlToBase64(payload))) as { email?: string; exp?: number };
    const email = String(body.email || "").trim().toLowerCase();
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000) || !emailAllowed(email, env)) return null;
    return email;
  } catch {
    return null;
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
  const estateId = stringValue(body.estateId || body.leadId || body.assetKey);
  return estateId ? `idi:${estateId}` : "";
}

function paidIdiLockKey(body: Record<string, unknown>): string {
  return [
    "idi",
    normalizeAssetAddress(String(body.propertyAddress || body.address || body.assetAddress || "")),
  ].filter(Boolean).join(":");
}

function idiCoreUserApiKey(body: Record<string, unknown>): string {
  return stringValue(body.idiCoreApiKey || body.userApiKey);
}

function idiCoreSharedApiKey(env: CloudflareEnv): string {
  return stringValue(env.IDI_CORE_API_TOKEN || env.HEIRRIGHT_IDI_CORE_API_TOKEN || env.IDI_CORE_API_KEY);
}

function idiCoreRequestApiKey(body: Record<string, unknown>, env: CloudflareEnv): string {
  return idiCoreUserApiKey(body) || idiCoreSharedApiKey(env);
}

function idiCoreApiKeySource(body: Record<string, unknown>, env: CloudflareEnv): "user_override" | "shared_default" | "missing" {
  if (idiCoreUserApiKey(body)) return "user_override";
  return idiCoreSharedApiKey(env) ? "shared_default" : "missing";
}

function idiCoreMissingConfig(env: CloudflareEnv, body: Record<string, unknown> = {}): string[] {
  const missing: string[] = [];
  if (!env.IDI_CORE_API_URL) missing.push("IDI_CORE_API_URL");
  if (!idiCoreRequestApiKey(body, env)) missing.push("IDI_CORE_API_TOKEN");
  return missing;
}

function idiCorePortalConfigured(env: CloudflareEnv): boolean {
  return Boolean(
    (env.IDI_CORE_PORTAL_URL || env.IDI_CORE_SEARCH_URL)
      && (env.IDI_CORE_ACCOUNT_ID || env.IDI_CORE_ACCOUNT_COMPANY || env.IDI_CORE_OPERATOR_EMAIL)
  );
}

function idiCoreLiveApproved(_body: Record<string, unknown>, env: CloudflareEnv): boolean {
  return env.IDI_CORE_LIVE_RUN_APPROVED === "true";
}

function idiCoreMissingAccessList(items: string[]): string {
  return items.map((item) => item
    .replace(/IDI_CORE_API_URL/g, "IDI Core endpoint")
    .replace(/HEIRRIGHT_IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_KEY/g, "IDI Core access")
  ).join(", ");
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

type PaidIdiLockStatus = "reserved" | "completed" | "review_required";

interface PaidIdiLockRecord {
  version: 1;
  lockHash: string;
  reservationId: string;
  status: PaidIdiLockStatus;
  reservedAt: string;
  updatedAt: string;
  completedAt?: string;
  reviewRequiredAt?: string;
  overrideReason?: string;
  previousReservationId?: string;
}

interface PaidIdiLockCommandResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

interface CanonicalIdiImportReservation {
  assetHash: string;
  reservationId: string;
  contentHash?: string;
  idempotent?: boolean;
}

async function canonicalIdiImportCommand(env: CloudflareEnv, payload: Record<string, unknown>): Promise<PaidIdiLockCommandResult> {
  if (!env.WORKSPACE_STATE) {
    return {
      ok: false,
      status: 503,
      data: {
        error: "idi_import_guard_unavailable",
        message: "Canonical IDI import serialization is unavailable. No report was saved.",
      },
    };
  }
  try {
    const id = env.WORKSPACE_STATE.idFromName("heirright-team-workspace");
    const response = await env.WORKSPACE_STATE.get(id).fetch(new Request("https://workspace-state.internal/idi-import-lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 503,
      data: {
        error: "idi_import_guard_unavailable",
        message: "Canonical IDI import serialization is unavailable. No report was saved.",
      },
    };
  }
}

async function reserveCanonicalIdiImport(
  env: CloudflareEnv,
  assetKey: string,
  options: { contentHash?: string; existingContentHash?: string; overrideReason?: unknown } = {},
): Promise<{ ok: true; reservation: CanonicalIdiImportReservation } | { ok: false; response: Response }> {
  const assetHash = await sha256Hex(assetKey);
  const reservationId = crypto.randomUUID();
  const result = await canonicalIdiImportCommand(env, {
    action: "reserve",
    assetHash,
    reservationId,
    contentHash: stringValue(options.contentHash),
    existingContentHash: stringValue(options.existingContentHash),
    overrideReason: stringValue(options.overrideReason),
  });
  if (!result.ok) {
    return {
      ok: false,
      response: json({ ok: false, ...result.data }, { status: result.status || 503, headers: { "cache-control": "no-store" } }),
    };
  }
  return {
    ok: true,
    reservation: {
      assetHash,
      reservationId: stringValue(result.data.reservationId) || reservationId,
      contentHash: stringValue(result.data.contentHash || options.contentHash) || undefined,
      idempotent: result.data.idempotent === true,
    },
  };
}

async function finalizeCanonicalIdiImport(
  env: CloudflareEnv,
  reservation: CanonicalIdiImportReservation,
  action: "commit" | "abort",
  contentHash?: string,
): Promise<boolean> {
  const result = await canonicalIdiImportCommand(env, {
    action,
    assetHash: reservation.assetHash,
    reservationId: reservation.reservationId,
    contentHash: stringValue(contentHash || reservation.contentHash),
  });
  return result.ok;
}

async function canonicalIdiImportStatus(env: CloudflareEnv, assetKey: string): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}> {
  const result = await canonicalIdiImportCommand(env, {
    action: "status",
    assetHash: await sha256Hex(assetKey),
  });
  return result;
}

function descriptivePaidRunOverride(value: unknown): string {
  const reason = stringValue(value).replace(/\s+/g, " ").slice(0, 500);
  return reason.length >= 12 && reason.split(" ").filter(Boolean).length >= 2 ? reason : "";
}

async function paidIdiLockCommand(env: CloudflareEnv, payload: Record<string, unknown>): Promise<PaidIdiLockCommandResult> {
  if (!env.WORKSPACE_STATE) {
    return {
      ok: false,
      status: 503,
      data: {
        error: "idi_paid_run_lock_unavailable",
        blockers: ["Paid IDI duplicate protection is unavailable, so no vendor request was sent."],
        message: "Live IDI Core is temporarily blocked because the paid-search lock could not be reserved.",
      },
    };
  }
  try {
    const id = env.WORKSPACE_STATE.idFromName("heirright-team-workspace");
    const response = await env.WORKSPACE_STATE.get(id).fetch(new Request("https://workspace-state.internal/paid-idi-lock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 503,
      data: {
        error: "idi_paid_run_lock_unavailable",
        blockers: ["Paid IDI duplicate protection is unavailable, so no vendor request was sent."],
        message: "Live IDI Core is temporarily blocked because the paid-search lock could not be reserved.",
      },
    };
  }
}

async function reservePaidIdiRun(env: CloudflareEnv, lockKey: string, overrideReason: unknown): Promise<{
  ok: true;
  lockHash: string;
  reservationId: string;
} | {
  ok: false;
  response: Response;
}> {
  const lockHash = await sha256Hex(lockKey);
  const reservationId = crypto.randomUUID();
  const result = await paidIdiLockCommand(env, {
    action: "reserve",
    lockHash,
    reservationId,
    overrideReason: stringValue(overrideReason),
  });
  if (!result.ok) {
    return {
      ok: false,
      response: json({ ok: false, ...result.data }, { status: result.status || 503, headers: { "cache-control": "no-store" } }),
    };
  }
  return { ok: true, lockHash, reservationId };
}

async function finalizePaidIdiRun(
  env: CloudflareEnv,
  reservation: { lockHash: string; reservationId: string },
  status: "complete" | "review",
): Promise<boolean> {
  const result = await paidIdiLockCommand(env, {
    action: status,
    lockHash: reservation.lockHash,
    reservationId: reservation.reservationId,
  });
  return result.ok;
}

function idiCoreProviderResultHasExpectedShape(data: Record<string, unknown>): boolean {
  const candidateShape = (value: unknown) => Array.isArray(value)
    && value.every((candidate) => Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate)));
  const evidencePresent = [data.sourceEvidence, data.evidence].some((evidence) => Array.isArray(evidence)
    ? evidence.length > 0
    : Boolean(evidence && typeof evidence === "object" && Object.keys(evidence as Record<string, unknown>).length));
  return candidateShape(data.candidates)
    || candidateShape(data.contactCandidates)
    || Boolean(stringValue(data.importedText || data.reportText))
    || evidencePresent;
}

function idiCoreProviderCompletionSignal(data: Record<string, unknown>): boolean {
  if (stringValue(data.runId || data.receiptId)) return true;
  return /complete|verified|success|succeeded|confirmed/.test(stringValue(data.readbackStatus).toLowerCase());
}

function idiCoreProviderResultCompleted(data: Record<string, unknown>): boolean {
  return data.ok === true && idiCoreProviderCompletionSignal(data) && idiCoreProviderResultHasExpectedShape(data);
}

function idiCoreProviderResultSummary(data: Record<string, unknown>): Record<string, unknown> {
  return {
    explicitOk: data.ok === true,
    hasRunId: Boolean(stringValue(data.runId)),
    hasReceiptId: Boolean(stringValue(data.receiptId)),
    readbackStatusPresent: Boolean(stringValue(data.readbackStatus)),
    candidatesShape: Array.isArray(data.candidates),
    contactCandidatesShape: Array.isArray(data.contactCandidates),
    importedTextPresent: Boolean(stringValue(data.importedText || data.reportText)),
    evidencePresent: Boolean(data.sourceEvidence || data.evidence),
  };
}

async function liveIdiCoreResponse(body: Record<string, unknown>, env: CloudflareEnv): Promise<Response> {
  const assetKey = stringValue(body.assetKey);
  const estateId = stringValue(body.estateId || body.leadId || body.assetKey);
  const leadId = stringValue(body.leadId || estateId);
  if (!assetKey) {
    return json({
      ok: false,
      error: "asset_key_required",
      message: "Choose an estate before starting the paid IDI search.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  if (estateId !== assetKey || leadId !== assetKey) {
    return json({
      ok: false,
      error: "idi_estate_identity_mismatch",
      message: "The paid IDI request does not match one exact estate record. Select the estate again before continuing.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const canonicalBeforeRun = env.WORKSPACE_STATE ? await loadCanonicalDiscoveryFile(env, estateId) : null;
  if (!canonicalBeforeRun || !canonicalBeforeRun.exists) {
    return json({
      ok: false,
      error: "canonical_discovery_file_required",
      message: "The selected estate needs a verified canonical Discovery File before a paid IDI search can run.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (canonicalBeforeRun.readbackStatus !== "verified" && canonicalBeforeRun.readbackStatus !== "verified_recovered_previous") {
    return json({
      ok: false,
      error: "discovery_file_readback_failed",
      message: "The selected estate's canonical Discovery File could not be verified. No paid IDI request was sent.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const stopReasons = canonicalStopReasons(canonicalBeforeRun.record);
  if (stopReasons.length) return canonicalStopJson(stopReasons, "Paid IDI search");
  const lockKey = paidIdiLockKey(body);
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
      blockers: [`Live IDI Core needs approved vendor access before it can run: ${idiCoreMissingAccessList(missing)}.`],
      message: portalConfigured
        ? "idiCORE portal access is configured for approved operator searches, but backend live runs still need vendor API access. Open idiCORE, run the approved property search, then import the report."
        : "Live IDI Core is not configured. Import an approved report or add vendor access before running the paid search.",
      apiKeySource,
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!normalizeAssetAddress(stringValue(body.propertyAddress || body.address || body.assetAddress))) {
    return json({
      ok: false,
      error: "idi_property_address_required",
      message: "Choose an estate with a property address before starting the paid IDI search.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const recoveredExistingImport = await recoverCommittedStagedIdiImport(env, assetKey);
  if (recoveredExistingImport.error) {
    return json({
      ok: false,
      error: recoveredExistingImport.error,
      message: "A prior canonical IDI commit still needs verified staging cleanup. No vendor request was sent.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const existingImport = recoveredExistingImport.record;
  if (existingImport && !body.adminOverrideReason) {
    return json({
      ok: false,
      error: existingImport.paidRun ? "duplicate_idi_paid_run" : "duplicate_idi_asset_search",
      message: existingImport.paidRun
        ? "This estate already has a canonical paid IDI result. An administrator must record why another lookup is necessary."
        : "This estate already has a canonical imported IDI report. An administrator must record why a paid replacement is necessary.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const canonicalGuard = await reserveCanonicalIdiImport(env, assetKey, {
    existingContentHash: existingImport?.attachment.contentHash,
    overrideReason: body.adminOverrideReason,
  });
  if (!canonicalGuard.ok) return canonicalGuard.response;
  const reservation = await reservePaidIdiRun(env, lockKey, body.adminOverrideReason);
  if (!reservation.ok) {
    await finalizeCanonicalIdiImport(env, canonicalGuard.reservation, "abort");
    return reservation.response;
  }
  let response: Response;
  try {
    response = await fetch(String(env.IDI_CORE_API_URL), {
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
  } catch {
    await finalizeCanonicalIdiImport(env, canonicalGuard.reservation, "abort");
    await finalizePaidIdiRun(env, reservation, "review");
    return json({
      ok: false,
      error: "idi_core_run_failed",
      blockers: ["IDI Core did not return a result. No Discovery contact facts were accepted."],
      message: "Live IDI Core did not complete. The Discovery file remains blocked.",
      apiKeySource,
    }, { status: 502, headers: { "cache-control": "no-store" } });
  }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.ok === false) {
    await finalizeCanonicalIdiImport(env, canonicalGuard.reservation, "abort");
    await finalizePaidIdiRun(env, reservation, "review");
    return json({
      ok: false,
      error: data.error || "idi_core_run_failed",
      blockers: data.blockers || [`IDI Core returned ${response.status}. No Discovery contact facts were accepted.`],
      message: data.message || "Live IDI Core did not complete. The Discovery file remains blocked.",
      providerResponse: idiCoreProviderResultSummary(data),
      apiKeySource,
    }, { status: response.status || 502, headers: { "cache-control": "no-store" } });
  }
  if (!idiCoreProviderResultCompleted(data)) {
    await finalizeCanonicalIdiImport(env, canonicalGuard.reservation, "abort");
    const lockFinalized = await finalizePaidIdiRun(env, reservation, "review");
    return json({
      ok: false,
      error: lockFinalized ? "idi_core_result_ambiguous" : "idi_paid_run_lock_readback_failed",
      blockers: [lockFinalized
        ? "IDI Core returned an incomplete result without verified completion evidence. No Discovery contact facts were accepted, and an administrator must verify vendor history before another paid lookup."
        : "The paid search returned an uncertain result and its duplicate-protection record did not pass readback. Do not run it again until an administrator verifies vendor history."],
      message: lockFinalized
        ? "Keep Discovery in review because the paid IDI result could not be verified."
        : "Keep Discovery in review while an administrator verifies the vendor result and paid-search lock.",
      providerResponse: idiCoreProviderResultSummary(data),
      apiKeySource,
    }, { status: lockFinalized ? 502 : 503, headers: { "cache-control": "no-store" } });
  }
  const record = await paidIdiStoredRecord(body, data, lockKey);
  const storedRecord = record ? await persistStagedIdiImport(env, record) : null;
  if (!storedRecord) {
    await finalizeCanonicalIdiImport(env, canonicalGuard.reservation, "abort", record?.attachment.contentHash);
    await deleteStagedIdiImport(env, assetKey);
    const lockFinalized = await finalizePaidIdiRun(env, reservation, "review");
    return json({
      ok: false,
      error: lockFinalized ? "idi_import_readback_failed" : "idi_paid_run_lock_readback_failed",
      blockers: [lockFinalized
        ? "The paid IDI result did not pass canonical storage readback. No Discovery contact facts were accepted, and an administrator must verify vendor history before another lookup."
        : "The paid result and duplicate-protection state could not be verified. Do not run it again until an administrator verifies vendor history."],
      message: "Keep Discovery in review because the paid result was not saved as canonical evidence.",
      apiKeySource,
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!await finalizeCanonicalIdiImport(env, canonicalGuard.reservation, "commit", storedRecord.attachment.contentHash)) {
    await finalizeCanonicalIdiImport(env, canonicalGuard.reservation, "abort", storedRecord.attachment.contentHash);
    await deleteStagedIdiImport(env, assetKey);
    await finalizePaidIdiRun(env, reservation, "review");
    return json({
      ok: false,
      error: "idi_import_guard_readback_failed",
      blockers: ["The paid IDI result did not pass atomic canonical import commit readback. Do not run it again until an administrator verifies vendor history."],
      message: "Keep Discovery in review because the paid result was not committed as canonical evidence.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const canonicalRecord = await persistStoredIdiImport(env, {
    ...storedRecord,
    revision: crypto.randomUUID(),
    importVerification: "verified",
  });
  if (!canonicalRecord) {
    await finalizePaidIdiRun(env, reservation, "review");
    return json({
      ok: false,
      error: "idi_import_verification_readback_failed",
      blockers: ["The paid IDI import guard committed, but the canonical record did not pass final verification readback. Do not run it again."],
      message: "Keep Discovery in review while an administrator reconciles the canonical paid result.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!await deleteStagedIdiImport(env, assetKey)) {
    await finalizePaidIdiRun(env, reservation, "review");
    return json({
      ok: false,
      error: "idi_import_stage_cleanup_failed",
      blockers: ["The paid IDI result committed, but its temporary staging copy was not removed. Do not run it again."],
      message: "Keep Discovery in review until the staged paid result is reconciled.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!await finalizePaidIdiRun(env, reservation, "complete")) {
    await finalizePaidIdiRun(env, reservation, "review");
    await persistStoredIdiImport(env, {
      ...canonicalRecord,
      revision: crypto.randomUUID(),
      paidRunVerification: "review_required",
    });
    return json({
      ok: false,
      error: "idi_paid_run_lock_readback_failed",
      blockers: ["The paid search completed, but its duplicate-protection record did not pass readback. Do not run it again."],
      message: "Keep Discovery in review while an administrator verifies the completed IDI search.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const verifiedRecord = await persistStoredIdiImport(env, {
    ...canonicalRecord,
    revision: crypto.randomUUID(),
    paidRunVerification: "verified",
  });
  if (!verifiedRecord) {
    return json({
      ok: false,
      error: "idi_paid_run_verification_readback_failed",
      blockers: ["The paid search lock completed, but the canonical result did not pass its final verification readback. Do not run it again."],
      message: "Keep Discovery in review while an administrator verifies the completed IDI search.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return storedIdiImportResponse(verifiedRecord, env, { apiKeySource });
}

function receiptId(prefix = "heirright"): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const CANONICAL_RECENT_SALE_WINDOW_MS = 5 * 365.25 * 24 * 60 * 60 * 1000;

type CanonicalStopReason = {
  code: "COMPANY_OWNER" | "RECENT_SALE_WITHIN_5_YEARS";
  message: string;
};

function canonicalStopReasons(record: Record<string, unknown> | null | undefined): CanonicalStopReason[] {
  if (!record) return [];
  const dossier = objectValue(record.dossier);
  const property = objectValue(dossier.property);
  const ownerClaim = objectValue(property.ownerName);
  const seed = objectValue(record.seed);
  const capture = objectValue(record.capture);
  const propertyAppraiser = objectValue(capture.propertyAppraiser);
  const facts = Array.isArray(record.sourceFacts) ? record.sourceFacts as Array<Record<string, unknown>> : [];
  const workflow = objectValue(dossier.workflow);
  const rules = Array.isArray(workflow.rules) ? workflow.rules as Array<Record<string, unknown>> : [];
  const reasonCodes = new Set(rules
    .filter((rule) => stringValue(rule.status) === "stop")
    .flatMap((rule) => Array.isArray(rule.reasonCodes) ? rule.reasonCodes.map(String) : []));
  const ownerValues = [
    ownerClaim.value,
    propertyAppraiser.owner,
    propertyAppraiser.ownerName,
    seed.ownerName,
    ...facts
      .filter((factItem) => factItem.factType === "property_owner" || factItem.factType === "owner_type")
      .map((factItem) => factItem.value),
  ];
  const companyOwner = reasonCodes.has("COMPANY_OWNER") || ownerValues.some((value) => (
    String(value || "").toLowerCase() === "company" || isEntityOwnerName(value)
  ));
  const deed = objectValue(capture.deed);
  const saleValues = [
    deed.lastSaleDate,
    objectValue(objectValue(dossier.deedHistory).lastSaleDate).value,
    ...facts
      .filter((factItem) => factItem.factType === "last_sale_date"
        && (factItem.source === "official_records" || Boolean(stringValue(factItem.sourceUrl))))
      .map((factItem) => factItem.value),
  ];
  const recentSale = reasonCodes.has("RECENT_SALE_WITHIN_5_YEARS") || saleValues.some((value) => {
    const timestamp = Date.parse(String(value || ""));
    return Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp <= CANONICAL_RECENT_SALE_WINDOW_MS;
  });
  return [
    ...(companyOwner ? [{
      code: "COMPANY_OWNER" as const,
      message: "Property Appraiser evidence identifies a company or entity owner. Move on; if the classification is wrong, correct the Property Appraiser source record before running Discovery. There is no override.",
    }] : []),
    ...(recentSale ? [{
      code: "RECENT_SALE_WITHIN_5_YEARS" as const,
      message: "Official Records evidence shows a sale within the last 5 years. Move on; if the date is wrong, correct the Official Records source record before running Discovery. There is no override.",
    }] : []),
  ];
}

function canonicalStopJson(reasons: CanonicalStopReason[], context: string): Response {
  return json({
    ok: false,
    error: "canonical_stop_rule",
    status: "stop",
    reasonCodes: reasons.map((reason) => reason.code),
    blockers: reasons.map((reason) => reason.message),
    message: `${context} is blocked by a canonical stop rule. ${reasons[0]?.message || "Correct the source evidence before retrying."}`,
  }, { status: 409, headers: { "cache-control": "no-store" } });
}

type DurableCrmEstateReadback = {
  record: Record<string, unknown> | null;
  readbackStatus: string;
};

async function durableCrmEstateReadback(env: CloudflareEnv, estateId: string): Promise<DurableCrmEstateReadback> {
  if (!env.WORKSPACE_STATE) return { record: null, readbackStatus: "workspace_state_unavailable" };
  try {
    const id = env.WORKSPACE_STATE.idFromName("heirright-team-workspace");
    const url = new URL("https://workspace-state.internal/");
    url.searchParams.set("key", "heirright:crm-imported-estates");
    const response = await env.WORKSPACE_STATE.get(id).fetch(new Request(url));
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true || !Number.isInteger(Number(payload.revision)) || Number(payload.revision) < 1
      || typeof payload.value !== "string") {
      return { record: null, readbackStatus: "crm_estate_readback_failed" };
    }
    const imports = JSON.parse(payload.value) as unknown;
    if (!Array.isArray(imports)) return { record: null, readbackStatus: "crm_estate_readback_failed" };
    const matches = imports.filter((item) => stringValue(objectValue(item).id) === estateId);
    if (matches.length !== 1) {
      return { record: null, readbackStatus: matches.length ? "crm_estate_identity_ambiguous" : "crm_estate_not_found" };
    }
    const imported = objectValue(matches[0]);
    const ownerName = stringValue(imported.ownerName || imported.estateName);
    const propertyAddress = stringValue(imported.propertyAddress);
    const parcelId = stringValue(imported.parcelId);
    if (!ownerName || !propertyAddress || /\b(?:needs review|missing|unknown|imported estate)\b/i.test(`${ownerName} ${propertyAddress}`)) {
      return { record: null, readbackStatus: "crm_estate_subject_incomplete" };
    }
    return {
      record: {
        estateId,
        seed: {
          estateName: stringValue(imported.estateName),
          ownerName,
          propertyAddress,
          parcelId,
          county: stringValue(imported.county),
          source: "crm_workspace",
        },
      },
      readbackStatus: "verified",
    };
  } catch {
    return { record: null, readbackStatus: "crm_estate_readback_failed" };
  }
}

function canonicalEstateSubject(record: Record<string, unknown> | null | undefined): {
  ownerName: string;
  propertyAddress: string;
  parcelId: string;
} {
  const dossier = objectValue(record?.dossier);
  const property = objectValue(dossier.property);
  const capture = objectValue(record?.capture);
  const propertyAppraiser = objectValue(capture.propertyAppraiser);
  const seed = objectValue(record?.seed);
  return {
    ownerName: stringValue(propertyAppraiser.owner || propertyAppraiser.ownerName || objectValue(property.ownerName).value || seed.ownerName || seed.estateName),
    propertyAddress: stringValue(propertyAppraiser.address || propertyAppraiser.propertyAddress || objectValue(property.address).value || seed.propertyAddress),
    parcelId: stringValue(propertyAppraiser.folio || propertyAppraiser.parcelId || objectValue(property.parcelId).value || seed.parcelId),
  };
}

type CanonicalEstateSubject = ReturnType<typeof canonicalEstateSubject>;

function completeCanonicalEstateSubject(record: Record<string, unknown> | null | undefined): CanonicalEstateSubject | null {
  const subject = canonicalEstateSubject(record);
  return subject.ownerName && subject.propertyAddress ? subject : null;
}

function localFixtureIdiSubject(body: Record<string, unknown>): CanonicalEstateSubject {
  return {
    ownerName: stringValue(body.ownerName || body.owner || body.estateName),
    propertyAddress: stringValue(body.propertyAddress || body.address),
    parcelId: stringValue(body.parcelId || body.folio),
  };
}

function normalizedEstateOwnerIdentity(value: unknown): string {
  const ignored = new Set(["est", "estate", "of", "the", "jr", "sr", "ii", "iii", "iv", "v"]);
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !ignored.has(token))
    .sort()
    .join("|");
}

function normalizedEstateParcelIdentity(value: unknown): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizedEstateStreetIdentity(value: unknown): string {
  return normalizeAssetAddress(String(value || "").split(",")[0]);
}

function estateSubjectMismatchFields(
  exact: CanonicalEstateSubject,
  candidate: { ownerName?: unknown; propertyAddress?: unknown; parcelId?: unknown },
): string[] {
  const mismatches: string[] = [];
  const candidateOwner = stringValue(candidate.ownerName);
  const candidateAddress = stringValue(candidate.propertyAddress);
  const candidateParcel = stringValue(candidate.parcelId);
  if (candidateOwner && exact.ownerName
    && normalizedEstateOwnerIdentity(candidateOwner) !== normalizedEstateOwnerIdentity(exact.ownerName)) mismatches.push("owner");
  if (candidateAddress && exact.propertyAddress
    && normalizedEstateStreetIdentity(candidateAddress) !== normalizedEstateStreetIdentity(exact.propertyAddress)) mismatches.push("address");
  if (candidateParcel && exact.parcelId
    && !/needs review|missing|unknown/i.test(`${candidateParcel} ${exact.parcelId}`)
    && normalizedEstateParcelIdentity(candidateParcel) !== normalizedEstateParcelIdentity(exact.parcelId)) mismatches.push("folio");
  return mismatches;
}

type CanonicalEstateStopCheck = {
  reasons: CanonicalStopReason[];
  canonicalRecord: Record<string, unknown> | null;
  authoritativeSubject: CanonicalEstateSubject | null;
  readbackStatus: string;
};

async function canonicalEstateStopCheck(
  env: CloudflareEnv,
  estateId: string,
  fallback: Record<string, unknown>,
): Promise<CanonicalEstateStopCheck> {
  if (!estateId) {
    return { reasons: [], canonicalRecord: null, authoritativeSubject: null, readbackStatus: "exact_estate_identity_required" };
  }
  const canonical = env.PACKET_ARTIFACTS && env.WORKSPACE_STATE
    ? await loadCanonicalDiscoveryFile(env, estateId)
    : { record: null, exists: false, readbackStatus: "storage_unavailable" };
  if (canonical.exists && !["verified", "verified_recovered_previous"].includes(canonical.readbackStatus)) {
    return { reasons: [], canonicalRecord: null, authoritativeSubject: null, readbackStatus: canonical.readbackStatus || "failed" };
  }
  const canonicalRecord = canonical.record || null;
  const crm = await durableCrmEstateReadback(env, estateId);
  const crmReadbackAcceptable = ["verified", "crm_estate_not_found"].includes(crm.readbackStatus);
  if (env.AUTH_REQUIRED !== "false" && !crmReadbackAcceptable) {
    return { reasons: [], canonicalRecord: null, authoritativeSubject: null, readbackStatus: crm.readbackStatus || "crm_estate_readback_failed" };
  }
  const canonicalSubject = completeCanonicalEstateSubject(canonicalRecord);
  const crmSubject = completeCanonicalEstateSubject(crm.record);
  if (env.AUTH_REQUIRED !== "false" && canonicalSubject && crmSubject
    && estateSubjectMismatchFields(crmSubject, canonicalSubject).length) {
    return { reasons: [], canonicalRecord: null, authoritativeSubject: null, readbackStatus: "canonical_crm_subject_mismatch" };
  }
  const exactRecord = crm.record || canonicalRecord;
  if (!exactRecord && env.AUTH_REQUIRED !== "false") {
    return { reasons: [], canonicalRecord: null, authoritativeSubject: null, readbackStatus: crm.readbackStatus || canonical.readbackStatus || "failed" };
  }
  const reasons = [
    ...canonicalStopReasons(canonicalRecord),
    ...canonicalStopReasons(crm.record),
    ...canonicalStopReasons(fallback),
  ]
    .filter((reason, index, all) => all.findIndex((candidate) => candidate.code === reason.code) === index);
  return {
    reasons,
    canonicalRecord: exactRecord,
    authoritativeSubject: crmSubject || canonicalSubject,
    readbackStatus: exactRecord ? crm.record ? crm.readbackStatus : canonical.readbackStatus : "not_available",
  };
}

function canonicalEstateReadbackFailure(context: string, readbackStatus: string): Response {
  const subjectMismatch = readbackStatus === "canonical_crm_subject_mismatch";
  return json({
    ok: false,
    error: subjectMismatch ? "exact_estate_subject_mismatch" : "discovery_file_readback_failed",
    readbackStatus,
    message: subjectMismatch
      ? `${context} is blocked because the canonical Discovery File does not match the selected estate's durable CRM identity. Correct the CRM or Property Appraiser source before retrying.`
      : `${context} is blocked because the selected estate's canonical Discovery File could not be verified.`,
  }, { status: subjectMismatch ? 409 : 503, headers: { "cache-control": "no-store" } });
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
    if (Array.isArray(value) && !value.length && factType !== "unpaid_tax_years") return;
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
  const explicitlyNoUnpaidYears = (value: unknown): boolean => {
    const normalized = stringValue(value)
      .toLowerCase()
      .replace(/[.!]+$/g, "")
      .replace(/\s+/g, " ");
    return /^(?:none|none found|no unpaid(?: tax)? years?(?: found)?|no delinquent(?: tax)? years?(?: found)?)(?: (?:in|on) (?:the )?(?:reviewed source|source|reviewed receipt|receipt))?$/.test(normalized);
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
  addFact("tax_collector", "tax_last_paid_by", taxReceipt.paidBy || taxDetails.paidBy, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_payer_identity", taxReceipt.paidBy || taxReceipt.payerIdentity || taxDetails.payerIdentity, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_paid_date", taxReceipt.paidDate || taxDetails.paidDate, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_status", taxReceipt.status || taxDetails.receiptStatus || (receiptUrl ? "receipt_link_captured" : undefined), listingUrl || receiptUrl);
  addFact("tax_collector", "tax_receipt_link", receiptUrl, receiptUrl, receiptAttachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_receipt_attachment", receiptAttachment, receiptUrl, receiptAttachment, receiptDiscovery?.reviewFlags);
  addFact("tax_collector", "tax_amount_due", taxDetails.amountDue || taxReceipt.amountDue, listingUrl || receiptUrl);
  // The operator field is intentionally free text (for example, "2024, 2025"
  // or "None found"). Downstream dossier renderers require a number array, so
  // normalize an explicit reviewed-none value to [] so the fact collector records
  // a verified empty result instead of leaking a scalar into typed dossier output.
  // Ambiguous prose stays missing and review-required rather than becoming a false
  // negative in the completed packet.
  const capturedUnpaidYears = taxDetails.unpaidYears
    ?? (explicitlyNoUnpaidYears(taxReceipt.unpaidYears) ? [] : undefined);
  addFact("tax_collector", "unpaid_tax_years", capturedUnpaidYears, listingUrl || receiptUrl);
  addFact("tax_collector", "tax_reassessment_signal", taxReceipt.reassessment || taxDetails.reassessment, listingUrl || receiptUrl);
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
  const propertySourceUrl = stringValue(propertyAppraiser.sourceUrl);
  addFact("property_appraiser", "property_owner", propertyAppraiser.owner || propertyAppraiser.ownerName, propertySourceUrl);
  const capturedOwnerName = propertyAppraiser.owner || propertyAppraiser.ownerName;
  const capturedOwnerType = propertyAppraiser.ownerType
    || (isEntityOwnerName(capturedOwnerName)
      ? "company"
      : isTrustOrEstateOwnerName(capturedOwnerName)
        ? "trust_estate_review"
        : capturedOwnerName ? "individual_review" : undefined);
  addFact("property_appraiser", "owner_type", capturedOwnerType, propertySourceUrl);
  addFact("property_appraiser", "property_address", propertyAppraiser.address || propertyAppraiser.propertyAddress, propertySourceUrl);
  addFact("property_appraiser", "property_folio", propertyAppraiser.folio || propertyAppraiser.parcelId, propertySourceUrl);
  addFact("property_appraiser", "mailing_address_signal", propertyAppraiser.mailingAddressSignal || propertyAppraiser.mailingAddress, propertySourceUrl);
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
  if (request.method !== "POST") return methodNotAllowed();
  const body = await request.json().catch(() => undefined) as FreshLeadBatchRequest | undefined;
  const result = await runFreshLeadBatch(freshLeadRequestFromHttp(body, url), {
    env: env as Record<string, string | undefined>,
  });
  return json(result, { headers: { "cache-control": "no-store" } });
}

function normalizedExportFlow(body?: { flow?: unknown; docPrepFlow?: unknown; batch?: unknown; controlledTest?: unknown }): "controlled-test" | "discovery" | "closing-docs" {
  const explicitFlow = stringValue(body?.flow) || stringValue(body?.docPrepFlow);
  if (body?.controlledTest && !explicitFlow) return "controlled-test";
  const raw = explicitFlow || (body?.batch ? "batch" : "discovery");
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

interface StoredPacketArtifact {
  id: string;
  createdAt: string;
  expiresAt: string;
  contentHash: string;
  model: PacketModel;
  estateIds?: string[];
  flow?: "controlled-test" | "discovery" | "closing-docs";
  packetRevision?: number;
  documentId?: DiscoveryDocumentId;
  documentTitle?: string;
  parentArtifactId?: string;
}

interface StoredDocumentPacketArtifact {
  documentId: DiscoveryDocumentId;
  title: string;
  sectionIds: string[];
  artifact: StoredPacketArtifact;
}

interface StoredSupportingDocument {
  id: string;
  estateId: string;
  documentId: string;
  fileName: string;
  contentType: string;
  size: number;
  contentHash: string;
  createdAt: string;
  uploadedBy: string;
  dataBase64: string;
}

const DEFAULT_DOCUMENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const MIN_DOCUMENT_TTL_SECONDS = 24 * 60 * 60;
const MAX_DOCUMENT_TTL_SECONDS = 365 * 24 * 60 * 60;

function documentRetentionSeconds(env: CloudflareEnv): number {
  const configured = Number(env.HEIRRIGHT_DOCUMENT_TTL_SECONDS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_DOCUMENT_TTL_SECONDS;
  return Math.min(MAX_DOCUMENT_TTL_SECONDS, Math.max(MIN_DOCUMENT_TTL_SECONDS, Math.trunc(configured)));
}

interface StoredIdiImport {
  version: 1;
  revision: string;
  assetKey: string;
  leadId?: string;
  provider: "idi";
  mode: "uploaded_file" | "operator_import" | "live_idi_core";
  lockKey: string;
  importedAt: string;
  importedBy: string;
  attachment: Omit<StoredSupportingDocument, "dataBase64" | "uploadedBy"> & { artifactUrl: string; readbackStatus: "verified" };
  extraction: ReturnType<typeof safeIdiExtractionMetadata>;
  subjectMatch?: {
    matched: true;
    signals: Array<"owner" | "address" | "folio">;
    reviewedAt: string;
  };
  candidates: ReturnType<typeof buildIdiUploadCandidates>;
  contactPreviewCount: number;
  importVerification?: "pending_guard_commit" | "review_required" | "verified";
  paidRun: boolean;
  paidRunVerification?: "pending_lock_completion" | "review_required" | "verified";
  duplicateGuard: "first_import_only" | "first_paid_run_only" | "admin_override_recorded";
  adminOverrideReason: string | null;
}

function storedIdiImportIsCanonical(record: StoredIdiImport | null): boolean {
  return Boolean(record
    && record.importVerification !== "pending_guard_commit"
    && record.importVerification !== "review_required"
    && (record.mode === "live_idi_core" || record.subjectMatch?.matched === true));
}

type StoredIdiContactReviewStatus = "accepted" | "promoted" | "rejected";

interface StoredIdiContactReview {
  version: 1;
  revision: string;
  assetKey: string;
  candidateId: string;
  importContentHash: string;
  status: StoredIdiContactReviewStatus;
  reviewedAt: string;
  reviewedBy: string;
}

interface StoredGoogleWorkspaceConnection {
  version: 1;
  email: string;
  accessTokenCipher: string;
  refreshTokenCipher?: string;
  expiresAt: string;
  scopes: string[];
  destinationId?: string;
  destinationName?: string;
  connectedAt: string;
  updatedAt: string;
}

function packetArtifactKey(artifactId: string): string {
  return `packet:${artifactId}`;
}

function supportingDocumentKey(attachmentId: string): string {
  return `supporting-document:${attachmentId}`;
}

async function idiImportKey(assetKey: string): Promise<string> {
  return `idi-import:${await sha256Hex(assetKey)}`;
}

async function idiImportStageKey(assetKey: string): Promise<string> {
  return `idi-import-stage:${await sha256Hex(assetKey)}`;
}

async function idiContactReviewKey(assetKey: string, candidateId: string): Promise<string> {
  return `idi-contact-review:${await sha256Hex(assetKey)}:${await sha256Hex(candidateId)}`;
}

async function googleWorkspaceConnectionKey(email: string): Promise<string> {
  return `google-workspace-connection:${await sha256Hex(email.toLowerCase())}`;
}

function googleWorkspaceDeliveryKey(artifactId: string, destinationId: string, documentId = ""): string {
  return `google-workspace-delivery:${artifactId}:${documentId || "full-packet"}:${destinationId}`;
}

async function supportingDocumentIndexKey(estateId: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(estateId));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `supporting-document-index:${hash}`;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = await sha256Bytes(value);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256ByteHex(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", byteArrayBuffer(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function supportingDocumentMetadata(record: StoredSupportingDocument): Omit<StoredSupportingDocument, "dataBase64"> & { artifactUrl: string; readbackStatus: "verified" } {
  const { dataBase64: _dataBase64, ...metadata } = record;
  return {
    ...metadata,
    artifactUrl: `/api/documents/attachments?attachmentId=${encodeURIComponent(record.id)}`,
    readbackStatus: "verified",
  };
}

function storedStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function storedSupportingDocument(value: string | null | undefined): StoredSupportingDocument | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredSupportingDocument>;
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.estateId || !parsed.documentId || !parsed.dataBase64 || !parsed.contentHash) return null;
    return parsed as StoredSupportingDocument;
  } catch {
    return null;
  }
}

function internalBearerAuthorized(request: Request, env: CloudflareEnv): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  return Boolean(env.HEIRRIGHT_API_TOKEN && timingSafeStringEqual(bearer, env.HEIRRIGHT_API_TOKEN));
}

async function loadStoredSupportingDocument(env: CloudflareEnv, attachmentId: string): Promise<StoredSupportingDocument | null> {
  if (!env.PACKET_ARTIFACTS || !/^supporting-[0-9]+-[a-f0-9]{16}$/.test(attachmentId)) return null;
  return storedSupportingDocument(await env.PACKET_ARTIFACTS.get(supportingDocumentKey(attachmentId)));
}

function storedIdiImport(value: string | null | undefined): StoredIdiImport | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredIdiImport>;
    if (!parsed || parsed.version !== 1 || !parsed.assetKey || !parsed.attachment || !Array.isArray(parsed.candidates)) return null;
    return parsed as StoredIdiImport;
  } catch {
    return null;
  }
}

function storedIdiContactReview(value: string | null | undefined): StoredIdiContactReview | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredIdiContactReview>;
    if (!parsed || parsed.version !== 1 || !parsed.revision || !parsed.assetKey || !parsed.candidateId || !parsed.importContentHash
      || !["accepted", "promoted", "rejected"].includes(stringValue(parsed.status))) return null;
    return parsed as StoredIdiContactReview;
  } catch {
    return null;
  }
}

async function storedIdiContactReviews(env: CloudflareEnv, record: StoredIdiImport): Promise<Map<string, StoredIdiContactReview>> {
  if (!env.PACKET_ARTIFACTS) return new Map();
  const reviews = await Promise.all(record.candidates.map(async (candidate) => storedIdiContactReview(
    await env.PACKET_ARTIFACTS?.get(await idiContactReviewKey(record.assetKey, candidate.id))
  )));
  return new Map(reviews.filter((review): review is StoredIdiContactReview => Boolean(
    review && review.assetKey === record.assetKey && review.importContentHash === record.attachment.contentHash
      && record.candidates.some((candidate) => candidate.id === review.candidateId)
  )).map((review) => [review.candidateId, review]));
}

function storedGoogleWorkspaceConnection(value: string | null | undefined): StoredGoogleWorkspaceConnection | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredGoogleWorkspaceConnection>;
    if (!parsed || parsed.version !== 1 || !parsed.email || !parsed.accessTokenCipher || !parsed.expiresAt) return null;
    return parsed as StoredGoogleWorkspaceConnection;
  } catch {
    return null;
  }
}

function supportingDocumentSignatureMatches(contentType: string, bytes: Uint8Array): boolean {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (contentType === "application/pdf") return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (contentType === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (contentType === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (contentType === "image/webp") {
    return startsWith(0x52, 0x49, 0x46, 0x46)
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
  }
  if (contentType === "application/msword") return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return startsWith(0x50, 0x4b, 0x03, 0x04);
  if (contentType === "text/csv") {
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
      return Boolean(text.trim() && /[,\n\r]/.test(text) && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text));
    } catch {
      return false;
    }
  }
  return false;
}

async function rollbackSupportingDocumentWrite(
  env: CloudflareEnv,
  objectKey: string,
  options: { indexKey?: string; previousIndex?: string | null; estateId?: string } = {},
): Promise<Record<string, unknown>> {
  if (!env.PACKET_ARTIFACTS) return { complete: false, object: "store_unavailable", index: "store_unavailable" };
  let index = options.indexKey ? "rollback_failed" : "not_written";
  if (options.indexKey) {
    try {
      if (options.previousIndex === null || options.previousIndex === undefined) {
        await env.PACKET_ARTIFACTS.delete(options.indexKey);
        index = await env.PACKET_ARTIFACTS.get(options.indexKey) === null ? "removed_verified" : "remove_failed";
      } else {
        await env.PACKET_ARTIFACTS.put(options.indexKey, options.previousIndex, {
          expirationTtl: documentRetentionSeconds(env),
          metadata: { kind: "supporting_document_index", estateId: options.estateId },
        });
        index = await env.PACKET_ARTIFACTS.get(options.indexKey) === options.previousIndex ? "restored_verified" : "restore_failed";
      }
    } catch {
      index = "rollback_failed";
    }
  }
  let object = "delete_failed";
  try {
    await env.PACKET_ARTIFACTS.delete(objectKey);
    object = await env.PACKET_ARTIFACTS.get(objectKey) === null ? "deleted_verified" : "delete_failed";
  } catch {
    object = "delete_failed";
  }
  return {
    complete: object === "deleted_verified" && ["not_written", "removed_verified", "restored_verified"].includes(index),
    object,
    index,
  };
}

async function supportingDocumentResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (!env.PACKET_ARTIFACTS) {
    return json({ ok: false, error: "supporting_document_store_unavailable", message: "Supporting document storage is unavailable." }, { status: 503 });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const estateId = stringValue(body.estateId);
    const documentId = stringValue(body.documentId);
    const fileName = stringValue(body.fileName).replace(/[\r\n"\\/]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    const contentType = stringValue(body.contentType).toLowerCase();
    const dataBase64 = stringValue(body.dataBase64).replace(/^data:[^;]+;base64,/i, "");
    const uploadedBy = stringValue(body.uploadedBy) || "approved HeirRight user";
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/csv",
    ]);
    if (!estateId || !documentId || !fileName || !dataBase64) {
      return json({ ok: false, error: "supporting_document_required", message: "Choose a supporting document before saving." }, { status: 400 });
    }
    if (!allowedTypes.has(contentType)) {
      return json({ ok: false, error: "unsupported_supporting_document", message: "Use a PDF, DOCX, CSV, JPG, PNG, or WEBP supporting document." }, { status: 415 });
    }
    let bytes: Uint8Array;
    try {
      bytes = base64UrlToBytes(dataBase64);
    } catch {
      return json({ ok: false, error: "invalid_supporting_document", message: "The selected supporting document could not be read." }, { status: 400 });
    }
    if (!bytes.byteLength || bytes.byteLength > 3_000_000) {
      return json({ ok: false, error: "supporting_document_too_large", message: "Supporting documents must be 3 MB or smaller." }, { status: 413 });
    }
    if (!supportingDocumentSignatureMatches(contentType, bytes)) {
      return json({ ok: false, error: "supporting_document_type_mismatch", message: "The file contents do not match the selected document type." }, { status: 415 });
    }
    const contentHash = await sha256ByteHex(bytes);
    const uniqueSuffix = await sha256Hex(`${contentHash}:${estateId}:${documentId}:${crypto.randomUUID()}`);
    const id = `supporting-${Date.now()}-${uniqueSuffix.slice(0, 16)}`;
    const record: StoredSupportingDocument = {
      id,
      estateId,
      documentId,
      fileName,
      contentType,
      size: bytes.byteLength,
      contentHash,
      createdAt: nowIso(),
      uploadedBy,
      dataBase64,
    };
    const objectKey = supportingDocumentKey(id);
    try {
      await env.PACKET_ARTIFACTS.put(objectKey, JSON.stringify(record), {
        expirationTtl: documentRetentionSeconds(env),
        metadata: { kind: "supporting_document", estateId, documentId, contentHash },
      });
    } catch {
      const cleanup = await rollbackSupportingDocumentWrite(env, objectKey);
      return json({
        ok: false,
        error: "supporting_document_store_failed",
        message: cleanup.complete
          ? "The supporting document was not saved, and the partial write was removed. Try again."
          : "The supporting document write failed and cleanup could not be verified. Keep this estate blocked for administrator review.",
        cleanup,
      }, { status: 503 });
    }
    let readback: StoredSupportingDocument | null = null;
    try {
      readback = storedSupportingDocument(await env.PACKET_ARTIFACTS.get(objectKey));
    } catch {
      readback = null;
    }
    if (!readback || readback.id !== id || readback.estateId !== estateId || readback.contentHash !== contentHash) {
      const cleanup = await rollbackSupportingDocumentWrite(env, objectKey);
      return json({
        ok: false,
        error: "supporting_document_readback_failed",
        message: cleanup.complete
          ? "The supporting document did not pass storage readback, and the partial write was removed. Try again."
          : "The supporting document did not pass readback and cleanup could not be verified. Keep this estate blocked for administrator review.",
        cleanup,
      }, { status: 503 });
    }
    const indexKey = await supportingDocumentIndexKey(estateId);
    let existingIndex: string | null;
    try {
      existingIndex = await env.PACKET_ARTIFACTS.get(indexKey);
    } catch {
      const cleanup = await rollbackSupportingDocumentWrite(env, objectKey);
      return json({
        ok: false,
        error: "supporting_document_index_readback_failed",
        message: cleanup.complete
          ? "The estate document list could not be read, and the unindexed upload was removed. Try again."
          : "The estate document list failed and cleanup could not be verified. Keep this estate blocked for administrator review.",
        cleanup,
      }, { status: 503 });
    }
    const attachmentIds = storedStringArray(existingIndex);
    const nextIndex = JSON.stringify([id, ...attachmentIds.filter((item: string) => item !== id)].slice(0, 200));
    try {
      await env.PACKET_ARTIFACTS.put(indexKey, nextIndex, {
        expirationTtl: documentRetentionSeconds(env),
        metadata: { kind: "supporting_document_index", estateId },
      });
      const indexReadback = storedStringArray(await env.PACKET_ARTIFACTS.get(indexKey));
      if (!indexReadback.includes(id)) throw new Error("supporting_document_index_readback_failed");
    } catch {
      const cleanup = await rollbackSupportingDocumentWrite(env, objectKey, { indexKey, previousIndex: existingIndex, estateId });
      return json({
        ok: false,
        error: "supporting_document_index_readback_failed",
        message: cleanup.complete
          ? "The estate document list did not pass readback, and the unindexed upload was removed. Try again."
          : "The estate document list did not pass readback and cleanup could not be verified. Keep this estate blocked for administrator review.",
        cleanup,
      }, { status: 503 });
    }
    return json({ ok: true, attachment: supportingDocumentMetadata(record) }, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "GET") {
    const attachmentId = stringValue(url.searchParams.get("attachmentId"));
    if (attachmentId) {
      if (!/^supporting-[0-9]+-[a-f0-9]{16}$/.test(attachmentId)) {
        return json({ ok: false, error: "invalid_supporting_document_id", message: "Choose a valid supporting document." }, { status: 400 });
      }
      const stored = await env.PACKET_ARTIFACTS.get(supportingDocumentKey(attachmentId));
      if (!stored) return json({ ok: false, error: "supporting_document_not_found", message: "This supporting document is unavailable." }, { status: 404 });
      const record = storedSupportingDocument(stored);
      if (!record) return json({ ok: false, error: "supporting_document_integrity_failed", message: "Supporting document metadata is invalid." }, { status: 409 });
      const bytes = base64UrlToBytes(record.dataBase64);
      if (await sha256ByteHex(bytes) !== record.contentHash) {
        return json({ ok: false, error: "supporting_document_integrity_failed", message: "Supporting document integrity validation failed." }, { status: 409 });
      }
      return new Response(byteArrayBuffer(bytes), {
        headers: {
          "content-type": record.contentType,
          "content-disposition": `inline; filename="${record.fileName.replace(/"/g, "")}"`,
          "cache-control": "private, no-store",
          "x-heirright-artifact-id": record.id,
          "x-heirright-content-hash": record.contentHash,
        },
      });
    }
    const estateId = stringValue(url.searchParams.get("estateId"));
    if (!estateId) return json({ ok: false, error: "estate_id_required", message: "Choose an estate before loading supporting documents." }, { status: 400 });
    const storedIndex = await env.PACKET_ARTIFACTS.get(await supportingDocumentIndexKey(estateId));
    const attachmentIds = storedStringArray(storedIndex);
    const records = await Promise.all(attachmentIds.map((id: string) => env.PACKET_ARTIFACTS?.get(supportingDocumentKey(id))));
    const attachments = records
      .map((record) => storedSupportingDocument(record))
      .filter((record): record is StoredSupportingDocument => Boolean(record))
      .map(supportingDocumentMetadata);
    return json({ ok: true, estateId, attachments }, { headers: { "cache-control": "no-store" } });
  }

  if (request.method === "DELETE") {
    const attachmentId = stringValue(url.searchParams.get("attachmentId"));
    if (!/^supporting-[0-9]+-[a-f0-9]{16}$/.test(attachmentId)) {
      return json({ ok: false, error: "invalid_supporting_document_id", message: "Choose a valid supporting document." }, { status: 400 });
    }
    const stored = await env.PACKET_ARTIFACTS.get(supportingDocumentKey(attachmentId));
    if (!stored) return json({ ok: true, deleted: false, attachmentId, readbackStatus: "not_found" }, { headers: { "cache-control": "no-store" } });
    const record = storedSupportingDocument(stored);
    if (!record) return json({ ok: false, error: "supporting_document_integrity_failed", message: "Supporting document metadata is invalid." }, { status: 409 });
    await env.PACKET_ARTIFACTS.delete(supportingDocumentKey(attachmentId));
    const indexKey = await supportingDocumentIndexKey(record.estateId);
    const storedIndex = await env.PACKET_ARTIFACTS.get(indexKey);
    const attachmentIds = storedStringArray(storedIndex);
    await env.PACKET_ARTIFACTS.put(indexKey, JSON.stringify(attachmentIds.filter((id: string) => id !== attachmentId)), {
      expirationTtl: documentRetentionSeconds(env),
      metadata: { kind: "supporting_document_index", estateId: record.estateId },
    });
    const readback = await env.PACKET_ARTIFACTS.get(supportingDocumentKey(attachmentId));
    if (readback) return json({ ok: false, error: "supporting_document_delete_failed", message: "The supporting document did not pass removal readback." }, { status: 503 });
    return json({ ok: true, deleted: true, attachmentId, estateId: record.estateId, documentId: record.documentId, readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
  }

  return methodNotAllowed("GET, POST, DELETE");
}

const sharedWorkspaceStateKeys = new Set([
  "heirright:crm-imported-estates",
  "heirright:docprep-estate-state",
  "heirright:deal-status-state",
  "heirright:deal-status-labels",
  "heirright:discovery-workflow-state",
  "heirright:source-capture-state",
  "heirright:idi-asset-imports",
  "heirright:contact-review-state",
  "heirright:document-files-state",
  "heirright:closing-field-values",
  "heirright:closing-export-state",
  "heirright:outreach-workspace",
]);

function sanitizedSharedWorkspaceValue(key: string, value: string): { value: string; strippedPacketApprovals: boolean } {
  const parsed = JSON.parse(value) as unknown;
  if (key !== "heirright:docprep-estate-state" || !parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { value, strippedPacketApprovals: false };
  }
  let strippedPacketApprovals = false;
  const stateRecord = parsed as Record<string, unknown>;
  for (const estateValue of Object.values(stateRecord)) {
    if (!estateValue || typeof estateValue !== "object" || Array.isArray(estateValue)) continue;
    const estateRecord = estateValue as Record<string, unknown>;
    for (const flow of ["discovery", "closing-docs"]) {
      const flowValue = estateRecord[flow];
      if (!flowValue || typeof flowValue !== "object" || Array.isArray(flowValue)) continue;
      const flowRecord = flowValue as Record<string, unknown>;
      if ("packetApproval" in flowRecord) {
        delete flowRecord.packetApproval;
        strippedPacketApprovals = true;
      }
    }
  }
  return { value: JSON.stringify(stateRecord), strippedPacketApprovals };
}

type WorkspaceStateStorageTransaction = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};

type WorkspaceStateStorage = WorkspaceStateStorageTransaction & {
  transaction?<T>(closure: (transaction: WorkspaceStateStorageTransaction) => Promise<T>): Promise<T>;
};

type CanonicalIdiImportGuardStatus = "reserved" | "committed" | "aborted";

interface CanonicalIdiImportGuardRecord {
  version: 1;
  assetHash: string;
  reservationId: string;
  status: CanonicalIdiImportGuardStatus;
  contentHash?: string;
  reservedAt: string;
  updatedAt: string;
  committedAt?: string;
  abortedAt?: string;
  overrideReason?: string;
  previous?: CanonicalIdiImportGuardRecord;
}

type GoogleDriveOperationStatus = "reserved" | "released" | "review_required";

interface GoogleDriveOperationRecord {
  version: 1;
  operationHash: string;
  reservationId: string;
  status: GoogleDriveOperationStatus;
  reservedAt: string;
  updatedAt: string;
  releasedAt?: string;
  reviewRequiredAt?: string;
}

const GOOGLE_DRIVE_OPERATION_STALE_MS = 15 * 60 * 1000;

interface PacketApprovalRecord {
  version: 1;
  approvalHash: string;
  estateId: string;
  flow: "discovery" | "closing-docs";
  packetRevision: number;
  artifactId: string;
  artifactContentHash: string;
  approvedAt: string;
  approvedBy: string;
}

type DiscoveryFileWriteStatus = "reserved" | "committed";

interface DiscoveryFilePointer {
  storageKey: string;
  contentHash: string;
  revision: string;
}

interface DiscoveryFileWriteRecord {
  version: 1;
  estateHash: string;
  reservationId: string;
  status: DiscoveryFileWriteStatus;
  reservedAt: string;
  updatedAt: string;
  committedAt?: string;
  active?: DiscoveryFilePointer;
  previous?: DiscoveryFilePointer;
}

const DISCOVERY_FILE_WRITE_STALE_MS = 15 * 60 * 1000;

export class WorkspaceState {
  private storage: WorkspaceStateStorage;

  constructor(state: { storage: WorkspaceStateStorage }) {
    this.storage = state.storage;
  }

  private async packetApprovalOperationResponse(body: Record<string, unknown>): Promise<Response> {
    const action = stringValue(body.action);
    const approvalHash = stringValue(body.approvalHash).toLowerCase();
    const estateId = stringValue(body.estateId);
    const flow = stringValue(body.flow);
    const packetRevision = Number(body.packetRevision);
    const artifactId = stringValue(body.artifactId);
    const artifactContentHash = stringValue(body.artifactContentHash).toLowerCase();
    const approvedBy = stringValue(body.approvedBy).toLowerCase();
    if (!["approve", "status"].includes(action)
      || !/^[a-f0-9]{64}$/.test(approvalHash)
      || !estateId || estateId.length > 500
      || !["discovery", "closing-docs"].includes(flow)
      || !Number.isInteger(packetRevision) || packetRevision < 1
      || !/^packet-[0-9]+-[a-f0-9]{16}$/.test(artifactId)
      || !/^[a-f0-9]{64}$/.test(artifactContentHash)
      || !approvedBy || approvedBy.length > 254) {
      return json({
        ok: false,
        error: "packet_approval_operation_invalid",
        message: "The packet approval binding is invalid.",
      }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    if (!this.storage.transaction) {
      return json({
        ok: false,
        error: "packet_approval_serialization_unavailable",
        message: "Atomic packet approval storage is unavailable.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    const storageKey = `packet-approval:${approvalHash}`;
    const exact = (record: PacketApprovalRecord | undefined): record is PacketApprovalRecord => Boolean(
      record
      && record.version === 1
      && record.approvalHash === approvalHash
      && record.estateId === estateId
      && record.flow === flow
      && record.packetRevision === packetRevision
      && record.artifactId === artifactId
      && record.artifactContentHash === artifactContentHash
      && record.approvedBy === approvedBy
      && Number.isFinite(Date.parse(record.approvedAt))
    );
    try {
      return await this.storage.transaction(async (storage) => {
        const current = await storage.get<PacketApprovalRecord>(storageKey);
        if (action === "status") {
          if (!current) {
            return json({ ok: false, error: "packet_approval_not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
          }
          return json({ ok: true, approval: current, exact: exact(current), readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
        }
        if (exact(current)) {
          return json({ ok: true, approval: current, idempotent: true, readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
        }
        const approval: PacketApprovalRecord = {
          version: 1,
          approvalHash,
          estateId,
          flow: flow as PacketApprovalRecord["flow"],
          packetRevision,
          artifactId,
          artifactContentHash,
          approvedAt: nowIso(),
          approvedBy,
        };
        await storage.put(storageKey, approval);
        const readback = await storage.get<PacketApprovalRecord>(storageKey);
        if (!exact(readback)) throw new Error("packet_approval_readback_failed");
        return json({ ok: true, approval: readback, readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
      });
    } catch {
      return json({
        ok: false,
        error: "packet_approval_readback_failed",
        message: "The packet approval did not pass atomic storage readback.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }

  private async discoveryFileOperationResponse(body: Record<string, unknown>): Promise<Response> {
    const action = stringValue(body.action);
    const estateHash = stringValue(body.estateHash).toLowerCase();
    const reservationId = stringValue(body.reservationId);
    const candidateStorageKey = stringValue(body.candidateStorageKey);
    const candidateContentHash = stringValue(body.candidateContentHash).toLowerCase();
    const candidateRevision = stringValue(body.candidateRevision);
    const legacyStorageKey = stringValue(body.legacyStorageKey);
    const legacyContentHash = stringValue(body.legacyContentHash).toLowerCase();
    const legacyRevision = stringValue(body.legacyRevision);
    const pointerValid = (pointer?: DiscoveryFilePointer): pointer is DiscoveryFilePointer => Boolean(
      pointer
      && /^discovery-file:[a-f0-9]{64}(?::revision:[a-f0-9]{64})?$/.test(pointer.storageKey)
      && /^[a-f0-9]{64}$/.test(pointer.contentHash)
      && pointer.revision
    );
    const legacyPointer = legacyStorageKey || legacyContentHash || legacyRevision
      ? { storageKey: legacyStorageKey, contentHash: legacyContentHash, revision: legacyRevision }
      : undefined;
    const candidatePointer = candidateStorageKey || candidateContentHash || candidateRevision
      ? { storageKey: candidateStorageKey, contentHash: candidateContentHash, revision: candidateRevision }
      : undefined;
    if (!/^[a-f0-9]{64}$/.test(estateHash)
      || (action !== "status" && !reservationId)
      || !["reserve", "commit", "abort", "rollback", "status"].includes(action)
      || (legacyPointer && !pointerValid(legacyPointer))
      || ((action === "commit" || action === "rollback") && !pointerValid(candidatePointer))) {
      return json({
        ok: false,
        error: "discovery_file_operation_invalid",
        message: "The canonical Discovery File operation is invalid.",
      }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    if (!this.storage.transaction) {
      return json({
        ok: false,
        error: "discovery_file_serialization_unavailable",
        message: "Atomic Discovery File serialization is unavailable.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    const storageKey = `discovery-file-operation:${estateHash}`;
    const responseBody = (record: DiscoveryFileWriteRecord, extra: Record<string, unknown> = {}) => ({
      ok: true,
      estateHash,
      reservationId: record.reservationId,
      status: record.status,
      active: record.active,
      previous: record.previous,
      readbackStatus: "verified",
      ...extra,
    });
    try {
      return await this.storage.transaction(async (storage) => {
        let current = await storage.get<DiscoveryFileWriteRecord>(storageKey);
        const timestamp = nowIso();
        if (action === "status") {
          if (!current) return json({ ok: false, error: "discovery_file_operation_not_found" }, { status: 404, headers: { "cache-control": "no-store" } });
          return json(responseBody(current), { headers: { "cache-control": "no-store" } });
        }
        if (action === "reserve") {
          if (current?.status === "reserved") {
            const ageMs = Date.now() - Date.parse(current.updatedAt || current.reservedAt);
            if (!Number.isFinite(ageMs) || ageMs <= DISCOVERY_FILE_WRITE_STALE_MS) {
              return json({
                ok: false,
                error: "discovery_file_write_in_progress",
                message: "Another canonical Discovery File write is already in progress for this estate.",
              }, { status: 409, headers: { "cache-control": "no-store" } });
            }
            current = {
              ...current,
              status: "committed",
              updatedAt: timestamp,
              committedAt: timestamp,
            };
          }
          const active = current?.active || (pointerValid(legacyPointer) ? legacyPointer : undefined);
          if (active && candidateContentHash && active.contentHash === candidateContentHash) {
            const idempotent: DiscoveryFileWriteRecord = {
              ...(current || {
                version: 1,
                estateHash,
                reservationId,
                status: "committed" as const,
                reservedAt: timestamp,
                updatedAt: timestamp,
              }),
              active,
              status: "committed",
            };
            return json(responseBody(idempotent, { idempotent: true }), { headers: { "cache-control": "no-store" } });
          }
          const reserved: DiscoveryFileWriteRecord = {
            version: 1,
            estateHash,
            reservationId,
            status: "reserved",
            reservedAt: timestamp,
            updatedAt: timestamp,
            ...(active ? { active } : {}),
            ...(current?.previous ? { previous: current.previous } : {}),
          };
          await storage.put(storageKey, reserved);
          const readback = await storage.get<DiscoveryFileWriteRecord>(storageKey);
          if (readback?.reservationId !== reservationId || readback.status !== "reserved") {
            throw new Error("discovery_file_reservation_readback_failed");
          }
          return json(responseBody(readback), { headers: { "cache-control": "no-store" } });
        }
        if (!current || current.reservationId !== reservationId) {
          return json({
            ok: false,
            error: "discovery_file_operation_conflict",
            message: "The canonical Discovery File operation no longer matches this request.",
          }, { status: 409, headers: { "cache-control": "no-store" } });
        }
        if (action === "abort") {
          if (current.status !== "reserved") {
            return json(responseBody(current, { idempotent: true }), { headers: { "cache-control": "no-store" } });
          }
          const restored: DiscoveryFileWriteRecord = {
            ...current,
            status: "committed",
            updatedAt: timestamp,
            committedAt: timestamp,
          };
          await storage.put(storageKey, restored);
          const readback = await storage.get<DiscoveryFileWriteRecord>(storageKey);
          if (readback?.reservationId !== reservationId || readback.status !== "committed"
            || readback.active?.contentHash !== restored.active?.contentHash) {
            throw new Error("discovery_file_abort_readback_failed");
          }
          return json(responseBody(readback), { headers: { "cache-control": "no-store" } });
        }
        if (action === "commit") {
          if (current.status === "committed") {
            const idempotent = current.active?.contentHash === candidatePointer?.contentHash;
            return json(responseBody(current, { idempotent }), { status: idempotent ? 200 : 409, headers: { "cache-control": "no-store" } });
          }
          const committed: DiscoveryFileWriteRecord = {
            ...current,
            status: "committed",
            active: candidatePointer,
            ...(current.active ? { previous: current.active } : { previous: undefined }),
            updatedAt: timestamp,
            committedAt: timestamp,
          };
          await storage.put(storageKey, committed);
          const readback = await storage.get<DiscoveryFileWriteRecord>(storageKey);
          if (readback?.reservationId !== reservationId || readback.status !== "committed"
            || readback.active?.storageKey !== candidatePointer?.storageKey
            || readback.active?.contentHash !== candidatePointer?.contentHash) {
            throw new Error("discovery_file_commit_readback_failed");
          }
          return json(responseBody(readback), { headers: { "cache-control": "no-store" } });
        }
        if (current.status !== "committed" || current.active?.contentHash !== candidatePointer?.contentHash) {
          return json({
            ok: false,
            error: "discovery_file_rollback_conflict",
            message: "The canonical Discovery File no longer matches the failed candidate.",
          }, { status: 409, headers: { "cache-control": "no-store" } });
        }
        const rolledBack: DiscoveryFileWriteRecord = {
          ...current,
          status: "committed",
          active: current.previous,
          previous: undefined,
          updatedAt: timestamp,
          committedAt: timestamp,
        };
        await storage.put(storageKey, rolledBack);
        const readback = await storage.get<DiscoveryFileWriteRecord>(storageKey);
        if (readback?.reservationId !== reservationId || readback.status !== "committed"
          || readback.active?.contentHash !== rolledBack.active?.contentHash) {
          throw new Error("discovery_file_rollback_readback_failed");
        }
        return json(responseBody(readback, { rolledBack: true }), { headers: { "cache-control": "no-store" } });
      });
    } catch {
      return json({
        ok: false,
        error: "discovery_file_operation_readback_failed",
        message: "The canonical Discovery File operation did not pass atomic storage readback.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }

  private async googleDriveOperationResponse(body: Record<string, unknown>): Promise<Response> {
    const action = stringValue(body.action);
    const operationHash = stringValue(body.operationHash).toLowerCase();
    const reservationId = stringValue(body.reservationId);
    if (!/^[a-f0-9]{64}$/.test(operationHash) || !reservationId || !["reserve", "release", "review"].includes(action)) {
      return json({
        ok: false,
        error: "google_drive_operation_invalid",
        message: "The Google Drive operation reservation is invalid.",
      }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    if (!this.storage.transaction) {
      return json({
        ok: false,
        error: "google_drive_operation_unavailable",
        message: "Atomic Google Drive delivery protection is unavailable.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    const storageKey = `google-drive-operation:${operationHash}`;
    try {
      return await this.storage.transaction(async (storage) => {
        const current = await storage.get<GoogleDriveOperationRecord>(storageKey);
        const timestamp = nowIso();
        if (action === "reserve") {
          const ageMs = current ? Date.now() - Date.parse(current.updatedAt || current.reservedAt) : Number.POSITIVE_INFINITY;
          const blocksRetry = current?.status === "reserved" || current?.status === "review_required";
          if (blocksRetry && Number.isFinite(ageMs) && ageMs <= GOOGLE_DRIVE_OPERATION_STALE_MS) {
            return json({
              ok: false,
              error: current.status === "review_required"
                ? "google_drive_operation_review_required"
                : "google_drive_operation_in_progress",
              retryAfterSeconds: Math.max(1, Math.ceil((GOOGLE_DRIVE_OPERATION_STALE_MS - ageMs) / 1000)),
              message: current.status === "review_required"
                ? "A prior Google Drive write has an uncertain cleanup result. HeirRight will not upload another copy until reconciliation is safe."
                : "This Google Drive write is already running. Wait for it to finish before trying again.",
            }, { status: 409, headers: { "cache-control": "no-store" } });
          }
          const record: GoogleDriveOperationRecord = {
            version: 1,
            operationHash,
            reservationId,
            status: "reserved",
            reservedAt: timestamp,
            updatedAt: timestamp,
          };
          await storage.put(storageKey, record);
          const readback = await storage.get<GoogleDriveOperationRecord>(storageKey);
          if (readback?.reservationId !== reservationId || readback.status !== "reserved") {
            throw new Error("google_drive_operation_reservation_readback_failed");
          }
          return json({
            ok: true,
            operationHash,
            reservationId,
            status: "reserved",
            recoveredStale: Boolean(blocksRetry),
            readbackStatus: "verified",
          }, { headers: { "cache-control": "no-store" } });
        }
        if (!current || current.reservationId !== reservationId) {
          return json({
            ok: false,
            error: "google_drive_operation_conflict",
            message: "The Google Drive operation no longer matches this request.",
          }, { status: 409, headers: { "cache-control": "no-store" } });
        }
        const targetStatus: GoogleDriveOperationStatus = action === "release" ? "released" : "review_required";
        if (current.status === targetStatus) {
          return json({
            ok: true,
            operationHash,
            reservationId,
            status: targetStatus,
            idempotent: true,
            readbackStatus: "verified",
          }, { headers: { "cache-control": "no-store" } });
        }
        if (current.status !== "reserved") {
          return json({
            ok: false,
            error: "google_drive_operation_conflict",
            message: "The Google Drive operation is already finalized.",
          }, { status: 409, headers: { "cache-control": "no-store" } });
        }
        const record: GoogleDriveOperationRecord = {
          ...current,
          status: targetStatus,
          updatedAt: timestamp,
          ...(targetStatus === "released" ? { releasedAt: timestamp } : { reviewRequiredAt: timestamp }),
        };
        await storage.put(storageKey, record);
        const readback = await storage.get<GoogleDriveOperationRecord>(storageKey);
        if (readback?.reservationId !== reservationId || readback.status !== targetStatus) {
          throw new Error("google_drive_operation_finalize_readback_failed");
        }
        return json({
          ok: true,
          operationHash,
          reservationId,
          status: targetStatus,
          readbackStatus: "verified",
        }, { headers: { "cache-control": "no-store" } });
      });
    } catch {
      return json({
        ok: false,
        error: "google_drive_operation_readback_failed",
        message: "The Google Drive operation did not pass atomic storage readback.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }

  private async canonicalIdiImportGuardResponse(body: Record<string, unknown>): Promise<Response> {
    const action = stringValue(body.action);
    const assetHash = stringValue(body.assetHash).toLowerCase();
    const reservationId = stringValue(body.reservationId);
    const contentHash = stringValue(body.contentHash).toLowerCase();
    const existingContentHash = stringValue(body.existingContentHash).toLowerCase();
    const rawOverrideReason = stringValue(body.overrideReason);
    const overrideReason = descriptivePaidRunOverride(rawOverrideReason);
    if (!/^[a-f0-9]{64}$/.test(assetHash) || (action !== "status" && !reservationId) || !["reserve", "commit", "abort", "status"].includes(action)
      || (contentHash && !/^[a-f0-9]{64}$/.test(contentHash))
      || (existingContentHash && !/^[a-f0-9]{64}$/.test(existingContentHash))) {
      return json({ ok: false, error: "idi_import_guard_invalid", message: "The canonical IDI import reservation is invalid." }, { status: 400 });
    }
    if (rawOverrideReason && !overrideReason) {
      return json({
        ok: false,
        error: "idi_import_override_reason_required",
        message: "Explain why this canonical IDI report must be replaced using at least two words and 12 characters.",
      }, { status: 422 });
    }
    if (!this.storage.transaction) {
      return json({ ok: false, error: "idi_import_guard_unavailable", message: "Atomic canonical IDI import storage is unavailable." }, { status: 503 });
    }
    const storageKey = `canonical-idi:${assetHash}`;
    try {
      return await this.storage.transaction(async (storage) => {
        let current = await storage.get<CanonicalIdiImportGuardRecord>(storageKey);
        const timestamp = nowIso();
        if (action === "status") {
          if (!current) return json({ ok: false, error: "idi_import_guard_not_found" }, { status: 404 });
          return json({
            ok: true,
            assetHash,
            reservationId: current.reservationId,
            status: current.status,
            contentHash: current.contentHash,
            readbackStatus: "verified",
          }, { headers: { "cache-control": "no-store" } });
        }
        if (action === "reserve") {
          if (!current && existingContentHash) {
            current = {
              version: 1,
              assetHash,
              reservationId: `migrated-${existingContentHash.slice(0, 24)}`,
              status: "committed",
              contentHash: existingContentHash,
              reservedAt: timestamp,
              updatedAt: timestamp,
              committedAt: timestamp,
            };
            await storage.put(storageKey, current);
          }
          if (current?.status === "reserved") {
            const ageMs = Date.now() - Date.parse(current.reservedAt);
            if (Number.isFinite(ageMs) && ageMs > 15 * 60 * 1000) {
              current = current.previous?.status === "committed" ? current.previous : undefined;
            } else {
              return json({
                ok: false,
                error: "idi_import_in_progress",
                message: "Another canonical IDI report write is already in progress for this estate. Reload before trying again.",
              }, { status: 409, headers: { "cache-control": "no-store" } });
            }
          }
          if (current?.status === "committed" && contentHash && current.contentHash === contentHash) {
            return json({
              ok: true,
              assetHash,
              reservationId: current.reservationId,
              contentHash,
              status: "committed",
              idempotent: true,
              readbackStatus: "verified",
            }, { headers: { "cache-control": "no-store" } });
          }
          if (current?.status === "committed" && !overrideReason) {
            return json({
              ok: false,
              error: "duplicate_idi_asset_search",
              message: "This estate already has a canonical IDI report. Record an administrator replacement reason before changing it.",
            }, { status: 409, headers: { "cache-control": "no-store" } });
          }
          const record: CanonicalIdiImportGuardRecord = {
            version: 1,
            assetHash,
            reservationId,
            status: "reserved",
            ...(contentHash ? { contentHash } : {}),
            reservedAt: timestamp,
            updatedAt: timestamp,
            ...(overrideReason ? { overrideReason } : {}),
            ...(current?.status === "committed" ? { previous: current } : {}),
          };
          await storage.put(storageKey, record);
          const readback = await storage.get<CanonicalIdiImportGuardRecord>(storageKey);
          if (readback?.reservationId !== reservationId || readback.status !== "reserved") throw new Error("idi_import_guard_readback_failed");
          return json({ ok: true, assetHash, reservationId, contentHash, status: "reserved", readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
        }
        if (!current || current.reservationId !== reservationId) {
          return json({ ok: false, error: "idi_import_reservation_conflict", message: "The canonical IDI import reservation no longer matches this write." }, { status: 409 });
        }
        if (action === "abort") {
          if (current.status === "committed") {
            return json({ ok: false, error: "idi_import_already_committed", message: "The canonical IDI import is already committed." }, { status: 409 });
          }
          const aborted: CanonicalIdiImportGuardRecord = current.previous?.status === "committed"
            ? current.previous
            : { ...current, status: "aborted", updatedAt: timestamp, abortedAt: timestamp, previous: undefined };
          await storage.put(storageKey, aborted);
          const readback = await storage.get<CanonicalIdiImportGuardRecord>(storageKey);
          if (readback?.reservationId !== aborted.reservationId || readback.status !== aborted.status) throw new Error("idi_import_guard_abort_readback_failed");
          return json({ ok: true, assetHash, reservationId, status: aborted.status, readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
        }
        if (!contentHash) {
          return json({ ok: false, error: "idi_import_content_hash_required", message: "Canonical IDI commit needs the verified report content hash." }, { status: 400 });
        }
        if (current.status === "committed") {
          const idempotent = current.contentHash === contentHash;
          return json({ ok: idempotent, assetHash, reservationId, status: current.status, idempotent, readbackStatus: idempotent ? "verified" : "failed" }, { status: idempotent ? 200 : 409 });
        }
        if (current.status !== "reserved" || (current.contentHash && current.contentHash !== contentHash)) {
          return json({ ok: false, error: "idi_import_reservation_conflict", message: "The canonical IDI content does not match its reservation." }, { status: 409 });
        }
        const committed: CanonicalIdiImportGuardRecord = {
          ...current,
          contentHash,
          status: "committed",
          updatedAt: timestamp,
          committedAt: timestamp,
          previous: undefined,
        };
        await storage.put(storageKey, committed);
        const readback = await storage.get<CanonicalIdiImportGuardRecord>(storageKey);
        if (readback?.reservationId !== reservationId || readback.status !== "committed" || readback.contentHash !== contentHash) {
          throw new Error("idi_import_guard_commit_readback_failed");
        }
        return json({ ok: true, assetHash, reservationId, contentHash, status: "committed", readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
      });
    } catch {
      return json({
        ok: false,
        error: "idi_import_guard_readback_failed",
        message: "The canonical IDI import lock did not pass atomic storage readback. Discovery remains blocked.",
      }, { status: 503 });
    }
  }

  private async paidIdiLockResponse(body: Record<string, unknown>): Promise<Response> {
    const action = stringValue(body.action);
    const lockHash = stringValue(body.lockHash).toLowerCase();
    const reservationId = stringValue(body.reservationId);
    const rawOverrideReason = stringValue(body.overrideReason);
    const overrideReason = descriptivePaidRunOverride(rawOverrideReason);
    if (!/^[a-f0-9]{64}$/.test(lockHash) || !reservationId || !["reserve", "complete", "review"].includes(action)) {
      return json({ ok: false, error: "idi_paid_run_lock_invalid", message: "The paid-search reservation request is invalid." }, { status: 400 });
    }
    if (rawOverrideReason && !overrideReason) {
      return json({
        ok: false,
        error: "idi_paid_run_override_reason_required",
        message: "Explain why another paid IDI search is necessary using at least two words and 12 characters.",
      }, { status: 422 });
    }
    if (!this.storage.transaction) {
      return json({ ok: false, error: "idi_paid_run_lock_unavailable", message: "Atomic paid-search duplicate protection is unavailable. No vendor request was sent." }, { status: 503 });
    }
    const storageKey = `paid-idi:${lockHash}`;
    try {
      return await this.storage.transaction(async (storage) => {
        const current = await storage.get<PaidIdiLockRecord>(storageKey);
        if (action === "reserve") {
          if (current && !overrideReason) {
            return json({
              ok: false,
              error: "duplicate_idi_paid_run",
              status: current.status,
              firstReservedAt: current.reservedAt,
              message: current.status === "completed"
                ? "This property already has a completed paid IDI search. An administrator must record why another lookup is necessary."
                : current.status === "review_required"
                  ? "The prior paid IDI request has an uncertain vendor outcome. An administrator must verify it and record why another lookup is necessary."
                  : "This property already has a paid IDI search reservation. An administrator must verify the vendor outcome before another lookup.",
            }, { status: 409, headers: { "cache-control": "no-store" } });
          }
          const timestamp = nowIso();
          const record: PaidIdiLockRecord = {
            version: 1,
            lockHash,
            reservationId,
            status: "reserved",
            reservedAt: timestamp,
            updatedAt: timestamp,
            ...(overrideReason ? { overrideReason } : {}),
            ...(current?.reservationId ? { previousReservationId: current.reservationId } : {}),
          };
          await storage.put(storageKey, record);
          const readback = await storage.get<PaidIdiLockRecord>(storageKey);
          if (readback?.reservationId !== reservationId || readback.status !== "reserved") {
            throw new Error("idi_paid_run_lock_readback_failed");
          }
          return json({ ok: true, lockHash, reservationId, status: "reserved", readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
        }
        if (!current || current.reservationId !== reservationId) {
          return json({
            ok: false,
            error: "idi_paid_run_reservation_conflict",
            message: "The paid-search result does not match the active reservation. Do not run the lookup again.",
          }, { status: 409 });
        }
        const targetStatus: PaidIdiLockStatus = action === "complete" ? "completed" : "review_required";
        if (current.status === targetStatus) {
          return json({ ok: true, lockHash, reservationId, status: targetStatus, idempotent: true, readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
        }
        if (current.status !== "reserved") {
          return json({ ok: false, error: "idi_paid_run_reservation_conflict", message: "The paid-search reservation is already finalized." }, { status: 409 });
        }
        const timestamp = nowIso();
        const record: PaidIdiLockRecord = {
          ...current,
          status: targetStatus,
          updatedAt: timestamp,
          ...(targetStatus === "completed" ? { completedAt: timestamp } : { reviewRequiredAt: timestamp }),
        };
        await storage.put(storageKey, record);
        const readback = await storage.get<PaidIdiLockRecord>(storageKey);
        if (readback?.reservationId !== reservationId || readback.status !== targetStatus) {
          throw new Error("idi_paid_run_lock_readback_failed");
        }
        return json({ ok: true, lockHash, reservationId, status: targetStatus, readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
      });
    } catch {
      return json({
        ok: false,
        error: "idi_paid_run_lock_readback_failed",
        message: "The paid-search lock did not pass atomic storage readback. Do not send another vendor request until an administrator reviews it.",
      }, { status: 503 });
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = request.method === "POST"
      ? await request.json().catch(() => ({})) as Record<string, unknown>
      : {};
    if (url.pathname === "/paid-idi-lock") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      return this.paidIdiLockResponse(body);
    }
    if (url.pathname === "/idi-import-lock") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      return this.canonicalIdiImportGuardResponse(body);
    }
    if (url.pathname === "/google-drive-operation") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      return this.googleDriveOperationResponse(body);
    }
    if (url.pathname === "/packet-approval-operation") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      return this.packetApprovalOperationResponse(body);
    }
    if (url.pathname === "/discovery-file-operation") {
      if (request.method !== "POST") return methodNotAllowed("POST");
      return this.discoveryFileOperationResponse(body);
    }
    const key = stringValue(url.searchParams.get("key") || body.key);
    if (!sharedWorkspaceStateKeys.has(key)) {
      return json({ ok: false, error: "workspace_state_key_not_allowed", message: "This workspace setting cannot be shared." }, { status: 400 });
    }
    if (request.method === "GET") {
      const record = await this.storage.get<Record<string, unknown>>(`state:${key}`);
      return json({ ok: true, key, value: record?.value ?? null, revision: record?.revision ?? 0, updatedAt: record?.updatedAt ?? null }, { headers: { "cache-control": "no-store" } });
    }
    if (request.method === "POST") {
      const suppliedValue = typeof body.value === "string" ? body.value : "";
      const expectedRevision = Number(body.expectedRevision);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
        return json({ ok: false, error: "workspace_revision_required", message: "Reload the latest team version before saving this workspace update." }, { status: 428 });
      }
      if (new TextEncoder().encode(suppliedValue).byteLength > 750_000) {
        return json({ ok: false, error: "workspace_state_too_large", message: "This workspace update is too large to save." }, { status: 413 });
      }
      let sanitized: ReturnType<typeof sanitizedSharedWorkspaceValue>;
      try { sanitized = sanitizedSharedWorkspaceValue(key, suppliedValue); }
      catch { return json({ ok: false, error: "workspace_state_invalid", message: "This workspace update is not valid structured data." }, { status: 400 }); }
      const value = sanitized.value;
      const previous = await this.storage.get<Record<string, unknown>>(`state:${key}`);
      const currentRevision = Number(previous?.revision || 0);
      if (expectedRevision !== currentRevision) {
        return json({
          ok: false,
          error: "workspace_state_conflict",
          message: "A teammate saved a newer version. HeirRight will reload it instead of overwriting their work.",
          currentRevision,
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      const revision = currentRevision + 1;
      const updatedAt = nowIso();
      await this.storage.put(`state:${key}`, { value, revision, updatedAt });
      const readback = await this.storage.get<Record<string, unknown>>(`state:${key}`);
      if (readback?.revision !== revision || readback?.value !== value) {
        return json({ ok: false, error: "workspace_state_readback_failed", message: "The workspace update did not pass storage readback." }, { status: 503 });
      }
      return json({
        ok: true,
        key,
        revision,
        updatedAt,
        readbackStatus: "verified",
        ...(sanitized.strippedPacketApprovals ? { strippedPacketApprovals: true } : {}),
      }, { headers: { "cache-control": "no-store" } });
    }
    return methodNotAllowed("GET, POST");
  }
}

async function workspaceStateResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (!env.WORKSPACE_STATE) {
    return json({ ok: false, error: "workspace_state_unavailable", message: "Shared workspace storage is unavailable." }, { status: 503 });
  }
  const id = env.WORKSPACE_STATE.idFromName("heirright-team-workspace");
  const stub = env.WORKSPACE_STATE.get(id);
  return stub.fetch(new Request(`https://workspace-state.internal${url.pathname}${url.search}`, request));
}

async function storePacketArtifact(
  model: PacketModel,
  env: CloudflareEnv,
  binding: {
    estateIds?: string[];
    flow?: "controlled-test" | "discovery" | "closing-docs";
    packetRevision?: number;
    documentId?: DiscoveryDocumentId;
    documentTitle?: string;
    parentArtifactId?: string;
  } = {},
): Promise<StoredPacketArtifact> {
  if (!env.PACKET_ARTIFACTS) throw new Error("packet_artifact_store_not_configured");
  const serializedModel = JSON.stringify(model);
  const contentHash = await sha256Hex(serializedModel);
  const id = `packet-${Date.now()}-${contentHash.slice(0, 16)}`;
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();
  const estateIds = Array.from(new Set((binding.estateIds || []).map(stringValue).filter(Boolean)));
  const packetRevision = Number(binding.packetRevision);
  const artifact: StoredPacketArtifact = {
    id,
    createdAt,
    expiresAt,
    contentHash,
    model,
    ...(estateIds.length ? { estateIds } : {}),
    ...(binding.flow ? { flow: binding.flow } : {}),
    ...(Number.isInteger(packetRevision) && packetRevision > 0 ? { packetRevision } : {}),
    ...(binding.documentId ? { documentId: binding.documentId } : {}),
    ...(binding.documentTitle ? { documentTitle: binding.documentTitle } : {}),
    ...(binding.parentArtifactId ? { parentArtifactId: binding.parentArtifactId } : {}),
  };
  await env.PACKET_ARTIFACTS.put(packetArtifactKey(id), JSON.stringify(artifact), {
    expirationTtl: 7 * 24 * 60 * 60,
    metadata: {
      flow: binding.flow || model.flow,
      estateIds: estateIds.length ? estateIds : model.estateIds,
      contentHash,
      packetRevision: artifact.packetRevision,
      documentId: artifact.documentId,
      parentArtifactId: artifact.parentArtifactId,
    },
  });
  return artifact;
}

async function persistPacketArtifactReferences(
  env: CloudflareEnv,
  estateIds: string[],
  artifact: StoredPacketArtifact,
  documentArtifacts: StoredDocumentPacketArtifact[] = [],
): Promise<Array<{ estateId: string; stored: boolean; readbackStatus: string }>> {
  if (!env.PACKET_ARTIFACTS) return estateIds.map((estateId) => ({ estateId, stored: false, readbackStatus: "storage_unavailable" }));
  return Promise.all(estateIds.map(async (estateId) => {
    const canonical = await loadCanonicalDiscoveryFile(env, estateId);
    if (!canonical.record) return { estateId, stored: false, readbackStatus: canonical.readbackStatus };
    const record = canonical.record;
    const references = Array.isArray(record.packetArtifacts) ? record.packetArtifacts as Array<Record<string, unknown>> : [];
    const reference = {
      artifactId: artifact.id,
      artifactUrl: `/api/reports/pdf?artifactId=${encodeURIComponent(artifact.id)}`,
      flow: artifact.model.flow,
      packetRevision: artifact.packetRevision,
      estateIds: artifact.estateIds || artifact.model.estateIds,
      contentType: "application/pdf",
      contentHash: artifact.contentHash,
      sections: artifact.model.sections,
      documentArtifacts: documentArtifacts.map((document) => ({
        documentId: document.documentId,
        title: document.title,
        sectionIds: document.sectionIds,
        artifactId: document.artifact.id,
        artifactUrl: `/api/reports/pdf?artifactId=${encodeURIComponent(document.artifact.id)}`,
        contentType: "application/pdf",
        contentHash: document.artifact.contentHash,
        createdAt: document.artifact.createdAt,
        expiresAt: document.artifact.expiresAt,
        readbackStatus: "verified",
      })),
      createdAt: artifact.createdAt,
      expiresAt: artifact.expiresAt,
      readbackStatus: "verified",
    };
    const updated = {
      ...record,
      packetArtifacts: [reference, ...references.filter((item) => item.artifactId !== artifact.id)].slice(0, 25),
    };
    const persistence = await persistDiscoveryFile(env, updated);
    return {
      estateId,
      stored: persistence.stored === true,
      readbackStatus: persistence.readbackStatus === "verified" ? "verified" : stringValue(persistence.readbackStatus) || "failed",
    };
  }));
}

async function packetArtifactResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  if (!env.PACKET_ARTIFACTS) {
    return json({ ok: false, error: "packet_artifact_store_not_configured", message: "Packet storage is not configured." }, { status: 503 });
  }
  const artifactId = stringValue(url.searchParams.get("artifactId"));
  if (!/^packet-[0-9]+-[a-f0-9]{16}$/.test(artifactId)) {
    return json({ ok: false, error: "invalid_artifact_id", message: "A valid packet artifact ID is required." }, { status: 400 });
  }
  const stored = await env.PACKET_ARTIFACTS.get(packetArtifactKey(artifactId));
  if (!stored) return json({ ok: false, error: "artifact_not_found", message: "This packet is unavailable or has expired." }, { status: 404 });
  const artifact = JSON.parse(stored) as StoredPacketArtifact;
  const currentHash = await sha256Hex(JSON.stringify(artifact.model));
  if (currentHash !== artifact.contentHash) {
    return json({ ok: false, error: "artifact_integrity_failed", message: "Packet integrity validation failed." }, { status: 409 });
  }
  const pdf = await renderPacketPdf(artifact.model);
  const filename = `${artifact.documentId || (artifact.model.flow === "closing-docs" ? "closing-prep" : "discovery-prep")}-${artifact.id}.pdf`;
  return new Response(byteArrayBuffer(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, no-store",
      "x-heirright-artifact-id": artifact.id,
      "x-heirright-content-hash": artifact.contentHash,
    },
  });
}

async function exportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  const dryRun = url.searchParams.get("dry-run") !== "false";
  const routesParam = url.searchParams.get("routes");
  const routes = routesParam
    ? routesParam.split(",").map((route) => route.trim()).filter((route): route is "google" | "podio" => route === "google" || route === "podio")
    : ["google", "podio"] as Array<"google" | "podio">;
  const body = await request.json().catch(() => undefined) as {
    seed?: IntakeSeed;
    seeds?: IntakeSeed[];
    dossier?: RawDossier;
    dossiers?: RawDossier[];
    routes?: Array<"google" | "podio">;
    dryRun?: boolean;
    controlledTest?: boolean;
    flow?: string;
    docPrepFlow?: string;
    batch?: boolean;
    estateId?: string;
    estateIds?: string[];
    leadId?: string;
    packetRevision?: number;
    operatorIntent?: string;
    selectedClosingTemplateIds?: string[];
    selectedClosingTemplateIdsByEstate?: Record<string, string[]>;
    closingFieldValues?: Record<string, ClosingFieldInput>;
    closingFieldValuesByEstate?: Record<string, Record<string, ClosingFieldInput>>;
    closingPacketOptions?: ClosingPacketOptions;
  } | undefined;
  if ((body?.controlledTest !== undefined && typeof body.controlledTest !== "boolean")
    || (body?.dryRun !== undefined && typeof body.dryRun !== "boolean")) {
    return json({
      ok: false,
      error: "export_request_invalid",
      message: "Export control flags must be explicit booleans.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const requestedRoutes = Array.isArray(body?.routes) ? body.routes : routes;
  const effectiveDryRun = body?.dryRun === undefined ? dryRun : body.dryRun;
  if (requestedRoutes.includes("google") && effectiveDryRun === false) {
    return json({
      ok: false,
      status: "blocked",
      error: "google_handoff_requires_packet_approval",
      blockers: ["Live Google Drive delivery requires the current verified packet's dedicated operator approval and server-attested readback."],
      message: "Generate the packet without a live route, approve its current revision, then use the Google Workspace handoff action.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!body?.controlledTest && body?.operatorIntent !== "generate_packet") {
    return json({ ok: false, error: "operator_intent_required", message: "Confirm packet generation before exporting." }, { status: 400 });
  }
  const seeds = body?.controlledTest
    ? [buildControlledPodioTestSeed(env as Record<string, string | undefined>)]
    : Array.isArray(body?.seeds) && body.seeds.length
      ? body.seeds
      : [body?.seed ?? seedFromUrl(url, env)];
  const suppliedDossiers = Array.isArray(body?.dossiers) && body.dossiers.length
    ? body.dossiers
    : body?.dossier ? [body.dossier] : [];
  const pipelines = suppliedDossiers.length
    ? []
    : await Promise.all(seeds.map((seed) => runDryPipeline(seed, { env: env as Record<string, string | undefined> })));
  const dossiers = suppliedDossiers.length ? suppliedDossiers : pipelines.map((pipeline) => pipeline.dossier);
  const primaryDossier = dossiers[0];
  if (!primaryDossier) return json({ ok: false, error: "missing_dossier", message: "Packet export needs at least one estate dossier." }, { status: 400 });
  const flow = normalizedExportFlow(body);
  const packetRevision = Number(body?.packetRevision);
  if (!body?.controlledTest && dossiers.length === 1 && (!Number.isInteger(packetRevision) || packetRevision < 1)) {
    return json({
      ok: false,
      error: "packet_revision_required",
      message: "Packet generation needs the exact next estate workflow revision before an artifact can be stored.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const requestedEstateIds = Array.from(new Set([
    ...(Array.isArray(body?.estateIds) ? body.estateIds.map(stringValue) : []),
    stringValue(body?.estateId),
  ].filter(Boolean)));
  if (!body?.controlledTest && (requestedEstateIds.length !== dossiers.length || requestedEstateIds.some((estateId) => estateId.length > 500))) {
    return json({
      ok: false,
      error: "exact_estate_identity_required",
      message: "Packet generation needs one exact stable estate ID for every dossier. Address fingerprints cannot identify estate records.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const responseEstateIds = requestedEstateIds.length ? requestedEstateIds : dossiers.map((dossier) => dossier.id);
  const packetDossiers = dossiers.map((dossier, index) => ({ ...dossier, id: responseEstateIds[index] || dossier.id }));
  if (!body?.controlledTest) {
    for (let index = 0; index < packetDossiers.length; index += 1) {
      const estateId = responseEstateIds[index];
      const stopCheck = await canonicalEstateStopCheck(env, estateId, { dossier: packetDossiers[index] });
      if (!["verified", "verified_recovered_previous", "not_available"].includes(stopCheck.readbackStatus)) {
        return canonicalEstateReadbackFailure("Packet generation", stopCheck.readbackStatus);
      }
      if (stopCheck.reasons.length) return canonicalStopJson(stopCheck.reasons, "Packet generation");
    }
  }
  const closingPacketOptions: ClosingPacketOptions = body?.closingPacketOptions ?? {
    default: {
      selectedTemplateIds: body?.selectedClosingTemplateIds,
      fields: body?.closingFieldValues,
    },
    byEstate: Object.fromEntries(packetDossiers.map((dossier) => [dossier.id, {
      selectedTemplateIds: body?.selectedClosingTemplateIdsByEstate?.[dossier.id] ?? body?.selectedClosingTemplateIds,
      fields: body?.closingFieldValuesByEstate?.[dossier.id] ?? body?.closingFieldValues,
    }])),
  };
  const model = flow === "closing-docs"
    ? buildClosingPacketModel(packetDossiers, closingPacketOptions)
    : buildDiscoveryPacketModel(packetDossiers);
  const expectedModelFlow = flow === "closing-docs" ? "closing-docs" : "discovery";
  if (model.flow !== expectedModelFlow || model.estateIds.length !== responseEstateIds.length
    || model.estateIds.some((estateId, index) => estateId !== responseEstateIds[index])) {
    return json({
      ok: false,
      error: "packet_estate_identity_mismatch",
      blockers: ["The packet model did not bind to the exact selected estate IDs and workflow."],
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const packetBlockers = validatePacketModel(model);
  if (packetBlockers.length) {
    return json({
      ok: false,
      status: "blocked",
      flow,
      estateIds: model.estateIds,
      sections: model.sections,
      blockers: packetBlockers,
    }, { status: 422, headers: { "cache-control": "no-store" } });
  }
  const discoveryDocumentModels = flow === "discovery" ? buildDiscoveryDocumentModels(model) : [];
  try {
    await renderPacketPdf(model);
    for (const document of discoveryDocumentModels) await renderPacketPdf(document.model);
  } catch (error) {
      const message = error instanceof Error ? error.message : `${flow}_packet_render_failed`;
      const overflowField = message.startsWith("closing_field_overflow:")
        ? message.split(":")[1]?.replace(/_/g, " ")
        : "";
      return json({
        ok: false,
        status: "blocked",
        flow,
        estateIds: model.estateIds,
        sections: model.sections,
        error: message,
        blockers: [overflowField
          ? `${overflowField} does not fit its approved template blank. Shorten or correct the value before export.`
          : flow === "closing-docs"
            ? "The immutable Closing template failed its integrity or layout check. Export was not stored or delivered."
            : "The Discovery packet or one of its separated document copies failed deterministic PDF rendering. Export was not stored or delivered."],
      }, { status: 422, headers: { "cache-control": "no-store" } });
  }
  let artifact: StoredPacketArtifact;
  let documentArtifacts: StoredDocumentPacketArtifact[] = [];
  try {
    artifact = await storePacketArtifact(model, env, {
      estateIds: responseEstateIds,
      flow,
      ...(Number.isInteger(packetRevision) && packetRevision > 0 ? { packetRevision } : {}),
    });
    if (flow === "discovery") {
      documentArtifacts = [];
      for (const document of discoveryDocumentModels) {
        documentArtifacts.push({
          documentId: document.documentId,
          title: document.title,
          sectionIds: document.sectionIds,
          artifact: await storePacketArtifact(document.model, env, {
            estateIds: responseEstateIds,
            flow,
            ...(Number.isInteger(packetRevision) && packetRevision > 0 ? { packetRevision } : {}),
            documentId: document.documentId,
            documentTitle: document.title,
            parentArtifactId: artifact.id,
          }),
        });
      }
    }
  } catch (error) {
    for (const stored of [artifact!, ...documentArtifacts.map((document) => document.artifact)].filter(Boolean)) {
      try {
        await env.PACKET_ARTIFACTS?.delete(packetArtifactKey(stored.id));
      } catch {
        // The blocked response below remains authoritative; cleanup is best effort.
      }
    }
    const message = error instanceof Error ? error.message : "packet_artifact_store_not_configured";
    return json({ ok: false, status: "blocked", flow, error: message, blockers: ["Durable packet storage is not configured."] }, { status: 503 });
  }
  const packetPersistence = await persistPacketArtifactReferences(env, responseEstateIds, artifact, documentArtifacts);
  const explicitPersistenceFailed = requestedEstateIds.length > 0
    && packetPersistence.some((item) => item.readbackStatus !== "verified");
  if (explicitPersistenceFailed) {
    let cleanupReadbackStatus = "unavailable";
    try {
      const cleanupArtifacts = [artifact, ...documentArtifacts.map((document) => document.artifact)];
      await Promise.all(cleanupArtifacts.map((stored) => env.PACKET_ARTIFACTS?.delete(packetArtifactKey(stored.id))));
      const cleanupReadbacks = await Promise.all(cleanupArtifacts.map((stored) => env.PACKET_ARTIFACTS?.get(packetArtifactKey(stored.id))));
      cleanupReadbackStatus = cleanupReadbacks.every((value) => value === null) ? "verified" : "failed";
    } catch {
      cleanupReadbackStatus = "failed";
    }
    return json({
      ok: false,
      status: "blocked",
      flow,
      error: "packet_discovery_file_persistence_failed",
      packetPersistence,
      cleanup: { artifactId: artifact.id, deleteReadbackStatus: cleanupReadbackStatus },
      blockers: ["The packet was not attached to every selected estate through verified canonical readback."],
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const result = requestedRoutes.length
    ? await exportCompletedReport({
      routes: requestedRoutes,
      dossier: primaryDossier,
      dryRun: effectiveDryRun,
      controlledTest: body?.controlledTest,
    }, env as Record<string, string | undefined>)
    : {
      ok: true,
      generatedAt: nowIso(),
      dossierId: primaryDossier.id,
      routes: [],
      blockers: [],
    };
  return json({
    ok: true,
    status: "packet_ready",
    flow,
    packetRevision: artifact.packetRevision,
    estateId: responseEstateIds.length === 1 ? responseEstateIds[0] : undefined,
    estateIds: responseEstateIds,
    sections: model.sections,
    contentType: "application/pdf",
    artifactUrl: `/api/reports/pdf?artifactId=${encodeURIComponent(artifact.id)}`,
    blockers: [],
    routes: result.routes,
    readback: result.routes,
    packetPersistence,
    documentArtifacts: documentArtifacts.map((document) => ({
      documentId: document.documentId,
      title: document.title,
      sectionIds: document.sectionIds,
      artifactId: document.artifact.id,
      artifactUrl: `/api/reports/pdf?artifactId=${encodeURIComponent(document.artifact.id)}`,
      contentType: "application/pdf",
      contentHash: document.artifact.contentHash,
      expiresAt: document.artifact.expiresAt,
      readbackStatus: "verified",
    })),
    delivery: result,
    artifact: {
      kind: "single_pdf",
      contentType: "application/pdf",
      flow,
      packetRevision: artifact.packetRevision,
      artifactId: artifact.id,
      estateId: responseEstateIds.length === 1 ? responseEstateIds[0] : undefined,
      estateIds: responseEstateIds,
      url: `/api/reports/pdf?artifactId=${encodeURIComponent(artifact.id)}`,
      sections: model.sections,
      contentHash: artifact.contentHash,
      expiresAt: artifact.expiresAt,
    },
  }, { headers: { "cache-control": "no-store" } });
}

function parseIdiUploadExtraction(value: unknown): IdiUploadExtraction | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const method = stringValue(input.method);
  const fileKind = stringValue(input.fileKind);
  const text = stringValue(input.text);
  const sourceLocators = Array.isArray(input.sourceLocators)
    ? input.sourceLocators
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      .slice(0, 256)
      .map((item, index) => ({
        kind: ["page", "row", "paragraph", "ocr", "text"].includes(stringValue(item.kind))
          ? stringValue(item.kind) as IdiUploadExtraction["sourceLocators"][number]["kind"]
          : "text" as const,
        index: Math.max(1, Math.min(100_000, Number(item.index) || index + 1)),
        label: stringValue(item.label).slice(0, 160) || `Report section ${index + 1}`,
        text: stringValue(item.text).slice(0, 80_000),
      }))
    : [];
  if (!text || text.length > 250_000 || !["pdf_text", "docx_text", "csv_rows", "google_drive_ocr", "operator_paste"].includes(method)
    || !["pdf", "docx", "csv", "image", "text"].includes(fileKind)) return null;
  return {
    status: "extracted",
    method: method as IdiUploadExtraction["method"],
    fileKind: fileKind as IdiUploadExtraction["fileKind"],
    text,
    sourceLocators,
    extractedAt: stringValue(input.extractedAt) || nowIso(),
  };
}

function paidIdiCandidateStrings(value: unknown, maxItems: number, maxLength: number): string[] {
  return Array.isArray(value)
    ? value.map(stringValue).filter(Boolean).slice(0, maxItems).map((item) => item.slice(0, maxLength))
    : [];
}

function paidIdiStoredCandidates(
  data: Record<string, unknown>,
  assetKey: string,
  ownerName: string,
): StoredIdiImport["candidates"] {
  const supplied = Array.isArray(data.candidates) ? data.candidates : Array.isArray(data.contactCandidates) ? data.contactCandidates : [];
  if (supplied.length) {
    return supplied.slice(0, 256).map((candidateValue, index) => {
      const candidate = objectValue(candidateValue);
      const name = (stringValue(candidate.name) || `Imported contact ${index + 1}`).slice(0, 160);
      const relationship = (stringValue(candidate.relationship) || "relative").slice(0, 80);
      const group = candidate.group === "primary" || candidate.group === "alternative"
        ? candidate.group
        : /^(spouse|wife|husband|child|children|son|daughter)$/i.test(relationship) ? "primary" : "alternative";
      const addresses = paidIdiCandidateStrings(candidate.addressHistory, 25, 240);
      const addressHistoryDetails = Array.isArray(candidate.addressHistoryDetails)
        ? candidate.addressHistoryDetails.slice(0, 25).flatMap((value) => {
          const item = objectValue(value);
          const address = stringValue(item.address).slice(0, 240);
          if (!address) return [];
          const county = stringValue(item.county).slice(0, 120);
          const dates = stringValue(item.dates).slice(0, 80);
          return [{ address, ...(county ? { county } : {}), ...(dates ? { dates } : {}) }];
        })
        : addresses.map((address) => ({ address }));
      const currentAddress = (stringValue(candidate.currentAddress) || addresses[0] || "").slice(0, 240);
      const rawConfidence = Number(candidate.confidence);
      const confidence = Number.isFinite(rawConfidence)
        ? Math.max(0, Math.min(100, rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence))
        : group === "primary" ? 70 : 50;
      return {
        id: `${assetKey}:idi:${index + 1}`,
        name,
        relationship,
        ...(Number.isInteger(Number(candidate.age)) && Number(candidate.age) > 0 && Number(candidate.age) < 125
          ? { age: Number(candidate.age) }
          : {}),
        ...(stringValue(candidate.interest) ? { interest: stringValue(candidate.interest).slice(0, 80) } : {}),
        group,
        phones: paidIdiCandidateStrings(candidate.phones, 20, 40),
        emails: paidIdiCandidateStrings(candidate.emails, 20, 254),
        currentAddress,
        addressHistory: addresses,
        addressHistoryDetails,
        ownerLastNameMatch: Boolean(ownerLastName(ownerName) && ownerLastName(name) === ownerLastName(ownerName)),
        confidence,
        confidenceReason: "Validated IDI Core provider result; operator contact review is still required",
        reviewStatus: "needs_review" as const,
        sourceLocator: { kind: "text" as const, index: index + 1, label: `IDI Core result ${index + 1}` },
      };
    });
  }
  const importedText = stringValue(data.importedText || data.reportText).slice(0, 250_000);
  if (!importedText) return [];
  const extraction: IdiUploadExtraction = {
    status: "extracted",
    method: "operator_paste",
    fileKind: "text",
    text: importedText,
    sourceLocators: [{ kind: "text", index: 1, label: "IDI Core provider result", text: importedText }],
    extractedAt: nowIso(),
  };
  return buildIdiUploadCandidates({ assetKey, ownerName, extraction }).map((candidate) => ({
    ...candidate,
    reviewStatus: "needs_review" as const,
    confidenceReason: `${candidate.confidenceReason}; operator contact review is still required`,
  }));
}

async function paidIdiStoredRecord(
  body: Record<string, unknown>,
  data: Record<string, unknown>,
  lockKey: string,
): Promise<StoredIdiImport | null> {
  const assetKey = stringValue(body.assetKey);
  if (!assetKey) return null;
  const importedAt = nowIso();
  const ownerName = stringValue(body.ownerName || body.estateName);
  const candidates = paidIdiStoredCandidates(data, assetKey, ownerName);
  const importedText = stringValue(data.importedText || data.reportText).slice(0, 250_000);
  const integrityPayload = JSON.stringify({
    runId: stringValue(data.runId),
    receiptId: stringValue(data.receiptId),
    readbackStatus: stringValue(data.readbackStatus),
    candidates,
    importedText,
  });
  const contentHash = await sha256Hex(integrityPayload);
  const extraction: IdiUploadExtraction = {
    status: "extracted",
    method: "operator_paste",
    fileKind: "text",
    text: importedText || JSON.stringify(candidates),
    sourceLocators: [{ kind: "text", index: 1, label: "IDI Core provider result" }],
    extractedAt: importedAt,
  };
  return {
    version: 1,
    revision: crypto.randomUUID(),
    assetKey,
    leadId: assetKey,
    provider: "idi",
    mode: "live_idi_core",
    lockKey,
    importedAt,
    importedBy: "approved HeirRight paid run",
    attachment: {
      id: `paid-idi-${Date.now()}-${contentHash.slice(0, 16)}`,
      estateId: assetKey,
      documentId: "idi-asset-search",
      fileName: "IDI Core result",
      contentType: "application/json",
      size: new TextEncoder().encode(integrityPayload).byteLength,
      contentHash,
      createdAt: importedAt,
      artifactUrl: `/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(assetKey)}`,
      readbackStatus: "verified",
    },
    extraction: safeIdiExtractionMetadata(extraction),
    candidates,
    contactPreviewCount: candidates.length,
    importVerification: "pending_guard_commit",
    paidRun: true,
    paidRunVerification: "pending_lock_completion",
    duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_paid_run_only",
    adminOverrideReason: stringValue(body.adminOverrideReason) || null,
  };
}

async function persistStoredIdiImportAtKey(
  env: CloudflareEnv,
  key: string,
  record: StoredIdiImport,
  kind: "idi_import" | "idi_import_stage",
): Promise<StoredIdiImport | null> {
  if (!env.PACKET_ARTIFACTS) return null;
  try {
    await env.PACKET_ARTIFACTS.put(key, JSON.stringify(record), {
      expirationTtl: documentRetentionSeconds(env),
      metadata: { kind, contentHash: record.attachment.contentHash, attachmentId: record.attachment.id },
    });
    const readback = storedIdiImport(await env.PACKET_ARTIFACTS.get(key));
    return readback?.assetKey === record.assetKey
      && readback.attachment.contentHash === record.attachment.contentHash
      && readback.revision === record.revision
      && readback.importVerification === record.importVerification
      && readback.paidRunVerification === record.paidRunVerification
      ? readback
      : null;
  } catch {
    return null;
  }
}

async function persistStoredIdiImport(env: CloudflareEnv, record: StoredIdiImport): Promise<StoredIdiImport | null> {
  return persistStoredIdiImportAtKey(env, await idiImportKey(record.assetKey), record, "idi_import");
}

async function persistStagedIdiImport(env: CloudflareEnv, record: StoredIdiImport): Promise<StoredIdiImport | null> {
  return persistStoredIdiImportAtKey(
    env,
    await idiImportStageKey(record.assetKey),
    record,
    "idi_import_stage",
  );
}

async function loadStagedIdiImport(env: CloudflareEnv, assetKey: string): Promise<StoredIdiImport | null> {
  if (!env.PACKET_ARTIFACTS) return null;
  return storedIdiImport(await env.PACKET_ARTIFACTS.get(await idiImportStageKey(assetKey)));
}

async function deleteStagedIdiImport(env: CloudflareEnv, assetKey: string): Promise<boolean> {
  if (!env.PACKET_ARTIFACTS) return false;
  const key = await idiImportStageKey(assetKey);
  try {
    await env.PACKET_ARTIFACTS.delete(key);
    return !await env.PACKET_ARTIFACTS.get(key);
  } catch {
    return false;
  }
}

async function recoverCommittedStagedIdiImport(
  env: CloudflareEnv,
  assetKey: string,
): Promise<{ record: StoredIdiImport | null; error?: "idi_import_stage_cleanup_failed" | "idi_import_verification_readback_failed" | "idi_import_guard_readback_failed" }> {
  if (!env.PACKET_ARTIFACTS) return { record: null };
  const canonical = storedIdiImport(await env.PACKET_ARTIFACTS.get(await idiImportKey(assetKey)));
  const staged = await loadStagedIdiImport(env, assetKey);
  if (!staged) return { record: storedIdiImportIsCanonical(canonical) ? canonical : null };
  if (storedIdiImportIsCanonical(canonical) && canonical?.attachment.contentHash === staged.attachment.contentHash) {
    return await deleteStagedIdiImport(env, assetKey)
      ? { record: canonical }
      : { record: canonical, error: "idi_import_stage_cleanup_failed" };
  }
  const guardResult = await canonicalIdiImportStatus(env, assetKey);
  if (!guardResult.ok) {
    if (guardResult.status === 404) {
      return await deleteStagedIdiImport(env, assetKey)
        ? { record: storedIdiImportIsCanonical(canonical) ? canonical : null }
        : { record: storedIdiImportIsCanonical(canonical) ? canonical : null, error: "idi_import_stage_cleanup_failed" };
    }
    return { record: null, error: "idi_import_guard_readback_failed" };
  }
  const guard = guardResult.data;
  if (guard.status === "aborted") {
    return await deleteStagedIdiImport(env, assetKey)
      ? { record: storedIdiImportIsCanonical(canonical) ? canonical : null }
      : { record: storedIdiImportIsCanonical(canonical) ? canonical : null, error: "idi_import_stage_cleanup_failed" };
  }
  if (guard.status === "reserved") {
    return { record: storedIdiImportIsCanonical(canonical) ? canonical : null };
  }
  if (guard.status !== "committed" || stringValue(guard.contentHash) !== staged.attachment.contentHash) {
    return { record: null, error: "idi_import_guard_readback_failed" };
  }
  const recoveryCandidate: StoredIdiImport = {
    ...staged,
    revision: crypto.randomUUID(),
    importVerification: "verified",
  };
  if (!storedIdiImportIsCanonical(recoveryCandidate)) {
    return { record: storedIdiImportIsCanonical(canonical) ? canonical : null, error: "idi_import_verification_readback_failed" };
  }
  const recovered = await persistStoredIdiImport(env, recoveryCandidate);
  if (!recovered) return { record: storedIdiImportIsCanonical(canonical) ? canonical : null, error: "idi_import_verification_readback_failed" };
  if (!await deleteStagedIdiImport(env, assetKey)) return { record: recovered, error: "idi_import_stage_cleanup_failed" };
  return { record: recovered };
}

async function matchingStagedIdiImportCleanupVerified(
  env: CloudflareEnv,
  record: StoredIdiImport,
): Promise<boolean> {
  const staged = await loadStagedIdiImport(env, record.assetKey);
  if (!staged || staged.attachment.contentHash !== record.attachment.contentHash) return true;
  return deleteStagedIdiImport(env, record.assetKey);
}

async function storedIdiImportResponse(
  record: StoredIdiImport,
  env: CloudflareEnv,
  options: { idempotent?: boolean; apiKeySource?: string } = {},
): Promise<Response> {
  const paidRunApproved = record.paidRun === true && record.paidRunVerification === "verified";
  const reviews = await storedIdiContactReviews(env, record);
  const candidates = record.candidates.map((candidate) => {
    const review = reviews.get(candidate.id);
    return review ? {
      ...candidate,
      reviewStatus: review.status,
      reviewedAt: review.reviewedAt,
      reviewedBy: review.reviewedBy,
    } : candidate;
  });
  return json({
    ok: true,
    mode: record.mode,
    provider: record.provider,
    lockKey: record.lockKey,
    importedAt: record.importedAt,
    importedBy: record.importedBy,
    duplicateGuard: record.duplicateGuard,
    adminOverrideReason: record.adminOverrideReason,
    attachment: record.attachment,
    extraction: record.extraction,
    subjectMatch: record.subjectMatch || null,
    candidates,
    contactReviews: Object.fromEntries([...reviews].map(([candidateId, review]) => [candidateId, {
      status: review.status,
      reviewedAt: review.reviewedAt,
      reviewedBy: review.reviewedBy,
    }])),
    contactPreviewCount: record.contactPreviewCount,
    importVerification: record.importVerification || "verified",
    paidRun: record.paidRun,
    paidRunApproved,
    paidRunVerification: record.paidRun
      ? record.paidRunVerification || "review_required"
      : "not_applicable",
    reviewRequired: record.paidRun && !paidRunApproved,
    readbackStatus: "verified",
    persistence: { stored: true, readbackStatus: "verified", assetKey: record.assetKey },
    ...(options.idempotent ? { idempotent: true } : {}),
    ...(options.apiKeySource ? { apiKeySource: options.apiKeySource } : {}),
    message: paidRunApproved
      ? "Live IDI Core completed, passed canonical storage readback, and is ready for contact review."
      : record.paidRun
        ? "The paid IDI result is stored, but duplicate-protection completion was not verified. Keep Discovery in review."
      : candidates.some((candidate) => candidate.reviewStatus === "auto_accepted_high_confidence" || candidate.reviewStatus === "accepted" || candidate.reviewStatus === "promoted")
      ? "IDI report extracted with source-located high-confidence contacts. Discovery can continue with the recorded review trail."
      : "IDI report extracted, but contact review is still required before Discovery can continue.",
  }, { headers: { "cache-control": "no-store" } });
}

async function idiAssetImportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (request.method === "GET") {
    const assetKey = stringValue(url.searchParams.get("assetKey"));
    if (!assetKey) return json({ ok: false, error: "asset_key_required", message: "Choose an estate before loading its imported IDI report." }, { status: 400 });
    const record = storedIdiImport(await env.PACKET_ARTIFACTS?.get(await idiImportKey(assetKey)));
    if (!record) return json({ ok: true, exists: false, assetKey, message: "No imported IDI report exists for this estate." }, { headers: { "cache-control": "no-store" } });
    if (!storedIdiImportIsCanonical(record)) {
      return json({
        ok: true,
        exists: true,
        assetKey,
        status: "review_required",
        importVerification: record.importVerification,
        paidRun: record.paidRun,
        paidRunApproved: false,
        reviewRequired: true,
        readbackStatus: "review_required",
        message: "This IDI report write did not complete canonical commit readback. Keep Discovery blocked.",
      }, { headers: { "cache-control": "no-store" } });
    }
    if (!await matchingStagedIdiImportCleanupVerified(env, record)) {
      return json({
        ok: false,
        error: "idi_import_stage_cleanup_failed",
        message: "The canonical IDI report is verified, but its temporary staging copy was not removed. Retry before continuing.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    return storedIdiImportResponse(record, env);
  }
  if (request.method !== "POST") return methodNotAllowed("GET, POST");
  if (!env.PACKET_ARTIFACTS) return json({ ok: false, error: "idi_import_store_unavailable", message: "IDI import storage is unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const wantsLiveRun = body.runMode === "live_idi_core" || body.mode === "live_idi_core" || body.paidRun === true;
  if ((wantsLiveRun || stringValue(body.adminOverrideReason)) && !internalBearerAuthorized(request, env)) {
    return json({
      ok: false,
      error: wantsLiveRun ? "paid_idi_intake_internal_only" : "idi_admin_override_internal_only",
      message: wantsLiveRun
        ? "Paid IDI searches must be approved in the signed HeirRight app."
        : "An IDI replacement must be approved by a HeirRight administrator.",
    }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const assetKey = stringValue(body.assetKey);
  if (!assetKey) return json({ ok: false, error: "asset_key_required", message: "Choose an estate before importing its IDI report." }, { status: 400 });
  const estateId = stringValue(body.estateId || body.leadId || body.assetKey);
  const leadId = stringValue(body.leadId || estateId);
  if (estateId !== assetKey || leadId !== assetKey) {
    return json({
      ok: false,
      error: "idi_estate_identity_mismatch",
      message: "The IDI report request does not match one exact estate record. Select the estate again before importing.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const importStopCheck = await canonicalEstateStopCheck(env, estateId, {
    seed: { ownerName: body.ownerName, propertyAddress: body.propertyAddress },
    capture: {
      propertyAppraiser: { ownerName: body.ownerName, propertyAddress: body.propertyAddress },
      deed: { lastSaleDate: body.lastSaleDate },
    },
  });
  if (!["verified", "verified_recovered_previous", "not_available"].includes(importStopCheck.readbackStatus)) {
    return canonicalEstateReadbackFailure("IDI report import", importStopCheck.readbackStatus);
  }
  if (importStopCheck.reasons.length) return canonicalStopJson(importStopCheck.reasons, "IDI report import");
  if (wantsLiveRun) return liveIdiCoreResponse(body, env);
  const mode = stringValue(body.mode) === "uploaded_file" ? "uploaded_file" : "operator_import";
  if (mode === "uploaded_file" && !internalBearerAuthorized(request, env)) {
    return json({ ok: false, error: "uploaded_intake_internal_only", message: "Uploaded report extraction must be started from the signed HeirRight app." }, { status: 403 });
  }
  const matchedEstateSubject = env.AUTH_REQUIRED === "false"
    ? localFixtureIdiSubject(body)
    : importStopCheck.authoritativeSubject;
  if (!matchedEstateSubject?.ownerName || !matchedEstateSubject.propertyAddress) {
    return json({
      ok: false,
      error: "idi_estate_subject_unverified",
      readbackStatus: "canonical_subject_incomplete",
      message: "IDI report import is blocked because the selected estate's verified owner and property address are incomplete.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const attachmentInput = body.attachment && typeof body.attachment === "object" ? body.attachment as Record<string, unknown> : {};
  const importedText = stringValue(body.importedText);
  let extraction: IdiUploadExtraction | null = null;
  let attachment: StoredIdiImport["attachment"] | null = null;
  if (mode === "uploaded_file") {
    const attachmentId = stringValue(attachmentInput.artifactId || attachmentInput.id);
    const source = await loadStoredSupportingDocument(env, attachmentId);
    if (!source || source.estateId !== assetKey || source.documentId !== "idi-asset-search") {
      return json({ ok: false, error: "idi_attachment_not_verified", message: "The uploaded IDI report did not pass artifact readback for this estate." }, { status: 409 });
    }
    if (stringValue(attachmentInput.contentHash) && stringValue(attachmentInput.contentHash) !== source.contentHash) {
      return json({ ok: false, error: "idi_attachment_hash_mismatch", message: "The uploaded IDI report changed before extraction. Choose it again." }, { status: 409 });
    }
    extraction = parseIdiUploadExtraction(body.extraction);
    if (!extraction) {
      return json({ ok: false, error: "idi_extraction_invalid", message: "The report could not be extracted safely. Keep Discovery blocked and review the original file." }, { status: 422 });
    }
    attachment = supportingDocumentMetadata(source);
  } else {
    if (!importedText) {
      return json({ ok: false, error: "missing_idi_report", message: "Paste the approved IDI Asset Discovery report text before importing." }, { status: 400 });
    }
    extraction = {
      status: "extracted",
      method: "operator_paste",
      fileKind: "text",
      text: importedText,
      sourceLocators: [{ kind: "text", index: 1, label: "Operator import", text: importedText }],
      extractedAt: nowIso(),
    };
    attachment = {
      id: stringValue(attachmentInput.artifactId) || receiptId("operator-idi-import"),
      estateId: assetKey,
      documentId: "idi-asset-search",
      fileName: stringValue(attachmentInput.fileName) || stringValue(attachmentInput.label) || "IDI operator import",
      contentType: "text/plain",
      size: importedText.length,
      contentHash: stringValue(attachmentInput.contentHash) || await sha256Hex(importedText),
      createdAt: nowIso(),
      artifactUrl: stringValue(attachmentInput.sourceUrl),
      readbackStatus: "verified",
    };
  }
  const subjectMatch = matchIdiReportSubject({
    extraction,
    ownerName: matchedEstateSubject.ownerName,
    propertyAddress: matchedEstateSubject.propertyAddress,
    parcelId: matchedEstateSubject.parcelId,
  });
  if (!subjectMatch.matched) {
    return json({
      ok: false,
      error: "idi_report_subject_mismatch",
      status: "review_required",
      reviewRequired: true,
      requiredSignals: subjectMatch.requiredSignals,
      matchedSignals: subjectMatch.signals,
      missingSignals: subjectMatch.missingSignals,
      message: "The IDI report does not match both the owner and property address for the selected estate. Review the original report and choose the correct estate before retrying.",
    }, { status: 422, headers: { "cache-control": "no-store" } });
  }
  const storedBeforeReservation = storedIdiImport(await env.PACKET_ARTIFACTS.get(await idiImportKey(assetKey)));
  const existing = storedIdiImportIsCanonical(storedBeforeReservation) ? storedBeforeReservation : null;
  const guard = await reserveCanonicalIdiImport(env, assetKey, {
    contentHash: attachment.contentHash,
    existingContentHash: existing?.attachment.contentHash,
    overrideReason: body.adminOverrideReason,
  });
  if (!guard.ok) return guard.response;
  if (guard.reservation.idempotent) {
    if (storedIdiImportIsCanonical(storedBeforeReservation) && storedBeforeReservation?.attachment.contentHash === attachment.contentHash) {
      if (!await deleteStagedIdiImport(env, assetKey)) {
        return json({
          ok: false,
          error: "idi_import_stage_cleanup_failed",
          message: "The canonical IDI report is verified, but its temporary staging copy was not removed. Retry before continuing.",
        }, { status: 503 });
      }
      return storedIdiImportResponse(storedBeforeReservation, env, { idempotent: true });
    }
    const staged = await loadStagedIdiImport(env, assetKey);
    const recoveryCandidate: StoredIdiImport | null = staged ? {
      ...staged,
      revision: crypto.randomUUID(),
      importVerification: "verified",
    } : null;
    if (!recoveryCandidate || recoveryCandidate.attachment.contentHash !== attachment.contentHash || !storedIdiImportIsCanonical(recoveryCandidate)) {
      return json({
        ok: false,
        error: "idi_import_canonical_record_missing",
        message: "The import guard confirms this report, but its canonical record is unavailable. Keep Discovery in review.",
      }, { status: 503 });
    }
    const recovered = await persistStoredIdiImport(env, recoveryCandidate);
    if (!recovered) {
      return json({ ok: false, error: "idi_import_readback_failed", message: "The canonical IDI report did not pass recovery readback. Discovery remains blocked." }, { status: 503 });
    }
    if (!await deleteStagedIdiImport(env, assetKey)) {
      return json({ ok: false, error: "idi_import_stage_cleanup_failed", message: "The canonical IDI report recovered, but its temporary staging copy was not removed. Retry before continuing." }, { status: 503 });
    }
    return storedIdiImportResponse(recovered, env, { idempotent: true });
  }
  const candidates = buildIdiUploadCandidates({
    assetKey,
    ownerName: matchedEstateSubject.ownerName,
    extraction,
  });
  const record: StoredIdiImport = {
    version: 1,
    revision: crypto.randomUUID(),
    assetKey,
    leadId: estateId,
    provider: "idi",
    mode,
    lockKey: idiLockKey(body),
    importedAt: nowIso(),
    importedBy: stringValue(body.importedBy || body.capturedBy) || "approved HeirRight user",
    attachment,
    extraction: safeIdiExtractionMetadata(extraction),
    subjectMatch: {
      matched: true,
      signals: subjectMatch.signals,
      reviewedAt: nowIso(),
    },
    candidates,
    contactPreviewCount: candidates.length,
    importVerification: "pending_guard_commit",
    paidRun: false,
    duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_import_only",
    adminOverrideReason: stringValue(body.adminOverrideReason) || null,
  };
  const pendingReadback = await persistStagedIdiImport(env, record);
  if (!pendingReadback) {
    await finalizeCanonicalIdiImport(env, guard.reservation, "abort", attachment.contentHash);
    const cleanupVerified = await deleteStagedIdiImport(env, assetKey);
    return json({
      ok: false,
      error: "idi_import_readback_failed",
      message: "The extracted IDI report did not pass shared storage readback. Discovery did not start.",
      cleanup: { stagingDeleteVerified: cleanupVerified },
    }, { status: 503 });
  }
  if (!await finalizeCanonicalIdiImport(env, guard.reservation, "commit", attachment.contentHash)) {
    await finalizeCanonicalIdiImport(env, guard.reservation, "abort", attachment.contentHash);
    const cleanupVerified = await deleteStagedIdiImport(env, assetKey);
    return json({
      ok: false,
      error: "idi_import_guard_readback_failed",
      message: "The canonical IDI import did not pass atomic commit readback. Discovery remains blocked.",
      cleanup: { stagingDeleteVerified: cleanupVerified },
    }, { status: 503 });
  }
  const readback = await persistStoredIdiImport(env, {
    ...pendingReadback,
    revision: crypto.randomUUID(),
    importVerification: "verified",
  });
  if (!readback) {
    return json({
      ok: false,
      error: "idi_import_verification_readback_failed",
      message: "The canonical IDI guard committed, but the verified report record did not pass final readback. Discovery remains blocked.",
    }, { status: 503 });
  }
  if (!await deleteStagedIdiImport(env, assetKey)) {
    return json({
      ok: false,
      error: "idi_import_stage_cleanup_failed",
      message: "The canonical IDI report committed, but its temporary staging copy was not removed. Retry before continuing.",
    }, { status: 503 });
  }
  return storedIdiImportResponse(readback, env);
}

function googleWorkspaceConnectionPublic(record: StoredGoogleWorkspaceConnection | null) {
  if (!record) return { connected: false, destinationId: null, destinationName: null, expiresAt: null, scopes: [] };
  return {
    connected: true,
    destinationId: record.destinationId || null,
    destinationName: record.destinationName || null,
    expiresAt: record.expiresAt,
    scopes: record.scopes,
    connectedAt: record.connectedAt,
  };
}

async function googleWorkspaceConnectionForEmail(env: CloudflareEnv, email: string): Promise<StoredGoogleWorkspaceConnection | null> {
  if (!env.PACKET_ARTIFACTS || !email) return null;
  return storedGoogleWorkspaceConnection(await env.PACKET_ARTIFACTS.get(await googleWorkspaceConnectionKey(email)));
}

async function storeGoogleWorkspaceConnection(env: CloudflareEnv, record: StoredGoogleWorkspaceConnection): Promise<boolean> {
  if (!env.PACKET_ARTIFACTS) return false;
  await env.PACKET_ARTIFACTS.put(await googleWorkspaceConnectionKey(record.email), JSON.stringify(record), {
    metadata: {
      kind: "google_workspace_connection",
      userHash: await sha256Hex(record.email.toLowerCase()),
      connectedAt: record.connectedAt,
      destinationId: record.destinationId || "",
    },
  });
  const readback = storedGoogleWorkspaceConnection(await env.PACKET_ARTIFACTS.get(await googleWorkspaceConnectionKey(record.email)));
  return Boolean(readback && readback.email === record.email && readback.accessTokenCipher === record.accessTokenCipher);
}

async function refreshGoogleWorkspaceAccessToken(
  record: StoredGoogleWorkspaceConnection,
  env: CloudflareEnv,
): Promise<{ ok: true; token: string; record: StoredGoogleWorkspaceConnection } | { ok: false; message: string }> {
  const currentToken = await decryptCookieValue(record.accessTokenCipher, env);
  const expiresAt = Date.parse(record.expiresAt);
  if (currentToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) return { ok: true, token: currentToken, record };
  const refreshToken = record.refreshTokenCipher ? await decryptCookieValue(record.refreshTokenCipher, env) : null;
  if (!refreshToken || !env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return { ok: false, message: "Reconnect Google Workspace to continue. The secure Drive session has expired." };
  }
  const refreshed = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await refreshed.json().catch(() => ({})) as { access_token?: string; expires_in?: number; refresh_token?: string };
  if (!refreshed.ok || !data.access_token) return { ok: false, message: "Reconnect Google Workspace to continue. Google could not refresh the secure Drive session." };
  const accessTokenCipher = await encryptCookieValue(data.access_token, env);
  if (!accessTokenCipher) return { ok: false, message: "Google Workspace token storage is unavailable." };
  const refreshTokenCipher = data.refresh_token ? await encryptCookieValue(data.refresh_token, env) : record.refreshTokenCipher;
  const updated: StoredGoogleWorkspaceConnection = {
    ...record,
    accessTokenCipher,
    refreshTokenCipher: refreshTokenCipher || undefined,
    expiresAt: new Date(Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000).toISOString(),
    updatedAt: nowIso(),
  };
  if (!await storeGoogleWorkspaceConnection(env, updated)) return { ok: false, message: "Google Workspace token storage did not pass readback." };
  return { ok: true, token: data.access_token, record: updated };
}

function googleMultipartPayload(metadata: Record<string, unknown>, contentType: string, bytes: Uint8Array): { body: Uint8Array; boundary: string } {
  const boundary = `heirright-${crypto.randomUUID().replace(/-/g, "")}`;
  const encoder = new TextEncoder();
  const opening = encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`);
  const closing = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(opening.length + bytes.length + closing.length);
  body.set(opening, 0);
  body.set(bytes, opening.length);
  body.set(closing, opening.length + bytes.length);
  return { body, boundary };
}

function googleDocsText(document: Record<string, unknown>): string {
  const content = Array.isArray(document.body && typeof document.body === "object" ? (document.body as Record<string, unknown>).content : [])
    ? (document.body as Record<string, unknown>).content as Array<Record<string, unknown>>
    : [];
  return content.flatMap((section) => {
    const paragraph = section.paragraph && typeof section.paragraph === "object" ? section.paragraph as Record<string, unknown> : null;
    const elements = Array.isArray(paragraph?.elements) ? paragraph.elements as Array<Record<string, unknown>> : [];
    return elements.map((element) => {
      const textRun = element.textRun && typeof element.textRun === "object" ? element.textRun as Record<string, unknown> : {};
      return stringValue(textRun.content);
    });
  }).join("").trim();
}

type GoogleDriveOperationReservation = {
  operationHash: string;
  reservationId: string;
  recoveredStale: boolean;
};

type GoogleDriveFileMetadata = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
  parents?: string[];
  appProperties?: Record<string, string>;
  sha256Checksum?: string;
  webViewLink?: string;
  createdTime?: string;
};

type GoogleDrivePdfVerification = {
  state: "verified" | "legacy_verified" | "missing" | "mismatch" | "transient";
  file?: GoogleDriveFileMetadata;
  ownedByAttempt: boolean;
};

const GOOGLE_DRIVE_MARKER_PROPERTY = "heirrightMarker";
const GOOGLE_DRIVE_PURPOSE_PROPERTY = "heirrightPurpose";
const GOOGLE_DRIVE_CONTENT_PROPERTY = "heirrightContent";
const GOOGLE_DRIVE_ATTEMPT_PROPERTY = "heirrightAttempt";
const GOOGLE_DRIVE_READBACK_DELAYS_MS = [0, 60, 180] as const;

async function googleDriveRetryDelay(attempt: number): Promise<void> {
  const delayMs = GOOGLE_DRIVE_READBACK_DELAYS_MS[Math.min(attempt, GOOGLE_DRIVE_READBACK_DELAYS_MS.length - 1)] || 0;
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function googleDriveOperationCommand(
  env: CloudflareEnv,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  if (!env.WORKSPACE_STATE) {
    return {
      ok: false,
      status: 503,
      data: {
        error: "google_drive_operation_unavailable",
        message: "Atomic Google Drive delivery protection is unavailable.",
      },
    };
  }
  try {
    const id = env.WORKSPACE_STATE.idFromName("heirright-team-workspace");
    const response = await env.WORKSPACE_STATE.get(id).fetch(new Request("https://workspace-state.internal/google-drive-operation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 503,
      data: {
        error: "google_drive_operation_unavailable",
        message: "Atomic Google Drive delivery protection is unavailable.",
      },
    };
  }
}

async function reserveGoogleDriveOperation(
  env: CloudflareEnv,
  operationHash: string,
): Promise<{ ok: true; reservation: GoogleDriveOperationReservation } | { ok: false; response: Response }> {
  const reservationId = crypto.randomUUID();
  const result = await googleDriveOperationCommand(env, {
    action: "reserve",
    operationHash,
    reservationId,
  });
  if (!result.ok) {
    return {
      ok: false,
      response: json({ ok: false, ...result.data }, {
        status: result.status || 503,
        headers: { "cache-control": "no-store" },
      }),
    };
  }
  return {
    ok: true,
    reservation: {
      operationHash,
      reservationId,
      recoveredStale: result.data.recoveredStale === true,
    },
  };
}

async function finalizeGoogleDriveOperation(
  env: CloudflareEnv,
  reservation: GoogleDriveOperationReservation,
  action: "release" | "review",
): Promise<boolean> {
  const result = await googleDriveOperationCommand(env, {
    action,
    operationHash: reservation.operationHash,
    reservationId: reservation.reservationId,
  });
  return result.ok && result.data.readbackStatus === "verified";
}

function googleDriveAppProperties(
  purpose: "ocr_temp" | "packet_export",
  marker: string,
  contentHash: string,
  reservationId: string,
): Record<string, string> {
  return {
    [GOOGLE_DRIVE_MARKER_PROPERTY]: marker,
    [GOOGLE_DRIVE_PURPOSE_PROPERTY]: purpose,
    [GOOGLE_DRIVE_CONTENT_PROPERTY]: contentHash,
    [GOOGLE_DRIVE_ATTEMPT_PROPERTY]: reservationId,
  };
}

async function googleDriveFilesByMarker(
  accessToken: string,
  marker: string,
): Promise<{ ok: true; files: GoogleDriveFileMetadata[] } | { ok: false }> {
  const query = `appProperties has { key='${GOOGLE_DRIVE_MARKER_PROPERTY}' and value='${marker}' } and trashed = false`;
  const params = new URLSearchParams({
    corpora: "user",
    spaces: "drive",
    q: query,
    pageSize: "100",
    fields: "nextPageToken,incompleteSearch,files(id,name,mimeType,size,parents,appProperties,sha256Checksum,webViewLink,createdTime)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json().catch(() => ({})) as {
      files?: GoogleDriveFileMetadata[];
      nextPageToken?: string;
      incompleteSearch?: boolean;
    };
    if (!response.ok || data.incompleteSearch === true || data.nextPageToken) return { ok: false };
    return {
      ok: true,
      files: Array.isArray(data.files)
        ? data.files.filter((file) => Boolean(file?.id)).slice(0, 100)
        : [],
    };
  } catch {
    return { ok: false };
  }
}

async function googleDriveFileMetadata(
  accessToken: string,
  fileId: string,
): Promise<{ state: "found"; file: GoogleDriveFileMetadata } | { state: "missing" | "transient" }> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,size,parents,appProperties,sha256Checksum,webViewLink,createdTime",
    supportsAllDrives: "true",
  });
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 404 || response.status === 410) return { state: "missing" };
    const file = await response.json().catch(() => ({})) as GoogleDriveFileMetadata;
    return response.ok && file.id === fileId ? { state: "found", file } : { state: "transient" };
  } catch {
    return { state: "transient" };
  }
}

async function googleDriveBlobHash(accessToken: string, fileId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return null;
    return sha256ByteHex(new Uint8Array(await response.arrayBuffer()));
  } catch {
    return null;
  }
}

async function verifyGoogleDrivePdf(
  accessToken: string,
  fileId: string,
  expectation: {
    marker: string;
    destinationId: string;
    contentHash: string;
    byteLength: number;
    allowLegacyMarker?: boolean;
  },
): Promise<GoogleDrivePdfVerification> {
  let lastState: GoogleDrivePdfVerification = { state: "transient", ownedByAttempt: false };
  for (let attempt = 0; attempt < GOOGLE_DRIVE_READBACK_DELAYS_MS.length; attempt += 1) {
    await googleDriveRetryDelay(attempt);
    const metadata = await googleDriveFileMetadata(accessToken, fileId);
    if (metadata.state !== "found") {
      lastState = { state: metadata.state, ownedByAttempt: false };
      continue;
    }
    const file = metadata.file;
    const properties = file.appProperties || {};
    const marker = stringValue(properties[GOOGLE_DRIVE_MARKER_PROPERTY]);
    const ownedByAttempt = marker === expectation.marker;
    const markerMissingButLegacyAllowed = !marker && expectation.allowLegacyMarker === true;
    if ((!ownedByAttempt && !markerMissingButLegacyAllowed)
      || (ownedByAttempt && stringValue(properties[GOOGLE_DRIVE_PURPOSE_PROPERTY]) !== "packet_export")
      || (ownedByAttempt && stringValue(properties[GOOGLE_DRIVE_CONTENT_PROPERTY]) !== expectation.contentHash)
      || file.mimeType !== "application/pdf"
      || Number(file.size) !== expectation.byteLength
      || !Array.isArray(file.parents)
      || !file.parents.includes(expectation.destinationId)) {
      return { state: "mismatch", file, ownedByAttempt };
    }
    const verifiedHash = stringValue(file.sha256Checksum) || await googleDriveBlobHash(accessToken, fileId);
    if (verifiedHash !== expectation.contentHash) return { state: "mismatch", file, ownedByAttempt };
    return {
      state: markerMissingButLegacyAllowed ? "legacy_verified" : "verified",
      file,
      ownedByAttempt,
    };
  }
  return lastState;
}

async function verifyGoogleOcrTemporaryFile(
  accessToken: string,
  fileId: string,
  marker: string,
  contentHash: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < GOOGLE_DRIVE_READBACK_DELAYS_MS.length; attempt += 1) {
    await googleDriveRetryDelay(attempt);
    const metadata = await googleDriveFileMetadata(accessToken, fileId);
    if (metadata.state !== "found") continue;
    const properties = metadata.file.appProperties || {};
    return metadata.file.mimeType === "application/vnd.google-apps.document"
      && stringValue(properties[GOOGLE_DRIVE_MARKER_PROPERTY]) === marker
      && stringValue(properties[GOOGLE_DRIVE_PURPOSE_PROPERTY]) === "ocr_temp"
      && stringValue(properties[GOOGLE_DRIVE_CONTENT_PROPERTY]) === contentHash;
  }
  return false;
}

async function attachGoogleDriveAppProperties(
  accessToken: string,
  file: GoogleDriveFileMetadata,
  appProperties: Record<string, string>,
): Promise<boolean> {
  if (!file.id) return false;
  const params = new URLSearchParams({
    fields: "id,appProperties",
    supportsAllDrives: "true",
  });
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?${params.toString()}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ appProperties: { ...(file.appProperties || {}), ...appProperties } }),
    });
    const data = await response.json().catch(() => ({})) as GoogleDriveFileMetadata;
    return response.ok
      && data.id === file.id
      && stringValue(data.appProperties?.[GOOGLE_DRIVE_MARKER_PROPERTY]) === appProperties[GOOGLE_DRIVE_MARKER_PROPERTY];
  } catch {
    return false;
  }
}

async function deleteGoogleDriveFileVerified(
  accessToken: string,
  fileId: string,
): Promise<{ ok: boolean; attempts: number }> {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // An interrupted DELETE has an unknown result; the bounded GET readback
    // below is the source of truth and prevents a blind second upload.
  }
  for (let attempt = 0; attempt < GOOGLE_DRIVE_READBACK_DELAYS_MS.length; attempt += 1) {
    await googleDriveRetryDelay(attempt);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id&supportsAllDrives=true`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 404 || response.status === 410) return { ok: true, attempts: attempt + 1 };
    } catch {
      // Retry a bounded number of times; never infer deletion from a network
      // error or from the DELETE response alone.
    }
  }
  return { ok: false, attempts: GOOGLE_DRIVE_READBACK_DELAYS_MS.length };
}

async function deleteGoogleDriveFilesVerified(
  accessToken: string,
  fileIds: string[],
): Promise<{ ok: boolean; deletedCount: number; attempts: number }> {
  let deletedCount = 0;
  let attempts = 0;
  for (const fileId of [...new Set(fileIds.filter(Boolean))]) {
    const result = await deleteGoogleDriveFileVerified(accessToken, fileId);
    attempts += result.attempts;
    if (!result.ok) return { ok: false, deletedCount, attempts };
    deletedCount += 1;
  }
  return { ok: true, deletedCount, attempts };
}

async function googleWorkspaceOcrResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  if (!internalBearerAuthorized(request, env)) return json({ ok: false, error: "google_workspace_internal_only", message: "Google Workspace conversion must be started from the signed HeirRight app." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = stringValue(body.email).toLowerCase();
  const attachmentId = stringValue(body.attachmentId);
  const source = await loadStoredSupportingDocument(env, attachmentId);
  if (!email || !source || source.documentId !== "idi-asset-search") return json({ ok: false, error: "ocr_input_invalid", message: "The original report is unavailable for Google Workspace conversion." }, { status: 409 });
  const connection = await googleWorkspaceConnectionForEmail(env, email);
  if (!connection) return json({ ok: false, error: "google_workspace_connection_required", message: "Connect Google Workspace before scanning image-only or legacy-office reports." }, { status: 428 });
  const access = await refreshGoogleWorkspaceAccessToken(connection, env);
  if (!access.ok) return json({ ok: false, error: "google_workspace_connection_expired", message: access.message }, { status: 428 });
  const bytes = base64UrlToBytes(source.dataBase64);
  const userHash = await sha256Hex(email);
  const marker = await sha256Hex(`ocr_temp:${userHash}:${source.id}:${source.contentHash}`);
  const reserved = await reserveGoogleDriveOperation(env, marker);
  if (!reserved.ok) return reserved.response;
  const reservation = reserved.reservation;
  const appProperties = googleDriveAppProperties("ocr_temp", marker, source.contentHash, reservation.reservationId);
  const existing = await googleDriveFilesByMarker(access.token, marker);
  if (!existing.ok) {
    await finalizeGoogleDriveOperation(env, reservation, "release");
    return json({
      ok: false,
      error: "google_workspace_ocr_reconciliation_failed",
      message: "Google Workspace could not verify whether a prior temporary conversion exists. No new conversion was created.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const existingCleanup = await deleteGoogleDriveFilesVerified(
    access.token,
    existing.files.map((file) => stringValue(file.id)),
  );
  if (!existingCleanup.ok) {
    await finalizeGoogleDriveOperation(env, reservation, "review");
    return json({
      ok: false,
      error: "google_workspace_ocr_cleanup_required",
      cleanupRequired: true,
      temporaryConversionDeleted: false,
      message: "A prior temporary Google conversion could not be verified as deleted. HeirRight did not create another copy.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const upload = googleMultipartPayload({
    name: `HeirRight temporary OCR ${marker.slice(0, 12)}`,
    mimeType: "application/vnd.google-apps.document",
    appProperties,
  }, source.contentType, bytes);
  let created: Response;
  try {
    created = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=en&supportsAllDrives=true&fields=id,name,appProperties", {
      method: "POST",
      headers: { authorization: `Bearer ${access.token}`, "content-type": `multipart/related; boundary=${upload.boundary}` },
      body: byteArrayBuffer(upload.body),
    });
  } catch {
    await finalizeGoogleDriveOperation(env, reservation, "review");
    return json({
      ok: false,
      error: "google_workspace_ocr_create_uncertain",
      cleanupRequired: true,
      temporaryConversionDeleted: false,
      message: "Google Workspace did not confirm whether the temporary conversion was created. HeirRight will reconcile it before any retry.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const createdData = await created.json().catch(() => ({})) as { id?: string };
  const temporaryId = stringValue(createdData.id);
  if (!created.ok || !temporaryId) {
    if (temporaryId) {
      const cleanup = await deleteGoogleDriveFileVerified(access.token, temporaryId);
      await finalizeGoogleDriveOperation(env, reservation, cleanup.ok ? "release" : "review");
    } else {
      await finalizeGoogleDriveOperation(env, reservation, "review");
    }
    return json({
      ok: false,
      error: "google_workspace_ocr_create_failed",
      cleanupRequired: true,
      temporaryConversionDeleted: false,
      message: "Google Workspace did not confirm a safe temporary OCR conversion. HeirRight will reconcile it before any retry.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!await verifyGoogleOcrTemporaryFile(access.token, temporaryId, marker, source.contentHash)) {
    const cleanup = await deleteGoogleDriveFileVerified(access.token, temporaryId);
    await finalizeGoogleDriveOperation(env, reservation, cleanup.ok ? "release" : "review");
    return json({
      ok: false,
      error: "google_workspace_ocr_readback_failed",
      cleanupRequired: !cleanup.ok,
      temporaryConversionDeleted: cleanup.ok,
      cleanup: { deleteReadbackStatus: cleanup.ok ? "verified" : "unverified", attempts: cleanup.attempts },
      message: cleanup.ok
        ? "Google Workspace did not preserve the private attempt marker, so HeirRight verified that the temporary conversion was removed."
        : "Google Workspace did not preserve the private attempt marker and the temporary conversion was not verified as deleted.",
    }, { status: cleanup.ok ? 502 : 503, headers: { "cache-control": "no-store" } });
  }
  let documentResponse: Response | null = null;
  let text = "";
  try {
    documentResponse = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(temporaryId)}`, {
      headers: { authorization: `Bearer ${access.token}` },
    });
    const document = await documentResponse.json().catch(() => ({})) as Record<string, unknown>;
    text = documentResponse.ok ? googleDocsText(document) : "";
  } catch {
    documentResponse = null;
  }
  const cleanup = await deleteGoogleDriveFileVerified(access.token, temporaryId);
  if (!cleanup.ok) {
    await finalizeGoogleDriveOperation(env, reservation, "review");
    return json({
      ok: false,
      error: "google_workspace_ocr_cleanup_required",
      cleanupRequired: true,
      temporaryConversionDeleted: false,
      cleanup: { deleteReadbackStatus: "unverified", attempts: cleanup.attempts },
      message: "The temporary Google conversion was not verified as deleted. No extracted report text was accepted.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  await finalizeGoogleDriveOperation(env, reservation, "release");
  if (!documentResponse?.ok || !text) {
    return json({
      ok: false,
      error: "google_workspace_ocr_empty",
      temporaryConversionDeleted: true,
      cleanup: { deleteReadbackStatus: "verified", attempts: cleanup.attempts },
      message: "Google Workspace could not read text from this report. Keep Discovery blocked and review the original file.",
    }, { status: 422, headers: { "cache-control": "no-store" } });
  }
  return json({
    ok: true,
    extraction: {
      status: "extracted",
      method: "google_drive_ocr",
      fileKind: source.contentType.startsWith("image/") ? "image" : source.contentType === "application/pdf" ? "pdf" : "docx",
      text: text.slice(0, 250_000),
      sourceLocators: [{ kind: "ocr", index: 1, label: "Google Workspace OCR", text: text.slice(0, 80_000) }],
      extractedAt: nowIso(),
    },
    temporaryConversionDeleted: true,
    cleanupRequired: false,
    cleanup: {
      deleteReadbackStatus: "verified",
      attempts: cleanup.attempts,
      reconciledTemporaryConversions: existingCleanup.deletedCount,
    },
  }, { headers: { "cache-control": "no-store" } });
}

async function googleWorkspaceConnectionResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (!internalBearerAuthorized(request, env)) return json({ ok: false, error: "google_workspace_internal_only", message: "Google Workspace setup must be started from the signed HeirRight app." }, { status: 403 });
  const email = stringValue(request.method === "GET" ? url.searchParams.get("email") : "").toLowerCase();
  if (request.method === "GET") {
    if (!email) return json({ ok: false, error: "email_required", message: "A signed-in Google Workspace user is required." }, { status: 400 });
    return json({ ok: true, ...googleWorkspaceConnectionPublic(await googleWorkspaceConnectionForEmail(env, email)) }, { headers: { "cache-control": "no-store" } });
  }
  if (request.method !== "POST") return methodNotAllowed("GET, POST");
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const userEmail = stringValue(body.email).toLowerCase();
  if (!userEmail || !emailAllowed(userEmail, env)) return json({ ok: false, error: "google_workspace_user_not_allowed", message: "Use an approved HeirRight Google Workspace account." }, { status: 403 });
  const action = stringValue(body.action);
  if (action === "select_destination") {
    const existing = await googleWorkspaceConnectionForEmail(env, userEmail);
    const destinationId = stringValue(body.destinationId);
    const destinationName = stringValue(body.destinationName).slice(0, 180);
    if (!existing || !destinationId || !destinationName) return json({ ok: false, error: "google_workspace_destination_required", message: "Connect Google Workspace and choose a Drive folder before delivery." }, { status: 422 });
    const updated = { ...existing, destinationId, destinationName, updatedAt: nowIso() };
    if (!await storeGoogleWorkspaceConnection(env, updated)) return json({ ok: false, error: "google_workspace_destination_readback_failed", message: "Drive destination did not pass storage readback." }, { status: 503 });
    return json({ ok: true, ...googleWorkspaceConnectionPublic(updated), readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
  }
  const accessToken = stringValue(body.accessToken);
  const refreshToken = stringValue(body.refreshToken);
  const expiresAt = stringValue(body.expiresAt);
  if (!accessToken || !expiresAt) return json({ ok: false, error: "google_workspace_token_required", message: "Google Workspace authorization did not return a usable Drive session." }, { status: 422 });
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return json({ ok: false, error: "google_workspace_refresh_not_configured", message: "Google Workspace server credentials must be installed before a Drive connection can be saved." }, { status: 503 });
  }
  const accessTokenCipher = await encryptCookieValue(accessToken, env);
  const refreshTokenCipher = refreshToken ? await encryptCookieValue(refreshToken, env) : null;
  if (!accessTokenCipher) return json({ ok: false, error: "google_workspace_token_store_unavailable", message: "Google Workspace token storage is unavailable." }, { status: 503 });
  const previous = await googleWorkspaceConnectionForEmail(env, userEmail);
  const record: StoredGoogleWorkspaceConnection = {
    version: 1,
    email: userEmail,
    accessTokenCipher,
    refreshTokenCipher: refreshTokenCipher || previous?.refreshTokenCipher,
    expiresAt,
    scopes: Array.isArray(body.scopes) ? body.scopes.map(stringValue).filter(Boolean).slice(0, 30) : [],
    destinationId: previous?.destinationId,
    destinationName: previous?.destinationName,
    connectedAt: previous?.connectedAt || nowIso(),
    updatedAt: nowIso(),
  };
  if (!await storeGoogleWorkspaceConnection(env, record)) return json({ ok: false, error: "google_workspace_connection_readback_failed", message: "Google Workspace connection did not pass storage readback." }, { status: 503 });
  return json({ ok: true, ...googleWorkspaceConnectionPublic(record), readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
}

async function googleWorkspaceDestinationsResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");
  if (!internalBearerAuthorized(request, env)) return json({ ok: false, error: "google_workspace_internal_only", message: "Drive folders must be loaded from the signed HeirRight app." }, { status: 403 });
  const email = stringValue(url.searchParams.get("email")).toLowerCase();
  const connection = await googleWorkspaceConnectionForEmail(env, email);
  if (!connection) return json({ ok: false, error: "google_workspace_connection_required", message: "Connect Google Workspace before choosing a Drive folder." }, { status: 428 });
  const access = await refreshGoogleWorkspaceAccessToken(connection, env);
  if (!access.ok) return json({ ok: false, error: "google_workspace_connection_expired", message: access.message }, { status: 428 });
  const response = await fetch("https://www.googleapis.com/drive/v3/files?corpora=user&q=mimeType%3D%27application%2Fvnd.google-apps.folder%27%20and%20trashed%3Dfalse&orderBy=modifiedTime%20desc&pageSize=50&fields=files(id%2Cname%2CwebViewLink)", {
    headers: { authorization: `Bearer ${access.token}` },
  });
  const data = await response.json().catch(() => ({})) as { files?: Array<{ id?: string; name?: string; webViewLink?: string }> };
  if (!response.ok) return json({ ok: false, error: "google_workspace_destinations_failed", message: "Google Workspace could not load Drive folders." }, { status: 502 });
  return json({ ok: true, folders: (data.files || []).filter((folder) => folder.id && folder.name).map((folder) => ({ id: folder.id, name: folder.name, url: folder.webViewLink || null })) }, { headers: { "cache-control": "no-store" } });
}

type StoredGoogleWorkspaceDelivery = {
  version: 2;
  revision: string;
  artifactId: string;
  deliveryArtifactId: string;
  deliveryDocumentId: string | null;
  estateId: string;
  flow: "discovery" | "closing-docs";
  packetRevision: number;
  approvedAt: string;
  approvedBy: string;
  destinationId: string;
  fileId: string;
  fileUrl: string | null;
  marker: string;
  pdfHash: string;
  bytes: number;
  deliveredAt: string;
};

function storedGoogleWorkspaceDelivery(value: string | null): StoredGoogleWorkspaceDelivery | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredGoogleWorkspaceDelivery> & { version?: number };
    if (!parsed || typeof parsed !== "object" || !parsed.artifactId || !parsed.destinationId || !parsed.fileId
      || !/^[a-f0-9]{64}$/.test(stringValue(parsed.pdfHash)) || !Number.isFinite(Number(parsed.bytes))) return null;
    return {
      version: 2,
      revision: stringValue(parsed.revision) || `legacy-${stringValue(parsed.pdfHash).slice(0, 16)}`,
      artifactId: stringValue(parsed.artifactId),
      deliveryArtifactId: stringValue(parsed.deliveryArtifactId) || stringValue(parsed.artifactId),
      deliveryDocumentId: stringValue(parsed.deliveryDocumentId) || null,
      estateId: stringValue(parsed.estateId),
      flow: parsed.flow === "closing-docs" ? "closing-docs" : "discovery",
      packetRevision: Number(parsed.packetRevision) || 0,
      approvedAt: stringValue(parsed.approvedAt),
      approvedBy: stringValue(parsed.approvedBy).toLowerCase(),
      destinationId: stringValue(parsed.destinationId),
      fileId: stringValue(parsed.fileId),
      fileUrl: stringValue(parsed.fileUrl) || null,
      marker: stringValue(parsed.marker),
      pdfHash: stringValue(parsed.pdfHash),
      bytes: Number(parsed.bytes),
      deliveredAt: stringValue(parsed.deliveredAt) || nowIso(),
    };
  } catch {
    return null;
  }
}

async function loadGoogleWorkspaceDelivery(
  env: CloudflareEnv,
  key: string,
): Promise<{ ok: true; record: StoredGoogleWorkspaceDelivery | null } | { ok: false }> {
  try {
    const value = await env.PACKET_ARTIFACTS?.get(key);
    if (!value) return { ok: true, record: null };
    const record = storedGoogleWorkspaceDelivery(value);
    return record ? { ok: true, record } : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function persistGoogleWorkspaceDelivery(
  env: CloudflareEnv,
  key: string,
  record: StoredGoogleWorkspaceDelivery,
): Promise<boolean> {
  if (!env.PACKET_ARTIFACTS) return false;
  try {
    await env.PACKET_ARTIFACTS.put(key, JSON.stringify(record), {
      expirationTtl: documentRetentionSeconds(env),
      metadata: {
        kind: "google_workspace_delivery",
        artifactId: record.artifactId,
        deliveryArtifactId: record.deliveryArtifactId,
        deliveryDocumentId: record.deliveryDocumentId,
        destinationId: record.destinationId,
        fileId: record.fileId,
        marker: record.marker,
        pdfHash: record.pdfHash,
      },
    });
    const readback = storedGoogleWorkspaceDelivery(await env.PACKET_ARTIFACTS.get(key));
    return Boolean(readback
      && readback.revision === record.revision
      && readback.fileId === record.fileId
      && readback.marker === record.marker
      && readback.pdfHash === record.pdfHash
      && readback.bytes === record.bytes);
  } catch {
    return false;
  }
}

async function deleteGoogleWorkspaceDeliveryReceipt(env: CloudflareEnv, key: string): Promise<boolean> {
  if (!env.PACKET_ARTIFACTS) return false;
  try {
    await env.PACKET_ARTIFACTS.delete(key);
    return !await env.PACKET_ARTIFACTS.get(key);
  } catch {
    return false;
  }
}

function googleWorkspaceDeliveryResponse(
  connection: StoredGoogleWorkspaceConnection,
  delivery: StoredGoogleWorkspaceDelivery,
  options: { idempotent?: boolean; reconciled?: boolean } = {},
): Response {
  return json({
    ok: true,
    route: "google",
    mode: "live",
    ...(options.idempotent ? { idempotent: true } : {}),
    ...(options.reconciled ? { reconciled: true } : {}),
    fileId: delivery.fileId,
    fileUrl: delivery.fileUrl,
    artifactId: delivery.artifactId,
    deliveryArtifactId: delivery.deliveryArtifactId,
    deliveryDocumentId: delivery.deliveryDocumentId,
    destination: connection.destinationName,
    destinationId: connection.destinationId,
    readbackStatus: "verified",
    readbackOk: true,
    contentHash: delivery.pdfHash,
    byteLength: delivery.bytes,
    message: options.idempotent || options.reconciled
      ? "The verified Discovery PDF is already saved to the selected Drive folder."
      : "The verified Discovery PDF is saved to the selected Drive folder.",
  }, { headers: { "cache-control": "no-store" } });
}

type ExactPacketApproval = {
  estateId: string;
  flow: "discovery" | "closing-docs";
  packetRevision: number;
  artifactId: string;
  approvedAt: string;
  approvedBy: string;
};

type ExactPacketDeliveryRequest = Omit<ExactPacketApproval, "approvedAt" | "approvedBy"> & {
  actorEmail: string;
};

function exactPacketDeliveryRequestFromBody(body: Record<string, unknown>): ExactPacketDeliveryRequest | null {
  const estateId = stringValue(body.estateId);
  const flow = stringValue(body.flow);
  const packetRevision = Number(body.packetRevision);
  const artifactId = stringValue(body.artifactId);
  const actorEmail = stringValue(body.actorEmail).toLowerCase();
  if (!estateId || estateId.length > 500 || !["discovery", "closing-docs"].includes(flow)
    || !Number.isInteger(packetRevision) || packetRevision < 1
    || !/^packet-[0-9]+-[a-f0-9]{16}$/.test(artifactId)
    || !actorEmail) return null;
  return { estateId, flow: flow as ExactPacketApproval["flow"], packetRevision, artifactId, actorEmail };
}

type DurablePacketApprovalResult =
  | { ok: true; approval: ExactPacketApproval }
  | { ok: false; response: Response };

async function packetApprovalOperation(
  env: CloudflareEnv,
  action: "approve" | "status",
  requested: ExactPacketDeliveryRequest,
  artifactContentHash: string,
): Promise<{ response: Response; payload: Record<string, unknown> }> {
  if (!env.WORKSPACE_STATE) {
    const response = json({ ok: false, error: "packet_approval_store_unavailable" }, { status: 503 });
    return { response, payload: { ok: false, error: "packet_approval_store_unavailable" } };
  }
  const approvalHash = await sha256Hex(`packet_approval:v1\u0000${requested.estateId}\u0000${requested.flow}`);
  const id = env.WORKSPACE_STATE.idFromName("heirright-team-workspace");
  const response = await env.WORKSPACE_STATE.get(id).fetch(new Request("https://workspace-state.internal/packet-approval-operation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      approvalHash,
      estateId: requested.estateId,
      flow: requested.flow,
      packetRevision: requested.packetRevision,
      artifactId: requested.artifactId,
      artifactContentHash,
      approvedBy: requested.actorEmail,
    }),
  }));
  return { response, payload: await response.clone().json().catch(() => ({})) as Record<string, unknown> };
}

async function durablePacketApprovalReadback(
  env: CloudflareEnv,
  requested: ExactPacketDeliveryRequest,
  artifactContentHash: string,
): Promise<DurablePacketApprovalResult> {
  if (!env.WORKSPACE_STATE) {
    return {
      ok: false,
      response: json({
        ok: false,
        error: "packet_approval_store_unavailable",
        message: "Shared packet approval storage is unavailable. Google Drive was not contacted.",
      }, { status: 503, headers: { "cache-control": "no-store" } }),
    };
  }
  try {
    const operation = await packetApprovalOperation(env, "status", requested, artifactContentHash);
    if (operation.response.status === 404 || operation.payload.error === "packet_approval_not_found") {
      return {
        ok: false,
        response: json({
          ok: false,
          error: "packet_approval_required",
          message: "Approve the current verified packet revision before Google Drive delivery.",
        }, { status: 409, headers: { "cache-control": "no-store" } }),
      };
    }
    if (!operation.response.ok || operation.payload.ok !== true || operation.payload.readbackStatus !== "verified") {
      return {
        ok: false,
        response: json({
          ok: false,
          error: "packet_approval_readback_failed",
          message: "The current packet approval did not pass server-attested readback. Google Drive was not contacted.",
        }, { status: 503, headers: { "cache-control": "no-store" } }),
      };
    }
    const storedApproval = objectValue(operation.payload.approval);
    const approvedAt = stringValue(storedApproval.approvedAt);
    const approvedBy = stringValue(storedApproval.approvedBy).toLowerCase();
    if (!approvedAt || !Number.isFinite(Date.parse(approvedAt)) || !approvedBy) {
      return {
        ok: false,
        response: json({
          ok: false,
          error: "packet_approval_required",
          message: "Approve the current verified packet revision before Google Drive delivery.",
        }, { status: 409, headers: { "cache-control": "no-store" } }),
      };
    }
    if (approvedBy !== requested.actorEmail) {
      return {
        ok: false,
        response: json({
          ok: false,
          error: "packet_approval_actor_mismatch",
          message: "The signed-in operator must be the operator who approved the current packet revision.",
        }, { status: 403, headers: { "cache-control": "no-store" } }),
      };
    }
    const exact = operation.payload.exact === true
      && Number(storedApproval.packetRevision) === requested.packetRevision
      && stringValue(storedApproval.estateId) === requested.estateId
      && stringValue(storedApproval.flow) === requested.flow
      && stringValue(storedApproval.artifactId) === requested.artifactId
      && stringValue(storedApproval.artifactContentHash) === artifactContentHash;
    if (!exact) {
      return {
        ok: false,
        response: json({
          ok: false,
          error: "packet_approval_stale",
          message: "A newer or different packet is active. Review and approve the current revision before Google Drive delivery.",
        }, { status: 409, headers: { "cache-control": "no-store" } }),
      };
    }
    return {
      ok: true,
      approval: {
        estateId: requested.estateId,
        flow: requested.flow,
        packetRevision: requested.packetRevision,
        artifactId: requested.artifactId,
        approvedAt,
        approvedBy,
      },
    };
  } catch {
    return {
      ok: false,
      response: json({
        ok: false,
        error: "packet_approval_readback_failed",
        message: "The current packet approval did not pass shared-workspace readback. Google Drive was not contacted.",
      }, { status: 503, headers: { "cache-control": "no-store" } }),
    };
  }
}

async function packetApprovalResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!internalBearerAuthorized(request, env)) {
    return json({
      ok: false,
      error: "packet_approval_internal_only",
      message: "Packet approval must be started from the signed HeirRight app.",
    }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  if (!env.PACKET_ARTIFACTS) {
    return json({ ok: false, error: "packet_artifact_store_not_configured", message: "Packet storage is unavailable." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestedAction = stringValue(body.action);
  if ((body.action !== undefined && typeof body.action !== "string")
    || (requestedAction && !["approve", "status"].includes(requestedAction))) {
    return json({
      ok: false,
      error: "packet_approval_action_invalid",
      message: "Packet approval supports only approval and status readback.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const action: "approve" | "status" = requestedAction === "status" ? "status" : "approve";
  const requested = exactPacketDeliveryRequestFromBody(body);
  if (!requested) {
    return json({
      ok: false,
      error: "packet_approval_binding_required",
      message: "Approval needs the exact estate, workflow, current revision, artifact, and signed-in operator.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  let stored: string | null;
  try {
    stored = await env.PACKET_ARTIFACTS.get(packetArtifactKey(requested.artifactId));
  } catch {
    return json({ ok: false, error: "artifact_readback_failed", message: "The verified packet could not be read safely." }, { status: 503 });
  }
  if (!stored) return json({ ok: false, error: "artifact_not_found", message: "This packet is unavailable or has expired." }, { status: 404 });
  let artifact: StoredPacketArtifact;
  try {
    artifact = JSON.parse(stored) as StoredPacketArtifact;
  } catch {
    return json({ ok: false, error: "artifact_integrity_failed", message: "Packet integrity validation failed before approval." }, { status: 409 });
  }
  const exactEstateIds = Array.isArray(artifact.model?.estateIds) ? artifact.model.estateIds.map(stringValue) : [];
  const exactEstates = Array.isArray(artifact.model?.estates) ? artifact.model.estates : [];
  const expiresAt = Date.parse(stringValue(artifact.expiresAt));
  if (artifact.id !== requested.artifactId
    || await sha256Hex(JSON.stringify(artifact.model)) !== artifact.contentHash
    || artifact.model?.flow !== requested.flow
    || exactEstateIds.length !== 1
    || exactEstateIds[0] !== requested.estateId
    || exactEstates.length !== 1
    || stringValue(exactEstates[0]?.dossierId) !== requested.estateId
    || artifact.flow !== requested.flow
    || artifact.packetRevision !== requested.packetRevision
    || !Array.isArray(artifact.estateIds)
    || artifact.estateIds.length !== 1
    || artifact.estateIds[0] !== requested.estateId) {
    return json({
      ok: false,
      error: "packet_approval_binding_mismatch",
      message: "The packet does not match this exact estate, workflow, revision, and stored artifact.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return json({
      ok: false,
      error: "packet_artifact_expired",
      message: "This verified packet expired. Regenerate and review the current revision before approval.",
    }, { status: 410, headers: { "cache-control": "no-store" } });
  }
  const canonical = await loadCanonicalDiscoveryFile(env, requested.estateId);
  if (!canonical.exists || !canonical.record) {
    return json({
      ok: false,
      error: "canonical_discovery_file_required",
      message: "A verified canonical Discovery File is required before packet approval.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!["verified", "verified_recovered_previous"].includes(canonical.readbackStatus)) {
    return canonicalEstateReadbackFailure("Packet approval", canonical.readbackStatus);
  }
  const canonicalPacketReferences = Array.isArray(canonical.record.packetArtifacts)
    ? canonical.record.packetArtifacts as Array<Record<string, unknown>>
    : [];
  const activeFlowReference = canonicalPacketReferences.find((reference) => stringValue(reference.flow) === requested.flow);
  if (!activeFlowReference
    || stringValue(activeFlowReference.artifactId) !== requested.artifactId
    || Number(activeFlowReference.packetRevision) !== requested.packetRevision
    || !Array.isArray(activeFlowReference.estateIds)
    || activeFlowReference.estateIds.length !== 1
    || stringValue(activeFlowReference.estateIds[0]) !== requested.estateId
    || stringValue(activeFlowReference.contentHash) !== artifact.contentHash
    || stringValue(activeFlowReference.readbackStatus) !== "verified") {
    return json({
      ok: false,
      error: "packet_approval_stale",
      message: "A newer or different packet is active. Review and approve the current revision.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const stopReasons = canonicalStopReasons(canonical.record);
  if (stopReasons.length) return canonicalStopJson(stopReasons, "Packet approval");
  let operation: Awaited<ReturnType<typeof packetApprovalOperation>>;
  try {
    operation = await packetApprovalOperation(env, action, requested, artifact.contentHash);
  } catch {
    return json({
      ok: false,
      error: "packet_approval_readback_failed",
      message: "The packet approval did not pass server-attested readback.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (action === "status" && (operation.response.status === 404 || operation.payload.error === "packet_approval_not_found")) {
    return json({
      ok: true,
      approved: false,
      approval: null,
      readbackStatus: "verified",
      message: "The signed-in operator has not approved this current verified packet.",
    }, { headers: { "cache-control": "no-store" } });
  }
  if (!operation.response.ok) return operation.response;
  if (operation.payload.ok !== true || operation.payload.readbackStatus !== "verified") {
    return json({
      ok: false,
      error: "packet_approval_readback_failed",
      message: "The packet approval did not return verified server-attested readback.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const approval = objectValue(operation.payload.approval);
  const exact = (action !== "status" || operation.payload.exact === true)
    && stringValue(approval.estateId) === requested.estateId
    && stringValue(approval.flow) === requested.flow
    && Number(approval.packetRevision) === requested.packetRevision
    && stringValue(approval.artifactId) === requested.artifactId
    && stringValue(approval.artifactContentHash) === artifact.contentHash
    && stringValue(approval.approvedBy).toLowerCase() === requested.actorEmail
    && Number.isFinite(Date.parse(stringValue(approval.approvedAt)));
  if (!exact) {
    if (action === "status") {
      return json({
        ok: true,
        approved: false,
        approval: null,
        readbackStatus: "verified",
        message: "The signed-in operator has not approved this current verified packet.",
      }, { headers: { "cache-control": "no-store" } });
    }
    return json({
      ok: false,
      error: "packet_approval_readback_failed",
      message: "The packet approval did not pass exact server-attested readback.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return json({
    ok: true,
    approved: true,
    approval: {
      estateId: requested.estateId,
      flow: requested.flow,
      packetRevision: requested.packetRevision,
      artifactId: requested.artifactId,
      approvedAt: stringValue(approval.approvedAt),
      approvedBy: requested.actorEmail,
    },
    idempotent: operation.payload.idempotent === true,
    readbackStatus: "verified",
    message: action === "status"
      ? "The signed-in operator's approval for this current verified packet passed server-attested readback."
      : "The current verified packet is approved for controlled handoff.",
  }, { headers: { "cache-control": "no-store" } });
}

async function googleWorkspaceExportResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  if (!internalBearerAuthorized(request, env)) return json({ ok: false, error: "google_workspace_internal_only", message: "Google Workspace delivery must be started from the signed HeirRight app." }, { status: 403 });
  if (!env.PACKET_ARTIFACTS) return json({ ok: false, error: "packet_artifact_store_not_configured", message: "Packet storage is unavailable." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = stringValue(body.email).toLowerCase();
  const actorEmail = stringValue(body.actorEmail).toLowerCase();
  if (!email || !actorEmail || actorEmail !== email) {
    return json({
      ok: false,
      error: "packet_approval_actor_mismatch",
      message: "Google Drive delivery must be bound to the signed-in operator who approved the current packet.",
    }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const requested = exactPacketDeliveryRequestFromBody(body);
  if (!requested) {
    return json({
      ok: false,
      error: "packet_approval_binding_required",
      message: "Google Drive delivery needs the exact estate, workflow, current revision, artifact, and signed-in operator.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const artifactId = requested.artifactId;
  const deliveryDocumentId = stringValue(body.deliveryDocumentId);
  if ((requested.flow === "discovery" && deliveryDocumentId !== "completed-report")
    || (requested.flow === "closing-docs" && deliveryDocumentId)) {
    return json({
      ok: false,
      error: "google_workspace_delivery_document_invalid",
      message: requested.flow === "discovery"
        ? "Discovery delivery requires the verified client-facing completed report."
        : "Closing Prep delivery does not accept a Discovery document selection.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  let stored: string | null;
  try {
    stored = await env.PACKET_ARTIFACTS.get(packetArtifactKey(artifactId));
  } catch {
    return json({ ok: false, error: "artifact_readback_failed", message: "The verified Discovery PDF could not be read safely." }, { status: 503 });
  }
  if (!stored) return json({ ok: false, error: "artifact_not_found", message: "The verified Discovery PDF is unavailable or has expired." }, { status: 404 });
  let artifact: StoredPacketArtifact;
  try {
    artifact = JSON.parse(stored) as StoredPacketArtifact;
  } catch {
    return json({ ok: false, error: "artifact_integrity_failed", message: "Packet integrity validation failed before Google Drive delivery." }, { status: 409 });
  }
  const exactEstateIds = Array.isArray(artifact.model?.estateIds) ? artifact.model.estateIds.map(stringValue) : [];
  const exactEstates = Array.isArray(artifact.model?.estates) ? artifact.model.estates : [];
  if (artifact.id !== artifactId
    || await sha256Hex(JSON.stringify(artifact.model)) !== artifact.contentHash
    || artifact.model?.flow !== requested.flow
    || exactEstateIds.length !== 1
    || exactEstateIds[0] !== requested.estateId
    || exactEstates.length !== 1
    || stringValue(exactEstates[0]?.dossierId) !== requested.estateId
    || artifact.flow !== requested.flow
    || artifact.packetRevision !== requested.packetRevision
    || !Array.isArray(artifact.estateIds)
    || artifact.estateIds.length !== 1
    || artifact.estateIds[0] !== requested.estateId) {
    return json({
      ok: false,
      error: "packet_approval_binding_mismatch",
      message: "The approved packet does not match this exact estate, workflow, and stored artifact.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const artifactExpiresAt = Date.parse(stringValue(artifact.expiresAt));
  if (!Number.isFinite(artifactExpiresAt) || artifactExpiresAt <= Date.now()) {
    return json({
      ok: false,
      error: "packet_artifact_expired",
      message: "This verified packet expired. Regenerate and approve the current revision before Google Drive delivery.",
    }, { status: 410, headers: { "cache-control": "no-store" } });
  }
  const durableApproval = await durablePacketApprovalReadback(env, requested, artifact.contentHash);
  if (!durableApproval.ok) return durableApproval.response;
  const approval = durableApproval.approval;
  const canonical = await loadCanonicalDiscoveryFile(env, approval.estateId);
  if (!canonical.exists || !canonical.record) {
    return json({
      ok: false,
      error: "canonical_discovery_file_required",
      message: "A verified canonical Discovery File is required before Google Drive delivery.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (canonical.readbackStatus !== "verified" && canonical.readbackStatus !== "verified_recovered_previous") {
    return canonicalEstateReadbackFailure("Google Workspace delivery", canonical.readbackStatus);
  }
  const canonicalPacketReferences = Array.isArray(canonical.record.packetArtifacts)
    ? canonical.record.packetArtifacts as Array<Record<string, unknown>>
    : [];
  const activeFlowReference = canonicalPacketReferences.find((reference) => stringValue(reference.flow) === approval.flow);
  if (!activeFlowReference
    || stringValue(activeFlowReference.artifactId) !== artifactId
    || Number(activeFlowReference.packetRevision) !== approval.packetRevision
    || !Array.isArray(activeFlowReference.estateIds)
    || activeFlowReference.estateIds.length !== 1
    || stringValue(activeFlowReference.estateIds[0]) !== approval.estateId
    || stringValue(activeFlowReference.contentHash) !== artifact.contentHash
    || stringValue(activeFlowReference.readbackStatus) !== "verified") {
    return json({
      ok: false,
      error: "packet_approval_stale",
      message: "A newer or different packet is active for this estate and workflow. Review and approve the current revision before delivery.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const stopReasons = canonicalStopReasons(canonical.record);
  if (stopReasons.length) return canonicalStopJson(stopReasons, "Google Workspace delivery");
  let deliveryArtifact = artifact;
  if (deliveryDocumentId) {
    const references = Array.isArray(activeFlowReference.documentArtifacts)
      ? activeFlowReference.documentArtifacts as Array<Record<string, unknown>>
      : [];
    const deliveryReference = references.find((reference) => stringValue(reference.documentId) === deliveryDocumentId);
    const deliveryArtifactId = stringValue(deliveryReference?.artifactId);
    const deliveryContentHash = stringValue(deliveryReference?.contentHash);
    if (!deliveryReference
      || !/^packet-[0-9]+-[a-f0-9]{16}$/.test(deliveryArtifactId)
      || !/^[a-f0-9]{64}$/.test(deliveryContentHash)
      || stringValue(deliveryReference.readbackStatus) !== "verified") {
      return json({
        ok: false,
        error: "google_workspace_delivery_document_unavailable",
        message: "The verified client-facing completed report is not attached to this active packet revision.",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    let storedDeliveryArtifact: string | null;
    try {
      storedDeliveryArtifact = await env.PACKET_ARTIFACTS.get(packetArtifactKey(deliveryArtifactId));
    } catch {
      return json({
        ok: false,
        error: "google_workspace_delivery_document_readback_failed",
        message: "The client-facing completed report could not be read safely. Google Drive was not contacted.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    if (!storedDeliveryArtifact) {
      return json({
        ok: false,
        error: "google_workspace_delivery_document_unavailable",
        message: "The client-facing completed report is unavailable or has expired.",
      }, { status: 404, headers: { "cache-control": "no-store" } });
    }
    try {
      deliveryArtifact = JSON.parse(storedDeliveryArtifact) as StoredPacketArtifact;
    } catch {
      return json({
        ok: false,
        error: "google_workspace_delivery_document_integrity_failed",
        message: "The client-facing completed report failed integrity validation.",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const deliveryEstateIds = Array.isArray(deliveryArtifact.model?.estateIds)
      ? deliveryArtifact.model.estateIds.map(stringValue)
      : [];
    const deliveryEstates = Array.isArray(deliveryArtifact.model?.estates)
      ? deliveryArtifact.model.estates
      : [];
    const deliveryExpiresAt = Date.parse(stringValue(deliveryArtifact.expiresAt));
    if (deliveryArtifact.id !== deliveryArtifactId
      || deliveryArtifact.contentHash !== deliveryContentHash
      || await sha256Hex(JSON.stringify(deliveryArtifact.model)) !== deliveryArtifact.contentHash
      || deliveryArtifact.documentId !== deliveryDocumentId
      || deliveryArtifact.parentArtifactId !== artifactId
      || deliveryArtifact.flow !== requested.flow
      || deliveryArtifact.packetRevision !== requested.packetRevision
      || deliveryArtifact.model?.flow !== requested.flow
      || deliveryEstateIds.length !== 1
      || deliveryEstateIds[0] !== requested.estateId
      || deliveryEstates.length !== 1
      || stringValue(deliveryEstates[0]?.dossierId) !== requested.estateId
      || !Array.isArray(deliveryArtifact.estateIds)
      || deliveryArtifact.estateIds.length !== 1
      || deliveryArtifact.estateIds[0] !== requested.estateId
      || !Number.isFinite(deliveryExpiresAt)
      || deliveryExpiresAt <= Date.now()) {
      return json({
        ok: false,
        error: "google_workspace_delivery_document_integrity_failed",
        message: "The client-facing completed report does not match this exact estate, workflow, revision, and parent packet.",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
  }
  let pdf: Uint8Array;
  try {
    pdf = await renderPacketPdf(deliveryArtifact.model);
  } catch {
    return json({ ok: false, error: "packet_render_failed", message: "The approved packet could not be rendered safely. Google Drive was not contacted." }, { status: 422 });
  }
  const connection = await googleWorkspaceConnectionForEmail(env, email);
  if (!connection?.destinationId || !connection.destinationName) return json({ ok: false, error: "google_workspace_destination_required", message: "Connect Google Workspace and choose a Drive folder before packet delivery." }, { status: 428 });
  const access = await refreshGoogleWorkspaceAccessToken(connection, env);
  if (!access.ok) return json({ ok: false, error: "google_workspace_connection_expired", message: access.message }, { status: 428 });
  const pdfHash = await sha256ByteHex(pdf);
  const userHash = await sha256Hex(email);
  const marker = await sha256Hex(`packet_export:${userHash}:${approval.estateId}:${approval.flow}:${approval.packetRevision}:${artifactId}:${deliveryArtifact.id}:${deliveryDocumentId || "full-packet"}:${connection.destinationId}:${deliveryArtifact.contentHash}`);
  const reserved = await reserveGoogleDriveOperation(env, marker);
  if (!reserved.ok) return reserved.response;
  const reservation = reserved.reservation;
  const deliveryKey = googleWorkspaceDeliveryKey(artifactId, connection.destinationId, deliveryDocumentId);
  const loadedPrior = await loadGoogleWorkspaceDelivery(env, deliveryKey);
  if (!loadedPrior.ok) {
    await finalizeGoogleDriveOperation(env, reservation, "release");
    return json({
      ok: false,
      error: "google_workspace_delivery_receipt_unavailable",
      message: "The prior Drive delivery receipt could not be verified. HeirRight did not upload another copy.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const prior = loadedPrior.record;
  if (prior) {
    if (prior.artifactId !== artifactId
      || prior.deliveryArtifactId !== deliveryArtifact.id
      || prior.deliveryDocumentId !== (deliveryDocumentId || null)
      || prior.destinationId !== connection.destinationId) {
      await finalizeGoogleDriveOperation(env, reservation, "release");
      return json({
        ok: false,
        error: "google_workspace_delivery_receipt_invalid",
        message: "The prior Drive delivery receipt does not match this packet and destination. No new copy was uploaded.",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    let priorVerification = await verifyGoogleDrivePdf(access.token, prior.fileId, {
      marker,
      destinationId: connection.destinationId,
      contentHash: prior.pdfHash,
      byteLength: prior.bytes,
      allowLegacyMarker: !prior.marker,
    });
    if (priorVerification.state === "legacy_verified" && priorVerification.file) {
      const adopted = await attachGoogleDriveAppProperties(
        access.token,
        priorVerification.file,
        googleDriveAppProperties("packet_export", marker, prior.pdfHash, reservation.reservationId),
      );
      priorVerification = adopted
        ? await verifyGoogleDrivePdf(access.token, prior.fileId, {
          marker,
          destinationId: connection.destinationId,
          contentHash: prior.pdfHash,
          byteLength: prior.bytes,
        })
        : { state: "transient", ownedByAttempt: false };
    }
    if (priorVerification.state === "verified" && priorVerification.file) {
      const matching = await googleDriveFilesByMarker(access.token, marker);
      if (!matching.ok) {
        await finalizeGoogleDriveOperation(env, reservation, "release");
        return json({
          ok: false,
          error: "google_workspace_reconciliation_failed",
          message: "Google Drive could not verify duplicate state. HeirRight did not upload another copy.",
        }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      const duplicateCleanup = await deleteGoogleDriveFilesVerified(
        access.token,
        matching.files.map((file) => stringValue(file.id)).filter((fileId) => fileId !== prior.fileId),
      );
      if (!duplicateCleanup.ok) {
        await finalizeGoogleDriveOperation(env, reservation, "review");
        return json({
          ok: false,
          error: "google_workspace_cleanup_required",
          cleanupRequired: true,
          message: "Google Drive contains an unverified duplicate state. HeirRight will not upload another copy until cleanup is confirmed.",
        }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      const verifiedPrior: StoredGoogleWorkspaceDelivery = {
        ...prior,
        version: 2,
        revision: crypto.randomUUID(),
        estateId: approval.estateId,
        deliveryArtifactId: deliveryArtifact.id,
        deliveryDocumentId: deliveryDocumentId || null,
        flow: approval.flow,
        packetRevision: approval.packetRevision,
        approvedAt: approval.approvedAt,
        approvedBy: approval.approvedBy,
        marker,
        fileUrl: stringValue(priorVerification.file.webViewLink) || prior.fileUrl,
      };
      if (!await persistGoogleWorkspaceDelivery(env, deliveryKey, verifiedPrior)) {
        await finalizeGoogleDriveOperation(env, reservation, "release");
        return json({
          ok: false,
          error: "google_workspace_delivery_readback_failed",
          message: "The existing Drive file is verified, but its internal receipt did not pass readback. No new copy was uploaded.",
        }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      await finalizeGoogleDriveOperation(env, reservation, "release");
      return googleWorkspaceDeliveryResponse(connection, verifiedPrior, { idempotent: true });
    }
    if (priorVerification.state === "transient") {
      await finalizeGoogleDriveOperation(env, reservation, "release");
      return json({
        ok: false,
        error: "google_workspace_readback_unavailable",
        message: "Google Drive could not verify the prior delivery. HeirRight did not upload another copy.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    if (priorVerification.state === "mismatch" && !priorVerification.ownedByAttempt) {
      await finalizeGoogleDriveOperation(env, reservation, "review");
      return json({
        ok: false,
        error: "google_workspace_prior_file_changed",
        cleanupRequired: true,
        message: "The prior Drive file no longer matches its verified receipt. Review it before creating another copy.",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    if (priorVerification.state === "mismatch" && priorVerification.ownedByAttempt) {
      const cleanup = await deleteGoogleDriveFileVerified(access.token, prior.fileId);
      if (!cleanup.ok) {
        await finalizeGoogleDriveOperation(env, reservation, "review");
        return json({
          ok: false,
          error: "google_workspace_cleanup_required",
          cleanupRequired: true,
          message: "The invalid Drive delivery was not verified as deleted. HeirRight did not upload another copy.",
        }, { status: 503, headers: { "cache-control": "no-store" } });
      }
    }
    if (!await deleteGoogleWorkspaceDeliveryReceipt(env, deliveryKey)) {
      await finalizeGoogleDriveOperation(env, reservation, "release");
      return json({
        ok: false,
        error: "google_workspace_delivery_receipt_cleanup_failed",
        message: "The stale Drive delivery receipt was not verified as removed. HeirRight did not upload another copy.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
  }

  const matching = await googleDriveFilesByMarker(access.token, marker);
  if (!matching.ok) {
    await finalizeGoogleDriveOperation(env, reservation, "release");
    return json({
      ok: false,
      error: "google_workspace_reconciliation_failed",
      message: "Google Drive could not verify prior delivery attempts. HeirRight did not upload another copy.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const exactCandidates: Array<{ file: GoogleDriveFileMetadata; pdfHash: string; bytes: number }> = [];
  const mismatchedFileIds: string[] = [];
  for (const file of matching.files) {
    const fileId = stringValue(file.id);
    const candidateHash = stringValue(file.appProperties?.[GOOGLE_DRIVE_CONTENT_PROPERTY]);
    const candidateBytes = Number(file.size);
    if (!fileId || !/^[a-f0-9]{64}$/.test(candidateHash) || !Number.isFinite(candidateBytes) || candidateBytes <= 0) {
      if (fileId) mismatchedFileIds.push(fileId);
      continue;
    }
    const verification = await verifyGoogleDrivePdf(access.token, fileId, {
      marker,
      destinationId: connection.destinationId,
      contentHash: candidateHash,
      byteLength: candidateBytes,
    });
    if (verification.state === "transient") {
      await finalizeGoogleDriveOperation(env, reservation, "review");
      return json({
        ok: false,
        error: "google_workspace_reconciliation_unverified",
        cleanupRequired: true,
        message: "A prior Drive delivery attempt could not be verified. HeirRight did not upload another copy.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    if (verification.state === "verified" && verification.file) {
      exactCandidates.push({ file: verification.file, pdfHash: candidateHash, bytes: candidateBytes });
    } else if (verification.state !== "missing") {
      mismatchedFileIds.push(fileId);
    }
  }
  exactCandidates.sort((left, right) => stringValue(left.file.createdTime).localeCompare(stringValue(right.file.createdTime)));
  const recoveredFile = exactCandidates[0];
  const duplicateFileIds = [
    ...mismatchedFileIds,
    ...exactCandidates.slice(1).map((candidate) => stringValue(candidate.file.id)),
  ];
  const reconciliationCleanup = await deleteGoogleDriveFilesVerified(access.token, duplicateFileIds);
  if (!reconciliationCleanup.ok) {
    await finalizeGoogleDriveOperation(env, reservation, "review");
    return json({
      ok: false,
      error: "google_workspace_cleanup_required",
      cleanupRequired: true,
      message: "A prior Drive delivery attempt was not verified as deleted. HeirRight did not upload another copy.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (recoveredFile?.file.id) {
    const recoveredDelivery: StoredGoogleWorkspaceDelivery = {
      version: 2,
      revision: crypto.randomUUID(),
      artifactId,
      deliveryArtifactId: deliveryArtifact.id,
      deliveryDocumentId: deliveryDocumentId || null,
      estateId: approval.estateId,
      flow: approval.flow,
      packetRevision: approval.packetRevision,
      approvedAt: approval.approvedAt,
      approvedBy: approval.approvedBy,
      destinationId: connection.destinationId,
      fileId: recoveredFile.file.id,
      fileUrl: stringValue(recoveredFile.file.webViewLink) || null,
      marker,
      pdfHash: recoveredFile.pdfHash,
      bytes: recoveredFile.bytes,
      deliveredAt: nowIso(),
    };
    if (!await persistGoogleWorkspaceDelivery(env, deliveryKey, recoveredDelivery)) {
      const cleanup = await deleteGoogleDriveFileVerified(access.token, recoveredDelivery.fileId);
      await deleteGoogleWorkspaceDeliveryReceipt(env, deliveryKey);
      await finalizeGoogleDriveOperation(env, reservation, cleanup.ok ? "release" : "review");
      return json({
        ok: false,
        error: "google_workspace_delivery_readback_failed",
        cleanupRequired: !cleanup.ok,
        message: cleanup.ok
          ? "The recovered Drive file was removed because its internal receipt did not pass readback."
          : "The recovered Drive file and its internal receipt could not be reconciled. HeirRight did not upload another copy.",
      }, { status: 503, headers: { "cache-control": "no-store" } });
    }
    await finalizeGoogleDriveOperation(env, reservation, "release");
    return googleWorkspaceDeliveryResponse(connection, recoveredDelivery, { reconciled: true });
  }

  const estateLabel = stringValue(deliveryArtifact.model.estates?.[0]?.displayName)
    || deliveryArtifact.model.estateIds[0]
    || artifactId;
  const fileName = deliveryDocumentId === "completed-report"
    ? `${estateLabel} Family Tree.pdf`
    : `${artifact.model.flow === "closing-docs" ? "Closing Prep" : "Discovery"} - ${estateLabel}.pdf`;
  const appProperties = googleDriveAppProperties("packet_export", marker, pdfHash, reservation.reservationId);
  const upload = googleMultipartPayload({
    name: fileName,
    mimeType: "application/pdf",
    parents: [connection.destinationId],
    appProperties,
  }, "application/pdf", pdf);
  let created: Response;
  try {
    created = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,size,parents,appProperties,sha256Checksum", {
      method: "POST",
      headers: { authorization: `Bearer ${access.token}`, "content-type": `multipart/related; boundary=${upload.boundary}` },
      body: byteArrayBuffer(upload.body),
    });
  } catch {
    await finalizeGoogleDriveOperation(env, reservation, "review");
    return json({
      ok: false,
      error: "google_workspace_upload_uncertain",
      cleanupRequired: true,
      message: "Google Drive did not confirm whether the upload completed. HeirRight will reconcile the attempt before any retry.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const createdData = await created.json().catch(() => ({})) as Record<string, unknown>;
  const fileId = stringValue(createdData.id);
  if (!created.ok || !fileId) {
    if (fileId) {
      const cleanup = await deleteGoogleDriveFileVerified(access.token, fileId);
      await finalizeGoogleDriveOperation(env, reservation, cleanup.ok ? "release" : "review");
    } else {
      await finalizeGoogleDriveOperation(env, reservation, "review");
    }
    return json({
      ok: false,
      error: "google_workspace_upload_failed",
      cleanupRequired: true,
      message: "Google Drive did not confirm a safe packet upload. HeirRight will reconcile the attempt before any retry.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  const verification = await verifyGoogleDrivePdf(access.token, fileId, {
    marker,
    destinationId: connection.destinationId,
    contentHash: pdfHash,
    byteLength: pdf.byteLength,
  });
  if (verification.state !== "verified" || !verification.file) {
    const cleanup = await deleteGoogleDriveFileVerified(access.token, fileId);
    await finalizeGoogleDriveOperation(env, reservation, cleanup.ok ? "release" : "review");
    return json({
      ok: false,
      error: "google_workspace_readback_failed",
      cleanupRequired: !cleanup.ok,
      cleanup: { deleteReadbackStatus: cleanup.ok ? "verified" : "unverified", attempts: cleanup.attempts },
      message: cleanup.ok
        ? "Google Drive returned the wrong folder, size, marker, or content hash, so HeirRight verified that the invalid copy was removed."
        : "Google Drive returned an invalid readback and the copy was not verified as deleted. HeirRight will not upload another copy.",
    }, { status: cleanup.ok ? 502 : 503, headers: { "cache-control": "no-store" } });
  }
  const delivery: StoredGoogleWorkspaceDelivery = {
    version: 2,
    revision: crypto.randomUUID(),
    artifactId,
    deliveryArtifactId: deliveryArtifact.id,
    deliveryDocumentId: deliveryDocumentId || null,
    estateId: approval.estateId,
    flow: approval.flow,
    packetRevision: approval.packetRevision,
    approvedAt: approval.approvedAt,
    approvedBy: approval.approvedBy,
    destinationId: connection.destinationId,
    fileId,
    fileUrl: stringValue(verification.file.webViewLink) || stringValue(createdData.webViewLink) || null,
    marker,
    pdfHash,
    bytes: pdf.byteLength,
    deliveredAt: nowIso(),
  };
  if (!await persistGoogleWorkspaceDelivery(env, deliveryKey, delivery)) {
    const cleanup = await deleteGoogleDriveFileVerified(access.token, fileId);
    await deleteGoogleWorkspaceDeliveryReceipt(env, deliveryKey);
    await finalizeGoogleDriveOperation(env, reservation, cleanup.ok ? "release" : "review");
    return json({
      ok: false,
      error: "google_workspace_delivery_readback_failed",
      cleanupRequired: !cleanup.ok,
      cleanup: { deleteReadbackStatus: cleanup.ok ? "verified" : "unverified", attempts: cleanup.attempts },
      message: cleanup.ok
        ? "The Drive file was removed because its internal delivery receipt did not pass readback."
        : "The Drive file and its internal receipt did not reconcile. HeirRight will not upload another copy.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  await finalizeGoogleDriveOperation(env, reservation, "release");
  return googleWorkspaceDeliveryResponse(connection, delivery);
}

async function sourceCaptureResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!env.PACKET_ARTIFACTS) {
    return json({
      ok: false,
      error: "source_capture_store_unavailable",
      message: "The canonical Discovery File store is unavailable, so the source capture was not saved.",
    }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const estateId = stringValue(body.assetKey);
  if (!estateId || estateId.length > 500) {
    return json({ ok: false, error: "asset_key_required", message: "Choose a valid estate before saving source evidence." }, { status: 400 });
  }
  const seed = sourceRunSeedFromBody(body, seedFromUrl(new URL(request.url), env));
  const {
    seed: _clientSeed,
    confirmedSourceFacts: _clientConfirmedSourceFacts,
    ...captureInput
  } = withoutClientIdiProof(body);
  const signedActor = await signedSessionEmail(request, env);
  const capture: Record<string, unknown> = {
    ...captureInput,
    assetKey: estateId,
    capturedAt: nowIso(),
    capturedBy: signedActor || (internalBearerAuthorized(request, env) ? "HeirRight app" : "approved HeirRight user"),
  };
  if (new TextEncoder().encode(JSON.stringify(capture)).byteLength > 250_000) {
    return json({ ok: false, error: "source_capture_too_large", message: "This source capture is too large to save safely." }, { status: 413 });
  }
  const runId = `source-capture-${Date.now()}-${crypto.randomUUID()}`;
  const generatedAt = nowIso();
  const capturedSourceFacts = sourceFactsFromCapture(runId, seed, { ...capture, seed });
  const canonicalBeforeCapture = await loadCanonicalDiscoveryFile(env, estateId);
  if (canonicalBeforeCapture.exists
    && !["verified", "verified_recovered_previous"].includes(canonicalBeforeCapture.readbackStatus)) {
    return canonicalEstateReadbackFailure("Source capture", canonicalBeforeCapture.readbackStatus);
  }
  const priorRecord = await latestConfiguredDiscoveryRecord(env, estateId, canonicalBeforeCapture.record);
  const configuredSourceRunVerified = Boolean(priorRecord?.dossier);
  const ownedFactKeys = new Set<string>();
  const ownFacts = (
    section: string,
    source: SourceFact["source"],
    factTypes: SourceFact["factType"][],
  ) => {
    if (!capture[section] || typeof capture[section] !== "object" || Array.isArray(capture[section])) return;
    factTypes.forEach((factType) => ownedFactKeys.add(`${source}:${factType}`));
  };
  ownFacts("taxReceipt", "tax_collector", [
    "source_status",
    "tax_last_paid_by",
    "tax_payer_identity",
    "tax_paid_date",
    "tax_receipt_status",
    "tax_receipt_link",
    "tax_receipt_attachment",
    "tax_amount_due",
    "unpaid_tax_years",
    "tax_reassessment_signal",
  ]);
  ownFacts("deed", "official_records", [
    "official_records_status",
    "deed_history_status",
    "or_book_page",
    "latest_deed",
    "deed_attachment",
    "last_sale_date",
    "ownership_activity_note",
    "mortgage_signal",
    "lien_signal",
    "lis_pendens_signal",
    "foreclosure_signal",
    "adverse_possession_signal",
    "title_signal",
  ]);
  ownFacts("propertyAppraiser", "property_appraiser", [
    "property_owner",
    "owner_type",
    "property_address",
    "property_folio",
    "mailing_address_signal",
  ]);
  ownFacts("probate", "probate_court", [
    "probate_docket_status",
    "case_number",
    "probate_case_status",
    "civil_family_docket_ref",
    "affidavit_of_heirs_status",
    "probate_document_availability",
  ]);
  ownFacts("probate", "official_records", ["official_record_cross_link"]);
  ownFacts("obituary", "clerk_of_courts", [
    "marriage_death_status",
    "marriage_license_signal",
    "date_of_birth",
    "date_of_death",
    "obituary_link",
    "obituary_snapshot",
    "memorial_search_tasks",
    "death_certificate_status",
    "incarceration_status_signal",
  ]);
  const priorSourceFacts = configuredSourceRunVerified && Array.isArray(priorRecord?.sourceFacts)
    ? priorRecord.sourceFacts as SourceFact[]
    : [];
  const inheritedSourceFacts = priorSourceFacts.filter((factItem) => (
    factItem?.source !== "idi"
      && !ownedFactKeys.has(`${factItem?.source}:${factItem?.factType}`)
  ));
  const canonicalIdiFacts = configuredSourceRunVerified
    ? await storedIdiImportFacts(env, runId, seed, estateId)
    : [];
  const sourceFacts = configuredSourceRunVerified
    ? [...inheritedSourceFacts, ...capturedSourceFacts, ...canonicalIdiFacts]
    : capturedSourceFacts;
  const dossier = configuredSourceRunVerified
    ? await rebuildDiscoveryDossier(runId, sourceFacts)
    : null;
  const sourceSummaries = summarizeSourceRunFacts(sourceFacts);
  const sourceRunProof = sourceRunProofLedger(sourceSummaries, sourceFacts);
  const reviewFlags = [...new Set(sourceFacts.flatMap((item) => item.reviewFlags))];
  const blockers = dossier
    ? Array.from(new Set([
        ...canonicalStopReasons({ seed, capture, sourceFacts, dossier }).map((reason) => reason.message),
        ...sourceSummaries
          .filter((summary) => summary.status === "blocked" || summary.status === "needs_review")
          .map((summary) => String(summary.nextAction)),
        ...(dossier.audit.reviewFlags.includes("SOURCE_BLOCKED")
          ? ["One or more Discovery sources are blocked; keep the packet in review."]
          : []),
      ]))
    : [
        sourceFacts.length
          ? "Run Discovery once to reconcile the saved source capture with configured sources before generating a packet."
          : "The saved capture contains no structured source facts. Review the fields and run Discovery before generating a packet.",
      ];
  const record = {
    version: 1,
    flow: "discovery",
    mode: dossier ? "source_capture_reconcile" : "source_capture",
    configuredSourceRunVerified,
    estateId,
    revision: runId,
    generatedAt,
    seed,
    capture,
    sourceSummaries,
    sourceRunProof,
    sourceFacts,
    blockers,
    ...(dossier ? { dossier } : {}),
  };
  let persistence: Record<string, unknown>;
  try {
    persistence = await persistDiscoveryFile(env, record);
  } catch {
    return json({
      ok: false,
      error: "source_capture_store_failed",
      message: "The source capture was not saved because the canonical Discovery File write failed.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (persistence.readbackStatus !== "verified") {
    return json({
      ok: false,
      error: "source_capture_readback_failed",
      persistence,
      message: "The source capture did not pass canonical Discovery File readback, so it was not applied.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return json({
    ok: true,
    mode: record.mode,
    configuredSourceRunVerified,
    id: runId,
    estateId,
    runId,
    generatedAt,
    capturedAt: capture.capturedAt,
    seed,
    capture,
    sourceSummaries,
    sourceRunProof,
    sourceFacts,
    blockers,
    reviewFlags,
    ...(dossier ? { dossier } : {}),
    persistence,
    readbackStatus: "verified",
    message: dossier
      ? "Source capture passed canonical readback and refreshed the reviewed dossier without another configured public-source search."
      : sourceFacts.length
        ? "Source capture passed canonical Discovery File readback. Run Discovery once to reconcile it with configured sources."
        : "Source capture passed canonical readback, but no structured source facts were detected.",
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
  const confirmedSourceFactsInput = Array.isArray(seed.confirmedSourceFacts)
    ? seed.confirmedSourceFacts
    : Array.isArray(body.confirmedSourceFacts) ? body.confirmedSourceFacts : fallback.confirmedSourceFacts;
  const confirmedSourceFacts = confirmedSourceFactsInput?.filter((factItem) =>
    stringValue(objectValue(factItem).source).toLowerCase() !== "idi"
  ) as IntakeSeed["confirmedSourceFacts"];
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
    ...(confirmedSourceFacts ? { confirmedSourceFacts } : {}),
  };
}

function withoutClientIdiProof(capture: Record<string, unknown>): Record<string, unknown> {
  const {
    idiAssetImport: _idiAssetImport,
    idiImport: _idiImport,
    idiImportedText: _idiImportedText,
    contactReviews: _contactReviews,
    ...safeCapture
  } = capture;
  return safeCapture;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function compactObject(input: Record<string, unknown> = {}): Record<string, unknown> | undefined {
  const output = Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return value !== undefined && value !== null && value !== "";
  }));
  return Object.keys(output).length ? output : undefined;
}

const BROWSERBASE_BATCH_APPROVAL_MARKER = "approved_paid_browserbase_batch_run";

function truthyEnvValue(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(stringValue(value).toLowerCase());
}

function positiveIntegerEnvValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function browserbaseBatchEstateCount(body: Record<string, unknown> = {}): number {
  if (Array.isArray(body.estates)) return body.estates.length;
  if (Array.isArray(body.rows)) return body.rows.length;
  if (Array.isArray(body.items)) return body.items.length;
  if (Number(body.estateCount) > 0) return Math.floor(Number(body.estateCount));
  if (Number(body.count) > 0) return Math.floor(Number(body.count));
  return 1;
}

function browserbaseBatchRequested(body: Record<string, unknown> = {}): boolean {
  return body.batch === true
    || body.isBatch === true
    || body.batchRun === true
    || stringValue(body.mode).toLowerCase() === "batch"
    || browserbaseBatchEstateCount(body) > 1;
}

function browserbaseBatchApproved(body: Record<string, unknown> = {}, env: CloudflareEnv): boolean {
  return truthyEnvValue(env.BROWSERBASE_BATCH_RUN_APPROVED)
    || body.browserbaseUsageApproval === BROWSERBASE_BATCH_APPROVAL_MARKER
    || body.browserbaseBatchApproval === BROWSERBASE_BATCH_APPROVAL_MARKER
    || body.approvalMarker === BROWSERBASE_BATCH_APPROVAL_MARKER;
}

function browserbaseBatchGuard(body: Record<string, unknown> = {}, env: CloudflareEnv): Record<string, unknown> | null {
  if (!browserbaseBatchRequested(body)) return null;
  const maxBatchSessions = positiveIntegerEnvValue(env.BROWSERBASE_BATCH_MAX_SESSIONS, 10);
  const batchCount = browserbaseBatchEstateCount(body);
  if (batchCount > maxBatchSessions) {
    return {
      code: "BROWSERBASE_BATCH_LIMIT_EXCEEDED",
      batchCount,
      maxBatchSessions,
      message: `Browserbase batch source runs are capped at ${maxBatchSessions} estates per approval. Split this batch before running paid browser capture.`,
    };
  }
  if (env.BROWSERBASE_BATCH_APPROVAL_REQUIRED !== "false" && !browserbaseBatchApproved(body, env)) {
    return {
      code: "BROWSERBASE_BATCH_APPROVAL_REQUIRED",
      batchCount,
      maxBatchSessions,
      message: "Browserbase paid batch source runs need explicit batch approval before Tax Collector or vital-source browser capture starts.",
    };
  }
  return null;
}

function taxCollectorInputFromSourceRun(body: Record<string, unknown>, seed: IntakeSeed, capture: Record<string, unknown>): Record<string, unknown> {
  const taxReceipt = objectValue(capture.taxReceipt);
  const seedExtras = seed as IntakeSeed & Record<string, unknown>;
  const propertyAppraiser = objectValue(capture.propertyAppraiser || seedExtras.propertyAppraiserEvidence);
  return {
    listingHtml: taxReceipt.listingHtml || body.listingHtml,
    receiptHtml: taxReceipt.receiptHtml || body.receiptHtml,
    listingText: taxReceipt.listingText || body.listingText,
    receiptText: taxReceipt.receiptText || body.receiptText,
    detailsText: taxReceipt.detailsText || body.detailsText,
    listingUrl: taxReceipt.listingUrl || taxReceipt.sourceUrl || seed.taxCollectorListingUrl || body.listingUrl || body.sourceUrl,
    receiptUrl: taxReceipt.receiptUrl || taxReceipt.receiptLink || taxReceipt.sourceUrl || seed.taxCollectorReceiptUrl || body.receiptUrl || body.receiptLink,
    receiptLink: taxReceipt.receiptLink || seed.taxCollectorReceiptUrl || body.receiptLink,
    sourceUrl: taxReceipt.sourceUrl || body.sourceUrl,
    paidBy: taxReceipt.paidBy || body.paidBy,
    payerIdentity: taxReceipt.payerIdentity || body.payerIdentity,
    paidDate: taxReceipt.paidDate || body.paidDate,
    amountDue: taxReceipt.amountDue || body.amountDue,
    unpaidYears: taxReceipt.unpaidYears || body.unpaidYears,
    reassessment: taxReceipt.reassessment || body.reassessment,
    status: taxReceipt.status || body.status,
    parcelId: seed.parcelId || propertyAppraiser.folio || propertyAppraiser.parcelId || body.parcelId || body.folio,
    propertyAddress: seed.propertyAddress || body.propertyAddress || body.address,
    ownerName: seed.ownerName || seed.estateName || body.ownerName || body.owner || body.estateName,
  };
}

function taxCollectorHasTarget(input: Record<string, unknown>): boolean {
  return Boolean(
    stringValue(input.parcelId)
      || stringValue(input.propertyAddress)
      || stringValue(input.ownerName)
      || stringValue(input.listingUrl)
      || stringValue(input.receiptUrl)
      || stringValue(input.receiptLink)
      || stringValue(input.listingHtml)
  );
}

function taxCollectorRunFromAcquisition(
  seed: IntakeSeed,
  input: Record<string, unknown>,
  acquisition: Awaited<ReturnType<typeof acquireTaxCollectorReceipt>>,
): Record<string, unknown> {
  const details = {
    ...extractTaxCollectorDetails(input),
    ...(acquisition.discovery?.details || {}),
  };
  const receiptUrl = acquisition.discovery?.receiptUrl || "";
  const receipt = compactObject({
    receiptUrl,
    artifactUrl: receiptUrl,
    contentType: /\.pdf($|\?)/i.test(receiptUrl) ? "application/pdf" : receiptUrl ? "text/html" : undefined,
    paidBy: details.paidBy,
    payerIdentity: details.payerIdentity,
    paidDate: details.paidDate,
    amountDue: details.amountDue,
    unpaidYears: details.unpaidYears,
    reassessment: details.reassessment,
    receiptStatus: details.receiptStatus || (receiptUrl ? "receipt_link_captured" : undefined),
    receiptLinkPosition: acquisition.discovery?.mode === "listing_page_bottom_right" ? "listing_page_bottom_right" : acquisition.discovery?.mode,
  }) || {};
  const matchedListing = compactObject({
    listingUrl: acquisition.discovery?.listingUrl || acquisition.finalUrl || acquisition.listingUrl,
    sourcePage: acquisition.finalUrl || acquisition.listingUrl || acquisition.discovery?.listingUrl,
    status: acquisition.status,
    matchReason: acquisition.discovery
      ? "Matched from folio/address search result and captured the bottom-right receipt link."
      : acquisition.mode === "browser_workflow_required"
        ? "Public search requires the controlled browser workflow before listing review can complete."
        : "No matching Tax Collector listing was confirmed.",
  }) || {};
  const blocker = acquisition.ok
    ? ""
    : acquisition.blocker || "Tax Collector receipt run did not return the bottom-right receipt link.";
  return {
    ok: Boolean(acquisition.ok && receiptUrl),
    mode: acquisition.mode,
    flow: "tax_collector_receipt",
    estateId: seedIdentity(seed),
    paidRun: acquisition.paidRun,
    searchInput: {
      estateId: seedIdentity(seed),
      county: seed.county || "miami-dade",
      folio: stringValue(input.parcelId),
      propertyAddress: stringValue(input.propertyAddress),
      ownerName: stringValue(input.ownerName),
      searchUrl: acquisition.searchUrl,
    },
    matchedListing,
    receipt,
    sourceEvidence: compactObject({
      source: "tax_collector",
      sourcePage: matchedListing.sourcePage,
      searchUrl: acquisition.searchUrl,
      finalUrl: acquisition.finalUrl,
      status: acquisition.status,
      fetchedAt: nowIso(),
      bodySnippet: acquisition.bodySnippet,
      reviewFlags: acquisition.reviewFlags,
    }),
    blockers: blocker ? [blocker] : [],
    reviewRequired: true,
    reviewFlags: acquisition.reviewFlags,
    message: acquisition.ok && receiptUrl
      ? "Tax Collector listing was reached from estate facts and the bottom-right receipt link was captured for review."
      : blocker,
  };
}

function addTaxFact(
  facts: SourceFact[],
  runId: string,
  seed: IntakeSeed,
  factType: SourceFact["factType"],
  value: unknown,
  sourceUrl: string | undefined,
  reviewFlags: ReviewFlag[],
  confidence = 0.78,
): void {
  if (!factValuePresent(value)) return;
  facts.push(fact({
    runId,
    source: "tax_collector",
    rawId: `tax-collector:${slug(String(factType))}`,
    fetchedAt: nowIso(),
    county: seed.county || "miami-dade",
    subject: intakeSubject(seed),
    factType,
    value,
    confidence,
    sourceUrl,
    reviewFlags,
  }));
}

function taxCollectorSourceFactsFromRun(runId: string, seed: IntakeSeed, run: Record<string, unknown>): SourceFact[] {
  const receipt = objectValue(run.receipt);
  const matchedListing = objectValue(run.matchedListing);
  const sourceEvidence = objectValue(run.sourceEvidence);
  const flags = (Array.isArray(run.reviewFlags) ? run.reviewFlags : []) as ReviewFlag[];
  const sourceUrl = stringValue(receipt.receiptUrl) || stringValue(matchedListing.listingUrl) || stringValue(sourceEvidence.sourcePage) || stringValue(sourceEvidence.searchUrl) || undefined;
  const facts: SourceFact[] = [];
  addTaxFact(facts, runId, seed, "source_status", compactObject({
    mode: run.mode,
    ok: Boolean(run.ok),
    listingUrl: matchedListing.listingUrl,
    receiptUrl: receipt.receiptUrl,
    searchUrl: sourceEvidence.searchUrl,
    note: run.message,
    status: sourceEvidence.status,
  }), sourceUrl, flags, run.ok ? 0.86 : 0.35);
  addTaxFact(facts, runId, seed, "tax_receipt_status", receipt.receiptStatus || run.mode, sourceUrl, flags, run.ok ? 0.86 : 0.35);
  addTaxFact(facts, runId, seed, "tax_receipt_link", receipt.receiptUrl, stringValue(receipt.receiptUrl) || sourceUrl, flags, 0.9);
  addTaxFact(facts, runId, seed, "tax_receipt_attachment", receipt.receiptUrl ? {
    label: "Tax Collector receipt",
    sourceUrl: receipt.receiptUrl,
    fileKind: receipt.contentType === "application/pdf" ? "pdf" : "link",
    capturedAt: stringValue(sourceEvidence.fetchedAt) || nowIso(),
    capturedBy: "tax-collector-receipt-run",
    reviewFlags: flags,
  } : null, stringValue(receipt.receiptUrl) || sourceUrl, flags, 0.9);
  addTaxFact(facts, runId, seed, "tax_last_paid_by", receipt.paidBy, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addTaxFact(facts, runId, seed, "tax_payer_identity", receipt.payerIdentity || receipt.paidBy, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addTaxFact(facts, runId, seed, "tax_paid_date", receipt.paidDate, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addTaxFact(facts, runId, seed, "tax_amount_due", receipt.amountDue, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addTaxFact(facts, runId, seed, "unpaid_tax_years", receipt.unpaidYears, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.78);
  addTaxFact(facts, runId, seed, "tax_reassessment_signal", receipt.reassessment, sourceUrl, ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"], 0.7);
  return facts;
}

function browserbaseBatchGuardFacts(runId: string, seed: IntakeSeed, guard: Record<string, unknown>): SourceFact[] {
  return [fact({
    runId,
    source: "tax_collector",
    rawId: "tax-collector:browserbase-batch-guard",
    fetchedAt: nowIso(),
    county: seed.county || "miami-dade",
    subject: intakeSubject(seed),
    factType: "source_status",
    value: compactObject({
      mode: "browserbase_batch_blocked",
      ok: false,
      note: guard.message,
      batchCount: guard.batchCount,
      maxBatchSessions: guard.maxBatchSessions,
    }),
    confidence: 0.35,
    reviewFlags: [String(guard.code || "BROWSERBASE_BATCH_APPROVAL_REQUIRED") as ReviewFlag, "SOURCE_BLOCKED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
  })];
}

function idiSourceAttachmentKind(record: StoredIdiImport): SourceAttachmentRef["fileKind"] {
  if (record.attachment.contentType === "application/pdf") return "pdf";
  if (record.attachment.contentType === "text/csv") return "csv";
  if (record.attachment.contentType.startsWith("image/")) return "image";
  return "text";
}

function canonicalIdiCandidate(
  candidate: StoredIdiImport["candidates"][number],
  review?: StoredIdiContactReview,
): Record<string, unknown> {
  return {
    id: candidate.id,
    name: candidate.name,
    relationship: candidate.relationship,
    age: candidate.age,
    interest: candidate.interest,
    group: candidate.group,
    phones: candidate.phones,
    emails: candidate.emails,
    currentAddress: candidate.currentAddress,
    addressHistory: candidate.addressHistory,
    addressHistoryDetails: candidate.addressHistoryDetails,
    ownerLastNameMatch: candidate.ownerLastNameMatch,
    confidence: candidate.confidence,
    reviewStatus: review?.status || (candidate.reviewStatus === "auto_accepted_high_confidence" ? "accepted" : "imported"),
  };
}

async function storedIdiImportFacts(
  env: CloudflareEnv,
  runId: string,
  seed: IntakeSeed,
  assetKey: string,
): Promise<SourceFact[]> {
  if (!env.PACKET_ARTIFACTS || !assetKey) return [];
  const record = storedIdiImport(await env.PACKET_ARTIFACTS.get(await idiImportKey(assetKey)));
  if (!record || !storedIdiImportIsCanonical(record) || record.assetKey !== assetKey) return [];
  const reviews = await storedIdiContactReviews(env, record);
  const paidRunApproved = record.paidRun === true && record.paidRunVerification === "verified";
  return buildIdiAssetSearchFacts(runId, seed, {
    provider: record.provider,
    mode: record.mode,
    paidRun: record.paidRun,
    paidRunApproved,
    paidRunVerification: record.paidRunVerification || (record.paidRun ? "review_required" : "not_applicable"),
    approvalRecord: paidRunApproved ? { lockKey: record.lockKey, importedAt: record.importedAt, readbackStatus: "verified" } : undefined,
    readbackStatus: record.paidRun && !paidRunApproved ? "review_required" : "verified",
    candidates: record.candidates.map((candidate) => canonicalIdiCandidate(candidate, reviews.get(candidate.id))),
    capturedBy: record.importedBy,
    adminOverrideReason: record.adminOverrideReason || undefined,
    attachment: {
      label: record.attachment.fileName || "IDI expanded asset search",
      sourceUrl: record.attachment.artifactUrl,
      fileKind: idiSourceAttachmentKind(record),
      fileName: record.attachment.fileName,
      capturedAt: record.importedAt,
      capturedBy: record.importedBy,
      reviewFlags: ["IDI_ASSET_SEARCH_REVIEW_REQUIRED"],
    },
  });
}

function factValuePresent(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function sourceFactHasBlockingFlag(factItem: SourceFact): boolean {
  return (factItem.reviewFlags || []).some((flag) =>
    flag === "SOURCE_HEALTH_ONLY"
      || flag === "SOURCE_BLOCKED"
      || flag === "PAID_SOURCE_APPROVAL_REQUIRED"
      || flag === "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED"
      || flag === "MISSING_SKIPTRACE_CONFIG"
      || String(flag).startsWith("MISSING_")
  );
}

function sourceEvidenceFacts(facts: SourceFact[]): SourceFact[] {
  return facts.filter((factItem) =>
    factValuePresent(factItem.value)
      && factItem.factType !== "source_status"
      && factItem.factType !== "source_search_url"
      && !sourceFactHasBlockingFlag(factItem)
  );
}

function summarizeSourceRunFacts(facts: SourceFact[]): Array<Record<string, unknown>> {
  return discoverySourceLabels.map((item) => {
    const sourceFacts = facts.filter((factItem) => factItem.source === item.source);
    const flags = Array.from(new Set(sourceFacts.flatMap((factItem) => factItem.reviewFlags || [])));
    const sourceStatusFact = sourceFacts.find((factItem) => factItem.factType === "source_status")
      || sourceFacts.find((factItem) => `${factItem.factType}`.endsWith("_status"));
    const extractedFacts = sourceEvidenceFacts(sourceFacts);
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
  if (source === "tax_collector") return "Direct Tax Collector listing, approved Browserbase capture, or saved browser workflow";
  if (source === "official_records" || source === "probate_court") return "Miami-Dade Clerk Commercial Data Services access with prepaid units";
  if (source === "clerk_of_courts") return "Approved Browserbase vital-source capture or saved vital-source workflow";
  if (source === "idi") return "IDI Core vendor API access with shared team approval, personal approved key, or approved operator report import";
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

function governanceCatalogFromFacts(sourceFacts: SourceFact[] = []): Record<string, unknown> | null {
  const factItem = sourceFacts.find((item) =>
    item.source === "source_governance"
      && item.factType === "source_governance_catalog"
      && item.value
      && typeof item.value === "object"
  );
  return factItem?.value && typeof factItem.value === "object" ? factItem.value as Record<string, unknown> : null;
}

function sourceDetailChecks(source: string, sourceFacts: SourceFact[] = []): Array<Record<string, unknown>> {
  const catalog = governanceCatalogFromFacts(sourceFacts);
  if (!catalog) return [];
  const publicContracts = Array.isArray(catalog.publicSourceContracts) ? catalog.publicSourceContracts as Array<Record<string, unknown>> : [];
  const governedSources = Array.isArray(catalog.governedSources) ? catalog.governedSources as Array<Record<string, unknown>> : [];
  const manualTasks = Array.isArray(catalog.manualTasks) ? catalog.manualTasks as Array<Record<string, unknown>> : [];
  const contract = publicContracts.find((item) => item && item.source === source);
  const checks: Array<Record<string, unknown>> = [];
  const stages = contract && Array.isArray(contract.stages) ? contract.stages as Array<Record<string, unknown>> : [];
  checks.push(...stages.map((stage) => ({
    code: stage.code,
    label: stage.title,
    type: "source_evidence_step",
    accessClass: contract?.accessClass,
    status: stage.blocksUntilCaptured ? "evidence_required" : "review_required",
    operatorAction: stage.operatorAction,
    requiredEvidence: Array.isArray(stage.requiredEvidence) ? stage.requiredEvidence : [],
    blocksUntilCaptured: Boolean(stage.blocksUntilCaptured),
    automationAllowed: Boolean(contract?.automationAllowed),
    legalTemplateAutofillAllowed: false,
  })));
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

const detailEvidenceFactTypes: Record<string, string[]> = {
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

function sourceStatusEvidence(source: string, code: unknown, facts: SourceFact[] = []): SourceFact[] {
  const statuses = facts.filter((factItem) =>
    factItem.source === source
      && factItem.factType === "source_status"
      && factValuePresent(factItem.value)
  );
  return statuses.filter((factItem) => {
    if (sourceFactHasBlockingFlag(factItem)) return false;
    const value = factItem.value && typeof factItem.value === "object" ? factItem.value as Record<string, unknown> : {};
    if (code === "tax_search" || code === "listing_page") return Boolean(value.listingUrl || value.receiptUrl || value.ok);
    if (code === "case_lookup") return Boolean(value.caseStatus || value.caseType || value.docketCount || value.ok);
    return Boolean(value.ok);
  });
}

function satisfiedEvidenceForCheck(source: string, check: Record<string, unknown>, sourceFacts: SourceFact[] = []): Array<Record<string, unknown>> {
  const codes = detailEvidenceFactTypes[String(check.code || "")] || [];
  const facts = sourceFacts.filter((factItem) => factItem.source === source);
  const checkCode = String(check.code || "");
  const byFactType = facts.filter((factItem) =>
    codes.includes(String(factItem.factType))
      && factValuePresent(factItem.value)
      && !sourceFactHasBlockingFlag(factItem)
      && (checkCode !== "idi_contact_review" || ["accepted", "promoted"].includes(String((factItem.value as Record<string, unknown> | undefined)?.reviewStatus || "")))
      && (checkCode !== "idi_paid_run_approval" || (() => {
        const value = factItem.value as Record<string, unknown> | undefined;
        const approval = value?.approvalRecord && typeof value.approvalRecord === "object"
          ? value.approvalRecord as Record<string, unknown>
          : null;
        return value?.paidRunApproved === true && approval?.readbackStatus === "verified";
      })())
  );
  const statusFacts = sourceStatusEvidence(source, check.code, facts);
  return [...byFactType, ...statusFacts].map((factItem) => ({
    factType: factItem.factType,
    sourceUrl: factItem.sourceUrl || factItem.attachment?.sourceUrl,
    rawId: factItem.rawId,
  }));
}

function applySourceDetailEvidence(source: string, check: Record<string, unknown>, sourceFacts: SourceFact[] = []): Record<string, unknown> {
  const satisfiedBy = satisfiedEvidenceForCheck(source, check, sourceFacts);
  if (!satisfiedBy.length) return check;
  return {
    ...check,
    status: "evidence_returned_review_required",
    resolved: true,
    satisfiedFactTypes: Array.from(new Set(satisfiedBy.map((item) => item.factType))),
    satisfiedBy,
    legalTemplateAutofillAllowed: false,
  };
}

function detailCheckBlocks(check: Record<string, unknown>): boolean {
  const status = String(check.status || "");
  return Boolean(check.blocksUntilCaptured)
    && !["evidence_returned_review_required", "ready_for_review", "complete", "completed"].includes(status);
}

function sourceRunProofLedger(sourceSummaries: Array<Record<string, unknown>>, sourceFacts: SourceFact[] = []): Record<string, unknown> {
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
    total + (Array.isArray(item.detailChecks) ? (item.detailChecks as Array<Record<string, unknown>>).filter(detailCheckBlocks).length : 0), 0);
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

async function discoveryFileKey(estateId: string): Promise<string> {
  return `discovery-file:${await sha256Hex(estateId)}`;
}

async function discoveryFileRevisionKey(estateId: string, contentHash: string): Promise<string> {
  return `${await discoveryFileKey(estateId)}:revision:${contentHash}`;
}

interface DiscoveryFileCommandResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}

interface CanonicalDiscoveryFileLoad {
  record: Record<string, unknown> | null;
  exists: boolean;
  readbackStatus: string;
  pointer?: DiscoveryFilePointer;
}

function discoveryFilePointer(value: unknown): DiscoveryFilePointer | undefined {
  const input = objectValue(value);
  const pointer = {
    storageKey: stringValue(input.storageKey),
    contentHash: stringValue(input.contentHash).toLowerCase(),
    revision: stringValue(input.revision),
  };
  return /^discovery-file:[a-f0-9]{64}(?::revision:[a-f0-9]{64})?$/.test(pointer.storageKey)
    && /^[a-f0-9]{64}$/.test(pointer.contentHash)
    && Boolean(pointer.revision)
    ? pointer
    : undefined;
}

async function discoveryFileCommand(env: CloudflareEnv, payload: Record<string, unknown>): Promise<DiscoveryFileCommandResult> {
  if (!env.WORKSPACE_STATE) {
    return {
      ok: false,
      status: 503,
      data: {
        error: "discovery_file_serialization_unavailable",
        message: "Canonical Discovery File serialization is unavailable. The prior verified file remains active.",
      },
    };
  }
  try {
    const id = env.WORKSPACE_STATE.idFromName("heirright-team-workspace");
    const response = await env.WORKSPACE_STATE.get(id).fetch(new Request("https://workspace-state.internal/discovery-file-operation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }));
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { ok: response.ok && data.ok !== false, status: response.status, data };
  } catch {
    return {
      ok: false,
      status: 503,
      data: {
        error: "discovery_file_serialization_unavailable",
        message: "Canonical Discovery File serialization is unavailable. The prior verified file remains active.",
      },
    };
  }
}

async function verifiedDiscoveryFileAtPointer(
  env: CloudflareEnv,
  estateId: string,
  pointer: DiscoveryFilePointer,
): Promise<Record<string, unknown> | null> {
  if (!env.PACKET_ARTIFACTS) return null;
  const expectedPrefix = `${await discoveryFileKey(estateId)}`;
  if (pointer.storageKey !== expectedPrefix && !pointer.storageKey.startsWith(`${expectedPrefix}:revision:`)) return null;
  const serialized = await env.PACKET_ARTIFACTS.get(pointer.storageKey);
  if (!serialized || await sha256Hex(serialized) !== pointer.contentHash) return null;
  try {
    const record = JSON.parse(serialized) as Record<string, unknown>;
    return stringValue(record.estateId) === estateId && stringValue(record.revision) === pointer.revision
      ? record
      : null;
  } catch {
    return null;
  }
}

async function legacyDiscoveryFilePointer(
  env: CloudflareEnv,
  estateId: string,
): Promise<{ pointer: DiscoveryFilePointer; record: Record<string, unknown> } | null> {
  if (!env.PACKET_ARTIFACTS) return null;
  const storageKey = await discoveryFileKey(estateId);
  const serialized = await env.PACKET_ARTIFACTS.get(storageKey);
  if (!serialized) return null;
  try {
    const record = JSON.parse(serialized) as Record<string, unknown>;
    const revision = stringValue(record.revision);
    if (!revision || stringValue(record.estateId) !== estateId) return null;
    return {
      pointer: { storageKey, contentHash: await sha256Hex(serialized), revision },
      record,
    };
  } catch {
    return null;
  }
}

async function loadCanonicalDiscoveryFile(env: CloudflareEnv, estateId: string): Promise<CanonicalDiscoveryFileLoad> {
  if (!env.PACKET_ARTIFACTS || !env.WORKSPACE_STATE) {
    return { record: null, exists: false, readbackStatus: "storage_unavailable" };
  }
  const estateHash = await sha256Hex(estateId);
  const status = await discoveryFileCommand(env, { action: "status", estateHash });
  if (!status.ok) {
    if (status.status === 404 || status.data.error === "discovery_file_operation_not_found") {
      const legacy = await legacyDiscoveryFilePointer(env, estateId);
      return legacy
        ? { record: legacy.record, exists: true, readbackStatus: "verified", pointer: legacy.pointer }
        : { record: null, exists: false, readbackStatus: "verified" };
    }
    return { record: null, exists: false, readbackStatus: stringValue(status.data.error) || "serialization_failed" };
  }
  const active = discoveryFilePointer(status.data.active);
  const previous = discoveryFilePointer(status.data.previous);
  if (!active) {
    const legacy = await legacyDiscoveryFilePointer(env, estateId);
    return legacy
      ? { record: legacy.record, exists: true, readbackStatus: "verified", pointer: legacy.pointer }
      : { record: null, exists: false, readbackStatus: "verified" };
  }
  const activeRecord = await verifiedDiscoveryFileAtPointer(env, estateId, active);
  if (activeRecord) return { record: activeRecord, exists: true, readbackStatus: "verified", pointer: active };

  const previousRecord = previous ? await verifiedDiscoveryFileAtPointer(env, estateId, previous) : null;
  if (!previous || !previousRecord) {
    return { record: null, exists: true, readbackStatus: "canonical_readback_failed", pointer: active };
  }
  const rollback = await discoveryFileCommand(env, {
    action: "rollback",
    estateHash,
    reservationId: stringValue(status.data.reservationId),
    candidateStorageKey: active.storageKey,
    candidateContentHash: active.contentHash,
    candidateRevision: active.revision,
  });
  if (!rollback.ok || discoveryFilePointer(rollback.data.active)?.contentHash !== previous.contentHash) {
    return { record: null, exists: true, readbackStatus: "canonical_recovery_failed", pointer: active };
  }
  return { record: previousRecord, exists: true, readbackStatus: "verified_recovered_previous", pointer: previous };
}

async function latestConfiguredDiscoveryRecord(
  env: CloudflareEnv,
  estateId: string,
  activeRecord: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (activeRecord?.dossier
    && (
      activeRecord.configuredSourceRunVerified === true
      || stringValue(activeRecord.mode) === "external_source_run"
      || !stringValue(activeRecord.mode)
    )) {
    return activeRecord;
  }
  if (!env.PACKET_ARTIFACTS?.list) return null;
  const prefix = `${await discoveryFileKey(estateId)}:revision:`;
  const candidates: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  try {
    for (let page = 0; page < 3; page += 1) {
      const listing = await env.PACKET_ARTIFACTS.list({ prefix, cursor, limit: 50 });
      const records = await Promise.all(listing.keys.map(async ({ name }) => {
        const serialized = await env.PACKET_ARTIFACTS?.get(name);
        if (!serialized) return null;
        const contentHash = await sha256Hex(serialized);
        if (name !== await discoveryFileRevisionKey(estateId, contentHash)) return null;
        try {
          const record = JSON.parse(serialized) as Record<string, unknown>;
          const mode = stringValue(record.mode);
          return stringValue(record.estateId) === estateId
            && record.dossier
            && (record.configuredSourceRunVerified === true || mode === "external_source_run" || !mode)
            ? record
            : null;
        } catch {
          return null;
        }
      }));
      candidates.push(...records.filter((record): record is Record<string, unknown> => Boolean(record)));
      if (listing.list_complete || !listing.cursor) break;
      cursor = listing.cursor;
    }
  } catch {
    return null;
  }
  return candidates.sort((a, b) => (
    (Date.parse(stringValue(b.generatedAt)) || 0) - (Date.parse(stringValue(a.generatedAt)) || 0)
  ))[0] || null;
}

async function persistDiscoveryFile(env: CloudflareEnv, record: Record<string, unknown>): Promise<Record<string, unknown>> {
  const estateId = stringValue(record.estateId);
  const revision = stringValue(record.revision);
  if (!env.PACKET_ARTIFACTS || !env.WORKSPACE_STATE || !estateId || !revision) {
    return { stored: false, readbackStatus: "storage_unavailable", revision };
  }
  const serialized = JSON.stringify(record);
  const contentHash = await sha256Hex(serialized);
  const estateHash = await sha256Hex(estateId);
  const candidateStorageKey = await discoveryFileRevisionKey(estateId, contentHash);
  const legacy = await legacyDiscoveryFilePointer(env, estateId);
  const requestedReservationId = crypto.randomUUID();
  const reserve = await discoveryFileCommand(env, {
    action: "reserve",
    estateHash,
    reservationId: requestedReservationId,
    candidateContentHash: contentHash,
    candidateRevision: revision,
    ...(legacy ? {
      legacyStorageKey: legacy.pointer.storageKey,
      legacyContentHash: legacy.pointer.contentHash,
      legacyRevision: legacy.pointer.revision,
    } : {}),
  });
  if (!reserve.ok) {
    return {
      stored: false,
      readbackStatus: stringValue(reserve.data.error) || "reservation_failed",
      revision,
      status: reserve.status,
    };
  }
  const reservationId = stringValue(reserve.data.reservationId) || requestedReservationId;
  const reservedActive = discoveryFilePointer(reserve.data.active);
  if (reserve.data.idempotent === true && reservedActive?.contentHash === contentHash) {
    const readback = await verifiedDiscoveryFileAtPointer(env, estateId, reservedActive);
    return readback
      ? { stored: true, readbackStatus: "verified", revision, contentHash, storageKey: reservedActive.storageKey, idempotent: true }
      : { stored: false, readbackStatus: "idempotent_readback_failed", revision, contentHash };
  }

  let stageVerified = false;
  try {
    await env.PACKET_ARTIFACTS.put(candidateStorageKey, serialized, {
      expirationTtl: documentRetentionSeconds(env),
      metadata: { kind: "discovery_file_revision", estateId, revision, contentHash },
    });
    stageVerified = Boolean(await verifiedDiscoveryFileAtPointer(env, estateId, {
      storageKey: candidateStorageKey,
      contentHash,
      revision,
    }));
  } catch {
    stageVerified = false;
  }
  if (!stageVerified) {
    await discoveryFileCommand(env, { action: "abort", estateHash, reservationId });
    await env.PACKET_ARTIFACTS.delete(candidateStorageKey).catch(() => undefined);
    return { stored: false, readbackStatus: "stage_readback_failed", revision, contentHash };
  }

  const candidate = { storageKey: candidateStorageKey, contentHash, revision };
  let commit = await discoveryFileCommand(env, {
    action: "commit",
    estateHash,
    reservationId,
    candidateStorageKey,
    candidateContentHash: contentHash,
    candidateRevision: revision,
  });
  if (!commit.ok) {
    const status = await discoveryFileCommand(env, { action: "status", estateHash });
    const recoveredActive = discoveryFilePointer(status.data.active);
    if (status.ok && recoveredActive?.contentHash === contentHash) commit = status;
    else {
      await discoveryFileCommand(env, { action: "abort", estateHash, reservationId });
      return { stored: false, readbackStatus: "commit_failed", revision, contentHash };
    }
  }
  const canonical = await verifiedDiscoveryFileAtPointer(env, estateId, candidate);
  if (!canonical) {
    await discoveryFileCommand(env, {
      action: "rollback",
      estateHash,
      reservationId,
      candidateStorageKey,
      candidateContentHash: contentHash,
      candidateRevision: revision,
    });
    return { stored: false, readbackStatus: "canonical_readback_failed", revision, contentHash };
  }
  return {
    stored: true,
    readbackStatus: "verified",
    revision,
    contentHash,
    storageKey: candidateStorageKey,
  };
}

async function discoveryFileResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed();
  const estateId = stringValue(url.searchParams.get("estateId"));
  if (!estateId) {
    return json({ ok: false, error: "estate_id_required", message: "Choose an estate before loading its Discovery File." }, { status: 400 });
  }
  if (!env.PACKET_ARTIFACTS) {
    return json({ ok: false, error: "discovery_store_unavailable", message: "Discovery File storage is not configured." }, { status: 503 });
  }
  const canonical = await loadCanonicalDiscoveryFile(env, estateId);
  if (canonical.readbackStatus !== "verified" && canonical.readbackStatus !== "verified_recovered_previous") {
    return json({
      ok: false,
      error: "discovery_file_readback_failed",
      message: "The canonical Discovery File could not be verified. The app did not load an unverified revision.",
      readbackStatus: canonical.readbackStatus,
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (!canonical.record) {
    return json({ ok: true, exists: false, estateId, message: "No persisted Discovery File exists for this estate yet." }, { headers: { "cache-control": "no-store" } });
  }
  return json({ ok: true, exists: true, ...canonical.record, readbackStatus: "verified" }, { headers: { "cache-control": "no-store" } });
}

async function rebuildDiscoveryDossier(runId: string, facts: SourceFact[]): Promise<RawDossier> {
  const dossier = buildRawDossier(runId, facts);
  dossier.completedLeadReport = await generateCompletedLeadReport(dossier);
  dossier.outreach = buildOutreachWorkflow(dossier, dossier.completedLeadReport);
  dossier.completedLeadReport = await generateCompletedLeadReport(dossier);
  dossier.qualificationDecision = buildQualificationDecision(dossier);
  return dossier;
}

async function externalSourceRunResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (!externalSourceRunApproved(body)) {
    return json({
      ok: false,
      error: "source_run_intent_required",
      message: "External source searches must be started from an explicit operator action.",
    }, {
      status: 400,
      headers: { "cache-control": "no-store" },
    });
  }
  const requestedSeedInput = objectValue(body.seed);
  const requestedSeed = sourceRunSeedFromBody(body, seedFromUrl(url, env));
  const capture = withoutClientIdiProof(body.capture && typeof body.capture === "object" ? body.capture as Record<string, unknown> : body);
  const estateId = stringValue(body.assetKey);
  const requestedEstateId = stringValue(body.estateId);
  const requestedLeadId = stringValue(body.leadId);
  if (!estateId || estateId.length > 500
    || (requestedEstateId && requestedEstateId !== estateId)
    || (requestedLeadId && requestedLeadId !== estateId)) {
    return json({
      ok: false,
      error: "exact_estate_identity_required",
      message: "Discovery needs the exact stable estate ID selected in the CRM. Address fingerprints cannot identify estate records.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  const preflight = await canonicalEstateStopCheck(env, estateId, { seed: requestedSeed, capture });
  if (!["verified", "verified_recovered_previous", "not_available"].includes(preflight.readbackStatus)) {
    return canonicalEstateReadbackFailure("Discovery run", preflight.readbackStatus);
  }
  if (preflight.reasons.length) return canonicalStopJson(preflight.reasons, "Discovery run");
  const exactSubject = preflight.authoritativeSubject;
  if (env.AUTH_REQUIRED !== "false" && (!exactSubject?.ownerName || !exactSubject.propertyAddress)) {
    return json({
      ok: false,
      error: "discovery_estate_subject_unverified",
      message: "Discovery is blocked because the selected estate's durable owner and property address could not be verified.",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  if (exactSubject) {
    const propertyAppraiser = objectValue(objectValue(capture).propertyAppraiser);
    const mismatches = Array.from(new Set([
      ...estateSubjectMismatchFields(exactSubject, {
        ownerName: requestedSeedInput.ownerName || requestedSeedInput.estateName || body.ownerName || body.owner || body.estateName,
        propertyAddress: requestedSeedInput.propertyAddress || body.propertyAddress || body.address,
        parcelId: requestedSeedInput.parcelId || body.parcelId || body.folio,
      }),
      ...estateSubjectMismatchFields(exactSubject, {
        ownerName: propertyAppraiser.owner || propertyAppraiser.ownerName,
        propertyAddress: propertyAppraiser.address || propertyAppraiser.propertyAddress,
        parcelId: propertyAppraiser.folio || propertyAppraiser.parcelId,
      }),
    ]));
    if (mismatches.length) {
      return json({
        ok: false,
        error: "discovery_estate_subject_mismatch",
        mismatchFields: mismatches,
        message: "Discovery facts do not match the selected estate's durable CRM identity. Correct the CRM or Property Appraiser source before retrying.",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
  }
  const seed: IntakeSeed = exactSubject ? {
    ...requestedSeed,
    ownerName: exactSubject.ownerName,
    propertyAddress: exactSubject.propertyAddress,
    ...(exactSubject.parcelId ? { parcelId: exactSubject.parcelId } : {}),
  } : requestedSeed;
  const pipeline = await runDryPipeline(seed, { env: env as Record<string, string | undefined> });
  const batchGuard = browserbaseBatchGuard(body, env);
  const taxCollectorInput = taxCollectorInputFromSourceRun(body, seed, capture);
  let taxCollectorReceiptRun: Record<string, unknown> | null = null;
  let taxCollectorSourceFacts: SourceFact[] = [];
  if (batchGuard) {
    taxCollectorReceiptRun = {
      ok: false,
      mode: "browserbase_batch_blocked",
      flow: "tax_collector_receipt",
      estateId: seedIdentity(seed),
      paidRun: true,
      batchGuard,
      blockers: [String(batchGuard.message || "Browserbase paid batch source run needs approval.")],
      reviewRequired: true,
      reviewFlags: [String(batchGuard.code || "BROWSERBASE_BATCH_APPROVAL_REQUIRED"), "SOURCE_BLOCKED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
      message: batchGuard.message,
    };
    taxCollectorSourceFacts = browserbaseBatchGuardFacts(pipeline.runId, seed, batchGuard);
  } else if (taxCollectorHasTarget(taxCollectorInput)) {
    const acquisition = await acquireTaxCollectorReceipt(taxCollectorInput, { env: env as Record<string, string | undefined> });
    taxCollectorReceiptRun = taxCollectorRunFromAcquisition(seed, taxCollectorInput, acquisition);
    taxCollectorSourceFacts = taxCollectorSourceFactsFromRun(pipeline.runId, seed, taxCollectorReceiptRun);
  }
  const capturedSourceFacts = sourceFactsFromCapture(pipeline.runId, seed, capture);
  const canonicalIdiFacts = await storedIdiImportFacts(env, pipeline.runId, seed, stringValue(body.assetKey));
  const combinedFacts = [
    ...pipeline.facts,
    ...taxCollectorSourceFacts,
    ...capturedSourceFacts,
    ...canonicalIdiFacts,
  ];
  const sourceFacts = combinedFacts.filter((factItem) => discoverySourceLabels.some((source) => source.source === factItem.source));
  const dossier = await rebuildDiscoveryDossier(pipeline.runId, combinedFacts);
  const sourceSummaries = summarizeSourceRunFacts(sourceFacts);
  const sourceRunProof = sourceRunProofLedger(sourceSummaries, sourceFacts);
  const stopReasons = canonicalStopReasons({ seed, capture, sourceFacts, dossier });
  const blockers = Array.from(new Set([
    ...stopReasons.map((reason) => reason.message),
    ...sourceSummaries
      .filter((summary) => summary.status === "blocked" || summary.status === "needs_review")
      .map((summary) => String(summary.nextAction)),
    ...(dossier.audit.reviewFlags.includes("SOURCE_BLOCKED")
      ? ["One or more Discovery sources are blocked; keep the packet in review."]
      : []),
  ]));
  const generatedAt = nowIso();
  const discoveryFile = {
    version: 1,
    flow: "discovery",
    mode: "external_source_run",
    configuredSourceRunVerified: true,
    estateId,
    revision: pipeline.runId,
    generatedAt,
    seed,
    capture,
    sourceSummaries,
    sourceRunProof,
    sourceFacts,
    taxCollectorReceiptRun,
    dossier,
    blockers,
  };
  const persistence = await persistDiscoveryFile(env, discoveryFile);
  if (persistence.stored !== true || persistence.readbackStatus !== "verified") {
    return json({
      ok: false,
      error: "discovery_file_persistence_failed",
      message: "Discovery ran, but its canonical file did not pass durable readback. The prior verified output remains active.",
      estateId,
      runId: pipeline.runId,
      persistence,
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return json({
    ok: blockers.length === 0,
    mode: "external_source_run",
    runId: pipeline.runId,
    estateId,
    generatedAt,
    seed,
    sourceSummaries,
    sourceRunProof,
    sourceFacts,
    taxCollectorReceiptRun,
    dossier,
    stopReasonCodes: stopReasons.map((reason) => reason.code),
    blockers,
    persistence,
    message: stopReasons.length
      ? `Discovery stopped. ${stopReasons[0].message}`
      : blockers.length
      ? "Discovery source checks ran and returned review blockers. The app did not assume missing public or paid-source facts."
      : "Discovery source checks returned structured source facts for review.",
  }, { headers: { "cache-control": "no-store" } });
}

async function taxCollectorReceiptRunResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const seed = sourceRunSeedFromBody(body, seedFromUrl(url, env));
  const capture = body.capture && typeof body.capture === "object" ? body.capture as Record<string, unknown> : body;
  const batchGuard = browserbaseBatchGuard(body, env);
  const taxCollectorInput = taxCollectorInputFromSourceRun(body, seed, capture);
  let taxCollectorReceiptRun: Record<string, unknown>;
  let sourceFacts: SourceFact[] = [];
  const runId = `tax-receipt-${Date.now()}-${slug(seedIdentity(seed)).slice(0, 48)}`;

  if (batchGuard) {
    taxCollectorReceiptRun = {
      ok: false,
      mode: "browserbase_batch_blocked",
      flow: "tax_collector_receipt",
      estateId: seedIdentity(seed),
      paidRun: true,
      batchGuard,
      blockers: [String(batchGuard.message || "Browserbase paid batch source run needs approval.")],
      reviewRequired: true,
      reviewFlags: [String(batchGuard.code || "BROWSERBASE_BATCH_APPROVAL_REQUIRED"), "SOURCE_BLOCKED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
      message: batchGuard.message,
    };
    sourceFacts = browserbaseBatchGuardFacts(runId, seed, batchGuard);
  } else if (taxCollectorHasTarget(taxCollectorInput)) {
    const acquisition = await acquireTaxCollectorReceipt(taxCollectorInput, { env: env as Record<string, string | undefined> });
    taxCollectorReceiptRun = taxCollectorRunFromAcquisition(seed, taxCollectorInput, acquisition);
    sourceFacts = taxCollectorSourceFactsFromRun(runId, seed, taxCollectorReceiptRun);
  } else {
    taxCollectorReceiptRun = {
      ok: false,
      mode: "missing_search_target",
      flow: "tax_collector_receipt",
      estateId: seedIdentity(seed),
      paidRun: false,
      blockers: ["Tax Collector receipt search needs a folio, property address, owner name, listing page, or receipt link."],
      reviewRequired: true,
      reviewFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
      message: "Tax Collector receipt search needs a folio, property address, owner name, listing page, or receipt link.",
    };
  }

  return json({
    ...taxCollectorReceiptRun,
    runId,
    sourceFacts,
  }, { headers: { "cache-control": "no-store" } });
}

async function contactCandidateReviewResponse(request: Request, candidateId: string, env: CloudflareEnv): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!env.PACKET_ARTIFACTS) {
    return json({ ok: false, error: "idi_import_store_unavailable", message: "Contact review storage is unavailable." }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const assetKey = stringValue(body.assetKey);
  const status = stringValue(body.status || body.decision) as StoredIdiContactReviewStatus;
  if (!assetKey) return json({ ok: false, error: "asset_key_required", message: "Choose an estate before reviewing an IDI contact." }, { status: 400 });
  if (!candidateId || candidateId.length > 500 || !["accepted", "promoted", "rejected"].includes(status)) {
    return json({ ok: false, error: "contact_review_invalid", message: "Choose Accept, Promote, or Reject for a valid IDI contact." }, { status: 400 });
  }
  const record = storedIdiImport(await env.PACKET_ARTIFACTS.get(await idiImportKey(assetKey)));
  if (!record || !storedIdiImportIsCanonical(record) || record.assetKey !== assetKey) {
    return json({ ok: false, error: "idi_import_not_found", message: "Reload the estate's canonical IDI report before reviewing contacts." }, { status: 404 });
  }
  const candidate = record.candidates.find((item) => item.id === candidateId);
  if (!candidate) {
    return json({ ok: false, error: "idi_contact_candidate_not_found", message: "This contact is not part of the canonical IDI report. Reload the report and try again." }, { status: 404 });
  }
  const signedReviewer = await signedSessionEmail(request, env);
  const proxiedReviewer = internalBearerAuthorized(request, env) ? stringValue(body.reviewedBy).slice(0, 254) : "";
  const review: StoredIdiContactReview = {
    version: 1,
    revision: crypto.randomUUID(),
    assetKey,
    candidateId,
    importContentHash: record.attachment.contentHash,
    status,
    reviewedAt: nowIso(),
    reviewedBy: signedReviewer || proxiedReviewer || (internalBearerAuthorized(request, env) ? "HeirRight internal service" : "approved HeirRight user"),
  };
  const key = await idiContactReviewKey(assetKey, candidateId);
  try {
    await env.PACKET_ARTIFACTS.put(key, JSON.stringify(review), {
      expirationTtl: documentRetentionSeconds(env),
      metadata: { kind: "idi_contact_review", status },
    });
  } catch {
    return json({ ok: false, error: "contact_review_store_failed", message: "The contact review was not saved. Try again before continuing Discovery." }, { status: 503 });
  }
  const readback = storedIdiContactReview(await env.PACKET_ARTIFACTS.get(key));
  if (!readback || readback.revision !== review.revision || readback.status !== status) {
    return json({ ok: false, error: "contact_review_readback_failed", message: "The contact review did not pass shared storage readback. Reload before continuing Discovery." }, { status: 503 });
  }
  return json({
    ok: true,
    assetKey,
    candidateId,
    status,
    reviewedAt: readback.reviewedAt,
    reviewedBy: readback.reviewedBy,
    review: readback,
    candidate: { ...candidate, reviewStatus: status },
    readbackStatus: "verified",
    message: status === "accepted" || status === "promoted"
      ? "Contact candidate saved for the Discovery contact matrix."
      : "Contact candidate review saved.",
  }, { headers: { "cache-control": "no-store" } });
}

async function closingDocsGoogleExportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const forwardedUrl = new URL(url);
  forwardedUrl.pathname = "/api/exports";
  forwardedUrl.searchParams.set("routes", "google");
  const forwardedRequest = new Request(forwardedUrl.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...body,
      flow: "closing-docs",
      routes: ["google"],
      operatorIntent: "generate_packet",
    }),
  });
  return exportResponse(forwardedRequest, forwardedUrl, env);
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
  const userScopedRefreshConfigured = runtimeEnv.PODIO_USER_SCOPED_REFRESH === "true";
  const statuses = await connectionStatuses(runtimeEnv as Record<string, string | undefined>);
  return json({
    ok: true,
    backendTarget: "cloudflare-worker",
    service: "heirright-probate-lead-engine",
    deploymentKey: env.DEPLOYMENT_KEY || "heirright",
    routes: Object.fromEntries(routeList().map((route) => [route, "available"])),
    connections: statuses,
    podioBrowserBackedRefresh: Boolean(runtimeEnv.PODIO_BROWSER_REFRESH_TOKEN && !env.PODIO_BROWSER_REFRESH_TOKEN),
    podioStoredRefreshConfigured: userScopedRefreshConfigured,
    podioUserScopedRefreshConfigured: userScopedRefreshConfigured,
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

async function podioJson(path: string, token: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`https://api.podio.com${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return {
    ok: response.ok,
    status: response.status,
    data: await response.json().catch(() => null),
  };
}

async function podioDiagnosticsResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const runtimeEnv = await podioRuntimeEnv(request, env);
  const userScopedRefreshConfigured = runtimeEnv.PODIO_USER_SCOPED_REFRESH === "true";
  const appId = runtimeEnv.PODIO_APP_ID || TEXAS_EQUITY_PROS_LEADS_APP_ID;
  const spaceId = runtimeEnv.PODIO_SPACE_ID || TEXAS_EQUITY_PROS_LEADS_SPACE_ID;
  const auth = await resolvePodioAccessToken(runtimeEnv as Record<string, string | undefined>);
  const missingAuth = { ok: false, status: 0, data: { error: auth.blocker || "missing_podio_access_token" } };
  const [userStatus, app, members] = auth.token
    ? await Promise.all([
      podioJson("/user/status", auth.token),
      podioJson(`/app/${appId}`, auth.token),
      podioJson(`/space/${spaceId}/member/`, auth.token),
    ])
    : [missingAuth, missingAuth, missingAuth];
  const memberRows = Array.isArray(members.data) ? members.data as Array<Record<string, unknown>> : [];
  const appObject = app.data && typeof app.data === "object" ? app.data as Record<string, unknown> : {};
  const appConfig = appObject.config && typeof appObject.config === "object" ? appObject.config as Record<string, unknown> : {};
  const candidates = [
    userStatus.data && typeof userStatus.data === "object" ? podioProfileCandidate(userStatus.data as Record<string, unknown>, "user_status") : null,
    ...memberRows.map((item) => podioProfileCandidate(item, "space_member")),
  ].filter((item): item is Record<string, unknown> => Boolean(item));
  const podioAuthOk = Boolean(auth.token && userStatus.ok && app.ok && members.ok);
  const durableTeamAuth = env.PODIO_PER_USER_AUTH_REQUIRED !== "true" && (auth.mode === "app_auth" || auth.mode === "refresh" || auth.mode === "bearer");
  const authBlocker = auth.blocker || podioReadbackBlockerMessage(
    app.status || userStatus.status || members.status,
    app.data || userStatus.data || members.data,
  );
  return json({
    ok: true,
    appId,
    spaceId,
    authMode: auth.mode,
    browserBackedRefresh: Boolean(runtimeEnv.PODIO_BROWSER_REFRESH_TOKEN && !env.PODIO_BROWSER_REFRESH_TOKEN),
    storedRefreshConfigured: userScopedRefreshConfigured,
    userScopedRefreshConfigured,
    durableTeamAuth,
    reconnectRequired: !userScopedRefreshConfigured,
    authOk: podioAuthOk,
    authBlocker: podioAuthOk ? null : authBlocker,
    setupOptions: userScopedRefreshConfigured ? [] : [
      "Connect your own Podio account from Settings.",
      "HeirRight stores the refresh token against your signed-in Google user.",
      "Other users connect separately and cannot inherit your Podio session.",
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
  const userEmail = await signedSessionEmail(request, env);
  if (!userEmail) {
    return html(podioSetupHtml(
      "Sign In Before Connecting Podio",
      "Return to HeirRight, sign in with your approved Google account, then connect your own Podio account from Settings.",
      "blocked",
    ), { status: 401 });
  }
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
  const signedState = `${state}.${await hmacBase64Url(`${state}:${userEmail}`, podioCookieSecret(env))}`;
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
  const userEmail = await signedSessionEmail(request, env);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const stateCookie = parseCookie(request.headers.get("cookie"))[podioStateCookieName(env)];
  const [cookieState, cookieSignature] = String(stateCookie || "").split(".");
  const expectedSignature = cookieState && userEmail ? await hmacBase64Url(`${cookieState}:${userEmail}`, podioCookieSecret(env)) : "";
  if (!userEmail || !code || !state || !cookieState || !timingSafeStringEqual(state, cookieState) || !timingSafeStringEqual(cookieSignature, expectedSignature)) {
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
  const refreshCookie = await encryptCookieValue(JSON.stringify({ email: userEmail, refreshToken: token.refresh_token }), env);
  if (!refreshCookie) {
    return html(podioSetupHtml(
      "Podio Refresh Could Not Be Saved",
      "HeirRight could not protect the Podio refresh access. Add the Podio app token fallback before exporting.",
      "blocked",
    ), { status: 503 });
  }
  const storedForUser = await storePodioRefreshToken(token.refresh_token, env, userEmail);
  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearResponseCookie(request, podioStateCookieName(env)));
  headers.append("set-cookie", responseCookie(request, podioRefreshCookieName(env), refreshCookie, PODIO_OAUTH_REFRESH_TTL_SECONDS));
  return html(podioSetupHtml(
    storedForUser ? "Your Podio Account Is Connected" : "Podio Session Connected",
    storedForUser
      ? "HeirRight saved a protected refresh token for your signed-in user. Other HeirRight users must connect their own Podio accounts."
      : "HeirRight connected Podio for this signed-in user in this browser. Durable reconnect needs Worker token storage.",
  ), {
    headers,
  });
}

async function readbackEvidenceResponse(url: URL, env: CloudflareEnv, markdown: boolean): Promise<Response> {
  if (url.searchParams.get("dry-run") === "false") {
    return json({
      ok: false,
      error: "readback_evidence_live_write_forbidden",
      message: "Readback evidence is a read-only dry-run surface. Use an explicitly approved handoff action for live delivery.",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  const pipeline = await runDryPipeline(seedFromUrl(url, env), {
    env: env as Record<string, string | undefined>,
  });
  const exportResult = await exportCompletedReport({
    routes: ["google", "podio"],
    dossier: pipeline.dossier,
    dryRun: true,
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

    if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD" && request.method !== "DELETE") {
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
      return idiAssetImportResponse(request, url, env);
    }

    if (url.pathname === "/api/discovery/idi-asset-search/ocr") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return googleWorkspaceOcrResponse(request, env);
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

    if (url.pathname === "/api/discovery/file") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return discoveryFileResponse(request, url, env);
    }

    if (url.pathname === "/api/discovery/tax-collector/receipt-run") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return taxCollectorReceiptRunResponse(request, url, env);
    }

    const contactReviewMatch = url.pathname.match(/^\/api\/discovery\/contact-candidates\/([^/]+)\/review$/);
    if (contactReviewMatch) {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return contactCandidateReviewResponse(request, decodeURIComponent(contactReviewMatch[1] || ""), env);
    }

    if (url.pathname === "/api/closing-docs/export-google") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return closingDocsGoogleExportResponse(request, url, env);
    }

    if (url.pathname === "/api/google-workspace/connection") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return googleWorkspaceConnectionResponse(request, url, env);
    }

    if (url.pathname === "/api/google-workspace/destinations") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return googleWorkspaceDestinationsResponse(request, url, env);
    }

    if (url.pathname === "/api/doc-prep/packet-approval") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return packetApprovalResponse(request, env);
    }

    if (url.pathname === "/api/google-workspace/export") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return googleWorkspaceExportResponse(request, env);
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

    if (url.pathname === "/api/reports/pdf") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return packetArtifactResponse(request, url, env);
    }

    if (url.pathname === "/api/documents/attachments") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return supportingDocumentResponse(request, url, env);
    }

    if (url.pathname === "/api/workspace/state") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return workspaceStateResponse(request, url, env);
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
