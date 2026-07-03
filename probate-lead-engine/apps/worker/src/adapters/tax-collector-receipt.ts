import type { ReviewFlag } from "@ple/types";

export interface TaxCollectorReceiptInput {
  listingHtml?: unknown;
  listingUrl?: unknown;
  receiptUrl?: unknown;
  receiptLink?: unknown;
  sourceUrl?: unknown;
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
