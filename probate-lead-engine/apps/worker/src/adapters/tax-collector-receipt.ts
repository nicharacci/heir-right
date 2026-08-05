import type { ReviewFlag } from "@ple/types";

type FetchImpl = typeof fetch;
type RuntimeEnv = Record<string, string | undefined>;
type JsonRecord = Record<string, unknown>;

export interface TaxCollectorReceiptInput {
  listingHtml?: unknown;
  receiptHtml?: unknown;
  listingText?: unknown;
  receiptText?: unknown;
  detailsText?: unknown;
  listingUrl?: unknown;
  receiptUrl?: unknown;
  receiptLink?: unknown;
  sourceUrl?: unknown;
  paidBy?: unknown;
  payerIdentity?: unknown;
  paidDate?: unknown;
  amountDue?: unknown;
  unpaidYears?: unknown;
  reassessment?: unknown;
  status?: unknown;
  parcelId?: unknown;
  propertyAddress?: unknown;
  ownerName?: unknown;
}

export interface TaxCollectorReceiptCandidate {
  href: string;
  url: string;
  text: string;
  html?: string;
  index: number;
}

export interface TaxCollectorReceiptDiscovery {
  listingUrl: string;
  receiptUrl: string;
  candidates: TaxCollectorReceiptCandidate[];
  mode: "explicit" | "listing_page_bottom_right";
  details: TaxCollectorDetails;
  reviewFlags: ReviewFlag[];
}

export interface TaxCollectorAmountDue {
  amount: number;
  currency: "USD";
  years: number[];
}

export interface TaxCollectorDetails {
  paidBy?: string;
  payerIdentity?: string;
  paidDate?: string;
  unpaidYears?: number[];
  amountDue?: TaxCollectorAmountDue;
  reassessment?: string;
  receiptStatus?: string;
}

export interface TaxCollectorReceiptAcquisitionResult {
  ok: boolean;
  mode:
    | "explicit"
    | "listing_page_bottom_right"
    | "listing_page_no_receipt"
    | "listing_page_blocked"
    | "browser_workflow_required"
    | "browserbase_billing_required"
    | "browserbase_rate_limited"
    | "browserbase_timed_out"
    | "browserbase_function_failed"
    | "not_configured";
  paidRun: boolean;
  listingUrl: string;
  searchUrl: string;
  status?: number;
  finalUrl?: string;
  bodySnippet?: string;
  discovery?: TaxCollectorReceiptDiscovery;
  blocker?: string;
  reviewFlags: ReviewFlag[];
}

export interface TaxCollectorReceiptAcquisitionOptions {
  env?: RuntimeEnv;
  fetchImpl?: FetchImpl;
}

export interface TaxCollectorReceiptAttachment {
  ok: boolean;
  finalUrl?: string;
  status?: number;
  contentType?: "application/pdf" | "text/html" | "application/xhtml+xml";
  bytes?: number;
  sha256?: string;
  details?: TaxCollectorDetails;
  error?: "invalid_url" | "redirect_blocked" | "too_many_redirects" | "unsafe_content_type" | "body_too_large" | "timed_out" | "fetch_failed" | "invalid_signature" | "empty_attachment";
}

