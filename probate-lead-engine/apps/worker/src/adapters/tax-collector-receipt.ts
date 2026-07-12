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

const DEFAULT_TAX_COLLECTOR_SEARCH_URL = "https://county-taxes.net/fl-miamidade/property-tax";
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
      const workflowDiscovery = discoverTaxCollectorReceipt({
        ...input,
        listingUrl: workflowListingUrl,
        listingHtml: data.listingHtml,
        receiptUrl: data.receiptUrl,
        receiptLink: data.receiptLink,
      });
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
      const workflowDiscovery = discoverTaxCollectorReceipt({
        ...input,
        listingUrl: workflowListingUrl,
        listingHtml: result.listingHtml,
        receiptUrl: result.receiptUrl,
        receiptLink: result.receiptLink,
      });
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
    const response = await fetchImpl(listingUrl, {
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
        "user-agent": "HeirRight-TaxCollectorReceipt/1.0",
      },
    });
    const body = await response.text();
    const bodySnippet = body.replace(/\s+/g, " ").slice(0, 500);
    if (isCloudflareChallenge(response.status, body) || isJavascriptShell(body)) {
      return {
        ok: false,
        mode: "browser_workflow_required",
        paidRun: false,
        listingUrl,
        searchUrl,
        status: response.status,
        finalUrl: response.url,
        bodySnippet,
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
        finalUrl: response.url,
        bodySnippet,
        blocker: `Tax Collector listing page returned HTTP ${response.status}.`,
        reviewFlags: ["SOURCE_BLOCKED", ...DEFAULT_REVIEW_FLAGS],
      };
    }

    const discovery = discoverTaxCollectorReceipt({ ...input, listingHtml: body, listingUrl: response.url || listingUrl });
    if (!discovery) {
      return {
        ok: false,
        mode: "listing_page_no_receipt",
        paidRun: false,
        listingUrl,
        searchUrl,
        status: response.status,
        finalUrl: response.url,
        bodySnippet,
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
      finalUrl: response.url,
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
      blocker: error instanceof Error ? error.message : String(error),
      reviewFlags: ["SOURCE_BLOCKED", ...DEFAULT_REVIEW_FLAGS],
    };
  }
}
