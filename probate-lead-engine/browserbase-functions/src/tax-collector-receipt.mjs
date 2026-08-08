import { defineFn } from "@browserbasehq/sdk-functions";
import { chromium } from "playwright-core";
import { compactObject, discoverTaxCollectorReceipt, normalizeWhitespace, stripTags } from "./source-helpers.mjs";

const DEFAULT_SEARCH_URL = "https://county-taxes.net/fl-miamidade/property-tax";

function normalizeSearchUrl(value = "") {
  const url = String(value || DEFAULT_SEARCH_URL).trim();
  if (/miamidade\.county-taxes\.com\/public/i.test(url)) return DEFAULT_SEARCH_URL;
  return url || DEFAULT_SEARCH_URL;
}

function bounded(value = "", limit = 1800) {
  return normalizeWhitespace(value).slice(0, limit);
}

function isBrowserErrorPage(url = "", html = "") {
  return /^chrome-error:\/\//i.test(String(url || ""))
    || /ERR_[A-Z_]+|This site can.?t be reached|Enable JavaScript and cookies to continue|Just a moment/i.test(String(html || ""));
}

async function waitForSecurityCheck(page) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const title = await page.title().catch(() => "");
    const text = await page.locator("body").innerText({ timeout: 2000 }).catch(() => "");
    if (!/Just a moment|Performing security verification|verify you are not a bot/i.test(`${title} ${text}`)) return;
    await page.waitForTimeout(1500);
  }
}

function browserbaseDiscoveryPayload(discovery = {}, extra = {}) {
  return compactObject({
    ok: true,
    source: "tax_collector",
    mode: discovery.mode,
    listingUrl: discovery.listingUrl,
    receiptUrl: discovery.receiptUrl,
    receiptLink: discovery.receiptUrl,
    details: discovery.details,
    candidates: (discovery.candidates || []).slice(0, 5).map((candidate) => compactObject({
      href: candidate.href,
      url: candidate.url,
      text: candidate.text,
      index: candidate.index,
      score: candidate.score,
    })),
    ...extra,
  });
}