const DEFAULT_TAX_COLLECTOR_SEARCH_URL = "https://county-taxes.net/fl-miamidade/property-tax";
const DEFAULT_TAX_COLLECTOR_ALLOWED_ORIGINS = [
  "https://county-taxes.net",
  "https://miamidade.county-taxes.com",
];
const TAX_COLLECTOR_FETCH_TIMEOUT_MS = 12_000;
const TAX_COLLECTOR_FETCH_MAX_BYTES = 1_000_000;
const TAX_COLLECTOR_FETCH_MAX_REDIRECTS = 5;
const DEFAULT_REVIEW_FLAGS: ReviewFlag[] = [
  "TAX_COLLECTOR_LISTING_PAGE_REQUIRED",
  "TAX_RECEIPT_LINK_REQUIRED",
  "HUMAN_REVIEW_REQUIRED",
  "NO_ENRICHMENT_RUN",
];
const BROWSER_WORKFLOW_FLAGS: ReviewFlag[] = [
  "SOURCE_BLOCKED",
  "TAX_COLLECTOR_BROWSER_WORKFLOW_REQUIRED",
  "TAX_COLLECTOR_LISTING_PAGE_REQUIRED",
  "TAX_RECEIPT_LINK_REQUIRED",
  "HUMAN_REVIEW_REQUIRED",
  "NO_ENRICHMENT_RUN",
];

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripTags(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceText(input: TaxCollectorReceiptInput): string {
  return [
    input.listingText,
    input.receiptText,
    input.detailsText,
    input.listingHtml ? stripTags(stringValue(input.listingHtml)) : "",
    input.receiptHtml ? stripTags(stringValue(input.receiptHtml)) : "",
  ].map(stringValue).filter(Boolean).join(" ");
}

function compactWhitespace(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function labeledValue(
  text: string,
  labels: string[],
  stopPattern = /(?:paid\s+by|payor|payer|paid\s+date|payment\s+date|date\s+paid|amount\s+due|total\s+due|balance\s+due|unpaid\s+years?|delinquent\s+years?|tax\s+year|status|print|receipt|folio|parcel)\b/i,
): string {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:#-]?\\s*([^|\\n\\r]+?)(?=\\s{2,}|\\s+${stopPattern.source}|$)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return compactWhitespace(match[1]);
  }
  return "";
}

function parseMoney(value: unknown): number | null {
  const match = String(value || "").match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.[0-9]{2})?/);
  if (!match) return null;
  const amount = Number(match[0].replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseYears(value: unknown): number[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => Number(String(item).replace(/\D/g, ""))).filter((year) => year >= 1900 && year <= 2200)));
  }
  return Array.from(new Set((String(value || "").match(/\b(?:19|20)\d{2}\b/g) || []).map(Number)));
}

function normalizeTaxAmountDue(value: unknown, years: number[] = []): TaxCollectorAmountDue | undefined {
  if (value && typeof value === "object" && !Array.isArray(value) && typeof (value as { amount?: unknown }).amount === "number") {
    return value as TaxCollectorAmountDue;
  }
  const amount = parseMoney(value);
  if (amount === null) return undefined;
  return {
    amount,
    currency: "USD",
    years,
  };
}

export function extractTaxCollectorDetails(input: TaxCollectorReceiptInput): TaxCollectorDetails {
  const text = sourceText(input);
  const paidBy = compactWhitespace(input.paidBy || input.payerIdentity)
    || labeledValue(text, ["paid\\s+by", "payor", "payer"]);
  const paidDate = compactWhitespace(input.paidDate)
    || labeledValue(text, ["paid\\s+date", "payment\\s+date", "date\\s+paid"])
    || (text.match(/\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:19|20)\d{2}\b/) || [])[0]
    || "";
  const unpaidYearText = compactWhitespace(input.unpaidYears)
    || labeledValue(text, ["unpaid\\s+years?", "delinquent\\s+years?", "unpaid\\s+tax\\s+years?"]);
  const unpaidYears = parseYears(unpaidYearText);
  const amountLabel = compactWhitespace(input.amountDue)
    || labeledValue(text, ["amount\\s+due", "total\\s+due", "balance\\s+due", "amount\\s+paid"]);
  const amountDue = normalizeTaxAmountDue(amountLabel, unpaidYears);
  const reassessment = compactWhitespace(input.reassessment)
    || labeledValue(text, ["reassessment", "assessed\\s+value\\s+change"]);
  const receiptStatus = compactWhitespace(input.status)
    || labeledValue(text, ["receipt\\s+status", "payment\\s+status", "status"]);
  return {
    paidBy: paidBy || undefined,
    payerIdentity: paidBy || undefined,
    paidDate: paidDate || undefined,
    unpaidYears: unpaidYears.length ? unpaidYears : undefined,
    amountDue,
    reassessment: reassessment || undefined,
    receiptStatus: receiptStatus || undefined,
  };
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl || "https://miamidade.county-taxes.com/").toString();
  } catch {
    return href;
  }
}

function isCloudflareChallenge(status: number | undefined, body: string): boolean {
  return status === 403 && /cf-mitigated|cloudflare|just a moment|challenge-platform|enable javascript and cookies/i.test(body);
}

function isJavascriptShell(body: string): boolean {
  return /doesn['’]?t work properly without javascript enabled|enable javascript/i.test(body)
    && !/<a\b[^>]*href\s*=/i.test(body);
}

function templateValue(input: TaxCollectorReceiptInput, key: string): string {
  if (key === "folio" || key === "parcelId") return encodeURIComponent(stringValue(input.parcelId));
  if (key === "address" || key === "propertyAddress") return encodeURIComponent(stringValue(input.propertyAddress));
  if (key === "owner" || key === "ownerName") return encodeURIComponent(stringValue(input.ownerName));
  return "";
}

function expandTemplate(template: string, input: TaxCollectorReceiptInput): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => templateValue(input, key));
}

