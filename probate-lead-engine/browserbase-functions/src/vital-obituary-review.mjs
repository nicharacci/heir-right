import { defineFn } from "@browserbasehq/sdk-functions";
import { chromium } from "playwright-core";
import { anchorCandidates, compactObject, extractDateSignals, normalizeWhitespace, obituaryIdentityMatches, rankObituaryLinks } from "./source-helpers.mjs";

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
    candidates.push({ href: page.url(), url: page.url(), text: await page.title().catch(() => ""), index: candidates.length });
  }
  return candidates;
}

defineFn("vital-obituary-review", async (context, params = {}) => {
  const { browser, page } = await openBrowserPage(context);
  try {
    const name = subjectName(params);
    const candidates = await collectCandidatePages(page, params);
    const ranked = rankObituaryLinks(candidates).slice(0, 8);
    let text = "";
    let sourceUrl = "";
    for (const candidate of ranked) {
      await page.goto(candidate.url, { waitUntil: "domcontentloaded", timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const candidateUrl = page.url();
      const title = await page.title().catch(() => "");
      const body = normalizeWhitespace(await page.locator("body").innerText({ timeout: 8000 }).catch(() => ""));
      if (!obituaryIdentityMatches(name, `${title} ${candidateUrl} ${body.slice(0, 6000)}`)) continue;
      sourceUrl = candidateUrl;
      text = body;
      break;
    }
    const dates = extractDateSignals(text);
    const obituarySnapshot = text ? text.slice(0, 1200) : "";
    return compactObject({
      ok: true,
      source: "vital_obituary_review",
      status: sourceUrl ? "reviewed-with-identity-match" : "reviewed-not-found",
      sourceUrl,
      obituaryLink: sourceUrl,
      obituarySnapshot,
      dateOfBirth: sourceUrl ? dates.dateOfBirth : "",
      dateOfDeath: sourceUrl ? dates.dateOfDeath : "",
      identityMatched: Boolean(sourceUrl),
      candidateCount: candidates.length,
      checkedCandidateCount: ranked.length,
      message: sourceUrl ? "Identity-matched direct obituary source captured." : "No identity-matched direct obituary source was found.",
    });
  } finally {
    await browser.close().catch(() => {});
  }
});