async function pageSummary(page) {
  let surface = page;
  for (const frame of page.frames()) {
    const frameText = await frame.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    if (/Account Summary|Account history|Amount due|Print \(PDF\)/i.test(frameText)) {
      surface = frame;
      break;
    }
  }
  const dataDeadline = Date.now() + 20_000;
  while (Date.now() < dataDeadline) {
    const currentText = await surface.locator("body").innerText({ timeout: 3000 }).catch(() => "");
    if (/Print \(PDF\)|Receipt #/i.test(currentText)) break;
    await page.waitForTimeout(1000);
  }
  const listingUrl = surface.url() || page.url();
  const title = await surface.title().catch(() => page.title().catch(() => ""));
  const html = await surface.content().catch(() => "");
  const text = await surface.locator("body").innerText({ timeout: 5000 }).catch(() => stripTags(html));
  return {
    listingUrl,
    title,
    html,
    bodyText: bounded(text || stripTags(html), 12_000),
    bodySnippet: bounded(text || stripTags(html), 1800),
    htmlSnippet: bounded(html, 1800),
  };
}

function searchTerm(params = {}) {
  return [params.parcelId, params.propertyAddress, params.ownerName]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "";
}

async function openBrowserPage(context) {
  const browser = await chromium.connectOverCDP(context.session.connectUrl);
  const browserContext = browser.contexts()[0] || await browser.newContext();
  const page = browserContext.pages()[0] || await browserContext.newPage();
  return { browser, page };
}

async function submitSearch(page, term) {
  if (!term) return;
  const input = page.locator([
    "input[type='search']:visible",
    "input[placeholder*='Search' i]:visible",
    "input[placeholder*='account' i]:visible",
    "input[placeholder*='folio' i]:visible",
    "input[placeholder*='property' i]:visible",
    "input[placeholder*='address' i]:visible",
    "input[name*='search' i]:visible",
    "input:visible",
  ].join(", ")).first();
  await input.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  if (await input.count().catch(() => 0)) {
    await input.fill(term);
    await page.waitForTimeout(1200);
    const option = page.getByRole("option").first();
    if (await option.count().catch(() => 0)) {
      await option.click({ timeout: 5000 });
    } else {
      const searchButton = page.getByRole("button", { name: /search|submit|go/i }).first();
      if (await searchButton.count().catch(() => 0)) {
        await searchButton.click({ timeout: 5000 }).catch(() => {});
      } else {
        await input.press("Enter");
      }
    }
    await page.waitForTimeout(3500);
  }
}

function extractTaxDetails(text = "") {
  const paidDate = text.match(/most recent payment was made on\s+([0-9/]+)/i)?.[1]
    || text.match(/Paid\s+\$[0-9,.]+\s+([0-9/]+)/i)?.[1]
    || "";
  const amount = text.match(/most recent payment was made on\s+[0-9/]+\s+for\s+\$([0-9,.]+)/i)?.[1]
    || text.match(/Paid\s+\$([0-9,.]+)/i)?.[1]
    || "";
  const paidInFull = /paid in full|nothing due at this time/i.test(text);
  return compactObject({
    paidDate,
    amountDue: paidInFull ? { amount: 0, currency: "USD", years: [] } : undefined,
    receiptStatus: paidInFull ? "paid_in_full" : undefined,
    lastPaymentAmount: amount ? Number(amount.replace(/,/g, "")) : undefined,
  });
}

async function openLikelyListing(page, params = {}) {
  const folio = String(params.parcelId || "").replace(/\D+/g, "");
  const address = normalizeWhitespace(params.propertyAddress || "").toLowerCase();
  const links = await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => ({
    href: anchor.href,
    text: anchor.textContent || "",
  }))).catch(() => []);
  const hit = links.find((link) => {
    const haystack = `${link.href} ${link.text}`.toLowerCase().replace(/\D+/g, "");
    if (folio && haystack.includes(folio)) return true;
    return address && `${link.href} ${link.text}`.toLowerCase().includes(address.split(" ").slice(0, 3).join(" "));
  }) || links.find((link) => /property|parcel|bill|tax|account/i.test(`${link.href} ${link.text}`));
  if (!hit?.href) return false;
  await page.goto(hit.href, { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForTimeout(1500);
  return true;
}

defineFn("tax-collector-receipt", async (context, params = {}) => {
  const supplied = discoverTaxCollectorReceipt({
    listingUrl: params.listingUrl,
    listingHtml: params.listingHtml,
    receiptUrl: params.receiptUrl,
    receiptLink: params.receiptLink,
  });
  if (supplied) {
    return browserbaseDiscoveryPayload(supplied);
  }

  const { browser, page } = await openBrowserPage(context);
  try {
    const searchUrl = normalizeSearchUrl(params.searchUrl);
    await page.goto(String(params.listingUrl || searchUrl), { waitUntil: "domcontentloaded", timeout: 25000 });
    await waitForSecurityCheck(page);
    await page.waitForTimeout(750);
    if (!params.listingUrl) {
      await submitSearch(page, searchTerm(params));
      await waitForSecurityCheck(page);
    }

    const summary = await pageSummary(page);
    const discovery = discoverTaxCollectorReceipt({ listingHtml: summary.html, listingUrl: summary.listingUrl });
    if (discovery) discovery.details = extractTaxDetails(summary.bodyText);
    if (isBrowserErrorPage(summary.listingUrl, `${summary.title} ${summary.bodyText}`)) {
      return {
        ok: false,
        source: "tax_collector",
        mode: "browser_navigation_blocked",
        listingUrl: summary.listingUrl,
        finalUrl: summary.listingUrl,
        pageTitle: summary.title,
        bodySnippet: summary.bodySnippet,
        message: "Tax Collector browser workflow reached a browser/challenge page before the property listing.",
      };
    }
    if (!discovery) {
      return {
        ok: false,
        source: "tax_collector",
        mode: "listing_page_no_receipt",
        listingUrl: summary.listingUrl,
        finalUrl: summary.listingUrl,
        pageTitle: summary.title,
        bodySnippet: summary.bodySnippet,
        htmlSnippet: summary.htmlSnippet,
        message: "Tax Collector page loaded, but no receipt/payment/print link was found for the bottom-right receipt step.",
      };
    }

    return browserbaseDiscoveryPayload(discovery, {
      finalUrl: summary.listingUrl,
      pageTitle: summary.title,
      bodySnippet: summary.bodySnippet,
    });
  } finally {
    await browser.close().catch(() => {});
  }
});