function configuredListingUrl(input: TaxCollectorReceiptInput, env: RuntimeEnv): string {
  const directUrl = stringValue(input.listingUrl) || stringValue(input.sourceUrl) || stringValue(env.TAX_COLLECTOR_LISTING_URL);
  if (directUrl) return directUrl;
  const template = stringValue(env.TAX_COLLECTOR_LISTING_URL_TEMPLATE);
  if (!template) return "";
  const expanded = expandTemplate(template, input);
  return /\{[a-zA-Z0-9_]+\}/.test(expanded) ? "" : expanded;
}

function publicSearchUrl(env: RuntimeEnv): string {
  return stringValue(env.TAX_COLLECTOR_SEARCH_URL) || DEFAULT_TAX_COLLECTOR_SEARCH_URL;
}

function browserWorkflowUrl(env: RuntimeEnv): string {
  return stringValue(env.TAX_COLLECTOR_BROWSER_WORKFLOW_URL);
}

function browserWorkflowToken(env: RuntimeEnv): string {
  return stringValue(env.TAX_COLLECTOR_BROWSER_WORKFLOW_TOKEN) || stringValue(env.BROWSERBASE_API_KEY);
}

function browserbaseFunctionId(env: RuntimeEnv): string {
  return stringValue(env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID)
    || stringValue(env.BROWSERBASE_TAX_COLLECTOR_FUNCTION_ID);
}

function browserbaseApiBase(env: RuntimeEnv): string {
  return stringValue(env.BROWSERBASE_API_BASE) || "https://api.browserbase.com";
}

function browserbaseApiKey(env: RuntimeEnv): string {
  return stringValue(env.BROWSERBASE_API_KEY);
}

function boundedPositiveInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function taxCollectorFetchTimeoutMs(env: RuntimeEnv): number {
  return boundedPositiveInteger(env.TAX_COLLECTOR_FETCH_TIMEOUT_MS, TAX_COLLECTOR_FETCH_TIMEOUT_MS, 20, 30_000);
}

function taxCollectorFetchMaxBytes(env: RuntimeEnv): number {
  return boundedPositiveInteger(env.TAX_COLLECTOR_FETCH_MAX_BYTES, TAX_COLLECTOR_FETCH_MAX_BYTES, 1_024, 2_000_000);
}

function taxCollectorAllowedOrigins(env: RuntimeEnv): Set<string> {
  const configured = stringValue(env.TAX_COLLECTOR_ALLOWED_ORIGINS)
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const origins = configured.length ? configured : DEFAULT_TAX_COLLECTOR_ALLOWED_ORIGINS;
  return new Set(origins.flatMap((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash
        ? [url.origin]
        : [];
    } catch {
      return [];
    }
  }));
}

function approvedTaxCollectorUrl(value: unknown, env: RuntimeEnv, baseUrl?: string): URL | null {
  try {
    const url = new URL(stringValue(value), baseUrl);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && taxCollectorAllowedOrigins(env).has(url.origin)
      ? url
      : null;
  } catch {
    return null;
  }
}

function approvedTaxCollectorDiscovery(
  discovery: TaxCollectorReceiptDiscovery | null,
  env: RuntimeEnv,
): TaxCollectorReceiptDiscovery | null {
  if (!discovery) return null;
  const listing = approvedTaxCollectorUrl(discovery.listingUrl, env);
  const receipt = approvedTaxCollectorUrl(discovery.receiptUrl, env, listing?.toString());
  return listing && receipt ? discovery : null;
}

function safeTaxCollectorContentType(response: Response): boolean {
  const type = stringValue(response.headers.get("content-type")).split(";", 1)[0].toLowerCase();
  return type === "text/html" || type === "application/xhtml+xml";
}

