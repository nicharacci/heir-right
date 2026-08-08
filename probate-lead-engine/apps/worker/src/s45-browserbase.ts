export type S45BrowserbaseEnv = {
  BROWSERBASE_API_KEY?: string;
  OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID?: string;
  BROWSERBASE_API_BASE?: string;
  BROWSERBASE_PROJECT_ID?: string;
};

export type S45VitalFinding = {
  sourceUrl: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  obituarySnapshot?: string;
  invocationId?: string;
  sessionId?: string;
  accessMode?: "direct_destination" | "browserbase_fetch" | "browserbase_function";
  searchResultCount?: number;
  checkedCandidateCount?: number;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function approvedObituaryResult(value: unknown): string {
  const result = record(value);
  const url = text(result.url);
  const title = text(result.title);
  if (!url.startsWith("https://")) return "";
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { return ""; }
  if (/(^|\.)(google\.[^.]+|bing\.com|duckduckgo\.com)$/.test(hostname)) return "";
  return /obituar|memorial|death-notice|tribute|legacy\.com|findagrave\.com|everloved\.com|dignitymemorial\.com/i.test(`${url} ${title}`) ? url : "";
}

export async function discoverSourceUrls(apiBase: string, apiKey: string, input: { ownerName: string; county?: string }): Promise<string[]> {
  const ownerName = text(input.ownerName).slice(0, 100);
  const countyInput = text(input.county);
  const county = /miami[- ]dade/i.test(countyInput) ? "Miami-Dade" : countyInput.slice(0, 40) || "Miami-Dade";
  const query = `"${ownerName}" ${county} obituary memorial`.slice(0, 200);
  const response = await fetch(apiBase + "/v1/search", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-bb-api-key": apiKey },
    body: JSON.stringify({ query, numResults: 25 }),
  });
  if (!response.ok) throw new Error(`browserbase_search_failed_${response.status}`);
  const results = record(await response.json().catch(() => ({}))).results;
  return [...new Set((Array.isArray(results) ? results : []).map(approvedObituaryResult).filter(Boolean))].slice(0, 8);
}

function stripHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function directIdentityMatches(subject: string, destination: string): boolean {
  const tokens = subject.toLowerCase().replace(/\b(estate|est|of|the|deceased|decedent)\b/g, " ").replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((token) => token.length > 1);
  if (tokens.length < 2) return false;
  const haystack = ` ${destination.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ")} `;
  const phrases = [tokens, [...tokens].reverse(), [...tokens.slice(1), tokens[0]]].map((parts) => ` ${parts.join(" ")} `);
  return [...new Set(phrases)].some((phrase) => haystack.includes(phrase));
}

function locationSignals(input: { county?: string; propertyAddress?: string }): string[] {
  const address = text(input.propertyAddress).toLowerCase();
  const county = text(input.county).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const knownCity = address.match(/\b(miami gardens|florida city|north miami|miami|hialeah|homestead)\b/)?.[1] || "";
  return [...new Set([knownCity, county, county.replace(/\s+county$/, "")].filter((value) => value.length >= 5))];
}

function locationMatches(input: { county?: string; propertyAddress?: string }, destination: string): boolean {
  const haystack = destination.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const signals = locationSignals(input);
  return signals.length > 0 && signals.some((signal) => haystack.includes(signal));
}

function extractDateSignals(value: string): { dateOfBirth?: string; dateOfDeath?: string } {
  const normalized = value.replace(/\s+/g, " ").trim();
  const months = "January|February|March|April|May|June|July|August|September|October|November|December";
  const date = `((?:${months})\\s+\\d{1,2},\\s+\\d{4}|\\d{1,2}/\\d{1,2}/\\d{2,4}|\\d{4}-\\d{2}-\\d{2})`;
  const after = (keywords: string[]) => normalized.match(new RegExp(`\\b(?:${keywords.join("|")})\\b[^.]{0,80}?${date}`, "i"))?.[1];
  const range = normalized.match(new RegExp(`(${date})\\s*[\\u2013\\u2014-]\\s*(${date})`, "i"));
  return {
    ...(after(["born", "birth", "dob"]) || range?.[2] ? { dateOfBirth: after(["born", "birth", "dob"]) || range?.[2] } : {}),
    ...(after(["died", "death", "dod", "passed away", "deceased"]) || range?.[4] ? { dateOfDeath: after(["died", "death", "dod", "passed away", "deceased"]) || range?.[4] } : {}),
  };
}

