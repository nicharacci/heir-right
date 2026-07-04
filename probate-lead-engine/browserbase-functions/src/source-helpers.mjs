export function normalizeWhitespace(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function stripTags(value = "") {
  return normalizeWhitespace(String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&"));
}

export function resolveUrl(href = "", baseUrl = "https://miamidade.county-taxes.com/") {
  try {
    return new URL(href, baseUrl || "https://miamidade.county-taxes.com/").toString();
  } catch {
    return href;
  }
}

export function compactObject(input = {}) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== "";
  }));
}

export function anchorCandidates(html = "", baseUrl = "") {
  const candidates = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(String(html || ""))) !== null) {
    const fullAnchor = match[0] || "";
    const href = String(match[1] || "").trim();
    const text = stripTags(fullAnchor);
    if (!href) continue;
    candidates.push({
      href,
      url: resolveUrl(href, baseUrl),
      text,
      html: fullAnchor,
      index: candidates.length,
    });
  }
  return candidates;
}

export function taxReceiptCandidateScore(candidate = {}) {
  const haystack = `${candidate.href || ""} ${candidate.url || ""} ${candidate.text || ""}`.toLowerCase();
  const anchorHtml = String(candidate.html || "").toLowerCase();
  let score = 0;
  if (/receipt|receipts/.test(haystack)) score += 12;
  if (/tax\s*-?\s*bill|taxbill/.test(haystack)) score += 8;
  if (/print/.test(haystack) && /(receipt|bill)/.test(haystack)) score += 6;
  if (/payment/.test(haystack) && /(receipt|tax\s*-?\s*bill|taxbill)/.test(haystack)) score += 4;
  if (/class=["'][^"']*(receipt|print|tax|bill|payment)[^"']*["']/.test(anchorHtml)) score += 3;
  if (/(bottom|right|float\s*:\s*right|text-align\s*:\s*right|pull-right|align-right|justify-content\s*:\s*end|justify-content\s*:\s*flex-end)/.test(anchorHtml)) score += 5;
  if (/history|account|login|search|privacy|terms|contact|help|faq/.test(haystack)) score -= 10;
  return score + Number(candidate.index || 0) / 1000;
}

export function discoverTaxCollectorReceipt(input = {}) {
  const explicitUrl = String(input.receiptUrl || input.receiptLink || "").trim();
  const listingUrl = String(input.listingUrl || input.sourceUrl || input.finalUrl || "").trim();
  if (explicitUrl) {
    return {
      listingUrl,
      receiptUrl: resolveUrl(explicitUrl, listingUrl),
      mode: "explicit",
      candidates: [{
        href: explicitUrl,
        url: resolveUrl(explicitUrl, listingUrl),
        text: "Operator supplied receipt link",
        index: 0,
      }],
    };
  }

  const candidates = anchorCandidates(input.listingHtml || "", listingUrl)
    .map((candidate) => ({ ...candidate, score: taxReceiptCandidateScore(candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);
  const bottomRightCandidate = candidates[0];
  if (!bottomRightCandidate) return null;
  return {
    listingUrl,
    receiptUrl: bottomRightCandidate.url,
    mode: "listing_page_bottom_right",
    candidates,
  };
}

export function obituaryLinkScore(candidate = {}) {
  const haystack = `${candidate.url || ""} ${candidate.text || ""}`.toLowerCase();
  let score = 0;
  if (/obituar|memorial|death-notice|tribute/.test(haystack)) score += 4;
  if (/legacy\.com|findagrave\.com|dignitymemorial\.com|everloved\.com/.test(haystack)) score += 3;
  if (/facebook|instagram|linkedin|peoplefinders|whitepages/.test(haystack)) score -= 3;
  if (/miamidadeclerk|marriage|license/.test(haystack)) score += 1;
  return score;
}

export function pickBestObituaryLink(candidates = []) {
  return candidates
    .map((candidate) => ({ ...candidate, score: obituaryLinkScore(candidate) }))
    .sort((a, b) => b.score - a.score)
    .find((candidate) => candidate.score > 0) || null;
}

export function extractDateSignals(text = "") {
  const normalized = normalizeWhitespace(text);
  const datePattern = "([A-Z][a-z]+\\s+\\d{1,2},\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{2,4}|\\d{4}-\\d{2}-\\d{2})";
  const findAfter = (keywords) => {
    const keyword = keywords.join("|");
    const match = normalized.match(new RegExp(`\\b(?:${keyword})\\b([^.]{0,80})`, "i"));
    if (!match) return null;
    return match[1]?.match(new RegExp(datePattern))?.[1] || null;
  };
  return {
    dateOfBirth: findAfter(["born", "birth", "dob"]),
    dateOfDeath: findAfter(["died", "death", "dod", "passed away", "deceased"]),
  };
}