async function boundedTaxCollectorBody(response: Response, maxBytes: number): Promise<string | null> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function boundedTaxCollectorBytes(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function taxCollectorAttachmentContentType(response: Response): TaxCollectorReceiptAttachment["contentType"] | null {
  const type = stringValue(response.headers.get("content-type")).split(";", 1)[0].toLowerCase();
  return type === "application/pdf" || type === "text/html" || type === "application/xhtml+xml"
    ? type
    : null;
}

async function sha256ByteString(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyTaxCollectorReceiptAttachment(
  receiptUrl: string,
  options: TaxCollectorReceiptAcquisitionOptions = {},
): Promise<TaxCollectorReceiptAttachment> {
  const env = options.env ?? {};
  const fetchImpl = options.fetchImpl ?? fetch;
  const initial = approvedTaxCollectorUrl(receiptUrl, env);
  if (!initial) return { ok: false, error: "invalid_url" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), taxCollectorFetchTimeoutMs(env));
  let current = initial;
  try {
    for (let redirectCount = 0; redirectCount <= TAX_COLLECTOR_FETCH_MAX_REDIRECTS; redirectCount += 1) {
      let response: Response;
      try {
        response = await fetchImpl(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            accept: "application/pdf,text/html,application/xhtml+xml;q=0.9",
            "user-agent": "HeirRight-TaxCollectorReceiptAttachment/1.0",
          },
        });
      } catch {
        return { ok: false, error: controller.signal.aborted ? "timed_out" : "fetch_failed" };
      }
      const responseUrl = stringValue(response.url);
      if (responseUrl && !approvedTaxCollectorUrl(responseUrl, env)) {
        await response.body?.cancel().catch(() => undefined);
        return { ok: false, error: "redirect_blocked" };
      }
      if (response.status >= 300 && response.status < 400) {
        const location = stringValue(response.headers.get("location"));
        await response.body?.cancel().catch(() => undefined);
        if (!location) return { ok: false, error: "redirect_blocked" };
        const next = approvedTaxCollectorUrl(location, env, current.toString());
        if (!next) return { ok: false, error: "redirect_blocked" };
        if (redirectCount === TAX_COLLECTOR_FETCH_MAX_REDIRECTS) return { ok: false, error: "too_many_redirects" };
        current = next;
        continue;
      }
      const contentType = taxCollectorAttachmentContentType(response);
      if (!contentType) {
        await response.body?.cancel().catch(() => undefined);
        return { ok: false, status: response.status, error: "unsafe_content_type" };
      }
      const bytes = await boundedTaxCollectorBytes(response, taxCollectorFetchMaxBytes(env));
      if (bytes === null) return { ok: false, status: response.status, error: "body_too_large" };
      if (!bytes.byteLength) return { ok: false, status: response.status, error: "empty_attachment" };
      if (contentType === "application/pdf"
        && !(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d)) {
        return { ok: false, status: response.status, error: "invalid_signature" };
      }
      const finalUrl = approvedTaxCollectorUrl(responseUrl || current.toString(), env);
      if (!finalUrl) return { ok: false, status: response.status, error: "redirect_blocked" };
      return {
        ok: response.ok,
        finalUrl: finalUrl.toString(),
        status: response.status,
        contentType,
        bytes: bytes.byteLength,
        sha256: await sha256ByteString(bytes),
        ...(contentType === "application/pdf"
          ? {}
          : { details: extractTaxCollectorDetails({ receiptHtml: new TextDecoder("utf-8", { fatal: false }).decode(bytes) }) }),
        ...(response.ok ? {} : { error: "fetch_failed" as const }),
      };
    }
    return { ok: false, error: "too_many_redirects" };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchApprovedTaxCollectorPage(
  initialUrl: string,
  env: RuntimeEnv,
  fetchImpl: FetchImpl,
): Promise<{
  response?: Response;
  body?: string;
  finalUrl?: string;
  error?: "invalid_url" | "redirect_blocked" | "too_many_redirects" | "unsafe_content_type" | "body_too_large" | "timed_out" | "fetch_failed";
}> {
  const initial = approvedTaxCollectorUrl(initialUrl, env);
  if (!initial) return { error: "invalid_url" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), taxCollectorFetchTimeoutMs(env));
  let current = initial;
  try {
    for (let redirectCount = 0; redirectCount <= TAX_COLLECTOR_FETCH_MAX_REDIRECTS; redirectCount += 1) {
      let response: Response;
      try {
        response = await fetchImpl(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            accept: "text/html,application/xhtml+xml;q=0.9",
            "user-agent": "HeirRight-TaxCollectorReceipt/1.0",
          },
        });
      } catch {
        return { error: controller.signal.aborted ? "timed_out" : "fetch_failed" };
      }
      const responseUrl = stringValue(response.url);
      if (responseUrl && !approvedTaxCollectorUrl(responseUrl, env)) {
        await response.body?.cancel().catch(() => undefined);
        return { error: "redirect_blocked" };
      }
      if (response.status >= 300 && response.status < 400) {
        const location = stringValue(response.headers.get("location"));
        await response.body?.cancel().catch(() => undefined);
        if (!location) return { error: "redirect_blocked" };
        const next = approvedTaxCollectorUrl(location, env, current.toString());
        if (!next) return { error: "redirect_blocked" };
        if (redirectCount === TAX_COLLECTOR_FETCH_MAX_REDIRECTS) return { error: "too_many_redirects" };
        current = next;
        continue;
      }
      if (!safeTaxCollectorContentType(response)) {
        await response.body?.cancel().catch(() => undefined);
        return { error: "unsafe_content_type" };
      }
      const body = await boundedTaxCollectorBody(response, taxCollectorFetchMaxBytes(env));
      if (body === null) return { error: "body_too_large" };
      const finalUrl = approvedTaxCollectorUrl(responseUrl || current.toString(), env);
      if (!finalUrl) return { error: "redirect_blocked" };
      return { response, body, finalUrl: finalUrl.toString() };
    }
    return { error: "too_many_redirects" };
  } finally {
    clearTimeout(timeout);
  }
}

