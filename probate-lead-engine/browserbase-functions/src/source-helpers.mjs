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
      index: candidates.length,
    });
  }
  return candidates;
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
    .filter((candidate) => /(receipt|taxbill|tax-bill|print|payment)/i.test(`${candidate.href} ${candidate.text}`));
  const bottomRightCandidate = candidates.at(-1);
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
