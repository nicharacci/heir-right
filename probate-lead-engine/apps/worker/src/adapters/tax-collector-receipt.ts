import type { ReviewFlag } from "@ple/types";

type FetchImpl = typeof fetch;
type RuntimeEnv = Record<string, string | undefined>;

export interface TaxCollectorReceiptInput {
  listingHtml?: unknown;
  listingUrl?: unknown;
  receiptUrl?: unknown;
  receiptLink?: unknown;
  sourceUrl?: unknown;
  parcelId?: unknown;
  propertyAddress?: unknown;
  ownerName?: unknown;
}

export interface TaxCollectorReceiptCandidate {
  href: string;
  url: string;
  text: string;
  index: number;
}

export interface TaxCollectorReceiptDiscovery {
  listingUrl: string;
  receiptUrl: string;
  candidates: TaxCollectorReceiptCandidate[];
  mode: "explicit" | "listing_page_bottom_right";
  reviewFlags: ReviewFlag[];
}

export interface TaxCollectorReceiptAcquisitionResult {
  ok: boolean;
  mode:
    | "explicit"
    | "listing_page_bottom_right"
    | "listing_page_no_receipt"
    | "listing_page_blocked"
    | "browser_workflow_required"
    | "not_configured";
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

const DEFAULT_TAX_COLLECTOR_SEARCH_URL = "https://miamidade.county-taxes.com/public";
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

function anchorCandidates(html: string, baseUrl: string): TaxCollectorReceiptCandidate[] {
  const candidates: TaxCollectorReceiptCandidate[] = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const fullAnchor = match[0] || "";
    const href = stringValue(match[1]);
    const text = stripTags(fullAnchor);
    const searchable = `${href} ${text}`.toLowerCase();
    if (!href || !/(receipt|taxbill|tax-bill|print|payment)/i.test(searchable)) continue;
    candidates.push({
      href,
      url: resolveUrl(href, baseUrl),
      text: text || "Tax receipt",
      index: candidates.length,
    });
  }
  return candidates;
}

export function discoverTaxCollectorReceipt(input: TaxCollectorReceiptInput): TaxCollectorReceiptDiscovery | null {
  const explicitUrl = stringValue(input.receiptUrl) || stringValue(input.receiptLink);
  const listingUrl = stringValue(input.listingUrl) || stringValue(input.sourceUrl);
  if (explicitUrl) {
    return {
      listingUrl,
      receiptUrl: resolveUrl(explicitUrl, listingUrl),
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

  const candidates = anchorCandidates(html, listingUrl);
  const bottomRightCandidate = candidates.at(-1);
  if (!bottomRightCandidate) return null;

  return {
    listingUrl,
    receiptUrl: bottomRightCandidate.url,
    candidates,
    mode: "listing_page_bottom_right",
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
        mode: "browser_workflow_required",
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
      listingUrl,
      searchUrl,
      blocker: error instanceof Error ? error.message : String(error),
      reviewFlags: ["SOURCE_BLOCKED", ...DEFAULT_REVIEW_FLAGS],
    };
  }
}