function truthyEnv(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(stringValue(value).toLowerCase());
}

function browserbaseSessionCreateParams(env: RuntimeEnv): JsonRecord {
  const params: JsonRecord = {
    browserSettings: {
      viewport: { width: 1365, height: 900 },
      recordSession: true,
      logSession: true,
      solveCaptchas: true,
      enablePdfViewer: true,
    },
    timeout: 900,
  };
  if (truthyEnv(env.TAX_COLLECTOR_BROWSERBASE_PROXY_ENABLED) || truthyEnv(env.BROWSERBASE_PROXY_ENABLED)) {
    params.proxies = [{
      type: "browserbase",
      domainPattern: stringValue(env.TAX_COLLECTOR_BROWSERBASE_PROXY_DOMAIN_PATTERN)
        || stringValue(env.BROWSERBASE_PROXY_DOMAIN_PATTERN)
        || "county-taxes.net",
    }];
  }
  return params;
}

function browserbaseInvocationStatus(invocation: JsonRecord): string {
  return stringValue(invocation.status).toUpperCase();
}

function isPendingBrowserbaseInvocation(invocation: JsonRecord): boolean {
  return ["PENDING", "RUNNING"].includes(browserbaseInvocationStatus(invocation));
}

function browserbaseInvocationSummary(invocation: JsonRecord): string {
  return JSON.stringify({
    invocationId: invocation.id,
    sessionId: invocation.sessionId,
    status: invocation.status,
  }).slice(0, 500);
}

