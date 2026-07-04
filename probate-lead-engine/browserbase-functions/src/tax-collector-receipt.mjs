import { defineFn } from "@browserbasehq/sdk-functions";
import { chromium } from "playwright-core";
import { discoverTaxCollectorReceipt, normalizeWhitespace } from "./source-helpers.mjs";

const DEFAULT_SEARCH_URL = "https://miamidade.county-taxes.com/public";

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
  const input = page.locator("input:visible").first();
  if (await input.count().catch(() => 0)) {
    await input.fill(term);
    await input.press("Enter");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  }
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
  await page.goto(hit.href, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  return true;
}

export default defineFn(async (context, params = {}) => {
  const supplied = discoverTaxCollectorReceipt({
    listingUrl: params.listingUrl,
    listingHtml: params.listingHtml,
    receiptUrl: params.receiptUrl,
    receiptLink: params.receiptLink,
  });
  if (supplied) {
    return { ok: true, source: "tax_collector", ...supplied };
  }

  const { browser, page } = await openBrowserPage(context);
  try {
    const searchUrl = String(params.searchUrl || DEFAULT_SEARCH_URL);
    await page.goto(String(params.listingUrl || searchUrl), { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    if (!params.listingUrl) {
      await submitSearch(page, searchTerm(params));
      await openLikelyListing(page, params);
    }

    const listingHtml = await page.content();
    const listingUrl = page.url();
    const discovery = discoverTaxCollectorReceipt({ listingHtml, listingUrl });
    if (!discovery) {
      return {
        ok: false,
        source: "tax_collector",
        mode: "listing_page_no_receipt",
        listingUrl,
        listingHtml,
        message: "Tax Collector page loaded, but no receipt/payment/print link was found for the bottom-right receipt step.",
      };
    }

    return {
      ok: true,
      source: "tax_collector",
      listingHtml,
      ...discovery,
    };
  } finally {
    await browser.close().catch(() => {});
  }
});
