function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
      resolve(request.body);
      return;
    }

    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
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

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
}

function internalBearerAllowed(request) {
  const expected = String(process.env.HEIRRIGHT_API_TOKEN || "");
  if (!expected) return false;
  const supplied = String(request?.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!supplied || supplied.length !== expected.length) return false;
  const { timingSafeEqual } = require("node:crypto");
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function requireApiAuth(request, response) {
  const { authRequired, effectiveSession } = require("./auth/_shared");
  if (!authRequired() || effectiveSession(request) || internalBearerAllowed(request)) return false;
  sendJson(response, 401, {
    ok: false,
    error: "auth_required",
    message: "Sign in with an approved HeirRight Google account.",
    loginUrl: "/auth/login",
  });
  return true;
}

function requireApiAdmin(request, response) {
  const { authRequired, effectiveSession } = require("./auth/_shared");
  const { adminEmails } = require("./admin/access-config");
  if (!authRequired() || internalBearerAllowed(request)) return false;
  const session = effectiveSession(request);
  if (!session) {
    sendJson(response, 401, {
      ok: false,
      error: "auth_required",
      message: "Sign in with an approved HeirRight Google account.",
      loginUrl: "/auth/login",
    });
    return true;
  }
  const email = String(session.email || "").trim().toLowerCase();
  if (session.mode === "google" && email && adminEmails(process.env).includes(email)) return false;
  sendJson(response, 403, {
    ok: false,
    error: "admin_required",
    message: "A configured HeirRight administrator must approve this change.",
  });
  return true;
}

function methodGuard(request, response) {
  if (request.method === "POST") return false;
  response.setHeader("Allow", "POST");
  sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  return true;
}

function workerApiBase() {
  return process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "";
}

function originFor(request) {
  const host = request?.headers?.["x-forwarded-host"] || request?.headers?.host || "surface.heirright.com";
  const proto = request?.headers?.["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function workerProxyHeaders(request, headers = {}) {
  const out = { ...headers };
  if (process.env.HEIRRIGHT_API_TOKEN) out.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
  if (request?.headers?.cookie) out.cookie = request.headers.cookie;
  if (request) {
    out["x-heirright-public-origin"] = originFor(request);
    out["x-forwarded-host"] = request.headers["x-forwarded-host"] || request.headers.host || "";
    out["x-forwarded-proto"] = request.headers["x-forwarded-proto"] || (originFor(request).startsWith("https:") ? "https" : "http");
  }
  return out;
}

async function proxyWorkerJson(pathname, body) {
  const base = workerApiBase().replace(/\/+$/, "");
  if (!base) return null;
  const headers = workerProxyHeaders(null, { "content-type": "application/json" });
  const response = await fetch(`${base}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/json; charset=utf-8",
    body: await response.text(),
  };
}

async function proxyWorkerHttp(request, response, pathname, options = {}) {
  const base = workerApiBase().replace(/\/+$/, "");
  if (!base) return false;
  const workerResponse = await fetch(`${base}${pathname}`, {
    method: options.method || request.method || "GET",
    headers: workerProxyHeaders(request, options.headers),
    body: options.body,
    redirect: "manual",
  });
  const headers = {
    "Content-Type": workerResponse.headers.get("content-type") || "text/html; charset=utf-8",
    "Cache-Control": workerResponse.headers.get("cache-control") || "no-store",
  };
  const location = workerResponse.headers.get("location");
  if (location) headers.Location = location;
  const setCookies = typeof workerResponse.headers.getSetCookie === "function"
    ? workerResponse.headers.getSetCookie()
    : [workerResponse.headers.get("set-cookie")].filter(Boolean);
  if (setCookies.length) headers["Set-Cookie"] = setCookies;
  response.writeHead(workerResponse.status, headers);
  response.end(await workerResponse.text());
  return true;
}

function sendProxied(response, proxied) {
  response.statusCode = proxied.status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", proxied.contentType);
  response.end(proxied.body);
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
  return String(value || "")
    .replace(/\b(est|estate|of|the)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .at(-1)?.toLowerCase() || "";
}

function idiLockKey(body = {}) {
  return [
    String(body.provider || "idi").toLowerCase(),
    normalizeAssetAddress(body.propertyAddress || body.address || body.assetAddress),
    ownerLastName(body.ownerName || body.estateName),
  ].filter(Boolean).join(":");
}

function receiptId(prefix = "artifact") {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${random}`;
}

function stripTags(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceText(input = {}) {
  return [
    input.listingText,
    input.receiptText,
    input.detailsText,
    input.listingHtml ? stripTags(input.listingHtml) : "",
    input.receiptHtml ? stripTags(input.receiptHtml) : "",
  ].map((item) => String(item || "").trim()).filter(Boolean).join(" ");
}

function compactWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function labeledValue(text, labels, stopPattern = /(?:paid\s+by|payor|payer|paid\s+date|payment\s+date|date\s+paid|amount\s+due|total\s+due|balance\s+due|unpaid\s+years?|delinquent\s+years?|tax\s+year|status|print|receipt|folio|parcel)\b/i) {
  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*[:#-]?\\s*([^|\\n\\r]+?)(?=\\s{2,}|\\s+${stopPattern.source}|$)`, "i");
    const match = text.match(pattern);
    if (match?.[1]) return compactWhitespace(match[1]);
  }
  return "";
}

function parseMoney(value) {
  const match = String(value || "").match(/\$?\s*([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)(?:\.[0-9]{2})?/);
  if (!match) return null;
  const amount = Number(match[0].replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseYears(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => Number(String(item).replace(/\D/g, ""))).filter((year) => year >= 1900 && year <= 2200)));
  }
  return Array.from(new Set((String(value || "").match(/\b(?:19|20)\d{2}\b/g) || []).map(Number)));
}

function normalizeTaxAmountDue(value, years = []) {
  if (value && typeof value === "object" && !Array.isArray(value) && typeof value.amount === "number") return value;
  const amount = parseMoney(value);
  if (amount === null) return undefined;
  return {
    amount,
    currency: "USD",
    years: Array.isArray(years) ? years : [],
  };
}

function extractTaxCollectorDetails(input = {}) {
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

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl || "https://miamidade.county-taxes.com/").toString();
  } catch {
    return href;
  }
}

function discoverTaxCollectorReceipt(input = {}) {
  const explicitUrl = String(input.receiptUrl || input.receiptLink || "").trim();
  const listingUrl = String(input.listingUrl || input.sourceUrl || "").trim();
  const details = extractTaxCollectorDetails(input);
  if (explicitUrl) {
    const url = resolveUrl(explicitUrl, listingUrl);
    return {
      listingUrl,
      receiptUrl: url,
      mode: "explicit",
      details,
      candidates: [{ href: explicitUrl, url, text: "Operator supplied receipt link", index: 0 }],
      reviewFlags: ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
    };
  }
  const html = String(input.listingHtml || "");
  if (!html) return null;
  const candidates = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html)) !== null) {
    const fullAnchor = match[0] || "";
    const href = String(match[1] || "").trim();
    const text = stripTags(fullAnchor);
    if (!href) continue;
    candidates.push({ href, url: resolveUrl(href, listingUrl), text: text || "Tax receipt", html: fullAnchor, index: candidates.length });
  }
  const receipt = candidates
    .map((candidate) => ({ ...candidate, score: taxReceiptCandidateScore(candidate) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  if (!receipt) return null;
  return {
    listingUrl,
    receiptUrl: receipt.url,
    mode: "listing_page_bottom_right",
    details,
    candidates,
    reviewFlags: ["TAX_RECEIPT_LINK_CAPTURED", "HUMAN_REVIEW_REQUIRED"],
  };
}

function taxReceiptCandidateScore(candidate = {}) {
  const haystack = `${candidate.href || ""} ${candidate.url || ""} ${candidate.text || ""}`.toLowerCase();
  const anchorHtml = String(candidate.html || "").toLowerCase();
  let score = 0;
  if (/local\s+business\s+tax|lbt\s+tax\s+receipt|business-tax|business\s+tax\s+receipt/.test(haystack)) score -= 25;
  if (/receipt|receipts/.test(haystack) && /(print|payment|paid|tax\s*-?\s*bill|taxbill|real\s+estate|property|parcel|folio|ad\s+valorem)/.test(haystack)) score += 12;
  if (/tax\s*-?\s*bill|taxbill/.test(haystack)) score += 8;
  if (/print/.test(haystack) && /(receipt|bill)/.test(haystack)) score += 6;
  if (/payment/.test(haystack) && /(receipt|tax\s*-?\s*bill|taxbill)/.test(haystack)) score += 4;
  if (/class=["'][^"']*(receipt|print|tax|bill|payment)[^"']*["']/.test(anchorHtml)) score += 3;
  if (score > 0 && /(bottom|right|float\s*:\s*right|text-align\s*:\s*right|pull-right|align-right|justify-content\s*:\s*end|justify-content\s*:\s*flex-end)/.test(anchorHtml)) score += 5;
  if (/history|account|login|search|privacy|terms|contact|help|faq/.test(haystack)) score -= 10;
  return score > 0 ? score + Number(candidate.index || 0) / 1000 : 0;
}

module.exports = {
  discoverTaxCollectorReceipt,
  extractTaxCollectorDetails,
  idiLockKey,
  methodGuard,
  proxyWorkerHttp,
  proxyWorkerJson,
  requireApiAdmin,
  requireApiAuth,
  readJsonBody,
  receiptId,
  sendJson,
  sendProxied,
};
