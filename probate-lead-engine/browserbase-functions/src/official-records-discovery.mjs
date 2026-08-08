import { defineFn } from "@browserbasehq/sdk-functions";
import { chromium } from "playwright-core";
import { compactObject, normalizeWhitespace, officialRecordsAddress, parseOfficialRecordsResults } from "./source-helpers.mjs";

const OFFICIAL_RECORDS_URL = "https://onlineservices.miamidadeclerk.gov/officialrecords";

async function openBrowserPage(context) {
  const browser = await chromium.connectOverCDP(context.session.connectUrl);
  const browserContext = browser.contexts()[0] || await browser.newContext();
  const page = browserContext.pages()[0] || await browserContext.newPage();
  return { browser, page };
}

defineFn("official-records-discovery", async (context, params = {}) => {
  const address = officialRecordsAddress(params.propertyAddress);
  if (!address) return { ok: false, source: "official_records", mode: "input_required", message: "Property address is required." };

  const { browser, page } = await openBrowserPage(context);
  try {
    await page.goto(OFFICIAL_RECORDS_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.getByRole("button", { name: "Property/Condo" }).waitFor({ state: "visible", timeout: 20_000 });
    await page.getByRole("button", { name: "Property/Condo" }).click();
    await page.getByRole("textbox", { name: "111 NW 1 ST" }).fill(address);
    await page.getByRole("combobox", { name: "Document Type" }).selectOption({ label: "ANY PROPERTY TRANSFER - PT" });
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByText(/results returned/i).waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const sourceUrl = page.url();
    const bodyText = normalizeWhitespace(await page.locator("body").innerText({ timeout: 10_000 }).catch(() => ""));
    if (/verify you are human|security verification|access denied|captcha required/i.test(bodyText) && !/results returned/i.test(bodyText)) {
      return { ok: false, source: "official_records", mode: "browser_navigation_blocked", sourceUrl, bodySnippet: bodyText.slice(0, 1200), message: "Official Records verification blocked the standard property search." };
    }

    const records = parseOfficialRecordsResults(bodyText);
    const latest = records[0] || null;
    return compactObject({
      ok: true,
      source: "official_records",
      mode: records.length ? "found" : "checked_not_found",
      sourceUrl,
      recordCount: records.length,
      latestDeed: latest,
      bookPage: latest?.bookPage,
      bodySnippet: bodyText.slice(0, 1200),
    });
  } finally {
    await browser.close().catch(() => {});
  }
});