async function fetchDestination(apiBase: string, apiKey: string, sourceUrl: string): Promise<{ html: string; finalUrl: string; accessMode: "direct_destination" | "browserbase_fetch" } | null> {
  try {
    const response = await fetch(sourceUrl, { redirect: "follow", headers: { accept: "text/html,application/xhtml+xml", "user-agent": "HeirRight-S46/1.0" } });
    const contentType = response.headers.get("content-type") || "";
    if (response.ok && /text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return { html: (await response.text()).slice(0, 1_000_000), finalUrl: response.url.startsWith("https://") ? response.url : sourceUrl, accessMode: "direct_destination" };
    }
  } catch {}
  try {
    const response = await fetch(apiBase + "/v1/fetch", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "x-bb-api-key": apiKey },
      body: JSON.stringify({ url: sourceUrl, allowRedirects: true, allowInsecureSsl: false, proxies: false }),
    });
    if (!response.ok) return null;
    const payload = record(await response.json().catch(() => ({})));
    const statusCode = Number(payload.statusCode || 0);
    const contentType = text(payload.contentType);
    const content = text(payload.content);
    if (statusCode < 200 || statusCode >= 300 || !/text\/html|application\/xhtml\+xml/i.test(contentType) || !content) return null;
    return { html: content.slice(0, 1_000_000), finalUrl: sourceUrl, accessMode: "browserbase_fetch" };
  } catch { return null; }
}

