import { defineFn } from "@browserbasehq/sdk-functions";
import { chromium } from "playwright-core";
import { anchorCandidates, compactObject, extractDateSignals, normalizeWhitespace, pickBestObituaryLink } from "./source-helpers.mjs";

function subjectName(params = {}) {
  return normalizeWhitespace(params.ownerName || params.estateName || "").replace(/^estate\s+of\s+/i, "");
}

function searchUrls(params = {}) {
  const name = subjectName(params);
  const county = normalizeWhitespace(params.county || "Miami-Dade");
  const urls = Array.isArray(params.sourceUrls) ? params.sourceUrls.filter(Boolean) : [];
  if (name) {
    const query = encodeURIComponent(`${name} ${county} obituary OR legacy OR findagrave`);
    urls.push(`https://www.google.com/search?q=${query}`);
  }
  if (params.clerkSearchUrl) urls.push(String(params.clerkSearchUrl));
  return [...new Set(urls)].slice(0, 6);
}

async function openBrowserPage(context) {
  const browser = await chromium.connectOverCDP(context.session.connectUrl);
  const browserContext = browser.contexts()[0] || await browser.newContext();
  const page = browserContext.pages()[0] || await browserContext.newPage();
  return { browser, page };
}

async function collectCandidatePages(page, params = {}) {
  const candidates = [];
  for (const url of searchUrls(params)) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const html = await page.content().catch(() => "");
    candidates.push(...anchorCandidates(html, page.url()));
    candidates.push({
      href: page.url(),
      url: page.url(),
      text: await page.title().catch(() => ""),
      index: candidates.length,
    });
  }
  return candidates;
}

defineFn("vital-obituary-review", async (context, params = {}) => {
  const { browser, page } = await openBrowserPage(context);
  try {
    const candidates = await collectCandidatePages(page, params);
    const best = pickBestObituaryLink(candidates);
    let text = "";
    let sourceUrl = best?.url || "";
    if (sourceUrl) {
      await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1500);
      sourceUrl = page.url();
      text = normalizeWhitespace(await page.locator("body").innerText({ timeout: 8000 }).catch(() => ""));
    }
    const dates = extractDateSignals(text);
    const obituarySnapshot = text ? text.slice(0, 1200) : "";

    return compactObject({
      ok: Boolean(sourceUrl || candidates.length),
      source: "vital_obituary_review",
      status: sourceUrl ? "reviewed-with-source" : "reviewed-not-found",
      sourceUrl,
      obituaryLink: sourceUrl,
      obituarySnapshot,
      dateOfBirth: dates.dateOfBirth,
      dateOfDeath: dates.dateOfDeath,
      marriageLicenseSignal: "review_required",
      deathCertificateStatus: "manual_review_required",
      incarcerationStatus: "manual_review_required",
      candidateCount: candidates.length,
      message: sourceUrl
        ? "Obituary or memorial source candidate captured for operator review."
        : "No obituary or memorial source candidate was captured in this browser run.",
    });
  } finally {
    await browser.close().catch(() => {});
  }
});