function browserbaseResultMode(
  result: JsonRecord,
  status?: number,
  invocation: JsonRecord = {},
): TaxCollectorReceiptAcquisitionResult["mode"] {
  if (status === 402) return "browserbase_billing_required";
  if (status === 429) return "browserbase_rate_limited";
  const invocationStatus = browserbaseInvocationStatus(invocation);
  if (invocationStatus === "TIMED_OUT" || isPendingBrowserbaseInvocation(invocation)) return "browserbase_timed_out";
  if (invocationStatus === "FAILED" || invocationStatus === "ERROR") return "browserbase_function_failed";
  const mode = stringValue(result.mode);
  if (mode === "listing_page_no_receipt") return "listing_page_no_receipt";
  if (mode === "browser_navigation_blocked" || mode === "listing_page_blocked") return "listing_page_blocked";
  return "browser_workflow_required";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBrowserbaseInvocation(
  invocation: JsonRecord,
  env: RuntimeEnv,
  apiKey: string,
  fetchImpl: FetchImpl,
): Promise<JsonRecord> {
  const invocationId = stringValue(invocation.id);
  if (!invocationId || !isPendingBrowserbaseInvocation(invocation)) return invocation;

  const apiBase = browserbaseApiBase(env).replace(/\/$/, "");
  const deadline = Date.now() + 45_000;
  let latest = invocation;
  while (Date.now() < deadline && isPendingBrowserbaseInvocation(latest)) {
    await sleep(2_000);
    const statusResponse = await fetchImpl(`${apiBase}/v1/functions/invocations/${encodeURIComponent(invocationId)}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-bb-api-key": apiKey,
      },
    });
    const statusBody = await statusResponse.json().catch(() => ({})) as JsonRecord;
    latest = Object.keys(statusBody).length ? statusBody : latest;
    if (!statusResponse.ok) break;
  }
  return latest;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function anchorCandidates(html: string, baseUrl: string): TaxCollectorReceiptCandidate[] {
  const candidates: TaxCollectorReceiptCandidate[] = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const fullAnchor = match[0] || "";
    const href = stringValue(match[1]);
    const text = stripTags(fullAnchor);
    if (!href) continue;
    candidates.push({
      href,
      url: resolveUrl(href, baseUrl),
      text: text || "Tax receipt",
      html: fullAnchor,
      index: candidates.length,
    });
  }
  return candidates;
}

function taxReceiptCandidateScore(candidate: TaxCollectorReceiptCandidate): number {
  const haystack = `${candidate.href} ${candidate.url} ${candidate.text}`.toLowerCase();
  const anchorHtml = stringValue((candidate as TaxCollectorReceiptCandidate & { html?: string }).html).toLowerCase();
  let score = 0;
  if (/local\s+business\s+tax|lbt\s+tax\s+receipt|business-tax|business\s+tax\s+receipt/.test(haystack)) score -= 25;
  if (/receipt|receipts/.test(haystack) && /(print|payment|paid|tax\s*-?\s*bill|taxbill|real\s+estate|property|parcel|folio|ad\s+valorem)/.test(haystack)) score += 12;
  if (/tax\s*-?\s*bill|taxbill/.test(haystack)) score += 8;
  if (/print/.test(haystack) && /(receipt|bill)/.test(haystack)) score += 6;
  if (/payment/.test(haystack) && /(receipt|tax\s*-?\s*bill|taxbill)/.test(haystack)) score += 4;
  if (/class=["'][^"']*(receipt|print|tax|bill|payment)[^"']*["']/.test(anchorHtml)) score += 3;
  if (score > 0 && /(bottom|right|float\s*:\s*right|text-align\s*:\s*right|pull-right|align-right|justify-content\s*:\s*end|justify-content\s*:\s*flex-end)/.test(anchorHtml)) score += 5;
  if (/history|account|login|search|privacy|terms|contact|help|faq/.test(haystack)) score -= 10;
  return score > 0 ? score + candidate.index / 1000 : 0;
}

export function discoverTaxCollectorReceipt(input: TaxCollectorReceiptInput): TaxCollectorReceiptDiscovery | null {
  const explicitUrl = stringValue(input.receiptUrl) || stringValue(input.receiptLink);
  const listingUrl = stringValue(input.listingUrl) || stringValue(input.sourceUrl);
  const details = extractTaxCollectorDetails(input);
  if (explicitUrl) {
    return {
      listingUrl,
      receiptUrl: resolveUrl(explicitUrl, listingUrl),
      details,
      candidates: [{
        href: explicitUrl,
        url: resolveUrl(explicitUrl, listingUrl),
        text: "Operator supplied receipt link",
        index: 0,
      }],
      mode: "explicit",
      reviewFlags: ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
    };
  }

  const html = stringValue(input.listingHtml);
  if (!html) return null;

  const candidates = anchorCandidates(html, listingUrl)
    .map((candidate) => ({ ...candidate, score: taxReceiptCandidateScore(candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  const bottomRightCandidate = candidates[0];
  if (!bottomRightCandidate) return null;

  return {
    listingUrl,
    receiptUrl: bottomRightCandidate.url,
    candidates,
    mode: "listing_page_bottom_right",
    details,
    reviewFlags: ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
  };
}

export async function acquireTaxCollectorReceipt(
  input: TaxCollectorReceiptInput,
  options: TaxCollectorReceiptAcquisitionOptions = {},
): Promise<TaxCollectorReceiptAcquisitionResult> {
  const env = options.env ?? {};
  const searchUrl = publicSearchUrl(env);
  const fetchImpl = options.fetchImpl ?? fetch;
  const suppliedDiscovery = discoverTaxCollectorReceipt(input);
  if (suppliedDiscovery) {
    return {
      ok: true,
      paidRun: false,
      mode: suppliedDiscovery.mode,
      listingUrl: suppliedDiscovery.listingUrl,
      searchUrl,
      finalUrl: suppliedDiscovery.listingUrl,
      discovery: suppliedDiscovery,
      reviewFlags: suppliedDiscovery.reviewFlags,
    };
  }

  const workflowUrl = browserWorkflowUrl(env);
  if (workflowUrl && !stringValue(input.listingUrl) && !stringValue(input.sourceUrl)) {
    try {
      const headers: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "HeirRight-TaxCollectorBrowserWorkflow/1.0",
      };
      const token = browserWorkflowToken(env);
      if (token) headers.authorization = `Bearer ${token}`;
      const response = await fetchImpl(workflowUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          source: "tax_collector",
          searchUrl,
          parcelId: stringValue(input.parcelId),
          propertyAddress: stringValue(input.propertyAddress),
          ownerName: stringValue(input.ownerName),
        }),
      });
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const workflowListingUrl = stringValue(data.listingUrl) || stringValue(data.finalUrl) || searchUrl;
      const workflowDiscovery = approvedTaxCollectorDiscovery(discoverTaxCollectorReceipt({
        ...input,
        listingUrl: workflowListingUrl,
        listingHtml: data.listingHtml,
        receiptUrl: data.receiptUrl,
        receiptLink: data.receiptLink,
      }), env);
      if (response.ok && workflowDiscovery) {
        return {
          ok: true,
          paidRun: true,
          mode: workflowDiscovery.mode,
          listingUrl: workflowDiscovery.listingUrl || workflowListingUrl,
          searchUrl,
          status: response.status,
          finalUrl: workflowListingUrl,
          discovery: workflowDiscovery,
          reviewFlags: workflowDiscovery.reviewFlags,
        };
      }
      return {
        ok: false,
        mode: browserbaseResultMode(data, response.status),
        paidRun: true,
        listingUrl: workflowListingUrl,
        searchUrl,
        status: response.status,
        finalUrl: workflowListingUrl,
        bodySnippet: stringValue(data.message) || stringValue(data.error),
        blocker: stringValue(data.message)
          || stringValue(data.error)
          || "Tax Collector browser workflow ran but did not return a bottom-right receipt link.",
        reviewFlags: BROWSER_WORKFLOW_FLAGS,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "browser_workflow_required",
        paidRun: true,
        listingUrl: "",
        searchUrl,
        blocker: error instanceof Error ? error.message : String(error),
        reviewFlags: BROWSER_WORKFLOW_FLAGS,
      };
    }
  }

  const functionId = browserbaseFunctionId(env);
  const apiKey = browserbaseApiKey(env);
  if (functionId && apiKey && !stringValue(input.listingUrl) && !stringValue(input.sourceUrl)) {
    try {
      const response = await fetchImpl(`${browserbaseApiBase(env).replace(/\/$/, "")}/v1/functions/${encodeURIComponent(functionId)}/invoke`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-bb-api-key": apiKey,
        },
        body: JSON.stringify({
          params: {
            source: "tax_collector",
            searchUrl,
            parcelId: stringValue(input.parcelId),
            propertyAddress: stringValue(input.propertyAddress),
            ownerName: stringValue(input.ownerName),
          },
          sessionCreateParams: browserbaseSessionCreateParams(env),
        }),
      });
      const invocation = await response.json().catch(() => ({})) as JsonRecord;
      const completedInvocation = await waitForBrowserbaseInvocation(invocation, env, apiKey, fetchImpl);
      const result = asRecord(completedInvocation.results);
      const workflowListingUrl = stringValue(result.listingUrl) || stringValue(result.finalUrl) || searchUrl;
      const workflowDiscovery = approvedTaxCollectorDiscovery(discoverTaxCollectorReceipt({
        ...input,
        listingUrl: workflowListingUrl,
        listingHtml: result.listingHtml,
        receiptUrl: result.receiptUrl,
        receiptLink: result.receiptLink,
      }), env);
      if (response.ok && workflowDiscovery) {
        return {
          ok: true,
          paidRun: true,
          mode: workflowDiscovery.mode,
          listingUrl: workflowDiscovery.listingUrl || workflowListingUrl,
          searchUrl,
          status: response.status,
          finalUrl: workflowListingUrl,
          discovery: workflowDiscovery,
          bodySnippet: browserbaseInvocationSummary(completedInvocation),
          reviewFlags: workflowDiscovery.reviewFlags,
        };
      }
      return {
        ok: false,
        mode: browserbaseResultMode(result, response.status, completedInvocation),
        paidRun: true,
        listingUrl: workflowListingUrl,
        searchUrl,
        status: response.status,
        finalUrl: workflowListingUrl,
        bodySnippet: stringValue(result.bodySnippet)
          || stringValue(result.message)
          || stringValue(result.error)
          || browserbaseInvocationSummary(completedInvocation),
        blocker: response.status === 402
          ? "Browserbase billing is required before the Tax Collector browser function can start."
          : response.status === 429
            ? "Browserbase concurrency or rate limits are currently preventing the Tax Collector browser function from starting."
            : stringValue(result.message)
          || stringValue(result.error)
          || (response.ok
            ? (isPendingBrowserbaseInvocation(completedInvocation)
              ? "Browserbase Tax Collector function is still running after the route wait window; retry the run to read the completed invocation."
              : "Browserbase Tax Collector function did not return a bottom-right receipt link.")
            : `Browserbase Tax Collector function invocation failed with HTTP ${response.status}.`),
        reviewFlags: BROWSER_WORKFLOW_FLAGS,
      };
    } catch (error) {
      return {
        ok: false,
        mode: "browser_workflow_required",
        paidRun: true,
        listingUrl: "",
        searchUrl,
        blocker: error instanceof Error ? error.message : String(error),
        reviewFlags: BROWSER_WORKFLOW_FLAGS,
      };
    }
  }

  const listingUrl = configuredListingUrl(input, env)
    || (env.TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED === "true" ? searchUrl : "");
  if (!listingUrl) {
    return {
      ok: false,
      mode: "not_configured",
      paidRun: false,
      listingUrl: "",
      searchUrl,
      blocker: "Tax Collector listing-page automation needs a direct listing URL or a configured listing URL template before a script can fetch the receipt link.",
      reviewFlags: DEFAULT_REVIEW_FLAGS,
    };
  }

  try {
    const fetched = await fetchApprovedTaxCollectorPage(listingUrl, env, fetchImpl);
    if (!fetched.response || fetched.body === undefined || !fetched.finalUrl) {
      const blocker = fetched.error === "invalid_url" || fetched.error === "redirect_blocked"
        ? "Tax Collector retrieval was blocked because the URL is outside the approved county HTTPS origins."
        : fetched.error === "unsafe_content_type"
          ? "Tax Collector retrieval was blocked because the listing did not return an approved HTML content type."
          : fetched.error === "body_too_large"
            ? "Tax Collector retrieval was blocked because the listing exceeded the safe response-size limit."
            : fetched.error === "timed_out"
              ? "Tax Collector retrieval timed out before a safe listing page was returned."
              : "Tax Collector retrieval could not safely load the approved county listing page.";
      return {
        ok: false,
        mode: "listing_page_blocked",
        paidRun: false,
        listingUrl: fetched.error === "invalid_url" ? "" : listingUrl,
        searchUrl,
        blocker,
        reviewFlags: ["SOURCE_BLOCKED", ...DEFAULT_REVIEW_FLAGS],
      };
    }
    const response = fetched.response;
    const body = fetched.body;
    const finalUrl = fetched.finalUrl;
    const bodySnippet = body.replace(/\s+/g, " ").slice(0, 500);
    if (isCloudflareChallenge(response.status, body) || isJavascriptShell(body)) {
      return {
        ok: false,
        mode: "browser_workflow_required",
        paidRun: false,
        listingUrl,
        searchUrl,
        status: response.status,
        finalUrl,
        blocker: "Tax Collector listing page requires a browser workflow before the receipt link can be captured by script.",
        reviewFlags: BROWSER_WORKFLOW_FLAGS,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        mode: "listing_page_blocked",
        paidRun: false,
        listingUrl,
        searchUrl,
        status: response.status,
        finalUrl,
        blocker: `Tax Collector listing page returned HTTP ${response.status}.`,
        reviewFlags: ["SOURCE_BLOCKED", ...DEFAULT_REVIEW_FLAGS],
      };
    }

    const discovery = approvedTaxCollectorDiscovery(
      discoverTaxCollectorReceipt({ ...input, listingHtml: body, listingUrl: finalUrl }),
      env,
    );
    if (!discovery) {
      return {
        ok: false,
        mode: "listing_page_no_receipt",
        paidRun: false,
        listingUrl,
        searchUrl,
        status: response.status,
        finalUrl,
        blocker: "Tax Collector listing page loaded, but no receipt/payment/print link was found for the bottom-right receipt step.",
        reviewFlags: DEFAULT_REVIEW_FLAGS,
      };
    }

    return {
      ok: true,
      paidRun: false,
      mode: discovery.mode,
      listingUrl: discovery.listingUrl,
      searchUrl,
      status: response.status,
      finalUrl,
      bodySnippet,
      discovery,
      reviewFlags: discovery.reviewFlags,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "listing_page_blocked",
      paidRun: false,
      listingUrl,
      searchUrl,
      blocker: "Tax Collector retrieval could not safely load the approved county listing page.",
      reviewFlags: ["SOURCE_BLOCKED", ...DEFAULT_REVIEW_FLAGS],
    };
  }
}