async function directDestinationFinding(sourceUrls: string[], input: { ownerName: string; county?: string; propertyAddress?: string }, apiBase: string, apiKey: string): Promise<{ finding: S45VitalFinding | null; fetchedCount: number }> {
  let fetchedCount = 0;
  for (const sourceUrl of sourceUrls.slice(0, 8)) {
    const fetched = await fetchDestination(apiBase, apiKey, sourceUrl);
    if (!fetched) continue;
    const html = fetched.html;
    fetchedCount += 1;
    const title = stripHtml(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const body = stripHtml(html).slice(0, 20_000);
    const finalUrl = fetched.finalUrl;
    const identityText = `${title} ${finalUrl} ${body.slice(0, 6000)}`;
    if (!directIdentityMatches(input.ownerName, identityText) || !locationMatches(input, identityText)) continue;
    const dates = extractDateSignals(body);
    return {
      fetchedCount,
      finding: {
        sourceUrl: finalUrl,
        obituarySnapshot: body.slice(0, 1200),
        ...dates,
        accessMode: fetched.accessMode,
        searchResultCount: sourceUrls.length,
        checkedCandidateCount: fetchedCount,
      },
    };
  }
  return { finding: null, fetchedCount };
}

async function waitForResult(invocation: Record<string, unknown>, apiBase: string, apiKey: string): Promise<Record<string, unknown>> {
  let current = invocation;
  const id = text(current.id);
  const deadline = Date.now() + 45_000;
  while (id && ["PENDING", "RUNNING"].includes(text(current.status).toUpperCase()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const statusResponse = await fetch(apiBase + "/v1/functions/invocations/" + encodeURIComponent(id), {
      headers: { accept: "application/json", "x-bb-api-key": apiKey },
    });
    const next = record(await statusResponse.json().catch(() => ({})));
    if (!statusResponse.ok || !Object.keys(next).length) break;
    current = next;
  }
  return current;
}

/** Invokes the existing approved Browserbase vital/obituary function for one case. */
export async function runS45VitalObituary(
  env: S45BrowserbaseEnv,
  input: { ownerName: string; county?: string; propertyAddress?: string },
): Promise<S45VitalFinding> {
  const apiKey = text(env.BROWSERBASE_API_KEY);
  const functionId = text(env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID);
  if (!apiKey || !functionId) throw new Error("browserbase_vital_workflow_unconfigured");
  const apiBase = text(env.BROWSERBASE_API_BASE) || "https://api.browserbase.com";
  const normalizedApiBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const sourceUrls = await discoverSourceUrls(normalizedApiBase, apiKey, input);
  const response = await fetch(normalizedApiBase + "/v1/functions/" + encodeURIComponent(functionId) + "/invoke", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-bb-api-key": apiKey },
    body: JSON.stringify({
      params: {
        ownerName: input.ownerName,
        estateName: input.ownerName,
        county: input.county || "Miami-Dade",
        propertyAddress: input.propertyAddress || "",
        sourceUrls,
      },
      sessionCreateParams: {
        projectId: text(env.BROWSERBASE_PROJECT_ID) || undefined,
        browserSettings: { recordSession: true, logSession: true, solveCaptchas: true, enablePdfViewer: true },
        timeout: 900,
      },
    }),
  });
  if (!response.ok) throw new Error(`browserbase_vital_invoke_failed_${response.status}`);
  const completed = await waitForResult(record(await response.json().catch(() => ({}))), normalizedApiBase, apiKey);
  if (["PENDING", "RUNNING"].includes(text(completed.status).toUpperCase())) throw new Error("browserbase_vital_timeout");
  const result = record(completed.results);
  const sourceUrl = text(result.sourceUrl) || text(result.obituaryLink);
  if (!sourceUrl || !sourceUrl.startsWith("https://")) throw new Error("browserbase_vital_source_not_found");
  const finding: S45VitalFinding = {
    sourceUrl,
    ...(text(result.dateOfBirth) ? { dateOfBirth: text(result.dateOfBirth) } : {}),
    ...(text(result.dateOfDeath) ? { dateOfDeath: text(result.dateOfDeath) } : {}),
    ...(text(result.obituarySnapshot) ? { obituarySnapshot: text(result.obituarySnapshot).slice(0, 1200) } : {}),
    ...(text(completed.id) ? { invocationId: text(completed.id) } : {}),
    ...(text(completed.sessionId) ? { sessionId: text(completed.sessionId) } : {}),
    accessMode: "browserbase_function",
  };
  return finding;
}

/** Uses Browserbase Search for Google candidate discovery and fetches direct destinations without browser minutes. */
export async function runS46VitalObituary(
  env: S45BrowserbaseEnv,
  input: { ownerName: string; county?: string; propertyAddress?: string },
): Promise<S45VitalFinding> {
  const apiKey = text(env.BROWSERBASE_API_KEY);
  if (!apiKey) throw new Error("browserbase_vital_workflow_unconfigured");
  const apiBase = text(env.BROWSERBASE_API_BASE) || "https://api.browserbase.com";
  const normalizedApiBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const sourceUrls = await discoverSourceUrls(normalizedApiBase, apiKey, input);
  if (!sourceUrls.length) return { sourceUrl: "", accessMode: "direct_destination", searchResultCount: 0, checkedCandidateCount: 0 };
  const direct = await directDestinationFinding(sourceUrls, input, normalizedApiBase, apiKey);
  if (direct.finding) return direct.finding;
  if (direct.fetchedCount > 0) return { sourceUrl: "", accessMode: "direct_destination", searchResultCount: sourceUrls.length, checkedCandidateCount: direct.fetchedCount };
  if (!text(env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID)) throw new Error("browserbase_vital_destination_access_blocked");
  return runS45VitalObituary(env, input);
}
